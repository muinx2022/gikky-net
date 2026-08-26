"use client";

import {
  quanTriDatMatKhau,
  quanTriSuaNguoiDung,
  type NguoiDungQuanTriOut,
} from "@gikky/api-client/admin";
import { useState } from "react";

import { GOC_API, headerGhi } from "../lib/api";
import { HangNutForm } from "./ngan-keo";
import { NhanTrangThai } from "./ui";

/** Form sửa một tài khoản — `plans/2026-08-25-crud-nguoi-dung.md`.
 *
 * ## Vì sao mật khẩu tách khỏi form thông tin
 *
 * Hai lời gọi API khác nhau, và quan trọng hơn: hai mức hậu quả khác nhau. Sửa
 * `display_name` sai thì sửa lại; đặt mật khẩu cho người khác là **đăng nhập được bằng
 * tài khoản đó**. Gộp chung một nút "Lưu" là để hai việc ấy đi cùng một cú bấm.
 *
 * ## "Xoá mật khẩu" KHÔNG phải khoá tài khoản
 *
 * Sau khi xoá, người đó vào bằng Google hoặc `/quen-mat-khau`. Nút vì thế nói rõ hệ quả
 * thay vì chỉ nói hành động — "Xoá mật khẩu" một mình đọc như "chặn đăng nhập".
 *
 * ## `is_staff` / `is_superuser` KHÔNG có ở đây
 *
 * User chốt: chỉ **hiện nhãn** nhóm, không cấp quyền qua màn hình này.
 *
 * Từ 2026-08-26 cấp/thu quyền mod **có** cửa riêng — `/quan-tri-vien`, khoá sau
 * `is_superuser` — nhưng nó vẫn cố ý **không** nằm ở form này: gộp "sửa hồ sơ" với "đổi
 * quyền" là để một lượt sửa tên hiển thị đi chung đường với một lượt đổi quyền quản trị,
 * hai việc cần hai mức chú ý khác nhau và hai dòng nhật ký khác nhau.
 *
 * `is_superuser` thì không cửa nào trong khu quản trị chạm tới — vẫn chỉ Django admin.
 */
export function FormSuaUser({
  u,
  dangChay,
  dong,
  chay,
}: {
  u: NguoiDungQuanTriOut;
  dangChay: boolean;
  dong: () => void;
  chay: (viec: () => Promise<{ error?: unknown }>) => Promise<void>;
}) {
  const [display_name, datDisplayName] = useState(u.display_name);
  const [email, datEmail] = useState(u.email);
  const [mat_khau, datMatKhau] = useState("");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mono text-sm">u/{u.username}</span>
        <NhanTrangThai
          tone={u.is_superuser ? "chu-y" : u.is_staff ? "nhan" : "trung-tinh"}
        >
          {u.vai_tro}
        </NhanTrangThai>
        {!u.co_mat_khau && (
          <NhanTrangThai tone="chu-y">không có mật khẩu</NhanTrangThai>
        )}
      </div>

      {u.subs_mod.length > 0 && (
        <p className="text-sm text-muc-mo">
          Phụ trách:{" "}
          <span className="mono">
            {u.subs_mod.map((x) => `s/${x}`).join(" · ")}
          </span>
          <br />
          <span className="text-xs">
            Đây là danh sách <strong>phân công</strong>, chưa cấp thêm quyền gì.
          </span>
        </p>
      )}

      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          void chay(() =>
            quanTriSuaNguoiDung({
              baseUrl: GOC_API,
              headers: headerGhi(),
              path: { username: u.username },
              body: { display_name, email },
            }),
          );
        }}
      >
        <label className="block text-sm">
          <span className="mb-1 block text-muc-mo">Tên hiển thị</span>
          <input
            className="o-nhap"
            value={display_name}
            onChange={(e) => datDisplayName(e.target.value)}
            disabled={dangChay}
            data-testid="user-display-name"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-muc-mo">Email</span>
          <input
            className="o-nhap mono"
            value={email}
            onChange={(e) => datEmail(e.target.value)}
            autoComplete="off"
            spellCheck={false}
            disabled={dangChay}
            data-testid="user-email"
          />
        </label>
        <HangNutForm dong={dong} nhan_chinh="Lưu" dang_chay={dangChay} />
      </form>

      <div className="space-y-3 border-t border-vien pt-4">
        <p className="text-sm font-semibold">Mật khẩu</p>
        <label className="block text-sm">
          <span className="mb-1 block text-muc-mo">Đặt mật khẩu mới</span>
          <input
            type="password"
            className="o-nhap mono"
            value={mat_khau}
            onChange={(e) => datMatKhau(e.target.value)}
            autoComplete="new-password"
            placeholder="để trống nếu không đổi"
            disabled={dangChay}
            data-testid="user-mat-khau"
          />
        </label>
        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="nut mr-auto"
            disabled={dangChay || !u.co_mat_khau}
            title={
              u.co_mat_khau
                ? "Sau khi xoá, tài khoản vào bằng Google hoặc đặt lại qua email."
                : "Tài khoản này vốn đã không có mật khẩu."
            }
            onClick={() =>
              chay(() =>
                quanTriDatMatKhau({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { username: u.username },
                  body: { mat_khau: null },
                }),
              )
            }
            data-testid="nut-xoa-mat-khau"
          >
            Xoá mật khẩu
          </button>
          <button
            type="button"
            className="nut nut-chinh"
            disabled={dangChay || mat_khau.trim() === ""}
            onClick={() =>
              chay(() =>
                quanTriDatMatKhau({
                  baseUrl: GOC_API,
                  headers: headerGhi(),
                  path: { username: u.username },
                  body: { mat_khau },
                }),
              )
            }
            data-testid="nut-dat-mat-khau"
          >
            Đặt mật khẩu
          </button>
        </div>
        <p className="text-xs text-muc-mo">
          Xoá mật khẩu <strong>không khoá</strong> tài khoản: người đó vẫn vào được bằng
          Google, hoặc đặt lại qua “quên mật khẩu”.
        </p>
      </div>

      <div className="space-y-2 border-t border-vien pt-4">
        <p className="text-sm font-semibold">Trạng thái</p>
        <button
          type="button"
          className="nut"
          disabled={dangChay}
          onClick={() =>
            chay(() =>
              quanTriSuaNguoiDung({
                baseUrl: GOC_API,
                headers: headerGhi(),
                path: { username: u.username },
                body: { is_active: !u.is_active },
              }),
            )
          }
          data-testid="nut-doi-hoat-dong"
        >
          {u.is_active ? "Vô hiệu hoá tài khoản" : "Kích hoạt lại"}
        </button>
        <p className="text-xs text-muc-mo">
          Vô hiệu hoá <strong>giữ nguyên nội dung</strong> đã đăng và chặn đăng nhập —
          không xoá hàng nào. Đảo ngược được.
        </p>
      </div>
    </div>
  );
}
