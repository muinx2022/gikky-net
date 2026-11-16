# -*- coding: utf-8 -*-
"""Test kiểm thử giao diện & nội dung Nhật ký giao dịch v2 cho Bot Trader."""

import sys
from pathlib import Path

# Thêm đường dẫn scripts/bot-trader
BOT_DIR = Path(__file__).resolve().parent.parent / "scripts" / "bot-trader"
if str(BOT_DIR) not in sys.path:
    sys.path.insert(0, str(BOT_DIR))

from soan_va_dang import tao_bai_viet_bot_trader
from eod_checker import tao_noi_dung_moc_sl, tao_noi_dung_moc_tp, tao_noi_dung_moc_pyramid


def test_rendering_vn():
    print("=" * 70)
    print("1. KIỂM THỬ TẠO PAYLOAD CỔ PHIẾU VN (SSI & HDB)")
    print("=" * 70)

    # Candidate 1: SSI (Chứng khoán - MA30_50_PULLBACK)
    candidate_ssi = {
        "symbol": "SSI",
        "exchange": "HOSE",
        "entry_price": 32.50,
        "stop_loss": 30.80,
        "take_profit": 36.80,
        "pyramid_trigger": 34.20,
        "setup_name": "Kéo ngược MA 30-50",
        "strategy_id": "MA30_50_PULLBACK",
        "strategy_name": "Kéo ngược dải MA 30 - MA 50",
        "direction": "LONG",
        "timeframe": "D1",
        "decimals": 2,
        "risk_pct": 5.23,
        "reward_pct": 13.23,
        "rr_ratio": 2.53,
        "ly_do": [
            "Đường MA 30 (31.90) dốc lên song song phía trên MA 50 (30.80)",
            "Nến test dải MA 30-50 rút chân mạnh mẽ với thanh khoản cạn kiệt",
            "Chỉ báo RSI duy trì vùng 56.4 xác nhận động lượng tiếp diễn"
        ],
        "score": 75,
        "ma30": 31.90,
        "ma50": 30.80,
        "ma200": 29.50,
        "entry_date": "2026-11-11"
    }

    res_ssi = tao_bai_viet_bot_trader(candidate_ssi, market_mode="VN")
    print(f"\n[SSI] Tiêu đề: {res_ssi['title']}")
    print(f"      Độ dài tiêu đề: {len(res_ssi['title'])} / 160 ký tự")
    print(f"      Loại mốc: {res_ssi['loai']} | Loại mạch: {res_ssi.get('loai_mach')}")
    print(f"      Lệnh: {res_ssi.get('lenh')}")
    print(f"      Số lượng Figures: {len(res_ssi['figures'])}")
    for fig in res_ssi['figures']:
        print(f"        • {fig.get('label')}: {fig.get('value')}")
    assert res_ssi['loai'] == "Vào lệnh", "Loại mốc phải là 'Vào lệnh'"
    assert res_ssi['loai_mach'] == "nhat_ky", "Loại mạch phải là 'nhat_ky'"
    assert res_ssi['title'].startswith("Mua SSI quanh 32.50 —"), "Tiêu đề sai format"
    assert not res_ssi['title'].startswith("[Nhật ký]"), "Tiêu đề không được chứa tiền tố [Nhật ký]"
    assert "1. Bức tranh tổng thể &amp; Tâm lý thị trường" in res_ssi['body']
    assert "2. Luận điểm vào lệnh &amp; Tín hiệu kích hoạt" in res_ssi['body']
    assert "3. Kỳ vọng mục tiêu &amp; Kế hoạch phân bổ" in res_ssi['body']
    assert "4. Điểm vô hiệu hóa luận điểm &amp; Quản trị rủi ro" in res_ssi['body']
    assert "Ứng phó chu kỳ thanh toán (T+2.5)" in res_ssi['body']
    assert "Kịch bản nhồi lệnh (Pyramiding)" in res_ssi['body']

    # Candidate 2: HDB (Ngân hàng - ICHIMOKU)
    candidate_hdb = {
        "symbol": "HDB",
        "exchange": "HOSE",
        "entry_price": 26.80,
        "stop_loss": 25.50,
        "take_profit": 30.20,
        "pyramid_trigger": 28.10,
        "setup_name": "Bứt phá Mây Kumo",
        "strategy_id": "ICHIMOKU",
        "strategy_name": "Hệ thống Ichimoku Kinko Hyo",
        "direction": "LONG",
        "timeframe": "D1",
        "decimals": 2,
        "risk_pct": 4.85,
        "reward_pct": 12.69,
        "rr_ratio": 2.62,
        "ly_do": [
            "Giá đóng cửa bứt phá hoàn toàn khỏi Mây Kumo",
            "Tenkan-sen (26.40) cắt lên trên Kijun-sen (25.80)",
            "Chikou Span thoát khỏi đường giá xác nhận xu hướng tăng"
        ],
        "score": 80,
        "tenkan": 26.40,
        "kijun": 25.80,
        "ma200": 24.50,
        "entry_date": "2026-11-11"
    }

    res_hdb = tao_bai_viet_bot_trader(candidate_hdb, market_mode="VN")
    print(f"\n[HDB] Tiêu đề: {res_hdb['title']}")
    print(f"      Độ dài tiêu đề: {len(res_hdb['title'])} / 160 ký tự")
    print(f"      Loại mốc: {res_hdb['loai']} | Loại mạch: {res_hdb.get('loai_mach')}")
    print(f"      Lệnh: {res_hdb.get('lenh')}")
    assert res_hdb['loai_mach'] == "nhat_ky"
    assert "Ngân hàng" in res_hdb['title']
    print("✅ Đạt chuẩn kiểm thử Cổ phiếu VN!")


