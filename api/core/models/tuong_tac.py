"""`Vote`, `Reaction`, `Trich`, `Follow` — PLAN mục 6, 5.6, 5.7."""

# LƯU Ý CHUNG CHO CẢ MODULE — tiền đề "không DELETE bao giờ" là SAI.
# PLAN nguyên tắc 2 chỉ nói MỐC xoá mềm (bia mộ). PLAN 5.3 nói khác về bình luận: giữ
# chỗ "[đã xoá]" nếu có reply con **hoặc đã TỪNG được trích (kể cả trích đã gỡ)**, xoá
# thật khi không dính cả hai. Nghĩa là Phase 2 vẫn sẽ có `DELETE FROM core_comment` thật
# — chỉ hẹp hơn một điều kiện. Mọi thứ treo vào `Comment` phải được thiết kế với giả
# định đó — xem `Vote` và `Trich` bên dưới.

from django.conf import settings
from django.db import models
from django.utils import timezone


class Vote(models.Model):
    """Vote ±1 trên mốc HOẶC bình luận, hai trục riêng rẽ (PLAN 5.7).

    Dùng `(target_type, target_id)` thay vì hai FK nullable: một hàng vote luôn trỏ
    đúng một đích, và ràng buộc "mỗi user một vote mỗi đích" viết được thành MỘT unique
    duy nhất.

    **Cái giá, nói thẳng: không có FK thật ⇒ không có `ON DELETE`, và hàng mồ côi là
    chuyện SẼ xảy ra — với CẢ HAI loại đích, không riêng bình luận.**

    - `Comment`: PLAN 5.3 cho xoá THẬT bình luận không dính reply lẫn trích. Bình luận
      biến mất, mọi hàng `Vote` trỏ vào `id` của nó ở lại vĩnh viễn.
    - `Moc`: xoá mềm là luật ở tầng *sản phẩm* (bia mộ — PLAN nguyên tắc 2), **không
      phải bất biến của dữ liệu**. `Moc.mach` là `CASCADE`, nên một `Mach.delete()` —
      `seed_dev --reset` đang gọi đúng lệnh đó, và admin Phase 4 sẽ có nút tương ứng —
      xoá hàng `Moc` thật. Phiếu trỏ vào mốc mồ côi y hệt phiếu trỏ vào bình luận.

    Không ai dọn chúng. Đỡ được một nửa nhờ `id` của Postgres là identity không tái sử
    dụng: hàng mồ côi chỉ là rác, chứ nếu id có tái dùng thì phiếu cũ sẽ *cộng vào* một
    đích khác.

    Dọn hàng `Vote` cùng transaction với `DELETE` (bình luận lẫn mạch) là **mục việc bắt
    buộc của plan Phase 2**, không phải việc của 1a: 1a không có đường xoá nào ngoài
    `seed_dev --reset`, và chỗ đó đã dọn `Vote` tay trước khi xoá `Mach`.

    `value ∈ {−1, 1}` — **rút vote là XOÁ hàng, không phải lưu 0**. API nhận `0` nghĩa
    là rút (PLAN mục 7), và `CheckConstraint` dưới đây chặn `0` lọt xuống DB: một hàng
    `value=0` sẽ vừa chiếm suất unique vừa cộng 0 vào count, tức "đã vote mà không đếm".
    """

    class Loai(models.TextChoices):
        MOC = "moc", "Mốc"
        COMMENT = "comment", "Bình luận"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="votes"
    )
    target_type = models.CharField(max_length=8, choices=Loai)
    target_id = models.BigIntegerField()
    value = models.SmallIntegerField()
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        verbose_name = "vote"
        verbose_name_plural = "vote"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "target_type", "target_id"], name="vote_duy_nhat_dich"
            ),
            models.CheckConstraint(
                condition=models.Q(value__in=[-1, 1]), name="vote_gia_tri_hop_le"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} {self.value:+d} → {self.target_type}#{self.target_id}"


