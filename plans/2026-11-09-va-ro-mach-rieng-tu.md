# Plan — Vá rò mạch riêng tư (sổ `P-20261109-3`)

> **2026-11-09.** Sinh từ `LOI-VA-NO.md` `P-20261109-3` và việc 1 của `GHI-CHU.md`.
> **Nền (đo lúc lập plan):** `HEAD` = `6aaedde` (= `origin/main`; sau đó `main` tiến lên `748f95f`, một commit chỉ chạm `apps/web`, nên nền `api/` vẫn đúng) · `pytest --collect-only` = **2197 test** ·
> không file nào dưới `api/` đang sửa dở. Agent nhận việc phải kiểm lại ba điều này **trước khi làm**, theo mục
> "Worktree có thể đứng ở commit cũ" của `CLAUDE.md`. Hash đúng mà nội dung thiếu thì vẫn dừng: nêu đích danh
> `core/rieng_tu.py` **chưa tồn tại**, còn `Mach.rieng_tu` (`api/core/models/dien_dan.py:178`) và
> `core/ghi.py::cong_khai_mach` (:1325) **đã tồn tại**.
>
> **Chặn plan bot** (việc 1 của `GHI-CHU.md`: cho Bot Trader vào lệnh riêng tư, đóng sổ mới công khai).
> Chưa vá thì lệnh đang mở lọt ra ngoài ở lần nối mốc đầu tiên.

---

## 1. Vì sao

Mạch riêng tư (`Mach.rieng_tu`, commit `14cbac1`, 2026-09-08) chỉ được chặn ở các cửa **ĐỌC**. Mọi cửa khác nạp
mạch theo id chỉ lọc `hidden_at`. Đây đúng là loại lỗi `core/doc_noi_dung.py` đã cảnh báo ở đầu file: *luật rải
mà không ai đếm thì đường thứ tư quên điều kiện thứ năm*. Id mạch là số nguyên liên tiếp nên người đã đăng nhập
dò được.

**Bằng chứng: đọc code, CHƯA dựng lại bằng test hay trên prod.** Việc dựng lại chính là một phần của plan.

| # | Đường rò | Chỗ | Hậu quả |
|---|---|---|---|
| 1 | Chỉ mục tìm kiếm | `core/tim_kiem.py:418` (`hien_cong_khai` không kiểm `rieng_tu`); mọi lời gọi `dong_bo_mach`: `core/ghi.py:505` (nối mốc), `:1302` (đóng sổ), `:1321`, `:975`, `:1005`… | mạch riêng tư bị đẩy vào Meilisearch ngay khi nối mốc hoặc đóng sổ |
| 2 | Lớp lọc thứ hai của tìm kiếm | `api/tim_kiem.py:185–187` (`_mach_hien_theo_id`), `:212–216` (`_binh_luan_hien_theo_id`); chỉ mục bình luận `core/tim_kiem.py:451–464` | kể cả khi chỉ mục bẩn, lớp này cũng không chặn |
| 3 | **Theo dõi** | `api/theo_doi.py:295` (`theo_mach`), `:264` (`danh_dau_da_xem`), `:327` | người lạ theo dõi được mạch riêng tư, rồi `bao_moc_moi` gửi họ payload `{mach_id, mach_title, mach_slug}` (`core/thong_bao.py:122–124`) mỗi lần nối mốc. **Tiêu đề lệnh của bot chứa đủ Entry/SL/TP** |
| 4 | Bình luận | `api/machs.py:789` | người lạ thả bình luận vào nhật ký riêng |
| 5 | Vote | `api/tuong_tac.py:68`, `:74` | người lạ vote mốc và bình luận trong mạch riêng tư |
| 6 | Reaction | `api/tuong_tac.py:127` (`nap_moc`) | như trên |
| 7 | Báo cáo | `api/bao_cao.py:49–59` | như trên |
| 8 | Cửa chỉ-tác-giả | mọi chỗ gọi `nap_mach` / `nap_moc` (`api/ghi_chung.py:25`, `:41`) | người lạ nhận **403** thay vì **404** ⇒ dò ra id nào là mạch riêng tư |
| 9 | Danh sách cá nhân | `api/ho_so.py:83–96` (`_mach_hien()`, dùng cho `/me/da-vote`, `/me/dang-theo`) | mạch riêng tư của người khác hiện trong danh sách của người đã vote/theo dõi nó |

