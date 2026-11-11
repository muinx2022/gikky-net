# Giao diện chung toàn web: HAI CỘT — một cột nội dung + một cột phải (bỏ cột trái ở MỌI trang)

> **Trạng thái:** ĐÃ DUYỆT (user, 2026-11-10: "thống nhất giao diện chung của web là 2 cột, 1 cột content và cột bên phải"), chưa chạy. Nhánh `v2`.
> Trả lời câu hỏi còn mở "bỏ cột trái chỉ ở homepage hay mọi trang" (`GHI-CHU.md` việc 11): **mọi trang của `apps/web`**. `apps/admin` có khung riêng, **không** thuộc việc này.
> **Chỉ bắt đầu khi** `opus-dev` đã xong việc sửa hai bài đo của chip lọc loại (`plans/2026-11-10-chuyen-muc-loc-loai.md`) — hai việc chạm chung `feed.tsx` và dùng chung cổng 3000 / 8000.

## 1. Bối cảnh

Hôm nay có BA khung khác nhau, mỗi khung một lưới:
- `components/khung-hai-cot.tsx` (+ `.module.css`): lưới **ba cột** `226px · 700px · 300px` — trang mạch `/m/…`, hồ sơ `/u/…`, tìm kiếm, đăng nhập / đăng ký, cài đặt, đăng mạch, khu mod… (13 trang). Bản **tĩnh** `khung-hai-cot-tinh.tsx` cho `/luat`.
- `components/feed.tsx` + `feed.module.css`: lưới ba cột riêng cho `/s/<sub>`; nhánh `haiCot` (hai cột) cho `/` và `/?tab=…`.
- `components/khung-trang-chu.tsx` (+ `.module.css`): hai cột `760px · 300px` cho `/` và `/chu-de`.
Phản biện homepage v2 đo: điều hướng `/` → `/s/x` làm cột nội dung nhảy ngang 193px (x=85,w=760 so với x=278,w=635) — đúng cái lỗi mà `KhungHaiCot` được lập ra (2026-08-24) để diệt. User chốt thống nhất: **một khung hai cột cho cả web**.

## 2. Thiết kế

1. **MỘT khung, MỘT lưới, MỘT nguồn sự thật** (`khung-hai-cot.module.css` làm gốc; `KhungTrangChu`, `Feed`, `KhungHaiCot`, `KhungHaiCotTinh` đều dùng cùng lớp): `max-width: 1200px; grid-template-columns: minmax(0, 760px) 300px; gap: 36px; justify-content: center`, quy tắc rail như `khung-trang-chu.module.css` (rail cuộn theo trang; chỉ `sticky` ở `min-width: 961px` và `min-height: 1060px`; không `max-height`/`overflow` — xem bẫy ghi ở đó). Dưới 960px: một cột, rail xuống DƯỚI nội dung. Xoá mọi bản sao lưới / `rail_trai`, và xoá các chú thích "⚠ ba con số phải khớp". `Feed` bỏ prop `haiCot` (hai cột là mặc định duy nhất). Mọi trang trả `<main>` đúng một lần (khung lo thẻ `<main>`).
2. **Bỏ `CotTrai` khỏi mọi trang.** Nội dung của nó được CHUYỂN, không bỏ rơi:
   - **Danh sách chuyên mục** → khối "Chuyên mục" của rail phải (`Sidebar` prop `hienChuyenMuc`) — **bật ở MỌI trang có rail**, vì `CotTrai` đang đặt 13 link `/s/*` + `/luat` trên MỌI trang (bot vào trang mạch ~12.000 lượt / 30 ngày): bỏ mà không chuyển là bớt link nội bộ từ mọi bài. Giữ danh sách chữ thuần như khối hiện có (không icon, không màu mới); icon màu cứng trong `cot-trai.tsx` (`layPhongCachSub`) biến mất cùng file.
   - **Khối "Tham gia Gikky.net" cho KHÁCH** (nút Google / email / "Tạo tài khoản mới" + dòng đồng ý Luật) → đầu rail phải, chỉ khi là khách (component client nhỏ; giữ `data-testid` cũ `cot-trai-khach`, `cot-trai-nut-google`, `cot-trai-nut-email`, `cot-trai-nut-dang-ky` để bài đo đăng nhập / đăng ký không phải đổi chỗ định vị, hoặc đổi tên có chủ đích và ghi vào báo cáo).
   - **"Tài nguyên"**: "Luật cộng đồng" đã có ở khối "Luật rút gọn" của rail; "Hồ sơ của tôi" và "Cài đặt" (chỉ khi đăng nhập) → kiểm xem menu tài khoản ở header đã có chưa; nếu chưa thì thêm một khối "Tài khoản" nhỏ ở rail (chỉ khi đăng nhập).
   - Trang tĩnh `/luat` (`KhungHaiCotTinh`) **không được gọi API ở server** (`e2e/don-vi/trang-loi.spec.ts` canh). Khối Chuyên mục ở đó, nếu muốn có, phải tự nạp ở TRÌNH DUYỆT như `CotTrai` đang làm (`docCacSubOTrinhDuyet`); nếu không thì để vắng như hiện nay (rail của `/luat` đã vắng khối này vì `cacSub=[]`).
