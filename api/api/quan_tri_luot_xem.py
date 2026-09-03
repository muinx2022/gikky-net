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

## Năm bảng CHI TIẾT chỉ dựng được từ hàng thô ⇒ tối đa 90 ngày

`TongNgay` chỉ mang `(ngày, đường dẫn, người, bot)` (xem `core/models/luot_xem.py` — một
dòng cho mỗi tổ hợp ngày × đường dẫn × tên bot × nguồn × trình duyệt giữ mãi là một bảng
nổ tung để trả lời những câu hỏi vốn chỉ có nghĩa ngắn hạn). Nên **năm khối** dưới đây chỉ
dựng được từ hàng thô, tức tối đa 90 ngày:

    top_bot · theo_nhom_bot · top_nguon + so_truc_tiep · trinh_duyet · thiet_bi

Chỉ ở `tat_ca` thì giới hạn ấy mới cắt gì; response mang cờ `chi_tiet_chi_90_ngay` để màn
hình nói ra. *(Tên cũ `bot_chi_90_ngay`, đổi 2026-08-30 khi cờ phủ thêm bốn khối.)*

## Khách/ngày — hai nguồn, cùng ranh giới với lượt xem

| `?khoang=` | Số khách đọc từ |
|---|---|
| `7` · `30` · `90` | `COUNT(DISTINCT khach)` trên hàng thô, theo ngày |
| `tat_ca` | `KhachNgay` (phần đã gộp) **+ distinct thô từ `max(TongNgay.ngay)+1`** |

Dùng **đúng cùng ranh giới** với lượt xem, và đó không phải trùng hợp: `gom_luot_xem` ghi
`KhachNgay` trong CÙNG transaction với `TongNgay`, nên hai bảng không thể lệch nhau.

⚠ **`None` ≠ `0`.** Ngày có hàng người mà distinct = 0 (mọi `khach` rỗng — hàng ghi trước
2026-08-30) trả `None`: *"không đo được"*. Ngày chỉ có bot, hoặc ngày không có hàng nào,
trả `0`: đó là một phép đo thật. Nhập hai thứ ấy làm một là vẽ ra những ngày vắng tanh
nằm cạnh cột "lượt người" cao ngất.

⚠ Với `7/30/90` thì bảng bot phải dùng **đúng khoảng đang xem**. Bản đầu truyền một hằng
90 ngày cho mọi khoảng, nên chọn "7 ngày" mà có bot quét rầm rộ 60 ngày trước sẽ ra một
màn hình tự mâu thuẫn: KPI "Lượt bot" = 0, biểu đồ toàn 0, bảng bot = 500 lượt — và cờ
báo giới hạn khi ấy là `False`, tức nó khẳng định "không có giới hạn nào".

## Bốn con số lớn KHÔNG suy từ biểu đồ

Biểu đồ của `tat_ca` bị chặn ở `SO_O_TOI_DA` ô (một site chạy ba năm mà vẽ hơn nghìn cột
thì vừa nặng vừa không đọc được). Cộng các cột đang vẽ để ra "tổng lượt xem" là **thiếu
hụt im lặng** đúng bằng phần bị cắt — nên tổng được tính riêng, từ toàn bộ nguồn.

## "Online" — con số DUY NHẤT không đọc theo `?khoang=`

`so_online` = số `khach` phân biệt (người, không bot) có lượt xem trong `CUA_SO_ONLINE_PHUT`
phút gần nhất, **bất kể** người xem đang chọn 7/30/90/tất cả. Nó đứng cạnh năm con số kia
nhưng trả lời một câu khác hẳn ("ngay lúc này"), nên nhãn trên màn hình phải nói ra khoảng
riêng ấy — xem `apps/admin/app/luot-xem/page.tsx`.

Nó là **ước lượng**, và giới hạn đến thẳng từ việc không có session: cùng một người mở hai
trình duyệt = hai "online"; người đọc yên một chỗ quá 5 phút không còn được tính. Đó không
phải chỗ để "cải thiện" bằng cách thêm cookie.

## `/luot-xem/online` — ai đang online, một dòng mỗi khách (2026-08-31)

