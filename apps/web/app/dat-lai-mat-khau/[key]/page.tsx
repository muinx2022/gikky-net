import type { Metadata } from "next";
import { KhungHaiCot } from "@/components/khung-hai-cot";

import { FormDatLaiMatKhau } from "@/components/tai-khoan-forms";
import { giaiMaKhoa } from "@/lib/khoa-url";

// `KhungHaiCot` gọi `GET /subs` ở phía SERVER với `cache: "no-store"`
// (`lib/api.ts::CHUNG`) ⇒ route này không tiền dựng được nữa. Thiếu dòng dưới thì
// `next build` ĐỎ ở bước export: Next ném `DynamicServerError`, `lay()` bọc nó lại
// nên Next không tự chuyển route sang dynamic được.
// Thêm 2026-08-25 lúc dựng bản Docker đầu tiên —
// xem `plans/2026-08-25-deploy-vps-docker.md` §"Trang tĩnh vỡ vì KhungHaiCot".
export const dynamic = "force-dynamic";

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
  return (
    <KhungHaiCot>
      <FormDatLaiMatKhau khoa={giaiMaKhoa(key)} />
    </KhungHaiCot>
  );
}
