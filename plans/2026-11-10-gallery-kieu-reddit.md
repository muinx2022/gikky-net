# Gallery kiểu Reddit cho hàng "Bài viết" ở trang chủ

Ngày 2026-11-10. Nhánh `v2`. Thay phần "≥ 2 ảnh" của `plans/2026-11-10-bai-viet-xem-truoc-anh.md`.
Không đổi: hàng 0 ảnh (3 dòng chữ), hàng 1 ảnh (một thumb + một dòng chữ), màu, `<head>`/h1/lede của `/`.

## 1. Yêu cầu của user (nguyên văn)

> "homepage, phần gallery, làm 1 dạng gallery như của reddit luôn, không phải show list ảnh như vậy"

Hiện tại hàng ≥ 2 ảnh vẽ **ba thumb nằm ngang cạnh nhau** (`+N` ở thumb thứ ba). User muốn **một khung ảnh duy nhất
lật qua từng ảnh** như gallery trong feed Reddit.

## 2. Thiết kế (phiên chính chốt; user chưa duyệt chi tiết — chỉnh được sau khi xem)

Một khung `.gallery` full bề rộng cột nội dung, **một ảnh một lúc**, lật bằng vuốt / cuộn ngang / nút mũi tên.

| Thành phần | Quyết định |
|---|---|
| Khung | `width:100%`, `aspect-ratio` = tỉ lệ ảnh ĐẦU kẹp **[1 ; 16/9]** (hàm mới `tyLeKhungGallery`), `max-height: 360px`. Khung có kích thước từ trước khi ảnh nạp ⇒ không dịch bố cục (CLS). Nền `var(--inset)`, viền `1px var(--line)`, bo 8px. |
| Ảnh | `object-fit: contain` trong từng slide (ảnh dọc không bị cắt, phần thừa là nền khung), watermark `gikky.net` ở góc phải dưới MỖI slide như thumb cũ. |
| Track | `<ul>` flex ngang, `overflow-x:auto`, `scroll-snap-type:x mandatory`, mỗi slide `flex:0 0 100%` + `scroll-snap-align:center` + `scroll-snap-stop:always`, ẩn thanh cuộn, `overscroll-behavior-x:contain`. Vuốt trên cảm ứng và cuộn ngang bằng trackpad chạy **không cần JS**. |
| Nút | Hai `<button type="button">` tròn 32px trái / phải giữa khung, `aria-label="Ảnh trước"` / `"Ảnh sau"`, mũi tên là SVG inline `aria-hidden`. Nền `color-mix(in srgb, var(--topbar) 62%, transparent)`, mũi tên `var(--on-brand)`. **Chỉ hiện khi** `(hover:hover)` và con trỏ ở trong khung hoặc nút đang focus; ẩn hẳn khi `(hover:none)` (điện thoại: vuốt). Nút "trước" ẩn ở ảnh đầu, "sau" ẩn ở ảnh cuối. Cuộn mượt `behavior:"smooth"`, đổi `"auto"` khi `prefers-reduced-motion: reduce`. |
| Bộ đếm | Pill `n/N` góc trên phải (tokens như nút), `N = so_anh` thật. Là vùng `aria-live="polite"` đọc "Ảnh n trên N". Cập nhật theo `scroll` (`round(scrollLeft / clientWidth)`, gộp bằng `requestAnimationFrame`). |
| Số ảnh tối đa | API trả tối đa **10** ảnh (`SO_ANH_XEM_TRUOC` 3 → 10). Nếu `so_anh` > số ảnh trả về thì thêm **một slide cuối** là link tới bài, chữ `Xem tất cả {so_anh} ảnh →` (link thật, không `aria-hidden`; bộ đếm ẩn ở slide này). |
| Bấm | Mỗi slide ảnh bọc trong `<Link href=bài aria-hidden tabIndex={-1}>` như thumb cũ (cùng `href`, nằm trên lớp phủ `::after` của link tiêu đề nhờ `z-index`) ⇒ bấm ảnh mở bài; vuốt không kích hoạt link. Nút mũi tên là anh em của track, KHÔNG nằm trong link ⇒ bấm nút không mở bài. |
| Nạp ảnh | Chỉ ảnh đầu có thể ở viewport lúc đầu; mọi `<img>` `loading="lazy"` + `decoding="async"` (slide ngoài khung ngang không bị tải). Lần đầu con trỏ / ngón tay / focus vào khung (`pointerenter`/`touchstart`/`focusin`) thì client đặt `loading="eager"` cho mọi `<img>` của khung để slide kế tiếp không trắng. |
| Một ảnh | GIỮ NGUYÊN bản thumb đơn hiện tại (user: "1 ảnh thì hiển thị 1 ảnh"). |
| Dòng chữ | Giữ một dòng `trich` dưới khung (chú thích + chỗ dựa khi ảnh 404). |
| Server / client | Slide là phần tử **server-render** (mọi `<img>` có trong HTML cho bot, cùng HTML mọi UA). Chỉ một component client mới `gallery-bai-viet.tsx` (`"use client"`) nhận `children` (các slide) + `soAnh` + `tieuDe` và lo nút, bộ đếm, cuộn, nạp sớm. Không `loading.tsx` / `<Suspense>` ở `/`. |

