# Modal "ai đang online" trên `/luot-xem`

Chốt 2026-08-31. User: *"thông báo có xxx online, click vào đó thì ra 1 modal, show tất cả
các user online, là người hay bot, nếu là người thì user đó đã đăng nhập hay chưa, xem
bằng trình duyệt gì, dùng thiết bị máy tính hay điện thoại"*.

Hai quyết định user chốt qua AskUserQuestion:

1. **Danh tính: CHỈ boolean "Đã đăng nhập / Khách"** — KHÔNG username, KHÔNG `user_id`.
   Cam kết riêng tư cốt lõi ("bảng lượt xem không có cột nào gắn được với một con người")
   **giữ nguyên**, PLAN không phải lật.
2. **Có hiện trang đang xem** (đường dẫn của lượt gần nhất).

## 0 · Cái gì đã có, cái gì phải thêm

| Yêu cầu | Nguồn |
|---|---|
| người hay bot · tên bot | `LuotXem.la_bot`, `ten_bot` — **có sẵn** |
| trình duyệt | `LuotXem.trinh_duyet` — **có sẵn** (chỉ ghi cho người) |
| máy tính / điện thoại | `LuotXem.thiet_bi` — **có sẵn** |
| trang đang xem | `LuotXem.duong_dan` — **có sẵn** |
| **đã đăng nhập hay chưa** | **CHƯA CÓ** — cột mới, xem §1 |

## 1 · Cột `da_dang_nhap` — một boolean, không hơn

`LuotXem.da_dang_nhap = BooleanField(default=False)`. Migration **`0026`**
⚠ `0025_hoithoai_tinnhan` là của **phiên khác** đang làm dở — kiểm lại số hiệu trước khi
`makemigrations`, đừng ghi đè.

- `apps/web/middleware.ts` gửi thêm `da_dang_nhap: req.cookies.has(COOKIE_PHIEN)`. Nó
  **đã đọc** cookie ấy sẵn cho nhánh rewrite `/m/` → `/m-phien/`; đây chỉ là chuyển tiếp
  một bit nó vốn có, không thêm phép đọc nào.
- `DemLuotXemIn.da_dang_nhap: bool = False` — **backward-compatible bắt buộc**, cùng lý
  lẽ đã ghi cho `ip`/`referer`: cửa sổ deploy lệch không được làm mọi lượt xem 422 rồi
  biến mất im lặng.

⚠ **Nghĩa CHÍNH XÁC là "request có mang cookie tên `sessionid`", KHÔNG phải "phiên còn
hiệu lực".** Middleware chạy ở edge, không có DB để validate — đúng đánh đổi mà nhánh
rewrite đã chấp nhận và đã ghi ở docstring `middleware.ts`. Hệ quả: cookie hết hạn vẫn
đếm là "đã đăng nhập". Phải **nói ra trên modal**, không giấu.

⚠ **Một boolean KHÔNG gắn hàng với một con người** — đó là lý do quyết định 1 của user giữ
được cam kết cũ. Chỗ này là ranh giới: thêm `user_id` vào bảng này là một quyết định KHÁC,
phải hỏi lại user và phải sửa PLAN.

Bot không mang cookie ⇒ `False`; và cột chỉ được hiển thị ở dòng người (dòng bot để `—`).

**Dữ liệu cũ tự lành sau 5 phút**: cửa sổ online chỉ 5 phút, nên hàng ghi trước lúc deploy
rơi khỏi cửa sổ gần như ngay. Không cần backfill, không có trạng thái "không rõ" kéo dài.

## 2 · Endpoint `GET /admin/luot-xem/online`

Router `quan_tri_luot_xem` (đã mount), `operation_id="quan_tri_luot_xem_online"`,
`Cache-Control: no-store`, mod thường xem được (chỉ đọc, không phơi danh tính ai).

- **Dùng lại hằng `CUA_SO_ONLINE_PHUT`** — không đẻ hằng thứ hai. Modal và ô KPI phải nói
  về cùng một cửa sổ.
