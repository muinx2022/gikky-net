"use client";

import useSWR from "swr";
import { xemToi, type ToiOut } from "@gikky/api-client";
import {
  createContext,
  useContext,
} from "react";

import {
  GOC_TRINH_DUYET,
  KHOA_PHIEN,
  luuCachePhien,
  xoaCachePhien,
} from "@/lib/tai-khoan";

/** Phiên đăng nhập, hỏi **một lần** ở trình duyệt rồi chia cho cả cây React.
 *
 * **Vì sao ở client chứ không ở server component:** `Chrome` nằm trong layout gốc, tức nó
 * render trên MỌI trang — kể cả `/luat`, vốn phải là route TĨNH vì nó là đường thoát của
 * `error.tsx`/`global-error.tsx` (nợ #14 của 1c). Một lời gọi API trong layout gốc làm
 * `/luat` thành dynamic và đường thoát hỏng cùng lúc với thứ nó thoát khỏi. Hỏi ở trình
 * duyệt giữ được cả hai: trang vẫn tĩnh, danh tính vẫn đúng.
 *
 * Nó cũng là điều PLAN 8.4 điểm 4 đòi: **dữ liệu per-user không được nướng vào HTML
 * cache**. Phase 3 bật ISR cho trang mạch; nếu hôm nay ta render tên người dùng ở server
 * thì mai kia cái tên ấy nằm trong bản cache và phục vụ cho người khác.
 *
 * ## Vì sao SWR thay vì `useEffect` + `useState`
 *
 * Bản cũ dùng `useEffect` fetch → `setState` — anti-pattern trong React hiện đại:
 * - Không tự dedupe: hai component cùng gọi `taiLai()` = hai request.
 * - Không revalidate khi focus / reconnect — tab ngủ xong vẫn giữ phiên cũ.
 * - Không cache giữa các lần mount/unmount.
 *
 * SWR giải quyết cả ba mà không thêm boilerplate. `fallbackData` đọc từ `localStorage`
 * để tránh giật bố cục khi F5 (stale-while-revalidate — đúng tên của thư viện).
 */

type Phien = {
  toi: ToiOut | null;
  dangTai: boolean;
  /** Hỏi lại server — gọi sau đăng nhập / đăng xuất / xác thực email. */
  taiLai: () => Promise<void>;
};

const NguCanh = createContext<Phien>({
  toi: null,
  dangTai: true,
  taiLai: async () => {},
});

/** Khoá SWR — chuỗi bất kỳ, dùng nội bộ. */
const KHOA_SWR = "phien:toi";

/** Fetcher cho SWR — gọi `GET /me`, trả `ToiOut | null`. */
async function fetchToi(): Promise<ToiOut | null> {
  const kq = await xemToi({ baseUrl: GOC_TRINH_DUYET, cache: "no-store" });
  return kq.data ?? null;
}

/** Đọc cache localStorage để làm `fallbackData` — tránh giật layout khi mount. */
function docCacheBanDau(): ToiOut | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const luu = window.localStorage.getItem(KHOA_PHIEN);
    if (luu) {
      const phien = JSON.parse(luu) as ToiOut;
      if (phien?.dang_nhap) return phien;
    }
  } catch {}
  return undefined;
}

export function PhienProvider({ children }: { children: React.ReactNode }) {
  const { data, isLoading, mutate } = useSWR(KHOA_SWR, fetchToi, {
    // Đọc từ localStorage ngay lập tức để tránh giật bố cục.
    fallbackData: docCacheBanDau(),
    // Tự hỏi lại khi tab được focus — phiên hết hạn ở tab ngủ sẽ được phát hiện.
    revalidateOnFocus: true,
    // Tự hỏi lại khi mạng nối lại — mất mạng rồi có lại không bị kẹt phiên cũ.
    revalidateOnReconnect: true,
    // Dedupe: hai component mount cùng lúc chỉ sinh MỘT request.
    dedupingInterval: 5000,
    // `GET /me` không bao giờ ném — khách nhận 200 kèm `dang_nhap: false`.
    // SWR mặc định retry khi ném, nên tắt để không hỏi vòng vòng khi mạng chập chờn.
    shouldRetryOnError: false,
    onSuccess(data) {
      if (data?.dang_nhap) {
        luuCachePhien(data);
      } else {
        xoaCachePhien();
      }
    },
  });

  const toi = data ?? null;

  const taiLai = async () => {
    // `mutate()` không tham số = revalidate (gọi lại fetcher), trả Promise.
    await mutate();
  };

  return (
    <NguCanh.Provider value={{ toi, dangTai: isLoading, taiLai }}>
      {children}
    </NguCanh.Provider>
  );
}

export function usePhien(): Phien {
  return useContext(NguCanh);
}

/** Username của người đang đăng nhập, hoặc `null`. Dùng để hỏi "cái này có phải của tôi
 * không" ở menu `⋯` và ở composer. */
export function useToiLaAi(): string | null {
  const { toi } = usePhien();
  return toi?.dang_nhap ? (toi.username ?? null) : null;
}
