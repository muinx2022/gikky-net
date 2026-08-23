"""Lượt vá V2 — phần Django của **L04** (nút ban/khoá thật) và **L33** (`so_ngay`).

## Vì sao phần này phải đo ở đây, không ở trình duyệt

`apps/admin` chạy ở cổng 3001 và bộ `pnpm e2e` chỉ dựng `apps/web` (3000) + Django (8000).
Nên bài đo giao diện của hàng đợi là phân tích tĩnh
(`apps/web/e2e/don-vi/hang-doi-quan-tri.spec.ts`: *"hàng có gọi đúng endpoint không, nhãn
có còn nói dối không"*), còn câu **"gọi endpoint ấy thì kẻ kia có bị chặn THẬT không"**
chỉ trả lời được ở đây, nơi có DB.

Chia thế là có chủ đích và nó phải được nói ra: hai nửa cộng lại mới thành L04. Một nửa
xanh mà nửa kia đỏ nghĩa là hàng đợi vẫn nói dối, chỉ theo một kiểu khác.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from core.models import Mach, User

from tests._quan_tri import dang_nhap, dung_du_lieu, dung_mod, dung_thuong

pytestmark = pytest.mark.django_db


@pytest.fixture
def canh():
    dl = dung_du_lieu()
    return dl, dang_nhap(dung_mod())


def goi(client, duong_dan, than):
    return client.post(duong_dan, than, content_type="application/json")


# --- L33: hạn ban tính ở SERVER ---------------------------------------------


def test_L33_so_ngay_tinh_bang_dong_ho_MAY_CHU(canh):
    """`so_ngay=7` ⇒ `banned_until ≈ now + 7 ngày`, không nhận mốc nào từ client.

    Trước lượt này khu quản trị tự tính `new Date(Date.now() + N*86400e3)` **ở trình
    duyệt** rồi gửi `den_khi` lên. Máy mod lệch giờ, hoặc để sai múi, là hạn ban lệch
    theo — và **không có gì kêu**, vì server nhận một mốc thời gian hoàn toàn hợp lệ.
    """
    _, mod = canh
    dung_thuong("nan_nhan")
    truoc = timezone.now()
    r = goi(mod, "/api/admin/users/nan_nhan/ban", {"ly_do": "spam", "so_ngay": 7})
    assert r.status_code == 200, r.content
    assert r.json() == {"da_doi": True, "dang_bat": True}

    u = User.objects.get(username="nan_nhan")
    assert u.ban_permanent is False
    assert u.banned_until is not None
    # Cửa sổ rộng một phút: bài đo không được đỏ vì máy chậm, nhưng cũng không được rộng
    # tới mức một lỗi "cộng nhầm đơn vị" (giờ thay vì ngày) đi lọt.
    assert truoc + timedelta(days=7) - timedelta(minutes=1) <= u.banned_until
    assert u.banned_until <= timezone.now() + timedelta(days=7) + timedelta(minutes=1)


def test_L33_ban_so_ngay_CHAN_THAT_cua_ghi(canh):
    """Vế quan trọng nhất của L04: ban **thi hành**, không chỉ ghi vào sổ.

    `hanh_dong` của `POST /reports/{id}/dong` chỉ GHI LẠI. Nếu `POST /users/{u}/ban` cũng
    chỉ ghi thì cả hàng đợi là một màn kịch. Ở đây đo bằng thứ người bị ban thật sự gặp:
    cửa GHI trả **403**.
    """
    dl, mod = canh
    nan_nhan = dl["tac_gia"]
    khach = dang_nhap(nan_nhan)

    # Trước khi ban: viết được (201).
    truoc = khach.post(
        f"/api/v1/machs/{dl['mach'].pk}/comments",
        {"body": "câu trước khi bị ban"},
        content_type="application/json",
    )
    assert truoc.status_code == 201, truoc.content

    r = goi(
        mod, f"/api/admin/users/{nan_nhan.username}/ban", {"ly_do": "spam", "so_ngay": 3}
    )
    assert r.status_code == 200, r.content

    sau = khach.post(
        f"/api/v1/machs/{dl['mach'].pk}/comments",
        {"body": "câu sau khi bị ban"},
        content_type="application/json",
    )
    assert sau.status_code == 403, sau.content


@pytest.mark.parametrize(
    "than",
    [
        {"ly_do": "x", "so_ngay": 7, "vinh_vien": True},
        {"ly_do": "x", "so_ngay": 7, "den_khi": "2099-01-01T00:00:00+07:00"},
        {"ly_do": "x", "so_ngay": 0},
        {"ly_do": "x", "so_ngay": -3},
    ],
    ids=["so_ngay+vinh_vien", "so_ngay+den_khi", "khong-ngay", "am"],
)
def test_L33_khai_han_sai_tra_400_va_KHONG_ban_ai(canh, than):
    """Ba cách khai hạn loại trừ nhau — và phép đếm phải đếm cả BA.

    Nếu chỉ để `core.ghi.ban_user` xử cặp `vinh_vien`/`den_khi` cũ thì
    `{so_ngay: 7, vinh_vien: true}` đi lọt: `so_ngay` bị bỏ qua **im lặng** và mod tin là
    mình vừa ban 7 ngày trong khi kẻ kia bị ban vĩnh viễn.
    """
    _, mod = canh
    dung_thuong("nan_nhan")
    r = goi(mod, "/api/admin/users/nan_nhan/ban", than)
    assert r.status_code == 400, r.content
    assert r.json()["code"] == "tham_so_khong_hop_le"
    assert User.objects.get(username="nan_nhan").dang_bi_ban() is False


def test_L33_hai_cach_khai_han_CU_van_chay(canh):
    """Không phá hợp đồng đang có: `vinh_vien` và `den_khi` vẫn dùng được như trước."""
    _, mod = canh
    dung_thuong("a1")
    dung_thuong("a2")
    assert goi(
        mod, "/api/admin/users/a1/ban", {"ly_do": "x", "vinh_vien": True}
    ).status_code == 200
    assert goi(
        mod,
        "/api/admin/users/a2/ban",
        {"ly_do": "x", "den_khi": "2099-01-01T00:00:00+07:00"},
    ).status_code == 200
    assert User.objects.get(username="a1").ban_permanent is True
    assert User.objects.get(username="a2").banned_until is not None


# --- L04: hàng đợi phải THẤY được trạng thái để nút bật/tắt đúng chiều -------


def _hang_dau(mod) -> dict:
    r = mod.get("/api/admin/reports?trang_thai=tat_ca&limit=50")
    assert r.status_code == 200, r.content
    items = r.json()["items"]
    assert items, "hàng đợi rỗng — bài đo sẽ rỗng theo"
    return items[0]


def test_L04_hang_bao_cao_mang_trang_thai_khoa_va_ban(canh):
    """Nút bật/tắt không biết chiều là nút mà nửa số lần bấm không đổi gì trên màn hình.

    Hai trường này thêm vào `NoiDungBiBaoCaoOut` cùng lượt vá — chúng **không** phải dữ
    liệu per-user (ai là mod cũng thấy cùng con số), nên chúng không phạm luật nào của
    cửa quản trị.
    """
    dl, mod = canh
    # `dung_du_lieu` đã tạo sẵn một báo cáo nhắm vào bình luận của `tac_gia` trong `mach`.
    hang = _hang_dau(mod)
    assert hang["dich"]["mach_da_khoa"] is False
    assert hang["dich"]["tac_gia_bi_ban"] is False

    # Khoá mạch qua đúng endpoint mà hàng đợi gọi ⇒ hàng phải phản ánh ngay.
    r = goi(
        mod,
        f"/api/admin/machs/{dl['mach'].pk}/khoa",
        {"khoa": True, "ly_do": "Báo cáo #1: spam"},
    )
    assert r.status_code == 200, r.content
    assert Mach.objects.get(pk=dl["mach"].pk).locked_at is not None

    r = goi(
        mod,
        f"/api/admin/users/{dl['tac_gia'].username}/ban",
        {"ly_do": "spam", "so_ngay": 7},
    )
    assert r.status_code == 200, r.content

    hang = _hang_dau(mod)
    assert hang["dich"]["mach_da_khoa"] is True
    assert hang["dich"]["tac_gia_bi_ban"] is True


def test_L04_dong_bao_cao_van_KHONG_thi_hanh_gi(canh):
    """Ghim lại **chính cái sự thật gây ra L04**, để bản vá không lặng lẽ đổi nó.

    Cách chữa L04 là thêm nút thật + đổi nhãn, **không** phải làm cho `hanh_dong` tự thi
    hành. Gộp hai việc là dựng một đường ghi thứ hai tới `hidden_at`/`ban_permanent` nằm
    ngoài `core/ghi.py` — xem docstring `core/ghi.py::dong_bao_cao`. Nếu ai đó "sửa L04"
    bằng cách cho `hanh_dong="ban"` ban thật, bài này ĐỎ và họ phải đọc lại lý do.
    """
    dl, mod = canh
    r = goi(mod, f"/api/admin/reports/{dl['report'].pk}/dong", {"hanh_dong": "ban"})
    assert r.status_code == 200, r.content
    assert r.json()["dang_bat"] is True  # báo cáo đã đóng

    dl["tac_gia"].refresh_from_db()
    assert dl["tac_gia"].dang_bi_ban() is False, (
        "`hanh_dong` chỉ GHI LẠI — nếu nó bắt đầu thi hành thì nhãn 'Ghi: đã ban' ở "
        "khu quản trị lại thành câu nói dối, chỉ theo chiều ngược lại"
    )
    assert Mach.objects.get(pk=dl["mach"].pk).locked_at is None
