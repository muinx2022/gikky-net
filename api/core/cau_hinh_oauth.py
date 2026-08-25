"""Cấu hình Google OAuth lúc CHẠY — hàng `SocialApp` là nguồn chính, env là dự phòng.

Chốt 2026-08-24 (`plans/2026-08-24-cai-dat-google-oauth.md`). Trước đó credential chỉ đến
từ env và được đọc **một lần lúc boot**; user cần nhập trong khu quản trị và thấy hiệu lực
ngay, nên nguồn chính chuyển sang DB.

## Vì sao hỏi allauth chứ không tự đếm hàng

`google_dang_bat()` gọi thẳng `get_adapter().get_app()` — đúng cái hàm allauth dùng khi
người ta bấm nút. Tự viết một phép kiểm riêng ("có hàng `SocialApp` không?") là dựng bản
thứ hai của cùng một câu hỏi, và bản thứ hai sẽ lệch: nó không biết cờ `hidden`, không
biết `on_site`, không biết app từ settings. Lệch ở đây nghĩa là nút hiện ra rồi bấm vào
thì lỗi — đúng thứ PLAN mục 4 cấm.

## ⚠ `on_site`: hàng phải được nối vào `Site`

`SocialApp.objects.on_site()` lọc `sites__id=<site hiện tại>`. Tạo hàng mà quên
`app.sites.add(site)` thì allauth **không bao giờ thấy nó**: nút vẫn tắt, không lỗi, không
log — và người đi sửa sẽ đi soi credential chứ không soi bảng nối. `luu_google()` dưới đây
là chỗ DUY NHẤT tạo hàng, đúng để cái bẫy ấy chỉ phải đóng một lần.

## Secret không đi ra ngoài

`doc_trang_thai()` cố ý **không có** trường secret, chỉ có `secret_duoi` (4 ký tự cuối).
Đủ để người ta nhận ra mình đã dán đúng chuỗi nào, không đủ để dùng lại. Đây là hàm mà
tầng API gọi; không có đường nào khác trả cấu hình ra ngoài.
"""

from dataclasses import dataclass

from allauth.socialaccount.adapter import get_adapter
from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.contrib.sites.models import Site
from django.http import HttpRequest

#: `provider` của allauth. Chuỗi trần vì allauth cũng dùng chuỗi trần.
PROVIDER = "google"

#: Số ký tự cuối của secret được phép ra ngoài. 4 là đủ để nhận dạng, không đủ để đoán.
DAI_DUOI = 4


@dataclass(frozen=True)
class TrangThaiGoogle:
    """Thứ khu quản trị được biết. **Không có secret** — xem docstring module."""

    bat: bool
    #: `"db"` · `"env"` · `None`. Trả lời "con số đang chạy đến từ đâu", câu mà một trang
    #: cài đặt hai nguồn bắt buộc phải trả lời — nếu không, người sửa DB mà thấy không đổi
    #: gì sẽ đi tìm lỗi ở chỗ không có lỗi.
    nguon: str | None
    client_id: str
    secret_da_dat: bool
    secret_duoi: str


def _hang_db() -> SocialApp | None:
    """Hàng `SocialApp` của Google trên site hiện tại, hoặc `None`.

    Lọc theo `sites` chứ không `SocialApp.objects.filter(provider=...)` trần: một hàng
    không nối site là hàng allauth không thấy, và trang cài đặt báo "đang bật" cho một
    thứ không chạy là lời nói dối tệ nhất mà trang này có thể nói.
    """
    return (
        SocialApp.objects.filter(provider=PROVIDER, sites__id=settings.SITE_ID)
        .order_by("pk")
        .first()
    )


