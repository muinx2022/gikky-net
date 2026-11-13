# Khu quản trị: quản lý bản tin + chủ đề thảo luận hàng tuần (việc 21)

> **Trạng thái:** ĐÃ LẬP PLAN 2026-11-13, **USER DUYỆT 2026-11-13** ("Duyệt cả hai", kèm phác thảo trình bày), chưa chạy. Nhánh `v2`. Sổ việc: `GHI-CHU.md` việc 21.
>
> **Phụ thuộc:** phần bản tin (§3.2) cần bảng `BanTin` của việc 20 (`plans/2026-11-13-ban-tin-bang-rieng.md`, đợt A)
> đã nghiệm thu. Phần chủ đề (§3.1) không phụ thuộc việc 20 và có thể chạy trước. Cả hai chờ việc 19 commit.

## 1. Yêu cầu

User, 2026-11-13: "việc mới, ngoài phần bảng tin, còn thêm phần chủ đề bình luận hàng tuần. bạn xem trong admin còn
thiếu phần quản lý nào thì lập plan xử lý luôn".

## 2. Hiện trạng `apps/admin` (đo 2026-11-13)

Menu (`components/khung/menu.ts`): Tổng quan (Bảng điều khiển, Lượt xem, GA) · Kiểm duyệt (Hàng đợi báo cáo,
**Bài viết** `/machs`, Bình luận, Nhật ký) · Cộng đồng (Người dùng, Quản trị viên, Chuyên mục) · Công cụ (Check FX) ·
Hệ thống (Cài đặt, Chẩn đoán).

| Việc quản lý | Có chưa | Ghi chú |
|---|---|---|
| Tạo chủ đề thảo luận | Có | Form đăng bài, ô "Loại mạch" = Chủ đề thảo luận; cảnh báo nếu đang có chủ đề mở (`lib/canh-bao-chu-de.ts`); hẹn giờ phát hành có sẵn |
| Xem danh sách chủ đề theo tuần | **Không** | `/machs` lẫn mọi loại; API `quan_tri_liet_ke_mach` có `?loai_mach=` nhưng UI không có ô lọc, bảng không có cột loại |
| Biết chủ đề nào đang lên trang chủ | **Không** | Trang chủ lấy chủ đề MỚI NHẤT (`docFeedChuDe`); admin không nói ra |
| Đóng chủ đề + viết tổng kết, mở lại | **Không ở admin** | API `dong_so_mach` / `mo_lai_mach` cho `is_staff` đóng / mở mạch `thao_luan` (có AuditLog), nhưng chỉ bấm được ở web công khai |
| Sửa câu hỏi / bối cảnh của chủ đề | Có | Trang `/m/[machId]` + `form-sua-moc` dùng chung |
| Xem bình luận của một chủ đề | Có, khó thấy | `/binh-luan?mach_id=` có, nhưng không có lối vào từ một danh sách chủ đề |
| Báo trước tuần sau chưa có chủ đề | **Không** | |
| Quản lý bản tin | **Không** | Hôm nay bản tin lẫn trong `/machs`. Sau việc 20 bản tin ra bảng riêng: admin không thấy nó nữa, chỉ còn Django admin |
| Biết bot bản tin hôm nay đã đăng khung nào | **Không** | Bot chạy lịch không ai nhìn; lỗi chỉ thấy khi thiếu bài |

## 3. Thiết kế

Menu thêm nhóm **"Nội dung"** đặt giữa "Tổng quan" và "Kiểm duyệt", hai mục: **Chủ đề tuần** `/chu-de` và
**Bản tin** `/ban-tin`. Mọi mục menu phải có trang thật (`quan-tri-giao-dien.spec.ts`). Tailwind + token trong
`@theme`, không màu ứng biến. Hook tên tiếng Việt vẫn mở đầu bằng `use`.

### 3.1 Trang "Chủ đề tuần" `/chu-de`

