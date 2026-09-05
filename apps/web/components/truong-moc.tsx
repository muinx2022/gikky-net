"use client";

import { homNayVN } from "@/lib/vong-doi";

import { SoanThao } from "./soan-thao";
import css from "./truong-moc.module.css";

/** Bốn trường nội dung của một mốc — dùng chung cho **đăng bài**, **nối mốc** và **sửa mốc**.
 *
 * Ba form ấy nhập cùng một thứ (PLAN 5.1: "endpoint tạo mạch và nối mốc nhận **cùng một bộ
 * trường nội dung**", và 5.2 liệt kê đúng bộ trường sửa được). Ba bản sao sẽ lệch ở đúng
 * chỗ dễ quên nhất: `max` của ô ngày. Thiếu nó thì người dùng chọn được ngày mai, bấm gửi,
 * và nhận một lỗi 400 mà đáng ra trình duyệt đã chặn từ đầu.
 *
 * **`figures` — trường thứ NĂM, có mặt từ 2026-08-23** (nợ `FORM-FIGURES` đã trả). Dải
 * "GIÁ VÀO 27.80 · DỪNG LỖ 26.40" của PLAN 5.2: tối đa 6 cặp `label`/`value`, mỗi vế ≤24
 * ký tự. API nhận nó đầy đủ từ Phase 1; thiếu đúng chỗ nhập, nên hôm qua cách duy nhất
 * đặt được dải số là gọi API bằng tay.
 *
 * ⚠ **Ba giới hạn dưới đây là bản SAO của `core/models/moc.py`** (`SO_FIGURES_TOI_DA=6`,
 * `DAI_FIGURE_LABEL=24`, `DAI_FIGURE_VALUE=24`). Chúng không đi qua OpenAPI được:
 * `kiem_figures` là một validator của Django chứ không phải ràng buộc pydantic, nên
 * `FigureIn` ở TS chỉ có `{label: string; value: string}`. Bản sao ấy **có chuông** —
 * `e2e/don-vi/figures.spec.ts` đọc thẳng file Python và đòi ba con số khớp. Nới ở Django
 * mà quên đây ⇒ ĐỎ (và ngược lại: nới ở đây thì form cho gõ dài hơn thứ server nhận, tức
 * người dùng viết xong mới ăn 400).
 */

/** Bốn trường người dùng gõ. Không phải kiểu của API — `MocMoiIn`/`MocSuaIn` mới là hợp
 * đồng, và mỗi form tự dựng thân request từ đây (PLAN 8.3: không khai lại kiểu của API). */
export type NoiDungMoc = {
  body: string;
  occurred_at: string;
  loai: string;
  question_for_crowd: string;
  /** Dải số. Hàng **rỗng cả hai vế** là chuyện bình thường trong lúc gõ — `thanMoc` lọc
   * chúng đi. Giữ chúng trong state chứ không lọc ngay: xoá một hàng ngay khi người ta
   * vừa xoá ký tự cuối của nó là ô nhập biến mất dưới con trỏ. */
  figures: { label: string; value: string }[];
};

/** Giới hạn của `figures` — **bản sao có chuông** của `api/core/models/moc.py`.
 * Xem cảnh báo ở docstring đầu file trước khi đổi. */
export const SO_FIGURES_TOI_DA = 6;
export const DAI_FIGURE_LABEL = 24;
export const DAI_FIGURE_VALUE = 24;
/** Trần độ dài body mốc — 50.000 ký tự (nới từ 10.000 ký tự để đủ chỗ cho HTML rich text). */
export const DAI_BODY_MOC = 50_000;

/** Giá trị khởi tạo của một mốc MỚI: thân rỗng, ngày sự việc = hôm nay giờ VN (PLAN 5.2). */
export function mocRong(): NoiDungMoc {
  return {
    body: "",
    occurred_at: homNayVN(),
    loai: "",
    question_for_crowd: "",
    figures: [],
  };
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
      {/* `<div>` chứ không `<label>`: vùng soạn của Tiptap là `contenteditable`, và một
          `<label>` bọc nó sẽ nuốt cú bấm vào thanh công cụ rồi ném focus lung tung. Nhãn
          nối bằng `id`/`aria-labelledby` thay cho việc bọc. */}
      <div className={css.o}>
        <div className={css.hang_nhan}>
          <span className={css.nhan} id={`${tienTo}-nhan-than`}>
            {nhanThan}
          </span>
          {gia_tri.body.length > 0 && (
            <span
              className={`${css.dem_ky_tu} ${gia_tri.body.length > DAI_BODY_MOC ? css.qua_tai : ""}`}
            >
              {gia_tri.body.length.toLocaleString("vi-VN")}/{DAI_BODY_MOC.toLocaleString("vi-VN")} ký tự
            </span>
          )}
        </div>
        <SoanThao
          giaTri={gia_tri.body}
          datGiaTri={(html) => dat("body", html)}
          moi={goiYThan ?? "Vì sao vào lệnh? Ghi trước khi biết kết quả."}
          testId={`${tienTo}-body`}
        />
        <span className={css.goi_y}>
          Bôi đen chữ để định dạng, hoặc dùng thanh công cụ ở trên.
        </span>
      </div>

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
            placeholder="Tên ngắn cho loại mốc này"
            data-testid={`${tienTo}-loai`}
          />
        </label>
      </div>

      <TruongFigures gia_tri={gia_tri.figures} dat={(f) => dat("figures", f)} tienTo={tienTo} />

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
          placeholder="Câu bạn muốn hỏi người đọc"
          data-testid={`${tienTo}-cau-moi`}
        />
        {/* Câu này TRƯỚC ĐÂY là `placeholder` *(đổi 2026-08-24)*. Placeholder phải gợi ý
            **gõ gì vào ô**; nó thì mô tả **hành vi của hệ thống** — và nó biến mất ngay
            khi người ta gõ chữ đầu tiên, tức đúng lúc còn cần nhớ. Chuyển xuống `goi_y`
            giữ được thông tin mà không chiếm chỗ của lời hướng dẫn. */}
        <span className={css.goi_y}>
          Hiện dưới mốc khi chưa ai bình luận vào mốc này.
        </span>
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
  // Hàng nào còn trống MỘT trong hai vế thì bỏ hẳn: `kiem_figures` đòi cả `label` lẫn
  // `value` là chuỗi không rỗng, nên gửi một cặp nửa vời là 400 — và người dùng chỉ đơn
  // giản là chưa gõ xong hàng cuối. Danh sách rỗng gửi lên `null`, không phải `[]`: `null`
  // là "không có dải số" (đúng thứ `MocOut.figures: list | None` phân biệt), còn `[]` ở
  // đường PATCH nghĩa là "xoá sạch dải số đang có" — hai ý định khác nhau.
  const cap = m.figures
    .map((f) => ({ label: f.label.trim(), value: f.value.trim() }))
    .filter((f) => f.label !== "" && f.value !== "");
  return {
    body: m.body,
    occurred_at: gon(m.occurred_at),
    loai: gon(m.loai),
    question_for_crowd: gon(m.question_for_crowd),
    figures: cap.length === 0 ? null : cap,
  };
}

