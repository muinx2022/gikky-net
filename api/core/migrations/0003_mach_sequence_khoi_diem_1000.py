"""Sequence id của `Mach` bắt đầu từ 1000 — plan con Phase 1a mục 1.

`/m/nhat-ky-lenh-hpg-1` quảng cáo công khai rằng site vừa mở và có đúng một bài. `id`
đi vào URL vĩnh viễn (PLAN 5.9 "id bền"), nên đổi sau ngày ra mắt là gãy permalink + mất
SEO — mà traffic organic vào mặt CẶN chính là giá trị lõi của sản phẩm (PLAN mục 1).
Làm lúc bảng còn rỗng thì giá bằng 0; đó là lý do nó nằm ở migration này chứ không nằm
trong danh sách "sau này tính".

Đây KHÔNG phải mẹo làm đẹp số: nó chỉ dịch điểm khởi đầu, không giả lập lượng bài (bài
thứ hai vẫn là 1001, ai đếm cũng ra). Mục đích là không phát tín hiệu "vắng" ở thứ duy
nhất người ta copy-paste đi khắp nơi.

`pg_get_serial_sequence` thay vì gõ tay `core_mach_id_seq`: tên sequence là quy ước của
Postgres, không phải hợp đồng. `setval(seq, 1000, false)` đặt "giá trị kế tiếp là 1000"
(cờ `is_called = false`), khác `setval(seq, 1000)` — cái đó cho id đầu tiên là 1001.
"""

from django.db import migrations

SQL_DAT = """
SELECT setval(pg_get_serial_sequence('core_mach', 'id'), 1000, false);
"""

SQL_HOAN = """
SELECT setval(pg_get_serial_sequence('core_mach', 'id'), 1, false);
"""


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0002_sub_user_ban_permanent_user_ban_reason_and_more"),
    ]

    operations = [
        migrations.RunSQL(sql=SQL_DAT, reverse_sql=SQL_HOAN),
    ]
