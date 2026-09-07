# Sắp xếp chuyên mục (admin drag-drop) + sidebar theo thứ tự mới

Chốt 2026-09-07. User: phần admin / chuyên mục hỗ trợ kéo thả đổi thứ tự; phần bên phải front (sidebar «Chuyên mục») theo `order` mới.

## Trạng thái

- **Chặng**: 1 — plan (chưa thực thi)
- **Nền**: `Sub` không có cột thứ tự; `GET /api/v1/subs` và `GET /api/admin/subs` đều `order_by("slug")`. Sidebar (`apps/web/components/sidebar.tsx`) render đúng thứ tự mảng API trả về — **không tự sắp lại**.

## 0 · Ranh giới

### LÀM

1. **Model + migration**: thêm `Sub.thu_tu` (`PositiveIntegerField`, mặc định `0`). Migration `0032_…`: thêm cột + **backfill** gán `0,1,2,…` theo `slug` hiện tại (giữ UX alphabet như hôm nay cho tới khi admin kéo lần đầu).
2. **API công khai**: `GET /api/v1/subs` đổi thành `order_by("thu_tu", "slug")`. Cập nhật docstring (bỏ khẳng định «sắp theo slug» như hợp đồng).
3. **API admin**:
   - `GET /api/admin/subs` cùng `order_by("thu_tu", "slug")`.
   - `POST /api/admin/subs` (tạo): gán `thu_tu = max(thu_tu)+1` (cuối danh sách).
   - Endpoint mới: `PUT /api/admin/subs/thu-tu` · `operation_id="quan_tri_dat_thu_tu_sub"` · body `{ "slugs": string[] }` — **đúng một phép hoán vị đầy đủ** của mọi slug hiện có (thiếu / thừa / trùng → 400). Gán `thu_tu = index`. Trả `list[SubQuanTriOut]` theo thứ tự mới. Ghi `AuditLog` một lần (`AUDIT_DAT_THU_TU_SUB`), payload gồm danh sách slug theo thứ tự mới.
4. **Schema**: `SapXepSubIn` (`slugs: list[str]`); `SubQuanTriOut` **có thể** thêm `thu_tu` (tiện UI/debug) — nếu thêm thì cập nhật mọi assert dict đầy đủ trong `test_api_quan_tri_sub.py`. `SubChiTietOut` công khai **không** bắt buộc thêm `thu_tu` (sidebar chỉ cần thứ tự mảng).
5. **Admin UI** (`apps/admin/app/subs/page.tsx`): bảng chuyên mục kéo thả đổi thứ tự (HTML5 DnD trên hàng / nút cầm — **không** thêm dependency mới kiểu `@dnd-kit`). Thả xong gọi `quanTriDatThuTuSub`; optimistic cập nhật local; lỗi thì `nap()` lại. Không đổi CRUD tạo/sửa/xoá/mod hiện có.
6. **Codegen**: sau khi OpenAPI đổi → `pnpm codegen` (client admin).
7. **Front web**: không đổi JSX sidebar nếu API đã trả đúng thứ tự. Cập nhật comment / docstring chỗ còn nói «sắp theo slug» (`feeds.py`, test tên/doc nếu cần). Hệ quả: nav trình duyệt (`docCacSubOTrinhDuyet`) và sitemap cũng theo cùng thứ tự — chấp nhận, không tách.
8. **Seed / lệnh tạo**: `tao_sub` và đường tạo trong seed gán `thu_tu` cuối danh sách (hoặc chỉ số trong `SUBS` khi tạo mới). Không bắt buộc rewrite cả `SUBS` nếu migration + create path đủ.

### KHÔNG LÀM

- Không đổi slug / redirect 301.
- Không kéo thả trên front công khai.
- Không đổi thứ tự tab «Chuyên mục» hồ sơ (`/me/subs` — sắp theo lúc theo dõi).
- Không đổi bảng «top sub» dashboard admin (vẫn theo số mạch).
- Không đụng file đang `M` của phiên khác: `apps/web/components/noi-dung-the.module.css`, `plans/2026-09-07-anh-feed-khong-ep-ngang.md`.
- Không commit code trừ khi user bảo (chặng 1 chỉ commit file plan này).

