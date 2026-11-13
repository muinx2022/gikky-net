"""Trang "Chủ đề tuần" của khu quản trị (việc 21, đợt C — `plans/2026-11-13-quan-tri-ban-tin-chu-de.md` §3.1).

Ba cửa: một cửa ĐỌC (`GET /chu-de` — bảng chủ đề + ba ô trạng thái trong cùng một phản hồi)
và hai cửa GHI (đóng / mở lại một chủ đề).

## "Đang trên trang chủ" — server trả, admin không đoán

Trang chủ chọn chủ đề nổi bằng hai bước (`apps/web/lib/api.ts::docFeedChuDe` +
`apps/web/lib/chu-de.ts::chonChuDeNoi`): lấy `SO_CHU_DE_TAI` chủ đề đầu của feed `moi`
(`?loai_mach=thao_luan`, sắp theo `last_content_at`), rồi chọn cái có `published_at` lớn nhất
(hoà ⇒ `id` lớn hơn). `chu_de_tren_trang_chu` dưới đây chạy ĐÚNG hai bước ấy trên ĐÚNG bộ lọc
công khai `api/feeds.py::_mach_hien` — không dựng bộ lọc thứ hai. Bước chọn thứ hai sống ở
web và ở đây (hai ngôn ngữ, không tránh được); bài đo
`tests/test_api_quan_tri_chu_de.py::test_c1_*` ghim rằng hai bên ra cùng một id, bằng cách
gọi chính endpoint feed công khai.

## Tuần là tuần ISO theo giờ VN

Thứ Hai 00:00 → Chủ nhật 23:59:59 `Asia/Ho_Chi_Minh` (`core/thoi_gian.py::TZ_VN`). Mỗi hàng
mang sẵn `tuan_bat_dau` (ngày thứ Hai) để admin gom nhóm mà không phải tính lại múi giờ ở
trình duyệt.

## Đóng / mở lại gọi ĐÚNG hàm lõi của cửa công khai

`core/ghi.py::dong_so` / `mo_lai` với `boi=request.user` (AuditLog khi người bấm không phải tác
giả — cùng luật với `POST /api/v1/machs/{id}/close`), rồi `lam_moi_mach`. Hai hàm lõi chỉ khoá
một hàng `Mach`, nên không thêm cạnh khoá nào. Các phép kiểm trạng thái (đã đóng, đang mở, quá
hạn 7 ngày) là cùng luật với `api/machs.py::dong_so_mach` / `mo_lai_mach`, cùng mã lỗi. Khác
đúng hai chỗ, cả hai theo nếp của khu quản trị:

- mạch không phải `thao_luan` ⇒ **400** `khong_phai_chu_de` (cửa này chỉ dành cho chủ đề;
  nhật ký / bài viết vẫn chỉ tác giả đóng được, qua cửa công khai);
- mạch bị mod khoá ⇒ **409** `mach_bi_khoa`, không phải 403: trong khu quản trị 403 nghĩa là
  "tài khoản này không phải mod", còn đây là "mở khoá trước rồi quay lại" — cùng lý lẽ
  `quan_tri_hen_gio.py` dùng cho bài đã bị ẩn;
- chủ đề bị mod ẩn hoặc đang chờ giờ hẹn ⇒ **409** `chu_de_dang_an` (cửa công khai trả 404 cho
  chúng).

Trạng thái sổ được kiểm LẠI dưới khoá trong hàm lõi (`SoDaDoiTrangThai`): hai mod bấm cùng lúc
thì đúng một lượt thắng, lượt kia 409.
"""

from datetime import date, datetime, time, timedelta
from typing import Literal

from django.utils import timezone
from ninja import Router, Schema

from core.ghi import NGAY_MO_LAI, SoDaDoiTrangThai, dong_so, mo_lai
from core.models.dien_dan import Mach
from core.revalidate import lam_moi_mach
from core.thoi_gian import TZ_VN, ngay_vn

from api.feeds import _mach_hien
from api.loi import LoiOut, khong_tim_thay, loi
from api.quan_tri_kiem_duyet import duong_dan_mach
from api.quan_tri_loc import dang_hen_gio
from api.quyen import HET_HAN_MO_LAI, MACH_BI_KHOA, MACH_DA_DONG, MACH_DANG_MO
from api.schemas_ghi import DongSoIn

