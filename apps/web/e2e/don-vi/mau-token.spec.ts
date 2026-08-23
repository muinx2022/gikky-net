import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { quetNguon } from "./quet";

const WEB = resolve(__dirname, "..", "..");
const GOC = resolve(WEB, "..", "..");

/** Hàng rào chạy được cho PLAN 9.1:
 *
 * > Xanh `#1C7A4F` / đỏ `#B33A2B` **CẤM dùng trang trí** — chỉ được xuất hiện ở con số
 * > lãi/lỗ.
 *
 * Không có hàng rào thì câu trên là một dòng trong plan, và dòng đầu tiên tô đỏ cho một
 * nút "xoá" sẽ không làm gì đỏ cả. Hai luật:
 *
 * 1. Mã hex của **hai hệ màu mà PLAN 9.1 giao luật riêng** — xanh/đỏ lãi lỗ và hoàng thổ
 *    `--stamp`, mỗi hệ 2 sáng + 2 tối — chỉ được xuất hiện ở `app/globals.css`, chỗ KHAI
 *    token. Ở bất kỳ đâu khác là ai đó vừa bỏ qua hệ token (vá E1 thêm hệ hoàng thổ).
 *    Các token còn lại (`--ink*`, `--line*`, `--surface`, `--accent*`) KHÔNG nằm trong
 *    luật này: PLAN không giao chúng cho một ý nghĩa riêng nào, nên gõ cứng một mã trong
 *    số đó là chuyện xấu về phong cách chứ không phá được luật nào cả.
 * 2. `var(--gain)` / `var(--loss)` chỉ được dùng ở đúng một file:
 *    `components/con-so.module.css`. Muốn thêm chỗ dùng thì phải sửa cả file này — và đó
 *    là mục đích: quyết định có chủ đích, không phải một dòng CSS lọt vào lúc nửa đêm.
 * 3. **Hoàng thổ `--stamp` đi theo allowlist từng SELECTOR** (vá C2, 2026-08-22). PLAN
 *    9.1 giao nó riêng cho "thứ mang tính đóng dấu"; một allowlist theo FILE thì không
 *    đủ, vì `the-moc.module.css` chứa cả `.da_sua` (đúng là con dấu) lẫn `.cau_moi`
 *    (lời mời — không phải), tức chính cái ca đã lọt.
 * 4. **Allowlist đó SUY TỪ `PLAN.md` 9.1**, không phải một mảng gõ tay (quyết định 4 của
 *    user, 2026-08-22 — plan con 1d §2.6). Xem `mucDongDauTheoPLAN` bên dưới: mỗi selector
 *    phải viện dẫn một mục có thật trong câu của PLAN, và mọi mục của PLAN phải được xử.
 *
 * Quét trên bản **đã bỏ chú thích** (xem `quet.ts`), nên docstring được phép nhắc tới mã
 * màu — kể cả docstring này.
 *
 * ⚠ Luật 2 và 3 quét **cả `.tsx`/`.ts`**, không chỉ `.css` (vá C4). Bản đầu lọc
 * `f.ten.endsWith(".css")` nên `style={{ color: "var(--gain)" }}` viết thẳng trong JSX
 * lọt sạch — mà đó lại là cách nhanh nhất để tô màu một chỗ lẻ.
 */

const HEX_LAI_LO = ["#1C7A4F", "#B33A2B", "#43BE83", "#E4776A"];

/** Hoàng thổ `--stamp` / `--stamp-soft`, 2 sáng + 2 tối (vá E1, 2026-08-22).
 *
 * Trước đợt vá, danh sách chỉ có bốn mã xanh/đỏ, nên **gõ cứng `#b07a2b` ở bất kỳ đâu
 * không làm gì đỏ cả** — trong khi C1 vừa được vá vì đúng một mã hex lọt ra ngoài hệ
 * token, và luật 3 dưới đây đã siết `var(--stamp)` tới từng selector. Siết cửa `var(…)`
 * mà để ngỏ cửa hex là hàng rào có một mặt.
 */
const HEX_STAMP = ["#B07A2B", "#F5EBDA", "#D8A455", "#2A2318"];

/** Hai hệ màu có luật riêng trong PLAN 9.1 — chỉ được xuất hiện ở chỗ KHAI token.
 * KHÔNG phải "mọi màu của bảng token": xem luật 1 ở docstring đầu file. */
const HEX_TOKEN = [...HEX_LAI_LO, ...HEX_STAMP];

const NOI_KHAI_TOKEN = "app/globals.css";
const NOI_DUOC_DUNG = "components/con-so.module.css";
/** Chính file này liệt kê mọi mã hex trong `HEX_TOKEN` — mã thật, không phải chú thích. */
const TU_TRU = "e2e/don-vi/mau-token.spec.ts";

/** Danh sách "thứ mang tính đóng dấu" **ĐỌC THẲNG TỪ `PLAN.md` mục 9.1** — quyết định 4
 * của user, 2026-08-22: *"Danh sách này là NGUỒN của allowlist … hàng rào phải suy từ
 * đây, không được tự nới."*
 *
 * Trước 1d, `STAMP_DUOC_PHEP` là một mảng gõ tay. Nó chặn được "thêm một selector lạ",
 * nhưng **không** chặn được cửa ngược lại: thêm một dòng vào chính mảng đó là nới luật —
 * và không có gì nối nó với PLAN, nên "suy từ PLAN 9.1" chỉ là một câu trong docstring.
 * Nay mỗi selector phải khai mình thuộc mục nào của PLAN, và:
 *
 * - mục không có trong PLAN ⇒ đỏ (không tự chế được vai mới);
 * - mục có trong PLAN mà không ai khai ⇒ đỏ, trừ khi khai tường minh là "chưa tới phase
 *   này" (vạch mới và spine thuộc mặt BÃO — Phase 3).
 *
 * Đoạn PLAN được cắt ra bằng hai mốc chữ nằm ngay trong câu ấy, không phải bằng số dòng.
 */

