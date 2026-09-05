/** Hai quyết định của `middleware.ts`, tách ra thành **hàm thuần để ĐO ĐƯỢC**.
 *
 * Middleware chạy trên edge runtime: không có bộ đo nào chạy được nó trực tiếp, và
 * `matcher` của nó là một chuỗi đi qua `path-to-regexp` của Next chứ không phải một
 * `RegExp` ta cầm được. Nên hai câu hỏi thật sự quan trọng — *"đường này có được đếm
 * không"* và *"đường này có được rewrite không"* — nằm ở đây, dưới dạng hàm thuần mà
 * `e2e/don-vi/dem-luot-xem.spec.ts` gọi thẳng.
 *
 * ## ⚠ `matcher` là bộ lọc HIỆU NĂNG, không phải bộ lọc ĐÚNG/SAI
 *
 * Đây là chốt quan trọng nhất của file này. Trước lượt 2026-08-27, `matcher` là
 * `["/m/:slugId"]` và nó vừa chọn đường vừa quyết định hành vi — nên **nới nó là đổi
 * hành vi**, và docstring của `middleware.ts` cảnh báo đích danh rằng nới thành `:path*`
 * sẽ rewrite luôn `/m/<slug>-<id>/opengraph-image` ⇒ **404 thẻ chia sẻ, chỉ với người đã
 * đăng nhập**, tức gần như không ai thấy khi test.
 *
 * Việc đếm lượt xem **bắt buộc phải nới** `matcher` (đếm mọi trang). Nên hai trách nhiệm
 * tách hẳn ra:
 *
 * ```
 * matcher rộng            → chỉ để middleware ĐƯỢC GỌI (và để khỏi gọi trên /_next/*)
 * nenDem(pathname)        → có đếm không
 * nenRewrite(path, cookie)→ có rewrite không   ← giữ NGUYÊN ngữ nghĩa cũ
 * ```
 *
 * Hệ quả: siết hay nới `matcher` không đổi được kết quả của trang nào — cùng lắm là
 * middleware chạy thừa (tốn) hoặc không chạy (mất lượt đếm). Còn hành vi thì có hai hàm
 * dưới đây giữ, và cả hai có bài đo.
 */

/** Header mang secret. **Bản thứ hai** của `api/api/dem_luot_xem.py::HEADER_SECRET`.
 *
 * Hai tiến trình, hai ngôn ngữ, không có package chung cho tầng này — nên bản sao là bắt
 * buộc, không phải cẩu thả. Cái không bắt buộc là để chúng lệch nhau:
 * `e2e/don-vi/dem-luot-xem.spec.ts` đọc cả hai file và đỏ nếu chuỗi khác nhau. Lệch một
 * chữ thì Django trả 401 cho mọi lượt đếm, và **không có gì đỏ** — số chỉ đứng yên.
 */
export const HEADER_SECRET = "X-Dem-Luot-Xem-Secret";

/** Trang mạch **một đoạn**: `/m/<slug>-<id>`, không có đường con.
 *
 * `[^/]+` là toàn bộ điểm của biểu thức này. `/m/abc-1/opengraph-image` có dấu `/` thứ
 * ba nên nó **không khớp**, và đó chính là ca mà docstring cũ của `middleware.ts` cảnh
 * báo. Đừng nới thành `.+`.
 */
export const DUONG_DAN_MACH = /^\/m\/[^/]+$/;

/** Phần mở rộng của file tĩnh — **danh sách TƯỜNG MINH, không phải "có dấu chấm"**.
 *
 * Luật "đoạn cuối có dấu chấm ⇒ file tĩnh" ngắn hơn và **sai theo hướng tệ nhất**:
 * Django cho phép dấu `.` trong `username`, nên `/u/nguyen.van.a` là một hồ sơ có thật,
 * và luật ấy nuốt im lặng mọi lượt xem của những người đó. Bảng dưới đây sai theo hướng
 * ngược lại — quên một đuôi thì một tài nguyên tĩnh bị đếm thừa, thấy ngay trên bảng
 * "xem nhiều nhất" và sửa bằng một dòng.
 *
 * Hôm nay `apps/web` **không có thư mục `public/`**; tập file tĩnh thật sự chỉ có
 * `/robots.txt`, `/sitemap.xml`, `/feed.xml`. Bảng rộng hơn thế là để đón lượt sau.
 */
