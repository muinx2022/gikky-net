"""`Mach.loai_mach` (nhật ký / bài viết) + `User.la_tai_khoan_doi` + backfill.

`plans/2026-11-10-truong-loai-mach.md` §2.8. Ba bước, thứ tự có nghĩa:

1. `AddField` hai cột — `loai_mach` mặc định `nhat_ky`, nên MỌI hàng cũ có nhãn hợp lệ
   ngay lúc cột ra đời; `la_tai_khoan_doi` mặc định `False`.
2. `AddConstraint` CHECK trước `RunPython`: `ALTER TABLE` sau khi đã `UPDATE` trong cùng
   transaction có thể vấp "pending trigger events" của Postgres; làm ALTER xong rồi mới
   cập nhật dữ liệu thì không.
3. `RunPython` — bật cờ cho hai tài khoản đăng bài và chuyển MỌI mạch của chúng (kể cả
   đang ẩn / hẹn giờ / lưu trữ — không lọc trạng thái) sang `bai_viet`.

Backfill chọn theo **tên tài khoản**. Nếu prod đã đổi `username` của một trong hai trước khi
migrate thì nó trượt im lặng — nên hàm in số hàng đã cập nhật và CẢNH BÁO khi tìm thấy ít
hơn 2 tài khoản mà bảng Mach đã có hàng (kể cả 0/2). DB trống thì im lặng.
"""

from django.db import migrations, models

#: Chép tay, không import từ `tao_tai_khoan_doi`: migration là ảnh chụp tại thời điểm viết,
#: mà module kia có thể đổi. `tests/test_loai_mach_backfill.py` ghim hai tập bằng nhau.
TAI_KHOAN_DOI_DANG_BAI = ("gikky-team-news", "gikky-team-member")


def backfill_loai_mach(apps, schema_editor):
    """Idempotent: chạy lần hai không đổi hàng nào. Trả `(số tài khoản, số mạch)` đã đổi.

    Hàm thường (không lồng) để test gọi trực tiếp với `django.apps.apps`. Đếm hàng thật sự
    ĐỔI (lọc bỏ hàng đã đúng nhãn) nên lần hai ra `(0, 0)`.
    """
    User = apps.get_model("core", "User")
    Mach = apps.get_model("core", "Mach")

    tim_thay = User.objects.filter(username__in=TAI_KHOAN_DOI_DANG_BAI).count()
    so_tai_khoan = (
        User.objects.filter(username__in=TAI_KHOAN_DOI_DANG_BAI)
        .exclude(la_tai_khoan_doi=True)
        .update(la_tai_khoan_doi=True)
    )
    so_mach = (
        Mach.objects.filter(author__username__in=TAI_KHOAN_DOI_DANG_BAI)
        .exclude(loai_mach="bai_viet")
        .update(loai_mach="bai_viet")
    )

    if so_tai_khoan or so_mach:
        print(
            f"\n  [0045] bật cờ đội cho {so_tai_khoan} tài khoản, "
            f"chuyển {so_mach} mạch sang bai_viet."
        )
    # Cảnh báo khi thiếu tài khoản (kể cả 0/2) NHƯNG bảng `Mach` đã có hàng: DB trống / DB
    # test thì thiếu tài khoản là chuyện bình thường nên im lặng. Prod đổi username trước
    # khi migrate sẽ rơi vào đây thay vì trượt âm thầm (mục 9.5 của plan).
    if tim_thay < len(TAI_KHOAN_DOI_DANG_BAI) and Mach.objects.exists():
        print(
            f"\n  [0045] CẢNH BÁO: chỉ tìm thấy {tim_thay}/{len(TAI_KHOAN_DOI_DANG_BAI)} "
            f"tài khoản {TAI_KHOAN_DOI_DANG_BAI} — username có bị đổi không?"
        )
    return so_tai_khoan, so_mach


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0044_luotxem_luotxem_khach_duong_luc"),
    ]

    operations = [
        migrations.AddField(
            model_name="mach",
            name="loai_mach",
            field=models.CharField(
                choices=[
                    ("nhat_ky", "Nhật ký"),
                    ("bai_viet", "Bài viết"),
                    ("thao_luan", "Chủ đề thảo luận"),
                ],
                default="nhat_ky",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="user",
            name="la_tai_khoan_doi",
            field=models.BooleanField(default=False),
        ),
        migrations.AddConstraint(
            model_name="mach",
            constraint=models.CheckConstraint(
                condition=models.Q(("loai_mach__in", ["nhat_ky", "bai_viet", "thao_luan"])),
                name="mach_loai_mach_hop_le",
            ),
        ),
        # Chiều ngược là no-op: `RemoveField` xoá cả hai cột nên không còn gì để hoàn lại.
        migrations.RunPython(backfill_loai_mach, migrations.RunPython.noop),
    ]
