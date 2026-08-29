# Trang thống kê lượt xem — kiểu GoatCounter, bản đơn giản

Chốt 2026-08-27. User: *"thêm 1 phần tổng kết xem gikky được view bao nhiêu lần, những
link được xem nhiều, bao nhiêu bot vào, những bot nào … kiểu 1 phần thống kê như gstat,
nhưng ở dạng đơn giản, làm 1 page thống kê riêng, không nhúng vào dashboard"*.

User chốt ba điều khi được hỏi:

1. **Chỉ đếm lượt xem** — không lưu dấu vết người đọc: không IP, không cookie theo dõi,
   không "khách duy nhất".
2. **Thô 90 ngày + tổng theo ngày giữ mãi.**
3. **Đếm mọi trang của site công khai** (bỏ `/api/*`, `/media/*`, file tĩnh, khu quản trị).

---

## 0 · Điểm kiến trúc quyết định cả việc

**Lượt xem trang KHÔNG đi qua Django.** Django chỉ phục vụ `/api/*`; trang là của Next
(`apps/web`). Một middleware Django sẽ đếm được **API call**, không phải lượt xem — một con
số trông như thật mà sai hoàn toàn, và không có gì báo.

⇒ Chỗ duy nhất đếm được là **`apps/web/middleware.ts`**. Hai tính chất của nó làm việc này
khả thi, và cả hai phải giữ:

- **Middleware chạy TRƯỚC cache ISR** (docstring file ấy đã ghi) ⇒ vẫn thấy request kể cả
  khi trang được phục vụ từ bản cache. Đếm ở tầng React component thì mất sạch lượt cache.
- **Middleware chạy trên máy chủ** ⇒ thấy cả bot. Bot không chạy JavaScript, nên mọi cách
  đếm bằng script phía trình duyệt đều **không trả lời được** nửa câu hỏi của user
  ("bao nhiêu bot vào, những bot nào").

## 1 · ⚠ Chỗ nguy hiểm nhất: nới `matcher` của middleware

Hôm nay `matcher: ["/m/:slugId"]`, và docstring của nó cảnh báo **đích danh** rằng nới
thành `:path*` sẽ rewrite luôn `/m/<slug>-<id>/opengraph-image` ⇒ **404 thẻ chia sẻ, chỉ
với người đã đăng nhập** — tức gần như không ai thấy khi test.

Việc này **bắt buộc phải nới** `matcher` (đếm mọi trang). Nên tách hai trách nhiệm:

```
matcher rộng   → chỉ để ĐẾM
điều kiện hẹp  → mới REWRITE sang /m-phien
```

Điều kiện rewrite phải giữ **đúng ngữ nghĩa cũ**: chỉ khi path khớp `^/m/[^/]+$` (một đoạn,
không có con) **và** có cookie phiên. Bất kỳ cách viết nào khác là hồi quy.

**Bài đo bắt buộc** (`e2e/don-vi/`, hàm thuần — xem §5.1): `/m/abc-1` có cookie ⇒ rewrite;
`/m/abc-1/opengraph-image` có cookie ⇒ **KHÔNG** rewrite; `/` ⇒ không rewrite nhưng **có**
đếm.

## 2 · Dữ liệu

### 2.1 · `LuotXem` — hàng thô, 90 ngày

| Cột | Kiểu | Ghi chú |
|---|---|---|
| `duong_dan` | `CharField(200)` | **không query string** — `?utm_source=…` đẻ vô hạn biến thể của cùng một trang. Cắt ở 200 ký tự |
| `luc` | `DateTimeField` | index; mặc định `timezone.now` |
| `la_bot` | `BooleanField` | |
| `ten_bot` | `CharField(40)` | rỗng khi là người. Chuẩn hoá (§3) |

**KHÔNG có cột IP, KHÔNG có cột User-Agent thô, KHÔNG cookie.** Đó là quyết định của user,
và nó là lý do trang này không cần banner cookie: nó không lưu gì gắn được với một người.

⚠ **User-Agent vẫn được GỬI sang Django** để phân loại, chỉ là **không được lưu**. Phân
loại ở Django chứ không ở Next vì danh sách bot cần một chỗ duy nhất và cần `pytest` chấm
được; edge runtime thì không.

### 2.2 · `TongNgay` — tổng theo ngày, giữ mãi

`ngay` (date) · `duong_dan` · `so_luot_nguoi` · `so_luot_bot`, `unique_together(ngay, duong_dan)`.