- **Dải trên cùng, ba ô trạng thái:**
  1. "Đang trên trang chủ": chủ đề mà trang chủ đang hiện, lấy bằng CÙNG truy vấn với feed chủ đề công khai (server
     trả, admin không tự đoán), kèm trạng thái mở / đóng, số bình luận, lượt xem.
  2. "Tuần này": tuần ISO theo giờ VN (thứ Hai → Chủ nhật) đã có chủ đề chưa.
  3. "Tuần sau": đã có chủ đề hẹn giờ phát hành trong tuần sau chưa. Chưa có ⇒ ô màu cảnh báo + nút "Tạo chủ đề tuần
     sau" (mở form đăng bài, đặt sẵn loại "Chủ đề thảo luận").
- **Bảng chủ đề**, mới → cũ, nhóm theo tuần: tuần (DD/MM–DD/MM), tiêu đề, trạng thái (đang mở / đã đóng / hẹn giờ /
  bị ẩn), số bình luận, lượt xem, ngày đóng. Mỗi hàng: link "Bình luận" → `/binh-luan?mach_id=`, "Sửa" →
  `/m/[machId]`, "Trang công khai", và **Đóng chủ đề** hoặc **Mở lại**.
- **Đóng chủ đề:** ngăn kéo (`ngan-keo.tsx`) có ô "Kết quả một dòng" (`ket_qua`, ≤ 40 ký tự) và ô "Tổng kết"
  (`bai_hoc`). Mở lại: hộp xác nhận, nói rõ tổng kết được giữ.
- **API (NinjaAPI admin, `api/api/quan_tri_chu_de.py` MỚI):**
  - `GET /quan-tri/chu-de` (`quan_tri_liet_ke_chu_de`): danh sách + ba ô trạng thái trong cùng một phản hồi.
  - `POST /quan-tri/chu-de/{id}/dong` (`quan_tri_dong_chu_de`) và `/mo-lai` (`quan_tri_mo_lai_chu_de`): gọi đúng hàm
    lõi mà `dong_so_mach` / `mo_lai_mach` đang gọi, cùng AuditLog, cùng `lam_moi_mach`. Không chép logic. Mạch không
    phải `thao_luan` ⇒ 400. Thứ tự khoá theo luật "`Mach` khoá sau cùng".
  - Quyền: như các trang quản trị khác (`is_staff`).
- `/machs`: thêm ô lọc "Loại" (Tất cả / Nhật ký / Bài viết / Chủ đề) và cột loại. Giá trị lấy từ type sinh ra, không gõ
  tay danh sách (theo nếp `Record<…>` của `lib/api.ts` web).

### 3.2 Trang "Bản tin" `/ban-tin` (sau việc 20 đợt A)

- **Dải trên cùng "Hôm nay":** ngày VN hôm nay và ba khung (Đêm qua / Trước phiên VN / Trước phiên Mỹ), mỗi khung:
  đã đăng lúc HH:mm, hoặc "chưa" (xám trước giờ hạn chót, đỏ sau hạn chót: 07:00 / 09:00 / 21:00, lấy từ một hằng
  dùng chung với `scripts/tin-tuc/README.md`, không gõ lại số ở hai nơi). Hôm nay là T7 / CN ⇒ "Không có lịch".
- **Bảng bản tin**, mới → cũ, cursor: ngày, tiêu đề, các khung đã có, lượt xem, trạng thái (hiện / đã ẩn), link trang
  công khai `/s/tin-tuc/<ngay>`.
- **Trang một bản tin `/ban-tin/[ngay]`:** sửa tiêu đề; mỗi khung xem trước HTML và sửa thân + bảng số liệu (dùng lại
  `soan-thao-quan-tri.tsx` và ô figures của `form-sua-moc.tsx` nếu tách ra được gọn, không thì báo); **ẩn / hiện**
  cả bản tin; **xoá một khung** (hộp xác nhận, ghi rõ không hoàn tác). Không có nút tạo bản tin tay: bản tin chỉ đến
  từ bot.
