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
        # Đổi từ `0007` sang `0009` lúc GỘP: Phase 5 làm song song trong worktree nên
        # nó đánh số 0008, trùng với `0008_phase6_han_muc_dang_ky_ip` của lượt vá V1.
        # Hai bên chạm model khác hẳn nhau (MocAnh/Moc vs User/Report) nên xếp tuyến
        # tính được — sạch hơn một migration `--merge` không làm gì.
        ("core", "0009_phase4_bao_cao_mot_lan_moi_dich"),
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
