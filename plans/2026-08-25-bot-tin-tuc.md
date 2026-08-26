# Bot bản tin tự động — u/gikky-team-news — 2026-08-25

## 0. Bối cảnh ĐO ĐƯỢC (khảo sát 2026-08-25, không phải giả định)

- **Tài khoản đã có sẵn.** `api/core/management/commands/tao_tai_khoan_doi.py` dựng
  `gikky-team-news` / display name `gikky · Tin tức`, email
  `gikky-team-news@vi-du.gikky.net`, `EmailAddress(verified=True)`, mật khẩu đọc từ
  `GIKKY_TEAM_NEWS_PASSWORD` trong `api/.env`. **Không dựng tài khoản mới.**
- **Đăng nhập bằng EMAIL, không phải username** — `config/settings.py:257`
  `ACCOUNT_LOGIN_METHODS = {"email"}`. Thân request là `{email, password}`.
- **Hợp đồng HTTP đã có bản tham chiếu**: `apps/web/lib/tai-khoan.ts`.
  `GET /api/_allauth/browser/v1/auth/session` đặt cookie `csrftoken` cho **mọi** phản hồi
  của client `browser` ⇒ mọi POST sau đó cần header `X-CSRFToken` + cookie phiên.
- **Đăng bài**: `POST /api/v1/machs`, thân `MachMoiIn` = `{sub, title, body, occurred_at?,
  loai?, question_for_crowd?, figures?}` (`api/api/schemas_ghi.py:78`). 201 trả
  `MachChiTietOut`. Giới hạn: `title` ≤ **160** (`DAI_TITLE`), `body` ≤ **10.000**
  (`DAI_BODY_MOC`, `core/models/moc.py:19`).
- **Hạn mức 10 mạch/user/ngày lịch VN** (`HAN_MUC_MACH_MOI_USER_NGAY`, mặc định prod = 10).
  3 bài/ngày nằm gọn trong đó; 429 kèm `thu_lai_tu` nếu vượt.
- **`body` là HTML đã allowlist** (`core/lam_sach_html.py`). `<a href>` **được phép** với
  giao thức `http`/`https`/`mailto`; ammonia tự ép `rel="nofollow ugc noopener"` và
  `target="_blank"`. Thẻ dùng được: `p br strong em u s code pre blockquote ul ol li a h2
  h3 hr img`. **`img` chỉ nhận `src` trỏ vào `MEDIA_URL` của chính site** ⇒ bản tin
  **không nhúng ảnh ngoài**, chỉ chữ + link.
- **`gikky.net` hôm nay còn là app Trekky** (`<title>Trekky</title>`, build 2026-08-04);
  `/api/v1/health` → 404. Một phiên khác đang deploy bản này lên đúng domain đó theo
  `plans/2026-08-25-deploy-vps-docker.md` (tiêu chí N3: `/api/v1/health` → 200, N4: HTML
  không còn chữ `Trekky`). **Lượt này KHÔNG chờ nó**, và cũng không đo qua nó.
- **Cây làm việc đang bẩn: 164 file `M`/`??` của phiên khác** (kể cả `api/pyproject.toml`,
  `apps/web/package.json`, cả cụm `api/api/*`). ⇒ Lượt này **chỉ thêm file MỚI**, cộng
  đúng một dòng script vào `package.json` ở **gốc repo** (file này KHÔNG bẩn).

## 1. Quyết định của user (2026-08-25)

| Câu hỏi | Chốt |
|---|---|
| Ai bấm giờ | **Scheduled task của Claude Desktop** (`~/.claude/scheduled-tasks/`), user tự đặt |
| Bao nhiêu bài | **3 bài rời/ngày**, không gộp thành một mạch nhiều mốc |
| Chuyên mục | **Sub `tin-tuc` riêng**, không trộn vào `chung-khoan` |
| Khung "trước khi tin ra 1h" | **Bỏ lịch kinh tế**, thay bằng một khung giờ cố định |
| Đích đăng | **Viết sẵn đủ, KHÔNG cắm lịch hôm nay** — bật sau khi deploy xong |
| Giọng bài | **Chỉ tổng hợp, không đánh giá** |

