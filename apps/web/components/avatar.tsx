import { chuCaiAvatar } from "@/lib/avatar";

import css from "./avatar.module.css";

/** Avatar tròn — **chữ cái bây giờ, ảnh khi backend có** (PLAN khu người dùng 2026-08-24).
 *
 * ## Vì sao là component server (không `"use client"`)
 *
 * Nó không có state, không hook, không sự kiện — chỉ là một `<span>`/`<img>`. Giữ nó ở
 * phía server để nó cắm được vào thẻ mốc / thẻ mạch (vốn render server) mà không kéo gì
 * sang bundle client.
 *
 * ## `url` là chỗ chờ sẵn cho avatar ẢNH
 *
 * Hôm nay `NguoiDungTomTatOut` chưa có `avatar_url`, nên mọi lời gọi truyền `url`
 * `undefined` và ai cũng thấy chữ cái. Nhịp backend thêm cột `User.avatar` +
 * `avatar_url` vào schema rồi codegen; lúc đó chỉ việc truyền `url={author.avatar_url}`
 * ở từng chỗ và ảnh tự lên — không phải đụng lại component này.
 *
 * `alt=""` khi rơi về chữ cái: chữ cái là trang trí, tên thật đã nằm ngay cạnh dưới dạng
 * text; đọc "Ảnh đại diện của T" rồi "u/tí" là đọc hai lần. Có `url` thì `alt` mang tên
 * để trình đọc màn hình biết đây là mặt người, không phải icon.
 */
export function Avatar({
  ten,
  hienThi,
  url,
  co = 32,
}: {
  /** `username` — dùng khi không có `display_name`. */
  ten: string;
  /** `display_name`, nếu có; chữ cái ưu tiên lấy từ đây. */
  hienThi?: string | null;
  /** URL ảnh đại diện; `undefined`/`null` ⇒ rơi về chữ cái. */
  url?: string | null;
  /** Đường kính, px. */
  co?: number;
}) {
  const canh = { width: co, height: co } as const;

  if (url != null && url !== "") {
    return (
      // Avatar là URL người dùng tải lên (kho ảnh của app), không phải asset build-time;
      // `next/image` đòi khai domain trước và không thêm gì cho một ảnh ~32px đã đúng cỡ.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={hienThi || ten}
        className={css.anh}
        style={canh}
        width={co}
        height={co}
      />
    );
  }

  return (
    <span
      className={css.chu}
      style={{ ...canh, fontSize: Math.round(co * 0.44) }}
      aria-hidden
      data-testid="avatar-chu"
    >
      {chuCaiAvatar(hienThi || ten)}
    </span>
  );
}