def test_rendering_h4():
    print("\n" + "=" * 70)
    print("2. KIỂM THỬ TẠO PAYLOAD QUỐC TẾ H4 (EUR/USD & XAU/USD)")
    print("=" * 70)

    # Candidate 3: EUR/USD (LONG, ICHIMOKU)
    candidate_eur = {
        "symbol": "EUR/USD",
        "exchange": "Forex",
        "entry_price": 1.0850,
        "stop_loss": 1.0805,
        "take_profit": 1.0960,
        "pyramid_trigger": 1.0895,
        "setup_name": "Bứt phá Mây Kumo",
        "strategy_id": "ICHIMOKU",
        "strategy_name": "Hệ thống Ichimoku Kinko Hyo",
        "direction": "LONG",
        "timeframe": "H4",
        "decimals": 4,
        "risk_pct": 0.41,
        "reward_pct": 1.01,
        "rr_ratio": 2.44,
        "ly_do": [
            "Nến H4 bứt phá dứt khoát ra khỏi đám mây Kumo",
            "Tenkan-sen (1.0840) song hành trên Kijun-sen (1.0815)",
            "Khối lượng giao dịch tăng 1.8 lần so với trung bình 20 phiên"
        ],
        "score": 75,
        "tenkan": 1.0840,
        "kijun": 1.0815,
        "ma200": 1.0780
    }

    res_eur = tao_bai_viet_bot_trader(candidate_eur, market_mode="H4")
    print(f"\n[EUR/USD] Tiêu đề: {res_eur['title']}")
    print(f"          Độ dài tiêu đề: {len(res_eur['title'])} / 160 ký tự")
    print(f"          Loại mốc: {res_eur['loai']} | Loại mạch: {res_eur.get('loai_mach')}")
    print(f"          Lệnh: {res_eur.get('lenh')}")
    assert res_eur['loai'] == "Vào lệnh"
    assert res_eur['loai_mach'] == "nhat_ky"
    assert res_eur['title'].startswith("Mua EUR/USD quanh 1.0850 —")
    assert not res_eur['title'].startswith("[Nhật ký]")
    assert "DXY" in res_eur['title']

    # Candidate 4: XAU/USD (LONG, BB_SQUEEZE)
    candidate_gold = {
        "symbol": "XAU/USD",
        "exchange": "COMEX",
        "entry_price": 2680.50,
        "stop_loss": 2655.00,
        "take_profit": 2742.00,
        "pyramid_trigger": 2705.00,
        "setup_name": "Co thắt Bollinger Bands",
        "strategy_id": "BB_SQUEEZE",
        "strategy_name": "Co thắt dải Bollinger Bands",
        "direction": "LONG",
        "timeframe": "H4",
        "decimals": 2,
        "risk_pct": 0.95,
        "reward_pct": 2.29,
        "rr_ratio": 2.41,
        "ly_do": [
            "Độ rộng dải Bollinger nén hẹp nhất trong 60 cây nến H4",
            "Nến xanh Marubozu bứt phá dải Upper Band",
            "Dòng tiền trú ẩn an toàn kích hoạt mạnh mẽ"
        ],
        "score": 85,
        "bb_mid": 2668.00,
        "ma200": 2620.00
    }

    res_gold = tao_bai_viet_bot_trader(candidate_gold, market_mode="H4")
    print(f"\n[XAU/USD] Tiêu đề: {res_gold['title']}")
    print(f"          Độ dài tiêu đề: {len(res_gold['title'])} / 160 ký tự")
    print(f"          Lệnh: {res_gold.get('lenh')}")
    assert res_gold['title'].startswith("Mua XAU/USD quanh 2680.50 —")
    assert not res_gold['title'].startswith("[Nhật ký]")
    assert "Risk-Off" in res_gold['title']
    assert "Tâm lý liên thị trường đang nghiêng về trạng thái phòng thủ rủi ro (Risk-Off)" in res_gold['body']

    # Candidate 5: WTI (SHORT, BB_SQUEEZE)
    candidate_wti = {
        "symbol": "WTI",
        "exchange": "NYMEX",
        "entry_price": 72.50,
        "stop_loss": 74.80,
        "take_profit": 66.80,
        "pyramid_trigger": 70.20,
        "setup_name": "Gãy kênh MA 50",
        "strategy_id": "MA_CROSS",
        "strategy_name": "Giao cắt MA 30 / MA 50",
        "direction": "SHORT",
        "timeframe": "H4",
        "decimals": 2,
        "risk_pct": 3.17,
        "reward_pct": 7.86,
        "rr_ratio": 2.48,
        "ly_do": [
            "Tồn kho năng lượng gia tăng gây áp lực giá nến H4",
            "Đường giá trượt khỏi kênh tăng và nằm dưới MA 50"
        ],
        "score": 80,
    }
    res_wti = tao_bai_viet_bot_trader(candidate_wti, market_mode="H4")
    print(f"\n[WTI] Tiêu đề: {res_wti['title']}")
    print(f"      Độ dài tiêu đề: {len(res_wti['title'])} / 160 ký tự")
    print(f"      Lệnh: {res_wti.get('lenh')}")
    assert res_wti['title'].startswith("Bán WTI quanh 72.50 —")
    assert not res_wti['title'].startswith("[Nhật ký]")
    print("✅ Đạt chuẩn kiểm thử Quốc tế H4!")


