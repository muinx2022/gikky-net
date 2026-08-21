"""Xếp hạng bình luận — PLAN 5.3, nguyên tắc 7.

Hai hàm THUẦN, không đụng DB: 1b gọi lại đúng chúng để sort trang 50 thread gốc.
"Không lưu rank" là quyết định của PLAN mục 6 — rank phụ thuộc `now`, lưu ra là ôi.
"""

from datetime import datetime, timedelta
from math import sqrt

#: z của khoảng tin cậy một phía ~80% — PLAN 5.3 chốt đích danh 1.281.
Z_MAC_DINH = 1.281

#: Cộng thẳng vào rank cho bình luận GỐC ra đời sau mốc mới nhất và còn trong 48h đầu
#: đời của nó (PLAN 5.3). Lý do tồn tại: wilson thuần để 3 bình luận từ mốc 1 chiếm
#: đỉnh vĩnh viễn — người đến sau thấy "ván đã đóng" và không buồn viết gì.
HE_SO_TUOI = 0.15
CUA_SO_TUOI = timedelta(hours=48)


def wilson_lower_bound(up: int, down: int, z: float = Z_MAC_DINH) -> float:
    """Cận dưới Wilson của tỷ lệ up trên tổng vote.

    Vì sao không dùng `up - down`: +5 có thể là 5-0 (đồng thuận) hoặc 105-100 (gây
    chia rẽ) — hai thứ đó phải xếp hạng khác nhau. Wilson phạt mẫu nhỏ, nên 5-0 đứng
    dưới 50-2 dù tỷ lệ 100% > 96%.

    Ca biên có thật, không phải lý thuyết: `up = down = 0` (bình luận vừa viết) → 0.0,
    và `up = 0, down = n` → 0.0 với MỌI n (cận dưới của 0 thành công là 0). Nghĩa là
    một bình luận chưa ai vote và một bình luận bị 20 người dislike ngang điểm nhau ở
    hàm này; thứ tự giữa chúng do PLAN 5.3 định đoạt ở chỗ khác (điểm ≤ −5 tự gập).
    """
    n = up + down
    if n <= 0:
        return 0.0
    p = up / n
    z2 = z * z
    mau = 1 + z2 / n
    tam = p + z2 / (2 * n)
    bien = z * sqrt((p * (1 - p) + z2 / (4 * n)) / n)
    return (tam - bien) / mau


def duoc_he_so_tuoi(
    *, created_at: datetime, last_entry_at: datetime | None, now: datetime
) -> bool:
    """Bình luận gốc này có được cộng `HE_SO_TUOI` không? (PLAN 5.3, nguyên văn.)

    Hai điều kiện phải ĐỒNG THỜI đúng:

    1. `created_at > last_entry_at` — ra đời SAU mốc mới nhất;
    2. `now − created_at <= 48h` — còn trong 48h đầu **đời của nó**.

    Hành vi biên là CHỦ ĐÍCH (PLAN 5.3 ghi rõ): mạch nguội 3 tháng, ai đó viết bình
    luận hôm nay thì vẫn được bonus, vì điều kiện 1 so với `last_entry_at` chứ không so
    với "gần đây". Đó chính là cách người đến muộn có cửa lên đỉnh.
    """
    if last_entry_at is not None and created_at <= last_entry_at:
        return False
    return now - created_at <= CUA_SO_TUOI


def xep_hang_binh_luan_goc(
    *,
    up_count: int,
    down_count: int,
    created_at: datetime,
    last_entry_at: datetime | None,
    now: datetime,
    z: float = Z_MAC_DINH,
) -> float:
    """Rank của một bình luận **GỐC** trong sort `hay_nhat` = wilson + hệ số tươi.

    Chỉ áp cho bình luận gốc: sibling trong thread sort theo wilson thuần (PLAN 5.3).
    Vì vậy hàm này nhận tham số rời thay vì một `Comment` — gọi nhầm nó cho một reply
    thì phải cố tình gõ ra `created_at=reply.created_at`, chứ không lỡ tay truyền cả
    object vào được.
    """
    diem = wilson_lower_bound(up_count, down_count, z=z)
    if duoc_he_so_tuoi(created_at=created_at, last_entry_at=last_entry_at, now=now):
        diem += HE_SO_TUOI
    return diem
