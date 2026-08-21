"""Mặt BÃO / mặt CẶN — PLAN 5.5.

PLAN 5.5 viết luật thành hai vế:

```
BÃO  nếu (status == open VÀ chưa bị khoá VÀ now − last_activity_at ≤ 72h)
     HOẶC (user đăng nhập VÀ đã follow hoặc từng bình luận mạch này)
CẶN  còn lại.
```

**Module này chỉ cài VẾ THỨ NHẤT** — vế thời gian. Vế thứ hai phụ thuộc viewer và
**cố ý chưa có ở đây**: `GET /machs/{id}` phải cache được (PLAN 8.4, chỗ PLAN tự gọi là
"điểm dễ làm sai nhất"), nên một trường phụ thuộc người đăng nhập lọt vào response đó là
người dùng B nhận mặt tính theo trạng thái của người dùng A qua cache. Vế viewer thuộc
Phase 3 và sẽ đi qua `GET /machs/{id}/me`, không đi qua hàm này.

Đừng "hoàn thiện" hàm bằng cách thêm tham số `user`: nó sẽ được gọi từ đúng chỗ không
được phép biết `user`.
"""

from datetime import datetime, timedelta
from typing import Literal

from django.utils import timezone

from core.models.dien_dan import TrangThaiMach

#: PLAN 5.5 — ngưỡng "còn sôi".
NGUONG_BAO = timedelta(hours=72)

MAT_BAO = "bao"
MAT_CAN = "can"

#: Kiểu dùng cho schema Ninja ⇒ TS client ra union `"bao" | "can"` thay vì `string`.
Mat = Literal["bao", "can"]


def tinh_mat_theo_thoi_gian(
    *,
    status: str,
    locked_at: datetime | None,
    last_activity_at: datetime,
    now: datetime | None = None,
) -> Mat:
    """Mặt của một mạch theo **vế thời gian** của PLAN 5.5. Không biết gì về viewer.

    BÃO khi CẢ BA đúng: mạch đang mở · chưa bị mod khoá · `now − last_activity_at ≤ 72h`.
    Thiếu một là CẶN.

    Biên `≤` là nguyên văn PLAN: đúng 72h vẫn là BÃO, 72h + 1 giây là CẶN.

    `last_activity_at` đo **nội dung đọc được** (PLAN mục 6, "Luật đếm 4 cột"), nên nó có
    thể **nhỏ hơn** `last_entry_at`: tác giả nối mốc rồi mốc đó bị mod ẩn ⇒ mạch vẫn đứng
    đầu feed "Đang diễn ra" (sort `last_entry_at`) mà mở ra là mặt CẶN. Đó là hành vi
    ĐÚNG theo luật đếm hiện hành, không phải bug — xem PLAN mục 6 "hệ quả cố ý 2".
    """
    if status != TrangThaiMach.MO:
        return MAT_CAN
    if locked_at is not None:
        return MAT_CAN
    if now is None:
        now = timezone.now()
    return MAT_BAO if now - last_activity_at <= NGUONG_BAO else MAT_CAN
