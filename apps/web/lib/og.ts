import { readFile } from "node:fs/promises";
import { join } from "node:path";

/** Vật liệu dùng chung của ba file `opengraph-image.tsx` (Phase 6, PLAN mục 10).
 *
 * Ảnh OG là **kênh phát tán chính**: người ta dán link mạch lên Facebook/Zalo và cái
 * hiện ra ở đó quyết định có ai bấm không. Vì thế nó được sinh tại chỗ bằng
 * `ImageResponse` của Next (satori → PNG), **không gọi dịch vụ ngoài** — một dịch vụ
 * chụp ảnh bên thứ ba là một phụ thuộc nữa phải sống, phải trả tiền, và phải chờ.
 *
 * ## Vì sao màu phải gõ cứng ở đây, và cái giá của nó
 *
 * `ImageResponse` render bằng satori: **không có DOM, không có CSS custom property**, nên
 * `var(--ink)` không giải được — nó ra màu rỗng chứ không ra lỗi. Bảng `MAU_OG` dưới đây
 * vì thế là bản SAO của khối `:root` trong `app/globals.css`, và bản sao thì trôi. Chốt
 * chặn là bài đo `e2e/don-vi/og-anh.spec.ts`: nó đọc `globals.css` và đòi từng giá trị ở
 * đây khớp đúng token tương ứng trong `TOKEN_CUA_MAU`.
 *
 * ⚠ **Không có hoàng thổ trong ảnh OG, kể cả cho nhãn "ĐÃ ĐÓNG SỔ"** — thứ mà PLAN 9.1
 * xếp đúng vào nhóm "đóng dấu". Lý do là một ràng buộc của hàng rào chứ không phải một
 * lựa chọn thẩm mỹ: `e2e/don-vi/mau-token.spec.ts` cấm mã hex `#B07A2B`/`#D8A455` xuất
 * hiện ở bất kỳ file nào ngoài `app/globals.css`, và ở đây không có `var()` để đi vòng.
 * Nhãn đóng sổ vì thế vẽ bằng **mực + khung viền**. Muốn có hoàng thổ thật thì phải mở
 * một cửa mới cho hàng rào (một allowlist riêng cho hằng màu của satori) — đó là một
 * quyết định có chủ đích, phải ghi vào plan con, không phải một dòng sửa lén.
 */

/** 1200×630 — khổ Facebook/Twitter đọc được, và là khổ Next dùng cho `size`. */
export const KHUNG_OG = { width: 1200, height: 630 } as const;

export const KIEU_OG = "image/png";

/** Bảng màu của ảnh OG. Khoá = vai trò, giá trị = mã hex lấy từ `:root` của
 * `app/globals.css`. Chỉ có bản SÁNG ("nền giấy lạnh" của PLAN 9.1): ảnh OG là một tệp
 * PNG tĩnh, nó không biết theme của người xem. */
export const MAU_OG = {
  nen: "#f1f2f5",
  the: "#ffffff",
  muc: "#14161b",
  muc_2: "#535a67",
  muc_3: "#868d9b",
  vach: "#c7cbd4",
  nhan: "#3a46a8",
} as const;

/** `MAU_OG` ↔ token trong `app/globals.css`. Bài đo dùng bảng này để so hai bên; thêm một
 * màu vào `MAU_OG` mà quên khai ở đây là ĐỎ, và đó là chủ đích — một màu không truy được
 * về token nào là một màu vừa lọt ra ngoài hệ. */
export const TOKEN_CUA_MAU: Readonly<Record<keyof typeof MAU_OG, string>> = {
  nen: "--bg",
  the: "--surface",
  muc: "--ink",
  muc_2: "--ink-2",
  muc_3: "--ink-3",
  vach: "--line-2",
  nhan: "--accent",
};

/** Ba mặt chữ của PLAN 9.1 ở dạng **TTF**, đọc từ đĩa.
 *
 * `next/font/google` không dùng lại được: nó sinh `.woff2` và gắn vào CSS của trang, mà
 * satori chỉ nhận `ttf`/`otf`/`woff` và nhận qua tham số chứ không qua CSS.
 *
 * Và **không được để `ImageResponse` tự chọn font mặc định**: bản mặc định của `next/og`
 * là Noto Sans **latin**, không có Latin Extended Additional ⇒ mọi chữ có dấu tiếng Việt
 * ra ô vuông. Một ảnh OG toàn ô vuông trên Facebook còn tệ hơn không có ảnh nào.
 */
export const THU_MUC_FONT = join(process.cwd(), "assets", "font");

export const TEN_FILE_FONT = {
  tieu_de: "Newsreader-SemiBold.ttf",
  ui: "BeVietnamPro-Regular.ttf",
  mono: "IBMPlexMono-Medium.ttf",
} as const;

type MatChu = {
  name: string;
  data: ArrayBuffer;
  weight: 400 | 600;
  style: "normal";
};

/** Đọc một lần cho cả tiến trình. Ba file ≈ 360 KB; đọc lại ở mỗi request là ba lần chạm
 * đĩa cho một ảnh mà CDN sẽ cache. */
let dang_doc: Promise<MatChu[]> | null = null;

