# -*- coding: utf-8 -*-
"""YouTube & YouTube Shorts Publisher tự động cho Gikky.net.

Sử dụng chính thức Google YouTube Data API v3:
- Upload video dài 16:9 kèm Thumbnail tùy chỉnh và Timestamps SEO
- Upload video ngắn YouTube Shorts 9:16 (tự động gắn tag #Shorts)
- Cơ chế xác thực OAuth 2.0 bền vững (lưu token.json, tự động refresh không cần đăng nhập lại)
- Tải lên theo phân đoạn Resumable Upload chống đứt kết nối mạng

Cách sử dụng:
1. Bước chuẩn bị (1 lần duy nhất):
   - Đặt file `client_secrets.json` (tải từ Google Cloud Console) vào thư mục `scripts/youtube/`
   - Chạy lệnh kích hoạt xác thực 1 lần:
     python scripts/youtube/youtube_publisher.py --auth

2. Upload Video dài (16:9):
   python scripts/youtube/youtube_publisher.py \
       --video "apps/web/public/gikky_youtube_tam_giac_doi_xung_16x9.mp4" \
       --title "Bắt Đúng Điểm Bùng Nổ Mô Hình Tam Giác Đối Xứng | Bí Quyết Quản Trị R:R 1:2.8" \
       --description "Mô tả chuẩn SEO..." \
       --tags "tam giac doi xung, price action, quan tri rui ro" \
       --thumbnail "apps/web/public/gikky_thumbnail_tam_giac_doi_xung_16x9.png" \
       --privacy "public"

3. Upload Video ngắn (Shorts 9:16):
   python scripts/youtube/youtube_publisher.py \
       --video "apps/web/public/gikky_short_tam_giac_doi_xung_9x16.mp4" \
       --title "Bắt đúng điểm nổ mô hình Tam giác đối xứng #Shorts" \
       --description "Kỹ thuật dời Stop Loss về hòa vốn đưa rủi ro về đúng 0%!" \
       --tags "gikky, shorts, trading, priceaction" \
       --is-short \
       --privacy "public"
"""

import os
import sys
import argparse
import time
from pathlib import Path

# Đảm bảo in UTF-8 trên Windows
if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

DIR_GOC = Path(__file__).resolve().parent
REPO_ROOT = DIR_GOC.parent.parent

CLIENT_SECRETS_FILE = DIR_GOC / "client_secrets.json"
TOKEN_FILE = DIR_GOC / "token.json"
SCOPES = ["https://www.googleapis.com/auth/youtube.upload"]


def lay_dich_vu_youtube():
    """Khởi tạo và xác thực YouTube Data API v3 client."""
    from google.oauth2.credentials import Credentials
    from google_auth_oauthlib.flow import InstalledAppFlow
    from google.auth.transport.requests import Request
    from googleapiclient.discovery import build

    creds = None
    if TOKEN_FILE.exists():
        try:
            creds = Credentials.from_authorized_user_file(str(TOKEN_FILE), SCOPES)
        except Exception as e:
            print(f"⚠️ Không đọc được token cũ: {e}")

    # Nếu chưa có token hoặc token hết hạn, thực hiện xác thực / refresh
    if not creds or not creds.valid:
        if creds and creds.expired and creds.refresh_token:
            print("🔄 Đang làm mới OAuth Token bằng refresh_token...")
            try:
                creds.refresh(Request())
            except Exception as e:
                print(f"❌ Không thể refresh token: {e}. Cần xác thực lại.")
                creds = None

        if not creds:
            if not CLIENT_SECRETS_FILE.exists():
                raise FileNotFoundError(
                    f"❌ Thiếu file cấu hình OAuth 2.0: {CLIENT_SECRETS_FILE}\n"
                    f"👉 Hãy tải 'client_secrets.json' từ Google Cloud Console (APIs & Services -> Credentials -> OAuth Client ID) và đặt vào thư mục {DIR_GOC}"
                )
            print("🌐 Khởi động trình duyệt để xác thực cấp quyền YouTube lần đầu...")
            flow = InstalledAppFlow.from_client_secrets_file(str(CLIENT_SECRETS_FILE), SCOPES)
            creds = flow.run_local_server(port=0)

        # Lưu lại token để dùng vĩnh viễn trong các phiên chạy sau
        with open(TOKEN_FILE, "w", encoding="utf-8") as token_out:
            token_out.write(creds.to_json())
        print(f"✅ Đã lưu phiên xác thực vào: {TOKEN_FILE}")

    return build("youtube", "v3", credentials=creds)


