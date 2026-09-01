"use client";

import { useRouter } from "next/navigation";
import { useEffect, useTransition } from "react";

import css from "./error.module.css";

/** Lưới an toàn cuối cùng của mọi route dưới `app/` (vá A1, 2026-08-22).
 *
 * Trước đợt vá, `apps/web/app` **không có file này**: mọi `LoiApi` do `lib/api.ts` ném ra
 * — Django tắt, Django trả 500, một mã lỗi 1c chưa lường — thành trang trắng của Next,
 * không một chữ tiếng Việt nào cho người đang đứng trước màn hình.
 *
 * **Đừng đọc file này thành "chỗ nuốt lỗi".** Nó không sửa được gì; ca `?cursor=` rác đã
 * được xử tại nguồn ở `lib/api.ts` để trang trả **200**, còn ở đây thì phản hồi vẫn là
 * 500. Việc của nó chỉ là: nói ra bằng tiếng người, cho một đường thử lại, và ghi lỗi vào
 * console để dev còn lần được. `notFound()` KHÔNG đi qua đây (Next xử riêng), nên trang
 * không tồn tại vẫn là 404 thật.
 *
 * **Ba câu trên nay có số đo** (vá D4, 2026-08-22 — trước đó cả ba là lời khẳng định
 * trần, `grep trang-loi apps/web/e2e/` trả về rỗng):
 *
 * - *"phản hồi vẫn là 500"* — đo thật, Django tắt, `curl -i /` trên bản `next start`
 *   production: `HTTP/1.1 500 Internal Server Error`. Trang đẹp mà trả 200 mới là chỗ
 *   nuốt lỗi, và nó KHÔNG phải chuyện đang xảy ra ở đây;
 * - *"cho một đường thử lại"* — xem `thuLai` bên dưới. Bản `onClick={reset}` trần đã được
 *   đo là **nút chết**: bật lại Django rồi bấm, trang lỗi vẫn nguyên sau 20 giây;
 * - *"404 vẫn là 404 thật"* — `e2e/seo-va-trang.spec.ts` đã ghim (`/m/<id không tồn tại>`
 *   và `/s/<sub không tồn tại>` đều trả 404).
 *
 * Còn **thiếu**: chưa có bài đo tự động nào RENDER file này. Muốn có thì phải dựng một
 * `next start` thứ hai trỏ `API_ORIGIN` vào cổng chết — một cổng nữa và một entry
 * `webServer` nữa, vẫn nằm ngoài phạm vi các đợt vá 1c. Cái đang có là
 * `e2e/don-vi/trang-loi.spec.ts`: nó đọc mã nguồn và ghim "luôn còn ít nhất một đường
 * thoát không khoá được" (vá F2). Phép đọc mã, không phải phép bấm nút — đừng đọc nó
 * thành "trang lỗi đã được đo".
 */
export default function Loi({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();
  const [dangThu, batDauThu] = useTransition();

  useEffect(() => {
    // Bản production của Next chỉ gửi `digest` về client, không gửi message — `digest` là
    // thứ duy nhất nối được dòng này với stack trace trong log server.
    console.error("Trang hỏng:", error.digest ?? error.message);
  }, [error]);

  /** `router.refresh()` TRƯỚC, `reset()` sau, cả hai trong một transition (vá D4).
   *
   * `onClick={reset}` trần là một nút không đi đâu ở đúng lớp lỗi mà file này đỡ: `LoiApi`
   * ném ra từ **server component**, còn `reset()` chỉ dựng lại boundary phía client trên
   * payload RSC đã có sẵn — server không bị hỏi lại, nên Django sống lại rồi bấm vẫn ra
   * y nguyên trang lỗi. `router.refresh()` là thứ bắt server render lại.
   */
  const thuLai = () =>
    batDauThu(() => {
      router.refresh();
      reset();
    });

  return (
    <main className={css.khung} data-testid="trang-loi">
      <h1 className={css.tieu_de}>Trang này đang hỏng</h1>
      <p className={css.than}>
        Không tải được dữ liệu từ máy chủ. Thử lại sau ít phút — nội dung không mất đi
        đâu, mạch vẫn nằm nguyên trên máy chủ.
      </p>
      {error.digest !== undefined && (
        <p className={css.ma} data-testid="trang-loi-ma">
          Mã lỗi: <span className="mono">{error.digest}</span>
        </p>
      )}
      <button
        type="button"
        className={css.nut}
        onClick={thuLai}
        disabled={dangThu}
        data-testid="trang-loi-thu-lai"
      >
        {dangThu ? "Đang thử lại…" : "Thử lại"}
      </button>{" "}
      {/* Đường thoát THỨ HAI, và nó **không bao giờ `disabled`** (vá F2, 2026-08-22).
          `isPending` của `useTransition` chỉ hạ khi payload RSC về. Django chấp nhận TCP
          rồi không trả lời — deadlock pool, query treo, blackhole — là `dangThu` đứng
          `true` VĨNH VIỄN: nút trên khoá cứng, nhãn kẹt ở "Đang thử lại…", và trang lỗi
          hết đường thoát. Đúng loài "banner kẹt vĩnh viễn" mà `D:\Projects\CLAUDE.md`
          ghi lại từ 2026-08-04.
          `window.location` chứ không `router.refresh()` / `next/link`: cái đang treo là
          chính lời gọi RSC, nên phải bỏ hẳn tài liệu hiện tại.

          ⚠ **Đích là `/luat`, KHÔNG phải `location.reload()`** (nợ #14, 2026-08-22).
          `reload()` nạp lại ĐÚNG cái route vừa treo — nếu upstream còn treo thì nó treo
          tiếp, và "đường thoát" chỉ là một vòng lặp chậm hơn. `/luat` là route TĨNH
          (`app/luat/page.tsx` không gọi API nào, Next tiền dựng nó lúc build), nên nó lên
          được kể cả khi Django chết hẳn — thứ duy nhất trong repo này đúng như vậy, và
          `e2e/don-vi/trang-loi.spec.ts` ghim cả tính tĩnh đó. Nói cho đúng mức *(sửa
          2026-08-31)*: mọi lối đi TIẾP từ `/luat` (logo, footer) đều dẫn về route động —
          nó là chỗ đứng an toàn để đọc trong lúc chờ, không phải cửa vòng qua sự cố. */}
      <button
        type="button"
        className={css.nut}
        onClick={() => window.location.assign("/luat")}
        data-testid="trang-loi-ve-luat"
      >
        Sang trang Luật
      </button>
    </main>
  );
}
