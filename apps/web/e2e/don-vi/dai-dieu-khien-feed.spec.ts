import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import {
  KHOANG_MAC_DINH,
  LOAI_MACH,
  NHAN_TRANG_THAI_FEED,
  TAB_FEED,
  TRANG_THAI_FEED,
  type KhoangFeed,
  type TabFeed,
} from "../../lib/api";
import {
  TIEU_DE_TRANG_LOC,
  cauFeedRong,
  hienHangTrangThai,
  hrefChipLoai,
  hrefLoaiTrongSub,
  hrefTrangThai,
  nhanChipTrangThai,
  tieuDeTrangLoc,
} from "../../lib/loc-loai-mach";

import { boChuThich } from "./quet";

/** Dải điều khiển chung của feed — việc 14, đợt C (plan `2026-11-11-thong-nhat-giao-dien-toan-site.md`
 * §4.2–4.4, tiêu chí T2 / T4). Phần đo KHÔNG cần trình duyệt: hàm thuần dựng href + các hàng rào
 * grep trên mã nguồn. Phần chạy trên bản build thật ở `e2e/dai-dieu-khien-feed.spec.ts`. */

const WEB = resolve(__dirname, "..", "..");
const doc = (...p: string[]) => readFileSync(resolve(WEB, ...p), "utf8");

test.describe("`hrefTrangThai` — một mục của hàng Trạng thái", () => {
  const goc = { tab: "moi", khoang: KHOANG_MAC_DINH, loaiMach: "nhat_ky" } as const;

  test("ba mục ở trạng thái mặc định: đúng URL mà dải tab của khối nhật ký trang chủ đã dùng", () => {
    // Ba chuỗi này là hợp đồng với trang chủ (T2): đổi một ký tự là bấm từ trang chủ sang không còn
    // sáng đúng mục. Chuỗi CỨNG, không tính lại bằng chính hàm đang đo.
    expect(hrefTrangThai("/", goc, undefined)).toBe("/?tab=moi&loai_mach=nhat_ky");
    expect(hrefTrangThai("/", goc, "open")).toBe("/?tab=moi&loai_mach=nhat_ky&trang_thai=open");
    expect(hrefTrangThai("/", goc, "closed")).toBe("/?tab=moi&loai_mach=nhat_ky&trang_thai=closed");
  });

  test("giữ tab, khoảng, trường phái, loại theo thứ tự tab → khoang → truong_phai → loai_mach → trang_thai", () => {
    expect(
      hrefTrangThai(
        "/s/chung-khoan",
        { tab: "nhieu-diem", khoang: "tuan", truongPhai: "scalp", loaiMach: "nhat_ky" },
        "closed",
      ),
    ).toBe("/s/chung-khoan?tab=nhieu-diem&khoang=tuan&truong_phai=scalp&loai_mach=nhat_ky&trang_thai=closed");
  });

  test("`truong_phai` được mã hoá; không bao giờ có `cursor` (hàm không có đường nhận nó)", () => {
    const href = hrefTrangThai("/", { ...goc, truongPhai: "a&b #c" }, "open");
    const q = new URL(href, "http://x").searchParams;
    expect(q.get("truong_phai")).toBe("a&b #c");
    expect([...q.keys()]).toEqual(["tab", "truong_phai", "loai_mach", "trang_thai"]);
    for (const tt of [undefined, ...TRANG_THAI_FEED]) {
      expect(hrefTrangThai("/", goc, tt)).not.toContain("cursor");
    }
    expect(hrefTrangThai.length).toBe(3);
  });

  test("`/s/*`: MỘT URL cho một trạng thái — 'Tất cả' trùng chip 'Nhật ký' và link rail (không `tab=moi` thừa)", () => {
    // Vòng sửa 2: bản đầu ra `/s/x?tab=moi&loai_mach=nhat_ky` trong khi chip loại ra `/s/x?loai_mach=nhat_ky`.
    const sub = { tab: "moi", khoang: KHOANG_MAC_DINH, loaiMach: "nhat_ky" } as const;
    expect(hrefTrangThai("/s/x", sub, undefined)).toBe("/s/x?loai_mach=nhat_ky");
    expect(hrefTrangThai("/s/x", sub, undefined)).toBe(hrefChipLoai("/s/x", sub, "nhat_ky"));
    expect(hrefTrangThai("/s/x", sub, undefined)).toBe(hrefLoaiTrongSub("/s/x", "nhat_ky"));
    expect(hrefTrangThai("/s/x", sub, "open")).toBe("/s/x?loai_mach=nhat_ky&trang_thai=open");
    expect(hrefTrangThai("/s/x", { tab: "moi", khoang: KHOANG_MAC_DINH }, "closed")).toBe("/s/x?trang_thai=closed");
  });

  test("cùng chuỗi với href tab/khoảng của `Feed` khi trạng thái giống nhau (hai nơi dựng một URL)", () => {
    // `Feed::hrefTab` = `${coBan}?tab=${t}${duoi(khoang)}${duoiTruongPhai}${duoiLoaiMach}${duoiTrangThai}`.
    const tab: TabFeed = "nhieu-diem";
    const khoang: KhoangFeed = "thang";
    const cua_feed = `/?tab=${tab}&khoang=${khoang}&loai_mach=nhat_ky&trang_thai=open`;
    expect(hrefTrangThai("/", { tab, khoang, loaiMach: "nhat_ky" }, "open")).toBe(cua_feed);
  });
});

