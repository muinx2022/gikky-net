# Sổ lỗi và nợ — gikky.net

> Lập 2026-08-23 tại `ab77957`, sau lượt nghiệm thu + 3 lượt phản biện đầu tiên trên
> Phase 2/3/4/6. **Đây là sổ cái, không phải kế hoạch.** Sửa xong một mục thì đổi trạng thái
> tại chỗ, đừng xoá — lịch sử lỗi là thứ dạy được nhiều nhất ở repo này.
>
> Trạng thái: `MỞ` · `ĐANG SỬA` · `ĐÓNG (<commit>)` · `HOÃN CÓ CHỦ ĐÍCH`
> Hạng: **CHẶN** (không ra mắt được) · **NẶNG** · **VỪA** · **NHỎ**
>
> **Từ 2026-08-27 đây cũng là SỔ DỌC ĐƯỜNG của repo** (luật ở `D:\Projects\CLAUDE.md`, mục
> *Một việc một lúc*): mọi phát hiện **ngoài phạm vi việc đang làm** ghi vào mục **`E`** cuối
> file, mã `P-YYYYMMDD-n`. Dãy `L…` là di sản các lượt audit cũ — **đừng đánh số tiếp theo nó**.

## Cách đọc nhanh

**Cập nhật sau LƯỢT VÁ V2 (giao diện), 2026-08-23.** 37 mục đóng, 4 còn mở.
Mục đã đóng vẫn nằm nguyên chỗ cũ kèm bằng chứng gốc gập lại — lịch sử lỗi là thứ dạy được
nhiều nhất ở repo này.

| | Tổng | Còn MỞ sau V2 |
|---|---|---|
| CHẶN | 5 (L01–L05) | 0 (L01 đóng nhưng **chưa kiểm chạy** — xem cảnh báo dưới) |
| NẶNG | 3 (L06–L07, L41) | 0 |
| VỪA | 13 (L08–L19, L42) | **1** — L38 (thuộc nhóm B2, ngoài phạm vi V2) |
| NHỎ | 18 (L20–L37) | 0 |
| Mới ở V2 | L43 | **1** — L43 (tương phản hoàng thổ, đụng PLAN 9.1) |
| Nợ có tên | 8 mang từ Phase 1 + 3 ở V1 | **4 đã trả ở V2** |
| "Chưa bao giờ chạy thật" | 5 | 4 (Phase 5 đã chạy) |

Hai mục còn mở khác là **L39** và **L40** (rủi ro triển khai / hiệu năng quy mô, nhóm B2).

⚠ **L01 đóng nhưng CHƯA KIỂM CHẠY** — không có Caddy trên máy. Đọc mục ấy trước khi coi
hàng rào host admin là đã xong.

### Lượt vá V2 (giao diện) đóng những mục nào

**Bốn mục CHẶN/NẶNG:** L04 (nút Khoá/Ban THẬT trên hàng + nhãn `Ghi:` thôi nói dối) ·
L05 (composer khán đài neo thật, chip đổi/gỡ được, mặt BÃO còn một ô nhập) ·
L41 (bước dọn `.next/cache/fetch-cache` nối vào `pnpm build` của cả hai app) ·
L15 (`CotVote` xử nhịp `dangTai`).

**Sổ lỗi:** L16 · L19 · L20 · L21 · L22 · L25 · L30 · L32 · L33 · L35 · L37.

**Nợ có tên đã trả:** `REACTION-CHUA-CO-UI` · `FORM-FIGURES` · `UI-DIFF-REVISION` ·
`TRANG-CAI-DAT`.

**Mở mới:** **L43** — hoàng thổ `--stamp` bản SÁNG chưa đạt WCAG AA cho chữ nhỏ
(3.71:1 / 3.31:1). Sửa nó đòi đổi `PLAN.md` 9.1, thứ lượt này bị cấm chạm vào.

Số đo của lượt: **921 pytest** (nền 906) · **442 e2e** = 283 don-vi (nền 242) + 159 web
(nền 138) · 0 warning · `codegen:check` khớp 34 file · lint/build/tsc sạch ·
**Lighthouse SEO 100/100 và Accessibility 100/100** (mốc Accessibility mới của lượt này).
Chi tiết thử phá nằm trong từng mục.

⚠ Điểm Lighthouse Accessibility 100 **không** có nghĩa bảng màu đạt AA khắp nơi: audit ấy
chỉ soi những cặp màu CÓ MẶT trên đúng trang được đo. Phép đo bằng số trên cả bảng token
(`e2e/don-vi/tuong-phan.spec.ts`) tìm ra **L43** — xem mục ấy.

### Lượt vá V1 đóng những mục nào

L01 · L02 · L03 · L06 · L07 · L08 · L09 · L10 · L11 · L12 · L13 (nửa backend) · L14 ·
L17 · L18 (sửa câu) · L23 · L24 · L26 · L27 · L28 · L29 · L31 · L34.

Số đo của lượt: **830 pytest** (nền 754) · **380 e2e** = 242 don-vi (nền 229) + 138 web
(nền 136) · 0 warning · `codegen:check` khớp · lint/build/tsc sạch · Lighthouse SEO
**100/100**. Chi tiết thử phá nằm trong từng mục.

**Điều phải nói kèm mọi con số dưới đây:** phần lõi đã được đo tận tay và **đứng vững** —
ma trận phân quyền 33 endpoint × 3 vai (99 lời gọi HTTP thật, 99/99 đúng) · rò per-user qua ISR
dựng A/B/khách thật: không rò · sanitize markdown 7 payload qua composer thật: sạch · đối soát 6
cột denormalize trên DB thật: 0 hàng lệch · đồ thị khoá đầy đủ: không chu trình · `pnpm e2e` 3
lượt: 365/365 cả ba. Lỗi dưới đây nằm ở **chỗ không ai đi qua**.

---

# A · SỔ LỖI, theo phase — cả mục đã đóng lẫn mục còn mở

## Phase 4 — khu quản trị

### L03 · CHẶN · `POST /reports` không tồn tại — hàng đợi kiểm duyệt không bao giờ có hàng
**ĐÓNG (lượt vá V1, 2026-08-23).** Cửa nhận ở `api/api/bao_cao.py`; hàm ghi `core/ghi.py::tao_bao_cao`; chống trùng
bằng unique **partial** `bao_cao_mot_lan_moi_dich_dang_mo`
(`WHERE resolved_at IS NULL`, migration `0009`) ⇒ 409 `da_bao_cao`, và mod đóng báo cáo cũ
rồi thì tố lại được. **Không** áp `mach_bi_khoa`.
UI: mục "Báo cáo" trong menu `⋯` của **bình luận** và **mốc**, chỉ hiện cho người KHÔNG
phải tác giả, và **vẫn hiện khi mạch bị khoá** (`components/bao-cao.tsx`).
`PLAN.md` mục 7: dòng `POST /reports` đã có nội dung thật.
Đo: `api/tests/test_api_bao_cao.py` (22 bài — ba loại đích · 401 khách · 403 bị ban · tố
được nội dung của chính mình · mạch khoá vẫn tố được · chống trùng theo người · hai người
cùng tố ⇒ hai hàng · đóng rồi tố lại được · 404/409 cho đích hỏng · thân sai ⇒ 400), cộng
một bài nối **cửa nhận với hàng đợi của mod** (`GET /api/admin/reports` thấy đúng hàng), và
một bài e2e chạy thật qua giao diện.
**Thử phá:** bỏ `auth=dang_nhap` ⇒ **4 bài đỏ** (2 ở `test_api_bao_cao`, 2 ở
`test_quyen_ghi`); gõ sai `RB_BAO_CAO_TRUNG` ⇒ **1 bài đỏ** (lượt tố trùng thành 500).

<details><summary>bằng chứng gốc</summary>
Ba agent độc lập cùng tìm ra.
`PLAN.md` mục 7 và 5.10 đòi tường minh; plan Mảng A liệt kê "menu ⋯ (sửa/xoá/**báo cáo**)".
Thực tế: 0 endpoint, `grep "Report.objects.create"` ngoài test = rỗng, `core_report` **0 hàng** và
về cấu trúc **luôn** 0. Mảng A trỏ sang Phase 4; Phase 4 dựng toàn bộ phía tiêu thụ (hàng đợi,
phân trang keyset, `dong_bao_cao`, AuditLog, trang admin, 71 test) mà không dựng cửa nhận. **Không
lượt nào ghi đây là nợ.**
</details>

### L04 · CHẶN · Nút "Đóng: Đã ban / Đã khoá / Đã ẩn" khẳng định một hành động KHÔNG xảy ra
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Cột "Xử lý" nay chia làm **hai khối có nhãn**:

- **Thi hành** — Ẩn/Gỡ ẩn · Khoá mạch/Mở khoá (`quanTriDatKhoaMach`) · Ban tác giả/Gỡ ban
  (`FormBan` / `quanTriGoBanNguoiDung`). Ba lời gọi thật, ngay trên hàng.
- **Ghi nhận & đóng** — bốn nút cũ, nhãn đổi từ `Đóng: Đã ban` sang **`Ghi: đã ban`**
  (`CHU_GHI_NHAN`), kèm `title` nói thẳng *"chỉ ghi vào sổ, không thi hành gì"*.

Nút bật/tắt đọc **trạng thái thật** từ hai trường mới của `NoiDungBiBaoCaoOut`:
`mach_da_khoa` và `tac_gia_bi_ban` (không truy vấn thêm — `dang_bi_ban()` là ba cột đã nạp).
Một nút bật/tắt không biết chiều là nút mà nửa số lần bấm trả `da_doi=false` và màn hình
không đổi. `FormBan` là **một bản duy nhất**, dùng chung với trang hồ sơ.

Đo hai nửa, và phải cộng cả hai mới thành L04:
`api/tests/test_va_v2_quan_tri.py` (9 bài — ban **chặn thật** cửa ghi 403 · hàng đợi phản
ánh đúng hai trạng thái · `hanh_dong` **vẫn** không thi hành gì) và
`apps/web/e2e/don-vi/hang-doi-quan-tri.spec.ts` (8 bài — hàng gọi đúng endpoint, nhãn thôi
nói dối, form ban không có bản thứ hai).
⚠ **Chưa bấm tận tay trong trình duyệt**: `pnpm e2e` chỉ dựng `apps/web` (3000) + Django
(8000); khu quản trị ở 3001 không nằm trong `webServer`. Ghi ra để không ai tưởng đây là
chỗ đã đo bằng chuột.

<details><summary>bằng chứng gốc</summary>
`apps/admin/app/page.tsx:222` + `components/dung-mo-ta.ts:23`.
Backend nói rõ `action` **chỉ ghi lại** mod đã làm gì, không thi hành (`quan_tri_bao_cao.py:118`,
`ghi.py:1283`). Mod bấm "Đóng: Đã ban" trên báo cáo lừa đảo ⇒ 200, hàng sang "Đã xử lý", audit log
đầy đủ, **kẻ kia không bị ban một giây nào**.
Nặng gấp đôi: trên hàng **không có nút khoá hay ban thật** (chỉ Ẩn/Gỡ ẩn), trong khi docstring cùng
file trích PLAN 9.3 *"nút ẩn/khoá/ban ngay trên hàng"* rồi viết *"'Ngay trên hàng' là cả yêu cầu"*.
Cài 1/3 ⇒ bốn nút `Đóng:` là thứ duy nhất trông giống hành động.
</details>

### L22 · NHỎ · PLAN 9.3 mục 2 "tra cứu mạch/user" không có
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** `apps/admin/components/o-tra-cuu.tsx`, gắn trên **thanh điều
hướng** (lối vào nằm sau một cú bấm là lối vào mod sẽ thay bằng gõ URL tay). Hai ô riêng —
`Mạch #` và `u/` — chứ không một ô đoán: `username` toàn chữ số là hợp lệ, nên "chuỗi số ⇒
mạch" sai ngay ở ca đầu tiên. Không gọi API nào, chỉ `router.push`; trang đích tự xử 404.

<details><summary>bằng chứng gốc</summary>
`apps/admin/components/cong-quan-tri.tsx:52` chỉ có 3 link. `/m/[machId]` và `/u/[username]`
chỉ tới được từ một hàng báo cáo — và từ lượt vá V1 thì hàng đợi **đã có hàng thật** (L03 đóng), nên
mục này nhẹ đi một bậc về hậu quả: vẫn thiếu ô tra cứu, nhưng không còn ca "không có đường nào tới
nút ban/khoá thật".</details>

### L30 · NHỎ · Nút "Xoá" thiếu `aria-label`
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Đường thứ ba đã có, và nó **nêu lý do** chứ không chỉ nêu
tên hành động: `Xoá s/<slug> — không xoá được: sub còn N mạch`. `title` một mình thì phần
lớn trình đọc màn hình bỏ qua, nên nút chỉ đọc thành "Xoá, không dùng được" — đúng, và
không nói được vì sao.

<details><summary>bằng chứng gốc</summary>
`apps/admin/app/subs/page.tsx:201` có `disabled` + `title`, thiếu đường thứ ba. Luật ba
đường được tuân thủ đầy đủ ở `apps/web/components/cot-vote.tsx:176`.</details>

### L33 · NHỎ · `den_khi` tính ở client
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** `BanIn` mọc trường **`so_ngay`**, và `api/quan_tri_nguoi_dung.py`
quy đổi nó bằng đồng hồ **máy chủ**. `core/ghi.py::ban_user` không đổi một dòng — nó vẫn
chỉ biết `vinh_vien`/`den_khi`, nên bất biến của đường ghi không rộng ra.

Phép kiểm "đúng một trong ba" phải đếm cả ba: để `ban_user` xử cặp cũ là
`{so_ngay: 7, vinh_vien: true}` đi lọt — `so_ngay` bị bỏ qua **im lặng** và mod tin mình
vừa ban 7 ngày trong khi kẻ kia bị ban vĩnh viễn.
Đo: `test_va_v2_quan_tri.py` (hạn rơi đúng cửa sổ ±1 phút quanh `now + 7 ngày` · 4 hình
dạng sai ⇒ 400 và **không ban ai** · hai cách khai cũ vẫn chạy).

<details><summary>bằng chứng gốc</summary>
`apps/admin/app/u/[username]/page.tsx:73` — `now + N ngày`. Nguyên tắc 10 ở mức nhẹ.</details>

---

## Phase 6 — đánh bóng ra mắt

### L01 · CHẶN · Caddyfile: allowlist IP của khu quản trị là NO-OP trên prod
**ĐÓNG (lượt vá V1, 2026-08-23) — nhưng CHƯA KIỂM CHẠY.** `deploy/Caddyfile`.
→ Đã bọc phép chặn vào **chính nhóm `handle`** (`handle @ngoai_allowlist { respond … }`
đặt trước `handle /api/*`): các khối `handle` cùng cấp loại trừ nhau và xét theo thứ tự
khai, nên đây là chỗ duy nhất trong Caddyfile mà "viết trước" thật sự là "chạy trước".
Comment sai đã viết lại, kèm lý do vì sao **không** dùng `abort` (cùng nhóm sau `handle`)
và vì sao không bọc `route { … }` (một luật thứ tự ngoại lệ cho cả block).
⚠ **Không có Caddy trên máy** (`caddy version` → command not found) ⇒ **chưa chạy
`caddy validate`, chưa một request nào đi qua**. Phép thử số 3 ở cuối file trả lời dứt
điểm trong 5 giây khi có Caddy. Hạng CHẶN vì thế chỉ hạ được sau lần deploy đầu tiên.

<details><summary>bằng chứng gốc</summary>
```
@ngoai_allowlist not remote_ip 192.0.2.0/24
respond @ngoai_allowlist "Not found" 403     ← viết trước
handle /api/* { reverse_proxy … }            ← viết sau
```
Comment khẳng định "viết trước nên chặn được". **Sai**: Caddy sắp lại theo `directiveOrder`, và
`handle` nằm **trước** `respond`. ⇒ request từ IP bất kỳ tới `admin.gikky.net` khớp `handle`, proxy
thẳng vào Django; dòng `respond` **không bao giờ chạy**. Hai trong ba lớp che biến mất cùng lúc
(lớp Host vẫn cho qua vì Host **đúng là** `admin.gikky.net`).</details>

### L02 · CHẶN · `seed_dev` tạo tài khoản `is_staff` mật khẩu ghi cứng, không chốt môi trường
**ĐÓNG (lượt vá V1, 2026-08-23).** Cổng ở `core/moi_truong.py::doi_dev`, gọi ở **dòng đầu** `handle()` của cả
`seed_dev` lẫn `seed_e2e` — trước cả `--reset`, vì một lệnh bị từ chối sau khi đã xoá dữ
liệu tệ hơn một lệnh chạy trọn.
`api/tests/test_seed_chot_moi_truong.py` (6 bài): từ chối ở cả hai lệnh · không ghi và
không xoá gì khi bị từ chối · `DEBUG=True` vẫn chạy · cổng đọc `settings` **tại lúc gọi**.
Bộ test Django ép `DEBUG=False`, nên mọi bài đo cần seed nay đi qua
`tests/conftest.py::chay_seed` (bọc `override_settings(DEBUG=True)`, nói rõ vì sao).
**Thử phá:** đổi `if not settings.DEBUG` → `if False` ⇒ **5 bài đỏ**.

### L12 · VỪA · Ba hạn mức chống lạm dụng PLAN đòi — không tồn tại
**ĐÓNG (lượt vá V1, 2026-08-23).** Cả ba cài ở `core/han_muc.py`, hằng ở `config/settings.py`
(`HAN_MUC_DANG_KY_MOI_IP_NGAY=5`, `HAN_MUC_MACH_MOI_USER_NGAY=10`,
`HAN_MUC_BINH_LUAN_MOI_GIO_TAI_KHOAN_MOI=5`, `NGAY_TAI_KHOAN_CON_MOI=3`), đọc **tại lúc
gọi** nên `override_settings` đo được. Ranh giới **nửa đêm giờ VN** cho hai hạn mức "ngày";
"5 bình luận/giờ" là **cửa sổ trượt** (PLAN viết "giờ", không có ranh giới lịch nào để bám).
- đăng ký/IP: adapter allauth `core/allauth_adapter.py::is_open_for_signup`, khoá đếm là cột
  mới `User.dang_ky_ip` (migration `0008`). **Không** dùng `ACCOUNT_RATE_LIMITS` của allauth:
  cửa sổ của nó trượt-24-giờ, và nó đếm trong `LocMemCache` (mất khi restart, riêng từng
  worker ⇒ trên prod 4 worker thì "5/ngày" là 20/ngày).
- đăng bài/user/ngày và bình luận/giờ: `api/api/machs.py`, 429 kèm `thu_lai_tu`.
⚠ **Prod PHẢI đặt `TIN_X_FORWARDED_FOR=True`**: Django ngồi sau Caddy nên `REMOTE_ADDR` của
mọi request là `127.0.0.1`; để `False` là cả thế giới dùng chung một khoá đếm. Mặc định
`False` vì tin header ấy khi không có proxy là để ai cũng tự khai IP bằng một dòng.
⚠ **`api/.env.example` NỚI ba số này cho máy dev** (1000/200/200) — bộ e2e đăng ký 14 tài
khoản mỗi lần chạy, tất cả từ `127.0.0.1`. Hạn mức thật được đo ở `test_han_muc.py` (15 bài,
hạ trần bằng `override_settings`, cả hai chiều "vượt ⇒ từ chối" và "dưới ⇒ không chặn oan").
⚠ **Nợ mới `SHADOW-LIMIT-XOA-THAT`** — xem bảng nợ.

