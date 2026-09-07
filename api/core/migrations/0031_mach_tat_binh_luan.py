# Generated manually — `plans/2026-09-07-tat-mo-binh-luan.md`:
# Cho phép tác giả tắt hoặc mở lại bình luận của mạch (khi không bị mod khoá).

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0030_mach_lan_dau_len_song'),
    ]

    operations = [
        migrations.AddField(
            model_name='mach',
            name='tat_binh_luan',
            field=models.BooleanField(default=False),
        ),
    ]
