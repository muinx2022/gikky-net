"""Ba cửa danh sách của trang hồ sơ `/u/<username>` — `Bài viết` · `Đã vote` · `Đang theo`.

`GET /users/{username}` (`api/users.py`) trả **một trang hồ sơ**: bốn con số đếm cộng 20
mạch đầu, không cursor. Ba cửa ở đây trả **danh sách lật được**, mỗi cửa nuôi một tab.
Tách khỏi `users.py` vì hai lý do có thật, không vì độ dài file:

1. Hai trong ba cửa là **per-user tuyệt đối** (`/me/*`, `Cache-Control: no-store`), còn
   `users.py` là cửa công khai cache được. Trộn hai loại vào một module là mời lượt sau
   thêm một trường per-user vào đúng cái response đang được cache theo URL — đúng lỗi mà
   PLAN 8.4 dựng ranh giới để chặn, và nó không đỏ ở đâu cả.
2. Ba cửa này đọc mạch qua một **đường vòng** (qua `Vote`, qua `Follow`, qua `author`) nên
   luật che phải được áp lại bằng tay ở từng cửa. Lý lẽ ấy đáng đọc một mình.

## Luật che — chỗ nguy hiểm nhất của cả module

Không cửa nào ở đây bắt đầu từ `Mach`; chúng bắt đầu từ một bảng khác rồi đi ngược về
mạch. Một cửa quên lọc là **cửa hậu đọc nội dung mod vừa gỡ**, trả HTTP 200, không có gì
đỏ. Vì thế cả ba đi qua đúng một hàm — `_mach_hien()` — và không cửa nào tự viết điều
kiện.

⚠ **`Mach` KHÔNG có cột `deleted_at`** (chỉ `hidden_at`; xem `core/models/dien_dan.py`).
Mạch biến mất là `DELETE` thật, và hệ quả khác nhau ở hai cửa `/me/*`:

- `Follow.mach` là FK `CASCADE` ⇒ hàng theo dõi đi theo mạch, không cần lọc gì thêm;
- `Vote` **không có FK** (`target_type` + `target_id` — xem docstring `Vote`), nên phiếu
  trỏ vào mốc của mạch đã xoá **nằm lại vĩnh viễn**. Cửa `da-vote` vì thế không được đi
  từ `Vote` ra thẳng: nó lọc `target_id` qua đúng tập mốc 1 còn đọc được, và hàng mồ côi
  rơi ra ngay trong SQL. Bỏ phép lọc ấy thì mỗi phiếu mồ côi là một `KeyError` — tức 500
  trên trang hồ sơ của chính người đã vote.

## Khoá keyset

`(mốc thời gian, id)` giảm dần ở cả ba, nhưng **cột nào là chỗ dễ sai nhất**:

- `/users/{username}/machs` → `Mach.published_at` (lúc bài LÊN SÓNG — 2026-09-04). Bài
  soạn trước, đăng sau phải đứng đúng chỗ ngày đăng, không chôn ở đáy theo ngày soạn.
  Cột này ổn định trên tập đang liệt kê: cửa chỉ trả bài `hidden_at IS NULL`, và bài đã
  phát hành không được sửa `published_at` (plan hẹn giờ §6);
- `/me/da-vote` → `Vote.created_at`, `/me/dang-theo` → `Follow.created_at` — tức **thời
  điểm TÔI vote / TÔI theo**, không phải lúc mạch ra đời. Thứ tự người ta mong đợi ở tab
  "Đã vote" là thứ tự họ vote; và quan trọng hơn, `Mach.published_at` của một hàng đọc qua
  `Vote` không phải khoá của tập đang sắp — cắt theo nó là cắt theo một cột không đơn
  điệu trên thứ tự trả về, tức trùng dòng và sót dòng, HTTP 200.

Hai cửa `/me/*` dùng khoá **BẤT BIẾN** (`Vote`/`Follow`.created_at, `editable=False`).
`diem_bai_goc` thì không thoả — đừng thêm `?sort=` theo điểm vào đây mà không đọc
docstring `api/phan_trang.py`.
"""

from django.db.models import QuerySet
from django.http import HttpResponse
from ninja import Router

from core.models.dien_dan import Mach
from core.models.moc import Moc
from core.models.nguoi_dung import User
from core.models.tuong_tac import Follow, Vote

