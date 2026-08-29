"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import {
  baoDamCsrf,
  dangKy,
  dangNhap,
  dangXuat,
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

/** Thay chỗ form khi người mở trang **đã đăng nhập rồi** — user báo 2026-08-25.
 *
 * ## Lỗi nó vá, và vì sao nó không hiếm như tưởng
 *
 * `/dang-nhap` và `/dang-ky` trước đây vẽ form cho **mọi** người, kể cả người đang có
 * phiên. Người dùng điền vào, bấm Vào, và allauth trả **409** ("đã đăng nhập rồi") — đo
 * được. Form báo lỗi, `taiLai()` không chạy vì `onGui` đã ném, nên header đứng nguyên và
 * người ta phải F5 mới thấy sự thật.
 *
 * Ca này gặp thường xuyên hơn vẻ ngoài của nó, vì **khu quản trị (3001) và front (3000)
 * dùng CHUNG một phiên Django**: cùng một cookie trên `localhost`, và trên prod cũng vậy
 * nếu `SESSION_COOKIE_DOMAIN=.gikky.net` (xem `api/.env.example`). Đăng nhập ở admin xong
 * mở front là đã đăng nhập sẵn — người dùng không làm gì sai cả, họ chỉ không nhìn lên
 * góc phải.
 *
 * ## Vì sao KHÔNG tự chuyển hướng về `/`
 *
 * Người mở `/dang-nhap` khi đang có phiên thường muốn **đổi tài khoản** — đúng ca user
 * gặp: đang là `u/admin`, định vào bằng một tài khoản khác. Đá họ về trang chủ là nuốt
 * mất ý định ấy và không nói gì. Nên: nói rõ đang là ai, rồi đưa đúng hai lối đi.
 *
 * ## Nhấp nháy: chấp nhận, có chủ đích
 *
 * Trong nhịp `GET /me` chưa về (`dangTai`) ta vẫn vẽ form. Người mở trang đăng nhập gần
 * như luôn là khách, nên giấu form của mọi người để chờ một lượt gọi mạng là bắt số đông
 * trả giá cho thiểu số. Cái nháy chỉ xảy ra với người đã đăng nhập, và nó kết thúc ở
 * trạng thái ĐÚNG.
 */
const GIAY_CHO_VE_TRANG_CHU = 3;

function DaDangNhap({ username }: { username: string }) {
  const { taiLai } = usePhien();
  const router = useRouter();
  const [dangThoat, datDangThoat] = useState(false);
  const [conLai, datConLai] = useState(GIAY_CHO_VE_TRANG_CHU);
  /** Bấm "Đăng xuất" là **huỷ** đồng hồ. Thiếu cờ này thì người bấm ở giây thứ 2 vừa bị
   * đăng xuất vừa bị ném về trang chủ — mất đúng cái họ vừa chọn, và mất im lặng. */
  const [huy, datHuy] = useState(false);

  useEffect(() => {
    if (huy) return;
    if (conLai <= 0) {
      // `replace` chứ không `push`: trang này chỉ tồn tại để nói "bạn đã đăng nhập rồi".
      // Để nó lại trong history nghĩa là bấm Back sẽ quay về đây rồi lại bị đẩy đi —
      // một vòng lặp người dùng không thoát được bằng nút Back.
      router.replace("/");
      return;
    }
    const hen = setTimeout(() => datConLai((n) => n - 1), 1000);
    return () => clearTimeout(hen);
  }, [conLai, huy, router]);

  const thoat = async () => {
    datHuy(true);
    datDangThoat(true);
    try {
      await dangXuat();
      await taiLai();
    } finally {
      datDangThoat(false);
    }
  };

  return (
    <div className={css.khung}>
      <div className={css.the} data-testid="da-dang-nhap">
        <h1 className={css.tieu_de}>Bạn đang đăng nhập</h1>
        {/* Chỉ nói phiên hiện tại là AI. Bản đầu còn một câu giải thích khu quản trị và
            trang công khai dùng chung phiên — **bỏ** (user chốt 2026-08-25): đó là chi
            tiết kiến trúc, người dùng không cần biết và cũng không làm gì được với nó. */}
        <p className={css.mo_ta}>
          Phiên hiện tại là <span className="mono">u/{username}</span>.
        </p>
        <Link className={css.gui} href="/" data-testid="da-dang-nhap-ve-trang-chu">
          Về trang chủ
        </Link>
        {/* Đếm ngược HIỆN RA, không chuyển lén. Một trang tự nhảy đi sau 3 giây mà không
            báo trước là giật mình; và người muốn đổi tài khoản cần thấy rằng họ còn kịp
            bấm "Đăng xuất". `role="status"` để trình đọc màn hình cũng biết. */}
        {!huy && (
          <p className={css.duoi} role="status" data-testid="da-dang-nhap-dem-nguoc">
            Tự về trang chủ sau {conLai} giây.
          </p>
        )}
        <p className={css.duoi}>
          Muốn vào bằng tài khoản khác?{" "}
          <button
            type="button"
            className={css.lien_ket_nut}
            onClick={() => void thoat()}
            disabled={dangThoat}
            data-testid="da-dang-nhap-thoat"
          >
            {dangThoat ? "Đang thoát…" : "Đăng xuất"}
          </button>
        </p>
      </div>
    </div>
  );
}

