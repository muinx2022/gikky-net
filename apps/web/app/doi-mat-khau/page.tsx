import type { Metadata } from "next";

import { FormDoiMatKhau } from "@/components/tai-khoan-forms";

export const metadata: Metadata = {
  title: "Đổi mật khẩu",
  robots: { index: false, follow: false },
};

export default function TrangDoiMatKhau() {
  return <FormDoiMatKhau />;
}
