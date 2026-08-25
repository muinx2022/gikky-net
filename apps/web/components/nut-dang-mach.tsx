"use client";

import { Plus } from "lucide-react";
import Link from "next/link";

import css from "./nut-dang-mach.module.css";
import { usePhien } from "./phien";

/** Lối vào `/dang-mach` trên thanh trên cùng — cửa chính của vòng lặp lõi (PLAN mục 1).
 *
 * **Khách không thấy nút này**, và đó không phải sự keo kiệt: ngay cạnh nó đã có "Đăng
 * nhập" và "Đăng ký" (`ThanhTaiKhoan`), nên một lối thứ ba dẫn tới một trang chỉ nói "đăng
 * nhập đi" là thêm một vòng cho cùng một việc. Trang `/dang-mach` vẫn xử tử tế ca vào
 * thẳng bằng URL — nó hiện lời mời đăng nhập chứ không hiện form rỗng.
 *
 * **Trong lúc chưa biết mình là ai thì giữ chỗ, không vẽ nút** — cùng lý lẽ với
 * `ThanhTaiKhoan`: chớp một cái nút rồi rút nó đi là cú nhảy bố cục ngay chỗ mắt người ta
 * nhìn đầu tiên.
 */
export function NutDangMach() {
  const { toi, dangTai } = usePhien();

  if (dangTai || !(toi?.dang_nhap ?? false)) return null;

  return (
    <Link href="/dang-mach" className={css.nut} data-testid="nut-dang-mach">
      <Plus size={15} strokeWidth={2.2} aria-hidden />
      Đăng bài
    </Link>
  );
}
