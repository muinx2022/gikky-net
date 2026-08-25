"""Năm hạn mức chống lạm dụng — PLAN mục 10 (Phase 6), PLAN 5.10, và ảnh nội dung.

| hạn mức | nguồn | ranh giới | cửa áp |
|---|---|---|---|
| 3 mốc / mạch / ngày | PLAN 5.1 | nửa đêm giờ VN | `POST /machs/{id}/mocs` |
| 10 mạch / user / ngày | PLAN mục 10 Phase 6 | nửa đêm giờ VN | `POST /machs` |
| 5 đăng ký / IP / ngày | PLAN mục 10 Phase 6 | nửa đêm giờ VN | adapter allauth |
| 5 bình luận / giờ, tài khoản < 3 ngày tuổi | PLAN 5.10 | **giờ trượt** | `POST /machs/{id}/comments` |
| 30 ảnh nội dung / user / ngày | plan 2026-08-24 | nửa đêm giờ VN | `POST /me/anh` |

Bốn cái đếm theo **ngày lịch VN** vì PLAN mục 1 chốt mọi chữ "ngày" của sản phẩm theo
`Asia/Ho_Chi_Minh`; cửa sổ trượt 24 giờ cho ra một tập khác và không gọi tên được bằng
tiếng Việt. Riêng bình luận đếm theo **giờ trượt** vì PLAN 5.10 viết "5 bình luận/giờ" —
"giờ" không có ranh giới lịch nào để bám, và một cửa sổ theo giờ tròn thì cho phép 10 bình
luận trong hai phút quanh 09:00.

## Vì sao các con số nằm ở `settings`, và cái giá của việc đó

PLAN mục 10 nói thẳng *"(đổi số được trong settings)"*. Hàm ở đây đọc `settings` **tại
thời điểm gọi**, không chụp vào hằng module: chụp lúc import là `override_settings` trong
bài đo không có tác dụng, và lúc đó bài đo phải dựng đủ 10 mạch thật để chạm trần — chậm,
và nó dạy người viết sau rằng hạn mức "không đo được".

⚠ **`api/.env.example` nới ba số này ở máy dev**, xem chính file đó. Mặc định trong
`settings.py` là con số của PLAN (tức con số chạy trên prod, nơi không ai khai biến).

## Hai chỗ KHÔNG khoá, và vì sao đó là quyết định chứ không phải quên

`dem_mach_trong_ngay_vn` và `dem_binh_luan_trong_gio` đếm **ngoài khoá**. Hệ quả biết
trước: hai request song song của cùng một người (double-click) có thể cùng đọc `9 < 10`
và lọt ra mạch thứ 11.

Không chữa bằng `select_for_update` trên hàng `User` vì đó là **dựng chu trình khoá**:
`core/thong_bao.py` ghi rõ cạnh `Mach → User` đã tồn tại (`bao_moc_moi` giữ khoá hàng
`Mach` rồi xin `FOR KEY SHARE` trên `core_user`), nên một đường ghi khoá `User` **rồi mới**
chạm `Mach` là cạnh ngược. Đổi một cái lọt-thêm-một-hàng lấy một cái 500 ngẫu nhiên dưới
tải là lỗ vốn.

Khác hẳn hạn mức 3 mốc/ngày: ở đó có sẵn hàng `Mach` để khoá, và `them_moc` **đã** khoá
đúng hàng ấy — nên phép đếm chỉ cần chuyển vào trong (L11). Có chỗ khoá đúng thì khoá.
"""

from datetime import datetime, time, timedelta

from django.conf import settings
from django.utils import timezone

from core.thoi_gian import TZ_VN, ngay_vn


def _mot_ngay_vn(khi=None) -> tuple[datetime, datetime]:
    """Nửa mở `[00:00, 24:00)` giờ VN của ngày chứa `khi`."""
    dau = datetime.combine(ngay_vn(khi), time.min, tzinfo=TZ_VN)
    return dau, dau + timedelta(days=1)