test.describe("`hienHangTrangThai` — hàng 2 chỉ khi nhật ký và tab ≠ Đang diễn ra", () => {
  test("bảng sự thật đủ mọi tab × loại", () => {
    for (const tab of TAB_FEED) {
      for (const loai of [undefined, ...LOAI_MACH]) {
        const mong = loai === "nhat_ky" && tab !== "dang-dien-ra";
        expect(hienHangTrangThai(tab, loai), `${tab} × ${loai}`).toBe(mong);
      }
    }
  });

  test("có đúng hai ô `true` (đo không rỗng)", () => {
    let n = 0;
    for (const tab of TAB_FEED) for (const loai of [undefined, ...LOAI_MACH]) if (hienHangTrangThai(tab, loai)) n++;
    expect(n).toBe(2); // moi × nhat_ky, nhieu-diem × nhat_ky
  });
});

test.describe("`hrefChipLoai` ở gốc `/` — luôn có `tab=` (không rơi về trang chủ v2)", () => {
  test('"Tất cả" ở `/` là `/?tab=moi`, KHÔNG phải `/` trần', () => {
    expect(hrefChipLoai("/", { tab: "moi", khoang: "tat_ca" }, undefined)).toBe("/?tab=moi");
  });

  test("ba chip loại ở `/` mang `tab=moi&loai_mach=…`; giữ tab/khoảng đang có", () => {
    for (const l of LOAI_MACH) {
      expect(hrefChipLoai("/", { tab: "moi", khoang: "tat_ca" }, l)).toBe(`/?tab=moi&loai_mach=${l}`);
    }
    expect(hrefChipLoai("/", { tab: "nhieu-diem", khoang: "tuan" }, "bai_viet")).toBe(
      "/?tab=nhieu-diem&khoang=tuan&loai_mach=bai_viet",
    );
  });

  test("đổi loại RỚT `trang_thai`: không có tham số nào để nó lọt vào, ở `/` lẫn `/s/*`", () => {
    for (const co_ban of ["/", "/s/chung-khoan"]) {
      for (const l of [undefined, ...LOAI_MACH]) {
        expect(hrefChipLoai(co_ban, { tab: "moi", khoang: "tat_ca", truongPhai: "x" }, l)).not.toContain(
          "trang_thai",
        );
      }
    }
  });

  test("`/s/*` giữ nguyên: Tất cả trần, không `tab=moi` thừa", () => {
    expect(hrefChipLoai("/s/chung-khoan", { tab: "moi", khoang: "tat_ca" }, undefined)).toBe("/s/chung-khoan");
  });
});

