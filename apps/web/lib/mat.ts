import type { MachChiTietOut, MocOut } from "@gikky/api-client";

/** Hai mặt BÃO / CẶN ở phía render — PLAN 5.5.
 *
 * **Luật thì server quyết** (`MachChiTietOut.face`, PLAN nguyên tắc 10); file này chỉ có
 * hai thứ frontend thật sự phải tự biết: cái toggle `?view=` mà PLAN giao cho URL, và câu
 * mồi của composer ở mặt BÃO.
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

/** Câu mồi của composer ở mặt BÃO — wireframe 9.2: `✎ [ Mốc 9 vừa đóng sổ — bạn rút ra gì? ]`
 *
 * "Theo trạng thái" nghĩa là: mạch đã đóng sổ hỏi một câu khác mạch đang chạy, và mốc có
 * `question_for_crowd` thì **câu của tác giả thắng** — người viết mốc biết rõ hơn cái
 * placeholder mặc định điều gì đáng hỏi (PLAN 5.4 luật 4 nói đúng chuyện đó ở ngăn kéo).
 */
export function cauMoiComposer(mocMoiNhat: MocOut | undefined, dong: boolean): string {
  if (mocMoiNhat === undefined) return "Chém gió với chủ mạch…";
  if (mocMoiNhat.question_for_crowd !== null) return mocMoiNhat.question_for_crowd;
  return dong
    ? `Mốc ${mocMoiNhat.seq} vừa đóng sổ — bạn rút ra gì?`
    : `Mốc ${mocMoiNhat.seq} vừa lên — bạn nghĩ sao?`;
}
