"""Nhật ký hành động mod — PLAN 5.10 ("mọi hành động mod ghi `AuditLog`"), 9.3 mục 4.

**Chỉ ĐỌC, và cố ý không có endpoint ghi nào.** `AuditLog` được ghi trong cùng transaction
với chính hành động (`core/ghi.py::ghi_audit`); một cửa ghi thứ hai từ HTTP là cách log
nói một chuyện còn `hidden_at` nói chuyện khác. Cũng không có endpoint xoá: một nhật ký
xoá được là một nhật ký không dùng làm bằng chứng được.

Nhắc lại chốt của `core/models/he_thong.py`: **STATE không nằm ở bảng này**. Đừng dựng
trang nào suy trạng thái hiện tại bằng cách replay log — trạng thái ở `hidden_at`,
`locked_at`, `ban*` trên chính đối tượng.
"""

from ninja import Router

from core.models.he_thong import AuditLog

from api.loi import CURSOR_KHONG_HOP_LE, LoiOut, loi
from api.phan_trang import (
    GIOI_HAN_MAC_DINH,
    CursorHong,
    cat_trang,
    dem_tong,
    giai_ma_cursor,
    kiem_gioi_han,
    loc_keyset,
    ma_hoa_cursor,
)
from api.quan_tri_schemas import NhatKyOut, TrangNhatKyOut
from api.trinh_bay import nguoi_dung_ra

router = Router()


@router.get(
    "/nhat-ky",
    response={200: TrangNhatKyOut, 400: LoiOut, 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_liet_ke_nhat_ky",
    tags=["quan-tri-nhat-ky"],
)
def liet_ke_nhat_ky(
    request,
    action: str | None = None,
    limit: int = GIOI_HAN_MAC_DINH,
    cursor: str | None = None,
):
    """Nhật ký mod, mới nhất trước, cursor keyset `(created_at, id)`.

    `?action=` lọc theo một hằng hành động (`an_moc`, `ban_user`, …) — so **bằng đúng**
    chứ không `icontains`: `an_moc` và `go_an_moc` chỉ khác nhau một tiền tố, nên phép so
    khớp một phần sẽ trả cả hai và mod đọc lịch sử ẩn thành lịch sử gỡ ẩn.

    Cố ý **không** khai `action` bằng `Literal`: danh sách hằng nằm ở `core/ghi.py` và nó
    dài thêm mỗi lần có hành động mới, trong khi các dòng log CŨ mang những chuỗi có thể
    đã bị gỡ khỏi danh sách. Một `enum` ở đây sẽ từ chối lọc đúng những dòng lịch sử mà
    trang này tồn tại để tra. Giá trị lạ ⇒ trang rỗng, không phải 400.
    """
    if (loi_limit := kiem_gioi_han(limit)) is not None:
        return loi_limit

    qs = AuditLog.objects.select_related("actor")
    if action:
        qs = qs.filter(action=action)

    tong = dem_tong(qs)

    if cursor is not None:
        try:
            khi, id = giai_ma_cursor(cursor)
        except CursorHong as e:
            return loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")
        qs = loc_keyset(qs, truong="created_at", khi=khi, id=id, giam_dan=True)

    hang = list(qs.order_by("-created_at", "-pk")[: limit + 1])
    trang, con_nua = cat_trang(hang, limit)
    ke_tiep = (
        ma_hoa_cursor(trang[-1].created_at, trang[-1].pk) if con_nua and trang else None
    )
    return TrangNhatKyOut(
        items=[
            NhatKyOut(
                id=d.pk,
                actor=nguoi_dung_ra(d.actor),
                action=d.action,
                target_type=d.target_type,
                target_id=d.target_id,
                meta=d.meta,
                created_at=d.created_at,
            )
            for d in trang
        ],
        cursor_ke_tiep=ke_tiep,
        tong=tong,
    )
