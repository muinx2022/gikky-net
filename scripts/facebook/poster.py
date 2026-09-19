#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Facebook Poster cho gikky.net

Hỗ trợ:
- Đăng bài tức thì hoặc lên lịch (Facebook native scheduling)
- Tự động gắn watermark gikky.net cho ảnh
- Hỗ trợ 1 ảnh hoặc nhiều ảnh (multi-photo collage)
- Đọc cấu hình từ .env.facebook
"""

import argparse
import datetime
import json
import os
import sys
import time
from pathlib import Path
import requests

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

# Thư mục chứa script
DIR_GOC = Path(__file__).resolve().parent
REPO_ROOT = DIR_GOC.parent.parent

# Import module gắn watermark
sys.path.append(str(REPO_ROOT / "scripts" / "bai-viet"))
try:
    from watermark import gan_watermark
except ImportError:
    gan_watermark = None


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


def chuan_bi_anh(danh_sach_anh, gan_wm=True, wm_text="gikky.net"):
    ds_da_xu_ly = []
    for idx, p in enumerate(danh_sach_anh):
        path_obj = Path(p).resolve()
        if not path_obj.exists():
            raise FileNotFoundError(f"Không tìm thấy ảnh: {p}")

        if gan_wm and gan_watermark:
            thu_muc_tam = DIR_GOC / ".tam_anh"
            thu_muc_tam.mkdir(parents=True, exist_ok=True)
            out_path = thu_muc_tam / f"wm_{int(time.time())}_{idx}_{path_obj.name}"
            gan_watermark(str(path_obj), str(out_path), text=wm_text)
            ds_da_xu_ly.append(str(out_path))
        else:
            ds_da_xu_ly.append(str(path_obj))

    return ds_da_xu_ly


def dang_bai(noi_dung, danh_sach_anh=None, lich_dang=None, gan_wm=True, wm_text="gikky.net"):
    config = doc_cau_hinh()
    page_id = config["FB_PAGE_ID"]
    token = config["FB_PAGE_ACCESS_TOKEN"]
    version = config.get("FB_GRAPH_VERSION", "v19.0")

    base_url = f"https://graph.facebook.com/{version}/{page_id}"

    scheduled_timestamp = None
    if lich_dang:
        if isinstance(lich_dang, (int, float)):
            scheduled_timestamp = int(lich_dang)
        elif isinstance(lich_dang, str):
            try:
                if "T" in lich_dang:
                    dt = datetime.datetime.fromisoformat(lich_dang)
                else:
                    dt = datetime.datetime.strptime(lich_dang, "%Y-%m-%d %H:%M")
                scheduled_timestamp = int(dt.timestamp())
            except Exception as e:
                raise ValueError(f"Định dạng thời gian không hợp lệ ({lich_dang}): {e}")

        now_ts = int(time.time())
        diff = scheduled_timestamp - now_ts
        if diff < 600:
            raise ValueError("Thời gian lên lịch Facebook phải sau thời điểm hiện tại ít nhất 10 phút!")
        if diff > 75 * 86400:
            raise ValueError("Thời gian lên lịch Facebook không được quá 75 ngày!")

    anh_xu_ly = chuan_bi_anh(danh_sach_anh or [], gan_wm=gan_wm, wm_text=wm_text)

    # TRƯỜNG HỢP 1: Không có ảnh (Chỉ văn bản)
    if not anh_xu_ly:
        payload = {
            "message": noi_dung,
            "access_token": token,
        }
        if scheduled_timestamp:
            payload["published"] = False
            payload["scheduled_publish_time"] = scheduled_timestamp

        res = requests.post(f"{base_url}/feed", data=payload)
        res_data = res.json()
        if res.status_code != 200 or "id" not in res_data:
            raise RuntimeError(f"Lỗi đăng bài: {res_data}")
        return {"status": "success", "post_id": res_data["id"], "type": "text_only"}

    # TRƯỜNG HỢP 2: Đúng 1 ảnh
    elif len(anh_xu_ly) == 1:
        img_path = anh_xu_ly[0]
        payload = {
            "caption": noi_dung,
            "access_token": token,
        }
        if scheduled_timestamp:
            payload["published"] = False
            payload["scheduled_publish_time"] = scheduled_timestamp
        else:
            payload["published"] = True

        with open(img_path, "rb") as f:
            files = {"source": f}
            res = requests.post(f"{base_url}/photos", data=payload, files=files)

        res_data = res.json()
        if res.status_code != 200 or ("id" not in res_data and "post_id" not in res_data):
            raise RuntimeError(f"Lỗi đăng ảnh: {res_data}")

        post_id = res_data.get("post_id") or res_data.get("id")
        return {"status": "success", "post_id": post_id, "photo_id": res_data.get("id"), "type": "single_photo"}

    # TRƯỜNG HỢP 3: Nhiều ảnh (Multi-photo album)
    else:
        media_fbid_list = []
        for p in anh_xu_ly:
            with open(p, "rb") as f:
                res = requests.post(
                    f"{base_url}/photos",
                    data={"published": False, "access_token": token},
                    files={"source": f},
                )
            res_data = res.json()
            if res.status_code != 200 or "id" not in res_data:
                raise RuntimeError(f"Lỗi tải ảnh phụ {p}: {res_data}")
            media_fbid_list.append({"media_fbid": res_data["id"]})

        payload = {
            "message": noi_dung,
            "access_token": token,
        }
        for i, media_obj in enumerate(media_fbid_list):
            payload[f"attached_media[{i}]"] = json.dumps(media_obj)

        if scheduled_timestamp:
            payload["published"] = False
            payload["scheduled_publish_time"] = scheduled_timestamp

        res = requests.post(f"{base_url}/feed", data=payload)
        res_data = res.json()
        if res.status_code != 200 or "id" not in res_data:
            raise RuntimeError(f"Lỗi đăng nhóm ảnh: {res_data}")

        post_id = res_data["id"]
        permalink = f"https://www.facebook.com/{post_id}"
        try:
            r_info = requests.get(f"https://graph.facebook.com/{version}/{post_id}?fields=permalink_url&access_token={token}")
            if r_info.status_code == 200:
                permalink = r_info.json().get("permalink_url", permalink)
        except Exception:
            pass

        return {"status": "success", "post_id": post_id, "permalink_url": permalink, "type": "multi_photo", "count": len(anh_xu_ly)}


def main():
    parser = argparse.ArgumentParser(description="Đăng bài lên Facebook Page (Gikky)")
    parser.add_argument("--text", "-t", help="Nội dung bài viết")
    parser.add_argument("--file", "-f", help="Đường dẫn file chứa nội dung bài viết")
    parser.add_argument("--image", "-i", action="append", help="Đường dẫn file ảnh (có thể gọi nhiều lần)")
    parser.add_argument("--schedule", "-s", help="Hẹn giờ đăng (YYYY-MM-DD HH:MM hoặc ISO)")
    parser.add_argument("--no-watermark", action="store_true", help="Không gắn watermark cho ảnh")
    parser.add_argument("--wm-text", default="gikky.net", help="Chữ trên watermark (mặc định: gikky.net)")

    args = parser.parse_args()

    noi_dung = ""
    if args.file:
        with open(args.file, "r", encoding="utf-8") as f:
            noi_dung = f.read()
    elif args.text:
        noi_dung = args.text
    else:
        print("Lỗi: Cần cung cấp --text hoặc --file")
        sys.exit(1)

    print("🚀 Đang tiến hành xuất bản lên Facebook Page...")
    try:
        kq = dang_bai(
            noi_dung=noi_dung,
            danh_sach_anh=args.image,
            lich_dang=args.schedule,
            gan_wm=not args.no_watermark,
            wm_text=args.wm_text,
        )
        print("✅ Đăng bài thành công!")
        print(f"📌 Loại bài: {kq.get('type')}")
        print(f"🆔 Post ID: {kq.get('post_id')}")
        print(f"🔗 Link bài viết: https://www.facebook.com/{kq.get('post_id')}")
    except Exception as e:
        print(f"❌ Thất bại: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()
