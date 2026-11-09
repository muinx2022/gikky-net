# -*- coding: utf-8 -*-
"""Bộ lọc quét đa thị trường: Cổ phiếu VN (D1) & Quốc tế FX / Năng lượng / Hàng hóa (H4)
với Hệ thống Đa Phương Pháp Kỹ Thuật (Multi-Strategy Engine):
1. ICHIMOKU: Hệ thống Ichimoku Kinko Hyo (9, 26, 52)
2. MA_CROSS: Giao cắt đường trung bình động (MA 30 / MA 50) & Động lượng RSI
3. MA30_50_PULLBACK: Xu hướng & Kéo ngược dải MA 30 - MA 50 (Weinstein Pullback)
4. BB_SQUEEZE: Co thắt dải Bollinger Bands (20, 2) & Bứt phá
5. PA_MA200: Price Action (Pin Bar, Breakout, VCP) trên trục MA 200
"""

import json
import os
import sys
import time
from datetime import datetime, timedelta
from pathlib import Path
import pandas as pd
import numpy as np
import requests

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

from vnstock import Quote

# Danh mục 18 mã thanh khoản cốt lõi trên cả 3 sàn VN (HOSE, HNX, UPCoM)
WATCHLIST_3_SAN = {
    "HOSE": ["HDB", "MBB", "TCB", "FPT", "MWG", "HPG", "SSI", "STB"],
    "HNX": ["PVS", "SHS", "IDC", "CEO", "MBS"],
    "UPCOM": ["BSR", "ACV", "VEA", "QNS", "VGI"]
}

# Danh mục 12 tài sản Quốc tế khung H4 (FX, Kim loại, Năng lượng)
WATCHLIST_QUOC_TE_H4 = [
    {"symbol": "EUR/USD", "yf_ticker": "EURUSD=X", "name": "Cặp tỷ giá Euro / Đô la Mỹ", "sub": "ngoai-hoi", "market_type": "FX", "decimals": 4, "exchange": "Forex"},
    {"symbol": "GBP/USD", "yf_ticker": "GBPUSD=X", "name": "Cặp tỷ giá Bảng Anh / Đô la Mỹ", "sub": "ngoai-hoi", "market_type": "FX", "decimals": 4, "exchange": "Forex"},
    {"symbol": "USD/JPY", "yf_ticker": "JPY=X", "name": "Cặp tỷ giá Đô la Mỹ / Yên Nhật", "sub": "ngoai-hoi", "market_type": "FX", "decimals": 2, "exchange": "Forex"},
    {"symbol": "AUD/USD", "yf_ticker": "AUDUSD=X", "name": "Cặp tỷ giá Đô la Úc / Đô la Mỹ", "sub": "ngoai-hoi", "market_type": "FX", "decimals": 4, "exchange": "Forex"},
    {"symbol": "USD/CHF", "yf_ticker": "CHF=X", "name": "Cặp tỷ giá Đô la Mỹ / Franc Thụy Sĩ", "sub": "ngoai-hoi", "market_type": "FX", "decimals": 4, "exchange": "Forex"},
    {"symbol": "USD/CAD", "yf_ticker": "CAD=X", "name": "Cặp tỷ giá Đô la Mỹ / Đô la Canada", "sub": "ngoai-hoi", "market_type": "FX", "decimals": 4, "exchange": "Forex"},
    {"symbol": "XAU/USD", "yf_ticker": "GC=F", "name": "Vàng giao ngay / HĐTL Vàng COMEX", "sub": "ngoai-hoi", "market_type": "COMMODITY", "decimals": 2, "exchange": "COMEX"},
    {"symbol": "XAG/USD", "yf_ticker": "SI=F", "name": "Bạc quốc tế (Silver COMEX)", "sub": "ngoai-hoi", "market_type": "COMMODITY", "decimals": 2, "exchange": "COMEX"},
    {"symbol": "COPPER", "yf_ticker": "HG=F", "name": "Đồng công nghiệp COMEX", "sub": "vi-mo", "market_type": "COMMODITY", "decimals": 4, "exchange": "COMEX"},
    {"symbol": "WTI", "yf_ticker": "CL=F", "name": "Dầu thô ngọt nhẹ WTI NYMEX", "sub": "vi-mo", "market_type": "ENERGY", "decimals": 2, "exchange": "NYMEX"},
    {"symbol": "BRENT", "yf_ticker": "BZ=F", "name": "Dầu thô Brent Biển Bắc ICE", "sub": "vi-mo", "market_type": "ENERGY", "decimals": 2, "exchange": "ICE"},
    {"symbol": "NATGAS", "yf_ticker": "NG=F", "name": "Khí tự nhiên Henry Hub", "sub": "vi-mo", "market_type": "ENERGY", "decimals": 3, "exchange": "NYMEX"},
]

