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
  (`bai_hoc`). Mở lại: hộp xác nhận, nói rõ tổng kết BỊ XOÁ (sửa 2026-11-13: plan gốc ghi "được giữ" là sai — `core/ghi.py::mo_lai` cố ý xoá `ket_qua`/`bai_hoc`, bản cũ lưu ở `AuditLog.meta`, quyết định của plan `2026-11-10-truong-loai-mach.md` vòng sửa 1, sổ `P-20261110-2`).
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
| C3 | Đóng / mở lại | Staff đóng ⇒ `status=closed`, `ket_qua`/`bai_hoc` lưu, có AuditLog; mở lại xoá `ket_qua`/`bai_hoc` và AuditLog giữ bản cũ; mạch `nhat_ky` ⇒ 400; user thường ⇒ 403 |
| C4 | Lọc loại ở `/machs` | Chọn "Chủ đề" ⇒ request mang `loai_mach=thao_luan`, bảng chỉ còn chủ đề |
| C5 | Menu | Hai mục mới có trang thật; `quan-tri-giao-dien.spec.ts` xanh không nới |
| D1 | Ô "Hôm nay" | Đóng băng 08:30 VN thứ Sáu, có khung đêm qua: đêm qua = đã đăng, trước phiên VN = chưa (chưa quá hạn), trước phiên Mỹ = chưa; 09:30 ⇒ trước phiên VN đỏ; thứ Bảy ⇒ "Không có lịch" |
| D2 | Sửa khung | HTML có `<script>` bị lọc; figures sai dạng ⇒ 400; AuditLog có bản trước / sau |
| D3 | Ẩn | Ẩn ⇒ `/s/tin-tuc/<ngay>` 404, biến khỏi `liet_ke_ban_tin` và dải trang chủ; hiện lại ⇒ quay về |
| D4 | Xoá khung | Khung biến khỏi trang công khai; khung khác còn nguyên |
| G | Bộ chung | `pnpm lint` 0 warning · `pnpm build` · `pnpm test` · `pnpm e2e:don-vi` · `pnpm codegen:check` xanh |

## Báo cáo thực thi

### Đợt C (2026-11-13, opus-dev, chưa commit)

Nền: HEAD `8361f18`, cây có sẵn đợt B việc 20 chưa commit (không đụng). `pnpm e2e:don-vi` 781 xanh; `pnpm test`
17 đỏ sẵn (đúng danh sách P-20261113-9). Không migration.

**File mới:** `api/api/quan_tri_chu_de.py` (router: `quan_tri_liet_ke_chu_de`, `quan_tri_dong_chu_de`,
`quan_tri_mo_lai_chu_de`), `api/tests/test_api_quan_tri_chu_de.py` (14 bài), `apps/admin/app/chu-de/page.tsx`,
`apps/admin/lib/chu-de.ts`, `apps/web/e2e/don-vi/quan-tri-chu-de.spec.ts` (11 bài).
**File sửa:** `api/api/quan_tri.py` (mount), `api/tests/_quan_tri.py` (3 dòng bảng phân quyền),
`apps/admin/components/khung/menu.ts` (nhóm "Nội dung" + "Chủ đề tuần"), `apps/admin/app/machs/page.tsx` (ô lọc
"Loại" + cột "Loại"), `apps/admin/lib/loai-mach.ts` (`NHAN_LOAI_MACH`, `docLocLoaiMach`, kiểu suy từ type sinh ra),
`apps/admin/app/nhat-ky/page.tsx` (gợi ý `dong_so_chu_de` / `mo_lai_chu_de`), `packages/api-client/**` (sinh ra),
`apps/admin/components/form-dang-bai.tsx` (prop `loai_mach_ban_dau`, mặc định `""`),
`apps/web/e2e/don-vi/loai-mach-quan-tri.spec.ts` (ngoại lệ phiên chính cho phép: hàng rào mặc định prop + đếm chỗ gọi).

**Quyết định tự chốt:**
- Đường API theo prefix thật của NinjaAPI admin: `/api/admin/chu-de` (plan ghi `/quan-tri/chu-de`).
- "Đang trên trang chủ" = `api/feeds.py::_mach_hien(loai_mach=thao_luan)` sắp `-last_content_at` cắt 5, rồi chọn
  `published_at` lớn nhất (hoà ⇒ id) — đúng hai bước `docFeedChuDe` + `chonChuDeNoi`. Hằng 5 nhân bản
  `SO_CHU_DE_TAI` của web; bài C1 so với chính endpoint feed công khai.
