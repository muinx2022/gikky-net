# Bot bản tin: một mạch mỗi ngày, ba mốc — 2026-08-26

Nối tiếp `plans/2026-08-25-bot-tin-tuc.md`. Bản đó đã chạy được và **đã đăng nhập thật vào
prod** (kiểm 2026-08-25 22:0x: ① 401+csrftoken · ② 200+sessionid · ③ 404 `sub_khong_ton_tai`
chứ không phải 403 ⇒ CSRF/Origin đã đúng). Bản này đổi **hình dạng đầu ra**, không đổi hạ tầng.

## 0. Bối cảnh ĐO ĐƯỢC (khảo sát 2026-08-26, không phải giả định)

**Nền để subagent tự phát hiện mình đứng sai cây** (luật worktree, `D:\Projects\CLAUDE.md`):

- `pytest --collect-only -q` ⇒ **1435 tests collected**
- `node --test scripts/tin-tuc/lib.test.mjs` ⇒ **30 pass / 0 fail**
- File phải có mặt: `scripts/dang-tin.mjs`, `scripts/tin-tuc/lib.mjs`,
  `api/tests/test_bot_dang_tin.py`, `api/core/management/commands/tao_sub.py`.
  Thiếu bất kỳ file nào ⇒ **DỪNG và báo**, đừng làm tới đâu hay tới đó.

**Prod (gikky.net) tại thời điểm viết plan:**

| Cái gì | Giá trị đo được |
|---|---|
| Chuyên mục | 6: `chung-khoan` (2 bài) · `crypto` · `vi-mo` · `quan-tri-von` (1 bài) · `hoi-dap` · `tin-tuc` (0 bài) |
| Mạch | 3 — id 1000, 1002, 1003, đều của `u/gikky-team-member` |
| Sổ cái `scripts/tin-tuc/da-dang.json` | **CHƯA TỒN TẠI** — bot chưa đăng lần nào |

⇒ **Không cần di trú sổ cái.** Đổi cấu trúc file thoải mái. Ghi con số này ra đây vì nếu
tới lúc thực thi mà file đã có thì giả định trên sai và phải viết thêm bước di trú.

**Hợp đồng API đã có sẵn** (`api/api/schemas_ghi.py`, đọc 2026-08-26) — **không phải sửa
backend dòng nào cho mảng A**:

- `MachMoiIn` kế thừa `MocMoiIn` ⇒ `POST /machs` nhận `body`, `occurred_at`, `loai`,
  `question_for_crowd`, `figures`, cộng `sub` + `title`.
- `POST /machs/{id}/mocs` (`operation_id="noi_moc"`, `api/api/machs.py:501`) nhận
  `MocMoiIn` — cùng bộ trường, không có `sub`/`title`.
- Trần: `loai` ≤20 · `question_for_crowd` ≤200 · `figures[].label`/`.value` ≤24 ·
  `title` ≤160 · `body` ≤10 000.

**Ba ràng buộc cứng, đã kiểm bằng code chứ không suy đoán:**

1. **KHÔNG có endpoint sửa tiêu đề mạch.** `api/api/machs.py` chỉ có `xem_mach`,
   `liet_ke_binh_luan_mach`, `tao_mach`, `noi_moc`, `viet_binh_luan`, `dong_so_mach`,
   `mo_lai_mach`. ⇒ **Tiêu đề bị chốt lúc tạo, vĩnh viễn.**
2. `TrangThaiMach` chỉ có `MO` / `DONG` (`api/core/models/dien_dan.py:115`). Không có
   trạng thái lưu trữ nào để dùng lại.
3. `Sub` có đúng 4 cột: `slug`, `ten`, `mo_ta`, `created_at`. Admin đã có CRUD đầy đủ
   (`quan_tri_tao_sub`, `quan_tri_sua_sub`, `quan_tri_xoa_sub`).

**Cây làm việc bẩn sẵn từ trước** *(đính chính 2026-08-26 sau nghiệm thu — bản đầu ghi sai)*:

- `M api/config/settings.py` — khối `SOCIALACCOUNT_PROVIDERS` / `GOOGLE_BAT`, **thuộc đợt
  deploy/Google OAuth**, không dính bot. Đừng đụng vào.
- `M package.json` — nội dung thật là `+ "test:bot": "node --test scripts/tin-tuc/*.test.mjs"`,
  tức **thuộc đợt bot 2026-08-25 chưa commit**, KHÔNG thuộc deploy như bản đầu của plan này
  viết. Giữ nguyên dòng đó, đừng revert.

### Nền test trôi giữa chừng — đọc trước khi so số

**Có một phiên Claude khác làm việc song song trên cùng repo** (nhánh theo dõi người dùng /
chuông). Nó thêm test **trong lúc** chặng 2 đang chạy: `api/api/theo_user.py`,
`migrations/0018_theouser.py`, `api/schemas.py`, `api/v1.py`, `packages/api-client/*`.
Lúc nghiệm thu chấm, `git status` có **33 file `M` không thuộc việc này**.

Số đếm đã trôi: **1435** (lúc viết plan) → **1438** (opus-dev bắt đầu) → **1470** (xong).
Chỉ **+9** là của việc này.

⇒ **Đừng chấm N1 bằng số tuyệt đối.** Chấm bằng `0 failed / 0 warning`, cộng con số riêng
của `pytest tests/test_bot_dang_tin.py`. Nghiệm thu đo được: `1454 passed, 16 skipped,
0 failed, 0 warning` (16 skipped là `test_tim_kiem_that.py`, thiếu `MEILI_URL/MEILI_KEY`),
và `24 passed` cho riêng file của bot.

## 1. Quyết định của user (2026-08-25 → 26)

- Một mạch mỗi ngày, ba mốc — thay cho 3 mạch rời/ngày.
- Tiêu đề không được là "Tổng hợp tin tức ngày xxx".
- Thêm cấu hình **tự lưu trữ theo chuyên mục** (mảng B).
- Nội dung giữ nguyên luật cũ: **chỉ tổng hợp, không nhận định, không dự báo,
  không khuyến nghị mua bán.**
- 2026-08-26 08:5x: bật lại RIÊNG `truoc-phien-my` để có một bản tin thật hôm nay theo
  thiết kế CŨ; hai khung sáng vẫn tắt tới khi mảng A xong.

## 2. Vấn đề đang giải — nói rõ để nghiệm thu chấm đúng thứ

3 bài/ngày × 5 ngày = **15 bài/tuần** đổ vào một site đang có 3 bài thật. Trong hai ngày,
mọi nội dung người viết bị chôn. Nhưng cái sai sâu hơn số lượng: **bản tin mất giá theo
giờ, mạch lên giá theo thời gian.** Đặt 15 thứ mất giá mỗi tuần lên trang chủ của một site
có tuyên bố "nội dung tự chứng minh qua thời gian" là tự bẻ lời tuyên bố ấy.

Một mạch/ngày sửa cả hai: 15 → 5 bài/tuần, và ba khung giờ trở thành **một dòng thời gian
có thật** thay vì ba mảnh rời. Ba bài rời PHÁ MẤT thông tin "tin ra lúc 06:15, thị trường
phản ứng thế nào lúc 08:11" — thông tin ấy chỉ tồn tại khi chúng nằm chung một mạch.

## 3. Thiết kế mảng A

| Giờ VN | Việc | `loai` của mốc |
|---|---|---|
| 06:12 (+jitter) | **TẠO** mạch + mốc 1 | `Đêm qua` |
| 08:07 | **NỐI** mốc 2 | `Trước phiên VN` |
| 19:33 | **NỐI** mốc 3 | `Trước phiên Mỹ` |

Khung giờ hợp lệ giữ nguyên (`SLOT` trong `lib.mjs`): 05:00–07:00 · 06:30–09:00 · 16:00–21:00.

### 3.1 Sổ cái đổi cấu trúc

