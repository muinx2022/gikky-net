"""Theo dõi **NGƯỜI**: `/users/{username}/theo`, `/users/{username}/me`, `/me/dang-theo-user`.

User chốt 2026-08-25 — xem `plans/2026-08-25-theo-doi-va-chuong.md`.

## Vì sao là module riêng, không nhét vào `api/users.py`

`api/users.py` giữ `GET /users/{username}` — hồ sơ công khai, **không biết người gọi là
ai**, và đó là điều kiện để nó cache được. Mọi thứ ở đây thì ngược lại: đều đọc
`request.user`.

Đúng ranh giới mà `api/theo_doi.py` (trang mạch) và `api/theo_sub.py` (chuyên mục) đã
dựng, và docstring `theo_doi.py` nói lý do gọn nhất: *"hai luật ngược nhau nằm cạnh nhau
trong một file là luật thứ hai sẽ bị quên"*.

## Theo người thì NHẬN được gì

Thông báo `mach_moi` khi người đó đăng mạch mới (`core/thong_bao.py::bao_mach_moi`). Đây
là **khác biệt so với `TheoSub`** — theo chuyên mục ở lượt trước cố ý chưa sinh thông báo
nào. Không có vế nhận thì cái nút là một nút không làm gì, và PLAN mục 4 cấm đúng thế.
"""

from django.core.exceptions import ValidationError as LoiModel
from django.http import HttpResponse
from ninja import Router

from core.ghi import bo_theo_user, dat_theo_user
from core.models.nguoi_dung import User
from core.models.tuong_tac import TheoUser
from core.thong_bao import bao_theo_user

from api.loi import KHONG_TIM_THAY, LoiOut
from api.quyen import DU_LIEU_KHONG_HOP_LE, LoiGhi, dang_nhap
from api.schemas import NguoiDungTomTatOut, TheoUserOut, UserCuaToiOut
from api.trinh_bay import nguoi_dung_ra

router = Router()


def _nap_user(username: str) -> User:
    """Người dùng theo `username`, hoặc **ném** 404.

    ⚠ `raise LoiGhi`, không `return khong_tim_thay(...)`: hàm kia chỉ **trả về** một tuple
    mà chỗ gọi phải `return`, nên gọi nó trong một hàm phụ là vứt giá trị đi rồi chạy tiếp
    như không có gì. Bẫy ấy đã cắn một lần ở `api/theo_sub.py` — `GET` trả `200` cho slug
    lạ và `POST` ném `AttributeError` trên `None`.

    **Tài khoản bị vô hiệu hoá vẫn nạp được.** Hồ sơ của họ vẫn xem được (`api/users.py`),
    nên "không theo được" phải là một quyết định riêng nếu ngày nào cần — không phải hệ
    quả tình cờ của việc lọc ở đây.
    """
    u = User.objects.filter(username=username).first()
    if u is None:
        raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy người dùng {username!r}.")
    return u


@router.get(
    "/users/{username}/me",
    response={200: UserCuaToiOut, 404: LoiOut},
    operation_id="xem_user_cua_toi",
    tags=["tai-khoan"],
)
def xem_user_cua_toi(request, response: HttpResponse, username: str):
    """Tôi có đang theo người này không — **không bao giờ cache được**.

    **Khách nhận 200** (`dang_nhap=false, following=false`), không phải 401: cùng lý lẽ
    `GET /machs/{id}/me`, `GET /subs/{slug}/me` và `GET /me` — endpoint này chạy ở mọi
    lượt tải trang hồ sơ, kể cả của bot.

    `la_toi` để client biết **không vẽ nút**: hồ sơ của chính mình không có gì để theo, và
    một cái nút bấm vào ăn 400 là nút không nên bày ra.
    """
    response["Cache-Control"] = "no-store"
    u = _nap_user(username)
    nguoi_goi = request.user
    if not nguoi_goi.is_authenticated:
        return UserCuaToiOut(dang_nhap=False, following=False, la_toi=False)
    return UserCuaToiOut(
        dang_nhap=True,
        following=TheoUser.objects.filter(
            nguoi_theo=nguoi_goi, nguoi_duoc_theo=u
        ).exists(),
        la_toi=nguoi_goi.pk == u.pk,
    )


