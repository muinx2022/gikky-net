"""Ảnh đại diện của người dùng — "khu người dùng" (2026-08-24).

Tái dùng TRỌN hạ tầng ảnh của Phase 5: `core/anh.py` kiểm + tái mã hoá bảy phép kiểm,
`core/anh_luu.py` ghi/đọc/xoá file. Avatar **không có bảng riêng** — nó là một cột khoá
trên `User` (`avatar_khoa`), y như mốc lưu `MocAnh.khoa_luu_tru`. Phục vụ bằng
**thumbnail** (480px, CSS bo vuông), không phải ảnh chính.

Ba khác biệt với ảnh mốc, và cả ba là bản chất của avatar chứ không phải lựa chọn:

1. **Không có kho cách ly.** Avatar không qua kiểm duyệt ảnh của mod (không có bia mộ,
   không có `da_cach_ly`), nên nó chỉ sống ở `kho_hien()`. Gỡ avatar là XOÁ THẬT file
   ngay, không phải chuyển kho.
2. **Một avatar cho mỗi người**: đặt cái mới là XOÁ cái cũ trong cùng lời gọi. Không có
   `position`, không có gallery.
3. **Dùng CHUNG thư mục đĩa với ảnh mốc** (`ghi_anh` ghi vào `anh/` + `anh-thumb/`), nên
   `don_anh_mo_coi` phải coi `User.avatar_khoa` là khoá hợp lệ — nếu không nó xoá mọi
   avatar sau 24 giờ vì không hàng `MocAnh` nào trỏ tới. Whitelist ấy nằm ở chính lệnh dọn.
"""

from __future__ import annotations

from core.anh import AnhDaXuLy
from core.anh_luu import (
    duong_dan_chinh,
    duong_dan_thumb,
    ghi_anh,
    kho_hien,
    khoa_moi,
)
from core.models.nguoi_dung import User


def _xoa_file(khoa: str) -> None:
    """Xoá ảnh chính + thumbnail của một khoá avatar khỏi kho đang phục vụ.

    Avatar không bao giờ vào kho cách ly (không kiểm duyệt ảnh đại diện), nên chỉ quét
    `kho_hien()` — khác `core.anh_luu.xoa_anh_that` vốn phải quét cả hai kho vì ảnh mốc
    bị mod ẩn nằm ở kho cách ly. `delete()` của Django idempotent: không ném khi file đã
    biến mất, nên gọi lại vô hại.
    """
    kho = kho_hien()
    for duong_dan in (duong_dan_chinh(khoa), duong_dan_thumb(khoa)):
        kho.delete(duong_dan)


def dat_avatar(*, user: User, anh: AnhDaXuLy) -> str:
    """Ghi avatar mới, trỏ `User.avatar_khoa` sang nó, XOÁ avatar cũ. Trả khoá mới.

    Nhận `AnhDaXuLy` (đã qua bảy phép kiểm) chứ không nhận byte thô — cùng ranh giới với
    `core.ghi.them_anh_moc`: hàm này không được là chỗ thứ hai biết cách kiểm ảnh.

    Thứ tự có chủ đích: ghi file mới TRƯỚC, cập nhật cột SAU, xoá file cũ CUỐI. Nếu bước
    cập nhật cột ném thì file mới vừa ghi được dọn lại — không để lại rác không cột nào
    trỏ tới. Xoá file cũ đặt cuối cùng để một lỗi xoá (đĩa hỏng) không chặn việc đổi
    avatar; file cũ khi đó thành mồ côi và `don_anh_mo_coi` là cái lưới hứng nó.

    `update()` trên queryset lọc theo `pk` chứ không `save()` trên object phiên: cùng lý
    do `api/toi.py::sua_toi` nêu — `request.user` mang cả những cột khác nạp từ đầu
    request, và `save()` trần ghi đè chúng bằng giá trị cũ.
    """
    khoa_cu = user.avatar_khoa
    khoa = khoa_moi(anh.duoi)
    ghi_anh(khoa, byte_chinh=anh.byte_chinh, byte_thumb=anh.byte_thumb)
    try:
        User.objects.filter(pk=user.pk).update(avatar_khoa=khoa)
    except Exception:
        _xoa_file(khoa)
        raise
    user.avatar_khoa = khoa
    if khoa_cu and khoa_cu != khoa:
        _xoa_file(khoa_cu)
    return khoa


def xoa_avatar(*, user: User) -> bool:
    """Gỡ avatar: rỗng cột rồi xoá file. `False` khi vốn không có avatar (no-op).

    Idempotent — gọi trên người chưa có avatar không ném và không đổi gì. Rỗng cột trước
    khi xoá file để trạng thái DB không bao giờ trỏ vào một file đã biến mất; nếu xoá file
    lỗi thì file thành mồ côi (lưới `don_anh_mo_coi`), không phải một cột trỏ vào hư không.
    """
    khoa_cu = user.avatar_khoa
    if not khoa_cu:
        return False
    User.objects.filter(pk=user.pk).update(avatar_khoa="")
    user.avatar_khoa = ""
    _xoa_file(khoa_cu)
    return True
