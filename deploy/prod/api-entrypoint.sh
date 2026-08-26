#!/bin/sh
# Chạy TRƯỚC gunicorn ở mỗi lần container lên. Cả hai lệnh đều idempotent.
#
# Vì sao ở đây chứ không ở một service `migrate` riêng: stack này có ĐÚNG MỘT replica api,
# nên không có cảnh hai tiến trình cùng `migrate`. Tách ra thành service riêng thì
# `depends_on` phải chờ nó `completed_successfully`, và một lần migrate đỏ sẽ giữ cả stack
# ở trạng thái nửa vời — khó đọc hơn hẳn một container api restart-loop kèm traceback.
set -e

echo "[entrypoint] chờ postgres…"
python - <<'PY'
import os, socket, time, urllib.parse
u = urllib.parse.urlparse(os.environ["DATABASE_URL"])
for _ in range(60):
    try:
        socket.create_connection((u.hostname, u.port or 5432), timeout=2).close()
        break
    except OSError:
        time.sleep(1)
else:
    raise SystemExit("postgres không lên sau 60s")
PY

echo "[entrypoint] migrate…"
python manage.py migrate --noinput

echo "[entrypoint] collectstatic…"
# Django admin ở `/api/admin/django/` mất sạch CSS nếu bỏ bước này; Caddy phục vụ
# `/static/*` từ chính volume mà bước này ghi vào.
python manage.py collectstatic --noinput --clear

echo "[entrypoint] gunicorn…"
# 3 worker: máy 4 vCPU / 5 GiB RAM và còn 4 stack khác đang chạy. `--timeout 60` vì đường
# ghi có lời gọi ngược Next (revalidate) và upload ảnh tái mã hoá bằng Pillow.
# `--access-logformat` đưa `X-Forwarded-For` lên TRƯỚC, thay cho `%(h)s` mặc định.
#
# Không phải để cho đẹp: sau Caddy, `%(h)s` là IP nội bộ của Caddy với MỌI request, nên
# log mặc định không phân biệt nổi hai người dùng khác nhau. Mà hạn mức chống lạm dụng của
# PLAN mục 10 lại đếm THEO IP (`core/han_muc.py::dia_chi_ip` đọc đúng header này) — không
# có cột này thì đúng lúc cần điều tra "ai đang nện cửa đăng ký" là không có gì để đọc.
#
# Nó cũng là phép đo DUY NHẤT chứng minh chuỗi CF-Connecting-IP → Caddy → Django còn
# nguyên: `xff` ra một IP công cộng ⇒ đúng; ra `172.x` hoặc rỗng ⇒ `header_up` trong
# Caddyfile đã hỏng và hạn mức theo IP đang gộp cả thế giới vào một khoá đếm.
exec gunicorn config.wsgi:application \
    --bind 0.0.0.0:8000 \
    --workers "${GUNICORN_WORKERS:-3}" \
    --timeout "${GUNICORN_TIMEOUT:-60}" \
    --access-logfile - \
    --access-logformat 'xff=%({x-forwarded-for}i)s peer=%(h)s %(t)s "%(r)s" %(s)s %(b)s %(M)sms' \
    --error-logfile -
