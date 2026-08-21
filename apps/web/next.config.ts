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
    ];
  },
};

export default nextConfig;
