"""Cursor keyset cho feed và cho hai sort thời gian của khán đài — PLAN 5.9, 5.3.

**Vì sao keyset chứ không phải `OFFSET`:** feed sắp theo thời gian và có bài mới chèn
vào đầu liên tục. Với `OFFSET`, một bài mới xuất hiện giữa lúc người ta đọc trang 1 và
xin trang 2 sẽ đẩy mọi thứ xuống một nấc ⇒ **hàng cuối trang 1 lặp lại ở đầu trang 2**,
và một bài bị xoá thì có hàng bị **bỏ sót hẳn**. Keyset neo vào giá trị thật của hàng
cuối cùng đã trả, nên hai ca đó không xảy ra.

Khoá là **cặp** `(mốc thời gian, id)` chứ không phải mình mốc thời gian: `created_at` của
hai hàng trùng nhau là chuyện bình thường (seed dựng nhiều bình luận cùng giây), và với
khoá không duy nhất thì keyset lại rơi đúng vào bệnh trùng/sót mà nó sinh ra để chữa.

**Cursor là base64, KHÔNG phải mã hoá.** Nó lộ `created_at` và `id` cho ai chịu khó giải
— chấp nhận được vì cả hai đã nằm sẵn trong response. Đừng nhét gì khác vào (PLAN mục 3
plan con 1b, rủi ro 3).
"""

import base64
import binascii
from datetime import datetime

from django.db.models import Q, QuerySet

from api.loi import THAM_SO_KHONG_HOP_LE, loi

GIOI_HAN_MAC_DINH = 20
GIOI_HAN_TOI_DA = 50

#: Ngăn hai nửa của cursor. `|` không xuất hiện trong ISO-8601 nên `rsplit` không mơ hồ.
NGAN = "|"


class CursorHong(ValueError):
    """Cursor không giải được — người gọi đổi thành 400 `cursor_khong_hop_le`."""


def ma_hoa_cursor(khi: datetime, id: int) -> str:
    """`base64url("<ISO-8601 aware>|<id>")`, bỏ dấu `=` đệm.

    Bỏ `=` để cursor đi qua query string mà không phải url-encode; `giai_ma_cursor` tự
    đệm lại.
    """
    tho = f"{khi.isoformat()}{NGAN}{id}".encode()
    return base64.urlsafe_b64encode(tho).decode().rstrip("=")


def giai_ma_cursor(chuoi: str) -> tuple[datetime, int]:
    """Ngược của `ma_hoa_cursor`. Sai một chỗ nào cũng ném `CursorHong`.

    **Không có nhánh "đoán bừa"**: cursor rác mà bị hiểu thành "trang đầu" là người dùng
    nhận lại trang 1 trong khi tưởng mình đang đọc trang 5, im lặng và không lặp lại được.

    Đòi dấu thời gian **aware**: một `datetime` naive đem so với cột `timestamptz` sẽ ném
    cảnh báo của Django, mà `filterwarnings = ["error"]` biến nó thành lỗi 500 — tức là
    một chuỗi người lạ gõ vào URL quyết định được mã lỗi. Chặn ngay tại đây thành 400.
    """
    try:
        dem = base64.urlsafe_b64decode(chuoi + "=" * (-len(chuoi) % 4)).decode()
    except (binascii.Error, UnicodeDecodeError, ValueError) as e:
        raise CursorHong(f"cursor không giải được base64: {chuoi!r}") from e

    phan = dem.rsplit(NGAN, 1)
    if len(phan) != 2:
        raise CursorHong(f"cursor thiếu phần id: {dem!r}")
    try:
        khi = datetime.fromisoformat(phan[0])
        id = int(phan[1])
    except ValueError as e:
        raise CursorHong(f"cursor sai định dạng: {dem!r}") from e
    if khi.tzinfo is None:
        raise CursorHong("cursor mang dấu thời gian không có múi giờ")
    return khi, id


def loc_keyset(
    qs: QuerySet, *, truong: str, khi: datetime, id: int, giam_dan: bool
) -> QuerySet:
    """Cắt bỏ mọi hàng đứng TRƯỚC-hoặc-BẰNG `(khi, id)` theo đúng chiều đang sắp.

    Điều kiện `(truong, id) < (khi, id)` viết ra SQL thành `truong < khi OR (truong = khi
    AND id < id)`. Vế thứ hai là thứ giữ cho hàng có `truong` trùng nhau không bị trả hai
    lần — bỏ nó đi thì mọi hàng cùng dấu thời gian với hàng cuối trang trước hoặc lặp lại
    hết, hoặc mất hết, tuỳ ta dùng `<` hay `<=`.
    """
    if giam_dan:
        return qs.filter(Q(**{f"{truong}__lt": khi}) | Q(**{truong: khi, "pk__lt": id}))
    return qs.filter(Q(**{f"{truong}__gt": khi}) | Q(**{truong: khi, "pk__gt": id}))


def kiem_gioi_han(limit: int):
    """`None` nếu `limit` hợp lệ, ngược lại là response 400 `tham_so_khong_hop_le`.

    Có trần cứng vì `limit` đi thẳng vào `LIMIT` của SQL: `?limit=100000` không được là
    cách một request lẻ ăn hết bộ nhớ tiến trình.

    **Chỉ đúng cho feed và hồ sơ.** Với khán đài, `nap_binh_luan` nạp TOÀN BỘ bình luận của
    mạch rồi `dung_cay` dựng đủ nút, `_cat_goc` mới cắt trong Python — ở đó `limit` không
    chạm SQL và không giảm số nút phải dựng, nên nó **không** bảo vệ bộ nhớ. Đó là nợ đã có
    tên (plan 1b vá lượt 2, mục 3.1), hoãn sang 1c/Phase 3.
    """
    if 1 <= limit <= GIOI_HAN_TOI_DA:
        return None
    return loi(
        400,
        THAM_SO_KHONG_HOP_LE,
        f"limit phải nằm trong 1..{GIOI_HAN_TOI_DA}, nhận {limit}.",
    )


def cat_trang(hang: list, gioi_han: int) -> tuple[list, bool]:
    """Nhận danh sách đã lấy dư MỘT hàng, trả `(đúng một trang, còn nữa không)`.

    Lấy dư một hàng là cách biết "còn trang sau" mà không phải chạy thêm câu `COUNT(*)`
    trên một bảng đang lớn dần.
    """
    return hang[:gioi_han], len(hang) > gioi_han
