"""`Mach.published_at` — ngày ĐĂNG, tách khỏi `created_at` (ngày VIẾT).

`plans/2026-09-03-hen-gio-phat-hanh.md` §1.2. Ba bước trong MỘT migration vì chúng phải
đi cùng nhau hoặc không đi:

1. thêm cột **nullable** — `ALTER TABLE ... ADD COLUMN` không khoá bảng lâu khi cột cho
   phép NULL và không có default ghi đè từng hàng;
2. `UPDATE ... SET published_at = created_at` — mọi bài có trước lượt này *đã* phát hành
   đúng lúc nó ra đời, nên backfill là phép đồng nhất chứ không phải phỏng đoán;
3. siết `NOT NULL` + `default`.

Tách làm ba migration thì có một cửa sổ thật (giữa 1 và 2, hoặc giữa 2 và 3) mà cột nửa
rỗng đi qua tay code sản phẩm: feed sắp theo `published_at` gặp NULL sẽ đẩy bài lên đỉnh
vĩnh viễn — đúng cái bẫy `Mach.last_entry_at` đã ghi trong docstring model.

`CheckConstraint` xuống **sau cùng**: nó đọc `published_at`, nên thêm trước bước 2 là
kiểm một cột còn NULL.
"""

from django.db import migrations, models
from django.db.models import F
from django.utils import timezone


def _backfill_published_at(apps, schema_editor):
    """`published_at = created_at` cho mọi hàng đang có.

    `update()` với `F("created_at")` — MỘT câu SQL cho cả bảng, không nạp hàng nào vào
    Python. Bảng này có thể vài trăm nghìn hàng trên prod và một vòng `for m in Mach…`
    ở đây là một migration chạy hàng phút với bảng đang bị khoá.
    """
    Mach = apps.get_model("core", "Mach")
    Mach.objects.filter(published_at__isnull=True).update(published_at=F("created_at"))


def _lui(apps, schema_editor):
    """Chiều NGƯỢC: không có gì để hoàn.

    Bước sau đó (`RemoveField` khi Django lùi qua `AddField`) xoá hẳn cột, nên mọi giá trị
    vừa ghi biến mất cùng nó. Hàm này tồn tại để migration **lùi được** — `RunPython`
    không có `reverse_code` sẽ chặn `migrate core 0026`, và tiêu chí #1 của plan đo đúng
    lượt lùi đó.
    """


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0026_luotxem_da_dang_nhap"),
    ]

    operations = [
        migrations.AddField(
            model_name="mach",
            name="published_at",
            field=models.DateTimeField(null=True),
        ),
        migrations.RunPython(_backfill_published_at, _lui),
        migrations.AlterField(
            model_name="mach",
            name="published_at",
            field=models.DateTimeField(default=timezone.now),
        ),
        migrations.AddIndex(
            model_name="mach",
            index=models.Index(
                fields=["author", "-published_at"], name="mach_author_published"
            ),
        ),
        migrations.AddIndex(
            model_name="mach",
            index=models.Index(fields=["-published_at"], name="mach_published_desc"),
        ),
        migrations.AddConstraint(
            model_name="mach",
            constraint=models.CheckConstraint(
                condition=models.Q(hidden_at__isnull=True)
                | models.Q(hidden_by__isnull=False)
                | models.Q(published_at__gt=models.F("created_at")),
                name="mach_an_phai_co_nguoi_an_hoac_hen_gio",
            ),
        ),
    ]
