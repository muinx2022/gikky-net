import { TZ_VN } from "@/lib/dinh-dang";

/** Năm của dòng `© {năm} gikky.net` ở chân trang (plan `2026-11-13-ban-tin-len-dau-ban-quyen.md`
 * §3.3). Hàm THUẦN để đo được không cần server (`e2e/don-vi/ban-quyen.spec.ts`).
 *
 * Năm theo giờ Việt Nam (`TZ_VN`), không theo múi giờ máy chạy Node: server ở UTC thì 7 giờ đầu
 * ngày 01/01 vẫn còn là năm cũ. Trang tĩnh / ISR in năm lúc build hoặc lúc tái sinh trang — giới
 * hạn đã chấp nhận ở plan. */
const NAM_VN = new Intl.DateTimeFormat("en-US", { timeZone: TZ_VN, year: "numeric" });

export function namBanQuyen(bayGio: Date): number {
  return Number(NAM_VN.format(bayGio));
}
