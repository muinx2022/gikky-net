"""Tiptap — `Moc.body` từ markdown sang HTML (`plans/2026-08-24-tiptap-html.md`).

Hai bước, và **bước hai là bước bắt buộc**:

1. `AddField body_dinh_dang` với `default="markdown"` — mọi hàng cũ được đánh đúng nhãn
   của nó ngay lúc cột ra đời.
2. `RunPython` chuyển **mọi** `Moc.body` markdown sang HTML rồi đổi nhãn thành `"html"`.

Bỏ bước hai thì cột mới đúng và dữ liệu sai: frontend nay render `body` theo `body_dinh_dang`,
nên mọi bài cũ sẽ đi đường markdown mãi mãi và bài mới đi đường HTML — hai đường render
song song trên cùng một trang, và không có gì đỏ.

**Bình luận KHÔNG bị đụng.** `Comment.body` giữ markdown theo chốt của plan (composer khán
đài là ô gõ nhanh, không nhét WYSIWYG vào). `MocRevision.body` cũng không bị đụng — xem
"nợ có tên" ở cuối docstring này.

## Idempotent, và vì sao nó không dựa vào việc đọc nội dung

Bộ lọc là `body_dinh_dang="markdown"`, và nhãn được ghi trong **cùng câu `UPDATE`** với
`body`. Chạy lại ⇒ không còn hàng nào khớp ⇒ no-op. Đoán bằng nội dung ("chuỗi này có
`<p>` chưa?") thì hỏng đúng ở bài mà người dùng gõ nguyên văn `<p>`, mà đây là site nói
về "giá < 27.80" mỗi ngày.

## `reverse` là no-op CÓ CHỦ ĐÍCH, không phải bỏ sót

Không có phép dịch HTML → markdown nào không mất dữ liệu (`<h2>`, `<pre>`, `<u>` không có
ký hiệu markdown nào trong tập con cũ), nên một hàm lùi "gần đúng" sẽ **phá nội dung
người dùng** để đổi lấy cảm giác đối xứng. `RemoveField` của bước 1 xoá luôn cột khi
`migrate core 0013`, còn `body` ở lại dạng HTML — và HTML đó vẫn đọc được bằng mắt.
Đường lùi thật là restore từ bản sao lưu.

⚠ **Hệ quả phải nói trước, đã ĐO chứ không phải suy** (2026-08-24, DB seed 16 mốc):
`migrate core 0013` rồi `migrate core 0014` lần nữa sẽ **dịch hai lần**. Lùi xoá cột,
nên lượt tiến sau đó thấy mọi hàng đeo nhãn `markdown` trong khi `body` đã là HTML —
`<p>Vào HPG…` thành `<p>&lt;p&gt;Vào HPG…`. Bất biến idempotent ở trên bảo vệ lượt chạy
LẶP LẠI của cùng một lượt migrate (tiến trình bị giết giữa chừng), **không** bảo vệ chu
trình lùi-rồi-tiến. Lỡ tay thì restore, đừng chạy tiếp.

## Nợ có tên: `MocRevision.body`

Bản cũ của mốc (`MocRevision`, hiện ở `ban-cu-moc`) **vẫn là markdown** và không có cột
định dạng nào để phân biệt. Sau đợt này, nếu frontend render bản cũ bằng cùng đường với
`Moc.body` (nhúng HTML) thì nguyên văn markdown cũ — thứ CHƯA từng đi qua `lam_sach` vì
nó chưa bao giờ cần — sẽ được nhúng thẳng. Đây là điểm phải quyết ở phiên chính, không
phải thứ migration này được tự mở rộng phạm vi để chữa.
"""

from django.db import migrations, models

from core.lam_sach_html import DINH_DANG_BODY, DINH_DANG_MARKDOWN
from core.markdown_sang_html import chuyen_moc_sang_html


def _sang_html(apps, schema_editor):
    """Chuyển mọi mốc markdown sang HTML. Luật dịch nằm ở `core/markdown_sang_html.py`.

    Import từ `core/` thay vì chép hàm vào đây là đánh đổi có ý thức: 7 cấu trúc markdown
    cũ cần **bài đo**, và một hàm chôn trong file tên `0014_*.py` thì hoặc không ai đo,
    hoặc phải `importlib` một module có tên bắt đầu bằng số. Cái giá là module kia phải
    ĐÓNG BĂNG — docstring của nó nói thế.
    """
    chuyen_moc_sang_html(apps.get_model("core", "Moc"))


def _lui(apps, schema_editor):
    """No-op có chủ đích — xem docstring module ("`reverse` là no-op CÓ CHỦ ĐÍCH")."""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0013_user_avatar_khoa'),
    ]

    operations = [
        migrations.AddField(
            model_name='moc',
            name='body_dinh_dang',
            field=models.CharField(choices=DINH_DANG_BODY, default=DINH_DANG_MARKDOWN, max_length=16),
        ),
        migrations.RunPython(_sang_html, _lui),
    ]
