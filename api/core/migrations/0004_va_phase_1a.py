"""Đợt vá Phase 1a sau phản biện — `plans/2026-08-21-phase-1a-va.md`.

Sáu thao tác, bốn lý do; lý do đầy đủ nằm trong docstring của từng model, đây chỉ tóm
tắt để người đọc `git log` biết vì sao có migration này:

- **`comment.path` → `COLLATE "C"` (W2).** Postgres chỉ biến `LIKE 'tiền tố%'` thành
  điều kiện index khi cột có collation `C`. Đo bằng `EXPLAIN` trên DB dev (`datcollate =
  English_United Kingdom.1252`): trước khi đổi, truy vấn gom subtree rơi xuống `Filter:`
  ngay cả khi đã tắt `enable_seqscan` lẫn `enable_bitmapscan`. Bảng đang có 24 hàng nên
  hôm nay giá bằng 0; ở Phase 3 thì không. Đổi collation buộc Postgres **dựng lại**
  b-tree của `UNIQUE (mach, path)` — đó là công việc nặng duy nhất trong file này, và nó
  rẻ đúng vì làm bây giờ.
- **`trich.comment` → `PROTECT` (W1).** Dưới `CASCADE`, xoá một bình luận đã được trích
  (PLAN 5.3 cho phép xoá thật) xoá luôn hàng `Trich` — "cuốn sổ không-xoá-được" của PLAN
  5.6 xoá được, không exception, không audit.
- **`CHECK (seq >= 1)` / `CHECK (anchor_moc_seq IS NULL OR >= 1)` (W8).**
  `PositiveIntegerField` chỉ cho `>= 0`, còn PLAN đánh số mốc 1..n.
- **`mach.slug` bỏ index (W10)** và **`mocrevision.figures` gắn validator (W9).** Cái
  đầu gỡ hai b-tree không truy vấn nào dùng; cái sau không đổi gì ở tầng DB (validator
  của Django là chuyện của `full_clean`), nên nó ở đây chỉ để `makemigrations --check`
  sạch.

**Ràng buộc mới trên dữ liệu đang có:** cả hai `CHECK` đều được Postgres kiểm ngay lúc
`ALTER TABLE`. Nếu DB nào đó đã có hàng `seq = 0` thì migration này NỔ — đúng ý muốn,
vì hàng đó là dữ liệu sai chứ không phải ca hợp lệ cần chiều.
"""

import core.models.moc
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0003_mach_sequence_khoi_diem_1000'),
    ]

    operations = [
        migrations.AlterField(
            model_name='comment',
            name='path',
            field=models.CharField(db_collation='C', max_length=255),
        ),
        migrations.AlterField(
            model_name='mach',
            name='slug',
            field=models.SlugField(blank=True, db_index=False, max_length=60),
        ),
        migrations.AlterField(
            model_name='mocrevision',
            name='figures',
            field=models.JSONField(blank=True, null=True, validators=[core.models.moc.kiem_figures]),
        ),
        migrations.AlterField(
            model_name='trich',
            name='comment',
            field=models.ForeignKey(on_delete=django.db.models.deletion.PROTECT, related_name='trichs', to='core.comment'),
        ),
        migrations.AddConstraint(
            model_name='comment',
            constraint=models.CheckConstraint(condition=models.Q(('anchor_moc_seq__isnull', True), ('anchor_moc_seq__gte', 1), _connector='OR'), name='comment_anchor_tu_1'),
        ),
        migrations.AddConstraint(
            model_name='moc',
            constraint=models.CheckConstraint(condition=models.Q(('seq__gte', 1)), name='moc_seq_tu_1'),
        ),
    ]
