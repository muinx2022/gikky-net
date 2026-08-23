# Sổ lỗi và nợ — gikky.net

> Lập 2026-08-23 tại `ab77957`, sau lượt nghiệm thu + 3 lượt phản biện đầu tiên trên
> Phase 2/3/4/6. **Đây là sổ cái, không phải kế hoạch.** Sửa xong một mục thì đổi trạng thái
> tại chỗ, đừng xoá — lịch sử lỗi là thứ dạy được nhiều nhất ở repo này.
>
> Trạng thái: `MỞ` · `ĐANG SỬA` · `ĐÓNG (<commit>)` · `HOÃN CÓ CHỦ ĐÍCH`
> Hạng: **CHẶN** (không ra mắt được) · **NẶNG** · **VỪA** · **NHỎ**

## Cách đọc nhanh

| | Số mục |
|---|---|
| CHẶN | 5 (L01–L05) |
| NẶNG | 2 (L06–L07) |
| VỪA | 12 (L08–L19) |
| NHỎ | 18 (L20–L37) |
| Nợ có tên mang từ Phase 1 sang | 8 |
| "Chưa bao giờ chạy thật" | 5 |

**Điều phải nói kèm mọi con số dưới đây:** phần lõi đã được đo tận tay và **đứng vững** —
ma trận phân quyền 33 endpoint × 3 vai (99 lời gọi HTTP thật, 99/99 đúng) · rò per-user qua ISR
dựng A/B/khách thật: không rò · sanitize markdown 7 payload qua composer thật: sạch · đối soát 6
cột denormalize trên DB thật: 0 hàng lệch · đồ thị khoá đầy đủ: không chu trình · `pnpm e2e` 3
lượt: 365/365 cả ba. Lỗi dưới đây nằm ở **chỗ không ai đi qua**.

---

# A · LỖI ĐANG MỞ

## Phase 4 — khu quản trị

### L03 · CHẶN · `POST /reports` không tồn tại — hàng đợi kiểm duyệt không bao giờ có hàng
**MỞ.** Ba agent độc lập cùng tìm ra.
`PLAN.md` mục 7 và 5.10 đòi tường minh; plan Mảng A liệt kê "menu ⋯ (sửa/xoá/**báo cáo**)".
Thực tế: 0 endpoint, `grep "Report.objects.create"` ngoài test = rỗng, `core_report` **0 hàng** và
về cấu trúc **luôn** 0. Mảng A trỏ sang Phase 4; Phase 4 dựng toàn bộ phía tiêu thụ (hàng đợi,
phân trang keyset, `dong_bao_cao`, AuditLog, trang admin, 71 test) mà không dựng cửa nhận. **Không
lượt nào ghi đây là nợ.**
→ `POST /api/v1/reports` (`auth=dang_nhap`; **không** áp `mach_bi_khoa`; một người một đích một lần
đang mở) + nút "Báo cáo" trong menu `⋯` của bình luận và mốc + dòng vào `PLAN.md` mục 7.

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
chỉ tới được từ một hàng báo cáo — mà hàng đợi vĩnh viễn rỗng (L03). ⇒ trên UI **không có đường nào
tới nút ban/khoá thật**.

### L30 · NHỎ · Nút "Xoá" thiếu `aria-label`
**MỞ.** `apps/admin/app/subs/page.tsx:201` có `disabled` + `title`, thiếu đường thứ ba. Luật ba
đường được tuân thủ đầy đủ ở `apps/web/components/cot-vote.tsx:176`.

### L33 · NHỎ · `den_khi` tính ở client
**MỞ.** `apps/admin/app/u/[username]/page.tsx:73` — `now + N ngày`. Nguyên tắc 10 ở mức nhẹ.

---

## Phase 6 — đánh bóng ra mắt