Lệnh `gom_luot_xem` **chỉ gộp NGÀY ĐÃ XONG** (`< hôm nay`, theo giờ VN), nên nó tất định và
chạy lại bao nhiêu lần cũng ra cùng kết quả (upsert theo khoá). Gộp cả ngày hôm nay là mỗi
lần chạy ra một con số khác cho cùng một ngày — thứ không ai kiểm được.

Cùng lệnh ấy xoá hàng thô cũ hơn **90 ngày**. Xoá *sau* khi gộp, và chỉ xoá phần đã có
trong `TongNgay` — mất một ngày thô chưa gộp là mất vĩnh viễn, không dựng lại được.

## 3 · Nhận diện bot

`api/core/bot.py`, một hàm thuần `ten_bot(user_agent: str) -> str` trả tên chuẩn hoá hoặc
`""`.

- Bảng khớp **theo thứ tự**, chuỗi con, không phân biệt hoa thường: `googlebot`,
  `bingbot`, `yandexbot`, `duckduckbot`, `baiduspider`, `applebot`, `facebookexternalhit`,
  `twitterbot`, `slackbot`, `telegrambot`, `discordbot`, `gptbot`, `oai-searchbot`,
  `chatgpt-user`, `claudebot`, `claude-web`, `perplexitybot`, `amazonbot`, `bytespider`,
  `ahrefsbot`, `semrushbot`, `mj12bot`, `dotbot`, `petalbot`, `uptimerobot`.
- Không khớp bảng nhưng chứa `bot` / `crawler` / `spider` / `curl` / `wget` /
  `python-requests` / `headlesschrome` ⇒ `"khác"`.
- Rỗng hoặc thiếu UA ⇒ `"khác"` (một client không khai UA gần như chắc chắn không phải
  trình duyệt thật).

⚠ **Thứ tự quan trọng và có bẫy**: `Googlebot` UA cũng chứa chuỗi `Google`, còn
`chatgpt-user` chứa `chatgpt` — nên bảng phải khớp **cụ thể trước, chung sau**, và có bài
đo ghim đúng cặp dễ nuốt nhau nhất (`GPTBot` vs `ChatGPT-User`, `claudebot` vs
`claude-web`).

Đây là **suy đoán, không phải sự thật**: một trình duyệt thật đặt UA lạ sẽ bị tính là bot.
Nói ra trên giao diện (§4) thay vì để người đọc tin đó là con số chính xác.

## 4 · Trang `/luot-xem` ở `apps/admin`

Menu: nhóm **"Tổng quan"**, ngay sau "Bảng điều khiển". User chốt *"không nhúng vào
dashboard"*, nên nó là mục riêng — nhưng nó thuộc cùng loại câu hỏi ("site đang thế nào"),
nên nó đứng cạnh chứ không lưu lạc xuống "Hệ thống".

Nội dung, theo đúng bốn câu user hỏi:

1. **Bốn con số**: tổng lượt xem · lượt người · lượt bot · % bot.
2. **Cột theo ngày** — vẽ bằng `div` + token màu, **không thêm thư viện biểu đồ**.
3. **Bảng "Xem nhiều nhất"** — top 20 đường dẫn, tách cột người / bot.
4. **Bảng "Bot nào vào nhiều nhất"** — top 20 tên bot.

Bộ chọn khoảng: **7 · 30 · 90 ngày · toàn thời gian**.

- 7/30/90 đọc **`LuotXem` thô** (90 ngày phủ trọn).
- "toàn thời gian" đọc **`TongNgay`** (ngày đã xong) **+ `LuotXem` của riêng hôm nay**.
  Không cộng chồng vì `gom_luot_xem` cố ý không gộp ngày hôm nay.

Một dòng chú ở cuối trang nói **hai giới hạn thật**, không giấu: nhận diện bot là suy đoán
theo User-Agent; và số liệu không nói được "bao nhiêu người", chỉ nói "bao nhiêu lượt".

## 5 · Đường ghi: Next → Django

`POST /api/v1/dem-luot-xem`, body `{duong_dan, user_agent}`.

### 5.1 · Chống spam từ bên ngoài — dùng lại khuôn đã có

Endpoint này ghi DB và **không** có phiên đăng nhập, nên để trần là ai cũng bơm được số
liệu rác. Repo đã có đúng khuôn cho ca này: `scripts/`+`apps/web/lib/lam-moi-cache.ts` dùng
**secret header** (secret rỗng ⇒ 503, secret sai ⇒ 401). Dùng lại nguyên hình dạng đó —
đừng phát minh cái thứ hai.

