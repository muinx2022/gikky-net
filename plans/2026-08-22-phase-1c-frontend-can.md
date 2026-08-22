# Plan con — Phase 1c: frontend mặt CẶN

> Nguồn: `PLAN.md` **mục 9 (UI spec)**, 5.5 (mặt CẶN), 5.9 (feed + URL), 5.10 (compliance),
> mục 10 Phase 1. Quy trình: `D:\Projects\CLAUDE.md`. Ngày 2026-08-22.
> Phase 1 tách 3: 1a lõi dữ liệu ✔ (`e1d518e`) · 1b API đọc ✔ (`d88b9d0`) · **1c frontend**.

## 0. Phạm vi

**Trong:** `apps/web` — trang mạch mặt CẶN, 2 feed, hồ sơ user, `/luat` + footer disclaimer,
JSON-LD + sitemap, light/dark, ngôn ngữ thị giác 9.1.

**NGOÀI — đừng lấn:** mặt BÃO (Phase 3), ISR/middleware/cache 8.4 (Phase 3), mọi thao tác GHI
kể cả composer **hoạt động được** (Phase 2 — 1c chỉ render composer **disabled** kèm lời mời
đăng nhập), `apps/admin` (Phase 4), ảnh (Phase 5), OG card (Phase 6).

## 1. Giá trị đã chốt (PLAN không nêu — chốt ở đây)

| Hạng mục | Chốt | Lý do |
|---|---|---|
| CSS | **KHÔNG Tailwind** (đã chốt Phase 0). Token toàn cục trong `app/globals.css` port từ `docs/mockup-tham-khao.html`, phần còn lại là **CSS Modules** | mockup là CSS thuần + custom properties; ngôn ngữ "mực và dấu" rất riêng |
| Font | `next/font/google`: Newsreader (tiêu đề mạch) · Be Vietnam Pro (UI) · IBM Plex Mono (**mọi timestamp + con số**, `tabular-nums`) | PLAN 9.1 — "mốc phải trông như biên lai" |
| Màu | Bê nguyên bảng 9.1. **Xanh `#1C7A4F` / đỏ `#B33A2B` CẤM dùng trang trí** — chỉ ở con số lãi/lỗ. Hoàng thổ `#B07A2B`/`#D8A455` **chỉ** cho thứ mang tính đóng dấu | PLAN 9.1 nói rõ |
| light/dark | `prefers-color-scheme` + `[data-theme]` ghi đè; **không** lưu lựa chọn ở 1c | mockup đã có sẵn cả hai |
| **Bộ test JS** | **Playwright, thêm ở phase này** (PLAN xếp ở Phase 2 — kéo lên sớm) | Nghiệm thu Phase 1 của PLAN là **"checklist phần tử, không so ảnh"** — 15 tiêu chí UI. Không có bộ chạy thì chúng thành "đọc bằng mắt", đúng thứ repo này đã diệt 11 lần. Phase 2 cần Playwright dù sao |
| Gọi API | **truyền `baseUrl` theo từng lời gọi** (`getHealth({ baseUrl })` kiểu 1b). **CẤM `client` singleton** — có hàng rào `rao-can-client.mjs` | `CLAUDE.md` |
| Server fetch | server component gọi **thẳng `API_ORIGIN`**; đường same-origin để cho lời gọi phía client | đã chốt ở Phase 0 |
| URL | `/m/<slug>-<id>` · `/s/<sub>` · `/u/<username>` · `/luat` · `/` (2 tab qua `?tab=`) | PLAN 5.9 |
| Slug lệch | **308** sang slug hiện tại, giữ nguyên `id` | PLAN 5.9 — **sửa 2026-08-22**: bản đầu ghi 301, nhưng Next App Router chỉ có `permanentRedirect()` (=308); đặt 301 phải qua `middleware.ts`, mà middleware là cơ chế 8.4 của Phase 3. 308 còn đúng hơn về ngữ nghĩa. PLAN 5.9 đã sửa theo |
| **Dải gập** | định nghĩa MỘT chỗ duy nhất (`lib/dai-gap.ts`): với `entry_count = n`, gập là `seq` từ `2` đến `n-2`; hiện mốc `1`, `n-1`, `n`. Khi `n <= 4` thì **không gập** | 1a để lại nợ: công thức này hiện chỉ sống trong `test_seed_dev.py`. Hai chỗ định nghĩa là hai sự thật |
| **Mồi bung** | 1c **tự tính** từ cây `?sort=hay_nhat&limit=50`: lọc thread gốc có `anchor_moc_seq` thuộc dải gập, **loại `comment_id` đã trích** (lấy từ `mocs[].trich`), lấy điểm cao nhất. **Ghi rõ giới hạn: chỉ đúng khi mạch ≤50 thread gốc** | nợ 1b #4 — API không cấp trường này. Ghi ra thay vì giả vờ đủ |
| **Deep-link blockquote** | nút "nhảy tới khán đài" chỉ cuộn được khi nút có trong trang đang tải; **không có** thì hiện trạng thái rõ ràng ("bình luận này nằm ở trang sau"), KHÔNG im lặng | nợ 1b #8 — bia mộ nằm đáy `hay_nhat`, mạch >50 thread thì không ở trang 1 |
| Composer ở 1c | render **disabled** + "Đăng nhập để bình luận" | Phase 2 mới có auth. Nhưng PLAN 5.5 đòi chân trang bung khán đài **kết thúc bằng composer** ⇒ phải có chỗ đứng |

