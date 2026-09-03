"""Nhắn tin riêng 1-1 — `plans/2026-09-03-nhan-tin-rieng.md`, tiêu chí A2–A13.

Bốn nhóm câu hỏi, và không nhóm nào trả lời hộ nhóm nào:

1. **Dữ liệu có chặn được cái sai không** (A2) — đo trên `pg_constraint` và trên
   `IntegrityError` thật, không đo qua HTTP. Ràng buộc `nguoi_a_id < nguoi_b_id` là bất
   biến duy nhất giữ cho "một cặp một hàng"; hỏng nó thì mọi con số phía trên hỏng theo.
2. **Ai thấy được gì** (A3, A7) — khách bị chặn ở cả năm cửa, và người thứ ba không thấy
   một chữ nào của cuộc trò chuyện giữa hai người khác.
3. **Con số có đúng không** (A4, A6, A8, A9) — chưa đọc, thứ tự hộp thư, phân trang, và
   **số truy vấn HẰNG** theo số hội thoại.
4. **Chuông + hạn mức + hợp đồng** (A10–A13).

⚠ Mỗi bài đo mang mã tiêu chí trong TÊN. Đó không phải trang trí: bảng §4 của plan là thứ
chặng nghiệm thu chấm, và một tiêu chí không tra ngược ra được bài đo nào là một tiêu chí
không ai đo.
"""

import json
from datetime import timedelta

import pytest
from django.db import IntegrityError, connection, transaction
from django.test import override_settings
from django.utils import timezone

from core.models.he_thong import Notification
from core.models.tin_nhan import HoiThoai, TinNhan
from core.thong_bao import TIN_NHAN
from core.tin_nhan import gui_tin

from .conftest import dat, dung_user, lay, ma_loi, moi_chuoi

HOP_THU = "/api/v1/me/tin-nhan"
#: ⚠ Gạch NỐI, không gạch chéo — `chua-doc` là username hợp lệ, nên
#: `/me/tin-nhan/chua-doc` rơi vào không gian `{username}`. Ghim ở `test_A20_*`.
CHUA_DOC = "/api/v1/me/tin-nhan-chua-doc"


def _voi(username: str) -> str:
    return f"{HOP_THU}/{username}"


@pytest.fixture
def nguoi_c(db):
    """Người thứ BA — người không liên quan. Nền cho A7 (rò rỉ per-user)."""
    return dung_user("nguoi_c", "Người C")


@pytest.fixture
def dang_nhap_a(client, nguoi_a):
    client.force_login(nguoi_a)
    return nguoi_a


@pytest.fixture
def dang_nhap_b(client, nguoi_b):
    client.force_login(nguoi_b)
    return nguoi_b


def _gui(nguoi_gui, nguoi_nhan, body: str) -> TinNhan:
    """Gửi qua tầng domain + bắn chuông, đúng như handler làm — xem `api/tin_nhan.py`."""
    from core.thong_bao import bao_tin_nhan

    with transaction.atomic():
        tin = gui_tin(nguoi_gui=nguoi_gui, nguoi_nhan=nguoi_nhan, body=body)
        bao_tin_nhan(tin)
    return tin


# --- A2 · ràng buộc ở tầng DB ------------------------------------------------


@pytest.mark.django_db
def test_A2_check_hoi_thoai_a_truoc_b_co_that_trong_pg_constraint():
    """`hoi_thoai_a_truoc_b` phải là một CHECK THẬT trong Postgres, so `nguoi_a` với `nguoi_b`.

    Đo `pg_constraint` chứ không chỉ đo hành vi: một `CheckConstraint` khai trong model mà
    migration chưa chạy vẫn làm ba bài đo `IntegrityError` dưới đây xanh — Django validate
    ở tầng Python trước. Hàng rào thật là hàng rào Postgres cầm.
    """
    with connection.cursor() as cur:
        cur.execute(
            "SELECT pg_get_constraintdef(oid), contype FROM pg_constraint "
            "WHERE conname = %s",
            ["hoi_thoai_a_truoc_b"],
        )
        hang = cur.fetchone()
    assert hang is not None, "không có constraint `hoi_thoai_a_truoc_b` trong DB"
    dinh_nghia, loai = hang
    assert loai == "c", f"`hoi_thoai_a_truoc_b` không phải CHECK mà là {loai!r}"
    assert "nguoi_a_id" in dinh_nghia and "nguoi_b_id" in dinh_nghia, (
        f"CHECK không nhắc tới hai cột người: {dinh_nghia}"
    )
    # `<=` chứ không `<` là ca lọt lưới đúng nghĩa: nó vẫn chặn cặp đảo nhưng **cho phép
    # `nguoi_a = nguoi_b`**, tức tự nhắn mình vào thẳng DB. Một phép kiểm `"<" in …` xanh
    # cho cả hai, nên nó phải nói ra điều nó không chấp nhận.
    assert "<=" not in dinh_nghia and "<" in dinh_nghia, (
        f"CHECK phải là `<` nghiêm ngặt, nhận: {dinh_nghia}"
    )


