# Search v2 — form xổ tại chỗ · gợi ý khi gõ · index bình luận · trộn kết quả · đối soát index

Chốt 2026-08-30, theo 4 quyết định user (AskUserQuestion):

1. **Suggest = mạch khớp** (5–7 mạch, bấm đi thẳng mạch) + dòng "Xem tất cả kết quả" ra `/tim-kiem`.
2. Suggest chạy ở **CẢ HAI** nơi: ô desktop giữa header và form xổ trên mobile — một component.
3. Trang `/tim-kiem`: kết quả mạch + bình luận **TRỘN CHUNG một danh sách** theo độ liên
   quan, mỗi dòng có nhãn loại.
4. **GỘP `P-20260827-2`** (index prod lệch DB im lặng) vào lượt này.

Cộng yêu cầu gốc: bấm icon kính lúp (mobile) → **form xổ ngay tại chỗ**; Enter / nút Tìm
mới ra trang kết quả; index thêm **bình luận** (nội dung mốc đã có trong index từ Phase 7).

Hiện trạng đã khảo sát (KHÔNG làm lại): Meili **v1.51** (`deploy/prod/compose.yml:39`,
federated `/multi-search` có từ v1.10) · `core/tim_kiem.py` (một hàm `dong_bo_mach`, hai
lớp lọc, chỉ trả ID) · `api/api/tim_kiem.py` (`_to_dam`/`_boc` tô đậm từ Postgres, xuống
thang `co_the_tim=false`) · `reindex_tim_kiem` (`--sach`, lô 500) ·
`deploy/prod/tao-khoa-meili.sh` (khoá hẹp CHỈ index `mach`).

## 0 · Ba chốt an toàn KẾ THỪA — áp cho mọi thứ mới, không bàn lại

1. **Trình duyệt không bao giờ gọi thẳng Meilisearch** (PLAN 8.5) — suggest đi qua Django.
2. **Meili chỉ trả ID + thứ hạng; mọi chữ hiện ra dựng lại từ Postgres qua lớp lọc thứ
   hai** — index lệch chỉ gây *thiếu dòng*, không bao giờ *rò nội dung đã ẩn*. Áp nguyên
   xi cho bình luận và cho suggest.
3. **Đường ghi nuốt lỗi + `on_commit`; đường đối soát ném** — như `dong_bo_mach`.

## 1 · Index `binh_luan` (mới, cùng cụm Meili)

Tài liệu: `{id, mach_id, body_thuan, author, created_at_ts, hien: true}`.
- `body_thuan` = `van_ban_thuan(body)` — cùng lý do ba-vế của `_than_theo_moc` (không đẩy
  HTML/markup thô vào index).
- `mach_id` vào `filterableAttributes` — để **xoá theo lô** khi mạch bị ẩn/xoá
  (`DELETE …/documents/delete` với `filter: mach_id = X`, có trong v1.51).
- KHÔNG đẩy `up/down/score` (cùng lý lẽ "vote là đường ghi dày nhất" của `TRUONG_SAP`).
- `typoTolerance` ghim y hệt index `mach` (mã ngắn khớp chính xác).

**Luật che của tài liệu bình luận** — một bình luận CHỈ nằm trong index khi:
`deleted_at IS NULL` (không bia mộ) **AND** `hidden_at IS NULL` (không bị mod ẩn)
**AND** `mach.hidden_at IS NULL` (mạch đang hiện). Vế thứ ba là vế dễ quên nhất — chính
là lý do plan Phase 7 né bình luận, và là chỗ bài đo phải dày nhất.

**Khoá Meili**: `MEILI_KEY` prod đang hẹp CHỈ `mach` ⇒ `tao-khoa-meili.sh` sửa thành
`indexes: ["mach", "binh_luan"]`; lúc deploy phải **sinh khoá mới + thay
`~/gikky-net/app/.env`** — thiếu bước này thì mọi lời gọi index bình luận trên prod ra
403 và bị đường ghi NUỐT im lặng (đúng kiểu P-20260827-2). Ghi thành bước deploy tường
minh ở §7, và `/chan-doan` (§6) phải nhìn thấy được ca này.

