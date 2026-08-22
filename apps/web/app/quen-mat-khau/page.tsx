import type { Metadata } from "next";

import { FormQuenMatKhau } from "@/components/tai-khoan-forms";

export const metadata: Metadata = {
  title: "Quên mật khẩu",
  robots: { index: false, follow: false },
};

export default function TrangQuenMatKhau() {
  return <FormQuenMatKhau />;
}
