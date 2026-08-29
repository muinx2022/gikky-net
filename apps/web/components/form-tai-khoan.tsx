"use client";

import Link from "next/link";
import { createContext, useContext, useState } from "react";

import { LoiTaiKhoan } from "@/lib/tai-khoan";

import css from "./form-tai-khoan.module.css";
import { usePhien } from "./phien";

/** Khung chung của 5 trang tài khoản — đăng ký · đăng nhập · quên · đặt lại · đổi mật khẩu.
 *
 * Gom lại vì cả năm trang có cùng ba thứ dễ làm sai và dễ làm khác nhau:
 *
 * 1. **nút phải khoá trong lúc gửi** — không khoá thì bấm hai lần là hai lần đăng ký;
 * 2. **lỗi phải hiện ra, và hiện đúng chỗ** — allauth trả lỗi theo `param`, nên ô nào sai
 *    thì bôi ô đó; lỗi không gắn được ô nào thì lên đầu form. Nuốt lỗi rồi để form đứng
 *    im là kiểu hỏng người ta bấm ba lần rồi bỏ đi;
 * 3. **thành công phải nói ra** — nhất là những luồng mà kết quả là *một email được gửi*,
 *    tức là trên màn hình không có gì đổi cả.
 */

export type KetQua = { xong: string } | { di: string } | void;

export function FormTaiKhoan({
  tieuDe,
  moTa,
  nutGui,
  onGui,
  children,
  tren,
  duoi,
  onThanhCong,
  trongModal = false,
}: {
  tieuDe: string;
  moTa?: React.ReactNode;
  nutGui: string;
  /** Ném `LoiTaiKhoan` khi hỏng. Trả `{xong}` để hiện lời nhắn, `{di}` để điều hướng. */
  onGui: (du_lieu: FormData) => Promise<KetQua>;
  children: React.ReactNode;
  /** Khối đứng **TRƯỚC** `<form>` — chỗ của nút Google *(user chốt 2026-08-27: "nút gg ở
   * phía trên, form ở phía dưới")*.
   *
   * Là một slot riêng chứ không phải một `children` nữa, và đó là điều bắt buộc chứ không
   * phải cho gọn: `ChoGoogle` **tự nó là một `<form method="POST">`**. Trước lượt này nó
   * được truyền vào `children`, tức nằm LỒNG trong `<form onSubmit>` của khối này — HTML
   * cấm `<form>` lồng `<form>`, và bản do trình duyệt phân tích (SSR) sẽ nuốt thẻ trong,
   * khiến nút Google submit nhầm form ngoài. Chỉ vì React dựng DOM bằng `createElement`
   * chứ không qua bộ phân tích HTML nên nó vẫn chạy được — một cái sai đứng vững nhờ may.
   * Đưa ra ngoài `<form>` gỡ luôn cả cái sai ấy. */
  tren?: React.ReactNode;
  duoi?: React.ReactNode;
  /** Chạy SAU khi `onGui` xong **và** `taiLai()` đã cập nhật phiên — modal đăng nhập
   * dùng nó để tự đóng (2026-08-26).
   *
   * Thứ tự ấy là cả nội dung của prop này. Đóng modal ngay trong `onGui` thì component
   * này bị gỡ khỏi cây **trước** `await taiLai()`, và lượt hỏi `GET /me` ấy chạy mồ côi:
   * header giữ nguyên trạng thái khách cho tới lần điều hướng sau. */
  onThanhCong?: () => void;
  /** Bỏ lớp bọc canh giữa — trong modal, cái hộp `<dialog>` đã canh giữa rồi, và
   * `padding-top` của `.khung` đẩy thẻ lệch xuống. */
  trongModal?: boolean;
}) {
  const { taiLai } = usePhien();
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  const [theoTruong, datTheoTruong] = useState<Record<string, string>>({});
  const [xong, datXong] = useState<string | null>(null);

  const gui = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (dangGui) return;
    datDangGui(true);
    datLoi(null);
    datTheoTruong({});
    try {
      const kq = await onGui(new FormData(e.currentTarget));
      // Phiên có thể vừa đổi (đăng nhập / xác thực email) — hỏi lại `GET /me` để header
      // và mọi thứ treo vào `usePhien` cập nhật ngay, không đợi lần điều hướng sau.
      await taiLai();
      if (kq && "xong" in kq) datXong(kq.xong);
      if (kq && "di" in kq) window.location.assign(kq.di);
      // Đứng SAU `taiLai()` — xem docstring của prop.
      onThanhCong?.();
    } catch (e2) {
      if (e2 instanceof LoiTaiKhoan) {
        datLoi(e2.message);
        datTheoTruong(e2.theoTruong);
      } else {
        datLoi("Không gọi được máy chủ. Kiểm tra kết nối rồi thử lại.");
      }
    } finally {
      datDangGui(false);
    }
  };

  // `<div>` chứ không `<main>`: từ 2026-08-24 các trang auth được bọc bằng `KhungHaiCot`,
  // và khung đó đã render `<main>`. Hai `<main>` lồng nhau là HTML sai và trình đọc màn
  // hình mất mốc điều hướng.
  const than = (
    <section className={css.the}>
      <h1 className={css.tieu_de}>{tieuDe}</h1>
      {moTa && <p className={css.mo_ta}>{moTa}</p>}

      {/* Khối trên (nút Google) chỉ hiện khi CHƯA có kết quả: sau khi đăng ký xong,
          `xong` chiếm chỗ cả form — bày một lối đăng nhập thứ hai bên trên một lời nhắn
          "hãy mở hộp thư" là mời người ta bỏ dở đúng việc vừa được giao.

          ⚠ **Vạch "hoặc" nằm TRONG `tren`, không phải ở đây.** Bản đầu của lượt này dựng
          vạch tại chỗ với điều kiện `tren !== undefined` — sai ngay lần chạy thử đầu:
          `tren` là một element nên LUÔN khác `undefined`, trong khi component bên trong
          trả `null` lúc server không có credential Google. Kết quả là một cái vạch "hoặc"
          lơ lửng ngăn tiêu đề với form, không ngăn cách gì cả. Người quyết có nút hay
          không phải là người vẽ cái vạch ấy — gộp lại thì trạng thái hỏng đó không dựng
          lên được nữa. */}
      {xong === null && tren}

      {xong !== null ? (
        <p className={css.xong} role="status" data-testid="form-xong">
          {xong}
        </p>
      ) : (
        <form onSubmit={gui} noValidate data-testid="form-tai-khoan">
          {loi !== null && (
            <p className={css.loi} role="alert" data-testid="form-loi">
              {loi}
            </p>
          )}
          <LoiTruong.Provider value={theoTruong}>{children}</LoiTruong.Provider>
          <button
            type="submit"
            className={css.gui}
            disabled={dangGui}
            data-testid="form-gui"
          >
            {dangGui ? "Đang gửi…" : nutGui}
          </button>
        </form>
      )}

      {duoi && <p className={css.duoi}>{duoi}</p>}
    </section>
  );

  return trongModal ? than : <div className={css.khung}>{than}</div>;
}

