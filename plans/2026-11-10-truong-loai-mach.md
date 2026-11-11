# Trường `loai_mach`: phân biệt NHẬT KÝ với BÀI VIẾT (nền cho homepage v2)

> **Trạng thái:** XONG phần backend (2026-11-10): code → nghiệm thu → phản biện → 1 vòng sửa → nghiệm thu lại ĐẠT. **Chưa commit, chưa
> migrate `gikky_dev`, chưa deploy.** Báo cáo ở cuối file. Nhánh `v2`.
> **Nguồn quyết định:** user, 2026-11-10 — "thêm trường loại, chỉ dành cho gikky đăng bài, user mặc định là nhật ký".
> Sổ: `GHI-CHU.md` việc 11. Việc tiếp theo (bố cục homepage v2) nằm ở plan riêng, **chưa lập, chờ user duyệt bố cục**.

## 1. Bối cảnh — vì sao cần

Homepage v2 phải cho người lạ thấy **nhật ký giao dịch** (thứ khác biệt của gikky), còn tin tức và bài viết
hạ xuống khối phụ (`GHI-CHU.md` việc 4). Muốn vậy phải lọc được "đây là nhật ký" khỏi "đây là bài viết".
Hôm nay **không có trường nào** làm được việc đó. Đo trên prod ngày 2026-11-10 (450 mạch công khai, đọc bằng GET
qua Caddy nội bộ):

| Tác giả | Tổng | ≥2 mốc | Đã đóng sổ | Có `truong_phai` |
|---|---|---|---|---|
| `gikky-team-member` | 374 | 14 | 0 | 11 |
| `gikky-team-news` | 53 | **51** | 0 | 0 |
| `bot-trader` | 19 | 18 | 16 | 0 |
| `muinx2022@gmail.com` | 4 | 2 | 1 | 1 |

`entry_count >= 2` chỉ đúng 21% (18/85); `truong_phai` do bài Đội ngũ chiếm; `status=closed` sạch nhưng chỉ
vì hôm nay chỉ người ghi nhật ký mới đóng sổ. ⇒ cần trường tường minh.

## 2. Quyết định đã chốt

1. **Tên trường là `loai_mach`, KHÔNG phải `loai`.** `loai` đã là chip tự do **của MỐC** (`Moc.loai`,
   `core/models/moc.py:92,199`; "vào lệnh", "nâng dừng lỗ"), và `MachMoiIn` kế thừa `MocMoiIn` nên mang sẵn `loai`.
   Đặt trùng tên là va chạm trong chính schema. Giá trị: `nhat_ky` (Nhật ký) · `bai_viet` (Bài viết).
2. **Mặc định là `nhat_ky`** cho mọi người dùng thường (user chốt). Người dùng thường **không được chọn** `bai_viet`.
3. **Chỉ tài khoản của gikky được chọn/được gán `bai_viet`.** Hai tài khoản đăng bài `gikky-team-news` và
   `gikky-team-member` có `is_staff = False` (`tao_tai_khoan_doi.py:44-45`; `is_staff` chỉ đi cùng `is_superuser`),
   nên **không dùng `is_staff` làm cổng được**. Thêm cờ `User.la_tai_khoan_doi` (BooleanField, default False).
4. **Mặc định theo tác giả, ở server:** `loai_mach` không gửi ⇒ tác giả có cờ → `bai_viet`, còn lại → `nhat_ky`.
   Lý do: các đường ống đăng tin và bài (`scripts/tin-tuc`, `scripts/bai-viet`, `dang-tin.mjs`) **không phải sửa** và
   không thể "quên" gửi trường mới rồi âm thầm đổ bài viết vào khối nhật ký của homepage.
5. Tài khoản có cờ vẫn đăng được nhật ký bằng cách gửi tường minh `loai_mach = "nhat_ky"`.
6. Người dùng thường gửi `loai_mach = "bai_viet"` ⇒ **403** (không lặng lẽ bỏ qua: một trường trong API công khai
   bị nuốt im là cái bẫy).
7. `bot-trader` **không** có cờ (nó là nhật ký). `admin` (superuser) **không** có cờ — mặc định; nếu muốn đổi thì
   user nói.
