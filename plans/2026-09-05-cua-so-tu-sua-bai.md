# Cửa sổ tự sửa bài (Moc) — giới hạn thời gian, cấu hình admin, hiện "đã sửa bởi ai"

Chốt 2026-09-05. User: tác giả chỉ tự sửa được `Moc` trong một khoảng thời gian nhất định
kể từ lúc đăng; qua khoảng đó **chỉ superuser** sửa được (qua khu quản trị, đã có sẵn từ
`plans/2026-09-03-sua-bai-khu-quan-tri.md`). Số phút của khoảng này là **tham số cấu hình
trong admin**, không phải hằng số cứng. Sau khi sửa, hiện rõ **"Đã sửa bởi &lt;tên&gt; vào
&lt;ngày giờ&gt;"** thay cho nhãn "đã sửa N lần" hiện tại. **Chỉ áp cho `Moc`, không đụng
`Comment`.**

Ba câu hỏi đã hỏi và chốt trực tiếp với user:
1. Sau cửa sổ, ai sửa được? → **Chỉ superuser** (giữ nguyên luật khu quản trị hiện có,
   không mở rộng cho mod thường).
2. Giá trị mặc định khi chưa ai cấu hình? → **60 phút.**
3. Hết cửa sổ, UI phản ứng thế nào? → **Ẩn nút Sửa trên UI**; backend vẫn trả 403 nếu gọi
   thẳng API (phòng thủ ở cả hai lớp).

## 0 · Cái KHÔNG làm

- Không đụng `Comment` — sửa bình luận vẫn như cũ (chỉ tác giả, không giới hạn thời gian,
  không có đường mod).
- Không mở rộng quyền sửa nội dung người khác cho mod thường — vẫn 403 `khong_du_quyen`
  như `plans/2026-09-03-sua-bai-khu-quan-tri.md` đã chốt.
- Không đổi `PHUT_SUA_IM_LANG` (15 phút, `core/ghi.py:135`) — đó là cửa sổ **để vết hay
  không** (revision/audit), một khái niệm khác hẳn cửa sổ **có quyền tự sửa hay không**
  đang làm ở đây. Hai hằng số, hai bảng cấu hình, không gộp.
- Không hardcode số phút ở frontend. `apps/web/lib/vong-doi.ts` đã bỏ hẳn cách chép hằng số
  Python sang JS (docstring dòng 21-24: *"Ba hằng đã bị xoá, không để lại cho chắc"*) —
  **API phải trả sẵn mốc thời gian đã cộng dồn** (`sua_duoc_den`), frontend chỉ so với
  `new Date()`, đúng pattern `sua_im_lang_den` đang có.

## 0.1 · Cây làm việc — ĐANG có việc dở của phiên khác, đọc kỹ trước khi sửa

`git status` đầu phiên cho thấy `api/core/models/moc.py` đang `M` và
`api/core/migrations/0028_alter_moc_body.py` chưa track. User xác nhận: đây là việc của
**Antigravity** (nới `DAI_BODY_MOC` từ 10.000 lên 50.000 ký tự), **đã làm xong, chưa
commit** — không phải việc dở cần tránh đụng, mà là việc cần **làm nốt cùng đợt này rồi
commit chung** (2 commit tách bạch, xem §6).

⇒ `opus-dev` **KHÔNG được revert/ghi đè** hai thay đổi đó. Bước đầu tiên: `git diff --
api/core/models/moc.py api/core/migrations/0028_alter_moc_body.py` để thấy đúng nội dung,
rồi viết migration mới của lượt này **nối tiếp sau `0028`** (tức `0029_...py`) — không đổi
số hay nội dung của `0028`.

## 1 · Thiết kế

### 1.1 · Cấu hình "phút tự sửa" — model mới, một hàng duy nhất

Không có cơ chế "settings" tổng quát trong repo (chỉ có cấu hình Google OAuth vá được vào
model `SocialApp` có sẵn — không tái dùng được cho một số nguyên đơn giản). Thêm model mới,
nhỏ nhất có thể, theo đúng tinh thần "đủ dùng, không dựng khung cho tương lai chưa cần":