## 1 · Hành vi đích

| Ca | Kết quả |
|---|---|
| Admin mở `/subs` | danh sách theo `thu_tu` tăng dần |
| Kéo hàng A xuống dưới B, thả | `PUT …/thu-tu` 200; refresh bảng giữ thứ tự mới |
| `GET /api/v1/subs` | cùng thứ tự `thu_tu` |
| Sidebar `/` và `/s/<slug>` khối «Chuyên mục» | đúng thứ tự admin vừa đặt |
| Tạo chuyên mục mới | đứng **cuối** |
| Body `slugs` thiếu/thừa/trùng so với DB | 400 `tham_so_khong_hop_le`, không ghi nửa vời |
| Khách / không staff gọi `PUT` | 401/403 như mọi cửa admin |

## 2 · File dự kiến chạm

| Vùng | File |
|---|---|
| Model | `api/core/models/dien_dan.py` |
| Migration | `api/core/migrations/0032_sub_thu_tu.py` (tên exact do makemigrations) |
| Audit | `api/core/ghi.py` (`AUDIT_DAT_THU_TU_SUB`) |
| Admin API | `api/api/quan_tri_sub.py`, `api/api/quan_tri_schemas.py` |
| Public API | `api/api/feeds.py` (`liet_ke_sub`) |
| Tạo tay | `api/core/management/commands/tao_sub.py` (và seed nếu cần) |
| Test | `api/tests/test_api_sub.py`, `api/tests/test_api_quan_tri_sub.py`, `api/tests/_quan_tri.py` (đăng ký endpoint mới nếu bảng quyền quét), có thể `test_operation_id` / registry nếu có |
| Admin UI | `apps/admin/app/subs/page.tsx` (+ CSS/Tailwind tối thiểu cho handle nếu cần) |
| Client | `packages/api-client` (sinh lại) |

## 3 · Tiêu chí nghiệm thu (đo được)

1. **Migration**: `pnpm api:migrate` (hoặc `node scripts/py.mjs migrate`) — exit 0; cột `core_sub.thu_tu` tồn tại; mọi hàng có giá trị.
2. **Pytest sắp xếp công khai**: đổi / thêm bài trong `test_api_sub.py` — sau khi gán `thu_tu` lệch alphabet, `GET /api/v1/subs` trả đúng theo `thu_tu` (không còn bắt `slugs == sorted(slugs)` như hợp đồng duy nhất). Bài cũ «đủ mọi slug» vẫn giữ.
3. **Pytest admin**: bài mới — staff `PUT /api/admin/subs/thu-tu` với hoán vị hợp lệ → 200 + DB khớp; thiếu slug → 400; không staff → 403.
4. **Codegen**: `pnpm codegen` (hoặc `codegen:check` sau khi đã sinh) — exit 0; có `quanTriDatThuTuSub` (hoặc tên đúng theo `operation_id`) trong `@gikky/api-client/admin`.
5. **Lint/build admin**: `pnpm --filter @gikky/admin lint` và build admin — exit 0, 0 warning liên quan bản vá.
6. **Unit Python gói liên quan**: `pnpm test -- -k "sub or quan_tri_sub" -q` (hoặc tương đương hẹp hơn nếu quá rộng) — xanh trên phạm vi đã đụng.
7. **Kiểm tay / trình duyệt** (báo cáo thực thi): admin kéo đổi thứ tự → reload `/` → sidebar «Chuyên mục» khớp.

## 4 · Ghi chú thực thi

- Tree lúc lập plan: `M apps/web/components/noi-dung-the.module.css`, `M plans/2026-09-07-anh-feed-khong-ep-ngang.md` — **không đụng**.
- `SubQuanTriOut` assert dict đầy đủ trong test — nếu thêm `thu_tu` phải sửa assert, không nuốt bằng `in`.
- Route `PUT /subs/thu-tu` phải đăng ký **trước** hoặc tách path rõ để không bị `/subs/{slug}` nuốt (ninja: path tĩnh `thu-tu` vs `{slug}` — ưu tiên khai route tĩnh riêng, kiểm OpenAPI).
- Thử phá bài đo mới: gửi thiếu một slug → phải đỏ nếu handler quên kiểm tập hợp.
