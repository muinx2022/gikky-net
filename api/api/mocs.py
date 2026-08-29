"""Ngăn kéo, lịch sử sửa, và sửa/xoá một mốc — PLAN mục 7, 5.2, 5.4.

Phase 2 thêm `PATCH /mocs/{id}` và `DELETE /mocs/{id}`. Luật quyền: **chỉ tác giả của
chính mốc đó** — xem docstring từng endpoint.
"""

import logging
from datetime import timedelta

from django.core.exceptions import ValidationError as LoiModel
from django.db import IntegrityError, transaction
from django.utils import timezone
from ninja import Router, Status

from core.doc_noi_dung import (
    dem_binh_luan_theo_moc,
    dem_nut,
    doc_duoc,
    lat_cat_ngan_keo,
    nap_binh_luan,
    tap_tung_duoc_trich,
)
from core.ghi import RB_TRICH_HIEU_LUC, _la_va_cham, go_trich, sua_moc, trich_vao_so, xoa_moc
from core.models.binh_luan import Comment
from core.models.moc import Moc, MocAnh, MocRevision
from core.models.tuong_tac import Trich
from core.revalidate import lam_moi_mach
from core.thong_bao import bao_duoc_trich

from api.ghi_chung import doi_con_song, kiem_occurred_at, nap_moc
from api.loi import LoiOut, khong_tim_thay, loi
from api.quyen import (
    DU_LIEU_KHONG_HOP_LE,
    NOI_DUNG_DA_GO,
    LoiGhi,
    dang_nhap,
    doi_chu_so_huu,
    doi_mach_tuong_tac_duoc,
)
from api.schemas import MocOut, MocRevisionsOut, NganKeoOut, TrichKetQuaOut
from api.schemas_ghi import MocSuaIn, TrichIn
from api.trinh_bay import moc_ra, nut_ra, revision_ra
from api.tuong_tac import dem_reaction

logger = logging.getLogger(__name__)

router = Router()


def _moc_cua_mach_hien(moc_id: int) -> Moc | None:
    """Mốc thuộc một mạch chưa bị mod ẩn. **Bia mộ vẫn trả về** — xem endpoint dưới."""
    return (
        Moc.objects.filter(pk=moc_id, mach__hidden_at__isnull=True)
        # `author` cho `MocOut.author` (nợ `MOC-THIEU-AUTHOR`); `mach__author` cho phép
        # kiểm quyền của đường trích, vốn hỏi chủ MẠCH chứ không chủ mốc.
        .select_related("mach", "author", "mach__author")
        .first()
    )


