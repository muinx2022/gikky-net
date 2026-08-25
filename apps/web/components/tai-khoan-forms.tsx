"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  baoDamCsrf,
  dangKy,
  dangNhap,
  datLaiMatKhau,
  doiMatKhau,
  xacThucEmail,
  xinDatLaiMatKhau,
  LoiTaiKhoan,
} from "@/lib/tai-khoan";
import { taoThongTinDangNhap } from "@/lib/dang-nhap";

import { FormTaiKhoan, LienKet, O } from "./form-tai-khoan";
import { usePhien } from "./phien";
import css from "./form-tai-khoan.module.css";

/** Năm cái form của luồng tài khoản, gom một file.
 *
 * Chúng là **client component**, còn `page.tsx` của từng route là **server component** —
 * tách vậy để mỗi trang giữ được `export const metadata` (tiêu đề riêng + `noindex`).
 * Một trang `"use client"` không export được `metadata`, và cách chữa nhanh (bỏ metadata
 * đi) sẽ đẩy năm trang đăng nhập/đặt lại mật khẩu vào chỉ mục Google.
 */

// --- đăng ký -----------------------------------------------------------------

export function FormDangKy() {
  const { toi } = usePhien();
  return (
    <FormTaiKhoan
      tieuDe="Mở tài khoản gikky"
      moTa="Tên bạn chọn ở đây là địa chỉ hồ sơ công khai — /u/tên-của-bạn. Đăng nhập thì dùng email."
      nutGui="Đăng ký"
      onGui={async (f) => {
        const vao_duoc = await dangKy({
          email: String(f.get("email") ?? ""),
          username: String(f.get("username") ?? ""),
          password: String(f.get("password") ?? ""),
        });
        // Xác thực email là BẮT BUỘC, nên `false` là kết cục BÌNH THƯỜNG của một lần đăng
        // ký thành công — không phải lỗi. Điều hướng vào trong ở ca đó là hứa một thứ
        // chưa có: cửa ghi đầu tiên sẽ từ chối họ.
        if (vao_duoc) return { di: "/" };
        return {
          xong:
            "Xong. Chúng tôi vừa gửi một email xác nhận — mở hộp thư và bấm đường dẫn " +
            "trong đó để kích hoạt tài khoản. Chưa xác nhận thì chưa đăng nhập được.",
        };
      }}
      duoi={
        <>
          Đã có tài khoản? <LienKet href="/dang-nhap">Đăng nhập</LienKet>
        </>
      }
    >
      <O ten="email" nhan="Email" kieu="email" tuDien="email" />
      <O
        ten="username"
        nhan="Tên hiển thị công khai"
        goiY="Không dấu, không khoảng trắng — ví dụ ba_muoi_phien."
        tuDien="username"
      />
      <O
        ten="password"
        nhan="Mật khẩu"
        kieu="password"
        goiY="Ít nhất 8 ký tự, đừng dùng mật khẩu quá phổ biến."
        tuDien="new-password"
      />
      <ChoGoogle bat={toi?.google_bat === true} />
    </FormTaiKhoan>
  );
}

// --- đăng nhập ---------------------------------------------------------------

export function FormDangNhap() {
  const { toi } = usePhien();
  return (
    <FormTaiKhoan
      tieuDe="Đăng nhập"
      nutGui="Vào"
      onGui={async (f) => {
        await dangNhap(
          taoThongTinDangNhap(
            String(f.get("dinh_danh") ?? ""),
            String(f.get("password") ?? ""),
          ),
        );
        return { di: "/" };
      }}
      duoi={
        <>
          <LienKet href="/quen-mat-khau">Quên mật khẩu?</LienKet>
          <br />
          Chưa có tài khoản? <LienKet href="/dang-ky">Đăng ký</LienKet>
        </>
      }
    >
      {/* `kieu="text"`, KHÔNG phải `"email"`: trình duyệt chặn tại chỗ mọi chuỗi không
          có `@`, tức chặn luôn đường đăng nhập bằng username — và nó chặn im lặng, người
          dùng chỉ thấy form không gửi đi. */}
      <O
        ten="dinh_danh"
        nhan="Email hoặc tên đăng nhập"
        kieu="text"
        tuDien="username"
      />
      <O ten="password" nhan="Mật khẩu" kieu="password" tuDien="current-password" />
      <ChoGoogle bat={toi?.google_bat === true} />
    </FormTaiKhoan>
  );
}

