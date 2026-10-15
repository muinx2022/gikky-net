# -*- coding: utf-8 -*-
"""Kiểm tra và xử lý vị thế sau 15h hàng ngày (EOD Checker) cho Bot Trader.

Nhiệm vụ:
1. Đọc danh sách các vị thế đang mở (OPEN) trong vi_the_dang_mo.json.
2. Lấy dữ liệu giá đóng cửa phiên hôm nay (Close, High, Low, Volume) qua vnstock.
3. Đối chiếu các kịch bản:
   - Chạm Stop Loss: Thêm mốc cắt lỗ vào mạch, đóng mạch (dong_so), ghi chú thích demo.
   - Chạm Take Profit: Thêm mốc chốt lời vào mạch, đóng mạch (dong_so), ghi chú thích demo.
   - Chạm điểm Nhồi lệnh: Thêm mốc nhồi lệnh mới vào mạch, dời Stop Loss lên hòa vốn.
   - Vận động bình thường: Cập nhật PnL tạm tính và số ngày nắm giữ.
"""

import json
import os
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path
import pandas as pd

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from vnstock import Quote

from dang_bai_bot_trader import thuc_hien_action

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


def kiem_tra_sau_15h(simulate_date: str = None) -> list:
    """Chạy quy trình kiểm tra EOD sau 15h cho tất cả vị thế đang mở."""
    if not simulate_date:
        simulate_date = datetime.now().strftime("%Y-%m-%d")

    print("=" * 65)
    print(f"🕒 BOT TRADER: KIỂM TRA DỮ LIỆU EOD SAU 15H (PHIÊN {simulate_date})...")
    print("=" * 65)

    vi_the_list = doc_vi_the()
    open_positions = [p for p in vi_the_list if p.get("status") == "OPEN"]

    if not open_positions:
        print("ℹ️ Hiện không có vị thế nào đang mở cần theo dõi.")
        return []

    print(f"📊 Đang theo dõi {len(open_positions)} vị thế đang mở...")
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
            vol = float(last["volume"])
            session_date = str(last["time"])[:10]

            # ----------------------------------------------------
            # BƯỚC KIỂM TRA SỰ KIỆN QUYỀN / GDKHQ (CORPORATE ACTION CHECK)
            # ----------------------------------------------------
            if len(df) >= 2:
                prev_row = df.iloc[-2]
                prev_close = float(prev_row["close"])
                curr_open = float(last["open"]) if "open" in last else close

                exchange = pos.get("exchange", "HOSE").upper()
                threshold = 0.91 if exchange == "HOSE" else (0.87 if exchange == "HNX" else 0.82)

                drop_ratio = close / prev_close
                open_drop_ratio = curr_open / prev_close

                last_adj_date = pos.get("corporate_action", {}).get("ex_date")
                # So sánh giá mở cửa hôm nay với đóng cửa hôm trước:
                # Nếu Open thấp hơn sàn tối đa của phiên trước -> Chắc chắn là phiên GDKHQ điều chỉnh giá kỹ thuật
                if (open_drop_ratio < threshold or drop_ratio < threshold) and last_adj_date != session_date:
                    # Hệ số k: Open hôm nay phản ánh trực tiếp giá tham chiếu mới sau điều chỉnh
                    k = round(open_drop_ratio if open_drop_ratio < threshold else drop_ratio, 4)
                    multiplier = round(1.0 / k, 4)
                    vol_increase_pct = round((multiplier - 1.0) * 100, 1)

                    print(f"⚠️ PHÁT HIỆN SỰ KIỆN GDKHQ / CHIA CỔ TỨC: {sym} (Open: {curr_open} vs Prev Close: {prev_close} -> k = {k}, Vol quy đổi x{multiplier})")
                    old_sl = sl
                    old_tp = tp
                    old_pyr = pyramid_trigger

                    # GIỮ NGUYÊN ENTRY GỐC BAN ĐẦU - Chỉ điều chỉnh SL, TP, Pyramid theo mặt bằng giá mới trên sàn
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

                    # Thêm mốc thông báo điều chỉnh thông số vào mạch
                    body_moc_ca = f"""<p><strong>[ĐIỀU CHỈNH THÔNG SỐ VỊ THẾ - NGÀY GIAO DỊCH KHÔNG HƯỞNG QUYỀN]</strong></p>

<p>Hệ thống <strong>Bot Trader</strong> ghi nhận trong phiên giao dịch ngày <strong>{session_date}</strong>, cổ phiếu <strong>{sym}</strong> có sự kiện <strong>Ngày Giao Dịch Không Hưởng Quyền (GDKHQ)</strong> để thực hiện quyền nhận cổ tức / cổ phiếu thưởng (hệ số điều chỉnh kỹ thuật của sàn <strong>k ≈ {k:.4f}</strong>).</p>

<p>Theo đúng nguyên tắc kế toán danh mục đầu tư, <strong>giá mua ban đầu (Entry) được giữ nguyên giá gốc</strong>. Khối lượng cổ phiếu nắm giữ được quy đổi tăng thêm tương ứng tỷ lệ quyền, và các ngưỡng cắt lỗ (Stop Loss) / chốt lời (Take Profit) được điều chỉnh theo mặt bằng giá mới của bảng điện tử:</p>

<hr>
<p><strong>Bảng thông số kỹ thuật sau điều chỉnh quyền:</strong></p>
<ul>
<li><strong>Giá mua thực tế (Entry):</strong> <strong>{entry:.2f}</strong> (Giữ nguyên giá gốc lịch sử vào lệnh).</li>
<li><strong>Quy đổi khối lượng (Vol):</strong> <strong>Tăng +{vol_increase_pct}%</strong> (Hệ số cổ phiếu nắm giữ: <strong>x{multiplier:.2f}</strong>).</li>
<li><strong>Ngưỡng cắt lỗ (Stop Loss mới trên bảng điện):</strong> <del>{old_sl:.2f}</del> ➔ <strong>{sl:.2f}</strong></li>
<li><strong>Mục tiêu chốt lời (Take Profit mới trên bảng điện):</strong> <del>{old_tp:.2f}</del> ➔ <strong>{tp:.2f}</strong></li>
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
                            {"label": "Take Profit mới", "value": f"{tp:.2f}"},
                            {"label": "Kỷ luật quản trị", "value": "Bảo toàn tỷ lệ R:R"}
                        ]
                    }
                    res_ca = goi_dang_bai_vps("them_moc", ca_payload)
                    if res_ca:
                        print(f"   ✅ Đã nối mốc điều chỉnh quyền vào Mạch #{mach_id}")

            # Tính toán PnL có xét đến hệ số cổ phiếu / cổ tức
            multiplier = pos.get("shares_multiplier", 1.0)
            cash_div = pos.get("cash_dividend", 0.0)
            equivalent_price = close * multiplier + cash_div
            pnl_pct = ((equivalent_price - entry) / entry) * 100

            pos["current_price"] = close
            pos["equivalent_price"] = round(equivalent_price, 2)
            pos["pnl_pct"] = round(pnl_pct, 2)
            pos["last_checked"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

            print(f"   Giá phiên {session_date}: Close {close} (Quy đổi {equivalent_price:.2f}) | High {high} | Low {low} | Vol {vol:,.0f} | PnL: {pnl_pct:+.2f}%")

            # ----------------------------------------------------
            # KỊCH BẢN 1: CHẠM ĐIỂM CẮT LỖ (STOP LOSS)
            # ----------------------------------------------------
            if low <= sl or close <= sl:
                actual_exit_price = min(close, sl)
                eq_exit = actual_exit_price * multiplier + cash_div
                loss_pct = ((eq_exit - entry) / entry) * 100
                print(f"🚨 CẢNH BÁO: {sym} ĐÃ CHẠM ĐIỂM CẮT LỖ! (Low: {low} <= SL: {sl}) -> ĐÓNG VỊ THẾ!")

                vol_note = f" (Quy đổi tương đương {eq_exit:.2f} trước chia với Vol x{multiplier:.2f})" if multiplier != 1.0 else ""

                # 1. Thêm mốc đóng vị thế cắt lỗ vào mạch
                body_moc_sl = f"""<p><strong>[ĐÓNG VỊ THẾ - CẮT LỖ KỶ LUẬT]</strong></p>