@router.post(
    "/users/{username}/theo",
    response={200: TheoUserOut, 400: LoiOut, 401: LoiOut, 404: LoiOut},
    operation_id="theo_user",
    tags=["tai-khoan"],
    auth=dang_nhap,
)
def theo_user(request, username: str):
    """Theo dõi một người. **Idempotent** — bấm lần thứ hai vẫn 200.

    **Tự theo mình trả 400**, không im lặng bỏ qua: im lặng thì UI vẽ nút thành "Đang
    theo" rồi lượt tải sau nó lật về — một trạng thái nói dối. `core.ghi.dat_theo_user`
    ném `ValidationError`, và DB còn một `CheckConstraint` phía sau.

    ⚠ `auth=dang_nhap` cũng chính là lớp kiểm **CSRF** (xem chú thích `NinjaAPI` ở
    `api/v1.py`): khai `auth=None` cho một cửa ghi là mở cho bất kỳ trang web nào POST
    sang đây bằng cookie phiên của người đang đăng nhập.
    """
    u = _nap_user(username)
    try:
        theo = dat_theo_user(nguoi_theo=request.user, nguoi_duoc_theo=u)
    except LoiModel as e:
        # Cùng khuôn `api/mocs.py`: `ValidationError` của model là **dữ liệu người dùng
        # sai**, phải ra 400 có mã — không phải 500. Không có dòng này thì tự theo mình
        # trả traceback, và frontend không có gì để bắt.
        raise LoiGhi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages)) from e
    # Báo cho người ĐƯỢC theo. Gộp theo người theo (không theo ngày) nên theo → bỏ → theo
    # lại chỉ cập nhật một hàng — xem `core/thong_bao.py::bao_theo_user`.
    bao_theo_user(theo)
    return TheoUserOut(username=u.username, following=True)


@router.delete(
    "/users/{username}/theo",
    response={200: TheoUserOut, 401: LoiOut, 404: LoiOut},
    operation_id="bo_theo_user",
    tags=["tai-khoan"],
    auth=dang_nhap,
)
def bo_theo_user_endpoint(request, username: str):
    """Bỏ theo. **Idempotent**: bỏ thứ vốn không theo vẫn là 200.

    Nút "Hủy" có ở hai chỗ (hồ sơ người đó và tab "Đang theo người"), hai tab trình duyệt
    cùng mở là chuyện thường, và bắt cái bấm sau ăn 404 là báo lỗi cho đúng trạng thái
    người dùng vốn đã muốn có.

    **Không xoá thông báo `theo_user` đã gửi.** Thông báo kể lại một sự kiện ĐÃ xảy ra;
    xoá nó đi là sửa lại quá khứ, và nó cũng là cách để một người theo–bỏ theo liên tục
    mà không để lại dấu vết nào cho người bị theo.
    """
    u = _nap_user(username)
    bo_theo_user(nguoi_theo=request.user, nguoi_duoc_theo=u)
    return TheoUserOut(username=u.username, following=False)


@router.get(
    "/me/dang-theo-user",
    response={200: list[NguoiDungTomTatOut], 401: LoiOut},
    operation_id="liet_ke_user_dang_theo",
    tags=["tai-khoan"],
    auth=dang_nhap,
)
def liet_ke_user_dang_theo(request, response: HttpResponse):
    """Người **tôi** đang theo — nguồn của tab "Đang theo người" trong hồ sơ.

    **Mới theo trước** (`-created_at`), không sắp theo tên: đây là danh sách để quản lý, và
    thứ vừa thêm là thứ người ta hay muốn sửa lại nhất. Khác `GET /subs` — cái đó là một
    **bản đồ** nên sắp theo `slug` cho ổn định.

    **Không phân trang**, cùng chuẩn `GET /me/subs`: theo vài chục người là nhiều. Ngày
    tập này dài ra thì cả hai cùng phải đổi — và đổi cùng lúc, vì cùng một lý do.

    `select_related("nguoi_duoc_theo")` là bắt buộc chứ không phải tối ưu: thiếu nó thì
    mỗi dòng một truy vấn, và `nguoi_dung_ra` đọc `avatar_khoa` của từng người.
    """
    response["Cache-Control"] = "no-store"
    return [
        nguoi_dung_ra(t.nguoi_duoc_theo)
        for t in TheoUser.objects.filter(nguoi_theo=request.user)
        .select_related("nguoi_duoc_theo")
        .order_by("-created_at")
    ]
