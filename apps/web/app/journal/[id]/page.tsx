"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft,
  TrendingUp,
  TrendingDown,
  Calendar,
  Globe,
  Lock,
  Edit2,
  Trash2,
  ArrowRight,
  Eye,
  EyeOff,
  BookOpenText,
} from "lucide-react";
import { api, getStrapiURL } from "../../../lib/api";
import { getAuthToken } from "../../../lib/auth-storage";
import { useAuth } from "../../../components/AuthContext";
import { useCategories } from "../../../lib/useCategories";
import ForumLayout from "../../../components/ForumLayout";
import ConfirmModal from "../../../components/ConfirmModal";
import CommentThread from "../../../components/CommentThread";

const OUTCOME_STYLES: Record<string, string> = {
  win: "bg-emerald-100 text-emerald-700 border-emerald-200",
  loss: "bg-red-100 text-red-700 border-red-200",
  breakeven: "bg-slate-100 text-slate-700 border-slate-200",
  open: "bg-blue-100 text-blue-700 border-blue-200",
};

const OUTCOME_LABELS: Record<string, string> = {
  win: "Thắng",
  loss: "Thua",
  breakeven: "Hòa",
  open: "Đang mở",
};

const MARKET_LABELS: Record<string, string> = {
  crypto: "Crypto",
  forex: "Forex",
  stock: "Cổ phiếu",
  futures: "Futures",
  other: "Khác",
};

const EMOTION_LABELS: Record<string, string> = {
  confident: "Tự tin",
  neutral: "Bình thường",
  fearful: "Lo lắng",
  greedy: "Tham lam",
  hesitant: "Do dự",
};

const EMOTION_EMOJI: Record<string, string> = {
  confident: "💪",
  neutral: "😐",
  fearful: "😰",
  greedy: "🤑",
  hesitant: "🤔",
};

function formatDt(dt: string | null | undefined) {
  if (!dt) return "—";
  return new Date(dt).toLocaleString("vi-VN");
}

