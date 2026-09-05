"""Hai feed của trang chủ + header của sub — PLAN 5.9, mục 7.

`Mới` sắp theo `published_at`; `Đang diễn ra` sắp theo `last_entry_at` trên mạch đang mở.
Hai feed, hai khoá sort khác nhau, **cố ý không có feed "Hot" nào bump theo mốc mới**:
PLAN mục 4 loại cơ chế đó vì nó dạy tác giả băm "chốt 1/3" thành ba mốc để ăn ba lượt đẩy.

**`?sort=nhieu_diem` KHÔNG phải cái vừa bị loại** (plan con 1d §1). Nó sắp theo
`Mach.diem_bai_goc` — điểm của mốc 1, tức điểm của **bài gốc**, do người đọc bỏ phiếu.
Nối thêm mốc không đụng vào con số đó, nên động cơ "băm mốc để ăn lượt đẩy" không tồn tại
ở đây; đó chính là chỗ nó khác feed Hot bằng bump. Khoá thứ ba này áp cho CẢ hai feed:
mỗi feed đã có một tập mạch riêng (mọi mạch / mạch đang mở), `sort` chỉ đổi cách sắp.
"""

from typing import Literal, get_args

from django.db.models import Count, Q, QuerySet
from ninja import Router

from core.models.dien_dan import Mach, Sub, TrangThaiMach
from core.thoi_gian import KHOANG_TAT_CA, KhoangThoiGian, moc_khoang_vn

from api.loi import (
    CURSOR_KHONG_HOP_LE,
    SUB_KHONG_TON_TAI,
    LoiOut,
    khong_tim_thay,
    loi,
)
from api.phan_trang import (
    GIOI_HAN_MAC_DINH,
    CursorHong,
    cat_trang,
    giai_ma_cursor,
    giai_ma_cursor_so,
    kiem_gioi_han,
    loc_keyset,
    ma_hoa_cursor,
    ma_hoa_cursor_so,
)
from api.schemas import FeedOut, SubChiTietOut
from api.trinh_bay import du_lieu_the, mach_tom_tat_ra

router = Router()

TRA_LOI = {200: FeedOut, 400: LoiOut, 404: LoiOut}

#: `?sort=` của hai feed. **`Literal` là NGUỒN**, hai hằng dưới giải nén từ nó *(W9,
#: lượt vá 2)* — cùng lý lẽ với `core/thoi_gian.py::KhoangThoiGian`: chữ ký endpoint phải
#: mang kiểu này thì `openapi.json` mới ra `enum`, và frontend mới suy được union thay vì
#: gõ lại bản sao thứ hai của hợp đồng (PLAN 8.3).
#:
#: `tu_nhien` = khoá sort riêng của từng feed (`created_at` / `last_entry_at`);
#: `nhieu_diem` = `Mach.diem_bai_goc` giảm dần (plan con 1d §1).
SortFeed = Literal["tu_nhien", "nhieu_diem"]
SORT_FEED_HOP_LE: tuple[str, ...] = get_args(SortFeed)
SORT_TU_NHIEN, SORT_NHIEU_DIEM = SORT_FEED_HOP_LE

#: Khoá keyset của sort Top. Cặp `(điểm, id)` chứ không mình điểm — điểm trùng nhau là
#: chuyện thường (mọi mạch chưa ai vote đều `0`).
TRUONG_DIEM = "diem_bai_goc"


def _the_ra(trang) -> list:
    """Một trang mạch → danh sách thẻ. Mọi thứ cần DB đều nạp theo LÔ.

    Thẻ feed cần `moc_1_id` làm đích cho mũi tên vote (Phase 2) và `xem_truoc` để vẽ nội
    dung (2026-08-23). Hỏi lẻ từng thẻ là N+1 trên mọi feed và nó không đỏ ở đâu cả, chỉ
    chậm dần theo số thẻ — nên phép gom nằm ở đây, và `mach_tom_tat_ra` cố ý không tự
    truy vấn. Tổng cộng **ba** truy vấn cho cả trang, bất kể trang có 10 hay 50 thẻ.
    """
    theo_mach = du_lieu_the(trang)
    return [
        mach_tom_tat_ra(m, moc_1_id=moc_1_id, xem_truoc=xem_truoc)
        for m in trang
        for moc_1_id, xem_truoc in [theo_mach.get(m.pk, (None, None))]
    ]


