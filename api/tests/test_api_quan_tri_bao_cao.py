"""Hàng đợi báo cáo — PLAN 5.10, 9.3 mục 1.

Ba thứ được đo, và thứ tự này là thứ tự quan trọng:

1. **Ngữ cảnh đúng đích.** `Report.target_id` không phải FK, nên "mốc #5" và "bình luận
   #5" là hai hàng khác nhau mang cùng một số. Tra bằng mình `id` là hàng đợi hiện nội
   dung của nhầm bảng — một lỗi trông như dữ liệu bẩn chứ không như lỗi code.
2. **Số truy vấn HẰNG.** Một vòng `for` gọi `.get()` cho từng dòng là 20 round-trip cho
   một màn hình mod bấm F5 liên tục; `django_assert_num_queries` là chỗ ghim.
3. **Đóng báo cáo không tự thi hành gì.** `action` là ghi chép, không phải lệnh.
"""

import pytest

from core.ghi import tao_binh_luan, them_moc
from core.models import Report

from tests._quan_tri import (
    NOI_DUNG_BINH_LUAN,
    dang_nhap,
    dung_du_lieu,
    dung_mod,
    goi,
)


@pytest.fixture
def canh(db):
    """Ba báo cáo, mỗi loại đích một cái — đủ để chạm cả ba nhánh của `_nap_ngu_canh`."""
    dl = dung_du_lieu()
    dl["moc2"] = them_moc(mach=dl["mach"], author=dl["tac_gia"], body="Mốc 2.")
    dl["bl2"] = tao_binh_luan(
        mach=dl["mach"], author=dl["tac_gia"], body="Bình luận 2.", anchor_moc_seq=1
    )
    dl["report_mach"] = Report.objects.create(
        reporter=dl["tac_gia"],
        target_type=Report.Dich.MACH,
        target_id=dl["mach"].pk,
        ly_do=Report.LyDo.PHIM_HANG,
    )
    dl["report_moc"] = Report.objects.create(
        reporter=dl["tac_gia"],
        target_type=Report.Dich.MOC,
        target_id=dl["moc2"].pk,
        ly_do=Report.LyDo.LUA_DAO,
    )
    return dl, dang_nhap(dung_mod())


def _hang(mod, truy_van: str = ""):
    r = mod.get(f"/api/admin/reports{truy_van}")
    assert r.status_code == 200, r.content
    return {d["id"]: d for d in r.json()["items"]}


def test_ngu_canh_tra_dung_bang_chu_khong_dung_mot_minh_id(canh):
    """Ba loại đích, ba ngữ cảnh khác nhau — khoá tra phải là cặp `(loai, id)`.

    Bài đo có sức nặng vì `Moc#N` và `Comment#N` cùng tồn tại trong dữ liệu nền: tra bằng
    mình `id` sẽ ghép nhầm và `loai` vẫn "đúng" (nó chép từ `Report`), nên chỉ nội dung mới
    tố cáo được lỗi.
    """
    dl, mod = canh
    hang = _hang(mod)

    dich_bl = hang[dl["report"].pk]["dich"]
    assert dich_bl["loai"] == "comment"
    assert dich_bl["id"] == dl["binh_luan"].pk
    assert NOI_DUNG_BINH_LUAN in dich_bl["trich_yeu"]
    assert dich_bl["mach_id"] == dl["mach"].pk

    dich_moc = hang[dl["report_moc"].pk]["dich"]
    assert (dich_moc["loai"], dich_moc["id"], dich_moc["seq"]) == (
        "moc",
        dl["moc2"].pk,
        2,
    )
    assert "Mốc 2." in dich_moc["trich_yeu"]

    dich_mach = hang[dl["report_mach"].pk]["dich"]
    assert dich_mach["loai"] == "mach"
    assert dich_mach["mach_id"] is None
    assert dich_mach["duong_dan_cong_khai"].endswith(f"-{dl['mach'].pk}")


def _them_bao_cao(dl, so_luong: int, tien_to: str) -> list[Report]:
    """`so_luong` báo cáo vào CÙNG một bình luận, mỗi cái từ một NGƯỜI KHÁC NHAU.

    ⚠ Phải khác người, không lặp một `reporter` (đổi ở lượt vá V1, L03). Từ lượt ấy DB có
    unique **partial** `bao_cao_mot_lan_moi_dich_dang_mo` — một người chỉ tố một đích một
    lần chừng nào báo cáo cũ còn đang mở. Bản cũ của hai bài dưới dựng 5–8 hàng từ cùng
    một `tac_gia`, tức một hình dạng dữ liệu **không tồn tại được nữa**; đo phân trang và
    số truy vấn trên nó là đo trên nền không có thật.

    N người cùng tố một bình luận cũng là hình dạng thật hơn hẳn: đó chính là ca hàng đợi
    kiểm duyệt sinh ra để xử.
    """
    from core.models import User

    return [
        Report.objects.create(
            reporter=User.objects.create(username=f"{tien_to}_{i}"),
            target_type=Report.Dich.COMMENT,
            target_id=dl["bl2"].pk,
            ly_do=Report.LyDo.SPAM,
            ghi_chu=f"{tien_to} {i}",
        )
        for i in range(so_luong)
    ]


