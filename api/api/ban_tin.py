"""Bản tin thị trường — `plans/2026-11-13-ban-tin-bang-rieng.md` §3.2.

Router gắn vào `api_v1` sẵn có, KHÔNG phải `NinjaAPI` mới (nên không đụng
`config/api_registry.py` hay subpath của `packages/api-client`).

Bốn cửa: ba cửa đọc công khai, không per-user (cache được), và một cửa ghi chỉ cho tài
khoản đội. **Không có cửa đếm lượt xem riêng**: lượt xem `/s/tin-tuc/<ngày>` đi qua
`POST /dem-luot-xem` như mọi trang khác, và `api/dem_luot_xem.py` nhận ra đường dẫn đó để
cộng `BanTin.view_count` — xem ghi chú ở đó.
"""

import re
from datetime import date, datetime
from typing import Literal

from django.core.exceptions import ValidationError as LoiModel
from ninja import Field, Router, Schema, Status

from core.ghi_ban_tin import KhungDaDang, dang_khung_ban_tin
from core.models.ban_tin import (
    SUB_BAN_TIN,
    THU_TU_KHUNG,
    BanTin,
    BanTinKhung,
    KhungBanTin,
)
from core.models.moc import DAI_BODY_MOC

from api.loi import CURSOR_KHONG_HOP_LE, LoiOut, khong_tim_thay, loi
from api.machs import figures_ra_dict
from api.phan_trang import (
    GIOI_HAN_MAC_DINH,
    CursorHong,
    cat_trang,
    giai_ma_cursor_so,
    kiem_gioi_han,
    loc_keyset,
    ma_hoa_cursor_so,
)
from api.quyen import (
    DU_LIEU_KHONG_HOP_LE,
    KHUNG_DA_DANG,
    KHONG_PHAI_TAI_KHOAN_DOI,
    LoiGhi,
    dang_nhap,
)
from api.schemas import FigureOut
from api.schemas_ghi import DAI_TITLE, FigureIn

router = Router()

#: Khoá khung trong hợp đồng API — `Literal` để `openapi.json` ra `enum` (cùng lối với
#: `schemas_ghi.py::LoaiMachIn`). Nguồn thật là `KhungBanTin`; `tests/test_ban_tin.py`
#: ghim hai tập bằng nhau.
KhungOut = Literal["dem_qua", "truoc_phien_vn", "truoc_phien_my"]

#: Số cặp `figures` tối đa của dòng số liệu trên trang danh sách (plan §3.2).
SO_LIEU_TOI_DA = 4

#: `YYYY-MM-DD` đúng mười ký tự. `date.fromisoformat` một mình nhận cả `20261113` (Python
#: 3.11+), tức hai URL cho một bản tin.
_DANG_NGAY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def doc_ngay(chuoi: str) -> date | None:
    """`YYYY-MM-DD` → `date`, sai dạng hoặc ngày không có thật ⇒ `None`."""
    if not _DANG_NGAY.match(chuoi):
        return None
    try:
        return date.fromisoformat(chuoi)
    except ValueError:
        return None


def url_ban_tin(ngay: date) -> str:
    """Đường dẫn trang một bản tin — `/s/tin-tuc/<ngày>` (plan §1, user chốt)."""
    return f"/s/{SUB_BAN_TIN}/{ngay.isoformat()}"


def _ban_tin_hien():
    return BanTin.objects.filter(hidden_at__isnull=True)


def _khung_theo_thu_tu(ban_tin: BanTin) -> list[BanTinKhung]:
    """Khung theo thứ tự `KhungBanTin`, KHÔNG theo `created_at` (plan §3.1)."""
    return sorted(ban_tin.khung.all(), key=lambda k: THU_TU_KHUNG[k.khung])


class BanTinTomTatOut(Schema):
    """Một hàng của trang danh sách `/s/tin-tuc`."""

    ngay: date
    title: str
    cap_nhat_luc: datetime
    #: Khoá các khung đã đăng, theo thứ tự hiển thị.
    khung_da_co: list[KhungOut]
    #: ≤ 4 cặp đầu của khung ĐẦU TIÊN (theo thứ tự hiển thị) có `figures`.
    so_lieu: list[FigureOut]


class TrangBanTinOut(Schema):
    """Một trang danh sách. `cursor_ke_tiep = null` nghĩa là hết."""

    items: list[BanTinTomTatOut]
    cursor_ke_tiep: str | None


