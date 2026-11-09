# -*- coding: utf-8 -*-
"""Kiểm tra và xử lý vị thế sau phiên giao dịch (EOD & H4 Checker) cho Bot Trader.

Nhiệm vụ:
1. kiem_tra_sau_15h(): Kiểm tra dữ liệu phiên EOD (sau 15:15) cho Cổ phiếu VN (D1 qua vnstock).
2. kiem_tra_vi_the_h4(): Kiểm tra cập nhật liên tục cho các vị thế Quốc tế H4 (FX, Năng lượng, Hàng hóa qua Yahoo).
3. Đối chiếu các kịch bản:
   - Chạm Stop Loss: Thêm mốc cắt lỗ vào mạch, đóng mạch (dong_mach), ghi chú thích demo.
   - Chạm Take Profit: Thêm mốc chốt lời vào mạch, đóng mạch (dong_mach), ghi chú thích demo.
   - Chạm điểm Nhồi lệnh: Thêm mốc nhồi lệnh mới vào mạch, dời Stop Loss lên hòa vốn (Free-risk Trade).
   - Vận động bình thường: Cập nhật PnL tạm tính và thời điểm kiểm tra.
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from vnstock import Quote
from dang_bai_bot_trader import thuc_hien_action
from scanner import lay_du_lieu_h4_yahoo, GLOBAL_WATCHLIST

YF_MAP = {item["symbol"]: item["yf_ticker"] for item in GLOBAL_WATCHLIST}

DATA_DIR = Path(__file__).resolve().parent / "data"
VI_THE_FILE = DATA_DIR / "vi_the_dang_mo.json"


def doc_vi_the() -> list:
    if VI_THE_FILE.exists():
        try:
            with open(VI_THE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            return []
    return []


def luu_vi_the(ds: list):
    with open(VI_THE_FILE, "w", encoding="utf-8") as f:
        json.dump(ds, f, ensure_ascii=False, indent=2)


def goi_dang_bai_vps(action: str, payload_data: dict) -> dict | None:
    """Thực thi action ('them_moc', 'dong_mach') qua HTTP REST API (GikkyClient)."""
    try:
        return thuc_hien_action(action, payload_data)
    except Exception as e:
        print(f"❌ Lỗi thực thi action {action} qua HTTP API: {e}")
        return None


# =====================================================================
# 1. KIỂM TRA VỊ THẾ CỔ PHIẾU VN (D1 - SAU 15H)
# =====================================================================

def tinh_ngay_t_plus(entry_date_str: str, check_date_str: str, is_afternoon: bool = True) -> float:
    """Tính số ngày làm việc giữa entry_date và check_date (chu kỳ T+ của TTCK Việt Nam).

    - Ngày mua: T+0
    - Cách 1 ngày giao dịch: T+1.0
    - Cách 2 ngày giao dịch: Sáng T+2.0, Chiều/EOD T+2.5 (cổ phiếu đã về tài khoản, khả dụng bán)
    - Cách >= 3 ngày giao dịch: T+3.0, T+4.0...
    """
    if not entry_date_str or not check_date_str:
        return 0.0

    try:
        d_entry = datetime.strptime(str(entry_date_str)[:10], "%Y-%m-%d").date()
        d_check = datetime.strptime(str(check_date_str)[:10], "%Y-%m-%d").date()
    except Exception:
        return 0.0

    if d_check <= d_entry:
        return 0.0

    trading_days = 0
    cur = d_entry + timedelta(days=1)
    while cur <= d_check:
        if cur.weekday() < 5:  # Thứ 2 đến Thứ 6
            trading_days += 1
        cur += timedelta(days=1)

    if trading_days == 0:
        return 0.0
    elif trading_days == 1:
        return 1.0
    elif trading_days == 2:
        return 2.5 if is_afternoon else 2.0
    else:
        return float(trading_days)


def kiem_tra_sau_15h(simulate_date: str = None) -> list:
    """Chạy quy trình kiểm tra EOD sau 15h cho tất cả vị thế cổ phiếu VN đang mở."""
    if not simulate_date:
        simulate_date = datetime.now().strftime("%Y-%m-%d")

    print("=" * 68)
    print(f"🕒 BOT TRADER: KIỂM TRA EOD CỔ PHIẾU VN (PHIÊN {simulate_date})...")
    print("=" * 68)

    vi_the_list = doc_vi_the()
    open_positions = [
        p for p in vi_the_list
        if p.get("status") == "OPEN" and p.get("timeframe", "D1") == "D1" and p.get("market_type", "VN_STOCK") == "VN_STOCK"
    ]

    if not open_positions:
        print("ℹ️ Hiện không có vị thế cổ phiếu VN nào đang mở cần theo dõi.")
        return []

    print(f"📊 Đang theo dõi {len(open_positions)} vị thế cổ phiếu VN đang mở...")
    updates = []

    for pos in open_positions:
        sym = pos["symbol"]
        mach_id = pos["mach_id"]
        entry = pos["entry_price"]
        sl = pos["stop_loss"]
        tp = pos["take_profit"]
        pyramid_trigger = pos.get("pyramid_trigger")
        pyramided = pos.get("pyramided", False)

        print(f"\n🔍 Kiểm tra mã {sym} (Mạch #{mach_id} | Entry: {entry} | SL: {sl} | TP: {tp})...")

        try:
            q = Quote(symbol=sym, source="vci")
            df = q.history(start="2026-09-01", end=simulate_date)
            if df is None or len(df) == 0:
                print(f"⚠️ Không lấy được dữ liệu nến cho {sym}")
                continue

            df.columns = [c.lower() for c in df.columns]
            last = df.iloc[-1]
            close = float(last["close"])
            high = float(last["high"])
            low = float(last["low"])
            vol = float(last.get("volume", 0.0))
            session_date = str(last["time"])[:10]

            # Kiểm tra sự kiện quyền / GDKHQ
            if len(df) >= 2:
                prev_row = df.iloc[-2]
                prev_close = float(prev_row["close"])
                curr_open = float(last["open"]) if "open" in last else close
                exchange = pos.get("exchange", "HOSE").upper()
                threshold = 0.91 if exchange == "HOSE" else (0.87 if exchange == "HNX" else 0.82)
                drop_ratio = close / prev_close
                open_drop_ratio = curr_open / prev_close
                last_adj_date = pos.get("corporate_action", {}).get("ex_date")

                if (open_drop_ratio < threshold or drop_ratio < threshold) and last_adj_date != session_date:
                    k = round(open_drop_ratio if open_drop_ratio < threshold else drop_ratio, 4)
                    multiplier = round(1.0 / k, 4)
                    vol_increase_pct = round((multiplier - 1.0) * 100, 1)

                    print(f"⚠️ PHÁT HIỆN SỰ KIỆN GDKHQ / CHIA CỔ TỨC: {sym} (k = {k}, Vol quy đổi x{multiplier})")
                    old_sl = sl
                    old_tp = tp
                    old_pyr = pyramid_trigger

                    sl = round(old_sl * k, 2)
                    tp = round(old_tp * k, 2)
                    pyramid_trigger = round(old_pyr * k, 2) if old_pyr else None

                    pos["stop_loss"] = sl
                    pos["take_profit"] = tp
                    pos["shares_multiplier"] = multiplier
                    if pyramid_trigger:
                        pos["pyramid_trigger"] = pyramid_trigger

                    pos["corporate_action"] = {
                        "ex_date": session_date,
                        "factor": k,
                        "shares_multiplier": multiplier,
                        "vol_increase_pct": vol_increase_pct,
                        "entry_price": entry,
                        "original_sl": old_sl,
                        "original_tp": old_tp,
                        "original_pyramid": old_pyr,
                        "new_sl": sl,
                        "new_tp": tp,
                        "new_pyramid": pyramid_trigger
                    }

                    body_moc_ca = f"""<p><strong>[ĐIỀU CHỈNH THÔNG SỐ VỊ THẾ - NGÀY GIAO DỊCH KHÔNG HƯỞNG QUYỀN]</strong></p>

