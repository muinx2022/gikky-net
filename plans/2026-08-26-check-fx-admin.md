# Check FX — trang kiểm chồng lấn vị thế forex (khu quản trị)

Ngày: 2026-08-26. Yêu cầu của user: *"bạn tạo 1 page trong admin đi, Check fx, tôi sẽ sử dụng để kiểm tra"*.

## Bối cảnh

User giao dịch forex theo quy tắc **mỗi đồng tiền chỉ giữ đúng một vị thế**. Phiên phân tích trước
đo được quy tắc ấy chặn theo TÊN cặp nên vừa quá chặt vừa quá lỏng (119 phiên, đến 26/08/2026):

- Bỏ sót: `AUDCAD` vs `NZDUSD` = **+0.655**, vs `EURUSD` = **+0.610** — không chung ký tự nào, vẫn chồng lấn.
- Cấm nhầm: `AUDCAD` vs `AUDNZD` = **+0.341** — chung chữ AUD nhưng gần như độc lập.

Trang này là công cụ để user tự chạy lại phép đo đó với dữ liệu mới, trước mỗi lần cân nhắc mở vị thế thứ hai.

## Phạm vi

TRONG phạm vi: một trang admin `/check-fx`, chọn cặp đang giữ + số phiên, trả bảng phân loại chồng lấn.
NGOÀI phạm vi: đặt lệnh, cảnh báo tự động, lưu vị thế vào DB, biểu đồ giá, phân tích kỹ thuật.

## Kiến trúc

- **Server Component + `searchParams`**, không route handler. Lý do: `next.config.ts` rewrite
  `/api/:path*` sang Django, nên route handler dưới `/api/` không tồn tại được; và fetch Yahoo
  từ trình duyệt vướng CORS.
- **Không đụng Django, không đụng `pnpm codegen`.** Đây là công cụ cá nhân đọc nguồn ngoài,
  không phải dữ liệu của sản phẩm — nhét vào OpenAPI là mở rộng bề mặt API cho một trang.
- Nguồn giá: Yahoo Finance chart API (`query1.finance.yahoo.com/v8/finance/chart/<CAP>=X`),
  cache `revalidate: 3600`.
- Logic thuần tách hẳn vào `apps/admin/lib/fx.ts` để test được không cần React/Next/mạng.

## File đụng tới

| File | Việc |
|---|---|
| `apps/admin/lib/fx.ts` | MỚI — hằng số, hàm thuần (tương quan, tách đồng tiền, phân loại) + hàm tải |
| `apps/admin/app/check-fx/page.tsx` | MỚI — server component |
| `apps/admin/components/khung/menu.ts` | thêm nhóm "Công cụ" + mục `/check-fx` |
| `apps/admin/components/icon.tsx` | thêm icon `ty-gia` |
| `apps/web/e2e/don-vi/check-fx.spec.ts` | MỚI — bài đo hàm thuần |

⚠ `apps/admin/components/dung-mo-ta.ts` đang `M` do phiên khác — **không chạm**.

## Tiêu chí nghiệm thu (đo được)

1. `pnpm lint` — **0 warning, 0 error** (chạy `--max-warnings=0`).
2. `pnpm build` — xanh, không warning mới.
3. `pnpm e2e:don-vi` — toàn bộ xanh, **không giảm so với nền trước khi sửa** (ghi lại số nền trước).
4. Hàng rào `quan-tri-giao-dien.spec.ts` "MENU — mọi mục sidebar dẫn tới một page.tsx có thật" — ĐẠT.
5. Hàng rào "MÀU — không màu ứng biến trong apps/admin" — ĐẠT (chỉ dùng class token, không hex trong TSX).
6. Bài đo mới phủ ít nhất: `tuongQuan` (chuỗi giống hệt → +1, chuỗi đảo dấu → −1), `chungDongTien`
   (`AUDCAD`/`AUDNZD` → true, `AUDCAD`/`EURJPY` → false), `phanLoai` đủ 5 nhánh.
