"use client";

import { xemToi, type ToiOut } from "@gikky/api-client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

import { GOC_TRINH_DUYET } from "@/lib/tai-khoan";

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
 * Đánh đổi, nói thẳng: có một nhịp trang chưa biết mình là ai (`dang_tai = true`). UI phải
 * xử ca đó bằng cách **không vẽ gì** thay vì vẽ trạng thái khách rồi nhảy — xem
 * `ThanhTaiKhoan`.
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

export function PhienProvider({ children }: { children: React.ReactNode }) {
  const [toi, datToi] = useState<ToiOut | null>(null);
  const [dangTai, datDangTai] = useState(true);

  const taiLai = useCallback(async () => {
    // `GET /me` không có đường 401: khách nhận 200 kèm `dang_nhap: false`. Nên `data`
    // vắng mặt ở đây chỉ có thể là hỏng mạng — và ca đó UI hiện như khách, không hiện lỗi:
    // thanh tài khoản không phải chỗ báo sự cố hạ tầng.
    const kq = await xemToi({ baseUrl: GOC_TRINH_DUYET, cache: "no-store" });
    datToi(kq.data ?? null);
    datDangTai(false);
  }, []);

  useEffect(() => {
    void taiLai();
  }, [taiLai]);

  return (
    <NguCanh.Provider value={{ toi, dangTai, taiLai }}>{children}</NguCanh.Provider>
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
