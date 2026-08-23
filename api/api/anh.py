"""Tải ảnh lên mốc và gỡ ảnh xuống — PLAN 8.5 (đã lệch), Phase 5.

**Một nhịp, multipart thẳng vào Django.** PLAN 8.5 thiết kế hai nhịp (`POST /media/presign`
→ client PUT thẳng lên R2 → `POST /media/confirm`), và hai nhịp tồn tại *chỉ vì* server
không cầm được file. User chốt 2026-08-23 lưu xuống đĩa ⇒ lý do đó mất, và cùng với nó
mất luôn ngoại lệ CORS duy nhất của PLAN 8.6 (không còn request cross-origin nào). Ba
chỗ lệch đầy đủ: `plans/2026-08-23-phase-5-anh-local.md` §0 và `PLAN.md` 8.5.

**Bảy phép kiểm không nằm ở file này** — chúng ở `core/anh.py` (1–6) và
`core/ghi.py::them_anh_moc` (7, trần 10 ảnh, enforce TRONG khoá). File này chỉ làm ba
việc mà tầng API phải làm: kiểm quyền, đọc thân multipart, và dịch lỗi domain sang mã
HTTP. Đặt phép kiểm nào vào đây là dựng một bản thứ hai của nó — và bản thứ hai sẽ là
bản mà đường ghi tương lai (import ảnh hàng loạt, seed) đi vòng qua.
"""

from django.db import transaction
from ninja import File, Router, Status
from ninja.files import UploadedFile

from core.anh import (
    ANH_QUA_NANG,
    BYTE_TOI_DA,
    LoiAnh,
    xu_ly_anh_tai_len,
)
from core.ghi import SO_ANH_TOI_DA_MOI_MOC, QuaNhieuAnh, them_anh_moc, xoa_anh_moc
from core.models.moc import MocAnh
from core.revalidate import lam_moi_mach

from api.ghi_chung import doi_con_song, nap_moc
from api.loi import KHONG_TIM_THAY, LoiOut
from api.quyen import LoiGhi, dang_nhap, doi_chu_so_huu, doi_mach_tuong_tac_duoc
from api.schemas import AnhOut
from api.trinh_bay import anh_ra

router = Router()

#: Mốc đã đủ `SO_ANH_TOI_DA_MOI_MOC` ảnh. 409.
QUA_NHIEU_ANH = "qua_nhieu_anh"