Khoá cũ `"<ngày>|<slot>" → url`. Khoá mới phải nhớ thêm **id mạch của ngày**:

```
{ "2026-08-26": { "mach_id": 1004, "url": "/m/...-1004",
                  "slot": { "dem-qua": "<ISO>", "truoc-phien-vn": "<ISO>" } } }
```

`mach_id` là thứ quyết định TẠO hay NỐI. Không có ⇒ tạo. Có ⇒ nối.

### 3.2 Ca hỏng: khung đầu lỡ ⇒ khung sau phải TẠO, không được nối vào hư vô

Ứng dụng đóng lúc 06:12 ⇒ `dem-qua` không chạy ⇒ 08:07 mở ra, sổ cái không có `mach_id`.
`truoc-phien-vn` **phải tạo mạch mới**, và tự viết tiêu đề bằng chất liệu CỦA CHÍNH NÓ
(không có số phiên đêm để neo). Hệ quả bắt buộc: **mọi slot đều phải biết viết tiêu đề**,
không chỉ `dem-qua`.

Đây là ca dễ quên nhất vì ở máy dev nó không bao giờ xảy ra.

### 3.3 Ca hỏng: mạch của ngày bị khoá / ẩn / xoá giữa chừng

Mod khoá mạch lúc 10:00 ⇒ 19:33 `noi_moc` trả 4xx. Script **không được** coi đó là sự cố
hệ thống rồi thoát mã 1 (mã 1 nghĩa là "bot hỏng, đi sửa"). Thêm mã thoát riêng:

- `MA.KHONG_NOI_DUOC = 5` — mạch của ngày tồn tại nhưng không nối được vào.

Mã thoát là **kênh duy nhất** scheduled task có; trộn ca này vào mã 1 là bắt người trực
đi đọc log để phân biệt "mod đã khoá" với "code hỏng".

### 3.4 Ca hỏng cũ vẫn giữ nguyên

`3.1`, `3.2`, `3.3` của plan 2026-08-25 (fire bù ra ngoài khung · đăng xong rồi mới hỏng ·
`--slot` là tập đóng) **không đổi** và test của chúng phải còn xanh.

Riêng "đăng xong rồi mới hỏng" nay có ca thứ hai: **nối mốc xong nhưng ghi sổ cái hỏng**.
Xử lý y hệt — in URL/id ra stdout TRƯỚC, rồi mới ghi sổ; hỏng thì cảnh báo ra stderr và
vẫn thoát 0.

## 4. Luật tiêu đề

Vì tiêu đề **không sửa được** (§0 ràng buộc 1), nó bị chốt lúc 06:12 khi mới biết phiên đêm.

**Dạng:** `Bản tin <dd/mm> — <mệnh đề sự việc + số>`
**Ví dụ:** `Bản tin 26/08 — Nasdaq -1,2%, Brent lên 68 USD`

- Phần sau gạch **chỉ được là sự việc và con số**. CẤM mọi tính từ đánh giá
  (*lao dốc, bùng nổ, ảm đạm, tích cực, đáng lo*) — cùng danh sách với luật nội dung §4
  của plan cũ.
- CẤM dạng "Tổng hợp tin tức ngày …": năm tiêu đề gần trùng nhau mỗi tuần, mắt trượt qua
  cả năm, và thẻ title trùng với hàng triệu trang khác nên vô giá trị với tìm kiếm.
- Slot nào TẠO mạch thì slot đó viết tiêu đề bằng chất liệu của mình (§3.2).

## 5. Ba trường đang bỏ không

Hợp đồng bài của bot hiện là `{sub, title, body}` (`TRUONG_CHO_PHEP` trong `lib.mjs`).
Ba trường dưới đây đã có sẵn ở API và bot đang bỏ trống hoàn toàn:

- **`loai`** — nhãn mốc: `Đêm qua` · `Trước phiên VN` · `Trước phiên Mỹ`.
- **`figures`** — dải cặp label/value, đúng thứ một bản tin mang: `S&P 500` → `+0,4%`.
  Tách số khỏi thân bài, đọc lướt được. **4–6 cặp mỗi mốc.**
  ⚠ *(sửa 2026-08-26 sau phản biện — bản đầu viết "4–8" và đó là lỗi CHẶN PHÁT HÀNH)*
  Trần thật của server là **6**: `api/core/models/moc.py:21` `SO_FIGURES_TOI_DA = 6`, ném
  `ValidationError` ở dòng 41. Mà `api/api/machs.py` **không bắt** ngoại lệ đó (đối chiếu
  `api/api/mocs.py:10` thì có), nên nó rơi vào handler mặc định của ninja và với
  `DEBUG=False` thành **HTTP 500** — script thoát mã 1, **cả ngày không có bản tin**, còn
  stderr chỉ là mẩu HTML lỗi của Django không nói gì về `figures`.
  ⇒ `lib.mjs` phải khai `SO_FIGURES_TOI_DA = 6` và ĐẾM phần tử, và hằng đó phải bị ghim
  vào bài đo khớp-hằng-hai-ngôn-ngữ (`test_bot_dang_tin.py:511`).
- **`question_for_crowd`** — câu mời. Biến bản tin từ thứ để đọc thành chỗ để đứng.
  **Bắt buộc là câu HỎI** (kết thúc bằng `?`) — hỏi thì không phải nhận định, nên nó
  không phá luật "chỉ tổng hợp".

## 6. Mảng B — tự lưu trữ theo chuyên mục (ĐỢT SAU, không làm cùng mảng A)

Tách vì nó đụng model + migration + admin + feed, còn mảng A chỉ đụng script. Gộp lại thì
nghiệm thu phải cầm hai bộ tiêu chí không liên quan, và luật chia độc quyền tài nguyên
(`D:\Projects\CLAUDE.md`) rối theo.

- `Sub.tu_luu_tru_sau_ngay = PositiveSmallIntegerField(null=True, blank=True)`.
  `null` = tắt. **MỘT cột, không phải bool + số** — bool kèm số đẻ ra hai trạng thái vô
  nghĩa (*bật mà số rỗng*, *tắt mà số vẫn 7*) mà mọi chỗ đọc cấu hình phải xử mãi mãi.
  Ô tích trong admin ghi `7`/`null` — đó là việc của form, không phải của bảng.
- `Mach.archived_at` — cột RIÊNG, **tuyệt đối không dùng lại `hidden_at`**. Trộn hai cái
  là mất vĩnh viễn khả năng phân biệt "mod ẩn vì vi phạm" với "tin cũ", và làm bẩn hồ sơ
  kiểm duyệt.
- **Đếm từ `last_activity_at`, không phải `created_at`.** Cơ chế này không bao giờ được
  giết một cuộc bàn đang sống. Hệ quả: con số nghĩa là "N ngày KHÔNG AI ĐỘNG VÀO" — nhãn
  trong admin phải ghi đúng như vậy, không thì người bật sẽ hiểu sai.
- **Lưu trữ ≠ xoá ≠ 404.** URL vẫn sống, trang vẫn mở. Chỉ rơi khỏi feed + danh sách sub +
  tìm kiếm. Có trang `/s/<sub>/luu-tru` xếp theo ngày.
- **Bật cờ là lưu trữ HỒI TỐ ngay.** Form phải nói trước con số ("sẽ lưu trữ ngay N bài").
- **Tắt cờ KHÔNG kéo bài trở lại** — chỉ dừng lưu trữ tiếp. Phục hồi là thao tác từng bài.
- Management command `luu_tru_tin_cu`, gọi từ chính nhiệm vụ hẹn giờ ban đêm.

## 7. Hạng mục làm (mảng A)

