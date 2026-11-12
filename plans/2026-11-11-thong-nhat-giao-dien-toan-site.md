# Thống nhất giao diện toàn site theo homepage v2

> **Trạng thái:** CHỜ USER DUYỆT. Nhánh `v2`. Nối tiếp `plans/2026-11-11-homepage-v2-giao-dien-moi.md`
> (homepage đã xong) và `plans/2026-11-10-hai-cot-toan-site.md` (khung hai cột).
> Sổ việc: `GHI-CHU.md` việc 14.
>
> **Nền khi lập plan:** `v2` @ `faca28e` · pytest **2700** bài (`--collect-only`) · 17 bài đỏ sẵn
> (`LOI-VA-NO.md` P-20261111-11). Thợ đứng ở cây có số khác thì DỪNG và báo.

## 1. Yêu cầu của user (2026-11-11, sau khi xem dev.gikky.net)

- Khối chủ đề và cột phải trên `/`: "có gì đó vẫn không ổn".
- `/?tab=moi&loai_mach=nhat_ky`: "cách trình bày ở đây khác hẳn home".
- `/s/quan-tri-von`: "vẫn là phần cũ, cũng không có gì khớp với cái đang làm".
- "Lên kế hoạch cho toàn bộ các sửa đổi."

## 2. Hiện trạng đã đo (dev.gikky.net, khách, 1280px, theme tối)

### 2.1 Hai giao diện song song
`app/page.tsx:120` rẽ nhánh: URL có `tab`/`loai_mach`/`trang_thai`/`khoang`/`cursor`/`truong_phai` ⇒ `Feed` cũ;
không có ⇒ `TrangChuV2`. `/s/<sub>` luôn là `Feed` cũ.

| | Homepage v2 | `Feed` cũ (`/?…`, `/s/*`) |
|---|---|---|
| Thẻ | `TheNhatKy`: hộp có viền, avatar + tác giả ở đầu, trích 3 dòng, ảnh nhỏ bên phải, chip trạng thái | `TheMach`: không hộp, `s/sub` đứng đầu, ảnh to hết chiều ngang, không trích khi có ảnh |
| Dải điều khiển | Mới nhất / Đang mở / Đã đóng sổ | Mới nhất / Đang diễn ra / Nổi bật + nút Thẻ/Gọn + chip "Loại: … ✕ Bỏ lọc" |
| Ô soạn nhật ký | có | không |
| Khối khách (rail) | "Bắt đầu nhật ký của bạn" | "Tham gia Gikky.net" |

Hệ quả: bấm "Đang mở" hay "Tất cả nhật ký →" ở home là nhảy sang một trang mà dải tab không còn mục vừa bấm.
`TheMach` còn nuôi hồ sơ (`tab-ho-so.tsx`), tìm kiếm (`ket-qua-tim-kiem.tsx`) và cuộn vô hạn (`cuon-vo-han.tsx`).

### 2.2 Khối chủ đề
1. **Thân chủ đề 1484 lộ markdown thô.** `GET /api/v1/machs/1484`: mốc 1 có `body_dinh_dang: "html"` nhưng `body`
   là markdown (`- **Phái phòng thủ**: …`) ⇒ in nguyên. Cùng body có dấu nháy hỏng: `\" bảo toàn vốn\\ và \nắm bắt`
   (chữ "n" của "nắm" bị nuốt thành `\n`) — dấu vết escape sai ở đường đăng (script / shell). **Lỗi dữ liệu + đường đăng,
   không phải lỗi render.**
2. "Quan điểm nổi bật" mà cả ba đều `▲ 0`; ba bình luận cùng lúc 11/11 14:50.
3. Tên tác giả lẫn hai dạng (`muinx`, `u/ngxuanmui`, `thuydtb86`) — do `display_name || u/username` chép ở 7 file.
   Tên/avatar ở khối này không bấm được.
