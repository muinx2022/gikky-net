# Plan con — Phase 1a: lõi dữ liệu (models + seed)

> Nguồn: `PLAN.md` mục 5 (spec sản phẩm), **mục 6 (data model)**, mục 10 Phase 1.
> Quy trình: `D:\Projects\CLAUDE.md` (5 chặng). Ngày 2026-08-21.
> Phase 1 là (L) nên tách 3 plan con: **1a lõi dữ liệu** · 1b API đọc · 1c frontend mặt CẶN.

## 0. Phạm vi

**Trong:** toàn bộ model mục 6 + migration + seed command + hai hàm lõi (wilson, cấp phát `path`)
+ test model-layer.

**NGOÀI — đừng lấn:** endpoint Ninja (1b), mọi thứ frontend (1c), allauth/đăng nhập (Phase 2),
ISR/cache (Phase 3), upload ảnh thật (Phase 5 — 1a chỉ tạo BẢNG `MocAnh`).

Nền đã có từ Phase 0: `core.User` (`AbstractUser`, chưa có trường domain), PG 17 local, pytest
`filterwarnings=["error"]`, `pnpm test`.

## 1. Giá trị đã chốt (PLAN không nêu — plan con PHẢI chốt trước khi code)

| Hạng mục | Chốt | Lý do |
|---|---|---|
| Khoá chính | `BigAutoField` (mặc định Django) | PLAN 5.9 "id bền" — id vào URL vĩnh viễn |
| **Sequence khởi điểm của `Mach`** | `ALTER SEQUENCE ... RESTART WITH 1000` trong migration | `/m/...-1` quảng cáo công khai rằng site mới toanh. Đổi sau = gãy permalink + mất SEO, mà SEO là giá trị lõi của mặt CẶN (PLAN mục 1). Làm lúc bảng rỗng thì giá bằng 0 |
| Slug | `django.utils.text.slugify(title)` (bỏ dấu, `allow_unicode=False`), cắt 60 ký tự, **KHÔNG unique** | URL là `/m/<slug>-<id>`; `id` mới là khoá. Slug lệch ⇒ 301 (1c) |
| ENUM | `models.TextChoices` + `CharField` | ENUM native của PG làm migration đau, không đáng ở v1 |
| `Comment.score` | `models.GeneratedField(expression=F("up_count") - F("down_count"), db_persist=True)` | PLAN mục 6 ghi rõ "score suy ra, đừng lưu tay" |
| `Comment.path` | `CharField(max_length=255)`, segment **6 chữ số** zero-pad, nối bằng `.` | PLAN mục 6 cho mẫu `"000012.000034"`. 255 ⇒ ~36 tầng; UI chỉ render 6 tầng (5.3) |
| Vượt 36 tầng | `ValidationError` rõ ràng, KHÔNG cắt âm thầm | cắt âm thầm = mất reply |
| Vượt 999999 sibling | `ValidationError` | cùng lý do |
| `figures` | `JSONField`, validate **cấu trúc** (list ≤6 phần tử, mỗi phần tử `{label, value}` string) | PLAN 5.2: "thuần hiển thị, **không validate ngữ nghĩa**" — cấu trúc thì vẫn phải chặn, nếu không frontend vỡ |
| Wilson | hàm thuần `wilson_lower_bound(up, down, z=1.281)` trong `core/xep_hang.py` | công thức ở PLAN 5.3; 1b dùng lại |
| Hệ số tươi | `+0.15` nếu `c.created_at > mach.last_entry_at` VÀ `now − c.created_at ≤ 48h`; **chỉ bình luận gốc** | nguyên văn PLAN 5.3 |
| Seed command | `manage.py seed_dev [--reset]` | `--reset` xoá dữ liệu seed cũ để chạy lại nhiều lần |
| Múi giờ | mọi phép "ngày" quy đổi `Asia/Ho_Chi_Minh` qua `django.utils.timezone.localdate` | PLAN mục 1 |

## 2. Hạng mục việc

### 2.1 Models (`api/core/models.py` — hoặc tách module, agent tự quyết miễn 1 app `core`)
Đủ **toàn bộ** mục 6, kể cả cột moderation và `MocAnh` (build sẵn cột, tính năng dùng sau):
`User` (thêm `display_name`, `bio`, `banned_until`, `ban_permanent`, `ban_reason`) · `Sub` ·
`Mach` · `Moc` · `MocRevision` · `MocAnh` · `Comment` · `Vote` · `Reaction` · `Trich` ·
`Follow` · `Notification` · `Report` · `AuditLog`.

