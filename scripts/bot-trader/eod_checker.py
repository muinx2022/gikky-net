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
# CÁC HÀM XÂY DỰNG MỐC & BÀI HỌC ĐÓNG SỔ THEO CHUẨN NHẬT KÝ V2
# =====================================================================

def tao_noi_dung_moc_pyramid(
    sym: str,
    entry: float,
    pyramid_trigger: float,
    new_sl: float,
    session_date: str,
    timeframe: str = "D1",
    direction: str = "LONG",
    decimals: int = 2
) -> tuple[str, list]:
    """Tạo nội dung mốc nhồi lệnh Pyramiding theo chuẩn Nhật ký v2."""
    dir_label = "Mua (Long)" if direction == "LONG" else "Bán khống (Short)"
    action_verb = "vượt mốc cản" if direction == "LONG" else "giảm xuyên mốc hỗ trợ"

    body = f"""<p><strong>[Nhật ký mốc 2] Kích hoạt nhồi lệnh &amp; Chuyển trạng thái Vị thế không rủi ro (Free-risk Trade)</strong></p>

<p>Trong phiên giao dịch ngày <strong>{session_date}</strong> (khung <strong>{timeframe}</strong>), hành động giá của <strong>{sym}</strong> đã phát triển hoàn toàn đúng theo kịch bản kỳ vọng, {action_verb} <strong>{pyramid_trigger:.{decimals}f}</strong> với xung lực áp đảo. Theo nguyên tắc quản trị vị thế xu hướng (Trend Following), hệ thống thực hiện giải ngân gia tăng 50% khối lượng còn lại.</p>

<p>Đồng thời, toàn bộ vị thế được bảo vệ bằng cách <strong>dời mốc Stop Loss về mức giá hòa vốn ({new_sl:.{decimals}f})</strong>. Hành động này chuyển toàn bộ giao dịch sang trạng thái <strong>Free-risk Trade</strong>: kịch bản xấu nhất xảy ra chỉ khiến lệnh dừng lại ở mức hòa vốn, trong khi tiềm năng lợi nhuận tiếp tục được mở rộng tối đa theo sóng xu hướng.</p>

<hr>
<ul>
<li><strong>Vị thế:</strong> {dir_label} gia tăng 50% khối lượng tại <strong>{pyramid_trigger:.{decimals}f}</strong></li>
<li><strong>Stop Loss mới:</strong> <strong>{new_sl:.{decimals}f}</strong> (Bảo toàn vốn tuyệt đối)</li>
<li><strong>Trạng thái giao dịch:</strong> <strong>Free-risk Trade (Không rủi ro)</strong></li>
</ul>

<hr>
<p><em>* Ghi chú nhật ký: Giao dịch demo do Bot Trader thực hiện theo quy chuẩn quản trị vị thế v2.</em></p>"""

    figures = [
        {"label": "Giá nhồi lệnh", "value": f"{pyramid_trigger:.{decimals}f}"[:24]},
        {"label": "Stop Loss mới", "value": f"{new_sl:.{decimals}f} (Hòa vốn)"[:24]},
        {"label": "Trạng thái", "value": "Free-risk Trade"[:24]}
    ]
    return body, figures


