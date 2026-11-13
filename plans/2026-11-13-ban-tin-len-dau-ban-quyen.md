# Bản tin thị trường lên ngay dưới header + dòng bản quyền (việc 19)

> **Trạng thái:** ĐÃ LÀM 2026-11-13 (hai vòng), nghiệm thu ĐẠT cả hai vòng, phản biện không có lỗi NẶNG. **Commit `8da9d22`; đã lên
> dev.gikky.net (`8da9d22`, 2026-11-13 11:37, chỉ build `web`), chưa lên prod.** Nhánh `v2`, nền `9ac3a69`. Sổ việc: `GHI-CHU.md` việc 19.
> Mục 3.4, 3.5 là user bổ sung giữa chừng; mục 3.6 là vòng 2, ĐỔI thiết kế của 3.1 sau khi phản biện đo bằng tiêu đề thật.
>
> **Nền khi giao thợ:** HEAD `9ac3a69`. `pnpm e2e:don-vi` cho **772 bài, xanh hết** (đo 2026-11-13). Thợ thấy số
> khác thì DỪNG và báo. Cây làm việc có sẵn thay đổi chưa commit của phiên khác ở `GHI-CHU.md`, `LOI-VA-NO.md`,
> `scripts/**` và vài file lạ ở gốc repo: KHÔNG đụng, KHÔNG dọn.

## 1. Yêu cầu

User xem dev.gikky.net ngày 2026-11-13:

1. "phần bản tin thị trường xếp xuống dưới cùng có vẻ không ổn lắm, chả ai kéo xuống dưới đó để mà xem tin tức cả"
2. "cũng không có phần nào chú thích @gikky {year}"
3. Sau khi xem phác thảo: "trên desktop cũng kéo bản tin lên, ngay dưới header".

## 2. Hiện trạng đã đo (dev.gikky.net `ee61f94`)

| Đo | Kết quả |
|---|---|
| Vị trí dải bản tin, desktop 1024×768 | y ≈ 2.898px trên trang cao 3.025px |
| Vị trí dải bản tin, mobile 375×812 | y ≈ 4.165px trên trang cao 5.607px |
| Dòng bản quyền | Không có ở đâu. `ChanTrang` (chân cột phải) chỉ có dòng miễn trừ |

Code:

- `apps/web/components/khoi-bai-viet.tsx:219-250` vẽ dải `data-testid="ban-tin"` ở CUỐI section "Bài viết":
  `<h3>Bản tin thị trường</h3>` + `<ul>` 3 link `ban-tin-muc` + link `ban-tin-tat-ca` → `/s/tin-tuc`.
  CSS: `khoi-bai-viet.module.css` các lớp `.ban_tin*` (dòng ~279–326, và trong hai `@media` phía dưới).
- Dữ liệu: `app/page.tsx::TrangChuMoi` tải `docFeed("moi", { limit: SO_BAI_VIET_TAI, loai_mach: "bai_viet" })`,
  `KhoiBaiViet` tự gọi `chonBanTin(bai_viet)` (`lib/nhom-bai-viet.ts`, `SO_BAN_TIN = 3`).
- `components/chan-trang.tsx`: `<footer data-testid="chan-trang">` chỉ có `<p data-testid="disclaimer">`. Nằm cuối
  `Sidebar`, tức có ở mọi trang có rail.
- Bố cục `/`: `<div class=vo data-testid="trang-chu-v2">` chứa `VoKhungHaiCot` (main + rail) rồi `KhoiBaiViet`.
  Ở ≤ 960px `.vo` là flex dọc và xếp bằng `order` (main 1 → Bài viết 2 → rail 3), xem `app/trang-chu.module.css`.

## 3. Thiết kế

### 3.1 Dải bản tin mới: `components/dai-ban-tin.tsx` + `dai-ban-tin.module.css` (file MỚI)

- Server component, nhận `banTin: readonly MachTomTatOut[]` (đã chọn sẵn, tối đa 3). Rỗng ⇒ trả `null`.
- **Vị trí:** con ĐẦU TIÊN của `<div data-testid="trang-chu-v2">` trong `TrangChuMoi`, TRƯỚC `VoKhungHaiCot`. Tức
  ngay dưới header (và dưới thanh tab di động), trên `<h1>`. Chỉ ở trang v2 `/`; `FeedDaNap` (`/?tab=…`) KHÔNG có.
  `app/page.tsx` gọi `chonBanTin(bai_viet.du_lieu.items)` một lần rồi truyền xuống.
