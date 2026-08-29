"""Số liệu cho trang `/luot-xem` của khu quản trị — chốt 2026-08-27.

Trả lời ĐÚNG bốn câu user hỏi: site được xem bao nhiêu lần · link nào được xem nhiều ·
bao nhiêu bot vào · những bot nào.

## Hai nguồn, và ranh giới giữa chúng là chỗ dễ đếm hai lần nhất

| `?khoang=` | Đọc từ |
|---|---|
| `7` · `30` · `90` | `LuotXem` (hàng thô — nó phủ trọn 90 ngày) |
| `tat_ca` | `TongNgay` **+ `LuotXem` từ `max(TongNgay.ngay) + 1` trở đi** |

`gom_luot_xem` cố ý **không** gộp ngày hôm nay (nếu gộp thì mỗi lượt chạy ra một con số
khác cho cùng một ngày). Vì thế hai nguồn ở dòng cuối **không giao nhau**, và cộng chúng
là đúng. Cộng cả `LuotXem` không giới hạn là **đếm hai lần** mọi ngày đã gộp — một lỗi trả
về HTTP 200 và một con số chỉ hơi to.

⚠ **Ranh giới là `max(TongNgay.ngay) + 1`, KHÔNG phải "hôm nay".** Bản đầu lấy "hôm nay",
đúng khi cron chạy đều — nhưng cron chết là chuyện bình thường, và khi ấy `TongNgay` rỗng
làm "toàn thời gian" **nhỏ hơn "90 ngày" cả chục lần**, không cảnh báo. Lấy mốc từ chính
`TongNgay` thì con số tự lành khi cron trễ hoặc chưa từng chạy.

## Endpoint CHỈ ĐỌC ⇒ mod thường xem được

Không đòi `is_superuser`. Nó không đổi dữ liệu và không phơi nội dung của ai: hai bảng
nguồn cố ý không có cột nào gắn được với một con người.

## Bảng "bot nào vào nhiều nhất" theo ĐÚNG khoảng đang xem

`TongNgay` không có cột `ten_bot` (xem `core/models/luot_xem.py` — một dòng cho mỗi
ngày × đường dẫn × tên bot giữ mãi là quá đắt cho một câu hỏi chỉ có nghĩa ngắn hạn). Nên
bảng bot chỉ dựng được từ hàng thô, tức **tối đa 90 ngày** — và chỉ ở `tat_ca` thì giới
hạn ấy mới cắt gì; response mang cờ `bot_chi_90_ngay` để màn hình nói ra.

⚠ Với `7/30/90` thì bảng bot phải dùng **đúng khoảng đang xem**. Bản đầu truyền một hằng
90 ngày cho mọi khoảng, nên chọn "7 ngày" mà có bot quét rầm rộ 60 ngày trước sẽ ra một
màn hình tự mâu thuẫn: KPI "Lượt bot" = 0, biểu đồ toàn 0, bảng bot = 500 lượt — và cờ
báo giới hạn khi ấy là `False`, tức nó khẳng định "không có giới hạn nào".

## Bốn con số lớn KHÔNG suy từ biểu đồ

Biểu đồ của `tat_ca` bị chặn ở `SO_O_TOI_DA` ô (một site chạy ba năm mà vẽ hơn nghìn cột
thì vừa nặng vừa không đọc được). Cộng các cột đang vẽ để ra "tổng lượt xem" là **thiếu
hụt im lặng** đúng bằng phần bị cắt — nên tổng được tính riêng, từ toàn bộ nguồn.
"""

from datetime import date, datetime, time, timedelta

from django.db.models import Count, Max, Q, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from ninja import Router

from core.models.luot_xem import LuotXem, TongNgay
from core.thoi_gian import TZ_VN, ngay_vn

from api.loi import THAM_SO_KHONG_HOP_LE, LoiOut, loi
from api.quan_tri_schemas import (
    LuotXemNgayOut,
    LuotXemOut,
    LuotXemTongOut,
    TenBotOut,
    TopDuongDanOut,
)

router = Router()

