"""Cấu hình Django cho gikky.net.

Phase 2 thêm tài khoản: **django-allauth headless**, session cookie, CSRF cho origin dev
(PLAN 8.2). Xem khối "TÀI KHOẢN" ở cuối file — ba chỗ dễ làm sai nhất (Google gác env,
xác thực email bắt buộc, CSRF_TRUSTED_ORIGINS) đều có ghi chú tại chỗ.

Phase 4 thêm `ADMIN_HOSTS` (hàng rào Host của PLAN 8.2) — khối "KHU QUẢN TRỊ" ở giữa file.

⚠ **CSRF / cookie chỉ được khai ở ĐÚNG MỘT chỗ** — khối "TÀI KHOẢN" ở cuối file. Ba mảng
song song của 2026-08-22 (A tài khoản, C khu quản trị, D vận hành) đều cần
`CSRF_TRUSTED_ORIGINS` / `SESSION_COOKIE_DOMAIN` / `CSRF_COOKIE_DOMAIN` / email, và lượt
gộp đã kéo chúng về một khối. Khai lần thứ hai ở bất cứ đâu trong file này thì **cái đứng
sau thắng, im lặng** — không lỗi, không warning, chỉ một biến mang giá trị khác thứ người
đọc file tưởng.
"""

from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
    GOOGLE_CLIENT_ID=(str, ""),
    GOOGLE_CLIENT_SECRET=(str, ""),
    CSRF_TRUSTED_ORIGINS=(list, []),
    SESSION_COOKIE_DOMAIN=(str, ""),
    CSRF_COOKIE_DOMAIN=(str, ""),
    EMAIL_URL=(str, ""),
    DEFAULT_FROM_EMAIL=(str, "gikky <khong-tra-loi@gikky.net>"),
    FRONTEND_ORIGIN=(str, "http://localhost:3000"),
)
environ.Env.read_env(BASE_DIR / ".env")

try:
    SECRET_KEY = env("SECRET_KEY")
except ImproperlyConfigured as loi:
    # Clone sạch chưa có `api/.env` thì thông báo mặc định của django-environ chỉ nói
    # "Set the SECRET_KEY environment variable" — không chỉ được việc phải làm.
    raise ImproperlyConfigured(
        "Thiếu SECRET_KEY: chưa có file `api/.env`. Chạy `pnpm setup:env` ở gốc repo "
        "(chép `api/.env.example` -> `api/.env`) rồi sửa SECRET_KEY. Xem CLAUDE.md."
    ) from loi

DEBUG = env("DEBUG")
ALLOWED_HOSTS = env("ALLOWED_HOSTS")

#: Google OAuth **chỉ được đăng ký khi có credential thật** (chốt của plan mảng A).
#: Không có `GOOGLE_CLIENT_ID` ⇒ provider không nằm trong `INSTALLED_APPS`, endpoint
#: `/api/_allauth/browser/v1/auth/provider/redirect` không có provider nào để chọn, và
#: `GET /api/v1/me` trả `google_bat = false` để frontend **không render nút** — PLAN mục 4
#: cấm nút vĩnh viễn không bấm được, và một nút OAuth không có credential thì đúng là thế.
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET")
GOOGLE_BAT = bool(GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET)

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    # `django.contrib.sites` là phụ thuộc CỨNG của allauth.socialaccount (nó tra
    # `SocialApp` theo site). `SITE_ID` ở cuối file.
    "django.contrib.sites",
    "allauth",
    "allauth.account",
    "allauth.socialaccount",
    "allauth.headless",
    "core",
]

if GOOGLE_BAT:
    INSTALLED_APPS.append("allauth.socialaccount.providers.google")

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    # Hàng rào Host của PLAN 8.2, đặt SỚM có chủ đích: một request tới `/api/admin/*` từ
    # host public phải chết trước khi bất cứ thứ gì đọc session hay chạm DB. Nó không cần
    # `request.user` nên không có lý do xếp sau `AuthenticationMiddleware`.
    "config.host_admin.ChanApiAdminNgoaiHostAdmin",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    # Bắt buộc của allauth ≥ 0.56 — thiếu nó thì allauth ném lỗi cấu hình lúc boot.
    "allauth.account.middleware.AccountMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        # `api/templates/` chỉ để **đè template email của allauth sang tiếng Việt**
        # (`account/email/*`). gikky không render HTML nào khác từ Django — hai frontend
        # là Next. Thư mục rỗng thì mail đi ra bằng tiếng Anh mặc định của allauth, trên
        # một sản phẩm tiếng Việt.
        "DIRS": [BASE_DIR / "templates"],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

