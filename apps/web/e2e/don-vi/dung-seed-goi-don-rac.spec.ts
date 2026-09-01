import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

const DUNG_SEED = resolve(__dirname, "..", "dung-seed.ts");

/** **`globalSetup` phải THẬT SỰ gọi `don_rac_e2e`** — lượt 2026-08-31 (P-20260830-13).
 *
 * ## Cái lỗ mà bài này bịt
 *
 * Lệnh dọn rác có bộ đo riêng ở `api/tests/test_don_rac_e2e.py`, nhưng bộ đo ấy chỉ trả
 * lời được *"lệnh làm đúng việc của nó không"*. Câu còn lại — *"có ai gọi nó không"* —
 * không bài đo nào chạm tới: xoá hẳn dòng `execFileSync` trong `donRacLanTruoc` thì cả
 * 572 bài e2e vẫn XANH ở lượt đó, vì DB vừa được lượt trước dọn sạch. Rác chỉ tích lại
 * dần, và triệu chứng của nó là những bài đo *không liên quan gì tới việc ghi* đỏ vài
 * tuần sau — đúng con đường đã đi qua một lần rồi (P-20260830-8 bị ghi nhầm thành lỗi
 * sản phẩm).
 *
 * ## Vì sao đọc NGUỒN chứ không chạy thật
 *
 * `globalSetup` chạy đúng một lần cho cả bộ, trước mọi worker, và nó ghi vào DB. Không có
 * chỗ nào trong một bài Playwright để quan sát nó mà không dựng lại cả môi trường. Thứ cần
 * ghim ở đây cũng không phải hành vi lúc chạy — nó là *sự tồn tại của lời gọi*, và cái đó
 * đọc được từ nguồn.
 *
 * Ba vế, và vế thứ hai với thứ ba có mặt để bài này không pass RỖNG: một `readFileSync`
 * trỏ sai đường dẫn trả chuỗi rỗng, mà chuỗi rỗng thì `toContain` cũng đỏ — nhưng một
 * `dung-seed.ts` bị viết lại thành thứ khác hẳn (không còn `execFileSync`, không còn
 * `globalSetup`) mà vẫn tình cờ chứa chữ `don_rac_e2e` trong một comment thì không.
 */
test("dung-seed.ts còn gọi command don_rac_e2e trong globalSetup", () => {
  const nguon = readFileSync(DUNG_SEED, "utf8");

  // Vế chống rỗng: file đọc được và vẫn là cái file mình nghĩ.
  expect(nguon.length, "không đọc được `e2e/dung-seed.ts`").toBeGreaterThan(500);
  expect(nguon, "`dung-seed.ts` không còn là globalSetup của Playwright").toContain(
    "function globalSetup",
  );
  expect(nguon).toContain("execFileSync");

  // Vế chính: tên command nằm trong MỘT lời gọi `execFileSync` qua `scripts/py.mjs`, chứ
  // không phải chỉ nằm đâu đó trong một dòng chú thích.
  const goi = nguon.match(/execFileSync\([\s\S]*?\n {2}\);/g) ?? [];
  expect(goi.length, "không tìm thấy lời gọi execFileSync nào").toBeGreaterThan(0);
  expect(
    goi.filter((g) => g.includes("scripts/py.mjs") && g.includes('"don_rac_e2e"')),
    "globalSetup không còn gọi `don_rac_e2e` — rác của mỗi lượt e2e sẽ tích lại và đổi " +
      "ngầm đối tượng đo của mọi bài chọn 'mốc đông nhất / thread đầu tiên'",
  ).toHaveLength(1);

  // `donRacLanTruoc` phải còn được gọi từ chính `globalSetup`; một hàm mồ côi thì không
  // chạy, và nó trông y hệt một hàm đang chạy.
  expect(nguon).toMatch(/function globalSetup\(\)[\s\S]*?donRacLanTruoc\(goc\);/);
});
