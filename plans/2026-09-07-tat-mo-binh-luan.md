# Tắt / mở bình luận cho bài viết (Mach) — quyền tác giả, ranh giới mod khoá

Chốt 2026-09-07. User: Cho phép user (tác giả bài viết) tắt bình luận hoặc mở bình luận (trong trường hợp không phải mod khoá).

## 0 · Ranh giới & Cái KHÔNG làm

1. **Ranh giới mod khoá (`locked_at`)**:
   - `locked_at` là mod khoá, đóng băng toàn diện tương tác (đọc được, cấm mọi tương tác — PLAN 5.10).
   - Tác giả **KHÔNG ĐƯỢC PHÉP** bật hay tắt bình luận khi mạch đang bị mod khoá (endpoint trả 403 `mach_bi_khoa`).
   - Mod khoá luôn có quyền ưu tiên cao nhất, đè lên mọi thiết lập bình luận của tác giả.

2. **Ranh giới đóng sổ (`status = "closed"`)**:
   - Đóng sổ là tác giả kết thúc nhật ký hành trình (không nối mốc được nữa, nhưng theo PLAN 5.1 người khác **vẫn bình luận được**).
   - `tat_binh_luan` là trục độc lập: một bài viết dù đang mở hay đã đóng sổ, tác giả vẫn có quyền tắt hoặc mở bình luận.

3. **Không xoá dữ liệu bình luận cũ**:
   - Tắt bình luận chỉ chặn người dùng tạo bình luận mới hoặc gửi reply. Toàn bộ bình luận cũ và ngăn kéo vẫn hiển thị nguyên vẹn để người đọc tra cứu.
   - Các hành động xoá/sửa bình luận của chính chủ các bình luận đã có vẫn theo luật thông thường.

## 1 · Thiết kế dữ liệu

### 1.1 · Model `Mach`
- Thêm cột `tat_binh_luan = models.BooleanField(default=False)`.
- Giá trị mặc định là `False` (bình luận mở bình thường).
- Migration mới: `api/core/migrations/0031_mach_tat_binh_luan.py`.

### 1.2 · Hàm ghi domain (`core/ghi.py`)
- `dat_tat_binh_luan(*, mach: Mach, tat: bool) -> bool`:
  - `atomic()`, `select_for_update()` trên hàng `Mach`.
  - Cập nhật `tat_binh_luan = tat`.
  - Giữ đúng thứ tự khoá hàng: `Mach` khoá sau cùng.
- `tao_mach`: nhận thêm `tat_binh_luan: bool = False`.

## 2 · Thiết kế API

### 2.1 · Endpoint đổi trạng thái bình luận
- Route: `POST /api/v1/machs/{int:mach_id}/tat-binh-luan`
- Schema vào: `DatTatBinhLuanIn { tat: bool }`
- Schema ra: `200: MachChiTietOut`
- `auth=dang_nhap`
- Quyền:
  - `doi_chu_so_huu(request.user, mach.author_id, "mạch")` ⇒ 403 `khong_phai_chu`.
  - `doi_mach_tuong_tac_duoc(mach)` ⇒ 403 `mach_bi_khoa` nếu mod đã khoá.
- Gọi `lam_moi_mach(mach)` để kích hoạt revalidation cache ISR.

### 2.2 · Endpoint viết bình luận
- `POST /api/v1/machs/{int:mach_id}/comments`:
  - Sau `doi_mach_tuong_tac_duoc(mach)`, kiểm tra `if mach.tat_binh_luan:`
  - Ném `LoiGhi(403, BINH_LUAN_DA_TAT, "Tác giả đã tắt tính năng bình luận cho mạch này.")`.

### 2.3 · Schema đọc
- `MachChiTietOut`: thêm `tat_binh_luan: bool`.

## 3 · Thiết kế Giao diện (`apps/web`)

1. `useMach()`: Bổ sung `tatBinhLuan: boolean` vào ngữ cảnh `NguCanhMach`.
2. `Composer`:
   - Nếu `tatBinhLuan === true`: Hiển thị thông báo `Tác giả đã tắt tính năng bình luận cho bài viết này.` (thay vì khung soạn thảo).
3. `HanhDongBinhLuan`:
   - Ẩn nút "Trả lời" dưới các bình luận cũ khi `tatBinhLuan === true`.
4. `KhoiChuMach`:
   - Dành cho tác giả bài viết:
     - Khi `tatBinhLuan === false`: Hiện nút "Tắt bình luận".
     - Khi `tatBinhLuan === true`: Hiện nút "Mở bình luận".
     - Khi bấm: gọi `tatBinhLuanMach(...)` và `router.refresh()`.
5. `FormDangMach`:
   - Tuỳ chọn checkbox "Tắt bình luận" khi soạn bài mới.
