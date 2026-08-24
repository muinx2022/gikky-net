"use client";

import type { ModOut } from "@gikky/api-client/admin";
import { useCallback, useEffect, useState } from "react";

import { NguCanhQuanTri } from "./ngu-canh";
import { Sidebar } from "./sidebar";
import { ThanhTren } from "./thanh-tren";

/** Khoá `localStorage` cho trạng thái gập của sidebar. Có tiền tố vì `localStorage` là
 * không gian tên chung của cả origin. */
const KHOA_GAP = "gikky-admin:sidebar-gap";

/** Khung của mọi trang quản trị: sidebar + thanh trên + vùng nội dung.
 *
 * ## Hai cờ riêng cho sidebar, không phải một
 *
 * `gap` (rộng ↔ rail, chỉ có nghĩa ở ≥1024px) và `mo_ngan_keo` (ngăn kéo ở <1024px) là
 * **hai trục khác nhau**. Dùng chung một biến thì thu nhỏ cửa sổ trong lúc đang gập sẽ ra
 * một ngăn kéo mở sẵn đè lên nội dung — một lỗi chỉ xuất hiện khi xoay điện thoại.
 *
 * ## `gap` đọc từ `localStorage` trong `useEffect`, không phải khi render
 *
 * Server không có `localStorage`; đọc nó trong thân component là hydration mismatch và
 * React vứt cả cây đi dựng lại. Render đầu luôn là "không gập", rồi effect sửa. Khác với
 * theme, cái nhảy ở đây chấp nhận được: nó là bề rộng một cột, không phải màu cả trang —
 * và không có cách nào tránh nó mà không đẩy lựa chọn xuống cookie, tức mở lại cửa đọc-ở-
 * server mà `lib/theme.ts` vừa đóng.
 */
export function Khung({ mod, children }: { mod: ModOut; children: React.ReactNode }) {
  const [gap, datGap] = useState(false);
  const [mo_ngan_keo, datMoNganKeo] = useState(false);

  useEffect(() => {
    try {
      datGap(window.localStorage.getItem(KHOA_GAP) === "1");
    } catch {
      datGap(false);
    }
  }, []);

  const doiGap = useCallback(() => {
    datGap((cu) => {
      const moi = !cu;
      try {
        window.localStorage.setItem(KHOA_GAP, moi ? "1" : "0");
      } catch {
        // Không lưu được thì lựa chọn chỉ sống trong tab này.
      }
      return moi;
    });
  }, []);

  const dongNganKeo = useCallback(() => datMoNganKeo(false), []);

  return (
    <NguCanhQuanTri mod={mod}>
      <Sidebar gap={gap} mo_ngan_keo={mo_ngan_keo} dongNganKeo={dongNganKeo} />
      <div className={`min-h-dvh transition-[padding] ${gap ? "lg:pl-[72px]" : "lg:pl-[260px]"}`}>
        <ThanhTren moNganKeo={() => datMoNganKeo(true)} />
        {/* Nút gập nằm ở mép trái vùng nội dung, dính theo thanh trên — nó thuộc về
            đường ranh giữa hai cột, không thuộc về sidebar (sidebar gập rồi thì nút nằm
            trong đó sẽ co lại theo và khó bấm). */}
        <button
          type="button"
          onClick={doiGap}
          aria-pressed={gap}
          aria-label={gap ? "Mở rộng menu" : "Thu gọn menu"}
          data-testid="nut-gap-sidebar"
          className="nut nut-nho fixed top-[52px] z-30 hidden size-7 -translate-x-1/2
            rounded-full p-0 lg:grid lg:place-items-center"
          style={{ left: gap ? "72px" : "260px" }}
        >
          <span aria-hidden="true" className="text-xs leading-none">
            {gap ? "›" : "‹"}
          </span>
        </button>
        <main className="mx-auto w-full max-w-[1440px] p-4 lg:p-6">{children}</main>
      </div>
    </NguCanhQuanTri>
  );
}
