# Nới quyền chèn ảnh (khu quản trị) cho mọi staff

Chốt 2026-09-04. Nối tiếp `plans/2026-09-04-dang-bai-tu-admin.md` — lượt đó phát hiện (qua phản
biện) rằng mod thường đăng bài thay mặt tài khoản đội xong thì **không đính được ảnh nào**: hai cửa
tải ảnh của khu quản trị (`quan_tri_tai_anh_moc`, `quan_tri_tai_anh_noi_dung`) đều
`chan_neu_khong_phai_superuser`, trong khi `POST /admin/machs/hen-gio` (tạo bài) thì không. Đã ghi sổ
`P-20260904-5`, hỏi user, user chốt: **"nới quyền chèn ảnh cho staff luôn đi"**.

## 1. Phạm vi — CHÈN ảnh, không phải mọi thao tác ảnh/nội dung

User chỉ nói "chèn ảnh". `api/api/quan_tri_sua_bai.py` có năm cửa trong `CHI_SUPERUSER`
(`test_api_quan_tri_phan_quyen.py`):

| Cửa | operation_id | Nới cho staff? |
|---|---|---|
| Sửa chữ mốc | `quan_tri_sua_moc` | **KHÔNG** — "viết lại" nội dung người khác, khác hẳn "chèn" |
| Đổi tiêu đề mạch | `quan_tri_sua_tieu_de_mach` | **KHÔNG** — cùng lý do |
| Tải ảnh vào gallery mốc | `quan_tri_tai_anh_moc` | **CÓ** |
| Tải ảnh nhúng thân bài | `quan_tri_tai_anh_noi_dung` | **CÓ** |
| Gỡ ảnh khỏi gallery | `quan_tri_xoa_anh_moc` | **KHÔNG** — user không nói "xoá"; gỡ ảnh người
khác là một quyết định khác "thêm ảnh của chính mình vào bài mình vừa đăng". Không sửa trong lượt
này — nếu bất tiện thật (mod chọn nhầm ảnh, không tự gỡ được) thì đó là lượt sau, ghi sổ nếu gặp.

Giữ nguyên luật gốc "Ghi thì chỉ superuser" của file — carve-out CHỈ áp cho hai cửa TẢI ảnh, ghi rõ
lý do ngay trong docstring file (không âm thầm nới cả nhóm).

## 2. Backend

### 2.1 `api/api/quan_tri_sua_bai.py`

- Bỏ dòng `if (chan := chan_neu_khong_phai_superuser(...)) is not None: return chan` ở
  `tai_anh_moc_quan_tri` và `tai_anh_noi_dung_quan_tri`. `ChiMod` (staff) vẫn là cổng chung của cả
  router — không đổi.
- Cập nhật docstring module (khối "Ba luật của file") — luật 1 giờ có ngoại lệ tường minh, kèm lý do
  (mod đăng bài thay tài khoản đội cần đính ảnh, không phải "sửa nội dung của người khác" theo nghĩa
  viết lại).
- **`quan_tri_tai_anh_noi_dung` (ảnh nhúng) phải thêm hạn mức.** Docstring hiện tại của chính file
  này nói rõ lý do KHÔNG có hạn mức 30 ảnh/ngày: *"Cửa này superuser-only, nên lý do đó không còn."*
  Bỏ điều kiện superuser thì lý do quay lại — dùng LẠI đúng hạ tầng công khai
  (`core/han_muc.py::dem_anh_noi_dung_trong_ngay_vn` + `tran_anh_noi_dung_moi_ngay`,
  `settings.HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY`), đếm theo `request.user` (đúng người gọi, không phải
  tài khoản đội) — cùng cửa sổ ngày lịch VN, cùng mã lỗi `429 qua_han_muc_anh_noi_dung` với
  `POST /me/anh`. KHÔNG thêm setting mới, KHÔNG số riêng cho khu quản trị — một mod cũng chỉ là một
  người dùng đã đăng nhập, cùng loại rủi ro lạm dụng đĩa.
  `quan_tri_tai_anh_moc` (gallery) KHÔNG cần hạn mức mới: đã bị chặn tự nhiên bởi
  `SO_ANH_TOI_DA_MOI_MOC` (10 ảnh/mốc, enforce trong khoá ở `core/ghi.py::them_anh_moc`) bất kể ai gọi.

