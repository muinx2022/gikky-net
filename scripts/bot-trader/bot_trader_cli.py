# -*- coding: utf-8 -*-
"""CLI điều phối toàn bộ chu trình hoạt động của Bot Trader trên Gikky.net."""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from scanner import quet_toan_bo_3_san
from soan_va_dang import dang_luan_diem, doc_vi_the_dang_mo
from eod_checker import kiem_tra_sau_15h


def main():
    parser = argparse.ArgumentParser(description="Bot Trader CLI - Gikky.net")
    parser.add_argument("--scan", action="store_true", help="Quét duyệt qua 3 sàn (HOSE, HNX, UPCoM)")
    parser.add_argument("--post", action="store_true", help="Mở và đăng luận điểm giao dịch mới (Khung giờ 9:16 - 14:44)")
    parser.add_argument("--symbol", type=str, default=None, help="Mã cổ phiếu chỉ định (ví dụ HDB)")
    parser.add_argument("--check-eod", action="store_true", help="Kiểm tra dữ liệu EOD sau 15h (cắt lỗ / chốt lời / nhồi lệnh)")
    parser.add_argument("--date", type=str, default=None, help="Ngày kiểm tra (định dạng YYYY-MM-DD)")
    parser.add_argument("--list", action="store_true", help="Liệt kê danh sách các vị thế đang theo dõi")
    parser.add_argument("--comments", action="store_true", help="Quét bình luận của độc giả trên các trade của Bot Trader")
    parser.add_argument("--reply-comment", type=int, help="ID bình luận cần trả lời dưới danh nghĩa u/bot-trader")
    parser.add_argument("--comment-trade", type=int, help="ID mạch trade cần bình luận cập nhật")
    parser.add_argument("-m", "--message", type=str, help="Nội dung bình luận / phản hồi")

    args = parser.parse_args()

    if args.scan:
        quet_toan_bo_3_san(end_date=args.date)

    elif args.post:
        dang_luan_diem(symbol_target=args.symbol)

    elif args.check_eod:
        kiem_tra_sau_15h(simulate_date=args.date)

    elif args.comments:
        # Import dynamic từ scripts/binh-luan
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "binh-luan"))
        from gikky_comments_manager import quet_binh_luan, in_danh_sach
        ds = quet_binh_luan(role="bot-trader")
        in_danh_sach(ds)

    elif args.reply_comment:
        if not args.message:
            print("[LỖI] Cần cung cấp -m \"nội dung ngắn gọn\" để phản hồi.")
            sys.exit(1)
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "binh-luan"))
        from gikky_comments_manager import phan_hoi_binh_luan
        res = phan_hoi_binh_luan(args.reply_comment, args.message, as_user="bot-trader")
        print(json.dumps(res, ensure_ascii=False, indent=2))

    elif args.comment_trade:
        if not args.message:
            print("[LỖI] Cần cung cấp -m \"nội dung ngắn gọn\".")
            sys.exit(1)
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "binh-luan"))
        from gikky_comments_manager import binh_luan_vao_mach
        res = binh_luan_vao_mach(args.comment_trade, args.message, as_user="bot-trader")
        print(json.dumps(res, ensure_ascii=False, indent=2))

    elif args.list:
        positions = doc_vi_the_dang_mo()
        print("=" * 70)
        print(f"📊 DANH SÁCH VỊ THẾ BOT TRADER ({len(positions)} vị thế):")
        print("=" * 70)
        for p in positions:
            status_icon = "🟢" if p["status"] == "OPEN" else ("🔴" if "SL" in p["status"] else "🎯")
            print(f"{status_icon} [{p['status']}] {p['symbol']} ({p['exchange']}) - Mạch #{p['mach_id']}")
            mult_str = f" (Vol x{p['shares_multiplier']})" if p.get("shares_multiplier") and p["shares_multiplier"] != 1.0 else ""
            print(f"   Entry: {p['entry_price']}{mult_str} | SL: {p['stop_loss']} | TP: {p['take_profit']} | Nhồi: {p.get('pyramid_trigger')}")
            eq_str = f" (Quy đổi {p['equivalent_price']})" if p.get("equivalent_price") else ""
            print(f"   Giá hiện tại: {p.get('current_price', p['entry_price'])}{eq_str} | PnL: {p.get('pnl_pct', 0.0):+.2f}%")
            print(f"   Link: {p['url']}")
            print("-" * 70)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
