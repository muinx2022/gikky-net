"""Chuông: `GET /notifications` · `POST /notifications/read` — PLAN 5.8, mục 7.

Việc **sinh** thông báo không nằm ở đây — nó nằm ở `core/thong_bao.py` và được gọi từ
handler của hành động sinh ra nó, trong cùng transaction. File này chỉ có hai cửa ĐỌC/ghi
trạng thái đọc của chính người gọi.

## Luật xuyên suốt cả file: `user = request.user` nằm trong MỌI truy vấn

Không có endpoint nào ở đây nhận tham số chỉ ra một người dùng, và không truy vấn nào bắt
đầu bằng `Notification.objects.filter(pk=…)` rồi mới kiểm chủ sở hữu. Hai lối đó khác nhau
ở chỗ lối thứ hai để lộ **sự tồn tại** của một id qua mã lỗi (404 hay 403?), và ở chỗ nó
cần người viết endpoint tiếp theo nhớ viết phép kiểm. Lối thứ nhất thì không có gì để nhớ:
một id của người khác đơn giản là không nằm trong queryset.

Hệ quả cố ý ở `POST /notifications/read`: id lạ **bị bỏ qua im lặng**, không phải 403 —
xem docstring `DanhDauDaDocIn`.

## Vì sao chuông đọc được cho khách là 401 chứ không phải 200 rỗng

Khác hẳn `GET /me` và `GET /machs/{id}/me`, hai endpoint cố ý trả 200 cho khách. Lý do
khác nhau là ở chỗ chúng được gọi từ đâu: hai cửa kia chạy trên **mọi** lượt tải trang,
kể cả của bot, nên "chưa đăng nhập" là trạng thái bình thường nhất của chúng. Chuông thì
chỉ được poll khi header đã biết có người đăng nhập — một lời gọi của khách tới đây là
lỗi lập trình phía client, và 200 kèm danh sách rỗng sẽ giấu nó đi cùng với một vòng poll
60 giây chạy vĩnh viễn không để làm gì.
"""

from django.utils import timezone
from ninja import Router

from core.models.he_thong import Notification
from core.thong_bao import dem_chua_doc

from api.loi import CURSOR_KHONG_HOP_LE, LoiOut, loi
from api.phan_trang import (
    GIOI_HAN_MAC_DINH,
    CursorHong,
    cat_trang,
    giai_ma_cursor,
    kiem_gioi_han,
    loc_keyset,
    ma_hoa_cursor,
)
from api.quyen import dang_nhap
from api.schemas import ChuongOut, DaDocOut, ThongBaoOut
from api.schemas_ghi import DanhDauDaDocIn

router = Router()


@router.get(
    "/notifications",
    response={200: ChuongOut, 400: LoiOut, 401: LoiOut},
    operation_id="liet_ke_thong_bao",
    tags=["thong-bao"],
    auth=dang_nhap,
)
def liet_ke_thong_bao(request, limit: int = GIOI_HAN_MAC_DINH, cursor: str | None = None):
    """Chuông poll 60 giây — PLAN 5.8. **Per-user tuyệt đối, KHÔNG BAO GIỜ cache.**

    **Quyền: chỉ thông báo của chính người gọi.** Không có tham số nào chỉ ra người khác;
    `user = request.user` nằm ngay trong queryset gốc.

    Sắp **mới nhất trước**, cursor keyset trên `(created_at, id)` — khoá BẤT BIẾN, nên nó
    hưởng đủ bảo đảm "không trùng, không sót" của `api/phan_trang.py`. Một thông báo
    `moc_moi` được gộp lại (mốc thứ hai trong ngày) sẽ **bump `created_at`** và vì thế
    nhảy lên đầu — đúng ý muốn, và nó không phá keyset: hàng ấy chuyển sang trang 1, đúng
    ca "hàng mới chèn vào đầu" mà keyset sinh ra để xử.

    `so_chua_doc` đếm **toàn bộ hộp thư**, không phải trang đang xem: con số trên chấm đỏ
    nói "bạn có 23 thứ chưa đọc", tính nó trên một trang 20 dòng thì nó kẹt ở `20` mãi mãi
    — một con số trông hợp lý và luôn sai.

    **Không có bộ lọc `?chua_doc=`** ở bản này. Chuông hiện cả đã đọc lẫn chưa đọc trong
    một dòng thời gian; thêm một chế độ lọc là thêm một trạng thái UI phải nhớ, mà PLAN
    5.8 không đòi.
    """
    if (l := kiem_gioi_han(limit)) is not None:
        return l

    qs = Notification.objects.filter(user=request.user).order_by("-created_at", "-pk")
    if cursor is not None:
        try:
            khi, id = giai_ma_cursor(cursor)
        except CursorHong as e:
            return loi(400, CURSOR_KHONG_HOP_LE, str(e))
        qs = loc_keyset(qs, truong="created_at", khi=khi, id=id, giam_dan=True)

    hang, con_nua = cat_trang(list(qs[: limit + 1]), limit)
    return ChuongOut(
        items=[
            ThongBaoOut(
                id=n.pk,
                type=n.type,
                payload=n.payload,
                created_at=n.created_at,
                read_at=n.read_at,
            )
            for n in hang
        ],
        so_chua_doc=dem_chua_doc(request.user),
        cursor_ke_tiep=(
            ma_hoa_cursor(hang[-1].created_at, hang[-1].pk) if con_nua and hang else None
        ),
    )


@router.post(
    "/notifications/read",
    response={200: DaDocOut, 401: LoiOut},
    operation_id="danh_dau_da_doc",
    tags=["thong-bao"],
    auth=dang_nhap,
)
def danh_dau_da_doc(request, du_lieu: DanhDauDaDocIn):
    """Đánh dấu thông báo đã đọc — PLAN 5.8.

    **Quyền: chỉ thông báo của chính người gọi.** `ids` của người khác **bị bỏ qua im
    lặng**, không phải 403: truy vấn luôn kèm `user = request.user`, nên chuyện tệ nhất
    một id lạ gây ra là `so_da_danh_dau` nhỏ hơn số id đã gửi. Trả 403 thì ngược lại — nó
    **xác nhận** id đó có thật và thuộc về ai đó, tức một cửa dò id qua mã lỗi.

    `ids = null` là "đọc hết"; một danh sách là đánh dấu đúng từng dòng. `[]` đánh dấu
    **không dòng nào** — khác `null` một cách cố ý, để một mảng rỗng do client dựng hụt
    không lặng lẽ thành lệnh xoá sạch chấm đỏ.

    **Chỉ chạm hàng đang `read_at IS NULL`.** Hai hệ quả, cả hai đều là chủ đích:
    `so_da_danh_dau` đếm đúng số dòng **vừa đổi trạng thái** (bấm "đọc hết" lần thứ hai ra
    `0`), và `read_at` cũ không bị dời — nó là mốc "tôi đã xem cái này lúc nào", không phải
    một cờ boolean viết lại được mỗi lần bấm.
    """
    qs = Notification.objects.filter(user=request.user, read_at__isnull=True)
    if du_lieu.ids is not None:
        qs = qs.filter(pk__in=du_lieu.ids)
    so = qs.update(read_at=timezone.now())
    return DaDocOut(so_da_danh_dau=so, so_chua_doc=dem_chua_doc(request.user))