### 2.2 `api/tests/test_api_quan_tri_phan_quyen.py`

- Bỏ `"quan_tri_tai_anh_moc"` và `"quan_tri_tai_anh_noi_dung"` khỏi `CHI_SUPERUSER`. Giữ nguyên ba
  mục còn lại. `test_mod_QUA_duoc_moi_endpoint` / `test_CHI_SUPERUSER_that_su_chan_mod` /
  `test_superuser_QUA_duoc_nhung_endpoint_CHI_SUPERUSER` tự chạy lại đúng theo set mới — không sửa
  logic bài đo, chỉ sửa set.
- Thêm bài đo mới (không có sẵn): mod thường (không superuser) gọi `POST /admin/mocs/{id}/anh` và
  `POST /admin/anh` với file ảnh thật (dùng `kho_anh` fixture) → **201 thật**, không chỉ "không phải
  401/403". `test_mod_QUA_duoc_moi_endpoint` chỉ đảm bảo không 401/403, có thể lọt qua một lỗi khác
  (400/422) mà không đỏ vì các entry đó không đòi 2xx.
- Thêm bài đo hạn mức: mod thường chạm trần `HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY` ở
  `quan_tri_tai_anh_noi_dung` → 429 `qua_han_muc_anh_noi_dung` (dùng `override_settings` hạ trần,
  cùng khuôn `test_han_muc.py`). Test đếm theo `request.user` của MOD, không phải tác giả bài.

### 2.3 Không đổi

- Không đổi `quan_tri_sua_moc`, `quan_tri_sua_tieu_de_mach`, `quan_tri_xoa_anh_moc` — vẫn superuser-only.
- Không đổi endpoint v1 công khai (`api/anh.py`).
- Không migration, không đổi `Ninja` schema (input/output không đổi hình dạng, chỉ đổi điều kiện
  quyền và thêm một nhánh 429) — `pnpm codegen:check` phải khớp; nếu `LoiThoiGianOut`/mã 429 làm
  `openapi.admin.json` đổi (thêm response 429 vào chữ ký endpoint) thì CHẠY `pnpm codegen`, ghi rõ
  trong báo cáo.

## 3. Frontend

### 3.1 `apps/admin/app/machs/moi/page.tsx`

Lượt trước vừa thêm gate `!mod.is_superuser` cho khối "Ảnh đính kèm" và
`choPhepAnh={mod.is_superuser}` trên `SoanThaoQuanTri` — **bỏ cả hai gate này**, quay về: mọi staff
thấy ô ảnh + chèn được ảnh trong TipTap (`choPhepAnh` không cần truyền, mặc định `true`, hoặc truyền
tường minh `true` kèm một dòng chú thích ngắn nói rõ đây là chủ đích, không phải sót quên xoá prop).
Xoá câu giải thích "Chỉ superuser đính được ảnh…" (`data-testid="anh-chi-superuser"`) và nhánh liên
quan. `mod.is_superuser` / `useQuanTri()` có thể vẫn cần giữ nếu còn dùng chỗ khác trong file — kiểm
trước khi xoá import.

Xoá phần docstring đầu file mô tả rào "cửa tạo bài mở cho mọi staff, hai cửa ảnh thì KHÔNG" — đổi
thành câu đúng: mọi staff làm được cả ba.

### 3.2 `apps/admin/app/m/[machId]/moc/[mocId]/page.tsx` (trang sửa mốc)

Trang này gộp CHUNG một cờ `sua_duoc = moc.sua_duoc && la_superuser` cho toàn bộ form — kể cả khối
"Ảnh đính kèm". Giờ tải ảnh (không phải gỡ ảnh, không phải sửa chữ) là quyền staff, nên khối ảnh cần
tách khỏi `la_superuser`:

- Tính thêm `anh_tai_duoc = moc.sua_duoc` (bỏ `&& la_superuser` — vẫn giữ điều kiện nội dung: mốc
  không phải bia mộ/bị ẩn/mạch không khoá, đúng nghĩa gốc của `moc.sua_duoc` từ server).
