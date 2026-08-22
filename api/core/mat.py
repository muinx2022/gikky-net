"""Mặt BÃO / mặt CẶN — PLAN 5.5.

PLAN 5.5 viết luật thành hai vế:

```
BÃO  nếu (status == open VÀ chưa bị khoá VÀ now − last_activity_at ≤ 72h)
     HOẶC (user đăng nhập VÀ đã follow hoặc từng bình luận mạch này)
CẶN  còn lại.
```

Hai vế nằm ở **hai hàm khác nhau**, và đó là ràng buộc kiến trúc chứ không phải cách chia
file cho gọn:

- `tinh_mat_theo_thoi_gian` — vế thời gian. Không biết gì về viewer, nên nó gọi được từ
  `GET /machs/{id}`, response mà PLAN 8.4 đòi phải cache được.
- `tinh_mat_cho_viewer` — vế thứ hai, thêm ở **Phase 3**. Chỉ gọi được từ
  `GET /machs/{id}/me`, endpoint per-user không bao giờ được cache.

**Đừng gộp chúng lại bằng cách thêm tham số `user` vào hàm thứ nhất.** Nó được gọi từ
đúng chỗ không được phép biết `user`, và một tham số mặc định `user=None` ở đó là lời mời
cho lời gọi thứ hai truyền `user` vào — lúc ấy `MachChiTietOut.face` thành trường per-user
nằm trong một response được ISR cache, tức người dùng B nhận mặt tính theo trạng thái của
người dùng A. HTTP 200, không có gì đỏ.
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


def tinh_mat_cho_viewer(
    *,
    mat_theo_thoi_gian: Mat,
    dang_nhap: bool,
    dang_follow: bool,
    tung_binh_luan: bool,
) -> Mat:
    """Mặt của mạch **với một người xem cụ thể** — vế thứ hai của PLAN 5.5 (Phase 3).

    Nguyên văn PLAN 5.5: `BÃO … HOẶC (user đăng nhập VÀ đã follow hoặc từng bình luận
    mạch này)`. Đây là một phép **HOẶC**, nên hàm chỉ có thể kéo CẶN → BÃO, không bao giờ
    ngược lại: người đã bỏ công theo hoặc đã nói một câu trong mạch thì mạch đó còn sống
    với họ kể cả khi cả thế giới đã bỏ đi. Hàm nhận sẵn kết quả vế thời gian thay vì tự
    tính lại để cả hai cửa (`GET /machs/{id}` và `/me`) không bao giờ cãi nhau về vế 1.

    `dang_nhap` là một tham số RIÊNG, không suy ra từ `dang_follow or tung_binh_luan`.
    Nghe thừa vì hai cờ kia chỉ đúng với người đã đăng nhập — nhưng chúng được TRUYỀN VÀO
    chứ không được hàm này tự tra, nên "thừa" ở đây là chỗ duy nhất chặn được một lời gọi
    dựng cờ từ một `user` đã đăng xuất. PLAN viết `user đăng nhập VÀ …`; giữ đúng chữ VÀ.

    **Mạch bị mod khoá / đã đóng sổ vẫn có thể ra BÃO ở đây, và đó là nguyên văn PLAN.**
    Vế 2 không có điều kiện nào về `status`/`locked_at` — nó nói về *quan hệ của người xem
    với mạch*, không nói về trạng thái của mạch. Nếu chuyện đó thành vấn đề sản phẩm thì
    phải sửa PLAN 5.5, không phải lặng lẽ thêm một điều kiện ở đây.
    """
    if mat_theo_thoi_gian == MAT_BAO:
        return MAT_BAO
    if dang_nhap and (dang_follow or tung_binh_luan):
        return MAT_BAO
    return MAT_CAN