> ⚠ **Đính chính việc 1 của `GHI-CHU.md`:** bản ghi trước nói "thông báo lúc nối mốc không rò vì
> `theo_doi.py:186` chặn theo dõi mạch riêng tư". **Sai.** Dòng 186 chỉ nằm trong `_mach_hien` của cửa `GET
> /machs/{id}/me`; cửa `POST /machs/{id}/follow` đi qua `nap_mach` và không có rào.

## 2. Mục tiêu và phạm vi

**Mục tiêu:** người **không phải tác giả và không phải staff** không thể xem, tìm, theo dõi, nhận thông báo,
vote, react, bình luận, báo cáo, hay **dò sự tồn tại** của một mạch riêng tư. Mọi cửa trả đúng một thứ:
**404 `khong_tim_thay`**, cùng mã với "không có mạch này".

**Ngoài phạm vi — chỉ ghi lại, KHÔNG làm** (subagent nêu trong mục `## NGOÀI PHẠM VI` của báo cáo):

- Gộp các bản sao cũ của luật `rieng_tu` / `hidden_at` ở `feeds.py`, `machs.py`, `mocs.py`, `users.py`,
  `theo_doi.py`. Chỉ **thêm** rào cho cửa còn thiếu. Gộp là một việc riêng.
- `archived_at` bị bỏ sót cùng kiểu, ở `nap_*` và ở lớp lọc thứ hai của tìm kiếm: sổ `P-20261109-4` (đã nâng
  lên VỪA). Viết vị từ D1 sao cho thêm `archived_at` sau này chỉ là sửa **một** chỗ, nhưng lượt này **không** thêm.
- Đổi luật `luu-tru` theo quyết định "công khai là một chiều" (việc 7 của `GHI-CHU.md`): **plan riêng**, chưa lập.
  Plan này coi `luu-tru` là cửa chỉ-tác-giả như hiện tại; khi luật đó đổi thì bảng cửa ở mục 4 và bài đo phải cập nhật.
- Bot Trader dùng `rieng_tu` và dọn file trạng thái khỏi repo public ("Bước 0"): plan riêng, **sau** plan này.
- `dem_luot_xem.py:486` đếm lượt xem mạch riêng tư: không rò nội dung, để nguyên.
- Giao diện (TypeScript): không đổi. Trang chi tiết đã tách biến thể có cookie (`/m-phien/…`) khỏi bản ISR, nên
  chỉ **kiểm**, không sửa.
- Không migration, không đổi `settings.py`.

## 3. Thiết kế đã chốt

**D1 — Một vị từ duy nhất.** File mới `api/core/rieng_tu.py`:

- `mach_xem_duoc(mach, user) -> bool`: `False` khi `mach.rieng_tu` và `user` không phải tác giả, không phải
  staff. Người dùng ẩn danh coi như không phải cả hai.
- `loc_xem_duoc(qs, user, *, tien_to="")`: dùng cho danh sách có người xem. Staff: không lọc. Người khác:
  `Q(rieng_tu=False) | Q(author=user)`, ẩn danh thì chỉ `rieng_tu=False`. `tien_to` cho quan hệ như `"mach__"`.
- `loc_cong_khai(qs, *, tien_to="")`: dùng cho chỉ mục và tìm kiếm — **không có người xem**, luôn
  `rieng_tu=False`.

Chỗ nào chưa có điều kiện này thì gọi hàm, **không tự viết điều kiện mới**.

**D2 — Mã lỗi.** 404 `khong_tim_thay`, không bao giờ 403: một cửa trả 403 cho người lạ là một cái dò id.

**D3 — `nap_mach` / `nap_moc` / `nap_binh_luan`** (`api/api/ghi_chung.py`) nhận `user` **bắt buộc**, đặt tên,
không có mặc định, và áp D1. Quên truyền là `TypeError` lúc chạy test chứ không im lặng. Các cửa chỉ-tác-giả giữ
`doi_chu_so_huu` **sau** bước nạp. ⚠ `machs.py:480` và `mocs.py:130` gọi một hàm **cùng tên `nap_binh_luan` nhưng
khác nghĩa** (dựng cây bình luận của mạch): đừng đụng.

