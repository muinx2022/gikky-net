"""Hai feed của trang chủ — PLAN 5.9, mục 7.

`Mới` sắp theo `created_at`; `Đang diễn ra` sắp theo `last_entry_at` trên mạch đang mở.
Hai feed, hai khoá sort khác nhau, **cố ý không có feed "Hot" nào bump theo mốc mới**:
PLAN mục 4 loại cơ chế đó vì nó dạy tác giả băm "chốt 1/3" thành ba mốc để ăn ba lượt đẩy.
"""

from django.db.models import QuerySet
from ninja import Router

from core.models.dien_dan import Mach, Sub, TrangThaiMach

from api.loi import CURSOR_KHONG_HOP_LE, SUB_KHONG_TON_TAI, LoiOut, loi
from api.phan_trang import (
    GIOI_HAN_MAC_DINH,
    CursorHong,
    cat_trang,
    giai_ma_cursor,
    kiem_gioi_han,
    loc_keyset,
    ma_hoa_cursor,
)
from api.schemas import FeedOut
from api.trinh_bay import mach_tom_tat_ra

router = Router()

TRA_LOI = {200: FeedOut, 400: LoiOut, 404: LoiOut}


def _mach_hien(sub: str | None) -> QuerySet:
    """Mạch được phép hiện ra API công khai, đã lọc `?sub=`.

    `hidden_at__isnull=True` là bộ lọc bảo vệ duy nhất của feed — mạch bị mod ẩn không
    được xuất hiện ở bất kỳ danh sách công khai nào (PLAN 5.10).
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
    return FeedOut(
        items=[mach_tom_tat_ra(m) for m in trang], cursor_ke_tiep=ke_tiep
    ), None


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


@router.get(
    "/feeds/moi",
    response=TRA_LOI,
    operation_id="liet_ke_feed_moi",
    tags=["feed"],
)
def feed_moi(
    request,
    sub: str | None = None,
    cursor: str | None = None,
    limit: int = GIOI_HAN_MAC_DINH,
):
    """Feed **Mới**: mọi bài, mới đăng trước (`created_at` giảm dần).

    `?sub=<slug>` lọc theo chuyên mục; sub không tồn tại trả 404 `sub_khong_ton_tai`.
    `?cursor=` là cursor keyset lấy từ `cursor_ke_tiep` của trang trước; `null` là hết.
    `?limit=` tối đa 50.

    Mạch bị mod ẩn không xuất hiện. Mạch đã đóng sổ **vẫn xuất hiện** — feed này sắp theo
    lúc bài ra đời, không theo trạng thái sổ.
    """
    if (l := kiem_gioi_han(limit)) is not None:
        return l
    if (l := _kiem_sub(sub)) is not None:
        return l
    ket_qua, l = _trang(
        _mach_hien(sub), truong="created_at", cursor=cursor, limit=limit
    )
    return l if l is not None else ket_qua


@router.get(
    "/feeds/dang-dien-ra",
    response=TRA_LOI,
    operation_id="liet_ke_feed_dang_dien_ra",
    tags=["feed"],
)
def feed_dang_dien_ra(
    request,
    sub: str | None = None,
    cursor: str | None = None,
    limit: int = GIOI_HAN_MAC_DINH,
):
    """Feed **Đang diễn ra**: mạch còn mở, mốc mới nhất trước (`last_entry_at` giảm dần).

    Feed đặc sản của gikky, **không phải** Hot: mốc mới không "bump" bài, nó chỉ cập nhật
    khoá sort của riêng feed này.

    `last_entry_at` đo **cấu trúc** — mọi mốc đều tính, kể cả mốc bị mod ẩn. Vì thế một
    mạch có thể đứng đầu feed này mà mở ra là **mặt CẶN** (`face` tính theo
    `last_activity_at`, vốn chỉ đo nội dung đọc được). Đó là hành vi đúng theo luật đếm
    hiện hành, đã ghi ở PLAN mục 6 "hệ quả cố ý 2" — đừng chữa bằng cách đổi khoá sort.

    Tham số như `GET /feeds/moi`.
    """
    if (l := kiem_gioi_han(limit)) is not None:
        return l
    if (l := _kiem_sub(sub)) is not None:
        return l
    ket_qua, l = _trang(
        _mach_hien(sub).filter(status=TrangThaiMach.MO),
        truong="last_entry_at",
        cursor=cursor,
        limit=limit,
    )
    return l if l is not None else ket_qua
