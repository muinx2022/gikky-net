"""Cửa nhận lượt xem trang từ `apps/web/middleware.ts` — chốt 2026-08-27.

Chiều gọi: **Next → Django**, ngược với `core/revalidate.py` (Django → Next).

## Vì sao lượt xem không tự đếm được ở Django

Trang là của Next; Django chỉ phục vụ `/api/*`. Một middleware Django sẽ đếm **API
call**, không phải lượt xem — một con số trông như thật mà sai hoàn toàn, và không có gì
báo. Chỗ duy nhất thấy được lượt xem là middleware của Next: nó chạy **trước cache ISR**
(nên vẫn thấy request được phục vụ từ bản cache) và chạy **trên máy chủ** (nên thấy cả
bot, thứ mà mọi cách đếm bằng script trong trình duyệt đều mù).

## Auth là một SECRET HEADER, không phải phiên đăng nhập

Đây là endpoint ghi duy nhất của `api_v1` không có người dùng đứng sau, nên nó cũng là
endpoint duy nhất không khai `auth=dang_nhap`. Ba điều phải giữ cùng nhau:

1. **Nó vẫn khai `auth=`.** `tests/test_quyen_ghi.py::test_moi_operation_ghi_deu_co_auth`
   đòi mọi operation không-GET của cả hai `NinjaAPI` phải có `auth`, và đòi vì một lý do
   thật: ở django-ninja 1.6, `auth=None` là mất **cả CSRF** (phép kiểm ấy nằm trong lớp
   auth). Lớp `SecretDemLuotXem` dưới đây là auth thật, không phải một cách lách hàng rào;
2. **Không kèm header ⇒ trả `None` ⇒ 401 `chua_dang_nhap`**, đúng như mọi cửa ghi khác
   (`tests/test_quyen_ghi.py::test_khach_khong_ghi_duoc_gi` chạy cả trên cửa này). Khách
   bằng trình duyệt không ghi được gì vào đây;
3. **CSRF không áp dụng, và đó không phải một lỗ.** Mối lo CSRF là *"trang lạ POST bằng
   cookie phiên của người đang đăng nhập"*. Cửa này không đọc `request.user`, không ghi
   gì gắn với một người, và đòi một **header tự đặt** — thứ trình duyệt chỉ gửi được sau
   một lượt preflight CORS mà ta không cho qua. Ambient credential không tồn tại ⇒ không
   có gì để giả mạo.

## Ba nhánh, theo đúng thứ tự này

| Tình huống | Trả về | Ghi DB |
|---|---|---|
| không có header | 401 `chua_dang_nhap` | không |
| có header, **secret ở server RỖNG** | 503 `dem_luot_xem_tat` | không |
| có header nhưng sai | 401 `sai_secret` | không |
| khớp | 200 `{da_dem: true}` | **đúng một hàng** |

Nhánh 503 là fail-closed, cùng khuôn với `app/lam-moi-cache/route.ts`, và là trạng thái
mặc định của máy dev lẫn của `pytest`: **không đếm còn hơn đếm sai**. Trả 503 chứ không
200-im-lặng để người vừa bật cơ chế biết là nó chưa bật.

Xét header trước secret server là có chủ đích: nó giữ cho câu trả lời với **khách** giống
hệt mọi cửa ghi khác, bất kể máy đó có bật thống kê hay không.

## Không lưu User-Agent, không lưu IP

UA và IP được **gửi** sang để suy ra bốn cột dẫn xuất (`ten_bot` · `khach` · `trinh_duyet`
· `thiet_bi`) rồi **vứt đi**; không cột nào chứa chúng. Xem `core/models/luot_xem.py` —
đó là quyết định của user, và là lý do trang thống kê này không cần banner cookie.

## Khách duy nhất theo ngày (2026-08-30) — muối, không phải cookie

`khach = sha256(muối-của-ngày | ip | ua)[:32]`. Muối sinh ngẫu nhiên mỗi ngày và bị
`gom_luot_xem` **huỷ** khi ngày đóng, nên:

- trong ngày: cùng người ⇒ cùng token ⇒ đếm được khách;
- qua ngày: muối khác ⇒ token khác ⇒ **không nối được hai ngày**, kể cả bởi người cầm DB;
- sau khi ngày đóng: muối không còn ⇒ không ai dò ngược token bằng cách thử IP.

⚠ Muối đọc qua **cache tiến trình** — đây là đường ghi nóng nhất của cả site, và một
query `MuoiNgay` cho mỗi lượt xem trang là cái giá không cần trả.
"""