**D4 — Cửa không đi qua `nap_*`:** `tuong_tac.py` (votes) và `bao_cao.py` dùng D1 ngay chỗ tải đích;
`ho_so._mach_hien()` dùng `loc_xem_duoc` với người xem hiện tại.

**D5 — Thông báo là lớp thứ hai.** `Follow` đã có từ **trước** bản vá sẽ còn nguyên, nên rào cửa theo dõi không
đủ. Mọi hàm `bao_*` gửi tới người **không phải tác giả** phải trả `0` khi `mach.rieng_tu`. Dev liệt kê đủ bảy
hàm — `bao_moc_moi`, `bao_duoc_trich`, `bao_reply`, `bao_theo_mach`, `bao_theo_user`, `bao_binh_luan`,
`bao_mach_moi` — và ghi cho mỗi hàm: gửi cho ai, có cần rào không, vì sao. Riêng `bao_moc_moi` và `bao_mach_moi`
chắc chắn cần. `cong_khai_mach_api` (`machs.py:911–919`) lật cờ **trước** khi gọi `bao_mach_moi`, nên rào trong
hàm không cản được lời gọi lúc công khai.

**D6 — Tìm kiếm.** `hien_cong_khai` và `hien_cong_khai_binh_luan` thêm vế `rieng_tu`; `_mach_hien_theo_id` và
`_binh_luan_hien_theo_id` dùng `loc_cong_khai`. `tao_mach` vẫn bỏ `dong_bo_mach` cho mạch riêng tư (tối ưu),
nhưng đó **không còn là rào**. Lệnh dựng lại chỉ mục (`reindex_tim_kiem`): dev đọc và **chứng minh** nó đi qua
`hien_cong_khai`; nếu không thì sửa.

**D7 — Công khai.** `cong_khai_mach` vẫn gọi `dong_bo_mach` (đã có): sau khi mở, mạch phải vào chỉ mục. Có test.

## 4. Bảng cửa (nền của bài đo cấu trúc)

Đây là **nền**, không phải bản đủ: dev phải dựng bảng thật bằng cách **đọc router**, rồi đối chiếu với bảng này.

| Nhóm | Cửa | Hiện trạng |
|---|---|---|
| ĐỌC, đã chặn | `GET /machs/{id}` · `GET /machs/{id}/comments` · `GET /mocs/{id}/comments` · `GET /mocs/{id}/revisions` · `GET /machs/{id}/me` | có test hồi quy hoặc thêm |
| DANH SÁCH, đã chặn | `/feeds/moi` · `/feeds/dang-dien-ra` · `/subs/{slug}` · `/users/{username}` · `/users/{username}/machs` | |
| DANH SÁCH, thiếu | `/me/da-vote` · `/me/dang-theo` (và mọi chỗ dùng `ho_so._mach_hien`) | #9 |
| TÌM KIẾM | `/tim-kiem` · `/tim-kiem/goi-y` | #1, #2 |
| GHI, thiếu rào | `POST /machs/{id}/comments` · `POST /machs/{id}/follow` · `DELETE …/follow` · `POST …/seen` · `POST /votes` · `POST /mocs/{id}/reactions` · `POST /reports` | #3–#7 |
| CHỈ-TÁC-GIẢ (403 → 404) | `POST /machs/{id}/mocs` · `…/close` · `…/reopen` · `…/luu-tru` · `…/tat-binh-luan` · `…/cong-khai` · `PATCH`/`DELETE /mocs/{id}` · `POST`/`DELETE /mocs/{id}/trich` · `POST /mocs/{id}/anh` · `DELETE /anh/{id}` | #8 |
| BÌNH LUẬN | `PATCH`/`DELETE /comments/{id}` · `PATCH /comments/{id}/an` | qua `nap_binh_luan` |
| Staff | `/mod/…` · `/admin/…` | ngoài phạm vi; staff xem được mạch riêng tư |

## 5. Các bước (chặng 2 — `opus-dev`)

- **B0 — Kiểm nền.** `git log --oneline -1` so với `main`, `pytest --collect-only` phải ra **2197**, và các file
  nêu ở đầu plan tồn tại đúng như mô tả. Lệch thì **DỪNG và báo**.