/* ===========================================================================
 * HAI LỚP, và vì sao phải có lớp thứ hai — **W3, lượt vá 2**
 * ===========================================================================
 *
 * Đây là lượt vá thứ BA của cùng một hàng rào. Hai lượt trước đều đi theo một hướng:
 * *đọc hiểu văn xuôi tiếng Việt bằng regex, mỗi lượt bịt thêm một lối*. V4 bịt lối "mục
 * thứ 8 nối sau mốc cắt"; phản biện vòng 2 chạy 11 biến thể và tìm ra **ba lối nữa** —
 * trong đó **D1 là cửa do chính V4 mở** (bước xoá ngoặc chú thích bằng regex `NGOAC` bên
 * dưới nuốt trọn mọi thứ nằm trong một cặp ngoặc, kể cả một mục viết trong đó).
 *
 * **Kết luận của thợ, nói thẳng theo §3 rủi ro 3 của plan: hướng ấy sai từ gốc.** Không
 * phải vì regex viết chưa đủ khéo, mà vì bài toán không có đáy: "một mục đóng dấu mới"
 * là một khái niệm NGỮ NGHĨA, và văn xuôi tiếng Việt có vô hạn cách viết nó — trong
 * ngoặc, sau dấu chấm, ở gạch đầu dòng khác, trong một câu phụ, trong một bảng. Mỗi lượt
 * vá bịt một cách và để lại tập vô hạn còn lại. Đếm số lượt: 3.
 *
 * **Đổi hướng.** Từ lượt này hàng rào gồm hai lớp, và lớp thứ hai KHÔNG cố hiểu gì cả:
 *
 * 1. **`docMucDongDau` — SUY allowlist từ PLAN.** Vẫn cần: đây là thứ nối `STAMP_THEO_MUC`
 *    với câu chữ của PLAN, và là thứ cho ra thông điệp đỏ ĐỌC ĐƯỢC ("mục X trong PLAN
 *    không ai cài"). Nó chỉ hứa đúng một chuyện: **cắt được thì cắt đúng; không chắc thì
 *    NÉM**. Nó không hứa nhìn thấy mọi cách viết.
 * 2. **`bamMuc91` — GHIM nguyên văn cả mục 9.1 bằng băm.** Không phân tích, không đoán:
 *    9.1 đổi một ký tự là đỏ. Người sửa PLAN phải đọc lại allowlist, chỉnh nó, rồi cập
 *    nhật `BAM_MUC_91`. Đó là toàn bộ ý định của câu *"Danh sách này là NGUỒN của
 *    allowlist … hàng rào phải suy từ đây, không được tự nới"* — nguồn đổi thì bản suy ra
 *    phải được xác nhận lại bởi một CON NGƯỜI, không phải bởi một biểu thức chính quy.
 *
 * **Cái giá, nói trước:** sửa một lỗi chính tả trong 9.1 cũng làm bài đo đỏ. Chấp nhận —
 * 9.1 là một mục spec dài bảy dòng, đổi vài lần một năm, và cái nó đổi là LUẬT.
 *
 * ---------------------------------------------------------------------------
 * **PHÂN VAI THẬT CỦA HAI LỚP — nói ra ở X3, lượt vá 3.** Bản trước viết ở đây rằng đổi
 * lại là *"mọi lối viết chưa ai nghĩ ra đều bị chặn, kể cả lối thứ mười hai"*. Câu ấy
 * rộng hơn sự thật theo hai chiều, và cả hai chiều đều đã đo:
 *
 * 1. **Phạm vi.** Nó chỉ đúng **bên trong mục 9.1**. `bamMuc91` ghim từ dòng `### 9.1`
 *    tới `### ` kế tiếp — không hơn. Ai viết một vai đóng dấu mới ở `9.2`, ở `5.6`, hay ở
 *    bất kỳ mục nào khác thì **cả hai lớp đều im**, và bài đo `"lớp 2 ghim ĐÚNG mục 9.1"`
 *    dưới đây chính là bài chứng minh điều đó (nó đòi sửa ngoài 9.1 phải KHÔNG đổi băm).
 *    Đó là đánh đổi có chủ đích: ghim cả file thì lớp 2 đỏ mỗi lần ai sửa một mục bất kỳ,
 *    và nó sẽ bị gỡ trong ba ngày.
 * 2. **Ai chặn cái gì.** Ma trận 11 biến thể dưới đây xanh **gần như hoàn toàn nhờ lớp
 *    2**, vì mọi biến thể đều sửa chữ nằm trong 9.1. Tách hai lớp ra đo riêng
 *    (`test lớp 1 …` bên dưới) thì **lớp 1 mù với D2 và D3** — hai cách viết mà nó không
 *    nhận ra là mục mới. Nó bắt được D1 và V1–V5/V7; nó không bắt được D2, D3.
 *
 * ⇒ **Gỡ lớp băm là mở lại đúng hai cửa D2 và D3.** Hôm nay không có gì nói cho người sau
 * biết điều đó, nên từ X3 nó vừa là chữ ở đây, vừa là bài đo chạy được: `lop1Do` và
 * `lop2Do` tách hẳn nhau, và có bài ghim đúng chỗ lớp 1 mù. Bài ấy ĐỎ nếu ai làm lớp 1
 * khôn hơn — và đó là tin tốt, lúc ấy hãy xoá nó.
 */

