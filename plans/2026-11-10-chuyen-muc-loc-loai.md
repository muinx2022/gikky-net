# Trang chuyên mục `/s/<sub>`: chip lọc theo loại + nhãn loại trên thẻ

> **Trạng thái:** ĐÃ DUYỆT (user: "Thêm chip + nhãn", 2026-11-10), chưa chạy. Nhánh `v2`. Nối tiếp `plans/2026-11-10-homepage-v2.md`.

## 1. Bối cảnh

Chuyên mục (sub) **dùng chung** cho nhật ký, bài viết và chủ đề (user 2026-11-10: nhật ký HPG → `chung-khoan`, nhật ký USD/AUD → `ngoai-hoi`, bài viết cũng thuộc các chuyên mục ấy;
`GHI-CHU.md` việc 11). `Mach.sub` bắt buộc cho mọi loại; `loai_mach` là trục khác. Hôm nay `/s/<sub>` vẽ **lẫn mọi loại** trong một danh sách bằng cùng một thẻ `TheMach`, nên người đọc không
phân biệt được bài viết với nhật ký. User hỏi "vào một chuyên mục sẽ thấy cả hai?" — đúng — và chọn: **thêm chip lọc + nhãn loại**.

`/s/*` là trang bot vào nhiều (30 ngày: `/s/*` 68 người / 3.458 bot) nên ràng buộc SEO của `GHI-CHU.md` việc 11 áp đầy đủ: **chỉ CỘNG, không BỚT**.

## 2. Thiết kế

1. **Hàng chip lọc loại** trên `/s/<sub>`: "Tất cả · Nhật ký · Bài viết · Chủ đề" (`<nav aria-label="Lọc theo loại">`, mỗi chip là `<Link>` thật, mục đang chọn `aria-current="true"` kiểu giống chip khoảng thời gian).
   - "Tất cả" là mặc định và **không** thêm `loai_mach` vào URL; ba chip còn lại thêm `?loai_mach=nhat_ky|bai_viet|thao_luan`.
   - Giữ `tab`, `khoang`, `truong_phai` đang có; **bỏ `cursor`** (đổi loại là về trang đầu).
   - Đặt dưới header của chuyên mục, trên thanh tab (dev chọn chỗ hợp với `feed.module.css`, không màu mới). Trên 375px cho phép xuống dòng (`flex-wrap`), không cuộn ngang trang.
2. **Nhãn loại nhỏ trên mỗi thẻ** của `/s/<sub>`: "Nhật ký" / "Bài viết" / "Chủ đề" (chip nhỏ, token sẵn có như chip `s/sub` / chip trạng thái của khối chủ đề). `TheMach` nhận prop tuỳ chọn `hienNhanLoai` (mặc định `false`),
   **chỉ trang sub bật** (qua `Feed` khi có `sub`, và qua `CuonVoHan` cho trang 2 trở đi — thẻ nạp thêm phải có nhãn y như trang đầu). Mọi nơi khác dùng `TheMach` (hồ sơ `/u/…`, tìm kiếm, `/?tab=…`, khối nhật ký trên `/`) **không đổi một byte DOM**.
3. **`app/s/[sub]/page.tsx`**: đọc `?loai_mach=` bằng `docLoaiMach` (giá trị lạ ⇒ bỏ qua, ra "Tất cả", **không** 500), truyền `loai_mach` vào `docFeedSub` (hàm đã nhận tham số này từ Đợt A) và `loaiMach` vào `Feed`.
4. **Chip "Loại: … ✕ Bỏ lọc" hiện có** của `Feed` (dùng ở `/?tab=…&loai_mach=…`): trên trang sub, hàng chip mới thay nó (đừng hiện cả hai).
5. **Trạng thái rỗng khi lọc:** "Chưa có {nhãn thường} nào trong chuyên mục này." (vd "Chưa có bài viết nào trong chuyên mục này."), kèm link về "Tất cả". Không in số 0.
6. **SEO:** `generateMetadata` của `/s/<sub>` không phụ thuộc `searchParams` ⇒ canonical của `?loai_mach=…` vẫn là trang gốc (giống cách `?tab=` đang xử lý); KHÔNG đổi title / description / OG / Twitter / RSS alternate. Chip là `<a>` thường như các link tab hiện có.
7. **Cuộn vô hạn / cursor:** trang 2 trở đi giữ đúng `loai_mach` (đã có xuyên qua `CuonVoHan`), link cursor thật vẫn có trong HTML thô.

## 3. Phạm vi

### LÀM
`app/s/[sub]/page.tsx`; `components/feed.tsx` (chỉ nhánh có `sub`); `components/the-mach.tsx` (+ prop, + CSS Module chỉ cho nhãn); `components/cuon-vo-han.tsx`; một component nhỏ cho hàng chip (vd `components/loc-loai-mach.tsx` + `.module.css`) và một hàm thuần dựng href của chip (đặt ở `lib/`, test don-vi được); spec e2e + don-vi.

### KHÔNG LÀM
- `<head>` / title / description / OG / canonical của `/s/*`; `/feeds/moi` và mọi API; sitemap; RSS.
- Tách trang chuyên mục thành khối như trang chủ (hướng 3 user đã không chọn).
- Đổi chuyên mục của mạch nào; thêm chuyên mục mới; `apps/admin`, `apps/mobile`, `scripts/`, `api/`.
- Màu, token, font. Cột trái của `/s/*` (vẫn ba cột).

