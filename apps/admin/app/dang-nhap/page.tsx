"use client";

import Link from "next/link";
import { useState } from "react";

import { docCsrf } from "../../lib/api";

/**
 * Đăng nhập mod.
 *
 * ⚠ **TRANG NÀY CHƯA CHẠY ĐƯỢC — và chưa hề được kiểm** *(Phase 4 / Mảng C, 2026-08-22)*.
 *
 * Endpoint `POST /api/_allauth/browser/v1/auth/login` thuộc **Mảng A (Phase 2, allauth
 * headless)** và chưa tồn tại ở nhánh này. Cho tới lúc gộp Mảng A vào, form dưới đây gửi
 * đi và nhận 404 — đó là hành vi ĐANG CÓ, không phải bug cần vá ở đây.
 *
 * Cách đăng nhập DUY NHẤT hoạt động hôm nay: Django admin ở `/api/admin/django/`. Đăng
 * nhập ở đó xong thì session Django có hiệu lực cho cả `/api/admin/*` — cùng một cookie.
 *
 * **Vì sao vẫn viết trang này thay vì để trống:** phần khó của nó không nằm ở lời gọi
 * fetch mà ở hai chốt của PLAN 8.2, và cả hai đúng hay sai đều thấy được ngay khi gộp:
 *
 * 1. **đường dẫn tương đối** `/api/_allauth/...` — same-origin qua `rewrites` của
 *    `next.config.ts`. Gọi thẳng `http://localhost:8000` là cross-origin và cookie session
 *    không được đặt, mà lỗi ấy trông như "sai mật khẩu";
 * 2. **`X-CSRFToken`** đọc từ cookie. Thiếu là 403 CSRF ở ngay cú bấm đầu tiên.
 *
 * ⚠ Cookie CSRF ở đây do **allauth** gieo (`GET /api/_allauth/browser/v1/auth/session`),
 * không phải `GET /api/admin/me` — `/me` đòi staff nên nó không dùng được TRƯỚC khi đăng
 * nhập. Lời gọi gieo cookie ấy là việc của Mảng A; nếu khi gộp mà token rỗng thì đó là
 * chỗ phải nối, không phải ở `docCsrf`.
 *
 * **Không dùng client sinh từ OpenAPI**: allauth headless không đi qua `NinjaAPI` nào nên
 * nó không có mặt trong `openapi.json` lẫn `openapi.admin.json`. `fetch` trần ở đây là
 * đúng, và nó KHÔNG vi phạm luật "type một chiều" (PLAN 8.3) — luật đó nói về việc khai
 * lại schema của API mình sinh ra, còn đây là một API bên thứ ba chưa được mô tả.
 */
const DUONG_DANG_NHAP_ALLAUTH = "/api/_allauth/browser/v1/auth/login";

export default function TrangDangNhap() {
  const [email, setEmail] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [ketQua, setKetQua] = useState<string | null>(null);
  const [dangGui, setDangGui] = useState(false);

  async function gui(e: React.FormEvent) {
    e.preventDefault();
    setDangGui(true);
    setKetQua(null);
    try {
      const r = await fetch(DUONG_DANG_NHAP_ALLAUTH, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": docCsrf(),
        },
        body: JSON.stringify({ email, password: matKhau }),
      });
      if (r.ok) {
        window.location.href = "/";
        return;
      }
      if (r.status === 404) {
        setKetQua(
          "Chưa có endpoint đăng nhập: allauth thuộc Phase 2 và chưa được gộp vào nhánh " +
            "này. Đăng nhập tạm qua Django admin ở /api/admin/django/.",
        );
        return;
      }
      setKetQua(`Đăng nhập thất bại (HTTP ${r.status}).`);
    } catch (loi) {
      setKetQua(loi instanceof Error ? `${loi.name}: ${loi.message}` : String(loi));
    } finally {
      setDangGui(false);
    }
  }

  return (
    <main className="vo">
      <h1>Đăng nhập quản trị</h1>

      <div className="loi">
        <strong>Chưa dùng được ở nhánh này.</strong> Endpoint allauth (
        <code>{DUONG_DANG_NHAP_ALLAUTH}</code>) thuộc Phase 2 và chỉ tồn tại sau khi mảng
        tài khoản được gộp vào. Hôm nay, đăng nhập bằng{" "}
        <a href="/api/admin/django/">Django admin</a> — cùng một session cookie, nên xong
        là dùng được cả khu quản trị.
      </div>

      <form className="the" onSubmit={gui}>
        <p>
          <label>
            Email{" "}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
        </p>
        <p>
          <label>
            Mật khẩu{" "}
            <input
              type="password"
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
        </p>
        <button type="submit" disabled={dangGui}>
          Đăng nhập
        </button>
      </form>

      {ketQua !== null && <div className="loi">{ketQua}</div>}

      <p>
        <Link href="/">← Về hàng đợi</Link>
      </p>
    </main>
  );
}