test.describe("`hrefLoaiTrongSub` — link nhanh ở rail trang sub", () => {
  test("đúng URL mà chip loại của `Feed` sinh ra ở trạng thái mặc định", () => {
    expect(hrefLoaiTrongSub("/s/chung-khoan", "nhat_ky")).toBe("/s/chung-khoan?loai_mach=nhat_ky");
    expect(hrefLoaiTrongSub("/s/chung-khoan", "bai_viet")).toBe("/s/chung-khoan?loai_mach=bai_viet");
    for (const l of LOAI_MACH) {
      expect(hrefLoaiTrongSub("/s/x", l)).toBe(hrefChipLoai("/s/x", { tab: "moi", khoang: "tat_ca" }, l));
    }
  });
});

test.describe("`TIEU_DE_TRANG_LOC` và `cauFeedRong`", () => {
  test("ba loại, ba chữ đúng plan §4.3", () => {
    expect(TIEU_DE_TRANG_LOC).toEqual({
      nhat_ky: "Tất cả nhật ký",
      bai_viet: "Tất cả bài viết",
      thao_luan: "Chủ đề thảo luận",
    });
  });

  test("câu rỗng nói đúng loại + trạng thái; chỉ loại thì giữ câu cũ nguyên văn", () => {
    expect(cauFeedRong("nhat_ky", "open")).toBe("Chưa có nhật ký đang mở nào trong chuyên mục này.");
    expect(cauFeedRong("nhat_ky", "closed")).toBe("Chưa có nhật ký đã đóng sổ nào trong chuyên mục này.");
    expect(cauFeedRong("thao_luan", "closed")).toBe("Chưa có chủ đề đã đóng nào trong chuyên mục này.");
    expect(cauFeedRong("bai_viet", undefined)).toBe("Chưa có bài viết nào trong chuyên mục này.");
    expect(cauFeedRong(undefined, "open")).toBe("Chưa có bài đang mở nào trong chuyên mục này.");
  });

  test("`<h2>` theo trạng thái chỉ khi hàng 2 hiện; còn lại theo loại", () => {
    expect(tieuDeTrangLoc("moi", "nhat_ky", undefined)).toBe("Tất cả nhật ký");
    expect(tieuDeTrangLoc("moi", "nhat_ky", "open")).toBe("Nhật ký đang mở");
    expect(tieuDeTrangLoc("nhieu-diem", "nhat_ky", "closed")).toBe("Nhật ký đã đóng sổ");
    // Tab Đang diễn ra không nhận `trang_thai` (hàng 2 ẩn) ⇒ không nói trạng thái.
    expect(tieuDeTrangLoc("dang-dien-ra", "nhat_ky", "closed")).toBe("Tất cả nhật ký");
    expect(tieuDeTrangLoc("moi", "thao_luan", "closed")).toBe("Chủ đề thảo luận");
  });

  test("chip 'Trạng thái: …': chủ đề / không loại là 'Đã đóng', chỉ nhật ký là 'Đã đóng sổ'", () => {
    expect(nhanChipTrangThai("thao_luan", "closed")).toBe("Đã đóng");
    expect(nhanChipTrangThai("bai_viet", "closed")).toBe("Đã đóng");
    expect(nhanChipTrangThai(undefined, "closed")).toBe("Đã đóng");
    expect(nhanChipTrangThai("nhat_ky", "closed")).toBe("Đã đóng sổ");
    for (const l of [undefined, ...LOAI_MACH]) expect(nhanChipTrangThai(l, "open")).toBe("Đang mở");
  });

  test("hai trạng thái đều có chữ ở bảng nhãn (đồng bộ với hàng 2)", () => {
    for (const tt of TRANG_THAI_FEED) expect(NHAN_TRANG_THAI_FEED[tt].length).toBeGreaterThan(0);
  });
});

