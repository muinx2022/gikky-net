"""Tra cứu tài khoản + ban / gỡ ban — PLAN 5.10 ("ban user (tạm/vĩnh viễn, hiện lý do")).

**Hai luật "được phép ban ai" sống ở ĐÂY, không ở `core/ghi.py`**, và chúng không phải
chuyện phòng thủ thừa:

1. **Không tự ban mình.** Một mod bấm nhầm vào hàng của chính mình là tự khoá mình khỏi
   khu quản trị — và người duy nhất gỡ được lại chính là họ. Trên một site có đúng một
   mod (v1 là thế) thì đó là mất quyền quản trị vĩnh viễn, chỉ chữa được bằng
   `manage.py shell`.
2. **Không ban mod khác.** Mọi mod ngang quyền nhau (v1 chỉ có cột `is_staff`, không có
   bảng vai trò), nên "mod A ban mod B" là một cuộc chiến hai bên đều thắng được. Việc gỡ
   quyền một mod là việc của chủ site qua Django admin — có `is_superuser` phân xử ở đó.

Cả hai phụ thuộc **người gọi**, nên chúng không phải bất biến của dữ liệu và không có chỗ
trong đường ghi. Cùng lý lẽ với rate limit ở `core/ghi.py::them_moc`.
"""

from datetime import timedelta

from allauth.account.models import EmailAddress
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.db import transaction
from django.db.models import Count
from django.utils import timezone
from ninja import Router, Status

from core.ghi import (
    AUDIT_DAT_MAT_KHAU_USER,
    AUDIT_SUA_USER,
    AUDIT_TAO_USER,
    DICH_USER,
    ban_user,
    ghi_audit,
    go_ban_user,
)
from core.models.nguoi_dung import User

from api.loi import (
    KHONG_DU_QUYEN,
    THAM_SO_KHONG_HOP_LE,
    XUNG_DOT,
    LoiOut,
    khong_tim_thay,
    loi,
)
from api.quan_tri_schemas import (
    BanIn,
    DatMatKhauIn,
    KetQuaDoiTrangThaiOut,
    NguoiDungQuanTriOut,
    SuaNguoiDungIn,
    TaoNguoiDungIn,
)

router = Router()

TRA_LOI_BAN = {
    200: KetQuaDoiTrangThaiOut,
    400: LoiOut,
    401: LoiOut,
    403: LoiOut,
    404: LoiOut,
    409: LoiOut,
}


def _tim(username: str) -> User | None:
    """Tra tài khoản kèm hai con số để mod phán xử, bằng MỘT truy vấn.

    `distinct=True` trên cả hai `Count`: hai `LEFT JOIN` trong cùng một câu nhân chéo
    nhau, nên một user có 3 mạch và 4 bình luận sẽ ra `so_mach = 12`. Con số sai kiểu này
    không nổ ở đâu cả — nó chỉ làm mod tin rằng mình đang nhìn một tài khoản spam.
    """
    return (
        User.objects.filter(username=username)
        .annotate(
            _so_mach=Count("machs", distinct=True),
            _so_binh_luan=Count("comments", distinct=True),
        )
        .prefetch_related("sub_dang_mod__sub")
        .first()
    )


def vai_tro_cua(u: User) -> str:
    """Nhãn "thuộc nhóm nào" — tính ở SERVER, không để frontend suy từ hai cờ.

    gikky **không dùng `auth.Group`**: bảng có (thừa kế `AbstractUser`) nhưng không chỗ
    nào đọc tới, `ChiMod` chỉ nhìn `is_staff`. Nên "nhóm" ở đây là vai trò thật đang có.

    Thứ tự xét quan trọng: superuser **cũng** `is_staff`, nên hỏi `is_superuser` trước.
    Đảo lại là mọi superuser hiện ra thành "Mod".
    """
    if u.is_superuser:
        return "Superuser"
    if u.is_staff:
        return "Mod"
    return "Thành viên"


def nguoi_dung_quan_tri_ra(u: User) -> NguoiDungQuanTriOut:
    return NguoiDungQuanTriOut(
        username=u.username,
        display_name=u.display_name,
        date_joined=u.date_joined,
        is_active=u.is_active,
        is_staff=u.is_staff,
        dang_bi_ban=u.dang_bi_ban(),
        ban_permanent=u.ban_permanent,
        banned_until=u.banned_until,
        ban_reason=u.ban_reason,
        so_mach=u._so_mach,
        so_binh_luan=u._so_binh_luan,
        is_superuser=u.is_superuser,
        email=u.email or "",
        co_mat_khau=u.has_usable_password(),
        vai_tro=vai_tro_cua(u),
        # `sorted` trong Python: `prefetch_related` đã nạp sẵn, thêm `order_by` ở đây là
        # ném bộ nhớ đệm đi và bắn lại một truy vấn cho mỗi hàng.
        subs_mod=sorted(m.sub.slug for m in u.sub_dang_mod.all()),
    )


