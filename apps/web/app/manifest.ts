import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "gikky.net — nhật ký giao dịch của người Việt",
    short_name: "gikky",
    description:
      "Diễn đàn trading tiếng Việt. Mạch nhật ký giao dịch theo thời gian thực.",
    start_url: "/",
    display: "standalone",
    background_color: "#f1f2f5",
    theme_color: "#3a46a8",
    icons: [
      {
        src: "/icon.png",
        sizes: "32x32",
        type: "image/png",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
      },
      {
        src: "/logo.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