def test_post_mortem_and_execution_review():
    print("\n" + "=" * 70)
    print("3. KIỂM THỬ BÀI HỌC ĐÓNG SỔ & MỐC CẬP NHẬT (SL, TP, PYRAMIDING)")
    print("=" * 70)

    # 1. Test Stop Loss (Post-Mortem Review) cho SSI
    body_sl, fig_sl, bai_hoc_sl = tao_noi_dung_moc_sl(
        sym="SSI",
        entry=32.50,
        exit_price=30.70,
        sl=30.80,
        loss_pct=-5.54,
        session_date="2026-11-15",
        timeframe="D1",
        direction="LONG",
        strat_name="Kéo ngược dải MA 30 - MA 50",
        decimals=2
    )
    print("\n--- [STOP LOSS MỐC] ---")
    print(f"Figures SL: {fig_sl}")
    print(f"Bài học đóng sổ SL (Post-Mortem):\n{bai_hoc_sl}")
    assert "Post-Mortem Review" in body_sl
    assert "Bảo toàn vốn" in body_sl or "95%+" in body_sl
    assert "Báo cáo đóng sổ vị thế SSI (Cắt lỗ -5.5%):" in bai_hoc_sl
    assert "Giao dịch demo, do Bot Trader thực hiện." in bai_hoc_sl

    # 2. Test Take Profit (Execution Review) cho HDB
    body_tp, fig_tp, bai_hoc_tp = tao_noi_dung_moc_tp(
        sym="HDB",
        entry=26.80,
        exit_price=30.25,
        tp=30.20,
        profit_pct=12.87,
        session_date="2026-11-20",
        timeframe="D1",
        direction="LONG",
        strat_name="Hệ thống Ichimoku Kinko Hyo",
        rr=2.62,
        decimals=2
    )
    print("\n--- [TAKE PROFIT MỐC] ---")
    print(f"Figures TP: {fig_tp}")
    print(f"Bài học đóng sổ TP (Execution Review):\n{bai_hoc_tp}")
    assert "Execution Review" in body_tp
    assert "kiên định gồng lãi" in body_tp
    assert "Báo cáo đóng sổ vị thế HDB (Chốt lời +12.9%):" in bai_hoc_tp
    assert "Giao dịch demo, do Bot Trader thực hiện." in bai_hoc_tp

    # 3. Test Pyramiding (Free-risk Trade) cho EUR/USD
    body_pyr, fig_pyr = tao_noi_dung_moc_pyramid(
        sym="EUR/USD",
        entry=1.0850,
        pyramid_trigger=1.0895,
        new_sl=1.0850,
        session_date="2026-11-12 14:00",
        timeframe="H4",
        direction="LONG",
        decimals=4
    )
    print("\n--- [PYRAMIDING MỐC] ---")
    print(f"Figures Pyramid: {fig_pyr}")
    assert "Free-risk Trade" in body_pyr
    assert "dời mốc Stop Loss về mức giá hòa vốn" in body_pyr
    print("✅ Đạt chuẩn kiểm thử Post-Mortem & Execution Review!")


if __name__ == "__main__":
    test_rendering_vn()
    test_rendering_h4()
    test_post_mortem_and_execution_review()
    print("\n" + "=" * 70)
    print("🎉 TẤT CẢ CÁC BÀI TEST CHUẨN NHẬT KÝ GIAO DỊCH V2 ĐỀU ĐẠT CHUẨN!")
    print("=" * 70)