@router.get(
    "/mocs/{int:moc_id}/comments",
    response={200: NganKeoOut, 404: LoiOut},
    operation_id="liet_ke_binh_luan_moc",
    tags=["binh-luan"],
)
def liet_ke_binh_luan_moc(request, moc_id: int):
    """Ngăn kéo của một mốc — **CHỖ Ở DUY NHẤT** của các thread neo vào mốc đó.

    Lấy các thread có bình luận **gốc** mang `anchor_moc_seq` bằng `seq` của mốc này, và
    lấy **cả thread** — reply viết ở thời điểm mốc nào cũng thuộc về thread của gốc
    (PLAN nguyên tắc 6). Nhờ vậy ngăn kéo của mốc 2 kể được cả lời tiên tri lẫn cái kết.

    ## Ngăn kéo là PHÒNG, không còn là cửa sổ *(user chốt 2026-08-26)*

    > *"nên có 1 phần cmt chung cho toàn bộ post, không lẫn cmt của các mock vào, từng
    > mock có cmt riêng thì cứ kệ nó"*

    Tới lượt ấy, PLAN 5.4 luật 2 gọi ngăn kéo là *"cửa sổ chiếu vào khán đài"*: cùng một
    thread hiện ở cả hai chỗ. Nay `GET /machs/{id}/comments` **lọc bỏ** mọi thread có neo
    (khi `entry_count >= 2`), nên thread neo mốc N chỉ còn render ở đây. Hệ quả cho người
    gọi: **endpoint này không phải một lối tắt tiện tay — bỏ qua nó là mất hẳn phần lớn
    bình luận của mạch**, không phải mất một cách trình bày.

    Vế **"không cho chỉnh"** của luật 2 thì còn nguyên: không có tham số sắp xếp nào, và
    nối chiều vào `?sort=` của khán đài là cấp cho ngăn kéo đúng cái phòng riêng mà luật 2
    dựng ra để chặn (PLAN nguyên tắc 4).

    ## Thứ tự: gốc BUMP theo hoạt động, reply đọc XUÔI

    Dùng đúng cặp khoá của `?sort=moi_nhat` bên khán đài (`core/doc_noi_dung.py::
    lat_cat_ngan_keo` + `sap_goc_bump_hoat_dong`), chốt cuối ngày 2026-08-27:

    - **thread gốc**: `max(created_at)` trên các nút **đọc được** của cả thread, giảm dần —
      một reply mới đẩy cuộc trao đổi lên đầu. Bia mộ không bump; thread toàn bia mộ rơi về
      `created_at` của gốc;
    - **reply bên trong**: `created_at` **tăng** dần — hội thoại đọc từ trên xuống.

    Hai chiều ngược nhau là chủ đích, không phải sót: ngoài danh sách câu hỏi là *"cuộc nào
    vừa có người nói"*, trong một thread câu hỏi là *"cuộc này diễn ra thế nào"*.
    ⚠ Mô tả cũ **"mới → cũ"** của endpoint này chết ở đó — nó chỉ từng đúng cho tầng gốc,
    và chỉ trong khoảng một ngày.

    Mốc chưa có bình luận nào trả `threads: []`, `so_binh_luan: 0` cùng
    `question_for_crowd` nếu mốc có câu mồi — UI hiện lời mời chứ **không** hiện "💬 0"
    (PLAN 5.4 luật 4, nguyên tắc 9).

    Ngăn kéo của một mốc đã thành **bia mộ vẫn mở được** (bình luận không biến mất theo
    mốc), nhưng `question_for_crowd` khi đó là `null`: đó là nội dung của mốc, mà nội
    dung của bia mộ thì không trả ra.
    """
    moc = _moc_cua_mach_hien(moc_id)
    if moc is None:
        return khong_tim_thay(f"mốc {moc_id}")

    threads = lat_cat_ngan_keo(
        nap_binh_luan(moc.mach),
        seq=moc.seq,
        tung_duoc_trich=tap_tung_duoc_trich(moc.mach),
    )
    return NganKeoOut(
        moc_id=moc.pk,
        moc_seq=moc.seq,
        question_for_crowd=moc.question_for_crowd if doc_duoc(moc) else None,
        so_binh_luan=dem_nut(threads),
        threads=[nut_ra(n, chu_mach_id=moc.mach.author_id) for n in threads],
    )


@router.get(
    "/mocs/{int:moc_id}/revisions",
    response={200: MocRevisionsOut, 404: LoiOut},
    operation_id="liet_ke_ban_cu_moc",
    tags=["moc"],
)
def liet_ke_ban_cu_moc(request, moc_id: int):
    """Các bản TRƯỚC của một mốc, cho UI diff "đã sửa N lần" (PLAN 5.2).

    Mỗi bản lưu **đủ cả 5 trường sửa được** (`body`, `figures`, `occurred_at`, `loai`,
    `question_for_crowd`), nên diff hiện được cả thay đổi ngày sự việc ("10/06 → 04/06")
    — sửa lùi `occurred_at` mà không để vết là phá đúng giá trị lõi của sản phẩm.

    Mốc **đã xoá hoặc bị mod ẩn trả 404**: các bản cũ chứa nguyên văn nội dung, mở đường
    này ra là gỡ mốc ở cửa trước còn đọc được ở cửa sau.

    Mốc chưa sửa lần nào trả `items: []`, không phải 404.
    """
    moc = _moc_cua_mach_hien(moc_id)
    if moc is None or not doc_duoc(moc):
        return khong_tim_thay(f"mốc {moc_id}")

    ban_cu = MocRevision.objects.filter(moc=moc).order_by("-revised_at", "-pk")
    return MocRevisionsOut(
        moc_id=moc.pk,
        moc_seq=moc.seq,
        items=[revision_ra(b) for b in ban_cu],
    )


# =============================================================================
# ĐƯỜNG GHI — Phase 2
# =============================================================================


