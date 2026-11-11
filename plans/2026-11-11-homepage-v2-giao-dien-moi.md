# Homepage v2 — giao diện mới theo bản thiết kế 2026-11-11

> **Trạng thái:** CHỜ CODE. Nhánh `v2`. Nối tiếp `plans/2026-11-10-homepage-v2.md` (khung hai cột, ba khối, `/chu-de`, admin)
> và `plans/2026-11-11-nhat-ky-moi-moi-tac-gia-mot-bai.md` (lọc mỗi tác giả một bài). Plan này **chỉ đổi cách trình bày**
> ba khối trên `/`; không đổi API trừ khi mục 5 nói rõ.
>
> **Bản thiết kế (mockup tĩnh, mở bằng trình duyệt):**
> `docs/thiet-ke/homepage-v2/trang-chu-desktop.html` (1280px) và `docs/thiet-ke/homepage-v2/trang-chu-mobile.html` (390px).
> Màu trong mockup là màu nháp — **khi code phải map sang token có sẵn** (mục 2.1). Chữ trong `[ngoặc vuông]` là chỗ giữ chỗ.

## 1. Yêu cầu của user (2026-11-11, gom từ buổi thiết kế)

- "Chủ đề thảo luận sẽ là **focus** của home."
- "**Không có phần các chủ đề trước**, mỗi tuần là 1 chủ đề, hết tuần là đóng, mở chủ đề khác." (trên trang chủ; `/chu-de` giữ nguyên)
- Nhật ký là của từng user: "user A: Q.đ vào HPG vì mục tiêu xxx, sau đó là chi tiết… user B: Mua USD/JPY điểm vào, SL, TP, sau đó là chi tiết."
  Trình bày cũ "lê thê, trên mobile rất khó xem".
- "Phần tin cho xuống dưới, phần nhật ký lên trên." ⇒ thứ tự: **Chủ đề → Nhật ký mới → Bài viết**.
- "Phần bài viết cũng cần, vì dính đến SEO cũng nhiều rồi" — nhưng "nhìn giống các trang tin quá" ⇒ kiểu **thư viện kiến thức**;
  và "**ảnh theo từng tin**" ⇒ mỗi bài một ảnh thumbnail.
- "Làm sang bản **light theme**." (light là mặc định sẵn có của site — xem 2.1)
- Nút "Xem thêm nhật ký" kiểu nút viền xám "không ổn" ⇒ thay bằng dải gợi ý (mục 3.3).

## 2. Ràng buộc cứng (giữ từ plan homepage-v2)

### 2.1 Màu
- **Không thêm mã màu.** Mọi màu là `var(--…)` đã có trong `apps/web/app/globals.css`. Map gợi ý từ mockup:
  nền trang `--inset`/`--bg`; card `--surface` + viền `--line`; chữ `--ink`/`--ink-2`/`--ink-3`; nhấn & link `--accent`, nền nhấn nhạt `--accent-soft`;
  MUA / TP / "Đang mở (chủ đề)" `--gain`; BÁN / SL `--loss`; "Đã đóng sổ" & Entry `--stamp` / `--stamp-soft`.
  Nền nhạt cho chip MUA/BÁN: `color-mix(in srgb, var(--gain) 12%, var(--surface))` (cùng kiểu `--card` đang dùng) — không hex mới.
- Header toàn site (`--topbar` xanh đậm) **giữ nguyên**; mockup vẽ header trắng chỉ để minh hoạ, không làm theo.
- Dark mode phải vẫn đúng (chỉ dùng token ⇒ tự đúng). `e2e/don-vi/mau-token.spec.ts` xanh **không sửa**.

### 2.2 SEO
- `<title>`, meta, canonical, OG, JSON-LD, **chữ `<h1>` và lede giữ từng byte** (`seo-trang-chu.spec.ts` không sửa).
  Mockup dùng câu hỏi chủ đề làm `h1` — **không làm theo**: giữ `h1`+lede hiện có thành một dòng giới thiệu gọn phía trên,
  câu hỏi chủ đề là `h2` cỡ lớn trong khối chủ đề.
- Số link `/m/` duy nhất trên `/` **≥ 19** (mức đã chấp nhận ở vòng sửa 5). Một nội dung cho mọi UA. Link chuyên mục `/s/*`, `/luat` còn đủ.
- Bài viết: mỗi mục là `<article>` có `<a href>` thật, tiêu đề là heading, ngày trong `<time datetime>`.

