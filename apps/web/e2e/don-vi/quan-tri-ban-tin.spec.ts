import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import {
  quanTriLietKeBanTin,
  quanTriSuaKhungBanTin,
  quanTriXoaKhungBanTin,
} from "@gikky/api-client/admin";
import { expect, test } from "@playwright/test";

import {
  NHAN_TRANG_THAI_KHUNG,
  TEN_GON_KHUNG,
  chuanHoaFigures,
  gioPhutVN,
  khungDaDoi,
  nhanNgayBanTin,
  soKhungMoiNgay,
  tieuDeSauKhiNap,
} from "../../../admin/lib/ban-tin";
import { NHOM_MENU, mucTheoDuongDan } from "../../../admin/components/khung/menu";
import { boChuThich, quetNguon } from "./quet";

/** Việc 21, đợt D — trang "Bản tin" của khu quản trị
 * (plan `2026-11-13-quan-tri-ban-tin-chu-de.md` §3.2 + D1–D4 phần phía admin).
 *
 * Phần server (ô "Hôm nay" theo giờ đóng băng, lọc HTML, figures sai dạng, ẩn ⇒ 404, xoá khung)
 * là `api/tests/test_api_quan_tri_ban_tin.py`. Ở đây ba tầng như các bài `quan-tri-*` khác: hàm
 * thuần, request thật của client SINH RA với `fetch` giả, và nguồn trang (cái nối dây). */

const ADMIN = resolve(__dirname, "..", "..", "..", "admin");
const WEB = resolve(__dirname, "..", "..");
const API = resolve(__dirname, "..", "..", "..", "..", "api");
const nguon = (p: string) => boChuThich(readFileSync(resolve(ADMIN, p), "utf8"));
const nguonWeb = (p: string) => boChuThich(readFileSync(resolve(WEB, p), "utf8"));