| # | Việc | File |
|---|---|---|
| H1 | Sổ cái cấu trúc mới + `daDang`/`ghiNhanDaDang` theo ngày | `scripts/tin-tuc/lib.mjs` |
| H2 | `MA.KHONG_NOI_DUOC = 5` | `scripts/tin-tuc/lib.mjs` |
| H3 | Hai hợp đồng bài: TẠO `{sub,title,body,loai,question_for_crowd,figures}` và NỐI (bỏ `sub`,`title`) | `scripts/tin-tuc/lib.mjs` |
| H4 | Soát `figures` (≤24/ô), `loai` (≤20), câu mời (≤200 **và kết thúc `?`**) | `scripts/tin-tuc/lib.mjs` |
| H5 | Soát tiêu đề: cấm tiền tố "Tổng hợp tin tức", cấm danh sách tính từ đánh giá | `scripts/tin-tuc/lib.mjs` |
| H6 | Nhánh TẠO vs NỐI theo sổ cái; gọi `POST /machs/{id}/mocs` | `scripts/dang-tin.mjs` |
| H7 | In id/URL TRƯỚC khi ghi sổ, cả ở đường nối mốc | `scripts/dang-tin.mjs` |
| H8 | Viết lại 3 file lịch: một mạch/ngày, luật tiêu đề, `figures`, câu mời | `scripts/tin-tuc/lich/*.md` |
| H9 | Test cho H1–H7 + **thử phá từng cái** | `scripts/tin-tuc/lib.test.mjs`, `api/tests/test_bot_dang_tin.py` |
| H10 | Đưa `tao_sub.py` vào git (đang untracked, đã bị xoá 2 lần do rebuild image) | — |
| H11 | Thêm `tin-tuc` vào `seed_dev.py::SUBS`; cân nhắc `seed_dev.py:713` (xoá seed-sub rỗng) | `api/core/management/commands/seed_dev.py` |

## 8. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Cách đo |
|---|---|---|
| N1 | `pytest` ≥ 1435 + số test mới, **0 fail, 0 warning** | `pnpm test` |
| N2 | `node --test` ≥ 30 + số test mới, 0 fail | `node --test scripts/tin-tuc/lib.test.mjs` |
| N3 | Sổ cái rỗng + slot bất kỳ ⇒ nhánh **TẠO** | test |
| N4 | Sổ cái có `mach_id` của hôm nay ⇒ nhánh **NỐI**, KHÔNG tạo mạch thứ hai | test |
| N5 | Chỉ `truoc-phien-vn` chạy (thiếu `dem-qua`) ⇒ vẫn TẠO, vẫn có tiêu đề hợp lệ | test |
| N6 | Sang ngày VN mới ⇒ `mach_id` hôm qua KHÔNG được dùng lại | test, giả lập giờ |
| N7 | `noi_moc` trả **403 / 404 / 409 / 429** ⇒ thoát **mã 5**. `400` / `422` ⇒ **mã 1** | test, cả hai chiều |
| N8 | Nối mốc xong, ghi sổ hỏng ⇒ **vẫn in id ra stdout** và thoát **0** | test |
| N9 | Tiêu đề bắt đầu bằng "Tổng hợp tin tức" ⇒ **mã 2**, không gọi mạng | test |
| N10 | Tiêu đề chứa tính từ đánh giá trong danh sách cấm ⇒ **mã 2** | test |
| N11 | `question_for_crowd` không kết thúc `?` ⇒ **mã 2** | test |
| N12 | `figures[].label` >24 ký tự ⇒ **mã 2** | test |
| N13 | Trường lạ trong file bài ⇒ **mã 2** (giữ hành vi cũ) | test |
| N14 | Bốn ca hỏng cũ (§3.4) vẫn xanh | chạy lại test cũ |
| N15 | **Thử phá**: mỗi test của N3–N12 phải ĐỎ khi bẻ đúng dòng code nó canh | luật 4 |
| N16 | 3 file lịch không còn chỗ nào bảo tạo 3 mạch rời | đọc + grep |
| N17 | `tao_sub.py` đã vào git | `git status` |

**N15 là tiêu chí quan trọng nhất.** Đợt trước có một bài đo báo XANH khi đã bẻ code, vì
lời gọi bị bẻ còn một đường khác — phải bẻ đúng chỗ mới thấy. Test không đỏ khi code hỏng
là test trang trí, và nó nguy hiểm hơn không có test.

