import type { Metadata } from "next";

import { CuocTroChuyen } from "@/components/cuoc-tro-chuyen";
import { KhungHaiCot } from "@/components/khung-hai-cot";

// Cùng lý do `app/tin-nhan/page.tsx`: `KhungHaiCot` gọi `GET /subs` ở phía server với
// `cache: "no-store"`, nên route không tiền dựng được.
export const dynamic = "force-dynamic";

type ThamSo = { username: string };

export async function generateMetadata({
  params,
}: {
  params: Promise<ThamSo>;
}): Promise<Metadata> {
  const { username } = await params;
  return {
    title: `Nhắn tin với u/${username}`,
    // `noindex` — nội dung riêng tư giữa hai người. Xem `app/tin-nhan/page.tsx`.
    robots: { index: false, follow: false },
  };
}

/** `/tin-nhan/<username>` — một cuộc trò chuyện.
 *
 * Server ở đây **chỉ biết một chuỗi username**; nó không đọc một tin nào và không hỏi
 * người xem là ai. Toàn bộ nội dung do `CuocTroChuyen` nạp ở trình duyệt, kể cả câu trả
 * lời "người này có tồn tại không" — hỏi ở server nghĩa là biến trang này thành một cửa
 * dò username không cần đăng nhập.
 */
export default async function TrangCuocTroChuyen({
  params,
}: {
  params: Promise<ThamSo>;
}) {
  const { username } = await params;
  return (
    <KhungHaiCot>
      <CuocTroChuyen username={username} />
    </KhungHaiCot>
  );
}
