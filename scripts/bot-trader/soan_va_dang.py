# -*- coding: utf-8 -*-
"""Soạn thảo và xuất bản Luận điểm giao dịch của Bot Trader lên Gikky.net.
Hỗ trợ cả Cổ phiếu Việt Nam (D1, Long) và Quốc tế (H4, Long/Short)
với Hệ thống Đa Phương Pháp Kỹ Thuật (Multi-Strategy Engine):
- Ichimoku Kinko Hyo
- Giao cắt MA 30 / MA 50
- Kéo ngược dải MA 30 - MA 50 (Pullback)
- Co thắt dải Bollinger Bands (BB Squeeze)
- Price Action & MA 200
"""

import base64
import json
import os
import sys
from datetime import datetime
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from chart_drawer import ve_bieu_do_bot_trader
from dang_bai_bot_trader import thuc_hien_action

DATA_DIR = Path(__file__).resolve().parent / "data"
DANH_SACH_CHO_FILE = DATA_DIR / "danh_sach_cho.json"
DANH_SACH_CHO_H4_FILE = DATA_DIR / "danh_sach_cho_h4.json"
DANH_SACH_NGAY_NGHI_FILE = DATA_DIR / "danh_sach_theo_doi_ngay_nghi.json"
VI_THE_FILE = DATA_DIR / "vi_the_dang_mo.json"


