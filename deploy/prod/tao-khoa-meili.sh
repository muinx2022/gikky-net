#!/bin/sh
# Sinh khoá Meilisearch PHẠM VI HẸP cho index `mach` rồi in ra stdout.
#
#   cd ~/gikky-net/src
#   deploy/prod/tao-khoa-meili.sh   # đọc MEILI_MASTER_KEY từ ~/gikky-net/app/.env
#
# Rồi dán kết quả vào `MEILI_KEY=` trong `~/gikky-net/app/.env` và `up -d api`.
#
# ## Vì sao không dùng thẳng master key
#
# Master key **tạo được khoá khác** (`keys.create`), tức là quyền quản trị toàn cụm —
# cho một tiến trình chỉ cần đọc/ghi ĐÚNG MỘT index. `core/tim_kiem.py` nói rõ điều đó
# trong docstring; đây là chỗ thực hiện nó.
#
# ## Vì sao liệt kê từng action thay vì `["*"]`
#
# `"*"` bao gồm cả `keys.*` — tức khoá "hẹp" lại vừa tạo được master key thứ hai, và cả
# việc giới hạn `indexes: ["mach"]` thành vô nghĩa. Danh sách dưới đây là ĐÚNG những lời
# gọi có trong `core/tim_kiem.py`: `POST /indexes`, `PATCH .../settings`,
# `DELETE /indexes/mach`, `PUT .../documents`, `DELETE .../documents/<id>`,
# `POST .../search`.
set -e

THU_MUC_ENV="${THU_MUC_ENV:-$HOME/gikky-net/app/.env}"
if [ -z "${MEILI_MASTER_KEY:-}" ] && [ -f "$THU_MUC_ENV" ]; then
    MEILI_MASTER_KEY=$(grep -E '^MEILI_MASTER_KEY=' "$THU_MUC_ENV" | head -1 | cut -d= -f2-)
fi
if [ -z "${MEILI_MASTER_KEY:-}" ]; then
    echo "Thiếu MEILI_MASTER_KEY (không có trong env và không đọc được từ $THU_MUC_ENV)" >&2
    exit 1
fi

# Gọi từ TRONG mạng docker của stack: Meilisearch cố ý không publish cổng nào ra host.
# `--env-file` BẮT BUỘC: compose nội suy ${POSTGRES_PASSWORD:?…} khi ĐỌC file, kể cả
# cho một lệnh `exec` không đụng tới service postgres. Thiếu nó là dừng ngay ở bước đọc.
docker compose -f deploy/prod/compose.yml --env-file "$THU_MUC_ENV" exec -T meili \
    curl -sS -X POST http://localhost:7700/keys \
    -H "Authorization: Bearer $MEILI_MASTER_KEY" \
    -H 'Content-Type: application/json' \
    --data-binary '{
      "name": "gikky-api-mach",
      "description": "Doc/ghi index mach cho Django. KHONG co keys.* — xem deploy/prod/tao-khoa-meili.sh",
      "actions": [
        "search",
        "documents.add",
        "documents.get",
        "documents.delete",
        "indexes.create",
        "indexes.get",
        "indexes.update",
        "indexes.delete",
        "settings.get",
        "settings.update",
        "tasks.get",
        "stats.get"
      ],
      "indexes": ["mach"],
      "expiresAt": null
    }'
echo
