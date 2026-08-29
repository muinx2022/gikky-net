// Cửa duy nhất của `apps/admin` nói chuyện với `/api/admin/*`.
//
// **Không có `client` singleton nào ở đây, và không được có** (CLAUDE.md, PLAN 8.3).
// `@gikky/api-client/admin` cố ý không xuất `client`; mọi lời gọi truyền `baseUrl` theo
// từng lần. Hàng rào chạy được cho luật này: `apps/web/e2e/don-vi/type-admin.spec.ts`.
//
// **`baseUrl: ""` là same-origin, không phải "quên điền".** Trình duyệt gọi đường tương
// đối `/api/admin/...`; ở dev `next.config.ts` rewrite sang Django, ở prod là Caddy
// (PLAN 8.2). Gọi thẳng `http://localhost:8000` từ trình duyệt thì cookie session không
// đi kèm — đó là cross-origin — nên hằng dưới đây phải là chuỗi rỗng, không phải một URL.

/** Origin cho mọi lời gọi từ TRÌNH DUYỆT. Xem khối trên trước khi đổi. */
export const GOC_API = "";

/** Tên cookie CSRF của Django (`CSRF_COOKIE_NAME` mặc định). */
const COOKIE_CSRF = "csrftoken";

/**
 * Token CSRF đọc từ cookie, hoặc chuỗi rỗng khi chưa có.
 *
 * Cookie ấy do `GET /api/admin/me` gieo (`get_token` trong `api/quan_tri.py`), nên
 * `CongQuanTri` gọi `/me` trước mọi thứ khác. Không có bước đó thì nút bấm ĐẦU TIÊN của
 * mỗi phiên ăn 403 — một lỗi chỉ xuất hiện ở lần bấm đầu, tức lỗi khó tin nhất.
 */
export function docCsrf(): string {
  const khop = document.cookie.match(new RegExp(`(?:^|; )${COOKIE_CSRF}=([^;]*)`));
  return khop ? decodeURIComponent(khop[1]) : "";
}

/** Header cho mọi request GHI. Django so nó với cookie; thiếu là 403 `csrf_that_bai`. */
export function headerGhi(): Record<string, string> {
  return { "X-CSRFToken": docCsrf() };
}

/** Gốc URLconf của allauth headless (Mảng A / Phase 2). Đường TƯƠNG ĐỐI — same-origin. */
export const GOC_ALLAUTH = "/api/_allauth/browser/v1";

/**
 * Đảm bảo có cookie `csrftoken` cho **khách chưa đăng nhập**, trả về giá trị của nó.
 *
 * `docCsrf()` ở trên đủ cho mọi trang SAU khi đã vào được khu quản trị: `CongQuanTri` gọi
 * `GET /api/admin/me` và Django gieo cookie ở đó. Trang đăng nhập thì **không** dùng được
 * đường ấy — `/me` đòi `is_staff`, tức chính thứ khách chưa đăng nhập không có, nên nó trả
 * 401/403 và không ai gieo cookie. Không có cookie thì `POST /auth/login` ăn 403 CSRF, mà
 * 403 CSRF trông y hệt "sai mật khẩu" nếu không đọc `code`.
 *
 * `GET /auth/session` của allauth là lời gọi rẻ nhất gieo được cookie: allauth chạy
 * `get_token(request)` cho MỌI view của client `browser`. Cùng cách làm với
 * `apps/web/lib/tai-khoan.ts::baoDamCsrf` — hai app Next tách biệt, không có package
 * chung cho tầng này, nên đây là bản thứ hai có chủ đích chứ không phải sót.
 */
export async function baoDamCsrf(): Promise<string> {
  const co = docCsrf();
  if (co !== "") return co;
  await fetch(`${GOC_ALLAUTH}/auth/session`, { credentials: "same-origin" });
  return docCsrf();
}

