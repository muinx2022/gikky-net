"""Ba cửa ảnh: gallery của mốc (lên/xuống) và ảnh nhúng thẳng vào thân bài.

Hai loài ảnh, **một** đường xử lý file. `POST /mocs/{id}/anh` + `DELETE /anh/{id}` là
gallery `MocAnh` của Phase 5; `POST /me/anh` (2026-08-24) là ảnh nhúng giữa bài, không
gắn mốc nào. Chúng ở chung file vì cả ba đi qua đúng bảy phép kiểm của `core/anh.py` và
cùng bộ mã lỗi — tách ra là mời một bản thứ hai của `if file.size > BYTE_TOI_DA` mọc lên
ở nơi khác rồi lệch đi. Khác biệt của cửa thứ ba nằm ở docstring của chính nó.

Phần dưới đây nói về hai cửa gallery — PLAN 8.5 (đã lệch), Phase 5.

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
from django.http import HttpResponse
from ninja import File, Router, Status
from ninja.files import UploadedFile

from core.anh_luu import url_anh
from core.anh_noi_dung import luu_anh_noi_dung
from core.ghi import SO_ANH_TOI_DA_MOI_MOC, QuaNhieuAnh, them_anh_moc, xoa_anh_moc
from core.han_muc import dem_anh_noi_dung_trong_ngay_vn, tran_anh_noi_dung_moi_ngay
from core.models.moc import MocAnh
from core.revalidate import lam_moi_mach
from core.thoi_gian import nua_dem_vn_ke_tiep

from api.anh_chung import doi_khong_qua_nang, xu_ly_hoac_loi_http
from api.ghi_chung import doi_con_song, nap_moc
from api.loi import KHONG_TIM_THAY, LoiOut, LoiThoiGianOut, loi_thoi_gian
from api.quyen import (
    QUA_HAN_MUC_ANH_NOI_DUNG,
    LoiGhi,
    dang_nhap,
    doi_chu_so_huu,
    doi_mach_tuong_tac_duoc,
    doi_trong_cua_so_tu_sua,
)
from api.schemas import AnhNoiDungOut, AnhOut
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

    Bốn ca từ chối theo trạng thái, mỗi ca một mã:

    - mạch bị mod **khoá** ⇒ 403 `mach_bi_khoa` (đọc được, cấm tương tác — PLAN 5.10);
    - mốc đã là **bia mộ** hoặc bị mod ẩn ⇒ 409 `noi_dung_da_go`;
    - **quá cửa sổ tự sửa** (`plans/2026-09-05-cua-so-tu-sua-bai.md`) ⇒ 403
      `het_cua_so_sua` — thêm ảnh cũng đổi nội dung công khai của mốc, mà không để lại
      `MocRevision`/`edited_at` nào; không áp cùng phép kiểm với `PATCH /mocs/{id}` thì
      cửa này là đường vòng để sửa bài sau khi hết hạn (xem `api/quyen.py::doi_trong_cua_so_tu_sua`);
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
    doi_trong_cua_so_tu_sua(moc)

    doi_khong_qua_nang(file)
    # Tái mã hoá chạy NGOÀI transaction và ngoài mọi khoá: nó tốn khoảng một giây với ảnh
    # 8MB, và giữ khoá hàng `Moc` suốt thời gian đó là bắt mọi lượt upload của cùng mốc
    # xếp hàng sau nó.
    anh = xu_ly_hoac_loi_http(file.read())

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

    **Có kiểm cửa sổ tự sửa** (`plans/2026-09-05-cua-so-tu-sua-bai.md`) ⇒ 403
    `het_cua_so_sua` khi hết hạn, cùng phép kiểm với `POST /mocs/{id}/anh` ở trên: gỡ ảnh
    cũng đổi nội dung công khai của mốc mà không để lại dấu vết nào, đúng thứ cửa sổ này
    chặn (`api/quyen.py::doi_trong_cua_so_tu_sua`).
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
    doi_trong_cua_so_tu_sua(anh.moc)

    ra = anh_ra(anh)
    with transaction.atomic():
        xoa_anh_moc(anh=anh)
        lam_moi_mach(anh.moc.mach)
    return ra


@router.post(
    "/me/anh",
    response={
        201: AnhNoiDungOut,
        400: LoiOut,
        401: LoiOut,
        413: LoiOut,
        429: LoiThoiGianOut,
    },
    operation_id="tai_anh_noi_dung",
    tags=["anh"],
    auth=dang_nhap,
)
def tai_anh_noi_dung(request, response: HttpResponse, file: UploadedFile = File(...)):
    """Tải MỘT ảnh để nhúng thẳng vào thân bài (multipart). Trả `{url, width, height}`.

    **Không gắn mốc nào**, và đó là cả lý do cửa này tồn tại: người ta bấm nút ảnh trong
    lúc còn đang soạn, tức trước khi `Moc` có id — mà `POST /mocs/{id}/anh` đòi `moc_id`
    đã tồn tại. `auth=dang_nhap` là toàn bộ phân quyền; không có chủ nào để đối chiếu.

    `url` là đường dẫn `/media/...` mà editor nhét thẳng vào `<img src>`. Nó phải giữ
    nguyên tiền tố ấy tới lúc đăng bài: `core/lam_sach_html.py` **gỡ cả thẻ** `img` nào có
    `src` không trỏ vào kho của site (ảnh ngoài site là pixel theo dõi + mixed content).

    **Hạn mức 30 ảnh / người / ngày lịch VN** (`settings.HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY`)
    ⇒ 429 `qua_han_muc_anh_noi_dung` kèm `thu_lai_tu` = nửa đêm giờ VN kế tiếp. Không có
    nó thì đây là một dịch vụ lưu trữ file miễn phí: cửa duy nhất của cả API nhận file mà
    không gắn với một hàng có sẵn nào để mà đếm.

    Ảnh đi qua đúng bảy phép kiểm của `POST /mocs/{id}/anh` (`core/anh.py`): nhận dạng
    bằng NỘI DUNG, tái mã hoá xoá polyglot + EXIF, allowlist JPEG/PNG/WebP. **Chỉ ảnh** —
    không video (chốt của plan): một cửa nhận video là bài toán khác hẳn (dung lượng,
    transcode, streaming), và mở nó bằng một dòng `accept` là mở nhầm.

    **Không có cửa gỡ.** Ảnh nội dung gỡ khỏi bài bằng cách sửa `body`, và file ở lại —
    cùng ảnh ấy có thể còn nằm trong một bản `MocRevision` cũ hoặc trong bài khác, nên
    một `DELETE /me/anh/{id}` sẽ là cái nút phá nội dung đã đăng. Đổi lại là một khoản nợ
    ghi rõ ở `core/models/moc.py::AnhNoiDung`: ảnh tải lên rồi bỏ bài không được thu hồi.

    `Cache-Control: no-store` vì cùng lý do `POST /me/avatar`: response nói về hạn mức và
    tài sản của **một phiên**, một proxy giữ lại là trả URL của người này cho người kia.
    """
    response["Cache-Control"] = "no-store"

    tran = tran_anh_noi_dung_moi_ngay()
    if dem_anh_noi_dung_trong_ngay_vn(request.user) >= tran:
        # `return` chứ không `raise LoiGhi`: mã 429 mang thêm `thu_lai_tu`, thứ exception
        # handler không dựng được (xem `api/loi.py::LoiThoiGianOut`). Kiểm TRƯỚC khi đọc
        # file — người đã chạm trần không có lý do gì phải chờ 8MB đi qua dây rồi mới
        # nhận lời từ chối.
        return loi_thoi_gian(
            429,
            QUA_HAN_MUC_ANH_NOI_DUNG,
            f"Hôm nay bạn đã tải đủ {tran} ảnh vào bài — mai tải tiếp nhé.",
            thu_lai_tu=nua_dem_vn_ke_tiep(),
        )

    doi_khong_qua_nang(file)
    anh = xu_ly_hoac_loi_http(file.read())
    hang = luu_anh_noi_dung(user=request.user, anh=anh)
    return Status(
        201,
        AnhNoiDungOut(url=url_anh(hang.khoa_luu_tru), width=hang.w, height=hang.h),
    )