def google_dang_bat(request=None) -> bool:
    """Google có dùng được **ngay lúc này** không — hỏi đúng đường allauth sẽ đi.

    ⚠ **Luôn truyền một request, kể cả khi người gọi không có** — `HttpRequest()` rỗng là
    đủ. Lý do nằm trong `SocialAppAdapter.list_apps`:

        if request:
            db_apps = SocialApp.objects.on_site(request)   # CÓ lọc theo site
        else:
            db_apps = SocialApp.objects.all()              # KHÔNG lọc

    Gọi với `request=None` là bỏ qua phép lọc site, tức hàm này sẽ trả `True` cho một hàng
    mà **luồng đăng nhập thật không bao giờ thấy** (luồng thật luôn có request). Hệ quả
    đúng bằng thứ PLAN mục 4 cấm: nút hiện ra, bấm vào thì lỗi. Bắt được lúc viết bài đo
    `test_hang_KHONG_noi_site_thi_coi_nhu_khong_co`, trước khi nó kịp ra ngoài.

    `HttpRequest()` rỗng an toàn vì `SITE_ID` đã đặt: `get_current_site` khi đó trả site
    theo `SITE_ID` và **không** đụng tới `request.get_host()`. Nếu ngày nào đó `SITE_ID`
    biến mất thì lệnh dưới ném, `except` bắt, và câu trả lời là "tắt" — hướng an toàn.
    """
    try:
        get_adapter().get_app(request or HttpRequest(), PROVIDER)
    except Exception:
        # `SocialApp.DoesNotExist` (không có nguồn nào) và `MultipleObjectsReturned` (cấu
        # hình hỏng) đều phải ra "tắt". Bắt rộng vì hàm này chạy trong `GET /me` — đường
        # nạp CỦA MỌI TRANG — và một ngoại lệ lạ ở đây làm chết cả trang chủ chỉ để trả
        # lời một câu hỏi phụ.
        return False
    return True


def doc_trang_thai(request=None) -> TrangThaiGoogle:
    """Trạng thái cho trang Cài đặt. Không bao giờ mang secret ra ngoài."""
    hang = _hang_db()
    if hang is not None:
        return TrangThaiGoogle(
            bat=google_dang_bat(request),
            nguon="db",
            client_id=hang.client_id,
            secret_da_dat=bool(hang.secret),
            secret_duoi=hang.secret[-DAI_DUOI:] if hang.secret else "",
        )
    if settings.GOOGLE_ENV_CO:
        return TrangThaiGoogle(
            bat=google_dang_bat(request),
            nguon="env",
            client_id=settings.GOOGLE_CLIENT_ID,
            secret_da_dat=True,
            secret_duoi=settings.GOOGLE_CLIENT_SECRET[-DAI_DUOI:],
        )
    return TrangThaiGoogle(
        bat=False, nguon=None, client_id="", secret_da_dat=False, secret_duoi=""
    )


def luu_google(*, client_id: str, secret: str | None) -> SocialApp:
    """Tạo hoặc cập nhật hàng `SocialApp`. Trả về hàng đã lưu.

    `secret=None` nghĩa là **giữ nguyên secret cũ**, không phải xoá. Ô nhập secret trên
    giao diện để trống là chuyện bình thường — người ta sửa `client_id` mà không muốn dán
    lại secret. Nếu "trống" mà xoá thì mỗi lần sửa `client_id` là một lần vô tình gỡ Google
    khỏi site, và triệu chứng (nút biến mất) không trỏ về nguyên nhân.

    Hàng mới **bắt buộc** nối vào `Site` — xem cảnh báo `on_site` ở docstring module.
    """
    hang = _hang_db()
    if hang is None:
        hang = SocialApp.objects.create(
            provider=PROVIDER,
            name="Google",
            client_id=client_id,
            secret=secret or "",
        )
        hang.sites.add(Site.objects.get(pk=settings.SITE_ID))
        return hang

    hang.client_id = client_id
    if secret is not None:
        hang.secret = secret
    hang.save(update_fields=["client_id", "secret"])
    # Hàng cũ có thể được tạo bởi Django admin mà quên nối site — vá tại chỗ thay vì để nó
    # im lặng không có tác dụng.
    if not hang.sites.filter(pk=settings.SITE_ID).exists():
        hang.sites.add(Site.objects.get(pk=settings.SITE_ID))
    return hang


def xoa_google() -> bool:
    """Xoá hàng DB. Trả `True` nếu vừa xoá thật.

    Sau lệnh này env (nếu có) lại thành nguồn — đó là ý nghĩa của "dự phòng", và trang
    cài đặt phải nói ra điều đó chứ không báo "đã tắt" khi env vẫn đang bật.
    """
    hang = _hang_db()
    if hang is None:
        return False
    hang.delete()
    return True
