"use client";

import { Plus } from "lucide-react";

import { useDrawerDangNhanh } from "./drawer-dang-nhanh";
import css from "./nut-dang-mach.module.css";
import { usePhien } from "./phien";

/** Lối vào trượt form đăng bài nhanh (kiểu Cloudflare) hoặc nối mốc nếu đang ở bài của mình.
 *
 * **Khách không thấy nút này**, và đó không phải sự keo kiệt: ngay cạnh nó đã có "Đăng
 * nhập" và "Đăng ký" (`ThanhTaiKhoan`).
 *
 * **Trong lúc chưa biết mình là ai thì giữ chỗ, không vẽ nút** — cùng lý lẽ với
 * `ThanhTaiKhoan`: chớp một cái nút rồi rút nó đi là cú nhảy bố cục ngay chỗ mắt người ta
 * nhìn đầu tiên.
 */
export function NutDangMach() {
  const { toi, dangTai } = usePhien();
  const { moDrawer } = useDrawerDangNhanh();

  // Giữ chỗ tới khi `/me` trả lời; cờ CSS `data-da-dang-nhap` (script `<head>`) định cỡ ô — không thì
  // ô sập về 0 rồi nút mới hiện, cụm phải header giật hai lần (việc 14, đợt E). Cờ sống suốt lượt
  // tải vì lần render hydrate khớp HTML server (việc 17, `PhienProvider`).
  if (dangTai) {
    return <span className={css.cho_nut} aria-hidden />;
  }

  if (!(toi?.dang_nhap ?? false)) return null;

  return (
    <button
      type="button"
      onClick={moDrawer}
      className={css.nut}
      data-testid="nut-dang-mach"
      aria-label="Đăng bài nhanh"
      title="Đăng bài nhanh"
    >
      <Plus size={18} strokeWidth={2} aria-hidden />
    </button>
  );
}
