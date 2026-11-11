"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, UserPlus } from "lucide-react";

import { useModalDangNhap } from "@/components/modal-dang-nhap";
import { usePhien } from "@/components/phien";
import { baoDamCsrf } from "@/lib/tai-khoan";
import css from "./khoi-khach.module.css";

function LogoGoogle() {
  return (
    <svg
      viewBox="0 0 18 18"
      width="16"
      height="16"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.02-3.7H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.98 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.02-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.46 3.44 1.35l2.58-2.58C13.46.9 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.02 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

/** Khối "Tham gia Gikky.net" cho KHÁCH — đầu rail phải của mọi trang có khung.
 *
 * *(hai cột toàn site, 2026-11-10)* Trước đó nó nằm ở đầu cột trái; cột trái bỏ
 * hẳn nên khối này dời sang rail phải, nút và hành vi giữ nguyên: Google (chỉ khi
 * `me.google_bat`), "Tiếp tục với email" mở modal đăng nhập, "Tạo tài khoản mới" → `/dang-ky`.
 *
 * **Client component, và trong lúc chưa biết mình là ai thì không vẽ gì**: phiên đăng nhập
 * hỏi ở trình duyệt (`usePhien` — xem docstring ở đó), HTML server-render không biết ai là
 * khách. Vẽ khối rồi giấu nó đi với người đã đăng nhập là chớp một lời mời đăng ký vào mặt
 * thành viên; nên `dangTai` và `dangNhap` đều trả `null`. Người đã đăng nhập không thấy khối
 * này — họ có "Hồ sơ của tôi" + "Cài đặt" ở menu tài khoản trên header.
 */
export function KhoiKhach({
  tieuDe = "Tham gia Gikky.net",
  moTa,
}: {
  /** Tiêu đề khối. Trang chủ truyền "Bắt đầu nhật ký của bạn" (plan giao diện mới §3.4); mọi
   * trang khác giữ mặc định. */
  tieuDe?: string;
  /** Một dòng phụ dưới tiêu đề (vắng ⇒ không vẽ). */
  moTa?: string;
} = {}) {
  const { toi, dangTai } = usePhien();
  const { moModal } = useModalDangNhap();
  const [csrf, datCsrf] = useState("");

  const dangNhap = toi?.dang_nhap === true;
  const laKhach = !dangTai && !dangNhap;

  useEffect(() => {
    if (toi?.google_bat === true) {
      void baoDamCsrf().then(datCsrf);
    }
  }, [toi?.google_bat]);

  if (!laKhach) return null;

  return (
    <section className={css.khoi} data-testid="khoi-khach">
      <h2 className={css.tieu_de}>{tieuDe}</h2>
      {moTa !== undefined && <p className={css.mo_ta}>{moTa}</p>}
      <div className={css.danh_sach_nut}>
        {toi?.google_bat === true && (
          <form
            method="POST"
            action="/api/_allauth/browser/v1/auth/provider/redirect"
            className={css.form_google}
          >
            <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
            <input type="hidden" name="provider" value="google" />
            <input type="hidden" name="callback_url" value="/" />
            <input type="hidden" name="process" value="login" />
            <button type="submit" className={css.nut_pill} data-testid="khoi-khach-nut-google">
              <LogoGoogle />
              <span>Tiếp tục với Google</span>
            </button>
          </form>
        )}
        <button
          type="button"
          onClick={moModal}
          className={css.nut_pill}
          data-testid="khoi-khach-nut-email"
        >
          <Mail size={16} aria-hidden="true" />
          <span>Tiếp tục với email</span>
        </button>
        <Link
          href="/dang-ky"
          prefetch={false}
          className={css.nut_pill}
          data-testid="khoi-khach-nut-dang-ky"
        >
          <UserPlus size={16} aria-hidden="true" />
          <span>Tạo tài khoản mới</span>
        </Link>
      </div>
      <p className={css.chu_nho}>
        Bằng việc tiếp tục, bạn đồng ý với{" "}
        <Link href="/luat" prefetch={false}>
          Luật cộng đồng
        </Link>{" "}
        của chúng tôi.
      </p>
    </section>
  );
}