Tiêu chí a11y đã chốt: nhóm `role="group"` `aria-roledescription="carousel"` `aria-label="Ảnh của bài: {tiêu đề}"`; `trich` vẫn là `<p>` ngoài mọi `aria-hidden`; chỉ link bọc ảnh bị `aria-hidden` (đúng lập luận của vòng sửa trước: tránh hai link cùng tên); mỗi hàng vẫn chỉ có hai link nhìn thấy với trình đọc màn hình (tiêu đề, `s/<sub>`) — **trừ** hàng có slide "Xem tất cả … ảnh" (ba link, tên khác nhau).

## 3. Việc cần làm

**API** (`api/api/schemas.py`, `api/api/trinh_bay.py`, seed + test):
1. `SO_ANH_XEM_TRUOC = 10`, sửa chú thích; `anh_khac` = ảnh 2..10 (tên trường GIỮ NGUYÊN, không đổi breaking). Hai nhánh `du_lieu_the` (gallery `MocAnh` và ảnh nhúng) cắt theo hằng; nhánh ảnh nhúng vẫn khử trùng trước khi đếm; **không thêm truy vấn** (`test_api_so_query.py` họ feed không sửa `SO_QUERY`; `khoas_can_tra` lấy tới 10 khoá vẫn MỘT truy vấn `AnhNoiDung`).
2. `seed_e2e.SO_ANH_BAI_VIET_MOI` = `(0, 1, 2, 3, 5, 1, 3, 2, 12, 0)` (hàng thứ 9 có 12 ảnh ⇒ ca "Xem tất cả 12 ảnh"); sửa `test_seed_e2e.py` tính theo hằng, không chép số.
3. Đo kích thước JSON `GET /api/v1/feeds/moi?limit=20` TRƯỚC / SAU (cùng DB `gikky_e2e` đã seed) và ghi vào báo cáo. `pnpm codegen:check` phải khớp (docstring `XemTruocOut` đổi thì chạy `pnpm codegen`).
4. Test pytest: `anh_khac` dài tối đa 9 khi ≥ 10 ảnh; 12 ảnh ⇒ `so_anh=12`, `len(anh_khac)=9`; gallery + ảnh nhúng đều theo hằng.

**Web** (`apps/web`):
1. `lib/xem-truoc-anh.ts`: thay `SO_THUMB_TOI_DA` bằng `SO_ANH_GALLERY_TOI_DA = 10` (khớp API — thêm bài don-vi đọc `api/api/schemas.py` bằng regex và so với hằng TS); `chonThumb` → trả `{ anhs, con_lai }` với `anhs` = `[anh, ...anh_khac]` cắt ở hằng, `con_lai = max(0, so_anh - anhs.length)` (KHÔNG còn điều kiện "gallery đã đầy 3"); `tyLeKhungGallery(anh)` kẹp [1 ; 16/9]; GIỮ `tyLeKhung` cho nhánh 1 ảnh.
2. `components/gallery-bai-viet.tsx` + `.module.css` (client + style của khung / nút / bộ đếm); `khoi-bai-viet.tsx` nhánh ≥ 2 ảnh dùng nó, nhánh 1 ảnh giữ nguyên.
3. Bài đo mới / viết lại (xem §4), thử phá từng cái.

## 4. Tiêu chí nghiệm thu (mỗi mục một bài đo + thử phá)

