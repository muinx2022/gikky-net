import type { TenIcon } from "../icon";

/** Khai báo menu — **một chỗ duy nhất**, và là nguồn của cả sidebar lẫn breadcrumb.
 *
 * ## Vì sao nó là một file dữ liệu chứ không phải JSX rải trong `sidebar.tsx`
 *
 * Hai lý do, cái thứ hai mới là lý do thật:
 *
 * 1. Breadcrumb ("KIỂM DUYỆT / Hàng đợi báo cáo") suy từ đây, nên nhãn nhóm và nhãn
 *    trang không thể lệch nhau giữa hai chỗ hiển thị.
 * 2. **Hàng rào chống nút chết đọc được file này.**
 *    `apps/web/e2e/don-vi/menu-quan-tri.spec.ts` phân tích `NHOM_MENU` rồi đòi mỗi
 *    `duong_dan` có một `page.tsx` tương ứng dưới `app/` trong `apps/admin`. Giao diện lượt
 *    này dựng theo một template dashboard có sẵn, và template ấy đầy mục
 *    (`E-commerce`, `Charts`, `Widget`, `Documentation`) **không tồn tại ở gikky** —
 *    chép nhầm một mục sang là một nút dẫn tới 404 mà chỉ mod nhìn thấy, tức gần như
 *    không ai báo. Hàng rào chỉ chạy được khi menu là **dữ liệu tĩnh phân tích được**;
 *    JSX rải rác thì nó phải viết nửa cái parser.
 *
 * ⇒ Thêm mục ở đây thì **phải** có trang thật. Không có ngoại lệ "để tạm rồi làm sau".
 */

export type MucMenu = {
  duong_dan: string;
  nhan: string;
  icon: TenIcon;
  /** Mục này hiện số đếm bên phải (hôm nay chỉ hàng đợi báo cáo dùng). */
  co_badge?: boolean;
  /** Khớp cả đường dẫn con (`/machs/12` vẫn tô sáng `/machs`). Trang chủ thì không —
   *  `/` là tiền tố của mọi thứ. */
  khop_tien_to?: boolean;
};

export type NhomMenu = {
  ten: string;
  muc: MucMenu[];
};

export const NHOM_MENU: NhomMenu[] = [
  {
    ten: "Tổng quan",
    muc: [
      { duong_dan: "/", nhan: "Bảng điều khiển", icon: "bang-dieu-khien" },
    ],
  },
  {
    ten: "Kiểm duyệt",
    muc: [
      {
        duong_dan: "/bao-cao",
        nhan: "Hàng đợi báo cáo",
        icon: "co",
        co_badge: true,
        khop_tien_to: true,
      },
      // Nhãn là **"Bài viết"**, không phải "Mạch". "Mạch" là từ của SẢN PHẨM (PLAN mục
      // 2: một bài viết sống, tác giả nối thêm mốc theo thời gian) và nó giữ nguyên ở mặt
      // tiền — nhưng trong khu quản trị nó là một từ mod phải học trước khi dùng được
      // menu. Nhãn nói cái mod cần biết ("đây là danh sách bài"), phần mô tả trang nói
      // tiếp phần riêng của gikky.
      { duong_dan: "/machs", nhan: "Bài viết", icon: "mach", khop_tien_to: true },
      { duong_dan: "/binh-luan", nhan: "Bình luận", icon: "binh-luan" },
      { duong_dan: "/nhat-ky", nhan: "Nhật ký", icon: "nhat-ky" },
    ],
  },
  {
    ten: "Cộng đồng",
    muc: [
      {
        duong_dan: "/users",
        nhan: "Người dùng",
        icon: "nguoi-dung",
        khop_tien_to: true,
      },
      // Đặt ở "Cộng đồng" chứ không "Hệ thống", và ngay SAU "Người dùng": lời than của
      // user là *khó tìm* ("2 mục này… đặt vào đây hơi khó hiểu và khó mà tìm được"), mà
      // chỗ người ta đi tìm một con người là khu người dùng, không phải khu cài đặt. Hai
      // mục cạnh nhau còn nói ra quan hệ giữa chúng: bảng bên trái cố ý KHÔNG chứa những
      // người ở bảng bên phải. Đây là lựa chọn có thể bàn — đổi ý thì đổi đúng dòng này.
      { duong_dan: "/quan-tri-vien", nhan: "Quản trị viên", icon: "nguoi-dung" },
      { duong_dan: "/subs", nhan: "Chuyên mục", icon: "chuyen-muc" },
    ],
  },
  {
    ten: "Hệ thống",
    muc: [
      { duong_dan: "/cai-dat", nhan: "Cài đặt", icon: "cai-dat" },
      { duong_dan: "/chan-doan", nhan: "Chẩn đoán", icon: "cai-dat" },
    ],
  },
];

/** Mục khớp với một đường dẫn, hoặc `null`.
 *
 * Ưu tiên khớp **chính xác** trước rồi mới tới tiền tố: `/machs` và `/machs/12` cùng khớp
 * mục "Mạch", nhưng nếu ngày nào đó có `/machs/nhap` là một mục menu riêng thì nó phải
 * thắng — và luật "chính xác trước" là thứ giữ cho điều đó đúng mà không phải sắp lại
 * thứ tự mảng.
 */
export function mucTheoDuongDan(
  duong_dan: string,
): { nhom: NhomMenu; muc: MucMenu } | null {
  for (const nhom of NHOM_MENU) {
    for (const muc of nhom.muc) {
      if (muc.duong_dan === duong_dan) return { nhom, muc };
    }
  }
  for (const nhom of NHOM_MENU) {
    for (const muc of nhom.muc) {
      if (muc.khop_tien_to && duong_dan.startsWith(`${muc.duong_dan}/`)) {
        return { nhom, muc };
      }
    }
  }
  return null;
}

/** `true` nếu mục đang được mở — dùng cho `aria-current` và cho phần tô sáng. */
export function dangMo(muc: MucMenu, duong_dan: string): boolean {
  if (muc.duong_dan === duong_dan) return true;
  return (muc.khop_tien_to ?? false) && duong_dan.startsWith(`${muc.duong_dan}/`);
}
