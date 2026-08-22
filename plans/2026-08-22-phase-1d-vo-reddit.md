# Plan con — Phase 1d: vỏ Reddit (chỉ đọc)

> Nguồn: `plans/2026-08-22-roadmap-vo-reddit-va-phase-2-6.md` + 7 quyết định user chốt
> 2026-08-22 (đã ghi vào `PLAN.md`). Ngày 2026-08-22.
> Không cần auth ⇒ ship được trước Phase 2.

## 0. Bảy quyết định đã vào `PLAN.md` — đọc ở đó, đừng chép lại

`PLAN.md` 5.5 (dải gập `2…n−3`, **ngưỡng `n ≥ 6`**) · 5.2 (mốc ẩn giữ ô + nhãn) · 5.6 rào 3
(**không tính tự trích**) · 9.1 (danh sách hoàng thổ là **NGUỒN** của allowlist) · mục 3 nguyên
tắc 9 (**áp cả cho hồ sơ**) · 5.5 (**"câu đáng đọc" = hợp thật**) · mục 4 (**"Tham gia sub" bị
loại khỏi v1, KHÔNG render nút disabled**).

## 1. Giá trị đã chốt

| Hạng mục | Chốt | Lý do |
|---|---|---|
| Điểm mạch | **`Mach.diem_bai_goc`** = điểm của mốc `seq=1`, denormalize, cập nhật trong `cap_nhat_dem_mach` | User chốt. `JOIN` sang `Moc` rồi `ORDER BY` không index được; kỷ luật denormalize đã có sẵn ở `PLAN.md` mục 6 |
| Mốc 1 bị ẩn / bia mộ | `diem_bai_goc = 0` | Điểm là **nội dung**, không phải cấu trúc (luật đếm `PLAN.md` mục 6). Khớp đúng cách `nut_ra`/`moc_ra` đã zero hoá số phiếu bia mộ ở 1b/1c |
| Index | `(diem_bai_goc DESC, id DESC)` và `(created_at DESC, diem_bai_goc DESC)` | Top toàn thời gian và Top theo khoảng |
| Sort mới | `?sort=nhieu_diem&khoang=ngay\|tuan\|thang\|tat_ca` trên **cả hai** feed sẵn có | `PLAN.md` mục 4 chỉ cấm "mốc mới bump feed Hot"; Top theo điểm là cơ chế khác |
| Khoảng thời gian | lọc theo `Mach.created_at`, mốc thời gian tính theo **giờ VN** | `PLAN.md` mục 1 |
| Mũi tên vote ở 1d | **render, nhưng `disabled`** + `title="Đăng nhập để vote"` | Khác nút "Tham gia sub" ở chỗ: nó **sẽ** sống ở Phase 2. Nút không bao giờ sống mới là thứ bị cấm |
| Bố cục | Reddit: cột vote trái · dòng dày đặc · sidebar phải · sub header | Giữ nguyên bảng màu/font/chất liệu `PLAN.md` 9.1 |

## 2. Hạng mục việc

### 2.1 Backend — `diem_bai_goc` + sort Top
- Cột + migration + 2 index; tính trong `cap_nhat_dem_mach` (**đường ghi duy nhất**, đã tự khoá
  hàng `Mach`). Ca mốc 1 ẩn/bia mộ → `0`.
- `MachTomTatOut.diem`.
- `?sort=nhieu_diem&khoang=…` cho `/feeds/moi` và `/feeds/dang-dien-ra`; `khoang` sai → 400
  `{detail, code}`. **`operation_id` giữ nguyên** (thêm query param, không thêm endpoint).
- Phân trang Top: cursor keyset trên `(diem_bai_goc, id)` — **không** dùng offset.

### 2.2 Backend — "câu đáng đọc" (`PLAN.md` 5.5)
`GET /machs/{id}/comments` thêm `?dang_doc=1` (hoặc trường riêng trong `KhanDaiOut` — plan con của
thợ chốt, miễn **một** cách): trả tập **`đã trích ∪ top-10 wilson`**.
**Bài đo phải phân biệt được hợp thật với "chỉ top-10"**: `r7` của seed cố ý nằm hạng 12/14, nên
cài thành "chỉ top-10" là mất nó ⇒ ĐỎ.

### 2.3 Backend — sub header
`GET /subs/{slug}` (mới): `ten`, `mo_ta`, `so_mach`, `created_at`. **Thêm endpoint ⇒ cập nhật
bảng `PLAN.md` mục 7** (PLAN tự cho phép, nhưng bắt phải ghi lại).

### 2.4 Seed — để Top có nghĩa
Điểm mốc 1 của 3 mạch phải **khác nhau rõ**, **và ít nhất một mạch có mốc 1 điểm thấp mà mốc sau
điểm cao**. Không thế thì Top và Mới ra cùng thứ tự và bài đo không phân biệt được cài đúng với
cài sai — đúng bài học seed của 1a (W6).
⚠ **Đụng seed là đụng nền của ~30 bài đo 1a/1b/1c.** Nếu phải đổi số của mạch HPG thì **dừng lại
và báo** — mài cùn bài đo đang có răng là thứ 1c đã từ chối làm.