## 2. Hạng mục việc

### 2.1 Nền thị giác
`app/globals.css`: token màu/chữ/khoảng cách port từ mockup (cả light lẫn dark), `next/font`,
`tabular-nums` cho mono. **Không** copy layout của mockup — PLAN 9.1 nói rõ file đó là chuẩn
**màu/chữ/chất liệu**, KHÔNG phải chuẩn layout; layout theo 9.2.

### 2.2 Trang mạch `/m/[slug]-[id]` — mặt CẶN (9.2)
Banner (`MẠCH ĐÃ ĐÓNG · {ket_qua} · N mốc`, **ẩn `ket_qua` khi NULL**) → mốc 1 → dải gập
(`▤ Mốc 2–7 · N mốc · M bình luận` + **mồi bung**) → 2 mốc cuối → chân trang
`💬 N bình luận · xem các câu đáng đọc ▾` → bung khán đài đủ 3 sort đổi qua **URL param** +
composer cuối (disabled).
- Thẻ mốc: `seq`, `occurred_at`, `loai`, `figures` (dải số mono), `question_for_crowd`,
  **ngăn kéo** (bấm 💬 → lát cắt cũ→mới, accordion — mở cái khác thì cái đang mở gập lại).
- **Khối trích**: blockquote + **ĐỦ HAI DẤU THỜI GIAN** ("viết 10/06, trích 21/08") + "trích từ
  khán đài, bởi chủ mạch" — PLAN 5.6 rào 2 và rào 4.
- Bia mộ mốc + bia mộ bình luận render đúng (nhãn, không lộ nội dung).
- `entry_count == 1` ⇒ render như **post thường**: không spine, không ngăn kéo (PLAN 5.1).
- Nguyên tắc 9: **dưới 4 bình luận thì ẩn mọi số đếm**, không bao giờ hiện "0 bình luận".

### 2.3 Feed `/` và `/s/<sub>`
2 tab **Mới** / **Đang diễn ra** (`?tab=`), cursor "xem thêm". Thẻ mạch: title, sub, tác giả,
`entry_count`, `comment_count`, dấu thời gian mono.

### 2.4 Hồ sơ `/u/<username>`
`display_name`, `bio`, 3 con số + **`duoc_trich`** — và phải hiển thị đúng nghĩa "Được trích vào
sổ ×N" (PLAN 5.9). Ghi chú: danh sách mạch cắt 20, không cursor (nợ 1b #6) ⇒ **phải nói ra trên
UI nếu `so_mach > 20`**, không cắt âm thầm.

### 2.5 `/luat` + footer disclaimer (PLAN 5.10) — **làm ngay, không hoãn**
Footer mọi trang: *nội dung do người dùng đăng, không phải khuyến nghị đầu tư; gikky không phải
công ty chứng khoán, không môi giới, không nhận uỷ thác.*
`/luat` bản **draft**: cấm hô hào mua/bán kiểu phím hàng · cấm cam kết lợi nhuận · cấm mời chào
uỷ thác/room VIP trả phí · cấm link nhóm kín trong bài. **Đánh dấu rõ là DRAFT chờ user duyệt**
(PLAN mục 11: user duyệt bản cuối).

### 2.6 SEO
JSON-LD `DiscussionForumPosting` trên trang mạch · `sitemap.xml` · `canonical` · `<title>`/
`<meta description>` theo mạch.

### 2.7 Bộ test Playwright
`apps/web/e2e/`, chạy bằng `pnpm e2e`. Dựng seed thật (Django + web), **checklist phần tử** theo
mục 3 — không so ảnh.

## 3. Tiêu chí nghiệm thu (từ PLAN mục 10 Phase 1, cụ thể hoá)

