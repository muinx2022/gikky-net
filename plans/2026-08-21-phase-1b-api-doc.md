# Plan con — Phase 1b: API đọc

> Nguồn: `PLAN.md` **mục 7 (bảng API v1)**, 5.3, 5.4, 5.5, 5.9, mục 10 Phase 1.
> Quy trình: `D:\Projects\CLAUDE.md` (5 chặng). Ngày 2026-08-21.
> Phase 1 tách 3: 1a lõi dữ liệu ✔ · **1b API đọc** · 1c frontend mặt CẶN.

## 0. Phạm vi

**Trong:** 6 endpoint ĐỌC của PLAN mục 7 + codegen ra TS client.

| Endpoint | PLAN |
|---|---|
| `GET /feeds/moi`, `GET /feeds/dang-dien-ra` | mục 7, 5.9 — cursor keyset, `?sub=` lọc |
| `GET /machs/{id}` | mach + mốc + `face` server đã tính + spine; **không chứa gì per-user** |
| `GET /machs/{id}/comments` | khán đài, `?sort=hay_nhat\|moi_nhat\|cu_nhat`, **server sort, trả cây đã dựng** |
| `GET /mocs/{id}/comments` | lát cắt ngăn kéo, cũ→mới |
| `GET /mocs/{id}/revisions` | danh sách bản cũ cho UI diff |
| `GET /users/{username}` | hồ sơ công khai |

**NGOÀI — đừng lấn:** mọi endpoint GHI (Phase 2), `GET /machs/{id}/me` (Phase 3 — 8.4 điểm 4),
allauth (Phase 2), ISR/cache/middleware (Phase 3), frontend (1c).

## 1. Giá trị đã chốt

| Hạng mục | Chốt | Lý do |
|---|---|---|
| `operation_id` | **tường minh cho TỪNG endpoint**, đặt tên ổn định (`liet_ke_feed_moi`, `xem_mach`, …) | luật `CLAUDE.md`: không khai thì tên hàm TS trôi theo tên hàm Python |
| Lỗi | `{detail, code}` đúng PLAN mục 7; `code` là hằng chuỗi ổn định | frontend bắt theo `code`, không parse `detail` |
| **`face` ở 1b** | tính **thuần luật thời gian** của PLAN 5.5 (`status`, `locked_at`, `now − last_activity_at ≤ 72h`); **vế "user đã follow / từng bình luận" CHƯA áp** | 1b chưa có auth. `GET /machs/{id}` phải **cache được** ⇒ cấm mọi thứ per-user (8.4) |
| Cursor keyset | opaque base64 của `(created_at ISO, id)`; sai định dạng → 400 `code="cursor_khong_hop_le"` | PLAN 5.9; khoá `(created_at, id)` ổn định |
| `hay_nhat` | **1 trang 50 thread gốc**, `?offset=` cho "xem thêm"; **không** cursor | PLAN 5.3 chốt đúng vậy, kèm lý do "chấp nhận trôi nhẹ vì rank động" |
| `moi_nhat` / `cu_nhat` | cursor keyset thật trên `(created_at, id)` | PLAN 5.3 |
| Hình cây bình luận | **lồng nhau (nested)**, mỗi node có `depth`; server dựng cây + sắp sibling | PLAN mục 7 "trả cây đã dựng"; PLAN 5.3 nói UI render ≤6 tầng — **đó là việc của 1c**, API trả đủ |
| Nội dung bị xoá / ẩn | `Moc.deleted_at` → **bia mộ** (trả node với `da_xoa=true`, không body) · `Comment.deleted_at` → `[đã xoá]` nếu có reply, biến mất nếu không · `hidden_at` → **ẩn khỏi API công khai** (Phase 4 mới có "tác giả vẫn thấy") | PLAN 5.2, 5.3, 5.10 |
| Wilson + hệ số tươi | dùng lại `core/xep_hang.py` của 1a, **tính lúc query trong Python**, không lưu rank | PLAN 5.3 ghi rõ "không lưu rank" |
| Spine | server trả mảng `{seq, occurred_at, so_binh_luan, da_xoa}` | 9.2 |

## 2. Hạng mục việc

### 2.1 Router + schema
Thêm vào `api/api/v1.py` (hoặc tách module, giữ **một** `NinjaAPI` khoá `v1` — thêm `NinjaAPI`
mới là 3 việc, xem `CLAUDE.md`). Schema Ninja cho từng response; **cấm** khai type trùng ở
frontend (PLAN 8.3).

