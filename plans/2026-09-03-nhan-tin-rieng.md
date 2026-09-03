# Nhắn tin riêng 1-1 giữa người dùng + báo tin mới

**Trạng thái: XONG** (chặng 5 chốt 2026-09-03 — **chưa commit**, chờ user). User 2026-09-03: *"tính năng mới, thêm phần user nhắn
tin cho nhau, có báo notify nếu có msg mới"*.

## 0 · Bối cảnh đã kiểm (không phải phỏng đoán)

- **Chuông đã có**: `Notification` (`core/models/he_thong.py`), `core/thong_bao.py` (7 loại,
  `_ghi_theo_lo` = `INSERT … ON CONFLICT DO UPDATE` bump `created_at` + `read_at=NULL`),
  `api/thong_bao.py` (`GET /notifications`, `POST /notifications/read`),
  `components/chuong.tsx` **poll 60 giây, không websocket** (PLAN 5.8). Tin nhắn mới đi qua
  đúng cơ chế này — không dựng kênh thứ hai.
- **Chưa có gì về nhắn tin**: không model, không endpoint, không trang. `grep -ri "tin_nhan\|tin-nhan"` = 0.
- **Cây làm việc đang bị PHIÊN KHÁC sửa dở** (`plans/2026-09-03-sua-bai-khu-quan-tri.md`).
  `git diff HEAD -w` chỉ ra 9 file có thay đổi THẬT: `LOI-VA-NO.md`, `api/core/ghi.py`,
  `api/core/revalidate.py`, 4 file `*.module.css` (`form-tai-khoan`, `ket-qua-tim-kiem`,
  `the-mach`, `trang-mach`), 2 file `scripts/bai-viet/*`. **~85 file `MM` còn lại chỉ lệch
  CRLF/khoảng trắng** so với HEAD. ⚠ **Index git đang giữ snapshot CŨ** (P-20260830-5): cấm
  `git checkout --`/`git restore`; hoàn tác thử-phá bằng Edit ngược.
- Hàng rào phải đi qua khi thêm bề mặt mới (đã đọc từng cái):
  - `tests/test_operation_id.py` — mọi endpoint khai `operation_id`;
  - `tests/test_quyen_ghi.py::CUA_GHI` — bảng TƯỜNG MINH mọi cửa ghi của `api_v1`, thiếu/thừa
    một dòng là đỏ; cửa mới không có "chủ theo tham số" thì KHÔNG vào `CUA_CO_CHU`;
  - `tests/test_hop_dong_openapi.py` — mọi endpoint phải có docstring (= description);
  - `tests/test_migrations_dong_bo.py` — model ↔ migration khớp;
  - `tests/test_models_domain.py::MODEL_BAT_BUOC` là phép `<=` (thêm model không đỏ);
  - `e2e/don-vi/type-frontend.spec.ts` — mọi lời gọi API phải kèm `baseUrl`, **cấm alias hàm
    qua biến**, cấm khai lại schema;
  - `e2e/don-vi/mau-token.spec.ts` — cấm 8 mã hex của PLAN 9.1 ngoài `globals.css`;
  - `e2e/don-vi/vung-bam-cum-phai.spec.ts` — **BẢNG luật 44px phải BẰNG cụm phải thật trong
    `chrome.tsx`** (bài A). Thêm icon vào `.phai` ⇒ phải sửa `BANG`, `CUM_THAT` và bảng cặp
    `cap` của bài G trong chính spec ấy, và CSS của nút phải có đúng MỘT khối
    `(pointer: coarse)` với `min-width/min-height: 44px` + `margin-inline: -4px` (bù ngang,
    KHÔNG bù dọc). Nhà của luật: docstring `tim-kiem-mobile.module.css`.
- Nền: `pytest --collect-only` = **1886 bài**. Cổng 3000/3001/8000 đang TRỐNG lúc viết plan.
- DB: `gikky_dev` chứa dữ liệu thật — **cấm `pnpm e2e` trần**; e2e trỏ `gikky_e2e` bằng
  `DATABASE_URL` trong CÙNG một lệnh + `CI=1` (xem §6).

## 1 · Phạm vi

### LÀM

1. Hai model mới `HoiThoai` (hội thoại 1-1) + `TinNhan`, migration `0025`.
2. Đường ghi domain `core/tin_nhan.py` (KHÔNG đụng `core/ghi.py` — phiên khác đang sửa, và
   tin nhắn không chạm cột denormalize nào của `Mach`).
3. Loại thông báo thứ tám `tin_nhan` trong `core/thong_bao.py` — gộp theo hội thoại.
4. Hạn mức chống spam: `HAN_MUC_TIN_NHAN_MOI_GIO` (mặc định 60/giờ trượt) trong
   `core/han_muc.py` + `settings.py`.
5. Router `api/tin_nhan.py` — 5 cửa dưới `/me/tin-nhan…`, mount vào `v1.py`.
6. `pnpm codegen` sinh lại client TS.
7. Frontend `apps/web`: trang `/tin-nhan` (hộp thư) · `/tin-nhan/[username]` (cuộc trò
   chuyện, poll 10 s) · icon ✉ + chấm chưa đọc trên header (poll 60 s) · nút "Nhắn tin"
   trên hồ sơ · mục "Tin nhắn" trong menu tài khoản · dòng chuông loại `tin_nhan`.
8. Test Python (`tests/test_api_tin_nhan.py`) + cập nhật `CUA_GHI` + e2e trình duyệt
   (`e2e/tin-nhan.spec.ts`) + cập nhật hàng rào 44px.

### KHÔNG LÀM (ghi rõ để không "hoàn thiện nốt")

- **Không websocket / SSE.** PLAN 5.8 chốt poll; chat 10 s là đủ cho v1.
- **Không nhóm chat**, không sửa/xoá/thu hồi tin, không đính ảnh, không trạng thái "đang gõ",
  không "đã xem" hiển thị cho phía kia (chỉ có chấm chưa đọc cho chính mình).
- **Không chặn người (block)**, không "chỉ nhận tin từ người mình theo". Ghi sổ như hướng mở
  rộng — hạn mức 60/giờ là hàng rào duy nhất của lượt này.
- **Không email** cho tin nhắn mới (digest tuần là opt-in riêng, PLAN 5.8).
- **Không trang quản trị / kiểm duyệt tin nhắn.** Tin nhắn là riêng tư; mở cửa đọc cho mod là
  quyết định sản phẩm phải hỏi user. Ghi sổ.
