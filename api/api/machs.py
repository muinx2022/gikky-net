"""Trang mạch và khán đài — PLAN mục 7, 5.3, 5.5, 9.2."""

from django.utils import timezone
from ninja import Router

from core.doc_noi_dung import (
    SORT_HAY_NHAT,
    SORT_HOP_LE,
    SORT_MOI_NHAT,
    Nut,
    dem_binh_luan_theo_moc,
    dung_cay_theo_sort,
    nap_binh_luan,
    tap_tung_duoc_trich,
)
from core.mat import tinh_mat_theo_thoi_gian
from core.models.dien_dan import Mach
from core.models.moc import Moc
from core.models.tuong_tac import Trich

from api.loi import (
    CURSOR_KHONG_HOP_LE,
    SORT_KHONG_HOP_LE,
    THAM_SO_KHONG_HOP_LE,
    LoiOut,
    khong_tim_thay,
    loi,
)
from api.phan_trang import (
    GIOI_HAN_TOI_DA,
    CursorHong,
    cat_trang,
    giai_ma_cursor,
    kiem_gioi_han,
    ma_hoa_cursor,
)
from api.schemas import KhanDaiOut, MachChiTietOut
from api.trinh_bay import mach_tom_tat_ra, moc_ra, nut_ra, spine_ra

router = Router()


def _mach_hien(mach_id: int):
    """Mạch công khai theo `id`. Ẩn bởi mod ⇒ coi như không tồn tại (PLAN 5.10)."""
    return (
        Mach.objects.filter(pk=mach_id, hidden_at__isnull=True)
        .select_related("sub", "author")
        .first()
    )


@router.get(
    "/machs/{int:mach_id}",
    response={200: MachChiTietOut, 404: LoiOut},
    operation_id="xem_mach",
    tags=["mach"],
)
def xem_mach(request, mach_id: int):
    """Trang mạch: thông tin mạch + **toàn bộ** mốc + `face` + spine.

    `id` là khoá bền của mạch (PLAN 5.9). Endpoint **không nhận slug** — URL
    `/m/<slug>-<id>` có slug cũ hay slug sai vẫn ra đúng mạch này, còn chuyện redirect
    301 về slug chuẩn là việc của tầng web, dựa vào trường `slug` trong response.

    Response **không chứa trường nào phụ thuộc người xem** nên cache được (PLAN 8.4);
    vote của tôi / đã theo chưa / đọc tới đâu nằm ở `GET /machs/{id}/me` (Phase 3).

    Mốc đã xoá hoặc bị mod ẩn vẫn có mặt trong `mocs` và `spine` dưới dạng **bia mộ giữ
    chỗ**, không kèm nội dung: `seq` bất biến, giấu hẳn một ô là thủng dãy số và phá bất
    biến `entry_count == số ô trên spine` (PLAN 5.2).
    """
    mach = _mach_hien(mach_id)
    if mach is None:
        return khong_tim_thay(f"mạch {mach_id}")

    mocs = list(Moc.objects.filter(mach=mach).order_by("seq"))
    dem = dem_binh_luan_theo_moc(mach)
    trich_theo_moc = {
        t.moc_id: t
        for t in Trich.objects.filter(
            moc__mach=mach, removed_at__isnull=True
        ).select_related("comment", "comment__author")
    }

    # `model_dump()` chứ không phải `.dict()`: pydantic 2 deprecate `.dict()`, mà
    # `filterwarnings = ["error"]` biến `DeprecationWarning` thành lỗi test.
    # Dùng lại `MachTomTatOut` để 12 trường chung của thẻ feed và của trang mạch không
    # có hai bản sao trôi khỏi nhau.
    tom_tat = mach_tom_tat_ra(mach)
    return MachChiTietOut(
        **tom_tat.model_dump(),
        closed_at=mach.closed_at,
        locked=mach.locked_at is not None,
        face=tinh_mat_theo_thoi_gian(
            status=mach.status,
            locked_at=mach.locked_at,
            last_activity_at=mach.last_activity_at,
        ),
        mocs=[
            moc_ra(m, so_binh_luan=dem.get(m.seq, 0), trich=trich_theo_moc.get(m.pk))
            for m in mocs
        ],
        spine=[spine_ra(m, so_binh_luan=dem.get(m.seq, 0)) for m in mocs],
    )


def _cat_goc(
    goc: list[Nut], *, sort: str, cursor: str | None, offset: int, limit: int
):
    """Cắt trang danh sách thread gốc. Trả `(threads, offset_ke_tiep, cursor_ke_tiep)`.

    Hai kiểu phân trang cho ba sort, đúng PLAN 5.3 — và chúng **không dùng lẫn nhau**:
    `hay_nhat` xếp theo rank phụ thuộc `now`, không có khoá ổn định nào để neo cursor
    vào, nên nó dùng `offset` và chấp nhận trôi nhẹ. Hai sort thời gian có khoá thật
    `(created_at, id)` nên dùng keyset.

    Keyset ở đây chạy trên danh sách đã nạp sẵn trong bộ nhớ chứ không ở tầng SQL (xem
    `core.doc_noi_dung.nap_binh_luan` để biết vì sao nạp cả mạch). Tính chất giữ nguyên:
    trang sau neo vào giá trị thật của hàng cuối trang trước, nên thêm/bớt bình luận giữa
    hai lần gọi không làm trùng hay sót.

    Hàm này **giả định tham số đã đúng kiểu phân trang của `sort`**:
    `liet_ke_binh_luan_mach` trả 400 trước khi gọi vào đây. Đừng chuyển phép kiểm đó
    xuống đây rồi cho qua — nhánh `hay_nhat` không đọc `cursor` và nhánh thời gian không
    đọc `offset`, nên tham số sai chỗ rơi tới đây sẽ bị **nuốt im lặng** thành trang 1.

    Ném `CursorHong` khi cursor rác.
    """
    if sort == SORT_HAY_NHAT:
        trang, con_nua = cat_trang(goc[offset : offset + limit + 1], limit)
        return trang, (offset + limit if con_nua else None), None

    if cursor is not None:
        khi, id = giai_ma_cursor(cursor)
        moc = (khi, id)
        if sort == SORT_MOI_NHAT:
            goc = [n for n in goc if (n.binh_luan.created_at, n.binh_luan.pk) < moc]
        else:
            goc = [n for n in goc if (n.binh_luan.created_at, n.binh_luan.pk) > moc]

    trang, con_nua = cat_trang(goc[: limit + 1], limit)
    ke_tiep = (
        ma_hoa_cursor(trang[-1].binh_luan.created_at, trang[-1].binh_luan.pk)
        if con_nua and trang
        else None
    )
    return trang, None, ke_tiep


