import css from "./khung-hai-cot.module.css";

/** Vỏ **HAI cột** duy nhất của web: nội dung chính + rail phải. Không có rail trái.
 *
 * *(user 2026-11-10: "thống nhất giao diện chung của web là 2 cột, 1 cột content và cột bên
 * phải"; plan `2026-11-10-hai-cot-toan-site.md`)*
 *
 * ## Vì sao một vỏ
 *
 * Tới hôm ấy có ba khung, mỗi khung một lưới: `KhungHaiCot` ba cột `226·700·300`, `Feed` ba
 * cột riêng cho `/s/<sub>`, `KhungTrangChu` (nay đã gộp vào đây) hai cột `760·300`. Điều hướng `/` → `/s/x` làm
 * cột nội dung nhảy ngang 193px — đúng lỗi mà `KhungHaiCot` lập ra (2026-08-24) để diệt. Nay
 * cả bốn đường vào (`KhungHaiCot`, `KhungHaiCotTinh`, `Feed`, và các trang tự dựng sidebar như
 * `/` và `/chu-de`) đi qua **file này**; lưới nằm ở `khung-hai-cot.module.css` và chỉ ở đó.
 *
 * ## Vỏ KHÔNG gọi API
 *
 * Nó chỉ bày `children` và `sidebar` do người gọi đưa vào. Đó là điều kiện để
 * `KhungHaiCotTinh` (khung của `/luat`, route TĨNH) dùng chung đúng vỏ này mà không kéo lời gọi
 * API nào vào — xem docstring của nó.
 *
 * ## `<main>` nằm ở ĐÂY, không ở con
 *
 * Bọc thêm một lớp là `<main>` lồng `<main>` — HTML sai và trình đọc màn hình mất mốc điều
 * hướng. Trang con trả **nội dung trần**.
 *
 * `rail` là lớp bọc `sticky` (cùng vai ở mọi trang): `<Sidebar>` là `<aside>`, bọc thêm
 * `<aside>` nữa là hai landmark lồng nhau. Không có lớp này thì rail dính ở trang này mà không
 * dính ở trang kia — lại một kiểu "nhảy nhót", chỉ là theo chiều dọc.
 *
 * ## `anRailDiDong` — CHỈ cho trang `noindex`
 *
 * Trang form (`/dang-mach`, `/cai-dat`, `/sua-ho-so`, `/doi-mat-khau`) trên điện thoại (≤ 960px, nơi
 * rail rơi xuống dưới nội dung) không vẽ rail: dưới một form, Chuyên mục + Luật + Bài mới là một
 * cuộn dài không ai cần (đợt M, M8). Ẩn bằng CSS nên DOM không đổi; nhưng một trang INDEX được mà
 * giấu link khỏi người dùng là đi ngược luật "SEO chỉ cộng" — nên cờ này chỉ dành cho trang `robots:
 * noindex`.
 *
 * ## `railCao` — rail mang khối "Bài viết mới" 10 bài (`/` nhánh v2 và `/luat`)
 *
 * Rail chỉ DÍNH khi khung nhìn đủ cao để chứa cả nó (`khung-hai-cot.module.css`). Khối 10 bài
 * (việc 24) làm rail của hai trang ấy cao hơn hẳn mọi trang khác (1831px so với ≤ 1478px), nên
 * chúng dùng ngưỡng RIÊNG cao hơn — một ngưỡng chung đủ cho chúng thì làm `/m/…`, `/u/…` mất dính
 * oan ở cả dải khung nhìn giữa hai con số. Con số và bảng đo nằm ở file CSS.
 */
export function VoKhungHaiCot({
  children,
  sidebar,
  anRailDiDong = false,
  railCao = false,
}: {
  children: React.ReactNode;
  sidebar: React.ReactNode;
  anRailDiDong?: boolean;
  railCao?: boolean;
}) {
  const lop_rail = [css.rail, anRailDiDong && css.rail_an_di_dong, railCao && css.rail_cao]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={css.khung} data-testid="khung-hai-cot">
      <main className={css.chinh}>{children}</main>
      <div className={lop_rail} data-testid="rail-phai">
        {sidebar}
      </div>
    </div>
  );
}
