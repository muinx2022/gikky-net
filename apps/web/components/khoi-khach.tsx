"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Mail, UserPlus } from "lucide-react";

import { useModalDangNhap } from "@/components/modal-dang-nhap";
import { useDaHydrate, usePhien } from "@/components/phien";
import { baoDamCsrf, googleTatLucTai } from "@/lib/tai-khoan";
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
 * Người đã đăng nhập không thấy khối này — họ có "Hồ sơ của tôi" + "Cài đặt" ở menu tài khoản
 * trên header.
 *
 * ## Vẽ SẴN trong HTML server, ẩn bằng cờ `html[data-da-dang-nhap="1"]` *(việc 14, đợt E)*
 *
 * Phiên hỏi ở trình duyệt (`usePhien`), nên server không biết ai là khách. Bản cũ trả `null`
 * trong lúc chưa biết ⇒ HTML không có khối ⇒ với KHÁCH (người cần khối này nhất) khối hiện ra
 * SAU hydrate và đẩy cả rail xuống ~200px — đúng cú giật plan §2.3-9 đo được.
 *
 * Nay ở HTML server (và lần render hydrate, phải giống hệt nó) khối vẽ ở trạng thái KHÁCH với
 * class `chua_biet`, và CSS ẩn class ấy khi `<html>` mang cờ `data-da-dang-nhap="1"` — cờ do
 * script inline trong `<head>` đặt từ `localStorage` trước lần vẽ đầu (`lib/tai-khoan.ts::
 * nguonScriptPhien`; header đã dùng cùng cờ). Khách: khối có từ lần vẽ đầu, không nhảy. Thành
 * viên: khối không lúc nào hiện.
 *
 * Sau hydrate không dựa vào CSS nữa: hễ có phiên lưu (`fallbackData` có giá trị — thành viên VÀ
 * khách quay lại; chỉ lượt đầu với `localStorage` rỗng là không) lượt hydrate hiện lệch (lỗi React
 * #418), React render lại cả root và xoá thuộc tính `<html>` — đã đo (MutationObserver + `pageerror`
 * #418), sổ P-20261111-21. Nên `useDaHydrate` lật ngay (trước lần vẽ kế) sang quyết định bằng JS trên CÙNG nguồn: `toi` lúc
 * ấy là phiên đã lưu (`fallbackData`) trong khi `GET /me` còn bay, rồi là phiên thật. Đăng nhập ⇒
 * `null`; khách hoặc chưa có phiên lưu ⇒ khối (như CSS đã vẽ). Phiên lưu lệch (hết hạn ở tab
 * khác) thì `/me` sửa. Cái giá đã chấp nhận (plan §4.7): thành viên trên máy MỚI (chưa có
 * `localStorage`) thấy khối một lần rồi mất. Nhánh JS này là gương chống giật TRONG KHI #418 còn;
 * sửa #418 thì xem lại để gỡ.
 *
 * ## Ô của nút Google — giữ chỗ
 *
 * Nút Google chỉ hiện khi `me.google_bat` (PLAN mục 4: không nút vĩnh viễn không bấm được), mà
 * điều đó chỉ biết sau `GET /me`. Để khối không cao thêm 48px khi nút hiện ra, ô của nó được GIỮ
 * CHỖ (`cho_google`, cùng chiều cao nút) trong lúc chưa biết, và vẫn giữ nếu `/me` nói "tắt" —
 * co lại lúc ấy cũng là một cú giật. Lần tải sau trình duyệt đã biết: script `<head>` đặt
 * `html[data-google-tat="1"]` từ phiên đã lưu và CSS bỏ hẳn ô trống trước lần vẽ đầu; sau
 * hydrate (cờ có thể đã mất do lượt hydrate lệch #418, xem trên) `googleTatLucTai` nói lại đúng
 * điều ấy bằng JS. Khối được GẮN MỚI khi phiên đã biết (điều hướng client sang trang khác sau khi
 * `/me` đã trả "tắt") thì không giữ ô — không còn gì để chờ, và ô trống ở đó chỉ là chỗ thừa
 * kéo dài suốt phiên SPA. Giữ chỗ mặc định (chứ không mặc định "tắt") vì khách lần đầu là người khối này nhắm tới, và ở môi
 * trường bật Google chính họ là người sẽ thấy cú giật nếu đoán ngược.
 */
export function KhoiKhach({
  tieuDe = "Tham gia Gikky.net",
}: {
  /** Tiêu đề khối. Trang chủ truyền "Bắt đầu nhật ký của bạn" (plan giao diện mới §3.4); mọi
   * trang khác giữ mặc định. */
  tieuDe?: string;
} = {}) {
  const { toi, dangTai } = usePhien();
  const { moModal } = useModalDangNhap();
  const [csrf, datCsrf] = useState("");
  const daHydrate = useDaHydrate();
  // Chụp MỘT lần lúc gắn: phiên đã biết và Google tắt ⇒ khối này không cần giữ ô (xem docstring).
  // Chụp chứ không đọc mỗi lần render: `/me` trả "tắt" GIỮA CHỪNG thì ô phải ở lại (co là giật).
  const [googleTatLucGan] = useState(() => !dangTai && toi?.google_bat === false);

  // `toi` sau hydrate là phiên ĐÃ LƯU (`fallbackData`) trong lúc `GET /me` còn bay, rồi phiên
  // thật. Không chờ `dangTai`: hễ có phiên lưu cờ CSS mất ngay lúc hydrate (lượt hydrate lệch #418 ⇒
  // React render lại root — đã đo, sổ P-20261111-21), nên với thành viên "chưa biết" sau hydrate mà
  // vẫn vẽ khối là lời mời đăng ký hiện ra với thành viên suốt thời gian `/me` bay (đo được
  // ~160ms). Không có phiên lưu ⇒ coi là khách — đúng như CSS đã vẽ trước hydrate.
  const chuaBiet = !daHydrate;
  const googleTat = daHydrate && (googleTatLucTai() || googleTatLucGan);
  const dangNhap = toi?.dang_nhap === true;
  const googleBat = daHydrate && toi?.google_bat === true;

  useEffect(() => {
    if (googleBat) {
      void baoDamCsrf().then(datCsrf);
    }
  }, [googleBat]);

  if (daHydrate && dangNhap) return null;

  return (
    <section
      className={chuaBiet ? `${css.khoi} ${css.chua_biet}` : css.khoi}
      data-testid="khoi-khach"
    >
      <h2 className={css.tieu_de}>{tieuDe}</h2>
      <div className={css.danh_sach_nut}>
        {googleBat ? (
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
        ) : (
          !googleTat && (
            <div className={css.cho_google} aria-hidden="true" data-testid="khoi-khach-cho-google" />
          )
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
