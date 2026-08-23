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

from django.core.exceptions import ValidationError
from django.db.models import Count
from django.utils import timezone
from ninja import Router

from core.ghi import ban_user, go_ban_user
from core.models.nguoi_dung import User

from api.loi import THAM_SO_KHONG_HOP_LE, XUNG_DOT, LoiOut, khong_tim_thay, loi
from api.quan_tri_schemas import (
    BanIn,
    KetQuaDoiTrangThaiOut,
    NguoiDungQuanTriOut,
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
        .first()
    )


def _ra(u: User) -> NguoiDungQuanTriOut:
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
    return _ra(u)


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
