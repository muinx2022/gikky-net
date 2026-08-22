"""Múi giờ sản phẩm — PLAN mục 1: mọi "ngày"/"hôm nay" là **Asia/Ho_Chi_Minh**.

Server lưu UTC (`USE_TZ = True`); chỗ nào nói "ngày" thì quy đổi ở đây, một chỗ.
Ba luật của sản phẩm treo vào hàm này:

- rate limit 3 mốc / **ngày lịch VN** / mạch (PLAN 5.1);
- `occurred_at` mặc định = **hôm nay giờ VN**, cấm ngày tương lai (PLAN 5.2);
- `dedupe_key` thông báo `"moc_moi:{mach_id}:{yyyymmdd theo giờ VN}"` (PLAN 5.8).

Cả ba đều sai lệch 7 tiếng nếu ai đó tính theo UTC — và sai lệch đó chỉ lộ ra trong
khung 17:00–24:00 giờ VN, tức là đúng khung giờ ít người chạy test nhất.
"""

from datetime import date, datetime, time, timedelta
from typing import Literal, get_args
from zoneinfo import ZoneInfo

from django.utils import timezone

MUI_GIO_VN = "Asia/Ho_Chi_Minh"
TZ_VN = ZoneInfo(MUI_GIO_VN)

#: Bốn khoảng của feed "Nhiều điểm nhất" — plan con 1d §1, `?khoang=`.
#:
#: **`Literal` là NGUỒN, ba dòng dưới suy ra từ nó** *(W9, lượt vá 2)*. Trước đó
#: `KhoangThoiGian` là một hằng CHẾT — không module nào import — nên chữ ký endpoint nhận
#: `khoang: str`, `openapi.json` ra `"type": "string"` trơn, và `apps/web/lib/api.ts`
#: phải **tự khai lại** danh sách bốn giá trị. Đó là bản sao thứ hai của hợp đồng API,
#: đúng thứ PLAN 8.3 và `gikky-net/CLAUDE.md` cấm.
#:
#: Bộ ba tên hằng vẫn ở lại (chúng đọc ra nghĩa ở chỗ gọi), nhưng chúng **giải nén** từ
#: `get_args` chứ không gõ lại: thêm một khoảng vào `Literal` mà quên chỗ nào thì
#: `ValueError: too many values to unpack` nổ ngay lúc import, không phải một feed lặng
#: lẽ thiếu lựa chọn.
KhoangThoiGian = Literal["ngay", "tuan", "thang", "tat_ca"]
KHOANG_HOP_LE: tuple[str, ...] = get_args(KhoangThoiGian)
KHOANG_NGAY, KHOANG_TUAN, KHOANG_THANG, KHOANG_TAT_CA = KHOANG_HOP_LE

#: Số **ngày lịch VN** mỗi khoảng phủ, tính CẢ hôm nay. `tuan` = hôm nay + 6 ngày trước.
SO_NGAY_KHOANG = {KHOANG_NGAY: 1, KHOANG_TUAN: 7, KHOANG_THANG: 30}


def ngay_vn(khi: datetime | None = None) -> date:
    """Ngày lịch Việt Nam của một thời điểm (mặc định: bây giờ).

    Truyền `timezone` tường minh cho `localdate` thay vì dựa vào `settings.TIME_ZONE`:
    hai thứ đó *đang* trùng nhau, nhưng `TIME_ZONE` là cấu hình hiển thị của Django —
    ai đổi nó sang UTC cho hợp log prod sẽ lặng lẽ dời luôn ranh giới "ngày" của ba
    luật sản phẩm ở trên. Múi giờ sản phẩm không phải là cấu hình.
    """
    return timezone.localdate(khi, timezone=TZ_VN)


def moc_khoang_vn(khoang: str, khi: datetime | None = None) -> datetime | None:
    """Mốc thời gian sớm nhất còn được tính vào `khoang`, hoặc `None` với `tat_ca`.

    Trả về một `datetime` **aware**, đúng **00:00 giờ VN** của ngày mở đầu khoảng. Người
    gọi lọc `created_at >= mốc`.

    **Ranh giới là NỬA ĐÊM GIỜ VN, không phải "N × 24 giờ tính từ bây giờ"** — PLAN mục 1
    chốt mọi chữ "ngày" trong sản phẩm theo múi giờ VN. Hệ quả nhìn thấy được, và nó là
    chủ đích: lúc 00:30 giờ VN thì `?khoang=ngay` chỉ còn 30 phút nội dung, đúng như
    "hôm nay" nghĩa đen. Cửa sổ trượt 24 giờ sẽ cho ra một tập khác và không ai gọi tên
    được nó bằng tiếng Việt.

    Ba khoảng đếm theo **số ngày lịch, tính cả hôm nay** (`SO_NGAY_KHOANG`): `tuan` là
    7 ngày lịch gần nhất chứ không phải "tuần lịch tính từ thứ Hai", `thang` là 30 ngày
    lịch chứ không phải "tháng dương lịch hiện tại". Chọn cửa sổ trượt theo ngày vì tuần
    lịch/tháng lịch làm feed teo lại gần bằng 0 vào sáng thứ Hai và ngày mùng 1 — đúng
    thứ nguyên tắc 9 cấm phô ra.

    `khoang` phải thuộc `KHOANG_HOP_LE`; giá trị lạ ném `ValueError` chứ không lặng lẽ
    quy về `tat_ca` (một chữ gõ nhầm không được biến "top tuần" thành "top mọi thời đại"
    mà vẫn HTTP 200). Tầng API kiểm trước và trả 400.
    """
    if khoang == KHOANG_TAT_CA:
        return None
    if khoang not in SO_NGAY_KHOANG:
        raise ValueError(
            f"khoang phải thuộc {{{', '.join(KHOANG_HOP_LE)}}}, nhận {khoang!r}."
        )
    ngay_dau = ngay_vn(khi) - timedelta(days=SO_NGAY_KHOANG[khoang] - 1)
    return datetime.combine(ngay_dau, time.min, tzinfo=TZ_VN)


def khoa_ngay_vn(khi: datetime | None = None) -> str:
    """`yyyymmdd` theo giờ VN — thành phần ngày của `Notification.dedupe_key`."""
    return ngay_vn(khi).strftime("%Y%m%d")


def nua_dem_vn_ke_tiep(khi: datetime | None = None) -> datetime:
    """00:00 giờ VN của NGÀY MAI — lúc hạn mức 3 mốc/ngày được nạp lại (PLAN 5.1).

    Hạn mức đếm theo **ngày lịch VN** chứ không theo cửa sổ 24 giờ trượt (xem
    `moc_khoang_vn`), nên mốc "viết tiếp được từ lúc nào" luôn là nửa đêm VN kế tiếp — và
    lúc 23:50 thì đó là **mười phút nữa**, không phải một ngày nữa.

    Trả về ở đây thay vì để frontend tự cộng ngày: câu của server dừng ở *"mai nối tiếp
    nhé"*, và ba bản sao của luật này ở `apps/web` (nợ `API-THIEU-MOC-THOI-GIAN`) đã phải
    tự dựng lại cả phép đổi múi giờ để nói được con số. Server biết sẵn, nên server nói.
    """
    mai = ngay_vn(khi) + timedelta(days=1)
    return datetime.combine(mai, time.min, tzinfo=TZ_VN)
