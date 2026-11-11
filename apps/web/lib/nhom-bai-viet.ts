import type { MachTomTatOut } from "@gikky/api-client";

/** Section "Bài viết" của trang chủ — kiểu THƯ VIỆN kiến thức: ba cột theo nhóm chuyên mục +
 * một dải bản tin (plan `2026-11-11-homepage-v2-giao-dien-moi.md` §3.3).
 *
 * Mọi quyết định "bài nào vào cột nào" sống ở đây, trong hàm THUẦN, để đo được không cần mạng
 * (`e2e/don-vi/trang-chu-giao-dien-moi.spec.ts`) và để đổi nhóm chỉ là sửa MỘT hằng.
 */

export type NhomBaiViet = {
  /** Khoá ổn định cho `data-testid` / React key — không in ra. */
  khoa: string;
  /** Tiêu đề cột. */
  ten: string;
  /** Slug các chuyên mục thuộc nhóm. Bài của sub ngoài danh sách này không vào cột nào. */
  subs: readonly string[];
  /** Slug chuyên mục mà "Xem thêm →" của cột dẫn tới. */
  xemThem: string;
};

/** Ba nhóm — **hằng cấu hình, đặt cạnh logic, dễ đổi** (user có thể đổi nhóm; hỏi nếu thấy
 * bất hợp lý với dữ liệu thật). `tin-tuc` cố ý KHÔNG vào cột: nó là dải bản tin bên dưới.
 *
 * Slug là chuỗi, KHÔNG phải danh sách sub đóng: chuyên mục chưa tồn tại trên môi trường này
 * (vd `tam-ly-giao-dich` ở DB dev) chỉ làm cột ít bài đi — không lỗi. Nhãn hiển thị của chip
 * lấy từ `GET /subs` (`ten`), nên web không giữ bản sao tên chuyên mục nào. */
export const NHOM_BAI_VIET: readonly NhomBaiViet[] = [
  {
    khoa: "co-che-thi-truong",
    ten: "Cơ chế thị trường",
    subs: ["hoi-dap", "chung-khoan"],
    xemThem: "hoi-dap",
  },
  {
    khoa: "vi-mo-doanh-nghiep",
    ten: "Vĩ mô & doanh nghiệp",
    subs: ["vi-mo", "crypto"],
    xemThem: "vi-mo",
  },
  {
    khoa: "quan-tri-von-tam-ly",
    ten: "Quản trị vốn & tâm lý",
    subs: ["quan-tri-von", "tam-ly-giao-dich"],
    xemThem: "quan-tri-von",
  },
];

/** Chuyên mục của dải "Bản tin thị trường". */
export const SUB_BAN_TIN = "tin-tuc";

/** Số bài tải về MỘT lần rồi chia nhóm ở web (không thêm API). 50 = trần `limit` của feed. */
export const SO_BAI_VIET_TAI = 50;
/** Số bài mỗi cột. Plan: 3; tăng lên 4 NẾU đo thực tế link `/m/` trên `/` rơi dưới 19. */
export const SO_BAI_MOI_NHOM = 3;
/** Số bản tin trong dải (plan: 2–3). */
export const SO_BAN_TIN = 3;

export type CotThuVien = NhomBaiViet & { baiViet: MachTomTatOut[] };

/** Chia `items` (đã mới → cũ, như API trả) vào các nhóm: mỗi nhóm giữ `SO_BAI_MOI_NHOM` bài
 * ĐẦU thuộc sub của nó. Nhóm không có bài nào ⇒ bị bỏ (ẩn cột, không khung rỗng). Một bài chỉ
 * vào một nhóm (nhóm đầu tiên khai sub của nó). Không đột biến `items`. */
export function chiaNhomBaiViet(
  items: readonly MachTomTatOut[],
  nhom: readonly NhomBaiViet[] = NHOM_BAI_VIET,
  toiDaMoiNhom: number = SO_BAI_MOI_NHOM,
): CotThuVien[] {
  const cot: CotThuVien[] = nhom.map((n) => ({ ...n, baiViet: [] }));
  for (const m of items) {
    const c = cot.find((n) => n.subs.includes(m.sub.slug));
    if (c !== undefined && c.baiViet.length < toiDaMoiNhom) c.baiViet.push(m);
  }
  return cot.filter((c) => c.baiViet.length > 0);
}

/** `SO_BAN_TIN` bản tin mới nhất (bài của `SUB_BAN_TIN`) trong `items`. */
export function chonBanTin(
  items: readonly MachTomTatOut[],
  toiDa: number = SO_BAN_TIN,
): MachTomTatOut[] {
  return items.filter((m) => m.sub.slug === SUB_BAN_TIN).slice(0, toiDa);
}

/** Slug các chuyên mục để dựng chip: mọi sub khai trong nhóm (đúng thứ tự khai, bỏ trùng).
 * `tin-tuc` không có chip — nó có dải riêng. */
export function slugChipChuyenMuc(nhom: readonly NhomBaiViet[] = NHOM_BAI_VIET): string[] {
  return [...new Set(nhom.flatMap((n) => n.subs))];
}
