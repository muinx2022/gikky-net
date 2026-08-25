import { docCacSub } from "@/lib/api";

import css from "./khung-hai-cot.module.css";
import { Sidebar } from "./sidebar";

/** Khung **hai cột dùng chung** cho mọi trang nội dung — user chốt 2026-08-24.
 *
 * ## Vì sao nó tồn tại: chuyển trang bị "nhảy nhót"
 *
 * Tới hôm ấy mỗi trang tự khai bề rộng: trang chủ và trang sub `1060px` **hai cột**, trang
 * mạch và hồ sơ `860px` **một cột**, tìm kiếm `760px`. Ba con số ⇒ cột nội dung **nhảy
 * ngang** ở mỗi lần điều hướng, và cái rail phải thì lúc có lúc không. Đó là thứ user gọi
 * là "nhảy nhót", và nó không sửa được bằng cách chỉnh từng trang một — chỉnh xong vẫn là
 * ba nguồn sự thật, chỉ khác là chúng trùng nhau *hôm nay*.
 *
 * Nên: **một** chỗ khai bề rộng + lưới, mọi trang nội dung đi qua nó. Trang chủ và trang
 * sub vẫn dùng lưới riêng trong `feed.module.css` vì `Feed` nhận `sidebar` làm prop —
 * nhưng ba con số ở đó **phải khớp** với ba con số ở đây; xem chú thích trong
 * `khung-hai-cot.module.css`.
 *
 * ## Nó tự hỏi `GET /subs`
 *
 * `Sidebar` cần danh sách chuyên mục, và bắt mỗi trang tự nạp rồi truyền xuống là bốn chỗ
 * cùng làm một việc. `docCacSub` đi qua data cache của Next nên lời gọi thêm này gần như
 * không tốn gì — và **cấm gõ cứng slug** ở đây, đúng nợ `NAV-GHI-CUNG`.
 *
 * ## `<main>` nằm ở ĐÂY, không ở trang con
 *
 * Ba trang kia trước đây mỗi trang một `<main>`. Bọc thêm một lớp nữa là `<main>` lồng
 * `<main>` — HTML sai và trình đọc màn hình mất mốc điều hướng. Nên trang con nay trả về
 * **nội dung trần**, khung này lo thẻ `<main>`.
 */
export async function KhungHaiCot({ children }: { children: React.ReactNode }) {
  const cac_sub = await docCacSub();
  return (
    <div className={css.khung}>
      <main className={css.chinh}>{children}</main>
      {/* Lớp bọc `sticky` — cùng vai với `feed.module.css#.rail`. Không có nó thì rail
          dính ở trang chủ mà KHÔNG dính ở các trang khác, tức lại một kiểu "nhảy nhót"
          nữa, chỉ là theo chiều dọc. */}
      <div className={css.rail}>
        <Sidebar cacSub={cac_sub} />
      </div>
    </div>
  );
}
