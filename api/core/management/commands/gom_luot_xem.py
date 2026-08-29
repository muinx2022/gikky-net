"""Gộp lượt xem thô thành tổng theo ngày, rồi dọn hàng thô quá 90 ngày.

Chạy hằng ngày trên VPS (cron / systemd timer):

    node scripts/py.mjs gom_luot_xem

**Chạy lại bao nhiêu lần cũng ra cùng kết quả.** Hai thứ làm được điều đó, và thiếu một
trong hai là mất tính chất ấy:

1. **Chỉ gộp NGÀY ĐÃ XONG** (`< hôm nay` theo giờ VN). Gộp cả ngày đang chạy thì mỗi lượt
   chạy ghi một con số khác cho cùng một ngày — không ai kiểm được cái nào đúng, và trang
   thống kê sẽ nói hai chuyện khác nhau tuỳ lúc cron chạy. Hệ quả phải nhớ ở phía đọc:
   "toàn thời gian" là `TongNgay` **+ `LuotXem` của riêng hôm nay**, xem
   `api/quan_tri_luot_xem.py`;
2. **Upsert theo khoá `(ngay, duong_dan)`** — `update_or_create`, không `create`. Không có
   ràng buộc `UNIQUE` ấy thì lượt chạy thứ hai đẻ một bộ hàng thứ hai và mọi tổng nhân
   đôi, im lặng.

## Thứ tự: GỘP trước, DỌN sau — và dọn có điều kiện

Xoá hàng thô trước khi gộp là mất vĩnh viễn một ngày dữ liệu; không có nguồn nào dựng lại
được. Nên lệnh gộp xong mới xoá, và **chỉ xoá những ngày đã thật sự có mặt trong
`TongNgay`** — kiểm bằng chính DB, không bằng niềm tin rằng bước gộp ở trên vừa chạy
xong. Một ngày quá 90 ngày mà vì lý do nào đó chưa được gộp thì nó **ở lại**: một bảng
hơi phình còn hơn một khoảng trống vĩnh viễn trong biểu đồ.
"""

from datetime import date, datetime, time, timedelta  # noqa: F401  (date: type hint)

from django.core.management.base import BaseCommand
from django.db import transaction
from django.db.models import Count, Q
from django.db.models.functions import TruncDate

from core.models.luot_xem import LuotXem, TongNgay
from core.thoi_gian import TZ_VN, ngay_vn

#: Hàng thô sống tối đa bấy nhiêu ngày — quyết định của user ("thô 90 ngày").
#: Đọc 7/30/90 đi thẳng vào `LuotXem`, nên con số này là **trần** của bộ chọn khoảng.
SO_NGAY_GIU_THO = 90

#: Một đường dẫn phải đạt bấy nhiêu lượt TRONG NGÀY mới được giữ riêng một hàng trong
#: `TongNgay`; dưới ngưỡng thì cộng vào `DUONG_DAN_KHAC`.
#:
#: ## Vì sao cần ngưỡng: `TongNgay` giữ MÃI, mà số dòng do NGƯỜI NGOÀI quyết
#:
#: `duong_dan` là chuỗi tự do — middleware chuyển tiếp mọi pathname, kể cả 404. Một script
#: gõ `GET /<32 ký tự ngẫu nhiên>` một triệu lần (không cần secret: chính site tự chuyển
#: tiếp) đẻ một triệu hàng thô, rồi lệnh này biến chúng thành **một triệu hàng giữ vĩnh
#: viễn**. Bot quét `/wp-admin`, `/.env`, `/.git/config` làm đúng việc ấy ở quy mô nhỏ
#: hơn, mỗi ngày. Hàng thô có trần 90 ngày nên nó tự lành; `TongNgay` thì không.
#:
#: Ngưỡng 2 giữ đúng thứ bảng "xem nhiều nhất" cần (không ai đi tìm một trang có đúng một
#: lượt trong ngày) và chặn được đường phình, vì rác quét gần như luôn là 1 lượt/đường.
#:
#: ⚠ **TỔNG không đổi** — phần bị loại đi vào `DUONG_DAN_KHAC` chứ không bị vứt. Đó là
#: điều kiện để bốn con số lớn của trang vẫn đúng, và có bài đo ghim.
#: Lượt phản biện 2026-08-27 tìm ra.
NGUONG_GIU_RIENG = 2

#: Hàng gộp cho mọi đường dẫn dưới ngưỡng. Bắt đầu bằng `(` nên không đụng đường dẫn thật
#: (đường dẫn thật luôn bắt đầu bằng `/`).
DUONG_DAN_KHAC = "(lẻ tẻ)"


def nua_dem_vn(ngay: date) -> datetime:
    """00:00 **giờ VN** của `ngay`, dạng `datetime` aware — mốc để lọc theo cột `luc`."""
    return datetime.combine(ngay, time.min, tzinfo=TZ_VN)


