import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import {
  DUONG_DAN_MACH,
  HEADER_SECRET,
  ipKhach,
  nenDem,
  nenDemRequest,
  nenRewrite,
} from "../../lib/dem-luot-xem";
import { COOKIE_PHIEN, TIEN_TO_PHIEN } from "../../middleware";

const WEB = resolve(__dirname, "..", "..");
const GOC = resolve(WEB, "..", "..");
const doc = (duong: string) => readFileSync(resolve(GOC, duong), "utf8");

/** Đếm lượt xem + **hồi quy rewrite** — nhóm R của
 * `plans/2026-08-27-thong-ke-luot-xem.md` §8.
 *
 * ## Vì sao nhóm này là nhóm quan trọng nhất của cả lượt
 *
 * Trước 2026-08-27, `matcher: ["/m/:slugId"]` giữ **cả hai** trách nhiệm: chọn đường và
 * quyết định hành vi. Việc đếm lượt xem bắt buộc phải nới `matcher`, và docstring cũ của
 * `middleware.ts` cảnh báo đích danh chuyện sẽ xảy ra nếu nới ẩu: `/m/<slug>-<id>` có
 * đường con `opengraph-image`, rewrite nó sang `/m-phien/…/opengraph-image` là **404 thẻ
 * chia sẻ, và chỉ với người đã đăng nhập** — tức gần như không ai thấy khi test thủ công,
 * và một bộ e2e chạy ẩn danh sẽ xanh hết.
 *
 * Chốt ấy nay do `nenRewrite` giữ. `R3` dưới đây là bài đo canh đúng ca đó.
 *
 * ## Vì sao đo hàm thuần chứ không đo `matcher`
 *
 * `matcher` là một chuỗi đi qua `path-to-regexp` của Next — dựng lại phép so khớp ấy
 * trong bài đo là viết một bản thứ hai của `path-to-regexp`, thứ sẽ đúng cho tới lúc
 * Next đổi phiên bản. Nên hành vi sống ở hai hàm thuần, và `matcher` bị hạ xuống thành
 * bộ lọc **hiệu năng**: siết hay nới nó không đổi được kết quả của trang nào. Bài đo
 * cuối file ghim đúng ranh giới đó bằng chữ.
 */

// --- R1..R4: hồi quy rewrite -------------------------------------------------

test("R1 — `/m/abc-1` CÓ cookie ⇒ rewrite sang /m-phien/abc-1", () => {
  expect(nenRewrite("/m/abc-1", true)).toBe(true);
  // …và đích là đúng đường mà `middleware.ts` dựng. Không chép lại phép nối chuỗi ở đây:
  // đọc chính hằng để bài đo đỏ khi ai đó đổi tiền tố mà quên route.
  expect(`${TIEN_TO_PHIEN}${"/m/abc-1".slice("/m".length)}`).toBe("/m-phien/abc-1");
});

test("R2 — `/m/abc-1` KHÔNG cookie ⇒ không rewrite (khách ăn bản cache ISR)", () => {
  expect(nenRewrite("/m/abc-1", false)).toBe(false);
});

test("R3 — `/m/abc-1/opengraph-image` CÓ cookie ⇒ KHÔNG rewrite", () => {
  // Ca mà docstring cũ cảnh báo đích danh: rewrite nó là 404 thẻ chia sẻ, chỉ với người
  // đã đăng nhập. Nới `DUONG_DAN_MACH` từ `[^/]+` thành `.+` là bài này đỏ.
  expect(nenRewrite("/m/abc-1/opengraph-image", true)).toBe(false);
  expect(DUONG_DAN_MACH.test("/m/abc-1/opengraph-image")).toBe(false);
});

test("R4 — `/` CÓ cookie ⇒ không rewrite", () => {
  expect(nenRewrite("/", true)).toBe(false);
});

test("R4b — không đường nào NGOÀI `/m/<một đoạn>` được rewrite", () => {
  for (const d of [
    "/",
    "/s/chung-khoan",
    "/u/ai-do",
    "/tim-kiem",
    "/dang-nhap",
    "/m",
    "/m/",
    "/m/abc-1/revisions",
    "/m-phien/abc-1",
    "/khu-mod",
  ]) {
    expect(nenRewrite(d, true), `${d} không được rewrite`).toBe(false);
  }
});

test("R4c — nhánh rewrite CHỈ mở khi có cookie, với mọi đường mạch hợp lệ", () => {
  for (const d of ["/m/abc-1", "/m/-1234", "/m/co_gach_duoi-9", "/m/a-1"]) {
    expect(nenRewrite(d, true), `${d} + cookie ⇒ rewrite`).toBe(true);
    expect(nenRewrite(d, false), `${d} không cookie ⇒ không rewrite`).toBe(false);
  }
});

// --- R5: cái gì được đếm ----------------------------------------------------

