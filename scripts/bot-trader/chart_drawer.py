# -*- coding: utf-8 -*-
"""Vẽ biểu đồ kỹ thuật Dark Obsidian cho Bot Trader trên Gikky.net.
Hỗ trợ cả Daily Chart (Cổ phiếu VN) và H4 Chart (Quốc tế: FX, Hàng hóa, Năng lượng)
với hiển thị trực quan riêng biệt cho 5 phương pháp kỹ thuật:
- ICHIMOKU: Tenkan-sen, Kijun-sen, Senkou Span A/B và tô màu Mây Kumo (fill_between)
- MA_CROSS / MA30_50_PULLBACK: EMA 20, MA 30, MA 50, MA 200
- BB_SQUEEZE: Bollinger Bands (Upper, Middle, Lower) và MA 50
- PA_MA200: MA 20, MA 50, MA 200
"""

import os
from datetime import datetime
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import mplfinance as mpf
import pandas as pd
import numpy as np

from scanner import lay_du_lieu_co_cache, lay_du_lieu_h4_yahoo, tinh_toan_chi_bao_ky_thuat

DATA_DIR = Path(__file__).resolve().parent / "data"
CHARTS_DIR = DATA_DIR / "charts"
CHARTS_DIR.mkdir(parents=True, exist_ok=True)