| # | Tiêu chí | Cách đo |
|---|---|---|
| V1 | Banner đủ thành phần; **ẩn `ket_qua` khi NULL** — test **CẢ HAI** mạch seed | Playwright, 2 ca |
| V2 | Mốc 1 + dải gập `N mốc · M bình luận` + 2 mốc cuối, đúng công thức `lib/dai-gap.ts` | Playwright + unit test cho hàm |
| V3 | **Mồi bung = comment điểm cao nhất TRONG dải gập** — không phải cao nhất toàn mạch, không phải comment đã trích | Playwright. Seed đã tách ba vai (1a W6) ⇒ **cài sai là ĐỎ**. Nếu bài đo vẫn xanh khi lấy nhầm thì nó không đo gì |
| V4 | Blockquote trích hiện **ĐỦ 2 dấu thời gian** + "bởi chủ mạch" | Playwright |
| V5 | Ngăn kéo mở đúng lát cắt, **cũ→mới**, accordion (mở cái khác thì cái cũ gập) | Playwright |
| V6 | Chân trang bung khán đài, **3 sort đổi qua URL param**, composer cuối (disabled) | Playwright |
| V7 | `entry_count == 1` → render post thường (không spine, không ngăn kéo) | Playwright trên seed post thường |
| V8 | **Dưới 4 bình luận: ẩn mọi số đếm** (nguyên tắc 9) | Playwright trên seed post thường (2 bình luận) |
| V9 | Slug lệch → **308** sang slug đúng, `id` giữ nguyên | Playwright/curl — ghim `toBe(308)`, KHÔNG nới thành `[301,308]` |
| V10 | Footer disclaimer trên **mọi** trang; `/luat` sống, có nhãn DRAFT | Playwright |
| V11 | **JSON-LD hợp lệ** `DiscussionForumPosting` | validator schema.org (hoặc parse + assert trường bắt buộc) |
| V12 | `sitemap.xml` có trang mạch seed | curl |
| V13 | **Lighthouse SEO ≥ 90** trên trang mạch | chạy thật, dán số |
| V14 | light/dark đều render đúng token 9.1; **xanh/đỏ không dùng trang trí** | Playwright + grep CSS |
| V15 | Deep-link blockquote: có nút → cuộn tới; **không có → hiện trạng thái rõ ràng**, không im lặng | Playwright |
| V16 | Hồ sơ: `so_mach > 20` → **nói ra là bị cắt** | Playwright (dựng 21 mạch) |
| V17 | **Không hồi quy**: 336 test Python xanh, 0 warning, `codegen:check` khớp, `pnpm lint` + `pnpm build` sạch | chạy |
| V18 | Frontend **không tự khai interface trùng API** (PLAN 8.3) — mọi type từ `@gikky/api-client` | grep + đọc |
| V19 | Chưa commit; không rác | `git status` |

## 4. Rủi ro đã biết
1. **`pnpm lint` hiện chỉ phủ 2 app Next** — 1c thêm nhiều TS, lint sẽ có ích. Nhưng `scripts/*.mjs`
   và `e2e/` phải nằm trong phạm vi lint, nếu không lại có vùng mù (nợ Phase 0).
2. **Playwright cần server thật** ⇒ tranh cổng 3000/8000 với nghiệm thu. Ghi rõ trong prompt chia
   việc chặng 3/4.
3. **V3 là tiêu chí dễ xanh oan nhất.** Seed đã được sửa ở 1a **chính vì** nó. Nếu bài đo không
   phân biệt được "cao nhất dải gập" với "cao nhất toàn mạch" thì nó vô giá trị.
4. **Đừng copy layout từ mockup** — nó là bố cục CŨ (trước khi chốt hai mặt). PLAN 9.1 cảnh báo
   đích danh.

## 5. Nợ 1b bàn giao — 1c phải xử hoặc ghi rõ giới hạn
1. Mồi bung tự tính, chỉ đúng ≤50 thread gốc (§1) — **ghi ra UI/comment, không giả vờ đủ**.
2. Deep-link chỉ tới được trong trang 1 (§1) — hiện trạng thái rõ ràng.
3. Hồ sơ cắt 20 mạch — nói ra trên UI (V16).
4. `sort: str` mất union ở TS client ⇒ gõ sai sort không bị TypeScript chặn. Bọc bằng một hằng
   union ở tầng 1c.
5. Bất biến "soi gương" `duoc_trich` ↔ blockquote chưa có phép đo — **để nguyên là nợ**, không
   phải việc của 1c.