Endpoint thứ hai của file này, nuôi cái modal mở ra khi mod bấm ô "Online". Nó **dùng lại
`CUA_SO_ONLINE_PHUT`**, không đẻ hằng thứ hai: ô KPI và modal phải nói về đúng một cửa sổ.

⚠ **Bất biến bắt buộc: `OnlineOut.tong == LuotXemTongOut.so_online`** trên cùng dữ liệu.
Hai chỗ đếm cùng một thứ bằng hai đoạn code là đúng chỗ chúng trôi khỏi nhau, và triệu
chứng là ô nói "5" còn modal liệt kê 7 dòng. Nên `tong` gọi thẳng `_dem_online()`, và
`test_N4_*` so hai endpoint để phép gọi ấy không bị "dọn" thành `len(items)` — nó **không**
bằng nhau: danh sách gồm CẢ bot (user hỏi đích danh "người hay bot"), còn ô KPI chỉ đếm
người.

⚠ **Một mốc, đọc ĐÚNG MỘT LẦN cho cả response** (`luot_xem_online` gọi `_moc_online()` rồi
truyền xuống). Bản đầu để `_gom_online` và `_dem_online` mỗi hàm tự gọi `timezone.now()`:
hai phép đo cách nhau vài mili giây, nên một lượt xem ghi đúng vào khe ấy làm `tong` và
`items` nói về hai cửa sổ khác nhau — bất biến N4 gãy ở đúng lúc site đông nhất, và không
tái hiện được. Lượt phản biện 2026-09-03 tìm ra (TB-3).

Cột duy nhất phải thêm cho modal là `LuotXem.da_dang_nhap`; ranh giới riêng tư của response
ghi ở `quan_tri_schemas.py::KhachOnlineOut`.