import hashlib
import secrets
from datetime import date
from urllib.parse import urlsplit

from django.conf import settings
from ninja import Router, Schema, Status
from ninja.security import APIKeyHeader

from core.bot import ten_bot
from core.models.luot_xem import LuotXem, MuoiNgay
from core.nhan_dien_ua import thiet_bi, trinh_duyet
from core.thoi_gian import ngay_vn

from api.loi import LoiOut
from api.quyen import LoiGhi

router = Router()

#: Header mang secret. **Không dùng query string** — cùng lý do với
#: `apps/web/lib/lam-moi-cache.ts::HEADER_SECRET`: query nằm lại trong access log của mọi
#: tầng proxy, tức secret bị ghi ra đĩa dạng thô, vĩnh viễn.
#:
#: `apps/web/lib/dem-luot-xem.ts` có bản thứ hai của chuỗi này (hai tiến trình, hai ngôn
#: ngữ, không có package chung cho tầng ấy) — `e2e/don-vi/dem-luot-xem.spec.ts` đọc cả
#: hai file và đỏ nếu chúng lệch.
HEADER_SECRET = "X-Dem-Luot-Xem-Secret"

#: Cửa đang tắt vì server chưa đặt `DEM_LUOT_XEM_SECRET`. 503.
DEM_LUOT_XEM_TAT = "dem_luot_xem_tat"
#: Có header nhưng không khớp. 401.
SAI_SECRET = "sai_secret"

#: Bằng ĐÚNG `LuotXem.duong_dan.max_length`. Đường dài hơn bị **cắt**, không bị từ chối:
#: một URL 300 ký tự là một trang có thật mà ai đó đã xem, và ném nó đi là mất một lượt
#: xem thật để đổi lấy một sự chính xác không ai cần trong bảng "xem nhiều nhất".
DAI_TOI_DA_DUONG_DAN = 200


class SecretDemLuotXem(APIKeyHeader):
    """Auth bằng secret dùng chung. Xem bảng ba nhánh ở docstring module.

    Đọc `settings` **tại thời điểm gọi**, không chụp vào một hằng tầng module: một hằng
    chụp lúc import làm nhánh 503 không đo được — bài đo không có cách nào dựng lại module
    với một giá trị env khác. Đúng bài học của `secretCuaCua()` ở
    `apps/web/lib/lam-moi-cache.ts` (L23).
    """

    param_name: str = HEADER_SECRET
    openapi_name: str = "secret đếm lượt xem"

    def authenticate(self, request, key):
        if key is None:
            # Không xuất trình gì cả ⇒ để django-ninja ném `AuthenticationError`, và
            # handler chung của `api_v1` biến nó thành 401 `chua_dang_nhap` — cùng câu
            # trả lời mọi cửa ghi khác dành cho khách.
            return None
        if not settings.DEM_LUOT_XEM_SECRET:
            raise LoiGhi(
                503,
                DEM_LUOT_XEM_TAT,
                "DEM_LUOT_XEM_SECRET chưa đặt — cửa đếm lượt xem đang tắt. "
                "Thêm dòng đó vào `api/.env` nếu muốn bật thống kê.",
            )
        if key != settings.DEM_LUOT_XEM_SECRET:
            # Câu trần, không nói secret sai ở chỗ nào.
            raise LoiGhi(401, SAI_SECRET, "sai secret")
        # Không có `User` nào để trả. Trả một giá trị **truthy** bất kỳ là đủ cho
        # django-ninja coi là đã xác thực; `request.auth` không được handler dưới đọc tới.
        return True


secret_dem_luot_xem = SecretDemLuotXem()


class DemLuotXemIn(Schema):
    """Thân request. Bốn trường, và **ba trường sau đều có mặc định**.

    ⚠ **Backward-compatible là BẮT BUỘC, không phải lịch sự.** Deploy không nguyên tử:
    trong cửa sổ giữa lúc Django mới lên và lúc `apps/web` mới lên, prod đang chạy
    middleware CŨ gửi đúng hai trường `{duong_dan, user_agent}`. Bắt buộc `ip`/`referer`
    là mọi lượt xem trong cửa sổ ấy trả 422 và biến mất — im lặng, vì middleware
    `.catch(() => {})` mọi lỗi. `tests/test_api_dem_luot_xem.py` ghim đúng ca này.
    """

    duong_dan: str
    #: User-Agent thô — **dùng rồi vứt**. Không có cột nào trong DB nhận nó.
    user_agent: str = ""
    #: IP của khách, **chỉ transit**: vào hàm băm rồi hết. Không log, không lưu, không
    #: xuất hiện trong bất kỳ thông báo lỗi nào. Rỗng ở dev (không có proxy) ⇒ hash rơi về
    #: UA-only, tức "khách" ở dev thô hơn ở prod — chấp nhận, xem `lib/dem-luot-xem.ts`.
    ip: str = ""
    #: Referer thô — **chỉ tên miền được giữ** (`chuan_hoa_nguon`). Lưu cả URL là ghi
    #: credential vào DB: referer nội bộ có thể là `/dat-lai-mat-khau/{key}`.
    referer: str = ""