- **HTML:** `<section data-testid="ban-tin" aria-label="Bản tin thị trường">`. Nhãn "Bản tin thị trường" là
  `<span>` (KHÔNG phải heading: nó đứng trước `<h1>`; và KHÔNG dùng `<p>` ở bất kỳ đâu trong dải, để không ai nhầm
  với lede khi đọc HTML). `<ul>` giữ ĐỦ 3 `<li data-mach-id>`, mỗi cái một `<a data-testid="ban-tin-muc">` gồm
  `<time datetime>` + " · " + tiêu đề, y như cũ (kèm `CHU_NGUOI_DUNG`, `prefetch={false}`). Link
  `data-testid="ban-tin-tat-ca"` → `duongDanSub(SUB_BAN_TIN)`, chữ "Tất cả bản tin →". Giữ nguyên bốn testid.
- **Trình bày:** dải ngang trải hết bề ngang, nền `var(--surface)` (hoặc `--inset`), viền dưới `1px var(--line)`,
  dính sát đáy header (không khe hở). Bên trong là hộp `max-width: 1200px; margin: 0 auto; padding-inline: 24px`
  (cùng số với `khung-hai-cot.module.css`; ≤ 960px theo 760px / 20px, ≤ 640px lề 12px). MỘT dòng, không xuống
  dòng, chữ 13px. Dải KHÔNG dính (`sticky`): nó cuộn theo trang.
  - **Desktop (≥ 961px):** nhãn · bản tin 1 · bản tin 2 · bản tin 3 · "Tất cả bản tin →" (đẩy sát phải). Bản tin 1
    được ưu tiên chỗ (không co, trần bề rộng ~55% để tiêu đề quá dài vẫn không đẩy vỡ dải); bản 2 và 3 chia phần
    còn lại, cắt "…" (`min-width: 0`, `text-overflow: ellipsis`). Cao ≤ 44px.
  - **Tablet và mobile (≤ 960px):** chỉ HIỆN bản tin 1 (bản 2, 3 `display: none`, vẫn nằm trong HTML; cùng tiền lệ
    với giá sách ở mobile), cắt "…" một dòng. Vùng bấm của `ban-tin-muc` và `ban-tin-tat-ca` cao ≥ 44px.
  - **Mobile (≤ 640px):** nhãn rút còn "Bản tin", link rút còn "Tất cả →" (bọc phần chữ thừa trong `<span>` rồi ẩn
    bằng CSS; không đổi chữ trong HTML). Không tràn ngang ở 360px.
- Ở ≤ 960px `.vo` là flex dọc: dải không khai `order` (mặc định 0) nên đứng đầu. Kiểm lại bằng số đo.
- Chỉ dùng token màu có sẵn trong `app/globals.css`. Hàng rào `e2e/don-vi/mau-token.spec.ts` ghim theo selector:
  file CSS mới phải qua được nó mà không nới allowlist màu.

### 3.2 Gỡ dải cũ khỏi `KhoiBaiViet`

- Xoá khối JSX `ban-tin` (dòng 219–250) và mọi lớp `.ban_tin*` trong `khoi-bai-viet.module.css` (cả trong `@media`).
- `KhoiBaiViet` vẫn loại bài bản tin khỏi giá sách như cũ (`idDaHien(moi_dang, ban_tin)`), để nội dung giá sách
  KHÔNG đổi. Điều kiện ẩn cả section thành: Mới đăng rỗng VÀ giá sách rỗng.
- Sửa docstring `KhoiBaiViet` (mục 4 không còn) và docstring `TrangChuV2` / `TrangChuMoi` cho đúng bố cục mới.

### 3.3 Dòng bản quyền trong `ChanTrang`

- Thêm vào `components/chan-trang.tsx`, TRÊN dòng miễn trừ: `<p data-testid="ban-quyen">© {năm} gikky.net</p>`.
  KHÔNG có link (bài `rail-chu-de-tuan.spec.ts` E2 ghim "chân trang 0 link"). Dòng miễn trừ vẫn là phần tử CUỐI
  của chân trang (`trang-chu-v2.spec.ts` L1 và `mobile-390.spec.ts` đo trên nó).
