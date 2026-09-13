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

/** Khoá `emoji` gửi lên `POST /mocs/{id}/reactions`, **đúng thứ tự bày ra**.
 *
 * `hay_lam` đứng ĐẦU *(user chốt 2026-08-27, đảo lại bản cùng ngày xếp nó cuối)*: nó là
 * nút rẻ nhất và dễ bấm nhất trong bộ, nên nó đứng ở chỗ mắt chạm trước. Bốn nút sau là
 * soi xét và cảnh báo — thứ người ta chọn khi đã đọc kỹ, không phải thứ chào đón.
 *
 * ⚠ Thứ tự này là **hợp đồng hai đầu**: `ban-sao-python.spec.ts` ghim nó khớp ĐÚNG thứ tự
 * khai trong `Reaction.Emoji` của Django. Đảo chỗ ở đây mà không đảo bên Django là ĐỎ, và
 * bên Django thì đảo chỗ sinh migration (`0022`). Đừng sắp lại mảng này "cho hợp mắt". */
export const CAC_REACTION = [
  "hay_lam",
  "lieu",
  "can_them",
] as const;
export type KhoaReaction = (typeof CAC_REACTION)[number];

/** Glyph hiện trên nút. **Đổi được tự do** — khoá đặt theo khái niệm (`can_them`) chứ
 * không theo hình, nên thay emoji ở đây không kéo theo migration nào. */
export const GLYPH_REACTION: Record<KhoaReaction, string> = {
  hay_lam: "🔥",
  lieu: "⚠️",
  can_them: "❓",
};

/** Chữ **HIỆN TRÊN NÚT**, không chỉ trong `aria-label`. */
export const CHU_REACTION: Record<KhoaReaction, string> = {
  hay_lam: "Hay lắm",
  lieu: "Rủi ro",
  can_them: "Cần thêm dữ kiện",
};

/** Câu đầy đủ cho `title` + `aria-label`. */
export const MO_TA_REACTION: Record<KhoaReaction, string> = {
  hay_lam: "Bài hay, mong tác giả ghi tiếp",
  lieu: "Rủi ro cao: kết luận mạnh hơn dữ kiện đưa ra",
  can_them: "Cần thêm dữ kiện mới đánh giá được",
};
