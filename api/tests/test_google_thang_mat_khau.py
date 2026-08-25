"""Google thắng mật khẩu — khớp email ⇒ xoá mật khẩu tài khoản đó.

User chốt 2026-08-24: *"khi login gg và login qua email, nếu trùng email, cần phải ưu tiên
gg, xoá pass luôn, cần thì update lại, không giữ pass khi login gg mà trùng email"*.

## Vì sao cần adapter riêng, khi allauth đã có `wipe_password`

allauth có sẵn `wipe_password`, nhưng nó **thoát sớm khi email đã xác thực**:

    if address and address.verified:
        return   # "Verified email address, no reason to worry."

gikky đặt `ACCOUNT_EMAIL_VERIFICATION = "mandatory"` nên gần như **mọi** tài khoản nội bộ
đều đã xác thực ⇒ nhánh ấy `return` ⇒ mật khẩu được giữ. Ở đúng cấu hình của gikky, hành
vi mặc định của allauth gần như không bao giờ chạy. Đó là lý do `AdapterMangXaHoi` tồn
tại: nó xoá **không điều kiện**, ngay ở `pre_social_login`.

## ⚠ Phạm vi harness — đọc trước khi tin bài đo này chứng minh gì

`dang_nhap_google()` dừng ở `flows.login.pre_social_login`, tức **trước** `_accept_login`
— mà `_accept_login` mới là chỗ allauth gọi `wipe_password` của nó. Nên trong file này,
**cả hai** ca (email đã xác thực và chưa) đều do adapter CỦA CHÚNG TA xoá; đường native
của allauth không chạy lần nào.

Đo được, không phải suy đoán: gỡ `SOCIALACCOUNT_ADAPTER` ra thì **cả hai** bài ĐỎ, không
phải một. Bản đầu của docstring này khẳng định ca "chưa xác thực" xanh nhờ allauth — sai,
và nó đã bị chính lượt thử phá bác bỏ.

Hệ quả phải biết: file này chứng minh **adapter của ta chạy và xoá đúng ca cần xoá**; nó
**không** chứng minh gì về hành vi native của allauth trong luồng OAuth đầy đủ. Luồng đầy
đủ vẫn chưa từng chạy thật ở đâu — nợ có tên `GOOGLE-CHUA-DO`.
"""

import pytest
from allauth.account.models import EmailAddress
from allauth.socialaccount.models import SocialLogin
from django.contrib.sites.models import Site
from django.http import HttpRequest
from django.test import override_settings

from core.cau_hinh_oauth import luu_google
from core.models import User

pytestmark = pytest.mark.django_db

EMAIL = "trung@vi-du.gikky.net"
MAT_KHAU = "mat-khau-cu-khong-doan-duoc"


def bat_google():
    return override_settings(
        GOOGLE_ENV_CO=False,
        GOOGLE_CLIENT_ID="",
        GOOGLE_CLIENT_SECRET="",
        SOCIALACCOUNT_PROVIDERS={
            "google": {"SCOPE": ["profile", "email"], "EMAIL_AUTHENTICATION": True}
        },
    )


def dung_tai_khoan(*, da_xac_thuc: bool) -> User:
    u = User.objects.create(username="nguoi_cu", display_name="Người Cũ", email=EMAIL)
    u.set_password(MAT_KHAU)
    u.save()
    EmailAddress.objects.create(
        user=u, email=EMAIL, verified=da_xac_thuc, primary=True
    )
    assert u.has_usable_password()
    return u


