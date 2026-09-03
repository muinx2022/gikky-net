"""Ẩn / gỡ ẩn mốc · bình luận · mạch, khoá mạch, trang chi tiết mạch cho mod — PLAN 5.10.

**Không một dòng nào ở đây ghi thẳng vào `hidden_at`/`locked_at`.** Mọi thay đổi đi qua
`core/ghi.py::dat_an_*` / `dat_khoa_mach`, và lý do là lý do của cả `core/ghi.py`: ẩn một
mốc hay một bình luận kéo theo `comment_count`, `last_activity_at` và `diem_bai_goc`. Một
`Moc.objects.filter(pk=…).update(hidden_at=…)` viết cho gọn ở handler là bốn cột
denormalize sai **vĩnh viễn** — không log, không job đối soát, chỉ có banner "💬 24" nói
dối trên một trang đếm được 22.

Handler ở đây làm đúng ba việc: tra hàng, gọi xuống đường ghi, dựng response. Kiểm quyền
đã xong ở tầng API (`ChiMod`), và không luật domain nào sống ở file này.

**404 cho id lạ, và KHÔNG 404 cho thứ đã bị ẩn.** Ngược lý lẽ của `KHONG_TIM_THAY` ở API
công khai (`api/loi.py`), và đó là chủ đích: khu này staff-only, mod **phải** với được thứ
vừa bị ẩn để gỡ ẩn nó. Lọc `hidden_at__isnull=True` copy sang đây là biến mọi hành động
ẩn thành một chiều không quay lại được.
"""

from django.db.models import Prefetch
from ninja import Router

from core.doc_noi_dung import doc_duoc
from core.ghi import dat_an_binh_luan, dat_an_mach, dat_an_moc, dat_khoa_mach
from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.models.moc import Moc
from core.revalidate import lam_moi_mach

from api.loi import LoiOut, khong_tim_thay
from api.quan_tri_schemas import (
    DatAnIn,
    DatKhoaMachIn,
    KetQuaDoiTrangThaiOut,
    MachQuanTriOut,
    MocQuanTriOut,
    trich_yeu,
)
from api.trinh_bay import nguoi_dung_ra

router = Router()

TRA_LOI_DOI = {200: KetQuaDoiTrangThaiOut, 401: LoiOut, 403: LoiOut, 404: LoiOut}


def duong_dan_mach(mach: Mach) -> str:
    """URL công khai của một mạch — `/m/<slug>-<id>` (PLAN 5.9).

    Dựng ở server để nút "mở ra xem" của khu quản trị không phải gõ lại quy tắc URL. Đó
    là bản sao thứ hai của một hợp đồng: `apps/web` đọc `id` từ đuôi chuỗi này, nên hai
    bản lệch nhau là nút mở ra trang 404 — mà chỉ trong khu quản trị, tức không ai thấy.
    """
    return f"/m/{mach.slug}-{mach.pk}"


@router.post(
    "/mocs/{int:moc_id}/an",
    response=TRA_LOI_DOI,
    operation_id="quan_tri_dat_an_moc",
    tags=["quan-tri-kiem-duyet"],
)
def dat_an_moc_endpoint(request, moc_id: int, du_lieu: DatAnIn):
    """Mod ẩn / gỡ ẩn một mốc. Idempotent — gửi hai lần cho cùng trạng thái.

    Mốc bị ẩn **vẫn giữ ô trên spine** kèm nhãn "mốc đã bị ẩn" (PLAN 5.2): `seq` bất biến
    nên `entry_count` không lùi. Đổi lại, `comment_count`, `last_activity_at` và
    `diem_bai_goc` (khi đây là mốc 1) được tính lại trong cùng transaction.
    """
    moc = Moc.objects.filter(pk=moc_id).first()
    if moc is None:
        return khong_tim_thay("mốc")
    da_doi = dat_an_moc(moc=moc, boi=request.user, an=du_lieu.an, ly_do=du_lieu.ly_do)
    # Ẩn/gỡ ẩn một mốc đổi nội dung trang mạch — sự kiện CÓ signal (PLAN 8.4 điểm 2).
    lam_moi_mach(moc.mach)
    return KetQuaDoiTrangThaiOut(da_doi=da_doi, dang_bat=moc.hidden_at is not None)


@router.post(
    "/comments/{int:comment_id}/an",
    response=TRA_LOI_DOI,
    operation_id="quan_tri_dat_an_binh_luan",
    tags=["quan-tri-kiem-duyet"],
)
def dat_an_binh_luan_endpoint(request, comment_id: int, du_lieu: DatAnIn):
    """Mod ẩn / gỡ ẩn một bình luận. Idempotent.

    Gỡ ẩn **không** hồi sinh bình luận mà tác giả đã tự xoá — `deleted_at` là trục khác
    và endpoint này không chạm tới nó.
    """
    comment = Comment.objects.filter(pk=comment_id).first()
    if comment is None:
        return khong_tim_thay("bình luận")
    da_doi = dat_an_binh_luan(
        comment=comment, boi=request.user, an=du_lieu.an, ly_do=du_lieu.ly_do
    )
    lam_moi_mach(comment.mach)
    return KetQuaDoiTrangThaiOut(da_doi=da_doi, dang_bat=comment.hidden_at is not None)