export function docMatChu(): Promise<MatChu[]> {
  dang_doc ??= Promise.all([
    doc(TEN_FILE_FONT.tieu_de, "Newsreader", 600),
    doc(TEN_FILE_FONT.ui, "Be Vietnam Pro", 400),
    doc(TEN_FILE_FONT.mono, "IBM Plex Mono", 400),
  ]);
  return dang_doc;
}

async function doc(ten_file: string, name: string, weight: 400 | 600): Promise<MatChu> {
  const buf = await readFile(join(THU_MUC_FONT, ten_file));
  return {
    name,
    // `Uint8Array` của Node có thể là một lát cắt của pool dùng chung, nên `.buffer`
    // trần đôi khi to hơn nội dung file và satori đọc phải rác ở đuôi.
    data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    weight,
    style: "normal",
  };
}

/** Nội dung CHỮ của một ảnh OG — tách khỏi phần vẽ để đo được mà không cần render PNG.
 *
 * Ba dòng, đúng thứ tự mắt đọc: *ở đâu* → *cái gì* → *bao nhiêu*.
 */
export type DuLieuOg = {
  /** Dòng nhãn trên cùng: nơi chốn (`s/<slug> · <tên sub>`). */
  nhan: string;
  /** Dòng lớn nhất, và là dòng **bắt buộc không rỗng**. */
  tieuDe: string;
  /** Dòng chân, các mảnh đã ghép bằng `" · "`. Rỗng thì không vẽ. */
  dongPhu: string;
  /** Số ô trên spine (0 = không vẽ spine). */
  soOSpine: number;
  /** Mạch đã đóng sổ ⇒ vẽ nhãn "ĐÃ ĐÓNG SỔ". */
  dongSo: boolean;
};

/** Số ô spine tối đa vẽ ra. Mạch 40 mốc mà vẽ 40 ô thì mỗi ô còn 2px — hết là spine, chỉ
 * còn một vệt xám. Quá ngưỡng thì ô cuối mang dấu `+`. */
export const TRAN_O_SPINE = 12;

/** Cắt chuỗi theo **ký tự hiển thị**, thêm `…` khi phải cắt.
 *
 * `Array.from` chứ không `slice`: tiếng Việt tổ hợp và emoji nằm ngoài BMP đều là nhiều
 * mã đơn vị UTF-16, `slice` cắt giữa một cặp thay thế cho ra ký tự hỏng.
 */
export function catChu(s: string, tran: number): string {
  const gon = s.replace(/\s+/g, " ").trim();
  const ky_tu = Array.from(gon);
  return ky_tu.length <= tran ? gon : `${ky_tu.slice(0, tran - 1).join("")}…`;
}

/** Ghép các mảnh của dòng chân, bỏ mảnh rỗng. */
export function ghepDongPhu(manh: readonly (string | null | undefined)[]): string {
  return manh.filter((x): x is string => typeof x === "string" && x.trim() !== "").join(" · ");
}

export const TRAN_TIEU_DE_OG = 96;

export function ogTrangChu(): DuLieuOg {
  return {
    nhan: "gikky.net",
    tieuDe: "Nhật ký giao dịch, ghi trước khi biết kết quả",
    dongPhu: ghepDongPhu([
      "Diễn đàn trading tiếng Việt",
      "Dấu thời gian máy chủ bất biến",
    ]),
    soOSpine: 0,
    dongSo: false,
  };
}

export function ogSub(sub: {
  slug: string;
  ten: string;
  mo_ta: string;
  so_mach: number;
}): DuLieuOg {
  return {
    nhan: `s/${sub.slug}`,
    tieuDe: catChu(sub.ten, TRAN_TIEU_DE_OG),
    dongPhu: ghepDongPhu([
      catChu(sub.mo_ta, 90),
      `${sub.so_mach} mạch`,
    ]),
    soOSpine: 0,
    dongSo: false,
  };
}

/** Ảnh OG của một mạch — PLAN mục 10 Phase 6: *"title + ket_qua + spine"*.
 *
 * `entry_count` vào cả hai chỗ, và đó không phải trùng lặp: **số** nằm ở dòng chân cho
 * người đọc, **spine** cho người liếc. Mạch một mốc (post thường) không có spine —
 * `entry_count === 1` thì một ô đơn độc chỉ gây hiểu nhầm là "mạch mới có 1/N mốc".
 */
export function ogMach(mach: {
  title: string;
  ket_qua: string | null;
  status: string;
  entry_count: number;
  sub: { slug: string; ten: string };
  author: { username: string };
}): DuLieuOg {
  return {
    nhan: ghepDongPhu([`s/${mach.sub.slug}`, catChu(mach.sub.ten, 40)]),
    tieuDe: catChu(mach.title, TRAN_TIEU_DE_OG),
    dongPhu: ghepDongPhu([
      mach.ket_qua === null ? null : catChu(mach.ket_qua, 40),
      `${mach.entry_count} mốc`,
      `u/${mach.author.username}`,
    ]),
    soOSpine: mach.entry_count >= 2 ? Math.min(mach.entry_count, TRAN_O_SPINE) : 0,
    dongSo: mach.status === "closed",
  };
}