const DUOI_TINH =
  /\.(?:ico|txt|xml|json|webmanifest|png|jpe?g|gif|svg|webp|avif|css|js|map|woff2?|ttf|otf|pdf)$/i;

/** ⚠ Đường dẫn mang **BÍ MẬT trên chính path**. Đếm chúng là ghi credential vào DB.
 *
 * `settings.HEADLESS_FRONTEND_URLS` đặt khoá của allauth **vào đường dẫn**, không vào
 * query:
 *
 *     account_confirm_email           → /xac-thuc-email/{key}
 *     account_reset_password_from_key → /dat-lai-mat-khau/{key}
 *
 * Ba lý do phải chặn, và lý do thứ ba mới là lý do phá thẳng mục tiêu tính năng:
 *
 * 1. **Khoá còn sống.** Ai đọc được bảng — DB, bản sao lưu, một `pg_dump` gửi qua chat —
 *    trong hạn khoá thì đặt lại được mật khẩu của tài khoản đó.
 * 2. Hàng thô sống 90 ngày, nhưng `gom_luot_xem` chuyển nó sang `TongNgay` — **giữ mãi**.
 *    Tức nó sống lâu hơn cả hạn user đã chốt.
 * 3. **Khoá của allauth mở đầu bằng user PK mã base36.** Nên mỗi dòng như thế đọc ra là
 *    *"user #N mở trang đặt lại mật khẩu lúc 14:32"* — đúng thứ mà docstring của
 *    `core/models/luot_xem.py` và trang `/luot-xem` khẳng định là KHÔNG tồn tại
 *    ("không có gì gắn được với một con người"). Để lọt là câu ấy thành nói dối.
 *
 * ⚠ **Có chuông**: `e2e/don-vi/dem-luot-xem.spec.ts` đọc thẳng `api/config/settings.py`,
 * cắt mọi `HEADLESS_FRONTEND_URLS` có `{key}`, và đòi `nenDem()` trả `false` cho từng cái.
 * Thêm một URL mang khoá bên Django mà quên đây ⇒ ĐỎ. Đừng thay chuông ấy bằng một danh
 * sách chép tay — danh sách chép tay là thứ đã để lọt lỗi này ngay từ đầu.
 *
 * Lượt phản biện 2026-08-27 tìm ra.
 */
const MANG_BI_MAT = /^\/(?:dat-lai-mat-khau|xac-thuc-email)(?:\/|$)/;

/** Ảnh sinh động của App Router — **neo vào đúng route cha có thật**.
 *
 * Hôm nay chỉ có ba: `/opengraph-image`, `/m/<slugId>/opengraph-image`,
 * `/s/<sub>/opengraph-image` (`find apps/web/app -name "opengraph-image*"`).
 *
 * ⚠ Bản đầu viết `/\/(?:…|icon|…)$/` **không neo cha**, nên nó nuốt **bất kỳ** đường nào
 * kết thúc bằng `/icon` — kể cả `/u/icon`, hồ sơ của một người có username là `icon`
 * (Django cho phép). Lượt xem của họ biến mất im lặng. Đúng loài lỗi mà `DUOI_TINH` được
 * viết cẩn thận để tránh, chỉ khác cửa vào. Lượt phản biện 2026-08-27 tìm ra.
 */
const ANH_APP_ROUTER =
  /^\/(?:m|s)\/[^/]+\/(?:opengraph-image|twitter-image|icon|apple-icon)(?:-[^/]*)?$|^\/(?:opengraph-image|twitter-image|icon|apple-icon)(?:-[^/]*)?$/;

