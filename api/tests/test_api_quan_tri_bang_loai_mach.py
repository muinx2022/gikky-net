"""`GET /api/admin/machs?loai_mach=` + trường `loai_mach` của hàng bảng *(homepage v2, vòng sửa 3)*.

Lý do tồn tại: form đăng bài của khu quản trị phải biết "đang có chủ đề nào ĐANG MỞ không"
trước khi tạo chủ đề thứ hai (cảnh báo, không chặn). Cần hai thứ mà bảng mạch chưa có: lọc
theo `loai_mach` và trả `loai_mach` trong từng hàng. Cả hai **additive** — không tham số thì
bảng trả y như cũ (mọi loại).

Bài đo trọng yếu là cái cuối: **"đang mở" của khu quản trị là nhóm `mo`** — loại ẩn, khoá và
bài chờ giờ hẹn. Cảnh báo dựa vào đó; nếu `mo` lại gồm bài ẩn / chờ hẹn thì mọi chủ đề hẹn
giờ sẽ gây cảnh báo giả.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from core.ghi import dat_an_mach, dat_khoa_mach, dat_luu_tru_mach, dong_so, tao_mach
from core.models import Sub, User

from tests._quan_tri import dang_nhap, dung_mod

pytestmark = pytest.mark.django_db


@pytest.fixture
def canh(db):
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    tac_gia = User.objects.create(username="chu_mach", display_name="Chủ Mạch")
    mod_user = dung_mod()
    return {
        "sub": sub,
        "tac_gia": tac_gia,
        "mod_user": mod_user,
        "mod": dang_nhap(mod_user),
    }


def _mach(canh, title, loai_mach, **kw):
    mach, _ = tao_mach(
        sub=canh["sub"],
        author=canh["tac_gia"],
        title=title,
        body="thân bài gốc",
        loai_mach=loai_mach,
        **kw,
    )
    return mach


def _title(canh, qs):
    r = canh["mod"].get(qs)
    assert r.status_code == 200, r.content
    return {m["title"] for m in r.json()["items"]}


@pytest.fixture
def ba_loai(canh):
    _mach(canh, "Nhật ký A", "nhat_ky")
    _mach(canh, "Bài viết B", "bai_viet")
    _mach(canh, "Chủ đề C", "thao_luan")
    return canh


def test_loc_loai_mach_dung_tung_loai(ba_loai):
    assert _title(ba_loai, "/api/admin/machs?loai_mach=nhat_ky") == {"Nhật ký A"}
    assert _title(ba_loai, "/api/admin/machs?loai_mach=bai_viet") == {"Bài viết B"}
    assert _title(ba_loai, "/api/admin/machs?loai_mach=thao_luan") == {"Chủ đề C"}


def test_khong_tham_so_van_tra_moi_loai_nhu_cu(ba_loai):
    """Additive: bỏ `loai_mach` ⇒ bảng như trước, không loại nào bị lọc mất."""
    assert _title(ba_loai, "/api/admin/machs") == {"Nhật ký A", "Bài viết B", "Chủ đề C"}
    r = ba_loai["mod"].get("/api/admin/machs")
    assert r.json()["tong"] == 3


def test_loai_mach_la_tra_400_tham_so_khong_hop_le(ba_loai):
    for gia_tri in ("abc", "THAO_LUAN", "thao-luan", ""):
        r = ba_loai["mod"].get("/api/admin/machs", {"loai_mach": gia_tri})
        assert r.status_code == 400, (gia_tri, r.status_code)
        assert r.json()["code"] == "tham_so_khong_hop_le", gia_tri


def test_hang_co_truong_loai_mach(ba_loai):
    items = ba_loai["mod"].get("/api/admin/machs").json()["items"]
    theo_title = {m["title"]: m["loai_mach"] for m in items}
    assert theo_title == {
        "Nhật ký A": "nhat_ky",
        "Bài viết B": "bai_viet",
        "Chủ đề C": "thao_luan",
    }


def test_loc_loai_mach_ket_hop_trang_thai_mo_dung_nghia_dang_mo(canh):
    """`thao_luan` + `mo` = chủ đề thật sự đang mở: loại ẩn, khoá, đã đóng và CHỜ GIỜ HẸN."""
    mod_user = canh["mod_user"]
    _mach(canh, "Đang mở", "thao_luan")

    bi_an = _mach(canh, "Bị ẩn", "thao_luan")
    dat_an_mach(mach=bi_an, boi=mod_user, an=True)

    bi_khoa = _mach(canh, "Bị khoá", "thao_luan")
    dat_khoa_mach(mach=bi_khoa, boi=mod_user, khoa=True)

    da_dong = _mach(canh, "Đã đóng", "thao_luan")
    dong_so(mach=da_dong)

    # Chờ giờ hẹn = ẩn không có `hidden_by` (xem `quan_tri_loc.LOC_HEN_GIO`).
    cho_hen = _mach(
        canh, "Chờ hẹn giờ", "thao_luan", published_at=timezone.now() + timedelta(days=1)
    )
    assert cho_hen.hidden_at is not None and cho_hen.hidden_by_id is None

    # Một loại khác đang mở không được lọt vào.
    _mach(canh, "Nhật ký đang mở", "nhat_ky")

    assert _title(canh, "/api/admin/machs?loai_mach=thao_luan&trang_thai=mo") == {"Đang mở"}
    # Không có `trang_thai` thì thấy cả năm chủ đề (nhật ký đã bị loại bởi `loai_mach`).
    assert _title(canh, "/api/admin/machs?loai_mach=thao_luan") == {
        "Đang mở",
        "Bị ẩn",
        "Bị khoá",
        "Đã đóng",
        "Chờ hẹn giờ",
    }
    # `trang_thai=mo` một mình (không loại) vẫn gồm nhật ký đang mở ⇒ bộ lọc loại thật sự cắt.
    assert _title(canh, "/api/admin/machs?trang_thai=mo") == {"Đang mở", "Nhật ký đang mở"}


def test_nhom_mo_khong_loai_mach_luu_tru_nhung_hang_mang_co_da_luu_tru(canh):
    """Ghim lý do admin phải tự lọc `da_luu_tru`: nhóm `mo` KHÔNG loại bài đã lưu trữ
    (trục `archived_at` riêng), trong khi feed công khai thì loại. Hàng phải mang cờ."""
    mach = _mach(canh, "Chủ đề đã lưu trữ", "thao_luan")
    dat_luu_tru_mach(mach=mach, boi=canh["mod_user"], luu_tru=True)
    items = canh["mod"].get("/api/admin/machs?loai_mach=thao_luan&trang_thai=mo").json()["items"]
    assert [(m["title"], m["da_luu_tru"], m["loai_mach"]) for m in items] == [
        ("Chủ đề đã lưu trữ", True, "thao_luan")
    ]


def test_loc_loai_mach_van_can_quyen_mod(canh):
    """Tham số mới không mở cửa: người thường vẫn 403, chưa đăng nhập vẫn 401."""
    from django.test import Client

    from tests._quan_tri import dung_thuong

    assert Client().get("/api/admin/machs?loai_mach=thao_luan").status_code == 401
    thuong = dang_nhap(dung_thuong())
    assert thuong.get("/api/admin/machs?loai_mach=thao_luan").status_code == 403
