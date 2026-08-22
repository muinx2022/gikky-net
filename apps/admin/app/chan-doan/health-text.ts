import type { getHealth } from "@gikky/api-client";

// `<false>` = ThrowOnError. Bỏ nó đi thì TS lấy ràng buộc `boolean` rồi phân phối conditional
// type thành union của CẢ HAI kiểu trả về, và `error` biến mất khỏi kiểu.
type KetQuaGetHealth = Awaited<ReturnType<typeof getHealth<false>>>;

/** Kể ĐÚNG chuyện đã xảy ra — trang này là công cụ chẩn đoán, nuốt lỗi là phản tác dụng.
 *
 * Hai tình huống hỏng phải phân biệt được, vì cách sửa của chúng khác hẳn nhau:
 * - `error` mà KHÔNG có `response`: fetch chết trước khi có HTTP (Django chưa chạy, sai
 *   cổng, DNS). client-fetch của hey-api **không ném** ở ca này, nó nhét lỗi vào `error` —
 *   nên chỉ dựa vào `try/catch` là im lặng nuốt mất;
 * - `error` kèm `response`: server trả mã lỗi, ví dụ 503 của healthcheck khi DB hỏng.
 */
export function moTaHealth({ data, error, response }: KetQuaGetHealth): string {
  if (error !== undefined) {
    const ma = response ? `HTTP ${response.status}` : "không có phản hồi (mạng/cổng)";
    return `LỖI ${ma}: ${moTaLoi(error)}`;
  }
  return `status=${data.status} db=${data.db}`;
}

function moTaLoi(loi: unknown): string {
  if (loi instanceof Error) return `${loi.name}: ${loi.message}`;
  if (typeof loi === "string") return loi;
  return JSON.stringify(loi);
}
