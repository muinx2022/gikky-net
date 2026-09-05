# Hẹn giờ — hoàn thiện admin + web + bot + cron

**Trạng thái:** code xong T1–T8 (2026-09-04). T9 (trình duyệt + session mod) chưa chạy —
plan để chặng 5, không dựng dev server trong lượt thực thi.

Chốt 2026-09-04. User: *"bạn lên plan để làm tất cả từ admin tới front đi"* — sau lượt
xem lại cặp `created_at` / `published_at`. Backend ghi (cột, constraint, hai cửa admin
API, cron command, feed Mới, schema) **đã có** trong cây, bám
`plans/2026-09-03-hen-gio-phat-hanh.md`. Lượt này **không viết lại** phần đó; làm nốt
mọi mặt người dùng nhìn thấy, cộng ba lỗ ghi còn sót mà lượt xem lại bắt được.

Nền: plan 2026-09-03 §3–§4 + tiêu chí #16–#19; cộng các chỗ lệch nêu ở phiên xem lại.

## 0. Đã có, không làm lại

| Cái | Ở đâu |
|---|---|
| `Mach.published_at` + `CheckConstraint` + index | `0027_mach_published_at.py`, `dien_dan.py` |
| `tao_mach(..., published_at=)` · `hen_gio_mach` · `phat_hanh_mach` | `core/ghi.py` |
| `POST /admin/machs/hen-gio` · `PATCH /admin/machs/{id}/hen-gio` | `quan_tri_hen_gio.py` |
| `GET /admin/machs?trang_thai=hen_gio` (sắp `published_at` tăng) | `quan_tri_bang.py` |
| Feed Mới + `?khoang=` theo `published_at` | `feeds.py` |
| Schema đọc có cả hai cột · codegen admin/công khai | `schemas.py`, `quan_tri_schemas.py`, `packages/api-client` |
| `manage.py phat_hanh_da_hen` | `core/management/commands/` |
| pytest #2–#15 | `tests/test_hen_gio_phat_hanh.py` |

`POST /api/v1/machs` **vẫn không nhận** `published_at`. Không thêm vào form đăng bài
công khai.

## 1. Ba lỗ ghi còn sót — làm trước UI, vì UI dựa vào chúng

### 1.1 `POST /admin/machs/hen-gio` thiếu `tu_upvote`

`POST /api/v1/machs` gọi `tu_upvote(target=moc)` (PLAN 5.7: tác giả +1 phiếu của chính
mình). Cửa hẹn giờ (`quan_tri_hen_gio.py::tao_mach_hen_gio`) không gọi. Bài đội lên sóng
với điểm 0.

Sửa: trong `atomic()` sau `tao_mach`, gọi `tu_upvote(target=_moc)` — cùng chỗ, cùng lý
do với cửa v1. Bài hẹn đang ẩn nên điểm ấy không lộ ra feed cho tới lúc phát hành; đó
đúng là hành vi của bài thường bị ẩn.

File: `api/api/quan_tri_hen_gio.py`. Test mới trong `test_hen_gio_phat_hanh.py`: sau
`POST hen-gio`, mốc 1 có `up_count == 1` của đúng tác giả đội.

### 1.2 Gỡ ẩn bài hẹn giờ phải 409, không được đi `dat_an_mach`

`_dat_co_an(bat=False)` xoá `hidden_at` mà **không** chạy chuỗi `phat_hanh_mach` (không
chuông, không đẩy index đúng lúc, `published_at` vẫn ở tương lai). Nút "Gỡ ẩn" trên
`/machs` hiện nay làm đúng chuyện đó với mọi hàng `da_bi_an` — bài hẹn giờ `da_bi_an`
cũng `true`.

Sửa ở **đường ghi**, không chỉ UI:

- `core/ghi.py::dat_an_mach`: nếu `dang_hen_gio(hang)` (dưới khoá) **và** `an=False` ⇒
  không đổi, người gọi dịch thành 409. Chiều `an=True` trên bài hẹn: no-op như cũ (đã
  ẩn; `dang_an == bat`).
- `quan_tri_kiem_duyet.py::dat_an_mach_endpoint`: nhận tín hiệu đó, trả 409
  `noi_dung_da_go` với câu *"bài đang hẹn giờ — dùng Phát hành ngay, đừng gỡ ẩn"*. Thêm
  `409: LoiOut` **chỉ** ở endpoint này, không nhét vào `TRA_LOI_DOI` dùng chung mốc/bình
  luận.

Test: `POST /admin/machs/{id}/an` `{an: false}` trên bài hẹn ⇒ 409, `hidden_at` còn,
không có `Notification` MACH_MOI. Chiều `{an: true}` ⇒ 200 `da_doi=false`.