<p>Hệ thống <strong>Bot Trader</strong> ghi nhận trong phiên giao dịch ngày {session_date}, cổ phiếu <strong>{sym}</strong> đã vi phạm ngưỡng cắt lỗ kỹ thuật khi giá chạm mức thấp nhất phiên tại <strong>{low:.2f}</strong> (thấp hơn ngưỡng Stop Loss đã đề ra là <strong>{sl:.2f}</strong>).</p>

<p>Theo đúng nguyên tắc quản trị rủi ro tuyệt đối của trường phái Price Action, hệ thống lập tức thực hiện <strong>đóng toàn bộ vị thế</strong> tại mức giá <strong>{actual_exit_price:.2f}</strong>{vol_note} để bảo toàn nguồn vốn.</p>

<hr>

<p><strong>Chi tiết kết quả &amp; Bài học quản trị vốn:</strong></p>
<ul>
<li><strong>Giá mua (Entry):</strong> {entry:.2f}</li>
<li><strong>Giá đóng vị thế (Exit trên sàn):</strong> {actual_exit_price:.2f}{vol_note}</li>
<li><strong>Kết quả PnL:</strong> <strong style="color: #ef4343;">{loss_pct:.2f}%</strong> (Hoàn toàn nằm trong biên độ rủi ro tối đa cho phép).</li>
<li><strong>Bài học thực chiến:</strong> Cắt lỗ không phải là thất bại mà là chi phí kinh doanh bắt buộc của mọi nhà giao dịch chuyên nghiệp. Chấp nhận một khoản lỗ nhỏ có kiểm soát là cách duy nhất để loại bỏ hoàn toàn nguy cơ bị kẹp hàng và cháy tài khoản khi thị trường diễn biến bất lợi.</li>
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
                        {"label": "Kết quả PnL", "value": f"{loss_pct:.1f}%"},
                        {"label": "Kỷ luật quản trị", "value": "Tuân thủ SL tuyệt đối"}
                    ]
                }
                res_moc = goi_dang_bai_vps("them_moc", moc_payload)
                if res_moc:
                    print(f"   ✅ Đã nối mốc cắt lỗ vào Mạch #{mach_id}")

                # 2. Đóng sổ mạch (dong_so)
                dong_payload = {
                    "mach_id": mach_id,
                    "ket_qua": f"Cắt lỗ {loss_pct:.1f}%",
                    "bai_hoc": f"Đóng lệnh cắt lỗ kỷ luật khi giá vi phạm ngưỡng {sl:.2f}. Bảo toàn nguồn vốn cho các cơ hội tiếp theo.\n\nGiao dịch demo, do Bot Trader thực hiện."
                }
                res_dong = goi_dang_bai_vps("dong_mach", dong_payload)
                if res_dong:
                    print(f"   🔒 Đã đóng sổ thành công Mạch #{mach_id} với kết quả: {res_dong.get('ket_qua')}")

                pos["status"] = "CLOSED_SL"
                pos["exit_price"] = actual_exit_price
                pos["equivalent_exit_price"] = round(eq_exit, 2)
                pos["final_pnl_pct"] = round(loss_pct, 2)
                pos["closed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                updates.append(f"{sym}: Đã đóng cắt lỗ ({loss_pct:.1f}%)")
                continue

            # ----------------------------------------------------
            # KỊCH BẢN 2: CHẠM ĐIỂM CHỐT LỜI (TAKE PROFIT)
            # ----------------------------------------------------
            if high >= tp or close >= tp:
                actual_exit_price = max(close, tp)
                eq_exit = actual_exit_price * multiplier + cash_div
                profit_pct = ((eq_exit - entry) / entry) * 100
                print(f"🎯 CHÚC MỪNG: {sym} ĐÃ ĐẠT MỤC TIÊU CHỐT LỜI! (High: {high} >= TP: {tp}) -> ĐÓNG VỊ THẾ!")

                vol_note = f" (Quy đổi tương đương {eq_exit:.2f} trước chia với Vol x{multiplier:.2f})" if multiplier != 1.0 else ""

                body_moc_tp = f"""<p><strong>[ĐÓNG VỊ THẾ - CHỐT LỜI MỤC TIÊU]</strong></p>

<p>Hệ thống <strong>Bot Trader</strong> ghi nhận trong phiên giao dịch ngày {session_date}, cổ phiếu <strong>{sym}</strong> đã chính thức chạm mục tiêu chốt lời kỳ vọng khi giá đạt mức cao nhất phiên tại <strong>{high:.2f}</strong> (vượt ngưỡng Take Profit đề ra là <strong>{tp:.2f}</strong>).</p>

<p>Hệ thống tiến hành <strong>thực hiện hóa lợi nhuận toàn bộ vị thế</strong> tại mức giá <strong>{actual_exit_price:.2f}</strong>{vol_note}, khép lại một chiến dịch giao dịch thành công trọn vẹn theo đúng kế hoạch Risk/Reward đã định trước.</p>

<hr>

<p><strong>Chi tiết kết quả chiến lược:</strong></p>
<ul>
<li><strong>Giá mua (Entry):</strong> {entry:.2f}</li>
<li><strong>Giá chốt lời (Exit trên sàn):</strong> {actual_exit_price:.2f}{vol_note}</li>
<li><strong>Lợi nhuận thực tế:</strong> <strong style="color: #10b981;">+{profit_pct:.2f}%</strong>.</li>
<li><strong>Tỷ lệ R:R thực hiện:</strong> Đạt chuẩn mục tiêu đề ra ban đầu.</li>
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
                        {"label": "Lợi nhuận PnL", "value": f"+{profit_pct:.1f}%"},
                        {"label": "Hiệu suất R:R", "value": "Đạt kỳ vọng chuẩn"}
                    ]
                }
                res_moc = goi_dang_bai_vps("them_moc", moc_payload)
                if res_moc:
                    print(f"   ✅ Đã nối mốc chốt lời vào Mạch #{mach_id}")

                dong_payload = {
                    "mach_id": mach_id,
                    "ket_qua": f"Chốt lời +{profit_pct:.1f}%",
                    "bai_hoc": f"Đạt mục tiêu Take Profit thành công tại vùng cản {tp:.2f}. Thực hiện hóa lợi nhuận kỷ luật.\n\nGiao dịch demo, do Bot Trader thực hiện."
                }
                res_dong = goi_dang_bai_vps("dong_mach", dong_payload)
                if res_dong:
                    print(f"   🔒 Đã đóng sổ thành công Mạch #{mach_id} với kết quả: {res_dong.get('ket_qua')}")

                pos["status"] = "CLOSED_TP"
                pos["exit_price"] = actual_exit_price
                pos["equivalent_exit_price"] = round(eq_exit, 2)
                pos["final_pnl_pct"] = round(profit_pct, 2)
                pos["closed_at"] = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                updates.append(f"{sym}: Đã chốt lời (+{profit_pct:.1f}%)")
                continue

            # ----------------------------------------------------
            # KỊCH BẢN 3: ĐẾN ĐIỂM NHỒI LỆNH (PYRAMIDING)
            # ----------------------------------------------------
            if pyramid_trigger and high >= pyramid_trigger and not pyramided:
                print(f"⚡ TÍN HIỆU NHỒI LỆNH: {sym} đã vượt mốc {pyramid_trigger:.2f} -> KÍCH HOẠT MỐC MỚI!")

                # Điểm hòa vốn trên bảng điện tử mới
                new_sl = round(entry / multiplier, 2) if multiplier != 1.0 else entry
                body_moc_pyramid = f"""<p><strong>[CẬP NHẬT VỊ THẾ - KÍCH HOẠT NHỒI LỆNH XU HƯỚNG]</strong></p>

<p>Trong phiên giao dịch ngày {session_date}, cổ phiếu <strong>{sym}</strong> đã bứt phá thành công qua mốc kháng cự trung gian <strong>{pyramid_trigger:.2f}</strong> (giá cao nhất chạm <strong>{high:.2f}</strong>) kèm sự gia tăng của dòng tiền chủ động.</p>

<p>Theo đúng chiến lược quản trị kim tự tháp (Pyramiding) của Bot Trader:</p>
<ul>
<li><strong>Hành động:</strong> Kích hoạt giải ngân đợt 2 (nhồi thêm 50% khối lượng còn lại) tại vùng giá <strong>{pyramid_trigger:.2f}</strong>.</li>
<li><strong>Dời điểm Stop Loss:</strong> Ngưỡng cắt lỗ toàn bộ vị thế được <strong>dời lên mức hòa vốn {new_sl:.2f}</strong> trên bảng điện (tương đương giá vốn Entry {entry:.2f}).</li>
<li><strong>Trạng thái rủi ro:</strong> Vị thế hiện tại chuyển sang trạng thái <strong>Free-risk Trade (Giao dịch không rủi ro)</strong>. Kể cả khi thị trường bất ngờ đảo chiều mạnh, tài khoản vẫn được bảo toàn nguyên vẹn vốn gốc.</li>
<li><strong>Mục tiêu Take Profit giữ nguyên:</strong> <strong>{tp:.2f}</strong>.</li>
</ul>

<hr>
<p><em>Giao dịch demo, do Bot Trader thực hiện.</em></p>"""

                moc_payload = {
                    "mach_id": mach_id,
                    "body": body_moc_pyramid,
                    "loai": "Nhồi lệnh",
                    "figures": [
                        {"label": "Giá nhồi lệnh", "value": f"{pyramid_trigger:.2f}"},
                        {"label": "Stop Loss mới", "value": f"{new_sl:.2f} (Hòa vốn)"},
                        {"label": "Trạng thái", "value": "Free-risk Trade"},
                        {"label": "Mục tiêu TP", "value": f"{tp:.2f}"}
                    ]
                }
                res_moc = goi_dang_bai_vps("them_moc", moc_payload)
                if res_moc:
                    print(f"   ✅ Đã mở mốc nhồi lệnh mới vào Mạch #{mach_id}")

                pos["pyramided"] = True
                pos["pyramid_price"] = pyramid_trigger
                pos["stop_loss"] = new_sl  # Dời SL lên hòa vốn
                updates.append(f"{sym}: Đã nhồi lệnh và dời SL lên {new_sl}")
                continue

            # Kịch bản 4: Vận động bình thường
            print(f"   ⏳ {sym} đang vận động bình thường (Close: {close} | PnL: {pnl_pct:+.2f}%). Tiếp tục duy trì vị thế.")
            updates.append(f"{sym}: Đang nắm giữ (PnL {pnl_pct:+.2f}%)")

        except Exception as e:
            print(f"❌ Lỗi khi kiểm tra {sym}: {e}")

    luu_vi_the(vi_the_list)

    print("\n" + "=" * 65)
    print("📋 TỔNG KẾT KIỂM TRA SAU 15H:")
    for u in updates:
        print(f"  • {u}")
    print("=" * 65)

    return updates


if __name__ == "__main__":
    date_arg = sys.argv[1] if len(sys.argv) > 1 else "2026-10-06"
    kiem_tra_sau_15h(simulate_date=date_arg)
