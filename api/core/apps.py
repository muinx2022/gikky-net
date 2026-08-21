from django.apps import AppConfig


class CoreConfig(AppConfig):
    """App hạ tầng: management command, và (từ Phase 1) models domain."""

    default_auto_field = "django.db.models.BigAutoField"
    name = "core"
