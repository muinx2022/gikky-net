"use client";

import { datReaction } from "@gikky/api-client";
import { useState } from "react";

import {
  CAC_REACTION,
  CHU_REACTION,
  GLYPH_REACTION,
  type KhoaReaction,
} from "@/lib/reaction";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";
import { LY_DO_CHUA_DANG_NHAP, LY_DO_DANG_TAI, LY_DO_KHOA } from "@/lib/vote";

import css from "./hang-reaction.module.css";
import { useMach } from "./mach-ngu-canh";
import { usePhien } from "./phien";
import { useTrangThaiToi } from "./trang-thai-toi";

/** Hàng reaction dưới thẻ mốc — `📈 12 · 🔥 9` của wireframe 9.2.
 *
 * Nợ `REACTION-CHUA-CO-UI`, trả 2026-08-23. API (`POST /mocs/{id}/reactions`) và
 * `my_reactions` đã sống từ Phase 2; thứ chưa có là chỗ bấm. PLAN 5.7 gọi nó là *"bậc
 * thang tham gia rẻ hơn viết"* — không có nó thì bậc thang chỉ còn hai nấc, vote và viết.
 *
 * ## Một reaction mỗi người mỗi mốc — bấm lại là RÚT
 *
 * `UNIQUE (user, moc)` ở DB: đổi reaction là `UPDATE`, không phải thêm hàng. Bấm đúng cái
 * đang chọn gửi `emoji: null`, tức rút — cùng cách `CotVote` xử "bấm lại mũi tên đang
 * chọn". Hai cơ chế tương tác cạnh nhau mà cư xử khác nhau ở cùng một cú bấm là chỗ người
 * dùng học sai một lần rồi sai mãi.
 *
 * ## Lạc quan, và hoàn lại NGUYÊN TRẠNG khi server từ chối
 *
 * Cùng luật với `CotVote`, và cùng lý do đã viết ở đó: một con số client tự cộng mà server
 * không đồng ý là loài hỏng im lặng tệ nhất. Khác một điểm: server trả về **cả bảng đếm**
 * (`kq.data.dem`, đủ 5 khoá), nên sau mỗi lượt bấm ta thay bằng con số của server chứ
 * không giữ phép cộng của mình.
 *
 * ## Nút TẮT vẫn phải nói lý do, và nói ĐÚNG lý do
 *
 * Ba ca, đúng ba câu — cùng bộ hằng với cột vote (`lib/vote.ts`), kể cả `LY_DO_DANG_TAI`
 * của L15: trong nhịp `GET /me` chưa về, người đã đăng nhập không được bảo đi đăng nhập.
 */
export function HangReaction({
  mocId,
  dem,
}: {
  mocId: number;
  /** `MocOut.reactions` — đủ 5 khoá, kể cả khoá bằng 0. */
  dem: Record<string, number>;
}) {
  const { toi, dangTai } = usePhien();
  const { khoa } = useMach();
  const { reactionCua } = useTrangThaiToi();
  const [demTay, datDemTay] = useState<Record<string, number> | null>(null);
  /** `undefined` = chưa bấm gì trong lượt xem này ⇒ lấy từ `/me`. Cùng lớp "cú bấm của
   * người dùng luôn thắng" với `CotVote.phieuTay`, và cùng lý do: một response `/me` về
   * muộn không được nuốt mất cú bấm vừa xong. */
  const [chonTay, datChonTay] = useState<string | null | undefined>(undefined);
  const [dangGui, datDangGui] = useState(false);

  const so = demTay ?? dem;
  const dang_chon = chonTay === undefined ? reactionCua(mocId) : chonTay;
  const ly_do = khoa
    ? LY_DO_KHOA
    : dangTai
      ? LY_DO_DANG_TAI
      : toi?.dang_nhap !== true
        ? LY_DO_CHUA_DANG_NHAP
        : null;
  const tat = ly_do !== null || dangGui;

  const bam = async (khoa_moi: KhoaReaction) => {
    if (tat) return;
    const truoc = { so, chon: dang_chon };
    // Bấm đúng cái đang chọn = RÚT.
    const moi = dang_chon === khoa_moi ? null : khoa_moi;
    const lac_quan = { ...so };
    if (dang_chon !== null) lac_quan[dang_chon] = Math.max(0, (lac_quan[dang_chon] ?? 0) - 1);
    if (moi !== null) lac_quan[moi] = (lac_quan[moi] ?? 0) + 1;
    datDemTay(lac_quan);
    datChonTay(moi);
    datDangGui(true);
    try {
      const kq = await datReaction({
        baseUrl: GOC_TRINH_DUYET,
        headers: await headerGhi(),
        path: { moc_id: mocId },
        body: { emoji: moi },
      });
      if (kq.data === undefined) throw new Error("phản hồi rỗng");
      // Sự thật là bảng đếm của SERVER.
      datDemTay(kq.data.dem);
      datChonTay(kq.data.emoji);
    } catch {
      datDemTay(truoc.so);
      // Ghi thẳng giá trị chứ không `undefined`: `undefined` nghĩa "chưa bấm gì" ⇒ nó rơi
      // về `/me`, mà `/me` có thể chưa trả lời xong.
      datChonTay(truoc.chon);
    } finally {
      datDangGui(false);
    }
  };

  return (
    <div
      className={css.hang}
      role="group"
      aria-label="Reaction"
      data-testid={`hang-reaction-${mocId}`}
    >
      {CAC_REACTION.map((k) => {
        const n = so[k] ?? 0;
        const chon = dang_chon === k;
        const viec = chon ? `Rút reaction ${CHU_REACTION[k]}` : `React ${CHU_REACTION[k]}`;
        return (
          <button
            key={k}
            type="button"
            className={chon ? `${css.nut} ${css.chon}` : css.nut}
            disabled={tat}
            aria-disabled={tat ? "true" : undefined}
            aria-pressed={chon}
            title={ly_do ?? viec}
            aria-label={ly_do === null ? `${viec} (${n})` : `${viec} — ${ly_do}`}
            onClick={() => void bam(k)}
            data-testid={`reaction-${k}`}
          >
            <span aria-hidden>{GLYPH_REACTION[k]}</span>
            {/* Nguyên tắc 9 áp ở mức nút: khoá bằng 0 hiện **glyph không có số**, không
                hiện "📈 0". Cả năm nút vẫn có mặt — bộ này là CỐ ĐỊNH, và một nút xuất
                hiện/biến mất theo lượt bấm là hàng nút nhảy dưới tay người ta. */}
            {n > 0 && (
              <span className={css.so} data-testid={`reaction-so-${k}`}>
                {n}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
