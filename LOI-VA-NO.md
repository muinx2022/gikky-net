# Sổ lỗi và nợ — gikky.net

> Lập 2026-08-23 tại `ab77957`, sau lượt nghiệm thu + 3 lượt phản biện đầu tiên trên
> Phase 2/3/4/6. **Đây là sổ cái, không phải kế hoạch.** Sửa xong một mục thì đổi trạng thái
> tại chỗ, đừng xoá — lịch sử lỗi là thứ dạy được nhiều nhất ở repo này.
>
> Trạng thái: `MỞ` · `ĐANG SỬA` · `ĐÓNG (<commit>)` · `HOÃN CÓ CHỦ ĐÍCH`
> Hạng: **CHẶN** (không ra mắt được) · **NẶNG** · **VỪA** · **NHỎ**

## Cách đọc nhanh

**Cập nhật sau LƯỢT VÁ V1 (backend + bảo mật), 2026-08-23.** 22 mục đóng, 15 còn mở.
Mục đã đóng vẫn nằm nguyên chỗ cũ kèm bằng chứng gốc gập lại — lịch sử lỗi là thứ dạy được
nhiều nhất ở repo này.

| | Tổng | Còn MỞ sau V1 |
|---|---|---|
| CHẶN | 5 (L01–L05) | **2** — L04, L05 (cả hai thuộc lượt V2) |
| NẶNG | 2 (L06–L07) | 0 |
| VỪA | 12 (L08–L19) | **3** — L15, L16, L19 (V2) |
| NHỎ | 18 (L20–L37) | **10** — L20, L21, L22, L25, L30, L32, L33, L35, L36, L37 (V2) |
| Nợ có tên | 8 mang từ Phase 1 + **3 mới ở V1** | — |
| "Chưa bao giờ chạy thật" | 5 | 5 |

⚠ **L01 đóng nhưng CHƯA KIỂM CHẠY** — không có Caddy trên máy. Đọc mục ấy trước khi coi
hàng rào host admin là đã xong.

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
**MỞ.** `apps/admin/app/page.tsx:222` + `components/dung-mo-ta.ts:23`.
Backend nói rõ `action` **chỉ ghi lại** mod đã làm gì, không thi hành (`quan_tri_bao_cao.py:118`,
`ghi.py:1283`). Mod bấm "Đóng: Đã ban" trên báo cáo lừa đảo ⇒ 200, hàng sang "Đã xử lý", audit log
đầy đủ, **kẻ kia không bị ban một giây nào**.
Nặng gấp đôi: trên hàng **không có nút khoá hay ban thật** (chỉ Ẩn/Gỡ ẩn), trong khi docstring cùng
file trích PLAN 9.3 *"nút ẩn/khoá/ban ngay trên hàng"* rồi viết *"'Ngay trên hàng' là cả yêu cầu"*.
Cài 1/3 ⇒ bốn nút `Đóng:` là thứ duy nhất trông giống hành động.
→ Thêm nút **Khoá** và **Ban** thật (endpoint đã có) + đổi nhãn `Đóng:` sang thì hiện tại, nói rõ
nó chỉ ghi nhận.

### L22 · NHỎ · PLAN 9.3 mục 2 "tra cứu mạch/user" không có
**MỞ.** `apps/admin/components/cong-quan-tri.tsx:52` chỉ có 3 link. `/m/[machId]` và `/u/[username]`
chỉ tới được từ một hàng báo cáo — và từ lượt vá V1 thì hàng đợi **đã có hàng thật** (L03 đóng), nên
mục này nhẹ đi một bậc về hậu quả: vẫn thiếu ô tra cứu, nhưng không còn ca "không có đường nào tới
nút ban/khoá thật".

### L30 · NHỎ · Nút "Xoá" thiếu `aria-label`
**MỞ.** `apps/admin/app/subs/page.tsx:201` có `disabled` + `title`, thiếu đường thứ ba. Luật ba
đường được tuân thủ đầy đủ ở `apps/web/components/cot-vote.tsx:176`.