### L01 · CHẶN · Caddyfile: allowlist IP của khu quản trị là NO-OP trên prod
**MỞ.** `deploy/Caddyfile:133-157`.
```
@ngoai_allowlist not remote_ip 192.0.2.0/24
respond @ngoai_allowlist "Not found" 403     ← viết trước
handle /api/* { reverse_proxy … }            ← viết sau
```
Comment khẳng định "viết trước nên chặn được". **Sai**: Caddy sắp lại theo `directiveOrder`, và
`handle` nằm **trước** `respond`. ⇒ request từ IP bất kỳ tới `admin.gikky.net` khớp `handle`, proxy
thẳng vào Django; dòng `respond` **không bao giờ chạy**. Hai trong ba lớp che biến mất cùng lúc
(lớp Host vẫn cho qua vì Host **đúng là** `admin.gikky.net`).
→ Bọc trong `route { … }` hoặc `handle @ngoai_allowlist { respond … }` đặt trước. **`abort` cũng ở
nhóm sau `handle` — không dùng.** Sửa cả comment sai.
⚠ Không có Caddy trên máy ⇒ chưa chạy `caddy validate` được. Phép thử số 3 ở cuối file trả lời dứt
điểm trong 5 giây khi có Caddy.

### L02 · CHẶN · `seed_dev` tạo tài khoản `is_staff` mật khẩu ghi cứng, không chốt môi trường
**MỞ.** `seed_dev.py:127` (`MAT_KHAU_SEED`), `:138` (`MOD_SEED`), `:668` (`is_staff=True`), `:513`
(`handle()` không kiểm `DEBUG`). Cộng với L01 = quyền quản trị cho bất kỳ ai đọc repo.
→ `if not settings.DEBUG: raise CommandError(...)` ở **cả** `seed_dev` và `seed_e2e`, có test cho
nhánh từ chối.

### L12 · VỪA · Ba hạn mức chống lạm dụng PLAN đòi — không tồn tại
**MỞ.** PLAN mục 10 Phase 6: đăng ký **≤5/IP/ngày**, đăng bài **≤10/user/ngày** (số đổi được trong
settings). PLAN 5.10: **shadow-limit 5 bình luận/giờ cho tài khoản < 3 ngày tuổi**.
`grep` toàn repo: hằng hạn mức **duy nhất** là `SO_MOC_TOI_DA_MOI_NGAY = 3`. `grep -ri "shadow"` = 0.
Và `deploy/Caddyfile:36` khẳng định *"hạn mức theo người dùng và theo ngày lịch VN là việc của
Django"* — Django không làm; Caddyfile thì chưa bao giờ chạy. ⇒ hôm nay **một tài khoản đăng bao
nhiêu mạch tuỳ thích; một IP đăng ký 20 tài khoản mỗi phút** (mặc định allauth).

### L16 · VỪA · OG card của sub rỗng in "0 mạch"
**MỞ.** `apps/web/lib/og.ts:169` vô điều kiện, trong khi `lib/dinh-dang.ts:101` có sẵn
`dongSoMachSub` để tránh đúng chuyện đó (dùng ở trang sub và sidebar). Nguyên tắc 9 không có ngoại
lệ cho `so_mach` — ngoại lệ duy nhất đã chốt là điểm vote.

---

## Phase 3 — BÃO · follow · notification · trích · ISR

### L06 · NẶNG · Xoá/sửa bình luận KHÔNG làm mới cache ⇒ nội dung đã gỡ phục vụ công khai tới 1 giờ
**MỞ.** Hai agent độc lập cùng tìm ra. `api/api/binh_luan.py` không import `lam_moi_mach`.
Đường đi: khách xem trang mạch ⇒ bản ISR (`revalidate=3600`) vào data cache của Next → tác giả xoá
bình luận → hàng **biến khỏi Postgres** → tác giả đang đăng nhập nên đi nhánh `/m-phien/`
(force-dynamic) ⇒ **họ thấy nó đã mất và tin là xong** → khách vẫn nhận nguyên văn tới 60 phút.
Bằng chứng đây là **sót** chứ không phải chủ đích: mod ẩn bình luận **thì có** gọi
(`quan_tri_kiem_duyet.py:94`) — ranh giới "nội dung biến khỏi trang công khai" đã được công nhận là
sự kiện có signal; chỉ đường của **chính tác giả** là quên.
→ Gọi `lam_moi_mach` ở `xoa_binh_luan_api` **và** `sua_binh_luan_api`; sửa
`test_binh_luan_KHONG_goi_lam_moi` cho nó chỉ nói về `POST`; thêm 2 dòng vào bảng
`test_moi_su_kien_CO_SIGNAL_deu_goi_lam_moi`.

