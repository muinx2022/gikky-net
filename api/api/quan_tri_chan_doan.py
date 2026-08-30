"""Chẩn đoán **tìm kiếm** cho khu quản trị — trả nợ `P-20260827-2` (2026-08-30).

## Vấn đề mà endpoint này tồn tại để chấm dứt

`P-20260827-2` gọi tên đúng một trạng thái: *index prod lệch DB **im lặng***. Ba lớp của
hệ thống hợp lại làm nó im:

- đường ghi index **nuốt lỗi** có chủ đích (`core/tim_kiem.py` — mất index còn hơn mất
  bài), nên một `MEILI_KEY` hết quyền trả 403 suốt vài tuần mà log chỉ có `warning`;
- lớp lọc thứ hai ở `api/tim_kiem.py` **che mọi hậu quả nhìn thấy được**: index lệch chỉ
  làm trang thiếu dòng, không làm nó sai — nên không ai kêu;
- `reindex_tim_kiem` chữa được, nhưng ai chạy nó cũng phải NGHI ngờ trước đã.

Cộng lại: không có màn hình nào trả lời được câu *"index có khớp DB không"*. Đây là màn
hình đó. Nó không sửa gì; nó chỉ **nói to** con số của hai bên.

## Vì sao đếm bằng `GET /documents?limit=0` chứ không bằng `/stats`

`/stats` đòi action `stats.get`. Khoá sản phẩm là khoá **phạm vi hẹp** và danh sách action
của nó là danh sách đóng (`deploy/prod/tao-khoa-meili.sh`) — nới quyền cho một màn hình
đếm cho tiện là đúng thứ "phạm vi hẹp" tồn tại để chặn. Cùng lý lẽ với
`tests/test_tim_kiem_that.py::_dem_tai_lieu`.

## Không đòi superuser

Chỉ đọc, không phơi nội dung của ai: con số duy nhất đi ra là số hàng. Cùng chuẩn với
`quan_tri_luot_xem`.
"""

import logging

from django.http import HttpResponse
from ninja import Router, Schema

from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.tim_kiem import (
    CAC_INDEX,
    TEN_INDEX,
    TEN_INDEX_BINH_LUAN,
    MeiliHong,
    dem_tai_lieu,
    suc_khoe,
)

from api.loi import LoiOut

logger = logging.getLogger(__name__)

router = Router()


class ChanDoanIndexOut(Schema):
    """Một index: Meilisearch nói bao nhiêu, Postgres nói bao nhiêu.

    `so_tai_lieu = null` nghĩa là **không đọc được** (Meili chết, hoặc khoá không có
    quyền với index này) — khác hẳn `0`, vốn nghĩa là "đọc được, và nó rỗng". Gộp hai
    trạng thái ấy làm một là để một khoá thiếu quyền trông y hệt một index chưa dựng.

    `lech` **`True` cả khi không đọc được**: không biết cũng là một câu trả lời cần nhìn.
    """

    ten: str
    so_tai_lieu: int | None
    so_hang_postgres: int
    lech: bool
    #: Câu tiếng Việt nói vì sao lệch, hoặc chuỗi rỗng khi khớp. Màn hình in thẳng.
    ghi_chu: str


class ChanDoanTimKiemOut(Schema):
    """Trạng thái đối soát của cả cụm tìm kiếm."""

    #: `False` khi `GET /health` không trả lời — hoặc `MEILI_URL`/`MEILI_KEY` chưa đặt.
    meili_song: bool
    cac_index: list[ChanDoanIndexOut]
    #: `True` khi **bất kỳ** index nào lệch, hoặc Meili không sống. Một cờ để màn hình
    #: đổi màu mà không phải tự suy lại luật từ danh sách.
    co_lech: bool


def _dem_hoac_none(ten: str) -> tuple[int | None, str | None]:
    """Số tài liệu trong một index + LOẠI lỗi khi không đọc được (`None` khi đọc được).

    Nuốt `MeiliHong` ở đây là ĐÚNG, khác luật của `reindex_tim_kiem`: đây là màn hình
    chẩn đoán, và nhiệm vụ của nó là **báo** hỏng chứ không phải chết cùng. `None` đi
    thẳng ra response và hiện thành "không đọc được" — thông tin, không phải lỗi 500.

    Trả kèm loại lỗi vì hai nguyên nhân "không đọc được" cần hai lời khuyên KHÁC nhau:

    - **404** — index chưa dựng (`GET /indexes/<uid>/documents` trên một index không tồn
      tại). Cách chữa: `reindex_tim_kiem --sach` để tạo cả hai index.
    - **403** (và lỗi khác) — khoá không có quyền với index này; ca hay gặp nhất là khoá
      cũ chỉ khai `indexes: ["mach"]`. Cách chữa: sinh lại khoá.

    Gộp hai ca là dẫn người trực 2 giờ sáng đi sinh lại khoá cho một index thật ra chỉ
    chưa được dựng — hoặc ngược lại.
    """
    try:
        return dem_tai_lieu(ten), None
    except MeiliHong as loi:
        logger.warning("chẩn đoán: không đọc được số tài liệu của %s: %s", ten, loi)
        return None, ("404" if "404" in str(loi) else "khac")