/** Lỗi theo `param` mà allauth trả về, bơm xuống đúng ô.
 *
 * **Context chứ không phải một object cấp module**: một biến dùng chung ở tầng module là
 * trạng thái toàn tiến trình — hai form render đồng thời (hoặc React render lại ngắt
 * quãng) sẽ đọc lỗi của nhau. Ở đây nó chỉ tiết kiệm được một prop, nên cái giá ấy rõ
 * ràng là không đáng.
 */
const LoiTruong = createContext<Record<string, string>>({});

export function O({
  ten,
  nhan,
  kieu = "text",
  goiY,
  batBuoc = true,
  tuDien,
}: {
  ten: string;
  nhan: string;
  kieu?: string;
  goiY?: string;
  batBuoc?: boolean;
  /** `autoComplete` — trình duyệt và trình quản lý mật khẩu cần nó để điền đúng ô. */
  tuDien?: string;
}) {
  const loi = useContext(LoiTruong)[ten];
  return (
    <label className={css.o}>
      <span className={css.nhan}>{nhan}</span>
      <input
        name={ten}
        type={kieu}
        required={batBuoc}
        autoComplete={tuDien}
        aria-invalid={loi !== undefined}
        data-testid={`o-${ten}`}
      />
      {goiY !== undefined && <span className={css.goi_y}>{goiY}</span>}
      {loi !== undefined && (
        <span className={css.loi_o} data-testid={`loi-${ten}`}>
          {loi}
        </span>
      )}
    </label>
  );
}

export function LienKet({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className={css.lien_ket}>
      {children}
    </Link>
  );
}
