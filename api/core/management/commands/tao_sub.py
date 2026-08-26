"""Dựng / cập nhật **một chuyên mục** từ dòng lệnh — idempotent.

## Vì sao cần một lệnh, khi `Sub` đã tạo được qua Django admin

`Sub` v1 "chỉ tạo tay qua admin" (docstring `core/models/dien_dan.py`), và điều đó đúng
cho tới lúc chuyên mục phải mọc lên trên **prod** như một bước của quy trình triển khai.
Bot bản tin (`scripts/dang-tin.mjs`) đăng vào `s/tin-tuc`; thiếu hàng đó thì
`POST /api/v1/machs` trả 404 `sub_khong_ton_tai` — một lỗi đúng, nhưng nó xuất hiện lúc
06:12 sáng qua một scheduled task không ai ngồi nhìn.

Một bước bấm chuột trong admin không nằm được trong tài liệu triển khai dưới dạng chạy
lại được. Một dòng lệnh thì nằm được:

    docker compose -p gikkynet exec api python manage.py tao_sub tin-tuc --ten "Tin tức"

**Idempotent**: chạy bao nhiêu lần cũng ra đúng một hàng. Cùng lý lẽ với
`tao_tai_khoan_doi.py` — thứ nằm trong tài liệu triển khai phải chạy lại được, vì người
chạy nó thường không nhớ mình đã chạy chưa.

## Vì sao KHÔNG `update_or_create(defaults=…)` thẳng

`defaults` ghi đè **mọi** trường trong nó, kể cả trường người gọi không truyền. Tức
`tao_sub tin-tuc` (không `--mo-ta`) chạy lần hai sẽ **xoá trắng** phần mô tả mà ai đó vừa
soạn trong admin — mất dữ liệu âm thầm, đúng loài mà một lệnh "idempotent" hay sinh ra.

Nên: trường **không truyền** thì không đụng tới. Lúc TẠO mới cần giá trị mặc định
(`ten` = slug, `mo_ta` = rỗng), vì hai cột ấy `NOT NULL`.
"""

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.core.validators import validate_slug

from core.models import Sub

#: Trần của `Sub.slug` / `Sub.ten` — khai lại ở đây thì lệnh báo lỗi đọc được thay vì để
#: Postgres ném `value too long for type character varying(40)` lên mặt người triển khai.
#: Hai con số phải KHỚP `core/models/dien_dan.py::Sub`.
DAI_SLUG = 40
DAI_TEN = 80


class Command(BaseCommand):
    help = "Tạo/cập nhật một chuyên mục (Sub). Chạy lại bao nhiêu lần cũng ra một hàng."

    def add_arguments(self, parser):
        parser.add_argument("slug", help="slug của chuyên mục, vd: tin-tuc")
        # `default=None` chứ không `""`: lệnh phải phân biệt được "không truyền" (giữ
        # nguyên) với "truyền chuỗi rỗng" (xoá mô tả) — xem docstring module.
        parser.add_argument(
            "--ten", default=None, help="tên hiển thị. Bỏ trống khi tạo mới ⇒ lấy slug."
        )
        parser.add_argument("--mo-ta", default=None, help="mô tả ngắn của chuyên mục.")

    def handle(self, *args, **options):
        slug = options["slug"].strip()
        ten = options["ten"]
        mo_ta = options["mo_ta"]

        if len(slug) > DAI_SLUG:
            raise CommandError(f"Slug dài quá {DAI_SLUG} ký tự: {slug!r}")
        try:
            validate_slug(slug)
        except ValidationError:
            raise CommandError(
                f"Slug {slug!r} không hợp lệ — chỉ chữ/số/gạch ngang/gạch dưới."
            )
        # ⚠ `validate_slug` của Django là `[-a-zA-Z0-9_]+` — nó CHO QUA chữ HOA và gạch
        # dưới. Lệnh này chỉ được gõ tay một lần lúc triển khai, và `tao_sub Tin_Tuc`
        # chạy trót lọt sẽ tạo `s/Tin_Tuc`, rồi bot POST `sub: "tin-tuc"` ăn 404 **mỗi
        # sáng** — một lỗi gõ tay biến thành sự cố định kỳ mà triệu chứng ở tận chỗ khác.
        # Sub của gikky đều là slug thường-gạch-ngang (`chung-khoan`, `crypto`), nên
        # thắt chặt ở đây không mất gì.
        if slug != slug.lower() or "_" in slug:
            raise CommandError(
                f"Slug {slug!r} phải viết thường và dùng gạch NGANG, không gạch dưới "
                f"— ý bạn là {slug.lower().replace('_', '-')!r}?"
            )
        if ten is not None and len(ten) > DAI_TEN:
            raise CommandError(f"Tên dài quá {DAI_TEN} ký tự.")
        # `--ten "   "` tạo một sub không có tên hiển thị. Rẻ để chặn, và chặn ở đây
        # thì `ten` luôn là thứ in ra được.
        if ten is not None and ten.strip() == "":
            raise CommandError("--ten không được rỗng hoặc chỉ có khoảng trắng.")

        sub = Sub.objects.filter(slug=slug).first()
        if sub is None:
            Sub.objects.create(
                slug=slug,
                ten=(ten if ten is not None else slug),
                mo_ta=(mo_ta if mo_ta is not None else ""),
            )
            self.stdout.write(self.style.SUCCESS(f"tạo s/{slug}"))
            return

        cot_doi = []
        if ten is not None and sub.ten != ten:
            sub.ten = ten
            cot_doi.append("ten")
        if mo_ta is not None and sub.mo_ta != mo_ta:
            sub.mo_ta = mo_ta
            cot_doi.append("mo_ta")

        if not cot_doi:
            self.stdout.write(f"không đổi s/{slug}")
            return

        sub.save(update_fields=cot_doi)
        self.stdout.write(self.style.SUCCESS(f"cập nhật s/{slug} ({', '.join(cot_doi)})"))