def _moc_ra_day_du(moc: Moc) -> MocOut:
    """`MocOut` kèm `so_binh_luan` + khối trích — cùng hình dạng với `GET /machs/{id}`.

    Đường ghi trả về hình dạng khác đường đọc là cách UI phải có hai nhánh render cho
    cùng một thẻ mốc, và nhánh ít chạy hơn sẽ là nhánh sai.
    """
    dem = dem_binh_luan_theo_moc(moc.mach)
    trich = (
        Trich.objects.filter(moc=moc, removed_at__isnull=True)
        .select_related("comment", "comment__author")
        .first()
    )
    anhs = list(
        MocAnh.objects.filter(moc=moc, status=MocAnh.TrangThai.XAC_NHAN).order_by(
            "position", "id"
        )
    )
    return moc_ra(
        moc,
        so_binh_luan=dem.get(moc.seq, 0),
        trich=trich,
        anhs=anhs,
        reactions=dem_reaction(moc),
    )


@router.patch(
    "/mocs/{int:moc_id}",
    response={200: MocOut, 400: LoiOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="sua_moc",
    tags=["moc"],
    auth=dang_nhap,
)
def sua_moc_api(request, moc_id: int, du_lieu: MocSuaIn):
    """Sửa mốc — **đúng 5 trường** của PLAN 5.2, không gì khác.

    **Quyền: CHỈ tác giả của mốc** (`Moc.author`, không phải `Mach.author` — hai thứ đó
    trùng nhau hôm nay vì chỉ tác giả nối được mốc, nhưng hỏi đúng cột là điều kiện để
    chúng vẫn đúng khi đồng tác giả mở ra). Người khác nhận 403 `khong_phai_chu`.
    Mạch bị mod khoá ⇒ 403; mốc đã là bia mộ hoặc bị ẩn ⇒ 409 `noi_dung_da_go`.

    **PATCH thật**: trường không gửi thì không đổi, trường gửi `null` thì xoá. `body`
    không nhận `null` (mốc phải có thân) — schema chặn trước khi vào đây.

    Sửa **im lặng trong 15 phút** kể từ `created_at`; sau đó mỗi lần sửa tạo một
    `MocRevision` lưu **đủ cả 5 trường bản trước** và tăng "đã sửa N lần". Có
    `occurred_at` trong revision là bắt buộc: sửa lùi ngày sự việc mà không để vết là phá
    đúng giá trị lõi "ghi-trước-khi-biết-kết-quả" của sản phẩm.

    `occurred_at` mới vẫn **cấm ngày tương lai** (theo giờ VN).
    """
    moc = nap_moc(moc_id)
    doi_chu_so_huu(request.user, moc.author_id, "mốc")
    doi_mach_tuong_tac_duoc(moc.mach)
    doi_con_song(moc, "Mốc")

    thay_doi = du_lieu.model_dump(exclude_unset=True)
    if not thay_doi:
        raise LoiGhi(
            400, DU_LIEU_KHONG_HOP_LE, "Không có trường nào để sửa."
        )
    if "occurred_at" in thay_doi:
        if thay_doi["occurred_at"] is None:
            raise LoiGhi(
                400, DU_LIEU_KHONG_HOP_LE, "occurred_at không được để trống."
            )
        kiem_occurred_at(thay_doi["occurred_at"])
    if "figures" in thay_doi and thay_doi["figures"] is not None:
        # `model_dump` đã biến `FigureIn` thành dict — đúng hình dạng `kiem_figures` đòi.
        thay_doi["figures"] = [
            {"label": f["label"], "value": f["value"]} for f in thay_doi["figures"]
        ]

    try:
        moc = sua_moc(moc=moc, thay_doi=thay_doi)
    except LoiModel as e:
        raise LoiGhi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages)) from e
    lam_moi_mach(moc.mach)
    return _moc_ra_day_du(moc)


