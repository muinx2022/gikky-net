import type { Metadata } from "next";

import { HopThu } from "@/components/hop-thu";
import { KhungHaiCot } from "@/components/khung-hai-cot";

// `KhungHaiCot` gọi `GET /subs` ở phía SERVER với `cache: "no-store"` ⇒ route này không
// tiền dựng được. Thiếu dòng này thì `next build` ĐỎ ở bước export — cùng ca đã ghi ở
// `app/cai-dat/page.tsx`.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Tin nhắn",
  // `noindex` nặng hơn hẳn `/cai-dat`: đây là hộp thư RIÊNG. Trang chỉ có nghĩa với người
  // đang đăng nhập, và với bot nó là một khung rỗng — nhưng lý do thật là không có phần
  // nào của nó được phép đi vào một chỉ mục tìm kiếm.
  robots: { index: false, follow: false },
};

/** `/tin-nhan` — hộp thư nhắn tin riêng 1-1 (2026-09-03).
 *
 * Toàn bộ nội dung do `HopThu` nạp ở **trình duyệt**: dữ liệu ở đây là per-user tuyệt đối,
 * và nạp ở server là nướng hộp thư của người này vào HTML phục vụ người kia (PLAN 8.4).
 * Khách bị `HopThu` đẩy về `/dang-nhap`.
 */
export default function TrangTinNhan() {
  return (
    <KhungHaiCot>
      <HopThu />
    </KhungHaiCot>
  );
}
