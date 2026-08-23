"""`GET /me` — người đang đăng nhập là ai. Thêm ở Phase 2 (PLAN mục 7).

Endpoint này là thứ header của cả hai app Next hỏi trên mọi trang, nên hai tính chất của
nó quan trọng hơn nội dung:

1. **Không cache, không nướng vào page cache** (PLAN 8.4 điểm 4). Một `Cache-Control`
   lỏng ở đây nghĩa là proxy phục vụ danh tính của người này cho người kia.
2. **Khách chưa đăng nhập nhận 200**, không phải 401 — xem docstring `ToiOut`.
"""

from django.conf import settings
from ninja import Router

from core.ghi import SO_ANH_TOI_DA_MOI_MOC

from api.schemas import ToiOut

router = Router()


@router.get("/me", response={200: ToiOut}, operation_id="xem_toi", tags=["tai-khoan"])
def xem_toi(request):
    """Danh tính của phiên hiện tại. **Per-user tuyệt đối — không cache** (PLAN 8.4).

    Khách chưa đăng nhập nhận 200 kèm `dang_nhap: false` và mọi trường danh tính `null`.

    `email_da_xac_thuc` có mặt vì xác thực email là **bắt buộc** ở gikky: tài khoản chưa
    xác thực thì đăng nhập được nhưng chưa nên được mời viết bài, và UI cần phân biệt hai
    trạng thái đó thay vì để người dùng bấm rồi ăn lỗi.

    `google_bat` là cấu hình server, không phải trạng thái người dùng: `false` ⇒ trang
    đăng nhập **không render** nút Google (PLAN mục 4 — không nút vĩnh viễn không bấm
    được), chứ không render một nút `disabled`.

    Endpoint này **không** trả trạng thái ban, quyền chi tiết, hay bất cứ thứ gì của người
    khác — nó chỉ nói về chính phiên đang gọi.
    """
    user = request.user
    if not user.is_authenticated:
        return _khach()

    from allauth.account.models import EmailAddress

    return ToiOut(
        dang_nhap=True,
        username=user.username,
        display_name=user.display_name or user.username,
        email=user.email or None,
        email_da_xac_thuc=EmailAddress.objects.filter(
            user=user, verified=True
        ).exists(),
        la_staff=bool(user.is_staff),
        google_bat=settings.GOOGLE_BAT,
        tran_anh_moi_moc=SO_ANH_TOI_DA_MOI_MOC,
    )


def _khach() -> ToiOut:
    """Hình dạng cho khách. Tách hàm để không có hai bản `null` lệch nhau."""
    return ToiOut(
        dang_nhap=False,
        username=None,
        display_name=None,
        email=None,
        email_da_xac_thuc=False,
        la_staff=False,
        google_bat=settings.GOOGLE_BAT,
        tran_anh_moi_moc=SO_ANH_TOI_DA_MOI_MOC,
    )


#: `GET /me` **không** khai `auth=`, và đó không phải là quên: nó là endpoint ĐỌC (GET),
#: nên không có gì để CSRF bảo vệ, và nó phải trả lời được cho cả khách. Luật "mọi
#: operation không-GET phải có auth" ở `tests/test_quyen_ghi.py` vì thế không đụng tới nó.