def gom(hom_nay=None) -> tuple[int, int]:
    """Gộp mọi ngày ĐÃ XONG vào `TongNgay`. Trả `(số ngày chạm, số hàng ghi)`.

    Tách khỏi `Command.handle` để `pytest` gọi thẳng được — một lệnh chỉ chạy được qua
    `call_command` là một lệnh mà bài đo phải đọc stdout để biết nó làm gì.

    `hom_nay` truyền vào được để bài đo ghim ranh giới "ngày đã xong" mà không phải giả
    lập đồng hồ hệ thống.
    """
    if hom_nay is None:
        hom_nay = ngay_vn()

    # Lọc theo `luc` (có index) chứ không theo biểu thức `TruncDate`: một `WHERE
    # date(luc AT TIME ZONE …) < …` là một câu quét toàn bảng trên đúng bảng to nhất của
    # cơ chế này. Hai vế nói cùng một chuyện vì `nua_dem_vn` là mốc 00:00 giờ VN.
    #
    # `TruncDate(tzinfo=TZ_VN)` vẫn cần cho phép GOM NHÓM — ngày là **ngày VIỆT NAM**,
    # không phải ngày UTC và cũng không phải `settings.TIME_ZONE`. Múi giờ sản phẩm không
    # phải là cấu hình hiển thị (xem `core/thoi_gian.py`); gom theo UTC thì mọi lượt xem
    # sau 07:00 giờ VN rơi sang ô hôm trước và **biểu đồ vẫn trông hoàn toàn bình thường**.
    hang = (
        LuotXem.objects.filter(luc__lt=nua_dem_vn(hom_nay))
        .annotate(_ngay=TruncDate("luc", tzinfo=TZ_VN))
        .values("_ngay", "duong_dan")
        .annotate(
            _nguoi=Count("pk", filter=Q(la_bot=False)),
            _bot=Count("pk", filter=Q(la_bot=True)),
        )
        .order_by()
    )

    # Gom mọi đường dẫn LẺ LOI trong ngày về một hàng `DUONG_DAN_KHAC` — xem docstring
    # của hằng ấy. Làm ở Python chứ không ở SQL vì phép "cộng phần bị loại vào một hàng"
    # cần cả hai nhóm cùng lúc, và số hàng mỗi ngày vốn nhỏ.
    theo_ngay: dict[date, dict[str, tuple[int, int]]] = {}
    for h in hang:
        theo_ngay.setdefault(h["_ngay"], {})[h["duong_dan"]] = (h["_nguoi"], h["_bot"])

    ngay_cham: set = set()
    so_hang = 0
    # Một transaction cho cả lượt gộp: nửa bảng cũ nửa bảng mới là một trang thống kê nói
    # một con số không tương ứng với bất kỳ thời điểm nào.
    with transaction.atomic():
        for ngay, theo_duong in theo_ngay.items():
            khac_nguoi = khac_bot = 0
            for duong_dan, (nguoi, bot) in theo_duong.items():
                if nguoi + bot < NGUONG_GIU_RIENG:
                    khac_nguoi += nguoi
                    khac_bot += bot
                    continue
                TongNgay.objects.update_or_create(
                    ngay=ngay,
                    duong_dan=duong_dan,
                    defaults={"so_luot_nguoi": nguoi, "so_luot_bot": bot},
                )
                so_hang += 1
            if khac_nguoi or khac_bot:
                TongNgay.objects.update_or_create(
                    ngay=ngay,
                    duong_dan=DUONG_DAN_KHAC,
                    defaults={"so_luot_nguoi": khac_nguoi, "so_luot_bot": khac_bot},
                )
                so_hang += 1
            ngay_cham.add(ngay)
    return len(ngay_cham), so_hang


def don(hom_nay=None) -> int:
    """Xoá hàng thô cũ hơn `SO_NGAY_GIU_THO` ngày **và đã có mặt trong `TongNgay`**.

    Trả về số hàng đã xoá. Gọi **sau** `gom()`, không bao giờ trước.

    Phép kiểm "đã có mặt trong `TongNgay`" đọc từ DB chứ không giả định `gom()` vừa chạy:
    hai hàm này là hai hàm, và một lượt chạy trong đó `gom()` ném giữa chừng không được
    phép kéo theo một lượt xoá.
    """
    if hom_nay is None:
        hom_nay = ngay_vn()
    ngay_cat = hom_nay - timedelta(days=SO_NGAY_GIU_THO)

    da_gom = set(
        TongNgay.objects.filter(ngay__lt=ngay_cat).values_list("ngay", flat=True)
    )
    if not da_gom:
        return 0

    # Những ngày THÔ còn sót lại dưới mốc cắt. Lấy danh sách rồi xoá **theo từng ngày**
    # bằng khoảng `luc`, chứ không `.annotate(...).delete()`: Django dựng câu DELETE từ
    # một queryset không annotate được, và lối đó cũng bỏ qua index trên `luc`.
    ngay_con_tho = set(
        LuotXem.objects.filter(luc__lt=nua_dem_vn(ngay_cat))
        .annotate(_ngay=TruncDate("luc", tzinfo=TZ_VN))
        .values_list("_ngay", flat=True)
        .distinct()
    )

    so_xoa = 0
    with transaction.atomic():
        for ngay in sorted(ngay_con_tho & da_gom):
            n, _ = LuotXem.objects.filter(
                luc__gte=nua_dem_vn(ngay), luc__lt=nua_dem_vn(ngay + timedelta(days=1))
            ).delete()
            so_xoa += n
    return so_xoa


class Command(BaseCommand):
    help = (
        "Gộp lượt xem thô thành tổng theo ngày (chỉ ngày đã xong), rồi dọn hàng thô "
        f"quá {SO_NGAY_GIU_THO} ngày. Chạy lại nhiều lần vẫn ra cùng kết quả."
    )

    def handle(self, *args, **options):
        hom_nay = ngay_vn()
        so_ngay, so_hang = gom(hom_nay)
        so_xoa = don(hom_nay)
        self.stdout.write(
            f"gom_luot_xem: gộp {so_hang} hàng của {so_ngay} ngày; "
            f"dọn {so_xoa} hàng thô quá {SO_NGAY_GIU_THO} ngày."
        )
