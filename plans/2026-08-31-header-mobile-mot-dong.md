# Header mobile MỘT dòng khi đăng nhập

Chốt 2026-08-31. User báo: trên mobile, đăng nhập xong header trôi xuống 2 dòng.

## 1. Chẩn đoán — vì sao chỉ khi đăng nhập, chỉ trên mobile

- `chrome.module.css` mốc **≤420px** đổi `.trong` sang `flex` + `flex-wrap` — chú thích tại
  chỗ nói rõ đây là chủ đích cũ: cụm phải quá rộng thì "cho nó xuống dòng thay vì nén chữ".
  Tức 2 dòng là **hành vi thiết kế cũ**, nay user chốt lại: phải MỘT dòng.
- Cụm phải khi đăng nhập = icon tìm (≤860) + "＋ Đăng bài" + chuông + công tắc theme +
  (avatar + chữ `u/username`). Hai phần nén ĐÃ có sẵn: `nut-dang-mach.module.css` ≤520px bỏ
  chữ giữ dấu ＋; `thanh-tai-khoan.module.css` ≤640px ẩn badge "chưa xác thực email".
- Thủ phạm còn lại là **chữ `u/username`** trong nút tài khoản (`.ten`): mono 13px, dài theo
  tên (username 12 ký tự ≈ 95px; cộng avatar 24 + padding + viền ⇒ nút ~150px). Tính trên
  khung 360px: 360 − 30 padding − hiệu ~66 − gap 10 = ~254px cho cụm phải, trong khi cụm
  hiện tại ~300px ⇒ tràn ⇒ wrap. Bỏ chữ (nút còn ~34px) thì cụm ~192px — lọt, kể cả 320px.
- Dải **421–640px** còn một lỗi câm cùng gốc: lưới `1fr auto` KHÔNG wrap, username dài làm
  `.trong` tràn ⇒ cả trang cuộn ngang (đúng thứ T7 cấm — T7 hiện chỉ đo khách nên không đỏ).

## 2. Phạm vi — 3 file, không hơn

1. `apps/web/components/thanh-tai-khoan.tsx` — thêm class cho span username (giữ nguyên
   `CHU_NGUOI_DUNG`): `<span className={css.ten_chu} {...CHU_NGUOI_DUNG}>u/{toi.username}</span>`.
2. `apps/web/components/thanh-tai-khoan.module.css` — trong khối `@media (max-width: 640px)`
   SẴN CÓ (đừng mở khối 640 thứ hai): ẩn-thị-giác `.ten_chu` bằng pattern visually-hidden
   (position:absolute · clip-path/clip · width/height 1px · overflow hidden — KHÔNG
   `display:none`, để trình đọc màn hình vẫn đọc được tên và accessible name của nút không
   đổi theo bề ngang); chỉnh padding `.ten` về cân (`3px 4px`) ở mốc đó cho nút tròn quanh
   avatar.
3. `apps/web/e2e/giao-dien.spec.ts` — bài đo MỚI (luật 4, thử phá bắt buộc), đặt trong
   describe `T6/T7 — bàn phím, focus, và mobile`.

**KHÔNG đụng** `chrome.module.css` (khối ≤420 flex-wrap giữ nguyên — lưới an toàn cho màn
320px và trạng thái khách; sau vá cụm phải đã lọt nên wrap không còn kích hoạt ở 360px).
**KHÔNG đụng** 4 file CSS bẩn của phiên khác (`form-tai-khoan` · `ket-qua-tim-kiem` ·
`the-mach` · `trang-mach`) và `LOI-VA-NO.md`.

Mục sổ MỞ nằm CẠNH nhưng NGOÀI phạm vi: `P-20260830-6` (ô tìm lệch tâm dải 861–950px) —
không đụng, đã có mục riêng.

## 3. Bài đo mới

Tên gợi ý: `"T7b — 360px + đăng nhập: header MỘT dòng, không cuộn ngang"`.

- Viewport `360×780` (cùng T7). Đăng nhập bằng đúng helper các bài web khác đang dùng
  (xem `tai-khoan-va-ghi.spec.ts` / `e2e/danh-tinh.ts` — tài khoản dùng-một-lần
  `@gikky.test`); mở `/`.
- Ba phép, mỗi phép một câu thông điệp:
  1. **Một dòng**: `boundingBox` của hiệu (`.hieu` / `getByRole("link", {name:"gikky"})`)
     và của `nut-tai-khoan` phải cùng hàng — chênh tâm-y ≤ 4px.
  2. **Không cuộn ngang**: `document.documentElement.scrollWidth <= clientWidth` (chép
     phép đo của T7).
  3. **Chữ username ẩn thị giác nhưng CÒN trong accessibility tree**: bounding box của
     span `u/<username>` có width ≤ 1px, và `nut-tai-khoan` vẫn chứa text `u/<username>`
     trong accessible name / textContent (chống sửa bằng `display:none` làm mất tên).
