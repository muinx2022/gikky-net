# Tách khu "Quản trị viên" khỏi bảng Người dùng

Chốt 2026-08-26. User: *"2 mục này nên có phần quản lý riêng, đặt vào đây hơi khó hiểu và
khó mà tìm được"* — nói về hai hàng `u/admin` (Superuser) và `u/mod_gikky` (Mod) đang nằm
lẫn trong bảng `/users`.

Hai câu user đã chốt khi được hỏi:

1. **Ẩn hẳn** quản trị viên khỏi danh sách "Người dùng" (không phải "hiện ở cả hai nơi").
2. **Có** cấp / thu quyền mod ngay tại trang mới, **khoá sau `is_superuser`**.

Vế 2 **nới một quyết định bảo mật có chủ đích** đang ghi ở ba chỗ trong code
(`quan_tri_nguoi_dung.py` docstring module, khối chú thích "CRUD tài khoản", và
`quan_tri_sub.py` §mod-chuyên-mục). Plan này phải nói rõ cái gì đổi và cái gì KHÔNG.

---

## 0 · Cái KHÔNG làm

- **Không** cấp / thu `is_superuser` ở bất kỳ đâu trong khu quản trị. Chỉ `is_staff`.
  Django admin vẫn là nơi duy nhất phong superuser.
- **Không** nới `ChiMod`. Cổng vào khu quản trị vẫn đúng là `is_staff` + `is_active` +
  chưa bị ban.
- **Không** nối `ModSub` vào quyền. Nó vẫn là phân công, không phải quyền
  (`plans/2026-08-24-mod-chuyen-muc.md` §0 vẫn là plan riêng chưa làm).
- **Không** migration. `is_staff` đã có sẵn trên `AbstractUser`.

## 1 · Hệ quả bảo mật của vế 2, ghi ra để không ai gỡ nhầm