@pytest.mark.django_db
def test_A2_cap_dao_nguoc_bi_DB_tu_choi(nguoi_a, nguoi_b):
    """`HoiThoai(nguoi_a=B, nguoi_b=A)` với `B.pk > A.pk` phải NỔ ở DB.

    Đây là ca mà `UNIQUE (nguoi_a, nguoi_b)` một mình **không** chặn: `(A, B)` và `(B, A)`
    là hai bộ khác nhau với Postgres, nên không có `CHECK` thì hai hàng cùng tồn tại và
    một cuộc trò chuyện tách làm đôi.
    """
    assert nguoi_a.pk < nguoi_b.pk, "fixture đổi thứ tự pk ⇒ bài đo mất nghĩa"
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            HoiThoai.objects.create(nguoi_a=nguoi_b, nguoi_b=nguoi_a)


@pytest.mark.django_db
def test_A2_tu_nhan_minh_bi_DB_tu_choi(nguoi_a):
    """`nguoi_a = nguoi_b` cũng rơi vào cùng một `CHECK` — một điều kiện chặn hai chuyện."""
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            HoiThoai.objects.create(nguoi_a=nguoi_a, nguoi_b=nguoi_a)


@pytest.mark.django_db
def test_A2_cap_trung_bi_DB_tu_choi(nguoi_a, nguoi_b):
    """Hàng thứ hai cho cùng một cặp ⇒ `UNIQUE hoi_thoai_duy_nhat_cap`."""
    HoiThoai.objects.create(nguoi_a=nguoi_a, nguoi_b=nguoi_b)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            HoiThoai.objects.create(nguoi_a=nguoi_a, nguoi_b=nguoi_b)


# --- A3 · khách bị chặn ở CẢ NĂM cửa ----------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "method,duong",
    [
        ("get", HOP_THU),
        ("get", CHUA_DOC),
        ("get", f"{HOP_THU}/nguoi_a"),
        ("post", f"{HOP_THU}/nguoi_a"),
        ("post", f"{HOP_THU}/nguoi_a/doc"),
    ],
)
def test_A3_khach_bi_chan_o_ca_nam_cua(client, nguoi_a, method, duong):
    """Khách nhận **401 `chua_dang_nhap`** ở cả năm cửa, kể cả ba cửa ĐỌC.

    Ba cửa GET ở đây khác `GET /me` và `GET /machs/{id}/me` (cố ý trả 200 cho khách): hai
    cửa kia chạy trên mọi lượt tải trang kể cả của bot. Cụm nhắn tin chỉ được gọi khi
    client đã biết có người đăng nhập, nên 200 rỗng ở đây chỉ giấu một lỗi client đi cùng
    một vòng poll chạy vĩnh viễn không để làm gì.
    """
    if method == "get":
        r = client.get(duong)
        assert r.status_code == 401, r.content[:300]
        assert json.loads(r.content)["code"] == "chua_dang_nhap"
    else:
        assert ma_loi(client, duong, {"body": "x"}, status=401) == "chua_dang_nhap"


# --- A4 · một hội thoại bất kể chiều ----------------------------------------


@pytest.mark.django_db
def test_A4_gui_hai_chieu_van_chi_MOT_hoi_thoai(client, nguoi_a, nguoi_b):
    """A gửi B rồi B gửi A ⇒ đúng **một** hàng `HoiThoai`, `nguoi_a_id < nguoi_b_id`.

    Đo qua HTTP cả hai chiều chứ không gọi thẳng domain: bất biến này phải đúng ở cửa mà
    người dùng thật đi qua, và cửa ấy là chỗ `cap_thu_tu` có thể bị quên.
    """
    client.force_login(nguoi_a)
    t1 = dat(client, _voi("nguoi_b"), {"body": "Chào B"}, status=201)
    client.force_login(nguoi_b)
    t2 = dat(client, _voi("nguoi_a"), {"body": "Chào A"}, status=201)

    assert HoiThoai.objects.count() == 1
    ht = HoiThoai.objects.get()
    assert ht.nguoi_a_id < ht.nguoi_b_id
    assert TinNhan.objects.filter(hoi_thoai=ht).count() == 2
    assert {t1["id"], t2["id"]} == set(
        TinNhan.objects.filter(hoi_thoai=ht).values_list("pk", flat=True)
    )
    assert t1["cua_toi"] is True and t2["cua_toi"] is True


