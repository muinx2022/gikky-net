"""Django admin — cửa hậu vận hành (PLAN 9.3).

Chỉ đăng ký `User` với `UserAdmin` mặc định: custom user model mà không đăng ký thì
Django admin mất luôn màn quản lý user, và form đổi mật khẩu/permission phải viết tay.
Khu admin THẬT của sản phẩm là app Next + router Ninja `/api/admin` (Phase 4).
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from core.models import User

admin.site.register(User, UserAdmin)