# --- 10 mạch / user / ngày lịch VN (PLAN mục 10 Phase 6) ---------------------


def tran_mach_moi_ngay() -> int:
    return settings.HAN_MUC_MACH_MOI_USER_NGAY


def dem_mach_trong_ngay_vn(user, khi=None) -> int:
    """Số mạch `user` đã ĐĂNG trong ngày lịch VN của `khi`.

    Đếm **mọi** mạch, kể cả mạch đã bị mod ẩn: cùng lý lẽ với `dem_moc_trong_ngay_vn` —
    hạn mức là hạn mức *viết*, và trừ đi phần bị ẩn nghĩa là spam càng nhiều thì càng
    được viết thêm.
    """
    from core.models.dien_dan import Mach

    dau, het = _mot_ngay_vn(khi)
    return Mach.objects.filter(
        author=user, created_at__gte=dau, created_at__lt=het
    ).count()


# --- 5 đăng ký / IP / ngày lịch VN (PLAN mục 10 Phase 6) ---------------------


def tran_dang_ky_moi_ngay() -> int:
    return settings.HAN_MUC_DANG_KY_MOI_IP_NGAY


def dia_chi_ip(request) -> str:
    """IP của người gọi. **Đọc `X-Forwarded-For` chỉ khi được phép tin nó.**

    Trên prod, Django ngồi sau Caddy: `REMOTE_ADDR` của **mọi** request là `127.0.0.1`,
    nên một hạn mức theo IP đọc thẳng `REMOTE_ADDR` sẽ hoặc chặn cả thế giới sau 5 lượt,
    hoặc (nếu ai đó thấy thế rồi tắt đi) không chặn gì. Cả hai đều im lặng.

    `settings.TIN_X_FORWARDED_FOR` mặc định **False**, và đó là mặc định đúng: tin header
    ấy khi KHÔNG có proxy phía trước là để bất kỳ ai tự khai IP của mình bằng một dòng
    header — tức hạn mức bốc hơi. Bật nó là một quyết định của người deploy, không phải
    của code.

    Lấy phần tử **cuối** danh sách chứ không phải phần tử đầu: Caddy *nối thêm* peer của
    nó vào cuối `X-Forwarded-For`, nên với đúng MỘT proxy tin cậy thì phần tử cuối là địa
    chỉ Caddy thật sự nhìn thấy. Phần tử đầu là thứ client tự khai và giả được.
    """
    if getattr(settings, "TIN_X_FORWARDED_FOR", False):
        xff = request.META.get("HTTP_X_FORWARDED_FOR", "")
        if xff:
            return xff.split(",")[-1].strip()
    return request.META.get("REMOTE_ADDR", "") or ""


def dem_dang_ky_trong_ngay_vn(ip: str, khi=None) -> int:
    """Số tài khoản đã đăng ký từ `ip` trong ngày lịch VN của `khi`.

    Nguồn là cột `User.dang_ky_ip`, không phải một bộ đếm trong cache: cache mặc định của
    Django là `LocMemCache` — mất khi tiến trình khởi động lại và **riêng cho từng
    worker**, nên trên một prod 4 worker thì "5/ngày" thành 20/ngày, im lặng.

    `ip` rỗng (không xác định được) ⇒ trả `0`: không có khoá thì không đếm được, và chặn
    theo một khoá rỗng là gộp mọi người vào chung một hạn mức.
    """
    from core.models.nguoi_dung import User

    if not ip:
        return 0
    dau, het = _mot_ngay_vn(khi)
    return User.objects.filter(
        dang_ky_ip=ip, date_joined__gte=dau, date_joined__lt=het
    ).count()


# --- 5 bình luận / giờ cho tài khoản < 3 ngày tuổi (PLAN 5.10) ---------------


def tran_binh_luan_moi_gio() -> int:
    return settings.HAN_MUC_BINH_LUAN_MOI_GIO_TAI_KHOAN_MOI


