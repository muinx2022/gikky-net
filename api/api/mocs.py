"""Ngăn kéo và lịch sử sửa của một mốc — PLAN mục 7, 5.2, 5.4."""

from ninja import Router

from core.doc_noi_dung import (
    dem_nut,
    doc_duoc,
    lat_cat_ngan_keo,
    nap_binh_luan,
    tap_tung_duoc_trich,
)
from core.models.moc import Moc, MocRevision

from api.loi import LoiOut, khong_tim_thay
from api.schemas import MocRevisionsOut, NganKeoOut
from api.trinh_bay import nut_ra, revision_ra

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
