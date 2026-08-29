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
  "ro_rang",
  "co_nguon",
  "can_them",
  "lieu",
] as const;
export type KhoaReaction = (typeof CAC_REACTION)[number];

/** Glyph hiện trên nút. **Đổi được tự do** — khoá đặt theo khái niệm (`ro_rang`) chứ
 * không theo hình (`lua`), nên thay emoji ở đây không kéo theo migration nào. */
export const GLYPH_REACTION: Record<KhoaReaction, string> = {
  ro_rang: "🧠",
  co_nguon: "📎",
  can_them: "❓",
  lieu: "⚠️",
  hay_lam: "🔥",
};

/** Chữ **HIỆN TRÊN NÚT**, không chỉ trong `aria-label` *(2026-08-25)*.
 *
 * Trước lượt ấy chữ chỉ nằm trong `title`: hover mới thấy, và trên điện thoại thì **không
 * bao giờ**. Người dùng nhìn thấy năm cái emoji trần và không đoán được chúng làm gì — đó
 * chính là khiếu nại mở ra lượt sửa. Emoji một mình không phải một nhãn; nó là một hình
 * mà mỗi người đọc ra một nghĩa.
 *
 * ## Nhãn ĐỦ NGHĨA, không phải nhãn ngắn nhất *(user chốt 2026-08-27)*
 *
 * Bản 2026-08-25 cắt cụt cho vừa một hàng: `"Rõ"`, `"Cần thêm"`. Cắt tới mức ấy là trả lại
 * đúng bệnh vừa chữa — *"Rõ"* cái gì, *"Cần thêm"* cái gì? Một nhãn phải đứng một mình mà
 * hiểu được; hiểu được nhờ đọc thêm `title` thì trên điện thoại vẫn là không hiểu được.
 *
 * ⇒ Lấy **đúng chữ đã có sẵn ở `Reaction.Emoji` của Django** (bỏ glyph): "luận điểm rõ",
 * "có dẫn nguồn", "cần thêm dữ kiện". Hai bên vốn đã khai cùng khái niệm mà nói hai giọng
 * khác nhau; nay cùng một giọng, và người sửa sau không phải chọn tin bên nào.
 *
 * **`"Liều"` → `"Rủi ro"`** — user không dùng chữ "liều". Xem ghi chú lệch nghĩa ở
 * `MO_TA_REACTION.lieu` bên dưới; nó không chỉ là đổi một từ.
 *
 * Ràng buộc "giữ NGẮN cho vừa một hàng" **không còn là ràng buộc**: `.hang` trong
 * `hang-reaction.module.css` có `flex-wrap: wrap`, và chính docstring cuối file ấy đã chốt
 * *"hai dòng nút đọc được tốt hơn một dòng nút không hiểu được"*. Đo lại ở 375px sau lượt
 * này: 0px cuộn ngang. */
export const CHU_REACTION: Record<KhoaReaction, string> = {
  ro_rang: "Luận điểm rõ",
  co_nguon: "Có dẫn nguồn",
  can_them: "Cần thêm dữ kiện",
  lieu: "Rủi ro",
  hay_lam: "Hay lắm",
};

/** Câu đầy đủ cho `title` + `aria-label`. Nhãn trên nút nói *cái gì*, câu này nói *nghĩa
 * là gì* — và nó phải đúng cho **cả** nhật ký lệnh lẫn bài nhận định.
 *
 * ⚠ **`lieu` mang hai nghĩa dễ lẫn, và câu dưới đây cố ý nối cả hai.** Khái niệm gốc là
 * *nhận thức luận*: kết luận mạnh hơn dữ kiện đỡ nó. Nhưng đây là site giao dịch, nên chữ
 * "Rủi ro" trên nút sẽ bị phần lớn người đọc hiểu thành *rủi ro TÀI CHÍNH của lệnh này* —
 * một phán xét khác hẳn, và là phán xét bộ reaction cố ý KHÔNG làm (cả bốn nút nói về bài
 * viết, không nói về giá — xem docstring đầu file). Câu mô tả vì thế phải kéo người đọc về
 * đúng nghĩa ngay trong một dòng, thay vì để nhãn tự nói.
 *
 * Đây là đánh đổi đã báo cho user và user vẫn chọn "Rủi ro" (2026-08-27). Ghi ra để lượt
 * sau đừng "sửa cho gọn" thành *"Lệnh này rủi ro"* — đó mới là lúc nút đổi nghĩa thật. */
export const MO_TA_REACTION: Record<KhoaReaction, string> = {
  ro_rang: "Luận điểm rõ ràng, theo được mạch lập luận",
  co_nguon: "Có dẫn nguồn hoặc số liệu kiểm được",
  can_them: "Cần thêm dữ kiện mới đánh giá được",
  lieu: "Rủi ro cao: kết luận mạnh hơn dữ kiện đưa ra",
  hay_lam: "Bài hay, mong tác giả ghi tiếp",
};