def upload_video(
    video_path,
    title,
    description,
    tags=None,
    category_id="27",  # 27 là mục Education (Giáo dục / Tài chính)
    privacy_status="public",
    thumbnail_path=None,
    is_short=False,
):
    """Tải video lên YouTube bằng Resumable Upload."""
    from googleapiclient.http import MediaFileUpload
    from googleapiclient.errors import HttpError

    video_file = Path(video_path).resolve()
    if not video_file.exists():
        raise FileNotFoundError(f"Không tìm thấy file video: {video_file}")

    file_size_mb = os.path.getsize(video_file) / (1024 * 1024)
    print(f"\n🎬 Chuẩn bị tải lên YouTube: {video_file.name} ({file_size_mb:.2f} MB)")

    # Tự động tối ưu cho YouTube Shorts
    if is_short or "short" in video_file.name.lower():
        is_short = True
        if "#Shorts" not in title and "#shorts" not in title:
            title = f"{title} #Shorts"
        if "#Shorts" not in description:
            description = f"{description}\n\n#Shorts #gikky"
        print("📱 Định dạng được nhận diện: YouTube Shorts (9:16)")
    else:
        print("🖥️ Định dạng được nhận diện: YouTube Video (16:9)")

    youtube = lay_dich_vu_youtube()

    # Cắt ngắn title nếu vượt trần 100 ký tự của YouTube
    if len(title) > 100:
        title = title[:97] + "..."

    # Chuẩn bị metadata
    body_metadata = {
        "snippet": {
            "title": title,
            "description": description,
            "tags": [t.strip() for t in tags.split(",")] if tags else ["gikky", "tai chinh"],
            "categoryId": category_id,
            "defaultLanguage": "vi",
            "defaultAudioLanguage": "vi",
        },
        "status": {
            "privacyStatus": privacy_status,
            "selfDeclaredMadeForKids": False,
        },
    }

    # Resumable Media Upload (5MB mỗi chunk)
    media = MediaFileUpload(
        str(video_file),
        mimetype="video/mp4",
        chunksize=5 * 1024 * 1024,
        resumable=True,
    )

    request = youtube.videos().insert(
        part="snippet,status",
        body=body_metadata,
        media_body=media,
    )

    print("⏳ Đang truyền tải dữ liệu video lên máy chủ YouTube...")
    response = None
    retry_count = 0
    while response is None:
        try:
            status, response = request.next_chunk()
            if status:
                percent = int(status.progress() * 100)
                print(f"   -> Đã tải: {percent}%...")
        except HttpError as e:
            if e.resp.status in [500, 502, 503, 504]:
                retry_count += 1
                if retry_count > 5:
                    raise
                print(f"⚠️ Mạng chập chờn (HTTP {e.resp.status}), thử lại sau 5 giây (Lần {retry_count})...")
                time.sleep(5)
            else:
                raise

    video_id = response.get("id")
    if not video_id:
        raise RuntimeError(f"Upload thất bại, không nhận được video ID: {response}")

    if is_short:
        video_url = f"https://www.youtube.com/shorts/{video_id}"
    else:
        video_url = f"https://www.youtube.com/watch?v={video_id}"

    print(f"\n🎉 UPLOAD THÀNH CÔNG!")
    print(f"🆔 Video ID: {video_id}")
    print(f"🔗 Link Video: {video_url}")

    # Đặt Thumbnail nếu có (chỉ cho video dài)
    if thumbnail_path and not is_short:
        thumb_file = Path(thumbnail_path).resolve()
        if thumb_file.exists():
            print(f"🖼️ Đang cập nhật Thumbnail tùy chỉnh: {thumb_file.name}...")
            try:
                youtube.thumbnails().set(
                    videoId=video_id,
                    media_body=MediaFileUpload(str(thumb_file), mimetype="image/png"),
                ).execute()
                print("✅ Đã cập nhật Thumbnail thành công!")
            except Exception as e:
                print(f"⚠️ Lỗi khi tải thumbnail (Có thể kênh cần xác minh số điện thoại để bật tính năng Custom Thumbnail): {e}")

    return {
        "id": video_id,
        "url": video_url,
        "title": title,
        "is_short": is_short,
    }


def main():
    parser = argparse.ArgumentParser(description="YouTube & YouTube Shorts Auto-Publisher cho Gikky.net")
    parser.add_argument("--auth", action="store_true", help="Chạy quy trình cấp quyền OAuth lần đầu tiên")
    parser.add_argument("--video", type=str, help="Đường dẫn file video MP4")
    parser.add_argument("--title", type=str, default="Video phân tích Gikky.net", help="Tiêu đề video")
    parser.add_argument("--description", type=str, default="", help="Mô tả video chuẩn SEO")
    parser.add_argument("--tags", type=str, default="gikky, chung khoan", help="Danh sách tags phân cách bằng dấu phẩy")
    parser.add_argument("--thumbnail", type=str, help="Đường dẫn ảnh Thumbnail (1280x720)")
    parser.add_argument("--privacy", type=str, default="public", choices=["public", "unlisted", "private"], help="Chế độ hiển thị")
    parser.add_argument("--is-short", action="store_true", help="Đánh dấu là video ngắn YouTube Shorts")

    args = parser.parse_args()

    if args.auth:
        print("🔐 Đang tiến hành xác thực YouTube API...")
        lay_dich_Vu_youtube = lay_dich_vu_youtube()
        print("🎉 Cấu hình OAuth 2.0 thành công! Bạn có thể bắt đầu upload tự động.")
        return

    if not args.video:
        parser.print_help()
        print("\n💡 Ví dụ: python scripts/youtube/youtube_publisher.py --video 'apps/web/public/gikky_short_tam_giac_doi_xung_9x16.mp4' --title 'Bắt đúng điểm nổ #Shorts' --is-short")
        return

    upload_video(
        video_path=args.video,
        title=args.title,
        description=args.description,
        tags=args.tags,
        privacy_status=args.privacy,
        thumbnail_path=args.thumbnail,
        is_short=args.is_short,
    )


if __name__ == "__main__":
    main()
