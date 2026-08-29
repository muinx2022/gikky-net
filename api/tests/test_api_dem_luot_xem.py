"""Đường ghi lượt xem — nhóm G của `plans/2026-08-27-thong-ke-luot-xem.md` §8.

Ba nhánh từ chối và một nhánh ghi, và **cả ba nhánh từ chối phải ghi 0 hàng**. Đó là
điểm của nhóm này: một cửa ghi không có phiên đăng nhập mà từ chối bằng status code
nhưng vẫn kịp `INSERT` là một cửa vẫn bơm được số liệu rác — chỉ khó thấy hơn.

Mọi bài ở đây đếm `LuotXem.objects.count()` **sau** mỗi lượt gọi, kể cả những lượt đã
khẳng định status. Đó không phải thừa: hai khẳng định đo hai chuyện khác nhau, và cái
thứ hai là cái quan trọng hơn.
"""

import json

import pytest
from django.test import Client, override_settings

from api.dem_luot_xem import DAI_TOI_DA_DUONG_DAN, HEADER_SECRET
from core.models.luot_xem import LuotXem

URL = "/api/v1/dem-luot-xem"
SECRET = "secret-cua-bai-do-khong-dung-o-dau-khac"

#: Django đọc header tự đặt từ `META` theo tên viết hoa có tiền tố `HTTP_`. `Client` nhận
#: chúng dưới dạng keyword; dựng khoá từ chính hằng của module sản phẩm để hai bên không
#: lệch nhau khi ai đó đổi tên header.
KHOA_HEADER = "HTTP_" + HEADER_SECRET.upper().replace("-", "_")


def goi(than: dict, *, secret: str | None = SECRET):
    """POST một lượt xem. `secret=None` ⇒ **không gửi header nào** (khách trần)."""
    them = {} if secret is None else {KHOA_HEADER: secret}
    return Client().post(
        URL, data=json.dumps(than), content_type="application/json", **them
    )


# --- G1: đường thành công ----------------------------------------------------


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G1_secret_dung_ghi_dung_MOT_hang():
    r = goi({"duong_dan": "/m/abc-1", "user_agent": "Mozilla/5.0 Chrome/131"})
    assert r.status_code == 200, r.content
    assert r.json() == {"da_dem": True}

    assert LuotXem.objects.count() == 1
    hang = LuotXem.objects.get()
    assert hang.duong_dan == "/m/abc-1"
    assert hang.la_bot is False
    assert hang.ten_bot == ""


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G1b_bot_duoc_danh_dau_va_dat_ten():
    goi(
        {
            "duong_dan": "/",
            "user_agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        }
    )
    hang = LuotXem.objects.get()
    assert hang.la_bot is True
    assert hang.ten_bot == "googlebot"


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G1c_khong_luu_user_agent_tho_o_bat_ky_cot_nao():
    """Quyết định của user: UA được **gửi** để phân loại, và **không được lưu**.

    Đo bằng cách quét MỌI cột chuỗi của hàng vừa ghi, không bằng cách liệt kê tên cột:
    thêm một cột `user_agent` ở lượt sau thì bài đo phải đỏ, mà một danh sách tên cột
    viết tay sẽ không biết cột mới tồn tại.
    """
    ua = "Mozilla/5.0 (Windows NT 10.0) DUOI-NHAN-DANG-KHONG-DUOC-LUU/1.0"
    goi({"duong_dan": "/", "user_agent": ua})
    hang = LuotXem.objects.get()
    gia_tri = [
        str(getattr(hang, f.attname)) for f in LuotXem._meta.get_fields() if f.concrete
    ]
    assert not any("DUOI-NHAN-DANG-KHONG-DUOC-LUU" in v for v in gia_tri), gia_tri


# --- G2 / G3: hai nhánh từ chối, và cả hai ghi 0 hàng ------------------------


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G2_secret_sai_thi_401_va_KHONG_ghi_gi():
    r = goi({"duong_dan": "/", "user_agent": "x"}, secret="sai-be-bét")
    assert r.status_code == 401
    assert r.json()["code"] == "sai_secret"
    assert LuotXem.objects.count() == 0


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET="")
def test_G3_secret_rong_o_server_thi_503_va_KHONG_ghi_gi():
    """Fail-closed. Đây là trạng thái MẶC ĐỊNH của máy dev và của `pytest`.

    503 chứ không phải 200-im-lặng: người vừa bật cơ chế phải biết là nó chưa bật. Và
    503 chứ không phải 401: hai câu trả lời khác nhau cho hai việc phải làm khác nhau
    (đặt biến ở server / sửa secret ở phía gọi).
    """
    r = goi({"duong_dan": "/", "user_agent": "x"}, secret="bat-ky-chuoi-nao")
    assert r.status_code == 503
    assert r.json()["code"] == "dem_luot_xem_tat"
    assert LuotXem.objects.count() == 0


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_khach_khong_kem_header_nao_thi_401_chua_dang_nhap():
    """Khách bằng trình duyệt nhận đúng câu trả lời của mọi cửa ghi khác.

    Nhánh này cũng được `tests/test_quyen_ghi.py::test_khach_khong_ghi_duoc_gi` chấm
    (cửa này có mặt trong bảng `CUA_GHI`); ở đây đo thêm vế **0 hàng**.
    """
    r = goi({"duong_dan": "/", "user_agent": "x"}, secret=None)
    assert r.status_code == 401
    assert r.json()["code"] == "chua_dang_nhap"
    assert LuotXem.objects.count() == 0