**Bổ sung cho N15 sau vòng 1** *(2026-08-26)*: opus-dev tự khai lượt thử phá số 9 **suýt là
phép đo rỗng** — ba lần đầu vết bẻ không áp dụng được lên đĩa (heredoc nuốt backslash ·
neo tiếng Việt mojibake · neo `} catch (e) {` trúng hai chỗ) mà pytest **vẫn in `3 passed`**.
⇒ Từ nay mọi lượt thử phá phải **`grep` xác nhận vết bẻ CÓ THẬT trên đĩa TRƯỚC khi đọc kết
quả test**. Không có bước đó thì "test đỏ khi bẻ" là một câu không có căn cứ.

### N18…N25 — vòng sửa sau phản biện *(thêm 2026-08-26)*

| # | Tiêu chí | Cách đo |
|---|---|---|
| N18 | `figures` 7 cặp ⇒ **mã 2**, chặn trước socket (`ORIGIN_CHET`) | test |
| N19 | `SO_FIGURES_TOI_DA` của JS **khớp** `api/core/models/moc.py` | `test_bot_dang_tin.py:511` mở rộng |
| N20 | 3 file lịch ghi "4–6 cặp" **và** bảng trần có dòng số cặp | grep |
| N21 | `noi_moc` trả `400` ⇒ **mã 1**; trả `403` ⇒ **mã 5** | test, cả hai chiều |
| N22 | `occurred_at` dạng ISO có giờ ⇒ **mã 2**; ngày tương lai ⇒ **mã 2** | test |
| N23 | Thiếu `loai` ⇒ **mã 2** (cả nhánh TẠO và NỐI) | test |
| N24 | Câu lỗi mã 5 in ra đường dẫn sổ cái + khoá ngày + **khối JSON đúng kiểu** | test đọc stderr |
| N25 | Trường lạ ⇒ **mã 2** ở tầng đầu-cuối, không chỉ tầng hàm | test (vá N13 "đạt một phần") |

### Hai quyết định NGOÀI plan, ghi lại để không thành luật ngầm

Nghiệm thu yêu cầu ghi vào plan trước khi commit:

1. **`--ep` đổi nghĩa.** Trước: bỏ qua sổ cái ⇒ đăng thêm một mạch nữa. Nay: chỉ bỏ hàng
   rào chống trùng slot; mạch của ngày đã có thì **nối mốc**. Test cũ khẳng định
   `Mach.count() == 2` đã sửa thành `== 1` + `Moc.count() == 2`. **Đây không phải sửa test
   cho khớp code**: H6 chốt "nhánh TẠO vs NỐI theo sổ cái", và cho `--ep` đẻ mạch thứ hai
   thì phải THÊM code cố ý phá bất biến một-mạch-một-ngày. Nhưng §8 không có tiêu chí nào
   cho `--ep`, nên nó là quyết định ngoài plan và phải nằm ở đây.
   ⚠ Hệ quả phản biện tìm ra: `--ep` **không cứu được** ca mod ẩn/xoá mạch giữa ngày, mà
   chữ trong `--help` lại khiến người trực tưởng nó cứu được. Xử ở N24.
2. **Danh sách cấm 15 tính từ**, không phải 5. §4 viết "CẤM *mọi* tính từ đánh giá" rồi mở
   ngoặc 5 ví dụ — ngoặc là ví dụ, không phải tập đóng. 10 từ thêm đều có mặt trong cả 3
   file `lich/*.md` nên LLM soạn bài biết trước, và `kỷ lục`/`cao nhất`/`giảm mạnh` **cố ý
   không** nằm trong danh sách vì chúng là sự việc chứ không phải đánh giá.

## 9. Nợ / ngoài phạm vi — nói trước, không giấu

