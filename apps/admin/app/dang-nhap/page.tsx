"use client";

import Link from "next/link";
import { useState } from "react";

import { baoDamCsrf, GOC_ALLAUTH } from "../../lib/api";
import { taoThongTinDangNhap } from "../../lib/dang-nhap";

/**
 * Đăng nhập mod.
 *
 * **Nối vào allauth thật ở lượt gộp Mảng A + C (2026-08-23).** Trang này viết ở Mảng C khi
 * endpoint chưa tồn tại và mang một banner đỏ nói thế; Mảng A (Phase 2) đã cấp endpoint,
 * nên banner đi và đường gọi chạy thật.
 *
 * Ba chốt của PLAN 8.2 mà trang này phải đúng, và cả ba đều hỏng theo kiểu khó đoán:
 *
 * 1. **đường dẫn tương đối** `/api/_allauth/...` — same-origin qua `rewrites` của
 *    `next.config.ts`. Gọi thẳng `http://localhost:8000` là cross-origin và cookie session
 *    không được đặt, mà lỗi ấy trông như "sai mật khẩu";
 * 2. **`X-CSRFToken`** đọc từ cookie. Thiếu là 403 CSRF ở ngay cú bấm đầu tiên;
 * 3. **cookie CSRF phải do allauth gieo**, không phải `GET /api/admin/me`: `/me` đòi
 *    `is_staff` nên khách chưa đăng nhập gọi nó chỉ nhận 401/403 và ra về tay không. Đó là
 *    việc của `baoDamCsrf()` trong `lib/api.ts`.
 *
 * **Không có phép kiểm `is_staff` ở đây, và đó là chủ đích.** Đăng nhập là việc của
 * allauth: mọi tài khoản hợp lệ đều đăng nhập được, kể cả user thường. Cửa quản trị là
 * `CongQuanTri` + `ChiMod` ở phía Django — user thường vào tới `/` rồi nhận màn
 * `khong_du_quyen`. Thêm một phép kiểm quyền thứ hai ở trang đăng nhập là dựng bản thứ hai
 * của một luật phân quyền, và bản thứ hai bao giờ cũng là bản trôi ra khỏi bản thật.
 *
 * **Không dùng client sinh từ OpenAPI**: allauth headless không đi qua `NinjaAPI` nào nên
 * nó không có mặt trong `openapi.json` lẫn `openapi.admin.json`. `fetch` trần ở đây là
 * đúng, và nó KHÔNG vi phạm luật "type một chiều" (PLAN 8.3) — luật đó nói về việc khai
 * lại schema của API mình sinh ra, còn đây là một API bên thứ ba chưa được mô tả.
 */
const DUONG_DANG_NHAP_ALLAUTH = `${GOC_ALLAUTH}/auth/login`;

/** Câu tiếng Việt cho những mã allauth không kèm thông điệp nào đọc được.
 *
 * allauth cố ý trả thông điệp tiếng Anh ngắn ("i18n không phải vấn đề vì những lỗi này
 * không nên hiện ra UI"), nên chỗ nào nó im thì UI phải tự nói — im lặng ở form đăng nhập
 * là kiểu hỏng người ta bấm lại ba lần rồi bỏ đi.
 */
const MAC_DINH: Record<number, string> = {
  400: "Dữ liệu chưa hợp lệ — xem lại tài khoản và mật khẩu.",
  401: "Tài khoản hoặc mật khẩu không đúng, hoặc tài khoản chưa xác thực email.",
  403: "Yêu cầu bị từ chối (CSRF). Tải lại trang rồi thử lại.",
  409: "Bạn đang đăng nhập rồi.",
  429: "Bạn thử hơi nhiều lần. Đợi một lát rồi thử lại.",
};

