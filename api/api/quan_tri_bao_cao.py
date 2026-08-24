"""Hàng đợi báo cáo — PLAN 5.10, 9.3 mục 1 (màn hình ưu tiên số một của khu quản trị).

Hàng đợi phải **kèm ngữ cảnh**: PLAN 9.3 viết "bảng, xem ngữ cảnh, nút ẩn/khoá/ban ngay
trên hàng". Không có ngữ cảnh thì mod phải mở tab thứ hai cho từng dòng, và cái giá thật
của việc đó là mod đọc lướt rồi bấm bừa.

**Ngữ cảnh nạp bằng SỐ TRUY VẤN HẰNG, không phải N+1.** `Report.target_id` không phải FK
(cố ý — báo cáo phải sống sót sau khi thứ bị tố bị xoá cứng), nên không `select_related`
được. Cách ở đây: gom id theo `target_type` rồi nạp **ba** truy vấn cho cả trang, bất kể
trang có 20 hay 50 dòng. Một vòng `for` gọi `Mach.objects.get(...)` là 20 round-trip cho
một màn hình mà mod bấm F5 liên tục.

⚠ **Trích yếu ở đây KHÔNG bị che theo luật công khai.** Mod phải đọc được thứ vừa bị ẩn —
đó là toàn bộ lý do `api/quan_tri_schemas.py` tồn tại tách khỏi `api/schemas.py`. Điều
kiện để việc đó an toàn là **`ChiMod` ở tầng API**, không phải một bộ lọc ở đây; đừng
"chữa" bằng cách thêm `hidden_at__isnull=True` — làm thế là hàng đợi câm đúng lúc cần nói.
"""

from ninja import Router

from core.ghi import dong_bao_cao
from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.models.he_thong import Report
from core.models.moc import Moc

from api.loi import CURSOR_KHONG_HOP_LE, LoiOut, khong_tim_thay, loi
from api.phan_trang import (
    GIOI_HAN_MAC_DINH,
    CursorHong,
    cat_trang,
    dem_tong,
    giai_ma_cursor,
    kiem_gioi_han,
    loc_keyset,
    ma_hoa_cursor,
)
from api.quan_tri_kiem_duyet import duong_dan_mach
from api.quan_tri_schemas import (
    BaoCaoOut,
    DongBaoCaoIn,
    KetQuaDoiTrangThaiOut,
    LocBaoCao,
    NoiDungBiBaoCaoOut,
    TrangBaoCaoOut,
    trich_yeu,
)
from api.trinh_bay import nguoi_dung_ra

router = Router()

LOC_CHO_XU_LY = "cho_xu_ly"
LOC_DA_XU_LY = "da_xu_ly"


