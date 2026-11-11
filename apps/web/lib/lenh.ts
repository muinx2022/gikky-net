import type { LenhOut } from "@gikky/api-client";

/** Dải lệnh của thẻ nhật ký trang chủ — hàm THUẦN để đo được không cần mạng
 * (`e2e/don-vi/trang-chu-giao-dien-moi.spec.ts`).
 *
 * Số trong `LenhOut` là CHUỖI do server chuẩn hoá (bỏ số 0 thừa, không dạng mũ): web in
 * nguyên văn, **không** `Number()` / `toFixed()` lại — làm vậy là dựng bản sao thứ hai của
 * luật chuẩn hoá và nó sẽ lệch (0.8100 → 0.81 ở server, → "0.81" hay "0.8100" ở client tuỳ
 * số chữ số lẻ nó đoán). Dải này chỉ có khi mạch KHAI lệnh; mạch không khai thì
 * `mach.lenh === null` và dải biến mất — không parse tiêu đề để suy ra.
 */

/** Nhãn chiều lệnh. `Record<…>` ép đủ hai chiều: API mọc thêm chiều mà thiếu nhãn ở đây là
 * lỗi biên dịch. */
export const NHAN_CHIEU_LENH: Readonly<Record<LenhOut["chieu"], string>> = {
  mua: "MUA",
  ban: "BÁN",
};

export type KhoaOLenh = "entry" | "sl" | "tp" | "nhoi" | "rr";

export type OLenh = { khoa: KhoaOLenh; nhan: string; gia_tri: string };

/** Các ô sau cặp "chiều + mã", theo thứ tự của mockup: Entry · SL · TP · Nhồi · R:R. Ô
 * thiếu số (không khai SL / TP / nhồi, hoặc không đủ SL + TP để có R:R) thì bỏ hẳn. */
export function cacOLenh(lenh: LenhOut): OLenh[] {
  const o: OLenh[] = [{ khoa: "entry", nhan: "Entry", gia_tri: lenh.gia_vao }];
  if (lenh.sl != null) o.push({ khoa: "sl", nhan: "SL", gia_tri: lenh.sl });
  if (lenh.tp != null) o.push({ khoa: "tp", nhan: "TP", gia_tri: lenh.tp });
  if (lenh.nhoi != null) o.push({ khoa: "nhoi", nhan: "Nhồi", gia_tri: lenh.nhoi });
  if (lenh.rr != null) o.push({ khoa: "rr", nhan: "R:R", gia_tri: lenh.rr });
  return o;
}
