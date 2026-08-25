/** Cửa DUY NHẤT của `apps/web` nói chuyện với **allauth headless** — PLAN mục 7, 8.2.
 *
 * Vì sao không đi qua `@gikky/api-client` như mọi lời gọi khác: allauth mount URLconf của
 * chính nó ở `/api/_allauth/`, **ngoài** `NinjaAPI` — nên nó không có mặt trong
 * `openapi.json` và không có hàm TS nào được sinh ra cho nó. Luật "type một chiều"
 * (PLAN 8.3) cấm frontend khai lại kiểu **của API v1**; ở đây không có kiểu nào để khai
 * lại, chỉ có một hợp đồng HTTP của thư viện bên thứ ba. Gom nó vào một file là cách gần
 * nhất với tinh thần đó: đúng một chỗ biết đường dẫn, đúng một chỗ biết hình dạng lỗi.
 *
 * **CSRF là phần không được cắt.** Django kiểm mọi POST/PATCH/DELETE bằng cặp
 * cookie `csrftoken` + header `X-CSRFToken` (PLAN 8.2 — "không JWT" trả giá bằng CSRF).
 * Cookie ấy do allauth đặt trên **mọi** phản hồi của client `browser`, nên `bảoĐảmCsrf()`
 * dưới đây chỉ cần một `GET /auth/session` là có. Thiếu bước đó thì lần POST đầu tiên
 * của một khách mới ăn 403 — và 403 CSRF trông y hệt 403 phân quyền nếu không đọc `code`.
 */

/** Gốc của API. Chuỗi rỗng = same-origin, đi qua `rewrites` trong `next.config.ts`.
 *
 * Phải là same-origin chứ không phải `API_ORIGIN`: cookie phiên và cookie CSRF là cookie
 * của **origin đang mở**, và một lời gọi thẳng sang `localhost:8000` từ trình duyệt là
 * cross-origin — cookie không đi kèm, mà nếu có đi kèm thì cũng là một origin thứ hai
 * phải khai vào `CSRF_TRUSTED_ORIGINS`. Đường same-origin đã có sẵn ở cả dev (rewrites)
 * lẫn prod (Caddy — PLAN 8.2).
 */
export const GOC_TRINH_DUYET = "";

const ALLAUTH = "/api/_allauth/browser/v1";

/** Lỗi từ allauth hoặc từ API v1, đã kéo về một hình dạng đọc được cho UI. */
export class LoiTaiKhoan extends Error {
  constructor(
    readonly trangThai: number,
    /** Câu tiếng Việt hiện cho người dùng. */
    message: string,
    /** Lỗi theo TỪNG trường (allauth trả `param`), để form bôi đỏ đúng ô. */
    readonly theoTruong: Readonly<Record<string, string>> = {},
  ) {
    super(message);
    this.name = "LoiTaiKhoan";
  }
}

/** Đọc một cookie. `null` khi không có hoặc khi đang chạy ở server. */
function cookie(ten: string): string | null {
  if (typeof document === "undefined") return null;
  const m = document.cookie.match(new RegExp(`(^|;\\s*)${ten}=([^;]*)`));
  return m === null ? null : decodeURIComponent(m[2]);
}

/** Đảm bảo có cookie `csrftoken`, trả về giá trị của nó.
 *
 * `GET /auth/session` là lời gọi rẻ nhất đạt được việc đó: allauth gọi `get_token(request)`
 * cho **mọi** view của client `browser` (`allauth/headless/internal/decorators.py`), nên
 * phản hồi luôn kèm cookie. Nó cũng là lời gọi ta cần cho `/me` gián tiếp, nên không phí.
 */
export async function baoDamCsrf(): Promise<string> {
  const co = cookie("csrftoken");
  if (co !== null) return co;
  await fetch(`${ALLAUTH}/auth/session`, { credentials: "same-origin" });
  return cookie("csrftoken") ?? "";
}

/** Header cho một request GHI bất kỳ (allauth **và** API v1). */
export async function headerGhi(): Promise<Record<string, string>> {
  return {
    "Content-Type": "application/json",
    "X-CSRFToken": await baoDamCsrf(),
  };
}

/** Header cho một request ghi **multipart** (upload ảnh — Phase 5). CSRF, không hơn.
 *
 * Tách khỏi `headerGhi` vì đúng một dòng, và dòng ấy phá: `Content-Type:
 * application/json` đè lên header mà `FormData` phải tự đặt, và `FormData` cần đặt
 * `multipart/form-data; boundary=…` với một boundary **ngẫu nhiên sinh lúc gửi**. Ghi đè
 * nó là server nhận một thân không parse được — Django trả 400 hoặc thấy `file` rỗng, và
 * thông báo lỗi không chỉ được về phía header.
 *
 * (Client sinh từ OpenAPI đã đặt `'Content-Type': null` cho cửa multipart để `fetch` tự
 * điền. Truyền `headerGhi()` vào là ghi đè đúng cái `null` đó.)
 */
export async function headerGhiFile(): Promise<Record<string, string>> {
  return { "X-CSRFToken": await baoDamCsrf() };
}

type ThanLoi = {
  errors?: { message?: string; param?: string; code?: string }[];
  detail?: string;
  code?: string;
};

