/** Công tắc Sáng / Tối / Theo hệ thống của khu quản trị.
 *
 * ## Khác `apps/web` ở đúng một chỗ, và chỗ đó là chủ đích
 *
 * `apps/web` để `data-theme` **VẮNG MẶT** khi người dùng chọn "theo hệ thống", rồi CSS ở
 * đó có một nhánh `@media (prefers-color-scheme: dark)` riêng để xử ca ấy. Nó phải làm
 * thế vì trang mạch chạy ISR: HTML dùng chung cho mọi người, nên "theo hệ thống" không
 * được nướng thành một giá trị cụ thể ở bất kỳ đâu.
 *
 * Khu quản trị **không có ISR, không cache gì** (`CongQuanTri` là client component, mọi
 * lời gọi `no-store`). Nên ở đây script inline **giải** "theo hệ thống" thành `sang` hoặc
 * `toi` ngay lúc tải, và `data-theme` luôn mang một trong hai giá trị đó.
 *
 * Cái được: `app/globals.css` **chỉ phải biết hai trạng thái** — không có nhánh
 * `prefers-color-scheme` nào trong CSS, tức không có hai nhánh để trôi khỏi nhau. Ở
 * `apps/web` hai nhánh ấy là một nguồn lỗi có thật (một token khai ở nhánh này mà quên
 * nhánh kia thì chỉ hỏng với đúng một nhóm người dùng).
 *
 * Cái phải trả: khi đang ở "theo hệ thống" mà người dùng đổi theme của **hệ điều hành**,
 * trang phải tự đổi theo — không có `@media` nào làm hộ nữa. Đó là việc của
 * `theoDoiHeThong` dưới đây, và nó là lý do hàm ấy tồn tại.
 *
 * ## Vì sao `localStorage` chứ không cookie
 *
 * Cookie đi kèm **mọi** request, nên nó là một lời mời đọc nó ở server — và lời mời ấy sẽ
 * được nhận. `localStorage` không có cửa đó.
 */

/** Khoá trong `localStorage`. Có tiền tố vì `localStorage` là không gian tên chung của cả
 * origin, và `theme` là chuỗi mà mọi thư viện đều nghĩ tới đầu tiên. */
export const KHOA_THEME = "gikky-admin:theme";

/** Ba trạng thái của công tắc. `"he"` là mặc định — trạng thái của người chưa bấm bao giờ. */
export const CAC_THEME = ["he", "sang", "toi"] as const;
export type LuaChonTheme = (typeof CAC_THEME)[number];

export const THEME_MAC_DINH: LuaChonTheme = "he";

export const NHAN_THEME: Record<LuaChonTheme, string> = {
  he: "Theo hệ thống",
  sang: "Sáng",
  toi: "Tối",
};

/** Hai giá trị `data-theme` có thật trên `<html>`. `"he"` KHÔNG nằm ở đây — nó được giải
 * thành một trong hai trước khi chạm DOM. */
export type ThemeThuc = "sang" | "toi";

export const TRUY_VAN_TOI = "(prefers-color-scheme: dark)";

/** Chuỗi lạ trong `localStorage` ⇒ về mặc định, không ném.
 *
 * `localStorage` là dữ liệu người dùng sửa được bằng một dòng trong console. Ném ở đây
 * nghĩa là script inline chết và **cả trang không có theme nào** — hỏng nặng hơn hẳn thứ
 * nó đang canh.
 */
export function docLuaChon(tho: string | null): LuaChonTheme {
  return (CAC_THEME as readonly string[]).includes(tho ?? "")
    ? (tho as LuaChonTheme)
    : THEME_MAC_DINH;
}

/** Giải một lựa chọn thành theme THỰC, cần biết hệ điều hành đang ở chế độ nào. */
export function giaiTheme(chon: LuaChonTheme, heThongToi: boolean): ThemeThuc {
  if (chon === "sang") return "sang";
  if (chon === "toi") return "toi";
  return heThongToi ? "toi" : "sang";
}

/** Áp lên `<html>`. Dùng ở CẢ hai chỗ — lúc tải và lúc bấm — nên hai đường không lệch nhau.
 *
 * Nhận `goc` thay vì tự đọc `document`: hàm gọi được từ bài đo mà không cần trình duyệt,
 * và nó nói ra rằng nó chỉ chạm đúng một phần tử.
 */
export function apTheme(goc: HTMLElement, thuc: ThemeThuc): void {
  goc.setAttribute("data-theme", thuc);
}

/** Nguồn của **script inline** chạy trước lần vẽ đầu tiên.
 *
 * Sinh ra từ các hằng ở trên chứ không gõ tay: đổi `KHOA_THEME` mà quên script là công
 * tắc ghi vào một khoá còn lúc tải đọc một khoá khác — lựa chọn "sống" đúng tới lúc F5.
 *
 * **Cố ý viết bằng ES5 và không gọi `giaiTheme`.** Nó chạy trước cả bundle: không module,
 * không polyfill, không gì ngoài chính chuỗi này. Bản sao logic ở đây là bản sao **có
 * canh** — `e2e/don-vi/theme-quan-tri.spec.ts` chạy chuỗi này trên một DOM giả rồi so kết
 * quả với `giaiTheme`, cho cả ba lựa chọn × hai trạng thái hệ điều hành.
 *
 * `try/catch` bao trọn: `localStorage` ném thẳng khi cookie bị chặn hoàn toàn. Ở ca đó
 * trang phải rơi về giao diện sáng, không phải trắng bóc vì một ngoại lệ chưa ai bắt
 * trong `<head>`.
 */
export function nguonScriptTheme(): string {
  return (
    "(function(){try{" +
    `var c=localStorage.getItem(${JSON.stringify(KHOA_THEME)});` +
    `var t=matchMedia(${JSON.stringify(TRUY_VAN_TOI)}).matches;` +
    'var v=c==="sang"?"sang":c==="toi"?"toi":(t?"toi":"sang");' +
    'document.documentElement.setAttribute("data-theme",v);' +
    '}catch(x){document.documentElement.setAttribute("data-theme","sang");}})()'
  );
}
