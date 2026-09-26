#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Facebook Reels Publisher cho gikky.net

Hỗ trợ:
- Tải video ngắn tỷ lệ 9:16 trực tiếp lên Facebook Reels của Page Gikky.net
- Sử dụng chính thức Meta Graph API Video Reels Publishing
- Kiểm tra tiến trình xử lý video (Video Processing Status)
"""

import argparse
import os
import sys
import time
from pathlib import Path
import requests

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

DIR_GOC = Path(__file__).resolve().parent
REPO_ROOT = DIR_GOC.parent.parent


def doc_cau_hinh(duong_dan_env=None):
    if not duong_dan_env:
        duong_dan_env = REPO_ROOT / ".env.facebook"

    config = {
        "FB_PAGE_ID": os.environ.get("FB_PAGE_ID"),
        "FB_PAGE_ACCESS_TOKEN": os.environ.get("FB_PAGE_ACCESS_TOKEN"),
        "FB_GRAPH_VERSION": os.environ.get("FB_GRAPH_VERSION", "v19.0"),
    }

    if Path(duong_dan_env).exists():
        with open(duong_dan_env, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    config[k.strip()] = v.strip()

    if not config.get("FB_PAGE_ID") or not config.get("FB_PAGE_ACCESS_TOKEN"):
        raise ValueError(f"Thiếu FB_PAGE_ID hoặc FB_PAGE_ACCESS_TOKEN trong {duong_dan_env}")

    return config


def dang_reel(duong_dan_video, caption="", wait_for_ready=True):
    video_path = Path(duong_dan_video).resolve()
    if not video_path.exists():
        raise FileNotFoundError(f"Không tìm thấy file video: {duong_dan_video}")

    file_size = os.path.getsize(video_path)
    config = doc_cau_hinh()
    page_id = config["FB_PAGE_ID"]
    token = config["FB_PAGE_ACCESS_TOKEN"]
    version = config.get("FB_GRAPH_VERSION", "v19.0")

    print(f"🎬 Bắt đầu xuất bản Facebook Reel...")
    print(f"📁 Video: {video_path.name} ({file_size / (1024*1024):.2f} MB)")

    # BƯỚC 1: Khởi tạo phiên tải lên (Initialize Upload Session)
    start_url = f"https://graph.facebook.com/{version}/{page_id}/video_reels"
    r1 = requests.post(start_url, data={"upload_phase": "start", "access_token": token})
    if r1.status_code != 200 or "video_id" not in r1.json():
        raise RuntimeError(f"Lỗi khởi tạo Reel: {r1.status_code} - {r1.text}")

    res1 = r1.json()
    video_id = res1["video_id"]
    upload_url = res1["upload_url"]
    print(f"✅ Đã khởi tạo phiên Reel. Video ID: {video_id}")

    # BƯỚC 2: Tải dữ liệu video nhị phân lên RUPLOAD server
    print("⏳ Đang tải tệp video nhị phân lên máy chủ Facebook...")
    with open(video_path, "rb") as f:
        video_bytes = f.read()

    headers = {
        "Authorization": f"OAuth {token}",
        "offset": "0",
        "file_size": str(file_size),
        "Content-Type": "application/octet-stream",
    }
    r2 = requests.post(upload_url, headers=headers, data=video_bytes)
    if r2.status_code not in (200, 201):
        raise RuntimeError(f"Lỗi tải video lên RUPLOAD: {r2.status_code} - {r2.text}")
    print("✅ Đã tải xong video lên máy chủ Facebook.")

    # BƯỚC 3: Hoàn tất và kích hoạt xuất bản (Publish Finish)
    print("🚀 Đang hoàn tất và kích hoạt xuất bản lên Facebook Reels...")
    finish_url = f"https://graph.facebook.com/{version}/{page_id}/video_reels"
    payload_finish = {
        "upload_phase": "finish",
        "video_id": video_id,
        "video_state": "PUBLISHED",
        "description": caption,
        "access_token": token,
    }
    r3 = requests.post(finish_url, data=payload_finish)
    if r3.status_code != 200 or not r3.json().get("success"):
        raise RuntimeError(f"Lỗi hoàn tất xuất bản Reel: {r3.status_code} - {r3.text}")

    permalink = f"https://www.facebook.com/reel/{video_id}"
    print(f"🎉 Xuất bản Reel thành công!")
    print(f"🆔 Video ID: {video_id}")
    print(f"🔗 Link Facebook Reel: {permalink}")

    # BƯỚC 4: Kiểm tra trạng thái xử lý nếu cần
    if wait_for_ready:
        print("⏳ Đang kiểm tra trạng thái render của Facebook...")
        for _ in range(6):
            time.sleep(3)
            status_url = f"https://graph.facebook.com/{version}/{video_id}?fields=status&access_token={token}"
            r_st = requests.get(status_url)
            if r_st.status_code == 200:
                st_data = r_st.json().get("status", {})
                v_status = st_data.get("video_status")
                print(f"   Trạng thái hiện tại: {v_status}")
                if v_status in ("ready", "published"):
                    print("✨ Video đã được Facebook xử lý hoàn tất và sẵn sàng hiển thị!")
                    break

    return {
        "status": "success",
        "video_id": video_id,
        "permalink": permalink,
        "file": str(video_path),
    }


def main():
    parser = argparse.ArgumentParser(description="Đăng video lên Facebook Reels (Gikky.net)")
    parser.add_argument("--video", "-v", required=True, help="Đường dẫn file video MP4 (tỷ lệ 9:16)")
    parser.add_argument("--caption", "-c", default="", help="Nội dung Caption đi kèm Reel")
    parser.add_argument("--caption-file", help="Đường dẫn file text chứa Caption")
    parser.add_argument("--no-wait", action="store_true", help="Không đợi kiểm tra trạng thái video ready")

    args = parser.parse_args()

    caption = args.caption
    if args.caption_file:
        with open(args.caption_file, "r", encoding="utf-8") as f:
            caption = f.read()

    try:
        dang_reel(args.video, caption=caption, wait_for_ready=not args.no_wait)
    except Exception as e:
        print(f"❌ Lỗi: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
