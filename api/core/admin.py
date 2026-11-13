"""Django admin — cửa hậu vận hành (PLAN 9.3).

Chỉ đăng ký `User` với `UserAdmin` mặc định: custom user model mà không đăng ký thì
Django admin mất luôn màn quản lý user, và form đổi mật khẩu/permission phải viết tay.
Khu admin THẬT của sản phẩm là app Next + router Ninja `/api/admin` (Phase 4).

Ngoại lệ có chủ đích: `BanTin` (việc 20, `plans/2026-11-13-ban-tin-bang-rieng.md` §3.1).
Mod ẩn một bản tin sai bằng cách đặt `hidden_at` ở đây; plan chốt KHÔNG làm giao diện ở
`apps/admin` cho việc này.
"""

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from core.models import BanTin, BanTinKhung, User

admin.site.register(User, UserAdmin)


class BanTinKhungInline(admin.StackedInline):
    model = BanTinKhung
    extra = 0
    readonly_fields = ("created_at",)


@admin.register(BanTin)
class BanTinAdmin(admin.ModelAdmin):
    list_display = ("ngay", "title", "hidden_at", "view_count", "cap_nhat_luc")
    list_filter = ("hidden_at",)
    search_fields = ("title",)
    readonly_fields = ("created_at", "cap_nhat_luc", "view_count", "mach_cu")
    raw_id_fields = ("tac_gia",)
    inlines = [BanTinKhungInline]
