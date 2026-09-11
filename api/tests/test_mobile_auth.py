import json
import pytest
from unittest.mock import patch, MagicMock
from django.test import Client
from core.models.nguoi_dung import User

pytestmark = pytest.mark.django_db


def test_mobile_login_signup_logout():
    client = Client()

    # 1. Đăng ký mobile
    res_signup = client.post(
        "/api/mobile/signup",
        data=json.dumps({"username": "user_mobile", "email": "mobile@gikky.net", "password": "mat-khau-manh-123"}),
        content_type="application/json",
    )
    assert res_signup.status_code == 200
    data_signup = res_signup.json()
    assert data_signup["ok"] is True
    assert data_signup["sessionid"]
    assert data_signup["csrftoken"]
    assert data_signup["user"]["username"] == "user_mobile"

    # 2. Đăng xuất
    res_logout = client.post("/api/mobile/logout")
    assert res_logout.status_code == 200

    # 3. Đăng nhập lại
    res_login = client.post(
        "/api/mobile/login",
        data=json.dumps({"tai_khoan": "user_mobile", "mat_khau": "mat-khau-manh-123"}),
        content_type="application/json",
    )
    assert res_login.status_code == 200
    data_login = res_login.json()
    assert data_login["ok"] is True
    assert data_login["user"]["username"] == "user_mobile"


def test_mobile_google_login_tat():
    client = Client()
    # Khi Google chưa bật
    res = client.post(
        "/api/mobile/google",
        data=json.dumps({"id_token": "token_gia"}),
        content_type="application/json",
    )
    assert res.status_code == 400
    assert "chưa được kích hoạt" in res.json()["error"]


@patch("core.cau_hinh_oauth.google_dang_bat", return_value=True)
@patch("core.cau_hinh_oauth.client_id_google", return_value="google-client-test-id")
def test_mobile_google_login_thanh_cong(mock_client_id, mock_google_bat):
    client = Client()

    user = User.objects.create_user(username="gg_user", email="gg@gikky.net")
    sociallogin = MagicMock()
    sociallogin.user = user

    with patch("allauth.headless.socialaccount.inputs.ProviderTokenInput") as MockForm, \
         patch("allauth.headless.socialaccount.internal.complete_token_login") as mock_complete:

        mock_instance = MockForm.return_value
        mock_instance.is_valid.return_value = True
        mock_instance.cleaned_data = {"sociallogin": sociallogin}

        def mock_complete_side_effect(request, sl):
            from django.contrib.auth import login
            login(request, user, backend="django.contrib.auth.backends.ModelBackend")

        mock_complete.side_effect = mock_complete_side_effect

        res = client.post(
            "/api/mobile/google",
            data=json.dumps({"id_token": "google_token_hop_le"}),
            content_type="application/json",
        )
        assert res.status_code == 200
        data = res.json()
        assert data["ok"] is True
        assert data["sessionid"]
        assert data["csrftoken"]
        assert data["user"]["username"] == "gg_user"


def test_mobile_google_start_tat():
    client = Client()
    res = client.get("/api/mobile/google/start")
    assert res.status_code == 400


@patch("core.cau_hinh_oauth.google_dang_bat", return_value=True)
def test_mobile_google_start_va_redirect(mock_google_bat):
    from allauth.socialaccount.models import SocialApp
    from django.contrib.sites.models import Site
    from django.conf import settings
    from core.allauth_adapter import AdapterTaiKhoan
    from django.test import RequestFactory

    app = SocialApp.objects.create(
        provider="google",
        name="Google",
        client_id="test-google-client-id",
        secret="test-secret",
    )
    app.sites.add(Site.objects.get(pk=settings.SITE_ID))

    client = Client()
    res = client.get("/api/mobile/google/start?redirect_uri=gikky://auth/callback")
    assert res.status_code == 302
    assert "accounts.google.com" in res.url
    assert "test-google-client-id" in res.url
    assert client.session.get("mobile_redirect_uri") == "gikky://auth/callback"

    # Kiểm tra get_login_redirect_url lấy uri từ session và nối sessionid
    rf = RequestFactory()
    req = rf.get("/")
    req.session = client.session
    adapter = AdapterTaiKhoan()
    redirect_url = adapter.get_login_redirect_url(req)
    assert redirect_url.startswith("gikky://auth/callback?sessionid=")
    assert "csrftoken=" in redirect_url

    # Kiểm tra get_signup_redirect_url cũng lấy uri từ session cho user mới
    req.session["mobile_redirect_uri"] = "exp://192.168.1.222:8081/--/auth/callback"
    signup_url = adapter.get_signup_redirect_url(req)
    assert signup_url.startswith("exp://192.168.1.222:8081/--/auth/callback?sessionid=")
    assert "csrftoken=" in signup_url

    # Khi không có mobile_redirect_uri thì trả về LOGIN_REDIRECT_URL ("/")
    assert adapter.get_login_redirect_url(req) == "/"
    assert adapter.get_signup_redirect_url(req) == "/"

    # Kiểm tra adapter.logout bảo toàn mobile_redirect_uri
    req.session["mobile_redirect_uri"] = "gikky://auth/callback"
    adapter.logout(req)
    assert req.session.get("mobile_redirect_uri") == "gikky://auth/callback"


@pytest.mark.django_db
def test_mobile_session_middleware():
    from core.models.nguoi_dung import User
    from django.contrib.auth import login
    from django.test import Client

    user = User.objects.create_user(username="test_mobile_user", password="password123")
    client = Client()
    # Đăng nhập mobile để sinh session
    res = client.post(
        "/api/mobile/login",
        data={"tai_khoan": "test_mobile_user", "mat_khau": "password123"},
        content_type="application/json",
    )
    assert res.status_code == 200
    session_id = res.json()["sessionid"]

    # Client mới không có cookie sessionid, gửi X-Session-Token
    new_client = Client()
    res_me = new_client.get("/api/v1/me", HTTP_X_SESSION_TOKEN=session_id)
    assert res_me.status_code == 200
    assert res_me.json()["dang_nhap"] is True
    assert res_me.json()["username"] == "test_mobile_user"

    # Gửi qua Authorization: Bearer
    new_client2 = Client()
    res_me2 = new_client2.get("/api/v1/me", HTTP_AUTHORIZATION=f"Bearer {session_id}")
    assert res_me2.status_code == 200
    assert res_me2.json()["dang_nhap"] is True
    assert res_me2.json()["username"] == "test_mobile_user"
