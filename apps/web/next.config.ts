import type { NextConfig } from "next";

// Same-origin ở dev: Next nhận `/api/*` rồi chuyển tiếp sang Django (PLAN 8.2).
// Prod là việc của Caddy — KHÔNG dựa vào rewrites này khi lên prod.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // @gikky/api-client là TS thô sinh từ OpenAPI, không build sẵn.
  transpilePackages: ["@gikky/api-client"],
  // Ba file TTF của ảnh OG (Phase 6) được đọc lúc CHẠY bằng `fs.readFile(process.cwd() +
  // "/assets/font/…")`, không phải `import` — nên bước tracing của Next không thấy chúng
  // và bản deploy `standalone` sẽ thiếu font. Thiếu font thì `ImageResponse` ném ngay
  // request đầu tiên: ảnh OG chết trên prod trong khi dev xanh, đúng loài lỗi chỉ lộ ra
  // sau khi deploy. Xem `apps/web/lib/og.ts`.
  outputFileTracingIncludes: {
    "/**": ["./assets/font/*.ttf"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
      // Ảnh ở DEV (Phase 5). Prod thì Caddy phục vụ `/media/*` thẳng từ đĩa, không qua
      // Django và cũng không qua Next — xem `deploy/Caddyfile` và `api/config/urls.py`.
      //
      // Thiếu đúng dòng này thì upload trả 201, hàng trong DB đúng, `<img src>` đúng, và
      // MỌI tấm ảnh 404. Không có gì đỏ ở tầng Python vì Django phục vụ được; chỉ trình
      // duyệt mới thấy. Bài đo `e2e/anh.spec.ts::A1` bắt đúng ca đó bằng cách fetch lại
      // chính `src` mà nó vừa đọc từ DOM.
      {
        source: "/media/:path*",
        destination: `${API_ORIGIN}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