WSGI_APPLICATION = "config.wsgi.application"
ASGI_APPLICATION = "config.asgi.application"

DATABASES = {"default": env.db("DATABASE_URL")}

# Custom user model phải chốt TRƯỚC lần `migrate` đầu tiên — đổi sau là ngõ cụt Django
# (xem docstring `core/models.py`). Trường domain của User là việc của Phase 1.
AUTH_USER_MODEL = "core.User"

AUTH_PASSWORD_VALIDATORS = [
    {"NAME": "django.contrib.auth.password_validation.UserAttributeSimilarityValidator"},
    {"NAME": "django.contrib.auth.password_validation.MinimumLengthValidator"},
    {"NAME": "django.contrib.auth.password_validation.CommonPasswordValidator"},
    {"NAME": "django.contrib.auth.password_validation.NumericPasswordValidator"},
]

LANGUAGE_CODE = "vi"
TIME_ZONE = "Asia/Ho_Chi_Minh"
USE_I18N = True
USE_TZ = True

# --- KHU QUẢN TRỊ (PLAN 8.2 · Phase 4) ---------------------------------------
#
# Cookie/CSRF cross-subdomain mà Phase 4 cũng cần **không nằm ở đây**: chúng nằm trong
# khối "TÀI KHOẢN" ở cuối file, khai đúng một lần (xem docstring đầu file).

#: Host được phép chạm `/api/admin/*` — hàng rào tầng HẠ TẦNG của PLAN 8.2, mô phỏng
#: bằng middleware ở dev (PLAN mục 10, Phase 4). Cơ chế + giới hạn thật ở dev: đọc
#: docstring `config/host_admin.py` TRƯỚC khi tin dòng này bảo vệ được gì.
ADMIN_HOSTS = env.list(
    "ADMIN_HOSTS",
    default=[
        # Dev: cả hai app Next rewrite `/api/*` sang đúng origin này, nên đây là host
        # Django thật sự nhìn thấy. Xem `host_admin.py` — ở dev nó KHÔNG tách được
        # app admin khỏi app public, và điều đó được nói thẳng ở đó.
        "localhost:8000",
        "127.0.0.1:8000",
        # Gọi thẳng Django bằng curl/Postman lúc dev.
        "localhost",
        "127.0.0.1",
        # `Client()` của Django test dùng host này.
        "testserver",
    ],
)

STATIC_URL = "static/"
# Thiếu STATIC_ROOT thì `collectstatic` báo lỗi và Django admin lên prod mất sạch CSS.
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"

# =============================================================================
# TÀI KHOẢN — django-allauth headless (PLAN mục 7, 8.2 · Phase 2)
# =============================================================================

SITE_ID = 1

AUTHENTICATION_BACKENDS = [
    "django.contrib.auth.backends.ModelBackend",
    "allauth.account.auth_backends.AuthenticationBackend",
]

#: Chỉ client `browser` — **session cookie, không token store** (chốt của plan mảng A).
#: Bật thêm `app` là mở một đường đăng nhập thứ hai bằng token mà không ai dùng và không
#: ai kiểm; ở dev nó còn nằm dưới cùng prefix `/api/` nên nó đi qua đúng những lớp proxy
#: mà PLAN 8.2 dựng cho cookie.
HEADLESS_CLIENTS = ("browser",)
#: Không có view HTML nào của allauth được mount (xem `config/urls.py`), nên phải nói ra:
#: `HEADLESS_ONLY = False` làm allauth `reverse()` sang các URL đó và nổ `NoReverseMatch`
#: đúng lúc gửi mail xác thực.
HEADLESS_ONLY = True
#: Gốc của **frontend Next công khai** — nơi link trong email trỏ tới.
#:
#: Phải là URL **tuyệt đối**, và đó không phải chuyện thẩm mỹ: `default_get_frontend_url`
#: của allauth dựng URL tương đối bằng `request.build_absolute_uri`, mà request tới Django
#: ở dev đi qua `rewrites` của Next nên Host của nó là **`localhost:8000`**. Link tương
#: đối vì thế ra `http://localhost:8000/xac-thuc-email/…` — sai cổng, và người bấm vào
#: nhận 404 từ Django. Prod đặt `FRONTEND_ORIGIN=https://gikky.net`.
FRONTEND_ORIGIN = env("FRONTEND_ORIGIN")