# --- A5 · bốn lời từ chối ----------------------------------------------------


@pytest.mark.django_db
def test_A5_tu_nhan_minh_la_400(client, dang_nhap_a):
    """Tự nhắn mình ⇒ 400, **không phải 404**: người ấy có thật, việc kia mới không làm được."""
    assert (
        ma_loi(client, _voi("nguoi_a"), {"body": "x"}, status=400)
        == "du_lieu_khong_hop_le"
    )
    r = client.get(_voi("nguoi_a"))
    assert r.status_code == 400 and json.loads(r.content)["code"] == "du_lieu_khong_hop_le"


@pytest.mark.django_db
def test_A5_than_toan_khoang_trang_la_400(client, dang_nhap_a, nguoi_b):
    """`"   "` qua được `min_length=1` của pydantic — phép `strip()` ở domain mới chặn nó.

    Không có bài này thì một tin nhắn trắng vào DB, hiện lên như một bong bóng rỗng, và
    nó vẫn bump `cap_nhat_luc` đẩy cuộc trò chuyện lên đầu hộp thư.
    """
    assert (
        ma_loi(client, _voi("nguoi_b"), {"body": "   \n  "}, status=400)
        == "du_lieu_khong_hop_le"
    )
    assert TinNhan.objects.count() == 0


@pytest.mark.django_db
def test_A5_2000_ky_tu_duoc_2001_thi_khong(client, dang_nhap_a, nguoi_b):
    """Trần đúng bằng `DO_DAI_TIN_TOI_DA`, và **ranh giới nằm đúng chỗ** (2000 ≠ 2001)."""
    dat(client, _voi("nguoi_b"), {"body": "x" * 2000}, status=201)
    assert (
        ma_loi(client, _voi("nguoi_b"), {"body": "x" * 2001}, status=400)
        == "tham_so_khong_hop_le"
    )
    assert TinNhan.objects.count() == 1


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["get", "post"])
def test_A5_username_la_va_tai_khoan_vo_hieu_CUNG_mot_ma_404(
    client, dang_nhap_a, nguoi_b, method
):
    """Username không tồn tại và `is_active=False` trả **cùng** `khong_tim_thay`.

    Phân biệt hai ca là kể cho người lạ nghe rằng một tài khoản có thật và vừa bị vô hiệu
    hoá — cùng lý lẽ `api/loi.py::KHONG_TIM_THAY` đã chốt cho nội dung bị ẩn.
    """
    nguoi_b.is_active = False
    nguoi_b.save(update_fields=["is_active"])

    for username in ("khong_co_ai", "nguoi_b"):
        duong = _voi(username)
        if method == "get":
            r = client.get(duong)
            assert r.status_code == 404, (username, r.content[:300])
            assert json.loads(r.content)["code"] == "khong_tim_thay"
        else:
            assert ma_loi(client, duong, {"body": "x"}, status=404) == "khong_tim_thay"
    assert TinNhan.objects.count() == 0


# --- A6 · chưa đọc ----------------------------------------------------------


def _chua_doc(client) -> int:
    return lay(client, CHUA_DOC)["so_chua_doc"]


@pytest.mark.django_db
def test_A6_nguoi_gui_khong_tu_dem_va_doc_la_idempotent(client, nguoi_a, nguoi_b):
    """A gửi 3 ⇒ B thấy 3, A thấy 0. B gửi 1 ⇒ A thấy 1, B vẫn 3. B đọc ⇒ 0, đọc lại vẫn 0.

    Vế "A thấy 0" là vế dễ hỏng nhất và dễ bỏ sót nhất: bỏ `.exclude(nguoi_gui=user)` hay
    quên dời vạch đọc của người gửi trong `gui_tin` đều làm phong bì của chính người vừa
    bấm Gửi sáng lên, và không cách nào tắt ngoài mở lại hội thoại.
    """
    for i in range(3):
        _gui(nguoi_a, nguoi_b, f"tin {i}")

    client.force_login(nguoi_b)
    assert _chua_doc(client) == 3
    client.force_login(nguoi_a)
    assert _chua_doc(client) == 0

    _gui(nguoi_b, nguoi_a, "trả lời")
    assert _chua_doc(client) == 1, "A phải thấy đúng tin B vừa gửi"
    client.force_login(nguoi_b)
    assert _chua_doc(client) == 3, "tin B tự gửi không được cộng vào số của B"

    assert dat(client, _voi("nguoi_a") + "/doc")["so_chua_doc"] == 0
    assert dat(client, _voi("nguoi_a") + "/doc")["so_chua_doc"] == 0
    client.force_login(nguoi_a)
    assert _chua_doc(client) == 1, "B đọc hội thoại không được tắt chưa-đọc của A"


