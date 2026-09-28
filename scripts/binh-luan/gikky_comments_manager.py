#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""CLI Quản lý & Phản hồi bình luận trên website Gikky.net từ máy Dev / Automation.

Tự động kết nối tới VPS, gọi Django ORM trong container gikkynet-api-1 để:
1. Quét bình luận của độc giả trên các bài viết của Gikky chưa được phản hồi.
2. Phản hồi trực tiếp vào từng bình luận dưới danh nghĩa u/gikky-team-member.

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
import subprocess
import sys
import tempfile
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")


DIR_GOC = Path(__file__).resolve().parent
REPO_ROOT = DIR_GOC.parent.parent
HANDLER_FILE = DIR_GOC / "db_comments_handler.py"
VPS_HOST = os.environ.get("GIKKY_VPS_HOST", "vps-muinx")
CONTAINER_NAME = "gikkynet-api-1"


def dong_bo_handler_len_vps():
    """Đảm bảo handler mới nhất được copy vào container trên VPS."""
    scp_cmd = ["scp", str(HANDLER_FILE), f"{VPS_HOST}:/tmp/db_comments_handler.py"]
    cp_res = subprocess.run(scp_cmd, capture_output=True, text=True)
    if cp_res.returncode != 0:
        raise RuntimeError(f"Lỗi khi copy handler lên VPS: {cp_res.stderr}")

    docker_cp = ["ssh", VPS_HOST, f"docker cp /tmp/db_comments_handler.py {CONTAINER_NAME}:/app/db_comments_handler.py"]
    dock_res = subprocess.run(docker_cp, capture_output=True, text=True)
    if dock_res.returncode != 0:
        raise RuntimeError(f"Lỗi khi docker cp vào container: {dock_res.stderr}")


def quet_binh_luan():
    """Quét các bình luận của độc giả trên bài viết của Gikky chưa được trả lời."""
    dong_bo_handler_len_vps()
    cmd = [
        "ssh",
        VPS_HOST,
        f"docker exec -w /app {CONTAINER_NAME} python db_comments_handler.py --scan",
    ]
    res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
    if res.returncode != 0:
        raise RuntimeError(f"Lỗi khi quét bình luận: {res.stderr}")

    try:
        return json.loads(res.stdout)
    except json.JSONDecodeError:
        print("Output thô từ server:\n", res.stdout)
        raise


def phan_hoi_binh_luan(comment_id: int, noi_dung: str):
    """Gửi nội dung phản hồi cho bình luận cụ thể qua VPS container."""
    dong_bo_handler_len_vps()
    
    # Ghi nội dung phản hồi vào file tạm cục bộ với UTF-8 chuẩn
    with tempfile.NamedTemporaryFile("w", encoding="utf-8", delete=False, suffix=".txt") as tf:
        tf.write(noi_dung.strip())
        temp_path = tf.name

    try:
        remote_tmp = f"/tmp/reply_{comment_id}.txt"
        scp_cmd = ["scp", temp_path, f"{VPS_HOST}:{remote_tmp}"]
        res_scp = subprocess.run(scp_cmd, capture_output=True, text=True)
        if res_scp.returncode != 0:
            raise RuntimeError(f"Lỗi SCP file nội dung: {res_scp.stderr}")

        # Docker cp vào container
        docker_cp = ["ssh", VPS_HOST, f"docker cp {remote_tmp} {CONTAINER_NAME}:/tmp/reply.txt"]
        subprocess.run(docker_cp, capture_output=True, check=True)

        # Chạy lệnh reply
        cmd = [
            "ssh",
            VPS_HOST,
            f"docker exec -w /app {CONTAINER_NAME} python db_comments_handler.py --reply {comment_id} --body-file /tmp/reply.txt",
        ]
        res = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8")
        
        # Dọn dẹp file tạm trên VPS và container
        cleanup_cmd = ["ssh", VPS_HOST, f"rm -f {remote_tmp} && docker exec {CONTAINER_NAME} rm -f /tmp/reply.txt"]
        subprocess.run(cleanup_cmd, capture_output=True)

        if res.returncode != 0:
            raise RuntimeError(f"Lỗi khi thực hiện reply: {res.stderr}\n{res.stdout}")

        return json.loads(res.stdout)
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)


def in_danh_sach(danh_sach):
    if not danh_sach:
        print("\n[OK] Khong co binh luan nao cua doc gia dang cho phan hoi tren Gikky.net.")
        return

    print(f"\n[PHAT HIEN {len(danh_sach)} BINH LUAN DANG CHO PHAN HOI]:\n" + "=" * 70)
    for idx, c in enumerate(danh_sach, 1):
        print(f"#{idx} | Comment ID: {c['comment_id']} | Mạch: [{c['mach_id']}] {c['mach_title']}")
        print(f"    URL: {c['mach_url']}")
        print(f"    Tác giả: u/{c['author']} ({c['author_display']}) | Thời gian: {c['created_at']}")
        print(f"    Nội dung:")
        for line in c['body'].splitlines():
            print(f"      > {line}")
        print("-" * 70)


def main():
    parser = argparse.ArgumentParser(description="Quản lý & phản hồi bình luận website Gikky.net")
    parser.add_argument("--scan", action="store_true", help="Quét bình luận chưa trả lời")
    parser.add_argument("--json", action="store_true", help="In kết quả dưới dạng JSON")
    parser.add_argument("--reply", type=int, help="ID của bình luận cần trả lời")
    parser.add_argument("-m", "--message", type=str, help="Nội dung phản hồi trực tiếp")
    parser.add_argument("--file", type=str, help="Đường dẫn file chứa nội dung phản hồi")

    args = parser.parse_args()

    if args.scan:
        ds = quet_binh_luan()
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

        print(f"[*] Đang gửi phản hồi cho bình luận #{args.reply}...")
        res = phan_hoi_binh_luan(args.reply, noi_dung)
        print("\n[KẾT QUẢ]:")
        print(json.dumps(res, ensure_ascii=False, indent=2))
        return

    parser.print_help()


if __name__ == "__main__":
    main()