### 2.3 Quy ước repo
`force-dynamic`, không `loading.tsx`/`<Suspense>`, `Promise.all`, gọi API kèm `baseUrl` theo tên hàm, `pnpm lint` 0 warning,
e2e chạy đúng cách trong memory (`gikky_e2e`, `CI=1`). Không `git add -A` (file lạ ở working tree — xem cuối plan homepage-v2).

## 3. Thiết kế từng khối

### 3.0 Dòng giới thiệu (đầu trang)
`h1` + lede như cũ nhưng cỡ chữ vừa (không còn là tiêu điểm). Nút "Mở nhật ký" → `/dang-mach` dời vào khối 3.2 (ô soạn nhanh).

### 3.1 Chủ đề tuần — TIÊU ĐIỂM
Một khối rộng toàn cột nội dung (desktop: chia 2 phần trái/phải bên trong khối), viền trên `--accent` 3px.
- Trái: nhãn "CHỦ ĐỀ TUẦN NÀY" · khoảng tuần (thứ Hai–Chủ nhật giờ VN của `published_at`, ví dụ "09/11 – 15/11") · chip "Đang mở · còn N ngày"
  (N = số ngày tới hết Chủ nhật; chủ đề đã đóng ⇒ chip "Đã đóng", không đếm). Câu hỏi (`h2`, ~32px desktop / 22px mobile).
  Một dòng bối cảnh = đoạn đầu nội dung chủ đề cắt gọn (nếu có). Nút chính "Vào thảo luận" + nút phụ "Viết quan điểm của bạn" (cả hai tới trang mạch, nút phụ neo tới ô bình luận). Số người tham gia / bình luận theo luật đếm PLAN nguyên tắc 9 (< 4 thì ẩn số).
- Phải: "Quan điểm nổi bật" — 2–3 bình luận gốc của chủ đề (avatar chữ cái, tên, ▲ điểm, 3 dòng trích) + "Xem tất cả quan điểm →".
  Chọn theo điểm cao nhất; chưa có bình luận ⇒ ẩn phần phải, phần trái chiếm hết.
- **KHÔNG** có danh sách "Các chủ đề trước" trên `/` (link `/chu-de` vẫn ở rail phải cho ai cần kho cũ).
- **Ngoài phạm vi:** hai nút chọn phe ("Ưu tiên quản trị rủi ro" / "Canh nhịp chỉnh để gom hàng") trong mockup cần mô hình dữ liệu
  "lựa chọn quan điểm" chưa có ⇒ **không làm** lượt này; ghi sổ `LOI-VA-NO.md` E như một ý tưởng chờ user quyết.
- Mobile: khối là màn hình đầu tiên; quan điểm nổi bật chỉ 1.

### 3.2 Nhật ký mới (giữ lọc mỗi tác giả một bài)
- Đầu khối: tiêu đề "Nhật ký mới" + 1 dòng mô tả + "Tất cả nhật ký →" (`/?tab=moi&loai_mach=nhat_ky`).
- Ô soạn nhanh (desktop): avatar + ô "Bạn vừa quyết định gì? Ví dụ: Vào HPG vì…" — bấm vào là đi `/dang-mach` (link, không form mới).
  Mobile: không có ô này; thay bằng nút dính đáy "Ghi nhật ký" → `/dang-mach`.
- Tab: Mới nhất / Đang mở / Đã đóng sổ (link thật tới feed cũ có lọc tương ứng nếu API có; tab nào API chưa lọc được thì bỏ tab đó, đừng giả).
- **Thẻ nhật ký mới (thay `TheMach` ở khối này, `/s/*` và feed cũ giữ `TheMach`):**
  1. Hàng đầu: avatar · tên · thời gian · `s/sub` · chip trạng thái bên phải ("Đang mở" / "Đã đóng sổ").
  2. Tiêu đề = câu quyết định của user (link tới mạch).
  3. **Dải lệnh (chỉ khi có dữ liệu có cấu trúc):** MUA/BÁN + mã · Entry · SL · TP (+ Nhồi, R:R nếu có). Nếu API chưa có trường
     có cấu trúc thì **không parse tiêu đề**, bỏ dải này — kiểm `MachOut`/schema trước, ghi kết luận vào báo cáo.
  4. Đoạn trích nội dung **cắt 3 dòng** (`line-clamp`) + **ảnh nhỏ bên phải** (desktop 168×104, mobile 76×76) nếu mạch có ảnh — thay cho biểu đồ to toàn chiều ngang.
  5. Chân thẻ: ▲ điểm ▼ · "N mốc" · bình luận · (phải) Theo dõi · Chia sẻ — dùng lại hành vi vote/chia sẻ đang có.
  Bot Trader: nhãn nhỏ "BOT · DEMO" cạnh tên (kiểm có cờ bot trong API; không có thì so theo username đã cấu hình — hỏi trước khi gắn cứng).
