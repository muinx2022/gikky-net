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
import re
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
        if c.get("score", 0) < 65:
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
        if c.get("score", 0) < 65:
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
    pending = [d for d in watchlist if d.get("status") == "PENDING_OPEN" and d.get("market_mode", "").upper() == mode and d.get("score", 0) >= 65]
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

    # 0. Kiểm tra file lock chống trùng lặp tiến trình trong ngày
    lock_file = DATA_DIR / f"trade_{today_str}.lock"
    if lock_file.exists():
        msg = (
            f"⛔ [LOCK NGÀY] Hôm nay ({today_str}) đã có lock file giao dịch ({lock_file.name}). "
            f"Đã có tiến trình mở lệnh cho ngày hôm nay. Hủy bỏ để tránh trùng lặp."
        )
        return False, msg

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


class FigureDict(dict):
    """Dictionary đại diện cho một cặp số liệu trong figures của Gikky.
    Tương thích cả truy cập theo chuẩn Gikky API (label) và cú pháp key/value.
    """

    def __getitem__(self, item):
        if item == "key":
            return super().get("label")
        return super().__getitem__(item)

    def get(self, item, default=None):
        if item == "key":
            return super().get("label", default)
        return super().get(item, default)



def _dung_lenh(*, direction: str, sym: str, entry_str: str, sl_str: str, tp_str: str, pyr_str: str | None) -> dict | None:
    """Lệnh có cấu trúc gửi kèm `POST /machs` (`lenh`), dựng từ CHÍNH các chuỗi giá đã dùng
    cho tiêu đề — số trên thẻ trang chủ khớp số trong tiêu đề từng chữ số.

    Trả `None` (bài vẫn đăng, chỉ không có dải lệnh) khi dữ liệu không qua được luật của
    server: mã ngoài `[A-Za-z0-9._/-]{1,20}`, hoặc sau khi làm tròn thứ tự SL/vào/TP không
    còn đúng (MUA: SL < vào < TP; BÁN: TP < vào < SL). Server trả 400 cả bài nếu `lenh` sai,
    nên bot tự kiểm trước thay vì để một lần làm tròn làm mất cả bài đăng.
    """
    if not re.fullmatch(r"[A-Za-z0-9._/-]{1,20}", sym or ""):
        return None
    try:
        vao, sl, tp = float(entry_str), float(sl_str), float(tp_str)
    except (TypeError, ValueError):
        return None
    mua = direction == "LONG"
    dung_thu_tu = (sl < vao < tp) if mua else (tp < vao < sl)
    if not dung_thu_tu:
        return None
    lenh = {
        "chieu": "mua" if mua else "ban",
        "ma": sym,
        "gia_vao": entry_str,
        "sl": sl_str,
        "tp": tp_str,
    }
    if pyr_str:
        lenh["nhoi"] = pyr_str
    return lenh


NGANH_MAP_VN = {
    "HDB": "Ngân hàng",
    "MBB": "Ngân hàng",
    "TCB": "Ngân hàng",
    "STB": "Ngân hàng",
    "SSI": "Chứng khoán",
    "SHS": "Chứng khoán",
    "MBS": "Chứng khoán",
    "HPG": "Thép & Vật liệu xây dựng",
    "FPT": "Công nghệ thông tin",
    "MWG": "Bán lẻ tiêu dùng",
    "PVS": "Dầu khí & Dịch vụ kỹ thuật",
    "BSR": "Lọc hóa dầu",
    "IDC": "Bất động sản Khu công nghiệp",
    "CEO": "Bất động sản dân dụng",
    "ACV": "Hạ tầng cảng hàng không",
    "VEA": "Cơ khí động lực",
    "QNS": "Hàng tiêu dùng & Đường",
    "VGI": "Viễn thông quốc tế",
}


