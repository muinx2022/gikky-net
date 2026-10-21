"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  BookOpen,
  Flame,
  Home,
  Mail,
  Plus,
  Radio,
  Settings,
  UserPlus,
  UserRound,
} from "lucide-react";
import type { SubChiTietOut } from "@gikky/api-client";

import { useModalDangNhap } from "@/components/modal-dang-nhap";
import { usePhien } from "@/components/phien";
import { baoDamCsrf } from "@/lib/tai-khoan";
import { duongDanHoSo, duongDanSub } from "@/lib/url";
import css from "./cot-trai.module.css";

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

export function CotTrai({
  cacSub,
}: {
  cacSub?: readonly SubChiTietOut[];
}) {
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

  return (
    <aside className={css.cot_trai} aria-label="Cột điều hướng">
      {laKhach && (
        <div className={css.khoi_tham_gia} data-testid="cot-trai-khach">
          <h2 className={css.tieu_de_tham_gia}>
            Tham gia không gian chân thực nhất trên internet
          </h2>
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
                <button
                  type="submit"
                  className={css.nut_pill}
                  data-testid="cot-trai-nut-google"
                >
                  <LogoGoogle />
                  <span>Tiếp tục với dịch vụ bằng Google</span>
                </button>
              </form>
            )}
            <button
              type="button"
              onClick={moModal}
              className={css.nut_pill}
              data-testid="cot-trai-nut-email"
            >
              <Mail size={16} aria-hidden="true" />
              <span>Tiếp tục với email</span>
            </button>
            <Link
              href="/dang-ky"
              prefetch={false}
              className={css.nut_pill}
              data-testid="cot-trai-nut-dang-ky"
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
        </div>
      )}

      {/* Nhóm điều hướng chính */}
      <nav className={css.nhom} aria-label="Điều hướng chính">
        <Link href="/" prefetch={false} className={css.muc_nav}>
          <Home size={18} aria-hidden="true" />
          <span>Trang chủ</span>
        </Link>
        <Link href="/?tab=dang-dien-ra" prefetch={false} className={css.muc_nav}>
          <Radio size={18} aria-hidden="true" />
          <span>Đang diễn ra</span>
        </Link>
        <Link href="/?tab=nhieu-diem" prefetch={false} className={css.muc_nav}>
          <Flame size={18} aria-hidden="true" />
          <span>Nhiều điểm nhất</span>
        </Link>
        {dangNhap && (
          <Link href="/dang-mach" prefetch={false} className={css.muc_nav}>
            <Plus size={18} aria-hidden="true" />
            <span>Tạo mạch mới</span>
          </Link>
        )}
      </nav>

      {/* Nhóm chuyên mục */}
      {cacSub && cacSub.length > 0 && (
        <>
          <hr className={css.vach} />
          <div className={css.nhom}>
            <p className={css.tieu_de_nhom}>CHUYÊN MỤC</p>
            {cacSub.map((s) => (
              <Link
                key={s.id}
                href={duongDanSub(s.slug)}
                prefetch={false}
                className={css.muc_nav}
                title={s.ten}
              >
                <span className={css.icon_sub} aria-hidden="true">
                  {s.slug.slice(0, 1)}
                </span>
                <span>s/{s.slug}</span>
              </Link>
            ))}
          </div>
        </>
      )}

      {/* Nhóm tài nguyên */}
      <hr className={css.vach} />
      <div className={css.nhom}>
        <p className={css.tieu_de_nhom}>TÀI NGUYÊN</p>
        <Link href="/luat" prefetch={false} className={css.muc_nav}>
          <BookOpen size={18} aria-hidden="true" />
          <span>Luật cộng đồng</span>
        </Link>
        {dangNhap && (
          <>
            <Link
              href={duongDanHoSo(toi.username ?? "")}
              prefetch={false}
              className={css.muc_nav}
            >
              <UserRound size={18} aria-hidden="true" />
              <span>Hồ sơ của tôi</span>
            </Link>
            <Link href="/cai-dat" prefetch={false} className={css.muc_nav}>
              <Settings size={18} aria-hidden="true" />
              <span>Cài đặt</span>
            </Link>
          </>
        )}
      </div>
    </aside>
  );
}
