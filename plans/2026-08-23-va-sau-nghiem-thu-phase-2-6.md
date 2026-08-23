# Vá sau lượt nghiệm thu Phase 2→6

> Nguồn: 1 nghiệm thu + 3 phản biện chạy trên `ab77957`. Ngày 2026-08-23.
> Nghiệm thu chấm **11/12 ĐẠT**; ba phản biện tìm ra **2 NẶNG-của-riêng-mình + 4 NẶNG trùng nhau**.
> Chia **hai lượt**: **V1 = backend + bảo mật**, **V2 = giao diện + sự thật tài liệu**. V2 chạy sau V1.

## Điều đáng ghi trước: phần lõi ĐỨNG VỮNG

Nghiệm thu tự tay đo và **không phá được**: ma trận **33 endpoint × 3 vai = 99 lời gọi HTTP thật,
99/99 đúng** · rò per-user qua ISR (dựng A/B/khách thật, cả `/m/` lẫn `/m-phien/`) — **không rò** ·
sanitize markdown 7 payload qua composer thật — sạch · hàng rào `client` singleton + `baseUrl` còn
răng · 4 nợ Phase 1 mỗi cái giết được mutant · 4 rào PLAN 5.6 · `pnpm e2e` **3 lượt, 365/365 cả ba**.
Trục dữ liệu đối soát **6 cột denormalize trên DB thật, 0 hàng lệch**, và dựng lại đồ thị khoá đầy
đủ — **không có chu trình**.

⇒ Cái hỏng nằm ở **chỗ không ai đi qua**: cửa nhận chưa mở, nhãn nút nói sai, cấu hình prod chưa
từng chạy, và một loạt câu chữ nói quá.

---

# LƯỢT V1 — backend + bảo mật

## S1 · CHẶN — Caddyfile: allowlist IP của khu quản trị là NO-OP trên prod
`deploy/Caddyfile:133-157`. `respond @ngoai_allowlist … 403` viết **trước** `handle /api/*`, kèm
comment khẳng định "viết trước nên chặn được". **Sai**: Caddy sắp lại theo `directiveOrder`, và
`handle` nằm **trước** `respond`. ⇒ request từ IP bất kỳ tới `admin.gikky.net` khớp `handle`,
proxy thẳng vào Django; dòng `respond` **không bao giờ chạy**.
Hai trong ba lớp che biến mất cùng lúc (lớp Host vẫn cho qua vì Host **đúng là** `admin.gikky.net`).
⇒ Bọc trong `route { … }` hoặc đổi thành `handle @ngoai_allowlist { respond … }` đặt trước. Sửa cả
comment sai. **`abort` cũng ở nhóm sau `handle` — không dùng.**
⚠ Không có Caddy trên máy ⇒ không chạy được `caddy validate`. **Ghi rõ là chưa kiểm chạy.**

## S2 · CHẶN — `seed_dev` tạo tài khoản `is_staff` mật khẩu ghi cứng, không chốt môi trường
`seed_dev.py:127` (`MAT_KHAU_SEED`), `:138` (`MOD_SEED`), `:668` (`is_staff=True`), `:513`
(`handle()` không kiểm `DEBUG`). Cộng với S1 = quyền quản trị cho bất kỳ ai đọc repo.
⇒ `if not settings.DEBUG: raise CommandError(...)` ở đầu `handle()` của **cả** `seed_dev` và
`seed_e2e`. Có test cho nhánh từ chối.

