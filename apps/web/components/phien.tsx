"use client";

import useSWR from "swr";
import { xemToi, type ToiOut } from "@gikky/api-client";
import {
  createContext,
  useContext,
  useLayoutEffect,
  useState,
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
      if (phien && typeof phien === "object" && typeof phien.dang_nhap === "boolean") {
        return phien;
      }
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
      if (data) {
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

/** `false` ở server VÀ ở lần render hydrate; `true` từ lần render ngay sau — lật trong
 * `useLayoutEffect` nên lần render ấy được commit TRƯỚC khi trình duyệt vẽ *(việc 14, đợt E)*.
 *
 * Dùng cho component vẽ trạng thái "chưa biết phiên" giống hệt HTML server rồi nhờ cờ
 * `html[data-da-dang-nhap]` (script `<head>`) ẩn/hiện bằng CSS. Hai lý do không lấy thẳng
 * `dangTai`:
 *
 * - `fallbackData` đọc `localStorage` ngay lần render đầu ở trình duyệt, nên `dangTai` có thể đã
 *   `false` lúc hydrate ⇒ khác HTML server ⇒ React 19 báo lệch và vẽ lại cả cây;
 * - hễ có PHIÊN LƯU (`fallbackData` có giá trị — thành viên VÀ cả khách quay lại, phiên lưu
 *   `dang_nhap:false`) lượt hydrate hiện đang lệch (lỗi React #418 — nghi
 *   `thanh-dieu-huong-duoi.tsx` vẽ theo `fallbackData` ngay lúc hydrate, vd `{toi && <BottomDrawer>}`),
 *   nên React bỏ HTML server, render lại cả root và các thuộc tính script `<head>` đặt trên `<html>`
 *   bị xoá. Chỉ lượt ĐẦU (`localStorage` rỗng) là không lệch. Đã ĐO (MutationObserver + `pageerror`
 *   #418) — sổ P-20261111-21. Tức ở các lượt ấy cờ CSS chết ngay lúc hydrate, và các "gương JS"
 *   đọc phiên lưu là để chống giật TRONG KHI lỗi đó còn; sửa #418 thì xem lại để gỡ.
 *   Nếu lần lật sang trạng thái thật chờ tới effect thụ động
 *   (`useSyncExternalStore` lật ở đó với root hydrate) thì có thể có MỘT khung hình vẽ ra giữa
 *   hai việc — lời mời đăng ký chớp vào mặt thành viên. `useLayoutEffect` + `setState` thì được
 *   React render lại đồng bộ trước khi trả quyền cho trình duyệt. */
export function useDaHydrate(): boolean {
  const [da, datDa] = useState(false);
  useLayoutEffect(() => {
    datDa(true);
  }, []);
  return da;
}

/** Username của người đang đăng nhập, hoặc `null`. Dùng để hỏi "cái này có phải của tôi
 * không" ở menu `⋯` và ở composer. */
export function useToiLaAi(): string | null {
  const { toi } = usePhien();
  return toi?.dang_nhap ? (toi.username ?? null) : null;
}