- Không đăng ký vào Django admin (`core/admin.py` chỉ có `User`, giữ nguyên).
- Không đổi `ToiOut` / `GET /me`.

## 2 · Thiết kế (kèm lý do)

### 2.1 Model — `api/core/models/tin_nhan.py`

```
HoiThoai   nguoi_a FK User PROTECT · nguoi_b FK User PROTECT   # BẤT BIẾN: nguoi_a_id < nguoi_b_id
           created_at · cap_nhat_luc (= created_at của tin cuối; khoá sort hộp thư)
           da_doc_den_a BIGINT DEFAULT 0 · da_doc_den_b BIGINT DEFAULT 0   # id tin cuối mỗi bên đã đọc
           UNIQUE (nguoi_a, nguoi_b)  name="hoi_thoai_duy_nhat_cap"
           CHECK  (nguoi_a < nguoi_b) name="hoi_thoai_a_truoc_b"   # chặn cả tự-nhắn lẫn cặp đảo
           INDEX (nguoi_a, -cap_nhat_luc) · (nguoi_b, -cap_nhat_luc)

TinNhan    hoi_thoai FK CASCADE · nguoi_gui FK User PROTECT
           body TEXT (≤ 2000 ký tự, validator + kiểm ở đường ghi, plain text — KHÔNG HTML)
           created_at (server, editable=False)
           INDEX (hoi_thoai, -id)  name="tin_nhan_hoi_thoai_id"
```

- **Cặp có thứ tự `a < b`** ⇒ một hàng cho mỗi cặp bất kể ai mở trước; `CheckConstraint` viết
  theo khuôn `TheoUser.theo_user_khong_tu_theo` (`condition=Q(nguoi_a__lt=F("nguoi_b"))`).
- **Vạch đọc theo `id`, không theo thời gian**: đồng hồ máy này không phân giải nổi hai lời
  gọi liên tiếp (P-20260827-1), `id` thì đơn điệu. "Chưa đọc của tôi" = tin trong hội thoại
  tôi tham gia, `nguoi_gui ≠ tôi`, `id > da_doc_den_<phía tôi>`. Một câu COUNT cho cả hộp thư:
  ```python
  TinNhan.objects.filter(
      Q(hoi_thoai__nguoi_a=user, pk__gt=F("hoi_thoai__da_doc_den_a"))
      | Q(hoi_thoai__nguoi_b=user, pk__gt=F("hoi_thoai__da_doc_den_b"))
  ).exclude(nguoi_gui=user).count()
  ```
- **`cap_nhat_luc` là cột denormalize duy nhất**, cập nhật TRONG cùng transaction, dưới
  `select_for_update` hàng `HoiThoai` — cùng luật `cap_nhat_dem_mach`.
- **Thứ tự khoá hàng (ghi vào docstring model):** đường gửi khoá `HoiThoai` (FOR UPDATE) →
  INSERT `TinNhan` (FOR KEY SHARE `HoiThoai` + `User`) → INSERT `Notification` (FOR KEY SHARE
  `User`). Cạnh mới: `HoiThoai → User`. **Không chạm `Mach`/`Moc`/`Comment`/`MocAnh`** ⇒ không
  thể sinh chu trình với chuỗi `Comment/Moc → Mach → MocAnh` của repo. Hai đường duy nhất
  khoá `User` độc quyền (`ban_user`/`go_ban_user`) không chạm `HoiThoai`.
- `on_delete=PROTECT` cho FK người: `User` không bao giờ bị DELETE (ẩn danh hoá, PLAN mục 6).

### 2.2 Đường ghi — `api/core/tin_nhan.py` (module MỚI)

```python
DO_DAI_TIN_TOI_DA = 2000

def cap_thu_tu(u1, u2) -> tuple[User, User]        # theo pk tăng dần
def lay_hoi_thoai(u1, u2) -> HoiThoai | None
def gui_tin(*, nguoi_gui, nguoi_nhan, body: str) -> TinNhan
def danh_dau_da_doc(*, user, hoi_thoai) -> None    # da_doc_den_<phía user> = max(id) tin trong hội thoại
def dem_chua_doc(user) -> int                      # câu COUNT ở 2.1
def dem_chua_doc_theo_hoi_thoai(user, hoi_thoai_ids) -> dict[int, int]   # MỘT truy vấn annotate
```

`gui_tin`: `ValidationError` khi tự nhắn mình · body rỗng sau `strip()` · quá dài. Trong
`transaction.atomic()`: `get_or_create` HoiThoai theo cặp có thứ tự (va `IntegrityError` trên
`hoi_thoai_duy_nhat_cap` ⇒ đọc lại, đúng khuôn `_la_va_cham`), `select_for_update` hàng ấy,
INSERT tin, đặt `cap_nhat_luc = tin.created_at`. Trả `tin` (đã `select_related("hoi_thoai")`).

⚠ **SỬA plan ở chặng 2 (2026-09-03): gửi tin KHÔNG dời vạch đọc của người gửi.** Bản đầu của
mục này bảo đặt `da_doc_den_<phía người gửi> = tin.pk`; nó **mâu thuẫn với chính §4-A6 và
§5.1** của plan này, và cả hai chỗ kia mới đúng:

- vạch đọc là một cột `id`, nên đặt nó bằng `tin.pk` đánh dấu luôn **mọi tin của phía kia có
  id nhỏ hơn** là đã đọc. Ca cụ thể: B nhận 3 tin chưa xem, gõ một câu trả lời, cả 3 tin kia
  im lặng biến khỏi số chưa đọc — trong khi A6 đòi *"B gửi lại 1 ⇒ A = 1, **B vẫn 3**"*;
- thứ bảo đảm "người gửi không tự đếm tin mình" là `.exclude(nguoi_gui=user)` trong
  `dem_chua_doc`, không phải vạch đọc. Nếu đặt vạch ở đây thì **phép thử phá §5.1 mất tác
  dụng**: bỏ `.exclude(...)` đi mà A6 vẫn xanh, tức một hàng rào rỗng.

Đánh dấu đã đọc là việc của `danh_dau_da_doc`, gọi từ `POST …/doc` khi hội thoại thật sự được
mở ra.

**Không gọi `bao_tin_nhan` từ đây** — cùng ràng buộc (2) của `core/thong_bao.py`: handler gọi,
trong cùng `atomic()`.

