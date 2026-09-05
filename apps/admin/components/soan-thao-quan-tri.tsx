"use client";

import { quanTriTaiAnhNoiDung } from "@gikky/api-client/admin";
import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { useRef, useState } from "react";

import { GOC_API, headerGhi } from "../lib/api";

/** Trình soạn thảo **thân mốc** cho khu quản trị — Tiptap, xuất ra HTML.
 *
 * ## Vì sao là Tiptap chứ không phải một `<textarea>`
 *
 * Mọi hàng `Moc` trong DB đang mang `body_dinh_dang = "html"` (cả ba đường ghi đều đặt
 * `html` sau `lam_sach`). Một textarea ở đây là mod sửa HTML thô bằng tay, và một dấu
 * `<` gõ nhầm là cả đoạn biến mất lúc `lam_sach` chạy. User chốt 2026-09-03: *"vì front
 * sử dụng tiptap để post bài, nên admin cũng cần tiptap để sửa"*.
 *
 * ## Thanh công cụ chỉ có đúng những gì server GIỮ LẠI
 *
 * `core/lam_sach_html.py` allowlist 15 thẻ: `p br strong em u s code pre blockquote ul ol
 * li a h2 h3 hr`. Nút nào tạo ra thẻ ngoài danh sách ấy sẽ cho mod một định dạng **biến
 * mất lúc lưu**. Nên thanh dưới đây là **tập con của allowlist**, và `StarterKit` bị tắt
 * bớt cho khớp.
 *
 * ⚠ **Sửa allowlist ở server thì phải sửa BA chỗ**: `core/lam_sach_html.py`,
 * `apps/web/components/soan-thao.tsx`, và file này. Ba file ở hai ngôn ngữ, không có gì
 * tự giữ chúng khớp ngoài dòng chú thích này.
 *
 * ## Vì sao không chép nguyên `apps/web/components/soan-thao.tsx`
 *
 * Bản ấy dùng `lucide-react` (không có ở `apps/admin`) và CSS Modules (khu quản trị dùng
 * Tailwind + token). Thứ **phải** giống là cấu hình extension và luật ảnh — chúng là hợp
 * đồng với server; phần vỏ thì theo hệ của app này.
 *
 * ## `immediatelyRender: false` là bắt buộc, không phải tuỳ chọn
 *
 * Tiptap dựng DOM ngay lúc khởi tạo; với SSR của Next thì lượt render server và lượt
 * hydrate ra hai cây khác nhau ⇒ hydration mismatch. Cờ này hoãn tới sau khi mount.
 *
 * ## Ảnh: tải lên TRƯỚC, chèn URL SAU
 *
 * Ba lối vào — nút, kéo-thả, dán — đều đi qua đúng một hàm `chenAnh`. Ảnh **không bao
 * giờ** nằm trong `body` dưới dạng `data:` URI: `POST /admin/anh` lưu file rồi trả
 * `/media/…`, và chỉ chuỗi ấy mới được chèn. `lam_sach` ở server **gỡ cả thẻ `img`** có
 * `src` ngoài `/media/`, nên một `data:` URI hay một origin tuyệt đối là ảnh "biến mất
 * lúc lưu" — đúng loài lỗi trông như bug của editor.
 *
 * ## Nó KHÔNG phải hàng rào an toàn
 *
 * HTML gửi lên vẫn đi qua `lam_sach` ở server, và bảy phép kiểm ảnh vẫn ở `core/anh.py`.
 * Trình soạn thảo chỉ để mod thấy trước thứ mình sắp lưu.
 */
