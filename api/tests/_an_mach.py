"""Lối tắt "mod đã ẩn mạch này" cho bài đo — **một chỗ**, vì từ 2026-09-03 nó có ràng buộc.

Trước lượt hẹn giờ, mọi bài đo ẩn mạch bằng một dòng `Mach.objects.filter(...)
.update(hidden_at=timezone.now())`. Dòng ấy nay **vi phạm `CheckConstraint`**
`mach_an_phai_co_nguoi_an_hoac_hen_gio`: một mạch ẩn mà `hidden_by IS NULL` được cả hệ
thống hiểu là *bài hẹn giờ chưa tới hạn*, và `manage.py phat_hanh_da_hen` sẽ gỡ ẩn nó hộ.

Vì thế lối tắt phải kèm `hidden_by`. Ai là người ẩn thì **không quan trọng với những bài
đo dùng hàm này** — chúng đo "nội dung mang `hidden_at` có lọt ra cửa công khai không",
không đo nhật ký kiểm duyệt — nên lấy luôn tác giả của chính mạch: nó luôn tồn tại, không
phải dựng thêm một `User` mod cho mỗi bài đo.

⚠ **Vẫn cố ý KHÔNG gọi `core/ghi.py::dat_an_mach`.** Đường ghi thật kéo theo `AuditLog`,
`dong_bo_kho_anh` cho mọi mốc và `dong_bo_mach` — ba thứ mà những bài đo này không đo, và
một trong ba (`dong_bo_kho_anh`) chạm đĩa. Bài đo nào cần cả chuỗi ấy thì gọi thẳng
`dat_an_mach`; xem `tests/test_api_mod.py`.
"""

from django.db.models import F
from django.utils import timezone


def an_mach_tho(qs, khi=None):
    """Đặt cờ ẩn của mod THẲNG vào DB cho mọi mạch trong `qs`. Trả số hàng đã đổi.

    `hidden_by = author` bằng `F("author_id")` — MỘT câu `UPDATE` cho cả queryset, không
    cần biết trước có bao nhiêu hàng hay tác giả là ai.
    """
    return qs.update(hidden_at=khi or timezone.now(), hidden_by_id=F("author_id"))