- **B1 — Dựng lại lỗi.** Viết test đỏ cho từng dòng #1–#9 **trước khi vá**. Đỏ vì đúng lý do (người lạ nhận
  200/201 hoặc thông báo/hit tìm kiếm xuất hiện), không đỏ vì lỗi cú pháp. Ghi rõ dòng nào **không dựng lại được**.
- **B2 — Vị từ** `core/rieng_tu.py` + test đơn vị (tác giả / staff / người lạ / ẩn danh × riêng tư / công khai).
- **B3 — `nap_*`** nhận `user`; sửa **mọi** chỗ gọi (liệt kê bằng `grep`, đừng tin danh sách trong plan).
- **B4 — Cửa không qua `nap_*`:** votes, reports, `ho_so._mach_hien`.
- **B5 — Thông báo:** rào lớp hai theo D5, kèm bảng bảy hàm.
- **B6 — Tìm kiếm:** theo D6, kèm kiểm `reindex_tim_kiem`.
- **B7 — Bài đo cấu trúc:** dò router → mọi cửa có tham số id mạch / mốc / bình luận / ảnh (và `/votes`, `/reports`
  mang id trong thân) phải có mặt trong bảng phân loại; thêm cửa mới mà chưa phân loại thì **đỏ**. Mẫu: cách
  `test_tim_kiem_cau_truc.py::test_moi_ham_ghi_deu_duoc_phan_loai` đi qua AST, và
  `test_moi_operation_ghi_deu_co_auth` đi qua danh sách operation.
- **B8 — Hồi quy mạch công khai:** người lạ vẫn theo dõi / vote / bình luận / react / báo cáo bình thường trên
  mạch công khai.

Quy ước repo cần nhớ: `pytest` chạy `filterwarnings=error`; không dùng `pnpm e2e` trần (ghi vào `gikky_dev`);
chỉ `pnpm e2e:don-vi` an toàn. Lỗi trả qua `LoiGhi` như các cửa hiện có.

## 6. Tiêu chí nghiệm thu — ĐO ĐƯỢC

- **A1 · Nền.** `pnpm test` xanh toàn bộ; số test sau = 2197 + số test mới, **không test cũ nào bị xoá hay sửa
  cho xanh**. Số test bị `skip` không tăng (xem mục sổ `L44`: tìm kiếm skip im lặng khi thiếu Meilisearch).
- **A2 · Mỗi cửa trong bảng.** Với mạch riêng tư: khách ẩn danh **và** người đăng nhập không phải tác giả đều nhận
  **đúng 404 `khong_tim_thay`** (không 200, 201, 403); tác giả nhận kết quả bình thường; staff đọc được.
- **A3 · Chống dò.** Mã lỗi, thân lỗi và **hình dạng** response của "mạch riêng tư" và "id không tồn tại" giống
  nhau ở mọi cửa A2.
- **A4 · Thông báo.** Dựng sẵn một `Follow` của người lạ **bằng ORM** (mô phỏng dữ liệu cũ). Tác giả nối mốc ⇒
  `Notification` của người lạ **không tăng**. Sau `POST …/cong-khai` ⇒ người theo dõi tác giả **có** nhận
  thông báo mạch mới (đường công khai không bị rào nhầm).
- **A5 · Tìm kiếm, không phụ thuộc Meilisearch thật.** Monkeypatch tầng gọi Meili. (a) Sau `them_moc` và
  `dong_so` trên mạch riêng tư, các lời gọi bắt được có `DELETE` cho id đó và **không** có `PUT` nào chứa id đó.
  (b) Giả lập chỉ mục **bẩn**, trả hit cho mạch riêng tư và cho bình luận của nó: response `/tim-kiem` vẫn **không**
  chứa chúng. (c) Sau `cong-khai` có `PUT`.
- **A6 · Bài đo cấu trúc (B7)** đỏ khi thêm một route giả có `{mach_id}` mà chưa phân loại — chứng minh bằng một
  test thử, không chỉ nói. Bảng có **≥ 27 cửa theo id** (25 route có id trên đường dẫn, không tính `mod` và `quan_tri`, cộng `/votes` và `/reports`)
  và test chống rỗng `assert len(cua) >= 27`; dev đếm lại bằng router và **ghi con số thật** vào báo cáo.
