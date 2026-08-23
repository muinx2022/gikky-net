"""Vote và reaction — PLAN mục 7, 5.7. Toàn bộ file là đường GHI (Phase 2).

Hai endpoint này khác mọi đường ghi khác ở một điểm và điểm đó quyết định cách viết
chúng: **ai cũng làm được, trên nội dung của người khác**. Không có phép kiểm "chủ sở
hữu" nào cả — vote vào bài của chính mình hay của người lạ đều hợp lệ. Vì thế phần *phân
quyền* ở đây mỏng, còn phần phải chặt là *tính toàn vẹn của con số*: mỗi user đúng một
phiếu mỗi đích, và count của đích cập nhật trong CÙNG transaction (PLAN mục 6).
"""

from django.core.exceptions import ValidationError as LoiModel
from django.db.models import Count
from ninja import Router

from core.ghi import dat_reaction, dat_vote
from core.models.binh_luan import Comment
from core.models.moc import Moc
from core.models.tuong_tac import Reaction, Vote

from api.ghi_chung import doi_con_song, nap_moc
from api.loi import KHONG_TIM_THAY, LoiOut
from api.quyen import (
    DU_LIEU_KHONG_HOP_LE,
    LoiGhi,
    dang_nhap,
    doi_mach_tuong_tac_duoc,
)
from api.schemas import ReactionOut, VoteOut
from api.trinh_bay import dem_reaction_rong
from api.schemas_ghi import ReactionIn, VoteIn

router = Router()


@router.post(
    "/votes",
    response={200: VoteOut, 400: LoiOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="dat_vote",
    tags=["tuong-tac"],
    auth=dang_nhap,
)
def dat_vote_api(request, du_lieu: VoteIn):
    """Vote ±1 trên **mốc hoặc bình luận**, hai trục riêng rẽ (PLAN 5.7).

    **Quyền: bất kỳ ai đã đăng nhập** — kể cả trên nội dung của chính mình (PLAN 5.7 chốt
    tác giả có sẵn +1 của mình, và rút được như mọi phiếu khác). Chặn duy nhất: mạch bị
    mod **khoá** ⇒ 403 `mach_bi_khoa`; đích đã bị gỡ ⇒ 409 `noi_dung_da_go` — số phiếu
    của bia mộ không được trả ra (`trinh_bay.nut_ra` zero hoá nó), nên nhận thêm phiếu vào
    đó là ghi vào một con số không ai đọc được.

    `value ∈ {-1, 0, 1}`; **`0` nghĩa là RÚT** — hàng `Vote` bị xoá, không lưu `0`.
    Vote lại cùng giá trị là no-op (idempotent), không cộng dồn.

    Trả về **con số mới của đích**, không chỉ "ok": UI vote lạc quan cần một nguồn sự thật
    để đối chiếu, nếu không hai cú bấm nhanh để lại một con số client tự cộng.

    Mạch **đã đóng sổ vẫn vote được** — đóng sổ chỉ chặn nối mốc (PLAN 5.1).
    """
    if du_lieu.target_type not in Vote.Loai.values:
        raise LoiGhi(
            400,
            DU_LIEU_KHONG_HOP_LE,
            f"target_type phải thuộc {Vote.Loai.values}, nhận {du_lieu.target_type!r}.",
        )

    la_moc = du_lieu.target_type == Vote.Loai.MOC
    if la_moc:
        dich = (
            Moc.objects.filter(pk=du_lieu.target_id, mach__hidden_at__isnull=True)
            .select_related("mach")
            .first()
        )
    else:
        dich = (
            Comment.objects.filter(pk=du_lieu.target_id, mach__hidden_at__isnull=True)
            .select_related("mach")
            .first()
        )
    if dich is None:
        raise LoiGhi(
            404,
            KHONG_TIM_THAY,
            f"Không tìm thấy {du_lieu.target_type} {du_lieu.target_id}.",
        )
    doi_mach_tuong_tac_duoc(dich.mach)
    doi_con_song(dich, "Mốc" if la_moc else "Bình luận")

    try:
        dat_vote(user=request.user, target=dich, value=du_lieu.value)
    except LoiModel as e:
        raise LoiGhi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages)) from e

    dich.refresh_from_db()
    return VoteOut(
        target_type=du_lieu.target_type,
        target_id=dich.pk,
        value=du_lieu.value,
        score=dich.score,
        # Mốc chỉ lưu `score` (PLAN mục 6) ⇒ `null`, KHÔNG phải `0`: `0` đọc ra là "không
        # ai vote lên", một câu trả lời sai cho một câu hỏi không đặt được với mốc.
        up_count=None if la_moc else dich.up_count,
        down_count=None if la_moc else dich.down_count,
    )