def _mach_hien(sub: str | None) -> QuerySet:
    """Mạch được phép hiện ra API công khai, đã lọc `?sub=`.

    `hidden_at__isnull=True` là bộ lọc bảo vệ duy nhất của feed — mạch bị mod ẩn không
    được xuất hiện ở bất kỳ danh sách công khai nào (PLAN 5.10).

    Cùng bộ lọc ấy che luôn **bài hẹn giờ chưa tới hạn**, và đó là chủ đích chứ không phải
    trùng hợp may mắn: plan 2026-09-03 §1.1 lưu bài hẹn như một bài đang ẩn đúng để không
    phải sờ vào 68 chỗ lọc `hidden_at` rải khắp tầng đọc. Không thêm vế `published_at <=
    now()` ở đây — thêm là dựng nguồn sự thật thứ hai cho cùng một câu hỏi, và chỗ nào
    quên vế mới thì rò bài chưa đăng.
    """
    qs = Mach.objects.filter(hidden_at__isnull=True).select_related("sub", "author")
    if sub is not None:
        qs = qs.filter(sub__slug=sub)
    return qs


def _trang(qs: QuerySet, *, truong: str, cursor: str | None, limit: int):
    """Một trang keyset giảm dần theo `(truong, id)`. Trả `(FeedOut, None)` hoặc `(None, lỗi)`."""
    if cursor is not None:
        try:
            khi, id = giai_ma_cursor(cursor)
        except CursorHong as e:
            return None, loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")
        qs = loc_keyset(qs, truong=truong, khi=khi, id=id, giam_dan=True)

    hang = list(qs.order_by(f"-{truong}", "-pk")[: limit + 1])
    trang, con_nua = cat_trang(hang, limit)
    ke_tiep = (
        ma_hoa_cursor(getattr(trang[-1], truong), trang[-1].pk)
        if con_nua and trang
        else None
    )
    return FeedOut(items=_the_ra(trang), cursor_ke_tiep=ke_tiep), None


def _trang_diem(qs: QuerySet, *, cursor: str | None, limit: int):
    """Một trang keyset giảm dần theo `(diem_bai_goc, id)` — sort Top.

    Bản sao có chủ đích của `_trang`, không phải một tham số thêm vào nó: hai họ cursor
    mã hoá hai kiểu khoá khác nhau (`giai_ma_cursor` vs `giai_ma_cursor_so`), và gộp
    chúng lại bằng một cờ là tạo đúng cái nhánh mà "cursor sort này lọt sang sort kia"
    đi qua. Hai hàm ngắn, hai họ cursor, không nhánh nào chung.

    ⚠ **Nợ có tên — khoá keyset ở đây BIẾN ĐỔI, khác hẳn `_trang`** *(nói ra 2026-08-22,
    lượt vá 2; §0 của plan chốt GIỮ cơ chế)*. `diem_bai_goc` đổi mỗi lần có phiếu rơi vào
    mốc 1, nên bảo đảm "không trùng, không sót" của keyset **không** áp cho sort này:

    - **sót**: mạch chưa trả ở trang trước được vote LÊN vượt `(diem, id)` của cursor ⇒
      nó đứng trước chỗ cắt ⇒ biến mất khỏi mọi trang của lượt cuộn đó;
    - **trùng**: mạch đã trả bị vote XUỐNG dưới mốc cursor ⇒ nó rơi vào phần còn lại ⇒
      hiện lần thứ hai.

    Không chữa: mọi bảng xếp hạng theo điểm sống đều có tính chất này, `OFFSET` còn tệ
    hơn, và snapshot là một hệ thống khác. Hai ca trên được **ghim bằng test** ở
    `api/tests/test_keyset_khoa_bien_doi.py` — đó là test tài liệu hoá một đánh đổi, đổi
    cơ chế thì nó đỏ chứ không phải nó đang bảo vệ một tính chất mong muốn.
    """
    if cursor is not None:
        try:
            diem, id = giai_ma_cursor_so(cursor)
        except CursorHong as e:
            return None, loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")
        qs = loc_keyset(qs, truong=TRUONG_DIEM, khi=diem, id=id, giam_dan=True)

    hang = list(qs.order_by(f"-{TRUONG_DIEM}", "-pk")[: limit + 1])
    trang, con_nua = cat_trang(hang, limit)
    ke_tiep = (
        ma_hoa_cursor_so(trang[-1].diem_bai_goc, trang[-1].pk)
        if con_nua and trang
        else None
    )
    return FeedOut(items=_the_ra(trang), cursor_ke_tiep=ke_tiep), None