```python
# api/core/models/he_thong.py — thêm vào cụm "hệ thống" cạnh Notification/Report/AuditLog
class CauHinhBienTap(models.Model):
    """Cấu hình biên tập, MỘT hàng duy nhất (pk=1, tạo lười qua get_or_create).

    `phut_tu_sua_moc`: số phút kể từ `Moc.created_at` mà TÁC GIẢ còn tự sửa bài qua
    `PATCH /api/v1/mocs/{id}`. Hết cửa sổ này tác giả nhận 403 `het_cua_so_sua`; chỉ
    superuser sửa tiếp được, qua `PATCH /admin/mocs/{id}` (không giới hạn thời gian —
    xem `sua_moc_boi_mod`, PLAN 2026-09-03).
    """
    phut_tu_sua_moc = models.PositiveIntegerField(default=PHUT_TU_SUA_MAC_DINH)

    class Meta:
        verbose_name = "cấu hình biên tập"
```

- `PHUT_TU_SUA_MAC_DINH = 60` khai ở `core/cau_hinh.py` (module MỚI, không phải
  `core/ghi.py` — tránh trộn với `PHUT_SUA_IM_LANG`).
- `core/cau_hinh.py::doc_phut_tu_sua_moc() -> int`: `get_or_create(pk=1)`, trả
  `phut_tu_sua_moc`. Gọi **một lần** ở nơi cần, không gọi trong vòng lặp (N+1 query — xem
  §1.3).
- `core/cau_hinh.py::luu_phut_tu_sua_moc(*, phut: int, boi, ly_do: str = "") -> tuple[CauHinhBienTap, bool]`:
  validate `1 <= phut <= 10_080` (7 ngày — chặn nhập nhầm số âm/khổng lồ mà không bịa một
  trần tuỳ hứng), y nguyên ⇒ `(cau_hinh, False)` không ghi log; khác ⇒ `save()` +
  `ghi_audit(actor=boi, action="sua_cau_hinh_bien_tap", target_type="he_thong", target_id=1,
  meta={"phut_cu": ..., "phut_moi": phut, "ly_do": ly_do})`.
- Cập nhật `core/models/__init__.py` (thêm `CauHinhBienTap`, tổng **15 model**) và
  `tests/test_models_domain.py::test_du_14_model_...` (đổi số + tên, hoặc đổi hẳn cách đếm
  sang "đọc registry, so độ dài" để khỏi phải sửa lần sau — quyết định ở nghiệm thu, tối
  thiểu bài đo cũ phải xanh với số 15).
- Migration `0029`: tạo bảng `CauHinhBienTap` + field `Moc.edited_by` (§1.2) trong CÙNG một
  file (`makemigrations` gộp tự nhiên nếu chạy một lượt) — không bắt buộc tách hai file.

### 1.2 · `Moc.edited_by` — ai là người sửa lần gần nhất

`api/core/models/moc.py` (sau `edit_count`, KHÔNG đụng dòng `DAI_BODY_MOC` của Antigravity):

```python
edited_by = models.ForeignKey(
    settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True,
    related_name="mocs_da_sua",
)
```

`null=True` bắt buộc: **dữ liệu cũ** (mọi mốc đã từng sửa trước migration này) không có
`edited_by`, và migration không thể suy ngược ra ai đã sửa. Frontend phải xử lý ca
`edited_by is None` (§1.5) — không phải lỗi, là dữ liệu lịch sử.

`api/core/ghi.py::_ap_sua_moc` thêm tham số `nguoi_sua` (User), đặt `moc.edited_by =
nguoi_sua` cùng nhánh `if de_dau:` (chỗ đang đặt `edited_at`/`edit_count`), thêm
`"edited_by"` vào `cot_ghi`. Hai người gọi:
- `sua_moc(...)` (đường tác giả) → `_ap_sua_moc(..., nguoi_sua=moc.author)`.
- `sua_moc_boi_mod(...)` (đường mod) → `_ap_sua_moc(..., nguoi_sua=boi)`.

Sửa trong cửa sổ im lặng (`de_dau=False`) thì **không** đặt `edited_by` — đúng logic hiện
có: sửa im lặng không để dấu vết gì, kể cả danh tính.

### 1.3 · Chặn quyền tự sửa ở `PATCH /api/v1/mocs/{id}`

`api/api/mocs.py::sua_moc_api`, chèn NGAY SAU `doi_con_song(moc, "Mốc")` (dòng ~222),
TRƯỚC khi dựng `thay_doi`:

```python
han = moc.created_at + timedelta(minutes=doc_phut_tu_sua_moc())
if timezone.now() > han:
    raise LoiGhi(403, "het_cua_so_sua", "Đã quá thời hạn tự sửa bài này.")
```

(theo đúng cách `LoiGhi` đang được ném và bắt ở các nhánh 403/409 khác trong cùng handler —
kiểm lại cách `api_admin`/`api_v1` dịch `LoiGhi` thành `{detail, code}` ở lượt viết code,
đừng giả định).

**Đường admin (`PATCH /admin/mocs/{id}` → `sua_moc_boi_mod`) KHÔNG đổi gì** — không có và
không thêm kiểm tra thời gian, đúng quyết định #1 (chỉ superuser sửa được sau cửa sổ, không
giới hạn gì thêm cho họ).

### 1.4 · `MocOut` — thêm `sua_duoc_den` và `edited_by`

`api/api/schemas.py::MocOut` thêm:
```python
sua_duoc_den: datetime          # mốc hết cửa sổ TỰ sửa (created_at + phút cấu hình)
edited_by: NguoiDungTomTatOut | None  # None nếu chưa từng sửa lộ HOẶC dữ liệu cũ không có
```

`api/api/trinh_bay.py`: import `doc_phut_tu_sua_moc` từ `core.cau_hinh`. **Gọi một lần** ở
đầu hàm dựng danh sách/trang (nơi đang có sẵn `PHUT_SUA_IM_LANG` cho `sua_im_lang_den`),
truyền xuống hàm dựng từng `MocOut` — tuyệt đối không gọi `doc_phut_tu_sua_moc()` bên trong
vòng lặp per-mốc (một query DB cho mỗi mốc trên trang feed là N+1 thật, mốc dùng chung một
giá trị cấu hình).

```python
sua_duoc_den=moc.created_at + timedelta(minutes=phut_tu_sua),   # luôn có, như sua_im_lang_den
edited_by=nguoi_dung_tom_tat(moc.edited_by) if hien and moc.edited_by else None,
```

### 1.5 · Frontend `apps/web`

- `lib/vong-doi.ts`: thêm hàm `tuSuaConDuoc(suaDuocDen: string): boolean` — so
  `new Date(suaDuocDen) > new Date()`, cùng khuôn với `conMoLaiDuoc`.
- `components/hanh-dong-moc.tsx`: điều kiện ẩn nút Sửa hiện tại (dòng 74-89) thêm nhánh
  `if (!tuSuaConDuoc(moc.sua_duoc_den)) return null;` — đặt SAU kiểm chủ sở hữu/mạch khoá,
  TRƯỚC khi dựng `nhac_sua` (nhắc sửa im lặng là chuyện khác, không liên quan cửa sổ này).
  Đặt tên biến/thông điệp không trùng `nhac_sua` để hai khái niệm không lẫn trong code.
- `components/the-moc.tsx` (dòng 104-112): đổi nhãn "đã sửa N lần":
  - `edited_by` có giá trị ⇒ **"Đã sửa bởi &lt;tên&gt; vào &lt;ngày giờ VN&gt;"** (dùng
    hàm định dạng ngày giờ đã có trong repo, không viết mới nếu đã có ở `lib/`), kèm
    `BanCuMoc` bấm được như cũ nếu `edit_count > 0`.
  - `edited_by` là `null` mà `edit_count > 0` (dữ liệu cũ trước migration) ⇒ **giữ nguyên
    hành vi cũ** "đã sửa N lần" — không bịa tên người sửa cho dữ liệu không biết.
  - `edited_by` null và `edit_count === 0` ⇒ không hiện gì, như hiện tại.

### 1.6 · Cài đặt admin

`api/api/quan_tri_cai_dat.py` (cùng file với cấu hình Google, cùng pattern):

| Cửa | `operation_id` | Ai | Hành vi |
|---|---|---|---|
| `GET /cai-dat/bien-tap` | `quan_tri_xem_cai_dat_bien_tap` | mọi `is_staff` | `{phut_tu_sua_moc, sua_duoc: bool(is_superuser)}` |
| `PUT /cai-dat/bien-tap` | `quan_tri_luu_cai_dat_bien_tap` | chỉ superuser | body `{phut_tu_sua_moc: int}`; 403 `khong_du_quyen` cho mod thường; 400 `du_lieu_khong_hop_le` nếu ngoài `[1, 10080]`; gọi `luu_phut_tu_sua_moc`; trả `{da_doi, phut_tu_sua_moc}` |

