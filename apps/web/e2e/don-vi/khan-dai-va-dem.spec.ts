import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import type { BinhLuanOut, KhanDaiOut } from "@gikky/api-client";
import { expect, test } from "@playwright/test";

import { boChuThich } from "./quet";

import { thamSoPhanTrangBiBo } from "../../lib/api";
import { NGUONG_HIEN_SO_DEM, nenHienSoDem } from "../../lib/dem";
import {
  HIEN_KHOI_DANG_CHU_Y,
  SAU_KHAN_DAI,
  SORT_KHAN_DAI,
  SORT_MAC_DINH,
  docSort,
  idTrongTrang,
  nenRenderCauDangDoc,
  neoBinhLuan,
  trangThaiDeepLink,
} from "../../lib/khan-dai";
import { tachSlugId, duongDanKhanDai, duongDanMach } from "../../lib/url";

test(`nguyên tắc 9: dưới ${NGUONG_HIEN_SO_DEM} bình luận thì ẩn số đếm`, () => {
  expect([0, 1, 2, 3].map(nenHienSoDem)).toEqual([false, false, false, false]);
  expect([4, 5, 24, 247].map(nenHienSoDem)).toEqual([true, true, true, true]);
});

test("docSort: ba giá trị hợp lệ giữ nguyên, rác quy về sort mặc định", () => {
  for (const s of SORT_KHAN_DAI) expect(docSort(s)).toBe(s);
  expect(docSort("hay_nhaat")).toBe(SORT_MAC_DINH);
  expect(docSort(undefined)).toBe(SORT_MAC_DINH);
  expect(docSort("")).toBe(SORT_MAC_DINH);
  // `hay_nhat` vẫn là một sort HỢP LỆ dù không còn là mặc định — vế trên đã phủ qua
  // `SORT_KHAN_DAI`, ghim lại ở đây để một lượt sau đổi mặc định không kéo theo việc
  // im lặng gỡ mất một sort.
  expect(docSort("hay_nhat")).toBe("hay_nhat");
  expect(docSort(["cu_nhat", "moi_nhat"])).toBe("cu_nhat");
});

test("user chốt 2026-08-26: mặc định là moi_nhat, tức ORDER BY created DESC", () => {
  // Ghim bằng **giá trị**, không bằng `SORT_MAC_DINH` — một bài đo so hằng với chính nó
  // xanh bất kể hằng ấy bằng gì, và đó đúng loài proof RỖNG mà repo này đã bắt vài lần.
  expect(SORT_MAC_DINH).toBe("moi_nhat");
  // Và link `💬 N` trên thẻ feed phải đi CÙNG một sort với lối vào thẳng `/m/…`.
  expect(duongDanKhanDai("abc", 7)).toContain(`sort=${SORT_MAC_DINH}`);
});

/* ---- Khối "Đáng chú ý" TẮT (user chốt 2026-08-26) ------------------------- */

test("khối 'Đáng chú ý' đang TẮT — nó xếp hạng bằng ĐIỂM", () => {
  // Ghim bằng giá trị, không so hằng với chính nó. User: "trước mắt ta chưa tính đến
  // điểm, mà chỉ tính đến việc cái nào cmt mới nhất thì lên trước".
  expect(HIEN_KHOI_DANG_CHU_Y).toBe(false);
});