from api.loi import CURSOR_KHONG_HOP_LE, LoiOut, khong_tim_thay, loi
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
from api.schemas import FeedOut
from api.trinh_bay import du_lieu_the, mach_tom_tat_ra

router = Router()

#: Cửa công khai: `limit` sai là 400, username lạ là 404.
TRA_LOI_CONG_KHAI = {200: FeedOut, 400: LoiOut, 404: LoiOut}
#: Hai cửa `/me/*`: không có path param nào để 404, nhưng khách là 401.
TRA_LOI_CUA_TOI = {200: FeedOut, 400: LoiOut, 401: LoiOut}


def _mach_hien() -> QuerySet:
    """Mạch được phép hiện ra cửa công khai — **một định nghĩa cho cả ba cửa**.

    Cùng điều kiện với `api/feeds.py::_mach_hien` và với `api/users.py::xem_ho_so`:
    `hidden_at IS NULL` là bộ lọc bảo vệ duy nhất của `Mach`, và mạch bị mod ẩn không
    được xuất hiện ở bất kỳ danh sách nào (PLAN 5.10).

    `select_related` ở đây chứ không ở từng chỗ gọi: `mach_tom_tat_ra` đọc `mach.sub` và
    `mach.author` cho **mỗi** thẻ, nên thiếu nó là N+1 hai lần trên mọi trang — và nó
    không đỏ ở đâu ngoài `tests/test_api_so_query.py`.
    """
    return Mach.objects.filter(hidden_at__isnull=True).select_related("sub", "author")


def _the_ra(machs) -> list:
    """Một trang mạch → danh sách thẻ. Mọi thứ cần DB đều nạp theo LÔ — HAI truy vấn.

    Cùng lối `api/feeds.py::_the_ra`: `mach_tom_tat_ra` cố ý không tự truy vấn, nên
    `moc_1_id` (đích mũi tên vote) và `xem_truoc` (nội dung thẻ) phải do người gọi gom
    sẵn. Gọi `du_lieu_the` trong list comprehension là N+1 đúng nghĩa.

    `du_lieu_the` cũng là chỗ luật che của **mốc 1** được áp: bia mộ và mốc bị mod ẩn trả
    `xem_truoc = None`. Module này không lặp lại phép kiểm ấy.
    """
    theo_mach = du_lieu_the(machs)
    return [
        mach_tom_tat_ra(m, moc_1_id=moc_1_id, xem_truoc=xem_truoc)
        for m in machs
        for moc_1_id, xem_truoc in [theo_mach.get(m.pk, (None, None))]
    ]


def _cat_keyset(
    qs: QuerySet, *, cursor: str | None, limit: int, truong: str = "created_at"
):
    """Áp cursor rồi lấy dư một hàng. Trả `(hàng, còn_nữa, None)` hoặc `(None, None, lỗi)`.

    Khoá là `truong` **của bảng `qs` đang đứng** — xem khối "Khoá keyset" ở đầu module.
    Mặc định `created_at` cho Vote/Follow; cửa mạch của user truyền `published_at`.
    Hàm tự `order_by` cùng cột đó: thứ tự và điều kiện cắt phải nói về cùng một cột thì
    keyset mới đúng, và tách hai việc ấy ra hai chỗ gọi là cách chúng lệch nhau.
    """
    if cursor is not None:
        try:
            khi, id = giai_ma_cursor(cursor)
        except CursorHong as e:
            return None, None, loi(400, CURSOR_KHONG_HOP_LE, f"Cursor không hợp lệ: {e}")
        qs = loc_keyset(qs, truong=truong, khi=khi, id=id, giam_dan=True)

    hang, con_nua = cat_trang(
        list(qs.order_by(f"-{truong}", "-pk")[: limit + 1]), limit
    )
    return hang, con_nua, None


def _ra(hang: list, machs: list, con_nua: bool, *, truong: str = "created_at") -> FeedOut:
    """Dựng `FeedOut`. `hang` mang khoá cursor, `machs` mang nội dung thẻ.

    Hai danh sách tách rời vì ở hai cửa `/me/*` chúng là hai loại hàng khác nhau: cursor
    phải mã hoá `(Vote|Follow).created_at`, còn thẻ vẽ từ `Mach`. Mã hoá cursor từ
    `machs[-1]` là đúng cái lỗi mà khối "Khoá keyset" ở đầu module nói tới.
    """
    ke_tiep = (
        ma_hoa_cursor(getattr(hang[-1], truong), hang[-1].pk)
        if con_nua and hang
        else None
    )
    return FeedOut(items=_the_ra(machs), cursor_ke_tiep=ke_tiep)


