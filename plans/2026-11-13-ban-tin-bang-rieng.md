# Bản tin thành bảng dữ liệu riêng + trình bày kiểu bản tin (việc 20)

> **Trạng thái:** ĐÃ LẬP PLAN 2026-11-13, **USER DUYỆT 2026-11-13** ("Duyệt cả hai", kèm phác thảo trình bày), chưa chạy. Nhánh `v2`. Sổ việc: `GHI-CHU.md` việc 20.
>
> **Điều kiện bắt đầu:** việc 19 (`plans/2026-11-13-ban-tin-len-dau-ban-quyen.md`) đã nghiệm thu và COMMIT. User chọn
> 2026-11-13: "Chờ việc 19 commit". Lúc giao thợ, phiên chính đo lại nền (`pytest --collect-only`, `pnpm e2e:don-vi`)
> và ghi số vào đây; thợ thấy số khác thì DỪNG và báo.
>
> **Nền đo 2026-11-13 (sau việc 19):** HEAD `8da9d22`; `pytest --collect-only` = **2716**; `pnpm e2e:don-vi` = **769 xanh**.

## 1. Yêu cầu

User, 2026-11-13:

1. "tách phần bản tin ra 1 phần riêng, không dùng chung dữ liệu với bài viết hay nhật kí nữa"
2. "hiện tại bản tin đang gộp lại theo dạng nhật kí, cần cách trình bày mới của bản tin, không theo dạng nhật kí nữa"

Đã chốt với user (2026-11-13, qua câu hỏi):

| Câu hỏi | User chọn |
|---|---|
| Mức tách | **Bảng dữ liệu riêng**: bản tin không còn là `Mach` |
| Trang danh sách | **Giữ `/s/tin-tuc`** |
| Tương tác | **Không, chỉ đọc**: không bình luận, không vote, không câu hỏi cho đám đông; vẫn đếm lượt xem |
| URL một bản tin | **`/s/tin-tuc/2026-11-13`** (theo ngày, giờ VN) |
| 57 mạch cũ trên prod | **Lưu trữ + 301**: giữ hàng cũ ở trạng thái lưu trữ, URL `/m/…` cũ trả 301 sang URL mới |

## 2. Hiện trạng đã đo

- Bản tin = `Mach` trong sub `tin-tuc`, tác giả `gikky-team-news`, `loai_mach = bai_viet` (mặc định của tài khoản
  đội). **Một mạch mỗi ngày, tối đa ba mốc**, mỗi mốc là một khung giờ (`scripts/tin-tuc/README.md`).
- Prod (`GET /api/v1/subs/tin-tuc`, 2026-11-13): **57 mạch**. 50 mạch mới nhất có 140 mốc, **0 bình luận**, 174 lượt
  xem; mạch cũ nhất trong 50 bài là ngày 2026-09-06. Stack dev (dev.gikky.net): 55 mạch. `gikky_dev` local: 0.
- Một mốc bản tin (`GET /machs/1498`): `loai` là chip tên khung (`"Đêm qua"`, `"Trước phiên VN"`, `"Trước phiên Mỹ"`),
  `body_dinh_dang = "html"` (có `<h3>`, `<ul>`, link nguồn `rel="nofollow ugc noopener"`), `figures` 6 cặp
  `{label, value}`, `question_for_crowd` có chữ, 0 ảnh.
- Bot: `scripts/dang-tin.mjs` + `scripts/tin-tuc/lib.mjs`, chạy bằng nhiệm vụ đặt lịch trên **máy Windows này, đọc
  script từ CÂY LÀM VIỆC NÀY**, đăng lên **prod** (đang chạy `main`). Tạo mạch `POST /machs`, nối mốc
  `POST /machs/{id}/mocs`; sổ cái ngày ở `scripts/tin-tuc/.mach-hom-nay.json`. Bài đo: `api/tests/test_bot_dang_tin.py`.
- Web dùng bản tin ở: dải bản tin trang chủ (`components/dai-ban-tin.tsx`, việc 19) đọc từ feed `bai_viet` rồi lọc theo
  `SUB_BAN_TIN` (`lib/nhom-bai-viet.ts`); `KhoiBaiViet` loại bài bản tin khỏi giá sách; `/s/[sub]` liệt kê mạch;
  `sitemap.ts` và `feed.xml` đi qua `/feeds/moi`.
- Trang mạch `/m/[slugId]` vẽ bản tin như mọi nhật ký: dòng thời gian mốc, vote, bình luận, câu hỏi cho đám đông. Đây
  là thứ user gọi là "dạng nhật kí".

## 3. Thiết kế

### 3.1 Dữ liệu (`api/core/models/ban_tin.py`, file MỚI, migration mới)

```
BanTin                                  BanTinKhung
  id                                      id
  ngay        DateField UNIQUE (giờ VN)   ban_tin     FK BanTin CASCADE, related_name="khung"
  title       CharField(160)              khung       CharField choices: dem_qua | truoc_phien_vn | truoc_phien_my
  tac_gia     FK User PROTECT             body        TextField (HTML đã lọc, cùng bộ lọc với Moc html)
  created_at  DateTimeField (server)      figures     JSONField null (cùng validator `kiem_figures` với Moc)
  cap_nhat_luc DateTimeField              created_at  DateTimeField (server, bất biến)
  view_count  PositiveIntegerField 0      UNIQUE (ban_tin, khung)
  hidden_at   DateTimeField null
  mach_cu     FK Mach SET_NULL null UNIQUE   (chỉ để 301 URL cũ; null cho bản tin mới)
```

- `ngay` là ngày VN lúc đăng khung đầu tiên, KHÔNG lấy từ tiêu đề.
- Thứ tự hiển thị khung cố định theo choices (đêm qua → trước phiên VN → trước phiên Mỹ), không theo `created_at`.
- KHÔNG có bình luận, vote, câu hỏi cho đám đông, trường phái, riêng tư, sub. `question_for_crowd` của mốc cũ KHÔNG
  chép sang (vẫn còn trong hàng `Moc` cũ đã lưu trữ).
