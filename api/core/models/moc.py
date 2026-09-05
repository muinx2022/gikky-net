"""`Moc`, `MocRevision`, `MocAnh`, `AnhNoiDung` — PLAN mục 6 và 5.2.

Mốc là "kết tủa" của mạch: append-only, hai dấu thời gian, sửa thì để lại bản cũ.

`AnhNoiDung` (2026-08-24) ở cùng file dù nó **không** có FK sang `Moc`: nó là ảnh nhúng
trong `Moc.body`, nên đọc nó cạnh `MocAnh` là cách duy nhất thấy ngay hai loại ảnh khác
nhau ở chỗ nào. Xem docstring của chính lớp đó.
"""

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import MaxLengthValidator
from django.db import models
from django.utils import timezone

from core.lam_sach_html import DINH_DANG_BODY, DINH_DANG_MARKDOWN

#: PLAN 5.2 — body HTML/markdown ≤50.000 ký tự (nới từ 10.000 ký tự để chứa đủ HTML rich text).
DAI_BODY_MOC = 50_000
#: PLAN 5.2 — `figures` tối đa 6 cặp {label, value}.
SO_FIGURES_TOI_DA = 6
DAI_FIGURE_LABEL = 24
DAI_FIGURE_VALUE = 24


def kiem_figures(figures) -> None:
    """Validate **cấu trúc** của `figures`, KHÔNG validate ngữ nghĩa.

    PLAN 5.2 chốt `figures` là "thuần hiển thị": không ai kiểm "GIÁ VÀO 27.80" có phải
    giá thật không, không ép sub nào phải có ô nào (mục 4 đã loại structured fields).
    Nhưng *hình dạng* thì vẫn phải chặn ở đây — frontend render `f["label"]` mù quáng,
    một dict lạc vào chỗ list là trang mạch trắng xoá.

    Hợp lệ: `None`, hoặc list ≤6 phần tử, mỗi phần tử là dict CHỈ có đúng hai khoá
    `label` và `value`, cả hai là chuỗi không rỗng.
    """
    if figures is None:
        return
    if not isinstance(figures, list):
        raise ValidationError("figures phải là một list (hoặc null).")
    if len(figures) > SO_FIGURES_TOI_DA:
        raise ValidationError(
            f"figures tối đa {SO_FIGURES_TOI_DA} cặp, nhận {len(figures)}."
        )
    for chi_so, cap in enumerate(figures):
        if not isinstance(cap, dict):
            raise ValidationError(f"figures[{chi_so}] phải là object {{label, value}}.")
        if set(cap) != {"label", "value"}:
            raise ValidationError(
                f"figures[{chi_so}] phải có đúng hai khoá label và value, "
                f"nhận {sorted(cap)}."
            )
        for khoa, gioi_han in (("label", DAI_FIGURE_LABEL), ("value", DAI_FIGURE_VALUE)):
            gia_tri = cap[khoa]
            if not isinstance(gia_tri, str) or not gia_tri.strip():
                raise ValidationError(
                    f"figures[{chi_so}].{khoa} phải là chuỗi không rỗng."
                )
            if len(gia_tri) > gioi_han:
                raise ValidationError(
                    f"figures[{chi_so}].{khoa} tối đa {gioi_han} ký tự."
                )


