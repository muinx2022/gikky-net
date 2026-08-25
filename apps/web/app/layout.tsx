import type { Metadata } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";

import { ChanTrang } from "@/components/chan-trang";
import { Chrome } from "@/components/chrome";
import { PhienProvider } from "@/components/phien";
import { ToastProvider } from "@/components/toast";
import { SITE_ORIGIN } from "@/lib/site";
import { nguonScriptKieuXem } from "@/lib/kieu-xem";
import { nguonScriptTheme } from "@/lib/theme";

import "./globals.css";

// Mặt chữ của PLAN 9.1 — **đổi 2026-08-23** theo yêu cầu "font như của Reddit".
//
// Trước: Newsreader (serif, tiêu đề mạch) + Be Vietnam Pro (UI) + IBM Plex Mono (số).
// Nay: **IBM Plex Sans** gánh cả tiêu đề lẫn UI, IBM Plex Mono giữ nguyên.
//
// Vì sao Plex Sans: đó chính là mặt chữ Reddit dùng cho tiêu đề bài và thân bài, và nó
// **cùng một họ** với IBM Plex Mono vốn đã có ở đây — nên số trong bảng và chữ quanh nó
// khớp chiều cao chữ x, thứ mà một cặp font khác họ không bao giờ khớp.
//
// Cái mất, nói thẳng: tương phản serif/sans giữa "tiêu đề mạch" và "UI" biến mất. Đó là
// một tín hiệu thị giác PLAN 9.1 cố ý dựng ("sổ nghiêm vs khán đài xuề xoà"), và từ nay
// nó phải sống bằng **cỡ chữ + độ đậm + màu**, không còn bằng hình dáng chữ nữa.
//
// ⚠ **Ảnh OG vẫn dùng ba file .ttf cũ** (`lib/og.ts`) — satori cần file `.ttf` thật, mà
// `next/font` chỉ sinh `.woff2`. Nợ có tên `OG-FONT-CHUA-DOI`: tiêu đề trên ảnh OG còn
// là Newsreader trong khi trang là Plex Sans. Trả nó = thả `IBMPlexSans-SemiBold.ttf`
// vào `assets/font/` rồi đổi `TEN_FILE_FONT`.
//
// `next/font` tự host file font (không gọi Google lúc chạy), tự sinh `font-display: swap`
// và preload.
const ibmPlexSans = IBM_Plex_Sans({
  subsets: ["latin", "vietnamese"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-plex-sans",
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
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
      // Script theme dưới đây đặt `data-theme` + `style="color-scheme"` lên CHÍNH thẻ này
      // trước khi React hydrate, còn server thì **cố ý** không render hai thứ đó (trang
      // mạch chạy ISR — một bản HTML dùng chung; nướng theme của người này vào đó là phục
      // vụ nhầm người). Nên lệch ở đây là ĐÚNG THIẾT KẾ, không phải lỗi cần vá.
      //
      // Không có dòng này thì mọi trang, với mọi người dùng, ném một hydration error đỏ
      // trong dev (`style="color-scheme: light dark"` là nhánh mặc định, ai cũng đi qua).
      // Cái giá của một cảnh báo luôn-đỏ là không ai còn đọc cảnh báo nữa.
      //
      // ⚠ Nó chỉ tắt cảnh báo cho thuộc tính của **đúng thẻ `<html>`**, không lan xuống
      // con — một mismatch thật ở bất kỳ chỗ nào khác vẫn kêu. Đừng bê nó xuống sâu hơn.
      suppressHydrationWarning
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
        {/* `ToastProvider` bọc TRONG `PhienProvider` chứ không ngoài: nó phải render vùng
            `aria-live` của mình sau nội dung trang, và mọi form gọi `useToast()` đều đã
            nằm trong `PhienProvider` rồi. Nó là client component nhưng `children` truyền
            qua nó vẫn render ở server — nên `/luat` giữ nguyên `○` (tĩnh). */}
        <PhienProvider>
          <ToastProvider>
            <Chrome />
            {children}
            <ChanTrang />
          </ToastProvider>
        </PhienProvider>
      </body>
    </html>
  );
}