// --- quên mật khẩu -----------------------------------------------------------

export function FormQuenMatKhau() {
  return (
    <FormTaiKhoan
      tieuDe="Quên mật khẩu"
      moTa="Nhập email đã đăng ký. Nếu có tài khoản, chúng tôi gửi một đường dẫn đặt lại mật khẩu."
      nutGui="Gửi đường dẫn"
      onGui={async (f) => {
        await xinDatLaiMatKhau(String(f.get("email") ?? ""));
        // Câu chữ cố ý KHÔNG khẳng định email có tồn tại hay không:
        // `ACCOUNT_PREVENT_ENUMERATION = True` ở server giữ cho API không tiết lộ, và một
        // câu "đã gửi tới email của bạn" ở UI sẽ tiết lộ hộ nó.
        return {
          xong:
            "Nếu email này có tài khoản, một đường dẫn đặt lại mật khẩu vừa được gửi tới " +
            "đó. Đường dẫn chỉ dùng được một lần.",
        };
      }}
      duoi={<LienKet href="/dang-nhap">Quay lại đăng nhập</LienKet>}
    >
      <O ten="email" nhan="Email" kieu="email" tuDien="email" />
    </FormTaiKhoan>
  );
}

// --- đặt lại mật khẩu (có key trong URL) -------------------------------------

export function FormDatLaiMatKhau({ khoa }: { khoa: string }) {
  return (
    <FormTaiKhoan
      tieuDe="Đặt mật khẩu mới"
      nutGui="Đặt mật khẩu"
      onGui={async (f) => {
        await datLaiMatKhau(khoa, String(f.get("password") ?? ""));
        return {
          xong: "Đã đổi mật khẩu. Giờ bạn đăng nhập bằng mật khẩu mới được rồi.",
        };
      }}
      duoi={<LienKet href="/dang-nhap">Tới trang đăng nhập</LienKet>}
    >
      <O
        ten="password"
        nhan="Mật khẩu mới"
        kieu="password"
        goiY="Ít nhất 8 ký tự."
        tuDien="new-password"
      />
    </FormTaiKhoan>
  );
}

// --- đổi mật khẩu (đang đăng nhập) -------------------------------------------

export function FormDoiMatKhau() {
  const { toi, dangTai } = usePhien();
  const router = useRouter();

  useEffect(() => {
    if (!dangTai && !(toi?.dang_nhap ?? false)) router.replace("/dang-nhap");
  }, [dangTai, toi, router]);

  return (
    <FormTaiKhoan
      tieuDe="Đổi mật khẩu"
      nutGui="Đổi"
      onGui={async (f) => {
        await doiMatKhau(
          String(f.get("current_password") ?? ""),
          String(f.get("password") ?? ""),
        );
        return { xong: "Đã đổi mật khẩu." };
      }}
    >
      <O
        ten="current_password"
        nhan="Mật khẩu hiện tại"
        kieu="password"
        tuDien="current-password"
      />
      <O
        ten="password"
        nhan="Mật khẩu mới"
        kieu="password"
        goiY="Ít nhất 8 ký tự."
        tuDien="new-password"
      />
    </FormTaiKhoan>
  );
}

// --- xác thực email (có key trong URL) ---------------------------------------

/** Trang người dùng rơi vào khi bấm link trong hộp thư.
 *
 * Không có nút nào: nó tự gọi API rồi báo kết quả. Bắt người vừa bấm một đường dẫn trong
 * email phải bấm thêm một nút "xác nhận" nữa là thêm một bước không mang thông tin gì.
 *
 * `useRef` chặn gọi hai lần: React 18 StrictMode chạy `useEffect` hai lượt ở dev, và
 * lượt thứ hai sẽ thấy khoá đã dùng rồi ⇒ báo lỗi cho một luồng vừa thành công.
 */
