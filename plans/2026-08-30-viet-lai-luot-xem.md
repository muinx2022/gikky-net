# Viết lại thống kê lượt xem — khách/ngày · nguồn · nhóm bot · trình duyệt/thiết bị

Chốt 2026-08-30. User chê trang `/luot-xem` "sơ sài", muốn **nhận diện người / bot / lượt xem
tốt hơn**, và **không nhúng dịch vụ ngoài** (không GoatCounter, không Google Analytics).
User đã gật CẢ BỐN khối qua AskUserQuestion:

1. **Khách duy nhất theo ngày** — lối GoatCounter: `hash(muối-ngày ‖ IP ‖ UA)`. ⚠ Đây là
   NỚI quyết định cũ "không khách duy nhất" (plan 2026-08-27), user đã gật tường minh.
   Ba chốt cũ **vẫn giữ nguyên**: không cookie · không lưu IP thô · không theo dõi được
   qua ngày (muối đổi mỗi ngày và bị **huỷ** khi ngày đóng).
2. **Nguồn truy cập (Referer)** — chỉ lưu **tên miền**, không lưu URL đầy đủ.
3. **Phân loại bot sâu hơn** — chia nhóm + mở rộng bảng nhận diện + bắt UA rỗng (đã có).
4. **Trình duyệt / thiết bị** — tách từ UA lúc ghi, chỉ cho lượt người.

Nền tảng đã có (KHÔNG làm lại): `core/models/luot_xem.py` (`LuotXem`, `TongNgay`) ·
`core/bot.py` · `api/api/dem_luot_xem.py` · `api/api/quan_tri_luot_xem.py` ·
`core/management/commands/gom_luot_xem.py` · `apps/web/middleware.ts` +
`lib/dem-luot-xem.ts` · trang `apps/admin/app/luot-xem/page.tsx`. Lỗi thân chunked prod đã
vá (`config/wsgi.py::DocThanChunked`, commit 8e8a953).

## 0 · Bất biến riêng tư — mỗi cái một bài đo, không chỉ là chữ

1. **Không cột IP, không cột UA thô** — bài đo ghim ĐÚNG TẬP tên cột của `LuotXem`
   (so `set` với danh sách kỳ vọng; thêm một cột lạ là đỏ).
2. **Muối ngày bị huỷ khi ngày đóng** — `gom_luot_xem` xoá mọi `MuoiNgay.ngay < hôm nay`;
   bài đo chạy gom rồi đếm bảng muối.
3. **`nguon` chỉ là tên miền** — referer từ trang mang khoá bí mật
   (`/dat-lai-mat-khau/{key}`) vào DB chỉ còn tên miền của chính site ⇒ thành `""`;
   bài đo đưa referer chứa key và soi giá trị lưu.
4. **UA vẫn dùng-rồi-vứt**: các cột mới (`khach`, `trinh_duyet`, `thiet_bi`, `ten_bot`)
   đều là **dẫn xuất**, không tái tạo được UA/IP từ chúng.

## 1 · Dữ liệu

### 1.1 · `LuotXem` — thêm 4 cột dẫn xuất (migration additive, default `""`)

| Cột | Kiểu | Nghĩa |
|---|---|---|
| `khach` | `CharField(32, blank, default="")` | `sha256(f"{muoi}\|{ip}\|{ua}").hexdigest()[:32]`. `""` khi **cả** IP lẫn UA rỗng ("không đo được", KHÔNG phải "một khách chung") |
| `nguon` | `CharField(100, blank, default="")` | tên miền referer NGOÀI site, lowercase, bỏ `www.` đầu, cắt 100. `""` = trực tiếp / nội bộ / rác |
| `trinh_duyet` | `CharField(20, blank, default="")` | khoá ascii: `chrome·safari·firefox·edge·opera·samsung·coccoc·khac`; `""` khi là bot |
| `thiet_bi` | `CharField(10, blank, default="")` | `di_dong` · `may_tinh`; `""` khi là bot |

Hàng cũ giữ `""` hết — nghĩa là "chưa đo", KHÔNG backfill (UA đã vứt, đúng thiết kế).
**Không thêm cột `nhom_bot`**: nhóm suy được từ `ten_bot` bằng hàm thuần lúc ĐỌC
(mục 2.1) — thêm cột là thêm một bản sao có thể lệch.

