"""Theo dõi **chuyên mục**: `/subs/{slug}/theo`, `/subs/{slug}/me`, `/me/subs`.

User chốt 2026-08-24 — xem `plans/2026-08-24-theo-doi-chuyen-muc.md`.

## Vì sao là module riêng, không nhét vào `api/feeds.py`

`api/feeds.py` giữ `GET /subs` và `GET /subs/{slug}` — hai endpoint **không biết người
gọi là ai**, và đó là điều kiện để trang chuyên mục cache được (PLAN 8.4). Module này thì
ngược lại: mọi thứ ở đây đọc `request.user`.

Đây đúng ranh giới mà `api/theo_doi.py` đã dựng cho trang mạch, và docstring của nó nói
lý do rõ hơn: *"hai luật ngược nhau nằm cạnh nhau trong một file là luật thứ hai sẽ bị
quên"*. Không gộp vào chính `theo_doi.py` vì file ấy tự khai phạm vi "trạng thái của người
xem trên một MẠCH" ngay dòng đầu, và chuyên mục không phải mạch.

## Chưa có thông báo

Theo chuyên mục ở lượt này **chỉ** là danh sách người dùng tự quản lý. Không có đường nào
bắn thông báo khi chuyên mục có mạch mới — khác `Follow` (theo mạch), thứ đã nối vào
`core/thong_bao.py` từ PLAN 5.8. Ghi ra vì cái nút trên màn hình dễ khiến người đọc code
giả định ngược lại.
"""

from django.http import HttpResponse
from ninja import Router

from core.ghi import bo_theo_sub, dat_theo_sub
from core.models.dien_dan import Sub
from core.models.tuong_tac import TheoSub

from api.feeds import subs_kem_so_mach
from api.loi import KHONG_TIM_THAY, LoiOut
from api.quyen import LoiGhi, dang_nhap
from api.schemas import SubChiTietOut, SubCuaToiOut, TheoSubOut

router = Router()


def _nap_sub(slug: str) -> Sub:
    """Sub theo slug, hoặc **ném** 404. Cùng khuôn `api/ghi_chung.py::nap_mach`.

    ⚠ **`raise LoiGhi`, không phải `return khong_tim_thay(...)`.** Hai lối viết cùng ra
    một mã 404 nhưng khác nhau ở chỗ dừng: `khong_tim_thay` chỉ **trả về** một tuple
    `(404, LoiOut)` mà chỗ gọi phải `return`, nên gọi nó trong một hàm phụ như thế này là
    vứt giá trị đi và **chạy tiếp như không có gì xảy ra** — bản đầu của file này làm đúng
    vậy, và `GET /subs/<slug lạ>/me` trả `200 {"following": false}` còn `POST` thì ném
    `AttributeError` trên `None`. Bộ đo bắt được cả bốn ca.
    """
    sub = Sub.objects.filter(slug=slug).first()
    if sub is None:
        raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy sub {slug!r}.")
    return sub


@router.get(
    "/subs/{slug}/me",
    response={200: SubCuaToiOut, 404: LoiOut},
    operation_id="xem_sub_cua_toi",
    tags=["sub"],
)
def xem_sub_cua_toi(request, response: HttpResponse, slug: str):
    """Tôi có đang theo chuyên mục này không — **không bao giờ cache được**.

    **Khách nhận 200**, không phải 401: `dang_nhap=false, following=false`. Cùng lý lẽ
    `GET /machs/{id}/me` và `GET /me` — client gọi nó ở mọi lượt tải trang, và bắt nó phải
    phân biệt "401 nghĩa là khách" với "401 nghĩa là phiên hết hạn" là đẩy một nhánh lỗi
    vào chỗ vốn không có lỗi nào.

    Slug lạ vẫn 404 kể cả với khách: một chuyên mục không tồn tại thì câu trả lời "bạn
    không theo nó" là câu trả lời sai.
    """
    # `no-store` là bắt buộc, không phải phòng xa: đây là response per-user đi qua đúng
    # một URL công khai. Thiếu nó thì bất kỳ proxy nào ở giữa cũng có quyền phát lại câu
    # trả lời của người này cho người kế tiếp.
    response["Cache-Control"] = "no-store"
    sub = _nap_sub(slug)
    user = request.user
    if not user.is_authenticated:
        return SubCuaToiOut(dang_nhap=False, following=False)
    return SubCuaToiOut(
        dang_nhap=True,
        following=TheoSub.objects.filter(user=user, sub=sub).exists(),
    )