- **Chân khối (thay nút "Xem thêm nhật ký"):** dải nền `--accent-soft`, bo 12px: 3 avatar chồng nhau (của các tác giả kế tiếp trong cửa sổ 50 bài)
  · "+N nhật ký từ M người trong tuần này" · "Xem tất cả →" bên phải; toàn dải là một `<a>`. Tính N, M từ cửa sổ 50 bài đã tải
  (không gọi thêm API); nếu không tính đúng "trong tuần" được thì dùng chữ "Xem thêm N nhật ký khác" — không bịa số.

### 3.3 Bài viết — kiểu thư viện, có ảnh từng bài (xuống CUỐI trang)
- Desktop: section nền `--surface` trải hết chiều ngang (ra ngoài khung hai cột, dưới cả rail). Đầu section: "Bài viết" + dòng
  "Kiến thức nền cho người giao dịch nghiêm túc — đọc một lần, dùng lâu dài." + chip chuyên mục (link `/s/*`) + "Tất cả bài viết →".
- **3 cột theo nhóm chuyên mục**, mỗi cột: tiêu đề nhóm (gạch dưới 2px `--ink`) + "Xem thêm →" (tới `/s/<sub chính>`),
  rồi 3 bài đánh số 01–03: số · tiêu đề (heading, clamp 3 dòng) · trích 2 dòng · nhãn (Hỏi đáp / Đọc sách / `s/sub`) · ngày · **thumbnail 104×72 bên phải**.
  Nhóm (hằng số cấu hình, đặt cạnh component, dễ đổi): *Cơ chế thị trường* = `hoi-dap`, `chung-khoan`; *Vĩ mô & doanh nghiệp* = `vi-mo`, `crypto`;
  *Quản trị vốn & tâm lý* = `quan-tri-von`, `tam-ly-giao-dich`. `tin-tuc` không vào cột (xem dải bản tin). User có thể đổi nhóm — hỏi nếu thấy bất hợp lý với dữ liệu thật.
  Lấy dữ liệu: một lời gọi `docFeed("moi", { limit: 50, loai_mach: "bai_viet" })` rồi chia nhóm ở web (không thêm API); nhóm thiếu bài thì vẽ số bài có, nhóm rỗng thì ẩn cột.
- **Dải "Bản tin thị trường"** dưới 3 cột: 2–3 bài mới nhất của `s/tin-tuc` dạng chữ một dòng (ngày · tiêu đề) + "Tất cả bản tin →".
- Mobile: chip chuyên mục cuộn ngang; 3 nhóm nối nhau, mỗi nhóm 2 bài dạng hàng (số · tiêu đề · nhãn · ngày · thumb 88×66 bên phải); dải bản tin; nút "Xem thêm bài viết".
- Ảnh: dùng ảnh minh hoạ / xem trước sẵn có của bài (`plans/2026-08-28-anh-minh-hoa-bai-viet.md`, `2026-11-10-bai-viet-xem-truoc-anh.md`), `next/image` hoặc `<img>` có `width/height` để không CLS; bài không có ảnh ⇒ ô `--surface-2`.
- Đếm link `/m/`: nhật ký ≤ 8 + chủ đề 1 + bài viết 9 + bản tin 2–3 ⇒ đo thực tế, phải ≥ 19; thiếu thì tăng số bài mỗi nhóm (4) trước khi hỏi.

### 3.4 Rail phải
"Bắt đầu nhật ký của bạn" (khách: Google / email; đã đăng nhập: ẩn) → **Chuyên mục** (8 link) → Luật rút gọn → link "Chủ đề thảo luận →" `/chu-de`. Bỏ khối "Bài viết mới" ở rail (đã có section riêng).

### 3.5 Bỏ khỏi mockup (không làm)
Dải chỉ số "CHỐT PHIÊN" dưới header (chưa có nguồn dữ liệu), hai nút chọn phe (3.1), số liệu `[n]` không có nguồn.