- **A7 · Bài đo đỏ khi bỏ rào.** Với từng rào dưới đây, bỏ riêng nó đi thì ít nhất một bài đo ở A2–A5 đỏ:
  `nap_*`, rào votes, rào reports, `bao_moc_moi`, `hien_cong_khai`, `_mach_hien_theo_id`, `ho_so._mach_hien`.
  Chặng nghiệm thu **tự thử** từng cái và dán kết quả.
- **A8 · Không đổi hợp đồng.** `pnpm codegen:check` sạch (không drift). `pnpm e2e:don-vi`: số bài **bằng** trước
  khi làm và không đỏ mới.
- **A9 · Phạm vi.** `git diff --stat` chỉ chạm file trong danh sách: `api/core/rieng_tu.py` (mới),
  `api/api/ghi_chung.py`, các file router có gọi `nap_*`, `api/api/tuong_tac.py`, `api/api/bao_cao.py`,
  `api/api/ho_so.py`, `api/core/thong_bao.py`, `api/core/tim_kiem.py`, `api/api/tim_kiem.py`, test mới. File khác
  chạm vào thì phải giải thích trong báo cáo.

## 7. Chặng 3 và 4

- **Nghiệm thu** (`nghiem-thu`): chạy lại mọi lệnh, chấm A1–A9, **tự làm A7** (bỏ từng rào rồi khôi phục, dán
  kết quả).
- **Phản biện** (`phan-bien`): giả định bản vá còn sót. Tìm **cửa thứ N+1 ngoài bảng**: gallery ảnh
  (`/mocs/{id}/anh`, URL `MocAnh` / `AnhNoiDung`, sổ `P-20260903-8` còn mở), `core/revalidate`, OG card, sitemap và
  RSS (đi qua feed công khai, cần kiểm lại bằng chứng), `export_openapi`, các cửa nằm ngoài `api/api/` (ví dụ
  `quan_tri_*`, khu `mod`). Kiểm cả: vá xong thì **tác giả** còn dùng mạch riêng tư bình thường không (xem, nối
  mốc, đóng sổ, công khai)?

## 8. Ngoài code — việc của user, không agent nào làm

- **Hỏi phiên khác trước khi deploy** (nhiều phiên dùng chung checkout; xem ghi nhớ `gikky-net-nhieu-phien-chung-checkout`).
- Sau khi deploy: chạy `reindex_tim_kiem` trên prod để **gỡ** những mạch riêng tư đã lọt vào chỉ mục từ trước.
- **Đo xem lỗi đã bị khai thác chưa** (chạy bằng `psql` trên prod; tên bảng theo mặc định Django, kiểm lại trước khi chạy):

```sql
-- Người lạ đang theo dõi mạch riêng tư
SELECT f.mach_id, f.user_id
FROM core_follow f JOIN core_mach m ON m.id = f.mach_id
WHERE m.rieng_tu AND f.user_id <> m.author_id;

-- Thông báo đã mang tiêu đề mạch riêng tư tới người khác
SELECT n.user_id, n.payload->>'mach_id' AS mach_id
FROM core_notification n
JOIN core_mach m ON m.id = (n.payload->>'mach_id')::int
WHERE m.rieng_tu AND n.user_id <> m.author_id;

-- Bình luận của người lạ trong mạch riêng tư
SELECT c.id, c.mach_id, c.author_id
FROM core_comment c JOIN core_mach m ON m.id = c.mach_id
WHERE m.rieng_tu AND c.author_id <> m.author_id;
```

  Cả ba rỗng thì lỗi chưa bị khai thác (kể cả khi prod chưa có mạch riêng tư nào, vì chưa ai biết).

## 9. Rủi ro

- Đổi chữ ký `nap_*` chạm ~20 chỗ trong 6 file: dễ xung đột nếu phiên khác sửa cùng file. Kiểm `git status`
  trước khi làm; commit theo pathspec.
- Dò router tự động có thể bỏ sót cửa mang id trong **thân** request (`/votes`, `/reports`): bảng ở mục 4 liệt kê
  tay hai cửa này, bài đo B7 phải giữ chúng.