def _so_hang_postgres() -> dict[str, int]:
    """Số hàng CÔNG KHAI của mỗi index, theo đúng luật che của nó.

    Hai bộ lọc dưới đây phải khớp từng chữ với `reindex_tim_kiem::_binh_luan_cong_khai`
    và với `core/tim_kiem.py::hien_cong_khai`. Lệch thì màn hình này báo lệch trên một
    cụm đang khớp — và một cảnh báo sai là cách nhanh nhất để mọi cảnh báo sau bị bỏ qua.
    """
    return {
        TEN_INDEX: Mach.objects.filter(hidden_at__isnull=True).count(),
        TEN_INDEX_BINH_LUAN: Comment.objects.filter(
            deleted_at__isnull=True,
            hidden_at__isnull=True,
            mach__hidden_at__isnull=True,
        ).count(),
    }


@router.get(
    "/chan-doan/tim-kiem",
    response={200: ChanDoanTimKiemOut, 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_chan_doan_tim_kiem",
    tags=["quan-tri"],
)
def chan_doan_tim_kiem(request, response: HttpResponse):
    """Chỉ mục tìm kiếm có khớp Postgres không — **nói to khi lệch**.

    Với mỗi index: số tài liệu Meilisearch đang giữ, số hàng công khai Postgres đang có,
    và một câu tiếng Việt khi hai con số không bằng nhau.

    Lệch **không phải lúc nào cũng là sự cố**: Meilisearch nhận tài liệu bất đồng bộ, nên
    ngay sau một lượt đăng bài con số có thể chênh vài đơn vị trong khoảnh khắc. Lệch
    **dai dẳng** hoặc lệch lớn thì mới là `P-20260827-2`, và cách chữa là
    `reindex_tim_kiem`. Màn hình nói ra cả hai điều đó chứ không tự phán.

    `so_tai_lieu = null` là **không đọc được** — hay gặp nhất khi `MEILI_KEY` là khoá cũ
    chỉ khai `indexes: ["mach"]`, tức index `binh_luan` trả 403 cho mọi lời gọi và đường
    ghi nuốt im lặng.
    """
    response["Cache-Control"] = "no-store"

    song = suc_khoe()
    pg = _so_hang_postgres()
    hang: list[ChanDoanIndexOut] = []
    for ten in CAC_INDEX:
        # Meili không sống ⇒ không đọc được, và đó là lỗi cụm chứ không phải 404 của
        # riêng một index — dùng lời khuyên chung ("khac"), không phải "index chưa dựng".
        so, loai_loi = _dem_hoac_none(ten) if song else (None, "khac")
        mong = pg[ten]
        if loai_loi == "404":
            ghi_chu = (
                "Index này CHƯA DỰNG (Meilisearch trả 404). Chạy "
                "`manage.py reindex_tim_kiem --sach` để tạo cả hai index rồi dựng lại."
            )
        elif so is None:
            ghi_chu = (
                "Không đọc được index này. Meilisearch chết, hoặc MEILI_KEY không có "
                "quyền với nó — khoá sinh trước 2026-08-30 chỉ khai `indexes: [\"mach\"]`; "
                "chạy lại `deploy/prod/tao-khoa-meili.sh` rồi thay MEILI_KEY."
            )
        elif so != mong:
            ghi_chu = (
                f"Lệch {so - mong:+d}. Vài đơn vị ngay sau khi có bài mới là bình thường "
                "(Meilisearch index bất đồng bộ). Lệch dai dẳng ⇒ chạy "
                "`manage.py reindex_tim_kiem`."
            )
        else:
            ghi_chu = ""
        hang.append(
            ChanDoanIndexOut(
                ten=ten,
                so_tai_lieu=so,
                so_hang_postgres=mong,
                lech=(so != mong),
                ghi_chu=ghi_chu,
            )
        )

    return ChanDoanTimKiemOut(
        meili_song=song,
        cac_index=hang,
        co_lech=(not song or any(h.lech for h in hang)),
    )