- Biến môi trường mới ở `api/.env.example` **và** ở `apps/web` (server-only, **không**
  `NEXT_PUBLIC_`).
- Secret rỗng ⇒ **503 và KHÔNG ghi gì**. Đó là trạng thái mặc định của một máy dev chưa
  đặt biến; nó phải im lặng không đếm chứ không phải nổ trên mọi request.

### 5.2 · Không được chặn response

Middleware **không `await`** lời gọi ấy: dùng `event.waitUntil(...)` (tham số thứ hai của
`middleware`). Một lượt `await` là mỗi trang của site cộng thêm một round-trip sang Django
— kể cả trang đang được phục vụ từ cache ISR, tức đúng thứ cache sinh ra để tránh.

Và **`.catch(() => {})`**: Django chết thì site vẫn phải phục vụ trang. Thống kê hỏng là
phiền; trang chủ 500 vì thống kê hỏng là hỏng sản phẩm.

### 5.3 · Cái KHÔNG đếm

Bỏ qua ngay trong `matcher` (rẻ hơn lọc trong Django): `/api/*`, `/media/*`, `/_next/*`,
`/favicon.ico`, `robots.txt`, `sitemap*.xml`, `opengraph-image`, và mọi đường có đuôi file.
Khu quản trị là **app khác, cổng khác**, không có middleware này ⇒ tự động không đếm.

## 6 · Endpoint đọc

`GET /api/admin/luot-xem?khoang=7|30|90|tat_ca`, `operation_id="quan_tri_luot_xem"`.

⚠ Phải thêm dòng vào `api/tests/_quan_tri.py::bang_endpoint`, nếu không
`test_bang_nay_phu_het_moi_endpoint_cua_api_admin` **đỏ**. Rồi `pnpm codegen`.

Endpoint này chỉ đọc và không đổi dữ liệu ⇒ mod thường xem được, không cần `is_superuser`.

## 7 · Tiêu chí nghiệm thu (ĐO ĐƯỢC)

Nền phải tự đo lại trước khi sửa (cây đang rất bẩn, nhiều phiên chạy song song).

| # | Tiêu chí | Đo bằng |
|---|---|---|
| N1 | `pnpm test` xanh, 0 warning, ≥ nền + bài mới | tự chạy |
| N2 | `pnpm lint` `--max-warnings=0` | exit 0 |
| N3 | `e2e:don-vi` **không đỏ thêm** so với nền | đếm số bài đỏ trước/sau |
| N4 | `tsc --noEmit` ở `apps/admin` **không đỏ thêm** | như trên |
| N5 | `codegen:check` khớp | exit 0 |
| N6 | Bảng phân quyền phủ endpoint mới | `test_bang_nay_phu_het_moi_endpoint…` xanh |
| N7 | **Rewrite `/m-phien` không hồi quy** | §5.1 + bài đo §8 nhóm R |
| N8 | Migration chạy được cả hai chiều | `migrate` rồi `migrate <app> <trước>` |

## 8 · Bài đo bắt buộc

**Nhóm R — hồi quy rewrite (quan trọng nhất, xem §1)**, `e2e/don-vi/`:
- R1 `/m/abc-1` + cookie ⇒ rewrite `/m-phien/abc-1`
- R2 `/m/abc-1` **không** cookie ⇒ không rewrite
- R3 **`/m/abc-1/opengraph-image` + cookie ⇒ KHÔNG rewrite** ← ca docstring cũ cảnh báo
- R4 `/` + cookie ⇒ không rewrite
- R5 mọi đường ở R1..R4 **đều được đếm** trừ những đường §5.3 loại

**Nhóm B — nhận diện bot** (`api/tests/`):
- B1 mỗi mục trong bảng ra đúng tên chuẩn hoá
- B2 `GPTBot` ≠ `ChatGPT-User`, `claudebot` ≠ `claude-web` *(cặp dễ nuốt nhau)*
- B3 UA của Chrome/Safari/Firefox thật ⇒ **không** phải bot
- B4 UA rỗng / thiếu ⇒ `"khác"`
- B5 chống bảng rỗng: bảng có ≥ 20 mục và `ten_bot` phủ hết

**Nhóm G — đường ghi**:
- G1 secret đúng ⇒ 200 + đúng **một** hàng `LuotXem`
- G2 secret sai ⇒ 401, **0 hàng**
- G3 secret rỗng ở server ⇒ 503, **0 hàng**
- G4 query string bị cắt khỏi `duong_dan`
- G5 đường dẫn dài hơn 200 ký tự bị cắt, không ném