router = Router()

#: Mạch không phải chủ đề thảo luận mà gọi cửa đóng / mở lại của trang chủ đề.
KHONG_PHAI_CHU_DE = "khong_phai_chu_de"

#: Chủ đề đang bị mod ẩn hoặc đang chờ giờ hẹn mà gọi cửa đóng / mở lại. Cửa công khai trả
#: 404 cho những bài này (chúng không tồn tại với người đọc); ở đây là 409 "gỡ ẩn / phát hành
#: trước rồi quay lại" — cùng lý lẽ `quan_tri_hen_gio.py` dùng cho bài đã bị ẩn.
CHU_DE_DANG_AN = "chu_de_dang_an"

#: Số chủ đề trang chủ tải để chọn một — PHẢI bằng `SO_CHU_DE_TAI` của
#: `apps/web/lib/chu-de.ts`. Lệch nhau thì ô "Đang trên trang chủ" nói một chủ đề khác với
#: thứ trang chủ đang hiện (chỉ khi có chủ đề cũ được nối mốc dài đẩy lên đầu feed).
SO_CHU_DE_TAI_TRANG_CHU = 5

#: Trần số hàng của bảng. Chủ đề ra một cái mỗi tuần — 200 hàng là gần bốn năm; `tong` cho
#: biết khi nào bị cắt.
GIOI_HAN_BANG_CHU_DE = 200

#: Bốn trạng thái LOẠI TRỪ NHAU của một chủ đề, xét từ trên xuống: mod ẩn → chờ giờ hẹn →
#: đã đóng → đang mở. Hai loài "ẩn" phân biệt bằng `hidden_by` (`api/quan_tri_loc.py`).
TrangThaiChuDe = Literal["bi_an", "hen_gio", "dong", "mo"]

class ChuDeOut(Schema):
    """Một chủ đề thảo luận — một hàng của bảng, và cũng là nội dung của ba ô trạng thái."""

    id: int
    title: str
    tac_gia: str
    trang_thai: TrangThaiChuDe
    published_at: datetime
    #: Thứ Hai (giờ VN) của tuần chứa `published_at` — khoá gom nhóm của bảng.
    tuan_bat_dau: date
    closed_at: datetime | None
    ket_qua: str | None
    bai_hoc: str | None
    comment_count: int
    view_count: int
    da_khoa: bool
    da_luu_tru: bool
    #: Nút "Mở lại" hiện được không: đã đóng, chưa bị khoá, còn trong hạn `NGAY_MO_LAI` ngày.
    co_the_mo_lai: bool
    duong_dan_cong_khai: str


class TuanChuDeOut(Schema):
    """Một tuần (thứ Hai → Chủ nhật, giờ VN) và chủ đề của nó, nếu có."""

    bat_dau: date
    ket_thuc: date
    #: Chủ đề xuất bản (hoặc hẹn xuất bản) muộn nhất trong tuần; `None` = tuần chưa có chủ đề.
    chu_de: ChuDeOut | None


class TrangChuDeOut(Schema):
    dang_tren_trang_chu: ChuDeOut | None
    tuan_nay: TuanChuDeOut
    tuan_sau: TuanChuDeOut
    items: list[ChuDeOut]
    tong: int


TRA_LOI_GHI = {
    200: ChuDeOut,
    400: LoiOut,
    401: LoiOut,
    403: LoiOut,
    404: LoiOut,
    409: LoiOut,
}


def bay_gio() -> datetime:
    """"Bây giờ" của file này — một chỗ để bài đo đóng băng giờ mà không vá `timezone.now`
    của cả tiến trình (model default cũng đọc nó)."""
    return timezone.now()


def thu_hai_vn(khi: datetime) -> date:
    """Ngày thứ Hai (lịch VN) của tuần chứa `khi`."""
    ngay = ngay_vn(khi)
    return ngay - timedelta(days=ngay.weekday())


def khoang_tuan_vn(khi: datetime) -> tuple[datetime, datetime]:
    """`[thứ Hai 00:00, thứ Hai kế tiếp 00:00)` giờ VN của tuần chứa `khi` — nửa mở."""
    bat_dau = datetime.combine(thu_hai_vn(khi), time.min, tzinfo=TZ_VN)
    return bat_dau, bat_dau + timedelta(days=7)