test.describe("hàng rào nguồn — một dải tab, một ô soạn, một nguồn href", () => {
  test("trang chủ dựng href tab bằng `hrefTrangThai` và dùng CSS dải tab chung với `Feed`", () => {
    const home = boChuThich(doc("components/trang-chu-v2.tsx"));
    const feed = boChuThich(doc("components/feed.tsx"));
    expect(home).toMatch(/hrefTrangThai\(/);
    expect(home).not.toMatch(/href:\s*"\/\?tab=/);
    for (const [ten, ma] of [["trang-chu-v2.tsx", home], ["feed.tsx", feed]] as const) {
      expect(ma, ten).toMatch(/import dai from "\.\/dai-tab\.module\.css"/);
      expect(ma, ten).toMatch(/dai\.mot_tab/);
      expect(ma, ten).toMatch(/dai\.tab_dang_chon/);
    }
    // Không chép lại: hai module cũ không còn định nghĩa kiểu gạch chân của dải tab.
    for (const f of ["components/trang-chu-v2.module.css", "components/feed.module.css"]) {
      const css = boChuThich(doc(f));
      expect(css, `${f} không còn định nghĩa .tab_dang_chon kiểu gạch chân`).not.toMatch(
        /\.tab_dang_chon\s*\{[^}]*border-bottom-color/,
      );
    }
    expect(boChuThich(doc("components/dai-tab.module.css"))).toMatch(/\.tab_dang_chon\s*\{[^}]*border-bottom-color/);
  });

  test("ô soạn nhanh + nút dính đáy: chỉ `trang-chu-v2.tsx` và `feed.tsx` dựng chúng, và `feed` chỉ khi lọc nhật ký", () => {
    const feed = boChuThich(doc("components/feed.tsx"));
    expect(feed).toMatch(/\{loaiMach\s*===\s*"nhat_ky"\s*&&\s*<OSoanNhatKy\s*\/>\}/);
    expect(feed).toMatch(/\{loaiMach\s*===\s*"nhat_ky"\s*&&\s*<NutGhiNhatKyDinhDay\s*\/>\}/);
    // Không còn bản chép của ô soạn trong trang chủ.
    const css_home = boChuThich(doc("components/trang-chu-v2.module.css"));
    for (const k of ["soan_nhanh", "o_soan", "nut_mo", "dinh_day", "nut_ghi"]) {
      expect(css_home, `.${k} đã chuyển sang o-soan-nhat-ky.module.css`).not.toContain(`.${k}`);
    }
    const css_chung = boChuThich(doc("components/o-soan-nhat-ky.module.css"));
    for (const k of ["soan_nhanh", "o_soan", "nut_mo", "dinh_day", "nut_ghi"]) {
      expect(css_chung, k).toContain(`.${k}`);
    }
  });

  test("`<h2>` theo loại: chỉ khi `sub === undefined`, đứng sau header và trước hàng Loại", () => {
    const feed = boChuThich(doc("components/feed.tsx"));
    const h2 = feed.indexOf("feed-tieu-de-loai");
    const dau = feed.indexOf("{header ??");
    const hang_loai = feed.indexOf("<LocLoaiMach");
    expect(h2, "đo rỗng: không có <h2>").toBeGreaterThan(0);
    expect(dau).toBeGreaterThan(0);
    expect(dau).toBeLessThan(h2);
    expect(h2).toBeLessThan(hang_loai);
    expect(feed).toMatch(/const coH2Loai = sub\s*===\s*undefined\s*&&\s*loaiMach\s*!==\s*undefined;/);
    expect(feed).toMatch(/\{coH2Loai\s*&&\s*loaiMach\s*!==\s*undefined\s*&&\s*\(\s*<h2/);
  });

  test("`CuonVoHan` mang `key` = URL trang 1 của bộ lọc (remount khi đổi bộ lọc); cấp heading thẻ đi cùng `<h2>`", () => {
    const feed = boChuThich(doc("components/feed.tsx"));
    expect(feed).toMatch(/<CuonVoHan\s+key=\{hrefTab\(tab\)\}/);
    // `hrefTab` ghép ĐỦ danh tính bộ lọc: coBan (gồm sub), tab, khoảng, trường phái, loại, trạng thái.
    expect(feed).toMatch(
      /const hrefTab = \(t: TabFeed\) =>\s*`\$\{coBan\}\?tab=\$\{t\}\$\{duoi\(khoang\)\}\$\{duoiTruongPhai\}\$\{duoiLoaiMach\}\$\{duoiTrangThai\(t\)\}`/,
    );
    expect(feed.match(/capHeading=\{coH2Loai \? 3 : 2\}/g)?.length).toBe(2);
    const cuon = boChuThich(doc("components/cuon-vo-han.tsx"));
    expect(cuon).toMatch(/capHeading=\{capHeading\}/);
  });

  test("chip Trạng thái chỉ còn khi hàng Trạng thái KHÔNG hiện (không báo một bộ lọc hai lần)", () => {
    const feed = boChuThich(doc("components/feed.tsx"));
    expect(feed).toMatch(/\{trangThai\s*&&\s*!hienHangTrangThai\(tab,\s*loaiMach\)\s*&&\s*\(/);
  });

  test("rail của `/?…` dùng tiêu đề khối khách của trang chủ và KHÔNG có `khachMoTa`", () => {
    const trang = boChuThich(doc("app/page.tsx"));
    const nhanh = trang.slice(trang.indexOf("async function FeedDaNap"));
    expect(nhanh).toContain('khachTieuDe="Bắt đầu nhật ký của bạn"');
    expect(nhanh).not.toContain("khachMoTa");
    // Trang chủ `/` (TrangChuMoi) giữ nguyên rail — đợt E.
    const chu = trang.slice(trang.indexOf("async function TrangChuMoi"), trang.indexOf("async function FeedDaNap"));
    expect(chu).toContain("khachMoTa=");
  });

  test("trang sub đọc `?trang_thai=` bằng `docTrangThai` và chuyển xuống API lẫn `Feed`", () => {
    const trang = boChuThich(doc("app/s/[sub]/page.tsx"));
    expect(trang).toMatch(/docTrangThai\(q\.trang_thai\)/);
    expect(trang).toMatch(/docFeedSub\([\s\S]*?trang_thai:\s*trangThai/);
    expect(trang).toMatch(/<Feed[\s\S]*trangThai=\{trangThai\}/);
    // `generateMetadata` vẫn không đọc query (canonical của mọi biến thể là trang gốc).
    const metadata = trang.slice(trang.indexOf("export async function generateMetadata"), trang.indexOf("export default async function"));
    expect(metadata).not.toContain("trang_thai");
    expect(metadata).not.toContain("trangThai");
  });

  test("`docFeedSub` nhận `trang_thai` và `feedTho` đẩy nó lên API (qua `trangThaiGuiLenApi`)", () => {
    const api = boChuThich(doc("lib/api.ts"));
    const ham = api.slice(api.indexOf("export async function docFeedSub"), api.indexOf("async function feedTho"));
    expect(ham).toMatch(/trang_thai\?:\s*TrangThaiFeed/);
    expect(api).toMatch(/trang_thai:\s*trangThaiGuiLenApi\(tab,\s*opts\.trang_thai\)\s*\?\?\s*null/);
  });

  test("trang sub: header không còn dòng số mạch; rail không còn mô tả, có hai link nhanh (T4)", () => {
    const trang = boChuThich(doc("app/s/[sub]/page.tsx"));
    expect(trang).not.toContain("sub-header-so");
    expect(trang).not.toContain("dongSoMachSub");
    expect(trang).toMatch(/\{chi_tiet\.mo_ta\}/); // header vẫn in mô tả — đúng một lần
    const sb = boChuThich(doc("components/sidebar.tsx"));
    const khoi = sb.slice(sb.indexOf('data-testid="sidebar-ve-sub"'), sb.indexOf("sidebar-gioi-thieu"));
    expect(khoi.length, "đo rỗng").toBeGreaterThan(200);
    expect(khoi).not.toContain("mo_ta");
    expect(khoi).toContain('data-testid="sidebar-so-mach"');
    expect(khoi).toContain('"nhat_ky"');
    expect(khoi).toContain('"bai_viet"');
    expect(khoi).toContain("sidebar-dan-nhat-ky-sub");
    expect(khoi).toContain("sidebar-dan-bai-viet-sub");
    const css = boChuThich(doc("app/s/[sub]/sub.module.css"));
    expect(css).not.toMatch(/\.so\s*\{/);
  });
});
