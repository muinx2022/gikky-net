"use client";

import Link from "next/link";
import { useState } from "react";

import { Icon } from "../../components/icon";
import { baoDamCsrf, GOC_ALLAUTH } from "../../lib/api";
import { taoThongTinDangNhap } from "../../lib/dang-nhap";
import { duongDanQuayLai } from "../../lib/quay-lai";
import { useTieuDeTrang } from "../../lib/tieu-de";

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

/** Header mang tín hiệu "ghi nhớ đăng nhập" sang Django.
 *
 * ## Vì sao HEADER chứ không phải một khoá trong body
 *
 * Body của `POST …/auth/login` do `LoginInput` của allauth định nghĩa, và nó **loại mọi
 * khoá lạ** trước khi handler nhìn thấy. Thêm `remember` vào body là gửi một thứ chắc chắn
 * bị vứt, và bị vứt **im lặng** — form vẫn đăng nhập được, ô tích vẫn bấm được, chỉ có hạn
 * phiên là không bao giờ đổi.
 *
 * Phía Django đọc header này trong một receiver của signal `user_logged_in`
 * (`api/core/phien.py`) — xem docstring ở đó để biết vì sao là signal chứ không middleware,
 * và vì sao `ACCOUNT_SESSION_REMEMBER` **không** dùng được.
 */
const HEADER_GHI_NHO = "X-Ghi-Nho";

export default function TrangDangNhap() {
  // "định danh": email HOẶC username. Xem `lib/dang-nhap.ts` — allauth đòi client
  // chọn đúng một khoá, nên biến này cố ý không tên là `email`.
  const [dinh_danh, setDinhDanh] = useState("");
  const [matKhau, setMatKhau] = useState("");
  const [ketQua, setKetQua] = useState<string | null>(null);
  const [dangGui, setDangGui] = useState(false);
  const [hienMatKhau, setHienMatKhau] = useState(false);
  // Mặc định TÍCH SẴN (user chốt 2026-08-26). Hôm nay phiên vốn luôn sống 2 tuần kể cả khi
  // đóng trình duyệt, nên tích sẵn = giữ nguyên hành vi cũ, không ai bị đăng xuất bất ngờ
  // sau khi deploy. Ô tích là **lối thoát cho người cần an toàn**, không phải một rào cản
  // dựng trước mặt người bình thường.
  const [ghiNho, setGhiNho] = useState(true);

  // Trang này nằm NGOÀI khung quản trị (không `TieuDeTrang`, không sidebar), nên nó tự
  // đặt tiêu đề tab.
  useTieuDeTrang("Đăng nhập");

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
          [HEADER_GHI_NHO]: ghiNho ? "1" : "0",
        },
        body: JSON.stringify(taoThongTinDangNhap(dinh_danh, matKhau)),
      });
      if (r.ok) {
        // `window.location` chứ không phải `router.push`: cả khu quản trị treo trên
        // `GET /api/admin/me` gọi một lần lúc mount (`CongQuanTri`), và một điều hướng
        // client-side giữ nguyên cây React đã mount với kết quả 401 cũ trong state.
        //
        // `?tiep=` là chỗ cổng quản trị ghi lại trang người dùng đang đứng lúc bị đẩy ra
        // (xem `components/cong-quan-tri.tsx`). Nó đi qua `duongDanQuayLai` **bắt buộc** —
        // đó là dữ liệu trên URL, tức do người ngoài đặt được; docstring `lib/quay-lai.ts`
        // kể vì sao nhận thẳng là một open redirect mang thương hiệu gikky.
        //
        // Đọc `window.location.search` thay vì `useSearchParams()`: giá trị chỉ cần đúng
        // một lần, ngay tại đây, và `useSearchParams()` đổi lại bằng việc bắt cả cây phải
        // có `<Suspense>` bao ngoài.
        const tiep = new URLSearchParams(window.location.search).get("tiep");
        window.location.href = duongDanQuayLai(tiep);
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
            {/* `relative` + nút `absolute`: nút nằm TRONG ô nhập, nên đổi icon không đẩy
                layout một pixel nào. `pr-10` chừa chỗ để mật khẩu dài không chui xuống
                dưới con mắt. */}
            <span className="relative block">
              <input
                className="o-nhap pr-10"
                type={hienMatKhau ? "text" : "password"}
                value={matKhau}
                onChange={(e) => setMatKhau(e.target.value)}
                required
                // KHÔNG đổi theo `hienMatKhau`. Trình quản lý mật khẩu nhận diện ô theo
                // `autoComplete`; đổi nó lúc người ta bấm con mắt là ô vừa được điền tự
                // động bỗng thành một ô lạ.
                autoComplete="current-password"
                // ⚠ Ba thuộc tính này chỉ CẦN khi ô đã đổi sang `type="text"`, nhưng phải
                // khai **cố định** chứ không theo `hienMatKhau` — khai theo trạng thái là
                // React gỡ/gắn thuộc tính giữa chừng, đúng lúc người ta đang gõ.
                //
                // `type="password"` được trình duyệt miễn tự-viết-hoa; `type="text"` thì
                // KHÔNG. Trên iOS Safari mặc định là `autocapitalize="sentences"`, nên:
                // mod bấm con mắt TRƯỚC khi gõ, gõ `matkhau123`, ô nhận `Matkhau123`, và
                // màn hình báo "sai mật khẩu" cho một mật khẩu đúng. Hỏng im lặng.
                //
                // `spellCheck={false}` còn chặn mật khẩu đang hiện rõ bị gửi đi kiểm chính
                // tả (Chrome enhanced spellcheck gửi nội dung ô lên máy chủ Google).
                //
                // Lượt phản biện 2026-08-26 tìm ra.
                autoCapitalize="off"
                autoCorrect="off"
                spellCheck={false}
              />
              {/* ⚠ `type="button"` là BẮT BUỘC. Nút không ghi `type` nằm trong `<form>`
                  mặc định là `submit` (HTML spec), nên thiếu nó thì bấm xem mật khẩu =
                  gửi luôn lần đăng nhập — với mật khẩu mới gõ một nửa. Lỗi kinh điển, và
                  nó im lặng: giao diện chỉ "tự nhiên báo sai mật khẩu". */}
              <button
                type="button"
                className="absolute inset-y-0 right-0 grid w-10 place-items-center
                  text-muc-mo hover:text-muc"
                onClick={() => setHienMatKhau((truoc) => !truoc)}
                aria-label={hienMatKhau ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                aria-pressed={hienMatKhau}
                data-testid="nut-con-mat"
              >
                <Icon ten={hienMatKhau ? "an" : "hien"} />
              </button>
            </span>
          </label>

          {/* Nhãn nói ra HỆ QUẢ thật, không nói "ghi nhớ tôi" chung chung: người sắp bỏ
              tích cần biết mình đổi lấy cái gì, và câu đó phải đọc được ngay lúc tay đang
              ở trên ô tích. */}
          <label className="flex items-start gap-2 text-sm">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={ghiNho}
              onChange={(e) => setGhiNho(e.target.checked)}
              data-testid="o-ghi-nho"
            />
            <span>
              Ghi nhớ đăng nhập
              <span className="block text-xs text-muc-mo">
                Bỏ tích thì đóng trình duyệt là hết phiên.
              </span>
            </span>
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
