# Hẹn giờ phát hành — `published_at` cho mạch

Chốt 2026-09-03. Yêu cầu: *"thêm published_at để có thể viết bài trước, sau đó publish vào
một thời điểm khác trong tương lai… có khoảng 100–200 bài có thể viết trước rồi publish
dần; đổi ngày hiển thị từ created_at sang published_at. Tính năng chỉ dùng trong admin."*

## 0. Sự thật đã đo — plan bám vào đây, không bám vào trí nhớ

| Điều | Đo được | Ở đâu |
|---|---|---|
| `Mach.created_at` | `DateTimeField(default=timezone.now, editable=False)`; index `mach_created_desc`, `mach_author_created` | `core/models/dien_dan.py:199-210` |
| Bộ lọc "mạch được hiện" | `hidden_at__isnull=True` rải ở **68 chỗ / ~25 file**; helper `_mach_hien` chỉ phủ 11 file | `grep hidden_at__isnull` |
| Feed **Mới** | sắp theo `created_at`, keyset cursor `(created_at, id)`, `?khoang=` cắt theo `created_at` | `api/feeds.py:3,164-180,254` |
| Xếp hạng | hệ số tuổi 48h tính từ `created_at` | `core/xep_hang.py:44-79` |
| Thông báo mạch mới | `bao_mach_moi(mach)` gọi **lúc tạo**, dedupe theo `created_at` | `api/machs.py:569`, `core/thong_bao.py:392-423` |
| Index tìm kiếm | đẩy ở `on_commit`, tự đọc `mach.hidden_at` lúc chạy | `core/ghi.py:539`, `core/tim_kiem.py` |
| Cache Next | `lam_moi_mach(mach)` lúc tạo/sửa | `api/machs.py:647,830,867` |
| Mod ẩn | `dat_an_mach(mach, boi, an, ly_do)` — luôn có `boi` ⇒ `hidden_by` luôn có | `core/ghi.py:1661` |
| Prod hiện tại | 1 mạch đang ẩn, **0** mạch ẩn mà `hidden_by NULL` | đo 03/09 |
| Cron trên VPS | 2 job/ngày qua `crontab` → `manage.py <lệnh>` | `crontab -l` |
| Mật khẩu admin trong container | `GIKKY_ADMIN_PASSWORD` **có** | `env` container `api` |
| Web hiển thị ngày | `the-mach.tsx:74`, `trang-mach.tsx:327`, `feed.xml` ×2; sitemap dùng `last_entry_at` | grep |
| Admin | sửa mốc + sửa tiêu đề (`quan_tri_sua_bai.py`), **không có tạo mạch** | grep `operation_id` |
| Tài khoản đội | `gikky-team-member`, `gikky-team-news` — **không** `is_staff` | `tao_tai_khoan_doi.py:44-45,119-122` |
| Nền | **26 migration** (mới nhất `0026`) · **1978 test** thu thập | `pytest --collect-only` |

## 1. Quyết định kiến trúc — cái quan trọng nhất

### 1.1 Bài hẹn giờ = bài ĐANG ẨN, không phải một trạng thái mới

Bộ lọc `hidden_at__isnull=True` nằm ở 68 chỗ. Dựng một trạng thái "chưa phát hành" mới thì
phải sửa đủ 68 chỗ; thiếu một là **rò bài chưa đăng** ra feed/RSS/tìm kiếm/thông báo — đúng
loài lỗi mà bài đo trên cây cũ vẫn xanh (`CLAUDE.md`, mục *worktree đứng ở commit cũ*).

⇒ **Bài hẹn giờ được lưu với `hidden_at` đã đặt.** Mọi đường đọc hiện có đã loại nó ra,
không sửa đường nào. Phát hành = xoá `hidden_at`.

Phân biệt "ẩn vì hẹn giờ" với "ẩn vì mod": **`hidden_by IS NULL`** ⇔ hẹn giờ. Mod ẩn luôn đi
qua `dat_an_mach(boi=…)` nên luôn có `hidden_by`; prod hiện không có ngoại lệ (đo ở §0).
Bất biến này phải thành **`CheckConstraint`** trong migration, không chỉ là chữ:

```
hidden_at IS NULL  OR  hidden_by IS NOT NULL  OR  published_at > created_at
```

(ẩn mà không ai ẩn ⇒ phải là bài hẹn tương lai.)

### 1.2 `published_at` NOT NULL, backfill = `created_at`

- Migration: thêm cột nullable → `UPDATE … SET published_at = created_at` → `NOT NULL`,
  `default=timezone.now`. Ba bước trong **một** migration, có `RunPython` ngược.
- Bài thường: `published_at = created_at = now`. Không đổi hành vi.
- Bài hẹn: `published_at` = giờ hẹn, `hidden_at = now`, `hidden_by = NULL`.

### 1.3 Mọi chỗ "ngày của mạch" đổi sang `published_at` — danh sách ĐÓNG

| Chỗ | Đang | Đổi thành |
|---|---|---|
| Feed Mới: sort + keyset cursor | `created_at` | `published_at` |
| Feed `?khoang=` | `created_at__gte` | `published_at__gte` |
| Index | `mach_created_desc`, `mach_author_created` | **thêm** `mach_published_desc`, `mach_author_published`; **giữ** index cũ |
| Xếp hạng — tuổi bài | `created_at` | `published_at` |
| `bao_mach_moi` dedupe key | `created_at` | `published_at` |
| Schema `MachTomTatOut`, `MachChiTietOut` | có `created_at` | **thêm** `published_at`; `created_at` **giữ** (không phá client) |
| Web `the-mach.tsx`, `trang-mach.tsx` "mở ngày" | `created_at` | `published_at` |
| Web RSS `feed.xml` ×2 | `created_at` | `published_at` |
| Web sitemap | `last_entry_at` | **không đổi** |
| `Comment.created_at`, `Moc.created_at` | — | **không đổi** — chỉ mạch có ngày phát hành |

**Mốc 1 của bài hẹn giờ**: `Moc(seq=1).created_at` là giờ viết, không phải giờ đăng. Không
ghi đè dữ liệu. Web: khi `moc.seq === 1`, hiện `mach.published_at` thay cho `moc.created_at`.
`MocRevision` giữ nguyên giờ thật.

### 1.4 Tác dụng phụ lúc TẠO phải dời sang lúc PHÁT HÀNH

Rủi ro lớn thứ hai sau rò đường đọc. Ba thứ hiện chạy lúc tạo:

| Thứ | Lúc tạo bài hẹn | Lúc phát hành |
|---|---|---|
| `bao_mach_moi` (thông báo người theo dõi) | **KHÔNG gọi** | gọi |
| `lam_moi_mach` (cache Next) | không cần | gọi |
| Index tìm kiếm (`on_commit`) | tự bỏ qua vì đọc `hidden_at` — **phải kiểm bằng test**, không tin docstring | đẩy |

### 1.5 Bộ phát hành: lệnh `phat_hanh_da_hen` + cron 5 phút

```
manage.py phat_hanh_da_hen
  → SELECT … WHERE hidden_at IS NOT NULL AND hidden_by IS NULL AND published_at <= now()
    FOR UPDATE SKIP LOCKED
  → mỗi mạch, trong atomic(): hidden_at = NULL; bao_mach_moi; on_commit: index + lam_moi_mach
  → in số bài đã phát hành; exit 0
```

- `SKIP LOCKED` để hai lần cron chồng nhau không phát hành trùng.
- Thứ tự khoá: chỉ chạm hàng `Mach` ⇒ không đụng luật `Comment → Moc → Mach → MocAnh`.
- Cron: `*/5 * * * *` cùng mẫu hai dòng có sẵn. Ghi vào `deploy/prod/README.md` mục
  *Việc chạy theo lịch*.
- Độ trễ chấp nhận: ≤ 5 phút sau giờ hẹn.