@pytest.mark.django_db
def test_A6_doc_khi_chua_tung_nhan_tin_van_la_200(client, dang_nhap_a, nguoi_b):
    """Chưa có hội thoại ⇒ `POST …/doc` là 200 không làm gì, không phải 404."""
    assert dat(client, _voi("nguoi_b") + "/doc")["so_chua_doc"] == 0
    assert HoiThoai.objects.count() == 0


# --- A7 · người thứ ba không thấy gì ----------------------------------------


@pytest.mark.django_db
def test_A7_nguoi_thu_ba_khong_thay_mot_chu_nao(client, nguoi_a, nguoi_b, nguoi_c):
    """C không thấy hội thoại A–B ở hộp thư, và `GET …/nguoi_a` của C trả hội thoại RỖNG.

    Kiểm bằng `moi_chuoi()` chứ không chỉ bằng `len(items)`: một trường lồng sâu (xem
    trước tin cuối, payload chuông) là chỗ nội dung rò ra mà phép đếm không thấy.
    """
    bi_mat = "so tai khoan cua toi la 1234"
    _gui(nguoi_a, nguoi_b, bi_mat)

    client.force_login(nguoi_c)
    hop_thu = lay(client, HOP_THU)
    assert hop_thu["items"] == [] and hop_thu["so_chua_doc"] == 0
    assert bi_mat not in moi_chuoi(hop_thu)

    chi_tiet = lay(client, _voi("nguoi_a"))
    assert chi_tiet["hoi_thoai_id"] is None and chi_tiet["items"] == []
    assert bi_mat not in moi_chuoi(chi_tiet)

    # Và C mở hội thoại với A **không** đụng vào hàng của A–B.
    dat(client, _voi("nguoi_a") + "/doc")
    assert HoiThoai.objects.count() == 1
    client.force_login(nguoi_b)
    assert _chua_doc(client) == 1


# --- A8 · hộp thư: thứ tự, xem trước, số truy vấn HẰNG ----------------------


@pytest.mark.django_db
def test_A8_hop_thu_sap_moi_nhat_truoc_va_xem_truoc_dung(
    client, nguoi_a, nguoi_b, nguoi_c
):
    """Hội thoại có tin mới nhất đứng đầu; `tin_cuoi` là tin cuối thật, `cua_toi` đúng."""
    _gui(nguoi_a, nguoi_b, "cũ với B")
    _gui(nguoi_c, nguoi_a, "mới với C")

    client.force_login(nguoi_a)
    d = lay(client, HOP_THU)
    assert [i["nguoi_kia"]["username"] for i in d["items"]] == ["nguoi_c", "nguoi_b"]
    assert d["items"][0]["tin_cuoi"]["body"] == "mới với C"
    assert d["items"][0]["tin_cuoi"]["cua_toi"] is False
    assert d["items"][0]["so_chua_doc"] == 1
    assert d["items"][1]["tin_cuoi"]["body"] == "cũ với B"
    assert d["items"][1]["tin_cuoi"]["cua_toi"] is True, "tin A tự gửi phải là `cua_toi`"
    assert d["items"][1]["so_chua_doc"] == 0
    assert d["so_chua_doc"] == 1

    # A trả lời B ⇒ hội thoại với B nhảy lên đầu.
    _gui(nguoi_a, nguoi_b, "mới với B")
    assert [i["nguoi_kia"]["username"] for i in lay(client, HOP_THU)["items"]] == [
        "nguoi_b",
        "nguoi_c",
    ]


#: Số truy vấn của `GET /me/tin-nhan`, **HẰNG theo số hội thoại**: phiên (2) + hội thoại
#: (1) + tin cuối cả lô bằng `DISTINCT ON` (1) + chưa đọc theo hội thoại (1) + tổng chưa
#: đọc (1). Con số này là cả điểm của bài đo dưới; đổi nó mà không đổi lý do là bỏ hàng rào.
SO_QUERY_HOP_THU = 6