# --- G4 / G5: chuẩn hoá đường dẫn -------------------------------------------


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
@pytest.mark.parametrize(
    "gui,luu",
    [
        ("/m/abc-1?utm_source=facebook&utm_campaign=x", "/m/abc-1"),
        ("/?fbclid=abcdef", "/"),
        ("/s/chung-khoan#top", "/s/chung-khoan"),
        ("/tim-kiem?q=hpg#kq", "/tim-kiem"),
        ("/khong-co-gi", "/khong-co-gi"),
    ],
)
def test_G4_query_string_va_fragment_bi_cat_khoi_duong_dan(gui, luu):
    """`?utm_source=…` đẻ vô hạn biến thể của cùng một trang.

    Không cắt thì bảng "xem nhiều nhất" vỡ thành hàng nghìn dòng mỗi dòng một lượt — tức
    đúng câu hỏi của user không trả lời được nữa, mà bảng vẫn đầy và vẫn trông như thật.
    """
    goi({"duong_dan": gui, "user_agent": "x"})
    assert LuotXem.objects.get().duong_dan == luu


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G5_duong_dan_dai_hon_200_bi_CAT_chu_khong_nem():
    """Cắt, không từ chối: một URL 300 ký tự là một trang có thật ai đó đã xem.

    ⚠ Bài này **không** ghim thứ tự "cắt sau khi bỏ query". Bản đầu có khẳng định ấy và
    lượt thử phá cho thấy nó sai: đảo hai phép vẫn ra cùng kết quả với mọi đầu vào
    (`duong_dan[:min(200, vị_trí_dấu_hỏi)]` ở cả hai lối), nên một bài đo canh thứ tự sẽ
    xanh với mọi cách cài — đúng định nghĩa bài đo rỗng. Xem `chuan_hoa_duong_dan`.

    Cái bài này ghim là hai chuyện đo được: **cắt đúng trần**, và **không còn query**.
    """
    than = "/m/" + "x" * 400
    r = goi({"duong_dan": f"{than}?utm_source=y", "user_agent": "x"})
    assert r.status_code == 200

    hang = LuotXem.objects.get()
    assert len(hang.duong_dan) == DAI_TOI_DA_DUONG_DAN
    assert hang.duong_dan == than[:DAI_TOI_DA_DUONG_DAN]
    assert "utm_source" not in hang.duong_dan


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_ua_thieu_han_van_ghi_duoc_va_tinh_la_bot():
    """Thân không có `user_agent` ⇒ mặc định `""` ⇒ `"khác"`, không nổ."""
    r = goi({"duong_dan": "/"})
    assert r.status_code == 200
    hang = LuotXem.objects.get()
    assert hang.la_bot is True
    assert hang.ten_bot == "khác"


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_dau_gach_cuoi_KHONG_de_ra_dong_thu_hai():
    """`/m/abc-1/` và `/m/abc-1` là CÙNG một trang — phải ra cùng một `duong_dan`.

    Next trả 308 từ dạng có dấu `/` sang dạng không, và middleware chạy cho **cả hai**
    request ⇒ hai hàng, hai dòng riêng trong bảng "xem nhiều nhất", một lượt xem đếm
    thành hai. Không sai chức năng, chỉ sai số — và sai theo kiểu không ai nhìn ra, vì
    hai dòng trông như hai trang khác nhau. Lượt phản biện 2026-08-27 tìm ra.
    """
    for d in ("/m/abc-1", "/m/abc-1/", "/m/abc-1//"):
        assert goi({"duong_dan": d, "user_agent": "Chrome/131"}).status_code == 200
    assert LuotXem.objects.filter(duong_dan="/m/abc-1").count() == 3
    assert LuotXem.objects.exclude(duong_dan="/m/abc-1").count() == 0

    # Trang chủ là ngoại lệ: bỏ dấu `/` của nó thì còn chuỗi rỗng.
    assert goi({"duong_dan": "/", "user_agent": "Chrome/131"}).status_code == 200
    assert LuotXem.objects.filter(duong_dan="/").count() == 1
