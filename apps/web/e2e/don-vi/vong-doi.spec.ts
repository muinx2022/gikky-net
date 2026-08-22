import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import {
  NGAY_MO_LAI,
  PHUT_SUA_IM_LANG,
  SO_MOC_TOI_DA_MOI_NGAY,
  conMoLaiDuoc,
  homNayVN,
  moiVietTiep,
  phutSuaImLangConLai,
} from "../../lib/vong-doi";

/** `lib/vong-doi.ts` — ba mốc thời gian của vòng đời mạch/mốc mà GIAO DIỆN phải biết.
 *
 * Hai nhóm bài đo, và nhóm thứ nhất mới là nhóm quan trọng:
 *
 * 1. **Chuông chống trôi**: ba hằng ở frontend phải BẰNG ĐÚNG ba hằng ở `api/core/ghi.py`.
 *    PLAN nguyên tắc 10 nói luật domain ở Django; frontend giữ bản sao chỉ để *quyết định
 *    render* (nút Mở lại có tồn tại không, câu cảnh báo nói gì) — mà một bản sao không có
 *    chuông là bản sao sẽ trôi. Đọc thẳng file Python chứ không chép số vào đây: chép số
 *    là dựng bản sao **thứ ba**.
 * 2. Phép tính múi giờ: mọi thứ theo **Asia/Ho_Chi_Minh**, không theo múi giờ máy chạy.
 */

const GHI_PY = readFileSync(
  resolve(__dirname, "..", "..", "..", "..", "api", "core", "ghi.py"),
  "utf8",
);

/** Giá trị của một hằng số nguyên khai ở tầng module trong `api/core/ghi.py`. */
function hangPython(ten: string): number {
  const m = new RegExp(`^${ten}\\s*=\\s*(\\d+)`, "m").exec(GHI_PY);
  if (m === null) throw new Error(`không thấy hằng ${ten} trong api/core/ghi.py`);
  return Number(m[1]);
}

test("chuông chống trôi — ba hằng ở frontend khớp ĐÚNG api/core/ghi.py", () => {
  expect(SO_MOC_TOI_DA_MOI_NGAY).toBe(hangPython("SO_MOC_TOI_DA_MOI_NGAY"));
  expect(PHUT_SUA_IM_LANG).toBe(hangPython("PHUT_SUA_IM_LANG"));
  expect(NGAY_MO_LAI).toBe(hangPython("NGAY_MO_LAI"));
});

test("chuông trên KHÔNG nghiệm đúng với mọi thứ (chống hàng rào rỗng)", () => {
  // Nếu `hangPython` trả về `NaN` hay luôn trả cùng một số thì bài trên xanh vô nghĩa.
  expect(hangPython("SO_MOC_TOI_DA_MOI_NGAY")).toBe(3);
  expect(hangPython("NGAY_MO_LAI")).toBe(7);
  expect(() => hangPython("HANG_KHONG_CO_THAT")).toThrow();
});

test("homNayVN theo giờ VN, không theo UTC", () => {
  // 16:30Z = 23:30 VN cùng ngày…
  expect(homNayVN(new Date("2026-08-23T16:30:00Z"))).toBe("2026-08-23");
  // …17:30Z = 00:30 VN NGÀY HÔM SAU. Bản tính bằng UTC sẽ nói 2026-08-23 và sai đúng ở
  // khung giờ đông người dùng nhất.
  expect(homNayVN(new Date("2026-08-23T17:30:00Z"))).toBe("2026-08-24");
});

test("moiVietTiep = nửa đêm VN kế tiếp, qua được cả mốc tháng và mốc năm", () => {
  expect(moiVietTiep(new Date("2026-08-23T16:30:00Z"))).toBe(
    "00:00 ngày 24/08 (giờ VN)",
  );
  // 17:30Z ngày 23 đã là ngày 24 giờ VN ⇒ mốc kế tiếp là ngày 25.
  expect(moiVietTiep(new Date("2026-08-23T17:30:00Z"))).toBe(
    "00:00 ngày 25/08 (giờ VN)",
  );
  expect(moiVietTiep(new Date("2026-08-31T10:00:00Z"))).toBe(
    "00:00 ngày 01/09 (giờ VN)",
  );
  expect(moiVietTiep(new Date("2026-12-31T10:00:00Z"))).toBe(
    "00:00 ngày 01/01 (giờ VN)",
  );
});

test("conMoLaiDuoc — 7 ngày, và mạch chưa đóng thì không có gì để mở lại", () => {
  const bay_gio = new Date("2026-08-23T10:00:00Z");
  const truoc = (gio: number) =>
    new Date(bay_gio.getTime() - gio * 3600_000).toISOString();

  expect(conMoLaiDuoc(null, bay_gio)).toBe(false);
  expect(conMoLaiDuoc(truoc(1), bay_gio)).toBe(true);
  expect(conMoLaiDuoc(truoc(24 * 6), bay_gio)).toBe(true);
  // Đúng biên: 7 ngày chẵn vẫn còn (server dùng `>` để từ chối, không phải `>=`).
  expect(conMoLaiDuoc(truoc(24 * 7), bay_gio)).toBe(true);
  expect(conMoLaiDuoc(truoc(24 * 7 + 1), bay_gio)).toBe(false);
  // Chuỗi rác không được làm nút hiện ra.
  expect(conMoLaiDuoc("khong-phai-ngay", bay_gio)).toBe(false);
});

test("phutSuaImLangConLai — làm tròn LÊN, và 0 nghĩa là hết", () => {
  const bay_gio = new Date("2026-08-23T10:00:00Z");
  const truoc = (phut: number) =>
    new Date(bay_gio.getTime() - phut * 60_000).toISOString();

  expect(phutSuaImLangConLai(truoc(0), bay_gio)).toBe(PHUT_SUA_IM_LANG);
  expect(phutSuaImLangConLai(truoc(14.5), bay_gio)).toBe(1);
  expect(phutSuaImLangConLai(truoc(15), bay_gio)).toBe(0);
  expect(phutSuaImLangConLai(truoc(60), bay_gio)).toBe(0);
  expect(phutSuaImLangConLai("khong-phai-ngay", bay_gio)).toBe(0);
});