### 2.3 Thông báo — `core/thong_bao.py`

- `TIN_NHAN = "tin_nhan"`, thêm vào `LOAI_HOP_LE` (cuối tuple).
- `bao_tin_nhan(tin) -> int`: người nhận = phía kia; `dedupe_key = f"tin_nhan:{hoi_thoai_id}"`
  (**gộp theo HỘI THOẠI, không theo ngày** — cùng lý lẽ `theo_user`: 20 tin trong 5 phút là MỘT
  dòng chuông được bump, không phải 20 dòng); payload
  `{"boi": username người gửi, "boi_hien_thi": display_name, "so_tin_moi": số tin CHƯA ĐỌC của
  người nhận trong hội thoại đó (đếm từ nguồn), "hoi_thoai_id": id}`. Đi qua `_ghi_theo_lo`.
- `doc_thong_bao_tin_nhan(user, hoi_thoai_id) -> int`: `Notification.filter(user, dedupe_key,
  read_at__isnull=True).update(read_at=now)` — gọi từ `POST …/doc`, để mở hội thoại là chuông
  cũng tắt chấm cho đúng hội thoại ấy (không tắt hội thoại khác).

### 2.4 Hạn mức — `core/han_muc.py` + `config/settings.py`

`HAN_MUC_TIN_NHAN_MOI_GIO = env.int("HAN_MUC_TIN_NHAN_MOI_GIO", default=60)`;
`tran_tin_nhan_moi_gio()`, `dem_tin_nhan_trong_gio(user, khi=None)`, `luc_tin_nhan_duoc_lai(user,
khi=None)` — chép đúng khuôn ba hàm bình luận/giờ (giờ TRƯỢT, đếm ngoài khoá, lý do ghi ở đầu
`han_muc.py` áp nguyên). Bảng ở docstring module `han_muc.py` thêm một dòng. **Không sửa
`api/.env.example`.**

### 2.5 API — `api/api/tin_nhan.py`, mount `api_v1.add_router("", router_tin_nhan)`

Mọi cửa: `auth=dang_nhap` (⇒ 401 khách, CSRF, 403 `bi_khoa`), `response["Cache-Control"] =
"no-store"`, `tags=["tin-nhan"]`, `operation_id` tường minh, docstring = hợp đồng công khai
(không ghi lý do triển khai vào đó — dùng `#`). Out-schema đặt ở `api/schemas.py`, In-schema ở
`api/schemas_ghi.py` (đúng chỗ của repo).

| # | Cửa | `operation_id` | Trả về | Lỗi |
|---|---|---|---|---|
| 1 | `GET /me/tin-nhan` | `liet_ke_hoi_thoai` | `HopThuOut {items: [HoiThoaiOut], so_chua_doc}` — sắp `-cap_nhat_luc, -id`, **trần 100 hội thoại** (hằng `TOI_DA_HOI_THOAI`, docstring nói rõ chưa phân trang) | 401 |
| 2 | `GET /me/tin-nhan-chua-doc` | `dem_tin_nhan_chua_doc` | `SoChuaDocOut {so_chua_doc}` | 401 |
| 3 | `GET /me/tin-nhan/{username}?truoc=&limit=` | `xem_hoi_thoai` | `HoiThoaiChiTietOut {hoi_thoai_id: int\|null, nguoi_kia: NguoiDungTomTatOut, items: [TinNhanOut] TĂNG DẦN theo id, con_cu_hon: bool}` — `limit` mặc định 30, kiểm bằng `kiem_gioi_han` (1..50); `truoc` = id, trả tin có `id < truoc` | 400 tự xem mình (`du_lieu_khong_hop_le`) · 400 limit · 401 · 404 username lạ (`khong_tim_thay`) · 404 `is_active=False` **chỉ khi CHƯA có hội thoại** — xem A19 |
| 4 | `POST /me/tin-nhan/{username}` body `TinNhanIn {body}` | `gui_tin_nhan` | **201** `TinNhanOut {id, body, created_at, cua_toi}` | 400 tự nhắn/rỗng/quá dài · 401 · 403 `bi_khoa` · 404 như trên · **429 `qua_han_muc_tin_nhan`** kèm `thu_lai_tu` (`loi_thoi_gian`, kiểm TRƯỚC `atomic()` như `luc_binh_luan_duoc_lai`) |
| 5 | `POST /me/tin-nhan/{username}/doc` | `doc_hoi_thoai` | `SoChuaDocOut` (tổng CÒN chưa đọc toàn hộp thư, để header cập nhật ngay) | 401 · 404; chưa có hội thoại ⇒ 200, không làm gì |

`HoiThoaiOut {id, nguoi_kia: NguoiDungTomTatOut, tin_cuoi: TinNhanOut | null, so_chua_doc: int,
cap_nhat_luc: datetime}`. Cửa 1 phải là **số truy vấn HẰNG theo N hội thoại**: phiên (2) + hội
thoại `select_related("nguoi_a", "nguoi_b")` (1) + tin cuối của cả lô bằng MỘT truy vấn
(`order_by("hoi_thoai_id", "-id").distinct("hoi_thoai_id")` — Postgres `DISTINCT ON`) (1) + chưa
đọc theo hội thoại (1) + tổng chưa đọc (1) = **6**, ghim bằng `django_assert_num_queries` ở N=3
và N=6.

⚠ **Cửa 2 dùng gạch NỐI, không gạch chéo** *(sửa ở chặng 5, sau lượt phản biện)*: bản đầu
đặt nó ở `/me/tin-nhan/chua-doc`, mà `chua-doc` là một **username hợp lệ** với
`UnicodeUsernameValidator` — nên nó nằm ngay trong không gian `{username}` của cửa 3 và nuốt
trọn người dùng tên ấy. Đo thật: `GET` của họ trả `{"so_chua_doc": 0}` (sai hình dạng ⇒ client
ném `TypeError` rồi hiện một câu lỗi không liên quan), `POST` ăn **405 text/plain** — phá hợp
đồng `{detail, code}` của PLAN mục 7. Ra hẳn khỏi không gian username rẻ hơn nuôi một danh
sách tên cấm. `operation_id` giữ nguyên nên frontend không đổi lời gọi.

Mã lỗi mới trong `api/quyen.py`: `QUA_HAN_MUC_TIN_NHAN = "qua_han_muc_tin_nhan"` (429).

