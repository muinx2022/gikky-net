import css from "./logo.module.css";

/** Component Logo thương hiệu gikky.net theo bản thiết kế Variant 3.
 *
 * Gồm huy hiệu tròn thu nhỏ (nền slate tối, chữ G, dải spine mốc hoàng thổ và .NET)
 * kết hợp tên thương hiệu "gikky" thích ứng mượt mà theo Dark/Light Mode.
 */
export function LogoGikky() {
  return (
    <span className={css.khung_hieu}>
      <span className={css.huy_hieu} aria-hidden="true">
        <svg
          width="26"
          height="26"
          viewBox="0 0 100 100"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          className={css.svg_huy_hieu}
        >
          {/* Nền tối slate/navy của Variant 3 */}
          <circle cx="50" cy="50" r="48" fill="#0f172a" stroke="#1e293b" strokeWidth="3" />
          <circle cx="50" cy="50" r="44" stroke="#334155" strokeWidth="1" strokeDasharray="3 3" />
          {/* Chữ G */}
          <text
            x="50"
            y="46"
            textAnchor="middle"
            fill="#ffffff"
            fontSize="32"
            fontWeight="800"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            G
          </text>
          {/* Dải mốc hoàng thổ ●──●──● */}
          <line x1="26" y1="62" x2="74" y2="62" stroke="#d49b42" strokeWidth="2.5" />
          <circle cx="26" cy="62" r="4.5" fill="#d49b42" />
          <circle cx="50" cy="62" r="4.5" fill="#d49b42" />
          <circle cx="74" cy="62" r="4.5" fill="#d49b42" />
          {/* .NET */}
          <text
            x="50"
            y="81"
            textAnchor="middle"
            fill="#94a3b8"
            fontSize="14"
            fontWeight="700"
            letterSpacing="1"
            fontFamily="system-ui, -apple-system, sans-serif"
          >
            .NET
          </text>
        </svg>
      </span>
      <span className={css.chu_hieu}>gikky</span>
    </span>
  );
}
