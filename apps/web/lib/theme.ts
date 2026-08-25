/** Công tắc Sáng / Tối / Theo hệ thống — phần khó nằm ở ISR, không nằm ở CSS.
 *
 * ## Vì sao KHÔNG được server-render lựa chọn này
 *
 * Trang mạch chạy ISR `revalidate=3600` (PLAN 8.4), tức **một bản HTML dùng chung cho mọi
 * người**. Đọc cookie theme ở server rồi nướng `data-theme="dark"` vào `<html>` là đúng
 * cái bẫy "dữ liệu người này phục vụ người kia" mà cả một lượt phản biện vừa bỏ công
 * chứng minh là **không** có ở repo này — và nó còn tệ hơn phần lớn ca khác vì nó không
 * sai một cách nhìn thấy được: trang vẫn 200, chỉ là người thứ hai nhận theme của người
 * thứ nhất. Đọc cookie ở layout gốc còn kéo theo hậu quả thứ hai: **cả cây route thành
 * dynamic**, tức `/luat` thôi là route tĩnh và đường thoát của `error.tsx` hỏng cùng lúc
 * với thứ nó thoát khỏi.
 *
 * ⇒ Cách duy nhất đúng: **một script inline chạy TRƯỚC lần vẽ đầu tiên**, đọc
 * `localStorage`, đặt `data-theme` lên `<html>`. Script ấy nằm trong HTML đã cache — nó
 * là hằng, ai cũng nhận đúng một chuỗi ký tự — nhưng thứ nó ĐỌC là trạng thái *của trình
 * duyệt*, nên mỗi người ra một kết quả. Hàng rào cho luật này:
 * `e2e/sang-toi.spec.ts` đọc HTML THÔ của server và đòi `<html>` không mang `data-theme`.
 *
 * ## Vì sao `localStorage` chứ không cookie
 *
 * Cookie đi kèm **mọi** request, kể cả request tới trang ISR, nên nó là một lời mời đọc
 * nó ở server — và lời mời ấy sẽ được nhận trong vòng vài tháng. `localStorage` không có
 * cửa đó: server không thể đọc nó dù muốn. Luật được cài bằng cơ chế, không bằng kỷ luật.
 *
 * ## `color-scheme` phải đi theo
 *
 * Không có nó thì thanh cuộn, ô nhập và menu ngữ cảnh do trình duyệt tự vẽ giữ nguyên
 * tông của hệ điều hành — một trang tối với một thanh cuộn trắng toát.
 */

/** Khoá trong `localStorage`. Có tiền tố vì `localStorage` là không gian tên chung của
 * cả origin, và `theme` là chuỗi mà mọi thư viện đều nghĩ tới đầu tiên. */
export const KHOA_THEME = "gikky:theme";

/** Ba trạng thái của công tắc. `"he"` (theo hệ thống) là mặc định và là trạng thái của
 * người chưa bao giờ bấm — nó **không** được lưu, xem `datLuaChon`. */
export const CAC_THEME = ["he", "sang", "toi"] as const;
export type LuaChonTheme = (typeof CAC_THEME)[number];

export const THEME_MAC_DINH: LuaChonTheme = "he";

export const NHAN_THEME: Record<LuaChonTheme, string> = {
  he: "Theo hệ thống",
  sang: "Sáng",
  toi: "Tối",
};

/** Chuỗi lạ trong `localStorage` ⇒ về mặc định, không ném.
 *
 * `localStorage` là dữ liệu người dùng sửa được bằng một dòng trong console, và nó cũng
 * là chỗ một phiên bản cũ của chính trang này có thể đã ghi một giá trị khác. Ném ở đây
 * nghĩa là script inline chết và **cả trang không có theme nào** — hỏng nặng hơn hẳn thứ
 * nó đang canh.
 */
export function docLuaChon(tho: string | null): LuaChonTheme {
  return (CAC_THEME as readonly string[]).includes(tho ?? "")
    ? (tho as LuaChonTheme)
    : THEME_MAC_DINH;
}

/** Giá trị `data-theme` cho một lựa chọn — `null` nghĩa **gỡ thuộc tính**.
 *
 * "Theo hệ thống" phải là VẮNG MẶT thuộc tính, không phải một giá trị thứ ba. Bảng token
 * ở `app/globals.css` viết luật dark là `@media (prefers-color-scheme: dark)` +
 * `:root:not([data-theme="light"])`; một `data-theme="he"` nằm đó thì không khớp nhánh
 * nào và trang mắc kẹt ở sáng ngay cả trên máy đang để tối.
 */
export function thuocTinhTheme(chon: LuaChonTheme): "light" | "dark" | null {
  if (chon === "sang") return "light";
  if (chon === "toi") return "dark";
  return null;
}

/** Giá trị `color-scheme` đi kèm. `"light dark"` = trả quyền quyết định lại cho hệ điều
 * hành, đúng nghĩa "theo hệ thống". */
export function luocDoMau(chon: LuaChonTheme): string {
  return thuocTinhTheme(chon) ?? "light dark";
}