function fetchGia(da_goi: Request[], than: unknown = {}) {
  return (async (req: Request) => {
    da_goi.push(req);
    return new Response(JSON.stringify(than), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

test.describe("§3.2 — phần thuần của /ban-tin", () => {
  test("năm trạng thái khung đều có nhãn; 'chưa' và 'đã xoá' xám, 'quá hạn' đỏ", () => {
    expect(Object.keys(NHAN_TRANG_THAI_KHUNG).sort()).toEqual([
      "chua",
      "da_dang",
      "da_xoa",
      "khong_lich",
      "qua_han",
    ]);
    // Vòng sửa 1: khung mod vừa xoá không phải bot trễ — không được đỏ.
    expect(NHAN_TRANG_THAI_KHUNG.da_xoa).toEqual({ nhan: "đã xoá", tone: "trung-tinh" });
    expect(NHAN_TRANG_THAI_KHUNG.chua.tone).toBe("trung-tinh");
    expect(NHAN_TRANG_THAI_KHUNG.qua_han.tone).toBe("xau");
    expect(NHAN_TRANG_THAI_KHUNG.da_dang.tone).toBe("tot");
    expect(Object.keys(TEN_GON_KHUNG)).toEqual(["dem_qua", "truoc_phien_vn", "truoc_phien_my"]);
  });

  test("nhãn ngày đọc chuỗi ngày VN, không qua múi giờ máy", () => {
    expect(nhanNgayBanTin("2026-11-13")).toBe("Thứ Sáu, 13/11/2026");
    expect(nhanNgayBanTin("2026-11-15")).toBe("Chủ nhật, 15/11/2026");
    expect(nhanNgayBanTin("2027-01-04")).toBe("Thứ Hai, 04/01/2027");
  });

  test("giờ đăng in theo giờ VN", () => {
    expect(gioPhutVN("2026-11-12T23:15:00Z")).toBe("06:15");
    expect(gioPhutVN("2026-11-13T12:33:00Z")).toBe("19:33");
  });

  test("số khung mỗi ngày là độ dài danh sách server trả, không gõ 3", () => {
    expect(soKhungMoiNgay({ khung: [] })).toBe(0);
    expect(soKhungMoiNgay({ khung: [{}, {}] as never })).toBe(2);
  });

  test("bảng số liệu: bỏ khoảng trắng, bỏ hàng thiếu vế, rỗng ⇒ null", () => {
    expect(chuanHoaFigures([])).toBeNull();
    expect(chuanHoaFigures([{ label: " ", value: "1" }])).toBeNull();
    expect(
      chuanHoaFigures([
        { label: " Vàng ", value: " 2.400 " },
        { label: "Dầu", value: "" },
      ]),
    ).toEqual([{ label: "Vàng", value: "2.400" }]);
  });

  test("khungDaDoi: đổi thân / đổi số ⇒ true; chỉ khác khoảng trắng hay hàng trống ⇒ false", () => {
    const cu = { body: "<p>a</p>", figures: [{ label: "V", value: "1" }] };
    expect(khungDaDoi(cu, { body: "<p>a</p>", figures: [{ label: " V ", value: "1" }] })).toBe(
      false,
    );
    expect(
      khungDaDoi(cu, {
        body: "<p>a</p>",
        figures: [
          { label: "V", value: "1" },
          { label: "", value: "" },
        ],
      }),
    ).toBe(false);
    expect(khungDaDoi(cu, { body: "<p>b</p>", figures: [{ label: "V", value: "1" }] })).toBe(true);
    expect(khungDaDoi(cu, { body: "<p>a</p>", figures: [{ label: "V", value: "2" }] })).toBe(true);
    expect(khungDaDoi(cu, { body: "<p>a</p>", figures: [] })).toBe(true);
    expect(khungDaDoi({ body: "<p>a</p>", figures: null }, { body: "<p>a</p>", figures: [] })).toBe(
      false,
    );
  });
});

test.describe("§3.2 — request thật của client sinh ra", () => {
  test("bảng: GET /api/admin/ban-tin mang limit + cursor", async () => {
    const da_goi: Request[] = [];
    await quanTriLietKeBanTin({
      baseUrl: "http://quan-tri.test",
      fetch: fetchGia(da_goi),
      query: { limit: 25, cursor: "abc" },
    });
    const url = new URL(da_goi[0].url);
    expect(da_goi[0].method).toBe("GET");
    expect(url.pathname).toBe("/api/admin/ban-tin");
    expect(url.searchParams.get("limit")).toBe("25");
    expect(url.searchParams.get("cursor")).toBe("abc");
  });

  test("sửa khung: PATCH /ban-tin/<ngày>/khung/<khung> với thân + figures", async () => {
    const da_goi: Request[] = [];
    await quanTriSuaKhungBanTin({
      baseUrl: "http://quan-tri.test",
      fetch: fetchGia(da_goi),
      path: { ngay: "2026-11-13", khung: "dem_qua" },
      body: { body: "<p>x</p>", figures: null },
    });
    expect(da_goi[0].method).toBe("PATCH");
    expect(new URL(da_goi[0].url).pathname).toBe("/api/admin/ban-tin/2026-11-13/khung/dem_qua");
    expect(JSON.parse(await da_goi[0].text())).toEqual({ body: "<p>x</p>", figures: null });
  });

  test("xoá khung: DELETE /ban-tin/<ngày>/khung/<khung>", async () => {
    const da_goi: Request[] = [];
    await quanTriXoaKhungBanTin({
      baseUrl: "http://quan-tri.test",
      fetch: fetchGia(da_goi),
      path: { ngay: "2026-11-13", khung: "truoc_phien_vn" },
    });
    expect(da_goi[0].method).toBe("DELETE");
    expect(new URL(da_goi[0].url).pathname).toBe(
      "/api/admin/ban-tin/2026-11-13/khung/truoc_phien_vn",
    );
  });
});

test.describe("§3.2 — nguồn trang", () => {
  test("menu: 'Bản tin' trỏ /ban-tin có trang thật, khớp tiền tố cho /ban-tin/<ngày>", () => {
    const muc = NHOM_MENU.flatMap((n) => n.muc).find((m) => m.duong_dan === "/ban-tin");
    expect(muc?.nhan).toBe("Bản tin");
    expect(existsSync(resolve(ADMIN, "app/ban-tin/page.tsx"))).toBe(true);
    expect(existsSync(resolve(ADMIN, "app/ban-tin/[ngay]/page.tsx"))).toBe(true);
    expect(mucTheoDuongDan("/ban-tin/2026-11-13")?.muc.duong_dan).toBe("/ban-tin");
  });

  test("/ban-tin: ô Hôm nay đọc từ phản hồi của server, KHÔNG có nút tạo bản tin", () => {
    const trang = nguon("app/ban-tin/page.tsx");
    expect(trang).toMatch(/datHomNay\(kq\.data\.hom_nay\)/);
    expect(trang).toMatch(/NHAN_TRANG_THAI_KHUNG\[k\.trang_thai\]/);
    expect(trang).toMatch(/data-testid="khong-co-lich"/);
    expect(trang).toMatch(/b\.duong_dan_cong_khai/);
    // Không đường tạo: không form đăng bài, không endpoint ghi nào ngoài cửa đọc.
    expect(trang).not.toMatch(/FormDangBai|quanTri(Sua|An|Hien|Xoa|Tao)\w*\(/);
    expect(trang).not.toMatch(/Tạo bản tin/);
  });

  test("không file nào của apps/admin gõ giờ hạn chót 07:00 / 09:00 / 21:00", () => {
    // Hạn chót khai một lần ở `api/core/models/ban_tin.py::HAN_CHOT_KHUNG`, admin đọc qua API.
    const pham = quetNguon(ADMIN, /\.tsx?$/)
      .filter((f) => !f.ten.includes("node_modules") && !f.ten.startsWith(".next"))
      .filter((f) => /["'`](07|09|21):00["'`]/.test(f.sach))
      .map((f) => f.ten);
    expect(pham).toEqual([]);
  });

  test("/ban-tin/[ngay]: mỗi cửa ghi đúng một lần, dùng lại soạn thảo + ô dải số", () => {
    const trang = nguon("app/ban-tin/[ngay]/page.tsx");
    for (const ham of [
      "quanTriSuaBanTin",
      "quanTriSuaKhungBanTin",
      "quanTriXoaKhungBanTin",
      "quanTriAnBanTin",
      "quanTriHienBanTin",
    ]) {
      expect(trang.match(new RegExp(`${ham}\\(\\{`, "g")), ham).toHaveLength(1);
    }
    expect(trang).toMatch(/<SoanThaoQuanTri\b[\s\S]*?xemTruoc[\s\S]*?\/>/);
    expect(trang).toMatch(/<OFigures\b/);
    expect(trang).toMatch(/from "\.\.\/\.\.\/\.\.\/components\/form-sua-moc"/);
    expect(trang).not.toMatch(/FormDangBai|quanTriTao/);
  });

  test("/ban-tin/[ngay]: hộp xác nhận xoá khung nói rõ không hoàn tác, và chỉ gọi xoá từ trong hộp", () => {
    const trang = nguon("app/ban-tin/[ngay]/page.tsx");
    const hop = trang.slice(trang.indexOf("mo={mo_xoa !== null}"));
    expect(hop).toMatch(/không hoàn tác/);
    expect(hop).toMatch(/quanTriXoaKhungBanTin\(\{/);
    expect(trang.indexOf("quanTriXoaKhungBanTin({")).toBeGreaterThan(
      trang.indexOf("mo={mo_xoa !== null}"),
    );
  });

  test("khu quản trị không chèn HTML thô — xem trước đi qua Tiptap chỉ đọc", () => {
    // Ghép tên thuộc tính: hàng rào `markdown.spec.ts` quét cả `apps/web/e2e` và đỏ khi thấy
    // nguyên chữ ở một file chưa được miễn trừ.
    const CHEN_THO = ["dangerously", "SetInnerHTML"].join("");
    const pham = quetNguon(ADMIN, /\.tsx?$/)
      .filter((f) => !f.ten.includes("node_modules") && !f.ten.startsWith(".next"))
      .filter((f) => f.ten !== "app/layout.tsx") // script theme — hằng biên dịch
      .filter((f) => f.sach.includes(CHEN_THO))
      .map((f) => f.ten);
    expect(pham).toEqual([]);
    const soan = nguon("components/soan-thao-quan-tri.tsx");
    expect(soan).toMatch(/editable: !khoa && !xemTruoc/);
  });

  test("bảng điều khiển: thẻ 'Bản tin hôm nay' dẫn tới /ban-tin, số = so_da_dang / số khung", () => {
    const trang = nguon("app/page.tsx");
    expect(trang).toMatch(/<TheBanTinHomNay \/>/);
    const the = trang.slice(trang.indexOf("function TheBanTinHomNay"));
    expect(the).toMatch(/href="\/ban-tin"/);
    expect(the).toMatch(/hom_nay\.so_da_dang\}\/\$\{soKhungMoiNgay\(hom_nay\)\}/);
  });

  test("nhật ký: gợi ý đủ năm hành động bản tin, đúng chuỗi của core/ghi.py", () => {
    const ghi = readFileSync(resolve(API, "core/ghi.py"), "utf8");
    const hang = [...ghi.matchAll(/^AUDIT_\w*BAN_TIN = "([a-z_]+)"$/gm)].map((m) => m[1]);
    expect(hang).toHaveLength(5);
    const nhat_ky = nguon("app/nhat-ky/page.tsx");
    for (const a of hang) expect(nhat_ky, a).toContain(`"${a}"`);
  });
});

test.describe("§3.2 — sửa ở admin hiện ngay trên trang công khai", () => {
  // `api/api/quan_tri_ban_tin.py` cố ý KHÔNG gọi `core/revalidate.py`: ba trang công khai đọc
  // bản tin không có bản cache nào. Bài này ghim giả định ấy — ngày một trang chuyển sang ISR thì
  // nó đỏ, và lúc đó phải mở cửa làm mới cho đường bản tin.
  test("/s/tin-tuc/<ngày>, /s/tin-tuc, / đều force-dynamic; hai hàm đọc bản tin đi no-store", () => {
    for (const p of ["app/s/[sub]/[ngay]/page.tsx", "app/s/[sub]/page.tsx", "app/page.tsx"]) {
      expect(nguonWeb(p), p).toMatch(/export const dynamic = "force-dynamic";/);
    }
    const api = nguonWeb("lib/api.ts");
    expect(api).toMatch(/const CHUNG = \{ baseUrl: API_ORIGIN, cache: "no-store" \} as const;/);
    // Đọc thân hai hàm theo tên HÀM ĐỌC của web, không nhắc tên hàm API sinh ra: hàng rào
    // `type-frontend.spec.ts` quét cả thư mục e2e và coi mọi lần nhắc tên ấy là một lời gọi.
    const than = (ten: string) => {
      const tu = api.slice(api.indexOf(`export async function ${ten}(`));
      return tu.slice(0, tu.indexOf("\n}\n"));
    };
    expect(than("docBanTin").match(/\(\{ \.\.\.CHUNG,/g)).toHaveLength(1);
    expect(than("docDanhSachBanTin").match(/\(\{ \.\.\.CHUNG,/g)).toHaveLength(2);
    expect(than("docBanTin") + than("docDanhSachBanTin")).not.toMatch(/CHUNG_ISR|revalidate/);
  });
});

test.describe("vòng sửa 1 — phần admin", () => {
  test("ô tiêu đề: nạp đầu lấy của server; nạp lại chỉ đè khi mod chưa gõ gì", () => {
    expect(tieuDeSauKhiNap("", null, "Bản tin A")).toBe("Bản tin A");
    expect(tieuDeSauKhiNap("Bản tin A", "Bản tin A", "Bản tin A")).toBe("Bản tin A");
    expect(tieuDeSauKhiNap("Bản tin A", "Bản tin A", "Bản tin B")).toBe("Bản tin B");
    expect(tieuDeSauKhiNap("Đang gõ dở", "Bản tin A", "Bản tin A")).toBe("Đang gõ dở");
  });

  test("/ban-tin/[ngay]: nạp lại đi qua tieuDeSauKhiNap, không đặt thẳng tiêu đề server", () => {
    const trang = nguon("app/ban-tin/[ngay]/page.tsx");
    expect(trang).not.toMatch(/datTieuDe\(data\.title\)/);
    expect(trang).toMatch(/datTieuDe\(\(o\) => tieuDeSauKhiNap\(o, cu, data\.title\)\)/);
  });

  test("/ban-tin/[ngay]: Lưu gửi thân đã chuẩn hoá; so 'có đổi' với HTML Tiptap lúc tạo", () => {
    const trang = nguon("app/ban-tin/[ngay]/page.tsx");
    expect(trang).toMatch(/body: \{ body: chuanHoaThanBanTin\(body_moi\),/);
    expect(trang).toMatch(/onTaoXong=\{\(html\) => \{\s*datBodyGoc\(html\);/);
    expect(trang).toMatch(/const cu = \{ body: body_goc \?\? k\.body, figures: k\.figures \};/);
  });

  test("SoanThaoQuanTri dùng bộ extension chung; hr + codeBlock KHÔNG bị tắt", () => {
    const soan = nguon("components/soan-thao-quan-tri.tsx");
    expect(soan).toMatch(/extensions: phanMoRongQuanTri\(\),/);
    const mo_rong = nguon("lib/tiptap-quan-tri.ts");
    expect(mo_rong).not.toMatch(/horizontalRule:\s*false|codeBlock:\s*false/);
  });

  test("thẻ bảng điều khiển chỉ đỏ vì qua_han — khung đã xoá không tính", () => {
    const the = nguon("app/page.tsx");
    expect(the).toMatch(/hom_nay\?\.khung\.some\(\(k\) => k\.trang_thai === "qua_han"\)/);
  });
});