### 1.2 · `MuoiNgay` — muối cho hash khách, sống ĐÚNG một ngày

`ngay = DateField(unique=True)` · `muoi = CharField(64)` (`secrets.token_hex(32)`).
- Ingest `get_or_create` theo `ngay_vn()`; đua giữa 2 worker thì bắt `IntegrityError`
  rồi get lại. **Cache tiến trình** `dict {ngay: muoi}` chỉ giữ ngày hiện tại (đổi ngày
  thì thay cả dict) — đường ghi nóng nhất site không được cộng thêm 1 query/hit sau warm.
- Muối cũ bị huỷ ở **HAI** chỗ *(chặng 5, sau phản biện)*: (a) đường ghi — lượt
  cache-miss đầu tiên của ngày mới xoá mọi `ngay < hôm nay`, để cam kết riêng tư không
  treo trên một cron mà runbook mô tả "chết thì không thấy gì sai"; (b) `gom_luot_xem`
  xoá vô điều kiện — lưới thứ hai, và là lưới duy nhất cho ngày không có lượt xem nào.
  Huỷ muối = hash cũ thành token mờ vĩnh viễn, không dựng lại được.

### 1.3 · `KhachNgay` — khách/ngày của ngày ĐÃ XONG, giữ mãi

`ngay = DateField(unique=True)` · `so_khach = PositiveIntegerField()`.
- KHÔNG nhét vào `TongNgay`: khoá của bảng ấy là `(ngay, duong_dan)`, mà khách không
  phân rã được theo đường dẫn (một người xem 5 trang vẫn là 1 khách) — cộng theo hàng là
  đếm trùng có hệ thống.
- `gom()` ghi trong CÙNG transaction với `TongNgay`: `so_khach = COUNT(DISTINCT khach)`
  của hàng người (`la_bot=False`, `khach != ""`) từng ngày đã xong. Ngày có **bất kỳ**
  hàng người nào `khach=""` (hàng cũ trước migration) ⇒ **không ghi hàng** — vắng mặt
  nghĩa là "không đo được", để chuỗi ngày trả `None` chứ không trả một con số giả.
  *(Chặng 5 siết từ "mọi hàng đều rỗng" thành "bất kỳ hàng nào rỗng": ngày chuyển tiếp
  deploy-giữa-ngày mà ghi "phần đo được" là chôn vĩnh viễn một số thấp hơn thật không
  phân biệt được với ngày đo đủ — phản biện 2026-08-30.)* Ngày chỉ có bot ⇒ ghi 0.
  Đường đọc (`_khach_tho`) dùng CÙNG luật.
- Idempotent như `TongNgay` (`update_or_create` theo `ngay`); chạy lại sau khi hàng thô đã
  dọn thì ngày ấy vắng mặt trong nhóm gộp ⇒ **không bị ghi đè về 0** (cùng cơ chế cũ).

## 2 · Nhận diện — toàn hàm thuần, `pytest` chấm được

### 2.1 · `core/bot.py` — nhóm + mở rộng bảng

- `BANG_BOT` đổi thành `tuple[tuple[str, str], ...]` = `(chuỗi khớp, nhóm)`. **Giữ nguyên
  thứ tự các mục cũ** (kể cả chốt `telegrambot` trước `twitterbot`) và giữ hợp đồng "tên
  trả về = chính chuỗi khớp". Nhóm — khoá ascii: `tim_kiem` · `xem_truoc` (unfurl
  Facebook/Telegram/Twitter/Slack/Discord…) · `ai` · `seo` · `giam_sat` · `khac`.
- Hàm mới `nhom_bot(ten: str) -> str`: tên trong bảng → nhóm của nó; `"khác"` (KHAC) và
  tên lạ → `"khac"`. Dùng ở đường ĐỌC (mục 4), nên hàng cũ tự có nhóm.
- Mở rộng bảng (mỗi dòng tự nhận ra chính mình — bài đo hiện có quét cả bảng): tối thiểu
  thêm `googleother`, `google-inspectiontool`, `bingpreview`, `linkedinbot`, `whatsapp`,
  `pinterestbot`, `ccbot`, `meta-externalagent`, `diffbot`, `dataforseobot`, `seznambot`.
  `DAU_HIEU_CHUNG` thêm: `go-http-client`, `okhttp`, `node-fetch`, `axios/`, `java/`,
  `libwww`, `httpclient`, `scrapy`, `aiohttp`, `phantomjs`, `selenium`, `puppeteer`.
