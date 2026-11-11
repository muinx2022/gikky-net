import { docCacSub, docFeed, docFeedSub } from "@/lib/api";

import { VoKhungHaiCot } from "./khung-hai-cot-vo";
import { Sidebar } from "./sidebar";

/** Khung **hai cột dùng chung** cho mọi trang nội dung — user chốt 2026-08-24, thống nhất
 * thành hai cột (nội dung + rail phải, không cột trái) 2026-11-10.
 *
 * ## Vì sao nó tồn tại: chuyển trang bị "nhảy nhót"
 *
 * Tới hôm ấy mỗi trang tự khai bề rộng: trang chủ và trang sub `1060px` **hai cột**, trang
 * mạch và hồ sơ `860px` **một cột**, tìm kiếm `760px`. Ba con số ⇒ cột nội dung **nhảy
 * ngang** ở mỗi lần điều hướng, và cái rail phải thì lúc có lúc không. Đó là thứ user gọi
 * là "nhảy nhót", và nó không sửa được bằng cách chỉnh từng trang một — chỉnh xong vẫn là
 * ba nguồn sự thật, chỉ khác là chúng trùng nhau *hôm nay*.
 *
 * Nên: **một** chỗ khai bề rộng + lưới (`khung-hai-cot.module.css`, bọc bởi
 * `VoKhungHaiCot`), mọi trang đi qua nó. `Feed` (trang chủ, trang sub) và các trang tự dựng
 * sidebar (`/`, `/chu-de`) dùng thẳng `VoKhungHaiCot` vì họ đã có sẵn dữ liệu sidebar; file này
 * là đường cho các trang CHƯA có — nó tự nạp rồi đưa vào cùng một vỏ.
 *
 * ## Nó tự hỏi `GET /subs` và `GET /feeds/moi` (hoặc feed theo sub)
 *
 * `Sidebar` cần danh sách chuyên mục và các bài mới nhất (hoặc bài mới cùng chuyên mục).
 * Bắt mỗi trang tự nạp rồi truyền xuống là nhiều chỗ cùng làm một việc. Lời gọi đi song song
 * và `docCacSub` đi qua data cache của Next nên chi phí gần như không tốn gì — và **cấm gõ cứng
 * slug** ở đây, đúng nợ `NAV-GHI-CUNG`.
 *
 * ## `<main>` nằm trong vỏ, không ở trang con
 *
 * Bọc thêm một lớp nữa là `<main>` lồng `<main>` — HTML sai và trình đọc màn hình mất mốc
 * điều hướng. Nên trang con trả về **nội dung trần**, `VoKhungHaiCot` lo thẻ `<main>`.
 */
export async function KhungHaiCot({
  children,
  idMachHienTai,
  subSlug,
}: {
  children: React.ReactNode;
  idMachHienTai?: number;
  subSlug?: string;
}) {
  const [cac_sub, feed] = await Promise.all([
    docCacSub(),
    subSlug
      ? docFeedSub(subSlug, "moi", { limit: 6 })
      : docFeed("moi", { limit: 6 }),
  ]);
  const items = feed.du_lieu?.items ?? [];
  const bai_moi = items
    .filter((m) => m.id !== idMachHienTai)
    .slice(0, 5);
  const tieu_de = subSlug ? "Cùng chuyên mục" : "Bài mới nhất";

  return (
    <VoKhungHaiCot
      sidebar={<Sidebar cacSub={cac_sub} baiMoi={bai_moi} tieuDeBaiMoi={tieu_de} />}
    >
      {children}
    </VoKhungHaiCot>
  );
}