def tao_noi_dung_moc_sl(
    sym: str,
    entry: float,
    exit_price: float,
    sl: float,
    loss_pct: float,
    session_date: str,
    timeframe: str = "D1",
    direction: str = "LONG",
    strat_name: str = "Chiến lược kỹ thuật",
    decimals: int = 2
) -> tuple[str, list, str]:
    """Tạo nội dung mốc cắt lỗ kỷ luật và bài học đóng sổ (Post-Mortem Review) theo chuẩn Nhật ký v2."""
    dir_label = "Mua (Long)" if direction == "LONG" else "Bán khống (Short)"
    is_vn = (timeframe == "D1")

    if is_vn:
        root_cause = "Thị trường chung VN-Index rung lắc điều chỉnh, áp lực bán gia tăng bất ngờ tạo bẫy giá (fakeout) ngắn hạn khiến nến đóng cửa xuyên thủng ngưỡng hỗ trợ then chốt."
        root_cause_short = "Thị trường chung rung lắc và fakeout ngắn hạn làm gãy ngưỡng hỗ trợ kỹ thuật then chốt."
    elif direction == "LONG":
        root_cause = "Chỉ số DXY bất ngờ hồi phục mạnh mẽ hoặc tâm lý Risk-Off lan rộng trên thị trường quốc tế, kích hoạt áp lực bán tháo khiến nến H4 gãy mốc phòng thủ."
        root_cause_short = "Đồng USD đảo chiều tăng mạnh tạo áp lực bán tháo khiến nến H4 vi phạm mốc phòng thủ."
    else:  # SHORT H4
        root_cause = "Dòng tiền bắt đáy đảo chiều mạnh mẽ hoặc yếu tố vĩ mô bất ngờ nâng đỡ giá, phe mua chiếm ưu thế đẩy nến H4 vượt qua mốc cản cắt lỗ."
        root_cause_short = "Lực cầu bắt đáy đảo chiều gia tăng đẩy giá bứt phá qua mốc cản cắt lỗ."

    body = f"""<p><strong>[Nhật ký đóng sổ] Cắt lỗ kỷ luật &amp; Báo cáo phân tích sau giao dịch (Post-Mortem Review)</strong></p>

<p>Phiên giao dịch ngày <strong>{session_date}</strong> (khung <strong>{timeframe}</strong>): Vị thế {dir_label} <strong>{sym}</strong> đã chạm mốc phòng thủ tại <strong>{sl:.{decimals}f}</strong>. Hệ thống thực hiện thanh lý vị thế dứt khoát tại <strong>{exit_price:.{decimals}f}</strong> (PnL: <strong style="color: #ef4444;">{loss_pct:.2f}%</strong>).</p>

<hr>

<p><strong>Báo cáo mổ xẻ sau giao dịch (Post-Mortem Review):</strong></p>

<ul>
<li><strong>Nguyên nhân chạm Stop Loss:</strong> {root_cause}</li>
<li><strong>Kỷ luật quản trị rủi ro:</strong> Không do dự hay nuôi hy vọng vô căn cứ. Quyết định cắt lỗ được thực hiện dứt khoát ngay khi vi phạm mốc phòng thủ giúp bảo toàn nguyên vẹn 95%+ nguồn vốn danh mục, ngăn ngừa rủi ro trượt giá hoặc rơi vào các nhịp giảm sâu bất ngờ.</li>
<li><strong>Kinh nghiệm rút ra:</strong> Nâng cao tiêu chí kiểm định độ nén biến động trước khi bứt phá; kiên nhẫn quan sát sự đồng thuận của dòng tiền nhóm ngành và bối cảnh liên thị trường trong các lần quét tiếp theo.</li>
</ul>

<hr>
<ul>
<li><strong>Giá mở vị thế (Entry):</strong> {entry:.{decimals}f}</li>
<li><strong>Giá thoát lệnh (Exit):</strong> {exit_price:.{decimals}f}</li>
<li><strong>Kết quả PnL:</strong> <strong style="color: #ef4444;">{loss_pct:.2f}%</strong></li>
<li><strong>Chiến lược áp dụng:</strong> {strat_name}</li>
</ul>

<hr>
<p><em>* Ghi chú nhật ký: Giao dịch demo do Bot Trader thực hiện theo quy chuẩn quản trị vị thế v2.</em></p>"""

    figures = [
        {"label": "Trạng thái", "value": "Đã đóng (Cắt lỗ)"[:24]},
        {"label": "Giá thoát Exit", "value": f"{exit_price:.{decimals}f}"[:24]},
        {"label": "Kết quả PnL", "value": f"{loss_pct:.1f}%"[:24]}
    ]

    bai_hoc = (
        f"Báo cáo đóng sổ vị thế {sym} (Cắt lỗ {loss_pct:.1f}%):\n"
        f"- Mổ xẻ nguyên nhân: {root_cause_short}\n"
        f"- Kỷ luật quản trị vốn: Cắt lỗ dứt khoát tại mốc {sl:.{decimals}f} là nguyên tắc sống còn, bảo vệ trọn vẹn hơn 95% vốn để sẵn sàng phân bổ cho các cơ hội xác suất cao tiếp theo.\n"
        f"- Kinh nghiệm thực chiến: Nâng cao tiêu chí chọn lọc độ nén biến động và kiên nhẫn đứng ngoài khi dòng tiền chưa có sự đồng thuận cao.\n\n"
        f"Giao dịch demo, do Bot Trader thực hiện."
    )

    return body, figures, bai_hoc