def _tao_tieu_de_nhat_ky_vn(sym: str, entry_str: str, strat_id: str, setup_name: str, candidate: dict) -> str:
    """Tạo tiêu đề chuẩn Nhật ký vào lệnh Cổ phiếu VN (D1, max 160 ký tự)."""
    nganh = NGANH_MAP_VN.get(sym, "Cổ phiếu tiềm năng")
    strat = strat_id.upper()
    if strat == "ICHIMOKU":
        luan_diem = f"Bứt phá Mây Kumo, đón sóng dòng tiền nhóm {nganh}"
    elif strat in ("MA_CROSS", "MA30_50_PULLBACK"):
        luan_diem = f"Kiểm định hỗ trợ MA 30-50 thành công, kỳ vọng nhóm {nganh} dẫn dắt"
    elif strat == "BB_SQUEEZE":
        luan_diem = f"Bung nén Bollinger Bands, kỳ vọng sóng tăng tốc nhóm {nganh}"
    else:  # PA_MA200
        luan_diem = f"Tích lũy chặt trên trục MA 200, đón nhịp bứt phá nhóm {nganh}"

    title = f"Mua {sym} quanh {entry_str} — {luan_diem}"
    return title[:160]


def _tao_tieu_de_nhat_ky_h4(sym: str, dir_action: str, entry_str: str, strat_id: str, setup_name: str, direction: str, candidate: dict) -> str:
    """Tạo tiêu đề chuẩn Nhật ký vào lệnh Quốc tế H4 (max 160 ký tự)."""
    is_long = (direction == "LONG")
    sym_u = sym.upper()
    if "EUR" in sym_u:
        ctx = "DXY hạ nhiệt tại kháng cự, nến H4 xác nhận đáy sau cao hơn" if is_long else "Đồng USD giữ đà tăng, nến H4 suy yếu dưới MA 50"
    elif "GBP" in sym_u:
        ctx = "Áp lực bán USD lan tỏa, nến H4 bứt phá vùng tích lũy" if is_long else "Đồng Bảng suy yếu trước áp lực vĩ mô, nến H4 gãy hỗ trợ"
    elif "JPY" in sym_u:
        ctx = "Chênh lệch lợi suất duy trì, nến H4 bật tăng trên trục MA 50" if is_long else "Tâm lý Risk-Off kích hoạt dòng tiền JPY, H4 kiểm định cản động"
    elif "AUD" in sym_u:
        ctx = "Kỳ vọng xuất khẩu hàng hóa hỗ trợ, nến H4 bứt phá Mây Kumo" if is_long else "Đồng USD áp đảo, cấu trúc H4 mở rộng nhịp giảm"
    elif "CAD" in sym_u:
        ctx = "Giá dầu suy yếu gây sức ép, nến H4 xác nhận mô hình đảo chiều" if is_long else "Giá dầu hồi phục nâng đỡ CAD, nến H4 trượt khỏi kênh tăng"
    elif "CHF" in sym_u:
        ctx = "Lợi suất trái phiếu hỗ trợ USD, H4 giữ vững nền giá trên MA 200" if is_long else "Dòng tiền tìm nơi trú ẩn CHF, H4 phá vỡ hỗ trợ động"
    elif "XAU" in sym_u or "GC" in sym_u:
        ctx = "Tâm lý Risk-Off kích hoạt dòng tiền trú ẩn, H4 giữ vững hỗ trợ" if is_long else "Lợi suất thực tăng trở lại, nến H4 chịu áp lực chốt lời tại cản"
    elif "XAG" in sym_u or "SI" in sym_u:
        ctx = "Xung lực kim loại quý bứt phá, nến H4 mở rộng biến độ" if is_long else "Đà tăng kim loại quý chững lại, H4 kiểm định vùng cản động"
    elif "WTI" in sym_u or "BRENT" in sym_u or "CL" in sym_u or "BZ" in sym_u:
        ctx = "Căng thẳng nguồn cung hỗ trợ giá dầu, nến H4 phục hồi trên MA 50" if is_long else "Tồn kho năng lượng gia tăng, nến H4 gãy kênh hỗ trợ"
    elif "COPPER" in sym_u or "HG" in sym_u:
        ctx = "Kỳ vọng nhu cầu công nghiệp hồi phục, nến H4 bung nén tăng tốc" if is_long else "Tín hiệu PMI chững lại, nến H4 trượt khỏi vùng cân bằng"
    elif "NATGAS" in sym_u or "NG" in sym_u:
        ctx = "Yếu tố thời tiết thúc đẩy nhu cầu khí đốt, nến H4 tạo đáy đảo chiều" if is_long else "Nguồn cung dồi dào gây áp lực giá, nến H4 trượt dài dưới MA 200"
    else:
        ctx = f"Bối cảnh liên thị trường thuận lợi, nến H4 kích hoạt tín hiệu {setup_name}"

    title = f"{dir_action} {sym} quanh {entry_str} — {ctx}"
    return title[:160]