- Trả `OnlineOut { items: list[KhachOnlineOut], tong: int, bi_cat: bool }`.
- `KhachOnlineOut`:
  `ma` (8 hex ĐẦU của `khach` — nhãn để mod phân biệt hai dòng, không đảo ngược được) ·
  `la_bot` · `ten_bot` · `da_dang_nhap` · `trinh_duyet` · `thiet_bi` ·
  `duong_dan` (lượt GẦN NHẤT) · `giay_truoc` (int) · `so_luot` (trong cửa sổ).
- Gom theo `khach`: MỘT truy vấn `.values(...)` trên cửa sổ (tập nhỏ — 5 phút), gom ở
  Python. Trần quét `SO_HANG_QUET = 5000`; chạm trần ⇒ `bi_cat = True` và modal nói ra.
- Trần dòng trả `SO_DONG_ONLINE = 200`, **cố định, không nhận từ query** (cùng lý lẽ
  `SO_TOP`/`SO_GOI_Y`).
- Loại `khach=""` — **cùng luật** với `_dem_online`.
- Sắp: lượt gần nhất mới trước.

**⚠ BẤT BIẾN PHẢI CÓ BÀI ĐO:** `tong` của endpoint này **BẰNG** `tong.so_online` của
`GET /admin/luot-xem` trên cùng dữ liệu. Hai chỗ đếm cùng một thứ bằng hai đoạn code là
đúng chỗ chúng trôi khỏi nhau — và triệu chứng là ô nói "5" còn modal liệt kê 7 dòng.

## 3 · Frontend

- **Ô Online bấm được**: `TheSo` thêm prop `onBam?: () => void`; có `onBam` thì render
  `<button>` (hover + `:focus-visible`, con trỏ tay), không có thì `<div>` như cũ ⇒ 5 ô
  kia không đổi một pixel. Nguyên tắc 9 của PLAN cấm "ô trông bấm được mà không bấm
  được" — nay nó bấm được thật, nên phải trông bấm được.
- **Modal dùng `NganKeo` có sẵn** (`apps/admin/components/ngan-keo.tsx`, đang dùng ở 10
  chỗ, đã có `role="dialog"` + `aria-modal` + Escape). **KHÔNG dựng modal thứ hai.**
- Bảng trong modal: Loại (Người / Bot + tên bot) · Trạng thái (Đã đăng nhập / Khách; bot
  ⇒ `—`) · Trình duyệt · Thiết bị · Trang đang xem · Bao lâu trước · Số lượt.
- **Nạp khi MỞ**, không nạp sẵn cùng trang chính (endpoint riêng, `no-store`).
- Ba trạng thái: đang tải · rỗng ("không ai đang online") · lỗi.
- Chú trong modal, ba vế: (a) "Đã đăng nhập" = **có cookie phiên**, không kiểm còn hạn, và
  **không biết là ai**; (b) mỗi dòng là một *khách ước lượng theo lượt xem*, không phải một
  phiên; (c) mã `#ab12cd` chỉ sống trong ngày (muối xoay mỗi ngày).

## 4 · KHÔNG làm

- Không username / `user_id` / IP / User-Agent thô ra API — kể cả cho mod.
- Không auto-refresh modal (mở lại là nạp lại).
- Không dựng modal mới, không đổi cửa sổ 5 phút, không đụng 5 ô KPI kia.

## 5 · Tiêu chí nghiệm thu — ĐO ĐƯỢC

Nền: pytest **1950 pass / 26 skip / 0 warning** · e2e don-vi **443 bài / 443 xanh, 0 đỏ**.

⚠ Con số nền viết lại 2026-09-04. Bản đầu chép từ brief (1850 pytest · 401 bài e2e · 1 đỏ
có sẵn `#14`) và **cả ba đều sai với cây thật lúc bắt tay làm**: `#14` đã được phiên khác
đóng ở `5d9a8be`, nên không có bài đỏ nào tồn đọng. Nền sai là thứ làm mọi phép so
"trước/sau" ở §9 vô nghĩa, nên nó được sửa chứ không được chú thích thêm.

