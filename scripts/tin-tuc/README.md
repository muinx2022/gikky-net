# Bot bản tin `u/gikky-team-news`

**Một mạch mỗi ngày, ba mốc** — ba khung giờ thị trường ghi vào cùng một mạch trong
`s/tin-tuc`, bằng tài khoản `gikky-team-news`.
Plan: `plans/2026-08-25-bot-tin-tuc.md` (bản đầu) → `plans/2026-08-26-bot-mot-mach-mot-ngay.md`.

**Trạng thái hôm nay (2026-08-25): code xong, CHƯA cắm lịch.** Phần dưới là cách bật.

Vì sao một mạch chứ không ba bài rời: 3 bài/ngày × 5 ngày = 15 bài/tuần chôn mọi nội dung
người viết trong hai ngày. Nhưng cái sai sâu hơn số lượng — **bản tin mất giá theo giờ,
mạch lên giá theo thời gian**, và ba bài rời phá mất thông tin *"tin ra lúc 06:15, thị
trường phản ứng thế nào lúc 08:11"*.

## Hai mảnh, ranh giới rõ

```
Nhiệm vụ đặt lịch trong Claude Desktop (máy Windows này)
   │  ① gom tin theo khung giờ (prompt ở `lich/*.md`)
   │  ② dựng JSON {sub, title, body, loai, figures ≤6 cặp, question_for_crowd}
   ▼
node scripts/dang-tin.mjs --file <json> --slot <tên>
   │  ③ GET  /api/_allauth/browser/v1/auth/session  → cookie csrftoken
   │  ④ POST /api/_allauth/browser/v1/auth/login    {email, password}
   │  ⑤ POST /api/v1/machs            (mạch của ngày CHƯA có ⇒ TẠO)
   │     hoặc
   │     POST /api/v1/machs/{id}/mocs (đã có ⇒ NỐI mốc, bỏ `sub` và `title`)
   ▼
https://gikky.net
```

Phần LLM chỉ làm việc nó làm tốt — đọc tin và viết chữ. Chuỗi ba request có CSRF là code
cố định, và nó **có bài đo**: `api/tests/test_bot_dang_tin.py` chạy chính script này qua
một HTTP server thật.

Đi qua HTTP chứ không qua management command vì máy chạy lịch (Windows này) và máy chạy
DB (`vps-muinx`, Postgres không publish ra host) là hai máy khác nhau. Đường duy nhất đi
được là API công khai.

## Ba khung giờ

| Slot | Chạy (giờ VN) | Hạn chót | Prompt |
|---|---|---|---|
| `dem-qua` | 06:12 | 07:00 | [`lich/dem-qua.md`](lich/dem-qua.md) |
| `truoc-phien-vn` | 08:07 | 09:00 | [`lich/truoc-phien-vn.md`](lich/truoc-phien-vn.md) |
| `truoc-phien-my` | 19:33 | 21:00 | [`lich/truoc-phien-my.md`](lich/truoc-phien-my.md) |

Phút lẻ là chủ đích — tránh đỉnh `:00`/`:30`. Cron tương ứng: `12 6 * * 1-5`,
`7 8 * * 1-5`, `33 19 * * 1-5`. Chạy **T2–T6**: một bản tin "trước giờ giao dịch VN" vào
Chủ nhật không có nghĩa. Muốn cả 7 ngày thì đổi `1-5` → `*` ở cả ba nhiệm vụ.

## Bật — bốn bước, theo đúng thứ tự

### 1. Dựng chuyên mục trên prod

Chưa có `s/tin-tuc` thì mọi lượt đăng trả 404, lúc 06:12 sáng, qua một nhiệm vụ không ai
ngồi nhìn. Trên VPS:

```
docker compose -p gikkynet exec api python manage.py tao_sub tin-tuc --ten "Tin tức"
```

Lệnh idempotent — chạy lại bao nhiêu lần cũng ra đúng một hàng, và **không** xoá phần mô
tả ai đó đã soạn trong admin. Kiểm lại bằng cách mở `https://gikky.net/s/tin-tuc`.

### 2. Kiểm tài khoản bot có thật và đăng bài được

Tài khoản `gikky-team-news` do `manage.py tao_tai_khoan_doi` dựng, cùng lượt với
`gikky-team-member` và `admin`. Nó cần **đủ ba vế**: hàng `User`, mật khẩu, và hàng
`EmailAddress(verified=True, primary=True)` — thiếu vế thứ ba thì đăng nhập được nhưng
mọi cửa ghi trả lỗi, và lỗi ấy không nói gì về email. Trên VPS:

```
docker compose -p gikkynet exec api python manage.py tao_tai_khoan_doi
```

Mật khẩu nằm ở biến `GIKKY_TEAM_NEWS_PASSWORD` trong `api/.env` **của VPS**.

### 3. Điền bí mật trên máy chạy lịch

```
cp scripts/tin-tuc/.env.example scripts/tin-tuc/.env
```

rồi mở `scripts/tin-tuc/.env` và điền ba biến. ⚠ `GIKKY_BOT_PASSWORD` là mật khẩu **của
môi trường mà `GIKKY_ORIGIN` trỏ tới** — trỏ prod thì lấy từ `api/.env` trên VPS, **không
phải** giá trị trong `api/.env` của máy dev. Hai máy hai DB; chép nhầm thì triệu chứng là
"sai mật khẩu" lúc 6 giờ sáng.

`.env` khớp mẫu đã có trong `.gitignore` ở gốc repo ⇒ tự động không commit.

Thử một lượt **không đăng gì**, để chắc cấu hình đọc được:

```
node scripts/dang-tin.mjs --file <một-file-json-mẫu> --slot dem-qua --thu
```

### 4. Đăng ký ba nhiệm vụ đặt lịch

Trong Claude Desktop, tạo ba nhiệm vụ theo bảng khung giờ ở trên. **Nội dung nhiệm vụ =
toàn bộ file `lich/<slot>.md` tương ứng** — mỗi file tự đứng một mình, không tham chiếu
hội thoại nào, nên chép nguyên là đủ.

## Gỡ

- **Tạm dừng một slot**: tắt nhiệm vụ tương ứng trong Claude Desktop. Không cần đụng code.
- **Dừng hẳn mọi thứ**: xoá cả ba nhiệm vụ, rồi xoá `scripts/tin-tuc/.env`. Không có
  `.env` thì script thoát mã `1` với câu "Thiếu cấu hình" — nó không đăng được gì kể cả
  khi bị gọi nhầm.
- **Xoá một bài đã đăng**: bằng tay, qua khu quản trị. Bot **không có bước duyệt người**;
  nó đăng thẳng.
- **Sổ cái `da-dang.json`** (sinh ra cạnh file này ở lần đăng đầu tiên) giữ HAI thứ:
  hàng rào chống trùng, **và `mach_id` của ngày** — thứ quyết định TẠO hay NỐI.

  ```json
  { "2026-08-26": { "mach_id": 1004,
                    "url": "https://gikky.net/m/ban-tin-26-08-1004",
                    "slot": { "dem-qua": "<ISO>", "truoc-phien-vn": "<ISO>" } } }
  ```

  ⚠ **Xoá nó KHÔNG còn là thao tác vô hại** như hồi mỗi slot ra một bài rời. Xoá giữa
  ngày là mất `mach_id`, nên slot còn lại sẽ **tạo mạch thứ hai** thay vì nối tiếp —
  đúng cái mà cả thiết kế này dựng lên để tránh. Xoá sau nửa đêm thì vô hại.

  `scripts/tin-tuc/.gitignore` che file này (mẫu `.env` ở gốc repo không che được nó vì
  nằm ở tầng khác). Commit nhầm thì máy khác kéo về sẽ tưởng mình đã đăng bản tin hôm
  đó — và tệ hơn, sẽ nối mốc vào một `mach_id` của máy khác. Đừng `git add -A`.

## Mã thoát — hợp đồng, không phải chi tiết nội bộ

| Mã | Nghĩa |
|---|---|
| `0` | Đăng xong. stdout in URL bài. |
| `1` | Lỗi: thiếu cấu hình, mạng chết, server từ chối, tham số sai. |
| `2` | Thân bài không hợp lệ — chặn **trước** khi gọi mạng. |
| `3` | Slot này đã đăng trong ngày lịch VN hôm nay rồi. |
| `4` | **Ngoài khung giờ** của slot — quá muộn (tin ôi) *hoặc* quá sớm (tin chưa tồn tại). |
| `5` | Mạch của ngày **có** nhưng không nối vào được: **403** mod khoá · **404** bị ẩn/xoá · **409** đã đóng sổ · **429** đủ 3 mốc. `--ep` KHÔNG cứu được — câu lỗi in sẵn cách sửa sổ cái. |

`3`, `4` và `5` là **hành vi đúng**, không phải sự cố cần đi sửa. Mã `5` tách riêng vì
"mod khoá một bài" và "code hỏng" là hai chuyện chẳng liên quan gì nhau, và chỉ một
trong hai cần ai đó thức dậy.

⚠ Mã `5` nhận **đúng bốn mã HTTP kể trên**, không phải cả dải 4xx. Bản đầu lấy cả dải,
và cái giá là một `400` do chính bot gửi thân bài sai cũng ra mã `5` — tức cùng MỘT file
bài hỏng cho hai mã trái ngược tuỳ khung giờ nào chạy trước (`1` ở nhánh tạo, `5` ở nhánh
nối), mà `5` lại là mã tài liệu dạy người ta **bỏ qua**. `400`/`422` nay về `1`. Nhiệm vụ đặt lịch không đọc
được stdout, nên mã thoát là kênh duy nhất phân biệt "bot từ chối có lý do" với "bot
hỏng".

## Cờ dòng lệnh

```
node scripts/dang-tin.mjs --file <bai.json> --slot <tên>
                          [--ep] [--thu] [--origin https://gikky.net]
                          [--som-nhat HH:MM] [--han-chot HH:MM]
```

| Cờ | Nghĩa |
|---|---|
| `--file` | JSON `{sub, title, body, loai, question_for_crowd, figures}`. Bắt buộc. **Luôn có `sub` + `title`**, kể cả ở lượt chỉ nối mốc: khung đầu lỡ thì khung sau phải tự tạo được mạch. `loai` cũng **bắt buộc** — thiếu nó thì ba mốc không phân biệt được nhau. |
| `--slot` | `dem-qua` \| `truoc-phien-vn` \| `truoc-phien-my`. Bắt buộc, và là **tập đóng** — nó là khoá của sổ cái chống trùng, nên một chuỗi gõ nhầm là một hàng rào biến mất. |
| `--som-nhat` `--han-chot` | Ghi đè khung giờ của slot. **Chỉ dành cho chạy tay** — lịch bình thường không truyền, khung giờ đi kèm slot. |
| `--ep` | Bỏ qua hàng rào chống trùng của slot. **Chỉ dành cho người chạy tay.** Nó **không** tạo mạch thứ hai — mạch của ngày đã có thì mốc mới nối vào chính nó. |
| `--thu` | Soát mọi thứ rồi dừng, không gọi mạng. |
| `--origin` | Gốc site. Thắng cả biến môi trường lẫn `.env`. |

## Khung giờ của ba slot

Khung giờ **đi kèm slot**, không gõ tay. Ngoài khoảng ⇒ thoát `4`.

| Slot | Sớm nhất | Lịch chạy | Hạn chót | Vì sao sàn ở đó |
|---|---|---|---|---|
| `dem-qua` | 05:00 | 06:12 | 07:00 | Phiên Mỹ đóng 03:00–04:00 giờ VN |
| `truoc-phien-vn` | 06:30 | 08:07 | 09:00 | Sớm hơn thì báo trong nước chưa ra tin sáng |
| `truoc-phien-my` | 16:00 | 19:33 | 21:00 | Châu Á đóng cửa quanh 15:00–16:00 giờ VN |

## Vì sao có khung giờ và sổ cái

Hai chế độ hỏng đã biết trước, không phải phòng xa:

1. **Nhiệm vụ fire trễ.** Nhiệm vụ đặt lịch chỉ chạy khi ứng dụng đang mở; ứng dụng đóng
   lúc 06:12 thì nó chạy *lúc mở ứng dụng*, có thể là 14:00. Bản tin "đêm qua" đăng lúc
   14:00 là rác. Khung giờ biến chế độ hỏng này từ "đăng tin ôi" thành "bỏ một bản
   tin" — nhưng nó **không** làm bản tin xuất hiện. Muốn chắc chắn thì phải là cron trên
   `vps-muinx`, và đó là một việc khác.

   ⚠ **Fire bù có thể rơi vào đầu kia của trục thời gian, và bản đầu không chặn.** Máy mở
   lại lúc 00:20 giờ VN thì `dem-qua` "chưa quá 07:00" ⇒ bản đầu **đăng** một bản tin
   "phiên Mỹ đêm qua" viết lúc phiên Mỹ chưa đóng cửa, rồi ghi sổ cái cho **ngày mới** ⇒
   bản tin thật lúc 06:12 ăn `3` và biến mất. Đó là lý do có `som_nhat`; bài đo
   `test_n14_chay_bu_luc_nua_dem_thi_exit_4_du_server_dang_song` giữ nó.
2. **Đăng trùng.** Cùng một slot chạy hai lần trong một ngày VN (fire trễ rồi fire đúng
   giờ, hoặc người ta bấm chạy tay). Sổ cái `da-dang.json` khoá theo **ngày VN** và nhớ
   những slot đã ghi; trùng thì thoát `3`.
3. **Khung đầu lỡ.** Ứng dụng đóng lúc 06:12 ⇒ `dem-qua` không chạy ⇒ 08:07 mở ra với sổ
   cái trống. Nhánh TẠO/NỐI vì thế do **sổ cái** quyết, không do tên slot: hỏi tên slot
   thì `truoc-phien-vn` sẽ nối vào một `mach_id` không tồn tại và ngày đó không có bản
   tin nào, im lặng. Hệ quả bắt buộc: **mọi slot đều phải mang sẵn tiêu đề**.

Ranh giới ngày là **nửa đêm giờ `Asia/Ho_Chi_Minh`**, cùng mốc mà hạn mức 10 mạch/người/
ngày ở server dùng. Lệch mốc thì sổ nói một đằng, server nói một nẻo.

## Bài đo

| Chạy gì | Đo gì | An toàn chạy song song? |
|---|---|---|
| `pnpm test:bot` | Hàm thuần trong `lib.mjs`: ngày VN, hạn chót, soát thân bài, sổ cái, thứ tự cấu hình. | **Có** — không DB, không cổng, không server. |
| `pnpm test -- -k bot_dang_tin` | Đầu-cuối thật: chạy chính `dang-tin.mjs` qua `live_server` (cổng ngẫu nhiên, DB test riêng). | Không — nó dựng DB test. |
| `pnpm test -- -k tao_sub` | Lệnh `manage.py tao_sub`. | Không. |

## Giới hạn — nói trước, không giấu

- **Không có bước duyệt người.** Bot đăng thẳng; sai thì sửa/xoá bằng tay.
- **Chất lượng nội dung không có bài đo tự động.** Luật "chỉ tổng hợp, không đánh giá"
  trong `lich/*.md` là luật cho một LLM, không phải một câu `assert`. Bài đo chỉ chứng
  minh **đường ống** đúng, không chứng minh **chữ** đúng.
- **Không dùng lịch kinh tế.** Slot `truoc-phien-my` là giờ cố định, không bám sự kiện.
- **Hằng `DAI_TITLE`/`DAI_BODY` trong `lib.mjs` là bản sao** của hằng phía Python — script
  chạy trên máy khác nên không import được. Có chuông:
  `test_hai_tran_do_dai_KHOP_giua_python_va_javascript`.