@router.post(
    "/machs/{int:mach_id}/an",
    response=TRA_LOI_DOI,
    operation_id="quan_tri_dat_an_mach",
    tags=["quan-tri-kiem-duyet"],
)
def dat_an_mach_endpoint(request, mach_id: int, du_lieu: DatAnIn):
    """Mod ẩn / gỡ ẩn cả mạch. Idempotent.

    Mạch bị ẩn biến mất khỏi hai feed, khỏi trang sub, khỏi hồ sơ tác giả và khỏi
    `sitemap`; `GET /machs/{id}` công khai trả 404. Nó **không** đổi con số denormalize
    nào của chính nó — xem `core/ghi.py::dat_an_mach`.
    """
    mach = Mach.objects.filter(pk=mach_id).first()
    if mach is None:
        return khong_tim_thay("mạch")
    da_doi = dat_an_mach(mach=mach, boi=request.user, an=du_lieu.an, ly_do=du_lieu.ly_do)
    # Cả hai chiều: ẩn thì cache phải đổi sang 404, gỡ ẩn thì phải thôi 404.
    lam_moi_mach(mach)
    return KetQuaDoiTrangThaiOut(da_doi=da_doi, dang_bat=mach.hidden_at is not None)


@router.post(
    "/machs/{int:mach_id}/khoa",
    response=TRA_LOI_DOI,
    operation_id="quan_tri_dat_khoa_mach",
    tags=["quan-tri-kiem-duyet"],
)
def dat_khoa_mach_endpoint(request, mach_id: int, du_lieu: DatKhoaMachIn):
    """Mod khoá / mở khoá một mạch: đọc được, cấm mọi tương tác (PLAN 5.10). Idempotent.

    **Trục riêng, khác "đóng sổ" của tác giả.** Endpoint này không đụng `status`, nên
    "mạch đã đóng bị mod khoá" vẫn diễn đạt được. Mạch bị khoá luôn ở mặt CẶN.
    """
    mach = Mach.objects.filter(pk=mach_id).first()
    if mach is None:
        return khong_tim_thay("mạch")
    da_doi = dat_khoa_mach(
        mach=mach, boi=request.user, khoa=du_lieu.khoa, ly_do=du_lieu.ly_do
    )
    lam_moi_mach(mach)
    return KetQuaDoiTrangThaiOut(da_doi=da_doi, dang_bat=mach.locked_at is not None)


@router.get(
    "/machs/{int:mach_id}",
    response={200: MachQuanTriOut, 401: LoiOut, 403: LoiOut, 404: LoiOut},
    operation_id="quan_tri_xem_mach",
    tags=["quan-tri-kiem-duyet"],
)
def xem_mach(request, mach_id: int):
    """Trang chi tiết một mạch cho mod (PLAN 9.3 mục 2) — mọi mốc, kể cả ẩn và bia mộ.

    Trả **cả** mốc đã bị ẩn và bia mộ, kèm trích yếu nội dung: mod cần đọc để quyết gỡ ẩn.
    Đó là chuyện khu này được phép làm mà `GET /api/v1/machs/{id}` thì không — xem
    docstring `api/quan_tri_schemas.py`.

    Số truy vấn là HẰNG SỐ (mạch + mốc kèm tác giả), không phụ thuộc số mốc.
    """
    mach = (
        Mach.objects.filter(pk=mach_id)
        .select_related("sub", "author")
        .prefetch_related(
            Prefetch(
                "mocs",
                queryset=Moc.objects.select_related("author").order_by("seq"),
            )
        )
        .first()
    )
    if mach is None:
        return khong_tim_thay("mạch")
    return MachQuanTriOut(
        id=mach.pk,
        title=mach.title,
        slug=mach.slug,
        sub_slug=mach.sub.slug,
        tac_gia=nguoi_dung_ra(mach.author),
        status=mach.status,
        created_at=mach.created_at,
        last_entry_at=mach.last_entry_at,
        last_activity_at=mach.last_activity_at,
        entry_count=mach.entry_count,
        comment_count=mach.comment_count,
        da_bi_an=mach.hidden_at is not None,
        da_khoa=mach.locked_at is not None,
        duong_dan_cong_khai=duong_dan_mach(mach),
        mocs=[_moc_ra(m, mach) for m in mach.mocs.all()],
    )


def _moc_ra(moc: Moc, mach: Mach) -> MocQuanTriOut:
    """`Moc` → schema quản trị. **Cố ý không gọi `api/trinh_bay.py::moc_ra`.**

    `moc_ra` áp luật che của cửa công khai (bia mộ mất `body`, mất tác giả). Dùng nó ở đây
    là trang phán xử của mod hiện ra một ô trống — đúng thứ mod cần đọc thì không có. Hai
    hàm, hai luật, và cái tên `_moc_ra` để dưới gạch dưới để không ai import nhầm nó ra
    ngoài file này.

    Nhận `mach` làm THAM SỐ chứ không đọc `moc.mach`: hàm này chạy trong một vòng lặp trên
    danh sách mốc đã prefetch, và `moc.mach` ở đó là một truy vấn cho MỖI mốc — đúng thứ
    docstring `xem_mach` hứa là hằng số. Nó cần `mach` vì `sua_duoc` hỏi cả `locked_at`.
    """
    return MocQuanTriOut(
        id=moc.pk,
        seq=moc.seq,
        occurred_at=moc.occurred_at,
        created_at=moc.created_at,
        tac_gia=nguoi_dung_ra(moc.author),
        trich_yeu=trich_yeu(moc.body),
        da_bi_an=moc.hidden_at is not None,
        da_xoa=moc.deleted_at is not None,
        edit_count=moc.edit_count,
        # Cùng phép tính với `quan_tri_sua_bai.py::_sua_duoc`, và cùng nguồn luật che
        # (`core/doc_noi_dung.py`). Hai chỗ gọi vì hai schema khác nhau, không phải hai
        # luật — bảng này chỉ cần biết có hiện link "Sửa" hay không.
        sua_duoc=doc_duoc(moc) and mach.locked_at is None,
    )
