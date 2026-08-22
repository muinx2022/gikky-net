import type { Metadata } from "next";

import { XacThucEmail } from "@/components/tai-khoan-forms";
import { giaiMaKhoa } from "@/lib/khoa-url";

export const metadata: Metadata = {
  title: "Xác thực email",
  robots: { index: false, follow: false },
};

/** Đích của đường dẫn trong email xác nhận — xem `HEADLESS_FRONTEND_URLS` ở
 * `api/config/settings.py`.
 *
 * Khoá đi qua `giaiMaKhoa` chứ **không** dùng thẳng `params.key`: allauth mã hoá khoá khi
 * ghép vào URL, và gửi bản mã hoá xuống API là 400 — một mã trông y hệt "khoá hết hạn".
 * Lý do đầy đủ ở `lib/khoa-url.ts`. */
export default async function TrangXacThucEmail({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <XacThucEmail khoa={giaiMaKhoa(key)} />;
}