4. "Viết quan điểm của bạn" và "Xem tất cả quan điểm →" cùng một `href` (`duongDanKhanDai`).
5. `/chu-de` hiện "3 bình luận", home giấu số dưới 4 — **cố ý** (docstring `kho-chu-de.tsx:23`), giữ nguyên.

### 2.3 Cột phải
6. Link `/chu-de` nằm cuối khối "Về gikky.net" (`sidebar.tsx:98`); trên `/chu-de` nó trỏ về chính trang đó.
7. "Luật cộng đồng" 3 lần (khối khách, khối luật, `ChanTrang`); `ChanTrang` có link "Trang chủ" ngay trên `/`.
8. Câu "Có thể ghi riêng tư, công khai khi bạn muốn." lặp ở khối khách và ô soạn.
9. `KhoiKhach` và nút Đăng nhập/Đăng ký là client component hỏi phiên sau khi tải ⇒ rail giật xuống, header nhảy.
10. `/s/<sub>`: header trang và khối "Về s/…" của rail in **cùng** mô tả + cùng dòng "114 mạch · lập 25/08/2026".

### 2.4 Trang lọc
11. Feed `moi` sắp theo hoạt động gần nhất nhưng thẻ in `published_at` ⇒ ngày trông lộn xộn (10/11, 06/11, 09/11, 03/11…).
12. `/?tab=moi&loai_mach=nhat_ky` không có chữ nào nói "đây là trang nhật ký" ngoài chip lọc.

## 3. Ràng buộc cứng

- **SEO chỉ CỘNG, không BỚT** (`GHI-CHU.md` việc 11): mọi URL cũ (`?tab=`, `?khoang=`, `?cursor=`, `?loai_mach=`,
  `?trang_thai=`, `?truong_phai=`) trả đúng tập bài như cũ; `<title>`, meta, canonical, JSON-LD, chữ `<h1>` + lede của `/`
  và `/s/*` giữ từng byte; link `<a href="…cursor=…">` vẫn nằm trong HTML server-render. Một HTML cho mọi UA.
  Cấm đổi mặc định của `/feeds/moi` (sitemap).
- **Màu**: 0 hex mới; `mau-token.spec.ts` xanh không sửa (`--gain`/`--loss`/`--stamp` khoá theo selector — dùng lại
  class sẵn có của `con-so.module.css` / `the-mach.module.css`).
- Quy ước repo: `force-dynamic`, không `<Suspense>`/`loading.tsx`, gọi API theo tên hàm kèm `baseUrl`, `pnpm lint` 0 warning.
- e2e: `gikky_dev` chứa dữ liệu thật — cấm `pnpm e2e` trần; trỏ `gikky_e2e` bằng `DATABASE_URL` trong cùng lệnh, `CI=1`.
- Nhiều phiên chung checkout: commit theo pathspec, không `git add -A`, kiểm số migration trước khi thêm.
- Không seed bình luận / tương tác giả.

## 4. Thiết kế

### 4.1 Một thẻ cho mọi danh sách — `TheMach` mang hình dạng của `TheNhatKy`
Gộp về **một** component thẻ (giữ tên `TheMach`, `data-testid="the-mach"`), hình dạng lấy từ `TheNhatKy`:
hàng đầu avatar · tên (+ BOT · DEMO) · ngày · `s/sub` · chip bên phải → tiêu đề → dải lệnh (chỉ khi `mach.lenh`)
→ trích 3 dòng + ảnh nhỏ bên phải → chân thẻ (vote · N mốc · bình luận · Theo dõi · Chia sẻ · mod).

Khác biệt theo `loai_mach`, cùng một khung:
- `nhat_ky`: chip "Đang mở" / "Đã đóng sổ".
- `thao_luan`: chip "Đang mở" / "Đã đóng" (chủ đề không phải sổ — giữ luật chữ ở `the-mach.tsx:104`).
- `bai_viet`: **không** chip trạng thái; không dải lệnh.
- Nhãn loại ("Nhật ký" / "Bài viết" / "Chủ đề") hiện khi danh sách lẫn nhiều loại (prop `hienNhanLoai`, như hiện nay).
- Giữ nguyên các dấu `đã lưu trữ`, `🔒 riêng tư` của `TheMach`.