- ⚠ **CẤM thêm chuỗi `zalo` trần**: trình duyệt in-app của Zalo (người THẬT, đông ở VN)
  mang chuỗi ấy — thêm là đổ cả khối người dùng VN vào cột bot. Ghi comment ngay tại bảng.

### 2.2 · `core/nhan_dien_ua.py` (MỚI) — trình duyệt + thiết bị

Hai hàm thuần `trinh_duyet(ua) -> str`, `thiet_bi(ua) -> str` (chỉ gọi khi KHÔNG phải bot).

- Thứ tự khớp trình duyệt — **cụ thể trước, chung sau**, vì UA lồng nhau: Edge chứa
  `Chrome` lẫn `Safari`, Chrome chứa `Safari`, Cốc Cốc / Samsung / Opera đều chứa `Chrome`:
  `coccoc` → `samsungbrowser` → `edg` (phủ `edg/`, `edga`, `edgios`) → `opr/`+`opera` →
  `firefox`+`fxios` → `chrome`+`crios` → `safari` → `khac`. UA rỗng không tới được đây
  (đã là bot `khác`).
- `thiet_bi`: `di_dong` nếu UA chứa `mobi` · `iphone` · `ipad` · `android`; còn lại
  `may_tinh`. Thô nhưng tất định; đây là suy đoán và trang nói ra (mục 5).

### 2.3 · Nguồn — trong `api/api/dem_luot_xem.py`

`chuan_hoa_nguon(referer: str) -> str`: `urlsplit` → `hostname` → lower → bỏ `www.` đầu
→ cắt 100. Trả `""` khi: parse hỏng / không có hostname / hostname thuộc **tập host của
chính site** — `settings.HEADLESS_FRONTEND_URLS` (đúng nguồn mà chuông đường-bí-mật đang
đọc) **∪ `settings.ADMIN_HOSTS`** *(chặng 5: mod bấm link từ khu quản trị sang site là
điều hướng nội bộ, không phải một nguồn — phản biện 2026-08-30; mục `ADMIN_HOSTS` dạng
`host[:port]` nên cắt port trước khi so)*.

## 3 · Đường ghi

### 3.1 · `DemLuotXemIn` thêm 2 trường, **backward-compatible bắt buộc**

`ip: str = ""` · `referer: str = ""`. Prod đang chạy middleware CŨ gửi 2 trường — trong
cửa sổ deploy lệch, Django mới nhận body cũ phải **200 và vẫn ghi** (khach suy từ UA-only).
Có bài đo ghim đúng ca này.

Ghi một hàng nay thành: `khach` (mục 1.2, cache muối) · `nguon` · nếu là người thì
`trinh_duyet`/`thiet_bi`, là bot thì hai cột ấy `""`. IP **chỉ transit** — không log,
không lưu.

### 3.2 · `apps/web/middleware.ts` + `lib/dem-luot-xem.ts`

- Thêm helper `ipKhach(req)` vào `lib/dem-luot-xem.ts`. ⚠ **Bản plan đầu viết "XFF lấy
  phần tử đầu" — SAI, phản biện 2026-08-30 chứng minh phần tử đầu là thứ client tự khai:
  một vòng `curl -H "X-Forwarded-For: 9.9.$i.$j"` bơm vô hạn "khách" vĩnh viễn, không
  cần secret.** Luật chốt ở chặng 5, cùng chiều với `core/han_muc.py::dia_chi_ip`:
  `cf-connecting-ip` (Cloudflare ghi đè ở biên) → `x-forwarded-for` **phần tử CUỐI**
  (peer mà Caddy thật sự thấy; thiếu CF-header thì ra IP biên Cloudflare = đếm THIẾU,
  chiều hỏng an toàn) → `""` (dev: hash rơi về UA-only). Không có fallback `x-real-ip` —
  không Caddyfile nào của `deploy/` đặt nó, một nhánh chết chỉ nuôi bài đo giả.
- Body gọi `demLuotXem` thêm `ip: ipKhach(req)`, `referer: req.headers.get("referer") ?? ""`.
- KHÔNG đụng `matcher`, `nenDem`, `nenDemRequest`, `nenRewrite`, cơ chế `waitUntil`.
- `e2e/don-vi/dem-luot-xem.spec.ts` cập nhật nếu nó ghim hình dạng body; các chốt
  header/R3 giữ nguyên.