**Nhóm T — gộp & dọn**:
- T1 `gom_luot_xem` gộp đúng, và **chạy hai lần ra cùng kết quả** (idempotent)
- T2 **không** gộp ngày hôm nay
- T3 xoá hàng thô > 90 ngày, và **chỉ** phần đã có trong `TongNgay`
- T4 "toàn thời gian" = `TongNgay` + hôm nay, **không cộng chồng**

**Nhóm Q — endpoint đọc**: top-N đúng thứ tự · tách người/bot đúng · khoảng ngày đúng biên.

Luật 4 áp đủ: **mỗi bài phải được thử phá**. Chú ý riêng T1 và T4 — hai bài dễ ra "đúng bất
kể code làm gì" nhất nếu seed chỉ có một ngày dữ liệu; phải seed **ít nhất 3 ngày**, trong
đó có hôm nay và một ngày > 90 ngày trước.

## 9 · Ràng buộc tài nguyên

⚠ **Phiên Claude khác đang làm trong CẢ `apps/web` LẪN `apps/admin`** (reaction/emoji, bình
luận chung, `cai-thien-admin`, `check-fx`). Lượt này đụng `apps/web/middleware.ts` và thêm
trang vào `apps/admin` ⇒ **rủi ro va chạm cao**. Chạy `git status` trước, chỉ đụng file của
việc này, không "tiện tay" sửa gì khác.

⚠ Cổng 3000/3001/8000 đang bị dev server của phiên khác chiếm. **CẤM `pnpm build`** (phá
`.next/` của họ) và **CẤM `pnpm e2e`** (chiếm cổng + ghi `gikky_dev`).

| Agent | Được chạy | Cấm |
|---|---|---|
| `nghiem-thu` | `pnpm test` · `lint` · `codegen:check` · `tsc` — một bộ một lúc | `build` · `e2e` |
| `phan-bien` | đọc code · `e2e:don-vi` · SQL chỉ đọc | `build` · `test` cả bộ · `e2e` |

## 10 · Nhật ký thực hiện

Nghiệm thu chấm **8/8 ĐẠT**, tự chạy `pnpm build` (exit 0, 0 warning, middleware biên dịch
được với matcher mới) và 5 lượt đột biến trong worktree + DB riêng. Rủi ro "chưa từng
build" đã gỡ.

**Phản biện tìm ra 9 điểm, trong đó 3 NẶNG — và cái nặng nhất không nằm ở chỗ plan lo.**
Chỗ plan lo nhất (hồi quy rewrite `/m-phien`) thì **không phá được**: đã thử `/m/abc-1/`,
`/m/abc-1//`, `/m//abc-1`, `/M/abc-1`, `/m/abc-1/opengraph-image`, đường tiếng Việt đã
encode — không ca nào sai chiều nào.

### 10.1 · NẶNG 1 — khoá đặt lại mật khẩu bị ghi vào DB thống kê

`settings.HEADLESS_FRONTEND_URLS` đặt khoá của allauth **vào đường dẫn**
(`/dat-lai-mat-khau/{key}`, `/xac-thuc-email/{key}`); `nenDem()` không loại chúng và Django
chỉ cắt `?`/`#`. Mỗi lượt bấm link trong mail ghi nguyên token vào `LuotXem`, rồi
`gom_luot_xem` chuyển sang `TongNgay` — **giữ vĩnh viễn**.

Ba hệ quả, cái thứ ba phá thẳng mục tiêu tính năng: (a) đó là credential **còn sống**;
(b) nó sống lâu hơn hạn 90 ngày user chốt; (c) khoá allauth mở đầu bằng **user PK mã
base36**, nên mỗi dòng đọc ra là *"user #N mở trang đặt lại mật khẩu lúc 14:32"* — đúng
thứ docstring của `LuotXem` và trang `/luot-xem` khẳng định là không tồn tại.

**Vá**: thêm `MANG_BI_MAT` vào `KHONG_DEM`. **Chuông**: bài đo đọc thẳng
`HEADLESS_FRONTEND_URLS` của Django, cắt mọi URL có `{key}`, đòi `nenDem()` trả `false`
cho từng cái — fail-closed. Cố ý **không** chép tay danh sách: một danh sách chép tay
chính là thứ đã để lọt lỗi này.