def chu_de_tren_trang_chu() -> Mach | None:
    """Chủ đề mà trang chủ đang hiện. Xem khối đầu file — hai bước, cùng bộ lọc công khai."""
    ung_vien = list(
        _mach_hien(None, loai_mach=Mach.LoaiMach.THAO_LUAN).order_by(
            "-last_content_at", "-pk"
        )[:SO_CHU_DE_TAI_TRANG_CHU]
    )
    return max(ung_vien, key=lambda m: (m.published_at, m.pk), default=None)


def _trang_thai(m: Mach) -> str:
    if m.hidden_at is not None:
        return "hen_gio" if dang_hen_gio(m) else "bi_an"
    return "dong" if m.status == Mach.TrangThai.DONG else "mo"


def _co_the_mo_lai(m: Mach, khi: datetime) -> bool:
    if (
        m.status != Mach.TrangThai.DONG
        or m.locked_at is not None
        or m.hidden_at is not None
    ):
        return False
    return m.closed_at is None or khi - m.closed_at <= timedelta(days=NGAY_MO_LAI)


def chu_de_ra(m: Mach, khi: datetime) -> ChuDeOut:
    return ChuDeOut(
        id=m.pk,
        title=m.title,
        tac_gia=m.author.username,
        trang_thai=_trang_thai(m),
        published_at=m.published_at,
        tuan_bat_dau=thu_hai_vn(m.published_at),
        closed_at=m.closed_at,
        ket_qua=m.ket_qua,
        bai_hoc=m.bai_hoc,
        comment_count=m.comment_count,
        view_count=m.view_count,
        da_khoa=m.locked_at is not None,
        da_luu_tru=m.archived_at is not None,
        co_the_mo_lai=_co_the_mo_lai(m, khi),
        duong_dan_cong_khai=duong_dan_mach(m),
    )


def _tuan(bat_dau: datetime, khi: datetime) -> TuanChuDeOut:
    """Chủ đề của một tuần: chưa bị mod ẩn, chưa lưu trữ, không riêng tư — tức sẽ (hoặc đang)
    lên sóng. Bài chờ giờ hẹn TÍNH: "tuần sau đã có chủ đề hẹn giờ" chính là câu hỏi ấy."""
    ket_thuc = bat_dau + timedelta(days=7)
    m = (
        Mach.objects.select_related("author")
        .filter(
            loai_mach=Mach.LoaiMach.THAO_LUAN,
            hidden_by__isnull=True,
            archived_at__isnull=True,
            rieng_tu=False,
            published_at__gte=bat_dau,
            published_at__lt=ket_thuc,
        )
        .order_by("-published_at", "-pk")
        .first()
    )
    return TuanChuDeOut(
        bat_dau=bat_dau.date(),
        ket_thuc=(ket_thuc - timedelta(days=1)).date(),
        chu_de=None if m is None else chu_de_ra(m, khi),
    )