`TheNhatKy` thành lớp bọc mỏng hoặc bị thay hẳn — thợ chọn cách ít đổi bài đo hơn, ghi lý do. Thẻ phải chạy được
trong `CuonVoHan` (client) như `TheMach` hiện nay.

Nơi dùng: `/` (khối nhật ký), `/?…`, `/s/*`, cuộn vô hạn, hồ sơ `/u/*`, tìm kiếm.

**Bỏ nút Thẻ/Gọn** (`ChonKieuXem`, `lib/kieu-xem.ts`, script trong `layout.tsx`): thẻ mới đã là dạng gọn (ảnh nhỏ,
trích 3 dòng), giữ nút là giữ hai bộ CSS cho một việc.

**Ngày trên thẻ** (mục 2.4-11): thẻ in ngày đăng như cũ; khi `entry_count > 1` và mốc mới nhất rơi vào ngày (giờ VN)
SAU ngày đăng thì thêm "· nối mốc dd/mm". *(Sửa sau đợt B, 2026-11-11: nguồn là `moc_moi_nhat.created_at`, KHÔNG phải
`last_entry_at` — `last_entry_at` đo cả mốc bị ẩn / bia mộ, in nó là lộ ngày của mốc người xem không đọc được. Chỉ in khi
ngày mốc LỚN HƠN ngày đăng, vì `published_at` bị dời về sau khi mạch riêng tư chuyển công khai hoặc phát hành lại.)*

**Quyết định bổ sung sau đợt B (2026-11-11):** giữ huy hiệu "+N ảnh" trên ảnh nhỏ; nút "Theo dõi" tác giả ở chân thẻ dùng
kho chung theo username (`lib/kho-theo-user.ts`: mỗi tác giả một lời gọi, chỉ hỏi khi nút lọt khung nhìn), thẻ của chính
chủ trang hồ sơ không có nút; testid con giữ bộ `the-nhat-ky-*` (đổi tên là việc riêng). **Còn mở:** watermark `gikky.net`
trên ảnh nhỏ của thẻ (thẻ cũ có từ `b812cac`, thẻ mới không) — chờ user.

### 4.2 Một dải điều khiển cho mọi feed (`/?…` và `/s/*`)
Ba hàng, từ trên xuống, URL không đổi:

1. **Loại**: Tất cả · Nhật ký · Bài viết · Chủ đề — chính `LocLoaiMach` đang có ở `/s/*`, nay dùng cả ở `/?…`
   (thay chip "Loại: … ✕ Bỏ lọc").
2. **Trạng thái** — chỉ khi loại là Nhật ký: Tất cả · Đang mở · Đã đóng sổ (`?trang_thai=`). Cùng class, cùng chữ với
   dải tab của khối nhật ký trên home, để bấm từ home sang là thấy đúng mục đang sáng.
   `/s/*` hiện chưa nhận `?trang_thai=`: thợ kiểm `api/api/feeds.py` (hàm lọc chung ở dòng ~96 đã có tham số; endpoint feed
   theo sub có mở ra chưa) — chưa thì thêm tham số + `pnpm codegen`.
3. **Sắp xếp**: Mới nhất · Đang diễn ra · Nổi bật (`?tab=`) + chọn khoảng khi ở "Nổi bật" — thu nhỏ, canh phải, vẫn là
   link thật. Chip "Trường phái: #… ✕" giữ nguyên.

Luật cũ giữ: đổi tab rớt `cursor`, giữ `khoang`; tab "Đang diễn ra" bỏ `trang_thai` (`trangThaiGuiLenApi`).

