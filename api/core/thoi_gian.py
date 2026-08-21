"""Múi giờ sản phẩm — PLAN mục 1: mọi "ngày"/"hôm nay" là **Asia/Ho_Chi_Minh**.

Server lưu UTC (`USE_TZ = True`); chỗ nào nói "ngày" thì quy đổi ở đây, một chỗ.
Ba luật của sản phẩm treo vào hàm này:

- rate limit 3 mốc / **ngày lịch VN** / mạch (PLAN 5.1);
- `occurred_at` mặc định = **hôm nay giờ VN**, cấm ngày tương lai (PLAN 5.2);
- `dedupe_key` thông báo `"moc_moi:{mach_id}:{yyyymmdd theo giờ VN}"` (PLAN 5.8).

Cả ba đều sai lệch 7 tiếng nếu ai đó tính theo UTC — và sai lệch đó chỉ lộ ra trong
khung 17:00–24:00 giờ VN, tức là đúng khung giờ ít người chạy test nhất.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo

from django.utils import timezone

MUI_GIO_VN = "Asia/Ho_Chi_Minh"
TZ_VN = ZoneInfo(MUI_GIO_VN)


def ngay_vn(khi: datetime | None = None) -> date:
    """Ngày lịch Việt Nam của một thời điểm (mặc định: bây giờ).

    Truyền `timezone` tường minh cho `localdate` thay vì dựa vào `settings.TIME_ZONE`:
    hai thứ đó *đang* trùng nhau, nhưng `TIME_ZONE` là cấu hình hiển thị của Django —
    ai đổi nó sang UTC cho hợp log prod sẽ lặng lẽ dời luôn ranh giới "ngày" của ba
    luật sản phẩm ở trên. Múi giờ sản phẩm không phải là cấu hình.
    """
    return timezone.localdate(khi, timezone=TZ_VN)


def khoa_ngay_vn(khi: datetime | None = None) -> str:
    """`yyyymmdd` theo giờ VN — thành phần ngày của `Notification.dedupe_key`."""
    return ngay_vn(khi).strftime("%Y%m%d")
