"""Ai được ghi, và lỗi từ chối trông thế nào — PLAN mục 7, 8.2, 5.10.

Phase 2 là phase đầu tiên có đường ghi, nên đây là chỗ ba thứ gặp nhau: **xác thực**
(có phải người dùng đã đăng nhập không), **CSRF** (request này có đến từ trang của
chúng ta không), và **phân quyền** (người này có được đụng vào đúng hàng này không).

Ba thứ đó cố ý nằm ở ba chỗ khác nhau và không thay được cho nhau:

- xác thực + CSRF: lớp `DangNhap` dưới đây, khai bằng `auth=` trên từng endpoint;
- phân quyền: hàm `doi_chu_so_huu` / `doi_chu_mach`, gọi TRONG thân handler — nó cần
  hàng dữ liệu, mà lớp auth thì chưa đọc hàng nào;
- hình dạng lỗi: `{detail, code}` (PLAN mục 7) — django-ninja mặc định trả
  `{"detail": "Unauthorized"}` **không có `code`**, nên phải kéo về đúng hợp đồng ở đây.

⚠ **CSRF của API v1 nằm trong lớp auth, không nằm ở `NinjaAPI(csrf=...)`.**
django-ninja 1.6 bỏ tham số đó; mọi view của nó `csrf_exempt` ở tầng middleware Django,
và `ninja.security.APIKeyCookie` (cha của `SessionAuth`) mới là chỗ chạy
`CsrfViewMiddleware`. Nghĩa là: **endpoint ghi khai `auth=None` là endpoint không có
CSRF** — trang lạ POST sang được bằng cookie phiên của người đang đăng nhập, HTTP 200,
không gì đỏ. `tests/test_quyen_ghi.py` là cái chuông: nó đòi MỌI operation không-GET của
`api_v1` phải có auth.
"""

from django.http import HttpRequest
from ninja.errors import AuthenticationError, HttpError
from ninja.security import SessionAuth

#: `CHUA_DANG_NHAP` được **tái xuất** từ `api/loi.py`, không khai lại ở đây (gộp mảng
#: A + C, 2026-08-23): khu quản trị của Phase 4 cần đúng mã ấy và đã đặt nó vào `loi.py`.
#: Hai hằng cùng tên cùng giá trị ở hai module là hai thứ trôi ra khỏi nhau lặng lẽ — đổi
#: một cái, cửa kia vẫn trả chuỗi cũ và không có gì đỏ. Người gọi cũ
#: (`from api.quyen import CHUA_DANG_NHAP`) không phải đổi gì.
from api.loi import CHUA_DANG_NHAP, LoiOut

#: Đã đăng nhập nhưng không phải chủ của thứ đang sửa/xoá. 403.
KHONG_PHAI_CHU = "khong_phai_chu"
#: Tài khoản đang bị khoá (PLAN 5.10). 403.
BI_KHOA = "bi_khoa"
#: Header `X-CSRFToken` thiếu hoặc không khớp cookie `csrftoken`. 403.
CSRF_KHONG_HOP_LE = "csrf_khong_hop_le"
#: Mạch bị mod khoá — đọc được, cấm mọi tương tác (PLAN 5.10). 403.
MACH_BI_KHOA = "mach_bi_khoa"
#: Mạch đã đóng sổ ⇒ không nối/sửa mốc được (PLAN 5.1). 409.
MACH_DA_DONG = "mach_da_dong"
#: Mạch đang mở ⇒ không "mở lại" được. 409.
MACH_DANG_MO = "mach_dang_mo"
#: Vượt 3 mốc/ngày lịch VN/mạch (PLAN 5.1). 429.
QUA_HAN_MUC_MOC = "qua_han_muc_moc"
#: Quá 7 ngày kể từ lúc đóng sổ (PLAN 5.1). 409.
HET_HAN_MO_LAI = "het_han_mo_lai"
#: Thao tác trên nội dung đã xoá / đã bị mod ẩn. 409.
NOI_DUNG_DA_GO = "noi_dung_da_go"
#: Dữ liệu gửi lên sai luật domain (figures hỏng, ngày tương lai, body rỗng…). 400.
DU_LIEU_KHONG_HOP_LE = "du_lieu_khong_hop_le"


class LoiGhi(HttpError):
    """`HttpError` mang thêm `code` — để lỗi ném từ giữa thân handler vẫn đúng hợp đồng.

    Vì sao cần một ngoại lệ chứ không phải `return loi(...)` như tầng đọc: đường ghi đi
    qua nhiều lớp (`api/…` → `core/ghi.py`), và một phép kiểm nằm sâu trong transaction
    không "return" ra tới handler được. Ném thì transaction cũng rollback đúng lúc.

    ⚠ **Không mang được `thu_lai_tu`** (`api/loi.py::LoiThoiGianOut`): exception handler ở
    cuối file này dựng đúng một schema — `LoiOut`. Cửa nào cần trường ấy thì `return`
    thẳng `loi_thoi_gian(...)`, và phép kiểm của nó vì thế phải nằm ở tầng handler.
    """

    def __init__(self, status_code: int, code: str, detail: str) -> None:
        self.code = code
        super().__init__(status_code, detail)