def _kiem_sub(sub: str | None):
    """Sub gõ sai phải là 404, không phải feed rỗng.

    Feed rỗng trông y hệt "sub này chưa có bài" — một chữ gõ nhầm trong `?sub=` sẽ thành
    "diễn đàn chết" trước mắt người dùng, và không có gì để lần ra. Đổi lại là MỘT truy
    vấn, và chỉ khi có `?sub=`.
    """
    if sub is None:
        return None
    if Sub.objects.filter(slug=sub).exists():
        return None
    return loi(404, SUB_KHONG_TON_TAI, f"Không có sub {sub!r}.")


def _loc_khoang(qs: QuerySet, khoang: str) -> QuerySet:
    """Cắt theo `Mach.published_at >= mốc đầu khoảng` (giờ VN — `core/thoi_gian.py`).

    Lọc theo ngày ĐĂNG chứ không theo `last_entry_at` là chốt của plan con 1d §1: "top
    tuần" nghĩa là *bài ra đời trong tuần*, không phải *bài được nối mốc trong tuần* —
    vế thứ hai là feed Hot bằng bump đội lốt, đúng thứ PLAN mục 4 loại.

    ⚠ **`published_at`, không phải `created_at`** *(hẹn giờ, 2026-09-03 §1.3)*. Một bài
    soạn từ 10 ngày trước rồi hẹn lên hôm nay phải nằm trong `khoang=ngay` — nó vừa xuất
    hiện trước mắt người đọc hôm nay. Lọc theo `created_at` thì nó lên feed "Mới" ở đỉnh
    (feed sắp theo `published_at`) mà biến mất ngay khi ai đó bấm "hôm nay": hai câu trả
    lời cãi nhau trên cùng một màn hình.

    **`khoang` áp cho MỌI sort, không riêng `nhieu_diem`** — câu trả lời cố ý cho câu hỏi
    "khoang kèm sort thời gian thì làm gì" (chỗ này giữ lại lý lẽ của `_kiem_sort_khoang`
    cũ, hàm đã bị W9 xoá khi chữ ký endpoint chuyển sang `Literal`). Hai lựa chọn còn lại
    đều tệ hơn: bỏ qua im lặng là `?khoang=ngay` biến mất khỏi kết quả mà URL vẫn nói nó
    có (đúng loài lỗi mà `api/machs.py` đã phải trả 400 để diệt), còn trả 400 thì cấm một
    tổ hợp đọc ra nghĩa hoàn toàn bình thường ("bài mới trong tuần").

    Vì thế hàm này nằm ngoài mọi nhánh `sort`: nó chạy trước `_phuc_vu`, cho cả hai sort.
    """
    moc = moc_khoang_vn(khoang)
    return qs if moc is None else qs.filter(published_at__gte=moc)


def _phuc_vu(qs: QuerySet, *, truong: str, sort: str, cursor: str | None, limit: int):
    if sort == SORT_NHIEU_DIEM:
        return _trang_diem(qs, cursor=cursor, limit=limit)
    return _trang(qs, truong=truong, cursor=cursor, limit=limit)


#: Đoạn tài liệu chung của hai feed. Viết một chỗ vì nó đi thẳng ra `openapi.json` rồi ra
#: JSDoc của TS client — hai bản chép tay sẽ trôi khỏi nhau ngay lần sửa đầu.
#:
#: Đi vào `description=` của decorator chứ không vào docstring: `ninja.Operation` chốt
#: `description` NGAY lúc decorator chạy (`operation.py`, `self.description = description
#: or self.signature.docstring`), nên nối thêm vào `__doc__` sau đó là nối vào một chỗ
#: hợp đồng đã đi qua — docstring đẹp lên mà `openapi.json` không đổi một chữ.
_TAI_LIEU_CHUNG = """
    `?sub=<slug>` lọc theo chuyên mục; sub không tồn tại trả 404 `sub_khong_ton_tai`.
    `?cursor=` là cursor keyset lấy từ `cursor_ke_tiep` của trang trước; `null` là hết.
    `?limit=` tối đa 50.

    `?sort=tu_nhien` (mặc định) giữ khoá sort riêng của feed này. `?sort=nhieu_diem` sắp
    theo điểm bài gốc giảm dần, cursor keyset trên `(diem, id)`. **Cursor của sort này
    KHÔNG dùng được cho sort kia** — đem nhầm là 400 `cursor_khong_hop_le`.

    `?khoang=ngay|tuan|thang|tat_ca` (mặc định `tat_ca`) lọc theo `published_at` (ngày
    ĐĂNG — bài hẹn giờ đăng hôm nay thì thuộc hôm nay, dù soạn từ tuần trước), ranh giới
    là nửa đêm **giờ VN**; `tuan` = 7 ngày lịch gần nhất kể cả hôm nay, `thang` = 30 ngày.
    Khoảng áp cho **mọi** sort, không riêng `nhieu_diem`. Giá trị lạ trả 400
    `tham_so_khong_hop_le` — không bao giờ lặng lẽ quy về `tat_ca`.

    Mạch bị mod ẩn không xuất hiện.
"""