### 1.3 Hồ sơ tác giả sắp theo `published_at`

Hai cửa cùng tập mạch "của một người":

- `GET /users/{username}` — 20 mạch đầu, `users.py` đang `order_by("-created_at")`
- `GET /users/{username}/machs` — keyset, `ho_so.py::_cat_keyset` đang khoá `created_at`

Đổi cả hai sang `published_at`. Cửa `/me/da-vote` và `/me/dang-theo` **giữ**
`created_at` của `Vote`/`Follow` — đó là lúc *tôi* vote/theo, không phải ngày bài.

`_cat_keyset` đang dùng chung. Thêm tham số `truong="created_at"`; cửa mạch của user
truyền `"published_at"`. `_ra` mã hoá cursor từ đúng cột đó (`getattr(hang[-1], truong)`),
không cứng `created_at`.

Test: A soạn trước, đăng sau; B đăng ngay; hồ sơ tác giả (cả cửa 20 bài lẫn cửa lật
trang) xếp A trên B. Mirror `test_C10_*`.

## 2. Admin `/machs` — lọc + cột + nhãn

File: `apps/admin/app/machs/page.tsx`. API **đã** nhận `trang_thai=hen_gio` và trả
`published_at` + `da_hen_gio` trên `MachDongOut`.

- Thêm `hen_gio: "Đã hẹn giờ"` vào `CHU_LOC` (cuối danh sách, sau `bi_an`).
- Khi `trang_thai === "hen_gio"`: đổi mô tả trang thành *"Hàng đợi bài viết trước, sắp
  theo giờ phát hành gần nhất trước."* Cột thời gian đổi nhãn **"Phát hành"** (mọi bộ
  lọc, không chỉ hàng đợi — ngày hiển thị của bài là `published_at`). `gioVN(m.published_at)`.
- Nhãn hàng: `da_hen_gio` ⇒ `<NhanTrangThai>đã hẹn giờ</NhanTrangThai>` (**không** hiện
  thêm "đã ẩn" — cùng một sự thật, hai nhãn là nói dối). `da_bi_an && !da_hen_gio` giữ
  "đã ẩn".
- Nút **Gỡ ẩn** trên hàng `da_hen_gio`: `disabled` + `title` giải thích dùng trang chi
  tiết. Hàng loạt "Gỡ ẩn": `locCanLam` bỏ qua hàng `da_hen_gio` (kể cả khi server đã
  409 — UI không được bắn 25 request chết).
- Không thêm mục menu. Không trang mới. `quan-tri-giao-dien.spec.ts` không đổi.

## 3. Admin `/m/[machId]` — khối Hẹn giờ

File mới: `apps/admin/components/khoi-hen-gio.tsx` (client). Gắn vào
`apps/admin/app/m/[machId]/page.tsx` ngay dưới khối trạng thái / nút ẩn-khoá hiện có.

Đọc `mach.da_hen_gio`, `mach.published_at`, `mach.bi_mod_an`, `mach.created_at` từ
`MachQuanTriOut` (đã có).

### 3.1 Múi giờ — helper, đo được

`apps/admin/lib/thoi-gian.ts` (đã có `homNayVN`):

| Hàm | Vào | Ra |
|---|---|---|
| `isoSangDatetimeLocalVN(iso)` | ISO UTC/`+07:00` | `YYYY-MM-DDTHH:MM` theo **Asia/Ho_Chi_Minh** |
| `datetimeLocalSangIsoVN(local)` | `YYYY-MM-DDTHH:MM` (naive, đang xem là giờ VN) | `YYYY-MM-DDTHH:MM:00+07:00` |

VN không DST ⇒ `+07:00` hằng. Cấm `new Date(local)` rồi `.toISOString()`: máy mod lệch
múi giờ là bài lên lệch 7 tiếng, đúng rủi ro plan 2026-09-03 §7.3.

Ô `<input type="datetime-local">`. Gửi `quanTriHenGioMach({ baseUrl: GOC_API, headers:
headerGhi(), path: { mach_id }, body: { published_at: datetimeLocalSangIsoVN(v) } })` —
lời gọi **thẳng**, không qua biến (hàng rào `type-admin.spec.ts`).

### 3.2 Ba trạng thái khối

