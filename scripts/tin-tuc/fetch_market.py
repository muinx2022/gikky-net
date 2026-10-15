import yfinance as yf
import json
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

symbols = {
    "Nikkei 225": "^N225",
    "Hang Seng": "^HSI",
    "Shanghai": "000001.SS",
    "KOSPI": "^KS11",
    "DAX": "^GDAXI",
    "FTSE 100": "^FTSE",
    "CAC 40": "^FCHI",
    "STOXX 600": "^STOXX",
    "S&P 500 Fut": "ES=F",
    "Nasdaq Fut": "NQ=F",
    "Dow Fut": "YM=F",
    "Brent": "BZ=F",
    "WTI": "CL=F",
    "Gold": "GC=F",
    "DXY": "DX-Y.NYB",
    "EUR/USD": "EURUSD=X",
    "USD/JPY": "USDJPY=X"
}

results = {}
for name, sym in symbols.items():
    try:
        t = yf.Ticker(sym)
        fi = t.fast_info
        last = fi.last_price
        prev = fi.previous_close
        if last is not None and prev is not None and prev > 0:
            chg = last - prev
            pct = (chg / prev) * 100
            results[name] = {
                "symbol": sym,
                "last": round(last, 2),
                "prev": round(prev, 2),
                "change": round(chg, 2),
                "pct": round(pct, 2)
            }
        else:
            results[name] = {"symbol": sym, "last": last, "prev": prev}
    except Exception as e:
        results[name] = {"symbol": sym, "error": str(e)}

print(json.dumps(results, indent=2, ensure_ascii=False))
