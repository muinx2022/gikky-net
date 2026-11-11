"""Luật mạch riêng tư (`Mach.rieng_tu`) — **một vị từ duy nhất** (plan 2026-11-09, D1).

Mạch riêng tư: chỉ **tác giả** và **staff** thấy. Người còn lại — kể cả người đã đăng nhập,
kể cả người đã theo dõi / vote / bình luận từ trước khi mạch chuyển riêng tư — coi như mạch
**không tồn tại**: mọi cửa trả 404 `khong_tim_thay`, cùng mã và cùng chữ với "không có mạch
này". Không bao giờ 403: một cửa trả 403 cho người lạ là một cái dò id (id mạch là số
nguyên liên tiếp).

## Vì sao có file này

Tới 2026-11-09 luật chỉ sống ở các cửa ĐỌC, mỗi cửa một bản sao viết tay
(`api/machs.py::_mach_hien`, `api/mocs.py::_moc_cua_mach_hien`, `api/theo_doi.py::_mach_hien`,
`api/feeds.py`, `api/users.py`, `api/ho_so.py`). Mọi cửa khác nạp mạch theo id chỉ lọc
`hidden_at` — đúng loại lỗi `core/doc_noi_dung.py` cảnh báo: luật rải mà không ai đếm thì
đường thứ N+1 quên điều kiện. Chỗ nào CHƯA có điều kiện này thì gọi hàm ở đây, **không tự
viết điều kiện mới**. (Các bản sao cũ chưa được gộp về đây — việc riêng.)

## Ba hàm, ba câu hỏi

- `mach_xem_duoc(mach, user)` — một mạch đã nạp, người này có xem được không;
- `loc_xem_duoc(qs, user, tien_to=…)` — danh sách có người xem: tác giả thấy của mình,
  staff thấy hết, người khác chỉ thấy công khai;
- `loc_cong_khai(qs, tien_to=…)` — chỉ mục / tìm kiếm / mọi thứ **không có người xem**:
  luôn `rieng_tu=False`, kể cả với tác giả (tìm kiếm là một danh sách công khai).

Cả ba chỉ nói về `rieng_tu`. `hidden_at` (mod ẩn) và `archived_at` (lưu trữ) vẫn do từng
cửa lọc — thêm `archived_at` vào luật này sau (sổ `P-20261109-4`) là sửa **một** chỗ: các
vị từ ở đây.
"""

from django.db.models import Q, QuerySet


def _da_dang_nhap(user) -> bool:
    return user is not None and getattr(user, "is_authenticated", False)


def _la_staff(user) -> bool:
    return _da_dang_nhap(user) and bool(getattr(user, "is_staff", False))


def mach_xem_duoc(mach, user) -> bool:
    """`False` khi `mach.rieng_tu` mà `user` không phải tác giả và không phải staff.

    `user` là `None`, `AnonymousUser`, hay `User` đều được: ẩn danh coi như không phải tác
    giả lẫn staff. Mạch công khai thì ai cũng xem được (các luật ẩn / lưu trữ nằm ở nơi khác).
    """
    if not mach.rieng_tu:
        return True
    if not _da_dang_nhap(user):
        return False
    return user.pk == mach.author_id or _la_staff(user)


def loc_xem_duoc(qs: QuerySet, user, *, tien_to: str = "") -> QuerySet:
    """Giữ lại hàng mà `user` được xem. `tien_to` là đường tới `Mach` ("" cho chính `Mach`,
    `"mach__"` cho `Moc`/`Comment`/`Follow`…).

    Staff: không lọc. Tác giả: công khai + của mình. Người khác: công khai. Ẩn danh: công khai.
    """
    if _la_staff(user):
        return qs
    cong_khai = Q(**{f"{tien_to}rieng_tu": False})
    if _da_dang_nhap(user):
        return qs.filter(cong_khai | Q(**{f"{tien_to}author": user}))
    return qs.filter(cong_khai)


def loc_cong_khai(qs: QuerySet, *, tien_to: str = "") -> QuerySet:
    """Giữ lại hàng thuộc mạch CÔNG KHAI — cho chỉ mục và tìm kiếm, nơi không có người xem."""
    return qs.filter(**{f"{tien_to}rieng_tu": False})
