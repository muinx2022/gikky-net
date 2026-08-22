"""Trạng thái của NGƯỜI XEM trên một mạch: `/me`, `/seen`, `/follow` — PLAN 5.5, 5.7.

Ba endpoint, một chủ đề: **đây là nửa per-user của trang mạch**. Nửa kia là
`GET /machs/{id}` — response không chứa gì phụ thuộc người xem, nên nó cache được. PLAN
8.4 gọi chỗ này là "điểm dễ làm sai nhất", và cách làm sai đã được ghi sẵn ở
`tests/test_api_mach.py`: nhét `my_vote`/`following` vào response bên kia cho tiện. Trang
được ISR cache theo URL, nên người thứ hai mở cùng URL nhận trạng thái của người thứ nhất
— HTTP 200, không có gì đỏ.

Tách thành module riêng thay vì nhét vào `api/machs.py` chính vì ranh giới đó: file này
là chỗ **được phép** biết `request.user`, còn `api/machs.py::mach_chi_tiet_ra` thì không.
Hai luật ngược nhau nằm cạnh nhau trong một file là luật thứ hai sẽ bị quên.

⚠ **Không endpoint nào ở đây gọi `doi_mach_tuong_tac_duoc`, và đó là chủ đích** — xem
docstring `core.ghi.bo_follow`. Tóm tắt: follow và vị trí đọc là sổ tay riêng của người
đọc (không sinh chữ, không đổi con số nào của mạch, không ai khác nhìn thấy), còn chặn
`DELETE /follow` trên một mạch bị khoá thì có hại thật — người ta không tắt được thông
báo của chính cái mạch mod vừa phải khoá lại.
"""

from ninja import Router

from core.ghi import bo_follow, dat_da_xem, dat_follow
from core.mat import tinh_mat_cho_viewer, tinh_mat_theo_thoi_gian
from core.models.binh_luan import Comment
from core.models.moc import Moc
from core.models.tuong_tac import Follow, Reaction, Vote

from api.ghi_chung import nap_mach
from api.loi import LoiOut, khong_tim_thay
from api.quyen import dang_nhap
from api.schemas import (
    DaXemOut,
    MachCuaToiOut,
    ReactionCuaToiOut,
    TheoMachOut,
    VoteCuaToiOut,
)
from api.schemas_ghi import DaXemIn

router = Router()


@router.get(
    "/machs/{int:mach_id}/me",
    response={200: MachCuaToiOut, 404: LoiOut},
    operation_id="xem_mach_cua_toi",
    tags=["mach"],
)
def xem_mach_cua_toi(request, mach_id: int):
    """Trạng thái của **người đang xem** trên mạch này — PLAN mục 7, 8.4 điểm 4.

    **Không bao giờ cache được.** Đây là nửa per-user của trang mạch: phiếu của tôi,
    reaction của tôi, tôi có theo mạch không, tôi đọc tới mốc nào. Client component gọi nó
    **sau khi** trang đã render từ cache; tuyệt đối không nướng nội dung này vào HTML.

    **Khách chưa đăng nhập nhận 200**, không phải 401 — hai danh sách rỗng,
    `following = false`, `last_seen_entry_seq = 0`. Cùng lý lẽ `GET /me` (PLAN mục 7):
    endpoint này chạy trên MỌI lượt tải trang mạch, kể cả của bot, nên trả lỗi cho trạng
    thái bình thường nhất của hệ thống là dạy frontend coi lỗi là chuyện thường. `face` của
    khách vì thế bằng đúng `face` của `GET /machs/{id}`.

    `face` ở đây áp **đủ hai vế** của PLAN 5.5: vế thời gian, HOẶC "user đăng nhập VÀ đã
    follow hoặc từng bình luận mạch này". Vì là phép HOẶC nên nó chỉ kéo được CẶN → BÃO.
    Server quyết, frontend không tính lại (PLAN nguyên tắc 10).

    Mạch bị mod ẩn ⇒ **404**, cùng mã với mọi cửa công khai khác: trả trạng thái viewer cho
    một mạch đã bị gỡ là xác nhận nó tồn tại.

    Không cần đăng nhập nên **không khai `auth=`** — nó là endpoint GET, không có gì để
    CSRF bảo vệ, và luật "mọi operation không-GET phải có auth"
    (`tests/test_quyen_ghi.py`) vì thế không đụng tới nó.
    """
    mach = _mach_hien(mach_id)
    if mach is None:
        return khong_tim_thay(f"mạch {mach_id}")

    mat_thoi_gian = tinh_mat_theo_thoi_gian(
        status=mach.status,
        locked_at=mach.locked_at,
        last_activity_at=mach.last_activity_at,
    )
    user = request.user
    if not user.is_authenticated:
        return _khach(mat_thoi_gian)

    theo = Follow.objects.filter(user=user, mach=mach).first()
    tung_binh_luan = Comment.objects.filter(mach=mach, author=user).exists()
    return MachCuaToiOut(
        dang_nhap=True,
        face=tinh_mat_cho_viewer(
            mat_theo_thoi_gian=mat_thoi_gian,
            dang_nhap=True,
            dang_follow=theo is not None,
            tung_binh_luan=tung_binh_luan,
        ),
        my_votes=_phieu_cua_toi(user, mach),
        my_reactions=[
            ReactionCuaToiOut(moc_id=r.moc_id, emoji=r.emoji)
            for r in Reaction.objects.filter(user=user, moc__mach=mach).order_by("moc_id")
        ],
        following=theo is not None,
        last_seen_entry_seq=theo.last_seen_entry_seq if theo else 0,
        tung_binh_luan=tung_binh_luan,
    )