### 2.2 Chống N+1 — tiêu chí ĐO ĐƯỢC, không phải lời hứa
Mọi endpoint phải có test ghim **số truy vấn** (`django_assert_num_queries`). Không có ràng buộc
này thì `GET /machs/{id}/comments` trên seed 24 bình luận sẽ âm thầm bắn 25+ query, và không ai
biết cho tới lúc mạch có 500 bình luận.

### 2.3 Codegen
`pnpm codegen` sinh lại client; `pnpm codegen:check` phải khớp. Schema OpenAPI **sẽ đổi** ở phase
này (khác 1a) — đó là dự kiến.

### 2.4 Test (mọi test mới THỬ PHÁ — luật 4)
1. **`hay_nhat` xếp đúng thứ tự wilson + hệ số tươi** trên dữ liệu seed; đổi công thức → ĐỎ
2. **Ngăn kéo `GET /mocs/{id}/comments` trả đúng LÁT CẮT**: thread có `anchor_moc_seq == seq`,
   **kèm cả reply viết muộn** (PLAN nguyên tắc 6 — reply đi theo gốc), sort **cũ→mới**
3. **Mốc 6 của seed (0 bình luận) trả mảng rỗng + có `question_for_crowd`** — PLAN 5.4 luật 4
4. **`face` = CẶN** cho mạch HPG đã đóng; đổi `last_activity_at` về gần đây → `face` đổi
5. **Cursor keyset không trùng, không sót** khi trang 2 chồng biên (thêm/không thêm dữ liệu)
6. **`GET /machs/{id}` không chứa trường per-user nào** — test liệt kê key và assert
7. **Ba vai của seed tách nhau** (1a W6): endpoint dùng cho "mồi bung" phải trả comment điểm cao
   nhất **trong dải gập**, không phải cao nhất toàn mạch, không phải comment đã trích
8. **`created_at` không xuất hiện trong bất kỳ schema GHI nào** — 1b chưa có schema ghi, nên test
   này ghim dạng "không có schema nào tên `*In` chứa `created_at`" (chuyển giao từ 1a W3)
9. Slug lệch → `GET /machs/{id}` vẫn trả đúng mạch (id là khoá; 301 là việc của 1c)

## 3. Tiêu chí nghiệm thu

| # | Tiêu chí | Cách đo |
|---|---|---|
| R1 | 6 endpoint sống, đúng path PLAN mục 7 | curl thật từng cái trên seed |
| R2 | Mọi endpoint có `operation_id` tường minh | đọc code + grep `openapi.json` |
| R3 | `GET /machs/{id}` **không có trường per-user** | test 6 |
| R4 | `face` đúng luật thời gian; HPG (đóng, nguội) → `can` | test 4 |
| R5 | 3 sort của khán đài đúng thứ tự | test 1 + curl |
| R6 | Ngăn kéo đúng lát cắt, cũ→mới, có reply muộn | test 2 |
| R7 | Mốc 0 bình luận → rỗng + câu mồi | test 3 |
| R8 | Cursor keyset không trùng/sót | test 5 |
| R9 | **Số query ghim** cho cả 6 endpoint | `django_assert_num_queries` |
| R10 | Nội dung `hidden_at` không lọt ra API công khai | test |
| R11 | `pnpm codegen` sinh client mới; `codegen:check` khớp; hàng rào `client` singleton vẫn xanh | chạy |
| R12 | **Không hồi quy**: 165 test 1a xanh, 0 warning, lint/build sạch | chạy |
| R13 | Chưa commit; không rác | `git status` |

## 4. Rủi ro đã biết
1. **Dựng cây trong Python dễ thành O(n²)** — gom một lần rồi dựng bằng dict, đừng đệ quy query.
2. **`hay_nhat` trộn 2 tầng sort**: rank chỉ áp cho **bình luận gốc**; sibling trong thread sort
   wilson thuần (PLAN 5.3). Rất dễ áp nhầm hệ số tươi cho reply.
3. **Cursor để lộ `created_at`** — base64 không phải mã hoá; chấp nhận (dữ liệu công khai), nhưng
   đừng nhét gì khác vào.
4. **`face` per-user rò vào response cache được** — đây là điểm PLAN 8.4 gọi là "dễ làm sai nhất".
   1b chỉ được tính vế thời gian; vế viewer là Phase 3.