- Test tìm kiếm **không được skip** khi thiếu Meilisearch: dùng monkeypatch, không dùng Meili thật.
- Rào ở `bao_moc_moi` làm người theo dõi cũ **ngừng nhận** chuông cho mạch còn riêng tư. Đó là hành vi mong muốn.
  Khi tác giả công khai, họ nhận thông báo mạch mới qua `bao_mach_moi`.

---

## 10. Kết quả thực thi (ghi 2026-11-09, chặng 5)

**Đã chạy đủ 5 chặng:** `opus-dev` vá → `nghiem-thu` (ĐẠT 8/9, A6 một phần) → `phan-bien` (8 phát hiện) → **vòng sửa V1–V7** → `nghiem-thu` lần hai (**ĐẠT 9/9, 7/7**). Phản biện chạy **một lần**, trước vòng sửa, không chạy lại sau nó.

**Số đo** (bản `HEAD 748f95f` sạch dựng bằng `git worktree`, DB test cô lập): `collect` 2197 → **2406**; tập test đỏ **trùng khít** `HEAD` (đúng 17 test có sẵn, xem sổ `P-20261109-7`, `-8`); skip 26 không đổi; `pnpm codegen:check` khớp 34 file; `pnpm e2e:don-vi` 559 xanh; bỏ riêng từng rào trong 16 rào đều làm bài đo đỏ; cây làm việc chính không bị đụng (sha256 23/23 khớp).

**Chỗ lệch plan, đã được nghiệm thu xem xét:**

- **A1:** `tests/test_trading_features.py::test_cong_khai_mach_rieng_tu` bị sửa 403 → 404. Đúng D2 và mục 1; nghiệm thu chạy bản cũ của test trên bản vá và thấy nó đỏ đúng dòng đó.
- **A9:** file ngoài danh sách gốc nhưng phục vụ vòng sửa hoặc D6: `core/digest.py` (V5), `core/ghi.py` (V2), `api/users.py` (V6), `core/management/commands/reindex_tim_kiem.py` (D6), `api/anh.py`, `api/binh_luan.py`. Cây làm việc có **17 file sửa + 6 file mới**.
- **D5 đổi quy tắc:** "người nhận duy nhất có thể là tác giả" thành **"người nhận phải xem được mạch"** (tác giả hoặc staff) ở `bao_moc_moi`, `bao_binh_luan`, `bao_duoc_trich`, `bao_reply`; `bao_mach_moi` vẫn trả 0 cho mạch riêng tư.
- **V2:** `cong_khai_mach` dời `published_at = now` **và** gọi `cap_nhat_dem_mach` (feed Mới sắp theo cột dẫn xuất `last_content_at`). **Không** đụng `lan_dau_len_song`/`created_at`; nghiệm thu chứng minh cửa sổ sửa im lặng không mở lại bằng cả `PATCH` thật lẫn thử phá.
- Bảng cửa: **27 cửa** (25 route có id trên đường dẫn + `/votes` + `/reports`), đúng bảng mục 4. Bài đo cấu trúc nay dò theo OpenAPI thật, nên bắt cả `{anh_id}` không converter và id trong query.

**Chưa làm — việc của user hoặc cần phép:**

1. **Commit.** Bản vá còn nằm trong cây làm việc chung với nhiều phiên khác; commit theo pathspec (23 file), không `git add -A`.
2. **Deploy** (hỏi phiên khác trước), rồi **`reindex_tim_kiem` trên prod** để gỡ mạch riêng tư đã lọt chỉ mục.
3. **Ba câu SQL ở mục 8** để biết lỗi đã bị khai thác chưa. Chưa chạy nên **chưa biết**.
4. Bài đo A4/A5 dùng `MeiliGia`, **chưa** thử với Meilisearch thật.
5. `pnpm e2e` đầy đủ **chưa chạy** (chiếm cổng 3000/8000 và ghi DB).

**Việc ngoài plan, đã vào sổ:** `P-20261109-4` (`archived_at`), `-6` (thông báo cũ), `-7` (12 test đỏ có sẵn), `-8` (N+1 `core_cauhinhbientap` ở cây bình luận), `-9` (các dư thừa nhỏ).
