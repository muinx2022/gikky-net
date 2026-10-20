"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

import {
  DUONG_DAN_BEACON_CLIENT,
  HEADER_BEACON_CLIENT,
  nenDem,
} from "@/lib/dem-luot-xem";

/**
 * Component client gửi tín hiệu beacon ghi nhận lượt xem người đọc thật.
 *
 * Mô hình Hybrid (2026-10-18):
 * - Server Middleware: ghi nhận 100% bot truy cập, nhưng KHÔNG ghi nhận lượt người đọc
 *   thông thường (`chi_ghi_bot: true`) để chặn bot giả mạo User-Agent Chrome/Safari.
 * - Client JS Beacon: chỉ chạy khi trình duyệt thực sự tải trang và thực thi JavaScript.
 *   Beacon gửi request GET về `DUONG_DAN_BEACON_CLIENT` kèm `HEADER_BEACON_CLIENT`,
 *   được middleware chuyển tiếp sang Django với `chi_ghi_bot: false`.
 *
 * Chống mất static pre-render (`○`):
 * - Dùng `usePathname()`, KHÔNG dùng `useSearchParams()` (đòi hỏi `<Suspense>`).
 * - Query string được đọc an toàn qua `window.location.search` bên trong `useEffect`.
 * - Tự động bỏ qua khi `navigator.webdriver === true` để không ghi nhận lượt chạy test E2E.
 * - Chỉ gửi `document.referrer` ở lượt mở trang đầu tiên (`laLanDauRef`); các lượt bấm
 *   chuyển trang nội bộ (SPA navigation) không gửi `r` để không tính nhầm là từ ngoại mạng.
 */
export function DemLuotXemClient() {
  const duongDan = usePathname();
  const daGoiRef = useRef<string | null>(null);
  const laLanDauRef = useRef(true);

  useEffect(() => {
    // Không chạy trong môi trường tự động hóa / E2E test
    if (typeof navigator !== "undefined" && navigator.webdriver) {
      return;
    }

    // Không gửi beacon nếu đường dẫn không thuộc danh sách trang được đếm
    if (!nenDem(duongDan)) {
      return;
    }

    const search = typeof window !== "undefined" ? window.location.search : "";
    const duongHienTai = `${duongDan}${search}`;

    // Khử trùng lặp gọi hai lần trong cùng một lần render / StrictMode
    if (daGoiRef.current === duongHienTai) {
      return;
    }
    daGoiRef.current = duongHienTai;

    const ref =
      laLanDauRef.current && typeof document !== "undefined"
        ? document.referrer
        : "";
    laLanDauRef.current = false;

    const params = new URLSearchParams();
    params.set("d", duongDan);
    if (search) {
      params.set("q", search);
    }
    if (ref) {
      params.set("r", ref);
    }

    const url = `${DUONG_DAN_BEACON_CLIENT}?${params.toString()}`;

    let timerId: ReturnType<typeof setTimeout> | undefined;

    try {
      fetch(url, {
        method: "GET",
        headers: { [HEADER_BEACON_CLIENT]: "1" },
        keepalive: true,
        cache: "no-store",
        credentials: "same-origin",
      })
        .then(() => {
          if (typeof window !== "undefined") {
            timerId = setTimeout(() => {
              window.dispatchEvent(
                new CustomEvent("gikky:da-dem-luot-xem", {
                  detail: { duongDan },
                }),
              );
            }, 200);
          }
        })
        .catch(() => {});
    } catch {
      // Nuốt lỗi mạng phía client
    }

    return () => {
      if (timerId) {
        clearTimeout(timerId);
      }
    };
  }, [duongDan]);

  return null;
}
