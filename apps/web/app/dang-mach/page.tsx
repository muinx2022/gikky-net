import type { Metadata } from "next";
import { KhungHaiCot } from "@/components/khung-hai-cot";

import { FormDangMach } from "@/components/form-dang-mach";
import { docCacSub } from "@/lib/api";

import css from "./dang-mach.module.css";

// Cùng lý do với trang chủ và trang mạch: cơ chế cache của PLAN 8.4 là việc của Phase 3,
// và dòng này giữ cho `pnpm build` không cần Django sống.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Đăng bài",
  // Trang công cụ, không phải nội dung. Để Google index một cái form rỗng là làm loãng
  // đúng thứ PLAN mục 1 trông cậy: mỗi mạch tử tế là một trang đón traffic.
  robots: { index: false, follow: false },
};

export default async function TrangDangMach({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const q = await searchParams;
  const sub = Array.isArray(q.sub) ? q.sub[0] : q.sub;
  // `GET /subs` chứ không phải một mảng slug ghi cứng (PLAN mục 7). Sub thứ ba mở ra qua
  // admin phải tự có mặt ở ô chọn này, không cần ai nhớ sửa frontend.
  const cac_sub = await docCacSub();

  return (
    <KhungHaiCot>
      <h1 className={css.tieu_de}>Đăng bài</h1>
      <p className={css.lede}>
        Ghi lý do <em>trước</em> khi biết kết quả — máy chủ đóng dấu thời gian, và dấu đó
        không sửa được. Đó là toàn bộ giá trị của một cuốn sổ ở đây.
      </p>
      <FormDangMach cacSub={cac_sub} subMacDinh={sub} />
    </KhungHaiCot>
  );
}