class Moc(models.Model):
    """Một entry trong mạch. Bài gốc chính là `seq=1`, không có ngoại lệ (PLAN mục 2).

    **Hai dấu thời gian, chỉ một cái sửa được** (PLAN nguyên tắc 3):

    - `occurred_at` — DATE, người dùng đặt, nhập lùi thoải mái, **cấm tương lai**
      (validate ở tầng API — Phase 2 — vì "hôm nay" phụ thuộc múi giờ VN của request,
      không phải hằng số của model);
    - `created_at` — server đóng dấu, **bất biến**. Khai `default=timezone.now` thay vì
      `auto_now_add=True` là có chủ đích: `auto_now_add` khoá cứng giá trị nên seed
      không dựng lại được một mạch trải 163 ngày, mà seed đó là dữ liệu nghiệm thu của
      cả Phase 1. Tính bất biến được giữ bằng `editable=False` + tầng API không nhận
      trường này, không phải bằng phép màu của ORM.
    """

    mach = models.ForeignKey("core.Mach", on_delete=models.CASCADE, related_name="mocs")
    #: 1..n trong phạm vi một mạch. Cấp phát qua `core/ghi.py::them_moc` (khoá hàng
    #: `Mach` + retry), KHÔNG phải `entry_count + 1` đọc từ bộ nhớ.
    seq = models.PositiveIntegerField()
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="mocs"
    )

    occurred_at = models.DateField()
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    #: Chip ngắn tự do: "vào lệnh", "nâng dừng lỗ"... Có gợi ý theo sub nhưng không ép.
    loai = models.CharField(max_length=20, null=True, blank=True)
    body = models.TextField(validators=[MaxLengthValidator(DAI_BODY_MOC)])
    #: `body` đang ở định dạng nào — renderer chọn đường theo cột này (chốt 2026-08-24,
    #: `plans/2026-08-24-tiptap-html.md`).
    #:
    #: **Cột chứ không đoán bằng regex**: đoán sai đúng ở nội dung người dùng gõ dấu `<`,
    #: mà đây là site tài chính nói về "giá < 27.80" mỗi ngày.
    #:
    #: **Mặc định `markdown` dù mọi hàng sau migration 0014 đều là `html`** — và đó là chủ
    #: đích, không phải quên đổi: `markdown` là đường render AN TOÀN (frontend dựng cây
    #: node có kiểu, React escape mọi chuỗi), `html` là đường nhúng thẳng. Một hàng lọt vào
    #: bảng bằng đường không đi qua `core/ghi.py` (shell, migration tay, script cũ) vì thế
    #: rơi về đường không nhúng được gì. Đường ghi thật đặt `html` TƯỜNG MINH sau khi
    #: `core/lam_sach_html.py::lam_sach` chạy — hai việc đó ở cạnh nhau, một chỗ.
    #:
    #: **Bình luận KHÔNG có cột này**: `Comment.body` giữ markdown (composer khán đài là ô
    #: gõ nhanh). Hai định dạng cùng tồn tại trong hệ là chuyện đã biết trước, không phải
    #: nợ.
    body_dinh_dang = models.CharField(
        max_length=16, choices=DINH_DANG_BODY, default=DINH_DANG_MARKDOWN
    )
    #: Câu mồi hiện trong ngăn kéo khi mốc chưa có bình luận (PLAN 5.4 luật 4).
    question_for_crowd = models.CharField(max_length=200, null=True, blank=True)
    figures = models.JSONField(null=True, blank=True, validators=[kiem_figures])

    # --- Sửa / xoá (PLAN 5.2) ------------------------------------------------
    edited_at = models.DateTimeField(null=True, blank=True)
    edit_count = models.PositiveIntegerField(default=0)
    #: Ai vừa sửa lần GẦN NHẤT — `plans/2026-09-05-cua-so-tu-sua-bai.md` §1.2. Đặt cùng
    #: nhánh `if de_dau:` với `edited_at`/`edit_count` ở `core/ghi.py::_ap_sua_moc`, nên
    #: sửa IM LẶNG (cửa sổ 15 phút) không đụng cột này — không để vết thì không có danh
    #: tính nào để kể.
    #:
    #: `null=True` bắt buộc: dữ liệu CŨ (mọi mốc đã từng sửa trước migration 0029) không
    #: có `edited_by`, và migration không suy ngược ra ai đã sửa. `SET_NULL` chứ không
    #: `PROTECT`/`CASCADE`: xoá tài khoản người từng sửa không được kéo theo xoá cả mốc,
    #: và cũng không nên chặn xoá tài khoản đó.
    edited_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mocs_da_sua",
    )
    #: Xoá = bia mộ, hàng vẫn còn (PLAN nguyên tắc 2). **Đường sản phẩm** không `DELETE` thật —
    #: nhưng `Moc.mach` là `CASCADE`, nên `Mach.delete()` (và Django admin) xoá cứng hàng này.
    #: Đó là ca duy nhất làm `entry_count`/`last_entry_at` lùi — xem PLAN mục 6 "Luật đếm 4 cột".
    deleted_at = models.DateTimeField(null=True, blank=True)

    # --- Moderation (Phase 4) ------------------------------------------------
    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="mocs_da_an",
    )

    #: Mốc chỉ cần `score` (PLAN mục 6): không mốc nào sort bằng wilson, timeline luôn
    #: theo `seq`. Cập nhật cùng transaction với `Vote` — xem `core/ghi.py::dat_vote`.
    score = models.IntegerField(default=0)

    class Meta:
        verbose_name = "mốc"
        verbose_name_plural = "mốc"
        ordering = ["seq"]
        constraints = [
            models.UniqueConstraint(fields=["mach", "seq"], name="moc_duy_nhat_seq"),
            # `PositiveIntegerField` một mình chỉ sinh `CHECK (seq >= 0)`, tức `seq = 0`
            # lọt xuống DB được. PLAN mục 2 nói mốc đánh số 1..n và cả sản phẩm nói theo
            # ngôn ngữ đó ("mốc 1 là bài gốc", chip `‹mốc N›`, `last_seen_entry_seq = 0`
            # nghĩa là CHƯA xem mốc nào). Một hàng `seq = 0` làm "chưa xem gì" và "đã xem
            # mốc 0" thành cùng một giá trị.
            models.CheckConstraint(
                condition=models.Q(seq__gte=1), name="moc_seq_tu_1"
            ),
        ]

    def __str__(self) -> str:
        return f"mạch {self.mach_id} · mốc {self.seq}"


