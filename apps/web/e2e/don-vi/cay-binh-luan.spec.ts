import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  conThieuSauNap,
  dungCay,
  manHinhCay,
  type NutCay,
} from "../../../admin/lib/cay-binh-luan";
import { boChuThich } from "./quet";

/** Hàm thuần dựng cây bình luận của trang mạch quản trị
 * (`apps/admin/lib/cay-binh-luan.ts`).
 *
 * **Vì sao bài đo của `apps/admin` lại nằm trong `apps/web/e2e/don-vi`.** Bộ `don-vi` là
 * bộ chạy-được-song-song duy nhất của repo (không DB, không cổng — xem
 * `playwright.don-vi.config.ts`), và `apps/admin` không có bộ chạy nào của riêng nó.
 * Lối này đã có sẵn ở `hang-loat-quan-tri.spec.ts`: import thẳng module vì file nguồn
 * cố ý không kéo theo React hay `fetch`.
 *
 * Phần vẽ `<ul>` nằm trong component. Luật dễ trôi — gắn nhầm gốc, sắp ngược, và
 * chu trình đệ quy không dừng — nằm gọn trong `dungCay`. Quyết định «chỉ lỗi /
 * chưa ai / còn thiếu» là hàm thuần. Phần nối dây (xoá cây khi trang sau lỗi,
 * đọc cờ chứ không đọc `parent_id`) đọc từ nguồn trang — không dựng server.
 */

type Hang = {
  id: number;
  parent_id: number | null;
  created_at: string;
  nhan?: string;
};

/** Đếm nút, và ném nếu một id xuất hiện hai lần — vòng trong kết quả sẽ treo mất. */
function demNut(nuts: NutCay<Hang>[]): number {
  const thay = new Set<number>();
  const di = (ds: NutCay<Hang>[]) => {
    for (const n of ds) {
      if (thay.has(n.id)) throw new Error(`gắn lại ${n.id}`);
      thay.add(n.id);
      di(n.con);
    }
  };
  di(nuts);
  return thay.size;
}