## 2 · Bề mặt ghi — `core/tim_kiem.py` mở rộng, giữ nguyên triết lý một-hàm

- `dong_bo_binh_luan(comment)` — MỘT hàm, tự đọc lại trạng thái (kể cả `mach.hidden_at`)
  rồi upsert/xoá. `on_commit`, nuốt lỗi + log.
- `dong_bo_binh_luan_theo_mach(mach_id)` — cascade khi mạch đổi trạng thái ẩn/xoá:
  mạch ẩn/mất ⇒ **delete-by-filter** `mach_id = X`; mạch hiện lại ⇒ đẩy lại theo LÔ mọi
  bình luận đọc được của mạch. Gọi từ đúng chỗ `_dong_bo_ngay` của mạch (sau khi nó quyết
  upsert hay xoá) — KHÔNG bắt từng đường ghi mạch phải nhớ thêm một lời gọi.
- Đường ghi bình luận phải gọi `dong_bo_binh_luan`: `ghi_binh_luan` (tạo) ·
  `sua_binh_luan:998` · `xoa_binh_luan:1025` (bia mộ) · `dat_an_binh_luan:1504` — cả
  4 trong `core/ghi.py`. Chuông cấu trúc: mở rộng `tests/test_tim_kiem_cau_truc.py` theo
  đúng khuôn bảng hiện có (mỗi đường ghi một dòng có tên, kể cả dòng "không đổi index"
  nếu có lý do).
- Vote bình luận: **không đổi index** — dòng có tên trong bảng cấu trúc.

## 3 · Đường đọc — trộn hai index bằng federated multi-search

`core/tim_kiem.py::tim` mở rộng (hoặc hàm mới `tim_tron`):
`POST /multi-search` với `federation: {}` — hai query (index `mach`, index `binh_luan`,
cùng `q`, cùng filter `hien = true`; `?sub=` chỉ áp cho query mạch — bình luận không mang
sub, chấp nhận: lọc sub thì kết quả bình luận vắng, ghi rõ trong docstring + UI không nói
dối). Mỗi hit mang `_federation.indexUid` ⇒ trả `[(loai, id)]` theo đúng thứ tự Meili
trộn. `?sort=moi`: federation KHÔNG hỗ trợ sort per-query ⇒ nhánh `sort=moi` tự trộn
bằng `created_at_ts` (hai search thường, merge k-way theo ts — tất định).

`api/api/tim_kiem.py`:
- Lớp lọc thứ hai cho bình luận: `Comment.objects.filter(pk__in=…, deleted_at__isnull=True,
  hidden_at__isnull=True, mach__hidden_at__isnull=True).select_related("mach__sub","author")`.
- Schema **breaking có chủ đích** (một consumer duy nhất là trang `/tim-kiem`):
  `TimKiemOut.items: list[KetQuaTronOut]` — `loai: Literal["mach","binh_luan"]`;
  `mach: MachTomTatOut` (cả hai loại — bình luận cần mạch ngữ cảnh);
  loại mạch: `title_to_dam`, `doan_trich` (như cũ);
  loại bình luận: `binh_luan_id`, `doan_trich` (tô đậm từ `body` Postgres, cùng
  `_to_dam`), `tac_gia`, `luc`. Đường nhảy client tự dựng: `/m/<slug>-<id>#cmt-<binh_luan_id>`.
- `tong` = tổng ước lượng của federation (`estimatedTotalHits`).

## 4 · Suggest — endpoint + client

**`GET /api/v1/tim-kiem/goi-y?q=`** (router `tim_kiem`, `operation_id="tim_kiem_goi_y"`,
`no-store`):
- CHỈ index `mach` (quyết định 1), `limit` CỐ ĐỊNH 7 (không nhận từ query — cùng lý lẽ
  `SO_TOP`), `q` cắt `DAI_Q_TOI_DA`, rỗng ⇒ items rỗng.
- Trả `list[GoiYOut]`: `{mach_id, title, sub_ten, duong_dan}` — **dựng từ Postgres lớp
  hai** (`_mach_hien_theo_id`), `duong_dan` dựng cùng hàm slug đang dùng ở feed
  (`mach_tom_tat_ra` đã có gì dùng nấy — không tự chế slug thứ hai).
