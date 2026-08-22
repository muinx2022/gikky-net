import type { Metadata } from "next";

import { FormDatLaiMatKhau } from "@/components/tai-khoan-forms";
import { giaiMaKhoa } from "@/lib/khoa-url";

export const metadata: Metadata = {
  title: "Đặt mật khẩu mới",
  robots: { index: false, follow: false },
};

/** Khoá đi qua `giaiMaKhoa`, **không** dùng thẳng `params.key`.
 *
 * Đây là chỗ dễ sai nhất của cả luồng, và nó đã sai thật một lần trong lúc làm Phase 2:
 * allauth ghép khoá vào URL nên nó bị mã hoá (`MQ:1wxo…` → `MQ%3A1wxo…`), và gửi bản mã
 * hoá xuống API là **400** — một mã trông y hệt "khoá sai hoặc hết hạn", nên lỗi bị chẩn
 * đoán nhầm thành "luồng đặt lại mật khẩu hỏng". Lý do đầy đủ: `lib/khoa-url.ts`.
 */
export default async function TrangDatLaiMatKhau({
  params,
}: {
  params: Promise<{ key: string }>;
}) {
  const { key } = await params;
  return <FormDatLaiMatKhau khoa={giaiMaKhoa(key)} />;
}