## 4 · Đường đọc — `GET /admin/luot-xem` (breaking có chủ đích, một consumer duy nhất)

`LuotXemOut` đổi:

| Trường | Đổi gì |
|---|---|
| `tong` | thêm `so_khach: int` = Σ các ô khách khác `None` trong khoảng |
| `chuoi_ngay[]` | thêm `so_khach: int \| None` — `None` = ngày không đo được (trước tính năng / thô đã dọn mà `KhachNgay` vắng) |
| `top_bot[]` | thêm `nhom: str` (map `nhom_bot(ten)` lúc đọc) |
| MỚI `theo_nhom_bot` | `list[{nhom, so_luot}]` — gộp từ hàng thô bot trong khoảng |
| MỚI `top_nguon` | `list[{nguon, so_luot}]` top 20, chỉ hàng NGƯỜI có `nguon != ""` |
| MỚI `so_truc_tiep` | `int` — hàng người `nguon == ""` (trực tiếp/nội bộ gộp một) |
| MỚI `trinh_duyet` | `list[{ten, so_luot}]` — người, `trinh_duyet != ""`, sắp giảm dần |
| MỚI `thiet_bi` | `list[{ten, so_luot}]` — như trên |
| `bot_chi_90_ngay` | **ĐỔI TÊN** thành `chi_tiet_chi_90_ngay` — nay phủ cả 5 khối từ hàng thô (`top_bot`, `theo_nhom_bot`, `top_nguon`+`so_truc_tiep`, `trinh_duyet`, `thiet_bi`); ngữ nghĩa giữ nguyên (`True` ⇔ `khoang=tat_ca`) |

Nguồn khách theo ngày: `7/30/90` → một query distinct-theo-ngày trên hàng thô
(`Count("khach", distinct=True, filter=Q(la_bot=False) & ~Q(khach=""))`); ô `None` khi
ngày có hàng người mà distinct = 0. `tat_ca` → `KhachNgay` cho phần đã gộp + distinct thô
cho phần **sau `max(TongNgay.ngay)`** (CÙNG ranh giới tự-lành đang dùng — `KhachNgay` ghi
cùng transaction với `TongNgay` nên hai bảng không lệch nhau); ngày vắng ⇒ `None`.

Bốn con số lớn vẫn KHÔNG suy từ biểu đồ (chốt cũ giữ nguyên).

## 5 · Trang `/luot-xem` — bố cục mới

1. **5 ô số**: Tổng lượt · Lượt người · Khách (chú "≈, cộng theo ngày") · Lượt bot · % bot.
2. **Biểu đồ theo ngày** (`CotNhom` sẵn có): ba chuỗi Người · Khách · Bot; ô khách `None`
   vẽ 0 nhưng chú thích ngay dưới biểu đồ nói "khách chỉ đo từ ngày bật cơ chế".
3. **Lưới các khối**: Xem nhiều nhất (giữ) · Nguồn truy cập (top miền + dòng đầu
   "(trực tiếp / nội bộ)" từ `so_truc_tiep`) · Bot theo nhóm (bảng nhỏ 6 dòng, nhãn Việt:
   Tìm kiếm / Xem trước link / Bot AI / SEO / Giám sát / Khác) · Top bot (thêm cột Nhóm) ·
   Trình duyệt · Thiết bị (nhãn: Di động / Máy tính).
4. **Dòng giới hạn** viết lại — BA giới hạn: bot là suy đoán theo UA; **khách là ước
   lượng theo ngày** (muối đổi mỗi ngày — một người ghé hai ngày đếm là hai khách, và đó
   là cái giá của việc không theo dõi ai); cờ `chi_tiet_chi_90_ngay` ⇒ các bảng chi tiết
   chỉ phủ 90 ngày.

Luật đang áp: gọi thẳng tên hàm + `baseUrl` từng lời gọi (`type-admin.spec`) · không màu
ứng biến (`quan-tri-giao-dien.spec`) · nhãn/khoá map trong page, không bịa interface trùng
API. Menu KHÔNG đổi.

## 6 · Việc kéo theo