## S3 · CHẶN — `POST /reports` không tồn tại; hàng đợi kiểm duyệt không bao giờ có hàng
Ba agent độc lập cùng tìm ra. `PLAN.md` mục 7 và 5.10 đòi tường minh; plan Mảng A liệt kê "menu ⋯
(sửa/xoá/**báo cáo**)". Thực tế: 0 endpoint, 0 `Report.objects.create` ngoài test, `core_report`
**0 hàng** và về cấu trúc luôn 0.
⇒ `POST /api/v1/reports` (`auth=dang_nhap`; **không** áp `mach_bi_khoa` — báo cáo mạch bị khoá phải
được; chống spam: một người một đích một lần đang mở) + **nút "Báo cáo" trong menu `⋯`** của bình
luận và mốc. Thêm dòng vào `PLAN.md` mục 7.

## S4 · Xoá/sửa bình luận KHÔNG làm mới cache ⇒ nội dung đã gỡ phục vụ công khai tới 1 giờ
`api/api/binh_luan.py` không import `lam_moi_mach`. Hai agent độc lập cùng tìm ra.
Bằng chứng đây là **sót**, không phải chủ đích: mod ẩn bình luận **thì có** gọi
(`quan_tri_kiem_duyet.py:94`) — ranh giới "nội dung biến khỏi trang công khai" đã được công nhận là
sự kiện có signal; chỉ đường của **chính tác giả** là quên. Và tác giả đang đăng nhập nên đi nhánh
dynamic ⇒ **họ thấy nó đã mất và tin là xong**.
⇒ Gọi `lam_moi_mach` ở `xoa_binh_luan_api` **và** `sua_binh_luan_api`; sửa
`test_binh_luan_KHONG_goi_lam_moi` cho nó chỉ nói về `POST`; thêm 2 dòng vào bảng
`test_moi_su_kien_CO_SIGNAL_deu_goi_lam_moi`.

## S5 · Ba đường ghi cho HTTP 500 ở ca đua bình thường
- **`Comment.DoesNotExist`** (`ghi.py:790`, `ghi.py:761`, `cay_binh_luan.py:72`): double-click Xoá,
  hoặc Trả lời đúng lúc bị xoá thật, hoặc Sửa song song Xoá ⇒ 500 thay vì 409. `Comment` là model
  **duy nhất** có đường xoá cứng nên chỉ nó dính.
- **`dat_reaction`** (`ghi.py:860`): double-click 🔥 ⇒ `select_for_update` không có hàng để khoá ⇒
  hai `create()` ⇒ `IntegrityError` ⇒ **500**. Đường trích gặp đúng cuộc đua này và đã xử 409.
- **`trich_vao_so_api`** (`mocs.py:340`) quy **mọi** `IntegrityError` về 409 "đã có trích khác" —
  nói dối khi nguyên nhân thật là bình luận vừa bị xoá (FK Django là `DEFERRABLE INITIALLY
  DEFERRED`, xác minh bằng `\d core_trich`, nên FK nổ ở COMMIT).
⇒ Bắt đúng loại: `Comment.DoesNotExist` → 409 `noi_dung_da_go`; reaction dùng `update_or_create`
hoặc bắt `IntegrityError`; trích phân biệt bằng `_la_va_cham(loi, "trich_mot_hieu_luc_moi_moc")`
(hàm đã có ở `ghi.py:127`).

## S6 · Hạn mức: một cái đếm ngoài khoá, ba cái không tồn tại
- `HAN-MUC-KHONG-KHOA`: `machs.py:466` đếm **trước** `atomic()` ⇒ double-click lọt mốc thứ 4.
  ⇒ Chuyển phép đếm vào trong, sau `select_for_update` hàng `Mach`.
- **PLAN mục 10 Phase 6** đòi đăng ký **≤5/IP/ngày**, đăng bài **≤10/user/ngày** (số đổi được trong
  settings); **PLAN 5.10** đòi **shadow-limit 5 bình luận/giờ cho tài khoản < 3 ngày tuổi**.
  `grep` toàn repo: hằng hạn mức **duy nhất** là `SO_MOC_TOI_DA_MOI_NGAY = 3`. Và
  `deploy/Caddyfile:36` lại khẳng định *"hạn mức theo người dùng và theo ngày lịch VN là việc của
  Django"* — Django không làm.
  ⇒ **Cài cả ba ở Django**, hằng đặt trong settings đúng như PLAN đòi. Đây là chống lạm dụng, không
  phải tính năng — rẻ và đã hứa.

## S7 · "Tác giả vẫn thấy nội dung kèm nhãn" (PLAN 5.2 + 5.10) chưa được cài
`trinh_bay.py::moc_ra`/`nut_ra` che theo `doc_duoc(...)`, **không nhận người xem**. Đang bị khai
nhầm là "chưa đo được, cần Mảng A" — thực trạng là **chưa có gì để đo**.
Mâu thuẫn PLAN chưa ai ghi: `GET /machs/{id}` bị ép **không chứa gì per-user** (điều kiện của ISR
8.4), nên vế này **không thể** cài trên cửa đó.
⇒ **Quyết định của phiên chính: cài qua `GET /machs/{id}/me`** — nó đã per-user, đã `no-store`, đã
chạy trong trình duyệt. Trả thêm nội dung **của chính người gọi** đang bị ẩn/bia mộ, để client vá
vào chỗ ô trống. Giữ nguyên bề mặt `GET /machs/{id}`.
⚠ Chỉ trả nội dung **user gọi là tác giả**. Trả nhầm của người khác là biến một bản vá minh bạch
thành một lỗ rò.

## S8 · Digest: không ai bật được, link huỷ 404
`User.nhan_digest` mặc định `False` và **không endpoint/form nào đặt được**; thư có link
`{goc_site}/cai-dat` — **trang đó không tồn tại**.
⇒ `PATCH /api/v1/me` (đặt `nhan_digest`) + trang `/cai-dat` tối thiểu. Nếu hoãn thì **sửa câu cuối
thư** cho đúng sự thật và ghi nợ có tên — không để nguyên link chết.

## S9 · Nhỏ nhưng thật
- `viet_binh_luan` (`machs.py:540`) **không gọi `doi_con_song(parent)`** ⇒ reply vào bình luận mod
  vừa ẩn; và reply mới làm bình luận bị ẩn có `con_song = True` nên tác giả nó **vĩnh viễn không
  xoá thật được nữa**.
- **Ban KHÔNG chặn đăng nhập** (không có allauth adapter nào). Câu ở `quan_tri.py:70` và commit
  `86ea9c1` nói ngược lại. ⇒ Hoặc thêm adapter, hoặc sửa câu.
- `test_moi_operation_ghi_deu_co_auth` chỉ chạy trên `api_v1` — mở rộng sang `api_admin`.
- `bao_moc_moi` (`thong_bao.py:120`) khoá nhiều hàng `core_user` **không `ORDER BY`**. Hôm nay an
  toàn vì `FOR KEY SHARE` tương thích với chính nó; thêm `.order_by("user_id")` cho rẻ.
- `DanhDauDaDocIn.ids` không có `max_length`.
- Cửa `/lam-moi-cache` **không có bài đo nào cho nhánh TỪ CHỐI** (secret rỗng ⇒ 503, secret sai ⇒
  401). Đảo một dấu `!` là mở toang cửa mà không gì đỏ.
- `settings.py:243` nói thư ra `api/sent_emails/`; thật ra `api/.mail/`.
- `revalidate.py:14-19` còn cảnh báo cơ chế "CHƯA có tác dụng thật" — **nợ đó đã trả ở `ab77957`**.
  Nợ giả.

---

# LƯỢT V2 — giao diện + sự thật tài liệu

## G1 · CHẶN — nút "Đóng: Đã ban / Đã khoá / Đã ẩn" khẳng định một hành động KHÔNG xảy ra
`apps/admin/app/page.tsx:222` + `components/dung-mo-ta.ts:23`. Backend nói rõ `action` **chỉ ghi
lại**, không thi hành (`quan_tri_bao_cao.py:118`, `ghi.py:1283`). Mod bấm "Đóng: Đã ban" trên một
báo cáo lừa đảo ⇒ 200, hàng sang "Đã xử lý", audit log đầy đủ, **kẻ kia không bị ban một giây nào**.
Nặng gấp đôi vì trên hàng **không có nút khoá hay ban thật** — trong khi docstring cùng file trích
PLAN 9.3 *"nút ẩn/khoá/ban ngay trên hàng"* rồi viết *"'Ngay trên hàng' là cả yêu cầu"*. Cài 1/3.
⇒ Thêm nút **Khoá** và **Ban** thật trên hàng (endpoint đã có), **và** đổi nhãn `Đóng:` sang thì
hiện tại + nói rõ nó chỉ ghi nhận.

## G2 · CHẶN — neo bình luận: mặc định sai, không gỡ được, hai composer khác luật cùng một trang
`khan-dai.tsx:166,233` gọi `<Composer />` **không prop** ⇒ `anchor_moc_seq: null`. Chip là `<span>`
trơ. Trang BÃO có **hai ô nhập trông y hệt nhau, hai luật neo khác nhau**.
Hệ quả: người đọc mặt CẶN gõ vào ô cuối trang ⇒ bình luận **không vào ngăn kéo nào**; mọi ngăn kéo
vẫn "Chưa ai neo bình luận vào mốc này" trong khi khán đài đầy chữ.
Và `PLAN.md` mục 4 dùng đúng cơ chế "gỡ chip → `anchor = NULL`" làm **lý do bác** một đề xuất khác —
cơ chế mà lý lẽ ấy dựa vào thì chưa tồn tại.
⇒ Truyền `anchorMocSeq` (mốc mới nhất) cho composer khán đài · chip có nút `×` đặt `null` và cách
đổi mốc · bỏ composer trùng ở mặt BÃO (hoặc cho hai cái dùng chung một state neo).

## G3 · `CotVote` không xử nhịp `dangTai` ⇒ người ĐÃ đăng nhập thấy lý do SAI
`cot-vote.tsx:87`. `usePhien()` trả `{toi: null, dangTai: true}` tới khi `/me` về. Trong khoảng đó
mũi tên `disabled` + `title="Đăng nhập để vote"`. `Composer`, `NutTheoMach`, `KhoiChuMach`,
`HanhDongBinhLuan` đều xử `dangTai`; chỉ `CotVote` không — và chính file đó viết *"lý do phải ĐÚNG"*.

## G4 · OG card của sub rỗng in "0 mạch"
`lib/og.ts:169` vô điều kiện, trong khi `lib/dinh-dang.ts:101` có sẵn `dongSoMachSub` để tránh đúng
chuyện đó (dùng ở trang sub và sidebar). Nguyên tắc 9 không có ngoại lệ cho `so_mach`.

## G5 · `TOGGLE-MAT-MOT-CHIEU` — hướng thiếu là hướng CHÍNH
`grep "view=can"` → 0. Chỉ có `?view=bao`. PLAN 5.5 dựng toggle này với lý do *"người nghiêm túc
bật 'thuần' một lần"* — tức hướng **BÃO → CẶN**, đúng hướng đang thiếu.

## G6 · `README.md` sai ở 6 dòng liên tiếp
Vẫn viết "Phase 1 đã xong — trang CHỈ ĐỌC", "Chưa có: đăng nhập / mọi thao tác ghi / mặt BÃO /
follow / notification / khu quản trị", "mũi tên vote bị khoá", "`apps/admin` — khung". **Phiên chính
tự viết lại**, V2 không phải làm.

## G7 · Mười ba câu "chữ nói quá thứ code làm"
Danh sách đầy đủ trong báo cáo phản biện trục sản phẩm. Sửa **câu chữ** cho khớp code, hoặc sửa
**code** cho khớp câu — mỗi chỗ chọn một, đừng để nguyên.

## G8 · Vụn
`apps/admin/app/subs/page.tsx:201` nút Xoá có `disabled` + `title`, **thiếu `aria-label`** (luật ba
đường) · `type-admin.spec.ts:99` vẫn dùng regex một tầng ngoặc trong khi bản web đã chuyển sang quét
cân bằng — hai bản của cùng một luật đã lệch · `/luat` nói "quy trình xử lý của quản trị viên thuộc
giai đoạn sau" (đã có) · `apps/admin/app/u/[username]/page.tsx:73` tự tính `den_khi` ở client.

---

## Tiêu chí nghiệm thu lượt vá

| # | Tiêu chí |
|---|---|
| Z1 | S1: Caddyfile chặn đúng thứ tự; comment sai đã sửa; **ghi rõ chưa chạy `caddy validate`** |
| Z2 | S2: `seed_dev`/`seed_e2e` từ chối khi `DEBUG=False`, có test |
| Z3 | S3: `POST /reports` sống, có nút trong UI, có test phân quyền + chống trùng |
| Z4 | S4: xoá/sửa bình luận làm mới cache; **đo thật**: khách thấy nội dung biến mất |
| Z5 | S5: ba ca đua trả mã đúng, **không còn 500**; mỗi ca một bài đo |
| Z6 | S6: bốn hạn mức chạy đúng, hằng trong settings, ranh giới nửa đêm VN đúng |
| Z7 | S7: tác giả thấy nội dung của **chính mình** bị ẩn; **người khác KHÔNG thấy** (cả hai chiều đều có bài đo) |
| Z8 | G1: có nút Khoá/Ban thật; nhãn `Đóng:` không còn khẳng định hành động |
| Z9 | G2: composer khán đài neo mốc mới nhất; chip gỡ/đổi được; không còn hai composer khác luật |
| Z10 | G3–G5, G7, G8 xong |
| Z11 | Không hồi quy: ≥ 754 Python + ≥ 365 e2e, 0 warning, codegen khớp, lint/build/tsc sạch, SEO ≥ 90 |
| Z12 | **Clone sạch chạy được**: `REVALIDATE_SECRET` không còn làm chết 42 bài đo ở `beforeAll` |

## Luật dừng
Chỉ mở lượt vá tiếp khi có **lỗi hành vi NẶNG/VỪA** hoặc **lỗi bảo mật/phân quyền ở bất kỳ hạng
nào**. Câu chữ → phiên chính gom sửa. Trần **2** lượt; hết trần thì ghi nợ có tên.