/** Trình soạn dải số — `figures`, trường thứ năm của PLAN 5.2.
 *
 * ## Vì sao là một danh sách cặp tự do, không phải các ô cố định
 *
 * PLAN mục 4 đã **loại** structured fields: không sub nào bị ép phải có ô "giá vào". Dải
 * số là "thuần hiển thị" — người viết tự đặt tên nhãn. Một bộ ô cố định ở đây là cài lại
 * đúng thứ mục 4 vừa bác.
 *
 * ## Nhãn cho từng ô, không phải một nhãn cho cả hàng
 *
 * Sáu hàng × hai ô = 12 ô nhập. Một `<label>` chung ở đầu bảng thì trình đọc màn hình đọc
 * ô thứ bảy thành "edit text" — không biết đang ở hàng nào, không biết là nhãn hay giá
 * trị. Mỗi ô mang `aria-label` riêng có số thứ tự.
 */
function TruongFigures({
  gia_tri,
  dat,
  tienTo,
}: {
  gia_tri: NoiDungMoc["figures"];
  dat: (f: NoiDungMoc["figures"]) => void;
  tienTo: string;
}) {
  const sua = (i: number, k: "label" | "value", v: string) =>
    dat(gia_tri.map((f, j) => (j === i ? { ...f, [k]: v } : f)));

  return (
    <fieldset className={css.figures} data-testid={`${tienTo}-figures`}>
      <legend className={css.nhan}>
        Dải số <span className={css.tuy_chon}>tuỳ chọn</span>
      </legend>
      {gia_tri.map((f, i) => (
        <div className={css.mot_fig} key={i}>
          <input
            className={css.fig_label}
            type="text"
            value={f.label}
            maxLength={DAI_FIGURE_LABEL}
            onChange={(e) => sua(i, "label", e.target.value)}
            placeholder="Tên chỉ số"
            aria-label={`Nhãn của cặp số thứ ${i + 1}`}
            data-testid={`${tienTo}-fig-label-${i}`}
          />
          <input
            className={`${css.fig_value} mono`}
            type="text"
            value={f.value}
            maxLength={DAI_FIGURE_VALUE}
            onChange={(e) => sua(i, "value", e.target.value)}
            placeholder="Giá trị"
            aria-label={`Giá trị của cặp số thứ ${i + 1}`}
            data-testid={`${tienTo}-fig-value-${i}`}
          />
          <button
            type="button"
            className={css.fig_xoa}
            onClick={() => dat(gia_tri.filter((_, j) => j !== i))}
            aria-label={`Xoá cặp số thứ ${i + 1}${f.label === "" ? "" : ` (${f.label})`}`}
            data-testid={`${tienTo}-fig-xoa-${i}`}
          >
            ×
          </button>
        </div>
      ))}
      {gia_tri.length < SO_FIGURES_TOI_DA ? (
        <button
          type="button"
          className={css.fig_them}
          onClick={() => dat([...gia_tri, { label: "", value: "" }])}
          data-testid={`${tienTo}-fig-them`}
        >
          ＋ thêm cặp số
        </button>
      ) : (
        // Nói ra vì sao cái nút biến mất. Một nút vắng mặt không lý do là người ta bấm
        // quanh chỗ đó rồi tưởng trang hỏng.
        <p className={css.goi_y} data-testid={`${tienTo}-fig-het-cho`}>
          Tối đa {SO_FIGURES_TOI_DA} cặp — xoá bớt một cặp nếu cần thêm.
        </p>
      )}
      <span className={css.goi_y}>
        Dải hiện dưới thân mốc: <span className="mono">GIÁ VÀO 27.80 · DỪNG LỖ 26.40</span>.
        Số mang dấu <span className="mono">+</span>/<span className="mono">−</span> sẽ được
        tô màu lãi/lỗ.
      </span>
    </fieldset>
  );
}
