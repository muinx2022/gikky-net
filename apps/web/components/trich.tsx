"use client";

import { goTrich, trichVaoSo } from "@gikky/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { cauLoi, layDuLieu } from "@/lib/ghi";
import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import { useMach } from "./mach-ngu-canh";
import { usePhien } from "./phien";
import css from "./trich.module.css";

/** Đường GHI của **"trích vào sổ"** — PLAN 5.6. Hai nút, một luật quyền.
 *
 * ## Chỉ CHỦ MẠCH, và đó là cả cơ chế
 *
 * Rào 4 của PLAN 5.6 bắt blockquote ghi rõ *"trích từ khán đài, **bởi chủ mạch**"* — nó là
 * phần thưởng mà chủ cuốn sổ trao đi, nên nó chỉ có nghĩa khi đúng một người trao được.
 * Server từ chối người khác bằng 403 `khong_phai_chu` (`api/mocs.py`); ở đây UI **không
 * vẽ nút** cho họ, vì một cái nút bấm để nhận 403 là dạy người dùng rằng sản phẩm hỏng.
 *
 * ## Bốn rào của PLAN 5.6, và cái nào thuộc về file này
 *
 * | rào | ở đâu |
 * |---|---|
 * | 1 — tối đa 1 trích đang hiệu lực mỗi **mốc** | partial unique ở DB + 409 `da_co_trich` |
 * | 2 — blockquote kèm **hai dấu thời gian** | `components/khoi-trich.tsx` |
 * | 3 — chỉ số hồ sơ đếm theo số tác giả khác nhau | `api/users.py` |
 * | 4 — render **tách bạch** khỏi thân mốc | `components/khoi-trich.tsx` + `the-moc.tsx` |
 *
 * File này không cài rào nào. Việc của nó là **không dựng một cửa đi vòng qua chúng**:
 * mọi thay đổi đều đi qua đúng hai endpoint, và sau mỗi lượt nó `router.refresh()` để thẻ
 * mốc được server dựng lại — chèn tay một blockquote vào DOM là dựng một khối trích không
 * có hai dấu thời gian, tức phá rào 2 bằng đường vòng.
 */

/** "Trích vào sổ" cho MỘT bình luận — hiện dưới mỗi bình luận, chỉ với chủ mạch.
 *
 * Chủ mạch phải chọn **trích vào mốc nào**: `POST /mocs/{id}/trich` nhận mốc ở URL, và
 * PLAN 5.6 rào 1 tính "một trích đang hiệu lực" theo MỐC. Mặc định là mốc mà bình luận
 * đang neo (`anchor_moc_seq`) vì đó gần như luôn là ý định; đổi được vì "gần như" không
 * phải "luôn", và bình luận gốc gỡ chip thì không neo vào đâu cả.
 *
 * Mốc **đã có trích** vẫn nằm trong danh sách nhưng kèm dấu — chọn nó sẽ ăn 409
 * `da_co_trich`, và câu của server nói thẳng "gỡ nó trước rồi trích câu khác". Bỏ hẳn nó
 * khỏi danh sách thì chủ mạch mất manh mối vì sao mốc 7 biến mất khỏi ô chọn.
 */