| # | Tiêu chí |
|---|---|
| R1 | Hàng 2 / 3 / 5 / 12 ảnh: đúng MỘT khung `.gallery`; tại một thời điểm đúng một slide chiếm ≥ 90% bề rộng khung (không còn ba thumb cạnh nhau); số slide ảnh = `min(so_anh, 10)`, thứ tự đúng `[anh, ...anh_khac]`. |
| R2 | Bấm nút "Ảnh sau" ⇒ `scrollLeft` tăng đúng một slide, bộ đếm `1/5 → 2/5`; "Ảnh trước" ngược lại; nút trước ẩn ở ảnh đầu, nút sau ẩn ở ảnh cuối; **không điều hướng** (URL giữ nguyên). |
| R3 | Cuộn ngang bằng `scrollTo` (mô phỏng vuốt) cập nhật bộ đếm; ở viewport 375 cảm ứng (`hasTouch`, `isMobile`) nút ẩn, trang không tràn ngang. |
| R4 | Bấm vào ảnh (không phải nút) mở đúng bài; bấm đoạn `trich` và `s/<sub>` vẫn đúng như vòng trước. |
| R5 | Hàng 12 ảnh: có slide cuối `Xem tất cả 12 ảnh →` là link thật tới bài; bộ đếm ẩn ở slide đó; hàng 5 ảnh KHÔNG có slide đó. |
| R6 | CLS: khung có `aspect-ratio` đúng tỉ lệ ảnh đầu (kẹp) và cao > 0 TRƯỚC khi ảnh nạp (chặn request ảnh); chiều cao hàng không đổi sau khi ảnh nạp; CLS khối ≤ 0,01 như bài B5. |
| R7 | A11Y: `trich` vẫn nằm ngoài `aria-hidden`; nút có `aria-label`; bộ đếm `aria-live`; nút bấm được bằng bàn phím (Enter/Space); không còn hai link cùng tên trong một hàng (bài `O` của `trang-chu-v2.spec.ts` xanh, KHÔNG sửa). |
| R8 | SEO: `<head>`/h1/lede của `/` giữ từng byte; chữ thân HTML của `/` không giảm; tập link `/m/` không giảm; mọi `<img>` của slide có trong HTML server (bot và trình duyệt cùng số `<img>` — bài S3); `/luat` vẫn `○` tĩnh; không `loading.tsx`/`<Suspense>`. |
| R9 | Màu: không mã màu thô (`mau-token.spec.ts`, `quan-tri-giao-dien.spec.ts` xanh, không sửa); theme tối đọc được nút, pill, nền khung. |
| R10 | Ảnh 404 (thumb xoá khỏi đĩa): khung giữ kích thước, nút vẫn chạy, không lỗi console lạ (bài B8 cập nhật). |
| R11 | Payload: đo JSON feed trước / sau; JS tải đầu của `/` (First Load JS) trước / sau (`pnpm build` bảng route) — báo cáo, không chặn nếu ≤ +5 kB. |
| G | `pnpm lint` 0 warning, `tsc`, `pnpm codegen:check`, `pnpm build`, `pnpm e2e:don-vi`, `pnpm test` (đỏ ⊆ 17 đỏ nền), e2e đầy đủ `CI=1` + `gikky_e2e` (đỏ ⊆ ~23 đỏ nền), vân tay `gikky_dev` không đổi. |

Các bài đo cũ của thumb ba-cạnh-nhau (`B3`, `B4`, `B6`, `B7`, `B8`, `S3`, `L`, `N2`, `N4`, `N8` trong
`bai-viet-xem-truoc.spec.ts` / `don-vi/xem-truoc-anh.spec.ts`) **đo thứ sản phẩm đã đổi có chủ ý** — viết lại cho
thiết kế mới, mỗi bài ghi rõ đổi gì vì sao, CẤM nới assertion mà không có chỗ thay.

## 5. Rủi ro

- **Hàng cao hơn:** mỗi hàng gallery cao tới 360px + chữ (hiện ~217px) ⇒ khối Bài viết dài hơn rõ rệt trên trang chủ. Đó là bản chất kiểu Reddit; user chỉnh `max-height` sau khi xem.
- **Payload feed lớn hơn** (tối đa 9 `AnhOut` thêm mỗi thẻ ở MỌI feed vì `XemTruocOut` dùng chung): đo và báo; nếu quá lớn thì phương án sau (không làm bây giờ) là thêm tham số feed.
- **Số `<img>` trong HTML `/` tăng** (tối đa ~100): đều lazy; chữ thân không giảm. Theo dõi lượt bot sau deploy.
- **`scroll-snap` + `smooth` trên Safari cũ:** không có `scroll-snap-stop` ⇒ vuốt mạnh có thể nhảy hai ảnh; chấp nhận.
- **Lớp phủ `::after` của hàng + gallery `z-index`:** khung nằm trên lớp phủ nên không bôi đen được chữ trong khung (đã chấp nhận ở vòng trước cho `trich`).

## Báo cáo thực thi (2026-11-10 → 11)

**Quy trình:** `opus-dev` code → `nghiem-thu` (ĐẠT CÓ ĐIỀU KIỆN, 2 VỪA + 2 NHỎ) → `opus-dev` vòng sửa → `phan-bien` (không NẶNG; 1 VỪA + vài NHỎ) → `opus-dev` vòng sửa cuối → phiên chính kiểm lại.