@pytest.mark.django_db
@pytest.mark.parametrize("n", [3, 6])
def test_A8_so_query_hop_thu_KHONG_tang_theo_so_hoi_thoai(
    client, nguoi_a, django_assert_num_queries, n
):
    """Đo ở N=3 **và** N=6: một con số duy nhất không phân biệt được hằng với tuyến tính.

    Đây là bài đo mà "vòng `for` gọi `.first()` cho từng hội thoại" làm đỏ — cách viết
    đúng-về-kết-quả nhưng biến mỗi lượt mở hộp thư thành N+1 truy vấn.
    """
    for i in range(n):
        _gui(dung_user(f"ban_{i}", f"Bạn {i}"), nguoi_a, f"chào {i}")

    client.force_login(nguoi_a)
    with django_assert_num_queries(SO_QUERY_HOP_THU):
        d = lay(client, HOP_THU)
    assert len(d["items"]) == n and d["so_chua_doc"] == n


# --- A9 · phân trang tin cũ -------------------------------------------------


@pytest.mark.django_db
def test_A9_phan_trang_lui_theo_id(client, nguoi_a, nguoi_b):
    """70 tin ⇒ trang 1 là 30 tin MỚI NHẤT sắp TĂNG DẦN; `?truoc=` lùi tiếp; trang cuối hết.

    Thứ tự tăng dần là thứ tự đọc của khung chat (cũ ở trên), còn phân trang thì đi lùi —
    hai chiều ngược nhau trong cùng một response, và đó chính là chỗ dễ viết ngược.
    """
    for i in range(70):
        _gui(nguoi_a if i % 2 == 0 else nguoi_b, nguoi_b if i % 2 == 0 else nguoi_a, f"t{i}")

    client.force_login(nguoi_a)
    d = lay(client, _voi("nguoi_b"))
    ids = [t["id"] for t in d["items"]]
    assert len(ids) == 30 and ids == sorted(ids), "phải TĂNG DẦN theo id"
    assert [t["body"] for t in d["items"]][-1] == "t69", "trang 1 phải là tin MỚI NHẤT"
    assert d["con_cu_hon"] is True

    d2 = lay(client, f"{_voi('nguoi_b')}?truoc={ids[0]}")
    ids2 = [t["id"] for t in d2["items"]]
    assert len(ids2) == 30 and ids2 == sorted(ids2)
    assert max(ids2) < min(ids), "trang sau phải toàn tin CŨ hơn"
    assert d2["con_cu_hon"] is True

    d3 = lay(client, f"{_voi('nguoi_b')}?truoc={ids2[0]}")
    assert len(d3["items"]) == 10 and d3["con_cu_hon"] is False


@pytest.mark.django_db
@pytest.mark.parametrize("limit", [0, 51])
def test_A9_limit_ngoai_dai_la_400(client, dang_nhap_a, nguoi_b, limit):
    r = client.get(f"{_voi('nguoi_b')}?limit={limit}")
    assert r.status_code == 400, r.content[:300]
    assert json.loads(r.content)["code"] == "tham_so_khong_hop_le"


# --- A10 · chuông ------------------------------------------------------------


def _chuong_tin_nhan(user):
    return Notification.objects.filter(user=user, type=TIN_NHAN)


@pytest.mark.django_db
def test_A10_chuong_gop_theo_hoi_thoai_va_tat_khi_doc(client, nguoi_a, nguoi_b):
    """3 tin ⇒ B có ĐÚNG 1 dòng chuông `so_tin_moi = 3`; A không có dòng nào.

    Gộp theo hội thoại (không theo ngày) là điều khiến chuông chịu được một cuộc trò
    chuyện đang sôi: 20 tin trong 5 phút không được đẩy mọi thứ khác ra khỏi chuông.

    Vế cuối là vế hay bị bỏ: sau khi B đọc, tin **mới** phải làm `read_at` về `NULL` lại —
    không thì hàng thông báo tồn tại, payload đúng, mà không ai nhìn thấy.
    """
    for i in range(3):
        _gui(nguoi_a, nguoi_b, f"tin {i}")

    assert _chuong_tin_nhan(nguoi_a).count() == 0, "người gửi không được tự nhận chuông"
    assert _chuong_tin_nhan(nguoi_b).count() == 1
    tb = _chuong_tin_nhan(nguoi_b).get()
    assert tb.payload["so_tin_moi"] == 3
    assert tb.payload["boi"] == "nguoi_a"
    assert tb.payload["boi_hien_thi"] == "Người A"
    assert tb.payload["hoi_thoai_id"] == HoiThoai.objects.get().pk
    assert tb.read_at is None

    client.force_login(nguoi_b)
    dat(client, _voi("nguoi_a") + "/doc")
    assert _chuong_tin_nhan(nguoi_b).get().read_at is not None

    _gui(nguoi_a, nguoi_b, "tin thứ tư")
    assert _chuong_tin_nhan(nguoi_b).count() == 1, "vẫn phải là MỘT dòng, được bump"
    tb = _chuong_tin_nhan(nguoi_b).get()
    assert tb.payload["so_tin_moi"] == 1, "đếm lại từ nguồn, không cộng dồn"
    assert tb.read_at is None


