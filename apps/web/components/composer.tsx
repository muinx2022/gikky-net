"use client";

import { vietBinhLuan } from "@gikky/api-client";
import { PenLine } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./composer.module.css";
import { useMach } from "./mach-ngu-canh";
import { useModalDangNhap } from "./modal-dang-nhap";
import { SoanThao } from "./soan-thao";
import { usePhien } from "./phien";

/** Ô viết bình luận — khán đài, ngăn kéo, và "Trả lời" inline dùng CHUNG nó (PLAN 5.4).
 *
 * Ba chỗ một component vì luật neo khác nhau ở đúng một tham số, và ba bản sao sẽ lệch ở
 * đúng tham số ấy (PLAN nguyên tắc 4 và 6):
 *
 * - composer trong **ngăn kéo** tự neo mốc đó (`anchorMocSeq = seq`), **cố định**;
 * - composer ở **khán đài** neo mốc mới nhất, chip đổi/gỡ được — gỡ = `null`;
 * - **reply** không mang neo bao giờ: nó kế thừa neo của gốc, và gửi kèm là 400.
 *
 * ⚠ Câu thứ hai là **L05**, và tới 2026-08-23 nó là chữ nói quá: khán đài gọi
 * `<Composer />` không prop ⇒ mọi bình luận viết ở đó gửi `anchor_moc_seq: null` và
 * không vào ngăn kéo nào, trong khi chip là một `<span>` trơ không bấm được. Nay chip
 * đổi/gỡ thật (`neoDoiDuoc`), và `PLAN.md` mục 4 — vốn dùng đúng cơ chế *"gỡ chip →
 * `anchor = NULL`"* làm lý do bác một đề xuất khác — có một cơ chế có thật để viện dẫn.
 *
 * Sau khi gửi xong gọi `router.refresh()`: trang mạch là server component, nên nguồn sự
 * thật của cây bình luận vẫn là server. Chèn tay một nút vào DOM sẽ dựng một bản thứ hai
 * của cây — bản không có `path`, không có thứ hạng, không có `la_chu_mach`.
 */
