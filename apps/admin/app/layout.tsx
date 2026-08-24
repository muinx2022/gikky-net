import type { Metadata } from "next";

import { CongQuanTri } from "../components/cong-quan-tri";
import { nguonScriptTheme } from "../lib/theme";

import "./globals.css";

export const metadata: Metadata = {
  title: "gikky.net — quản trị",
  description: "Khu quản trị gikky.net",
  // Khu quản trị KHÔNG được lọt vào chỉ mục nào: nó nằm sau allowlist IP ở prod (PLAN
  // 8.2), nhưng một trang admin bị index là bản đồ bề mặt tấn công phát ra công khai.
  robots: { index: false, follow: false },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" suppressHydrationWarning>
      <head>
        {/* Theme phải có TRƯỚC lần vẽ đầu tiên, nếu không mỗi lần tải trang ở chế độ Tối
            sẽ nháy trắng một nhịp (FOUC). Không có cách nào làm việc này bằng React:
            React chạy sau khi HTML đã vẽ.

            `suppressHydrationWarning` trên `<html>` là bắt buộc và có phạm vi hẹp đúng
            một phần tử: script này sửa `data-theme` của `<html>` trước khi React hydrate,
            nên server (không có thuộc tính) và client (có) khác nhau ở đúng chỗ đó. */}
        <script dangerouslySetInnerHTML={{ __html: nguonScriptTheme() }} />
      </head>
      <body>
        {/* Cổng + khung bọc MỘT LẦN ở đây, không phải ở từng trang: điều hướng phía
            client không dựng lại chúng, nên `/me` chỉ gọi một lần mỗi phiên và trạng
            thái sidebar không mất mỗi lần bấm một mục menu. `/dang-nhap` đi vòng qua
            cổng — danh sách ngoại lệ nằm trong `CongQuanTri`. */}
        <CongQuanTri>{children}</CongQuanTri>
      </body>
    </html>
  );
}