- Meili chết ⇒ 200 `{items: [], co_the_tim: false}` — client giấu dropdown, không báo lỗi.

**Client** — sửa `apps/web/components/o-tim-kiem.tsx` (một component dùng cả hai nơi):
- Debounce **250ms**, huỷ request cũ (`AbortController`), chỉ gọi khi `q.trim().length >= 2`.
- Gọi THẲNG `timKiemGoiY({ baseUrl, … })` theo đúng khuôn client component sẵn có (xem
  `chuong.tsx`) — hàng rào `type-frontend.spec.ts` sẽ chấm.
- Dropdown: tối đa 7 mạch (`<Link>` tới mạch, hiện title + sub) + dòng cuối **"Xem tất cả
  kết quả cho 'q'"** → `/tim-kiem?q=`. A11y đúng khuôn combobox: `role="combobox"`
  + `aria-expanded` trên form, `role="listbox"`/`option` + `aria-activedescendant`,
  phím ↑ ↓ Enter Esc; Enter khi KHÔNG chọn gợi ý = submit như cũ (hành vi cũ giữ nguyên).
- Đóng khi blur/Esc/điều hướng. Không cache kết quả gợi ý (mỗi phiên gõ là mới).

## 5 · Form xổ trên mobile + trang kết quả + anchor

- `chrome.tsx`: icon kính lúp đổi từ `<Link>` thành component client mới
  `apps/web/components/tim-kiem-mobile.tsx` — button toggle (`aria-expanded`) mở một
  **panel xổ full-width ngay dưới header** chứa đúng `<OTimKiem/>` (autofocus khi mở,
  nút đóng, Esc đóng). Vẫn chỉ hiện ≤860px, cùng mốc, cùng luật một-khối-860.
  ⚠ **Hàng rào `loi-vao-tim-kiem.spec.ts` phải viết lại CÓ CHỦ ĐÍCH** (bài A đang ghim
  `<Link href="/tim-kiem"`): hành vi đổi theo yêu cầu user, không phải lách rào — bài
  mới ghim: chrome.tsx nhúng `tim-kiem-mobile`; component ấy render `OTimKiem` và có
  đường ra `/tim-kiem` (dòng "Xem tất cả"); ba mốc 860 vẫn một con số. Đánh đổi nói rõ:
  toggle cần JS ⇒ noscript mobile mất lối vào (form GET của OTimKiem vẫn là fallback
  noscript một khi panel mở được — mà noscript không mở được panel); chấp nhận, ghi docstring.
- `ket-qua-tim-kiem.tsx`: render danh sách trộn — dòng bình luận có nhãn "Bình luận",
  trích đoạn tô đậm (cùng cơ chế `[[…]]` qua `lib/tim-kiem.ts`), meta "của <tác giả>
  trong <tiêu đề mạch>", bấm → `/m/<slug>-<id>#cmt-<id>`.
- **Anchor**: component bình luận (`binh-luan.tsx`) thêm `id={"cmt-" + id}` trên phần tử
  gốc mỗi bình luận — hiện CHƯA có (đã grep). Kiểm chuyện nhảy tới bình luận nằm sâu
  trong cây trả lời: chỉ cần anchor + `scroll-margin-top` đủ né header sticky; KHÔNG làm
  auto-mở-nhánh-gập trong lượt này (ghi là giới hạn đã biết: bình luận nằm trong nhánh
  đã gập thì anchor không thấy — hàng gập đang là nợ P-20260830-8, đừng đào thêm ở đây).

## 6 · Đối soát index — trả `P-20260827-2` (user chốt GỘP)

1. **`reindex_tim_kiem` mở rộng**: (a) phủ CẢ index `binh_luan`; (b) sau khi đẩy đủ,
   **GỠ TÀI LIỆU MA** mặc định (không cần `--sach`): liệt kê id trong từng index
   (phân trang `GET …/documents?fields=id`), so với tập id công khai từ Postgres, DELETE
   phần thừa. Lệnh ném khi Meili hỏng (đường đối soát không nuốt). In số liệu:
   `đẩy X mạch + Y bình luận; gỡ Z ma`.