def dang_nhap_google(email: str = EMAIL):
    """Chạy đúng đoạn allauth chạy khi Google trả về: `lookup()` rồi `pre_social_login`.

    Không dựng cả vòng OAuth (không có credential Google thật ở máy dev — nợ có tên
    `GOOGLE-CHUA-DO`), nhưng **cũng không tự gọi adapter của mình**: gọi qua
    `flows.login.pre_social_login`, tức đúng hàm allauth gọi, đúng thứ tự
    (`lookup()` trước — chỗ email được khớp — rồi mới tới adapter).
    """
    from allauth.socialaccount.adapter import get_adapter
    from allauth.socialaccount.internal.flows.login import pre_social_login
    from allauth.socialaccount.models import SocialAccount

    request = HttpRequest()
    request.session = {}

    # `provider` phải là provider THẬT (đã gắn `SocialApp`): `can_authenticate_by_email`
    # đọc `login.provider.app` để tra cờ `EMAIL_AUTHENTICATION`. Để `None` thì allauth ném
    # `AttributeError` — tức bài đo sẽ không bao giờ chạm tới đoạn khớp email.
    provider = get_adapter().get_provider(request, "google")

    sociallogin = SocialLogin(
        user=User(username="tu-google", email=email),
        account=SocialAccount(provider="google", uid="uid-google-123"),
        email_addresses=[EmailAddress(email=email, verified=True, primary=True)],
        provider=provider,
    )
    pre_social_login(request, sociallogin)
    return sociallogin


# --- Hai ca khớp email, cả hai đều phải xoá -------------------------------------------


def test_email_chua_xac_thuc_bi_xoa_mat_khau(db):
    """Ca tấn công kinh điển: kẻ lạ đăng ký trước bằng email của người khác.

    Kẻ lạ biết mật khẩu và chờ chủ thật đăng nhập bằng Google — lúc đó cả hai cùng vào
    được. Xoá mật khẩu khoá kẻ lạ ra ngoài.

    Trong harness này ca ấy do adapter của ta xoá, **không** phải allauth (xem "Phạm vi
    harness" ở docstring đầu file).
    """
    with bat_google():
        luu_google(client_id="x.apps.googleusercontent.com", secret="y")
        u = dung_tai_khoan(da_xac_thuc=False)

        dang_nhap_google()

        u.refresh_from_db()
        assert not u.has_usable_password()


def test_email_DA_XAC_THUC_cung_bi_xoa_mat_khau(db):
    """Ca mà allauth CỐ Ý giữ mật khẩu, còn đơn hàng của user đòi xoá.

    Đây là ca thường gặp ở gikky (xác thực email là bắt buộc), và là lý do adapter riêng
    tồn tại. Lý lẽ khác allauth: không phải chống kẻ đăng ký trước, mà là **không để một
    tài khoản có hai cửa vào**.
    """
    with bat_google():
        luu_google(client_id="x.apps.googleusercontent.com", secret="y")
        u = dung_tai_khoan(da_xac_thuc=True)

        dang_nhap_google()

        u.refresh_from_db()
        assert not u.has_usable_password(), (
            "email đã xác thực vẫn phải bị xoá mật khẩu — Google là cửa duy nhất"
        )
        assert u.check_password(MAT_KHAU) is False


def test_khong_khoa_ngoai_dat_lai_mat_khau_van_duoc(db):
    """"cần thì update lại": xoá mật khẩu không phải khoá ngoài.

    Sau khi bị xoá, đặt lại mật khẩu vẫn dùng được tài khoản — đó là đường
    `/quen-mat-khau` (chỉ cần hòm thư, đúng thứ Google vừa chứng minh là của họ).
    """
    with bat_google():
        luu_google(client_id="x.apps.googleusercontent.com", secret="y")
        u = dung_tai_khoan(da_xac_thuc=True)
        dang_nhap_google()

        u.refresh_from_db()
        u.set_password("mat-khau-moi-dat-lai")
        u.save(update_fields=["password"])

        u.refresh_from_db()
        assert u.has_usable_password()
        assert u.check_password("mat-khau-moi-dat-lai")


def test_email_KHAC_thi_khong_dung_toi_tai_khoan_cu(db):
    """Chỉ khớp email mới xoá. Một lượt Google bằng email khác không được đụng ai cả."""
    with bat_google():
        luu_google(client_id="x.apps.googleusercontent.com", secret="y")
        u = dung_tai_khoan(da_xac_thuc=True)

        dang_nhap_google(email="nguoi-khac@vi-du.gikky.net")

        u.refresh_from_db()
        assert u.has_usable_password(), "tài khoản không liên quan bị đụng"
        assert u.check_password(MAT_KHAU)


def test_site_ton_tai(db):
    assert Site.objects.exists()