- **API (`api/api/quan_tri_ban_tin.py` MỚI):** `quan_tri_liet_ke_ban_tin` (kèm ô "Hôm nay"), `quan_tri_xem_ban_tin`,
  `quan_tri_sua_ban_tin` (tiêu đề), `quan_tri_sua_khung_ban_tin` (thân + figures, cùng bộ lọc HTML và validator như
  endpoint đăng), `quan_tri_an_ban_tin` / `quan_tri_hien_ban_tin`, `quan_tri_xoa_khung_ban_tin`. Mọi thao tác ghi
  AuditLog (nhật ký quản trị `/nhat-ky` hiện được: thêm nhãn cho các `action` mới). Sửa xong làm mới cache trang
  công khai theo cơ chế `lam_moi_*` đang có.
- Bảng điều khiển `/`: thêm một thẻ "Bản tin hôm nay" (số khung đã đăng / 3) dẫn tới `/ban-tin`.

### 3.3 Hợp đồng chung

- Mọi endpoint có `operation_id`; router mới gắn vào NinjaAPI admin sẵn có (không tạo NinjaAPI mới ⇒ không đụng
  registry / subpath). `pnpm codegen` sau khi sửa Django.

## 4. Phạm vi

**LÀM:** §3, chia hai đợt: **đợt C** = §3.1 (chủ đề, chạy được ngay sau việc 19); **đợt D** = §3.2 (bản tin, sau việc 20
đợt A). Chỉ `api/api/quan_tri_*`, `api/tests/`, `apps/admin/`, `packages/api-client` (sinh ra).

**KHÔNG LÀM:** không đổi luật chọn chủ đề trang chủ (vẫn là mới nhất); không chặn tạo chủ đề thứ hai; không đổi giao
diện `apps/web`; không cho tạo bản tin tay; không commit, không deploy, không ghi sổ.

## 5. Bài đo

| # | Tiêu chí | Cách đo → mong đợi |
|---|---|---|
| C1 | Ô "Đang trên trang chủ" | pytest: id trả về = id chủ đề mà feed chủ đề công khai trả, với seed có chủ đề đóng mới hơn chủ đề mở |
| C2 | Tuần này / tuần sau | pytest đóng băng giờ: CN 23:30 VN và T2 00:10 VN rơi đúng tuần; chủ đề hẹn giờ tuần sau ⇒ "tuần sau: có" |
| C3 | Đóng / mở lại | Staff đóng ⇒ `status=closed`, `ket_qua`/`bai_hoc` lưu, có AuditLog; mở lại giữ `bai_hoc`; mạch `nhat_ky` ⇒ 400; user thường ⇒ 403 |
| C4 | Lọc loại ở `/machs` | Chọn "Chủ đề" ⇒ request mang `loai_mach=thao_luan`, bảng chỉ còn chủ đề |
| C5 | Menu | Hai mục mới có trang thật; `quan-tri-giao-dien.spec.ts` xanh không nới |
| D1 | Ô "Hôm nay" | Đóng băng 08:30 VN thứ Sáu, có khung đêm qua: đêm qua = đã đăng, trước phiên VN = chưa (chưa quá hạn), trước phiên Mỹ = chưa; 09:30 ⇒ trước phiên VN đỏ; thứ Bảy ⇒ "Không có lịch" |
| D2 | Sửa khung | HTML có `<script>` bị lọc; figures sai dạng ⇒ 400; AuditLog có bản trước / sau |
| D3 | Ẩn | Ẩn ⇒ `/s/tin-tuc/<ngay>` 404, biến khỏi `liet_ke_ban_tin` và dải trang chủ; hiện lại ⇒ quay về |
| D4 | Xoá khung | Khung biến khỏi trang công khai; khung khác còn nguyên |
| G | Bộ chung | `pnpm lint` 0 warning · `pnpm build` · `pnpm test` · `pnpm e2e:don-vi` · `pnpm codegen:check` xanh |

## Báo cáo thực thi

*(điền sau)*