def tao_bai_viet_bot_trader(
    candidate: dict,
    chart_b64: str = None,
    market_mode: str = "VN"
) -> dict:
    """Soạn thảo nội dung bài viết và cấu trúc payload xuất bản cho Bot Trader theo chuẩn
    NHẬT KÝ GIAO DỊCH (Trading Journal) chuyên sâu v2.
    Hỗ trợ cả Cổ phiếu VN (D1, chu kỳ thanh toán T+2.5) và Quốc tế (H4, T+0).
    Tuân thủ quy chuẩn: 0 từ cấm, tối đa 6 cặp figures (mỗi key/value <= 24 ký tự).
    """
    is_h4 = (market_mode.upper() == "H4")
    sym = candidate["symbol"]
    exchange = candidate.get("exchange", "HOSE" if not is_h4 else "Forex")
    entry = candidate["entry_price"]
    sl = candidate["stop_loss"]
    tp = candidate["take_profit"]
    pyramid = candidate.get("pyramid_trigger")
    setup_name = candidate.get("setup_name", "")
    strat_id = candidate.get("strategy_id", "PA_MA200")
    strat_name = candidate.get("strategy_name", "Price Action & MA 200")
    direction = candidate.get("direction", "LONG")
    timeframe = candidate.get("timeframe", "H4" if is_h4 else "D1")
    decimals = candidate.get("decimals", 4 if "USD" in sym else 2)
    risk_pct = candidate.get("risk_pct", 0.0)
    reward_pct = candidate.get("reward_pct", 0.0)
    rr = candidate.get("rr_ratio", 2.4)
    ly_do_list = candidate.get("ly_do", [])
    sub = candidate.get("sub", "chung-khoan" if not is_h4 else "ngoai-hoi")

    dir_action = "Mua" if direction == "LONG" else "Bán"
    dir_label = "Mua (Long)" if direction == "LONG" else "Bán khống (Short)"

    entry_str = f"{entry:.{decimals}f}"
    sl_str = f"{sl:.{decimals}f}"
    tp_str = f"{tp:.{decimals}f}"
    pyr_str = f"{pyramid:.{decimals}f}" if pyramid else None

    # 1. Tiêu đề chuẩn Nhật ký vào lệnh thực chiến
    if not is_h4:
        title = _tao_tieu_de_nhat_ky_vn(sym, entry_str, strat_id, setup_name, candidate)
    else:
        title = _tao_tieu_de_nhat_ky_h4(sym, dir_action, entry_str, strat_id, setup_name, direction, candidate)

    loai = "Vào lệnh"
    loai_mach = "nhat_ky"

    lenh = _dung_lenh(
        direction=direction,
        sym=sym,
        entry_str=entry_str,
        sl_str=sl_str,
        tp_str=tp_str,
        pyr_str=pyr_str,
    )

    # Bảng figures: Tối đa 6 cặp theo đúng quy định SO_FIGURES_TOI_DA của Gikky (mỗi chuỗi <= 24 ký tự)
    if is_h4:
        figures = [
            FigureDict({"label": "Mã tài sản", "value": f"{sym} ({exchange})"[:24]}),
            FigureDict({"label": "Vị thế", "value": f"{dir_label} {timeframe}"[:24]}),
            FigureDict({"label": "Giá Entry", "value": entry_str[:24]}),
            FigureDict({"label": "Stop Loss", "value": f"{sl_str} (-{risk_pct:.1f}%)"[:24]}),
            FigureDict({"label": "Take Profit", "value": f"{tp_str} (+{reward_pct:.1f}%)"[:24]}),
            FigureDict({"label": "Tỷ lệ R:R", "value": f"1 : {rr:.2f}"[:24]})
        ]
    else:
        # Cổ phiếu VN (D1): Bổ sung chỉ số chu kỳ thanh toán T+2.5 (bán khả dụng từ sáng T+3)
        figures = [
            FigureDict({"label": "Mã tài sản", "value": f"{sym} ({exchange})"[:24]}),
            FigureDict({"label": "Vị thế", "value": f"{dir_label} {timeframe}"[:24]}),
            FigureDict({"label": "Giá Entry", "value": entry_str[:24]}),
            FigureDict({"label": "Stop Loss", "value": f"{sl_str} (-{risk_pct:.1f}%)"[:24]}),
            FigureDict({"label": "Take Profit", "value": f"{tp_str} (+{reward_pct:.1f}%)"[:24]}),
            FigureDict({"label": "Chu kỳ bán", "value": "Từ sáng T+3"[:24]})
        ]

    # Câu hỏi tương tác ngắn gọn (tối đa 200 ký tự theo quy định Gikky API)
    question_for_crowd = (
        f"Với nhật ký {dir_action} {sym} ({entry_str}) khung {timeframe}, "
        f"bạn đánh giá kịch bản nào dễ xảy ra hơn: Đạt Take Profit {tp_str} hay chạm Stop Loss {sl_str}?"
    )[:200]

    # 2. Lời mở đầu súc tích, tự nhiên của người giao dịch ghi chép nhật ký
    nganh_vn = NGANH_MAP_VN.get(sym, "Cổ phiếu tiềm năng")
    if not is_h4:
        teaser_p = (
            f"Nhật ký ghi nhận phiên giao dịch: Chỉ số VN-Index đang trong nhịp vận động tích lũy và kiểm định cung cầu, "
            f"dòng tiền trên thị trường phân hóa mạnh mẽ và bắt đầu có tín hiệu dịch chuyển vào nhóm ngành <strong>{nganh_vn}</strong>. "
            f"Quan sát hành vi giá của <strong>{sym}</strong> ({exchange}, khung <strong>D1</strong>), "
            f"áp lực bán chủ động đã suy kiệt rõ rệt sau nhịp rũ bỏ, phe mua nhập cuộc dứt khoát bảo vệ các ngưỡng hỗ trợ trọng yếu. "
            f"Nhận thấy cơ hội có xác suất thành công cao và tỷ lệ Risk/Reward vượt trội, quyết định mở vị thế giải ngân theo kế hoạch dưới đây."
        )
    else:
        teaser_p = (
            f"Nhật ký ghi nhận phiên giao dịch khung <strong>H4</strong> đối với <strong>{sym}</strong> ({exchange}): "
            f"Bối cảnh liên thị trường ghi nhận các chuyển dịch đáng chú ý về tâm lý dòng vốn và sức mạnh đồng USD. "
            f"Cấu trúc nến H4 của <strong>{sym}</strong> vừa hoàn tất nhịp kiểm định cung cầu với hành động giá dứt khoát, "
            f"xác nhận điểm kích hoạt vào lệnh theo chiến lược <strong>{strat_name}</strong>. "
            f"Dưới đây là ghi chép chi tiết về bối cảnh, luận điểm kỹ thuật và lộ trình quản trị rủi ro nghiêm ngặt."
        )

    # 3. Thân bài 4 phần chuyên sâu
    ma200_val = candidate.get("ma200", entry)

    # PHẦN 1: Bức tranh tổng thể & Tâm lý thị trường (Big Picture & Sentiment)
    if not is_h4:
        pos_ma200_text = (
            f"Về vị thế kỹ thuật dài hạn, {sym} duy trì vững vàng phía trên đường trung bình MA 200 ngày ({ma200_val:.{decimals}f}), "
            f"khẳng định cổ phiếu đang nằm trong pha tăng giá chủ đạo (Stage 2 Uptrend). "
            f"Vị thế giá trên trục MA 200 đóng vai trò bệ đỡ tâm lý tích cực, biến các nhịp điều chỉnh ngắn hạn thành cơ hội gia tăng tỷ trọng lý tưởng."
            if entry >= ma200_val else
            f"Về vị thế kỹ thuật, {sym} đang nỗ lực kiểm định lại trục xu hướng dài hạn MA 200 ({ma200_val:.{decimals}f}) "
            f"sau chu kỳ tạo đáy trung hạn vững chắc, cho thấy tâm lý bi quan đã hoàn toàn được hấp thụ bởi lực cầu tổ chức."
        )
        big_picture_p = (
            f"Chỉ số VN-Index tiếp tục duy trì trạng thái tích lũy lành mạnh với sự luân phiên giữ nhịp giữa các nhóm ngành xương sống "
            f"(Ngân hàng, Chứng khoán, Thép, BĐS). Dòng tiền chủ động có xu hướng tìm đến các cổ phiếu có nền tảng cơ bản vững vàng "
            f"thuộc nhóm <strong>{nganh_vn}</strong>, nơi áp lực cung trôi nổi đã được hấp thụ phần lớn.<br><br>"
            f"{pos_ma200_text}"
        )
    else:
        sym_u = sym.upper()
        if "XAU" in sym_u or "GC" in sym_u or "XAG" in sym_u or "SI" in sym_u:
            macro_text = (
                "Tâm lý liên thị trường đang nghiêng về trạng thái phòng thủ rủi ro (Risk-Off), thúc đẩy dòng vốn tìm kiếm nơi trú ẩn an toàn. "
                "Thị trường kim loại quý được hỗ trợ tích cực bởi kỳ vọng chính sách tiền tệ và diễn biến lợi suất thực trái phiếu Mỹ."
            )
        elif "WTI" in sym_u or "BRENT" in sym_u or "CL" in sym_u or "BZ" in sym_u or "NG" in sym_u or "COPPER" in sym_u:
            macro_text = (
                "Thị trường năng lượng và hàng hóa thế giới đang phản ánh sự giằng co giữa kỳ vọng nhu cầu công nghiệp và các số liệu kiểm kê tồn kho. "
                "Yếu tố vĩ mô và cân đối cung cầu tạo nên các nhịp biến động sóng trung hạn rõ rệt trên khung thời gian H4."
            )
        else:
            macro_text = (
                "Trên thị trường ngoại hối quốc tế, chỉ số DXY (US Dollar Index) đang dao động tại vùng kháng cự kỹ thuật quan trọng và chịu áp lực điều chỉnh. "
                "Tâm lý liên thị trường ổn định tạo dư địa thuận lợi cho các cấu trúc giá bứt phá trên các cặp tỷ giá chính."
            )

        pos_ma200_h4 = (
            f"Trên đồ thị H4, {sym} duy trì ưu thế áp đảo của phe mua khi hành động giá tôn trọng trục trung bình MA 200 ({ma200_val:.{decimals}f}), "
            f"giữ vững cấu trúc đỉnh đáy sau cao hơn (Higher Highs / Higher Lows)."
            if direction == "LONG" else
            f"Trên đồ thị H4, {sym} chịu sự chi phối hoàn toàn của phe bán khi đường giá trượt dài phía dưới trục MA 200 ({ma200_val:.{decimals}f}), "
            f"xác lập cấu trúc đỉnh đáy sau thấp hơn (Lower Highs / Lower Lows)."
        )
        big_picture_p = f"{macro_text}<br><br>{pos_ma200_h4}"

    # PHẦN 2: Luận điểm vào lệnh & Tín hiệu kích hoạt (Trade Thesis & Technical Trigger)
    strat = strat_id.upper()
    if strat == "ICHIMOKU":
        tenkan_val = candidate.get("tenkan", entry)
        kijun_val = candidate.get("kijun", entry)
        if direction == "LONG":
            strat_thesis = (
                f"Tín hiệu kích hoạt Ichimoku Kinko Hyo: Giá đóng cửa bứt phá và vận động hoàn toàn phía trên Mây Kumo, "
                f"xác nhận phe mua kiểm soát toàn bộ xu hướng. Đường Tenkan-sen ({tenkan_val:.{decimals}f}) cắt lên và vận động phía trên Kijun-sen ({kijun_val:.{decimals}f}), "
                f"trong khi Kijun-sen phẳng đóng vai trò bệ đỡ động nâng đỡ các nhịp rung lắc ngắn hạn."
            )
            invalidation_level_desc = f"thủng đường tiêu chuẩn Kijun-sen ({kijun_val:.{decimals}f}) hoặc trượt ngược trở lại vào trong Mây Kumo"
        else:
            strat_thesis = (
                f"Tín hiệu kích hoạt Ichimoku Kinko Hyo: Giá đóng cửa trượt dài phía dưới Mây Kumo, "
                f"xác nhận áp lực bán chiếm ưu thế tuyệt đối. Đường Tenkan-sen ({tenkan_val:.{decimals}f}) duy trì dưới đường Kijun-sen ({kijun_val:.{decimals}f}), "
                f"liên tục từ chối các nỗ lực phục hồi kỹ thuật của phe mua."
            )
            invalidation_level_desc = f"vượt ngược trở lại lên trên đường Kijun-sen ({kijun_val:.{decimals}f}) hoặc lọt vào trong Mây Kumo"

    elif strat in ("MA_CROSS", "MA30_50_PULLBACK"):
        ma30_val = candidate.get("ma30", entry)
        ma50_val = candidate.get("ma50", entry)
        if direction == "LONG":
            strat_thesis = (
                f"Tín hiệu kích hoạt Trung bình động (MA): Dải MA 30 ({ma30_val:.{decimals}f}) và MA 50 ({ma50_val:.{decimals}f}) đang dốc lên song song mở rộng biên độ, "
                f"xác lập xu hướng tăng bền vững. Nhịp kiểm định hỗ trợ động dải MA 30 – MA 50 xuất hiện nến phản ứng tích cực, "
                f"xác nhận dòng tiền chủ động nhập cuộc hấp thụ hết áp lực bán điều chỉnh."
            )
            invalidation_level_desc = f"đóng nến gãy dải hỗ trợ động MA 50 ({ma50_val:.{decimals}f})"
        else:
            strat_thesis = (
                f"Tín hiệu kích hoạt Trung bình động (MA): Dải MA 30 ({ma30_val:.{decimals}f}) vận động phía dưới MA 50 ({ma50_val:.{decimals}f}) và cùng dốc xuống, "
                f"xác lập xu hướng giảm rõ nét. Các nỗ lực phục hồi chạm vào dải cản MA 30 – MA 50 đều nhanh chóng xuất hiện nến từ chối giá cao."
            )
            invalidation_level_desc = f"đóng nến bứt phá vượt qua dải kháng cự MA 50 ({ma50_val:.{decimals}f})"

    elif strat == "BB_SQUEEZE":
        bb_mid = candidate.get("bb_mid", entry)
        if direction == "LONG":
            strat_thesis = (
                f"Tín hiệu kích hoạt Co thắt Bollinger Bands: Dải biến động (20, 2) vừa hoàn tất chu kỳ co thắt biên độ hẹp cực đại (Volatility Squeeze), "
                f"sau đó xuất hiện nến kích hoạt bứt phá dải băng trên (BB Upper) đi kèm thanh khoản gia tăng đột biến, "
                f"báo hiệu sự mở màn của một pha mở rộng biên độ tăng tốc."
            )
            invalidation_level_desc = f"đóng nến quay đầu thủng trục giữa dải Bollinger (BB Mid: {bb_mid:.{decimals}f})"
        else:
            strat_thesis = (
                f"Tín hiệu kích hoạt Co thắt Bollinger Bands: Dải Bollinger Bands trải qua giai đoạn nén biên độ trước khi xuất hiện nến đỏ đóng cửa phá vỡ dải băng dưới (BB Lower). "
                f"Đà mở dải băng hướng xuống cho thấy xung lực bán tháo bắt đầu gia tốc."
            )
            invalidation_level_desc = f"đóng nến quay đầu vượt lên trên trục giữa dải Bollinger (BB Mid: {bb_mid:.{decimals}f})"

    else:  # PA_MA200
        if direction == "LONG":
            strat_thesis = (
                f"Tín hiệu kích hoạt Price Action &amp; MA 200: Cổ phiếu xuất hiện mô hình nến kiểm định cung thành công (Pin Bar từ chối giá thấp / VCP nén biên độ thu hẹp) "
                f"ngay trên trục hỗ trợ dài hạn MA 200 ({ma200_val:.{decimals}f}), tạo nên điểm vào lệnh với vị thế phòng thủ tối ưu."
            )
            invalidation_level_desc = f"đóng nến gãy hoàn toàn trục xu hướng dài hạn MA 200 ({ma200_val:.{decimals}f})"
        else:
            strat_thesis = (
                f"Tín hiệu kích hoạt Price Action &amp; MA 200: Đường giá xuất hiện nến đảo chiều từ chối tăng khi tiếp cận trục trung bình MA 200 ({ma200_val:.{decimals}f}), "
                f"xác nhận ngưỡng MA 200 tiếp tục là bức tường cản vững chắc chặn đứng đà phục hồi."
            )
            invalidation_level_desc = f"đóng nến bứt phá vượt qua trục MA 200 ({ma200_val:.{decimals}f})"

    ly_do_html = "".join([f"<li>{ld}</li>" for ld in ly_do_list])

    # PHẦN 3: Kỳ vọng mục tiêu & Kế hoạch phân bổ (Expectations & Execution Plan)
    pyr_section = (
        f"<li><strong>Kịch bản nhồi lệnh (Pyramiding):</strong> Khi giá vận động thuận lợi và vượt mốc cản <strong>{pyr_str}</strong>, "
        f"hệ thống sẽ kích hoạt giải ngân thêm 50% khối lượng còn lại, đồng thời dời toàn bộ điểm Stop Loss về mức hòa vốn (<strong>{entry_str}</strong>) "
        f"nhằm chuyển toàn bộ giao dịch sang trạng thái <strong>Free-risk Trade (Không rủi ro)</strong>.</li>"
    ) if pyr_str else ""

    t25_section = ""
    if not is_h4:
        today_dt = datetime.now()
        if candidate.get("entry_date"):
            try:
                today_dt = datetime.strptime(candidate["entry_date"], "%Y-%m-%d")
            except Exception:
                pass
        today_str = today_dt.strftime("%d/%m/%Y")
        t25_section = (
            f"<li><strong>Ứng phó chu kỳ thanh toán (T+2.5):</strong> Cổ phiếu mua trong phiên {today_str} "
            f"sẽ về tài khoản vào chiều ngày T+2, và chính thức khả dụng để giao dịch từ phiên sáng T+3. "
            f"Kế hoạch đã tính toán khoảng đệm an toàn ({risk_pct:.1f}%) để danh mục hấp thụ các nhịp rung lắc ngắn hạn "
            f"trước khi cổ phiếu về tài khoản khả dụng.</li>"
        )

    # PHẦN 4: Điểm vô hiệu hóa luận điểm & Quản trị rủi ro (Invalidation Level & Risk Protocol)
    # Ráp toàn bộ nội dung body HTML theo chuẩn nhật ký v2 (0 từ cấm, không h2/h3)
    body = f"""<p>{{{{ANH_1}}}}</p>

<p>{teaser_p}</p>

<hr>

<p><strong>1. Bức tranh tổng thể &amp; Tâm lý thị trường (Big Picture &amp; Sentiment)</strong></p>

<p>{big_picture_p}</p>

<hr>

<p><strong>2. Luận điểm vào lệnh &amp; Tín hiệu kích hoạt (Trade Thesis &amp; Technical Trigger)</strong></p>

<p><strong>Hành vi cung cầu (Volume &amp; Price Action):</strong> Nhịp kéo ngược (pullback) gần nhất diễn ra với biên độ nến thu hẹp và khối lượng giao dịch sụt giảm rõ rệt, chứng minh lượng cung bán tháo không còn xuất hiện. Ngay khi giá chạm vùng hỗ trợ then chốt, lực cầu đối ứng đã nhập cuộc dứt khoát hấp thụ toàn bộ cung trôi nổi.</p>

<p>{strat_thesis}</p>

<ul>
{ly_do_html}
</ul>

<hr>

<p><strong>3. Kỳ vọng mục tiêu &amp; Kế hoạch phân bổ (Expectations &amp; Execution Plan)</strong></p>

<ul>
<li><strong>Vị thế giải ngân:</strong> {dir_label} 50% tỷ trọng danh mục mục tiêu quanh mức giá <strong>{entry_str}</strong>.</li>
<li><strong>Mục tiêu chốt lời (Take Profit):</strong> <strong>{tp_str}</strong> (Kỳ vọng lợi nhuận: <strong>+{reward_pct:.1f}%</strong>). Tỷ lệ Risk/Reward đạt mức <strong>1 : {rr:.2f}</strong>, thỏa mãn tiêu chuẩn khắt khe về hiệu quả toán học xác suất cao (R:R &gt;= 1:2.4).</li>
{t25_section}
{pyr_section}
</ul>

<hr>

<p><strong>4. Điểm vô hiệu hóa luận điểm &amp; Quản trị rủi ro (Invalidation Level &amp; Risk Protocol)</strong></p>

<ul>
<li><strong>Điểm vô hiệu hóa luận điểm (Invalidation Level):</strong> Toàn bộ cấu trúc vị thế được xây dựng dựa trên tiền đề mốc phòng thủ <strong>{sl_str}</strong> được giữ vững. Nếu giá đóng cửa vi phạm {invalidation_level_desc} hoặc xuyên thủng <strong>{sl_str}</strong> (mức rủi ro tối đa: <strong>-{risk_pct:.1f}%</strong>), cấu trúc kỹ thuật ban đầu chính thức bị vô hiệu hóa hoàn toàn.</li>
<li><strong>Kỷ luật quản trị rủi ro tuyệt đối:</strong> Không nuôi hy vọng hay trì hoãn — hệ thống sẽ thực hiện thanh lý vị thế dứt khoát khi giá xác nhận gãy mốc phòng thủ nhằm bảo vệ nguyên vẹn 95%+ nguồn vốn danh mục cho các cơ hội tiếp theo.</li>
</ul>

<hr>

<p><em>* Ghi chú nhật ký: Đây là nhật ký giao dịch mô phỏng (demo) do Bot Trader ghi nhận dựa trên kế hoạch kỹ thuật {strat_name}, không cấu thành khuyến nghị hay lời mời chào đầu tư tài chính.</em></p>"""

    anhs_list = []
    if chart_b64:
        anhs_list.append({
            "data": chart_b64,
            "alt": f"Biểu đồ kỹ thuật {timeframe} Chart tài sản {sym} kèm các mốc giao dịch {strat_name}",
            "placeholder": "{{ANH_1}}"
        })

    payload = {
        "sub": sub,
        "title": title,
        "body": body,
        "loai": loai,
        "loai_mach": loai_mach,
        "question_for_crowd": question_for_crowd,
        "figures": figures,
        "anhs": anhs_list
    }
    if lenh is not None:
        payload["lenh"] = lenh
    return payload


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
                    # Lọc chất lượng nghiêm ngặt: chỉ chấp nhận ứng viên có score >= 65
                    if c.get("score", 0) < 65:
                        continue
                    valid_candidates.append(c)

                if valid_candidates:
                    # Sắp xếp ưu tiên: tránh avoid_strategy_id, sau đó ưu tiên score cao nhất
                    valid_candidates.sort(
                        key=lambda x: (
                            x.get("strategy_id") != avoid_strategy_id if avoid_strategy_id else True,
                            x.get("score", 0)
                        ),
                        reverse=True
                    )
                    candidate = valid_candidates[0]

    # Kiểm tra ngưỡng chất lượng score >= 65 cho candidate
    if candidate and candidate.get("score", 0) < 65 and not symbol_target:
        print(f"⏸️ [NO_TRADE_FALLBACK] Ứng viên {candidate.get('symbol')} có điểm {candidate.get('score')} (< 65). Không đủ điều kiện mở vị thế.")
        candidate = None

    if not candidate:
        print(f"⏸️ [NO_TRADE_FALLBACK] Không có ứng viên nào trong danh mục {market_label} đạt chuẩn chất lượng (score >= 65). Hệ thống kiên nhẫn đứng ngoài quan sát.")
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

    # Khóa chống trùng lặp (Atomic Lock / Guard)
    today_str = datetime.now().strftime("%Y-%m-%d")
    lock_file = DATA_DIR / f"trade_{today_str}.lock"
    if lock_file.exists():
        print(f"⛔ Đã có tiến trình mở lệnh cho ngày hôm nay ({today_str}). Hủy bỏ để tránh trùng lặp.")
        return None
    try:
        with open(lock_file, "w", encoding="utf-8") as f:
            json.dump({
                "symbol": sym,
                "market_mode": market_mode,
                "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print(f"⚠️ Cảnh báo không thể tạo file lock: {e}")

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

    # 2. Xây dựng tiêu đề, nội dung & thông số bài viết
    payload = tao_bai_viet_bot_trader(
        candidate=candidate,
        chart_b64=chart_b64,
        market_mode=market_mode
    )

    payload_file = DATA_DIR / f"bot_trader_post_payload_{market_mode.lower()}.json"
    with open(payload_file, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)

    # Xuất bản qua HTTP REST API
    print("📤 Đang xuất bản Luận điểm giao dịch qua HTTP REST API (https://gikky.net)...")
    try:
        res = thuc_hien_action("tao_mach", payload)
    except Exception as e:
        print(f"❌ Xuất bản thất bại: {e}")
        if lock_file.exists():
            try:
                lock_file.unlink()
            except Exception:
                pass
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
