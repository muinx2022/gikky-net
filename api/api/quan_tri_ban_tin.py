"""Trang "Bản tin" của khu quản trị (việc 21, đợt D — `plans/2026-11-13-quan-tri-ban-tin-chu-de.md` §3.2).

Bảy cửa, gắn vào `api_admin` sẵn có (không NinjaAPI mới ⇒ không đụng registry / subpath):
hai cửa ĐỌC (bảng + ô "Hôm nay"; một bản tin) và năm cửa GHI (tiêu đề, một khung, ẩn, hiện,
xoá một khung). **Không có cửa tạo**: bản tin chỉ đến từ bot (`POST /api/v1/ban-tin`).

## Khu này thấy cả bản tin ĐÃ ẨN

Ngược `api/ban_tin.py` (cửa công khai coi bản ẩn như không có), cùng lý lẽ của cả khu quản
trị: mod phải với được thứ vừa ẩn thì mới hiện lại được.

## Ô "Hôm nay" — server tính, admin không gõ giờ

Ngày VN hôm nay, ba khung theo thứ tự `KhungBanTin`, mỗi khung một trạng thái:
`da_dang` (kèm giờ) · `da_xoa` (mod đã xoá qua khu này) · `chua` (chưa tới hạn chót) · `qua_han` ·
`khong_lich` (T7 / CN, chưa đăng). Hạn chót đọc từ `core/models/ban_tin.py::HAN_CHOT_KHUNG` — cùng số với bot, có bài đo
ép hai bên khớp. So như bot: quá hạn là phút giờ VN `>` phút hạn chót.

## Ghi đi qua `core/ghi_ban_tin.py` (+ `core/ghi.py::dat_an_ban_tin`), không qua handler

Hàm lõi khoá `BanTin` rồi tới khung, ghi `AuditLog` trước/sau trong cùng transaction. Handler
ở đây chỉ tra hàng, dịch ngoại lệ thành mã HTTP, dựng response. Ẩn / hiện ở `core/ghi.py` vì
nó ghi `hidden_at` — luật "mọi đường che sống ở `core/ghi.py`" của
`tests/test_tim_kiem_cau_truc.py`.

## Không gọi `core/revalidate.py`

Đã đo (2026-11-13): ba trang công khai đọc bản tin — `/s/tin-tuc/<ngày>`, `/s/tin-tuc`, `/` —
đều `export const dynamic = "force-dynamic"` và fetch với `cache: "no-store"`
(`apps/web/lib/api.ts::docBanTin` / `docDanhSachBanTin` đi qua `CHUNG`). Không có bản cache
nào để vứt: sửa ở đây hiện ra ở lượt tải kế tiếp. Cửa nhận `/lam-moi-cache` của web cũng
chỉ nhận đường `/m/<slug>-<id>`. Bài đo `apps/web/e2e/don-vi/quan-tri-ban-tin.spec.ts` ghim
giả định ấy — ngày một trong ba trang chuyển sang ISR thì nó đỏ, và lúc đó phải mở cửa làm
mới cho đường bản tin.
"""

from datetime import date, datetime
from typing import Literal

from django.core.exceptions import ValidationError as LoiModel
from django.utils import timezone
from ninja import Field, Router, Schema

from core.ghi import AUDIT_XOA_KHUNG_BAN_TIN, DICH_BAN_TIN, dat_an_ban_tin
from core.ghi_ban_tin import (
    KhongCoKhung,
    KhungCuoiCung,
    sua_khung_ban_tin,
    sua_tieu_de_ban_tin,
    xoa_khung_ban_tin,
)
from core.models.ban_tin import (
    HAN_CHOT_KHUNG,
    THU_CO_LICH_BAN_TIN,
    BanTin,
    KhungBanTin,
)
from core.models.he_thong import AuditLog
from core.models.moc import DAI_BODY_MOC
from core.thoi_gian import TZ_VN

from api.ban_tin import KhungOut, _khung_theo_thu_tu, doc_ngay, url_ban_tin
from api.loi import CURSOR_KHONG_HOP_LE, LoiOut, khong_tim_thay, loi
from api.machs import figures_ra_dict
from api.phan_trang import (
    GIOI_HAN_MAC_DINH,
    CursorHong,
    cat_trang,
    dem_tong,
    giai_ma_cursor_so,
    kiem_gioi_han,
    loc_keyset,
    ma_hoa_cursor_so,
)
from api.quyen import DU_LIEU_KHONG_HOP_LE
from api.schemas import FigureOut
from api.schemas_ghi import DAI_TITLE, FigureIn

router = Router()

#: Xoá khung cuối cùng của một bản tin — xem `core/ghi_ban_tin.py::KhungCuoiCung`.
KHUNG_CUOI_CUNG = "khung_cuoi_cung"

