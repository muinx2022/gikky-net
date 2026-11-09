# -*- coding: utf-8 -*-
"""CLI điều phối toàn bộ chu trình hoạt động của Bot Trader trên Gikky.net.
Hỗ trợ cả thị trường Cổ phiếu Việt Nam (D1) và thị trường Quốc tế (H4)
với Hệ thống Đa Phương Pháp Kỹ Thuật (Multi-Strategy Engine).
"""

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from scanner import quet_toan_bo_3_san, quet_toan_bo_quoc_te_h4, quet_tat_ca
from soan_va_dang import (
    dang_luan_diem,
    dang_luan_diem_h4,
    dang_luan_diem_theo_lich,
    doc_vi_the_dang_mo,
    doc_danh_sach_ngay_nghi,
    la_thoi_gian_giao_dich,
    quet_ngay_nghi_va_danh_dau
)
from eod_checker import kiem_tra_sau_15h, kiem_tra_vi_the_h4


def main():
    parser = argparse.ArgumentParser(description="Bot Trader CLI - Gikky.net (Đa Thị Trường & Đa Phương Pháp)")
    parser.add_argument("--scan", action="store_true", help="Quét toàn diện cả Cổ phiếu VN (D1) và Quốc tế (H4)")
    parser.add_argument("--scan-vn", action="store_true", help="Chỉ quét duyệt qua 3 sàn Cổ phiếu VN (HOSE, HNX, UPCoM)")
    parser.add_argument("--scan-h4", action="store_true", help="Chỉ quét 12 tài sản Quốc tế khung H4 (FX, Hàng hóa, Năng lượng)")
    
    parser.add_argument("--post", action="store_true", help="Mở và đăng luận điểm giao dịch Cổ phiếu VN mới")
    parser.add_argument("--post-h4", action="store_true", help="Mở và đăng luận điểm giao dịch Quốc tế H4 mới")
    parser.add_argument("--post-scheduled", action="store_true", help="Đăng bài trade theo lịch luân phiên (tối đa 1 trade/ngày toàn hệ thống; fallback nếu không có trade)")
    parser.add_argument("--force", action="store_true", help="Bỏ qua kiểm tra trần 1 trade/ngày và giãn cách 18h (chỉ dùng khi test hoặc can thiệp khẩn cấp)")
    parser.add_argument("--symbol", type=str, default=None, help="Mã tài sản chỉ định (ví dụ HDB, GBP/USD, WTI...)")
    
    parser.add_argument("--check-eod", action="store_true", help="Kiểm tra EOD sau 15h cho cổ phiếu VN (cắt lỗ / chốt lời / nhồi lệnh)")
    parser.add_argument("--check-h4", action="store_true", help="Kiểm tra các vị thế H4 Quốc tế đang mở (cắt lỗ / chốt lời / nhồi lệnh)")
    parser.add_argument("--date", type=str, default=None, help="Ngày kiểm tra (định dạng YYYY-MM-DD)")
    
    parser.add_argument("--list", action="store_true", help="Liệt kê danh sách các vị thế đang theo dõi")
    parser.add_argument("--comments", action="store_true", help="Quét bình luận của độc giả trên các trade của Bot Trader")
    parser.add_argument("--reply-comment", type=int, help="ID bình luận cần trả lời dưới danh nghĩa u/bot-trader")
    parser.add_argument("--comment-trade", type=int, help="ID mạch trade cần bình luận cập nhật")
    parser.add_argument("-m", "--message", type=str, help="Nội dung bình luận / phản hồi")

    args = parser.parse_args()

    if args.scan:
        quet_tat_ca()
        vn_open, _ = la_thoi_gian_giao_dich("VN")
        h4_open, _ = la_thoi_gian_giao_dich("H4")
        if not vn_open or not h4_open:
            print("\n🔄 Đang trong thời gian nghỉ thị trường, tự động cập nhật danh sách theo dõi ngày nghỉ...")
            quet_ngay_nghi_va_danh_dau()

    elif args.scan_vn:
        quet_toan_bo_3_san(end_date=args.date)
        vn_open, _ = la_thoi_gian_giao_dich("VN")
        if not vn_open:
            print("\n🔄 Thị trường VN đang nghỉ, tự động cập nhật danh sách theo dõi ngày nghỉ...")
            quet_ngay_nghi_va_danh_dau()

    elif args.scan_h4:
        quet_toan_bo_quoc_te_h4()
        h4_open, _ = la_thoi_gian_giao_dich("H4")
        if not h4_open:
            print("\n🔄 Thị trường H4 đang nghỉ, tự động cập nhật danh sách theo dõi ngày nghỉ...")
            quet_ngay_nghi_va_danh_dau()

    elif args.post_scheduled:
        res = dang_luan_diem_theo_lich()
        if res:
            print("\nTRADED_SUCCESS")
            sys.exit(0)
        else:
            print("\nNO_TRADE_FALLBACK")
            sys.exit(0)

    elif args.post:
        dang_luan_diem(symbol_target=args.symbol, market_mode="VN", bypass_daily_limit=args.force)

    elif args.post_h4:
        dang_luan_diem_h4(symbol_target=args.symbol, bypass_daily_limit=args.force)

    elif args.check_eod:
        kiem_tra_sau_15h(simulate_date=args.date)

    elif args.check_h4:
        kiem_tra_vi_the_h4()

    elif args.comments:
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
        print("=" * 72)
        print(f"📊 DANH SÁCH VỊ THẾ BOT TRADER ({len(positions)} vị thế):")
        print("=" * 72)
        for p in positions:
            status_icon = "🟢" if p.get("status") == "OPEN" else ("🔴" if "SL" in p.get("status", "") else "🎯")
            tf = p.get("timeframe", "D1")
            dir_str = p.get("direction", "LONG")
            strat = p.get("strategy_name", p.get("strategy_id", "Kỹ thuật"))
            dec = p.get("decimals", 2)

            print(f"{status_icon} [{p.get('status')}] {p['symbol']} ({p.get('exchange')}) — [{dir_str}] Khung {tf} | {strat} | Mạch #{p['mach_id']}")
            mult_str = f" (Vol x{p['shares_multiplier']})" if p.get("shares_multiplier") and p["shares_multiplier"] != 1.0 else ""
            pyr_str = f" | Nhồi: {p.get('pyramid_trigger'):.{dec}f}" if p.get("pyramid_trigger") else ""
            print(f"   Entry: {p['entry_price']:.{dec}f}{mult_str} | SL: {p['stop_loss']:.{dec}f} | TP: {p['take_profit']:.{dec}f}{pyr_str}")
            curr_price = p.get("current_price", p["entry_price"])
            print(f"   Giá hiện tại: {curr_price:.{dec}f} | PnL: {p.get('pnl_pct', 0.0):+.2f}% | Mở lúc: {p.get('opened_at')}")
            print(f"   Link: {p.get('url')}")
            print("-" * 72)

        # Hiển thị danh sách deal đánh dấu chờ mở cửa trong ngày nghỉ
        watchlist_ngay_nghi = doc_danh_sach_ngay_nghi()
        pending_deals = [d for d in watchlist_ngay_nghi if d.get("status") == "PENDING_OPEN"]
        if pending_deals:
            print("\n" + "=" * 72)
            print(f"📋 DANH SÁCH DEAL ĐÁNH DẤU CHỜ MỞ CỬA / KIỂM TRA GAP ({len(pending_deals)} deal PENDING_OPEN):")
            print("=" * 72)
            for d in pending_deals:
                dec = d.get("decimals", 2)
                pyr_str = f" | Nhồi: {d['planned_pyramid']:.{dec}f}" if d.get("planned_pyramid") else ""
                print(f"⏳ [{d['market_mode']}] {d['symbol']} ({d.get('exchange')}) — [{d.get('direction', 'LONG')}] Khung {d.get('timeframe', 'D1')} | Score: {d.get('score')} pts")
                print(f"   Chiến lược: {d.get('strategy_name', d.get('strategy_id'))} -> {d.get('setup_name', '')}")
                print(f"   Tham chiếu: {d['ref_close']:.{dec}f} | Entry dự kiến: {d['planned_entry']:.{dec}f} | SL: {d['planned_sl']:.{dec}f} | TP: {d['planned_tp']:.{dec}f}{pyr_str}")
                print(f"   Đánh dấu lúc: {d.get('marked_at')} | Trạng thái: {d.get('status')} ({d.get('note', '')})")
                print("-" * 72)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
