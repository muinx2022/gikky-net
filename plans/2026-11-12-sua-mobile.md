# Sửa giao diện mobile toàn site (đợt M)

> **Trạng thái:** ĐÃ LÀM (2026-11-12, sau đợt D `80fd5cd`), chờ commit. USER ĐÃ DUYỆT plan 2026-11-12 (đợt D đụng `the-mach.tsx`; đợt này đụng `the-mach.module.css` — không
> chạy song song). Nhánh `v2`. Sổ việc: `GHI-CHU.md` việc 16.
>
> **Nền khi giao thợ:** ghi lúc giao (commit của đợt D, số bài `pnpm e2e:don-vi`, số đỏ e2e đầy đủ). Thợ đứng ở cây có số
> khác thì DỪNG và báo.

## 1. Yêu cầu của user (2026-11-12)

"Review lại toàn bộ phần mobile, các trang có trong web, bao gồm cả các trang của user" → phiên chính soi ở 390px, user
duyệt "Lập đợt sửa".

## 2. Hiện trạng đã đo

Soi 2026-11-12, khổ 390×844, theme tối, Playwright headless (`isMobile`, `hasTouch`). Hai nguồn:
- **Trang khách:** bản build `v2@9e765c8` đọc API dev.gikky.net (dữ liệu thật). 18 trang: `/`, `/?tab=moi&loai_mach=nhat_ky`
  (+`&trang_thai=open`), `/?tab=nhieu-diem`, `/s/quan-tri-von`, `/s/ngoai-hoi?loai_mach=nhat_ky`, 3 trang mạch (lệnh, chủ
  đề, bài viết), 2 hồ sơ, `/chu-de`, `/luat`, `/tim-kiem?q=vang`, `/dang-nhap`, `/dang-ky`, `/quen-mat-khau`, 404.
- **Trang user:** cùng bản build trên `gikky_e2e`, phiên của `e2e_nhieu_mach`: `/dang-mach`, `/cai-dat`, `/sua-ho-so`,
  `/doi-mat-khau`, hồ sơ của chính mình, trang mạch của chính mình, ngăn đăng nhanh, ngăn thông báo, ngăn tài khoản.

**Không trang nào tràn ngang** (`scrollWidth = 390` ở cả 26 lượt đo). Các lỗi:

| # | Mức | Lỗi | Ở đâu |
|---|---|---|---|
| M1 | NẶNG | Thanh "Cài ứng dụng gikky" (`banner-cai-app`, fixed đáy, 366×60, z 55) hiện ở MỌI trang mobile tới khi bấm ✕: che kín nút dính đáy "Ghi nhật ký" (`nut-ghi-nhat-ky-di-dong`) trên trang lọc nhật ký; che link chân trang ("Luật cộng đồng · Trang chủ") ở cuối mọi trang mà không cuộn qua được (body không chừa chỗ); nằm giữa form `/dang-mach`, che vùng soạn — bàn phím bật lên thì đè đúng chỗ đang gõ. | `components/goi-y-cai-app.tsx`, `.module.css` |
| M2 | NẶNG | Ô nhập < 16px ⇒ iOS Safari tự phóng to trang khi chạm: ô tìm kiếm header 13.5px (mọi trang); mọi ô của `/dang-mach` và ngăn "Đăng bài nhanh" 14px; ô ở `/tim-kiem` 13–14px; `/sua-ho-so` 14px; checkbox/radio 13.3px. | `o-tim-kiem`, `form-dang-mach`, `drawer-dang-nhanh`, `tim-kiem`, `form-ho-so` |
| M3 | NẶNG | Ô chọn quá nhỏ: radio Mua/Bán, checkbox "Tắt bình luận", "Nhật ký riêng tư" 13×13px (`/dang-mach` + ngăn đăng nhanh); checkbox nhận thư `/cai-dat` 22×22px. | `form-dang-mach`, `drawer-dang-nhanh`, `form-cai-dat` |
| M4 | VỪA | Chân thẻ: "Chia sẻ" rơi xuống dòng riêng ở MỌI thẻ (vote · mốc · bình luận không đủ chỗ ở 366px) ⇒ +~44px mỗi thẻ. | `the-mach.module.css` |
| M5 | VỪA | Dòng meta đầu thẻ bẻ tên chuyên mục giữa chữ khi có "nối mốc" + chip trạng thái ("s/chung-" ⏎ "khoan"). | `the-mach.module.css` |
| M6 | VỪA | Vùng bấm nhỏ: tên tác giả + `s/sub` ở đầu thẻ 15–18px; nút gập nhánh bình luận `[−]` 14×17; avatar bình luận 22; mũi tên vote 26; nút sort bình luận 28; "Thêm hành động cho mốc" 27×24; nút xoá mốc 32; nút ngăn kéo mốc 21; tab hồ sơ 32; "Đọc hết" (thông báo) 41×18; link chân trang 18; "← Quay lại Trang chủ" (`/luat`) 18. | nhiều file |
| M7 | VỪA | Home mobile: cả rail (khối khách, Về gikky, Chuyên mục, Luật, `ChanTrang`) chen GIỮA "Nhật ký mới" và section "Bài viết" ⇒ chân trang nằm giữa trang, phải cuộn ~1.200px rail mới tới Bài viết. | `app/page.tsx`, `khung-hai-cot-vo`, CSS |
| M8 | VỪA | Trang form (`/dang-mach`, `/cai-dat`, `/sua-ho-so`, `/doi-mat-khau`) kéo cả rail (Chuyên mục, Luật, Bài mới nhất) xuống dưới form; form `/dang-mach` nằm trong khung có lề riêng ⇒ ô nhập còn ~320/390px. | các trang form |
| M9 | VỪA | Đầu hồ sơ của chính mình: tên dồn 3 dòng vì nút "Sửa hồ sơ" chung hàng; ô thống kê mất viền phải. | `app/u/[username]` |
| M10 | NHỎ | Hàng Sắp xếp trên mobile chỉ còn 3 icon không chữ (đồng hồ / sóng / lửa). | `feed.tsx`, `feed.module.css` |
| M11 | NHỎ | Khoảng trống: dải trống ~100px cuối khối nhật ký home (chỗ của nút dính đáy); hai khoảng trống lớn quanh ô bình luận trang mạch. | `o-soan-nhat-ky.module.css`, trang mạch |
| M12 | NHỎ | Bảng lệnh 3 cột trên trang mạch chật, chữ xuống dòng ("USD/CHF (Forex)"). | bảng lệnh trang mạch |

Ngoài phạm vi đợt này (đã/ sẽ ghi sổ): lỗi hydrate #418 (P-20261111-21); hạn mức `/api/_allauth/*` (P-20261112-3); trang
chủ đề hiện "Chỉ đọc nhật ký của tác giả"; tên tác giả đầu trang mạch còn `u/`; nút Google trong khung trình duyệt nhúng.

## 3. Ràng buộc cứng

- **SEO chỉ cộng, không bớt** (`GHI-CHU.md` việc 11): DOM + thứ tự tài liệu của `/` và mọi trang có thể index KHÔNG đổi —
  sửa bằng CSS. Tập link `/m/` và `/s/*` mỗi trang không giảm; `<title>`, meta, canonical, JSON-LD, h1, lede giữ byte.
  Ẩn bằng CSS trên mobile được phép CHỈ ở trang `noindex` (form, cài đặt); trang index được thì không giấu link.
- Desktop (≥ 961px) **không đổi** — mọi luật mới nằm trong media query mobile (≤ 640px, hoặc ≤ 960px nếu là luật bố cục
  rail đang dùng ngưỡng đó). Đo trước/sau ở 1280px.
- Màu: 0 hex mới; `mau-token.spec.ts` + `seo-trang-chu.spec.ts` xanh không sửa. `apps/web` giữ CSS Modules (không Tailwind).
- Quy ước repo như các đợt trước (`CLAUDE.md`): gọi API theo tên hàm kèm `baseUrl`, lint 0 warning, không `<Suspense>`.
- e2e: `gikky_dev` là dữ liệu thật — cấm `pnpm e2e` trần; `DATABASE_URL`→`gikky_e2e` + `CI=1` trong cùng lệnh.