/** Mốc cắt ĐẦU và CUỐI của câu liệt kê trong PLAN 9.1.
 *
 * ⚠ **Mốc cuối phải là cuối CÂU, không được là một dấu vết của lần sửa gần nhất**
 * *(vá V4, 2026-08-22)*. Bản trước cắt tới chuỗi `"*(ba cái sau chốt"` — cái ngoặc ngày
 * tháng mà đợt vá hôm ấy vừa gắn vào. Hệ quả: thêm mục đóng dấu thứ 8 theo đúng cách bản
 * vá ấy vừa dùng (nối vào cuối câu kèm một `*(chốt …)*` riêng) thì nó nằm **sau** mốc
 * cắt ⇒ hàng rào vẫn đọc ra đúng 7 mục ⇒ cả bốn bài A14 xanh trong khi PLAN đã có một vai
 * đóng dấu không ai cài. Mốc cắt chứa một từ ĐẾM ("ba cái sau") thì nó hết đúng đúng lúc
 * con số đổi — tức đúng lúc cần nó nhất.
 */
const MOC_DAU = 'mang tính "đóng dấu"**:';
const MOC_CUOI = "**Danh sách này là NGUỒN";

/** Cắt danh sách "đóng dấu" ra khỏi một bản `PLAN.md`. Hàm THUẦN để thử phá được.
 *
 * **Fail-CLOSED**: cắt hỏng thì NÉM, không trả mảng rỗng. Mảng rỗng làm ba bài A14 dưới
 * đây nghiệm đúng một cách rỗng tuếch (`[].filter(...)` luôn là `[]` — không mục nào tự
 * chế, không mục nào bị bỏ quên), và allowlist quay về đúng trạng thái "một mảng gõ tay
 * không nối với PLAN" mà cả nhóm bài này sinh ra để diệt.
 *
 * ⚠ **Ngoặc chú thích bị bỏ đi, nhưng KHÔNG bỏ im lặng** *(vá W3, cửa D1)*. V4 xoá mọi
 * chuỗi khớp `NGOAC` (xem hằng ngay trong thân hàm) để `*(ba cái sau chốt 2026-08-22)*`
 * không thành một mục — đúng ý định, sai cách làm: nó nuốt **mọi thứ** trong ngoặc, nên
 * `*(ba cái sau chốt 2026-08-22; cộng **vạch xác nhận đã đọc** từ 2026-09-01)*` cũng biến
 * mất sạch, và đó là cách viết TỰ NHIÊN NHẤT vì ba mục hiện tại đều được thêm kèm đúng
 * một cái ngoặc như vậy. Nay phần bị bỏ đi được **soi trước khi bỏ**: một cụm in đậm nằm
 * trong ngoặc chú thích là một MỤC viết lộn chỗ ⇒ NÉM.
 */
export function docMucDongDau(plan: string): string[] {
  const sau = plan.split(MOC_DAU);
  if (sau.length !== 2) {
    throw new Error(
      `Không cắt được PLAN 9.1: thiếu (hoặc trùng) mốc đầu "${MOC_DAU}"`,
    );
  }
  const den = sau[1].split(MOC_CUOI);
  if (den.length < 2) {
    throw new Error(`Không cắt được PLAN 9.1: thiếu mốc cuối "${MOC_CUOI}"`);
  }

  const NGOAC = /\*\([^)]*\)\*/g;
  for (const chu_thich of den[0].match(NGOAC) ?? []) {
    if (chu_thich.includes("**")) {
      throw new Error(
        `PLAN 9.1: có cụm in đậm nằm TRONG ngoặc chú thích ${chu_thich} — ngoặc là siêu ` +
          "dữ liệu của câu, một mục đóng dấu không được viết ở đó (cửa D1).",
      );
    }
  }

  const muc = den[0]
    .replaceAll(NGOAC, "")
    .replaceAll("**", "")
    .replace(/\s+/g, " ")
    .split(",")
    .map((s) => s.trim().replace(/[.;\s]+$/, ""))
    .filter((s) => s !== "");
  if (muc.length === 0) {
    throw new Error("Cắt được đoạn PLAN 9.1 nhưng không ra mục nào — hàng rào sẽ rỗng.");
  }
  return muc;
}

/** Toàn văn mục **9.1** của một bản `PLAN.md`: từ dòng `### 9.1` tới `###` kế tiếp.
 *
 * Fail-closed như `docMucDongDau`: không tìm thấy mục thì NÉM.
 */
export function catMuc91(plan: string): string {
  const dong = plan.replaceAll("\r\n", "\n").split("\n");
  const dau = dong.findIndex((d) => d.startsWith("### 9.1"));
  if (dau === -1) throw new Error("Không tìm thấy dòng tiêu đề `### 9.1` trong PLAN.md");
  const lech = dong.slice(dau + 1).findIndex((d) => d.startsWith("### "));
  const cuoi = lech === -1 ? dong.length : dau + 1 + lech;
  const than = dong
    .slice(dau, cuoi)
    .map((d) => d.replace(/[ \t]+$/, ""))
    .join("\n")
    .trim();
  if (!than.includes(MOC_DAU)) {
    throw new Error(
      "Cắt được mục 9.1 nhưng nó không chứa câu liệt kê 'đóng dấu' — hai lớp đang đọc " +
        "hai chỗ khác nhau, và lớp băm sẽ ghim nhầm đoạn.",
    );
  }
  return than;
}

/** SHA-256 của toàn văn 9.1 (đã chuẩn hoá LF + bỏ khoảng trắng cuối dòng). */
export function bamMuc91(plan: string): string {
  return createHash("sha256").update(catMuc91(plan), "utf8").digest("hex");
}

