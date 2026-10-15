#!/usr/bin/env bash
set -euo pipefail

# ==============================================================================
# Script sao lưu tự động cho gikky.net trên máy chủ vps-muinx
# ==============================================================================
# Sao lưu:
#   1. PostgreSQL database (pg_dump -Fc custom format)
#   2. Volume ảnh phục vụ (gikkynet_media -> backup/media)
#   3. Volume ảnh cách ly (gikkynet_mediaan -> backup/media-an)
#   4. Xoay vòng bản dump cục bộ trên VPS (mặc định giữ 7 bản gần nhất)
#   5. Đẩy lên Cloud Storage qua rclone (nếu cấu hình GIKKY_BACKUP_REMOTE)
#
# Cú pháp chạy:
#   bash deploy/prod/sao-luu-prod.sh
#   bash deploy/prod/sao-luu-prod.sh --require-cloud
# ==============================================================================

ENV_FILE="${ENV_FILE:-$HOME/gikky-net/app/.env}"

doc_env() {
  local var="$1"
  local def="${2:-}"
  if [ -f "$ENV_FILE" ]; then
    local val
    val=$(grep -E "^${var}=" "$ENV_FILE" | head -n 1 | cut -d= -f2- | sed -e 's/^[[:space:]]*["'\'']//' -e 's/["'\''][[:space:]]*$//' || true)
    if [ -n "$val" ]; then
      echo "$val"
      return
    fi
  fi
  echo "$def"
}

REQUIRE_CLOUD=0
for arg in "$@"; do
  if [ "$arg" = "--require-cloud" ]; then
    REQUIRE_CLOUD=1
  fi
done

SRC_DIR="${SRC_DIR:-$HOME/gikky-net/src}"
COMPOSE_FILE="${COMPOSE_FILE:-$SRC_DIR/deploy/prod/compose.yml}"
BACKUP_DIR="${GIKKY_BACKUP_DIR:-$(doc_env GIKKY_BACKUP_DIR "$HOME/gikky-net/backup")}"
KEEP_LOCAL="${GIKKY_BACKUP_KEEP_LOCAL:-$(doc_env GIKKY_BACKUP_KEEP_LOCAL "7")}"
CLOUD_DAYS="${GIKKY_BACKUP_CLOUD_DAYS:-$(doc_env GIKKY_BACKUP_CLOUD_DAYS "30")}"
POSTGRES_USER="${POSTGRES_USER:-$(doc_env POSTGRES_USER "gikky")}"
POSTGRES_DB="${POSTGRES_DB:-$(doc_env POSTGRES_DB "gikky")}"

# 1. Tạo thư mục đích
mkdir -p "$BACKUP_DIR/db" "$BACKUP_DIR/media" "$BACKUP_DIR/media-an"

# 2. Dump PostgreSQL từ container
THOI_GIAN=$(date +%Y-%m-%dT%H-%M-%S)
TEN_DUMP="gikky-prod-${THOI_GIAN}.dump"
DUMP_FILE="$BACKUP_DIR/db/$TEN_DUMP"
TMP_DUMP="$DUMP_FILE.tmp"

echo "[sao-luu-prod] Bắt đầu pg_dump database '${POSTGRES_DB}'..."
docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres \
  pg_dump -U "$POSTGRES_USER" -Fc --no-owner --no-privileges "$POSTGRES_DB" > "$TMP_DUMP"

# Kiểm tra file dump không rỗng và > 0 byte
if [ ! -s "$TMP_DUMP" ]; then
  echo "[sao-luu-prod] LỖI: File dump tạm rỗng (0 byte): $TMP_DUMP" >&2
  rm -f "$TMP_DUMP"
  exit 1
fi

echo "[sao-luu-prod] Kiểm tra tính toàn vẹn với pg_restore --list..."
if ! docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" exec -T postgres pg_restore --list < "$TMP_DUMP" > /dev/null; then
  echo "[sao-luu-prod] LỖI: File dump không hợp lệ khi kiểm tra bằng pg_restore --list!" >&2
  rm -f "$TMP_DUMP"
  exit 1
fi

mv "$TMP_DUMP" "$DUMP_FILE"
echo "[sao-luu-prod] Hoàn tất dump DB: $DUMP_FILE ($(du -h "$DUMP_FILE" | cut -f1))"

