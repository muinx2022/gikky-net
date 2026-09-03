"""Hai phép dịch dùng chung cho MỌI cửa nhận file ảnh — v1 và khu quản trị.

Tách khỏi `api/anh.py` ngày 2026-09-03, khi khu quản trị mở ba cửa ảnh của riêng nó
(`plans/2026-09-03-sua-bai-khu-quan-tri.md` §2.6). Lý do tách là lý do `api/anh.py` đã
ghi cho chính mình: một bản thứ hai của `if file.size > BYTE_TOI_DA` mọc ở nơi khác rồi
lệch đi — và bản lệch ấy sẽ là bản đọc cả 8MB vào RAM trước khi từ chối.

**Không phép kiểm nào sống ở đây.** Bảy phép kiểm nằm ở `core/anh.py` (1–6) và
`core/ghi.py::them_anh_moc` (7). File này chỉ làm việc của tầng API: hỏi `Content-Length`
trước khi đọc thân, và dịch `LoiAnh` của domain sang mã HTTP.
"""

from ninja.files import UploadedFile

from core.anh import ANH_QUA_NANG, BYTE_TOI_DA, AnhDaXuLy, LoiAnh, xu_ly_anh_tai_len

from api.quyen import LoiGhi


def doi_khong_qua_nang(file: UploadedFile) -> None:
    """Phép kiểm 1 **trước khi `read()`**.

    `xu_ly_anh_tai_len` cũng kiểm byte, nhưng nó chỉ chạy được sau khi ai đó đã đọc cả
    thân request vào RAM/đĩa tạm — tức sau khi thiệt hại đã xảy ra. `file.size` đến từ
    `Content-Length` của phần multipart nên hỏi được ngay, đúng thứ tự mà `core/anh.py`
    đòi. `api/avatar.py` giữ một bản chép tay của cùng phép kiểm — nó là cửa per-user
    tuyệt đối, không dùng gì khác ở đây.
    """
    if file.size is not None and file.size > BYTE_TOI_DA:
        raise LoiGhi(
            413,
            ANH_QUA_NANG,
            f"Ảnh nặng {file.size / 1024 / 1024:.1f}MB, "
            f"tối đa {BYTE_TOI_DA // 1024 // 1024}MB.",
        )


def xu_ly_hoac_loi_http(du_lieu: bytes) -> AnhDaXuLy:
    """Bảy phép kiểm → `AnhDaXuLy`, `LoiAnh` dịch sang mã HTTP. 413 cho nặng, 400 còn lại."""
    try:
        return xu_ly_anh_tai_len(du_lieu)
    except LoiAnh as e:
        raise LoiGhi(413 if e.ma == ANH_QUA_NANG else 400, e.ma, e.detail) from e
