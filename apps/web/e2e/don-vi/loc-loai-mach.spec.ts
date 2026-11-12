import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import { LOAI_MACH, NHAN_LOAI_MACH } from "../../lib/api";
import { NHAN_NGAN_LOAI_MACH, TEN_THUONG_LOAI_MACH, hrefChipLoai } from "../../lib/loc-loai-mach";

import { boChuThich } from "./quet";

/** Hàng chip lọc loại của `/s/<sub>` (plan `2026-11-10-chuyen-muc-loc-loai.md`, tiêu chí C9
 * + các hàng rào "chỉ cộng, không bớt").
 *
 * Phần 1 đo hàm thuần dựng href. Phần 2 là hàng rào grep trên mã nguồn — không mở trình duyệt,
 * không chạm server — ghim ba điều mà bài đo chromium không thấy hết:
 *  1. nhãn loại chỉ được bật từ MỘT cặp nơi (trang sub), nên hồ sơ / tìm kiếm / `/?tab=…` /
 *     khối Nhật ký của `/` không đổi DOM;
 *  2. `<head>` của `/s/<sub>` không phụ thuộc `?loai_mach=`;
 *  3. trang sub thực sự đọc `?loai_mach=` bằng `docLoaiMach` và chuyển nó xuống API.
 */

const WEB = resolve(__dirname, "..", "..");
const doc = (...p: string[]) => readFileSync(resolve(WEB, ...p), "utf8");

const MAC_DINH = { tab: "moi", khoang: "tat_ca" } as const;
const CO_BAN = "/s/chung-khoan";

test.describe("C9 — `hrefChipLoai`", () => {
  test('"Tất cả" ở trạng thái mặc định là đường dẫn gốc TRẦN (không `?`, không `loai_mach`)', () => {
    expect(hrefChipLoai(CO_BAN, MAC_DINH, undefined)).toBe(CO_BAN);
  });

  test("ba chip loại thêm đúng `loai_mach`", () => {
    for (const l of LOAI_MACH) {
      expect(hrefChipLoai(CO_BAN, MAC_DINH, l)).toBe(`${CO_BAN}?loai_mach=${l}`);
    }
  });

  test("giữ `tab` và `khoang` khác mặc định, theo thứ tự tab → khoang → loai_mach", () => {
    const h = { tab: "nhieu-diem", khoang: "tuan" } as const;
    expect(hrefChipLoai(CO_BAN, h, undefined)).toBe(`${CO_BAN}?tab=nhieu-diem&khoang=tuan`);
    expect(hrefChipLoai(CO_BAN, h, "bai_viet")).toBe(
      `${CO_BAN}?tab=nhieu-diem&khoang=tuan&loai_mach=bai_viet`,
    );
    expect(hrefChipLoai(CO_BAN, { tab: "dang-dien-ra", khoang: "tat_ca" }, "nhat_ky")).toBe(
      `${CO_BAN}?tab=dang-dien-ra&loai_mach=nhat_ky`,
    );
    expect(hrefChipLoai(CO_BAN, { tab: "moi", khoang: "thang" }, "thao_luan")).toBe(
      `${CO_BAN}?khoang=thang&loai_mach=thao_luan`,
    );
  });

  test("chip 'Tất cả' BỎ `loai_mach` dù đang lọc, nhưng vẫn giữ phần còn lại", () => {
    // Hàm không nhận loại hiện tại làm đầu vào: chip Tất cả tự nó không có đường nào để mang
    // `loai_mach` theo. Ca này ghim điều đó ở mức quan sát.
    expect(hrefChipLoai(CO_BAN, { tab: "nhieu-diem", khoang: "ngay", truongPhai: "scalp" }, undefined)).toBe(
      `${CO_BAN}?tab=nhieu-diem&khoang=ngay&truong_phai=scalp`,
    );
  });

  test("`truong_phai` được mã hoá: &, #, dấu cách, chữ có dấu không làm vỡ query", () => {
    const h = { ...MAC_DINH, truongPhai: "a&b #c d/é" };
    const href = hrefChipLoai(CO_BAN, h, "bai_viet");
    expect(href).toBe(`${CO_BAN}?truong_phai=${encodeURIComponent("a&b #c d/é")}&loai_mach=bai_viet`);
    // Đọc ngược bằng parser URL thật: ra đúng hai tham số, giá trị nguyên vẹn.
    const q = new URL(href, "http://x").searchParams;
    expect([...q.keys()]).toEqual(["truong_phai", "loai_mach"]);
    expect(q.get("truong_phai")).toBe("a&b #c d/é");
  });

  test("KHÔNG BAO GIỜ mang `cursor` (hàm không có đường nhận nó)", () => {
    for (const l of [undefined, ...LOAI_MACH]) {
      expect(hrefChipLoai(CO_BAN, { tab: "nhieu-diem", khoang: "tuan", truongPhai: "x" }, l)).not.toContain(
        "cursor",
      );
    }
    // Chữ ký chỉ có ba tham số: coBan, trạng thái hiện tại (tab/khoang/truongPhai), loại.
    expect(hrefChipLoai.length).toBe(3);
  });

  test("truong_phai rỗng không sinh `truong_phai=`", () => {
    expect(hrefChipLoai(CO_BAN, { ...MAC_DINH, truongPhai: "" }, undefined)).toBe(CO_BAN);
  });
});

