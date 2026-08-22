import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";

import {
  conMoLaiDuoc,
  gioPhutVN,
  homNayVN,
  phutSuaImLangConLai,
} from "../../lib/vong-doi";
import { quetNguon } from "./quet";

/** `lib/vong-doi.ts` — phép tính múi giờ của vòng đời mạch/mốc.
 *
 * ## Cái chuông cũ đã được GỠ, và đó là điểm chính của lượt 2026-08-23
 *
 * Tới trước lượt này, file spec đầu tiên ở đây là một **chuông chống trôi**: nó đọc thẳng
 * `api/core/ghi.py` rồi đòi ba hằng ở frontend (`SO_MOC_TOI_DA_MOI_NGAY`,
 * `PHUT_SUA_IM_LANG`, `NGAY_MO_LAI`) bằng đúng ba hằng ở Django. Cái chuông ấy tồn tại vì
 * có một **bản sao thứ hai** của luật domain nằm ở `apps/web` — nợ `API-THIEU-MOC-THOI-GIAN`.
 *
 * Nợ đã trả: API trả sẵn `mo_lai_den`, `sua_im_lang_den`, `thu_lai_tu` và
 * `tran_moc_moi_ngay`, ba hằng bị **xoá**, nên cái chuông không còn gì để canh. Bài đo
 * thay thế đi theo hướng ngược lại và mạnh hơn: nó khẳng định **không file sản phẩm nào ở
 * `apps/web` còn chép lại ba con số ấy**. Chuông cũ giữ hai bản khớp nhau; bài mới giữ cho
 * bản thứ hai đừng mọc lại.
 */

const WEB = resolve(__dirname, "..", "..");
const GOC = resolve(WEB, "..", "..");

const GHI_PY = readFileSync(resolve(GOC, "api", "core", "ghi.py"), "utf8");

/** Giá trị của một hằng số nguyên khai ở tầng module trong `api/core/ghi.py`. */
function hangPython(ten: string): number {
  const m = new RegExp(`^${ten}\\s*=\\s*(\\d+)`, "m").exec(GHI_PY);
  if (m === null) throw new Error(`không thấy hằng ${ten} trong api/core/ghi.py`);
  return Number(m[1]);
}

/** Ba hằng domain của `core/ghi.py`, kèm tên TRƯỜNG API nay đã thay chỗ cho chúng.
 *
 * Chỉ nêu tên trường, không nêu tên schema: chính file này nằm trong `apps/web`, và luật
 * `NHAC_MA_KHONG_IMPORT` của `type-frontend.spec.ts` (đúng luật ấy, đúng lý do ấy) đòi mọi
 * file nhắc tên một schema phải `import` nó từ `@gikky/api-client`.
 */
const HANG_DA_DOI_SANG_API: Readonly<Record<string, string>> = {
  NGAY_MO_LAI: "trường `mo_lai_den` của trang mạch",
  PHUT_SUA_IM_LANG: "trường `sua_im_lang_den` của mốc",
  SO_MOC_TOI_DA_MOI_NGAY: "trường `tran_moc_moi_ngay` của trang mạch",
};

const MA_SAN_PHAM = quetNguon(WEB, /\.tsx?$/).filter(
  (f) => !f.ten.startsWith("e2e/"),
);

test("ba hằng domain KHÔNG còn được khai lại ở apps/web (nợ API-THIEU-MOC-THOI-GIAN)", () => {
  const pham: string[] = [];
  for (const f of MA_SAN_PHAM) {
    for (const [ten, thay_bang] of Object.entries(HANG_DA_DOI_SANG_API)) {
      // Quét trên bản đã bỏ chú thích (`quetNguon`), nên docstring được phép nhắc tên.
      if (new RegExp(`\\b${ten}\\b`).test(f.sach)) {
        pham.push(`${f.ten}: khai lại ${ten} — API đã trả sẵn ${thay_bang}`);
      }
    }
  }
  expect(pham).toEqual([]);
});

test("bài trên không quét vào chỗ trống, và ba hằng ấy CÓ THẬT ở Django", () => {
  // Hai vế chống rỗng. Không có chúng thì "danh sách vi phạm rỗng" cũng đúng khi
  // `MA_SAN_PHAM` rỗng, hoặc khi tên hằng bị gõ sai và không khớp gì bao giờ.
  expect(MA_SAN_PHAM.length).toBeGreaterThan(15);
  expect(MA_SAN_PHAM.map((f) => f.ten)).toContain("lib/vong-doi.ts");
  expect(hangPython("SO_MOC_TOI_DA_MOI_NGAY")).toBe(3);
  expect(hangPython("PHUT_SUA_IM_LANG")).toBe(15);
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

test("gioPhutVN định dạng mốc của SERVER theo giờ VN, qua được mốc ngày", () => {
  // Nửa đêm VN kế tiếp mà `api/core/thoi_gian.py::nua_dem_vn_ke_tiep` trả về cho một 429
  // xảy ra lúc 16:30Z ngày 23/08 — tức 23:30 giờ VN cùng ngày.
  expect(gioPhutVN("2026-08-24T00:00:00+07:00")).toBe("00:00 ngày 24/08 (giờ VN)");
  // Cùng một thời điểm, viết bằng UTC: kết quả phải y hệt.
  expect(gioPhutVN("2026-08-23T17:00:00Z")).toBe("00:00 ngày 24/08 (giờ VN)");
  // Qua mốc năm.
  expect(gioPhutVN("2027-01-01T00:00:00+07:00")).toBe("00:00 ngày 01/01 (giờ VN)");
  // Chuỗi rác không được in "Invalid Date" ra mặt người dùng.
  expect(gioPhutVN("khong-phai-ngay")).toBeNull();
});

test("conMoLaiDuoc đọc `mo_lai_den` của server, không tự cộng 7 ngày", () => {
  const bay_gio = new Date("2026-08-23T10:00:00Z");
  const sau = (gio: number) =>
    new Date(bay_gio.getTime() + gio * 3600_000).toISOString();

  // `null` = mạch chưa đóng sổ ⇒ không có gì để mở lại.
  expect(conMoLaiDuoc(null, bay_gio)).toBe(false);
  expect(conMoLaiDuoc(sau(1), bay_gio)).toBe(true);
  // Đúng biên: hạn rơi vào chính lúc này vẫn còn (server từ chối bằng `>`, không `>=`).
  expect(conMoLaiDuoc(sau(0), bay_gio)).toBe(true);
  expect(conMoLaiDuoc(sau(-1), bay_gio)).toBe(false);
  // Chuỗi rác không được làm nút hiện ra.
  expect(conMoLaiDuoc("khong-phai-ngay", bay_gio)).toBe(false);
});

test("phutSuaImLangConLai — làm tròn LÊN, và 0 nghĩa là hết", () => {
  const bay_gio = new Date("2026-08-23T10:00:00Z");
  const sau = (phut: number) =>
    new Date(bay_gio.getTime() + phut * 60_000).toISOString();

  expect(phutSuaImLangConLai(sau(15), bay_gio)).toBe(15);
  expect(phutSuaImLangConLai(sau(0.5), bay_gio)).toBe(1);
  expect(phutSuaImLangConLai(sau(0), bay_gio)).toBe(0);
  expect(phutSuaImLangConLai(sau(-45), bay_gio)).toBe(0);
  expect(phutSuaImLangConLai("khong-phai-ngay", bay_gio)).toBe(0);
});
