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
        """Lý do báo cáo — **phủ đủ bốn điều cấm của `/luat`** (user chốt 2026-08-25).

        Trước lượt này chỉ có bốn giá trị, và chúng **không khớp luật**: hai điều cấm có
        thật ở `/luat` — *cam kết lợi nhuận* và *link nhóm kín trong bài* — không có ô nào
        để chọn. Người muốn báo đúng chuyện đó chỉ còn "Khác", tức mod nhận một hàng đợi
        mà lý do thật nằm trong ô ghi chú tự do, không lọc được, không đếm được.

        ⚠ **Chỉ THÊM, không đổi tên khoá cũ.** `lua_dao` ở lại nguyên chuỗi dù nhãn của nó
        trùng điều 3: đổi khoá là phải migrate mọi hàng `Report` đã có, và một hàng đợi
        kiểm duyệt là thứ **không** được sửa lại quá khứ — mod đã xử theo lý do nào thì
        `AuditLog` ghi lý do đó.

        `spam` không nằm trong bốn điều cấm nhưng ở lại: nó là loại vi phạm phổ biến nhất
        của mọi diễn đàn và `/luat` xử nó ở phần chế tài chứ không ở phần điều cấm.
        """

        PHIM_HANG = "phim_hang", "Hô hào mua bán / phím hàng"
        CAM_KET_LOI_NHUAN = "cam_ket_loi_nhuan", "Cam kết lợi nhuận, hứa mức lãi"
        LUA_DAO = "lua_dao", "Mời uỷ thác, room VIP trả phí, lừa đảo"
        LINK_NHOM_KIN = "link_nhom_kin", "Link nhóm kín (Zalo, Telegram, group riêng)"
        SPAM = "spam", "Spam, lôi kéo, đăng lặp"
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
    #: 24 chứ không 16: khoá dài nhất là `cam_ket_loi_nhuan` (17). Nới sẵn một chút
    #: để lần thêm lý do sau không kéo theo migration thứ hai chỉ vì một ký tự.
    ly_do = models.CharField(max_length=24, choices=LyDo)
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
        constraints = [
            # **Một người, một đích, một báo cáo ĐANG MỞ** (L03, vá V1). Unique
            # **partial** chứ không unique thường, và khác biệt ấy là cả luật: mod đóng
            # báo cáo cũ xong thì cùng người ấy phải tố lại được nếu nội dung tái phạm —
            # unique thường sẽ khoá vĩnh viễn, và người dùng không có cách nào biết vì sao
            # nút của họ im lặng.
            #
            # Ở tầng DB chứ không chỉ một câu `exists()` ở handler: hai tab, hai lượt bấm
            # cùng lúc thì câu `exists()` thua cuộc đua và hàng đợi kiểm duyệt có hai dòng
            # y hệt — đúng loại rác làm mod đọc lướt rồi bấm bừa.
            models.UniqueConstraint(
                fields=["reporter", "target_type", "target_id"],
                condition=models.Q(resolved_at__isnull=True),
                name="bao_cao_mot_lan_moi_dich_dang_mo",
            )
        ]

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
