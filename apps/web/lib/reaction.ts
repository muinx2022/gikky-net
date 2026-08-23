/** Bộ reaction CỐ ĐỊNH của PLAN 5.7 — 📈📉🔥🧊🎯.
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
export const CAC_REACTION = ["len", "xuong", "lua", "bang", "trung"] as const;
export type KhoaReaction = (typeof CAC_REACTION)[number];

/** Glyph hiện trên nút. */
export const GLYPH_REACTION: Record<KhoaReaction, string> = {
  len: "📈",
  xuong: "📉",
  lua: "🔥",
  bang: "🧊",
  trung: "🎯",
};

/** Chữ cho `aria-label` — một cái nút chỉ có emoji thì trình đọc màn hình phát ra tên
 * unicode ("chart increasing"), không phát ra nghĩa mà sản phẩm gán cho nó. */
export const CHU_REACTION: Record<KhoaReaction, string> = {
  len: "lên",
  xuong: "xuống",
  lua: "lửa",
  bang: "băng",
  trung: "trúng",
};