export function Composer({
  parentId = null,
  anchorMocSeq = null,
  neoDoiDuoc = false,
  moi,
  nutGui = "Gửi",
  onXong,
  onHuy,
  tuDongLayNet = false,
  moSan = false,
}: {
  parentId?: number | null;
  anchorMocSeq?: number | null;
  /** Người viết được đổi/gỡ mốc neo — **chỉ** composer khán đài (PLAN 5.4 luật 3).
   *
   * Composer trong ngăn kéo để `false`: ngăn kéo LÀ mốc, một cái chip gỡ được ở đó nghĩa
   * là bình luận vừa viết trong ngăn kéo mốc 5 rơi ra khỏi mốc 5 — không có nghĩa nào. */
  neoDoiDuoc?: boolean;
  /** Câu mồi hiện trong ô khi chưa gõ gì (`question_for_crowd` — PLAN 5.4 luật 4). */
  moi?: string;
  nutGui?: string;
  onXong?: () => void;
  onHuy?: () => void;
  tuDongLayNet?: boolean;
  /** Bỏ qua "cửa" và vẽ thẳng ô gõ — **chỉ đường REPLY** (2026-08-26).
   *
   * Reply chỉ tồn tại sau khi người ta đã bấm "Trả lời", tức cú bấm mở cửa đã xảy ra
   * rồi. Bắt bấm lần thứ hai cho cùng một ý định là thêm ma sát mà không thêm thông tin
   * nào — và nó phá luôn `tuDongLayNet`, thứ khiến con trỏ nhảy thẳng vào ô. */
  moSan?: boolean;
}) {
  const { machId, khoa, cacMoc } = useMach();
  const { toi, dangTai } = usePhien();
  const { moModal } = useModalDangNhap();
  const router = useRouter();
  const [than, datThan] = useState("");
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);
  /** Neo do người viết chọn trong lượt này. `undefined` = chưa động vào ⇒ theo prop.
   *
   * Không khởi tạo bằng `anchorMocSeq`: `useState` chỉ đọc đối số ở lần render đầu, nên
   * một mốc mới nối vào giữa lượt xem (`router.refresh()` đổi prop) sẽ không tới được
   * chip. `undefined` phân biệt được "chưa chọn" với "đã chọn là không neo" (`null`) —
   * hai thứ mà một `number | null` gộp làm một. */
  const [neoTay, datNeoTay] = useState<number | null | undefined>(undefined);
  /** Công tắc trình soạn thảo — **mặc định TẮT** (user chốt 2026-08-26: *"bấm tùy chọn
   * thì mới hiện tiptap, còn không thì cứ để textarea như hiện tại"*).
   *
   * Mặc định tắt không phải để tiết kiệm: bình luận phần lớn là một hai câu, và một
   * thanh công cụ đậm phía trên ô gõ làm việc gõ một câu trông nặng hơn nó vốn có. Ai cần
   * đậm/nghiêng/link/ảnh thì bấm một cái.
   *
   * **Không nhớ lựa chọn qua các lần bình luận** (không `localStorage`). Cố ý: một ô soạn
   * tự mở ra ở dạng khác với lần trước, ở một trang khác, là một cú nhảy không ai xin.
   * Ngày nào muốn nhớ thì đó là một quyết định riêng — và chỗ nhớ phải là `/cai-dat`, nơi
   * người dùng thấy được mình đã bật cái gì.
   *
   * ⚠ Đổi công tắc **giữ nguyên `than`**: chuỗi markdown đang gõ dở sẽ hiện trong Tiptap
   * dưới dạng văn bản thuần (Tiptap parse HTML, và markdown không phải HTML nên nó vào
   * như một đoạn chữ). Không mất chữ — đó là điều kiện duy nhất bắt buộc ở đây. Dịch
   * markdown → HTML khi bật công tắc là dựng một bộ chuyển đổi thứ hai ở client, trong
   * khi `core/markdown_sang_html.py` đã có một bản ở server. */
  const [dungSoanThao, datDungSoanThao] = useState(false);
  /** Cửa đã mở chưa — user chốt 2026-08-26: *"không nên show form luôn, show 1 div báo
   * click vào đây để bình luận"*.
   *
   * Trang mạch có tới **10+ composer** cùng lúc (khán đài + mỗi ngăn kéo một cái), và
   * mỗi cái là một `<textarea>` cao 3 dòng cộng một hàng nút. Chúng chiếm chỗ, và không
   * cái nào trong số đó là thứ người đọc tới để đọc.
   *
   * State cục bộ, **không** nâng lên ngữ cảnh: hai cửa mở cùng lúc là chuyện bình thường
   * (viết vào khán đài, rồi mở ngăn kéo mốc 5). Một "chỉ-một-cửa-mở" ở đây sẽ xoá chữ
   * người ta đang gõ dở ở cửa kia. */
  const [moCua, datMoCua] = useState(false);

  // Chưa biết mình là ai thì chưa vẽ gì — cùng lý lẽ với `ThanhTaiKhoan`: chớp một lời
  // mời đăng nhập vào mặt người đang đăng nhập là một cú nhảy vô cớ.
  if (dangTai || machId === null) return null;

  const dangNhapRoi = toi?.dang_nhap ?? false;

  if (khoa) {
    // PLAN 5.10: mạch bị khoá thì đọc được, không tương tác. Nói ra thay vì hiện một ô
    // gõ được rồi trả 403 sau khi người ta viết xong.
    return (
      <p className={css.moi_dang_nhap} data-testid="composer-khoa">
        Mạch đã bị khoá — không bình luận thêm được.
      </p>
    );
  }

  // Neo THẬT sẽ đi theo request. Reply không mang neo bao giờ, nên nó bị ép `null` ở
  // đây chứ không ở chỗ dựng body — để cái chip trên màn hình và cái giá trị gửi đi
  // không bao giờ là hai con số khác nhau (đó chính là hình dạng của L05).
  const neo = parentId !== null ? null : (neoTay === undefined ? anchorMocSeq : neoTay);
  // Mốc chọn được, mới nhất trước — người ta gần như luôn neo vào cuối sổ.
  const moc_chon = [...cacMoc].sort((a, b) => b.seq - a.seq);

  const gui = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const chu = than.trim();
    if (dangGui || chu === "") return;
    datDangGui(true);
    datLoi(null);
    try {
      const kq = await vietBinhLuan({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        path: { mach_id: machId },
        body: {
          body: chu,
          // Nhãn đi CÙNG thân. Server không đoán bằng regex (người ta gõ `giá < 27.80`
          // suốt), và nó cũng không tin nhãn: nhánh `html` vẫn qua `lam_sach`.
          body_dinh_dang: dungSoanThao ? "html" : "markdown",
          parent_id: parentId,
          // Reply KHÔNG mang neo — gửi kèm là 400 (PLAN nguyên tắc 6). Phép ép ấy nằm
          // trong `neo`, một chỗ duy nhất, dùng chung với cái chip hiện trên màn hình.
          anchor_moc_seq: neo,
        },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      datThan("");
      // Đóng cửa lại sau khi gửi. Không giữ ô mở: câu vừa viết xuất hiện ngay trong cây
      // ở dưới, nên một ô trống nằm nguyên đó chỉ mời viết tiếp — mà "viết tiếp" gần như
      // luôn là reply vào chính câu ấy, không phải một thread gốc thứ hai.
      // `moSan` (reply) không đụng tới: chỗ đó `onXong` đã gỡ cả component.
      datMoCua(false);
      onXong?.();
      router.refresh();
    } catch {
      datLoi("Không gửi được. Thử lại sau ít giây.");
    } finally {
      datDangGui(false);
    }
  };

  // CỬA — trạng thái mặc định của mọi composer trừ reply. Một `<button>` trông như ô
  // nhập, chứ **không** phải một `<div onClick>`: nó nhận focus bằng Tab, kích hoạt bằng
  // Enter/Space, và trình đọc màn hình gọi đúng tên nó là một nút. Câu user viết là "1
  // div", nhưng thứ user mô tả là một cái bấm được — và cái bấm được thì có sẵn một thẻ.
  if (!moSan && !moCua) {
    return (
      <button
        type="button"
        className={css.cua}
        onClick={() => {
          // Đây là nhánh "nếu chưa đăng nhập thì show form đăng nhập" của user — và nó
          // là CÙNG cái modal mà nút ở header mở. Hai đường vào, một form.
          if (!dangNhapRoi) {
            moModal();
            return;
          }
          datMoCua(true);
        }}
        data-testid="composer-cua"
        data-khach={dangNhapRoi ? undefined : "1"}
      >
        {dangNhapRoi
          ? (moi ?? "Bấm vào đây để bình luận…")
          : "Bấm vào đây để bình luận — cần đăng nhập"}
      </button>
    );
  }

  return (
    <form className={css.khung} onSubmit={gui} data-testid="composer">
      {dungSoanThao ? (
        <SoanThao
          giaTri={than}
          datGiaTri={datThan}
          moi={moi ?? "Chém gió với chủ mạch…"}
          testId="composer-soan-thao"
        />
      ) : (
        <textarea
          className={css.o}
          value={than}
          onChange={(e) => datThan(e.target.value)}
          placeholder={moi ?? "Chém gió với chủ mạch…"}
          rows={3}
          autoFocus={tuDongLayNet || moCua}
          data-testid="composer-o"
        />
      )}
      {loi !== null && (
        <p className={css.loi} role="alert" data-testid="composer-loi">
          {loi}
        </p>
      )}
      <div className={css.chan}>
        {/* Công tắc đứng ĐẦU hàng chân, trước chip neo và nút gửi: nó đổi hình dạng của ô
            phía trên, nên nó thuộc về ô đó chứ không thuộc nhóm hành động. `aria-pressed`
            chứ không phải hai nút — đây là một công tắc hai trạng thái. */}
        <button
          type="button"
          className={dungSoanThao ? `${css.nhe} ${css.nhe_bat}` : css.nhe}
          onClick={() => datDungSoanThao((x) => !x)}
          aria-pressed={dungSoanThao}
          title={
            dungSoanThao
              ? "Tắt trình soạn thảo — quay về ô gõ thường"
              : "Bật trình soạn thảo — in đậm, nghiêng, link, ảnh"
          }
          data-testid="composer-cong-tac-soan-thao"
        >
          <PenLine size={13} strokeWidth={2} aria-hidden />
          {dungSoanThao ? "Ô gõ thường" : "Trình soạn thảo"}
        </button>
        {parentId === null &&
          (neoDoiDuoc ? (
            <NeoDoiDuoc
              neo={neo}
              cacMoc={moc_chon}
              onChon={(x) => datNeoTay(x)}
              tat={dangGui}
            />
          ) : (
            neo !== null && (
              <span className={css.chip} data-testid="composer-chip-neo">
                ‹mốc {neo}›
              </span>
            )
          ))}
        {onHuy !== undefined && (
          <button
            type="button"
            className={css.nhe}
            onClick={onHuy}
            data-testid="composer-huy"
          >
            Huỷ
          </button>
        )}
        <button
          type="submit"
          className={css.gui}
          disabled={dangGui || than.trim() === ""}
          data-testid="composer-gui"
        >
          {dangGui ? "Đang gửi…" : nutGui}
        </button>
      </div>
    </form>
  );
}