### 10.2 · NẶNG 2 — prefetch của `<Link>` bị đếm ⇒ mọi con số thổi phồng

Middleware không nhìn `req.method`, không nhìn header prefetch. `<Link>` **nạp trước toàn
bộ** route ISR khi link lọt vào viewport, mà `app/m/[slugId]` khai `revalidate = 3600`.
⇒ mở trang chủ có 20 thẻ, **không bấm gì, không cuộn**, đã sinh 20 "lượt xem"; bấm vào thì
đếm lần thứ hai. `/dang-nhap`, `/luat`, `/s/<sub>` nằm trong nav mọi trang nên leo lên đầu
bảng "Xem nhiều nhất". Bảng ấy khi đó đo *"lọt vào tầm mắt bao nhiêu lần"*.

**Vá**: `nenDemRequest(req)` — chỉ `GET`, và loại `next-router-prefetch` / `purpose` /
`sec-purpose`. **Điều hướng RSC vẫn đếm** (có `RSC: 1` nhưng không có header nạp trước —
người ta đang thật sự mở trang ấy); loại nó là mất phần lớn lượt xem thật.

### 10.3 · NẶNG 3 — prod chết im lặng

`deploy/prod/` **không có** `DEM_LUOT_XEM_SECRET`, và **không có lịch** chạy
`gom_luot_xem`. Deploy lên là: middleware không gọi Django lần nào, Django fail-closed
503, `.catch(() => {})` nuốt sạch, trang hiện `0/0/0/0%` mãi mãi.

**Vá**: khai biến ở `env.example` + **ba chỗ** trong `compose.yml` — `api.environment`,
`web.environment`, và **`web.build.args`**. Chỗ thứ ba là chỗ dễ quên nhất: edge middleware
**nội tuyến `process.env` lúc `next build`**, khác `REVALIDATE_SECRET` (route handler, đọc
lúc chạy). Đặt biến sau khi build xong là nó vẫn rỗng trong bundle. Service `admin` **không**
được khai — nó không có middleware đếm. Cộng một mục cron trong `deploy/prod/README.md`
kèm lệnh kiểm nó có chạy.

### 10.4 · Sáu điểm còn lại

| # | Lỗi | Vá |
|---|---|---|
| 4 | bảng bot luôn dùng hằng 90 ngày bất kể `?khoang=` ⇒ chọn "7 ngày" mà có bot quét 60 ngày trước thì KPI "Lượt bot" = 0 còn bảng bot = 500, **và cờ báo giới hạn nói `False`** | dùng đúng `ngay_dau` của khoảng; cờ `True` chỉ ở `tat_ca`. Bài đo ghim **bất biến** `sum(top_bot) <= tong.so_luot_bot` |
| 5 | "toàn thời gian" = `TongNgay` + **riêng hôm nay** ⇒ cron chưa chạy thì nó **nhỏ hơn "90 ngày" cả chục lần** | ranh giới là `max(TongNgay.ngay) + 1`, không phải "hôm nay" ⇒ **tự lành** khi cron trễ |
| 6 | `TongNgay` giữ mãi mà **số dòng do người ngoài quyết** (bot quét 404 / script gõ URL ngẫu nhiên) | ngưỡng `NGUONG_GIU_RIENG = 2`; phần dưới ngưỡng gộp vào một hàng `(lẻ tẻ)` — **tổng không đổi**, có bài đo ghim |
| 7 | `/lam-moi-cache` (cửa máy-với-máy của Django) bị đếm như một lượt xem | thêm vào `KHONG_DEM` |
| 8 | regex ảnh không neo route cha ⇒ nuốt **mọi** đường kết thúc bằng `/icon`, kể cả `/u/icon` (username hợp lệ) | neo vào ba route ảnh có thật (`find` xác nhận chỉ có 3) |
| 9 | `/m/abc-1/` và `/m/abc-1` ra hai hàng ⇒ một lượt xem đếm thành hai | `rstrip("/") or "/"` |

### 10.5 · Thử phá — 7 lượt, tất cả ĐỎ đúng bài

| Phá | Bài đỏ |
|---|---|
| bỏ `MANG_BI_MAT` | "mọi URL mang `{key}` đều KHÔNG được đếm" |
| middleware quên gọi `nenDemRequest` | "middleware GỌI `nenDemRequest`" |
| regex ảnh bỏ neo cha | "regex ảnh KHÔNG nuốt trang thật kết thúc bằng `/icon`" |
| bỏ `rstrip("/")` | "dấu gạch cuối KHÔNG đẻ ra dòng thứ hai" |
| `top_bot` về hằng 90 ngày | "top_bot theo ĐÚNG khoảng đang xem" |
| `tat_ca` về "riêng hôm nay" | "tat_ca TỰ LÀNH khi `gom_luot_xem` chưa chạy" |
| bỏ ngưỡng gộp | "đường dẫn lẻ tẻ gom vào MỘT hàng và TỔNG không đổi" |