## 4. Thiết kế

### 4.1 Thanh cài app (M1)
- Khi thanh đang hiện: trang chừa chỗ ở đáy bằng đúng chiều cao thanh (+ safe-area) để nội dung cuối trang với tới được.
- Không bao giờ đè một điều khiển dính đáy khác: trang có `nut-ghi-nhat-ky-di-dong` thì thanh đứng TRÊN nút ấy (hoặc nút
  ấy đứng trên thanh) — thợ chọn, kèm lý do; nút về đầu trang cũng không bị đè.
- Không hiện trên trang form / xác thực (`/dang-mach`, `/sua-ho-so`, `/cai-dat`, `/doi-mat-khau`, `/dang-nhap`,
  `/dang-ky`, `/quen-mat-khau`, `/dat-lai-mat-khau/*`) và khi một ngăn kéo / sheet đang mở.
- Giữ nguyên logic khi nào được hiện (di động, chưa cài, chưa tắt gần đây).

### 4.2 Ô nhập + ô chọn (M2, M3)
- ≤ 640px: mọi `input` (trừ checkbox/radio/file ẩn), `select`, `textarea`, vùng soạn Tiptap có cỡ chữ ≥ 16px. Một luật
  chung ở tầng toàn cục nếu được (ít chỗ sót hơn sửa từng form); kiểm placeholder không bị cắt xấu.
- Checkbox / radio: ô vẽ ≥ 20px, **vùng bấm ≥ 44px** (cả nhãn bấm được — `<label>` bọc hoặc `for`).

### 4.3 Thẻ (M4, M5, M6 phần thẻ)
- Chân thẻ không xuống dòng ở 360–390px: "Chia sẻ" chỉ còn icon trên mobile (giữ `aria-label`), hoặc cách khác thợ chọn,
  miễn chân thẻ một hàng và mọi nút ≥ 44px cao.
- Dòng meta: `s/sub`, ngày, "nối mốc dd/mm" mỗi cụm không bị bẻ giữa chữ (`white-space: nowrap` từng cụm, cho xuống dòng
  GIỮA các cụm).
- Tên tác giả, `s/sub` trên thẻ: vùng bấm cao ≥ 24px (link chữ trong dòng meta — mức WCAG 2.5.8; không bắt 44px để dòng
  meta không phình). Các nút thật (vote, mốc, bình luận, chia sẻ, theo dõi, mod) ≥ 44px.

### 4.4 Vùng bấm còn lại (M6)
Nút/tab/điều khiển ≥ 44px cao trên mobile: nút gập nhánh bình luận, mũi tên vote ở bình luận + mốc, nút sort bình luận,
"Thêm hành động cho mốc", nút xoá mốc, nút ngăn kéo mốc, tab hồ sơ, "Đọc hết". Avatar bình luận không cần to ra nếu nó
không phải link riêng (kiểm). Link chữ trong chân trang / "← Quay lại Trang chủ": ≥ 24px. Nới vùng bấm bằng padding +
margin âm hoặc `::after` — **không** làm vỡ bố cục desktop.

### 4.5 Bố cục (M7, M8, M9, M11, M12)
- **Home (M7):** trên mobile, section "Bài viết" đứng TRƯỚC rail — chỉ bằng CSS (`order` / `display: contents` / grid),
  DOM giữ nguyên (SEO, `seo-trang-chu.spec.ts`). Thứ tự hiển thị mobile: dòng giới thiệu → Chủ đề → Nhật ký mới → Bài
  viết → rail → chân trang.
- **Trang form (M8):** trên mobile không vẽ rail dưới form (các trang này `noindex` — thợ kiểm từng trang; trang nào
  index được thì giữ rail). Khung form `/dang-mach` bỏ lề kép trên mobile để ô nhập rộng gần hết màn.
