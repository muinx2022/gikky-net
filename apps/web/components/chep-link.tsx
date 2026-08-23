"use client";

import { useEffect, useRef, useState } from "react";

import css from "./chep-link.module.css";

/** "Chép link" trên thanh thao tác của thẻ feed — thao tác thứ hai mà Reddit đặt ở đó.
 *
 * **Nó KHÔNG cần endpoint nào**, và đó là lý do nó được phép có mặt trong lượt này:
 * ranh giới của plan là *"không nút nào chưa có endpoint"* (không "Lưu bài", không
 * "Award", không "Chat"), còn đây là một thao tác chạy trọn trong trình duyệt.
 *
 * ## URL dựng ở CLIENT, không nhận qua prop tuyệt đối
 *
 * Thẻ mạch render ở server, và server không biết mình đang được xem qua origin nào (dev
 * `localhost:3000`, prod `gikky.net`, một bản xem trước). Dựng URL tuyệt đối ở server đòi
 * `SITE_ORIGIN` phải đúng ở mọi môi trường; dựng nó từ `location.origin` ở đây thì nó
 * đúng theo định nghĩa. Prop chỉ mang đường dẫn TƯƠNG ĐỐI.
 *
 * ## Hai đường chép, và vì sao cần đường thứ hai
 *
 * `navigator.clipboard` chỉ tồn tại trên secure context (HTTPS hoặc `localhost`). Mở
 * trang bằng IP trong mạng LAN để thử trên điện thoại là `undefined`, và một nút ném
 * `TypeError` rồi không làm gì là đúng loài nút chết. Đường lùi là `execCommand("copy")`
 * trên một `<textarea>` tạm — cũ, đã deprecated, và vẫn là thứ chạy được ở đúng ca ấy.
 */
export function ChepLink({
  duongDan,
  nhan,
}: {
  /** Đường dẫn tương đối, vd `/m/nhat-ky-lenh-hpg-12`. */
  duongDan: string;
  /** Tên mạch — vào `aria-label` để phân biệt hai chục nút giống hệt nhau trên một feed. */
  nhan: string;
}) {
  const [xong, datXong] = useState<"chua" | "roi" | "hong">("chua");
  const dong_ho = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Dọn timer khi thẻ bị gỡ khỏi DOM (cuộn feed, đổi tab): `setState` trên một component
  // đã unmount là một cảnh báo trong console và một rò rỉ nhỏ, nhân với số thẻ trên trang.
  useEffect(() => () => {
    if (dong_ho.current !== null) clearTimeout(dong_ho.current);
  }, []);

  const bao = (kq: "roi" | "hong") => {
    datXong(kq);
    if (dong_ho.current !== null) clearTimeout(dong_ho.current);
    dong_ho.current = setTimeout(() => datXong("chua"), 1800);
  };

  const chep = async () => {
    const url = `${window.location.origin}${duongDan}`;
    try {
      if (navigator.clipboard !== undefined) {
        await navigator.clipboard.writeText(url);
        bao("roi");
        return;
      }
    } catch {
      // Rơi xuống đường lùi — người dùng từ chối quyền, hoặc trình duyệt chặn.
    }
    try {
      const o = document.createElement("textarea");
      o.value = url;
      o.setAttribute("readonly", "");
      o.style.position = "fixed";
      o.style.opacity = "0";
      document.body.appendChild(o);
      o.select();
      const ok = document.execCommand("copy");
      document.body.removeChild(o);
      bao(ok ? "roi" : "hong");
    } catch {
      bao("hong");
    }
  };

  const chu = xong === "roi" ? "Đã chép" : xong === "hong" ? "Không chép được" : "Chép link";
  return (
    <button
      type="button"
      className={css.nut}
      onClick={() => void chep()}
      // Nhãn nghe được mang cả tên mạch; nhãn nhìn thấy thì không, vì thẻ đã có tiêu đề
      // ngay trên nó và lặp lại là đọc thừa cho người nhìn được.
      aria-label={`${chu} — ${nhan}`}
      data-testid="the-mach-chep-link"
      data-trang-thai={xong}
    >
      {/* `aria-hidden` cho biểu tượng: trình đọc màn hình đã có `aria-label` của nút, và
          một dấu 🔗 đọc thành "link symbol" giữa câu chỉ làm rối. */}
      <span aria-hidden>🔗</span> {chu}
    </button>
  );
}
