"""`GET /me` — người đang đăng nhập là ai. Thêm ở Phase 2 (PLAN mục 7).

Endpoint này là thứ header của cả hai app Next hỏi trên mọi trang, nên hai tính chất của
nó quan trọng hơn nội dung:

1. **Không cache, không nướng vào page cache** (PLAN 8.4 điểm 4). Một `Cache-Control`
   lỏng ở đây nghĩa là proxy phục vụ danh tính của người này cho người kia.
2. **Khách chưa đăng nhập nhận 200**, không phải 401 — xem docstring `ToiOut`.
"""

from django.conf import settings
from ninja import Router

from api.loi import LoiOut
from api.quyen import dang_nhap
from core.ghi import SO_ANH_TOI_DA_MOI_MOC

from api.schemas import ToiOut
from api.schemas_ghi import ToiSuaIn

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
        nhan_digest=bool(user.nhan_digest),
        tran_anh_moi_moc=SO_ANH_TOI_DA_MOI_MOC,
    )


@router.patch(
    "/me",
    response={200: ToiOut, 400: LoiOut, 401: LoiOut, 403: LoiOut},
    operation_id="sua_toi",
    tags=["tai-khoan"],
    auth=dang_nhap,
)
def sua_toi(request, du_lieu: ToiSuaIn):
    """Đổi tuỳ chọn của **chính phiên đang gọi**. Hôm nay đúng một trường: `nhan_digest`.

    **Quyền: bất kỳ ai đã đăng nhập, và chỉ ghi vào hàng của chính họ.** Không có tham số
    nào chỉ ra người khác, nên không có đường nào đặt tuỳ chọn hộ ai.

    ### Vì sao cửa này phải tồn tại (L14)

    PLAN 5.8 chốt digest tuần là **opt-in**, và `User.nhan_digest` mặc định `False` đúng
    theo đó. Nhưng cho tới lượt vá V1, `grep "nhan_digest"` trong `api/` và `apps/` ra
    **0 kết quả**: không endpoint, không form, không trang cài đặt. Nghĩa là toàn bộ
    `core/digest.py`, lệnh `gui_digest` và lịch 8:00 thứ Bảy chạy trên một tập người nhận
    **luôn rỗng về cấu trúc** — commit `64b1a94` gọi đó là "cắm nguồn người nhận cho
    digest", trong khi cái nguồn ấy không ai bật được.

    **PATCH thật**: trường vắng mặt là không đổi. Gọi với thân rỗng `{}` là hợp lệ và
    không ghi gì — nó chính là cách client hỏi "trạng thái hiện tại" mà không cần một
    endpoint thứ hai.

    ⚠ Trang `/cai-dat` của `apps/web` **chưa có** (nợ có tên `TRANG-CAI-DAT`), nên hôm nay
    cửa này chưa có nút nào bấm vào nó. Đó là chủ đích của lượt vá V1 — mở cửa trước, UI
    thuộc lượt sau — chứ không phải một endpoint bỏ quên.
    """
    # `v is not None` chứ không chỉ `exclude_unset`: một `{"nhan_digest": null}` gửi
    # tường minh sẽ thành `UPDATE … SET nhan_digest = NULL` trên một cột `NOT NULL` — tức
    # HTTP 500 cho một thân request mà schema chấp nhận. Không có trường nào ở đây coi
    # `null` là "xoá giá trị" (khác `MocSuaIn`), nên bỏ qua là đúng nghĩa nhất.
    thay_doi = {
        k: v for k, v in du_lieu.model_dump(exclude_unset=True).items() if v is not None
    }
    if thay_doi:
        from core.models.nguoi_dung import User

        # `update()` trên queryset lọc theo `pk` của chính người gọi, không `save()` trên
        # object phiên: `request.user` mang cả những cột khác được nạp từ đầu request, và
        # `save()` trần sẽ ghi đè chúng bằng giá trị cũ nếu ai đó vừa đổi ở nơi khác.
        #
        # Import `User` tường minh chứ không `type(request.user)`: Django bọc `request.user`
        # trong `SimpleLazyObject`, nên `type(...)` ra chính lớp bọc đó — không có
        # `.objects`, và lỗi chỉ nổ ở runtime của đúng nhánh có ghi.
        User.objects.filter(pk=request.user.pk).update(**thay_doi)
        request.user.refresh_from_db(fields=list(thay_doi))
    return xem_toi(request)


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
        nhan_digest=False,
        tran_anh_moi_moc=SO_ANH_TOI_DA_MOI_MOC,
    )


#: `GET /me` **không** khai `auth=`, và đó không phải là quên: nó là endpoint ĐỌC (GET),
#: nên không có gì để CSRF bảo vệ, và nó phải trả lời được cho cả khách. Luật "mọi
#: operation không-GET phải có auth" ở `tests/test_quyen_ghi.py` vì thế không đụng tới nó.
