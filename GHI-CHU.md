# Ghi chú & danh sách việc — gikky.net (hướng mới)

> Mở 2026-11-09. Sổ việc của **hướng mới**. Khác `LOI-VA-NO.md` (sổ lỗi/nợ của hướng cũ) và
> `PLAN.md` (thiết kế gốc, chưa cập nhật theo hướng mới).
>
> **Không việc nào dưới đây đã được duyệt để code.** Bắt tay làm thì tách plan con ở `plans/`
> và chạy đủ 5 chặng theo `D:\Projects\CLAUDE.md`. Việc mới thì thêm vào cuối, đánh số tiếp.

---

## Hướng mới (user chốt 2026-11-09)

Làm lại gikky theo hướng mới: **tin tức và bài viết không còn là trọng tâm.**
*(Đính chính cùng ngày, xem việc 4: chúng KHÔNG bị bỏ, chỉ hạ xuống làm thông tin phụ trợ. Lời đầu tiên của
user dưới đây nói gọn hơn thực tế.)*
Nguyên văn: "ta sẽ tiếp tục với gikky và làm lại gikky theo hướng mới, không còn là bản tin và các bài viết nữa".

- **Cách làm** (user chốt 2026-11-09): ghi hết lại trước, rồi mới thay đổi. Mỗi vấn đề thành một việc
  ở dưới; chưa sửa gì khi chưa được bảo.
- **Tinh thần muốn truyền tải** (user nêu 2026-11-09): site là *nơi để mọi người note, share và học hỏi*.
- **Note hiện tại là trading journal** (user, 2026-11-09). Khi public thì share cho mọi người đọc và
  bình luận.
- **Công khai là MỘT CHIỀU** (user chọn 2026-11-09, việc 7): riêng tư → công khai thì được; mạch đã công khai thì
  tác giả **không rút** về riêng tư. Chi tiết (số phận của "lưu trữ", mặc định lúc tạo, đường xin gỡ) chưa chốt.
- **Chưa chốt**: hướng mới cụ thể (sản phẩm, phạm vi, tên gọi) là gì. Đừng suy diễn; việc nào phụ thuộc
  thì hỏi user. `PLAN.md` mục 4 (những thứ đã bị loại) chỉ đổi khi user nêu đích danh từng mục.
- Điều đã thấy khi đánh giá site dưới góc nhìn trader (cùng ngày): lõi đáng giữ là **mạch / mốc /
  dấu giờ máy chủ bất biến / nhật ký giao dịch**. Phần bản tin và bài phân tích dài do tài khoản
  "Đội ngũ" / "Tin tức" đăng không phải lõi. Trên trang chủ lúc đó, ~20 bài đầu đều của tài khoản
  nội bộ, hầu hết điểm +1, chưa thấy bình luận ở hai mạch bot đã mở.
- **Những thứ có thể bị ảnh hưởng — CHƯA quyết gì, chỉ liệt kê để khỏi sót**: `scripts/bai-viet/`
  (lịch bài, chủ đề), bot tin tức (`plans/2026-08-25-bot-tin-tuc.md`, sổ `P-20260827-6`), tài khoản
  "gikky · Tin tức" / "gikky · Đội ngũ", sub `tin-tuc`, lượng bài SEO đã có.

---

## Luật cứng (user chốt 2026-11-09) — áp cho MỌI việc và MỌI phiên

Site **chưa có thành viên** nên vẫn phải dùng AI để đăng bài. Nhưng:

1. AI chỉ đăng bài theo **tiêu chí chung** (hiện nằm ở "Nguyên tắc nội dung",
   `scripts/bai-viet/chu-de.md:496–504`; xem việc 3).
2. **Cấm seed bài dạng "câu view, câu like"** (bài đăng ra để kéo lượt xem, lượt thích).
   *(Ghi đúng lời user. Lần ghi đầu tôi đọc nhầm thành "cấm bơm lượt xem/like". Bơm lượt xem, like, vote
   giả tôi coi là cũng cấm theo cùng tinh thần, nhưng user chưa nói thẳng — cần xác nhận.)*
3. **Cấm seed bình luận** để tạo bình luận giả.

Việc nào đòi chạm vào ba điều trên thì dừng và hỏi user.

---

## Việc 1 · Bot Trader: vào lệnh riêng tư, đóng sổ mới công khai — CHƯA LÀM (nền tảng đã có sẵn, còn một lỗi rò phải vá trước)

> ⚠ **Đính chính cùng ngày (2026-11-09):** bản đầu của việc này nói nền tảng chưa có trạng thái riêng tư và
> phải xây một trạng thái "niêm phong" mới trên cơ chế hẹn giờ. **Sai.** Sản phẩm đã có **mạch riêng tư** từ
> commit `14cbac1` (2026-09-08). Tôi khảo sát bằng `hidden_at` / hẹn giờ và bỏ sót `Mach.rieng_tu`. Phần dưới
> đã viết lại theo mã thật; nếu thấy đâu còn nhắc "niêm phong" như một việc phải xây thì đó là bản cũ.

**Trạng thái (cập nhật 2026-11-09, sau 5 chặng):** lỗi rò ở "Chỗ chưa ổn" mục 1 đã được **vá trong cây làm việc**
(17 file sửa + 6 file mới dưới `api/`): dev → nghiệm thu (8/9) → phản biện (8 phát hiện) → vòng sửa V1–V7 → nghiệm
thu lần hai **ĐẠT 9/9, không hồi quy** (tập test đỏ trùng khít `HEAD` sạch). **CHƯA commit, CHƯA deploy, CHƯA
`reindex_tim_kiem` trên prod, CHƯA chạy ba câu SQL đo khai thác.** Chi tiết: mục 10 của
`plans/2026-11-09-va-ro-mach-rieng-tu.md`. Còn lại của việc 1: sửa bot ("Việc cần làm" mục 2) và Bước 0.

**Yêu cầu (user):** phần vào lệnh của Bot Trader phải private; đến khi đóng sổ mới public. Lúc đó lệnh đã qua,
không ai theo được nữa — tránh kiểu mớm kèo. Dữ liệu là **THẬT** (chạy forward trên giá thị trường thật),
không phải backtest.

**Vì sao không đăng một lần lúc đóng rồi để `occurred_at` lùi:** `created_at` (dấu giờ máy chủ) sẽ là giờ
đóng, mốc 1 hiện "ghi 09/11" cho lệnh vào ngày 06/11 — đúng dạng bài viết sau khi biết kết quả mà site sinh ra
để vạch mặt, và không phân biệt được với backtest. Muốn chứng minh "thật", dấu giờ lúc vào lệnh phải được ghi
ngay lúc đó và chỉ ẩn khỏi người đọc. **Mạch riêng tư làm đúng điều đó** (xem dưới).

### Nền tảng đã có (đã đọc code 2026-11-09)

- **Mạch riêng tư.** `Mach.rieng_tu` (`api/core/models/dien_dan.py:178`, migration `0035`): "True = chỉ tác giả
  và staff xem được". Form đăng bài web (`form-dang-mach.tsx`, `drawer-dang-nhanh.tsx`) và mobile
  (`apps/mobile/app/mach/new.tsx`) đều có ô "Riêng tư".
- **Che đúng ở các cửa đọc:** feed (`api/api/feeds.py:91`), hồ sơ và số đếm (`users.py:89`, `ho_so.py:267`),
  chi tiết mạch (`machs.py:139` — người lạ nhận 404), mốc (`mocs.py:65`), theo dõi (`theo_doi.py:186`), GET
  bình luận (có test `api/tests/test_trading_features.py`).
- **Lúc tạo:** không gửi thông báo "bài mới" (`machs.py:626`) và không đẩy vào chỉ mục tìm kiếm (`ghi.py:422`).
- **Nối mốc và đóng sổ dùng được trên mạch riêng tư** — `nap_mach` chỉ lọc `hidden_at`, không lọc `rieng_tu`.
  Khác mạch "hẹn giờ": mạch đó trả 404 cho cả tác giả nên bot không nối mốc được.
- **Công khai:** `POST /machs/{id}/cong-khai` (`machs.py:904–920`, `core/ghi.py:1325`). Chỉ đổi `rieng_tu` →
  `False`, rồi `bao_mach_moi` (báo người theo dõi tác giả) và `lam_moi_mach`. Có nút trên giao diện
  (`khoi-chu-mach.tsx`) và banner "mạch chỉ mình tôi".
- **Dấu giờ gốc giữ nguyên khi công khai** (`created_at` từng mốc không đổi) ⇒ mạch mở ra vẫn ghi
  "ghi 06/11 · 13:45" như hôm nay.
- **Không có lỗ hổng cửa sổ sửa im lặng** như ở hướng hẹn giờ: mạch riêng tư có `lan_dau_len_song = created_at`
  (`ghi.py:406`), nên `moc_bat_dau_tu_sua` (`cau_hinh.py:110`) đếm từ chính `created_at` của mốc. Lúc mở ra mọi
  cửa sổ đã hết hạn.
- ~~Thông báo lúc nối mốc không rò~~ — **SAI, đã đính chính cùng ngày.** `bao_moc_moi` gửi cho người `Follow`
  mạch đó, payload có `mach_title`; mà cửa `POST /machs/{id}/follow` (`theo_doi.py:295`) **không** chặn mạch riêng
  tư (`theo_doi.py:186` chỉ nằm trong `_mach_hien` của cửa `GET …/me`). Người lạ theo dõi được rồi nhận tiêu đề
  lệnh qua chuông. Xem sổ `P-20261109-3` và plan vá.

### Chỗ chưa ổn

1. **Rò rộng hơn tôi báo lúc đầu: tìm kiếm, theo dõi (kèm thông báo mang tiêu đề), bình luận, vote, reaction,
   báo cáo, và dò id qua mã 403** — sổ `LOI-VA-NO.md` `P-20261109-3`; plan vá
   `plans/2026-11-09-va-ro-mach-rieng-tu.md`
   (NẶNG; mới đọc code, chưa dựng lại). **Phải vá trước khi bot dùng `rieng_tu`**, nếu không lệnh đang mở lọt
   vào tìm kiếm ở lần nối mốc đầu tiên. Lỗi này cũng đang ảnh hưởng mọi người dùng đã tích "Riêng tư".
2. **Bot chưa dùng:** `scripts/bot-trader/dang_bai_bot_trader.py:55–62` (`payload_tao`) không gửi `rieng_tu`;
   `scripts/gikky_api_client.py:320` đã cho trường này đi qua. `GikkyClient` chưa có hàm gọi `cong-khai`.
3. **Các đường rò phụ — CHƯA kiểm:**
   - ảnh: `AnhNoiDung` không vào kho cách ly (sổ `P-20260903-8`). URL khó đoán nhưng không có rào;
   - cache ISR / `lam_moi_mach`, OG card, sitemap, đếm lượt xem;
   - các cửa ghi khác trên mạch riêng tư: vote, reaction, trích vào sổ;
   - mạch vừa mở ra đứng ở đâu trong feed.
4. **Repo GitHub là PUBLIC** và theo dõi file trạng thái của bot (xem Bước 0).

### Bước 0 — làm trước, độc lập

`scripts/bot-trader/data/vi_the_dang_mo.json`, `danh_sach_cho.json`, `bot_trader_post_payload.json` đang được
git theo dõi trong repo public `muinx2022/gikky-net`; hai file `bot_trader_post_payload_h4.json` / `_vn.json` chưa
tracked nhưng chưa được ignore. `.gitignore` mới chỉ loại `data/cache/` và `data/charts/`. Lúc kiểm, `origin/main`
= `HEAD` (`6aaedde`) và bản đã push chỉ có SHS, USD/CAD — vốn đã công khai — nên **chưa lộ gì mới**. Nhưng mỗi lần
`git add` lúc đang có lệnh mở là lộ; `danh_sach_cho.json` còn lộ **trước cả khi vào lệnh** (mã chờ, lý do, điểm,
chiến lược). Việc: thêm 5 file vào `.gitignore` và `git rm --cached` ba file đang tracked. Lịch sử cũ không cần xoá
(lệnh trong đó đã đóng hoặc đã công khai). Nhiều phiên dùng chung checkout — commit theo pathspec.

### Việc cần làm khi được duyệt (đề xuất của tôi, chưa duyệt)

1. Vá `P-20261109-3`: `hien_cong_khai` (`core/tim_kiem.py:418`) và `_mach_hien_theo_id` (`api/tim_kiem.py:186`)
   kiểm `rieng_tu`; chặn người khác ghi bình luận vào mạch riêng tư; thêm test phủ tìm kiếm và POST bình luận.
2. Bot: `payload_tao["rieng_tu"] = True`; thêm `GikkyClient.cong_khai_mach(mach_id)`; ở nhánh `dong_mach`
   (`dang_bai_bot_trader.py:100–116`) gọi nó ngay sau `dong_so`. Gọi lặp an toàn: endpoint chỉ đổi khi còn
   `rieng_tu`.
3. Kiểm nhóm rò phụ ở mục 3.
4. Bước 0.
5. Chạy thử một lệnh thật từ đầu đến cuối và đọc bằng tài khoản khách ở từng bước (feed, tìm kiếm,
   `GET /machs/{id}`, hồ sơ bot).

### Quyết định chưa chốt

- `danh_sach_cho` cũng private? (khuyên: có.)
- Lệnh đóng thủ công / huỷ / hết hạn không chạm SL-TP: công khai lúc nào? Hôm nay `cong-khai` chỉ chạy khi tác
  giả bấm hoặc bot gọi.
- Bot VN (D1, T+2.5) và bot FX (H4) dùng chung một luật?
- Có cần **băm cam kết công khai** thêm không? Không còn cần để giữ dấu giờ (đã giữ nguyên). Chỉ có ích nếu muốn
  bằng chứng độc lập với đồng hồ của máy chủ. Mặc định: không.

### Đã biết, không phải làm

- Hai lệnh đang mở (SHS 05/11, USD/CAD 06/11) đã công khai, không thu hồi. Luật mới áp từ lệnh kế tiếp.

### Liên quan

- `LOI-VA-NO.md` `P-20261109-3` — chặn việc này. `P-20261109-1` — PnL chỉ tính chân đầu, nhãn "Free-risk / hòa
  vốn" sai; mạch mở ra chính là thứ người đọc sẽ nhìn nên nên sửa trước hoặc cùng đợt. `P-20260903-8` — ảnh.
- Việc 6: mạch riêng tư là cầu qua bài toán con gà – quả trứng.
- `PLAN.md` mục 3, nguyên tắc 2 (mốc append-only) và 3 (hai dấu thời gian).