## 4. Việc cần làm (gợi ý thứ tự)
1. Đọc mockup + `components/trang-chu-v2.tsx`, `khoi-thao-luan`, `khoi-bai-viet`, `TheMach`, `sidebar.tsx`; kiểm schema mạch (trường lệnh có cấu trúc? ảnh? cờ bot? điểm bình luận?) — ghi kết luận.
2. Khối chủ đề tiêu điểm (3.1) + dời thứ tự, h1/lede thành dòng gọn.
3. Thẻ nhật ký mới + ô soạn nhanh + dải chân khối (3.2).
4. Section bài viết thư viện + bản tin (3.3), rail (3.4).
5. Mobile (≤ 960px) theo mockup mobile; vùng bấm ≥ 44px.
6. Test: cập nhật `trang-chu-v2.spec.ts` theo cấu trúc mới (ghi rõ bài đo nào đổi và vì sao); thêm bài đo: thứ tự khối, không còn "chủ đề trước" trên `/`, mỗi bài viết có `<time>` + ảnh/ô ảnh, đếm link `/m/` ≥ 19, chip nhóm đúng sub; thử phá ít nhất 2 bài đo mới.

## 5. Tiêu chí nghiệm thu
| # | Tiêu chí |
|---|---|
| G1 | Thứ tự trên `/`: dòng giới thiệu → Chủ đề tuần → Nhật ký mới → Bài viết; không còn danh sách chủ đề trước trên `/`. |
| G2 | Khối chủ đề: 1 chủ đề (xuất bản sau cùng, giữ luật vòng sửa 4), chip tuần + số ngày còn lại đúng giờ VN; quan điểm nổi bật ẩn khi không có bình luận. |
| G3 | Thẻ nhật ký: trích ≤ 3 dòng, ảnh nhỏ thay biểu đồ to; dải lệnh chỉ hiện khi có dữ liệu có cấu trúc; mỗi tác giả một thẻ (U1–U6 plan 2026-11-11 vẫn xanh). |
| G4 | Bài viết: 3 nhóm theo hằng cấu hình, mỗi bài có thumbnail (hoặc ô thay thế) + `<time>`; dải bản tin; section nằm cuối trang. |
| G5 | SEO: `seo-trang-chu.spec.ts` xanh không sửa; link `/m/` ≥ 19; HTML giống nhau cho UA trình duyệt và Googlebot. |
| G6 | Màu: 0 hex mới, `mau-token.spec.ts` xanh không sửa; dark mode đọc được (chụp 2 theme). |
| G7 | Mobile 390px không tràn ngang; khối chủ đề là màn hình đầu; vùng bấm ≥ 44px. |
| G | `pnpm lint`, `tsc`, `pnpm build`, `pnpm e2e:don-vi`, e2e đầy đủ `CI=1` + `gikky_e2e` (đỏ ⊆ đỏ nền), vân tay `gikky_dev` không đổi. |

## 6. Phụ lục 2026-11-11 — thay đổi DB/API (user chốt: "cần thêm gì, sửa db thế nào thì tự quyết")

Kết quả kiểm schema (bước 1): API **chưa có** lệnh có cấu trúc (`Moc.figures` là cặp label/value tự do, bài viết
cũng dùng — KHÔNG parse), **chưa có** cờ bot (`la_tai_khoan_doi` là tài khoản đội, không phải bot), feed **chưa lọc**
được mạch đã đóng. Ảnh (`xem_truoc.anh`) và điểm bình luận (`BinhLuanOut.score`) đã có. Phiên chính chốt thêm 3 thứ
dưới đây; mục "không đổi API" ở đầu plan được nới đúng bằng ba thứ này, không hơn.

### 6.1 Lệnh có cấu trúc trên `Mach` (một migration `0046`, kiểm số migration trước — có phiên khác chung checkout)
- Cột mới trên `Mach`, đều nullable: `lenh_chieu` (`mua`|`ban`, TextChoices), `lenh_ma` (Char 20, lưu IN HOA),
  `lenh_gia_vao`, `lenh_sl`, `lenh_tp`, `lenh_nhoi` (Decimal `max_digits=20, decimal_places=8`).
- `CheckConstraint`: ba cột `chieu`/`ma`/`gia_vao` **cùng null hoặc cùng có**; `sl/tp/nhoi` chỉ có khi ba cột kia có.
- **Bất biến sau khi tạo** (biên lai — lệnh đã đặt thì không sửa lại; thay đổi kể qua mốc). Không endpoint sửa.
- Vào: `MachMoiIn.lenh: LenhIn | None = None`. `LenhIn`: `chieu`, `ma` (1–20, `[A-Za-z0-9._/-]`, server upper),
  `gia_vao` > 0 bắt buộc; `sl`, `tp`, `nhoi` tuỳ chọn > 0. Kiểm thứ tự khi có: MUA ⇒ `sl < gia_vao < tp`;
  BÁN ⇒ `tp < gia_vao < sl`. Sai ⇒ 400 `du_lieu_khong_hop_le` (theo đường lỗi sẵn có), kiểm ở `core/ghi.py` (một chỗ
  cho mọi cửa), không chỉ ở schema. Chỉ nhận khi `loai_mach` phân giải ra `nhat_ky`; loại khác gửi `lenh` ⇒ 400.