### L07 · NẶNG · `REVALIDATE_SECRET` không tới tiến trình Next ⇒ cache chết im lặng ở dev; clone sạch mất 42 bài đo
**MỞ.** Đo thật: `next start` **có** env → `POST /lam-moi-cache` 200. `pnpm web:dev` → **503**
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
→ `setup:env` sinh luôn `REVALIDATE_SECRET`, và truyền nó tới cả `pnpm web:dev`.

### L13 · VỪA · "Tác giả vẫn thấy nội dung kèm nhãn" (PLAN 5.2 + 5.10) chưa được CÀI
**MỞ.** `trinh_bay.py::moc_ra`/`nut_ra` che theo `doc_duoc(...)`, **không nhận người xem**. Tác giả
nhìn thấy đúng ô trống mà người lạ thấy.
Đang bị khai nhầm là *"chưa đo được, cần Mảng A"* (`test_api_quan_tri_kiem_duyet.py:10`, commit
`150224d`) — câu đó ngụ ý cơ chế đã có. Thực trạng: **chưa có gì để đo.**
Mâu thuẫn PLAN chưa ai ghi ra: `GET /machs/{id}` bị ép **không chứa gì per-user** (điều kiện của
ISR 8.4) nên vế này **không thể** cài trên cửa đó.
→ **Quyết định phiên chính:** cài qua `GET /machs/{id}/me` — đã per-user, đã `no-store`, đã chạy
trong trình duyệt. Trả thêm nội dung **của chính người gọi** đang bị ẩn/bia mộ; client vá vào ô
trống. ⚠ Chỉ trả nội dung user gọi **là tác giả** — trả nhầm của người khác là biến bản vá minh
bạch thành lỗ rò.

### L14 · VỪA · Digest: không ai bật được, link huỷ đăng ký 404
**MỞ.** `User.nhan_digest` mặc định `False`; `grep "nhan_digest"` trong `api/api/` và `apps/` = **0**
⇒ không endpoint, không form, không trang cài đặt. Thư có link `{goc_site}/cai-dat` — **thư mục
`apps/web/app/cai-dat` không tồn tại**.
Kèm: PLAN 5.8 và tiêu chí Phase 3 đòi **email mốc mới** cho follower;
`grep "send_mail\|EmailMultiAlternatives"` chỉ khớp `gui_digest.py`. Không ai khai.

### L21 · NHỎ · `TOGGLE-MAT-MOT-CHIEU` — hướng thiếu là hướng CHÍNH
**MỞ.** `grep "view=can"` (trừ e2e) = **0**; chỉ có `?view=bao`. PLAN 5.5 dựng toggle này với lý do
*"người nghiêm túc bật 'thuần' một lần rồi vĩnh viễn không thấy bình luận"* — tức hướng **BÃO →
CẶN**, đúng hướng đang thiếu. Nợ đã khai một dòng nhưng khai nhẹ hơn thực tế.

### L23 · NHỎ · Cửa `/lam-moi-cache` không có bài đo cho nhánh TỪ CHỐI
**MỞ.** `route.ts:41` — không test nào đòi "secret rỗng ⇒ 503" hay "secret sai ⇒ 401". Đảo một dấu
`!` là mở toang cửa mà không gì đỏ. So sánh `!==` không hằng-thời-gian (khó khai thác qua mạng, ghi
cho đủ).

### L26 · NHỎ · `bao_moc_moi` khoá nhiều hàng `core_user` không `ORDER BY`
**MỞ.** `core/thong_bao.py:120`. Hôm nay an toàn vì `FOR KEY SHARE` tương thích với chính nó; nếu
mai đường notification cần `select_for_update` trên `User` thì thành lỗi thật. `.order_by("user_id")`.

### L27 · NHỎ · `DanhDauDaDocIn.ids` không có `max_length`
**MỞ.** `schemas_ghi.py:185` → `pk__in` với danh sách 1 triệu phần tử. Cần đăng nhập nên abuse nhẹ.

