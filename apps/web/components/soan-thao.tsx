"use client";

import Image from "@tiptap/extension-image";
import Link from "@tiptap/extension-link";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import { useRef, useState } from "react";
import StarterKit from "@tiptap/starter-kit";
import { taiAnhNoiDung } from "@gikky/api-client";
import {
  Bold,
  Code,
  Heading2,
  Heading3,
  ImagePlus,
  Italic,
  Link2,
  List,
  ListOrdered,
  Quote,
  Strikethrough,
  type LucideIcon,
} from "lucide-react";

import { GOC_TRINH_DUYET, headerGhiFile } from "@/lib/tai-khoan";

import css from "./soan-thao.module.css";

/** Trình soạn thảo của **thân mốc** — Tiptap, xuất ra HTML (user chốt 2026-08-24).
 *
 * ## Thanh công cụ chỉ có đúng những gì server GIỮ LẠI
 *
 * `core/lam_sach_html.py` allowlist 15 thẻ: `p br strong em u s code pre blockquote ul ol
 * li a h2 h3 hr`. Nút nào tạo ra thẻ ngoài danh sách ấy sẽ cho người dùng một định dạng
 * **biến mất lúc lưu** — gõ thấy đúng, đăng lên thì mất. Nên thanh công cụ dưới đây là
 * **tập con của allowlist**, và `StarterKit` bị tắt bớt cho khớp.
 *
 * ⚠ Sửa allowlist ở server thì phải sửa cả hai chỗ. Chúng là hai file ở hai ngôn ngữ, nên
 * không có gì tự giữ chúng khớp ngoài dòng chú thích này và bài đo ở phía Django.
 *
 * ## `immediatelyRender: false` là bắt buộc, không phải tuỳ chọn
 *
 * Tiptap dựng DOM ngay lúc khởi tạo; với SSR của Next thì lượt render server và lượt
 * hydrate ra hai cây khác nhau ⇒ hydration mismatch. Cờ này hoãn tới sau khi mount.
 *
 * ## Ảnh: tải lên TRƯỚC, chèn URL SAU
 *
 * Ba lối vào — nút, kéo-thả, dán — đều đi qua đúng một hàm `chenAnh`. Ảnh **không** bao giờ
 * nằm trong `body` dưới dạng `data:` URI: `POST /me/anh` lưu file rồi trả `/media/…`, và
 * chỉ chuỗi ấy mới được chèn. Ba lý do, mỗi lý do đủ để một mình quyết:
 * `lam_sach` ở server **gỡ mọi `img` có `src` ngoài `/media/`** (ảnh sẽ biến mất lúc lưu);
 * `data:` URI làm `body` phình vài MB cho một tấm ảnh; và nó đi vòng qua cả hạn mức
 * 30 ảnh/ngày lẫn lệnh dọn ảnh mồ côi.
 *
 * ## Nó KHÔNG phải hàng rào an toàn
 *
 * HTML gửi lên vẫn đi qua `lam_sach` ở server. Trình soạn thảo chỉ để người ta thấy trước
 * thứ mình sắp lưu — bỏ qua nó bằng một lệnh `curl` là chuyện năm giây.
 */
