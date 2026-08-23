"""CRUD chuyên mục — PLAN 9.3 mục 3, mục 7 dòng cuối ("subs CRUD").

Trước Phase 4, `Sub` chỉ tạo được bằng tay qua Django admin (docstring
`core/models/dien_dan.py`). File này là cửa chính thức thay cho việc đó.

Ba luật, và cả ba đều là "không cho làm" chứ không phải "làm giúp":

1. **`slug` không sửa được sau khi tạo.** Nó nằm trong URL công khai `/s/<slug>` và trong
   `sitemap.ts`; đổi nó là làm chết mọi liên kết đã phát ra ngoài. Việc đó cần redirect
   301 kèm theo, tức một kế hoạch, không phải một ô trong form.
2. **Xoá được, nhưng chỉ khi sub RỖNG.** `Mach.sub` là `PROTECT`, nên xoá một sub còn mạch
   ném `ProtectedError` → 500. Tiền-kiểm ở đây đổi nó thành 409 đọc được. Không dùng
   `try/except ProtectedError` một mình: kiểm trước cho thông điệp nói đúng số mạch đang
   chặn, còn `except` vẫn giữ để bịt cửa đua (mạch mới tạo giữa lúc kiểm và lúc xoá).
3. **Không sub nào bị "sửa" thành sub khác.** `PATCH` chỉ nhận `ten` và `mo_ta`; trường
   `None` nghĩa là **không đổi**, không phải "đặt về rỗng".
"""

from django.db import IntegrityError, transaction
from django.db.models import Count, ProtectedError
from django.utils.text import slugify
from ninja import Router, Status

from core.ghi import AUDIT_SUA_SUB, AUDIT_TAO_SUB, AUDIT_XOA_SUB, DICH_SUB, ghi_audit
from core.models.dien_dan import Sub
from core.tim_kiem import dong_bo_theo_sub

from api.loi import THAM_SO_KHONG_HOP_LE, XUNG_DOT, LoiOut, khong_tim_thay, loi
from api.quan_tri_schemas import (
    KetQuaXoaSubOut,
    SuaSubIn,
    SubQuanTriOut,
    TaoSubIn,
)

router = Router()

#: `Sub.slug` là `SlugField(max_length=40)`. Kiểm ở đây thay vì để `full_clean` ném:
#: `objects.create()` không gọi validator nào, nên không kiểm là một slug có dấu cách đi
#: thẳng xuống DB rồi ra một URL `/s/chung khoan` không ai mở được.
DAI_SLUG_TOI_DA = 40


def _co_so_mach():
    return Sub.objects.annotate(_so_mach=Count("machs"))


def _ra(sub: Sub) -> SubQuanTriOut:
    return SubQuanTriOut(
        slug=sub.slug,
        ten=sub.ten,
        mo_ta=sub.mo_ta,
        created_at=sub.created_at,
        so_mach=getattr(sub, "_so_mach", 0),
    )


