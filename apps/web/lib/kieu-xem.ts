/** Hai kiểu xem feed — **thẻ** và **gọn** (plan giao diện §2.2).
 *
 * Cùng cơ chế với công tắc theme, và **cố ý** cùng cơ chế: lựa chọn nằm ở `localStorage`,
 * một script inline trong `<head>` đặt `data-kieu-xem` lên `<html>` trước lần vẽ đầu, CSS
 * đọc thuộc tính ấy. Lý do thì nặng hơn ở đây một bậc so với theme: kiểu xem đổi **chiều
 * cao của mọi thẻ**, nên áp nó sau khi hydrate không chỉ là một cú nháy màu mà là cả feed
 * nhảy dựng lên dưới con trỏ người ta vừa nhắm vào.
 *
 * Và vẫn cùng luật cứng của PLAN 8.4: **không server-render lựa chọn này**. Trang chủ hôm
 * nay là `force-dynamic` nên có vẻ vô hại, nhưng thẻ mạch cũng nằm trên trang hồ sơ và
 * trang sub, và mọi thứ ở đây rồi sẽ đi qua một trang có cache. Một cơ chế đúng ở mọi
 * trang rẻ hơn một cơ chế đúng ở trang này và sai ở trang sau.
 *
 * Tách khỏi `lib/theme.ts` chứ không nhét chung: hai lựa chọn độc lập, hai khoá riêng.
 * Gộp làm một object JSON trong một khoá là mỗi lần thêm một lựa chọn thứ ba lại phải
 * viết đường di trú cho dữ liệu cũ.
 */

export const KHOA_KIEU_XEM = "gikky:kieu-xem";

/** `"the"` = thẻ đầy đủ (mặc định) · `"gon"` = dòng nén, nhiều bài trên một màn hình. */
export const CAC_KIEU_XEM = ["the", "gon"] as const;
export type KieuXem = (typeof CAC_KIEU_XEM)[number];

export const KIEU_XEM_MAC_DINH: KieuXem = "the";

export const NHAN_KIEU_XEM: Record<KieuXem, string> = {
  the: "Thẻ",
  gon: "Gọn",
};

export function docKieuXem(tho: string | null): KieuXem {
  return (CAC_KIEU_XEM as readonly string[]).includes(tho ?? "")
    ? (tho as KieuXem)
    : KIEU_XEM_MAC_DINH;
}

/** Áp lên `<html>`. Kiểu mặc định là **vắng mặt** thuộc tính, cùng lý lẽ với
 * `thuocTinhTheme`: một trạng thái, một cách biểu diễn. */
export function apKieuXem(goc: HTMLElement, kieu: KieuXem): void {
  if (kieu === KIEU_XEM_MAC_DINH) goc.removeAttribute("data-kieu-xem");
  else goc.setAttribute("data-kieu-xem", kieu);
}

/** Script inline, ES5, chạy trước lần vẽ đầu. Xem `lib/theme.ts::nguonScriptTheme` về vì
 * sao nó không dùng lại `apKieuXem` và vì sao có `try/catch`. */
export function nguonScriptKieuXem(): string {
  return (
    "(function(){try{" +
    `var c=localStorage.getItem(${JSON.stringify(KHOA_KIEU_XEM)});` +
    "var e=document.documentElement;" +
    'if(c==="gon"){e.setAttribute("data-kieu-xem","gon");}' +
    'else{e.removeAttribute("data-kieu-xem");}' +
    "}catch(x){}})()"
  );
}
