"""Model hạ tầng.

`User` custom được khai NGAY Phase 0 dù chưa cần trường riêng nào: `AUTH_USER_MODEL`
là quyết định KHÔNG đảo ngược được sau khi `migrate` chạy lần đầu (Django tạo
`auth_user` rồi thì đổi sang model khác là ngõ cụt — phải xoá DB hoặc viết migration
tay rất dài). Khai trước, DB còn rỗng, giá bằng 0.

Các trường domain của `User` (`display_name`, `bio`, `banned_until`, `ban_permanent`,
`ban_reason` — PLAN mục 6) thuộc **Phase 1**: thêm trường vào một custom user model đã
tồn tại chỉ là một migration bình thường, nên KHÔNG làm trước ở đây.
"""

from django.contrib.auth.models import AbstractUser


class User(AbstractUser):
    """User của gikky.net. Phase 0 chưa thêm trường nào ngoài `AbstractUser`."""
