"""Kiểm chứng vá lỗi P-20260827-5: Gửi mail lúc đăng ký thất bại không làm kẹt tài khoản vĩnh viễn.

Khi SMTP ném lỗi (hết quota, mất mạng...), bước đăng ký ban đầu (signup=True) phải cuốn sạch
hàng User và EmailAddress vừa tạo khỏi DB để người dùng có thể thử đăng ký lại sau đó.
Khi signup=False (gửi lại thư xác thực cho tài khoản đã có), lỗi gửi mail KHÔNG được xoá User.
"""

from unittest.mock import patch
import json
import pytest
from allauth.account.adapter import get_adapter
from allauth.account.models import EmailAddress, EmailConfirmation
from django.test import RequestFactory

from core.models.nguoi_dung import User

BROWSER = "/api/_allauth/browser/v1"
MAT_KHAU = "mot-mat-khau-du-dai-2026"


@pytest.mark.django_db
def test_dang_ky_loi_mail_cuon_sach_user(client):
    """Khi gửi mail xác thực đăng ký thất bại, User và EmailAddress được dọn sạch, cho phép đăng ký lại."""
    email = "loi_mail@gikky.test"
    username = "user_loi_mail"
    payload = {"email": email, "username": username, "password": MAT_KHAU}

    # Giả lập SMTP ném lỗi quota hoặc lỗi kết nối khi gửi mail
    with patch(
        "allauth.account.adapter.DefaultAccountAdapter.send_confirmation_mail",
        side_effect=RuntimeError("SMTP quota exceeded"),
    ):
        with pytest.raises(RuntimeError, match="SMTP quota exceeded"):
            client.post(
                f"{BROWSER}/auth/signup",
                data=json.dumps(payload),
                content_type="application/json",
            )

    # 1. Khẳng định: User và EmailAddress KHÔNG còn trong DB
    assert not User.objects.filter(email=email).exists()
    assert not User.objects.filter(username=username).exists()
    assert not EmailAddress.objects.filter(email=email).exists()

    # 2. Sau khi SMTP hoạt động trở lại: Đăng ký lại với đúng email & username đó thành công
    res = client.post(
        f"{BROWSER}/auth/signup",
        data=json.dumps(payload),
        content_type="application/json",
    )
    # Với mandatory email verification, allauth headless trả 401 kèm flow verify_email is_pending
    assert res.status_code in (200, 401), res.content[:400]
    assert User.objects.filter(email=email, username=username).exists()
    assert EmailAddress.objects.filter(email=email, verified=False).exists()


@pytest.mark.django_db
def test_gui_lai_mail_loi_khong_xoa_user():
    """Khi signup=False (gửi lại xác thực), lỗi gửi mail KHÔNG được xoá User."""
    rf = RequestFactory()
    request = rf.get("/")
    adapter = get_adapter()

    user = User.objects.create_user(
        username="user_ton_tai",
        email="ton_tai@gikky.test",
        password=MAT_KHAU,
    )
    email_address = EmailAddress.objects.create(
        user=user,
        email="ton_tai@gikky.test",
        verified=False,
        primary=True,
    )
    email_confirmation = EmailConfirmation(email_address=email_address)

    with patch(
        "allauth.account.adapter.DefaultAccountAdapter.send_confirmation_mail",
        side_effect=RuntimeError("SMTP quota exceeded"),
    ):
        with pytest.raises(RuntimeError, match="SMTP quota exceeded"):
            adapter.send_confirmation_mail(
                request,
                email_confirmation,
                signup=False,
            )

    # Khẳng định User vẫn tồn tại bình thường
    assert User.objects.filter(pk=user.pk).exists()
    assert EmailAddress.objects.filter(pk=email_address.pk).exists()