<details><summary>bằng chứng gốc</summary>
PLAN mục 10 Phase 6: đăng ký **≤5/IP/ngày**, đăng bài **≤10/user/ngày** (số đổi được trong
settings). PLAN 5.10: **shadow-limit 5 bình luận/giờ cho tài khoản < 3 ngày tuổi**.
`grep` toàn repo: hằng hạn mức **duy nhất** là `SO_MOC_TOI_DA_MOI_NGAY = 3`. `grep -ri "shadow"` = 0.
Và `deploy/Caddyfile:36` khẳng định *"hạn mức theo người dùng và theo ngày lịch VN là việc của
Django"* — Django không làm; Caddyfile thì chưa bao giờ chạy. ⇒ hôm nay **một tài khoản đăng bao
nhiêu mạch tuỳ thích; một IP đăng ký 20 tài khoản mỗi phút** (mặc định allauth).</details>

### L16 · VỪA · OG card của sub rỗng in "0 mạch"
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** `ogSub` bỏ hẳn mảnh ấy khi `so_mach === 0` (`ghepDongPhu` đã
lọc mảnh rỗng nên không để lại dấu `·` cụt). Chỗ này đắt hơn các chỗ khác cùng loại vì thẻ
OG **được cache ở phía Facebook**: một sub vừa mở được chia đi kèm dòng "0 mạch" thì cái ấn
tượng đầu tiên ở lại rất lâu.

<details><summary>bằng chứng gốc</summary>
`apps/web/lib/og.ts:169` vô điều kiện, trong khi `lib/dinh-dang.ts:101` có sẵn
`dongSoMachSub` để tránh đúng chuyện đó (dùng ở trang sub và sidebar). Nguyên tắc 9 không có ngoại
lệ cho `so_mach` — ngoại lệ duy nhất đã chốt là điểm vote.</details>

---

## Phase 3 — BÃO · follow · notification · trích · ISR

### L06 · NẶNG · Xoá/sửa bình luận KHÔNG làm mới cache ⇒ nội dung đã gỡ phục vụ công khai tới 1 giờ
**ĐÓNG (lượt vá V1, 2026-08-23).** `xoa_binh_luan_api` và `sua_binh_luan_api` nay gọi `lam_moi_mach`.
`test_binh_luan_KHONG_goi_lam_moi` đổi tên thành `test_VIET_binh_luan_KHONG_goi_lam_moi` và
thu về đúng `POST`; bảng `test_moi_su_kien_CO_SIGNAL_deu_goi_lam_moi` thêm hai dòng.
**Đo THẬT trên trình duyệt**: `e2e/phase-3.spec.ts::P11` — khách thấy câu (sau một lượt làm
mới tay, vì bình luận MỚI không có signal) ⇒ chính người viết xoá qua giao diện ⇒ khách
reload và **hết thấy**, không gọi làm mới tay lần nào.
**Thử phá:** gỡ hai lời gọi `lam_moi_mach` ⇒ **2 bài đỏ** ở `test_revalidate.py`.

<details><summary>bằng chứng gốc</summary>
Hai agent độc lập cùng tìm ra. `api/api/binh_luan.py` không import `lam_moi_mach`.
Đường đi: khách xem trang mạch ⇒ bản ISR (`revalidate=3600`) vào data cache của Next → tác giả xoá
bình luận → hàng **biến khỏi Postgres** → tác giả đang đăng nhập nên đi nhánh `/m-phien/`
(force-dynamic) ⇒ **họ thấy nó đã mất và tin là xong** → khách vẫn nhận nguyên văn tới 60 phút.
Bằng chứng đây là **sót** chứ không phải chủ đích: mod ẩn bình luận **thì có** gọi
(`quan_tri_kiem_duyet.py:94`) — ranh giới "nội dung biến khỏi trang công khai" đã được công nhận là
sự kiện có signal; chỉ đường của **chính tác giả** là quên.
</details>

### L07 · NẶNG · `REVALIDATE_SECRET` không tới tiến trình Next ⇒ cache chết im lặng ở dev; clone sạch mất 42 bài đo
**ĐÓNG (lượt vá V1, 2026-08-23).** Hai nửa:
1. `pnpm setup:env` **sinh sẵn** `REVALIDATE_SECRET` ngẫu nhiên (base64url 32 byte), cùng
   lối với `SECRET_KEY`. Mẫu thiếu dòng đó ⇒ script DỪNG, không chép nửa vời.
2. `pnpm web:dev` nay đi qua `scripts/web-dev.mjs`, đọc `api/.env` và truyền biến sang tiến
   trình Next. **Không** dùng `apps/web/.env.local` thứ hai (hai file phải khớp tay, cái
   lệch sẽ im lặng) và **không** dùng `env:` của `next.config.ts` (nội tuyến secret vào cả
   bundle client).
Đo: `e2e/don-vi/setup-env.spec.ts` (6 bài) chạy **thật** script trong một thư mục tạm dựng
như clone sạch — biến `GIKKY_GOC_REPO` tồn tại cho đúng việc đó. Đo tay: worktree sạch →
`node scripts/setup-env.mjs` → phép đọc nguyên văn của `playwright.config.ts::
secretLamMoiCache()` trả chuỗi 43 ký tự ⇒ `du-lieu.ts` **không ném**. Và `pnpm web:dev`
chạy thật: `POST /lam-moi-cache` đúng secret ⇒ **200** (trước là 503), sai ⇒ 401, đường dẫn
rác ⇒ 400.
⚠ Bắt tại trận trong lúc vá: phép kiểm hậu-nghiệm của `setup-env.mjs` viết bằng
`noiDung.includes(<dòng mẫu>)` — đúng với `SECRET_KEY` (giá trị mẫu không rỗng) nhưng **sai
hẳn** với `REVALIDATE_SECRET=` vì dòng mẫu là tiền tố của mọi dòng thay thế ⇒ script dừng ở
**mọi** lần chạy. Nay đòi giá trị mới có mặt trên đúng dòng đó.

<details><summary>bằng chứng gốc</summary>
Đo thật: `next start` **có** env → `POST /lam-moi-cache` 200. `pnpm web:dev` → **503**
*"REVALIDATE_SECRET chưa đặt — cửa làm mới cache đang tắt."*
`api/.env` có secret (phía Django bật), `apps/web` **không có `.env` nào**; chỉ
`playwright.config.ts:109` truyền env. `revalidate.py:135` chỉ ghi một dòng `logger.warning`.
⇒ **ở dev, mọi sự kiện có-signal (nối mốc, trích, đóng/mở sổ) không làm mới cache; trang đứng
nguyên tới 1 giờ, không ai được báo.**
Vế thứ hai: `e2e/du-lieu.ts:118` **ném** khi secret rỗng, được gọi trong `beforeAll` của
`vo-reddit.spec.ts` (**42 `test(`**), `mach-can.spec.ts`, `seo-va-trang.spec.ts`. ⇒ **clone sạch →
`pnpm setup:env` → `pnpm e2e` ⇒ ≥42 bài đỏ ở một file nói về cột vote.** Con số "365 e2e" chỉ tái
lập được trên máy đã đặt tay biến này.
Mâu thuẫn nội bộ: `phase-3.spec.ts:330` lại `test.skip` với lý do *"đó là cấu hình hợp lệ của một
máy vừa clone"* — hai chỗ, hai kết luận trái ngược về cùng một biến.
</details>

### L13 · VỪA · "Tác giả vẫn thấy nội dung kèm nhãn" (PLAN 5.2 + 5.10) chưa được CÀI
**ĐÓNG (lượt vá V1, 2026-08-23) (nửa BACKEND).** Cài ở `GET /machs/{id}/me` — trường mới
`noi_dung_cua_toi: list[NoiDungCuaToiOut]`, chứa mốc + bình luận **của chính người gọi**
đang bị ẩn hoặc là bia mộ, kèm `trang_thai` để client giữ nhãn. `GET /machs/{id}` **không
đổi một byte** (điều kiện của ISR 8.4), và có bài đo ghim đúng chuyện đó.
Điều kiện `author = người gọi` lọc ở **tầng truy vấn**, hai câu, không N+1.
Đo hai chiều — `api/tests/test_api_noi_dung_cua_toi.py` (9 bài): chính chủ thấy (mốc bị ẩn ·
mốc tự xoá · bình luận bị ẩn) · **người khác KHÔNG thấy** · khách không thấy · **chủ mạch
cũng không thấy bình luận bị ẩn của người khác** · nội dung không bị che thì không có mặt.
"Không thấy" đo bằng cách quét **mọi chuỗi** trong response, không chỉ một trường.
**Thử phá:** bỏ `author=user` khỏi hai truy vấn ⇒ **2 bài đỏ** (người khác và chủ mạch).
⚠ **Nửa GIAO DIỆN chưa có** — client chưa vá `body` vào ô trống. Thuộc lượt V2.

<details><summary>bằng chứng gốc</summary>
`trinh_bay.py::moc_ra`/`nut_ra` che theo `doc_duoc(...)`, **không nhận người xem**. Tác giả
nhìn thấy đúng ô trống mà người lạ thấy.
Đang bị khai nhầm là *"chưa đo được, cần Mảng A"* (`test_api_quan_tri_kiem_duyet.py:10`, commit
`150224d`) — câu đó ngụ ý cơ chế đã có. Thực trạng: **chưa có gì để đo.**
Mâu thuẫn PLAN chưa ai ghi ra: `GET /machs/{id}` bị ép **không chứa gì per-user** (điều kiện của
ISR 8.4) nên vế này **không thể** cài trên cửa đó.
→ **Quyết định phiên chính:** cài qua `GET /machs/{id}/me` — đã per-user, đã `no-store`, đã chạy
trong trình duyệt. Trả thêm nội dung **của chính người gọi** đang bị ẩn/bia mộ; client vá vào ô
trống. ⚠ Chỉ trả nội dung user gọi **là tác giả** — trả nhầm của người khác là biến bản vá minh
bạch thành lỗ rò.</details>

### L14 · VỪA · Digest: không ai bật được, link huỷ đăng ký 404
**ĐÓNG (lượt vá V1, 2026-08-23).** `PATCH /api/v1/me` (`api/api/toi.py::sua_toi`) là cửa duy nhất đặt `nhan_digest`;
`GET /me` trả kèm cờ ấy để công tắc đọc lại được trạng thái. PATCH thật (`{}` hợp lệ,
không ghi gì; `null` tường minh **không** thành `UPDATE … SET NULL` trên cột `NOT NULL`).
Câu cuối thư digest **bỏ link chết** `{goc_site}/cai-dat` — `test_digest.py` nay ghim
`"/cai-dat" not in thu.than` để nó không quay lại trước khi trang ấy có thật.
Đo: `api/tests/test_api_toi_sua.py` (6 bài), gồm một bài nối cửa này với
`core.digest.nguoi_nhan_digest()` — bật xong thì digest **thật sự** có người nhận.
⚠ **Nợ mới `TRANG-CAI-DAT`**: `apps/web/app/cai-dat` vẫn chưa tồn tại, nên hôm nay chưa có
nút nào bấm vào cửa này. Thuộc lượt V2.
Vế "email mốc mới cho follower" (PLAN 5.8) **vẫn chưa có** — không nằm trong phạm vi V1.

<details><summary>bằng chứng gốc</summary>
`User.nhan_digest` mặc định `False`; `grep "nhan_digest"` trong `api/api/` và `apps/` = **0**
⇒ không endpoint, không form, không trang cài đặt. Thư có link `{goc_site}/cai-dat` — **thư mục
`apps/web/app/cai-dat` không tồn tại**.
Kèm: PLAN 5.8 và tiêu chí Phase 3 đòi **email mốc mới** cho follower;
`grep "send_mail\|EmailMultiAlternatives"` chỉ khớp `gui_digest.py`. Không ai khai.</details>

### L21 · NHỎ · `TOGGLE-MAT-MOT-CHIEU` — hướng thiếu là hướng CHÍNH
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Mặt BÃO nay có một dòng *"Đang xem **mặt BÃO** — khán đài là
thân bài. [xem mặt CẶN (nhật ký thuần)]"* trỏ `?view=can`
(`trang-mach.tsx`, `data-testid="doi-mat-bao"`).

Là một `Link` thường chứ không phải `LoiMoiDoiMat`: chiều CẶN→BÃO là một **lời mời** phụ
thuộc dữ liệu per-user (đã follow chưa, đã bình luận chưa) nên nó phải do client vẽ; chiều
này là một lối đi luôn có, không hỏi gì về người xem — nên nó render ở server và nằm được
trong HTML đã cache.

<details><summary>bằng chứng gốc</summary>
`grep "view=can"` (trừ e2e) = **0**; chỉ có `?view=bao`. PLAN 5.5 dựng toggle này với lý do
*"người nghiêm túc bật 'thuần' một lần rồi vĩnh viễn không thấy bình luận"* — tức hướng **BÃO →
CẶN**, đúng hướng đang thiếu. Nợ đã khai một dòng nhưng khai nhẹ hơn thực tế.</details>

### L23 · NHỎ · Cửa `/lam-moi-cache` không có bài đo cho nhánh TỪ CHỐI
**ĐÓNG (lượt vá V1, 2026-08-23).** `e2e/don-vi/cua-lam-moi-cache.spec.ts` (7 bài): secret rỗng ⇒ 503 · secret sai ⇒
401 · thiếu header ⇒ 401 · 401 không tiết lộ chuỗi nào · thân không phải JSON ⇒ 400 · sáu
đường dẫn ngoài allowlist ⇒ 400 · **thứ tự kiểm** (cổng fail-closed đứng trước mọi phép kiểm
khác). Để đo được, `route.ts` đọc `process.env` **mỗi request** qua
`lib/lam-moi-cache.ts::secretCuaCua()` thay vì chụp vào một hằng tầng module — thay đổi ấy
được ghi ra ở cả hai file, không giấu.
So sánh `!==` vẫn **không hằng-thời-gian** (khó khai thác qua mạng; ghi lại cho đủ).

<details><summary>bằng chứng gốc</summary>
`route.ts:41` — không test nào đòi "secret rỗng ⇒ 503" hay "secret sai ⇒ 401". Đảo một dấu
`!` là mở toang cửa mà không gì đỏ.</details>

### L26 · NHỎ · `bao_moc_moi` khoá nhiều hàng `core_user` không `ORDER BY`
**ĐÓNG (lượt vá V1, 2026-08-23).** Thêm `.order_by("user_id")` kèm ghi chú rằng đó là **thứ tự lấy khoá**, không
phải thứ tự hiển thị.

<details><summary>bằng chứng gốc</summary>
`core/thong_bao.py:120`. Hôm nay an toàn vì `FOR KEY SHARE` tương thích với chính nó; nếu
mai đường notification cần `select_for_update` trên `User` thì thành lỗi thật.</details>

### L27 · NHỎ · `DanhDauDaDocIn.ids` không có `max_length`
**ĐÓNG (lượt vá V1, 2026-08-23).** `max_length=DAI_DANH_SACH_DA_DOC` (500) — rộng hơn hẳn mọi lượt bấm thật (chuông
trả tối đa một trang), nên nó không chặn ai, nó chỉ chặn cái không phải lượt bấm.

<details><summary>bằng chứng gốc</summary>
`schemas_ghi.py:185` → `pk__in` với danh sách 1 triệu phần tử. Cần đăng nhập nên abuse nhẹ.</details>

### L34 · NHỎ · Docstring keyset chuông nói "khoá BẤT BIẾN", thực tế `created_at` bị bump
**ĐÓNG (lượt vá V1, 2026-08-23).** Viết lại: khoá **không** bất biến, và hệ quả được nói ra ở đúng mức — hàng bị
bump nhảy lên **trước** con trỏ nên không trùng, nhưng **có thể sót** nếu nó bị bump sau khi
người đọc đã đi qua vị trí cũ. Vô hại ở chuông, nhưng là bảo đảm yếu hơn.

<details><summary>bằng chứng gốc</summary>
`api/api/thong_bao.py:64` vs `core/thong_bao.py:107` (dedupe `moc_moi` cố ý bump). Hậu quả
vô hại; hai câu mâu thuẫn nhau và câu đầu là câu người sau sẽ tin.</details>

---

## Phase 2 — tài khoản + đường ghi

### L05 · CHẶN · Neo bình luận: mặc định sai, không gỡ được, hai composer khác luật cùng một trang
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Ba vế, ba bản vá:

1. **Khán đài neo thật** — `KhanDai` nhận `anchorMocSeq` (mốc mới nhất) và truyền xuống cả
   hai nhánh (khán đài rỗng lẫn khán đài có hàng).