⚠ **Đường dẫn MANG DANH TÍNH bị che TRƯỚC KHI RỜI SERVER** (`che_duong_dan`): `/u/…` và
`/tin-nhan/…`. Không có nó thì "Đã đăng nhập · /u/chinhho" là một dòng ghép được bí danh
với một tài khoản có thật, và một bí danh ổn định trong ngày dựng lại được **lịch sử đọc
của một người** qua vài lượt bấm F5 — đúng thứ mà cam kết "không cột nào gắn được với một
con người" hứa là không xảy ra. Cùng lượt phản biện, hạng NẶNG.
"""

from collections.abc import Callable
from datetime import date, datetime, time, timedelta

from django.db.models import Count, Max, Q, Sum
from django.db.models.functions import TruncDate
from django.http import HttpResponse
from django.utils import timezone
from ninja import Router

from core.bot import NHOM_HOP_LE, nhom_bot
from core.models.luot_xem import KhachNgay, LuotXem, TongNgay
from core.thoi_gian import TZ_VN, ngay_vn

from api.loi import THAM_SO_KHONG_HOP_LE, LoiOut, loi
from api.quan_tri_schemas import (
    KhachOnlineOut,
    LuotXemNgayOut,
    LuotXemOut,
    LuotXemTongOut,
    MucSoLuotOut,
    NguonOut,
    NhomBotOut,
    OnlineOut,
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

#: Năm bảng CHI TIẾT (bot, nhóm bot, nguồn, trình duyệt, thiết bị) LUÔN chỉ phủ bấy nhiêu
#: ngày — bằng tuổi của hàng thô. Xem docstring module.
SO_NGAY_CHI_TIET = 90

#: Cửa sổ của ô "Online", tính bằng phút. Cố định, **không nhận từ query param** — cùng
#: lý lẽ với `SO_TOP`: một `?phut=525600` là một câu `COUNT(DISTINCT)` trên toàn bảng do
#: người gọi đặt hàng. Nó cũng KHÔNG đi theo `?khoang=`; xem docstring module.
CUA_SO_ONLINE_PHUT = 5

#: Trần số hàng thô mà `/luot-xem/online` quét. Cửa sổ chỉ 5 phút nên tập này nhỏ ở mọi
#: site thật; trần chỉ tồn tại để một đợt bot quét rầm rộ không biến một cái modal thành
#: câu `SELECT` vài trăm nghìn hàng. Chạm trần ⇒ `bi_cat=True` và modal nói ra.
SO_HANG_QUET = 5000

#: Trần số DÒNG trả về. Cố định, **không nhận từ query param** — cùng lý lẽ `SO_TOP`.
#: 200 dòng đã dài hơn mức ai đó đọc hết; cái cần đọc là 20 dòng đầu.
SO_DONG_ONLINE = 200


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


def _bot_theo_ten(ngay_dau: date) -> list[tuple[str, int]]:
    """`[(tên bot, lượt)]` **toàn bộ**, sắp giảm dần rồi theo tên. Không cắt top ở đây.

    Hai người đọc: `_top_bot` (cắt 20) và `_theo_nhom_bot` (gộp **hết**). Gộp nhóm từ 20
    dòng đã cắt là thiếu hụt im lặng đúng bằng phần đuôi — và phần đuôi của bảng bot
    thường dài hơn phần đầu.
    """
    hang = (
        _tho_tu(ngay_dau)
        .filter(la_bot=True)
        .values("ten_bot")
        .annotate(_so=Count("pk"))
        .order_by("-_so", "ten_bot")
    )
    return [(h["ten_bot"], h["_so"]) for h in hang]


def _top_bot(theo_ten: list[tuple[str, int]]) -> list[TenBotOut]:
    return [
        TenBotOut(ten=ten, so_luot=so, nhom=nhom_bot(ten))
        for ten, so in theo_ten[:SO_TOP]
    ]


def _theo_nhom_bot(theo_ten: list[tuple[str, int]]) -> list[NhomBotOut]:
    """Gộp theo nhóm, sắp giảm dần rồi theo **thứ tự khai** của `NHOM_HOP_LE`.

    Vế thứ hai thay cho "rồi theo tên": sáu nhóm có một thứ tự ĐỌC có nghĩa (tìm kiếm →
    xem trước → AI → SEO → giám sát → khác), và sắp theo abc sẽ đẩy `ai` lên đầu chỉ vì
    nó bắt đầu bằng chữ a. Vẫn tất định, vẫn không "nhảy" khi mod bấm F5.

    Nhóm không có lượt nào **không có dòng** — một bảng sáu dòng toàn 0 là sáu dòng nhiễu.
    """
    gop: dict[str, int] = {}
    for ten, so in theo_ten:
        nhom = nhom_bot(ten)
        gop[nhom] = gop.get(nhom, 0) + so
    xep = sorted(gop.items(), key=lambda x: (-x[1], NHOM_HOP_LE.index(x[0])))
    return [NhomBotOut(nhom=n, so_luot=s) for n, s in xep]


def _nguoi_tu(ngay_dau: date):
    """Hàng NGƯỜI trong khoảng — nền của cả ba bảng nguồn/trình duyệt/thiết bị.

    Ba bảng ấy trả lời câu *"người đọc site đến từ đâu, bằng gì"*. Lẫn một hàng bot vào là
    đo nhầm sang *"máy nào ghé site"*, mà site đã có hai bảng riêng cho câu ấy.
    """
    return _tho_tu(ngay_dau).filter(la_bot=False)


def _top_nguon(ngay_dau: date) -> list[NguonOut]:
    """Top 20 tên miền dẫn người tới. Bỏ `""` — nó đi vào `_so_truc_tiep`."""
    hang = (
        _nguoi_tu(ngay_dau)
        .exclude(nguon="")
        .values("nguon")
        .annotate(_so=Count("pk"))
        .order_by("-_so", "nguon")[:SO_TOP]
    )
    return [NguonOut(nguon=h["nguon"], so_luot=h["_so"]) for h in hang]


def _so_truc_tiep(ngay_dau: date) -> int:
    """Lượt người không có nguồn ngoài. Ba ca gộp một — xem `LuotXem.nguon`."""
    return _nguoi_tu(ngay_dau).filter(nguon="").count()


def _theo_cot(ngay_dau: date, cot: str) -> list[MucSoLuotOut]:
    """Gộp hàng NGƯỜI theo một cột khoá ascii (`trinh_duyet` / `thiet_bi`), bỏ ô rỗng.

    Ô rỗng là hàng bot (hai cột ấy cố ý rỗng khi `la_bot`) và hàng ghi trước 2026-08-30.
    Đưa chúng vào bảng dưới nhãn `""` là thêm một dòng không đọc được, và nó sẽ đứng đầu
    bảng trên mọi site đã chạy trước lượt này.
    """
    hang = (
        _nguoi_tu(ngay_dau)
        .exclude(**{cot: ""})
        .values(cot)
        .annotate(_so=Count("pk"))
        .order_by("-_so", cot)
    )
    return [MucSoLuotOut(ten=h[cot], so_luot=h["_so"]) for h in hang]


def _khach_tho(ngay_dau: date | None) -> dict[date, int | None]:
    """`{ngày: số khách}` từ hàng thô. `None` = ngày **không đo được**.

    "Không đo được" = ngày có **bất kỳ** hàng người nào mang `khach=""` — cùng đúng một
    luật với `gom_luot_xem::_khach_moi_ngay`, và phải cùng, vì hai hàm này vẽ chung một
    chuỗi ngày: ngày chuyển tiếp (deploy giữa ngày, nửa hàng cũ không token) mà bên này
    trả một con số còn bên kia trả `None` thì cùng một ô đổi nghĩa tuỳ nó rơi vào vùng
    thô hay vùng đã gộp. Xem docstring bên ấy về vì sao "một phần" không được ghi.

    Ngày không có hàng nào KHÔNG có mặt ở đây — người gọi quyết định mặc định của nó (0
    cho vùng hàng thô, `None` cho vùng đã gộp mà `KhachNgay` không có hàng).

    ⚠ `distinct=True` cộng `~Q(khach="")`: hàng không đo được phải bị loại **trước** phép
    đếm distinct, nếu không tất cả chúng gộp thành đúng một "khách" ma mỗi ngày.
    """
    hang = (
        _tho_tu(ngay_dau)
        .annotate(_ngay=TruncDate("luc", tzinfo=TZ_VN))
        .values("_ngay")
        .annotate(
            _thieu=Count("pk", filter=Q(la_bot=False) & Q(khach="")),
            _khach=Count("khach", distinct=True, filter=Q(la_bot=False) & ~Q(khach="")),
        )
        .order_by()
    )
    return {h["_ngay"]: (None if h["_thieu"] > 0 else h["_khach"]) for h in hang}


def _moc_online() -> datetime:
    """Mốc dưới của cửa sổ online. **Một chỗ duy nhất** cho cả hai endpoint.

    Ô KPI và modal phải nói về đúng cùng một cửa sổ; hai phép trừ chép ra hai chỗ là hai
    chỗ để một lượt "dọn dẹp" đổi một bên mà không đổi bên kia.

    ⚠ Người GỌI đọc mốc, rồi **truyền xuống** — `_dem_online` và `_gom_online` cố ý nhận
    `moc` thay vì tự gọi hàm này. Trong một response chỉ được có ĐÚNG MỘT phép đọc đồng
    hồ: hai phép đọc cách nhau vài mili giây là hai cửa sổ khác nhau, và một lượt xem ghi
    đúng vào khe ấy làm `tong` không còn bằng số dòng người trong `items`. Bài đo
    `test_TB3_*` đếm số lần hàm này được gọi trong một request.
    """
    return timezone.now() - timedelta(minutes=CUA_SO_ONLINE_PHUT)


def _dem_online(moc: datetime) -> int:
    """Số khách phân biệt (NGƯỜI) có lượt xem từ `moc` trở đi (`_moc_online()`).

    ⚠ Mốc là một thời điểm **tuyệt đối** (`timezone.now()` trừ đi cửa sổ), không phải
    `ngay_vn()`. Kẹp cửa sổ vào trong ngày lịch VN sẽ làm con số rơi về 0 lúc 00:00 rồi
    bò lên lại, mỗi đêm một lần; lọc theo mốc tuyệt đối là cách đúng.

    ⚠ **Nhưng cửa sổ cắt qua nửa đêm VN thì ĐẾM ĐÔI, và đó là giới hạn thật.** `khach` là
    `sha256(muối-của-NGÀY ‖ ip ‖ ua)` (`api/dem_luot_xem.py::hash_khach`) và muối xoay
    đúng lúc 00:00 giờ VN, nên một người xem trang lúc 23:58 rồi 00:01 để lại **hai** token
    phân biệt — `COUNT(DISTINCT)` không có cách nào biết chúng là một người. Mỗi đêm một
    lần, kéo 5 phút, và sai theo hướng **phồng**. Không sửa được ở đây mà không phá thứ
    khác (kẹp vào ngày lịch còn tệ hơn — xem đoạn trên), nên nó được **nói ra** ở đoạn chú
    giới hạn của `/luot-xem` thay vì giấu. Lượt phản biện 2026-08-31 tìm ra; bản đầu của
    docstring này khẳng định ngược ("hoàn toàn đúng") và đó là một câu sai.

    ⚠ `exclude(khach="")` bắt buộc, cùng đúng cái bẫy `_khach_tho` đã đóng: hàng ghi
    trước 2026-08-30 mang `khach=""`, và `COUNT(DISTINCT)` gộp tất cả chúng thành đúng
    **một** "khách" ma. Ở đây cái giá còn cao hơn — ô hiện "1 online" vĩnh viễn trên một
    site không có ai, vì chỉ cần một lượt cũ rơi vào cửa sổ.

    Bot không tính: câu hỏi là "bao nhiêu NGƯỜI đang đọc". Đúng một truy vấn, và nó đi
    qua index `luotxem_luc_duongdan` (`luc` dẫn đầu) nên tập phải distinct là tập nhỏ.
    """
    return (
        LuotXem.objects.filter(luc__gte=moc, la_bot=False)
        .exclude(khach="")
        .values("khach")
        .distinct()
        .count()
    )


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
    theo_ngay: dict[date, tuple[int, int]],
    hom_nay: date,
    so_ngay: int,
    khach_cua: "Callable[[date], int | None]",
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
        o.append(
            LuotXemNgayOut(
                ngay=n,
                so_luot_nguoi=nguoi,
                so_luot_bot=bot,
                so_khach=khach_cua(n),
            )
        )
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
        # ⚠ Năm bảng chi tiết phải dùng ĐÚNG khoảng đang xem, không phải một hằng 90 ngày.
        #
        # Bản đầu luôn truyền `hom_nay - 89`, nên chọn "7 ngày" mà có một con bot quét
        # rầm rộ 60 ngày trước thì màn hình hiện: KPI "Lượt bot" = **0**, biểu đồ toàn 0,
        # còn bảng "Bot nào vào nhiều nhất" = 500 lượt. Hai con số mâu thuẫn trên cùng
        # một màn hình, và không có dòng chú nào — vì cờ giới hạn khi ấy là `False`, tức
        # cái cờ sinh ra để nói giới hạn lại đang khẳng định "không có giới hạn".
        # Lượt phản biện 2026-08-27 tìm ra; từ 2026-08-30 cùng cái bẫy ấy áp cho cả bảng
        # nguồn, trình duyệt và thiết bị.
        ngay_dau_chi_tiet = ngay_dau
        chi_tiet_chi_90_ngay = False

        khach = _khach_tho(ngay_dau)
        # Ngày vắng mặt trong nhóm gộp = ngày KHÔNG có hàng nào ⇒ 0 khách là một phép đo
        # thật, không phải "không đo được". Chỉ ngày CÓ người mà distinct = 0 mới là
        # `None`, và `_khach_tho` đã đánh dấu ca đó.
        def khach_cua(n: date) -> int | None:
            return khach.get(n, 0)
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
        # `TongNgay` chỉ mang (ngày, đường dẫn, người, bot), nên NĂM bảng chi tiết chỉ
        # dựng được từ hàng thô ⇒ tối đa 90 ngày. Cờ này làm trang nói ra điều đó.
        ngay_dau_chi_tiet = hom_nay - timedelta(days=SO_NGAY_CHI_TIET - 1)
        chi_tiet_chi_90_ngay = True

        # Khách theo CÙNG ranh giới với lượt xem: `KhachNgay` cho phần đã gộp, distinct
        # thô cho phần sau mốc. Hai bảng ghi cùng transaction nên chúng không lệch nhau.
        khach = {
            k.ngay: k.so_khach
            for k in KhachNgay.objects.all()
        }
        khach.update(_khach_tho(ngay_dau_tho))

        def khach_cua(n: date) -> int | None:
            if n in khach:
                return khach[n]
            # Sau mốc gộp thì hàng thô là nguồn ĐẦY ĐỦ ⇒ vắng mặt = không có hàng nào = 0.
            if ngay_dau_tho is None or n >= ngay_dau_tho:
                return 0
            # Trước mốc mà `KhachNgay` không có hàng ⇒ ngày ấy **không đo được**: hàng thô
            # đã dọn, và `gom_luot_xem` cố ý không ghi 0 giả cho nó.
            return None

    # Tổng tính từ `theo_ngay` ĐẦY ĐỦ, không từ `chuoi` — `chuoi` bị chặn ở
    # `SO_O_TOI_DA` ô. Xem docstring module.
    tong_nguoi = sum(n for n, _ in theo_ngay.values())
    tong_bot = sum(b for _, b in theo_ngay.values())
    # Số khách cũng KHÔNG suy từ biểu đồ, cùng lý do. Ngày không đo được đóng góp 0, nên
    # con số này là một cận DƯỚI — không bao giờ thổi phồng.
    tong_khach = sum(v for v in khach.values() if v is not None)

    theo_ten_bot = _bot_theo_ten(ngay_dau_chi_tiet)

    return LuotXemOut(
        khoang=khoang,
        tong=LuotXemTongOut(
            so_luot=tong_nguoi + tong_bot,
            so_luot_nguoi=tong_nguoi,
            so_luot_bot=tong_bot,
            so_khach=tong_khach,
            # KHÔNG phụ thuộc `khoang`: "online" là 5 phút gần nhất ở mọi lựa chọn.
            so_online=_dem_online(_moc_online()),
        ),
        chuoi_ngay=_chuoi(theo_ngay, hom_nay, so_o, khach_cua),
        top_duong_dan=_top(gop),
        top_bot=_top_bot(theo_ten_bot),
        theo_nhom_bot=_theo_nhom_bot(theo_ten_bot),
        top_nguon=_top_nguon(ngay_dau_chi_tiet),
        so_truc_tiep=_so_truc_tiep(ngay_dau_chi_tiet),
        trinh_duyet=_theo_cot(ngay_dau_chi_tiet, "trinh_duyet"),
        thiet_bi=_theo_cot(ngay_dau_chi_tiet, "thiet_bi"),
        chi_tiet_chi_90_ngay=chi_tiet_chi_90_ngay,
    )


#: Đường dẫn nào **mang danh tính**, và cái gì hiện ra thay cho nó. Che ở ĐÂY, tức trước
#: khi dữ liệu rời server — không phải ở frontend, vì frontend chỉ giấu chữ trên màn hình
#: còn JSON thì vẫn mang đủ.
#:
#: ⚠ Đây là vế thứ nhất trong ba vế đóng lại lỗ **NẶNG** của lượt phản biện 2026-09-03:
#: một dòng "Đã đăng nhập · /u/chinhho" ghép thẳng bí danh của bảng lượt xem với một tài
#: khoản có thật, và từ đó mọi dòng khác của cùng bí danh là **lịch sử đọc của người ấy**.
#: Hai vế còn lại: bỏ hẳn bí danh ổn định (`KhachOnlineOut.stt`) và viết lại chú trên modal.
#:
#: Khớp theo TIỀN TỐ, không theo phân đoạn: `/u/` phủ cả `/u/ai-do/theo-doi` lẫn `/u/` trần.
#: Mọi đường khác (`/`, `/m/…`, `/s/…`, `/tim-kiem`, `/tin-nhan` trần) giữ nguyên — chúng
#: nói site đang được đọc ở đâu, không nói ai đang đọc.
CHE_DUONG_DAN: tuple[tuple[str, str], ...] = (
    ("/u/", "(hồ sơ người dùng)"),
    ("/tin-nhan/", "(tin nhắn)"),
)


def che_duong_dan(duong_dan: str) -> str:
    """Đường dẫn đã che phần mang danh tính. Hàm THUẦN — xem `CHE_DUONG_DAN`."""
    for tien_to, thay_bang in CHE_DUONG_DAN:
        if duong_dan.startswith(tien_to):
            return thay_bang
    return duong_dan


def _gom_online(moc: datetime) -> tuple[list[KhachOnlineOut], bool, int]:
    """`(danh sách, có chạm trần quét không, số dòng THẬT)` — gom theo `khach`, MỘT truy vấn.

    `moc` do người gọi truyền (`_moc_online()`), **không** đọc lại đồng hồ ở đây — xem
    docstring `_moc_online`. Vế thứ ba là số khách phân biệt **trước** khi cắt
    `SO_DONG_ONLINE`; nó tồn tại để cái trần ấy không cắt im lặng (xem endpoint).

    ## Vì sao gom ở Python chứ không `GROUP BY`

    Mỗi dòng cần **giá trị của lượt gần nhất** (đường dẫn, giây trước) cộng một phép đếm.
    Trong SQL đó là một `DISTINCT ON` hoặc một window function — Django ORM diễn đạt được
    nhưng không portable, và tập dữ liệu ở đây là **5 phút lượt xem**, tức nhỏ theo thiết
    kế. Một vòng `for` trên vài trăm dòng đọc được và không có gì để trôi.

    ## Ba luật phải giống hệt `_dem_online`, và cả ba đều im lặng khi sai

    1. cùng mốc — nay là **cùng một đối tượng `moc`**, không phải hai phép trừ giống nhau;
    2. `exclude(khach="")` — hàng ghi trước 2026-08-30 mang `""`, và gộp chúng lại là bịa
       ra đúng MỘT "khách ma" luôn đứng trong danh sách trên một site không có ai;
    3. `-luc` trước khi cắt trần — cắt rồi mới sắp là danh sách "ai đang online" gồm
       những người đã rời đi.

    **Khác đúng một luật**: ở đây KHÔNG lọc `la_bot=False`. Câu hỏi của modal là *"ai
    đang ở đây"*, và bot đang ở đây thật — user hỏi đích danh "là người hay bot". Chính
    vì thế `tong` **không** được suy từ danh sách này; xem endpoint bên dưới.

    ⚠ `khach` xác định `la_bot`: cả hai suy từ cùng một (IP, UA) qua `hash_khach`/
    `ten_bot`, nên một nhóm không thể vừa người vừa bot. Nhờ đó "số nhóm không-bot" và
    `COUNT(DISTINCT khach) WHERE NOT la_bot` là cùng một con số — nhưng chúng vẫn là hai
    đoạn code, và bài N4 tồn tại để chúng không trôi khỏi nhau.
    """
    # Suy từ `moc` chứ không đọc đồng hồ lần nữa: `giay_truoc` phải tính từ đúng cái
    # "bây giờ" đã dựng nên cửa sổ, nếu không dòng cũ nhất có thể ra một số giây lớn hơn
    # cả cửa sổ — nhỏ, nhưng là một con số tự mâu thuẫn với cái nhãn ngay trên nó.
    bay_gio = moc + timedelta(minutes=CUA_SO_ONLINE_PHUT)
    hang = list(
        LuotXem.objects.filter(luc__gte=moc)
        .exclude(khach="")
        .values(
            "khach",
            "la_bot",
            "ten_bot",
            "da_dang_nhap",
            "trinh_duyet",
            "thiet_bi",
            "duong_dan",
            "luc",
        )
        # `-pk` là vế TẤT ĐỊNH: hai hàng cùng `luc` tới từng micro giây (seed của một bài
        # đo, hoặc hai lượt trong cùng một request) sẽ ra thứ tự tuỳ Postgres, và khi ấy
        # `duong_dan` "gần nhất" của một dòng nhảy giữa hai lượt bấm F5.
        .order_by("-luc", "-pk")[:SO_HANG_QUET]
    )
    # `==` chứ không `>=`: `[:N]` không trả về nhiều hơn N bao giờ. Đúng N hàng nghĩa là
    # "có thể còn nữa" — cờ này báo NGHI NGỜ bị cắt, và báo thừa một lần ở đúng con số
    # tròn trịa ấy rẻ hơn nhiều so với một danh sách thiếu mà không ai biết.
    bi_cat = len(hang) == SO_HANG_QUET

    gom: dict[str, KhachOnlineOut] = {}
    for h in hang:
        da_co = gom.get(h["khach"])
        if da_co is not None:
            # Hàng đến sau trong danh sách `-luc` là hàng CŨ hơn ⇒ chỉ cộng số lượt, mọi
            # trường khác giữ của lượt gần nhất (hàng đầu tiên gặp).
            da_co.so_luot += 1
            continue
        gom[h["khach"]] = KhachOnlineOut(
            # Đánh số lại sau khi cắt — xem cuối hàm.
            stt=0,
            la_bot=h["la_bot"],
            ten_bot=h["ten_bot"],
            da_dang_nhap=h["da_dang_nhap"],
            trinh_duyet=h["trinh_duyet"],
            thiet_bi=h["thiet_bi"],
            duong_dan=che_duong_dan(h["duong_dan"]),
            # `max(0, …)`: hàng có `luc` ở TƯƠNG LAI (đồng hồ lệch, hoặc seed của một bài
            # đo) không được ra "-3 giây trước". Nó không phải lỗi đáng chặn — chỉ là một
            # con số không được phép hiện ra dưới dạng vô nghĩa.
            giay_truoc=max(0, int((bay_gio - h["luc"]).total_seconds())),
            so_luot=1,
        )

    # `dict` giữ thứ tự chèn, và thứ tự chèn CHÍNH LÀ `-luc` của lượt gần nhất mỗi khách
    # — không cần sắp lại. Cắt sau khi gom, không trước: cắt trước là cắt nhầm sang
    # `so_luot` của những dòng còn ở lại.
    danh_sach = list(gom.values())[:SO_DONG_ONLINE]
    # Số thứ tự gán SAU khi cắt, và chỉ có nghĩa trong ĐÚNG response này — xem
    # `KhachOnlineOut.stt`. Không có gì ở đây sống qua hai lần gọi.
    for i, k in enumerate(danh_sach, 1):
        k.stt = i
    return danh_sach, bi_cat, len(gom)


@router.get(
    "/luot-xem/online",
    response={200: OnlineOut, 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_luot_xem_online",
    tags=["quan-tri-luot-xem"],
)
def luot_xem_online(request, response: HttpResponse):
    """Ai đang online trong 5 phút gần nhất — một dòng cho mỗi *khách ước lượng*.

    Không nhận tham số nào: cửa sổ, trần quét và trần dòng đều cố định phía server.
    """
    # GHI CHÚ NỘI BỘ — django-ninja đổ docstring của view vào `description` của OpenAPI.
    #
    # `tong` gọi THẲNG `_dem_online()`, tức đúng cái hàm ô KPI của `GET /admin/luot-xem`
    # gọi. Không phải `len(items)`, và cám dỗ viết `len(items)` là có thật vì nó ngắn hơn
    # và "trông hiển nhiên đúng":
    #
    #   - `items` gồm CẢ bot ⇒ `len(items)` phồng lên đúng bằng số bot đang quét;
    #   - `items` bị chặn ở `SO_DONG_ONLINE`, còn `_dem_online()` thì không;
    #   - `items` bị chặn ở `SO_HANG_QUET` hàng thô, `_dem_online()` cũng không.
    #
    # Ba chỗ ấy đều trả HTTP 200 và một con số chỉ hơi khác — đúng loài lỗi mà ô KPI nói
    # "5" còn modal liệt kê 7 dòng. `tests/test_api_quan_tri_luot_xem.py::test_N4_*` so
    # thẳng hai endpoint trên cùng dữ liệu.
    #
    # Mod thường xem được (không đòi `is_superuser`): endpoint chỉ đọc, và nó không phơi
    # danh tính ai — xem khối ranh giới ở `quan_tri_schemas.py::KhachOnlineOut`.
    response["Cache-Control"] = "no-store"
    # ⚠ MỘT phép đọc đồng hồ cho cả response, truyền xuống cả hai hàm. Để mỗi hàm tự gọi
    # `_moc_online()` là hai cửa sổ lệch nhau vài mili giây, và bất biến N4 gãy ở đúng
    # lúc site đông nhất — không tái hiện được. Xem `_moc_online`.
    moc = _moc_online()
    items, bi_cat, so_dong_that = _gom_online(moc)
    return OnlineOut(
        items=items,
        tong=_dem_online(moc),
        bi_cat=bi_cat,
        so_dong_that=so_dong_that,
    )