# 3. Sao lưu 2 volume gikkynet_media và gikkynet_mediaan ra backup/
echo "[sao-luu-prod] Đồng bộ volume gikkynet_media và gikkynet_mediaan..."
if docker cp gikkynet-api-1:/var/lib/gikky/media/. "$BACKUP_DIR/media/" 2>/dev/null; then
  echo "[sao-luu-prod] Đã chép media qua container gikkynet-api-1."
else
  echo "[sao-luu-prod] Fallback sang docker volume mount cho media..."
  docker run --rm -v gikkynet_media:/from:ro -v "$BACKUP_DIR/media":/to alpine cp -a /from/. /to/ 2>/dev/null || true
fi

if docker cp gikkynet-api-1:/var/lib/gikky/media-an/. "$BACKUP_DIR/media-an/" 2>/dev/null; then
  echo "[sao-luu-prod] Đã chép media-an qua container gikkynet-api-1."
else
  echo "[sao-luu-prod] Fallback sang docker volume mount cho media-an..."
  docker run --rm -v gikkynet_mediaan:/from:ro -v "$BACKUP_DIR/media-an":/to alpine cp -a /from/. /to/ 2>/dev/null || true
fi

# 4. Xoay vòng bản lưu cục bộ trên VPS (chỉ giữ KEEP_LOCAL bản mới nhất)
if [ "$KEEP_LOCAL" -gt 0 ]; then
  echo "[sao-luu-prod] Xoay vòng bản lưu cục bộ (giữ $KEEP_LOCAL bản mới nhất)..."
  # shellcheck disable=SC2012
  DANH_SACH_CU=$(ls -1t "$BACKUP_DIR/db"/gikky-prod-*.dump 2>/dev/null | tail -n +"$((KEEP_LOCAL + 1))" || true)
  if [ -n "$DANH_SACH_CU" ]; then
    echo "$DANH_SACH_CU" | xargs -r rm -f
    echo "[sao-luu-prod] Đã dọn các bản dump cũ cục bộ."
  fi
fi

# 5. Đồng bộ lên Cloud (GIKKY_BACKUP_REMOTE)
REMOTE="${GIKKY_BACKUP_REMOTE:-$(doc_env GIKKY_BACKUP_REMOTE "")}"
if [ -n "$REMOTE" ]; then
  REMOTE_CHUN="${REMOTE%/}"
  echo "[sao-luu-prod] Kiểm tra rclone..."
  if ! command -v rclone >/dev/null 2>&1; then
    echo "[sao-luu-prod] LỖI: Đã cấu hình GIKKY_BACKUP_REMOTE=$REMOTE nhưng không tìm thấy lệnh rclone!" >&2
    exit 1
  fi

  echo "[sao-luu-prod] Đẩy dump DB lên cloud: ${REMOTE_CHUN}/db/..."
  rclone copy "$DUMP_FILE" "${REMOTE_CHUN}/db/"

  echo "[sao-luu-prod] Đồng bộ kho ảnh lên cloud: ${REMOTE_CHUN}/media/..."
  rclone copy "$BACKUP_DIR/media" "${REMOTE_CHUN}/media/"

  echo "[sao-luu-prod] Đồng bộ kho ảnh cách ly lên cloud: ${REMOTE_CHUN}/media-an/..."
  rclone copy "$BACKUP_DIR/media-an" "${REMOTE_CHUN}/media-an/"

  if [ "${CLOUD_DAYS}" -gt 0 ]; then
    echo "[sao-luu-prod] Dọn dump cũ trên cloud (> ${CLOUD_DAYS} ngày)..."
    rclone delete "${REMOTE_CHUN}/db/" --min-age "${CLOUD_DAYS}d" --include "gikky-*.dump*"
  fi

  echo "[sao-luu-prod] Đã hoàn tất đồng bộ lên Cloud (${REMOTE})!"
else
  if [ "$REQUIRE_CLOUD" -eq 1 ]; then
    echo "[sao-luu-prod] LỖI (--require-cloud): GIKKY_BACKUP_REMOTE chưa được cấu hình!" >&2
    exit 2
  else
    echo "[sao-luu-prod] CẢNH BÁO: Chưa cấu hình GIKKY_BACKUP_REMOTE. Bản sao lưu mới chỉ nằm trên đĩa VPS!"
  fi
fi

echo "[sao-luu-prod] Toàn bộ quá trình sao lưu hoàn tất thành công!"
