# Khối "Bài viết" trang chủ: dải Mới đăng + giá sách do admin chọn (phương án C)

> Mở 2026-11-11. User chọn phương án C và yêu cầu thêm: *"trong admin, cho thêm 1 field xđ chuyên mục
> nào được show ra home, tối đa 4 chuyên mục"* · *"sửa luôn cả admin để có thể chọn"*.
> Sổ việc: `GHI-CHU.md` việc 13.

## 0. Vì sao

Khối hiện tại (`apps/web/lib/nhom-bai-viet.ts`) lấy CHUYÊN MỤC làm trục chính: 3 cột ghép cứng 6 slug.
Sub không khai trong `NHOM_BAI_VIET` thì bài của nó **không bao giờ** lên trang chủ. Đo trên
dev.gikky.net 2026-11-11 (50 bài `bai_viet` mới nhất, 02/11 → 11/11): `ngoai-hoi` có 3 bài, 0 lần
lên trang chủ. Các sub khác: mỗi bài ở trang chủ ~1,3–4 ngày.

## 1. Thiết kế đã chốt

### 1.1 DB — `Sub.vi_tri_trang_chu`

- `PositiveSmallIntegerField(null=True, blank=True)`. `NULL` = không lên trang chủ; `1..4` = vị trí giá sách.
- `CheckConstraint`: `vi_tri_trang_chu IS NULL OR (1 <= vi_tri_trang_chu <= 4)`.
- `UniqueConstraint(fields=["vi_tri_trang_chu"])` — Postgres coi các NULL là khác nhau ⇒ nhiều sub NULL
  hợp lệ; tối đa 4 sub có vị trí. **"Tối đa 4" được DB ép, không chỉ form.**
- Migration mới, số kế tiếp (hiện leaf là `0046_lenh_co_cau_truc_va_la_bot`; `ls api/core/migrations`
  lại trước `makemigrations` — nhiều phiên chung checkout). **Không** data migration chọn sẵn sub:
  sau deploy user tự chọn trong admin; trước đó khối chỉ có dải Mới đăng + bản tin.

### 1.2 API quản trị — `PUT /admin/subs/trang-chu`

- Body `DatTrangChuSubIn { slugs: list[str] }`: **toàn bộ** danh sách theo thứ tự (phần tử 0 → vị trí 1),
  0..4 phần tử. Cùng triết lý `SapXepSubIn` (ghi cả cột, không phép dời lẻ).
- 400 khi: > 4 phần tử, trùng slug, slug không tồn tại. Mã lỗi dùng lại `THAM_SO_KHONG_HOP_LE` (hoặc mã sẵn có
  tương ứng, xem `quan_tri_sub.py`).
- Trong `transaction.atomic()`: `select_for_update` các hàng Sub liên quan (thứ tự theo `pk`), đặt
  **mọi** hàng đang có vị trí về NULL trước, rồi gán 1..n — tránh vỡ unique giữa chừng. Bảng `Sub` không nằm
  trong chuỗi khoá `Comment/Moc → Mach → MocAnh`, không sinh cạnh mới (ghi rõ trong docstring).
- Ghi `AuditLog` hằng mới `AUDIT_DAT_TRANG_CHU_SUB` (cạnh `AUDIT_DAT_THU_TU_SUB` trong `core/ghi.py`),
  kèm danh sách cũ và mới; không đổi gì ⇒ không ghi audit (luật `da_doi`).
- Trả `list[SubQuanTriOut]`. Quyền: như các endpoint `/admin/subs` khác.
- ⚠ Route tĩnh `/subs/trang-chu` khai **TRƯỚC** mọi `/subs/{slug}` và thêm `"trang-chu"` vào `SLUG_CAM`
  (xem comment cạnh `/subs/thu-tu`).
- `operation_id` tường minh: `quan_tri_dat_trang_chu_sub`.

### 1.3 API công khai

- `SubQuanTriOut` và `SubChiTietOut` thêm `vi_tri_trang_chu: int | None`.
- `pnpm codegen` sau khi sửa Django. Không sửa tay `packages/api-client`.

### 1.4 Admin UI — `apps/admin/app/subs/page.tsx`

- Một khối "Chuyên mục trên trang chủ (tối đa 4)" ở đầu trang: 4 ô chọn `Vị trí 1..4`, mỗi ô là danh sách
  sub + "— trống —". Một sub đã chọn ở ô khác thì ô này không cho chọn nó (disabled option). Nút "Lưu"
  gửi `PUT` với các ô không trống theo thứ tự; ô trống ở giữa thì dồn lên.
- Hiện lỗi 400 của server nếu có. Lưu xong nạp lại danh sách.
- Bảng sub có thêm cột/nhãn nhỏ "Trang chủ #n" cho sub đang có vị trí.
- Gợi ý dưới khối: "`tin-tuc` đã có dải Bản tin riêng" (chỉ là chữ, không chặn).
- Tuân luật `apps/admin`: Tailwind + token, cấm màu ứng biến, hook mở đầu bằng `use`.

### 1.5 Web — khối Bài viết (`components/khoi-bai-viet.tsx`, `lib/nhom-bai-viet.ts`, `app/page.tsx`)

Bố cục từ trên xuống:

1. **Header** giữ: "Bài viết" + mô tả + link "Tất cả bài viết →" (`/?tab=moi&loai_mach=bai_viet`).
   Chip chuyên mục = các sub được chọn lên trang chủ (theo vị trí), lấy nhãn `ten` từ `cac_sub`.
