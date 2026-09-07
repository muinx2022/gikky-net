# w_thumb / h_thumb cho ảnh feed + CLS + hàng rào CSS

Chốt 2026-09-07. User: sửa các mục sổ `P-20260907-2` · `P-20260907-3` · `P-20260907-4` sau bản vá ảnh feed không ép ngang. **Thực thi: phiên chính (Auto), không gọi `opus-dev`.**

## Trạng thái

- **Chặng**: xong (2026-09-07) — Auto tự làm, không opus-dev; nghiệm thu ĐẠT; phản biện → vá lượt 2 (doc ±1px, hàng rào JSX, ValueError đường đọc)
- **Sổ**: P-20260907-2/3/4 đóng trên cây (chờ commit); thêm P-20260907-5 (chon-anh/admin)

### Báo cáo thực thi

| Tiêu chí | Kết quả |
|---|---|
| 1 · `kich_thuoc_thumb` + pytest | ĐẠT — 4 bài `kich_thuoc_thumb` xanh (kể cả ca lẻ + ±1px vs Pillow) |
| 2 · `AnhOut.w_thumb/h_thumb` + feed | ĐẠT — schema + feed tests + `KHOA_CHO_PHEP` |
| 3 · `NoiDungThe` / gallery | ĐẠT — `w_thumb` + `style.width` |
| 4 · hàng rào e2e | ĐẠT — 2 bài `anh-feed-css` xanh; thử phá CSS đỏ rồi khôi phục |
| 5 · lint | ĐẠT — `pnpm --filter web lint` exit 0 |

Codegen đã chạy. **Chưa commit code / chưa deploy** — user bảo mới làm.

## 0 · Ranh giới

### LÀM

1. **API**: thêm `w_thumb` / `h_thumb` vào `AnhOut`, suy từ `w`/`h` ảnh chính + `CANH_THUMB` (khớp Pillow `thumbnail`, không upscale) — **không migration**, hàng cũ vẫn đúng.
2. **Frontend feed**: `NoiDungThe` dùng `w_thumb`/`h_thumb` cho thuộc tính `width`/`height` và dành chỗ trước khi tải (`style.width` = thumb, `maxWidth: 100%`, `height: auto`) để hết CLS do `width: auto` thuần.
3. **Gallery mốc**: cùng dùng `w_thumb`/`h_thumb` khi `src` là `url_thumb` (cùng loài lệch).
4. **Codegen** sau đổi schema.
5. **Hàng rào** `e2e/don-vi`: đọc `noi-dung-the.module.css`, cấm `.anh` có `width: 100%` / `object-fit: cover`, bắt buộc `max-width: 100%` + khung `max-height: 350px` + `overflow: hidden`.
6. **Pytest** cho hàm suy kích thước thumb (ca hẹp hơn 480, ca rộng hơn, ca vuông).
7. Đóng sổ P-20260907-2/3/4 khi xong.

### KHÔNG LÀM

- Không thêm cột DB `w_thumb`/`h_thumb` (tránh đụng migration `0032` của phiên khác).
- Không đổi nghĩa `w`/`h` (vẫn là ảnh chính đã lưu ≤2048).
- Không đổi `CANH_THUMB` / pipeline upload / đường lưu file.
- Không đụng file `M` của phiên khác: `quan_tri_*`, `dien_dan.py`, `ghi.py` (trừ nếu `anh_ra`/`schemas` bắt buộc — `ghi.py` **không** sửa nếu chỉ compute ở `trinh_bay`), `feeds.py`, `tao_sub`, `0032_sub_thu_tu.py`, v.v.
- Không deploy trừ khi user bảo.

## 1 · Thiết kế

### 1.1 · `api/core/anh.py`

Thêm hàm thuần:

```python
def kich_thuoc_thumb(w: int, h: int) -> tuple[int, int]:
    """Kích thước file thumbnail suy từ ảnh chính đã lưu — khớp Pillow thumbnail(CANH_THUMB)."""
```