#: Trạng thái một khung trong ô "Hôm nay" — năm giá trị loại trừ nhau, xét từ trên xuống:
#: đã đăng → đã bị mod xoá hôm nay → không có lịch hôm nay → quá hạn chót → chưa tới hạn.
#:
#: `da_xoa` (vòng sửa 1): khung bot ĐÃ đăng rồi mod xoá qua khu quản trị (có dòng nhật ký
#: `xoa_khung_ban_tin` cho đúng bản tin + khung). Không có nó thì xoá một khung hôm nay làm ô
#: đỏ "quá hạn" — báo động giả cho một việc chính mod vừa làm.
TrangThaiKhungHomNay = Literal["da_dang", "da_xoa", "khong_lich", "qua_han", "chua"]


def bay_gio() -> datetime:
    """"Bây giờ" của file này — một chỗ để bài đo đóng băng giờ (nếp `quan_tri_chu_de.py`)."""
    return timezone.now()


class KhungHomNayOut(Schema):
    khung: KhungOut
    ten: str
    #: `HH:MM` giờ VN, từ `HAN_CHOT_KHUNG`.
    han_chot: str
    trang_thai: TrangThaiKhungHomNay
    #: `created_at` của khung khi đã đăng, không thì `null`.
    da_dang_luc: datetime | None


class HomNayOut(Schema):
    #: Ngày lịch VN hôm nay.
    ngay: date
    #: T2–T6 ⇒ `true`. Bot chạy cron `* * 1-5`.
    co_lich: bool
    khung: list[KhungHomNayOut]
    #: Số khung đã đăng hôm nay (0..3) — thẻ "Bản tin hôm nay" của bảng điều khiển.
    so_da_dang: int
    #: Bản tin hôm nay đang bị ẩn (khung vẫn đăng vào được, nhưng người đọc không thấy).
    da_an: bool


class BanTinQuanTriTomTatOut(Schema):
    """Một hàng của bảng `/ban-tin`."""

    ngay: date
    title: str
    khung_da_co: list[KhungOut]
    view_count: int
    cap_nhat_luc: datetime
    da_an: bool
    #: `/s/tin-tuc/<ngày>` — dựng ở server (`api/ban_tin.py::url_ban_tin`).
    duong_dan_cong_khai: str


class TrangBanTinQuanTriOut(Schema):
    hom_nay: HomNayOut
    items: list[BanTinQuanTriTomTatOut]
    cursor_ke_tiep: str | None
    tong: int


class KhungBanTinQuanTriOut(Schema):
    khung: KhungOut
    ten: str
    created_at: datetime
    #: HTML đã lọc, đúng như đã lưu.
    body: str
    figures: list[FigureOut] | None


class BanTinQuanTriOut(Schema):
    ngay: date
    title: str
    tac_gia: str
    created_at: datetime
    cap_nhat_luc: datetime
    view_count: int
    da_an: bool
    hidden_at: datetime | None
    duong_dan_cong_khai: str
    khung: list[KhungBanTinQuanTriOut]


class SuaBanTinIn(Schema):
    title: str = Field(min_length=1, max_length=DAI_TITLE)


class SuaKhungBanTinIn(Schema):
    """Thay TRỌN thân + bảng số liệu của một khung. `figures = null` (hoặc `[]`) ⇒ bỏ bảng số."""

    body: str = Field(min_length=1, max_length=DAI_BODY_MOC)
    figures: list[FigureIn] | None = None


TRA_LOI_DOC = {200: BanTinQuanTriOut, 401: LoiOut, 403: LoiOut, 404: LoiOut}
TRA_LOI_GHI = {
    200: BanTinQuanTriOut,
    400: LoiOut,
    401: LoiOut,
    403: LoiOut,
    404: LoiOut,
    409: LoiOut,
}


def _hom_nay(khi: datetime) -> HomNayOut:
    gio_vn = khi.astimezone(TZ_VN)
    ngay = gio_vn.date()
    phut = gio_vn.hour * 60 + gio_vn.minute
    co_lich = ngay.weekday() in THU_CO_LICH_BAN_TIN
    ban_tin = BanTin.objects.filter(ngay=ngay).prefetch_related("khung").first()
    da_co = {} if ban_tin is None else {k.khung: k for k in ban_tin.khung.all()}
    da_xoa = (
        set()
        if ban_tin is None
        else set(
            AuditLog.objects.filter(
                action=AUDIT_XOA_KHUNG_BAN_TIN,
                target_type=DICH_BAN_TIN,
                target_id=ban_tin.pk,
                meta__ngay=ngay.isoformat(),
            ).values_list("meta__khung", flat=True)
        )
    )

    o: list[KhungHomNayOut] = []
    for khoa in KhungBanTin.values:
        han = HAN_CHOT_KHUNG[khoa]
        k = da_co.get(khoa)
        if k is not None:
            trang_thai = "da_dang"
        elif khoa in da_xoa:
            trang_thai = "da_xoa"
        elif not co_lich:
            trang_thai = "khong_lich"
        elif phut > han.hour * 60 + han.minute:
            trang_thai = "qua_han"
        else:
            trang_thai = "chua"
        o.append(
            KhungHomNayOut(
                khung=khoa,
                ten=KhungBanTin(khoa).label,
                han_chot=han.strftime("%H:%M"),
                trang_thai=trang_thai,
                da_dang_luc=None if k is None else k.created_at,
            )
        )
    return HomNayOut(
        ngay=ngay,
        co_lich=co_lich,
        khung=o,
        so_da_dang=len(da_co),
        da_an=ban_tin is not None and ban_tin.hidden_at is not None,
    )