- "Tuần này / tuần sau có chủ đề" = mạch `thao_luan`, không bị MOD ẩn (`hidden_by` null), không lưu trữ, không
  riêng tư, `published_at` trong `[T2 00:00, T2 kế 00:00)` giờ VN; bài chờ giờ hẹn tính là "có".
- Mạch bị khoá ⇒ 409 `mach_bi_khoa` (không 403 như cửa công khai — 403 ở khu quản trị là "không phải mod").
  Hạn 7 ngày mở lại giữ nguyên như cửa công khai; server trả `co_the_mo_lai` để UI ẩn nút.
- Bảng một trang, trần 200 hàng + `tong` (chủ đề một cái/tuần), không cursor.

**Hai điểm từng lệch, phiên chính đã quyết:**
1. **Mở lại xoá tổng kết** — giữ: gọi đúng `core/ghi.py::mo_lai` (xoá `ket_qua` + `bai_hoc`, chốt từ plan
   `2026-11-10-truong-loai-mach.md` vòng sửa 1, P-20261110-2); bản cũ ở `AuditLog.meta.bai_hoc_cu`; hộp xác nhận nói
   rõ. §3.1 / C3 của plan này đã sửa theo.
2. **Đặt sẵn loại cho "Tạo chủ đề"** — đã làm: `FormDangBai` thêm prop `loai_mach_ban_dau` (mặc định `""`,
   `form-dang-bai.tsx:50`, state `:68`); chỉ `app/chu-de/page.tsx:288` truyền `"thao_luan"`. Hàng rào
   `loai-mach-quan-tri.spec.ts:61` ghim mặc định `""` + state lấy từ prop (một `useState` loại duy nhất); bài mới
   `:81` quét mọi `<FormDangBai … />` của `apps/admin` (≥3 chỗ gọi, chống rỗng) và đòi chỉ `/chu-de` có prop, giá
   trị `thao_luan`. Bài `quan-tri-chu-de.spec.ts:139`: ô "Tuần sau" → `onTao` → ngăn kéo `mo_tao` → form có
   `loai_mach_ban_dau="thao_luan"`.

**Bài đo:**
- C1, C2, C3: `pnpm test -- tests/test_api_quan_tri_chu_de.py` ⇒ 14 passed.
- C4: `pnpm e2e:don-vi -g "C4"` (hàm thuần + request thật của client sinh ra với `fetch` giả mang
  `loai_mach=thao_luan` + nguồn trang); bảng chỉ còn chủ đề: pytest có sẵn
  `test_api_quan_tri_bang_loai_mach.py::test_loc_loai_mach_dung_tung_loai`. Chạy trình duyệt thật trên `gikky_e2e`:
  chọn "Chủ đề" ⇒ request `GET /api/admin/machs?q=&trang_thai=chua_go&loai_mach=thao_luan&limit=25`, cột Loại chỉ
  "Chủ đề" (6 hàng).
- C5: `pnpm e2e:don-vi -g "C5|MENU"`; `quan-tri-giao-dien.spec.ts` không nới.
- G: `pnpm lint` 0 warning · `pnpm build` exit 0 · `pnpm codegen:check` khớp · `pnpm e2e:don-vi` 793 passed
  (781 + 12) · `pnpm test`: 17 đỏ, tập đỏ BẰNG ĐÚNG tập nền (so `diff` từng tên); thu 2792 bài = nền 2778 + 14 mới.
- Trình duyệt thật (Django 8000 + `next start` 3001 trên `gikky_e2e`, phiên staff tạo tay rồi xoá): đóng một chủ
  đề qua ngăn kéo ⇒ hàng thành "đã đóng" + nút "Mở lại"; mở lại qua hộp xác nhận ⇒ "đang mở" + nút "Đóng"; 0 lỗi
  console; 0 px cuộn ngang trang ở 1280 và 390. Dữ liệu chụp ảnh (3 mạch, 4 AuditLog, 1 user, 1 session) đã xoá.