Cập nhật `tests/test_quyen_ghi.py::CUA_GHI`: thêm 2 dòng
`("post", "/api/v1/me/tin-nhan/{username}", {"body": "B"})` và
`("post", "/api/v1/me/tin-nhan/{username}/doc", {})` kèm chú thích cùng khuôn nhóm "theo dõi
người" (chủ suy từ phiên, không vào `CUA_CO_CHU`).

### 2.6 Frontend `apps/web`

| File | Việc |
|---|---|
| `lib/url.ts` | `duongDanTinNhan(username?: string)` → `/tin-nhan` hoặc `/tin-nhan/<username>` |
| `app/tin-nhan/page.tsx` | `force-dynamic` (vì `KhungHaiCot`), `metadata.robots noindex`, title "Tin nhắn"; render `<KhungHaiCot><HopThu/></KhungHaiCot>` |
| `app/tin-nhan/[username]/page.tsx` | như trên, title `Nhắn tin với u/<username>`; `<CuocTroChuyen username/>` |
| `components/hop-thu.tsx` + `.module.css` | client. Khách ⇒ `router.replace("/dang-nhap")` (khuôn `form-cai-dat.tsx`); nhịp `dangTai` không vẽ gì. Gọi `lietKeHoiThoai`. Mỗi dòng: `Avatar` · tên (`CHU_NGUOI_DUNG`) · một dòng xem trước (cắt 80 ký tự, prefix "Bạn: " nếu `tin_cuoi.cua_toi`) · `dauThoiGianServer` · chấm số chưa đọc (**không in 0** — nguyên tắc 9). Rỗng: "Chưa có cuộc trò chuyện nào. Mở hồ sơ một người rồi bấm “Nhắn tin”." testid: `hop-thu`, `hop-thu-rong`, `hop-thu-dong` (`data-chua-doc="N"`), `hop-thu-chua-doc` |
| `components/cuoc-tro-chuyen.tsx` + `.module.css` | client. Khách ⇒ redirect như trên. Nạp `xemHoiThoai`; vẽ tin tăng dần, **của tôi bên phải nền `--accent-soft`**, của họ bên trái nền `--inset`, giờ `dauThoiGianServer` mỗi tin; đầu trang: avatar + tên người kia link tới `/u/…`. Nút "Tải tin cũ hơn" khi `con_cu_hon` (gọi `truoc = items[0].id`, chèn lên đầu). Ô nhập `<textarea>` + nút "Gửi": **Enter gửi, Shift+Enter xuống dòng**, disabled lúc gửi, không gửi rỗng. Gửi ⇒ `guiTinNhan` ⇒ nối vào cuối ⇒ cuộn xuống đáy. **Poll 10 s** (`NHIP_POLL_MS = 10_000`) khi `!document.hidden`: nạp lại trang cuối và **chỉ nối tin có `id` > id lớn nhất đang có** (không vẽ trùng). Sau khi hiện tin của người kia (lúc nạp đầu và sau mỗi vòng poll có tin mới) và tab đang hiện ⇒ gọi `docHoiThoai`, rồi `window.dispatchEvent(new CustomEvent("gikky:tin-nhan-chua-doc", {detail: so_chua_doc}))` để header cập nhật ngay. Lỗi: 404 ⇒ "Không tìm thấy người dùng này." · 400 tự nhắn ⇒ "Bạn không thể nhắn tin cho chính mình." · 429 ⇒ "Bạn gửi hơi nhiều — thử lại sau HH:mm" (đọc `thu_lai_tu`) · khác ⇒ "Không gửi được. Thử lại sau ít giây." testid: `cuoc-tro-chuyen`, `tin-nhan-dong` (`data-cua-toi="1"/"0"`, `data-id`), `o-tin-nhan`, `nut-gui-tin`, `tin-nhan-loi`, `nut-tin-cu-hon`, `cuoc-tro-chuyen-rong` |
| `components/thu-tin.tsx` + `thu-tin.module.css` | client. Chỉ khi đã đăng nhập (`null` lúc `dangTai`/khách — như `Chuong`). `<Link href="/tin-nhan" className={css.nut} aria-label="Tin nhắn — N chưa đọc">` icon `MessageCircle` (lucide) + `.cham` số chưa đọc (**không in 0**). Poll `demTinNhanChuaDoc` (`GET /me/tin-nhan-chua-doc` — gạch NỐI, xem §2.5) **60 s** (`NHIP_POLL_MS = 60_000`, cùng PLAN 5.8) + nghe event `gikky:tin-nhan-chua-doc`. CSS chép khuôn `.nut`/`.cham` của `chuong.module.css`, **một** khối `@media (pointer: coarse)` `{ .nut { min-width: 44px; min-height: 44px; justify-content: center; padding: 6px 12px; margin-inline: -4px; } }`. testid: `thu-tin`, `thu-tin-so-chua-doc` |
| `components/chrome.tsx` | `<ThuTin />` đặt ngay SAU `<Chuong />`, kèm chú thích trỏ về hàng rào 44px |
| `e2e/don-vi/vung-bam-cum-phai.spec.ts` | `BANG` thêm `{ tag: "ThuTin", chon: ".nut", bu: "can", vi_sao: "nở ngang bằng padding, có hàng xóm" }`; `CUM_THAT` = `[…, "Chuong", "ThuTin", "CongTacTheme", …]`; bài G: thêm `thu: bu("ThuTin", ".nut")` và đổi cặp `["chuông", …, "theme"]` thành `["chuông", chuong, "thư", thu]` + `["thư", thu, "theme", theme]` (4+4 = 8 ≤ gap) |
| `components/chuong.tsx` | `HINH_LOAI.tin_nhan = MessageCircle`; `cauChuong`: `tin_nhan` ⇒ `${so("so_tin_moi")} tin nhắn mới từ ${ai}`; `dich`: `tin_nhan` ⇒ `/tin-nhan/${boi}` (khi có `boi`) — cùng nhánh với `theo_user` (không có `mach_id`) |
| `components/nut-nhan-tin.tsx` + `.module.css` | client. Hiện khi đã đăng nhập **và** `toi.username !== username` (khách/chính mình ⇒ `null`). `<Link href={duongDanTinNhan(username)}>` icon `MessageCircle` + "Nhắn tin", ngữ pháp thị giác như `.dang_theo` (viền mảnh, nút phụ). testid `nut-nhan-tin` |
| `app/u/[username]/page.tsx` | đặt `<NutNhanTin username=…/>` ngay sau `<NutTheoUser …/>` |
| `components/thanh-tai-khoan.tsx` | mục menu "Tin nhắn" (`MessageCircle`) ngay sau "Hồ sơ của tôi", link `/tin-nhan` |
| `e2e/tin-nhan.spec.ts` | xem §4 |

