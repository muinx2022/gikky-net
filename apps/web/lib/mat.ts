import type { MachChiTietOut } from "@gikky/api-client";

/** Hai mặt BÃO / CẶN ở phía render — PLAN 5.5.
 *
 * **Luật thì server quyết** (`MachChiTietOut.face`, PLAN nguyên tắc 10); file này chỉ giữ
 * thứ frontend thật sự phải tự biết: cái toggle `?view=` mà PLAN giao cho URL.
 *
 * ⚠ `cauMoiComposer` — câu mồi theo mốc mới nhất của composer mặt BÃO ("Mốc 9 vừa lên —
 * bạn nghĩ sao?") — **đã xoá 2026-08-26** cùng lượt tách bình luận chung khỏi bình luận
 * mốc. Ô nhập ở mặt BÃO nay là ô của CẢ BÀI, nên một câu mồi nói tên một mốc là mời viết
 * đúng thứ sẽ không hiện ra ở khu ấy. Nó không được giữ lại "phòng khi cần": một hàm chỉ
 * còn test của chính nó gọi là cái bẫy mà `doc_noi_dung.doc_duoc` đã dính một lần.
 */

export const MAT = ["bao", "can"] as const;
export type Mat = MachChiTietOut["face"];

/** `?view=bao|can` — toggle THỦ CÔNG theo **lượt xem**, PLAN 5.5.
 *
 * > Toggle thủ công theo *lượt xem* (`?view=bao|can`), **không lưu** lựa chọn (bài học
 * > phản biện: máy nhớ toggle → người nghiêm túc bật "thuần" một lần rồi vĩnh viễn không
 * > thấy bình luận).
 *
 * "Không lưu" là lý do nó sống trên URL chứ không trong cookie hay localStorage: URL chết
 * theo lượt xem, còn một cái cookie thì sống mãi và không ai nhớ mình đã bật nó. Giá trị
 * lạ quy về `null` (dùng `face` của server) thay vì ném — cùng lối `docSort`/`docKhoang`:
 * PLAN nguyên tắc 7 cấm đổi lựa chọn HỢP LỆ của người dùng, không cấm bỏ qua rác.
 */
export function docView(gia_tri: string | string[] | undefined): Mat | null {
  const v = Array.isArray(gia_tri) ? gia_tri[0] : gia_tri;
  return (MAT as readonly string[]).includes(v ?? "") ? (v as Mat) : null;
}

/** Mặt sẽ được RENDER: `?view=` thắng, không có thì lấy `face` server đã tính.
 *
 * ⚠ **Không nhận `face` của `GET /machs/{id}/me` vào đây.** Cửa ấy áp thêm vế 2 của PLAN
 * 5.5 ("user đã follow hoặc từng bình luận") và nó là dữ liệu per-user, mà bố cục trang là
 * thứ nằm trong HTML — HTML ấy có bản cache dùng chung (PLAN 8.4). Mặt per-viewer được
 * dùng ở chỗ khác và theo cách khác: một lời mời đổi mặt, do client vẽ sau khi trang đã
 * render (`components/loi-moi-doi-mat.tsx`).
 */
export function matDeRender(mach: MachChiTietOut, view: Mat | null): Mat {
  return view ?? mach.face;
}