| Trạng thái | UI |
|---|---|
| `bi_mod_an` | khối **khoá**: ô + nút disabled; một câu *"Bài đang bị mod gỡ — gỡ ẩn trước rồi mới hẹn giờ hay phát hành được."* |
| `da_hen_gio` | ô prefill giờ hẹn (VN); nút **Đặt lại giờ**; nút **Phát hành ngay** (`published_at: null`) |
| bài đang hiện | ô trống / gợi ý; nút **Hẹn giờ** (đòi mốc tương lai phía client, server vẫn chốt). Không nút "Bỏ hẹn" — bài đã lên sóng, plan 2026-09-03 §6 cấm sửa `published_at` của bài đã phát hành. |

Dòng phụ luôn hiện hai mốc: `soạn {gioVN(created_at)}` · `phát hành {gioVN(published_at)}`.

`data-testid`: `khoi-hen-gio`, `o-hen-gio`, `nut-hen-gio`, `nut-phat-hanh-ngay`.

Tailwind + token có sẵn; không màu ứng biến, không `--stamp`.

## 4. Web công khai — ngày hiện = `published_at`

Danh sách ĐÓNG. Mỗi chỗ đổi `mach.created_at` → `mach.published_at`. Không đụng
`Comment.created_at` / `Moc.created_at` trừ mốc 1 ở mục 4.2.

| File | Việc |
|---|---|
| `apps/web/components/the-mach.tsx:74` | `ngayCuaThoiDiem(mach.published_at)` |
| `apps/web/components/trang-mach.tsx:327` | `"mở ngày " + ngayCuaThoiDiem(mach.published_at)` |
| `apps/web/components/ket-qua-tim-kiem.tsx:97` | `<time dateTime={m.published_at}>` |
| `apps/web/lib/json-ld.ts` | `datePublished: mach.published_at`. Sửa docstring: ngày **đăng**, không phải lúc mốc 1 ra đời. `dateModified` giữ `last_entry_at`. |
| `apps/web/app/feed.xml/route.ts` | `ngay: new Date(m.published_at)`. Sửa docstring (đang nói `created_at` = tab Mới — tab Mới nay là `published_at`). |
| `apps/web/app/s/[sub]/feed.xml/route.ts` | cùng |
| `apps/web/e2e/seo-va-trang.spec.ts:98` | `Date.parse(hpg.published_at)` — bài seed thường có hai cột bằng nhau nên không đổi ý nghĩa trên seed hiện tại, nhưng ghim đúng cột. |
| `apps/web/e2e/dung-seed.ts` | sửa chú thích "Feed Mới sắp theo `created_at`". |

### 4.2 Mốc 1 hiện ngày đăng của mạch

`apps/web/components/the-moc.tsx` (~dòng 99–100): khi `moc.seq === 1`, chữ biên lai là
`ghi {dauThoiGianServer(mach.published_at)}` thay `moc.created_at`. Mốc 2+ giữ
`moc.created_at`. `MocRevision` không đụng.

`TheMoc` phải nhận `published_at` của mạch (hoặc cả `mach`). Truyền từ `trang-mach.tsx`
xuống — **không** đoán từ mốc. `data-testid="moc-created-at"` giữ nguyên (hàng rào e2e
đang bám).

Sitemap **không đổi** (`last_entry_at`) — plan 2026-09-03 §1.3.

Index Meili `created_at_ts` **không đổi** lượt này. Trang kết quả đọc `published_at` từ
object mạch API trả kèm, không đọc timestamp trong index. Đổi schema Meili + reindex là
việc riêng (ghi sổ nếu thợ thấy sort tìm kiếm lệch ngày đăng).

## 5. Bot `dang-bai.py --hen` + tài liệu

`scripts/bai-viet/dang-bai.py`:

- Cờ `--hen <ISO>` (offset tường minh, ví dụ `2026-09-10T08:00:00+07:00`). Thiếu offset
  ⇒ exit 2 **trước** khi gọi mạng, in rõ yêu cầu `+07:00`.
- Có `--hen`:
  1. Đăng nhập bằng `GIKKY_ADMIN_PASSWORD` (email admin trong container — docstring hiện
     đang dùng `GIKKY_TEAM_MEMBER_PASSWORD` / `gikky-team-member@…`). Hai biến, hai việc:
     không `--hen` giữ nguyên đường cũ; có `--hen` mới đọc `GIKKY_ADMIN_PASSWORD` và
     `GIKKY_ADMIN_EMAIL` (default `admin@gikky.net` nếu đã có trong `tao_tai_khoan_doi`).
     **Đọc `tao_tai_khoan_doi.py` lúc làm, đừng đoán email.**
  2. `POST {ORIGIN}/api/admin/machs/hen-gio` với `author = gikky-team-member`,
     `published_at = argv`, cộng các trường nội dung như cũ.
  3. In URL admin `/m/{id}` (bài đang ẩn, URL công khai 404 cho tới lúc lên sóng) + giờ
     hẹn ra stderr.
