"""Ba bảng danh sách của khu quản trị: mạch · bình luận · người dùng (Phase 8).

Trước lượt này khu quản trị **chỉ tra cứu được bằng khoá chính xác** — `GET /machs/{id}`
và `GET /users/{username}`. Mod muốn biết "có gì mới đăng hôm nay" hay "ai vừa bị ban"
thì không có cửa nào; hàng đợi báo cáo chỉ thấy thứ đã bị người khác tố.

## Hai luật chung của cả ba bảng

**1. Không lọc bỏ nội dung đã bị ẩn.** Cùng lý lẽ với `api/quan_tri_bao_cao.py`: mod phải
đọc được thứ vừa bị ẩn thì mới gỡ ẩn lại được. Điều kiện để việc đó an toàn là `ChiMod` ở
tầng API, **không** phải một bộ lọc ở đây. Đừng "chữa" bằng `hidden_at__isnull=True`.

**2. Phân trang cursor keyset, KHÔNG offset.** Lý do riêng của khu này chứ không phải sở
thích chung: mod **đang ẩn nội dung trong lúc đọc bảng**, tức tập kết quả co lại dưới chân
họ. Với offset, mỗi hàng biến mất ở trang 1 làm trang 2 **nhảy cóc qua một hàng chưa ai
xem** — và thứ bị bỏ sót đúng là thứ chưa được xử. Keyset neo vào giá trị của hàng cuối
nên nó miễn nhiễm với chuyện đó.
"""

from datetime import timedelta

from django.db.models import Count, Q
from django.http import HttpResponse
from django.utils import timezone
from ninja import Router

from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.models.nguoi_dung import User

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
from api.quan_tri_kiem_duyet import duong_dan_mach
from api.quan_tri_loc import LOC_MACH_DANH_SACH
from api.quan_tri_nguoi_dung import nguoi_dung_quan_tri_ra
from api.quan_tri_schemas import (
    BinhLuanDongOut,
    LocBinhLuan,
    LocMach,
    LocNguoiDung,
    MachDongOut,
    TrangBinhLuanOut,
    TrangMachOut,
    TrangNguoiDungOut,
    trich_yeu,
)
from api.trinh_bay import nguoi_dung_ra

router = Router()

TRA_LOI_BANG = {400: LoiOut, 401: LoiOut, 403: LoiOut}

#: `trang_thai=moi` của bảng người dùng: đăng ký trong bao nhiêu ngày gần đây.
NGAY_LA_MOI = 7


def _doc_cursor(cursor: str | None):
    """`(khi, id)` hoặc `None`; ném `CursorHong` để người gọi dịch thành 400."""
    return None if cursor is None else giai_ma_cursor(cursor)


@router.get(
    "/machs",
    response={200: TrangMachOut, **TRA_LOI_BANG},
    operation_id="quan_tri_liet_ke_mach",
    tags=["quan-tri-bang"],
)
def liet_ke_mach(
    request,
    response: HttpResponse,
    q: str = "",
    sub: str | None = None,
    tac_gia: str | None = None,
    trang_thai: LocMach = "tat_ca",
    limit: int = GIOI_HAN_MAC_DINH,
    cursor: str | None = None,
):
    """Bảng mạch cho mod, mới nhất trước, cursor keyset `(created_at, id)`.

    `?q=` khớp **một phần, không phân biệt hoa thường** trên tiêu đề. Cố ý không dùng
    Meilisearch ở đây: đây là bảng quản trị, nó phải thấy **cả mạch đã bị ẩn** — mà mạch
    ẩn thì bị gỡ khỏi index đúng theo thiết kế của Phase 7. Dùng search ở đây là dựng một
    bảng quản trị mù đúng với thứ cần quản trị nhất.

    `?trang_thai=` chia **bốn nhóm LOẠI TRỪ NHAU** — `ẩn → khoá → đã đóng sổ → đang mở`,
    xét từ trên xuống (`api/quan_tri_loc.py`). Nghĩa là **`mo` KHÔNG bao gồm bài đã bị
    ẩn**, dù một bài bị ẩn vẫn "đang mở" trên trục `status`. Mặc định `tat_ca` gồm tất,
    kể cả bài đã gỡ — mod phải thấy để gỡ ẩn.
    """
    response["Cache-Control"] = "no-store"
    if (l := kiem_gioi_han(limit)) is not None:
        return l

    qs = Mach.objects.select_related("author", "sub")
    if q:
        qs = qs.filter(title__icontains=q)
    if sub:
        qs = qs.filter(sub__slug=sub)
    if tac_gia:
        qs = qs.filter(author__username=tac_gia)
    # Bốn nhóm LOẠI TRỪ NHAU, khai ở `api/quan_tri_loc.py` và **dùng chung với bảng điều
    # khiển**. Bản đầu lọc `status=MO` cho nhóm "đang mở" — mà `status` là trục *sổ*,
    # không dính gì tới `hidden_at`, nên bộ lọc ấy trả về **cả bài đã bị ẩn**. Người dùng
    # bắt được (2026-08-23), và bài đo đi kèm lúc ấy đã ghim chính hành vi sai đó là đúng.
    if trang_thai in LOC_MACH_DANH_SACH:
        qs = qs.filter(LOC_MACH_DANH_SACH[trang_thai])

    tong = dem_tong(qs)

    try:
        moc_cursor = _doc_cursor(cursor)
    except CursorHong as e:
        return loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")
    if moc_cursor is not None:
        khi, id = moc_cursor
        qs = loc_keyset(qs, truong="created_at", khi=khi, id=id, giam_dan=True)

    hang = list(qs.order_by("-created_at", "-pk")[: limit + 1])
    trang, con_nua = cat_trang(hang, limit)
    ke_tiep = (
        ma_hoa_cursor(trang[-1].created_at, trang[-1].pk) if con_nua and trang else None
    )
    return TrangMachOut(
        items=[
            MachDongOut(
                id=m.pk,
                title=m.title,
                sub_slug=m.sub.slug,
                tac_gia=nguoi_dung_ra(m.author),
                status=m.status,
                created_at=m.created_at,
                last_activity_at=m.last_activity_at,
                entry_count=m.entry_count,
                comment_count=m.comment_count,
                diem=m.diem_bai_goc,
                da_bi_an=m.hidden_at is not None,
                da_khoa=m.locked_at is not None,
                duong_dan_cong_khai=duong_dan_mach(m),
            )
            for m in trang
        ],
        cursor_ke_tiep=ke_tiep,
        tong=tong,
    )