@router.get(
    "/reports",
    response={200: TrangBaoCaoOut, 400: LoiOut, 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_liet_ke_bao_cao",
    tags=["quan-tri-bao-cao"],
)
def liet_ke_bao_cao(
    request,
    trang_thai: LocBaoCao = LOC_CHO_XU_LY,
    limit: int = GIOI_HAN_MAC_DINH,
    cursor: str | None = None,
):
    """Hàng đợi báo cáo, mới nhất trước, cursor keyset `(created_at, id)`.

    Mặc định `trang_thai=cho_xu_ly` — đó là việc của mod. `da_xu_ly` và `tat_ca` có mặt để
    tra lại một quyết định cũ. Giá trị lạ trả **400 `tham_so_khong_hop_le`** (mã mặc định,
    cố ý — xem `tests/test_hop_dong_openapi.py::CO_Y_DUNG_MA_MAC_DINH`).

    Mỗi dòng kèm `dich`: loại, mạch chứa nó, tác giả, trích yếu nội dung và đường dẫn công
    khai. `dich` là `null` khi thứ bị tố không còn tồn tại — báo cáo vẫn ở lại hàng đợi.
    """
    if (loi_limit := kiem_gioi_han(limit)) is not None:
        return loi_limit

    qs = Report.objects.select_related("reporter", "resolved_by")
    if trang_thai == LOC_CHO_XU_LY:
        qs = qs.filter(resolved_at__isnull=True)
    elif trang_thai == LOC_DA_XU_LY:
        qs = qs.filter(resolved_at__isnull=False)

    tong = dem_tong(qs)

    if cursor is not None:
        try:
            khi, id = giai_ma_cursor(cursor)
        except CursorHong as e:
            return loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")
        qs = loc_keyset(qs, truong="created_at", khi=khi, id=id, giam_dan=True)

    hang = list(qs.order_by("-created_at", "-pk")[: limit + 1])
    trang, con_nua = cat_trang(hang, limit)
    ke_tiep = (
        ma_hoa_cursor(trang[-1].created_at, trang[-1].pk) if con_nua and trang else None
    )

    ngu_canh = _nap_ngu_canh(trang)
    return TrangBaoCaoOut(
        items=[_bao_cao_ra(r, ngu_canh) for r in trang],
        cursor_ke_tiep=ke_tiep,
        tong=tong,
    )


@router.post(
    "/reports/{int:report_id}/dong",
    response={
        200: KetQuaDoiTrangThaiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
    },
    operation_id="quan_tri_dong_bao_cao",
    tags=["quan-tri-bao-cao"],
)
def dong_bao_cao_endpoint(request, report_id: int, du_lieu: DongBaoCaoIn):
    """Đóng một báo cáo, ghi lại mod đã làm gì. Idempotent — đóng lần hai trả `da_doi=false`.

    **`hanh_dong` chỉ được GHI LẠI, nó không tự thi hành gì.** Đóng với `hanh_dong="an"`
    mà chưa ai bấm ẩn thì nội dung vẫn hiện; ẩn là một lời gọi riêng tới
    `POST /mocs/{id}/an`. Gộp hai việc là dựng một đường ghi thứ hai tới `hidden_at` nằm
    ngoài `core/ghi.py::dat_an_*` — xem docstring `core/ghi.py::dong_bao_cao`.
    """
    report = Report.objects.filter(pk=report_id).first()
    if report is None:
        return khong_tim_thay("báo cáo")
    da_doi = dong_bao_cao(report=report, boi=request.user, hanh_dong=du_lieu.hanh_dong)
    return KetQuaDoiTrangThaiOut(da_doi=da_doi, dang_bat=report.resolved_at is not None)


def _nap_ngu_canh(bao_cao: list[Report]) -> dict[tuple[str, int], NoiDungBiBaoCaoOut]:
    """Ngữ cảnh cho CẢ trang bằng ba truy vấn — một cho mỗi `target_type`.

    Khoá là cặp `(target_type, target_id)` chứ không phải mình `target_id`: id của một
    `Moc` và của một `Comment` trùng nhau là chuyện thường (hai bảng, hai sequence), và
    khoá bằng mình id là hàng đợi hiện nội dung của **nhầm bảng** — một lỗi trông như dữ
    liệu bẩn chứ không như lỗi code.

    Ba truy vấn là **trần**, không phải sàn: `filter(pk__in=[])` của Django trả về rỗng mà
    không chạm DB, nên một trang toàn báo cáo bình luận chỉ tốn một truy vấn. Con số ghim
    ở `tests/test_api_quan_tri_bao_cao.py` là con số của trang có đủ ba loại.
    """
    theo_loai: dict[str, set[int]] = {
        Report.Dich.MACH: set(),
        Report.Dich.MOC: set(),
        Report.Dich.COMMENT: set(),
    }
    for r in bao_cao:
        if r.target_type in theo_loai:
            theo_loai[r.target_type].add(r.target_id)

    ra: dict[tuple[str, int], NoiDungBiBaoCaoOut] = {}

    for mach in Mach.objects.filter(pk__in=theo_loai[Report.Dich.MACH]).select_related(
        "author"
    ):
        ra[(Report.Dich.MACH, mach.pk)] = NoiDungBiBaoCaoOut(
            loai=Report.Dich.MACH,
            id=mach.pk,
            mach_id=None,
            mach_title=mach.title,
            tac_gia=nguoi_dung_ra(mach.author),
            trich_yeu=trich_yeu(mach.title),
            seq=None,
            da_bi_an=mach.hidden_at is not None,
            mach_da_khoa=mach.locked_at is not None,
            tac_gia_bi_ban=mach.author.dang_bi_ban(),
            duong_dan_cong_khai=duong_dan_mach(mach),
        )

    for moc in Moc.objects.filter(pk__in=theo_loai[Report.Dich.MOC]).select_related(
        "author", "mach"
    ):
        ra[(Report.Dich.MOC, moc.pk)] = NoiDungBiBaoCaoOut(
            loai=Report.Dich.MOC,
            id=moc.pk,
            mach_id=moc.mach_id,
            mach_title=moc.mach.title,
            tac_gia=nguoi_dung_ra(moc.author),
            trich_yeu=trich_yeu(moc.body),
            seq=moc.seq,
            da_bi_an=moc.hidden_at is not None,
            mach_da_khoa=moc.mach.locked_at is not None,
            tac_gia_bi_ban=_bi_ban(moc.author),
            duong_dan_cong_khai=duong_dan_mach(moc.mach),
        )

    for c in Comment.objects.filter(
        pk__in=theo_loai[Report.Dich.COMMENT]
    ).select_related("author", "mach"):
        ra[(Report.Dich.COMMENT, c.pk)] = NoiDungBiBaoCaoOut(
            loai=Report.Dich.COMMENT,
            id=c.pk,
            mach_id=c.mach_id,
            mach_title=c.mach.title,
            tac_gia=nguoi_dung_ra(c.author),
            trich_yeu=trich_yeu(c.body),
            # Neo sống ở bình luận GỐC (PLAN nguyên tắc 6); reply mang `None`, và đó là
            # sự thật chứ không phải dữ liệu thiếu — không đi tra ngược lên gốc ở đây vì
            # phép tra ấy là một truy vấn nữa cho mỗi dòng.
            seq=c.anchor_moc_seq,
            da_bi_an=c.hidden_at is not None,
            mach_da_khoa=c.mach.locked_at is not None,
            tac_gia_bi_ban=_bi_ban(c.author),
            duong_dan_cong_khai=duong_dan_mach(c.mach),
        )

    return ra


def _bi_ban(tac_gia) -> bool | None:
    """`None` khi không còn tác giả — bia mộ giữ nguyên hàng nhưng nhả `author`.

    `None` chứ không `False`: "tác giả này không bị ban" và "không có tác giả để mà ban"
    là hai câu khác nhau, và nút "Ban" trên hàng phải VẮNG MẶT ở câu thứ hai chứ không
    hiện ra rồi 404.
    """
    return None if tac_gia is None else tac_gia.dang_bi_ban()


def _bao_cao_ra(r: Report, ngu_canh) -> BaoCaoOut:
    return BaoCaoOut(
        id=r.pk,
        ly_do=r.ly_do,
        ghi_chu=r.ghi_chu,
        created_at=r.created_at,
        reporter=nguoi_dung_ra(r.reporter),
        dich=ngu_canh.get((r.target_type, r.target_id)),
        resolved_at=r.resolved_at,
        resolved_by=nguoi_dung_ra(r.resolved_by) if r.resolved_by else None,
        action=r.action,
    )
