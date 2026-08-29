"use client";

import { useEffect } from "react";

/** Tiêu đề tab trình duyệt, đặt theo TRANG đang mở.
 *
 * ## Vì sao là một effect chứ không phải `metadata` của Next
 *
 * `export const metadata` chỉ dùng được ở **server component**, mà mọi trang trong khu
 * quản trị đều là client component (`"use client"`) — chúng gọi API từ trình duyệt để
 * cookie session đi kèm. Nên đường duy nhất còn lại là ghi thẳng `document.title`.
 *
 * ## Vì sao nó đáng làm
 *
 * Mod mở 5–6 tab cùng lúc (hàng đợi báo cáo · bảng mạch · một hồ sơ · nhật ký). Tất cả
 * cùng mang một tiêu đề `layout.tsx` thì tab nào cũng như tab nào, và lịch sử trình duyệt
 * cũng vậy — thứ duy nhất phân biệt được là bấm vào xem.
 */
const HAU_TO = "gikky quản trị";

export function useTieuDeTrang(ten: string | null): void {
  useEffect(() => {
    // `null` = trang chưa biết mình tên gì (đang nạp). Giữ nguyên tiêu đề cũ còn hơn
    // nháy qua một chữ "Đang tải…" rồi đổi lại — tab nhấp nháy ở mọi lần điều hướng.
    if (ten === null) return;
    document.title = `${ten} — ${HAU_TO}`;
  }, [ten]);
}
