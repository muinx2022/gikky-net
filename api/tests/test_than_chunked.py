"""`config.wsgi.DocThanChunked` — thân `Transfer-Encoding: chunked` phải tới được view.

Nhóm này tồn tại vì một lỗi đã chạy **cả một bản deploy** trên prod mà không ai thấy
(`P-20260828-1`): `middleware.ts` của Next chạy edge runtime, `fetch` ở đó gửi thân kiểu
chunked, Django dựng `LimitedStream` theo `CONTENT_LENGTH` nên đọc **0 byte**, và cửa đếm
lượt xem trả 400 ở mọi lượt. Bảng `LuotXem` đứng ở 0 hàng suốt.

Điều làm nó khó thấy: 400 ấy là *"Field required"* — chữ của một client gửi thiếu trường,
không phải chữ của một tầng hạ tầng nuốt mất thân request.
"""

import io
import json

import pytest
from django.test import override_settings

from config.wsgi import TRAN_THAN_CHUNKED, DocThanChunked

SECRET = "secret-cua-bai-do-khong-phai-that"


class GhiLaiApp:
    """App WSGI giả — giữ lại `environ` mà nó nhận được, để bài đo soi."""

    def __init__(self):
        self.environ = None
        self.than = None

    def __call__(self, environ, start_response):
        self.environ = environ
        self.than = environ["wsgi.input"].read()
        start_response("200 OK", [("Content-Type", "text/plain")])
        return [b"ok"]


class LuongDemLuot(io.BytesIO):
    """`BytesIO` nhưng ghi lại **mỗi lần đọc xin bao nhiêu byte**.

    Cần để đo chốt 2 của `DocThanChunked`: nó phải đọc `tran + 1`, KHÔNG phải đọc hết rồi
    mới đo. Đọc hết rồi mới từ chối là đã nuốt xong đúng thứ mình định từ chối — tức trần
    không bảo vệ được gì.
    """

    def __init__(self, du_lieu):
        super().__init__(du_lieu)
        self.xin = []

    def read(self, n=-1):
        self.xin.append(n)
        return super().read(n)


def moi_truong(than: bytes, *, chunked: bool, co_content_length: bool, method="POST"):
    env = {
        "REQUEST_METHOD": method,
        "PATH_INFO": "/",
        "wsgi.input": LuongDemLuot(than),
    }
    if chunked:
        env["HTTP_TRANSFER_ENCODING"] = "chunked"
    if co_content_length:
        env["CONTENT_LENGTH"] = str(len(than))
    return env


def bat_dau_gia():
    ghi = {}

    def start_response(status, headers):
        ghi["status"] = status
        ghi["headers"] = headers

    return ghi, start_response


# --- N1: ca chính ------------------------------------------------------------


def test_N1_than_chunked_toi_duoc_view_va_content_length_duoc_dat():
    app = GhiLaiApp()
    boc = DocThanChunked(app)
    than = json.dumps({"duong_dan": "/m/abc-1", "user_agent": "x"}).encode()
    env = moi_truong(than, chunked=True, co_content_length=False)

    _, start_response = bat_dau_gia()
    boc(env, start_response)

    assert app.than == than, "view phải nhận ĐỦ thân, không phải chuỗi rỗng"
    assert app.environ["CONTENT_LENGTH"] == str(len(than))


# --- N2/N3: KHÔNG được đụng vào request bình thường --------------------------


def test_N2_request_co_content_length_thi_KHONG_bi_dung_vao():
    """Đường ghi ảnh (multipart, có `Content-Length`) phải đi nguyên vẹn.

    Đo bằng **định danh object**, không bằng nội dung: nếu lớp bọc đọc rồi dựng lại một
    `BytesIO` khác thì nội dung vẫn khớp mà một upload lớn đã bị nuốt trọn vào RAM.
    """
    app = GhiLaiApp()
    than = b"anh-gia-lap"
    env = moi_truong(than, chunked=False, co_content_length=True)
    luong_goc = env["wsgi.input"]

    _, start_response = bat_dau_gia()
    DocThanChunked(app)(env, start_response)

    assert app.environ["wsgi.input"] is luong_goc, "wsgi.input đã bị thay — không được"
    assert luong_goc.xin == [-1], "lớp bọc đã đọc trước thân của request bình thường"


def test_N2b_chunked_NHUNG_van_co_content_length_thi_khong_dung_vao():
    """`CONTENT_LENGTH` có mặt ⇒ Django đọc đúng rồi, không việc gì phải xen vào."""
    app = GhiLaiApp()
    than = b"12345"
    env = moi_truong(than, chunked=True, co_content_length=True)
    luong_goc = env["wsgi.input"]

    _, start_response = bat_dau_gia()
    DocThanChunked(app)(env, start_response)

    assert app.environ["wsgi.input"] is luong_goc


def test_N3_GET_khong_than_khong_chunked_thi_khong_dung_vao():
    app = GhiLaiApp()
    env = moi_truong(b"", chunked=False, co_content_length=False, method="GET")
    luong_goc = env["wsgi.input"]

    _, start_response = bat_dau_gia()
    DocThanChunked(app)(env, start_response)

    assert app.environ["wsgi.input"] is luong_goc
    assert "CONTENT_LENGTH" not in app.environ