- `pnpm codegen` (client admin đổi shape) — `packages/api-client` là file sinh, không sửa tay.
- `PLAN.md` mục 7: cập nhật dòng `POST /dem-luot-xem` (thân 4 trường, 2 trường mới
  optional) và dòng `GET /admin/luot-xem` (các khối mới + tên cờ mới) — đúng luật "đổi
  endpoint thì cập nhật bảng".
- Migration mới trong `api/core/migrations/` — additive; **KHÔNG chạy `pnpm api:migrate`
  trên `gikky_dev`** trong lượt này (DB thật — user quyết thời điểm, cùng tiền lệ 10.7 cũ).

## 7 · Tiêu chí nghiệm thu — ĐO ĐƯỢC

Nền trước lượt: **pytest 1629 bài** · **e2e don-vi 376 bài / 36 file** (đo 2026-08-30 trên
cây chính, worktree ≈ HEAD trừ `apps/web/components/form-tai-khoan.module.css` của phiên
khác — CẤM đụng file đó).

| # | Tiêu chí | Đo bằng |
|---|---|---|
| N1 | `pnpm test` xanh 100%, tổng ≥ 1659 (nền + ≥30 bài mới), 0 warning | chạy lại, đọc tổng |
| N2 | Bất biến riêng tư: 4 bài của mục 0 tồn tại và xanh | `pytest -k` từng bài |
| N3 | Hash khách: cùng ngày+IP+UA ⇒ cùng hash; khác ngày ⇒ khác hash; IP+UA đều rỗng ⇒ `""` | bài đo nhóm K |
| N4 | Gom: `KhachNgay` đúng distinct, idempotent, không ghi đè về 0 sau khi thô dọn, muối ngày cũ bị xoá | bài đo nhóm G |
| N5 | Body CŨ 2 trường ⇒ 200 + hàng vẫn ghi (khach từ UA-only) | bài đo tương thích |
| N6 | Ma trận trình duyệt ≥ 10 UA thật (Edge≠Chrome, CriOS=chrome, Cốc Cốc, Samsung, FxiOS…) + ma trận thiết bị ≥ 6 | bài đo nhóm U |
| N7 | `nhom_bot`: MỌI tên trong `BANG_BOT` có nhóm hợp lệ; `khác`/tên lạ → `khac`; bảng ≥ 30 mục, mỗi mục tự nhận ra mình; KHÔNG có mục `zalo` trần | bài đo nhóm B |
| N8 | Endpoint đọc: đủ trường mới ở cả 4 khoảng; `chuoi_ngay.so_khach=None` đúng ca "có người mà không đo được"; `top_nguon` không lẫn hàng bot, không lẫn `""`; cờ mới đúng ngữ nghĩa cũ | bài đo nhóm Đ |
| N9 | `pnpm codegen` exit 0 · `pnpm codegen:check` sạch · không còn chuỗi `bot_chi_90_ngay` trong `apps/` | chạy + grep |
| N10 | `pnpm lint` 0 warning · `pnpm build` xanh cả 2 app | chạy lại |
| N11 | `pnpm e2e:don-vi` xanh, ≥ 376 bài | chạy lại (đúng lệnh này, KHÔNG `--`, KHÔNG `--project`) |
| N12 | Thử phá ≥ 4 (mục 8) — mỗi ca nêu rõ đã bẻ gì, bài nào ĐỎ, đã khôi phục | đọc báo cáo + soi test |
| N13 | `PLAN.md` mục 7 đã cập nhật 2 dòng endpoint | đọc diff |

## 8 · Thử phá bắt buộc (luật 4 — test mới phải từng ĐỎ)

1. Đảo `edg` xuống sau `chrome` trong `nhan_dien_ua.py` ⇒ bài Edge phải ĐỎ.
2. Bỏ bước xoá `MuoiNgay` trong gom ⇒ bài "muối ngày cũ bị huỷ" phải ĐỎ.
3. Hash bỏ muối (chỉ IP+UA) ⇒ bài "khác ngày khác hash" phải ĐỎ.
4. `top_nguon` quên lọc `la_bot=False` ⇒ bài nguồn phải ĐỎ.
5. `KhachNgay` đổi sang ghi cả ngày mọi-khach-rỗng với 0 ⇒ bài "None chứ không 0 giả" phải ĐỎ.

## 9 · Ràng buộc tài nguyên (chặng 3 ∥ chặng 4)

- `nghiem-thu`: ĐƯỢC chạy `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm codegen:check`,
  `pnpm e2e:don-vi` — **một bộ một thời điểm**.
