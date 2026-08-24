"""Models domain của gikky.net — PLAN mục 6.

**Vì sao là package chứ không phải một `models.py`:** 14 model với đầy đủ ràng buộc,
index có điều kiện và docstring giải thích lý do là ~700 dòng. Gom một file thì mọi
lần sửa `Comment` đều phải cuộn qua `Notification`. Chia theo *cụm domain*, không chia
theo kiểu ("tất cả FK", "tất cả enum"):

- `nguoi_dung`  — `User`
- `dien_dan`    — `Sub`, `ModSub`, `Mach`
- `moc`         — `Moc`, `MocRevision`, `MocAnh`
- `binh_luan`   — `Comment`
- `tuong_tac`   — `Vote`, `Reaction`, `Trich`, `Follow`
- `he_thong`    — `Notification`, `Report`, `AuditLog`

Django lấy `app_label` từ vị trí package trong app `core`, nên không model nào cần khai
`Meta.app_label`. Điều kiện DUY NHẤT là mọi model phải được import ở đây — model không
import thì Django không thấy, `makemigrations` lặng lẽ bỏ qua (không có gì đỏ).
`tests/test_models_domain.py::test_du_14_model_va_deu_dang_ky_vao_app_core` ghim đúng
chuyện đó — nó đọc **app registry** của Django chứ không đọc `__all__` ở dưới, vì
registry mới là thứ `makemigrations` dùng.
"""

from core.models.binh_luan import Comment
from core.models.dien_dan import Mach, ModSub, Sub
from core.models.he_thong import AuditLog, Notification, Report
from core.models.moc import Moc, MocAnh, MocRevision
from core.models.nguoi_dung import User
from core.models.tuong_tac import Follow, Reaction, Trich, Vote

__all__ = [
    "AuditLog",
    "Comment",
    "Follow",
    "Mach",
    "Moc",
    "MocAnh",
    "MocRevision",
    "Notification",
    "Reaction",
    "Report",
    "ModSub",
    "Sub",
    "Trich",
    "User",
    "Vote",
]