## 2. API — chỉ khu quản trị, không đụng API công khai

`POST /machs` công khai **không** nhận `published_at`. Đúng chữ "chỉ dùng trong admin".

| Endpoint | `operation_id` | Việc |
|---|---|---|
| `PATCH /quan-tri/machs/{id}/hen-gio` | `quan_tri_hen_gio_mach` | body `{published_at: datetime hoặc null}`. Tương lai ⇒ ẩn + hẹn. `null` hoặc quá khứ ⇒ phát hành ngay (chạy đúng chuỗi §1.4). Bài mod đã ẩn (`hidden_by` có) ⇒ **409** — không cho lách mod bằng hẹn giờ. |
| `POST /quan-tri/machs/hen-gio` | `quan_tri_tao_mach_hen_gio` | tạo mạch **thay mặt** một tài khoản đội (`author` ∈ allowlist `gikky-team-member` / `gikky-team-news`), đủ trường như `POST /machs` + `published_at`. Đây là cửa cho 100–200 bài viết trước. |
| `GET /quan-tri/machs?trang_thai=hen_gio` | mở rộng cái có sẵn | liệt kê bài hẹn, sắp theo `published_at` tăng dần |

Cả ba: `auth` = staff như mọi `quan_tri_*`. Ghi nhật ký quản trị (`quan_tri_nhat_ky`).

Sau khi sửa Ninja: **`pnpm codegen`**; `packages/api-client` không sửa tay.

## 3. Giao diện admin

- `/machs`: bộ lọc **Đã hẹn giờ**; cột "Phát hành" hiện `published_at` (giờ VN), bài hẹn có
  nhãn rõ.
- `/m/[machId]`: khối **Hẹn giờ** — ô chọn ngày-giờ (nhập giờ VN, gửi ISO có offset), nút
  *Phát hành ngay*, nút *Bỏ hẹn* (= phát hành ngay). Bài mod đã ẩn: khối này **khoá**, ghi
  lý do.
- Tailwind + token có sẵn; không màu ứng biến (hàng rào `quan-tri-giao-dien.spec.ts`).

## 4. Bot bài viết: `dang-bai.py --hen <ISO>`

- Có `--hen` ⇒ đăng nhập bằng `GIKKY_ADMIN_PASSWORD` (đã có trong container) và gọi
  `quan_tri_tao_mach_hen_gio` với `author = gikky-team-member`. Không có `--hen` ⇒ đường cũ y
  nguyên.
- `lich/tan-man.md`: thêm mục ngắn *Viết trước, đăng sau* — cách dùng `--hen`, và luật: bài
  hẹn vẫn phải đủ mọi phép soát như bài thường.
- Mật khẩu vẫn không rời container — cùng lý do đã ghi ở docstring `dang-bai.py`.

