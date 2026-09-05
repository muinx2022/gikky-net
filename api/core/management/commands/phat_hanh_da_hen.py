"""Phát hành mọi bài **đã tới giờ hẹn** — `plans/2026-09-03-hen-gio-phat-hanh.md` §1.5.

Chạy bằng cron `*/5 * * * *` trên VPS (cùng mẫu hai job có sẵn, xem
`deploy/prod/README.md`). Độ trễ chấp nhận được: ≤ 5 phút sau giờ hẹn.

## Bài "đã tới giờ hẹn" là gì

    hidden_at IS NOT NULL  AND  hidden_by IS NULL  AND  published_at <= now()

Ba vế, và vế giữa là vế quan trọng nhất: **`hidden_by IS NULL` ⇔ ẩn vì hẹn giờ**. Bài mod
gỡ luôn có người gỡ (`core/ghi.py::dat_an_mach` luôn nhận `boi`), nên lệnh này không bao
giờ gỡ ẩn hộ một quyết định kiểm duyệt. Bất biến ấy được `CheckConstraint`
`mach_an_phai_co_nguoi_an_hoac_hen_gio` giữ ở tầng DB, không phải ở đây.

## Vì sao MỖI MẠCH một transaction

Không phải để "an toàn hơn": 200 bài lên cùng một giờ trong **một** transaction nghĩa là
200 hàng `Mach` bị khoá suốt lượt chạy, và một bài lỗi cuốn theo 199 bài kia. Mỗi mạch một
`atomic()` thì lượt chạy hỏng giữa chừng vẫn để lại những bài đã phát hành ở trạng thái
đúng — lượt cron sau nhặt nốt phần còn lại.

## `SKIP LOCKED` — hai lượt cron chồng nhau

Lượt trước chạy quá 5 phút thì lượt sau khởi động khi lượt trước còn đang chạy. Không có
`SKIP LOCKED`, lượt sau **chờ** đúng những hàng lượt trước đang giữ rồi phát hành lại —
tức hai thông báo cho một bài (plan §7 rủi ro 4). Có nó, lượt sau bỏ qua và đi tiếp.

Hàng rào thứ hai nằm ngay trong bộ lọc dưới khoá (`hidden_at IS NOT NULL`): nếu lượt
trước đã commit xong thì hàng không còn khớp, nên `phat_hanh_mach` trả `None`. Cần cả
hai — `SKIP LOCKED` một mình chỉ che cửa sổ "đang chạy", không che cửa sổ "vừa xong".

## Không nuốt lỗi

Một mạch nổ ⇒ lệnh nổ, exit ≠ 0, cron gửi mail. Đây là lượt chạy nền không ai nhìn: nuốt
lỗi rồi in "0 bài" là cách bài hẹn giờ chết im lặng hàng tuần. Đối soát ở `deploy/prod/
README.md` (số bài quá hạn > 15 phút phải bằng 0) là lưới thứ hai, không phải lưới đầu.
"""

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.ghi import phat_hanh_mach
from core.models.dien_dan import Mach


class Command(BaseCommand):
    help = "Phát hành mọi mạch đã tới giờ hẹn (hidden_by NULL, published_at <= now)."

    def handle(self, *args, **tuy_chon):
        bay_gio = timezone.now()
        # Quét ids NGOÀI khoá, rồi khoá lại từng hàng một. Giữ `FOR UPDATE SKIP LOCKED`
        # trên cả tập ngay từ câu quét thì khoá ấy phải sống tới hết lượt chạy, tức lại
        # là một transaction ôm cả 200 bài — đúng thứ docstring trên vừa loại. Danh sách
        # ids có thể ôi (một bài vừa được mod gỡ, một bài vừa bị lượt cron khác lấy);
        # `phat_hanh_mach` kiểm lại đủ ba vế DƯỚI khoá và trả `None`, nên ôi là vô hại.
        ids = list(
            Mach.objects.filter(
                hidden_at__isnull=False,
                hidden_by__isnull=True,
                published_at__lte=bay_gio,
            )
            .order_by("published_at", "pk")
            .values_list("pk", flat=True)
        )

        da_phat_hanh = 0
        for mach_id in ids:
            if phat_hanh_mach(mach_id=mach_id, bo_qua_neu_ban=True) is not None:
                da_phat_hanh += 1

        # In con số kể cả khi bằng 0: cron ghi stdout vào log, và một dòng "0 bài" là bằng
        # chứng lệnh CÓ chạy. Không có dòng nào thì "cron chết" và "không có bài nào tới
        # hạn" trông y hệt nhau.
        self.stdout.write(f"Đã phát hành {da_phat_hanh} bài.")