Mọi lời gọi API: import trực tiếp từ `@gikky/api-client`, **viết thẳng tên hàm kèm `baseUrl:
GOC_TRINH_DUYET`** (hàng rào `type-frontend`), ghi qua `headers: await headerGhi()`. Chữ do
người dùng gõ (tên, body tin) render kèm `{...CHU_NGUOI_DUNG}` như hồ sơ.

## 3 · Thứ tự thực thi (một `opus-dev`, tuần tự vì đụng chung `v1.py`/`schemas.py`)

1. Model + `models/__init__.py` (import + `__all__`) → `node scripts/py.mjs makemigrations core`
   → đổi tên file thành `0025_hoithoai_tinnhan.py` + docstring theo khuôn `0024`.
2. `core/tin_nhan.py` · `core/han_muc.py` + `settings.py` · `core/thong_bao.py`.
3. Schemas · `api/tin_nhan.py` · mount `v1.py` · `api/quyen.py` mã lỗi.
4. `tests/test_api_tin_nhan.py` · sửa `CUA_GHI` · `pnpm test` xanh · thử phá (§5).
5. `pnpm codegen` → `pnpm codegen:check` sạch.
6. Frontend theo bảng 2.6 · `pnpm lint` · `pnpm build` (0 warning) · `pnpm e2e:don-vi` xanh.
7. `e2e/tin-nhan.spec.ts` · chạy `pnpm e2e -g tin-nhan` theo ĐÚNG lệnh §6.

## 4 · Tiêu chí nghiệm thu (ĐO ĐƯỢC)

| # | Tiêu chí | Cách đo → kết quả mong đợi |
|---|---|---|
| A1 | Model + migration khớp | `pnpm test -- tests/test_migrations_dong_bo.py tests/test_models_domain.py` xanh; có file `api/core/migrations/0025_hoithoai_tinnhan.py` |
| A2 | Ràng buộc DB thật | test đọc `pg_constraint`: `hoi_thoai_a_truoc_b` là CHECK `nguoi_a_id < nguoi_b_id`; `HoiThoai(nguoi_a=B, nguoi_b=A)` với `B.pk > A.pk` ném `IntegrityError`; `nguoi_a = nguoi_b` ném `IntegrityError`; cặp trùng ném `IntegrityError` |
| A3 | Khách bị chặn ở cả 5 cửa | test: 5 request không đăng nhập ⇒ 401 `chua_dang_nhap`; `test_quyen_ghi.py::test_bang_cua_ghi_phu_du_api_v1` xanh với 2 dòng mới |
| A4 | Gửi tin tạo đúng MỘT hội thoại bất kể chiều | A gửi B rồi B gửi A ⇒ `HoiThoai.count() == 1`, `nguoi_a.pk < nguoi_b.pk`; cả hai tin cùng `hoi_thoai_id`; `POST` trả **201** |
| A5 | Tự nhắn / rỗng / quá dài / người lạ / người vô hiệu | tự nhắn ⇒ 400 `du_lieu_khong_hop_le`; `"   "` ⇒ 400; 2001 ký tự ⇒ 400, 2000 ⇒ 201; username lạ ⇒ 404 `khong_tim_thay`; `is_active=False` ⇒ 404 **cùng mã**; `GET` cùng bộ mã |
| A6 | Chưa đọc đếm đúng, người gửi không tự đếm | A gửi B 3 tin ⇒ `GET /me/tin-nhan/chua-doc` của B = 3, của A = 0; B gửi lại 1 ⇒ A = 1, B vẫn 3; B `POST …/doc` ⇒ B = 0, A vẫn 1; `doc` lần 2 ⇒ vẫn 0 (idempotent) |
| A7 | Per-user: C không thấy hội thoại A–B | C đăng nhập: `GET /me/tin-nhan` = `items: []`; `GET /me/tin-nhan/<A>` trả `hoi_thoai_id: null, items: []` (không phải tin của A–B); `moi_chuoi()` của cả hai response không chứa body tin A–B |
| A8 | Hộp thư sắp đúng + xem trước + số truy vấn hằng | A có hội thoại với B (cũ) và C (mới) ⇒ `items[0].nguoi_kia.username == C`; `tin_cuoi.body` đúng tin cuối, `cua_toi` đúng; `django_assert_num_queries(6)` ở N=3 **và** N=6 hội thoại |
| A9 | Phân trang tin cũ | 70 tin ⇒ `GET …/<B>` mặc định trả 30 tin **mới nhất, tăng dần theo id**, `con_cu_hon=true`; `?truoc=<id nhỏ nhất>` trả 30 tin kế, `id` đều `< truoc`; trang cuối `con_cu_hon=false`; `?limit=0`/`51` ⇒ 400 `tham_so_khong_hop_le` |
| A10 | Chuông: đúng người, gộp theo hội thoại, tắt khi đọc | A gửi B 3 tin ⇒ B có **đúng 1** `Notification(type="tin_nhan")`, `payload.so_tin_moi == 3`, `payload.boi == A.username`, `read_at is None`; A không có hàng nào; B `POST …/doc` ⇒ `read_at` không còn `None`; A gửi thêm 1 ⇒ vẫn 1 hàng, `so_tin_moi == 1`, `read_at` về `None` |
| A11 | Cùng transaction | trong `atomic()` gọi `gui_tin` + `bao_tin_nhan` rồi ném ⇒ sau đó `TinNhan.count()==0` và `Notification.count()==0` (khuôn `test_ghi_hong_thi_KHONG_con_thong_bao_nao`) |
| A12 | Hạn mức 60/giờ | `override_settings(HAN_MUC_TIN_NHAN_MOI_GIO=2)`: tin 3 ⇒ 429 `qua_han_muc_tin_nhan`, thân có `thu_lai_tu` (aware ISO) = `created_at` tin cũ nhất trong giờ + 1h; sang giờ khác (`_created_at_seed`/`freeze`) lại gửi được |
| A13 | `no-store` trên response THÀNH CÔNG | 200 của cửa 1, 2, 3, 5 và **201** của cửa 4 mang `Cache-Control: no-store`. ⚠ **Response LỖI thì KHÔNG** — 404/400/429 đi qua `raise LoiGhi` → exception handler chung của `api_v1`, và handler ấy dựng một `HttpResponse` mới nên không thấy header endpoint vừa gán. Chấp nhận được: thân một lời từ chối chỉ có `{detail, code}`, không mang tên ai và không mang một chữ nào của tin nhắn. Sửa triệt để phải đụng handler dùng chung của MỌI cửa `api_v1` ⇒ việc riêng. *(Sửa LỜI ở chặng 5 — bản đầu hứa "kể cả 404/400" mà bài đo chỉ đo 200/201, tức chữ nói quá code.)* |
| A19 | Người kia bị `is_active=False` **không** làm chấm chưa đọc kẹt vĩnh viễn | (a) B gửi A 3 tin rồi bị vô hiệu ⇒ A vẫn `GET` 200 và `POST …/doc` hạ `so_chua_doc` về 0; (b) B vô hiệu, **chưa** có hội thoại ⇒ `GET` 404 `khong_tim_thay`, cùng mã với username lạ; (c) `POST` gửi cho B vô hiệu ⇒ 404 kể cả khi hội thoại đã có. Ranh giới là VIỆC (`de_ghi`), không phải cửa — xem `_nap_nguoi_kia` |
| A20 | `chua-doc` là một USERNAME hợp lệ, không bị route cửa đếm nuốt | dựng user tên đúng `chua-doc`: `GET /me/tin-nhan/chua-doc` trả **`HoiThoaiChiTietOut`** (có `hoi_thoai_id`/`items`, **không** có `so_chua_doc`), `POST` cùng đường ⇒ **201**; và `GET /me/tin-nhan-chua-doc` vẫn trả `{"so_chua_doc": 0}` |
| A14 | Codegen | `pnpm codegen` exit 0; `pnpm codegen:check` exit 0; `packages/api-client/src/sdk.gen.ts` có `lietKeHoiThoai`, `demTinNhanChuaDoc`, `xemHoiThoai`, `guiTinNhan`, `docHoiThoai` |
| A15 | Build/lint | `pnpm build` 0 lỗi 0 warning · `pnpm lint` 0 warning · `pnpm test` xanh toàn bộ (nền 1886 + bài mới) |
| A16 | Hàng rào đơn vị | `pnpm e2e:don-vi` xanh toàn bộ, trong đó `vung-bam-cum-phai` bài A liệt kê `ThuTin`, bài C/D/G xanh cho `thu-tin.module.css` |
| A17 | e2e trình duyệt (`e2e/tin-nhan.spec.ts`, 4 bài) | (1) khách vào `/tin-nhan` ⇒ URL về `/dang-nhap`; (2) A vào `/u/<B>` thấy `nut-nhan-tin`, vào `/u/<A>` KHÔNG thấy; (3) A bấm nút ⇒ `/tin-nhan/<B>` ⇒ gõ, Enter ⇒ `tin-nhan-dong[data-cua-toi="1"]` hiện; B mở `/` ⇒ `thu-tin-so-chua-doc` = "1" ⇒ bấm ⇒ `hop-thu-dong[data-chua-doc="1"]` ⇒ vào ⇒ thấy tin `data-cua-toi="0"` ⇒ badge `thu-tin-so-chua-doc` biến mất (count 0) và chuông có `chuong-dong[data-loai="tin_nhan"]`; (4) B trả lời ⇒ trang A đang mở thấy tin của B trong ≤ 15 s (poll 10 s) mà không reload. Chạy bằng lệnh §6, ghi rõ DB=`gikky_e2e` |
| A18 | Không đụng file phiên khác | `git diff HEAD -w --stat` sau lượt KHÔNG chứa `api/core/ghi.py`, `api/core/revalidate.py`, 4 file css của phiên kia, `apps/admin/**`, `api/api/quan_tri*.py` với thay đổi nào ngoài thay đổi đã có sẵn |