// --- đăng ký -----------------------------------------------------------------

export function FormDangKy() {
  const { toi } = usePhien();
  // Cùng bẫy với `/dang-nhap`: mở trang đăng ký khi đang có phiên thì allauth trả 409.
  if (toi?.dang_nhap === true) return <DaDangNhap username={toi.username ?? ""} />;
  return (
    <FormTaiKhoan
      tieuDe="Mở tài khoản gikky"
      // Câu cũ ghi "Đăng nhập thì dùng email." — **sai sự thật**, và user bắt đúng
      // (2026-08-27: *"nhập tên có dấu cách thì không được, nhưng cũng không dùng tên đó
      // để đăng nhập được… chỗ này là chỗ gây conflict"*). `settings.py:285` khai
      // `ACCOUNT_LOGIN_METHODS = {"email", "username"}`, và `lib/dang-nhap.ts` gửi khoá
      // `username` cho mọi chuỗi không có `@` — tức đăng nhập bằng tên này LUÔN chạy được.
      // Câu sai ấy là thứ biến một ràng buộc hợp lý (tên đi vào URL nên không có khoảng
      // trắng) thành một ràng buộc vô cớ trong mắt người đăng ký.
      moTa="Tên này vừa là địa chỉ hồ sơ công khai — /u/tên-của-bạn — vừa là tên đăng nhập: vào bằng email hay bằng tên đều được."
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
      tren={<GoogleVaVach bat={toi?.google_bat === true} />}
      duoi={
        <>
          Đã có tài khoản? <LienKet href="/dang-nhap">Đăng nhập</LienKet>
        </>
      }
    >
      <O ten="email" nhan="Email" kieu="email" tuDien="email" />
      {/* Nhãn cũ "Tên hiển thị công khai" nói được đúng MỘT trong hai vai, và đúng cái
          vai không giải thích nổi luật ký tự: một tên chỉ để trưng bày thì việc gì cấm
          khoảng trắng? Nhãn mới nói cả hai vai, nên `goiY` bên dưới đọc ra là hệ quả chứ
          không phải một điều luật tuỳ hứng. `goiY` giữ nguyên và phải giữ: nó là chỗ DUY
          NHẤT luật ký tự hiện ra TRƯỚC khi người ta gõ. */}
      <O
        ten="username"
        nhan="Tên đăng nhập, cũng là địa chỉ hồ sơ"
        goiY="Không dấu, không khoảng trắng — vì nó đi thẳng vào địa chỉ /u/… Ví dụ: ba_muoi_phien."
        tuDien="username"
      />
      <O
        ten="password"
        nhan="Mật khẩu"
        kieu="password"
        goiY="Ít nhất 8 ký tự, đừng dùng mật khẩu quá phổ biến."
        tuDien="new-password"
      />
    </FormTaiKhoan>
  );
}

// --- đăng nhập ---------------------------------------------------------------

/** Form đăng nhập — dùng ở CẢ `/dang-nhap` lẫn modal (2026-08-26).
 *
 * `onThanhCong` là thứ phân biệt hai chỗ, và nó phân biệt đúng một điều: **có rời trang
 * hay không**.
 *
 * - **trang `/dang-nhap`**: không có `onThanhCong` ⇒ `onGui` trả `{di: "/"}` ⇒ về trang
 *   chủ. Người đã chủ động mở một trang đăng nhập thì không còn "trang đang đọc" nào để
 *   ở lại;
 * - **modal**: có `onThanhCong` ⇒ `onGui` trả `void` ⇒ **không điều hướng**, modal tự
 *   đóng và `router.refresh()` chạy. Người dùng đứng nguyên chỗ cũ.
 *
 * Nhánh nào cũng đi qua `await taiLai()` của `FormTaiKhoan`, nên header đúng ở cả hai.
 */