export function NutTrich({
  commentId,
  anchorMocSeq,
}: {
  commentId: number;
  /** Mốc bình luận đang neo, `null` khi không neo vào đâu (reply, hoặc gốc đã gỡ chip). */
  anchorMocSeq: number | null;
}) {
  const { chuMach, cacMoc } = useMach();
  const { toi } = usePhien();
  const router = useRouter();
  const [mo, datMo] = useState(false);
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  const mac_dinh =
    cacMoc.find((m) => m.seq === anchorMocSeq)?.id ?? cacMoc[0]?.id ?? null;
  const [mocId, datMocId] = useState<number | null>(mac_dinh);

  if (!(toi?.dang_nhap ?? false) || toi?.username !== chuMach) return null;
  if (cacMoc.length === 0) return null;

  const gui = async () => {
    if (dangGui || mocId === null) return;
    datDangGui(true);
    datLoi(null);
    try {
      layDuLieu(
        await trichVaoSo({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { moc_id: mocId },
          body: { comment_id: commentId },
        }),
        "Không trích được.",
      );
      datMo(false);
      router.refresh();
    } catch (e) {
      datLoi(cauLoi(e, "Không trích được. Kiểm tra kết nối rồi thử lại."));
    } finally {
      datDangGui(false);
    }
  };

  if (!mo) {
    return (
      <button
        type="button"
        className={css.nhe}
        onClick={() => {
          datMocId(mac_dinh);
          datMo(true);
        }}
        data-testid="nut-mo-trich"
      >
        Trích vào sổ
      </button>
    );
  }

  return (
    <span className={css.form} data-testid="form-trich">
      <label className={css.nhan}>
        Trích vào{" "}
        <select
          className={css.chon}
          value={mocId ?? ""}
          onChange={(e) => datMocId(Number(e.target.value))}
          data-testid="trich-chon-moc"
        >
          {cacMoc.map((m) => (
            <option key={m.id} value={m.id}>
              Mốc {m.seq}
              {m.coTrich ? " (đã có trích)" : ""}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className={css.chinh}
        onClick={() => void gui()}
        disabled={dangGui || mocId === null}
        data-testid="trich-gui"
      >
        {dangGui ? "Đang trích…" : "Trích"}
      </button>
      <button
        type="button"
        className={css.nhe}
        onClick={() => datMo(false)}
        data-testid="trich-huy"
      >
        Huỷ
      </button>
      {loi !== null && (
        <span className={css.loi} role="alert" data-testid="trich-loi">
          {loi}
        </span>
      )}
    </span>
  );
}

/** "Gỡ trích" — nằm trong chính khối trích trên thẻ mốc. Chỉ chủ mạch.
 *
 * Hạn 24 giờ là hạn THẬT, server giữ (409 `het_han_go_trich`). UI **không** tính lại nó:
 * `TrichOut` có `trich_created_at`, nên một phép cộng ở đây là dựng bản thứ hai của một
 * luật domain — đúng loài nợ `API-THIEU-MOC-THOI-GIAN` vừa được dọn ở chỗ khác. Nút vì thế
 * luôn hiện với chủ mạch, và quá hạn thì câu của server nói ra ("câu này đã ở lại trong
 * sổ"). Khác với nút "Mở lại sổ" — chỗ đó API **có** trả mốc hết hạn (`mo_lai_den`) nên
 * nút biến mất được.
 */
export function NutGoTrich({ mocId }: { mocId: number }) {
  const { chuMach } = useMach();
  const { toi } = usePhien();
  const router = useRouter();
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

  if (!(toi?.dang_nhap ?? false) || toi?.username !== chuMach) return null;

  const go = async () => {
    if (dangGui) return;
    if (
      !window.confirm(
        "Gỡ trích này khỏi sổ?\n\nChỉ gỡ được trong 24 giờ đầu kể từ lúc trích.",
      )
    ) {
      return;
    }
    datDangGui(true);
    datLoi(null);
    try {
      layDuLieu(
        await goTrich({
          baseUrl: GOC_TRINH_DUYET,
          headers: await headerGhi(),
          path: { moc_id: mocId },
        }),
        "Không gỡ được.",
      );
      router.refresh();
    } catch (e) {
      datLoi(cauLoi(e, "Không gỡ được. Kiểm tra kết nối rồi thử lại."));
    } finally {
      datDangGui(false);
    }
  };

  return (
    <>
      <button
        type="button"
        className={css.nhe}
        onClick={() => void go()}
        disabled={dangGui}
        data-testid="nut-go-trich"
      >
        {dangGui ? "Đang gỡ…" : "Gỡ trích"}
      </button>
      {loi !== null && (
        <span className={css.loi} role="alert" data-testid="go-trich-loi">
          {loi}
        </span>
      )}
    </>
  );
}
