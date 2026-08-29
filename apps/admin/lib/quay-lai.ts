/** Lọc `?tiep=` của trang đăng nhập quản trị — chống **open redirect**.
 *
 * ## Vì sao cần lọc
 *
 * Từ 2026-08-26, cổng `CongQuanTri` gặp 401 thì đẩy thẳng sang `/dang-nhap` và mang theo
 * chỗ người dùng đang đứng trong `?tiep=`, để đăng nhập xong quay về đúng trang ấy chứ
 * không rơi về `/`. Cái giá của tiện lợi đó: **`tiep` là dữ liệu do người ngoài đặt được**
 * — nó nằm trên URL, nên bất kỳ ai cũng soạn được một đường dẫn rồi gửi cho mod.
 *
 * Nhận thẳng là dựng một open redirect **mang thương hiệu gikky**: kẻ gian gửi
 * `https://quan-tri.gikky.net/dang-nhap?tiep=https://gikky.net.kẻ-gian/…`, mod nhìn thấy
 * đúng tên miền thật nên đăng nhập, rồi bị bắn sang trang kia — và trang kia dựng lại giao
 * diện gikky để xin mật khẩu **lần thứ hai**. Lần này người ta gõ, vì họ vừa gõ xong một
 * lần ở đúng nơi đáng tin.
 *
 * ## Luật: chỉ nhận đường dẫn NỘI BỘ, và im lặng khi từ chối
 *
 * Trả về `/` khi không hợp lệ, **không** báo lỗi: người dùng hợp lệ không làm gì sai (họ
 * bấm một link người khác gửi), còn kẻ gian thì không cần được thông báo là đã bị chặn.
 *
 * Ba ca từ chối, và cả ba đều từng là lỗ hổng thật ở đâu đó:
 *
 * 1. **`//kẻ-gian.example`** — protocol-relative. Bắt đầu bằng `/` nên một phép kiểm
 *    `startsWith("/")` đơn độc cho nó đi qua, mà trình duyệt hiểu nó là *host khác*.
 *    Đây là ca nguy hiểm nhất vì bản vá ngây thơ nhất trông như đã chặn nó.
 * 2. **`/\kẻ-gian.example`** — WHATWG URL coi `\` sau scheme y như `/`, nên trình duyệt
 *    đọc chuỗi này đúng bằng ca 1. Kiểm `//` mà quên `/\` là chỉ vá một nửa.
 * 3. **`https://…`, `javascript:…`, `http:/x`** — có scheme. Chúng không bắt đầu bằng `/`
 *    nên rơi ngay ở phép kiểm đầu; luật *"từ chối mọi chuỗi có `:` trước `/` đầu tiên"* đã
 *    nằm gọn trong đó, không cần một phép kiểm thứ hai dễ trôi.
 */
const NHA = "/";

export function duongDanQuayLai(tiep: string | null): string {
  if (tiep === null) return NHA;

  // Trình duyệt **xoá** tab / xuống dòng khỏi URL trước khi phân giải (WHATWG URL parser),
  // nên `"/\t/kẻ-gian"` tới nơi là `"//kẻ-gian"` — tức ca 1 ở trên, mặc dù chuỗi thô bắt
  // đầu bằng đúng một `/`. Lọc chuỗi CHƯA xoá là lọc một chuỗi khác với chuỗi trình duyệt
  // sẽ đi theo; nên xoá trước, kiểm sau, và trả về chính bản đã xoá.
  const sach = tiep.replace(/[\t\n\r]/g, "");

  if (!sach.startsWith("/")) return NHA;
  if (sach.startsWith("//") || sach.startsWith("/\\")) return NHA;

  // Từ chối chính trang đăng nhập. Không phải chuyện bảo mật — chuyện *thông điệp*.
  //
  // Ai cũng soạn được link `admin.gikky.net/dang-nhap?tiep=%2Fdang-nhap`. Mod gõ đúng mật
  // khẩu rồi bị đưa **trở lại form đăng nhập, ô trống** — tín hiệu mạnh nhất có thể của
  // "sai rồi, gõ lại đi". Gõ lại thì allauth trả 409 *"Bạn đang đăng nhập rồi."*, tức hai
  // câu mâu thuẫn nhau trong mười giây. Đúng hình dạng tâm lý mà cả file này sinh ra để
  // chống, chỉ khác là nó không rò rỉ gì.
  //
  // Cửa thứ hai không cần ai soạn link: `CongQuanTri` đọc `window.location` lúc `setLoi`
  // chạy, nên một lượt `/me` về muộn ngay sau khi người dùng tự gõ `/dang-nhap` sẽ tự sinh
  // ra `?tiep=/dang-nhap`. Chặn ở đây bịt cả hai.
  //
  // Lượt phản biện 2026-08-26 tìm ra.
  if (sach === "/dang-nhap" || sach.startsWith("/dang-nhap?")) return NHA;

  return sach;
}