- `hidden_at`: mod ẩn một bản tin sai qua Django admin (`/api/admin/django/`), đăng ký `BanTin` + inline `BanTinKhung`.
  Không làm giao diện ở `apps/admin`.
- `cap_nhat_luc` = `created_at` của khung mới nhất (cập nhật trong cùng transaction khi đăng khung).

### 3.2 API (`api/api/ban_tin.py`, router MỚI gắn vào `api_v1`, KHÔNG phải NinjaAPI mới)

Mọi endpoint khai `operation_id` tường minh. Sửa xong chạy `pnpm codegen`.

| Endpoint | `operation_id` | Ghi chú |
|---|---|---|
| `GET /ban-tin?cursor=&limit=` | `liet_ke_ban_tin` | Mới → cũ theo `ngay`, `limit` ≤ 50, cursor như các feed. Mỗi mục: `ngay`, `title`, `cap_nhat_luc`, `khung_da_co` (list khoá), `so_lieu` (≤ 4 cặp `figures` đầu của khung đầu tiên có figures). Bỏ `hidden_at`. |
| `GET /ban-tin/{ngay}` | `xem_ban_tin` | `ngay` dạng `YYYY-MM-DD`; sai dạng hoặc không có hoặc đã ẩn ⇒ 404. Trả `ngay`, `title`, `created_at`, `cap_nhat_luc`, `view_count`, `khung[]` (`khung`, `ten`, `created_at`, `body`, `figures`), `ngay_truoc`, `ngay_sau` (ngày của bản tin hiện được liền kề, hoặc null). |
| `GET /ban-tin/tu-mach/{mach_id}` | `tim_ban_tin_tu_mach_cu` | Trả `{ngay}` hoặc 404. Chỉ để web trả 301. |
| ~~`POST /ban-tin/{ngay}/xem`~~ | — | **Bỏ ở đợt A** (phiên chính duyệt): lượt xem đi qua `POST /dem-luot-xem` chung, nhánh mới nhận `/s/tin-tuc/<YYYY-MM-DD>` ⇒ `BanTin.view_count`. Cùng luật chống bot / chống trùng, không ghi hai hàng `LuotXem`. |
| `POST /ban-tin` | `dang_ban_tin` | Chỉ `User.la_tai_khoan_doi` (không phải `is_staff`); khác ⇒ 403. Body `{khung, title, body, figures}`. Server tự lấy ngày VN; chưa có bản tin ngày đó ⇒ tạo (dùng `title`); có rồi ⇒ thêm khung (bỏ qua `title`). Khung đã có ⇒ **409 `khung_da_dang`**. Trả 201 + `{ngay, khung, url}`. Cùng giới hạn độ dài / bộ lọc HTML với mốc. |

- Chặn đường cũ: sau việc này **không ai tạo được mạch mới trong sub `tin-tuc`**, và không ai chuyển mạch vào đó.
  `tao_mach` (và đường đổi sub nếu có) trả 400 `sub_danh_rieng_ban_tin`. Hằng `SUB_BAN_TIN = "tin-tuc"` khai MỘT chỗ
  trong `api/core`. Sub `tin-tuc` vẫn còn trong DB (mạch cũ `PROTECT` nó và URL `/s/tin-tuc` sống trên nó).
- `/feeds/*`, `/subs`, tìm kiếm không đổi code: mạch cũ đã lưu trữ tự rơi khỏi chúng. `so_mach` của `tin-tuc` về 0.

### 3.3 Chuyển dữ liệu: lệnh `chuyen_ban_tin` (management command, KHÔNG phải data migration)

Lý do không dùng data migration: chạy trên prod phải có bước xem trước và báo cáo, và bot có thể đã đăng khung mới qua
endpoint mới giữa lúc migrate và lúc chuyển.

- `python manage.py chuyen_ban_tin` = **chạy thử** (mặc định), in bảng: mạch id → ngày, các khung, ca lỗi. Chỉ ghi khi
  có `--that`.
- Nguồn: mạch trong sub `tin-tuc` chưa lưu trữ, chưa bị ẩn. Mỗi mạch → một `BanTin`:
  `ngay` = ngày VN của `created_at` mốc 1; `title`, `tac_gia`, `created_at` lấy từ mạch; `view_count` lấy từ mạch;
  `mach_cu` = mạch.
- Mỗi mốc còn sống (không `deleted_at`, không `hidden_at`) → một `BanTinKhung`, khoá suy từ `Moc.loai`:
  `"Đêm qua"` → `dem_qua`, `"Trước phiên VN"` → `truoc_phien_vn`, `"Trước phiên Mỹ"` → `truoc_phien_my` (so sánh sau
  khi bỏ khoảng trắng, không phân biệt hoa thường). `body` mốc định dạng không phải html thì chuyển qua đúng bộ dựng
  HTML web đang dùng để vẽ mốc đó; không có bộ dựng ở server thì DỪNG và báo. `created_at` giữ nguyên của mốc.
- Ca lỗi, **không ghi gì cho mạch đó** và liệt kê ra: `loai` không khớp ba tên; hai mốc cùng khung; hai mạch cùng ngày;
  mốc có ảnh. Mạch có bình luận vẫn chuyển, liệt kê số bình luận (sẽ chỉ còn trong hàng cũ).
- Ngày đó đã có `BanTin` (bot đăng qua endpoint mới): thêm khung còn thiếu, khung trùng thì giữ bản mới, liệt kê.
- Ghi xong mỗi mạch (một `atomic()` cho mỗi mạch): đặt `archived_at` cho mạch cũ. Chạy lại lệnh lần hai không tạo gì
  thêm (`mach_cu` UNIQUE + bỏ mạch đã lưu trữ).
