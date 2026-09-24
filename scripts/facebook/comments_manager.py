#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Trình quản lý và phản hồi bình luận Facebook Page (Gikky.net)

Hỗ trợ:
- Quét toàn bộ bình luận trên các bài viết gần nhất
- Nhận diện bình luận mới chưa trả lời (lọc bỏ bình luận của Page)
- Phản hồi trực tiếp vào từng bình luận qua Graph API
- Lưu lịch sử bình luận đã phản hồi để không bị trùng lặp
"""

import argparse
import datetime
import json
import os
import sys
from pathlib import Path
import requests

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

DIR_GOC = Path(__file__).resolve().parent
REPO_ROOT = DIR_GOC.parent.parent
HISTORY_FILE = DIR_GOC / ".tam" / "answered_comments.json"


def doc_cau_hinh():
    duong_dan_env = REPO_ROOT / ".env.facebook"
    config = {
        "FB_PAGE_ID": os.environ.get("FB_PAGE_ID"),
        "FB_PAGE_ACCESS_TOKEN": os.environ.get("FB_PAGE_ACCESS_TOKEN"),
        "FB_GRAPH_VERSION": os.environ.get("FB_GRAPH_VERSION", "v19.0"),
    }
    if duong_dan_env.exists():
        with open(duong_dan_env, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    config[k.strip()] = v.strip()
    return config


def doc_lich_su_da_tra_loi():
    if HISTORY_FILE.exists():
        try:
            with open(HISTORY_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return {}
    return {}


def luu_lich_su_da_tra_loi(data):
    HISTORY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(HISTORY_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def _lay_het_comments(comments_block, token):
    """Duyệt cursor-based pagination của Graph API để lấy TOÀN BỘ bình luận.

    Graph API trả `paging.next` khi còn trang tiếp. Không có trường đó thì đã hết.
    Giới hạn 500 bình luận mỗi bài để không lặp vô tận nếu API trả lỗi.
    """
    tat_ca = list(comments_block.get("data", []))
    trang_ke = comments_block.get("paging", {}).get("next")
    dem = 0
    while trang_ke and dem < 20:  # 20 trang × 25 = tối đa 500 bình luận
        dem += 1
        r = requests.get(trang_ke)
        if r.status_code != 200:
            break
        body = r.json()
        du_lieu = body.get("data", [])
        if not du_lieu:
            break
        tat_ca.extend(du_lieu)
        trang_ke = body.get("paging", {}).get("next")
    return tat_ca


def quet_binh_luan(so_bai=10):
    config = doc_cau_hinh()
    page_id = config["FB_PAGE_ID"]
    token = config["FB_PAGE_ACCESS_TOKEN"]
    version = config.get("FB_GRAPH_VERSION", "v19.0")

    url = (
        f"https://graph.facebook.com/{version}/{page_id}/feed"
        f"?fields=id,message,created_time,permalink_url,comments.limit(25){{id,from,message,created_time,comment_count,comments.limit(25){{id,from,message,created_time}}}}"
        f"&limit={so_bai}&access_token={token}"
    )

    r = requests.get(url)
    if r.status_code != 200:
        raise RuntimeError(f"Lỗi khi lấy dữ liệu: {r.json()}")

    posts = r.json().get("data", [])
    da_tra_loi = doc_lich_su_da_tra_loi()

    danh_sach_cho_duyet = []

    for post in posts:
        post_id = post.get("id")
        post_title = (post.get("message") or "Bài viết không có tiêu đề").split("\n")[0][:60]
        permalink = post.get("permalink_url") or f"https://www.facebook.com/{post_id}"

        # Phân trang: lấy hết bình luận thay vì chỉ 25 đầu tiên
        comments_data = _lay_het_comments(post.get("comments", {}), token)
        for c in comments_data:
            c_id = c.get("id")
            c_from = c.get("from", {})
            c_sender_id = c_from.get("id")
            c_sender_name = c_from.get("name") or "Người dùng ẩn danh"
            c_msg = c.get("message", "").strip()
            c_time = c.get("created_time")

            # Bỏ qua nếu bình luận do chính Page viết
            if str(c_sender_id) == str(page_id):
                continue

            # Kiểm tra xem bình luận này đã có câu trả lời của Page chưa
            # Phân trang reply con luôn
            sub_comments = _lay_het_comments(c.get("comments", {}), token)
            page_already_replied = any(str(sub.get("from", {}).get("id")) == str(page_id) for sub in sub_comments)

            status = "da_tra_loi" if (c_id in da_tra_loi or page_already_replied) else "cho_phan_hoi"

            danh_sach_cho_duyet.append({
                "comment_id": c_id,
                "sender_name": c_sender_name,
                "sender_id": c_sender_id,
                "message": c_msg,
                "created_time": c_time,
                "post_id": post_id,
                "post_title": post_title,
                "permalink": permalink,
                "status": status,
                "sub_comments_count": len(sub_comments),
            })

    return danh_sach_cho_duyet


def tra_loi_binh_luan(comment_id, noi_dung_tra_loi):
    config = doc_cau_hinh()
    token = config["FB_PAGE_ACCESS_TOKEN"]
    version = config.get("FB_GRAPH_VERSION", "v19.0")

    url = f"https://graph.facebook.com/{version}/{comment_id}/comments"
    payload = {
        "message": noi_dung_tra_loi,
        "access_token": token,
    }

    r = requests.post(url, data=payload)
    res_data = r.json()

    if r.status_code != 200 or "id" not in res_data:
        raise RuntimeError(f"Lỗi khi gửi phản hồi: {res_data}")

    # Ghi nhận vào lịch sử
    da_tra_loi = doc_lich_su_da_tra_loi()
    da_tra_loi[comment_id] = {
        "reply_id": res_data["id"],
        "reply_text": noi_dung_tra_loi,
        "timestamp": datetime.datetime.now().isoformat(),
    }
    luu_lich_su_da_tra_loi(da_tra_loi)

    return {"status": "success", "reply_id": res_data["id"]}


def main():
    parser = argparse.ArgumentParser(description="Quản lý và phản hồi bình luận Fanpage Gikky.net")
    parser.add_argument("--scan", action="store_true", help="Quét tất cả bình luận mới trên các bài viết")
    parser.add_argument("--all", action="store_true", help="Hiển thị cả bình luận đã trả lời")
    parser.add_argument("--reply", help="Comment ID cần trả lời")
    parser.add_argument("--message", "-m", help="Nội dung phản hồi")

    args = parser.parse_args()

    if args.reply and args.message:
        print(f"🚀 Đang gửi câu trả lời cho bình luận [{args.reply}]...")
        try:
            res = tra_loi_binh_luan(args.reply, args.message)
            print(f"✅ Đã trả lời thành công! Reply ID: {res.get('reply_id')}")
        except Exception as e:
            print(f"❌ Thất bại: {e}")
            sys.exit(1)
        return

    # Mặc định quét bình luận
    print("🔍 Đang quét bình luận trên Fanpage Gikky.net...")
    try:
        ds = quet_binh_luan(so_bai=15)
        cho_phan_hoi = [c for c in ds if c["status"] == "cho_phan_hoi"]
        da_tl = [c for c in ds if c["status"] == "da_tra_loi"]

        print(f"\n📊 Tổng cộng phát hiện: {len(ds)} bình luận ({len(cho_phan_hoi)} chưa trả lời, {len(da_tl)} đã trả lời).\n")

        danh_sach_in = ds if args.all else cho_phan_hoi

        if not danh_sach_in:
            print("✨ Hiện không có bình luận nào đang chờ phản hồi!")
            return

        for idx, c in enumerate(danh_sach_in, 1):
            trang_thai = "⏳ CHỜ PHẢN HỒI" if c["status"] == "cho_phan_hoi" else "✅ ĐÃ TRẢ LỜI"
            print(f"[{idx}] {trang_thai}")
            print(f"   👤 Người gửi: {c['sender_name']} (ID: {c['sender_id']})")
            print(f"   💬 Nội dung: \"{c['message']}\"")
            print(f"   📄 Bài viết: {c['post_title']}")
            print(f"   🆔 Comment ID: {c['comment_id']}")
            print(f"   🔗 Link: {c['permalink']}")
            print("-" * 60)

    except Exception as e:
        print(f"❌ Thất bại khi quét: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