## 2. Kiến trúc — hai mảnh, ranh giới rõ

```
Claude Desktop scheduled task (máy Windows này)
   │  ① WebSearch/WebFetch gom tin theo khung giờ
   │  ② dựng JSON {sub,title,body} theo mẫu ở §4
   ▼
node scripts/dang-tin.mjs --file <json> --slot <tên> --han-chot HH:MM
   │  ③ GET  /api/_allauth/browser/v1/auth/session   → cookie csrftoken
   │  ④ POST /api/_allauth/browser/v1/auth/login     {email,password}
   │  ⑤ POST /api/v1/machs                            X-CSRFToken + cookie phiên
   ▼
https://gikky.net   (Caddy → Django, sau khi deploy)
```

**Vì sao HTTP chứ không management command:** máy chạy lịch (Windows này) và máy chạy DB
(`vps-muinx`, Postgres **không publish ra host**, xem plan deploy) là hai máy khác nhau.
Đường duy nhất đi được là API công khai.

**Vì sao là một script Node chứ không để Claude tự gọi HTTP mỗi lượt:** ba lượt/ngày ×
mỗi lượt một chuỗi 3 request có CSRF là ba cơ hội để một phiên LLM làm sai một bước khác
nhau. Script cố định hoá hợp đồng, và **nó test được**; phần LLM chỉ còn việc nó làm tốt
— đọc tin và viết chữ.

### Nơi cất bí mật

`scripts/tin-tuc/.env` (mẫu: `.env.example` cạnh nó). Tên file khớp mẫu `.env` đã có
trong `.gitignore` ⇒ **tự động không commit, không phải sửa `.gitignore`**.

```
GIKKY_ORIGIN=https://gikky.net
GIKKY_BOT_EMAIL=gikky-team-news@vi-du.gikky.net
GIKKY_BOT_PASSWORD=<mật khẩu PROD của tài khoản này>
```

⚠ Mật khẩu **prod**, không phải giá trị trong `api/.env` (đó là mật khẩu máy dev). Biến
môi trường thật thắng file, để chạy tay không cần sửa file.

## 3. Ba khung giờ (giờ VN, `Asia/Ho_Chi_Minh` — chuẩn của PLAN mục 1)

| Slot | Sớm nhất | Chạy | Hạn chót | Nội dung |
|---|---|---|---|---|
| `dem-qua` | **05:00** | **06:12** | **07:00** | Phiên Mỹ/EU đêm qua: chỉ số, dầu, vàng, DXY, lợi suất, crypto qua đêm, tin vĩ mô đã công bố |
| `truoc-phien-vn` | **06:30** | **08:07** | **09:00** | Tin trong nước trước giờ mở cửa: chính sách, doanh nghiệp niêm yết, tỷ giá/lãi suất, khối ngoại phiên trước, lịch sự kiện trong ngày |
| `truoc-phien-my` | **16:00** | **19:33** | **21:00** | Tin quốc tế trong ngày: châu Á đóng cửa, futures Mỹ, tin công bố sắp tới trong tối |

> **Cột "Sớm nhất" thêm 2026-08-25 sau lượt phản biện** — bản đầu chỉ có trần. Khung giờ
> **đi kèm slot trong code** (`SLOT` ở `scripts/tin-tuc/lib.mjs`), không phải một cờ dòng
> lệnh tuỳ chọn; `--slot` là **tập đóng ba tên**. Lý do ở §3.1 và §3.3 dưới đây.

Phút lẻ là chủ đích (tránh đỉnh `:00`/`:30`). Cron: `12 6 * * 1-5`, `7 8 * * 1-5`,
`33 19 * * 1-5`.

