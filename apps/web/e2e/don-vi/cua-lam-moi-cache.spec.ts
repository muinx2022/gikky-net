import { expect, test } from "@playwright/test";

import { POST } from "../../app/lam-moi-cache/route";
import { HEADER_SECRET } from "../../lib/lam-moi-cache";

/** Nhánh **TỪ CHỐI** của cửa `/lam-moi-cache` — L23, lượt vá V1.
 *
 * Trước lượt vá, cửa này có đúng một bài đo và nó đo nhánh THÀNH CÔNG
 * (`e2e/phase-3.spec.ts::P10`, chạy thật cả vòng Django → Next). Ba nhánh từ chối —
 * secret rỗng ⇒ 503, secret sai ⇒ 401, đường dẫn ngoài allowlist ⇒ 400 — thì không bài
 * nào đòi. Nghĩa là **đảo một dấu `!`** ở `route.ts` biến nó thành một cửa ai cũng gọi
 * được để ép Next đi fetch lại bất kỳ trang mạch nào, và cả bộ test vẫn xanh.
 *
 * ## Vì sao ở `don-vi` chứ không ở bộ e2e chạy thật
 *
 * Nhánh 503 **không dựng được** trên server thật của bộ e2e: `playwright.config.ts` truyền
 * `REVALIDATE_SECRET` cho tiến trình Next đúng để cửa BẬT. Đo nó đòi một tiến trình thứ hai
 * dựng riêng cho một bài đo — đắt hơn hẳn thứ nó mua. Ở đây gọi thẳng handler đã export,
 * tức vẫn là **đúng đoạn code đang chạy trên prod**, chỉ không đi qua vòng HTTP.
 *
 * Đổi lại, `route.ts` phải đọc `process.env` **mỗi request** thay vì chụp vào một hằng
 * tầng module — xem `lib/lam-moi-cache.ts::secretCuaCua`. Đó là thay đổi mà bài đo này
 * đòi, và nó được ghi ra chứ không giấu đi.
 *
 * Nhánh THÀNH CÔNG cố ý **không** có mặt ở đây: nó gọi `revalidatePath`, thứ chỉ chạy
 * trong ngữ cảnh request của Next. Nó đã có bài đo chạy thật ở `phase-3.spec.ts::P10`.
 */

const SECRET = "bi-mat-chi-dung-trong-bai-do";
const DUONG_DAN = "/m/nhat-ky-hpg-1234";

function req(than: unknown, header?: string): Request {
  return new Request("http://localhost:3000/lam-moi-cache", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(header === undefined ? {} : { [HEADER_SECRET]: header }),
    },
    body: typeof than === "string" ? than : JSON.stringify(than),
  });
}

test.beforeEach(() => {
  process.env.REVALIDATE_SECRET = SECRET;
});

test.afterEach(() => {
  delete process.env.REVALIDATE_SECRET;
});

test("secret RỖNG ⇒ 503, cửa tắt hẳn (fail-closed), không phải 'cho qua tất'", async () => {
  delete process.env.REVALIDATE_SECRET;
  const r = await POST(req({ duong_dan: DUONG_DAN }, SECRET));
  expect(r.status).toBe(503);
});

test("secret SAI ⇒ 401", async () => {
  const r = await POST(req({ duong_dan: DUONG_DAN }, "doan-bua"));
  expect(r.status).toBe(401);
});

test("KHÔNG kèm header secret ⇒ 401", async () => {
  const r = await POST(req({ duong_dan: DUONG_DAN }));
  expect(r.status).toBe(401);
});

test("401 không nói secret sai ở chỗ nào", async () => {
  const r = await POST(req({ duong_dan: DUONG_DAN }, "doan-bua"));
  const than = JSON.stringify(await r.json());
  expect(than).not.toContain(SECRET);
  expect(than).not.toContain("doan-bua");
});

test("thân không phải JSON ⇒ 400, không phải 500", async () => {
  const r = await POST(req("{khong-phai-json", SECRET));
  expect(r.status).toBe(400);
});

test("đường dẫn ngoài allowlist ⇒ 400", async () => {
  for (const xau of ["/", "/u/ai-do", "/m/khong-co-so", "../etc", 42, null]) {
    const r = await POST(req({ duong_dan: xau }, SECRET));
    expect(r.status, `đường dẫn ${JSON.stringify(xau)} phải bị từ chối`).toBe(400);
  }
});

test("thứ tự kiểm: secret RỖNG thắng cả secret sai lẫn đường dẫn rác", async () => {
  // Ghim rằng cổng fail-closed đứng TRƯỚC mọi phép kiểm khác. Nếu ai đó dời nó xuống dưới,
  // một cửa chưa cấu hình sẽ trả 400/401 — mã nói "yêu cầu của bạn sai" thay vì "cửa này
  // đang tắt", và người đi debug sẽ đi sửa đúng chỗ không hỏng.
  delete process.env.REVALIDATE_SECRET;
  const r = await POST(req({ duong_dan: "/khong-hop-le" }, "doan-bua"));
  expect(r.status).toBe(503);
});
