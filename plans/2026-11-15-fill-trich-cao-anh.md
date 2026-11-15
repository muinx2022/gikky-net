# Fill đoạn trích thẻ feed cao ngang ảnh nhỏ

> **Trạng thái:** ĐÃ LÀM + ĐÃ LÊN prod (2026-11-16) — commit `8750a60`; T5 e2e T13 chưa đo local (DB thiếu 0047/0048); feed prod `max_trich=400`

## Vấn đề

Trên thẻ `TheMach` (vd `/s/chung-khoan`), khi có ảnh nhỏ 168×104, đoạn
`xem_truoc.trich` kẹp `-webkit-line-clamp: 3` (~60px) thấp hơn khung ảnh (104px)
— khoảng trống dưới chữ, chữ không “fill” cạnh ảnh.

## Quyết định

| Khi nào | Số dòng | Lý do |
|---|---|---|
| Có ảnh, desktop (>640px) | **5** | `104 / (13×1.55) ≈ 5,16` — 5 dòng ≈ cao khung ảnh |
| Có ảnh, mobile (≤640px) | **4** | ảnh 76×76; `76 / 20,15 ≈ 3,8` → 4 |
| Không ảnh | **3** (giữ) | `SO_DONG_TRICH` hiện tại; không phình thẻ chữ-only |

Nới `DAI_TRICH_FEED` **240 → 400** để 5 dòng ở bề rộng cột chính không hết chữ
server sớm hơn CSS (≈ 55–60 ký tự/dòng × 5 ≈ 300; đệm 400).

## LÀM

1. **CSS** `apps/web/components/the-mach.module.css`
   - `.trich` giữ `line-clamp: 3` (không ảnh / fallback).
   - `.than:has(.anh_o) .trich { -webkit-line-clamp: 5; }`
   - Trong `@media (max-width: 640px)`: `.than:has(.anh_o) .trich { -webkit-line-clamp: 4; }`
2. **Hằng TS** `apps/web/lib/xem-truoc-anh.ts`
   - Giữ `SO_DONG_TRICH = 3`.
   - Thêm `SO_DONG_TRICH_CO_ANH = 5` và `SO_DONG_TRICH_CO_ANH_MOBILE = 4` (comment
     trỏ CSS tương ứng; don-vi ghim).
3. **API** `api/api/schemas.py`: `DAI_TRICH_FEED = 400`. Cập nhật docstring /
   chú thích gần đó nếu còn viết “240” / “ba dòng”. `trich_van_ban` dùng hằng —
   không đổi logic.
4. **Hàng rào don-vi** (file hiện có hoặc mở rộng
   `apps/web/e2e/don-vi/xem-truoc-anh.spec.ts` / bài CSS thẻ):
   - Đọc CSS: `.trich` clamp 3; có rule `.than:has(.anh_o) .trich` = 5; trong
     media ≤640 = 4.
   - `SO_DONG_TRICH === 3`, `SO_DONG_TRICH_CO_ANH === 5`,
     `SO_DONG_TRICH_CO_ANH_MOBILE === 4`.
   - `DAI_TRICH_FEED` trong `schemas.py` === 400 (regex đọc nguồn, giống cách
     ghim `SO_ANH`).
5. **Pytest** liên quan `DAI_TRICH_FEED` (vd `test_api_feeds.py`) — chạy lại;
   assertion dùng hằng nên tự theo 400. Nếu có số cứng `240` trong test/docstring
   trong phạm vi → sửa theo hằng.

## KHÔNG LÀM

- Không sửa nội dung bài PVD / seed / DB.
- Không đụng `khoi-thao-luan` (đã clamp 6, CSS riêng).
- Không đụng mobile app `MachCard` (lượt này chỉ web).
- Không đổi meta `tomTat` trang mạch (cắt ~155, nguồn `body` mốc 1).
- Không đụng file `M` phiên khác: `quan_tri_*`, admin users/mach, `openapi.admin`,
  `src-admin`, `dang-bai.py`, `chu-de.md`, `LOI-VA-NO.md` (trừ mục sổ mới nếu
  phát hiện ngoài phạm vi — chỉ phiên chính ghi).