- Thứ tự khoá: lệnh chỉ khoá `Mach` của mạch nguồn sau khi ghi `BanTin` (không khoá `Moc` / `Comment`), nên không thêm
  cạnh mới vào luật "`Mach` rồi `MocAnh` đứng cuối". Thợ kiểm và nêu trong báo cáo.

### 3.4 Bot (`scripts/dang-tin.mjs`, `scripts/tin-tuc/lib.mjs`)

⚠ Nhiệm vụ đặt lịch đọc script từ cây làm việc này và đăng lên prod đang chạy `main`. Sửa script mà bỏ đường cũ thì
**sáng mai 06:12 bot chết** trên prod.

- Script **tự nhận biết server**: trước khi đăng, gọi `GET /api/v1/ban-tin?limit=1`. 200 ⇒ đường mới `POST /ban-tin`
  với `khung` lấy từ `--slot` (`dem-qua` → `dem_qua`…). 404 ⇒ đường cũ y nguyên như hôm nay. Không có cờ tay.
- Mã thoát giữ nguyên hợp đồng (`MA` trong `lib.mjs`): 409 `khung_da_dang` ⇒ 3; 403 ⇒ 1. Đường mới không cần
  `mach_id` trong sổ cái nhưng vẫn ghi `ghiNhanDaDang` để ca "đã đăng slot này hôm nay" dừng sớm như cũ.
- Chuỗi CSRF ba bước, `Origin` đặt tay: giữ nguyên.
- JSON đầu vào của bot không đổi; `question_for_crowd` (nếu có) bị bỏ ở đường mới, không lỗi.
- `api/tests/test_bot_dang_tin.py`: thêm ca đường mới (tạo ngày, thêm khung, 409 ⇒ mã 3) và giữ các ca đường cũ.
- Không đụng `scripts/bot-trader/**`, `scripts/tin-tuc/.mach-hom-nay.json` và các file `soan_*.py` (phiên khác đang
  sửa).

### 3.5 Trình bày mới (web), KHÔNG còn dạng nhật ký

Phác thảo đã gửi user cùng plan này. Nguyên tắc: đọc như **một tờ bản tin ngày**, không có dòng thời gian, vote, bình
luận, ô "bạn nghĩ sao".

**Trang một bản tin `/s/tin-tuc/[ngay]`** (route mới `app/s/[sub]/[ngay]/page.tsx`; `sub` khác `SUB_BAN_TIN` hoặc
`ngay` sai dạng ⇒ `notFound()`):

1. Đầu trang: nhãn "Bản tin thị trường", ngày đầy đủ ("Thứ Sáu, 13/11/2026"), `<h1>` = tiêu đề, dòng nhỏ
   "Cập nhật HH:mm" (giờ VN) + lượt xem.
2. **Mục lục khung giờ** ngay dưới: ba ô ngang "Đêm qua · Trước phiên VN · Trước phiên Mỹ", ô có nội dung là link neo
   `#dem-qua`…, ô chưa có thì mờ kèm giờ dự kiến ("~19:30"). Mobile: cuộn ngang được, không xuống dòng.
3. Mỗi khung là một `<section id>` có `<h2>` tên khung + giờ đăng (`<time>`). Trong đó, **bảng số liệu** của khung
   đứng TRƯỚC (lưới thẻ: nhãn nhỏ ở trên, giá trị to; phần trong ngoặc như "(-0,35%)" tô màu tăng / giảm theo dấu), rồi
   tới thân HTML (các `<h3>` của thân hạ cỡ để không to hơn `<h2>` của khung).
4. Cuối trang: "← Bản tin DD/MM" (`ngay_truoc`) · "Tất cả bản tin" (`/s/tin-tuc`) · "Bản tin DD/MM →" (`ngay_sau`).
5. Cột phải giữ rail chung như các trang khác (khung hai cột). Không có ô soạn, nút theo dõi tác giả hay bình luận.
6. `metadata`: title = tiêu đề bản tin, canonical `/s/tin-tuc/<ngay>`, JSON-LD `NewsArticle` (`datePublished` =
   `created_at`, `dateModified` = `cap_nhat_luc`). Lượt xem: **không gọi endpoint riêng** (đổi ở đợt A, phiên chính
   duyệt 2026-11-13): `POST /dem-luot-xem` chung nay nhận đường `/s/tin-tuc/<YYYY-MM-DD>` và cộng vào
   `BanTin.view_count`. Đợt B chỉ cần thêm đường này vào `apps/web/lib/dem-luot-xem.ts::DUONG_DAN_HOP_LE`.
   Ngày hiện ở mọi chỗ (dải trang chủ, danh sách, trang bản tin) là `BanTin.ngay`, KHÔNG phải `published_at` /
   `created_at` (đóng nghi ngờ sổ `P-20261113-8` (a)).

**Trang danh sách `/s/tin-tuc`** (`app/s/[sub]/page.tsx` rẽ nhánh khi `sub === SUB_BAN_TIN`):

- Đầu trang giữ tên + mô tả sub (`xem_sub`), BỎ số mạch và nút theo dõi sub.
- Danh sách theo ngày, mới → cũ: mỗi hàng là một khối link tới `/s/tin-tuc/<ngay>` gồm cột ngày (thứ + DD/MM), tiêu đề
  (đã qua `tieuDeBanTinGon`), các chấm khung đã có, và một dòng `so_lieu` (≤ 4 cặp, cắt "…" một dòng). Phân trang bằng
  cursor `?cursor=` như các trang feed.
- `/s/tin-tuc/feed.xml` rẽ nhánh tương tự: mỗi bản tin một mục, link URL mới.

**Chỗ khác:**

- `/m/[slugId]`: khi `xem_mach` trả 404, gọi `tim_ban_tin_tu_mach_cu(id)`; có ⇒ `permanentRedirect("/s/tin-tuc/<ngay>")`
  (308/301 như các redirect slug hiện có), không có ⇒ `notFound()` như cũ. KHÔNG thêm lời gọi nào vào đường thành công.