class MocRevision(models.Model):
    """Bản TRƯỚC của một mốc — lưu **đủ cả 5 trường sửa được** (PLAN 5.2).

    Lưu thiếu `occurred_at` là để người ta sửa lùi ngày sự việc mà không để vết, tức là
    phá đúng cái giá trị lõi "ghi-trước-khi-biết-kết-quả" của sản phẩm (PLAN mục 1).
    Diff ở UI phải hiện được cả thay đổi ngày ("10/06 → 04/06").

    **`figures` ở đây mang CÙNG validator với `Moc.figures`, và lý do không hiển nhiên:**
    bản cũ cũng được RENDER (UI diff), nên một `figures` sai hình dạng nằm trong revision
    làm vỡ đúng cái trang mà người ta mở để kiểm tra tính trung thực. Nói cách khác đây
    không phải bảng lưu trữ chết.

    Cảnh báo về mức bảo vệ THẬT (đừng đọc mạnh hơn code): validator của Django chỉ chạy
    khi có ai gọi `full_clean()`. `MocRevision.objects.create(...)` và `.update()` không
    gọi. Ở 1a không có đường ghi nào tạo revision nên chưa có gì để bảo vệ; **đường
    `sua_moc` của Phase 2 phải tự gọi `kiem_figures` trước khi ghi** — đó là mục việc
    bắt buộc của plan Phase 2, không phải hệ quả tự động của dòng dưới đây.
    """

    moc = models.ForeignKey(Moc, on_delete=models.CASCADE, related_name="revisions")

    body = models.TextField()
    figures = models.JSONField(null=True, blank=True, validators=[kiem_figures])
    occurred_at = models.DateField()
    loai = models.CharField(max_length=20, null=True, blank=True)
    question_for_crowd = models.CharField(max_length=200, null=True, blank=True)

    #: Thời điểm bản này bị THAY THẾ (không phải thời điểm nó được viết).
    revised_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        verbose_name = "bản cũ của mốc"
        verbose_name_plural = "bản cũ của mốc"
        ordering = ["-revised_at"]

    def __str__(self) -> str:
        return f"revision mốc {self.moc_id} @ {self.revised_at:%Y-%m-%d %H:%M}"


