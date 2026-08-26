"use client";

import { boTheoUser } from "@gikky/api-client";
import { useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./nut-theo-sub.module.css";
import { useToast } from "./toast";

/** Nút "Hủy" trong tab **Người** của hồ sơ — luôn là bỏ theo, không có chiều ngược.
 *
 * File riêng chứ không thêm một prop `kieu` vào `NutTheoUser`: ở đây trạng thái đã biết
 * chắc (mọi dòng trong danh sách đều là đang theo) nên **không có lượt hỏi
 * `GET /users/{u}/me`**, và bấm xong thì dòng phải rời khỏi danh sách — một việc
 * `NutTheoUser` không có khái niệm. Gộp hai cái là một component mang hai vòng đời khác
 * nhau sau một cái cờ.
 *
 * Cùng cặp với `NutBoTheoSub`, cùng lý do tách, và cùng dùng `nut-theo-sub.module.css`.
 */
export function NutBoTheoUser({
  username,
  onBoXong,
}: {
  username: string;
  onBoXong: () => void;
}) {
  const bao = useToast();
  const [dangGui, datDangGui] = useState(false);

  const bam = async () => {
    if (dangGui) return;
    datDangGui(true);
    try {
      const kq = await boTheoUser({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        path: { username },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      // Chỉ gỡ khỏi danh sách SAU KHI server xác nhận. Gỡ lạc quan ở đây khác nút trên
      // hồ sơ: ở đó hoàn lại là đổi một chữ, còn ở đây là chèn lại một dòng vào giữa
      // danh sách — người dùng thấy dòng biến mất rồi nhảy về chỗ cũ.
      onBoXong();
      bao(`Đã bỏ theo dõi u/${username}.`);
    } catch {
      bao("Không bỏ theo dõi được. Thử lại sau ít giây.");
    } finally {
      datDangGui(false);
    }
  };

  return (
    <button
      type="button"
      className={css.nut_go}
      onClick={() => void bam()}
      disabled={dangGui}
      data-testid="nut-bo-theo-user"
    >
      {dangGui ? "Đang bỏ…" : "Hủy"}
    </button>
  );
}