> **Giả định đã nêu rõ, user lật một câu là đổi:** chạy **T2–T6**. "Trước giờ giao dịch
> VN" vào Chủ nhật không có nghĩa, và một bản tin thị trường cuối tuần chỉ là ba dòng
> nhắc lại thứ Sáu. Muốn cả 7 ngày thì đổi `1-5` → `*` ở cả ba task.

### Ba chế độ hỏng đã biết trước, phải chặn bằng CODE

1. **Task fire trễ.** Scheduled task chỉ chạy khi app đang mở; app đóng lúc 06:12 thì nó
   chạy *lúc mở app*, có thể là 14:00. Bản tin "đêm qua" đăng lúc 14:00 là rác.
   ⇒ trần giờ của slot — quá giờ VN đó thì **bỏ qua, exit 4**, không đăng.
2. **Đăng trùng.** Cùng một slot chạy hai lần trong một ngày VN (fire trễ rồi fire đúng
   giờ, hoặc user bấm chạy tay).
   ⇒ **sổ cái** `scripts/tin-tuc/da-dang.json` ghi `{slot, ngayVN} → url`. Trùng thì
   **exit 3**, không tạo mạch thứ hai. `--ep` để cố tình bỏ qua sổ.

#### 3.1 — Fire bù rơi vào đầu KIA của trục thời gian *(thêm 2026-08-25, lượt phản biện)*

Bản đầu chỉ hỏi *"đã quá hạn chót chưa"*, nên cửa sổ hợp lệ của `dem-qua` là **00:00 →
07:00**, không phải 06:12 → 07:00. Ca tái hiện được:

- máy đóng từ tối, user mở lại **00:20 giờ VN** ⇒ task fire bù ⇒ script **đăng** một bản
  tin "phiên Mỹ/EU đêm qua" viết lúc phiên Mỹ **chưa đóng cửa** (đóng 03:00–04:00 giờ VN);
- sổ cái ghi khoá của **ngày mới** ⇒ bản tin thật lúc 06:12 ăn **exit 3** và biến mất,
  với đúng cái mã mà `README.md` và ba file `lich/*.md` đều dạy người đọc là *"hành vi
  đúng, không phải sự cố cần đi sửa"*. Không ai đi tìm.

⇒ **sàn giờ `som_nhat`**, đặt ở lúc sớm nhất mà dữ liệu của slot đã tồn tại (không phải ở
giờ chạy — chạy tay sớm hơn lịch vài chục phút là việc hợp lệ). Cùng exit 4 với đầu kia,
nhưng **câu lỗi khác nhau**: "quá muộn ⇒ tin ôi" vs "quá sớm ⇒ tin chưa tồn tại".

#### 3.2 — Đăng XONG rồi mới hỏng *(thêm 2026-08-25, lượt phản biện)*

`ghiSoCai(...)` ở bản đầu đứng **trước** dòng in URL và **ngoài** mọi `try`. Sổ ghi hỏng
(`GIKKY_BOT_SO_CAI` trỏ vào thư mục, đĩa đầy, thư mục read-only, tiến trình bị kill giữa
hai dòng) thì: **exit 1 trong khi bài đã đăng thật**, URL — output duy nhất — mất luôn, và
sổ trống nghĩa là **hàng rào chống trùng biến mất**, lượt sau đăng bài thứ hai không cần
`--ep`, không một dòng cảnh báo.

⇒ in URL **trước**, `ghiSoCai` trong `try/catch`, **giữ exit 0**, và stderr nói thẳng
*"ĐÃ ĐĂNG <url> nhưng không ghi được sổ cái — chạy lại hôm nay sẽ đăng TRÙNG"*.

#### 3.3 — `--slot` là khoá của sổ cái, nên nó phải là tập ĐÓNG *(thêm 2026-08-25)*

