# Vùng bấm cụm phải header ≥44px trên màn cảm ứng — đóng P-20260831-1, -2, -3

Chốt 2026-08-31 (user uỷ quyền "cần sửa gì thì làm đi"; cơ chế hàng rào do phiên chính chọn).

## 1. Hiện trạng — ba mục sổ cùng một gốc

Cụm phải header (`.phai` trong `chrome.module.css`) có 5 nút. Luật repo (ghi ở
`chrome.module.css:36-37` + hàng rào coarse của `tim-kiem-mobile`): trên màn cảm ứng vùng
bấm không được dưới 44px. Thực trạng từng nút ở `(pointer: coarse)`:

| Nút | Khối coarse | Bù margin âm |
|---|---|---|
| kính lúp (`tim-kiem-mobile`) | 44×44 ✓ | ✓ (docstring nói cặp bù là BẮT BUỘC) |
| Đăng bài (`nut-dang-mach`) | không có — nhưng nút có padding+viền, đo thật ~32px cao | — |
| chuông (`chuong`) | **không có** (~29px cao) — P-20260831-2 | — |
| theme (`cong-tac-theme`) | 44×44 ✓ | **không bù** — nở 12px, ngược luật hàng xóm — P-20260831-1 |
| tài khoản (`thanh-tai-khoan` `.ten`) | 44×44 ✓ (lượt header) | không bù (chọn "nở thật" có chủ đích) |

Và P-20260831-3: luật 44px không có hàng rào chạy được — Playwright toàn `pointer: fine`,
phép grep duy nhất chỉ hỏi `.nut` của `tim-kiem-mobile`.

## 2. Quyết định thiết kế — MỘT luật, ghi ở MỘT chỗ

**Luật thống nhất** (sẽ ghi thành "nhà" của luật trong docstring
`tim-kiem-mobile.module.css`, ba file kia trỏ về):

1. Mọi nút trong `.phai` ở `(pointer: coarse)`: vùng bấm ≥ 44×44 (`min-width`/`min-height`
   + `display:inline-flex; align-items:center; justify-content:center` nếu cần).
2. Nút có HÀNG XÓM hai bên (kính lúp, Đăng bài, chuông, theme): kèm **cặp margin âm bù**
   để cụm phải không nở bề ngang — đúng luật sẵn có của `tim-kiem-mobile`.
3. Nút ở MÉP (tài khoản — phần tử cuối): **nở thật, không bù** — margin âm ở mép đẩy hộp
   bấm ra ngoài `.khung` (lý do đã ghi khi làm lượt header). Đây là ngoại lệ có tên,
   không phải hai luật ngược nhau.

**Cơ chế hàng rào (chốt cho P-20260831-3):** mở rộng phép kiểm coarse trong
`e2e/don-vi/loi-vao-tim-kiem.spec.ts` (hoặc tách file don-vi riêng nếu gọn hơn) thành
bảng: 5 file CSS của 5 nút cụm phải — mỗi file phải có khối `(pointer: coarse)` chứa
`44px`, và 3 file nhóm "có hàng xóm" phải có margin âm trong khối đó. Đây là phép đọc
nguồn cùng loài với hàng rào sẵn có — KHÔNG dựng project Playwright cảm ứng riêng ở lượt
này (đầu tư lớn hơn; ghi thành hướng tương lai trong docstring hàng rào).

**Đo hệ quả bố cục bằng Chromium coarse thật** (không phải chỉ grep): script chạy tay
(kiểu `do2.mjs` của phản biện lượt header) — emulate pointer coarse + touch ở 360px và
430px, trạng thái đăng nhập: mọi hộp bấm của 5 nút ≥44×44, header vẫn MỘT dòng, không
cuộn ngang. Số dư đã biết: ở 360px cụm phải còn ~45px trống (đo lượt header) — chuông nở
44 có bù margin thì bề ngang cụm gần như không đổi.

## 3. Phạm vi

1. `apps/web/components/chuong.module.css` — thêm khối coarse 44×44 + cặp bù (nhóm 2).
2. `apps/web/components/cong-tac-theme.module.css` — thêm cặp bù vào khối coarse sẵn có.
3. `apps/web/components/nut-dang-mach.module.css` — thêm khối coarse 44 (chiều CAO tối
   thiểu; bề ngang nút vốn ≥44 nhờ chữ/padding — kiểm bằng số đo, ở ≤520px bản icon-only
   phải đủ 44 ngang) + cặp bù.
