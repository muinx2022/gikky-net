# Đóng menu `⋯` mốc khi bấm ra ngoài

Chốt 2026-09-07. User: dưới từng mốc, bấm `⋯` ra mục Báo cáo (và Sửa/Xoá); hiện phải bấm đúng nút `⋯` mới ẩn — muốn bấm ra ngoài cũng đóng.

## Trạng thái

- **Chặng**: 1 — plan (chưa thực thi)
- **Thực thi**: phiên chính (Auto), **không** `opus-dev` (user chốt lối này)

## 0 · Ranh giới

### LÀM

- Đóng `<details>` menu `⋯` khi `mousedown` **ngoài** hộp menu — cùng ý `chuong.tsx` (bấm ra ngoài thì đóng).
- Áp cho **`HanhDongMoc`** (đúng chỗ user báo) và **`HanhDongBinhLuan`** (cùng pattern `<details>` + `dongMenu`, cùng form Báo cáo — sửa một nơi bỏ sót nơi kia).

### KHÔNG LÀM

- Không đổi `FormBaoCao` (form nằm **ngoài** `<details>`, đã có nút Huỷ / trạng thái xác nhận — không gộp vào “menu `⋯`”).
- Không đổi menu `⋯` sang controlled React state (giữ `<details>` uncontrolled như hiện tại).
- Không đụng file `M` của việc `w_thumb` / chuyên mục đang dở trừ khi trùng file (hai file hành động **hiện sạch** với việc đó).
- Không commit code / deploy trừ khi user bảo.

## 1 · Nguyên nhân

`hanh-dong-moc.tsx` / `hanh-dong-binh-luan.tsx` dùng:

```tsx
<details ref={hopRef} …>
  <summary>⋯</summary>
  …
</details>
```

`<details>` chỉ toggle khi bấm `summary`. `dongMenu()` chỉ gọi sau khi chọn mục trong menu — không có listener bấm ra ngoài (chuông thì đã có).

## 2 · Cách làm

Thêm `useEffect` (hoặc hook nhỏ dùng chung nếu muốn tránh copy):

- Lắng `mousedown` trên `document`.
- Nếu `hopRef.current?.open` và target **không** nằm trong `hopRef.current` → `hopRef.current.open = false`.
- Cleanup remove listener.

Không cần state React cho `open` (tránh hai nguồn sự thật với uncontrolled `<details>`). Kiểm `hop.open` mỗi lần sự kiện là đủ.

Tuỳ chọn gọn: `hooks/use-dong-details-khi-bam-ngoai.ts` (hoặc cạnh component) — **một chỗ**, hai file gọi. Nếu chỉ vài dòng thì copy hai lần cũng chấp nhận được; ưu tiên **một helper** để lần sau không lệch.

## 3 · File chạm (dự kiến)

| File | Việc |
|---|---|
| `apps/web/components/hanh-dong-moc.tsx` | gắn đóng khi bấm ngoài |
| `apps/web/components/hanh-dong-binh-luan.tsx` | cùng |
| `apps/web/lib/…` hoặc `hooks/…` (mới, nếu tách helper) | `useDongDetailsKhiBamNgoai(ref)` |
| (tuỳ) `apps/web/e2e/don-vi/…` | hàng rào đọc-nguồn: hai file phải gắn listener / gọi helper — **không** bắt buộc e2e browser |

## 4 · Tiêu chí nghiệm thu

1. Đọc mã: `HanhDongMoc` và `HanhDongBinhLuan` đều đóng `details` khi `mousedown` ngoài `hopRef`.
2. `pnpm --filter web lint` exit 0.
3. Kiểm tay / trình duyệt (thực thi): mở `⋯` trên mốc → bấm ra ngoài vùng menu → menu ẩn; bấm lại `⋯` vẫn mở/đóng bình thường; chọn "Báo cáo" vẫn mở `FormBaoCao` như cũ.
4. (Nếu có hàng rào đọc-nguồn) `pnpm e2e:don-vi -g "…"` xanh.

## 5 · Ghi chú

- Cây đang có `M` từ việc `w_thumb` — **không** gộp commit với việc này.
- Plan commit riêng ở chặng 1; sau đó Auto thực thi khi user bảo (hoặc ngay nếu user đã uỷ quyền “có plan thì Auto làm”).
