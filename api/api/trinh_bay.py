"""Model → schema, và là nơi luật che được ÁP lên hình dạng response.

**Không phải nơi duy nhất biết che**, đừng đọc mạnh hơn: `api/mocs.py` cũng tự hỏi
`doc_duoc(moc)` để quyết `question_for_crowd` và để trả 404 cho `/revisions` của bia mộ.
Điểm chung là cả hai đều hỏi **cùng một hàm** ở `core/doc_noi_dung.py` chứ không tự viết
lại điều kiện.

Vì sao gom việc DỰNG SCHEMA lại đây thay vì để mỗi endpoint tự làm: bia mộ phải mất
`body` ở CẢ bốn đường (`GET /machs/{id}`, khán đài, ngăn kéo, spine). Bốn bản sao của
cùng một luật che thì bản thứ tư là bản quên — và quên ở đây nghĩa là nội dung bị mod ẩn
hiện ra cho cả internet, HTTP 200, không có gì đỏ.

Luật che của `Moc`/`Comment` nằm ở `core/doc_noi_dung.py` và file này chỉ *áp* nó lên
hình dạng response — **trừ một luật là của riêng đây**: `trich_ra` quyết định "bình luận
bị mod ẩn ⇒ cả khối trích biến mất, còn tác giả tự xoá ⇒ blockquote giữ body". Luật ấy
nói về `Trich`, không về `Comment`, nên nó không có chỗ trong `doc_noi_dung`; nhưng
`api/users.py` phải soi gương đúng nó khi đếm `duoc_trich`, và hai chỗ lệch nhau thì hồ
sơ với trang mạch nói hai chuyện về cùng một sự kiện. Danh sách đầy đủ các luật che nằm
ngoài `doc_noi_dung` ở ngay đầu module đó.
"""

import logging
from datetime import timedelta

from core.doc_noi_dung import DA_AN, Nut, doc_duoc, trang_thai_noi_dung
from core.ghi import NGAY_MO_LAI, PHUT_SUA_IM_LANG
from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.anh_luu import url_anh, url_thumb
from core.models.moc import Moc, MocAnh, MocRevision
from core.models.tuong_tac import Reaction, Trich

from api.schemas import (
    AnhOut,
    BinhLuanOut,
    FigureOut,
    MachTomTatOut,
    MocOut,
    MocRevisionOut,
    NguoiDungTomTatOut,
    SpineOut,
    SubTomTatOut,
    TrichOut,
)

logger = logging.getLogger(__name__)


def nguoi_dung_ra(user) -> NguoiDungTomTatOut:
    return NguoiDungTomTatOut(
        username=user.username, display_name=user.display_name
    )


def figures_ra(figures) -> list[FigureOut] | None:
    """`figures` trong DB là JSON đã được `kiem_figures` chặn hình dạng lúc ghi.

    Vẫn phòng thủ ở đây vì hàng cũ nạp bằng migration dữ liệu hoặc `manage.py shell`
    không đi qua validator nào, và một `KeyError`/`AttributeError` ở đây là **cả trang
    mạch** trả 500 — mất chín mốc vì một ô số hỏng.

    **Mức bảo vệ thật, đừng đọc mạnh hơn:** phần tử không phải `dict` (vd `figures` là
    list chuỗi) bị **bỏ qua**, và `figures` không phải list bị coi như không có. Bản đầu
    chỉ dùng `.get` nên `str.get` vẫn ném `AttributeError` — bảo vệ hẹp hơn đúng lời hứa
    trong chính docstring này. Bỏ qua là mất dữ liệu, nên nó **không im lặng**: mỗi ca ghi
    một dòng WARNING kèm nguyên văn phần bị bỏ, đủ để `grep` ra hàng hỏng trong DB. Hàm
    không biết mình đang trình bày `Moc` hay `MocRevision` nào, nên dòng log **không có**
    id — người đọc log lần theo nội dung, không theo khoá.
    """
    if figures is None:
        return None
    if not isinstance(figures, list):
        logger.warning("figures_ra: figures không phải list mà là %r", type(figures))
        return None
    hong = [f for f in figures if not isinstance(f, dict)]
    if hong:
        logger.warning(
            "figures_ra: bỏ qua %s phần tử figures không phải dict: %r", len(hong), hong
        )
    return [
        FigureOut(label=str(f.get("label", "")), value=str(f.get("value", "")))
        for f in figures
        if isinstance(f, dict)
    ]


