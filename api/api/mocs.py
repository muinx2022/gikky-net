"""Ngăn kéo, lịch sử sửa, và sửa/xoá một mốc — PLAN mục 7, 5.2, 5.4.

Phase 2 thêm `PATCH /mocs/{id}` và `DELETE /mocs/{id}`. Luật quyền: **chỉ tác giả của
chính mốc đó** — xem docstring từng endpoint.
"""

from django.core.exceptions import ValidationError as LoiModel
from ninja import Router

from core.doc_noi_dung import (
    dem_binh_luan_theo_moc,
    dem_nut,
    doc_duoc,
    lat_cat_ngan_keo,
    nap_binh_luan,
    tap_tung_duoc_trich,
)
from core.ghi import sua_moc, xoa_moc
from core.models.moc import Moc, MocRevision
from core.models.tuong_tac import Trich

from api.ghi_chung import doi_con_song, kiem_occurred_at, nap_moc
from api.loi import LoiOut, khong_tim_thay
from api.quyen import (
    DU_LIEU_KHONG_HOP_LE,
    LoiGhi,
    dang_nhap,
    doi_chu_so_huu,
    doi_mach_tuong_tac_duoc,
)
from api.schemas import MocOut, MocRevisionsOut, NganKeoOut
from api.schemas_ghi import MocSuaIn
from api.trinh_bay import moc_ra, nut_ra, revision_ra

router = Router()


def _moc_cua_mach_hien(moc_id: int) -> Moc | None:
    """Mốc thuộc một mạch chưa bị mod ẩn. **Bia mộ vẫn trả về** — xem endpoint dưới."""
    return (
        Moc.objects.filter(pk=moc_id, mach__hidden_at__isnull=True)
        .select_related("mach")
        .first()
    )


@router.get(
    "/mocs/{int:moc_id}/comments",
    response={200: NganKeoOut, 404: LoiOut},
    operation_id="liet_ke_binh_luan_moc",
    tags=["binh-luan"],
)
def liet_ke_binh_luan_moc(request, moc_id: int):
    """Ngăn kéo của một mốc: lát cắt bình luận neo vào mốc đó, **cũ → mới**.

    Lấy các thread có bình luận **gốc** mang `anchor_moc_seq` bằng `seq` của mốc này, và
    lấy **cả thread** — reply viết ở thời điểm mốc nào cũng thuộc về thread của gốc
    (PLAN nguyên tắc 6). Nhờ vậy ngăn kéo của mốc 2 kể được cả lời tiên tri lẫn cái kết.

    Không có tham số sắp xếp: ngăn kéo là cửa sổ chiếu vào khán đài, không phải một
    phòng riêng (PLAN 5.4 luật 2). Anchor dùng để CHIẾU, không bao giờ để chia khán đài
    thành nhiều phòng (PLAN nguyên tắc 4).

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
    return moc_ra(moc, so_binh_luan=dem.get(moc.seq, 0), trich=trich)


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
    return _moc_ra_day_du(moc)
