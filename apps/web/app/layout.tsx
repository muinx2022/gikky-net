import type { Metadata } from "next";
import { Be_Vietnam_Pro, IBM_Plex_Mono, Newsreader } from "next/font/google";

import { ChanTrang } from "@/components/chan-trang";
import { Chrome } from "@/components/chrome";
import { PhienProvider } from "@/components/phien";
import { SITE_ORIGIN } from "@/lib/site";
import { nguonScriptKieuXem } from "@/lib/kieu-xem";
import { nguonScriptTheme } from "@/lib/theme";

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
      <head>
        {/* **Phải nằm trong `<head>`, và phải là script THƯỜNG.**
            Đây là công tắc theme (`lib/theme.ts`). Nó đọc `localStorage` và đặt
            `data-theme` lên `<html>` TRƯỚC khi trình duyệt vẽ lần đầu. Chuyển nó xuống
            cuối `<body>`, hay đưa nó vào bundle React, là trang vẽ một lần bằng theme
            mặc định rồi mới đổi — cú nháy trắng vào mặt người đang ngồi trong tối. Bài đo
            `e2e/sang-toi.spec.ts` ghim đúng chuyện đó bằng cách đọc `data-theme` tại
            đúng khoảnh khắc `document.body` xuất hiện.

            `next/script` **không** dùng được ở đây: mọi `strategy` của nó đều chạy sau
            hydrate hoặc sau khi tài liệu đã tương tác được, tức sau lần vẽ đầu.

            Không có gì per-user trong chuỗi này — nó là một HẰNG, ai cũng nhận đúng một
            chuỗi ký tự. Thứ khác nhau giữa hai người là `localStorage` của họ. Đó là điều
            kiện để trang mạch còn cache được bằng ISR (PLAN 8.4). */}
        <script dangerouslySetInnerHTML={{ __html: nguonScriptTheme() }} />
        {/* Kiểu xem feed (thẻ/gọn) đi cùng cơ chế và cùng lý do, chỉ nặng hơn một bậc:
            nó đổi CHIỀU CAO của mọi thẻ, nên áp sau hydrate là cả feed nhảy dựng lên
            dưới con trỏ. Xem `lib/kieu-xem.ts`. */}
        <script dangerouslySetInnerHTML={{ __html: nguonScriptKieuXem() }} />
      </head>
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
