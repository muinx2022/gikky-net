"use client";

import { Pencil } from "lucide-react";
import Link from "next/link";

import css from "./nut-sua-ho-so.module.css";
import { usePhien } from "./phien";

/** Nút "Sửa hồ sơ" — **chỉ hiện trên hồ sơ của chính mình**.
 *
 * Client component vì trang hồ sơ render ở server và **cố ý không biết người xem là ai**
 * (PLAN 8.4: trang công khai, không nướng dữ liệu per-user vào HTML). Câu hỏi "đây có phải
 * hồ sơ của tôi không" chỉ trả lời được ở trình duyệt qua `usePhien()`.
 *
 * Người lạ không thấy gì — không phải một nút xám. PLAN mục 4: "một cái nút vĩnh viễn
 * không bấm được còn tệ hơn không có nút".
 */
export function NutSuaHoSo({ username }: { username: string }) {
  const { toi } = usePhien();
  if (toi?.dang_nhap !== true || toi.username !== username) return null;
  return (
    <Link href="/sua-ho-so" className={css.nut} data-testid="nut-sua-ho-so">
      <Pencil size={14} strokeWidth={2} aria-hidden />
      Sửa hồ sơ
    </Link>
  );
}
