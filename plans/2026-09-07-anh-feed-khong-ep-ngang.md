# Ảnh thẻ feed không ép ngang + trần cao 350px

Chốt 2026-09-07. User: trên home và cat, ảnh xem trước đang bị kéo ngang theo card; muốn giữ kích thước gốc khi hẹp hơn card, chỉ co khi rộng hơn; ảnh cao hơn 350px thì khung `overflow` cố định 350px.

## Trạng thái

- **Chặng**: 1 — plan (chưa thực thi)
- **File chạm**: `apps/web/components/noi-dung-the.module.css` (+ comment trong cùng file nếu cần)

## 0 · Ranh giới

### LÀM

- Sửa CSS ảnh xem trước trên thẻ feed (`NoiDungThe` → `.khung_anh` / `.anh`).
- Home (`/`) và cat (`/s/<sub>`) đều đi qua `Feed` → `TheMach` → `NoiDungThe` — **một chỗ CSS** đủ cả hai.
- Hệ quả chấp nhận: hồ sơ / cuộn vô hạn cũng dùng `TheMach` nên cùng hành vi (đúng, không tách).

### KHÔNG LÀM

- Không đụng gallery trang mạch (`gallery-moc`), lightbox, avatar, form chọn ảnh.
- Không đổi API / thumbnail / `w`/`h` từ server.
- Không đổi JSX trừ khi bắt buộc (khung hiện đã là `<span className={css.khung_anh}>` — `display: block` + `overflow` đủ; không cần đổi sang `div`).
- Không đẻ e2e mới (hàng rào đọc-nguồn CSS đủ nếu có; không có thì đo bằng đọc CSS + kiểm tay / trình duyệt).
- Không đụng kiểu xem `gon` (vẫn ẩn ảnh).

## 1 · Nguyên nhân

Trong `noi-dung-the.module.css` hiện tại:

```css
.anh {
  width: 100%;          /* ← ép ngang theo card */
  max-height: 340px;
  object-fit: cover;    /* ← cắt/kéo khi lệch tỉ lệ */
}
```

Đó là đúng triệu chứng trên screenshot (biểu đồ bị giãn ngang).

## 2 · Hành vi đích

| Ca | Kết quả |
|---|---|
| `natural width` ≤ bề ngang card | ảnh giữ kích thước hiển thị gốc (không `width: 100%`) |
| `natural width` > bề ngang card | co theo `max-width: 100%`, giữ tỉ lệ (`height: auto`) |
| chiều cao sau co > 350px | `.khung_anh` `max-height: 350px; overflow: hidden` — cắt phần dư (ưu tiên phần trên, như trước với `object-position: top`) |
| chiều cao ≤ 350px | khung cao theo ảnh, không đệm trống tới 350 |

### CSS đích (ý, không phải diff cứng)

`.khung_anh`:

- `max-width: 100%`
- `max-height: 350px`
- `overflow: hidden`
- `width: fit-content` (hoặc tương đương) để viền khung ôm ảnh hẹp, không kéo khung full card
- bỏ trần 340; bỏ media `max-width: 640px` hạ xuống 260 — user chốt **350** một mức

`.anh`:

- `max-width: 100%`
- `width: auto` (bỏ `width: 100%`)
- `height: auto`
- bỏ `object-fit: cover` / `object-position` / `max-height` trên chính `img` (trần cao do khung lo)

Cập nhật comment trong file cho khớp hành vi mới (bỏ câu về `object-fit: cover` và số 340).

## 3 · Tiêu chí nghiệm thu (đo được)

1. **Đọc CSS**: trong `noi-dung-the.module.css`
   - `.anh` **không** còn `width: 100%`
   - `.anh` có `max-width: 100%` và `width: auto` (hoặc chỉ `max-width: 100%` mà không ép width)
   - `.anh` **không** còn `object-fit: cover`
   - `.khung_anh` có `max-height: 350px` và `overflow: hidden` (hoặc `overflow-y: hidden`)
   - không còn `max-height: 340px` / `260px` cho ảnh feed trong file này
2. **Lint**: `pnpm --filter web lint` (hoặc `pnpm lint` nếu filter không có) — 0 warning trên phạm vi app web; hoặc ít nhất lint không đỏ vì file CSS này.
3. **Build web** (nghiệm thu chạy): `pnpm --filter web build` hoặc `cd apps/web && pnpm build` — exit 0, 0 warning liên quan bản vá.
4. **Kiểm tay / trình duyệt** (thực thi + báo cáo): trên `/` hoặc `/s/chung-khoan`, thẻ có ảnh hẹp hơn card → ảnh không giãn ngang; ảnh cao → khung ≤ 350px, phần dưới bị cắt bởi overflow.

## 4 · Ghi chú thực thi

- File đích hiện **sạch** trên tree (`git status` không `M` file này lúc lập plan) — được sửa.
- Không commit code trừ khi user bảo; chặng 1 chỉ commit file plan này.