## 5 · Thử phá (luật 4) — phá → bài nào ĐỎ → khôi phục bằng Edit ngược

1. Bỏ `.exclude(nguoi_gui=user)` trong `dem_chua_doc` ⇒ A6 đỏ (người gửi tự đếm).
2. Đổi `CheckConstraint hoi_thoai_a_truoc_b` từ `__lt` sang `__lte` ⇒ ca `nguoi_a = nguoi_b`
   đỏ. ⚠ **Phải sửa CẢ `core/models/tin_nhan.py` LẪN `core/migrations/0025_hoithoai_tinnhan.py`**
   *(đo ở chặng 2)*: `pytest --create-db` dựng schema từ **migration**, không từ model — sửa
   mỗi model rồi `--create-db` thì bảng vẫn mang `CHECK` cũ và cả bảng A2 **xanh nguyên**, tức
   một lượt thử phá báo "hàng rào tốt" trong khi nó chưa hề bị đụng tới. Cùng lượt ấy còn lộ
   ra rằng phép kiểm `"<" in dinh_nghia` nhận cả `<=`, nên bài đo `pg_constraint` đã siết
   thành `"<=" not in dinh_nghia and "<" in dinh_nghia`.
3. Bỏ lời gọi `bao_tin_nhan` trong handler ⇒ A10 đỏ.
4. Bỏ nhánh `is_active` ⇒ A5 đỏ (người vô hiệu nhận 201).
5. Bỏ phép kiểm hạn mức ⇒ A12 đỏ.
6. Đổi `distinct("hoi_thoai_id")` thành vòng `for` gọi `.first()` ⇒ A8 đỏ (số truy vấn tăng theo N).
7. Xoá dòng `ThuTin` khỏi `CUM_THAT` (giữ `chrome.tsx`) ⇒ `vung-bam-cum-phai` bài A đỏ.

### Chín phép thử phá THÊM ở chặng 5 (sau lượt phản biện 11 phát hiện)

Tất cả đo bằng `pytest api/tests/test_api_tin_nhan.py` hoặc `pnpm e2e:don-vi`:

8. Bỏ nhánh `lay_hoi_thoai(...) is None` trong `_nap_nguoi_kia` ⇒ A19(b) đỏ *(cửa đọc thành
   cửa dò tài khoản vô hiệu)*.