# Alias và Bảng ánh xạ Ticker Yahoo Finance
GLOBAL_WATCHLIST = WATCHLIST_QUOC_TE_H4
YF_TICKER_MAP = {item["symbol"]: item["yf_ticker"] for item in WATCHLIST_QUOC_TE_H4}

DATA_DIR = Path(__file__).resolve().parent / "data"
CACHE_DIR = DATA_DIR / "cache"
CACHE_DIR.mkdir(parents=True, exist_ok=True)
DANH_SACH_CHO_FILE = DATA_DIR / "danh_sach_cho.json"
DANH_SACH_CHO_H4_FILE = DATA_DIR / "danh_sach_cho_h4.json"


# =====================================================================
# DATA FETCHING & CACHING
# =====================================================================

def lay_du_lieu_co_cache(symbol: str, end_date: str) -> pd.DataFrame | None:
    """Lấy dữ liệu lịch sử giá cổ phiếu VN (D1) với cache cục bộ theo ngày."""
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


def lay_du_lieu_h4_yahoo(yf_ticker: str, symbol: str) -> pd.DataFrame | None:
    """Lấy dữ liệu 1h từ Yahoo Finance Chart API rồi resample sang khung H4 (4 Giờ)."""
    clean_sym = symbol.replace("/", "_")
    cache_file = CACHE_DIR / f"{clean_sym}_h4.json"

    # Kiểm tra cache nếu được cập nhật trong vòng 2 giờ
    if cache_file.exists():
        try:
            mtime = os.path.getmtime(cache_file)
            if time.time() - mtime < 7200:  # 2 giờ
                with open(cache_file, "r", encoding="utf-8") as f:
                    records = json.load(f)
                df = pd.DataFrame(records)
                df["time"] = pd.to_datetime(df["time"])
                return df
        except Exception:
            pass

    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{yf_ticker}?interval=1h&range=60d"
    headers = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"}
    try:
        r = requests.get(url, headers=headers, timeout=12)
        if r.status_code != 200:
            return None
        data = r.json()
        result = data.get("chart", {}).get("result", [])
        if not result:
            return None
        res_0 = result[0]
        timestamps = res_0.get("timestamp", [])
        quote = res_0.get("indicators", {}).get("quote", [{}])[0]

        df = pd.DataFrame({
            "time": pd.to_datetime(timestamps, unit="s"),
            "open": quote.get("open", []),
            "high": quote.get("high", []),
            "low": quote.get("low", []),
            "close": quote.get("close", []),
            "volume": [0.0 if v is None else float(v) for v in quote.get("volume", [])]
        }).dropna(subset=["close"]).reset_index(drop=True)

        if len(df) < 50:
            return None

        # Resample chuẩn khung 4h
        df_h4 = df.set_index("time").resample("4h").agg({
            "open": "first",
            "high": "max",
            "low": "min",
            "close": "last",
            "volume": "sum"
        }).dropna(subset=["close"]).reset_index()

        # Lưu cache
        df_to_save = df_h4.copy()
        df_to_save["time"] = df_to_save["time"].astype(str)
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(df_to_save.to_dict(orient="records"), f, ensure_ascii=False)

        return df_h4
    except Exception as e:
        print(f"⚠️ Lỗi tải dữ liệu Yahoo H4 {symbol} ({yf_ticker}): {e}")
        return None


# =====================================================================
# TECHNICAL INDICATORS CALCULATION
# =====================================================================