def _chi_tiet(ban_tin: BanTin) -> BanTinQuanTriOut:
    """Đọc lại TỪ DB (kể cả khung) — response sau một lượt ghi phải là trạng thái thật."""
    b = (
        BanTin.objects.select_related("tac_gia")
        .prefetch_related("khung")
        .get(pk=ban_tin.pk)
    )
    return BanTinQuanTriOut(
        ngay=b.ngay,
        title=b.title,
        tac_gia=b.tac_gia.username,
        created_at=b.created_at,
        cap_nhat_luc=b.cap_nhat_luc,
        view_count=b.view_count,
        da_an=b.hidden_at is not None,
        hidden_at=b.hidden_at,
        duong_dan_cong_khai=url_ban_tin(b.ngay),
        khung=[
            KhungBanTinQuanTriOut(
                khung=k.khung,
                ten=KhungBanTin(k.khung).label,
                created_at=k.created_at,
                body=k.body,
                figures=[FigureOut(**f) for f in k.figures] if k.figures else None,
            )
            for k in _khung_theo_thu_tu(b)
        ],
    )


def _nap(ngay: str) -> BanTin | None:
    """Bản tin theo ngày `YYYY-MM-DD`, KHÔNG lọc `hidden_at` (khối đầu file)."""
    ngay_doc = doc_ngay(ngay)
    if ngay_doc is None:
        return None
    return BanTin.objects.filter(ngay=ngay_doc).first()


@router.get(
    "/ban-tin",
    response={200: TrangBanTinQuanTriOut, 400: LoiOut, 401: LoiOut, 403: LoiOut},
    operation_id="quan_tri_liet_ke_ban_tin",
    tags=["quan-tri-ban-tin"],
)
def liet_ke_ban_tin(request, cursor: str | None = None, limit: int = GIOI_HAN_MAC_DINH):
    """Bảng bản tin mới → cũ theo ngày (kể cả đã ẩn), cursor keyset `(ngay, id)`, kèm ô "Hôm nay".

    `limit` 1..50; cursor sai ⇒ 400 `cursor_khong_hop_le`. `tong` đếm trước khi cắt keyset.
    """
    if (sai := kiem_gioi_han(limit)) is not None:
        return sai
    qs = BanTin.objects.all()
    tong = dem_tong(qs)
    if cursor is not None:
        try:
            thu_tu_ngay, id_cuoi = giai_ma_cursor_so(cursor)
            ngay_cuoi = date.fromordinal(thu_tu_ngay)
        except (CursorHong, ValueError, OverflowError):
            return loi(400, CURSOR_KHONG_HOP_LE, "cursor không hợp lệ.")
        qs = loc_keyset(qs, truong="ngay", khi=ngay_cuoi, id=id_cuoi, giam_dan=True)
    hang = list(qs.prefetch_related("khung").order_by("-ngay", "-pk")[: limit + 1])
    trang, con_nua = cat_trang(hang, limit)
    ke_tiep = (
        ma_hoa_cursor_so(trang[-1].ngay.toordinal(), trang[-1].pk)
        if con_nua and trang
        else None
    )
    return TrangBanTinQuanTriOut(
        hom_nay=_hom_nay(bay_gio()),
        items=[
            BanTinQuanTriTomTatOut(
                ngay=b.ngay,
                title=b.title,
                khung_da_co=[k.khung for k in _khung_theo_thu_tu(b)],
                view_count=b.view_count,
                cap_nhat_luc=b.cap_nhat_luc,
                da_an=b.hidden_at is not None,
                duong_dan_cong_khai=url_ban_tin(b.ngay),
            )
            for b in trang
        ],
        cursor_ke_tiep=ke_tiep,
        tong=tong,
    )


@router.get(
    "/ban-tin/{ngay}",
    response=TRA_LOI_DOC,
    operation_id="quan_tri_xem_ban_tin",
    tags=["quan-tri-ban-tin"],
)
def xem_ban_tin(request, ngay: str):
    """Một bản tin theo ngày VN (`YYYY-MM-DD`), kể cả đã ẩn. Sai dạng / không có ⇒ 404."""
    ban_tin = _nap(ngay)
    if ban_tin is None:
        return khong_tim_thay(f"bản tin ngày {ngay!r}")
    return _chi_tiet(ban_tin)