/** Thông điệp đầu tiên allauth kể được, hoặc `null`. Hình dạng: `{errors: [{message}]}`. */
function thongDiepAllauth(du_lieu: unknown): string | null {
  if (typeof du_lieu !== "object" || du_lieu === null) return null;
  const loi = (du_lieu as { errors?: { message?: unknown }[] }).errors?.[0]?.message;
  return typeof loi === "string" ? loi : null;
}

export default function TrangDangNhap() {
  // "định danh": email HOẶC username. Xem `lib/dang-nhap.ts` — allauth đòi client
  // chọn đúng một khoá, nên biến này cố ý không tên là `email`.
  const [dinh_danh, setDinhDanh] = useState("");
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
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-CSRFToken": await baoDamCsrf(),
        },
        body: JSON.stringify(taoThongTinDangNhap(dinh_danh, matKhau)),
      });
      if (r.ok) {
        // `window.location` chứ không phải `router.push`: cả khu quản trị treo trên
        // `GET /api/admin/me` gọi một lần lúc mount (`CongQuanTri`), và một điều hướng
        // client-side giữ nguyên cây React đã mount với kết quả 401 cũ trong state.
        window.location.href = "/";
        return;
      }
      const than: unknown = await r.json().catch(() => null);
      setKetQua(
        thongDiepAllauth(than) ??
          MAC_DINH[r.status] ??
          `Đăng nhập thất bại (HTTP ${r.status}).`,
      );
    } catch (loi) {
      setKetQua(loi instanceof Error ? `${loi.name}: ${loi.message}` : String(loi));
    } finally {
      setDangGui(false);
    }
  }

  return (
    <main className="grid min-h-dvh place-items-center p-6">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex items-center gap-2">
          <span
            className="grid size-9 place-items-center rounded-lg bg-nhan text-base
              font-bold text-tren-nhan"
            aria-hidden="true"
          >
            g
          </span>
          <span className="leading-tight">
            <span className="block font-semibold">gikky.net</span>
            <span className="mono block text-[11px] text-muc-mo">QUẢN TRỊ</span>
          </span>
        </div>

        <h1 className="mb-1 text-xl font-semibold">Đăng nhập</h1>
        <p className="mb-5 text-sm text-muc-mo">
          Khu quản trị chỉ mở cho tài khoản <code className="mono">is_staff</code>; tài
          khoản thường đăng nhập được nhưng sẽ bị từ chối ở cửa quản trị.
        </p>

        <form className="the space-y-3 p-5" onSubmit={gui}>
          <label className="block text-sm">
            <span className="mb-1 block text-muc-mo">Email hoặc tên đăng nhập</span>
            <input
              className="o-nhap"
              // `text`, KHÔNG phải `email`: trình duyệt chặn tại chỗ mọi chuỗi không
              // có `@` ⇒ chặn luôn đường đăng nhập bằng username, và chặn IM LẶNG.
              type="text"
              value={dinh_danh}
              onChange={(e) => setDinhDanh(e.target.value)}
              required
              autoComplete="username"
            />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block text-muc-mo">Mật khẩu</span>
            <input
              className="o-nhap"
              type="password"
              value={matKhau}
              onChange={(e) => setMatKhau(e.target.value)}
              required
              autoComplete="current-password"
            />
          </label>
          <button
            type="submit"
            className="nut nut-chinh w-full"
            disabled={dangGui}
            data-testid="nut-dang-nhap"
          >
            {dangGui ? "Đang gửi…" : "Đăng nhập"}
          </button>
        </form>

        {ketQua !== null && (
          <div
            className="the mt-4 border-xau p-4 text-sm text-xau"
            role="alert"
            data-testid="loi-dang-nhap"
          >
            {ketQua}
          </div>
        )}

        <p className="mono mt-5 flex justify-between text-xs text-muc-mo">
          <Link href="/" className="hover:underline">
            ← Về bảng điều khiển
          </Link>
          <a href="/api/admin/django/" className="hover:underline">
            Django admin ↗
          </a>
        </p>
      </div>
    </main>
  );
}