_TAI_LIEU_CHUNG = """
    `?cursor=` là cursor keyset lấy từ `cursor_ke_tiep` của trang trước; `null` là hết.
    `?limit=` tối đa 50. Mạch bị mod ẩn không xuất hiện.
"""

_MO_TA_MACH_CUA_USER = """Mạch của một người, mới đăng trước — tab **Bài viết** của
    `/u/<username>`.

    Cùng tập mạch mà `GET /users/{username}` trả kèm hồ sơ, nhưng **lật trang được**:
    cửa kia cắt ở `limit` mạch và không có đường lấy tiếp.

    Username không tồn tại trả 404 `khong_tim_thay`. Người dùng chưa viết gì trả danh
    sách rỗng — đó là một câu trả lời, không phải lỗi.
""" + _TAI_LIEU_CHUNG

_MO_TA_DA_VOTE = """Mạch **tôi đã vote bài gốc**, mới vote trước — tab **Đã vote**.

    "Vote một mạch" ở gikky là vote **mốc 1** (bài gốc — `Mach.diem_bai_goc`), đúng đích
    mà mũi tên trên thẻ feed trỏ tới. Phiếu bỏ cho mốc 2 trở đi hay cho một bình luận
    **không** đưa mạch vào danh sách này: chúng là phiếu cho một câu nói bên trong mạch,
    không phải cho bài.

    Cả phiếu lên và phiếu xuống đều tính — đây là "đã vote", không phải "đã thích". Rút
    phiếu (`POST /votes` với `value = 0`) xoá hàng vote, nên mạch rời khỏi danh sách ngay.

    Sắp theo **thời điểm tôi vote**, không theo lúc mạch ra đời.

    **Per-user tuyệt đối — `Cache-Control: no-store`** (PLAN 8.4 điểm 4). Khách nhận 401
    `chua_dang_nhap`.
""" + _TAI_LIEU_CHUNG

_MO_TA_DANG_THEO = """Mạch **tôi đang theo**, mới theo trước — tab **Đang theo**.

    Sắp theo **thời điểm tôi bấm theo**, không theo lúc mạch ra đời và cũng không theo
    mốc mới nhất: danh sách này là cái kệ sách của người dùng, không phải một feed.

    Bỏ theo (`DELETE /machs/{id}/follow`) xoá hàng, nên mạch rời khỏi danh sách ngay.

    **Per-user tuyệt đối — `Cache-Control: no-store`** (PLAN 8.4 điểm 4). Khách nhận 401
    `chua_dang_nhap`.
""" + _TAI_LIEU_CHUNG


@router.get(
    "/users/{username}/machs",
    response=TRA_LOI_CONG_KHAI,
    operation_id="liet_ke_mach_cua_user",
    description=_MO_TA_MACH_CUA_USER,
    tags=["nguoi-dung"],
)
def liet_ke_mach_cua_user(
    request,
    username: str,
    cursor: str | None = None,
    limit: int = GIOI_HAN_MAC_DINH,
):
    """Xem `_MO_TA_MACH_CUA_USER` — mô tả công khai nằm ở `description=` của decorator."""
    if (l := kiem_gioi_han(limit)) is not None:
        return l

    # Tra user trước rồi mới lọc mạch: `filter(author__username=…)` trên một username lạ
    # trả danh sách rỗng, mà rỗng trông y hệt "người này chưa viết gì". Một chữ gõ nhầm
    # trong URL sẽ thành một hồ sơ trống thay vì 404 — cùng lý lẽ với `feeds._kiem_sub`.
    user = User.objects.filter(username=username).first()
    if user is None:
        return khong_tim_thay(f"người dùng {username!r}")

    hang, con_nua, l = _cat_keyset(
        _mach_hien().filter(author=user),
        cursor=cursor,
        limit=limit,
        truong="published_at",
    )
    return l if l is not None else _ra(hang, hang, con_nua, truong="published_at")