- Chống pass rỗng: trước khi đo phải `expect(nutTaiKhoan).toBeVisible()` (đăng nhập thật
  sự thành công — không thì phép "cùng hàng" so hai thứ không tồn tại).
- **Thử phá**: vô hiệu tạm rule `.ten_chu` trong khối 640 (hoặc revert cả CSS) ⇒ phép 1
  (cùng hàng) phải ĐỎ ở 360px; khôi phục. Nếu phép 1 không đỏ khi phá ⇒ phép đo sai, dừng.

## 4. Môi trường chạy — như plan A10 (đọc `plans/2026-08-30-sua-bai-do-a10-gap-binh-luan.md` mục 4)

`DATABASE_URL` trỏ `gikky_e2e` trong CÙNG lệnh; cổng 3000/8000 phải trống; không chèn `--`
trước cờ Playwright; một bộ e2e một thời điểm.

## 5. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Cách đo |
|---|---|---|
| 1 | Tái hiện: bài đo mới ĐỎ khi CHƯA vá CSS (viết test trước, chạy trước khi sửa CSS/TSX) | `pnpm e2e -g "T7b"` |
| 2 | Sau vá: bài đo mới XANH | cùng lệnh |
| 3 | Thử phá: vô hiệu rule `.ten_chu` ⇒ ĐỎ ở phép "cùng hàng"; khôi phục sạch | cùng lệnh + `git diff` |
| 4 | Bộ đầy đủ: 566 passed · 2 failed — hai bài đỏ NGOÀI phạm vi đã biết (`trang-loi #14` = P-20260830-1 · `giao-dien T8` = P-20260830-12); T7 cũ vẫn xanh | `pnpm e2e` |
| 5 | `pnpm lint` 0 lỗi 0 warning | |
| 6 | Diff so HEAD đúng 3 file mục 2 (+ 5 file bẩn sẵn của phiên khác, không tính) | `git diff HEAD --stat` |

Nền hiện tại (đo 2026-08-30, sau vá A10): bộ đầy đủ 565 passed / 2 failed. Số khác ⇒ DỪNG.

## 6. Chặng 5 (phiên chính)

Ghi sổ các phát hiện ngoài phạm vi; báo cáo; KHÔNG commit (user chưa bảo).

## 7. Cập nhật SAU phản biện (vòng 2, cùng ngày) — chẩn đoán mục 1 SAI MỘT NỬA, đã vá nốt

1. **Dải 421–860px header vẫn 2 dòng sau vòng 1 — kể cả KHÁCH.** Nguyên nhân thật không
   phải username: `dd1dac5` (Search v2) đổi root `OTimKiem` từ `<form class="o">` thành
   `<div class="boc">`; ≤860px CSS chỉ ẩn `.o` bên trong, `.boc` thành grid item rộng 0
   chiếm cột 2 của lưới `1fr auto` ⇒ `.phai` rơi xuống hàng 2 (đo: `grid-template-rows
   "23px 32px"` ở 430px). Câu của plan mục 1 "username dài làm tràn ⇒ cuộn ngang" là SAI —
   không tràn, nó xuống dòng, bất kể tên và bất kể đăng nhập.
   **Vá**: ẩn `.boc` trong khối 860 sẵn có của `o-tim-kiem.module.css`, gỡ ẩn bản panel
   qua `.boc.boc_panel`; hàng rào `loi-vao-tim-kiem.spec.ts` thêm con số 860 thứ tư.
2. **Vùng bấm nút tài khoản co còn 34×32px** — phạm luật 44px của chính repo
   (`chrome.module.css:36-37`). Vá: khối `(pointer: coarse)` min 44×44 cho `.ten`.
   ⚠ Khối này chưa có bài đo chạy được (Playwright pointer:fine) — xem `P-20260831-3`.
3. **T7b một điểm 360px là không đủ** — nay lặp `[360, 430, 640, 768]` (bốn nhánh CSS);
   thêm **T7c** (430px: bấm kính lúp xổ ô tìm thật) vì không có bài browser nào canh panel
   mobile, mà vá `.boc` chính là ẩn gốc component ấy.
4. Kiểm chứng chốt vòng 2: T7b xanh cả 4 mốc + T7c xanh; 3 lượt thử phá đỏ ở 3 chỗ độc
   lập (`.boc` → đỏ mốc 430 · `.boc_panel` → T7c đỏ "panel RỖNG" · `.ten_chu` → đỏ mốc
   360); bộ đầy đủ **567 passed / 2 failed** (2 bài NGOÀI phạm vi đã biết); lint 0/0;
   phiên chính chạy lại độc lập cụm T6/T7/T7b/T7c → 4 passed.
5. Sửa luôn chú thích sai "lọt cả ở 320px" (320px vẫn xuống dòng — flex-wrap ≤420 là lưới
   an toàn có chủ đích) và escape username trong RegExp của T7b.