class MocAnh(models.Model):
    """Ảnh đính kèm mốc — PLAN mục 6, flow ở PLAN 8.5 (đã lệch, xem dưới).

    **`r2_key` đã đổi tên thành `khoa_luu_tru`** (chốt 2026-08-23, `plans/2026-08-23-
    phase-5-anh-local.md` §0). Một cột tên `r2_key` chứa đường dẫn trên đĩa local là
    đúng loài "chữ nói quá code": người đọc kết luận có R2 ở đâu đó, đi tìm, không thấy.
    Khoá là như nhau ở mọi backend vì `STORAGES` của Django trừu tượng đúng chỗ đó, nên
    một cái tên trung tính đúng cho cả hai thời kỳ. Đổi tên rẻ vì cột chưa từng có dữ
    liệu: Phase 1a chỉ dựng bảng, Phase 5 là lượt đầu tiên ghi vào nó.

    **`status` GIỮ LẠI dù upload nay chỉ một nhịp.** Cửa `POST /mocs/{id}/anh` nhận
    multipart, xử lý xong ghi thẳng `confirmed` — không có hàng `pending` nào được sinh
    ra hôm nay. Cột ở lại vì PLAN mục 6 dựng sẵn nó cho hai nhịp `presign`/`confirm`, và
    ngày có R2 thì hai nhịp quay lại y nguyên thiết kế cũ (server không cầm được file
    nữa thì phải có trạng thái trung gian). Trần 10 ảnh/mốc đếm **`confirmed`**, nên một
    `pending` mồ côi của tương lai không chiếm suất của ảnh thật.

    `w`/`h` là kích thước ảnh **đã tái mã hoá** (`core/anh.py` thu nhỏ về cạnh
    `CANH_TOI_DA`), không phải của file gốc — chúng dùng để đặt `width`/`height` trên thẻ
    `<img>` chống layout shift, nên phải khớp đúng file đang được phục vụ.
    """

    class TrangThai(models.TextChoices):
        CHO = "pending", "Chờ xác nhận"
        XAC_NHAN = "confirmed", "Đã xác nhận"

    moc = models.ForeignKey(Moc, on_delete=models.CASCADE, related_name="anhs")
    #: Tên file ngẫu nhiên + đuôi suy từ định dạng đã nhận dạng — `core/anh_luu.py::khoa_moi`.
    #: MỘT khoá dùng cho cả ảnh chính lẫn thumbnail (khác thư mục), nên không có cột
    #: khoá thứ hai để hai bên lệch nhau.
    khoa_luu_tru = models.CharField(max_length=255)
    #: EXIF `DateTimeOriginal` **server** đọc từ file GỐC, trước khi tái mã hoá xoá sạch
    #: EXIF (lệch PLAN 8.5, vốn để client đọc bằng exifr — xem `core/anh.py`).
    exif_taken_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=10, choices=TrangThai, default=TrangThai.CHO)
    position = models.PositiveSmallIntegerField(default=0)
    w = models.PositiveIntegerField(null=True, blank=True)
    h = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    #: File hiện nằm ở kho CÁCH LY (`STORAGES["an"]`), không phải kho đang phục vụ —
    #: mốc đã thành bia mộ hoặc bị mod ẩn. Xem docstring `core/anh_luu.py` (A9).
    #:
    #: Vì sao là một CỘT chứ không suy từ `moc.deleted_at`/`moc.hidden_at`/
    #: `moc.mach.hidden_at`: cột nói file **đang thật sự nằm ở đâu**, còn ba cột kia nói
    #: file *đáng lẽ* nằm ở đâu. Hai thứ đó lệch nhau bất cứ khi nào một lượt chuyển
    #: file thất bại giữa chừng — và `don_anh_mo_coi` cần biết chỗ thật để đi tìm, chứ
    #: không cần biết chỗ đáng lẽ.
    da_cach_ly = models.BooleanField(default=False)

    class Meta:
        verbose_name = "ảnh của mốc"
        verbose_name_plural = "ảnh của mốc"
        ordering = ["position", "id"]

    def __str__(self) -> str:
        return f"ảnh {self.khoa_luu_tru} (mốc {self.moc_id})"