@router.get(
    "/users/{username}",
    response={200: NguoiDungQuanTriOut, 401: LoiOut, 403: LoiOut, 404: LoiOut},
    operation_id="quan_tri_xem_nguoi_dung",
    tags=["quan-tri-nguoi-dung"],
)
def xem_nguoi_dung(request, username: str):
    """Hồ sơ một tài khoản dưới góc nhìn mod: trạng thái ban + số mạch + số bình luận.

    `dang_bi_ban` là **kết quả đã tính** của ba cột ban (`User.dang_bi_ban`), không phải
    một cột thứ tư. Frontend đọc nó thay vì tự dựng lại điều kiện — bản chép tay thứ hai
    của điều kiện ấy sẽ quên rằng ban tạm tự hết hạn.
    """
    u = _tim(username)
    if u is None:
        return khong_tim_thay("tài khoản")
    return nguoi_dung_quan_tri_ra(u)


@router.post(
    "/users/{username}/ban",
    response=TRA_LOI_BAN,
    operation_id="quan_tri_ban_nguoi_dung",
    tags=["quan-tri-nguoi-dung"],
)
def ban_nguoi_dung(request, username: str, du_lieu: BanIn):
    """Ban một tài khoản: vĩnh viễn, hoặc tạm tới `den_khi`. **Đúng một trong hai.**

    `ly_do` bắt buộc và không được rỗng — PLAN 5.10 nói người bị chặn phải đọc được nó.

    Ba cách khai hạn, **đúng một cách mỗi lần gọi**: `vinh_vien`, `den_khi` (mốc tuyệt
    đối), hoặc `so_ngay` (N ngày kể từ bây giờ, **đồng hồ máy chủ** — L33). `so_ngay` được
    quy đổi ngay tại đây; `core/ghi.py::ban_user` vẫn chỉ nhận `vinh_vien`/`den_khi`.

    409 `xung_dot` khi đích là chính mình hoặc là một mod khác (xem docstring module).
    400 `tham_so_khong_hop_le` khi số cách khai hạn khác 1, hoặc `so_ngay` không dương.
    """
    u = _tim(username)
    if u is None:
        return khong_tim_thay("tài khoản")
    # Nhánh này bị nhánh `is_staff` ngay dưới BAO TRỌN — người gọi luôn là staff (`ChiMod`
    # đòi thế), nên tự-ban cũng là ban-một-staff. Nó ở lại vì **thông điệp**, và thông điệp
    # ấy không phải trang trí: "không ban được một tài khoản quản trị khác" đọc trên chính
    # hàng của mình là một câu vô nghĩa, và mod sẽ đi tìm xem "khác" là ai. Thứ tự quyết
    # định câu nào ra — nên đừng đảo hai khối này, và đừng gộp.
    # `tests/test_api_quan_tri_sub.py::test_mod_khong_tu_ban_minh` chấm chính câu chữ đó;
    # không có phép chấm ấy thì nhánh này là dòng chết không ai biết.
    if u.pk == request.user.pk:
        return loi(
            409,
            XUNG_DOT,
            "Không tự ban chính mình — không còn ai gỡ được cho bạn.",
        )
    if u.is_staff:
        return loi(
            409,
            XUNG_DOT,
            "Không ban được một tài khoản quản trị khác; gỡ quyền staff ở Django admin trước.",
        )

    # Quy đổi `so_ngay` TRƯỚC khi xuống đường ghi. Phép kiểm "đúng một cách" phải đếm cả
    # ba: nếu chỉ để `ban_user` xử cặp cũ thì `{so_ngay: 7, vinh_vien: true}` đi lọt —
    # `so_ngay` bị bỏ qua im lặng và mod tin là mình vừa ban 7 ngày.
    cach_khai = [du_lieu.vinh_vien, du_lieu.den_khi is not None, du_lieu.so_ngay is not None]
    if sum(1 for x in cach_khai if x) != 1:
        return loi(
            400,
            THAM_SO_KHONG_HOP_LE,
            "Ban phải khai ĐÚNG MỘT trong ba: `vinh_vien`, `den_khi`, `so_ngay`.",
        )
    den_khi = du_lieu.den_khi
    if du_lieu.so_ngay is not None:
        if du_lieu.so_ngay < 1:
            return loi(
                400, THAM_SO_KHONG_HOP_LE, "`so_ngay` phải là số ngày dương."
            )
        den_khi = timezone.now() + timedelta(days=du_lieu.so_ngay)

    try:
        da_doi = ban_user(
            user=u,
            boi=request.user,
            vinh_vien=du_lieu.vinh_vien,
            den_khi=den_khi,
            ly_do=du_lieu.ly_do,
        )
    except ValidationError as e:
        return loi(400, THAM_SO_KHONG_HOP_LE, "; ".join(e.messages))
    return KetQuaDoiTrangThaiOut(da_doi=da_doi, dang_bat=u.dang_bi_ban())


