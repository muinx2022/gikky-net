"""Hồ sơ công khai `/u/<username>` — PLAN 5.9, mục 7."""

from ninja import Router

from core.doc_noi_dung import TRICH_CON_HIEN
from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.models.moc import Moc
from core.models.nguoi_dung import User
from core.models.tuong_tac import Trich

from api.loi import LoiOut, khong_tim_thay
from api.phan_trang import kiem_gioi_han
from api.schemas import HoSoOut
from api.trinh_bay import mach_tom_tat_ra

router = Router()

#: Số mạch trả kèm hồ sơ. Hồ sơ chưa có cursor ở bản này — thêm khi có người dùng thật
#: vượt con số này, và lúc đó thêm bằng cùng cơ chế keyset của feed.
SO_MACH_TREN_HO_SO = 20


@router.get(
    "/users/{username}",
    response={200: HoSoOut, 400: LoiOut, 404: LoiOut},
    operation_id="xem_ho_so",
    tags=["nguoi-dung"],
)
def xem_ho_so(request, username: str, limit: int = SO_MACH_TREN_HO_SO):
    """Hồ sơ công khai: mạch của họ, "Được trích ×N", tổng mốc, tổng bình luận.

    Ba con số đếm **nội dung đọc được**: mốc/bình luận đã xoá hoặc bị ẩn không tính, và
    nội dung nằm trong một mạch đã bị mod ẩn cũng không tính.

    `duoc_trich` đếm theo **số chủ mạch khác nhau** đã trích bình luận của người này, chỉ
    tính trích còn hiệu lực — rào 3 của PLAN 5.6, chống hai nick trích qua lại để tự nâng
    chỉ số cho nhau. Nó **soi gương đúng cái blockquote** trên thẻ mốc: đếm khi khối trích
    còn hiện, không đếm khi khối trích biến mất. Mạch bị mod ẩn, mốc nhận trích bị ẩn hoặc
    xoá, hay chính bình luận bị **mod ẩn** đều làm khối trích biến mất ⇒ không đếm. Thiếu
    bốn bộ lọc ấy thì mod ẩn cả một mạch làm `so_mach`/`so_moc`/`so_binh_luan` về 0 trong
    khi "Được trích ×1" vẫn sáng trên hồ sơ — đúng cái "máy in địa vị" mà rào 3 dựng lên
    để chặn. Bộ lọc ấy là `core.doc_noi_dung.TRICH_CON_HIEN`, dùng chung với "câu đáng
    đọc" của PLAN 5.5.

    **TỰ TRÍCH KHÔNG TÍNH** *(rào 3, chốt 2026-08-22)*: chủ mạch trích bình luận của
    chính mình thì chỉ số của họ không nhúc nhích. Chỉ số này đo *"có bao nhiêu người
    KHÁC thấy chữ của bạn đáng ghi vào sổ"*; tự trích trả lời câu hỏi khác hẳn, và nó là
    đường ngắn nhất tới cùng con số — không cần nick thứ hai, không cần ai đồng ý. Khối
    blockquote vẫn hiện đầy đủ trên thẻ mốc, chỉ có chỉ số hồ sơ là không cộng.

    **Tác giả TỰ xoá bình luận thì `duoc_trich` KHÔNG tụt**, và đó là chỗ con số này cố ý
    lệch khỏi ba con số trên. `trinh_bay.trich_ra` giữ nguyên body của blockquote trong ca
    ấy, vì PLAN 5.6 dựng "cuốn sổ không-xoá-được" để chống *tác giả* rút chữ, không phải
    để chống *mod* gỡ nội dung. Đếm tụt ở đây là hai cửa nói hai chuyện về cùng một sự
    kiện: khối trích còn nguyên chữ trên trang mạch mà chỉ số trên hồ sơ đã giảm thì không
    con số nào giải thích được nữa.

    `?limit=` cắt số mạch trả kèm, mặc định 20, tối đa 50. Hồ sơ **chưa có cursor** ở
    bản này: quá `limit` mạch thì phần dôi ra không có đường nào lấy tiếp.

    Endpoint này **không** trả email, trạng thái ban hay bất cứ thứ gì chỉ chủ tài khoản
    được thấy.
    """
    if (l := kiem_gioi_han(limit)) is not None:
        return l

    user = User.objects.filter(username=username).first()
    if user is None:
        return khong_tim_thay(f"người dùng {username!r}")

    mach_hien = Mach.objects.filter(author=user, hidden_at__isnull=True)
    machs = list(
        mach_hien.select_related("sub", "author").order_by("-created_at", "-pk")[:limit]
    )
    doc_duoc = {
        "deleted_at__isnull": True,
        "hidden_at__isnull": True,
        "mach__hidden_at__isnull": True,
    }
    return HoSoOut(
        username=user.username,
        display_name=user.display_name,
        bio=user.bio,
        date_joined=user.date_joined,
        so_mach=mach_hien.count(),
        so_moc=Moc.objects.filter(author=user, **doc_duoc).count(),
        so_binh_luan=Comment.objects.filter(author=user, **doc_duoc).count(),
        # `values(...).distinct().count()` chứ không phải `.count()` trần: đếm số HÀNG
        # `Trich` là đếm số LẦN được trích, và hai nick trích qua lại sẽ tự bơm chỉ số
        # cho nhau. `moc__mach__author` là người trích — chủ mạch nhận bình luận vào sổ.
        #
        # KHÔNG dùng lại `doc_duoc` ở trên dù trông gần giống: `TRICH_CON_HIEN` cố ý
        # **thiếu `comment__deleted_at`** — lý do ở docstring của nó và ở docstring
        # endpoint này. Từ 2026-08-22 nó là bộ lọc DÙNG CHUNG với `tap_dang_duoc_trich`
        # ("câu đáng đọc"): hai chỗ soi cùng một khối blockquote thì phải hỏi cùng một
        # định nghĩa, chứ không phải hai bản chép tay lệch nhau bốn điều kiện.
        #
        # `.exclude(moc__mach__author=user)` là rào 3 của PLAN 5.6, vế "KHÔNG tính tự
        # trích" *(chốt 2026-08-22)*: chủ mạch trích bình luận của chính mình không được
        # cộng vào chỉ số của chính họ. Rào 3 dựng lên để chặn "máy in địa vị", mà tự
        # trích là cái máy in ngắn nhất — không cần nick thứ hai, không cần ai đồng ý.
        duoc_trich=(
            Trich.objects.filter(comment__author=user, **TRICH_CON_HIEN)
            .exclude(moc__mach__author=user)
            .values("moc__mach__author")
            .distinct()
            .count()
        ),
        machs=[mach_tom_tat_ra(m) for m in machs],
    )