def _mach_hien(mach_id: int):
    """Mạch công khai theo `id`. Ẩn bởi mod ⇒ coi như không tồn tại (PLAN 5.10).

    Không dùng `api/machs.py::_mach_hien` (import chéo giữa hai router) và không
    `select_related` gì: endpoint này không render `sub`/`author`, nó chỉ cần bốn cột của
    chính hàng `Mach` để tính `face`.
    """
    from core.models.dien_dan import Mach

    return Mach.objects.filter(pk=mach_id, hidden_at__isnull=True).first()


def _khach(mat_thoi_gian) -> MachCuaToiOut:
    """Hình dạng cho khách. Tách hàm để không có hai bản rỗng lệch nhau (như `ToiOut`)."""
    return MachCuaToiOut(
        dang_nhap=False,
        face=mat_thoi_gian,
        my_votes=[],
        my_reactions=[],
        following=False,
        last_seen_entry_seq=0,
        tung_binh_luan=False,
    )


def _phieu_cua_toi(user, mach) -> list[VoteCuaToiOut]:
    """Mọi phiếu của `user` trên mốc VÀ bình luận của `mach` — **hai truy vấn, không N+1**.

    `Vote` cố ý không có FK tới đích (xem `core/models/tuong_tac.py`), nên không join được
    và cũng không lọc được bằng `moc__mach=`. Cách còn lại là lấy trước tập id của mạch rồi
    hỏi `target_id__in` — hai câu `values_list` cộng hai câu `Vote`, tức **bốn** câu cho cả
    trang, không phụ thuộc số mốc hay số bình luận.

    Cái phải tránh: một vòng lặp `for moc in mach.mocs: Vote.objects.filter(...)`. Nó đúng
    kết quả, và nó là N+1 trên đúng endpoint được gọi ở mọi lượt tải trang mạch.
    """
    moc_ids = list(Moc.objects.filter(mach=mach).values_list("pk", flat=True))
    comment_ids = list(Comment.objects.filter(mach=mach).values_list("pk", flat=True))
    ra: list[VoteCuaToiOut] = []
    for loai, ids in ((Vote.Loai.MOC, moc_ids), (Vote.Loai.COMMENT, comment_ids)):
        if not ids:
            continue
        ra.extend(
            VoteCuaToiOut(target_type=loai, target_id=tid, value=gia_tri)
            for tid, gia_tri in Vote.objects.filter(
                user=user, target_type=loai, target_id__in=ids
            )
            .order_by("target_id")
            .values_list("target_id", "value")
        )
    return ra