_MO_TA_FEED_MOI = """Feed **Mới**: mọi bài, mới đăng trước (`published_at` giảm dần).

    Mạch đã đóng sổ **vẫn xuất hiện** — feed này sắp theo lúc bài LÊN SÓNG, không theo
    trạng thái sổ.

    `published_at` chứ không `created_at`: bài hẹn giờ được soạn trước rồi phát hành sau,
    và thứ tự người đọc thấy phải là thứ tự bài xuất hiện. Hai cột đều có trong
    `MachTomTatOut` — `created_at` là ngày viết, `published_at` là ngày đăng.
""" + _TAI_LIEU_CHUNG

_MO_TA_FEED_DDR = """Feed **Đang diễn ra**: mạch còn mở, mốc mới nhất trước
    (`last_entry_at` giảm dần).

    Feed đặc sản của gikky, **không phải** Hot: mốc mới không "bump" bài, nó chỉ cập nhật
    khoá sort của riêng feed này.

    `last_entry_at` đo **cấu trúc** — mọi mốc đều tính, kể cả mốc bị mod ẩn. Vì thế một
    mạch có thể đứng đầu feed này mà mở ra là **mặt CẶN** (`face` tính theo
    `last_activity_at`, vốn chỉ đo nội dung đọc được). Đó là hành vi đúng theo luật đếm
    hiện hành, đã ghi ở PLAN mục 6 "hệ quả cố ý 2" — đừng chữa bằng cách đổi khoá sort.
""" + _TAI_LIEU_CHUNG


@router.get(
    "/feeds/moi",
    response=TRA_LOI,
    operation_id="liet_ke_feed_moi",
    description=_MO_TA_FEED_MOI,
    tags=["feed"],
)
def feed_moi(
    request,
    sub: str | None = None,
    sort: SortFeed = SORT_TU_NHIEN,
    khoang: KhoangThoiGian = KHOANG_TAT_CA,
    cursor: str | None = None,
    limit: int = GIOI_HAN_MAC_DINH,
):
    """Xem `_MO_TA_FEED_MOI` — mô tả công khai nằm ở `description=` của decorator."""
    if (l := kiem_gioi_han(limit)) is not None:
        return l
    if (l := _kiem_sub(sub)) is not None:
        return l
    ket_qua, l = _phuc_vu(
        # `published_at`, không phải `created_at` — xem `_MO_TA_FEED_MOI`. Khoá sort và
        # khoá cursor keyset là CÙNG một trường (`_trang` dùng `truong` cho cả hai), nên
        # đổi ở đây là đổi cả hai cùng lúc; hai nửa lệch nhau là feed trùng/sót hàng.
        _loc_khoang(_mach_hien(sub), khoang),
        truong="published_at",
        sort=sort,
        cursor=cursor,
        limit=limit,
    )
    return l if l is not None else ket_qua


@router.get(
    "/feeds/dang-dien-ra",
    response=TRA_LOI,
    operation_id="liet_ke_feed_dang_dien_ra",
    description=_MO_TA_FEED_DDR,
    tags=["feed"],
)
def feed_dang_dien_ra(
    request,
    sub: str | None = None,
    sort: SortFeed = SORT_TU_NHIEN,
    khoang: KhoangThoiGian = KHOANG_TAT_CA,
    cursor: str | None = None,
    limit: int = GIOI_HAN_MAC_DINH,
):
    """Xem `_MO_TA_FEED_DDR` — mô tả công khai nằm ở `description=` của decorator."""
    if (l := kiem_gioi_han(limit)) is not None:
        return l
    if (l := _kiem_sub(sub)) is not None:
        return l
    ket_qua, l = _phuc_vu(
        _loc_khoang(_mach_hien(sub).filter(status=TrangThaiMach.MO), khoang),
        truong="last_entry_at",
        sort=sort,
        cursor=cursor,
        limit=limit,
    )
    return l if l is not None else ket_qua