`ban_nguoi_dung` trả **409 khi đích là `is_staff`** ("Không ban được một tài khoản quản
trị khác"). Nghĩa là:

> **Cấp quyền mod cho ai = làm người đó miễn nhiễm ban.**

Trước lượt này, thao tác ấy chỉ làm được ở Django admin. Sau lượt này superuser làm được
từ web. Đó là cái giá user đã chấp nhận khi chọn "Có, nhưng chỉ superuser" — nhưng nó
phải có **bài đo ghim lại**, chứ không chỉ là một câu trong plan (§5, bài B10).

## 2 · Backend

### 2.1 · `GET /admin/users` — staff biến khỏi ba bộ lọc kia

`api/api/quan_tri_bang.py::liet_ke_nguoi_dung`:

| `trang_thai` | Trước | Sau |
|---|---|---|
| `tat_ca` | mọi tài khoản | **loại `is_staff=True`** |
| `bi_ban` | mọi tài khoản bị ban | **loại `is_staff=True`** |
| `moi` | mọi tài khoản mới 7 ngày | **loại `is_staff=True`** |
| `staff` | chỉ `is_staff=True` | *(giữ nguyên)* |

Phép loại đặt **trước `dem_tong`**, nếu không `tong` đếm cả staff còn bảng thì không —
đúng cái bẫy `phan_trang.py::dem_tong` đã cảnh báo.

Đây là **đổi hành vi của một endpoint đang chạy**, không phải thêm tính năng. Bài đo cũ
nào giả định `tat_ca` có staff sẽ đỏ; sửa bài đo là đúng, nhưng phải sửa **có ý thức** và
ghi lại, không phải nới assert cho nó xanh.

### 2.2 · `so_staff_an` — chống "tài khoản biến mất"

Thêm một trường vào `TrangNguoiDungOut`:

```python
#: Số tài khoản quản trị BỊ LOẠI bởi chính bộ lọc đang áp (kể cả `q`).
so_staff_an: int
```

Lý do nó tồn tại: sau §2.1, gõ `mod_gikky` vào ô lọc của trang Người dùng sẽ ra **rỗng**.
Một bảng rỗng không nói được là "không có ai tên vậy" hay "có, nhưng ở trang khác" — và
người đọc sẽ kết luận cái thứ nhất. Trường này cho frontend nói ra sự thật (§3.3).

Đếm **cùng `q`, cùng `trang_thai`**, chỉ khác điều kiện staff. Khi `trang_thai == "staff"`
thì luôn `0` (không loại gì cả).

### 2.3 · `POST /admin/users/{username}/quyen-mod` (mới)

Đặt trong `api/api/quan_tri_nguoi_dung.py` (cùng router với `ban` / `go-ban` /
`mat-khau`, nên `users/{username}/…` không bị router `quan_tri_bang` nuốt — xem khối chú
thích 405 đã có sẵn trong file).

```
operation_id = "quan_tri_doi_quyen_mod"
body         = DoiQuyenModIn { bat: bool }
response     = { 200: NguoiDungQuanTriOut, 400/401/403/404/409: LoiOut }
```

Trả **cả hàng** `NguoiDungQuanTriOut` chứ không `204`: nhãn `vai_tro` do server tính
(`vai_tro_cua`), nên frontend phải nhận lại hàng mới thay vì tự suy từ `bat` — cùng lý lẽ
`gan_mod_sub` trả cả hàng sub.

**Idempotent**, không 409 khi đặt trùng giá trị đang có. Khác `gan_mod_sub` (nơi "đã là
mod ⇒ 409" là đúng, vì đó là *thêm vào một danh sách*): đây là một **công tắc hai trạng
thái**, và một công tắc báo lỗi khi bị gạt về đúng vị trí nó đang đứng là công tắc hỏng.

**Năm lời từ chối**, mỗi lời một thông điệp riêng:

| # | Điều kiện | Mã | Vì sao |
|---|---|---|---|
| T1 | người gọi không `is_superuser` | 403 | vế 2 chỉ mở cho superuser. Dùng lại `_chan_neu_khong_phai_superuser` |
| T2 | `u.pk == request.user.pk` | 409 | thu quyền của chính mình = tự khoá khỏi khu quản trị, và người duy nhất gỡ được lại chính là mình |
| T3 | `u.is_superuser` | 409 | `ChiMod` đòi `is_staff`; thu `is_staff` của một superuser là làm hỏng một nửa họ. Quyền superuser thuộc Django admin |
| T4 | `bat=True` mà `u.dang_bi_ban()` hoặc `not u.is_active` | 409 | `ChiMod` từ chối cả hai ⇒ hàng cấp ra vô nghĩa ngay khi tạo, và một cái tên bị ban nằm trong bảng "Quản trị viên" là thông tin sai trên màn hình. Đúng tiền lệ `gan_mod_sub` |
| T5 | `bat=False` mà `u.sub_dang_mod` còn hàng | 409, **kèm tên sub** | xem dưới |

**T5 nói kỹ.** Thu `is_staff` mà bỏ lại hàng `ModSub` để một cái tên không moderate được
nằm trong cột "Mod" của bảng chuyên mục — chính điều mà docstring `ModSub` gọi là *"hiểu
sai theo hướng nguy hiểm"*. Hai lối chữa:

- *cascade xoá `ModSub`* — mất dữ liệu ngầm mà người bấm không yêu cầu, và mất luôn câu
  trả lời "ai từng phụ trách sub này";
- *từ chối, bảo gỡ phân công trước* — chọn cái này.

409 phải **liệt kê tên sub**, nếu không superuser phải đi dò từng chuyên mục.

**Ghi nhật ký**: hằng mới `AUDIT_DOI_QUYEN_MOD = "doi_quyen_mod"` trong `core/ghi.py`,
`target_type=DICH_USER`, meta `{username, bat}`. Đây là thao tác đổi quyền — không có
dòng nhật ký thì không trả lời được "ai cho người này làm mod".

⚠ `DoiQuyenModIn` **chỉ có `bat`**. Không khai `is_staff` / `is_superuser` — Ninja loại
mọi khoá lạ khỏi body trước khi handler thấy, và bài đo B9 ghim điều đó.

### 2.4 · Hàng rào bắt buộc cập nhật

`api/tests/_quan_tri.py::bang_endpoint` — thêm một dòng cho `quan_tri_doi_quyen_mod`.
Thiếu ⇒ `test_bang_nay_phu_het_moi_endpoint_cua_api_admin` **đỏ**. Đó là tính năng, không
phải phiền toái.

Sau khi sửa Ninja: **`pnpm codegen`** (bắt buộc — `packages/api-client` là file sinh ra),
rồi `pnpm codegen:check` phải sạch.

## 3 · Frontend (`apps/admin`)

### 3.1 · Menu

`components/khung/menu.ts`, nhóm **"Cộng đồng"**, chèn **ngay sau** "Người dùng":

```ts
{ duong_dan: "/quan-tri-vien", nhan: "Quản trị viên", icon: "nguoi-dung" },
```

Đặt ở "Cộng đồng" chứ không "Hệ thống" vì lời than của user là **khó tìm** — chỗ người ta
đi tìm một con người là khu người dùng, không phải khu cài đặt. Đây là lựa chọn có thể
bàn; nếu đổi ý thì đổi đúng một dòng này.

⚠ Hàng rào `quan-tri-giao-dien.spec.ts::MENU` đòi mỗi `duong_dan` có `page.tsx` thật ⇒
thêm dòng này **cùng lượt** với trang, không trước.

### 3.2 · Trang `/quan-tri-vien`

Gọi `quanTriLietKeNguoiDung({ query: { trang_thai: "staff", … } })` — endpoint cũ, không
có endpoint mới nào cho việc liệt kê.

Cột: `Tài khoản` · `Vai trò` · `Chuyên mục phụ trách` · `Tham gia` · `Trạng thái` · thao tác.

Thao tác, **chỉ hiện khi `mod.is_superuser`** (không render nút rồi để nó ăn 403 —
PLAN mục 4):

- **"Thu quyền mod"** trên mỗi hàng, **ẩn** khi hàng là superuser hoặc là chính mình
  (T2/T3 sẽ từ chối, nên đừng vẽ nút).
- **"Cấp quyền mod"** ở `hanh_dong` của `TieuDeTrang` → ngăn kéo chứa
  `components/o-goi-y-user.tsx` (ô gợi ý user đã có sẵn) + nút xác nhận.

Ngăn kéo dùng lại `NganKeo` + `HangNutForm`; phân trang dùng `ThanhPhanTrang` +
`useDanhSach` như mọi bảng khác.

Câu mô tả trang phải nói ra hệ quả §1 — người sắp bấm "Cấp quyền mod" cần biết mình đang
làm tài khoản đó **không ban được nữa**.

### 3.3 · Trang `/users` sửa ba chỗ

1. Bỏ `staff: "Quản trị viên"` khỏi `CHU_LOC` (bộ lọc ấy nay là một trang riêng).
2. Khi `ds.so_staff_an > 0`: hiện một dòng gợi ý có `Link` sang `/quan-tri-vien`, đại ý
   *"Ẩn N tài khoản quản trị — xem ở Quản trị viên"*. Hiện **cả khi bảng rỗng lẫn khi
   không rỗng**; ca rỗng mới là ca nguy hiểm (§2.2) nên nó không được rơi vào nhánh
   `KhoiRong` rồi biến mất.
3. `mo_ta` của `TieuDeTrang` bỏ câu "Cấp / thu quyền quản trị làm ở Django admin, không
   làm ở đây." — sau lượt này nó **sai**.

`lib/danh-sach.ts` phải chuyển tiếp `so_staff_an` ra ngoài (hôm nay nó chỉ giữ
`items`/`tong`/cursor).

## 4 · Tiêu chí nghiệm thu (ĐO ĐƯỢC)

| # | Tiêu chí | Đo bằng |
|---|---|---|
| N1 | `pnpm test` xanh, **0 warning** | số passed ≥ nền hiện tại (**1462**) + số bài mới |
| N2 | `pnpm lint` sạch, `--max-warnings=0` | exit 0 |
| N3 | `pnpm build` sạch | exit 0 |
| N4 | `pnpm codegen:check` khớp | exit 0 |
| N5 | `tsc --noEmit` sạch ở `apps/admin` | exit 0 |
| N6 | `pnpm e2e:don-vi` xanh | hàng rào menu + màu + type-admin |
| N7 | Bảng phân quyền phủ endpoint mới | `test_bang_nay_phu_het_moi_endpoint_cua_api_admin` xanh |
| N8 | 13 bài đo §5 đều có, và **đều thử phá được** | §5 |
| N9 | `GET /users?trang_thai=tat_ca` không chứa `is_staff` | B11 |
| N10 | `tong` của `tat_ca` = số hàng không-staff | B13 |

**Nền hiện tại: `pnpm test` = 1462 passed / 16 skipped, `codegen:check` khớp** — đo lúc
2026-08-26 trên commit `9edc374`, SAU khi phiên kia commit xong `theo_user`. (Lượt đầu
giao việc đã phải huỷ ở bước 0 vì cây còn đang dở: nền khi đó là 1456 collect / 4 đỏ /
codegen lệch. Ghi lại để con số 1419 trong bản plan đầu không làm ai tưởng có bài đo biến
mất.)

Agent nhận việc phải tự đo lại con số này TRƯỚC khi sửa gì; lệch nhiều nghĩa là đang đứng
sai cây (xem `D:\Projects\CLAUDE.md` §worktree).

## 5 · Bài đo bắt buộc (`api/tests/test_api_quyen_mod.py` mới)

Backend:

- **B1** superuser `bat=true` ⇒ 200, `is_staff` True, `vai_tro == "Mod"`, có dòng `AuditLog`
- **B2** superuser `bat=false` ⇒ 200, `is_staff` False, `vai_tro == "Thành viên"`
- **B3** mod thường (không superuser) ⇒ **403 cả hai chiều**
- **B4** tự đổi quyền của mình ⇒ 409 (T2)
- **B5** đích là superuser ⇒ 409 (T3)
- **B6** `bat=true` cho tài khoản đang bị ban ⇒ 409 (T4)
- **B7** `bat=true` cho `is_active=False` ⇒ 409 (T4)
- **B8** `bat=false` khi còn `ModSub` ⇒ 409, **thông điệp chứa slug sub** (T5)
- **B9** gửi kèm `is_superuser: true` trong body ⇒ `is_superuser` **KHÔNG đổi**
- **B10** sau B1, `ban_nguoi_dung` lên đúng tài khoản đó ⇒ **409** *(ghim hệ quả §1)*
- **B11** `tat_ca` không chứa staff · `staff` chỉ chứa staff · hợp hai tập = toàn bộ
- **B12** `so_staff_an` đúng, kể cả khi có `q`; và `== 0` khi `trang_thai=staff`
- **B13** `tong` của `tat_ca` khớp `User.objects.filter(is_staff=False).count()`

**Luật 4 của `D:\Projects\CLAUDE.md` áp đủ**: mỗi bài phải được thử phá — sửa ngược code
cho hỏng, xác nhận bài đo ĐỎ, rồi khôi phục. Bài không đỏ khi code hỏng là bài trang trí.
Riêng B11/B13 dễ ra **bài đo rỗng** (seed không có staff ⇒ hai tập bằng nhau và assert
đúng bất kể code): phải seed **ít nhất 1 staff + 1 thường** và assert cả hai tập
**khác rỗng**.

## 6 · Ràng buộc tài nguyên khi chạy chặng 3 + 4 song song

⚠ **Máy đang chạy 3 dev server** (Django 8000, web 3000, admin 3001) do user vừa bảo khởi
động. `pnpm build` **phá `.next/` của `next dev` đang chạy** — phải **tắt cả ba trước khi
build**, rồi bật lại. Phiên chính lo việc tắt/bật, không giao cho subagent.

⚠ **Có phiên Claude khác đang làm trên repo này.** Tính năng `theo_user` của họ đã commit
(`9edc374`) nên ba file lượt này cần — `quan_tri_schemas.py`, `core/ghi.py`,
`packages/api-client/` — nay sạch. Nhưng họ đã sang việc kế (bot tin tức) và vẫn giữ dở:

`api/config/settings.py` · `api/core/management/commands/seed_dev.py` ·
`api/core/management/commands/tao_sub.py` (**đang STAGED**) · `package.json` ·
`scripts/tin-tuc/` · `scripts/dang-tin.mjs` · `deploy/prod/` · `.dockerignore` ·
`api/tests/test_bot_dang_tin.py` · `api/tests/test_tao_sub.py` · `plans/2026-08-2[56]-*`
(trừ plan này).

**Không đụng vào.** Việc này không cần migration nào.

⚠ **`tao_sub.py` nằm sẵn trong INDEX.** Nghĩa là `git commit` trần sẽ nuốt nó vào commit
của lượt này. Chặng 5 phải stage chọn lọc và **kiểm index trước khi commit**, không
`git add -A`.

Chia độc quyền:

| Agent | Được chạy | Cấm chạy |
|---|---|---|
| `nghiem-thu` | `pnpm test` · `pnpm build` · `pnpm lint` · `codegen:check` — **một bộ một lúc** | — |
| `phan-bien` | đọc code · `pnpm e2e:don-vi` · SQL **chỉ đọc** | `pnpm build` · `pnpm e2e` |

`pnpm e2e:don-vi` an toàn chạy song song (không `webServer`, không `globalSetup`, không
chạm DB). `pnpm e2e` thì **không** — nó chiếm 3000 + 8000 và **ghi vào `gikky_dev`**.

## 7 · Nhật ký thực hiện

Nền đo lúc bắt đầu: `9edc374`, **1462 passed / 16 skipped / 0 warning**, `codegen:check` khớp.
Sau bản vá: **1486 passed / 16 skipped / 0 failed / 0 warning** — `nghiem-thu` tự chạy lại
ra đúng con số ấy (278.82s), và tách được bằng `--collect-only`: 1462 nền + **15 bài của
lượt này** + 9 bài của lượt bình luận HTML (phiên khác). Không bài nào biến mất.

### 7.1 · Thử phá — luật 4

Do **người làm tự thực hiện** trong chặng 2; `nghiem-thu` không kiểm chứng lại được vì
chặng ấy bị cấm sửa code. Ghi lại đúng những gì được báo, kèm phần phiên chính tự soi.

| Phá gì | Bài đo ĐỎ |
|---|---|
| Bỏ `qs.filter(is_staff=False)` | B11, B12, B13, bất-biến, + `test_tong_cua_bang_binh_luan_va_nguoi_dung` |
| `dem_tong` **trước** phép loại | B12, B13, + phan_trang |
| `so_staff_an` đếm toàn hệ thống thay vì theo `q` | B12 |
| `so_staff_an` không về 0 ở nhánh `staff` | B12 |
| Bỏ T1 (chặn không-phải-superuser) | B3 + `test_CHI_SUPERUSER_that_su_chan_mod` |
| Bỏ T2 (tự đổi quyền) | B4 |
| Bỏ T3 (đích là superuser) | B5 |
| Bỏ T4 (`is_active=False`) | B7 |
| Bỏ T4 (`dang_bi_ban`) | B6 |
| Cascade xoá `ModSub` thay vì từ chối (T5) | B8 |
| 409 nhưng giấu tên sub (T5) | B8 |
| Thêm `is_superuser` vào `DoiQuyenModIn` rồi ghi nó | B9 |
| Đặt trùng giá trị ⇒ 409 | bài idempotent |
| Bỏ `ghi_audit` | B1, B2 |
| Ghi sai `meta["bat"]` | B1 |
| Cho ban tài khoản staff (gỡ hệ quả §1) | B10 |
| Bỏ `save(update_fields=["is_staff"])` | B1, B2, B8, B9, B10 |

**Một bài từng là bài trang trí, đã sửa trong chặng 2.** B4 bản đầu chỉ chấm
`status_code == 409` và **không đỏ** khi gỡ T2 — vì người gọi bắt buộc là superuser nên
"đích là chính mình" luôn kéo theo "đích là superuser", và **T3 nuốt trọn T2**. Đã đổi B4
sang chấm câu chữ (`"chính mình" in detail` và `"Django admin" not in detail`); phá lại
thì đỏ. Đây đúng loài lỗi mà luật 4 sinh ra để bắt, và nó chỉ lộ khi thử phá — đọc code
không thấy.

**Một phép phá KHÔNG đỏ, và đó là đúng:** đổi `nguoi_dung_quan_tri_ra(_tim(username))`
thành `nguoi_dung_quan_tri_ra(u)`. Hai cách tương đương vì `u` đã là instance vừa sửa.
Giữ `_tim` cho khớp `sua_nguoi_dung`/`dat_mat_khau`.

### 7.2 · Bài đo cũ bị sửa vì §2.1 đổi hành vi

Hai bài, `nghiem-thu` đọc diff và kết luận **là SIẾT, không phải nới assert**:

1. `test_api_quan_tri_phan_trang.py::test_tong_cua_bang_binh_luan_va_nguoi_dung` —
   `tong` 2 → 1, nhưng **thêm 3 phép chấm** (`so_staff_an == 1`, `len(items) == 1`,
   `User.objects.count() == 2`). Bản cài "đếm trước rồi mới loại" làm `tong` ra lại 2 ⇒ đỏ.
2. `test_api_quan_tri_phan_quyen.py::CHI_SUPERUSER` — thêm `quan_tri_doi_quyen_mod`. Đây
   là cơ chế ngoại lệ **có sẵn** và bị ép **cả hai chiều**:
   `test_CHI_SUPERUSER_that_su_chan_mod` đòi mod phải ăn đúng `403 khong_du_quyen`, và
   `test_superuser_QUA_duoc_nhung_endpoint_CHI_SUPERUSER` đòi superuser qua được. Thêm tên
   vào đây là đổi sang một yêu cầu **chặt hơn**, không phải miễn trừ.

### 7.3 · N3 · N5 · N6 KHÔNG ĐẠT — nguyên nhân nằm NGOÀI lượt này

`nghiem-thu` xác minh bằng `git show` chứ không nhận lời khai của người làm:

- **N3 + N5 cùng MỘT nguyên nhân**: `apps/admin/components/dung-mo-ta.ts` khai
  `Record<BaoCaoOut["ly_do"], string>` với 4 khoá, trong khi `src-admin/types.gen.ts` của
  chính commit `9edc374` đã có **6** (`cam_ket_loi_nhuan`, `link_nhom_kin` là hai lý do
  báo cáo mới). `git diff --stat` trên file ấy **rỗng** ⇒ lượt này không đụng.
  ⇒ **`apps/admin` hiện KHÔNG build được trên `main`**, do commit của phiên khác.
- **N6**: `trang-loi.spec.ts` #14, về `export const dynamic = "force-dynamic"` trong
  `apps/web/app/luat/page.tsx` — vào từ `516e973`, cả file trang lẫn file spec đều không
  thuộc lượt này.

Ba tiêu chí vẫn chấm KHÔNG ĐẠT chứ không tự miễn: §4 viết chúng là `exit 0` tuyệt đối.
Phần thuộc phạm vi lượt này (backend · hàng rào phân quyền · codegen · frontend · 15 bài
đo) thì đầy đủ và đo thật.

### 7.4 · Chặng 5 — phiên chính sửa theo lượt phản biện

Lượt phản biện tìm được **một hồi quy thật mà nghiệm thu không thấy**, cộng ba việc nhỏ hơn.
Phiên chính tự sửa cả bốn.

**(a) NẶNG — ô gợi ý user mất sạch tài khoản staff.**
`components/o-goi-y-user.tsx` gọi list **không khai `trang_thai`** ⇒ thừa hưởng mặc định
`tat_ca`, mà `tat_ca` vừa bị §2.1 làm cho loại `is_staff`. Component ấy dùng ở **hai** chỗ,
và chỗ thứ hai không nằm trong phạm vi plan: `/subs` → ngăn kéo *gán mod chuyên mục*, nơi
nó là **đường nhập duy nhất**.

Hệ quả: gán mod chuyên mục cho một tài khoản staff là **không làm được từ giao diện**, và
màn hình nói *"Không có tài khoản nào khớp."* cho một tài khoản có thật. Backend vẫn nhận
(`gan_mod_sub` không kiểm `is_staff`) nên **không lỗi nào nổ**.

Tệ hơn một hồi quy thường vì `ChiMod` đòi `is_staff` ⇒ **tập người thật sự moderate được
một sub gần như chính là tập vừa biến mất**. Và trớ trêu: §2.2 kê đúng thuốc cho đúng bệnh
này ở `/users` (`so_staff_an` + dòng gợi ý) rồi bỏ quên bệnh nhân thứ hai dùng chung
endpoint.

Sửa: thêm giá trị `moi_nguoi` vào `LocNguoiDung` (**không lọc gì**, `so_staff_an` luôn 0),
và `OGoiYUser` nhận prop `trang_thai` **bắt buộc, không mặc định** — `/subs` truyền
`moi_nguoi`, `/quan-tri-vien` truyền `tat_ca` (loại staff ở đó là đúng: cấp quyền mod cho
người đã là mod là vô nghĩa). Bài đo `test_moi_nguoi_tim_duoc_ca_staff`.

**(b) B9 đứng làm chứng cho một luật nó không kiểm.** Docstring B9 nói nó canh *"hình dạng
schema"*; thật ra handler chỉ đọc `du_lieu.bat`, nên thêm `is_superuser` vào `DoiQuyenModIn`
**vẫn để B9 xanh**. Lời khẳng định ấy còn được chép sang docstring `DoiQuyenModIn` và sang
§2.3 của plan này. Sửa: thêm `assert set(DoiQuyenModIn.model_fields) == {"bat"}`, và viết
lại cả ba chỗ nói quá.

**(c) Ba đoạn chữ người dùng đọc được nay nói sai** — đều chỉ sang Django admin trong khi
cửa mới nằm ngay cạnh:
- 409 của `ban_nguoi_dung`: "gỡ quyền staff ở Django admin trước" → "thu quyền mod ở trang
  Quản trị viên trước". *(Không bài đo nào ghim câu này — đã kiểm. B4 vẫn an toàn: nó phân
  biệt hai nhánh bằng cụm "Django admin" trong thông điệp T3 của `doi_quyen_mod`, một
  endpoint khác.)*
- `sidebar.tsx`: nhãn "Django admin (cấp quyền mod)" → **"(phong superuser)"** — hai link
  cùng tự nhận là nơi cấp quyền mod, cách nhau vài chục pixel, đúng thứ user than là khó
  hiểu. Khối chú thích khẳng định "chỗ DUY NHẤT cấp/thu `is_staff`" cũng đã sai, viết lại.
- `form-ban.tsx` + hai docstring ở `form-sua-user.tsx` / `form-tao-user.tsx`.

**(d) Nút "Thu quyền mod" vẫn vẽ cho hàng chắc chắn ăn 409 (T5).** Nay `disabled` + `title`
nêu đích danh sub. **Mờ chứ không ẩn** — khác T2/T3, vì đây là trạng thái *gỡ được*: ẩn hẳn
biến một việc làm được thành một nút không tồn tại, không giải thích.

**Một hàng rào có sẵn đã chặn tôi, và đó là bằng chứng nó chạy.** Thêm `moi_nguoi` vào enum
làm `tsc` đỏ ở `CHU_LOC` của `/users` — đúng thiết kế `Record<Exclude<…>>` (thay vì
`Partial`) đã ghi trong chính file ấy. Đã khai `moi_nguoi` vào danh sách loại, kèm lý do
riêng: nó không phải bộ lọc người dùng chọn, và hiện nó ra là mời người ta bật chế độ "xem
cả quản trị viên" ngay trên màn hình vừa dựng để KHÔNG chứa quản trị viên.

### 7.5 · Số đo sau chặng 5, và kiểm bằng trình duyệt

`pnpm test` **1487 passed / 16 skipped / 0 warning** · `lint` exit 0 · `codegen:check`
khớp · `tsc` ở `apps/admin` **chỉ còn lỗi có sẵn** `dung-mo-ta.ts` · `e2e:don-vi` 303
passed, vẫn đúng 1 bài đỏ có sẵn.

Đo trên hệ thống đang chạy (không phải đọc code):

| Lời gọi | Kết quả |
|---|---|
| `?q=mod` — **cách CŨ của ô gợi ý** | `[]`, `so_staff_an: 1` ← chính hồi quy |
| `?trang_thai=moi_nguoi&q=mod` — đã vá | `["mod_gikky"]` |
| `?trang_thai=tat_ca` | 45 người, không có `admin`/`mod_gikky`, `so_staff_an: 2` |
| `?trang_thai=staff` | đúng 2 người, `so_staff_an: 0` |
| `?trang_thai=moi_nguoi` | 47 người gồm cả hai, `so_staff_an: 0` |

Qua giao diện: ô gợi ý ở `/subs` **hiện `u/mod_gikky`** (trước khi vá: "Không có tài khoản
nào khớp.") · `/quan-tri-vien` ẩn hết nút trên hàng superuser-và-là-chính-mình · gán tạm
`mod_gikky` vào `s/crypto` ⇒ nút "Thu quyền mod" **mờ** kèm title *"Còn phụ trách s/crypto —
gỡ phân công ở trang Chuyên mục trước."*, gỡ xong thì bật lại (đã dọn dữ liệu thử) ·
`/users` không còn hàng staff, ô chọn còn 3 mục · tìm `mod_gikky` ở `/users` ⇒ **0 hàng
nhưng dòng gợi ý vẫn hiện**: *"Ẩn 1 tài khoản quản trị — xem ở Quản trị viên."* — số **1**
theo bộ lọc đang áp, không phải tổng 2 toàn hệ thống. Console sạch.

### 7.6 · Việc phát hiện thêm, CHƯA làm

- **`/thong-ke` đếm `User.objects.count()` (có staff), bảng `/users` nay thì không** ⇒ hai
  màn hình lệch nhau. `test_so_lieu_bang_dieu_khien_khop_bang_danh_sach` chỉ ghim phần
  mạch nên không ai đỏ. Cần user chốt số nào là số đúng.
- `app/users/page.tsx` còn **nhánh chết**: cột "Nhóm" nay chỉ ra được "Thành viên"; nhãn
  `quản trị`, `disabled={… || u.is_staff}`, `title` "Không ban được…", prop `laStaff` của
  `FormBan` không với tới nữa.
- **`PLAN.md` mục 7 chưa có endpoint mới**, và dòng `GET /admin/users` nay mô tả sai hành
  vi (không nói ba bộ lọc loại `is_staff`, không nói `so_staff_an`). **Cố ý chưa sửa**:
  `PLAN.md` đang bị phiên Claude khác sửa dở. Cái chuông đáng lẽ bắt việc này —
  `test_api_quan_tri_hop_dong.py` — chỉ lấy mẫu 4 dòng cứng nên nó xanh mà không nói gì.
- **`apps/admin` KHÔNG build được** vì `components/dung-mo-ta.ts` thiếu hai lý do báo cáo
  (`cam_ket_loi_nhuan`, `link_nhom_kin`) mà commit `9edc374` của phiên khác vừa thêm vào
  model. File sạch trong git, sửa 2 dòng là xong — nhưng **chữ hiển thị là chữ sản phẩm**,
  và đoán sai câu chữ tệ hơn để nguyên. Chờ chủ nhân của nó.
