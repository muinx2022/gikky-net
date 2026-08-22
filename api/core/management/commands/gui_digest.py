"""`manage.py gui_digest` — gửi email digest tuần (PLAN 5.8, Phase 6).

    node scripts/py.mjs gui_digest                       # gửi ngay, cửa sổ 7 ngày
    node scripts/py.mjs gui_digest --nhap                # in ra, KHÔNG gửi
    node scripts/py.mjs gui_digest --theo-lich           # chỉ gửi nếu đang 8:00 T7 giờ VN
    node scripts/py.mjs gui_digest --bay-gio 2026-08-22T08:30+07:00   # giả lập đồng hồ

hoặc `pnpm digest` ở gốc repo.

## Trạng thái THẬT trên máy này, nói trước

- **Chưa gửi thật bao giờ.** Máy dev không có SMTP; `EMAIL_URL` để trống ⇒ `EMAIL_BACKEND`
  là `filebased`, tức email được **ghi ra file** trong `api/.mail/` (lối cấu hình của Mảng
  A giữ lại ở lượt gộp 2026-08-23 — xem khối email trong `config/settings.py`).
  Nó đi qua đúng đường `django.core.mail` như bản SMTP, chỉ khác cái ống ở cuối — nên
  "dựng nội dung + giao cho backend" là đã đo được, còn "SMTP nhận và chuyển thư" thì
  **chưa**, và không đo được ở đây.
- **`nguoi_nhan_digest()` hôm nay trả rỗng** (bảng `Follow` là Phase 3 — xem
  `core/digest.py`). Nên lệnh này trên máy này luôn báo *0 email*. Đừng đọc con số đó
  thành "digest chạy tốt": nó nghĩa là không có ai để gửi.

## `--theo-lich` để làm gì

PLAN chốt **8:00 sáng thứ Bảy giờ VN**. Có hai cách cài: một cron chạy đúng lúc đó, hoặc
một cron chạy mỗi giờ và để lệnh tự quyết. Cách thứ hai bền hơn với một máy chủ đặt giờ
UTC — chỗ mà `0 8 * * 6` trong crontab sẽ chạy vào **15:00 giờ VN** mà không ai để ý.
`--theo-lich` cài cách thứ hai, và `--bay-gio` cho phép **giả lập đồng hồ** (đúng cách
nghiệm thu của PLAN mục 10 Phase 6 yêu cầu).
"""

from datetime import datetime

from django.conf import settings
from django.core.mail import EmailMessage, get_connection
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core import digest
from core.digest import SO_NGAY_DIGEST, cua_so, dung_digest, la_gio_gui

# ⚠ `nguoi_nhan_digest` gọi qua **module** (`digest.nguoi_nhan_digest()`), KHÔNG
# `from … import nguoi_nhan_digest`. Bản `from … import` chụp lấy object hàm ngay lúc
# import, nên bài đo thay nó bằng `monkeypatch.setattr(core.digest, …)` **không có tác
# dụng** — lệnh vẫn gọi bản gốc, vẫn trả rỗng, và bài đo "gửi thật" xanh một cách rỗng
# tuếch (nó chỉ khẳng định `mail.outbox` trống, đúng cả khi mọi thứ hỏng).
# Đây cũng là cách Phase 3 thay được nguồn dữ liệu mà không phải sửa file này.

#: Origin công khai dùng để dựng link trong thư. Cùng vai với `SITE_ORIGIN` của
#: `apps/web/lib/site.ts`; đọc từ settings để prod đổi được mà không sửa code.
GOC_SITE_MAC_DINH = "https://gikky.net"

#: Tên settings mang origin công khai, theo thứ tự ưu tiên.
#:
#: **Hai tên là có chủ đích, không phải do dùng dằng.** Mảng A (Phase 2) khai
#: `FRONTEND_ORIGIN` cho link trong email xác thực; Mảng D khai `SITE_ORIGIN` cho link
#: trong digest. Cùng một giá trị, hai tên, hai nhánh làm song song. Đọc theo danh sách
#: thì lệnh này chạy đúng ở **cả hai** nhánh và ở nhánh đã gộp, dù bên nào thắng — thay
#: vì hỏng ngay lúc gộp với một `AttributeError`.
TEN_SETTING_GOC_SITE = ("FRONTEND_ORIGIN", "SITE_ORIGIN")


def goc_site() -> str:
    for ten in TEN_SETTING_GOC_SITE:
        gia_tri = getattr(settings, ten, None)
        if gia_tri:
            return str(gia_tri).rstrip("/")
    return GOC_SITE_MAC_DINH


