"use client";

import { vietBinhLuan } from "@gikky/api-client";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./composer.module.css";
import { useMach } from "./mach-ngu-canh";
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
}) {
  const { machId, khoa, cacMoc } = useMach();
  const { toi, dangTai } = usePhien();
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

  // Chưa biết mình là ai thì chưa vẽ gì — cùng lý lẽ với `ThanhTaiKhoan`: chớp một lời
  // mời đăng nhập vào mặt người đang đăng nhập là một cú nhảy vô cớ.
  if (dangTai || machId === null) return null;

  if (!(toi?.dang_nhap ?? false)) {
    return (
      <p className={css.moi_dang_nhap} data-testid="composer-khach">
        <a href="/dang-nhap">Đăng nhập</a> để tham gia bàn luận.
      </p>
    );
  }

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
          parent_id: parentId,
          // Reply KHÔNG mang neo — gửi kèm là 400 (PLAN nguyên tắc 6). Phép ép ấy nằm
          // trong `neo`, một chỗ duy nhất, dùng chung với cái chip hiện trên màn hình.
          anchor_moc_seq: neo,
        },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      datThan("");
      onXong?.();
      router.refresh();
    } catch {
      datLoi("Không gửi được. Thử lại sau ít giây.");
    } finally {
      datDangGui(false);
    }
  };

  return (
    <form className={css.khung} onSubmit={gui} data-testid="composer">
      <textarea
        className={css.o}
        value={than}
        onChange={(e) => datThan(e.target.value)}
        placeholder={moi ?? "Chém gió với chủ mạch…"}
        rows={3}
        autoFocus={tuDongLayNet}
        data-testid="composer-o"
      />
      {loi !== null && (
        <p className={css.loi} role="alert" data-testid="composer-loi">
          {loi}
        </p>
      )}
      <div className={css.chan}>
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