@router.post(
    "/machs/{int:mach_id}/seen",
    response={200: DaXemOut, 401: LoiOut, 403: LoiOut, 404: LoiOut},
    operation_id="danh_dau_da_xem",
    tags=["mach"],
    auth=dang_nhap,
)
def danh_dau_da_xem(request, mach_id: int, du_lieu: DaXemIn):
    """Ghi vị trí đọc — nền của **vạch mới** ở mặt BÃO (PLAN 5.5).

    **Quyền: bất kỳ ai đã đăng nhập, và chỉ ghi vào hàng `Follow` của CHÍNH HỌ.** Không có
    tham số nào chỉ ra người khác, nên không có đường nào đặt vị trí đọc hộ ai.

    `entry_seq` vắng mặt ⇒ "đã xem tới mốc mới nhất", đúng ca PLAN 5.5 mô tả (thẻ mốc mới
    nhất mở sẵn khi trang mở). Con số **chỉ tiến không lùi** và bị kẹp trần ở `entry_count`
    — mở lại một mốc cũ trên spine không được kéo vạch mới về sau.

    **Chưa theo mạch ⇒ 200 kèm `following: false`, và KHÔNG ghi gì.**
    `last_seen_entry_seq` sống trên hàng `Follow` (PLAN mục 6) nên người chưa theo không có
    chỗ nào để lưu. Không tạo `Follow` hộ: đó là âm thầm bắt người ta theo mạch vì họ mở
    một trang. Không trả 404: client sẽ phải hỏi trước xem mình có theo không, tức thêm một
    round-trip cho một cái bookmark. Response nói thẳng là không lưu gì.

    Mạch bị mod **khoá** vẫn gọi được — xem docstring module.
    """
    mach = nap_mach(mach_id)
    theo = dat_da_xem(user=request.user, mach=mach, entry_seq=du_lieu.entry_seq)
    return DaXemOut(
        following=theo is not None,
        last_seen_entry_seq=theo.last_seen_entry_seq if theo else 0,
    )


@router.post(
    "/machs/{int:mach_id}/follow",
    response={200: TheoMachOut, 401: LoiOut, 403: LoiOut, 404: LoiOut},
    operation_id="theo_mach",
    tags=["mach"],
    auth=dang_nhap,
)
def theo_mach(request, mach_id: int):
    """Theo mạch — "Theo mạch", PLAN 5.7. Follower nhận thông báo khi có mốc mới.

    **Quyền: bất kỳ ai đã đăng nhập**, kể cả tác giả trên mạch của chính mình (vô hại:
    `core/thong_bao.py::bao_moc_moi` loại người viết ra khỏi danh sách nhận, nên tự theo
    không sinh chuông nào). Chỉ ghi vào hàng của chính người gọi.

    **Idempotent**: bấm lần thứ hai trả về đúng trạng thái cũ, và **không** đụng
    `last_seen_entry_seq` — hàng đã có nghĩa là vị trí đọc đã có, ghi đè nó là xoá dấu đọc
    dở của chính người đang bấm.

    Lượt theo ĐẦU TIÊN đặt `last_seen_entry_seq = entry_count`, không phải `0`: người ta
    theo để biết chuyện **sắp** xảy ra (xem `core.ghi.dat_follow`).

    Mạch bị mod **khoá** vẫn theo được — xem docstring module.
    """
    mach = nap_mach(mach_id)
    theo = dat_follow(user=request.user, mach=mach)
    return TheoMachOut(
        mach_id=mach.pk,
        following=True,
        last_seen_entry_seq=theo.last_seen_entry_seq,
    )


@router.delete(
    "/machs/{int:mach_id}/follow",
    response={200: TheoMachOut, 401: LoiOut, 403: LoiOut, 404: LoiOut},
    operation_id="bo_theo_mach",
    tags=["mach"],
    auth=dang_nhap,
)
def bo_theo_mach(request, mach_id: int):
    """Bỏ theo mạch — PLAN 5.7. **Idempotent**: bỏ theo thứ vốn không theo vẫn là 200.

    **Quyền: bất kỳ ai đã đăng nhập**, và chỉ xoá được hàng của chính họ.

    Trả `following: false` và `last_seen_entry_seq: 0`. Con số `0` ở đây nói đúng sự thật:
    hàng `Follow` bị xoá nên vị trí đọc mất theo, và theo lại là bắt đầu từ `entry_count`
    lúc đó (xem `core.ghi.bo_follow`).

    Mạch bị mod **khoá** vẫn bỏ theo được, và cửa này là lý do chính của quyết định ấy —
    xem docstring module.
    """
    mach = nap_mach(mach_id)
    bo_follow(user=request.user, mach=mach)
    return TheoMachOut(mach_id=mach.pk, following=False, last_seen_entry_seq=0)