export default function TradeDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentUser } = useAuth();
  const categories = useCategories();
  const [trade, setTrade] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showDelete, setShowDelete] = useState(false);
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    if (!id) return;
    const jwt = getAuthToken();
    const headers: Record<string, string> = {};
    if (jwt) headers.Authorization = `Bearer ${jwt}`;

    api
      .get(`/api/journal-trades/${id}`, {
        params: {
          populate: {
            author: { populate: { avatar: true } },
            screenshots: true,
          },
        },
        headers,
      })
      .then((res) => setTrade(res.data?.data))
      .catch(() => setTrade(null))
      .finally(() => setLoading(false));
  }, [id]);

  const isOwner = currentUser && trade?.author?.id === currentUser.id;

  const handleDelete = async () => {
    const jwt = getAuthToken();
    if (!jwt) return;
    await api.delete(`/api/journal-trades/${id}`, { headers: { Authorization: `Bearer ${jwt}` } });
    router.push("/journal");
  };

  const handleTogglePublic = async () => {
    const jwt = getAuthToken();
    if (!jwt || !trade) return;
    setPublishing(true);
    try {
      const res = await api.put(
        `/api/journal-trades/${id}`,
        { data: { isPublic: !trade.isPublic } },
        { headers: { Authorization: `Bearer ${jwt}` } }
      );
      setTrade((prev: any) => ({ ...prev, isPublic: res.data?.data?.isPublic ?? !prev.isPublic }));
    } finally {
      setPublishing(false);
    }
  };


  if (loading) {
    return (
      <ForumLayout categories={categories}>
        <div className="mx-auto max-w-3xl space-y-4">
          <div className="h-16 animate-pulse rounded-2xl bg-slate-100" />
          <div className="h-80 animate-pulse rounded-2xl bg-slate-100" />
        </div>
      </ForumLayout>
    );
  }

  if (!trade) {
    return (
      <ForumLayout categories={categories}>
        <div className="mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-10 text-center">
          <p className="text-slate-500">Không tìm thấy trade hoặc trade này là riêng tư.</p>
          <Link href="/journal" className="mt-3 inline-block text-sm text-blue-600 hover:underline">
            Quay lại nhật ký
          </Link>
        </div>
      </ForumLayout>
    );
  }

  const isLong = trade.direction === "long";
  const pnlPositive = (trade.pnl ?? 0) >= 0;

  return (
    <ForumLayout categories={categories}>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dbeafe] text-[#3b82f6]">
                <BookOpenText size={20} />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-slate-900">Chi tiết trade</h1>
                <p className="text-xs text-slate-500">{trade.symbol} · {MARKET_LABELS[trade.market] ?? trade.market}</p>
              </div>
            </div>
            <Link
              href="/journal"
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:bg-slate-50 hover:text-slate-900"
            >
              <ArrowLeft size={14} />
              Quay lại
            </Link>
          </div>

          {isOwner && (
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
              <button
                onClick={handleTogglePublic}
                disabled={publishing}
                className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition disabled:opacity-50 ${
                  trade.isPublic
                    ? "border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                    : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {trade.isPublic ? <Eye size={13} /> : <EyeOff size={13} />}
                {trade.isPublic ? "Công khai" : "Riêng tư"}
              </button>
              <Link
                href={`/journal/${id}/edit`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-50"
              >
                <Edit2 size={13} /> Sửa
              </Link>
              <button
                onClick={() => setShowDelete(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm text-red-600 transition hover:bg-red-50"
              >
                <Trash2 size={13} /> Xóa
              </button>
            </div>
          )}

          <div className="mt-6 flex items-start justify-between gap-4 border-t border-slate-100 pt-6">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl ${
                  isLong ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                }`}
              >
                {isLong ? <TrendingUp size={22} /> : <TrendingDown size={22} />}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-2xl font-bold text-slate-900">{trade.symbol}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      isLong ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {isLong ? "Long" : "Short"}
                  </span>
                </div>
                <p className="mt-0.5 text-sm text-slate-500">{MARKET_LABELS[trade.market] ?? trade.market}</p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <span className={`rounded-full border px-3 py-1 text-sm font-semibold ${OUTCOME_STYLES[trade.outcome] ?? OUTCOME_STYLES.open}`}>
                {OUTCOME_LABELS[trade.outcome] ?? trade.outcome}
              </span>
              {trade.pnl != null && (
                <div className="text-right">
                  <div className={`text-lg font-bold ${pnlPositive ? "text-emerald-600" : "text-red-600"}`}>
                    P&L: {pnlPositive ? "+" : ""}{trade.pnl?.toFixed(2)}
                  </div>
                  {trade.pnlPercent != null && (
                    <div className="text-xs text-slate-500">
                      Tỷ lệ: {pnlPositive ? "+" : ""}{trade.pnlPercent?.toFixed(2)}%
                    </div>
                  )}
                </div>
              )}
              {trade.isPublic ? (
                <span className="flex items-center gap-1 text-xs text-blue-600"><Globe size={11} /> Công khai</span>
              ) : (
                <span className="flex items-center gap-1 text-xs text-slate-500"><Lock size={11} /> Riêng tư</span>
              )}
            </div>
          </div>

          <div className="my-4 border-t border-slate-100" />

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Giá vào</p>
              <p className="text-xl font-bold text-slate-900">{trade.entryPrice != null ? trade.entryPrice.toLocaleString("vi-VN") : "—"}</p>
            </div>
            <div className="flex items-center justify-center">
              <div className={`flex h-8 w-8 items-center justify-center rounded-full ${isLong ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700"}`}>
                <ArrowRight size={15} />
              </div>
            </div>
            <div className="text-left sm:text-right">
              <p className="mb-1 text-xs font-medium uppercase tracking-wide text-slate-500">Giá ra</p>
              <p className={`text-xl font-bold ${trade.exitPrice == null ? "text-slate-400" : pnlPositive ? "text-emerald-600" : "text-red-600"}`}>
                {trade.exitPrice != null ? trade.exitPrice.toLocaleString("vi-VN") : "—"}
              </p>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
            <Calendar size={13} className="flex-shrink-0 text-slate-500" />
            <span className="text-slate-700">{formatDt(trade.entryDate)}</span>
            {trade.exitDate && (
              <>
                <ArrowRight size={12} className="flex-shrink-0 text-slate-400" />
                <span className="text-slate-700">{formatDt(trade.exitDate)}</span>
              </>
            )}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Khối lượng</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{trade.quantity ?? "—"}</p>
              </div>
              {trade.strategy && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Chiến lược</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{trade.strategy}</p>
                </div>
              )}
              {trade.emotion && (
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Cảm xúc</p>
                  <p className="mt-1 text-sm font-semibold text-slate-900">{EMOTION_EMOJI[trade.emotion]} {EMOTION_LABELS[trade.emotion]}</p>
                </div>
              )}
            </div>
          </div>

          {trade.setup && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Setup / Tín hiệu</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{trade.setup}</p>
            </div>
          )}

          {trade.notes && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="mb-2 text-sm font-semibold text-slate-800">Ghi chú</h3>
              <p className="whitespace-pre-wrap text-sm text-slate-600">{trade.notes}</p>
            </div>
          )}

          {trade.screenshots && trade.screenshots.length > 0 && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-800">Ảnh chụp</h3>
              <div className="flex flex-wrap gap-3">
                {trade.screenshots.map((img: any) => {
                  const url = img.url?.startsWith("http") ? img.url : getStrapiURL(img.url);
                  return (
                    <a key={img.id} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={img.name ?? "screenshot"}
                        className="h-32 w-auto rounded-lg border border-slate-200 object-cover transition hover:opacity-80"
                      />
                    </a>
                  );
                })}
              </div>
            </div>
          )}

          {trade.author && (
            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-500">Người đăng trade</p>
              <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                <div className="flex items-center gap-2">
                  {trade.author.avatar?.url ? (
                    <img
                      src={trade.author.avatar.url.startsWith("http") ? trade.author.avatar.url : getStrapiURL(trade.author.avatar.url)}
                      alt={trade.author.username || "avatar"}
                      className="h-8 w-8 rounded-full border border-slate-200 object-cover"
                    />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                      {String(trade.author.username || "?").charAt(0).toUpperCase()}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-slate-800">@{trade.author.username}</p>
                    <p className="text-xs text-slate-500">Tác giả trade</p>
                  </div>
                </div>
                <Link
                  href={`/user/${trade.author.username}`}
                  className="text-xs font-medium text-blue-600 transition hover:text-blue-700 hover:underline"
                >
                  Xem hồ sơ
                </Link>
              </div>
            </div>
          )}

          <CommentThread
            relation="journalTrade"
            targetDocumentId={String(id)}
            targetEntityId={trade?.id}
            disabled={!trade?.isPublic && !isOwner}
            disabledMessage="Trade này đang riêng tư nên bình luận bị tắt."
          />
        </div>
      </div>

      <ConfirmModal
        isOpen={showDelete}
        title="Xóa trade"
        message={`Bạn có chắc muốn xóa trade ${trade.symbol}? Hành động này không thể hoàn tác.`}
        confirmText="Xóa"
        confirmColor="red"
        onConfirm={handleDelete}
        onClose={() => setShowDelete(false)}
      />
    </ForumLayout>
  );
}