@router.get(
    "/machs/{int:mach_id}/comments",
    response={200: KhanDaiOut, 400: LoiOut, 404: LoiOut},
    operation_id="liet_ke_binh_luan_mach",
    tags=["binh-luan"],
)
def liet_ke_binh_luan_mach(
    request,
    mach_id: int,
    sort: str = SORT_HAY_NHAT,
    cursor: str | None = None,
    offset: int = 0,
    limit: int = GIOI_HAN_TOI_DA,
):
    """Khán đài: **cây bình luận đã dựng sẵn**, server sắp xếp (PLAN mục 7).

    `?sort=hay_nhat|moi_nhat|cu_nhat`, mặc định `hay_nhat`. Sort không thuộc ba giá trị
    đó trả 400 `sort_khong_hop_le` — API **không bao giờ tự đổi sort ngầm** dưới tay
    người dùng (PLAN nguyên tắc 7).

    - `hay_nhat`: wilson (z = 1.281) cộng hệ số tươi 0.15 cho bình luận **gốc** ra đời
      sau mốc mới nhất và còn trong 48 giờ đầu đời của nó. Sibling trong thread sắp theo
      wilson **thuần** — hệ số tươi không áp cho reply. Phân trang bằng `?offset=`,
      `?limit=` tối đa 50.
    - `moi_nhat` / `cu_nhat`: `?cursor=` keyset trên `(created_at, id)`.

    **Hai kiểu phân trang KHÔNG dùng lẫn nhau, dùng nhầm trả 400** với
    `code = "tham_so_khong_hop_le"`: `?cursor=` kèm `sort=hay_nhat`, hoặc `?offset=` khác
    0 kèm hai sort thời gian. Nuốt im lặng tham số sai chỗ là hành vi mà chính
    `api/phan_trang.py` cấm cho cursor rác: người ở trang 3 của `moi_nhat` bấm đổi sang
    `hay_nhat`, router giữ nguyên query string, API trả **trang 1** kèm HTTP 200 — UI
    tưởng mình vẫn ở trang 3 và append tiếp ⇒ lặp dòng hoặc mất dòng, không lần ra được.

    Bình luận bị mod ẩn, hoặc tác giả tự xoá, chỉ còn lại **bia mộ giữ chỗ** khi nó còn
    con sống sót trong `replies` — và riêng ca tác giả tự xoá thì cả khi bình luận **đã
    từng được trích vào sổ**, kể cả trích đã gỡ (PLAN 5.3). Không dính vế nào thì nó biến
    mất hẳn. "Con sống sót" không có nghĩa "con đọc được": con ấy có thể tự nó là bia mộ,
    nên một thread trong `threads` có thể **toàn bia mộ, không một chữ nội dung nào**, mà
    vẫn chiếm một chỗ trong `tong_thread` và một slot của trang này.
    Bia mộ không được tính vào `comment_count` của mạch, nên số bình luận **đọc được** có
    thể nhỏ hơn số dòng trả về.
    """
    if sort not in SORT_HOP_LE:
        return loi(
            400,
            SORT_KHONG_HOP_LE,
            f"sort phải thuộc {{{', '.join(SORT_HOP_LE)}}}, nhận {sort!r}.",
        )
    if (l := kiem_gioi_han(limit)) is not None:
        return l
    if offset < 0:
        return loi(
            400, THAM_SO_KHONG_HOP_LE, f"offset không được âm, nhận {offset}."
        )
    if cursor is not None and sort == SORT_HAY_NHAT:
        return loi(
            400,
            THAM_SO_KHONG_HOP_LE,
            "sort=hay_nhat phân trang bằng offset, không nhận cursor.",
        )
    if offset != 0 and sort != SORT_HAY_NHAT:
        return loi(
            400,
            THAM_SO_KHONG_HOP_LE,
            f"sort={sort} phân trang bằng cursor, không nhận offset.",
        )

    mach = _mach_hien(mach_id)
    if mach is None:
        return khong_tim_thay(f"mạch {mach_id}")

    goc = dung_cay_theo_sort(
        nap_binh_luan(mach),
        sort=sort,
        mach=mach,
        now=timezone.now(),
        tung_duoc_trich=tap_tung_duoc_trich(mach),
    )
    try:
        trang, offset_ke_tiep, cursor_ke_tiep = _cat_goc(
            goc, sort=sort, cursor=cursor, offset=offset, limit=limit
        )
    except CursorHong as e:
        return loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")

    return KhanDaiOut(
        sort=sort,
        tong_thread=len(goc),
        threads=[nut_ra(n, chu_mach_id=mach.author_id) for n in trang],
        offset_ke_tiep=offset_ke_tiep,
        cursor_ke_tiep=cursor_ke_tiep,
    )
