# -*- coding: utf-8 -*-
"""Soạn thảo và xuất bản Luận điểm giao dịch của Bot Trader lên Gikky.net."""

import base64
import json
import os
import subprocess
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


def dang_luan_diem(symbol_target: str = None) -> dict:
    """Mở luận điểm giao dịch mới cho Bot Trader."""
    # Kiểm tra số lượng vị thế đang mở (giới hạn tối đa 3 vị thế đồng thời để tránh phân tán vốn)
    vi_the_list = doc_vi_the_dang_mo()
    open_positions = [p for p in vi_the_list if p.get("status") == "OPEN"]

    now_date = datetime.now().date()
    recent_closed_symbols = set()
    for p in vi_the_list:
        if p.get("status") in ["CLOSED_TP", "CLOSED_SL"]:
            c_date_str = p.get("closed_at", p.get("opened_at", ""))[:10]
            try:
                c_date = datetime.strptime(c_date_str, "%Y-%m-%d").date()
                if (now_date - c_date).days < 10:
                    recent_closed_symbols.add(p["symbol"])
            except Exception:
                pass

    if len(open_positions) >= 3 and not symbol_target:
        print(f"⚠️ Đang có {len(open_positions)} vị thế đang mở. Tạm dừng mở mới để bảo toàn vốn.")
        return None

    # Kiểm tra nhịp độ: Vài ngày mở 1 trade (giãn cách tối thiểu 2-3 ngày)
    if open_positions and not symbol_target:
        latest_date_str = max(p.get("entry_date", "2000-01-01") for p in open_positions)
        try:
            latest_date = datetime.strptime(latest_date_str, "%Y-%m-%d").date()
            today = datetime.now().date()
            delta_days = (today - latest_date).days
            if delta_days < 2:
                print(f"⏳ Lệnh gần nhất ({open_positions[-1]['symbol']}) mới mở ngày {latest_date_str} ({delta_days} ngày trước).")
                print("   Tuân thủ nguyên tắc: Vài ngày mở 1 trade, không mở liên tục mỗi ngày để bảo vệ vốn.")
                return None
        except Exception:
            pass

    candidate = None
    if DANH_SACH_CHO_FILE.exists():
        with open(DANH_SACH_CHO_FILE, "r", encoding="utf-8") as f:
            candidates = json.load(f)
            if symbol_target:
                for c in candidates:
                    if c["symbol"].upper() == symbol_target.upper():
                        if c["symbol"] in recent_closed_symbols:
                            print(f"⏳ Cảnh báo: Ứng viên {c['symbol']} vừa đóng lệnh trong vòng 10 ngày gần đây.")
                        candidate = c
                        break
            elif candidates:
                # Chọn ứng viên có điểm cao nhất chưa mở lệnh và không trong cool-off
                open_symbols = [p["symbol"] for p in open_positions]
                for c in candidates:
                    if c["symbol"] in open_symbols:
                        continue
                    if c["symbol"] in recent_closed_symbols:
                        print(f"⏳ Bỏ qua ứng viên {c['symbol']} vì vừa đóng lệnh trong vòng 10 ngày gần đây.")
                        continue
                    candidate = c
                    break

    if not candidate:
        print(f"❌ Không tìm thấy thông tin ứng viên phù hợp cho {symbol_target}!")
        return None

    sym = candidate["symbol"]
    exchange = candidate["exchange"]
    entry = candidate["entry_price"]
    sl = candidate["stop_loss"]
    tp = candidate["take_profit"]
    pyramid = candidate.get("pyramid_trigger")
    setup_name = candidate["setup_name"]
    risk_pct = candidate["risk_pct"]
    reward_pct = candidate["reward_pct"]
    rr = candidate["rr_ratio"]
    ma200 = candidate["ma200"]
    ma50 = candidate["ma50"]
    vol = candidate["volume"]
    ly_do_list = candidate.get("ly_do", [])

    print(f"\n🚀 Chuẩn bị xuất bản Luận điểm Mua {sym} ({exchange})...")

    # 1. Vẽ biểu đồ kỹ thuật
    chart_path = ve_bieu_do_bot_trader(
        symbol=sym,
        exchange=exchange,
        entry_price=entry,
        stop_loss=sl,
        take_profit=tp,
        pyramid_trigger=pyramid,
        end_date=datetime.now().strftime("%Y-%m-%d"),
        setup_name=setup_name
    )

    with open(chart_path, "rb") as f:
        chart_b64 = base64.b64encode(f.read()).decode("utf-8")

    # 2. Xây dựng tiêu đề & thông số (Gọn gàng: Mua {sym} tại {entry}: Entry ..., SL ..., TP ...)
    if pyramid:
        title = f"Mua {sym} tại {entry:.2f}: Entry {entry:.2f}, SL {sl:.2f}, TP {tp:.2f}, Nhồi {pyramid:.2f}"
    else:
        title = f"Mua {sym} tại {entry:.2f}: Entry {entry:.2f}, SL {sl:.2f}, TP {tp:.2f}"

    sub = "chung-khoan"
    loai = "Chiến lược"

    figures = [
        {"label": "Mã cổ phiếu", "value": f"{sym} ({exchange})"},
        {"label": "Vị thế khuyến nghị", "value": "Mua (Long)"},
        {"label": "Giá mua Entry", "value": f"{entry:.2f}"},
        {"label": "Cắt lỗ Stop Loss", "value": f"{sl:.2f} (-{risk_pct:.1f}%)"},
        {"label": "Chốt lời TP kỳ vọng", "value": f"{tp:.2f} (+{reward_pct:.1f}%)"},
        {"label": "Tỷ lệ Risk/Reward", "value": f"1 : {rr:.2f}"}
    ]

    question_for_crowd = f"Với vị thế Mua {sym} ở vùng giá {entry} trên MA 200, bạn đánh giá kịch bản nào có xác suất cao hơn: Chinh phục mục tiêu {tp} hay kiểm định lại ngưỡng cắt lỗ {sl}?"

    # 3. Soạn nội dung bài viết
    ly_do_html = "".join([f"<li><strong>{ld}</strong></li>" for ld in ly_do_list])

    body = f"""<p>{{{{ANH_1}}}}</p>

<p>Hệ thống thuật toán <strong>Bot Trader</strong> ghi nhận tín hiệu giao dịch mới theo trường phái <strong>Price Action &amp; MA 200</strong> đối với cổ phiếu <strong>{sym}</strong> niêm yết trên sàn {exchange}. Dưới đây là luận điểm chi tiết, bối cảnh kỹ thuật và kế hoạch phân bổ vị thế cụ thể.</p>

<hr>

<p><strong>1. Bối cảnh kỹ thuật &amp; Cấu trúc xu hướng trên MA 200</strong></p>

<p>Cổ phiếu {sym} hiện đang vận động trong một cấu trúc tích lũy tăng trưởng trung hạn rõ nét. Đường <strong>MA 200 ngày</strong> hiện ở mức <strong>{ma200:.2f}</strong> đang đóng vai trò là "chiếc neo giá trị" nâng đỡ toàn bộ xu hướng giá. Việc giá đóng cửa phiên gần nhất tại <strong>{entry:.2f}</strong> duy trì vững chắc trên MA 200 (cao hơn +{candidate['pct_above_ma200']}%) khẳng định phe mua đang kiểm soát hoàn toàn nhịp điều chỉnh.</p>

<p>Đồng thời, đường trung bình ngắn hạn MA 50 ngày ({ma50:.2f}) tiếp tục duy trì trạng thái nằm trên MA 200 (Golden Cross), tạo nên một vùng đệm hỗ trợ động nhiều lớp cực kỳ vững chắc.</p>

<hr>

<p><strong>2. Tín hiệu Price Action kích hoạt điểm vào lệnh</strong></p>

<ul>
{ly_do_html}
</ul>

<p>Trong phiên giao dịch vừa qua, áp lực bán điều chỉnh đã hoàn toàn suy yếu khi chạm vùng cản động. Cây nến đóng cửa thể hiện lực cầu bắt đáy nhập cuộc dứt khoát, đẩy giá phục hồi mạnh mẽ về cuối phiên và từ chối các mức giá thấp. Khối lượng khớp lệnh đạt hơn {vol:,.0f} đơn vị, xác nhận sự tham gia của dòng tiền lớn bảo vệ vị thế.</p>

<hr>

<p><strong>3. Kế hoạch giao dịch &amp; Quản trị rủi ro kỷ luật</strong></p>

<ul>
<li><strong>Vị thế:</strong> Mua (Long) thăm dò 50% tỷ trọng danh mục mục tiêu tại vùng giá <strong>{entry:.2f}</strong>.</li>
<li><strong>Ngưỡng cắt lỗ (Stop Loss):</strong> <strong>{sl:.2f}</strong> (Mức chịu rủi ro tối đa: <strong>-{risk_pct:.1f}%</strong>). Nếu giá vi phạm đóng nến dưới ngưỡng này, hệ thống sẽ thực hiện cắt lỗ tuyệt đối để bảo toàn vốn, tránh rơi vào <a href="/m/co-che-call-margin-va-force-sell-ty-le-ky-quy-rtt-quy-trinh-ban-giai-chap-va-hieu-ung-tuyet-lo-cheo-1169">cơ chế giải chấp và rủi ro bán tháo Call Margin</a>.</li>
<li><strong>Mục tiêu chốt lời (Take Profit):</strong> <strong>{tp:.2f}</strong> (Kỳ vọng lợi nhuận: <strong>+{reward_pct:.1f}%</strong>). Tỷ lệ Risk/Reward đạt mức <strong>1 : {rr:.2f}</strong>, hoàn toàn thỏa mãn tiêu chuẩn toán học giao dịch xác suất cao.</li>
<li><strong>Kịch bản nhồi lệnh (Pyramiding):</strong> Nếu giá bứt phá vượt qua mốc kháng cự <strong>{pyramid:.2f}</strong> kèm thanh khoản gia tăng, hệ thống sẽ tự động kích hoạt mốc nhồi lệnh số 2 (50% tỷ trọng còn lại) và đồng thời dời điểm Stop Loss lên điểm hòa vốn ({entry:.2f}) theo đúng nguyên tắc <a href="/m/mo-hinh-kenh-gia-doc-xuong-falling-channel-bat-nhip-but-pha-kenh-tich-luy-trung-han-ky-thuat-kiem-dinh-canh-tren-va-toi-uu-ty-le-rr-132-1231">quản trị vị thế theo xu hướng</a>.</li>
</ul>

<hr>

<p><em>* Chú thích: Đây là giao dịch mô phỏng (demo) do Bot Trader tự động thực hiện dựa trên thuật toán Price Action &amp; MA 200, không cấu thành khuyến nghị hay lời mời chào đầu tư tài chính.</em></p>"""

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
                "alt": f"Biểu đồ kỹ thuật Daily Chart cổ phiếu {sym} kèm đường MA 200 và các mốc giao dịch",
                "placeholder": "{{ANH_1}}"
            }
        ]
    }

    payload_file = DATA_DIR / "bot_trader_post_payload.json"
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
        "exchange": exchange,
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

    print(f"🎉 ĐÃ XUẤT BẢN THÀNH CÔNG LUẬN ĐIỂM GIAO DỊCH!")
    print(f"   Mã: {sym} | Sàn: {exchange} | Mạch ID: #{mach_id}")
    print(f"   Link mạch: {mach_url}")

    return new_position


if __name__ == "__main__":
    target = sys.argv[1] if len(sys.argv) > 1 else None
    dang_luan_diem(target)