/** Theme **đang hiện trên màn hình**, sau khi đã tính cả "theo hệ thống".
 *
 * `LuaChonTheme` là thứ người dùng đã CHỌN; hàm này trả thứ họ đang THẤY. Hai khái niệm
 * ấy khác nhau ở đúng một trường hợp — `"he"` — và đó lại là trường hợp mặc định, tức
 * trường hợp của gần như mọi người ở lượt truy cập đầu.
 *
 * Trộn lẫn hai khái niệm là nguồn của lỗi user báo 2026-08-24: *"chưa đăng nhập không
 * chọn được theme"*. Thực tế công tắc chạy đúng — nhưng máy họ đang để tối, mặc định là
 * "theo hệ thống", nên bấm "Tối" đổi `data-theme` mà **không đổi một pixel nào**. Đo
 * được: nền trước và sau đều `rgb(14,17,22)`.
 */
export function themeDangDung(chon: LuaChonTheme, heToi: boolean): "sang" | "toi" {
  if (chon === "sang") return "sang";
  if (chon === "toi") return "toi";
  return heToi ? "toi" : "sang";
}

/** Lựa chọn mà **nút hai trạng thái** trên thanh header sẽ đặt khi được bấm.
 *
 * Luôn NGƯỢC với thứ đang hiện ⇒ **mỗi cú bấm luôn đổi được cái gì đó nhìn thấy được**.
 * Đó là cả lý do nút này thay cho ô chọn ba trạng thái cũ (user chốt 2026-08-24): trong
 * ô chọn cũ, "Tối" và "Theo hệ thống" trùng nhau về mặt hình ảnh trên một máy đang để
 * tối, và một control không phản hồi thì không phân biệt được với một control hỏng.
 *
 * "Theo hệ thống" **không** biến mất khỏi sản phẩm — nó vẫn là mặc định của người chưa
 * bấm bao giờ, và vẫn chọn lại được ở `/cai-dat` (`components/chon-giao-dien.tsx`).
 */
export function mucTieuCongTac(chon: LuaChonTheme, heToi: boolean): "sang" | "toi" {
  return themeDangDung(chon, heToi) === "toi" ? "sang" : "toi";
}

/** Ghi lựa chọn xuống `localStorage` — **một trạng thái, một cách biểu diễn**.
 *
 * "Theo hệ thống" **xoá** khoá thay vì ghi `"he"`: người chưa bao giờ bấm và người vừa
 * chọn lại "theo hệ thống" là cùng một trạng thái, và hai cách biểu diễn cho một trạng
 * thái là chỗ hai nhánh code sẽ lệch nhau.
 *
 * Nhận `kho` thay vì tự đọc `window.localStorage`: hai component cùng ghi (nút ở header,
 * ô chọn ở `/cai-dat`) nên luật phải nằm ở MỘT chỗ, và chỗ ấy phải đo được không cần
 * trình duyệt. Không nuốt lỗi ở đây — chỗ gọi quyết định làm gì khi kho ném.
 */
export function luuLuaChon(
  kho: Pick<Storage, "setItem" | "removeItem">,
  chon: LuaChonTheme,
): void {
  if (chon === THEME_MAC_DINH) kho.removeItem(KHOA_THEME);
  else kho.setItem(KHOA_THEME, chon);
}

/** Áp một lựa chọn lên `<html>`. Dùng ở CẢ hai chỗ — script inline lúc tải, và công tắc
 * lúc người ta bấm — nên hai đường không thể lệch nhau.
 *
 * Nhận `goc` thay vì tự đọc `document`: hàm gọi được từ bài đo mà không cần một trình
 * duyệt, và nó nói ra rằng nó chỉ chạm đúng một phần tử.
 */
export function apTheme(goc: HTMLElement, chon: LuaChonTheme): void {
  const gia_tri = thuocTinhTheme(chon);
  if (gia_tri === null) goc.removeAttribute("data-theme");
  else goc.setAttribute("data-theme", gia_tri);
  goc.style.colorScheme = luocDoMau(chon);
}

/** Nguồn của **script inline** chạy trước lần vẽ đầu tiên.
 *
 * Sinh ra từ các hằng ở trên chứ không gõ tay: đổi `KHOA_THEME` mà quên script là công
 * tắc ghi vào một khoá còn lúc tải đọc một khoá khác — lựa chọn "sống" đúng tới lúc F5.
 *
 * **Cố ý viết bằng ES5 và không dùng `apTheme`.** Nó chạy trước cả bundle: không có
 * module, không có polyfill, không có gì ngoài chính chuỗi này. Ba dòng lặp lại logic của
 * `thuocTinhTheme`/`luocDoMau` là bản sao **có canh** — `e2e/don-vi/theme.spec.ts` chạy
 * chuỗi này trên một DOM giả và so kết quả với hai hàm kia, cho cả ba lựa chọn.
 *
 * `try/catch` bao trọn: `localStorage` ném thẳng khi cookie bị chặn hoàn toàn hoặc trong
 * chế độ riêng tư của vài trình duyệt. Ở ca đó trang phải rơi về "theo hệ thống", không
 * phải trắng bóc vì một ngoại lệ chưa ai bắt trong `<head>`.
 */
export function nguonScriptTheme(): string {
  return (
    "(function(){try{" +
    `var c=localStorage.getItem(${JSON.stringify(KHOA_THEME)});` +
    "var e=document.documentElement;" +
    'if(c==="sang"){e.setAttribute("data-theme","light");e.style.colorScheme="light";}' +
    'else if(c==="toi"){e.setAttribute("data-theme","dark");e.style.colorScheme="dark";}' +
    'else{e.removeAttribute("data-theme");e.style.colorScheme="light dark";}' +
    "}catch(x){}})()"
  );
}