- Không `--hen`: **y nguyên** đường `POST /api/v1/machs` + mật khẩu đội. Test: soat
  không `--hen` vẫn từ chối trường lạ; có `--hen` cho phép không có gì thêm trong JSON
  bài (giờ hẹn đi qua argv, không nhét vào `bai.json`).

`scripts/bai-viet/lich/tan-man.md`: mục ngắn **Viết trước, đăng sau** — cách dùng
`--hen`, luật "bài hẹn vẫn phải đủ mọi phép soát như bài thường", và nhắc cron 5 phút
(độ trễ ≤ 5 phút).

Không chạy một lần thật lên prod trong lượt này.

## 6. Cron + đối soát — `deploy/prod/README.md`

Thêm mục ngay dưới hai mục crontab có sẵn, cùng khuôn:

```
*/5 * * * *  cd ~/gikky-net/src && docker compose -f deploy/prod/compose.yml --env-file ~/gikky-net/app/.env exec -T api python manage.py phat_hanh_da_hen >> ~/gikky-phat-hanh-da-hen.log 2>&1
```

Kèm phép đối soát (plan 2026-09-03 §7.5): số mạch
`hidden_by IS NULL AND hidden_at IS NOT NULL AND published_at < now() - 15 phút`
phải = **0**; khác 0 là cron chết. Ghi đúng lệnh `gk exec api python manage.py shell -c
"…"` để người vận hành copy.

Không tự SSH vào VPS cài crontab — chỉ tài liệu. Cài thật là việc deploy, user quyết.

## 7. Tiêu chí nghiệm thu — ĐO ĐƯỢC

Nền pytest hiện tại (cây này, sau backend hẹn giờ) + e2e don-vi. **Không** `pnpm e2e`
trần (chiếm 3000/8000 + ghi `gikky_dev`). Kiểm mắt admin/web là chặng 5 phiên chính.

| # | Tiêu chí | Đo bằng |
|---|---|---|
| T1 | `pnpm lint` 0 warning · `pnpm build` xanh · `pnpm codegen:check` khớp · `pnpm test` 0 fail 0 warning · `pnpm e2e:don-vi` 0 đỏ | chạy lại |
| T2 | Cửa hẹn giờ tự upvote: `POST /admin/machs/hen-gio` ⇒ mốc 1 `up_count==1` của tác giả đội | pytest mới |
| T3 | Gỡ ẩn bài hẹn ⇒ 409, `hidden_at` còn, 0 chuông MACH_MOI | pytest mới |
| T4 | Hồ sơ tác giả (cả 20 bài đầu lẫn cửa lật trang) sắp theo `published_at` — A soạn trước đăng sau đứng trên B | pytest mới |
| T5 | Don-vi đọc-nguồn (fail-closed, `boChuThich`): (a) `the-mach`/`trang-mach`/`ket-qua-tim-kiem`/`json-ld`/`feed.xml`×2 gọi `published_at` cho ngày bài, **không** `mach.created_at`; (b) `the-moc.tsx` có nhánh `seq === 1` đọc `published_at`; (c) `CHU_LOC` có khoá `hen_gio`; (d) `khoi-hen-gio.tsx` có `datetime-local` + gọi `quanTriHenGioMach(` kèm `baseUrl`; (e) `datetimeLocalSangIsoVN` trả chuỗi kết thúc `+07:00`; (f) `dang-bai.py` có `--hen` | bài đo mới `apps/web/e2e/don-vi/hen-gio-phat-hanh.spec.ts` + unit helper `thoi-gian` |
| T6 | Thử phá ≥ 4: đổi `the-mach` về `created_at` ⇒ (a) đỏ · bỏ nhánh `seq===1` ⇒ (b) đỏ · xóa `hen_gio` khỏi `CHU_LOC` ⇒ (c) đỏ · helper trả `Z`/`toISOString()` ⇒ (e) đỏ. Khôi phục. | báo cáo |
| T7 | `quan-tri-giao-dien.spec.ts` (menu, màu) xanh · `type-admin.spec.ts` xanh (mọi lời gọi mới có `baseUrl`, không alias hàm) | chạy lại |
| T8 | `seo-va-trang.spec.ts` ghim `datePublished === hpg.published_at` (sửa assertion; chạy khi có e2e đầy đủ — **không** bắt chặng 2 chạy `pnpm e2e`) | diff assertion |
| T9 | Chặng 5, trình duyệt thật + session mod: `/machs?trang_thai=hen_gio` ra đúng hàng; đặt giờ VN trên `/m/{id}` ⇒ lưu UTC đúng offset (đọc lại `published_at`); bài `bi_mod_an` khối khoá; Phát hành ngay lên feed. Web: thẻ + trang mạch + RSS hiện `published_at`. | phiên chính |