| # | Tiêu chí | Đo bằng |
|---|---|---|
| N1 | pytest xanh, ≥ +8 bài mới, 0 warning | chạy lại |
| N2 | `da_dang_nhap`: body có cờ ⇒ ghi True; body **CŨ không có cờ** ⇒ 200 + False | bài đo |
| N3 | Gom đúng theo khách: 3 lượt 1 khách ⇒ 1 dòng `so_luot=3`, `duong_dan` là lượt GẦN NHẤT | bài đo |
| N4 | **`tong` của `/online` == `so_online` của `/luot-xem`** trên cùng seed | bài đo |
| N5 | Loại `khach=""`; loại ngoài cửa sổ; dùng đúng `CUA_SO_ONLINE_PHUT` | bài đo |
| N6 | KHÔNG rò: response không chứa hash đầy đủ (32), không IP, không UA thô — quét MỌI giá trị chuỗi của response | bài đo |
| N7 | Phân quyền: khách 401 · thường 403 · mod 200 · `no-store` | bài đo |
| N8 | codegen:check khớp · lint 0 warning · build xanh · e2e:don-vi ≥445 bài, **0 đỏ** | chạy lại |
| N9 | Thử phá ≥4 (§6) | báo cáo |
| N10 | Kiểm mắt bằng TRÌNH DUYỆT THẬT: login mod, bấm ô Online, modal mở, các cột đúng, Esc đóng | phiên chính (script Playwright + session, như lượt trước) |

## 6 · Thử phá bắt buộc

1. Bỏ `exclude(khach="")` ⇒ N5 đỏ.
2. Bỏ lọc cửa sổ (hoặc đổi sang hằng khác) ⇒ N5 đỏ.
3. Middleware quên gửi `da_dang_nhap` ⇒ N2 (hoặc bài đọc-nguồn) đỏ.
4. `/online` đếm khác `_dem_online` (vd quên `la_bot=False`) ⇒ **N4 đỏ**.
5. Trả `khach` đầy đủ 32 ký tự thay vì 8 ⇒ N6 đỏ.

## 7 · Deploy

- Migration **0026** ⇒ entrypoint `api` tự chạy `migrate` khi container lên.
- Thứ tự **`api` trước, `admin` sau** (runbook đã ghi; `TheSo` cũng đã chịu được thiếu
  trường từ lượt trước).
- Không đụng khoá Meili, không reindex.

## 8 · Ràng buộc

- ⚠ Phiên khác đang làm **hội thoại/tin nhắn** (`0025_hoithoai_tinnhan`) — KHÔNG đụng bất
  cứ file nào của nó; kiểm số migration trước khi tạo.
- KHÔNG đụng `form-tai-khoan.*`, `ket-qua-tim-kiem.module.css`, `the-mach.module.css`,
  `trang-mach.module.css`.
- KHÔNG commit · KHÔNG `pnpm e2e` trần (dùng `DATABASE_URL` trỏ `gikky_e2e`) · KHÔNG
  migrate `gikky_dev` (phiên chính làm ở chặng 5) · admin: không màu ứng biến, không
  `--stamp`.

## 9 · Nhật ký

### 2026-09-03 · opus-dev (chặng 2)

Làm trọn §1–§3. Số đo thật, cây chính (cây có sẵn thay đổi của phiên khác — xem cảnh báo
cuối mục):

| Cổng | Kết quả |
|---|---|
| `pnpm test` | **1975 pass · 0 fail · 26 skip · 0 warning** (326s) |
| `pnpm e2e:don-vi` | **447/447 xanh, 0 đỏ** |
| `pnpm lint` | 0 warning (cả hai app, `--max-warnings=0`) |
| `pnpm build` | xanh; `/luot-xem` 5.78 kB |
| `pnpm codegen:check` | khớp — 34 file không đổi |

**+25 bài đo mới** (đếm bằng `--collect-only` trên ba file đã đụng: 110 → 135).