**Thử phá:** bỏ cắt 5 ứng viên ⇒ `test_c1_chu_de_moi_xuat_ban_nhat_bi_day...` đỏ · tính tuần theo UTC ⇒ 3 bài C2
đỏ · bỏ `boi=` ⇒ bài audit đỏ · bỏ `lam_moi_mach` khi đóng ⇒ 3 bài C3 đỏ · bỏ kiểm loại mạch ⇒ bài 400 đỏ · tuần
tính cả bài bị mod ẩn ⇒ `test_c2_chu_de_bi_mod_an...` đỏ · `docLocLoaiMach` luôn null ⇒ 2 bài C4 đỏ · trang
`/machs` bỏ `loai_mach` khỏi query ⇒ bài nguồn C4 đỏ · bỏ mục menu ⇒ C5 đỏ · mục menu trỏ trang không có ⇒ C5 +
`MENU — mọi mục sidebar…` đỏ · `nutChuDe` bỏ `da_khoa` ⇒ bài nút đỏ · mặc định prop `loai_mach_ban_dau` đổi sang `"thao_luan"` ⇒
`loai-mach-quan-tri.spec.ts:61` đỏ · `/chu-de` không truyền prop ⇒ `loai-mach-quan-tri.spec.ts:81` +
`quan-tri-chu-de.spec.ts:139` đỏ · `/machs/moi` truyền prop ⇒ `loai-mach-quan-tri.spec.ts:81` đỏ. Mọi file khôi phục.

#### Vòng sửa 1 (2026-11-13, sau phản biện)

1. **VỪA · đua đóng / mở lại.** Kiểm lại DƯỚI khoá ở hàm lõi: `api/core/ghi.py:1323` lớp mới `SoDaDoiTrangThai`
   (theo nếp `QuaNhieuAnh` / `KhongTheGoAnHenGio`: lỗi của core, tầng API dịch); `dong_so` ném khi hàng đã `closed`
   (`:1364`), `mo_lai` ném khi hàng không `closed` (`:1412`, cùng mẫu kiểm-rồi-mới-khoá). Dịch thành 409
   `mach_da_dong` / `mach_dang_mo` ở cả cửa công khai (`api/api/machs.py:964`, `:1061`) lẫn cửa quản trị
   (`api/api/quan_tri_chu_de.py:304`, `:337`). Bài đua thật (`transaction=True`, hai luồng; một `Barrier` chèn
   giữa phép kiểm của API và lời gọi hàm lõi để đua CHẮC xảy ra): `test_dua_hai_mod_cung_dong_chu_de_qua_cua_quan_tri`,
   `..._qua_cua_cong_khai`, `test_dua_hai_mod_cung_mo_lai_chu_de` — đúng một 200 + một 409, tổng kết của lượt thắng,
   đúng một dòng audit.
2. **NHỎ · nút trên hàng bị ẩn / hẹn giờ.** `apps/admin/lib/chu-de.ts:70` xét `bi_an` / `hen_gio` trước cờ server.
   Server: `_co_the_mo_lai` trả `False` khi `hidden_at` có (`quan_tri_chu_de.py:171`); `_nap_chu_de` trả 409
   `chu_de_dang_an` (`:69`, `:268`) cho bài bị ẩn / chờ giờ hẹn. Bài: `test_c3_chu_de_hen_gio_hay_bi_an_thi_409...`
   (đóng bài hẹn giờ ⇒ 409, mở lại bài bị ẩn ⇒ 409, `co_the_mo_lai=false`); don-vi "vòng sửa 1 › hàng bị ẩn / hẹn giờ".
3. **NHỎ · bài lưu trữ rỗng.** `test_c2_chu_de_bi_mod_an_hay_luu_tru...` thêm một chủ đề tuần sau đã lưu trữ, hẹn
   muộn hơn bài bị ẩn (là ứng viên đầu nếu bộ lọc rơi mất); ô "Tuần sau" vẫn rỗng.
4. **NHỎ · đóng ngăn kéo tạo không nạp lại.** `apps/admin/app/chu-de/page.tsx:305` `dong` = `dongNganTao(); void nap();`
   (chủ đề đăng ngay không gọi `onThanhCong`). Bài nguồn don-vi "đóng ngăn kéo tạo chủ đề cũng nạp lại trang".
