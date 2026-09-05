# Generated manually — `plans/2026-09-05-cua-so-tu-sua-bai.md`, lượt vá phản biện
# thứ hai (mục 2): `moc_bat_dau_tu_sua` dùng thẳng `Mach.published_at` làm mốc bắt đầu
# cửa sổ tự sửa, mà cột đó bị GHI ĐÈ mỗi lần "rút bài xuống, phát hành lại"
# (`core/ghi.py::hen_gio_mach`) — mở lại cửa sổ cho MỌI mốc cũ của mạch mỗi lần admin
# phát hành lại. `Mach.lan_dau_len_song` chỉ ghi đúng MỘT LẦN (xem docstring model).

from django.db import migrations, models


def backfill_lan_dau_len_song(apps, schema_editor):
    """Mọi `Mach` đang HIỂN THỊ (`hidden_at IS NULL`) tại thời điểm chạy migration này
    coi như đã "lên sóng đầu tiên" ở `published_at` hiện có.

    Không có cách nào biết lần lên sóng ĐẦU TIÊN thật của một hàng cũ — nó có thể đã bị
    rút xuống/hẹn lại nhiều lần trước khi cột này tồn tại — nhưng để `NULL` sẽ khiến
    `moc_bat_dau_tu_sua` coi mạch đó là "chưa từng lên sóng" và ngã về `Mach.created_at`.
    Với tuyệt đại đa số dữ liệu cũ (mạch KHÔNG hẹn giờ), `published_at == created_at` nên
    hai lựa chọn trùng nhau; `published_at` chỉ khác `created_at` ở đúng loại hàng mà
    lượt vá này sinh ra để chữa (mạch đã từng bị "rút xuống, hẹn phát hành lại"), và giá
    trị `published_at` hiện có — lần phát hành GẦN NHẤT — là lựa chọn AN TOÀN nhất có
    thể suy ra được: nó không đẩy cửa sổ xa hơn giá trị mà công thức cũ (`max(created_at,
    published_at)`) đã dùng cho tới tận migration này, chỉ khác ở chỗ từ nay nó không bị
    ghi đè tiếp bởi lần phát hành lại KẾ TIẾP.

    `Mach` đang ẨN (`hidden_at IS NOT NULL`, dù mod ẩn hay đang hẹn giờ) giữ `NULL`: mọi
    mốc của một mạch còn ẩn đều 404 ở `api/ghi_chung.py::nap_moc`, nên `PATCH /mocs/{id}`
    chưa bao giờ chạm tới cột này cho tới khi mạch đó thật sự lên sóng qua
    `core/ghi.py::phat_hanh_mach` — hàm đó tự đặt `lan_dau_len_song` đúng lúc.
    """
    Mach = apps.get_model("core", "Mach")
    Mach.objects.filter(hidden_at__isnull=True, lan_dau_len_song__isnull=True).update(
        lan_dau_len_song=models.F("published_at")
    )


def khong_lam_gi(apps, schema_editor):
    """Migrate lùi: không cần xoá dữ liệu backfill — cột bị `RemoveField` là đủ."""


class Migration(migrations.Migration):

    dependencies = [
        ('core', '0029_cua_so_tu_sua_bai'),
    ]

    operations = [
        migrations.AddField(
            model_name='mach',
            name='lan_dau_len_song',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.RunPython(backfill_lan_dau_len_song, khong_lam_gi),
    ]
