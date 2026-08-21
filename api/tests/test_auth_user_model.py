"""`AUTH_USER_MODEL` phải là `core.User` — quyết định KHÔNG đảo ngược được.

Đổi `AUTH_USER_MODEL` sau khi `migrate` chạy lần đầu là ngõ cụt Django (phải xoá DB
hoặc viết migration tay rất dài). Test này ghim quyết định đó lại: ai gỡ dòng
`AUTH_USER_MODEL` trong settings sẽ thấy đỏ ngay, chứ không phải phát hiện ở Phase 1
lúc DB đã có dữ liệu thật.
"""

from django.conf import settings
from django.contrib.auth import get_user_model

from core.models import User


def test_settings_tro_dung_core_user():
    assert settings.AUTH_USER_MODEL == "core.User"


def test_get_user_model_la_core_user():
    """Không chỉ đọc settings — hỏi đúng cái Django thực sự dùng."""
    assert get_user_model() is User


def test_bang_user_la_core_user_khong_phai_auth_user():
    """Chốt cả tên BẢNG: `auth_user` xuất hiện lại nghĩa là đã rơi về user mặc định."""
    assert get_user_model()._meta.db_table == "core_user"
