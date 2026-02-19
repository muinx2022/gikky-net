"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, BarChart2 } from "lucide-react";
import { api } from "../../lib/api";
import { setPageMeta } from "../../lib/meta";
import { useCategories } from "../../lib/useCategories";
import ForumLayout from "../../components/ForumLayout";
import TradeCard from "../../components/TradeCard";

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

export default function TradingCommunityPage() {
  const categories = useCategories();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setPageMeta("Cộng đồng giao dịch", "Theo dõi và chia sẻ trade công khai từ cộng đồng nhà đầu tư trên Gikky.");
  }, []);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [marketFilter, setMarketFilter] = useState("");
  const [outcomeFilter, setOutcomeFilter] = useState("");

  const loadFeed = useCallback(async (targetPage: number, append: boolean) => {
    if (targetPage === 1) setLoading(true);
    else setLoadingMore(true);
    try {
      const params: Record<string, any> = { page: targetPage, pageSize: 20 };
      if (marketFilter)  params.market  = marketFilter;
      if (outcomeFilter) params.outcome = outcomeFilter;

      const res = await api.get("/api/journal-trades/feed", { params });
      const data: Trade[] = res.data?.data ?? [];
      setTrades((prev) => (append ? [...prev, ...data] : data));
      const pageCount = res.data?.meta?.pagination?.pageCount ?? 1;
      setHasMore(targetPage < pageCount);
    } catch {
      if (!append) setTrades([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [marketFilter, outcomeFilter]);

  useEffect(() => {
    setPage(1);
    setTrades([]);
    loadFeed(1, false);
  }, [marketFilter, outcomeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleLoadMore = () => {
    const next = page + 1;
    setPage(next);
    loadFeed(next, true);
  };

  return (
    <ForumLayout categories={categories}>
      <div className="space-y-4">
        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            Đang tải...
          </div>
        ) : (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {/* Header — cat page style */}
            <div className="px-5 py-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
                    <BarChart2 size={20} />
                  </div>
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Cộng đồng</div>
                    <h1 className="text-xl font-bold text-slate-900">Nhật ký giao dịch</h1>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex items-center gap-2">
                  <select
                    value={marketFilter}
                    onChange={(e) => setMarketFilter(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Tất cả TT</option>
                    <option value="crypto">Crypto</option>
                    <option value="forex">Forex</option>
                    <option value="stock">Cổ phiếu</option>
                    <option value="futures">Futures</option>
                    <option value="other">Khác</option>
                  </select>
                  <select
                    value={outcomeFilter}
                    onChange={(e) => setOutcomeFilter(e.target.value)}
                    className="rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 focus:border-blue-400 focus:outline-none"
                  >
                    <option value="">Tất cả KQ</option>
                    <option value="win">Thắng</option>
                    <option value="loss">Thua</option>
                    <option value="breakeven">Hòa</option>
                    <option value="open">Đang mở</option>
                  </select>
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200" />

            {trades.length === 0 ? (
              <div className="p-10 text-center text-sm text-slate-400">
                Chưa có trade công khai nào.
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {trades.map((trade) => (
                  <TradeCard key={trade.documentId} trade={trade} showAuthor />
                ))}

                <div className="py-4 text-center">
                  {loadingMore ? (
                    <span className="inline-flex items-center gap-2 text-sm text-slate-400">
                      <Loader2 size={14} className="animate-spin" />
                      Đang tải thêm...
                    </span>
                  ) : hasMore ? (
                    <button
                      onClick={handleLoadMore}
                      className="rounded-md border border-slate-200 px-4 py-1.5 text-sm text-slate-600 transition hover:bg-slate-50"
                    >
                      Xem thêm
                    </button>
                  ) : (
                    <span className="text-xs text-slate-400">Bạn đã đến cuối.</span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </ForumLayout>
  );
}
