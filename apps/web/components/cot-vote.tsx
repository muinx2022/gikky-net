import { diemCoDau } from "@/lib/dinh-dang";
import { LY_DO_TAT_VOTE } from "@/lib/vote";

import css from "./cot-vote.module.css";

/** Cột vote bên trái thẻ — bố cục Reddit (plan con 1d §2.5).
 *
 * **Mũi tên render nhưng `disabled`, và đó là một lựa chọn khác hẳn nút "Tham gia sub".**
 * PLAN mục 4 loại nút Tham gia khỏi v1 kèm câu "một cái nút vĩnh viễn không bấm được còn
 * tệ hơn không có nút" — vế *vĩnh viễn* mới là chỗ quyết định. Vote SẼ sống ở Phase 2
 * (PLAN 5.7), nên chỗ đứng của nó có thật; giấu nó đi rồi Phase 2 vẽ lại cả bố cục thẻ
 * mới là việc thừa.
 *
 * Cái phải tránh là "nút chết" — bài học `error.tsx` của 1c: nút phải NÓI ra vì sao nó
 * không bấm được, nếu không người dùng bấm mãi rồi nghĩ trang hỏng. Ở đây lý do đi bằng
 * ba đường cùng lúc: `disabled` (trình duyệt không cho bấm), `title` (hover thấy chữ), và
 * `aria-label` (trình đọc màn hình nghe được — `title` một mình thì không ai nghe thấy).
 *
 * `<div role="group">` chứ không phải `<button>` bọc ngoài: con số ở giữa không phải nút.
 */
export function CotVote({
  diem,
  nhan,
  cai_gi,
}: {
  diem: number;
  /** Tên thứ đang được vote — vào `aria-label` để trình đọc màn hình phân biệt được hai
   * chục cột vote giống hệt nhau trên một trang feed. */
  nhan: string;
  /** `"mach"` hay `"moc"` — chỉ để bài đo nhắm đúng cột, không đổi kiểu dáng. */
  cai_gi: "mach" | "moc";
}) {
  return (
    <div
      className={css.cot}
      role="group"
      aria-label={`Điểm của ${nhan}`}
      data-testid={`cot-vote-${cai_gi}`}
    >
      <MuiTen huong="len" nhan={nhan} />
      <span className={css.diem} data-testid="cot-vote-diem">
        {diemCoDau(diem)}
      </span>
      <MuiTen huong="xuong" nhan={nhan} />
    </div>
  );
}

function MuiTen({ huong, nhan }: { huong: "len" | "xuong"; nhan: string }) {
  const viec = huong === "len" ? "Vote lên" : "Vote xuống";
  return (
    <button
      type="button"
      className={css.mui_ten}
      disabled
      // `aria-disabled` **thêm vào** chứ không thay `disabled`: `disabled` thật là thứ
      // chặn cú bấm, `aria-disabled` là thứ một số trình đọc màn hình đọc thành "không
      // dùng được" thay vì bỏ qua phần tử.
      aria-disabled="true"
      title={LY_DO_TAT_VOTE}
      aria-label={`${viec} — ${LY_DO_TAT_VOTE} (${nhan})`}
      data-testid={`mui-ten-${huong}`}
    >
      {huong === "len" ? "▲" : "▼"}
    </button>
  );
}