@router.post(
    "/subs/{slug}/theo",
    response={200: TheoSubOut, 401: LoiOut, 404: LoiOut},
    operation_id="theo_sub",
    tags=["sub"],
    auth=dang_nhap,
)
def theo_sub(request, slug: str):
    """Theo chuyên mục. **Idempotent** — bấm lần thứ hai vẫn 200, không dựng hàng thứ hai.

    **Quyền: bất kỳ ai đã đăng nhập.** Không có khái niệm "chuyên mục riêng tư" ở v1, và
    theo dõi không sinh chữ, không đổi con số nào của chuyên mục, không ai khác nhìn thấy
    — nên không có gì để chặn. Chỉ ghi vào hàng của chính người gọi.

    ⚠ `auth=dang_nhap` cũng chính là lớp kiểm **CSRF** (xem chú thích `NinjaAPI` ở
    `api/v1.py`): khai `auth=None` cho một endpoint ghi là mở cửa cho bất kỳ trang web nào
    POST sang đây bằng cookie phiên của người đang đăng nhập.
    """
    sub = _nap_sub(slug)
    dat_theo_sub(user=request.user, sub=sub)
    return TheoSubOut(slug=sub.slug, following=True)


@router.delete(
    "/subs/{slug}/theo",
    response={200: TheoSubOut, 401: LoiOut, 404: LoiOut},
    operation_id="bo_theo_sub",
    tags=["sub"],
    auth=dang_nhap,
)
def bo_theo_sub_endpoint(request, slug: str):
    """Bỏ theo chuyên mục. **Idempotent**: bỏ thứ vốn không theo vẫn là 200.

    Nút "Hủy" có ở **hai** chỗ (header chuyên mục và tab "Chuyên mục" của hồ sơ). Hai tab
    trình duyệt cùng mở là chuyện thường, và bắt cái bấm sau ăn 404 là báo lỗi cho đúng
    trạng thái người dùng vốn đã muốn có.
    """
    sub = _nap_sub(slug)
    bo_theo_sub(user=request.user, sub=sub)
    return TheoSubOut(slug=sub.slug, following=False)


@router.get(
    "/me/subs",
    response={200: list[SubChiTietOut], 401: LoiOut},
    operation_id="liet_ke_sub_dang_theo",
    tags=["tai-khoan"],
    auth=dang_nhap,
)
def liet_ke_sub_dang_theo(request, response: HttpResponse):
    """Chuyên mục **tôi** đang theo — nguồn của tab "Chuyên mục" trong hồ sơ.

    **Mới theo trước** (`-created_at` trên `TheoSub`), không sắp theo `slug`: đây là danh
    sách để quản lý, và thứ vừa thêm là thứ người ta hay muốn sửa lại nhất. Khác
    `GET /subs` — cái đó là **bản đồ** nên sắp theo `slug` cho ổn định.

    **Không phân trang, có chủ đích.** Một người theo hàng chục chuyên mục là nhiều, và
    `GET /subs` (toàn bộ chuyên mục của site) cũng đã không phân trang vì cùng lý do — v1
    tạo sub bằng tay qua admin. Ngày tập này dài ra thì cả hai cùng phải đổi.

    Trả `SubChiTietOut` y hệt `GET /subs` để tab hồ sơ vẽ được cùng một loại thẻ: dùng
    kiểu riêng ở đây là hai schema gần giống nhau, và cái thứ hai sẽ lệch ở lần sửa sau.
    """
    response["Cache-Control"] = "no-store"
    # `values_list` cho thứ tự, rồi mới annotate `so_mach` — `subs_kem_so_mach()` là
    # nguồn DUY NHẤT của công thức đếm ấy (xem docstring của nó).
    slug_theo_thu_tu = list(
        TheoSub.objects.filter(user=request.user)
        .order_by("-created_at")
        .values_list("sub__slug", flat=True)
    )
    if not slug_theo_thu_tu:
        return []
    # Một truy vấn cho cả trang; thứ tự của `IN (...)` không được đảm bảo nên sắp lại ở
    # Python theo danh sách trên. Đây là chỗ dễ sai im lặng: bỏ bước sắp lại thì danh sách
    # vẫn ĐÚNG NỘI DUNG, chỉ sai thứ tự — và không bài đo nào đọc thứ tự sẽ tự nhiên nghi.
    theo_slug = {
        s.slug: SubChiTietOut(
            slug=s.slug,
            ten=s.ten,
            mo_ta=s.mo_ta,
            so_mach=s.so_mach_hien,
            created_at=s.created_at,
        )
        for s in subs_kem_so_mach().filter(slug__in=slug_theo_thu_tu)
    }
    return [theo_slug[sl] for sl in slug_theo_thu_tu if sl in theo_slug]
