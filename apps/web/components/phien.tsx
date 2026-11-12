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
 *
 * ## Lần render hydrate phát đúng thứ server phát *(việc 17)*
 *
 * Server không có `localStorage`, nên ở đó `toi = null`, `dangTai = true`. `fallbackData` thì
 * đọc `localStorage` ngay lần render đầu ở trình duyệt — tức lần render HYDRATE — nên hễ có phiên
 * lưu (thành viên VÀ khách quay lại) mọi component vẽ theo `toi` lệch HTML server: React báo
 * #418, bỏ HTML server, render lại cả root và xoá mọi thuộc tính script `<head>` đặt trên
 * `<html>` (sổ P-20261111-21, P-20261112-6 — đã đo). Nay provider che phiên lưu bằng
 * `useDaHydrate`: lần render hydrate phát `toi = null`, `dangTai = true` như server; layout
 * effect lật cờ và React render lại ĐỒNG BỘ trước lần vẽ đầu, nên không khung hình nào thấy
 * "không có ai" và consumer vẫn nhận phiên lưu như trước. Provider ở layout gốc, không mount lại
 * khi điều hướng client, nên cờ chỉ lật một lần mỗi lượt tải. Bài đo:
 * `e2e/hydrate-sach.spec.ts`.
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

/** Đọc cache localStorage để làm `fallbackData` — tránh giật layout khi mount. Ở lần render
 * hydrate giá trị này bị `PhienProvider` che (xem docstring đầu file). */
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
  const daHydrate = useDaHydrate();
  const { data, isLoading, mutate } = useSWR(KHOA_SWR, fetchToi, {
    // Đọc từ localStorage ngay lập tức để tránh giật bố cục — chỉ lộ ra SAU hydrate (xem dưới).
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

  // Lần render hydrate: đúng thứ server phát (`null` / `true`) — không thì #418 (docstring đầu file).
  // `isLoading` vốn đã `true` ở cả hai phía tới khi `/me` trả lời (SWR không coi `fallbackData` là
  // dữ liệu đã tải); che nó nữa chỉ để lần render ấy không phụ thuộc vào chi tiết đó của SWR.
  const toi = daHydrate ? (data ?? null) : null;
  const dangTai = daHydrate ? isLoading : true;

  const taiLai = async () => {
    // `mutate()` không tham số = revalidate (gọi lại fetcher), trả Promise.
    await mutate();
  };

  return (
    <NguCanh.Provider value={{ toi, dangTai, taiLai }}>
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
 * `PhienProvider` dùng nó để che phiên lưu (`fallbackData`) ở lần render hydrate — xem docstring
 * đầu file (việc 17). Nhờ vậy consumer không cần cờ riêng: lần render hydrate của chúng đã thấy
 * `toi = null`, `dangTai = true`, giống hệt server; trạng thái "chưa biết phiên" là `dangTai`, và
 * cờ `html[data-da-dang-nhap]` / `data-google-tat` (script `<head>`) chọn hiện gì bằng CSS.
 *
 * Vì sao `useLayoutEffect` chứ không effect thụ động hay `useSyncExternalStore` (lật ở effect thụ
 * động với root hydrate): giữa hydrate và lần lật có thể có MỘT khung hình được vẽ — phiên lưu chưa
 * vào context, lời mời đăng ký chớp vào mặt thành viên. `useLayoutEffect` + `setState` thì được
 * React render lại đồng bộ trước khi trả quyền cho trình duyệt. */
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