/** Đuôi file script / mã nguồn / config / scanner rác từ internet. */
const DUOI_SCRIPT_RAC =
  /\.(?:php\d?|phtml|asp|aspx|jsp|cgi|pl|env|git|ya?ml|ini|conf|sql|sh|bak|old|swp|rar|zip|tar|gz|7z)$/i;

/** Tiền tố của các bot quét lỗ hổng WordPress, config, server. */
const SCANNER_RAC =
  /^\/(?:wp[-_]|wordpress|\.env|\.git|xmlrpc|phpmyadmin|actuator|cgi-bin|autodiscover|\.well-known)/i;

/** Đường dẫn KHÔNG bao giờ được đếm là một lượt xem trang.
 *
 * Bảy nhóm, bảy lý do khác nhau:
 *
 * 1. `/_next/`, `/api/`, `/media/` — không phải trang. `matcher` cũng loại chúng, nhưng
 *    luật đúng/sai sống ở đây (xem docstring module);
 * 2. **mang bí mật** (`MANG_BI_MAT`) — đếm là ghi credential vào DB. Nhóm nguy hiểm nhất;
 * 3. `/lam-moi-cache` — lời gọi máy-với-máy của Django, không phải người đọc trang;
 * 4. **file tĩnh** — theo `DUOI_TINH`, một danh sách đuôi tường minh chứ không phải
 *    "có dấu chấm". Lý do ở docstring của hằng ấy;
 * 5. **ảnh sinh động của App Router** (`ANH_APP_ROUTER`). Chúng KHÔNG có phần mở rộng nên
 *    nhóm 4 không bắt được, và chúng là thứ bot mạng xã hội tải mỗi lần ai đó dán link —
 *    đếm chúng là nhân đôi mọi lượt chia sẻ thành hai dòng trong bảng "xem nhiều nhất";
 * 6. **file script / scanner rác** (`DUOI_SCRIPT_RAC`) — bot quét `.php`, `.asp`, `.env`...
 *    không phải trang của site;
 * 7. **tiền tố quét lỗ hổng** (`SCANNER_RAC`) — `/wp-login.php`, `/wp-admin`, `/xmlrpc.php`...
 *
 * ⚠ Đây là bộ lọc theo **đường dẫn**. Bộ lọc theo **request** (prefetch, method) nằm ở
 * `nenDemRequest` cuối file — hai câu hỏi khác nhau, đừng gộp.
 */
const KHONG_DEM = [
  /^\/(?:_next|api|media)(?:\/|$)/,
  MANG_BI_MAT,
  // Cửa Django gọi sang Next để xoá cache (`settings.REVALIDATE_URL`). Nó là một lời gọi
  // máy-với-máy, không phải ai đó đọc một trang — mà nó chạy MỖI LẦN có người nối mốc,
  // trích, hay đóng sổ. Không chặn thì trên site sôi động nó leo lên top 3 của bảng
  // "xem nhiều nhất". Lượt phản biện 2026-08-27 tìm ra.
  /^\/lam-moi-cache(?:\/|$)/,
  DUOI_TINH,
  ANH_APP_ROUTER,
  DUOI_SCRIPT_RAC,
  SCANNER_RAC,
];

/** Các mẫu đường dẫn công khai hợp lệ của Gikky.
 *
 * Site công khai có một tập route xác định:
 * - Trang chủ `/`
 * - Mạch `/m/<slugId>` và biến thể dynamic `/m-phien/<slugId>`
 * - Diễn đàn con `/s/<subSlug>`
 * - Hồ sơ người dùng `/u/<username>` (và các trang con dưới `/u/`)
 * - Các trang tĩnh: cai-dat, chan-doan, dang-ky, dang-mach, dang-nhap, doi-mat-khau,
 *   khu-mod, luat, quen-mat-khau, sua-ho-so, tim-kiem.
 *
 * Mọi đường dẫn lạ không khớp cấu trúc trên (vd bot scan gõ URL linh tinh) đều bị loại.
 */