def la_tai_khoan_moi(user, khi=None) -> bool:
    """Tài khoản mở chưa quá `settings.NGAY_TAI_KHOAN_CON_MOI` ngày.

    Đo bằng `date_joined` và một khoảng **thời lượng** (72 giờ), không bằng số ngày lịch:
    "3 ngày tuổi" nói về tuổi của tài khoản, và một tài khoản mở lúc 23:50 không được già
    thêm một ngày sau mười phút.
    """
    khi = khi or timezone.now()
    return (khi - user.date_joined) < timedelta(days=settings.NGAY_TAI_KHOAN_CON_MOI)


def dem_binh_luan_trong_gio(user, khi=None) -> int:
    """Số bình luận `user` đã viết trong 60 phút gần nhất tính tới `khi`.

    Đếm **mọi** bình luận kể cả bia mộ và bình luận bị mod ẩn — xoá rồi viết lại là cách
    lách ngắn nhất, và "bị ẩn rồi nên được viết bù" là phần thưởng cho đúng hành vi hạn
    mức này sinh ra để chặn.
    """
    from core.models.binh_luan import Comment

    khi = khi or timezone.now()
    return Comment.objects.filter(
        author=user, created_at__gt=khi - timedelta(hours=1)
    ).count()


def luc_binh_luan_duoc_lai(user, khi=None) -> datetime:
    """Lúc `user` viết được câu tiếp theo — giá trị `thu_lai_tu` của lời từ chối 429.

    Là **thời điểm bình luận cũ nhất trong cửa sổ rơi ra khỏi cửa sổ**, tức
    `min(created_at) + 1 giờ`. Đó là câu trả lời đúng cho một cửa sổ trượt: nói "một giờ
    nữa" là nói thừa tới 59 phút cho người vừa chạm trần bằng năm câu viết cách đây 58
    phút.

    Không còn hàng nào trong cửa sổ (ca không xảy ra ở chỗ gọi, nhưng hàm phải trả một
    giá trị) ⇒ "ngay bây giờ".
    """
    from core.models.binh_luan import Comment

    khi = khi or timezone.now()
    cu_nhat = (
        Comment.objects.filter(author=user, created_at__gt=khi - timedelta(hours=1))
        .order_by("created_at")
        .values_list("created_at", flat=True)
        .first()
    )
    return khi if cu_nhat is None else cu_nhat + timedelta(hours=1)


# --- 30 ảnh nội dung / user / ngày lịch VN (plan 2026-08-24) -----------------


def tran_anh_noi_dung_moi_ngay() -> int:
    return settings.HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY


def dem_anh_noi_dung_trong_ngay_vn(user, khi=None) -> int:
    """Số ảnh `user` đã nhúng-tải trong ngày lịch VN của `khi` — cửa `POST /me/anh`.

    Đếm hàng `AnhNoiDung`, tức đếm **file đã nằm trên đĩa**, không đếm ảnh còn hiện trong
    một bài viết nào. Đó là phép đếm đúng cho thứ hạn mức này bảo vệ: chi phí là dung
    lượng đĩa, và xoá ảnh khỏi thân bài không trả lại byte nào (không có FK từ ảnh về mốc
    — xem `core/models/moc.py::AnhNoiDung`). Đếm theo "ảnh còn dùng" là thưởng cho đúng
    hành vi tải-rồi-xoá-rồi-tải, cùng lý lẽ với `dem_binh_luan_trong_gio`.

    **Không dưới khoá**, y hệt `dem_mach_trong_ngay_vn` và vì đúng lý do đó (khối "Hai chỗ
    KHÔNG khoá" ở đầu file): hai request song song có thể cùng đọc `29 < 30` và lọt ra tấm
    thứ 31. Đổi một tấm ảnh thừa lấy nguy cơ chu trình khoá quanh hàng `User` là lỗ vốn.
    """
    from core.models.moc import AnhNoiDung

    dau, het = _mot_ngay_vn(khi)
    return AnhNoiDung.objects.filter(
        nguoi_tai=user, created_at__gte=dau, created_at__lt=het
    ).count()
