"""`NinjaAPI` thứ hai — khu quản trị, prefix `/api/admin` (PLAN mục 7 dòng cuối, 5.10).

**Đây là API thứ hai của dự án, nên nó phải làm ĐỦ 3 VIỆC** (docstring
`config/api_registry.py` giải thích từng cái chuông):

1. mount vào `config/urls.py` — `path("api/admin/", api_admin.urls)`;
2. đăng ký vào `config/api_registry.py::NINJA_APIS` với khoá `"admin"`;
3. thêm subpath `"./admin": "./src-admin/index.ts"` vào `packages/api-client/package.json`.

Ba hàng rào che ba việc đó: `tests/test_api_registry.py`, `pnpm codegen:check`,
`scripts/rao-can-exports.mjs`.

## Ba lớp che, và chỉ lớp thứ ba là lớp CHẶN THẬT ở dev

1. **Caddy** (prod, PLAN 8.2): `gikky.net/api/admin/*` → 403 trước cả rule proxy;
2. **Host** (`config/host_admin.py`): mô phỏng lớp 1 ở dev. Đọc docstring ở đó về việc
   nó **không** tách được hai app Next ở dev — đừng tính nó là hàng rào phân quyền;
3. **Permission** (`ChiMod` dưới đây): `is_staff`, còn `is_active`, chưa bị ban. Đây là
   lớp duy nhất đúng ở mọi môi trường, nên nó là lớp phải có test cho **từng** endpoint —
   xem `tests/test_api_quan_tri_phan_quyen.py`, nó tự đối chiếu bảng test với danh sách
   operation thật và đỏ khi có endpoint chưa được chấm.

## CSRF

`ChiMod` kế thừa `APIKeyCookie`, và `APIKeyCookie.__init__(csrf=True)` là mặc định của
django-ninja: mỗi request GHI đi qua `CsrfViewMiddleware.process_view` thật. Bắt buộc
phải giữ — session cookie mà không CSRF là một form trên trang bất kỳ ẩn được mạch của
người khác. Django `CsrfViewMiddleware` toàn cục **không** che các view này (Ninja tự đặt
`csrf_exempt = True` trên view wrapper rồi tự gọi lại `check_csrf`), nên tắt cờ đó ở đây
là tắt CSRF hoàn toàn chứ không phải "để middleware lo".

Ninja báo CSRF hỏng bằng `HttpError(403, "CSRF check Failed")` — hình dạng `{detail}`
không có `code`. `_xu_ly_http_error` dưới đây kéo nó về `{detail, code}` của PLAN mục 7.
"""

import logging

from django.conf import settings
from django.middleware.csrf import get_token
from ninja import NinjaAPI, Schema
from ninja.errors import AuthenticationError, HttpError
from ninja.security import APIKeyCookie

from api.loi import (
    CHUA_DANG_NHAP,
    CSRF_THAT_BAI,
    KHONG_DU_QUYEN,
    THAM_SO_KHONG_HOP_LE,
    LoiOut,
    dang_ky_xu_ly_loi,
)
from api.quyen import dang_ky_binh_luan_bien_mat
from api.v1 import duong_dan_docs

logger = logging.getLogger(__name__)


