# Theo dõi chuyên mục — nút trên `/s/<slug>` + tab quản lý trong hồ sơ

Chốt 2026-08-24 theo yêu cầu user:

> Thêm 1 nút Theo dõi để theo dõi chuyên mục. Khi bấm Theo dõi, nút thành Hủy.
> Trong profile, thêm 1 tab quản lý những chuyên mục đã theo dõi, có nút Hủy.

## 0. Nền

`Follow` hiện có là **theo MẠCH** (`core/models/tuong_tac.py`), không dùng lại được: khoá
ngoài trỏ `Mach`, và nó còn mang `moc_da_xem` (vạch mới) — một khái niệm chuyên mục không
có. Nên đây là bảng mới, không phải thêm cột.

Nền đo trước lượt này: `pnpm test` **1287 passed**, `pnpm e2e:don-vi` **301 passed**
(số của lượt Tiptap, chưa chạy lại sau ba việc giao diện của hôm nay).

## 1. Backend

| # | Việc | Tiêu chí ĐO ĐƯỢC |
|---|---|---|
| B1 | Model `TheoSub(user, sub, created_at)` + migration | `UniqueConstraint(user, sub)`; `makemigrations --check` sạch sau khi áp |
| B2 | `core/ghi.py::dat_theo_sub` / `bo_theo_sub` — **idempotent** | Gọi 2 lần liên tiếp: không lỗi, `TheoSub.objects.count()` không đổi |
| B3 | `POST /subs/{slug}/theo` → `TheoSubOut{following}` | 401 cho khách · 404 slug lạ · 200 + `following=true` |
| B4 | `DELETE /subs/{slug}/theo` | 200 + `following=false`; gọi khi chưa theo vẫn 200 (idempotent) |
| B5 | `GET /subs/{slug}/me` → `{dang_nhap, following}` | Khách: `dang_nhap=false, following=false`, **không 401** (cùng khuôn `/machs/{id}/me`) |
| B6 | `GET /me/subs` → `list[SubDangTheoOut]` | 401 cho khách; thứ tự **mới theo trước** (`-created_at`) |
| B7 | `operation_id` tường minh cho cả 4 | `test_operation_id.py` xanh |

**Khoá:** không endpoint nào ở đây chạm `Mach`/`Moc`/`Comment`, nên **không** đụng vào
thứ tự khoá `Comment/Moc → Mach → MocAnh` của `CLAUDE.md`. `TheoSub` là một hàng độc lập.

## 2. Frontend

| # | Việc | Tiêu chí ĐO ĐƯỢC |
|---|---|---|
| F1 | `components/nut-theo-sub.tsx` — "Theo dõi" ⇄ "Hủy" | `aria-pressed` đổi theo; khách **không thấy nút** (PLAN mục 4) |
| F2 | Cắm vào `sub-header` của `/s/<slug>` | Nút nằm trong `[data-testid=sub-header]` |
| F3 | Tab hồ sơ thứ tư `chuyen-muc` — "Chuyên mục" | `?tab=chuyen-muc`; là **tab riêng** (chỉ hồ sơ mình) |
| F4 | Mỗi dòng trong tab có nút "Hủy", bấm là rời danh sách | Sau khi bấm, dòng biến mất mà **không tải lại trang** |
| F5 | `pnpm codegen` | `codegen:check` sạch |

**Trang `/s/<slug>` là trang server có cache.** Trạng thái "tôi có theo không" là dữ liệu
per-user ⇒ **cấm** nạp ở server (PLAN 8.4 — một bản HTML dùng chung). Nút tự hỏi
`GET /subs/{slug}/me` trong `useEffect`, cùng khuôn `trang-thai-toi.tsx`.

## 3. Thử phá (luật 4 của `D:\Projects\CLAUDE.md`)

- Bỏ `UniqueConstraint` ⇒ bài đo idempotent phải ĐỎ.
- Cho `POST` bỏ qua `dang_nhap` ⇒ bài đo 401 phải ĐỎ.
- Cho `GET /me/subs` trả cả sub của người khác ⇒ bài đo cách ly phải ĐỎ.

## 4. Ngoài phạm vi, nói rõ

- **Không** đếm follower lên header chuyên mục (`so_mach · lập …` giữ nguyên).
- **Không** gửi thông báo khi chuyên mục có mạch mới. Theo dõi lượt này chỉ là **sổ tay
  riêng**, chưa nối vào `core/thong_bao.py` — nếu không nói ra, cái nút hứa một thứ nó
  không làm.
