import type { Metadata } from "next";
import Link from "next/link";

import css from "./error.module.css";

/** Trang 404 thật — Phase 6 (PLAN mục 10: *"trang 404/500"*).
 *
 * Trước đợt này repo **không có file này**, nên mọi `notFound()` — `/m/<id không tồn
 * tại>`, `/s/<sub lạ>`, `/u/<ai đó>`, và mọi URL gõ sai — rơi vào trang mặc định của
 * Next: một dòng `404 · This page could not be found` bằng tiếng Anh, font hệ thống,
 * không một đường dẫn nào đi tiếp. Với một site tiếng Việt sống bằng traffic từ Google
 * (PLAN mục 1) thì đó vừa là chỗ rò người đọc, vừa là chỗ rò uy tín.
 *
 * **404 ở đây là câu trả lời ĐÚNG, không phải một sự cố.** Ba đường 404 hiện có đều là
 * chủ đích: mạch không tồn tại, sub không tồn tại, hồ sơ không tồn tại. Vì thế lời văn
 * không xin lỗi và không nói "đang hỏng" như `error.tsx` — nói thế là dạy người đọc rằng
 * site chập chờn, trong khi máy chủ vừa trả lời rất chính xác.
 *
 * ## Đường thoát (nợ #14)
 *
 * Hai link, và **cả hai đều là `next/link`** — khác hẳn hai trang lỗi cạnh đây, nơi
 * đường thoát bắt buộc phải là `window.location.assign("/luat")` trên một `<button>`.
 * Lý do khác nhau chứ không phải tiêu chuẩn kép:
 *
 * - `error.tsx` chỉ hiện khi **một lời gọi RSC đã hỏng hoặc đang treo**; điều hướng phía
 *   client đi qua đúng cái cây router đang chờ, nên nó có thể không đi đâu cả;
 * - trang này hiện khi máy chủ đã trả lời xong xuôi bằng một mã 404. Router sống, Django
 *   sống. `next/link` ở đây là đúng, và nó còn prefetch sẵn.
 *
 * Nhưng **`/luat` vẫn phải có mặt** trong hai link đó, và `e2e/don-vi/trang-loi.spec.ts`
 * ghim điều ấy: `/luat` là route duy nhất trong repo không gọi API nào, nên nó là đường
 * ra dùng được kể cả trong ca xấu nhất — 404 vì Django vừa trả 404 cho một mạch có thật
 * đang lỗi. Trang chủ thì không: nó gọi `docFeed` + `docCacSub`.
 */
export const metadata: Metadata = {
  title: "Không có trang này",
  // 404 lọt vào index là một URL rác trong kết quả tìm kiếm. Mã 404 đã đủ với Google,
  // nhưng `noindex` chặn cả những cửa đọc HTML mà không đọc mã trạng thái.
  robots: { index: false, follow: true },
};

export default function KhongThay() {
  return (
    <main className={css.khung} data-testid="trang-404">
      <h1 className={css.tieu_de}>Không có trang này</h1>
      <p className={css.than}>
        Địa chỉ này không trỏ tới mạch, chuyên mục hay hồ sơ nào. Có thể link bị gõ thiếu
        một đoạn, hoặc mạch đã được tác giả gỡ xuống — nội dung trên gikky không bao giờ
        đổi địa chỉ vì đổi tiêu đề, nên một link cũ đúng thì vẫn luôn mở được.
      </p>
      <div className={css.hang}>
        <Link className={css.lien_ket} href="/" data-testid="trang-404-ve-trang-chu">
          Về trang chủ
        </Link>
        <Link className={css.lien_ket} href="/luat" data-testid="trang-404-ve-luat">
          Sang trang Luật
        </Link>
      </div>
    </main>
  );
}