@router.post(
    "/mocs/{int:moc_id}/anh",
    response={
        201: AnhOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
        409: LoiOut,
        413: LoiOut,
    },
    operation_id="tai_anh_moc",
    tags=["anh"],
    auth=dang_nhap,
)
def tai_anh_moc(request, moc_id: int, file: UploadedFile = File(...)):
    """Tải MỘT ảnh lên một mốc (multipart). Tối đa `SO_ANH_TOI_DA_MOI_MOC` ảnh/mốc.

    **Quyền: CHỈ `Moc.author`** — cùng cột mà `PATCH`/`DELETE /mocs/{id}` hỏi, không phải
    `Mach.author`. Ảnh là nội dung của mốc, nên nó theo quyền của mốc.

    Ba ca từ chối theo trạng thái, mỗi ca một mã:

    - mạch bị mod **khoá** ⇒ 403 `mach_bi_khoa` (đọc được, cấm tương tác — PLAN 5.10);
    - mốc đã là **bia mộ** hoặc bị mod ẩn ⇒ 409 `noi_dung_da_go`;
    - mốc đã đủ 10 ảnh ⇒ 409 `qua_nhieu_anh`.

    **Mạch ĐÃ ĐÓNG SỔ vẫn tải ảnh lên được**, và đó là chủ đích chứ không phải sót:
    `PATCH /mocs/{id}` cũng không kiểm `status` (PLAN 5.1 — đóng sổ chặn *nối mốc mới*,
    không chặn sửa mốc cũ). Bổ sung một tấm ảnh vào mốc đã viết là sửa mốc cũ. Nếu luật
    sản phẩm muốn ngược lại thì đó là một quyết định phải ghi vào PLAN 5.1 trước, không
    phải một dòng `if` thêm ở đây.

    **Một ảnh mỗi request**, không nhận nhiều file một lượt: mỗi ảnh có thể hỏng theo một
    kiểu khác nhau, và một response duy nhất cho 5 ảnh thì hoặc phải mang 5 mã lỗi (một
    hình dạng lỗi thứ hai, PLAN mục 7 chỉ có `{detail, code}`), hoặc phải huỷ cả lượt vì
    một tấm sai. UI gửi tuần tự và báo lỗi từng tấm — xem `apps/web/lib/anh.ts`.
    """
    moc = nap_moc(moc_id)
    doi_chu_so_huu(request.user, moc.author_id, "mốc")
    doi_mach_tuong_tac_duoc(moc.mach)
    doi_con_song(moc, "Mốc")

    # Phép kiểm 1 chạy ở `xu_ly_anh_tai_len`, nhưng đọc `file.read()` trước nó thì trần
    # byte đã bị vượt mất rồi — Django đã nuốt cả thân request vào RAM/đĩa tạm. Hỏi
    # `file.size` (đến từ `Content-Length` của phần multipart) là chặn được TRƯỚC khi
    # đọc, đúng thứ tự mà phép kiểm 1 đòi.
    if file.size is not None and file.size > BYTE_TOI_DA:
        raise LoiGhi(
            413,
            ANH_QUA_NANG,
            f"Ảnh nặng {file.size / 1024 / 1024:.1f}MB, "
            f"tối đa {BYTE_TOI_DA // 1024 // 1024}MB.",
        )

    try:
        # Tái mã hoá chạy NGOÀI transaction và ngoài mọi khoá: nó tốn khoảng một giây với
        # ảnh 8MB, và giữ khoá hàng `Moc` suốt thời gian đó là bắt mọi lượt upload của
        # cùng mốc xếp hàng sau nó.
        anh = xu_ly_anh_tai_len(file.read())
    except LoiAnh as e:
        raise LoiGhi(413 if e.ma == ANH_QUA_NANG else 400, e.ma, e.detail) from e

    try:
        hang = them_anh_moc(moc=moc, anh=anh)
    except QuaNhieuAnh as e:
        raise LoiGhi(
            409,
            QUA_NHIEU_ANH,
            f"Mốc {moc.seq} đã đủ {SO_ANH_TOI_DA_MOI_MOC} ảnh — gỡ bớt rồi thêm.",
        ) from e

    lam_moi_mach(moc.mach)
    return Status(201, anh_ra(hang))


@router.delete(
    "/anh/{int:anh_id}",
    response={200: AnhOut, 401: LoiOut, 403: LoiOut, 404: LoiOut},
    operation_id="xoa_anh_moc",
    tags=["anh"],
    auth=dang_nhap,
)
def xoa_anh_moc_api(request, anh_id: int):
    """Gỡ một ảnh — **hàng đi, file đi** (A8). Chỉ tác giả của mốc.

    Trả về chính thẻ ảnh vừa xoá chứ không 204: UI cần `id` để gỡ đúng ô khỏi gallery mà
    không phải tải lại cả mốc, và một 204 rỗng bắt nó tin vào biến nó vừa gửi đi.

    **Không có bia mộ cho ảnh** — xem `core/ghi.py::xoa_anh_moc` để biết vì sao ảnh khác
    mốc và bình luận ở điểm này.

    Không kiểm `doi_con_song`: gỡ ảnh khỏi một mốc mình vừa xoá vẫn là việc hợp lý (nó
    giải phóng đĩa), và mốc bia mộ thì ảnh đã không hiện ở đâu nữa nên không có gì để
    bảo vệ. `doi_mach_tuong_tac_duoc` thì **có** — mạch bị mod khoá là cấm mọi tương tác,
    kể cả của chính tác giả (PLAN 5.10).
    """
    anh = (
        MocAnh.objects.filter(pk=anh_id, moc__mach__hidden_at__isnull=True)
        .select_related("moc", "moc__mach")
        .first()
    )
    if anh is None:
        raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy ảnh {anh_id}.")
    doi_chu_so_huu(request.user, anh.moc.author_id, "mốc")
    doi_mach_tuong_tac_duoc(anh.moc.mach)

    ra = anh_ra(anh)
    with transaction.atomic():
        xoa_anh_moc(anh=anh)
        lam_moi_mach(anh.moc.mach)
    return ra
