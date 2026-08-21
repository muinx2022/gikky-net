"""`Sub` và `Mach` — PLAN mục 6.

`Mach` là gốc của mọi thứ: mốc, bình luận, follow, notification đều treo vào nó.
Bốn cột denormalize (`last_entry_at`, `last_activity_at`, `entry_count`,
`comment_count`) **không được sửa rải rác** — chỉ đi qua `core/ghi.py`.
"""

from django.conf import settings
from django.db import models
from django.utils import timezone
from django.utils.text import slugify

#: Slug cắt 60 ký tự — URL là `/m/<slug>-<id>`, `id` mới là khoá (PLAN 5.9), slug chỉ
#: để đọc. Vì vậy slug KHÔNG unique: hai mạch trùng tên vẫn ra hai URL khác nhau.
DAI_SLUG_MACH = 60


#: `slugify(..., allow_unicode=False)` bỏ dấu bằng NFKD + encode ASCII. Cách đó xử lý
#: được 5 dấu thanh và cả â/ê/ô/ơ/ư, nhưng **Đ/đ không phải chữ có dấu** — nó là một
#: chữ cái riêng trong bảng chữ cái tiếng Việt, NFKD không tách ra được, nên ASCII hoá
#: sẽ XOÁ HẲN nó: "Đường dài" → "uong-dai". Phải đổi trước khi slugify.
BANG_DOI_D = str.maketrans({"Đ": "D", "đ": "d"})


def slug_tu_title(title: str) -> str:
    """Slug hiển thị cho `Mach`. Bỏ dấu (`allow_unicode=False`), cắt `DAI_SLUG_MACH`.

    Cắt ở đây có thể để lại dấu `-` cuối chuỗi; `rstrip("-")` cho URL sạch. Tiêu đề
    toàn ký tự bị slugify loại (vd chỉ có emoji) ra chuỗi rỗng — chấp nhận được, URL
    thành `/m/-1234`, và 1c redirect 301 về dạng chuẩn như mọi slug lệch khác.
    """
    return (
        slugify(title.translate(BANG_DOI_D), allow_unicode=False)[:DAI_SLUG_MACH]
        .rstrip("-")
    )


class Sub(models.Model):
    """Chuyên mục. v1 chỉ tạo tay qua admin: `chung-khoan`, `crypto` (PLAN mục 1)."""

    slug = models.SlugField(max_length=40, unique=True)
    ten = models.CharField(max_length=80)
    mo_ta = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        verbose_name = "sub"
        verbose_name_plural = "subs"

    def __str__(self) -> str:
        return f"s/{self.slug}"


class TrangThaiMach(models.TextChoices):
    """Trạng thái sổ của mạch. Khai ở tầng module, không lồng trong `Mach`, vì
    `Meta.indexes` bên dưới cần tham chiếu nó — thân `class Meta` không nhìn thấy được
    tên khai trong thân `class Mach` bao ngoài (luật scope của Python, không phải của
    Django). `Mach.TrangThai` giữ nguyên như một alias để code gọi vẫn tự nhiên.
    """

    MO = "open", "Đang mở"
    DONG = "closed", "Đã đóng sổ"