class KhungBanTinOut(Schema):
    khung: KhungOut
    #: Tên khung để hiển thị ("Đêm qua"…).
    ten: str
    created_at: datetime
    #: HTML đã lọc bằng cùng bộ lọc với thân mốc.
    body: str
    figures: list[FigureOut] | None


class BanTinChiTietOut(Schema):
    ngay: date
    title: str
    created_at: datetime
    cap_nhat_luc: datetime
    view_count: int
    khung: list[KhungBanTinOut]
    #: Ngày của bản tin HIỆN ĐƯỢC liền trước / liền sau, hoặc `null`.
    ngay_truoc: date | None
    ngay_sau: date | None


class NgayBanTinOut(Schema):
    ngay: date


class BanTinMoiIn(Schema):
    """Thân `POST /ban-tin`. Trường thừa (vd `question_for_crowd` của bot cũ) bị bỏ qua."""

    khung: KhungOut
    title: str = Field(min_length=1, max_length=DAI_TITLE)
    body: str = Field(min_length=1, max_length=DAI_BODY_MOC)
    figures: list[FigureIn] | None = None


class BanTinDaDangOut(Schema):
    ngay: date
    khung: KhungOut
    #: Đường dẫn tương đối của trang bản tin, vd `/s/tin-tuc/2026-11-13`.
    url: str
    #: Thân ĐÃ LỌC đúng như đã lưu — để người đăng (bot) so với thân đã gửi và biết bộ lọc
    #: có gỡ mất cấu trúc không (cùng lý do `MocOut.body` ở đường cũ).
    body: str


def _so_lieu(khung: list[BanTinKhung]) -> list[FigureOut]:
    for k in khung:
        if k.figures:
            return [FigureOut(**f) for f in k.figures[:SO_LIEU_TOI_DA]]
    return []


def _tom_tat_ra(ban_tin: BanTin) -> BanTinTomTatOut:
    khung = _khung_theo_thu_tu(ban_tin)
    return BanTinTomTatOut(
        ngay=ban_tin.ngay,
        title=ban_tin.title,
        cap_nhat_luc=ban_tin.cap_nhat_luc,
        khung_da_co=[k.khung for k in khung],
        so_lieu=_so_lieu(khung),
    )


@router.get(
    "/ban-tin",
    response={200: TrangBanTinOut, 400: LoiOut},
    operation_id="liet_ke_ban_tin",
    tags=["ban-tin"],
)
def liet_ke_ban_tin(request, cursor: str | None = None, limit: int = GIOI_HAN_MAC_DINH):
    """Danh sách bản tin, mới → cũ theo ngày. Bản đã ẩn không có mặt.

    `limit` 1..50 (mặc định 20); cursor sai ⇒ 400 `cursor_khong_hop_le`.
    """
    if (sai := kiem_gioi_han(limit)) is not None:
        return sai
    qs = _ban_tin_hien()
    if cursor is not None:
        try:
            thu_tu_ngay, id_cuoi = giai_ma_cursor_so(cursor)
            ngay_cuoi = date.fromordinal(thu_tu_ngay)
        except (CursorHong, ValueError, OverflowError):
            return loi(400, CURSOR_KHONG_HOP_LE, "cursor không hợp lệ.")
        qs = loc_keyset(qs, truong="ngay", khi=ngay_cuoi, id=id_cuoi, giam_dan=True)
    hang = list(
        qs.prefetch_related("khung")
        .order_by("-ngay", "-pk")[: limit + 1]
    )
    trang, con_nua = cat_trang(hang, limit)
    ke_tiep = (
        ma_hoa_cursor_so(trang[-1].ngay.toordinal(), trang[-1].pk) if con_nua else None
    )
    return TrangBanTinOut(items=[_tom_tat_ra(b) for b in trang], cursor_ke_tiep=ke_tiep)


@router.get(
    "/ban-tin/tu-mach/{int:mach_id}",
    response={200: NgayBanTinOut, 404: LoiOut},
    operation_id="tim_ban_tin_tu_mach_cu",
    tags=["ban-tin"],
)
def tim_ban_tin_tu_mach_cu(request, mach_id: int):
    """Ngày của bản tin đã chuyển từ mạch cũ `mach_id`, để web trả 301 `/m/…` → `/s/tin-tuc/<ngày>`.

    Mạch không phải bản tin đã chuyển, hoặc bản tin đã ẩn ⇒ 404 `khong_tim_thay`.
    """
    ban_tin = _ban_tin_hien().filter(mach_cu_id=mach_id).first()
    if ban_tin is None:
        return khong_tim_thay(f"bản tin từ mạch {mach_id}")
    return NgayBanTinOut(ngay=ban_tin.ngay)


