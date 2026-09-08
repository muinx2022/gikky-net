"use client";

import { ExternalLink, LineChart } from "lucide-react";
import type { TradingViewSnapshotInfo } from "@/lib/tradingview";
import { useLightbox } from "./lightbox";
import css from "./tradingview-snapshot.module.css";

export function TradingViewSnapshot({
  snapshots,
}: {
  snapshots: TradingViewSnapshotInfo[];
}) {
  const { moLightbox } = useLightbox();

  if (snapshots.length === 0) return null;

  return (
    <div className={css.danh_sach} data-testid="tradingview-snapshots">
      {snapshots.map((s, idx) => (
        <div key={`${s.id}-${idx}`} className={css.the} data-testid="the-tradingview-snapshot">
          <div className={css.dau}>
            <span className={css.nhan}>
              <LineChart size={13} strokeWidth={2} aria-hidden />
              TradingView Snapshot
            </span>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className={css.lien_ket}
              title="Mở biểu đồ gốc trên TradingView"
            >
              <span>Xem gốc</span>
              {" "}
              <ExternalLink size={11} strokeWidth={2} aria-hidden />
            </a>
          </div>
          <div
            className={css.anh_khung}
            onClick={() => moLightbox(s.imageUrl, { alt: `TradingView Snapshot ${s.id}` })}
            title="Nhấp để phóng to biểu đồ"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={s.imageUrl}
              alt={`TradingView Snapshot ${s.id}`}
              loading="lazy"
              className={css.anh}
              onError={(e) => {
                // Nếu ảnh cdn s3 bị 403 hoặc lỗi tải, ẩn ảnh để khung chỉ còn link
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
