/** Bộ reaction — **phản hồi về BÀI VIẾT** (user chốt 2026-08-25, thay bộ 📈📉🔥🧊🎯).
 *
 * Lý do đổi ở `api/core/models/tuong_tac.py::Reaction`. Vế quan trọng nhất với frontend:
 * **cả bốn phải chạy được trên BÀI NHẬN ĐỊNH**, không chỉ trên nhật ký lệnh. Bộ cũ giả
 * định mọi mốc là một vị thế có hướng; một nửa nội dung site không phải vậy.
 *
 * ## Đây KHÔNG phải một type của API bị khai lại (PLAN 8.3)
 *
 * `ReactionIn.emoji` ở OpenAPI là `string | null`, không phải enum — nên client sinh ra
 * không mang theo bộ khoá, và không có gì để `import`. Thứ nằm dưới đây là ánh xạ
 * **`khoá → glyph + chữ tiếng Việt`**, tức đúng phần mà OpenAPI không mang: cùng loại với
 * `apps/admin/components/dung-mo-ta.ts`, cùng lý do được phép tồn tại.
 *
 * ## Vì sao API không khai enum, và cái giá của nó
 *
 * Đổi `emoji: str` thành một `Literal` ở Django sẽ đẩy bộ khoá vào OpenAPI và xoá hẳn file
 * này — đó là lối đúng theo luật "type một chiều". Nó **không** được làm trong lượt giao
 * diện, vì nó đổi hợp đồng LỖI của một endpoint đang chạy: hôm nay `{"emoji": "cuoi"}` trả
 * **400 `du_lieu_khong_hop_le`** (`core.ghi.dat_reaction` ném `ValidationError`), còn
 * pydantic sẽ chặn sớm hơn và trả mã khác — `tests/test_api_vote_reaction.py:289` ghim
 * đúng mã ấy. Đổi hợp đồng lỗi là một mục việc riêng, không phải một dòng thêm vào cuối
 * một lượt giao diện.
 *
 * ⇒ Cái giá: bộ khoá có **hai bản**, một ở `core/models/tuong_tac.py::Reaction.Emoji` và
 * một ở đây. Bản sao ấy **có chuông**: `e2e/don-vi/reaction.spec.ts` đọc thẳng file Python
 * và đòi hai danh sách khớp nhau, đủ và đúng thứ tự. Thêm emoji thứ sáu ở Django mà quên
 * đây ⇒ ĐỎ.
 */

/** Khoá `emoji` gửi lên `POST /mocs/{id}/reactions`, **đúng thứ tự bày ra**. */
export const CAC_REACTION = ["ro_rang", "co_nguon", "can_them", "lieu"] as const;
export type KhoaReaction = (typeof CAC_REACTION)[number];

/** Glyph hiện trên nút. **Đổi được tự do** — khoá đặt theo khái niệm (`ro_rang`) chứ
 * không theo hình (`lua`), nên thay emoji ở đây không kéo theo migration nào. */
export const GLYPH_REACTION: Record<KhoaReaction, string> = {
  ro_rang: "🧠",
  co_nguon: "📎",
  can_them: "❓",
  lieu: "🔥",
};

/** Chữ **HIỆN TRÊN NÚT**, không chỉ trong `aria-label` *(2026-08-25)*.
 *
 * Trước lượt này chữ chỉ nằm trong `title`: hover mới thấy, và trên điện thoại thì **không
 * bao giờ**. Người dùng nhìn thấy năm cái emoji trần và không đoán được chúng làm gì — đó
 * chính là khiếu nại mở ra lượt sửa này. Emoji một mình không phải một nhãn; nó là một
 * hình mà mỗi người đọc ra một nghĩa.
 *
 * Giữ NGẮN: bốn nút phải nằm vừa một hàng trên màn hình 375px cùng với nút "..." và cụm
 * công cụ mod. Câu đầy đủ đi vào `MO_TA_REACTION`. */
export const CHU_REACTION: Record<KhoaReaction, string> = {
  ro_rang: "Rõ",
  co_nguon: "Có nguồn",
  can_them: "Cần thêm",
  lieu: "Liều",
};

/** Câu đầy đủ cho `title` + `aria-label`. Nhãn ngắn trên nút nói *cái gì*, câu này nói
 * *nghĩa là gì* — và nó phải đúng cho **cả** nhật ký lệnh lẫn bài nhận định. */
export const MO_TA_REACTION: Record<KhoaReaction, string> = {
  ro_rang: "Luận điểm rõ ràng, theo được mạch lập luận",
  co_nguon: "Có dẫn nguồn hoặc số liệu kiểm được",
  can_them: "Cần thêm dữ kiện mới đánh giá được",
  lieu: "Kết luận mạnh so với dữ kiện đưa ra",
};