test("R5 — mọi trang thật đều được đếm, kể cả trang mạch của cả hai nhánh", () => {
  for (const d of [
    "/",
    "/m/abc-1",
    "/m-phien/abc-1",
    "/s/chung-khoan",
    "/u/ai-do",
    "/u/nguyen.van.a",
    "/tim-kiem",
    "/luat",
    "/dang-nhap",
  ]) {
    expect(nenDem(d), `${d} phải được đếm`).toBe(true);
  }
});

test("R5b — §5.3: cái KHÔNG bao giờ được đếm", () => {
  for (const d of [
    "/api/v1/health",
    "/api/_allauth/browser/v1/auth/session",
    "/media/anh/x/y.jpg",
    "/_next/static/chunks/main.js",
    "/favicon.ico",
    "/robots.txt",
    "/sitemap.xml",
    "/feed.xml",
    "/m/abc-1/opengraph-image",
    "/opengraph-image",
    "/twitter-image",
    "/icon",
    "/apple-icon",
  ]) {
    expect(nenDem(d), `${d} KHÔNG được đếm`).toBe(false);
  }
});

test("R5c — `/u/<tên có dấu chấm>` VẪN được đếm", () => {
  // Django cho phép dấu `.` trong `username`, nên một luật "có dấu chấm ⇒ file tĩnh" áp
  // lên **cả đường dẫn** sẽ nuốt im lặng mọi lượt xem hồ sơ của những người ấy. Luật
  // đúng là "dấu chấm ở đoạn CUỐI".
  expect(nenDem("/u/nguyen.van.a")).toBe(true);
  expect(nenDem("/u/a.b/theo-doi")).toBe(true);
  // …nhưng một file thật dưới đường đó thì vẫn không được đếm.
  expect(nenDem("/u/a/anh.png")).toBe(false);
});

// --- hai bản sao bắt buộc phải khớp -----------------------------------------

test("tên header khớp ĐÚNG hằng của Django", () => {
  // Lệch một chữ thì Django trả 401 cho mọi lượt đếm và **không có gì đỏ** — số chỉ
  // đứng yên. Đọc file Python chứ không chép lại chuỗi.
  const py = doc("api/api/dem_luot_xem.py");
  const m = /^HEADER_SECRET = "([^"]+)"$/m.exec(py);
  expect(m, "không thấy `HEADER_SECRET = \"…\"` trong api/api/dem_luot_xem.py").not.toBeNull();
  expect(HEADER_SECRET).toBe(m![1]);
});

test("tên biến môi trường khớp giữa Next, Django và `scripts/web-dev.mjs`", () => {
  const TEN = "DEM_LUOT_XEM_SECRET";
  expect(doc("apps/web/lib/dem-luot-xem.ts")).toContain(`process.env.${TEN}`);
  expect(doc("api/config/settings.py")).toContain(`env("${TEN}"`);
  expect(doc("api/.env.example")).toMatch(new RegExp(`^${TEN}=`, "m"));
  // Không có dòng này thì `pnpm web:dev` chạy với secret rỗng ⇒ cửa tắt, im lặng — đúng
  // bệnh L07 mà `REVALIDATE_SECRET` đã mắc một lần.
  expect(doc("scripts/web-dev.mjs")).toContain(`"${TEN}"`);
});

// --- middleware giữ đúng ba chốt --------------------------------------------

