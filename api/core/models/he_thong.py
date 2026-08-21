"""`Notification`, `Report`, `AuditLog` — PLAN mục 6, 5.8, 5.10."""

from django.conf import settings
from django.db import models
from django.utils import timezone


class Notification(models.Model):
    """Thông báo cho chuông web (poll 60s) + email (PLAN 5.8). Không websocket ở v1.

    **`dedupe_key` gộp theo NGÀY LỊCH VN**: "moc_moi:{mach_id}:{yyyymmdd}". Mốc thứ 2
    trong cùng ngày cập nhật `payload` của hàng cũ thay vì tạo hàng mới — nếu không,
    tác giả nối 3 mốc/ngày (mức trần PLAN 5.1) là follower ăn 3 chuông cho một mạch.

    `UNIQUE (user, dedupe_key)` với `dedupe_key = NULL` KHÔNG chặn gì: Postgres coi mọi
    NULL là khác nhau trong unique index. Đó đúng là ý muốn — thông báo reply/trích
    không gộp, mỗi cái một hàng.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="notifications"
    )
    #: "moc_moi" | "reply" | "trich" — chuỗi tự do, tầng API chốt danh sách ở Phase 3.
    type = models.CharField(max_length=32)
    payload = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    read_at = models.DateTimeField(null=True, blank=True)
    dedupe_key = models.CharField(max_length=120, null=True, blank=True)

    class Meta:
        verbose_name = "thông báo"
        verbose_name_plural = "thông báo"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "dedupe_key"], name="notification_duy_nhat_dedupe"
            ),
        ]
        indexes = [
            # Chuông poll: 20 thông báo mới nhất của tôi.
            models.Index(fields=["user", "-created_at"], name="notif_user_created"),
        ]

    def __str__(self) -> str:
        return f"{self.type} → user {self.user_id}"


class Report(models.Model):
    """Báo cáo nội dung → hàng đợi admin (PLAN 5.10 · Phase 4 dùng)."""

    class LyDo(models.TextChoices):
        PHIM_HANG = "phim_hang", "Hô hào mua bán / phím hàng"
        LUA_DAO = "lua_dao", "Lừa đảo, mời uỷ thác, room VIP"
        SPAM = "spam", "Spam"
        KHAC = "khac", "Khác"

    class Dich(models.TextChoices):
        MACH = "mach", "Mạch"
        MOC = "moc", "Mốc"
        COMMENT = "comment", "Bình luận"

    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="reports"
    )
    target_type = models.CharField(max_length=8, choices=Dich)
    target_id = models.BigIntegerField()
    ly_do = models.CharField(max_length=16, choices=LyDo)
    ghi_chu = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="reports_da_xu_ly",
    )
    #: Hành động đã làm khi đóng report: "an", "khoa", "ban", "bo_qua"...
    action = models.CharField(max_length=32, null=True, blank=True)

    class Meta:
        verbose_name = "báo cáo"
        verbose_name_plural = "báo cáo"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"report {self.ly_do} → {self.target_type}#{self.target_id}"


class AuditLog(models.Model):
    """Nhật ký hành động mod (PLAN 5.10).

    **STATE của moderation KHÔNG nằm ở đây** — nó nằm ở `hidden_at`/`locked_at`/`ban*`
    trên chính đối tượng. Bảng này chỉ trả lời "ai làm gì lúc nào"; suy ra trạng thái
    hiện tại bằng cách replay log là công thức cho hai nguồn sự thật lệch nhau.
    """

    actor = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="audit_logs"
    )
    action = models.CharField(max_length=64)
    target_type = models.CharField(max_length=16)
    target_id = models.BigIntegerField(null=True, blank=True)
    meta = models.JSONField(default=dict, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        verbose_name = "audit log"
        verbose_name_plural = "audit log"
        ordering = ["-created_at"]

    def __str__(self) -> str:
        return f"{self.action} bởi {self.actor_id} → {self.target_type}#{self.target_id}"