#: Bốn lựa chọn của bộ chọn khoảng. `7/30/90` là **số ngày lịch VN tính CẢ hôm nay** —
#: cùng quy ước với `core/thoi_gian.py::SO_NGAY_KHOANG`, không phải cửa sổ trượt N×24 giờ.
#:
#: Tham số giữ kiểu `str` và được kiểm bằng tay chứ không khai `Literal`: `Literal` ra
#: `enum` trong OpenAPI, và `tests/test_hop_dong_openapi.py` đòi mọi query param `enum`
#: phải có **mã lỗi riêng** trong `api/loi.py::MA_LOI_THEO_THAM_SO`. Ở đây
#: `tham_so_khong_hop_le` đã là mã đúng; thêm một mã thứ hai chỉ để lách hàng rào là làm
#: hợp đồng lỗi to ra mà không nói thêm được gì.
SO_NGAY_KHOANG = {"7": 7, "30": 30, "90": 90}
KHOANG_TAT_CA = "tat_ca"
KHOANG_HOP_LE = (*SO_NGAY_KHOANG, KHOANG_TAT_CA)

#: Bao nhiêu dòng trong hai bảng top. Cố định, **không nhận từ query param**: một
#: `?top=100000` là một câu quét toàn bảng do người gọi đặt hàng.
SO_TOP = 20

#: Trần số ô của biểu đồ cột. Bằng đúng số ngày hàng thô được giữ, nên với 7/30/90 nó
#: không bao giờ cắt gì; nó chỉ có tác dụng ở `tat_ca`.
SO_O_TOI_DA = 90

#: Bảng bot LUÔN chỉ phủ bấy nhiêu ngày — bằng tuổi của hàng thô. Xem docstring module.
SO_NGAY_BOT = 90


def _nua_dem_vn(ngay: date) -> datetime:
    """00:00 **giờ VN** của `ngay` — mốc lọc theo cột `luc` (có index)."""
    return datetime.combine(ngay, time.min, tzinfo=TZ_VN)


def _tho_tu(ngay_dau: date | None):
    """`LuotXem` từ 00:00 giờ VN của `ngay_dau` trở đi. `None` = **toàn bộ**, không chặn dưới.

    Lọc theo `luc` chứ không theo `TruncDate(luc)`: hai vế nói cùng một chuyện, nhưng vế
    thứ hai bỏ qua index `luotxem_luc_duongdan` và biến mỗi lượt mở trang thống kê thành
    một câu quét toàn bảng — trên đúng bảng to nhất của cơ chế này.

    `None` chỉ dùng cho nhánh "toàn thời gian" khi `TongNgay` còn rỗng (`gom_luot_xem`
    chưa từng chạy). Nó quét toàn bảng thô — chấp nhận được vì bảng ấy bị chặn ở 90 ngày,
    và vì ca này chỉ xảy ra khi chưa có gì để gộp.
    """
    qs = LuotXem.objects.all()
    if ngay_dau is None:
        return qs
    return qs.filter(luc__gte=_nua_dem_vn(ngay_dau))


#: Hai phép đếm tách người/bot, dùng lại ở mọi chỗ gom nhóm hàng thô.
_DEM_TACH = {
    "_nguoi": Count("pk", filter=Q(la_bot=False)),
    "_bot": Count("pk", filter=Q(la_bot=True)),
}


def _tho_theo_ngay(ngay_dau: date | None) -> dict[date, tuple[int, int]]:
    """`{ngày VN: (lượt người, lượt bot)}` từ hàng thô. Ngày rỗng KHÔNG có mặt."""
    hang = (
        _tho_tu(ngay_dau)
        .annotate(_ngay=TruncDate("luc", tzinfo=TZ_VN))
        .values("_ngay")
        .annotate(**_DEM_TACH)
        .order_by()
    )
    return {h["_ngay"]: (h["_nguoi"], h["_bot"]) for h in hang}


def _tho_theo_duong_dan(ngay_dau: date | None) -> dict[str, tuple[int, int]]:
    """`{đường dẫn: (lượt người, lượt bot)}` từ hàng thô."""
    hang = _tho_tu(ngay_dau).values("duong_dan").annotate(**_DEM_TACH).order_by()
    return {h["duong_dan"]: (h["_nguoi"], h["_bot"]) for h in hang}


def _top(gop: dict[str, tuple[int, int]]) -> list[TopDuongDanOut]:
    """`SO_TOP` đường dẫn nhiều lượt nhất — sắp theo TỔNG, rồi theo tên.

    Vế thứ hai là để tất định: hai đường bằng điểm phải ra cùng một thứ tự ở mọi lượt
    gọi, nếu không mod thấy bảng "nhảy" mỗi lần bấm F5 và sẽ không tin con số nào nữa.
    """
    xep = sorted(gop.items(), key=lambda x: (-(x[1][0] + x[1][1]), x[0]))
    return [
        TopDuongDanOut(duong_dan=d, so_luot_nguoi=n, so_luot_bot=b)
        for d, (n, b) in xep[:SO_TOP]
    ]


