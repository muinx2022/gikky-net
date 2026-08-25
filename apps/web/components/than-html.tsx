import { CHU_NGUOI_DUNG } from "@/lib/chu-nguoi-dung";

import css from "./than-html.module.css";
import { ThanVan } from "./than-van";

/** Thân của **MỐC** — HTML do Tiptap soạn (user chốt 2026-08-24).
 *
 * ## Đọc kỹ trước khi sửa: vì sao chỗ này được phép nhúng HTML
 *
 * Toàn bộ độ an toàn của component này nằm ở **một** chỗ và không nằm ở đây:
 * `api/core/lam_sach_html.py::lam_sach`, chạy trong `core/ghi.py` trên **mọi** đường ghi
 * `body` (tạo mạch · nối mốc · sửa mốc). Allowlist 15 thẻ, thuộc tính **chỉ** `a[href]`,
 * giao thức chỉ `http`/`https`/`mailto`. Không có đường ghi thứ tư.
 *
 * ⇒ Chuỗi tới đây **đã sạch từ lúc vào DB**, nên `dangerouslySetInnerHTML` ở đây không
 * phải "tin client", mà là "in lại thứ server đã lọc". Hai hệ quả phải nhớ:
 *
 * 1. **Đừng bao giờ đưa chuỗi từ nguồn KHÁC vào component này.** `Comment.body` và
 *    `MocRevision.body` **vẫn là markdown và chưa từng qua `lam_sach`** — chúng có đường
 *    render riêng (`ThanVan` và `<pre>`). Trộn vào đây là dựng lại đúng lỗ XSS mà cả lượt
 *    này bỏ công tránh.
 * 2. Có một bài đo bất biến ở phía Django: mọi `body` trong DB phải **bằng chính nó** sau
 *    khi `lam_sach` lần nữa. Đó là chuông báo nếu có dữ liệu lọt vào bằng đường khác.
 *
 * ## `body_dinh_dang` quyết định đường render, không đoán bằng regex
 *
 * Cột ấy tồn tại vì đoán là sai ở đúng nội dung người dùng gõ dấu `<` — mà đây là site tài
 * chính, đầy câu kiểu "giá < 27.80". Mốc cũ (trước migration `0014`) là `markdown`; nhánh
 * ấy đi thẳng về `ThanVan` — cùng một cây node có kiểu, cùng mô hình an toàn cũ.
 */
export function ThanHtml({
  body,
  dinhDang,
  className,
}: {
  body: string;
  /** `MocOut.body_dinh_dang` — `"html"` hoặc `"markdown"`. */
  dinhDang: string;
  className?: string;
}) {
  if (dinhDang !== "html") {
    return <ThanVan body={body} className={className} />;
  }
  return (
    <div
      className={`${css.than} ${className ?? ""}`}
      {...CHU_NGUOI_DUNG}
      // Xem docstring: chuỗi này đã qua `lam_sach` ở server trước khi vào DB.
      dangerouslySetInnerHTML={{ __html: body }}
    />
  );
}
