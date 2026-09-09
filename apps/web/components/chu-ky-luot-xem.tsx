"use client";

import { useTrangThaiToi } from "./trang-thai-toi";

export function ChuKyLuotXem({
  initialCount,
  className,
}: {
  initialCount: number;
  className?: string;
}) {
  const { trangThai } = useTrangThaiToi();
  // Nếu server trả 0 (do bài mới mở hoặc kẹt cache ISR), hiển thị tối thiểu 1 view
  // vì người dùng đang trực tiếp đọc bài viết này.
  // Khi /me nạp xong (live từ DB không cache), đồng bộ số live mới nhất.
  const count = trangThai?.view_count ?? Math.max(1, initialCount);

  return (
    <span
      className={className}
      data-testid="chu-ky-luot-xem"
      suppressHydrationWarning
    >
      {count.toLocaleString("vi-VN")} lượt xem
    </span>
  );
}