- Ô `<input type="file">` (chọn ảnh mới): `disabled={!anh_tai_duoc || ban || con_cho <= 0}` (bỏ
  `!sua_duoc`, dùng `anh_tai_duoc`).
- Nút **"Gỡ"** trên từng ảnh đã lưu: **giữ nguyên** `disabled={!sua_duoc || ban}` — xoá ảnh KHÔNG nới
  (§1).
- Banner "Chỉ superuser sửa được nội dung" ở đầu trang: giữ nguyên cho phần CHỮ (ngày, loại, thân,
  câu mời, figures) — banner đó nói đúng cho phần nó áp. Nếu mod thường mở trang và mọi trường chữ bị
  khoá nhưng ô ảnh vẫn mở, cần một câu phụ ngắn dưới khối "Ảnh đính kèm" nói rõ tại sao (khác banner
  chung) — ví dụ *"Chèn ảnh mới không cần superuser — chỉ sửa chữ và gỡ ảnh cũ mới cần."* Chỉ hiện câu
  này khi `!la_superuser && anh_tai_duoc` (staff thường, nội dung còn sửa-ảnh-được), để không lặp
  thông tin thừa cho superuser.

### 3.3 `apps/admin/components/soan-thao-quan-tri.tsx`

KHÔNG đổi — prop `choPhepAnh` đã tổng quát (mặc định `true`), hai chỗ gọi giờ đều truyền `true` hoặc
không truyền. Giữ nguyên component.

## 4. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Đo bằng |
|---|---|---|
| T1 | `pnpm lint` 0 warning · `pnpm build` xanh · `pnpm codegen:check` khớp (hoặc `pnpm codegen` chạy + ghi rõ vì sao) · `pnpm test` 0 fail · `pnpm e2e:don-vi` 0 đỏ | chạy lại |
| T2 | `CHI_SUPERUSER` (`test_api_quan_tri_phan_quyen.py`) chỉ còn 3 mục ảnh/nội-dung liên quan
`quan_tri_sua_bai.py`: `quan_tri_sua_moc`, `quan_tri_sua_tieu_de_mach`, `quan_tri_xoa_anh_moc` | đọc mã nguồn + `test_CHI_SUPERUSER_that_su_chan_mod` xanh |
| T3 | Mod thường (staff, không superuser) gọi `POST /admin/mocs/{id}/anh` và `POST /admin/anh` với ảnh thật → 201 | bài đo mới, tự chạy |
| T4 | Mod thường chạm trần `HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY` ở `POST /admin/anh` → 429 `qua_han_muc_anh_noi_dung` | bài đo mới, tự chạy |
| T5 | Mod thường vẫn ăn 403 ở `quan_tri_sua_moc`, `quan_tri_sua_tieu_de_mach`, `quan_tri_xoa_anh_moc` | `test_CHI_SUPERUSER_that_su_chan_mod` |
| T6 | `/machs/moi`: khối ảnh + nút 🖼 mở cho mọi staff, không còn câu "chỉ superuser" | đọc mã nguồn (don-vi hoặc grep tại chỗ) |
| T7 | Trang sửa mốc: mod thường mở ô chọn file ảnh MỚI được, nút "Gỡ" ảnh cũ vẫn khoá, trường chữ vẫn khoá | đọc mã nguồn + (nếu có bài đo don-vi hiện có cho trang này thì cập nhật, không thì ghi rõ chỉ đọc mã) |
| T8 | Thử phá ≥ 3 rồi khôi phục | báo cáo |

## 5. Không làm

- Không nới `quan_tri_sua_moc`, `quan_tri_sua_tieu_de_mach`, `quan_tri_xoa_anh_moc`.
- Không đổi hạn mức của `POST /me/anh` công khai.
- Không thêm setting hạn mức mới riêng cho khu quản trị — dùng chung
  `HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY`.
- Không đổi `AuditLog` — `boi=request.user` đã đúng danh tính thật của người gọi.

## 6. Cây làm việc

Chạy trên cây hiện tại (nền hẹn giờ + form admin hẹn giờ, giờ cộng thêm việc vừa xong ở
`2026-09-04-dang-bai-tu-admin.md`, đều chưa commit). Không worktree từ `main`.

## 7. Nhật ký

_(điền khi thực thi)_