@pytest.mark.django_db
def test_A10_cua_HTTP_that_su_ban_chuong(client, dang_nhap_a, nguoi_b):
    """Đo qua **cửa HTTP**, không qua helper — nếu không thì bài đo trên rỗng một nửa.

    Hai bài A10 phía trên gọi `core.tin_nhan.gui_tin` + `core.thong_bao.bao_tin_nhan`
    trực tiếp: chúng chứng minh *lớp domain* gộp và tắt chuông đúng, nhưng chúng vẫn xanh
    nguyên nếu ai đó xoá lời gọi `bao_tin_nhan` khỏi handler. Bài này là chỗ đỏ cho ca ấy
    — đúng phép thử phá số 3 của plan §5.
    """
    dat(client, _voi("nguoi_b"), {"body": "chào B"}, status=201)
    assert _chuong_tin_nhan(nguoi_b).count() == 1
    assert _chuong_tin_nhan(nguoi_b).get().payload["so_tin_moi"] == 1


@pytest.mark.django_db
def test_A10_doc_hoi_thoai_nay_KHONG_tat_chuong_cua_hoi_thoai_kia(
    client, nguoi_a, nguoi_b, nguoi_c
):
    """`dedupe_key` hẹp theo hội thoại — đọc với A không được tắt chuông của C."""
    _gui(nguoi_a, nguoi_b, "từ A")
    _gui(nguoi_c, nguoi_b, "từ C")
    assert _chuong_tin_nhan(nguoi_b).count() == 2

    client.force_login(nguoi_b)
    dat(client, _voi("nguoi_a") + "/doc")
    con_lai = _chuong_tin_nhan(nguoi_b).filter(read_at__isnull=True)
    assert [t.payload["boi"] for t in con_lai] == ["nguoi_c"]


# --- A11 · cùng transaction --------------------------------------------------


@pytest.mark.django_db
def test_A11_ghi_hong_thi_KHONG_con_tin_va_KHONG_con_thong_bao(nguoi_a, nguoi_b):
    """Tin và chuông phải cùng sống cùng chết — khuôn `test_thong_bao.py`.

    Nếu chuông được sinh ở transaction thứ hai (hoặc qua `on_commit`), nó **sống sót** qua
    cú rollback này: chuông báo một tin nhắn không tồn tại, dẫn tới một hội thoại trống.
    """
    from core.thong_bao import bao_tin_nhan

    class HongGiuaChung(RuntimeError):
        pass

    with pytest.raises(HongGiuaChung):
        with transaction.atomic():
            tin = gui_tin(nguoi_gui=nguoi_a, nguoi_nhan=nguoi_b, body="sẽ bị cuộn ngược")
            bao_tin_nhan(tin)
            assert TinNhan.objects.count() == 1
            assert _chuong_tin_nhan(nguoi_b).count() == 1
            raise HongGiuaChung

    assert TinNhan.objects.count() == 0
    assert HoiThoai.objects.count() == 0
    assert Notification.objects.count() == 0


# --- A12 · hạn mức 60 tin / giờ trượt ----------------------------------------


