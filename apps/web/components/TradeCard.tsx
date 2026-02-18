"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, Calendar } from "lucide-react";

interface Trade {
  id: number;
  documentId: string;
  symbol: string;
  market: string;
  direction: "long" | "short";
  outcome: "win" | "loss" | "breakeven" | "open";
  pnl?: number | null;
  pnlPercent?: number | null;
  entryDate: string;
  strategy?: string | null;
  isPublic?: boolean;
  author?: { id: number; username: string } | null;
}

const OUTCOME_STYLES: Record<string, string> = {
  win:       "bg-emerald-50 text-emerald-700 border-emerald-200 ring-1 ring-emerald-100",
  loss:      "bg-red-50 text-red-700 border-red-200 ring-1 ring-red-100",
  breakeven: "bg-slate-100 text-slate-600 border-slate-200",
  open:      "bg-blue-50 text-blue-700 border-blue-200 ring-1 ring-blue-100",
};
const OUTCOME_LABELS: Record<string, string> = {
  win: "Thắng", loss: "Thua", breakeven: "Hòa", open: "Đang mở",
};
const MARKET_LABELS: Record<string, string> = {
  crypto: "Crypto", forex: "Forex", stock: "Cổ phiếu", futures: "Futures", other: "Khác",
};

function relativeDate(dateStr: string) {
  const now = Date.now();
  const diff = Math.floor((now - new Date(dateStr).getTime()) / 1000);
  if (diff < 60)     return "vừa xong";
  if (diff < 3600)   return `${Math.floor(diff / 60)}p trước`;
  if (diff < 86400)  return `${Math.floor(diff / 3600)}g trước`;
  if (diff < 604800) return `${Math.floor(diff / 86400)}ng trước`;
  const d = new Date(dateStr);
  return d.toLocaleDateString("vi-VN", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export default function TradeCard({ trade, showAuthor = false }: { trade: Trade; showAuthor?: boolean }) {
  const isLong      = trade.direction === "long";
  const pnlPositive = (trade.pnl ?? 0) >= 0;
  const hasPnl      = trade.pnl != null;

  return (
    <Link
      href={`/journal/${trade.documentId}`}
      className="flex items-start justify-between gap-4 px-5 py-3.5 transition hover:bg-slate-50"
    >
      {/* Left: direction icon + symbol info */}
      <div className="flex min-w-0 items-center gap-3">
        <div
          className={`flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl ${
            isLong ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-600"
          }`}
        >
          {isLong ? <TrendingUp size={17} /> : <TrendingDown size={17} />}
        </div>

        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-[15px] font-bold text-slate-900">{trade.symbol}</span>
            <span
              className={`rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase ${
                isLong ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
              }`}
            >
              {isLong ? "Long" : "Short"}
            </span>
          </div>

          <div className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-400">
            <span>{MARKET_LABELS[trade.market] ?? trade.market}</span>
            {trade.strategy && (
              <>
                <span className="text-slate-300">·</span>
                <span className="truncate max-w-[120px]">{trade.strategy}</span>
              </>
            )}
            <span className="text-slate-300">·</span>
            <span className="flex items-center gap-0.5">
              <Calendar size={10} />
              {relativeDate(trade.entryDate)}
            </span>
            {showAuthor && trade.author && (
              <>
                <span className="text-slate-300">·</span>
                <span
                  className="text-slate-500 hover:text-blue-600 transition"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    window.location.href = `/user/${trade.author!.username}`;
                  }}
                >
                  @{trade.author.username}
                </span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right: outcome + P&L */}
      <div className="flex flex-shrink-0 flex-col items-end gap-1">
        <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${OUTCOME_STYLES[trade.outcome] ?? OUTCOME_STYLES.open}`}>
          {OUTCOME_LABELS[trade.outcome] ?? trade.outcome}
        </span>
        {hasPnl && (
          <span className={`text-sm font-bold ${pnlPositive ? "text-emerald-600" : "text-red-600"}`}>
            {pnlPositive ? "+" : ""}{trade.pnl!.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        )}
      </div>
    </Link>
  );
}