/** Băm của `PLAN.md` **hiện tại**. Đây là chữ ký xác nhận: *"đã đọc 9.1 và allowlist
 * dưới đây suy đúng từ nó"*.
 *
 * **Đổi 9.1 ⇒ bài đo đỏ ⇒ đọc lại `STAMP_THEO_MUC` / `CHUA_TOI_PHASE`, sửa cho khớp, RỒI
 * mới dán băm mới vào đây.** Cập nhật con số này mà không mở allowlist ra xem là đúng
 * hành vi mà cả nhóm bài A14 sinh ra để chặn — và nó là hành vi của một con người, thứ
 * không hàng rào nào chặn được; cái hàng rào làm được là bắt người ấy phải cố ý.
 */
const BAM_MUC_91 =
  "37f14191df03fab0ac8936eea3b565bf2f94c4dd12ccfd7a497cb4d6ee8e1241";

const PLAN_THAT = readFileSync(resolve(GOC, "PLAN.md"), "utf8");
const MUC_PLAN = docMucDongDau(PLAN_THAT);

/** Mục của PLAN 9.1 chưa có mặt ở phase này, kèm lý do. Khai tường minh chứ không lặng lẽ
 * bỏ qua: một mục biến mất khỏi bảng dưới sẽ đỏ, và người sửa phải chọn giữa "cài nó" và
 * "ghi ra rằng nó chưa tới lượt". */
const CHUA_TOI_PHASE: Readonly<Record<string, string>> = {
  // ✅ RỖNG từ 2026-08-23 (mảng B2): mặt BÃO đã có, nên "vạch mới" và "số mốc chưa xem
  // trên spine" chuyển sang `STAMP_THEO_MUC` bên dưới. Bảng giữ lại chứ không xoá kiểu
  // khai — mục PLAN tiếp theo chưa tới lượt phải đi qua đây, và bài đo "không có dòng
  // chết" sẽ bắt ngay một dòng thừa.
};

/** `mục PLAN 9.1` → `file#selector` được phép dùng `--stamp` / `--stamp-soft`.
 *
 * Khoá phải khớp **nguyên văn** một mục trong câu của PLAN 9.1 (xem `mucDongDauTheoPLAN`).
 */
const STAMP_THEO_MUC: Readonly<Record<string, readonly string[]>> = {
  // Cả khối trích, chú thích và link nhảy của nó.
  "trích vào sổ": [
    "components/khoi-trich.module.css#.khoi",
    "components/khoi-trich.module.css#.chu_thich",
    "components/khoi-trich.module.css#.nhay",
  ],
  'nhãn "ĐÃ ĐÓNG SỔ" trên thẻ feed': ["components/the-mach.module.css#.dong_so"],
  // Nhãn "đã sửa N lần" chuyển từ một `<span>` trơ sang một cái NÚT mở danh sách bản cũ
  // (nợ `UI-DIFF-REVISION`, 2026-08-23), nên selector đổi file. **Cùng một vai đóng dấu
  // của PLAN 9.1**, không phải vai mới — đó là điều kiện để nó được đứng dưới khoá này.
  '"đã sửa"': ["components/ban-cu-moc.module.css#.nhan"],
  'chỉ số "Được trích ×N" trên hồ sơ': [
    "app/u/[username]/ho-so.module.css#.trich dt, .trich dd",
  ],
  'nhãn "DRAFT" của `/luat`': ["app/luat/luat.module.css#.draft"],
  // Mặt BÃO — mảng B2, 2026-08-23. Vạch dùng `--stamp` cho cả chữ lẫn hai đầu gạch
  // (`::before`/`::after` là hai rule riêng với `khoiDungStamp`).
  "vạch mới": [
    "components/mat-bao.module.css#.vach_moi",
    "components/mat-bao.module.css#.vach_moi::before, .vach_moi::after",
  ],
  "số mốc chưa xem trên spine": ["components/mat-bao.module.css#.chua_xem"],
};

const STAMP_DUOC_PHEP = Object.values(STAMP_THEO_MUC).flat();

const FILES = quetNguon(WEB, /\.(css|tsx?|mjs)$/);

/** `file#selector` của mọi khối CSS có nhắc tới `--stamp`.
 *
 * Phép tách khối là regex, không phải parser: nó bắt các rule KHÔNG lồng nhau, và với
 * `@media { … }` thì các rule bên trong vẫn ra còn dòng `@media` thì không. Đủ cho hàng
 * rào này vì mọi file `.module.css` ở đây đều phẳng — và nếu ai đó viết CSS lồng thật,
 * bài đo "danh sách không rỗng" bên dưới sẽ hụt và đỏ.
 */
