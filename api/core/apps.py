from django.apps import AppConfig


class CoreConfig(AppConfig):
    """App hạ tầng: management command, và (từ Phase 1) models domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "core"

    def ready(self):
        """Nạp `core/kiem_trien_khai.py` để `@register()` của nó chạy.

        `django.core.checks` chỉ biết những phép kiểm đã được **import**; một module chứa
        `@register()` mà không ai import là một hàng rào không tồn tại. `ready()` là chỗ
        duy nhất Django bảo đảm chạy đúng một lần cho mọi tiến trình.
        """
        from core import kiem_trien_khai  # noqa: F401 - import LÀ mục đích
