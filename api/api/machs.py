"""Trang mạch và khán đài — PLAN mục 7, 5.3, 5.5, 9.2.

Phase 2 thêm bốn đường GHI vào cùng file, đúng theo lối chia của module này (theo **tiền
tố URL**, không theo model): `POST /machs`, `POST /machs/{id}/mocs`,
`POST /machs/{id}/comments`, `POST /machs/{id}/close` · `/reopen`.
Luật quyền của từng cái nằm ngay trong docstring của nó — đó là chỗ người sửa sau đọc.
"""

from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from ninja import Router, Status

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
    trang_thai_noi_dung,
)
from core.ghi import (
    NGAY_MO_LAI,
    SO_MOC_TOI_DA_MOI_NGAY,
    dem_moc_trong_ngay_vn,
    dong_so,
    mo_lai,
    tao_binh_luan,
    tao_mach,
    them_moc,
    tu_upvote,
)
from core.han_muc import (
    dem_binh_luan_trong_gio,
    dem_mach_trong_ngay_vn,
    la_tai_khoan_moi,
    luc_binh_luan_duoc_lai,
    tran_binh_luan_moi_gio,
    tran_mach_moi_ngay,
)
from core.mat import tinh_mat_theo_thoi_gian
from core.models.dien_dan import Mach, Sub
from core.models.moc import Moc, MocAnh
from core.models.tuong_tac import Trich
from core.revalidate import lam_moi_mach
from core.thoi_gian import nua_dem_vn_ke_tiep
from core.thong_bao import bao_moc_moi, bao_reply

from api.ghi_chung import doi_con_song, kiem_occurred_at, nap_mach
from api.loi import (
    CURSOR_KHONG_HOP_LE,
    KHONG_TIM_THAY,
    SORT_KHONG_HOP_LE,
    SUB_KHONG_TON_TAI,
    THAM_SO_KHONG_HOP_LE,
    LoiOut,
    LoiThoiGianOut,
    khong_tim_thay,
    loi,
    loi_thoi_gian,
)
from api.phan_trang import (
    GIOI_HAN_TOI_DA,
    CursorHong,
    cat_trang,
    giai_ma_cursor,
    kiem_gioi_han,
    ma_hoa_cursor,
)
from api.quyen import (
    DU_LIEU_KHONG_HOP_LE,
    HET_HAN_MO_LAI,
    MACH_DA_DONG,
    MACH_DANG_MO,
    QUA_HAN_MUC_BINH_LUAN,
    QUA_HAN_MUC_MACH,
    QUA_HAN_MUC_MOC,
    LoiGhi,
    dang_nhap,
    doi_chu_so_huu,
    doi_mach_tuong_tac_duoc,
)
from api.schemas import BinhLuanOut, KhanDaiOut, MachChiTietOut, MocOut
from api.schemas_ghi import BinhLuanMoiIn, DongSoIn, MachMoiIn, MocMoiIn
from api.trinh_bay import han_mo_lai, mach_tom_tat_ra, moc_ra, nut_ra, spine_ra

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
    return mach_chi_tiet_ra(mach)