export const DUONG_DAN_HOP_LE = [
  /^\/$/,
  /^\/(?:m|m-phien)\/[^/]+\/?$/,
  /^\/s\/[^/]+\/?$/,
  /^\/u\/[^/]+(?:\/[^/]+)*\/?$/,
  /^\/(?:cai-dat|chan-doan|dang-ky|dang-mach|dang-nhap|doi-mat-khau|khu-mod|luat|quen-mat-khau|sua-ho-so|tim-kiem)\/?$/,
];

/** Có đếm đường dẫn này không. Chỉ nhận `pathname`, **không** nhận query string. */
export function nenDem(pathname: string): boolean {
  if (KHONG_DEM.some((r) => r.test(pathname))) return false;
  return DUONG_DAN_HOP_LE.some((r) => r.test(pathname));
}

/** Có rewrite sang biến thể `/m-phien/…` không.
 *
 * **Ngữ nghĩa phải y hệt bản trước 2026-08-27**: đúng một đoạn dưới `/m/`, **và** có
 * cookie phiên. Bất kỳ cách viết nào khác là hồi quy — và là loại hồi quy chỉ người đã
 * đăng nhập nhìn thấy, tức gần như không ai báo.
 */
export function nenRewrite(pathname: string, coCookiePhien: boolean): boolean {
  return coCookiePhien && DUONG_DAN_MACH.test(pathname);
}

/** Secret của cửa đếm, đọc **tại thời điểm gọi**. Rỗng ⇒ không gọi Django lần nào.
 *
 * Rỗng là trạng thái MẶC ĐỊNH của máy dev, và nó phải im lặng: một lượt fetch thừa trên
 * **mỗi trang** của mỗi lập trình viên là cái giá không ai xin. Django cũng fail-closed
 * ở đầu bên kia (503) — hai lớp, cùng một mặc định.
 *
 * ⚠ **Đây là edge runtime: Next NỘI TUYẾN `process.env.X` lúc BUILD**, khác hẳn
 * `lib/lam-moi-cache.ts::secretCuaCua()` (route handler, chạy trên node, đọc lúc chạy).
 * Nghĩa là trên prod biến này phải có mặt **khi `next build` chạy**, không phải chỉ khi
 * `next start` chạy. Đặt nó sau lúc build thì cửa đếm im lặng tắt.
 *
 * Ai cấp biến này cho tiến trình Next ở dev: `scripts/web-dev.mjs` (đọc `api/.env`, cùng
 * chuỗi với Django).
 */
export function secretDem(): string {
  return process.env.DEM_LUOT_XEM_SECRET ?? "";
}

/** IP của khách — **chỉ để Django băm rồi vứt**, không bao giờ được lưu.
 *
 * ## ⚠ Phần tử ĐẦU của `x-forwarded-for` là thứ client TỰ KHAI — không được đọc nó
 *
 * Mỗi proxy NỐI THÊM peer nó nhìn thấy vào **cuối** danh sách; phần đầu chuỗi là do
 * client gửi lên và giả được bằng một dòng header. Bản đầu của lượt 2026-08-30 lấy `[0]`
 * — tức một vòng `curl -H "X-Forwarded-For: 9.9.$i.$j" https://gikky.net/` bơm được
 * mười nghìn "khách" **vĩnh viễn** vào `KhachNgay`, không cần secret, không một dòng
 * log (lượt phản biện 2026-08-30 tìm ra). Repo đã có đúng luật này từ trước ở
 * `api/core/han_muc.py::dia_chi_ip` — phần tử CUỐI; hai chỗ nay cùng một chiều.
 *
 * Thứ tự đọc, và vì sao:
 *
 * 1. `cf-connecting-ip` — Cloudflare **ghi đè** header này ở biên bằng IP thật của
 *    client, nên nó là nguồn đúng nhất trên prod; snippet `len_django` của Caddyfile
 *    cũng tin đúng header này cho Django. Ai gọi thẳng origin không qua Cloudflare thì
 *    giả được — cùng mức tin cậy mà `han_muc.py` đã chấp nhận.
 * 2. `x-forwarded-for` phần tử **CUỐI** — peer mà proxy gần nhất (Caddy) thật sự nhìn
 *    thấy. Sau Cloudflare mà thiếu (1) thì phần tử cuối là IP biên của Cloudflare:
 *    nhiều người chung một "khách", tức đếm THIẾU — chiều hỏng an toàn, ngược hẳn với
 *    `[0]` (bơm được vô hạn, đếm THỪA).
 * 3. `""` — dev không có proxy nào: hash rơi về UA-only, "khách" ở dev thô hơn ở prod.
 *    Chấp nhận — dựng một IP giả ở dev là làm số liệu dev trông đúng mà không đo gì cả.
 *
 * (`x-real-ip` từng là fallback ở đây và là NHÁNH CHẾT: không Caddyfile nào trong
 * `deploy/` đặt nó. Một fallback không bao giờ chạy ở prod chỉ nuôi một bài đo về một
 * hệ không tồn tại — đã gỡ.)
 *
 * Không dùng cho phân quyền, không log, không lưu: giá trị này đi thẳng vào thân request
 * rồi vào `sha256` ở Django. Xem `api/api/dem_luot_xem.py::hash_khach`.
 */