3. **Xoá file chết:** `components/cot-trai.tsx`, `cot-trai.module.css`, và `khung-trang-chu.*` nếu đã gộp (hoặc giữ làm vỏ mỏng bọc khung gốc). Không để import mồ côi; `pnpm lint` 0 warning.
4. **Cột nội dung 760px ở mọi trang** (một con số). Trang mạch đọc dài vẫn ổn ở 760px. Cột nội dung phải có CÙNG `x` và CÙNG bề rộng trên mọi trang ở cùng viewport — đó là tiêu chí chính.
5. **Giữ nguyên:** `<head>` mọi trang; nội dung bên trong `<main>`; header toàn site; thanh điều hướng dưới trên mobile; màu / token / font; `apps/admin`.

## 3. Phạm vi

### LÀM
`components/khung-hai-cot.tsx`, `khung-hai-cot-tinh.tsx`, `khung-hai-cot.module.css`, `khung-trang-chu.*`, `feed.tsx`, `feed.module.css` (xoá lưới ba cột + `rail_trai`), `sidebar.tsx` (+ khối khách / tài khoản), `app/s/[sub]/page.tsx` (truyền `hienChuyenMuc`), `app/m/[slugId]/page.tsx` và mọi trang đang gọi `KhungHaiCot` (chỉ nếu cần đổi prop), xoá `cot-trai.*`, bài đo e2e bị ảnh hưởng (xem mục 5).

### KHÔNG LÀM
`<head>` / title / meta; nội dung trong `<main>`; API; `apps/admin`, `apps/mobile`, `scripts/`; màu / token / font mới; thứ tự khối trang chủ; chip lọc loại của `/s/*` (việc khác, đang được sửa bài đo).

## 4. Tiêu chí nghiệm thu (đo được)

**Thứ tự bắt buộc:** (a) với frontend HIỆN TẠI (trước khi sửa dòng nào) dựng Django (8000, `gikky_e2e`) + `next build` + `next start` (3000), chụp HTML thô nền và đo `x`/bề rộng `<main>` của: `/`, `/chu-de`, `/s/chung-khoan`, `/s/e2e-thu-nghiem`, `/m/<một mạch>` (nhật ký), `/m/<một chủ đề>`, `/u/e2e_nhieu_mach`, `/tim-kiem?q=e2e`, `/luat`, `/dang-nhap`, `/dang-ky`, `/dang-mach`; (b) code; (c) đo lại. Trang cần đăng nhập (`/cai-dat`, `/sua-ho-so`, `/khu-mod`) đo bằng phiên đăng nhập trong Playwright.