- Không commit / push / deploy.

## Tiêu chí đo

| # | Lệnh / kiểm | Kết quả mong đợi |
|---|---|---|
| T1 | `pnpm e2e:don-vi -g "xem-truoc-anh"` (và bài don-vi mới nếu tách file) | xanh; ghim clamp + hằng |
| T2 | `pnpm test -- -k trich_doan` (hoặc `test_trich_doan_go_dau_markdown`) | xanh; `len ≤ DAI_TRICH_FEED+1` với 400 |
| T3 | Thử phá: đặt lại clamp có-ảnh = 3 → T1 đỏ; khôi phục → xanh | báo cáo |
| T4 | (Tuỳ chọn nếu `web:dev`/`next start` sẵn) `/s/chung-khoan`: thẻ có ảnh, chiều cao `.trich` ≥ ~95px (gần 104) khi chữ đủ dài | quan sát / CDP |

## Ảnh hưởng đã chấp nhận

- Mọi list dùng `TheMach` (/, /s/*, hồ sơ, tìm kiếm khi có ảnh) — cùng CSS.
- Payload `xem_truoc.trich` dài hơn tối đa ~160 ký tự trên mọi endpoint đi qua
  `du_lieu_the` (feeds, ho_so, users, tim_kiem cho ảnh; chữ search vẫn
  `doan_trich`).
- Thẻ không ảnh: clamp vẫn 3; bài dài có thể đầy 3 dòng (trước đây ~240 ký tự
  thường chỉ ~2 dòng ở cột rộng) — chấp nhận.

## Lượt sửa V1 (sau phản biện)

**Phát hiện:** nới `DAI_TRICH_FEED` → 400 làm `khoi-thao-luan` (đọc cùng
`xem_truoc.trich`, clamp 6) bị cắt ở viewport 390 — trái plan
`2026-11-13-ban-tin-len-dau-ban-quyen` và sẽ làm đỏ e2e T13
(`dai-ban-tin.spec.ts`).

**Hướng chốt:** giữ API 400 cho thẻ feed; **cắt lại ở client** trong khối thảo
luận về trần cũ ~240 ký tự (cắt ở khoảng trắng + `…`), để 6 dòng vẫn hiện trọn
bối cảnh như plan 13/11. Không nâng clamp khối chủ đề.

### LÀM thêm

1. `apps/web/components/khoi-thao-luan.tsx` (và/hoặc helper thuần cạnh nó / trong
   `lib/`): trước khi gán `boi_canh`, cắt chuỗi `xem_truoc.trich` xuống
   `DAI_BOI_CANH_CHU_DE = 240` (hằng xuất / dùng chung chỗ đo). Cắt giống tinh
   thần `trich_van_ban` (khoảng trắng gần nhất, thêm `…` nếu cắt). Comment: API
   đã nới 400 cho thẻ feed; khối này cố ý giữ 240.
2. Don-vi: ghim hằng 240 + chỗ gọi cắt trong `khoi-thao-luan` (đọc nguồn); unit
   helper nếu tách hàm thuần (vài ca: ngắn hơn 240 giữ nguyên; dài cắt + `…`).
3. Sửa comment `dai-ban-tin.spec.ts` còn ghi «server tự cắt ~240» → «khối cắt
   client ~240; API feed có thể dài hơn».
4. Tiêu chí mới **T5**: nếu cổng 3000+8000 trống và được phép seed e2e thì
   `pnpm e2e -g "T13"` xanh ở 1280 và 390; nếu cổng đang bị chiếm → ghi «chưa
   đo T5», don-vi + unit helper vẫn bắt buộc xanh.

### KHÔNG LÀM (V1)

- Không hạ lại `DAI_TRICH_FEED` về 240 (làm hỏng mục fill 5 dòng cạnh ảnh).
- Không đổi `line-clamp` của `khoi-thao-luan`.
- Không đụng mobile `MachCard`.
- Vẫn không commit.