- Năm lấy theo giờ Việt Nam bằng một hàm thuần mới trong `lib/` (ví dụ `lib/ban-quyen.ts::namBanQuyen(bayGio: Date)`,
  dùng `Intl.DateTimeFormat` với `timeZone: "Asia/Ho_Chi_Minh"`), `ChanTrang` gọi `namBanQuyen(new Date())`.
  `ChanTrang` vẫn là server component: không `"use client"`, không gọi API. `/luat` phải giữ `○` (tĩnh) trong
  bảng route của `pnpm build`.
- Giới hạn đã biết, chấp nhận: ở trang tĩnh / ISR, năm là năm lúc build hoặc lúc tái sinh trang.
- CSS: cùng cỡ chữ và màu `--ink-3` với dòng miễn trừ, trong `chan-trang.module.css`.

### 3.4 Bỏ ô quan điểm khỏi khối "Chủ đề tuần" *(bổ sung 2026-11-13, user: "phần chủ đề tuần này, bỏ luôn các list cmt của các user đi")*

Giao bổ sung cho thợ khi mục 3.1–3.3 đang chạy. Việc 18 (hôm trước) vừa dựng lại ô này; nay user bỏ hẳn.

- `components/khoi-thao-luan.tsx`: xoá cả ô `data-testid="quan-diem-noi-bat"` (tiêu đề "Quan điểm mới / nổi bật", danh
  sách `quan-diem`, link "Xem tất cả quan điểm →"). GIỮ nguyên phần trên: nhãn tuần, chip, câu hỏi, bối cảnh, tổng kết,
  nút `chu-de-vao`, nút `chu-de-viet`, link `chu-de-so-binh-luan` (lối vào khán đài còn lại). Bỏ props
  `binh_luan_goc`, `binh_luan_moi`, hằng `SO_QUAN_DIEM_NOI_BAT`; sửa docstring. Xoá CSS của ô (`.phai`, `.tieu_phai`,
  `.ds_quan_diem`, `.quan_diem*`, `.xem_tat_ca` nếu không còn ai dùng) trong `khoi-thao-luan.module.css`.
- `components/trang-chu-v2.tsx`: bỏ props `quanDiemGoc`, `quanDiemMoi`.
- `app/page.tsx::TrangChuMoi`: bỏ hai lời gọi `docBinhLuanGoc` / `docBinhLuanGocMoiNhat` (trang chủ bớt hai lời gọi
  API); phần tử chủ đề của `Promise.all` chỉ còn `docFeedChuDe()`.
- Code chết: hàm nào trong `lib/chu-de.ts` (`chonQuanDiem`, `trichQuanDiem`…) và `lib/api.ts` (`docBinhLuanGoc`,
  `docBinhLuanGocMoiNhat`) KHÔNG còn ai gọi trong `apps/web` (trừ bài đo) thì xoá, cùng bài đo `don-vi` của riêng nó.
  Còn nơi khác dùng thì giữ và nêu trong báo cáo. Không đụng `packages/api-client`.
- Bài đo cũ về ô quan điểm (`e2e/khoi-chu-de-nut-brand.spec.ts`, `e2e/trang-chu-v2.spec.ts`,
  `e2e/trang-chu-giao-dien-moi.spec.ts`, `e2e/don-vi/khoi-chu-de-va-ten.spec.ts`, `e2e/don-vi/nut-chinh-brand.spec.ts`,
  `e2e/don-vi/trang-chu-giao-dien-moi.spec.ts`): bài nào đo THỨ ĐÃ BỎ thì xoá; bài đo thứ CÒN LẠI (nút brand, bo tròn,
  tương phản, chip, câu hỏi) thì giữ. Báo cáo liệt kê từng bài đã xoá và số bài `don-vi` trước / sau.

### 3.5 Bối cảnh của chủ đề hiện nhiều hơn *(bổ sung 2026-11-13, user: "cho nội dung chủ đề nhiều hơn chút, hiện tại hơi ít")*

