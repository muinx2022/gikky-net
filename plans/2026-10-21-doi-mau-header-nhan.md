# Đổi tone màu header + điểm nhấn widget sang navy / xanh dương (apps/web)

Trạng thái: **XONG, chưa commit** · mở + đóng 2026-10-21

Kết quả (phiên chính tự chạy lại): tiêu chí 1 `rg` 0 dòng · tiêu chí 2 đạt · `pnpm e2e:don-vi`
549/549 · `pnpm lint` sạch · trình duyệt 3002 cả hai theme, 375/1366px. Lệch plan có chủ đích:
thêm token `--topbar-accent` (`#6ea8ff` cả hai theme) cho chữ/icon/viền trên header, vì
`--brand`/`--accent` sáng chỉ 2.88:1 trên `--topbar`. Review lượt 1 bắt chấm sau hiệu gikky
còn `--brand` (2.88:1) ⇒ lượt 2 chuyển sang `--topbar-accent` (6.95:1). Băm 9.1:
`633b0106…` → `f41a215b…`. Sổ: P-20261021-1, P-20261021-2.

## Bối cảnh

User: tone hiện tại "không phù hợp kiểu forum cho trading". Bảng màu hiện tại đến từ commit
`f513396` (redesign theo template "Pitnik Social Network"): nhấn cam-đỏ `#c53c1b`, `--brand` cam
`#fa6342`, header tím than `#30305b`. Vấn đề:

- nhấn cam-đỏ đụng nghĩa **đỏ = lỗ** (PLAN 9.1 giữ xanh/đỏ riêng cho lãi/lỗ);
- tím sát nghĩa **giá trần** trên bảng giá VN;
- đã lệch khỏi PLAN 9.1 (nhấn xanh mực `#3A46A8`) mà plan không ghi.

User chốt (2026-10-21, đã xem bản tiêm CSS trên trình duyệt ở cổng 3002): **giữ nguyên cấu trúc,
chỉ đổi màu header + điểm nhấn widget; logo cũng chuyển xanh.**

## LÀM

### 1. Token (`apps/web/app/globals.css` — cả 3 khối: `:root`, `@media dark`, `[data-theme="dark"]`)

| Token | Sáng | Tối |
|---|---|---|
| `--topbar` | `#0f1e33` | `#0b1524` |
| `--accent` | `#1f5fd1` | `#6ea8ff` |
| `--accent-soft` | `#e8f0fc` | `#14223a` |
| `--focus` | `#1f5fd1` | `#6ea8ff` |
| `--brand` (NỀN đặc của nút/badge, chữ trắng đặt lên) | `#1f5fd1` | `#2563eb` |
| `--on-brand` (MỚI — chữ trên nền `--brand`) | `#ffffff` | `#ffffff` |

`--on-accent` giữ như cũ trừ khi bài tương phản đòi đổi.

Cập nhật chú thích đầu file cho khớp (nó đang nói `--accent` là `#3A46A8 ↔ #8B99F2`).

### 2. Tách hai vai của `--brand`

`--brand` hiện vừa là **nền đặc có chữ trắng gõ cứng**, vừa là **màu chữ/icon/viền** trên nền tối.
Ở theme tối không mã xanh nào đạt cả hai (xanh đủ đậm cho chữ trắng thì quá tối làm chữ trên
`--surface`/`--topbar`; ví dụ `#2563eb` trên `#161b24` ≈ 3.4:1).

- Chỗ dùng `--brand` làm **nền** + `color: #ffffff` gõ cứng ⇒ đổi `#ffffff` thành `var(--on-brand)`.
  Danh sách (grep `background: var(--brand)` có `color: #ffffff` đi kèm): `feed.module.css:128`,
  `drawer-dang-nhanh.module.css:329`, `form-dang-mach.module.css:94`, `tab-ho-so.module.css:33`,
  `thanh-dieu-huong-duoi.module.css:106`, `thanh-tai-khoan.module.css:48`, `chuong.module.css:83`,
  `nut-dang-mach.module.css:8`. Các vạch chỉ báo (`border-radius: 0 2px 2px 0`) giữ `--brand`.
- Chỗ dùng `--brand` làm **màu chữ / icon / outline / viền**: `cot-vote.module.css:43`,
  `thanh-dieu-huong-duoi.module.css:88`, `logo.module.css:40`, `chrome.module.css:67`,
  `cong-tac-theme.module.css:27`, `tim-kiem-mobile.module.css:34`, `o-tim-kiem.module.css:30,56`,
  `the-moc.module.css:31` ⇒ chuyển sang token đạt tương phản trên nền thật của nó (thường là
  `--accent`). Nếu nền là `--topbar` (header) mà `--accent` sáng không đạt, dùng một token chữ
  riêng cho header — **quyết bằng số đo ở mục Tiêu chí, không bằng mắt**.