def doc_vi_the_dang_mo() -> list:
    if VI_THE_FILE.exists():
        try:
            with open(VI_THE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def luu_vi_the_dang_mo(vi_the_list: list):
    with open(VI_THE_FILE, "w", encoding="utf-8") as f:
        json.dump(vi_the_list, f, ensure_ascii=False, indent=2)


def doc_danh_sach_ngay_nghi() -> list:
    """Đọc danh sách các deal được đánh dấu theo dõi trong ngày nghỉ."""
    if DANH_SACH_NGAY_NGHI_FILE.exists():
        try:
            with open(DANH_SACH_NGAY_NGHI_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def luu_danh_sach_ngay_nghi(ds: list):
    """Lưu danh sách các deal theo dõi ngày nghỉ."""
    with open(DANH_SACH_NGAY_NGHI_FILE, "w", encoding="utf-8") as f:
        json.dump(ds, f, ensure_ascii=False, indent=2)


def la_thoi_gian_giao_dich(market_mode: str, now: datetime = None) -> tuple[bool, str]:
    """Kiểm tra thời gian giao dịch của thị trường (VN hoặc H4).
    
    Quy tắc:
    - VN:
      * Nghỉ cuối tuần: Thứ Bảy (5), Chủ Nhật (6)
      * Nghỉ lễ: (1, 1), (4, 30), (5, 1), (9, 2)
      * Chưa kết thúc phiên ATO: Thứ 2 - Thứ 6 trước 09:15
    - H4 (Quốc tế: FX, Hàng hóa, Năng lượng):
      * Đóng cửa cuối tuần: Từ 05:00 sáng Thứ Bảy (weekday == 5 and hour >= 5),
        toàn bộ Chủ Nhật (weekday == 6), đến trước 05:00 sáng Thứ Hai (weekday == 0 and hour < 5).
    """
    if now is None:
        now = datetime.now()

    mode = market_mode.upper()
    if mode == "VN":
        if now.weekday() in (5, 6):
            return False, "Thị trường Chứng khoán Việt Nam nghỉ cuối tuần (Thứ Bảy / Chủ Nhật)"

        if (now.month, now.day) in [(1, 1), (4, 30), (5, 1), (9, 2)]:
            return False, "Thị trường Chứng khoán Việt Nam nghỉ lễ"

        if now.hour < 9 or (now.hour == 9 and now.minute < 15):
            return False, "Thị trường Chứng khoán Việt Nam chưa kết thúc phiên mở cửa ATO (trước 09:15)"

        return True, "OK"

    elif mode == "H4":
        weekday = now.weekday()
        if (weekday == 5 and now.hour >= 5) or (weekday == 6) or (weekday == 0 and now.hour < 5):
            return False, "Thị trường Quốc tế (FX / Hàng hóa / Năng lượng) đang nghỉ cuối tuần"

        return True, "OK"

    return True, "OK"


def quet_ngay_nghi_va_danh_dau() -> list:
    """Quét toàn bộ thị trường trong ngày nghỉ và đánh dấu các deal tiềm năng
    vào danh_sach_theo_doi_ngay_nghi.json chờ kiểm tra Gap tại phiên mở cửa tiếp theo.
    """
    from scanner import quet_toan_bo_3_san, quet_toan_bo_quoc_te_h4

    print("\n" + "=" * 72)
    print("📋 TIẾN HÀNH QUÉT NGÀY NGHỈ & ĐÁNH DẤU WATCHLIST CHỜ PHIÊN MỞ CỬA")
    print("=" * 72)

    # 1. Đọc vị thế đang mở và các mã vừa đóng để loại trừ
    vi_the_list = doc_vi_the_dang_mo()
    now_dt = datetime.now()
    now_date = now_dt.date()

    open_symbols = {p["symbol"] for p in vi_the_list if p.get("status") == "OPEN"}
    recent_closed_symbols = set()
    for p in vi_the_list:
        if p.get("status") in ["CLOSED_TP", "CLOSED_SL"]:
            c_date_str = p.get("closed_at", p.get("opened_at", ""))[:10]
            try:
                c_date = datetime.strptime(c_date_str, "%Y-%m-%d").date()
                cool_days = 5 if (p.get("timeframe") == "H4" or p.get("market_type") in ("FX", "COMMODITY", "ENERGY")) else 10
                if (now_date - c_date).days < cool_days:
                    recent_closed_symbols.add(p["symbol"])
            except Exception:
                pass

    # 2. Lấy ứng viên Cổ phiếu VN
    vn_candidates = []
    need_scan_vn = True
    if DANH_SACH_CHO_FILE.exists():
        mtime = DANH_SACH_CHO_FILE.stat().st_mtime
        if (now_dt.timestamp() - mtime) < 1800:  # quét trong vòng 30 phút
            try:
                with open(DANH_SACH_CHO_FILE, "r", encoding="utf-8") as f:
                    vn_candidates = json.load(f)
                need_scan_vn = False
                print(f"📦 Sử dụng kết quả quét VN vừa thực hiện ({len(vn_candidates)} ứng viên).")
            except Exception:
                need_scan_vn = True
    if need_scan_vn:
        vn_candidates = quet_toan_bo_3_san()

    # 3. Lấy ứng viên Quốc tế H4
    h4_candidates = []
    need_scan_h4 = True
    if DANH_SACH_CHO_H4_FILE.exists():
        mtime = DANH_SACH_CHO_H4_FILE.stat().st_mtime
        if (now_dt.timestamp() - mtime) < 1800:
            try:
                with open(DANH_SACH_CHO_H4_FILE, "r", encoding="utf-8") as f:
                    h4_candidates = json.load(f)
                need_scan_h4 = False
                print(f"📦 Sử dụng kết quả quét H4 vừa thực hiện ({len(h4_candidates)} ứng viên).")
            except Exception:
                need_scan_h4 = True
    if need_scan_h4:
        h4_candidates = quet_toan_bo_quoc_te_h4()

    # 4. Đọc danh sách theo dõi ngày nghỉ hiện có
    watchlist_ngay_nghi = doc_danh_sach_ngay_nghi()
    existing_map = {item["symbol"]: item for item in watchlist_ngay_nghi}

    marked_deals = []

    # Xử lý ứng viên VN
    for c in vn_candidates:
        sym = c["symbol"]
        if sym in open_symbols:
            continue
        if sym in recent_closed_symbols:
            continue

        deal_record = {
            "symbol": sym,
            "market_mode": "VN",
            "exchange": c.get("exchange", "HOSE"),
            "timeframe": "D1",
            "direction": "LONG",
            "strategy_id": c.get("strategy_id", "MA_CROSS"),
            "strategy_name": c.get("strategy_name", "Giao cắt Trung bình động (MA Cross)"),
            "setup_name": c.get("setup_name", ""),
            "score": c.get("score", 70),
            "ref_close": c.get("close", c.get("entry_price")),
            "planned_entry": c.get("entry_price"),
            "planned_sl": c.get("stop_loss"),
            "planned_tp": c.get("take_profit"),
            "planned_pyramid": c.get("pyramid_trigger"),
            "atr14": c.get("atr14", 0.0),
            "decimals": c.get("decimals", 2),
            "marked_at": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "PENDING_OPEN",
            "note": "Đánh dấu trong ngày nghỉ, chờ kiểm tra giá và Gap tại phiên mở cửa tiếp theo"
        }
        existing_map[sym] = deal_record
        marked_deals.append(deal_record)

    # Xử lý ứng viên H4
    for c in h4_candidates:
        sym = c["symbol"]
        if sym in open_symbols:
            continue
        if sym in recent_closed_symbols:
            continue

        deal_record = {
            "symbol": sym,
            "market_mode": "H4",
            "exchange": c.get("exchange", "Forex"),
            "timeframe": "H4",
            "direction": c.get("direction", "LONG"),
            "strategy_id": c.get("strategy_id", "ICHIMOKU"),
            "strategy_name": c.get("strategy_name", "Hệ thống Ichimoku Kinko Hyo"),
            "setup_name": c.get("setup_name", ""),
            "score": c.get("score", 70),
            "ref_close": c.get("close", c.get("entry_price")),
            "planned_entry": c.get("entry_price"),
            "planned_sl": c.get("stop_loss"),
            "planned_tp": c.get("take_profit"),
            "planned_pyramid": c.get("pyramid_trigger"),
            "atr14": c.get("atr14", 0.0),
            "decimals": c.get("decimals", 4 if "USD" in sym else 2),
            "yf_ticker": c.get("yf_ticker"),
            "marked_at": now_dt.strftime("%Y-%m-%d %H:%M:%S"),
            "status": "PENDING_OPEN",
            "note": "Đánh dấu trong ngày nghỉ, chờ kiểm tra giá và Gap tại phiên mở cửa tiếp theo"
        }
        existing_map[sym] = deal_record
        marked_deals.append(deal_record)

    # Lưu lại toàn bộ
    updated_list = list(existing_map.values())
    luu_danh_sach_ngay_nghi(updated_list)

    # In bảng tổng hợp các deal PENDING_OPEN
    pending_list = [d for d in updated_list if d.get("status") == "PENDING_OPEN"]
    print(f"\n📊 BẢNG TỔNG HỢP DEAL CHỜ MỞ CỬA ({len(pending_list)} deal đang đánh dấu PENDING_OPEN):")
    print("-" * 72)
    for d in pending_list:
        dec = d.get("decimals", 2)
        pyr_str = f" | Nhồi: {d['planned_pyramid']:.{dec}f}" if d.get("planned_pyramid") else ""
        print(f"📌 [{d['market_mode']}] {d['symbol']:8} ({d['exchange']}) - [{d['direction']}] Khung {d['timeframe']} - Score: {d['score']}")
        print(f"   Chiến lược: {d['strategy_name']} ({d['strategy_id']})")
        print(f"   Tham chiếu: {d['ref_close']:.{dec}f} | Entry dự kiến: {d['planned_entry']:.{dec}f} | SL: {d['planned_sl']:.{dec}f} | TP: {d['planned_tp']:.{dec}f}{pyr_str}")
        print(f"   Thời gian đánh dấu: {d['marked_at']}")
        print("-" * 72)

    return marked_deals


def kiem_tra_deal_danh_dau_khi_mo_cua(market_mode: str, avoid_strategy_id: str = None) -> dict | None:
    """Kiểm tra các deal đã được đánh dấu PENDING_OPEN trong ngày nghỉ khi thị trường mở cửa.
    Kiểm tra Gap và cấu trúc kỹ thuật:
    - Loại trừ các mã đang OPEN hoặc đang trong thời gian cool-off
    - Nếu vi phạm cấu trúc kỹ thuật -> CANCELLED_INVALID
    - Nếu Gap vượt ngưỡng cho phép -> CANCELLED_GAP
    - Nếu đạt chuẩn -> EXECUTED, trả về dict ứng viên mới nhất để xuất bản lệnh.
    """
    from scanner import quet_ma_co_phieu, quet_tai_san_h4, WATCHLIST_QUOC_TE_H4, CACHE_DIR

    mode = market_mode.upper()
    watchlist = doc_danh_sach_ngay_nghi()
    pending = [d for d in watchlist if d.get("status") == "PENDING_OPEN" and d.get("market_mode", "").upper() == mode]
    if not pending:
        return None

    # Lấy danh sách vị thế đang mở và mã vừa đóng (cool-off) để loại trừ
    vi_the_list = doc_vi_the_dang_mo()
    now_date = datetime.now().date()
    open_symbols = {p["symbol"] for p in vi_the_list if p.get("status") == "OPEN"}
    recent_closed_symbols = set()
    for p in vi_the_list:
        if p.get("status") in ["CLOSED_TP", "CLOSED_SL"]:
            c_date_str = p.get("closed_at", p.get("opened_at", ""))[:10]
            try:
                c_date = datetime.strptime(c_date_str, "%Y-%m-%d").date()
                cool_days = 5 if (p.get("timeframe") == "H4" or p.get("market_type") in ("FX", "COMMODITY", "ENERGY")) else 10
                if (now_date - c_date).days < cool_days:
                    recent_closed_symbols.add(p["symbol"])
            except Exception:
                pass

    # Sắp xếp ưu tiên: tránh avoid_strategy_id, sau đó score cao nhất
    if avoid_strategy_id:
        pending.sort(key=lambda x: (x.get("strategy_id") != avoid_strategy_id, x.get("score", 0)), reverse=True)
    else:
        pending.sort(key=lambda x: x.get("score", 0), reverse=True)

    today_str = datetime.now().strftime("%Y-%m-%d")

    for deal in pending:
        sym = deal["symbol"]

        # Kiểm tra loại trừ nếu mã đang OPEN hoặc trong cool-off
        if sym in open_symbols:
            print(f"⏳ Bỏ qua deal {sym} vì mã này hiện đang có vị thế OPEN.")
            continue
        if sym in recent_closed_symbols:
            print(f"⏳ Bỏ qua deal {sym} vì vừa đóng lệnh trong thời gian gần đây (cool-off).")
            continue

        ref_close = deal.get("ref_close", deal.get("planned_entry"))

        print(f"\n🔍 [KIỂM TRA MỞ CỬA] Đang thẩm định deal chờ mở cửa: {sym} ({mode})...")

        if mode == "VN":
            # 1. Xóa cache ngày hôm nay của mã đó để ép lấy dữ liệu mới nhất tại phiên mở cửa
            cache_file = CACHE_DIR / f"{sym}_{today_str}.json"
            if cache_file.exists():
                try:
                    cache_file.unlink()
                except Exception:
                    pass

            exchange = deal.get("exchange", "HOSE")
            res_moi = quet_ma_co_phieu(sym, exchange)

            if res_moi is None:
                print(f"❌ Deal {sym} không đạt chuẩn khi mở cửa (mất tín hiệu hoặc gãy cấu trúc kỹ thuật) -> HỦY BỎ.")
                deal["status"] = "CANCELLED_INVALID"
                deal["note"] = "Hủy mở lệnh do mất tín hiệu kỹ thuật hoặc vi phạm thanh khoản khi mở cửa"
                deal["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                luu_danh_sach_ngay_nghi(watchlist)
                continue

            # Kiểm tra Gap
            gap_pct = ((res_moi["entry_price"] - ref_close) / ref_close) * 100
            print(f"   Giá tham chiếu: {ref_close} -> Giá mở cửa mới: {res_moi['entry_price']} (Gap: {gap_pct:+.2f}%)")

            if gap_pct > 2.0 or gap_pct < -2.0:
                print(f"⚠️ Deal {sym} nhảy Gap {gap_pct:+.2f}% vượt ngưỡng an toàn (±2.0%) -> HỦY BỎ.")
                deal["status"] = "CANCELLED_GAP"
                deal["note"] = f"Hủy mở lệnh do phiên mở cửa tạo Gap {gap_pct:+.2f}% vượt ngưỡng an toàn"
                deal["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                luu_danh_sach_ngay_nghi(watchlist)
                continue

            # Vượt qua kiểm định!
            print(f"✅ Deal {sym} đạt chuẩn kiểm định mở cửa! (Gap {gap_pct:+.2f}% trong ngưỡng an toàn).")
            deal["status"] = "EXECUTED"
            deal["executed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            deal["note"] = f"Vượt qua kiểm định mở cửa (Gap {gap_pct:+.2f}%), thực thi mở lệnh"
            luu_danh_sach_ngay_nghi(watchlist)
            return res_moi

        elif mode == "H4":
            # Xóa cache Yahoo H4 (tên file theo format {clean_sym}_h4.json)
            clean_sym = sym.replace("/", "_")
            cache_file = CACHE_DIR / f"{clean_sym}_h4.json"
            if cache_file.exists():
                try:
                    cache_file.unlink()
                except Exception:
                    pass

            target_item = None
            for item in WATCHLIST_QUOC_TE_H4:
                if item["symbol"] == sym:
                    target_item = item
                    break

            if not target_item:
                continue

            res_moi = quet_tai_san_h4(target_item)
            if res_moi is None or res_moi.get("direction") != deal.get("direction"):
                print(f"❌ Deal {sym} không đạt chuẩn khi mở cửa (mất tín hiệu hoặc đổi chiều xu hướng) -> HỦY BỎ.")
                deal["status"] = "CANCELLED_INVALID"
                deal["note"] = "Hủy mở lệnh do mất tín hiệu hoặc đổi chiều xu hướng khi mở cửa"
                deal["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                luu_danh_sach_ngay_nghi(watchlist)
                continue

            atr = deal.get("atr14") or res_moi.get("atr14", 0.005)
            price_diff = abs(res_moi["entry_price"] - ref_close)
            max_allowed_diff = 0.5 * atr
            print(f"   Giá tham chiếu: {ref_close} -> Giá mở cửa mới: {res_moi['entry_price']} (Lệch: {price_diff:.4f}, Ngưỡng 0.5 ATR: {max_allowed_diff:.4f})")

            if price_diff > max_allowed_diff:
                print(f"⚠️ Deal {sym} trượt giá {price_diff:.4f} vượt ngưỡng 0.5 ATR ({max_allowed_diff:.4f}) -> HỦY BỎ.")
                deal["status"] = "CANCELLED_GAP"
                deal["note"] = f"Hủy mở lệnh do giá mở cửa lệch {price_diff:.4f} > 0.5 ATR ({max_allowed_diff:.4f})"
                deal["updated_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                luu_danh_sach_ngay_nghi(watchlist)
                continue

            # Vượt qua kiểm định!
            print(f"✅ Deal {sym} đạt chuẩn kiểm định mở cửa! (Lệch giá {price_diff:.4f} nằm trong ngưỡng cho phép).")
            deal["status"] = "EXECUTED"
            deal["executed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            deal["note"] = f"Vượt qua kiểm định mở cửa (Lệch {price_diff:.4f} <= 0.5 ATR), thực thi mở lệnh"
            luu_danh_sach_ngay_nghi(watchlist)
            return res_moi

    return None


def kiem_tra_han_muc_toan_he_thong(vi_the_list: list) -> tuple[bool, str]:
    """Kiểm tra trần cứng tối đa 1 bài trade / ngày trên toàn bộ hệ thống (VN + H4),
    và kiểm tra khoảng cách tối thiểu 18 giờ giữa các lần mở lệnh.
    Trả về (True, "OK") nếu thỏa mãn điều kiện mở lệnh mới, hoặc (False, reason) nếu vi phạm.
    """
    now = datetime.now()
    today_str = now.strftime("%Y-%m-%d")

    # 1. Kiểm tra trần cứng 1 bài trade / ngày cho tất cả thị trường gộp chung
    trades_today = [
        p for p in vi_the_list
        if p.get("entry_date") == today_str or (p.get("opened_at") and p.get("opened_at")[:10] == today_str)
    ]
    if trades_today:
        last_t = trades_today[-1]
        msg = (
            f"⛔ [QUY TẮC 1 TRADE/NGÀY] Hôm nay ({today_str}) hệ thống đã xuất bản bài giao dịch "
            f"#{last_t.get('mach_id')} ({last_t.get('symbol')} lúc {last_t.get('opened_at')}). "
            f"Tuyệt đối không đăng quá 1 bài trade/ngày trên toàn hệ thống!"
        )
        return False, msg

    # 2. Kiểm tra giãn cách thời gian tối thiểu 18 giờ kể từ lệnh mở gần nhất
    opened_dates = []
    for p in vi_the_list:
        o_str = p.get("opened_at")
        if o_str:
            try:
                dt = datetime.strptime(o_str, "%Y-%m-%d %H:%M:%S")
                opened_dates.append((dt, p))
            except Exception:
                pass

    if opened_dates:
        opened_dates.sort(key=lambda x: x[0])
        latest_dt, latest_p = opened_dates[-1]
        hours_elapsed = (now - latest_dt).total_seconds() / 3600.0
        if hours_elapsed < 18.0:
            msg = (
                f"⏳ [QUY TẮC GIÃN CÁCH] Lệnh gần nhất (#{latest_p.get('mach_id')} {latest_p.get('symbol')}) "
                f"vừa mở cách đây {hours_elapsed:.1f} giờ (< 18 giờ). "
                f"Cần giãn cách tối thiểu 18h để các chuyên mục khác xuất hiện xen kẽ."
            )
            return False, msg

    return True, "OK"


def dang_luan_diem(
    symbol_target: str = None,
    market_mode: str = "VN",
    avoid_strategy_id: str = None,
    bypass_daily_limit: bool = False
) -> dict | None:
    """Mở luận điểm giao dịch mới cho Bot Trader (hỗ trợ cả Cổ phiếu VN và Quốc tế H4)."""
    # 0. Kiểm tra ngày nghỉ / thời gian giao dịch của thị trường
    if not bypass_daily_limit:
        dang_giao_dich, ly_do_tt = la_thoi_gian_giao_dich(market_mode)
        if not dang_giao_dich:
            print(f"\n⛔ [THỊ TRƯỜNG ĐÓNG CỬA] {ly_do_tt}.")
            print("🔍 Tự động quét và cập nhật danh sách theo dõi ngày nghỉ (chờ kiểm tra Gap tại phiên mở cửa tiếp theo)...")
            quet_ngay_nghi_va_danh_dau()
            return None

    vi_the_list = doc_vi_the_dang_mo()
    is_h4 = (market_mode.upper() == "H4")

    # Kiểm tra trần cứng 1 bài trade / ngày và giãn cách 18h (áp dụng toàn hệ thống)
    if not bypass_daily_limit:
        hop_le, ly_do = kiem_tra_han_muc_toan_he_thong(vi_the_list)
        if not hop_le:
            print(ly_do)
            return None

    # Tách hạn mức vị thế: Tối đa 3 Cổ phiếu VN và tối đa 3 Quốc tế H4
    open_positions = [
        p for p in vi_the_list
        if p.get("status") == "OPEN" and (
            (p.get("timeframe") == "H4" or p.get("market_type") in ("FX", "COMMODITY", "ENERGY")) if is_h4
            else (p.get("timeframe") != "H4" and p.get("market_type") not in ("FX", "COMMODITY", "ENERGY"))
        )
    ]

    max_limit = 3
    market_label = "Quốc tế (H4)" if is_h4 else "Cổ phiếu VN (D1)"

    if len(open_positions) >= max_limit and not symbol_target:
        print(f"⚠️ Đang có {len(open_positions)} vị thế {market_label} đang mở (tối đa {max_limit}). Tạm dừng mở mới.")
        return None

    candidate = None

    # Nếu không truyền symbol_target cố định, ưu tiên kiểm tra deal chờ mở cửa từ danh sách ngày nghỉ
    if not symbol_target:
        candidate = kiem_tra_deal_danh_dau_khi_mo_cua(market_mode=market_mode, avoid_strategy_id=avoid_strategy_id)
        if candidate:
            print(f"🎯 Chọn ứng viên {candidate['symbol']} từ danh sách theo dõi ngày nghỉ đã vượt qua kiểm định Gap!")

    # Nếu không có ứng viên từ danh sách ngày nghỉ, đọc từ candidate_file
    if not candidate:
        # Kiểm tra cool-off cho các lệnh vừa đóng
        now_date = datetime.now().date()
        recent_closed_symbols = set()
        for p in vi_the_list:
            if p.get("status") in ["CLOSED_TP", "CLOSED_SL"]:
                c_date_str = p.get("closed_at", p.get("opened_at", ""))[:10]
                try:
                    c_date = datetime.strptime(c_date_str, "%Y-%m-%d").date()
                    cool_days = 5 if is_h4 else 10
                    if (now_date - c_date).days < cool_days:
                        recent_closed_symbols.add(p["symbol"])
                except Exception:
                    pass

        # Đọc danh sách ứng viên phù hợp
        candidate_file = DANH_SACH_CHO_H4_FILE if is_h4 else DANH_SACH_CHO_FILE
        if not candidate_file.exists():
            print(f"❌ Chưa có dữ liệu quét tại {candidate_file}. Vui lòng chạy scanner trước.")
            return None

        with open(candidate_file, "r", encoding="utf-8") as f:
            candidates = json.load(f)
            if symbol_target:
                for c in candidates:
                    if c["symbol"].upper() == symbol_target.upper():
                        candidate = c
                        break
            elif candidates:
                open_symbols = [p["symbol"] for p in open_positions]
                valid_candidates = []
                for c in candidates:
                    if c["symbol"] in open_symbols:
                        continue
                    if c["symbol"] in recent_closed_symbols:
                        print(f"⏳ Bỏ qua ứng viên {c['symbol']} vì vừa đóng lệnh trong thời gian gần đây.")
                        continue
                    valid_candidates.append(c)

                if valid_candidates:
                    # Nếu có chỉ định avoid_strategy_id, ưu tiên chọn ứng viên có strategy_id khác
                    if avoid_strategy_id:
                        diff_strat = [c for c in valid_candidates if c.get("strategy_id") != avoid_strategy_id]
                        candidate = diff_strat[0] if diff_strat else valid_candidates[0]
                    else:
                        candidate = valid_candidates[0]

    if not candidate:
        print(f"❌ Không tìm thấy thông tin ứng viên phù hợp trong danh mục {market_label}!")
        return None

    sym = candidate["symbol"]
    exchange = candidate.get("exchange", "HOSE" if not is_h4 else "Forex")
    entry = candidate["entry_price"]
    sl = candidate["stop_loss"]
    tp = candidate["take_profit"]
    pyramid = candidate.get("pyramid_trigger")
    setup_name = candidate["setup_name"]
    strat_id = candidate.get("strategy_id", "PA_MA200")
    strat_name = candidate.get("strategy_name", "Price Action & MA 200")
    direction = candidate.get("direction", "LONG")
    timeframe = candidate.get("timeframe", "H4" if is_h4 else "D1")
    decimals = candidate.get("decimals", 4 if "USD" in sym else 2)
    risk_pct = candidate["risk_pct"]
    reward_pct = candidate["reward_pct"]
    rr = candidate.get("rr_ratio", 2.4)
    ly_do_list = candidate.get("ly_do", [])
    sub = candidate.get("sub", "chung-khoan" if not is_h4 else "ngoai-hoi")
    yf_ticker = candidate.get("yf_ticker")

    dir_action = "Mua" if direction == "LONG" else "Bán"
    dir_label = "Mua (Long)" if direction == "LONG" else "Bán khống (Short)"

    print(f"\n🚀 Chuẩn bị xuất bản Luận điểm {dir_action} {sym} ({exchange}) khung {timeframe}...")

    # 1. Vẽ biểu đồ kỹ thuật
    chart_path = ve_bieu_do_bot_trader(
        symbol=sym,
        exchange=exchange,
        entry_price=entry,
        stop_loss=sl,
        take_profit=tp,
        pyramid_trigger=pyramid,
        end_date=datetime.now().strftime("%Y-%m-%d"),
        setup_name=setup_name,
        strategy_id=strat_id,
        direction=direction,
        timeframe=timeframe,
        decimals=decimals,
        yf_ticker=yf_ticker
    )

    with open(chart_path, "rb") as f:
        chart_b64 = base64.b64encode(f.read()).decode("utf-8")

    # 2. Xây dựng tiêu đề & thông số
    entry_str = f"{entry:.{decimals}f}"
    sl_str = f"{sl:.{decimals}f}"
    tp_str = f"{tp:.{decimals}f}"
    pyr_str = f"{pyramid:.{decimals}f}" if pyramid else None

    if pyr_str:
        title = f"{dir_action} {sym} tại {entry_str}: Entry {entry_str}, SL {sl_str}, TP {tp_str}, Nhồi {pyr_str}"
    else:
        title = f"{dir_action} {sym} tại {entry_str}: Entry {entry_str}, SL {sl_str}, TP {tp_str}"

    loai = "Chiến lược"

    # Bảng figures: Tối đa 6 cặp theo đúng quy định SO_FIGURES_TOI_DA của Gikky
    figures = [
        {"label": "Mã tài sản", "value": f"{sym} ({exchange})"[:24]},
        {"label": "Vị thế", "value": f"{dir_label} {timeframe}"[:24]},
        {"label": "Giá Entry", "value": entry_str[:24]},
        {"label": "Stop Loss", "value": f"{sl_str} (-{risk_pct:.1f}%)"[:24]},
        {"label": "Take Profit", "value": f"{tp_str} (+{reward_pct:.1f}%)"[:24]},
        {"label": "Tỷ lệ R:R", "value": f"1 : {rr:.2f}"[:24]}
    ]

    # Câu hỏi tương tác ngắn gọn (tối đa 200 ký tự theo quy định Gikky API)
    question_for_crowd = (
        f"Với vị thế {dir_action} {sym} ({entry_str}) khung {timeframe}, "
        f"bạn đánh giá kịch bản nào dễ xảy ra hơn: Đạt Take Profit {tp_str} hay chạm Stop Loss {sl_str}?"
    )[:200]

    # 3. Soạn nội dung bài viết theo phương pháp kỹ thuật (0 từ cấm, không dùng thẻ h2/h3)
    ly_do_html = "".join([f"<li><strong>{ld}</strong></li>" for ld in ly_do_list])

    # Luận điểm bối cảnh chi tiết theo phương pháp
    if strat_id == "ICHIMOKU":
        tenkan_val = candidate.get("tenkan", entry)
        kijun_val = candidate.get("kijun", entry)
        if direction == "LONG":
            context_p = (
                f"Tài sản {sym} đang vận động trong cấu trúc tăng giá vững vàng của hệ thống Ichimoku Kinko Hyo. "
                f"Giá duy trì phía trên Mây Kumo, xác nhận phe mua đang kiểm soát toàn bộ xu hướng. "
                f"Đường chuyển đổi Tenkan-sen ({tenkan_val:.{decimals}f}) vận động song hành phía trên đường tiêu chuẩn Kijun-sen ({kijun_val:.{decimals}f}), "
                f"tạo thành bệ đỡ động nâng đỡ các nhịp rung lắc ngắn hạn."
            )
        else:
            context_p = (
                f"Tài sản {sym} đang nằm trong xu hướng giảm rõ nét theo hệ thống Ichimoku Kinko Hyo. "
                f"Giá đóng cửa trượt dài phía dưới Mây Kumo, xác nhận áp lực bán chiếm ưu thế tuyệt đối. "
                f"Đường Tenkan-sen ({tenkan_val:.{decimals}f}) duy trì dưới đường Kijun-sen ({kijun_val:.{decimals}f}), "
                f"liên tục từ chối các nỗ lực phục hồi kỹ thuật của phe mua."
            )
    elif strat_id in ("MA_CROSS", "MA30_50_PULLBACK"):
        ma30_val = candidate.get("ma30", entry)
        ma50_val = candidate.get("ma50", entry)
        ma200_val = candidate.get("ma200", entry)
        if direction == "LONG":
            context_p = (
                f"Cấu trúc xu hướng của {sym} được dẫn dắt bởi sự đồng thuận tăng của các đường trung bình động. "
                f"Đường MA 30 ({ma30_val:.{decimals}f}) và MA 50 ({ma50_val:.{decimals}f}) đang dốc lên song song, "
                f"duy trì khoảng cách an toàn phía trên đường xu hướng dài hạn MA 200 ({ma200_val:.{decimals}f}). "
                f"Nhịp kéo ngược về dải hỗ trợ MA 30 – MA 50 đã kích hoạt lực cầu gia tăng, mở ra điểm vào lệnh tiếp diễn xu hướng."
            )
        else:
            context_p = (
                f"Cấu trúc xu hướng của {sym} thể hiện sự suy yếu rõ rệt khi đường MA 30 ({ma30_val:.{decimals}f}) "
                f"vận động phía dưới MA 50 ({ma50_val:.{decimals}f}) và cả hai cùng dốc xuống dưới MA 200 ({ma200_val:.{decimals}f}). "
                f"Các nhịp phục hồi chạm vào dải cản MA 30 – MA 50 đều nhanh chóng xuất hiện áp lực bán áp đảo trở lại."
            )
    elif strat_id == "BB_SQUEEZE":
        if direction == "LONG":
            context_p = (
                f"Sau chuỗi phiên nén biên độ chặt chẽ trong dải Bollinger Bands (20, 2), tài sản {sym} đã chính thức bứt phá "
                f"vượt qua dải băng trên (BB Upper). Sự mở rộng của dải băng đi kèm thân nến xanh mạnh mẽ "
                f"xác nhận điểm khởi đầu của một pha biến động mở rộng theo chiều tăng."
            )
        else:
            context_p = (
                f"Dải Bollinger Bands (20, 2) của {sym} vừa trải qua giai đoạn co thắt biên độ trước khi xuất hiện nến đỏ đóng cửa "
                f"phá vỡ dải băng dưới (BB Lower). Đà mở dải băng hướng xuống cho thấy xung lực bán tháo bắt đầu gia tốc."
            )
    else:  # PA_MA200
        ma200_val = candidate.get("ma200", entry)
        if direction == "LONG":
            context_p = (
                f"Tài sản {sym} đang vận động trên nền tảng tích lũy trung hạn vững chắc quanh đường trung bình dài hạn MA 200 ({ma200_val:.{decimals}f}). "
                f"Việc giá duy trì ổn định trên MA 200 khẳng định lực cầu chủ động vẫn đang bảo vệ tốt xu hướng."
            )
        else:
            context_p = (
                f"Tài sản {sym} đang chịu áp lực điều chỉnh dưới đường trung bình động dài hạn MA 200 ({ma200_val:.{decimals}f}). "
                f"Ngưỡng MA 200 đóng vai trò trần cản kỹ thuật cản bước các nhịp phục hồi của giá."
            )

    pyr_section = (
        f"<li><strong>Kịch bản nhồi lệnh (Pyramiding):</strong> Khi giá di chuyển thuận lợi chạm mốc <strong>{pyr_str}</strong>, "
        f"hệ thống sẽ mở thêm 50% khối lượng còn lại và đồng thời dời điểm dừng lỗ Stop Loss về điểm hòa vốn ({entry_str}) "
        f"nhằm khóa chặt rủi ro tuyệt đối.</li>"
    ) if pyr_str else ""

    body = f"""<p>{{{{ANH_1}}}}</p>

<p>Hệ thống giao dịch thuật toán <strong>Bot Trader</strong> phát hiện cơ hội giao dịch mới trên thị trường theo trường phái <strong>{strat_name}</strong> đối với tài sản <strong>{sym}</strong> ({exchange}, khung <strong>{timeframe}</strong>). Dưới đây là phân tích bối cảnh kỹ thuật và kế hoạch phân bổ vị thế cụ thể.</p>

<hr>

<p><strong>1. Bối cảnh kỹ thuật &amp; Cấu trúc xu hướng</strong></p>

<p>{context_p}</p>

<hr>

<p><strong>2. Tín hiệu kỹ thuật kích hoạt điểm vào lệnh</strong></p>

<ul>
{ly_do_html}
</ul>

<p>Sự đồng thuận của cấu trúc giá và các chỉ báo kỹ thuật tại thời điểm hiện tại mang lại điểm vào lệnh với biên độ rủi ro được kiểm soát chặt chẽ và xác suất tiếp diễn xu hướng vượt trội.</p>

<hr>

<p><strong>3. Kế hoạch giao dịch &amp; Quản trị rủi ro kỷ luật</strong></p>

<ul>
<li><strong>Vị thế:</strong> {dir_label} 50% tỷ trọng danh mục mục tiêu tại mức giá <strong>{entry_str}</strong>.</li>
<li><strong>Ngưỡng cắt lỗ (Stop Loss):</strong> <strong>{sl_str}</strong> (Biên độ chịu rủi ro: <strong>-{risk_pct:.1f}%</strong>). Nếu giá vi phạm đóng nến vượt qua ngưỡng này, hệ thống sẽ thực hiện thanh lý vị thế ngay lập tức để bảo vệ vốn.</li>
<li><strong>Mục tiêu chốt lời (Take Profit):</strong> <strong>{tp_str}</strong> (Kỳ vọng lợi nhuận: <strong>+{reward_pct:.1f}%</strong>). Tỷ lệ Risk/Reward đạt mức <strong>1 : {rr:.2f}</strong>, hoàn toàn thỏa mãn tiêu chuẩn toán học giao dịch xác suất cao.</li>
{pyr_section}
</ul>

<hr>

<p><em>* Chú thích: Đây là giao dịch mô phỏng (demo) do Bot Trader tự động thực hiện dựa trên thuật toán {strat_name}, không cấu thành khuyến nghị hay lời mời chào đầu tư tài chính.</em></p>"""

    payload = {
        "sub": sub,
        "title": title,
        "body": body,
        "loai": loai,
        "question_for_crowd": question_for_crowd,
        "figures": figures,
        "anhs": [
            {
                "data": chart_b64,
                "alt": f"Biểu đồ kỹ thuật {timeframe} Chart tài sản {sym} kèm các mốc giao dịch {strat_name}",
                "placeholder": "{{ANH_1}}"
            }
        ]
    }

    payload_file = DATA_DIR / f"bot_trader_post_payload_{market_mode.lower()}.json"
    with open(payload_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # Xuất bản qua HTTP REST API
    print("📤 Đang xuất bản Luận điểm giao dịch qua HTTP REST API (https://gikky.net)...")
    try:
        res = thuc_hien_action("tao_mach", payload)
    except Exception as e:
        print(f"❌ Xuất bản thất bại: {e}")
        return None

    mach_id = res["mach_id"]
    mach_url = res["url"]

    # Lưu thông tin vị thế đang mở
    new_position = {
        "mach_id": mach_id,
        "url": mach_url,
        "symbol": sym,
        "yf_ticker": yf_ticker,
        "exchange": exchange,
        "market_type": candidate.get("market_type", "VN_STOCK" if not is_h4 else "FX"),
        "timeframe": timeframe,
        "direction": direction,
        "strategy_id": strat_id,
        "strategy_name": strat_name,
        "setup_name": setup_name,
        "decimals": decimals,
        "status": "OPEN",
        "entry_price": entry,
        "stop_loss": sl,
        "take_profit": tp,
        "pyramid_trigger": pyramid,
        "pyramided": False,
        "pyramid_price": None,
        "entry_date": datetime.now().strftime("%Y-%m-%d"),
        "current_price": entry,
        "pnl_pct": 0.0,
        "opened_at": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }

    vi_the_list.append(new_position)
    luu_vi_the_dang_mo(vi_the_list)

    print("🎉 ĐÃ XUẤT BẢN THÀNH CÔNG LUẬN ĐIỂM GIAO DỊCH!")
    print(f"   Mã: {sym} | Thị trường: {market_label} | Vị thế: {dir_label} | Mạch ID: #{mach_id}")
    print(f"   Link mạch: {mach_url}")

    return new_position


def dang_luan_diem_h4(symbol_target: str = None, avoid_strategy_id: str = None, bypass_daily_limit: bool = False) -> dict | None:
    """Hàm chuyên trách xuất bản Luận điểm giao dịch H4 Quốc tế."""
    return dang_luan_diem(
        symbol_target=symbol_target,
        market_mode="H4",
        avoid_strategy_id=avoid_strategy_id,
        bypass_daily_limit=bypass_daily_limit
    )


def dang_luan_diem_theo_lich() -> dict | None:
    """Hàm điều phối đăng Luận điểm giao dịch theo Lịch xuất bản (khung 13:45 hàng ngày).
    Quy tắc:
    1. Kiểm tra ngày nghỉ thị trường:
       - Nếu CẢ HAI thị trường đều nghỉ (not vn_open and not h4_open):
         In thông báo rõ ràng, gọi quet_ngay_nghi_va_danh_dau() để lưu watchlist,
         in NO_TRADE_FALLBACK và trả về None.
       - Nếu chỉ 1 trong 2 thị trường mở cửa: chỉ xét mở lệnh trên thị trường đang mở,
         thị trường nghỉ thì tự động cập nhật đánh dấu.
    2. Kiểm tra trần cứng 1 bài trade/ngày trên toàn hệ thống và giãn cách 18 giờ.
       Nếu vi phạm -> in thông báo NO_TRADE_FALLBACK và trả về None.
    3. Luân phiên thị trường: nếu lệnh mở gần nhất là Quốc tế (H4), ưu tiên chọn Cổ phiếu VN (D1),
       và ngược lại. Đồng thời tránh lặp lại cùng strategy_id liên tiếp.
    4. Nếu có ứng viên đạt chuẩn -> xuất bản bài viết và trả về thông tin vị thế mới.
    5. Nếu cả 2 thị trường đều không có cơ hội -> in thông báo NO_TRADE_FALLBACK và trả về None.
    """
    # 1. Kiểm tra ngày nghỉ thị trường cho cả 2 sàn
    vn_open, vn_reason = la_thoi_gian_giao_dich("VN")
    h4_open, h4_reason = la_thoi_gian_giao_dich("H4")

    # Nếu CẢ HAI thị trường đều đang trong thời gian nghỉ
    if not vn_open and not h4_open:
        print("\n" + "=" * 72)
        print("⏸️ [NGÀY NGHỈ THỊ TRƯỜNG] Cả 2 thị trường (Chứng khoán VN & Quốc tế H4) đều đang đóng cửa:")
        print(f"   - VN: {vn_reason}")
        print(f"   - H4: {h4_reason}")
        print("=" * 72)
        print("🔍 Tiến hành quét thị trường và ghi nhận deal tiềm năng vào danh sách theo dõi ngày nghỉ...")
        quet_ngay_nghi_va_danh_dau()
        print("\nℹ️ NO_TRADE_FALLBACK: Ngày nghỉ thị trường -> Không mở vị thế mới, đã lưu watchlist chờ mở cửa.")
        return None

    # Nếu 1 trong 2 thị trường nghỉ, thông báo trạng thái
    if not vn_open:
        print(f"ℹ️ Thị trường Chứng khoán VN đang nghỉ ({vn_reason}) -> Chỉ xét thị trường Quốc tế (H4).")
    if not h4_open:
        print(f"ℹ️ Thị trường Quốc tế H4 đang nghỉ ({h4_reason}) -> Chỉ xét thị trường Cổ phiếu VN.")

    vi_the_list = doc_vi_the_dang_mo()

    # 2. Kiểm tra trần cứng 1 trade/ngày và giãn cách 18h
    hop_le, ly_do = kiem_tra_han_muc_toan_he_thong(vi_the_list)
    if not hop_le:
        print(f"\n{ly_do}")
        print("ℹ️ NO_TRADE_FALLBACK: Hệ thống đã có trade trong ngày hoặc chưa đủ giãn cách 18h -> Kích hoạt fallback sang bài viết chuyên đề.")
        return None

    # 3. Xác định thứ tự ưu tiên thị trường và chiến lược dựa trên lệnh gần nhất
    opened_trades = []
    for p in vi_the_list:
        o_str = p.get("opened_at")
        if o_str:
            try:
                dt = datetime.strptime(o_str, "%Y-%m-%d %H:%M:%S")
                opened_trades.append((dt, p))
            except Exception:
                pass

    last_market = "VN"
    last_strat = None
    if opened_trades:
        opened_trades.sort(key=lambda x: x[0])
        latest_p = opened_trades[-1][1]
        is_latest_h4 = (latest_p.get("timeframe") == "H4" or latest_p.get("market_type") in ("FX", "COMMODITY", "ENERGY"))
        last_market = "H4" if is_latest_h4 else "VN"
        last_strat = latest_p.get("strategy_id")

    # Luân phiên thị trường
    if last_market == "H4":
        primary_market, secondary_market = "VN", "H4"
    else:
        primary_market, secondary_market = "H4", "VN"

    # Lọc chỉ chọn các thị trường đang mở cửa
    available_markets = []
    if primary_market == "VN" and vn_open:
        available_markets.append(primary_market)
    elif primary_market == "H4" and h4_open:
        available_markets.append(primary_market)

    if secondary_market == "VN" and vn_open:
        available_markets.append(secondary_market)
    elif secondary_market == "H4" and h4_open:
        available_markets.append(secondary_market)

    if not available_markets:
        print("\nℹ️ NO_TRADE_FALLBACK: Không có thị trường nào đang mở cửa để mở lệnh.")
        return None

    primary_market = available_markets[0]
    secondary_market = available_markets[1] if len(available_markets) > 1 else None

    primary_label = "Cổ phiếu VN (D1)" if primary_market == "VN" else "Quốc tế (H4)"
    print(f"🎯 Lịch luân phiên: Lệnh gần nhất thuộc {last_market} ({last_strat}).")
    print(f"   -> Ưu tiên 1: {primary_label} (tránh lặp lại chiến lược {last_strat})")
    if secondary_market:
        sec_label = "Cổ phiếu VN (D1)" if secondary_market == "VN" else "Quốc tế (H4)"
        print(f"   -> Dự phòng 2: {sec_label}")

    # Thử thị trường ưu tiên 1
    res = dang_luan_diem(market_mode=primary_market, avoid_strategy_id=last_strat)
    if res:
        return res

    # Nếu thị trường ưu tiên không có tín hiệu hoặc đầy 3/3, thử thị trường dự phòng 2 nếu có
    if secondary_market:
        sec_label = "Cổ phiếu VN (D1)" if secondary_market == "VN" else "Quốc tế (H4)"
        print(f"🔄 Chuyển sang tìm kiếm ứng viên trên thị trường dự phòng: {sec_label}...")
        res = dang_luan_diem(market_mode=secondary_market, avoid_strategy_id=last_strat)
        if res:
            return res

    print("\nℹ️ NO_TRADE_FALLBACK: Không có tín hiệu trade mới đạt chuẩn -> Kích hoạt fallback sang bài viết chuyên đề.")
    return None


if __name__ == "__main__":
    if "--scheduled" in sys.argv:
        res = dang_luan_diem_theo_lich()
        if not res:
            sys.exit(0)
    elif "--h4" in sys.argv:
        target = sys.argv[2] if len(sys.argv) > 2 and not sys.argv[2].startswith("-") else None
        dang_luan_diem_h4(target)
    else:
        target = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else None
        dang_luan_diem(target)