5. **NHỎ · câu chữ hộp mở lại.** `apps/admin/lib/chu-de.ts:80` `soPhanTongKetKhiMoLai(tac_gia, mod)`;
   `page.tsx:244` dùng `useQuanTri().mod.username`: tác giả là mod đang đăng nhập ⇒ "tổng kết sẽ mất hẳn, không có bản
   lưu"; khác ⇒ bản cũ ở Nhật ký (`mo_lai_chu_de`). Logic lõi không đổi.

**Thử phá (mọi file khôi phục, `cmp` khớp):** bỏ kiểm lại trong `dong_so` ⇒ 2 bài đua đóng đỏ · bỏ trong `mo_lai` ⇒
bài đua mở lại đỏ · bỏ `archived_at__isnull=True` ⇒ bài lưu trữ đỏ · bỏ 409 ẩn / hẹn giờ ⇒ bài 409 đỏ · bỏ
`hidden_at` khỏi `_co_the_mo_lai` ⇒ bài 409 đỏ (vế `co_the_mo_lai`) · `nutChuDe` bỏ dòng chặn ẩn / hẹn giờ ⇒ bài
don-vi đỏ · đóng ngăn kéo không `nap()` ⇒ bài nguồn đỏ · `soPhanTongKetKhiMoLai` luôn "lưu nhật ký" ⇒ bài đỏ.

**Con số:** `pnpm test` (đầy đủ, không `-q`): `17 failed, 2753 passed, 26 skipped` — tập đỏ bằng đúng 17 bài nền
(`diff` từng tên); 2753 = 2735 + 18 bài của `test_api_quan_tri_chu_de.py`. `pnpm codegen:check` khớp (không đổi
schema). `pnpm lint` 0 warning. `pnpm e2e:don-vi` 796 passed (781 + 15). `pnpm build` exit 0 (cổng 3000/3001 trống
trước khi build).

### Báo cáo thực thi — Đợt D (2026-11-13, opus-dev, chưa commit)

Nền: HEAD `28e3ede`; migration mới nhất `0048_ban_tin.py`, **không thêm migration** (chỉ thêm hằng). `pnpm e2e:don-vi`
nền 796. ⚠ Lượt chạy `pnpm test` "nền" bị bẩn (chạy chồng lúc đã mount router mới, và một phiên khác đang làm việc
"nhật ký đang bàn" trong CÙNG checkout: `api/api/feeds.py`, `schemas.py`, `seed_e2e.py`, `apps/web/app/page.tsx`,
`lib/api.ts`, `test_api_so_query.py`, `test_operation_id.py`…) ⇒ tập đỏ được so với danh sách 17 bài của
`P-20261113-9`.

**File mới:** `api/api/quan_tri_ban_tin.py` (7 endpoint), `api/tests/test_api_quan_tri_ban_tin.py` (28 bài),
`apps/admin/app/ban-tin/page.tsx`, `apps/admin/app/ban-tin/[ngay]/page.tsx`, `apps/admin/lib/ban-tin.ts`,
`apps/web/e2e/don-vi/quan-tri-ban-tin.spec.ts` (18 bài).
**File sửa:** `api/core/models/ban_tin.py` (`HAN_CHOT_KHUNG`, `THU_CO_LICH_BAN_TIN`), `api/core/ghi_ban_tin.py`
(`sua_tieu_de_ban_tin`, `sua_khung_ban_tin`, `xoa_khung_ban_tin`, `KhongCoKhung`, `KhungCuoiCung`), `api/core/ghi.py`
(`dat_an_ban_tin`, 5 hằng `AUDIT_*_BAN_TIN`, `DICH_BAN_TIN`), `api/api/quan_tri.py` (mount), `api/tests/_quan_tri.py`
(7 dòng bảng quyền), `api/tests/test_tim_kiem_cau_truc.py` (1 dòng `BANG_DONG_BO`), `apps/admin/components/khung/menu.ts`
(mục "Bản tin"), `apps/admin/app/page.tsx` (thẻ "Bản tin hôm nay"), `apps/admin/app/nhat-ky/page.tsx` (5 gợi ý),
`apps/admin/components/form-sua-moc.tsx` (`export` `OFigures` + `Figure`), `apps/admin/components/soan-thao-quan-tri.tsx`
(prop `xemTruoc`), `apps/web/e2e/don-vi/quan-tri-chu-de.spec.ts` (C5: menu nay có 2 mục), `packages/api-client/**`.