## 5. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Cách đo |
|---|---|---|
| 1 | Migration `0027` chạy xuôi + ngược sạch | `migrate` → `migrate core 0026` → `migrate`; 0 lỗi |
| 2 | Backfill đúng | sau migrate: 0 mạch có `published_at` NULL; mọi bài cũ `published_at == created_at` |
| 3 | `CheckConstraint` chặn ca sai | tạo `Mach(hidden_at=now, hidden_by=None, published_at=created_at)` ⇒ `IntegrityError` |
| 4 | Bài hẹn **không lộ** ở 6 mặt | feed Mới · feed Đang diễn ra · `/s/<sub>` · RSS · tìm kiếm · hồ sơ tác giả — test gọi cả 6, `id` không xuất hiện |
| 5 | Bài hẹn **không** sinh thông báo lúc tạo | `Notification(type=MACH_MOI).count()` không đổi sau khi tạo |
| 6 | Bài hẹn **không** vào index | Meili không có tài liệu `id` đó (hoặc mock `day_lo` không được gọi) |
| 7 | `phat_hanh_da_hen` phát hành đúng bài | 3 bài: quá khứ, tương lai, mod-ẩn-có-`hidden_by`-quá-khứ ⇒ **chỉ** bài 1 hiện; lệnh in `1` |
| 8 | Phát hành sinh đủ tác dụng phụ | sau lệnh: 1 `Notification` MACH_MOI; `lam_moi_mach` gọi 1 lần; index có tài liệu |
| 9 | Hai lần chạy chồng không trùng | chạy lệnh 2 lần song song trên 1 bài ⇒ đúng 1 thông báo |
| 10 | Feed Mới sắp theo `published_at` | A tạo trước, hẹn sau; B tạo sau, đăng ngay; phát hành A ⇒ A đứng **trên** B |
| 11 | `?khoang=ngay` cắt theo `published_at` | bài tạo 10 ngày trước, phát hành hôm nay ⇒ **có** trong `khoang=ngay` |
| 12 | Xếp hạng tính tuổi từ `published_at` | bài tạo 10 ngày trước, phát hành hôm nay ⇒ có hệ số tuổi 48h |
| 13 | `PATCH hen-gio` trên bài mod ẩn ⇒ 409 | test |
| 14 | `PATCH hen-gio` với `null` phát hành ngay + đủ tác dụng phụ | như #8 |
| 15 | Không staff gọi 3 endpoint ⇒ 403 | test |
| 16 | Web hiện `published_at` ở `the-mach`, `trang-mach`, RSS | e2e đọc DOM/XML |
| 17 | Mốc 1 của bài hẹn hiện `published_at` | e2e |
| 18 | Admin: lọc *Đã hẹn giờ* ra đúng danh sách; đặt giờ VN ⇒ lưu UTC đúng offset | e2e admin |
| 19 | `--hen` tạo bài ẩn + hẹn; không `--hen` đường cũ y nguyên | chạy khô + 1 lần thật rồi ẩn |
| 20 | `pnpm lint` 0 warning · `pnpm codegen:check` sạch · `pytest` ≥ 1978 + số test mới, 0 fail, 0 warning | chạy |

**Thử phá bắt buộc** (luật 4): #3, #4, #5, #7, #9 — sửa ngược code, test phải ĐỎ, khôi phục.
Riêng #4: bỏ `hidden_at=now` lúc tạo bài hẹn ⇒ cả 6 mặt phải đỏ. Đó là bài đo chứng minh
quyết định §1.1 là thật.

## 6. Không làm trong lượt này

- Không cho người dùng thường hẹn giờ.
- Không cho sửa `published_at` của bài **đã phát hành** — tránh mở đường "đăng lại lên đầu feed".
- Không đụng `Comment`/`Moc` `created_at`.
- Không bỏ index/cột `created_at`.

## 7. Rủi ro và cách chặn

1. **Cây làm việc đang nhiễm nặng: 125 file M/D từ phiên khác** (`apps/web` 35, `apps/admin`
   22, `api` ~30). Việc này đụng cả ba khu. ⇒ **Toàn bộ chặng 2–4 chạy trong `git worktree`
   tách từ `main`**; bước đầu tiên của mỗi subagent là kiểm nền (`0026`, 1978 test) theo luật
   *worktree đứng ở commit cũ*. Gộp về `main` là việc riêng, cần user quyết vì đụng phiên khác.
2. **Số migration `0027` có thể đụng phiên khác** (memory: kiểm số migration trước khi commit).
   ⇒ chặng 5 kiểm `ls migrations` trên `main` thật trước khi gộp.
3. **Múi giờ**: admin nhập giờ VN, lưu UTC. Sai offset là bài lên sớm/muộn 7 tiếng. Tiêu chí #18.
4. **Thông báo bắn hai lần** (tạo + phát hành) hoặc **không lần nào**. Tiêu chí #5, #8, #9.
5. **Cron chết** thì bài hẹn không bao giờ lên. ⇒ `deploy/prod/README.md` thêm dòng đối soát:
   số mạch `hidden_by NULL, hidden_at có, published_at < now − 15 phút` phải bằng **0**; khác 0
   là cron chết.