Luật: `canh = max(w,h)`; nếu `canh <= CANH_THUMB` → `(w,h)`; ngược lại scale = `CANH_THUMB / canh`, làm tròn từng cạnh (ít nhất 1 nếu cạnh gốc ≥ 1).

### 1.2 · `AnhOut` (`api/api/schemas.py`)

Thêm:

- `w_thumb: int | None`
- `h_thumb: int | None`

Docstring: kích thước **file `url_thumb`**, suy từ `w`/`h` + `CANH_THUMB`; `null` khi thiếu `w`/`h`.

### 1.3 · `anh_ra` + nhánh AnhNoiDung trong `du_lieu_the` (`api/api/trinh_bay.py`)

Điền `w_thumb`/`h_thumb` qua `kich_thuoc_thumb` khi có `w` và `h`; không thì `None`.

Mọi chỗ dựng `AnhOut(...)` tay phải điền đủ hai trường mới (grep `AnhOut(`).

### 1.4 · Frontend

- `noi-dung-the.tsx`: `width`/`height` = `w_thumb`/`h_thumb`; khi có `w_thumb`, `style={{ width: w_thumb, maxWidth: "100%", height: "auto" }}` (dành chỗ = cỡ thumb, vẫn co trên mobile).
- `gallery-moc.tsx`: `width`/`height` = `w_thumb`/`h_thumb` (src vẫn `url_thumb`).
- CSS feed giữ hành vi không ép ngang (không đưa lại `width: 100%`).

### 1.5 · Codegen

`pnpm codegen` (và kiểm `AnhOut` trong `packages/api-client` có `w_thumb`/`h_thumb`).

## 2 · File chạm (dự kiến)

| File | Việc |
|---|---|
| `api/core/anh.py` | `kich_thuoc_thumb` |
| `api/api/schemas.py` | `AnhOut` + docstring |
| `api/api/trinh_bay.py` | `anh_ra` + nhánh `AnhOut` trong `du_lieu_the` |
| `api/tests/test_*.py` (file mới hoặc gần `anh`) | đo `kich_thuoc_thumb` + schema feed có `w_thumb` |
| `apps/web/components/noi-dung-the.tsx` | dùng thumb dims + style dành chỗ |
| `apps/web/components/gallery-moc.tsx` | `w_thumb`/`h_thumb` |
| `apps/web/e2e/don-vi/anh-feed-css.spec.ts` (mới) | hàng rào CSS |
| `packages/api-client/**` | sinh lại |
| `LOI-VA-NO.md` | đóng P-20260907-2/3/4 |

## 3 · Tiêu chí nghiệm thu

1. `kich_thuoc_thumb(200,100)==(200,100)`; `kich_thuoc_thumb(2048,1024)==(480,240)` (hoặc làm tròn tương đương đúng công thức plan); pytest xanh.
2. OpenAPI / TS `AnhOut` có `w_thumb`, `h_thumb`. Response feed `xem_truoc.anh` (pytest hoặc kiểm schema) có hai trường khi có ảnh.
3. `noi-dung-the.tsx` không còn gắn `width={xem_truoc.anh.w}` cho thumb; dùng `w_thumb` + `style.width` khi có số.
4. `pnpm e2e:don-vi -g "anh-feed-css"` (hoặc tên bài trong file mới) xanh; thử phá `width: 100%` vào `.anh` → đỏ → khôi phục.
5. `pnpm --filter web lint` exit 0; `pnpm test -- -k kich_thuoc_thumb` (hoặc tên test) xanh.
6. Sổ: P-20260907-2/3/4 → `ĐÓNG (<commit>)` hoặc ghi rõ commit khi user commit sau.

## 4 · Ghi chú thực thi

- Cây đang bẩn vì phiên **sắp xếp chuyên mục** — chỉ stage đúng file của việc này.
- Không `opus-dev`; phiên chính code + đo.
- Không commit code trừ khi user bảo (plan này commit riêng ở chặng 1).
