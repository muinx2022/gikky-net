import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";

import { demLuotXem } from "@gikky/api-client";

import { API_ORIGIN } from "@/lib/api";
import {
  HEADER_SECRET,
  ipKhach,
  nenDem,
  nenDemRequest,
  nenRewrite,
  secretDem,
} from "@/lib/dem-luot-xem";

/** Middleware của site công khai — **hai việc**, và chúng cố ý không dính vào nhau.
 *
 * ```
 * 1. ĐẾM lượt xem   → mọi trang (2026-08-27)
 * 2. REWRITE biến thể route trang mạch → chỉ /m/<slug>-<id> có cookie (PLAN 8.4 điểm 1)
 * ```
 *
 * ## Vì sao lượt xem đếm ở ĐÂY chứ không ở Django
 *
 * Trang là của Next; Django chỉ phục vụ `/api/*`. Một middleware Django sẽ đếm **API
 * call**, không phải lượt xem — một con số trông như thật mà sai hoàn toàn. Hai tính
 * chất của chỗ này làm việc đếm khả thi, và **cả hai phải giữ**:
 *
 * - middleware chạy **TRƯỚC cache ISR** (xem mục dưới) ⇒ vẫn thấy request kể cả khi
 *   trang được phục vụ từ bản cache. Đếm ở tầng React component thì mất sạch lượt cache;
 * - middleware chạy **trên máy chủ** ⇒ thấy cả bot. Bot không chạy JavaScript, nên mọi
 *   cách đếm bằng script phía trình duyệt đều **không trả lời được** nửa câu hỏi
 *   ("bao nhiêu bot vào, những bot nào").
 *
 * ## ⚠ Lời gọi đếm KHÔNG được `await`
 *
 * `event.waitUntil(...)` — tiến trình sống cho tới khi promise xong, nhưng **response đi
 * ngay**. Một lượt `await` là mỗi trang của site cộng thêm một round-trip sang Django,
 * kể cả trang đang được phục vụ từ cache ISR, tức đúng thứ cache sinh ra để tránh.
 *
 * Và `.catch(() => {})`: Django chết thì site vẫn phải phục vụ trang. Thống kê hỏng là
 * phiền; trang chủ 500 vì thống kê hỏng là hỏng sản phẩm.
 *
 * ## Chọn biến thể route cho trang mạch — PLAN 8.4 điểm 1
 *
 * ```
 * không cookie phiên → /m/<slug>-<id>         (ISR 1 giờ — bot, khách)
 * có cookie phiên    → /m-phien/<slug>-<id>   (dynamic no-store, rewrite NỘI BỘ)
 * ```
 *
 * ### Vì sao phải là hai route
 *
 * App Router hễ đọc `cookies()` là **cả route** thành dynamic, nên "cùng route, khách ăn
 * cache, người đăng nhập ăn dynamic" không tồn tại. Middleware chạy TRƯỚC cache nên nó là
 * chỗ duy nhất còn rẽ nhánh được.
 *
 * ### Nó chỉ nhìn cookie CÓ MẶT hay không — không validate
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
 * 2. **Điều kiện rewrite chỉ khớp MỘT đoạn đường dẫn.** `/m/<slug>-<id>` còn có con dưới:
 *    `opengraph-image`. Rewrite nó sang `/m-phien/…/opengraph-image` là 404 cho thẻ chia
 *    sẻ — mà chỉ với người đăng nhập, tức gần như không ai thấy khi test.
 *
 *    ⚠ **Chốt này TRƯỚC 2026-08-27 do `matcher` giữ** (`matcher: ["/m/:slugId"]`, một
 *    đoạn, không `:path*`). Việc đếm lượt xem **bắt buộc phải nới `matcher`**, nên chốt
 *    ấy đã **chuyển chỗ**: nay nó nằm ở `lib/dem-luot-xem.ts::nenRewrite` +
 *    `DUONG_DAN_MACH` (`/^\/m\/[^/]+$/`), một hàm thuần có bài đo
 *    (`e2e/don-vi/dem-luot-xem.spec.ts`, ca R3 canh đúng `opengraph-image`).
 *    `matcher` nay chỉ còn là bộ lọc **hiệu năng** — siết hay nới nó không đổi được hành
 *    vi của trang nào. Đọc docstring `lib/dem-luot-xem.ts` trước khi sửa một trong hai.
 * 3. **Tên cookie phải khớp Django.** `SESSION_COOKIE_NAME` mặc định là `sessionid`
 *    (`api/config/settings.py` không đổi nó). Gõ sai tên thì nhánh rewrite thành no-op im
 *    lặng: mọi người ăn bản cache, và "vừa nối mốc mà không thấy mốc đâu" là một lỗi
 *    người ta sẽ đổ cho Django.
 */

/** Cookie phiên của Django (`SESSION_COOKIE_NAME` mặc định). Đổi bên Django thì đổi ở đây
 * — có chuông: `e2e/don-vi/cache-mach.spec.ts` đọc `api/config/settings.py`. */
