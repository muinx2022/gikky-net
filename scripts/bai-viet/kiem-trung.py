#!/usr/bin/env python3
"""Script kiểm trùng đề tài bài viết trên gikky.net.

Khắc phục triệt để:
1. Bẫy dấu tiếng Việt (uỷ vs ủy, d vs đ, e vs ê...).
2. Bẫy chữ có dấu quốc tế (El Niño vs El Nino).
3. Quét toàn bộ 100% database (không giới hạn 10 bài gần nhất).

Cách dùng:
    # Trên máy dev:
    python scripts/bai-viet/kiem-trung.py "từ khóa 1" "từ khóa 2" ...
    
    # Hoặc truyền tiêu đề dự kiến:
    python scripts/bai-viet/kiem-trung.py --tieu-de "Thủy điện và chu kỳ El Nino"
"""

import argparse
import os
import subprocess
import sys
import unicodedata


def loai_bo_dau(s: str) -> str:
    """Chuẩn hóa Unicode, chuyển đ/Đ thành d/D và gỡ toàn bộ dấu thanh/mũ."""
    if not s:
        return ""
    s = s.replace("đ", "d").replace("Đ", "D")
    normalized = unicodedata.normalize("NFD", s)
    return "".join(c for c in normalized if unicodedata.category(c) != "Mn").lower()


def kiem_trung_tren_vps(tu_khoas: list[str]) -> list[dict]:
    """Chạy kiểm tra trên VPS thông qua container api."""
    python_code = f"""
import os, django, unicodedata
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()
from core.models import Mach

def loai_bo_dau(s):
    if not s: return ""
    s = s.replace("đ", "d").replace("Đ", "D")
    return "".join(c for c in unicodedata.normalize("NFD", s) if unicodedata.category(c) != "Mn").lower()

tu_khoas = {tu_khoas!r}
tu_khoas_clean = [loai_bo_dau(k) for k in tu_khoas if k.strip()]

ket_qua = []
for m in Mach.objects.all().order_by('-id'):
    t_clean = loai_bo_dau(m.title)
    for k in tu_khoas_clean:
        if k in t_clean:
            ket_qua.append({{"id": m.id, "sub": m.sub.slug, "title": m.title, "match": k}})
            break

import json
print("JSON_RESULT:" + json.dumps(ket_qua, ensure_ascii=False))
"""
    cmd = [
        "ssh",
        "vps-muinx",
        "cd ~/gikky-net/src && docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env exec -T api python -",
    ]
    p = subprocess.Popen(
        cmd,
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
    )
    out, err = p.communicate(python_code.encode("utf-8"))
    stdout_text = out.decode("utf-8", errors="ignore")

    for line in stdout_text.splitlines():
        if line.startswith("JSON_RESULT:"):
            import json

            return json.loads(line[len("JSON_RESULT:") :])
    return []


def main():
    sys.stdout.reconfigure(encoding="utf-8")
    parser = argparse.ArgumentParser(
        description="Kiểm trùng bài viết toàn bộ database gikky.net"
    )
    parser.add_argument(
        "keywords", nargs="*", help="Các từ khóa cần kiểm tra trùng lặp"
    )
    parser.add_argument(
        "--tieu-de", help="Tiêu đề bài viết dự kiến (tự động tách từ khóa)"
    )

    args = parser.parse_args()
    tu_khoas = list(args.keywords)
    if args.tieu_de:
        tu_khoas.append(args.tieu_de)
        # Bổ sung một số cụm từ chính nếu tiêu đề dài
        parts = args.tieu_de.split(":")
        for part in parts:
            p = part.strip()
            if len(p) > 5:
                tu_khoas.append(p)

    if not tu_khoas:
        print("Lỗi: Cần cung cấp ít nhất một từ khóa hoặc --tieu-de.")
        sys.exit(2)

    print(f"Đang kiểm trùng cho các từ khóa: {tu_khoas}")
    trung = kiem_trung_tren_vps(tu_khoas)

    if trung:
        print(f"\n⚠️ PHÁT HIỆN {len(trung)} BÀI TRÙNG LẶP TRONG DATABASE:")
        for r in trung:
            print(f"   - #{r['id']} | s/{r['sub']} | Khớp từ khóa: '{r['match']}'")
            print(f"     Tiêu đề: {r['title']}")
        sys.exit(1)
    else:
        print("\n✅ HOÀN TOÀN HỢP LỆ: Không phát hiện bài trùng nào trong database.")
        sys.exit(0)


if __name__ == "__main__":
    main()