export function ipKhach(req: { headers: { get(ten: string): string | null } }): string {
  const cf = req.headers.get("cf-connecting-ip");
  if (cf !== null && cf.trim() !== "") return cf.trim();
  const xff = req.headers.get("x-forwarded-for");
  if (xff !== null) {
    const cac = xff
      .split(",")
      .map((p) => p.trim())
      .filter((p) => p !== "");
    if (cac.length > 0) return cac[cac.length - 1];
  }
  return "";
}

/** Header mà Next/trình duyệt gắn cho một lượt **nạp trước**, không phải một lượt xem. */
const HEADER_PREFETCH = ["next-router-prefetch", "purpose", "sec-purpose"];

/** Request này có phải một lượt XEM thật không — xét ở tầng header, không phải đường dẫn.
 *
 * ## ⚠ Không có phép kiểm này thì MỌI con số thổi phồng, và không ai biết
 *
 * `<Link>` của Next mặc định **nạp trước toàn bộ** một route tĩnh/ISR ngay khi link lọt
 * vào viewport — mà `app/m/[slugId]/page.tsx` khai `revalidate = 3600`, tức đúng loại
 * route ấy, và `<Link>` được dùng ở 20+ component.
 *
 * Hệ quả nếu đếm cả prefetch: một người mở trang chủ có 20 thẻ mạch, **không bấm gì,
 * không cuộn**, đã sinh 20 dòng "lượt xem". Rồi `/dang-nhap`, `/luat`, `/s/<sub>` nằm
 * trong nav của MỌI trang nên được nạp trước trên mọi lượt tải ⇒ chúng leo lên đầu bảng
 * "Xem nhiều nhất". Bấm vào thì được đếm **lần thứ hai**.
 *
 * Bảng ấy khi đó đo *"thẻ này lọt vào tầm mắt bao nhiêu lần"*, không phải *"bài này được
 * đọc bao nhiêu lần"* — mà đó đúng là một trong bốn câu người đặt hàng hỏi. Sai vài trăm
 * phần trăm, HTTP 200, không log. Lượt phản biện 2026-08-27 tìm ra.
 *
 * ## Điều hướng RSC thì VẪN đếm — có chủ đích
 *
 * Bấm một `<Link>` sinh request có `RSC: 1` nhưng **không** có `next-router-prefetch`.
 * Đó là một lượt xem thật (người ta đang mở trang ấy), chỉ khác là khung không tải lại.
 * Loại nó đi là mất phần lớn lượt xem của người dùng thật.
 *
 * ## Chỉ `GET`
 *
 * `POST`/`HEAD`/`OPTIONS` tới một đường trang không phải người đọc trang.
 */
export function nenDemRequest(req: {
  method: string;
  headers: { get(ten: string): string | null };
}): boolean {
  if (req.method !== "GET") return false;
  return !HEADER_PREFETCH.some((h) => {
    const v = req.headers.get(h);
    return v !== null && (v === "1" || v.toLowerCase().includes("prefetch"));
  });
}