### 3. Bóng đổ cam gõ cứng

Mọi `rgba(250, 99, 66, X)` (≈10 chỗ, 8 file) ⇒ `color-mix(in srgb, var(--brand) X·100%, transparent)`
để bóng đi theo token. Không còn mã cam nào gõ cứng.

### 4. Ngoài CSS

- `apps/web/app/manifest.ts`: `theme_color` `#3a46a8` → `#0f1e33` (màu thanh trình duyệt khớp
  header). Sửa `e2e/don-vi/goi-y-cai-app.spec.ts:25` theo.
- `apps/web/lib/og.ts:44` `nhan: "#c53c1b"` → `#1f5fd1`.

### 5. PLAN.md 9.1 + băm

- Gạch đầu dòng màu của 9.1: thay "nhấn xanh mực `#3A46A8` / `#8B99F2`" bằng bảng mới (header
  navy `#0F1E33`/`#0B1524`, nhấn xanh dương `#1F5FD1`/`#6EA8FF`), kèm một câu lý do (đỏ = lỗ,
  tím = trần) và ngày 2026-10-21. **Không đụng** câu liệt kê "đóng dấu" hay luật xanh/đỏ.
- Rồi cập nhật `BAM_MUC_91` trong `e2e/don-vi/mau-token.spec.ts` theo đúng quy trình ghi ngay
  trên hằng đó (đọc lại `STAMP_THEO_MUC` / `CHUA_TOI_PHASE` — allowlist không đổi vì danh sách
  đóng dấu không đổi — rồi mới dán băm mới).

### 6. Bài đo tương phản

Thêm vào `e2e/don-vi/tuong-phan.spec.ts` (đo cả hai theme như các cặp hiện có):
- `--on-brand` trên `--brand` (AA chữ thường 4.5:1);
- mọi cặp chữ/nền mới sinh ra ở mục 2 (vd. token chữ trên `--topbar`, `--accent` trên nền của
  thanh điều hướng dưới). Icon/viền thuần (không chữ) dùng ngưỡng 3:1 nếu file đã có hằng đó.

## KHÔNG LÀM

- Không đổi bố cục, cỡ chữ, font, bo góc, khoảng cách.
- Không đổi `--bg`, `--surface*`, `--ink*`, `--line*`, `--gain`, `--loss`, `--stamp*`.
- Không đổi màu biểu đồ/ảnh TradingView.
- Không đụng `apps/admin` (hệ token riêng).
- Không chuyển `apps/web` sang Tailwind.
- Không commit.

## Tiêu chí nghiệm thu (đo được)

1. `rg -i "fa6342|ff785a|c53c1b|ff8568|30305b|1c1d36|250, ?99, ?66|3a46a8" apps/web --glob "!**/{node_modules,.next}/**"`
   → **0 dòng** (trừ chuỗi lịch sử trong chú thích nếu có lý do; ghi rõ từng dòng còn lại).
2. `rg "color: #ffffff" apps/web/components` không còn dòng nào nằm cạnh `background: var(--brand)`.
3. `pnpm e2e:don-vi` xanh toàn bộ — đặc biệt `tuong-phan.spec.ts` (có cặp mới ở mục 6),
   `mau-token.spec.ts` (băm mới), `goi-y-cai-app.spec.ts`, `quan-tri-giao-dien.spec.ts`.
4. `pnpm lint` xanh.
5. Trình duyệt: trang chủ + một trang mạch + hồ sơ, **cả hai theme**, khổ 375px và ≥1280px: header
   navy, nút "+"/"Đăng mạch"/tab active/nút sắp xếp xanh dương, không còn mảng cam nào trừ màu
   hoàng thổ "đóng dấu". Chụp ảnh đính kèm báo cáo.

## Ghi chú môi trường (đọc trước khi chạy)

- Cổng **3000 và 8000 đang bị dự án khác (`D:\Projects\dien-dan`) chiếm — KHÔNG tắt chúng.**
  Kiểm trình duyệt gikky ở **3002** (Next, `API_ORIGIN=http://localhost:8002`) + **8002** (Django,
  `node scripts/py.mjs runserver 127.0.0.1:8002 --noreload`). Phiên chính đang chạy sẵn cả hai.
- **Không chạy `pnpm e2e`** (chiếm 3000/8000, ghi DB). Chỉ `pnpm e2e:don-vi`.
- Không chạy `pnpm build` trong lúc `next dev` 3002 đang mở.
