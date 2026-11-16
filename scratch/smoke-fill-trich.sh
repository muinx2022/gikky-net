#!/bin/bash
set -euo pipefail
H='Host: gikky.net'
B='http://127.0.0.1:8091'
curl -s -o /dev/null -w 'health=%{http_code}\n' "$B/api/v1/health"
curl -s -o /dev/null -w 'django_admin=%{http_code}\n' "$B/api/admin/django/login/"
curl -s -o /dev/null -w 'openapi=%{http_code}\n' "$B/api/v1/openapi.json"
curl -s -o /dev/null -w "home=%{http_code}\n" -H "$H" "$B/"
curl -s -o /dev/null -w "chung_khoan=%{http_code}\n" -H "$H" "$B/s/chung-khoan"
curl -s -o /dev/null -w "admin=%{http_code}\n" -H 'Host: admin.gikky.net' "$B/"
curl -s -H "$H" "$B/api/v1/feeds/moi?limit=8" > /tmp/feed-moi.json
python3 - <<'PY'
import json
d=json.load(open("/tmp/feed-moi.json"))
xs=[]
for m in d.get("items",[]):
    xt=m.get("xem_truoc") or {}
    xs.append((m["id"], len(xt.get("trich") or ""), bool(xt.get("anh"))))
print("n=", len(xs))
print("rows=", xs)
print("max_trich=", max((t for _,t,_ in xs), default=0))
PY
# CSS clamp 5 phải có trong bundle đã build (nguồn trên đĩa)
grep -n "line-clamp" ~/gikky-net/src/apps/web/components/the-mach.module.css | head -5
test -f ~/gikky-net/src/apps/web/lib/boi-canh-chu-de.ts && echo boi_canh_file=ok
grep -n "DAI_TRICH_FEED = 400" ~/gikky-net/src/api/api/schemas.py
