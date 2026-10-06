"use client";

import Script from "next/script";

const GA_ID = process.env.NEXT_PUBLIC_GA_ID || "G-T69MKM95BR";

/** Tự động nhúng Google Analytics 4 (gtag.js) khi có mã đo lường `GA_ID`.
 *
 * Sử dụng `next/script` với `strategy="afterInteractive"` để tải không đồng bộ sau khi
 * trang đã tương tác được, không ảnh hưởng đến tốc độ tải ban đầu (First Contentful Paint)
 * và giữ vững điểm chuẩn hiệu năng.
 */
export function GoogleAnalytics() {
  if (!GA_ID) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${GA_ID}`}
        strategy="afterInteractive"
      />
      <Script id="google-analytics" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${GA_ID}');
        `}
      </Script>
    </>
  );
}