class DemLuotXemOut(Schema):
    """`{da_dem}` — `True` khi đã ghi một hàng.

    Middleware **không đọc** trường này (nó không `await` lời gọi), nhưng bài đo và người
    gõ `curl` thì có, và một endpoint trả thân rỗng là một endpoint không ai kiểm được
    bằng tay.
    """

    da_dem: bool


def chuan_hoa_duong_dan(duong_dan: str) -> str:
    """Bỏ query string + fragment, rồi cắt còn `DAI_TOI_DA_DUONG_DAN` ký tự.

    **Bỏ query là bắt buộc, không phải dọn dẹp cho đẹp**: `?utm_source=…` đẻ vô hạn biến
    thể của cùng một trang, và bảng "xem nhiều nhất" sẽ vỡ thành hàng nghìn dòng mỗi dòng
    một lượt — tức đúng câu hỏi của user không trả lời được nữa.

    ⚠ **Thứ tự hai phép ở đây KHÔNG quan trọng, và ghi ra để không ai "sửa" nhầm.** Bản
    đầu của file này khẳng định phải cắt *sau* khi bỏ query, kèm lý do nghe rất xuôi (cắt
    trước thì còn lại một mẩu query cụt). Lượt thử phá chứng minh câu đó **sai**: với `i`
    là vị trí dấu `?`, cả hai lối đều ra `duong_dan[:min(200, i)]` — không có ca nào tách
    được chúng. Nên đừng viết một bài đo "ghim thứ tự": nó sẽ xanh với mọi cách cài, tức
    là một bài đo rỗng.

    ## Bỏ dấu `/` cuối — cùng một trang, một dòng

    `/m/abc-1/` và `/m/abc-1` là **cùng một trang**: Next trả 308 từ cái trước sang cái
    sau, và middleware chạy cho **cả hai** request ⇒ hai hàng `LuotXem`, hai dòng riêng
    trong bảng "xem nhiều nhất", một lượt xem đếm thành hai. Không sai chức năng, chỉ sai
    số — và sai theo kiểu không ai nhìn ra vì hai dòng trông như hai trang khác nhau.
    Lượt phản biện 2026-08-27 tìm ra.

    Trang chủ `"/"` là ngoại lệ: bỏ dấu `/` của nó thì còn chuỗi rỗng.
    """
    sach = duong_dan.split("?", 1)[0].split("#", 1)[0][:DAI_TOI_DA_DUONG_DAN]
    return sach.rstrip("/") or "/"


def _host_cua_site() -> set[str]:
    """Tập hostname của **chính site**: `HEADLESS_FRONTEND_URLS` ∪ `ADMIN_HOSTS`.

    Đọc từ hai chỗ đó chứ không thêm một biến cấu hình mới: đấy đã là chỗ khai origin
    của frontend (và là nguồn mà chuông "đường mang bí mật" ở
    `e2e/don-vi/dem-luot-xem.spec.ts` đang đọc), còn `ADMIN_HOSTS` đã là danh sách host
    của khu quản trị. Hai luật cùng nhìn một chỗ thì không lệch được.

    `ADMIN_HOSTS` phải có mặt vì mod bấm link từ `admin.gikky.net` sang site công khai
    là **điều hướng nội bộ**, không phải một nguồn truy cập — thiếu nó thì host khu quản
    trị leo vào bảng "Nguồn truy cập" như một site bên ngoài dẫn người tới (lượt phản
    biện 2026-08-30 tìm ra). Mục của nó mang dạng `host[:port]` chứ không phải URL, nên
    cắt port trước khi so — `urlsplit().hostname` của referer không bao giờ mang port.

    Đọc **tại thời điểm gọi**, không chụp vào hằng tầng module: `override_settings` trong
    bài đo phải đổi được kết quả, y như `SecretDemLuotXem.authenticate`.
    """
    host = set()
    for url in settings.HEADLESS_FRONTEND_URLS.values():
        try:
            h = urlsplit(url).hostname
        except ValueError:  # pragma: no cover - cấu hình hỏng tới mức này thì đã nổ sớm
            continue
        if h:
            host.add(_bo_www(h.lower()))
    for muc in settings.ADMIN_HOSTS:
        h = muc.split(":", 1)[0].strip().lower()
        if h:
            host.add(_bo_www(h))
    return host


