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

STATIC_URL = "static/"
# Thiếu STATIC_ROOT thì `collectstatic` báo lỗi và Django admin lên prod mất sạch CSS.
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