test("middleware KHÔNG `await` lời gọi đếm — nó dùng `event.waitUntil` + `.catch`", () => {
  const mw = doc("apps/web/middleware.ts");
  expect(mw).toMatch(/event\.waitUntil\(/);
  expect(mw).toMatch(/\.catch\(\(\) => \{\}\)/);
  // Một `await demLuotXem` là mỗi trang cộng một round-trip sang Django — kể cả trang
  // đang được phục vụ từ cache ISR, tức đúng thứ cache sinh ra để tránh.
  expect(mw).not.toMatch(/await\s+demLuotXem/);
});

test("`matcher` vẫn loại ba nhóm rẻ nhất, và vẫn KHÔNG phải chỗ giữ hành vi", () => {
  const mw = doc("apps/web/middleware.ts");
  // Neo vào `export const config` chứ không grep chuỗi `matcher:` đầu tiên: docstring
  // của file ấy **nhắc lại** `matcher: ["/m/:slugId"]` để kể vì sao chốt cũ đã chuyển
  // chỗ, và một hàng rào đọc trúng chính lời giải thích của mình là một hàng rào bắt
  // người ta ngừng giải thích.
  const m = /export const config = \{[\s\S]*?matcher:\s*\[([^\]]*)\]/.exec(mw);
  expect(m, "không thấy `matcher: [...]` trong `export const config`").not.toBeNull();
  const matcher = m![1];
  for (const nhom of ["_next/", "api/", "media/"]) {
    expect(matcher, `matcher phải loại ${nhom}`).toContain(nhom);
  }
  // …và nó phải RỘNG hơn `/m/` — nếu không thì không trang nào ngoài trang mạch được đếm.
  expect(matcher).not.toMatch(/^\s*"\/m\//);
});

test("route mà middleware rewrite tới CÓ THẬT (thiếu nó ⇒ 404 cho người đăng nhập)", () => {
  expect(() => doc(`apps/web/app${TIEN_TO_PHIEN}/[slugId]/page.tsx`)).not.toThrow();
  expect(COOKIE_PHIEN).toBe("sessionid");
});

/* ===========================================================================
 * Lượt phản biện 2026-08-27 — bốn lỗi, bốn hàng rào
 * ========================================================================= */

/** ⚠ CHUÔNG cho lỗi NẶNG nhất của lượt: khoá bí mật bị ghi vào DB thống kê.
 *
 * Đọc thẳng `HEADLESS_FRONTEND_URLS` của Django và đòi `nenDem()` từ chối **mọi** URL có
 * `{key}`. Cố ý KHÔNG chép tay danh sách đường dẫn: một danh sách chép tay chính là thứ
 * đã để lọt lỗi này. Thêm một URL mang khoá bên Django mà quên `MANG_BI_MAT` ⇒ ĐỎ.
 *
 * Fail-closed: cắt không ra gì thì NÉM, không trả mảng rỗng (mảng rỗng làm bài đo đúng
 * một cách rỗng tuếch — đúng loài lỗi `ban-sao-python.spec.ts` đã dạy).
 */
function duongDanMangKhoa(): string[] {
  const nguon = doc("api/config/settings.py");
  const khoi = nguon.match(/HEADLESS_FRONTEND_URLS\s*=\s*\{([\s\S]*?)\n\}/);
  if (khoi === null) throw new Error("không cắt được HEADLESS_FRONTEND_URLS");
  const duong = [...khoi[1].matchAll(/FRONTEND_ORIGIN\}(\/[^"']*?)\{\{key\}\}/g)].map(
    (m) => m[1],
  );
  if (duong.length === 0) throw new Error("không thấy URL nào mang {key}");
  return duong;
}

test("mọi URL mang `{key}` của allauth đều KHÔNG được đếm", () => {
  const duong = duongDanMangKhoa();
  // Chống rỗng: hôm nay có đúng hai (`/xac-thuc-email/`, `/dat-lai-mat-khau/`).
  expect(duong.length).toBeGreaterThanOrEqual(2);
  for (const d of duong) {
    // Khoá thật của allauth có dạng `Nw:1wxoxp:pfQ…`, đã percent-encode trên URL.
    expect(nenDem(`${d}Nw%3A1wxoxp%3ApfQvE2hR`), d).toBe(false);
    expect(nenDem(d.replace(/\/$/, "")), d).toBe(false);
  }
});

test("cửa `/lam-moi-cache` của Django không phải một lượt xem trang", () => {
  expect(nenDem("/lam-moi-cache")).toBe(false);
});

test("regex ảnh KHÔNG nuốt trang thật kết thúc bằng `/icon`", () => {
  // Django cho phép username `icon` ⇒ `/u/icon` là một hồ sơ có thật. Bản đầu của
  // `ANH_APP_ROUTER` không neo route cha nên nó nuốt im lặng mọi lượt xem của người đó.
  expect(nenDem("/u/icon")).toBe(true);
  expect(nenDem("/s/icon")).toBe(true);
  expect(nenDem("/u/apple-icon")).toBe(true);
  // Nhưng ba route ảnh CÓ THẬT vẫn phải bị loại.
  expect(nenDem("/opengraph-image")).toBe(false);
  expect(nenDem("/m/abc-1/opengraph-image")).toBe(false);
  expect(nenDem("/s/chung-khoan/opengraph-image")).toBe(false);
});

/** `nenDemRequest` — bộ lọc theo REQUEST, tách khỏi bộ lọc theo đường dẫn. */
const req = (h: Record<string, string>, method = "GET") => ({
  method,
  headers: { get: (t: string) => h[t.toLowerCase()] ?? null },
});

test("lượt NẠP TRƯỚC của `<Link>` không phải một lượt xem", () => {
  // Không có phép kiểm này thì mở trang chủ có 20 thẻ mạch, không bấm gì, không cuộn,
  // đã sinh 20 "lượt xem" — và bảng "xem nhiều nhất" đo nhầm sang "lọt vào tầm mắt".
  expect(nenDemRequest(req({ "next-router-prefetch": "1" }))).toBe(false);
  expect(nenDemRequest(req({ purpose: "prefetch" }))).toBe(false);
  expect(nenDemRequest(req({ "sec-purpose": "prefetch;prerender" }))).toBe(false);
});

test("điều hướng RSC (bấm `<Link>`) VẪN là một lượt xem", () => {
  // Có `RSC: 1` nhưng KHÔNG có header nạp trước ⇒ người ta đang thật sự mở trang ấy.
  // Loại nó đi là mất phần lớn lượt xem của người dùng thật.
  expect(nenDemRequest(req({ rsc: "1" }))).toBe(true);
  expect(nenDemRequest(req({}))).toBe(true);
});

test("chỉ `GET` mới là một lượt xem", () => {
  for (const m of ["POST", "HEAD", "OPTIONS", "PUT"]) {
    expect(nenDemRequest(req({}, m)), m).toBe(false);
  }
});

test("middleware GỌI `nenDemRequest` — không chỉ `nenDem`", () => {
  // Hai hàm thuần đúng mà middleware quên gọi một cái thì không bài nào ở trên đỏ.
  const mw = doc("apps/web/middleware.ts");
  expect(mw).toContain("nenDemRequest(req)");
});

/* ===========================================================================
 * Lượt 2026-08-30 — IP của khách (chỉ transit) + referer
 * ========================================================================= */

const reqIp = (h: Record<string, string>) => ({
  method: "GET",
  headers: { get: (t: string) => h[t.toLowerCase()] ?? null },
});

test("X1 — `cf-connecting-ip` thắng: Cloudflare GHI ĐÈ nó ở biên, client không chen được", () => {
  expect(
    ipKhach(reqIp({ "cf-connecting-ip": "203.0.113.7", "x-forwarded-for": "9.9.9.9, 1.1.1.1" })),
  ).toBe("203.0.113.7");
  expect(ipKhach(reqIp({ "cf-connecting-ip": "  203.0.113.7  " }))).toBe("203.0.113.7");
});

test("X1b — XFF lấy phần tử CUỐI: phần đầu là thứ client tự khai và GIẢ ĐƯỢC", () => {
  // Proxy NỐI peer nó thấy vào CUỐI danh sách; phần đầu là do client gửi lên. Bản đầu
  // của lượt 2026-08-30 lấy `[0]`, tức `curl -H "X-Forwarded-For: 9.9.$i.$j"` bơm được
  // mười nghìn "khách" vĩnh viễn vào `KhachNgay` không cần secret — lượt phản biện tìm
  // ra. Cùng luật với `api/core/han_muc.py::dia_chi_ip` (cũng lấy phần tử cuối).
  expect(ipKhach(reqIp({ "x-forwarded-for": "9.9.9.9, 203.0.113.7" }))).toBe("203.0.113.7");
  expect(ipKhach(reqIp({ "x-forwarded-for": "  203.0.113.7  " }))).toBe("203.0.113.7");
});

test("X1c — không header nào ⇒ chuỗi rỗng; XFF rỗng hay chỉ dấu phẩy cũng vậy", () => {
  // Dev: không proxy nào ⇒ rỗng ⇒ Django băm UA-only. Thô hơn, và đó là đánh đổi đã ghi.
  // (`x-real-ip` từng là fallback và là NHÁNH CHẾT — không Caddyfile nào đặt nó; đã gỡ.)
  expect(ipKhach(reqIp({}))).toBe("");
  expect(ipKhach(reqIp({ "x-forwarded-for": "" }))).toBe("");
  expect(ipKhach(reqIp({ "x-forwarded-for": "  ,  " }))).toBe("");
  expect(ipKhach(reqIp({ "x-real-ip": "198.51.100.9" }))).toBe("");
});

test("X2 — middleware GỬI `ip` và `referer` trong thân request", () => {
  // Hai hàm thuần đúng mà middleware quên nối vào thân thì không bài nào ở trên đỏ: cửa
  // đếm vẫn 200, và hai cột mới lặng lẽ rỗng vĩnh viễn trên prod.
  const mw = doc("apps/web/middleware.ts");
  expect(mw).toContain("ip: ipKhach(req)");
  expect(mw).toMatch(/referer:\s*req\.headers\.get\("referer"\)\s*\?\?\s*""/);
});

test("X3 — Django nhận `ip`/`referer` là trường CÓ MẶC ĐỊNH (deploy lệch)", () => {
  // Deploy không nguyên tử: vài phút Django mới chạy cạnh middleware CŨ (2 trường). Bắt
  // buộc hai trường mới là mọi lượt xem trong cửa sổ ấy trả 422 và **biến mất im lặng**,
  // vì middleware `.catch(() => {})` nuốt hết lỗi. Đọc thẳng schema Python.
  const py = doc("api/api/dem_luot_xem.py");
  expect(py).toMatch(/^\s{4}ip: str = ""$/m);
  expect(py).toMatch(/^\s{4}referer: str = ""$/m);
  expect(py).toMatch(/^\s{4}user_agent: str = ""$/m);
});