Parser rất nghiêm với **tên cờ** (`--han-chôt` ⇒ "Tham số lạ") nhưng bản đầu nhận mọi
chuỗi làm **giá trị** của `--slot`. `dem_qua` (gạch dưới) là một khoá sổ cái khác ⇒ hai
bản tin một ngày, exit 0 cả hai lần. Người gõ dòng lệnh này là **một LLM chép từ
`lich/*.md` lúc 6h sáng**, không phải một lập trình viên đọc `--help`; và cùng lối đó,
một `--han-chot` bị quên là một hàng rào không tồn tại.

⇒ `SLOT` là bảng ba tên, mỗi tên mang khung giờ của nó. `--slot` ngoài bảng ⇒ **exit 1**
kèm câu lỗi **liệt kê đủ ba tên đúng**. `--som-nhat`/`--han-chot` còn lại chỉ như cờ ghi
đè cho người chạy tay, và **không xuất hiện trong dòng lệnh mà `lich/*.md` dạy**.

## 4. Luật nội dung — "chỉ tổng hợp", viết thành ràng buộc kiểm được

Đây là phần hồn của việc, nên nó phải nằm **trong prompt của task**, không nằm trong đầu
người viết plan.

**PHẢI:**
- Mỗi mục = *chuyện gì · ai công bố · số liệu · lúc nào* + **link nguồn**.
- Tiếng Việt. Tên riêng/thuật ngữ quốc tế giữ nguyên trong ngoặc khi cần.
- Số liệu chép đúng nguồn, kèm đơn vị và mốc so sánh mà **nguồn** đưa ra.
- 6–12 mục, gom theo nhóm bằng `<h3>`.
- Cuối bài: một dòng ghi rõ đây là bản tin tổng hợp tự động + giờ chốt tin.

**CẤM (bản tin vi phạm ⇒ bỏ, không đăng):**
- Nhận định, dự báo, khuyến nghị mua/bán, giá mục tiêu.
- Tính từ đánh giá: "tích cực", "đáng lo", "bùng nổ", "lao dốc" → thay bằng số.
- Suy diễn nhân quả **không có trong nguồn** ("VN-Index giảm **do** Fed…").
- Số liệu không có link nguồn. Không tìm được nguồn thì **bỏ mục đó**, không ước lượng.
- Kèo/dự đoán dưới mọi hình thức — PLAN mục 4 cấm tuyệt đối trên site trading.

## 5. Hạng mục làm (CHỈ FILE MỚI, trừ một dòng ở `package.json` gốc)

| # | File | Việc |
|---|---|---|
| H1 | `api/core/management/commands/tao_sub.py` | **MỚI.** `tao_sub <slug> --ten … --mo-ta …`, idempotent (`update_or_create`). Dùng để dựng `tin-tuc` trên prod. |
| H2 | `scripts/tin-tuc/lib.mjs` | **MỚI.** Hàm thuần: đọc cấu hình, `ngayVN()`, `quaHanChot()`, `kiemTraBaiViet()` (dài title/body, sub rỗng), đọc/ghi sổ cái. Không I/O mạng ⇒ test được rẻ. |
| H3 | `scripts/dang-tin.mjs` | **MỚI.** CLI: `--file`, `--slot`, `--han-chot`, `--ep`, `--thu` (dry-run, không gọi mạng), `--origin`. Chuỗi 3 request ở §2. In URL mạch ra stdout. |
| H4 | `scripts/tin-tuc/.env.example` | **MỚI.** Ba biến ở §2, kèm cảnh báo "mật khẩu PROD". |
| H5 | `scripts/tin-tuc/lich/*.md` (3 file) | **MỚI.** Prompt đầy đủ của 3 scheduled task — tự đứng một mình, không tham chiếu hội thoại nào. Gồm: khung giờ, nguồn gợi ý, luật §4, dòng lệnh chính xác phải gọi. |
| H6 | `scripts/tin-tuc/README.md` | **MỚI.** Bật thế nào sau khi deploy: dựng sub trên VPS, điền `.env`, đăng ký 3 task, cách gỡ. |
| H7 | `api/tests/test_tao_sub.py` | **MỚI.** Bài đo H1. |
| H8 | `api/tests/test_bot_dang_tin.py` | **MỚI.** Bài đo HTTP **đầu-cuối thật** qua `live_server` của pytest-django (DB test riêng, cổng ngẫu nhiên) — chạy chính `scripts/dang-tin.mjs` bằng `subprocess`. |
| H9 | `scripts/tin-tuc/lib.test.mjs` | **MỚI.** `node --test` cho H2. |
| H10 | `package.json` (gốc) | **+1 dòng**: `"test:bot": "node --test scripts/tin-tuc/*.test.mjs"`. |
| H11 | `scripts/tin-tuc/.gitignore` | **MỚI** *(thêm 2026-08-25)*. Che `da-dang.json` + `.tam/`. `.gitignore` gốc chỉ che `.env`; sổ cái commit nhầm là mang trạng thái "đã đăng hôm nay" của MỘT máy sang mọi máy. Đặt luật cạnh file nó bảo vệ, **không** sửa `.gitignore` gốc — file đó phiên khác đang không đụng nhưng luật lượt này là chỉ thêm file mới. |