/**
 * Đóng phiên đăng nhập hiện tại (`DELETE /auth/session` của allauth headless).
 *
 * ⚠ **allauth trả 401 cho một lượt DELETE THÀNH CÔNG.** Đó không phải lỗi và cũng không
 * phải quirk cần né: hợp đồng headless nói response của mọi endpoint auth mô tả *trạng
 * thái phiên sau lời gọi*, mà trạng thái sau khi thoát đúng là "không có phiên" — tức
 * 401. Viết `if (!r.ok) throw` trần ở đây là báo "đăng xuất thất bại" cho mọi lượt đăng
 * xuất THÀNH CÔNG, và mod sẽ bấm lại lần thứ hai, thứ ba.
 *
 * Nhưng lập luận ấy dừng ở đúng 401. **403 (CSRF) hay 5xx là phiên VẪN CÒN SỐNG**: nuốt
 * chúng rồi đưa mod ra trang đăng nhập là mod rời máy chung trong lúc cookie session còn
 * hiệu lực — người ngồi xuống sau gõ `/machs` là vào thẳng khu quản trị bằng danh tính
 * mod đó, và không có gì trên màn hình nào nói khác. Nên: chấp nhận `r.ok` và `401`,
 * mọi mã khác NÉM — cùng hợp đồng với bản của mặt tiền
 * (`apps/web/lib/tai-khoan.ts::goi`, cờ `chapNhan401`).
 *
 * Không đi qua client sinh từ OpenAPI vì allauth không nằm trong `NinjaAPI` nào — cùng lý
 * do đã ghi ở `app/dang-nhap/page.tsx`.
 */
export async function thoatPhien(): Promise<void> {
  const r = await fetch(`${GOC_ALLAUTH}/auth/session`, {
    method: "DELETE",
    credentials: "same-origin",
    headers: { "X-CSRFToken": docCsrf() },
  });
  if (!r.ok && r.status !== 401) {
    throw new Error(`Đăng xuất chưa xong — máy chủ trả HTTP ${r.status}.`);
  }
}

/** Hình dạng lỗi `{detail, code}` của PLAN mục 7 — kiểu ở đây là **kiểu THU HẸP**, không
 * phải bản khai lại: `LoiOut` sinh từ OpenAPI cho phép mọi chuỗi `code`, còn hàm dưới chỉ
 * cần biết "object này có mang hai trường đó không" để in ra màn hình. */
function laLoiCoHinhDang(x: unknown): x is { detail: string; code: string } {
  return (
    typeof x === "object" &&
    x !== null &&
    typeof (x as { detail?: unknown }).detail === "string" &&
    typeof (x as { code?: unknown }).code === "string"
  );
}

/**
 * Câu tiếng Việt cho một lỗi bất kỳ của client sinh từ OpenAPI.
 *
 * Ba nguồn lỗi khác nhau và cách sửa của chúng khác hẳn nhau, nên chúng phải phân biệt
 * được trên màn hình:
 * - `{detail, code}` — server trả lỗi có hợp đồng;
 * - `Error` không kèm response — fetch chết trước khi có HTTP (Django chưa chạy, sai cổng);
 * - còn lại — thứ không ai lường; in nguyên văn còn hơn nuốt.
 */
export function moTaLoi(loi: unknown): string {
  if (laLoiCoHinhDang(loi)) return `${loi.detail} (${loi.code})`;
  if (loi instanceof Error) return `${loi.name}: ${loi.message}`;
  return typeof loi === "string" ? loi : JSON.stringify(loi);
}

/** `code` của một lỗi có hợp đồng, hoặc `null`. Dùng để nhận ra 401 mà hiện màn đăng nhập. */
export function maLoi(loi: unknown): string | null {
  return laLoiCoHinhDang(loi) ? loi.code : null;
}

/** Mã lỗi khu quản trị mà UI phải xử riêng — chép từ `api/loi.py` và `config/host_admin.py`.
 *
 * Đây **không** phải bản khai lại một schema (PLAN 8.3 cấm chuyện đó): `code` là chuỗi tự
 * do trong `LoiOut`, không có `enum` nào trong `openapi.admin.json` để suy ra. Ba hằng này
 * là ba nhánh MÀN HÌNH, và chúng phải đổi cùng lúc với Python — không có hàng rào tự động,
 * nên chúng nằm cạnh nhau ở đúng một chỗ để người sửa nhìn thấy cả ba.
 */
export const MA_CHUA_DANG_NHAP = "chua_dang_nhap";
export const MA_KHONG_DU_QUYEN = "khong_du_quyen";
export const MA_SAI_HOST = "sai_host_quan_tri";