class Mach(models.Model):
    """Một bài viết dạng nhật ký nối dài (PLAN mục 2).

    **Không có trường `body`** (PLAN 5.1): thân bài gốc chính là `Moc(seq=1)`, không có
    ngoại lệ. Mọi post sinh ra đều là `Mach`; `entry_count == 1` thì UI render như post
    thường.

    **`status` và `locked_at` là HAI TRỤC KHÁC NHAU** (PLAN 5.10): `closed` là tác giả
    đóng sổ (vẫn bình luận được, không nối mốc được); `locked_at` là mod khoá (đọc được,
    cấm mọi tương tác). Gộp hai cái vào một enum là mất khả năng diễn đạt "mạch đã đóng
    bị mod khoá".
    """

    TrangThai = TrangThaiMach

    sub = models.ForeignKey(Sub, on_delete=models.PROTECT, related_name="machs")
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="machs"
    )
    #: `db_index=False` là CỐ Ý. `SlugField` mặc định `db_index=True`, và trên Postgres
    #: một cột varchar có index sinh ra HAI cây: b-tree thường + `varchar_pattern_ops`.
    #: Không truy vấn nào tra mạch theo slug — URL là `/m/<slug>-<id>`, 1c đọc theo `id`
    #: rồi so slug trong bộ nhớ để quyết định 301 (PLAN 5.9). Hai cây đó chỉ là hai lần
    #: ghi thêm mỗi lần `INSERT`/đổi tiêu đề, không phục vụ ai.
    slug = models.SlugField(max_length=DAI_SLUG_MACH, blank=True, db_index=False)
    title = models.CharField(max_length=160)

    status = models.CharField(
        max_length=8, choices=TrangThaiMach, default=TrangThaiMach.MO
    )
    closed_at = models.DateTimeField(null=True, blank=True)
    #: Một dòng tự do ≤40 ký tự khi đóng sổ, vd "+18.2% · 163 ngày" (PLAN 5.1).
    #: THUẦN HIỂN THỊ — không validate ngữ nghĩa. NULL = không nhập, banner ẩn phần này.
    ket_qua = models.CharField(max_length=40, null=True, blank=True)

    # --- Moderation (PLAN 5.10 · Phase 4 dùng) -------------------------------
    locked_at = models.DateTimeField(null=True, blank=True)
    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="machs_da_an",
    )

    # --- Denormalize (PLAN mục 6: cập nhật trong CÙNG transaction với ghi) ----
    #: KHÔNG nullable, dù lúc `Mach` vừa tạo thì mốc 1 chưa tồn tại: hai cột này là khoá
    #: sort của cả hai feed (PLAN 5.9). `NULL` trong `ORDER BY ... DESC` của Postgres nằm
    #: TRƯỚC mọi giá trị — một mạch lỗi nửa chừng sẽ chiếm đỉnh feed vĩnh viễn. Mặc định
    #: `timezone.now` cho giá trị đúng ngay tại thời điểm tạo, `core/ghi.py` cập nhật sau.
    #:
    #: **Hai nhóm, hai luật đếm khác nhau** — PLAN mục 6 "Luật đếm 4 cột denormalize";
    #: công thức nguyên văn ở `core/ghi.py::cap_nhat_dem_mach` và CHỈ ở đó (chép lại
    #: luật vào đây là cách nó lệch khỏi code lần sau):
    #: `last_entry_at`/`entry_count` đo **cấu trúc** (mọi `Moc`, kể cả ẩn và bia mộ);
    #: `last_activity_at`/`comment_count` đo **nội dung đọc được**.
    last_entry_at = models.DateTimeField(default=timezone.now)
    #: Đầu vào của luật BÃO/CẶN (PLAN 5.5). Công thức: xem khối trên — KHÔNG chép lại ở đây.
    last_activity_at = models.DateTimeField(default=timezone.now)
    entry_count = models.PositiveIntegerField(default=0)
    comment_count = models.PositiveIntegerField(default=0)

    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        verbose_name = "mạch"
        verbose_name_plural = "mạch"
        indexes = [
            # Feed trong sub (PLAN 5.9 tab "Đang diễn ra" có `?sub=`).
            models.Index(fields=["sub", "-last_entry_at"], name="mach_sub_last_entry"),
            # Hồ sơ user: mạch của họ, mới nhất trước (PLAN 5.9 `/u/<username>`).
            models.Index(fields=["author", "-created_at"], name="mach_author_created"),
            # Feed "Mới" toàn cục.
            models.Index(fields=["-created_at"], name="mach_created_desc"),
            # Feed "Đang diễn ra" toàn cục — partial: index chỉ chứa mạch đang mở,
            # nhỏ hơn hẳn index đầy đủ và đúng bằng cái feed đó cần.
            models.Index(
                fields=["-last_entry_at"],
                condition=models.Q(status=TrangThaiMach.MO),
                name="mach_open_last_entry",
            ),
        ]

    def __str__(self) -> str:
        return f"[{self.pk}] {self.title}"

    def save(self, *args, **kwargs):
        """Tự sinh `slug` khi chưa có — slug rỗng làm URL `/m/-123` vô nghĩa.

        Không tự sinh LẠI khi `title` đổi: PLAN 5.9 nói slug đổi được và URL cũ phải
        301, nên việc đổi slug là hành động có chủ đích của tầng trên, không phải hiệu
        ứng phụ của một lần `save()`.
        """
        if not self.slug:
            self.slug = slug_tu_title(self.title)
        super().save(*args, **kwargs)