export function SoanThaoQuanTri({
  giaTri,
  datGiaTri,
  khoa = false,
  choPhepAnh = true,
}: {
  giaTri: string;
  datGiaTri: (html: string) => void;
  /** Chỉ đọc — mốc đã bị gỡ, mạch bị khoá, hoặc người xem không phải superuser. */
  khoa?: boolean;
  /** Cho phép chèn ảnh vào thân bài (nút 🖼, kéo-thả, dán) hay không — **tách khỏi
   * `khoa`**: soạn chữ và chèn ảnh có thể cần hai mức quyền khác nhau. Xem `/machs/moi`,
   * nơi mọi staff soạn được chữ nhưng chỉ superuser chèn được ảnh —
   * `tai_anh_noi_dung_quan_tri` ở `api/api/quan_tri_sua_bai.py` chặn
   * `chan_neu_khong_phai_superuser`.
   *
   * Mặc định `true` để chỗ gọi cũ (trang sửa mốc, vốn khoá cả editor bằng `khoa`) không
   * đổi hành vi. */
  choPhepAnh?: boolean;
}) {
  const [dang_tai_anh, datDangTaiAnh] = useState(false);
  const [loi_anh, datLoiAnh] = useState<string | null>(null);
  const o_file = useRef<HTMLInputElement>(null);
  /** Editor cho hai handler của `editorProps`.
   *
   * Chúng được khai TRONG lời gọi `useEditor`, tức lúc biến `editor` chưa tồn tại — nhưng
   * chúng chỉ CHẠY sau khi editor đã dựng xong. Ref là cách bắc cầu đúng: gán sau, đọc
   * lúc chạy. */
  const ed_ref = useRef<Editor | null>(null);

  /** Lối đi CHUNG của cả ba cách chèn ảnh (nút · kéo-thả · dán).
   *
   * Nhận `Editor` làm tham số thay vì đọc biến ngoài: hàm này bị gọi từ `editorProps`,
   * tức từ lúc `editor` còn đang được khởi tạo — đọc biến ngoài ở đó là `undefined`.
   */
  const chenAnh = async (ed: Editor, file: File) => {
    datLoiAnh(null);
    if (!file.type.startsWith("image/")) {
      datLoiAnh("Chỉ chèn được ảnh (JPEG, PNG hoặc WebP).");
      return;
    }
    datDangTaiAnh(true);
    try {
      const kq = await quanTriTaiAnhNoiDung({
        baseUrl: GOC_API,
        // Chỉ `X-CSRFToken` — cố ý KHÔNG đặt `Content-Type`, để trình duyệt tự dựng
        // ranh giới multipart. Đặt tay là request hỏng với một câu lỗi không nói gì.
        headers: headerGhi(),
        body: { file },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      ed.chain().focus().setImage({ src: kq.data.url, alt: file.name }).run();
    } catch {
      // Client sinh từ OpenAPI không ném theo mã, nên ở đây không phân biệt được
      // 413/400/403. Câu chung phải nói ra CẢ BA khả năng hay gặp thay vì một chữ "lỗi" —
      // và vế quyền hạn không được bỏ: `tai_anh_noi_dung_quan_tri` chặn non-superuser, nên
      // một câu chỉ nói "ảnh quá nặng" là đẩy mod đi nén ảnh vô ích.
      datLoiAnh(
        "Không tải được ảnh — có thể ảnh quá nặng, không phải JPEG/PNG/WebP, " +
          "hoặc tài khoản của bạn không đủ quyền chèn ảnh.",
      );
    } finally {
      datDangTaiAnh(false);
      if (o_file.current !== null) o_file.current.value = "";
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    editable: !khoa,
    extensions: [
      StarterKit.configure({
        // Ngoài allowlist của server ⇒ tắt, để không ai gõ được thứ sẽ bị xoá lúc lưu.
        horizontalRule: false,
        codeBlock: false,
        heading: { levels: [2, 3] },
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
    ],
    content: giaTri,
    onUpdate: ({ editor: e }) => {
      // `isEmpty` chứ không so chuỗi: Tiptap để lại `<p></p>` khi người ta xoá hết, và
      // chuỗi ấy qua được `min_length=1` rồi bị `lam_sach` cắt thành rỗng ⇒ server từ
      // chối bằng một câu lỗi khó hiểu. Trả chuỗi rỗng để form tự bắt sớm.
      datGiaTri(e.isEmpty ? "" : e.getHTML());
    },
    editorProps: {
      handleDrop: (_view, su_kien) => {
        if (khoa || !choPhepAnh) return false;
        const ds = (su_kien as DragEvent).dataTransfer?.files;
        const anh = ds ? [...ds].filter((f) => f.type.startsWith("image/")) : [];
        if (anh.length === 0) return false;
        su_kien.preventDefault();
        const ed = ed_ref.current;
        if (ed === null) return false;
        anh.forEach((f) => void chenAnh(ed, f));
        return true;
      },
      handlePaste: (_view, su_kien) => {
        if (khoa || !choPhepAnh) return false;
        const ds = (su_kien as ClipboardEvent).clipboardData?.files;
        const anh = ds ? [...ds].filter((f) => f.type.startsWith("image/")) : [];
        if (anh.length === 0) return false;
        su_kien.preventDefault();
        const ed = ed_ref.current;
        if (ed === null) return false;
        anh.forEach((f) => void chenAnh(ed, f));
        return true;
      },
      attributes: {
        class: "soan-thao-quan-tri",
        "data-testid": "soan-than",
      },
    },
  });

  ed_ref.current = editor;

  if (editor === null) {
    // Chỗ giữ CÙNG chiều cao với vùng soạn thật — `null` làm cả form nhảy một nhịp khi
    // editor mount xong.
    return (
      <div className="the min-h-40" aria-busy="true" data-testid="soan-cho" />
    );
  }

  /** Ba lý do cửa ảnh đóng, một cờ — nhưng **hai câu chữ**: "đang bận" và "không được
   * phép" là hai thứ mod xử lý khác nhau, còn `khoa` thì đã tự nói ra bằng cả một editor
   * xám. Câu "chỉ superuser" chỉ hiện ở đúng ca mới: chữ mở, ảnh đóng. */
  const anh_khoa = dang_tai_anh || khoa || !choPhepAnh;
  const nhan_anh =
    !choPhepAnh && !khoa ? "Chỉ superuser chèn được ảnh" : "Chèn ảnh vào bài";

  const nut = (
    nhan: string,
    ten: string,
    dang_bat: boolean,
    bam: () => void,
    test_id: string,
  ) => (
    <button
      type="button"
      className={`nut nut-nho ${dang_bat ? "nut-chinh" : ""}`}
      onMouseDown={(e) => e.preventDefault()} // giữ vùng chọn khi bấm
      onClick={bam}
      aria-pressed={dang_bat}
      aria-label={ten}
      title={ten}
      disabled={khoa}
      data-testid={test_id}
    >
      {nhan}
    </button>
  );

  const datLink = () => {
    const cu = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Địa chỉ liên kết (http, https hoặc mailto):", cu ?? "");
    if (url === null) return;
    if (url.trim() === "") {
      editor.chain().focus().unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url.trim() }).run();
  };

  return (
    <div className="the overflow-hidden">
      <div
        className="flex flex-wrap items-center gap-1 border-b border-vien bg-nen-mo p-1.5"
        role="toolbar"
        aria-label="Định dạng"
      >
        {nut("B", "Đậm", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "soan-dam")}
        {nut("I", "Nghiêng", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "soan-nghieng")}
        {nut("S", "Gạch ngang", editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "soan-gach")}
        {nut("</>", "Mã", editor.isActive("code"), () => editor.chain().focus().toggleCode().run(), "soan-ma")}
        {nut("H2", "Tiêu đề lớn", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "soan-h2")}
        {nut("H3", "Tiêu đề nhỏ", editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "soan-h3")}
        {nut("•", "Danh sách", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "soan-danh-sach")}
        {nut("1.", "Danh sách đánh số", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "soan-danh-sach-so")}
        {nut("❝", "Trích", editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "soan-trich")}
        {nut("🔗", "Liên kết", editor.isActive("link"), datLink, "soan-link")}

        {/* `<label>` bọc `<input type=file>` ẩn — input file gốc không đổi được hình dạng,
            còn label thì nhận đúng cú bấm lẫn bàn phím cho ô ẩn bên trong.

            `opacity-50` gõ tay ở đây chứ không nhờ `disabled:opacity-50` của `.nut`: một
            `<label>` không có thuộc tính `disabled`, nên biến thể ấy không bao giờ khớp —
            và một nút trông y hệt lúc bấm được lẫn lúc không là nút mod bấm hoài. */}
        <label
          className={`nut nut-nho ${anh_khoa ? "opacity-50" : ""}`}
          aria-disabled={anh_khoa}
          title={nhan_anh}
          data-testid="soan-anh"
        >
          <span aria-hidden>🖼</span>
          <span className="sr-only">{nhan_anh}</span>
          <input
            ref={o_file}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            hidden
            disabled={anh_khoa}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void chenAnh(editor, f);
            }}
            data-testid="soan-anh-file"
          />
        </label>
        {dang_tai_anh && (
          <span className="mono text-xs text-muc-mo" role="status">
            Đang tải ảnh…
          </span>
        )}
      </div>

      {loi_anh !== null && (
        <p className="border-b border-vien px-3 py-2 text-sm text-xau" role="alert" data-testid="soan-anh-loi">
          {loi_anh}
        </p>
      )}

      <EditorContent editor={editor} />
    </div>
  );
}
