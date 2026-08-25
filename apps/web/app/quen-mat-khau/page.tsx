import type { Metadata } from "next";
import { KhungHaiCot } from "@/components/khung-hai-cot";

import { FormQuenMatKhau } from "@/components/tai-khoan-forms";

// `KhungHaiCot` gọi `GET /subs` ở phía SERVER với `cache: "no-store"`
// (`lib/api.ts::CHUNG`) ⇒ route này không tiền dựng được nữa. Thiếu dòng dưới thì
// `next build` ĐỎ ở bước export: Next ném `DynamicServerError`, `lay()` bọc nó lại
// nên Next không tự chuyển route sang dynamic được.
// Thêm 2026-08-25 lúc dựng bản Docker đầu tiên —
// xem `plans/2026-08-25-deploy-vps-docker.md` §"Trang tĩnh vỡ vì KhungHaiCot".
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
  robots: { index: false, follow: false },
};

export default function TrangQuenMatKhau() {
  return (
    <KhungHaiCot>
      <FormQuenMatKhau />
    </KhungHaiCot>
  );
}