Đo trên dev.gikky.net: `xem_truoc.trich` của chủ đề đang hiện dài 238 ký tự (server cắt, kết bằng "…"); CSS
`.boi_canh` kẹp 2 dòng (việc 18 hạ từ 3 xuống 2), nên ở khối 760px mất khoảng một dòng, ở cột hẹp hơn mất nhiều hơn.

- `khoi-thao-luan.module.css` `.boi_canh`: `-webkit-line-clamp: 2` → **6**, ở mọi khổ (không ghi đè riêng cho mobile).
  Mục đích: hiện TRỌN đoạn trích server trả về; con số 6 chỉ là chốt chặn nếu sau này đoạn trích dài ra.
- KHÔNG đổi API, không đổi độ dài đoạn trích ở server (đoạn trích dùng chung cho mọi thẻ). Không lấy nội dung mốc 1.
- Bài đo của việc 18 đang ghim "2 dòng" (nếu có) sửa thành 6 và nêu trong báo cáo.

### 3.6 Vòng 2 — dải bản tin đọc được với tiêu đề THẬT *(2026-11-13, sau phản biện)*

**Plan §3.1 sai ở hai giả định**, phản biện đo ra bằng tiêu đề thật (rộng 468–547px ở 13px):

1. Tiêu đề thật luôn có dạng "Bản tin DD/MM — …", nên dải in ngày HAI lần ("13/11 · Bản tin 13/11 — …", tốn ~95px),
   và trần 55% cho bản 1 cắt mất phần con số ở MỌI khổ; bản 2, 3 chỉ còn lại ngày. Seed e2e có 3 tiêu đề ngắn bằng
   nhau nên bài T4 không thấy, lại còn khoá đúng cái trần gây lỗi.
2. "Cùng số 1200 / 24 với khung hai cột" KHÔNG thẳng hàng: lưới thật rộng 760 + 36 + 300 = 1096px căn giữa, nên ở
   ≥ 1200px dải lệch 28px mỗi bên so với `<h1>` và rail.

Đổi thiết kế:

- **Cắt tiền tố lặp.** Hàm thuần mới `lib/nhom-bai-viet.ts::tieuDeBanTinGon(title)` (chỉ THÊM): tiêu đề khớp
  `^Bản tin \d{1,2}/\d{1,2}(/\d{2,4})?\s*[—–-]\s*` (không phân biệt hoa thường) thì trả phần SAU tiền tố; không khớp,
  hoặc phần sau rỗng, thì trả nguyên tiêu đề. Dải vẽ `<time datetime>` · tiêu đề gọn; `<a>` mang `title` = tiêu đề
  đầy đủ.
- **Dải chỉ vẽ 2 bản tin** (hằng `SO_BAN_TIN_DAI = 2` cạnh component hoặc trong `lib/nhom-bai-viet.ts`;
  `app/page.tsx` gọi `chonBanTin(items, SO_BAN_TIN_DAI)`). Bản thứ 3 không bao giờ đủ chỗ trong 1096px, mà một link
  luôn ẩn với người nhưng có trong HTML là thứ không nên có. `SO_BAN_TIN = 3` và việc `KhoiBaiViet` loại bài bản tin
  khỏi giá sách giữ nguyên. Đây là đổi so với §3.1 ("giữ đủ 3 link"): trang chủ bớt 1 link `/m/` tới bản tin.
- **Chia chỗ ở desktop (≥ 961px):** bản 1 lấy đủ bề rộng tự nhiên của nó, KHÔNG có trần phần trăm (chỉ co và cắt "…"
  khi một mình nó đã rộng hơn danh sách); bản 2 lấy phần còn lại, cắt "…". Gợi ý: bản 1 `flex: 0 1 auto`, bản 2
  `flex: 1 1 0; min-width: 0`. Chỉ có 1 bản tin thì nó dùng hết chỗ.
- **≤ 960px:** chỉ hiện bản 1 (bản 2 `display: none`), như cũ.
- **Thẳng hàng:** hộp trong của dải có phần nội dung rộng tối đa **1096px** (ví dụ `max-width: 1144px` với
  `box-sizing: border-box; padding: 0 24px`), để mép trái nhãn trùng mép trái `<h1>` và mép phải "Tất cả bản tin →"
  trùng mép phải rail ở mọi bề rộng ≥ 961px.