@pytest.mark.django_db
@override_settings(HAN_MUC_TIN_NHAN_MOI_GIO=2)
def test_A12_qua_han_muc_la_429_kem_thu_lai_tu(client, nguoi_a, nguoi_b):
    """Tin thứ 3 trong giờ ⇒ 429 `qua_han_muc_tin_nhan`, `thu_lai_tu` = tin cũ nhất + 1h.

    `thu_lai_tu` phải là **mốc cửa sổ trượt**, không phải "một giờ nữa": nói một giờ nữa
    cho người chạm trần bằng những tin gửi cách đây 58 phút là nói thừa 58 phút.
    """
    client.force_login(nguoi_a)
    dat(client, _voi("nguoi_b"), {"body": "1"}, status=201)
    dat(client, _voi("nguoi_b"), {"body": "2"}, status=201)

    than = dat(client, _voi("nguoi_b"), {"body": "3"}, status=429)
    assert than["code"] == "qua_han_muc_tin_nhan"
    cu_nhat = TinNhan.objects.order_by("created_at").first()
    thu_lai = timezone.datetime.fromisoformat(than["thu_lai_tu"])
    assert thu_lai.utcoffset() is not None, "`thu_lai_tu` phải là ISO có múi giờ"
    assert abs((thu_lai - (cu_nhat.created_at + timedelta(hours=1))).total_seconds()) < 1
    assert TinNhan.objects.count() == 2, "tin bị từ chối không được vào DB"


@pytest.mark.django_db
@override_settings(HAN_MUC_TIN_NHAN_MOI_GIO=2)
def test_A12_tin_cu_roi_khoi_cua_so_thi_gui_duoc_lai(client, nguoi_a, nguoi_b):
    """Cửa sổ **trượt**: dời hai tin cũ ra ngoài 60 phút là gửi lại được ngay."""
    client.force_login(nguoi_a)
    dat(client, _voi("nguoi_b"), {"body": "1"}, status=201)
    dat(client, _voi("nguoi_b"), {"body": "2"}, status=201)
    dat(client, _voi("nguoi_b"), {"body": "3"}, status=429)

    TinNhan.objects.update(created_at=timezone.now() - timedelta(hours=2))
    dat(client, _voi("nguoi_b"), {"body": "3"}, status=201)
    assert TinNhan.objects.count() == 3


@pytest.mark.django_db
@override_settings(HAN_MUC_TIN_NHAN_MOI_GIO=2)
def test_A12_han_muc_tinh_theo_NGUOI_GUI_khong_theo_hoi_thoai(
    client, nguoi_a, nguoi_b, nguoi_c
):
    """Mở hội thoại thứ hai không cấp thêm suất — nếu không, spam chỉ cần N người nhận."""
    client.force_login(nguoi_a)
    dat(client, _voi("nguoi_b"), {"body": "1"}, status=201)
    dat(client, _voi("nguoi_c"), {"body": "2"}, status=201)
    assert (
        ma_loi(client, _voi("nguoi_b"), {"body": "3"}, status=429)
        == "qua_han_muc_tin_nhan"
    )


# --- A13 · `no-store` -------------------------------------------------------


@pytest.mark.django_db
def test_A13_moi_cua_deu_no_store(client, nguoi_a, nguoi_b):
    """Cả năm cửa mang `Cache-Control: no-store` — nội dung riêng tư không được vào cache nào.

    Kể cả 201 của lượt gửi: một proxy trung gian lưu lại response đó là lưu lại nguyên văn
    tin nhắn vừa gửi.
    """
    client.force_login(nguoi_a)
    for duong in (HOP_THU, CHUA_DOC, _voi("nguoi_b")):
        r = client.get(duong)
        assert r.status_code == 200, (duong, r.content[:200])
        assert r["Cache-Control"] == "no-store", duong

    r = client.post(
        _voi("nguoi_b"),
        data=json.dumps({"body": "xin chào"}),
        content_type="application/json",
    )
    assert r.status_code == 201 and r["Cache-Control"] == "no-store"

    r = client.post(_voi("nguoi_b") + "/doc", data="{}", content_type="application/json")
    assert r.status_code == 200 and r["Cache-Control"] == "no-store"


# --- A19 · người kia bị vô hiệu hoá -----------------------------------------
#
# Vá của lượt phản biện 2026-09-03. Bản đầu lọc `is_active=True` ở CẢ NĂM cửa, còn hộp thư
# và phép đếm thì không — nên tin của một người vừa bị vô hiệu hoá nằm lại ở trạng thái
# chưa đọc **vĩnh viễn**: phong bì sáng số 3, và không thao tác nào của người nhận tắt được
# nó. Ba bài dưới đây ghim đủ ba nhánh của `_nap_nguoi_kia`.


def _vo_hieu(user) -> None:
    user.is_active = False
    user.save(update_fields=["is_active"])


