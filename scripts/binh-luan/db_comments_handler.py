#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Handler xử lý bình luận trên website Gikky.net trực tiếp qua Django ORM.

Chạy bên trong container api:
    docker exec -w /app gikkynet-api-1 python db_comments_handler.py --scan
    docker exec -w /app gikkynet-api-1 python db_comments_handler.py --reply <comment_id> --body-file <file>
"""

import argparse
import datetime
import json
import os
import sys

# Thiết lập Django environment
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.contrib.auth import get_user_model
from django.utils.text import slugify
from core.models import Comment, Mach
from core.ghi import tao_binh_luan, DINH_DANG_MARKDOWN

User = get_user_model()
GIKKY_USERNAMES = ["gikky-team-member", "gikky-team-news"]


def lay_user_gikky():
    try:
        return User.objects.get(username="gikky-team-member")
    except User.DoesNotExist:
        # Fallback tìm user chứa gikky
        u = User.objects.filter(username__icontains="gikky").first()
        if not u:
            raise RuntimeError("Không tìm thấy user gikky-team-member trong database!")
        return u


def quet_binh_luan_cho_tra_loi():
    """Quét các bình luận của độc giả trên bài viết của Gikky chưa được Gikky phản hồi."""
    gikky_member = lay_user_gikky()
    
    # Lấy các comment trên bài viết do Gikky đăng
    comments = Comment.objects.filter(
        mach__author__username__in=GIKKY_USERNAMES,
        deleted_at__isnull=True,
        hidden_at__isnull=True,
    ).exclude(author__username__in=GIKKY_USERNAMES).select_related("mach", "author", "mach__sub").order_by("created_at")

    ket_qua = []
    for c in comments:
        # Kiểm tra xem comment này đã được gikky-team-member reply chưa
        da_reply = Comment.objects.filter(
            parent=c,
            author=gikky_member,
            deleted_at__isnull=True,
            hidden_at__isnull=True,
        ).exists()

        if not da_reply:
            slug = slugify(c.mach.title, allow_unicode=True) or "bai-viet"
            mach_url = f"https://gikky.net/m/{slug}-{c.mach.id}"
            ket_qua.append({
                "comment_id": c.id,
                "mach_id": c.mach.id,
                "mach_title": c.mach.title,
                "sub": c.mach.sub.slug if c.mach.sub else "",
                "author": c.author.username,
                "author_display": getattr(c.author, "display_name", c.author.username) or c.author.username,
                "created_at": c.created_at.isoformat(),
                "body": c.body,
                "mach_url": mach_url,
                "parent_id": c.parent_id,
            })
    return ket_qua


def phan_hoi_binh_luan(comment_id: int, noi_dung: str, dinh_dang: str = DINH_DANG_MARKDOWN):
    """Tạo bình luận phản hồi cho độc giả dưới danh nghĩa gikky-team-member."""
    gikky_member = lay_user_gikky()
    try:
        parent_comment = Comment.objects.select_related("mach").get(
            id=comment_id,
            deleted_at__isnull=True,
            hidden_at__isnull=True,
        )
    except Comment.DoesNotExist:
        raise ValueError(f"Bình luận #{comment_id} không tồn tại hoặc đã bị xóa/ẩn.")

    # Đảm bảo bài viết thuộc Gikky
    if parent_comment.mach.author.username not in GIKKY_USERNAMES:
        raise ValueError(f"Bài viết #{parent_comment.mach.id} không phải do Gikky đăng.")

    # Kiểm tra xem đã reply chưa để tránh duplicate
    da_reply = Comment.objects.filter(
        parent=parent_comment,
        author=gikky_member,
        deleted_at__isnull=True,
        hidden_at__isnull=True,
    ).first()

    if da_reply:
        return {
            "status": "already_replied",
            "reply_id": da_reply.id,
            "message": f"Bình luận #{comment_id} đã được trả lời trước đó bằng reply #{da_reply.id}.",
        }

    # Tạo bình luận phản hồi qua hàm chuẩn domain của core.ghi
    reply = tao_binh_luan(
        mach=parent_comment.mach,
        author=gikky_member,
        body=noi_dung.strip(),
        parent=parent_comment,
        dinh_dang=dinh_dang,
    )

    slug = slugify(parent_comment.mach.title, allow_unicode=True) or "bai-viet"
    mach_url = f"https://gikky.net/m/{slug}-{parent_comment.mach.id}"

    return {
        "status": "success",
        "reply_id": reply.id,
        "mach_id": parent_comment.mach.id,
        "mach_title": parent_comment.mach.title,
        "mach_url": mach_url,
        "created_at": reply.created_at.isoformat(),
        "parent_id": parent_comment.id,
        "parent_author": parent_comment.author.username,
    }


def main():
    parser = argparse.ArgumentParser(description="Quản lý và phản hồi bình luận Gikky qua Django ORM")
    parser.add_argument("--scan", action="store_true", help="Quét và xuất JSON các bình luận chưa phản hồi")
    parser.add_argument("--reply", type=int, help="ID của bình luận cần trả lời")
    parser.add_argument("--body-file", type=str, help="Đường dẫn file UTF-8 chứa nội dung phản hồi")
    parser.add_argument("--body", type=str, help="Chuỗi nội dung phản hồi (trực tiếp)")
    parser.add_argument("--dinh-dang", default="markdown", choices=["markdown", "html"], help="Định dạng nội dung")

    args = parser.parse_args()

    if args.scan:
        danh_sach = quet_binh_luan_cho_tra_loi()
        print(json.dumps(danh_sach, ensure_ascii=False, indent=2))
        return

    if args.reply:
        noi_dung = ""
        if args.body_file and os.path.exists(args.body_file):
            with open(args.body_file, "r", encoding="utf-8") as f:
                noi_dung = f.read()
        elif args.body:
            noi_dung = args.body
        else:
            # Đọc từ stdin
            noi_dung = sys.stdin.read()

        if not noi_dung.strip():
            print(json.dumps({"status": "error", "message": "Nội dung phản hồi không được để trống."}, ensure_ascii=False))
            sys.exit(1)

        try:
            res = phan_hoi_binh_luan(args.reply, noi_dung, dinh_dang=args.dinh_dang)
            print(json.dumps(res, ensure_ascii=False, indent=2))
        except Exception as e:
            print(json.dumps({"status": "error", "message": str(e)}, ensure_ascii=False))
            sys.exit(1)
        return

    parser.print_help()


if __name__ == "__main__":
    main()
