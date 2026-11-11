"""Lệnh có cấu trúc của nhật ký (`Mach.lenh_*`) — luật miền, chuẩn hoá, tỉ lệ R:R.

`plans/2026-11-11-homepage-v2-giao-dien-moi.md` §6.1. Module THUẦN (không truy vấn DB): cả cửa
`POST /machs` lẫn bất kỳ đường ghi nào sau này đi qua `core/ghi.py::tao_mach`, nơi gọi
`kiem_lenh` — luật nằm một chỗ ở đây, không chép vào schema (schema chỉ chặn hình dạng).
"""

import re
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal

from django.core.exceptions import ValidationError

#: Hai chiều hợp lệ — chép tay từ `Mach.LenhChieu` để module này không import model (test
#: `test_lenh.py` ghim hai tập bằng nhau).
CHIEU_MUA = "mua"
CHIEU_BAN = "ban"
CAC_CHIEU = (CHIEU_MUA, CHIEU_BAN)

DAI_MA = 20
#: Mã giao dịch: chữ-số và `. _ / -` (HPG, USD/JPY, BTC-USDT, BRK.B). Khớp `Field(pattern=…)`
#: ở `api/schemas_ghi.py::LenhIn`.
MAU_MA = re.compile(r"^[A-Za-z0-9._/-]{1,20}$")

#: Khớp `DecimalField(max_digits=20, decimal_places=8)` của cột — kiểm TRƯỚC khi ghi để lỗi là
#: 400 chứ không phải `InvalidOperation` / `DataError` ở tầng DB.
SO_CHU_SO_TOI_DA = 20
SO_LE_TOI_DA = 8


@dataclass(frozen=True)
class Lenh:
    """Lệnh đã qua cổng schema: `ma` chưa chắc đã IN HOA, số chưa chắc đã vừa cột."""

    chieu: str
    ma: str
    gia_vao: Decimal
    sl: Decimal | None = None
    tp: Decimal | None = None
    nhoi: Decimal | None = None


def _kiem_so(ten: str, d: Decimal | None) -> None:
    if d is None:
        return
    if not d.is_finite() or d <= 0:
        raise ValidationError(f"{ten} phải là số dương.")
    _dau, chu_so, mu = d.as_tuple()
    # `mu` âm = số chữ số lẻ; số 10 (mu dương) không có phần lẻ.
    so_le = max(0, -mu)
    if so_le > SO_LE_TOI_DA:
        raise ValidationError(f"{ten} tối đa {SO_LE_TOI_DA} chữ số thập phân.")
    # Số chữ số nguyên = tổng chữ số − chữ số lẻ (số nhỏ hơn 1 thì 0 chữ số nguyên).
    so_nguyen = max(0, len(chu_so) + mu)
    if so_nguyen > SO_CHU_SO_TOI_DA - SO_LE_TOI_DA:
        raise ValidationError(
            f"{ten} quá lớn (tối đa {SO_CHU_SO_TOI_DA - SO_LE_TOI_DA} chữ số nguyên)."
        )


def kiem_lenh(lenh: Lenh) -> Lenh:
    """Kiểm luật miền và trả bản chuẩn hoá (`ma` IN HOA). Ném `ValidationError`.

    - chiều ∈ {mua, ban}; mã khớp `MAU_MA`; mọi số > 0 và vừa cột;
    - thứ tự khi có: **MUA** ⇒ `sl < vào < tp`; **BÁN** ⇒ `tp < vào < sl`. Chỉ so cặp mà cả
      hai đầu cùng có (khai mỗi SL thì chỉ kiểm SL với giá vào). `nhoi` không bị ràng buộc
      thứ tự: nó là giá nhồi thêm, nằm ở phía nào cũng là chiến thuật của tác giả.
    """
    if lenh.chieu not in CAC_CHIEU:
        raise ValidationError(f"Chiều lệnh phải thuộc {list(CAC_CHIEU)}, nhận {lenh.chieu!r}.")
    ma = lenh.ma.strip()
    if not MAU_MA.match(ma):
        raise ValidationError(
            "Mã chỉ gồm chữ, số và các ký tự . _ / - (tối đa "
            f"{DAI_MA} ký tự)."
        )
    _kiem_so("Giá vào", lenh.gia_vao)
    _kiem_so("SL", lenh.sl)
    _kiem_so("TP", lenh.tp)
    _kiem_so("Giá nhồi", lenh.nhoi)

    vao = lenh.gia_vao
    if lenh.chieu == CHIEU_MUA:
        if lenh.sl is not None and not lenh.sl < vao:
            raise ValidationError("Lệnh MUA: SL phải thấp hơn giá vào.")
        if lenh.tp is not None and not vao < lenh.tp:
            raise ValidationError("Lệnh MUA: TP phải cao hơn giá vào.")
    else:
        if lenh.tp is not None and not lenh.tp < vao:
            raise ValidationError("Lệnh BÁN: TP phải thấp hơn giá vào.")
        if lenh.sl is not None and not vao < lenh.sl:
            raise ValidationError("Lệnh BÁN: SL phải cao hơn giá vào.")
    return Lenh(
        chieu=lenh.chieu,
        ma=ma.upper(),
        gia_vao=lenh.gia_vao,
        sl=lenh.sl,
        tp=lenh.tp,
        nhoi=lenh.nhoi,
    )


def chuoi_so(d: Decimal | None) -> str | None:
    """`Decimal` → chuỗi thập phân đã bỏ số 0 thừa, KHÔNG BAO GIỜ ra dạng mũ.

    `Decimal("10.00000000").normalize()` là `1E+1` — `str()` của nó ra "1E+1", còn
    `format(…, "f")` ra "10". `Decimal("33.20000000")` → "33.2"; `0.00012000` → "0.00012".
    """
    if d is None:
        return None
    return format(d.normalize(), "f")


def ty_le_rr(
    vao: Decimal | None, sl: Decimal | None, tp: Decimal | None
) -> str | None:
    """R:R = |tp − vào| / |vào − sl|; chỉ khi có đủ ba số.

    Làm tròn **1** chữ số lẻ khi R:R ≥ 1 ("2.4"), **2** chữ số khi R:R < 1 ("0.25"): với
    vào 10, SL 9, TP 10.01 thì R:R = 0.01, làm tròn 1 chữ số ra "0.0" — một con số trông như
    "không có lợi nhuận" trong khi nó chỉ nhỏ. Nếu ngay cả 2 chữ số cũng ra 0.00 (R:R < 0.005)
    thì trả `None`: một R:R vô nghĩa còn tệ hơn không hiện.

    `None` khi thiếu SL hoặc TP, hoặc khi vào = SL (chia 0 — CHECK/`kiem_lenh` không để lọt,
    phòng thủ cho hàng nạp tay).
    """
    if vao is None or sl is None or tp is None:
        return None
    rui_ro = abs(vao - sl)
    if rui_ro == 0:
        return None
    ty_le = abs(tp - vao) / rui_ro
    if ty_le >= 1:
        return str(ty_le.quantize(Decimal("0.1"), rounding=ROUND_HALF_UP))
    ra = ty_le.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
    return None if ra == 0 else str(ra)