Sau mỗi lần vá đều **grep lại nội dung** trước khi kết luận — bẫy CRLF của lượt trước.
Một lượt (`P3`) mẫu lọc sai làm Playwright không chọn đúng bài; đã làm lại với mẫu khác
và nó đỏ đúng ba dòng.

### 10.6 · Số đo cuối

`pnpm test` **1600 passed / 16 skipped / 0 warning** (nền 1504 → +92 của chặng 2, +4 của
chặng 5) · `pnpm build` **exit 0, 0 warning**, `ƒ Middleware 36.3 kB` · `lint` exit 0 ·
`tsc` web 0 / admin 0 · `codegen:check` khớp · `e2e:don-vi` **373 passed**, vẫn đúng **1**
bài đỏ có sẵn (`trang-loi.spec.ts` #14, từ `516e973`).

### 10.7 · Còn treo

- **⚠ Cửa đếm KHÔNG chạy được với `pnpm api:dev` — giới hạn của `runserver`, không phải
  lỗi prod.** Phát hiện khi chạy thử end-to-end lần đầu (2026-08-27, sau nghiệm thu).

  Log Django khi Next phục vụ trang:

  ```
  Bad request syntax ('2c')      ← '2c','69','2f','30' là ĐỘ DÀI CHUNK dạng hex
  POST /api/v1/dem-luot-xem 400
  ```

  Đo lại tách bạch bằng `curl`: thân có `Content-Length` ⇒ **200 và ghi được hàng**; thêm
  `Transfer-Encoding: chunked` ⇒ **400**. Next gửi thân theo lối chunked, mà `runserver`
  dựng trên `wsgiref` **không đọc được thân chunked**.

  **Prod không dính**: `deploy/prod/api.Dockerfile` chạy **gunicorn**, và gunicorn đọc
  chunked bình thường.

  Hệ quả cần biết: ở máy dev, bật `DEM_LUOT_XEM_SECRET` chỉ làm mỗi lượt tải trang bắn một
  POST chắc chắn 400, và `.catch(() => {})` nuốt sạch — trang `/luot-xem` vẫn đứng ở 0.
  Vì vậy **đừng đặt biến ấy trong `api/.env`** cho tới khi chọn một trong hai lối ở dưới.

  Hai lối, **cần user quyết** (chưa làm):
  1. **Bỏ thân request**: chuyển `duong_dan`/`user_agent` sang query string + header, POST
     không body ⇒ không có gì để chunk ⇒ chạy giống hệt nhau ở dev và prod, và bỏ hẳn phụ
     thuộc vào việc máy chủ có đọc được chunked hay không. Đổi hình dạng API ⇒ codegen +
     sửa bài đo nhóm G.
  2. **Chấp nhận**: ghi vào tài liệu rằng cửa đếm chỉ đo được ở prod. Rẻ, nhưng nghĩa là
     đường nối này **không bao giờ** được chạy thử ở dev — đúng khoảng trống mà nghiệm thu
     đã nêu, chỉ nay biết chắc là nó không lấp được bằng cách hiện tại.

- **Chưa có bài đo end-to-end** cho đường nối thật Next → Django. Hai đầu chỉ khớp nhau
  qua bài đọc-file so chuỗi. `pnpm e2e` ghi vào `gikky_dev` nên không chạy được ở đây, và
  theo mục trên thì nó cũng sẽ 400 với `runserver`.
- **`PLAN.md` mục 7 chưa có dòng `POST /dem-luot-xem`** — cố ý không đụng, phiên khác đang
  sửa file đó.
- **`0023` phụ thuộc `0022_alter_reaction_emoji`, file UNTRACKED của phiên khác.** Ràng
  buộc thứ tự commit: `0022` phải vào trước hoặc cùng lượt, nếu không clone sạch ném
  `NodeNotFoundError` trên **mọi** lệnh Django.
- **Chưa `pnpm api:migrate` trên `gikky_dev`** — migrate ở đó sẽ áp luôn `0021`/`0022` của
  phiên khác. Để user quyết thời điểm.
