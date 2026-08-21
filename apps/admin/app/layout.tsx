import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "gikky.net — admin",
  description: "Khu quản trị gikky.net — khung Phase 0",
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