class Command(BaseCommand):
    help = "Gửi email digest tuần cho người theo mạch (PLAN 5.8)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--nhap",
            action="store_true",
            help="In nội dung ra stdout, KHÔNG gửi và KHÔNG chạm backend email.",
        )
        parser.add_argument(
            "--theo-lich",
            action="store_true",
            help="Không phải 8:00 thứ Bảy giờ VN thì thoát ngay, không gửi gì.",
        )
        parser.add_argument(
            "--bay-gio",
            help=(
                "Giả lập đồng hồ, dạng ISO 8601 kèm offset "
                "(vd 2026-08-22T08:30+07:00). Không có offset thì hiểu là giờ VN."
            ),
        )
        parser.add_argument(
            "--so-ngay",
            type=int,
            default=SO_NGAY_DIGEST,
            help=f"Độ dài cửa sổ gộp diễn biến, tính bằng ngày (mặc định {SO_NGAY_DIGEST}).",
        )

    def handle(self, *args, **options):
        bay_gio = self._doc_bay_gio(options["bay_gio"])
        so_ngay = options["so_ngay"]
        if so_ngay <= 0:
            raise CommandError(f"--so-ngay phải > 0, nhận {so_ngay}.")

        if options["theo_lich"] and not la_gio_gui(bay_gio):
            # Thoát 0, không phải lỗi: cron chạy mỗi giờ thì 167/168 lần trong tuần rơi
            # vào nhánh này, và một mã lỗi ở đây sẽ đổ đầy log cảnh báo giả.
            self.stdout.write(
                f"--theo-lich: {bay_gio.astimezone().isoformat()} không phải 8:00 "
                "thứ Bảy giờ VN — không gửi gì."
            )
            return

        tu_luc, den_luc = cua_so(bay_gio, so_ngay)
        goc = goc_site()

        nguoi_nhan = digest.nguoi_nhan_digest()
        if not nguoi_nhan:
            # Nói RA vì sao rỗng. "0 email" một mình đọc như "đã chạy xong xuôi", trong
            # khi sự thật là chưa có ai để gửi (bảng `Follow` thuộc Phase 3).
            self.stdout.write(
                self.style.WARNING(
                    "Không có người nhận nào: `core.digest.nguoi_nhan_digest()` đang trả "
                    "rỗng — đó là chỗ cắm của Phase 3 (bảng Follow), không phải lỗi."
                )
            )
            return

        thu = []
        so_rong = 0
        for nn in nguoi_nhan:
            noi_dung = dung_digest(nn, tu_luc, den_luc, goc)
            if noi_dung is None:
                so_rong += 1
                continue
            if options["nhap"]:
                self.stdout.write(f"--- {nn.user.username} <{nn.user.email}>")
                self.stdout.write(noi_dung.tieu_de)
                self.stdout.write(noi_dung.than)
                continue
            thu.append(
                EmailMessage(
                    subject=noi_dung.tieu_de,
                    body=noi_dung.than,
                    from_email=settings.DEFAULT_FROM_EMAIL,
                    to=[nn.user.email],
                )
            )

        if options["nhap"]:
            self.stdout.write(
                f"--nhap: {len(nguoi_nhan) - so_rong} thư sẽ gửi, {so_rong} người không "
                "có diễn biến nào. KHÔNG gửi gì."
            )
            return

        # MỘT kết nối cho cả lô: `EmailMessage.send()` từng cái mở và đóng một phiên SMTP
        # cho mỗi người, và nhà cung cấp nào cũng chặn kiểu đó ở lô vài trăm thư.
        if thu:
            with get_connection() as ket_noi:
                ket_noi.send_messages(thu)

        self.stdout.write(
            self.style.SUCCESS(
                f"gui_digest: đã giao {len(thu)} thư cho backend "
                f"{settings.EMAIL_BACKEND.rsplit('.', 2)[-2]}; "
                f"{so_rong} người không có diễn biến nào."
            )
        )

    def _doc_bay_gio(self, tho: str | None) -> datetime:
        """`--bay-gio` → `datetime` aware. Không truyền thì lấy đồng hồ thật.

        Chuỗi **không kèm offset** được hiểu là **giờ VN**, không phải giờ máy chủ: người
        gõ `--bay-gio 2026-08-22T08:00` đang muốn nói 8 giờ sáng thứ Bảy của PLAN. Hiểu
        theo giờ máy chủ (UTC trên prod) là lệch đúng 7 tiếng — cùng cái bẫy mà
        `core/thoi_gian.py` tồn tại để dồn về một chỗ.
        """
        if tho is None:
            return timezone.now()
        try:
            khi = datetime.fromisoformat(tho)
        except ValueError as loi:
            raise CommandError(
                f"--bay-gio không phải ISO 8601: {tho!r} "
                "(vd 2026-08-22T08:30+07:00)"
            ) from loi
        if khi.tzinfo is None:
            from core.thoi_gian import TZ_VN

            khi = khi.replace(tzinfo=TZ_VN)
        return khi