def test_so_truy_van_khong_tang_theo_so_dong(canh):
    """Ghim số truy vấn: thêm báo cáo mà số này nhích lên là `_nap_ngu_canh` thành N+1.

    Đo hai lần trên hai kích thước rồi đòi **bằng nhau**, thay vì ghim một hằng số. Một
    con số viết cứng đỏ vì mọi lý do (thêm một `select_related` là đổi); phép so hai lượt
    chỉ đỏ đúng khi số truy vấn phụ thuộc số dòng — tức đúng cái N+1 cần chặn.
    """
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    dl, mod = canh
    with CaptureQueriesContext(connection) as it:
        _hang(mod)
    so_it = len(it.captured_queries)

    _them_bao_cao(dl, 8, "nguoi_to")
    with CaptureQueriesContext(connection) as nhieu:
        assert len(_hang(mod)) == 11
    assert len(nhieu.captured_queries) == so_it


def test_bo_loc_trang_thai_chia_dung_hai_nhom(canh):
    """`cho_xu_ly` là mặc định; `da_xu_ly` và `tat_ca` để tra lại quyết định cũ."""
    dl, mod = canh
    assert len(_hang(mod)) == 3

    r = goi(
        mod, "post", f"/api/admin/reports/{dl['report'].pk}/dong", {"hanh_dong": "an"}
    )
    assert r.json() == {"da_doi": True, "dang_bat": True}

    assert dl["report"].pk not in _hang(mod)
    assert set(_hang(mod, "?trang_thai=da_xu_ly")) == {dl["report"].pk}
    assert len(_hang(mod, "?trang_thai=tat_ca")) == 3

    da_dong = _hang(mod, "?trang_thai=da_xu_ly")[dl["report"].pk]
    assert da_dong["action"] == "an"
    assert da_dong["resolved_by"]["username"] == "mod_chinh"


def test_dong_bao_cao_KHONG_tu_an_noi_dung(canh):
    """`hanh_dong="an"` chỉ GHI LẠI. Ẩn là một lời gọi riêng.

    Bài đo giữ cho không ai "tiện tay" gộp hai việc: gộp là dựng một đường ghi thứ hai tới
    `hidden_at` nằm ngoài `core/ghi.py::dat_an_*`.
    """
    dl, mod = canh
    goi(mod, "post", f"/api/admin/reports/{dl['report'].pk}/dong", {"hanh_dong": "an"})
    dl["binh_luan"].refresh_from_db()
    assert dl["binh_luan"].hidden_at is None


def test_dong_lan_hai_khong_ghi_de_quyet_dinh_cu(canh):
    """Idempotent: báo cáo đã đóng giữ nguyên `resolved_by`/`action` của lần đầu.

    Ghi đè là xoá mất ai đã phán xử — đúng thứ nhật ký sinh ra để giữ.
    """
    dl, mod = canh
    url = f"/api/admin/reports/{dl['report'].pk}/dong"
    goi(mod, "post", url, {"hanh_dong": "an"})
    mod2 = dang_nhap(dung_mod("mod_phu"))
    r = goi(mod2, "post", url, {"hanh_dong": "bo_qua"})
    assert r.json() == {"da_doi": False, "dang_bat": True}

    dl["report"].refresh_from_db()
    assert dl["report"].action == "an"
    assert dl["report"].resolved_by.username == "mod_chinh"


def test_tham_so_la_tra_400_dung_hinh_dang(canh):
    """`trang_thai` lạ và `limit` ngoài khoảng đều là 400 `{detail, code}`."""
    _, mod = canh
    for truy_van in ("?trang_thai=khong-co", "?limit=0", "?limit=999", "?cursor=rac"):
        r = mod.get(f"/api/admin/reports{truy_van}")
        assert r.status_code == 400, f"{truy_van} → {r.status_code}"
        assert set(r.json()) == {"detail", "code"}


def test_phan_trang_keyset_khong_trung_khong_sot(canh):
    """Cursor `(created_at, id)` — khoá bất biến, nên bảo đảm "không trùng, không sót" áp."""
    dl, mod = canh
    _them_bao_cao(dl, 5, "nguoi_them")
    tat_ca = set()
    cursor = None
    for _ in range(10):
        truy_van = "?limit=3" + (f"&cursor={cursor}" if cursor else "")
        than = mod.get(f"/api/admin/reports{truy_van}").json()
        moi = {d["id"] for d in than["items"]}
        assert not (moi & tat_ca), "cursor trả lại hàng đã trả"
        tat_ca |= moi
        cursor = than["cursor_ke_tiep"]
        if cursor is None:
            break
    assert tat_ca == set(Report.objects.values_list("pk", flat=True))
