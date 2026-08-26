# Django + gunicorn cho prod. Context BUILD là **gốc repo** (xem `compose.yml`), không
# phải `api/` — cùng lối với `deploy/production/*.Dockerfile` của trekky trên cùng máy.
#
# Python 3.12 vì `api/pyproject.toml` khai `requires-python = ">=3.12"`, và vì máy dev
# chạy đúng 3.12: một bản khác ở đây là để lỗi phụ thuộc chỉ lộ ra sau khi deploy.
FROM python:3.12-slim-bookworm

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1 \
    DJANGO_SETTINGS_MODULE=config.settings

WORKDIR /app

# `curl` cho healthcheck của compose. Không cài gcc/libpq-dev: `psycopg[binary]`, `Pillow`
# và `nh3` đều có wheel manylinux cho cp312 — thêm toolchain vào là +300 MB image cho một
# thứ không dùng tới. Wheel thiếu thì bước `pip install` dưới đây ĐỎ ngay, không âm thầm.
RUN apt-get update \
 && apt-get install -y --no-install-recommends curl \
 && rm -rf /var/lib/apt/lists/*

# ⚠ Chép **cả** `api/` trước rồi mới `pip install .`, cố ý — dù nó bỏ mất lớp cache
# "phụ thuộc không đổi thì không cài lại".
#
# Lý do: `pyproject.toml` khai `[tool.setuptools] packages = ["config", "core", "api"]`.
# Chép mỗi `pyproject.toml` rồi `pip install .` thì setuptools không thấy ba thư mục ấy và
# build ĐỎ. Cách vòng duy nhất là chép danh sách phụ thuộc ra một `requirements.txt` thứ
# hai — tức hai nguồn sự thật cho cùng một danh sách, và cái trôi ra sẽ là cái không ai đọc.
# Đổi ~40 giây build lấy việc không có bản sao nào để lệch.
COPY api/ /app/

# `gunicorn` cố ý KHÔNG nằm trong `pyproject.toml`: nó là lựa chọn của tầng TRIỂN KHAI,
# không phải phụ thuộc của ứng dụng. Thêm vào pyproject là bắt mọi máy dev và mọi lượt
# `pnpm test` kéo về một WSGI server không ai chạy.
# Dấu ngoặc kép là BẮT BUỘC: `RUN` dùng shell, `>` không có ngoặc là chuyển hướng file.
RUN pip install --no-cache-dir . "gunicorn>=23.0"

# Thư mục ảnh nằm NGOÀI cây mã nguồn (`api/.env.example` nói rõ vì sao: deploy thay nguyên
# thư mục mã không được xoá mất ảnh người dùng). `media-an` là kho CÁCH LY và phải nằm
# ngoài `media` — xem `core/anh_luu.py`.
RUN mkdir -p /var/lib/gikky/media /var/lib/gikky/media-an /app/staticfiles

COPY deploy/prod/api-entrypoint.sh /usr/local/bin/api-entrypoint.sh
RUN chmod +x /usr/local/bin/api-entrypoint.sh

EXPOSE 8000
ENTRYPOINT ["/usr/local/bin/api-entrypoint.sh"]