### L33 · NHỎ · `den_khi` tính ở client
**MỞ.** `apps/admin/app/u/[username]/page.tsx:73` — `now + N ngày`. Nguyên tắc 10 ở mức nhẹ.

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
**MỞ.** `apps/web/lib/og.ts:169` vô điều kiện, trong khi `lib/dinh-dang.ts:101` có sẵn
`dongSoMachSub` để tránh đúng chuyện đó (dùng ở trang sub và sidebar). Nguyên tắc 9 không có ngoại
lệ cho `so_mach` — ngoại lệ duy nhất đã chốt là điểm vote.

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
**MỞ.** `grep "view=can"` (trừ e2e) = **0**; chỉ có `?view=bao`. PLAN 5.5 dựng toggle này với lý do
*"người nghiêm túc bật 'thuần' một lần rồi vĩnh viễn không thấy bình luận"* — tức hướng **BÃO →
CẶN**, đúng hướng đang thiếu. Nợ đã khai một dòng nhưng khai nhẹ hơn thực tế.

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
**MỞ.** `khan-dai.tsx:166` và `:233` gọi `<Composer />` **không prop** ⇒ `anchor_moc_seq: null`.
Chip neo là `<span>` trơ, không `onClick`. Trang BÃO có **hai ô nhập trông y hệt nhau, hai luật
neo khác nhau** (`trang-mach.tsx:388` neo mốc mới nhất; ô cuối khán đài neo `null`).
Hệ quả: người đọc mặt CẶN gõ vào ô cuối trang ⇒ bình luận **không vào ngăn kéo nào**; mọi ngăn kéo
vẫn "Chưa ai neo bình luận vào mốc này" trong khi khán đài đầy chữ.
Chua nhất: `PLAN.md` mục 4 dùng đúng cơ chế *"gỡ chip → `anchor = NULL`"* làm **lý do bác** một đề
xuất khác — cơ chế mà lý lẽ ấy dựa vào thì chưa tồn tại.
Kèm hai câu nói quá: `composer.tsx:19` (*"chip đổi/gỡ được"*) và `the-moc.tsx:181` (*"đó là toàn bộ
khác biệt với composer khán đài"*).
→ Truyền `anchorMocSeq` (mốc mới nhất) cho composer khán đài · chip có `×` đặt `null` và cách đổi
mốc · bỏ composer trùng ở mặt BÃO.

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
**MỞ.** `cot-vote.tsx:87`. `usePhien()` trả `{toi: null, dangTai: true}` tới khi `/me` về; trong
khoảng đó mũi tên `disabled` + `title="Đăng nhập để vote"`. `Composer`, `NutTheoMach`,
`KhoiChuMach`, `HanhDongBinhLuan` đều xử `dangTai`; chỉ `CotVote` không — và chính file đó viết
*"lý do phải ĐÚNG: chưa đăng nhập ≠ mạch bị khoá"*.

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
**MỞ.** Bản quét-ngoặc-cân-bằng cho lọt `const C = { fetch: (u) => fetch(u, { baseUrl: 0 }) }` +
`xemMach({ ...C })` — bản một-tầng-ngoặc cũ **không** cho lọt. Nên câu *"Luật KHÔNG bị nới"* ở
`type-frontend.spec.ts:291` không hoàn toàn đúng. Không đạt tới được từ code hiện tại.

---

## Xuyên suốt

### L19 · VỪA · `README.md` sai ở 6 dòng liên tiếp
**MỞ.** Vẫn viết *"Phase 1 đã xong — trang CHỈ ĐỌC"*, *"Chưa có: Đăng nhập / Mọi thao tác ghi / Mặt
BÃO, follow, notification / Khu quản trị"*, *"mũi tên vote bị khoá"*, *"`apps/admin` — khung, Phase
4 mới làm"*. Commit `f0a72d9` **có** sửa README (một câu về `/api/admin/`) rồi để nguyên bảng này.
Người ngoài clone repo đọc README sẽ kết luận sai về gần như mọi năng lực.

### L20 · NHỎ · Mười ba câu "chữ nói quá thứ code làm"
**MỞ — nhưng đã bớt.** Lượt vá V1 đóng phần thuộc L03/L13/L18 (câu đã khớp code), cùng
`revalidate.py:14` (L29) và `deploy/Caddyfile:36` (nay ĐÚNG: Django thật sự làm hạn mức
theo user và theo ngày lịch VN — xem L12). Còn lại là việc của V2.
Danh sách đầy đủ ở báo cáo phản biện trục sản phẩm. Gồm L04/L05/L19 ở trên,
cộng: `deploy/Caddyfile:36` (*"hạn mức là việc của Django"*) · `revalidate.py:14` (nợ giả, xem L29) ·
commit `64b1a94` (*"cắm nguồn người nhận cho digest"* — cắm vào cờ không ai bật được) ·
`app/luat/page.tsx:47` (*"quy trình xử lý của quản trị viên thuộc giai đoạn sau"* — đã có) ·
commit `ab77957` (*"365 e2e"* — không tái lập được từ clone sạch, xem L07) ·
`cot-vote.tsx:48` (*"lý do phải ĐÚNG"* — xem L15).

### L25 · NHỎ · Hai bản của cùng một luật đã lệch nhau
**MỞ.** `type-admin.spec.ts:99` vẫn `\{([^{}]*)\}` một tầng ngoặc, bản web đã chuyển sang quét cân
bằng. Lệch theo chiều an toàn (admin báo vi phạm giả nếu ai thêm hằng lồng) nhưng là bẫy chờ sẵn.

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
**MỞ.** Luật "không một dòng nào ghi thẳng `hidden_at`" được viết ở `ghi.py:70` và
`quan_tri_kiem_duyet.py:3`. Hôm nay vô hại về số (đã đối soát). Nếu mai `dat_an_mach` phải kéo theo
một cột, đây là chỗ quên.

### L35 · NHỎ · `/luat` nói nửa sai
**MỞ.** `app/luat/page.tsx:47` — quy trình xử lý của quản trị viên **đã có**. Vế thứ hai
của mục này (*"chỉ nút báo cáo là chưa"*) đã hết đúng từ lượt vá V1: nút báo cáo nay có
thật (L03). Nghĩa là câu ở `/luat` nay sai **hoàn toàn**, không còn nửa đúng nào. Sửa câu
là việc của V2.

### L36 · NHỎ · "Flake" 1/3 ở bài vote — **KHÔNG phải flake, đã tìm ra nguyên nhân**
**ĐÓNG (lượt gộp Phase 5, 2026-08-23).** Nguyên nhân là **L41**: `.next/cache` giữ payload
từ trước khi schema đổi. Bài nào trúng một mạch có payload cũ thì đỏ, không trúng thì xanh —
đúng hình dạng một flake, nhưng tất định. Xoá `.next/cache` ⇒ xanh ngay, tái hiện được cả hai
chiều. Nghiệm thu chạy 3 lượt không bắt lại được vì cache lúc đó đã ấm bằng payload mới.

<details><summary>bằng chứng gốc</summary>
B2 báo bài "mũi tên vote SỐNG" đỏ 1 trong 3 lượt, chạy riêng file thì xanh. Nghiệm thu chạy
3 lượt đầy đủ tuần tự: 365/365 cả ba, không tái hiện.</details>

### L41 · **NẶNG** · Cache dữ liệu của Next sống qua thay đổi schema ⇒ **500 trên prod sau deploy**
**MỞ.** Phát hiện ở lượt gộp Phase 5, 2026-08-23.
`.next/cache` (fetch/data cache của ISR) **không bị xoá khi build lại**. Deploy một bản thêm
trường bắt buộc vào response API ⇒ trang nào còn được phục vụ từ payload cũ sẽ đọc `undefined`
và **crash server-side**, không phải render thiếu.
Đo thật: sau khi gộp Phase 5 (`MocOut` mọc `anhs`), render trang mạch ném
`TypeError: Cannot read properties of undefined (reading 'length')` ở `stringify` — tức **500**
với người dùng thật, trong khi `anhs` là trường **bắt buộc** ở cả schema Python lẫn TS.
Xoá `.next/cache` ⇒ hết ngay. Đây là lý do của L36.
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
| `REACTION-CHUA-CO-UI` | API + `my_reactions` đã có, UI thì chưa (wireframe 9.2 có hàng `📈 12 · 🔥 9`) | — |
| `GOOGLE-CHUA-DO` | code OAuth viết theo tài liệu, chưa chạy lần nào | khi có credential |
| `FORM-FIGURES` | chưa có UI cho `figures` (trường thứ 5 của PLAN 5.2) | — |
| `UI-DIFF-REVISION` | "đã sửa N lần" chưa bấm xem diff được; endpoint đã có | — |
| `OG-HOANG-THO` | nhãn "ĐÃ ĐÓNG SỔ" trên ảnh OG không có hoàng thổ (satori không giải `var()`) | — |
| `OG-MAU-BAN-SAO` · `URL-MACH-HAI-BAN` · `XML-QUET-NONG` | ba bản sao/xấp xỉ có ghi chú tại chỗ | — |
| `BACKUP-CUNG-MAY` | bản dump nằm cùng máy với DB thì không phải bản sao lưu | khi có đích ngoài máy |

## Nợ có tên MỞ THÊM ở lượt vá V1 (2026-08-23)

| Tên | Nội dung | Gỡ khi nào |
|---|---|---|
| `BAN-CHUA-CHAN-DANG-NHAP` | PLAN 5.10 đòi *"hiện lý do khi bị chặn đăng nhập"*; hôm nay ban **không** chặn đăng nhập, chỉ chặn cửa GHI và cửa quản trị. Hook đúng là `DefaultAccountAdapter.pre_login` (`core/allauth_adapter.py`); cái khó là trả **lý do** qua bề mặt headless — allauth chỉ có sẵn một response "tài khoản không hoạt động" không mang được chữ của mình. Xem L18 | mục việc riêng |
| `SHADOW-LIMIT-XOA-THAT` | hạn mức 5 bình luận/giờ đếm trên bảng `core_comment`, nên nhánh **xoá THẬT** của PLAN 5.3 (bình luận không reply, chưa từng được trích) lách được: viết 5 → xoá 5 → viết tiếp. Bia mộ và bình luận bị ẩn thì vẫn đếm (có bài đo). Trả nó cần một bộ đếm sống độc lập với hàng bị xoá, tức một bảng mới | khi có dấu hiệu bị lách thật |
| `TRANG-CAI-DAT` | `PATCH /api/v1/me` đã mở và `GET /me` đã trả `nhan_digest`, nhưng `apps/web/app/cai-dat` **chưa tồn tại** ⇒ chưa có nút nào bật digest. Câu cuối thư digest đã bỏ link chết, và `test_digest.py` ghim `"/cai-dat" not in than` để nó không quay lại trước khi trang có thật | lượt V2 |

---

# B2 · PHÁT HIỆN MỚI trong lượt vá V1 (chưa sửa — ngoài phạm vi)

### L38 · VỪA · `api_admin` không có lưới bắt `Comment.DoesNotExist` — cùng họ với L08
**MỞ.** L08 gắn `exception_handler(Comment.DoesNotExist)` cho `api_v1`, nhưng
`core/ghi.py::dat_an_binh_luan` (`:1135`) cũng `select_for_update().get()` trên một hàng
`Comment`. Tác giả xoá THẬT đúng lúc mod bấm "Ẩn" ⇒ **HTTP 500 ở khu quản trị**. Cùng cuộc
đua, cùng cách chữa (≈ 10 dòng), chỉ khác `NinjaAPI`. Không sửa ở V1 vì nó nằm ngoài danh
sách được giao và nó đổi hợp đồng lỗi của khu quản trị.

### L39 · NHỎ · Hạn mức theo IP là NO-OP (hoặc chặn cả thế giới) nếu prod quên một biến
**MỞ (rủi ro triển khai, không phải lỗi code).** `HAN_MUC_DANG_KY_MOI_IP_NGAY` chỉ có
nghĩa khi `TIN_X_FORWARDED_FOR=True`: sau Caddy, `REMOTE_ADDR` của **mọi** request là
`127.0.0.1`, nên để `False` thì cả thế giới dùng chung một khoá đếm và người thứ sáu trong
ngày bị chặn oan. Mặc định `False` là đúng cho dev và **sai cho prod**, và không có gì
kêu — `api/.env.example` nói ra bằng chữ, nhưng chữ không phải hàng rào. Nó chỉ đo được ở
lần deploy đầu tiên, cùng lúc với bốn phép thử Caddy.

### L40 · NHỎ · `dem_dang_ky_trong_ngay_vn` quét bảng `core_user` không index
**MỞ.** `filter(dang_ky_ip=…, date_joined__gte=…)` chạy mỗi lượt đăng ký, không có index
nào phủ. Vô hại ở quy mô v1 (vài nghìn hàng); ghi ra để lần sau không phải đi tìm.

---

# C · CHƯA BAO GIỜ CHẠY THẬT

| Thứ | Trạng thái |
|---|---|
| **Caddy** | `deploy/Caddyfile` chưa qua `caddy validate`, chưa một request nào — **vẫn đúng sau lượt vá V1** (`caddy version` → command not found trên máy dev). Bản vá L01 đổi cấu trúc block admin, nên nó cần đúng bốn phép thử ở cuối file hơn bao giờ hết. Đòi bản dựng bằng `xcaddy --with caddy-ratelimit` — bản tiêu chuẩn **không khởi động được**. Xem L01. |
| **SMTP** | chưa gửi thư thật lần nào. Dev ghi ra `api/.mail/`. |
| **Google OAuth** | không có credential. Chỉ chứng minh được vế "không có credential ⇒ nút VẮNG MẶT". |
| **Scheduler backup** | `pnpm db:sao-luu` đã chạy vòng đầy đủ **trong worktree**; ở cây chính chưa ai đo. Chưa có Task Scheduler/cron, chưa có đích ngoài máy. |
| **Phase 5 — ảnh** | HOÃN có chủ đích: máy không có Docker (user chốt 2026-08-21), chưa có R2. |

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
