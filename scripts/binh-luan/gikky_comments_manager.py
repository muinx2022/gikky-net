#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CLI Quản lý & Phản hồi bình luận trên website Gikky.net qua HTTP REST API (Thuần API, không cần SSH/Docker).

Tương tác trực tiếp với API công khai và có xác thực của Gikky:
1. Quét bình luận của độc giả trên các bài viết của Gikky / Bot Trader chưa được phản hồi.
2. Phản hồi trực tiếp vào từng bình luận dưới danh nghĩa u/gikky-team-member hoặc u/bot-trader.
3. Đăng bình luận trực tiếp vào mạch bài.

Cách dùng:
    # Quét bình luận mới đang chờ phản hồi
    python scripts/binh-luan/gikky_comments_manager.py --scan

    # Trả lời một bình luận bằng chuỗi văn bản
    python scripts/binh-luan/gikky_comments_manager.py --reply 3 -m "Cảm ơn bạn đã chia sẻ..."

    # Trả lời bằng nội dung từ file
    python scripts/binh-luan/gikky_comments_manager.py --reply 3 --file tra_loi.txt
"""

import argparse
import json
import os
from pathlib import Path
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

DIR_GOC = Path(__file__).resolve().parent
REPO_ROOT = DIR_GOC.parent.parent
CACHE_DIR = DIR_GOC / ".tam"
CACHE_MAP_FILE = CACHE_DIR / "comments_map.json"

# Thêm đường dẫn scripts để import gikky_api_client
SCRIPTS_DIR = DIR_GOC.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from gikky_api_client import GikkyClient


def _doc_cache_map() -> dict:
    if CACHE_MAP_FILE.exists():
        try:
            with open(CACHE_MAP_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def _luu_cache_map(cache_map: dict):
    CACHE_DIR.mkdir(parents=True, exist_ok=True)
    with open(CACHE_MAP_FILE, "w", encoding="utf-8") as f:
        json.dump(cache_map, f, ensure_ascii=False, indent=2)


def quet_binh_luan(role: str = "all") -> list:
    """Quét các bình luận của độc giả chưa được trả lời (role: all, gikky, bot-trader)."""
    client = GikkyClient()
    ds = client.quet_binh_luan_chua_tra_loi(role=role)

    # Cập nhật cache map
    cache_map = _doc_cache_map()
    for c in ds:
        cache_map[str(c["comment_id"])] = c
    _luu_cache_map(cache_map)

    return ds


def phan_hoi_binh_luan(comment_id: int, noi_dung: str, as_user: str = None) -> dict:
    """Gửi nội dung phản hồi cho bình luận cụ thể qua HTTP REST API."""
    cache_map = _doc_cache_map()
    cid_str = str(comment_id)
    info = cache_map.get(cid_str)

    if not info:
        # Nếu chưa có trong cache, quét lại để tìm
        quet_binh_luan("all")
        cache_map = _doc_cache_map()
        info = cache_map.get(cid_str)

    if not info:
        raise ValueError(
            f"Không tìm thấy bình luận #{comment_id} trong danh sách chờ phản hồi. "
            "Có thể bình luận đã được trả lời hoặc không tồn tại."
        )

    mach_id = info["mach_id"]
    responder = as_user or info.get("responder_username") or "gikky-team-member"

    client = GikkyClient()
    client.dang_nhap(vai_tro=responder)

    res = client.viet_binh_luan(
        mach_id=mach_id,
        body=noi_dung,
        parent_id=comment_id,
        body_dinh_dang="markdown",
    )

    # Xoá khỏi cache map sau khi đã phản hồi thành công
    if cid_str in cache_map:
        del cache_map[cid_str]
        _luu_cache_map(cache_map)

    return {
        "status": "success",
        "reply_id": res.get("id"),
        "responder": responder,
        "mach_id": mach_id,
        "mach_title": info.get("mach_title"),
        "mach_url": info.get("mach_url"),
        "created_at": res.get("created_at"),
        "parent_id": comment_id,
        "parent_author": info.get("author"),
    }


def binh_luan_vao_mach(mach_id: int, noi_dung: str, as_user: str = "bot-trader") -> dict:
    """Đăng một bình luận trực tiếp vào mạch bài qua HTTP REST API."""
    client = GikkyClient()
    client.dang_nhap(vai_tro=as_user)

    res = client.viet_binh_luan(
        mach_id=mach_id,
        body=noi_dung,
        parent_id=None,
        body_dinh_dang="markdown",
    )

    return {
        "status": "success",
        "comment_id": res.get("id"),
        "responder": as_user,
        "mach_id": mach_id,
        "created_at": res.get("created_at"),
    }


def in_danh_sach(danh_sach: list):
    if not danh_sach:
        print("\n[OK] Không có bình luận nào của độc giả đang chờ phản hồi trên Gikky.net.")
        return

    print(f"\n[PHÁT HIỆN {len(danh_sach)} BÌNH LUẬN ĐANG CHỜ PHẢN HỒI]:\n" + "=" * 75)
    for idx, c in enumerate(danh_sach, 1):
        target_role = c.get("target_role", "gikky")
        role_tag = "🤖 [BOT TRADER TRADE]" if target_role == "bot-trader" else "📰 [GIKKY TEAM POST]"
        print(f"#{idx} | {role_tag} | Comment ID: {c['comment_id']} | Mạch: [{c['mach_id']}] {c['mach_title']}")
        print(f"    URL: {c['mach_url']}")
        print(f"    Người hỏi: u/{c['author']} ({c['author_display']}) -> Responder: u/{c.get('responder_username', 'gikky-team-member')}")
        print(f"    Thời gian: {c['created_at']}")
        print("    Nội dung:")
        for line in c["body"].splitlines():
            print(f"      > {line}")
        print("-" * 75)


def main():
    parser = argparse.ArgumentParser(description="Quản lý & phản hồi bình luận website Gikky.net (HTTP REST API)")
    parser.add_argument("--scan", action="store_true", help="Quét bình luận chưa trả lời")
    parser.add_argument("--role", default="all", choices=["all", "gikky", "bot-trader", "trader"], help="Phạm vi quét: all, gikky, hoặc bot-trader")
    parser.add_argument("--json", action="store_true", help="In kết quả dưới dạng JSON")
    parser.add_argument("--reply", type=int, help="ID của bình luận cần trả lời")
    parser.add_argument("--as-user", type=str, default=None, choices=["gikky-team-member", "bot-trader"], help="Chỉ định user phản hồi")
    parser.add_argument("--post-to-mach", type=int, help="Đăng bình luận trực tiếp vào mạch (ID)")
    parser.add_argument("-m", "--message", type=str, help="Nội dung phản hồi trực tiếp")
    parser.add_argument("--file", type=str, help="Đường dẫn file chứa nội dung phản hồi")

    args = parser.parse_args()

    if args.scan:
        ds = quet_binh_luan(role=args.role)
        if args.json:
            print(json.dumps(ds, ensure_ascii=False, indent=2))
        else:
            in_danh_sach(ds)
        return

    if args.reply:
        noi_dung = ""
        if args.file and os.path.exists(args.file):
            with open(args.file, "r", encoding="utf-8") as f:
                noi_dung = f.read()
        elif args.message:
            noi_dung = args.message
        else:
            print("[LỖI] Cần cung cấp -m \"nội dung\" hoặc --file <đường dẫn> để phản hồi.")
            sys.exit(1)

        user_tag = f" dưới tư cách u/{args.as_user}" if args.as_user else ""
        print(f"[*] Đang gửi phản hồi cho bình luận #{args.reply}{user_tag}...")
        res = phan_hoi_binh_luan(args.reply, noi_dung, as_user=args.as_user)
        print("\n[KẾT QUẢ]:")
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return

    if args.post_to_mach:
        noi_dung = ""
        if args.file and os.path.exists(args.file):
            with open(args.file, "r", encoding="utf-8") as f:
                noi_dung = f.read()
        elif args.message:
            noi_dung = args.message
        else:
            print("[LỖI] Cần cung cấp -m \"nội dung\" hoặc --file <đường dẫn>.")
            sys.exit(1)

        user_target = args.as_user or "bot-trader"
        print(f"[*] Đang đăng bình luận vào mạch #{args.post_to_mach} dưới tư cách u/{user_target}...")
        res = binh_luan_vao_mach(args.post_to_mach, noi_dung, as_user=user_target)
        print("\n[KẾT QUẢ]:")
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
