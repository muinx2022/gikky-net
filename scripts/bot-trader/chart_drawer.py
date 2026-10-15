# -*- coding: utf-8 -*-
"""Vẽ biểu đồ kỹ thuật Daily Chart chuẩn Dark Obsidian cho Bot Trader."""

import os
from datetime import datetime
from pathlib import Path
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import mplfinance as mpf
import pandas as pd

from scanner import lay_du_lieu_co_cache

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
    setup_name: str = "Price Action & MA 200"
) -> str:
    """Vẽ và xuất ảnh biểu đồ nến ngày kèm MA 200 và các đường vị thế giao dịch."""
    if not end_date:
        end_date = datetime.now().strftime("%Y-%m-%d")

    df = lay_du_lieu_co_cache(symbol, end_date)
    if df is None:
        raise ValueError(f"Không thể lấy dữ liệu cho mã {symbol}")

    df_plot = df.copy()
    df_plot.columns = [c.capitalize() for c in df_plot.columns]
    if "Time" in df_plot.columns:
        df_plot["Time"] = pd.to_datetime(df_plot["Time"])
        df_plot.set_index("Time", inplace=True)

    # Tính các đường MA
    df_plot["MA200"] = df_plot["Close"].rolling(200).mean()
    df_plot["MA50"] = df_plot["Close"].rolling(50).mean()
    df_plot["MA20"] = df_plot["Close"].rolling(20).mean()

    # Cắt 100 nến gần nhất để hiển thị trực quan, rõ ràng
    df_slice = df_plot.iloc[-100:].copy()

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

    addplots = [
        mpf.make_addplot(df_slice['MA200'], color='#f59e0b', width=2.2),  # MA 200 Vàng cam nổi bật
        mpf.make_addplot(df_slice['MA50'], color='#3b82f6', width=1.2),   # MA 50 Xanh dương
        mpf.make_addplot(df_slice['MA20'], color='#a855f7', width=1.0, linestyle='--') # MA 20 Tím
    ]

    hlines = [take_profit, entry_price, stop_loss]
    hcolors = ['#10b981', '#fbbf24', '#f43f5e']
    hstyles = ['--', '-', '-.']
    hwidths = [1.8, 1.8, 1.8]

    if pyramid_trigger:
        hlines.insert(1, pyramid_trigger)
        hcolors.insert(1, '#38bdf8')
        hstyles.insert(1, ':')
        hwidths.insert(1, 1.5)

    chart_path = CHARTS_DIR / f"chart_{symbol}_{end_date}.png"

    fig, axlist = mpf.plot(
        df_slice,
        type='candle',
        style=s,
        addplot=addplots,
        volume=True,
        figsize=(14, 8),
        hlines=dict(
            hlines=hlines,
            colors=hcolors,
            linestyle=hstyles,
            linewidths=hwidths
        ),
        returnfig=True
    )

    ax_main = axlist[0]
    ax_main.set_title(
        f"{symbol} / {exchange} — Daily Chart ({setup_name})",
        color="#f8fafc",
        fontsize=15,
        fontweight='bold',
        pad=15
    )

    # Watermark
    ax_main.text(
        0.98, 0.04, 'gikky.net · Bot Trader',
        transform=ax_main.transAxes,
        color='#94a3b8', fontsize=11, fontweight='bold',
        ha='right', va='bottom', alpha=0.7
    )

    # Chú thích các mốc giá
    risk_pct = ((entry_price - stop_loss) / entry_price) * 100
    reward_pct = ((take_profit - entry_price) / entry_price) * 100
    rr = reward_pct / risk_pct if risk_pct > 0 else 0

    ax_main.text(0.02, 0.95, f'Take Profit (TP): {take_profit} (+{reward_pct:.1f}% / {rr:.1f}R)', transform=ax_main.transAxes, color='#10b981', fontsize=10, fontweight='bold')
    if pyramid_trigger:
        ax_main.text(0.02, 0.90, f'Nhồi lệnh: {pyramid_trigger} (Vượt cản)', transform=ax_main.transAxes, color='#38bdf8', fontsize=10, fontweight='bold')
        ax_main.text(0.02, 0.85, f'Entry (Mua): {entry_price}', transform=ax_main.transAxes, color='#fbbf24', fontsize=10, fontweight='bold')
        ax_main.text(0.02, 0.80, f'Stop Loss (SL): {stop_loss} (-{risk_pct:.1f}%)', transform=ax_main.transAxes, color='#f43f5e', fontsize=10, fontweight='bold')
        ax_main.text(0.02, 0.75, f'Đường MA 200 ngày (Vàng)', transform=ax_main.transAxes, color='#f59e0b', fontsize=10)
    else:
        ax_main.text(0.02, 0.90, f'Entry (Mua): {entry_price}', transform=ax_main.transAxes, color='#fbbf24', fontsize=10, fontweight='bold')
        ax_main.text(0.02, 0.85, f'Stop Loss (SL): {stop_loss} (-{risk_pct:.1f}%)', transform=ax_main.transAxes, color='#f43f5e', fontsize=10, fontweight='bold')
        ax_main.text(0.02, 0.80, f'Đường MA 200 ngày (Vàng)', transform=ax_main.transAxes, color='#f59e0b', fontsize=10)

    fig.savefig(chart_path, dpi=150, bbox_inches='tight')
    plt.close(fig)

    return str(chart_path)


if __name__ == "__main__":
    p = ve_bieu_do_bot_trader("HDB", "HOSE", 28.05, 27.08, 30.38, 29.20, None, "Bullish Pin Bar trên MA 200")
    print(f"Đã xuất biểu đồ tại: {p}")
