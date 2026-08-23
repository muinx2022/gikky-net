import type { Metadata } from "next";

import { FormCaiDat } from "@/components/form-cai-dat";

export const metadata: Metadata = {
  title: "Cài đặt",
  // `noindex` cùng lý do với `/doi-mat-khau`: trang chỉ có nghĩa với người đang đăng
  // nhập, và với bot nó là một khung rỗng. Nó cũng là đích của link **huỷ đăng ký**
  // trong thư digest — một URL đi vào chỉ mục tìm kiếm.
  robots: { index: false, follow: false },
};

export default function TrangCaiDat() {
  return <FormCaiDat />;
}