2. **Chip đổi/gỡ được** — `NeoDoiDuoc`: một `<select>` liệt kê mọi mốc (kể cả mục "cả mạch
   (không neo)") + nút `×`. `<select>` chứ không menu tự vẽ: đúng ngữ nghĩa, nghe được
   bằng trình đọc màn hình mà không cần một dòng `aria-*`, và trên mobile nó mở bằng bánh
   xe gốc của hệ điều hành. Đây là cơ chế mà `PLAN.md` mục 4 viện dẫn — nay nó có thật.
3. **Mặt BÃO còn ĐÚNG một ô nhập** — `hienComposer={!la_bao}`. Cờ chứ không suy từ
   `anchorMocSeq === null`: "không neo" là một lựa chọn hợp lệ của người dùng, nó không
   được kiêm nghĩa "đừng vẽ ô nhập".

Composer trong **ngăn kéo** giữ nguyên `neoDoiDuoc = false`: ngăn kéo LÀ mốc, một chip gỡ
được ở đó nghĩa là câu vừa viết trong ngăn kéo mốc N rơi ra khỏi mốc N.
Hai câu nói quá đã sửa: `composer.tsx:19` và `the-moc.tsx:181`.
Đo **trong trình duyệt thật**: `e2e/va-v2.spec.ts` — đăng mạch → nối mốc 2 → viết ở ô cuối
khán đài → **Django** xác nhận câu ấy nằm trong ngăn kéo mốc 2 và **không** ở mốc 1; bấm
`×` → câu về cả mạch, `so_binh_luan` của mọi mốc vẫn 0; mặt BÃO đếm được đúng 1 composer.

<details><summary>bằng chứng gốc</summary>
`khan-dai.tsx:166` và `:233` gọi `<Composer />` **không prop** ⇒ `anchor_moc_seq: null`.
Chip neo là `<span>` trơ, không `onClick`. Trang BÃO có **hai ô nhập trông y hệt nhau, hai luật
neo khác nhau** (`trang-mach.tsx:388` neo mốc mới nhất; ô cuối khán đài neo `null`).
Hệ quả: người đọc mặt CẶN gõ vào ô cuối trang ⇒ bình luận **không vào ngăn kéo nào**; mọi ngăn kéo
vẫn "Chưa ai neo bình luận vào mốc này" trong khi khán đài đầy chữ.
Chua nhất: `PLAN.md` mục 4 dùng đúng cơ chế *"gỡ chip → `anchor = NULL`"* làm **lý do bác** một đề
xuất khác — cơ chế mà lý lẽ ấy dựa vào thì chưa tồn tại.
Kèm hai câu nói quá: `composer.tsx:19` (*"chip đổi/gỡ được"*) và `the-moc.tsx:181` (*"đó là toàn bộ
khác biệt với composer khán đài"*).
</details>

### L08 · VỪA · `Comment.DoesNotExist` → HTTP 500 ở ba đường
**ĐÓNG (lượt vá V1, 2026-08-23).** Một `exception_handler(Comment.DoesNotExist)` cho `api_v1`
(`api/quyen.py::_binh_luan_bien_mat`) ⇒ 409 `noi_dung_da_go` + một dòng WARNING. Handler
chung thay vì `try/except` ba chỗ vì hai trong ba chỗ nằm trong `core/`, mà `core/` không
được biết mã HTTP nào.
Đo: `test_dua_ghi_500.py`, ba bài — double-click Xoá · Sửa song song Xoá · Trả lời đúng lúc
cha bị xoá thật. Cuộc đua dựng **tất định** bằng cách chèn đúng một lượt xoá vào đúng khe
(monkeypatch hàm kế tiếp trong chuỗi), request vẫn đi trọn đường thật.
**Thử phá:** gỡ handler ⇒ **3 bài đỏ** (đều `Comment.DoesNotExist` lọt ra ngoài).
⚠ **Ngoài phạm vi, chưa sửa:** `api_admin` không có handler tương đương — `dat_an_binh_luan`
(`ghi.py:1135`) vẫn 500 nếu tác giả xoá thật đúng lúc mod bấm ẩn.

<details><summary>bằng chứng gốc</summary>
`ghi.py:790` (`xoa_binh_luan`), `ghi.py:761` (`sua_binh_luan` → `refresh_from_db`),
`cay_binh_luan.py:72` (`cap_phat_path`). Không có `exception_handler(ObjectDoesNotExist)` cho `api_v1`.
Ca: double-click Xoá · Trả lời đúng lúc bị xoá thật · Sửa song song Xoá. `Comment` là model **duy
nhất** có đường xoá cứng nên chỉ nó dính.</details>

### L09 · VỪA · `dat_reaction` → HTTP 500 khi double-click
**ĐÓNG (lượt vá V1, 2026-08-23).** `core.ghi.dat_reaction` bọc riêng lượt `INSERT` trong một `atomic()` lồng
(savepoint — không có nó thì `IntegrityError` làm hỏng cả transaction ngoài, tức chữa 500
bằng 500 khác) rồi bắt đúng `reaction_duy_nhat_moc` và chuyển sang `UPDATE`.
Kết cục là **200**, không phải 409: hai lượt bấm của cùng một người trên cùng một mốc là
idempotent theo đúng nghĩa sản phẩm. Khác `Trich` — ở đó hai lượt là hai *câu khác nhau*.
Đo: 8 luồng cùng vạch xuất phát, ở cả tầng `core` lẫn qua HTTP ⇒ 0 lỗi lọt ra, đúng 1 hàng.
`test_ghi_bat_dung_loi.py` ghim `RB_REACTION_MOC` khớp tên constraint Postgres THẬT.
**Thử phá:** gỡ lưới bắt ⇒ **2 bài đỏ** (`IntegrityError: reaction_duy_nhat_moc`).

<details><summary>bằng chứng gốc</summary>
`ghi.py:860`: `select_for_update().filter(user, moc).first()` — **không có hàng nào để
khoá** ⇒ hai transaction cùng `create()` ⇒ `IntegrityError` bay thẳng ra. Đường trích gặp đúng cuộc
đua này và đã xử 409; reaction thì không.</details>

### L10 · VỪA · Đường trích quy MỌI `IntegrityError` về 409 "đã có trích khác" — nói dối
**ĐÓNG (lượt vá V1, 2026-08-23).** `trich_vao_so_api` phân biệt bằng `_la_va_cham(e, RB_TRICH_HIEU_LUC)`: va rào 1
⇒ 409 `da_co_trich`; nguyên nhân khác ⇒ `logger.exception` + 409 `noi_dung_da_go`
("bình luận này vừa bị gỡ"). Không nuốt im lặng — stacktrace vẫn còn cho ca thứ ba.
Đo: `test_dua_ghi_500.py`, ba bài (khẳng định · phủ định dùng `IntegrityError` **thật** từ
Postgres · đối chứng đường bình thường vẫn 201).
**Thử phá:** đổi điều kiện thành `if True` ⇒ **1 bài đỏ** (mã về lại `da_co_trich`).

<details><summary>bằng chứng gốc</summary>
`mocs.py:340`. FK của Django trên Postgres là `DEFERRABLE INITIALLY DEFERRED` (xác minh
bằng `\d core_trich`) nên FK nổ ở **COMMIT**. Ca: chủ mạch trích C đúng lúc tác giả C xoá thật C ⇒
chủ mạch nhận *"Mốc N vừa có một trích khác được ghi vào cùng lúc"* — hoàn toàn sai, đi tìm cái
trích không tồn tại.</details>

### L11 · VỪA · `HAN-MUC-KHONG-KHOA` — hạn mức 3 mốc/ngày đếm NGOÀI khoá
**ĐÓNG (lượt vá V1, 2026-08-23).** Phép đếm chuyển vào **trong** `atomic()`, sau `Mach.objects.select_for_update()`;
`them_moc` xin lại đúng hàng ấy trong cùng transaction (khoá tái nhập, không chờ ai). Thoát
khỏi khối bằng một ngoại lệ riêng `_QuaHanMucMoc` chứ không `return` — `return` từ giữa
`atomic()` là **commit**.
Đo: 8 request song song ở mức "còn một suất" ⇒ đúng **1 lượt 201**, 7 lượt 429, mạch dừng ở
3 mốc.
**Thử phá:** chuyển phép đếm ra ngoài khoá ⇒ **1 bài đỏ**, `8 == 1` (tám lượt 201 ⇒ 10 mốc
trong một ngày).

<details><summary>bằng chứng gốc</summary>
`machs.py:466` đếm **trước** `atomic()` ở `:479`; `them_moc` mới `select_for_update` hàng
`Mach`. Double-click ⇒ cả hai đọc `2 < 3` ⇒ **4 mốc trong một ngày**, 201 cả hai lần, không log.</details>

### L15 · VỪA · `CotVote` không xử nhịp `dangTai` ⇒ người ĐÃ đăng nhập nhận lý do SAI
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Hằng thứ ba `LY_DO_DANG_TAI = "Đang tải phiên…"`, và thứ tự ba
nhánh là thứ tự của sự thật: khoá → **chưa biết** → chưa đăng nhập. Nhánh "chưa biết" phải
đứng TRƯỚC "chưa đăng nhập" vì trong nhịp ấy `dang_nhap` là `false` cho **cả hai** loại
người và chỉ một trong hai câu là đúng.

`CotVote` không dùng được cửa thoát của mọi component khác (`if (dangTai) return null`):
con số điểm là **nội dung** của trang, không phải một tiện ích ẩn được. Cùng bộ hằng nay
áp cho `HangReaction` — loạt nút mới của lượt này.
Đo: `e2e/va-v2.spec.ts` giữ `/api/v1/me` lại rồi đọc `title`/`aria-label` của mũi tên, và
**nhả ra** để xác nhận câu đổi sang lý do đúng của khách — không có vế thứ hai thì một
`LY_DO_DANG_TAI` gán vĩnh viễn cũng làm vế thứ nhất xanh.
Câu nói quá ở `cot-vote.tsx:48` đã viết lại (L20).

<details><summary>bằng chứng gốc</summary>
`cot-vote.tsx:87`. `usePhien()` trả `{toi: null, dangTai: true}` tới khi `/me` về; trong
khoảng đó mũi tên `disabled` + `title="Đăng nhập để vote"`. `Composer`, `NutTheoMach`,
`KhoiChuMach`, `HanhDongBinhLuan` đều xử `dangTai`; chỉ `CotVote` không — và chính file đó viết
*"lý do phải ĐÚNG: chưa đăng nhập ≠ mạch bị khoá"*.</details>

### L17 · VỪA · `viet_binh_luan` không gọi `doi_con_song(parent)`
**ĐÓNG (lượt vá V1, 2026-08-23).** Cửa ghi cuối cùng còn thiếu phép kiểm ấy; nay 409 `noi_dung_da_go`.
Đo: `test_dua_ghi_500.py`, ba bài (cha bị mod ẩn · cha là bia mộ · đối chứng cha bình
thường vẫn 201). `test_thong_bao.py::test_reply_vao_cha_DA_BI_GO_thi_khong_bao` đổi sang
gọi thẳng `bao_reply` — đường HTTP cũ của nó nay trả 409 nên không dựng được hàng để đo,
nhưng phép kiểm ở lớp `core` **vẫn cần** (seed / shell / migration gọi thẳng).

<details><summary>bằng chứng gốc</summary>
`machs.py:540`. Reply được vào bình luận mod **vừa ẩn**; và reply mới làm bình luận bị ẩn
có `con_song = True` nên tác giả nó **vĩnh viễn không xoá thật được nữa**.</details>

### L18 · VỪA · Ban KHÔNG chặn đăng nhập, nhưng tài liệu nói ngược lại
**ĐÓNG (lượt vá V1, 2026-08-23) — sửa CÂU, không sửa cơ chế.** Đoạn ở `api/quan_tri.py::ChiMod` nay nói đúng: ban
**không chặn được gì ở đường đăng nhập**, nó chỉ chặn cửa GHI (`api/quyen.py::DangNhap`) và
cửa quản trị. Cơ chế vẫn an toàn (ghi 403, moderate 403).
⚠ **Vế PLAN 5.10 *"hiện lý do khi bị chặn đăng nhập"* vẫn CHƯA cài** ⇒ nợ có tên
`BAN-CHUA-CHAN-DANG-NHAP`. Chọn sửa câu thay vì thêm adapter là quyết định có chủ đích của
lượt này: hook đúng là `pre_login`, nhưng bề mặt headless của allauth chỉ có sẵn một
response "tài khoản không hoạt động" **không mang được chữ của mình**, nên trả nợ tử tế là
một mục việc riêng chứ không phải một dòng thêm vào cuối lượt vá. Chỗ trả:
`core/allauth_adapter.py`.

<details><summary>bằng chứng gốc</summary>
Không có allauth adapter nào (`grep "ADAPTER" api/` rỗng). `dang_bi_ban()` chỉ được hỏi ở
`quyen.py::DangNhap` (cửa ghi) và `quan_tri.py::ChiMod`. Câu ở `quan_tri.py:70` và commit `86ea9c1`
— *"ban chỉ chặn được đường ĐĂNG NHẬP"* — **sai**.</details>

### L24 · NHỎ · `test_moi_operation_ghi_deu_co_auth` chỉ chạy trên `api_v1`
**ĐÓNG (lượt vá V1, 2026-08-23).** Hàng rào nay quét **cả hai** `NinjaAPI`. Chi tiết bắt được trong lúc vá: phải đi
qua `api._get_bound_routers()` chứ **không** `api._routers` — bản khuôn chưa gắn với
`NinjaAPI` nên `auth_callbacks` của nó không chứa `auth=ChiMod()` khai ở tầng API, và một
hàng rào báo động giả 100% là một hàng rào sẽ bị gỡ. Kèm một bài chống-rỗng riêng cho nửa
`admin` (≥ 8 đường ghi).
Bảng `CUA_GHI` thêm hai dòng mới của lượt này (`POST /reports`, `PATCH /me`) — chính hàng
rào "bảng phủ ĐÚNG tập operation" bắt chúng.

<details><summary>bằng chứng gốc</summary>
`tests/test_quyen_ghi.py:41`. `api_admin` được che bằng bảng hành vi rất chắc, nhưng không
có hàng rào **cấu trúc** tương đương. django-ninja 1.6 chuyển kiểm CSRF vào lớp auth ⇒ quên `auth=`
là mất **cả xác thực lẫn CSRF** cùng lúc.</details>

### L31 · NHỎ · `seed_dev --reset` để lại `Vote` mồ côi của người không phải seed
**ĐÓNG (lượt vá V1, 2026-08-23).** `_xoa_seed` nay dọn `Vote` theo **hai** chiều: theo `user` (như cũ) **và** theo
đích (`target_id__in` của mọi `Moc`/`Comment` thuộc mạch sắp xoá, gom id **trước** khi xoá).
Docstring `core/models/tuong_tac.py` sửa lại câu "đã dọn `Vote` tay" cho đúng một nửa cũ.

<details><summary>bằng chứng gốc</summary>
`seed_dev.py:596` chỉ xoá `Vote` của user seed; `Mach.delete()` cascade xoá `Moc`/`Comment`
mà **người khác** đã vote. Đo thật: **14 hàng mồ côi**. Rác, không sai số.</details>

### L37 · NHỎ · `coBaseUrl` nới đúng một chiều sau khi viết lại
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** `coBaseUrl` nay hỏi
`coKhoaTangDau(khai, "baseUrl")` thay vì `/\bbaseUrl\b/`: khoá phải nằm ở **tầng đầu** của
thân hằng, độ sâu đếm qua cả ba loại ngoặc `{}` `[]` `()`. Một `baseUrl` nằm trong một hàm,
một mảng hay một object con thì không phải khoá của object ấy, và spread nó vào một lời gọi
API không đặt `baseUrl` cho lời gọi nào.

Hai bài đo đi CẶP, và cái cặp ấy là điểm chính: ca giả bị chặn **và** `CHUNG_ISR` thật vẫn
qua — bịt L37 bằng cách siết chết là chặn cứng cơ chế ISR của PLAN 8.4.
Phép quét nay sống ở `e2e/don-vi/quet-ngoac.ts`, dùng chung với bản admin (xem L25).
**Thử phá:** đổi ngược về `/\bbaseUrl\b/.test(khai)` ⇒ **1 bài đỏ** — `L37 — baseUrl nằm
SÂU trong thân hằng KHÔNG được tính`, `Expected: false / Received: true`.

⚠ Vẫn là phân tích chuỗi, không phải parser: nó không hiểu chuỗi ký tự, template literal
hay comment có chứa dấu ngoặc. Bản đúng nghĩa là dùng type checker của TypeScript (cùng lối
`scripts/rao-can-client.mjs`) — một mục việc riêng, ghi ở docstring `quet-ngoac.ts`.

<details><summary>bằng chứng gốc</summary>
Bản quét-ngoặc-cân-bằng cho lọt `const C = { fetch: (u) => fetch(u, { baseUrl: 0 }) }` +
`xemMach({ ...C })` — bản một-tầng-ngoặc cũ **không** cho lọt. Nên câu *"Luật KHÔNG bị nới"* ở
`type-frontend.spec.ts:291` không hoàn toàn đúng. Không đạt tới được từ code hiện tại.</details>

---

## Xuyên suốt

### L19 · VỪA · `README.md` sai ở 6 dòng liên tiếp
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Bảng "Trạng thái" viết lại từ đầu: cột "Đã chạy" nay liệt kê
tài khoản · đường ghi (kể cả reaction) · hai mặt BÃO/CẶN · follow/chuông · khu quản trị ·
ảnh local · công tắc theme; cột "Chưa có" giữ đúng những thứ **thật sự** chưa có (Google
OAuth, tìm kiếm, email mốc mới cho follower, SMTP thật, Caddy, sao lưu ngoài máy). Ba câu
sai khác cũng sửa: *"apps/admin — khung, Phase 4 mới làm"*, *"khu quản trị… Phase 4"*, và
dòng lệnh Lighthouse nay ghi cả Accessibility. Thêm một link tới chính `LOI-VA-NO.md` —
người clone repo nên biết sổ này có.

<details><summary>bằng chứng gốc</summary>
Vẫn viết *"Phase 1 đã xong — trang CHỈ ĐỌC"*, *"Chưa có: Đăng nhập / Mọi thao tác ghi / Mặt
BÃO, follow, notification / Khu quản trị"*, *"mũi tên vote bị khoá"*, *"`apps/admin` — khung, Phase
4 mới làm"*. Commit `f0a72d9` **có** sửa README (một câu về `/api/admin/`) rồi để nguyên bảng này.
Người ngoài clone repo đọc README sẽ kết luận sai về gần như mọi năng lực.</details>

### L20 · NHỎ · Mười ba câu "chữ nói quá thứ code làm"
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Mọi câu **còn sửa được** đã sửa. Theo dấu từng câu:

| Câu | Xử ở đâu |
|---|---|
| `apps/admin` — nhãn `Đóng: Đã ban` | L04 — nhãn đổi, và hành động thành có thật |
| `composer.tsx:19` *"chip đổi/gỡ được"* | L05 — cơ chế đã có thật |
| `the-moc.tsx:181` *"đó là toàn bộ khác biệt"* | L05 — nay là **hai** khác biệt, viết đúng |
| `README.md` bảng trạng thái | L19 — viết lại |
| `app/luat/page.tsx:47` *"thuộc giai đoạn sau"* | L35 — thay bằng mục **Chế tài** |
| `cot-vote.tsx:48` *"lý do phải ĐÚNG"* | L15 — nay kể đủ **ba** ca |
| `revalidate.py:14` · `deploy/Caddyfile:36` | đã xử ở V1 |
| `type-frontend.spec.ts:291` *"Luật KHÔNG bị nới"* | L37 — nay câu ấy đúng |
| commit `64b1a94` · commit `ab77957` | **không sửa được** — thông điệp commit đã đẩy |

Hai dòng cuối là lý do mục này không đóng sạch theo nghĩa tuyệt đối: một câu sai nằm trong
lịch sử git chỉ sửa được bằng cách viết lại lịch sử, và cái giá ấy cao hơn cái hại. Chúng
ở lại đây làm vết.

<details><summary>bằng chứng gốc</summary>
Lượt vá V1 đóng phần thuộc L03/L13/L18 (câu đã khớp code), cùng
`revalidate.py:14` (L29) và `deploy/Caddyfile:36` (nay ĐÚNG: Django thật sự làm hạn mức
theo user và theo ngày lịch VN — xem L12). Còn lại là việc của V2.
Danh sách đầy đủ ở báo cáo phản biện trục sản phẩm. Gồm L04/L05/L19 ở trên,
cộng: `deploy/Caddyfile:36` (*"hạn mức là việc của Django"*) · `revalidate.py:14` (nợ giả, xem L29) ·
commit `64b1a94` (*"cắm nguồn người nhận cho digest"* — cắm vào cờ không ai bật được) ·
`app/luat/page.tsx:47` (*"quy trình xử lý của quản trị viên thuộc giai đoạn sau"* — đã có) ·
commit `ab77957` (*"365 e2e"* — không tái lập được từ clone sạch, xem L07) ·
`cot-vote.tsx:48` (*"lý do phải ĐÚNG"* — xem L15).</details>

### L25 · NHỎ · Hai bản của cùng một luật đã lệch nhau
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Không còn hai bản: `thanHang` / `coBaseUrl` dời sang
**`e2e/don-vi/quet-ngoac.ts`**, và cả `type-frontend.spec.ts` lẫn `type-admin.spec.ts`
`import` từ đó. File chung **không phải `.spec.ts`** — Playwright không thu nó, nên hai
spec dùng chung được mà không đăng ký bài đo hai lần.

`quet-ngoac.spec.ts` ghim luôn vế "cả hai THẬT SỰ dùng nó": đọc nguồn hai spec, đòi có dòng
`import`, và đòi **không** file nào tự khai lại `coBaseUrl`/`thanHang` — chính hình dạng
của L25. Bản chung cũng bịt L37 cùng lúc.

<details><summary>bằng chứng gốc</summary>
`type-admin.spec.ts:99` vẫn `\{([^{}]*)\}` một tầng ngoặc, bản web đã chuyển sang quét cân
bằng. Lệch theo chiều an toàn (admin báo vi phạm giả nếu ai thêm hằng lồng) nhưng là bẫy chờ sẵn.</details>

### L28 · NHỎ · `settings.py:243` nói thư ra `api/sent_emails/`
**ĐÓNG (lượt vá V1, 2026-08-23) — nhưng đây là ĐỌC HỤT, không phải câu sai.** Dòng ấy đang mô tả một khối cấu hình
**đã bị xoá** ở lượt gộp 2026-08-23, và ba dòng sau nó đã nói `api/.mail/`. Vì đọc lướt hai
đoạn này dễ nhớ nhầm con đường sai (lượt phản biện nhớ nhầm thật), đã thêm một dòng cảnh
báo **ngay trên đầu khối** nói thẳng thư nằm ở đâu.

### L29 · NHỎ · `revalidate.py:14-19` là NỢ GIẢ
**ĐÓNG (lượt vá V1, 2026-08-23).** Khối cảnh báo ở `core/revalidate.py` viết lại: chiều này **đã có tác dụng thật**
từ `ab77957`, và câu cũ đã sai từ lượt ấy. Docstring `tests/test_revalidate.py` cũng mang
đúng một câu như thế — sửa cả hai.

<details><summary>bằng chứng gốc</summary>
Còn cảnh báo *"chiều này CHƯA có tác dụng thật… `page.tsx` vẫn `force-dynamic`"*. Nợ
`ISR-BIEN-THE-ROUTE` **đã trả** ở `ab77957`; `page.tsx:31` nay là `revalidate = 3600`. Ai đọc file
này sẽ kết luận sai rằng cả cơ chế là no-op.</details>

### L32 · NHỎ · `e2e/dung-seed.ts` ghi thẳng `hidden_at`, đi vòng qua `core/ghi.py`
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** `donRacLanTruoc` nay lặp qua từng mạch rác và gọi
`core.ghi.dat_an_mach(mach=…, boi=<staff của seed>, an=True, ly_do="dọn rác e2e")`.

⚠ **Và nó KHÔNG vô hại như mục này từng ghi.** `dat_an_mach` còn gọi `dong_bo_kho_anh` cho
mọi mốc — chuyển ảnh sang kho không server nào phục vụ (A9). Bản `update()` bỏ qua bước ấy,
nên **ảnh của mạch rác vẫn phục vụ được qua `/media/`** dù mạch đã biến khỏi mọi cửa đọc.
Điều đó đúng từ lúc Phase 5 gộp vào, tức mục này đã nặng hơn hạng NHỎ của nó mà không ai đo
lại. Câu "vô hại về số" chỉ đúng với các cột đếm.

<details><summary>bằng chứng gốc</summary>
Luật "không một dòng nào ghi thẳng `hidden_at`" được viết ở `ghi.py:70` và
`quan_tri_kiem_duyet.py:3`. Hôm nay vô hại về số (đã đối soát). Nếu mai `dat_an_mach` phải kéo theo
một cột, đây là chỗ quên.</details>

### L35 · NHỎ · `/luat` nói nửa sai
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Đoạn *"Nút báo cáo và quy trình xử lý của quản trị viên thuộc
giai đoạn sau"* thay bằng một mục **Chế tài** nói đúng thứ đang chạy: menu `⋯` có mục Báo
cáo, báo cáo vào hàng đợi mod, mod ẩn/khoá/ban, mọi quyết định để lại một dòng nhật ký
không xoá được, mạch bị khoá vẫn đọc được. Mục "Chưa có ở bản này" thu về đúng phạm vi thật
của nó (draft nguyên tắc, chưa phải điều khoản sử dụng).

Đây là chữ nói **THIẾU** thay vì nói quá, và nó tệ ngang: trang LUẬT bảo người đọc rằng
không có chế tài nào, đúng lúc chế tài đã chạy — tức nó dạy người ta đừng buồn báo cáo.

<details><summary>bằng chứng gốc</summary>
`app/luat/page.tsx:47` — quy trình xử lý của quản trị viên **đã có**. Vế thứ hai
của mục này (*"chỉ nút báo cáo là chưa"*) đã hết đúng từ lượt vá V1: nút báo cáo nay có
thật (L03). Nghĩa là câu ở `/luat` nay sai **hoàn toàn**, không còn nửa đúng nào.</details>

### L36 · NHỎ · "Flake" 1/3 ở bài vote — **KHÔNG phải flake, đã tìm ra nguyên nhân**
**ĐÓNG (lượt gộp Phase 5, 2026-08-23).** Nguyên nhân là **L41**: `.next/cache` giữ payload
từ trước khi schema đổi. Bài nào trúng một mạch có payload cũ thì đỏ, không trúng thì xanh —
đúng hình dạng một flake, nhưng tất định. Xoá `.next/cache` ⇒ xanh ngay, tái hiện được cả hai
chiều. Nghiệm thu chạy 3 lượt không bắt lại được vì cache lúc đó đã ấm bằng payload mới.

<details><summary>bằng chứng gốc</summary>
B2 báo bài "mũi tên vote SỐNG" đỏ 1 trong 3 lượt, chạy riêng file thì xanh. Nghiệm thu chạy
3 lượt đầy đủ tuần tự: 365/365 cả ba, không tái hiện.</details>

### L41 · **NẶNG** · Cache dữ liệu của Next sống qua thay đổi schema ⇒ **500 trên prod sau deploy**
**ĐÓNG (lượt vá V2 — giao diện, 2026-08-23).** Một **cơ chế**, không phải một dòng tài liệu:
`scripts/xoa-cache-du-lieu.mjs` xoá `.next/cache/fetch-cache` (và `incremental-cache` nếu
có), và nó **được nối vào `build` của CẢ HAI app**:
`node ../../scripts/xoa-cache-du-lieu.mjs && next build`. Vì `pnpm e2e` chạy `pnpm run
build`, bộ đo cũng thôi ăn payload cũ — tức L36 chết ở gốc, không chỉ ở triệu chứng.

Xoá **chọn lọc** chứ không `rm -rf .next/cache`: `webpack`/`swc` ở lại, nếu không mọi lần
build đều lạnh và bước này sẽ bị ai đó gỡ ra trong ba tháng. Hai hằng
`THU_MUC_CACHE_DU_LIEU` / `THU_MUC_GIU_LAI` khai tường minh — "xoá cái gì" và "giữ cái gì"
là hai khẳng định khác nhau, và bài đo đòi chúng không giao nhau.

Đo: `apps/web/e2e/don-vi/cache-du-lieu.spec.ts` (4 bài) — dựng lại đúng bố cục
`.next/cache` thật kèm payload **thiếu `anhs`** (khẳng định TRƯỚC rằng nó thật sự thiếu,
không phải một chuỗi rác), đòi nó không sống sót · cache biên dịch sống sót · máy sạch
không ném · và **bước dọn có mặt trong `scripts.build` của cả hai `package.json`**.
**Thử phá:** (1) `THU_MUC_CACHE_DU_LIEU = []` ⇒ **1 bài đỏ**
(`Expected value: "fetch-cache" / Received array: []`); (2) gỡ bước khỏi
`apps/web/package.json` ⇒ **1 bài đỏ** (`Received string: "next build"`).

⚠ **Cái bài đo KHÔNG chứng minh:** rằng Next 15.5 crash khi gặp payload thiếu trường.
Chuyện ấy đã xảy ra một lần trên cây này (stack trace ngay dưới); dựng lại nó trong một bài
đo đòi chạy trọn vòng build → deploy → build, tức đúng thứ chỉ lộ ra sau khi deploy. Ghi ra
thay vì để con số "4 bài xanh" nói hộ.

⚠ Và lượt này **tự dựng lại đúng ca ấy**: `MocOut` mọc thêm trường **bắt buộc** `reactions`.
Không có bước dọn thì mọi trang mạch còn payload cũ sẽ đọc `undefined` sau khi deploy.

<details><summary>bằng chứng gốc</summary>
Phát hiện ở lượt gộp Phase 5, 2026-08-23.
`.next/cache` (fetch/data cache của ISR) **không bị xoá khi build lại**. Deploy một bản thêm
trường bắt buộc vào response API ⇒ trang nào còn được phục vụ từ payload cũ sẽ đọc `undefined`
và **crash server-side**, không phải render thiếu.
Đo thật: sau khi gộp Phase 5 (`MocOut` mọc `anhs`), render trang mạch ném
`TypeError: Cannot read properties of undefined (reading 'length')` ở `stringify` — tức **500**
với người dùng thật, trong khi `anhs` là trường **bắt buộc** ở cả schema Python lẫn TS.
Xoá `.next/cache` ⇒ hết ngay. Đây là lý do của L36.</details>
→ Cần một cơ chế: xoá cache dữ liệu như một bước của deploy, hoặc gắn phiên bản schema vào
khoá cache. **Chữ trong tài liệu không đủ** — đây là thứ chỉ lộ ra sau khi deploy.

### L42 · VỪA · `/media/*` không có đường nào ở dev ⇒ mọi ảnh 404
**ĐÓNG (lượt gộp Phase 5, 2026-08-23).** `api/config/urls.py` mount `static()` đúng, và
docstring của nó khẳng định *"trình duyệt → Next 3000 (`rewrites` trong `next.config.ts`) →
Django 8000"* — **nhưng rewrite đó không tồn tại**. Upload trả 201, hàng DB đúng, `<img src>`
đúng, và mọi tấm ảnh 404. Không gì đỏ ở tầng Python vì Django phục vụ được; chỉ trình duyệt
mới thấy. Loài "chữ nói quá code" lần thứ 16.
→ Đã thêm rewrite `/media/:path*` vào `apps/web/next.config.ts`. `e2e/anh.spec.ts::A1` bắt
đúng ca này bằng cách fetch lại chính `src` nó vừa đọc từ DOM.

### L43 · VỪA · Hoàng thổ bản SÁNG chưa đạt WCAG AA cho chữ nhỏ — và sửa nó phải đụng PLAN 9.1
**MỞ (mở mới ở lượt vá V2 — giao diện, 2026-08-23).**

Đo bằng số, công thức WCAG 2.1 (`apps/web/e2e/don-vi/tuong-phan.spec.ts`):

| cặp | tỉ số | ngưỡng chữ nhỏ | chỗ dùng |
|---|---|---|---|
| `--stamp` `#B07A2B` trên `--surface` `#FFFFFF` | **3.71:1** | 4.5 | "đã sửa N lần" · "DRAFT" · "Được trích ×N" |
| `--stamp` `#B07A2B` trên `--bg` `#F1F2F5` | **3.31:1** | 4.5 | vạch mới · "ĐÃ ĐÓNG SỔ" 10.5px |

Bản TỐI đạt thoải mái (`#D8A455` trên `#161A21` = 7.78:1). Chỉ bản sáng hỏng, và mọi chỗ
dùng hoàng thổ đều là **chữ nhỏ** — không cái nào đủ điều kiện "large text" (≥18.66px đậm).

**Vì sao lượt V2 không sửa:** `#B07A2B` do `PLAN.md` 9.1 ghim đích danh, và mục 9.1 bị ghim
SHA-256 ở `mau-token.spec.ts`. Lượt giao diện bị cấm tường minh chạm vào 9.1 — đúng thứ lớp
băm ấy sinh ra để bắt phải cố ý. Bài đo vì thế hạ hai cặp này xuống ngưỡng **phi văn bản**
(3:1) kèm nhãn `MIỄN TRỪ L43`: nghĩa là *"hôm nay hoàng thổ chỉ đủ tư cách một dấu hiệu phi
văn bản"* — đúng sự thật, và nó vẫn ĐỎ nếu ai làm nó tệ thêm. **Xoá hai dòng ấy khỏi bảng
thì bài đo im lặng, và im lặng đọc thành "đã đạt".**

**Hai cách chữa, và cái giá của mỗi cách:**
1. **Đổi `#B07A2B` sang một hoàng thổ đậm hơn** (cần ≈ `#8A5F1F` để chạm 4.5:1 trên trắng).
   Rẻ về code, đắt về quy trình: sửa PLAN 9.1 · cập nhật `HEX_STAMP` · dán lại
   `BAM_MUC_91` · một người phải đọc lại toàn bộ allowlist. Và nó đổi diện mạo của mọi con
   dấu trên site.
2. **Thêm một token thứ hai** (`--stamp-chu`) chỉ dùng cho CHỮ, giữ `--stamp` cho vạch và
   viền. Không đụng giá trị PLAN ghim, nhưng thêm một màu PLAN không nói tới — tức vẫn là
   một quyết định thẩm mỹ phải ghi vào plan con.

⇒ Cả hai đều là quyết định của người, không phải của một lượt vá. **Tiêu chí T5 của plan
giao diện ("AA mọi cặp ở cả hai theme") vì thế CHƯA đạt trọn** — đạt 19/21 cặp.

---

# B · NỢ CÓ TÊN mang từ Phase 1 sang

| Tên | Nội dung | Gỡ khi nào |
|---|---|---|
| `KEYSET-BIEN-DOI` | cursor `?sort=nhieu_diem` chạy trên khoá biến đổi — mạch có thể sót/lặp trong một lượt cuộn | chốt KHÔNG chữa |
| `DONG-BO-DIEM` | **đã trả** ở Mảng A (đổi sang `UPDATE` một cột) | ĐÓNG |
| `NAV-GHI-CUNG` | **đã trả** ở B2 (`dieu-huong-sub.tsx` hỏi `GET /subs`) | ĐÓNG |
| `INDEX-TOP-KHOANG` | "top theo khoảng" luôn `Sort` trong bộ nhớ, keyset trang 2 rơi xuống `Filter` | khi có dữ liệu đủ lớn để `EXPLAIN ANALYZE` nói được gì |
| `BAM-MUC-91` | băm PLAN 9.1 là chữ ký của một con người, không phải phép chứng minh | không có kế hoạch gỡ |
| `LOP-1-MU` | lớp 1 hàng rào 9.1 mù D2/D3; chỉ lớp băm chặn | không có kế hoạch gỡ |
| `WILSON-DOCSTRING` | docstring `wilson_lower_bound` khẳng định đẳng thức chỉ đúng trên giấy | một dòng, bất cứ lúc nào |
| `MAT-DO-DONG` | "nén mật độ dòng theo 9.1" không có tiêu chí đo được | cần chốt một con số |
| `N+1-NGAN-KEO` | **đã trả** ở B2 (theo đường ISR) | ĐÓNG |
| `DANG-DOC-ROUND-TRIP` | **đã trả** ở B2 | ĐÓNG |
| `VOTE-CUA-TOI` | **đã trả** ở B2 (`my_votes` từ `/me`) | ĐÓNG |
| `MOC-THIEU-AUTHOR` | **đã trả** ở B2 | ĐÓNG |
| `API-THIEU-MOC-THOI-GIAN` | **đã trả** ở B2 (ba hằng frontend đã xoá) | ĐÓNG |
| `DAU-CHU-NGUOI-DUNG-MOT-CHIEU` | hàng rào Y3 chỉ có răng một chiều — thêm dấu nhầm lên chữ ứng dụng thì im lặng | khi mở phạm vi sang trang mạch |
| `KHOI-DANG-DOC-GOC-AN` | `so_ung_vien_bo_lai = 0` chỉ nói về thread GỐC đọc được | khi có ca thật |
| `1b #6` | hồ sơ cắt ở `limit=20`, không có cursor | khi có người vượt 20 mạch |
| `1b #8` | deep-link từ khối trích có thể trỏ vào trang sau của khán đài | Phase 3 (chưa làm) |
| `REACTION-CHUA-CO-UI` | **đã trả** ở V2 — `components/hang-reaction.tsx`; `MocOut` mọc `reactions` (đếm chung, cache được), `my_reactions` vẫn đi cửa `/me` | ĐÓNG |
| `GOOGLE-CHUA-DO` | code OAuth viết theo tài liệu, chưa chạy lần nào | khi có credential |
| `FORM-FIGURES` | **đã trả** ở V2 — `TruongFigures` trong `components/truong-moc.tsx`, ≤6 cặp, dùng chung cho cả ba form ghi | ĐÓNG |
| `UI-DIFF-REVISION` | **đã trả** ở V2 — `components/ban-cu-moc.tsx`, nhãn "đã sửa N lần" thành nút, nạp KHI BẤM. Là ĐỐI CHIẾU nguyên văn, không tô xanh/đỏ từng từ (PLAN 9.1 khoá hai màu ấy cho con số lãi/lỗ) | ĐÓNG |
| `OG-HOANG-THO` | nhãn "ĐÃ ĐÓNG SỔ" trên ảnh OG không có hoàng thổ (satori không giải `var()`) | — |
| `OG-MAU-BAN-SAO` · `URL-MACH-HAI-BAN` · `XML-QUET-NONG` | ba bản sao/xấp xỉ có ghi chú tại chỗ | — |
| `BACKUP-CUNG-MAY` | bản dump nằm cùng máy với DB thì không phải bản sao lưu | khi có đích ngoài máy |

## Nợ có tên MỞ THÊM ở lượt vá V1 (2026-08-23)

| Tên | Nội dung | Gỡ khi nào |
|---|---|---|
| `BAN-CHUA-CHAN-DANG-NHAP` | PLAN 5.10 đòi *"hiện lý do khi bị chặn đăng nhập"*; hôm nay ban **không** chặn đăng nhập, chỉ chặn cửa GHI và cửa quản trị. Hook đúng là `DefaultAccountAdapter.pre_login` (`core/allauth_adapter.py`); cái khó là trả **lý do** qua bề mặt headless — allauth chỉ có sẵn một response "tài khoản không hoạt động" không mang được chữ của mình. Xem L18 | mục việc riêng |
| `SHADOW-LIMIT-XOA-THAT` | hạn mức 5 bình luận/giờ đếm trên bảng `core_comment`, nên nhánh **xoá THẬT** của PLAN 5.3 (bình luận không reply, chưa từng được trích) lách được: viết 5 → xoá 5 → viết tiếp. Bia mộ và bình luận bị ẩn thì vẫn đếm (có bài đo). Trả nó cần một bộ đếm sống độc lập với hàng bị xoá, tức một bảng mới | khi có dấu hiệu bị lách thật |
| `TRANG-CAI-DAT` | **đã trả** ở V2 — `app/cai-dat/page.tsx` + `components/form-cai-dat.tsx`, vào được từ menu tài khoản. ⚠ `test_digest.py` vẫn ghim `"/cai-dat" not in thu.than` và **cố ý giữ nguyên**: gắn link huỷ đăng ký vào thư là việc của `core/digest.py`, mà SMTP thì "chưa bao giờ chạy thật" — mở lại link trong một lượt không đo được thư là đúng loài "chữ nói quá code" | ĐÓNG (một nửa: link trong thư vẫn chờ lượt có SMTP) |

---

# B2 · PHÁT HIỆN MỚI trong lượt vá V1 — **cả ba ĐÃ VÁ ở lượt Phase 7 (2026-08-23)**

### L38 · VỪA · `api_admin` không có lưới bắt `Comment.DoesNotExist` — cùng họ với L08
**ĐÃ VÁ (Phase 7, 2026-08-23).** L08 gắn `exception_handler(Comment.DoesNotExist)` cho
`api_v1`, nhưng `core/ghi.py::dat_an_binh_luan` cũng `select_for_update().get()` trên một
hàng `Comment`. Tác giả xoá THẬT đúng lúc mod bấm "Ẩn" ⇒ **HTTP 500 ở khu quản trị**.

Nguyên nhân gốc là chỗ ĐẶT chứ không phải chỗ thiếu: handler bị chôn bên trong
`dang_ky_xu_ly_loi_ghi`, mà khu quản trị **không** gọi hàm ấy — nó có bản auth/CSRF riêng.
Bản vá tách ra `api/quyen.py::dang_ky_binh_luan_bien_mat(api)` và gọi cho **cả hai**
`NinjaAPI`.

Hai bài đo, và cái thứ hai mới là cái chặn lượt sau: `test_l38_quan_tri_binh_luan_bien_mat
.py` đo đường đi thật (mod bấm Ẩn giữa lúc hàng biến mất ⇒ 409), **cộng** một bài **cấu
trúc** duyệt mọi `NinjaAPI` của repo và đòi từng cái có lưới — API thứ ba mở ra mà quên
gắn thì ĐỎ, chứ không phải lặp lại L38 lần nữa.

### L39 · NHỎ · Hạn mức theo IP là NO-OP (hoặc chặn cả thế giới) nếu prod quên một biến
**ĐÃ VÁ (Phase 7, 2026-08-23).** `HAN_MUC_DANG_KY_MOI_IP_NGAY` chỉ có nghĩa khi
`TIN_X_FORWARDED_FOR=True`: sau Caddy, `REMOTE_ADDR` của **mọi** request là `127.0.0.1`,
nên để `False` thì cả thế giới dùng chung một khoá đếm và người thứ sáu trong ngày bị chặn
oan.

Câu chốt của mục này lúc mở là *"`api/.env.example` nói ra bằng chữ, nhưng chữ không phải
hàng rào"* — nên bản vá là **một hàng rào chạy được**, không phải thêm chữ:
`core/kiem_trien_khai.py::kiem_han_muc_ip`, một `django.core.checks` chạy trước **mọi**
management command. Prod cấu hình sai thì `migrate` **thất bại và nói ra phải làm gì**,
thay vì chạy tiếp rồi chặn oan người thứ sáu.

Im lặng ở ba ca hợp lệ (dev `DEBUG=True` · đã tin proxy · hạn mức đặt `0`) — đo cả bốn ô
của bảng chân trị ở `test_l39_kiem_han_muc_ip.py`, vì một bản cài kêu vô điều kiện cũng
xanh nếu chỉ đo ca đỏ, và nó sẽ là thứ người ta tắt bằng `SILENCED_SYSTEM_CHECKS` ngay
hôm đầu. Bài thứ năm đo phép kiểm **thật sự nằm trong registry** — một `@register()` trong
module không ai import là hàng rào không tồn tại.

### L40 · NHỎ · `dem_dang_ky_trong_ngay_vn` quét bảng `core_user` không index
**ĐÃ VÁ (Phase 7, 2026-08-23).** `filter(dang_ky_ip=…, date_joined__gte=…)` chạy mỗi lượt
đăng ký, không có index nào phủ. Thêm `Meta.indexes` trên `User` +
`0011_phase7_l40_index_dang_ky_ip`.

Thứ tự cột không đảo được: `dang_ky_ip` (so BẰNG) trước, `date_joined` (so KHOẢNG) sau —
đảo lại thì Postgres chỉ dùng được cột đầu. `test_l40_index_dang_ky_ip.py` soi
`pg_indexes` của schema THẬT, không soi `Meta.indexes` của model: khai trong model mà quên
`makemigrations` là cách sai duy nhất có thể xảy ra ở đây, và một bài đo đọc model sẽ xanh
cho đúng cái sai đó.

---

### L44 · NHỎ (đọc sai số) · 16 bài tìm kiếm **skip IM LẶNG** khi máy không có Meilisearch
**MỞ.** Cố ý (máy không cài thì không đỏ oan), nhưng hệ quả là *"`pnpm test` xanh"* **không**
chứng minh S1–S4/S8 đã được đo. Mốc đúng cho Phase 7 là **987 khi Meilisearch đang chạy**, hoặc
phải viết rõ **"971 + 16 skipped"** — không được ghi trống "xanh".
Dựng lại: xem docstring đầu `api/tests/test_tim_kiem_that.py`.

### L45 · NHỎ (nhưng ăn mòn niềm tin) · `test_W6_phep_cat_KHONG_nuot_he_so_tuoi` **flake theo thứ tự chạy**
**MỞ.** Bắt được 2026-08-24: chạy `pnpm test` đầy đủ thì ĐỎ (`1 failed, 1022 passed`), chạy lại y
nguyên thì XANH (`1023 passed`), và chạy riêng file `tests/test_pha_hoa_wilson.py` thì xanh **3/3
lần**. Không liên quan tới việc đang làm lúc đó (phân trang khu quản trị — chỉ đụng
`api/quan_tri_*`; bài này gọi `/api/v1/machs/{id}/comments`).

Vì sao đáng ghi chứ không phải "chạy lại là xong": một bài đo đỏ ngẫu nhiên dạy người ta **bấm chạy
lại**, và cái phản xạ đó sẽ nuốt luôn lần đỏ THẬT đầu tiên.

Nghi phạm, **chưa xác minh**: điều kiện hệ số tươi là `created_at > last_entry_at`
(`core/xep_hang.py::_duoc_he_so_tuoi`). Fixture `mach` dựng mốc 1 ở `timezone.now()`, còn bài đo
dựng bình luận "vừa viết" cũng ở `timezone.now()` — hai mốc cách nhau vài mili giây, và nếu chúng
bằng nhau thì `<=` cho `False` ⇒ mất `+0.15` ⇒ `wilson(1,3) = 0.078` thắng ⇒ đúng câu assert đã đỏ.
**Cùng loài** với flake `test_response_mang_du_HAI_dau_thoi_gian` đã vá cùng ngày, và cách vá ở đó
dùng lại được: lùi mốc của fixture một giây, **không** nới `<` thành `<=` (nới là bỏ mất chính ca
biên mà hàng rào ấy tồn tại để bắt).

Dựng lại: `pnpm test` nhiều lượt liên tiếp; chưa có lệnh nào ép nó đỏ theo ý muốn — và **đó là phần
tệ nhất của mục này**.

### L46 · VỪA (đánh đổi có chủ đích) · `GOOGLE_CLIENT_SECRET` nay nằm trong DB ⇒ có trong MỌI bản dump
**MỞ, chấp nhận.** Từ 2026-08-24 credential Google nhập qua khu quản trị và lưu ở hàng
`SocialApp`. Trước đó nó ở `api/.env` (gitignored, không bao giờ rời máy).

Hệ quả: `pnpm db:sao-luu` sinh file dump **chứa secret**. `backup/` có trong `.gitignore`
nên nó không vào git — nhưng file trên đĩa, và mọi bản sao lưu mang đi nơi khác, thì có.

Đây là **giá của đơn hàng**, không phải sơ suất: user cần nhập xong thấy hiệu lực ngay,
mà env đọc một lần lúc boot nên không làm được (xem `plans/2026-08-24-cai-dat-google-oauth.md`
§0). Đã giảm thiểu ở mọi chỗ khác: secret **không bao giờ** ra khỏi server qua API (chỉ 4
ký tự cuối), **không** vào `AuditLog`, và chỉ **superuser** đọc/ghi được cấu hình.

Việc phải làm khi lên prod: coi file dump ngang hàng với file `.env` — không đẩy lên kho
lưu trữ dùng chung, không gửi qua chat. Nếu ngày nào cần mạnh hơn thì đường đúng là mã hoá
trường `secret` ở tầng ứng dụng, và lúc đó khoá mã hoá lại quay về env.

### L47 · NHỎ (UX) · Tài khoản bị Google xoá mật khẩu thì `/doi-mat-khau` không dùng được
**MỞ.** Từ 2026-08-24, đăng nhập Google trùng email ⇒ xoá mật khẩu tài khoản đó
(`core/allauth_adapter.py::AdapterMangXaHoi`, đơn hàng của user). Sau đó
`has_usable_password()` là `False`, nên trang `/doi-mat-khau` — vốn đòi **mật khẩu hiện
tại** — không còn đường đi cho họ. Đường đúng là `/quen-mat-khau` (đặt lại qua email).

Chưa hỏng gì: không ai bị khoá ngoài, chỉ là trang kia sẽ báo lỗi khó hiểu thay vì chỉ
đường. Cách trả nợ: `GET /api/v1/me` trả thêm cờ `co_mat_khau`, và giao diện đổi nhãn
thành "Đặt mật khẩu" + trỏ sang luồng đặt lại khi cờ ấy `false`.

# C · CHƯA BAO GIỜ CHẠY THẬT

| Thứ | Trạng thái |
|---|---|
| **Caddy** | `deploy/Caddyfile` chưa qua `caddy validate`, chưa một request nào — **vẫn đúng sau lượt vá V1** (`caddy version` → command not found trên máy dev). Bản vá L01 đổi cấu trúc block admin, nên nó cần đúng bốn phép thử ở cuối file hơn bao giờ hết. Đòi bản dựng bằng `xcaddy --with caddy-ratelimit` — bản tiêu chuẩn **không khởi động được**. Xem L01. |
| **SMTP** | chưa gửi thư thật lần nào. Dev ghi ra `api/.mail/`. |
| **systemd unit của Meilisearch** | `deploy/meilisearch.service` (Phase 7) chưa qua `systemd-analyze verify`, chưa khởi động lần nào — máy dev là Windows. Cùng hạng với `Caddyfile`. **Bản thân Meilisearch thì ĐÃ chạy thật** (1.53.1, `127.0.0.1:7700`), 16 bài đo của `test_tim_kiem_that.py` chạy trên nó; thứ chưa kiểm là *cách khởi động nó trên VPS*, không phải nó. |
| **Google OAuth** | không có credential. Chỉ chứng minh được vế "không có credential ⇒ nút VẮNG MẶT". |
| **Scheduler backup** | `pnpm db:sao-luu` đã chạy vòng đầy đủ **trong worktree**; ở cây chính chưa ai đo. Chưa có Task Scheduler/cron, chưa có đích ngoài máy. |
| **Phase 5 — ảnh** | **ĐÃ CHẠY** từ lượt gộp Phase 5 (lưu LOCAL, không Docker, không R2). Object storage vẫn hoãn có chủ đích. |
| **Khu quản trị trong trình duyệt** | `apps/admin` (3001) **không** nằm trong `webServer` của `pnpm e2e`, nên mọi bài đo của nó là phân tích tĩnh + test Django. Nút Khoá/Ban của L04 chưa từng được bấm bằng chuột trong một lượt đo tự động. |

---

# D · ĐÃ ĐÓNG — tóm tắt lịch sử

Phase 0 → 1d chạy đủ 5 chặng mỗi lượt; **nghiệm thu chấm ĐẠT ở mọi vòng, phản biện tìm ra lỗi thật
ở mọi vòng.** Lỗi đáng nhớ nhất, để không ai lặp lại:

- `migrate` chạy trước khi đặt `AUTH_USER_MODEL` — cánh cửa đóng vĩnh viễn.
- Health test là **phép đo rỗng**: mutant bỏ hẳn truy vấn mà vẫn `2 passed`.
- `Trich.comment = CASCADE` **xoá âm thầm cuốn sổ không-xoá-được**.
- `cap_nhat_dem_mach` không khoá ⇒ `comment_count` sai vĩnh viễn, không log, không job đối soát.
- Index `(mach_id, path)` không dùng được cho `LIKE 'prefix%'` dưới collation không phải `C`.
- `?cursor=` rác (kể cả chuỗi RỖNG) ⇒ **500 trang chủ**.
- Nút "Thử lại" của trang lỗi là **nút chết**.
- `wilson(0,20) > wilson(0,0)` — không phải hoà mà là thứ tự **đảo** do dư số float.
- Hàng rào chống rò session bị nới thành miễn trừ **theo file** ⇒ hai lời gọi thiếu `baseUrl` đi lọt.
- Hàng rào đọc `PLAN.md` fail-OPEN **hai lần**, lần thứ hai do chính bản vá lần đầu mở ra.

**Hai khuôn mẫu lặp lại nhiều nhất** (đếm được 8 và 15 lần):
1. *Mỗi lượt vá tự đẻ ra một cửa mới của chính cái luật nó đang đóng.*
2. *Chữ khẳng định mạnh hơn thứ code làm.*

---

# E · SỔ DỌC ĐƯỜNG — phát hiện ngoài phạm vi (từ 2026-08-27)

Chỗ ĐỖ cho mọi thứ tìm ra dọc đường mà **không thuộc phạm vi việc đang làm**: ghi xuống rồi quay
lại việc cũ ngay, để không ai phải chọn giữa "quên nó đi" và "bỏ dở việc đang làm".

- Chỉ **THÊM vào cuối**. Không sửa/sắp lại mục cũ khi đang làm việc khác — repo này hay có nhiều
  phiên chạy song song.
- **Phiên chính là người ghi duy nhất.** `opus-dev` / `nghiem-thu` / `phan-bien` nêu ở mục
  `## NGOÀI PHẠM VI` cuối báo cáo; phiên chính chép vào đây ở chặng 5.
- Mục `MỞ` chỉ được lôi ra làm khi **user duyệt** ở chặng 1 của một việc mới. **Không tự nhặt.**
- Trạng thái: `MỞ` · `ĐANG SỬA` · `ĐÓNG (<commit>)` · `KHÔNG SỬA (<lý do>)`. Hạng như trên.

Khuôn một mục — chép nguyên rồi điền:

```markdown
### P-20260827-1 · [MỞ] · VỪA — <một câu: vấn đề là gì>
- **Thấy lúc**: đang làm `plans/2026-08-27-<việc>.md` (hoặc: trả lời câu hỏi X của user)
- **Ở đâu**: `đường/dẫn/file.ts:123`
- **Bằng chứng**: <ca cụ thể vào-gì-ra-gì, hoặc output lệnh — không phải cảm nhận>
- **Vì sao không sửa ngay**: ngoài phạm vi việc đang làm
```

Không dựng nổi bằng chứng cụ thể ⇒ ghi rõ là **nghi ngờ**. Sổ đầy phỏng đoán thì mục thật bị
loãng, và loãng đủ lâu thì cả sổ bị bỏ.

*(chưa có mục nào)*

### P-20260827-1 · [MỞ] · VỪA — `test_me_subs_moi_theo_dung_truoc` FLAKY: `-created_at` hoà nhau nên thứ tự tuỳ ý

- **Thấy lúc**: chạy bộ kiểm trước lượt deploy 2026-08-27 (`plans/2026-08-25-deploy-vps-docker.md`)
- **Ở đâu**: `api/tests/test_api_theo_sub.py:177` · nguồn thật ở `api/api/theo_sub.py:155`
  (`TheoSub.objects...order_by("-created_at")`) và `api/core/models/tuong_tac.py:312`
  (`created_at = DateTimeField(default=timezone.now)`)
- **Bằng chứng**:
  1. Chạy RIÊNG bài đo đó 5 lần trên test DB sạch: **2 xanh / 3 đỏ**, cùng một cây mã, không đổi gì.
     `AssertionError: assert ['chung-khoan', 'crypto'] == ['crypto', 'chung-khoan']`
  2. Nguyên nhân đo được — đồng hồ máy này KHÔNG phân giải nổi hai lời gọi liên tiếp:
     ```
     6 lần timezone.now() liên tiếp → cách nhau 0.0 us, trùng nhau: True
     số giá trị PHÂN BIỆT được trong 6 lần gọi: 1
     ```
     ⇒ hai hàng `TheoSub` do bài đo tạo mang **cùng một `created_at`**; `ORDER BY -created_at`
     gặp hoà thì Postgres trả thứ tự tuỳ ý. Không phải hồi quy: `api/api/theo_sub.py` không
     nằm trong 94 file lệch của lượt deploy này.
- **Vì sao không sửa ngay**: ngoài phạm vi việc đang làm (deploy). Cách chữa nhiều khả năng chỉ
  là thêm khoá phá hoà — `order_by("-created_at", "-id")` — nhưng nó **đổi hợp đồng thứ tự của
  một endpoint**, nên phải là một quyết định có chủ đích chứ không phải một dòng tiện tay giữa
  lượt deploy. Ảnh hưởng thật với người dùng gần như bằng 0 (không ai theo hai chuyên mục trong
  cùng một tick đồng hồ); ảnh hưởng thật là **bộ kiểm đỏ ngẫu nhiên**, tức lần sau có người sẽ
  cho rằng đỏ là chuyện bình thường.

### P-20260827-2 · [ĐÓNG (dd1dac5, deploy + đối soát prod 2026-08-30)] · NẶNG — index Meilisearch trên PROD lệch DB, và lệch IM LẶNG

> **ĐÓNG 2026-08-30 (lượt "search v2", commit dd1dac5):** hai hướng đề nghị cũ ĐÃ LÀM: (a)
> `reindex_tim_kiem` nay tự **gỡ tài liệu ma** mặc định (không cần `--sach`) + **cron đối soát
> đêm** (03:40 VN) đã cài trên VPS; (b) `/chan-doan` khối "Tìm kiếm" so số tài liệu từng index
> với hàng công khai Postgres — lệch thành thứ NHÌN THẤY ĐƯỢC. ⚠ Lượt phản biện bắt được bản
> đầu của bước gỡ-ma tự đẻ một biến thể của chính lỗi này (chụp Postgres TRƯỚC khi đọc index ⇒
> gỡ nhầm bài mới đăng như "ma"); đã sửa bằng `_xac_nhan_thua`. **Xác minh prod sau deploy:**
> `reindex --sach` chạy sạch (13 mạch + 0 bình luận, gỡ 0 ma, không CommandError), và đối soát
> trực tiếp: index `mach` 13=13, `binh_luan` 0=0 — **KHỚP cả hai**.



- **Thấy lúc**: nghiệm thu sau lượt deploy 2026-08-27 (`plans/2026-08-25-deploy-vps-docker.md`)
- **Ở đâu**: `api/core/tim_kiem.py::dong_bo_mach` · đường ghi `api/core/ghi.py:1553`
  (`dat_an_mach`) · lệnh đối soát `reindex_tim_kiem`
- **Bằng chứng** (đo trên prod, TRƯỚC khi sửa):
  ```
  Meili  /indexes/mach  numberOfDocuments: 8
  id trong index : 1000 1001 1002 1003 1004 1005 1006 1007
  id trong DB    : 1000      1002 1003 1004 1005 1006 1007      (1001 KHÔNG còn)
  Mach 1005      : hidden_at = 2026-08-26 15:02:58+00  (mod đã ẩn)
  search filter "hien = true" vẫn trả về CẢ 1001 lẫn 1005
  ```
  ⇒ hai lỗi khác nhau cùng lúc: một tài liệu **trỏ tới mạch đã xoá** (người tìm được sẽ
  bấm vào 404), và một **mạch bị mod ẩn vẫn tìm ra được** — tức lớp che nội dung của sản
  phẩm bị đi vòng qua đường tìm kiếm.
- **Đã xử ngay phần hậu quả**: chạy `reindex_tim_kiem --sach` trên prod ⇒ 8 → **6 tài liệu**,
  đúng 6 mạch công khai; 1001 và 1005 biến mất. Đây là lệnh đối soát chính chủ của repo,
  idempotent.
- **Nguyên nhân thì CHƯA BIẾT, và đây là chỗ ghi rõ là NGHI NGỜ:**
  - Đường ghi **đúng**: `dat_an_mach` có gọi `dong_bo_mach(hang)`; `dong_bo_mach` tự đọc lại
    trạng thái nên nó gỡ được cả ca ẩn lẫn ca xoá.
  - 1005 được tạo lúc 15:02:25 và ẩn lúc 15:02:58 — **cách nhau 33 giây**. Trông như một
    lượt thử tay chứ không phải thao tác của người dùng thật.
  - **Giả thuyết 1 (không dựng được bằng chứng):** hai hàng ấy bị đụng bằng `manage.py shell`
    / ORM trực tiếp, tức đi vòng qua `dat_an_mach` nên không có ai gọi `dong_bo_mach`.
  - **Giả thuyết 2 (cũng không dựng được bằng chứng):** `dong_bo_mach` **nuốt lỗi có chủ đích**
    ("mất index còn hơn mất bài" — docstring `core/tim_kiem.py`), nên một lần Meili hỏng
    thoáng qua để lại đúng vết này kèm **một dòng log duy nhất**. Log ấy nay **không còn**:
    container `api` đã bị recreate ở lượt deploy, log của cửa sổ thời gian đó mất theo.
- **Vì sao không sửa tiếp ngay**: ngoài phạm vi việc đang làm, và chưa biết sửa cái gì.
- **Đề nghị cho lượt sau (cần user quyết):** dù nguyên nhân là gì thì cơ chế hiện tại
  **không có ai phát hiện lệch** — nó chỉ lộ ra vì lượt này tình cờ đếm tay. Hai hướng:
  (a) chạy `reindex_tim_kiem` định kỳ (cron) như một lượt đối soát;
  (b) thêm một phép đếm "số tài liệu index vs số mạch công khai" vào `/chan-doan`, để lệch
  thành thứ NHÌN THẤY ĐƯỢC thay vì thứ phải đi tìm.

### P-20260827-3 · [MỞ] · NẶNG — `api/.env.example` dạy một `EMAIL_URL` TẮT TLS mà không báo gì

- **Thấy lúc**: trả lời câu hỏi của user "có thể tạo email trên Cloudflare không"
- **Ở đâu**: `api/.env.example` (khối `# Email.`) — dòng mẫu
  `EMAIL_URL=smtp://user:mat-khau@smtp.example.com:587/?tls=True`
- **Bằng chứng** (chạy thật với `django-environ` đang cài trong `api/.venv`):
  ```
  smtp://u:p@h:587/?tls=True                 -> TLS=None  SSL=None   ← ?tls=True BỊ BỎ QUA
  smtps://u:p@h:587                          -> TLS=True  SSL=None
  smtp+ssl://api_token:TOKEN@host:465        -> TLS=None  SSL=True
  ```
  Nguyên nhân ở `environ/environ.py:879-892`: TLS/SSL được quyết **THEO SCHEME**, không theo
  query param. Vòng lặp query chỉ nhận khoá viết hoa lên đúng `EMAIL_USE_TLS` / `EMAIL_USE_SSL`
  (tức phải viết `?email_use_tls=1`); mọi khoá khác — gồm `tls` — rơi vào `config["OPTIONS"]`,
  mà backend SMTP của Django **không đọc** `OPTIONS`.
- **Hậu quả**: ai chép nguyên dòng mẫu lên prod thì Django nối SMTP **không TLS**, gửi
  user/mật khẩu SMTP dạng thô. Không có warning, không có lỗi — hoặc chạy được (server cho
  phép plaintext), hoặc chết bằng một thông báo không nhắc gì tới TLS.
- **Vì sao không sửa ngay**: đang trả lời một câu hỏi, không phải làm một việc có phạm vi.
  Sửa là đổi đúng một dòng mẫu, nhưng nên sửa kèm ghi chú vì sao (`smtps` = STARTTLS,
  `smtp+ssl` = TLS ngầm 465) chứ không chỉ thay chuỗi.
- **Đề nghị**: nên sửa sớm — dòng này là thứ người deploy sẽ chép nguyên văn.

> **Cập nhật `P-20260827-3` (2026-08-27, cùng ngày):** đã SỬA trong cây làm việc — `api/.env.example`
> và `deploy/prod/env.example` nay dạy `smtp+ssl://` (465) / `smtps://` (587) kèm bảng đo ba dạng
> URL. Sửa ngay thay vì để đó vì rơi đúng ca "CHẶN việc đang làm": user đang cấu hình SMTP Brevo và
> sẽ đọc chính hai file ấy trong vài phút tới. Chưa commit ⇒ chưa ghi `ĐÓNG (<commit>)`.

### P-20260827-4 · [MỞ] · VỪA — trang xác thực email phun thông báo lỗi TIẾNG ANH của allauth ra UI tiếng Việt

- **Thấy lúc**: gỡ lỗi "click link xác nhận báo Invalid or expired key" cho user, 2026-08-27
- **Ở đâu**: `apps/web/components/tai-khoan-forms.tsx:364` (`XacThucEmail`) —
  `datLoi(e instanceof LoiTaiKhoan ? e.message : "Không gọi được máy chủ…")`
- **Bằng chứng**: user bấm một link xác nhận có khoá trỏ tới `EmailAddress` đã bị xoá, và
  màn hình hiện nguyên văn **`Invalid or expired key`** — chuỗi tiếng Anh của allauth, trên
  một sản phẩm mà mọi chữ khác đều tiếng Việt. Nhánh `else` ngay cạnh nó thì lại có câu
  tiếng Việt tử tế, nên đây không phải quyết định thiết kế mà là chỗ bị bỏ sót.
- **Vì sao đáng sửa, không chỉ là chuyện chữ nghĩa**: câu ấy vừa lạc ngôn ngữ vừa **không
  nói được người dùng phải làm gì**. Ba nguyên nhân rất khác nhau cùng ra đúng một câu:
  (a) khoá đã dùng rồi, (b) khoá quá 3 ngày, (c) tài khoản/địa chỉ đã bị xoá. Cách xử của
  người dùng ở ba ca là khác nhau (đăng nhập luôn / xin gửi lại / đăng ký lại), mà thông
  báo hiện tại không phân biệt được ca nào.
- **Vì sao không sửa ngay**: ngoài phạm vi việc đang làm (dựng SMTP). Sửa tử tế là **map
  mã lỗi của allauth sang câu tiếng Việt + một hành động cụ thể** (nút "Gửi lại thư xác
  nhận"), tức đụng cả `lib/tai-khoan.ts` lẫn component — một việc có plan riêng, không phải
  một dòng tiện tay.
- **Đề nghị**: nên sửa sớm. Đây là màn hình mà **mọi người dùng mới đều đi qua**, và khi nó
  hỏng thì nó hỏng đúng lúc người ta chưa có tài khoản để hỏi ai.

### P-20260827-5 · [MỞ] · NẶNG — hết quota mail ⇒ tài khoản kẹt VĨNH VIỄN, không lối ra

- **Thấy lúc**: tính sức chứa của gói Brevo free khi user hỏi "300 user/ngày thì sao", 2026-08-27
- **Ở đâu**: đường đăng ký của allauth headless · `api/config/settings.py` (không có
  `ATOMIC_REQUESTS`) · `api/core/allauth_adapter.py` (không có `try/except` quanh gửi mail)
- **ĐO ĐƯỢC** (chắc chắn):
  - `grep ATOMIC_REQUESTS api/config/settings.py` → **không có dòng nào** ⇒ request đăng ký
    KHÔNG được bọc trong một transaction;
  - `allauth_adapter.py` không có `try`/`except` nào quanh đường gửi mail;
  - `ACCOUNT_EMAIL_VERIFICATION = "mandatory"` ⇒ chưa xác thực thì mọi cửa GHI đóng;
  - `ACCOUNT_PREVENT_ENUMERATION = True` ⇒ đăng ký lại bằng email đã có **không** báo lỗi,
    nó gửi một thư khác — mà thư ấy cũng không gửi được vì cùng lý do.
- **SUY RA, CHƯA TÁI HIỆN** (ghi rõ là suy luận): khi SMTP ném (hết quota 300/ngày, Brevo
  sự cố, key bị xoay nhầm), hàng `User` **đã được ghi** rồi mới tới bước gửi thư ⇒ người
  dùng nhận **500**, tài khoản **tồn tại nhưng chưa xác thực**, và **không có thư nào**.
  Từ đó họ: không đăng ký lại được (email đã bị dùng) · không đăng nhập được (chưa xác
  thực) · không tự xin gửi lại được. **Ngõ cụt, và im lặng.**
- **Vì sao NẶNG chứ không VỪA**: nó hỏng đúng lúc tệ nhất — quota cạn vì lưu lượng CAO, tức
  ngày đông người đăng ký nhất là ngày nhiều người bị kẹt nhất. Và người bị kẹt là người
  **chưa có tài khoản**, nên họ không có kênh nào để báo cho ai.
- **Cách xác nhận** (chưa làm, vì phải chọc hỏng SMTP trên site đang sống): trỏ `EMAIL_URL`
  vào một host SMTP chết **trên máy dev**, gọi `POST /api/_allauth/browser/v1/auth/signup`,
  rồi đếm hàng `User`. Có hàng + 500 ⇒ khẳng định.
- **Hai hướng chữa** (cần user quyết): (a) bọc đường đăng ký trong `transaction.atomic()` để
  gửi mail hỏng thì **cuốn luôn** hàng `User` — người dùng thử lại được; (b) bắt lỗi gửi mail,
  giữ tài khoản, và cho một nút **"gửi lại thư xác nhận"** ở màn hình chờ. (b) tử tế hơn
  nhưng đụng cả frontend; (a) là một dòng và chặn được ngõ cụt ngay.
- **Vì sao không sửa ngay**: đang trả lời một câu hỏi, không phải làm một việc có phạm vi.

### P-20260827-6 · [MỞ] · NẶNG — trang HTML của Yahoo Finance trả số CŨ, bot tin tức sẽ đăng số sai kèm link "nguồn"

- **Thấy lúc**: chạy nhiệm vụ hẹn giờ đăng bản tin slot `truoc-phien-my`, 2026-08-27
- **Ở đâu**: quy trình thu số của `scripts/tin-tuc/lich/*.md` — mục *Nguồn gợi ý* không nói
  lấy số qua đường nào, nên phản xạ tự nhiên là fetch trang quote HTML.
- **ĐO ĐƯỢC** (cùng một lượt, cách nhau vài giây):
  - `finance.yahoo.com/quote/%5EKS11/` → "6.742,74 · +0,68% · At close 6:05:40 PM GMT+9";
  - `query1.finance.yahoo.com/v8/finance/chart/%5EKS11?range=5d&interval=1d` →
    `regularMarketPrice = 6912.37`, `regularMarketTime = 1787821540` (= 27/8 16:05 giờ VN),
    mảng close 5 phiên `[6912.95, 6696.96, 6742.74, 6808.21, 6912.37]`;
  - tức **6.742,74 là giá đóng cửa của phiên cách đó HAI ngày** (25/8), trùng khớp với con
    số CNBC đưa cho phiên 25/8. Sai lệch **+2,5%** so với số thật của ngày.
  - Cùng lượt đó `^N225`, `^HSI`, `000001.SS` thì HTML **đúng** — nên lỗi này **không đều**,
    không thể phát hiện bằng cách "kiểm một mã rồi tin cả bảng".
- **Vì sao NẶNG**: bản tin có link nguồn đầy đủ, giọng văn đúng luật, script validate xanh,
  mã thoát `0` — **không có hàng rào nào đỏ**. Bài vẫn lên gikky.net với một con số sai 2,5%
  và một cái link trông rất chính danh. Đúng loài *proof đo RỖNG*: mọi thứ báo đạt trừ cái
  duy nhất quan trọng.
- **Hướng chữa** (cần user quyết): ghi thẳng vào cả 3 file `scripts/tin-tuc/lich/*.md` rằng
  số chỉ được lấy qua endpoint `chart` (có `regularMarketTime` để tự kiểm mốc giờ), và
  **bắt buộc đối chiếu `regularMarketTime` với ngày VN đang chạy** trước khi dùng. Trang
  quote HTML chỉ dùng làm URL để dẫn link, không dùng để đọc số.
- **Vì sao không sửa ngay**: nhiệm vụ hẹn giờ chỉ có phạm vi "đăng bản tin hôm nay"; sửa
  hướng dẫn của cả ba slot là việc khác, và ba file đó là nguồn chân lý của các nhiệm vụ
  đang chạy tự động.

### P-20260828-1 · [MỞ] · VỪA — lần đọc giờ ĐẦU TIÊN của phiên trả sai 6 giờ 26 phút, agent tin theo và làm việc thừa

- **Thấy lúc**: chạy nhiệm vụ hẹn giờ đăng bản tin slot `dem-qua`, 2026-08-28
- **Ở đâu**: không phải code repo — là bước "kiểm giờ VN trước khi làm" mà cả ba
  `scripts/tin-tuc/lich/*.md` đều ngầm yêu cầu (khung giờ là điều kiện đầu tiên của việc).
- **ĐO ĐƯỢC**, trong cùng một phiên:
  - Lệnh đầu phiên `Get-Date -Format "yyyy-MM-dd HH:mm:ss zzz"` → `2026-08-28 06:16:09 +07:00`.
  - **26 phút thực** sau đó, ba nguồn độc lập cùng khớp nhau: `date -u` → `05:42:00`,
    `node new Date().toISOString()` → `2026-08-28T05:42:00.502Z`, `Get-Date` → local
    `12:42:02` / utc `05:42:02`.
  - Đối chiếu ngoài: `time.is/Ho_Chi_Minh` → `12:44:00 Friday, August 28, 2026`
    (New York `01:44`). Tức giờ thật lúc đầu phiên là **12:16**, lệch **+6h26m**.
  - `scripts/dang-tin.mjs --thu` in `(Bây giờ là 2026-08-28 lúc 12:41 giờ VN.)` và thoát `4`.
- **Hậu quả thật của lượt này**: tin vào `06:16` nên đã đi gom số ~25 phút cho một bản tin
  không bao giờ đăng được. Không có bài sai nào lên site — **hàng rào `som_nhat`/`han_chot`
  trong `lib.mjs` đã chặn đúng**, đó là chỗ duy nhất tính giờ đáng tin.
- **Nguyên nhân: CHƯA BIẾT** — ghi rõ đây là **nghi ngờ**, không phải kết luận. Chưa tái
  hiện được; mới thấy đúng một lần, ở đúng lệnh đầu tiên của phiên.
- **Hướng chữa** (cần user quyết): thêm vào cả ba `lich/*.md` một câu — muốn biết giờ thì
  chạy `node scripts/dang-tin.mjs … --thu` và đọc dòng giờ **của chính script**, đừng hỏi
  `Get-Date` rồi tự suy luận có nằm trong khung hay không.
- **Vì sao không sửa ngay**: phạm vi lượt này là "đăng bản tin `dem-qua` hôm nay"; sửa hướng
  dẫn của cả ba slot là việc khác, và ba file đó là nguồn chân lý của các nhiệm vụ tự động.

### P-20260828-1 · [MỞ] · NẶNG — đếm lượt xem KHÔNG chạy trên prod: middleware gửi thân request RỖNG

- **Thấy lúc**: nghiệm thu sau lượt deploy 2026-08-28 (migration `0022`+`0023`, tính năng đếm lượt xem)
- **Ở đâu**: `apps/web/middleware.ts:104` (lời gọi `demLuotXem`) ·
  `packages/api-client/src/client/client.gen.ts:60` (chỗ serialize body)
- **Bằng chứng** (đo trên prod, có đối chứng hai chiều):
  1. Vào một trang mạch thật ⇒ gunicorn log:
     `POST /api/v1/dem-luot-xem HTTP/1.1" 400 118` — middleware **CÓ** gọi, Django từ chối.
  2. Bảng `LuotXem` sau nhiều lượt vào trang: **0 hàng**.
  3. Dò 118 byte ấy là lỗi gì — khớp **chính xác** ca "thân rỗng":
     ```
     thân JSON đúng            -> 200  16 byte   {"da_dem": true}
     thân = [object Object]    -> 400  71 byte   "Cannot parse request body"
     thân RỖNG                 -> 400  118 byte  "body.du_lieu: Field required"   ← KHỚP
     thiếu trường duong_dan    -> 400  128 byte
     duong_dan = null          -> 400  144 byte
     ```
  4. **Không phải lỗi secret**: secret sai ra **401** `{"detail":"sai secret"}`, không phải 400.
     Middleware ra 400 ⇒ header secret ĐÃ tới nơi và ĐÃ qua lớp auth.
  5. Endpoint tự nó đúng: `curl` với secret đúng ⇒ **200 `{"da_dem": true}`**, có hay không
     có `Content-Type` đều được.
- **Kết luận đo được**: header đi đúng, **thân không đi**. Đây là lỗi *serialize body*, không
  phải lỗi xác thực, không phải lỗi cấu hình, không phải lỗi endpoint.
- **Đầu mối (chưa xác nhận)**: `client.gen.ts:60` chỉ serialize khi `opts.bodySerializer` có
  mặt — nó đến từ `createConfig()` (`...jsonBodySerializer`, `utils.gen.ts:313`). Ở
  runtime thường thì có. `middleware.ts` chạy **edge runtime**, nên nghi cái singleton
  `client` khởi tạo khác đi ở đó. **Chưa dựng được bằng chứng** cho bước này.
- **Vì sao KHÔNG sửa trong lượt này**: user giao "sync + migrate", đây là mã sản phẩm
  (`middleware.ts` / client sinh ra), không phải cấu hình triển khai.
- **⚠ Hàng rào hiện có KHÔNG bắt được lỗi này**: `apps/web/e2e/don-vi/dem-luot-xem.spec.ts`
  là bài đo **đọc mã nguồn** (nhóm `don-vi`), nên nó ghim được "hai file dùng chung tên
  header" nhưng **mù** với chuyện thân request có đi hay không lúc chạy. Phép đo duy nhất
  bắt được là *"vào trang thật rồi đếm hàng `LuotXem`"*.

> **`P-20260828-1` — ĐÃ SỬA (2026-08-28, chưa commit).** Nguyên nhân KHÔNG phải client: Next
> edge runtime gửi thân **chunked**, còn `WSGIRequest` dựng `LimitedStream` theo
> `CONTENT_LENGTH` nên đọc **0 byte**. Đo dứt điểm: cùng thân + cùng secret, có `Content-Length`
> ⇒ **200**, chunked ⇒ **400 (118 byte)** — khớp từng byte lỗi của prod. Chữa ở tầng WSGI
> (`config/wsgi.py::DocThanChunked`, có trần 1 MiB ⇒ 413), phủ luôn mọi cửa edge-runtime về
> sau. 8 bài đo mới + 3 phép thử phá. Prod: `LuotXem` đã tăng theo lượt xem thật, và lượt của
> người dùng thật ghi đúng `la_bot=False`. Chi tiết: `plans/2026-08-28-than-chunked-wsgi.md`.

### P-20260830-1 · [ĐÓNG (5d9a8be) — chọn lối (a): `/luat` dùng `KhungHaiCotTinh` không gọi API, bỏ khai dynamic; hàng rào #14 mở rộng 3 phép; bộ đo xanh toàn phần] · NẶNG — hàng rào e2e #14 và trang `/luat` mâu thuẫn NGAY TẠI HEAD ⇒ `pnpm e2e:don-vi` đỏ 1 bài trên `main`, độc lập mọi bản vá
- **Thấy lúc**: chạy nghiệm thu lượt "viết lại thống kê lượt xem" (`plans/2026-08-30-viet-lai-luot-xem.md`)
- **Ở đâu**: `apps/web/app/luat/page.tsx:14` (`export const dynamic = "force-dynamic"`, thêm 2026-08-25 khi dựng Docker) vs `apps/web/e2e/don-vi/trang-loi.spec.ts:268` (cấm đúng chuỗi ấy)
- **Bằng chứng**: `git show HEAD:` cả hai file đều đã mang hai vế mâu thuẫn; `git diff HEAD` trên cả hai = 0 dòng. `pnpm e2e:don-vi` = 380/381, bài đỏ duy nhất là nó.
- **Vì sao không sửa ngay**: cần user quyết bên nào đúng — trang cần `force-dynamic` (lý do Docker có comment tại chỗ) hay hàng rào phải cập nhật. Sửa bên nào cũng là đổi một chốt đã ghi.

### P-20260830-2 · [MỞ] · VỪA — `POST /dem-luot-xem` không có hạn mức nào: đường Next→Django đi trong mạng container, VƯỢT rate_limit của Caddy
- **Thấy lúc**: lượt phản biện "viết lại thống kê lượt xem"
- **Ở đâu**: `deploy/prod/Caddyfile:94` (`@ghi` chỉ khớp request đi QUA Caddy) · `apps/web/middleware.ts:104` (gọi thẳng `api:8000`)
- **Bằng chứng**: bất kỳ ai `GET /` (không cần secret — chính site tự chuyển tiếp) ép được một lượt ghi `LuotXem`; không tầng nào đếm nhịp. `NGUONG_GIU_RIENG` chỉ chặn đường phình của `TongNgay`, còn bảng thô phình tự do trong 90 ngày.
- **Vì sao không sửa ngay**: ngoài phạm vi lượt (cần quyết cơ chế: đếm nhịp ở middleware, ở Django, hay chấp nhận vì thô tự dọn sau 90 ngày).

### P-20260830-3 · [MỞ] · VỪA (nghi ngờ, chưa đo) — trang `/luot-xem` nay chạy ~9 câu aggregate quét bảng `core_luotxem` mỗi lượt bấm, 4 cột mới đều không index
- **Thấy lúc**: lượt phản biện "viết lại thống kê lượt xem"
- **Ở đâu**: `api/api/quan_tri_luot_xem.py` (các hàm `_tho_theo_ngay` · `_khach_tho` · `_top_nguon` · `_theo_cot`…)
- **Bằng chứng**: chưa dựng được số — phản biện bị cấm chạm DB. Index duy nhất là `(luc, duong_dan)`; các câu `GROUP BY nguon/trinh_duyet/thiet_bi` + `COUNT(DISTINCT khach)` là seq-scan trên bảng ghi nóng nhất site, endpoint `no-store` có nút "Làm mới".
- **Vì sao không sửa ngay**: là NGHI NGỜ hiệu năng, chưa có phép đo; cần `EXPLAIN ANALYZE` trên dữ liệu thật trước khi quyết thêm index (index thêm là chi phí trên chính đường ghi nóng).

### P-20260830-4 · [MỞ] · NHỎ — `KhungBang` tự render `<table>` nhưng không hàng rào nào chặn trang đặt thêm `<table>` bên trong
- **Thấy lúc**: lượt thực thi "viết lại thống kê lượt xem" (trang `/luot-xem` cũ mắc đúng lỗi này, đã sửa trong lượt)
- **Ở đâu**: `apps/admin/components/ui.tsx:176`
- **Bằng chứng**: bản cũ `apps/admin/app/luot-xem/page.tsx` lồng `<table class="bang">` trong `<table>` của `KhungBang` — HTML không hợp lệ, build vẫn xanh, không gì đỏ.
- **Vì sao không sửa ngay**: hàng rào quét JSX là việc riêng, ngoài phạm vi.

### P-20260830-5 · [MỞ] · VỪA — git index của repo đang giữ một snapshot CŨ lệch xa worktree (108 file staged, −5118 dòng so với HEAD)
- **Thấy lúc**: khảo sát đầu lượt "viết lại thống kê lượt xem"
- **Ở đâu**: gốc repo (`git diff --cached --stat`)
- **Bằng chứng**: `git diff --cached --stat` = 108 file / +931 / −5118 trong khi worktree ≈ HEAD; hai bên gần như gương nhau — index bị đặt về một trạng thái cũ từ trước lượt này.
- **Vì sao không sửa ngay**: reset index là thao tác phá — cần user xác nhận không phiên nào khác đang cần nó. ⚠ Commit tới PHẢI `git add` chọn lọc từng file; `git commit` thẳng index hiện tại hay `git commit -a` đều chôn rác.
- **Cập nhật 2026-08-30 (phản biện lượt A10)**: bản staged của `apps/web/e2e/vo-reddit.spec.ts` là bản CŨ đã xoá cả helper `nganKeoDongNhat` lẫn 3 bài A10; `git diff --cached --stat` = 87 file / +887 / −3937. Một `git commit` không `add` chọn lọc sẽ commit bản revert này thay vì bản vá.
- **Cập nhật 2026-08-31 (lượt /luat, tai nạn thật)**: `git checkout -- <file>` lấy bản từ **INDEX** — với index cũ này nó đè mất bản vá chưa commit của `app/luat/page.tsx` ngay giữa lượt (phải dựng lại tay). Khôi phục thử-phá trên file CHƯA commit phải bằng cách đảo lại đúng phép sửa (Edit ngược), tuyệt đối không `git checkout --`/`git restore` chừng nào index chưa được dọn.

### P-20260830-6 · [MỞ] · NHỎ — ở ~861–950px, ô tìm header KHÔNG còn đứng giữa khung nhìn như lời hứa của lưới
- **Thấy lúc**: lượt phản biện "lối vào tìm kiếm mobile" (`plans/2026-08-30-loi-vao-tim-kiem-mobile.md`)
- **Ở đâu**: `apps/web/components/chrome.module.css` (khối `.trong`, lưới `1fr clamp(220px,34vw,560px) 1fr`)
- **Bằng chứng**: tính từ chính các con số trong file — ở 861px: 861 − 44 padding − 28 gap = 789 khả dụng; cột giữa 292.7; rãnh `1fr` = `minmax(auto,1fr)` nên rãnh phải bị min-content của `.phai` (~340px) chống sàn, rãnh trái teo còn ~156px ⇒ ô tìm lệch trái ~92px — trái đúng câu "hai rãnh biên bằng nhau theo định nghĩa" trong docstring. KHÔNG do bản vá icon (icon `display:none` ở dải đó).
- **Vì sao không sửa ngay**: lỗi thẩm mỹ dải hẹp, ngoài phạm vi lượt; sửa đàng hoàng phải đụng chiến lược lưới và đo lại nhiều mốc.

### P-20260830-7 · [ĐÓNG (5d9a8be) — theo P-20260830-1: `/luat` lại là `○`, câu docstring ĐÚNG trở lại, không phải sửa chữ] · NHỎ — docstring `chrome.tsx` khẳng định "`pnpm build` xác nhận `/luat` đang là `○`" nhưng build hiện tại ra `ƒ`
- **Thấy lúc**: lượt "lối vào tìm kiếm mobile" — cả opus-dev (đo A/B hai cây) lẫn nghiệm thu và phản biện cùng chỉ ra
- **Ở đâu**: `apps/web/components/chrome.tsx:19` (khối docstring đầu file)
- **Bằng chứng**: `pnpm build` ở cả HEAD lẫn cây có bản vá đều in `├ ƒ /luat  566 B  106 kB` — hệ quả của `P-20260830-1` (`force-dynamic` khai ở `app/luat/page.tsx:14` từ 2026-08-25). Câu tài liệu đứng ngay chỗ giải thích ràng buộc kiến trúc nên dễ làm người sau tin ràng buộc vẫn đang được giữ.
- **Vì sao không sửa ngay**: nó là một mảnh của `P-20260830-1` — đóng nợ ấy (chọn bên nào đúng) thì sửa câu này cùng lượt, sửa lẻ bây giờ là vá chữ trước khi user quyết bản chất.

### P-20260830-8 · [ĐÓNG (c06e8bb)] · NẶNG (hạ: bài đo hỏng, sản phẩm KHÔNG hỏng) — gập bình luận GỠ nội dung khỏi HTML: hợp đồng "bot vẫn đọc được" (PLAN mục 1) đang vỡ ngay tại HEAD

> **CHẨN ĐOÁN LẬT 2026-08-30 (lượt "sửa bài đo A10", plan `plans/2026-08-30-sua-bai-do-a10-gap-binh-luan.md`):**
> sản phẩm KHÔNG hỏng — `gap-nhanh.tsx:77` giữ nguyên nội dung trong DOM (`hidden={gap}`), và
> phản biện soi hết các đường render (khan-dai/binh-luan/KhungNganKeo, không virtualize/remount)
> không thấy đường nào gỡ nội dung; `8e8a953` vô can. Cú đỏ do HAI thứ cộng lại: (1) bài đo chụp
> dòng đầu `innerText` của thread làm chữ mồi — dòng đó là ký tự `[−]` trên nút gập, đổi thành
> `[+]` sau cú bấm; (2) nó chỉ đỏ khi thread mục tiêu KHÔNG có reply — mà `.first()` trúng đúng
> một thread rác 0-reply do các lượt e2e trước bỏ lại trong `gikky_e2e` (P-20260830-13). Trên DB
> sạch, bài đo CŨ sẽ XANH. Đã viết lại A10: chọn thread có reply đọc được (đo cả vế "mọi nhánh
> con"), chữ mồi lấy trong `> [data-chu-nguoi-dung]` của đúng gốc/reply, dòng DÀI NHẤT, 5 rào
> chống pass rỗng; thử phá (gỡ children thật) ĐỎ đúng phép `textContent`. Bộ đầy đủ sau vá:
> 565 passed · 2 failed, cả hai NGOÀI phạm vi (P-20260830-1 · P-20260830-12).
- **Thấy lúc**: chạy full `pnpm e2e` (trỏ `gikky_e2e`) trong lượt "lối vào tìm kiếm mobile" — lần đầu bộ đầy đủ được chạy sau nhiều commit
- **Ở đâu**: bài `apps/web/e2e/vo-reddit.spec.ts:522` (`A10 › nội dung vẫn nằm trong HTML khi gập`); thủ phạm nằm trong đường gập của khán đài/ngăn kéo (`binh-luan.tsx`/`khan-dai.tsx`/`ngan-keo.tsx` — nghi commit `8e8a953` "Bình luận chung tách khỏi mốc…")
- **Bằng chứng**: chạy riêng bài này 2 lần đều ĐỎ tại `vo-reddit.spec.ts:535` — sau click `nut-gap-nhanh`, `thread.textContent()` không còn chứa chữ của bình luận, tức node bị GỠ khỏi DOM chứ không phải ẩn bằng CSS. Ba file component trên trùng HEAD từng byte (`git diff HEAD` rỗng) và phép đo là `textContent` nên 4 file CSS bẩn của phiên khác không can thiệp được ⇒ lỗi thuộc HEAD, không thuộc cây làm việc.
- **Vì sao không sửa ngay**: ngoài phạm vi lượt (lượt này chỉ đụng header); đường gập là việc của lượt bình luận, cần lượt riêng — và cần quyết: sửa code cho giữ nội dung trong DOM, hay PLAN mục 1 đã đổi ý thì sửa bài đo. ⚠ Hàng rào này chỉ sống trong `pnpm e2e` đầy đủ nên nó sẽ tiếp tục đỏ im lặng tới khi có người chạy lại.
### P-20260830-9 · [MỞ] · NHỎ — `[[…]]` người dùng gõ trong bình luận bị tô đậm nhầm ở trang kết quả tìm kiếm
- **Thấy lúc**: lượt phản biện "search v2" (mục #10)
- **Ở đâu**: `api/api/tim_kiem.py::_boc` (chèn `[[…]]`) + `apps/web/lib/tim-kiem.ts::tachDam` (tách theo `[[…]]`)
- **Bằng chứng**: bình luận `Xem [[ghi chú]] về HPG`, tìm `HPG` ⇒ API trả `Xem [[ghi chú]] về [[HPG]]` ⇒ frontend tô đậm CẢ "ghi chú". Không phải XSS (không `dangerouslySetInnerHTML`), chỉ sai hiển thị. Gặp thật hơn ở bình luận (văn bản tự do) so với tiêu đề mạch.
- **Vì sao chưa sửa**: cần đồng bộ một marker thoát ở CẢ HAI đầu (Python chèn + TS tách) kèm bài đo — dễ sinh lỗi mới, và chỉ NHỎ. Ghi để làm gọn ở lượt riêng.

### P-20260830-10 · [MỞ] · VỪA — `reindex_tim_kiem --sach` có thể chết vì task async của Meili chưa xong khi `liet_ke_id` đọc
- **Thấy lúc**: lượt phản biện "search v2" (mục #12) — NGHI NGỜ, chưa tái hiện được (dev không có Meili)
- **Ở đâu**: `api/core/management/commands/reindex_tim_kiem.py` (`cau_hinh_index` POST/DELETE index là task bất đồng bộ; `liet_ke_id` là lời gọi đọc)
- **Bằng chứng (giả thuyết)**: `--sach` DELETE index lớn ⇒ task vào hàng đợi; `_go_ma` đọc `GET …/documents` ngay sau có thể trúng 404 ⇒ `CommandError`, lệnh thoát ≠ 0. Đúng lệnh ở bước 4 runbook deploy.
- **Vì sao chưa sửa**: cần Meili thật để tái hiện + sửa đúng (chờ `/tasks/{uid}`). ⚠ Sẽ **LỘ NGAY** khi chạy reindex trên prod (ném lỗi, KHÔNG im lặng) — nên nếu bước reindex lúc deploy chạy trót lọt thì ca này không xảy ra lần đó; vẫn ghi để không quên.

### P-20260830-11 · [ĐÓNG (xác minh truy vấn thật trên prod 2026-08-30)] · VỪA (khoảng trống đo lường) — đường đọc trộn federated của search chưa có phép đo nào trên Meili THẬT

> **ĐÓNG 2026-08-30:** kiểm chứng truy vấn thật trên prod (Meili v1.51) sau deploy — mọi ca dev
> không đo được đều CHẠY ĐÚNG: không dấu `vang mieng` → tô đậm `[[vàng]] [[miếng]]` (4 hit); mã
> ngắn `FPT` khớp chính xác; `sort=moi` trộn 7 hit; `goi-y?q=trading` ra `duong_dan` đúng. Lớp
> "gõ gì ra gì" + federated response thật nay đã có bằng chứng. Vẫn còn: index `binh_luan` prod
> RỖNG (0 bình luận thật) nên nhánh tìm-trong-bình-luận chưa có dữ liệu thật để chấm — sẽ tự
> chấm khi có bình luận đầu tiên; cơ chế index đã xác nhận đúng (đối soát khớp, xem P-20260827-2).
- **Thấy lúc**: nghiệm thu + phản biện "search v2" cùng chỉ ra
- **Ở đâu**: `api/core/tim_kiem.py::tim_tron` (`POST /multi-search`) · `api/tests/_meili_gia.py` (không hiện thực `/multi-search`) · `test_tim_kiem_that.py` (26 skip trên dev)
- **Bằng chứng**: dev không có Meili ⇒ toàn bộ "gõ gì ra gì" (không dấu→có dấu, khoan dung lỗi gõ, mã ngắn khớp chính xác), hình dạng response federated (`_federation.indexUid`, `estimatedTotalHits`, sort per-query), và hiệu lực `maxTotalHits=2000` **chưa chạy xanh lần nào**. Lớp PARSE đã phủ bằng phản hồi dựng tay (`test_tim_kiem_tron.py`); lớp XẾP HẠNG THẬT thì chưa.
- **Cách đóng**: chạy `test_tim_kiem_that.py` trên máy có Meili (skip=0), HOẶC kiểm chứng truy vấn thật trên prod sau deploy (gõ câu không dấu / mã ngắn / câu nằm trong bình luận, xem kết quả). Phiên chính sẽ làm cách sau ngay trong lượt deploy.

### P-20260830-12 · [ĐÓNG (5d9a8be) — tự làm không kiểm độc lập; vế "đỏ khi hỏng" tựa vào hai lần đỏ tại HEAD] · NẶNG — bài đo T8 "ô tìm kiếm là ô SỐNG" đỏ sẵn tại HEAD: locator tìm `searchbox`, Search v2 đã đổi ô thành `combobox`
- **Thấy lúc**: chạy full `pnpm e2e` (gikky_e2e) trong lượt "sửa bài đo A10" — thực thi lẫn nghiệm thu cùng thấy, phản biện xác nhận không do lượt A10
- **Ở đâu**: `apps/web/e2e/giao-dien.spec.ts:318` (`header.getByRole("searchbox")`) ↔ `apps/web/components/o-tim-kiem.tsx:233` (`role="combobox"` tường minh, thêm ở `dd1dac5` cho dropdown gợi ý — role tường minh ĐÈ role ngầm của `<input type="search">`)
- **Bằng chứng**: `pnpm e2e` → `T8 … expect(locator).toHaveCount(expected) failed · Expected: 1 · Received: 0`; `git diff HEAD -- apps/web/e2e/giao-dien.spec.ts apps/web/components/o-tim-kiem.tsx` rỗng ⇒ đỏ thuộc HEAD. Ô tìm kiếm vẫn tồn tại và sống — bài đo hỏng, sản phẩm không hỏng (cùng loài A10/P-20260830-8).
- **Vì sao không sửa ngay**: ngoài phạm vi lượt A10; vá là một dòng locator nhưng phải kèm thử phá riêng theo luật 4.

### P-20260830-13 · [ĐÓNG (d88a011) — đo tay trên gikky_e2e: HPG comment_count 24/24 đúng bất biến seed, mốc 9 về 3 thread; vế VOTE tách sang P-20260901-1] · NẶNG — `gikky_e2e` tích rác qua từng lượt chạy, đổi NGẦM đối tượng đo của mọi bài chọn "mốc đông nhất / thread đầu tiên"
- **Thấy lúc**: phản biện lượt "sửa bài đo A10", truy vấn chỉ đọc vào `gikky_e2e`
- **Ở đâu**: nguồn xả rác: `apps/web/e2e/tai-khoan-va-ghi.spec.ts:150,292` (mỗi lượt chạy để lại bình luận SỐNG trong mạch seed HPG); nạn nhân: mọi bài chọn mục tiêu kiểu "đông nhất / đầu tiên" (`vo-reddit.spec.ts:469` `nganKeoDongNhat`, `binh-luan-chung.spec.ts:41` `mocDongNhat`)
- **Bằng chứng**: mốc 9 HPG: seed đúng 3 thread, DB đang có 8 — 5 hàng rác `md-md_*` neo mốc 9 từ 2026-08-27; chính chúng đẩy A10 cũ sang đo một thread rác 0-reply và sinh cú đỏ bị ghi nhầm thành P-20260830-8. `e2e/dung-seed.ts` chỉ ẨN MẠCH rác (`@gikky.test`), không dọn BÌNH LUẬN rác nằm trong mạch seed.
- **Vì sao không sửa ngay**: cần quyết cơ chế (dọn bình luận `@gikky.test` trong globalSetup · `seed_dev --reset` cho riêng gikky_e2e · hay ép mọi bài chọn mục tiêu theo thuộc tính ghim được) — việc riêng, đụng nhiều spec.

### P-20260830-14 · [ĐÓNG (5d9a8be) — sửa thuần comment, tự làm] · NHỎ — khối comment 5 dòng dán lặp nguyên văn hai lần trong `o-tim-kiem.tsx`
- **Thấy lúc**: thực thi lượt "sửa bài đo A10" đọc quanh vùng T8
- **Ở đâu**: `apps/web/components/o-tim-kiem.tsx:190-199`
- **Bằng chứng**: dòng 190-194 và 195-199 giống nhau từng ký tự ("Đóng khi focus RỜI hẳn vùng bọc … ⇒ đóng")
- **Vì sao không sửa ngay**: ngoài phạm vi; lượt nào đụng file đó thì gỡ tiện thể.

### P-20260831-1 · [ĐÓNG (35cfdfa) — luật 3 vế đặt nhà ở tim-kiem-mobile.module.css, bù CHỈ NGANG -4px cả bốn nút, hàng rào 27 bài] · VỪA — `cong-tac-theme` nở 44×44 ở `(pointer: coarse)` KHÔNG có margin âm bù chỗ, ngược hẳn luật mà `tim-kiem-mobile` ghi là bắt buộc
- **Thấy lúc**: thực thi vòng 2 lượt "header mobile một dòng" (`plans/2026-08-31-header-mobile-mot-dong.md`)
- **Ở đâu**: `apps/web/components/cong-tac-theme.module.css:37-42` vs `apps/web/components/tim-kiem-mobile.module.css:36-47`
- **Bằng chứng**: chú thích ở `tim-kiem-mobile` nêu đích danh rủi ro cụm phải nở thêm 12px ở dải 421–520px và cặp margin âm là cách bù; file theme nở đúng 12px đó mà không bù. Hai file cạnh nhau trong cùng cụm `.phai` nói ngược nhau.
- **Vì sao không sửa ngay**: ngoài phạm vi lượt header; sửa phải đo lại bố cục cụm phải trên màn cảm ứng.

### P-20260831-2 · [ĐÓNG (35cfdfa) — chuông 44px + cả nhánh KHÁCH (Đăng nhập 15px→44, Đăng ký 25.6→44); chạm thật đo elementFromPoint ≥44 không chồng, header 65px ổn định 3 trạng thái phiên] · VỪA — nút chuông KHÔNG có khối `(pointer: coarse)` nào, vùng bấm ~29px — dưới mốc 44px mà chính repo đặt cho ba nút còn lại cùng cụm
- **Thấy lúc**: thực thi vòng 2 lượt "header mobile một dòng"
- **Ở đâu**: `apps/web/components/chuong.module.css:5-18`
- **Bằng chứng**: `grep "pointer: coarse" chuong.module.css` → 0 kết quả; ba hàng xóm (`cong-tac-theme`, `tim-kiem-mobile`, `thanh-tai-khoan` từ lượt này) đều có khối 44px.
- **Vì sao không sửa ngay**: ngoài phạm vi; nên gộp với P-20260831-1 thành một lượt "vùng bấm cụm phải" cho đồng bộ.

### P-20260831-3 · [ĐÓNG (35cfdfa) — cơ chế chốt: hàng rào đọc-nguồn 27 bài (bảng nút ghim từ chrome.tsx, cấm bù dọc, trần tổng-bù-cặp ≤ gap) + đo tay elementFromPoint; project Playwright cảm ứng thật = hướng tương lai ghi trong docstring hàng rào] · VỪA — luật vùng bấm 44px KHÔNG có hàng rào chạy được ở mức trình duyệt: mọi project Playwright chạy `pointer: fine`
- **Thấy lúc**: thực thi vòng 2 lượt "header mobile một dòng" — khối coarse mới thêm cho `.ten` không có bài đo nào chạm tới được
- **Ở đâu**: `apps/web/playwright.config.ts:95` (`devices["Desktop Chrome"]`) · hàng rào coarse duy nhất là phép grep đọc nguồn trong `apps/web/e2e/don-vi/loi-vao-tim-kiem.spec.ts:218-231`, chỉ hỏi đúng `.nut` của `tim-kiem-mobile`
- **Bằng chứng**: các khối coarse ở theme, form-tai-khoan, composer, chep-link, chon-kieu-xem, thanh-tai-khoan không ai kiểm; bản vá 44px của lượt này chỉ chứng minh được bằng grep bundle CSS đã build.
- **Vì sao không sửa ngay**: cần quyết cơ chế (project Playwright mobile thật có touch, hay mở rộng phép grep) — việc riêng.

### P-20260901-1 · [MỞ] · VỪA — nửa còn lại của bài toán rác e2e: VOTE (và report, tài khoản) của `@gikky.test` lên nội dung SEED không bao giờ được dọn — điểm seed trôi vĩnh viễn qua từng lượt chạy
- **Thấy lúc**: phản biện lượt "dọn rác gikky_e2e" (`plans/2026-08-31-don-rac-gikky-e2e.md`)
- **Ở đâu**: `apps/web/e2e/tai-khoan-va-ghi.spec.ts:232-262` (vote xong không rút phiếu) · `:200-230` (mỗi lượt đẻ một `Report` nhắm bình luận seed) · `apps/web/e2e/danh-tinh.ts:21-24` (~10 tài khoản + `EmailAddress` mỗi lượt, không đường dọn)
- **Bằng chứng**: mỗi lượt `pnpm e2e` cộng vĩnh viễn 1 up-vote vào mốc 9 mạch HPG; `Vote` cố ý không có FK (PLAN 5.3) nên ẩn/xoá nội dung không kéo theo; `don_rac_e2e` cố ý chỉ đụng Mach/Comment. Điểm/wilson của seed vì thế trôi — cùng loài "đổi ngầm đối tượng đo" với P-20260830-13, chỉ chậm hơn.
- **Vì sao không sửa ngay**: ngoài phạm vi lượt dọn bình luận; rút phiếu qua đường ghi (`dat_vote` chiều ngược) + dọn Report/tài khoản là một lượt riêng, cần cân cả `AuditLog` phồng.

### P-20260831-4 · [MỞ] · NHỎ — `e2e/danh-tinh.ts:95` `toContainText("u/…")` từ nay chỉ còn đúng nhờ `textContent`, vì chữ username đã ẩn thị giác ≤640px
- **Thấy lúc**: phản biện lượt "header mobile một dòng"
- **Ở đâu**: `apps/web/e2e/danh-tinh.ts:95`
- **Bằng chứng**: mọi lời gọi `dungTaiKhoan` hiện chạy ở viewport mặc định nên vẫn xanh; ai gọi helper SAU `setViewportSize(≤640)` hoặc đổi sang `useInnerText` sẽ ăn timeout 30s ở dòng không liên quan bài đo của mình.
- **Vì sao không sửa ngay**: chưa gây hại; sửa là thêm một câu chú thích hoặc đổi phép so — làm khi đụng file.

### P-20260901-2 · [MỞ] · VỪA — `--cao-chrome: 57px` không khớp chiều cao header THẬT ở bất kỳ khổ nào: 53px (chuột) / 65px (cảm ứng, đăng nhập)
- **Thấy lúc**: thực thi + phản biện lượt "vùng bấm cụm phải" (`plans/2026-08-31-vung-bam-cum-phai.md`) — hai script đo độc lập cùng ra số
- **Ở đâu**: `apps/web/app/globals.css:94`; nạn nhân đang lệch 4–8px: `trang-mach.module.css:133` (`top: var(--cao-chrome)`), `feed.module.css:150-151`, `khung-hai-cot.module.css:36-37` (rail sticky), `globals.css:206` (`scroll-margin-top` của deep-link)
- **Bằng chứng**: đo Chromium 360/430px — header cao 53px ở `pointer: fine` mọi trạng thái, 65px ở coarse khi đăng nhập (nút tài khoản nở 44 từ lượt header 2026-08-31); không trạng thái nào ra 57
- **Vì sao không sửa ngay**: ngoài phạm vi lượt vùng bấm; sửa đàng hoàng phải quyết cơ chế (đồng bộ biến theo đo thật, hay đổi các nạn nhân sang phép đo runtime) và đo lại rail/deep-link ở nhiều khổ.

### P-20260901-3 · [MỞ] · NHỎ — chỗ giữ `.chua_biet` (116×26) không khớp nút tài khoản sau tải (44×44 ở ≤640 coarse) ⇒ cụm phải co ~72px ngang đúng lúc `GET /me` về — ngược mục đích tự khai của nó
- **Thấy lúc**: phản biện lượt "vùng bấm cụm phải"
- **Ở đâu**: `apps/web/components/thanh-tai-khoan.module.css:17-22`
- **Bằng chứng**: đo coarse 360px; có từ lượt header 2026-08-31 (khi `.ten` co về avatar-only), không phải lượt vùng bấm sinh ra
- **Vì sao không sửa ngay**: cùng họ với P-20260901-2 (bố cục lúc-tải trên cảm ứng) — nên xử một lượt.

### P-20260901-5 · [MỞ] · NHỎ — `.nut_chinh` ("Đăng ký") không có `data-testid`: mọi phép đo phải bám `a[href="/dang-ky"]` — bám URL, thứ đổi được mà không ai nghĩ tới bài đo
- **Thấy lúc**: thực thi vòng 2 lượt "vùng bấm cụm phải" (script đo phải thêm nhánh chọn selector riêng)
- **Ở đâu**: `apps/web/components/thanh-tai-khoan.tsx:54`
- **Vì sao không sửa ngay**: một dòng, nhưng đổi TSX ngoài phạm vi lượt CSS; làm khi đụng file.

### P-20260901-6 · [MỞ] · NHỎ (chớp tắt, 1 lần) — bài `form-ghi B3 (sửa mốc, dấu «đã sửa»)` đỏ một lần trong lượt đầy đủ rồi xanh khi chạy riêng và ở hai lượt đầy đủ khác cùng ngày, cùng code
- **Thấy lúc**: phiên chính kiểm độc lập lượt "vùng bấm cụm phải" (599/1), thợ và nghiệm thu cùng ngày đều 0 failed
- **Ở đâu**: `apps/web/e2e/form-ghi.spec.ts:150` (B3)
- **Bằng chứng**: 599 passed / 1 failed → chạy riêng 1 passed; hai lượt đầy đủ khác 600/0 và 590/0. Chưa có trace phân tích.
- **Vì sao không sửa ngay**: mới 1 lần, chưa tái hiện được; cùng họ "chớp tắt sau thao tác ghi" với P-20260901-4 — gom điều tra một lượt.

### P-20260901-4 · [MỞ] · VỪA (chớp tắt, 1/3 lượt) — bài vote e2e đỏ `Expected "+54" / Received "+53"` SAU `page.reload()`: nghi đua giữa cú bấm thứ ba (cập nhật lạc quan) và reload huỷ POST đang bay
- **Thấy lúc**: thực thi lượt "vùng bấm cụm phải" chạy bộ đầy đủ lần 1 (đỏ), chạy riêng + lượt 2 + lượt của nghiệm thu đều xanh — không đổi dòng code nào giữa các lượt
- **Ở đâu**: `apps/web/e2e/tai-khoan-va-ghi.spec.ts:258-261`
- **Bằng chứng**: 1 failed/589 passed lượt 1 · 590/0 lượt 2 · 590/0 nghiệm thu, cùng `gikky_e2e`. Khác loài với L36 (đã đóng — nguyên nhân khác).
- **Vì sao không sửa ngay**: cần tái hiện có chủ đích (chặn/làm chậm POST vote rồi reload) trước khi vá — vá mù kiểu `waitForResponse` dễ thành trang trí.

### P-20260903-6 · [MỞ] · NẶNG — `api/media/` là kho ảnh CHUNG cho cả `gikky_dev` (bài THẬT) lẫn `gikky_e2e`, nên `don_anh_mo_coi` chạy khi đang trỏ DB nháp sẽ XOÁ THẬT ảnh của bài thật
- **Thấy lúc**: lượt "sửa bài khu quản trị" (`plans/2026-09-03-sua-bai-khu-quan-tri.md`) — cả thực thi lẫn nghiệm thu đều phải dựng ảnh trong `gikky_e2e` và cùng thấy
- **Ở đâu**: `api/config/settings.py` (`MEDIA_ROOT` mặc định `BASE_DIR / "media"`, không phụ thuộc DB) · `api/core/management/commands/don_anh_mo_coi.py`
- **Bằng chứng**: lệnh dọn liệt kê file trên đĩa rồi trừ đi khoá của `MocAnh` / `AnhNoiDung` / `User.avatar_khoa` **của DB đang nối**. Trỏ `gikky_e2e` thì mọi khoá của `gikky_dev` vắng mặt ⇒ rơi vào nhánh "mồ côi". Lệnh **xoá thật khi không có cờ** (chỉ né file trẻ hơn 24 giờ), nên ảnh cũ của bài thật đi luôn. Không có cột nào trong khoá phân biệt hai DB.
- **Vì sao không sửa ngay**: ngoài phạm vi lượt; cần một quyết định (tách `MEDIA_ROOT` theo DB, hay bắt lệnh từ chối chạy khi tên DB không phải DB sản xuất) — user quyết.

### P-20260903-7 · [MỞ] · VỪA — khu quản trị vẫn CHƯA có e2e trình duyệt nào TRONG repo; luồng sửa bài của mod chỉ đo được bằng script dùng-một-lần ngoài repo
- **Thấy lúc**: cùng lượt trên — tiêu chí 5.6 của plan phải đo bằng script ở scratchpad
- **Ở đâu**: `apps/web/playwright.config.ts` (`webServer` chỉ dựng 3000 + 8000, không có 3001)
- **Bằng chứng**: `grep -n "3001" apps/web/playwright.config.ts` không kết quả; toàn bộ `apps/web/e2e/*.spec.ts` không bài nào mở `localhost:3001`. Lượt này phải dựng tay Django + `next start 3001` rồi chạy `do.mjs` ở scratchpad — 15 bước PASS, nhưng script ấy mất khi dọn temp.
- **Vì sao không sửa ngay**: dựng hạ tầng e2e cho app thứ hai là việc riêng (thêm `webServer` thứ ba, seed superuser, tách cổng khỏi bộ hiện có), không phải một mục tiện tay của lượt sửa bài.

### P-20260903-8 · [MỞ] · VỪA — `AnhNoiDung` (ảnh nhúng giữa thân bài) KHÔNG bao giờ vào kho cách ly, nên ảnh trong một mốc đã bị mod ẩn vẫn trả 200 qua URL trực tiếp
- **Thấy lúc**: phản biện lượt trên, khi soi vế A9 của ảnh đính kèm
- **Ở đâu**: `api/core/models/moc.py::AnhNoiDung` (docstring tự khai) · `api/core/anh_noi_dung.py::_xoa_file` ("chỉ quét `kho_hien()`")
- **Bằng chứng**: `dong_bo_kho_anh` chỉ lặp `MocAnh.objects.filter(moc=moc)`; không truy vấn nào chạm `AnhNoiDung` vì bảng ấy **cố ý không có FK về `Moc`**. Prod cho Caddy phục vụ `/media/*` thẳng từ đĩa (`deploy/prod/Caddyfile`), nên ẩn ở tầng API không giấu được URL.
- **Vì sao không sửa ngay**: model ghi rõ đây là lựa chọn có chủ đích (không có đường đi ngược ảnh → mốc). Nhưng lượt này mở thêm bề mặt (mod nhúng ảnh vào bài người khác), nên vế "A9 chỉ đúng một nửa" đáng được nhìn lại một lượt riêng.

### P-20260903-9 · [MỞ] · VỪA — `pnpm test -- <cờ>` KHÔNG truyền được cờ cho pytest, trong khi `CLAUDE.md` dạy đúng cú pháp đó
- **Thấy lúc**: nghiệm thu lượt trên, khi cần chạy riêng một bài
- **Ở đâu**: `scripts/pytest.mjs` · `D:\Projects\gikky-net\CLAUDE.md` (bảng Lệnh, dòng `pnpm test -- -k health -x`)
- **Bằng chứng**: `pnpm test -- -k test_B3 -x` → `ERROR: file or directory not found: -k` (pnpm chèn `-q "--"` vào argv nên pytest coi phần sau là đường dẫn). Phải gọi thẳng `api\.venv\Scripts\python.exe -m pytest`.
- **Vì sao không sửa ngay**: ngoài phạm vi; sửa là đụng `scripts/pytest.mjs` **hoặc** sửa một dòng tài liệu — hai cách khác hẳn nhau về phạm vi, user quyết. ⚠ Bẫy này cùng họ với bẫy `--` của `e2e:don-vi` đã ghi trong `CLAUDE.md`.

### P-20260903-10 · [MỞ] · VỪA — `api/api/quan_tri_cai_dat.py` còn bản chép THỨ BA của phép chặn superuser
- **Thấy lúc**: lượt trên đã gộp hai bản đầu về `api/api/quan_tri_quyen.py::chan_neu_khong_phai_superuser` (plan §2.4 chỉ yêu cầu gộp với `quan_tri_nguoi_dung.py`)
- **Ở đâu**: `api/api/quan_tri_cai_dat.py` — hàm `_chan_neu_khong_phai_superuser` cục bộ
- **Bằng chứng**: thân hàm trùng logic với bản dùng chung, chỉ khác câu lỗi. Ba bản của một luật phân quyền là hai bản sẽ trôi khỏi bản còn lại, và bản trôi không có gì đỏ.
- **Vì sao không sửa ngay**: ngoài phạm vi lượt (plan chốt gộp đúng hai chỗ).

### P-20260903-11 · [MỞ] · NHỎ — `pnpm codegen` luôn sinh lại CẢ HAI client, nên một lượt chỉ đụng API quản trị vẫn kéo theo diff của client v1
- **Thấy lúc**: lượt trên — cây đang có việc dở của một phiên khác ở `/api/v1`
- **Ở đâu**: `scripts/codegen.mjs` (lặp qua `api_registry`)
- **Bằng chứng**: lượt này chỉ thêm endpoint `/api/admin/*`, nhưng `git diff HEAD --stat` cho `packages/api-client/openapi.json | 494 +`, `src/sdk.gen.ts | 118 +`, `src/types.gen.ts | 324 +` — nội dung là `lietKeHoiThoai`/`guiTinNhan`/`docHoiThoai`/`demTinNhanChuaDoc`/`xemHoiThoai` của phiên khác.
- **Vì sao không sửa ngay**: sinh cả hai là ĐÚNG thiết kế (registry là nguồn sự thật, sinh chọn lọc sẽ đẻ drift). Ghi lại vì nó là **bẫy lúc stage**, không phải lỗi: commit nhầm là commit nửa tính năng chưa ai nghiệm thu.

### P-20260903-12 · [MỞ] · NHỎ — `MocSuaQuanTriOut.anhs` dựng URL từ kho ĐANG PHỤC VỤ cho mọi hàng, nên thumbnail của ảnh đang cách ly hỏng ngay trong trang sửa của mod
- **Thấy lúc**: phản biện lượt trên
- **Ở đâu**: `api/api/trinh_bay.py::anh_ra` → `api/core/anh_luu.py::url_anh` / `url_thumb`
- **Bằng chứng**: `MocAnh.da_cach_ly=True` ⇒ file ở `MEDIA_AN_ROOT`, mà `MEDIA_AN_ROOT` cố ý nằm NGOÀI `MEDIA_ROOT` và không route nào phục vụ nó ⇒ `<img>` 404. Mod mở trang sửa một mốc đang bị ẩn thấy ô ảnh vỡ, dù `anhs` liệt kê đủ.
- **Vì sao không sửa ngay**: sửa đúng cách là thêm một cửa đọc ảnh cách ly **sau hàng rào `ChiMod`** — một bề mặt mới, phải quyết có chủ đích. Docstring schema đã tự thú; `PLAN.md` mục 7 nay cũng ghi.

### P-20260903-13 · [MỞ] · NHỎ (NGHI NGỜ) — `xoa_anh_moc` bỏ `ghi_audit` im lặng khi `moc_khoa is None`
- **Thấy lúc**: phản biện lượt trên
- **Ở đâu**: `api/core/ghi.py` — nhánh `if boi is not None and moc_khoa is not None:`
- **Bằng chứng**: **không dựng nổi ca tái hiện** — `MocAnh.moc` là FK `NOT NULL` nên hàng `Moc` biến mất giữa chừng gần như bất khả. Nếu xảy ra thì ảnh vẫn bị xoá (hàng + file) mà không dòng nhật ký nào, tức mất vết duy nhất của một lượt gỡ.
- **Vì sao không sửa ngay**: là **nghi ngờ**, không phải lỗi chắc chắn. Cách chữa rẻ nếu muốn: ghi log với `target_id=anh.moc_id` thay vì bỏ qua.

