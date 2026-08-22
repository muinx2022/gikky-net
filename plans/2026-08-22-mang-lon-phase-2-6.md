# Kế hoạch bốn MẢNG LỚN — Phase 2 → 6

> User chốt 2026-08-22: **làm từng mảng lớn, không chấm giữa chừng**; nghiệm thu + phản biện
> chạy **một lượt duy nhất ở cuối**, trên toàn bộ bốn mảng. Không lượt vá cho từng miếng.
> Đây là ngoại lệ 2 của `D:\Projects\CLAUDE.md` ("ý user thắng mặc định") — ghi ra để lượt
> nghiệm thu cuối biết vì sao không có vết chấm ở giữa.
>
> Nền: Phase 1 đóng ở `1f7ac03` (459 test Python · 250 e2e · 0 warning · SEO 100).

## Quyết định đã chốt sẵn — thợ KHÔNG phải hỏi

| Việc | Chốt | Vì sao |
|---|---|---|
| Cơ chế auth | **allauth headless**, mount `/api/_allauth/`, **session cookie** (client `browser`) | Dev same-origin qua `rewrites`, prod qua Caddy ⇒ cookie chạy thẳng, không cần token store |
| Google OAuth | Cài, nhưng **gác sau biến môi trường**. Không có `GOOGLE_CLIENT_ID` ⇒ **không đăng ký provider và KHÔNG render nút** | Không có credential để test thật. Nút vĩnh viễn không bấm được là thứ PLAN mục 4 vừa cấm |
| Xác thực email | **Bắt buộc**. Dev dùng `filebased.EmailBackend` ⇒ e2e đọc file mail lấy link, đi đúng luồng thật | Không có SMTP. Đọc từ file vẫn là luồng thật, khác hẳn việc tắt xác thực đi cho dễ |
| Username | Chọn lúc đăng ký | `/u/<username>` là danh tính công khai (PLAN 5.9) |
| `client` singleton | **Vẫn cấm.** Truyền `baseUrl` + `headers: { cookie }` **theo từng lời gọi** | Đúng lý do `CLAUDE.md` nêu: singleton dùng chung cả tiến trình ⇒ rò session user A sang user B |
| Markdown | `body` render markdown + sanitize **allowlist** (không blocklist) | Nợ hẹn từ 1c |
| Ảnh (Phase 5) | **HOÃN** — máy không có Docker, chưa có R2 | Không tự cài Docker (user chốt 2026-08-21) |

## Mảng A — Phase 2: tài khoản + toàn bộ đường ghi

**Backend.** allauth headless (đăng ký · đăng nhập · đăng xuất · xác thực email · quên/đổi mật
khẩu · Google gác env) · CSRF · `GET /api/v1/me` (không cache, không per-user rò vào page cache) ·
rate limit theo PLAN mục 6.
Đường ghi: tạo mạch (= mốc 1) · nối mốc (**3/ngày giờ VN**) · sửa mốc (`MocRevision` đủ 5 trường) ·
xoá (bia mộ) · đóng sổ + `ket_qua` + mở lại · bình luận (khán đài + ngăn kéo, `anchor_moc_seq`
nullable) · sửa/xoá bình luận · **vote** · reaction.

**Nợ Phase 1 phải trả ở đây** (đã hẹn từ 1a/1b, có tripwire sẵn):
- Schema ghi **cấm có `created_at`** — `test_schema_ghi_khong_co_created_at.py` đang chờ.
- `DELETE /comments/{id}` dọn **`Vote` mồ côi**, và xoá THẬT chỉ khi **không có reply con** và
  **chưa TỪNG được trích** (PLAN 5.3).
- **`Trich` chéo mạch**: ràng buộc `comment.mach == moc.mach`.
- **`DONG-BO-DIEM`**: nay có endpoint vote thật ⇒ cân lại phương án rẻ đã ghi trong
  `api/core/ghi.py` (`Mach.objects.filter(pk=…).update(...)` thay vì đếm lại 4 cột).

**Frontend.** Trang đăng ký / đăng nhập / quên mật khẩu / đổi mật khẩu · header hiện user + đăng
xuất · **mũi tên vote SỐNG** (optimistic) · composer thật · "Trả lời" inline · menu `⋯`
(sửa/xoá/báo cáo).

## Mảng B — Phase 3: mặt BÃO + vòng lặp quay lại

Mặt BÃO (PLAN 5.5) · `POST /machs/{id}/seen` + `last_seen_entry_seq` + vạch mới · follow mạch ·
notification (mốc mới, được trích, reply) · **trích vào sổ** đủ 4 rào của PLAN 5.6 ·
**ISR/cache PLAN 8.4** — và ISR là chỗ trả ba nợ cùng lúc: `N+1-NGAN-KEO`, `NAV-GHI-CUNG`,
`DANG-DOC-ROUND-TRIP`.

## Mảng C — Phase 4: khu quản trị

`apps/admin` thật: đăng nhập mod · hàng đợi báo cáo · ẩn/gỡ ẩn mốc + bình luận + mạch · khoá user ·
CRUD Sub. `NinjaAPI` thứ hai ở `/api/admin/` ⇒ **đủ 3 việc** của `CLAUDE.md` (mount · registry ·
subpath trong `package.json`).

## Mảng D — Phase 6: đánh bóng ra mắt

OG image · RSS · trang 404/500 thật · digest email · rate limit tầng biên · backup script.
Bỏ qua thứ cần Docker.

## Nghiệm thu CUỐI — chấm một lượt trên cả bốn mảng

| # | Tiêu chí |
|---|---|
| M1 | Đăng ký → nhận mail → xác thực → đăng nhập → header hiện user → đăng xuất: chạy thật, e2e |
| M2 | Không có nút nào vĩnh viễn không bấm được (Google tắt ⇒ **vắng mặt**, không disabled) |
| M3 | Mọi đường ghi có kiểm quyền; user A **không** sửa/xoá được của user B — test cho **từng** endpoint |
| M4 | `client` singleton vẫn không rò; mọi lời gọi API có `baseUrl`; hàng rào cũ còn răng |
| M5 | Rate limit mốc 3/ngày giờ VN đúng ranh giới nửa đêm |
| M6 | 4 nợ Phase 1 ở Mảng A đã trả, mỗi cái có bài đo giết được mutant |
| M7 | Markdown sanitize theo allowlist: thử `<script>`, `onerror=`, `javascript:` |
| M8 | Mặt BÃO đúng PLAN 5.5; vạch mới đúng `last_seen_entry_seq` |
| M9 | Trích đủ 4 rào PLAN 5.6 (1 trích/mốc · 2 dấu thời gian · không tính tự trích · render tách bạch) |
| M10 | Khu quản trị: mod làm được việc của mod, user thường **không** vào được |
| M11 | Không hồi quy Phase 1: ≥ 459 Python + ≥ 250 e2e, 0 warning, codegen khớp, lint/build/tsc sạch, SEO ≥ 90 |
| M12 | Chưa commit cho tới khi phiên chính chốt; `seed_dev --reset` chạy được |

**Luật dừng ở lượt cuối:** chỉ mở lượt vá khi có lỗi **HÀNH VI** hạng NẶNG/VỪA hoặc **lỗi bảo
mật/phân quyền ở bất kỳ hạng nào**. Lỗi câu chữ → phiên chính gom sửa, không mở vòng. Trần **2**
lượt vá; hết trần thì ghi nợ có tên.