def _bo_www(host: str) -> str:
    return host[4:] if host.startswith("www.") else host


#: Bằng ĐÚNG `LuotXem.nguon.max_length`. Tên miền dài hơn thế gần như chắc chắn là rác.
DAI_TOI_DA_NGUON = 100


def chuan_hoa_nguon(referer: str) -> str:
    """Tên miền của referer, hoặc `""`. **Không bao giờ trả về path hay query.**

    `""` gộp ba ca, và trang gọi chung là "(trực tiếp / nội bộ)":

    1. không có referer (gõ thẳng, bookmark, app);
    2. referer từ **chính site** — điều hướng nội bộ, không phải một nguồn truy cập;
    3. referer không parse ra hostname (rác, `about:blank`, URL cụt).

    ## ⚠ Ca 2 là một hàng rào riêng tư, không phải một phép dọn dẹp cho gọn

    Trang `/dat-lai-mat-khau/{key}` mang **khoá còn sống** ngay trên đường dẫn. Mọi link
    người ta bấm từ trang ấy gửi kèm `Referer: https://gikky.net/dat-lai-mat-khau/<khoá>`.
    Lưu referer đầy đủ là ghi credential vào bảng thống kê — đúng thứ mà `nenDem()` bên
    Next đã bỏ công chặn ở đường trực tiếp. Ở đây cả hai lớp cùng chặn: chỉ hostname được
    giữ, **và** hostname của chính site quy về `""`.
    """
    try:
        host = urlsplit(referer).hostname
    except ValueError:
        # `urlsplit` ném với IPv6 cụt (`http://[::1`) và vài dạng port hỏng. Referer là
        # chuỗi do client tự khai, nên một thân request cố tình méo không được phép làm
        # đổ một lượt đếm.
        return ""
    if not host:
        return ""
    host = _bo_www(host.lower())
    if host in _host_cua_site():
        return ""
    return host[:DAI_TOI_DA_NGUON]


#: Cache muối của **đúng một ngày** — ngày đang chạy. Đổi ngày là thay cả dict, nên bảng
#: không phình và không có muối cũ nào nằm lại trong RAM sau nửa đêm.
#:
#: ⚠ Cache theo TIẾN TRÌNH, và mỗi worker gunicorn có bản riêng. Chúng hội tụ về cùng một
#: giá trị vì `get_or_create` khoá ở DB (`ngay` là `unique`), nên hai worker không thể
#: sinh hai muối khác nhau cho cùng một ngày.
#:
#: ⚠ `pytest` cuộn ngược mọi transaction, nên một muối cache lại từ bài đo trước sẽ trỏ
#: tới một hàng KHÔNG CÒN TỒN TẠI. `tests/conftest.py` có fixture autouse dọn cache này
#: trước mỗi bài; thiếu nó thì bài "muối được sinh ra" xanh/đỏ tuỳ thứ tự chạy.
_CACHE_MUOI: dict[date, str] = {}


def xoa_cache_muoi() -> None:
    """Dọn cache muối. Chỉ dùng cho bài đo — xem docstring `_CACHE_MUOI`."""
    _CACHE_MUOI.clear()


def muoi_cua_ngay(ngay: date) -> str:
    """Muối của `ngay`, sinh ra ở lượt xem đầu tiên trong ngày. Có cache tiến trình.

    Không tự bắt `IntegrityError`: `get_or_create` đã làm đúng việc ấy trong một savepoint
    (`create` → bắt `IntegrityError` → `get` lại). Viết lại bằng tay là dựng bản thứ hai
    của cùng một cơ chế, và bản viết tay hay quên savepoint — mà thiếu savepoint thì cả
    transaction ngoài chết theo, tức lượt xem sau cũng hỏng.
    """
    da_co = _CACHE_MUOI.get(ngay)
    if da_co is not None:
        return da_co
    # Lượt ĐẦU TIÊN của tiến trình trong ngày: huỷ muối mọi ngày cũ NGAY Ở ĐƯỜNG GHI,
    # không đợi cron. `gom_luot_xem` cũng xoá (lưới thứ hai — và là lưới duy nhất cho
    # ngày không có lượt xem nào), nhưng "muối bị huỷ khi ngày đóng" là một cam kết
    # RIÊNG TƯ in trên màn hình mod, và nó không được phép treo trên một cron mà runbook
    # mô tả là "chết thì bạn không thấy gì sai" — cron chết 30 ngày là 30 hàng muối còn
    # sống, đủ cho ai cầm DB nối một người qua từng ngày. Lượt phản biện 2026-08-30 tìm
    # ra. Chỉ chạy ở nhánh cache-miss (một lần mỗi tiến trình mỗi ngày) nên không phải
    # chi phí trên đường nóng; hai worker cùng miss thì hai lượt DELETE idempotent.
    MuoiNgay.objects.filter(ngay__lt=ngay).delete()
    hang, _ = MuoiNgay.objects.get_or_create(
        ngay=ngay, defaults={"muoi": secrets.token_hex(32)}
    )
    # Thay CẢ dict, không `[ngay] =`: giữ đúng một ngày trong RAM.
    _CACHE_MUOI.clear()
    _CACHE_MUOI[ngay] = hang.muoi
    return hang.muoi


