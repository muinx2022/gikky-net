"""Phase 1d — `Mach.diem_bai_goc` + index của sort "Nhiều điểm nhất".

**Chỉ MỘT index, không phải hai** *(sửa tại chỗ ở W10, lượt vá 2)*. Bản đầu còn thêm
`mach_created_diem` trên `(-created_at, -diem_bai_goc)`; nó bị bỏ vì đo ra là **vô ích
tuyệt đối**, xem chú thích `Meta.indexes` của `core/models/dien_dan.py`.

⚠ **Sửa tại chỗ là chuyện của GIT, không phải của DB** *(X10, lượt vá 3)*. Câu cũ ở đây
viết "chưa commit nên không cần `0006`" — đúng về git và **im lặng về cái đáng lo**: bất
kỳ DB nào đã chạy bản `0005` CŨ vẫn còn index `mach_created_diem`, và Django sẽ không
bao giờ dọn nó, vì `makemigrations` so model với **file migration**, không so với DB. Nó
không hiện ra ở `showmigrations` (cùng tên `0005`, đã đánh dấu applied), không hiện ở
`migrate --check`, và một index thừa thì không làm gì đỏ — chỉ chậm mỗi lần ghi `Mach`.
Đã kiểm `gikky_dev` ngày 2026-08-22: **không còn** index đó, nên ở đây không có ảnh hưởng
thật. Máy nào lỡ chạy bản cũ thì `DROP INDEX IF EXISTS mach_created_diem;` bằng tay, hoặc
dựng lại DB — đừng viết `0006` chỉ để xoá nó, vì trên DB sạch `0006` ấy là một no-op mãi
mãi nằm trong lịch sử.

**Có bước nạp lại dữ liệu, và nó bắt buộc.** `AddField(default=0)` cho MỌI hàng cũ điểm
`0`, tức trên bất kỳ DB nào đã có nội dung (máy dev, và prod khi tới lượt) feed
`?sort=nhieu_diem` sẽ sắp theo một cột toàn số không: thứ tự ra bừa, HTTP 200, không có
gì đỏ. `apps/web/e2e/dung-seed.ts` gọi `seed_dev` **không kèm `--reset`**, nên trông chờ
seed dựng lại là trông chờ vào một thứ không xảy ra.

Bước nạp lại chép đúng luật của `core/ghi.py::_diem_bai_goc` (điểm mốc 1; bia mộ hoặc mốc
bị mod ẩn ⇒ 0) — migration không được import hàm đó vì nó chạy trên model lịch sử, nhưng
`tests/test_denormalize.py` ghim hai bên nói cùng một chuyện.
"""

from django.db import migrations, models


def _nap_lai(apps, schema_editor):
    Mach = apps.get_model("core", "Mach")
    Moc = apps.get_model("core", "Moc")
    diem = {
        m.mach_id: m.score
        for m in Moc.objects.filter(
            seq=1, deleted_at__isnull=True, hidden_at__isnull=True
        ).only("mach_id", "score")
    }
    for mach in Mach.objects.only("pk", "diem_bai_goc").iterator():
        moi = diem.get(mach.pk, 0)
        if mach.diem_bai_goc != moi:
            mach.diem_bai_goc = moi
            mach.save(update_fields=["diem_bai_goc"])


def _lui(apps, schema_editor):
    """Không có gì để hoàn tác: `RemoveField` ở bước sau xoá luôn cả cột."""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0004_va_phase_1a'),
    ]

    operations = [
        migrations.AddField(
            model_name='mach',
            name='diem_bai_goc',
            field=models.IntegerField(default=0),
        ),
        migrations.RunPython(_nap_lai, _lui),
        migrations.AddIndex(
            model_name='mach',
            index=models.Index(fields=['-diem_bai_goc', '-id'], name='mach_diem_desc'),
        ),
    ]