class ChiMod(APIKeyCookie):
    """Session cookie + `is_staff`. Trả `None` là Ninja ném `AuthenticationError`.

    Bốn điều kiện, và ba cái sau không phải trang trí:

    - `is_authenticated` — có phiên;
    - `is_staff` — PLAN mục 7 gọi khu này là "staff-only". Cột này là cột duy nhất đánh
      dấu mod; không dựng thêm một bảng vai trò nào ở v1;
    - `is_active` — Django coi `is_active=False` là tài khoản đã vô hiệu hoá, và
      `core/models/nguoi_dung.py` dùng đúng cờ đó cho "xoá tài khoản GDPR-lite". Một hàng
      `User` đã ẩn danh hoá mà còn `is_staff=True` vẫn moderate được là một cửa hậu sống
      sau khi người ta rời đi;
    - `dang_bi_ban()` — mod bị ban thì không được moderate. Không có phép kiểm này thì
      hành động "ban một mod đang lạm quyền" **không chặn được gì cả**: phiên đang mở của
      họ vẫn ẩn/khoá được cho tới lúc cookie hết hạn.

      ⚠ **Câu ở đây trước lượt vá V1 nói rằng ban "chỉ chặn được đường ĐĂNG NHẬP", và câu
      đó SAI** (L18). Hôm nay gikky **không có adapter allauth nào** (`grep "ADAPTER"` chỉ
      ra đúng `ACCOUNT_ADAPTER` của hạn mức đăng ký, xem `core/allauth_adapter.py`), nên
      một tài khoản bị ban **vẫn đăng nhập được bình thường**. `dang_bi_ban()` chỉ được
      hỏi ở hai chỗ: lớp này, và `api/quyen.py::DangNhap` (mọi cửa GHI). Cơ chế vì thế vẫn
      an toàn — ghi 403, moderate 403 — nhưng nó an toàn theo một đường khác với đường mà
      câu cũ mô tả, và PLAN 5.10 (*"hiện lý do khi bị chặn đăng nhập"*) vẫn **chưa** được
      cài. Nợ có tên `BAN-CHUA-CHAN-DANG-NHAP` trong `LOI-VA-NO.md`; chỗ trả nó là
      `core/allauth_adapter.py`, hook `pre_login`.

    `param_name` phải là tên cookie session: `APIKeyCookie` dùng nó cho `securitySchemes`
    của OpenAPI. Xác thực thật thì đọc `request.user` (Django `AuthenticationMiddleware`
    đã dựng sẵn), không tự giải mã cookie — `key` ở đây chỉ để Ninja biết chỗ mà tả.
    """

    param_name: str = settings.SESSION_COOKIE_NAME
    openapi_name: str = "session cookie (staff)"

    def authenticate(self, request, key):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return None
        if not user.is_active or not user.is_staff:
            return None
        if user.dang_bi_ban():
            return None
        return user


api_admin = NinjaAPI(
    title="gikky.net API quản trị",
    version="1.0.0",
    description=(
        "Khu quản trị — staff-only (PLAN 5.10). Mọi endpoint đòi session cookie của một "
        "tài khoản `is_staff`, còn hoạt động và không bị ban; mọi request ghi đòi CSRF. "
        "Chỉ tới được qua host quản trị (PLAN 8.2)."
    ),
    # BẮT BUỘC khác `api_v1`: django-ninja lấy namespace mặc định từ `version`, nên hai
    # API cùng version 1.0.0 sẽ đăng ký trùng namespace và `reverse()` trả sai đường.
    urls_namespace="api-admin",
    auth=ChiMod(),
    **duong_dan_docs(settings.DEBUG),
)

dang_ky_xu_ly_loi(api_admin)
# L38 (2026-08-23). Khu quản trị **không** gọi `dang_ky_xu_ly_loi_ghi` vì nó có bản
# auth/CSRF riêng ngay dưới — nhưng nó vẫn có đường ghi đụng `Comment`
# (`dat_an_binh_luan`), nên nó vẫn cần đúng lưới ấy. Thiếu dòng này: tác giả xoá thật đúng
# lúc mod bấm "Ẩn" ⇒ 500 ở khu quản trị, trong khi `api_v1` trả 409 cho cùng cuộc đua.
dang_ky_binh_luan_bien_mat(api_admin)


