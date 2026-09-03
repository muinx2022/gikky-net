"""Tra cứu tài khoản + ban / gỡ ban — PLAN 5.10 ("ban user (tạm/vĩnh viễn, hiện lý do")).

**Hai luật "được phép ban ai" sống ở ĐÂY, không ở `core/ghi.py`**, và chúng không phải
chuyện phòng thủ thừa:

1. **Không tự ban mình.** Một mod bấm nhầm vào hàng của chính mình là tự khoá mình khỏi
   khu quản trị — và người duy nhất gỡ được lại chính là họ. Trên một site có đúng một
   mod (v1 là thế) thì đó là mất quyền quản trị vĩnh viễn, chỉ chữa được bằng
   `manage.py shell`.
2. **Không ban mod khác.** Mọi mod ngang quyền nhau (v1 chỉ có cột `is_staff`, không có
   bảng vai trò), nên "mod A ban mod B" là một cuộc chiến hai bên đều thắng được. Việc gỡ
   quyền một mod là việc của **superuser** — từ 2026-08-26 làm được ở
   `doi_quyen_mod` ngay trong file này, trước đó chỉ Django admin.

⚠ **Hệ quả của cửa `doi_quyen_mod`, ghi ra để không ai gỡ nhầm:** vì luật 2 ở trên trả
409 khi đích là `is_staff`, **cấp quyền mod cho ai = làm người đó miễn nhiễm ban**. Đó là
cái giá user đã chấp nhận khi chốt "có cấp/thu quyền mod tại khu quản trị, nhưng khoá sau
`is_superuser`" (`plans/2026-08-26-khu-quan-tri-vien.md` §1). Nó có bài đo ghim lại —
`tests/test_api_quyen_mod.py::test_B10_cap_quyen_mod_lam_tai_khoan_mien_nhiem_ban`.

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
    AUDIT_DOI_QUYEN_MOD,
    AUDIT_SUA_USER,
    AUDIT_TAO_USER,
    DICH_USER,
    ban_user,
    ghi_audit,
    go_ban_user,
)
from core.models.nguoi_dung import User

from api.loi import (
    THAM_SO_KHONG_HOP_LE,
    XUNG_DOT,
    LoiOut,
    khong_tim_thay,
    loi,
)
from api.quan_tri_quyen import chan_neu_khong_phai_superuser
from api.quan_tri_schemas import (
    BanIn,
    DatMatKhauIn,
    DoiQuyenModIn,
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
            "Không ban được một tài khoản quản trị khác; thu quyền mod ở trang "
            "Quản trị viên trước.",
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
# ⚠ **KHÔNG cửa nào dưới đây ghi vào `is_staff` / `is_superuser`.** Hai schema
# `TaoNguoiDungIn`/`SuaNguoiDungIn` **không khai** hai cờ ấy, nên Ninja loại chúng khỏi
# body trước khi handler nhìn thấy. Có bài đo gửi chúng lên và đòi KHÔNG đổi.
#
# Cập nhật 2026-08-26 (`plans/2026-08-26-khu-quan-tri-vien.md`): `is_staff` nay **có** một
# cửa riêng — `doi_quyen_mod` ở cuối file, cũng khoá sau `is_superuser`. Nó là cửa riêng
# chứ không phải một trường thêm vào `SuaNguoiDungIn`, và đó là chủ đích: cấp quyền mod
# kéo theo *miễn nhiễm ban* (xem docstring module), nên nó cần đường đi, lời từ chối và
# dòng nhật ký của riêng nó — không phải đi ké một body sửa tên hiển thị.
#
# `is_superuser` thì **không đổi gì**: vẫn không cửa nào trong khu quản trị ghi vào nó,
# Django admin vẫn là nơi duy nhất phong superuser.

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
    """`None` nếu được phép, ngược lại là response 403 — bản của file này.

    Thân hàm chuyển sang `api/quan_tri_quyen.py` (2026-09-03) khi cửa sửa nội dung bài
    cần đúng phép kiểm ấy: hai bản chép sẽ là hai câu lỗi và, sớm muộn, hai mã lỗi. Vỏ
    hàm ở lại vì `viec` của cả file này là một — không endpoint nào phải nhắc lại nó.
    """
    return chan_neu_khong_phai_superuser(request, "đổi thông tin tài khoản")


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


# --- Cấp / thu quyền mod (2026-08-26) ------------------------------------------------
#
# `plans/2026-08-26-khu-quan-tri-vien.md`. User chốt: *"có cấp / thu quyền mod ngay tại
# trang mới, khoá sau `is_superuser`"*.
#
# ⚠ Đường phải là `/users/{username}/quyen-mod` **trong file này**, không phải một router
# mới: `GET /users` (bảng danh sách) sống ở `quan_tri_bang.py`, và django-ninja sinh
# urlpattern theo TỪNG router. Một đường `users/…` khai ở router khác sẽ bị router kia
# nuốt trước và trả 405 — xem khối chú thích 405 ở giữa file.


@router.post(
    "/users/{username}/quyen-mod",
    response=TRA_LOI_CRUD,
    operation_id="quan_tri_doi_quyen_mod",
    tags=["quan-tri-nguoi-dung"],
)
def doi_quyen_mod(request, username: str, du_lieu: DoiQuyenModIn):
    """Công tắc `is_staff` của một tài khoản. Trả về **cả hàng** đã cập nhật.

    Trả cả hàng thay vì `204`: nhãn `vai_tro` do SERVER tính (`vai_tro_cua`), nên frontend
    phải nhận lại hàng mới chứ không tự suy từ `bat` — suy tay là dựng bản thứ hai của một
    luật server đang giữ (PLAN nguyên tắc 10), và bản thứ hai sẽ lệch đúng lúc `vai_tro_cua`
    mọc thêm một nhánh. Cùng lý lẽ `gan_mod_sub` trả cả hàng sub.

    **Idempotent** — đặt trùng giá trị đang có trả 200, không 409. Đây là một *công tắc
    hai trạng thái*, và một công tắc báo lỗi khi bị gạt về đúng vị trí nó đang đứng là một
    công tắc hỏng. (Khác `gan_mod_sub`, nơi "đã là mod ⇒ 409" là đúng vì đó là *thêm vào
    một danh sách*: người bấm cần biết mình KHÔNG phải người vừa thêm.)

    Năm lời từ chối, mỗi lời một thông điệp riêng:

    - **người gọi không superuser ⇒ 403.** Vế "khoá sau `is_superuser`" của đơn hàng.
    - **đích là chính mình ⇒ 409.** Thu quyền của chính mình là tự khoá mình khỏi khu
      quản trị, và người duy nhất gỡ được lại chính là mình. Cùng hình dạng với luật
      "không tự ban mình" ở đầu file.
    - **đích là superuser ⇒ 409.** `ChiMod` đòi `is_staff`, nên thu `is_staff` của một
      superuser là làm hỏng một nửa họ: còn `is_superuser` nhưng hết đường vào. Quyền
      superuser thuộc Django admin, và cửa này cố ý không với tới đó.
    - **cấp cho tài khoản đang bị ban / đã vô hiệu hoá ⇒ 409.** `ChiMod` từ chối cả hai ở
      cổng, nên hàng cấp ra vô nghĩa ngay khi tạo; và một cái tên bị ban nằm trong bảng
      "Quản trị viên" là thông tin sai trên màn hình. Đúng tiền lệ `gan_mod_sub`.
    - **thu quyền khi còn `ModSub` ⇒ 409, kèm tên sub.** Xem dưới.

    ## Vì sao thu quyền lại vướng `ModSub`

    Thu `is_staff` mà bỏ lại hàng `ModSub` là để một cái tên **không moderate được** nằm
    trong cột "Mod" của bảng chuyên mục — chính điều mà docstring `ModSub` gọi là *"hiểu
    sai theo hướng nguy hiểm"*. Hai lối chữa, và lối bị loại đáng ghi ra: *cascade xoá
    `ModSub`* làm mất dữ liệu ngầm mà người bấm không yêu cầu, và mất luôn câu trả lời
    "ai từng phụ trách sub này". Nên: **từ chối, bảo gỡ phân công trước** — và 409 phải
    **liệt kê tên sub**, nếu không superuser phải đi dò từng chuyên mục.

    ## Thứ tự: từ chối TRƯỚC, no-op SAU

    Phép "trùng giá trị ⇒ trả luôn" đặt sau cả năm lời từ chối, không phải trước. Đảo lại
    thì `bat=false` trên một tài khoản **đã** không phải staff nhưng còn `ModSub` sẽ trả
    200 im lặng — và người bấm tin rằng mình vừa dọn xong một thứ vẫn còn nguyên. Câu trả
    lời phải phụ thuộc **trạng thái**, không phụ thuộc việc lần bấm này có đổi được gì.
    """
    if (chan := _chan_neu_khong_phai_superuser(request)) is not None:
        return chan

    u = _tim(username)
    if u is None:
        return khong_tim_thay("tài khoản")

    # ⚠ Nhánh này bị nhánh `is_superuser` ngay dưới BAO TRỌN — người gọi đã qua
    # `_chan_neu_khong_phai_superuser`, nên "đích là chính mình" kéo theo "đích là
    # superuser". Nó ở lại vì **thông điệp**, đúng hình dạng và đúng lý lẽ với cặp
    # tự-ban / ban-mod-khác ở `ban_nguoi_dung` phía trên: câu "sep_lon là superuser;
    # quyền superuser chỉ đổi được ở Django admin" đọc trên chính hàng của mình là một
    # câu vô nghĩa, và người bấm sẽ đi tìm xem mình đang bị chặn vì ai.
    #
    # ⇒ **Đừng đảo hai khối này, và đừng gộp.** Thứ tự quyết định câu nào ra, và thứ duy
    # nhất phân biệt được hai nhánh là câu chữ — nên bài đo phải chấm câu chữ chứ không
    # chấm mã 409 (`test_B4_khong_tu_doi_quyen_cua_minh`; bản đầu chỉ chấm 409 và nó
    # KHÔNG đỏ khi nhánh này bị gỡ).
    if u.pk == request.user.pk:
        return loi(
            409,
            XUNG_DOT,
            "Không tự đổi quyền quản trị của chính mình — thu xong thì không còn ai gỡ "
            "được cho bạn.",
        )
    if u.is_superuser:
        return loi(
            409,
            XUNG_DOT,
            f"{username!r} là superuser; quyền superuser chỉ đổi được ở Django admin.",
        )

    if du_lieu.bat:
        if not u.is_active:
            return loi(409, XUNG_DOT, f"Tài khoản {username!r} đã bị vô hiệu hoá.")
        if u.dang_bi_ban():
            return loi(409, XUNG_DOT, f"Tài khoản {username!r} đang bị ban.")
    else:
        # `prefetch_related("sub_dang_mod__sub")` của `_tim` đã nạp sẵn — `sorted` trong
        # Python thay vì `order_by` để không ném bộ nhớ đệm ấy đi.
        slugs = sorted(m.sub.slug for m in u.sub_dang_mod.all())
        if slugs:
            ds = " · ".join(f"s/{s}" for s in slugs)
            return loi(
                409,
                XUNG_DOT,
                f"{username!r} còn phụ trách {ds} — gỡ phân công ở trang Chuyên mục "
                "trước, rồi mới thu quyền.",
            )

    if u.is_staff == du_lieu.bat:
        # Không đổi gì ⇒ **không ghi nhật ký**. Sổ này trả lời câu "ai cho người này làm
        # mod"; một dòng cho lượt bấm không đổi gì chỉ làm loãng đúng câu trả lời đó.
        return nguoi_dung_quan_tri_ra(u)

    with transaction.atomic():
        u.is_staff = du_lieu.bat
        u.save(update_fields=["is_staff"])
        ghi_audit(
            actor=request.user,
            action=AUDIT_DOI_QUYEN_MOD,
            target_type=DICH_USER,
            target_id=u.pk,
            username=u.username,
            bat=du_lieu.bat,
        )

    return nguoi_dung_quan_tri_ra(_tim(username))
