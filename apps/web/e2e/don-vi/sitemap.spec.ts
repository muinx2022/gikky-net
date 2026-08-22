import type { FeedOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { LoiTranTrang, duyetFeedTheoTrang } from "../../lib/sitemap";

/** Nợ #11 — **sitemap chạm trần thì KÊU, không im lặng cắt phần còn lại.**
 *
 * Bản 1c `break` khi hết vòng: XML vẫn hợp lệ, HTTP vẫn 200, chỉ thiếu mọi mạch từ URL
 * thứ 2001. Với sản phẩm sống bằng index (PLAN mục 1) đó là mất traffic vĩnh viễn mà
 * không ai thấy — cùng loài hỏng mà vá F1 vừa diệt ở chỗ `docFeed` trả `null`.
 *
 * Bài đo chạy trên một `nap` giả, không cần mạng và không cần Django.
 */

function trang(items: number, cursor: string | null): FeedOut {
  return {
    items: Array.from({ length: items }, (_, i) => ({ id: i }) as FeedOut["items"][0]),
    cursor_ke_tiep: cursor,
  };
}

test("#11 — hết cursor trước trần thì trả đủ items, không ném", async () => {
  const goi: (string | undefined)[] = [];
  const items = await duyetFeedTheoTrang(async (c) => {
    goi.push(c);
    return goi.length < 3 ? trang(2, `c${goi.length}`) : trang(1, null);
  }, 40);
  expect(items).toHaveLength(5);
  expect(goi).toEqual([undefined, "c1", "c2"]);
});

test("#11 — chạm trần mà API còn cursor thì NÉM LoiTranTrang", async () => {
  // Mutant giết được bài này: đổi `throw` thành `return ra` ⇒ hàm trả 6 URL và im lặng.
  await expect(
    duyetFeedTheoTrang(async () => trang(2, "con-nua"), 3),
  ).rejects.toThrow(LoiTranTrang);
});

test("#11 — thông báo nói ra CẢ trần lẫn số URL đã gom", async () => {
  // Không có hai con số đó thì người đọc log biết "sitemap hỏng" nhưng không biết nó
  // hỏng ở đâu, và cách chữa (tách sitemap index) không tự hiện ra.
  let loi: LoiTranTrang | null = null;
  try {
    await duyetFeedTheoTrang(async () => trang(50, "con-nua"), 40);
  } catch (e) {
    loi = e as LoiTranTrang;
  }
  expect(loi).toBeInstanceOf(LoiTranTrang);
  if (loi === null) return;
  expect(loi.tranTrang).toBe(40);
  expect(loi.soUrl).toBe(2000);
  expect(loi.message).toContain("40");
  expect(loi.message).toContain("2000");
  expect(loi.message).toContain("sitemap index");
});

test("#11 — trần đúng bằng số lần gọi, không hơn không kém", async () => {
  let lan = 0;
  await duyetFeedTheoTrang(async () => {
    lan += 1;
    return trang(1, "con-nua");
  }, 4).catch(() => {});
  expect(lan).toBe(4);
});

test("#11 — feed rỗng ngay trang đầu là chuyện bình thường, không ném", async () => {
  expect(await duyetFeedTheoTrang(async () => trang(0, null), 40)).toEqual([]);
});