**Đã làm.** Hàng ≥ 2 ảnh = MỘT khung `.gallery` (`aspect-ratio` theo ảnh đầu kẹp [1 ; 16/9], `max-height 360px`, `object-fit: contain`), track `scroll-snap` x mandatory, nút trước / sau (hiện khi rê hoặc focus bàn phím, ẩn trên `hover:none`), bộ đếm `n/N` (`aria-live`), cuộn mượt (tức thì khi `prefers-reduced-motion`), nạp sớm ảnh ở lần chạm / rê / focus đầu tiên. Slide server-render truyền qua `children` — mọi `<img>` có trong HTML thô; chỉ `gallery-bai-viet.tsx` là client. API: `SO_ANH_XEM_TRUOC` 3 → 10 (`anh_khac` = ảnh 2..10, không thêm truy vấn). Hàng 0 ảnh / 1 ảnh giữ nguyên.

**Lệch plan có chủ ý:** gallery `MocAnh` tối đa 10 ảnh mỗi mốc (`core/ghi.py` `SO_ANH_TOI_DA_MOI_MOC`), nên slide "Xem tất cả N ảnh →" chỉ xuất hiện ở mốc có > 10 ảnh NHÚNG trong body; seed dựng hàng thứ 9 (12 ảnh) bằng ảnh nhúng + `AnhNoiDung` và `seed_e2e` gỡ gallery cũ ở hàng đó (DB seed cũ tự lành, `--reset` dọn file).

**Hai vòng sửa:**
- *Sau nghiệm thu:* focus rơi `<body>` ở gallery 2 ảnh (Chromium bắn `focusout` đồng bộ khi gán `hidden`, `onBlur` của React không nhận ⇒ dùng `focusout` gốc + `useLayoutEffect`); viền focus vẽ BÊN TRONG khung, track `tabIndex=0` + `aria-label`, link "Xem tất cả" chỉ vào thứ tự Tab khi slide của nó hiện; `renameSync` của B8/R10 bọc `try/finally` + lưới dọn `*.bvxt-tam`.
- *Sau phản biện:* bấm dồn / giữ phím mũi tên mất bước (3 lần bấm cách 60ms ⇒ slide 1-2 thay vì 3) ⇒ ref `dichDen` cộng dồn, xoá khi `scrollend` / 150ms / wheel / touch / pointer; nút và bộ đếm chỉ hiện sau hydrate (`useSyncExternalStore`) để tắt JS không còn nút "nói dối"; hiện theo `:hover` / `:has(:focus-visible)` thay `:focus-within` (không "dính" sau bấm chuột); `khungHinh.current = null` sau `cancelAnimationFrame`; thêm bài đo bắt đột biến `floor`/`round`.

**Số đo (phiên chính chạy lại `pnpm e2e:don-vi` = 645 pass; còn lại do agent báo và phản biện / nghiệm thu chạy độc lập):** pytest 2515 pass / 17 đỏ nền (tập đỏ giống nền); e2e đầy đủ 943 bài = 922 pass / 21 đỏ (đều trong ~22 bài nền) / 1 skip; `pnpm lint` 0 warning; `tsc` sạch; `codegen:check` khớp; build `/luat` `○`; First Load JS của `/` 146 kB (nền 144); JSON feed bài viết `limit=10` +15,8% (gzip +18,7%), feed không lọc loại không đổi; `<head>`/h1/lede của `/` y hệt nền, link `/m/` giữ 19, `<img>` 18 → 27, chữ khối Bài viết 3108 → 3316; cùng HTML cho trình duyệt và Googlebot; vân tay `gikky_dev` không đổi.

**Chưa kiểm / chưa có hàng rào chạy thật:** vuốt chạm thật trên điện thoại (cảm ứng tổng hợp qua CDP không snap, cả trên trang HTML tối thiểu ⇒ hạn chế của công cụ); Firefox / WebKit (Playwright chưa cài); `scroll-snap-stop` và `overscroll-behavior-x` chỉ có bài đọc nguồn; `wheel`/`touchstart`/`pointerdown` huỷ đích chỉ có `N14` đọc nguồn.

**Đánh đổi đã chấp nhận:** ảnh nằm trong link `aria-hidden` nên trình đọc màn hình không nghe ảnh (vẫn có nhóm "carousel", nút và bộ đếm); `alt` chỉ ở ảnh đầu, ảnh 2..10 `alt=""`; Back từ trang bài về slide 1; hàng gallery cao tới 360px nên khối Bài viết dài hơn.

Mép còn lại: ledger `P-20261110-14`.