def mach_tom_tat_ra(mach: Mach, *, moc_1_id: int | None = None) -> MachTomTatOut:
    """Thẻ mạch cho feed và cho hồ sơ. Cần `sub` + `author` đã `select_related`.

    `moc_1_id` **phải do người gọi nạp sẵn theo LÔ** (Phase 2 — đích của mũi tên vote trên
    thẻ). Hàm không tự truy vấn: nó chạy một lần cho mỗi thẻ, nên một `Moc.objects.filter`
    ở đây là N+1 đúng nghĩa trên mọi feed — và nó sẽ không đỏ ở đâu cả, chỉ chậm dần theo
    số thẻ. `api/feeds.py` và `api/users.py` gom một truy vấn cho cả trang.
    """
    return MachTomTatOut(
        id=mach.pk,
        slug=mach.slug,
        title=mach.title,
        sub=SubTomTatOut(slug=mach.sub.slug, ten=mach.sub.ten),
        author=nguoi_dung_ra(mach.author),
        status=mach.status,
        ket_qua=mach.ket_qua,
        entry_count=mach.entry_count,
        comment_count=mach.comment_count,
        created_at=mach.created_at,
        last_entry_at=mach.last_entry_at,
        last_activity_at=mach.last_activity_at,
        diem=mach.diem_bai_goc,
        moc_1_id=moc_1_id,
    )


def moc_1_theo_mach(machs) -> dict[int, int]:
    """`{mach_id: id của mốc 1}` cho một LÔ mạch — MỘT truy vấn.

    Tồn tại để `mach_tom_tat_ra` không phải tự hỏi DB (xem docstring của nó): thẻ feed cần
    `moc_1_id` làm đích cho mũi tên vote, và hỏi lẻ từng thẻ là N+1 trên mọi feed.
    """
    return dict(
        Moc.objects.filter(mach__in=machs, seq=1).values_list("mach_id", "id")
    )


def trich_ra(trich: Trich | None) -> TrichOut | None:
    """Khối trích của một mốc. Cần `comment` + `comment__author` đã `select_related`.

    Hai trạng thái, hai kết quả khác nhau — và sự khác nhau đó là chủ đích:

    - bình luận bị **mod ẩn** ⇒ trả `None`, khối trích biến mất khỏi mốc. Moderation
      thắng, kể cả trên "cuốn sổ không-xoá-được";
    - bình luận **tác giả tự xoá** ⇒ blockquote GIỮ NGUYÊN nội dung, chỉ mang thêm
      `trang_thai = "da_xoa"`. Đây là chỗ `Trich.comment = PROTECT` nói ra thành hành vi:
      PLAN 5.6 chốt người bình luận "được ghi tên vào cuốn sổ không-xoá-được", nên một
      lần bấm xoá của chính họ không được rút chữ ra khỏi sổ của mạch đã đóng.
    """
    if trich is None:
        return None
    c = trich.comment
    trang_thai = trang_thai_noi_dung(c)
    if trang_thai == DA_AN:
        return None
    return TrichOut(
        comment_id=c.pk,
        author=nguoi_dung_ra(c.author),
        body=c.body,
        trang_thai=trang_thai,
        comment_created_at=c.created_at,
        trich_created_at=trich.created_at,
        anchor_moc_seq=c.anchor_moc_seq,
    )