**KHÔNG làm ở lượt này:** không đăng ký scheduled task (user chốt hoãn); không sửa
`settings.py`/model/migration; không thêm dependency Python hay JS nào (Node 24 có
`fetch` + `node --test` sẵn); không đụng bất kỳ file `M` nào của phiên khác.

## 6. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Cách đo |
|---|---|---|
| N1 | `tao_sub tin-tuc` chạy **2 lần** ⇒ đúng 1 hàng `Sub`, exit 0 cả hai lần | `test_tao_sub.py` |
| N2 | Chạy lại với `--ten` khác ⇒ **cập nhật**, không tạo hàng thứ hai | `test_tao_sub.py` |
| N3 | **Đăng thật qua HTTP**: `live_server` + `node scripts/dang-tin.mjs` ⇒ 1 `Mach` đúng `sub=tin-tuc`, `author=gikky-team-news`, `Moc(seq=1).body` chứa nội dung gửi lên | `test_bot_dang_tin.py` |
| N4 | Link ngoài **sống sót** sanitize: `<a href="https://vnexpress.net/x">` còn trong DB **và** mang `rel="nofollow ugc noopener"` + `target="_blank"` | `test_bot_dang_tin.py` |
| N5 | Sổ cái chống trùng: chạy lần 2 cùng `--slot` cùng ngày VN ⇒ **exit 3**, `Mach.objects.count()` KHÔNG tăng | `test_bot_dang_tin.py` |
| N6 | Hạn chót: `--han-chot 07:00` khi giờ VN đã qua ⇒ **exit 4**, không request mạng nào | `lib.test.mjs` + `test_bot_dang_tin.py` |
| N7 | Sai mật khẩu ⇒ exit ≠ 0, stderr nói rõ **"đăng nhập"**, không phải một stacktrace | `test_bot_dang_tin.py` |
| N8 | `title` 161 ký tự hoặc `body` 10.001 ký tự ⇒ chặn **trước khi gọi mạng**, exit 2 | `lib.test.mjs` |
| N9 | `pnpm test:bot` xanh, 0 warning | chạy lệnh |
| N10 | `pnpm test` xanh; **nêu số bài trước/sau** (nền hiện tại phải tự đo, không đoán) | chạy lệnh |
| N11 | **THỬ PHÁ** (luật 4): bỏ header `X-CSRFToken` trong `dang-tin.mjs` ⇒ N3 **ĐỎ**; bỏ phép kiểm sổ cái ⇒ N5 **ĐỎ**; khôi phục, xanh lại | chạy 3 lần, dán output |
| N12 | `git status` sau khi làm: chỉ **file mới** + `package.json` gốc. Không file `M` nào của phiên khác đổi thêm | `git status --porcelain` |
| N13 | 3 file prompt ở `scripts/tin-tuc/lich/` **tự đứng**: mỗi file nêu đủ khung giờ, luật §4, và **dòng lệnh chính xác**; không câu nào tham chiếu hội thoại này | đọc |