#: Link trong email đi tới **frontend Next**, không tới Django. `{key}` do allauth thay.
HEADLESS_FRONTEND_URLS = {
    "account_confirm_email": f"{FRONTEND_ORIGIN}/xac-thuc-email/{{key}}",
    "account_reset_password": f"{FRONTEND_ORIGIN}/quen-mat-khau",
    "account_reset_password_from_key": f"{FRONTEND_ORIGIN}/dat-lai-mat-khau/{{key}}",
    "account_signup": f"{FRONTEND_ORIGIN}/dang-ky",
}

#: Đăng nhập **bằng email** (username là danh tính công khai `/u/<username>`, không phải
#: khoá đăng nhập — PLAN 5.9), nhưng username vẫn bắt buộc và **chọn lúc đăng ký**.
ACCOUNT_LOGIN_METHODS = {"email"}
ACCOUNT_SIGNUP_FIELDS = ["email*", "username*", "password1*"]
ACCOUNT_UNIQUE_EMAIL = True
#: **Bắt buộc xác thực email** (chốt của plan mảng A). Dev đọc link từ file mail, nên đây
#: vẫn là luồng thật — khác hẳn việc tắt xác thực đi cho dễ test.
ACCOUNT_EMAIL_VERIFICATION = "mandatory"
ACCOUNT_EMAIL_NOTIFICATIONS = False
ACCOUNT_PREVENT_ENUMERATION = True

#: Credential đọc từ env chứ không từ hàng `SocialApp` trong DB: một hàng DB nghĩa là
#: mỗi môi trường phải nhớ tạo tay, và quên thì lỗi chỉ lộ lúc ai đó bấm nút. Khối này
#: chỉ tồn tại khi `GOOGLE_BAT` — không có credential thì không có provider (PLAN mục 4).
SOCIALACCOUNT_PROVIDERS = (
    {
        "google": {
            "APPS": [
                {
                    "client_id": GOOGLE_CLIENT_ID,
                    "secret": GOOGLE_CLIENT_SECRET,
                    "key": "",
                }
            ],
            "SCOPE": ["profile", "email"],
            #: Google đã xác minh email hộ ⇒ không bắt xác thực lại.
            "EMAIL_AUTHENTICATION": True,
        }
    }
    if GOOGLE_BAT
    else {}
)

#: Email. Dev không có SMTP ⇒ ghi ra file, e2e đọc file lấy link xác thực.
#: `EMAIL_URL` (django-environ) đè được ở prod, vd `smtp://user:pass@host:587/?tls=True`.
DEFAULT_FROM_EMAIL = env("DEFAULT_FROM_EMAIL")
EMAIL_FILE_PATH = BASE_DIR / ".mail"
if env("EMAIL_URL"):
    vars().update(env.email_url("EMAIL_URL"))
else:
    EMAIL_BACKEND = "django.core.mail.backends.filebased.EmailBackend"

# --- CSRF / cookie (PLAN 8.2) ------------------------------------------------
# **Khối DUY NHẤT khai ba biến này** — cả `api_v1` (Phase 2) lẫn `api_admin` (Phase 4)
# đọc chung. Thiếu nó là POST từ dev (localhost:3000/3001) ăn 403 CSRF ngay endpoint ghi
# đầu tiên. Prod đặt `CSRF_TRUSTED_ORIGINS=https://gikky.net,https://admin.gikky.net`
# cùng `SESSION_COOKIE_DOMAIN=.gikky.net` / `CSRF_COOKIE_DOMAIN=.gikky.net` qua env —
# `.gikky.net` là thứ cho cookie phiên đi được từ `gikky.net` sang `admin.gikky.net`.
CSRF_TRUSTED_ORIGINS = env("CSRF_TRUSTED_ORIGINS") or [
    "http://localhost:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3000",
    "http://127.0.0.1:3001",
]
if env("SESSION_COOKIE_DOMAIN"):
    SESSION_COOKIE_DOMAIN = env("SESSION_COOKIE_DOMAIN")
if env("CSRF_COOKIE_DOMAIN"):
    CSRF_COOKIE_DOMAIN = env("CSRF_COOKIE_DOMAIN")

#: `False` là BẮT BUỘC: frontend phải đọc được cookie `csrftoken` bằng JS để gắn vào
#: header `X-CSRFToken`. Cookie *phiên* (`sessionid`) thì ngược lại — `HttpOnly` mặc định
#: của Django, và đừng đụng vào.
CSRF_COOKIE_HTTPONLY = False
SESSION_COOKIE_SAMESITE = "Lax"
CSRF_COOKIE_SAMESITE = "Lax"
#: Dev chạy HTTP nên không ép `Secure`; prod bật qua biến môi trường của tầng triển khai.
SESSION_COOKIE_SECURE = not DEBUG
CSRF_COOKIE_SECURE = not DEBUG