**Quyết định tự chốt:**
- Đường API theo prefix admin: `GET /api/admin/ban-tin`, `GET|PATCH /ban-tin/{ngay}`, `PATCH|DELETE
  /ban-tin/{ngay}/khung/{khung}`, `POST /ban-tin/{ngay}/an|hien`. Mọi cửa mở cho mọi mod (`is_staff`), như `/chu-de`.
- Hạn chót khai một lần: `core/models/ban_tin.py::HAN_CHOT_KHUNG` (07:00 / 09:00 / 21:00) + `THU_CO_LICH_BAN_TIN` (T2–T6,
  theo cron `1-5` của README). API trả `han_chot` dạng `HH:MM` và `trang_thai` ∈ `da_dang | khong_lich | qua_han | chua`;
  admin không gõ giờ nào (bài don-vi quét cả `apps/admin`). "Quá hạn" so như bot `quaHanChot`: phút VN `>` phút hạn chót.
  Bot có khai hạn chót ở chỗ đọc được (`scripts/tin-tuc/lib.mjs::SLOT.han_chot` + `KHUNG_THEO_SLOT`): pytest đọc dạng chữ
  cả `lib.mjs` lẫn hai bảng của `README.md`, không sửa `scripts/**`.
- **Ẩn / hiện nằm ở `core/ghi.py`**, không ở `ghi_ban_tin.py`: hàng rào `test_tim_kiem_cau_truc.py::test_khong_ai_ghi_luat_che_ngoai_ghi_py`
  cấm ghi `hidden_at` ngoài `core/ghi.py`. Không nới allowlist; thêm `dat_an_ban_tin` vào `BANG_DONG_BO` nhãn KHONG
  (`BanTin` không có trong index tìm kiếm). Hằng `AUDIT_*_BAN_TIN` vì thế cũng ở `core/ghi.py`.
- AuditLog: `target_type="ban_tin"`, `target_id` = pk; `meta.ngay` + `meta.truoc` / `meta.sau` (tiêu đề; thân + figures;
  `hidden_at`; khung bị xoá mang `body`, `figures`, `created_at`, `sau=null`). Không đổi gì ⇒ 200, không ghi.
- Khoá: `BanTin` FOR UPDATE → hàng `BanTinKhung` FOR UPDATE/DELETE → INSERT `AuditLog`. Không chạm `Mach`.
- `cap_nhat_luc`: sửa khung KHÔNG đổi (định nghĩa việc 20 §3.1 = `created_at` khung mới nhất); xoá khung mới nhất ⇒ lùi về
  `created_at` của khung mới nhất còn lại; xoá khung khác ⇒ giữ.
- **Xoá khung cuối cùng ⇒ 409 `khung_cuoi_cung`** (UI khoá nút, chú thích "ẩn cả bản tin thay vì xoá"): bản tin rỗng sẽ là
  trang công khai chỉ có tiêu đề.
- **Không gọi revalidate**: đo được `/s/tin-tuc/<ngày>`, `/s/tin-tuc`, `/` đều `force-dynamic`, `docBanTin` /
  `docDanhSachBanTin` đi `CHUNG` (`no-store`); cửa `/lam-moi-cache` chỉ nhận `/m/…`. Bài don-vi ghim giả định đó.
- Xem trước HTML = `SoanThaoQuanTri` chỉ đọc (prop `xemTruoc`, ẩn thanh công cụ, `editable=false`), không
  `dangerouslySetInnerHTML`. Ô dải số dùng lại `OFigures` của `form-sua-moc.tsx` (chỉ thêm `export`). Thân khung không cho
  chèn ảnh (`choPhepAnh={false}`).
- `SuaKhungBanTinIn` thay TRỌN thân + figures (`figures=[]`/`null` ⇒ bỏ bảng số); trần độ dài = `DAI_BODY_MOC`, figures
  qua `FigureIn` (schema) + `kiem_figures` (≤6 cặp) như đường đăng.