### 2.5 Frontend — vỏ Reddit
1. **Thẻ feed**: cột vote trái (số + 2 mũi tên disabled), thân dày đặc, `💬 N` thành nút thật
   dẫn tới khán đài.
2. **`/s/<sub>`**: header (tên, `mo_ta`, số mạch, ngày lập) + **sidebar phải** (mô tả, luật rút
   gọn dẫn `/luat`, danh sách sub khác). **KHÔNG có nút "Tham gia"** (`PLAN.md` mục 4).
3. **Sidebar trang chủ**: giới thiệu 2 dòng + `/luat` + danh sách sub.
4. **Tab sort thứ ba** "Nhiều điểm nhất" + chọn khoảng — qua **URL param**, giữ đúng luật
   `PLAN.md` nguyên tắc 7 "không bao giờ tự đổi sort ngầm".
5. **Gập/mở nhánh `[−]`** trong khán đài và ngăn kéo (client, chỉ đọc).
6. **Cột vote trên thẻ mốc** (disabled) — để Phase 2 không phải vẽ lại bố cục.
7. **Khối "Câu đáng đọc"** trên cùng khi bung khán đài (2.2).
8. Nén mật độ dòng theo 9.1.
9. **Ngưỡng gập `n ≥ 6`** — sửa `NGUONG_KHONG_GAP` 4 → 5 + bài đo.
10. **Hồ sơ**: ẩn cả khối chỉ số khi user chưa hoạt động, thay bằng một dòng.

### 2.6 Trả nợ Phase 1 (đang sờ đúng file)
- **#11** `sitemap.ts` chạm trần `TRAN_TRANG` thì im lặng bỏ phần còn lại → phải kêu.
- **#12** `lighthouse-seo.mjs` `nguong` rỗng/`NaN` → mọi điểm đều qua.
- **#13** hàng rào trang lỗi **mù với render có điều kiện** (`{!dangThu && <button reload>}` xanh).
- **#14** đường thoát trang lỗi trỏ vào **chính route đang treo** → đổi sang route TĨNH (`/luat`).
- **allowlist `--stamp` phải suy từ `PLAN.md` 9.1**, không phải danh sách tự chế (quyết định 4).

## 3. Tiêu chí nghiệm thu

| # | Tiêu chí | Cách đo |
|---|---|---|
| A1 | `diem_bai_goc` đúng điểm mốc 1; mốc 1 ẩn/bia mộ → `0` | test Python + thử phá |
| A2 | Sort Top đúng thứ tự, **khác** thứ tự Mới trên seed | test API; **mutant "sort theo created_at" phải ĐỎ** |
| A3 | `khoang` lọc đúng theo giờ VN; giá trị sai → 400 | test |
| A4 | Cursor Top không trùng/sót khi trùng điểm | test (dựng ≥2 mạch cùng `diem_bai_goc`) |
| A5 | "Câu đáng đọc" = **hợp thật**; mutant "chỉ top-10" **ĐỎ** (mất `r7`) | test |
| A6 | `GET /subs/{slug}` sống; slug lạ → 404; bảng `PLAN.md` mục 7 đã cập nhật | curl + đọc |
| A7 | Thẻ feed có cột vote; mũi tên `disabled` kèm lý do | Playwright |
| A8 | `/s/<sub>` có header + sidebar; **KHÔNG có nút Tham gia** | Playwright (assert vắng mặt) |
| A9 | Tab "Nhiều điểm nhất" + khoảng, đổi qua URL param | Playwright |
| A10 | `[−]` gập/mở được ở cả khán đài lẫn ngăn kéo | Playwright |
| A11 | `n = 5` → **KHÔNG gập**; `n = 6` → gập 2 mốc | unit + thử phá |
| A12 | Hồ sơ user chưa hoạt động: **không có `×0` nào**, có dòng thay thế | Playwright |
| A13 | Nợ #11–#14 xong, mỗi cái có bài đo giết được mutant | thử phá |
| A14 | allowlist `--stamp` suy từ `PLAN.md` 9.1 | đọc + thử phá (thêm selector lạ → ĐỎ) |
| A15 | **Không hồi quy**: 351 Python + 133 e2e (cộng bài mới), 0 warning, codegen khớp, lint/build/tsc sạch, Lighthouse SEO ≥ 90 | chạy |
| A16 | Chưa commit; không rác; `seed_dev --reset` chạy được | `git status` + chạy |

## 4. Rủi ro
1. **Seed là nền của ~30 bài đo.** Xem 2.4 — đổi số HPG thì dừng và báo.
2. **Cột vote disabled dễ thành "nút chết"** — phải có `title`/`aria-disabled` nói rõ lý do, đúng
   bài học `error.tsx` của 1c.
3. **Sort thứ ba làm bài đo cursor phình tổ hợp** (3 sort × 4 khoảng × 2 feed). Chọn ca đại diện
   + một bài duyệt tổ hợp, đừng viết 24 bài na ná.
4. **Khuôn mẫu đã lặp BỐN lần ở 1c: mỗi lượt vá tự đẻ ra một cửa mới của chính luật nó đang đóng.**
   Khi sửa #11–#14, quét cả họ hàng chứ đừng vá đúng dòng được chỉ.
