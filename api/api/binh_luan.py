"""Sửa / xoá bình luận — PLAN mục 7, 5.3. Toàn bộ file là đường GHI (Phase 2).

Đường ĐỌC của bình luận nằm ở `api/machs.py` (khán đài) và `api/mocs.py` (ngăn kéo), chia
theo tiền tố URL như phần còn lại của tầng API; `/comments/{id}` chỉ có hai method ghi nên
nó ở riêng đây.
"""

from datetime import timedelta

from django.utils import timezone
from ninja import Router

from core.cau_hinh import doc_phut_tu_sua_binh_luan
from core.doc_noi_dung import Nut, trang_thai_noi_dung
from core.ghi import dat_an_binh_luan, sua_binh_luan, xoa_binh_luan
from core.revalidate import lam_moi_mach

from api.ghi_chung import doi_con_song, nap_binh_luan
from api.loi import LoiOut
from api.quyen import LoiGhi, dang_nhap, doi_chu_so_huu, doi_mach_tuong_tac_duoc
from api.schemas import BinhLuanOut, KetQuaAnBinhLuanOut, KetQuaXoaOut
from api.schemas_ghi import AnBinhLuanIn, BinhLuanSuaIn
from api.trinh_bay import nut_ra

router = Router()


@router.patch(
    "/comments/{int:comment_id}",
    response={200: BinhLuanOut, 400: LoiOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="sua_binh_luan",
    tags=["binh-luan"],
    auth=dang_nhap,
)
def sua_binh_luan_api(request, comment_id: int, du_lieu: BinhLuanSuaIn):
    """Sửa bình luận trong cửa sổ thời gian cho phép.

    **Quyền: Tác giả bình luận trong thời gian cho phép hoặc staff.**
    Sau `doc_phut_tu_sua_binh_luan()` phút kể từ `created_at`, người dùng thường bị chặn 403 `het_cua_so_sua`.
    """
    c = nap_binh_luan(comment_id)
    if not request.user.is_staff:
        doi_chu_so_huu(request.user, c.author_id, "bình luận")
        phut_tu_sua = doc_phut_tu_sua_binh_luan()
        han_sua = c.created_at + timedelta(minutes=phut_tu_sua)
        if timezone.now() > han_sua:
            raise LoiGhi(
                403,
                "het_cua_so_sua",
                f"Đã quá thời gian cho phép chỉnh sửa bình luận ({phut_tu_sua} phút).",
            )
    doi_mach_tuong_tac_duoc(c.mach)
    doi_con_song(c, "Bình luận")
    c = sua_binh_luan(comment=c, body=du_lieu.body, dinh_dang=du_lieu.body_dinh_dang)
    lam_moi_mach(c.mach)
    nut = Nut(
        binh_luan=c,
        do_sau=c.do_sau,
        trang_thai=trang_thai_noi_dung(c),
        con=[],
        hoat_dong_doc_duoc=c.created_at,
    )
    return nut_ra(nut, chu_mach_id=c.mach.author_id)


@router.delete(
    "/comments/{int:comment_id}",
    response={200: KetQuaXoaOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="xoa_binh_luan",
    tags=["binh-luan"],
    auth=dang_nhap,
)
def xoa_binh_luan_api(request, comment_id: int):
    """Xoá bình luận — CHỈ Admin/Staff mới có quyền xoá bình luận.

    Người dùng thường không được xoá bình luận đã đăng.
    """
    if not request.user.is_staff:
        raise LoiGhi(
            403,
            "khong_phai_admin",
            "Chỉ quản trị viên mới có quyền xoá bình luận.",
        )
    c = nap_binh_luan(comment_id)
    doi_con_song(c, "Bình luận")
    mach = c.mach
    xoa_that = xoa_binh_luan(comment=c)
    lam_moi_mach(mach)
    return KetQuaXoaOut(id=comment_id, xoa_that=xoa_that)


@router.post(
    "/comments/{int:comment_id}/an",
    response={200: KetQuaAnBinhLuanOut, 400: LoiOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="an_binh_luan",
    tags=["binh-luan"],
    auth=dang_nhap,
)
def an_binh_luan_api(request, comment_id: int, du_lieu: AnBinhLuanIn):
    """Ẩn hoặc bỏ ẩn bình luận.

    - Tác giả hoặc Mod/Admin mới có quyền.
    - Hướng 2: Tác giả CHỈ được ẩn bình luận khi CHƯA có ai phản hồi (c.replies không có).
      Nếu đã có thảo luận con, chặn ẩn để tránh làm mất ngữ cảnh.
    """
    c = nap_binh_luan(comment_id)
    if c.deleted_at is not None:
        raise LoiGhi(409, "da_xoa", "Bình luận đã bị xoá.")
    if not request.user.is_staff:
        doi_chu_so_huu(request.user, c.author_id, "bình luận")
        doi_mach_tuong_tac_duoc(c.mach)
        if du_lieu.an and c.replies.exists():
            raise LoiGhi(
                400,
                "da_co_tra_loi",
                "Bình luận đã có người phản hồi, không thể ẩn để tránh làm mất ngữ cảnh cuộc thảo luận.",
            )
    da_doi = dat_an_binh_luan(
        comment=c,
        boi=request.user,
        an=du_lieu.an,
        ly_do=du_lieu.ly_do,
    )
    if da_doi:
        lam_moi_mach(c.mach)
    return KetQuaAnBinhLuanOut(id=comment_id, da_an=du_lieu.an)