/** Gọi một endpoint allauth. Ném `LoiTaiKhoan` khi hỏng.
 *
 * ⚠ **401 KHÔNG phải lúc nào cũng là lỗi.** Nhóm `/auth/*` của allauth trả
 * `AuthenticationResponse`: 200 khi phiên đã đăng nhập, **401 kèm `flows`** khi chưa —
 * và "chưa" là trạng thái đúng ngay sau khi đăng ký (còn chờ xác thực email) hay sau khi
 * đặt lại mật khẩu. Người gọi quyết định 401 có phải lỗi hay không qua `chapNhan401`;
 * mặc định là **có**, vì với `login` thì 401 đúng là sai mật khẩu.
 */
async function goi(
  duong: string,
  {
    method = "POST",
    than,
    chapNhan401 = false,
  }: { method?: string; than?: unknown; chapNhan401?: boolean } = {},
): Promise<{ trangThai: number; du_lieu: unknown }> {
  const r = await fetch(`${ALLAUTH}${duong}`, {
    method,
    credentials: "same-origin",
    headers: await headerGhi(),
    body: than === undefined ? undefined : JSON.stringify(than),
  });
  const du_lieu: unknown = await r.json().catch(() => null);
  if (r.ok || (r.status === 401 && chapNhan401)) {
    return { trangThai: r.status, du_lieu };
  }
  throw loiTu(r.status, du_lieu);
}

function loiTu(trangThai: number, du_lieu: unknown): LoiTaiKhoan {
  const than = (du_lieu ?? {}) as ThanLoi;
  const theoTruong: Record<string, string> = {};
  for (const e of than.errors ?? []) {
    if (e.param !== undefined && e.message !== undefined) theoTruong[e.param] = e.message;
  }
  const dau = than.errors?.[0]?.message ?? than.detail;
  return new LoiTaiKhoan(trangThai, dau ?? MAC_DINH[trangThai] ?? MAC_DINH.khac, theoTruong);
}

/** Câu tiếng Việt cho những mã mà allauth không kèm thông điệp nào đọc được.
 *
 * allauth cố ý trả thông điệp tiếng Anh ngắn gọn (adapter của nó ghi rõ "i18n không phải
 * vấn đề vì những lỗi này không nên hiện ra UI"), nên chỗ nào nó không nói gì thì UI phải
 * tự nói — im lặng ở form đăng nhập là kiểu hỏng người dùng bấm lại ba lần rồi bỏ đi.
 */
const MAC_DINH: Record<string | number, string> = {
  400: "Dữ liệu chưa hợp lệ — xem lại các ô phía trên.",
  401: "Email hoặc mật khẩu không đúng.",
  403: "Yêu cầu bị từ chối. Tải lại trang rồi thử lại.",
  409: "Bạn đang đăng nhập rồi.",
  429: "Bạn thử hơi nhiều lần. Đợi một lát rồi thử lại.",
  khac: "Có lỗi xảy ra. Thử lại sau ít phút.",
};

// --- các luồng ---------------------------------------------------------------

/** Đăng ký. **Trả về `false` khi tài khoản còn chờ xác thực email** (401 + `flows`).
 *
 * Xác thực email là bắt buộc ở gikky, nên `false` là kết quả BÌNH THƯỜNG của một lần đăng
 * ký thành công — không phải lỗi. Trang đăng ký đọc nó để hiện "kiểm tra hộp thư" thay vì
 * điều hướng vào trong.
 */
export async function dangKy(du_lieu: {
  email: string;
  username: string;
  password: string;
}): Promise<boolean> {
  const { trangThai } = await goi("/auth/signup", { than: du_lieu, chapNhan401: true });
  return trangThai === 200;
}

/** Đăng nhập bằng **email hoặc username**.
 *
 * Nhận credential **đã chọn khoá** (`{email,…}` hoặc `{username,…}`) chứ không nhận một
 * chuỗi rồi tự đoán: allauth đếm credential theo khoá có mặt trong body và đòi đúng một,
 * nên chỗ quyết định phải là MỘT chỗ — `lib/dang-nhap.ts::taoThongTinDangNhap`.
 */
export async function dangNhap(
  du_lieu:
    | { email: string; password: string }
    | { username: string; password: string },
): Promise<void> {
  await goi("/auth/login", { than: du_lieu });
}

export async function dangXuat(): Promise<void> {
  // allauth trả 401 cho `DELETE /auth/session` — đó là "phiên nay không còn xác thực",
  // tức là **đúng cái ta vừa xin**. Coi nó là lỗi thì nút đăng xuất luôn hiện lỗi đỏ
  // ngay sau khi làm xong việc của nó.
  await goi("/auth/session", { method: "DELETE", chapNhan401: true });
}

export async function xacThucEmail(key: string): Promise<void> {
  await goi("/auth/email/verify", { than: { key }, chapNhan401: true });
}

export async function xinDatLaiMatKhau(email: string): Promise<void> {
  await goi("/auth/password/request", { than: { email } });
}

export async function datLaiMatKhau(key: string, password: string): Promise<void> {
  await goi("/auth/password/reset", { than: { key, password }, chapNhan401: true });
}

export async function doiMatKhau(cu: string, moi: string): Promise<void> {
  await goi("/account/password/change", {
    than: { current_password: cu, new_password: moi },
  });
}