export function FormDangNhap({
  onThanhCong,
}: {
  onThanhCong?: () => void;
} = {}) {
  const { toi } = usePhien();
  if (toi?.dang_nhap === true) return <DaDangNhap username={toi.username ?? ""} />;
  const trongModal = onThanhCong !== undefined;
  return (
    <FormTaiKhoan
      tieuDe="Đăng nhập"
      nutGui="Vào"
      trongModal={trongModal}
      onThanhCong={onThanhCong}
      onGui={async (f) => {
        await dangNhap(
          taoThongTinDangNhap(
            String(f.get("dinh_danh") ?? ""),
            String(f.get("password") ?? ""),
          ),
        );
        // Trong modal thì KHÔNG trả `{di}`: một lượt `location.assign` ở đây xoá sạch
        // trang người ta đang đọc — đúng thứ modal sinh ra để tránh.
        return trongModal ? undefined : { di: "/" };
      }}
      duoi={
        <>
          <LienKet href="/quen-mat-khau">Quên mật khẩu?</LienKet>
          <br />
          Chưa có tài khoản? <LienKet href="/dang-ky">Đăng ký</LienKet>
        </>
      }
          tren={<GoogleVaVach bat={toi?.google_bat === true} />}
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
 * ## Kiểu dáng: nút PHỤ, không phải nút chính *(user chốt 2026-08-27: "làm lại nút gg và
 * nút đăng nhập, nhìn xấu quá")*
 *
 * Trước lượt này nó dùng chung lớp `.gui` với nút submit ⇒ **hai khối đặc màu nhấn y hệt
 * nhau** nằm cạnh nhau, không phân cấp, và chẳng ra dáng nút Google. Nay nó là nút nền
 * trắng + viền (`.google`), còn `.gui` giữ vai nút chính đặc màu. Bọc ngoài cũng thôi
 * mang lớp `.duoi` — lớp ấy là kiểu CHỮ chân trang, không phải kiểu khối.
 *
 * Logo dùng chữ G bốn màu chính thức của Google, gõ hex thẳng trong SVG. **Đây là ngoại
 * lệ có lý do, không phải chỗ lọt lưới hệ token**: nhận diện thương hiệu của bên thứ ba
 * do bên ấy quy định, tô nó bằng `--accent` là vừa sai thương hiệu vừa làm người dùng
 * mất mốc nhận biết. Bốn mã này không nằm trong danh sách mà `mau-token.spec.ts` canh
 * (chỉ 4 mã lãi/lỗ + 4 mã hoàng thổ), nên không có luật nào bị nới ở đây.
 *
 * ⚠ **NỢ `GOOGLE-CHUA-DO` — đã trả MỘT PHẦN 2026-08-27.** Luồng OAuth thật nay đã chạy
 * trên prod, và nó lộ ra hai lỗi mà bản viết-theo-tài-liệu không thể thấy: Django không
 * tin `X-Forwarded-Proto` nên gửi `redirect_uri` dạng `http://` (Google từ chối vĩnh
 * viễn), và chính docstring cũ ở đây chỉ SAI đường callback. Đường đúng là
 * `…/api/_allauth/google/login/callback/` — xem `api/tests/test_redirect_uri_google.py`.
 * Phần còn NỢ: máy dev vẫn không có credential, nên ở đây vẫn chưa ai bấm thử được.
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
      className={css.khoi_google}
    >
      <input type="hidden" name="csrfmiddlewaretoken" value={csrf} />
      <input type="hidden" name="provider" value="google" />
      <input type="hidden" name="callback_url" value="/" />
      <input type="hidden" name="process" value="login" />
      <button type="submit" className={css.google} data-testid="nut-google">
        <LogoGoogle />
        Tiếp tục với Google
      </button>
    </form>
  );
}

/** Nút Google + vạch "hoặc", bọc chung.
 *
 * Vạch đi kèm nút chứ không đứng riêng ở `FormTaiKhoan`: nó chỉ có nghĩa khi thật sự có
 * hai lối để ngăn cách. Cả cụm cùng biến mất khi `bat` là `false` — tách hai thứ ra hai
 * chỗ là dựng lại đúng lỗi đã gặp: một cái vạch "hoặc" ngăn tiêu đề với form.
 */
function GoogleVaVach({ bat }: { bat: boolean }) {
  if (!bat) return null;
  return (
    <>
      <ChoGoogle bat={bat} />
      <p className={css.vach} aria-hidden data-testid="vach-hoac">
        <span>hoặc</span>
      </p>
    </>
  );
}

/** Chữ G bốn màu của Google. `aria-hidden` vì chữ trên nút đã nói đủ — đọc thêm "logo
 * Google" là lặp. Kích thước theo `em` để nó co giãn cùng cỡ chữ của nút. */
function LogoGoogle() {
  return (
    <svg
      className={css.logo_google}
      viewBox="0 0 18 18"
      width="1.15em"
      height="1.15em"
      aria-hidden
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