- **Đầu hồ sơ (M9):** tên không dồn quá 2 dòng ở 390px (nút "Sửa hồ sơ" xuống dưới tên hoặc thu gọn); ô thống kê đủ viền.
- **Khoảng trống (M11):** *(Chốt khi làm, 2026-11-12: phần home KHÔNG sửa — "dải trống ~100px" là ảnh giả của chụp
  `fullPage` (dải sticky vẽ ở vị trí đang dính); cuộn thật thì cuối khối là chính nút ghi nằm trong luồng. Nghiệm thu
  xác nhận bằng ảnh `home-cuoi-nhat-ky.png`.)* Bỏ dải trống cuối khối nhật ký home (nút dính đáy không chiếm chỗ trong luồng khi không dính);
  gọn khoảng quanh ô bình luận trang mạch.
- **Bảng lệnh (M12):** ≤ 400px chuyển 2 cột hoặc cỡ chữ giá trị nhỏ lại — không tràn, không cắt số.
- **Hàng sắp xếp (M10):** mobile có chữ ngắn (vd "Mới · Diễn ra · Nổi bật") thay vì chỉ icon; vẫn ≥ 44px; giữ testid.

## 5. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| T1 | **Bài đo mobile mới** (`e2e/mobile-390.spec.ts`, bản build, `gikky_e2e`): 390×844 `isMobile` trên danh sách trang ở §2 (khách) + các trang user (đăng nhập bằng helper e2e sẵn có, không nhập mật khẩu thật). Mỗi trang: `scrollWidth ≤ 390`; mọi `input/select/textarea` hiện ra ≥ 16px; mọi nút / tab / chip / checkbox-label hiện ra cao ≥ 44px, link chữ trong dòng meta + chân trang ≥ 24px — **allowlist tường minh**, mỗi mục có lý do; ở 4 vị trí cuộn, không điều khiển nào bị phần tử fixed/sticky đè (`elementFromPoint` tại tâm). Có expect > 0 cho mỗi nhóm để bài không đo rỗng. |
| T2 | M1: trang lọc nhật ký — `nut-ghi-nhat-ky-di-dong` bấm trúng được khi thanh cài app đang hiện; cuộn hết trang thì link chân trang bấm trúng được; `/dang-mach` không có thanh. |
| T3 | Desktop 1280px: ảnh chụp / số đo trước-sau của `/`, trang lọc, `/s/*`, trang mạch, hồ sơ, `/dang-mach` không đổi bố cục (cùng vị trí các khối chính ±2px). |
| T4 | SEO: `/`, trang lọc, `/s/*`, trang mạch, hồ sơ — cùng tập link `/m/` + `/s/*`, cùng head, cùng thứ tự DOM của các section (đo trước/sau). |
| T5 | Home mobile: "Bài viết" hiện TRƯỚC rail (đo `getBoundingClientRect().top`). |
| G | `pnpm lint`, tsc, `pnpm build`, `pnpm e2e:don-vi`, e2e đầy đủ `CI=1` + `gikky_e2e` (đỏ ⊆ nền), `mau-token.spec.ts` + `seo-trang-chu.spec.ts` xanh không sửa. Bài đo cũ bị đổi ghi tên + lý do. Thử phá ≥ 3 chỗ của bài đo mobile (vd trả cỡ chữ ô tìm kiếm về 13.5px; trả thanh cài app về đè nút ghi; làm "Chia sẻ" rơi dòng). |

## 6. Rủi ro

- Luật cỡ chữ ô nhập toàn cục có thể đổi giao diện desktop nếu đặt sai media query — T3 bắt.
- Tiptap (`/dang-mach`, ngăn đăng nhanh) có CSS riêng; vùng soạn là `contenteditable`, không phải `textarea` — kiểm riêng.
- `display: contents` trên khung hai cột làm mất các thuộc tính của chính khung (nền, padding) — chỉ dùng ở home mobile.
- Ẩn rail trên trang form: kiểm `robots` của từng trang trước khi ẩn.
- Bài đo mobile dễ thành bài đo rỗng hoặc allowlist phình — phiên chính đọc allowlist khi đối chiếu.
