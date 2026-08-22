import type { Metadata } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono, Newsreader } from "next/font/google";

import { ChanTrang } from "@/components/chan-trang";
import { Chrome } from "@/components/chrome";
import { PhienProvider } from "@/components/phien";

import "./globals.css";

// Ba mặt chữ của PLAN 9.1, không hơn: Newsreader cho tiêu đề mạch, Be Vietnam Pro cho
// UI, IBM Plex Mono cho MỌI timestamp + con số. `next/font` tự host file font (không gọi
// Google lúc chạy) và tự sinh `font-display: swap` + preload.
const newsreader = Newsreader({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "600"],
  variable: "--font-newsreader",
});

const beVietnamPro = Be_Vietnam_Pro({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-be-vietnam-pro",
});

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-ibm-plex-mono",
});

export const metadata: Metadata = {
  title: {
    default: "gikky.net — nhật ký giao dịch của người Việt",
    template: "%s · gikky.net",
  },
  description:
    "Diễn đàn trading tiếng Việt. Bài viết là một mạch: tác giả nối thêm mốc theo thời "
    + "gian thực, dấu thời gian máy chủ bất biến.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="vi"
      className={`${newsreader.variable} ${beVietnamPro.variable} ${ibmPlexMono.variable}`}
    >
      <body>
        {/* `PhienProvider` là client component, nhưng nó **không** làm layout thành
            dynamic: nó hỏi `GET /me` trong `useEffect`, tức ở trình duyệt. Nhờ vậy
            `/luat` giữ nguyên `○` (tĩnh) — đường thoát của `error.tsx`. Một `cookies()`
            ở phía server tại đây thì ngược lại: cả cây route thành dynamic. */}
        <PhienProvider>
          <Chrome />
          {children}
          <ChanTrang />
        </PhienProvider>
      </body>
    </html>
  );
}