export const COOKIE_PHIEN = "sessionid";

/** Tiền tố của biến thể dynamic. Không nằm dưới `/m/` để nó không lọt vào `matcher`. */
export const TIEN_TO_PHIEN = "/m-phien";

export function middleware(req: NextRequest, event: NextFetchEvent) {
  const duong_dan = req.nextUrl.pathname;

  // MỘT phép đọc cookie cho CẢ HAI việc của middleware. Nhánh rewrite đã cần nó từ
  // trước; ô "Online" chỉ chuyển tiếp đúng cái bit ấy sang Django (2026-08-31), không
  // thêm một phép đọc nào. Hai lời gọi `req.cookies.has(...)` trong cùng một request
  // không sai, nhưng chúng là hai chỗ để một lượt sửa đổi một bên — mà lệch nhau thì
  // "đã đăng nhập" trên modal và nhánh dynamic của trang mạch nói ngược nhau.
  const co_cookie_phien = req.cookies.has(COOKIE_PHIEN);

  const secret = secretDem();
  if (secret !== "" && nenDemRequest(req) && nenDem(duong_dan)) {
    // KHÔNG `await` — xem docstring. `waitUntil` giữ tiến trình sống cho lời gọi, còn
    // response thì đi ngay.
    event.waitUntil(
      demLuotXem({
        baseUrl: API_ORIGIN,
        headers: { [HEADER_SECRET]: secret },
        body: {
          // `pathname` thôi — **không** query string. Django cắt lần nữa ở đầu bên kia
          // (`chuan_hoa_duong_dan`), nhưng gửi sạch từ đây là để secret không bao giờ
          // đi cạnh một chuỗi có `?` trong log của bất kỳ tầng nào.
          duong_dan,
          // User-Agent được **gửi để phân loại** (`api/core/bot.py`) và **không được
          // lưu**. Phân loại ở Django vì bảng bot cần một chỗ duy nhất và cần `pytest`
          // chấm được; edge runtime thì không.
          user_agent: req.headers.get("user-agent") ?? "",
          // IP: **chỉ transit** — Django băm nó với muối của ngày rồi vứt, không có cột
          // nào nhận nó. Xem `ipKhach` và `api/api/dem_luot_xem.py::hash_khach`.
          ip: ipKhach(req),
          // Referer thô: Django giữ **đúng tên miền** (`chuan_hoa_nguon`). Gửi cả URL từ
          // đây là có chủ đích — phép cắt sống ở một chỗ, cùng chỗ với danh sách host của
          // site, thay vì hai bản có thể lệch.
          referer: req.headers.get("referer") ?? "",
          // ⚠ Nghĩa CHÍNH XÁC: *request có mang cookie tên `sessionid`*. **Không**
          // validate — edge runtime không có DB, đúng đánh đổi mà nhánh rewrite ngay
          // dưới đã chấp nhận từ trước. Hệ quả: cookie hết hạn vẫn đếm là "đã đăng
          // nhập", và modal `/luot-xem` phải nói ra chứ không giấu.
          //
          // ⚠ Đây là MỘT BIT, không phải một danh tính: không username, không `user_id`,
          // không gì gắn hàng `LuotXem` với một con người. Cam kết ấy là lý do trang
          // thống kê không cần banner cookie — xem `api/core/models/luot_xem.py`.
          da_dang_nhap: co_cookie_phien,
        },
      }).catch(() => {}),
    );
  }

  if (!nenRewrite(duong_dan, co_cookie_phien)) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = `${TIEN_TO_PHIEN}${duong_dan.slice("/m".length)}`;
  return NextResponse.rewrite(url);
}

export const config = {
  /** Bộ lọc **hiệu năng**, không phải bộ lọc đúng/sai — xem chốt 2 ở docstring.
   *
   * Loại đúng ba nhóm đông nhất và rẻ nhất để loại: `/_next/*` (mỗi trang kéo hàng chục
   * file), `/api/*` và `/media/*` (rewrite sang Django, không phải trang). Ba nhóm ấy là
   * gần như toàn bộ lưu lượng không-phải-trang.
   *
   * **Cố ý KHÔNG loại "mọi đường có dấu chấm" ở đây.** Luật ấy ngắn nhưng nuốt luôn
   * `/u/nguyen.van.a` — Django cho phép dấu `.` trong `username` — và nuốt ở tầng
   * `matcher` thì middleware **không chạy**, tức `nenDem()` không có cơ hội nói khác.
   * File tĩnh do `nenDem()` loại bằng một danh sách đuôi tường minh; `apps/web` hôm nay
   * không có `public/` nên tập ấy chỉ là `/robots.txt`, `/sitemap.xml`, `/feed.xml`.
   */
  matcher: ["/((?!_next/|api/|media/).*)"],
};