- Thẻ "Bản tin hôm nay" ở `/` tự gọi `GET /admin/ban-tin?limit=1` (ngoại lệ duy nhất của "mọi số từ `/thong-ke`"), đỏ khi
  có khung quá hạn; lưới KPI đổi `xl:grid-cols-4` → `lg:grid-cols-3 xl:grid-cols-5`.

**Bài đo:**
- D1: `pnpm test -- tests/test_api_quan_tri_ban_tin.py -k d1` — T6 08:30 (đêm qua đã đăng lúc 06:10, hai khung kia
  "chua"), 09:30 (trước phiên VN `qua_han`), biên 09:00:59 / 09:01, thứ Bảy `khong_lich`, 23:30 UTC thứ Năm = thứ Sáu VN,
  bản tin hôm nay bị ẩn; cộng `test_han_chot_KHOP_voi_bot_trong_lib_mjs` + `..._README`.
- D2: `<script>` bị lọc + AuditLog trước/sau; thân chỉ thẻ bị chặn ⇒ 400 không ghi; figures sai dạng (ô >24, ô rỗng, 7 cặp,
  thiếu trường) ⇒ 400 không ghi; quá `DAI_BODY_MOC` ⇒ 400; không đổi ⇒ không audit.
- D3: ẩn ⇒ `GET /api/v1/ban-tin/<ngày>` 404 + rơi khỏi `liet_ke_ban_tin` (nguồn của dải trang chủ), ẩn lần hai không thêm
  nhật ký, admin vẫn đọc được; hiện lại ⇒ quay về.
- D4: xoá trước phiên VN ⇒ cửa công khai còn đúng hai khung kia, nguyên vẹn từng trường; khung mới nhất ⇒ `cap_nhat_luc`
  lùi; khung cuối ⇒ 409; khung không có ⇒ 404.
- Phân quyền: 7 dòng mới ở `tests/_quan_tri.py` (khách 401, user thường 403, mod qua) — xanh.
- Don-vi: `pnpm e2e:don-vi quan-tri-ban-tin` 18 bài (hàm thuần, request thật của client sinh ra, nguồn trang, hàng rào
  "không gõ giờ hạn chót", "không chèn HTML thô", thẻ bảng điều khiển, gợi ý nhật ký khớp `core/ghi.py`, ba trang công khai
  `force-dynamic` + `no-store`).
- Trình duyệt thật (Django 8000 + `next start` admin 3001 trên `gikky_e2e`, staff + session + bản tin hôm nay tạo tạm): ô
  "Hôm nay" lúc ~16:30 VN = đêm qua đã đăng 06:14 / trước phiên VN quá hạn (đỏ) / trước phiên Mỹ chưa (xám); 0 lỗi console;
  0 px cuộn ngang ở 1280 và 390. Bấm Ẩn ⇒ `/api/v1/ban-tin/<ngày>` 404, Hiện lại ⇒ 200; sửa tiêu đề; sửa thân qua Tiptap
  ⇒ thân công khai đổi. Dữ liệu tạm (1 user, 1 session, 1 bản tin, 4 AuditLog) đã xoá; `gikky_e2e` về 4 bản tin seed.

**Thử phá (mọi file khôi phục, so byte):** Python — hạn chót đêm qua 07:30 ⇒ 3 bài đỏ (hai bài KHOP + D1 08:30) · `>` thành
`>=` ⇒ bài biên đỏ · bỏ đổi sang giờ VN ⇒ bài UTC đỏ · bỏ nhánh `khong_lich` ⇒ bài thứ Bảy đỏ · bỏ `kiem_figures` +
`lam_sach` ở sửa khung ⇒ 3 bài D2 đỏ · bỏ audit sửa khung ⇒ 2 bài đỏ · ẩn không lưu `hidden_at` ⇒ D3 đỏ · xoá cả bản tin
thay vì một khung ⇒ D4 đỏ · bỏ lùi `cap_nhat_luc` ⇒ bài khung mới nhất đỏ · bỏ chặn khung cuối ⇒ bài 409 đỏ · bảng lọc bỏ
bản ẩn ⇒ bài bảng đỏ · bỏ phép "không đổi ⇒ không ghi" ⇒ bài không-audit đỏ. Admin — "quá hạn" tông xám ⇒ đỏ · bỏ thẻ
bảng điều khiển ⇒ đỏ · bỏ mục menu ⇒ 2 bài đỏ (kể cả C5) · gõ `"09:00"` vào `lib/ban-tin.ts` ⇒ đỏ · hộp xoá bỏ chữ "không
hoàn tác" ⇒ đỏ · bỏ gợi ý `xoa_khung_ban_tin` ⇒ đỏ · `khungDaDoi` bỏ chuẩn hoá ⇒ đỏ · xem trước sửa được ⇒ đỏ · trang không
đọc `hom_nay` từ server ⇒ đỏ · nhãn ngày qua múi giờ máy ⇒ đỏ. **Không phá** bài "ba trang công khai force-dynamic"
(đòi sửa `apps/web/app/**` — ngoài phạm vi, và phiên khác đang sửa `app/page.tsx`).

