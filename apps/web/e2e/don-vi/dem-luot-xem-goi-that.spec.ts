import { createServer, type IncomingMessage, type Server } from "node:http";
import { type AddressInfo } from "node:net";
import { expect, test } from "@playwright/test";

import { demLuotXem } from "@gikky/api-client";

import { HEADER_SECRET } from "../../lib/dem-luot-xem";

/** Lời gọi đếm lượt xem có THẬT SỰ mang thân request đi không.
 *
 * ## Vì sao nhóm này phải tồn tại, dù `dem-luot-xem.spec.ts` đã rất kỹ
 *
 * File kia đo **hàm thuần** (`nenDem`, `nenRewrite`, `nenDemRequest`) và **đọc mã nguồn**
 * (tên header khớp Django, `matcher` loại đúng ba nhóm, middleware không `await`). Cả hai
 * tầng ấy đều xanh trong khi tính năng **không chạy một lượt nào trên prod** — vì cái hỏng
 * nằm ở tầng thứ ba mà không tầng nào chạm tới: *lời gọi có mang `body` đi không*.
 *
 * Đo được, 2026-08-28 trên prod: middleware CÓ gọi Django, header secret CÓ tới nơi (secret
 * sai ra 401, còn đây ra 400), nhưng Django trả
 * `{"detail": "Tham số không hợp lệ (body.du_lieu: Field required)."}` — tức **thân rỗng**.
 * Bảng `LuotXem` đứng ở 0 hàng suốt.
 *
 * ## Vì sao dựng server thật chứ không mock `fetch`
 *
 * Mock `fetch` là đo lại chính giả định đang sai. Cái cần biết là **byte nào thật sự lên
 * đường**, nên bài đo mở một HTTP server trên cổng **0** (hệ điều hành tự cấp cổng rảnh —
 * nhóm `don-vi` phải an toàn khi chạy song song, không được chiếm cổng cố định) và đọc
 * nguyên văn thân request nhận được.
 *
 * ## Giới hạn thành thật của bài đo này
 *
 * Nó chạy trên **Node**, còn `middleware.ts` chạy trên **edge runtime**. Nếu lỗi chỉ xuất
 * hiện ở edge thì bài này xanh mà prod vẫn hỏng. Nó vẫn đáng có: nó khoanh vùng được câu
 * hỏi "lỗi ở hình dạng lời gọi hay ở runtime" — và đó là hai hướng sửa hoàn toàn khác nhau.
 */

/** Server thu lại request cuối cùng nhận được. */
function moServer(): Promise<{
  server: Server;
  goc: string;
  nhan: () => { than: string; headers: IncomingMessage["headers"] } | null;
}> {
  let cuoi: { than: string; headers: IncomingMessage["headers"] } | null = null;
  const server = createServer((req, res) => {
    const khuc: Buffer[] = [];
    req.on("data", (c: Buffer) => khuc.push(c));
    req.on("end", () => {
      cuoi = { than: Buffer.concat(khuc).toString("utf8"), headers: req.headers };
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ da_dem: true }));
    });
  });
  return new Promise((ok) => {
    // Cổng 0 = xin hệ điều hành một cổng rảnh. Ghim một số cố định ở đây là biến nhóm
    // `don-vi` thành thứ không chạy song song được — đúng cái `pnpm e2e:don-vi` hứa.
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      ok({ server, goc: `http://127.0.0.1:${port}`, nhan: () => cuoi });
    });
  });
}

// ⚠ **Tên hàm client KHÔNG được xuất hiện trong chuỗi** (tiêu đề bài đo, thông báo lỗi).
// `type-frontend.spec.ts` có luật `GOI_QUA_BIEN`: nhắc tên một hàm API ở chỗ không phải
// lời gọi trực tiếp là vi phạm — vì alias qua biến làm phân tích tĩnh mù, và luật ấy không
// phân biệt được "alias" với "nhắc trong chuỗi". Cùng lý do repo đã ghép
// `const XEM_MACH = "xem" + "Mach"` ở chính file luật đó.
test("G1 — lời gọi đếm lượt xem gửi ĐÚNG cái thân JSON mà Django đòi", async () => {
  const { server, goc, nhan } = await moServer();
  try {
    await demLuotXem({
      // Gọi Y HỆT `middleware.ts:104` — cùng ba tuỳ chọn, cùng thứ tự.
      baseUrl: goc,
      headers: { [HEADER_SECRET]: "secret-cua-bai-do" },
      body: { duong_dan: "/m/abc-1", user_agent: "bai-do" },
    });
  } finally {
    server.close();
  }

  const r = nhan();
  expect(r, "server không nhận được request nào").not.toBeNull();

  // ⚠ Đây là dòng bắt được lỗi của prod. Thân rỗng ⇒ Django trả
  // "body.du_lieu: Field required" và không hàng `LuotXem` nào được ghi.
  expect(r!.than, "thân request RỖNG — đúng lỗi đã thấy trên prod").not.toBe("");

  expect(JSON.parse(r!.than)).toEqual({
    duong_dan: "/m/abc-1",
    user_agent: "bai-do",
  });
});

test("G2 — header secret đi kèm, và đúng tên hằng dùng chung với Django", async () => {
  const { server, goc, nhan } = await moServer();
  try {
    await demLuotXem({
      baseUrl: goc,
      headers: { [HEADER_SECRET]: "secret-cua-bai-do" },
      body: { duong_dan: "/m/abc-1", user_agent: "bai-do" },
    });
  } finally {
    server.close();
  }

  // Node hạ tên header về chữ thường; so sánh cũng phải hạ, nếu không bài đo đỏ vì một
  // lý do không liên quan gì tới thứ nó định đo.
  expect(nhan()!.headers[HEADER_SECRET.toLowerCase()]).toBe("secret-cua-bai-do");
});
