"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeftRight,
  BookOpen,
  Brain,
  CircleHelp,
  Coins,
  Compass,
  Landmark,
  Mail,
  Newspaper,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserPlus,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { SubChiTietOut } from "@gikky/api-client";

import { useModalDangNhap } from "@/components/modal-dang-nhap";
import { usePhien } from "@/components/phien";
import { docCacSubOTrinhDuyet } from "@/lib/api";
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

function layPhongCachSub(slug: string): {
  Icon: LucideIcon;
  nen: string;
  chu: string;
} {
  if (slug.startsWith("tin-tuc")) {
    return { Icon: Newspaper, nen: "rgba(37, 99, 235, 0.12)", chu: "#2563eb" };
  }
  if (slug.startsWith("chung-")) {
    return { Icon: TrendingUp, nen: "rgba(5, 150, 105, 0.12)", chu: "#059669" };
  }
  if (slug.startsWith("vi-mo")) {
    return { Icon: Landmark, nen: "rgba(79, 70, 229, 0.12)", chu: "#4f46e5" };
  }
  if (slug.startsWith("quan-tri")) {
    return { Icon: ShieldCheck, nen: "rgba(217, 119, 6, 0.12)", chu: "#d97706" };
  }
  if (slug.startsWith("tam-ly")) {
    return { Icon: Brain, nen: "rgba(225, 29, 72, 0.12)", chu: "#e11d48" };
  }
  if (slug.startsWith("ngoai-hoi")) {
    return { Icon: ArrowLeftRight, nen: "rgba(8, 145, 178, 0.12)", chu: "#0891b2" };
  }
  if (slug.startsWith("cryp")) {
    return { Icon: Coins, nen: "rgba(234, 88, 12, 0.14)", chu: "#ea580c" };
  }
  if (slug.startsWith("hoi-dap")) {
    return { Icon: CircleHelp, nen: "rgba(147, 51, 234, 0.12)", chu: "#9333ea" };
  }
  return { Icon: Compass, nen: "var(--accent-soft)", chu: "var(--accent)" };
}

export function CotTrai({
  cacSub,
}: {
  cacSub?: readonly SubChiTietOut[];
}) {
  const { toi, dangTai } = usePhien();
  const { moModal } = useModalDangNhap();
  const [csrf, datCsrf] = useState("");
  const [subTuTrinhDuyet, datSubTuTrinhDuyet] = useState<readonly SubChiTietOut[]>([]);

  const dangNhap = toi?.dang_nhap === true;
  const laKhach = !dangTai && !dangNhap;

  useEffect(() => {
    if (cacSub && cacSub.length > 0) return;
    let vanCon = true;
    docCacSubOTrinhDuyet()
      .then((ds) => {
        if (vanCon && ds && ds.length > 0) {
          datSubTuTrinhDuyet(ds);
        }
      })
      .catch(() => {});
    return () => {
      vanCon = false;
    };
  }, [cacSub]);

  useEffect(() => {
    if (toi?.google_bat === true) {
      void baoDamCsrf().then(datCsrf);
    }
  }, [toi?.google_bat]);

  const danhSachSub = cacSub && cacSub.length > 0 ? cacSub : subTuTrinhDuyet;

  return (
    <aside className={css.cot_trai} aria-label="Cột điều hướng">
      {laKhach && (
        <div className={css.khoi_tham_gia} data-testid="cot-trai-khach">
          <h2 className={css.tieu_de_tham_gia}>
            Tham gia Gikky.net
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
                  <span>Tiếp tục với Google</span>
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

      <div className={css.danh_sach_cuon}>
        {/* Nhóm chuyên mục */}
        {danhSachSub.length > 0 && (
          <>
            {laKhach && <hr className={css.vach} />}
            <div className={css.nhom}>
              <p className={css.tieu_de_nhom}>CHUYÊN MỤC</p>
              {danhSachSub.map((s) => {
                const { Icon, nen, chu } = layPhongCachSub(s.slug);
                return (
                  <Link
                    key={s.slug}
                    href={duongDanSub(s.slug)}
                    prefetch={false}
                    className={css.muc_sub}
                    title={`${s.ten} (s/${s.slug})`}
                  >
                    <span
                      className={css.icon_sub}
                      style={{ background: nen, color: chu }}
                      aria-hidden="true"
                    >
                      <Icon size={17} strokeWidth={2} />
                    </span>
                    <span className={css.chu_sub}>
                      <span className={css.ten_sub}>{s.ten}</span>
                      <span className={css.slug_sub}>s/{s.slug}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </>
        )}

        {/* Nhóm tài nguyên */}
        {(laKhach || danhSachSub.length > 0) && <hr className={css.vach} />}
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
      </div>
    </aside>
  );
}