@router.get(
    "/chu-de",
    response={200: TrangChuDeOut, 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_liet_ke_chu_de",
    tags=["quan-tri-chu-de"],
)
def liet_ke_chu_de(request):
    """Bảng chủ đề thảo luận (mới xuất bản trước) + ba ô trạng thái.

    Bảng thấy MỌI chủ đề — kể cả bị ẩn, đã lưu trữ, đang chờ giờ hẹn — cùng luật với bảng
    mạch (`quan_tri_bang.py`): mod phải thấy thứ đã gỡ thì mới gỡ lại được. Trần
    `GIOI_HAN_BANG_CHU_DE` hàng; `tong` là tổng thật.
    """
    khi = bay_gio()
    qs = Mach.objects.select_related("author").filter(
        loai_mach=Mach.LoaiMach.THAO_LUAN
    )
    hang = qs.order_by("-published_at", "-pk")[:GIOI_HAN_BANG_CHU_DE]
    tren_trang_chu = chu_de_tren_trang_chu()
    bat_dau, ke_tiep = khoang_tuan_vn(khi)
    return TrangChuDeOut(
        dang_tren_trang_chu=(
            None if tren_trang_chu is None else chu_de_ra(tren_trang_chu, khi)
        ),
        tuan_nay=_tuan(bat_dau, khi),
        tuan_sau=_tuan(ke_tiep, khi),
        items=[chu_de_ra(m, khi) for m in hang],
        tong=qs.count(),
    )


def _nap_chu_de(mach_id: int):
    """`(mach, None)` hoặc `(None, lỗi)` — 404 / 400 / 409 (khoá, ẩn, hẹn giờ), chung cho hai
    cửa ghi."""
    mach = Mach.objects.filter(pk=mach_id).first()
    if mach is None:
        return None, khong_tim_thay("mạch")
    if mach.loai_mach != Mach.LoaiMach.THAO_LUAN:
        return None, loi(
            400,
            KHONG_PHAI_CHU_DE,
            "Mạch này không phải chủ đề thảo luận — chỉ tác giả đóng / mở lại được nó.",
        )
    if mach.locked_at is not None:
        return None, loi(
            409, MACH_BI_KHOA, "Chủ đề này đang bị khoá — mở khoá trước rồi quay lại."
        )
    if mach.hidden_at is not None:
        return None, loi(
            409,
            CHU_DE_DANG_AN,
            "Chủ đề này đang chờ giờ hẹn — phát hành trước rồi quay lại."
            if dang_hen_gio(mach)
            else "Chủ đề này đang bị ẩn — gỡ ẩn trước rồi quay lại.",
        )
    return mach, None


def _ket_qua(mach_id: int) -> ChuDeOut:
    return chu_de_ra(
        Mach.objects.select_related("author").get(pk=mach_id), bay_gio()
    )


@router.post(
    "/chu-de/{int:mach_id}/dong",
    response=TRA_LOI_GHI,
    operation_id="quan_tri_dong_chu_de",
    tags=["quan-tri-chu-de"],
)
def dong_chu_de(request, mach_id: int, du_lieu: DongSoIn):
    """Đóng một chủ đề, kèm "Kết quả một dòng" (`ket_qua`, ≤40 ký tự) và "Tổng kết"
    (`bai_hoc`). Đã đóng rồi ⇒ 409 `mach_da_dong` (đóng lần hai dời hạn mở lại — xem
    `api/machs.py::dong_so_mach`)."""
    mach, l = _nap_chu_de(mach_id)
    if l is not None:
        return l
    if mach.status == Mach.TrangThai.DONG:
        return loi(409, MACH_DA_DONG, "Chủ đề này đã đóng rồi.")
    try:
        mach = dong_so(
            mach=mach, ket_qua=du_lieu.ket_qua, bai_hoc=du_lieu.bai_hoc, boi=request.user
        )
    except SoDaDoiTrangThai:
        # Đua: mod khác đóng giữa phép kiểm trên và lúc hàm lõi khoá hàng.
        return loi(409, MACH_DA_DONG, "Chủ đề này đã đóng rồi.")
    lam_moi_mach(mach)
    return _ket_qua(mach.pk)


@router.post(
    "/chu-de/{int:mach_id}/mo-lai",
    response=TRA_LOI_GHI,
    operation_id="quan_tri_mo_lai_chu_de",
    tags=["quan-tri-chu-de"],
)
def mo_lai_chu_de(request, mach_id: int):
    """Mở lại một chủ đề đã đóng, trong `NGAY_MO_LAI` ngày kể từ lúc đóng.

    ⚠ `core/ghi.py::mo_lai` **xoá** `ket_qua` và `bai_hoc` (chủ đích của hàm lõi: không in
    dòng tổng kết lên một câu chuyện chưa kết thúc). Bản cũ nằm trong `meta` của dòng
    AuditLog `mo_lai_chu_de` khi người bấm không phải tác giả.
    """
    mach, l = _nap_chu_de(mach_id)
    if l is not None:
        return l
    if mach.status != Mach.TrangThai.DONG:
        return loi(409, MACH_DANG_MO, "Chủ đề này đang mở, không có gì để mở lại.")
    if not _co_the_mo_lai(mach, bay_gio()):
        return loi(
            409,
            HET_HAN_MO_LAI,
            f"Quá {NGAY_MO_LAI} ngày kể từ khi đóng — chủ đề này không mở lại được nữa.",
        )
    try:
        mach = mo_lai(mach=mach, boi=request.user)
    except SoDaDoiTrangThai:
        return loi(409, MACH_DANG_MO, "Chủ đề này đang mở, không có gì để mở lại.")
    lam_moi_mach(mach)
    return _ket_qua(mach.pk)