- Sửa chữ cũ: chú thích `lib/url.ts:55` (nút "Xem tất cả quan điểm" đã bỏ), docstring `components/chan-trang.tsx`
  ("Chỉ còn dòng miễn trừ" nay sai), docstring `dai-ban-tin.*`.

Bài đo vòng 2 (thay / thêm vào T3, T4):

| # | Tiêu chí | Cách đo → mong đợi |
|---|---|---|
| V1 | Hàm cắt tiền tố (`don-vi`) | "Bản tin 11/11 — Dow Jones 52.231 điểm" → "Dow Jones 52.231 điểm"; chấp nhận `–`, `-`, có năm, hoa thường; "Bản tin 11/11 —" (rỗng sau tiền tố) và tiêu đề không khớp → trả nguyên |
| V2 | Số mục | HTML thô `/`: đúng 2 `ban-tin-muc`, `href` = 2 bài `tin-tuc` mới nhất; các bài cũ đang đòi 3 sửa thành 2 |
| V3 | Đọc được với tiêu đề thật | Thay chữ 2 mục trên DOM bằng hai tiêu đề thật dài nhất ("Bản tin 10/11 — Dow Jones tăng 1.104 điểm, S&P 500 tăng 2,35%, Nasdaq lên 25.253" đã qua `tieuDeBanTinGon` + ngày): ở 1280 và 1024 bản 1 KHÔNG bị cắt (`scrollWidth` ≤ `clientWidth`), bản 2 hiện và rộng ≥ 150px; chữ hiện ra không chứa "Bản tin 1" |
| V4 | Một bản tin | Xoá mục 2 khỏi DOM ở 1280: bản 1 không bị cắt và không bị trần (rộng = bề rộng tự nhiên) |
| V5 | Thẳng hàng | 1280 và 1440: `left` của nhãn = `left` của `<h1>` (±1px); `right` của `ban-tin-tat-ca` = `right` của `[data-testid=rail-phai]` (±1px) |

Bỏ khỏi T4 phép khẳng định "bản 1 ≤ 55% danh sách". Thử phá: trả lại trần 55% ⇒ V3 đỏ; trả `max-width` 1200 ⇒ V5 đỏ.

## 4. Phạm vi

**LÀM:** mục 3.1–3.6, và sửa/thêm bài đo ở mục 5. Chỉ trong `apps/web/`.

**KHÔNG LÀM:**
- Không đổi `<h1>`, lede, `metadata`, JSON-LD của `/` (`seo-trang-chu.spec.ts` phải xanh mà KHÔNG sửa file đó).
- Không đổi API, không `pnpm codegen`, không đụng `api/`, `packages/`, `apps/admin/`.
- Không đổi `SO_BAN_TIN`, không đổi cách chọn bài (`lib/nhom-bai-viet.ts` chỉ được thêm, không sửa hàm cũ).
- Không dựng footer ngang toàn trang, không thêm link vào chân trang, không đưa dải bản tin sang trang khác.
- Không commit, không deploy, không ghi vào `GHI-CHU.md` / `LOI-VA-NO.md`.

## 5. Bài đo

Sửa bài cũ đang ghim vị trí / heading cũ:

- `e2e/trang-chu-giao-dien-moi.spec.ts` ~dòng 610–627: bỏ đòi `heading level 3`; đổi thành đo dải mới (xem tiêu chí).
  Dòng ~709 (vùng bấm 44px ở 390px) giữ, và thêm `ban-tin-tat-ca`.
- `e2e/trang-chu-v2.spec.ts` ~dòng 361–367: giữ phép so 3 id; không cần đổi nếu vẫn xanh.
- Bài nào khác đỏ vì việc này thì sửa cho đúng bố cục mới và nêu trong báo cáo; KHÔNG nới bài đo cho qua.

Thêm bài mới (đặt vào file phù hợp sẵn có, hoặc `e2e/dai-ban-tin.spec.ts`):

