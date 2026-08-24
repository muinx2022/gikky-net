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


class ModSub(models.Model):
    """Ai phụ trách chuyên mục nào — bảng nối `Sub` × `User` (2026-08-24).

    ## ⚠ Vai trò này CHƯA cho thêm quyền gì

    User chốt nó **sẽ** có quyền thật ("các mod sẽ thay đổi được trạng thái của post"),
    nên nó dựng như một vai trò chứ không như một cái nhãn. Nhưng **không endpoint nào
    hỏi tới nó ở lượt này**, và đó là chủ đích: nối quyền nghĩa là nới `api/quan_tri.py::
    ChiMod` — cái cổng đang đòi `is_staff` cho toàn khu quản trị — rồi thêm phép kiểm
    theo-sub vào mọi đường kiểm duyệt. Đó là thay đổi bảo mật, có plan riêng
    (`plans/2026-08-24-mod-chuyen-muc.md` §0).

    Ai đọc bảng "Mod" mà tưởng những người trong đó đang moderate được là hiểu sai, và
    hiểu sai theo hướng nguy hiểm.

    ## Vì sao BẢNG NỐI chứ không một khoá ngoại trên `Sub`

    User chốt "nhiều mod". Một `Sub.mod_id` nullable gọn hơn đúng tới hôm cần người thứ
    hai, và hôm đó là một migration đổi cấu trúc kèm dữ liệu.

    ## `assigned_by` là SET_NULL, không CASCADE

    Mod A gán mod B rồi A rời đi: với CASCADE, hàng phân công của **B** — người vẫn đang
    làm — bị xoá theo. Mất dữ liệu âm thầm, và mất đúng câu trả lời cho "ai cho người này
    làm mod".

    ## Khoá

    Bảng lá, không sinh cạnh mới trong thứ tự `Comment/Moc → Mach → MocAnh`: `INSERT`
    chỉ lấy `FOR KEY SHARE` trên hàng `Sub` và `User`, và không đường nào trong repo
    khoá `ModSub` rồi mới xin hai bảng đó.
    """

    sub = models.ForeignKey(Sub, on_delete=models.CASCADE, related_name="mods")
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="sub_dang_mod",
    )
    assigned_at = models.DateTimeField(default=timezone.now, editable=False)
    assigned_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="+",
    )

    class Meta:
        verbose_name = "mod chuyên mục"
        verbose_name_plural = "mod chuyên mục"
        constraints = [
            models.UniqueConstraint(
                fields=["sub", "user"], name="modsub_duy_nhat_sub_user"
            )
        ]

    def __str__(self) -> str:
        return f"s/{self.sub.slug} ← u/{self.user.username}"


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
    #: Điểm của **mốc 1** — khoá sort của feed "Nhiều điểm nhất" (plan con 1d §1).
    #:
    #: `IntegerField` chứ không `PositiveIntegerField`: `Moc.score` là `up − down` nên nó
    #: âm được, và một mạch bị dìm phải xếp DƯỚI mạch chưa ai vote chứ không bị kẹp về 0.
    #:
    #: Vì sao denormalize thay vì `JOIN` sang `Moc` rồi `ORDER BY`: khoá sort của một feed
    #: phải index được, mà điểm nằm ở bảng khác thì không có index nào phục vụ được
    #: `ORDER BY` đó (PLAN mục 6 đã chọn kỷ luật denormalize cho đúng nhóm bài này).
    #: Công thức + ca bia mộ: `core/ghi.py::cap_nhat_dem_mach` và CHỈ ở đó.
    diem_bai_goc = models.IntegerField(default=0)

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
            # Feed "Nhiều điểm nhất" toàn thời gian (plan con 1d §1). Cặp `(điểm, id)` là
            # đúng khoá cursor keyset của feed đó — `diem_bai_goc` một mình không duy
            # nhất, và keyset trên khoá không duy nhất lại rơi đúng vào bệnh trùng/sót mà
            # nó sinh ra để chữa (xem `api/phan_trang.py`).
            models.Index(fields=["-diem_bai_goc", "-id"], name="mach_diem_desc"),
            #
            # **KHÔNG có index riêng cho "Nhiều điểm nhất trong một KHOẢNG"**
            # (`?khoang=ngay|tuan|thang`) — W10, lượt vá 2. Bản 1d từng thêm
            # `mach_created_diem` trên `(-created_at, -diem_bai_goc)`; nó bị **bỏ hẳn**,
            # và lý do là số đo chứ không phải khẩu vị.
            #
            # `EXPLAIN`, `enable_seqscan = off`, trên `gikky_dev` — **24 hàng `core_mach`
            # của `seed_dev`**, tức số của một bảng đồ chơi; đọc nó như "planner CHỌN gì",
            # đừng đọc như "cái này nhanh hơn cái kia":
            #
            #     ->  Sort  (Sort Key: diem_bai_goc DESC, id DESC)
            #           ->  Index Scan using mach_created_desc on core_mach
            #                 Index Cond: (created_at >= '…')
            #                 Filter: (hidden_at IS NULL)
            #
            # Kế hoạch ấy **y hệt** kế hoạch khi còn `mach_created_diem` — chỉ đổi tên
            # index. Cột `diem_bai_goc` trong index cũ không bao giờ góp được gì, và đó
            # là bản chất của B-tree chứ không phải chuyện tinh chỉnh:
            #
            # 1. vị từ trên cột đầu là RANGE (`created_at >= …`), nên mọi cột sau nó
            #    không còn cấp thứ tự — `Sort` LUÔN xuất hiện;
            # 2. index **không chứa cột `id`**, mà khoá sort là cặp `(diem_bai_goc, id)`,
            #    nên nó không phục vụ được `ORDER BY` kể cả khi vị từ đầu là `=`;
            # 3. vế keyset của trang 2 vì thế rơi xuống `Filter`, không thành `Index Cond`:
            #
            #        Filter: (hidden_at IS NULL) AND
            #                (diem_bai_goc < 5 OR (diem_bai_goc = 5 AND id < 999))
            #
            # Và `mach_created_desc` trên `(-created_at)` **đã có sẵn từ migration 0002**,
            # nên giữ `mach_created_diem` là nuôi một index thứ hai cho cùng một kế hoạch:
            # mọi `INSERT`/`UPDATE` trên `core_mach` trả tiền, không ai được gì.
            #
            # Với `khoang=tat_ca` (mặc định) thì đường đi khác hẳn: `mach_diem_desc` ở
            # trên cho `Index Scan` đúng thứ tự, **không có `Sort` nào**.
            #
            # **Nợ có tên**: "top theo khoảng" vẫn chưa có index nào phục vụ được cả phép
            # lọc lẫn phép sắp. Cách chữa thật là index partial theo từng khoảng, hoặc
            # BRIN + sắp trong bộ nhớ, hoặc chấp nhận `Sort` — quyết định ấy cần số đo
            # trên dữ liệu THẬT (24 hàng không phân biệt được ba phương án), không phải
            # một dòng đổi thứ tự cột ở đây.
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