Dùng lại `_chan_neu_khong_phai_superuser` đã có (từ lượt 2026-09-03, đã tách dùng chung với
`quan_tri_nguoi_dung.py` — nếu chưa tách thật thì tách luôn ở đây, không chép lần ba như
mục "còn treo" của plan cũ đã ghi sổ).

`apps/admin/app/cai-dat/page.tsx`: thêm component `KhoiPhutTuSua()` (đúng khuôn
`KhoiGoogle`: `useState` + `useEffect` nạp qua `useHanhDong`, input `type="number"`, khoá
theo `sua_duoc`), chèn cạnh `<KhoiGoogle />`. Label rõ ràng: "Số phút tác giả được tự sửa
bài sau khi đăng — hết thời gian này chỉ quản trị viên sửa được."

### 1.7 · Codegen

`pnpm codegen` sinh `packages/api-client/src-admin` có `quanTriXemCaiDatBienTap`,
`quanTriLuuCaiDatBienTap`; `openapi.admin.json` đổi. `packages/api-client/src`/`openapi.json`
đổi vì `MocOut` thêm hai trường. `pnpm codegen:check` exit 0.

## 2 · Bài đo bắt buộc

Nền: chạy `pnpm test` TRƯỚC khi sửa gì để có con số xuất phát (cây đã có việc dở của
Antigravity — ghi rõ nền đo trên cây đó).

| # | Đo gì |
|---|---|
| C1 | Tác giả PATCH mốc trong cửa sổ (mock `timezone.now`, hoặc set `created_at` gần hiện tại) ⇒ 200; `edited_by == author`; `edited_at` khác null |
| C2 | Tác giả PATCH mốc **sau** cửa sổ (mặc định 60 phút) ⇒ 403 `het_cua_so_sua`; DB không đổi; `edited_by` không đổi |
| C3 | Superuser PATCH qua `/admin/mocs/{id}` **sau** cửa sổ ⇒ vẫn 200 (không bị chặn bởi luật mới); `edited_by == superuser`, khác `moc.author` |
| C4 | Mod thường PATCH qua `/admin/mocs/{id}` sau cửa sổ ⇒ vẫn 403 `khong_du_quyen` như cũ — luật cũ không bị luật mới nới lỏng |
| C5 | Đổi cấu hình `phut_tu_sua_moc` qua `PUT /admin/cai-dat/bien-tap` xuống còn 1 phút, rồi PATCH mốc 2 phút tuổi qua v1 ⇒ 403 `het_cua_so_sua` — chứng minh enforcement đọc DB, không cache giá trị cũ |
| C6 | `GET /admin/cai-dat/bien-tap`: mod thường đọc được (200), không ghi được (403 khi PUT); `PUT` với `phut_tu_sua_moc=0` hoặc `-5` hoặc `20000` ⇒ 400; y nguyên giá trị ⇒ `da_doi=false`, 0 `AuditLog` mới |
| C7 | `GET /api/v1/machs/{id}` (hoặc endpoint trả `MocOut`): có `sua_duoc_den` đúng `created_at + phút cấu hình HIỆN HÀNH`; mốc chưa từng sửa ⇒ `edited_by=null` |
| C8 | Mốc sửa TRONG cửa sổ im lặng 15 phút (lần đầu) ⇒ vẫn `edited_by=null`, `edited_at=null` — luật cũ không đổi |
| C9 | Migration chạy trên dữ liệu có sẵn (`gikky_e2e` hoặc fixture) — mốc `edit_count > 0` từ TRƯỚC migration này có `edited_by=null` sau `migrate`, không lỗi, không mất `edit_count`/`edited_at` cũ |
| C10 | `pytest --collect-only` đếm đủ 15 model (`test_models_domain.py`) |
| C11 | Toàn bộ `test_api_ghi_moc.py`, `test_quyen_ghi.py`, `test_api_quan_tri_sua_bai.py`, `test_api_mod.py`, `test_operation_id.py` xanh không sửa (trừ những chỗ PHẢI đổi vì thêm trường/model — liệt kê rõ trong báo cáo) |