def tao_noi_dung_moc_tp(
    sym: str,
    entry: float,
    exit_price: float,
    tp: float,
    profit_pct: float,
    session_date: str,
    timeframe: str = "D1",
    direction: str = "LONG",
    strat_name: str = "Chiến lược kỹ thuật",
    rr: float = 2.4,
    decimals: int = 2
) -> tuple[str, list, str]:
    """Tạo nội dung mốc chốt lời mục tiêu và bài học đóng sổ (Execution Review) theo chuẩn Nhật ký v2."""
    dir_label = "Mua (Long)" if direction == "LONG" else "Bán khống (Short)"

    body = f"""<p><strong>[Nhật ký đóng sổ] Chốt lời mục tiêu &amp; Đánh giá hiệu quả thực thi (Execution Review)</strong></p>

<p>Phiên giao dịch ngày <strong>{session_date}</strong> (khung <strong>{timeframe}</strong>): Vị thế {dir_label} <strong>{sym}</strong> đã hoàn thành xuất sắc mục tiêu lợi nhuận kỳ vọng tại <strong>{tp:.{decimals}f}</strong>. Hệ thống hiện thực hóa toàn bộ lợi nhuận tại <strong>{exit_price:.{decimals}f}</strong> (PnL: <strong style="color: #10b981;">+{profit_pct:.2f}%</strong>, R:R thực hiện: <strong>1 : {rr:.2f}</strong>).</p>

<hr>

<p><strong>Đánh giá các yếu tố thành công:</strong></p>

<ul>
<li><strong>Phân tích bối cảnh chuẩn xác:</strong> Chọn đúng tài sản có sức mạnh giá tương đối vượt trội, nhận được sự đồng thuận mạnh mẽ của dòng tiền và xu hướng thị trường chung.</li>
<li><strong>Tín hiệu kích hoạt tin cậy:</strong> Thiết lập kỹ thuật {strat_name} cung cấp điểm tựa vững chắc, kiểm định lực cung thành công trước khi bứt tốc mạnh mẽ.</li>
<li><strong>Tâm lý kiên định gồng lãi:</strong> Tuân thủ trọn vẹn kế hoạch toán học, kiên định nắm giữ vị thế vượt qua các nhịp rung lắc ngắn hạn để chạm đúng vùng kháng cự mục tiêu, tuyệt đối không chốt non.</li>
</ul>

<hr>
<ul>
<li><strong>Giá mở vị thế (Entry):</strong> {entry:.{decimals}f}</li>
<li><strong>Giá chốt lời (Exit):</strong> {exit_price:.{decimals}f}</li>
<li><strong>Lợi nhuận thực tế:</strong> <strong style="color: #10b981;">+{profit_pct:.2f}%</strong></li>
<li><strong>Tỷ lệ R:R đạt được:</strong> 1 : {rr:.2f} (Đạt chuẩn xác suất cao)</li>
</ul>

<hr>
<p><em>* Ghi chú nhật ký: Giao dịch demo do Bot Trader thực hiện theo quy chuẩn quản trị vị thế v2.</em></p>"""

    figures = [
        {"label": "Trạng thái", "value": "Đã chốt lời mục tiêu"[:24]},
        {"label": "Giá chốt Exit", "value": f"{exit_price:.{decimals}f}"[:24]},
        {"label": "Lợi nhuận PnL", "value": f"+{profit_pct:.1f}%"[:24]}
    ]

    bai_hoc = (
        f"Báo cáo đóng sổ vị thế {sym} (Chốt lời +{profit_pct:.1f}%):\n"
        f"- Yếu tố thành công: Phân tích bối cảnh chuẩn xác, chọn đúng thời điểm kích hoạt sóng với sự bảo trợ của dòng tiền và các đường xu hướng.\n"
        f"- Kỷ luật gồng lãi: Kiên định giữ vị thế đến mục tiêu R:R 1:{rr:.1f}, không bị lung lay bởi các nhịp điều chỉnh kỹ thuật ngắn hạn trên đường đi.\n"
        f"- Kinh nghiệm thực chiến: Tiếp tục phát huy nguyên tắc chỉ giải ngân ở những setup có tỷ lệ Risk/Reward vượt trội và bối cảnh đồng thuận.\n\n"
        f"Giao dịch demo, do Bot Trader thực hiện."
    )

    return body, figures, bai_hoc


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

                body_moc_sl, figures_sl, bai_hoc_sl = tao_noi_dung_moc_sl(
                    sym=sym,
                    entry=entry,
                    exit_price=actual_exit_price,
                    sl=sl,
                    loss_pct=loss_pct,
                    session_date=session_date,
                    timeframe="D1",
                    direction="LONG",
                    strat_name=pos.get("strategy_name", "Kỹ thuật D1"),
                    decimals=2
                )

                moc_payload = {
                    "mach_id": mach_id,
                    "body": body_moc_sl,
                    "loai": "Đóng lệnh",
                    "figures": figures_sl
                }
                goi_dang_bai_vps("them_moc", moc_payload)

                dong_payload = {
                    "mach_id": mach_id,
                    "ket_qua": f"Cắt lỗ {loss_pct:.1f}%",
                    "bai_hoc": bai_hoc_sl
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

                body_moc_tp, figures_tp, bai_hoc_tp = tao_noi_dung_moc_tp(
                    sym=sym,
                    entry=entry,
                    exit_price=actual_exit_price,
                    tp=tp,
                    profit_pct=profit_pct,
                    session_date=session_date,
                    timeframe="D1",
                    direction="LONG",
                    strat_name=pos.get("strategy_name", "Kỹ thuật D1"),
                    rr=pos.get("rr_ratio", 2.4),
                    decimals=2
                )

                moc_payload = {
                    "mach_id": mach_id,
                    "body": body_moc_tp,
                    "loai": "Chốt lời",
                    "figures": figures_tp
                }
                goi_dang_bai_vps("them_moc", moc_payload)

                dong_payload = {
                    "mach_id": mach_id,
                    "ket_qua": f"Chốt lời +{profit_pct:.1f}%",
                    "bai_hoc": bai_hoc_tp
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
                body_moc_pyramid, figures_pyr = tao_noi_dung_moc_pyramid(
                    sym=sym,
                    entry=entry,
                    pyramid_trigger=pyramid_trigger,
                    new_sl=new_sl,
                    session_date=session_date,
                    timeframe="D1",
                    direction="LONG",
                    decimals=2
                )

                moc_payload = {
                    "mach_id": mach_id,
                    "body": body_moc_pyramid,
                    "loai": "Nhồi lệnh",
                    "figures": figures_pyr
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

                    body_sl, figures_sl, bai_hoc_sl = tao_noi_dung_moc_sl(
                        sym=sym,
                        entry=entry,
                        exit_price=exit_price,
                        sl=sl,
                        loss_pct=loss_pct,
                        session_date=session_time,
                        timeframe="H4",
                        direction="LONG",
                        strat_name=strat_name,
                        decimals=decimals
                    )

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_sl,
                        "loai": "Đóng lệnh",
                        "figures": figures_sl
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    dong_payload = {
                        "mach_id": mach_id,
                        "ket_qua": f"Cắt lỗ {loss_pct:.1f}%",
                        "bai_hoc": bai_hoc_sl
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

                    body_tp, figures_tp, bai_hoc_tp = tao_noi_dung_moc_tp(
                        sym=sym,
                        entry=entry,
                        exit_price=exit_price,
                        tp=tp,
                        profit_pct=profit_pct,
                        session_date=session_time,
                        timeframe="H4",
                        direction="LONG",
                        strat_name=strat_name,
                        rr=pos.get("rr_ratio", 2.4),
                        decimals=decimals
                    )

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_tp,
                        "loai": "Chốt lời",
                        "figures": figures_tp
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    dong_payload = {
                        "mach_id": mach_id,
                        "ket_qua": f"Chốt lời +{profit_pct:.1f}%",
                        "bai_hoc": bai_hoc_tp
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
                    body_pyr, figures_pyr = tao_noi_dung_moc_pyramid(
                        sym=sym,
                        entry=entry,
                        pyramid_trigger=pyramid,
                        new_sl=new_sl,
                        session_date=session_time,
                        timeframe="H4",
                        direction="LONG",
                        decimals=decimals
                    )

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_pyr,
                        "loai": "Nhồi lệnh",
                        "figures": figures_pyr
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

                    body_sl, figures_sl, bai_hoc_sl = tao_noi_dung_moc_sl(
                        sym=sym,
                        entry=entry,
                        exit_price=exit_price,
                        sl=sl,
                        loss_pct=loss_pct,
                        session_date=session_time,
                        timeframe="H4",
                        direction="SHORT",
                        strat_name=strat_name,
                        decimals=decimals
                    )

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_sl,
                        "loai": "Đóng lệnh",
                        "figures": figures_sl
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    dong_payload = {
                        "mach_id": mach_id,
                        "ket_qua": f"Cắt lỗ {loss_pct:.1f}%",
                        "bai_hoc": bai_hoc_sl
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

                    body_tp, figures_tp, bai_hoc_tp = tao_noi_dung_moc_tp(
                        sym=sym,
                        entry=entry,
                        exit_price=exit_price,
                        tp=tp,
                        profit_pct=profit_pct,
                        session_date=session_time,
                        timeframe="H4",
                        direction="SHORT",
                        strat_name=strat_name,
                        rr=pos.get("rr_ratio", 2.4),
                        decimals=decimals
                    )

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_tp,
                        "loai": "Chốt lời",
                        "figures": figures_tp
                    }
                    goi_dang_bai_vps("them_moc", moc_payload)

                    dong_payload = {
                        "mach_id": mach_id,
                        "ket_qua": f"Chốt lời +{profit_pct:.1f}%",
                        "bai_hoc": bai_hoc_tp
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
                    body_pyr, figures_pyr = tao_noi_dung_moc_pyramid(
                        sym=sym,
                        entry=entry,
                        pyramid_trigger=pyramid,
                        new_sl=new_sl,
                        session_date=session_time,
                        timeframe="H4",
                        direction="SHORT",
                        decimals=decimals
                    )

                    moc_payload = {
                        "mach_id": mach_id,
                        "body": body_pyr,
                        "loai": "Nhồi lệnh",
                        "figures": figures_pyr
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
