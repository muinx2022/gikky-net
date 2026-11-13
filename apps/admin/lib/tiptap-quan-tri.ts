import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import StarterKit from "@tiptap/starter-kit";

/** Bộ extension Tiptap của khu quản trị — MỘT chỗ, dùng cho cả `components/soan-thao-quan-tri.tsx`
 * lẫn bài đo round-trip `apps/web/e2e/don-vi/quan-tri-ban-tin-tiptap.spec.ts` (bài ấy dựng
 * đúng hàm này trong trình duyệt, không chép lại cấu hình).
 *
 * ## Khớp allowlist của server, theo CẢ HAI chiều
 *
 * `api/core/lam_sach_html.py::THE_CHO_PHEP` giữ lại `p br strong em u s code pre blockquote ul ol
 * li a h2 h3 hr` (+ `img` từ kho site). Nút nào tạo ra thẻ ngoài danh sách ấy là định dạng biến
 * mất lúc lưu — nên chỉ tắt đúng những gì server GỠ (`h1`, `h4`–`h6`).
 *
 * ⚠ Chiều ngược lại cũng là mất dữ liệu, và nó đã xảy ra: bản cũ tắt `horizontalRule` và
 * `codeBlock` với chú thích "ngoài allowlist của server" — SAI, `hr` và `pre` đều trong
 * allowlist. Tiptap không có node cho một thẻ thì **xoá thẻ đó khỏi nội dung lúc nạp**: mở
 * một bản tin thật (5 `<hr>`), gõ một dấu phẩy, Lưu ⇒ mất cả 5 `<hr>`, `<pre>` thành
 * `<p>…<br>…</p>` (vòng sửa 1 việc 21, đợt D).
 *
 * ⚠ **Sửa allowlist ở server thì phải sửa BA chỗ**: `core/lam_sach_html.py`,
 * `apps/web/components/soan-thao.tsx`, và file này.
 */
export function phanMoRongQuanTri() {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3] },
      // Link cấu hình riêng dưới đây (giao thức), không dùng bản của StarterKit.
      link: false,
    }),
    // Ảnh CHỈ từ kho của site. `allowBase64: false` là vế bắt buộc: một `data:` URI
    // khổng lồ nhét thẳng vào `body` sẽ qua mặt cả lệnh dọn ảnh mồ côi, và `lam_sach`
    // ở server sẽ gỡ nó ⇒ ảnh "biến mất lúc lưu".
    Image.configure({ allowBase64: false, inline: false }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      // Khớp allowlist giao thức của server. `lam_sach` vẫn là chốt cuối.
      protocols: ["http", "https", "mailto"],
    }),
  ];
}