@router.delete(
    "/mocs/{int:moc_id}",
    response={200: MocOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="xoa_moc",
    tags=["moc"],
    auth=dang_nhap,
)
def xoa_moc_api(request, moc_id: int):
    """Xoá mốc = **bia mộ** giữ chỗ, không bao giờ `DELETE` thật (PLAN nguyên tắc 2).

    **Quyền: CHỈ tác giả của mốc.** Mạch bị mod khoá ⇒ 403. Mốc đã bị gỡ rồi ⇒ 409.

    Trả về chính thẻ mốc ở trạng thái bia mộ (`trang_thai = "da_xoa"`, nội dung `null`)
    chứ không trả 204: UI phải **render lại ô đó** chứ không gỡ nó khỏi timeline — `seq`
    bất biến và spine phải đủ số ô, giấu hẳn một ô là thủng dãy số (PLAN 5.2).

    Xoá mốc **không** làm `entry_count`/`last_entry_at` lùi (chúng đo *cấu trúc*), nhưng
    **có** làm `comment_count`/`last_activity_at` đổi (chúng đo *nội dung đọc được*) —
    PLAN mục 6, luật đếm 4 cột.
    """
    moc = nap_moc(moc_id)
    doi_chu_so_huu(request.user, moc.author_id, "mốc")
    doi_mach_tuong_tac_duoc(moc.mach)
    doi_con_song(moc, "Mốc")
    moc = xoa_moc(moc=moc)
    lam_moi_mach(moc.mach)
    return _moc_ra_day_du(moc)


# =============================================================================
# TRÍCH VÀO SỔ — PLAN 5.6, Phase 3
# =============================================================================
#
# Bốn rào của PLAN 5.6 nằm ở BỐN TẦNG khác nhau, và biết rào nào ở đâu là điều kiện để
# không ai "củng cố" nhầm chỗ:
#
#  1. **tối đa 1 trích đang hiệu lực mỗi mốc** — partial unique
#     `UNIQUE (moc) WHERE removed_at IS NULL` ở tầng DB. Câu `exists()` dưới đây là để
#     trả 409 cho tử tế, KHÔNG phải là hàng rào: kiểm-rồi-ghi thua một cú double-click.
#  2. **blockquote kèm HAI dấu thời gian** — `api/schemas.py::TrichOut`
#     (`comment_created_at` + `trich_created_at`), đã có từ 1b.
#  3. **`duoc_trich` đếm theo số tác giả KHÁC NHAU, không tính tự trích** —
#     `api/users.py`, đã có. Đường ghi ở đây **không được phá nó**, và cách nó không phá là
#     không đụng gì tới chỉ số ấy: chỉ số được tính lại từ bảng `Trich` mỗi lần đọc hồ sơ.
#  4. **render tách bạch khỏi thân mốc** — `MocOut.trich` là một trường RIÊNG, không phải
#     chữ nối vào `body`. Đó là lý do hai endpoint dưới đây trả về cả thẻ mốc.
#
# Rào duy nhất đường ghi này tự cài là rào 1. Ba rào kia đã đứng sẵn; việc của lượt này là
# không dựng một cửa đi vòng qua chúng.

#: Đã có một trích đang hiệu lực trên mốc này (rào 1 của PLAN 5.6). 409.
DA_CO_TRICH = "da_co_trich"
#: Quá 24 giờ kể từ lúc trích ⇒ không gỡ được nữa (PLAN 5.6 rào 1). 409.
HET_HAN_GO_TRICH = "het_han_go_trich"
#: Mốc này chưa có trích nào để gỡ. 404.
CHUA_CO_TRICH = "chua_co_trich"

#: PLAN 5.6 rào 1 — "gỡ trích được trong 24h".
GIO_GO_TRICH = 24


def _trich_hieu_luc(moc: Moc) -> Trich | None:
    """Hàng `Trich` đang hiệu lực của một mốc, hoặc `None`. Tối đa một (rào 1)."""
    return (
        Trich.objects.filter(moc=moc, removed_at__isnull=True)
        .select_related("comment", "comment__author")
        .first()
    )


@router.post(
    "/mocs/{int:moc_id}/trich",
    response={
        201: TrichKetQuaOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
        409: LoiOut,
    },
    operation_id="trich_vao_so",
    tags=["trich"],
    auth=dang_nhap,
)
def trich_vao_so_api(request, moc_id: int, du_lieu: TrichIn):
    """Ghi một câu khán đài vào sổ — "trích vào sổ", PLAN 5.6.

    **Quyền: CHỈ chủ mạch** (`Mach.author`, không phải `Moc.author`). Người khác nhận 403
    `khong_phai_chu`. Rào 4 của PLAN 5.6 nói rõ blockquote ghi *"trích từ khán đài, **bởi
    chủ mạch**"* — nó là cơ chế thưởng mà chủ cuốn sổ trao đi, nên nó chỉ có nghĩa khi
    đúng một người trao được.

    Bốn ca từ chối, mỗi ca một mã để UI nói đúng chuyện:

    - mạch bị mod **khoá** ⇒ 403 `mach_bi_khoa`. Khác với follow/seen (sổ tay riêng của
      người đọc, xem `api/theo_doi.py`), trích **ghi vào nội dung công khai** của mạch —
      nó đúng nghĩa "tương tác" mà PLAN 5.10 cấm trên mạch bị khoá;
    - mốc đã thành **bia mộ** hoặc bị mod ẩn ⇒ 409 `noi_dung_da_go`. Trích là chú thích
      gắn vào thân mốc (rào 4), mà bia mộ thì không còn thân nào để gắn — `trinh_bay.moc_ra`
      cũng đã bỏ khối trích của mốc bị gỡ, nên ghi vào đó là ghi một hàng không cửa nào hiện;
    - bình luận **không thuộc mạch này**, hoặc đã bị gỡ ⇒ 400 `du_lieu_khong_hop_le`;
    - mốc **đã có trích đang hiệu lực** ⇒ 409 `da_co_trich` (rào 1). Gỡ trước rồi trích lại.

    **Trích bình luận của CHÍNH MÌNH thì được**, và blockquote hiện đầy đủ — nhưng chỉ số
    "Được trích ×N" trên hồ sơ **không cộng** (rào 3, `api/users.py`), và không có thông
    báo nào được gửi (`core/thong_bao.py::bao_duoc_trich`). Ba cửa, một luật: tự trích
    không phải một sự kiện xã hội.

    Người được trích nhận thông báo (PLAN 5.6 dòng cuối), sinh **trong cùng transaction**.
    """
    moc = nap_moc(moc_id)
    doi_chu_so_huu(request.user, moc.mach.author_id, "mạch")
    doi_mach_tuong_tac_duoc(moc.mach)
    doi_con_song(moc, "Mốc")

    comment = Comment.objects.filter(pk=du_lieu.comment_id, mach=moc.mach).first()
    if comment is None:
        raise LoiGhi(
            400,
            DU_LIEU_KHONG_HOP_LE,
            f"Bình luận {du_lieu.comment_id} không thuộc mạch này. Sổ của một mạch chỉ "
            "trích được câu nói trong chính khán đài của nó.",
        )
    if not doc_duoc(comment):
        raise LoiGhi(
            400,
            DU_LIEU_KHONG_HOP_LE,
            "Bình luận này đã bị gỡ, không trích vào sổ được.",
        )
    if _trich_hieu_luc(moc) is not None:
        raise LoiGhi(
            409,
            DA_CO_TRICH,
            f"Mốc {moc.seq} đã có một trích đang hiệu lực — gỡ nó trước rồi trích câu khác.",
        )

    try:
        with transaction.atomic():
            trich = trich_vao_so(moc=moc, comment=comment)
            bao_duoc_trich(trich)
    except IntegrityError as e:
        # Rào 1 ở tầng DB bắt được cuộc đua mà câu `exists()` ở trên thua: hai lượt bấm
        # đồng thời của cùng một chủ mạch (double-click, hai tab) cùng thấy "chưa có".
        # 409 chứ không 500 — hành động vẫn hợp lệ, chỉ là đã có người (chính họ) làm trước.
        #
        # ⚠ **Phải PHÂN BIỆT nguyên nhân** (L10, vá V1). Bản trước quy MỌI `IntegrityError`
        # về câu "đã có trích khác", và nó nói dối ở một ca có thật: FK của Django trên
        # Postgres là `DEFERRABLE INITIALLY DEFERRED` (xác minh bằng `\d core_trich`), nên
        # `Trich.comment_id` trỏ vào một bình luận **vừa bị xoá thật** chỉ nổ ở COMMIT —
        # cùng loại ngoại lệ, khác hẳn nguyên nhân. Chủ mạch nhận "mốc N vừa có một trích
        # khác" rồi đi tìm cái trích không tồn tại.
        if _la_va_cham(e, RB_TRICH_HIEU_LUC):
            raise LoiGhi(
                409,
                DA_CO_TRICH,
                f"Mốc {moc.seq} vừa có một trích khác được ghi vào cùng lúc.",
            ) from e
        # Nguyên nhân còn lại đã biết tên: bình luận biến mất giữa chừng (`Comment` là
        # model duy nhất có đường xoá thật — xem `api/quyen.py::_binh_luan_bien_mat`).
        # `logger.exception` chứ không nuốt: nếu mai có nguyên nhân thứ ba thì nó vẫn để
        # lại stacktrace đầy đủ, thay vì biến mất cùng lúc với cái 500.
        logger.exception(
            "trich_vao_so: IntegrityError không phải va rào 1 ở mốc %s, bình luận %s",
            moc.pk,
            du_lieu.comment_id,
        )
        raise LoiGhi(
            409,
            NOI_DUNG_DA_GO,
            "Bình luận này vừa bị gỡ — tải lại trang rồi trích câu khác.",
        ) from e

    lam_moi_mach(moc.mach)
    moc.refresh_from_db()
    return Status(201, TrichKetQuaOut(moc=_moc_ra_day_du(moc)))


@router.delete(
    "/mocs/{int:moc_id}/trich",
    response={200: TrichKetQuaOut, 401: LoiOut, 403: LoiOut, 404: LoiOut, 409: LoiOut},
    operation_id="go_trich",
    tags=["trich"],
    auth=dang_nhap,
)
def go_trich_api(request, moc_id: int):
    """Gỡ trích khỏi sổ — **trong 24 giờ**, sau đó không gỡ được nữa (PLAN 5.6 rào 1).

    **Quyền: CHỈ chủ mạch**, đối xứng với đường trích.

    Hàng `Trich` **ở lại** với `removed_at` — nó tự nó là log, và nó là thứ giữ cho chữ
    "đã TỪNG được trích" của PLAN 5.3 còn đúng (`Trich.comment = PROTECT` chặn xoá THẬT
    một bình luận đã vào sổ, kể cả sau khi trích bị gỡ). Vì unique là **partial**, gỡ xong
    thì trích câu khác vào đúng mốc đó được ngay.

    Hạn 24 giờ là hạn THẬT chứ không phải gợi ý UI: rào 1 dựng nó lên để sổ không thành
    một cái bảng chủ mạch xoay hằng ngày theo việc câu nào "hoá ra đúng" — đúng thứ rào 2
    (hai dấu thời gian) cũng đang chống.

    Mốc chưa có trích nào đang hiệu lực ⇒ 404 `chua_co_trich`; quá hạn ⇒ 409
    `het_han_go_trich`. Không idempotent về phía "gỡ cái đã gỡ": trả 404 chứ không 200, vì
    một lượt gỡ thành công và một lượt gỡ vào chỗ trống là hai chuyện khác nhau, và cái
    thứ hai gần như luôn nghĩa là UI đang hiển thị một trạng thái cũ.
    """
    moc = nap_moc(moc_id)
    doi_chu_so_huu(request.user, moc.mach.author_id, "mạch")
    doi_mach_tuong_tac_duoc(moc.mach)

    trich = _trich_hieu_luc(moc)
    if trich is None:
        # Mã RIÊNG, không dùng `khong_tim_thay`: ở đây mốc có thật và người gọi có quyền,
        # thứ vắng mặt là cái trích. Gộp vào `khong_tim_thay` là bắt UI đoán xem 404 vừa
        # rồi nói "mốc này không tồn tại" hay "mốc này không có gì để gỡ".
        return loi(404, CHUA_CO_TRICH, f"Mốc {moc.seq} chưa có trích nào đang hiệu lực.")
    if timezone.now() - trich.created_at > timedelta(hours=GIO_GO_TRICH):
        raise LoiGhi(
            409,
            HET_HAN_GO_TRICH,
            f"Quá {GIO_GO_TRICH} giờ kể từ lúc trích — câu này đã ở lại trong sổ.",
        )

    go_trich(trich=trich)
    lam_moi_mach(moc.mach)
    moc.refresh_from_db()
    return TrichKetQuaOut(moc=_moc_ra_day_du(moc))