- `sitemap.ts`: thêm mọi `/s/tin-tuc/<ngay>` (đi qua `liet_ke_ban_tin` theo cursor), `lastModified` = `cap_nhat_luc`.
  57 URL `/m/` cũ tự rơi khỏi sitemap vì mạch đã lưu trữ.
- Dải bản tin trang chủ (`DaiBanTin`): đọc từ `liet_ke_ban_tin({limit: SO_BAN_TIN_DAI})`, link `/s/tin-tuc/<ngay>`,
  `<time datetime>` = `ngay`. Giữ bốn testid của việc 19.
- `KhoiBaiViet` / `lib/nhom-bai-viet.ts`: bỏ `chonBanTin` và mọi lọc theo `SUB_BAN_TIN` trong chọn bài viết (sub đó
  không còn bài viết nào). `SUB_BAN_TIN` ở web chỉ còn dùng để rẽ nhánh route. Bài đo của các hàm bị bỏ thì bỏ theo.
- Form đăng mạch: bỏ `tin-tuc` khỏi danh sách chuyên mục chọn được.
- Màu: chỉ token có sẵn trong `app/globals.css` (tăng / giảm dùng token tăng / giảm đang có, nếu chưa có thì DỪNG và báo,
  không thêm mã màu). Hàng rào `mau-token.spec.ts` phải qua mà không nới allowlist.

## 4. Phạm vi

**LÀM:** mục 3, chia hai đợt giao thợ, đợt sau chỉ bắt đầu khi đợt trước nghiệm thu ĐẠT:

- **Đợt A:** 3.1 – 3.4 (`api/`, `pnpm codegen`, `scripts/dang-tin.mjs`, `scripts/tin-tuc/lib.mjs`).
- **Đợt B:** 3.5 (`apps/web/`).

**KHÔNG LÀM:**
- Không xoá hàng `Mach` / `Moc` cũ, không chạy `chuyen_ban_tin --that` trên DB nào ngoài `gikky_e2e` và DB test.
- Không bình luận, vote, thông báo, theo dõi cho bản tin. Không đưa bản tin vào tìm kiếm nội bộ (ghi là hệ quả, mục 7).
- Không đụng `apps/admin/`, `scripts/bot-trader/**`, các `soan_*.py`, `scripts/tin-tuc/.mach-hom-nay.json`.
- Không commit, không deploy, không sửa nhiệm vụ đặt lịch, không ghi vào `GHI-CHU.md` / `LOI-VA-NO.md`.

## 5. Bài đo

| # | Tiêu chí | Cách đo → mong đợi |
|---|---|---|
| A1 | Model + ràng buộc | pytest: hai `BanTin` cùng `ngay` ⇒ IntegrityError; hai khung trùng ⇒ IntegrityError; `figures` sai dạng ⇒ ValidationError |
| A2 | Đăng | `POST /ban-tin`: tài khoản đội ⇒ 201, tạo ngày VN đúng ở 23:30 UTC (đã sang ngày VN hôm sau); khung thứ hai thêm vào cùng ngày, `title` khung sau bị bỏ qua; khung trùng ⇒ 409 `khung_da_dang`; user thường và `is_staff` không có cờ ⇒ 403; khách ⇒ 401/403; HTML có `<script>` / `onclick` bị lọc như mốc |
| A3 | Đọc | `liet_ke_ban_tin` mới → cũ, cursor đi hết không trùng không sót, bỏ bản đã ẩn; `xem_ban_tin` khung theo đúng thứ tự choices dù đăng lệch; `ngay_truoc`/`ngay_sau` bỏ qua bản đã ẩn; ngày sai dạng ⇒ 404 |
| A4 | Chặn đường cũ | `POST /machs` vào `tin-tuc` ⇒ 400 `sub_danh_rieng_ban_tin` (cả tài khoản đội) |
| A5 | Chuyển dữ liệu | Seed 3 mạch tin-tuc (đủ 3 khung / 2 khung / có `loai` lạ) + 1 ngày đã có `BanTin`: chạy thử không ghi gì; `--that` chuyển 2, báo 1 lỗi, gộp ngày trùng; mạch đã chuyển có `archived_at`; `view_count` và `created_at` từng khung giữ nguyên; chạy lần hai = 0 thay đổi |
| A6 | 301 dữ liệu | `tim_ban_tin_tu_mach_cu(id cũ)` ⇒ ngày; id mạch thường ⇒ 404 |
| A7 | Bot | `test_bot_dang_tin.py`: server có `/ban-tin` ⇒ đi đường mới, 409 ⇒ thoát 3; server không có (404) ⇒ đi đường cũ, mọi ca cũ vẫn xanh |
| A8 | Hợp đồng | `pnpm codegen:check` sạch; `test_api_registry.py`, `test_hop_dong_openapi.py` xanh; mọi endpoint mới có `operation_id` |
| B1 | Trang bản tin | `/s/tin-tuc/<ngay seed>`: 200, `<h1>` = tiêu đề, đúng số `<section>` khung theo thứ tự, mỗi khung có lưới số liệu TRƯỚC thân; KHÔNG có phần tử bình luận / vote / câu hỏi (đo bằng testid của trang mạch: 0); `/s/tin-tuc/2026-13-45` và `/s/chung-khoan/2026-11-13` ⇒ 404 |
| B2 | Mục lục | Khung có nội dung là link `#<id>` trỏ đúng section; khung thiếu không phải link |
| B3 | Danh sách | HTML thô `/s/tin-tuc`: các hàng theo ngày giảm dần, link `/s/tin-tuc/<ngay>`; `?cursor=` ra trang sau |
| B4 | 301 | `GET /m/<slug>-<id mạch đã chuyển>` (không theo redirect) ⇒ 301/308, `location` = `/s/tin-tuc/<ngay>` |
| B5 | Sitemap / RSS | `sitemap.xml` chứa mọi `/s/tin-tuc/<ngay>` seed; `/s/tin-tuc/feed.xml` hợp lệ, link URL mới |
| B6 | Trang chủ | Dải bản tin: 2 `ban-tin-muc` trỏ `/s/tin-tuc/<ngay>` của 2 bản mới nhất từ `liet_ke_ban_tin`; khối Bài viết không đổi số bài |
| B7 | Mobile | 390 và 360: không tràn ngang ở hai trang mới; mục lục cuộn ngang trong chính nó |
| B8 | SEO | `seo-trang-chu.spec.ts` xanh, không sửa; trang bản tin có canonical + JSON-LD `NewsArticle` |
| B9 | Bộ chung | `pnpm lint` 0 warning; `pnpm build` xanh; `pnpm test` xanh; `pnpm e2e:don-vi` xanh; e2e đầy đủ trên `gikky_e2e` không thêm bài đỏ so với nền |

