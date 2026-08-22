import { NextResponse, type NextRequest } from "next/server";

/** Chọn biến thể route cho trang mạch — PLAN 8.4 điểm 1.
 *
 * ```
 * không cookie phiên → /m/<slug>-<id>         (ISR 1 giờ — bot, khách)
 * có cookie phiên    → /m-phien/<slug>-<id>   (dynamic no-store, rewrite NỘI BỘ)
 * ```
 *
 * ## Vì sao phải là hai route
 *
 * App Router hễ đọc `cookies()` là **cả route** thành dynamic, nên "cùng route, khách ăn
 * cache, người đăng nhập ăn dynamic" không tồn tại. Middleware chạy TRƯỚC cache nên nó là
 * chỗ duy nhất còn rẽ nhánh được.
 *
 * ## Nó chỉ nhìn cookie CÓ MẶT hay không — không validate
 *
 * Cố ý, và PLAN viết đúng chữ *"kiểm tra **sự tồn tại** của session cookie (không
 * validate)"*. Middleware chạy trên edge runtime, không có DB; validate ở đây nghĩa là
 * thêm một round-trip sang Django cho **mọi** request tới trang mạch, kể cả của bot.
 *
 * Hệ quả, và nó vô hại: một cookie `sessionid` đã hết hạn vẫn đẩy người ta sang nhánh
 * dynamic. Họ nhận đúng nội dung ấy, chỉ là không có bản cache — chậm hơn một chút, không
 * sai một chữ nào. Chiều ngược lại mới nguy hiểm, và nó không xảy ra được: không có cookie
 * thì không có gì per-user để lộ, vì **cả hai biến thể đều gọi Django không kèm cookie**
 * (`components/trang-mach.tsx`).
 *
 * ## ⚠ Ba thứ phải giữ cùng nhau, hỏng một là hỏng cả
 *
 * 1. **`app/m-phien/[slugId]/page.tsx` phải tồn tại.** File này một mình thì tệ hơn không
 *    có: nó rewrite sang một route không có ⇒ trang mạch **404 với đúng người đã đăng
 *    nhập**, và một bộ e2e chạy ẩn danh sẽ xanh hết.
 * 2. **`matcher` chỉ một đoạn đường dẫn** (`/m/:slugId`, không `:path*`). `/m/<slug>-<id>`
 *    còn có con dưới: `opengraph-image`. Rewrite nó sang `/m-phien/…/opengraph-image` là
 *    404 cho thẻ chia sẻ — mà chỉ với người đăng nhập, tức gần như không ai thấy khi test.
 * 3. **Tên cookie phải khớp Django.** `SESSION_COOKIE_NAME` mặc định là `sessionid`
 *    (`api/config/settings.py` không đổi nó). Gõ sai tên thì middleware thành no-op im
 *    lặng: mọi người ăn bản cache, và "vừa nối mốc mà không thấy mốc đâu" là một lỗi
 *    người ta sẽ đổ cho Django.
 */

/** Cookie phiên của Django (`SESSION_COOKIE_NAME` mặc định). Đổi bên Django thì đổi ở đây
 * — có chuông: `e2e/don-vi/cache-mach.spec.ts` đọc `api/config/settings.py`. */
export const COOKIE_PHIEN = "sessionid";

/** Tiền tố của biến thể dynamic. Không nằm dưới `/m/` để nó không lọt vào `matcher`. */
export const TIEN_TO_PHIEN = "/m-phien";

export function middleware(req: NextRequest) {
  if (!req.cookies.has(COOKIE_PHIEN)) return NextResponse.next();
  const url = req.nextUrl.clone();
  url.pathname = `${TIEN_TO_PHIEN}${url.pathname.slice("/m".length)}`;
  return NextResponse.rewrite(url);
}

export const config = {
  // MỘT đoạn, không `:path*` — xem chốt 2 ở docstring.
  matcher: ["/m/:slugId"],
};