@router.patch(
    "/ban-tin/{ngay}",
    response=TRA_LOI_GHI,
    operation_id="quan_tri_sua_ban_tin",
    tags=["quan-tri-ban-tin"],
)
def sua_ban_tin(request, ngay: str, du_lieu: SuaBanTinIn):
    """Đổi tiêu đề. Chỉ khoảng trắng ⇒ 400. Không đổi gì ⇒ 200, không ghi nhật ký."""
    ban_tin = _nap(ngay)
    if ban_tin is None:
        return khong_tim_thay(f"bản tin ngày {ngay!r}")
    try:
        sua_tieu_de_ban_tin(ban_tin=ban_tin, title=du_lieu.title, boi=request.user)
    except LoiModel as e:
        return loi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages))
    return _chi_tiet(ban_tin)


@router.patch(
    "/ban-tin/{ngay}/khung/{khung}",
    response=TRA_LOI_GHI,
    operation_id="quan_tri_sua_khung_ban_tin",
    tags=["quan-tri-ban-tin"],
)
def sua_khung(request, ngay: str, khung: str, du_lieu: SuaKhungBanTinIn):
    """Thay thân + bảng số liệu của một khung — cùng bộ lọc HTML, cùng validator `figures`,
    cùng trần độ dài với đường đăng của bot.

    Thân chỉ gồm thẻ bị chặn (lọc xong rỗng) hoặc `figures` sai dạng ⇒ 400
    `du_lieu_khong_hop_le`. Khung chưa đăng ⇒ 404.
    """
    ban_tin = _nap(ngay)
    if ban_tin is None:
        return khong_tim_thay(f"bản tin ngày {ngay!r}")
    figures = figures_ra_dict(du_lieu.figures) or None
    try:
        sua_khung_ban_tin(
            ban_tin=ban_tin,
            khung=khung,
            body=du_lieu.body,
            figures=figures,
            boi=request.user,
        )
    except KhongCoKhung:
        return khong_tim_thay(f"khung {khung!r} của bản tin {ngay}")
    except LoiModel as e:
        return loi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages))
    return _chi_tiet(ban_tin)


@router.delete(
    "/ban-tin/{ngay}/khung/{khung}",
    response=TRA_LOI_GHI,
    operation_id="quan_tri_xoa_khung_ban_tin",
    tags=["quan-tri-ban-tin"],
)
def xoa_khung(request, ngay: str, khung: str):
    """Xoá hẳn một khung — không hoàn tác; bản cũ nằm ở nhật ký (`xoa_khung_ban_tin`).

    Khung cuối cùng ⇒ 409 `khung_cuoi_cung` (ẩn cả bản tin thay vì xoá). Không có ⇒ 404.
    """
    ban_tin = _nap(ngay)
    if ban_tin is None:
        return khong_tim_thay(f"bản tin ngày {ngay!r}")
    try:
        xoa_khung_ban_tin(ban_tin=ban_tin, khung=khung, boi=request.user)
    except KhongCoKhung:
        return khong_tim_thay(f"khung {khung!r} của bản tin {ngay}")
    except KhungCuoiCung as e:
        return loi(409, KHUNG_CUOI_CUNG, str(e))
    return _chi_tiet(ban_tin)


@router.post(
    "/ban-tin/{ngay}/an",
    response=TRA_LOI_GHI,
    operation_id="quan_tri_an_ban_tin",
    tags=["quan-tri-ban-tin"],
)
def an_ban_tin(request, ngay: str):
    """Ẩn cả bản tin: trang công khai 404, rơi khỏi danh sách và dải trang chủ. Đã ẩn ⇒ 200, không ghi."""
    ban_tin = _nap(ngay)
    if ban_tin is None:
        return khong_tim_thay(f"bản tin ngày {ngay!r}")
    dat_an_ban_tin(ban_tin=ban_tin, an=True, boi=request.user)
    return _chi_tiet(ban_tin)


@router.post(
    "/ban-tin/{ngay}/hien",
    response=TRA_LOI_GHI,
    operation_id="quan_tri_hien_ban_tin",
    tags=["quan-tri-ban-tin"],
)
def hien_ban_tin(request, ngay: str):
    """Hiện lại một bản tin đã ẩn. Đang hiện ⇒ 200, không ghi."""
    ban_tin = _nap(ngay)
    if ban_tin is None:
        return khong_tim_thay(f"bản tin ngày {ngay!r}")
    dat_an_ban_tin(ban_tin=ban_tin, an=False, boi=request.user)
    return _chi_tiet(ban_tin)