| # | Kiểm | Kết quả mong đợi |
|---|---|---|
| W1 | Đo `main.getBoundingClientRect()` ở 1280×900 trên CẢ 12 URL trên | **Cùng `x`, cùng `width`** (760) ở mọi trang; hết "nhảy ngang" khi điều hướng (đo thêm bằng click thật `/` → `/s/chung-khoan` → `/m/…` → `/u/…`: `x` không đổi) |
| W2 | Không còn cột trái ở đâu | Không có `aside[aria-label="Cột điều hướng"]`, không `.rail_trai`, không `cot-trai*` trong CSS / TSX; `components/cot-trai.*` đã xoá |
| W3 | Rail phải có mặt ở mọi trang có khung | Có `aside[data-testid="sidebar"]`; khối `sidebar-cac-sub` ("Chuyên mục") có ở MỌI trang trừ `/luat` tĩnh; tập `a[href^="/s/"]` trong rail ⊇ danh sách `GET /subs` |
| W4 | Link nội bộ không bớt: với mỗi URL trong (a), tập `a[href^="/s/"]` + `a[href="/luat"]` sau ⊇ nền | Đạt cho mọi trang (đặc biệt `/m/…`, `/u/…`, `/tim-kiem` vốn lấy link `/s/*` từ cột trái) |
| W5 | Khối khách | Khách thấy khối "Tham gia Gikky.net" ở rail phải (các nút Google / email / đăng ký hoạt động như cũ: bấm "Tiếp tục với email" mở modal đăng nhập; "Tạo tài khoản mới" → `/dang-ky`); người đã đăng nhập KHÔNG thấy khối này; "Hồ sơ của tôi" + "Cài đặt" tới được khi đã đăng nhập (ở menu header hoặc khối rail) |
| W6 | `<head>` mọi URL trong (a) nền vs sau | Y hệt từng byte (title, description, canonical, og:*, twitter:*, RSS alternate, JSON-LD) |
| W7 | Nội dung `<main>` của các URL tĩnh về cấu trúc (`/luat`, `/s/e2e-sub-rong`, `/dang-nhap`) nền vs sau | DOM trong `<main>` y hệt (dữ liệu không đổi); phần khác biệt chỉ nằm ngoài `<main>` (khung, rail) |
| W8 | `/luat` vẫn TĨNH | `e2e/don-vi/trang-loi.spec.ts` xanh, **không sửa file**; build vẫn in `○ /luat` (static), không `ƒ` |
| W9 | 375px và 768px, hai theme, trên `/`, `/s/e2e-thu-nghiem`, `/m/…`, `/luat`, `/dang-nhap` | Một cột, rail dưới nội dung, `scrollWidth ≤ innerWidth`, không phần tử nào chồng nhau; header / thanh dưới giữ nguyên |
| W10 | Rail ở 1366×768 và 1280×720 trên một trang mạch dài | Phần cuối rail tới được bằng cuộn TRANG (không vùng cuộn con ẩn thanh cuộn) |
| W11 | Màu | grep mã màu trong file mới / đổi ⇒ 0; `mau-token.spec.ts`, `quan-tri-giao-dien.spec.ts`, `seo-trang-chu.spec.ts` xanh, không sửa |
| W12 | Cùng HTML cho UA trình duyệt và Googlebot (so SEO + tập link, KHÔNG so byte — RSC của `/s/*` không tất định, sổ `P-20261110-11`) | Đạt trên `/`, `/s/*`, `/m/…` |
| G | `pnpm codegen:check`, `pnpm lint` 0 warning, `pnpm build`, `pnpm e2e:don-vi`, bộ e2e đầy đủ (`CI=1`, `gikky_e2e`) | Xanh; đỏ sau ⊆ đỏ nền (24 bài, sổ `P-20261110-5`, và có thể ÍT hơn: `vo-reddit` A8 / B10 đòi `sidebar-cac-sub` ở `/s/*` nên sẽ xanh); vân tay `gikky_dev` không đổi |

## 5. Bài đo e2e hiện có sẽ phải đổi — có chủ đích, không nới
Bài nào ĐẾM / ĐÒI cột trái hoặc lưới ba cột nay mâu thuẫn quyết định của user và phải sửa cho đúng điều mới (đổi kỳ vọng "có cột trái" thành "không có", hoặc đổi chỗ định vị khối khách), KHÔNG xoá bài đo, KHÔNG làm assertion yếu đi. Tìm bằng: `grep -rn "cot-trai\|Cột điều hướng\|rail_trai\|ba cột\|KhungHaiCot" apps/web/e2e`. Biết trước: `trang-chu-v2.spec.ts` L1 / L2 (đang đòi `/s/<sub>` còn ba cột), các bài đăng nhập / đăng ký / `tai-khoan-va-ghi.spec.ts` định vị khối khách bằng `cot-trai-*`, `giao-dien.spec.ts`, `vo-reddit.spec.ts`. Liệt kê TỪNG bài đổi (file:dòng, đổi gì, vì sao) trong báo cáo.