@pytest.mark.django_db
def test_A19_nguoi_gui_bi_vo_hieu_thi_VAN_doc_duoc_de_tat_chua_doc(
    client, nguoi_a, nguoi_b
):
    """B gửi rồi bị vô hiệu hoá ⇒ A vẫn `GET` được 200 và `POST …/doc` hạ số về 0.

    Đây là bài chặn ca **kẹt vĩnh viễn**. Trước bản vá: `so_chua_doc` báo 3, hộp thư vẫn
    liệt kê dòng ấy kèm chấm 3, mà hai cửa duy nhất dời được vạch đọc đều trả 404.
    """
    for i in range(3):
        _gui(nguoi_b, nguoi_a, f"tin {i}")
    _vo_hieu(nguoi_b)

    client.force_login(nguoi_a)
    assert _chua_doc(client) == 3
    # Hộp thư vẫn liệt kê — đó là hành vi đúng (tin đã nhận không biến mất), và chính nó
    # làm cho việc đọc được PHẢI có đường.
    assert len(lay(client, HOP_THU)["items"]) == 1

    d = lay(client, _voi("nguoi_b"))
    assert d["hoi_thoai_id"] is not None and len(d["items"]) == 3

    assert dat(client, _voi("nguoi_b") + "/doc")["so_chua_doc"] == 0
    assert _chua_doc(client) == 0


@pytest.mark.django_db
def test_A19_nguoi_vo_hieu_CHUA_tung_nhan_tin_van_la_404(client, nguoi_a, nguoi_b):
    """Không có hội thoại thì người vô hiệu vẫn 404 — cửa này không được thành cửa dò.

    Nới nhánh đọc cho MỌI người vô hiệu là biến `GET /me/tin-nhan/{username}` thành cách
    hỏi "tài khoản này có thật và vừa bị vô hiệu hoá không", trên một cửa chỉ cần đăng nhập.
    """
    _vo_hieu(nguoi_b)
    client.force_login(nguoi_a)
    r = client.get(_voi("nguoi_b"))
    assert r.status_code == 404, r.content[:300]
    assert json.loads(r.content)["code"] == "khong_tim_thay"
    # …và mã phải TRÙNG với username không tồn tại, không phân biệt được hai ca.
    assert json.loads(client.get(_voi("khong_co_ai")).content)["code"] == "khong_tim_thay"


@pytest.mark.django_db
def test_A19_khong_ai_GUI_duoc_cho_tai_khoan_vo_hieu(client, nguoi_a, nguoi_b):
    """Cửa GHI giữ nguyên `is_active=True` ⇒ 404, kể cả khi hội thoại đã có sẵn.

    Nhánh đọc được nới ra là để **tắt** một trạng thái cũ, không phải để mở một cuộc trò
    chuyện mới với một tài khoản không còn tồn tại về mặt sản phẩm.
    """
    _gui(nguoi_b, nguoi_a, "trước khi bị vô hiệu")
    _vo_hieu(nguoi_b)

    client.force_login(nguoi_a)
    assert ma_loi(client, _voi("nguoi_b"), {"body": "x"}, status=404) == "khong_tim_thay"
    assert TinNhan.objects.count() == 1


# --- A20 · `chua-doc` là một USERNAME hợp lệ --------------------------------


@pytest.mark.django_db
def test_A20_username_chua_doc_khong_bi_route_dem_nuot(client, nguoi_a):
    """Người dùng tên đúng `chua-doc` phải nhắn tin được như mọi người khác.

    `chua-doc` lọt `UnicodeUsernameValidator` (chữ + gạch nối), nên đường cũ
    `GET /me/tin-nhan/chua-doc` — đăng ký TRƯỚC `{username}` — nuốt trọn họ: `GET` trả
    `{"so_chua_doc": 0}` (sai hình dạng ⇒ client ném `TypeError` rồi hiện một câu lỗi
    không liên quan), `POST` ăn **405 text/plain** phá hợp đồng `{detail, code}` của PLAN
    mục 7. Cửa đếm nay ở `/me/tin-nhan-chua-doc`, ngoài hẳn không gian username.
    """
    dung_user("chua-doc", "Chưa Đọc")
    client.force_login(nguoi_a)

    d = lay(client, _voi("chua-doc"))
    # Khoá của `HoiThoaiChiTietOut`, không phải của `SoChuaDocOut` — đó là cả nội dung bài.
    assert "hoi_thoai_id" in d and "items" in d
    assert "so_chua_doc" not in d

    tin = dat(client, _voi("chua-doc"), {"body": "chào bạn"}, status=201)
    assert tin["body"] == "chào bạn"
    assert TinNhan.objects.count() == 1

    # …và cửa đếm thật vẫn ở chỗ của nó, trả đúng hình dạng của nó.
    assert lay(client, CHUA_DOC) == {"so_chua_doc": 0}