**Thử phá (luật 4, bắt buộc):** (a) xoá điều kiện `if timezone.now() > han` ở `mocs.py` ⇒
C2 đỏ; (b) đổi `nguoi_sua=boi` thành `nguoi_sua=None` trong `sua_moc_boi_mod` ⇒ C3 đỏ (vế
`edited_by == superuser`); (c) đổi `doc_phut_tu_sua_moc()` thành hằng cứng `60` (bỏ đọc DB)
⇒ C5 đỏ; (d) bỏ điều kiện `hien` khi gán `edited_by` trong `trinh_bay.py` ⇒ bài đo che nội
dung ẩn phải đỏ (thêm nếu chưa có case này trong C7). Mỗi ca: sửa hỏng → chạy đúng bài →
ĐỎ → khôi phục → xanh.

## 3 · Tiêu chí nghiệm thu (ĐO ĐƯỢC)

1. `pnpm test`: 0 failed, 0 warning (`filterwarnings = error`), số bài mới ghi rõ so với
   nền đầu phiên.
2. `pnpm codegen:check` exit 0.
3. `pnpm lint` 0 warning cả hai app. `pnpm build` 0 warning — kiểm cổng 3000/3001/8000
   trống trước khi build (build phá `next dev` đang chạy — CLAUDE.md).
4. `pnpm e2e:don-vi` xanh toàn bộ.
5. Bài đo C1–C11 có mặt và xanh; 4 lượt thử phá đỏ đúng bài rồi xanh lại.
6. Kiểm bằng trình duyệt thật (script Playwright dùng-một-lần trên `gikky_e2e`, theo đúng
   khuôn `plans/2026-09-03-sua-bai-khu-quan-tri.md §6.3` — KHÔNG đụng `gikky_dev`): tạo
   mốc, lùi `created_at` qua cửa sổ mặc định bằng shell, xác nhận nút Sửa của tác giả biến
   mất trên trang; đăng nhập superuser sửa được qua khu quản trị; trang công khai hiện
   "Đã sửa bởi `<superuser>` vào `<giờ>`"; đổi cấu hình xuống 1 phút trong khu quản trị,
   tạo mốc mới, đợi >1 phút, xác nhận nút Sửa của tác giả biến mất đúng lúc.
7. Migration `0029` áp được lên cây có dữ liệu cũ mà không lỗi (C9); `0028` của Antigravity
   được giữ nguyên, không bị đổi số hay nội dung.
8. Không commit/deploy cho tới khi nghiệm thu + phản biện xong (chặng 5 mới commit — xem §6).

## 4 · Chia độc quyền chặng 3/4

| Agent | Được chạy | Cấm |
|---|---|---|
| `nghiem-thu` | `pnpm test` · `pnpm build` · `pnpm codegen:check` · `pnpm lint` · `pnpm e2e:don-vi` · script trình duyệt §3.6 | — |
| `phan-bien` | đọc code · `pnpm lint` · `pnpm e2e:don-vi` · SQL chỉ đọc | `pnpm test` · build · script §3.6 |

## 5 · Sau nghiệm thu + phản biện: commit và deploy

User đã chốt: làm xong thì **commit và deploy**. Tại chặng 5, phiên chính:

1. Stage + commit **RIÊNG** phần của Antigravity trước (chỉ hai file: `moc.py` phần
   `DAI_BODY_MOC`, `migrations/0028_alter_moc_body.py`) — dùng `git add -p` nếu cần tách
   hunk khỏi phần `edited_by` cùng nằm trong `moc.py`. Message mô tả đúng việc: nới giới
   hạn thân mốc.
2. Stage + commit phần việc của plan này (model, ghi.py, mocs.py, schemas, trinh_bay,
   quan_tri_cai_dat, migration 0029, frontend hai app, test).
3. **Deploy chỉ sau khi cả hai commit đã có và mọi tiêu chí §3 đạt** — theo đúng quy trình ở
   `plans/2026-08-25-deploy-vps-docker.md`. Trước khi chạy lệnh deploy thật, xác nhận lại
   với user (đây là hành động ảnh hưởng hệ thống đang chạy, không tự động hoá âm thầm dù
   đã được đồng ý trước — báo rõ đang deploy gì, từ commit nào).

## 6 · Nhật ký thực hiện (`opus-dev` điền)

(để trống — điền quyết định nhỏ, số đo cuối, danh sách file test phải sửa vì đổi
schema/model, và mọi phát hiện ngoài phạm vi vào mục riêng cuối báo cáo theo luật "một việc
một lúc" ở `D:\Projects\CLAUDE.md`)