7. **Thử phá**: sửa ngược `chungDongTien` trả cố định `false` → bài đo phải ĐỎ → khôi phục.
8. Trang chạy thật: `/check-fx` với `?cap=AUDCAD` trả bảng có ít nhất 10 hàng, và
   `AUDCAD` vs `AUDNZD` được xếp nhóm "cấm nhầm", `AUDCAD` vs `NZDUSD` xếp nhóm "chồng lấn ẩn"
   (khớp phép đo tay ở phiên phân tích).

## Ghi chú thực thi

Phiên chính TỰ LÀM, không giao subagent (session này cấm gọi Agent tool trừ khi user yêu cầu).
⇒ Báo cáo phải nói rõ: **số liệu do người làm tự đo, không có lượt kiểm độc lập.**

---

## Kết quả (26/08/2026, phiên chính tự làm)

| # | Tiêu chí | Kết quả |
|---|---|---|
| 1 | `pnpm lint` 0 warning | **ĐẠT** — cả `@gikky/web` và `@gikky/admin` sạch |
| 2 | `pnpm build` xanh | **CHƯA CHẠY** — xem mục "Còn nợ" |
| 3 | `pnpm e2e:don-vi` không giảm so với nền | **ĐẠT** — nền 306 passed / 1 failed → sau 324 passed / 1 failed (+18 bài mới) |
| 4 | Hàng rào MENU (mục → page.tsx thật) | **ĐẠT** |
| 5 | Hàng rào MÀU (không màu ứng biến) | **ĐẠT** |
| 6 | Bài đo phủ `tuongQuan` / `chungDongTien` / `phanLoai` 5 nhánh | **ĐẠT** — 18 bài |
| 7 | Thử phá | **ĐẠT** — 2 lần, xem dưới |
| 8 | Trang chạy thật, khớp phép đo tay | **ĐẠT** — xem dưới |

**Bài đỏ duy nhất không phải của việc này:** `trang-loi.spec.ts:261` (`/luat` phải là route tĩnh).
Nó đã đỏ ở **nền, trước khi sửa bất cứ thứ gì** — không chạm, thuộc phần việc khác.

### Thử phá (luật 4)

1. `chungDongTien` sửa thành `return false` → **2 bài ĐỎ** (`chungDongTien — ca bỏ sót…`,
   `soSanhVoiDanhMuc — bỏ chính nó…`) → khôi phục, xanh lại.
2. `phanLoai` bỏ `Math.abs` → **1 bài ĐỎ** (`phanLoai xét ĐỘ LỚN — tương quan âm mạnh cũng là
   chồng lấn`) → khôi phục, xanh lại.

### Nghiệm thu tiêu chí 8 — logic thật trên dữ liệu thật

Chạy `taiDanhMuc` + `soSanhVoiDanhMuc` thật (120 phiên, 22/22 cặp tải được):

- `AUDNZD` r=**+0.340**, chung đồng tiền → **cấm nhầm** ✓
- `NZDUSD` r=**+0.655**, không chung → **chồng lấn ẩn** ✓
- 21 hàng kết quả (≥10) ✓

Khớp phép đo tay ở phiên phân tích (+0.341 / +0.655) — chênh ở chữ số thứ ba do khác ngày cắt.

Trang thật qua dev server đang chạy: `GET /check-fx?cap=AUDCAD&phien=120` → **HTTP 200**, 118 KB,
không dấu hiệu lỗi biên dịch, HTML chứa đủ 4 nhóm kết luận và các giá trị `+0.656 / +0.611 / +0.340`.

## Còn nợ

**`pnpm build` chưa chạy.** Cả ba cổng 3000 / 3001 / 8000 đều đang bận — một phiên khác chạy đủ
`web` + `admin` + Django. `pnpm build` tranh `.next/` với `next dev` đang chạy và làm hỏng app của
phiên đó (bẫy đã ghi ở `CLAUDE.md`). Thay thế: `npx tsc --noEmit` cho **cả hai** app → exit 0.

⇒ Chạy `pnpm build` khi các dev server đã tắt, trước khi commit.