**Quyết định bổ sung khi làm đợt C (2026-11-12):** đổi loại (hàng 1) thì RỚT `trang_thai` (giữ là lọc ngầm sang loại
khác); URL có `trang_thai` mà hàng 2 không hiện (`/?tab=moi&trang_thai=open`, loại khác nhật ký) giữ chip "Trạng thái: … ✕
Bỏ lọc", chữ "Đã đóng" cho loại không phải nhật ký; `hrefTrangThai` dựng từ `hrefChipLoai` — một trạng thái một URL, ở `/`
luôn có `tab=` (không thì chip "Tất cả" đẩy về trang chủ v2); `CuonVoHan` mang `key` = toàn bộ bộ lọc (cursor API không
mang bộ lọc ⇒ đổi bộ lọc qua điều hướng client từng giữ thẻ của bộ lọc cũ); có `<h2>` loại thì thẻ là `<h3>`; `<h2>` đổi
theo trạng thái ("Nhật ký đang mở" / "Nhật ký đã đóng sổ"); mobile: nút về đầu trang nhích lên trên nút dính đáy "Ghi nhật ký".

Home: dải tab của khối nhật ký đổi mục đầu từ "Mới nhất" thành "Tất cả" cho khớp hàng 2? **Không** — ở home mục đầu
là chính khối (mỗi tác giả một bài), giữ chữ "Mới nhất"; hai mục kia khớp chữ với hàng 2.

### 4.3 Trang lọc nhật ký `/?…&loai_mach=nhat_ky`
- `<h1>` + lede giữ nguyên (SEO). Ngay dưới thêm `<h2>` theo loại đang lọc: "Tất cả nhật ký" / "Tất cả bài viết" /
  "Chủ đề thảo luận"; không lọc loại thì không có `<h2>` này.
- Khi loại là Nhật ký: có ô soạn nhanh "Bạn vừa quyết định gì?" (tách phần ô soạn của `trang-chu-v2.tsx` thành
  component dùng chung).
- Rail: khối khách dùng cùng tiêu đề với home ("Bắt đầu nhật ký của bạn").

### 4.4 Trang chuyên mục `/s/<sub>`
- Header: slug · tên (`<h1>`, giữ chữ) · mô tả · nút Theo — bỏ dòng "N mạch · lập …" khỏi header.
- Rail: khối "Về s/…" chỉ còn dòng "N mạch · lập …" + (mới) hai link nhanh "Nhật ký trong chuyên mục →",
  "Bài viết trong chuyên mục →"; **không** lặp mô tả.
- Dải điều khiển + thẻ theo 4.1, 4.2. Ô soạn nhanh hiện khi lọc Nhật ký (mở ngăn kéo với chuyên mục chọn sẵn nếu
  ngăn kéo nhận được tham số ấy; không thì như home).

### 4.5 Khối chủ đề trên `/`
- **Dữ liệu chủ đề 1484** (2.2-1): tìm đường đã đăng nó (form admin `form-dang-bai.tsx` hay script) và vì sao markdown đi
  ra với `body_dinh_dang="html"` + dấu nháy hỏng; sửa đường đăng (đúng định dạng, không escape qua shell); sửa nội dung
  mốc 1 trên dev bằng cửa sửa chính thức. Prod chưa có chủ đề này — kiểm trước khi deploy.
- **Quan điểm**: điểm cao nhất ≤ 0 ⇒ tiêu đề "Quan điểm mới", sắp mới nhất trước, ẩn `▲ 0` (không phô sự im lặng).
  Có ít nhất một bình luận điểm > 0 ⇒ "Quan điểm nổi bật" như cũ, chỉ in `▲ N` khi N ≠ 0.
- Tên + avatar là link `/u/<username>`.
- "Viết quan điểm của bạn" trỏ tới **ô soạn bình luận** (thêm `id` cho ô soạn / hộp "cần đăng nhập" ở `khan-dai.tsx`,
  ví dụ `#viet-binh-luan`); "Xem tất cả quan điểm →" giữ `#khan-dai`.