- `phan-bien`: CHỈ đọc code + chạy Python thuần không chạm DB (import module, gọi hàm
  thuần). **CẤM `pnpm test`** (pytest hai phiên tranh nhau `test_gikky_dev`), cấm build,
  cấm e2e.
- CẢ HAI: cấm `pnpm e2e` trần (ghi vào `gikky_dev` — DB có dữ liệu thật), cấm migrate
  `gikky_dev`, cấm đụng `apps/web/components/form-tai-khoan.module.css`.

## 10 · KHÔNG làm trong lượt này

- Không GeoIP / quốc gia (cần DB MaxMind ngoài — trái đề bài "không dịch vụ ngoài"… và
  chưa ai hỏi).
- Không đếm phía trình duyệt (JS beacon), không cookie, không fingerprint thêm chiều.
- Không sửa hai món treo cũ của 10.7 (dev không đo được đường thật vì `runserver`/wsgiref;
  thiếu e2e end-to-end thật) — vẫn treo, nhắc lại ở báo cáo.
- Không chuyển `apps/web` sang Tailwind, không đổi menu admin.

## 11 · Nhật ký thực hiện

### 2026-08-30 · `opus-dev` (cây chính, không worktree)

**Nền đã kiểm trước khi sửa:** `pytest --collect-only -q` = **1629** bài (khớp plan);
`git status` không có sửa đổi cục bộ nào ở `apps/web/app/luat/`, `core/bot.py`,
`api/api/dem_luot_xem.py`, `api/api/quan_tri_luot_xem.py`,
`core/management/commands/gom_luot_xem.py`, `apps/web/middleware.ts`,
`apps/admin/app/luot-xem/page.tsx`.

**Đã làm** — theo đúng trình tự plan:

1. `core/models/luot_xem.py`: 4 cột dẫn xuất trên `LuotXem` + hai model `MuoiNgay`,
   `KhachNgay`; migration `0024_khachngay_muoingay_luotxem_khach_luotxem_nguon_and_more.py`
   (thuần additive; **KHÔNG** chạy `pnpm api:migrate` trên `gikky_dev`).
2. `core/bot.py`: `BANG_BOT` → `tuple[tuple[str, str], ...]`, **thứ tự tương đối của 25
   mục cũ giữ nguyên** (có bài đo `test_B5b` ghim), thêm 11 mục + 12 dấu hiệu chung, hàm
   `nhom_bot()`, sáu hằng nhóm + `NHOM_HOP_LE`. `_NHOM_THEO_TEN` dựng **từ** `BANG_BOT`,
   không gõ lại.
3. `core/nhan_dien_ua.py` (MỚI): `trinh_duyet()` + `thiet_bi()`, bảng khớp theo thứ tự.
4. `api/api/dem_luot_xem.py`: thân 4 trường (3 optional), `chuan_hoa_nguon()`,
   `muoi_cua_ngay()` + cache tiến trình + `xoa_cache_muoi()`, `hash_khach()`.
   `tests/conftest.py` thêm fixture autouse dọn cache muối.
5. `gom_luot_xem.py`: `_khach_moi_ngay()` + ghi `KhachNgay` **trong cùng transaction** với
   `TongNgay`; huỷ `MuoiNgay.ngay < hôm nay` vô điều kiện.
6. `quan_tri_schemas.py` + `quan_tri_luot_xem.py`: 5 khối mới, `so_khach` ba trạng thái,
   `bot_chi_90_ngay` → `chi_tiet_chi_90_ngay`, `SO_NGAY_BOT` → `SO_NGAY_CHI_TIET`.
7. `pnpm codegen` → `pnpm codegen:check` **khớp, 34 file không đổi**.
8. `apps/web/lib/dem-luot-xem.ts::ipKhach()` + middleware gửi `ip`/`referer`;
   `e2e/don-vi/dem-luot-xem.spec.ts` thêm 5 bài (X1, X1b, X1c, X2, X3).
9. `apps/admin/app/luot-xem/page.tsx` viết lại theo §5 (5 ô số · 3 chuỗi biểu đồ · 6 khối ·
   3 dòng giới hạn).
10. `PLAN.md` mục 7: cập nhật cả hai dòng endpoint.

