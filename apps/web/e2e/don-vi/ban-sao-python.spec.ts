import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import {
  DAI_FIGURE_LABEL,
  DAI_FIGURE_VALUE,
  SO_FIGURES_TOI_DA,
} from "../../components/truong-moc";
import {
  CAC_REACTION,
  CHU_REACTION,
  GLYPH_REACTION,
  MO_TA_REACTION,
} from "../../lib/reaction";

const GOC = resolve(__dirname, "..", "..", "..", "..");

/** Chuông cho hai **bản sao có chủ đích** của hằng Python.
 *
 * Luật của repo là type đi một chiều `Ninja → OpenAPI → TS`, và không có bản sao nào. Hai
 * hằng dưới đây là ngoại lệ, vì cả hai **không đi qua OpenAPI được**:
 *
 * 1. **Bộ reaction** — `ReactionIn.emoji` khai `str | None`, không phải enum, nên schema
 *    không mang bộ khoá. Đổi nó thành `Literal` sẽ xoá hẳn bản sao, nhưng nó đổi **hợp
 *    đồng lỗi** của một endpoint đang chạy (hôm nay `{"emoji":"cuoi"}` trả 400
 *    `du_lieu_khong_hop_le`, pydantic sẽ trả mã khác) — một mục việc riêng, không phải
 *    một dòng thêm vào cuối lượt giao diện. Xem `lib/reaction.ts`.
 * 2. **Giới hạn `figures`** — `kiem_figures` là validator của Django, không phải ràng
 *    buộc pydantic, nên `FigureIn` ở TS chỉ có hai chuỗi. Form phải biết `maxLength` và
 *    trần 6 cặp để chặn TRƯỚC khi người ta gõ xong.
 *
 * Bản sao không có chuông là bản sao sẽ trôi. Ở đây chuông đọc **thẳng file Python**, nên
 * nới ở Django mà quên frontend ⇒ ĐỎ, và ngược lại.
 *
 * ⚠ Đọc bằng regex trên mã nguồn, không `import` được Python. Nên mỗi phép đọc đều
 * **fail-closed**: không cắt được thì NÉM, không trả mảng rỗng — một danh sách rỗng làm
 * mọi khẳng định dưới đây đúng một cách rỗng tuếch.
 */

function docPython(duong_dan: string): string {
  return readFileSync(resolve(GOC, duong_dan), "utf8");
}

/** Khoá của `Reaction.Emoji` (TextChoices), theo ĐÚNG thứ tự khai trong Python. */
export function docKhoaReaction(nguon: string): string[] {
  const lop = /class Emoji\(models\.TextChoices\):([\s\S]*?)\n\n/.exec(nguon);
  if (lop === null) throw new Error("Không cắt được `class Emoji(models.TextChoices)`.");
  const khoa = [...lop[1].matchAll(/^\s{8}[A-Z_]+ = "([a-z_]+)"/gm)].map((m) => m[1]);
  if (khoa.length === 0) throw new Error("Cắt được lớp Emoji nhưng không ra khoá nào.");
  return khoa;
}

/** Glyph emoji đi kèm từng khoá, đọc từ nhãn `"🧠 luận điểm rõ"`.
 *
 * Nhóm thứ hai nới từ `(\S+)` sang `(.+)` *(2026-08-25)*: nhãn của bộ mới là một cụm
 * nhiều chữ ("luận điểm rõ"), không còn là một từ. Nhóm GLYPH vẫn `(\S+)` — nới đúng
 * phần cần nới, giữ chặt phần đang canh.
 */
export function docGlyphReaction(nguon: string): Record<string, string> {
  const lop = /class Emoji\(models\.TextChoices\):([\s\S]*?)\n\n/.exec(nguon);
  if (lop === null) throw new Error("Không cắt được `class Emoji(models.TextChoices)`.");
  const ra: Record<string, string> = {};
  for (const m of lop[1].matchAll(/^\s{8}[A-Z_]+ = "([a-z_]+)", "(\S+) (.+)"/gm)) {
    ra[m[1]] = m[2];
  }
  if (Object.keys(ra).length === 0) throw new Error("Không đọc được glyph nào.");
  return ra;
}

export function docHang(nguon: string, ten: string): number {
  const m = new RegExp(`^${ten} = (\\d+)$`, "m").exec(nguon);
  if (m === null) throw new Error(`Không thấy hằng \`${ten}\` trong nguồn Python.`);
  return Number(m[1]);
}

test("bộ reaction ở frontend khớp ĐÚNG `Reaction.Emoji` của Django — đủ và đúng thứ tự", () => {
  const nguon = docPython("api/core/models/tuong_tac.py");
  const khoa = docKhoaReaction(nguon);
  // Thứ tự cũng là hợp đồng: nó là thứ tự bày ra năm cái nút, và một bộ nút đảo chỗ giữa
  // hai lần deploy là người dùng bấm nhầm.
  expect(CAC_REACTION as readonly string[]).toEqual(khoa);
});

test("mỗi khoá reaction có glyph + chữ, và glyph khớp nhãn trong Python", () => {
  const glyph = docGlyphReaction(docPython("api/core/models/tuong_tac.py"));
  for (const k of CAC_REACTION) {
    expect(GLYPH_REACTION[k], `glyph của ${k}`).toBe(glyph[k]);
    expect(CHU_REACTION[k], `chữ của ${k}`).toBeTruthy();
    expect(MO_TA_REACTION[k], `mô tả đầy đủ của ${k}`).toBeTruthy();
  }
});

test("phép đọc Python KHÔNG rỗng và fail-CLOSED (nếu không, ba bài trên rỗng tuếch)", () => {
  const nguon = docPython("api/core/models/tuong_tac.py");
  expect(docKhoaReaction(nguon).length).toBeGreaterThanOrEqual(4);
  expect(() => docKhoaReaction("khong co gi")).toThrow();
  expect(() => docGlyphReaction("khong co gi")).toThrow();
  expect(() => docHang("khong co gi", "SO_FIGURES_TOI_DA")).toThrow();
});

test("giới hạn `figures` ở form khớp `kiem_figures` của Django", () => {
  const nguon = docPython("api/core/models/moc.py");
  expect(SO_FIGURES_TOI_DA).toBe(docHang(nguon, "SO_FIGURES_TOI_DA"));
  expect(DAI_FIGURE_LABEL).toBe(docHang(nguon, "DAI_FIGURE_LABEL"));
  expect(DAI_FIGURE_VALUE).toBe(docHang(nguon, "DAI_FIGURE_VALUE"));
});
