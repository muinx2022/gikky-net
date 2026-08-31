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

/* ===========================================================================
 * Bản sao THỨ BA: tên header `X-Ghi-Nho` — thêm 2026-08-26 sau lượt phản biện
 * ========================================================================= */

/** `X-Ghi-Nho` (TS) ⇄ `HTTP_X_GHI_NHO` (Django `request.META`).
 *
 * Đây là bản sao thứ ba, và nó **không đi qua OpenAPI được** vì header không nằm trong
 * schema của endpoint — endpoint ấy là của allauth, gikky không khai. Hai hằng nối với
 * nhau chỉ bằng hai dòng docstring trỏ chéo, mà docstring thì không đỏ bao giờ.
 *
 * Ca hỏng nếu không có chuông này: đổi phía TS thành `"X-GhiNho"` ⇒ `pnpm test` vẫn xanh
 * (bài đo Python gửi header bằng literal của riêng nó), lint xanh, build xanh, `tsc` xanh
 * — và ô tích "ghi nhớ đăng nhập" **im lặng ngừng hoạt động cho mọi mod**.
 *
 * Đọc CẢ HAI phía bằng regex, fail-closed như ba bản sao trên.
 */
function docHangChuoi(nguon: string, ten: string, mau: RegExp): string {
  const m = nguon.match(mau);
  if (m === null) throw new Error(`không cắt được hằng ${ten}`);
  return m[1];
}

test("tên header `X-Ghi-Nho` khớp nhau giữa admin (TS) và `core/phien.py`", () => {
  const ts = readFileSync(
    resolve(GOC, "apps/admin/app/dang-nhap/page.tsx"),
    "utf8",
  );
  const py = readFileSync(resolve(GOC, "api/core/phien.py"), "utf8");

  const ten_ts = docHangChuoi(
    ts,
    "HEADER_GHI_NHO (TS)",
    /const HEADER_GHI_NHO\s*=\s*"([^"]+)"/,
  );
  const ten_py = docHangChuoi(
    py,
    "HEADER_GHI_NHO (Python)",
    /^HEADER_GHI_NHO\s*=\s*"([^"]+)"/m,
  );

  // Django dựng khoá `META` từ tên header: `HTTP_` + viết hoa + `-` thành `_`.
  const doi = `HTTP_${ten_ts.toUpperCase().replace(/-/g, "_")}`;
  expect(doi, `TS gửi "${ten_ts}" ⇒ Django thấy "${doi}"`).toBe(ten_py);

  // Và giá trị tắt phải khớp: TS gửi "0" khi bỏ tích, Python coi đúng "0" là tắt.
  expect(ts).toContain('ghiNho ? "1" : "0"');
  expect(docHangChuoi(py, "TAT", /^TAT\s*=\s*"([^"]+)"/m)).toBe("0");
});

test("phép đọc header KHÔNG rỗng và fail-CLOSED", () => {
  expect(() => docHangChuoi("khong co gi", "x", /const X\s*=\s*"([^"]+)"/)).toThrow();
});

/* ===========================================================================
 * Cửa sổ ô "Online" — hằng Python vs BỐN chuỗi chữ trên màn hình quản trị
 * (thêm 2026-08-31, sau lượt phản biện)
 * ========================================================================= */

/** `CUA_SO_ONLINE_PHUT` sống ở Python, nhưng con số ấy còn được VIẾT RA THÀNH CHỮ trên
 * `/luot-xem` — nhãn phụ của ô ("5 phút gần nhất") và đoạn chú giới hạn. Đây là một bản
 * sao **không đi qua OpenAPI được**: schema chỉ mang `so_online: int`, không mang cửa sổ
 * đã dùng để tính nó.
 *
 * Vì sao đáng một cái chuông: đổi hằng thành 15 thì `test_O4` đỏ, người sửa chỉnh luôn
 * bài đo ấy (nó bám theo hằng), rồi **pytest xanh · lint xanh · build xanh · e2e xanh** —
 * và ô KPI hiện con số của 15 phút dưới nhãn "5 phút gần nhất", đoạn chú nói "5 phút"
 * thêm ba lần nữa. Con số bị đọc sai gấp ba mà không có gì kêu. Chính docstring của
 * `quan_tri_luot_xem.py` lẫn `LuotXemTongOut` đều viết *"nhãn trên màn hình PHẢI nói ra
 * khoảng riêng ấy"* — đây là chỗ câu đó được thi hành thật.
 */
test("cửa sổ Online: hằng Python khớp MỌI chỗ nói '<n> phút' trên trang quản trị", () => {
  const phut = docHang(
    docPython("api/api/quan_tri_luot_xem.py"),
    "CUA_SO_ONLINE_PHUT",
  );
  const trang = docPython("apps/admin/app/luot-xem/page.tsx");

  // Nhãn phụ của ô KPI — chỗ người đọc nhìn đầu tiên khi thấy con số.
  expect(trang, `nhãn phụ phải nói "${phut} phút gần nhất"`).toContain(
    `${phut} phút gần nhất`,
  );

  // Và KHÔNG chỗ nào trong trang được nói một con số phút KHÁC: đoạn chú giới hạn nhắc
  // lại cửa sổ ba lần, nên lệch một chỗ là trang tự mâu thuẫn với chính nó.
  const cac_so = [...trang.matchAll(/(\d+)\s*phút/g)].map((m) => Number(m[1]));
  expect(cac_so.length, "không thấy chuỗi '<n> phút' nào — regex đã mục").toBeGreaterThan(2);
  expect(
    [...new Set(cac_so)],
    `trang nói ${[...new Set(cac_so)].join("/")} phút, hằng Python là ${phut}`,
  ).toEqual([phut]);
});

test("phép đọc `CUA_SO_ONLINE_PHUT` KHÔNG rỗng và fail-CLOSED", () => {
  // Hằng có thật ⇒ đọc ra một số dương; nguồn không có nó ⇒ NÉM, không trả 0 (một số 0
  // lặng lẽ sẽ làm khẳng định trên đúng một cách rỗng tuếch).
  expect(
    docHang(docPython("api/api/quan_tri_luot_xem.py"), "CUA_SO_ONLINE_PHUT"),
  ).toBeGreaterThan(0);
  expect(() => docHang("khong co gi", "CUA_SO_ONLINE_PHUT")).toThrow();
});