export function SoanThao({
  giaTri,
  datGiaTri,
  moi,
  testId,
}: {
  giaTri: string;
  datGiaTri: (html: string) => void;
  moi?: string;
  testId?: string;
}) {
  const [dangTaiAnh, datDangTaiAnh] = useState(false);
  const [loiAnh, datLoiAnh] = useState<string | null>(null);
  const oFileRef = useRef<HTMLInputElement>(null);
  /** Editor cho hai handler của `editorProps`.
   *
   * Chúng được khai TRONG lời gọi `useEditor`, tức lúc biến `editor` chưa tồn tại — nhưng
   * chúng chỉ CHẠY sau khi editor đã dựng xong. Ref là cách bắc cầu đúng: gán sau, đọc
   * lúc chạy. (Đừng moi qua `view.state.schema.cached` — đó là chi tiết nội bộ của
   * ProseMirror, không phải API, và nó `undefined` ở nhiều bản.) */
  const edRef = useRef<Editor | null>(null);

  /** Lối đi CHUNG của cả ba cách chèn ảnh (nút · kéo-thả · dán).
   *
   * Nhận `Editor` làm tham số thay vì đọc biến ngoài: hàm này bị gọi từ `editorProps`,
   * tức từ lúc `editor` còn đang được khởi tạo — đọc biến ngoài ở đó là `undefined`.
   */
  const chenAnh = async (ed: Editor, file: File) => {
    datLoiAnh(null);
    if (!file.type.startsWith("image/")) {
      datLoiAnh("Chỉ chèn được ảnh.");
      return;
    }
    datDangTaiAnh(true);
    try {
      const kq = await taiAnhNoiDung({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhiFile(),
        body: { file },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      ed.chain().focus().setImage({ src: kq.data.url, alt: file.name }).run();
    } catch {
      // Không phân biệt được 413/429/400 ở đây vì client sinh ra không ném theo mã; câu
      // chung phải nói ra CẢ HAI khả năng hay gặp thay vì một câu "lỗi" trống rỗng.
      datLoiAnh("Không tải được ảnh — có thể ảnh quá nặng, hoặc bạn đã hết lượt hôm nay.");
    } finally {
      datDangTaiAnh(false);
      if (oFileRef.current !== null) oFileRef.current.value = "";
    }
  };

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // Ngoài allowlist của server ⇒ tắt, để không ai gõ được thứ sẽ bị xoá lúc lưu.
        horizontalRule: false,
        codeBlock: false,
        heading: { levels: [2, 3] },
        link: false,
      }),
      // Ảnh CHỈ từ kho của site — `src` do `POST /me/anh` trả về. `allowBase64: false` là
      // vế bắt buộc: một `data:` URI khổng lồ nhét thẳng vào `body` sẽ qua mặt cả hạn mức
      // lẫn lệnh dọn ảnh mồ côi, và `lam_sach` ở server sẽ gỡ nó ⇒ ảnh "biến mất lúc lưu".
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
      // Kéo-thả và dán đi cùng một đường với cái nút. `return false` = "chưa xử lý, cứ
      // để ProseMirror làm việc của nó" — chỉ chặn khi ĐÚNG là có file ảnh, nếu không
      // thì dán chữ thường cũng bị nuốt.
      handleDrop: (_view, su_kien) => {
        const ds = (su_kien as DragEvent).dataTransfer?.files;
        const anh = ds ? [...ds].filter((f) => f.type.startsWith("image/")) : [];
        if (anh.length === 0) return false;
        su_kien.preventDefault();
        const ed1 = edRef.current;
        if (ed1 === null) return false;
        anh.forEach((f) => void chenAnh(ed1, f));
        return true;
      },
      handlePaste: (_view, su_kien) => {
        const ds = (su_kien as ClipboardEvent).clipboardData?.files;
        const anh = ds ? [...ds].filter((f) => f.type.startsWith("image/")) : [];
        if (anh.length === 0) return false;
        su_kien.preventDefault();
        const ed2 = edRef.current;
        if (ed2 === null) return false;
        anh.forEach((f) => void chenAnh(ed2, f));
        return true;
      },
      attributes: {
        class: css.vung,
        ...(testId === undefined ? {} : { "data-testid": testId }),
        ...(moi === undefined ? {} : { "data-placeholder": moi }),
      },
    },
  });

  edRef.current = editor;

  if (editor === null) {
    // Chỗ giữ CÙNG chiều cao với vùng soạn thật — `null` làm cả form nhảy một nhịp khi
    // editor mount xong.
    return <div className={css.khung} aria-busy="true" />;
  }

  const nut = (
    Hinh: LucideIcon,
    nhan: string,
    dang_bat: boolean,
    bam: () => void,
    test_id: string,
  ) => (
    <button
      type="button"
      className={dang_bat ? `${css.nut} ${css.dang_bat}` : css.nut}
      onMouseDown={(e) => e.preventDefault()} // giữ vùng chọn khi bấm
      onClick={bam}
      aria-pressed={dang_bat}
      aria-label={nhan}
      title={nhan}
      data-testid={test_id}
    >
      <Hinh size={15} strokeWidth={2} aria-hidden />
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
    <div className={css.khung}>
      <div className={css.thanh} role="toolbar" aria-label="Định dạng">
        {nut(Bold, "Đậm", editor.isActive("bold"), () => editor.chain().focus().toggleBold().run(), "soan-dam")}
        {nut(Italic, "Nghiêng", editor.isActive("italic"), () => editor.chain().focus().toggleItalic().run(), "soan-nghieng")}
        {nut(Strikethrough, "Gạch ngang", editor.isActive("strike"), () => editor.chain().focus().toggleStrike().run(), "soan-gach")}
        {nut(Code, "Mã", editor.isActive("code"), () => editor.chain().focus().toggleCode().run(), "soan-ma")}
        <span className={css.ngan} aria-hidden />
        {nut(Heading2, "Tiêu đề lớn", editor.isActive("heading", { level: 2 }), () => editor.chain().focus().toggleHeading({ level: 2 }).run(), "soan-h2")}
        {nut(Heading3, "Tiêu đề nhỏ", editor.isActive("heading", { level: 3 }), () => editor.chain().focus().toggleHeading({ level: 3 }).run(), "soan-h3")}
        <span className={css.ngan} aria-hidden />
        {nut(List, "Danh sách", editor.isActive("bulletList"), () => editor.chain().focus().toggleBulletList().run(), "soan-danh-sach")}
        {nut(ListOrdered, "Danh sách đánh số", editor.isActive("orderedList"), () => editor.chain().focus().toggleOrderedList().run(), "soan-danh-sach-so")}
        {nut(Quote, "Trích", editor.isActive("blockquote"), () => editor.chain().focus().toggleBlockquote().run(), "soan-trich")}
        {nut(Link2, "Liên kết", editor.isActive("link"), datLink, "soan-link")}
        {/* `<label>` bọc `<input type=file>` ẩn — input file gốc không đổi được hình dạng,
            còn label thì nhận đúng cú bấm lẫn bàn phím cho ô ẩn bên trong. */}
        <label
          className={css.nut}
          aria-disabled={dangTaiAnh}
          title="Chèn ảnh"
          data-testid="soan-anh"
        >
          <ImagePlus size={15} strokeWidth={2} aria-hidden />
          <span className={css.an}>Chèn ảnh</span>
          <input
            ref={oFileRef}
            type="file"
            accept="image/*"
            hidden
            disabled={dangTaiAnh}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void chenAnh(editor, f);
            }}
            data-testid="soan-anh-file"
          />
        </label>
        {dangTaiAnh && (
          <span className={css.dang_tai} role="status">
            Đang tải ảnh…
          </span>
        )}
      </div>
      {loiAnh !== null && (
        <p className={css.loi_anh} role="alert" data-testid="soan-anh-loi">
          {loiAnh}
        </p>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}
