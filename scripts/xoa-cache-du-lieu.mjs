// Xoá **cache DỮ LIỆU** của Next trước mỗi lần build — L41.
//
//   node scripts/xoa-cache-du-lieu.mjs [<thư mục .next>]
//
// ## Vì sao cần một cơ chế chứ không một dòng trong tài liệu
//
// `.next/cache` **sống qua `next build`**. Đó là chủ đích của Next (build lại nhanh hơn),
// và nó đúng với cache của trình biên dịch. Nó **sai** với cache dữ liệu: `fetch-cache`
// giữ nguyên văn body mà Django trả về ở lần build trước, kèm khoá tính từ URL — không
// từ hình dạng dữ liệu. Deploy một bản thêm một trường **bắt buộc** vào response API
// (Phase 5 thêm `MocOut.anhs`) ⇒ trang nào còn được phục vụ từ payload cũ đọc `undefined`
// và **crash server-side**: HTTP 500 với người dùng thật, không phải render thiếu.
//
// Đo được, hai chiều: sau lượt gộp Phase 5, render trang mạch ném
// `TypeError: Cannot read properties of undefined (reading 'length')`; xoá `.next/cache`
// ⇒ hết ngay. Đây cũng là nguyên nhân thật của "flake 1/3" ở bài đo vote (L36): bài nào
// trúng một mạch còn payload cũ thì đỏ — tất định, chỉ trông như ngẫu nhiên.
//
// ## Vì sao xoá CHỌN LỌC chứ không `rm -rf .next/cache`
//
// Xoá cả `.next/cache` cũng chữa được, và nó là thứ ai cũng gõ trong lúc chữa cháy. Cái
// giá là `webpack` + `swc` đi cùng, tức mọi lần build đều là build lạnh — và một bước
// deploy làm build chậm gấp mấy lần là một bước sẽ bị ai đó gỡ ra trong ba tháng. Ở đây
// chỉ những thư mục **giữ body của API** bị xoá; cache biên dịch ở lại nguyên.
//
// ⚠ Danh sách dưới đây là kiến thức về BỐ CỤC BÊN TRONG của Next, tức thứ có thể đổi ở
// một bản Next mới mà không ai báo. Hàng rào cho chuyện đó là
// `apps/web/e2e/don-vi/cache-du-lieu.spec.ts`: nó dựng lại đúng cây thư mục thật rồi đòi
// mỗi tên trong danh sách phải có nghĩa. Bản Next mới đổi tên thư mục ⇒ đọc lại đây.

import { existsSync, rmSync } from "node:fs";
import { basename, resolve } from "node:path";
import { pathToFileURL } from "node:url";

/** Thư mục con của `.next/cache` chứa **body API đã cache**, khoá theo URL chứ không
 * theo hình dạng dữ liệu ⇒ phải chết cùng bản build sinh ra nó.
 *
 * - `fetch-cache` — data cache của `fetch(..., { next: { revalidate } })`. Chính nó gây
 *   L41: `lib/api.ts::CHUNG_ISR` đi qua đây.
 * - `incremental-cache` — bản HTML/RSC đã prerender của route ISR ở một số bản Next.
 *   Không phải bản nào cũng có; xoá một thư mục không tồn tại là no-op.
 */
export const THU_MUC_CACHE_DU_LIEU = Object.freeze([
  "fetch-cache",
  "incremental-cache",
]);

/** Thư mục con **được giữ lại**, khai tường minh để bài đo đòi được.
 *
 * Khai ra chứ không để ngầm: "xoá cái gì" và "giữ cái gì" là hai khẳng định khác nhau, và
 * một bản vá sau này đổi `THU_MUC_CACHE_DU_LIEU` thành `["."]` vẫn đúng với mọi bài đo
 * chỉ hỏi vế thứ nhất.
 */
export const THU_MUC_GIU_LAI = Object.freeze(["webpack", "swc", "eslint", "images"]);

/** Xoá cache dữ liệu trong `<goc>/cache`. Trả về danh sách thư mục ĐÃ xoá thật.
 *
 * Hàm thuần theo nghĩa đo được: nhận đường dẫn, không đọc `process.argv`, không in gì.
 * Không có `.next` hay chưa có `cache` ⇒ trả `[]`, không ném — lần build đầu trên một
 * máy sạch là ca bình thường, không phải lỗi.
 *
 * @param {string} gocNext đường dẫn thư mục `.next`
 * @returns {string[]} tên các thư mục con vừa bị xoá
 */
export function xoaCacheDuLieu(gocNext) {
  const goc_cache = resolve(gocNext, "cache");
  if (!existsSync(goc_cache)) return [];
  const da_xoa = [];
  for (const ten of THU_MUC_CACHE_DU_LIEU) {
    const duong_dan = resolve(goc_cache, ten);
    // `basename` chặn một `..` lọt vào danh sách và biến bước dọn dẹp thành bước xoá cây
    // nguồn. Danh sách là hằng trong chính file này, nên hôm nay nó không thể bẩn — phép
    // kiểm ở đây là để câu ấy còn đúng sau khi ai đó cho danh sách đọc từ biến môi trường.
    if (basename(duong_dan) !== ten) {
      throw new Error(`Tên thư mục cache không hợp lệ: ${JSON.stringify(ten)}`);
    }
    if (!existsSync(duong_dan)) continue;
    rmSync(duong_dan, { recursive: true, force: true });
    da_xoa.push(ten);
  }
  return da_xoa;
}

// Chạy trực tiếp (không phải `import`) thì làm việc và nói ra mình đã làm gì. Im lặng ở
// đây là tệ: bước này nằm giữa một lệnh build dài, và người đọc log cần thấy nó có chạy.
if (process.argv[1] !== undefined
  && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const goc = resolve(process.argv[2] ?? ".next");
  const da_xoa = xoaCacheDuLieu(goc);
  console.log(
    da_xoa.length === 0
      ? `[cache dữ liệu] ${goc}: không có gì để xoá.`
      : `[cache dữ liệu] ${goc}: đã xoá ${da_xoa.join(", ")}.`,
  );
}