@api_admin.exception_handler(AuthenticationError)
def _xu_ly_thieu_quyen(request, exc):
    """401 khi chưa đăng nhập, 403 khi đã đăng nhập mà không đủ quyền.

    Ninja gộp cả hai vào một ngoại lệ (auth callable chỉ trả `None`), nên chỗ duy nhất
    tách được chúng là đây — và tách được vì `request.user` đã có sẵn.

    Một dòng log `warning` cho ca 403: người đã đăng nhập gõ vào khu quản trị là thứ đáng
    nhìn thấy trong log, khác hẳn ca 401 vốn chỉ là "cookie hết hạn".
    """
    user = getattr(request, "user", None)
    if user is not None and user.is_authenticated:
        logger.warning(
            "quản trị: user %r (staff=%s) bị từ chối ở %s",
            getattr(user, "username", "?"),
            getattr(user, "is_staff", None),
            request.path,
        )
        return api_admin.create_response(
            request,
            LoiOut(
                detail="Tài khoản này không có quyền quản trị.", code=KHONG_DU_QUYEN
            ),
            status=403,
        )
    return api_admin.create_response(
        request,
        LoiOut(detail="Cần đăng nhập bằng tài khoản quản trị.", code=CHUA_DANG_NHAP),
        status=401,
    )


@api_admin.exception_handler(HttpError)
def _xu_ly_http_error(request, exc: HttpError):
    """Kéo `HttpError` của Ninja về `{detail, code}` — PLAN mục 7.

    Nguồn DUY NHẤT của ngoại lệ này trong khu quản trị là `APIKeyCookie._get_key` khi
    CSRF hỏng (`HttpError(403, "CSRF check Failed")`); không handler nào ở đây tự ném
    `HttpError`. Vì thế 403 được ánh xạ thẳng sang `csrf_that_bai` — nếu ngày nào đó có
    chỗ khác ném `HttpError(403, …)` thì mã này sẽ nói sai, và lúc ấy phải mang theo mã
    riêng chứ không nới câu điều kiện dưới đây.
    """
    ma = CSRF_THAT_BAI if exc.status_code == 403 else THAM_SO_KHONG_HOP_LE
    return api_admin.create_response(
        request, LoiOut(detail=str(exc), code=ma), status=exc.status_code
    )


class ModOut(Schema):
    """Danh tính của mod đang đăng nhập — đủ để header admin hiện tên và mở khoá UI."""

    username: str
    display_name: str
    is_superuser: bool


@api_admin.get(
    "/me",
    response={200: ModOut, 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_toi",
    tags=["quan-tri"],
)
def toi(request):
    """Mod đang đăng nhập là ai. Trả 401 nếu chưa đăng nhập, 403 nếu không phải staff.

    Đây cũng là endpoint **gieo cookie CSRF** cho khu quản trị: app admin gọi nó khi mở
    trang, rồi mọi request ghi sau đó gửi kèm `X-CSRFToken` đọc từ cookie ấy.
    """
    # `get_token` đặt cờ để `CsrfViewMiddleware` ghi cookie `csrftoken` vào response.
    # Không có nó thì trang admin vừa tải xong chưa có token nào, và nút bấm ĐẦU TIÊN
    # của mỗi phiên ăn 403 — một lỗi chỉ xuất hiện ở lần bấm đầu, tức lỗi khó tin nhất.
    get_token(request)
    return ModOut(
        username=request.user.username,
        display_name=request.user.display_name,
        is_superuser=request.user.is_superuser,
    )


# Mount ở CUỐI file, cùng lý do như `api/v1.py`: các router import `api.quan_tri_schemas`
# và `api.loi`, còn `api_admin` phải tồn tại trước khi `config/api_registry.py` đọc tới.
from api.quan_tri_bang import router as router_bang  # noqa: E402
from api.quan_tri_bao_cao import router as router_bao_cao  # noqa: E402
from api.quan_tri_kiem_duyet import router as router_kiem_duyet  # noqa: E402
from api.quan_tri_nguoi_dung import router as router_nguoi_dung  # noqa: E402
from api.quan_tri_nhat_ky import router as router_nhat_ky  # noqa: E402
from api.quan_tri_sub import router as router_sub  # noqa: E402
from api.quan_tri_thong_ke import router as router_thong_ke  # noqa: E402

api_admin.add_router("", router_bao_cao)
api_admin.add_router("", router_bang)
api_admin.add_router("", router_kiem_duyet)
api_admin.add_router("", router_nguoi_dung)
api_admin.add_router("", router_nhat_ky)
api_admin.add_router("", router_sub)
api_admin.add_router("", router_thong_ke)