test.describe("cay-binh-luan", () => {
  test("một cha một con — con nằm trong cha, không phải gốc thứ hai", () => {
    const cha: Hang = {
      id: 1,
      parent_id: null,
      created_at: "2026-01-02T00:00:00Z",
      nhan: "cha",
    };
    const con: Hang = {
      id: 2,
      parent_id: 1,
      created_at: "2026-01-03T00:00:00Z",
      nhan: "con",
    };
    // Con đứng trước trong mảng đầu vào — thứ tự API (mới nhất trước) không được
    // thành thứ tự cây.
    const cay = dungCay([con, cha]);
    expect(cay.map((n) => n.id)).toEqual([1]);
    expect(cay[0].nhan).toBe("cha");
    expect(cay[0].con.map((n) => n.nhan)).toEqual(["con"]);
    expect(cay[0].con[0].con).toEqual([]);
    expect(cay[0].khongThayCha).toBe(false);
    expect(cay[0].con[0].khongThayCha).toBe(false);
    expect(demNut(cay)).toBe(2);
  });

  test("hai gốc sắp cũ trước", () => {
    const moi: Hang = { id: 2, parent_id: null, created_at: "2026-02-01T00:00:00Z" };
    const cu: Hang = { id: 1, parent_id: null, created_at: "2026-01-01T00:00:00Z" };
    expect(dungCay([moi, cu]).map((n) => n.id)).toEqual([1, 2]);
  });

  test("mốc đúng giây đứng trước mốc có .500 cùng giây", () => {
    // `.` (0x2E) đứng trước `Z` (0x5A): chuỗi có phần nghìn xếp sớm hơn theo từ
    // điển dù muộn nửa giây. Id của mốc muộn nhỏ hơn, nên xếp theo id cũng sai.
    const dungGiay: Hang = {
      id: 2,
      parent_id: null,
      created_at: "2026-11-15T08:00:00Z",
    };
    const coMilli: Hang = {
      id: 1,
      parent_id: null,
      created_at: "2026-11-15T08:00:00.500Z",
    };
    expect(dungCay([coMilli, dungGiay]).map((n) => n.id)).toEqual([2, 1]);
  });

  test("reply mồ côi vẫn là gốc", () => {
    const moCoi: Hang = {
      id: 7,
      parent_id: 999,
      created_at: "2026-01-02T00:00:00Z",
    };
    const goc: Hang = { id: 1, parent_id: null, created_at: "2026-01-01T00:00:00Z" };
    const cay = dungCay([moCoi, goc]);
    expect(cay.map((n) => n.id)).toEqual([1, 7]);
    expect(cay.every((n) => n.con.length === 0)).toBe(true);
    expect(cay[0].khongThayCha).toBe(false);
    expect(cay[1].khongThayCha).toBe(true);
  });

  test("mồ côi có cờ không thấy cha — gốc thật, con của mồ côi, và vòng thì không", () => {
    const goc: Hang = { id: 1, parent_id: null, created_at: "2026-01-01T00:00:00Z" };
    const moCoi: Hang = { id: 2, parent_id: 999, created_at: "2026-01-02T00:00:00Z" };
    const conCuaMoCoi: Hang = {
      id: 3,
      parent_id: 2,
      created_at: "2026-01-03T00:00:00Z",
    };
    const cay = dungCay([conCuaMoCoi, moCoi, goc]);
    // Vẫn hiện, vẫn là nút của cây — không bị bỏ. Cờ tách nó khỏi gốc thật.
    expect(cay.map((n) => n.id)).toEqual([1, 2]);
    expect(cay[0].khongThayCha).toBe(false);
    expect(cay[1].khongThayCha).toBe(true);
    expect(cay[1].con.map((n) => n.id)).toEqual([3]);
    expect(cay[1].con[0].khongThayCha).toBe(false);

    // Cha nằm trong tập dù nút bị cắt thành gốc của vòng: không phải «không thấy cha».
    const vong = dungCay([
      { id: 1, parent_id: 2, created_at: "2026-01-01T00:00:00Z" },
      { id: 2, parent_id: 1, created_at: "2026-01-02T00:00:00Z" },
    ]);
    expect(vong.map((n) => n.id)).toEqual([1]);
    expect(vong[0].khongThayCha).toBe(false);
    expect(vong[0].con[0].khongThayCha).toBe(false);

    const tuCha = dungCay([
      { id: 5, parent_id: 5, created_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(tuCha[0].khongThayCha).toBe(false);
  });

  test("anh em cũ trước, hoà created_at thì id tăng", () => {
    const cha: Hang = { id: 1, parent_id: null, created_at: "2026-01-01T00:00:00Z" };
    const em: Hang = { id: 4, parent_id: 1, created_at: "2026-01-03T00:00:00Z" };
    const anh: Hang = { id: 3, parent_id: 1, created_at: "2026-01-02T00:00:00Z" };
    const hoaSau: Hang = { id: 6, parent_id: 1, created_at: "2026-01-02T00:00:00Z" };
    const cay = dungCay([em, hoaSau, anh, cha]);
    // 3 và 6 cùng giờ, id 3 đứng trước; 4 muộn hơn nên đứng cuối.
    expect(cay[0].con.map((n) => n.id)).toEqual([3, 6, 4]);
  });

  test("con cũ hơn cha vẫn nằm trong con", () => {
    const cay = dungCay([
      { id: 1, parent_id: null, created_at: "2026-02-01T00:00:00Z" },
      { id: 2, parent_id: 1, created_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(cay.map((n) => n.id)).toEqual([1]);
    expect(cay[0].con.map((n) => n.id)).toEqual([2]);
  });

  test("cháu nằm dưới con", () => {
    const cay = dungCay([
      { id: 3, parent_id: 2, created_at: "2026-01-03T00:00:00Z" },
      { id: 1, parent_id: null, created_at: "2026-01-01T00:00:00Z" },
      { id: 2, parent_id: 1, created_at: "2026-01-02T00:00:00Z" },
    ]);
    expect(cay.map((n) => n.id)).toEqual([1]);
    expect(cay[0].con.map((n) => n.id)).toEqual([2]);
    expect(cay[0].con[0].con.map((n) => n.id)).toEqual([3]);
  });

  test("chu trình không treo, không sót, không gắn lại", () => {
    const a: Hang = { id: 1, parent_id: 2, created_at: "2026-01-01T00:00:00Z" };
    const b: Hang = { id: 2, parent_id: 1, created_at: "2026-01-02T00:00:00Z" };
    const cay = dungCay([b, a]);
    expect(demNut(cay)).toBe(2);
    // Nút cũ nhất trong vòng là gốc; cạnh quay về nó không gắn lại.
    expect(cay.map((n) => n.id)).toEqual([1]);
    expect(cay[0].con.map((n) => n.id)).toEqual([2]);
    expect(cay[0].con[0].con).toEqual([]);
  });

  test("nút trỏ vào chu trình vẫn là con", () => {
    const cay = dungCay([
      { id: 3, parent_id: 1, created_at: "2026-01-01T00:00:00Z" },
      { id: 1, parent_id: 2, created_at: "2026-02-01T00:00:00Z" },
      { id: 2, parent_id: 1, created_at: "2026-03-01T00:00:00Z" },
    ]);
    expect(demNut(cay)).toBe(3);
    expect(cay.map((n) => n.id)).toEqual([1]);
    expect(cay[0].con.map((n) => n.id)).toEqual([3, 2]);
    expect(cay[0].con.every((n) => n.con.length === 0)).toBe(true);
  });

  test("tự làm cha mình không treo", () => {
    const cay = dungCay([
      { id: 5, parent_id: 5, created_at: "2026-01-01T00:00:00Z" },
    ]);
    expect(cay.map((n) => n.id)).toEqual([5]);
    expect(cay[0].con).toEqual([]);
  });

  test("không sửa mảng đầu vào", () => {
    const ban: Hang[] = [
      { id: 2, parent_id: 1, created_at: "2026-01-02T00:00:00Z" },
      { id: 1, parent_id: null, created_at: "2026-01-01T00:00:00Z" },
    ];
    const truoc = JSON.stringify(ban);
    dungCay(ban);
    expect(JSON.stringify(ban)).toBe(truoc);
    expect(ban[0]).not.toHaveProperty("con");
    expect(ban[0]).not.toHaveProperty("khongThayCha");
  });

  test("lỗi nạp không vẽ cây cũ và không thành «chưa ai bình luận»", () => {
    expect(manHinhCay(null, null, 0)).toBe("skeleton");
    expect(manHinhCay(null, "trang 500", 0)).toBe("chi-loi");
    expect(manHinhCay([], "trang 500", 0)).toBe("chi-loi");
    // Bản của lượt trước còn nằm trong state: vẫn không được vẽ như hiện tại.
    expect(manHinhCay([{ id: 1 }], "trang 500", 1)).toBe("chi-loi");
    expect(manHinhCay([], null, 0)).toBe("chua-ai");
    expect(manHinhCay([{ id: 1 }], null, 1)).toBe("cay");
  });

  test("tong trang cuối lớn hơn số hàng đã gom thì còn thiếu, kể cả hết cursor", () => {
    expect(
      conThieuSauNap({ tong: 10, soHangDaGom: 10, dungViTran: false }),
    ).toBe(false);
    // cursor đã null, nhưng có hàng chèn phía trước cursor sau trang 1.
    expect(
      conThieuSauNap({ tong: 12, soHangDaGom: 10, dungViTran: false }),
    ).toBe(true);
    // Hàng biến mất giữa chừng không phải «còn thiếu».
    expect(
      conThieuSauNap({ tong: 8, soHangDaGom: 10, dungViTran: false }),
    ).toBe(false);
    expect(
      conThieuSauNap({ tong: 0, soHangDaGom: 0, dungViTran: false }),
    ).toBe(false);
    // Chạm trần lần nạp, cursor còn: vẫn báo, dù tong khớp phần đã gom.
    expect(
      conThieuSauNap({ tong: 200, soHangDaGom: 200, dungViTran: true }),
    ).toBe(true);
  });

  test("trang mạch nối cờ, xoá cây khi nạp lỗi, và so tong với số hàng đã gom", () => {
    const trang = boChuThich(
      readFileSync(
        resolve(__dirname, "..", "..", "..", "admin", "app", "m", "[machId]", "page.tsx"),
        "utf8",
      ),
    );
    expect(trang.length).toBeGreaterThan(500);
    // UI không tự suy «cha vắng» từ parent_id — chỉ đọc cờ của dungCay.
    expect(trang).not.toMatch(/\bparent_id\b/);

    const batDauNap = trang.indexOf("const napHet");
    const nap = trang.slice(batDauNap, trang.indexOf("useEffect", batDauNap));
    expect(nap.length).toBeGreaterThan(200);
    const loi = nap.slice(nap.indexOf("error !== undefined"), nap.indexOf("gom.push"));
    expect(loi).toContain("datItems(null)");
    expect(loi).toContain("datConThieu(false)");
    expect(loi).toContain("datHetPhienNap(maLoi(error) === MA_CHUA_DANG_NHAP)");
    expect(loi).not.toContain("datItems(gom)");
    expect(loi).not.toContain("datItems([])");
    expect(nap).toMatch(/datConThieu\(\s*conThieuSauNap\(/);
    expect(nap).toContain("dungViTran: false");
    expect(nap).toContain("dungViTran: true");

    expect(trang).toContain("manHinhCay(");
    expect(trang).toContain("het_phien={het_phien || hetPhienNap}");
    expect(trang).toContain('manHinh === "skeleton"');
    expect(trang).toContain('manHinh === "chua-ai"');
    const chiLoi = trang.indexOf('manHinh === "chi-loi"');
    expect(chiLoi).toBeGreaterThan(-1);
    const nutTai = trang.slice(chiLoi, chiLoi + 400);
    expect(nutTai).toContain("Tải lại");
    expect(nutTai).toContain("napHet()");
    const veCay = trang.indexOf('manHinh === "cay" && cay !== null');
    const ul = trang.indexOf("<ul", veCay);
    expect(veCay).toBeGreaterThan(-1);
    expect(ul).toBeGreaterThan(veCay);
    expect(ul - veCay).toBeLessThan(200);
    expect(trang).toContain('manHinh === "cay" && conThieu');
    const chua = trang.indexOf('manHinh === "chua-ai"');
    const cauChua = trang.indexOf("Chưa ai bình luận vào bài này.");
    expect(chua).toBeGreaterThan(-1);
    expect(cauChua).toBeGreaterThan(chua);
    expect(cauChua - chua).toBeLessThan(250);

    const nut = trang.slice(trang.indexOf("function NutBinhLuanMach"));
    const mo = nut.indexOf("{nut.khongThayCha");
    const dong = nut.indexOf(")}", mo);
    const khoi = nut.slice(mo, dong);
    expect(mo).toBeGreaterThan(-1);
    expect(khoi).toContain("không thấy cha");
    expect(khoi).not.toContain("nut-an-binh-luan-mach");
    expect(nut.indexOf("nut-an-binh-luan-mach")).toBeGreaterThan(dong);
  });
});