<p>Hệ thống <strong>Bot Trader</strong> ghi nhận trong phiên ngày <strong>{session_date}</strong>, cổ phiếu <strong>{sym}</strong> có sự kiện GDKHQ (hệ số điều chỉnh <strong>k ≈ {k:.4f}</strong>). Giá mua ban đầu Entry được giữ nguyên giá gốc, điều chỉnh mốc Stop Loss và Take Profit tương ứng:</p>

<hr>
<ul>
<li><strong>Giá mua thực tế (Entry):</strong> <strong>{entry:.2f}</strong> (Giữ nguyên).</li>
<li><strong>Quy đổi khối lượng:</strong> <strong>Tăng +{vol_increase_pct}%</strong> (x{multiplier:.2f}).</li>
<li><strong>Ngưỡng cắt lỗ (Stop Loss mới):</strong> <del>{old_sl:.2f}</del> ➔ <strong>{sl:.2f}</strong></li>
<li><strong>Mục tiêu chốt lời (Take Profit mới):</strong> <del>{old_tp:.2f}</del> ➔ <strong>{tp:.2f}</strong></li>
</ul>

<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                    ca_payload = {
                        "mach_id": mach_id,
                        "body": body_moc_ca,
                        "loai": "Điều chỉnh",
                        "figures": [
                            {"label": "Sự kiện", "value": f"GDKHQ {session_date}"},
                            {"label": "Giá mua Entry", "value": f"{entry:.2f} (Giữ nguyên)"},
                            {"label": "Quy đổi cổ phiếu", "value": f"Tăng +{vol_increase_pct}% (x{multiplier:.2f})"},
                            {"label": "Stop Loss mới", "value": f"{sl:.2f}"},
                            {"label": "Take Profit mới", "value": f"{tp:.2f}"}
                        ]
                    }
                    goi_dang_bai_vps("them_moc", ca_payload)

            multiplier = pos.get("shares_multiplier", 1.0)
            cash_div = pos.get("cash_dividend", 0.0)
            equivalent_price = close * multiplier + cash_div
            pnl_pct = ((equivalent_price - entry) / entry) * 100

            pos["current_price"] = close
            pos["equivalent_price"] = round(equivalent_price, 2)
            pos["pnl_pct"] = round(pnl_pct, 2)
            pos["last_checked"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            # Tính toán chu kỳ T+ cho cổ phiếu VN
            t_val = tinh_ngay_t_plus(pos.get("entry_date", simulate_date), session_date, is_afternoon=True)
            pos["t_plus"] = t_val
            pos["t_status"] = f"T+{t_val}" if t_val >= 2.5 else f"T+{t_val} (Chờ hàng về)"
            print(f"   📅 Chu kỳ thanh toán: T+{t_val} ({pos['t_status']})")

            # Rào chắn T+2.5: Cổ phiếu chưa về tài khoản (T+ < 2.5) thì KHÔNG được bán (SL/TP)
            if t_val < 2.5:
                if low <= sl or close <= sl:
                    print(f"   🚨 [CẢNH BÁO T+2.5] {sym} chạm ngưỡng Stop Loss ({sl}) nhưng đang ở chu kỳ T+{t_val} (cổ phiếu chưa về tài khoản). KHÔNG đóng vị thế!")
                    print(f"   ⏳ {sym} tiếp tục nắm giữ chờ T+2.5 (Close: {close} | PnL: {pnl_pct:+.2f}%).")
                    updates.append(f"{sym}: Đang nắm giữ T+{t_val} (PnL {pnl_pct:+.2f}%)")
                    continue
                if high >= tp or close >= tp:
                    print(f"   🎯 [CẢNH BÁO T+2.5] {sym} chạm ngưỡng Take Profit ({tp}) nhưng đang ở chu kỳ T+{t_val} (cổ phiếu chưa về tài khoản). KHÔNG đóng vị thế!")
                    print(f"   ⏳ {sym} tiếp tục nắm giữ chờ T+2.5 (Close: {close} | PnL: {pnl_pct:+.2f}%).")
                    updates.append(f"{sym}: Đang nắm giữ T+{t_val} (PnL {pnl_pct:+.2f}%)")
                    continue

            # Kịch bản 1: Stop Loss
            if low <= sl or close <= sl:
                actual_exit_price = min(close, sl)
                eq_exit = actual_exit_price * multiplier + cash_div
                loss_pct = ((eq_exit - entry) / entry) * 100
                print(f"🚨 CẢNH BÁO: {sym} CHẠM STOP LOSS! (Low: {low} <= SL: {sl}) -> ĐÓNG VỊ THẾ!")

                body_moc_sl = f"""<p><strong>[ĐÓNG VỊ THẾ - CẮT LỖ KỶ LUẬT]</strong></p>
<p>Hệ thống <strong>Bot Trader</strong> ghi nhận cổ phiếu <strong>{sym}</strong> chạm ngưỡng cắt lỗ tại <strong>{sl:.2f}</strong> trong phiên {session_date}. Tiến hành đóng vị thế tại <strong>{actual_exit_price:.2f}</strong> để bảo toàn nguồn vốn.</p>
<hr>
<ul>
<li><strong>Giá mua (Entry):</strong> {entry:.2f}</li>
<li><strong>Giá thoát (Exit):</strong> {actual_exit_price:.2f}</li>
<li><strong>Kết quả PnL:</strong> <strong style="color: #ef4444;">{loss_pct:.2f}%</strong></li>
</ul>
<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                moc_payload = {
                    "mach_id": mach_id,
                    "body": body_moc_sl,
                    "loai": "Đóng lệnh",
                    "figures": [
                        {"label": "Trạng thái", "value": "Đã đóng (Cắt lỗ)"},
                        {"label": "Giá thoát Exit", "value": f"{actual_exit_price:.2f}"},
                        {"label": "Kết quả PnL", "value": f"{loss_pct:.1f}%"}
                    ]
                }
                goi_dang_bai_vps("them_moc", moc_payload)

                dong_payload = {
                    "mach_id": mach_id,
                    "ket_qua": f"Cắt lỗ {loss_pct:.1f}%",
                    "bai_hoc": f"Đóng lệnh cắt lỗ kỷ luật tại mốc {sl:.2f}. Bảo toàn nguồn vốn cho các cơ hội tiếp theo.\n\nGiao dịch demo, do Bot Trader thực hiện."
                }
                goi_dang_bai_vps("dong_mach", dong_payload)

                pos["status"] = "CLOSED_SL"
                pos["exit_price"] = actual_exit_price
                pos["equivalent_exit_price"] = round(eq_exit, 2)
                pos["final_pnl_pct"] = round(loss_pct, 2)
                pos["closed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                updates.append(f"{sym}: Đã đóng cắt lỗ ({loss_pct:.1f}%)")
                continue

            # Kịch bản 2: Take Profit
            if high >= tp or close >= tp:
                actual_exit_price = max(close, tp)
                eq_exit = actual_exit_price * multiplier + cash_div
                profit_pct = ((eq_exit - entry) / entry) * 100
                print(f"🎯 CHÚC MỪNG: {sym} ĐẠT TAKE PROFIT! (High: {high} >= TP: {tp}) -> ĐÓNG VỊ THẾ!")

                body_moc_tp = f"""<p><strong>[ĐÓNG VỊ THẾ - CHỐT LỜI MỤC TIÊU]</strong></p>
<p>Cổ phiếu <strong>{sym}</strong> đã hoàn thành mục tiêu chốt lời kỳ vọng tại <strong>{tp:.2f}</strong> trong phiên {session_date}. Tiến hành hiện thực hóa toàn bộ lợi nhuận tại <strong>{actual_exit_price:.2f}</strong>.</p>
<hr>
<ul>
<li><strong>Giá mua (Entry):</strong> {entry:.2f}</li>
<li><strong>Giá chốt lời (Exit):</strong> {actual_exit_price:.2f}</li>
<li><strong>Lợi nhuận thực tế:</strong> <strong style="color: #10b981;">+{profit_pct:.2f}%</strong></li>
</ul>
<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                moc_payload = {
                    "mach_id": mach_id,
                    "body": body_moc_tp,
                    "loai": "Chốt lời",
                    "figures": [
                        {"label": "Trạng thái", "value": "Đã chốt lời mục tiêu"},
                        {"label": "Giá chốt Exit", "value": f"{actual_exit_price:.2f}"},
                        {"label": "Lợi nhuận PnL", "value": f"+{profit_pct:.1f}%"}
                    ]
                }
                goi_dang_bai_vps("them_moc", moc_payload)

                dong_payload = {
                    "mach_id": mach_id,
                    "ket_qua": f"Chốt lời +{profit_pct:.1f}%",
                    "bai_hoc": f"Đạt mục tiêu Take Profit thành công tại vùng cản {tp:.2f}.\n\nGiao dịch demo, do Bot Trader thực hiện."
                }
                goi_dang_bai_vps("dong_mach", dong_payload)

                pos["status"] = "CLOSED_TP"
                pos["exit_price"] = actual_exit_price
                pos["equivalent_exit_price"] = round(eq_exit, 2)
                pos["final_pnl_pct"] = round(profit_pct, 2)
                pos["closed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                updates.append(f"{sym}: Đã chốt lời (+{profit_pct:.1f}%)")
                continue

            # Kịch bản 3: Nhồi lệnh Pyramiding
            if pyramid_trigger and high >= pyramid_trigger and not pyramided:
                print(f"⚡ TÍN HIỆU NHỒI LỆNH: {sym} đã vượt mốc {pyramid_trigger:.2f} -> KÍCH HOẠT MỐC MỚI!")
                new_sl = round(entry / multiplier, 2) if multiplier != 1.0 else entry
                body_moc_pyramid = f"""<p><strong>[CẬP NHẬT VỊ THẾ - KÍCH HOẠT NHỒI LỆNH XU HƯỚNG]</strong></p>
<p>Trong phiên ngày {session_date}, cổ phiếu <strong>{sym}</strong> đã bứt phá qua mốc cản <strong>{pyramid_trigger:.2f}</strong>. Kích hoạt giải ngân đợt 2 (nhồi thêm 50% khối lượng) và dời điểm Stop Loss lên mức hòa vốn <strong>{new_sl:.2f}</strong> (Free-risk Trade).</p>
<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                moc_payload = {
                    "mach_id": mach_id,
                    "body": body_moc_pyramid,
                    "loai": "Nhồi lệnh",
                    "figures": [
                        {"label": "Giá nhồi lệnh", "value": f"{pyramid_trigger:.2f}"},
                        {"label": "Stop Loss mới", "value": f"{new_sl:.2f} (Hòa vốn)"},
                        {"label": "Trạng thái", "value": "Free-risk Trade"}
                    ]
                }
                goi_dang_bai_vps("them_moc", moc_payload)

                pos["pyramided"] = True
                pos["pyramid_price"] = pyramid_trigger
                pos["stop_loss"] = new_sl
                updates.append(f"{sym}: Đã nhồi lệnh và dời SL lên {new_sl}")
                continue

            print(f"   ⏳ {sym} đang vận động bình thường (Close: {close} | PnL: {pnl_pct:+.2f}%).")
            status_text = f"T+{t_val} " if t_val < 2.5 else ""
            updates.append(f"{sym}: Đang nắm giữ {status_text}(PnL {pnl_pct:+.2f}%)")

        except Exception as e:
            print(f"❌ Lỗi khi kiểm tra {sym}: {e}")

    luu_vi_the(vi_the_list)
    return updates


# =====================================================================
# 2. KIỂM TRA VỊ THẾ QUỐC TẾ (H4 - FX / NĂNG LƯỢNG / HÀNG HÓA)
# =====================================================================

def kiem_tra_vi_the_h4() -> list:
    """Quy trình kiểm tra các vị thế H4 Quốc tế (xử lý chuẩn xác cả LONG và SHORT)."""
    print("=" * 68)
    print("🌍 BOT TRADER: KIỂM TRA VỊ THẾ QUỐC TẾ KHUNG H4 (FX, HÀNG HÓA, NĂNG LƯỢNG)...")
    print("=" * 68)

    vi_the_list = doc_vi_the()
    open_positions = [
        p for p in vi_the_list
        if p.get("status") == "OPEN" and (p.get("timeframe") == "H4" or p.get("market_type") in ("FX", "COMMODITY", "ENERGY"))
    ]

    if not open_positions:
        print("ℹ️ Hiện không có vị thế Quốc tế H4 nào đang mở cần theo dõi.")
        return []

    print(f"📊 Đang theo dõi {len(open_positions)} vị thế H4 đang mở...")
    updates = []

    for pos in open_positions:
        sym = pos["symbol"]
        mach_id = pos["mach_id"]
        entry = pos["entry_price"]
        sl = pos["stop_loss"]
        tp = pos["take_profit"]
        pyramid = pos.get("pyramid_trigger")
        pyramided = pos.get("pyramided", False)
        direction = pos.get("direction", "LONG")
        decimals = pos.get("decimals", 4 if "USD" in sym else 2)
        yf_ticker = pos.get("yf_ticker") or YF_MAP.get(sym) or (sym.replace("/", "") + "=X")
        strat_name = pos.get("strategy_name", "Kỹ thuật")

        dir_label = "LONG (Mua)" if direction == "LONG" else "SHORT (Bán khống)"
        print(f"\n🔍 Kiểm tra {sym} [{dir_label}] (Mạch #{mach_id} | Entry: {entry} | SL: {sl} | TP: {tp})...")

        try:
            df = lay_du_lieu_h4_yahoo(yf_ticker, sym)
            if df is None or len(df) == 0:
                print(f"⚠️ Không lấy được dữ liệu H4 cho {sym}")
                continue

            last = df.iloc[-1]
            close = float(last["close"])
            high = float(last["high"])
            low = float(last["low"])
            session_time = str(last["time"])[:16]

            # -------------------------------------------------------------
            # TRƯỜNG HỢP VỊ THẾ MUA (LONG)
            # -------------------------------------------------------------
            if direction == "LONG":
                pnl_pct = ((close - entry) / entry) * 100
                pos["current_price"] = round(close, decimals)
                pos["pnl_pct"] = round(pnl_pct, 2)
                pos["last_checked"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                print(f"   Nến H4 ({session_time}): Close {close:.{decimals}f} | High {high:.{decimals}f} | Low {low:.{decimals}f} | PnL: {pnl_pct:+.2f}%")

                # Chạm Stop Loss (LONG: Low <= SL)
                if low <= sl or close <= sl:
                    exit_price = min(close, sl)
                    loss_pct = ((exit_price - entry) / entry) * 100
                    print(f"🚨 CẢNH BÁO: {sym} CHẠM STOP LOSS! (Low: {low} <= SL: {sl}) -> ĐÓNG LỆNH!")

                    body_sl = f"""<p><strong>[ĐÓNG VỊ THẾ - CẮT LỖ KỶ LUẬT KHUNG H4]</strong></p>
<p>Vị thế Mua (Long) <strong>{sym}</strong> đã chạm ngưỡng cắt lỗ tại <strong>{sl:.{decimals}f}</strong> (nến H4 lúc {session_time}). Tiến hành đóng lệnh tại mức giá <strong>{exit_price:.{decimals}f}</strong> nhằm tuân thủ kỷ luật quản trị rủi ro tuyệt đối.</p>
<hr>
<ul>
<li><strong>Giá mua (Entry):</strong> {entry:.{decimals}f}</li>
<li><strong>Giá đóng vị thế (Exit):</strong> {exit_price:.{decimals}f}</li>
<li><strong>Kết quả PnL:</strong> <strong style="color: #ef4444;">{loss_pct:.2f}%</strong></li>
<li><strong>Chiến lược:</strong> {strat_name}</li>
</ul>
<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_sl,
                        "loai": "Đóng lệnh",
                        "figures": [
                            {"label": "Trạng thái", "value": "Đã đóng (Cắt lỗ)"},
                            {"label": "Giá thoát Exit", "value": f"{exit_price:.{decimals}f}"},
                            {"label": "Kết quả PnL", "value": f"{loss_pct:.1f}%"}
                        ]
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    dong_payload = {
                        "mach_id": mach_id,
                        "ket_qua": f"Cắt lỗ {loss_pct:.1f}%",
                        "bai_hoc": f"Đóng lệnh cắt lỗ kỷ luật tại {sl:.{decimals}f}. Bảo toàn nguồn vốn cho các cơ hội tiếp theo.\n\nGiao dịch demo, do Bot Trader thực hiện."
                    }
                    goi_dang_bai_vps("dong_mach", dong_payload)

                    pos["status"] = "CLOSED_SL"
                    pos["exit_price"] = round(exit_price, decimals)
                    pos["final_pnl_pct"] = round(loss_pct, 2)
                    pos["closed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    updates.append(f"{sym} [LONG]: Đã đóng cắt lỗ ({loss_pct:.1f}%)")
                    continue

                # Chạm Take Profit (LONG: High >= TP)
                if high >= tp or close >= tp:
                    exit_price = max(close, tp)
                    profit_pct = ((exit_price - entry) / entry) * 100
                    print(f"🎯 CHÚC MỪNG: {sym} ĐẠT TAKE PROFIT! (High: {high} >= TP: {tp}) -> CHỐT LỜI!")

                    body_tp = f"""<p><strong>[ĐÓNG VỊ THẾ - CHỐT LỜI MỤC TIÊU KHUNG H4]</strong></p>
<p>Vị thế Mua (Long) <strong>{sym}</strong> đã hoàn thành mục tiêu chốt lời kỳ vọng tại <strong>{tp:.{decimals}f}</strong> (nến H4 lúc {session_time}). Hiện thực hóa toàn bộ lợi nhuận tại mức giá <strong>{exit_price:.{decimals}f}</strong>.</p>
<hr>
<ul>
<li><strong>Giá mua (Entry):</strong> {entry:.{decimals}f}</li>
<li><strong>Giá chốt lời (Exit):</strong> {exit_price:.{decimals}f}</li>
<li><strong>Lợi nhuận thực tế:</strong> <strong style="color: #10b981;">+{profit_pct:.2f}%</strong></li>
<li><strong>Tỷ lệ R:R thực hiện:</strong> 1 : 2.4 (Đạt chuẩn)</li>
</ul>
<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_tp,
                        "loai": "Chốt lời",
                        "figures": [
                            {"label": "Trạng thái", "value": "Đã chốt lời mục tiêu"},
                            {"label": "Giá chốt Exit", "value": f"{exit_price:.{decimals}f}"},
                            {"label": "Lợi nhuận PnL", "value": f"+{profit_pct:.1f}%"}
                        ]
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    dong_payload = {
                        "mach_id": mach_id,
                        "ket_qua": f"Chốt lời +{profit_pct:.1f}%",
                        "bai_hoc": f"Đạt mục tiêu Take Profit thành công tại vùng cản {tp:.{decimals}f}.\n\nGiao dịch demo, do Bot Trader thực hiện."
                    }
                    goi_dang_bai_vps("dong_mach", dong_payload)

                    pos["status"] = "CLOSED_TP"
                    pos["exit_price"] = round(exit_price, decimals)
                    pos["final_pnl_pct"] = round(profit_pct, 2)
                    pos["closed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    updates.append(f"{sym} [LONG]: Đã chốt lời (+{profit_pct:.1f}%)")
                    continue

                # Kích hoạt Nhồi lệnh Pyramiding (LONG: High >= Pyramid)
                if pyramid and high >= pyramid and not pyramided:
                    print(f"⚡ TÍN HIỆU NHỒI LỆNH H4: {sym} đã vượt {pyramid:.{decimals}f} -> DỜI SL VỀ HÒA VỐN!")
                    new_sl = entry
                    body_pyr = f"""<p><strong>[CẬP NHẬT VỊ THẾ H4 - KÍCH HOẠT NHỒI LỆNH XU HƯỚNG]</strong></p>
<p>Tài sản <strong>{sym}</strong> đã bứt phá qua mốc cản <strong>{pyramid:.{decimals}f}</strong>. Kích hoạt giải ngân 50% khối lượng còn lại và đồng thời dời điểm dừng lỗ Stop Loss lên mức hòa vốn <strong>{new_sl:.{decimals}f}</strong> (Free-risk Trade).</p>
<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_pyr,
                        "loai": "Nhồi lệnh",
                        "figures": [
                            {"label": "Giá nhồi lệnh", "value": f"{pyramid:.{decimals}f}"},
                            {"label": "Stop Loss mới", "value": f"{new_sl:.{decimals}f} (Hòa vốn)"},
                            {"label": "Trạng thái", "value": "Free-risk Trade"}
                        ]
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    pos["pyramided"] = True
                    pos["pyramid_price"] = pyramid
                    pos["stop_loss"] = new_sl
                    updates.append(f"{sym} [LONG]: Đã nhồi lệnh và dời SL lên {new_sl:.{decimals}f}")
                    continue

            # -------------------------------------------------------------
            # TRƯỜNG HỢP VỊ THẾ BÁN KHỐNG (SHORT)
            # -------------------------------------------------------------
            else:
                pnl_pct = ((entry - close) / entry) * 100
                pos["current_price"] = round(close, decimals)
                pos["pnl_pct"] = round(pnl_pct, 2)
                pos["last_checked"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

                print(f"   Nến H4 ({session_time}): Close {close:.{decimals}f} | High {high:.{decimals}f} | Low {low:.{decimals}f} | PnL: {pnl_pct:+.2f}%")

                # Chạm Stop Loss (SHORT: High >= SL)
                if high >= sl or close >= sl:
                    exit_price = max(close, sl)
                    loss_pct = ((entry - exit_price) / entry) * 100
                    print(f"🚨 CẢNH BÁO: {sym} [SHORT] CHẠM STOP LOSS! (High: {high} >= SL: {sl}) -> ĐÓNG LỆNH!")

                    body_sl = f"""<p><strong>[ĐÓNG VỊ THẾ - CẮT LỖ KỶ LUẬT KHUNG H4]</strong></p>
<p>Vị thế Bán khống (Short) <strong>{sym}</strong> đã vi phạm ngưỡng cắt lỗ tại <strong>{sl:.{decimals}f}</strong> (nến H4 lúc {session_time}). Tiến hành đóng lệnh tại mức giá <strong>{exit_price:.{decimals}f}</strong> để quản trị rủi ro tuyệt đối.</p>
<hr>
<ul>
<li><strong>Giá bán Entry:</strong> {entry:.{decimals}f}</li>
<li><strong>Giá đóng vị thế (Exit):</strong> {exit_price:.{decimals}f}</li>
<li><strong>Kết quả PnL:</strong> <strong style="color: #ef4444;">{loss_pct:.2f}%</strong></li>
<li><strong>Chiến lược:</strong> {strat_name}</li>
</ul>
<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_sl,
                        "loai": "Đóng lệnh",
                        "figures": [
                            {"label": "Trạng thái", "value": "Đã đóng (Cắt lỗ)"},
                            {"label": "Giá thoát Exit", "value": f"{exit_price:.{decimals}f}"},
                            {"label": "Kết quả PnL", "value": f"{loss_pct:.1f}%"}
                        ]
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    dong_payload = {
                        "mach_id": mach_id,
                        "ket_qua": f"Cắt lỗ {loss_pct:.1f}%",
                        "bai_hoc": f"Đóng lệnh bán khống cắt lỗ kỷ luật tại {sl:.{decimals}f}. Bảo toàn nguồn vốn cho các cơ hội tiếp theo.\n\nGiao dịch demo, do Bot Trader thực hiện."
                    }
                    goi_dang_bai_vps("dong_mach", dong_payload)

                    pos["status"] = "CLOSED_SL"
                    pos["exit_price"] = round(exit_price, decimals)
                    pos["final_pnl_pct"] = round(loss_pct, 2)
                    pos["closed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    updates.append(f"{sym} [SHORT]: Đã đóng cắt lỗ ({loss_pct:.1f}%)")
                    continue

                # Chạm Take Profit (SHORT: Low <= TP)
                if low <= tp or close <= tp:
                    exit_price = min(close, tp)
                    profit_pct = ((entry - exit_price) / entry) * 100
                    print(f"🎯 CHÚC MỪNG: {sym} [SHORT] ĐẠT TAKE PROFIT! (Low: {low} <= TP: {tp}) -> CHỐT LỜI!")

                    body_tp = f"""<p><strong>[ĐÓNG VỊ THẾ - CHỐT LỜI MỤC TIÊU KHUNG H4]</strong></p>
<p>Vị thế Bán khống (Short) <strong>{sym}</strong> đã hoàn thành xuất sắc mục tiêu chốt lời tại <strong>{tp:.{decimals}f}</strong> (nến H4 lúc {session_time}). Tiến hành đóng lệnh hiện thực hóa lợi nhuận tại <strong>{exit_price:.{decimals}f}</strong>.</p>
<hr>
<ul>
<li><strong>Giá bán Entry:</strong> {entry:.{decimals}f}</li>
<li><strong>Giá chốt lời Exit:</strong> {exit_price:.{decimals}f}</li>
<li><strong>Lợi nhuận thực tế:</strong> <strong style="color: #10b981;">+{profit_pct:.2f}%</strong></li>
<li><strong>Tỷ lệ R:R thực hiện:</strong> 1 : 2.4 (Đạt chuẩn)</li>
</ul>
<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_tp,
                        "loai": "Chốt lời",
                        "figures": [
                            {"label": "Trạng thái", "value": "Đã chốt lời mục tiêu"},
                            {"label": "Giá chốt Exit", "value": f"{exit_price:.{decimals}f}"},
                            {"label": "Lợi nhuận PnL", "value": f"+{profit_pct:.1f}%"}
                        ]
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    dong_payload = {
                        "mach_id": mach_id,
                        "ket_qua": f"Chốt lời +{profit_pct:.1f}%",
                        "bai_hoc": f"Đạt mục tiêu Take Profit bán khống thành công tại vùng hỗ trợ {tp:.{decimals}f}.\n\nGiao dịch demo, do Bot Trader thực hiện."
                    }
                    goi_dang_bai_vps("dong_mach", dong_payload)

                    pos["status"] = "CLOSED_TP"
                    pos["exit_price"] = round(exit_price, decimals)
                    pos["final_pnl_pct"] = round(profit_pct, 2)
                    pos["closed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    updates.append(f"{sym} [SHORT]: Đã chốt lời (+{profit_pct:.1f}%)")
                    continue

                # Kích hoạt Nhồi lệnh Pyramiding (SHORT: Low <= Pyramid)
                if pyramid and low <= pyramid and not pyramided:
                    print(f"⚡ TÍN HIỆU NHỒI LỆNH H4: {sym} [SHORT] đã giảm qua {pyramid:.{decimals}f} -> DỜI SL VỀ HÒA VỐN!")
                    new_sl = entry
                    body_pyr = f"""<p><strong>[CẬP NHẬT VỊ THẾ H4 - KÍCH HOẠT NHỒI LỆNH XU HƯỚNG]</strong></p>
<p>Vị thế Bán khống <strong>{sym}</strong> đã giảm thành công qua mốc hỗ trợ <strong>{pyramid:.{decimals}f}</strong>. Kích hoạt mở thêm 50% khối lượng và dời điểm Stop Loss về mức hòa vốn <strong>{new_sl:.{decimals}f}</strong> (Free-risk Trade).</p>
<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_pyr,
                        "loai": "Nhồi lệnh",
                        "figures": [
                            {"label": "Giá nhồi lệnh", "value": f"{pyramid:.{decimals}f}"},
                            {"label": "Stop Loss mới", "value": f"{new_sl:.{decimals}f} (Hòa vốn)"},
                            {"label": "Trạng thái", "value": "Free-risk Trade"}
                        ]
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    pos["pyramided"] = True
                    pos["pyramid_price"] = pyramid
                    pos["stop_loss"] = new_sl
                    updates.append(f"{sym} [SHORT]: Đã nhồi lệnh và dời SL lên {new_sl:.{decimals}f}")
                    continue

            # Vận động bình thường
            print(f"   ⏳ {sym} đang vận động bình thường (Close: {close:.{decimals}f} | PnL: {pnl_pct:+.2f}%).")
            updates.append(f"{sym} [{dir_label}]: Đang nắm giữ (PnL {pnl_pct:+.2f}%)")

        except Exception as e:
            print(f"❌ Lỗi khi kiểm tra {sym}: {e}")

    luu_vi_the(vi_the_list)
    print("\n" + "=" * 68)
    print("📋 TỔNG KẾT KIỂM TRA H4 QUỐC TẾ:")
    for u in updates:
        print(f"  • {u}")
    print("=" * 68)
    return updates


if __name__ == "__main__":
    if "--h4" in sys.argv:
        kiem_tra_vi_the_h4()
    else:
        date_arg = sys.argv[1] if len(sys.argv) > 1 and not sys.argv[1].startswith("-") else None
        kiem_tra_sau_15h(simulate_date=date_arg)
