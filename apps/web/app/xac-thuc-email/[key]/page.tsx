import type { Metadata } from "next";
import { KhungHaiCot } from "@/components/khung-hai-cot";

import { XacThucEmail } from "@/components/tai-khoan-forms";
import { giaiMaKhoa } from "@/lib/khoa-url";

// `KhungHaiCot` gọi `GET /subs` ở phía SERVER với `cache: "no-store"`
// (`lib/api.ts::CHUNG`) ⇒ route này không tiền dựng được nữa. Thiếu dòng dưới thì
// `next build` ĐỎ ở bước export: Next ném `DynamicServerError`, `lay()` bọc nó lại
// nên Next không tự chuyển route sang dynamic được.
// Thêm 2026-08-25 lúc dựng bản Docker đầu tiên —
// xem `plans/2026-08-25-deploy-vps-docker.md` §"Trang tĩnh vỡ vì KhungHaiCot".
export const dynamic = "force-dynamic";

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
  return (
    <KhungHaiCot>
      <XacThucEmail khoa={giaiMaKhoa(key)} />
    </KhungHaiCot>
  );
}