@router.get(
    "/comments",
    response={200: TrangBinhLuanOut, **TRA_LOI_BANG},
    operation_id="quan_tri_liet_ke_binh_luan",
    tags=["quan-tri-bang"],
)
def liet_ke_binh_luan(
    request,
    response: HttpResponse,
    q: str = "",
    tac_gia: str | None = None,
    mach_id: int | None = None,
    trang_thai: LocBinhLuan = "tat_ca",
    limit: int = GIOI_HAN_MAC_DINH,
    cursor: str | None = None,
):
    """Bảng bình luận cho mod, mới nhất trước, cursor keyset `(created_at, id)`.

    Gồm **cả bia mộ và bình luận đã bị ẩn**. Bia mộ có mặt vì `deleted_at` không xoá
    `body` khỏi DB (PLAN 5.3 giữ chỗ), và mod đôi khi cần đọc đúng cái đã bị tác giả rút
    lại sau khi bị tố.

    `trang_thai=hien` = còn sống **và** chưa bị ẩn — hai cột, không phải một.
    """
    response["Cache-Control"] = "no-store"
    if (l := kiem_gioi_han(limit)) is not None:
        return l

    qs = Comment.objects.select_related("author", "mach")
    if q:
        qs = qs.filter(body__icontains=q)
    if tac_gia:
        qs = qs.filter(author__username=tac_gia)
    if mach_id is not None:
        qs = qs.filter(mach_id=mach_id)
    if trang_thai == "bi_an":
        qs = qs.filter(hidden_at__isnull=False)
    elif trang_thai == "bia_mo":
        qs = qs.filter(deleted_at__isnull=False)
    elif trang_thai == "hien":
        qs = qs.filter(deleted_at__isnull=True, hidden_at__isnull=True)

    tong = dem_tong(qs)

    try:
        moc_cursor = _doc_cursor(cursor)
    except CursorHong as e:
        return loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")
    if moc_cursor is not None:
        khi, id = moc_cursor
        qs = loc_keyset(qs, truong="created_at", khi=khi, id=id, giam_dan=True)

    hang = list(qs.order_by("-created_at", "-pk")[: limit + 1])
    trang, con_nua = cat_trang(hang, limit)
    ke_tiep = (
        ma_hoa_cursor(trang[-1].created_at, trang[-1].pk) if con_nua and trang else None
    )
    return TrangBinhLuanOut(
        items=[
            BinhLuanDongOut(
                id=c.pk,
                mach_id=c.mach_id,
                mach_title=c.mach.title,
                tac_gia=nguoi_dung_ra(c.author),
                trich_yeu=trich_yeu(c.body),
                created_at=c.created_at,
                score=c.score,
                da_bi_an=c.hidden_at is not None,
                da_xoa=c.deleted_at is not None,
                duong_dan_cong_khai=duong_dan_mach(c.mach),
            )
            for c in trang
        ],
        cursor_ke_tiep=ke_tiep,
        tong=tong,
    )