#### Ba điểm quyết định khác/ngoài chữ của plan, và vì sao

1. **`items` GỒM cả dòng bot, nên `len(items) ≠ tong`.** §0 và §3 đòi cột "người hay bot
   + tên bot", tức bot phải có mặt; §2 lại đòi `tong == so_online`, mà `so_online` chỉ
   đếm người. Hai vế ấy chỉ cùng đúng khi `tong` **không** suy từ danh sách. Nên `tong`
   gọi thẳng `_dem_online()` — cùng hàm ô KPI gọi — và modal nói ra chênh lệch bằng một
   dòng tóm tắt ("N người đang online · M dòng bên dưới (gồm cả bot)") cộng một vế trong
   khối chú. Bất biến N4 vì thế đúng **theo cấu tạo**, kể cả khi chạm trần quét.
2. **Thử phá ca 4 đi bằng `tong = len(items)`, không bằng "quên `la_bot=False`"** như
   plan gợi ý. Lý do: với `tong=_dem_online()` thì "quên `la_bot=False`" trong truy vấn
   danh sách là **hành vi đúng** (bot phải có mặt), còn `len(items)` mới là cách hỏng
   thật — nó ngắn hơn, trông hiển nhiên đúng, và là thứ một lượt "dọn dẹp" sẽ viết.
   Ca này làm **5 bài đỏ**, xem bảng thử phá dưới.
3. **Thêm hàng rào nguồn cho middleware (X4–X6 ở `e2e/don-vi/dem-luot-xem.spec.ts`).**
   Plan nói thử phá ca 3 phải làm "N2 hoặc bài đọc-nguồn" đỏ — nhưng bài đọc-nguồn ấy
   **chưa tồn tại**: pytest tự dựng thân request nên nó mù hoàn toàn với việc middleware
   có gửi cờ hay không. X4 đọc `DemLuotXemIn` bên Python rồi ép middleware phải gửi **đủ
   mọi trường schema khai** (không phải chỉ `da_dang_nhap`), nên nó tự bám cho lượt sau.

#### Thử phá — 7 ca, mỗi ca bẻ → đỏ → khôi phục → xanh lại

| # | Bẻ gì | Bài đỏ |
|---|---|---|
| 1 | bỏ `exclude(khach="")` trong `_gom_online` | `test_N5_hang_khach_RONG_bi_loai_khoi_danh_sach` |
| 2 | đổi cửa sổ sang `timedelta(minutes=60)` | `test_N5b_ranh_gioi_dung_CUA_SO_ONLINE_PHUT` · `test_N5c_luot_NGOAI_cua_so_khong_cong_vao_so_luot` |
| 3 | middleware bỏ `da_dang_nhap: co_cookie_phien` | `X4` · `X5` (e2e don-vi) |
| 4 | `tong=len(items)` thay cho `_dem_online()` | `test_N4_tong_BANG_so_online_cua_endpoint_kia` · `test_N4c_bat_bien_giu_ca_khi_chi_co_BOT` · `test_N3e_danh_sach_CO_dong_bot` · `test_N_cham_tran_quet_…` · `test_N_tran_DONG_…` |
| 5 | `ma=h["khach"]` (đủ 32 ký tự) | `test_N6_response_KHONG_chua_hash_day_du_IP_hay_UA` |
| 6 | `da_dang_nhap=False` cứng ở đường ghi | `test_N2_co_co_trong_than_thi_ghi_True` |
| 7 | gom kiểu "lần cuối ghi đè" thay vì "lần đầu gặp" | `test_N3_ba_luot_mot_khach_ra_MOT_dong_so_luot_3` · `test_N3b_duong_dan_la_luot_GAN_NHAT_…` |

#### Một dòng phải sửa ngoài phạm vi (vì nó CHẶN)

`tests/_quan_tri.py::bang_endpoint` — hàng rào "mọi endpoint quản trị đều được chấm phân
quyền" đỏ ngay khi endpoint mới xuất hiện. Thêm đúng một dòng cho
`quan_tri_luot_xem_online`. Đó là hàng rào làm đúng việc của nó, không phải một sửa lấn.

