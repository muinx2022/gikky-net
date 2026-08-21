"""`User` — PLAN mục 6.

`AUTH_USER_MODEL = "core.User"` chốt từ Phase 0 (đổi sau lần `migrate` đầu là ngõ cụt).
Phase 1a thêm các trường domain: hồ sơ (`display_name`, `bio`) và trạng thái ban
(`banned_until`, `ban_permanent`, `ban_reason` — PLAN 5.10, tính năng dùng ở Phase 4,
cột dựng sẵn từ giờ).
"""

from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxLengthValidator
from django.db import models


class User(AbstractUser):
    """User của gikky.net.

    **Xoá user (GDPR-lite, PLAN mục 6):** nội dung được GIỮ, tác giả hiển thị
    "[tài khoản đã xoá]". Cách hiện thực đã chọn là **ẩn danh hoá hàng `User`**
    (đổi `username`/`display_name`, `is_active=False`), KHÔNG phải `DELETE`. Vì vậy
    mọi FK trỏ tới tác giả nội dung dùng `on_delete=PROTECT`: một lệnh xoá lỡ tay ở
    Django admin sẽ báo lỗi thay vì nuốt mất mạch/mốc/bình luận. Xem thêm docstring
    `dien_dan.Mach`.
    """

    #: Tên hiển thị; rỗng thì UI rơi về `username`. Không unique — chỉ `username` là định danh.
    display_name = models.CharField(max_length=60, blank=True)
    bio = models.TextField(blank=True, validators=[MaxLengthValidator(500)])

    # --- Ban (PLAN 5.10 · Phase 4 dùng) -------------------------------------
    #: Ban tạm: hết hạn thì tự hết. Ban vĩnh viễn dùng cờ riêng để không phải
    #: nhét một mốc thời gian giả kiểu năm 9999 vào DB.
    banned_until = models.DateTimeField(null=True, blank=True)
    ban_permanent = models.BooleanField(default=False)
    ban_reason = models.CharField(max_length=200, null=True, blank=True)

    def __str__(self) -> str:
        return self.username