@router.post(
    "/mocs/{int:moc_id}/reactions",
    response={200: ReactionOut, 400: LoiOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="dat_reaction",
    tags=["tuong-tac"],
    auth=dang_nhap,
)
def dat_reaction_api(request, moc_id: int, du_lieu: ReactionIn):
    """Reaction 1 chạm trên mốc — bộ **CỐ ĐỊNH** 📈📉🔥🧊🎯 (PLAN 5.7).

    **Quyền: bất kỳ ai đã đăng nhập**, kể cả trên mốc của chính mình. Mạch bị mod khoá ⇒
    403; mốc đã bị gỡ ⇒ 409.

    Một user **một** reaction mỗi mốc (`UNIQUE (user, moc)`) — đổi là `UPDATE`, không phải
    thêm hàng: đây là "bậc thang tham gia rẻ hơn viết", không phải phiếu bầu nhiều lựa
    chọn. `emoji = null` nghĩa là **rút**.

    Trả về **đủ 5 khoá kể cả khoá đang bằng 0**: UI vẽ nguyên bộ, và một khoá vắng mặt
    trong response sẽ thành một icon nhấp nháy xuất hiện/biến mất theo lượt bấm.
    Lưu khoá không dấu (`len`/`xuong`/…) chứ không lưu emoji — đổi bộ icon sau này không
    phải migrate dữ liệu.
    """
    moc = nap_moc(moc_id)
    doi_mach_tuong_tac_duoc(moc.mach)
    doi_con_song(moc, "Mốc")
    try:
        dat_reaction(user=request.user, moc=moc, emoji=du_lieu.emoji)
    except LoiModel as e:
        raise LoiGhi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages)) from e
    return ReactionOut(moc_id=moc.pk, emoji=du_lieu.emoji, dem=dem_reaction(moc))


def dem_reaction(moc: Moc) -> dict[str, int]:
    """Số reaction theo từng khoá, **đủ 5 khoá kể cả khoá 0** — xem endpoint ở trên."""
    thuc = dict(
        Reaction.objects.filter(moc=moc)
        .values_list("emoji")
        .annotate(n=Count("pk"))
    )
    return {khoa: thuc.get(khoa, 0) for khoa in Reaction.Emoji.values}


def dem_reaction_theo_mach(mach) -> dict[int, dict[str, int]]:
    """`{moc_id: {khoá: số}}` cho CẢ mạch bằng **một** truy vấn.

    Trang mạch render 9–21 thẻ mốc; gọi `dem_reaction` trong vòng lặp là 21 truy vấn thừa
    mỗi lượt tải trang mạch — endpoint nặng nhất của sản phẩm.
    `tests/test_api_so_query.py::SO_QUERY["xem_mach"]` ghim con số này, nên một lượt vá
    sau vô tình biến nó thành N+1 sẽ đỏ chứ không chỉ chậm.

    Chỉ trả khoá cho mốc **có ít nhất một** reaction; người gọi rơi về
    `dem_reaction_rong()` cho phần còn lại.
    """
    ra: dict[int, dict[str, int]] = {}
    for moc_id, emoji, n in (
        Reaction.objects.filter(moc__mach=mach)
        .values_list("moc_id", "emoji")
        .annotate(n=Count("pk"))
    ):
        ra.setdefault(moc_id, dem_reaction_rong())[emoji] = n
    return ra