4. `apps/web/components/tim-kiem-mobile.module.css` — docstring thành "nhà" của luật
   (3 vế ở mục 2), không đổi số.
5. `apps/web/components/thanh-tai-khoan.module.css` — chú thích khối coarse trỏ về nhà
   luật, ghi rõ ngoại lệ mép (không đổi số).
6. Hàng rào don-vi (file `loi-vao-tim-kiem.spec.ts` hoặc file mới) — bảng 5 nút như mục 2.
7. Script đo tay để trong scratchpad (không vào repo).

KHÔNG đụng: `chrome.module.css`, `chuong.tsx`/component TSX nào, 4 file CSS bẩn của phiên
khác, `LOI-VA-NO.md`.

## 4. Tiêu chí nghiệm thu

| # | Tiêu chí | Cách đo |
|---|---|---|
| 1 | Hàng rào mới ĐỎ trước khi vá CSS (chạy trước) — tái hiện thiếu chuông/thiếu bù | `pnpm e2e:don-vi -g` bài mới |
| 2 | Sau vá: don-vi 0 failed | `pnpm e2e:don-vi` |
| 3 | Thử phá: gỡ tạm khối coarse của chuông ⇒ đỏ; gỡ cặp bù của theme ⇒ đỏ | từng bài |
| 4 | Đo Chromium coarse 360px + 430px (đăng nhập): 5 hộp bấm ≥44×44 · header 1 dòng · không cuộn ngang | script tay, dán số |
| 5 | Bộ đầy đủ `pnpm e2e` 0 failed (nền 572 + số bài don-vi mới) | |
| 6 | `pnpm lint` 0/0; diff đúng phạm vi mục 3 | |

## 5. Chặng 5

Đóng P-20260831-1/-2/-3 (cơ chế grep + đo tay; project cảm ứng thật = hướng tương lai,
ghi trong docstring hàng rào); commit pathspec; báo cáo.

## 6. Cập nhật vòng 2 (2026-09-01) — phản biện bắt 5 lỗi thật, đã vá hết

1. **Bù dọc là lỗi**: `margin: -6px` bốn phía làm chiều cao header phụ thuộc nút
   chỉ-có-khi-đăng-nhập ⇒ nhảy 12px (53→65) khi `GET /me` về, trên mọi điện thoại. Luật
   sửa thành **bù CHỈ NGANG**; đo lại: header 65px ổn định cả ba trạng thái phiên.
2. **Chạm thật ≠ boundingBox**: đo elementFromPoint ra 41–42px và 3px viền "Đăng bài" mở
   nhầm panel thông báo. Bộ số chốt: bù ngang **-4px cả bốn nút** (nghiệm duy nhất vừa
   thoả "tổng bù cặp ≤ gap 8" vừa giữ cụm ≤ HEAD — 4/4/4/4 là bộ số BÃO HOÀ, có bài G
   canh). Chạm thật sau vá: ≥44 mọi nút, không chồng; cụm hẹp hơn HEAD 5–6px.
3. **Nhánh KHÁCH được đưa vào luật**: "Đăng nhập" 15→44px, "Đăng ký" 25.6→44px (đổi diện
   mạo thấy được trên cảm ứng — giá của vế 1); kính lúp của khách 45→40 ở vòng 1 (bước
   lùi) nay về 44.
4. **Hàng rào 17 → 27 bài**: vá 5 lỗ regex (thẻ có props, max-width/line-height giả đạt,
   logical margin, đếm khối coarse biến thể `and (…)`, ngoại lệ badge) + nhóm F (cấm bù
   dọc) + bài G (trần tổng-bù-cặp đọc `gap` thật, gồm cặp kính-lúp↔theme của khách).
5. Gỡ luật chết `.nut > span` của nut-dang-mach.
Kiểm chứng chốt: don-vi 430/0 · bộ đầy đủ 600/0 (thợ) · 599/1 (phiên chính — 1 bài
form-ghi B3 chớp tắt, xanh khi chạy riêng, ghi P-20260901-6) · lint 0/0.
