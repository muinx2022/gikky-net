"""Phase 5 — ảnh lưu LOCAL: đổi tên khoá lưu trữ, bỏ `thumb_key`, thêm `da_cach_ly`.

`RenameField` chứ không xoá-rồi-thêm: Postgres đổi tên cột tại chỗ, giữ nguyên dữ liệu.
Bảng đang rỗng ở mọi môi trường (Phase 1a chỉ dựng bảng, chưa cửa nào ghi vào nó), nên
hai lối cho cùng kết quả hôm nay — nhưng chỉ một lối còn đúng nếu ai đó đã seed tay.

`thumb_key` bỏ hẳn: ảnh chính và thumbnail nay dùng CHUNG một khoá, khác thư mục
(`core/anh_luu.py`). Hai cột khoá độc lập chỉ tạo cơ hội cho chúng lệch nhau, mà không
cửa nào cần chúng khác nhau.
"""

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0007_user_nhan_digest"),
    ]

    operations = [
        migrations.RenameField(
            model_name="mocanh",
            old_name="r2_key",
            new_name="khoa_luu_tru",
        ),
        migrations.RemoveField(
            model_name="mocanh",
            name="thumb_key",
        ),
        migrations.AddField(
            model_name="mocanh",
            name="da_cach_ly",
            field=models.BooleanField(default=False),
        ),
    ]