---

## Việc 2 · Site chưa diễn tả được tinh thần "note · share · học hỏi" — CHƯA LÀM, mới ghi nhận

**Vấn đề (user nêu 2026-11-09, ví dụ đầu tiên của đợt "ghi hết lại rồi mới đổi"):** site hiện không
diễn tả được tinh thần muốn truyền tải — *nơi để mọi người note, share và học hỏi*.

### Những chỗ thấy lệch

Quan sát khi duyệt https://gikky.net ngày 2026-11-09. **Đây là quan sát, chưa phải kết luận.**

- **Câu mở đầu nói về niềm tin, không phải về việc chia sẻ.** `<title>`: "gikky.net — Nhật ký giao dịch
  chứng khoán, phân tích vĩ mô & quản trị vốn". Dòng dưới tiêu đề trang chủ: "Ghi nhận nhận định
  trước khi có kết quả. Mọi mốc đều lưu vết thời gian thực và lịch sử minh bạch." Đó là lời hứa về
  tính bất biến, không phải lời mời viết, chia sẻ hay học.
- **Feed đọc như một tờ báo.** ~20 bài đầu trang chủ đều do tài khoản nội bộ đăng (bản tin, bài phân
  tích dài, Bot Trader). *(Nhận xét của tôi, không phải của user.)*
- **Chuyên mục xếp theo chủ đề của một toà soạn**, không theo việc người dùng làm: Tin tức · Chứng
  khoán VN · Vĩ mô & lãi suất · Quản trị vốn · Tâm lý giao dịch · Ngoại hối & FX · Tiền số · Hỏi đáp &
  Cơ chế.
- **`/luat` giọng canh gác nhiều hơn chào đón:** mở bằng miễn trừ trách nhiệm, rồi bốn điều CẤM, rồi
  "kiến trúc minh bạch", rồi chế tài.
- **Vòng "chia sẻ → trao đổi → học" chưa chạy:** hai mạch Bot Trader tôi mở đều ghi "Chưa có bình luận
  chung nào", dù bài có câu hỏi mời thảo luận ở cuối.
- **Chưa kiểm:** trải nghiệm sau đăng nhập — nút viết/ghi chép, trang cá nhân, luồng đăng bài đầu tiên.

### Câu hỏi mở — đừng tự trả lời

- **ĐÃ TRẢ LỜI 2026-11-09 — "Note" là gì:** hiện tại là **trading journal** (mạch/mốc). Phạm vi rộng hơn
  trading thì chưa nói tới; `PLAN.md` mục 1 vẫn giới hạn v1 ở trading.
- **ĐÃ TRẢ LỜI 2026-11-09 — "Share" là gì:** khi public, **share cho mọi người đọc và bình luận**.
  **Đã kiểm code — sản phẩm ĐÃ làm đúng như vậy:** mạch có trạng thái riêng tư (`Mach.rieng_tu`) rồi công
  khai bằng `POST /machs/{id}/cong-khai` (commit `14cbac1`, 2026-09-08; form đăng bài web và mobile đều có ô
  "Riêng tư"). Lời user mô tả hiện trạng, không phải yêu cầu mới. Việc 1 là một ca của cơ chế chung này.
- "Học hỏi" gồm những gì ngoài đọc và bình luận? Đã có sẵn "trích vào sổ"; còn lưu bài, theo dõi người?
- Dấu giờ bất biến / minh bạch còn là lời hứa **hàng đầu**, hay chỉ là tính năng nền? Câu trả lời đổi cả
  câu mở đầu trang chủ.
- Người dùng chính là ai: trader mới muốn học, hay trader có kinh nghiệm muốn ghi chép?

### Phạm vi ảnh hưởng nếu làm (chưa quyết gì)

Câu mở đầu và tiêu đề trang chủ · `<title>` / OG / mô tả meta · khối "Về gikky.net" · tên và cách xếp
chuyên mục · trang `/luat` · trạng thái feed khi chưa có bài của người dùng · trang chủ cho khách chưa
đăng nhập. `PLAN.md` mục 1 và mục 9 (copy, UI spec) sẽ lỗi thời theo.

---

## Việc 3 · Không bơm tương tác giả: rà hiện trạng, chốt các điểm còn mở — CHƯA LÀM

Luật cứng ở trên. Việc này là **đã rà gì, còn quyết gì**. Mọi con số dưới đây đọc qua API công khai của
prod ngày 2026-11-09 (chỉ đọc); **chưa quét toàn site, mới kiểm các mạch của `bot-trader`** (18 mạch).

### Hiện trạng đã rà

- **Lượt xem: không thấy dấu hiệu độn.** 1–5 lượt cho hầu hết mạch, 10 (TCB) và 24 (HDB 28.05) cho mạch
  nhiều bình luận nhất. Nơi duy nhất tăng `view_count` là `api/api/dem_luot_xem.py:486`; không thấy script
  nào cộng lượt xem.
- **Bình luận: 16 bình luận trên 4 mạch bot** (HDB 28.05 ×10, PVS ×2, TCB ×2, BRENT ×2), còn 14 mạch kia
  chưa có bình luận.
  - 8 bình luận do ba tài khoản nội bộ viết: `admin`, `muinx2026`, `muinx2022@gmail.com`. Đọc như ý kiến
    người thật (hỏi, kể vị thế riêng, hỏi về cổ tức). *(Nhận xét của tôi; user biết đó là ai.)*
  - 8 bình luận của `bot-trader`, **đều là trả lời bình luận của người khác, không có bình luận gốc nào**
    (khớp "Bình luận 8" ở hồ sơ). Phần lớn trả lời sau 6–25 phút; riêng một mẻ chạy lúc 01:00 UTC (08:00 giờ VN) trả lời bình luận từ vài giờ trước.