Seed e2e (`seed_e2e`) thêm vài `BanTin` để B1–B7 không đo rỗng; bài đo nào dựa vào mạch tin-tuc cũ trong seed thì sửa
cho đúng dữ liệu mới và nêu trong báo cáo. Mỗi bài mới phải **thử phá** (ví dụ đổi thứ tự khung, bỏ 301) và thấy đỏ.

## 6. Lệnh

Như plan việc 19 §6: `pnpm lint` · `pnpm build` · `pnpm test` · `pnpm e2e:don-vi` (lọc `-g`, KHÔNG có `--`) ·
`pnpm codegen` / `codegen:check`. Migrate và e2e đầy đủ **chỉ trên `gikky_e2e`**, đặt `DATABASE_URL` trong CÙNG một lệnh
và in `DB=gikky_e2e` trước (`gikky_dev` chứa dữ liệu thật). Không sửa `api/.env`.

## 7. Rủi ro và hệ quả đã chấp nhận

- **Đổi URL 57 trang đã index.** 301 giữ tín hiệu; sitemap đổi sang URL mới cùng lần deploy.
- **Bản tin rời khỏi tìm kiếm nội bộ, `/feed.xml` chung, trang hồ sơ `gikky-team-news`.** Chấp nhận: bản tin có trang,
  RSS và sitemap riêng.
- **Thứ tự deploy prod:** migrate → `chuyen_ban_tin` (chạy thử, đọc bảng) → `--that` → web. Từ lúc API mới lên tới lúc
  chuyển, bot đã tự đổi sang đường mới; lệnh chuyển gộp ngày trùng (3.3). Ghi các bước này vào `GHI-CHU.md` lúc deploy.
- **Script tự nhận biết server** là để bot không chết trước deploy prod; đường cũ trong script gỡ ở một việc sau, khi
  prod đã chạy API mới.

## Báo cáo thực thi

### Đợt A (2026-11-13, opus-dev, chưa commit)

Nền: HEAD `54403be` (commit tài liệu ngay sau `8da9d22`, phiên chính xác nhận hợp lệ); `pytest --collect-only` 2716;
`pnpm e2e:don-vi` 769 xanh. Migration mới: `0048_ban_tin.py` (lúc kết thúc không có `0048` nào khác).

**File mới:** `api/core/models/ban_tin.py` (model + `SUB_BAN_TIN` + `la_sub_ban_tin`), `api/core/migrations/0048_ban_tin.py`,
`api/core/ghi_ban_tin.py` (đường ghi), `api/api/ban_tin.py` (router), `api/core/management/commands/chuyen_ban_tin.py`,
`api/tests/test_ban_tin.py`, `api/tests/test_chuyen_ban_tin.py`, `api/tests/urls_server_cu.py`.
**File sửa:** `api/core/models/__init__.py`, `api/core/admin.py` (đăng ký `BanTin` + inline), `api/api/v1.py`,
`api/api/quyen.py` (3 mã lỗi), `api/api/machs.py` + `api/api/quan_tri_hen_gio.py` (chặn sub `tin-tuc`),
`api/api/dem_luot_xem.py` (lượt xem bản tin), `api/core/management/commands/seed_e2e.py`, `scripts/dang-tin.mjs`,
`scripts/tin-tuc/lib.mjs`, `api/tests/test_bot_dang_tin.py`, `api/tests/test_quyen_ghi.py`, `api/tests/test_operation_id.py`,
`api/tests/test_seed_e2e.py`, `packages/api-client/**` (sinh bằng `pnpm codegen`).

**Lệch so với plan, cần phiên chính duyệt:**

1. **Không có `POST /ban-tin/{ngay}/xem`.** Trang mạch không đếm qua cửa riêng: middleware/beacon của web gọi
   `POST /dem-luot-xem` cho MỌI trang, và Django nhận diện trang mạch theo đường dẫn. Thêm cửa thứ hai thì hoặc chép
   luật bot/khử trùng, hoặc ghi trùng hàng `LuotXem`. Đã làm: `dem_luot_xem` nhận đường `/s/tin-tuc/<YYYY-MM-DD>` và
   cộng `BanTin.view_count` qua đúng nhánh của trang mạch. **Đợt B phải thêm đường đó vào
   `apps/web/lib/dem-luot-xem.ts::DUONG_DAN_HOP_LE`** (hiện chỉ nhận `/s/<slug>` một đoạn), và §3.5 mục 6 đổi thành
   "không cần gọi gì thêm".
2. `mach_cu` là `OneToOneField` (= FK + UNIQUE; `ForeignKey(unique=True)` sinh cảnh báo hệ thống W342).
3. Mã 403 của `POST /ban-tin`: `khong_phai_tai_khoan_doi` (plan không đặt tên).
4. Lệnh chuyển: "mốc có ảnh" = có hàng `MocAnh` HOẶC thân có `<img`; gộp ngày đã có thì CỘNG `view_count` của mạch
   vào bản đang có; thêm ca lỗi "không còn mốc sống", "figures sai dạng", "ngày đã có bản tin chuyển từ mạch khác".
