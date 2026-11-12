"use client";

import { ImageUp, KeyRound, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { dangXuat, docRongTaiKhoan, luuRongTaiKhoan } from "@/lib/tai-khoan";
import { tenHienThi } from "@/lib/ten-hien-thi";
import { duongDanHoSo } from "@/lib/url";

import { Avatar } from "./avatar";
import { useModalDangNhap } from "./modal-dang-nhap";
import { useDaHydrate, usePhien } from "./phien";
import css from "./thanh-tai-khoan.module.css";

/** Góc phải thanh trên cùng: ai đang đăng nhập, và lối ra.
 *
 * **Trong lúc chưa biết mình là ai** (`dangTai`, hoặc chưa hydrate — `useDaHydrate`) KHÔNG được
 * chớp "Đăng nhập" vào mặt một người **đang** đăng nhập, và cũng không được nhảy bố cục ngay
 * chỗ mắt người ta nhìn đầu tiên. Bản cũ vẽ một ô trống 116px cho MỌI người, rồi đổi sang cụm
 * khách 184px ⇒ khách (đa số lượt tải) thấy cả cụm phải trượt sang trái 68px. Nay *(việc 14,
 * đợt E)* vẽ SẴN cả hai: cụm khách thật (testid riêng) và ô giữ chỗ của thành viên; CSS chọn một
 * theo cờ `html[data-da-dang-nhap="1"]` mà script `<head>` đặt từ `localStorage` trước lần vẽ
 * đầu (`lib/tai-khoan.ts::nguonScriptPhien`). Khách: cụm có sẵn từ lần vẽ đầu, không trượt.
 * Thành viên: ô giữ chỗ rộng đúng bằng cụm của họ ở lần trước (`luuRongTaiKhoan` — tên dài ngắn
 * khác nhau, một con số cố định thì luôn trượt), nên cụm thật thế chỗ mà không đẩy ai.
 *
 * **Không có nút Google ở đây** — nó thuộc trang đăng nhập, và nó chỉ hiện khi
 * `me.google_bat` (PLAN mục 4: không nút vĩnh viễn không bấm được).
 */
export function ThanhTaiKhoan() {
  const { toi, dangTai, taiLai } = usePhien();
  const daHydrate = useDaHydrate();
  const { moModal } = useModalDangNhap();
  const router = useRouter();
  const hopRef = useRef<HTMLDivElement | null>(null);
  const [mo, datMo] = useState(false);
  const [dangThoat, datDangThoat] = useState(false);

  // Bấm ra ngoài hoặc phím Escape thì đóng menu tài khoản
  useEffect(() => {
    if (!mo) return;
    const ngoai = (e: MouseEvent) => {
      if (hopRef.current !== null && !hopRef.current.contains(e.target as Node)) {
        datMo(false);
      }
    };
    const phim = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        datMo(false);
      }
    };
    document.addEventListener("mousedown", ngoai);
    document.addEventListener("keydown", phim);
    return () => {
      document.removeEventListener("mousedown", ngoai);
      document.removeEventListener("keydown", phim);
    };
  }, [mo]);

  // Nhớ bề ngang cụm đã đăng nhập để lần tải sau ô giữ chỗ (trước hydrate) rộng ĐÚNG bằng nó —
  // script `<head>` đọc lại (`nguonScriptPhien`). Chạy mỗi lần render, chỉ ghi khi đổi.
  // KHÔNG ghi khi đang thoát: `dangXuat` → `xoaCachePhien` đã xoá khoá, mà lần vẽ "Đang thoát…"
  // ngay sau (cụm vẫn còn) sẽ ghi nó lại cho người kế trên cùng máy.
  useLayoutEffect(() => {
    if (dangThoat || toi?.dang_nhap !== true || hopRef.current === null) return;
    luuRongTaiKhoan(hopRef.current.getBoundingClientRect().width);
  });

  // Chưa biết phiên (HTML server, lần render hydrate, `GET /me` còn bay): vẽ SẴN cụm khách và ô giữ
  // chỗ của thành viên, CSS chọn một theo cờ `html[data-da-dang-nhap]` (việc 14, đợt E — xem
  // docstring). Sau hydrate cờ ấy mất hễ có phiên lưu (lượt hydrate lệch #418 ⇒ React render lại root —
  // đã đo, sổ P-20261111-21; sửa #418 thì xem lại để gỡ), nên phiên ĐÃ LƯU (`fallbackData`) chọn thay nó:
  // thành viên ⇒ chỉ ô giữ chỗ, rộng bằng số đo lần trước (không thì chớp "Đăng nhập" vào mặt
  // họ). Cụm thật chỉ vẽ khi `/me` đã trả lời — bài đo chờ `thanh-tai-khoan-khach` /
  // `nut-tai-khoan` làm tín hiệu "đã biết phiên", nên testid ở đây khác.
  if (daHydrate && dangTai && toi?.dang_nhap === true) {
    return (
      <span
        className={css.cho_thanh_vien}
        style={{ width: docRongTaiKhoan() ?? 130 }}
        aria-hidden
        data-testid="tai-khoan-dang-tai"
      />
    );
  }
  if (!daHydrate || dangTai) {
    return (
      <>
        <div className={`${css.khach} ${css.khach_chua_biet}`} data-testid="thanh-tai-khoan-chua-biet">
          <button type="button" className={css.lien_ket} onClick={moModal}>
            Đăng nhập
          </button>
          <Link href="/dang-ky" prefetch={false} className={css.nut_chinh}>
            Đăng ký
          </Link>
        </div>
        <span className={css.chua_biet} aria-hidden data-testid="tai-khoan-dang-tai" />
      </>
    );
  }

  if (toi === null || !toi.dang_nhap) {
    return (
      <div className={css.khach} data-testid="thanh-tai-khoan-khach">
        {/* `<button>` chứ không `<Link>` từ 2026-08-26 (user): đăng nhập nay là một
            MODAL, không phải một trang. Một `<Link>` mở modal là nói dối cả trình duyệt
            lẫn người dùng — chuột phải "mở tab mới" sẽ ra một trang, giữ Ctrl cũng vậy,
            và không cái nào là thứ vừa được bấm. `/dang-nhap` vẫn còn (ba trang cần đăng
            nhập `router.replace` vào đó), chỉ không còn ai LINK tới nó từ nội dung. */}
        <button
          type="button"
          className={css.lien_ket}
          onClick={moModal}
          data-testid="thanh-tai-khoan-mo-dang-nhap"
        >
          Đăng nhập
        </button>
        <Link href="/dang-ky" prefetch={false} className={css.nut_chinh}>
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
    <div className={css.khung} ref={hopRef} data-testid="thanh-tai-khoan">
      <button
        type="button"
        className={css.ten}
        aria-expanded={mo}
        aria-haspopup="menu"
        onClick={() => datMo((x) => !x)}
        data-testid="nut-tai-khoan"
      >
        <Avatar ten={toi.username ?? ""} hienThi={toi.display_name} url={toi.avatar_url} co={24} />
        {/* Class riêng vì ≤640px chữ này bị ẩn THỊ GIÁC — xem `.ten_chu` trong file CSS
            cạnh đây. Nó vẫn ở lại DOM, nên `{...CHU_NGUOI_DUNG}` giữ nguyên. */}
        <span
          className={css.ten_chu}
          title={toi.username ? `u/${toi.username}` : undefined}
          {...CHU_NGUOI_DUNG}
        >
          {tenHienThi(toi)}
        </span>
      </button>
      {mo && (
        <div className={css.menu} role="menu" data-testid="menu-tai-khoan">
          <div className={css.menu_header}>
            <Avatar ten={toi.username ?? ""} hienThi={toi.display_name} url={toi.avatar_url} co={32} />
            <div className={css.menu_user_info}>
              <span className={css.menu_display_name}>{tenHienThi(toi)}</span>
              {toi.display_name && <span className={css.menu_username}>u/{toi.username}</span>}
            </div>
          </div>
          <hr className={css.menu_divider} />


          <Link href={duongDanHoSo(toi.username ?? "")} prefetch={false} role="menuitem" onClick={() => datMo(false)}>
            <UserRound size={15} strokeWidth={2} aria-hidden />
            Hồ sơ của tôi
          </Link>
          {/* Lối vào SỬA hồ sơ (ảnh đại diện + giới thiệu) — **trang riêng**, user chốt
              2026-08-24. Trước đó nó trỏ `/cai-dat#ho-so`: hai mục menu khác tên mà ra
              đúng một trang mang tiêu đề "Cài đặt" là một cái menu nói dối, và cái neo
              chỉ cuộn chứ không đổi được tiêu đề ấy. "Hồ sơ của tôi" ngay trên chỉ để
              XEM. */}
          <Link href="/sua-ho-so" prefetch={false} role="menuitem" onClick={() => datMo(false)}>
            <ImageUp size={15} strokeWidth={2} aria-hidden />
            Sửa hồ sơ
          </Link>
          <Link href="/cai-dat" prefetch={false} role="menuitem" onClick={() => datMo(false)}>
            <Settings size={15} strokeWidth={2} aria-hidden />
            Cài đặt
          </Link>
          {/* "Khu mod" — chỉ hiện với staff. `ModSub` chưa cho thêm quyền gì (xem
              `core/models/dien_dan.py::ModSub`), nên với người KHÔNG staff cái mục này
              dẫn tới một trang không có công cụ nào — đúng thứ PLAN mục 4 cấm bày ra.
              Ngày quyền theo-sub được nối, điều kiện ở đây phải đổi theo, và trang
              `/khu-mod` đã tự nói ra giới hạn ấy cho ai lỡ tới. */}
          {toi.la_staff === true && (
            <Link href="/khu-mod" prefetch={false} role="menuitem" onClick={() => datMo(false)}>
              <ShieldCheck size={15} strokeWidth={2} aria-hidden />
              Khu mod
            </Link>
          )}
          <Link href="/doi-mat-khau" prefetch={false} role="menuitem" onClick={() => datMo(false)}>
            <KeyRound size={15} strokeWidth={2} aria-hidden />
            Đổi mật khẩu
          </Link>
          <hr className={css.menu_divider} />
          <button
            type="button"
            role="menuitem"
            onClick={() => void thoat()}
            disabled={dangThoat}
            data-testid="nut-dang-xuat"
          >
            <LogOut size={15} strokeWidth={2} aria-hidden />
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
