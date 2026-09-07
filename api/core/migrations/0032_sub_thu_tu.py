# Generated manually — `plans/2026-09-07-sap-xep-chuyen-muc-drag-drop.md` mục 1.
# `Sub.thu_tu` cho admin kéo thả đổi thứ tự chuyên mục; sidebar công khai đọc theo
# `order_by("thu_tu", "slug")`.

from django.db import migrations, models


def backfill_thu_tu(apps, schema_editor):
    """Gán `0,1,2,…` theo `slug` hiện có.

    Không bắt buộc để `order_by("thu_tu", "slug")` ra alphabet (bảng toàn `0` + phá hoà
    `slug` cũng đủ). Backfill để `POST /subs` gán `max+1` có ý nghĩa ngay từ đầu: sub
    mới đứng sau dãy đã đánh số, không chen vào nhóm mặc định `0` rồi chỉ thắng/thua
    theo alphabet với các hàng seed/create trần.
    """
    Sub = apps.get_model("core", "Sub")
    for i, sub in enumerate(Sub.objects.order_by("slug")):
        Sub.objects.filter(pk=sub.pk).update(thu_tu=i)


def khong_lam_gi(apps, schema_editor):
    """Migrate lùi: `RemoveField` xoá luôn cột, không có gì phải hoàn."""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0031_mach_tat_binh_luan'),
    ]

    operations = [
        migrations.AddField(
            model_name='sub',
            name='thu_tu',
            field=models.PositiveIntegerField(default=0),
        ),
        migrations.RunPython(backfill_thu_tu, khong_lam_gi),
    ]
