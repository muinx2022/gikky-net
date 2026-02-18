"use client";

import { useEffect, useRef, useState } from "react";
import { Calendar, TrendingDown, TrendingUp, X } from "lucide-react";

interface TradeFormProps {
  initialData?: Record<string, any>;
  onSubmit: (data: Record<string, any>) => Promise<void>;
  submitLabel?: string;
  embedded?: boolean;
}

function getNowLocal() {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
}

const EMOTIONS = [
  { value: "confident", emoji: "💪", label: "Tự tin", ring: "ring-emerald-400", bg: "bg-emerald-50", text: "text-emerald-700" },
  { value: "neutral", emoji: "😐", label: "Bình thường", ring: "ring-slate-400", bg: "bg-slate-100", text: "text-slate-700" },
  { value: "hesitant", emoji: "🤔", label: "Do dự", ring: "ring-violet-400", bg: "bg-violet-50", text: "text-violet-700" },
  { value: "fearful", emoji: "😰", label: "Lo lắng", ring: "ring-amber-400", bg: "bg-amber-50", text: "text-amber-700" },
  { value: "greedy", emoji: "🤑", label: "Tham lam", ring: "ring-red-400", bg: "bg-red-50", text: "text-red-700" },
] as const;

function DateTimePicker({
  value,
  onChange,
  label,
  required,
  placeholder = "Chọn ngày & giờ",
  max,
  min,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  required?: boolean;
  placeholder?: string;
  max?: string;
  min?: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          type="datetime-local"
          value={value}
          max={max}
          min={min}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-lg border border-slate-200 bg-white px-3 pr-16 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100"
        />
        <div className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1.5 text-slate-400">
          <Calendar size={14} />
        </div>
        {value && (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-8 top-1/2 -translate-y-1/2 rounded p-0.5 text-slate-400 transition hover:text-slate-600"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 placeholder:text-slate-400 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
const selectCls =
  "w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 focus:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-100";
const parseDecimal = (value: string) => Number((value || "").replace(",", "."));

export default function TradeForm({ initialData, onSubmit, submitLabel = "Lưu trade", embedded = false }: TradeFormProps) {
  const [symbol, setSymbol] = useState(initialData?.symbol ?? "");
  const [market, setMarket] = useState(initialData?.market ?? "crypto");
  const [direction, setDirection] = useState<"long" | "short">(initialData?.direction ?? "long");
  const [entryDate, setEntryDate] = useState(initialData?.entryDate ? initialData.entryDate.slice(0, 16) : "");
  const [exitDate, setExitDate] = useState(initialData?.exitDate ? initialData.exitDate.slice(0, 16) : "");
  const [entryPrice, setEntryPrice] = useState(initialData?.entryPrice?.toString() ?? "");
  const [exitPrice, setExitPrice] = useState(initialData?.exitPrice?.toString() ?? "");
  const [quantity, setQuantity] = useState(initialData?.quantity?.toString() ?? "");
  const [pnl, setPnl] = useState(initialData?.pnl?.toString() ?? "");
  const [outcome, setOutcome] = useState(initialData?.outcome ?? "open");
  const [strategy, setStrategy] = useState(initialData?.strategy ?? "");
  const [setup, setSetup] = useState(initialData?.setup ?? "");
  const [notes, setNotes] = useState(initialData?.notes ?? "");
  const [emotion, setEmotion] = useState(initialData?.emotion ?? "");
  const [isPublic, setIsPublic] = useState(initialData?.isPublic ?? false);

  const [dateError, setDateError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const nowLocal = getNowLocal();
  const hasExitDate = exitDate.trim() !== "";

  useEffect(() => {
    if (!hasExitDate) setOutcome("open");
  }, [hasExitDate]);

  useEffect(() => {
    if (entryDate && exitDate && new Date(exitDate) <= new Date(entryDate)) {
      setDateError("Ngày ra phải sau ngày vào");
    } else {
      setDateError("");
    }
  }, [entryDate, exitDate]);

  const pnlNum = parseFloat(pnl);
  const pnlColor = pnl === "" ? "text-slate-800" : pnlNum >= 0 ? "text-emerald-600" : "text-red-600";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!symbol.trim()) {
      setError("Vui lòng nhập symbol");
      return;
    }
    if (!entryDate) {
      setError("Vui lòng chọn ngày vào lệnh");
      return;
    }
    if (dateError) {
      setError(dateError);
      return;
    }
    if (!entryPrice || parseDecimal(entryPrice) <= 0) {
      setError("Vui lòng nhập giá vào hợp lệ");
      return;
    }
    if (!quantity || parseDecimal(quantity) <= 0) {
      setError("Vui lòng nhập khối lượng hợp lệ");
      return;
    }

    const payload: Record<string, any> = {
      symbol: symbol.trim().toUpperCase(),
      market,
      direction,
      entryDate: new Date(entryDate).toISOString(),
      entryPrice: parseDecimal(entryPrice),
      quantity: parseDecimal(quantity),
      outcome,
      isPublic,
    };

    if (exitDate) payload.exitDate = new Date(exitDate).toISOString();
    if (exitPrice) payload.exitPrice = parseDecimal(exitPrice);
    if (pnl !== "") payload.pnl = parseDecimal(pnl);
    if (strategy.trim()) payload.strategy = strategy.trim();
    if (setup.trim()) payload.setup = setup.trim();
    if (notes.trim()) payload.notes = notes.trim();
    if (emotion) payload.emotion = emotion;

    setSubmitting(true);
    try {
      await onSubmit(payload);
    } catch (err: any) {
      setError(err?.message ?? "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className={embedded ? "space-y-5 p-5" : "space-y-5 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"}
    >
      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-600">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">
            Symbol <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="BTCUSDT, EURUSD, VIC..."
            className={inputCls}
          />
        </div>
        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">Thị trường</label>
          <select value={market} onChange={(e) => setMarket(e.target.value)} className={selectCls}>
            <option value="crypto">Crypto</option>
            <option value="forex">Forex</option>
            <option value="stock">Cổ phiếu</option>
            <option value="futures">Futures</option>
            <option value="other">Khác</option>
          </select>
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Hướng</label>
        <div className="flex gap-2">
          {(["long", "short"] as const).map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setDirection(d)}
              className={`flex flex-1 items-center justify-center gap-2 rounded-lg border py-2 text-sm font-semibold transition ${
                direction === d
                  ? d === "long"
                    ? "border-emerald-400 bg-emerald-50 text-emerald-700"
                    : "border-red-400 bg-red-50 text-red-700"
                  : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
              }`}
            >
              {d === "long" ? <TrendingUp size={15} /> : <TrendingDown size={15} />}
              {d === "long" ? "Long" : "Short"}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="grid grid-cols-2 gap-4">
          <DateTimePicker label="Ngày vào" required value={entryDate} onChange={setEntryDate} placeholder="Chọn ngày giờ vào" max={nowLocal} />
          <DateTimePicker label="Ngày ra" value={exitDate} onChange={setExitDate} placeholder="Chọn ngày giờ ra" max={nowLocal} min={entryDate || undefined} />
        </div>
        {dateError && <p className="text-xs text-red-500">{dateError}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Giá vào", val: entryPrice, set: setEntryPrice, req: true },
          { label: "Giá ra", val: exitPrice, set: setExitPrice, req: false },
          { label: market === "stock" ? "Số CP" : "Lot / Qty", val: quantity, set: setQuantity, req: true },
        ].map(({ label, val, set, req }) => (
          <div key={label}>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              {label} {req && <span className="text-red-500">*</span>}
            </label>
            <input
              type="number"
              step="any"
              min="0"
              value={val}
              onChange={(e) => set(e.target.value)}
              onWheel={(e) => (e.currentTarget as HTMLInputElement).blur()}
              className={inputCls}
            />
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className={`mb-1.5 block text-sm font-medium ${hasExitDate ? "text-slate-700" : "text-slate-400"}`}>Kết quả</label>
          <select
            value={outcome}
            disabled={!hasExitDate}
            onChange={(e) => setOutcome(e.target.value)}
            className={`${selectCls} ${!hasExitDate ? "cursor-not-allowed bg-slate-50 text-slate-400" : ""}`}
          >
            <option value="open">Đang mở</option>
            <option value="win">Thắng</option>
            <option value="loss">Thua</option>
            <option value="breakeven">Hòa</option>
          </select>
          {!hasExitDate && <p className="mt-1 text-[11px] text-slate-400">Cần nhập ngày ra</p>}
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-slate-700">P&L</label>
          <input
            type="text"
            inputMode="decimal"
            value={pnl}
            onChange={(e) => setPnl(e.target.value)}
            placeholder="Ví dụ: 150 hoặc -80"
            className={`${inputCls} font-semibold placeholder:font-normal ${pnlColor}`}
          />
        </div>
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Chiến lược</label>
        <input type="text" value={strategy} onChange={(e) => setStrategy(e.target.value)} placeholder="Trend following, Breakout, RSI divergence..." className={inputCls} />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Setup / Tín hiệu</label>
        <textarea value={setup} onChange={(e) => setSetup(e.target.value)} rows={3} placeholder="Mô tả tín hiệu vào lệnh, điều kiện thị trường..." className={`${inputCls} resize-none`} />
      </div>

      <div>
        <label className="mb-1.5 block text-sm font-medium text-slate-700">Ghi chú</label>
        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={4} placeholder="Suy nghĩ, bài học, nhận xét sau trade..." className={`${inputCls} resize-none`} />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">Cảm xúc khi vào lệnh</label>
        <div className="flex flex-wrap gap-2">
          {EMOTIONS.map((em) => {
            const active = emotion === em.value;
            return (
              <button
                key={em.value}
                type="button"
                onClick={() => setEmotion(active ? "" : em.value)}
                className={`flex flex-col items-center gap-1 rounded-xl border px-3 py-2.5 text-sm transition ${
                  active
                    ? `${em.bg} ${em.text} ring-2 ${em.ring} border-transparent`
                    : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50"
                }`}
              >
                <span className="text-2xl leading-none">{em.emoji}</span>
                <span className="text-[11px] font-medium">{em.label}</span>
              </button>
            );
          })}
        </div>
        {emotion && (
          <p className="mt-2 text-xs text-slate-500">
            Đã chọn: <span className="font-medium text-slate-700">{EMOTIONS.find((e) => e.value === emotion)?.emoji} {EMOTIONS.find((e) => e.value === emotion)?.label}</span>
            {" · "}
            <button type="button" onClick={() => setEmotion("")} className="underline hover:text-slate-900">Bỏ chọn</button>
          </p>
        )}
      </div>

      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
        <div>
          <p className="text-sm font-medium text-slate-700">Công khai trade</p>
          <p className="mt-0.5 text-xs text-slate-400">Cộng đồng có thể xem trade này</p>
        </div>
        <button
          type="button"
          onClick={() => setIsPublic((v) => !v)}
          className={`relative h-6 w-11 rounded-full transition-colors ${isPublic ? "bg-blue-600" : "bg-slate-300"}`}
        >
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${isPublic ? "translate-x-5" : "translate-x-0.5"}`} />
        </button>
      </div>

      <button type="submit" disabled={submitting} className="w-full rounded-lg bg-blue-600 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
        {submitting ? "Đang lưu..." : submitLabel}
      </button>
    </form>
  );
}
