"use client";

import { useEffect } from "react";

import css from "./error.module.css";
import "./globals.css";

/** Lưới an toàn cho lỗi ném ra từ **chính `layout.tsx`** (vá D4, 2026-08-22).
 *
 * `app/error.tsx` nằm BÊN TRONG root layout, nên nó chỉ đỡ được lỗi của `children`. Lỗi
 * ném từ `RootLayout`, `Chrome` hay `ChanTrang` bay lên trên nó và không có gì hứng ⇒
 * trang trắng của Next, đúng thứ mà vá A1 dựng `error.tsx` để diệt — chỉ ở một tầng cao
 * hơn. Ở 1c ba thành phần đó chưa gọi API, nên đây là hàng rào đặt trước; Phase 2 gắn
 * auth vào `Chrome` là nó thành đường lỗi có thật.
 *
 * Vì nó THAY root layout (Next dựng lại từ `<html>`), file này phải tự khai `<html>` và
 * `<body>`, và không được dựa vào bất cứ thứ gì `layout.tsx` cung cấp. Token màu lấy từ
 * `globals.css` nhập thẳng ở đây; ba mặt chữ của `next/font` thì KHÔNG — chúng gắn vào
 * `<html className>` của layout, nên trang này về font hệ thống. Đó là chủ đích: một
 * trang chỉ hiện khi khung sườn đã hỏng thì càng ít phụ thuộc càng tốt.
 *
 * Không có nút "Thử lại" gọi `router.refresh()` như `error.tsx`: `useRouter` cần router
 * context, mà cái đang hỏng chính là cây bọc nó. Ở đây `reset()` trần là thứ trung thực
 * — và có một nút tải lại hẳn trang bên cạnh nó.
 *
 * ⚠ **File này có 0 bài đo HÀNH VI** — có 2 bài ĐỌC MÃ ở `e2e/don-vi/trang-loi.spec.ts` (ghim
 * rằng nó luôn còn một đường thoát không khoá được), nhưng không bài nào render nó.
 * Ở 1c không có đường lỗi nào chạy qua nó (ba thành phần của
 * layout đều không gọi API), nên không có cách dựng một ca thật để đo — đó vừa là lý do
 * nó an toàn, vừa là lý do đừng tin nó chạy đúng cho tới khi Phase 2 gắn auth vào
 * `Chrome` và có ca thật. Nợ này đã ghi vào báo cáo vá 2, không phải quên.
 */
export default function LoiToanCuc({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Khung trang hỏng:", error.digest ?? error.message);
  }, [error]);

  return (
    <html lang="vi">
      <body>
        <main className={css.khung} data-testid="trang-loi-toan-cuc">
          <h1 className={css.tieu_de}>gikky.net đang hỏng</h1>
          <p className={css.than}>
            Không dựng được khung trang. Thử lại sau ít phút — nội dung không mất đi đâu,
            mạch vẫn nằm nguyên trên máy chủ.
          </p>
          {error.digest !== undefined && (
            <p className={css.ma} data-testid="trang-loi-toan-cuc-ma">
              Mã lỗi: <span className="mono">{error.digest}</span>
            </p>
          )}
          <button
            type="button"
            className={css.nut}
            onClick={reset}
            data-testid="trang-loi-toan-cuc-thu-lai"
          >
            Thử lại
          </button>{" "}
          {/* Tải lại HẲN, không `next/link`: điều hướng phía client đi qua đúng cây
              router vừa hỏng. `window.location` là đường chắc chắn thoát ra —
              và cũng là lý do đây là `<button>` chứ không `<a>` (eslint
              `no-html-link-for-pages` cấm `<a>` trỏ route nội bộ, đúng trong mọi ca
              khác). */}
          <button
            type="button"
            className={css.nut}
            onClick={() => window.location.assign("/")}
            data-testid="trang-loi-toan-cuc-ve-trang-chu"
          >
            Tải lại trang chủ
          </button>
        </main>
      </body>
    </html>
  );
}
