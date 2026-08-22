"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

import css from "./ngan-keo.module.css";

/** Ngăn kéo — PLAN 5.4, bốn luật. Ba luật quyết định file này:
 *
 * 1. **Accordion**: mở ngăn kéo mốc khác thì cái đang mở gập lại. Đó là lý do trạng thái
 *    nằm ở MỘT context dùng chung cho cả timeline, không phải `useState` trong từng thẻ
 *    mốc — mỗi thẻ tự giữ trạng thái thì bốn ngăn kéo mở cùng lúc và luật 1 chỉ còn là
 *    lời hứa trong plan.
 * 2. Sort trong ngăn kéo **cũ → mới, không cho chỉnh** — nó là cửa sổ, không phải phòng.
 *    Không có nút sort nào ở đây, và server đã sắp sẵn (`GET /mocs/{id}/comments`).
 * 4. Mốc 0 bình luận **không hiện `💬 0`** mà hiện lời mời + `question_for_crowd` nếu có
 *    (cũng là nguyên tắc 9 — không phô sự im lặng).
 *
 * Luật 3 (composer tự neo mốc) thuộc Phase 2: 1c chưa có thao tác ghi nào hoạt động.
 */

type Ctx = {
  dangMo: number | null;
  doiMo: (seq: number) => void;
};

const NganKeoCtx = createContext<Ctx | null>(null);

function useNganKeo(): Ctx {
  const c = useContext(NganKeoCtx);
  if (c === null) {
    throw new Error(
      "Thiếu <NganKeoProvider> bọc ngoài — accordion không có chỗ giữ trạng thái.",
    );
  }
  return c;
}

export function NganKeoProvider({ children }: { children: ReactNode }) {
  const [dangMo, datDangMo] = useState<number | null>(null);
  return (
    <NganKeoCtx.Provider
      value={{ dangMo, doiMo: (seq) => datDangMo((cu) => (cu === seq ? null : seq)) }}
    >
      {children}
    </NganKeoCtx.Provider>
  );
}

/** Cái nút `💬 N` (hoặc lời mời) ở chân thẻ mốc.
 *
 * **Ba trạng thái, không phải hai** (vá B1, 2026-08-22):
 *
 * | lát cắt | `so_binh_luan` | nút nói gì |
 * |---|---|---|
 * | rỗng hẳn | 0 | `＋ nói gì đó về mốc này` — PLAN 5.4 luật 4 |
 * | chỉ còn bia mộ | 0 | `💬 bình luận về mốc này` — có thứ để mở, nhưng KHÔNG có số |
 * | có bình luận đọc được | > 0 | `💬 N bình luận` (nguyên tắc 9 tắt N khi mạch < 4) |
 *
 * Hàng giữa là hàng bị bỏ quên: `so_binh_luan` đếm bình luận đọc được, ngăn kéo thì vẫn
 * trả bia mộ (PLAN 5.3 — bia mộ ở lại để nhánh con và khối trích còn đầu kia). Hỏi con
 * số thay vì hỏi lát cắt là mời người ta viết vào một mốc đang có sẵn nội dung, rồi mở
 * ra "Chưa ai neo bình luận vào mốc này" bên dưới đúng blockquote trích từ đó.
 *
 * Ở hàng giữa cũng **không được** hiện `💬 0`: nguyên tắc 9 cấm phô sự im lặng, và 0 là
 * con số đúng của "bình luận đọc được".
 */
export function NutNganKeo({
  seq,
  soBinhLuan,
  coHang,
  hienSoDem,
}: {
  seq: number;
  soBinhLuan: number;
  /** Lát cắt có HÀNG nào không — kể cả bia mộ. */
  coHang: boolean;
  /** Nguyên tắc 9 — mạch dưới 4 bình luận thì ẩn mọi số đếm. */
  hienSoDem: boolean;
}) {
  const { dangMo, doiMo } = useNganKeo();
  const mo = dangMo === seq;

  return (
    <button
      type="button"
      className={coHang ? css.nut : `${css.nut} ${css.moi}`}
      aria-expanded={mo}
      aria-controls={`ngan-keo-${seq}`}
      onClick={() => doiMo(seq)}
      data-testid={`nut-ngan-keo-${seq}`}
    >
      {coHang ? (
        soBinhLuan > 0 && hienSoDem ? (
          <>
            💬{" "}
            <span className={css.dem} data-testid="so-binh-luan-moc">
              {soBinhLuan}
            </span>{" "}
            bình luận
          </>
        ) : (
          <>💬 bình luận về mốc này</>
        )
      ) : (
        <>＋ nói gì đó về mốc này</>
      )}
    </button>
  );
}

/** Khoang chứa lát cắt bình luận. Nội dung do server render sẵn và truyền vào
 * `children`; client chỉ bật/tắt. Nhờ vậy cả mạch nằm trong HTML đầu tiên — mặt CẶN là
 * mặt để Google index (PLAN mục 1), giấu nội dung sau một lời gọi fetch là tự bịt mắt
 * con bot. */
export function KhungNganKeo({ seq, children }: { seq: number; children: ReactNode }) {
  const { dangMo } = useNganKeo();
  return (
    <div
      id={`ngan-keo-${seq}`}
      className={css.khung}
      hidden={dangMo !== seq}
      data-testid={`ngan-keo-${seq}`}
    >
      <p className={css.tieu_de}>Lát cắt bình luận neo vào mốc {seq} · cũ → mới</p>
      {children}
    </div>
  );
}