class AnhNoiDung(models.Model):
    """Ảnh **nhúng thẳng trong `Moc.body`** — khối "BỔ SUNG" của
    `plans/2026-08-24-tiptap-html.md`.

    Khác `MocAnh` ở đúng một chỗ, và chỗ đó quyết định cả bảng: **nó không thuộc mốc
    nào**. Người ta upload trong lúc còn đang soạn, tức trước khi `Moc` tồn tại — đó
    chính là thứ chặn `POST /mocs/{id}/anh` không dùng lại được (nó đòi `moc_id` đã có).
    Sau khi đăng, mối liên hệ duy nhất giữa ảnh và mốc là chuỗi `<img src>` nằm trong
    `body`; không có FK nào, và **cố ý không có**: `body` sửa được, một tấm ảnh gỡ khỏi
    bài rồi dán lại vào bài khác vẫn là cùng một file.

    Hai việc bảng này làm, và cả hai đều không làm được nếu không có nó:

    1. **Đếm hạn mức** — `core/han_muc.py::dem_anh_noi_dung_trong_ngay_vn` đếm hàng ở
       đây, cùng cơ chế với 10 mạch/ngày. Không có bảng thì hạn mức phải dựng một bộ
       đếm thứ hai (cache), và docstring `core/han_muc.py` đã nói vì sao cache sai:
       `LocMemCache` riêng cho từng worker.
    2. **Whitelist khi dọn mồ côi** — ảnh nội dung dùng CHUNG thư mục `anh/` +
       `anh-thumb/` với ảnh mốc và avatar nhưng không có hàng `MocAnh` nào trỏ tới, nên
       `don_anh_mo_coi` sẽ xoá sạch chúng sau 24 giờ và mọi bài viết thủng lỗ. Whitelist
       nằm ở chính lệnh dọn, y như lượt avatar.

    ⚠ **Nợ có tên: ảnh tải lên rồi BỎ bài không bao giờ được thu hồi.** Hàng ở đây làm
    file thành "hợp lệ" vĩnh viễn, kể cả khi khoá của nó chưa từng xuất hiện trong `body`
    nào. Thu hồi đúng cách là quét mọi `Moc.body` tìm khoá — một lượt quét toàn bảng mà
    lệnh dọn hôm nay không làm, và làm nửa vời thì nó xoá nhầm ảnh của bài đang soạn dở.
    Hạn mức ngày là thứ giữ cho khoản nợ này không phình: nó chặn trần số file mỗi người
    tạo ra được mỗi ngày.

    **Không có kho cách ly** (`da_cach_ly` như `MocAnh`): ảnh nội dung đi theo `body`, mà
    mốc bị mod ẩn thì cả `body` không hiện — không có URL nào rò ra từ một bài đã ẩn trừ
    khi ai đó đã sao chép sẵn URL ảnh. Cách ly được vế đó đòi một đường đi ngược từ ảnh
    về mốc, tức đúng cái FK mà bảng này cố ý không có. Ghi ra để lượt sau biết đây là một
    lựa chọn, không phải một chỗ quên.
    """

    nguoi_tai = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="anh_noi_dung",
    )
    #: Tên file ngẫu nhiên + đuôi suy từ định dạng đã nhận dạng — `core/anh_luu.py::khoa_moi`.
    #: `unique` vì nó là khoá whitelist của `don_anh_mo_coi`: hai hàng cùng khoá nghĩa là
    #: xoá một hàng mà file vẫn "hợp lệ" nhờ hàng kia — một trạng thái không ai đọc ra được.
    khoa_luu_tru = models.CharField(max_length=255, unique=True)
    #: Kích thước ảnh **đã tái mã hoá**, trả về cho editor đặt tỉ lệ khung chống layout
    #: shift. Không ghi vào `<img>` (allowlist không có `width`/`height` — CSS lo).
    w = models.PositiveIntegerField(null=True, blank=True)
    h = models.PositiveIntegerField(null=True, blank=True)
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        verbose_name = "ảnh nội dung"
        verbose_name_plural = "ảnh nội dung"
        ordering = ["-created_at", "-id"]
        indexes = [
            # Đúng hình dạng câu hỏi của hạn mức: "user X đã tải mấy tấm trong khoảng
            # thời gian này". Không có index thì mỗi lượt upload quét cả bảng.
            models.Index(
                fields=["nguoi_tai", "created_at"], name="anhnd_nguoi_ngay_idx"
            ),
        ]

    def __str__(self) -> str:
        return f"ảnh nội dung {self.khoa_luu_tru} (của {self.nguoi_tai_id})"
