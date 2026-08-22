"use client";

import { vietBinhLuan } from "@gikky/api-client";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { GOC_TRINH_DUYET, headerGhi } from "@/lib/tai-khoan";

import css from "./composer.module.css";
import { useMach } from "./mach-ngu-canh";
import { usePhien } from "./phien";

/** Ô viết bình luận — khán đài, ngăn kéo, và "Trả lời" inline dùng CHUNG nó (PLAN 5.4).
 *
 * Ba chỗ một component vì luật neo khác nhau ở đúng một tham số, và ba bản sao sẽ lệch ở
 * đúng tham số ấy (PLAN nguyên tắc 4 và 6):
 *
 * - composer trong **ngăn kéo** tự neo mốc đó (`anchorMocSeq = seq`);
 * - composer ở **khán đài** neo mốc mới nhất, chip đổi/gỡ được — gỡ = `null`;
 * - **reply** không mang neo bao giờ: nó kế thừa neo của gốc, và gửi kèm là 400.
 *
 * Sau khi gửi xong gọi `router.refresh()`: trang mạch là server component, nên nguồn sự
 * thật của cây bình luận vẫn là server. Chèn tay một nút vào DOM sẽ dựng một bản thứ hai
 * của cây — bản không có `path`, không có thứ hạng, không có `la_chu_mach`.
 */
export function Composer({
  parentId = null,
  anchorMocSeq = null,
  moi,
  nutGui = "Gửi",
  onXong,
  onHuy,
  tuDongLayNet = false,
}: {
  parentId?: number | null;
  anchorMocSeq?: number | null;
  /** Câu mồi hiện trong ô khi chưa gõ gì (`question_for_crowd` — PLAN 5.4 luật 4). */
  moi?: string;
  nutGui?: string;
  onXong?: () => void;
  onHuy?: () => void;
  tuDongLayNet?: boolean;
}) {
  const { machId, khoa } = useMach();
  const { toi, dangTai } = usePhien();
  const router = useRouter();
  const [than, datThan] = useState("");
  const [dangGui, datDangGui] = useState(false);
  const [loi, datLoi] = useState<string | null>(null);

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
          // Reply KHÔNG mang neo — gửi kèm là 400 (PLAN nguyên tắc 6).
          anchor_moc_seq: parentId === null ? anchorMocSeq : null,
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
        {anchorMocSeq !== null && parentId === null && (
          <span className={css.chip} data-testid="composer-chip-neo">
            ‹mốc {anchorMocSeq}›
          </span>
        )}
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