### L34 · NHỎ · Docstring keyset chuông nói "khoá BẤT BIẾN", thực tế `created_at` bị bump
**MỞ.** `api/api/thong_bao.py:64` vs `core/thong_bao.py:107` (dedupe `moc_moi` cố ý bump). Hậu quả
vô hại; hai câu mâu thuẫn nhau và câu đầu là câu người sau sẽ tin.

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
**MỞ.** `ghi.py:790` (`xoa_binh_luan`), `ghi.py:761` (`sua_binh_luan` → `refresh_from_db`),
`cay_binh_luan.py:72` (`cap_phat_path`). Không có `exception_handler(ObjectDoesNotExist)` cho `api_v1`.
Ca: double-click Xoá · Trả lời đúng lúc bị xoá thật · Sửa song song Xoá. `Comment` là model **duy
nhất** có đường xoá cứng nên chỉ nó dính. → 409 `noi_dung_da_go`.

### L09 · VỪA · `dat_reaction` → HTTP 500 khi double-click
**MỞ.** `ghi.py:860`: `select_for_update().filter(user, moc).first()` — **không có hàng nào để
khoá** ⇒ hai transaction cùng `create()` ⇒ `IntegrityError` bay thẳng ra. Đường trích gặp đúng cuộc
đua này và đã xử 409; reaction thì không. → `update_or_create` hoặc bắt `IntegrityError`.

### L10 · VỪA · Đường trích quy MỌI `IntegrityError` về 409 "đã có trích khác" — nói dối
**MỞ.** `mocs.py:340`. FK của Django trên Postgres là `DEFERRABLE INITIALLY DEFERRED` (xác minh
bằng `\d core_trich`) nên FK nổ ở **COMMIT**. Ca: chủ mạch trích C đúng lúc tác giả C xoá thật C ⇒
chủ mạch nhận *"Mốc N vừa có một trích khác được ghi vào cùng lúc"* — hoàn toàn sai, đi tìm cái
trích không tồn tại. → phân biệt bằng `_la_va_cham(loi, "trich_mot_hieu_luc_moi_moc")` (`ghi.py:127`).

### L11 · VỪA · `HAN-MUC-KHONG-KHOA` — hạn mức 3 mốc/ngày đếm NGOÀI khoá
**MỞ.** `machs.py:466` đếm **trước** `atomic()` ở `:479`; `them_moc` mới `select_for_update` hàng
`Mach`. Double-click ⇒ cả hai đọc `2 < 3` ⇒ **4 mốc trong một ngày**, 201 cả hai lần, không log.
→ Chuyển phép đếm vào trong, sau `select_for_update`.

### L15 · VỪA · `CotVote` không xử nhịp `dangTai` ⇒ người ĐÃ đăng nhập nhận lý do SAI
**MỞ.** `cot-vote.tsx:87`. `usePhien()` trả `{toi: null, dangTai: true}` tới khi `/me` về; trong
khoảng đó mũi tên `disabled` + `title="Đăng nhập để vote"`. `Composer`, `NutTheoMach`,
`KhoiChuMach`, `HanhDongBinhLuan` đều xử `dangTai`; chỉ `CotVote` không — và chính file đó viết
*"lý do phải ĐÚNG: chưa đăng nhập ≠ mạch bị khoá"*.

### L17 · VỪA · `viet_binh_luan` không gọi `doi_con_song(parent)`
**MỞ.** `machs.py:540`. Reply được vào bình luận mod **vừa ẩn**; và reply mới làm bình luận bị ẩn
có `con_song = True` nên tác giả nó **vĩnh viễn không xoá thật được nữa**.

### L18 · VỪA · Ban KHÔNG chặn đăng nhập, nhưng tài liệu nói ngược lại
**MỞ.** Không có allauth adapter nào (`grep "ADAPTER" api/` rỗng). `dang_bi_ban()` chỉ được hỏi ở
`quyen.py::DangNhap` (cửa ghi) và `quan_tri.py::ChiMod`. Câu ở `quan_tri.py:70` và commit `86ea9c1`
— *"ban chỉ chặn được đường ĐĂNG NHẬP"* — **sai**. Cơ chế vẫn an toàn (ghi 403, moderate 403).

### L24 · NHỎ · `test_moi_operation_ghi_deu_co_auth` chỉ chạy trên `api_v1`
**MỞ.** `tests/test_quyen_ghi.py:41`. `api_admin` được che bằng bảng hành vi rất chắc, nhưng không
có hàng rào **cấu trúc** tương đương. django-ninja 1.6 chuyển kiểm CSRF vào lớp auth ⇒ quên `auth=`
là mất **cả xác thực lẫn CSRF** cùng lúc.