### 4.6 Tên hiển thị — một hàm
`lib/` thêm `tenHienThi(author)`; thay 7 chỗ chép tay (`binh-luan`, `ket-qua-tim-kiem`, `khoi-thao-luan`, `khoi-trich`,
`thanh-tai-khoan`, `the-mach`, `the-nhat-ky`). Luật: có `display_name` thì in nó, không thì in `username` **không** tiền tố
`u/` (tiền tố vẫn ở `title` và trang hồ sơ). Thợ quét bài đo ghim chữ `u/` trước khi đổi.

### 4.7 Cột phải (mọi trang có rail)
- **Khối "Chủ đề tuần này"** thay cho dòng link trong "Về gikky.net": tiêu đề chủ đề đang mở (link) + "Vào thảo luận" +
  "Các chủ đề trước →" (`/chu-de`). Hiện ở mọi trang có rail **trừ** `/` (đã có khối tiêu điểm); trên `/chu-de` bỏ link tự
  trỏ. Không có chủ đề nào ⇒ ẩn khối. Dữ liệu do trang / `KhungHaiCot` nạp ở server rồi truyền xuống (`Sidebar` vẫn không
  gọi API). Trang tĩnh (`/luat`) không có khối này.
- **Bớt lặp**: `ChanTrang` trong rail chỉ còn disclaimer (bỏ "Luật cộng đồng", "Trang chủ" — khối luật ngay trên đã dẫn
  `/luat`, đủ PLAN 5.10); bỏ `khachMoTa` ở home.
- **Hết giật**: khách hay thành viên được biết **trước khi vẽ** bằng một cookie cờ không nhạy cảm (đặt lúc đăng nhập,
  xoá lúc đăng xuất) + script inline đầu `<body>` gắn `data-phien` lên `<html>` — cùng cách theme đang làm trong
  `layout.tsx`. `KhoiKhach` và cụm nút header render sẵn trong HTML, CSS ẩn/hiện theo `data-phien`. Trang vẫn cache được,
  HTML vẫn một bản cho mọi người. Cờ chỉ là gợi ý hiển thị; quyền vẫn do API quyết.

## 5. Chia đợt (mỗi đợt một vòng code → nghiệm thu → phản biện, commit riêng)

| Đợt | Nội dung | Mục |
|---|---|---|
| **A** | Khối chủ đề + tên hiển thị + sửa dữ liệu / đường đăng chủ đề | 4.5, 4.6 |
| **B** | Thẻ thống nhất; thay ở `/`, feed, cuộn vô hạn; bỏ Thẻ/Gọn | 4.1 |
| **C** | Dải điều khiển chung; trang lọc nhật ký; `/s/*` (kèm `trang_thai` cho feed sub nếu thiếu) | 4.2, 4.3, 4.4 |
| **D** | Thẻ mới cho hồ sơ + tìm kiếm | 4.1 |
| **E** | Cột phải: khối chủ đề tuần, bớt lặp, hết giật | 4.7 |

A và E độc lập với B–D. B phải xong trước C và D. Không chạy hai đợt cùng chạm `feed.tsx` / `the-mach.tsx` song song.