## 8. Không làm trong lượt này

- Không form soạn bài mới trong admin (100–200 bài đi qua `--hen`, không dựng TipTap thứ
  hai).
- Không cho user thường hẹn giờ, không thêm `published_at` vào `POST /machs` / form web.
- Không sửa `published_at` của bài **đã phát hành** (không nút "đăng lại lên đầu feed").
- Không đổi `last_entry_at` lúc phát hành — feed "Đang diễn ra" đo hoạt động, không đo
  giờ lên sóng.
- Không đổi schema Meili / `created_at_ts`.
- Không cài crontab trên VPS.
- Không đụng `Comment`/`Moc.created_at` (trừ hiển thị mốc 1, mục 4.2).
- Không bỏ cột/index `created_at`.

## 9. Ràng buộc cây làm việc

Cây đang nhiễm: backend hẹn giờ **chưa commit** (đúng nền của lượt này) cộng file phiên
khác. Chặng 2 chạy **trên cây này**, không worktree từ `main` (main chưa có `0027`).

**Cấm đụng** (không của lượt này): `apps/web/components/form-tai-khoan.module.css`,
`plans/2026-08-31-modal-online.md`, `scripts/bai-viet/chu-de.md`. `tan-man.md` **được**
sửa (mục 5).

Sau khi sửa Ninja (1.2 thêm 409): **`pnpm codegen`**. Không sửa tay `packages/api-client`.

Không commit. Không `pnpm e2e` trần. Không dev server (chặng 5). Không `pnpm build` nếu
`next dev` của cùng app đang mở — `CLAUDE.md` cảnh báo phá `.next/`.

## 10. Nhật ký

Thực thi 2026-09-04 trên cây đã có backend hẹn giờ (chưa commit). Không đụng
`form-tai-khoan.module.css`, `plans/2026-08-31-modal-online.md`, `scripts/bai-viet/chu-de.md`.

**Đã làm**

- T2: `POST /admin/machs/hen-gio` gọi `tu_upvote` + `bao_mach_moi` sau `tao_mach`.
  Bài đo ban đầu ghi `moc.up_count` — mốc không có cột ấy (chỉ `score`). Đổi thành
  `score == 1` + hàng `Vote` của tác giả đội.
- T3: `dat_an_mach` ném `KhongTheGoAnHenGio` khi gỡ ẩn bài hẹn; cửa admin và cửa v1
  `mod_dat_an_mach` trả 409 `noi_dung_da_go`. `pnpm codegen` thêm 409 vào OpenAPI.
- T4: hồ sơ 20 bài + keyset `/users/{username}/machs` sắp `published_at`. `/me/da-vote`
  và `/me/dang-theo` giữ `created_at` của Vote/Follow.
- Admin `/machs`: lọc `hen_gio`, cột Phát hành, nhãn *đã hẹn giờ*, nút Gỡ ẩn khoá khi
  `da_hen_gio`. `/m/[id]`: khối `khoi-hen-gio.tsx` (`datetime-local` +07:00).
- Web: thẻ / trang mạch / tìm kiếm / JSON-LD / RSS / mốc 1 dùng `published_at`.
- Bot `--hen`; `tan-man.md` mục *Viết trước, đăng sau*; crontab `phat_hanh_da_hen` trong
  `deploy/prod/README.md` (không SSH VPS).

**Đo**

| # | Kết quả |
|---|---|
| T1 | `pnpm lint` 0 · `pnpm build` web+admin xanh · `pnpm codegen:check` khớp 34 file · `pnpm test` **1981 passed, 26 skipped** (0 fail, 0 warning) · `pnpm e2e:don-vi` **450 passed** |
| T2–T4 | pytest mới xanh (sau khi sửa assertion `score`) |
| T5 | 8 bài `hen-gio-phat-hanh.spec.ts` xanh (kèm T5e mutant) |
| T6 | bốn mutant đỏ rồi khôi phục: (a) `the-mach` → `created_at` · (b) bỏ `seq===1` · (c) xoá `hen_gio` khỏi `CHU_LOC` · (e) helper `toISOString()`/`Z` |
| T7 | `quan-tri-giao-dien.spec.ts` + `type-admin.spec.ts` nằm trong 450 don-vi |
| T8 | `seo-va-trang.spec.ts` ghim `datePublished === hpg.published_at` — **không** chạy `pnpm e2e` trần |
| T9 | chưa — cần session mod + dev server |

Không commit. Sổ: không thêm gì.
