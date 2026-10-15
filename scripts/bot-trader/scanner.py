# -*- coding: utf-8 -*-
"""Bộ lọc quét qua 3 sàn (HOSE, HNX, UPCoM) tìm kiếm cơ hội giao dịch Price Action & MA 200.

Đặc điểm tối ưu:
- Hỗ trợ bộ nhớ đệm (Cache) theo ngày để không bị lặp lại request.
- Điều tiết tốc độ gọi (Rate Limiting) để tuân thủ hạn mức 20 req/phút của vnstock Guest.
- Tự động nhận diện VNSTOCK_API_KEY nếu có trong môi trường để tăng tốc.
- Phân tích đa tiêu chí: Nến Pin Bar, Breakout nền giá, Tích lũy nén biến động trên MA 200.
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd
import numpy as np

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from vnstock import Quote

# Danh mục 18 mã thanh khoản cốt lõi trên cả 3 sàn (đại diện dòng tiền thông minh)
WATCHLIST_3_SAN = {
    "HOSE": ["HDB", "MBB", "TCB", "FPT", "MWG", "HPG", "SSI", "STB"],
    "HNX": ["PVS", "SHS", "IDC", "CEO", "MBS"],
    "UPCOM": ["BSR", "ACV", "VEA", "QNS", "VGI"]
}

DATA_DIR = Path(__file__).resolve().parent / "data"
CACHE_DIR = DATA_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
DANH_SACH_CHO_FILE = DATA_DIR / "danh_sach_cho.json"


def lay_du_lieu_co_cache(symbol: str, end_date: str) -> pd.DataFrame | None:
    """Lấy dữ liệu lịch sử giá với cache cục bộ theo ngày."""
    cache_file = CACHE_DIR / f"{symbol}_{end_date}.json"
    if cache_file.exists():
        try:
            with open(cache_file, "r", encoding="utf-8") as f:
                records = json.load(f)
            df = pd.DataFrame(records)
            df["time"] = pd.to_datetime(df["time"])
            return df
        except Exception:
            pass

    start_date = (datetime.strptime(end_date, "%Y-%m-%d") - timedelta(days=380)).strftime("%Y-%m-%d")
    try:
        q = Quote(symbol=symbol, source="vci")
        df = q.history(start=start_date, end=end_date)
        if df is not None and len(df) >= 200:
            # Lưu cache
            df_to_save = df.copy()
            df_to_save["time"] = df_to_save["time"].astype(str)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(df_to_save.to_dict(orient="records"), f, ensure_ascii=False)
            return df
    except Exception as e:
        if "Rate limit" in str(e):
            print(f"⚠️ Chạm giới hạn API khi tải {symbol}, tạm dừng 15s...")
            time.sleep(15)
            try:
                q = Quote(symbol=symbol, source="vci")
                df = q.history(start=start_date, end=end_date)
                return df
            except Exception:
                return None
        return None
    return None


def quet_ma_co_phieu(symbol: str, exchange: str, end_date: str = None) -> dict | None:
    """Phân tích kỹ thuật Price Action & MA 200 cho một mã cổ phiếu."""
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")

    df = lay_du_lieu_co_cache(symbol, end_date)
    if df is None or len(df) < 205:
        return None

    # Chuẩn hóa tên cột
    df.columns = [c.lower() for c in df.columns]

    # Tính toán các chỉ báo kỹ thuật
    df["ma200"] = df["close"].rolling(window=200).mean()
    df["ma50"] = df["close"].rolling(window=50).mean()
    df["ma20"] = df["close"].rolling(window=20).mean()
    df["vol_ma20"] = df["volume"].rolling(window=20).mean()

    last = df.iloc[-1]
    prev = df.iloc[-2]
    prev2 = df.iloc[-3]

    close = float(last["close"])
    open_price = float(last["open"])
    high = float(last["high"])
    low = float(last["low"])
    vol = float(last["volume"])
    vol_ma20 = float(last["vol_ma20"])
    ma200 = float(last["ma200"])
    ma50 = float(last["ma50"])
    ma20 = float(last["ma20"])

    # 1. Điều kiện thanh khoản: Giá trị giao dịch phiên gần nhất >= 3 tỷ VNĐ
    gia_tri_gd_ty = (close * vol * 1000) / 1e9
    if gia_tri_gd_ty < 3.0:
        return None

    # 2. Điều kiện xu hướng: Nằm trên MA 200 hoặc vừa bứt phá qua MA 200 trong 3 phiên gần nhất
    tren_ma200 = close >= ma200
    cat_len_ma200 = (prev["close"] <= prev["ma200"] and close > ma200) or (prev2["close"] <= prev2["ma200"] and close > ma200)

    if not (tren_ma200 or cat_len_ma200):
        return None

    pct_tren_ma200 = ((close - ma200) / ma200) * 100
    if pct_tren_ma200 > 25.0:
        return None

    # 3. Phân tích mô hình nến Price Action
    body = abs(close - open_price)
    total_range = high - low
    if total_range == 0:
        return None

    lower_shadow = min(open_price, close) - low
    upper_shadow = high - max(open_price, close)

    setup_name = None
    score = 0
    ly_do = []

    # Tín hiệu 1: Pin Bar / Hammer rút chân tại vùng hỗ trợ / MA 200
    if lower_shadow >= 0.45 * total_range and close >= open_price:
        setup_name = "Bullish Pin Bar rút chân kiểm định hỗ trợ"
        score += 45
        ly_do.append(f"Nến Pin Bar rút chân dứt khoát với bóng nến dưới chiếm {lower_shadow/total_range*100:.0f}% biên độ.")

    # Tín hiệu 2: Breakout nền giá / đỉnh ngắn hạn kèm volume bùng nổ
    highest_20 = df["high"].iloc[-21:-1].max()
    if close >= highest_20 and vol >= 1.25 * vol_ma20:
        setup_name = "Breakout bứt phá đỉnh ngắn hạn kèm thanh khoản lớn"
        score += 45
        ly_do.append(f"Vượt đỉnh 20 phiên ({highest_20:.2f}) với khối lượng gấp {vol/vol_ma20:.1f}x trung bình MA20.")

    # Tín hiệu 3: Tích lũy nén chặt gần MA 200 (VCP / Retest MA 200)
    if abs(close - ma200) / ma200 <= 0.05 and close > ma200:
        if not setup_name:
            setup_name = "Tái tích lũy nén biên độ trên đường MA 200"
        score += 35
        ly_do.append(f"Giá tích lũy chặt chẽ ngay trên MA 200 ({ma200:.2f}), giữ vững hỗ trợ trung hạn.")

    if not setup_name:
        return None

    # Bonus điểm
    if ma50 > ma200:
        score += 15
        ly_do.append("Đường MA 50 nằm trên MA 200 xác nhận cấu trúc tăng trung dài hạn.")
    if vol >= vol_ma20:
        score += 10
        ly_do.append(f"Khối lượng phiên đạt {vol:,.0f} cổ phiếu, vượt trung bình 20 phiên ({vol_ma20:,.0f}).")

    # 4. Kế hoạch vị thế (Entry, SL, TP, Nhồi lệnh)
    entry_price = round(close, 2)

    # Stop Loss dưới đáy gần nhất hoặc dưới MA 200
    lowest_5 = df["low"].iloc[-5:].min()
    sl_candidate_1 = round(lowest_5 * 0.99, 2)
    sl_candidate_2 = round(ma200 * 0.98, 2)
    stop_loss = max(sl_candidate_1, sl_candidate_2)

    risk_pct = ((entry_price - stop_loss) / entry_price) * 100
    if risk_pct < 3.0:
        stop_loss = round(entry_price * 0.96, 2)
        risk_pct = 4.0
    elif risk_pct > 6.5:
        stop_loss = round(entry_price * 0.945, 2)
        risk_pct = 5.5

    reward_target_pct = risk_pct * 2.4
    take_profit = round(entry_price * (1 + reward_target_pct / 100), 2)
    rr_ratio = round(reward_target_pct / risk_pct, 2)
    pyramid_trigger = round(entry_price * 1.04, 2)

    return {
        "symbol": symbol,
        "exchange": exchange,
        "close": entry_price,
        "entry_price": entry_price,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "pyramid_trigger": pyramid_trigger,
        "risk_pct": round(risk_pct, 2),
        "reward_pct": round(reward_target_pct, 2),
        "rr_ratio": rr_ratio,
        "score": score,
        "setup_name": setup_name,
        "ma200": round(ma200, 2),
        "ma50": round(ma50, 2),
        "ma20": round(ma20, 2),
        "pct_above_ma200": round(pct_tren_ma200, 1),
        "volume": int(vol),
        "gia_tri_gd_ty": round(gia_tri_gd_ty, 1),
        "ly_do": ly_do,
        "scan_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


def quet_toan_bo_3_san(end_date: str = None) -> list:
    """Quét danh mục 18 mã thanh khoản trên 3 sàn HOSE, HNX, UPCoM."""
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")

    print("=" * 65)
    print(f"🔍 BOT TRADER: QUÉT DUYỆT 3 SÀN (HOSE, HNX, UPCoM) - NGÀY {end_date}...")
    print("=" * 65)

    candidates = []
    total_scanned = 0

    for exchange, symbols in WATCHLIST_3_SAN.items():
        print(f"\n📌 Quét sàn {exchange} ({len(symbols)} mã)...")
        for sym in symbols:
            total_scanned += 1
            res = quet_ma_co_phieu(sym, exchange, end_date=end_date)
            if res:
                candidates.append(res)
                print(f"  ✨ [{res['score']} pts] {res['symbol']} ({res['exchange']}) | {res['setup_name']}")
                print(f"     Entry: {res['entry_price']} | SL: {res['stop_loss']} (-{res['risk_pct']}%) | TP: {res['take_profit']} (+{res['reward_pct']}%) | R:R 1:{res['rr_ratio']}")
            time.sleep(0.5)

    candidates.sort(key=lambda x: x["score"], reverse=True)

    with open(DANH_SACH_CHO_FILE, "w", encoding="utf-8") as f:
        json.dump(candidates, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 65)
    print(f"✅ HOÀN TẤT QUÉT 3 SÀN: Duyệt {total_scanned} mã, phát hiện {len(candidates)} cơ hội đạt chuẩn.")
    if candidates:
        top = candidates[0]
        print(f"🏆 ỨNG VIÊN SỐ 1: {top['symbol']} ({top['exchange']}) - Điểm: {top['score']} | {top['setup_name']}")
    print("=" * 65)

    return candidates


if __name__ == "__main__":
    quet_toan_bo_3_san()
