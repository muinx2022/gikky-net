"use client";

import { ImageUp, KeyRound, LogOut, Settings, ShieldCheck, UserRound } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";
import { dangXuat } from "@/lib/tai-khoan";
import { duongDanHoSo } from "@/lib/url";

import { Avatar } from "./avatar";
import { useModalDangNhap } from "./modal-dang-nhap";
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
  const { moModal } = useModalDangNhap();
  const router = useRouter();
  const [mo, datMo] = useState(false);
  const [dangThoat, datDangThoat] = useState(false);

  if (dangTai) {
    return <span className={css.chua_biet} aria-hidden data-testid="tai-khoan-dang-tai" />;
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
      >
        <Avatar ten={toi.username ?? ""} hienThi={toi.display_name} url={toi.avatar_url} co={24} />
        <span {...CHU_NGUOI_DUNG}>u/{toi.username}</span>
      </button>
      {mo && (
        <div className={css.menu} role="menu" data-testid="menu-tai-khoan">
          <Link href={duongDanHoSo(toi.username ?? "")} role="menuitem" onClick={() => datMo(false)}>
            <UserRound size={15} strokeWidth={2} aria-hidden />
            Hồ sơ của tôi
          </Link>
          {/* Lối vào SỬA hồ sơ (ảnh đại diện + giới thiệu) — **trang riêng**, user chốt
              2026-08-24. Trước đó nó trỏ `/cai-dat#ho-so`: hai mục menu khác tên mà ra
              đúng một trang mang tiêu đề "Cài đặt" là một cái menu nói dối, và cái neo
              chỉ cuộn chứ không đổi được tiêu đề ấy. "Hồ sơ của tôi" ngay trên chỉ để
              XEM. */}
          <Link href="/sua-ho-so" role="menuitem" onClick={() => datMo(false)}>
            <ImageUp size={15} strokeWidth={2} aria-hidden />
            Sửa hồ sơ
          </Link>
          <Link href="/cai-dat" role="menuitem" onClick={() => datMo(false)}>
            <Settings size={15} strokeWidth={2} aria-hidden />
            Cài đặt
          </Link>
          {/* "Khu mod" — chỉ hiện với staff. `ModSub` chưa cho thêm quyền gì (xem
              `core/models/dien_dan.py::ModSub`), nên với người KHÔNG staff cái mục này
              dẫn tới một trang không có công cụ nào — đúng thứ PLAN mục 4 cấm bày ra.
              Ngày quyền theo-sub được nối, điều kiện ở đây phải đổi theo, và trang
              `/khu-mod` đã tự nói ra giới hạn ấy cho ai lỡ tới. */}
          {toi.la_staff === true && (
            <Link href="/khu-mod" role="menuitem" onClick={() => datMo(false)}>
              <ShieldCheck size={15} strokeWidth={2} aria-hidden />
              Khu mod
            </Link>
          )}
          <Link href="/doi-mat-khau" role="menuitem" onClick={() => datMo(false)}>
            <KeyRound size={15} strokeWidth={2} aria-hidden />
            Đổi mật khẩu
          </Link>
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