**Con số:** `pnpm test` (đầy đủ, không `-q`): `17 failed, 2804 passed, 26 skipped` — tập đỏ đúng 17 bài của
`P-20261113-9`; 2804 = 2753 + 28 (đợt này) + 21 (`test_api_nhat_ky_dang_ban.py` của phiên khác) + 2 (phiên khác).
`pnpm e2e:don-vi` 819 passed = 796 + 18 (đợt này) + 5 (`nhat-ky-dang-ban.spec.ts` của phiên khác). `pnpm codegen:check`
khớp. `pnpm lint` 0 warning; `tsc --noEmit` admin sạch. `pnpm build` exit 0 (cổng 3000/3001/8000 trống lúc build).
⚠ `packages/api-client/openapi.json` + `src/**` (client v1) đổi theo endpoint `/feeds/nhat-ky-dang-ban` của phiên khác —
codegen sinh từ cả cây; commit phải tách cho đúng việc.

#### Đợt D — Vòng sửa 1 (2026-11-13, sau phản biện)

1. **NẶNG · Tiptap làm hỏng cấu trúc bản tin.**
   - (a) Bộ extension tách ra `apps/admin/lib/tiptap-quan-tri.ts::phanMoRongQuanTri` (MỘT chỗ, dùng cho cả
     `components/soan-thao-quan-tri.tsx:136` lẫn bài đo); BỎ `horizontalRule: false` + `codeBlock: false`, chú thích sửa
     cho đúng `lam_sach_html.py::THE_CHO_PHEP` (có `hr`, `pre`) và ghi rõ chiều mất dữ liệu. Vá luôn trang sửa MỐC
     (`form-sua-moc.tsx` dùng chung component) — mốc KHÔNG đi qua bước chuẩn hoá (b). `SoanThaoQuanTri` thêm
     `onTaoXong` (`:141`, sự kiện `create` của Tiptap).
   - (b) `apps/admin/lib/ban-tin.ts:93` `chuanHoaThanBanTin`: `<li><p>x</p></li>` → `<li>x</li>` chỉ khi `li` có đúng
     một `<p>` con (mục có danh sách con giữ nguyên), bỏ `<p></p>` ở CUỐI (giữa thân giữ). Gọi ở đường lưu
     `app/ban-tin/[ngay]/page.tsx:133`.
   - "Gõ rồi xoá": trang so với HTML Tiptap lúc tạo (`body_goc` từ `onTaoXong`, `:122`, `:301`), `khungDaDoi` (`:113`)
     so trên bản chuẩn hoá của cả hai bên.
   - (c) Bài round-trip `apps/web/e2e/don-vi/quan-tri-ban-tin-tiptap.spec.ts` (5 bài) với thân THẬT của bot
     (`e2e/don-vi/mau/ban-tin-that-truoc-phien-my.html` — 5 `<hr>`, `…-truoc-phien-vn.html`, chép từ prod 13/11) + một
     mẫu dựng tay (`<pre>` nhiều dòng, `<ol>`, danh sách lồng). Chạy trong Chromium của Playwright qua helper
     `e2e/don-vi/tiptap-trinh-duyet.ts`: `page.route` trên origin giả, tự phân giải import trong `node_modules`,
     `typescript.transpileModule` cho file `.ts` của admin — dựng đúng `phanMoRongQuanTri()`, không chép cấu hình.
     **Lý do trình duyệt:** repo không có `jsdom`/`happy-dom`/`@tiptap/html` (thêm phụ thuộc là việc của phiên chính);
     vẫn không server / cổng / DB nên chạy được trong `pnpm e2e:don-vi`. Đo: số thẻ `hr/pre/h3/a/strong/ul/ol/li` trước
     = sau, không còn `li > p`, không `p` rỗng cuối; gõ rồi xoá ⇒ `khungDaDoi` = false. Kiểm thêm ngoài bộ (một lần,
     bằng `lam_sach` thật): hai thân lưu xong qua `lam_sach` ra đúng tập thẻ của thân gốc, 0 `li>p`.
   - Thử phá: tắt lại `horizontalRule` ⇒ 3 bài round-trip + bài nguồn đỏ · tắt `codeBlock` ⇒ bài mẫu tay + bài nguồn đỏ
     · `chuanHoaThanBanTin` trả nguyên ⇒ 4 bài đỏ · bỏ cắt `p` rỗng cuối ⇒ 2 bài đỏ · trang gửi `body_moi` chưa chuẩn hoá
     ⇒ bài nguồn đỏ · trang so với `k.body` thô ⇒ bài nguồn đỏ. **Xanh khi phá:** `khungDaDoi` bỏ chuẩn hoá hai bên — vì
     mốc so đã là HTML Tiptap (`onTaoXong`) nên hai bên vốn cùng dáng; phép chuẩn hoá ấy chỉ là lớp phòng thủ.
