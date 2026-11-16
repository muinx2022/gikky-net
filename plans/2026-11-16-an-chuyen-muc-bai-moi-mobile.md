# Ẩn Chuyên mục + Bài mới trên mobile / fold (≤ 960px)

> **Trạng thái:** ĐÃ LÊN PROD 2026-11-16 — commit cherry-pick `3ccbbe5` (từ `2547686` trên `v2`), nền prod `8750a60`; chỉ rebuild `web`. Backup `~/gikky-net/src.cu-20261116-155917`, image `gikkynet-web:truoc-an-rail-960`.  

> **Nền:** `c8de000` (docs fill-trich). Nhánh hiện tại của workspace.  
> User 2026-11-16: trên Mix Fold 3 vẫn thấy khối «Chuyên mục» và «bài viết mới» bên phải — phải ẩn khi xem trên mobile.

## 1. Hiện trạng / nguyên nhân

- Hai khối rail `sidebar-cac-sub` (Chuyên mục) và `sidebar-bai-moi` (Bài viết mới / Bài mới nhất / Cùng chuyên mục) đã gắn lớp `.an_tren_dien_thoai`.
- Luật ẩn hiện chỉ nằm trong `@media (max-width: 640px)` ở `apps/web/components/sidebar.module.css`.
- Thanh điều hướng dưới (tab «Chuyên mục») hiện ở **≤ 960px**; lưới hai cột cũng gãy thành một cột ở **≤ 960px**.
- Mix Fold 3 (và tablet/foldable khác) thường nằm **641–960px CSS** → tab «Chuyên mục» đã có, nhưng hai khối rail vẫn hiện → trùng / thừa đúng triệu chứng user báo.

Chốt user 2026-11-14 (ẩn bằng CSS, giữ DOM) **giữ nguyên**; chỉ **nâng ngưỡng** cho khớp chỗ đã có lối vào chuyên mục trên mobile/tablet.

## 2. LÀM

1. Trong `apps/web/components/sidebar.module.css`:
   - Chuyển `.an_tren_dien_thoai { display: none; }` ra khỏi `@media (max-width: 640px)`.
   - Đặt vào `@media (max-width: 960px)` (khối media riêng hoặc gộp vào media 960 đã có nếu hợp lý).
   - **Không** đổi các luật padding `.dan` / `.chu_de_tuan` vẫn thuộc 640px.
   - Cập nhật chú thích: ẩn ≤ 960px vì tab «Chuyên mục» của thanh dưới cũng hiện ≤ 960px; vẫn ẩn bằng CSS, không `matchMedia`, không gỡ markup.

2. Đồng bộ chú thích (không đổi hành vi khác):
   - `apps/web/components/khung-hai-cot.module.css` (đoạn «ẩn ở ≤ 640px» → ≤ 960px).
   - `apps/web/components/sidebar.tsx` nếu docstring còn ghi 640.

3. Cập nhật bài đo cho khớp ngưỡng mới:
   - `apps/web/e2e/don-vi/sidebar-bai-moi.spec.ts`: hàng rào «CHỈ nằm trong `@media (max-width: 640px)`» → **960px**.
   - `apps/web/e2e/mobile-390.spec.ts` (T5):
     - Giữ ca 390px: hai khối `toBeHidden`, `sidebar-luat` vẫn hiện, tab «Chuyên mục» vẫn hiện.
     - Ca «641px thì HIỆN lại» → đổi thành: ở **960px** vẫn ẩn; ở **961px** thì cả hai khối **HIỆN** (desktop hai cột). Cập nhật tên test / chú thích cho đúng.
   - Các expect ẩn ở viewport ≤ 640 trong `trang-chu-v2.spec.ts` (nếu có) giữ nguyên — vẫn đúng với ngưỡng mới.

4. Markup / gắn lớp: **không** đổi `khoi-chuyen-muc.tsx` / `khoi-bai-moi.tsx` trừ khi hàng rào bắt buộc (vẫn phải gắn `css.an_tren_dien_thoai` ở phần tử gốc).

## 3. KHÔNG LÀM

- Không ẩn cả `rail-phai` / Luật / chân trang / khối khách trên trang index (SEO + quyết định cũ: chỉ hai khối trùng tab dưới).
- Không đổi lưới hai cột, sticky rail, header, thanh điều hướng dưới.
- Không đụng file đang `M` của phiên khác: `api/api/quan_tri_bang.py`, `quan_tri_schemas.py`, test quan_tri / nhan_email, `apps/admin/**`, `packages/api-client/**`, `scripts/bai-viet/**`, `scripts/bot-trader/**`, ảnh thumbnail, v.v.
- Không commit, không push, không deploy, không `pnpm e2e` trần trên `gikky_dev`.
- Không mở rộng sang Tailwind / màu mới / đổi breakpoint toàn site khác 960.

## 4. Tiêu chí đo được

| # | Lệnh / phép đo | Kết quả kỳ vọng |
|---|---|---|
| T1 | Đọc CSS: `.an_tren_dien_thoai { display: none }` chỉ trong `@media (max-width: 960px)` | `pnpm e2e:don-vi -g "an_tren_dien_thoai"` xanh (sau khi sửa expect 960) |
| T2 | Viewport 390: `/` và `/luat` — `sidebar-cac-sub` + `sidebar-bai-moi` hidden; `sidebar-luat` visible | bài T5 trong `mobile-390.spec.ts` (cần bản build + `gikky_e2e` nếu chạy file đó) |
| T3 | Viewport **960**: hai khối vẫn **ẩn**; viewport **961**: hai khối **hiện** | cùng file T5 đã cập nhật |
| T4 | Desktop 1280: rail hai cột, hai khối vẫn hiện như trước | expect 961+ / không đổi markup desktop |
| T5 | `pnpm e2e:don-vi -g "an_tren_dien_thoai"` và/hoặc `-g "rail điện thoại"` | pass |
| T6 | `pnpm lint` (apps/web nếu chỉ đụng web) — 0 warning | pass |

Thợ tự chạy T1/T5/T6; nếu môi trường cho phép thì chạy thêm đoạn T5 của `mobile-390` (ghi rõ đã/chưa đo build). UI: có thể soi DevTools ở ~800×900 (dải Fold) để xác nhận hai khối không hiện.

## 5. File được sửa

- `apps/web/components/sidebar.module.css` (chính)
- `apps/web/components/khung-hai-cot.module.css` (chú thích)
- `apps/web/components/sidebar.tsx` (chú thích, nếu cần)
- `apps/web/e2e/don-vi/sidebar-bai-moi.spec.ts`
- `apps/web/e2e/mobile-390.spec.ts`

## 6. Báo cáo

Liệt kê diff ngắn, lệnh đã chạy + kết quả, viewport đã thử. Mục NGOÀI PHẠM VI nếu thấy (không tự sửa).