@router.get(
    "/ban-tin/{ngay}",
    response={200: BanTinChiTietOut, 404: LoiOut},
    operation_id="xem_ban_tin",
    tags=["ban-tin"],
)
def xem_ban_tin(request, ngay: str):
    """Một bản tin theo ngày VN (`YYYY-MM-DD`), khung theo thứ tự đêm qua → trước phiên VN → trước phiên Mỹ.

    Sai dạng, không có, hoặc đã ẩn ⇒ 404 `khong_tim_thay`.
    """
    ngay_doc = doc_ngay(ngay)
    if ngay_doc is None:
        return khong_tim_thay(f"bản tin ngày {ngay!r}")
    ban_tin = _ban_tin_hien().filter(ngay=ngay_doc).prefetch_related("khung").first()
    if ban_tin is None:
        return khong_tim_thay(f"bản tin ngày {ngay!r}")
    truoc = (
        _ban_tin_hien()
        .filter(ngay__lt=ngay_doc)
        .order_by("-ngay")
        .values_list("ngay", flat=True)
        .first()
    )
    sau = (
        _ban_tin_hien()
        .filter(ngay__gt=ngay_doc)
        .order_by("ngay")
        .values_list("ngay", flat=True)
        .first()
    )
    return BanTinChiTietOut(
        ngay=ban_tin.ngay,
        title=ban_tin.title,
        created_at=ban_tin.created_at,
        cap_nhat_luc=ban_tin.cap_nhat_luc,
        view_count=ban_tin.view_count,
        khung=[
            KhungBanTinOut(
                khung=k.khung,
                ten=KhungBanTin(k.khung).label,
                created_at=k.created_at,
                body=k.body,
                figures=[FigureOut(**f) for f in k.figures] if k.figures else None,
            )
            for k in _khung_theo_thu_tu(ban_tin)
        ],
        ngay_truoc=truoc,
        ngay_sau=sau,
    )


@router.post(
    "/ban-tin",
    response={201: BanTinDaDangOut, 400: LoiOut, 401: LoiOut, 403: LoiOut, 409: LoiOut},
    operation_id="dang_ban_tin",
    tags=["ban-tin"],
    auth=dang_nhap,
)
def dang_ban_tin(request, du_lieu: BanTinMoiIn):
    """Đăng một khung bản tin. **Chỉ tài khoản đội** (`la_tai_khoan_doi`); khác ⇒ 403 `khong_phai_tai_khoan_doi`.

    Server tự lấy ngày VN. Chưa có bản tin ngày đó ⇒ tạo (dùng `title`); có rồi ⇒ thêm khung
    (bỏ qua `title`). Khung đã đăng ⇒ 409 `khung_da_dang`. Thân HTML qua cùng bộ lọc với mốc;
    lọc xong rỗng hoặc `figures` sai dạng ⇒ 400 `du_lieu_khong_hop_le`.
    """
    # GHI CHÚ NỘI BỘ: cờ `la_tai_khoan_doi`, KHÔNG phải `is_staff` — mod không phải tài
    # khoản đăng bản tin (plan §3.2, cùng cổng với `bai_viet` ở `api/quyen.py`).
    if not getattr(request.user, "la_tai_khoan_doi", False):
        raise LoiGhi(
            403,
            KHONG_PHAI_TAI_KHOAN_DOI,
            "Bản tin chỉ đăng được bằng tài khoản của gikky.",
        )
    try:
        ban_tin, khung, _tao = dang_khung_ban_tin(
            tac_gia=request.user,
            khung=du_lieu.khung,
            title=du_lieu.title,
            body=du_lieu.body,
            figures=figures_ra_dict(du_lieu.figures),
        )
    except KhungDaDang as e:
        raise LoiGhi(409, KHUNG_DA_DANG, str(e)) from e
    except LoiModel as e:
        raise LoiGhi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages)) from e
    return Status(
        201,
        BanTinDaDangOut(
            ngay=ban_tin.ngay,
            khung=khung.khung,
            url=url_ban_tin(ban_tin.ngay),
            body=khung.body,
        ),
    )