### Thêm sau lượt phản biện 2026-08-25

| # | Tiêu chí | Cách đo |
|---|---|---|
| N14 | **Sàn giờ (§3.1)**: fire bù lúc 00:20 giờ VN ⇒ exit 4, câu lỗi nói "chưa tới 05:00", `Mach.count()==0`, **sổ cái KHÔNG được tạo**. Bài đo phải dựng đủ mọi thứ để đăng được (`live_server` sống, sub có, tài khoản có) — nếu không nó không phân biệt được "bị sàn chặn" với "không gọi mạng được" | `test_n14_…` |
| N15 | **Đăng xong rồi hỏng (§3.2)**: `GIKKY_BOT_SO_CAI` trỏ vào một **thư mục** ⇒ `Mach` vẫn được tạo, **exit 0**, stdout **vẫn in URL**, stderr chứa `ĐÃ ĐĂNG` và `TRÙNG` | `test_n15_…` |
| N16 | **Slot là tập đóng (§3.3)**: `dem_qua`, `DEM-QUA`, `dem-qua-2`, `""` ⇒ exit 1, câu lỗi **liệt kê đủ ba tên hợp lệ**, không request mạng nào (`ORIGIN_CHET`), `Mach.count()==0` | `test_n16_…` |
| N17 | **Bài đo không phụ thuộc đồng hồ thật**: khung giờ nay luôn áp, nên mọi bài đo phải ghim `GIKKY_BOT_GIO_GIA_LAP`. Chạy được bộ test ở bất kỳ giờ nào trong ngày | fixture `moi_truong_sach` ghim 06:12 VN; `GIO_VN` cho ba slot |
| N18 | Mật khẩu có khoảng trắng biên viết được (nháy bao ngoài giữ nguyên, không bị trim hai lần) | `lib.test.mjs` |
| N19 | `tao_sub` từ chối slug HOA và gạch dưới, gợi ý đúng dạng | `test_tao_sub.py` |
| N20 | `scripts/tin-tuc/.gitignore` che **cả** `da-dang.json` lẫn `.tam/`; `.env` vẫn do `.gitignore` gốc che | `git check-ignore -v` |

## 7. Nợ / ngoài phạm vi — nói trước, không giấu

> **Cập nhật 2026-08-25, sau khi deploy xong** — ba dòng đầu của mục này đã đổi trạng thái:
>
> | Việc | Trạng thái | Bằng chứng |
> |---|---|---|
> | gikky.net chạy bản này | ✅ | `/api/v1/health` → `{"status":"ok","db":"ok"}`; `<title>` là gikky.net, hết `Trekky` |
> | `s/tin-tuc` trên prod | ✅ | `tạo s/tin-tuc` → chạy lại `không đổi s/tin-tuc`; `/s/tin-tuc` → 200 |
> | Mật khẩu prod ở `scripts/tin-tuc/.env` | ✅ | ống thẳng `ssh → file`, giá trị không đi qua transcript; `git check-ignore` xác nhận |
> | Đăng nhập HTTPS thật | ✅ **200** | giải toả nghi vấn 403-CSRF dưới đây bằng ĐO, không phải suy luận |
> | Đăng bài thật | ⏸ chưa xin phép | đăng nội dung công khai |
> | 3 scheduled task | ⏸ chưa xin phép | tự động đăng công khai 3 lần/ngày |
>
> ⚠ **`tao_sub` KHÔNG có trong image prod** — image build từ working tree *trước* lượt
> này. Đã `docker cp` file vào container đang chạy để dùng một lần. Nó **biến mất ở lần
> rebuild sau**, và đó không sao: hàng `Sub` đã nằm trong DB, còn file thì có sẵn trong
> repo nên bản build kế tiếp mang nó theo.
>
> ⚠ **Prod là site TRẮNG**: 1 sub (`tin-tuc`), **0 mạch**, 3 tài khoản. Không có
> `chung-khoan`/`crypto`. Bản tin đầu tiên của bot sẽ là bài đầu tiên của cả site.