def ve_bieu_do_bot_trader(
    symbol: str,
    exchange: str,
    entry_price: float,
    stop_loss: float,
    take_profit: float,
    pyramid_trigger: float = None,
    end_date: str = None,
    setup_name: str = "Price Action & MA 200",
    strategy_id: str = "PA_MA200",
    direction: str = "LONG",
    timeframe: str = "D1",
    decimals: int = 2,
    df_data: pd.DataFrame = None,
    yf_ticker: str = None
) -> str:
    """Vẽ và xuất ảnh biểu đồ nến chuẩn Dark Obsidian kèm các mốc vị thế giao dịch."""
    clean_sym = symbol.replace("/", "_")
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")

    # 1. Chuẩn bị DataFrame
    if df_data is not None and len(df_data) >= 50:
        df = df_data.copy()
    elif timeframe == "H4":
        ticker = yf_ticker if yf_ticker else clean_sym
        df = lay_du_lieu_h4_yahoo(ticker, symbol)
        if df is None:
            raise ValueError(f"Không thể lấy dữ liệu H4 cho {symbol} ({ticker})")
    else:
        df = lay_du_lieu_co_cache(symbol, end_date)
        if df is None:
            raise ValueError(f"Không thể lấy dữ liệu D1 cho {symbol}")

    # Đảm bảo các chỉ báo đã được tính toán
    if "ma200" not in [c.lower() for c in df.columns]:
        df = tinh_toan_chi_bao_ky_thuat(df)

    df_plot = df.copy()
    # Chuẩn hóa tên cột cho mplfinance (Date/Time, Open, High, Low, Close, Volume)
    col_map = {}
    for c in df_plot.columns:
        cl = c.lower()
        if cl in ("time", "date"):
            col_map[c] = "Date"
        elif cl in ("open", "high", "low", "close", "volume"):
            col_map[c] = cl.capitalize()
    df_plot.rename(columns=col_map, inplace=True)

    if "Date" in df_plot.columns:
        df_plot["Date"] = pd.to_datetime(df_plot["Date"])
        df_plot.set_index("Date", inplace=True)

    # Số lượng nến hiển thị theo khung thời gian:
    # - Khung D1 (Cổ phiếu VN): 180 nến (nếu dữ liệu < 180 thì lấy tối đa) để bao quát chu kỳ trung-dài hạn và MA 200
    # - Khung H4 (Quốc tế): 160 nến (nếu dữ liệu < 160 thì lấy tối đa) để bao quát sóng trung hạn ~1.5 tháng
    num_candles = 160 if timeframe == "H4" else 180
    slice_len = min(len(df_plot), num_candles)
    df_slice = df_plot.iloc[-slice_len:].copy()

    # Style Gikky Dark Obsidian
    mc = mpf.make_marketcolors(
        up='#26a69a',
        down='#ef5350',
        edge='inherit',
        wick='inherit',
        volume={'up': '#26a69a', 'down': '#ef5350'}
    )
    s = mpf.make_mpf_style(
        base_mpf_style='nightclouds',
        marketcolors=mc,
        gridcolor='#23272e',
        facecolor='#14171d',
        edgecolor='#2d3139',
        figcolor='#0f1115',
        y_on_right=True
    )

    # 2. Xây dựng addplot theo từng phương pháp
    addplots = []
    strat = strategy_id.upper()

    if strat == "ICHIMOKU":
        if "tenkan" in df_slice.columns and "kijun" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["tenkan"], color="#ef4444", width=1.5))
            addplots.append(mpf.make_addplot(df_slice["kijun"], color="#3b82f6", width=1.8))
        if "span_a" in df_slice.columns and "span_b" in df_slice.columns:
            # Thêm đường viền Mây Kumo
            addplots.append(mpf.make_addplot(df_slice["span_a"], color="#10b981", width=1.0, linestyle="--"))
            addplots.append(mpf.make_addplot(df_slice["span_b"], color="#f43f5e", width=1.0, linestyle="--"))

    elif strat in ("MA_CROSS", "MA30_50_PULLBACK"):
        if "ma30" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["ma30"], color="#fbbf24", width=1.8))  # MA 30 Vàng
        if "ma50" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["ma50"], color="#3b82f6", width=1.6))  # MA 50 Xanh
        if "ema20" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["ema20"], color="#a855f7", width=1.1, linestyle="--"))  # EMA 20 Tím
        if "ma200" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["ma200"], color="#f97316", width=2.0))  # MA 200 Cam

    elif strat == "BB_SQUEEZE":
        if "bb_upper" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["bb_upper"], color="#38bdf8", width=1.4))
            addplots.append(mpf.make_addplot(df_slice["bb_mid"], color="#fbbf24", width=1.2, linestyle="--"))
            addplots.append(mpf.make_addplot(df_slice["bb_lower"], color="#38bdf8", width=1.4))
        if "ma50" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["ma50"], color="#3b82f6", width=1.5))

    else:  # PA_MA200 và mặc định
        if "ma200" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["ma200"], color="#f59e0b", width=2.2))
        if "ma50" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["ma50"], color="#3b82f6", width=1.2))
        if "ma20" in df_slice.columns:
            addplots.append(mpf.make_addplot(df_slice["ma20"], color="#a855f7", width=1.0, linestyle="--"))

    # 3. Các đường ngang mốc vị thế (TP, Entry, SL, Nhồi lệnh)
    hlines = [take_profit, entry_price, stop_loss]
    hcolors = ["#10b981", "#fbbf24", "#f43f5e"]
    hstyles = ["--", "-", "-."]
    hwidths = [1.8, 1.8, 1.8]

    if pyramid_trigger:
        hlines.append(pyramid_trigger)
        hcolors.append("#38bdf8")
        hstyles.append(":")
        hwidths.append(1.5)

    # Kiểm tra Volume
    has_volume = bool("Volume" in df_slice.columns and df_slice["Volume"].sum() > 0)

    chart_file = CHARTS_DIR / f"chart_{clean_sym}_{timeframe}_{end_date}.png"

    fig, axlist = mpf.plot(
        df_slice,
        type="candle",
        style=s,
        addplot=addplots if addplots else None,
        volume=has_volume,
        figsize=(15, 8.5),
        hlines=dict(
            hlines=hlines,
            colors=hcolors,
            linestyle=hstyles,
            linewidths=hwidths
        ),
        returnfig=True
    )

    ax_main = axlist[0]

    # Tô màu Mây Kumo nếu phương pháp là ICHIMOKU
    if strat == "ICHIMOKU" and "span_a" in df_slice.columns and "span_b" in df_slice.columns:
        x_indices = np.arange(len(df_slice))
        sa = df_slice["span_a"].values
        sb = df_slice["span_b"].values
        ax_main.fill_between(x_indices, sa, sb, where=(sa >= sb), color="#10b981", alpha=0.18, interpolate=True)
        ax_main.fill_between(x_indices, sa, sb, where=(sa < sb), color="#ef4444", alpha=0.18, interpolate=True)

    # Tiêu đề
    tf_label = "H4 Chart" if timeframe == "H4" else "Daily Chart"
    dir_str = "LONG (Mua)" if direction == "LONG" else "SHORT (Bán khống)"
    ax_main.set_title(
        f"{symbol} ({exchange}) — {tf_label} [{dir_str}] ({setup_name})",
        color="#f8fafc",
        fontsize=15,
        fontweight="bold",
        pad=15
    )

    # Watermark
    ax_main.text(
        0.98, 0.04, "gikky.net · Bot Trader",
        transform=ax_main.transAxes,
        color="#94a3b8", fontsize=11, fontweight="bold",
        ha="right", va="bottom", alpha=0.7
    )

    # Chú thích các mốc giá theo decimals kèm box nền Dark Obsidian chống chìm nến
    if direction == "LONG":
        risk_pct = ((entry_price - stop_loss) / entry_price) * 100
        reward_pct = ((take_profit - entry_price) / entry_price) * 100
    else:
        risk_pct = ((stop_loss - entry_price) / entry_price) * 100
        reward_pct = ((entry_price - take_profit) / entry_price) * 100
    rr = reward_pct / risk_pct if risk_pct > 0 else 0

    badge_props = dict(boxstyle="round,pad=0.25", facecolor="#14171d", edgecolor="#23272e", alpha=0.85)

    ax_main.text(0.02, 0.95, f"Take Profit (TP): {take_profit:.{decimals}f} (+{reward_pct:.1f}% / {rr:.1f}R)", transform=ax_main.transAxes, color="#10b981", fontsize=10, fontweight="bold", bbox=badge_props)
    if pyramid_trigger:
        ax_main.text(0.02, 0.90, f"Nhồi lệnh: {pyramid_trigger:.{decimals}f} (Gia tăng vị thế)", transform=ax_main.transAxes, color="#38bdf8", fontsize=10, fontweight="bold", bbox=badge_props)
        ax_main.text(0.02, 0.85, f"Entry ({dir_str}): {entry_price:.{decimals}f}", transform=ax_main.transAxes, color="#fbbf24", fontsize=10, fontweight="bold", bbox=badge_props)
        ax_main.text(0.02, 0.80, f"Stop Loss (SL): {stop_loss:.{decimals}f} (-{risk_pct:.1f}%)", transform=ax_main.transAxes, color="#f43f5e", fontsize=10, fontweight="bold", bbox=badge_props)
    else:
        ax_main.text(0.02, 0.90, f"Entry ({dir_str}): {entry_price:.{decimals}f}", transform=ax_main.transAxes, color="#fbbf24", fontsize=10, fontweight="bold", bbox=badge_props)
        ax_main.text(0.02, 0.85, f"Stop Loss (SL): {stop_loss:.{decimals}f} (-{risk_pct:.1f}%)", transform=ax_main.transAxes, color="#f43f5e", fontsize=10, fontweight="bold", bbox=badge_props)

    # Chú giải kỹ thuật
    if strat == "ICHIMOKU":
        ax_main.text(0.02, 0.74 if pyramid_trigger else 0.78, "Tenkan-sen (Đỏ) | Kijun-sen (Xanh) | Mây Kumo", transform=ax_main.transAxes, color="#94a3b8", fontsize=10, bbox=badge_props)
    elif strat in ("MA_CROSS", "MA30_50_PULLBACK"):
        ax_main.text(0.02, 0.74 if pyramid_trigger else 0.78, "EMA 20 (Tím) | MA 30 (Vàng) | MA 50 (Xanh) | MA 200 (Cam)", transform=ax_main.transAxes, color="#94a3b8", fontsize=10, bbox=badge_props)
    elif strat == "BB_SQUEEZE":
        ax_main.text(0.02, 0.74 if pyramid_trigger else 0.78, "Dải Bollinger Bands (20, 2) | MA 50 (Xanh)", transform=ax_main.transAxes, color="#94a3b8", fontsize=10, bbox=badge_props)
    else:
        ax_main.text(0.02, 0.74 if pyramid_trigger else 0.78, "Đường MA 200 ngày (Vàng) | MA 50 (Xanh)", transform=ax_main.transAxes, color="#f59e0b", fontsize=10, bbox=badge_props)

    fig.savefig(chart_file, dpi=150, bbox_inches="tight")
    plt.close(fig)

    return str(chart_file)


if __name__ == "__main__":
    p = ve_bieu_do_bot_trader("GBP/USD", "Forex", 1.3391, 1.3359, 1.3470, 1.3415, None, "Bứt phá Mây Kumo", strategy_id="ICHIMOKU", direction="LONG", timeframe="H4", decimals=4, yf_ticker="GBPUSD=X")
    print(f"Đã xuất biểu đồ tại: {p}")