#### ⚠ Chưa làm / cần chặng 5 soi

- **N10 (kiểm mắt bằng trình duyệt thật) chưa chạy** — theo phân công, đó là việc chặng 5.
- **Bảng trong ngăn kéo cuộn ngang khá nhiều.** `NganKeo` rộng `max-w-md` (448px) còn
  `KhungBang` ép `min-w-[52rem]` (832px), nên 7 cột phải cuộn ngang gần gấp đôi. Đúng
  chữ §3 ("bảng trong modal") và đúng khuôn mọi bảng khác của khu quản trị, nhưng đây là
  chỗ N10 nên nhìn tận mắt rồi quyết: giữ bảng, hay đổi sang một dòng-một-khối.
- **Nền đo lệch bản brief**: brief nói 1850 pass và e2e don-vi 401 bài/1 đỏ có sẵn (#14).
  Cây thật lúc làm là **1950 pass** và **443 bài e2e don-vi, xanh toàn phần** — `#14` đã
  được phiên khác đóng ở commit `5d9a8be`. Không có bài đỏ nào tồn đọng. *(§5 đã sửa theo
  con số này 2026-09-04; bảng trên nói "447 xanh" là số **sau** khi thêm, không phải nền.)*
- Migration là **`0026_luotxem_da_dang_nhap`**, phụ thuộc `0025_hoithoai_tinnhan`. Chưa
  chạy `migrate` trên `gikky_dev` (chặng 5 làm). Không đụng file nào của hoithoai/tinnhan.

### 2026-09-04 · opus-dev (chặng 2b — sửa theo phản biện + nghiệm thu + kiểm mắt)

Bảy hạng mục, làm trọn. Số đo thật, cây chính.

#### Sửa gì

| # | Sửa | Bài đo |
|---|---|---|
| NẶNG-1a | `che_duong_dan()` — `/u/…` → `"(hồ sơ người dùng)"`, `/tin-nhan/…` → `"(tin nhắn)"`, che **ở server** | `test_NANG1a_che_duong_dan_mang_danh_tinh` (12 ca) + `test_NANG1a_duong_dan_ra_API_da_duoc_che` |
| NẶNG-1b | **BỎ `ma`** (8 hex đầu của `khach`, ổn định cả ngày) ⇒ `stt: int` 1-based, chỉ có nghĩa trong một response | `test_N6*` (quét mọi chuỗi, cấm mọi tiền tố hex ≥8) · `test_N6b` (tập khoá) · `test_N6c` |
| NẶNG-1c | Viết lại `ChuOnline`: gỡ hai câu SAI, nói đúng nghĩa của bit (`sessionid`, client tự khai, không kiểm hạn) | hàng rào nguồn `MODAL ONLINE — chú KHÔNG được khẳng định hai câu đã biết là SAI` |
| TB-3 | `luot_xem_online` đọc mốc **đúng một lần**, truyền xuống `_gom_online(moc)` / `_dem_online(moc)` | `test_TB3_mot_request_online_chi_doc_dong_ho_DUNG_MOT_LAN` |
| TB-4 | Modal nạp xong ⇒ ghi đè `so_lieu.tong.so_online = data.tong` (hai con số luôn khớp trên màn hình) | hàng rào nguồn + kiểm mắt chặng 5 |
| TB-5 | "Không cookie" → "không cookie theo dõi…, từ 03/09/2026 ghi thêm MỘT bit" ở `page.tsx` (tiêu đề + khối giới hạn) và docstring `core/models/luot_xem.py` | *(chữ — không có bài đo tự động, xem "chưa làm")* |
| TB-6 | Bot **có** cookie phiên ⇒ "⚠ có cookie phiên"; bot không cookie ⇒ `—`. Gỡ comment sai "bot không mang cookie bao giờ" | `test_TB6_bot_mang_cookie_phien_van_giu_True` (+ `test_N3d` gỡ giả định sai) |
| TB-7 | `OnlineOut.so_dong_that` — trần dòng thôi cắt im lặng; modal nói "còn N dòng nữa không hiện" | `test_N_tran_DONG_…NOI_RA_bang_so_dong_that` + `test_N_tran_DONG_khong_cham_thi_…` |

Nhóm NHẸ, làm hết: mốc "Số liệu lúc HH:MM:SS" + nút **Làm mới** trong ngăn kéo · nhánh
rỗng bỏ khối chú · `TheSo` đổi `<p>` → `<span className="block">` (`<p>` trong `<button>`
là HTML sai) · `_gom_online` thêm tie-break `-pk` · `test_N6` có assert THẬT cho IP
(seed `nguon="203.0.113.9"`, quét regex IPv4) và đổi tên cho đúng cái nó đo · §5/§9 sửa
nền.

#### Bố cục ngăn kéo: BỎ bảng 7 cột

N10 đo được bảng rộng 832px (`KhungBang` ép `min-w-[52rem]`) trong khung 415px
(`NganKeo` là `max-w-md`) ⇒ cuộn ngang gấp đôi. Nay **một khối cho mỗi khách**, xếp dọc,
bốn dòng: *loại + trạng thái* · *trình duyệt · thiết bị* · *trang đang xem* ·
*x phút trước · n lượt*. `data-testid="online-khach-{stt}"` cho từng khối,
`data-testid="bang-online"` giữ nguyên trên `<ul>` để bài đo cũ không mồ côi.

#### Số đo

| Cổng | Trước | Sau |
|---|---|---|
| `pytest` | 1975 pass · 26 skip | **1990 pass · 26 skip · 0 fail · 0 warning** (324s) |
| `e2e:don-vi` | 447 xanh | **450/450 xanh, 0 đỏ** |
| `lint` | 0 warning | 0 warning (cả hai app) |
| `build` | xanh | xanh (`/luot-xem` 6.34 kB) |
| `codegen:check` | khớp | khớp — 34 file không đổi |

⚠ **pytest chạy với `--no-migrations`.** Cây có HAI leaf migration (`0025_hoithoai_tinnhan`
của phiên khác và `0026_luotxem_da_dang_nhap` cùng tựa `0024`, phiên chính trỏ về `0024`
có chủ đích), nên `pnpm test` trần ném `CommandError: Conflicting migrations detected`
trước khi chạy bài nào. `--no-migrations` dựng schema thẳng từ model nên nó **không**
kiểm được migration có khớp model không — phiên chính phải chạy lại `pnpm test` đầy đủ
sau khi cây thẳng hàng.

#### Thử phá — 9 ca, mỗi ca bẻ → đỏ → khôi phục → xanh lại

| # | Bẻ gì | Bài đỏ |
|---|---|---|
| 1 | bỏ `("/u/", …)` khỏi `CHE_DUONG_DAN` | `test_NANG1a_*` — **4 đỏ** |
| 2 | trả lại `ma = khach[:8]` (schema + view) | `test_N6_*` · `test_N6b_*` |
| 3 | `_gom_online(_moc_online())` (đọc đồng hồ hai lần) | `test_TB3_*` (đếm được 2) |
| 4 | `da_dang_nhap and not la_bot` ở view | `test_TB6_*` |
| 5 | bỏ `so_dong_that` khỏi schema + view | `test_N_tran_DONG_*` ×2 · `test_N6b_*` |
| 6 | bỏ chữ "gồm cả bot" khỏi dòng tóm tắt | `MODAL ONLINE — dòng tóm tắt…` |
| 7 | thêm lại "không biết đó là ai" vào chú | `MODAL ONLINE — chú KHÔNG được khẳng định…` |
| 8 | `data-ma={k.ma}` trên khối khách | `MODAL ONLINE — không dựng lại bí danh…` |
| 9 | đổi `data-testid="online-luc-nap"` | `MODAL ONLINE — dòng tóm tắt…` |

#### ⚠ Chưa làm / cần chặng 5 soi

- **`pnpm test` đầy đủ (có migration) chưa chạy** — hai leaf, xem trên.
- **TB-5 không có bài đo tự động.** Ba câu chữ ("không cookie theo dõi", mốc 03/09/2026,
  "một bit") sống ở `page.tsx` và docstring `core/models/luot_xem.py`. Dựng một hàng rào
  ghim từng câu là ghim văn phong, không ghim sự thật — nên chúng chỉ được canh gián tiếp
  qua hàng rào "chú không được nói hai câu SAI". Chỗ này cần mắt người.
- **Kiểm mắt lại bố cục mới** (khối thay bảng) trên trình duyệt thật: N10 chốt bỏ bảng,
  nhưng bản thay chưa được nhìn tận mắt.

### Chặng 5 — phiên chính chốt việc (2026-09-04)

Nghiệm thu 8/9 ĐẠT (N9 "một phần" chỉ vì nó bị cấm sửa file — đã đối chiếu logic 7/7 ca).
Phản biện 2 NẶNG · 5 TRUNG BÌNH · 8 NHẸ. N10 lần 1 (trình duyệt thật): cơ chế đúng, bố
cục hỏng đúng như số (bảng 832px trong khung 415px).

**Quyết định của phiên chính về NẶNG-1 (riêng tư):** bản đầu để lộ đường vòng gắn bí danh
với tài khoản (`Đã đăng nhập · /u/<username>` + `ma` ổn định cả ngày) — vượt điều user
chốt "không biết là ai" dù đúng chữ "không username". Sửa CẢ BA (che `/u/`+`/tin-nhan/`
ở server · bỏ `ma` thay bằng `stt` · viết lại chú cho thật) — đây là **khôi phục** điều
user chốt, không phải mở lại; user muốn thấy nguyên `/u/…` thì bỏ che, nhưng khi đó cam
kết "không biết là ai" không còn đúng (đã nói rõ trong báo cáo).

**NẶNG-2 (migration 0026 tựa 0025 sắp rời `main`):** phiên chính trỏ lại `0026 → 0024`
để mở khoá P-20260903-24 (user yêu cầu tách nhắn tin). Hệ quả tạm: cây HAI leaf cho tới
khi phiên `gikky-net-3b` gỡ 0025 ⇒ `pnpm test`/`migrate` conflict trong khe ấy (đã báo
phiên kia + dặn opus-dev; opus-dev chạy pytest bằng `--no-migrations` tạm thời).

Lượt sửa gộp (opus-dev): NẶNG-1 a/b/c · TB-3 mốc nguyên tử · TB-4 đồng bộ ô KPI · TB-5
chữ "không cookie" · TB-6 bot+cookie hiện cảnh báo · TB-7 `so_dong_that` · 9 mục NHẸ gồm
**bố cục khối thay bảng**. Thử phá 9/9 ĐỎ đúng bài.

**N10 lần 2 (trình duyệt thật, bố cục khối):** 4 khối · KHÔNG cuộn ngang (`ul` 415/415,
dialog 447) · `/u/chinhho` → "(hồ sơ người dùng)" · bot mang cookie → "⚠ có cookie phiên",
bot thường → "—" · tóm tắt "2 người · 4 dòng (gồm cả bot)" khớp ô KPI · có mốc "Số liệu
lúc HH:MM:SS" · câu "không biết đó là ai" đã biến mất · không `data-ma`/hex 8 rò ra ·
Esc đóng · 0 lỗi JS. Dữ liệu gieo + session tạm đã xoá.

Số đo (cây hai leaf, pytest `--no-migrations`): pytest 1990 pass/26 skip/0 fail/0 warning
· e2e don-vi 450/450 · lint 0 · build xanh (`/luot-xem` 6.34 kB) · codegen khớp;
`api-client` diff chỉ thêm `quanTriLuotXemOnline` (không dính endpoint phiên khác).
**Còn nợ trước commit:** `pnpm test` ĐẦY ĐỦ (có migrate) + `makemigrations --check` sau khi
0025 rời cây.
