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

UA được **gửi** sang để phân loại (`core/bot.py`) rồi **vứt đi**; chỉ tên bot chuẩn hoá
được lưu. Xem `core/models/luot_xem.py` — đó là quyết định của user, và là lý do trang
thống kê này không cần banner cookie.
"""

from django.conf import settings
from ninja import Router, Schema, Status
from ninja.security import APIKeyHeader

from core.bot import ten_bot
from core.models.luot_xem import LuotXem

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
    """Thân request. Hai trường, và không trường nào nhận diện được một con người."""

    duong_dan: str
    #: User-Agent thô — **dùng rồi vứt**. Không có cột nào trong DB nhận nó.
    user_agent: str = ""


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
    ten = ten_bot(du_lieu.user_agent)
    LuotXem.objects.create(
        duong_dan=chuan_hoa_duong_dan(du_lieu.duong_dan),
        la_bot=ten != "",
        ten_bot=ten,
    )
    return Status(200, DemLuotXemOut(da_dem=True))
