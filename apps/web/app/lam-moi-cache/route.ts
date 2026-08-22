/** Cửa nhận on-demand revalidate từ Django — PLAN 8.4 điểm 3.
 *
 * Chiều gọi: `core/revalidate.py` (Django) → `POST http://localhost:3000/lam-moi-cache`.
 * Đọc bốn chốt của cơ chế ở docstring module đó trước khi sửa file này.
 *
 * ## Vì sao đường này KHÔNG nằm dưới `/api/`
 *
 * `next.config.ts` rewrite `/api/:path*` sang Django, và trên prod Caddy làm điều tương tự
 * (PLAN 8.2). Một route handler ở `/api/revalidate` sẽ **chạy ở dev** — route trong hệ
 * thống file thắng `rewrites` của `afterFiles` — rồi **chết trên prod**, nơi Caddy nuốt
 * request trước khi Next thấy nó. Đúng loài lỗi chỉ lộ ra sau khi deploy.
 *
 * ## Trạng thái THẬT hôm nay: cửa này đúng nhưng CHƯA làm được gì
 *
 * `app/m/[slugId]/page.tsx` còn khai `export const dynamic = "force-dynamic"`, nên trang
 * mạch không có bản cache nào để làm mới và `revalidatePath` ở dưới là một **no-op** —
 * nó trả 200 và không xảy ra chuyện gì. Đừng đọc "200 OK" thành "ISR đang chạy".
 *
 * Đó là nợ có tên **`ISR-BIEN-THE-ROUTE`** (`plans/2026-08-23-mang-b1-backend-phase-3.md`
 * §5): cơ chế đủ của PLAN 8.4 cần tách trang mạch thành hai biến thể route (khách không
 * cookie ăn ISR · có cookie thì dynamic no-store) cộng một `middleware.ts` chọn nhánh.
 * Việc đó sửa `page.tsx`, và file này được viết trong lượt BACKEND chạy song song với một
 * lượt frontend đang giữ đúng file ấy — nên nửa Django + cửa nhận làm trước, phần tách
 * biến thể để lượt sau. Gỡ nợ = bỏ `force-dynamic`, thêm `export const revalidate = 3600`,
 * dựng hai biến thể; lúc đó file này bắt đầu có tác dụng mà không phải sửa dòng nào.
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

/** Header mang secret. **Không dùng query string**: query nằm lại trong access log của
 * hai tầng proxy, tức secret bị ghi ra đĩa dạng thô ở hai chỗ, vĩnh viễn. */
const HEADER_SECRET = "x-revalidate-secret";

/** Rỗng ⇒ cửa TẮT (503), không phải "cho qua tất". Mặc định fail-closed là bắt buộc ở đây:
 * một biến môi trường quên đặt trên prod không được biến endpoint này thành một cửa ai
 * cũng gọi được để ép Next đi fetch lại bất kỳ đường dẫn nào. */
const SECRET = process.env.REVALIDATE_SECRET ?? "";

/** Chỉ nhận đường dẫn trang mạch `/m/<slug>-<id>`.
 *
 * Allowlist bằng regex chứ không nhận đường dẫn tự do: `revalidatePath` nhận bất cứ chuỗi
 * nào, nên một cửa không lọc là một cách bắt Next dựng lại **mọi** trang theo yêu cầu của
 * người gọi — kể cả khi họ chỉ đoán đúng secret một lần. Django hôm nay chỉ gửi đúng dạng
 * này (`core/revalidate.py::lam_moi_mach`); thêm dạng khác thì mở rộng ở đây, có ý thức.
 */
const DUONG_DAN_HOP_LE = /^\/m\/[a-z0-9-]+-\d+$/;

export async function POST(req: Request) {
  if (!SECRET) {
    return NextResponse.json(
      { loi: "REVALIDATE_SECRET chưa đặt — cửa làm mới cache đang tắt." },
      { status: 503 },
    );
  }
  if (req.headers.get(HEADER_SECRET) !== SECRET) {
    // 401 trần, không nói secret sai ở chỗ nào.
    return NextResponse.json({ loi: "sai secret" }, { status: 401 });
  }

  let duong_dan: unknown;
  try {
    ({ duong_dan } = await req.json());
  } catch {
    return NextResponse.json({ loi: "thân request không phải JSON" }, { status: 400 });
  }

  if (typeof duong_dan !== "string" || !DUONG_DAN_HOP_LE.test(duong_dan)) {
    return NextResponse.json(
      { loi: `đường dẫn không thuộc allowlist: ${String(duong_dan)}` },
      { status: 400 },
    );
  }

  revalidatePath(duong_dan);
  return NextResponse.json({ da_lam_moi: duong_dan });
}