@router.get(
    "/users",
    response={200: TrangNguoiDungOut, **TRA_LOI_BANG},
    operation_id="quan_tri_liet_ke_nguoi_dung",
    tags=["quan-tri-bang"],
)
def liet_ke_nguoi_dung(
    request,
    response: HttpResponse,
    q: str = "",
    trang_thai: LocNguoiDung = "tat_ca",
    limit: int = GIOI_HAN_MAC_DINH,
    cursor: str | None = None,
):
    """Bảng tài khoản, mới đăng ký trước, cursor keyset `(date_joined, id)`.

    `?q=` khớp một phần trên `username` **hoặc** `display_name`. Cố ý **không** tìm theo
    email: khu quản trị không cần nó để phán xử nội dung, và một ô tìm-theo-email là cách
    rẻ nhất để một mod tra ngược địa chỉ của một người từ một mẩu địa chỉ đoán được.

    `trang_thai=bi_ban` dùng đúng điều kiện của `User.dang_bi_ban()` — vĩnh viễn **hoặc**
    hạn tạm chưa qua. Viết lại điều kiện ấy ở đây là bản sao thứ hai, nên nó được đặt cạnh
    một bài đo ghim rằng hai bên không lệch nhau
    (`tests/test_api_quan_tri_bang.py::test_loc_bi_ban_trung_voi_dang_bi_ban`).

    ## Staff biến khỏi ba bộ lọc kia — 2026-08-26

    `tat_ca` / `bi_ban` / `moi` đều **loại `is_staff=True`**; chỉ `staff` còn thấy họ.
    User chốt *"2 mục này nên có phần quản lý riêng, đặt vào đây hơi khó hiểu và khó mà
    tìm được"* — hai hàng quản trị nằm lẫn giữa vài nghìn tài khoản thường là nhiễu ở cả
    hai chiều. Khu riêng là `/quan-tri-vien` ở `apps/admin`, nó gọi lại chính endpoint này
    với `trang_thai=staff`.

    ⚠ Đây là **đổi hành vi của một endpoint đang chạy**, không phải thêm tính năng.

    `so_staff_an` là cái giá phải trả cho phép loại ấy: sau lượt này, gõ `mod_gikky` vào ô
    lọc ra bảng rỗng, mà một bảng rỗng không phân biệt được "không có ai tên vậy" với
    "có, nhưng ở trang khác". Đếm **cùng `q`, cùng `trang_thai`**, chỉ khác điều kiện
    staff.
    """
    response["Cache-Control"] = "no-store"
    if (l := kiem_gioi_han(limit)) is not None:
        return l

    # `sub_dang_mod` cho `subs_mod` của `nguoi_dung_quan_tri_ra` (2026-08-25). Thiếu
    # prefetch là một truy vấn MỖI HÀNG — không nổ ở đâu, chỉ chậm dần theo số dòng.
    qs = User.objects.prefetch_related("sub_dang_mod__sub").annotate(
        # `distinct=True` trên cả hai: hai LEFT JOIN trong cùng một câu nhân chéo nhau,
        # nên một user 3 mạch + 4 bình luận sẽ ra `so_mach = 12`. Con số sai kiểu này
        # không nổ ở đâu cả — nó chỉ làm mod tin mình đang nhìn một tài khoản spam.
        _so_mach=Count("machs", distinct=True),
        _so_binh_luan=Count("comments", distinct=True),
    )
    if q:
        qs = qs.filter(Q(username__icontains=q) | Q(display_name__icontains=q))
    if trang_thai == "bi_ban":
        qs = qs.filter(
            Q(ban_permanent=True) | Q(banned_until__gt=timezone.now())
        )
    elif trang_thai == "staff":
        qs = qs.filter(is_staff=True)
    elif trang_thai == "moi":
        qs = qs.filter(
            date_joined__gte=timezone.now() - timedelta(days=NGAY_LA_MOI)
        )

    # ⚠ Phép loại staff phải đứng **TRƯỚC `dem_tong`**. Đếm trước rồi mới loại là `tong`
    # kể cả staff còn bảng thì không — đúng cái bẫy `phan_trang.py::dem_tong` cảnh báo,
    # và nó im lặng: chỉ là một con số lớn hơn số hàng đếm được, thứ không ai kiểm.
    #
    # `so_staff_an` đếm trên CÙNG `qs` (tức cùng `q`, cùng `trang_thai`), chỉ khác điều
    # kiện staff — nên nó luôn là "số hàng phép loại ngay dưới vừa lấy đi", không phải
    # "tổng số staff trên hệ thống". Hai con số ấy khác nhau ngay khi có `q`.
    #
    # `moi_nguoi` là lối thoát cho người gọi thật sự cần cả staff (ô gợi ý ở `/subs`) —
    # nó KHÔNG loại gì, nên `so_staff_an` cũng phải là 0: không có ai bị giấu thì không
    # có gì để báo là đã giấu.
    so_staff_an = 0
    if trang_thai not in ("staff", "moi_nguoi"):
        so_staff_an = dem_tong(qs.filter(is_staff=True))
        qs = qs.filter(is_staff=False)

    tong = dem_tong(qs)

    try:
        moc_cursor = _doc_cursor(cursor)
    except CursorHong as e:
        return loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")
    if moc_cursor is not None:
        khi, id = moc_cursor
        qs = loc_keyset(qs, truong="date_joined", khi=khi, id=id, giam_dan=True)

    hang = list(qs.order_by("-date_joined", "-pk")[: limit + 1])
    trang, con_nua = cat_trang(hang, limit)
    ke_tiep = (
        ma_hoa_cursor(trang[-1].date_joined, trang[-1].pk) if con_nua and trang else None
    )
    return TrangNguoiDungOut(
        items=[nguoi_dung_quan_tri_ra(u) for u in trang],
        cursor_ke_tiep=ke_tiep,
        tong=tong,
        so_staff_an=so_staff_an,
    )