def tinh_toan_chi_bao_ky_thuat(df: pd.DataFrame) -> pd.DataFrame:
    """Tính toán đồng bộ toàn bộ các chỉ báo kỹ thuật phục vụ 5 phương pháp."""
    df = df.copy()
    df.columns = [c.lower() for c in df.columns]

    # Các đường trung bình động (MA)
    df["ma20"] = df["close"].rolling(20).mean()
    df["ema20"] = df["close"].ewm(span=20, adjust=False).mean()
    df["ma30"] = df["close"].rolling(30).mean()
    df["ma50"] = df["close"].rolling(50).mean()
    df["ma200"] = df["close"].rolling(200).mean()

    # Khối lượng trung bình MA 20
    df["vol_ma20"] = df["volume"].rolling(20).mean() if "volume" in df.columns else 0.0

    # ATR (14)
    tr1 = df["high"] - df["low"]
    tr2 = (df["high"] - df["close"].shift(1)).abs()
    tr3 = (df["low"] - df["close"].shift(1)).abs()
    tr = pd.concat([tr1, tr2, tr3], axis=1).max(axis=1)
    df["atr14"] = tr.rolling(14).mean()

    # RSI (14)
    delta = df["close"].diff()
    gain = (delta.where(delta > 0, 0)).rolling(14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(14).mean()
    rs = gain / loss.replace(0, np.nan)
    df["rsi14"] = 100 - (100 / (1 + rs))

    # Bollinger Bands (20, 2)
    std20 = df["close"].rolling(20).std()
    df["bb_mid"] = df["ma20"]
    df["bb_upper"] = df["ma20"] + 2 * std20
    df["bb_lower"] = df["ma20"] - 2 * std20
    df["bb_width"] = (df["bb_upper"] - df["bb_lower"]) / df["bb_mid"].replace(0, np.nan)

    # Ichimoku Kinko Hyo (9, 26, 52)
    h9 = df["high"].rolling(9).max()
    l9 = df["low"].rolling(9).min()
    df["tenkan"] = (h9 + l9) / 2

    h26 = df["high"].rolling(26).max()
    l26 = df["low"].rolling(26).min()
    df["kijun"] = (h26 + l26) / 2

    df["span_a"] = ((df["tenkan"] + df["kijun"]) / 2).shift(26)
    h52 = df["high"].rolling(52).max()
    l52 = df["low"].rolling(52).min()
    df["span_b"] = ((h52 + l52) / 2).shift(26)

    return df


# =====================================================================
# MULTI-STRATEGY SCORING ENGINE (5 PHƯƠNG PHÁP ĐỘC LẬP)
# =====================================================================

def danh_gia_da_phuong_phap(df: pd.DataFrame, allow_short: bool = True) -> dict | None:
    """Chấm điểm và lựa chọn phương pháp tối ưu nhất trong 5 trường phái kinh điển."""
    if len(df) < 205:
        return None

    last = df.iloc[-1]
    prev = df.iloc[-2]
    prev2 = df.iloc[-3]

    close = float(last["close"])
    open_p = float(last["open"])
    high = float(last["high"])
    low = float(last["low"])
    vol = float(last.get("volume", 0.0))
    vol_ma20 = float(last.get("vol_ma20", 0.0))

    ma20 = float(last["ma20"])
    ema20 = float(last["ema20"])
    ma30 = float(last["ma30"])
    ma50 = float(last["ma50"])
    ma200 = float(last["ma200"])
    atr14 = float(last["atr14"])
    rsi14 = float(last["rsi14"])
    bb_upper = float(last["bb_upper"])
    bb_lower = float(last["bb_lower"])
    bb_width = float(last["bb_width"])
    tenkan = float(last["tenkan"])
    kijun = float(last["kijun"])
    span_a = float(last["span_a"]) if not pd.isna(last["span_a"]) else tenkan
    span_b = float(last["span_b"]) if not pd.isna(last["span_b"]) else kijun

    kumo_top = max(span_a, span_b)
    kumo_bottom = min(span_a, span_b)

    total_range = high - low if high > low else 1e-6
    lower_shadow = min(open_p, close) - low
    upper_shadow = high - max(open_p, close)

    signals = []

    # -------------------------------------------------------------
    # 1. ICHIMOKU KINKO HYO (9, 26, 52)
    # -------------------------------------------------------------
    # LONG
    if close >= kumo_top * 0.998:
        score = 40
        reasons = [f"Giá ({close:.4f}) vận động vững chắc phía trên Mây Kumo ({kumo_top:.4f})."]
        if tenkan >= kijun:
            score += 15
            reasons.append(f"Tenkan-sen ({tenkan:.4f}) nằm trên Kijun-sen ({kijun:.4f}) xác nhận xu hướng tăng ngắn hạn.")
        if (prev["tenkan"] <= prev["kijun"] and tenkan >= kijun) or (prev2["tenkan"] <= prev2["kijun"] and tenkan >= kijun):
            score += 15
            reasons.append("Tín hiệu giao cắt vàng TK Cross (Tenkan cắt lên Kijun) vừa xuất hiện.")
        if low <= kijun * 1.008 and close > kijun:
            score += 15
            reasons.append(f"Giá vừa kiểm định thành công đường Kijun-sen ({kijun:.4f}) và rút chân phục hồi tích cực.")
        if close > ma200:
            score += 10
            reasons.append(f"Xu hướng đồng thuận khi giá duy trì trên trục MA 200 ({ma200:.4f}).")

        signals.append({
            "strategy_id": "ICHIMOKU",
            "strategy_name": "Hệ thống Ichimoku Kinko Hyo",
            "setup_name": "Bứt phá & Kiểm định Mây Kumo (Ichimoku Bullish)",
            "direction": "LONG",
            "score": score,
            "ly_do": reasons
        })
    elif allow_short and close <= kumo_bottom * 1.002:
        score = 40
        reasons = [f"Giá ({close:.4f}) nằm hoàn toàn phía dưới Mây Kumo ({kumo_bottom:.4f})."]
        if tenkan <= kijun:
            score += 15
            reasons.append(f"Tenkan-sen ({tenkan:.4f}) nằm dưới Kijun-sen ({kijun:.4f}) củng cố quán tính giảm.")
        if (prev["tenkan"] >= prev["kijun"] and tenkan <= kijun) or (prev2["tenkan"] >= prev2["kijun"] and tenkan <= kijun):
            score += 15
            reasons.append("Tín hiệu giao cắt tử thần TK Cross (Tenkan cắt xuống Kijun) xuất hiện.")
        if high >= kijun * 0.992 and close < kijun:
            score += 15
            reasons.append(f"Giá hồi phục kiểm định Kijun-sen ({kijun:.4f}) và bị từ chối giá cao dứt khoát.")
        if close < ma200:
            score += 10
            reasons.append(f"Đồng thuận xu hướng giảm dài hạn dưới trục MA 200 ({ma200:.4f}).")

        signals.append({
            "strategy_id": "ICHIMOKU",
            "strategy_name": "Hệ thống Ichimoku Kinko Hyo",
            "setup_name": "Thủng Mây Kumo & Từ chối Kijun (Ichimoku Bearish)",
            "direction": "SHORT",
            "score": score,
            "ly_do": reasons
        })

    # -------------------------------------------------------------
    # 2. MA_CROSS (MA 30 / MA 50 & RSI)
    # -------------------------------------------------------------
    # LONG
    if ma30 >= ma50 and close > ma30:
        score = 35
        reasons = [f"Đường MA 30 ({ma30:.4f}) nằm trên MA 50 ({ma50:.4f}) xác lập cấu trúc tăng."]
        had_cross = any(df["ma30"].iloc[-5:] >= df["ma50"].iloc[-5:]) and any(df["ma30"].iloc[-10:-4] <= df["ma50"].iloc[-10:-4])
        if had_cross:
            score += 25
            reasons.append("Giao cắt Golden Cross (MA 30 cắt lên MA 50) vừa được kích hoạt.")
        if 50 <= rsi14 <= 70:
            score += 15
            reasons.append(f"Chỉ số RSI(14) đạt {rsi14:.1f}, nằm trong vùng động lượng tăng giá tối ưu.")
        if close > ma200:
            score += 10
            reasons.append(f"Giá nằm trên trục MA 200 ({ma200:.4f}) củng cố xu hướng dài hạn.")

        signals.append({
            "strategy_id": "MA_CROSS",
            "strategy_name": "Giao cắt Trung bình động (MA Cross)",
            "setup_name": "Golden Cross MA 30 / MA 50 & Động lượng RSI",
            "direction": "LONG",
            "score": score,
            "ly_do": reasons
        })
    elif allow_short and ma30 <= ma50 and close < ma30:
        score = 35
        reasons = [f"Đường MA 30 ({ma30:.4f}) nằm dưới MA 50 ({ma50:.4f}) xác lập cấu trúc giảm."]
        had_cross = any(df["ma30"].iloc[-5:] <= df["ma50"].iloc[-5:]) and any(df["ma30"].iloc[-10:-4] >= df["ma50"].iloc[-10:-4])
        if had_cross:
            score += 25
            reasons.append("Giao cắt Death Cross (MA 30 cắt xuống MA 50) vừa được kích hoạt.")
        if 30 <= rsi14 <= 50:
            score += 15
            reasons.append(f"Chỉ số RSI(14) đạt {rsi14:.1f}, nằm trong vùng áp lực bán chiếm ưu thế.")
        if close < ma200:
            score += 10
            reasons.append(f"Giá nằm dưới trục MA 200 ({ma200:.4f}) củng cố đà suy thoái.")

        signals.append({
            "strategy_id": "MA_CROSS",
            "strategy_name": "Giao cắt Trung bình động (MA Cross)",
            "setup_name": "Death Cross MA 30 / MA 50 & Quán tính giảm RSI",
            "direction": "SHORT",
            "score": score,
            "ly_do": reasons
        })

    # -------------------------------------------------------------
    # 3. MA30_50_PULLBACK (Weinstein Pullback)
    # -------------------------------------------------------------
    ma50_slope_up = df["ma50"].iloc[-1] >= df["ma50"].iloc[-6]
    if ma30 > ma50 and ma50_slope_up:
        recent_low_min = df["low"].iloc[-4:].min()
        if recent_low_min <= ma30 * 1.008 and recent_low_min >= ma50 * 0.990 and close > ma30 and close >= open_p:
            score = 55
            reasons = [
                f"Cấu trúc xu hướng tăng dốc lên rõ nét: MA 30 ({ma30:.4f}) > MA 50 ({ma50:.4f}).",
                f"Giá có nhịp kéo ngược (Pullback) kiểm định thành công vùng đệm MA 30 - MA 50 (đáy {recent_low_min:.4f}).",
                f"Nến đảo chiều rút chân xanh đóng cửa trên MA 30 ({close:.4f}), xác nhận tiếp diễn xu hướng."
            ]
            if close > ma200:
                score += 15
                reasons.append(f"Bảo trợ bởi đường hỗ trợ xu hướng dài hạn MA 200 ({ma200:.4f}).")
            signals.append({
                "strategy_id": "MA30_50_PULLBACK",
                "strategy_name": "Kéo ngược dải MA 30 / MA 50 (Weinstein Pullback)",
                "setup_name": "Pullback kiểm định dải hỗ trợ MA 30 - MA 50 & Tiếp diễn xu hướng",
                "direction": "LONG",
                "score": score,
                "ly_do": reasons
            })
    elif allow_short:
        ma50_slope_down = df["ma50"].iloc[-1] <= df["ma50"].iloc[-6]
        if ma30 < ma50 and ma50_slope_down:
            recent_high_max = df["high"].iloc[-4:].max()
            if recent_high_max >= ma30 * 0.992 and recent_high_max <= ma50 * 1.010 and close < ma30 and close <= open_p:
                score = 55
                reasons = [
                    f"Cấu trúc xu hướng giảm dốc xuống rõ nét: MA 30 ({ma30:.4f}) < MA 50 ({ma50:.4f}).",
                    f"Giá hồi kỹ thuật chạm vùng cản động MA 30 - MA 50 (đỉnh {recent_high_max:.4f}) rồi bị từ chối.",
                    f"Nến đỏ đảo chiều đóng cửa dưới MA 30 ({close:.4f}), xác nhận phe bán tiếp tục áp đảo."
                ]
                if close < ma200:
                    score += 15
                    reasons.append(f"Vận động dưới đường trung bình động dài hạn MA 200 ({ma200:.4f}).")
                signals.append({
                    "strategy_id": "MA30_50_PULLBACK",
                    "strategy_name": "Kéo ngược dải MA 30 / MA 50 (Weinstein Pullback)",
                    "setup_name": "Hồi phục kiểm định kháng cự MA 30 - MA 50 & Tiếp diễn đà giảm",
                    "direction": "SHORT",
                    "score": score,
                    "ly_do": reasons
                })

    # -------------------------------------------------------------
    # 4. BB_SQUEEZE (Bollinger Bands 20, 2 Squeeze & Breakout)
    # -------------------------------------------------------------
    past_widths = df["bb_width"].iloc[-30:]
    is_squeezing = bb_width <= past_widths.quantile(0.35) or df["bb_width"].iloc[-3:].min() <= past_widths.quantile(0.30)
    if is_squeezing:
        if close >= bb_upper * 0.996 and close > open_p:
            score = 60
            reasons = [
                f"Dải Bollinger Bands bước vào giai đoạn nén biên độ chặt chẽ (BB Width: {bb_width:.4f}).",
                f"Thanh nến bứt phá (Breakout) tăng tốc vượt mép trên BB Upper ({bb_upper:.4f}).",
                "Xung lực mở rộng dải băng xác nhận pha khởi đầu chu kỳ biến động lớn."
            ]
            if close > ma200:
                score += 10
                reasons.append(f"Đồng pha với xu hướng tăng trên trục MA 200 ({ma200:.4f}).")
            signals.append({
                "strategy_id": "BB_SQUEEZE",
                "strategy_name": "Co thắt biến động Bollinger Bands (BB Squeeze)",
                "setup_name": "Bollinger Bands Squeeze & Bứt phá vượt dải băng",
                "direction": "LONG",
                "score": score,
                "ly_do": reasons
            })
        elif allow_short and close <= bb_lower * 1.004 and close < open_p:
            score = 60
            reasons = [
                f"Dải Bollinger Bands nén chặt tích lũy trước đó (BB Width: {bb_width:.4f}).",
                f"Nến giảm dứt khoát phá vỡ mép dưới BB Lower ({bb_lower:.4f}).",
                "Mở dải băng Bollinger hướng xuống xác nhận áp lực bán bùng nổ."
            ]
            if close < ma200:
                score += 10
                reasons.append(f"Đồng pha với xu hướng giảm dưới trục MA 200 ({ma200:.4f}).")
            signals.append({
                "strategy_id": "BB_SQUEEZE",
                "strategy_name": "Co thắt biến động Bollinger Bands (BB Squeeze)",
                "setup_name": "Bollinger Bands Squeeze & Phá vỡ đáy dải băng",
                "direction": "SHORT",
                "score": score,
                "ly_do": reasons
            })

    # -------------------------------------------------------------
    # 5. PA_MA200 (Price Action & MA 200)
    # -------------------------------------------------------------
    if close >= ma200 and lower_shadow >= 0.45 * total_range and close >= open_p:
        score = 50
        reasons = [
            f"Nến Bullish Pin Bar rút chân mạnh mẽ với bóng dưới chiếm {lower_shadow/total_range*100:.0f}% biên độ.",
            f"Lực cầu bảo vệ vững chắc ngưỡng hỗ trợ chiến lược MA 200 ({ma200:.4f})."
        ]
        signals.append({
            "strategy_id": "PA_MA200",
            "strategy_name": "Price Action & MA 200",
            "setup_name": "Bullish Pin Bar rút chân kiểm định MA 200",
            "direction": "LONG",
            "score": score,
            "ly_do": reasons
        })
    elif allow_short and close <= ma200 and upper_shadow >= 0.45 * total_range and close <= open_p:
        score = 50
        reasons = [
            f"Nến Bearish Pin Bar từ chối giá cao với bóng trên chiếm {upper_shadow/total_range*100:.0f}% biên độ.",
            f"Kháng cự đường MA 200 ({ma200:.4f}) chặn đứng đà hồi phục."
        ]
        signals.append({
            "strategy_id": "PA_MA200",
            "strategy_name": "Price Action & MA 200",
            "setup_name": "Bearish Pin Bar từ chối ngưỡng MA 200",
            "direction": "SHORT",
            "score": score,
            "ly_do": reasons
        })

    highest_20 = df["high"].iloc[-21:-1].max()
    lowest_20 = df["low"].iloc[-21:-1].min()
    if close >= highest_20 and close > ma200:
        score = 50
        reasons = [
            f"Giá bứt phá đỉnh 20 nến ({highest_20:.4f}) duy trì trên trục MA 200 ({ma200:.4f}).",
            "Xung lực bứt phá giải phóng toàn bộ vùng kháng cự ngắn hạn."
        ]
        signals.append({
            "strategy_id": "PA_MA200",
            "strategy_name": "Price Action & MA 200",
            "setup_name": "Breakout bứt phá đỉnh 20 nến trên nền MA 200",
            "direction": "LONG",
            "score": score,
            "ly_do": reasons
        })
    elif allow_short and close <= lowest_20 and close < ma200:
        score = 50
        reasons = [
            f"Giá phá thủng đáy 20 nến ({lowest_20:.4f}) và trượt dài dưới MA 200 ({ma200:.4f}).",
            "Quán tính bán tháo phá vỡ toàn bộ vùng hỗ trợ ngắn hạn."
        ]
        signals.append({
            "strategy_id": "PA_MA200",
            "strategy_name": "Price Action & MA 200",
            "setup_name": "Breakdown phá đáy 20 nến dưới trục MA 200",
            "direction": "SHORT",
            "score": score,
            "ly_do": reasons
        })

    if not signals:
        return None

    signals.sort(key=lambda s: s["score"], reverse=True)
    return signals[0]


# =====================================================================
# QUÉT TỪNG TÀI SẢN
# =====================================================================

def quet_ma_co_phieu(symbol: str, exchange: str, end_date: str = None) -> dict | None:
    """Phân tích kỹ thuật đa phương pháp cho một mã cổ phiếu Việt Nam (D1, chỉ chiều LONG)."""
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")

    df = lay_du_lieu_co_cache(symbol, end_date)
    if df is None or len(df) < 205:
        return None

    df = tinh_toan_chi_bao_ky_thuat(df)
    last = df.iloc[-1]
    close = float(last["close"])
    vol = float(last.get("volume", 0.0))

    # Điều kiện thanh khoản cổ phiếu: Giá trị giao dịch >= 3 tỷ VNĐ
    gia_tri_gd_ty = (close * vol * 1000) / 1e9
    if gia_tri_gd_ty < 3.0:
        return None

    signal = danh_gia_da_phuong_phap(df, allow_short=False)
    if not signal:
        return None

    ma200 = float(last["ma200"])
    ma50 = float(last["ma50"])
    ma20 = float(last["ma20"])
    entry_price = round(close, 2)

    # Quản trị vị thế D1 cổ phiếu VN
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
    pyramid_trigger = round(entry_price * 1.04, 2)

    pct_tren_ma200 = ((close - ma200) / ma200) * 100

    return {
        "symbol": symbol,
        "exchange": exchange,
        "market_type": "VN_STOCK",
        "timeframe": "D1",
        "direction": "LONG",
        "strategy_id": signal["strategy_id"],
        "strategy_name": signal["strategy_name"],
        "setup_name": signal["setup_name"],
        "score": signal["score"],
        "ly_do": signal["ly_do"],
        "entry_price": entry_price,
        "close": entry_price,
        "stop_loss": stop_loss,
        "take_profit": take_profit,
        "pyramid_trigger": pyramid_trigger,
        "risk_pct": round(risk_pct, 2),
        "reward_pct": round(reward_target_pct, 2),
        "rr_ratio": 2.4,
        "decimals": 2,
        "sub": "chung-khoan",
        "ma200": round(ma200, 2),
        "ma50": round(ma50, 2),
        "ma20": round(ma20, 2),
        "pct_above_ma200": round(pct_tren_ma200, 1),
        "volume": int(vol),
        "gia_tri_gd_ty": round(gia_tri_gd_ty, 1),
        "scan_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


def quet_tai_san_h4(item: dict) -> dict | None:
    """Phân tích kỹ thuật đa phương pháp cho một tài sản Quốc tế H4 (cả LONG và SHORT)."""
    sym = item["symbol"]
    yf = item["yf_ticker"]
    dec = item["decimals"]

    df_h4 = lay_du_lieu_h4_yahoo(yf, sym)
    if df_h4 is None or len(df_h4) < 205:
        return None

    df_h4 = tinh_toan_chi_bao_ky_thuat(df_h4)
    signal = danh_gia_da_phuong_phap(df_h4, allow_short=True)
    if not signal:
        return None

    last = df_h4.iloc[-1]
    close = float(last["close"])
    atr14 = float(last["atr14"])
    dir_ = signal["direction"]

    # Tính mốc quản trị rủi ro H4: SL = 1.5 * ATR, TP = 3.6 * ATR, Pyramid = 1.2 * ATR
    if dir_ == "LONG":
        sl = round(close - 1.5 * atr14, dec)
        tp = round(close + 3.6 * atr14, dec)
        pyr = round(close + 1.2 * atr14, dec)
        risk_pct = round(((close - sl) / close) * 100, 2)
        rew_pct = round(((tp - close) / close) * 100, 2)
    else:
        sl = round(close + 1.5 * atr14, dec)
        tp = round(close - 3.6 * atr14, dec)
        pyr = round(close - 1.2 * atr14, dec)
        risk_pct = round(((sl - close) / close) * 100, 2)
        rew_pct = round(((close - tp) / close) * 100, 2)

    return {
        "symbol": sym,
        "yf_ticker": yf,
        "name": item["name"],
        "exchange": item["exchange"],
        "market_type": item["market_type"],
        "sub": item["sub"],
        "timeframe": "H4",
        "decimals": dec,
        "direction": dir_,
        "strategy_id": signal["strategy_id"],
        "strategy_name": signal["strategy_name"],
        "setup_name": signal["setup_name"],
        "score": signal["score"],
        "ly_do": signal["ly_do"],
        "entry_price": round(close, dec),
        "close": round(close, dec),
        "stop_loss": sl,
        "take_profit": tp,
        "pyramid_trigger": pyr,
        "risk_pct": risk_pct,
        "reward_pct": rew_pct,
        "rr_ratio": 2.4,
        "atr14": round(atr14, dec),
        "ma200": round(float(last["ma200"]), dec),
        "ma50": round(float(last["ma50"]), dec),
        "ma30": round(float(last["ma30"]), dec),
        "ma20": round(float(last["ma20"]), dec),
        "rsi14": round(float(last["rsi14"]), 1),
        "tenkan": round(float(last["tenkan"]), dec),
        "kijun": round(float(last["kijun"]), dec),
        "span_a": round(float(last["span_a"]), dec) if not pd.isna(last["span_a"]) else None,
        "span_b": round(float(last["span_b"]), dec) if not pd.isna(last["span_b"]) else None,
        "scan_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
    }


# =====================================================================
# BỘ QUÉT TOÀN THỊ TRƯỜNG
# =====================================================================

def quet_toan_bo_3_san(end_date: str = None) -> list:
    """Quét 18 mã thanh khoản 3 sàn VN (HOSE, HNX, UPCoM) - Khung D1."""
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")

    print("=" * 68)
    print(f"🔍 BOT TRADER: QUÉT 3 SÀN VN (HOSE, HNX, UPCoM) - D1 [{end_date}]")
    print("=" * 68)

    candidates = []
    total = 0
    for exchange, symbols in WATCHLIST_3_SAN.items():
        print(f"\n📌 Quét sàn {exchange} ({len(symbols)} mã)...")
        for sym in symbols:
            total += 1
            res = quet_ma_co_phieu(sym, exchange, end_date=end_date)
            if res:
                candidates.append(res)
                print(f"  ✨ [{res['score']} pts] {res['symbol']} ({res['exchange']}) | {res['strategy_id']} -> {res['setup_name']}")
                print(f"     Entry: {res['entry_price']} | SL: {res['stop_loss']} (-{res['risk_pct']}%) | TP: {res['take_profit']} (+{res['reward_pct']}%) | R:R 1:{res['rr_ratio']}")
            time.sleep(0.4)

    candidates.sort(key=lambda x: x["score"], reverse=True)
    with open(DANH_SACH_CHO_FILE, "w", encoding="utf-8") as f:
        json.dump(candidates, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 68)
    print(f"✅ HOÀN TẤT QUÉT CỔ PHIẾU VN: Duyệt {total} mã, phát hiện {len(candidates)} cơ hội đạt chuẩn.")
    if candidates:
        top = candidates[0]
        print(f"🏆 TOP 1 VN: {top['symbol']} ({top['exchange']}) - {top['score']} pts | {top['strategy_name']} ({top['setup_name']})")
    print("=" * 68)
    return candidates


def quet_toan_bo_quoc_te_h4() -> list:
    """Quét 12 tài sản Quốc tế (FX, Năng lượng, Hàng hóa) - Khung H4."""
    print("=" * 68)
    print("🌍 BOT TRADER: QUÉT THỊ TRƯỜNG QUỐC TẾ (FX, HÀNG HÓA, NĂNG LƯỢNG) - H4")
    print("=" * 68)

    candidates = []
    for item in WATCHLIST_QUOC_TE_H4:
        sym = item["symbol"]
        print(f"  ⏳ Đang quét {sym:8} ({item['yf_ticker']})...", end="\r")
        res = quet_tai_san_h4(item)
        if res:
            candidates.append(res)
            dir_icon = "🟢 LONG " if res["direction"] == "LONG" else "🔴 SHORT"
            print(f"  ✨ [{res['score']} pts] {dir_icon} {res['symbol']:8} | {res['strategy_id']:15} | Entry: {res['entry_price']} | SL: {res['stop_loss']} (-{res['risk_pct']}%) | TP: {res['take_profit']} (+{res['reward_pct']}%)")
            print(f"     Setup: {res['setup_name']}")
        time.sleep(0.3)

    candidates.sort(key=lambda x: x["score"], reverse=True)
    with open(DANH_SACH_CHO_H4_FILE, "w", encoding="utf-8") as f:
        json.dump(candidates, f, ensure_ascii=False, indent=2)

    print("\n" + "=" * 68)
    print(f"✅ HOÀN TẤT QUÉT QUỐC TẾ H4: Duyệt {len(WATCHLIST_QUOC_TE_H4)} tài sản, phát hiện {len(candidates)} cơ hội đạt chuẩn.")
    if candidates:
        top = candidates[0]
        dir_str = "LONG (Mua)" if top["direction"] == "LONG" else "SHORT (Bán)"
        print(f"🏆 TOP 1 H4: {top['symbol']} ({top['exchange']}) - {dir_str} - {top['score']} pts | {top['strategy_name']} ({top['setup_name']})")
    print("=" * 68)
    return candidates


def quet_tat_ca():
    """Quét đồng thời cả Cổ phiếu VN (D1) và Quốc tế (H4)."""
    quet_toan_bo_3_san()
    print("\n")
    quet_toan_bo_quoc_te_h4()


if __name__ == "__main__":
    if "--h4" in sys.argv:
        quet_toan_bo_quoc_te_h4()
    else:
        quet_tat_ca()