# --- N4: trần ----------------------------------------------------------------


def test_N4_vuot_tran_tra_413_va_KHONG_doc_qua_tran():
    app = GhiLaiApp()
    tran = 64
    env = moi_truong(b"x" * (tran * 10), chunked=True, co_content_length=False)
    luong = env["wsgi.input"]

    ghi, start_response = bat_dau_gia()
    ra = DocThanChunked(app, tran=tran)(env, start_response)

    assert ghi["status"].startswith("413")
    assert app.environ is None, "request vượt trần KHÔNG được đi tiếp xuống Django"
    assert b"than_qua_lon" in b"".join(ra)
    # Chốt 2: đọc `tran + 1`, không đọc hết. Đây là dòng làm cho trần có nghĩa.
    assert luong.xin == [tran + 1], f"đã xin đọc {luong.xin} byte, phải là [{tran + 1}]"


def test_N4b_vua_dung_tran_thi_VAN_qua():
    """Ranh giới: `== tran` phải đi lọt, chỉ `> tran` mới bị chặn."""
    app = GhiLaiApp()
    tran = 64
    than = b"y" * tran
    env = moi_truong(than, chunked=True, co_content_length=False)

    ghi, start_response = bat_dau_gia()
    DocThanChunked(app, tran=tran)(env, start_response)

    assert ghi["status"].startswith("200")
    assert app.than == than


def test_tran_mac_dinh_du_rong_cho_than_that():
    """Trần mặc định phải rộng hơn hẳn thứ đi qua đường này, nếu không nó là một cái bẫy."""
    than_that = json.dumps({"duong_dan": "/m/" + "a" * 200, "user_agent": "M" * 400})
    assert len(than_that.encode()) * 100 < TRAN_THAN_CHUNKED


# --- Tích hợp: đi qua CHÍNH `application` thật --------------------------------


@pytest.fixture
def giu_ket_noi_db():
    """Gọi THẲNG `application` thì phải tự ngắt `close_old_connections`.

    Vòng đời request thật bắn `request_started`/`request_finished`, và receiver
    `close_old_connections` của Django **đóng kết nối** — mà kết nối ấy đang giữ transaction
    của `pytest.mark.django_db`. Hậu quả: `OperationalError: the connection is closed` ngay
    lời truy vấn đầu tiên sau đó.

    `django.test.Client` làm đúng việc này (`django/test/testcases.py`), nhưng bài đo ở đây
    cố ý **không** dùng `Client`: `Client` luôn đặt `CONTENT_LENGTH`, tức nó không dựng lại
    được hình dạng request mà bài đo này sinh ra để đo.
    """
    from django.core.signals import request_finished, request_started
    from django.db import close_old_connections

    request_started.disconnect(close_old_connections)
    request_finished.disconnect(close_old_connections)
    try:
        yield
    finally:
        request_started.connect(close_old_connections)
        request_finished.connect(close_old_connections)


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET, ALLOWED_HOSTS=["testserver"])
def test_tich_hop_cua_dem_luot_xem_nhan_duoc_than_chunked(giu_ket_noi_db):
    """Ca THẬT của `P-20260828-1`, dựng lại đúng hình dạng request của edge runtime.

    Bài đo đơn vị ở trên đo lớp bọc; bài này đo **cả chuỗi** — lớp bọc → Django → Ninja →
    view → hàng trong DB. Thiếu nó thì lớp bọc có thể đúng mà vẫn không cắm vào `application`.
    """
    from core.models import LuotXem

    from config.wsgi import application

    than = json.dumps({"duong_dan": "/m/chunked-1", "user_agent": "bai-do"}).encode()
    env = {
        "REQUEST_METHOD": "POST",
        "PATH_INFO": "/api/v1/dem-luot-xem",
        "SERVER_NAME": "testserver",
        "SERVER_PORT": "80",
        "SERVER_PROTOCOL": "HTTP/1.1",
        "wsgi.version": (1, 0),
        "wsgi.url_scheme": "http",
        "wsgi.input": io.BytesIO(than),
        "wsgi.errors": io.BytesIO(),
        "wsgi.multithread": False,
        "wsgi.multiprocess": False,
        "wsgi.run_once": False,
        "CONTENT_TYPE": "application/json",
        # ⚠ CỐ Ý KHÔNG có `CONTENT_LENGTH` — đó là cả nội dung của bài đo.
        "HTTP_TRANSFER_ENCODING": "chunked",
        "HTTP_X_DEM_LUOT_XEM_SECRET": SECRET,
        "HTTP_HOST": "testserver",
    }

    ghi, start_response = bat_dau_gia()
    than_ra = b"".join(application(env, start_response))

    assert ghi["status"].startswith("200"), f"{ghi['status']} · {than_ra!r}"
    assert json.loads(than_ra) == {"da_dem": True}
    assert LuotXem.objects.filter(duong_dan="/m/chunked-1").count() == 1