def anh_ra(anh: MocAnh) -> AnhOut:
    """Một ảnh trong gallery. URL do `STORAGES` sinh, không ghép tay ở đây.

    `url_anh`/`url_thumb` gọi `storage.url(...)`, nên đổi `MEDIA_URL` hay đổi hẳn sang R2
    đều không phải sửa dòng nào ở file này.
    """
    return AnhOut(
        id=anh.pk,
        url=url_anh(anh.khoa_luu_tru),
        url_thumb=url_thumb(anh.khoa_luu_tru),
        w=anh.w,
        h=anh.h,
        position=anh.position,
        exif_taken_at=anh.exif_taken_at,
    )


def dem_reaction_rong() -> dict[str, int]:
    """Đủ 5 khoá reaction, tất cả bằng 0. Không chạm DB.

    Dùng ở ba chỗ: mốc vừa tạo (chưa ai react), bia mộ (che), và làm nền cho
    `api/tuong_tac.py::dem_reaction_theo_mach`. Hàm chứ không phải một dict literal chép
    ba lần: *"đủ 5 khoá"* là bất biến của hợp đồng `MocOut.reactions` /`ReactionOut.dem`,
    và ba bản chép tay sẽ có một bản thiếu khoá vào ngày bộ emoji mọc thêm cái thứ sáu.
    """
    return {khoa: 0 for khoa in Reaction.Emoji.values}


def moc_ra(
    moc: Moc,
    *,
    so_binh_luan: int,
    trich: Trich | None,
    anhs: list[MocAnh],
    reactions: dict[str, int],
) -> MocOut:
    """Một thẻ mốc. Bia mộ mất sạch 5 trường nội dung, giữ nguyên `seq`/`occurred_at`.

    `score` của bia mộ về **0**, cùng chuẩn với `nut_ra` (số phiếu của nội dung đã gỡ
    không được trả ra). Bản 1b đầu có hai chuẩn cho cùng một lý lẽ: `nut_ra` zero hoá
    `up/down/score` của bình luận bị che, còn ở đây `score` của mốc đi thẳng ra ngoài —
    tức "+21" vẫn hiện trên một thẻ không còn chữ nào, và người đọc không có cách nào
    giải thích con số đó. `so_binh_luan` thì KHÔNG về 0: ngăn kéo của bia mộ vẫn mở được
    (PLAN 5.2), nên con số dẫn vào nó phải còn thật.
    """
    trang_thai = trang_thai_noi_dung(moc)
    hien = doc_duoc(moc)
    return MocOut(
        id=moc.pk,
        seq=moc.seq,
        # Cần `moc.author` đã `select_related` — người gọi nạp sẵn, hàm này chạy một lần
        # cho MỖI mốc nên một truy vấn ở đây là N+1 trên mọi lượt tải trang mạch.
        author=nguoi_dung_ra(moc.author) if hien else None,
        occurred_at=moc.occurred_at,
        created_at=moc.created_at,
        sua_im_lang_den=moc.created_at + timedelta(minutes=PHUT_SUA_IM_LANG),
        loai=moc.loai if hien else None,
        body=moc.body if hien else None,
        question_for_crowd=moc.question_for_crowd if hien else None,
        figures=figures_ra(moc.figures) if hien else None,
        edited_at=moc.edited_at if hien else None,
        edit_count=moc.edit_count if hien else 0,
        score=moc.score if hien else 0,
        trang_thai=trang_thai,
        so_binh_luan=so_binh_luan,
        # Trích là chú thích gắn vào thân mốc (PLAN 5.6 rào 4) — mốc đã thành bia mộ thì
        # không còn thân nào để gắn.
        trich=trich_ra(trich) if hien else None,
        # A9, vế tầng API: bia mộ và mốc bị mod ẩn không trả ảnh nào. Vế tầng ĐĨA nằm ở
        # `core/ghi.py::dong_bo_kho_anh` — nó chuyển file sang kho không server nào phục
        # vụ, vì Caddy đọc thẳng đĩa và không bao giờ hỏi dòng code này.
        anhs=[anh_ra(a) for a in anhs] if hien else [],
        # Bia mộ: đủ 5 khoá nhưng tất cả 0 — cùng chuẩn với `score`. Người gọi truyền vào
        # con số thật; phép che nằm ở đây, một chỗ, để ba chỗ gọi không phải nhớ nó.
        reactions=reactions if hien else dem_reaction_rong(),
    )


