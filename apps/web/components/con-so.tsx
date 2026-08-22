import css from "./con-so.module.css";

/** Dấu của một giá trị `figures` — thuần hiển thị, giống hệt triết lý của API.
 *
 * PLAN 5.2 chốt `figures` **không validate ngữ nghĩa**: server nhận `{label, value}` là
 * chuỗi tự do. Nên ở đây cũng chỉ nhìn KÝ TỰ ĐẦU, không cố hiểu "27.80" là giá hay là
 * phần trăm. Chuỗi không mở đầu bằng dấu ⇒ mực thường, không tô màu.
 *
 * Đây là chỗ DUY NHẤT quyết định khi nào xanh/đỏ được bật (PLAN 9.1).
 */
function dau(value: string): "lai" | "lo" | "khong" {
  const c = value.trimStart()[0];
  if (c === "+") return "lai";
  if (c === "-" || c === "−") return "lo";
  return "khong";
}

/** Một con số lãi/lỗ. `--gain`/`--loss` chỉ sống ở đây (xem `con-so.module.css`). */
export function SoLaiLo({ value }: { value: string }) {
  const d = dau(value);
  const lop = d === "lai" ? css.lai : d === "lo" ? css.lo : undefined;
  return (
    <span className={`${css.so}${lop ? ` ${lop}` : ""}`} data-dau={d}>
      {value}
    </span>
  );
}
