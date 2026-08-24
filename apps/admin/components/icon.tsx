/** Bộ icon viết tay — SVG stroke 1.5px, 20×20, ăn theo `currentColor`.
 *
 * **Cố ý không thêm package icon.** Khu quản trị dùng đúng mười mấy hình; một bộ icon
 * đầy đủ là vài trăm KB tải vào mọi trang và là một dependency nữa phải theo dõi. Mười
 * mấy `<path>` thì nằm gọn trong một file và không ai phải cài gì.
 *
 * `aria-hidden` mặc định: icon ở đây **luôn** đi kèm chữ (nhãn menu, nhãn nút). Một icon
 * được trình đọc màn hình đọc thành "hình ảnh" bên cạnh chữ của chính nó là nhiễu, không
 * phải trợ năng. Chỗ nào icon đứng một mình thì nút bọc ngoài phải có `aria-label`.
 */

export type TenIcon =
  | "bang-dieu-khien"
  | "co"
  | "mach"
  | "binh-luan"
  | "nhat-ky"
  | "nguoi-dung"
  | "chuyen-muc"
  | "tim"
  | "chuong"
  | "menu"
  | "dong"
  | "mui-ten-xuong"
  | "mo-ngoai"
  | "an"
  | "hien"
  | "khoa"
  | "mo-khoa"
  | "cai-dat";

const DUONG: Record<TenIcon, React.ReactNode> = {
  "bang-dieu-khien": (
    <>
      <rect x="3" y="3" width="7" height="8" rx="1.5" />
      <rect x="14" y="3" width="7" height="5" rx="1.5" />
      <rect x="14" y="11" width="7" height="10" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  co: (
    <>
      <path d="M4 21V4" />
      <path d="M4 5h11l-1.5 3L15 11H4" />
    </>
  ),
  mach: (
    <>
      <path d="M4 6h16M4 12h16M4 18h10" />
      <circle cx="19.5" cy="18" r="1.6" />
    </>
  ),
  "binh-luan": (
    <path d="M20 12a7 7 0 0 1-7 7H8l-4 3v-4.6A7 7 0 0 1 4 12a7 7 0 0 1 7-7h2a7 7 0 0 1 7 7Z" />
  ),
  "nhat-ky": (
    <>
      <path d="M6 3h10l4 4v14H6z" />
      <path d="M16 3v4h4M9 12h7M9 16h7" />
    </>
  ),
  "nguoi-dung": (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20a7 7 0 0 1 14 0" />
    </>
  ),
  "chuyen-muc": (
    <>
      <rect x="3" y="4" width="18" height="16" rx="2" />
      <path d="M3 9h18M9 9v11" />
    </>
  ),
  tim: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="m16 16 4 4" />
    </>
  ),
  chuong: (
    <>
      <path d="M6 9a6 6 0 0 1 12 0c0 4 1.5 5.5 1.5 5.5h-15S6 13 6 9Z" />
      <path d="M10 18a2 2 0 0 0 4 0" />
    </>
  ),
  menu: <path d="M4 6h16M4 12h16M4 18h16" />,
  dong: <path d="m6 6 12 12M18 6 6 18" />,
  "mui-ten-xuong": <path d="m6 9 6 6 6-6" />,
  "mo-ngoai": (
    <>
      <path d="M14 4h6v6" />
      <path d="M20 4 11 13" />
      <path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  an: (
    <>
      <path d="M3 3l18 18" />
      <path d="M10.6 6.2A9 9 0 0 1 12 6c5 0 9 6 9 6a15 15 0 0 1-2.7 3.2M6.5 7.6A15 15 0 0 0 3 12s4 6 9 6a9 9 0 0 0 3.3-.6" />
      <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    </>
  ),
  hien: (
    <>
      <path d="M3 12s4-6 9-6 9 6 9 6-4 6-9 6-9-6-9-6Z" />
      <circle cx="12" cy="12" r="2.6" />
    </>
  ),
  khoa: (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 8 0v3" />
    </>
  ),
  "mo-khoa": (
    <>
      <rect x="5" y="10" width="14" height="10" rx="2" />
      <path d="M8 10V7a4 4 0 0 1 7.5-2" />
    </>
  ),
  "cai-dat": (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
    </>
  ),
};

export function Icon({
  ten,
  className = "size-5",
}: {
  ten: TenIcon;
  className?: string;
}) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {DUONG[ten]}
    </svg>
  );
}