| # | Tiêu chí | Cách đo → mong đợi |
|---|---|---|
| T1 | Dải nằm ngay dưới header, desktop | 1280×800, `/`: `top` của `[data-testid=ban-tin]` − `bottom` của `<header>` trong khoảng [0, 2]px; `bottom` của dải ≤ `top` của `<h1>`; chiều cao dải ≤ 44px |
| T2 | Đúng MỘT dải, không còn trong "Bài viết" | `/`: `getByTestId("ban-tin")` đếm = 1; `[data-testid=khoi-bai-viet] [data-testid=ban-tin]` đếm = 0; `/?tab=moi`: đếm = 0 |
| T3 | Nội dung | HTML thô của `/` (`request.get`, không JS): 3 `ban-tin-muc`, `href` = 3 bài `tin-tuc` mới nhất theo `GET /api/v1/feeds/moi?loai_mach=bai_viet&limit=50`, đúng thứ tự; mỗi cái có `<time datetime>` = `published_at`; `ban-tin-tat-ca` → `/s/tin-tuc`; trong dải không có `<h1>`–`<h6>` và không có `<p>` |
| T4 | Một dòng, không tràn | 1280 và 1024: cả 3 `ban-tin-muc` hiện (`toBeVisible`), cùng `top` (±1px); bản 1 rộng hơn bản 2. 390×844: chỉ bản 1 hiện; `scrollWidth` của trang ≤ `innerWidth` ở 390 và 360 |
| T5 | Mobile | 390×844: dải nằm dưới header và thanh tab di động, trên `<h1>`; `ban-tin-muc` đầu và `ban-tin-tat-ca` cao ≥ 43.5px; câu hỏi chủ đề (h2 của `khoi-thao-luan`) vẫn có `bottom` < 844 |
| T6 | Bản quyền | `/`, `/s/chung-khoan`, `/luat`: `[data-testid=ban-quyen]` hiện, chữ khớp `^© \d{4} gikky\.net$` và năm = năm hiện tại theo giờ VN; nằm TRONG `chan-trang`, TRÊN `disclaimer`; `chan-trang` vẫn 0 thẻ `<a>` |
| T7 | Hàm năm (nhóm `don-vi`) | `namBanQuyen(new Date("2026-12-31T17:00:00Z"))` = 2027; `namBanQuyen(new Date("2026-12-31T16:59:59Z"))` = 2026 |
| T8 | SEO không đổi | `e2e/seo-trang-chu.spec.ts` xanh, file không bị sửa (`git diff --stat` không có nó) |
| T9 | Bộ chung | `pnpm lint` 0 warning; `pnpm build` xanh, `/luat` vẫn `○`; `pnpm e2e:don-vi` xanh, số bài = 772 + số bài mới − số bài đã xoá ở 3.4 (báo cáo nêu rõ ba con số); e2e đầy đủ không thêm bài đỏ nào so với nền |
| T10 | Không còn ô quan điểm | HTML thô của `/`: 0 lần `data-testid="quan-diem-noi-bat"`, `"quan-diem"`, `"quan-diem-tat-ca"`; trong `khoi-thao-luan` không có `<h3>`. Bài đo phải tự chứng minh KHÔNG đo rỗng: hỏi API thấy chủ đề đang hiện có ≥ 1 bình luận gốc trong seed |
| T11 | Phần còn lại của khối nguyên vẹn | `chu-de-vao` → `/m/<slug>-<id>`, `chu-de-viet` → đường ô soạn bình luận, `chu-de-tieu-de`, `chu-de-trang-thai` còn đủ; các bài nút brand / tương phản của việc 18 xanh |
| T13 | Bối cảnh hiện trọn đoạn trích | 1280×800 và 390×844, `/`: `chu-de-boi-canh` có `-webkit-line-clamp` = 6 và KHÔNG bị cắt (`scrollHeight` ≤ `clientHeight` + 1) với chủ đề seed; bài đo tự kiểm đoạn trích của seed dài ≥ 150 ký tự (không đo rỗng). 390×844: `chu-de-vao` vẫn có `bottom` < 1044 |
| T12 | Trang chủ không gọi API bình luận | Nguồn `app/page.tsx` không còn chuỗi `docBinhLuan`; `grep` trong `apps/web` (trừ `e2e/`) không còn tên hàm nào đã xoá |

