import type { Metadata } from "next";

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
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
