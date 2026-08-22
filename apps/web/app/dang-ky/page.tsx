import type { Metadata } from "next";

import { FormDangKy } from "@/components/tai-khoan-forms";

/** `noindex` cho cả năm trang tài khoản: chúng không có nội dung để index, và một trang
 * đăng nhập nằm trong kết quả tìm kiếm chỉ hút nhầm người tới. Sitemap cũng không khai
 * chúng (`app/sitemap.ts`). */
export const metadata: Metadata = {
  title: "Đăng ký",
  robots: { index: false, follow: false },
};

export default function TrangDangKy() {
  return <FormDangKy />;
}
