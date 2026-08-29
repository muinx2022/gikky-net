from django.apps import AppConfig


class CoreConfig(AppConfig):
    """App hạ tầng: management command, và (từ Phase 1) models domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        """Nạp hai module chỉ tồn tại vì tác dụng phụ lúc import.

        `django.core.checks` chỉ biết những phép kiểm đã được **import**; `Signal.connect`
        cũng vậy. Một module chứa `@register()` hoặc `@receiver()` mà không ai import là
        một hàng rào không tồn tại — và nó không tồn tại **im lặng**. `ready()` là chỗ duy
        nhất Django bảo đảm chạy đúng một lần cho mọi tiến trình.

        - `kiem_trien_khai` — các `@register()` của `django.core.checks`;
        - `phien` — receiver `user_logged_in` đặt hạn phiên theo header `X-Ghi-Nho`.
        """
        from core import kiem_trien_khai  # noqa: F401 - import LÀ mục đích
        from core import phien  # noqa: F401 - import LÀ mục đích