- **`--thu` không chạm mạng.** Hệ quả đã xảy ra thật: email sai tên miền trong `.env` chỉ
  lộ ra khi chạy tay lúc 22:00 ngày 25/08, chứ không cái nào trong 30 test bắt được. Nên có
  cờ `--thu-mang` chạy ①②③-giả (POST với `sub` không tồn tại, chờ 404 chứ không phải 403).
  Script thăm dò tay đã có ở `scripts/tin-tuc/.tam/thu-dang-nhap.mjs` — **chưa thành hàng rào**.
- **`tao_sub.py` biến mất mỗi lần build lại image.** H10 đưa nó vào git, nhưng còn phải
  chắc Dockerfile chép cả thư mục `management/commands/`.
- **Đóng sổ cuối ngày** (`dong_so_mach` + `ket_qua`) — hợp lý về ngữ nghĩa, chưa làm.
- **Cờ đưa `s/tin-tuc` ra khỏi feed chính** — chưa làm, chỉ dùng nếu 1 bài/ngày vẫn nặng.
- **Mảng B chưa có plan riêng.** §6 là đặc tả, không phải plan thực thi.

### Nợ mới phát hiện ở vòng phản biện *(2026-08-26)*

- 🔴 **`POST /machs` trả 500 thay vì 400 với lỗi validate của model.** `api/api/machs.py`
  không import/không bắt `django.core.exceptions.ValidationError`, trong khi
  `api/api/mocs.py:10` thì có. Mọi lỗi hình dạng ném từ tầng model (`kiem_figures`, và có
  thể còn chỗ khác — **chưa ai rà hết**) đi thẳng vào handler mặc định của ninja, mà với
  `DEBUG=False` thân handler là `raise exc` ⇒ 500.
  **Đây KHÔNG phải lỗi riêng của bot** — bất kỳ ai gọi API cũng dính. Hàng rào phía client
  (N18) chỉ che đường của bot; nguyên nhân gốc vẫn còn nguyên. Cần một lượt riêng: bắt
  `ValidationError` → 400 ở `machs.py`, và **rà xem còn endpoint nào cùng bệnh**.
- **Câu chỉ đường cứu của mã 5 nói SAI cho ca `429 qua_han_muc_moc`.** Tập mã 5 gồm
  403/404/409/**429**, mà 429 nghĩa là mạch đã đủ 3 mốc trong ngày. Câu cứu hộ khi đó vẫn
  khuyên "xoá khoá ngày trong sổ cái rồi chạy lại" — làm theo là **đẻ mạch thứ hai trong
  ngày**, tức phá đúng bất biến cả đợt này dựng lên. Việc đúng là "chờ mai". Cần tách 429
  ra khỏi câu cứu hộ chung. Cùng loài với F5: công cụ chỉ sai đường.
- ✏️ **Đính chính một sự thật ghi sai ở vòng sửa**: lỗi pydantic của django-ninja **không**
  trả 422 trên API này — `api/api/loi.py` có `@api.exception_handler(ValidationError)`
  đổi thành **400**. Hành vi mã thoát vẫn đúng (cả 400 lẫn 422 đều ngoài tập mã 5), chỉ
  lời giải thích trong báo cáo vòng sửa là sai. Đừng chép nó đi chỗ khác.
- **Hai lượt chạy chồng nhau đè sổ cái của nhau.** `dang-tin.mjs` đọc sổ một lần rồi ghi
  lại bằng spread của snapshot cũ; lượt chạy tay `--ep` song song với lượt hẹn giờ sẽ xoá
  bản ghi của lượt kia. Xác suất thấp (ba slot cách nhau nhiều giờ) ⇒ **ghi nhận, không sửa
  vòng này**.
- ✅ **`Dockerfile` — đã rà, KHÔNG phải lỗi.** `deploy/prod/api.Dockerfile:30` là
  `COPY api/ /app/` (cả cây), và `.dockerignore` không loại `core/management/`. Lý do
  `tao_sub.py` biến khỏi container **hai lần** đơn giản là: VPS build từ bản checkout git
  của chính nó, còn file thì chưa bao giờ được commit/push. ⇒ **H10 (commit) là đủ**, không
  cần sửa Dockerfile.