/** Chip neo **bấm được** — PLAN 5.4 luật 3, cài thật ở L05 (2026-08-23).
 *
 * Hai thao tác, và cả hai đều là một phần của lý lẽ ở `PLAN.md` mục 4:
 *
 * - **gỡ** (`×`) ⇒ `anchor_moc_seq = null`: bình luận về cả mạch, không về mốc nào. Đây
 *   là cơ chế mà mục 4 viện dẫn để bác đề xuất "bắt buộc chọn mốc";
 * - **đổi** ⇒ một `<select>` liệt kê mọi mốc của mạch.
 *
 * `<select>` chứ không phải một menu tự vẽ: nó đúng vai ngữ nghĩa, nó nghe được bằng
 * trình đọc màn hình mà không cần một dòng `aria-*` nào, và trên mobile nó mở bằng bánh
 * xe gốc của hệ điều hành — ba thứ mà một `<div role="listbox">` phải dựng lại bằng tay
 * và sẽ dựng thiếu.
 *
 * Trạng thái "không neo" là một `<option>` chứ không phải một ô trống: người ta phải
 * **đọc thấy** mình đang gửi vào đâu, kể cả khi câu trả lời là "không đâu cả".
 */
function NeoDoiDuoc({
  neo,
  cacMoc,
  onChon,
  tat,
}: {
  neo: number | null;
  cacMoc: readonly { seq: number }[];
  onChon: (x: number | null) => void;
  tat: boolean;
}) {
  // `useId` chứ không phải một chuỗi hằng: `<label for>` đòi id DUY NHẤT trong tài liệu,
  // và trang mạch có thể mọc composer khán đài thứ hai bất cứ lúc nào. Id trùng thì nhãn
  // trỏ vào ô đầu tiên — sai một cách chỉ trình đọc màn hình nhìn thấy.
  const id = useId();
  // Mạch chưa có mốc nào để neo (mạch 1 mốc chưa nạp, hoặc feed) ⇒ không vẽ cái chip
  // rỗng. Nguyên tắc 9: không phô một điều khiển không chọn được gì.
  if (cacMoc.length === 0) return null;
  return (
    <span className={css.neo} data-testid="composer-neo">
      <label className={css.neo_nhan} htmlFor={id}>
        Neo vào
      </label>
      <select
        id={id}
        className={css.neo_chon}
        value={neo === null ? "" : String(neo)}
        disabled={tat}
        onChange={(e) => onChon(e.target.value === "" ? null : Number(e.target.value))}
        data-testid="composer-chon-moc"
      >
        <option value="">cả mạch (không neo)</option>
        {cacMoc.map((m) => (
          <option key={m.seq} value={String(m.seq)}>
            mốc {m.seq}
          </option>
        ))}
      </select>
      {neo !== null && (
        <button
          type="button"
          className={css.neo_go}
          disabled={tat}
          onClick={() => onChon(null)}
          title="Gỡ neo — gửi vào cả mạch"
          aria-label={`Gỡ neo mốc ${neo} — gửi vào cả mạch`}
          data-testid="composer-go-neo"
        >
          ×
        </button>
      )}
    </span>
  );
}