@router.get(
    "/me/da-vote",
    response=TRA_LOI_CUA_TOI,
    operation_id="liet_ke_da_vote",
    description=_MO_TA_DA_VOTE,
    tags=["tai-khoan"],
    auth=dang_nhap,
)
def liet_ke_da_vote(
    request,
    response: HttpResponse,
    cursor: str | None = None,
    limit: int = GIOI_HAN_MAC_DINH,
):
    """Xem `_MO_TA_DA_VOTE` — mô tả công khai nằm ở `description=` của decorator."""
    # Đặt TRƯỚC mọi nhánh return, cùng lý do `api/tim_kiem.py` làm thế: `response` là
    # object dùng cho **mọi** mã trạng thái của endpoint, nên gán ở đây là gán cho cả
    # nhánh 400. Đặt ở cuối thì đúng nhánh lỗi lại đi ra không có header.
    response["Cache-Control"] = "no-store"

    if (l := kiem_gioi_han(limit)) is not None:
        return l

    # Lọc `target_id` qua tập mốc 1 CÒN ĐỌC ĐƯỢC, ngay trong SQL. Hai việc trong một
    # điều kiện, và cả hai đều bắt buộc: nó áp luật che (mạch bị mod ẩn không lọt ra) và
    # nó ném đi hàng `Vote` mồ côi (mạch đã bị xoá thật — `Vote` không có FK, xem
    # docstring đầu module). Lọc ở Python sau khi phân trang thì cả hai đều hỏng: một
    # trang 20 phiếu có thể trả về 3 thẻ, và `cursor_ke_tiep` thì vẫn nói "còn nữa".
    moc_1_hien = Moc.objects.filter(seq=1, mach__in=_mach_hien().values("pk"))
    phieu = Vote.objects.filter(
        user=request.user,
        target_type=Vote.Loai.MOC,
        target_id__in=moc_1_hien.values("pk"),
    )

    hang, con_nua, l = _cat_keyset(phieu, cursor=cursor, limit=limit)
    if l is not None:
        return l

    # MỘT truy vấn cho cả trang: mốc 1 kèm mạch (+ sub + author) của chúng. Hỏi lẻ từng
    # phiếu là N+1 trên đúng cửa mà một người dùng lâu năm sẽ cuộn nhiều nhất.
    theo_moc = {
        m.pk: m.mach
        for m in Moc.objects.filter(pk__in=[v.target_id for v in hang]).select_related(
            "mach__sub", "mach__author"
        )
    }
    # `if … in theo_moc` là lưới cho một ca đua hẹp: mạch bị ẩn giữa hai truy vấn. Nó
    # **không** phải chỗ luật che được áp — chỗ đó là `moc_1_hien` ở trên. Nếu lưới này
    # bắt được gì thì đó là một thẻ thiếu, không phải một thẻ rò.
    machs = [theo_moc[v.target_id] for v in hang if v.target_id in theo_moc]
    return _ra(hang, machs, con_nua)


@router.get(
    "/me/dang-theo",
    response=TRA_LOI_CUA_TOI,
    operation_id="liet_ke_dang_theo",
    description=_MO_TA_DANG_THEO,
    tags=["tai-khoan"],
    auth=dang_nhap,
)
def liet_ke_dang_theo(
    request,
    response: HttpResponse,
    cursor: str | None = None,
    limit: int = GIOI_HAN_MAC_DINH,
):
    """Xem `_MO_TA_DANG_THEO` — mô tả công khai nằm ở `description=` của decorator."""
    response["Cache-Control"] = "no-store"

    if (l := kiem_gioi_han(limit)) is not None:
        return l

    # `mach__in=_mach_hien()` chứ không `mach__hidden_at__isnull=True`: cùng một luật, và
    # nó phải đi qua đúng một hàm (xem đầu module). `select_related` nạp mạch + sub +
    # author cùng lượt — cả trang trong MỘT truy vấn.
    theo = Follow.objects.filter(
        user=request.user, mach__in=_mach_hien().values("pk")
    ).select_related("mach__sub", "mach__author")

    hang, con_nua, l = _cat_keyset(theo, cursor=cursor, limit=limit)
    if l is not None:
        return l
    return _ra(hang, [f.mach for f in hang], con_nua)