5. Bài đo bot (A7) để nguyên file `test_bot_dang_tin.py`; mọi bài cũ chạy trên "server cũ" dựng bằng fixture autouse
   (`/api/v1/ban-tin` 404 qua `tests/urls_server_cu.py` + tắt cổng chặn sub), bài mới xin fixture `server_moi`.
6. Seed: thêm 4 `BanTin` (đủ 3 khung lệch thứ tự / đã ẩn / thiếu khung / có `mach_cu` trỏ một mạch đã lưu trữ trong
   sub e2e — ca 301 cho B4). Seed không có mạch `tin-tuc` nào nên không có gì để giữ/bỏ.

**Thứ tự khoá:** `dang_khung_ban_tin` chỉ chạm `BanTin` (FOR UPDATE) → INSERT `BanTinKhung`. `chuyen_ban_tin` trong một
`atomic()` mỗi mạch: INSERT/UPDATE `BanTin` (FK `mach_cu` lấy FOR KEY SHARE ngầm trên `Mach`) → INSERT `BanTinKhung` →
`dat_luu_tru_mach` (FOR UPDATE `Mach`). `Moc`/`Comment`/`MocAnh` chỉ được ĐỌC (không khoá, không INSERT tham chiếu), nên
không có cạnh mới vào `Comment/Moc → Mach → MocAnh`; `Mach` vẫn khoá cuối. Không đường nào khoá `Mach` rồi mới chạm
`BanTin`.

**Kết quả:** A1–A8 xanh (lệnh: `pytest tests/test_ban_tin.py tests/test_chuyen_ban_tin.py tests/test_bot_dang_tin.py
tests/test_seed_e2e.py tests/test_quyen_ghi.py tests/test_operation_id.py tests/test_hop_dong_openapi.py
tests/test_api_registry.py`). `pytest --collect-only` 2716 → 2760. `pnpm codegen:check` khớp; `pnpm lint` 0 warning;
`pnpm build` xanh; `pnpm e2e:don-vi` 769 xanh. Mỗi nhóm bài mới đã thử phá (27 lượt phá, đều đỏ).
`pnpm test`: lượt chạy đầy đủ ra 2716 passed / 18 failed / 26 skipped (tổng 2760); sau khi vá, 2717 / **17** / 26 ( bài thứ 18 là của đợt này —
`test_rieng_tu_cau_truc` đòi `GET /ban-tin/tu-mach/{id}` có dòng trong `tests/_rieng_tu_cua.py::BANG_CUA` — đã thêm
dòng, chạy lại xanh). **17 bài đỏ có sẵn trên HEAD `54403be`**: chạy đúng 11 file đó trên một worktree sạch của HEAD ra
cùng 17 bài đỏ (so_query khán đài, cửa sổ tự sửa, `dua_ghi_500`, `han_muc` bia mộ, `trich_ghi`, `revalidate`
xoá-bình-luận, và các bảng ghim thiếu `luu-tru`/`da_luu_tru`), không do đợt này.

### Đợt A — Vòng sửa 1 (2026-11-13, sau phản biện)

1. **NẶNG — mạch riêng tư / của người thường bị chép thành bản tin công khai.** `chuyen_ban_tin.py::la_ban_tin_cua_doi`
   (dòng ~168): nguồn chỉ còn mạch `rieng_tu=False` VÀ tác giả `la_tai_khoan_doi`. Mạch khác trong sub in
   "BỎ QUA mạch <id> · tác giả <u> · rieng_tu=<…> · <lý do>", không ghi, không lưu trữ. Mọi dòng bảng (chạy thử lẫn
   thật) in thêm tác giả + `rieng_tu`. Chú thích dòng `GET /ban-tin/tu-mach/{int:mach_id}` ở `tests/_rieng_tu_cua.py`
   viết lại cho đúng thứ nó đo.
2. **VỪA — mạch người thường cùng ngày chặn bản tin đội.** `lap_ke_hoach` (dòng ~204): đếm "hai mạch cùng ngày" chỉ
   trên mạch đủ điều kiện.
3. **NHỎ — đường mới không cảnh báo thân bị lọc.** `BanTinDaDangOut.body` (thân đã lọc, `api/api/ban_tin.py` ~150, ~312);
   `dang-tin.mjs::dangDuongMoi` gọi `canhBaoBiLoc` (~578). `pnpm codegen` đã chạy.
4. **NHỎ — probe thoát 1 ngay.** `dang-tin.mjs::serverCoBanTin` (~426–478): lỗi mạng / 403 / 429 / 5xx ⇒ hỏi lại, 3 lượt,
   chờ 2s rồi 5s (`GIKKY_BOT_CHO_THU_LAI="a,b"` ghi đè, bài đo dùng `0,0`); hết lượt hoặc mã lạ khác ⇒ `MA.LOI`. Probe
   vẫn đứng TRƯỚC đăng nhập.
5. **NHỎ — đua với bot làm lệnh chết giữa chừng.** `Command.handle` bắt `DatabaseError` theo TỪNG mạch (~331), in
   "LỖI mạch <id>: …", chạy tiếp. Nhánh gộp: ngày vừa có `mach_cu` khác (dưới khoá) ⇒ ném `IntegrityError` thay vì đè
   (~254).
6. **NHỎ — cộng đôi `view_count`.** Bản tin đã có `mach_cu` = chính mạch này ⇒ `chi_luu_tru`: chỉ lưu trữ lại, không cộng,
   không thêm khung (~214, nhánh đầu `ghi_mot_mach`).
7. **NHỎ — cổng hẹn giờ không có bài đo.** `tests/test_hen_gio_phat_hanh.py::test_C14_tao_mach_hen_gio_vao_sub_ban_tin_bi_chan`
   đi qua `POST /api/admin/machs/hen-gio` thật.

