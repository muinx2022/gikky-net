# Caddy CÓ PLUGIN `caddy-ratelimit`.
#
# `rate_limit` KHÔNG có trong Caddy tiêu chuẩn — image `caddy:2` sẽ báo "unrecognized
# directive: rate_limit" và **không khởi động**. `deploy/Caddyfile` đã cảnh báo đúng chỗ
# này; đây là chỗ trả lời nó.
#
# Ghim version (không `:2` trôi): một bản Caddy mới đổi hành vi `directiveOrder` là đủ để
# lớp che `/api/admin/*` của PLAN 8.2 lặng lẽ đổi nghĩa.
FROM caddy:2.10-builder AS builder
RUN xcaddy build --with github.com/mholt/caddy-ratelimit

FROM caddy:2.10-alpine
COPY --from=builder /usr/bin/caddy /usr/bin/caddy
COPY deploy/prod/Caddyfile /etc/caddy/Caddyfile

# `validate` ngay trong build: một Caddyfile sai cú pháp phải ĐỎ ở đây, không phải ở
# restart-loop lúc 2 giờ sáng. Nó cũng chứng minh bản caddy vừa dựng THẬT SỰ có
# `rate_limit` — thiếu plugin thì chính lệnh này đỏ.
RUN caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile

EXPOSE 80