@router.post(
    "/users/{username}/go-ban",
    response={
        200: KetQuaDoiTrangThaiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
    },
    operation_id="quan_tri_go_ban_nguoi_dung",
    tags=["quan-tri-nguoi-dung"],
)
def go_ban_nguoi_dung(request, username: str):
    """Gỡ ban. Idempotent — gỡ một tài khoản không bị ban trả `da_doi=false`.

    Không có hai luật của `ban`: gỡ ban cho chính mình hay cho một mod khác đều vô hại
    (nó chỉ mở khoá), và chặn nó chỉ tạo ra một trạng thái không ai gỡ được.
    """
    u = _tim(username)
    if u is None:
        return khong_tim_thay("tài khoản")
    da_doi = go_ban_user(user=u, boi=request.user)
    return KetQuaDoiTrangThaiOut(da_doi=da_doi, dang_bat=u.dang_bi_ban())


# --- CRUD tài khoản (2026-08-25) -----------------------------------------------------
#
# `plans/2026-08-25-crud-nguoi-dung.md`. User chốt: *"chỉ superadmin mới có quyền thay đổi
# các thông tin của user"*.
#
# ⚠ **KHÔNG cửa nào dưới đây ghi vào `is_staff` / `is_superuser`.** User chốt "không cần
# group nữa… chỉ cần show label ra thuộc nhóm nào", nên PLAN mục 7 giữ nguyên: cấp/thu
# quyền mod vẫn nằm ngoài khu quản trị (Django admin, chỉ superuser). Lý lẽ cũ còn nguyên
# giá trị — một mod cấp quyền mod cho tài khoản khác là bỏ qua mọi phép duyệt, và ai tự
# cấp `is_staff` là tự miễn nhiễm ban.
#
# Hai schema `TaoNguoiDungIn`/`SuaNguoiDungIn` **không khai** hai cờ ấy, nên Ninja loại
# chúng khỏi body trước khi handler nhìn thấy. Có bài đo gửi chúng lên và đòi KHÔNG đổi.

TRA_LOI_CRUD = {
    200: NguoiDungQuanTriOut,
    400: LoiOut,
    401: LoiOut,
    403: LoiOut,
    404: LoiOut,
    409: LoiOut,
}


def _kiem_mat_khau(mat_khau: str, *, user: User | None = None):
    """`None` nếu hợp lệ, ngược lại là response 400 kèm **lý do của Django**.

    Trả nguyên văn thông điệp validator thay vì một câu chung chung: "mật khẩu không hợp
    lệ" không nói được là quá ngắn, quá phổ biến, hay quá giống username — và người đặt sẽ
    thử lại một chuỗi hỏng theo đúng cách cũ.
    """
    try:
        validate_password(mat_khau, user=user)
    except ValidationError as e:
        return loi(400, THAM_SO_KHONG_HOP_LE, " ".join(e.messages))
    return None


def _chan_neu_khong_phai_superuser(request):
    """`None` nếu được phép, ngược lại là response 403.

    Tách khỏi `ChiMod` (cổng `is_staff` của cả khu) vì đây là phép kiểm THỨ HAI, hẹp hơn,
    chỉ cho vài cửa. Nhét nó vào `ChiMod` là khoá cả khu quản trị khỏi mod thường.
    """
    if request.user.is_superuser:
        return None
    return loi(403, KHONG_DU_QUYEN, "Chỉ superuser được đổi thông tin tài khoản.")


def _con_superuser_khac(u: User) -> bool:
    """Còn superuser nào KHÁC `u` đang hoạt động không?"""
    return (
        User.objects.filter(is_superuser=True, is_active=True).exclude(pk=u.pk).exists()
    )


