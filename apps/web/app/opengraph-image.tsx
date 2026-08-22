import { ImageResponse } from "next/og";

import { OgThe } from "@/components/og-the";
import { KHUNG_OG, KIEU_OG, docMatChu, ogTrangChu } from "@/lib/og";

/** Ảnh OG của trang chủ và của **mọi route chưa có ảnh riêng** — Next lấy file
 * `opengraph-image` gần nhất đi ngược lên cây `app/`, nên file này cũng là ảnh mặc định
 * cho `/luat`, `/u/<username>` và trang 404.
 *
 * **Không gọi API**, và đó là điều kiện để nó tĩnh: `app/page.tsx` là `force-dynamic`
 * nhưng ảnh này không phụ thuộc dữ liệu nào, nên Next tiền dựng nó một lần lúc build.
 * Thêm một lời gọi Django vào đây là biến một tệp PNG hằng số thành một route phải chạy
 * mỗi lần Facebook ghé qua — mà Facebook ghé qua mỗi lần có người dán link.
 */
export const alt = "gikky.net — nhật ký giao dịch của người Việt";
export const size = KHUNG_OG;
export const contentType = KIEU_OG;

export default async function AnhOgTrangChu() {
  return new ImageResponse(<OgThe du_lieu={ogTrangChu()} />, {
    ...size,
    fonts: await docMatChu(),
  });
}
