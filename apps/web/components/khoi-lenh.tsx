"use client";

import type { LenhForm } from "@/lib/lenh-form";

import css from "./khoi-lenh.module.css";

/** Khối "Lệnh (tuỳ chọn)" — gấp mặc định. Dùng chung cho form `/dang-mach` và ngăn kéo đăng
 * nhanh: hai nơi cùng gửi `lenh` trong `POST /machs` qua `lib/lenh-form.ts`, nên cùng MỘT khối
 * nhập (không hai bản lệch nhau).
 *
 * Chiều MUA/BÁN + mã + giá vào là bộ ba bắt buộc NẾU khai lệnh; SL / TP / giá nhồi tuỳ chọn.
 * Thẻ nhật ký trên trang chủ vẽ dải lệnh từ đây.
 *
 * Lệnh là biên lai: gửi lúc đăng và KHÔNG sửa được sau đó (thay đổi kể qua mốc) — dòng nhắc
 * dưới cùng nói thẳng điều này để người ta không điền vội.
 *
 * `tienTo` đặt tiền tố cho `data-testid` và tên nhóm radio. **Hai nơi dùng PHẢI khác tiền tố**:
 * ngăn kéo luôn có mặt trong DOM của mọi trang (kể cả `/dang-mach`, lúc đóng chỉ ẩn bằng
 * `visibility`), nên trùng testid là trùng ô, và trùng `name` là hai nhóm radio nuốt nhau. */
export function KhoiLenh({
  gia_tri,
  datGiaTri,
  dangGui,
  tienTo,
  kieu = "trang",
  moSan = false,
}: {
  gia_tri: LenhForm;
  datGiaTri: (l: LenhForm) => void;
  dangGui: boolean;
  tienTo: "dang-mach" | "dang-nhanh";
  kieu?: "trang" | "ngan-keo";
  /** Mở khối khi nó nhận lệnh đã điền sẵn (bản nháp chuyển từ ngăn kéo) — để người ta THẤY lệnh
   * sắp gửi. Chỉ `true` mới có tác dụng; sau đó người dùng gập/mở tự do. */
  moSan?: boolean;
}) {
  const doi = (k: keyof LenhForm) => (e: React.ChangeEvent<HTMLInputElement>) =>
    datGiaTri({ ...gia_tri, [k]: e.target.value });
  const o = (k: "giaVao" | "sl" | "tp" | "nhoi", nhan: string, id: string) => (
    <label className={css.o_lenh}>
      <span className={css.nhan}>{nhan}</span>
      <input
        className={css.dong}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={gia_tri[k]}
        onChange={doi(k)}
        disabled={dangGui}
        data-testid={`${tienTo}-lenh-${id}`}
      />
    </label>
  );
  return (
    <details
      className={kieu === "ngan-keo" ? `${css.lenh} ${css.ngan_keo}` : css.lenh}
      open={moSan ? true : undefined}
      data-testid={`${tienTo}-lenh`}
    >
      <summary className={css.lenh_tom_tat}>Lệnh (tuỳ chọn)</summary>
      <div className={css.lenh_than}>
        <fieldset className={css.lenh_chieu} disabled={dangGui}>
          <legend className={css.nhan}>Chiều lệnh</legend>
          {(["mua", "ban"] as const).map((c) => (
            <label key={c} className={css.lenh_radio}>
              <input
                type="radio"
                name={`${tienTo}-lenh-chieu`}
                checked={gia_tri.chieu === c}
                onChange={() => datGiaTri({ ...gia_tri, chieu: c })}
                data-testid={`${tienTo}-lenh-chieu-${c}`}
              />
              <span>{c === "mua" ? "MUA" : "BÁN"}</span>
            </label>
          ))}
        </fieldset>
        <label className={css.o_lenh}>
          <span className={css.nhan}>Mã</span>
          <input
            className={css.dong}
            type="text"
            maxLength={20}
            autoCapitalize="characters"
            autoComplete="off"
            value={gia_tri.ma}
            onChange={doi("ma")}
            disabled={dangGui}
            placeholder="HPG, USD/JPY…"
            data-testid={`${tienTo}-lenh-ma`}
          />
        </label>
        {o("giaVao", "Giá vào (Entry)", "gia-vao")}
        {o("sl", "Cắt lỗ (SL)", "sl")}
        {o("tp", "Chốt lời (TP)", "tp")}
        {o("nhoi", "Giá nhồi", "nhoi")}
        <p className={css.lenh_nhac}>
          MUA: SL &lt; giá vào &lt; TP. BÁN: TP &lt; giá vào &lt; SL. Lệnh ghi một lần lúc đăng và
          không sửa được — thay đổi về sau kể bằng mốc mới.
        </p>
      </div>
    </details>
  );
}
