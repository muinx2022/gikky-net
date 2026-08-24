"use client";

import { quanTriBanNguoiDung } from "@gikky/api-client/admin";
import { useState } from "react";

import { HangNutForm } from "./ngan-keo";
import { GOC_API, headerGhi } from "../lib/api";

/** Form ban một tài khoản — **một bản duy nhất**, dùng ở cả trang hồ sơ lẫn hàng đợi.
 *
 * ## Vì sao tách ra khỏi `app/u/[username]/page.tsx`
 *
 * L04 đòi nút "Ban" **ngay trên hàng** của hàng đợi (PLAN 9.3 mục 1). Chép form sang đó
 * là hai bản của cùng một luật, và bản chép sẽ là bản quên `is_staff`, quên `required`
 * trên lý do, hoặc quên rằng hai kiểu hạn loại trừ nhau. Repo này đã đếm khuôn mẫu ấy 8
 * lần (`LOI-VA-NO.md` mục D).
 *
 * ## `so_ngay`, không phải `den_khi` — L33
 *
 * Bản cũ tính `new Date(Date.now() + N*86400e3).toISOString()` **ở trình duyệt** rồi gửi
 * mốc ấy lên. Máy mod lệch giờ là hạn ban lệch theo, và không có gì kêu: server nhận một
 * mốc thời gian hoàn toàn hợp lệ. Nay form gửi `so_ngay` và **Django** cộng vào đồng hồ
 * của chính nó (`api/quan_tri_nguoi_dung.py`) — nguyên tắc 10.
 *
 * `vinh_vien` vẫn là một cờ riêng chứ không phải `so_ngay = 0`: API đòi đúng MỘT trong ba
 * cách khai hạn, và một số 0 mang nghĩa "vĩnh viễn" là đúng loại mã hoá mà tầng sau sẽ
 * đọc nhầm thành "ban 0 ngày".
 */

/** Số ngày cho ban TẠM. `0` là ô "vĩnh viễn" trên màn hình — nó KHÔNG được gửi đi dưới
 * dạng `so_ngay: 0`; xem `body` bên dưới. */
const SO_NGAY = [0, 1, 7, 30] as const;

export function FormBan({
  username,
  laStaff,
  dangChay,
  chay,
  dong,
}: {
  username: string;
  /** Mod không ban được mod khác (409 ở API) — nói ra trước khi bấm, không sau. */
  laStaff: boolean;
  dangChay: boolean;
  chay: (viec: () => Promise<{ error?: unknown }>) => Promise<void>;
  /** Đóng ngăn kéo. Form gọi nó ở nút **Huỷ**; đường LƯU thì do người gọi đóng, sau khi
   *  `chay` xong — xem `apps/admin/app/users/page.tsx`. Đóng ngay lúc bấm "Ban" là đóng
   *  trước khi biết server trả gì, và một 409 "không ban được mod khác" sẽ hiện ra sau
   *  lưng một ngăn kéo vừa biến mất. */
  dong: () => void;
}) {
  const [lyDo, setLyDo] = useState("");
  const [soNgay, setSoNgay] = useState<number>(7);

  return (
    <form
      className="space-y-3"
      data-testid="form-ban"
      onSubmit={(e) => {
        e.preventDefault();
        void chay(() =>
          quanTriBanNguoiDung({
            baseUrl: GOC_API,
            headers: headerGhi(),
            path: { username },
            body: {
              ly_do: lyDo,
              // Đúng MỘT trong ba. `den_khi` không bao giờ được gửi từ đây — đó là cửa
              // dành cho một mốc tuyệt đối do người gọi API tự tính, không phải cho UI.
              vinh_vien: soNgay === 0,
              so_ngay: soNgay === 0 ? null : soNgay,
            },
          }),
        );
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muc-mo">
          Lý do — <strong className="font-medium">người bị ban đọc được câu này</strong>
        </span>
        <input
          className="o-nhap"
          value={lyDo}
          onChange={(e) => setLyDo(e.target.value)}
          required
          maxLength={200}
          data-testid="ban-ly-do"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muc-mo">Thời hạn</span>
        <select
          className="nut w-full cursor-pointer"
          value={soNgay}
          onChange={(e) => setSoNgay(Number(e.target.value))}
          data-testid="ban-thoi-han"
        >
          {SO_NGAY.map((n) => (
            <option key={n} value={n}>
              {n === 0 ? "Vĩnh viễn" : `${n} ngày`}
            </option>
          ))}
        </select>
      </label>

      {laStaff && (
        <p className="mono text-xs text-chu-y">
          Không ban được một tài khoản quản trị — gỡ quyền staff ở Django admin trước.
        </p>
      )}

      <HangNutForm dong={dong} nhan_chinh="Ban tài khoản" dang_chay={dangChay || laStaff} />
    </form>
  );
}