2. **Dải "Mới đăng"**: `SO_MOI_DANG = 3` bài `bai_viet` mới nhất thuộc **mọi** chuyên mục trừ `SUB_BAN_TIN`
   (`tin-tuc`), có thumbnail + chip tên chuyên mục (fallback `s/<slug>` nếu sub không có trong `cac_sub`) + ngày.
   Nguồn: lời gọi `docFeed("moi", { limit: SO_BAI_VIET_TAI, loai_mach: "bai_viet" })` đang có.
3. **Giá sách**: mỗi sub có `vi_tri_trang_chu` (sắp theo vị trí) là một cột; tiêu đề cột = `sub.ten`, link
   "Xem thêm →" tới `/s/<slug>`. Mỗi cột `SO_BAI_MOI_GIA = 3` bài **chỉ tiêu đề + ngày, không ảnh**,
   **không trùng** bài đã ở dải Mới đăng. Cột rỗng ⇒ ẩn. Không sub nào được chọn ⇒ không có hàng giá sách.
   Nguồn: **mỗi giá một lời gọi** `docFeedSub(slug, "moi", { limit: SO_BAI_MOI_GIA + SO_MOI_DANG,
   loai_mach: "bai_viet" })` — để sub đăng chậm vẫn có bài (không phụ thuộc cửa sổ 50 bài). `null` (404, sub
   vừa bị xoá) ⇒ giá rỗng ⇒ ẩn. Các lời gọi này nối đuôi `docCacSub()` **bên trong** một phần tử
   `Promise.all` (cùng mẫu chủ đề + quan điểm), không thêm vòng chờ ngoài.
   Lưới: 4 cột desktop; ít giá hơn thì `repeat(n, …)` theo số giá; mobile 1 cột (hoặc 2 nếu đẹp hơn).
4. **Bản tin thị trường**: giữ nguyên.
5. Mobile "Xem thêm bài viết": giữ.

Hàm thuần trong `lib/nhom-bai-viet.ts` (thay `NHOM_BAI_VIET` / `chiaNhomBaiViet` / `slugChipChuyenMuc`):
- `chonMoiDang(items, toiDa = SO_MOI_DANG)` — lọc bỏ `SUB_BAN_TIN`, lấy đầu.
- `subLenTrangChu(cac_sub)` — sub có `vi_tri_trang_chu != null`, sắp theo vị trí.
- `dungGiaSach(gia: {sub, items}[], daHien: Set<number>, toiDa = SO_BAI_MOI_GIA)` — bỏ bài trùng, cắt,
  bỏ giá rỗng.
- Toàn bộ khối ẩn chỉ khi Mới đăng, giá sách và bản tin đều rỗng.
- **Không còn slug cứng nào** ngoài `SUB_BAN_TIN`. Cập nhật allowlist của
  `e2e/don-vi/khong-ghi-cung-sub.spec.ts` cho đúng lý do mới.
- Giữ `data-testid` cũ khi nghĩa không đổi (`khoi-bai-viet`, `bai-viet-tat-ca`, `ban-tin*`, `bai-viet-xem-them`);
  testid mới: `bai-viet-moi-dang`, `bai-viet-moi-dang-muc`, `bai-viet-gia` (`data-sub`), `bai-viet-gia-muc`.
- Mọi bài vẫn `<article>`/`<a href>` thật, `<time datetime>`, `CHU_NGUOI_DUNG` cho chữ người dùng; màu chỉ token
  (hàng rào `mau-token.spec.ts` + test màu trong `trang-chu-giao-dien-moi.spec.ts`).
- Cập nhật docstring `TrangChuMoi` trong `app/page.tsx` (hiện nói "MỘT lời gọi … chia nhóm ở web").

## 2. Đo

- **pytest** (nền 2684 bài): ràng buộc DB (giá trị 0/5 bị chặn; hai sub cùng vị trí bị chặn; nhiều NULL ok);
  `PUT /admin/subs/trang-chu`: đặt 4, đặt lại thứ tự khác (hoán đổi vị trí không vỡ unique), xoá hết `[]`,
  5 phần tử ⇒ 400, trùng ⇒ 400, slug lạ ⇒ 400, không phải staff ⇒ 403, audit chỉ ghi khi đổi; `GET /subs`
  và `GET /admin/subs` trả `vi_tri_trang_chu`; route tĩnh không bị `{slug}` nuốt; `trang-chu` bị cấm làm slug.
- **`pnpm e2e:don-vi`**: bài đo hàm thuần mới (file mới `e2e/don-vi/bai-viet-trang-chu.spec.ts`); gỡ các bài
  đo `NHOM_BAI_VIET`/`chiaNhomBaiViet` cũ.
- **e2e có seed** (`trang-chu-v2.spec.ts` và các spec chạm `khoi-bai-viet`): seed đặt vị trí cho vài sub;
  kiểm dải Mới đăng có bài của sub KHÔNG được chọn; giá sách không trùng dải; link thật. Chạy **chỉ trên
  `gikky_e2e` với `CI=1`** (gikky_dev có dữ liệu thật — xem memory); nếu không dựng được thì báo, đừng chạy trần.
- `pnpm codegen:check`, `pnpm lint`, `pnpm build`.

## 3. Ngoài phạm vi

- Nội dung lệch chuyên mục (bài đóng tàu / rượu vang nằm trong `quan-tri-von`) — việc biên tập, không phải code.
- Bot đăng bài chọn sub nào — không đổi.
