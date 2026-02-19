"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BarChart2, Pencil, PlusCircle, Trash2 } from "lucide-react";
import { api } from "../../lib/api";
import { getAuthToken } from "../../lib/auth-storage";
import { useAuth } from "../../components/AuthContext";
import { useCategories } from "../../lib/useCategories";
import { setPageMeta } from "../../lib/meta";
import ForumLayout from "../../components/ForumLayout";
import TradeCard from "../../components/TradeCard";
import ConfirmModal from "../../components/ConfirmModal";

interface Stats {
  totalTrades: number;
  closedTrades: number;
  wins: number;
  losses: number;
  winRate: number;
  totalPnl: number;
  bestTrade: number;
  worstTrade: number;
  avgRR: number;
  equityCurve: { date: string; value: number }[];
}

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

function EquityCurve({ data }: { data: { date: string; value: number }[] }) {
  if (!data || data.length < 2) return null;

  const values = data.map((d) => d.value);
  const min = Math.min(...values, 0);
  const max = Math.max(...values, 0);
  const range = max - min || 1;
  const w = 600;
  const h = 80;
  const pad = 4;

  const pts = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = pad + ((max - d.value) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const zeroY = pad + ((max - 0) / range) * (h - pad * 2);
  const last = values[values.length - 1];
  const color = last >= 0 ? "#16a34a" : "#dc2626";

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="h-20 w-full" preserveAspectRatio="none">
      <line x1={pad} y1={zeroY} x2={w - pad} y2={zeroY} stroke="#e2e8f0" strokeWidth="1" strokeDasharray="4,4" />
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export default function JournalPage() {
  const router = useRouter();
  const { currentUser, hydrated } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);
  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [marketFilter, setMarketFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [deleteTarget, setDeleteTarget] = useState<Trade | null>(null);
  const categories = useCategories();

  useEffect(() => {
    setPageMeta("Nhật ký giao dịch", "Ghi lại, phân tích và theo dõi lịch sử giao dịch cá nhân của bạn trên Gikky.");
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const jwt = getAuthToken();
    if (!jwt) router.replace("/");
  }, [hydrated, router]);

  const loadStats = useCallback(async () => {
    const jwt = getAuthToken();
    if (!jwt) return;
    try {
      const res = await api.get("/api/journal-trades/my/stats", { headers: { Authorization: `Bearer ${jwt}` } });
      setStats(res.data?.data ?? null);
    } catch {
      // ignore
    }
  }, []);

  const loadTrades = useCallback(async () => {
    const jwt = getAuthToken();
    if (!jwt) return;
    setLoading(true);
    try {
      const params: Record<string, any> = { page, pageSize: 15 };
      if (outcomeFilter) params.outcome = outcomeFilter;
      if (marketFilter) params.market = marketFilter;
      const res = await api.get("/api/journal-trades/my", {
        headers: { Authorization: `Bearer ${jwt}` },
        params,
      });
      setTrades(res.data?.data ?? []);
      setTotalPages(res.data?.meta?.pagination?.pageCount ?? 1);
    } catch {
      setTrades([]);
    } finally {
      setLoading(false);
    }
  }, [page, outcomeFilter, marketFilter]);

  useEffect(() => {
    if (!hydrated || !currentUser) return;
    loadStats();
    loadTrades();
  }, [hydrated, currentUser, loadStats, loadTrades]);

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const jwt = getAuthToken();
    if (!jwt) return;
    try {
      await api.delete(`/api/journal-trades/${deleteTarget.documentId}`, {
        headers: { Authorization: `Bearer ${jwt}` },
      });
      setDeleteTarget(null);
      loadStats();
      loadTrades();
    } catch {
      // ignore
    }
  };

  if (!hydrated || !currentUser) return null;

  const pnlPositive = (stats?.totalPnl ?? 0) >= 0;

  return (
    <ForumLayout categories={categories}>
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <BarChart2 size={20} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">Nhật ký giao dịch</h1>
              <p className="text-xs text-slate-400">{stats?.totalTrades ?? 0} trades · {stats?.closedTrades ?? 0} đã đóng</p>
            </div>
          </div>
          <Link href="/journal/new" className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
            <PlusCircle size={15} />
            Thêm trade
          </Link>
        </div>

        {stats && (
          <>
            <div className="border-t border-slate-100" />
            <div className="grid grid-cols-3 divide-x divide-slate-100">
              <div className="px-5 py-3">
                <p className="mb-0.5 text-xs text-slate-400">Win rate</p>
                <p className={`text-lg font-bold ${(stats.winRate ?? 0) >= 50 ? "text-emerald-600" : "text-red-600"}`}>{stats.winRate}%</p>
                <p className="text-[11px] text-slate-400">{stats.wins}W · {stats.losses}L</p>
              </div>
              <div className="px-5 py-3">
                <p className="mb-0.5 text-xs text-slate-400">Tổng P&L</p>
                <p className={`text-lg font-bold ${pnlPositive ? "text-emerald-600" : "text-red-600"}`}>
                  {pnlPositive ? "+" : ""}
                  {stats.totalPnl.toLocaleString("vi-VN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
              <div className="px-5 py-3">
                <p className="mb-0.5 text-xs text-slate-400">Avg R:R</p>
                <p className="text-lg font-bold text-slate-800">{stats.avgRR > 0 ? stats.avgRR.toFixed(2) : "-"}</p>
              </div>
            </div>

            {stats.equityCurve.length >= 2 && (
              <>
                <div className="border-t border-slate-100" />
                <div className="px-5 py-3">
                  <p className="mb-1 text-xs font-medium text-slate-400">Đường vốn</p>
                  <EquityCurve data={stats.equityCurve} />
                </div>
              </>
            )}
          </>
        )}

        <div className="border-t border-slate-100" />

        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3">
          <span className="mr-1 text-sm font-semibold text-slate-700">Lọc:</span>
          <select
            value={outcomeFilter}
            onChange={(e) => {
              setOutcomeFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 focus:border-blue-400 focus:outline-none"
          >
            <option value="">Tất cả kết quả</option>
            <option value="win">Thắng</option>
            <option value="loss">Thua</option>
            <option value="breakeven">Hòa</option>
            <option value="open">Đang mở</option>
          </select>
          <select
            value={marketFilter}
            onChange={(e) => {
              setMarketFilter(e.target.value);
              setPage(1);
            }}
            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs text-slate-600 focus:border-blue-400 focus:outline-none"
          >
            <option value="">Tất cả thị trường</option>
            <option value="crypto">Crypto</option>
            <option value="forex">Forex</option>
            <option value="stock">Cổ phiếu</option>
            <option value="futures">Futures</option>
            <option value="other">Khác</option>
          </select>
        </div>

        {loading ? (
          <div className="p-10 text-center text-sm text-slate-400">Đang tải...</div>
        ) : trades.length === 0 ? (
          <div className="p-10 text-center">
            <p className="text-slate-500">Chưa có trade nào.</p>
            <Link href="/journal/new" className="mt-3 inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700">
              <PlusCircle size={14} />
              Thêm trade đầu tiên
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {trades.map((trade) => (
              <div key={trade.documentId} className="group relative">
                <TradeCard trade={trade} />
                <div className="pointer-events-none absolute right-4 top-1/2 flex -translate-y-1/2 items-center gap-1 opacity-0 transition group-hover:pointer-events-auto group-hover:opacity-100">
                  <Link
                    href={`/journal/${trade.documentId}/edit`}
                    onClick={(e) => e.stopPropagation()}
                    className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500 shadow-sm transition hover:border-blue-300 hover:text-blue-600"
                  >
                    <Pencil size={11} /> Sửa
                  </Link>
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setDeleteTarget(trade);
                    }}
                    className="flex items-center gap-1 rounded-md border border-red-100 bg-white px-2 py-1 text-xs text-red-500 shadow-sm transition hover:bg-red-50"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 border-t border-slate-100 py-3">
            <button
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Trước
            </button>
            <span className="text-xs text-slate-400">{page} / {totalPages}</span>
            <button
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
              className="rounded-md border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50 disabled:opacity-40"
            >
              Sau
            </button>
          </div>
        )}
      </div>

      <ConfirmModal
        isOpen={!!deleteTarget}
        title="Xóa trade"
        message={`Bạn có chắc muốn xóa trade ${deleteTarget?.symbol ?? ""}? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        confirmColor="red"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />
    </ForumLayout>
  );
}