function khoiDungStamp(): string[] {
  const ra: string[] = [];
  for (const f of FILES) {
    if (!f.ten.endsWith(".css")) continue;
    for (const m of f.sach.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
      // Selector nhiều dòng gộp về một dòng, nếu không thì allowlist phải chép cả ký tự
      // xuống dòng và không ai đọc ra nó.
      const ten = m[1].trim().replace(/\s+/g, " ");
      if (/var\(\s*--stamp/.test(m[2])) ra.push(`${f.ten}#${ten}`);
    }
  }
  return ra.sort();
}

test("bộ file quét được không rỗng (bài đo này tự chứng minh mình có quét)", () => {
  expect(FILES.length).toBeGreaterThan(20);
  const ten = FILES.map((f) => f.ten);
  expect(ten).toContain(NOI_KHAI_TOKEN);
  expect(ten).toContain(NOI_DUOC_DUNG);
  expect(ten).toContain(TU_TRU);
});

test("mã hex xanh/đỏ + hoàng thổ chỉ nằm ở chỗ khai token", () => {
  const pham = FILES.filter(
    (f) =>
      f.ten !== NOI_KHAI_TOKEN &&
      f.ten !== TU_TRU &&
      HEX_TOKEN.some((h) => f.sach.toUpperCase().includes(h)),
  );
  expect(pham.map((f) => f.ten)).toEqual([]);
});

test("luật hex bắt được hàng giả — kể cả mã hoàng thổ viết thường", () => {
  // Không có vế này thì "danh sách vi phạm rỗng" cũng đúng khi `HEX_TOKEN` rỗng, khi
  // `FILES` rỗng, hoặc khi phép so sánh hoa/thường lệch. Ở đây thử đúng chuỗi mà một
  // người gõ cứng sẽ viết.
  const gia = "color: #b07a2b;";
  expect(HEX_TOKEN.some((h) => gia.toUpperCase().includes(h))).toBe(true);
  expect(HEX_TOKEN.some((h) => "color: var(--stamp);".toUpperCase().includes(h))).toBe(
    false,
  );
});

test("var(--gain) / var(--loss) chỉ được dùng ở con-so.module.css — CẢ trong .tsx", () => {
  const pham = FILES.filter(
    (f) =>
      f.ten !== NOI_KHAI_TOKEN &&
      f.ten !== NOI_DUOC_DUNG &&
      f.ten !== TU_TRU &&
      /var\(\s*--(gain|loss)\s*\)/.test(f.sach),
  );
  expect(pham.map((f) => f.ten)).toEqual([]);
});

test("hàng rào .tsx của luật trên KHÔNG rỗng — nó phải quét được file JSX", () => {
  // Nếu bộ file quét lại chỉ còn `.css` thì luật vừa rồi trở về đúng điểm mù của vá C4
  // mà không có gì đỏ. Đây là chốt chặn cho chính nó.
  expect(FILES.filter((f) => /\.tsx$/.test(f.ten)).length).toBeGreaterThan(10);
});

test("chỗ được phép DÙNG thật sự có dùng — nếu không, hai luật trên vô nghĩa", () => {
  const f = FILES.find((x) => x.ten === NOI_DUOC_DUNG);
  expect(f?.sach).toMatch(/var\(--gain\)/);
  expect(f?.sach).toMatch(/var\(--loss\)/);
});

test("globals.css khai đủ mọi giá trị (light + dark) của xanh/đỏ và hoàng thổ", () => {
  // Chiều ngược của luật trên: xoá một token khỏi `globals.css` mà quên xoá khỏi danh
  // sách thì luật kia vẫn xanh (không ai vi phạm một mã không tồn tại), và hàng rào cứ
  // thế rỗng dần.
  const g = FILES.find((x) => x.ten === NOI_KHAI_TOKEN)?.sach.toUpperCase() ?? "";
  for (const h of HEX_TOKEN) expect(g, `thiếu ${h}`).toContain(h);
});

test("hoàng thổ --stamp không rơi vào file con-so (hai hệ dấu không được lẫn)", () => {
  // PLAN 9.1 giao hoàng thổ cho "thứ mang tính đóng dấu"; con số lãi/lỗ không thuộc nhóm
  // đó. Luật nhỏ, nhưng nó chặn đúng kiểu trôi mà hai luật trên không thấy.
  const f = FILES.find((x) => x.ten === NOI_DUOC_DUNG);
  expect(f?.sach).not.toMatch(/var\(\s*--stamp/);
});

test("A14 — đọc được danh sách 'đóng dấu' từ PLAN 9.1 (không có thì allowlist tự chế)", () => {
  // Tiền đề của cả nhóm A14: nếu phép cắt hỏng, `MUC_PLAN` rỗng và ba bài dưới nghiệm
  // đúng một cách rỗng tuếch.
  expect(MUC_PLAN.length).toBeGreaterThanOrEqual(7);
  expect(MUC_PLAN).toContain("trích vào sổ");
  expect(MUC_PLAN).toContain('nhãn "DRAFT" của `/luat`');
});

/* ---- W3/C3: MA TRẬN 11 biến thể "thêm mục đóng dấu thứ 8" ------------------
 *
 * Tiêu chí là một MA TRẬN, không phải một ca (plan lượt vá 2, C3). Phản biện vòng 2 chạy
 * đúng 11 cách viết; 8 cách bị chặn, **3 cách đi lọt** (D1, D2, D3). Cả 11 nay phải ĐỎ —
 * đỏ đúng (Layer 1 nhận ra một mục lạ) hay đỏ ồn ào (Layer 2 thấy 9.1 đổi) đều được, vì
 * cả hai buộc người sửa mở allowlist ra xem.
 *
 * Không đụng `PLAN.md` thật: mỗi biến thể là một CHUỖI dựng trong bộ nhớ. Và nó sống
 * trong bộ test chứ không chỉ là một lần chạy tay của người nào đó.
 */

const MUC_MOI = "vạch xác nhận đã đọc";

/** Neo dùng để chèn — mỗi neo phải có thật trong `PLAN.md`, kiểm ở bài đo đầu nhóm. */
const NEO = {
  mo_danh_sach: 'mang tính "đóng dấu"**:\n  vạch mới,',
  het_bold: "chỉ số \"Được trích ×N\" trên hồ sơ**",
  ngoac: "*(ba cái sau chốt\n  2026-08-22)*",
  het_cau_nguon: "hàng rào phải suy từ đây, không được tự nới.",
  gach_ke_tiep: "\n- Chữ: Newsreader",
  het_muc: "\n\n### 9.2",
} as const;

function thay(plan: string, cu: string, moi: string): string {
  expect(plan.includes(cu), `PLAN 9.1 đã đổi cách viết — không tìm thấy neo: ${cu}`).toBe(
    true,
  );
  return plan.replace(cu, moi);
}

/** 11 cách một người có thể thêm mục đóng dấu thứ 8 vào PLAN 9.1. */
const BIEN_THE: Readonly<Record<string, (p: string) => string>> = {
  "V1 — chèn vào ĐẦU danh sách, cùng dấu phẩy": (p) =>
    thay(p, NEO.mo_danh_sach, `mang tính "đóng dấu"**:\n  ${MUC_MOI}, vạch mới,`),
  "V2 — chèn vào GIỮA danh sách, cùng dấu phẩy": (p) =>
    thay(p, NEO.mo_danh_sach, `mang tính "đóng dấu"**:\n  vạch mới, ${MUC_MOI},`),
  "V3 — nối vào TRONG cụm in đậm cuối": (p) =>
    thay(p, NEO.het_bold, `chỉ số "Được trích ×N" trên hồ sơ, ${MUC_MOI}**`),
  "V4 — nối SAU cụm in đậm, TRƯỚC dấu ngoặc, in đậm riêng": (p) =>
    thay(p, NEO.het_bold, `chỉ số "Được trích ×N" trên hồ sơ**, **${MUC_MOI}**`),
  "V5 — nối SAU dấu ngoặc, kèm ngoặc ngày tháng riêng (ca của V4 cũ)": (p) =>
    thay(p, `${NEO.ngoac}.`, `${NEO.ngoac}, **${MUC_MOI}** *(chốt 2026-09-01)*.`),
  "D1 — viết TRONG ngoặc chú thích *(…)*": (p) =>
    thay(
      p,
      NEO.ngoac,
      `*(ba cái sau chốt\n  2026-08-22; cộng **${MUC_MOI}** từ 2026-09-01)*`,
    ),
  "V7 — nối bằng gạch ngang thay vì dấu phẩy": (p) =>
    thay(p, NEO.het_bold, `chỉ số "Được trích ×N" trên hồ sơ** — và **${MUC_MOI}**`),
  "D2 — câu MỚI sau `**Danh sách này là NGUỒN…`": (p) =>
    thay(
      p,
      NEO.het_cau_nguon,
      `hàng rào phải suy từ đây, không được tự nới. **${MUC_MOI}** cũng mang tính đóng` +
        " dấu *(chốt 2026-09-01)*.",
    ),
  "D3 — GẠCH ĐẦU DÒNG mới ngay dưới": (p) =>
    thay(
      p,
      NEO.gach_ke_tiep,
      `\n- Hoàng thổ còn dùng cho **${MUC_MOI}** *(chốt 2026-09-01)*.` + NEO.gach_ke_tiep,
    ),
  "V10 — gạch đầu dòng CON, thụt vào dưới mục 9.1": (p) =>
    thay(
      p,
      NEO.gach_ke_tiep,
      `\n  - và **${MUC_MOI}** *(chốt 2026-09-01)*.` + NEO.gach_ke_tiep,
    ),
  "V11 — đoạn văn MỚI ở cuối mục 9.1": (p) =>
    thay(
      p,
      NEO.het_muc,
      `\n\nBổ sung 2026-09-01: **${MUC_MOI}** cũng mang tính "đóng dấu".` + NEO.het_muc,
    ),
};

/** **Lớp 1 một mình** — suy allowlist từ PLAN rồi so hai chiều. Trả `null` nếu XANH.
 *
 * Tách khỏi `hangRaoDo` ở X3 để phân vai hai lớp là thứ **đo được**, không phải một câu
 * trong docstring. Xem khối "PHÂN VAI THẬT" đầu file: lớp này mù với D2 và D3.
 */
function lop1Do(plan: string): string | null {
  let muc: string[];
  try {
    muc = docMucDongDau(plan);
  } catch (e) {
    return `lớp 1 NÉM: ${(e as Error).message}`;
  }
  const tu_che = Object.keys(STAMP_THEO_MUC).filter((m) => !muc.includes(m));
  if (tu_che.length > 0) return `lớp 1: allowlist viện dẫn mục không có thật ${tu_che}`;
  const bo_quen = muc.filter((m) => !(m in STAMP_THEO_MUC) && !(m in CHUA_TOI_PHASE));
  if (bo_quen.length > 0) return `lớp 1: mục PLAN không ai cài ${bo_quen}`;
  const chet = Object.keys(CHUA_TOI_PHASE).filter((m) => !muc.includes(m));
  if (chet.length > 0) return `lớp 1: giấy hoãn chết ${chet}`;
  return null;
}

/** **Lớp 2 một mình** — băm nguyên văn mục 9.1. Trả `null` nếu XANH. */
function lop2Do(plan: string): string | null {
  try {
    return bamMuc91(plan) !== BAM_MUC_91 ? "lớp 2: băm mục 9.1 đã đổi" : null;
  } catch (e) {
    return `lớp 2 NÉM: ${(e as Error).message}`;
  }
}

/** Hàng rào có ĐỎ với bản PLAN này không? Gộp CẢ HAI lớp, đúng như bộ test thật.
 *
 * Trả `null` nếu XANH — tức bản PLAN ấy đi lọt, tức có một vai đóng dấu trong spec mà
 * không ai cài và không có gì kêu.
 */
function hangRaoDo(plan: string): string | null {
  return lop1Do(plan) ?? lop2Do(plan);
}

test("W3 — `PLAN.md` NGUYÊN BẢN thì hàng rào XANH (không thì ma trận dưới vô nghĩa)", () => {
  // Vế chống rỗng của cả nhóm: nếu `hangRaoDo` đỏ với MỌI đầu vào thì "11 biến thể đều
  // đỏ" là một câu không nói lên điều gì.
  expect(hangRaoDo(PLAN_THAT)).toBeNull();
  expect(Object.keys(BIEN_THE)).toHaveLength(11);
});

test("W3 — mọi neo chèn đều có thật trong PLAN 9.1", () => {
  // Neo trôi thì biến thể trở thành "chuỗi y hệt bản gốc", và bản gốc thì XANH — cả ma
  // trận sẽ đỏ hàng loạt với thông điệp đúng, nhưng ở đây thì nó nói rõ ra ngay.
  for (const [ten, neo] of Object.entries(NEO)) {
    expect(PLAN_THAT.includes(neo), `neo ${ten} không còn trong PLAN.md`).toBe(true);
  }
});

for (const [ten, dung] of Object.entries(BIEN_THE)) {
  test(`W3/C3 — biến thể ${ten} phải làm hàng rào ĐỎ`, () => {
    const gia = dung(PLAN_THAT);
    expect(gia, "biến thể không đổi được gì so với bản gốc").not.toBe(PLAN_THAT);
    expect(gia).toContain(MUC_MOI);
    expect(
      hangRaoDo(gia),
      `biến thể ${ten} ĐI LỌT — PLAN có một vai đóng dấu không ai cài, không gì kêu`,
    ).not.toBeNull();
  });
}

/* ---- X3: hai lớp đo RIÊNG, và luật D1 có bài đo của chính nó ----------------
 *
 * Vòng trước: gỡ hẳn luật D1 khỏi `docMucDongDau` ⇒ **139 bài vẫn xanh**, vì mọi biến thể
 * của ma trận trên đều bị lớp 2 bắt trước. Ma trận đo "hàng rào có đỏ không"; nó không
 * đo "lớp nào đỏ", nên nó không thể hụt khi một lớp chết.
 *
 * Ba bài dưới đây tách hẳn: gọi thẳng `docMucDongDau`, và đo `lop1Do` không kèm băm.
 * Cách này chính là cách file đã làm cho ba ca fail-closed ở bài "A14/B6".
 */

test("X3 lớp 1 — luật D1: cụm in đậm nằm TRONG ngoặc chú thích thì NÉM", () => {
  // Cửa do chính V4 mở: bước xoá `NGOAC` nuốt trọn mọi thứ trong một cặp ngoặc, kể cả
  // một mục viết trong đó. Gỡ luật này khỏi `docMucDongDau` ⇒ bài này đỏ, một mình.
  const gia = BIEN_THE["D1 — viết TRONG ngoặc chú thích *(…)*"](PLAN_THAT);
  expect(() => docMucDongDau(gia)).toThrow(/cửa D1/);
  // …và nó ném vì đúng lý do, không phải vì mốc cắt trôi.
  expect(() => docMucDongDau(gia)).toThrow(/in đậm nằm TRONG ngoặc/);
});

test("X3 lớp 1 — bản PLAN nguyên gốc thì lớp 1 KHÔNG ném và KHÔNG đỏ", () => {
  // Vế chống rỗng của hai bài kia: một `docMucDongDau` ném với mọi đầu vào cũng làm
  // "D1 ⇒ toThrow" xanh.
  expect(() => docMucDongDau(PLAN_THAT)).not.toThrow();
  expect(lop1Do(PLAN_THAT)).toBeNull();
  expect(lop2Do(PLAN_THAT)).toBeNull();
});

/** Sáu biến thể mà **lớp 1 tự mình** phải nhận ra là "có mục lạ". */
const LOP_1_BAT_DUOC = [
  "V1 — chèn vào ĐẦU danh sách, cùng dấu phẩy",
  "V2 — chèn vào GIỮA danh sách, cùng dấu phẩy",
  "V3 — nối vào TRONG cụm in đậm cuối",
  "V4 — nối SAU cụm in đậm, TRƯỚC dấu ngoặc, in đậm riêng",
  "V5 — nối SAU dấu ngoặc, kèm ngoặc ngày tháng riêng (ca của V4 cũ)",
  "V7 — nối bằng gạch ngang thay vì dấu phẩy",
] as const;

for (const ten of LOP_1_BAT_DUOC) {
  test(`X3 lớp 1 — biến thể ${ten} phải đỏ KHÔNG cần tới lớp băm`, () => {
    const gia = BIEN_THE[ten](PLAN_THAT);
    expect(
      lop1Do(gia),
      `${ten} chỉ đỏ nhờ lớp 2 — gỡ lớp băm là cửa này mở lại`,
    ).not.toBeNull();
  });
}

test("X3 — chỗ lớp 1 MÙ: D2 và D3 chỉ có lớp băm bắt được", () => {
  // Sự thật khó chịu, ghim thành bài đo để nó không biến mất khỏi trí nhớ tập thể:
  // hai cách viết này KHÔNG bị lớp 1 nhận ra. `hangRaoDo` xanh thì cả ma trận trên đỏ,
  // nhưng nó đỏ nhờ băm — tức **gỡ `BAM_MUC_91` là mở lại đúng hai cửa này**.
  //
  // Bài này đỏ nếu một ngày lớp 1 khôn hơn. Đó là TIN TỐT: lúc ấy xoá dòng tương ứng
  // khỏi đây và thêm nó vào `LOP_1_BAT_DUOC` bên trên.
  for (const ten of [
    "D2 — câu MỚI sau `**Danh sách này là NGUỒN…`",
    "D3 — GẠCH ĐẦU DÒNG mới ngay dưới",
  ] as const) {
    const gia = BIEN_THE[ten](PLAN_THAT);
    expect(lop1Do(gia), `lớp 1 nay BẮT được ${ten} — xem lại danh sách`).toBeNull();
    expect(lop2Do(gia), `${ten} lọt CẢ HAI lớp`).not.toBeNull();
  }
});

test("W3 — lớp 2 ghim ĐÚNG mục 9.1, không ghim cả file", () => {
  // Nếu `catMuc91` lỡ cắt cả PLAN thì lớp 2 đỏ mỗi lần ai sửa một mục bất kỳ — nó sẽ bị
  // gỡ trong ba ngày, và hàng rào quay về một lớp.
  const than = catMuc91(PLAN_THAT);
  expect(than.startsWith("### 9.1")).toBe(true);
  expect(than).not.toContain("### 9.2");
  expect(than).toContain(MOC_DAU);
  expect(than.length).toBeLessThan(PLAN_THAT.length / 4);

  // …và đổi một chỗ NGOÀI 9.1 thì lớp 2 im lặng.
  const ngoai = PLAN_THAT.replace("### 9.2", "### 9.2 (đổi tiêu đề)");
  expect(ngoai).not.toBe(PLAN_THAT);
  expect(bamMuc91(ngoai)).toBe(BAM_MUC_91);
});

test("A14/B6 — cắt hỏng thì NÉM, không trả allowlist rỗng cho qua (fail-closed)", () => {
  // Mảng rỗng làm ba bài A14 nghiệm đúng một cách rỗng tuếch: không mục nào tự chế,
  // không mục nào bị bỏ quên, và allowlist trở lại đúng "một mảng gõ tay không nối với
  // PLAN" — thứ cả nhóm bài này sinh ra để diệt.
  expect(() => docMucDongDau("PLAN không có câu nào cả")).toThrow(/mốc đầu/);
  expect(() =>
    docMucDongDau('… mang tính "đóng dấu"**: vạch mới, "đã sửa" — hết bài.'),
  ).toThrow(/mốc cuối/);
  expect(() =>
    docMucDongDau('… mang tính "đóng dấu"**: **Danh sách này là NGUỒN …'),
  ).toThrow(/không ra mục nào/);
});

test("W3 lớp 2 — mục 9.1 của PLAN.md khớp băm đã ghim", () => {
  expect(
    bamMuc91(PLAN_THAT),
    "PLAN 9.1 vừa đổi. ĐỌC LẠI nó, chỉnh `STAMP_THEO_MUC` / `CHUA_TOI_PHASE` cho khớp, " +
      "RỒI mới cập nhật `BAM_MUC_91`. Cập nhật băm trước là bỏ qua đúng việc bài đo này " +
      "sinh ra để bắt bạn làm.",
  ).toBe(BAM_MUC_91);
});

test("A14 — mỗi selector được cấp phép phải viện dẫn một mục CÓ THẬT trong PLAN 9.1", () => {
  // Cửa mà mảng gõ tay cũ để ngỏ: thêm một dòng vào allowlist là nới luật, và không có
  // gì nối nó với PLAN.
  const tu_che = Object.keys(STAMP_THEO_MUC).filter((m) => !MUC_PLAN.includes(m));
  expect(tu_che, "mục không có trong PLAN 9.1").toEqual([]);
});

test("A14 — mọi mục của PLAN 9.1 đều được xử: hoặc cấp selector, hoặc khai chưa tới phase", () => {
  // Chiều ngược. Không có nó thì PLAN thêm một vai đóng dấu mới mà không ai cài, và hàng
  // rào vẫn xanh — luật nằm trong PLAN, không nằm trong code.
  const bo_quen = MUC_PLAN.filter(
    (m) => !(m in STAMP_THEO_MUC) && !(m in CHUA_TOI_PHASE),
  );
  expect(bo_quen, "mục PLAN 9.1 không ai cài và cũng không ai khai hoãn").toEqual([]);
});

test("A14 — `CHUA_TOI_PHASE` không chứa mục đã biến mất khỏi PLAN (giấy hoãn chết)", () => {
  const chet = Object.keys(CHUA_TOI_PHASE).filter((m) => !MUC_PLAN.includes(m));
  expect(chet).toEqual([]);
});

test("--stamp chỉ nằm ở những SELECTOR mang tính đóng dấu (PLAN 9.1)", () => {
  expect(khoiDungStamp()).toEqual([...STAMP_DUOC_PHEP].sort());
});

test("allowlist --stamp không rỗng và không có dòng chết", () => {
  // Hai chiều: danh sách rỗng nghĩa là phép tách khối đã hỏng và luật trên nghiệm đúng
  // với mọi thứ; dòng chết nghĩa là ai đó xoá chỗ dùng mà quên xoá giấy phép, và giấy
  // phép còn đó thì lần sau nó cấp lại cho một chỗ dùng khác.
  const thuc_te = khoiDungStamp();
  expect(thuc_te.length).toBeGreaterThan(0);
  expect(STAMP_DUOC_PHEP.filter((x) => !thuc_te.includes(x))).toEqual([]);
});

test("var(--stamp) KHÔNG được viết thẳng trong .tsx (cùng điểm mù với vá C4)", () => {
  const pham = FILES.filter(
    (f) =>
      /\.tsx?$/.test(f.ten) &&
      f.ten !== TU_TRU &&
      /var\(\s*--stamp/.test(f.sach),
  );
  expect(pham.map((f) => f.ten)).toEqual([]);
});