def subs_kem_so_mach() -> QuerySet:
    """CÔNG KHAI (bỏ gạch dưới 2026-08-24) vì `api/theo_sub.py` dùng lại nó.

    Đây là **một** định nghĩa của "mạch hiện được" cho con số `so_mach`. Chép công thức
    `Count(..., filter=hidden_at__isnull=True)` sang module kia là dựng nguồn sự thật thứ
    hai: ngày luật che đổi (thêm `deleted_at` chẳng hạn) sẽ có đúng một chỗ được sửa, và
    hai màn hình cùng nói "12 mạch" / "9 mạch" mà không chỗ nào đỏ.
    """
    """`Sub` kèm `so_mach_hien` — **cùng bộ lọc với `_mach_hien`**, đếm bằng annotate.

    Một định nghĩa cho cả hai endpoint sub: `xem_sub` và `liet_ke_sub` nói cùng một con
    số về cùng một chuyên mục, còn hai bản chép tay thì sẽ lệch nhau đúng lúc luật che
    của feed đổi — và lệch ở đây nghĩa là header trang sub và sidebar cãi nhau ngay trên
    cùng một màn hình.
    """
    return Sub.objects.annotate(
        so_mach_hien=Count("machs", filter=Q(machs__hidden_at__isnull=True))
    )


def _sub_ra(sub: Sub) -> SubChiTietOut:
    """Cần `so_mach_hien` đã annotate — xem `subs_kem_so_mach`."""
    return SubChiTietOut(
        slug=sub.slug,
        ten=sub.ten,
        mo_ta=sub.mo_ta,
        so_mach=sub.so_mach_hien,
        created_at=sub.created_at,
    )


@router.get(
    "/subs",
    response={200: list[SubChiTietOut]},
    operation_id="liet_ke_sub",
    tags=["sub"],
)
def liet_ke_sub(request):
    """MỌI chuyên mục, sắp theo `slug` — PLAN mục 7 *(thêm ở lượt vá Phase 1d)*.

    **Frontend CẤM ghi cứng danh sách slug** (PLAN mục 7 nói thẳng). Trước endpoint này,
    `apps/web` giữ một hằng `SUB_KHOI_DIEM = ["chung-khoan", "crypto"]` nuôi cả sidebar
    lẫn `sitemap.ts`: mở sub thứ ba qua admin thì **cả hai chỗ cùng bỏ sót nó, im lặng**,
    và chiều ngược cũng im — đổi slug trong admin thì sidebar âm thầm bỏ mục đó (404 →
    lọc khỏi danh sách) trong khi `sitemap.xml` vẫn khai `/s/<slug cũ>` là URL sống.

    **Không phân trang, và đó là một chốt chứ không phải một thiếu sót.** v1 tạo sub bằng
    tay qua admin (PLAN mục 1), nên tập này là hàng chục chứ không phải hàng nghìn; thêm
    cursor bây giờ là bắt hai chỗ gọi (sidebar, sitemap) tự lật trang cho một danh sách
    chưa bao giờ dài. Ngày nó dài ra thì đổi ở đây, kèm cursor keyset trên `slug`.

    Sắp theo `slug` chứ không theo `so_mach`: sidebar là một **bản đồ**, và một bản đồ
    tự sắp lại theo độ đông mỗi lần có bài mới thì không ai nhớ được chỗ nào ở đâu.
    """
    return [_sub_ra(s) for s in subs_kem_so_mach().order_by("slug")]


@router.get(
    "/subs/{slug}",
    response={200: SubChiTietOut, 404: LoiOut},
    operation_id="xem_sub",
    tags=["sub"],
)
def xem_sub(request, slug: str):
    """Header của trang chuyên mục `/s/<slug>` — tên, mô tả, số mạch, ngày lập.

    Endpoint **đọc, không per-user**, tách khỏi feed vì nó đổi theo nhịp hoàn toàn khác:
    tên và mô tả sub gần như bất động, còn feed đổi mỗi lần có bài mới. Nhét header vào
    `FeedOut` là bắt mọi trang phân trang phải chở lại cùng một khối chữ.

    Slug không tồn tại trả 404 `khong_tim_thay`.
    """
    sub = subs_kem_so_mach().filter(slug=slug).first()
    if sub is None:
        return khong_tim_thay(f"sub {slug!r}")
    return _sub_ra(sub)
