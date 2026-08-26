"use client";

import { quanTriTaoNguoiDung } from "@gikky/api-client/admin";
import { useState } from "react";

import { GOC_API, headerGhi } from "../lib/api";
import { HangNutForm } from "./ngan-keo";

/** Form tạo tài khoản — `plans/2026-08-25-crud-nguoi-dung.md` §4.
 *
 * ## Mật khẩu để trống là một lựa chọn HỢP LỆ, không phải thiếu sót
 *
 * Bỏ trống ⇒ tài khoản không có mật khẩu ⇒ vào bằng Google, hoặc tự đặt qua
 * "quên mật khẩu". Đó là đường tự nhiên khi lập tài khoản hộ ai đó: người tạo không phải
 * nghĩ ra một mật khẩu rồi gửi nó qua chat. Nhãn ô nói thẳng điều đó thay vì để trống rồi
 * bắt người dùng đoán.
 *
 * ## Email được đánh dấu ĐÃ XÁC THỰC
 *
 * Superuser tạo hộ thì email coi như đã được người tạo xác nhận — không đánh dấu thì tài
 * khoản mới kẹt ở trạng thái chưa xác thực và gần như không dùng được. Đây là đường **duy
 * nhất** dựng được một `EmailAddress(verified=True)` mà không qua hòm thư, nên nó nằm sau
 * `is_superuser` và nó ghi `AuditLog`. Câu dưới form nói ra để người bấm biết mình đang
 * bảo lãnh cho địa chỉ đó.
 *
 * ## Không có `is_staff` / `is_superuser`
 *
 * Tài khoản mới luôn là thành viên thường. Cấp quyền mod là một thao tác riêng ở
 * `/quan-tri-vien` (từ 2026-08-26); `is_superuser` thì vẫn chỉ Django admin. Xem
 * `FormSuaUser` cho cùng lý lẽ.
 */
export function FormTaoUser({
  dangChay,
  dong,
  chay,
}: {
  dangChay: boolean;
  dong: () => void;
  chay: (viec: () => Promise<{ error?: unknown }>) => Promise<void>;
}) {
  const [username, datUsername] = useState("");
  const [email, datEmail] = useState("");
  const [display_name, datDisplayName] = useState("");
  const [mat_khau, datMatKhau] = useState("");

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        e.preventDefault();
        void chay(() =>
          quanTriTaoNguoiDung({
            baseUrl: GOC_API,
            headers: headerGhi(),
            body: {
              username,
              email,
              display_name,
              // Rỗng ⇒ `null` ⇒ tài khoản không có mật khẩu (vào bằng Google / đặt lại).
              mat_khau: mat_khau.trim() === "" ? null : mat_khau,
            },
          }),
        );
      }}
    >
      <label className="block text-sm">
        <span className="mb-1 block text-muc-mo">Tên đăng nhập</span>
        <input
          className="o-nhap mono"
          value={username}
          onChange={(e) => datUsername(e.target.value)}
          required
          autoComplete="off"
          spellCheck={false}
          disabled={dangChay}
          data-testid="tao-username"
        />
        <span className="mt-1 block text-xs text-muc-mo">
          Nằm trong địa chỉ hồ sơ công khai <code className="mono">/u/tên</code> —{" "}
          <strong>không sửa được</strong> sau khi tạo.
        </span>
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muc-mo">Email</span>
        <input
          type="email"
          className="o-nhap mono"
          value={email}
          onChange={(e) => datEmail(e.target.value)}
          required
          autoComplete="off"
          spellCheck={false}
          disabled={dangChay}
          data-testid="tao-email"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muc-mo">Tên hiển thị</span>
        <input
          className="o-nhap"
          value={display_name}
          onChange={(e) => datDisplayName(e.target.value)}
          placeholder="để trống thì lấy theo tên đăng nhập"
          disabled={dangChay}
          data-testid="tao-display-name"
        />
      </label>

      <label className="block text-sm">
        <span className="mb-1 block text-muc-mo">Mật khẩu</span>
        <input
          type="password"
          className="o-nhap mono"
          value={mat_khau}
          onChange={(e) => datMatKhau(e.target.value)}
          placeholder="để trống → chỉ vào được bằng Google / đặt lại qua email"
          autoComplete="new-password"
          disabled={dangChay}
          data-testid="tao-mat-khau"
        />
      </label>

      <p className="text-xs text-muc-mo">
        Email sẽ được đánh dấu <strong>đã xác thực</strong> — bạn đang bảo lãnh cho địa
        chỉ này. Thao tác được ghi vào nhật ký.
      </p>

      <HangNutForm dong={dong} nhan_chinh="Tạo tài khoản" dang_chay={dangChay} />
    </form>
  );
}