**Số đo thật:** pytest **1779 thu / 1763 pass / 16 skip / 0 fail / 0 warning**
(nền 1629 ⇒ **+150 bài**); nhóm lượt xem 245/245 xanh. e2e don-vi **381 bài** (376 nền +
5 mới), 380 pass. `pnpm lint` 0 warning, `pnpm build` xanh cả hai app,
`pnpm codegen:check` sạch (34 file không đổi).

**Một điểm ĐỎ đã có sẵn ở HEAD, KHÔNG do lượt này:**
`e2e/don-vi/trang-loi.spec.ts::#14` — `apps/web/app/luat/page.tsx:14` có
`export const dynamic = "force-dynamic"` mà hàng rào cấm. `git diff HEAD` trên **cả hai**
file ấy rỗng, tức chúng đúng bằng HEAD.

**Một bài đo CHẬP CHỜN, cũng không do lượt này:**
`tests/test_api_theo_sub.py::test_me_subs_moi_theo_dung_truoc` đỏ ở lượt chạy đầu (khi
chạy song song với việc khác), xanh ở lượt chạy thứ hai và khi chạy riêng. Nguyên nhân:
hai hàng `TheoSub` trùng `created_at` vì đồng hồ Windows ~15 ms, mà thứ tự là
`-created_at` ⇒ hoà điểm ⇒ thứ tự tuỳ ý. Không liên quan `LuotXem`.

**Ba chỗ LỆCH plan, cả ba có lý do:**

- `nhan_dien_ua.py` khớp Cốc Cốc bằng **`coc_coc_browser` lẫn `coccoc`** — plan chỉ ghi
  `coccoc`, nhưng UA thật dùng token `coc_coc_browser`, nên chỉ khớp `coccoc` là cột Cốc
  Cốc vĩnh viễn bằng 0. N6 đòi UA thật, và UA thật là thứ quyết định.
- `hash_khach` **không** hứa dấu `|` chống va chạm. Bài đo bản đầu khẳng định ngược lại và
  **đỏ ngay** (`("1.2","3|4")` = `("1.2|3","4")`). Giữ đúng công thức plan chốt, sửa
  docstring cho thật, và `test_K1e` nay ghim đúng cái hàm **không** hứa.
- Trang admin: bản cũ lồng `<table>` trong `<table>` của `KhungBang` (HTML không hợp lệ).
  Lượt viết lại dùng đúng khuôn `KhungBang > HangTieuDe + tbody` như các trang khác;
  `data-testid` chuyển từ `<table>` sang `<tbody>`, không consumer nào đọc chúng.

**Thử phá (§8) — 5/5 ca đều ĐỎ rồi khôi phục:**

| Ca | Bẻ gì | Bài ĐỎ |
|---|---|---|
| 8.1 | `("edge", ("edg",))` chuyển xuống sau `("chrome", …)` | `test_U1[…Edg/131…]`, `test_U1[…EdgA/131…]`, `test_U1c_edge_va_coccoc_KHONG_ra_cung_ket_qua_voi_chrome` (3 đỏ) |
| 8.2 | Bỏ `MuoiNgay.objects.filter(ngay__lt=hom_nay).delete()` | `test_G_MUOI_cua_ngay_da_dong_bi_HUY`, `test_G_muoi_bi_HUY_ke_ca_khi_khong_co_hang_tho_nao` (2 đỏ) |
| 8.3 | `hash_khach` băm `f"{ip}\|{ua}"` (bỏ muối) | `test_K1b_KHAC_NGAY_thi_khac_hash_du_ip_va_ua_y_het` |
| 8.4 | `_top_nguon` dùng `_tho_tu` thay `_nguoi_tu` (mất lọc `la_bot=False`) | `test_D2_top_nguon_KHONG_lan_hang_bot` |
| 8.5 | `_khach_moi_ngay` bỏ điều kiện ⇒ ghi 0 cho ngày mọi `khach` rỗng | `test_G_ngay_MOI_khach_RONG_thi_KHONG_ghi_hang` |

Sau mỗi ca: khôi phục file, chạy lại 245 bài nhóm lượt xem — xanh hết.

### 11.2 · Chặng 5 — phiên chính chốt việc (2026-08-30)

