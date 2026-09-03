import type { NextConfig } from "next";

// Same-origin ở dev: Next nhận `/api/*` rồi chuyển tiếp sang Django (PLAN 8.2).
// Prod là việc của Caddy — KHÔNG dựa vào rewrites này khi lên prod.
const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:8000";

const nextConfig: NextConfig = {
  // @gikky/api-client là TS thô sinh từ OpenAPI, không build sẵn.
  transpilePackages: ["@gikky/api-client"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${API_ORIGIN}/api/:path*`,
      },
      // Ảnh ở DEV. Prod thì Caddy phục vụ `/media/*` thẳng từ đĩa trên cả
      // `admin.gikky.net` (`deploy/prod/Caddyfile`), không qua Django và không qua Next.
      //
      // Thiếu đúng dòng này thì upload trả 201, hàng trong DB đúng, `<img src>` đúng, và
      // MỌI tấm ảnh trong trình soạn thảo của khu quản trị 404. Không có gì đỏ ở tầng
      // Python vì Django phục vụ được; chỉ trình duyệt mới thấy. Bản của `apps/web` mang
      // đúng chú thích này — hai app Next tách biệt, không có chỗ chung cho một dòng
      // rewrite, nên đây là bản thứ hai có chủ đích.
      {
        source: "/media/:path*",
        destination: `${API_ORIGIN}/media/:path*`,
      },
    ];
  },
};

export default nextConfig;