# ⚠ **Đường là `/nguoi-dung`, KHÔNG phải `POST /users`** — và đừng "sửa lại cho RESTful",
# hai lối tự nhiên hơn đều trả **405** chứ không chạy handler này:
#
#   `POST /users`          → `GET /users` (bảng danh sách) nằm ở router KHÁC
#                             (`quan_tri_bang.py`). django-ninja sinh urlpattern theo TỪNG
#                             router, Django resolver lấy pattern khớp đầu tiên ⇒ rơi vào
#                             router kia, nơi chỉ có GET.
#   `POST /users/tao-moi`   → bị `users/<str:username>` (của `GET /users/{username}`, khai
#                             sớm hơn trong file này) nuốt mất: "tao-moi" khớp `{username}`.
#
# Cả hai đã thử và đều 405. Lối chữa "đúng" nhất là gom cả `/users` về một router, nhưng
# nó kéo theo ~15 import của đường phân trang — đắt hơn giá trị lúc này. Một đường có tên
# riêng thì rẻ, không mơ hồ, và không phụ thuộc thứ tự khai.
@router.post(
    "/nguoi-dung",
    response={
        201: NguoiDungQuanTriOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        409: LoiOut,
    },
    operation_id="quan_tri_tao_nguoi_dung",
    tags=["quan-tri-nguoi-dung"],
)
def tao_nguoi_dung(request, du_lieu: TaoNguoiDungIn):
    """Superuser tạo tài khoản hộ. Email được đánh dấu **đã xác thực**.

    Không đánh dấu thì tài khoản mới kẹt ở trạng thái chưa xác thực và gần như không dùng
    được — cửa "tạo" khi đó là trang trí. Người tạo là superuser, tức đã có người chịu
    trách nhiệm cho địa chỉ ấy.

    ⚠ Đây là đường **duy nhất** dựng được một `EmailAddress(verified=True)` mà không qua
    hòm thư. Nó nằm sau `is_superuser` và nó ghi `AuditLog`.

    Cố ý **không** đi qua hạn mức đăng ký theo IP (`AdapterTaiKhoan.is_open_for_signup`):
    hạn mức ấy chặn bot đăng ký hàng loạt, không phải chặn superuser.
    """
    if (chan := _chan_neu_khong_phai_superuser(request)) is not None:
        return chan

    username = du_lieu.username.strip()
    email = du_lieu.email.strip().lower()
    if not username:
        return loi(400, THAM_SO_KHONG_HOP_LE, "username không được rỗng.")
    if not email:
        return loi(400, THAM_SO_KHONG_HOP_LE, "email không được rỗng.")
    if User.objects.filter(username__iexact=username).exists():
        return loi(409, XUNG_DOT, f"username {username!r} đã có người dùng.")
    if User.objects.filter(email__iexact=email).exists():
        return loi(409, XUNG_DOT, f"email {email!r} đã có tài khoản.")

    if du_lieu.mat_khau is not None:
        if (l := _kiem_mat_khau(du_lieu.mat_khau)) is not None:
            return l

    with transaction.atomic():
        u = User(
            username=username,
            email=email,
            display_name=du_lieu.display_name.strip() or username,
        )
        if du_lieu.mat_khau is None:
            u.set_unusable_password()
        else:
            u.set_password(du_lieu.mat_khau)
        u.save()
        EmailAddress.objects.create(user=u, email=email, verified=True, primary=True)
        ghi_audit(
            actor=request.user,
            action=AUDIT_TAO_USER,
            target_type=DICH_USER,
            target_id=u.pk,
            username=username,
            co_mat_khau=du_lieu.mat_khau is not None,
        )

    return Status(201, nguoi_dung_quan_tri_ra(_tim(username)))