def _bi_khoa(user) -> bool:
    """Tài khoản có đang bị chặn không — PLAN 5.10 (`banned_until` / `ban_permanent`).

    Cột đã có từ Phase 1, khu quản trị đặt chúng là việc của Phase 4; nhưng **phép kiểm
    phải nằm ở Phase 2**, cùng lúc với đường ghi đầu tiên. Dựng cột trước rồi hẹn kiểm
    sau nghĩa là suốt một phase, ban là một trường DB không có tác dụng nào.

    ⚠ **Phép kiểm thật nằm ở `User.dang_bi_ban()`, không ở đây** (gộp mảng A + C,
    2026-08-23). Hàm này chỉ còn là cái tên mà cửa ghi gọi. Lý do gộp: ba cột ban được
    hỏi ở HAI cửa thuộc hai mảng khác nhau — cửa ghi (`DangNhap` ngay dưới) và cửa quản
    trị (`api/quan_tri.py::ChiMod`) — và bản chép tay thứ hai là bản sẽ quên rằng
    `banned_until` đã hết hạn thì hết ban. Không có gì đỏ khi nó quên: chỉ có một người
    bị khoá vĩnh viễn khỏi tài khoản của họ.

    `getattr` giữ lại để `AnonymousUser` (không có ba cột ấy) vẫn trả `False` thay vì nổ.
    """
    kiem = getattr(user, "dang_bi_ban", None)
    return bool(kiem()) if callable(kiem) else False


class DangNhap(SessionAuth):
    """Auth cho MỌI endpoint ghi: phiên hợp lệ + CSRF + tài khoản không bị khoá.

    Kế thừa `SessionAuth` để lấy nguyên phép kiểm CSRF của `APIKeyCookie` (xem docstring
    module) chứ không viết lại — viết lại là có hai bản của một luật bảo mật.

    Trả `None` ⇒ django-ninja ném `AuthenticationError` (401). Tài khoản bị khoá thì
    **403 kèm lý do** chứ không phải 401: 401 nói "bạn chưa đăng nhập", và người bị ban
    đang đăng nhập tử tế sẽ đi đăng nhập lại vòng vòng mà không bao giờ biết vì sao.
    """

    def authenticate(self, request: HttpRequest, key):
        user = request.user
        if not user.is_authenticated or not user.is_active:
            return None
        if _bi_khoa(user):
            raise LoiGhi(
                403,
                BI_KHOA,
                "Tài khoản của bạn đang bị khoá"
                + (f": {user.ban_reason}" if user.ban_reason else "."),
            )
        return user


#: Thể hiện dùng chung. Một object đủ — nó không giữ trạng thái nào theo request.
dang_nhap = DangNhap()


def doi_chu_so_huu(user, chu_id: int, cai_gi: str) -> None:
    """Ném 403 nếu `user` không phải chủ. Dùng cho sửa/xoá mốc và bình luận.

    **Cố ý KHÔNG có nhánh "trừ khi là staff"** ở Phase 2. Quyền mod là một trục riêng với
    hành động của chính chủ (PLAN 5.10: mod *ẩn*, tác giả *xoá*), và trộn hai trục vào
    một phép kiểm là cách một tài khoản staff lỡ tay sửa bài người khác mà `AuditLog`
    không có dòng nào. Khu quản trị là Phase 4 và nó đi cửa `/api/admin`.
    """
    if user.pk != chu_id:
        raise LoiGhi(403, KHONG_PHAI_CHU, f"Bạn không phải chủ {cai_gi} này.")


def doi_mach_tuong_tac_duoc(mach) -> None:
    """Mạch bị mod khoá thì **cấm mọi tương tác**, kể cả của chính tác giả (PLAN 5.10).

    Khoá (`locked_at`) là trục RIÊNG với đóng sổ (`status`): mạch đóng vẫn bình luận
    được, mạch khoá thì không. Gọi hàm này ở mọi đường ghi chạm vào mạch — kể cả vote và
    reaction, vì "đọc được, không tương tác" là nguyên văn của PLAN.
    """
    if mach.locked_at is not None:
        raise LoiGhi(403, MACH_BI_KHOA, "Mạch này đã bị khoá, không tương tác được.")


def dang_ky_xu_ly_loi_ghi(api) -> None:
    """Kéo lỗi auth/CSRF/`LoiGhi` về đúng hợp đồng `{detail, code}` của PLAN mục 7.

    `AuthenticationError` phải đăng ký RIÊNG dù nó là con của `HttpError`: django-ninja
    tra handler theo lớp cụ thể trước, và nếu chỉ có handler của `HttpError` thì thông
    điệp mặc định "Unauthorized" đi ra ngoài — đúng hình dạng, sai ngôn ngữ, và không có
    `code` để frontend phân biệt "chưa đăng nhập" với "không phải chủ".
    """

    @api.exception_handler(AuthenticationError)
    def _chua_dang_nhap(request, exc):
        return api.create_response(
            request,
            LoiOut(detail="Bạn cần đăng nhập để làm việc này.", code=CHUA_DANG_NHAP),
            status=401,
        )

    @api.exception_handler(HttpError)
    def _http(request, exc: HttpError):
        # `LoiGhi` mang sẵn `code`. `HttpError` trần chỉ đến từ một chỗ trong toàn bộ
        # đường ghi: `APIKeyCookie._get_key` ném `HttpError(403, "CSRF check Failed")`.
        # Đoán mã theo status ở đây là chấp nhận được vì tập nguồn hữu hạn và có chuông
        # (`tests/test_quyen_ghi.py` đo đúng mã `csrf_khong_hop_le` trên request thật).
        ma = getattr(exc, "code", None)
        if ma is None:
            ma = CSRF_KHONG_HOP_LE if exc.status_code == 403 else DU_LIEU_KHONG_HOP_LE
        detail = str(exc)
        if ma == CSRF_KHONG_HOP_LE:
            detail = (
                "Yêu cầu không kèm CSRF token hợp lệ. Tải lại trang rồi thử lại."
            )
        return api.create_response(
            request, LoiOut(detail=detail, code=ma), status=exc.status_code
        )