test.describe("bảng chữ", () => {
  test("đủ ba loại ở cả hai bảng, chữ ngắn và không có 'tham gia'", () => {
    expect(Object.keys(NHAN_NGAN_LOAI_MACH).sort()).toEqual([...LOAI_MACH].sort());
    expect(Object.keys(TEN_THUONG_LOAI_MACH).sort()).toEqual([...LOAI_MACH].sort());
    expect(NHAN_NGAN_LOAI_MACH).toEqual({ nhat_ky: "Nhật ký", bai_viet: "Bài viết", thao_luan: "Chủ đề" });
    for (const l of LOAI_MACH) {
      expect(NHAN_NGAN_LOAI_MACH[l].toLowerCase()).not.toContain("tham gia");
      // Chữ ngắn thật sự ngắn hơn (hoặc bằng) tên đầy đủ — chỉ "Chủ đề thảo luận" khác.
      expect(NHAN_NGAN_LOAI_MACH[l].length).toBeLessThanOrEqual(NHAN_LOAI_MACH[l].length);
      expect(TEN_THUONG_LOAI_MACH[l]).toBe(NHAN_NGAN_LOAI_MACH[l].toLowerCase());
    }
  });
});

test.describe("hàng rào nguồn", () => {
  /** Mọi `.tsx` dưới `app/` và `components/` (bỏ chú thích). */
  function nguon(): { ten: string; sach: string }[] {
    const ra: { ten: string; sach: string }[] = [];
    const di = (thu_muc: string) => {
      for (const t of readdirSync(thu_muc, { withFileTypes: true })) {
        const p = resolve(thu_muc, t.name);
        if (t.isDirectory()) di(p);
        else if (t.name.endsWith(".tsx")) {
          ra.push({ ten: p.slice(WEB.length + 1).replace(/\\/g, "/"), sach: boChuThich(readFileSync(p, "utf8")) });
        }
      }
    };
    di(resolve(WEB, "app"));
    di(resolve(WEB, "components"));
    return ra;
  }

  test("`hienNhanLoai` mặc định `false` và chỉ `Feed` / `CuonVoHan` bật, luôn theo `sub`", () => {
    const the_mach = boChuThich(doc("components/the-mach.tsx"));
    expect(the_mach).toMatch(/hienNhanLoai\s*=\s*false/);

    const bat = nguon().filter((f) => /hienNhanLoai=/.test(f.sach));
    expect(bat.map((f) => f.ten).sort(), "đo rỗng hoặc có nơi lạ bật nhãn").toEqual([
      "components/cuon-vo-han.tsx",
      "components/feed.tsx",
    ]);
    for (const f of bat) {
      const dong = [...f.sach.matchAll(/hienNhanLoai=\{([^}]*)\}/g)].map((m) => m[1].trim());
      expect(dong.length, f.ten).toBeGreaterThan(0);
      for (const v of dong) expect(v, `${f.ten}: nhãn phải bật theo \`sub\``).toBe("sub !== undefined");
    }
  });

  test("mọi file khác (hồ sơ, trang chủ…) không truyền `hienNhanLoai`; tìm kiếm bật CỐ ĐỊNH", () => {
    // Tìm kiếm (đợt D thống nhất giao diện, 2026-11-12): kết quả là `TheMach` và danh sách luôn lẫn
    // cả ba loại mạch ⇒ nhãn loại bật cố định (prop trần, không theo điều kiện nào) — plan §4.1.
    const tim = nguon().find((f) => f.ten === "components/ket-qua-tim-kiem.tsx");
    expect(tim, "đo rỗng: không thấy ket-qua-tim-kiem.tsx").toBeDefined();
    expect(tim!.sach).toMatch(/<TheMach[^>]*\shienNhanLoai\s/);
    expect(tim!.sach, "tìm kiếm bật nhãn cố định, không theo biểu thức").not.toContain("hienNhanLoai=");
    for (const f of nguon()) {
      // the-mach.tsx là nơi ĐỊNH NGHĨA prop; feed/cuon-vo-han là hai nơi được bật theo `sub`.
      if (
        [
          "components/the-mach.tsx",
          "components/feed.tsx",
          "components/cuon-vo-han.tsx",
          "components/ket-qua-tim-kiem.tsx",
        ].includes(f.ten)
      )
        continue;
      expect(f.sach, f.ten).not.toContain("hienNhanLoai");
    }
  });

  test("`generateMetadata` của `/s/<sub>` không đọc `searchParams` / `loai_mach`", () => {
    const trang = boChuThich(doc("app/s/[sub]/page.tsx"));
    const dau = trang.indexOf("export async function generateMetadata");
    const cuoi = trang.indexOf("export default async function");
    expect(dau, "đo rỗng: không thấy generateMetadata").toBeGreaterThanOrEqual(0);
    expect(cuoi).toBeGreaterThan(dau);
    const metadata = trang.slice(dau, cuoi);
    expect(metadata).not.toContain("searchParams");
    expect(metadata).not.toContain("loai_mach");
    expect(metadata).not.toContain("loaiMach");
  });

  test("trang sub đọc `?loai_mach=` bằng `docLoaiMach` và chuyển xuống API lẫn `Feed`", () => {
    const trang = boChuThich(doc("app/s/[sub]/page.tsx"));
    expect(trang).toMatch(/docLoaiMach\(q\.loai_mach\)/);
    expect(trang).toMatch(/docFeedSub\([\s\S]*?loai_mach:\s*loaiMach/);
    expect(trang).toMatch(/<Feed[\s\S]*loaiMach=\{loaiMach\}/);
  });

  test("`cuon-vo-han.tsx` chuyển `loai_mach: loaiMach` vào lời gọi `docFeedOTrinhDuyet` (trang 2 giữ loại)", () => {
    const cuon = boChuThich(doc("components/cuon-vo-han.tsx"));
    const goi = /docFeedOTrinhDuyet\(\s*tab\s*,\s*\{([\s\S]*?)\}\s*\)/.exec(cuon);
    expect(goi, "đo rỗng: không thấy lời gọi docFeedOTrinhDuyet").not.toBeNull();
    // Bài e2e chromium khó bắt mutant này vì seed xếp loại liền khối; hàng rào grep bắt thẳng.
    expect(goi![1]).toMatch(/\bloai_mach\s*:\s*loaiMach\b/);
  });

  // Đợt C (việc 14): bài này từng ghim "chip 'Loại: …' còn ở `/`, hàng chip chỉ ở trang sub". Nay hàng
  // chip Loại hiện ở CẢ HAI trang và chip "Loại: … ✕ Bỏ lọc" bị gỡ hẳn (hàng chip thay nó) — hiện cả
  // hai là báo một bộ lọc hai lần. Bài đo đảo chiều: chip cũ không còn, `LocLoaiMach` vô điều kiện.
  test("chip 'Loại: …' cũ bị gỡ; hàng chip `LocLoaiMach` dựng vô điều kiện (cả `/` lẫn trang sub)", () => {
    const feed = boChuThich(doc("components/feed.tsx"));
    expect(feed).not.toContain("bo-loc-loai-mach");
    expect(feed).not.toMatch(/Loại:\s*<strong>/);
    expect(feed).toMatch(/<LocLoaiMach\b/);
    expect(feed).not.toMatch(/\{sub\s*!==\s*undefined\s*&&\s*\(\s*<LocLoaiMach/);
  });
});
