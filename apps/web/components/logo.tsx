import Image from "next/image";
import css from "./logo.module.css";

/** Component Logo thương hiệu gikky.net.
 *
 * Biểu tượng chữ G cách điệu không nền với viền sáng mảnh,
 * kết hợp chữ thương hiệu "gikky" tương thích hoàn hảo cả Dark Mode và Light Mode.
 */
export function LogoGikky() {
  return (
    <span className={css.khung_hieu}>
      <span className={css.bieu_tuong} aria-hidden="true">
        <Image
          src="/icon.png"
          alt=""
          width={26}
          height={26}
          className={css.anh_bieu_tuong}
          priority
        />
      </span>
      <span className={css.chu_hieu}>gikky</span>
    </span>
  );
}