def _top_bot(ngay_dau: date) -> list[TenBotOut]:
    hang = (
        _tho_tu(ngay_dau)
        .filter(la_bot=True)
        .values("ten_bot")
        .annotate(_so=Count("pk"))
        .order_by("-_so", "ten_bot")[:SO_TOP]
    )
    return [TenBotOut(ten=h["ten_bot"], so_luot=h["_so"]) for h in hang]


def _so_o_tat_ca(theo_ngay: dict[date, tuple[int, int]], hom_nay: date) -> int:
    """Bao nhiêu ô cho `khoang=tat_ca`: từ ngày sớm nhất có dữ liệu tới hôm nay.

    Chặn ở `SO_O_TOI_DA`. Cái bị cắt là phần **cũ nhất**, không phải phần gần đây — và
    phần bị cắt vẫn nằm trong bốn con số lớn (chúng tính từ `theo_ngay` đầy đủ).
    """
    if not theo_ngay:
        return 1
    ngay_dau = min(theo_ngay)
    return max(1, min((hom_nay - ngay_dau).days + 1, SO_O_TOI_DA))


def _chuoi(
    theo_ngay: dict[date, tuple[int, int]], hom_nay: date, so_ngay: int
) -> list[LuotXemNgayOut]:
    """Đúng `so_ngay` ô, ô CUỐI luôn là `hom_nay`. Ngày rỗng vẫn có ô, với hai số 0.

    `GROUP BY` chỉ trả về ngày CÓ dữ liệu. Đưa 1 điểm cho một biểu đồ 30 ngày là vẽ ra
    một site đông đúc hơn thực tế, và frontend không có cách nào biết ngày nào bị thiếu.
    Cùng chốt với `api/quan_tri_thong_ke.py`.

    ⚠ `so_ngay` do người gọi truyền, **không** suy từ dữ liệu: với `?khoang=30` thì biểu
    đồ phải có 30 ô kể cả khi cả tháng chỉ có một lượt xem. Suy từ dữ liệu là đúng ở
    `tat_ca` và sai ở ba khoảng còn lại — nhập hai luật vào một hàm là chỗ bản đầu hỏng.
    """
    ngay_dau = hom_nay - timedelta(days=so_ngay - 1)
    o = []
    for i in range(so_ngay):
        n = ngay_dau + timedelta(days=i)
        nguoi, bot = theo_ngay.get(n, (0, 0))
        o.append(LuotXemNgayOut(ngay=n, so_luot_nguoi=nguoi, so_luot_bot=bot))
    return o


