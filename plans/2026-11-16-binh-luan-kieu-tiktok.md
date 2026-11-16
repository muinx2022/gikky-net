# Bình luận trang mạch kiểu TikTok + ưu tiên thread của người đang đăng nhập

**Trạng thái:** ĐÃ LÊN PROD 0c24649 (2026-11-16 ~20:00), rồi c09d94b (sắp thread 3 bậc, ~20:25); cả hai lượt chỉ rebuild `web`. Nghiệm thu ĐẠT 21/23 (thiếu: nhìn tận
mắt trên trình duyệt). Phản biện bắt 1 NẶNG (deep-link vào reply trong đuôi gập không cuộn tới) +
2 NHẸ (reply nhảy giữa hai `<ul>` khi phiên về; "↪ trả lời @?") — đã sửa vòng 2, mỗi lớp sửa có bài
e2e đỏ khi gỡ. Don-vi 870/870; e2e `gikky_e2e` chỉ còn 3 bài đỏ có sẵn trên HEAD (P-20261116-4).

User (2026-11-16), ảnh gikky.net/m/dri-mua-vi-gia-cao-su-dang-tang-1254: *"hiển thị cmt theo kiểu
tiktok, ưu tiên cmt của user đang đăng nhập"*. Chốt qua câu hỏi:

- Kiểu reply: *"hiện tại chưa có nhiều cmt, nên hiển thị sao cho dễ nhìn thấy nhiều dữ liệu"* ⇒
  **2 tầng phẳng, MỞ SẴN**, chỉ gập phần đuôi khi một thread dài.
- Ưu tiên: **thread có tôi lên đầu** (gốc của tôi, hoặc thread có reply của tôi); trong thread, reply
  của tôi lên đầu.
- Phạm vi: **khu "Bình luận" chung + lát cắt ngăn kéo từng mốc** (cùng component `BinhLuan`).

## Bối cảnh đã đo

- Cây render ở `apps/web/components/binh-luan.tsx::BinhLuan` (server component, đệ quy, cắt ở
  `SAU_KHAN_DAI = 6` tầng — `lib/khan-dai.ts`). Dùng ở `khan-dai.tsx` (khu chung + `CauDangDoc` đang
  tắt) và `the-moc.tsx` (ngăn kéo).
- `BinhLuanOut` có `replies` (cây lồng), `depth`, `author`, `created_at`, `trang_thai`.
- Trang `/m/[slugId]` là **ISR** (`doc="isr"`): HTML cache chung cho mọi người ⇒ server KHÔNG biết ai
  đang xem. Ưu tiên theo người xem **phải làm phía client**: `usePhien()` (`components/phien.tsx`) trả
  `toi`.
- `lib/khan-dai.ts::idTrongTrang` / `idTrongTrangGop` tính tập id CÓ MẶT trên trang, cắt ở cùng
  `SAU_KHAN_DAI` với chỗ render (nợ B4). Đổi cách render thì hai chỗ phải khớp lại.
- Nội dung bình luận phải **luôn nằm trong HTML** (Google index mặt CẶN, xem docstring `GapNhanh`):
  gập = `hidden`, không phải không render.

## LÀM

### 1. Hai tầng phẳng

- Bình luận gốc (depth 0) render như nay.
- Mọi hậu duệ của nó (mọi tầng) dồn thành **một danh sách phẳng** ngay dưới gốc, thụt **một** bậc.
  Thứ tự: `created_at` tăng dần, hoà thì `id` tăng dần.
- Reply có cha **không phải** gốc ⇒ đầu thân hiện dòng nhỏ `↪ trả lời @<tên hiển thị của cha>`
  (cha là bia mộ thì `↪ trả lời [bình luận đã xoá]` / `[đã bị ẩn]`). Reply thẳng vào gốc thì không có
  dòng này.
- Không còn cắt theo độ sâu ở render ⇒ link "tiếp tục thread (N nhánh) →" không còn cần ở cây này.
  `idTrongTrang` / `idTrongTrangGop` phải khớp lại (mọi nút trong response đều có mặt trên trang).
  Giữ `SAU_*` nếu còn chỗ dùng khác, gỡ nếu chết hẳn.
- Hàm làm phẳng là **hàm thuần** trong `apps/web/lib/` (không React) để `e2e/don-vi` ghim được.
- Nút trả lời trên reply vẫn gửi `parent_id` = id reply đó (dữ liệu vẫn là cây, chỉ cách hiện là phẳng).

### 2. Mở sẵn, chỉ gập đuôi dài

- Thread ≤ 3 reply: hiện hết.
- Thread > 3 reply: hiện 3 cái đầu, còn lại sau nút `Xem thêm N câu trả lời ▾` (đuôi vẫn trong HTML,
  `hidden`); mở xong có `Ẩn bớt ▴`.
- `[−]/[+]` (`GapNhanh`) giữ ở bình luận gốc (gập cả thread). Reply phẳng không cần `[−]` riêng.
- `tu_gap` (điểm ≤ −5, `<details>`) giữ nguyên hành vi.

### 3. Ưu tiên thread của tôi (client)

- Một client component bọc danh sách thread (dùng ở cả khu chung lẫn ngăn kéo). Server truyền mỗi
  thread kèm tập username tham gia (tác giả gốc + mọi reply), children là node server dựng sẵn.
- Có `toi`: thread sắp 3 bậc, stable trong từng bậc — (1) thread có GỐC do `toi.username` viết;
  (2) thread `toi` chỉ tham gia bằng reply; (3) còn lại. Gốc bia mộ (author null) không tính là
  của tôi. Server truyền thêm tác giả gốc (`tacGiaGoc`) cho mỗi thread. Chưa đăng nhập / đang tải
  phiên: thứ tự server, không đổi gì.
- *2026-11-16, sửa sau prod:* bản đầu gộp (1) + (2) làm một nhóm "có tôi tham gia" giữ thứ tự
  server. User báo trên `/m/dri-mua-vi-gia-cao-su-dang-tang-1254`: thread #36 của Quản trị viên (có
  reply của user) đứng trên #50 là bình luận GỐC của user — *"nick của tôi lại xuống dưới"*.
- Trong một thread: reply của tôi lên đầu danh sách reply (stable), và **không bao giờ** nằm trong
  đuôi bị gập.
- Luật sắp là hàm thuần trong `lib/`, ghim bằng don-vi.
- Giới hạn chấp nhận: chỉ sắp trong trang đang nạp (50 thread); không đổi API.

### 4. Không đổi

- API, codegen, thanh sort Hay nhất/Mới nhất/Cũ nhất, composer, `HanhDongBinhLuan`, deep-link
  `#bl-<id>` (mỗi bình luận vẫn đúng một nút mang `id`/`data-binh-luan-id` ở cây chính).
- `apps/admin` không đụng.

## Kiểm

- `pnpm e2e:don-vi` xanh, có bài mới cho hàm làm phẳng (thứ tự, `↪ @cha`, bia mộ cha, nút mồ côi) và
  hàm sắp ưu tiên (stable, chưa đăng nhập không đổi, reply của tôi không vào đuôi gập).
- `pnpm lint`, `pnpm build` (build xong nhớ: PHÁ `next dev` đang chạy).
- Test e2e đang dựa vào cây lồng (`nut-gap-nhanh`, "tiếp tục thread") phải sửa theo hành vi mới,
  không xoá cho xanh.
- Nhìn thật trên trình duyệt: một mạch có reply nhiều tầng, đăng nhập và không đăng nhập.