- **Chưa cắm lịch.** Bật khi user chốt.
- **Scheduled task chỉ chạy khi Claude Desktop đang mở.** `--han-chot` biến chế độ hỏng
  này từ "đăng tin ôi" thành "bỏ một bản tin" — nhưng nó **không** làm bản tin xuất hiện.
  Muốn chắc chắn thì phải là cron trên `vps-muinx`, là một việc khác.
- **Không có bước duyệt người.** Bot đăng thẳng. Sai thì sửa/xoá bằng tay qua admin.
- **Chất lượng nội dung không có bài đo tự động.** §4 là luật cho một LLM, không phải
  assert. Bài đo chỉ chứng minh **đường ống** đúng, không chứng minh **chữ** đúng.
- **Không dùng lịch kinh tế** (user bỏ) ⇒ slot 3 là giờ cố định, không bám sự kiện.
- ⚠ **Bot sống nhờ một dòng env của plan deploy — phụ thuộc chéo, KHÔNG có chuông**
  *(phát hiện ở lượt phản biện 2026-08-25; **đã ĐO trên prod cùng ngày: login → 200**,
  tức hôm nay nó đúng. Nhưng "đúng hôm nay" và "có chuông" là hai chuyện — phần dưới vẫn
  nguyên giá trị.)* `SECURE_PROXY_SSL_HEADER` không được đặt trên
  prod (ghi ở `plans/2026-08-25-deploy-vps-docker.md` mục "Nợ biết trước") ⇒
  `request.is_secure()` = False ⇒ origin mà Django tự dựng để so là `http://gikky.net`,
  **không khớp** `https://gikky.net` mà script gửi. Nó qua được **chỉ nhờ**
  `CSRF_TRUSTED_ORIGINS` trong `deploy/prod/compose.yml`. Hệ quả phải nhớ:
  - trỏ `GIKKY_ORIGIN` vào một hostname **không** nằm trong danh sách đó (vd
    `https://www.gikky.net` khi www thiếu) ⇒ **403 CSRF lúc 06:12 sáng, exit 1**;
  - **bài đo `live_server` không thể bắt được ca này** — nó chạy http, mà trên http bỏ
    hẳn header `Origin` đi thì Django cũng không kiểm ⇒ bài đo vẫn XANH.
- **`--som-nhat`/`--han-chot` là cờ ghi đè, và ghi đè được nghĩa là bỏ được hàng rào.**
  Ba file `lich/*.md` không dạy hai cờ đó và có một dòng cấm dùng, nhưng đó là chữ, không
  phải code. Ai chạy tay vẫn tự bắn vào chân được — có chủ đích, vì chạy tay là ca duy
  nhất cần lách thật.
- **T2–T6 chỉ nằm trong tài liệu, không nằm trong code.** Script chạy Chủ nhật vẫn đăng
  bình thường; ràng buộc ngày trong tuần nằm ở cron của scheduled task.
- **429 (hết hạn mức 10 mạch/ngày) rơi vào exit 1**, không có mã riêng — nay có kèm
  `thu_lai_tu` trong câu lỗi. Với 3 bài/ngày trên trần 10 thì chỉ chạm được khi lạm dụng
  `--ep`.
- **Cảnh báo "thân bài bị lọc" là heuristic**, ngưỡng giữ lại < 90% ký tự. Nó bắt được
  markdown thô và `<table>`/`<div>` bị gỡ; nó **không** bắt được một `<img>` ngoài site
  đơn lẻ trong một bài dài. Không đổi mã thoát — bài đã đăng rồi.