2. **Cron trên VPS**: thêm `reindex_tim_kiem` chạy đêm (sau `gom_luot_xem`, vd 03:40 VN)
   vào `deploy/prod/README.md` mục "Việc chạy theo lịch" — với đúng khuôn dòng crontab
   sẵn có + hậu quả nếu thiếu.
3. **`/chan-doan` (khu quản trị)**: thêm khối "Tìm kiếm": Meili sống? · số tài liệu từng
   index vs số hàng công khai tương ứng trong Postgres · **LỆCH thì nói to**. Đây là câu
   trả lời cho vế "lệch IM LẶNG". (Tìm endpoint chẩn đoán hiện có của trang
   `apps/admin/app/chan-doan/page.tsx` mà nối vào — đừng đẻ NinjaAPI mới.)

Sau lượt này `P-20260827-2` chuyển `ĐANG SỬA` → `ĐÓNG (<commit>)` ở chặng 5.

## 7 · Việc kéo theo + deploy

- `pnpm codegen` (schema mới + endpoint mới; client v1).
- PLAN.md mục 7: cập nhật dòng `GET /tim-kiem` (kết quả trộn) + thêm dòng
  `GET /tim-kiem/goi-y`.
- **Deploy (thứ tự BẮT BUỘC, ghi để lượt deploy làm đúng):** sửa + chạy
  `tao-khoa-meili.sh` trên VPS → thay `MEILI_KEY` trong `~/gikky-net/app/.env` → deploy
  code (archive/build/up) → `gk exec api python manage.py reindex_tim_kiem --sach`
  (dựng cả hai index) → thêm dòng crontab đối soát → kiểm `/chan-doan`.
- KHÔNG migration Postgres (không cột mới).

## 8 · Tiêu chí nghiệm thu — ĐO ĐƯỢC

Nền (đo 2026-08-30 sau lượt mobile-search): pytest **1782 thu / 1766 pass / 16 skip** ·
e2e don-vi **388 bài / 387 xanh** (1 đỏ có sẵn `#14`, `P-20260830-1`) · full e2e 556 bài /
554 xanh (2 đỏ có sẵn: `#14` + `A10`/`P-20260830-8`).
⚠ Nhóm `test_tim_kiem_that.py` cần Meili THẬT — opus-dev phải xác định máy dev có chạy
được Meili không (Docker không có trên dev; tìm binary/cách bộ bài ấy vẫn chạy tới nay).
KHÔNG chạy được thì các bài `_that` mới sẽ skip theo cùng cơ chế — **báo cáo phải nói số
skip tăng bao nhiêu** (L44 đã ghi bệnh skip im lặng, đừng lặp lại nó trong im lặng).

