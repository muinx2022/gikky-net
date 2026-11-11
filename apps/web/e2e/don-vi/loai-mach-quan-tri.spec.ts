import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { expect, test } from "@playwright/test";

import {
  LUA_CHON_LOAI_MACH,
  truongLoaiMach,
  type LuaChonLoaiMach,
} from "../../../admin/lib/loai-mach";
import { boChuThich } from "./quet";

/** K9 — ô chọn "Loại mạch" của form đăng bài ở khu quản trị
 * (`apps/admin/components/form-dang-bai.tsx`, plan homepage-v2 §3.7).
 *
 * Luật cần ghim: **"Theo tác giả" (mặc định) KHÔNG gửi `loai_mach`**; ba lựa chọn còn lại gửi
 * đúng giá trị của chúng. Gửi thừa một `loai_mach: "nhat_ky"` ở mặc định nghe vô hại nhưng đổi
 * hành vi: tài khoản đội sẽ ra nhật ký thay vì bài viết (server phân giải theo tác giả CHỈ khi
 * vắng khoá). Hai tầng canh:
 * 1. hàm thuần `truongLoaiMach` (ở đây, đo giá trị);
 * 2. form THẬT sự đi qua hàm ấy, ngay trong thân request (đọc nguồn — vì lời gọi API cần server).
 * Lần chạy thật trên trình duyệt + DB nháp là phần của báo cáo đợt B, không nằm trong bộ này. */

const ADMIN = resolve(__dirname, "..", "..", "..", "admin");
const form = () =>
  boChuThich(readFileSync(resolve(ADMIN, "components/form-dang-bai.tsx"), "utf8"));

test("mặc định (theo tác giả): thân request KHÔNG có khoá loai_mach", () => {
  const phan = truongLoaiMach("");
  expect(phan).toEqual({});
  expect(Object.keys(phan)).not.toContain("loai_mach");
  // …kể cả sau khi trải vào thân y như form làm.
  const than = { sub: "x", ...truongLoaiMach("") };
  expect("loai_mach" in than).toBe(false);
});

test("ba lựa chọn tường minh gửi ĐÚNG giá trị của chúng", () => {
  expect(truongLoaiMach("thao_luan")).toEqual({ loai_mach: "thao_luan" });
  expect(truongLoaiMach("bai_viet")).toEqual({ loai_mach: "bai_viet" });
  expect(truongLoaiMach("nhat_ky")).toEqual({ loai_mach: "nhat_ky" });
});

test("ô chọn có đúng bốn lựa chọn, theo thứ tự, mặc định là 'theo tác giả'", () => {
  expect(LUA_CHON_LOAI_MACH.map((l) => l.gia_tri)).toEqual([
    "",
    "nhat_ky",
    "bai_viet",
    "thao_luan",
  ]);
  expect(LUA_CHON_LOAI_MACH[0].nhan).toMatch(/Theo tác giả/);
  expect(LUA_CHON_LOAI_MACH.map((l) => l.nhan)).toEqual(
    expect.arrayContaining(["Nhật ký", "Bài viết", "Chủ đề thảo luận"]),
  );
  // Mỗi giá trị khác "" phải là một giá trị mà API nhận (kiểu `LoaiMachGui` ép ở biên dịch;
  // đây là vế chạy được: không có giá trị lạ lọt vào ô chọn).
  for (const l of LUA_CHON_LOAI_MACH) {
    expect(["", "nhat_ky", "bai_viet", "thao_luan"]).toContain(l.gia_tri satisfies LuaChonLoaiMach);
  }
});

test("form THẬT: state khởi tạo là '' và thân request trải truongLoaiMach(loai_mach)", () => {
  const sach = form();
  expect(sach).toMatch(/useState<LuaChonLoaiMach>\(\s*""\s*\)/);
  // Trải ĐÚNG trong thân `quanTriTaoMachHenGio`, không ở chỗ nào khác của file.
  expect(sach).toMatch(
    /quanTriTaoMachHenGio\(\{[\s\S]*?body:\s*\{[\s\S]*?\.\.\.truongLoaiMach\(\s*loai_mach\s*\)[\s\S]*?\}\s*,\s*\}\s*\)/,
  );
  // Không gửi cứng một `loai_mach:` nào ở form (mọi đường đều phải qua hàm).
  expect(sach).not.toMatch(/\bloai_mach\s*:\s*["'`]/);
  // Ô chọn tồn tại và nối với state.
  expect(sach).toMatch(/data-testid="o-loai-mach"/);
  expect(sach).toMatch(/value=\{loai_mach\}/);
  expect(sach).toMatch(/LUA_CHON_LOAI_MACH\.map/);
});