export function XacThucEmail({ khoa }: { khoa: string }) {
  const { taiLai } = usePhien();
  const [trangThai, datTrangThai] = useState<"cho" | "xong" | "hong">("cho");
  const [loi, datLoi] = useState<string | null>(null);
  const [dangChay, datDangChay] = useState(false);

  useEffect(() => {
    if (dangChay) return;
    datDangChay(true);
    void (async () => {
      try {
        await xacThucEmail(khoa);
        await taiLai();
        datTrangThai("xong");
      } catch (e) {
        datLoi(
          e instanceof LoiTaiKhoan
            ? e.message
            : "Không gọi được máy chủ. Thử lại sau ít phút.",
        );
        datTrangThai("hong");
      }
    })();
    // Cố ý chỉ phụ thuộc `khoa`: `taiLai` ổn định (useCallback), còn `dangChay` là cái
    // chốt chống chạy hai lần — đưa nó vào deps là mời nó chạy lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [khoa]);

  return (
    // `<div>` chứ không `<main>`: từ 2026-08-24 trang bọc component này bằng
    // `KhungHaiCot`, và khung đó đã render `<main>`. Hai `<main>` lồng nhau là HTML sai và
    // trình đọc màn hình mất mốc điều hướng.
    <div className={css.khung}>
      <section className={css.the}>
        <h1 className={css.tieu_de}>Xác thực email</h1>
        {trangThai === "cho" && (
          <p className={css.mo_ta} data-testid="xac-thuc-cho">
            Đang xác nhận…
          </p>
        )}
        {trangThai === "xong" && (
          <>
            <p className={css.xong} role="status" data-testid="xac-thuc-xong">
              Đã xác nhận email. Tài khoản của bạn dùng được rồi.
            </p>
            <p className={css.duoi}>
              <LienKet href="/dang-nhap">Đăng nhập</LienKet> hoặc{" "}
              <LienKet href="/">về trang chủ</LienKet>.
            </p>
          </>
        )}
        {trangThai === "hong" && (
          <>
            <p className={css.loi} role="alert" data-testid="xac-thuc-hong">
              {loi}
            </p>
            <p className={css.duoi}>
              Đường dẫn xác nhận có hạn dùng. Thử{" "}
              <LienKet href="/dang-nhap">đăng nhập</LienKet> — nếu vẫn chưa được, đăng ký
              lại để nhận email mới.
            </p>
          </>
        )}
      </section>
    </div>
  );
}

// --- Google ------------------------------------------------------------------

/** Nút "Tiếp tục với Google" — **vắng mặt hẳn khi server không có credential**.
 *
 * PLAN mục 4: *"một cái nút vĩnh viễn không bấm được còn tệ hơn không có nút"*. Đây đúng
 * là ca đó: không có `GOOGLE_CLIENT_ID` thì provider không được đăng ký ở Django, và mọi
 * cú bấm sẽ ra lỗi. `me.google_bat` là câu trả lời của SERVER cho câu hỏi ấy — không phải
 * một biến môi trường của Next, vì hai chỗ cấu hình cho cùng một chuyện sẽ lệch nhau.
 * Đây cũng là lý do nó không render `disabled`: `disabled` vẫn là một cái nút.
 *
 * **`<form method="POST">` chứ không phải `<a href>`**, và đó không phải là lựa chọn kiểu
 * dáng: `provider/redirect` của allauth headless nhận **POST** kèm `provider`,
 * `callback_url`, `process`, và nó là view trình duyệt bình thường nên Django kiểm CSRF
 * bằng trường ẩn `csrfmiddlewaretoken`. Một thẻ `<a>` ở đây trả 405.
 *
 * ⚠ **NỢ CÓ TÊN — `GOOGLE-CHUA-DO`.** Máy dev không có credential Google, nên đường này
 * **chưa từng chạy một lần nào**: nó được viết theo tài liệu, không theo quan sát. Cái
 * chắc chắn đúng là *nút không hiện khi tắt* (có bài đo). Cái CHƯA kiểm được là luồng
 * OAuth thật, kể cả redirect URI phải đăng ký với Google
 * (`…/api/_allauth/browser/v1/auth/provider/callback`). Ai bật Google lần đầu phải chạy
 * tay trọn luồng trước khi tin dòng nào ở đây.
 */
function ChoGoogle({ bat }: { bat: boolean }) {
  const [csrf, datCsrf] = useState("");
  useEffect(() => {
    if (bat) void baoDamCsrf().then(datCsrf);
  }, [bat]);

  if (!bat) return null;
  return (
    <form
      method="POST"
      action="/api/_allauth/browser/v1/auth/provider/redirect"
      className={css.duoi}
    >
      <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
      <input type="hidden" name="provider" value="google" />
      <input type="hidden" name="callback_url" value="/" />
      <input type="hidden" name="process" value="login" />
      <button type="submit" className={css.gui} data-testid="nut-google">
        Tiếp tục với Google
      </button>
    </form>
  );
}
