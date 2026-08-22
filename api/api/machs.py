"""Trang mạch và khán đài — PLAN mục 7, 5.3, 5.5, 9.2."""

from django.utils import timezone
from ninja import Router

from core.doc_noi_dung import (
    SORT_HAY_NHAT,
    SORT_HOP_LE,
    SORT_MOI_NHAT,
    Nut,
    cau_dang_doc,
    dem_binh_luan_theo_moc,
    dung_cay_theo_sort,
    nap_binh_luan,
    tap_dang_duoc_trich,
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
    # `exclude={"diem"}` là CỐ Ý (plan con 1d §2.1). `diem` là điểm của mốc 1, và trang
    # mạch đã trả nguyên mốc 1 kèm `score` của nó trong `mocs` — chép thêm một bản ở tầng
    # mạch là dựng hai chỗ nói cùng một con số, và cái thứ hai sẽ là cái trôi. Thẻ feed
    # cần `diem` vì nó KHÔNG có `mocs`.
    tom_tat = mach_tom_tat_ra(mach)
    return MachChiTietOut(
        **tom_tat.model_dump(exclude={"diem"}),
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
    limit: int | None = None,
    dang_doc: bool = False,
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

    ### `?dang_doc=1` — "câu đáng đọc" (PLAN 5.5)

    Trả **phép hợp `đã trích ∪ top-10 theo wilson`** trên các thread GỐC, sắp theo wilson
    **thuần** giảm dần. Đây là khối gắn nhãn "Câu đáng đọc" nằm trên cùng khi chân trang
    mặt CẶN bung khán đài; cây đầy đủ vẫn lấy bằng một lời gọi thường (không có tham số
    này).

    Phép hợp là hợp THẬT: một bình luận được trích nhưng xếp hạng thấp **vẫn có mặt**.
    Không có phân trang ở chế độ này — tập tối đa là `10 + số mốc có trích`, và
    `offset_ke_tiep`/`cursor_ke_tiep` luôn `null`, `tong_thread` là kích thước của tập.

    Chế độ này (và **chỉ** chế độ này) trả thêm `so_ung_vien_bo_lai`: số thread gốc đọc
    được nằm ngoài tập. `0` nghĩa là khối không lọc được gì và UI phải ẩn nó đi (PLAN 5.5,
    ngoại lệ "tập = cả khán đài"). Đừng suy con số ấy bằng cách so `tong_thread` của hai
    lời gọi — hai đầu đếm bia mộ khác nhau, xem `KhanDaiOut` (Y1, lượt vá 4).

    Vì tập này có thứ tự riêng, `?dang_doc=1` **chỉ đi cùng `sort=hay_nhat`** (mặc định)
    và **không nhận `offset`/`cursor`/`limit`** — dùng lẫn trả 400
    `tham_so_khong_hop_le` thay vì lặng lẽ bỏ qua tham số, đúng luật đang áp cho hai kiểu
    phân trang ở trên. `limit` là **cửa thứ tư của cùng cái luật ấy** (vá V7,
    2026-08-22): nhánh này không đọc `limit` ở đâu cả, nên `?dang_doc=1&limit=5` trước đó
    trả 200 kèm 11 thread — người gọi tưởng mình đã cắt còn 5.

    `limit` mặc định là `None` chứ không phải `GIOI_HAN_TOI_DA`, và đó là cả cách phép
    kiểm trên đứng được: với mặc định là một con số thì "không truyền" và "truyền đúng 50"
    trông y hệt nhau ở trong hàm, nên hoặc là bỏ qua im lặng, hoặc là 400 cho một lời gọi
    không sai gì.
    """
    if sort not in SORT_HOP_LE:
        return loi(
            400,
            SORT_KHONG_HOP_LE,
            f"sort phải thuộc {{{', '.join(SORT_HOP_LE)}}}, nhận {sort!r}.",
        )
    if (l := kiem_gioi_han(limit if limit is not None else GIOI_HAN_TOI_DA)) is not None:
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
    if dang_doc and (
        sort != SORT_HAY_NHAT
        or offset != 0
        or cursor is not None
        or limit is not None
    ):
        return loi(
            400,
            THAM_SO_KHONG_HOP_LE,
            "dang_doc=1 có thứ tự riêng (wilson thuần) và không phân trang: "
            "không nhận sort khác hay_nhat, không nhận offset/cursor/limit.",
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

    if dang_doc:
        tap = cau_dang_doc(goc, dang_duoc_trich=tap_dang_duoc_trich(mach))
        return KhanDaiOut(
            sort=sort,
            tong_thread=len(tap.threads),
            threads=[nut_ra(n, chu_mach_id=mach.author_id) for n in tap.threads],
            so_ung_vien_bo_lai=tap.so_ung_vien_bo_lai,
            offset_ke_tiep=None,
            cursor_ke_tiep=None,
        )

    try:
        trang, offset_ke_tiep, cursor_ke_tiep = _cat_goc(
            goc,
            sort=sort,
            cursor=cursor,
            offset=offset,
            limit=limit if limit is not None else GIOI_HAN_TOI_DA,
        )
    except CursorHong as e:
        return loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")

    return KhanDaiOut(
        sort=sort,
        tong_thread=len(goc),
        threads=[nut_ra(n, chu_mach_id=mach.author_id) for n in trang],
        # `None`, không phải `0` — xem `KhanDaiOut.so_ung_vien_bo_lai`: con số này là câu
        # trả lời cho một câu hỏi chỉ chế độ `dang_doc` đặt ra.
        so_ung_vien_bo_lai=None,
        offset_ke_tiep=offset_ke_tiep,
        cursor_ke_tiep=cursor_ke_tiep,
    )