Bài đo mới: 8 ở `test_chuyen_ban_tin.py`, 4 ở `test_bot_dang_tin.py` (+ `tests/urls_ban_tin_chap_chon.py`), 1 ở
`test_hen_gio_phat_hanh.py`. Thử phá 15 lượt, cả 15 đỏ. Bộ chung: `pnpm test` 2735 passed / 17 failed (đúng 17 bài đỏ sẵn của HEAD,
P-20261113-9) / 26 skipped; `pnpm codegen:check` khớp; `pnpm lint` 0 warning; `pnpm build` xanh; `pnpm e2e:don-vi` 769.

### Báo cáo thực thi — Đợt B (2026-11-13, opus-dev, chưa commit)

Nền: HEAD `8361f18`; `pnpm e2e:don-vi` 769 xanh; client có `lietKeBanTin` / `xemBanTin` / `timBanTinTuMachCu`.
`gikky_e2e` chưa có `0048` ⇒ đã `migrate core` CHỈ trên `gikky_e2e` (in `DB=gikky_e2e` trước) rồi mới chạy nền.

**File mới:** `apps/web/lib/ban-tin.ts` (hằng `SUB_BAN_TIN`, `SO_BAN_TIN_DAI`, `tieuDeBanTinGon` dời từ
`nhom-bai-viet.ts`; ngày / thứ / giờ VN, thứ tự khung, tách giá trị trong ngoặc, `subDangDuoc`, regex lượt xem),
`apps/web/app/s/[sub]/[ngay]/page.tsx` + `ban-tin.module.css` (trang một bản tin),
`apps/web/components/danh-sach-ban-tin.tsx` + `.module.css` (trang `/s/tin-tuc`), `apps/web/e2e/ban-tin.spec.ts`
(B1–B5, B7, B8), `apps/web/e2e/don-vi/ban-tin.spec.ts` (hàm thuần + hàng rào nguồn).
**File sửa:** `lib/api.ts` (`docBanTin`, `docDanhSachBanTin`, `docNgayBanTinTuMachCu`), `lib/dem-luot-xem.ts`
(`DUONG_DAN_HOP_LE` + đường bản tin), `lib/json-ld.ts` (`jsonLdBanTin` NewsArticle, `moTaBanTin`), `lib/sitemap.ts`
(vòng lật generic), `lib/nhom-bai-viet.ts` (bỏ `SUB_BAN_TIN`, `SO_BAN_TIN`, `SO_BAN_TIN_DAI`, `chonBanTin`,
`tieuDeBanTinGon`; `chonMoiDang` không lọc sub), `app/page.tsx`, `components/dai-ban-tin.tsx`,
`components/khoi-bai-viet.tsx`, `components/trang-mach.tsx` (308 trong `nap` chỉ khi `xem_mach` 404),
`app/s/[sub]/page.tsx` + `feed.xml/route.ts` (rẽ nhánh `tin-tuc`), `app/sitemap.ts`, `app/dang-mach/page.tsx` +
`components/drawer-dang-nhanh.tsx` (`subDangDuoc`). Bài đo sửa theo dữ liệu mới: `e2e/thu-vien.ts` (bỏ 3 bài
`tin-tuc` — trạng thái API không còn cho tạo), `dai-ban-tin.spec.ts` (nguồn `GET /ban-tin`; V3 tạm dựng `BanTin`),
`trang-chu-v2.spec.ts` B1, `trang-chu-giao-dien-moi.spec.ts` (dải; ngưỡng link `/m/` 19 → 17 + đếm riêng 2 link
`/s/tin-tuc/<ngày>`), `chu-de.spec.ts` K5 (tổng URL sitemap cộng số bản tin), `don-vi/bai-viet-trang-chu.spec.ts`,
`don-vi/trang-chu-giao-dien-moi.spec.ts` (bỏ bài `chonBanTin`; khoá màu thêm 2 file CSS mới),
`don-vi/dem-luot-xem.spec.ts` R5i (thay `[sub]/[ngay]` bằng `tin-tuc/2026-11-13`).
**Bài bỏ theo hàm bị bỏ:** don-vi "bản tin: chỉ bài của tin-tuc…" (`chonBanTin`), "giá sách: admin chọn tin-tuc
làm giá…" (thay bằng bài `idDaHien`), vế `chonBanTin` của "V1 — dải đầu trang vẽ 2 bản tin".

**Quyết định tự chốt:**
1. Màu tăng / giảm của phần trong ngoặc đi qua `SoLaiLo` (`components/con-so.tsx`, file được phép dùng
   `--gain`/`--loss`) — không chạm allowlist của `mau-token.spec.ts`.
2. Rail của hai trang bản tin là rail chung (giới thiệu + chủ đề tuần + chuyên mục + luật), không phải rail "Về s/…".
3. 301 thực tế là **308** (`permanentRedirect`, như redirect slug hiện có); bài đo nhận 301 hoặc 308.
4. Lượt xem in `max(1, view_count)` (cùng lý lẽ với `ChuKyLuotXem`); trang `force-dynamic` nên số tươi.
5. RSS `/s/tin-tuc/feed.xml`: `pubDate` = `cap_nhat_luc`, mô tả = các cặp số liệu (danh sách không trả thân).
6. Sitemap: bản tin `lastModified` = `cap_nhat_luc`, priority 0.7, đi qua cùng vòng lật có trần 40 trang.

**Kết quả:** `pnpm lint` 0 warning; `tsc --noEmit` sạch; `pnpm build` xanh (trong `pnpm e2e`);
`pnpm e2e:don-vi` 769 → **779** (+11 bài `don-vi/ban-tin.spec.ts`, −1 bài `chonBanTin`; hai bài đổi nội dung).
e2e đầy đủ trên `gikky_e2e`: nền 1160 passed / 22 failed / 7 skipped / 8 did not run; sau 1184 passed / 22 failed.
Danh sách đỏ sau = nền, trừ: (+) `chu-de.spec.ts` K5 (sitemap nay có bản tin — đã sửa bài, chạy lại xanh), (−)
`form-ghi.spec.ts` B3 (đỏ ở nền, xanh ở sau — dao động). Chạy lại `chu-de` + `ban-tin` + `trang-chu*`: 186 passed / 1 skipped.
B1–B8 xanh; `seo-trang-chu.spec.ts` xanh, không sửa. `pnpm test` 2735 passed / 17 failed / 26 skipped — đúng nền
(đợt B không chạm `api/`).