| # | Tiêu chí | Đo bằng |
|---|---|---|
| S1 | `pytest` xanh 100%, ≥ +35 bài mới; 0 warning | chạy lại, so nền |
| S2 | Ma trận che bình luận: bia mộ · mod ẩn cmt · mạch ẩn (cascade cả lô) · mạch hiện lại · sửa cmt cập nhật index — mỗi ca một bài, qua `dong_bo_binh_luan`/`theo_mach` | tên bài trong báo cáo |
| S3 | Chuông cấu trúc mở rộng: 4 đường ghi cmt có mặt trong bảng; thiếu một ⇒ đỏ (thử phá) | `test_tim_kiem_cau_truc.py` |
| S4 | `GET /tim-kiem/goi-y`: shape · limit ghim 7 · q rỗng ⇒ rỗng · Meili chết ⇒ 200 `co_the_tim=false` · mạch ẩn KHÔNG lọt (lớp 2) | nhóm bài mới |
| S5 | `GET /tim-kiem` trộn: hit bình luận của mạch ẩn rơi ở lớp 2 · thứ tự giữ nguyên thứ hạng · `sort=moi` trộn theo ts tất định · `?sub=` chỉ còn mạch (ghi nhận trong docstring) | nhóm bài mới |
| S6 | Reindex đối soát: dựng 2 index · GỠ MA cả hai (tài liệu trỏ mạch/cmt đã ẩn-xoá biến mất KHÔNG cần `--sach`) · idempotent | nhóm bài reindex |
| S7 | `/chan-doan` có khối Tìm kiếm: đủ số đếm 2 index + trạng thái lệch | bài đo + đọc trang |
| S8 | `pnpm codegen` + `codegen:check` sạch · `pnpm lint` 0 warning · `pnpm build` xanh 2 app | chạy lại |
| S9 | `pnpm e2e:don-vi` xanh (trừ #14): `loi-vao-tim-kiem.spec` viết lại theo hành vi mới, `type-frontend` chấm lời gọi mới | chạy lại |
| S10 | Kiểm mắt (chặng 5, browser): desktop gõ ≥2 ký tự ra dropdown ≤7 mạch + dòng Xem tất cả, ↑↓/Esc/Enter đúng; mobile bấm icon xổ form, gõ có suggest, Enter ra `/tim-kiem`; kết quả trộn có nhãn; bấm kết quả bình luận nhảy đúng anchor | phiên chính |
| S11 | Thử phá ≥5 (mục 9) | báo cáo |

## 9 · Thử phá bắt buộc

1. Gỡ lời gọi `dong_bo_binh_luan` khỏi MỘT đường ghi ⇒ chuông cấu trúc đỏ.
2. Bỏ vế `mach__hidden_at__isnull` ở lớp lọc 2 của bình luận ⇒ bài "cmt của mạch ẩn không lọt" đỏ.
3. Bỏ bước gỡ-ma của reindex ⇒ bài đối soát đỏ.
4. `goi-y` đổi limit theo query ⇒ bài "limit ghim 7" đỏ.
5. Suggest client bỏ debounce/abort (gọi mỗi keystroke tức thời) ⇒ bài đọc-nguồn tương ứng đỏ (nếu có hàng rào nguồn) HOẶC ghi rõ không rào được ở tầng nào.

## 10 · Ràng buộc tài nguyên

- opus-dev: toàn quyền lệnh (pytest/lint/build/e2e:don-vi/codegen); Meili local nếu dựng
  được thì dựng NGOÀI cổng 7700 bận? (7700 là danh sách cổng VPS — trên dev tự kiểm); KHÔNG
  dev server thường trực khi build; **KHÔNG `pnpm e2e` trần** (muốn chạy full thì
  `DATABASE_URL` trỏ `gikky_e2e` như tiền lệ 2026-08-30); KHÔNG commit; KHÔNG migrate
  `gikky_dev`; KHÔNG đụng 4 file phiên khác (`form-tai-khoan.*`, `ket-qua-tim-kiem.module.css`
  ⚠ file `.tsx` cùng tên THÌ ĐƯỢC sửa — chỉ file `.module.css` là của phiên khác,
  `the-mach.module.css`, `trang-mach.module.css`).
- nghiem-thu ∥ phan-bien như khuôn cũ: nghiem-thu độc quyền lệnh nặng; phan-bien chỉ đọc.

## 11 · KHÔNG làm

- Không highlight `_formatted` của Meili (chốt an toàn cũ giữ nguyên — tô đậm từ Postgres).
- Không `?sort=nhieu_diem`, không đẩy điểm vote vào index (nợ có tên cũ, giữ nguyên).
- Không lịch sử tìm kiếm, không lưu truy vấn của người dùng.
- Không auto-mở nhánh gập khi nhảy anchor (đụng nợ `P-20260830-8`, lượt riêng).
- Không search-as-you-type thay trang kết quả (kết quả đầy đủ vẫn chỉ hiện khi Enter/nút Tìm — đúng yêu cầu).

## 12 · Nhật ký

### opus-dev — 2026-08-30 (cây CHÍNH, không worktree)

**Số đo cuối** — pytest `1863 thu / 1837 pass / 26 skip / 0 fail / 0 warning`
(nền 1782/1766/16 ⇒ **+81 bài thu, +71 pass, +10 skip**) · e2e don-vi
`396 bài / 395 xanh` (1 đỏ CÓ SẴN `trang-loi.spec.ts` #14 — `/luat` vẫn khai
`force-dynamic`, `git diff` trên file ấy RỖNG nên không phải của lượt này) ·
`pnpm lint` 0 warning · `pnpm build` xanh 2 app · `pnpm codegen:check` khớp 34 file.

**Meili trên máy dev: KHÔNG chạy được.** `api/.env` không có `MEILI_URL`/`MEILI_KEY`,
không có binary `meilisearch` trên PATH, không có Docker (user chốt 2026-08-21). Nhóm
`test_tim_kiem_that.py` vì thế skip qua đúng cơ chế cũ (`_bo_qua_neu_khong_co_meili`), và
**16 skip nền chính là trọn file ấy**. Thêm 10 bài `_that` mới ⇒ skip đi từ 16 lên 26.
Mọi bài `_that` mới chưa từng chạy XANH ở đâu — chặng sau cần Meili thật để chấm chúng.

**Bù lại chỗ trống ấy:** dựng `tests/_meili_gia.py` — một Meilisearch giả **có trạng
thái** (kho tài liệu thật, thi hành đủ sáu thao tác `core/tim_kiem.py` dùng), thay ở tầng
`_goi`. Nhờ nó, lớp MỘT (tài liệu nào nằm trong index) được đo trên **mọi** máy: ma trận
che bình luận, cascade khi ẩn mạch, gỡ ma của reindex, và khối `/chan-doan` đều chạy
không cần Meili. Nó **không** thay `_that`: tiếng Việt, khoan dung lỗi gõ, và trộn
federated vẫn do Meilisearch quyết.

**Lệch plan — 3 chỗ, mỗi chỗ một lý do:**

1. **§5 anchor `#cmt-<id>`: KHÔNG làm, vì giả định của plan SAI.** Plan viết *"binh-luan.tsx
   thêm `id={"cmt-" + id}` — hiện CHƯA có (đã grep)"*. Thực tế **đã có**:
   `apps/web/lib/khan-dai.ts::neoBinhLuan` sinh `bl-<id>`, gắn ở `binh-luan.tsx:85`
   (`id={datNeo ? neoBinhLuan(nut.id) : undefined}`), dùng bởi chuông (`chuong.tsx:219`)
   và khối trích (`khoi-trich.tsx:72`); `scroll-margin-top` cũng đã có
   (`globals.css:206`, `:target`). Dựng thêm hệ neo `cmt-` là hai cách neo cho cùng một
   bình luận — hai chỗ để lệch nhau. Nên dòng kết quả bình luận dùng lại `neoBinhLuan`
   ⇒ `/m/<slug>-<id>#bl-<binh_luan_id>`.
2. **§4 a11y: `role="combobox"` đặt trên `<input>`, không trên `<form>`.** `<form>` đã
   mang `role="search"`; một phần tử chỉ có MỘT role, nên làm theo chữ của plan là **xoá
   mất** landmark tìm kiếm của cả trang. ARIA 1.2 cũng đặt combobox lên ô nhập.
3. **Đoạn trích bình luận đi qua `van_ban_thuan(body)`,** không phải `body` thô như plan
   viết: `Comment.body_dinh_dang` có thể là `html`, và chuỗi thô đẩy ra sẽ hiện nguyên
   `<p>` trên trang (React escape đúng luật ⇒ không có lỗ XSS, chỉ có rác). Cũng là chuỗi
   `core/tim_kiem.py` đẩy vào index, nên chỗ tô đậm so khớp trên đúng văn bản Meilisearch
   đã khớp. ⚠ **Nhánh MẠCH vẫn có bệnh ấy và lượt này KHÔNG sửa** — xem sổ.

**Việc phải làm thêm vì nó CHẶN (nói rõ theo luật):**

- `core/tim_kiem.py::_goi` — dời `urllib.request.Request(...)` vào trong `try`, và
  `suc_khoe()` trả `False` khi `_bat()` sai. `MEILI_URL` rỗng làm `Request()` ném
  `ValueError: unknown url type` **ngay lúc dựng**, ngoài mọi `except`; endpoint
  `/chan-doan` gọi `suc_khoe()` nên nó 500 trên clone sạch. Bệnh có sẵn, nhưng nó chặn
  đúng việc đang làm.
- `xoa_index()` tự nuốt 404. Với một index thì bắt ở người gọi là đúng; với hai thì lời
  gọi thứ hai ném 404 **sau khi** lời gọi thứ nhất đã xoá thật — tức `--sach` chết giữa
  chừng trên đúng lượt deploy đầu tiên của tính năng.
- `tests/test_hop_dong_openapi.py` bắt mọi endpoint **có tham số** phải khai hình dạng
  lỗi. `/tim-kiem/goi-y` có `q` ⇒ khai `400: LoiOut` (đi qua lưới `_validate` toàn cục),
  **không** nới `KHONG_CO_LOI_CLIENT` — nới hàng rào để code mình đi lọt là đúng thứ hàng
  rào tồn tại để chặn.
- `PLAN.md` bị một script Python ghi lại thành CRLF (Windows `write_text`), làm 10 bài
  `mau-token.spec.ts` đỏ vì neo của chúng chứa `\n`. Đã ghi lại bằng LF; đã kiểm CRLF = 0
  trên **mọi** file lượt này chạm.

**Thử phá — 5/5 ca, mỗi ca: bẻ → chạy → ĐỎ → khôi phục → XANH lại.**

| # | Bẻ gì | Bài ĐỎ |
|---|---|---|
| 1 | gỡ `dong_bo_binh_luan` khỏi `sua_binh_luan` | `test_tim_kiem_cau_truc.py::test_cua_ghi_PHAI_dong_bo_thi_co_goi_that[sua_binh_luan]` |
| 2 | bỏ `mach__hidden_at__isnull` ở `_binh_luan_hien_theo_id` | `test_tim_kiem.py::test_cmt_cua_mach_bi_an_khong_lot_qua_lop_hai` |
| 3 | `so_ma = 0` thay cho `self._go_ma()` | 4 bài `test_tim_kiem_reindex.py` (`test_go_TAI_LIEU_MA_…`, `test_go_ma_cua_mach_bi_an_…`, `test_go_ma_theo_LO_…`, `test_in_ra_ba_con_so`) |
| 4 | `goi-y` nhận `limit` từ query | `test_tim_kiem.py::test_goi_y_limit_GHIM_7_khong_nhan_tu_query` (`assert 50 == 7`) |
| 5 | gỡ `AbortController` khỏi `o-tim-kiem.tsx` | `e2e/don-vi/tim-kiem.spec.ts::gợi ý HUỶ request cũ` |

Ca 5 **có** hàng rào nguồn: nhóm 4 bài mới cuối `e2e/don-vi/tim-kiem.spec.ts` đọc
`components/o-tim-kiem.tsx` và ghim debounce 250 + `clearTimeout` + `AbortController` +
`signal` truyền xuống lời gọi + `cache: "no-store"` + ngưỡng 2 ký tự. Ba thứ ấy **biến
mất khỏi mọi bài đo hành vi** (một bài Playwright thấy kết quả cuối, không thấy đã bay đi
bao nhiêu request), nên đọc nguồn là tầng duy nhất rào được.

**Chưa xong / cần chặng sau:** S10 (kiểm mắt) là của phiên chính. Mọi bài `_that` mới
chưa chạy XANH lần nào — cần một Meilisearch thật. Deploy phải theo đúng thứ tự ở
`deploy/prod/README.md` mục *Bản 2026-08-30*: **khoá mới TRƯỚC code mới**.

### opus-dev — 2026-08-30 (lượt SỬA phản biện, cây CHÍNH)

Sửa 9 mục phản biện của bản vá này (không commit). **Số đo:** pytest
`1843 pass / 26 skip / 0 fail / 0 warning` (nền lượt trước 1837 pass ⇒ **+6 bài**) · e2e
don-vi `399 bài / 398 xanh` (nền 395 ⇒ **+3 bài**; 1 đỏ CÓ SẴN `#14`/`P-20260830-1`,
`git diff` trên `trang-loi.spec.ts` + `app/luat` RỖNG) · `pnpm codegen:check` khớp 34 file
(schema KHÔNG đổi) · `pnpm lint` 0 warning · `pnpm build` xanh 2 app.

| # | Sửa | Bài đo | Thử phá → ĐỎ |
|---|---|---|---|
| 1 NẶNG | `_boc` lọc rỗng SAU `_bo_dau` — token toàn dấu tổ hợp không còn `""`→vòng vô tận | `test_boc_token_toan_dau_to_hop_khong_treo` | bản cũ (lọc-trước) treo: subprocess 5s chèn 5M cặp `[[]]` không tiến → RED |
| 2 NẶNG | reindex `_go_ma` **xác nhận lại** Postgres NGAY trước khi xoá (`_xac_nhan_thua`) | `test_go_ma_KHONG_xoa_tai_lieu_dang_giua_hai_moc_chup` (dựng đua bằng monkeypatch `liet_ke_id`) | bỏ xác nhận ⇒ mạch đăng giữa reindex bị gỡ → RED |
| 3 NẶNG | `_xep_hang_id` (đổi tên sub) dùng nhánh `cascade=False`; `dong_bo_mach` giữ cascade | `test_doi_ten_sub_KHONG_dung_index_binh_luan` | cascade=True ⇒ đụng `/indexes/binh_luan` → RED |
| 4 VỪA | `useRef nguoiGo` + guard effect gợi ý; bật ở onChange, tắt ở effect đồng bộ URL | `tim-kiem.spec.ts` đọc-nguồn (ghim ref + guard) | bỏ guard → RED |
| 5 VỪA | `?sub=` ⇒ câu rỗng chỉ nói "mạch" + dòng "bộ lọc không áp cho bình luận" | `tim-kiem.spec.ts` đọc-nguồn `page.tsx` | xoá dòng → RED |
| 6 VỪA | `_than_hien_theo_mach` bọc `van_ban_thuan` — đoạn trích mạch hết HTML thô | `test_doan_trich_MACH_HTML_khong_lot_the` | body thô → `<` lọt → RED |
| 8 NHẸ | `/chan-doan` phân biệt 404 (index chưa dựng → reindex --sach) với 403 (khoá) | `test_index_CHUA_DUNG_ra_null_va_ghi_chu_reindex...` | bỏ nhánh 404 → RED |
| 9 NHẸ | `onBlur` + `relatedTarget` đóng dropdown khi Tab ra, không nuốt click option | `tim-kiem.spec.ts` đọc-nguồn | bỏ onBlur → RED |
| 11 NHẸ | `pagination.maxTotalHits = 2000` (`TRAN_PHAN_TRANG`) cho CẢ hai index | `test_cau_hinh_index_ghim_maxTotalHits_cho_ca_hai_index` | bỏ pagination → RED |

**#7 (đọc trộn federated) KHÔNG thêm bài mới:** `test_tim_kiem_tron.py` đã phủ trọn parse
`/multi-search` (`_federation.indexUid`, `estimatedTotalHits`, k-way merge `sort=moi`) bằng
phản hồi dựng tay qua `_goi`. Thêm `/multi-search` vào `_meili_gia` (search trả rỗng theo
thiết kế) sẽ trùng lặp mà không thêm phủ; xếp hạng federated thật vẫn cần Meili thật →
để chặng sau/prod chấm. Xem NGOÀI PHẠM VI.

### Chốt chặng 5 — phiên chính (2026-08-30)

Nghiệm thu 10/10 ĐẠT (số trùng khít). Phản biện 12 phát hiện — sửa 9 (thử phá 9/9 ĐỎ đúng
bài), ghi sổ 3. Các sửa NẶNG: #1 `_boc` lọc rỗng SAU `_bo_dau` (chống treo/OOM); #2
`_xac_nhan_thua` xác nhận lại Postgres trước khi xoá (chống reindex gỡ nhầm bài mới đăng —
đúng loài P-20260827-2); #3 cờ `cascade`, đường đổi-tên-sub `cascade=False`. VỪA: #4 ref
đã-gõ; #5 câu rỗng theo sub; #6 `van_ban_thuan` nhánh mạch. NHẸ: #8 phân biệt 404/403; #9
onBlur; #11 `maxTotalHits=2000`. Ghi sổ: P-20260830-9/-10/-11; P-20260827-2 → ĐANG SỬA.

Số đo cuối (dev): pytest 1843 pass/26 skip/0 fail/0 warning · e2e don-vi 399/398 (1 đỏ #14
có sẵn) · codegen khớp · lint 0 · build xanh 2 app. ⚠ 26 skip = tầng "gõ gì ra gì" +
federated thật CHƯA chạy (dev không Meili) — đóng bằng truy vấn thật trên prod sau deploy.