@router.patch(
    "/users/{username}",
    response=TRA_LOI_CRUD,
    operation_id="quan_tri_sua_nguoi_dung",
    tags=["quan-tri-nguoi-dung"],
)
def sua_nguoi_dung(request, username: str, du_lieu: SuaNguoiDungIn):
    """Sửa `display_name` / `email` / `is_active`. Trường `None` = **không đổi**.

    "Xoá tài khoản" ở gikky là `is_active=False` (GDPR-lite, PLAN mục 6): nội dung được
    giữ, tác giả ẩn danh, đăng nhập bị chặn. Không xoá hàng — xoá hàng kéo theo nội dung
    mà người khác đang trích dẫn.

    Hai phép từ chối chống **tự khoá ra ngoài**, và chúng là hai đường khác nhau tới cùng
    một hậu quả:

    - tự vô hiệu hoá chính mình ⇒ 409;
    - vô hiệu hoá superuser **cuối cùng** ⇒ 409.

    Thiếu cái thứ hai thì hai superuser tắt lẫn nhau vẫn ra kết quả không ai vào được.
    """
    if (chan := _chan_neu_khong_phai_superuser(request)) is not None:
        return chan

    u = _tim(username)
    if u is None:
        return khong_tim_thay("tài khoản")

    if du_lieu.is_active is False:
        if u.pk == request.user.pk:
            return loi(409, XUNG_DOT, "Không tự vô hiệu hoá tài khoản của chính mình.")
        # ⚠ **Nhánh này KHÔNG với tới được hôm nay** — ghi ra thay vì để người sau
        # tưởng nó đang canh gì đó. Muốn tới đây thì `u != request.user`; mà người gọi
        # đã qua `_chan_neu_khong_phai_superuser` (⇒ superuser) và qua `ChiMod`
        # (⇒ `is_active`), nên `_con_superuser_khac(u)` luôn tìm thấy CHÍNH họ và trả
        # `True`. Đường duy nhất về 0 superuser là tự tắt mình, và phép kiểm ngay trên
        # đã chặn.
        #
        # Giữ lại vì nó rẻ và vì cửa vô hiệu hoá thứ hai (thao tác hàng loạt, hay một
        # endpoint khác) sẽ không có phép kiểm "tự mình" ở trên — lúc đó đây là thứ duy
        # nhất còn đứng. Bài đo tương ứng đo **bất biến** ("luôn còn ít nhất một
        # superuser hoạt động"), không giả vờ đo nhánh này.
        if u.is_superuser and not _con_superuser_khac(u):
            return loi(
                409,
                XUNG_DOT,
                "Đây là superuser đang hoạt động cuối cùng — vô hiệu hoá là không còn ai "
                "vào được khu cài đặt.",
            )

    email = None
    if du_lieu.email is not None:
        email = du_lieu.email.strip().lower()
        if not email:
            return loi(400, THAM_SO_KHONG_HOP_LE, "email không được rỗng.")
        if User.objects.filter(email__iexact=email).exclude(pk=u.pk).exists():
            return loi(409, XUNG_DOT, f"email {email!r} đã có tài khoản.")

    doi = {}
    with transaction.atomic():
        if du_lieu.display_name is not None:
            u.display_name = du_lieu.display_name.strip()
            doi["display_name"] = u.display_name
        if email is not None:
            u.email = email
            doi["email"] = email
        if du_lieu.is_active is not None:
            u.is_active = du_lieu.is_active
            doi["is_active"] = u.is_active
        if doi:
            u.save(update_fields=list(doi))
            ghi_audit(
                actor=request.user,
                action=AUDIT_SUA_USER,
                target_type=DICH_USER,
                target_id=u.pk,
                username=u.username,
                **doi,
            )

    return nguoi_dung_quan_tri_ra(_tim(username))


@router.post(
    "/users/{username}/mat-khau",
    response=TRA_LOI_CRUD,
    operation_id="quan_tri_dat_mat_khau",
    tags=["quan-tri-nguoi-dung"],
)
def dat_mat_khau(request, username: str, du_lieu: DatMatKhauIn):
    """Đặt mật khẩu mới, hoặc **xoá** mật khẩu khi `mat_khau` là `null`.

    Xoá mật khẩu **không phải khoá ngoài**: tài khoản vào bằng Google, hoặc đặt lại qua
    `/quen-mat-khau` (chỉ cần hòm thư). Đó là cùng trạng thái mà một lượt đăng nhập Google
    trùng email tạo ra — xem `core/allauth_adapter.py::AdapterMangXaHoi`.

    Mật khẩu mới đi qua `validate_password` (bộ `AUTH_PASSWORD_VALIDATORS`). Bỏ qua nó là
    mở một cửa đặt mật khẩu yếu mà cửa đăng ký thường không cho — và cửa này còn đặt được
    cho **người khác**.

    Nhật ký ghi **cờ** `xoa`, không ghi chuỗi mật khẩu.
    """
    if (chan := _chan_neu_khong_phai_superuser(request)) is not None:
        return chan

    u = _tim(username)
    if u is None:
        return khong_tim_thay("tài khoản")

    if du_lieu.mat_khau is not None:
        if (l := _kiem_mat_khau(du_lieu.mat_khau, user=u)) is not None:
            return l

    with transaction.atomic():
        if du_lieu.mat_khau is None:
            u.set_unusable_password()
        else:
            u.set_password(du_lieu.mat_khau)
        u.save(update_fields=["password"])
        ghi_audit(
            actor=request.user,
            action=AUDIT_DAT_MAT_KHAU_USER,
            target_type=DICH_USER,
            target_id=u.pk,
            username=u.username,
            # Cờ, KHÔNG phải giá trị.
            xoa=du_lieu.mat_khau is None,
        )

    return nguoi_dung_quan_tri_ra(_tim(username))