**Ràng buộc PHẢI có bằng `Meta.constraints` / `Meta.indexes`, không chỉ bằng code:**
- `UNIQUE (mach, seq)` trên `Moc`
- `UNIQUE (mach, path)` trên `Comment` ← chặn race cấp phát path
- `UNIQUE (user, target_type, target_id)` trên `Vote`; `value ∈ {−1, 1}` bằng `CheckConstraint`
- `UNIQUE (user, moc)` trên `Reaction`
- **`UniqueConstraint(fields=["moc"], condition=Q(removed_at__isnull=True))`** trên `Trich`
  (partial — PLAN 5.6 rào 1; gỡ rồi trích lại được)
- `UNIQUE (user, mach)` trên `Follow`; `UNIQUE (user, dedupe_key)` trên `Notification`
- Index đúng mục 6: `(sub, last_entry_at DESC)`, `(author, created_at DESC)`, `(created_at DESC)`,
  `(last_entry_at DESC) WHERE status='open'`, `(mach, path)`,
  `(mach, anchor_moc_seq) WHERE parent IS NULL`, `(mach, author)`, `(user, created_at DESC)`

### 2.2 Hai hàm lõi
- `core/xep_hang.py`: `wilson_lower_bound(up, down, z=1.281)` + `xep_hang_binh_luan_goc(...)`
  (wilson + hệ số tươi). Thuần, không đụng DB ⇒ test rẻ và chắc.
- `core/cay_binh_luan.py`: `cap_phat_path(mach, parent)` — trong transaction,
  `select_for_update` trên `parent` (bình luận gốc thì trên `Mach`), cấp segment kế, retry khi
  `IntegrityError` từ `UNIQUE (mach, path)`. **PLAN mục 6 ghi rõ: không có bước này thì hai reply
  đồng thời cùng parent trùng path im lặng.**

### 2.3 Denormalize — cập nhật trong CÙNG transaction với ghi
`Mach.last_entry_at`, `last_activity_at` (= max(mốc mới, comment mới)), `entry_count`,
`comment_count`; `Comment.up_count/down_count`. PLAN mục 6 nói rõ "TẤT CẢ denormalize, cập nhật
trong cùng transaction với ghi". 1a cung cấp **hàm** làm việc đó (seed dùng, 1b/Phase 2 dùng lại),
không rải logic khắp nơi.

### 2.4 Seed command `manage.py seed_dev`
> **Cập nhật 2026-08-21 (đợt vá, W6).** Bản đầu của mục này đủ về SỐ LƯỢNG nhưng làm hai
> tiêu chí nghiệm thu của 1c **suy biến** — xem 4 gạch đầu dòng in đậm bên dưới. Chúng là
> ràng buộc bắt buộc, không phải gợi ý; `tests/test_seed_dev.py` ghim từng cái.

Đúng đơn PLAN mục 10 Phase 1:
- 2 sub: `chung-khoan`, `crypto`
- **1 mạch HPG 9 mốc đã đóng**: `ket_qua = "+18.2% · 163 ngày"`, `figures` ở mốc 1 và 9,
  `question_for_crowd` ở đúng 1 mốc, **24 bình luận có cây + anchor** (phải có: thread neo mốc 2
  mà reply viết ở thời điểm mốc 9 — PLAN nguyên tắc 6), **1 `Trich` ở mốc 7**, điểm vote rải sao
  cho **top-10 wilson có nghĩa** (không phải tất cả cùng điểm)
- **Ba vai của mặt CẶN phải là BA hàng khác nhau** (PLAN 5.5). Dải gập của mạch 9 mốc là
  `seq 2..7` ("mốc 1 + gập giữa + 2 mốc cuối"):
  - điểm cao nhất **toàn mạch** — phải neo NGOÀI dải gập (hiện: `r1`, neo mốc 1, 31↑/0↓);
  - điểm cao nhất **trong dải gập** — mồi bung (hiện: `r6`, neo mốc 5, 30↑/1↓);
  - bình luận **được trích** (hiện: `r7`, neo mốc 5, 3↑/4↓).
- **Bình luận được trích KHÔNG được nằm trong top-10 wilson.** Nếu nó nằm trong, tập "đã
  trích" là con của top-10 và phép hợp *"đã trích ∪ top-10"* (PLAN 5.5) suy biến — 1c quên
  hẳn vế "∪ đã trích" vẫn ra output giống hệt.
