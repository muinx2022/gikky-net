"use client";

import { homNayVN } from "@/lib/vong-doi";

import css from "./truong-moc.module.css";

/** Bốn trường nội dung của một mốc — dùng chung cho **đăng bài**, **nối mốc** và **sửa mốc**.
 *
 * Ba form ấy nhập cùng một thứ (PLAN 5.1: "endpoint tạo mạch và nối mốc nhận **cùng một bộ
 * trường nội dung**", và 5.2 liệt kê đúng bộ trường sửa được). Ba bản sao sẽ lệch ở đúng
 * chỗ dễ quên nhất: `max` của ô ngày. Thiếu nó thì người dùng chọn được ngày mai, bấm gửi,
 * và nhận một lỗi 400 mà đáng ra trình duyệt đã chặn từ đầu.
 *
 * **`figures` KHÔNG có ở đây** — nợ có tên `FORM-FIGURES`. Dải số là trường thứ năm của
 * PLAN 5.2 và API nhận nó đầy đủ; UI của nó là một trình soạn danh sách ≤6 cặp, việc riêng.
 * Vì `PATCH /mocs/{id}` là PATCH THẬT (trường vắng = không đổi), form sửa ở đây **không**
 * xoá mất `figures` của một mốc đã có — đó là điều kiện để hoãn được mà không mất dữ liệu.
 */

/** Bốn trường người dùng gõ. Không phải kiểu của API — `MocMoiIn`/`MocSuaIn` mới là hợp
 * đồng, và mỗi form tự dựng thân request từ đây (PLAN 8.3: không khai lại kiểu của API). */
export type NoiDungMoc = {
  body: string;
  occurred_at: string;
  loai: string;
  question_for_crowd: string;
};

/** Giá trị khởi tạo của một mốc MỚI: thân rỗng, ngày sự việc = hôm nay giờ VN (PLAN 5.2). */
export function mocRong(): NoiDungMoc {
  return { body: "", occurred_at: homNayVN(), loai: "", question_for_crowd: "" };
}

export function TruongMoc({
  gia_tri,
  datGiaTri,
  tienTo,
  nhanThan = "Nội dung mốc",
  goiYThan,
}: {
  gia_tri: NoiDungMoc;
  datGiaTri: (moi: NoiDungMoc) => void;
  /** Tiền tố `data-testid` — ba form có thể cùng nằm trên một trang (nối mốc + sửa mốc). */
  tienTo: string;
  nhanThan?: string;
  goiYThan?: string;
}) {
  const dat = <K extends keyof NoiDungMoc>(k: K, v: NoiDungMoc[K]) =>
    datGiaTri({ ...gia_tri, [k]: v });
  const hom_nay = homNayVN();

  return (
    <>
      <label className={css.o}>
        <span className={css.nhan}>{nhanThan}</span>
        <textarea
          className={css.than}
          value={gia_tri.body}
          onChange={(e) => dat("body", e.target.value)}
          rows={8}
          maxLength={10000}
          required
          placeholder={goiYThan ?? "Vì sao vào lệnh? Ghi trước khi biết kết quả."}
          data-testid={`${tienTo}-body`}
        />
        <span className={css.goi_y}>
          Markdown dùng được: <code>**đậm**</code>, <code>`mã`</code>, danh sách, trích dẫn.
        </span>
      </label>

      <div className={css.hang}>
        <label className={css.o}>
          <span className={css.nhan}>Ngày sự việc</span>
          <input
            className={`${css.dong} mono`}
            type="date"
            value={gia_tri.occurred_at}
            max={hom_nay}
            onChange={(e) => dat("occurred_at", e.target.value)}
            required
            data-testid={`${tienTo}-occurred-at`}
          />
          {/* PLAN nguyên tắc 3: hai dấu thời gian, chỉ một cái sửa được. Nói ra ở đây vì
              ô này trông như "ngày đăng" nếu không giải thích — mà nhập lùi được chính là
              lý do nó tồn tại. */}
          <span className={css.goi_y}>
            Ngày việc xảy ra, nhập lùi thoải mái. Giờ ghi do máy chủ đóng dấu, không sửa được.
          </span>
        </label>

        <label className={css.o}>
          <span className={css.nhan}>
            Loại mốc <span className={css.tuy_chon}>tuỳ chọn</span>
          </span>
          <input
            className={css.dong}
            type="text"
            value={gia_tri.loai}
            maxLength={20}
            onChange={(e) => dat("loai", e.target.value)}
            placeholder="vào lệnh · nâng dừng lỗ · chốt 1/3"
            data-testid={`${tienTo}-loai`}
          />
        </label>
      </div>

      <label className={css.o}>
        <span className={css.nhan}>
          Câu hỏi cho đám đông <span className={css.tuy_chon}>tuỳ chọn</span>
        </span>
        <input
          className={css.dong}
          type="text"
          value={gia_tri.question_for_crowd}
          maxLength={200}
          onChange={(e) => dat("question_for_crowd", e.target.value)}
          placeholder="Hiện khi chưa ai bình luận vào mốc này."
          data-testid={`${tienTo}-cau-moi`}
        />
      </label>
    </>
  );
}

/** Bốn trường → phần thân request dùng chung của `POST /machs`, `POST /machs/{id}/mocs`
 * và `PATCH /mocs/{id}`.
 *
 * Ô trống của `loai` / `question_for_crowd` gửi lên là **`null`**, không phải `""`: PLAN 5.2
 * cho hai trường ấy nullable, và `""` là một giá trị KHÁC `null` — nó làm chip loại mốc
 * render thành một ô rỗng, và làm `question_for_crowd !== null` ở `TheMoc` bật một câu mồi
 * trắng. Ở đường PATCH thì `null` còn có nghĩa "xoá", đúng thứ người dùng vừa làm khi họ
 * xoá sạch ô.
 */
export function thanMoc(m: NoiDungMoc) {
  const gon = (s: string) => (s.trim() === "" ? null : s.trim());
  return {
    body: m.body,
    occurred_at: m.occurred_at,
    loai: gon(m.loai),
    question_for_crowd: gon(m.question_for_crowd),
  };
}
