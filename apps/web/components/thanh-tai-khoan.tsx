"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { dangXuat } from "@/lib/tai-khoan";
import { duongDanHoSo } from "@/lib/url";

import { usePhien } from "./phien";
import css from "./thanh-tai-khoan.module.css";

/** Góc phải thanh trên cùng: ai đang đăng nhập, và lối ra.
 *
 * **Trong lúc chưa biết mình là ai thì không vẽ gì** (`dangTai`). Vẽ trạng thái khách rồi
 * đổi sang tên người dùng là một cú nhảy bố cục ngay chỗ mắt người ta nhìn đầu tiên, và
 * tệ hơn: nó chớp "Đăng nhập" vào mặt một người **đang** đăng nhập. Một ô giữ chỗ cùng
 * chiều rộng là đủ.
 *
 * **Không có nút Google ở đây** — nó thuộc trang đăng nhập, và nó chỉ hiện khi
 * `me.google_bat` (PLAN mục 4: không nút vĩnh viễn không bấm được).
 */
export function ThanhTaiKhoan() {
  const { toi, dangTai, taiLai } = usePhien();
  const router = useRouter();
  const [mo, datMo] = useState(false);
  const [dangThoat, datDangThoat] = useState(false);

  if (dangTai) {
    return <span className={css.chua_biet} aria-hidden data-testid="tai-khoan-dang-tai" />;
  }

  if (toi === null || !toi.dang_nhap) {
    return (
      <div className={css.khach} data-testid="thanh-tai-khoan-khach">
        <Link href="/dang-nhap" className={css.lien_ket}>
          Đăng nhập
        </Link>
        <Link href="/dang-ky" className={css.nut_chinh}>
          Đăng ký
        </Link>
      </div>
    );
  }

  const thoat = async () => {
    datDangThoat(true);
    try {
      await dangXuat();
      await taiLai();
      datMo(false);
      router.refresh();
    } finally {
      datDangThoat(false);
    }
  };

  return (
    <div className={css.khung} data-testid="thanh-tai-khoan">
      <button
        type="button"
        className={css.ten}
        aria-expanded={mo}
        aria-haspopup="menu"
        onClick={() => datMo((x) => !x)}
        data-testid="nut-tai-khoan"
        {...CHU_NGUOI_DUNG}
      >
        u/{toi.username}
      </button>
      {mo && (
        <div className={css.menu} role="menu" data-testid="menu-tai-khoan">
          <Link href={duongDanHoSo(toi.username ?? "")} role="menuitem" onClick={() => datMo(false)}>
            Hồ sơ của tôi
          </Link>
          <Link href="/doi-mat-khau" role="menuitem" onClick={() => datMo(false)}>
            Đổi mật khẩu
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={() => void thoat()}
            disabled={dangThoat}
            data-testid="nut-dang-xuat"
          >
            {dangThoat ? "Đang thoát…" : "Đăng xuất"}
          </button>
        </div>
      )}
      {!toi.email_da_xac_thuc && (
        // Xác thực email là BẮT BUỘC ở gikky, nên một tài khoản chưa xác thực là một tài
        // khoản sẽ ăn lỗi ở cửa ghi đầu tiên. Nói trước ở đây rẻ hơn nhiều so với để
        // người ta viết xong một mốc rồi mới biết.
        <span className={css.chua_xac_thuc} data-testid="canh-bao-chua-xac-thuc">
          chưa xác thực email
        </span>
      )}
    </div>
  );
}
