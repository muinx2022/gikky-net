"""Ảnh nhúng thẳng vào thân bài — khối "BỔ SUNG" của `plans/2026-08-24-tiptap-html.md`.

Lớp ghi mỏng đúng một tầng, và nó mỏng có chủ đích: bảy phép kiểm ở `core/anh.py`, file
trên đĩa ở `core/anh_luu.py`, hạn mức ở `core/han_muc.py`. Việc DUY NHẤT của module này
là buộc ba thứ đó lại thành một lượt ghi không để lại rác — cùng ranh giới mà
`core/avatar.py` giữ, và vì đúng lý do ấy: một bản thứ hai của phép kiểm ảnh sẽ là bản
mà đường ghi tương lai đi vòng qua.

**Vì sao không dùng lại `MocAnh`:** ảnh này sinh ra lúc người ta còn đang gõ, tức trước
khi `Moc` tồn tại — mà `MocAnh.moc` là FK `NOT NULL`. Nới nó thành nullable là để bảng
gallery mang hai loài hàng có luật sống khác hẳn nhau (một loài có `position`, có kho
cách ly, đếm vào trần 10 ảnh/mốc; loài kia không), và mọi truy vấn gallery từ đó phải
nhớ lọc. Xem `core/models/moc.py::AnhNoiDung`.
"""

from __future__ import annotations

from core.anh import AnhDaXuLy
from core.anh_luu import duong_dan_chinh, duong_dan_thumb, ghi_anh, kho_hien, khoa_moi
from core.models.moc import AnhNoiDung


def _xoa_file(khoa: str) -> None:
    """Xoá ảnh chính + thumbnail của một khoá khỏi kho đang phục vụ.

    Chỉ quét `kho_hien()`: ảnh nội dung không bao giờ vào kho cách ly (không có đường đi
    ngược từ ảnh về mốc để biết mốc nào bị ẩn — xem docstring `AnhNoiDung`). `delete()`
    của Django không ném khi file đã biến mất, nên hàm này idempotent.
    """
    kho = kho_hien()
    for duong_dan in (duong_dan_chinh(khoa), duong_dan_thumb(khoa)):
        kho.delete(duong_dan)


def luu_anh_noi_dung(*, user, anh: AnhDaXuLy) -> AnhNoiDung:
    """Ghi file + hàng `AnhNoiDung`. Trả hàng vừa tạo.

    Nhận `AnhDaXuLy` (đã qua bảy phép kiểm) chứ không nhận byte thô — cùng ranh giới với
    `core.ghi.them_anh_moc` và `core.avatar.dat_avatar`.

    Thứ tự: ghi file TRƯỚC, tạo hàng SAU, và hàng lỗi thì **dọn lại file**. Ngược lại
    (hàng trước, file sau) để lại một hàng trỏ vào hư không — tức một `<img>` gãy mà
    `don_anh_mo_coi` còn coi là hợp lệ nên không bao giờ báo. Rác không hàng nào trỏ tới
    thì lệnh dọn hứng được; hàng trỏ vào hư không thì không ai hứng.
    """
    khoa = khoa_moi(anh.duoi)
    ghi_anh(khoa, byte_chinh=anh.byte_chinh, byte_thumb=anh.byte_thumb)
    try:
        return AnhNoiDung.objects.create(
            nguoi_tai=user, khoa_luu_tru=khoa, w=anh.w, h=anh.h
        )
    except Exception:
        _xoa_file(khoa)
        raise