## 6. Rủi ro
- **Chạm gần như mọi trang** — nghiệm thu phải so HTML nền / sau của từng loại trang (W6, W7), và bộ e2e đầy đủ không có bài đỏ mới.
- **SEO nội bộ:** `CotTrai` là nguồn link `/s/*` + `/luat` trên MỌI trang; chuyển vào rail phải (W3, W4) giữ tập link nhưng đổi VỊ TRÍ trong DOM (sau `<main>` thay vì trước). Theo dõi lượt bot vào `/s/*` và `/m/*` sau deploy.
- **Trang tĩnh `/luat`** không được thêm gọi API ở server.
- **Rail cao** (13 chuyên mục + bài mới + luật + khối khách ≈ 1100px+) ở trang mạch: chỉ dính khi viewport đủ cao, nếu không cuộn theo trang (W10).

## Báo cáo thực thi (2026-11-10)

**Quy trình đã chạy:** `opus-dev` code → `nghiem-thu` độc lập (ĐẠT có điều kiện, W1–W12 đạt, G đạt một phần). **Chưa qua `phan-bien`** — sẽ gộp một lượt phản biện cho cả hai cột và việc xem trước ảnh (đỡ tốn lượt gọi).

**Đã làm.** Một khung hai cột cho cả `apps/web` (`VoKhungHaiCot` + `khung-hai-cot.module.css`: `minmax(0,760px) 300px`, gap 36px); xoá `cot-trai.*` và `khung-trang-chu.*`; `Sidebar` mang khối khách (`khoi-khach.tsx`, testid `khoi-khach*`) và khối "Chuyên mục"
(`khoi-chuyen-muc.tsx`; `/luat` tĩnh tự nạp ở trình duyệt qua `chuyen-muc-tu-trinh-duyet.tsx`); `Feed` gỡ `haiCot`, `cacSub`; rail xuống dưới nội dung ở ≤ 960px trên MỌI trang (trước ẩn ở các trang ba cột).

**Đo lại bởi nghiệm thu:** `<main>` cùng `x=84.5`, `width=760` trên 16 URL (nền: 13 URL ở `x=278, w=635` ⇒ nhảy 193px), click điều hướng thật không nhảy; `<head>` y hệt 15/16 URL (URL lệch duy nhất là do chọn mạch khác id; cùng mạch thì y hệt); tập link `/s/*` + `/luat` sau ⊇ nền ở 16/16; `/luat` vẫn `○` tĩnh;
`pnpm e2e:don-vi` 613; e2e đầy đủ 871 bài: 838 pass, 24 đỏ (23 trùng nền + `vo-reddit.spec.ts:177` A8 chập chờn), 1 skip, 8 không chạy; vân tay `gikky_dev` không đổi; thử phá 2 hàng rào đều bắt.

**Lệch plan đã chấp nhận:** ngưỡng rail dính 1060 → 1500px (rail của khách cao 1141–1376px; hệ quả rail gần như không dính trên màn thường — trang chủ trước đây dính từ 1060px); không thêm khối "Tài khoản" (menu header và thanh dưới mobile đã có); đổi testid `cot-trai-*` → `khoi-khach*`; khối khách vẽ sau khi biết phiên làm phần rail bên dưới nó dịch xuống 208px (cột nội dung đứng yên — đo bằng rAF).

**Việc dở / đã biết:** bài A8 (`vo-reddit.spec.ts:177`) đua với khối khách — sửa cho đúng ý định ("không nút Tham gia **sub**") ở lượt xem trước ảnh (Việc 0); `form-ghi.spec.ts:150` chập chờn, không liên quan khung. Rail dài hơn nội dung ở trang mạch ngắn (khoảng trắng dưới nội dung), mọi trang mobile dài thêm 1100–1350px vì rail nay hiện dưới nội dung.

**Sau phản biện gộp (2026-11-10):** không lỗi NẶNG về khung. Đo thêm: không tràn ngang ở 320 / 640 / 853 / 2560px; mỗi trang đúng một `<main>`; 13 link `/s/*` trong rail ở mọi trang; `/luat` vẫn tĩnh và sống khi Django tắt; dấu vết `cot-trai` đã hết. Vòng sửa: thêm `aria-label="Thanh bên"` cho `<aside>` rail (bài đo đúng 1 landmark, `hai-cot.spec.ts`). Mép còn lại: ledger `P-20261110-12`.