### L31 · NHỎ · `seed_dev --reset` để lại `Vote` mồ côi của người không phải seed
**MỞ.** `seed_dev.py:596` chỉ xoá `Vote` của user seed; `Mach.delete()` cascade xoá `Moc`/`Comment`
mà **người khác** đã vote. Đo thật: **14 hàng mồ côi**. Docstring `tuong_tac.py:36` nói *"chỗ đó đã
dọn `Vote` tay trước khi xoá"* — đúng một nửa. Rác, không sai số.

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
**MỞ.** Danh sách đầy đủ ở báo cáo phản biện trục sản phẩm. Gồm L03/L04/L05/L13/L18/L19 ở trên,
cộng: `deploy/Caddyfile:36` (*"hạn mức là việc của Django"*) · `revalidate.py:14` (nợ giả, xem L29) ·
commit `64b1a94` (*"cắm nguồn người nhận cho digest"* — cắm vào cờ không ai bật được) ·
`app/luat/page.tsx:47` (*"quy trình xử lý của quản trị viên thuộc giai đoạn sau"* — đã có) ·
commit `ab77957` (*"365 e2e"* — không tái lập được từ clone sạch, xem L07) ·
`cot-vote.tsx:48` (*"lý do phải ĐÚNG"* — xem L15).

### L25 · NHỎ · Hai bản của cùng một luật đã lệch nhau
**MỞ.** `type-admin.spec.ts:99` vẫn `\{([^{}]*)\}` một tầng ngoặc, bản web đã chuyển sang quét cân
bằng. Lệch theo chiều an toàn (admin báo vi phạm giả nếu ai thêm hằng lồng) nhưng là bẫy chờ sẵn.

### L28 · NHỎ · `settings.py:243` nói thư ra `api/sent_emails/`
**MỞ.** Thật ra `api/.mail/` (dòng 250). Thư đọc được từ đó.

### L29 · NHỎ · `revalidate.py:14-19` là NỢ GIẢ
**MỞ.** Còn cảnh báo *"chiều này CHƯA có tác dụng thật… `page.tsx` vẫn `force-dynamic`"*. Nợ
`ISR-BIEN-THE-ROUTE` **đã trả** ở `ab77957`; `page.tsx:31` nay là `revalidate = 3600`. Ai đọc file
này sẽ kết luận sai rằng cả cơ chế là no-op.

### L32 · NHỎ · `e2e/dung-seed.ts` ghi thẳng `hidden_at`, đi vòng qua `core/ghi.py`
**MỞ.** Luật "không một dòng nào ghi thẳng `hidden_at`" được viết ở `ghi.py:70` và
`quan_tri_kiem_duyet.py:3`. Hôm nay vô hại về số (đã đối soát). Nếu mai `dat_an_mach` phải kéo theo
một cột, đây là chỗ quên.

### L35 · NHỎ · `/luat` nói nửa sai
**MỞ.** `app/luat/page.tsx:47` — quy trình xử lý của quản trị viên **đã có**; chỉ nút báo cáo là
chưa (L03).

### L36 · NHỎ · Một lượt `pnpm e2e` flake 1/3, KHÔNG tái hiện
**MỞ (quan sát).** B2 báo bài *"mũi tên vote SỐNG"* đỏ 1 trong 3 lượt, chạy riêng file thì xanh.
Nghiệm thu chạy **3 lượt đầy đủ tuần tự: 365/365 cả ba**, không tái hiện. Nhưng 3 lượt xanh không
loại trừ được flake tần suất 1/3 (xác suất bỏ sót ≈ 30%). Nghi race giữa `/me` và cú bấm đầu tiên.

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

---

# C · CHƯA BAO GIỜ CHẠY THẬT

| Thứ | Trạng thái |
|---|---|
| **Caddy** | `deploy/Caddyfile` chưa qua `caddy validate`, chưa một request nào. Đòi bản dựng bằng `xcaddy --with caddy-ratelimit` — bản tiêu chuẩn **không khởi động được**. Xem L01. |
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