9. Trả `is_active=True` cho cả nhánh đọc ⇒ A19(a) đỏ *(chấm chưa đọc kẹt vĩnh viễn)*.
10. Đổi route cửa đếm về `/me/tin-nhan/chua-doc` ⇒ A20 đỏ.
11. `noiKhongTrung` nối trần `[...dau, ...sau]` ⇒ bài `noiKhongTrung` đỏ *(bong bóng nhân đôi)*.
12. `laKhoangTrong` luôn trả `false` ⇒ bài `laKhoangTrong` đỏ *(poll nuốt tin khi hơn một
    trang trôi qua giữa hai vòng)*.
13. Guard vòng poll đọc `loiGui` thay vì `loiNap` ⇒ bài "mục 3" đỏ *(một lỗi GỬI giết vòng
    poll vĩnh viễn)*.
14. Effect cuộn đáy phụ thuộc `items.length` ⇒ bài "mục 2" đỏ *("Tải tin cũ hơn" bị kéo tuột
    về đáy)*.
15. `cauLoi` gán cứng 400 thành "Bạn không thể nhắn tin cho chính mình." ⇒ bài `cauLoi` đỏ
    *(nói sai hai trong ba ca của cùng một mã)*.
16. `HopThu` quay về `return` sớm, bỏ nhánh `catch` ⇒ bài "mục 8" đỏ *(mọi lỗi ra trang trắng)*.

## 6 · Lệnh

- Test: `pnpm test` (thêm cờ: `pnpm test -- tests/test_api_tin_nhan.py -x`).
- Migration: `node scripts/py.mjs makemigrations core`.
- Codegen: `pnpm codegen` rồi `pnpm codegen:check`.
- `pnpm lint` · `pnpm build` · `pnpm e2e:don-vi` (an toàn, không DB, không cổng).
- **e2e trình duyệt — CHỈ chạy bằng đúng lệnh này (PowerShell), một tiến trình duy nhất**:
  ```powershell
  $url = [regex]::Match((Get-Content api\.env -Raw), '(?m)^DATABASE_URL=(.+)$').Groups[1].Value.Trim(); $env:DATABASE_URL = ($url -replace '/gikky_dev\s*$','/gikky_e2e'); $env:CI = "1"; node scripts/py.mjs shell -c "from django.db import connections; n=connections['default'].settings_dict['NAME']; print('DB='+n); import sys; sys.exit(0 if n=='gikky_e2e' else 1)"; if ($LASTEXITCODE -eq 0) { node scripts/py.mjs migrate; pnpm e2e -g tin-nhan } else { 'DUNG LAI: DB SAI' }
  ```
  Dòng `DB=gikky_e2e` phải in ra trước. `CI=1` làm Playwright **báo lỗi thay vì tái dùng**
  server lạ trên :3000/:8000 — đó là hành vi mong muốn. **Không migrate `gikky_dev`** trong
  lượt này (user quyết; dev server trên `gikky_dev` sẽ 500 ở 5 cửa mới cho tới khi
  `pnpm api:migrate`). ⚠ `pnpm build` PHÁ `next dev` đang chạy — kiểm `netstat` trước.

## 7 · Rủi ro

1. **Phiên khác** đang sửa `core/ghi.py` + admin. Lượt này không import gì mới từ `ghi.py` và
   không chạm file của họ. Nếu `pnpm test` đỏ ở bài **không thuộc** lượt này ⇒ ghi rõ tên bài,
   không sửa.
2. `LOAI_HOP_LE` thêm phần tử: `dem_theo_loai` tự có khoá mới — kiểm bài đo nào ghim tập 7
   loại (grep chưa thấy, nhưng chạy toàn bộ `pnpm test` để chắc).
3. Poll 10 s trên trang hội thoại: mỗi tab mở là 6 request/phút — chấp nhận ở v1, dừng khi tab
   ẩn. Ghi vào docstring component.
4. `DISTINCT ON` là Postgres-only — repo đã chốt Postgres 17 (PLAN mục 6), đã dùng
   `GeneratedField`/partial unique, nên không phải cam kết mới.
5. Rác e2e: hai tài khoản `@gikky.test` để lại `HoiThoai`/`TinNhan` trong `gikky_e2e`;
   `don_rac_e2e` không dọn chúng. Vô hại (DB nháp, dữ liệu riêng tư giữa hai tài khoản dùng một
   lần) — ghi sổ, không mở rộng lệnh dọn ở lượt này.

## 8 · Báo cáo thực thi

Chốt 2026-09-03. Đủ 5 chặng: phiên chính viết plan → `opus-dev` thực thi → `nghiem-thu` +
`phan-bien` chạy **song song** → phiên chính vá 11 phát hiện rồi tự đo lại.

### Số đo CUỐI CÙNG — đo ở đâu, và vì sao không đo ở cây chính

Cây chính lúc chạy có **ba lượt song song** (việc này · sửa bài khu quản trị · cuộn vô hạn
feed), và cổng 3000/8000 bị `next dev` + `runserver` của lượt khác chiếm suốt. Nên số dưới
đây đo trên một **worktree tách từ `912a0b9`, chỉ chép vào đúng 33 file của việc này** —
lối mà `D:\Projects\CLAUDE.md` chỉ định cho cây bị nhiễm. Worktree dùng cổng **3010/8010**
và DB nháp **`gikky_e2e`**; đã `git worktree remove` + `prune` sau khi xong, ba DB test tạm
đã `DROP`.

| Lệnh | Kết quả |
|---|---|
| `pytest api` (cây sạch, `--create-db`) | **1897 passed · 26 skipped · 0 failed** (309 s) |
| `pnpm lint` | **0 warning** (cả `web` + `admin`) |
| `pnpm build` (xoá `.next` trước) | **0 lỗi · 0 warning**; `/luat` giữ `○`, `/tin-nhan` + `/tin-nhan/[username]` ra `ƒ` |
| `pnpm e2e:don-vi` | **443 passed** |
| `pnpm e2e -g "tin-nhan"` (CI=1, DB=`gikky_e2e`) | **13 passed** (4 bài trình duyệt T1–T4 + 9 bài hàm thuần) |
| `pnpm codegen` → `codegen:check` | exit 0, *"khớp — 34 file không đổi"* |

⚠ Một bài **đỏ giả** gặp trên đường: `test_csrf_trusted_origins_co_du_hai_cong_dev` đỏ ở
lượt chạy đầu **vì chính cấu hình đo** — tôi ghi đè `CSRF_TRUSTED_ORIGINS` của worktree
bằng cổng 3010. Thêm lại 3000/3001 ⇒ xanh. Không phải lỗi của bản vá.

