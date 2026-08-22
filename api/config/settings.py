"""Cấu hình Django cho gikky.net.

Phase 0 dựng phần boot + DB; Phase 1 thêm model domain (PLAN mục 6).

**Phase 4 thêm khối "Khu quản trị" ở cuối file** — `ADMIN_HOSTS` cho hàng rào Host của
PLAN 8.2, và cookie/CSRF cross-subdomain. Khối CSRF ấy là thứ Phase 2 (allauth) cũng
cần: nếu hai mảng cùng thêm thì **gộp làm một**, đừng để hai khối cùng khai một biến —
cái đứng sau thắng, im lặng.
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
    # Hàng rào Host của PLAN 8.2, đặt SỚM có chủ đích: một request tới `/api/admin/*` từ
    # host public phải chết trước khi bất cứ thứ gì đọc session hay chạm DB. Nó không cần
    # `request.user` nên không có lý do xếp sau `AuthenticationMiddleware`.
    "config.host_admin.ChanApiAdminNgoaiHostAdmin",
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

# --- Khu quản trị + cookie cross-subdomain (PLAN 8.2 · Phase 4) --------------

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

#: PLAN 8.2. Prod: `.gikky.net` để cookie đi được giữa `gikky.net` và `admin.gikky.net`.
#: `None` (mặc định) = cookie khoá vào đúng host đã cấp — đúng cho dev, nơi cả hai app
#: đi qua `localhost`.
SESSION_COOKIE_DOMAIN = env("SESSION_COOKIE_DOMAIN", default=None)
CSRF_COOKIE_DOMAIN = env("CSRF_COOKIE_DOMAIN", default=None)

#: PLAN 8.2 nói thẳng: thiếu dòng này thì POST từ admin (và từ dev) ăn 403 CSRF. Django
#: so `Origin`/`Referer` của request ghi với danh sách này, nên nó phải chứa origin của
#: TRÌNH DUYỆT (cổng 3000/3001), không phải origin của Django.
CSRF_TRUSTED_ORIGINS = env.list(
    "CSRF_TRUSTED_ORIGINS",
    default=["http://localhost:3000", "http://localhost:3001"],
)

STATIC_URL = "static/"
# Thiếu STATIC_ROOT thì `collectstatic` báo lỗi và Django admin lên prod mất sạch CSS.
STATIC_ROOT = BASE_DIR / "staticfiles"

DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