Mỗi bài mới phải được **thử phá**: tạm làm sai sản phẩm (ví dụ đặt dải sau `VoKhungHaiCot`, bỏ `ban-quyen`) và thấy
bài đỏ, rồi trả lại. Ghi trong báo cáo đã phá bài nào bằng cách nào.

## 6. Lệnh

Chạy ở gốc repo `D:\Projects\gikky-net`.

- `pnpm lint` · `pnpm build` · `pnpm e2e:don-vi` (an toàn, không chạm DB). Lọc: `pnpm e2e:don-vi -g "tên"`
  (KHÔNG có `--` ở giữa).
- e2e đầy đủ **CẤM chạy `pnpm e2e` trần**: `gikky_dev` chứa dữ liệu thật. Phải trỏ `gikky_e2e` và bật `CI=1` trong
  CÙNG một lệnh PowerShell, và hai cổng 3000 / 8000 phải trống:

  ```powershell
  $url = [regex]::Match((Get-Content api\.env -Raw), '(?m)^DATABASE_URL=(.+)$').Groups[1].Value.Trim(); $env:DATABASE_URL = ($url -replace '/gikky_dev\s*$','/gikky_e2e'); $env:CI = '1'; node scripts/py.mjs shell -c "from django.db import connections; n=connections['default'].settings_dict['NAME']; print('DB='+n); import sys; sys.exit(0 if n=='gikky_e2e' else 1)"; if ($LASTEXITCODE -eq 0) { pnpm e2e } else { 'DUNG LAI: DB SAI' }
  ```

  Dòng `DB=gikky_e2e` phải in ra trước. Không sửa `api/.env`. Không dựng `next dev` trong lúc e2e chạy; `pnpm build`
  phá `next dev` đang mở của cùng app.
- Nền đỏ của e2e đầy đủ: thợ chạy bộ đầy đủ MỘT lần TRƯỚC khi sửa (hoặc `git stash` rồi chạy) để có danh sách đỏ
  nền, rồi so sau khi sửa. Không đoán.

## 7. Rủi ro

- **Trang đầu của mobile bị đẩy xuống ~45px.** T5 giữ câu hỏi chủ đề trong màn hình đầu.
- **Link đứng trước `<h1>`.** Bot đọc 3 link bản tin trước tiêu đề trang. Chấp nhận: header vốn đã có link trước
  `<h1>`; `<h1>`, lede, `<head>` không đổi (T8).
- **Bài đo cũ ghim cấu trúc.** `hai-cot.spec.ts`, `mobile-390.spec.ts`, `khong-giat.spec.ts`, `trang-chu-v2.spec.ts`
  có thể giả định con đầu của `trang-chu-v2` là khung hai cột, hoặc đo CLS / vị trí tuyệt đối. Đỏ thì sửa bài cho
  đúng bố cục mới, nêu rõ từng bài.
- **`display: none` cho bản 2, 3 ở ≤ 960px** là giấu link khỏi người dùng trên trang index. Tiền lệ: giá sách
  mobile. Lối vào đầy đủ vẫn là "Tất cả bản tin →" ngay cạnh.

## Báo cáo thực thi

**Plan sai ở đâu và đã đổi hướng ra sao.** §3.1 giả định tiêu đề bản tin ngắn và giữ đủ 3 link; với tiêu đề thật
("Bản tin DD/MM — …", 468–547px) dải vòng 1 in ngày hai lần, cắt bản mới nhất ở mọi khổ và lệch 28px so với lưới.
Seed e2e có 3 tiêu đề ngắn bằng nhau nên vòng 1 xanh hết, và T4 còn khoá đúng cái trần 55% gây lỗi. Phản biện đo ra;
vòng 2 (§3.6) đổi: 2 bản tin, cắt tiền tố, bỏ trần, hộp 1096px. T13 cũng khác plan: seed chỉ có bối cảnh 59 ký tự nên
bài đo tự dựng chủ đề tạm thay vì đo trên seed.

**Kiểm chứng (checkout chính, nhánh `v2`, DB `gikky_e2e`).**

