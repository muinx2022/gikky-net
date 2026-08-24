"""Cursor keyset cho feed và cho hai sort thời gian của khán đài — PLAN 5.9, 5.3.

**Vì sao keyset chứ không phải `OFFSET`:** feed sắp theo thời gian và có bài mới chèn
vào đầu liên tục. Với `OFFSET`, một bài mới xuất hiện giữa lúc người ta đọc trang 1 và
xin trang 2 sẽ đẩy mọi thứ xuống một nấc ⇒ **hàng cuối trang 1 lặp lại ở đầu trang 2**,
và một bài bị xoá thì có hàng bị **bỏ sót hẳn**. Keyset neo vào giá trị thật của hàng
cuối cùng đã trả, nên hai ca đó không xảy ra.

⚠ **Bảo đảm "không trùng, không sót" ở trên chỉ đúng với khoá BẤT BIẾN** *(nói lại cho
đúng mức, 2026-08-22 — trước đó câu trên viết tuyệt đối và plan con 1d đã làm nó sai)*.
Bất biến ở đây nghĩa là: giá trị khoá của một hàng **không đổi trong lúc người ta đang
lật trang**. `created_at` và `last_entry_at` thoả (`last_entry_at` chỉ đổi khi có mốc
mới, và mốc mới thì hàng đó vốn đã sang đầu danh sách — nó là "hàng mới chèn vào đầu",
đúng ca keyset chữa được).

`Mach.diem_bai_goc` **KHÔNG** thoả: mỗi lá phiếu rơi vào mốc 1 là một khoá sort đổi giá
trị dưới chân cursor. Hệ quả có hai mặt, cả hai đều là HTTP 200 im lặng:

- **sót** — một mạch chưa trả ở trang 1 được vote LÊN vượt mốc cursor ⇒ nó đứng trước
  chỗ cắt ⇒ không bao giờ xuất hiện ở trang nào;
- **trùng** — một mạch đã trả ở trang 1 bị vote XUỐNG dưới mốc cursor ⇒ nó rơi vào phần
  còn lại ⇒ hiện lần thứ hai.

**Đây là đánh đổi đã chốt, không phải nợ** (plan con 1d lượt vá 2, §0): `OFFSET` không
chữa được (nó còn thêm bệnh trượt hàng của riêng nó) và snapshot là một hệ thống khác
hẳn; hậu quả là một mạch lệch chỗ trong một lần cuộn, không mất dữ liệu. Hành vi ấy được
**ghim bằng test** ở `api/tests/test_keyset_khoa_bien_doi.py` — đổi cơ chế thì hai bài đo
đó đỏ và người sửa đọc được vì sao nó từng như vậy.

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


def ma_hoa_cursor_so(gia_tri: int, id: int) -> str:
    """Cursor cho khoá keyset **số nguyên** — feed "Nhiều điểm nhất" (plan con 1d §1).

    Cùng hình dạng `base64url("<khoá>|<id>")` với `ma_hoa_cursor`, chỉ khác kiểu nửa đầu.

    ⚠ **Khoá của họ cursor này BIẾN ĐỔI** (`Mach.diem_bai_goc`), nên nó **không** hưởng
    bảo đảm "không trùng, không sót" của keyset — xem docstring đầu file. Vote lên vượt
    mốc cursor ⇒ mạch bị **sót**; vote xuống dưới mốc ⇒ mạch hiện **trùng**. Đánh đổi đã
    chốt, ghim ở `api/tests/test_keyset_khoa_bien_doi.py`.
    """
    return base64.urlsafe_b64encode(f"{gia_tri}{NGAN}{id}".encode()).decode().rstrip("=")


def giai_ma_cursor_so(chuoi: str) -> tuple[int, int]:
    """Ngược của `ma_hoa_cursor_so`. Sai một chỗ nào cũng ném `CursorHong`.

    **Cố ý KHÔNG nhận cursor thời gian, và ngược lại.** Hai họ cursor mang hai khoá sort
    khác nhau; nhận nhầm là người dùng đang đọc dở "Nhiều điểm nhất" bấm sang "Mới" và
    trang sau được cắt theo một khoá không liên quan — trùng dòng, sót dòng, HTTP 200.
    `datetime.fromisoformat` đã từ chối `"23"`, còn chiều này thì `int("2026-08-22T...")`
    ném `ValueError`; cả hai quy về `CursorHong` ⇒ 400 ở tầng API.
    """
    try:
        dem = base64.urlsafe_b64decode(chuoi + "=" * (-len(chuoi) % 4)).decode()
    except (binascii.Error, UnicodeDecodeError, ValueError) as e:
        raise CursorHong(f"cursor không giải được base64: {chuoi!r}") from e

    phan = dem.rsplit(NGAN, 1)
    if len(phan) != 2:
        raise CursorHong(f"cursor thiếu phần id: {dem!r}")
    try:
        return int(phan[0]), int(phan[1])
    except ValueError as e:
        raise CursorHong(f"cursor sai định dạng: {dem!r}") from e


def loc_keyset(
    qs: QuerySet, *, truong: str, khi: datetime | int, id: int, giam_dan: bool
) -> QuerySet:
    """Cắt bỏ mọi hàng đứng TRƯỚC-hoặc-BẰNG `(khi, id)` theo đúng chiều đang sắp.

    Điều kiện `(truong, id) < (khi, id)` viết ra SQL thành `truong < khi OR (truong = khi
    AND id < id)`. Vế thứ hai là thứ giữ cho hàng có `truong` trùng nhau không bị trả hai
    lần — bỏ nó đi thì mọi hàng cùng dấu thời gian với hàng cuối trang trước hoặc lặp lại
    hết, hoặc mất hết, tuỳ ta dùng `<` hay `<=`.

    `khi` là **giá trị của khoá**, không nhất thiết là dấu thời gian: feed "Nhiều điểm
    nhất" truyền `diem_bai_goc` (số nguyên) vào đây. Phép so sánh do Postgres làm trên
    đúng kiểu của cột, nên hàm không cần biết mình đang cắt theo cái gì.
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


def dem_tong(qs: QuerySet) -> int:
    """Tổng số hàng của tập **đã lọc** — con số cho thanh phân trang.

    ⚠ **Gọi TRƯỚC `loc_keyset`, không bao giờ sau.** `loc_keyset` cắt bỏ phần đầu danh
    sách, nên đếm sau nó ra *số hàng còn lại từ cursor trở đi*: trang 1 báo "295 mục",
    trang 2 báo "270", trang 3 báo "245". Không có gì nổ, không có log — chỉ là một con
    số tụt dần mà người đọc sẽ tin, vì nó trông y hệt một con số thật.

    Đó là lý do hàm này tồn tại thay vì gõ thẳng `qs.count()` ở năm chỗ: một cái tên để
    grep ra mọi chỗ đếm, và một chỗ duy nhất để viết cái bẫy xuống. Bảo đảm thật nằm ở
    bài đo `tests/test_api_quan_tri_phan_trang.py::test_tong_khong_doi_qua_cac_trang` —
    nó lật hết các trang và đòi `tong` giữ nguyên.

    Cái giá: **thêm một `COUNT(*)`** mỗi lần nạp bảng. Chấp nhận ở khu quản trị — lượt
    truy cập tính bằng chục mỗi ngày, và không có endpoint nào ở đây bị ghim số query.
    Đừng bê hàm này sang feed công khai mà không đo lại.
    """
    return qs.count()