**Thử phá** (một bản build phá 8 chỗ cùng lúc, mỗi chỗ nhắm một bài): đảo thứ tự khung ⇒ B1 HTML + B2 đỏ; bỏ 308 ⇒
B4 đỏ; dải in ngày của `cap_nhat_luc` ⇒ bài P-20261113-8 (a) đỏ; danh sách đảo thứ tự ⇒ B3 (cả hai) đỏ; bỏ
`overflow-x: auto` mục lục ⇒ B7 390 + 360 đỏ; sitemap lệch tiền tố `/x/s/tin-tuc/…` ⇒ B5 sitemap **xanh** (bài đo so
đuôi chuỗi — đã siết so cả đường dẫn sau origin, chạy lại đỏ); RSS trỏ `/m/` ⇒ B5 RSS đỏ; JSON-LD `datePublished =
cap_nhat_luc` ⇒ B8 đỏ. Don-vi: gọi `tim_ban_tin_tu_mach_cu` trên đường thành công ⇒ bài 301 nguồn đỏ; phá
`ngayBanTinHopLe`, `khungTheoThuTu`, `tachGiaTri` ⇒ 3 bài tương ứng đỏ; nới regex lượt xem thành `/s/x/y` ⇒ bài lượt
xem đỏ. Đã khôi phục từ bản sao lưu, kiểm grep 0 dấu phá.

#### Đợt B — Vòng sửa 1 (2026-11-13, sau phản biện)

1. **VỪA — trang bản tin không có ảnh chia sẻ.** Mới `apps/web/app/s/[sub]/[ngay]/opengraph-image.tsx` (cùng cổng 404
   với trang: sub khác / ngày sai / không có / đã ẩn). Nội dung chữ `lib/og.ts::ogBanTin` (nhãn "Bản tin thị trường ·
   Thứ …, DD/MM/YYYY" từ `ngay`, tiêu đề gọn, ≤ 3 cặp số liệu của khung đầu có số liệu, cắt 56 ký tự).
   `lib/ban-tin.ts::anhOgBanTin`; `lib/json-ld.ts::jsonLdBanTin` thêm `image`. **Lệch nhỏ:** KHÔNG khai `images` bằng
   tay trong `generateMetadata` — đã đo: có file `opengraph-image` thì Next tự sinh cả `og:image` lẫn `twitter:image`
   (bản khai tay bị file ghi đè, gỡ khai tay vẫn xanh; xoá file thì mất cả hai thẻ ⇒ đỏ).
2. **VỪA — mạch tin-tuc cũ lệnh chuyển bỏ qua chui vào "Mới đăng".** `lib/nhom-bai-viet.ts::chonMoiDang` lọc lại
   `m.sub.slug !== SUB_BAN_TIN` (import từ `lib/ban-tin.ts`), chú thích là phòng thủ. Bài "không slug cứng" nhận thêm
   import tương đối; hai bài DOM (`trang-chu-v2` B1, `trang-chu-giao-dien-moi`) trả lại vế `!== "tin-tuc"`.
3. **NHỎ — lời tra 301 hỏng biến 404 thành 500.** `components/trang-mach.tsx::nap`: `try/catch` quanh
   `docNgayBanTinTuMachCu` ⇒ `console.error` rồi rơi xuống `notFound()`; `permanentRedirect`/`notFound` đứng ngoài `try`.
   Chú thích ghi rõ là ngoại lệ có chủ đích với F1.
4. **NHỎ — mô tả sub cũ.** `api/core/management/commands/seed_dev.py:182` → "Bản tin thị trường mỗi ngày: đêm qua, trước
   phiên VN, trước phiên Mỹ. Chỉ tin, không nhận định." `seed_e2e` không có mô tả cũ nào. Không chạm DB nào (DB đã
   seed vẫn giữ chữ cũ cho tới khi ai đó sửa qua admin / `tao_sub`).

**Bài đo mới:** don-vi `ban-tin.spec.ts` +2 (try/catch lời tra; `ogBanTin` + `anhOgBanTin` + route ảnh không là lượt
xem); `bai-viet-trang-chu.spec.ts` bài Mới đăng có lại mạch `tin-tuc`; web `ban-tin.spec.ts` B8 thêm `og:image` /
`twitter:image` trỏ đúng route, JSON-LD `image`, route ảnh 200 `image/png` (đầu file `\x89PNG`), và bài mới "ảnh OG: 404
như trang".

**Thử phá:** bỏ lọc `chonMoiDang` ⇒ bài Mới đăng đỏ; bỏ `try/catch` ⇒ bài lời tra đỏ; trần 4 cặp số liệu ⇒ bài
`ogBanTin` lúc đầu **xanh** (trần ký tự đã cắt trước) — thêm vế cặp ngắn, chạy lại đỏ; cổng ảnh bỏ kiểm sub ⇒ "ảnh OG: 404"
đỏ (`/s/chung-khoan/<ngày>/opengraph-image` 200); xoá file ảnh ⇒ B8 đỏ "thiếu og:image"; bỏ `image` JSON-LD ⇒ B8 đỏ.
Đã khôi phục, grep 0 dấu phá.

**Kết quả:** `pnpm lint` 0 warning; `tsc` sạch; `pnpm e2e:don-vi` 779 → **781**; `pnpm build` xanh (trong `pnpm e2e`);
`pnpm e2e ban-tin.spec.ts trang-chu-v2 trang-chu-giao-dien-moi seo-trang-chu` trên `gikky_e2e` (khớp cả
`dai-ban-tin` và hai file don-vi): 148 passed / 1 skipped / 0 failed; `pnpm test -- -k seed` 68 passed.