| Lệnh | Vòng 1 (nghiệm thu tự chạy) | Vòng 2 (nghiệm thu tự chạy) |
|---|---|---|
| `pnpm lint` | 0 warning | 0 warning |
| `pnpm build` | xanh, `/luat` là `○` | xanh, `/luat` là `○` |
| `pnpm e2e:don-vi` | 766 xanh (772 + 6 − 12) | 769 xanh (766 + 3) |
| e2e đầy đủ | 1152 xanh, 21 đỏ, 7 skip, 8 không chạy | không chạy lại |
| e2e 9 file trang chủ | xanh hết | 182 xanh, 1 skip (W-ANH), 0 đỏ |

21 bài đỏ của lượt đầy đủ đều thuộc nhóm đỏ nền ngoài trang chủ (thợ đo trước khi sửa: 22 đỏ; sau khi sửa: 19). Nghiệm
thu KHÔNG tự đo nền ở HEAD (không được stash vì cây có việc của phiên khác), chỉ đối chiếu theo tên nhóm. Sau sửa nhỏ
cuối (gắn dấu `[e2e-viec-19]` vào bài tạm của V3) chỉ chạy lại `pnpm lint` và `dai-ban-tin` (20/20), do thợ chạy.

**Nghiệm thu.** Vòng 1: 12/13 đạt, T9 đạt một phần (lý do ở trên). Vòng 2: V1–V5 đạt 5/5; T1, T2, T3, T4, T5, T8, T9
chấm lại đều đạt.

**Phản biện (sau vòng 1).** 1 VỪA (dải không đọc được với tiêu đề thật) và 3 NHỎ (1–2 bản tin vẫn bị trần 55%; lệch
28px; chú thích cũ ở `lib/url.ts`). Cả bốn đã sửa ở vòng 2. Vòng 2 KHÔNG được phản biện lại; nghiệm thu vòng 2 có đo
độc lập với tiêu đề thật ở 1280 và 1024.

**Thử phá.** Vòng 1: 8 cách phá, mỗi cách làm đỏ đúng bài (T1/T2/T3, T6, T4, T13, T10, T7, T12). Vòng 2: trả trần 55%
⇒ V3 ở 1024 đỏ (ở 1280 KHÔNG đỏ); trả `max-width` 1200 ⇒ V5 đỏ; bỏ cắt tiền tố ⇒ bài V3 dùng bài tạm đỏ; phá hàm ⇒ V1 đỏ.

**Bài đo cũ.** Xoá 12 bài `don-vi` và 5 bài e2e, đều đo ô quan điểm đã bỏ. Sửa: bài H của `trang-chu-v2` (khối chủ
đề nay phải có 0 `<h3>`), các bài đòi 3 bản tin thành 2, bài nút brand bỏ phần ô quan điểm. `seo-trang-chu.spec.ts`
không bị sửa; hai ngưỡng SEO (≥ 19 link `/m/`, ≥ 12 `<time>`) không bị hạ.

**Deploy dev.** Trước khi thay cây: `.deploy-commit` = `ee61f94`, md5 cả 1.173 file trên VPS khớp commit đó. Archive
`8da9d22` (1.180 file), md5 hai đầu khớp; bản cũ dời sang `~/gikky-dev/src.cu-20261113-113533`; build và recreate chỉ
`web` lúc 11:37. Đo qua `127.0.0.1:8092`: `/`, `/?tab=moi`, `/luat`, `/s/tin-tuc`, `/api/v1/health` đều 200. Trên
trình duyệt, 1024px: dải sát header (khe 0), cao 41px, bản 1 "11/11 · Dow Jones 52.231 điểm, Nasdaq -1,21%, Brent 92,06
USD" không bị cắt, bản 2 rộng 319px có "…", mép trùng `<h1>` và rail; bối cảnh 3 dòng không bị cắt; "Nhật ký mới" lên
y=536 (trước 685). 375px: dải ở y=111, cao 45px, bản 1 bị cắt còn 235/372px, không tràn ngang; "Vào thảo luận" có đáy
ở 655px. Chưa có ảnh chụp (khung trình duyệt không chụp được lúc đo).

**Chưa xong / user chưa xem lại.** Dải chỉ 2 bản tin (ban đầu báo user là 3); dòng © ở chân cột phải, không ở đáy
trang; bối cảnh chỉ nới bằng CSS (server vẫn cắt ~240 ký tự). Chưa lên prod. Việc lặt vặt: sổ P-20261113-8.