- **Vote:** mọi mạch hiện +1 vì tác giả tự upvote — luật nền `PLAN.md` mục 5.7 ("Tác giả nhận +1 phiếu của
  chính mình"), không phải seed. Nhưng trên trang chủ nó trông như mỗi bài đều có một lượt thích.
- **Công cụ có khả năng viết bình luận:** `scripts/binh-luan/gikky_comments_manager.py`. `--reply` trả lời
  bình luận chưa được phản hồi, dưới danh nghĩa `bot-trader` hoặc `gikky-team-member`.
  `binh_luan_vao_mach` (dòng 124) đăng bình luận **gốc** vào mạch, mặc định là `bot-trader` — **đây là chỗ
  có thể bị dùng để bơm bình luận**. Hiện chưa thấy dấu vết đã dùng.
- **Dữ liệu mẫu:** `seed_dev` / `seed_e2e` tạo vote, bình luận mẫu; chỉ được chạy vào DB dev/e2e. Liên quan
  sổ `L02` (`seed_dev` không chốt môi trường), `L31`. Chưa thấy dấu vết seed trên prod trong phạm vi đã rà.
- **"Tiêu chí chung" đã có văn bản:** "Nguyên tắc nội dung", `scripts/bai-viet/chu-de.md:496–504` — không
  hô hào/bơm thổi, không khuyến nghị mua/bán, mổ xẻ hai mặt, bốn trụ cột nội dung; nhắc lại ở
  `scripts/bai-viet/lich/phan-tich.md:37`. *(Giả định: đó là thứ user gọi "tiêu chí chung" — cần xác nhận.)*
  Lưu ý: file này thuộc đường ống **bài viết**, đường ống mà hướng mới nói không còn là trọng tâm.
  Bài của Bot Trader theo `scripts/bot-trader/AGENTS.md`, không theo file này.

### Câu hỏi mở — đừng tự trả lời

- "Tiêu chí chung" có đúng là "Nguyên tắc nội dung" nói trên không? Bot Trader có một bộ tiêu chí riêng
  thành văn không (nó đăng SL/TP cụ thể, trong khi nguyên tắc 2 của bài viết cấm "phím điểm cắt lỗ/chốt
  lời")?
- **Cái gì tính là "bài dạng câu view/like"?** Hai thứ hiện có hoặc được đề xuất trông gần với "câu tương
  tác": (a) câu hỏi cuối mỗi mạch Bot Trader ("…bạn đánh giá kịch bản nào dễ xảy ra hơn: Đạt Take Profit…
  hay chạm Stop Loss…?"), điền vào trường `question_for_crowd` — "câu mồi" của `PLAN.md` mục 1 và mục 5;
  (b) "Content Seeding" trong tài liệu ở việc 5. User phân định; tôi không tự xếp loại.
- Tự upvote +1 giữ hay bỏ? (Nó không phải seed, nhưng trên trang chủ trông như một lượt thích ở mọi bài.)
- `binh_luan_vao_mach`: giữ, bỏ, hay chặn?
- Ba tài khoản nội bộ có bình luận (`admin`, `muinx2026`, `muinx2022@gmail.com`): để nguyên, hay hiển thị
  là tài khoản nội bộ?
- Bài do AI đăng (và trả lời của `bot-trader`) có cần ghi rõ là do AI/nội bộ đăng không? Hồ sơ `bot-trader`
  tự nhận là bot; chưa thấy chỗ nào nói với tài khoản "Đội ngũ".
- Sau khi bỏ bản tin và bài viết, AI còn đăng loại bài nào ngoài Bot Trader?

### Liên quan

- `LOI-VA-NO.md` `P-20261109-2` — username của một tài khoản là địa chỉ email, lộ công khai. Cần kiểm
  form đăng ký trước khi mời thành viên thật.
- `LOI-VA-NO.md` `L02`, `L31` (seed).

---

## Việc 4 · Đổi trọng tâm: từ "site nội dung" sang thứ người ngoài cần; tin tức và bài viết thành phụ trợ — CHƯA LÀM

Lấy lại vấn đề của việc 2 dưới dạng **một quyết định đổi trọng tâm**.

**Yêu cầu (user, 2026-11-09):** site hiện nhìn như một site nội dung, không đúng trọng tâm. Muốn khi người
ngoài vào, họ thấy đó là **thứ họ cần**, chứ không phải tin hay bài viết — thứ rất nhiều nơi đã có. Những gì
đang làm trọng tâm bây giờ (tin tức, bài viết) sẽ là **thông tin phụ trợ cho bản cập nhật sẽ làm**.

> ⚠ **Đính chính so với ghi chú trước:** tin tức và bài viết **KHÔNG bị bỏ**. Chúng hạ từ trọng tâm xuống
> phụ trợ. Đừng xoá, dọn hay ngừng đường ống của chúng chỉ vì mục "Hướng mới" từng ghi "không còn là".

### Hiện trạng (quan sát trang chủ https://gikky.net ngày 2026-11-09)

- **Lời hứa và nội dung lệch nhau.** Tiêu đề trang chủ là "Nhật ký giao dịch chứng khoán & Luận điểm thị
  trường", nhưng trong **20 mục đầu của feed chỉ có 2 là nhật ký giao dịch** (Bot Trader). Còn lại: 2 bản tin
  (sub `tin-tuc`) và 16 bài do "gikky · Đội ngũ" đăng (phân tích, chuyện kể, hỏi đáp).
- **Nhật ký không lộ ra ở trang chủ.** Thẻ của Bot Trader trông như một bài viết; thứ phân biệt nó chỉ là
  nhãn "N mốc" và chip "ĐÃ ĐÓNG SỔ". Mạch/mốc, dấu giờ máy chủ bất biến — chỗ khác biệt thật của gikky — chỉ
  hiện khi bấm vào trang chi tiết.
- **"Tin tức" đứng đầu danh sách chuyên mục** ở thanh bên.
- *(Các quan sát khác về câu mở đầu, chuyên mục, `/luat`: xem việc 2.)*

### Câu hỏi mở — đừng tự trả lời

- **"Thứ người ngoài cần" là gì**, nói bằng một câu mà người lạ hiểu trong vài giây? *Giả thuyết dựa trên các
  ghi chú trước, CHƯA xác nhận:* nhật ký giao dịch mở ra cho mọi người đọc và bình luận.
- **"Bản cập nhật sẽ làm" là gì?** Tin và bài viết "phụ trợ cho" cái gì?
- **"Phụ trợ" theo nghĩa nào:** ở một chỗ riêng (một trang, một thanh bên), gắn vào từng mạch làm tư liệu và
  bối cảnh, hay chỉ còn là nguồn kéo người tìm đến qua Google?
- **Đường ống AI đăng tin và bài:** giữ nhịp hiện tại, giảm, hay dừng? (Luật cứng ở trên vẫn áp.)
  **ĐÃ TRẢ LỜI MỘT PHẦN (user, 2026-11-09, sau khi đọc tài liệu việc 5):** nội dung trọng tâm cũ (tin, bài viết)
  **"vẫn post, nhưng sẽ không còn là focus của site nữa"**. Tức là **giữ đường ống**, chỉ đổi vai. Còn mờ: nhịp
  (giữ nguyên hay giảm), và "phụ trợ" nằm ở đâu trên trang (câu hỏi ngay trên). Đừng dừng hay dọn gì.
- **Traffic từ bài viết:** hạ chúng xuống có thể làm giảm người vào từ tìm kiếm. Repo chưa ghi số liệu nào.
  Có thể xem thống kê lượt xem nội bộ (`api/api/dem_luot_xem.py`, trang `/luot-xem`) để biết bài nào thực sự
  được đọc — **chưa xem**.

### Phạm vi ảnh hưởng nếu làm (chưa quyết gì)

Trang chủ (bố cục, thứ tự, câu mở đầu) · feed mặc định và các tab · thứ tự chuyên mục ở thanh bên · khối
"Về gikky.net" · điều hướng · vị trí mới của tin và bài viết · OG và thẻ chia sẻ của trang chủ
(`apps/web/lib/og.ts`, `apps/web/components/og-the.tsx`, đang có thay đổi chưa commit) · SEO.
`PLAN.md` mục 1 và mục 9 sẽ lỗi thời theo.

---

## Việc 5 · Tài liệu tham chiếu: đề xuất "Gikky 2.0 — Community Investing" — CHƯA QUYẾT

**Nguồn:** user dán nguyên văn vào chat ngày 2026-11-09, không kèm lời nào; không rõ tác giả. **User chưa nói
chấp nhận phần nào.** Dưới đây là tóm tắt để khỏi mất, rồi đối chiếu với repo và các ghi chú trên. Tài liệu tự
nói nó chỉ đánh giá bề mặt công khai, chưa có analytics, cohort hay phỏng vấn, nên mọi nguyên nhân retention
đều là **giả thuyết**.

### Tóm tắt

- **Chiến lược:** chuyển gikky "từ nền tảng nội dung sang cộng đồng đầu tư". *Community-first,
  Reputation-driven.* Vision: "The Community Where Investors Learn, Share and Prove Their Investment Thinking".
- **Ba trụ cột, phải liên kết chứ không tách phân hệ:** Community · Investment Intelligence (luận điểm, phân
  tích, dữ liệu) · Investor Identity (lịch sử luận điểm, nhật ký, uy tín).
- **Chẩn đoán (giả thuyết), sáu điểm nghẽn:** ít thành viên hoạt động; nội dung chủ yếu của đội ngũ; chưa có
  mạng theo dõi; người dùng đọc mà không tạo mốc; thảo luận nông; uy tín chưa có hệ thống dễ hiểu. Vòng lặp
  hiện tại: vào → đọc → rời đi. Cần vòng "flywheel": khám phá → theo dõi → đóng góp → phản hồi và uy tín →
  thêm người theo dõi, thêm nội dung → quay lại.
- **Bốn hướng:**
  1. *Community-led content* — sáu dạng: Investment Thesis, Trading Journal, Market View, Stock Discussion,
     Q&A, Post-trade Review; ưu tiên Thesis và Journal vì tận dụng dấu giờ.
  2. *Social graph* — follow người, chuyên gia, cổ phiếu, chủ đề; feed cá nhân hoá đơn giản (người theo dõi →
     chủ đề → mới nhất); thông báo.
  3. *Reputation & Trust* — năm thành phần (Contribution, Consistency, Transparency, Engagement Quality,
     Track Record). **Tách Reputation khỏi Performance**; không lấy tỷ lệ thắng làm điểm uy tín duy nhất;
     không bảng xếp hạng lợi nhuận.
  4. *Governance* — báo cáo vi phạm, nhãn chuyên gia, cảnh báo thao túng, khiếu nại, công khai lợi ích liên quan.
- **MVP "Community Core", 4 tháng đầu.** P0: Community Feed, Follow User, Follow Stock/Topic, User Profile,
  Create Post, Comment & Reply, Notifications. P1: Save/Bookmark, Trending Topics, Basic Reputation. P2: Advanced
  Track Record, nhóm riêng, gamification. Năm màn hình: Community Home, Discover, Create Post, User Profile,
  Notification Center. Onboarding năm bước (chọn mối quan tâm → gợi ý 5–10 tài khoản → follow → tương tác lần
  đầu → khuyến khích đóng góp); **không ép đăng bài mới được dùng**.
- **Chưa nên làm:** chat realtime, livestream/video, nhóm kín trả phí, copy trading, bảng xếp hạng lợi nhuận, AI
  phân tích danh mục, gamification dày đặc.
- **Roadmap 12 tháng, 4 giai đoạn:** Foundation (T1–2) · Activation (T3–4, kéo 50–100 thành viên nòng cốt) ·
  Retention (T5–8: reputation, track record, kiểm duyệt) · Scale (T9–12: cộng đồng chuyên gia, nhóm theo ngành,
  API, thử doanh thu).
- **Growth:** Founding Community có chọn lọc (5–10 chuyên gia, 15–20 trader, 30–40 nhà đầu tư tích cực, 50–100
  thành viên mới — "quy mô thử nghiệm, không phải số liệu hiện tại"); Contributor Program, không trả thưởng theo
  số bài hay lượt tương tác; **Content Seeding** = đội ngũ chủ động tạo chủ đề thảo luận (Market Debate, Stock
  Thesis, Trading Review, Expert Q&A, Weekly Challenge); vòng kéo người mới (trang luận điểm công khai, hồ sơ có
  URL, SEO, xem trước khi đăng ký).
- **KPI:** North Star = *Weekly Active Contributors*. Ngưỡng funnel là **giả định** (đăng ký 5–10%, activation
  40–50%, D7 20–25%, D30 10–15%…), tác giả nói rõ không phải benchmark. Bốn dashboard.
- **Trước khi đầu tư lớn:** 4–6 tuần discovery — phỏng vấn 15–20 người, phân tích 30–90 ngày hành vi, thử follow
  + feed cá nhân hoá, thử Founding Contributor với 20–30 người.
- **Xin BLĐ ba quyết định:** chọn Community Investing; ưu tiên Community Core và Social Graph trước phân tích nâng
  cao; đầu tư Founding Community + Contributor Program song song. Hướng xa: "Investor Reputation Network", có thể
  tích hợp ứng dụng CTCK nhưng giữ gikky độc lập trước.
- **Tác giả đề xuất bước tiếp:** ba tài liệu — Product Assessment, Product Strategy, MVP & Roadmap.

### Đối chiếu với repo và các ghi chú trên

**Khớp:**
- Hướng chung trùng ghi chú của user: cộng đồng thay vì nội dung, nhật ký giao dịch là lõi, đội ngũ chỉ là
  "nguồn nội dung nền" (cùng ý với việc 4). Tài liệu trả lời một phần câu "thứ người ngoài cần là gì" của việc
  4; ứng viên: *nơi nhà đầu tư học hỏi, chia sẻ và chứng minh tư duy*. **User chưa chọn.**
- Cảnh báo "không lấy tỷ lệ thắng làm uy tín, không bảng xếp hạng lợi nhuận, không chat realtime" khớp `PLAN.md`
  mục 4.
- Chẩn đoán "nội dung chủ yếu của đội ngũ" khớp quan sát ở việc 4 (16/20 mục đầu là bài của "Đội ngũ").

**Phần lớn "MVP P0" ĐÃ CÓ trong code**, nên khoảng trống không nằm ở tính năng:
- follow người `TheoUser`, follow chuyên mục `TheoSub`, follow mạch `Follow`
  (`api/core/models/tuong_tac.py:336`, `:297`, `:275`); thông báo `Notification`
  (`api/core/models/he_thong.py:21`); báo cáo vi phạm `Report` (`:60`) và nhật ký quản trị `AuditLog` (`:139`);
  hồ sơ `/u/<username>`; đăng bài, bình luận, trả lời; vote, reaction, "trích vào sổ".
- **Chưa thấy:** lưu/bookmark; follow theo mã cổ phiếu; reputation (chỉ có số "Được trích"). **Chưa kiểm:** feed
  riêng cho người đang theo dõi, trending, onboarding.
- Khoảng trống thật là **người dùng** (site chưa có thành viên) và **cách trình bày** (việc 2, việc 4).

**Chạm các quyết định đã có — cần user phân định, không tự gỡ:**
1. **Track Record / Performance / "kết quả luận điểm theo thời gian" / Weekly Challenge** chạm `PLAN.md` mục 4
   ("Kèo/dự đoán có chấm thắng-thua, streak, leaderboard" — "với site trading, đây là cấm tuyệt đối"). Mục 4 chỉ
   đổi khi user nêu đích danh. Và user đã nói Bot Trader không phải để khoe thành tích.
2. **"Content Seeding" so với luật cứng.** Chủ đề kiểu "VN-Index đang tích lũy hay phân phối?" nhằm mời thành
   viên phản hồi có thể rơi vào "bài dạng câu view/like". Chưa có luật phân biệt chủ đề thảo luận thật (đội ngũ
   nêu quan điểm, ghi rõ là đội ngũ) với câu hỏi mồi — xem câu hỏi mở ở việc 3.
3. **`PLAN.md` mục 4: "Tham gia sub + feed cá nhân hoá" bị loại, "xét lại khi có >5 sub".** Hiện có 8 chuyên mục
   và đã có model `TheoSub`, nên dòng này có thể đã lỗi thời. Chưa kiểm phần giao diện.

**Lệch hoàn cảnh:**
- KPI và thử nghiệm của tài liệu (D7, cohort, Weekly Active Contributors, "phân tích 30–90 ngày hành vi") giả
  định đã có người dùng. Site chưa có thành viên nên baseline là 0 thật, nhiều phép đo chưa chạy được.
- Kế hoạch 12 tháng với BLĐ, Product/Data, ngân sách không khớp cách làm hiện tại của repo (phiên chính + agent).
- Tài liệu **không nhắc** mạch riêng tư rồi mới công khai — thứ sản phẩm **đã có** (việc 1) và là chỗ khác biệt
  đáng giá nhất của gikky.

### Câu hỏi mở — đừng tự trả lời

- User muốn lấy phần nào: định vị, ba trụ cột, MVP, growth, KPI, hay chỉ coi là tham khảo?
  **ĐÃ TRẢ LỜI MỘT PHẦN (user, 2026-11-09):** **bỏ qua roadmap** (kế hoạch 12 tháng, các giai đoạn, KPI/funnel,
  discovery 4–6 tuần). Phần "đáng cân nhắc": **các chủ đề thảo luận** (xem việc 8) và "nhiều mục khác" — user chưa
  nêu đó là mục nào; hỏi lại, đừng đoán.
- Có theo quy trình discovery 4–6 tuần của tài liệu không, khi chưa có thành viên để phỏng vấn?
- Có lật `PLAN.md` mục 4 cho Track Record không? (Xem mục 1 ở trên.)
- Founding Community và Contributor Program là việc ngoài code: ai làm và khi nào?

### Bổ sung — lần dán thứ hai, cùng ngày 2026-11-09

User dán lại, không kèm lời nào, một tài liệu tên "Đề xuất Product Strategy cải tổ nền tảng Community
Investing". Có vẻ là tài liệu thứ hai trong bộ ba tác giả hứa ở cuối bản trước (Assessment · Strategy · MVP &
Roadmap). Phần lớn đã nằm ở tóm tắt trên; chỉ ghi phần **chưa có** ở trên. **User chưa nói chấp nhận phần nào.**

- **Phân khúc có thứ hạng ưu tiên.** Rất cao: nhà đầu tư cá nhân có kinh nghiệm (đóng góp luận điểm) và
  chuyên gia/KOL (dẫn dắt). Cao: nhà đầu tư mới, trader, đội ngũ phân tích (chỉ là "nguồn nội dung nền").
  Mô hình bốn vai Creators · Experts · Followers · Contributors; người theo dõi, hỏi hay, bình luận có chất lượng
  cũng là thành viên có giá trị — **không bắt ai phải viết bài**.
- **Bảng "hiện tại → mục tiêu":** retention từ "có bài viết mới" sang "có diễn biến và tương tác mới liên quan đến
  mình"; nội dung từ "bài viết, nhận định" sang "luận điểm, nhật ký, thảo luận".
- **Tác giả tự đính chính:** xem lại bề mặt công khai thì nhận ra gikky đã tự định vị là mạng xã hội nhật ký giao
  dịch, không phải site nội dung thuần; vấn đề là **khoảng cách giữa định vị và trải nghiệm** — cùng kết luận với
  việc 4. Số mốc, bình luận ở các bài quan sát được "còn khá nhỏ" (tác giả tự nói chưa đủ để kết luận).
- **Vòng giá trị mẫu:** luận điểm FPT → người khác theo dõi, phản biện → tác giả cập nhật → cộng đồng theo dõi kết
  quả → ghi vào hồ sơ. Trong repo, "tác giả cập nhật" chính là **mốc nối vào mạch**; chỉ phần "ghi vào hồ sơ như
  uy tín" là chưa có.
- **Đối chiếu code (grep 2026-11-09):** `Mach` (`api/core/models/dien_dan.py:139–248`) **không có trường loại nội
  dung** (Thesis / Journal / Q&A / Post-trade Review…); chỉ có `sub`, `truong_phai`, `ket_qua`, `bai_hoc`. **Không
  có model tag/chủ đề** và **không có trường mã cổ phiếu** (grep `ticker|symbol|ma_ck`, `Tag|Topic|ChuDe` đều rỗng
  ngoài thẻ HTML) ⇒ "follow cổ phiếu" muốn có thì phải thêm trường, không chỉ thêm nút. **Không có trường công khai
  vị thế của tác giả** (chính sách "lợi ích liên quan" ở mục Governance của tài liệu). Không có trường vai
  (Creator/Expert) hay nhãn chuyên gia.
- **Cùng câu hỏi mở số 3 ở trên, chưa mới:** tài liệu tách Reputation khỏi Performance và nói rõ không làm bảng xếp
  hạng lợi nhuận (hợp `PLAN.md` mục 4), nhưng "Track Record / kết quả ghi nhận theo phương pháp minh bạch" vẫn là
  chấm kết quả. Phần đó chỉ vào được khi user lật mục 4 đích danh.

---

## Việc 6 · Bài toán con gà – quả trứng: không thành viên thì không nội dung, seed thì là dữ liệu giả — CHƯA QUYẾT

**Vấn đề (user, 2026-11-09, sau khi đọc tài liệu ở việc 5):** rơi vào bài toán con gà – quả trứng. Không có
thành viên thì không có nội dung; nếu seeding thì dữ liệu là giả. Luật cứng ở trên chặn đúng lối thoát dễ nhất.

### Ranh giới "giả" và "thật nhưng do ta đặt vào" — đề xuất của tôi, CHƯA được user chấp nhận

- **Giả** = giả làm nhiều người độc lập hoặc giả tương tác: tài khoản ma, bình luận / like / vote / lượt xem dựng
  sẵn, bài đăng ra chỉ để mồi.
- **Thật nhưng do ta đặt vào** = nội dung thật của người thật, hoặc của một tác nhân tự nhận rõ: nhật ký giao dịch
  thật của chính chủ site; Bot Trader (dữ liệu thật chạy forward, hồ sơ tự nhận là bot); bài của "Đội ngũ" gắn nhãn
  đội ngũ. Chúng không tạo ảo giác "cộng đồng đông", nhưng cũng không giả.
- Chỗ mờ nhất: bài do AI đăng dưới tên "Đội ngũ" có tính là "thật" không (câu hỏi gắn nhãn ở việc 3).

### Hướng thoát không cần giả — chưa chọn

1. **Dùng được một mình trước — phần lõi sản phẩm ĐÃ làm được.** Mạch riêng tư rồi công khai (việc 1) cho một người
   ghi nhật ký giao dịch riêng của họ, có dấu giờ máy chủ bất biến, và mở cho người khác khi muốn. Nội dung do chính
   người dùng mang đến (lệnh thật của họ), không cần seed. Cái thiếu **không phải tính năng**: (a) người ngoài không
   biết điều đó, vì trang chủ không nói (việc 2, việc 4); (b) lời hứa "riêng tư" chưa đáng tin vì lỗi
   `P-20261109-3`. *(Nhận xét của tôi.)*
2. **Dogfood:** nhật ký thật của chính chủ site làm nội dung đầu tiên. Cần user muốn công khai lệnh của mình; kết
   hợp riêng tư → công khai thì không thành "mớm kèo".
3. **Tuyển tay một nhóm nhỏ người thật** (tài liệu ở việc 5 gọi là Founding Community). Việc ngoài code; chưa ai nhận.
4. **Bot Trader là "thành viên đầu tiên" công khai là bot**; không để nó đóng vai cộng đồng; nhãn rõ.
5. **Nội dung đội ngũ giữ vai tư liệu phụ trợ** (việc 4), có nhãn; không tăng số lượng để "trông sôi động".
6. **Trạng thái trống trung thực:** `PLAN.md` nguyên tắc 9 đã có (không in "0 bình luận"). Thêm một lời mời thật
   thay vì che chỗ trống bằng bài của đội ngũ. *(Nhận xét của tôi.)*

### User hỏi: seed user kèm "tính cách" rồi cho họ thảo luận (2026-11-09) — CHƯA QUYẾT; tôi trả lời là KHÔNG nên

Câu hỏi: tạo sẵn một nhóm user có tính cách đi kèm (vd người hoài nghi, người mới, người kỳ cựu) rồi dùng họ thảo luận
được không. **Kỹ thuật làm được** (`scripts/binh-luan/gikky_comments_manager.py` đã đăng bình luận dưới tài khoản
khác). **Nhưng đó đúng là thứ luật cứng cấm** (bình luận giả, tài khoản giả làm nhiều người độc lập), và trượt phép
thử "người đọc có bị hiểu sai ai đang nói và có bao nhiêu người thật không?". Phần "tính cách" là chỗ làm cho nó
thành lừa: nó được thiết kế để trông như nhiều người khác nhau.
Lý do thực dụng: (1) khách đăng ký dựa trên một đám đông không có; (2) gikky chỉ khác biệt ở chỗ kiểm chứng được, một
ảnh chụp "toàn nick ảo" là hết; (3) site chứng khoán, nick ảo bàn mã cụ thể có thể bị coi là tạo dư luận — **rủi ro
pháp lý chưa kiểm, chưa tư vấn**; (4) không giải được bài toán: thảo luận giữa các vai AI không có lợi ích thật, và
người thật tới sau không có chỗ.
**Biến thể không giả, chưa chọn:** MỘT vai AI gắn nhãn rõ là AI, đóng vai biên tập (vd phản biện các lệnh của Bot
Trader), không bắt chước đám đông. Một giọng có nhãn khác một dàn nick. Cần user duyệt riêng, và vẫn không tạo cảm
giác cộng đồng đông.

### User hỏi: dùng nick `muinx2022` để AI viết bình luận (2026-11-09) — CHƯA QUYẾT; tôi trả lời CÓ, KÈM ĐIỀU KIỆN

Khác với seed user ảo: đây là tài khoản **người thật** (của chính user), nên không phải "bình luận giả" **nếu** nội dung
đúng là quan điểm của user. Điều kiện tôi nêu:
1. **Ý của user, chữ của AI.** User nói ý, AI chỉnh chữ. AI **không bịa** vị thế, lệnh, kinh nghiệm, hay quan điểm
   nhân danh user (ba tài khoản nội bộ hiện kể vị thế riêng trong bình luận; bịa kiểu đó là thông tin giả thật).
2. **User duyệt từng bình luận trước khi đăng.** Không chạy tự động.
3. **Một nick một người.** Không dùng AI viết thay cả `admin`, `muinx2026`, `muinx2022@gmail.com` như ba giọng khác nhau
   trong cùng một thread (đó là ba nick của một người, đọc lên như ba người).
4. **Không để lấp chỗ trống.** Mục đích phải là user tham gia thật, không phải làm thread trông có người.

**Cách làm khuyên: "AI soạn, user tự dán trên web".** Không động tới mật khẩu, và điều kiện 2 tự có. Chỉ khi khối
lượng lớn mới đáng tự động hoá, mà khối lượng lớn chính là dấu hiệu sai mục đích. Nếu vẫn tự động: `GikkyClient`
(`scripts/gikky_api_client.py:72–74`) nhận `vai_tro` tuỳ ý và đọc mật khẩu từ biến `GIKKY_<ROLE>_PASSWORD`; mật khẩu để
trong `.env` không bị git theo dõi (repo là PUBLIC), **không dán vào chat**.

**Phải vá trước khi nick này nói nhiều thêm:** `P-20261109-2` — username của tài khoản này là địa chỉ email, mọi bình
luận mới đều mang email đó ra API công khai. Là sửa dữ liệu prod (đổi username kéo theo URL `/u/<username>`), chưa làm.
**Đã lập plan:** `plans/2026-11-09-doi-username-email.md` (chưa chạy; chỉ thêm file mới, không đụng agent mạch riêng
tư). **Đính chính sổ `P-20261109-2`:** "tài khoản Google mới không còn lộ" chưa đúng hẳn — `populate_username`
(`api/core/allauth_adapter.py:159–162`) bước 2 vẫn giữ nguyên email làm username khi tiền tố đã bị chiếm, nên lỗi
**có thể tái diễn**; sửa chỗ đó là quyết định (c) trong plan, chưa gộp.
**Đã chốt tên đích: `muinx2022`** (user, 2026-11-09); kiểm prod: tra chính xác `/users/muinx2022` = 404 nên còn trống,
dry-run sẽ kiểm lại không phân biệt hoa thường. Quyết định b (URL cũ 404 hay bí danh), c, d, e còn mở.

### Về tài liệu ở việc 5

Tài liệu gọi "Content Seeding" là *đội ngũ tạo chủ đề thảo luận* và "Founding Community" là *tuyển người thật*. Hai
thứ khác nhau: cái sau không giả; cái trước nằm ở vùng mờ của luật cứng.

### Câu hỏi mở — đừng tự trả lời

- Ranh giới giả / thật ở trên có đúng ý user không?
- Có muốn nhật ký giao dịch thật của chính chủ site là nội dung đầu tiên (hướng 2)?
- Có coi "dùng một mình trước" (hướng 1) là câu trả lời chính cho việc 4 ("thứ người ngoài cần")?
- Ai tuyển 5–10 người thật đầu tiên, và bằng cách nào?

---

## Việc 7 · Công khai → riêng tư (rút mạch đã công khai) — ĐÃ CHỌN: MỘT CHIỀU; hệ quả còn phải chốt, chưa làm

**Vấn đề (user, 2026-11-09):** đã có tính năng public / private. Riêng tư → công khai thì ổn. Nhưng công khai →
riêng tư thì sẽ liên quan tới bài viết, liên quan tới cộng đồng.

### Quyết định (user, 2026-11-09): MỘT CHIỀU

Chọn **phương án 1**: mạch đã công khai thì tác giả **không rút** về riêng tư và **không lưu trữ** được. Riêng tư →
công khai là một đi không về. Lý do nằm ở phần "Chạm vào cái gì" bên dưới (bia mộ, thiên lệch người sống sót,
bình luận và ghi công của người khác).

**Hệ quả — CHƯA làm, CHƯA có plan, nhiều điểm chưa chốt:**

- **`luu-tru` hôm nay mâu thuẫn với quyết định.** `POST /machs/{id}/luu-tru` (`api/api/machs.py:923–947`) cho tác
  giả ẩn mạch công khai không điều kiện. Phải đổi: tác giả không lưu trữ được mạch `rieng_tu = False`. Staff/mod vẫn
  ẩn và lưu trữ được vì lý do kiểm duyệt (có audit log). Còn **lưu trữ mạch đang riêng tư** (chưa ai thấy) cho tác
  giả hay không: chưa chốt.
- **Mặc định lúc tạo là chỗ "lỡ tay" dễ nhất.** Form đăng bài web (`form-dang-mach.tsx:47`), ngăn đăng nhanh
  (`drawer-dang-nhanh.tsx:85`) và schema (`api/api/schemas_ghi.py:92`, `rieng_tu: bool = False`) đều mặc định
  **công khai ngay**. Một chiều thì nút công khai và mặc định này phải nói thẳng "không rút lại được". Đổi mặc định
  sang riêng tư, hay thêm bước xác nhận: chưa chốt. **User đã phản hồi: một ô tick là quá dễ bỏ qua, muốn lựa
  chọn này thành mục focus của form — xem việc 9.**
- **Cần một lối cho ca đặc biệt** (đăng nhầm thông tin cá nhân, đăng nội dung của người khác, yêu cầu pháp lý).
  Thường là qua mod có audit log; hôm nay đã có `Report` và hành động ẩn của mod. Ai nhận, ai quyết, ghi vào đâu:
  chưa chốt. *(Không phải tư vấn pháp lý; cần người có chuyên môn xem nếu site có thành viên thật.)*
- **Không đổi:** sửa và xoá **mốc** trong mạch công khai (sửa có dấu "đã sửa", xoá để bia mộ). Một chiều chỉ nói
  về cả mạch.
- **Không đổi:** mod ẩn mạch vì vi phạm (`hidden_at`). Các tác động lên bình luận và ghi công vẫn xảy ra ở ca này;
  *chưa kiểm* hôm nay chúng được xử lý ra sao.
- **Việc 1 và plan bot không bị ảnh hưởng.** Bot chỉ đi riêng tư → công khai.

### Hiện trạng (đọc code)

- **Công khai → riêng tư KHÔNG có.** Không dòng code nào đặt `rieng_tu = True` sau lúc tạo. `cong_khai_mach`
  (`api/core/ghi.py:1325`) chỉ đi một chiều và không có endpoint ngược.
- **Nhưng "lưu trữ" đã làm gần đúng việc đó, và không có luật nào cho nó.** `POST /machs/{id}/luu-tru`
  (`api/api/machs.py:923–947`, `core/ghi.py:1904`): tác giả hoặc staff đặt `archived_at`. Mạch biến khỏi feed, tìm
  kiếm (`hien_cong_khai`) và tab bài viết hồ sơ; người lạ nhận 404 ở trang chi tiết (`machs.py:142`); **đảo ngược
  được** (`luu_tru=False`). **Không điều kiện nào:** không hỏi đã có bình luận của người khác chưa, đã có người
  theo dõi, đã có "trích vào sổ", mạch đã đóng sổ chưa, hay đã công khai bao lâu. Staff thì có audit log, tác giả
  thì không.
- ⇒ Câu hỏi của user **đang sống ở sản phẩm hôm nay**, qua "lưu trữ".
- **Lỗ hổng cùng họ với `P-20261109-3`:** các cửa đi qua `nap_mach` (bình luận, theo dõi, vote, nối mốc…) cũng
  **không** chặn mạch đã lưu trữ — sổ `P-20261109-4` (đã nâng lên VỪA).

### Chạm vào cái gì khi một mạch công khai bị rút

- **Bình luận của người khác** biến mất cùng mạch: họ mất lời của mình.
- **"Trích vào sổ":** `PLAN.md` mục 5.6 ghi công người bình luận **vĩnh viễn**. Mạch bị rút thì ghi công đi đâu?
  *Chưa kiểm:* số "Được trích ×N" ở hồ sơ có loại mạch lưu trữ ra không.
- **Điểm và vote:** người đã vote mất dấu vết.
- **Người theo dõi và thông báo:** hàng `Follow` còn nguyên, thông báo cũ trỏ vào 404.
- **Link đã chia sẻ và kết quả Google** chết.
- **Mạch đã đóng sổ** là tư liệu lưu trữ được Google index (`PLAN.md` mục 1); rút nó là mất tư liệu.
- **Lõi niềm tin.** `PLAN.md` nguyên tắc 2 ("xoá = bia mộ giữ chỗ") và `/luat` ("Bia mộ nội dung & Không xóa lịch
  sử… thay vì biến mất không dấu vết"). Mạch bị rút **biến mất không dấu vết**, đúng điều site hứa không làm. Với
  nhật ký giao dịch: đăng nhiều lệnh rồi rút lệnh thua là **thiên lệch người sống sót** — rủi ro "giấu lệnh thua"
  mà tài liệu ở việc 5 cũng nêu.

### Các phương án — ĐÃ CHỌN phương án 1 (giữ danh sách để biết đã bỏ gì)

1. **Một chiều thật sự:** công khai rồi thì không rút. Bỏ hoặc siết `luu-tru` với mạch đã công khai. Chặt nhất
   cho niềm tin; tác giả mất cửa "lỡ tay đăng".
2. **Cửa sổ hối hận:** rút được trong N phút sau lúc công khai **và** khi chưa có tương tác của người khác (bình
   luận, vote, theo dõi, trích). Cùng tinh thần "sửa im lặng 15 phút" (`core/cau_hinh.py`). Quá hạn hoặc đã có
   tương tác thì không rút.
3. **Rút nhưng để bia mộ:** để lại thẻ "tác giả đã rút lúc X" (tiêu đề, ngày, số mốc, kết quả nếu đã đóng sổ),
   nội dung ẩn. Hợp tinh thần "bia mộ" nhất, nhưng phức tạp nhất, và phải chốt bình luận của người khác ở lại hay
   ẩn.
4. **Giữ hiện trạng** (lưu trữ tự do): nhanh, nhưng ngược tinh thần "không sửa được lịch sử".

*Nhận xét của tôi, không phải quyết định:* phương án 2 khớp nhất với thiết kế sẵn có (cửa sổ 15 phút, bia mộ) và
vẫn cho tác giả sửa lỡ tay; phương án 1 nếu muốn giữ "đã công khai là đã ghi sổ" tuyệt đối.

### Liên quan

- **Việc 1 và plan bot: không bị chặn.** Bot chỉ đi riêng tư → công khai.
- `plans/2026-11-09-va-ro-mach-rieng-tu.md`: `luu-tru` là một cửa chỉ-tác-giả trong bảng. Nếu việc này đổi luật
  lưu trữ thì bảng cửa và bài đo phải cập nhật theo.
- Sổ `P-20261109-4` (`archived_at` bị bỏ sót ở `nap_*` và tìm kiếm).
- `PLAN.md` nguyên tắc 2 và 3; `/luat`; việc 5 (rủi ro "giấu lệnh thua").

### Câu hỏi mở — đừng tự trả lời

- **ĐÃ TRẢ LỜI 2026-11-09 — có cho tác giả rút mạch đã công khai không:** không (một chiều). Câu về điều kiện,
  thời gian, đã đóng sổ hay chưa không còn đặt ra.
- "Lưu trữ" của tác giả trên mạch **đã công khai**: bỏ hẳn, hay còn một ngoại lệ nào? (Hệ quả trực tiếp, chưa chốt.)
- Lưu trữ mạch **còn riêng tư**: giữ cho tác giả không?
- Mặc định lúc tạo mạch: **đã chuyển sang việc 9** (user muốn công khai / riêng tư là mục focus trong form).
- Lối xin gỡ cho ca đặc biệt: ai nhận, ai quyết, ghi audit thế nào?
- Khi **mod** ẩn một mạch: bình luận và "trích" của người khác ra sao? (Câu "thuộc về ai khi mạch bị rút" chỉ
  còn đặt ra ở ca này.)
- *Chưa kiểm:* hồ sơ "Được trích ×N" và các số đếm có loại mạch lưu trữ không; thông báo cũ trỏ vào mạch lưu trữ
  hiển thị ra sao.

---

## Việc 8 · Chủ đề thảo luận (kiểu "Tuần này VN-Index có gì", "Làm sao để cắt lỗ…") — CHƯA QUYẾT

**Nguồn (user, 2026-11-09, sau tài liệu việc 5):** "road map bỏ qua"; có mấy phần đáng cân nhắc, trong đó các
**chủ đề thảo luận**, ví dụ *"Tuần này VN-Index có gì"*, *"Làm sao để cắt lỗ…"*, "và nhiều mục khác". Nội dung
trọng tâm cũ vẫn đăng nhưng không còn là focus (xem việc 4). **Chưa nói ai đăng, nhịp thế nào, đặt ở đâu.**

### Hiện trạng (đọc code và đường ống, 2026-11-09)

- **Không có khái niệm "chủ đề thảo luận" khác bài.** `Mach` không có trường loại (`api/core/models/dien_dan.py:139–248`).
  Hôm nay một chủ đề thảo luận chỉ là **một mạch thường** có mốc 1 là câu hỏi, và khán đài là chỗ trả lời (mặt BÃO,
  `PLAN.md` 5.5). Để *đăng* được không cần model mới; cái thiếu là chỗ **trưng** nó và **nhịp lặp** (theo tuần).
- **Chuyên mục `hoi-dap` hiện đi ngược thứ user nêu.** `scripts/bai-viet/lich/hoi-dap.md:12` cấm "tuyệt đối" biến
  thành "hỏi đáp vụn vặt kiểu diễn đàn": nó là đường ống **bài giải thích cơ chế** do `gikky-team-member` đăng, không
  phải chỗ mở lời mời cho người khác. Không dùng lại nguyên trạng được.
- **`question_for_crowd` là câu hỏi gắn CUỐI bài**, còn chủ đề thảo luận thì **câu hỏi chính là bài**. Hai thứ này
  khác nhau về vai; cái thứ nhất đang nằm trong câu hỏi mở của việc 3 (có phải "câu mồi" không).
- **Cơ chế xếp theo thảo luận đã có:** feed "Đang diễn ra" sort theo `last_discussion_at` (`dien_dan.py:242`).
- Hai ví dụ gần với chuyên mục sẵn có: "Tuần này VN-Index có gì" — định kỳ theo tuần, nhóm Chứng khoán VN / Vĩ mô;
  "Làm sao để cắt lỗ" — không hết hạn, nhóm Quản trị vốn / Tâm lý giao dịch. Một cái lặp theo lịch, một cái là chủ
  đề thường trực; chúng có thể cần cách trưng khác nhau. *(Nhận xét của tôi.)*

### Chạm luật cứng và việc 6 — cần user phân định

- **Ai đăng câu hỏi?** Nếu "Đội ngũ"/AI đăng chủ đề để mời bình luận thì rơi vào vùng mờ "bài dạng câu view/câu like"
  (việc 3, câu hỏi mở b; việc 5, mục "Content Seeding"). Nếu chính user hoặc thành viên thật đăng thì không.
- **Ai trả lời?** Luật cấm bình luận giả. Site chưa có thành viên ⇒ lúc đầu mọi chủ đề sẽ trống. Có cho AI/bot trả
  lời trong chủ đề của người khác không (hôm nay `bot-trader` đã trả lời bình luận, chỉ trong mạch của nó)?
- **Trạng thái trống:** `PLAN.md` nguyên tắc 9 đã cho phép (dưới 4 bình luận thì ẩn số đếm, hiện một dòng mời).
  Chỗ thật sự phải nghĩ là trang chủ trưng ra sao khi chủ đề chưa ai trả lời.

### Câu hỏi mở — đừng tự trả lời

- "Nhiều mục khác" ngoài chủ đề thảo luận là những mục nào trong tài liệu?
- Chủ đề thảo luận là **loại bài riêng** (có nhãn, có chỗ trưng riêng), hay chỉ là mạch thường do ai đó đặt câu hỏi?
- **Ai đăng:** user, Đội ngũ có gắn nhãn, thành viên, hay cả ba? AI có được đăng không, theo luật nào?
- Nhịp: "Tuần này…" một lần mỗi tuần vào ngày nào? Chủ đề thường trực đặt ở đâu?
- `hoi-dap` cũ: giữ như đường ống bài giải thích (phụ trợ), tách hẳn khỏi chủ đề thảo luận mới?
- Có đưa chủ đề thảo luận lên làm **thứ người ngoài thấy đầu tiên** (câu "thứ người ngoài cần" của việc 4) hay
  chỉ là một mục phụ cạnh nhật ký?

### Phản biện của user (2026-11-09, cùng ngày) — làm yếu hướng này ở giai đoạn đầu

Nguyên ý: **không có bình luận thì chủ đề thảo luận vô nghĩa, và nếu có ai ghé qua thì họ không có gì để quay lại.**
Tôi đồng ý: dòng "trống thì để trống" ở trên chỉ là cách *hiển thị* ổn, không phải lý do để người ta quay lại.
Chủ đề thảo luận là **kết quả** của việc có người, không phải cách kéo người về; ở giai đoạn 0 thành viên nó chưa
chạy được. Đề xuất (CHƯA duyệt): hạ xuống làm bước sau, và dùng "Tuần này VN-Index có gì" như một **bài định kỳ có
nhãn** chứ chưa phải chủ đề thảo luận.

Kiểm code về chuyện "khách quay lại bằng gì" (2026-11-09): có RSS (`apps/web/app/feed.xml`, `app/s/[sub]/feed.xml`);
có **email digest tuần** (`api/core/digest.py`, `gui_digest.py`) nhưng **chỉ cho người đã có tài khoản và đã theo
dõi một mạch**; không thấy cách để khách chưa đăng ký nhận nhắc (email, Telegram…). Chưa kiểm digest có chạy trên
prod không. Hệ quả: khách thích gikky cũng không có nút "nhắc tôi" nào ngoài việc đăng ký.

Căng thẳng cần user phân định: luật Việc 1 (lệnh Bot Trader private tới khi đóng sổ) **chính là cắt phần "đang diễn
ra"** khỏi mắt khách, tức phần duy nhất tự thay đổi mà không cần ai bình luận. Khách chỉ còn thấy truyện đã kết. Một
lối (chưa chọn, chưa kiểm khả thi): chỉ công khai *sự tồn tại* của lệnh mở (số lượng, dấu giờ) còn nội dung niêm
phong tới khi đóng sổ — cần code mới, và lộ một phần thông tin.

### Liên quan

Việc 3 (luật cứng, `question_for_crowd`) · Việc 4 (trang chủ, vai phụ trợ của bài) · Việc 5 (Content Seeding) · Việc 6
(con gà – quả trứng) · `PLAN.md` nguyên tắc 9.

---

## Việc 9 · Thiết kế lại form đăng mạch: công khai / riêng tư phải là mục FOCUS, không phải một ô tick — ĐÃ CHỌN: HAI NÚT; đã lập plan, chưa chạy

**Yêu cầu (user, 2026-11-09):** hôm nay chọn riêng tư hay công khai là một checkbox; không tick thì mặc định là
công khai. Tính năng chỉ là một ô tick nên dễ bị bỏ qua. Cần **thiết kế lại form nhập** để công khai hay riêng tư
là **một mục focus** trong form.

Nối với việc 7: công khai là một chiều, nên một lần bỏ qua ô tick là một lần đăng không rút lại được.

### Quyết định (user, 2026-11-09): HAI NÚT

Chọn **hướng 2**: bỏ ô tick, thay bằng **hai nút gửi "Lưu riêng tư" và "Đăng công khai"**, không có trạng thái mặc định.
Hành động bấm chính là lựa chọn. Plan: `plans/2026-11-09-form-dang-mach-hai-nut.md` (đã lập, **chưa chạy**). Các điểm
plan đã chốt giúp, cần user xem lại: dòng mô tả luôn hiện dưới mỗi nút; hai nút cùng cỡ và cùng độ nổi; **Enter trong ô
tiêu đề không còn gửi form** (hôm nay nó đăng công khai ngay khi form đủ); nút công khai giữ `data-testid`
`dang-mach-gui` để 11 chỗ e2e cũ không phải sửa; mobile đưa hai nút ra khỏi khối "Nâng cao"; hộp xác nhận ở trang mạch
thêm câu "Không rút lại được."; tầng API **không** đổi. **Không deploy trước plan vá rò.**

### Hiện trạng (đọc code, 2026-11-09)

Có **ba chỗ tạo mạch**, cả ba đều là một công tắc nhỏ và đều mặc định công khai:

- **Web, trang đăng bài** — `apps/web/components/form-dang-mach.tsx:274–281`, `useState(false)` ở `:47`. Checkbox
  "🔒 Nhật ký riêng tư (Chỉ mình tôi xem, có thể công khai sau)" nằm cuối form, ngay dưới ô "Tắt bình luận", **cùng
  kiểu và cùng cỡ** (`css.tuy_chon`), sát nút gửi. Nút chỉ ghi "Đăng bài", không nói kết quả là công khai hay riêng
  tư. Nhãn chỉ mô tả vế riêng tư; vế công khai (mặc định) không được nói ở đâu cả.
- **Web, ngăn đăng nhanh** — `drawer-dang-nhanh.tsx:543–548`, `useState(false)` ở `:85`, reset về `false` sau mỗi lần
  gửi (`:329`). Cùng nhãn, cùng khối tuỳ chọn với "Tắt bình luận".
- **Mobile** — `apps/mobile/app/mach/new.tsx:320–337`, `useState(false)` ở `:52`. Nó nằm trong khối **"Nâng cao",
  mặc định gập** (`moNangCao`, `:49`, `:270`). Người dùng mobile mặc định **không nhìn thấy** lựa chọn này và đăng
  công khai.
- **API** — `MachMoiIn.rieng_tu: bool = False` (`api/api/schemas_ghi.py:92`). Client nào bỏ qua trường này (bot hôm nay,
  mobile cũ) thì ra công khai. Mặc định công khai nằm ở **hai tầng**: giao diện và API.
- **Khôi phục từ bản nháp:** trang đăng bài lưu nháp vào `sessionStorage` (`form-dang-mach.tsx:53–61`, dùng khi bị
  chuyển đi đăng nhập rồi quay lại) **kèm cả lựa chọn riêng tư**. Một lựa chọn cũ quay lại mà không ai nhìn lại.
- **e2e:** chỉ `apps/web/e2e/don-vi/seo-on-page.spec.ts` nhắc "riêng tư" (chưa mở xem ngữ cảnh); chưa thấy bài đo nào
  bấm ô này.

### Vì sao một ô tick không đủ

- Nó ngang hàng với "Tắt bình luận", trong khi hai thứ có hệ quả khác hẳn nhau (một cái đảo ngược được, một cái
  thì không) mà trông giống hệt nhau.
- Chỉ nói vế "riêng tư": người không tick **không được báo** rằng mình vừa công khai, và sẽ không rút lại được.
- Nút "Đăng bài" không nêu kết quả.
- Ở mobile nó bị giấu hẳn.

### Hướng thiết kế — ĐÃ CHỌN hướng 2 (giữ danh sách để biết đã bỏ gì)

1. **Hai thẻ lựa chọn lớn, không chọn sẵn.** "🔒 Riêng tư — chỉ mình bạn thấy, công khai sau được" và "🌐 Công khai —
   mọi người thấy ngay, **không rút lại được**". Phải chọn mới đăng được; nút tắt kèm lý do theo khuôn "nút chết" đã
   có ở form (`LY_DO_THIEU`, `form-dang-mach.tsx:288–297`).
2. **Hai nút gửi thay cho ô tick:** "Lưu riêng tư" và "Đăng công khai". Hành động chính chính là lựa chọn, không còn
   trạng thái mặc định. Gọn nhất cho ngăn đăng nhanh và mobile; rủi ro là hai nút nặng ngang nhau làm người mới
   phân vân.
3. **Mặc định riêng tư**, thẻ hoặc nút công khai nổi bật kèm xác nhận. An toàn nhất với một chiều, nhưng một bài
   "đăng" mà ra riêng tư có thể làm người ta tưởng đã đăng. Bù bằng banner và nút "Công khai" nổi bật ở trang mạch
   (đã có `banner_rieng_tu` ở `trang-mach.tsx:448`).

Mọi phương án đều phải: dùng **một mẫu thống nhất cho cả ba chỗ**; nói rõ bằng chữ **cả hai vế**; không âm thầm
khôi phục lựa chọn từ bản nháp (hoặc khôi phục nhưng hiển thị rõ); và nút "Công khai" ở trang mạch
(`khoi-chu-mach.tsx`) phải có xác nhận "không rút lại được".

### Tầng API — quyết riêng

Có nên bỏ mặc định `rieng_tu = False` và bắt buộc gửi trường này? Lợi: không client nào lỡ công khai. Hại: đổi hợp đồng
của bot (`scripts/bot-trader/dang_bai_bot_trader.py:55–62`), mobile cũ, các test (2197) và phải `pnpm codegen`.
Đề xuất của tôi: làm giao diện trước, cân nhắc API sau.

### Thứ tự — quan trọng

**Vá `P-20261109-3` TRƯỚC khi làm nổi bật riêng tư** (`plans/2026-11-09-va-ro-mach-rieng-tu.md`). Làm riêng tư thành
lựa chọn dễ thấy sẽ đẩy người dùng vào đúng chỗ đang rò: mạch riêng tư lọt vào tìm kiếm, người lạ theo dõi và nhận
tiêu đề qua chuông, người lạ bình luận vào đó.

### Câu hỏi mở — đừng tự trả lời

- **ĐÃ TRẢ LỜI 2026-11-09 — hướng nào:** hướng 2 (hai nút).
- **ĐÃ TRẢ LỜI (suy ra từ hướng 2) — có mặc định không:** không, hai nút ngang nhau, bấm mới chọn.
- API có bắt buộc `rieng_tu` không?
- **Plan đã đề xuất, chờ user xem lại:** ngăn đăng nhanh có hai nút ngay trong ngăn; mobile đưa hai nút ra khỏi
  "Nâng cao"; hộp xác nhận ở trang mạch thêm câu "Không rút lại được."
- Người dùng đã quen "Đăng bài là công khai": có cần báo họ về thay đổi không?

### Liên quan

Việc 7 (một chiều) · Việc 6 ("dùng một mình trước": riêng tư thành lựa chọn thường) · Việc 2 (tinh thần "note") ·
plan vá rò riêng tư · sổ `P-20261109-3` · `PLAN.md` mục 9 (UI spec).
Plan form hai nút: `plans/2026-11-09-form-dang-mach-hai-nut.md`.

---

## Việc 10 · Vai AI gắn nhãn "đọc lại sau khi biết kết quả" — PHÁC THẢO, CHƯA DUYỆT

**Nguồn:** user hỏi (2026-11-09) có seed user kèm tính cách rồi cho thảo luận được không; tôi trả lời không nên
(xem Việc 6) và nêu biến thể một vai AI gắn nhãn; user chọn "phác thử vai AI". Đây là bản phác để cân nhắc, **không
phải plan để code**. Nguyên tắc: **một giọng, có nhãn, không đóng người, không bắt chước đám đông.**

### Phác thảo

1. **Danh tính.** Tài khoản riêng, `display_name` kiểu "gikky Phản biện (AI)"; bio: tài khoản AI do chủ gikky.net vận
   hành, không phải người, không độc lập với site, không khuyến nghị mua bán. **Hôm nay nhãn chỉ là chữ** trong
   `display_name` (60 ký tự) / `bio` (500) ở `api/core/models/nguoi_dung.py:31–34`; không có cờ hay huy hiệu có cấu
   trúc. Khách đọc bình luận mà không mở hồ sơ sẽ không biết đó là AI ⇒ cần cờ kiểu `la_ai` + huy hiệu cạnh tên
   trước khi vai này chạy (code nhỏ nhưng là code, cần plan). Điều này đúng cả với `bot-trader` hiện tại.
2. **Một việc duy nhất:** một bản "Đọc lại" dưới mạch **đã đóng sổ và đã công khai** (nên không đụng luật Việc 1,
   không mớm kèo): (a) giả định lúc vào lệnh, trích từ mốc kèm dấu giờ; (b) kết quả so với giả định, chỉ dùng số liệu
   có trong mạch hoặc nguồn công khai có ghi; (c) một điểm có thể đã làm giả định sai, hoặc một cách đọc khác. Dưới
   200 từ. **Cố ý không có câu hỏi mời người đọc ở cuối** (tránh vùng mờ `question_for_crowd`, Việc 3).
3. **Không làm:** không đóng vai người; không trả lời bình luận của người thật (ít nhất ở giai đoạn đầu); không
   vote, reaction, follow; không khuyến nghị, dự báo, giá mục tiêu; không bình luận mạch của người khác nếu họ không mời.
4. **Phạm vi.** Giai đoạn 1: chỉ mạch Bot Trader đã đóng sổ. **Giới hạn phải nói thẳng:** AI đọc lại AI, cùng chủ vận
   hành ⇒ đây là *bình luận biên tập*, **không phải kiểm toán độc lập**; đừng gọi là "xác minh". Giai đoạn 2 (khi có
   thành viên): tác giả tự bấm "nhờ AI đọc lại" trên mạch của mình, mặc định **chỉ tác giả thấy**, tác giả chọn có
   đăng hay không. Đây mới là phần có giá trị thật cho người dùng, kể cả dùng một mình (nhật ký riêng tư có người đọc
   lại). Phải nói rõ nội dung mạch được gửi tới dịch vụ AI.
5. **Tác dụng phụ phải xử lý trước.** Bình luận đi đường thường sẽ cộng vào `comment_count`, và bình luận dài ≥80 ký
   tự **luôn** làm mới `last_discussion_at` (`api/core/ghi.py:592–618`). Mạch đã đóng sổ có lẽ không lên tab "Đang
   diễn ra" (feed lọc mạch mở, `PLAN.md` 5.9; **chưa kiểm**), nhưng số đếm vẫn tăng và khán đài trông có người.
   Hôm nay 8/16 bình luận ở mạch bot đã là của chính `bot-trader` (Việc 3). Hai lối: loại bình luận có cờ `la_ai` khỏi
   hai số đó; hoặc đăng "Đọc lại" thành **mạch riêng** của tài khoản AI thay vì bình luận.
6. **Giới hạn trung thực.** Vai này chỉ cho khách một lý do để đọc. Nó không phải lý do quay lại cho tới khi có mạch
   đóng sổ mới đều đặn, và không thay được người thật.

### Phản biện của user (2026-11-09, cùng ngày): "khi bắt đầu có thành viên thì cần gì AI nữa"

Đồng ý. Vai AI chỉ là **giàn giáo cho giai đoạn không có người**; khi có người thật bình luận thì phần việc đó
thuộc về họ. Hệ quả:

- Nếu làm thì phải có **điều kiện rút** viết sẵn từ đầu (vd khi mạch của thành viên thật bắt đầu có bình luận thật
  đều đặn thì dừng đăng; bản cũ giữ lại có nhãn).
- **Giai đoạn 2 chỉ là phỏng đoán chưa chứng minh**, không phải nhu cầu. Chỉ làm nếu thành viên thật xin; biến nó
  thành một câu hỏi cho 5–10 người đầu tiên.
- **Phát hiện khi kiểm:** `bai_hoc` lúc Bot Trader đóng sổ hiện là **câu mẫu**, không có thông tin riêng từng lệnh
  ("Đóng lệnh cắt lỗ kỷ luật tại X. Bảo toàn nguồn vốn cho các cơ hội tiếp theo." / "Đạt mục tiêu Take Profit…" —
  `scripts/bot-trader/eod_checker.py:286, 331, 476, 520, 602, 646`). Chỗ trống mà bản "Đọc lại" định lấp thật ra
  nằm ở đây. **Lối rẻ hơn, chưa duyệt, chưa kiểm khả thi:** viết `bai_hoc` thật cho từng lệnh (giả định lúc vào so
  với kết quả) ngay trong lúc đóng sổ. Tác giả đã tự nhận là bot; không cần tài khoản AI mới, không cần cờ `la_ai`,
  không đụng `comment_count`. Cần xem dữ liệu lệnh có lưu lý do vào lệnh không (`vi_the_dang_mo.json`).
- **Khuyên của tôi:** bỏ vai "Phản biện" làm tài khoản riêng; nếu vẫn muốn lấp chỗ trống thì sửa `bai_hoc`.

### ĐÃ CHỐT (user, 2026-11-09): giai đoạn 2 BỎ

Tôi hỏi "nhờ AI đọc lại" để làm gì; chỗ cụ thể duy nhất là soi độ lệch giữa điều tác giả viết lúc vào lệnh và điều họ
làm sau đó (vd dời cắt lỗ không nói lý do). User trả lời: **đó là việc của họ, không cần quan tâm — "deal của họ,
họ không nhớ thì ai nhớ được".** Vai trò của site là **ghi lại** (mốc append-only, hai dấu giờ); độ lệch nằm sẵn
trong lịch sử cho ai đọc cũng thấy, site không đi canh kỷ luật hay nhắc nhở. ⇒ Không làm "tác giả bấm nhờ AI đọc
lại", cũng không làm bất kỳ tính năng soi/nhắc hành vi giao dịch của người dùng.

**Còn mở:** giai đoạn 1 (vai AI riêng cho Bot Trader) so với chỉ sửa `bai_hoc` của bot — user chưa chọn.

### Quyết định cần user — chưa chọn

- Có làm vai này không (hay thay bằng sửa `bai_hoc` của bot)? Đặt ở giai đoạn 1 (Bot Trader) hay đợi giai đoạn 2 (nhờ AI đọc lại, có thành viên)?
- Bình luận dưới mạch hay mạch riêng của tài khoản AI?
- Thêm cờ `la_ai` + huy hiệu trước khi chạy (tôi khuyên: có, và áp luôn cho `bot-trader`)?
- Luật cứng: bình luận gốc của AI trên mạch cần user duyệt từng loại trước khi bot đăng (đã ghi từ trước).

### Liên quan

Việc 1 (đóng sổ rồi mới công khai) · Việc 3 (`question_for_crowd`, `binh_luan_vao_mach`) · Việc 6 (ranh giới
giả/thật; hướng 4: Bot Trader công khai là bot) · Việc 8 (chủ đề thảo luận) · `PLAN.md` nguyên tắc 9.

---

## Việc 11 · Homepage v2 (nhánh `v2`) — trường `loai_mach` ĐÃ LẬP PLAN; bố cục CHƯA DUYỆT

**Yêu cầu (user, 2026-11-10):** "làm homepage v2", trên nhánh `v2` (tách từ `main` @ `748f95f`, 2026-11-09).

### Đã chốt (user, 2026-11-10)

- **Tin tức và bài viết nằm ở khối phụ bên dưới homepage v2** (không chuyển sang trang riêng, không gắn vào từng mạch).
- **Nhận ra "nhật ký" bằng một trường tường minh trên `Mach`**, không suy ra. Lý do (đo trên prod 2026-11-10, 450 mạch
  công khai): `entry_count >= 2` chỉ đúng 21% (bản tin của `gikky-team-news` có 51/53 bài ≥2 mốc); `truong_phai` do bài
  Đội ngũ chiếm; `status=closed` sạch (17/17 là lệnh thật) nhưng chỉ vì hôm nay chỉ người ghi nhật ký mới đóng sổ.
- **Trường chỉ dành cho gikky chọn; người dùng thường mặc định là nhật ký.** Tên là `loai_mach` (không phải `loai`,
  đã là chip của MỐC). Plan: `plans/2026-11-10-truong-loai-mach.md`.
- Người dùng thường nên **không có ô chọn** ở form ⇒ không đụng plan form hai nút (việc 9).

### Quyết định kỹ thuật phiên chính tự đưa ra (user chưa xem lại)

- Cổng quyền là cờ mới `User.la_tai_khoan_doi`, vì hai tài khoản đăng bài `gikky-team-*` có `is_staff=False`.
- Mặc định theo tác giả ở server (tài khoản có cờ → `bai_viet`) để các đường ống tin / bài **không phải sửa**.
- Người thường gửi `bai_viet` → 403 (không nuốt im). `admin` không có cờ (mặc định).
- Backfill theo tên tài khoản: dự báo prod 427 `bai_viet` / 23 `nhat_ky`; 2 bài kiểu bài viết của `muinx2022` sẽ là `nhat_ky`.

### Còn mở

- **Bố cục homepage v2** (khối đầu trang nói gì, có nút "Mở nhật ký" không, nhật ký đã đóng sổ trưng ra sao, khối
  tin & bài nằm bao nhiêu mục, link "xem tất cả" đi đâu): phiên chính sẽ đề xuất; **chưa duyệt, chưa có plan**.
- Feed cũ (tab, `?khoang=`, `?cursor=`) vẫn phải còn nguyên: nhiều bài đo e2e đứng ở `/`.
- Chưa deploy; deploy phải `pg_dump` trước (migration đổi schema + backfill).

### Yêu cầu bố cục (user, 2026-11-10, sau khi bác A/B) — plan: `plans/2026-11-10-homepage-v2.md` (bản nháp, chưa chạy)

"Làm lại home page với phần chủ đề thảo luận, nhật ký mới và trình bày lại phần bài viết. Thay đổi bố cục nếu cần. Bỏ
phần left, chỉ giữ giao diện 2 cột. Màu sắc không thay đổi."
- **Chủ đề thảo luận** = vài chủ đề kiểu "VN-Index tuần này thế nào", "bạn đang giao dịch hay đánh bạc", "giá dầu, vàng bạc
  bị ảnh hưởng bởi cái gì". User **chưa quyết** nó là loại riêng hay gộp loại cũ; phiên chính chọn **loại riêng
  `thao_luan`** (giá trị thứ ba của `loai_mach`, chỉ tài khoản gikky chọn được; bổ sung ở mục 7 của plan loai_mach). Đổi
  ý chỉ tốn việc đổi nhãn vài mạch. Khối ẩn hẳn khi chưa có chủ đề nào. Luật cứng việc 3/8: không để AI tự đăng hàng loạt.
- **Chủ đề — user nói rõ thêm (2026-11-10):** do gikky tạo, **mod cũng tạo được**; "không phải bài viết, cũng không phải
  nhật ký: là nơi mọi người cùng quan tâm tới một vấn đề trong tuần". Hỏi: khi chủ đề đóng thì truy cập lại ở đâu?
  ⇒ phiên chính đề xuất **trang kho `/chu-de`** (nhóm theo tuần, chip Đang mở / Đã đóng, phân trang bằng link thật, canonical
  và sitemap riêng), nối từ khối Chủ đề trên homepage, từ rail phải và từ trang mạch của chủ đề. Mod = `is_staff`
  (người chỉ có bản ghi `ModSub` không tính — chưa được yêu cầu). Đóng chủ đề dùng lại "đóng sổ" sẵn có (`ket_qua`,
  `bai_hoc` làm tổng kết); **tác giả hoặc mod (`is_staff`)** đóng / mở lại được chủ đề (bản đầu cho cả tài khoản gikky có cờ; phản biện chỉ ra
  `gikky-team-member` là tài khoản pipeline AI cầm được nên đã thu hẹp, plan loai_mach mục 9). Mod đóng / mở lại chủ đề của người khác
  có ghi `AuditLog`; mở lại chủ đề không còn xoá tổng kết. Plan loai_mach mục 8–9; plan homepage 3.8.
  **Lỗ hổng đã biết, chưa sửa:** chủ đề bị mod khoá thì không đóng / mở lại được, và `tat_binh_luan` vẫn chỉ tác giả (liên quan câu hỏi
  "khoá bình luận khi đóng" bên dưới).
  **Điểm mở:** sau khi đóng, bình luận còn được không (mặc định giữ như "đóng sổ": còn); có tự đóng sau 7 ngày không (mặc
  định: không, đóng tay).
- **Homepage chỉ hiện MỘT chủ đề (user, 2026-11-10, sau Đợt B):** "chủ đề tôi nghĩ là chỉ nên 1 thôi chứ" — khớp "1 vấn đề trong tuần". Bản Đợt A/B hiện 6
  vì phiên chính đọc "vài chủ đề" thành nhiều; đã đính chính ở `plans/2026-11-10-homepage-v2.md` mục "QUYẾT ĐỊNH MỚI" (vòng sửa 2, chưa chạy): một thẻ
  nổi = chủ đề mới nhất bất kể trạng thái; các chủ đề trước ở `/chu-de`. **User chốt thêm:** tạo chủ đề thứ hai khi chủ đề cũ còn mở thì **cảnh báo rồi vẫn cho lưu**
  (không chặn ở server), và home **luôn chỉ hiện 1 chủ đề mới nhất**. Cảnh báo nằm ở form đăng bài admin (vòng sửa 3 trong plan homepage, cần thêm bộ lọc
  `loai_mach` vào `GET /admin/machs`).
- **Chuyên mục (sub) dùng CHUNG cho nhật ký, bài viết và chủ đề (user hỏi 2026-11-10, sau lần chạy thử):** ví dụ user nêu — nhật ký "HPG – mua vì kỳ vọng dung quất và thép" chọn
  `chung-khoan`; "mua USD/AUD vì kỳ vọng USD tăng" chọn `ngoai-hoi`; bài viết cũng thuộc các chuyên mục đó. Đúng với mô hình hiện có: `Mach.sub` bắt buộc cho mọi loại, `loai_mach`
  là trục KHÁC (nhật ký / bài viết / chủ đề) — chuyên mục là trục "chủ đề thị trường", loại là trục "dạng nội dung". Trang `/s/<sub>` hiện **lẫn mọi loại** (chưa có bộ lọc theo loại);
  khối "Chuyên mục" ở rail phải của `/` và `/chu-de` là điều hướng tới các trang đó. Trên prod có 8 chuyên mục: `quan-tri-von`, `vi-mo`, `chung-khoan`, `tin-tuc`, `tam-ly-giao-dich`,
  `hoi-dap`, `crypto`, `ngoai-hoi` — vài cái là kiểu toà soạn (tin-tuc, hoi-dap, quan-tri-von, tam-ly-giao-dich) chứ không phải lớp tài sản; xem việc 2 / 4. **Chưa quyết:** có thêm lớp tài sản
  còn thiếu (hàng hoá, phái sinh…) hay giữ 8; có thêm chip lọc Nhật ký | Bài viết | Chủ đề trong `/s/<sub>` không.
- **Xem trước của hàng Bài viết trên `/` (user, 2026-11-10):** "nếu có nhiều ảnh thì tạo gallery, nếu có 1 ảnh thì hiển thị 1 ảnh, nếu không có ảnh thì hiển thị xxx dòng text" ⇒ trả lời câu "có thêm dòng
  xem trước không": **có**, ba nhánh theo `so_anh`. `xxx` chưa có số — phiên chính chọn **3 dòng** (độ dài `DAI_TRICH_FEED` thiết kế cho); gallery cần API thêm `XemTruocOut.anh_khac` (tối đa 2 ảnh nữa);
  phiên chính thêm một dòng chữ dưới ảnh làm chú thích / chỗ dựa khi ảnh 404 (chưa được user duyệt, bỏ được bằng một điều kiện). Plan: `plans/2026-11-10-bai-viet-xem-truoc-anh.md` (chưa chạy; chờ nghiệm thu hai cột).
- **Gallery kiểu Reddit (user, 2026-11-10/11):** "homepage, phần gallery, làm 1 dạng gallery như của reddit luôn, không phải show list ảnh như vậy" ⇒ thay phần "≥ 2 ảnh" của mục trên: MỘT khung lật từng ảnh (scroll-snap, nút trước / sau, bộ đếm `n/N`, tối đa 10 ảnh, slide "Xem tất cả N ảnh" cho ảnh NHÚNG > 10); bài 1 ảnh và 0 ảnh giữ nguyên. Plan `plans/2026-11-10-gallery-kieu-reddit.md`. Chưa hỏi user: chiều cao khung (360px), có áp kiểu này cho thẻ nhật ký không, giữ dòng chú thích dưới khung không.
- **Khối Bài viết trên `/` chỉ 10 hàng (user, 2026-11-10, sau chạy thử):** thay 30; xem "VÒNG SỬA 5" ở plan homepage.
- **GIAO DIỆN CHUNG TOÀN WEB LÀ HAI CỘT (user, 2026-11-10):** "thống nhất giao diện chung của web là 2 cột, 1 cột content và cột bên phải" ⇒ trả lời câu hỏi bỏ cột trái bên dưới:
  **mọi trang `apps/web`**, không chỉ homepage. Một khung, một lưới (760px + rail 300px), cột trái `CotTrai` bỏ hẳn; chuyên mục / khối khách / tài nguyên chuyển sang rail phải. Plan:
  `plans/2026-11-10-hai-cot-toan-site.md` (chưa chạy). Chữa luôn "cú nhảy ngang 193px" phản biện đã đo. `apps/admin` không thuộc việc này.
- ~~**Bỏ cột trái chỉ ở homepage** (mặc định phiên chính; user chưa trả lời câu hỏi này).~~ *(Đã thay bằng quyết định trên.)* Phản biện đo: điều hướng `/` → `/s/x` làm cột nội dung nhảy ngang 193px
  (x=85,w=760 so với x=278,w=635). `/s/<sub>` giữ ba cột.
- Giữ nguyên title, meta, JSON-LD, chữ h1/lede, feed cũ ở `/?tab=…`; chỉ đổi bố cục. Đánh đổi chấp nhận: link `/m/`
  trên `/` tối đa 50 → 44.

### Ràng buộc SEO — user nêu 2026-11-10, số đo cùng ngày (phương án A và B đều bị bác)

User: bot vào trang chủ khá nhiều, đổi thì mất nhiều lượt bot đã index. Đo trên prod (`core_tongngay`, `core_luotxem`,
chỉ SELECT, phiên chỉ-đọc; dữ liệu 2026-08-29 → 2026-11-08):

- Toàn kỳ: **6.704 lượt người / 46.919 lượt bot** (bot 87%).
- 30 ngày gần nhất: trang chủ `/` **167 người / 10.951 bot** (bot 98,5%); `/m/*` (635 URL) 538 người / 12.112 bot;
  `/s/*` 68 / 3.458.
- Bot vào `/` (toàn kỳ, raw): facebookexternalhit 5.723 (xem trước link, không phải index), PetalBot 3.319, "khác" 2.534,
  MJ12 1.317, **Googlebot 689**, ClaudeBot 274, Meta 272, Amazonbot 268, GPTBot 205, OAI-SearchBot 171.
- Người thật hầu hết vào thẳng một trang mạch (`/m/`), không qua trang chủ; nguồn Google chỉ vài chục lượt.
- `app/sitemap.ts` lấy mạch bằng `docFeed("moi")` **không lọc** và đặt `/` priority 1 ⇒ **cấm đổi mặc định của
  `/feeds/moi`** (thêm tham số lọc là được, đổi mặc định là sitemap rụng 427 bài).

Hệ quả cho bố cục: A lọc feed `/` còn nhật ký ⇒ bài và tin biến khỏi `/` (link nội bộ và lối `?cursor=` bot đang bò);
B dời feed sang URL mới. **Hướng còn lại: chỉ CỘNG, không BỚT** — giữ nguyên `<title>`, meta, JSON-LD, h1/lede, feed
không lọc, tab, `?cursor=`; chỉ thêm khối nhật ký phía trên. Chặn bằng phép đo: link và `<head>` của `/` (và
`/?tab=moi&cursor=…`) trước và sau phải là "sau ⊇ trước". **Không** phục vụ nội dung khác cho bot và người (cloaking).

---

## Việc 12 · Câu hỏi của người dùng ("có bác nào biết đọc BCTC không?") — ĐỀ XUẤT, CHƯA QUYẾT

**Vấn đề (user, 2026-11-10):** người dùng muốn hỏi một câu, thông tin đó vào đâu? Nó không phải nhật ký, bài viết hay chủ
đề (chủ đề do gikky / mod tạo). Làm thêm một trang riêng thì **không ai vào xem để trả lời**.

**Hệ quả thật của quyết định cũ:** "người dùng thường mặc định là `nhat_ky`" ⇒ một câu hỏi của người dùng sẽ bị gắn nhãn
nhật ký và hiện trong khối "Nhật ký mới" của homepage. Sai khối.

**Đã kiểm code:** `bao_mach_moi` (`api/core/thong_bao.py:449`) đã báo chuông cho người **theo chuyên mục (`TheoSub`)** của
mạch mới và người theo tác giả. Câu hỏi đặt vào đúng chuyên mục (vd BCTC → `chung-khoan`) thì người theo dõi chuyên mục
đó được báo sẵn, không cần xây thêm. Ngăn đăng nhanh (`drawer-dang-nhanh`) và thanh dưới mobile đã có cửa "đăng".

**Đề xuất của phiên chính (chưa duyệt):** giá trị thứ tư `cau_hoi` ("Câu hỏi") của `loai_mach`, **người dùng thường chọn
được** (`nhat_ky` hoặc `cau_hoi`; `bai_viet` / `thao_luan` vẫn hạn chế). Không làm trang đích; câu hỏi đi qua nơi người
ta đã có mặt: (a) cạnh khối Chủ đề trên homepage, chip "Chưa có trả lời" khi 0 bình luận; (b) khối "Câu hỏi chưa có trả lời"
ở **rail phải của mọi trang có rail** (người thật chủ yếu vào qua trang mạch, nên đó mới là chỗ họ đi ngang); (c) nút
"Đặt câu hỏi" dùng ngăn đăng nhanh, form gọn (tiêu đề + nội dung + chuyên mục, luôn công khai, không mốc / figures);
(d) chuông sẵn có tới người theo chuyên mục. Câu hỏi riêng tư không có nghĩa ⇒ server từ chối `cau_hoi` + `rieng_tu`.

**Giới hạn phải nói thẳng:** vị trí đặt chỉ giúp người **đã có mặt** thấy câu hỏi. Site 30 ngày qua có 167 lượt người vào
`/` và chưa có thành viên, nên câu hỏi đầu tiên có thể nằm không ai trả lời. Gikky / mod trả lời câu hỏi thật bằng tài khoản
thật là hợp lệ; bình luận giả hoặc nick ảo thì không (luật cứng, việc 3 và 6).

**Còn mở:** có làm không; đặt nút "Đặt câu hỏi" ở đâu; "xem tất cả câu hỏi" đi tới đâu (đề xuất: feed lọc
`/?tab=moi&loai_mach=cau_hoi`, mỗi câu hỏi vẫn là trang `/m/` index được); mobile app làm sau.

---

## Việc 13 · Khối "Bài viết" trang chủ bỏ sót chuyên mục — ĐÃ CHỌN phương án C + admin chọn ≤4 chuyên mục; ĐÃ GỘP v2 (b02fd65), chưa deploy

Đo dev.gikky.net 2026-11-11: 3 cột ghép cứng 6 slug (`lib/nhom-bai-viet.ts`) ⇒ bài `ngoai-hoi` (3/50) không bao giờ
lên trang chủ. User chọn phương án C (dải "Mới đăng" mọi chuyên mục + giá sách chủ đề) và yêu cầu admin chọn được
chuyên mục nào lên trang chủ, tối đa 4. Plan: `plans/2026-11-11-bai-viet-trang-chu-gia-sach.md`.

---

## Việc 14 · Thống nhất giao diện toàn site theo homepage v2 — ĐÃ LÀM ĐỦ 5 ĐỢT A–E trên `v2` (2026-11-12), chưa deploy

**Yêu cầu (user, 2026-11-11, sau khi xem dev.gikky.net):** khối chủ đề và cột phải trên `/` "vẫn không ổn";
`/?tab=moi&loai_mach=nhat_ky` "trình bày khác hẳn home"; `/s/quan-tri-von` "vẫn là phần cũ, không khớp cái đang làm";
"lên kế hoạch cho toàn bộ các sửa đổi".

**Nguyên nhân gốc:** `app/page.tsx` rẽ nhánh — URL có tham số feed thì chạy `Feed` + `TheMach` cũ, `/` trần chạy
`TrangChuV2` + `TheNhatKy`; `/s/*` luôn là `Feed` cũ. Plan homepage v2 cố ý giữ feed cũ nguyên DOM, nên nay có hai giao diện.

**Plan:** `plans/2026-11-11-thong-nhat-giao-dien-toan-site.md` — 5 đợt (A khối chủ đề + tên hiển thị · B thẻ thống nhất ·
C dải điều khiển + trang lọc + `/s/*` · D hồ sơ + tìm kiếm · E cột phải). Chưa chạy.

**Còn mở (mục 8 của plan):** áp thẻ mới cho hồ sơ / tìm kiếm; bỏ nút Thẻ/Gọn; bỏ tiền tố `u/`; khối "Chủ đề tuần này"
trên rail mọi trang; ba bình luận 14:50 ngày 11/11 ở chủ đề 1484 (dev) giữ hay xoá.

### Việc 13 — bổ sung (user, 2026-11-11): giá sách GIỮ 3 bài mỗi chuyên mục

User thấy giá sách (4 chuyên mục × 3 tiêu đề dài) rối mắt, muốn còn 1 bài mỗi chuyên mục. Đo dev: làm vậy thì link `/m/`
duy nhất trên `/` giảm 21 → 13, dưới ngưỡng ≥ 19 (`trang-chu-giao-dien-moi.spec.ts:649`). **User chốt:** "trước mắt tạm
chấp nhận rối mắt thế đã để kéo bot, còn khi có người vào thì sẽ tính sau" ⇒ KHÔNG đổi, giữ ngưỡng 19. Xét lại khi có
người dùng thật vào trang chủ.

---

## Việc 16 · Sửa giao diện mobile toàn site (đợt M) — ĐÃ LÀM trên `v2` (`076d605`, 2026-11-12), chưa deploy

*(Số 15 bỏ trống: `rieng-tu/VIEC-15.md` của phiên khác đã dùng tên ấy.)*

**Yêu cầu (user, 2026-11-12):** "review lại toàn bộ phần mobile, các trang có trong web, bao gồm cả các trang của user";
xem kết quả soi xong thì duyệt "Lập đợt sửa".

**Đã soi** 26 lượt ở 390px (18 trang khách trên dữ liệu dev, 8 trang/ngăn của user trên `gikky_e2e`): không trang nào
tràn ngang; 3 lỗi nặng (thanh "Cài ứng dụng" che nút "Ghi nhật ký" + chân trang + form; ô nhập < 16px làm iOS phóng to;
ô chọn 13px ở form đăng mạch), 6 lỗi vừa, 3 lỗi nhỏ.

**Plan:** `plans/2026-11-12-sua-mobile.md` (M1–M12, tiêu chí T1–T5 + G). Sửa bằng CSS là chính; desktop và DOM các trang
index được không đổi.

---

## Việc 17 · Sửa lỗi hydrate React #418 khi có phiên lưu — ĐÃ LÀM trên `v2` (`70d4376`, 2026-11-12), chưa deploy

**Yêu cầu (user, 2026-11-12):** "Lập plan sửa #418" — gộp mục sổ P-20261112-6 (và P-20261111-21 phần b).

**Lỗi:** mọi lượt tải có phiên lưu trong trình duyệt (thành viên VÀ khách quay lại) dính #418 ⇒ React bỏ HTML server, vẽ
lại cả trang, xoá thuộc tính `<html>` (cờ chống giật, `color-scheme`). **Gốc:** `components/phien.tsx:82` đọc
`localStorage` làm `fallbackData` ngay lần render hydrate, trong khi server vẽ `toi = null`.

**Plan:** `plans/2026-11-12-sua-hydrate-418.md`: sửa một chỗ ở `PhienProvider` (phiên lưu chỉ vào context sau hydrate,
lật trong `useLayoutEffect`), thêm bài đo `hydrate-sach.spec.ts`, rồi gỡ các gương JS chống giật đợt E thêm vì lỗi này.
HTML server không đổi.
---

## Việc 18 · Khối chủ đề xếp chồng + nút chính màu brand — ĐÃ LÀM trên `v2` (`4ed45b5`, 2026-11-13), đã lên dev.gikky.net (`ee61f94`, 2026-11-13 08:22, chỉ `web`), chưa lên prod

**Yêu cầu (user, 2026-11-12, ảnh dev.gikky.net):** "phần list user cmt như thế này có ổn không? và nhìn nó ngang hàng với
chủ đề thảo luận"; "có mấy nút đen, logo màu xanh, có j không ổn?".

**Đã chốt với user:**
- Nút chính (nút đặc) dùng **`--brand` xanh**, không còn `--ink` đen. Ba chỗ: "Đăng ký" ở header, "Vào thảo luận",
  nút mở nhật ký ở ô soạn. Nút thì **bo tròn hẳn** (pill).
- Khối chủ đề chuyển sang **xếp chồng**: chủ đề rộng hết khối, quan điểm xuống dưới thành ô nền `--inset`, mỗi quan
  điểm một dòng. User chọn sau khi xem bản mô phỏng trên dev.gikky.net: khối thật chỉ rộng 760px, chia 2 cột thì tiêu
  đề gãy 5 dòng; xếp chồng còn 3 dòng, khối cao thêm khoảng 120px.
- Gộp mục sổ **P-20261110-6**: ở theme tối, nút "Đăng ký" có chữ trắng trên nền gần trắng. Đo lại trên dev.gikky.net
  ngày 2026-11-12 vẫn thấy lỗi.

**Không làm trong việc này:** đổi avatar mặc định từ icon xám sang chữ cái (icon là quyết định áp cho toàn site, commit
`2d5ac08`); hai nút chọn phe (P-20261111-9).

**Plan:** `plans/2026-11-12-khoi-chu-de-xep-chong-nut-brand.md`.

**Vòng 2 (2026-11-13), user chọn "Vá luôn":** vá ba chỗ hở hàng rào ở sổ P-20261112-8: chưa đo hover ở theme tối
(4.54:1); bài tĩnh lọt `!important`, `--ink-2`, khai `color` hai lần và khối trong `@media`; `max-width: 45%` chưa có bài
giữ. Chỉ sửa bài đo, không đổi CSS sản phẩm. Thiết kế ở §10 của plan. **ĐÃ LÀM 2026-11-13**, nghiệm thu ĐẠT sau hai lượt sửa theo phản biện; commit `4ed45b5`. Hở còn lại: sổ P-20261113-5. Hướng hover (làm tối thay vì làm sáng): P-20261113-6, user chọn giữ như cũ (2026-11-13).

---

## Việc 19 · Bản tin thị trường lên ngay dưới header + dòng bản quyền ở chân trang — ĐÃ LÀM trên `v2` (`8da9d22`, 2026-11-13), đã lên dev.gikky.net (`8da9d22`, 2026-11-13 11:37, chỉ `web`), chưa lên prod

**Yêu cầu (user, 2026-11-13, sau khi xem dev.gikky.net):** "phần bản tin thị trường xếp xuống dưới cùng có vẻ không ổn
lắm, chả ai kéo xuống dưới đó để mà xem tin tức cả"; "cũng không có phần nào chú thích @gikky {year}"; sau khi xem phác
thảo: "trên desktop cũng kéo bản tin lên, ngay dưới header".

**Số đo (dev.gikky.net `ee61f94`):** dải bản tin nằm ở ~2.900/3.025px trên desktop 1024 và ~4.165/5.607px trên mobile
375, tức sau 4–5 màn hình.

**Đã chốt với user:** bản tin thành **một dải mảnh ngay dưới header** của trang chủ `/`, cả desktop lẫn mobile; gỡ dải
cũ ở cuối section "Bài viết". Việc này KHÔNG đảo quyết định 2026-11-09 (tin tức là phụ trợ): dải chỉ cao một dòng,
chủ đề tuần vẫn là tiêu điểm.

**Phiên chính tự quyết (user chưa xem lại):**
- Dải chỉ có ở trang v2 `/`, không có ở feed cũ `/?tab=…` hay trang khác.
- Giữ đủ 3 link bản tin trong HTML (luật "SEO chỉ cộng"); desktop hiện cả ba trên một dòng (bản mới nhất ưu tiên chỗ),
  tablet/mobile chỉ hiện bản mới nhất.
- Dòng bản quyền `© {năm} gikky.net` đặt trong `ChanTrang` (chân cột phải, cạnh dòng miễn trừ, có ở mọi trang), không
  dựng footer ngang mới. Không thêm link (đợt E của việc 14 đã cố ý gỡ link khỏi chân trang).

**Bổ sung (user, 2026-11-13, cùng ngày):** "phần chủ đề tuần này, bỏ luôn các list cmt của các user đi". Bỏ hẳn ô
"Quan điểm mới / nổi bật" của khối chủ đề trên `/` (ô việc 18 vừa dựng lại): danh sách, tiêu đề ô và link "Xem tất cả
quan điểm →". Hai nút "Vào thảo luận" và "Viết quan điểm của bạn" giữ nguyên. Trang chủ bớt hai lời gọi API bình luận.
Plan §3.4.

**Bổ sung 2 (user, 2026-11-13):** "cho nội dung chủ đề nhiều hơn chút, hiện tại hơi ít". Phần bối cảnh của chủ đề đang
kẹp 2 dòng; nới thành tối đa 6 dòng để hiện trọn đoạn trích server trả về (~240 ký tự). Phiên chính tự quyết: chỉ sửa
CSS, KHÔNG kéo dài đoạn trích ở API (đoạn trích dùng chung cho mọi thẻ). Plan §3.5.

**Bổ sung 3 (user, 2026-11-13):** "sau khi xong thì deploy luôn" — hiểu là dev.gikky.net, không phải prod.

**Plan:** `plans/2026-11-13-ban-tin-len-dau-ban-quyen.md`.

**Vòng 2 (sau phản biện), khác điều đã chốt ban đầu:** với tiêu đề bản tin thật ("Bản tin DD/MM — …", rộng 468–547px)
dải vòng 1 in ngày hai lần và cắt mất phần con số ở mọi khổ. Đổi: dải vẽ **2 bản tin** (không phải 3; desktop hiện 2,
≤ 960px hiện 1), cắt tiền tố "Bản tin DD/MM —" khi vẽ, bản mới nhất không còn trần bề rộng, hộp trong 1096px cho thẳng
mép `<h1>` và rail. Plan §3.6.

**Kết quả:** nghiệm thu ĐẠT cả hai vòng; phản biện không có lỗi NẶNG. Đo trên dev.gikky.net sau deploy: dải sát đáy
header, cao 41px (mobile 45px); `/` có đúng 1 dải, `/?tab=moi` có 0; 0 ô quan điểm; `© 2026 gikky.net` ở `/`,
`/?tab=moi`, `/luat`; `<h1>` và lede không đổi; 28 link `/m/` duy nhất. Việc lặt vặt còn lại: sổ P-20261113-8.
User CHƯA xem lại ba điểm phiên chính tự quyết: dải chỉ 2 bản tin, dòng © nằm ở chân cột phải (không phải đáy trang),
bối cảnh chỉ nới bằng CSS.

---

## Việc 20 · Bản tin thành bảng dữ liệu riêng + trình bày kiểu bản tin — ĐANG LÀM trên `v2`: đợt A (API + dữ liệu + bot) xong 2026-11-13, nghiệm thu + phản biện + vòng sửa 1 ĐẠT; đợt B (web: trang `/s/tin-tuc/<ngày>`, danh sách, 308 từ `/m/` cũ, sitemap, RSS, ảnh OG, dải trang chủ đọc `BanTin.ngay`) xong 2026-11-13, nghiệm thu + phản biện + vòng sửa 1 ĐẠT; ĐÃ LÊN dev.gikky.net 2026-11-13 20:26 (`696025a`, api + web; `chuyen_ban_tin --that` trên DB dev: 55 mạch chuyển, 0 lỗi, 0 bỏ qua; bản sao DB trước migrate `~/gikky-dev/backup/truoc-696025a-20261113-201756.dump`), chưa lên prod. Bước deploy prod: migrate → `chuyen_ban_tin` chạy thử (bảng phải 0 dòng LỖI/BỎ QUA bất thường) → `--that` → web; sửa tay mô tả sub `tin-tuc` ở admin Chuyên mục

**Yêu cầu (user, 2026-11-13):** "tách phần bản tin ra 1 phần riêng, không dùng chung dữ liệu với bài viết hay nhật kí
nữa"; "hiện tại bản tin đang gộp lại theo dạng nhật kí, cần cách trình bày mới của bản tin, không theo dạng nhật kí nữa".

**Đã chốt với user:** bảng dữ liệu riêng (`BanTin` + `BanTinKhung`, không còn là `Mach`) · giữ `/s/tin-tuc` làm trang
danh sách · chỉ đọc (không bình luận / vote / câu hỏi cho đám đông, vẫn đếm lượt xem) · URL `/s/tin-tuc/YYYY-MM-DD` ·
57 mạch cũ trên prod lưu trữ + 301 sang URL mới · chờ việc 19 commit rồi mới code.

**Phiên chính tự quyết (trong plan, user duyệt cùng plan):** chuyển dữ liệu bằng lệnh `chuyen_ban_tin` (chạy thử mặc
định) thay vì data migration; bot tự nhận biết server mới / cũ để không chết trước deploy prod; chặn tạo mạch mới trong
`tin-tuc`; bản tin rời tìm kiếm nội bộ và `/feed.xml` chung.

**Plan:** `plans/2026-11-13-ban-tin-bang-rieng.md`.

---

## Việc 21 · Khu quản trị: quản lý bản tin + chủ đề thảo luận hàng tuần — ĐANG LÀM trên `v2`: đợt C (admin `/chu-de`, lọc loại ở `/machs`, vá đua đóng/mở lại ở `core/ghi.py`) xong 2026-11-13, nghiệm thu + phản biện + vòng sửa 1 ĐẠT; đợt D (admin `/ban-tin`: ô Hôm nay theo hạn chót, sửa/ẩn/xoá khung, Tiptap giữ hr/pre) xong 2026-11-13, nghiệm thu + phản biện + vòng sửa 1 ĐẠT

**Yêu cầu (user, 2026-11-13):** "ngoài phần bảng tin, còn thêm phần chủ đề bình luận hàng tuần. bạn xem trong admin còn
thiếu phần quản lý nào thì lập plan xử lý luôn".

**Thiếu (đo 2026-11-13):** admin không có danh sách chủ đề theo tuần, không cho biết chủ đề nào đang trên trang chủ,
không đóng / mở lại / viết tổng kết được (API có, chỉ bấm được ở web), `/machs` không lọc theo loại, không báo tuần sau
chưa có chủ đề; bản tin không có trang quản lý nào và không ai biết bot hôm nay đã đăng khung nào.

**Plan:** `plans/2026-11-13-quan-tri-ban-tin-chu-de.md` (đợt C chủ đề chạy được ngay sau việc 19; đợt D bản tin sau
việc 20 đợt A).

---

## Việc 22 · Dải "Đang được bàn" dưới khối Nhật ký mới — ĐÃ LÀM trên `v2` (2026-11-13, chưa commit): nghiệm thu ĐẠT 8/8, phản biện + vòng sửa 1 xong

**Yêu cầu (user, 2026-11-13):** "phần nhật kí, luôn lấy mới nhất của uniq user, nếu có 1 nhật kí về hpg hoặc dri, đang
rất nhiều thảo luận, nhưng vì có nhật kí mới, nên nó biến mất khỏi home, sẽ rất khó để lọc các nhật kí đang được thảo
luận nhiều".

**Đã chốt với user:** thêm dải riêng "Đang được bàn" dưới khối Nhật ký mới (không chỉ thêm tab; không đổi luật mỗi
tác giả một bài).

**Phiên chính tự quyết (trong plan):** cửa sổ 48 giờ, ngưỡng ≥ 2 bình luận của người khác tác giả mạch, loại tài khoản
`la_bot`; dải tối đa 5 mục, bỏ mạch đã có trong 8 thẻ phía trên, rỗng thì ẩn hẳn.

**Vòng sửa 1 (sau phản biện):** truy vấn lọc cửa sổ 48 giờ ngay trong JOIN (`FilteredRelation`, ~640 ms → ~27 ms ở 100k bình luận); xếp theo số NGƯỜI bàn trước rồi mới số bình luận (một người spam không đứng đầu được); dải lỗi thì ẩn, không kéo `/` thành 500; bài e2e "không lặp giữa hai khối" có răng. Giờ bình luận cuối in tuyệt đối (web chưa có helper giờ tương đối). Index `core_comment(mach_id, created_at)` để sau: sổ `P-20261113-18`.

**Plan:** `plans/2026-11-13-nhat-ky-dang-ban.md`.