def han_mo_lai(mach: Mach):
    """`closed_at + 7 ngày`, hoặc `None` khi mạch chưa đóng sổ — `MachChiTietOut.mo_lai_den`.

    Hỏi `closed_at` chứ không hỏi `status`: mở lại **xoá `closed_at`** (`core/ghi.py`), nên
    một trong hai cột là đủ, và cột này là cột phép tính cần. Hàm thuần để `api/machs.py`
    và bài đo cùng gọi một chỗ thay vì mỗi bên cộng bảy ngày một lần.
    """
    if mach.closed_at is None:
        return None
    return mach.closed_at + timedelta(days=NGAY_MO_LAI)


def spine_ra(moc: Moc, *, so_binh_luan: int) -> SpineOut:
    """Một ô spine. Bia mộ lẫn mốc bị ẩn đều giữ chỗ (PLAN 5.2).

    Hai cờ RIÊNG thay vì một `trang_thai`: `SpineOut` không có trường nội dung nào để
    che, nên thứ 1c cần ở đây là "ô này vẽ kiểu gì", và mốc dính cả `deleted_at` lẫn
    `hidden_at` phải nói được cả hai — `trang_thai_noi_dung` thì cố ý chỉ trả một nhãn.
    """
    return SpineOut(
        seq=moc.seq,
        occurred_at=moc.occurred_at,
        so_binh_luan=so_binh_luan,
        da_xoa=moc.deleted_at is not None,
        da_an=moc.hidden_at is not None,
    )


def revision_ra(ban: MocRevision) -> MocRevisionOut:
    return MocRevisionOut(
        id=ban.pk,
        body=ban.body,
        figures=figures_ra(ban.figures),
        occurred_at=ban.occurred_at,
        loai=ban.loai,
        question_for_crowd=ban.question_for_crowd,
        revised_at=ban.revised_at,
    )


def nut_ra(nut: Nut, *, chu_mach_id: int) -> BinhLuanOut:
    """Một nút cây bình luận, đệ quy xuống hết nhánh.

    Bia mộ trả `author = null`, `body = null`, `edited_at = null`, `up/down/score = 0`,
    `la_chu_mach = false`, `tu_gap = false`. Số phiếu của một bình luận đã bị che không
    được trả ra: nó là thông tin về nội dung đã bị gỡ, và nếu trả ra thì thứ hạng
    `hay_nhat` (tính trên số ĐÃ che — xem `core/doc_noi_dung._rank_goc`) sẽ không giải
    thích được bằng chính những gì người đọc nhìn thấy.

    Bia mộ **vẫn trả** `id`, `parent_id`, `depth`, `anchor_moc_seq`, `created_at`,
    `trang_thai` và `replies` — không cái nào tiết lộ nội dung, và thiếu chúng thì nhánh
    con không nối lại được vào cây, còn khối trích trên thẻ mốc mất chỗ để nhảy tới.
    """
    c: Comment = nut.binh_luan
    hien = nut.hien_noi_dung
    return BinhLuanOut(
        id=c.pk,
        parent_id=c.parent_id,
        depth=nut.do_sau,
        anchor_moc_seq=c.anchor_moc_seq,
        author=nguoi_dung_ra(c.author) if hien else None,
        body=c.body if hien else None,
        created_at=c.created_at,
        edited_at=c.edited_at if hien else None,
        up_count=nut.up,
        down_count=nut.down,
        score=nut.diem,
        trang_thai=nut.trang_thai,
        la_chu_mach=hien and c.author_id == chu_mach_id,
        tu_gap=nut.tu_gap,
        replies=[nut_ra(x, chu_mach_id=chu_mach_id) for x in nut.con],
    )
