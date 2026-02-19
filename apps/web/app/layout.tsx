import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { SessionProvider } from "next-auth/react";
import { AuthProvider } from "../components/AuthContext";
import SystemThemeSync from "../components/SystemThemeSync";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  title: {
    default: "Gikky – Cộng đồng chia sẻ kiến thức",
    template: "%s | Gikky",
  },
  description: "Gikky là nơi chia sẻ kiến thức, thảo luận chuyên sâu và kinh nghiệm giao dịch từ cộng đồng.",
  openGraph: {
    type: "website",
    locale: "vi_VN",
    siteName: "Gikky",
    title: "Gikky – Cộng đồng chia sẻ kiến thức",
    description: "Gikky là nơi chia sẻ kiến thức, thảo luận chuyên sâu và kinh nghiệm giao dịch từ cộng đồng.",
  },
  twitter: {
    card: "summary_large_image",
    title: "Gikky – Cộng đồng chia sẻ kiến thức",
    description: "Gikky là nơi chia sẻ kiến thức, thảo luận chuyên sâu và kinh nghiệm giao dịch từ cộng đồng.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" style={{ overflowY: "scroll" }} suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <SystemThemeSync />
        <SessionProvider>
          <AuthProvider>{children}</AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