def mach_chi_tiet_ra(mach: Mach) -> MachChiTietOut:
    """Dựng `MachChiTietOut` từ một hàng `Mach` — dùng chung với đường GHI.

    Tách ra ở Phase 2 vì `POST /machs`, `/close` và `/reopen` phải trả về **cùng một hình
    dạng** với `GET /machs/{id}`: hai bản dựng song song là hai bản sẽ trôi khỏi nhau, và
    cái trôi sẽ là cái ở đường ghi (nó chạy ít hơn hẳn). Hàm không kiểm quyền và không
    kiểm `hidden_at` — người gọi làm việc đó trước.
    """
    # `select_related("author")`: `MocOut.author` có từ 2026-08-23 (nợ `MOC-THIEU-AUTHOR`).
    # Không có nó thì mỗi thẻ mốc là một truy vấn `User` — N+1 trên đúng endpoint nặng nhất.
    mocs = list(Moc.objects.filter(mach=mach).select_related("author").order_by("seq"))
    dem = dem_binh_luan_theo_moc(mach)
    # Gallery của Phase 5. Gom MỘT truy vấn cho cả mạch rồi phát theo `moc_id`, cùng lối
    # `trich_theo_moc` ngay dưới — `m.anhs.all()` trong vòng lặp là N+1 trên đúng
    # endpoint nặng nhất của sản phẩm (9 mốc = 9 truy vấn thừa mỗi lượt tải trang).
    # `SO_QUERY["xem_mach"]` ở `tests/test_api_so_query.py` ghim con số này.
    anh_theo_moc: dict[int, list[MocAnh]] = {}
    for a in MocAnh.objects.filter(
        moc__mach=mach, status=MocAnh.TrangThai.XAC_NHAN
    ).order_by("position", "id"):
        anh_theo_moc.setdefault(a.moc_id, []).append(a)
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
    # `exclude={"diem", "moc_1_id"}` là CỐ Ý (plan con 1d §2.1, mở rộng ở Phase 2). Cả hai
    # là thông tin về **mốc 1**, và trang mạch đã trả nguyên mốc 1 trong `mocs` — chép
    # thêm một bản ở tầng mạch là dựng hai chỗ nói cùng một con số, và cái thứ hai sẽ là
    # cái trôi. Thẻ feed cần chúng vì nó KHÔNG có `mocs`.
    tom_tat = mach_tom_tat_ra(mach)
    return MachChiTietOut(
        **tom_tat.model_dump(exclude={"diem", "moc_1_id"}),
        closed_at=mach.closed_at,
        mo_lai_den=han_mo_lai(mach),
        tran_moc_moi_ngay=SO_MOC_TOI_DA_MOI_NGAY,
        locked=mach.locked_at is not None,
        face=tinh_mat_theo_thoi_gian(
            status=mach.status,
            locked_at=mach.locked_at,
            last_activity_at=mach.last_activity_at,
        ),
        mocs=[
            moc_ra(
                m,
                so_binh_luan=dem.get(m.seq, 0),
                trich=trich_theo_moc.get(m.pk),
                anhs=anh_theo_moc.get(m.pk, []),
            )
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


# =============================================================================
# ĐƯỜNG GHI — Phase 2. Mỗi endpoint nêu LUẬT QUYỀN của nó ngay trong docstring.
# =============================================================================


class _QuaHanMucMoc(Exception):
    """Thoát khỏi `atomic()` khi chạm trần 3 mốc/ngày — **không bao giờ ra khỏi module**.

    Cần một ngoại lệ chứ không phải một `return` vì phép kiểm nay nằm TRONG transaction
    (L11): `return` từ giữa khối `atomic()` là commit, còn ở đây phải nhả khoá hàng `Mach`
    và bỏ mọi thứ đã ghi. Cũng không dùng được `LoiGhi` — mã 429 này mang thêm
    `thu_lai_tu`, thứ exception handler không dựng được (xem `api/loi.py`).
    """


def _figures_ra_dict(figures) -> list[dict] | None:
    """Schema `FigureIn` → JSON thô cho cột `figures`. `None` giữ nguyên `None`.

    Có hàm riêng vì `figures` là `JSONField`: nhét thẳng object pydantic vào đó thì
    `psycopg` serialize ra một hình dạng khác (hoặc nổ), và lỗi chỉ lộ khi ai đó đọc lại.
    """
    if figures is None:
        return None
    return [{"label": f.label, "value": f.value} for f in figures]


@router.post(
    "/machs",
    response={
        201: MachChiTietOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
        429: LoiThoiGianOut,
    },
    operation_id="tao_mach",
    tags=["mach"],
    auth=dang_nhap,
)
def tao_mach_api(request, du_lieu: MachMoiIn):
    """Đăng bài = tạo `Mach` + `Moc(seq=1)` trong MỘT giao dịch (PLAN 5.1).

    **Quyền: bất kỳ ai đã đăng nhập và không bị khoá.** Không có "chủ" để đối chiếu —
    người gọi *trở thành* chủ. Tài khoản bị ban bị chặn ở lớp auth (`api/quyen.py`).

    Không có nút "tạo mạch" riêng (PLAN nguyên tắc 1): mọi post sinh ra là post thường,
    UI mạch tự bật từ mốc 2. Vì thế endpoint này và `POST /machs/{id}/mocs` nhận **cùng
    một bộ trường nội dung** — `MachMoiIn` kế thừa thẳng `MocMoiIn`.

    Tác giả nhận **+1 phiếu của chính mình** ngay lúc đăng (PLAN 5.7) — để `0` trên cột
    vote có nghĩa là "đã có người vote xuống", không phải "chưa ai đụng tới".

    **Hạn mức: 10 mạch / người / ngày lịch VN** (PLAN mục 10 Phase 6, số đổi được ở
    `settings.HAN_MUC_MACH_MOI_USER_NGAY`) ⇒ 429 `qua_han_muc_mach` kèm `thu_lai_tu` =
    nửa đêm giờ VN kế tiếp. Ranh giới là nửa đêm VN, không phải 24 giờ trượt — cùng luật
    với hạn mức mốc, xem `core/han_muc.py`.
    """
    kiem_occurred_at(du_lieu.occurred_at)
    sub = Sub.objects.filter(slug=du_lieu.sub).first()
    if sub is None:
        raise LoiGhi(404, SUB_KHONG_TON_TAI, f"Không có chuyên mục {du_lieu.sub!r}.")
    tran_mach = tran_mach_moi_ngay()
    if dem_mach_trong_ngay_vn(request.user) >= tran_mach:
        # Phép đếm này **không** dưới khoá, và đó là quyết định có ghi lý do —
        # `core/han_muc.py`, khối "Hai chỗ KHÔNG khoá". Tóm tắt: khoá hàng `User` rồi mới
        # chạm `Mach` là dựng cạnh ngược của `Mach → User` mà `core/thong_bao.py` đã có.
        return loi_thoi_gian(
            429,
            QUA_HAN_MUC_MACH,
            f"Hôm nay bạn đã đăng đủ {tran_mach} bài — mai viết tiếp nhé.",
            thu_lai_tu=nua_dem_vn_ke_tiep(),
        )

    with transaction.atomic():
        mach, moc = tao_mach(
            sub=sub,
            author=request.user,
            title=du_lieu.title.strip(),
            body=du_lieu.body,
            occurred_at=du_lieu.occurred_at,
            loai=du_lieu.loai,
            question_for_crowd=du_lieu.question_for_crowd,
            figures=_figures_ra_dict(du_lieu.figures),
        )
        tu_upvote(target=moc)
    mach.refresh_from_db()
    return Status(201, mach_chi_tiet_ra(mach))


@router.post(
    "/machs/{int:mach_id}/mocs",
    response={
        201: MocOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
        409: LoiOut,
        # 429 là mã DUY NHẤT của cả API mang thêm `thu_lai_tu` — xem `LoiThoiGianOut`.
        429: LoiThoiGianOut,
    },
    operation_id="noi_moc",
    tags=["moc"],
    auth=dang_nhap,
)
def noi_moc(request, mach_id: int, du_lieu: MocMoiIn):
    """Nối một mốc vào mạch — PLAN 5.1.

    **Quyền: CHỈ tác giả mạch.** Người khác nhận 403 `khong_phai_chu`. Mạch là nhật ký
    của một người; nếu ai cũng nối được thì "dấu thời gian máy chủ bất biến" chẳng chứng
    minh được ai đã ghi cái gì.

    Ba điều kiện nữa, mỗi cái một mã riêng để UI nói đúng chuyện:
    - mạch bị mod **khoá** ⇒ 403 `mach_bi_khoa` (đọc được, cấm tương tác — PLAN 5.10);
    - mạch **đã đóng sổ** ⇒ 409 `mach_da_dong` (đóng sổ vẫn bình luận được, chỉ không nối
      mốc — PLAN 5.1);
    - quá **3 mốc trong ngày lịch VN** ⇒ 429 `qua_han_muc_moc`. Hạn mức đếm theo
      `created_at` (dấu server) và tính **mọi** mốc kể cả bia mộ — xoá rồi viết lại là
      cách lách ngắn nhất. Ranh giới là nửa đêm giờ VN, không phải 24 giờ trượt.

    `occurred_at` nhập lùi thoải mái, cấm tương lai (PLAN 5.2). Tác giả nhận +1 phiếu của
    chính mình (PLAN 5.7).
    """
    kiem_occurred_at(du_lieu.occurred_at)
    mach = nap_mach(mach_id)
    doi_chu_so_huu(request.user, mach.author_id, "mạch")
    doi_mach_tuong_tac_duoc(mach)
    if mach.status == Mach.TrangThai.DONG:
        raise LoiGhi(
            409,
            MACH_DA_DONG,
            "Mạch đã đóng sổ — mở lại mới nối mốc được. Bình luận thì vẫn viết được.",
        )
    try:
        with transaction.atomic():
            # ⚠ **Phép đếm phải nằm TRONG khoá** (L11, vá V1). Bản trước đếm ở ngoài, rồi
            # `them_moc` mới `select_for_update` hàng `Mach` — nên hai request song song
            # (một cú double-click là đủ) cùng đọc `2 < 3` và cùng đi tiếp: **4 mốc trong
            # một ngày, 201 cả hai lần, không một dòng log nào**. Ở đây hàng `Mach` được
            # khoá TRƯỚC khi đếm, và `them_moc` xin lại đúng hàng ấy trong cùng
            # transaction (khoá tái nhập, không chờ ai).
            Mach.objects.select_for_update().get(pk=mach.pk)
            if dem_moc_trong_ngay_vn(mach) >= SO_MOC_TOI_DA_MOI_NGAY:
                raise _QuaHanMucMoc
            moc = them_moc(
                mach=mach,
                author=request.user,
                body=du_lieu.body,
                occurred_at=du_lieu.occurred_at,
                loai=du_lieu.loai,
                question_for_crowd=du_lieu.question_for_crowd,
                figures=_figures_ra_dict(du_lieu.figures),
            )
            tu_upvote(target=moc)
            # Thông báo cho follower, TRONG cùng transaction với lời ghi (PLAN 5.8).
            # Không đẩy ra `transaction.on_commit`: rollback ở đây phải cuốn theo cả chuông,
            # còn commit thành công mà chuông chết sau đó là mốc vào DB không ai được báo.
            # Gộp 1 thông báo / mạch / ngày lịch VN — xem `core/thong_bao.py`.
            bao_moc_moi(moc)
            # On-demand revalidate (PLAN 8.4 điểm 3). Gọi TRONG transaction là đúng: hàm bọc
            # `transaction.on_commit`, nên lời gọi HTTP chỉ đi sau khi mốc đã commit — gọi
            # sớm hơn thì Next fetch về đọc phải dữ liệu cũ rồi cache đúng bản cũ đó.
            lam_moi_mach(mach)
    except _QuaHanMucMoc:
        # `return` chứ không `raise LoiGhi`: mã này mang thêm `thu_lai_tu`, mà exception
        # handler chỉ dựng được `LoiOut` (xem `api/loi.py::LoiThoiGianOut`). Câu dưới nói
        # "mai", trường kia nói mấy giờ — thiếu nó thì frontend phải dựng lại luật "nửa
        # đêm giờ VN" ở phía client, đúng nợ `API-THIEU-MOC-THOI-GIAN` đã trả.
        #
        # Và vì nó phải `return`, phép kiểm nằm trong `atomic()` cần một ngoại lệ riêng để
        # thoát ra: một `return` từ giữa khối `atomic()` **commit** transaction thay vì
        # rollback nó, tức chấp nhận mọi thứ vừa ghi trước đó.
        return loi_thoi_gian(
            429,
            QUA_HAN_MUC_MOC,
            f"Hôm nay mạch này đã đủ {SO_MOC_TOI_DA_MOI_NGAY} mốc — mai nối tiếp nhé.",
            thu_lai_tu=nua_dem_vn_ke_tiep(),
        )
    moc.refresh_from_db()
    # `anhs=[]`: mốc vừa sinh ra chưa có ảnh nào — ảnh được gắn ở lượt `POST
    # /mocs/{id}/anh` sau đó (upload một nhịp, nhưng vẫn là request riêng vì multipart
    # và JSON không đi chung một thân).
    return Status(201, moc_ra(moc, so_binh_luan=0, trich=None, anhs=[]))


@router.post(
    "/machs/{int:mach_id}/comments",
    response={
        201: BinhLuanOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
        409: LoiOut,
        429: LoiThoiGianOut,
    },
    operation_id="viet_binh_luan",
    tags=["binh-luan"],
    auth=dang_nhap,
)
def viet_binh_luan(request, mach_id: int, du_lieu: BinhLuanMoiIn):
    """Viết bình luận vào khán đài hoặc ngăn kéo — PLAN 5.4, nguyên tắc 4 và 6.

    **Quyền: bất kỳ ai đã đăng nhập.** Không phải chỉ tác giả — khán đài là chỗ của đám
    đông. Chặn duy nhất là mạch bị mod **khoá** (403 `mach_bi_khoa`).
    **Mạch đã đóng sổ VẪN bình luận được** (PLAN 5.1) — đó là khác biệt cố ý so với
    `POST /machs/{id}/mocs`, đừng "dọn dẹp" hai đường này thành một phép kiểm.

    `anchor_moc_seq` **chỉ đặt được trên bình luận gốc**; gửi kèm `parent_id` là 400. Neo
    trỏ vào một `seq` không tồn tại trong mạch cũng là 400 — chip `‹mốc 12›` trên một mạch
    9 mốc mở ra một ngăn kéo không có thật.

    `parent_id` phải thuộc **cùng mạch**: reply xuyên mạch sẽ dựng một nhánh mà cả hai
    trang đều không hiển thị đúng.

    Người viết nhận +1 phiếu của chính mình (PLAN 5.7).

    **Cha đã bị gỡ ⇒ 409 `noi_dung_da_go`** (L17, vá V1). Trước lượt vá, đây là cửa ghi
    DUY NHẤT không hỏi `doi_con_song`, và cái thiếu ấy có hai hậu quả — cái thứ hai mới là
    cái nặng: (1) người ta trả lời được vào một bình luận mod **vừa ẩn**; (2) reply mới làm
    bình luận bị ẩn ấy có `con_song = True`, nên `core.ghi.xoa_binh_luan` chuyển nó sang
    nhánh bia mộ — **tác giả của nó vĩnh viễn không xoá thật được nữa**, và không ai giải
    thích được vì sao.

    **Hạn mức: tài khoản dưới 3 ngày tuổi viết tối đa 5 bình luận/giờ** (PLAN 5.10, số đổi
    được ở `settings.HAN_MUC_BINH_LUAN_MOI_GIO_TAI_KHOAN_MOI`) ⇒ 429
    `qua_han_muc_binh_luan` kèm `thu_lai_tu`. Cửa sổ **trượt theo giờ**, không theo ngày
    lịch: PLAN viết "5 bình luận/giờ", và "giờ" không có ranh giới lịch nào để bám.

    ⚠ PLAN gọi nó là *"shadow-limit"*. Cài ở đây là một lời **từ chối nói ra**, không phải
    một lượt ghi âm thầm bị giấu: gikky nhận nội dung rồi không hiện nó là dựng một cái bẫy
    im lặng cho cả người viết thật lẫn người đọc, và nó mâu thuẫn với nguyên tắc "lý do
    phải ĐÚNG" mà repo áp cho mọi nút bị khoá. Lệch với chữ của PLAN, ghi ra để thấy.
    """
    mach = nap_mach(mach_id)
    doi_mach_tuong_tac_duoc(mach)

    if la_tai_khoan_moi(request.user):
        tran_bl = tran_binh_luan_moi_gio()
        if dem_binh_luan_trong_gio(request.user) >= tran_bl:
            # Đếm ngoài khoá, cùng lý do với hạn mức mạch/ngày — `core/han_muc.py`.
            return loi_thoi_gian(
                429,
                QUA_HAN_MUC_BINH_LUAN,
                f"Tài khoản mới viết tối đa {tran_bl} bình luận mỗi giờ. Ít hôm nữa hạn "
                "này tự bỏ.",
                thu_lai_tu=luc_binh_luan_duoc_lai(request.user),
            )

    parent = None
    if du_lieu.parent_id is not None:
        from core.models.binh_luan import Comment

        parent = Comment.objects.filter(pk=du_lieu.parent_id, mach=mach).first()
        if parent is None:
            raise LoiGhi(
                404,
                KHONG_TIM_THAY,
                f"Không tìm thấy bình luận cha {du_lieu.parent_id} trong mạch này.",
            )
        doi_con_song(parent, "Bình luận")
        if du_lieu.anchor_moc_seq is not None:
            raise LoiGhi(
                400,
                DU_LIEU_KHONG_HOP_LE,
                "anchor_moc_seq chỉ đặt được trên bình luận gốc; reply kế thừa neo của "
                "gốc (PLAN nguyên tắc 6).",
            )
    elif du_lieu.anchor_moc_seq is not None:
        if not Moc.objects.filter(mach=mach, seq=du_lieu.anchor_moc_seq).exists():
            raise LoiGhi(
                400,
                DU_LIEU_KHONG_HOP_LE,
                f"Mạch này không có mốc {du_lieu.anchor_moc_seq}.",
            )

    with transaction.atomic():
        c = tao_binh_luan(
            mach=mach,
            author=request.user,
            body=du_lieu.body,
            parent=parent,
            anchor_moc_seq=du_lieu.anchor_moc_seq,
        )
        tu_upvote(target=c)
        # Báo cho tác giả bình luận CHA, trong cùng transaction (PLAN 5.8). Hàm tự bỏ qua
        # ba ca: không có cha · tự trả lời mình · cha đã bị gỡ.
        bao_reply(c)
    c.refresh_from_db()
    nut = Nut(
        binh_luan=c,
        do_sau=c.do_sau,
        trang_thai=trang_thai_noi_dung(c),
        con=[],
    )
    return Status(201, nut_ra(nut, chu_mach_id=mach.author_id))


@router.post(
    "/machs/{int:mach_id}/close",
    response={200: MachChiTietOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="dong_so_mach",
    tags=["mach"],
    auth=dang_nhap,
)
def dong_so_mach(request, mach_id: int, du_lieu: DongSoIn):
    """Đóng sổ — PLAN 5.1. **Quyền: CHỈ tác giả mạch** (403 cho người khác).

    `ket_qua` là một dòng tự do ≤40 ký tự ("+18.2% · 163 ngày"), hiện ở banner mặt CẶN và
    OG card. **Thuần hiển thị** — server không validate ngữ nghĩa, cùng triết lý với
    `figures`. Không nhập ⇒ `null`, banner ẩn phần đó.

    Mạch đã đóng rồi thì 409 `mach_da_dong` chứ không phải "đóng lại lần nữa": đóng sổ
    lần hai sẽ ghi đè `closed_at`, và cái đó **dời hạn 7 ngày mở lại** — tức một cách vô
    hạn hoá cái hạn đó bằng cách bấm hai lần.
    """
    mach = nap_mach(mach_id)
    doi_chu_so_huu(request.user, mach.author_id, "mạch")
    doi_mach_tuong_tac_duoc(mach)
    if mach.status == Mach.TrangThai.DONG:
        raise LoiGhi(409, MACH_DA_DONG, "Mạch này đã đóng sổ rồi.")
    mach = dong_so(mach=mach, ket_qua=du_lieu.ket_qua)
    # Đóng sổ lật mặt BÃO → CẶN và đổi banner — sự kiện CÓ signal, PLAN 8.4 điểm 2.
    lam_moi_mach(mach)
    return mach_chi_tiet_ra(nap_mach(mach.pk))


@router.post(
    "/machs/{int:mach_id}/reopen",
    response={200: MachChiTietOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="mo_lai_mach",
    tags=["mach"],
    auth=dang_nhap,
)
def mo_lai_mach(request, mach_id: int):
    """Mở lại mạch đã đóng sổ — **trong 7 ngày**, sau đó nút biến mất (PLAN 5.1).

    **Quyền: CHỈ tác giả mạch.** Quá hạn ⇒ 409 `het_han_mo_lai`; mạch đang mở ⇒ 409
    `mach_dang_mo`.

    Hạn tính từ `closed_at`, và nó là hạn THẬT chứ không phải gợi ý UI: một cuốn sổ mở
    lại được vô thời hạn thì "đã đóng sổ" không còn nghĩa gì, mà đó là nhãn cả mặt CẶN
    lẫn OG card đang dựa vào.

    `ket_qua` **bị xoá theo** — xem `core/ghi.py::mo_lai`.
    """
    mach = nap_mach(mach_id)
    doi_chu_so_huu(request.user, mach.author_id, "mạch")
    doi_mach_tuong_tac_duoc(mach)
    if mach.status != Mach.TrangThai.DONG:
        raise LoiGhi(409, MACH_DANG_MO, "Mạch này đang mở, không có gì để mở lại.")
    if mach.closed_at is not None and timezone.now() - mach.closed_at > timedelta(
        days=NGAY_MO_LAI
    ):
        raise LoiGhi(
            409,
            HET_HAN_MO_LAI,
            f"Quá {NGAY_MO_LAI} ngày kể từ khi đóng sổ — mạch này không mở lại được nữa.",
        )
    mach = mo_lai(mach=mach)
    lam_moi_mach(mach)
    return mach_chi_tiet_ra(nap_mach(mach.pk))