test("…và cái cờ ấy cắt luôn LỜI GỌI `?dang_doc=1`, không chỉ cắt phần render", () => {
  // Vì sao phải là phép đọc mã nguồn: `docCauDangDoc` chạy trong server component, nên
  // không có `page.on("request")` nào ở phía trình duyệt nhìn thấy nó. Một bài đo e2e
  // "không có request dang_doc" sẽ XANH kể cả khi lời gọi vẫn chạy mỗi lượt xem trang —
  // đúng loài proof đo RỖNG.
  //
  // Giới hạn thành thật: nó chứng minh lời gọi **bị canh bởi cờ**, không chứng minh cờ
  // đang tắt. Bài ngay trên lo vế đó; hai bài cùng nhau mới thành một câu.
  // ⚠ `boChuThich` là vế BẮT BUỘC, không phải dọn dẹp cho sạch. Bản đầu của bài này đọc
  // mã nguồn còn nguyên chú thích, và ngay trên lời gọi có một dòng `// … công tắc +
  // lý do ở lib/khan-dai.ts::HIEN_KHOI_DANG_CHU_Y`. Cắt câu lệnh theo dấu `;` thì đoạn
  // cắt ra ôm trọn dòng chú thích ấy ⇒ `toContain` xanh **kể cả khi cờ đã bị gỡ khỏi
  // code**. Lượt thử phá bắt được: gỡ cờ ⇒ bài vẫn xanh. Đúng một proof đo RỖNG.
  const src = boChuThich(
    readFileSync(
      resolve(__dirname, "..", "..", "components/trang-mach.tsx"),
      "utf8",
    ),
  );
  const goi = [...src.matchAll(/docCauDangDoc\s*\(/g)];
  expect(goi.length, "chỉ nên có ĐÚNG MỘT lời gọi").toBe(1);

  // Câu lệnh chứa lời gọi ấy phải nhắc tên cờ. Cắt từ dấu `;` trước đó tới dấu `;` sau.
  const at = goi[0].index!;
  const dau = src.lastIndexOf(";", at);
  const cuoi = src.indexOf(";", at);
  const cau = src.slice(dau + 1, cuoi);
  expect(cau).toContain("HIEN_KHOI_DANG_CHU_Y");
});

test("deep-link: có trong trang thì cuộn được, không có thì phải NÓI RA", () => {
  const co = new Set([11, 22]);
  expect(trangThaiDeepLink(11, co)).toBe("cuon_duoc");
  // Nợ 1b #8 — bình luận nằm ở trang sau của khán đài. Trạng thái này bắt buộc phải tồn
  // tại: im lặng ở đây nghĩa là một nút bấm rồi không đi đâu.
  expect(trangThaiDeepLink(99, co)).toBe("trang_sau");
  expect(trangThaiDeepLink(11, new Set())).toBe("trang_sau");
});

/** Một chuỗi thẳng `depth = 1 … sau`, gốc ở đầu. `id` trùng `depth` cho dễ đọc. */
function chuoiSau(sau: number): BinhLuanOut[] {
  const nut = (depth: number, replies: BinhLuanOut[]): BinhLuanOut => ({
    id: depth,
    parent_id: depth === 1 ? null : depth - 1,
    depth,
    anchor_moc_seq: depth === 1 ? 1 : null,
    author: { username: "ai_do", display_name: "Ai Đó", avatar_url: null },
    body: `tầng ${depth}`,
    body_dinh_dang: "markdown",
    created_at: "2026-03-04T02:20:00Z",
    edited_at: null,
    up_count: 0,
    down_count: 0,
    score: 0,
    trang_thai: "binh_thuong",
    la_chu_mach: false,
    tu_gap: false,
    replies,
  });
  let cay = nut(sau, []);
  for (let d = sau - 1; d >= 1; d -= 1) cay = nut(d, [cay]);
  return [cay];
}

test(`W8 — idTrongTrang dừng ở tầng ${SAU_KHAN_DAI}, đúng chỗ UI cắt render`, () => {
  const cay = chuoiSau(SAU_KHAN_DAI + 3);
  const co = idTrongTrang(cay);

  // Tầng 1..6 có `<li id="bl-N">` thật trong trang.
  for (let d = 1; d <= SAU_KHAN_DAI; d += 1) {
    expect(co.has(d), `tầng ${d} phải nằm trong trang`).toBe(true);
  }
  // Tầng 7 trở đi KHÔNG được render (`components/binh-luan.tsx` thay bằng link "tiếp tục
  // thread →"), nên không có neo nào để cuộn tới.
  for (let d = SAU_KHAN_DAI + 1; d <= SAU_KHAN_DAI + 3; d += 1) {
    expect(co.has(d), `tầng ${d} KHÔNG được coi là nằm trong trang`).toBe(false);
  }
});

test("W8 — deep-link tới bình luận sâu quá ngưỡng phải nói 'nằm ở trang sau'", () => {
  // Nợ B4: `idTrongTrang` từng duyệt cả cây, nên nút `depth ≥ 7` được báo "cuộn được" —
  // bấm xong trang đứng yên, không thông báo gì. Đó là ca người dùng không có cách nào
  // hiểu, tệ hơn hẳn một câu giải thích.
  const co = idTrongTrang(chuoiSau(SAU_KHAN_DAI + 2));
  expect(trangThaiDeepLink(SAU_KHAN_DAI, co)).toBe("cuon_duoc");
  expect(trangThaiDeepLink(SAU_KHAN_DAI + 1, co)).toBe("trang_sau");
  expect(trangThaiDeepLink(SAU_KHAN_DAI + 2, co)).toBe("trang_sau");
});

test("neo bình luận là một chỗ sinh một chỗ đọc", () => {
  expect(neoBinhLuan(1234)).toBe("bl-1234");
});

test("tách `<slug>-<id>`: id là khoá, slug chỉ để đọc", () => {
  expect(tachSlugId("nhat-ky-lenh-hpg-1008")).toEqual({
    slug: "nhat-ky-lenh-hpg",
    id: 1008,
  });
  // Slug rỗng hợp lệ — `slug_tu_title` của API trả chuỗi rỗng cho title toàn emoji.
  expect(tachSlugId("-1008")).toEqual({ slug: "", id: 1008 });
  expect(tachSlugId("khong-co-so")).toBeNull();
  expect(tachSlugId("khongcogach")).toBeNull();
  expect(tachSlugId("am-0")).toBeNull();
  expect(tachSlugId("qua-lon-99999999999999999999")).toBeNull();
});

test("dựng lại URL từ slug + id là phép đảo của phép tách", () => {
  for (const [slug, id] of [
    ["nhat-ky-lenh-hpg", 1008],
    ["", 7],
    ["a-b-c", 42],
  ] as const) {
    expect(tachSlugId(duongDanMach(slug, id).replace("/m/", ""))).toEqual({
      slug,
      id,
    });
  }
});

/* ---- Y1: khối "Câu đáng đọc" chỉ render khi nó LỌC được gì ----------------- */

/** Một response `?dang_doc=1` giả, chỉ giữ ba trường phép quyết định thật sự đọc. */
function tapDangDoc(soThread: number, boLai: number | null): KhanDaiOut {
  return {
    sort: "hay_nhat",
    tong_thread: soThread,
    threads: Array.from({ length: soThread }, (_, i) => ({
      ...chuoiSau(1)[0]!,
      id: i + 1,
    })),
    so_ung_vien_bo_lai: boLai,
    offset_ke_tiep: null,
    cursor_ke_tiep: null,
  };
}

test("Y1 — bỏ lại 0 ứng viên là khối không lọc được gì ⇒ KHÔNG render", () => {
  // Hình dạng mạch VNM của seed dev: tập 5 thread, cây 6 (một gốc mod ẩn không vào tập).
  // Luật cũ so `5 < 6` rồi render — và khối chép lại y nguyên phần đọc được của cây.
  expect(nenRenderCauDangDoc(tapDangDoc(5, 0))).toBe(false);
  // Mạch 2 thread (post thường): cùng kết luận, đường cũ cũng đúng ở ca này.
  expect(nenRenderCauDangDoc(tapDangDoc(2, 0))).toBe(false);
});

test("Y1 — còn ứng viên bị bỏ lại thì khối là phép lọc thật ⇒ RENDER", () => {
  // Hình dạng mạch HPG của seed: 14 gốc đọc được, tập = top-10 ∪ {r7} ⇒ bỏ lại 3.
  expect(nenRenderCauDangDoc(tapDangDoc(11, 3))).toBe(true);
  expect(nenRenderCauDangDoc(tapDangDoc(10, 9))).toBe(true);
});

test("Y1 — fail-closed: null, tập rỗng, và response KHÔNG phải chế độ dang_doc", () => {
  expect(nenRenderCauDangDoc(null)).toBe(false);
  expect(nenRenderCauDangDoc(tapDangDoc(0, 5))).toBe(false);
  // `so_ung_vien_bo_lai === null` là dấu hiệu người gọi truyền nhầm response khán đài
  // ĐẦY ĐỦ vào đây. Render nó là in cả cây hai lần; ẩn đi chỉ mất một lối tắt.
  expect(nenRenderCauDangDoc(tapDangDoc(14, null))).toBe(false);
});

/* ---- Vá D5: tham số phân trang bị vứt phải NÓI RA -------------------------- */

test("D5 — offset khác 0 kèm sort thời gian là tham số BỊ BỎ, phải nói ra", () => {
  // Đường thứ ba, thứ mà bản đầu vứt im lặng. `?khan_dai=1&sort=moi_nhat&offset=20`:
  // hai sort thời gian phân trang bằng `cursor` (PLAN 5.3), nên `offset` không đi đâu cả.
  expect(thamSoPhanTrangBiBo("moi_nhat", { offset: 20 })).toBe(true);
  expect(thamSoPhanTrangBiBo("cu_nhat", { offset: 1 })).toBe(true);
  expect(thamSoPhanTrangBiBo("moi_nhat", { offset: 9999 })).toBe(true);
});

test("D5 — offset 0 / vắng mặt kèm sort thời gian thì KHÔNG báo (không vá quá tay)", () => {
  expect(thamSoPhanTrangBiBo("moi_nhat", {})).toBe(false);
  expect(thamSoPhanTrangBiBo("moi_nhat", { offset: 0 })).toBe(false);
  expect(thamSoPhanTrangBiBo("cu_nhat", {})).toBe(false);
});

test("D5 — offset là tham số HỢP LỆ của hay_nhat, không được báo bỏ", () => {
  // Chiều đối xứng: `hay_nhat` phân trang bằng `offset`, nên `offset=20` ở đây đi thẳng
  // xuống API. Báo "đã bỏ" ở ca này là nói dối theo chiều ngược lại.
  expect(thamSoPhanTrangBiBo("hay_nhat", { offset: 20 })).toBe(false);
  expect(thamSoPhanTrangBiBo("hay_nhat", { offset: 9999 })).toBe(false);
});

test("D5 — hai đường cũ (vá A1) vẫn còn nguyên", () => {
  // Cursor rỗng/rác…
  expect(thamSoPhanTrangBiBo("moi_nhat", { cursor: "" })).toBe(true);
  expect(thamSoPhanTrangBiBo("moi_nhat", { cursor: "   " })).toBe(true);
  // …và cursor gửi kèm `hay_nhat`.
  expect(thamSoPhanTrangBiBo("hay_nhat", { cursor: "abc" })).toBe(true);
  // Cursor trông hợp lệ kèm sort thời gian thì để API phán, chưa báo gì ở đây.
  expect(thamSoPhanTrangBiBo("moi_nhat", { cursor: "abc" })).toBe(false);
});
