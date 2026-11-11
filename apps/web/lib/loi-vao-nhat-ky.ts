/** Lối vào "ghi nhật ký" trên trang chủ (`components/loi-vao-nhat-ky.tsx`) có nên mở NGĂN KÉO
 * đăng nhanh thay vì đi tới `/dang-mach` hay không. Hàm THUẦN — đo được không cần trình duyệt
 * (`e2e/don-vi/trang-chu-giao-dien-moi.spec.ts`).
 *
 * Chỉ mở ngăn kéo khi **chắc chắn đã đăng nhập** và là một cú bấm trái thường:
 * - khách, hoặc phiên chưa tải xong ⇒ để link chạy tới `/dang-mach` (nơi có lời mời đăng nhập;
 *   đoán "đã đăng nhập" sai ở đây là chặn người ta vào form);
 * - bấm kèm ctrl / cmd / shift / alt, hoặc không phải chuột trái ⇒ người dùng đang MUỐN một tab /
 *   cửa sổ mới tới đúng URL, đừng cướp. */
export type CuBamLoiVao = {
  dangTai: boolean;
  dangNhap: boolean;
  button: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
  altKey: boolean;
  /** Ai đó đã `preventDefault()` trước ta. */
  daChan: boolean;
};

export function nenMoNganKeo(c: CuBamLoiVao): boolean {
  if (c.dangTai || !c.dangNhap || c.daChan) return false;
  if (c.button !== 0) return false;
  return !(c.ctrlKey || c.metaKey || c.shiftKey || c.altKey);
}