@router.get(
    "/subs",
    response={200: list[SubQuanTriOut], 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_liet_ke_sub",
    tags=["quan-tri-sub"],
)
def liet_ke_sub(request):
    """Mọi sub, sắp theo `slug`, kèm `so_mach`.

    Không phân trang: v1 có hai sub và danh sách này là bảng điều khiển, không phải feed.
    Ngày nào nó dài tới mức cần cursor thì `so_mach` sẽ là thứ vỡ trước (một `COUNT` mỗi
    hàng), và lúc đó phải sửa cả hai thứ cùng lúc.
    """
    return [_ra(s) for s in _co_so_mach().order_by("slug")]


@router.post(
    "/subs",
    response={
        201: SubQuanTriOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        409: LoiOut,
    },
    operation_id="quan_tri_tao_sub",
    tags=["quan-tri-sub"],
)
def tao_sub(request, du_lieu: TaoSubIn):
    """Tạo một chuyên mục mới. 409 `xung_dot` nếu `slug` đã có.

    `slug` phải đã ở dạng chuẩn — server **không** tự slugify hộ. Tự sửa hộ nghĩa là người
    gõ `Chứng Khoán` nhận về `/s/chung-khoan` mà không biết, rồi lần sau gõ lại đúng chuỗi
    ấy và ăn 409 cho một sub họ tưởng chưa tạo.
    """
    slug = du_lieu.slug.strip()
    if not slug or len(slug) > DAI_SLUG_TOI_DA or slugify(slug) != slug:
        return loi(
            400,
            THAM_SO_KHONG_HOP_LE,
            f"slug phải ở dạng chuẩn (chữ thường, số, gạch ngang), ≤{DAI_SLUG_TOI_DA} "
            f"ký tự — nhận {du_lieu.slug!r}.",
        )
    if not du_lieu.ten.strip():
        return loi(400, THAM_SO_KHONG_HOP_LE, "ten không được rỗng.")

    try:
        with transaction.atomic():
            sub = Sub.objects.create(
                slug=slug, ten=du_lieu.ten.strip(), mo_ta=du_lieu.mo_ta
            )
            ghi_audit(
                actor=request.user,
                action=AUDIT_TAO_SUB,
                target_type=DICH_SUB,
                target_id=sub.pk,
                slug=sub.slug,
                ten=sub.ten,
            )
    except IntegrityError:
        # `UNIQUE (slug)` ở tầng DB là chỗ chặn THẬT — một phép `exists()` trước đó chỉ
        # thu hẹp cửa sổ đua chứ không đóng được nó, nên ở đây không có phép kiểm ấy.
        return loi(409, XUNG_DOT, f"Đã có sub với slug {slug!r}.")

    # `Status(...)` chứ không `return 201, ...`: django-ninja 1.6 deprecate kiểu tuple, mà
    # `filterwarnings = ["error"]` biến mọi DeprecationWarning thành lỗi test — cùng ghi
    # chú với `api/loi.py::loi` và `api/v1.py::health`.
    return Status(201, _ra(sub))


@router.patch(
    "/subs/{slug}",
    response={
        200: SubQuanTriOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
    },
    operation_id="quan_tri_sua_sub",
    tags=["quan-tri-sub"],
)
def sua_sub(request, slug: str, du_lieu: SuaSubIn):
    """Sửa `ten` / `mo_ta`. Trường `None` là **không đổi**; `slug` không sửa được.

    Không có nhánh "không đổi gì thì bỏ qua": `PATCH` rỗng vẫn trả 200 với trạng thái hiện
    hành, nhưng **không** ghi `AuditLog` — cùng luật với `da_doi` của các endpoint kiểm
    duyệt, xem `core/ghi.py`.
    """
    sub = _co_so_mach().filter(slug=slug).first()
    if sub is None:
        return khong_tim_thay(f"sub {slug!r}")

    doi = {}
    if du_lieu.ten is not None:
        if not du_lieu.ten.strip():
            return loi(400, THAM_SO_KHONG_HOP_LE, "ten không được rỗng.")
        doi["ten"] = du_lieu.ten.strip()
    if du_lieu.mo_ta is not None:
        doi["mo_ta"] = du_lieu.mo_ta

    thuc_su_doi = {k: v for k, v in doi.items() if getattr(sub, k) != v}
    if thuc_su_doi:
        with transaction.atomic():
            for k, v in thuc_su_doi.items():
                setattr(sub, k, v)
            sub.save(update_fields=list(thuc_su_doi))
            ghi_audit(
                actor=request.user,
                action=AUDIT_SUA_SUB,
                target_type=DICH_SUB,
                target_id=sub.pk,
                slug=sub.slug,
                truong=sorted(thuc_su_doi),
            )
            if "ten" in thuc_su_doi:
                # `sub_ten` là một trường TÌM ĐƯỢC của tài liệu mạch (`core/tim_kiem.py`),
                # nên đổi tên chuyên mục mà không đồng bộ là tìm theo tên mới ra rỗng
                # trong khi trang sub đầy bài. `mo_ta` không nằm trong index nên không
                # kéo theo gì — sửa mô tả không phải đẩy lại cả nghìn tài liệu.
                dong_bo_theo_sub(sub)
    return _ra(sub)


@router.delete(
    "/subs/{slug}",
    response={
        200: KetQuaXoaSubOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
        409: LoiOut,
    },
    operation_id="quan_tri_xoa_sub",
    tags=["quan-tri-sub"],
)
def xoa_sub(request, slug: str):
    """Xoá một chuyên mục. 409 `xung_dot` nếu nó còn mạch.

    Xoá THẬT, không xoá mềm: `Sub` không có nội dung của ai và không có URL nào cần giữ
    bia mộ. Điều kiện "rỗng" là thứ giữ cho việc đó an toàn — và nó được `PROTECT` ở tầng
    DB canh lần thứ hai (xem docstring module).
    """
    sub = _co_so_mach().filter(slug=slug).first()
    if sub is None:
        return khong_tim_thay(f"sub {slug!r}")
    if sub._so_mach > 0:
        return loi(
            409,
            XUNG_DOT,
            f"Sub {slug!r} còn {sub._so_mach} mạch — chuyển hoặc xoá chúng trước.",
        )

    try:
        with transaction.atomic():
            pk = sub.pk
            sub.delete()
            ghi_audit(
                actor=request.user,
                action=AUDIT_XOA_SUB,
                target_type=DICH_SUB,
                target_id=pk,
                slug=slug,
                ten=sub.ten,
            )
    except ProtectedError:
        # Mạch được tạo GIỮA phép kiểm ở trên và câu `DELETE`. Cửa hẹp, nhưng để hở thì
        # nó là 500 trên một thao tác hợp lệ của mod.
        return loi(409, XUNG_DOT, f"Sub {slug!r} vừa có mạch mới — không xoá được.")

    return KetQuaXoaSubOut(slug=slug, da_xoa=True)