2. **NHỎ · Nạp lại đè tiêu đề đang gõ.** `lib/ban-tin.ts:77` `tieuDeSauKhiNap` (nạp đầu ⇒ lấy server; ô còn bằng tiêu
   đề lần nạp trước ⇒ lấy mới; khác ⇒ giữ chữ đang gõ); `[ngay]/page.tsx:83` dùng nó, ref `tieu_de_da_nap`. Bài thuần +
   bài nguồn. Thử phá: đặt lại `datTieuDe(data.title)` ⇒ bài nguồn đỏ; hàm luôn trả tiêu đề server ⇒ bài thuần đỏ.
3. **NHỎ · Xoá khung hôm nay thành "quá hạn".** `api/api/quan_tri_ban_tin.py:90` thêm `da_xoa` vào `Literal`; `:191`
   đọc `AuditLog` `xoa_khung_ban_tin` theo `target_id` = bản tin hôm nay VÀ `meta.ngay`; `:210` xét sau "đã đăng", trước
   "không lịch / quá hạn". Admin `lib/ban-tin.ts:23` `da_xoa` = "đã xoá", tông xám; thẻ bảng điều khiển chỉ đỏ khi
   `qua_han` (bài nguồn ghim). Pytest `test_d1_khung_hom_nay_bi_mod_xoa_la_da_xoa_khong_phai_qua_han` (có xoá cùng
   khung ở NGÀY KHÁC làm nhiễu; bot đăng lại ⇒ "đã đăng" thắng). Thử phá: bỏ nhánh `da_xoa` ⇒ đỏ; tông `xau` ⇒ bài
   don-vi đỏ; bỏ CẢ HAI bộ lọc `target_id` + `meta__ngay` ⇒ đỏ (bỏ từng cái một thì xanh — hai bộ lọc cùng chặn ca
   ngày khác, mỗi cái đủ một mình).
4. **NHỎ · Chú thích.** `apps/admin/app/nhat-ky/page.tsx:79` nay ghi hằng ở `api/core/ghi.py`; docstring
   `api/core/ghi_ban_tin.py:57` nói hiện lại ở khu quản trị; thêm: chú thích `hidden_at` của
   `core/models/ban_tin.py` (cùng chuyện cũ "chỉ qua Django admin"; chỉ chú thích, không sinh migration).

**Con số:** `pnpm test` đầy đủ: `17 failed, 2806 passed, 26 skipped` — tập đỏ đúng 17 bài `P-20261113-9`
(`test_api_quan_tri_ban_tin.py` nay 29 bài). `pnpm e2e:don-vi` 819 passed (bài của đợt này 28 = 23 + 5; tổng không cộng
thẳng được vì phiên việc 22 đã commit `696025a` và đang sửa thêm 5 spec don-vi khác). `pnpm codegen:check` khớp;
`pnpm lint` 0 warning; `tsc --noEmit` admin sạch; `pnpm build` exit 0 (cổng 3000/3001/8000 trống).