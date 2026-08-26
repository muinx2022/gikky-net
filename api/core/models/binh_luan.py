"""`Comment` — PLAN mục 6, nguyên tắc 4/5/6.

MỘT kho bình luận, hai ống kính (khán đài + ngăn kéo). `anchor_moc_seq` để CHIẾU,
không bao giờ để LỌC.
"""

from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models
from django.db.models import F
from django.utils import timezone

DAI_BODY_COMMENT = 10_000

#: Mỗi tầng của materialized path là 6 chữ số zero-pad, nối bằng "." — PLAN mục 6 cho
#: mẫu "000012.000034". `path` là `varchar(255)`, nên số tầng tối đa là
#: (255 + 1) // 7 = 36. Vượt hai giới hạn này thì `core/cay_binh_luan.py` ném
#: `ValidationError` rõ ràng, KHÔNG cắt âm thầm (cắt âm thầm = mất reply).
DAI_SEGMENT_PATH = 6
SO_SIBLING_TOI_DA = 10**DAI_SEGMENT_PATH - 1
DAI_PATH = 255
DO_SAU_TOI_DA = (DAI_PATH + 1) // (DAI_SEGMENT_PATH + 1)


class Comment(models.Model):
    """Một bình luận trong khán đài của mạch.

    **Neo sống ở bình luận GỐC** (PLAN nguyên tắc 6): `anchor_moc_seq` chỉ có nghĩa khi
    `parent IS NULL`; reply đi theo thread gốc bất kể nó được viết lúc mốc nào. Nhờ vậy
    ngăn kéo mốc 2 kể được cả "lời tiên tri lẫn cái kết".

    `anchor_moc_seq = NULL` **không phải là dữ liệu thiếu**: đó là người viết đã gỡ chip,
    bình luận cố ý không thuộc ngăn kéo nào (PLAN nguyên tắc 4). Vì thế nó lưu `seq` —
    một số nguyên trong phạm vi mạch — chứ không phải FK tới `Moc`: mốc bị xoá thành bia
    mộ vẫn giữ `seq`, và ngăn kéo của bia mộ vẫn phải mở được.
    """

    mach = models.ForeignKey(
        "core.Mach", on_delete=models.CASCADE, related_name="comments"
    )
    parent = models.ForeignKey(
        "self", on_delete=models.CASCADE, null=True, blank=True, related_name="replies"
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="comments"
    )
    anchor_moc_seq = models.PositiveIntegerField(null=True, blank=True)

    body = models.TextField(validators=[MaxLengthValidator(DAI_BODY_COMMENT)])
    #: `"markdown"` (mặc định) hoặc `"html"` — user chốt 2026-08-26: ô soạn bình luận có
    #: **công tắc** bật Tiptap, tắt thì vẫn là textarea như cũ.
    #:
    #: ⚠ **Cột này quyết định ĐƯỜNG RENDER, và đường render quyết định an toàn.** Hàng
    #: `html` đã qua `core/lam_sach_html.py::lam_sach` ở phía server trước khi vào DB nên
    #: frontend in lại bằng `dangerouslySetInnerHTML`; hàng `markdown` thì chưa, và nó đi
    #: đường `ThanVan` (JSX, React escape mọi ký tự). Đổi nhãn của một hàng mà không chạy
    #: `lam_sach` là mở đúng lỗ XSS mà cả cơ chế này dựng ra để bịt.
    #:
    #: Mặc định `markdown` là **mặc định AN TOÀN**: quên gán nhãn ở một đường ghi mới thì
    #: HTML hiện ra nguyên văn `<p>` — xấu, nhưng không thực thi. Sai theo chiều an toàn.
    #:
    #: **Không đoán bằng regex.** Người dùng gõ `giá < 27.80` là chuỗi trông như HTML mà
    #: không phải, và đây là site tài chính đầy câu như thế. Cùng lý lẽ `Moc.body_dinh_dang`.
    body_dinh_dang = models.CharField(max_length=8, default="markdown")
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    edited_at = models.DateTimeField(null=True, blank=True)
    #: Xoá mềm. **PLAN 5.3 có HAI điều kiện giữ chỗ "[đã xoá]", không phải một**: có
    #: reply con, **hoặc đã TỪNG được trích vào sổ — kể cả trích đã gỡ**. Xoá thật chỉ
    #: khi không dính cả hai.
    #:
    #: Vế thứ hai là chỗ dễ đọc hụt nhất, và nó có hàng rào ở tầng DB: `Trich.comment`
    #: là `PROTECT` (xem `core.models.tuong_tac.Trich`) — `PROTECT` không biết
    #: `removed_at` là gì, nó chặn mọi hàng `Trich` còn tồn tại. Đọc thành "đang được
    #: trích" là `DELETE /comments/{id}` của Phase 2 sẽ tiền-kiểm `removed_at IS NULL`,
    #: kết luận "chưa trích, xoá thật được", rồi ăn `ProtectedError` → **500 trên một
    #: thao tác hợp lệ của chính chủ**. Bài đo cả hai vế:
    #: `tests/test_rang_buoc_db.py::test_xoa_binh_luan_co_trich_DA_GO_van_bi_chan`.
    deleted_at = models.DateTimeField(null=True, blank=True)

    hidden_at = models.DateTimeField(null=True, blank=True)
    hidden_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="comments_da_an",
    )

    #: BẮT BUỘC tách up/down: wilson cần cả hai vế, `score` một mình không dựng lại được
    #: (+5 là 5-0 hay 105-100? hai thứ đó xếp hạng khác hẳn nhau).
    up_count = models.PositiveIntegerField(default=0)
    down_count = models.PositiveIntegerField(default=0)
    #: Cột SINH RA ở tầng DB (PLAN mục 6: "score suy ra, đừng lưu tay"). Không code nào
    #: — kể cả SQL trần — ghi được vào đây; Postgres từ chối thẳng.
    score = models.GeneratedField(
        expression=F("up_count") - F("down_count"),
        output_field=models.IntegerField(),
        db_persist=True,
    )

    #: Materialized path, vd "000012.000034". Cấp phát qua
    #: `core/cay_binh_luan.py::cap_phat_path` (khoá hàng cha rồi mới cấp).
    #:
    #: **`db_collation="C"` là ràng buộc chức năng, không phải sở thích.** PLAN mục 6:
    #: `path` tồn tại để "gom cả subtree bằng một query" — tức `path LIKE 'tiền tố%'`.
    #: Postgres CHỈ biến `LIKE 'x%'` thành điều kiện index (`path >= 'x' AND path < 'y'`)
    #: khi cột có collation `C` hoặc opclass `*_pattern_ops`. Dưới collation của DB dev
    #: (`English_United Kingdom.1252`) cùng truy vấn đó rơi xuống `Filter:` — đo thật
    #: bằng `EXPLAIN` với `enable_seqscan=off` + `enable_bitmapscan=off` thì vẫn `Filter`,
    #: nên đây không phải chuyện planner "thấy bảng nhỏ nên lười".
    #:
    #: Phụ lợi, và cũng quan trọng: `Max(path)` trong `cap_phat_path` và `ORDER BY path`
    #: (sort `cu_nhat` — PLAN 5.3) hiện phụ thuộc collation của DB. Dev là `1252`, prod
    #: Linux sẽ là `C.UTF-8`/`en_US.UTF-8`. Ghim `C` ở tầng cột thì hai môi trường cho
    #: cùng một thứ tự, bất kể `initdb` chạy với locale nào.
    path = models.CharField(max_length=DAI_PATH, db_collation="C")

    class Meta:
        verbose_name = "bình luận"
        verbose_name_plural = "bình luận"
        constraints = [
            # Chặn race cấp phát path ở tầng DB. Đây là cái chặn THẬT: khoá hàng cha
            # chỉ serialize được các luồng đi qua đúng code của mình.
            models.UniqueConstraint(
                fields=["mach", "path"], name="comment_duy_nhat_path"
            ),
            # `PositiveIntegerField` chỉ cho `CHECK (>= 0)`, mà `seq` của mốc chạy 1..n
            # (PLAN mục 2). `anchor_moc_seq = 0` là một neo trỏ vào mốc không tồn tại:
            # ngăn kéo không mở được, chip `‹mốc 0›` hiện ra vô nghĩa. NULL vẫn hợp lệ —
            # đó là "đã gỡ chip" (PLAN nguyên tắc 4), không phải dữ liệu thiếu.
            models.CheckConstraint(
                condition=models.Q(anchor_moc_seq__isnull=True)
                | models.Q(anchor_moc_seq__gte=1),
                name="comment_anchor_tu_1",
            ),
        ]
        indexes = [
            # Ngăn kéo: các thread GỐC neo vào một mốc (PLAN 5.4 luật 1). Partial vì
            # `anchor_moc_seq` chỉ có nghĩa khi `parent IS NULL`.
            models.Index(
                fields=["mach", "anchor_moc_seq"],
                condition=models.Q(parent__isnull=True),
                name="comment_anchor_goc",
            ),
            # Luật BÃO "user từng bình luận mạch này" (PLAN 5.5).
            models.Index(fields=["mach", "author"], name="comment_mach_author"),
        ]
        # Ghi chú — chốt dứt điểm chuyện PLAN mục 6 liệt kê CẢ `UNIQUE (mach, path)`
        # LẪN `INDEX (mach, path)`: **cố ý chỉ có một cây**, và PLAN mục 6 đã được sửa
        # ngược cho khớp. Ràng buộc unique ở trên tạo b-tree trên đúng `(mach_id, path)`;
        # với `path COLLATE "C"` cây đó phục vụ luôn `LIKE 'tiền tố%'` (đo bằng `EXPLAIN`
        # trong `tests/test_gom_subtree.py`). Một index thường y hệt không mở thêm được
        # truy vấn nào, chỉ thêm một cây phải ghi mỗi lần `INSERT`.

    def __str__(self) -> str:
        return f"comment {self.pk} (mạch {self.mach_id}, path {self.path})"

    @property
    def do_sau(self) -> int:
        """Độ sâu 1-based: bình luận gốc = 1."""
        return self.path.count(".") + 1