## 4. Tiêu chí nghiệm thu (đo được)

**Thứ tự bắt buộc:** (a) với frontend CŨ (chưa sửa dòng nào), dựng Django (8000, `gikky_e2e`) + `next build` + `next start` (3000) rồi chụp HTML thô nền của: `/s/chung-khoan` (chỉ nhật ký), `/s/e2e-thu-nghiem` (đủ ba loại), `/s/e2e-sub-rong` (rỗng), `/s/e2e-thu-nghiem?tab=dang-dien-ra`, `/?tab=moi`, một `/u/<user có mạch>`, `/tim-kiem?q=…`; (b) code; (c) đo lại.

| # | Kiểm | Kết quả mong đợi |
|---|---|---|
| H1 | `<head>` của `/s/chung-khoan`, `/s/e2e-thu-nghiem` (title, description, canonical, og:*, twitter:*, RSS alternate, JSON-LD) nền vs sau | Y hệt từng byte |
| H2 | HTML thô của `/s/e2e-thu-nghiem` (mặc định "Tất cả") sau khi **loại bỏ** mọi phần tử `[data-testid="loc-loai"]` (hàng chip) và `[data-testid="nhan-loai"]` (nhãn) | **Y hệt** DOM nền: cùng mạch, cùng thứ tự, cùng link — chứng minh "chỉ cộng" |
| H3 | `/?tab=moi`, `/u/<user>`, `/tim-kiem?q=…` nền vs sau | Y hệt (không có `nhan-loai` nào) |
| C1 | Chip trên `/s/e2e-thu-nghiem` | Có 4 chip; "Tất cả" `aria-current`; href đúng: Tất cả = `/s/e2e-thu-nghiem`, ba chip kia thêm `loai_mach`; trên `?tab=dang-dien-ra&khoang=…&loai_mach=bai_viet` mỗi chip giữ `tab`/`khoang`, bỏ `cursor` |
| C2 | Lọc `bai_viet` / `nhat_ky` / `thao_luan` trên `e2e-thu-nghiem` | Danh sách chỉ gồm loại đó, id **trùng** với API `GET` feed sub cùng `loai_mach` (đối chiếu từng id, thứ tự) |
| C3 | Nhãn trên "Tất cả" | Mỗi thẻ có đúng một nhãn khớp `loai_mach` của mạch (đối chiếu với API) |
| C4 | `?loai_mach=abc`, `?loai_mach=` | 200, ra "Tất cả" (không 500). *(Đính chính sau khi code: `?loai_mach=nhat_ky&loai_mach=abc` lọc `nhat_ky` — `docLoaiMach` lấy giá trị ĐẦU, dùng chung với `/`; plan ban đầu ghi "ra Tất cả" nên tự mâu thuẫn với mục 2.3. Hành vi giữ nguyên, có bài e2e ghim.)* |
| C5 | Lọc rỗng (`/s/chung-khoan?loai_mach=bai_viet`) và sub rỗng | 200, dòng "Chưa có bài viết nào trong chuyên mục này." + link "Tất cả"; sub rỗng giữ câu cũ |
| C6 | Cuộn vô hạn trên `e2e-thu-nghiem?loai_mach=bai_viet` | Trang 2 cùng loại, cùng thứ tự API, **có nhãn**; link cursor thật trong HTML thô |
| C7 | 375px và theme tối: `/s/e2e-thu-nghiem` và một URL lọc | Không tràn ngang (`scrollWidth ≤ innerWidth`), chip xuống dòng gọn, đọc được ở cả hai theme |
| C8 | Màu | grep mã màu trong file mới / đổi ⇒ 0; `mau-token.spec.ts`, `quan-tri-giao-dien.spec.ts`, `seo-trang-chu.spec.ts` xanh, không sửa |
| C9 | Hàm thuần dựng href chip (don-vi) | Đủ ca: giữ / bỏ tham số, "Tất cả" không có `loai_mach`, ký tự đặc biệt trong `truong_phai` được mã hoá |
| G | `pnpm codegen:check`, `pnpm lint` 0 warning, `pnpm build`, `pnpm e2e:don-vi`, bộ e2e đầy đủ (`CI=1`, `gikky_e2e`) | Xanh; đỏ sau ⊆ đỏ nền (24 bài, sổ `P-20261110-5`); vân tay `gikky_dev` không đổi |

## 5. Rủi ro
- **Bài đo hiện có của `/s/*`** (`vo-reddit.spec.ts` A8 / B10, `seo-va-trang.spec.ts`, `giao-dien.spec.ts`): có thể đếm thẻ / link theo cấu trúc cũ; sửa chỉ khi bài đo phụ thuộc thứ vừa thêm, KHÔNG nới assertion.
- **Thêm 3 URL lọc × số chuyên mục** làm tăng URL bot có thể bò (8 chuyên mục → +24 URL chưa tính tab). Canonical về trang gốc nên không tạo trùng lặp index; theo dõi lượt bot vào `/s/*` sau deploy.
- **Nhãn "Chủ đề" ở thẻ** cho mạch `thao_luan` — dùng chữ ngắn, không "tham gia" (A8 cấm chữ đó ở trang chủ; ở `/s/*` kiểm lại).

## Báo cáo thực thi

*(điền ở chặng 5)*
