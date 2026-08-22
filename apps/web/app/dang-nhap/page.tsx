import type { Metadata } from "next";

import { FormDangNhap } from "@/components/tai-khoan-forms";

export const metadata: Metadata = {
  title: "Đăng nhập",
  robots: { index: false, follow: false },
};

export default function TrangDangNhap() {
  return <FormDangNhap />;
}