8. **Backfill** (migration dữ liệu): bật cờ cho `gikky-team-news`, `gikky-team-member`; mọi `Mach` của hai tài khoản
   đó (kể cả đang ẩn / hẹn giờ / lưu trữ) → `bai_viet`; còn lại → `nhat_ky`. Dự báo trên snapshot prod:
   427 `bai_viet` / 23 `nhat_ky` (trong 23 có 2 bài kiểu bài viết của `muinx2022` — chấp nhận, user đã chốt "user mặc
   định là nhật ký").

## 3. Phạm vi

### LÀM

- `api/core/models/dien_dan.py`: `LoaiMach(TextChoices)` ở tầng module (cùng lý do với `TrangThaiMach`, xem docstring
  của nó); `Mach.loai_mach = CharField(max_length=10, choices=LoaiMach, default=LoaiMach.NHAT_KY)`;
  `Mach.LoaiMach` alias như `Mach.TrangThai`. Nên có `CheckConstraint` ép giá trị thuộc tập hợp lệ.
- `api/core/models/nguoi_dung.py`: `User.la_tai_khoan_doi = BooleanField(default=False)` kèm comment nói rõ nó KHÁC
  `is_staff`.
- Migration `0045_…` (kiểm `ls api/core/migrations/` trước khi đánh số): 2 AddField + RunPython backfill ở mục 2.8.
  Hàm backfill đặt thành hàm thường để test gọi trực tiếp; **idempotent**; chiều ngược là no-op.
- `api/core/ghi.py::tao_mach`: tham số `loai_mach: str | None = None`, phân giải theo mục 2.4 **tại đúng một chỗ**;
  giá trị lạ → `ValidationError` (cùng quy ước với `kiem_figures`). `Mach.objects.create(..., loai_mach=…)`.
- `api/api/schemas_ghi.py::MachMoiIn`: `loai_mach: Literal["nhat_ky","bai_viet"] | None = None`.
- `api/api/machs.py::tao_mach_api`: cổng 403 ở mục 2.6 (mã lỗi mới, khai cạnh các hằng mã lỗi hiện có), rồi truyền
  `loai_mach` xuống `tao_mach`. Cập nhật docstring.
- `api/api/quan_tri_hen_gio.py` (cửa admin tạo bài hẹn giờ, gọi `tao_mach` ở dòng ~231): **không thêm input**,
  chỉ để mặc định theo tác giả (mục 2.4) có hiệu lực. Kiểm bằng test.
- `api/api/schemas.py`: `loai_mach` vào `MachTomTatOut` và `MachChiTietOut`; `api/api/trinh_bay.py` điền nó (đi cùng
  chỗ điền `truong_phai`, dòng ~125).
- `api/api/feeds.py`: tham số lọc `?loai_mach=` cho `/feeds/moi` và `/feeds/dang-dien-ra`, đi qua `_mach_hien` y như
  `truong_phai` (dòng 84-96, 262-305). Giá trị ngoài tập hợp lệ ⇒ 422.
- `api/core/management/commands/tao_tai_khoan_doi.py`: bật `la_tai_khoan_doi` cho hai tài khoản đăng bài (idempotent),
  để máy dev dựng từ clone sạch cũng đúng.
- Test pytest (mục 5).
- `pnpm codegen` để sinh lại `packages/api-client/src` (không sửa tay).

### KHÔNG LÀM

- **Mọi giao diện**: không sửa `apps/web`, `apps/admin`, `apps/mobile`, không thêm ô chọn loại ở form nào. Người dùng
  thường không có lựa chọn này nên form không đổi — nhờ vậy **không đụng** plan `2026-11-09-form-dang-mach-hai-nut.md`.
- **Homepage v2** (bố cục, copy, khối nhật ký / khối tin & bài) — plan riêng sau khi user duyệt bố cục.
- Endpoint đổi `loai_mach` sau khi đăng (PATCH). Sửa nhãn sai thì làm tay qua ORM; chưa có nhu cầu.
- Sửa `scripts/` (đường ống tin, bài, Bot Trader) — mục 2.4 chính là để khỏi phải sửa.
- Chỉ mục tìm kiếm (Meilisearch) / `reindex_tim_kiem`.
- **Chạy `migrate` trên `gikky_dev`.** DB đó chứa bài thật của user. Thử migration trên `gikky_e2e` (xem mục 5).
- Commit, push, deploy. Deploy sau này phải `pg_dump` trước (`deploy/prod/README.md` Luật 4) vì migration đổi schema.
- Động vào logic riêng tư / `nap_mach` đang sửa dở trong cây làm việc (mục 4).

## 4. Cây làm việc đang bẩn — đọc trước khi sửa

Cây làm việc nhánh `v2` có **39 mục chưa commit** của lượt "vá rò mạch riêng tư" + "đổi username" + file bot
(user xác nhận chúng thuộc `v2`). Trong đó có đúng các file plan này sắp đụng: `api/api/machs.py`,
`api/api/schemas.py`? (kiểm), `api/core/ghi.py`, `api/api/feeds.py`? (kiểm). Quy tắc:

1. Việc đầu tiên: `git status --short` và `git diff --stat`, **lưu lại** làm mốc. Sau đó chỉ THÊM, không sửa, không
   format lại, không hoàn tác dòng nào của lượt khác.
2. **Đo nền TRƯỚC khi sửa**: `pnpm test` trên cây hiện tại, ghi số test, số pass, và **danh sách test đỏ có sẵn**.
   (GHI-CHU ghi lượt vá rò từng có "tập test đỏ trùng khít HEAD sạch" — tức nền có đỏ sẵn.) Chặng nghiệm thu so với
   đúng danh sách này, không so với "xanh hết".
3. Nền hiện biết: migration mới nhất là `0044`. Nếu lúc làm thấy đã có `0045`, đánh số tiếp và **báo**.

## 5. Tiêu chí nghiệm thu (đo được)

Chạy ở gốc repo trừ khi ghi khác.

| # | Kiểm | Kết quả mong đợi |
|---|---|---|
| 1 | `pnpm test` | Số test = nền + test mới; tập đỏ **trùng** tập đỏ nền; 0 warning mới (`filterwarnings=error`) |
| 2 | POST `/machs` bởi người dùng thường, không gửi `loai_mach` | 201, `loai_mach == "nhat_ky"` |
| 3 | POST `/machs` bởi người dùng thường, `"bai_viet"` | 403 (mã lỗi mới), **không có `Mach` nào được tạo** |
| 4 | POST `/machs` bởi người dùng thường, `"linh_tinh"` | 422 |
| 5 | POST `/machs` bởi tài khoản có cờ, không gửi | 201, `"bai_viet"` |
| 6 | POST `/machs` bởi tài khoản có cờ, `"nhat_ky"` | 201, `"nhat_ky"` |
| 7 | Cửa admin tạo bài hẹn giờ, tác giả có cờ / không cờ | `bai_viet` / `nhat_ky` |
| 8 | GET `/feeds/moi?loai_mach=nhat_ky` rồi `=bai_viet` rồi không tham số | Hai tập **rời nhau**, hợp của chúng = tập không lọc (cùng dữ liệu); `=linh_tinh` → 422 |
| 9 | Cả `/feeds/dang-dien-ra` | Như dòng 8 |
| 10 | `MachTomTatOut` và `MachChiTietOut` | Có `loai_mach` ở cả feed lẫn chi tiết |
| 11 | Test migration: dựng 4 tác giả (2 đội ngũ, `bot-trader`, người thường) + mạch ẩn / hẹn giờ / lưu trữ, gọi hàm backfill | Mạch của 2 tài khoản đội ngũ → `bai_viet` (kể cả ẩn, lưu trữ); còn lại `nhat_ky`; chạy lần hai không đổi gì |
| 12 | Migration trên DB nháp: `DATABASE_URL` trỏ `gikky_e2e` **trong cùng một lệnh** (xem cách ở `memory/gikky-dev-chua-du-lieu-that.md`; in `DB=gikky_e2e` rồi mới chạy), `pnpm api:migrate` | Áp được `0045`; `node scripts/py.mjs makemigrations --check --dry-run` sạch |
| 13 | `pnpm codegen` rồi `pnpm codegen:check` | Xanh; `packages/api-client/src` có `loai_mach`; `git diff` cả thư mục đó chỉ là thêm trường này |
| 14 | `pnpm lint` | 0 warning |
| 15 | `pnpm build` | Xanh (bắt vỡ type ở web / admin sau khi client đổi). ⚠ phá `next dev` đang chạy — kiểm trước |
| 16 | `pnpm e2e:don-vi` (đúng lệnh này) | Số bài pass bằng nền |
| 17 | `git status --short` | Không có file nào dưới `scripts/` và `apps/` đổi ngoài `packages/api-client/src`; **không** có lượt `migrate` nào lên `gikky_dev` |

**Cấm:** `pnpm e2e` trần; `pnpm e2e --project=...`; bất kỳ lệnh nào ghi vào `gikky_dev`.

## 6. Rủi ro

- **Backfill sai nhãn.** Chọn theo tên tài khoản. Nếu prod đổi `username` của hai tài khoản đội ngũ trước khi migrate
  thì backfill trượt im lặng — nên migration phải **báo** (in / log) số hàng đã cập nhật, và test khẳng định số đó.
- **Một cờ mới trên `User`** là bề mặt đặc quyền: ai bật được nó thì đăng được `bai_viet`. Chỉ bật bằng migration /
  `tao_tai_khoan_doi`; không có endpoint nào đặt nó.
- **Khoá hàng:** không thêm đường khoá mới. `tao_mach` chỉ thêm một cột ở lệnh `INSERT` đang có.
- **Đọc thiếu:** nếu còn chỗ dựng `Mach` ngoài `tao_mach` (đã grep: chỉ có `core/ghi.py:393`) thì nó nhận mặc định DB
  `nhat_ky`. Dev grep lại một lần nữa trước khi báo xong.
- **Deploy:** migration đổi schema + backfill dữ liệu ⇒ khi deploy phải theo `deploy/prod/README.md` (dump trước,
  `api` lên trước `web`). Ngoài phạm vi lượt này.

## 7. BỔ SUNG 2026-11-10 (sau khi `opus-dev` đã bắt đầu): giá trị thứ ba `thao_luan`

> Ghi riêng để giữ dấu vết, không viết đè các mục trên. Mục này **thắng** nếu mâu thuẫn với mục 2, 3, 5.

**Nguồn:** user, 2026-11-10 — homepage v2 có phần "chủ đề": vài chủ đề kiểu "VN-Index tuần này thế nào", "bạn đang
giao dịch hay đánh bạc", "giá dầu, vàng bạc bị ảnh hưởng bởi cái gì". User chưa quyết nó thuộc loại riêng hay gộp vào
loại cũ; **phiên chính chọn loại riêng** (đổi ý sau này chỉ là đổi nhãn của vài mạch, vì chỉ có "vài" chủ đề).

**Vì sao riêng:** (a) homepage cần một bộ chọn ổn định "các chủ đề" — gộp vào `bai_viet` thì phải tìm thêm một
cột phụ (ghim, hoặc lấy theo chuyên mục `hoi-dap` — chuyên mục đó lại là đường ống bài giải thích, và
`scripts/bai-viet/lich/hoi-dap.md:12` cấm biến nó thành hỏi đáp kiểu diễn đàn); (b) chủ đề thảo luận khác bản chất:
nội dung là khán đài bình luận, không phải bài tác giả viết; (c) gộp vào `nhat_ky` thì làm bẩn đúng khối ta đang
dựng lên. Mỗi chủ đề là một trang `/m/` nên vẫn vào sitemap (sitemap lấy feed không lọc).

### Thay đổi so với các mục trên

1. **Giá trị:** `LoaiMach` có BA giá trị: `nhat_ky` · `bai_viet` · `thao_luan` (nhãn "Chủ đề thảo luận"). Giá trị
   `thao_luan` **không bao giờ là mặc định** của ai: mục 2.4 giữ nguyên (không gửi ⇒ tài khoản có cờ → `bai_viet`,
   còn lại → `nhat_ky`). `CheckConstraint`, `Literal` ở schema vào/ra và tham số lọc `?loai_mach=` đều nhận cả ba.
2. **Cổng quyền (2.6) áp cho CẢ `bai_viet` lẫn `thao_luan`:** người thường gửi một trong hai ⇒ 403, không tạo mạch.
   Tài khoản có cờ gửi giá trị nào cũng được.
3. **Backfill:** không đổi (không có mạch nào hiện là `thao_luan`).
4. **Cửa admin tạo bài (`api/api/quan_tri_hen_gio.py`, `MachHenGioMoiIn`):** thêm trường tuỳ chọn
   `loai_mach` (3 giá trị, có thể bỏ). Bỏ ⇒ phân giải theo tác giả như 2.4. Endpoint này chỉ staff gọi được nên
   **không** áp cổng "người thường". Đây là lối để user tạo chủ đề mà không cần sửa form web của người dùng thường.
5. **`GET /me` (`api/api/toi.py`, chỗ đang trả `la_staff`):** trả thêm `la_tai_khoan_doi: bool`, để lượt UI sau
   này biết có hiện ô chọn loại cho người đăng hay không. Chỉ thêm trường, không đổi gì khác.
6. **Quy tắc nội dung (không phải code, nhưng ràng buộc người vận hành):** luật cứng của `GHI-CHU.md` vẫn áp. Chủ đề
   thảo luận do **user hoặc tài khoản gikky đăng có chủ đích**, không do bot hay đường ống AI tự đăng hàng loạt. Việc
   AI tự đăng chủ đề là vùng mờ "bài dạng câu view/like" (GHI-CHU việc 3, việc 8) — chưa được duyệt.

### Tiêu chí bổ sung (thêm vào bảng mục 5, đánh số tiếp)

| # | Kiểm | Kết quả mong đợi |
|---|---|---|
| 18 | POST `/machs` bởi người thường, `loai_mach="thao_luan"` | 403 cùng mã với dòng 3; **không có `Mach` nào được tạo** |
| 19 | POST `/machs` bởi tài khoản có cờ, `loai_mach="thao_luan"` | 201, `loai_mach == "thao_luan"` |
| 20 | Tài khoản có cờ không gửi `loai_mach` | Vẫn `bai_viet` (không bao giờ tự thành `thao_luan`) |
| 21 | GET `/feeds/moi?loai_mach=thao_luan` | Chỉ mạch `thao_luan`; ba tập (`nhat_ky`, `bai_viet`, `thao_luan`) rời nhau và hợp của chúng = tập không lọc |
| 22 | Cửa admin tạo bài, có / không gửi `loai_mach` | Lưu đúng giá trị gửi / phân giải theo tác giả; giá trị lạ → 422 |
| 23 | `GET /me` | Có `la_tai_khoan_doi` (true với hai tài khoản đội ngũ, false với người thường) |
| 24 | `CheckConstraint` | Ghi trực tiếp `loai_mach="khac"` bằng ORM → `IntegrityError` |

### Ràng buộc SEO của lượt này (từ `GHI-CHU.md` việc 11, mục "Ràng buộc SEO")

`GET /feeds/moi` **không tham số** phải trả đúng tập như trước lượt này (`app/sitemap.ts` dựa vào nó để liệt kê mọi
mạch). Thêm tham số lọc là được; đổi mặc định là không. Dòng 8 của bảng mục 5 đã đo điều này — nghiệm thu phải chấm
riêng nó, không gộp.

## 8. BỔ SUNG 2026-11-10 (lần hai): ai tạo / đóng chủ đề `thao_luan`

> Thắng mục 7 và mục 2.6 nếu mâu thuẫn.

**Nguồn:** user, 2026-11-10 — "chủ đề nên do gikky tạo ra, mod cũng tạo được. Nó không phải bài viết, cũng không phải
nhật ký: nó là nơi mọi người cùng quan tâm tới một vấn đề trong tuần; khi chủ đề đóng thì truy cập lại ở đâu".

1. **Cổng quyền tách theo giá trị:**
   - `bai_viet` — CHỈ tài khoản có cờ `la_tai_khoan_doi` (đúng như mục 2.3 / 2.6).
   - `thao_luan` — tài khoản có cờ `la_tai_khoan_doi` **hoặc** `is_staff` (mod). Người thường ⇒ 403.
   - `nhat_ky` — ai cũng được.
   "Mod" ở đây là `is_staff` (các cửa `/api/v1/mod/*` và khu quản trị đều kiểm `is_staff`, xem `api/api/toi.py`
   dòng ~185); **không** gồm người chỉ có bản ghi `ModSub` (mod một chuyên mục) mà không `is_staff` — chưa được yêu cầu.
   Viết cổng thành MỘT hàm nhỏ (vd `duoc_chon_loai_mach(user, loai) -> bool`) để cửa `POST /machs` và cửa admin dùng chung.
2. **Đóng / mở lại chủ đề:** `POST /machs/{id}/close` (`dong_so_mach`, `api/api/machs.py:903`) và endpoint mở lại hiện chỉ
   tác giả (`doi_chu_so_huu`). Với mạch `loai_mach == "thao_luan"` thì **tác giả hoặc `is_staff` hoặc tài khoản có cờ** đều
   đóng / mở lại được (chủ đề là của gikky chung, không của riêng người bấm tạo). Mạch loại khác: **không đổi** (vẫn chỉ
   tác giả). Không thêm endpoint mới.
3. **Đóng chủ đề dùng lại cơ chế "đóng sổ" sẵn có**: `status = closed`, `ket_qua` (≤40 ký tự, vd "132 bình luận")
   và `bai_hoc` (dùng làm "tổng kết tuần", tuỳ chọn). Hạn mở lại 7 ngày sau `closed_at` giữ nguyên. **Không** thêm trường,
   **không** tự khoá bình luận khi đóng — bình luận sau khi đóng giữ hành vi hiện có (đóng sổ vẫn bình luận được; muốn
   chặn thì `tat_binh_luan` như mọi mạch). Đây là điểm mở, xem `GHI-CHU.md` việc 11.
4. Chủ đề **giữ chuyên mục (sub) tự nhiên** của nó (vi-mo, chung-khoan, tam-ly-giao-dich…); không tạo sub mới.

### Tiêu chí bổ sung (đánh số tiếp)

| # | Kiểm | Kết quả mong đợi |
|---|---|---|
| 25 | POST `/machs`, `thao_luan`, bởi `is_staff` không có cờ | 201 |
| 26 | POST `/machs`, `bai_viet`, bởi `is_staff` không có cờ | **403** (mod không tự đăng `bai_viet`); không tạo mạch |
| 27 | Cửa admin tạo bài, `thao_luan`, bởi staff với tác giả là mod / là tài khoản đội ngũ | Lưu đúng |
| 28 | Đóng sổ chủ đề do người khác tạo, bởi `is_staff`; bởi tài khoản có cờ; bởi người thường | 200 / 200 / 403 |
| 29 | Mở lại chủ đề đã đóng (trong 7 ngày), bởi `is_staff` | 200; quá 7 ngày ⇒ đúng mã lỗi hiện có |
| 30 | Đóng sổ **nhật ký / bài viết** của người khác, bởi `is_staff` | **403 như cũ** (luật tác giả-only không đổi cho loại khác) |

## 9. VÒNG SỬA sau nghiệm thu + phản biện (2026-11-10)

> Thắng mục 8.2 và 8.3 nếu mâu thuẫn. Nghiệm thu: 29/30 ĐẠT, #1 một phần (không đo được nền vì cây bẩn). Phản biện: không có lỗi NẶNG,
> hai lỗi VỪA đã tái hiện, vài điểm nhỏ.

**Đọc lại chữ:** mọi chỗ ghi "422" ở mục 2.6 và tiêu chí 4, 8, 9, 22 là **400** `tham_so_khong_hop_le` (repo đổi lỗi validate của
Ninja sang 400 ở `api/api/loi.py`). Code đã đúng; chữ trong plan sai.

### Sửa (5 việc, không việc nào đổi schema OpenAPI)

1. **Mod đóng / mở lại chủ đề của người khác phải để lại `AuditLog`** *(phản biện #1, ĐÃ TÁI HIỆN: 0 dòng audit)*. Khi người bấm
   `close` / `reopen` một mạch `thao_luan` KHÁC tác giả, ghi một dòng `AuditLog` trong CÙNG transaction với `dong_so` / `mo_lai`,
   theo họ hằng `AUDIT_*` đã có (`core/ghi.py` ~1679) — thêm hai hằng mới cho hai hành động. `meta` gồm người bấm, `ket_qua` /
   `bai_hoc` trước khi đổi. Người bấm CHÍNH là tác giả thì không ghi (không đổi hành vi cũ). Kiểm xem có bảng nhãn / test liệt kê
   mọi hằng `AUDIT_*` (khu quản trị, test cấu trúc) thì cập nhật cho khớp. Không thêm đường khoá mới (`Mach` đã khoá sẵn).
2. **Mở lại chủ đề KHÔNG được xoá `ket_qua` / `bai_hoc`** *(phản biện #2, ĐÃ TÁI HIỆN)*. `mo_lai` (`core/ghi.py` ~1326-1340) hiện đặt
   cả hai về `NULL`; với `thao_luan`, `bai_hoc` là "tổng kết tuần", mà người mở lại có thể là mod chứ không phải người viết nó.
   Mạch `thao_luan` giữ nguyên hai trường khi mở lại; mạch loại khác **không đổi**. Trước khi làm, `grep` nơi nào hiển thị
   `ket_qua` / `bai_hoc` mà không kiểm `status == closed` (kể cả `apps/web`, `og-the.tsx`): nếu có chỗ hiện chúng cho mạch đang mở thì
   **dừng việc này, báo lại**, đừng tự sửa `apps/`. Test: đóng với `ket_qua` + `bai_hoc` → mở lại → còn nguyên; đóng lại với giá trị mới → ghi đè.
3. **Thu hẹp quyền đóng / mở lại chủ đề: tác giả HOẶC `is_staff`. BỎ nhánh "tài khoản có cờ `la_tai_khoan_doi`"** *(giả định yếu của
   plan, phản biện)*. Tài khoản `gikky-team-member` là tài khoản pipeline AI cầm được; không cần trao thêm quyền đóng chủ đề của người
   khác cho nó (người vận hành dùng `admin` / mod `is_staff`, hoặc chính tác giả đóng). Sửa `doi_nguoi_dong_so_duoc` (`api/api/quyen.py`),
   docstring, và test 28–30: tài khoản có cờ, không phải tác giả, không `is_staff` đóng / mở lại chủ đề của người khác ⇒ **403**.
4. **`thao_luan` + `rieng_tu = True` bị từ chối** *(phản biện #4, ĐÃ TÁI HIỆN: trả 201)*. Chủ đề là nơi chung, riêng tư vô nghĩa và làm chủ đề
   biến khỏi mọi feed. Đặt luật trong `core/ghi.py::tao_mach` (một chỗ, cho cả cửa công khai lẫn cửa admin), dùng cùng cơ chế lỗi mà
   giá trị `loai_mach` lạ đang dùng (400). Test + thử phá.
5. **Backfill 0045 cảnh báo cả ca 0/2 tài khoản** *(phản biện #6)*: cảnh báo khi tìm thấy ít hơn 2 trong hai username **và** bảng `Mach` đã
   có hàng (để DB trống / DB test không ồn). Cập nhật `test_loai_mach_backfill.py` (ca 0/2 có mạch ⇒ có CẢNH BÁO; ca DB trống ⇒ im lặng).

### Kết quả vòng sửa 1 — việc (2) ĐÃ BỎ, có lý do
`opus-dev` làm theo điều kiện dừng và báo: có chỗ hiện `ket_qua` / `bai_hoc` mà **không** kiểm `status == "closed"`:
`apps/web/lib/og.ts:232` (ảnh OG), `apps/web/lib/rss.ts:140` (mô tả RSS), `apps/web/components/trang-mach.tsx:119` (meta description),
`apps/web/components/xuat-case-study.tsx:46,48`, `apps/mobile/app/mach/[id].tsx:735`. Hôm nay chúng an toàn **chỉ nhờ** bất biến "mạch đang
mở ⇒ hai trường là `NULL`" do `mo_lai` giữ. Giữ tổng kết khi mở lại sẽ phá bất biến đó và in con số của một câu chuyện đã khép lên ảnh OG,
RSS, meta của một chủ đề đang mở; sửa 5 chỗ ở web và mobile thì quá phạm vi plan này. ⇒ **`mo_lai` vẫn xoá hai trường**, nhưng việc (1) đã ghi
`ket_qua_cu` / `bai_hoc_cu` vào `AuditLog.meta` nên tổng kết **không mất âm thầm** và khôi phục được. Tiêu chí 33 **thay bằng** tiêu chí 31
(audit giữ giá trị cũ). Điều này còn mở cho lượt sau nếu muốn giữ tổng kết thật: phải sửa năm chỗ hiển thị trên trước (sổ `P-20261110-2`).

### Ghi nhận, KHÔNG sửa lượt này
- *(phản biện #3)* Chủ đề đã bị mod **khoá** (`locked_at`) thì không đóng / mở lại được (`doi_mach_tuong_tac_duoc` chặn cả tác giả), và
  `tat_binh_luan` vẫn tác giả-only. Phụ thuộc câu hỏi còn mở "sau khi đóng chủ đề, có khoá bình luận không" (`GHI-CHU.md` việc 11).
- *(phản biện #5)* Cửa admin tạo bài hẹn giờ không áp `duoc_chon_loai_mach` lên tác giả — **có chủ đích** (mục 7.4): chỉ staff gọi được và
  allowlist tác giả chỉ có hai tài khoản đội. Tiêu chí 26 chỉ chứng minh cổng ở cửa **công khai** `POST /machs`.

### Tiêu chí bổ sung

| # | Kiểm | Kết quả mong đợi |
|---|---|---|
| 31 | Mod `is_staff` đóng rồi mở lại chủ đề do tài khoản đội đăng | `AuditLog` +1 dòng cho MỖI hành động, `meta` có người bấm và `ket_qua` / `bai_hoc` cũ |
| 32 | Tác giả tự đóng / mở lại chủ đề của mình | **0** dòng `AuditLog` mới (hành vi cũ) |
| 33 | Chủ đề đóng với `ket_qua="132 bl"`, `bai_hoc="Tong ket"` → mở lại | Hai trường còn nguyên; đóng lại với giá trị mới → ghi đè |
| 34 | Nhật ký / bài viết: đóng với `ket_qua` + `bai_hoc` → tác giả mở lại | Hai trường về `NULL` **như cũ** (không đổi cho loại khác) |
| 35 | Tài khoản có cờ, không `is_staff`, không phải tác giả: đóng và mở lại chủ đề người khác | 403 `khong_phai_chu` cả hai, mạch giữ nguyên trạng thái |
| 36 | `POST /machs` `thao_luan` + `rieng_tu=true` (bởi mod); cửa admin cùng tổ hợp | 400, không tạo mạch |
| 37 | Backfill: DB có mạch, 0/2 tài khoản; DB trống | Có dòng CẢNH BÁO / không in gì |
| 38 | `pnpm test` toàn bộ | Tập đỏ vẫn đúng 17 test nền (không thêm test đỏ); `pnpm codegen:check`, `pnpm lint`, `pnpm e2e:don-vi` như trước |

## Báo cáo thực thi (2026-11-10)

**Quy trình đã chạy:** `opus-dev` code → `nghiem-thu` (30 tiêu chí) → `phan-bien` → vòng sửa 1 (mục 9) → `nghiem-thu` lần hai (tiêu chí 31–38).
**Không** chạy phản biện lần hai: lượt phản biện đầu đã chạm giới hạn lượt gọi, và vòng sửa nhỏ (audit, thu hẹp quyền, một luật,
một cảnh báo) được nghiệm thu lại bằng thử phá. Đây là chỗ chưa được soi đối kháng lần hai.

**Đã làm.** Model `LoaiMach` (3 giá trị) + `Mach.loai_mach` + CHECK; `User.la_tai_khoan_doi`; migration `0045_loai_mach` (backfill theo tên
tài khoản, cảnh báo khi thiếu); phân giải mặc định theo tác giả trong `tao_mach`; cổng 403 theo giá trị (`duoc_chon_loai_mach`); lọc
`?loai_mach=` ở `/feeds/moi` và `/feeds/dang-dien-ra`; `loai_mach` ở `MachTomTatOut` / `MachChiTietOut`; `GET /me` trả `la_tai_khoan_doi`;
cửa admin tạo bài nhận `loai_mach`; đóng / mở lại chủ đề `thao_luan` cho tác giả hoặc `is_staff`, có `AuditLog` khi người khác bấm;
`thao_luan` + `rieng_tu` bị từ chối; codegen. 61 test mới trong `test_loai_mach.py` và `test_loai_mach_backfill.py`.

**Kết quả kiểm chứng (đo lại bởi nghiệm thu lần hai).** `pnpm test`: 2518 test, **17 đỏ**, 2475 pass, 26 skip. 17 đỏ đều là nợ có sẵn (lưu trữ mạch chưa
đăng ký ×5, xoá bình luận ×5, đếm truy vấn khán đài ×5, cửa sổ tự sửa ×2), đã ở sổ `P-20261109-7` và `-8`; không cái nào do việc này.
`makemigrations --check` sạch; `pnpm codegen:check` khớp; `pnpm lint` 0 warning; `pnpm e2e:don-vi` 559 pass; `pnpm build` xanh ở lần nghiệm thu đầu
(vòng sửa không đổi `apps/`). Migration `0045` áp được và lùi / tiến lại được trên `gikky_e2e`. `gikky_dev` **không bị ghi**: còn thiếu cả
`0044` lẫn `0045`. Thử phá 20+ chỗ ở ba lượt, mọi lần test đỏ đúng chỗ.

**Lệch plan, đã chấp nhận.** (1) Lỗi validate là 400 chứ không 422. (2) Việc (2) mục 9 bỏ (xem "Kết quả vòng sửa 1"). (3) Cửa admin không áp
`duoc_chon_loai_mach` (có chủ đích). (4) Tiêu chí 27 "tác giả là mod" không đo được: cửa admin chỉ cho hai tài khoản đội làm tác giả.
(5) Tiêu chí 1 chỉ đạt một phần: cây bẩn nên không đo được số test nền.

**Đã biết, chưa sửa.** Chủ đề bị mod khoá thì không đóng / mở lại được; `tat_binh_luan` vẫn tác giả-only (chờ câu hỏi "khoá bình luận khi
đóng"). `POST /machs` giờ trả 400 thay vì 500 cho thân bài rỗng sau lọc HTML / `figures` sai — đúng hướng nhưng chưa có test ở tầng endpoint và
comment `"chưa có gì để rollback"` ở `machs.py:645` chỉ đúng cho luật `thao_luan` + `rieng_tu` (sổ `P-20261110-3`). Backfill chọn theo username: kiểm
hai username trên prod trước khi deploy.

**Trước khi deploy:** `pg_dump` (Luật 4 của `deploy/prod/README.md`); `api` lên trước `web` / `admin`; kiểm `gikky-team-news` và `gikky-team-member`
còn đúng tên trên prod (tôi thấy cả hai khi đọc feed prod 2026-11-10). Commit: các file `machs.py`, `ghi.py`, model dùng chung với lượt vá rò
riêng tư (hunk lẫn nhau, `git add -p` không dùng được ở đây) nên không tách commit sạch theo pathspec được — cần quyết định commit gộp.
