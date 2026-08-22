import type { Metadata } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono, Newsreader } from "next/font/google";

import { ChanTrang } from "@/components/chan-trang";
import { Chrome } from "@/components/chrome";
import { PhienProvider } from "@/components/phien";
import { SITE_ORIGIN } from "@/lib/site";

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
  // **Bắt buộc từ Phase 6.** File `app/opengraph-image.tsx` sinh ra một URL ảnh TƯƠNG
  // ĐỐI, mà `og:image` phải tuyệt đối để Facebook tải được. Không có `metadataBase`,
  // Next ghép tạm `http://localhost:3000` **và in warning ở mỗi lần build** — mà luật 2
  // của `D:\Projects\CLAUDE.md` lấy 0 warning làm mốc. Prod đặt `SITE_ORIGIN`.
  metadataBase: new URL(SITE_ORIGIN),
  title: {
    default: "gikky.net — nhật ký giao dịch của người Việt",
    template: "%s · gikky.net",
  },
  description:
    "Diễn đàn trading tiếng Việt. Bài viết là một mạch: tác giả nối thêm mốc theo thời "
    + "gian thực, dấu thời gian máy chủ bất biến.",
  // `<link rel="alternate" type="application/rss+xml">` — cách duy nhất để trình đọc feed
  // và các tiện ích trình duyệt TỰ tìm ra `/feed.xml`. Không có dòng này thì RSS chỉ tồn
  // tại cho ai đã biết URL của nó.
  //
  // ⚠ Trang nào tự khai `alternates` (trang mạch khai `canonical`) sẽ **thay** cả khối
  // này, không gộp — đó là luật merge metadata của Next, và nó đúng ở đây: một trang mạch
  // không có feed riêng để mà trỏ tới.
  alternates: {
    types: {
      "application/rss+xml": [{ url: "/feed.xml", title: "gikky.net — mạch mới" }],
    },
  },
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
