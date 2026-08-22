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
 * ## Cửa này ĐÃ có tác dụng thật từ 2026-08-23 (mảng B2)
 *
 * Nợ `ISR-BIEN-THE-ROUTE` đã trả: `app/m/[slugId]/page.tsx` bỏ `force-dynamic`, khai
 * `revalidate = 3600`, và `middleware.ts` tách hai biến thể route. Từ đó `revalidatePath`
 * dưới đây **thật sự** vứt bản cache của trang mạch — trước lượt ấy nó trả 200 và không
 * xảy ra chuyện gì (đừng đọc "200 OK" thành "ISR đang chạy" — câu ấy đã đúng suốt một
 * phase).
 *
 * Ghim bằng bài đo chạy thật: `e2e/phase-3.spec.ts::P10` nối một mốc rồi đòi trang KHÁCH
 * hiện nó ra — cả đường Django → luồng nền → cửa này → data cache của Next.
 *
 * ## Hai hằng của cửa nằm ở `lib/lam-moi-cache.ts`, không ở đây
 *
 * Next **cấm Route Handler export bất cứ tên nào ngoài danh sách nó biết**; thêm một
 * `export const DUONG_DAN_HOP_LE` vào file này làm `next build` đỏ với *"Type 'RegExp' is
 * not assignable to type 'never'"*. Tách sang `lib/` để bài đo import được đúng cái regex
 * đang chạy, thay vì chép một bản thứ hai.
 */
import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { DUONG_DAN_HOP_LE, HEADER_SECRET } from "@/lib/lam-moi-cache";

/** Rỗng ⇒ cửa TẮT (503), không phải "cho qua tất". Mặc định fail-closed là bắt buộc ở đây:
 * một biến môi trường quên đặt trên prod không được biến endpoint này thành một cửa ai
 * cũng gọi được để ép Next đi fetch lại bất kỳ đường dẫn nào. */
const SECRET = process.env.REVALIDATE_SECRET ?? "";

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