- **Ít nhất một mốc trong dải gập có 0 bình luận neo, và chính mốc đó mang
  `question_for_crowd`** (hiện: mốc 6). Không có cặp này thì PLAN 5.4 luật 4 (*"Mốc 0 bình
  luận: không hiện `💬 0` — hiện `＋ nói gì đó về mốc này` + `question_for_crowd` nếu có"*)
  không có dữ liệu nào để chạy qua.
- **Tổng `up + down` của mọi đích ≤ `SO_NGUOI_XEM`.** Vượt là `ValueError` ngay lúc seed —
  cắt lát Python vượt biên không báo lỗi, và cột denormalize tính lại từ đúng số hàng `Vote`
  đã bị cắt nên **mọi bài đo đối soát vẫn xanh**.
- **1 post thường** (`entry_count == 1`, `ket_qua` NULL) — để 1c test được nhánh "ẩn `ket_qua`
  khi NULL" và nhánh "chưa phải mạch"
- Vài user có `display_name`
- **Chạy 2 lần liên tiếp không nhân đôi dữ liệu** (idempotent hoặc `--reset` bắt buộc, ghi rõ)

### 2.5 Test (mọi test mới đều THỬ PHÁ — luật 4)
1. Wilson: ca biên (0 vote, toàn up, toàn down, up=down) + **hệ số tươi ĐỔI THỨ HẠNG thật**
   (PLAN mục 10 Phase 1 đòi đích danh test này)
2. **Path-race**: 2 reply đồng thời cùng parent → 2 path khác nhau, không `IntegrityError` lọt ra
   ngoài (PLAN mục 10 đòi đích danh). Dùng transaction/thread thật, không giả lập bằng mock
3. Partial unique của `Trich`: trích 2 lần cùng mốc → chặn; gỡ (`removed_at`) rồi trích lại → được
4. `Comment.score` là GeneratedField: đổi `up_count` → `score` tự đổi, **không ghi tay được**
5. Denormalize: thêm mốc/comment → `entry_count`/`comment_count`/`last_entry_at`/`last_activity_at`
   đúng, trong cùng transaction
6. Seed: chạy xong đúng số lượng đơn 2.4; chạy 2 lần không nhân đôi
7. Ngày theo giờ VN: mốc tạo lúc 23:50 và 00:10 giờ VN rơi vào 2 "ngày" khác nhau

## 3. Tiêu chí nghiệm thu

| # | Tiêu chí | Cách đo |
|---|---|---|
| P1 | Đủ 14 model mục 6, đúng tên trường | đọc code + `manage.py inspectdb`/`\d` |
| P2 | Mọi ràng buộc 2.1 tồn tại **ở tầng DB** | `psql \d+ <bảng>` thấy constraint/index thật, không chỉ code |
| P3 | `makemigrations --check --dry-run` → `No changes detected` | chạy |
| P4 | `migrate` sạch trên DB mới tạo lại | drop + create + migrate |
| P5 | Sequence `Mach` bắt đầu từ 1000 | seed xong: `SELECT min(id) FROM core_mach` ≥ 1000 |
| P6 | Trich partial unique chặn đúng | test 3 + `psql` xác nhận index có `WHERE` |
| P7 | `score` là generated, ghi tay bị DB từ chối | test 4 |
| P8 | **Path-race**: 2 reply đồng thời không trùng path | test 2, chạy thật |
| P9 | **Hệ số tươi đổi thứ hạng** | test 1 |
| P10 | Seed đúng đơn 2.4, chạy 2 lần không nhân đôi | chạy `seed_dev` ×2 + đếm bằng SQL |
| P11 | Mọi test mới đã THỬ PHÁ | dán output ĐỎ |
| P12 | **Không hồi quy**: 32 test Phase 0 vẫn xanh, 0 warning, `codegen:check` khớp, lint/build sạch | chạy |
| P13 | Chưa commit; không rác trong cây | `git status` |

## 4. Rủi ro đã biết
1. **`GeneratedField` cần Django ≥ 5.0** — có (5.2.17). Nếu vướng backend thì báo, đừng lặng lẽ
   đổi sang lưu tay (PLAN cấm).
2. **Test path-race dễ thành phép đo rỗng**: mock hai luồng thì test luôn xanh. Phải dùng
   transaction/thread thật, và **thử phá bằng cách bỏ `select_for_update`** — nếu test vẫn xanh
   thì nó không đo gì.
3. **Seed "idempotent" dễ nói suông** — phải đếm bằng SQL sau lượt 2, không đọc log.
4. `filterwarnings=["error"]`: `GeneratedField` + `db_persist` có thể sinh cảnh báo tuỳ backend;
   vướng thì liệt kê từng dòng ignore kèm lý do, không ignore cả nhóm.