@router.get(
    "/luot-xem",
    response={200: LuotXemOut, 400: LoiOut, 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_luot_xem",
    tags=["quan-tri-luot-xem"],
)
def luot_xem(request, response: HttpResponse, khoang: str = "30"):
    """Lượt xem trang theo khoảng: `7` · `30` · `90` · `tat_ca`.

    Mọi mốc "ngày" là **ngày lịch Việt Nam**, và ba khoảng số đếm CẢ hôm nay.
    """
    response["Cache-Control"] = "no-store"

    if khoang not in KHOANG_HOP_LE:
        # Giá trị lạ trả 400 chứ không lặng lẽ quy về mặc định: một chữ gõ nhầm không
        # được biến "7 ngày" thành "toàn thời gian" mà vẫn HTTP 200.
        return loi(
            400,
            THAM_SO_KHONG_HOP_LE,
            f"khoang phải thuộc {{{', '.join(KHOANG_HOP_LE)}}}, nhận {khoang!r}.",
        )

    hom_nay = ngay_vn()

    if khoang != KHOANG_TAT_CA:
        so_o = SO_NGAY_KHOANG[khoang]
        ngay_dau = hom_nay - timedelta(days=so_o - 1)
        theo_ngay = _tho_theo_ngay(ngay_dau)
        gop = _tho_theo_duong_dan(ngay_dau)
        # ⚠ Bảng bot phải dùng ĐÚNG khoảng đang xem, không phải một hằng 90 ngày.
        #
        # Bản đầu luôn truyền `hom_nay - 89`, nên chọn "7 ngày" mà có một con bot quét
        # rầm rộ 60 ngày trước thì màn hình hiện: KPI "Lượt bot" = **0**, biểu đồ toàn 0,
        # còn bảng "Bot nào vào nhiều nhất" = 500 lượt. Hai con số mâu thuẫn trên cùng
        # một màn hình, và không có dòng chú nào — vì `bot_chi_90_ngay` khi ấy là `False`,
        # tức cái cờ sinh ra để nói giới hạn lại đang khẳng định "không có giới hạn".
        # Lượt phản biện 2026-08-27 tìm ra.
        ngay_dau_bot = ngay_dau
        bot_chi_90_ngay = False
    else:
        # --- "toàn thời gian" = TongNgay + LuotXem của phần CHƯA GỘP ---
        #
        # ⚠ Ranh giới là `max(TongNgay.ngay) + 1`, **không phải "hôm nay"**.
        #
        # Bản đầu lấy `TongNgay` + hàng thô của riêng hôm nay. Đúng khi `gom_luot_xem`
        # chạy đều — nhưng nó là một lệnh cron, và cron chết là chuyện bình thường. Ca
        # hỏng: site chạy 5 ngày, chưa ai gõ lệnh gộp lần nào ⇒ `TongNgay` RỖNG ⇒ "toàn
        # thời gian" chỉ còn hôm nay, tức **nhỏ hơn "90 ngày" gần mười lần**, HTTP 200,
        # không cảnh báo. Cùng ca xảy ra mỗi lần cron trễ vài ngày.
        #
        # Lấy mốc từ chính `TongNgay` thì hai nguồn vẫn không giao nhau (`gom_luot_xem`
        # chỉ gộp ngày đã xong), mà con số **tự lành** khi cron trễ hoặc chưa từng chạy.
        # `None` = chưa gộp gì ⇒ lấy toàn bộ hàng thô. Lượt phản biện 2026-08-27 tìm ra.
        da_gom_toi = TongNgay.objects.aggregate(m=Max("ngay"))["m"]
        ngay_dau_tho = (da_gom_toi + timedelta(days=1)) if da_gom_toi else None
        theo_ngay = {
            h["ngay"]: (h["_nguoi"] or 0, h["_bot"] or 0)
            for h in TongNgay.objects.values("ngay")
            .annotate(_nguoi=Sum("so_luot_nguoi"), _bot=Sum("so_luot_bot"))
            .order_by()
        }
        # `update` chứ không cộng dồn: một ngày không thể vừa nằm trong `TongNgay` vừa
        # nằm sau `max(TongNgay.ngay)`. Nếu ngày nào đó nó vừa cả hai thì `gom_luot_xem`
        # đã hỏng, và lúc ấy ghi đè bằng số THÔ là câu trả lời đúng — hàng thô là nguồn,
        # bảng gộp là bản sao.
        theo_ngay.update(_tho_theo_ngay(ngay_dau_tho))

        gop = {
            h["duong_dan"]: (h["_nguoi"] or 0, h["_bot"] or 0)
            for h in TongNgay.objects.values("duong_dan")
            .annotate(_nguoi=Sum("so_luot_nguoi"), _bot=Sum("so_luot_bot"))
            .order_by()
        }
        for duong_dan, (n, b) in _tho_theo_duong_dan(ngay_dau_tho).items():
            cu = gop.get(duong_dan, (0, 0))
            gop[duong_dan] = (cu[0] + n, cu[1] + b)
        so_o = _so_o_tat_ca(theo_ngay, hom_nay)
        # `TongNgay` không có cột `ten_bot` (mô hình cố ý gọn), nên bảng bot chỉ dựng được
        # từ hàng thô ⇒ tối đa 90 ngày. Cờ này làm trang nói ra điều đó.
        ngay_dau_bot = hom_nay - timedelta(days=SO_NGAY_BOT - 1)
        bot_chi_90_ngay = True

    # Tổng tính từ `theo_ngay` ĐẦY ĐỦ, không từ `chuoi` — `chuoi` bị chặn ở
    # `SO_O_TOI_DA` ô. Xem docstring module.
    tong_nguoi = sum(n for n, _ in theo_ngay.values())
    tong_bot = sum(b for _, b in theo_ngay.values())

    return LuotXemOut(
        khoang=khoang,
        tong=LuotXemTongOut(
            so_luot=tong_nguoi + tong_bot,
            so_luot_nguoi=tong_nguoi,
            so_luot_bot=tong_bot,
        ),
        chuoi_ngay=_chuoi(theo_ngay, hom_nay, so_o),
        top_duong_dan=_top(gop),
        top_bot=_top_bot(ngay_dau_bot),
        bot_chi_90_ngay=bot_chi_90_ngay,
    )