class Reaction(models.Model):
    """Reaction 1 chạm trên mốc — bộ CỐ ĐỊNH 📈📉🔥🧊🎯 (PLAN 5.7).

    Lưu khoá không dấu chứ không lưu emoji: đổi bộ icon sau này không phải migrate dữ
    liệu, và so sánh chuỗi không dính chuyện biến thể unicode của emoji.
    """

    class Emoji(models.TextChoices):
        LEN = "len", "📈 lên"
        XUONG = "xuong", "📉 xuống"
        LUA = "lua", "🔥 lửa"
        BANG = "bang", "🧊 băng"
        TRUNG = "trung", "🎯 trúng"

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="reactions"
    )
    moc = models.ForeignKey("core.Moc", on_delete=models.CASCADE, related_name="reactions")
    emoji = models.CharField(max_length=8, choices=Emoji)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        verbose_name = "reaction"
        verbose_name_plural = "reaction"
        constraints = [
            # Một user một reaction mỗi mốc — đổi reaction là UPDATE, không phải thêm hàng.
            models.UniqueConstraint(fields=["user", "moc"], name="reaction_duy_nhat_moc"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} {self.emoji} → mốc {self.moc_id}"


class Trich(models.Model):
    """Chủ mạch trích một bình luận vào mốc — "trích vào sổ" (PLAN 5.6).

    **Rào 1: tối đa 1 trích ĐANG HIỆU LỰC mỗi mốc**, hiện thực bằng partial unique
    `UNIQUE (moc) WHERE removed_at IS NULL`. Gỡ trích ghi `removed_at` chứ không xoá
    hàng — hàng cũ tự nó là log, và vì unique là partial nên gỡ xong trích bình luận
    khác được ngay.

    Rào 2 (hiển thị kèm dấu thời gian bình luận gốc) và rào 4 (render tách bạch) là
    việc của tầng UI; rào 3 (đếm theo số tác giả KHÁC NHAU) là việc của truy vấn hồ sơ.
    Chỉ rào 1 là ràng buộc dữ liệu, nên chỉ nó nằm ở đây.

    **`comment` là `PROTECT`, không phải `CASCADE`.** PLAN 5.6 mở đầu bằng "được ghi tên
    vào cuốn sổ **không-xoá-được**", còn PLAN 5.3 cho xoá THẬT một bình luận không dính
    reply lẫn trích. Hai câu đó gặp nhau ở đây: dưới `CASCADE`, Phase 2 gọi
    `DELETE /comments/{id}` là blockquote biến mất khỏi mốc của một mạch đã đóng sổ, chỉ
    số "Được trích ×N" tụt, hàng log biến mất — **không exception, không audit, trang vẫn
    200**. `PROTECT` biến chuyện đó thành `ProtectedError` ngay tại chỗ, ép Phase 2 phải
    viết ra luật đúng: *bình luận đã trích thì chỉ xoá MỀM, blockquote ở lại.*

    Và `PROTECT` chặn theo hàng, **không** theo `removed_at`: trích đã gỡ vẫn chặn xoá
    thật. Đó đúng là chữ "đã TỪNG được trích (kể cả trích đã gỡ)" của PLAN 5.3 — hàng đã
    gỡ ở lại vì tự nó là log, nên xoá thật bình luận sẽ xoá luôn cái log đó.

    `moc` giữ `CASCADE` vì không có đường sản phẩm nào xoá một `Moc` lẻ (bia mộ — PLAN
    nguyên tắc 2); cascade ở đó chỉ chạy khi cả `Mach` bị xoá tận gốc, lúc ấy sổ cũng
    không còn.
    """

    moc = models.ForeignKey("core.Moc", on_delete=models.CASCADE, related_name="trichs")
    comment = models.ForeignKey(
        "core.Comment", on_delete=models.PROTECT, related_name="trichs"
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    #: NULL = đang hiệu lực. Gỡ được trong 24h (luật thời gian ở tầng API).
    removed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "trích vào sổ"
        verbose_name_plural = "trích vào sổ"
        constraints = [
            models.UniqueConstraint(
                fields=["moc"],
                condition=models.Q(removed_at__isnull=True),
                name="trich_mot_hieu_luc_moi_moc",
            ),
        ]

    def __str__(self) -> str:
        trang_thai = "đã gỡ" if self.removed_at else "hiệu lực"
        return f"trích comment {self.comment_id} vào mốc {self.moc_id} ({trang_thai})"

    def clean(self) -> None:
        """**Bình luận và mốc phải cùng một mạch** — nợ 1a bàn giao, trả ở Phase 2.

        Hai FK độc lập nghĩa là `Trich(moc=<mốc mạch A>, comment=<bình luận mạch B>)` là
        một hàng hợp lệ với DB. Hậu quả không phải lý thuyết: `api/machs.py` nạp khối
        trích bằng `Trich.objects.filter(moc__mach=mach)` rồi render nguyên văn
        `trich.comment.body` — tức **nội dung của một mạch khác** hiện lên thẻ mốc, kèm
        tên tác giả, kèm hai dấu thời gian, trông y như thật. Ở chiều ngược lại,
        `duoc_trich` trên hồ sơ cộng cho người viết một điểm từ một cuốn sổ họ chưa từng
        góp mặt — đúng "máy in địa vị" mà rào 3 của PLAN 5.6 dựng lên để chặn.

        ⚠ **Mức bảo vệ THẬT, đừng đọc mạnh hơn: đây là ràng buộc TẦNG ỨNG DỤNG.**
        Postgres không có `CHECK` nào so được hai cột ở hai bảng khác (`CHECK` cấm truy
        vấn con), nên hàng rào duy nhất còn lại phải nằm trên đường ghi. `save()` dưới đây
        gọi nó, và `save()` phủ được cả `objects.create()` — nhưng **`bulk_create`,
        `QuerySet.update()` và SQL trần thì KHÔNG đi qua**. Cách chặt hơn (FK ghép trên
        `(id, mach_id)`, thêm cột `mach` denormalize cho `Trich`) là một quyết định có giá
        riêng và nó chưa cần cho tới khi có đường ghi `Trich` thật — endpoint "trích vào
        sổ" là việc của Phase 3, và plan con của phase đó phải đọc lại đoạn này.
        """
        if self.comment_id is None or self.moc_id is None:
            return
        from core.models.binh_luan import Comment as _Comment
        from core.models.moc import Moc as _Moc

        mach_cua_comment = (
            _Comment.objects.filter(pk=self.comment_id)
            .values_list("mach_id", flat=True)
            .first()
        )
        mach_cua_moc = (
            _Moc.objects.filter(pk=self.moc_id)
            .values_list("mach_id", flat=True)
            .first()
        )
        if (
            mach_cua_comment is not None
            and mach_cua_moc is not None
            and mach_cua_comment != mach_cua_moc
        ):
            from django.core.exceptions import ValidationError

            raise ValidationError(
                f"Trích chéo mạch: bình luận {self.comment_id} thuộc mạch "
                f"{mach_cua_comment}, còn mốc {self.moc_id} thuộc mạch {mach_cua_moc}."
            )

    def save(self, *args, **kwargs):
        """Gọi `clean()` trước mọi lần ghi — xem docstring của nó.

        Django **không** tự gọi `clean()` trong `save()` (chỉ `ModelForm` gọi), nên nếu
        chỉ khai `clean()` thì `Trich.objects.create(...)` — đường mà Phase 3 sẽ dùng —
        đi thẳng xuống DB không qua phép kiểm nào.
        """
        self.clean()
        return super().save(*args, **kwargs)


class Follow(models.Model):
    """Theo mạch + vị trí đọc dở của người theo (PLAN mục 2 "vạch mới", 5.5)."""

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="follows"
    )
    mach = models.ForeignKey("core.Mach", on_delete=models.CASCADE, related_name="follows")
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    #: 0 = chưa xem mốc nào. Vạch mới kẻ trước mốc `last_seen_entry_seq + 1`.
    last_seen_entry_seq = models.PositiveIntegerField(default=0)

    class Meta:
        verbose_name = "theo mạch"
        verbose_name_plural = "theo mạch"
        constraints = [
            models.UniqueConstraint(fields=["user", "mach"], name="follow_duy_nhat_mach"),
        ]

    def __str__(self) -> str:
        return f"{self.user_id} theo mạch {self.mach_id}"
