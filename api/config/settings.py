"""Cấu hình Django cho gikky.net.

Phase 0 — chỉ đủ để boot + chạm DB. Chưa có allauth, chưa có CSRF cross-domain
(PLAN 8.2 / Phase 2), chưa có model domain (PLAN mục 6 / Phase 1).
"""

from pathlib import Path

import environ
from django.core.exceptions import ImproperlyConfigured

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(
    DEBUG=(bool, False),
    ALLOWED_HOSTS=(list, ["localhost", "127.0.0.1"]),
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

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.auth",
    "django.contrib.contenttypes",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "core",
]

MIDDLEWARE = [
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
]

ROOT_URLCONF = "config.urls"

TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
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

# --- Email (Phase 6: digest tuần; Phase 2 sẽ dùng cho xác thực email) --------
#
# **Máy dev không có SMTP** (chốt cùng plan bốn mảng, 2026-08-22). `DEBUG=True` ⇒ mặc
# định là `filebased`: thư được GHI RA FILE trong `api/sent_emails/`, đi qua đúng đường
# `django.core.mail` như bản SMTP và chỉ khác cái ống ở cuối. Nhờ vậy luồng "dựng nội
# dung → giao cho backend" đo được thật; phần "SMTP nhận và chuyển thư" thì **chưa bao
# giờ chạy trên máy này**.
#
# Chọn theo `DEBUG` chứ không hằng: một `filebased` sót lại trên prod là mọi email xác
# thực của Phase 2 rơi vào một thư mục không ai đọc, và người dùng không đăng ký được
# — HTTP vẫn 200, không gì đỏ.
EMAIL_BACKEND = env(
    "EMAIL_BACKEND",
    default=(
        "django.core.mail.backends.filebased.EmailBackend"
        if DEBUG
        else "django.core.mail.backends.smtp.EmailBackend"
    ),
)
EMAIL_FILE_PATH = env("EMAIL_FILE_PATH", default=str(BASE_DIR / "sent_emails"))
DEFAULT_FROM_EMAIL = env(
    "DEFAULT_FROM_EMAIL", default="gikky.net <khong-tra-loi@gikky.net>"
)

#: Origin công khai — dùng dựng link tuyệt đối trong email (`core/digest.py`). Cùng vai
#: với `SITE_ORIGIN` của `apps/web/lib/site.ts`, và phải khớp nó trên prod.
SITE_ORIGIN = env("SITE_ORIGIN", default="http://localhost:3000")

# ⚠ **ĐIỂM GỘP với Mảng A (Phase 2).** Mảng A cấu hình email theo lối `EMAIL_URL=` của
# django-environ (`env.email_url`) và khai `FRONTEND_ORIGIN` cho cùng vai với
# `SITE_ORIGIN` ở trên. Hai lối cùng ra một kết quả; khi gộp hai nhánh, **giữ MỘT** — ưu
# tiên lối `EMAIL_URL` của Mảng A vì nó là bên dùng email nhiều hơn (xác thực, đặt lại
# mật khẩu) — rồi xoá khối này, trừ `SITE_ORIGIN` nếu Mảng A không có tên tương đương.
# `core/digest.py` và `gui_digest` KHÔNG phụ thuộc lối nào: chúng chỉ gọi
# `django.core.mail` + `DEFAULT_FROM_EMAIL`, và tìm origin theo cả hai tên.

STATIC_URL = "static/"
# Thiếu STATIC_ROOT thì `collectstatic` báo lỗi và Django admin lên prod mất sạch CSS.
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