Nghiệm thu: **12/13 ĐẠT, 1 đạt một phần** (N11: 380/381 — bài đỏ duy nhất là mâu thuẫn
`/luat` ↔ hàng rào #14 CÓ SẴN Ở HEAD, xác minh bằng `git show HEAD:`, ghi sổ
`P-20260830-1`). Phản biện ra 6 phát hiện; phiên chính sửa 5, ghi sổ 1:

| Phát hiện | Xử lý |
|---|---|
| **CHẶN** — `ipKhach` lấy XFF **phần tử đầu** (client tự khai): bơm được vô hạn "khách" vĩnh viễn vào `KhachNgay` bằng `curl -H "X-Forwarded-For: …"`, không cần secret; bài X1 cũ còn ghim đúng hành vi sai | **SỬA**: `cf-connecting-ip` (Cloudflare ghi đè ở biên) → XFF **phần tử CUỐI** (cùng luật `core/han_muc.py::dia_chi_ip`) → `""`; gỡ nhánh chết `x-real-ip` (không Caddyfile nào đặt). Viết lại X1/X1b/X1c. Thiếu CF-header thì ra IP biên Cloudflare = đếm THIẾU — chiều hỏng an toàn. |
| **NẶNG** — "muối bị huỷ khi ngày đóng" treo trên MỖI cron, mà runbook mô tả cron chết là "không thấy gì sai"; cron chết 30 ngày = 30 muối sống = nối được người qua ngày nếu DB bị đọc | **SỬA**: đường ghi tự huỷ muối cũ ở lượt cache-miss đầu của ngày mới (`muoi_cua_ngay`); cron còn vai trò lưới thứ hai. Bài mới `test_K2d`. Runbook `deploy/prod/README.md` thêm hậu quả thứ ba (riêng tư). |
| **VỪA** — ngày CHUYỂN TIẾP (deploy giữa ngày, lẫn hàng cũ `khach=""`) bị ghi "phần đo được" vào bảng giữ-mãi như thể đo đủ | **SỬA**: có BẤT KỲ hàng người nào thiếu token ⇒ không ghi / trả `None`, cùng luật ở cả `_khach_moi_ngay` lẫn `_khach_tho`. Lật bài gom cũ thành `test_G_ngay_CHUYEN_TIEP…`, thêm `test_D1g`, sửa `test_G_lenh_day_du…` (hàng có khách chuyển sang ngày sạch). |
| **NHẸ** — `admin.gikky.net` không bị loại khỏi "Nguồn truy cập" (mod bấm link từ admin thành "nguồn ngoài") | **SỬA**: `_host_cua_site` = `HEADLESS_FRONTEND_URLS` ∪ `ADMIN_HOSTS` (cắt port). Bài mới `test_K3c2`; `test_K3c` override thêm `ADMIN_HOSTS` (mặc định dev chứa `localhost`). |
| **NHẸ** — thẻ Nguồn rỗng hiện đồng thời bảng "(trực tiếp) 0" VÀ khối "chưa có lượt nào" | **SỬA**: rỗng thật thì chỉ `KhoiRong`, có dữ liệu mới render bảng. |
| **VỪA (nghi ngờ)** — ~9 câu aggregate seq-scan mỗi lượt bấm trang, 4 cột mới không index | **GHI SỔ** `P-20260830-3` — cần `EXPLAIN ANALYZE` trên dữ liệu thật trước khi quyết thêm index. |

Thử phá chặng 5 — **5/5 ĐỎ đúng bài rồi khôi phục**: bỏ DELETE muối ở đường ghi →
`test_K2d` · đảo luật chuyển tiếp phía gom → `test_G_ngay_CHUYEN_TIEP…` · phía đọc →
`test_D1g` · bỏ vòng `ADMIN_HOSTS` → `test_K3c2` · `ipKhach` về `[0]` → `X1b`.

Số đo cuối (sau sửa chặng 5): nhóm lượt xem **248 bài xanh** · `pnpm lint` 0 warning ·
`pnpm build` xanh cả 2 app · `pnpm e2e:don-vi` **381 bài, 380 xanh** (1 đỏ có sẵn ở HEAD,
`P-20260830-1`) · full pytest chạy lại sau sửa — số ghi ở báo cáo. Schema/OpenAPI không
đổi ở chặng 5 ⇒ không cần codegen lại.

Còn treo (không thuộc lượt): migrate `gikky_dev` (user quyết) · `P-20260830-1/2/3/4/5` ·
hai món cũ của plan 2026-08-27 §10.7.
