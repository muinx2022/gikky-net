"use client";

import { quanTriThongKe, type ModOut, type ThongKeOut } from "@gikky/api-client/admin";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

import { GOC_API } from "../../lib/api";

/** Trạng thái dùng chung của cả khu quản trị: mod đang đăng nhập + số liệu tổng quan.
 *
 * ## Vì sao thống kê nằm ở KHUNG chứ không ở trang bảng điều khiển
 *
 * Badge trên chuông của thanh trên là **số báo cáo đang chờ**, và nó phải đúng ở mọi
 * trang — không chỉ ở trang bảng điều khiển. Nếu mỗi nơi tự gọi thì có hai lời gọi cho
 * cùng một con số, và hai con số đo ở hai thời điểm sẽ có lúc nói lệch nhau ngay trên
 * cùng một màn hình.
 *
 * `lamMoi()` cho trang nào vừa thi hành một hành động gọi lại — badge và bảng điều khiển
 * cùng cập nhật trong một nhịp.
 *
 * ## Vì sao thống kê được phép `null` mãi mãi
 *
 * `GET /thong-ke` hỏng không được làm chết cả khu quản trị: hàng đợi báo cáo vẫn phải
 * dùng được khi bảng điều khiển không nạp nổi. Nên lỗi ở đây chỉ tắt badge, và trang
 * bảng điều khiển tự nói ra bằng tiếng người.
 *
 * ## Vì sao badge tự nạp lại khi quay lại tab
 *
 * Bản đầu chỉ nạp một lần lúc mount. Mod để tab quản trị mở cả ngày, nên con số trên
 * chuông là con số của **lúc sáng** — và nó trông y hệt một con số mới. Không có gì báo
 * là nó cũ. Nạp lại khi tab hiện lại và khi cửa sổ được focus là đúng lúc mod quay lại
 * nhìn nó, và không tốn một request nào trong lúc họ đang ở chỗ khác.
 *
 * ⚠ Cố ý KHÔNG có bộ đếm giờ. Một `setInterval` nạp cả khi tab đang ẩn — đúng thứ vừa
 * nói là lãng phí — và nó chạy song song với chính lượt nạp sau mỗi hành động mod.
 */
type NguCanh = {
  mod: ModOut;
  thong_ke: ThongKeOut | null;
  dang_tai_thong_ke: boolean;
  loi_thong_ke: string | null;
  lamMoi: () => Promise<void>;
};

const Ctx = createContext<NguCanh | null>(null);

export function useQuanTri(): NguCanh {
  const gia_tri = useContext(Ctx);
  if (gia_tri === null) {
    throw new Error("useQuanTri() phải nằm trong <NguCanhQuanTri>");
  }
  return gia_tri;
}

export function NguCanhQuanTri({
  mod,
  children,
}: {
  mod: ModOut;
  children: React.ReactNode;
}) {
  const [thong_ke, datThongKe] = useState<ThongKeOut | null>(null);
  const [dang_tai, datDangTai] = useState(true);
  const [loi, datLoi] = useState<string | null>(null);

  /** Hai `ref`, hai việc — cả hai là `ref` chứ không state để `lamMoi` giữ nguyên định
   * danh (state trong deps là listener bị gỡ/gắn lại sau mỗi lượt nạp).
   *
   * - `dang_nap`: cờ "đang có lượt nạp chạy dở" — nhưng nó CHỈ chặn nhánh
   *   focus/visibility (hai sự kiện này thường bắn cả đôi trong một lượt quay lại tab).
   *   `lamMoi` gọi sau một hành động mod thì KHÔNG được bỏ: bản đầu chặn cả nhánh ấy, và
   *   một cú bấm vào cửa sổ chưa focus (Windows click-through: focus + click cùng lúc)
   *   làm lượt nạp-sau-hành-động rơi đúng lúc lượt nạp-theo-focus đang bay — badge giữ
   *   số CŨ cho tới lần đổi tab kế tiếp, đúng cái bệnh mục này sinh ra để chữa.
   * - `lan`: hai lượt nạp được phép chồng nhau (hành động đè lên focus), nên lượt về
   *   SAU CÙNG chưa chắc là lượt MỚI NHẤT — chỉ lượt mới nhất được ghi state, cùng cách
   *   `lib/danh-sach.ts` chống kết quả về muộn. */
  const dang_nap = useRef(false);
  const lan = useRef(0);

  const lamMoi = useCallback(async () => {
    const cua_toi = ++lan.current;
    dang_nap.current = true;
    datDangTai(true);
    try {
      const { data, error } = await quanTriThongKe({
        baseUrl: GOC_API,
        cache: "no-store",
      });
      if (cua_toi !== lan.current) return;
      if (error !== undefined) {
        datLoi("Không nạp được số liệu tổng quan.");
        return;
      }
      datLoi(null);
      datThongKe(data);
    } finally {
      // `finally` chứ không dòng trần: client hiện không ném, nhưng nếu một bản
      // `@hey-api` mới đổi ý thì cờ kẹt là badge chết im lặng CẢ PHIÊN — đúng họ lỗi
      // "kẹt vĩnh viễn" mà `cong-quan-tri.tsx` đã trả giá một lần. `dang_tai` cùng
      // số phận: kẹt `true` là nút "Làm mới" của bảng điều khiển disabled mãi.
      if (cua_toi === lan.current) {
        dang_nap.current = false;
        datDangTai(false);
      }
    }
  }, []);

  useEffect(() => {
    void lamMoi();
  }, [lamMoi]);

  useEffect(() => {
    // Nhánh listener đi qua cờ `dang_nap` — `focus` và `visibilitychange` thường bắn cả
    // đôi trong một lượt quay lại tab, và bỏ lượt thứ hai là vô hại vì lượt thứ nhất
    // đang mang về đúng con số ấy. Nhánh sau-hành-động (gọi thẳng `lamMoi`) thì không
    // đi qua cờ này — xem ghi chú trên `dang_nap`.
    const napNeuRanh = () => {
      if (!dang_nap.current) void lamMoi();
    };
    const khiHienLai = () => {
      // Chỉ nạp khi tab HIỆN RA. `visibilitychange` bắn cả hai chiều, và nhánh "vừa ẩn
      // đi" là đúng lúc không nên tốn request nhất.
      if (document.visibilityState === "visible") napNeuRanh();
    };
    document.addEventListener("visibilitychange", khiHienLai);
    window.addEventListener("focus", napNeuRanh);
    return () => {
      document.removeEventListener("visibilitychange", khiHienLai);
      window.removeEventListener("focus", napNeuRanh);
    };
  }, [lamMoi]);

  return (
    <Ctx.Provider
      value={{
        mod,
        thong_ke,
        dang_tai_thong_ke: dang_tai,
        loi_thong_ke: loi,
        lamMoi,
      }}
    >
      {children}
    </Ctx.Provider>
  );
}