⚠ Đỏ giả thứ hai, đáng ghi vì nó sẽ lặp lại: chạy `pytest api` ở **cây chính** cho 6 bài đỏ
ở `tests/test_anh_thu_tu_khoa.py`; chạy riêng file ấy thì **9 passed**. Nguyên nhân đo
được: 6 bài đó dùng `inspect.getsource(core.ghi)`, và `api/core/ghi.py` bị lượt khác ghi đè
lúc `17:35:23`, tức **giữa** lượt chạy 5 phút. Bài đo đọc mã nguồn không chịu được cây có
nhiều phiên ghi song song.

### Chặng 3 — `nghiem-thu` chấm gì

**16/18 ĐẠT · 1 ĐẠT MỘT PHẦN · 1 CHƯA TỰ CHẠY · 0 KHÔNG ĐẠT.** Hai mục thiếu là A15
(`pnpm build`) và A17 (e2e trình duyệt) — người nghiệm thu không dựng worktree nên **ghi
thẳng là "chưa tự chạy"** thay vì chép số của thợ. Phiên chính đã tự chạy cả hai (bảng
trên). Nó cũng tự làm lại **cả 7 phép thử phá §5** và cả 7 đều đỏ đúng bài.

Một phát hiện của nó đã sửa ngay vào plan: **§5.2 viết sai cách thử phá** — "sửa model rồi
`--create-db`" cho ra một lượt thử phá **rỗng**, vì DB test dựng từ *migration*, phải sửa cả
`0025_hoithoai_tinnhan.py` mới thấy đỏ.

### Chặng 4 — `phan-bien` tìm ra 11 lỗi, tất cả đã vá

Phiên chính tự đối chiếu từng cái với code trước khi nhận: **cả 11 đều đúng**.

| # | Mức | Lỗi | Vá thế nào |
|---|---|---|---|
| 1 | **NẶNG** | Chấm chưa đọc **kẹt vĩnh viễn** khi người kia bị `is_active=False`: hộp thư vẫn đếm, nhưng `GET` và `POST …/doc` đều 404 nên vạch đọc không bao giờ tiến | `_nap_nguoi_kia(..., de_ghi)` — ghi đòi `is_active`, đọc nạp được người vô hiệu **nếu đã có hội thoại**; chưa có ⇒ vẫn 404 (không rò). 3 bài `test_A19_*` |
| 2 | TB | "Tải tin cũ hơn" bị chính effect cuộn kéo tuột về đáy ⇒ trông như nút chết | So **id phần tử cuối** (`idCuoi` ref) thay vì `items.length` |
| 3 | TB | **Một** lỗi GỬI làm chết vĩnh viễn vòng poll 10 s ⇒ tin của người kia thôi hiện | Tách `loiNap` (chặn poll) ↔ `loiGui` (chỉ hiện chữ) |
| 4 | TB | Poll **bỏ sót tin** khi hơn một trang về giữa hai vòng — và tin bị sót vẫn bị đánh dấu ĐÃ ĐỌC | Hàm thuần `laKhoangTrong(...)`: cả trang đều mới + `con_cu_hon` ⇒ thay danh sách, rồi mới `baoDaDoc` |
| 5 | TB | Username `chua-doc` **nuốt** đường dẫn đếm: `GET` trả sai hình dạng, `POST` trả 405 text/plain (phá hợp đồng `{detail, code}`) | Đổi route sang **`GET /me/tin-nhan-chua-doc`** (gạch nối, ra khỏi không gian username). `operation_id` giữ nguyên ⇒ frontend không đổi. Bài `test_A20_*` |
| 6 | TB | Đua GỬI ↔ POLL vẽ tin **trùng** (trùng cả React `key`) | `noiKhongTrung(dau, sau)` lọc theo `id`, dùng ở cả ba đường nối |
| 7 | TB | Bấm hai lần "Tải tin cũ hơn" chèn 30 tin hai lần | `dangTaiCuHon` + `disabled` + chèn qua `noiKhongTrung` |
| 8 | Nhẹ | `HopThu` nuốt mọi lỗi thành **trang trắng** | Thêm nhánh lỗi `role="alert"`, testid `hop-thu-loi` |
| 9 | Nhẹ | `no-store` **không** lên response lỗi, mà docstring + plan hứa là có | Sửa **LỜI** (docstring + §4-A13), không sửa code — nguyên nhân nằm ở handler lỗi dùng chung của cả `api_v1`, ghi sổ `P-20260903-15` |
| 10 | Nhẹ | Câu lỗi 400 ở client gán cứng "không thể nhắn cho chính mình" cho **mọi** ca `du_lieu_khong_hop_le` | Nhánh 400 dùng `e.message` của server |
| 11 | Nhẹ | Thứ tự import ở `api/v1.py` | Đổi chỗ hai dòng |

Bốn bài đo Python mới (A19 ×3, A20) + chín bài hàm thuần
(`e2e/don-vi/tin-nhan-hop.spec.ts`) phủ các mục trên; tổng **16 phép thử phá** của cả việc,
tất cả đã khôi phục bằng sửa ngược (không `git checkout`, vì index git đang giữ snapshot cũ
— `P-20260830-5`).

`phan-bien` cũng **đồng ý với thợ** ở điểm lệch khỏi plan: gửi tin *không* dời vạch đọc của
người gửi. Xem khối ⚠ ở §2.2 — bản đầu của plan tự mâu thuẫn với chính A6 và §5.1 của nó.

### Còn gì CHƯA xong

- **Chưa commit.** Cây chính đang có ba lượt song song và index git giữ snapshot cũ; commit
  phải `git add` chọn lọc đúng 33 file của việc này.
- **Chưa migrate `gikky_dev`.** Dev server đang chạy trên DB ấy sẽ trả 500 ở năm cửa mới cho
  tới khi ai đó chạy `pnpm api:migrate`. Cố ý: `gikky_dev` chứa bài viết thật, và migrate nó
  là quyết định của user.
- **Chưa deploy.** Trên prod, `0025` là hai `CREATE TABLE` thuần additive, không khoá bảng cũ.
- Chín mục ghi sổ ở `LOI-VA-NO.md` (`P-20260903-14` … `-22`), trong đó **hai mục cần user
  quyết**: chặn người (`-17`) và cửa kiểm duyệt tin nhắn cho mod (`-18`).