def hash_khach(muoi: str, ip: str, user_agent: str) -> str:
    """Token khách của ngày, 32 ký tự hex. `""` khi **cả** IP lẫn UA đều rỗng.

    `""` nghĩa là *"không đo được"*, KHÔNG phải *"một khách chung"*: gộp mọi hàng không đo
    được vào một token là bịa ra đúng một khách ma, và ngày nào cũng có nó. Phía đọc loại
    hẳn `""` khỏi phép đếm distinct, rồi trả `None` cho ngày mà mọi hàng đều như thế.

    ⚠ **Dấu `|` KHÔNG phải một hàng rào chống va chạm**, và ghi ra để không ai viết một
    bài đo khẳng định ngược lại (bản đầu của lượt này đã viết, và nó đỏ ngay): `("1.2",
    "3|4")` và `("1.2|3", "4")` nối ra cùng một chuỗi. Ca ấy vô hại — IP không chứa `|`,
    nên chỉ một client tự đặt UA có `|` mới trộn được token của **chính nó** với một
    token khác, tức nhiều nhất là tự bớt đi một khách của mình. Chống nó tử tế cần khai
    độ dài từng phần, và đó là độ phức tạp không mua được gì ở đây.
    """
    if ip == "" and user_agent == "":
        return ""
    return hashlib.sha256(f"{muoi}|{ip}|{user_agent}".encode()).hexdigest()[:32]


@router.post(
    "/dem-luot-xem",
    response={200: DemLuotXemOut, 401: LoiOut, 503: LoiOut},
    operation_id="dem_luot_xem",
    tags=["luot-xem"],
    auth=secret_dem_luot_xem,
)
def dem_luot_xem(request, du_lieu: DemLuotXemIn):
    """Ghi một lượt xem trang. Đòi header secret dùng chung giữa Next và Django."""
    # GHI CHÚ NỘI BỘ — django-ninja đổ docstring của view vào `description` của OpenAPI,
    # nên lý lẽ triển khai nằm ở đây chứ không trong docstring (xem `api/v1.py::health`).
    #
    # Không có phép kiểm nào ở thân hàm: cả ba nhánh từ chối đã xảy ra ở lớp auth, tức
    # **trước khi** Ninja parse thân request. Đó là chủ đích — một thân JSON hỏng gửi kèm
    # secret sai không được phép ra một mã lỗi khác với thân JSON đúng gửi kèm secret sai.
    #
    # Thứ tự dưới đây có một ràng buộc thật: `trinh_duyet`/`thiet_bi` **chỉ suy cho lượt
    # người**. Một con bot khai UA của Chrome mà được ghi `trinh_duyet="chrome"` sẽ trộn
    # lưu lượng máy vào bảng "người đọc site bằng gì" — bảng vẫn đầy, chỉ là đo nhầm thứ.
    ten = ten_bot(du_lieu.user_agent)
    la_bot = ten != ""
    LuotXem.objects.create(
        duong_dan=chuan_hoa_duong_dan(du_lieu.duong_dan),
        la_bot=la_bot,
        ten_bot=ten,
        khach=hash_khach(
            muoi_cua_ngay(ngay_vn()), du_lieu.ip, du_lieu.user_agent
        ),
        nguon=chuan_hoa_nguon(du_lieu.referer),
        trinh_duyet="" if la_bot else trinh_duyet(du_lieu.user_agent),
        thiet_bi="" if la_bot else thiet_bi(du_lieu.user_agent),
    )
    return Status(200, DemLuotXemOut(da_dem=True))