- Ra: `lenh: LenhOut | None = None` trên **`MachTomTatOut` và `MachChiTietOut`**. `LenhOut`: `chieu`, `ma`, `gia_vao`,
  `sl`, `tp`, `nhoi` là **chuỗi** Decimal đã bỏ số 0 thừa (`str(d.normalize())`, không ra dạng `1E+1` — xử lý số mũ),
  `rr: str | None` = `|tp − vào| / |vào − sl|` làm tròn 1 chữ số, chỉ khi có cả sl lẫn tp. Bia mộ/ẩn mốc 1 không ảnh
  hưởng `lenh` (thuộc tính của mạch như `title`).
- Form `apps/web/components/form-dang-mach.tsx`: khối "Lệnh (tuỳ chọn)" gấp mặc định — chiều MUA/BÁN, mã, giá vào,
  SL, TP, nhồi; chỉ hiện khi loại là nhật ký. Không đụng `apps/admin/components/form-dang-bai.tsx` (bài viết đội).
- Bot: `scripts/bot-trader/dang_bai_bot_trader.py` gửi `lenh` nếu payload có khoá `lenh`; nơi dựng payload
  (`soan_va_dang.py`/`scanner.py`, xem chỗ sinh `title` "Mua X tại …: Entry …, SL …, TP …, Nhồi …") thêm khoá `lenh`
  từ chính các số nó đã có (`symbol`, `entry_price`, `stop_loss`, `take_profit`, `pyramid_trigger`). **Không backfill**
  mạch cũ, không parse tiêu đề.
- Trang mạch `/m/…`: chưa bắt buộc hiển thị (ngoài phạm vi homepage); chỉ thẻ nhật ký trang chủ dùng.

### 6.2 Cờ bot `User.la_bot`
- `BooleanField(default=False)`, chỉ bật bằng migration (data step trong `0046`: `username='bot-trader'` nếu tồn tại)
  — **không endpoint nào đặt nó**, cùng khuôn `la_tai_khoan_doi`. Ra: `NguoiDungTomTatOut.la_bot: bool = False`
  (`api/trinh_bay.py::nguoi_dung_ra`, không thêm truy vấn). Thẻ nhật ký vẽ nhãn "BOT · DEMO" theo cờ này, **không**
  so username ở web.

### 6.3 Lọc trạng thái trên `/feeds/moi`
- Tham số `trang_thai: Literal["open","closed"] | None = None` cho `liet_ke_feed_moi` (giá trị = `TrangThaiMach`).
  Nếu feed có cache/khoá cache thì tham số phải vào khoá. Tab trên khối nhật ký: Mới nhất (`/feeds/moi`), Đang mở
  (`trang_thai=open`), Đã đóng sổ (`trang_thai=closed`) — cả ba là link thật tới trang feed có lọc tương ứng
  (thêm `?trang_thai=` vào trang `/` tab `moi` nếu trang đó chưa nhận; giữ nguyên lọc mỗi tác giả một bài chỉ ở khối trang chủ).

### 6.4 Quan điểm nổi bật
- Thêm một lời gọi `lietKeBinhLuanMach({ baseUrl, path:{mach_id}, query:{ sort:"hay_nhat", limit: 50 } })` vào
  `Promise.all`; web lấy bình luận **gốc** (`depth===1`), `trang_thai==="binh_thuong"`, sắp `score` giảm dần, lấy 3
  (mobile hiện 1). Không đổi API.

### 6.5 Test bắt buộc thêm
- pytest: migration/constraint; tạo mạch có lệnh (MUA/BÁN đúng thứ tự, sai thứ tự 400, thiếu `gia_vao` 400,
  `lenh` trên `bai_viet`/`thao_luan` 400); `rr` & chuẩn hoá chuỗi (gồm `10`, `0.00012`, `33.20`); `la_bot` ra feed,
  không đặt được qua API hồ sơ; `trang_thai` lọc đúng + giá trị lạ 422/400.
- `seed_e2e`: thêm ≥1 nhật ký có lệnh và 1 user `la_bot` để e2e trang chủ đo được dải lệnh + nhãn BOT.
- Nền hiện tại: **2558** test pytest (`--collect-only`). `pnpm codegen` + `codegen:check` xanh; `test_hop_dong_openapi` cập nhật có ghi lý do.