## 6. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| T1 | `/`, `/?tab=moi&loai_mach=nhat_ky`, `/s/<sub>`, `/u/<x>`, tìm kiếm: mọi thẻ cùng một component, cùng cấu trúc DOM (đo bằng tập testid con của thẻ). |
| T2 | Từ home bấm "Đang mở" / "Đã đóng sổ": trang đích có hàng Trạng thái với đúng mục ấy mang `aria-current`. |
| T3 | Mọi URL feed cũ trả **cùng tập `data-mach-id`, cùng thứ tự** như trước đợt B (đo trước/sau trên `gikky_e2e`); link `cursor` còn trong HTML; `<title>`, meta, canonical, JSON-LD của `/` và `/s/*` không đổi byte (script inline của nút Thẻ/Gọn bị gỡ khỏi `<head>` là thay đổi duy nhất được phép — mục 4.1). |
| T4 | `/s/<sub>`: mô tả và dòng số mạch mỗi thứ xuất hiện đúng một lần trên trang. |
| T5 | Khối chủ đề: không còn `▲ 0`; hai nút có `href` khác nhau, nút "Viết" đưa tới ô soạn; tên là link hồ sơ. |
| T6 | Trang mạch chủ đề 1484 trên dev: không còn `**` / `- ` thô, dấu nháy đúng — **sửa tay qua "Sửa bài" ở khu quản trị, việc của user / phiên chính, không phải của thợ**. *(Sửa 2026-11-11 sau đợt A: thợ + nghiệm thu xác nhận repo không có lỗi đường đăng — `api/core/ghi.py:543` luôn ghi `html`, `MocMoiIn`/`MachMoiIn` không nhận `body_dinh_dang`, form admin là Tiptap. Markdown đi vào do người / script ngoài repo gửi sai hợp đồng. Bỏ yêu cầu "bài đo ở đường đăng"; có chặn body trông như markdown hay không là quyết định riêng, đã ghi sổ.)* |
| T7 | Rail: `/luat` đúng 2 link trong rail (khối khách + khối luật) hoặc ít hơn; không link "Trang chủ"; `/chu-de` không tự trỏ. |
| T8 | Khách tải `/`: vị trí khối đầu tiên của rail và cụm nút header không đổi giữa lần vẽ đầu và sau hydrate (đo `getBoundingClientRect`). |
| T9 | Mobile 390px không tràn ngang trên 5 loại trang ở T1; vùng bấm ≥ 44px. |
| G | `pnpm lint`, `tsc`, `pnpm build`, `pnpm e2e:don-vi`, pytest (đỏ ⊆ 17 bài nền), e2e đầy đủ `CI=1` + `gikky_e2e` (đỏ ⊆ đỏ nền), `mau-token.spec.ts` + `seo-trang-chu.spec.ts` xanh không sửa. Mỗi bài đo cũ bị đổi phải ghi tên + lý do. Thử phá ≥ 2 bài đo mới mỗi đợt. |

## 7. Rủi ro đã thấy

- **Bài đo ghim DOM của `TheMach`** nằm ở ≥ 14 file e2e (`vo-reddit`, `giao-dien`, `hai-cot`, `phase-3`, `chu-de`,
  `chuyen-muc-loc-loai`, `trang-chu-v2`, `trang-chu-giao-dien-moi`, `seo-va-trang`, …). Đợt B là đợt nặng nhất; thợ phải
  liệt kê bài đo đổi trước khi sửa, không sửa bài đo cho xanh mà không nêu lý do.
- **Link `/m/` trên `/s/*` và feed**: thẻ mới vẫn phải có link tiêu đề + ảnh như cũ; số link `/m/` duy nhất mỗi trang
  không được giảm (đo trước/sau).
- **Ảnh to biến mất khỏi feed** là thay đổi người dùng thấy rõ nhất (biểu đồ Bot Trader). Đúng yêu cầu "lê thê, khó xem
  trên mobile" đã chốt cho home; ở đây áp ra toàn site.
- **Cookie cờ phiên** (4.7) chạm đường đăng nhập / đăng xuất ở Django ⇒ có pytest; cờ lệch (đăng xuất ở tab khác) phải tự
  sửa sau khi `usePhien` trả lời.

## 8. Cần user chốt (mặc định ghi sẵn, không trả lời thì làm theo mặc định)

1. Phạm vi thẻ mới: có áp cho **hồ sơ và tìm kiếm** (đợt D) không? — mặc định **có**.
2. **Bỏ nút Thẻ/Gọn**? — mặc định **bỏ**.
3. Tên không có `display_name`: bỏ tiền tố `u/`? — mặc định **bỏ**.
4. Khối "Chủ đề tuần này" trên rail của mọi trang? — mặc định **có**.
5. Ba bình luận 14:50 ngày 11/11 ở chủ đề 1484 trên dev: giữ hay xoá trước khi lên prod? — **không có mặc định**, plan
   này không đụng dữ liệu đó.
