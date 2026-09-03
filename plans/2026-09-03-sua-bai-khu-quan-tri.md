# Sửa bài trong khu quản trị — tiêu đề mạch + đủ 5 trường của MỌI mốc, luôn để vết

Chốt 2026-09-03. User: *"làm thêm phần sửa cho post, sửa tất cả các mốc của bài viết, vì
mới bắt đầu chạy site nên phải sử dụng AI để viết nhiều, mà có những bài tôi cần phải sửa,
nhưng không có chỗ sửa. lưu audit phần sửa"*.

Được hỏi "chỗ sửa ở đâu" (vì `/api/v1/mod/*` cố ý chỉ mở ĐÚNG 4 cửa và `api/api/mod.py`
ghi *"mở thêm bất kỳ cái nào là phải hỏi lại user"*), user chốt: **trong khu quản trị
`admin.gikky.net`** — không mở thêm cửa nào trên v1.

## Bối cảnh đã kiểm (không phải phỏng đoán)

- Bài AI đăng bằng `u/gikky-team-member` qua `POST /machs` (`scripts/bai-viet/dang-bai.py`).
  `PATCH /mocs/{id}` chỉ cho `Moc.author` (`api/quyen.py::doi_chu_so_huu` cố ý không có
  nhánh staff). **Không cửa nào sửa được `Mach.title`**, cho bất kỳ ai.
- Mọi hàng `Moc` đang là `body_dinh_dang = html` (đếm `gikky_dev`: 18/18; cả ba đường ghi
  `them_moc`/`tao_mach`/`sua_moc` đều đặt `html` sau `lam_sach`). ⇒ Editor bên admin phải
  là **TipTap cùng bộ extension** với `apps/web/components/soan-thao.tsx`, không phải
  textarea.
- Vết đã có sẵn trong data model: `MocRevision` (đủ 5 trường bản trước), `Moc.edited_at`
  / `edit_count`, `AuditLog` + `core/ghi.py::ghi_audit`. **Không cần migration.**
- Khu quản trị đã có `useQuanTri().mod.is_superuser` để giấu nút superuser-only, và
  `quan_tri_nguoi_dung.py::_chan_neu_khong_phai_superuser` ở phía server.
- `core/revalidate.py::lam_moi_mach` **chỉ làm mới trang mạch theo slug HIỆN TẠI** của
  object được truyền vào; feed sống bằng revalidate nền 1 giờ.

---

## 0 · Cái KHÔNG làm

- **Không đụng `/api/v1/*`.** `PATCH /mocs/{id}` vẫn chỉ tác giả; `mod.py` vẫn 4 cửa —
  `tests/test_api_mod.py::test_be_mat_mod_tren_v1_dung_BON_cua` phải xanh mà không sửa.
- ~~Không sửa ảnh~~ **LẬT 2026-09-03** — user: *"vì front sử dụng tiptap để post bài, nên
  admin cũng cần tiptap để sửa, cho phép upload media như front"*. ⇒ Ảnh làm **y như form
  sửa của front**: chèn ảnh vào thân (`soan-thao.tsx` → `POST /me/anh`) **và** ảnh đính
  kèm (`chon-anh.tsx` → `POST /mocs/{id}/anh` · `DELETE /anh/{id}`). Xem §1.6, §2.6, §3.
  Chỉ ảnh JPEG/PNG/WebP, **không video** — cùng chốt với `POST /me/anh`.
- Không sửa `created_at`, `seq`, `author`, `sub`, `status`, `locked_at`; không sửa bình luận.
- **Không cho tác giả sửa tiêu đề.** Chưa có cơ chế để vết cho `title` (không có
  `MachRevision`); mở cho tác giả mà im lặng là cho sửa lùi một lời gọi đã đăng. Ghi sổ.
- Không migration. Không đổi `THE_CHO_PHEP` của `lam_sach`.

## 1 · Năm quyết định thiết kế (kèm lý do — để không bị "hoàn thiện nốt")

1. **Hai cửa GHI chỉ superuser.** Mod thường nhận 403 `khong_du_quyen`. Sửa lời người
   khác là quyền biên tập, mạnh hơn ẩn (ẩn = gỡ, sửa = viết lại). Cùng nấc với cấp/thu
   quyền mod. Cửa ĐỌC (`GET /admin/mocs/{id}`) thì mọi mod, như trang chi tiết.
   Muốn nới về mọi mod là đổi MỘT dòng — nhưng phải là quyết định, không phải tiện tay.
2. **Mod sửa thì LUÔN để vết**, bất kể mốc mấy phút tuổi: tạo `MocRevision` bản trước,
   đặt `edited_at`, tăng `edit_count`, và ghi `AuditLog` **trong cùng transaction**.
   Cửa sổ im lặng 15 phút (PLAN nguyên tắc 2) là dành cho tác giả sửa chính tả bài
   mình; người thứ ba sửa lời người khác không có lý do gì để im lặng. Nhờ đó "lưu audit"
   có hai lớp: **ai, lúc nào, lý do** ở `AuditLog`; **nội dung trước** ở `MocRevision`
   (công khai, bấm được ở nhãn "đã sửa N lần" trên trang mạch).
3. **Không đổi gì ⇒ không vết.** Server tự so từng trường với hàng hiện tại (body so
   SAU `lam_sach`, figures so cấu trúc) và bỏ trường không đổi; còn rỗng ⇒ `da_doi=false`,
   không revision, không log. Đây là luật 3 của khối audit trong `core/ghi.py` ("không
   đổi thì không ghi log"), và khác đường tác giả (đường ấy tin client lọc — xem
   `hanh-dong-moc.tsx::chiPhanDoi`).
4. **Đổi tiêu đề = đổi slug** (`slug_tu_title`), URL cũ 308 theo PLAN 5.9 (trang đọc
   theo `id`). ⚠ Cache ISR: phải xếp hàng làm mới **CẢ đường cũ lẫn đường mới** —
   `lam_moi_mach` đọc slug lúc gọi, nên gọi một lần TRƯỚC khi đổi (đường cũ) và một lần
   SAU (đường mới), cả hai trong transaction. Thiếu vế cũ thì `/m/<slug-cũ>-<id>` phục
   vụ tiêu đề cũ tới một giờ, HTTP 200, không log. Reindex Meilisearch qua `dong_bo_mach`.
5. **Mạch khoá ⇒ 403 `mach_bi_khoa` ở cả hai cửa** (khoá = đóng băng, mở khoá trước —
   nút mở khoá nằm ngay trang chi tiết). **Mốc bia mộ / bị ẩn ⇒ 409 `noi_dung_da_go`**
   (gỡ ẩn trước). **Mạch bị ẩn thì VẪN sửa được** (khu này với được nội dung ẩn, đúng
   lý lẽ của `quan_tri_kiem_duyet.py`).

6. **Ảnh: y như front, đi đúng đường ghi của v1** (user chốt 2026-09-03). Cùng bảy phép
   kiểm (`core/anh.py`), cùng kho (`core/anh_luu.py`), cùng hàng whitelist cho lệnh dọn
   (`AnhNoiDung`, `MocAnh`). Khác v1 đúng HAI chỗ, cả hai ghi ở docstring: (a) **không
   hạn mức 30 ảnh/ngày** cho ảnh nội dung — hạn mức ấy tồn tại để mọi tài khoản đăng
   nhập không biến cửa thành kho file miễn phí, còn cửa này superuser-only; (b) **ảnh
   đính kèm thêm/gỡ bởi mod thì ghi `AuditLog`** (đó là thay đổi nội dung của người
   khác). Tải ảnh nội dung thì **không** log: tấm ảnh chưa đổi bài nào; lượt PATCH
   `body` nhúng nó mới là thay đổi, và lượt ấy đã có revision + log.

`body` đi qua `lam_sach` như mọi đường ghi — **dùng lại lõi của `sua_moc`**, không viết
đường ghi thứ tư (docstring `them_moc`: "ba đường ghi, hai lời gọi, không có đường thứ tư").

## 2 · Backend

### 2.1 · `api/core/ghi.py`

- Hằng: `AUDIT_SUA_MOC = "sua_moc"`, `AUDIT_SUA_TIEU_DE_MACH = "sua_tieu_de_mach"`,
  `AUDIT_THEM_ANH_MOC = "them_anh_moc"`, `AUDIT_XOA_ANH_MOC = "xoa_anh_moc"` — đặt cạnh
  khối `AUDIT_*`, kèm một dòng chú thích "sửa NỘI DUNG, không phải ẩn".
- `them_anh_moc(*, moc, anh, boi=None, ly_do="")` / `xoa_anh_moc(*, anh, boi=None,
  ly_do="")`: khi có `boi` thì `ghi_audit(action=AUDIT_THEM_ANH_MOC | AUDIT_XOA_ANH_MOC,
  target_type=DICH_MOC, target_id=moc.pk, mach_id, seq, anh_id, url, ly_do)` **bên trong
  `atomic()` sẵn có của chúng** — để hàng + file + log cùng số phận, và để lưới "ném thì
  xoá file vừa ghi" của `them_anh_moc` phủ cả bước log. Đường tác giả (v1) gọi không có
  `boi` ⇒ **không đổi hành vi**, có bài đo ghim (B14: v1 upload ⇒ 0 log).
- Tách lõi `sua_moc` thành `_ap_sua_moc(moc, thay_doi, khi, *, de_dau: bool)
  -> tuple[Moc, MocRevision | None]`. `sua_moc(*, moc, thay_doi, khi=None)` giữ **nguyên
  chữ ký và hành vi** (de_dau = không còn im lặng) — hai bài đo
  `test_api_ghi_moc.py::test_sua_trong_15_phut_KHONG_de_lai_vet` /
  `..._sau_15_phut_tao_revision_du_CA_5_TRUONG` không được sửa.
- Mới: `sua_moc_boi_mod(*, moc, thay_doi, boi, ly_do="", khi=None) -> tuple[Moc, bool]`:
  1. validate như `sua_moc` (khoá lạ ⇒ `ValidationError`, `lam_sach` body, `kiem_figures`);
  2. **lọc trường không đổi** (so với hàng hiện tại, sau khi chuẩn hoá); rỗng ⇒
     `(moc, False)`, không chạm DB;
  3. `_ap_sua_moc(..., de_dau=True)` + `ghi_audit(actor=boi, action=AUDIT_SUA_MOC,
     target_type=DICH_MOC, target_id=moc.pk, mach_id=…, seq=…, tac_gia=<username>,
     truong=sorted(thay_doi), revision_id=rev.pk, ly_do=ly_do)` — **cùng `atomic()`**
     với `save()` (luật 1 khối audit).
- Mới: `sua_tieu_de_mach(*, mach, title, boi, ly_do="") -> tuple[Mach, bool, str]`
  (trả thêm `slug_cu`): `title.strip()`; `select_for_update` hàng `Mach` (Mach là khoá
  CUỐI của mọi chuỗi; hàm này không khoá gì trước nó ⇒ không chu trình); bằng tiêu đề
  hiện tại ⇒ `(mach, False, slug)`; khác ⇒ đặt `title`, `slug = slug_tu_title(title)`,
  `save(update_fields=[...])`, `dong_bo_mach(mach)`, `ghi_audit(action=AUDIT_SUA_TIEU_DE_MACH,
  target_type=DICH_MACH, target_id, tieu_de_cu, tieu_de_moi, slug_cu, slug_moi, ly_do)`.
  Làm mới ISR là việc của handler (giữ đúng phân công hiện tại: `core/ghi.py` không
  import `revalidate`).

### 2.2 · `api/core/revalidate.py`

`lam_moi_mach(mach)` giữ nguyên. Handler đổi tiêu đề gọi nó **hai lần**: trước khi ghi
(slug cũ) và sau khi ghi (slug mới). Nếu cần một hàm nhận thẳng `slug_cu` thì thêm
`lam_moi_mach_slug(mach_id, slug)` công khai — nhưng **đừng** viết lại luật
`/m/<slug>-<id>` lần thứ tư: đi qua `core/digest.py::duong_dan_mach` hoặc tương đương.

### 2.3 · `api/api/quan_tri_schemas.py`

- `MocQuanTriOut` += `edit_count: int` và `sua_duoc: bool` — **tính ở server**
  (`doc_duoc(moc) and mach.locked_at is None`, dùng `core/doc_noi_dung.py::doc_duoc`,
  không chép luật che). PLAN nguyên tắc 10: frontend không dựng lại điều kiện ba cột.
  `sua_duoc` nói về TRẠNG THÁI NỘI DUNG, không nói về quyền của người xem (quyền lấy từ
  `mod.is_superuser` đã có trong `useQuanTri`).
- `MocSuaQuanTriOut`: `id, seq, mach_id, mach_title, mach_da_khoa, tac_gia
  (NguoiDungTomTatOut), occurred_at, created_at, loai, body, body_dinh_dang,
  question_for_crowd, figures: list[FigureOut] | None, edit_count, edited_at, da_bi_an,
  da_xoa, sua_duoc, duong_dan_cong_khai, anhs: list[AnhOut], tran_anh_moi_moc: int`.
  `body` **không che** (mod phải đọc được bản đang ẩn để sửa rồi gỡ ẩn). `anhs` qua
  `api/trinh_bay.py::anh_ra`, **liệt kê đủ cả ảnh đang cách ly** vì mốc/mạch bị ẩn — mod
  cần thấy để gỡ. ⚠ **Sửa lại cho khớp code (2026-09-03, sau phản biện):** `anh_ra` dựng
  URL từ `kho_hien()` **cho mọi hàng**, kể cả hàng `da_cach_ly=True` — file lúc ấy nằm ở
  kho cách ly, nên thumbnail của những ảnh đó **404 trong trang sửa**. Danh sách vẫn đủ
  (nút Gỡ hoạt động, đó là thứ mod cần); chỉ ảnh xem trước là hỏng. Câu cũ ở đây hứa
  mạnh hơn thứ code làm. Trả nợ = một cửa URL thứ hai cho kho cách ly, và đó là quyết
  định riêng — ghi sổ, không làm ở lượt này.
  `tran_anh_moi_moc = SO_ANH_TOI_DA_MOI_MOC` — PLAN nguyên tắc 10, không gõ cứng
  `10` ở frontend.
- `SuaMocQuanTriIn(MocSuaIn)` += `ly_do: str = ""` (PATCH thật qua `model_fields_set`;
  `ly_do` **không** nằm trong `thay_doi`). Import `MocSuaIn` từ `api.schemas_ghi` — một
  hợp đồng 5 trường, không chép lần thứ hai.
- `SuaTieuDeMachIn`: `title: str = Field(min_length=1, max_length=DAI_TITLE)`,
  `ly_do: str = ""`. Tiêu đề toàn khoảng trắng qua được `min_length` ⇒ handler trả 400
  `du_lieu_khong_hop_le`.
- `KetQuaSuaMocOut {da_doi: bool, moc: MocSuaQuanTriOut}` ·
  `KetQuaSuaTieuDeOut {da_doi: bool, title: str, slug: str, duong_dan_cong_khai: str}`.

### 2.4 · `api/api/quan_tri_sua_bai.py` (MỚI) — mount vào `api/api/quan_tri.py`

| Cửa | `operation_id` | Ai | Từ chối |
|---|---|---|---|
| `GET /mocs/{moc_id}` | `quan_tri_xem_moc` | mọi mod | 404 id lạ. Ẩn / bia mộ **vẫn trả** |
| `PATCH /mocs/{moc_id}` | `quan_tri_sua_moc` | superuser | 403 `khong_du_quyen` · 404 · 409 `noi_dung_da_go` (bia mộ, bị ẩn) · 403 `mach_bi_khoa` · 400 `du_lieu_khong_hop_le` (`{}`, `occurred_at` tương lai giờ VN, >6 figures, body chỉ còn thẻ bị chặn) |
| `PATCH /machs/{mach_id}` | `quan_tri_sua_tieu_de_mach` | superuser | 403 · 404 · 403 `mach_bi_khoa` · 400 tiêu đề trắng |

- Mã lỗi dùng lại: `NOI_DUNG_DA_GO`, `MACH_BI_KHOA`, `DU_LIEU_KHONG_HOP_LE` (`api.quyen`),
  `KHONG_DU_QUYEN` (`api.loi`). Trả bằng `loi(...)`/`khong_tim_thay(...)` như các file
  `quan_tri_*` khác. `kiem_occurred_at` (`api/ghi_chung.py`) ném `LoiGhi` — **kiểm rằng
  `api_admin` đưa nó ra đúng `{detail, code}`** (`quan_tri.py::_xu_ly_http_error`); nếu
  không, bắt và trả `loi(400, ...)` tại chỗ. Có bài đo đọc trường `code`.
- Phép chặn superuser: **dùng chung** với `quan_tri_nguoi_dung.py` — tách
  `_chan_neu_khong_phai_superuser` ra một chỗ dùng chung (nhận `viec: str` để câu lỗi
  nói đúng việc), không chép. Sửa `quan_tri_nguoi_dung.py` để import lại từ đó.
- Handler làm đúng ba việc (docstring `quan_tri_kiem_duyet.py`): tra hàng, gọi đường
  ghi, dựng response; sau ghi gọi `lam_moi_mach` (mốc: một lần; tiêu đề: hai lần, §1.4).
- Mọi endpoint khai `response` đủ `401`/`403` (+`404`, `409`, `400` khi có), `tags`,
  `operation_id` tiền tố `quan_tri_` — `tests/test_api_quan_tri_hop_dong.py` là chuông.

### 2.5 · Codegen

`pnpm codegen` ⇒ `packages/api-client/src-admin` có `quanTriXemMoc`, `quanTriSuaMoc`,
`quanTriSuaTieuDeMach`, `quanTriTaiAnhNoiDung`, `quanTriTaiAnhMoc`, `quanTriXoaAnhMoc`;
`openapi.admin.json` đổi. `pnpm codegen:check` exit 0. Multipart sinh ra `body: { file }`
như `taiAnhMoc` của v1.

### 2.6 · Ảnh — ba cửa admin, dùng lại đúng đường ghi của v1 (§1.6)

Đặt trong cùng `quan_tri_sua_bai.py` (hoặc `quan_tri_anh.py` nếu file dài quá). Hai
helper `_doi_khong_qua_nang` / `_xu_ly_hoac_loi_http` của `api/anh.py` **tách ra chỗ dùng
chung** rồi import ở cả hai nơi — không chép.

| Cửa | `operation_id` | Ai | Hành vi |
|---|---|---|---|
| `POST /anh` (multipart `file`) | `quan_tri_tai_anh_noi_dung` | superuser | 7 phép kiểm → `core/anh_noi_dung.py::luu_anh_noi_dung(user=request.user, anh=…)`; 201 `AnhNoiDungOut {url, width, height}`; `Cache-Control: no-store`; 413 `anh_qua_nang`, 400 `anh_hong` / `dinh_dang_khong_nhan`. **Không hạn mức ngày** (§1.6a). `nguoi_tai` = superuser ⇒ hàng vẫn là whitelist cho `don_anh_mo_coi`. Không log |
| `POST /mocs/{moc_id}/anh` (multipart) | `quan_tri_tai_anh_moc` | superuser | 404 · 403 `mach_bi_khoa` · 409 `noi_dung_da_go` (bia mộ, bị ẩn) · 409 `qua_nhieu_anh` · 413/400 như v1; **mạch bị ẩn ⇒ vẫn được**; gọi `them_anh_moc(moc, anh, boi=request.user, ly_do=…)`; 201 `AnhOut`; `lam_moi_mach` |
| `DELETE /anh/{anh_id}` | `quan_tri_xoa_anh_moc` | superuser | 404 · 403 `mach_bi_khoa`; **không lọc `moc__mach__hidden_at`** (khác v1 — khu này với được mạch ẩn); không `doi_con_song` (cùng lý lẽ v1: gỡ ảnh khỏi bia mộ là giải phóng đĩa); gọi `xoa_anh_moc(anh, boi=…, ly_do=…)`; 200 `AnhOut` vừa xoá; `lam_moi_mach` |

`ly_do` cho hai cửa đính kèm đi bằng **query/form tuỳ chọn** (multipart không có body
JSON) — hoặc bỏ hẳn `ly_do` ở ảnh nếu làm hình dạng request rối; ghi rõ lựa chọn ở §7.

## 3 · Frontend `apps/admin`

- Dependency: `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/extension-link`,
  `@tiptap/extension-image`, `@tiptap/pm` — **cùng dải `^3.30.3`** như `apps/web`
  (`pnpm install`, `pnpm-lock.yaml` đổi). Không thêm `lucide-react`: nút toolbar dùng
  `components/icon.tsx` sẵn có hoặc chữ ("B", "I", "H2"…).
- `components/soan-thao-quan-tri.tsx`: TipTap, `immediatelyRender: false` (bắt buộc —
  hydration), extension **y hệt** `apps/web/components/soan-thao.tsx`: `StarterKit`
  tắt `horizontalRule`/`codeBlock`/`link`, `heading levels [2,3]`; `Image
  {allowBase64:false, inline:false}`; `Link {openOnClick:false, autolink:true, protocols
  [http,https,mailto]}`. Toolbar: đậm · nghiêng · gạch · mã · H2 · H3 · danh sách ·
  đánh số · trích · link · **chèn ảnh**. `onUpdate`: `isEmpty ? "" : getHTML()`. Ghi chú
  đầu file: thanh công cụ là **tập con allowlist** của `core/lam_sach_html.py`, sửa
  allowlist thì sửa cả ba chỗ.
  - **Chèn ảnh y như web** (`soan-thao.tsx::chenAnh`): nút + kéo-thả + dán đi chung MỘT
    hàm; gọi `quanTriTaiAnhNoiDung({ baseUrl: GOC_API, headers: headerGhi(), body: { file } })`
    (header của admin chỉ có `X-CSRFToken`, không ép `Content-Type` ⇒ multipart đi được)
    rồi `setImage({ src: url, alt })`. `src` **luôn là `/media/…` tương đối** — không
    `data:`, không origin tuyệt đối: `lam_sach` gỡ cả thẻ `img` có `src` ngoài kho. Từ chối
    file không phải ảnh trước khi gọi mạng; câu lỗi nói cả hai khả năng (quá nặng / định
    dạng).
  - `apps/admin/next.config.ts`: thêm rewrite **`/media/:path*` → `API_ORIGIN`** cho DEV,
    chép đúng lý do từ `apps/web/next.config.ts` (thiếu nó thì upload 201, DB đúng, editor
    hiện ảnh vỡ — chỉ trình duyệt thấy). Prod không cần: Caddy đã phục vụ `/media/*` trên
    `admin.gikky.net` (`deploy/prod/Caddyfile`, khối `handle_path /media/*`).
- Style: Tailwind utilities + **một khối trong `app/globals.css`** cho nội dung vùng soạn
  (`p ul ol li blockquote h2 h3 code a img` bên trong `.soan-thao-quan-tri`), **chỉ token**
  (`var(--color-…)`), không hex, không `bg-[#…]` — hàng rào
  `e2e/don-vi/quan-tri-giao-dien.spec.ts` (⚠ **sửa 2026-09-03**: plan bản đầu còn nhắc một file `mau-quan-tri.spec.ts` — file ấy KHÔNG tồn tại; các bài đo MÀU nằm trong chính `quan-tri-giao-dien.spec.ts`).
- Trang MỚI `app/m/[machId]/moc/[mocId]/page.tsx` ("Sửa mốc N — <tiêu đề mạch>"):
  - nạp `quanTriXemMoc` (`cache: "no-store"`), `useTieuDeTrang`;
  - form 5 trường: ngày sự việc `type=date` với `max` = hôm nay **giờ VN** (viết
    `lib/thoi-gian.ts` nhỏ dùng `Intl.DateTimeFormat("en-CA", {timeZone:
    "Asia/Ho_Chi_Minh"})` — không chép `homNayVN` của web, khác app), `loai` ≤20,
    `question_for_crowd` ≤200, `figures` ≤6 cặp × 24 ký tự (ba con số này là BẢN SAO của
    `core/models/moc.py`, ghi chú rõ), thân = editor; thêm ô `ly_do` (tuỳ chọn, "ghi vào
    nhật ký"); nút **Lưu** / **Huỷ** (về `/m/{machId}`);
  - **chỉ gửi trường THẬT SỰ đổi** (so như `hanh-dong-moc.tsx::chiPhanDoi`; figures so
    JSON); không đổi gì ⇒ không gọi API, hiện "Không có gì đổi";
  - `sua_duoc === false` ⇒ form khoá + câu giải thích đúng ca (tác giả đã xoá / đang bị
    ẩn — gỡ ẩn ở trang bài / mạch bị khoá — mở khoá ở trang bài); không phải superuser ⇒
    chỉ đọc + câu "Chỉ superuser sửa được nội dung" (PLAN mục 4: không nút chết);
  - câu nhắc TRƯỚC khi lưu (như web): *"Mỗi lần lưu giữ bản hiện tại làm bản cũ xem
    được công khai, mốc mang dấu «đã sửa», và hành động ghi vào nhật ký quản trị."*;
  - **Ảnh đính kèm dưới editor, y như `chon-anh.tsx` của web**: lưới **Ảnh đã lưu**
    (thumbnail từ `anhs[].url_thumb`, nút Gỡ → `quanTriXoaAnhMoc`, hỏi xác nhận vì gỡ là
    mất hẳn, gỡ xong nạp lại từ server) và ô **chọn ảnh mới** (`accept` JPEG/PNG/WebP —
    chỉ là gợi ý hộp thoại, 7 phép kiểm ở server; trần còn lại = `tran_anh_moi_moc −
    anhs.length`, xem trước bằng `URL.createObjectURL` + revoke). Ảnh mới **gửi SAU phần
    chữ, tuần tự từng tấm** (`quanTriTaiAnhMoc`), một tấm hỏng không cuốn theo phần chữ đã
    lưu — câu lỗi nói đúng chuyện đó ("Đã lưu, nhưng <tên file>: …"). Không đổi chữ mà có
    ảnh mới vẫn là một thay đổi thật ⇒ vẫn gửi ảnh.
  - lỗi qua `useHanhDong`; thành công ⇒ `router.push("/m/{machId}")`.
- Trang chi tiết `app/m/[machId]/page.tsx`:
  - nút **Sửa tiêu đề** (chỉ `mod.is_superuser`, ẩn khi `da_khoa`) mở ô nhập inline
    prefill + `ly_do` tuỳ chọn → `quanTriSuaTieuDeMach` qua `chay(...)`; sau khi lưu,
    "Mở trang công khai ↗" trỏ `duong_dan_cong_khai` mới (nạp lại từ server);
  - bảng mốc: link **Sửa** → `/m/{machId}/moc/{mocId}` khi `sua_duoc && mod.is_superuser`
    (không hiện nút xám); nhãn `đã sửa N lần` khi `edit_count > 0`;
  - dòng mô tả dưới bảng nói rõ: sửa ở đây để vết công khai + nhật ký.
- `app/nhat-ky/page.tsx`: `GOI_Y_ACTION` += `sua_moc`, `sua_tieu_de_mach`,
  `them_anh_moc`, `xoa_anh_moc`; sửa chú thích "22 hằng" cho đúng số.
- Hàng rào tĩnh phải xanh: `type-admin.spec.ts` (mỗi lời gọi API kèm `baseUrl`, không
  alias hàm API) và `quan-tri-giao-dien.spec.ts` (gồm cả nhóm bài đo MÀU).

## 4 · Bài đo bắt buộc

Nền: **1886 collected** trên `912a0b9`. File mới `api/tests/test_api_quan_tri_sua_bai.py`
(HTTP, fixture từ `tests/_quan_tri.py`) và `api/tests/test_ghi_sua_bai.py` (đường ghi).

| # | Đo gì |
|---|---|
| B1 | Superuser PATCH `body` mốc **2 phút tuổi** ⇒ 200 `da_doi=true`; DB có body mới (sạch); **đúng 1** `MocRevision` mang đủ 5 trường cũ (kể cả `occurred_at`); `edit_count=1`, `edited_at` khác `null`; **đúng 1** `AuditLog` `action="sua_moc"`, đúng `actor`, `target_type="moc"`, `target_id`, `meta` có `truong=["body"]`, `revision_id` = id bản cũ, `mach_id`, `seq`, `ly_do` |
| B2 | Mod thường (không superuser) ⇒ 403 `khong_du_quyen` ở CẢ HAI cửa ghi; DB không đổi; 0 `AuditLog`. `GET /admin/mocs/{id}` thì mod thường vẫn 200 |
| B3 | Gửi y nguyên nội dung hiện tại (cả 5 trường, body qua đúng chuỗi đã lưu) ⇒ 200 `da_doi=false`; 0 revision; 0 log; `edit_count` không đổi |
| B4 | PATCH mốc: bia mộ ⇒ 409 `noi_dung_da_go`; mốc bị mod ẩn ⇒ 409; mạch khoá ⇒ 403 `mach_bi_khoa`; id lạ ⇒ 404. PATCH tiêu đề: mạch khoá ⇒ 403; id lạ ⇒ 404. **Mạch bị ẩn ⇒ 200** (khu này với được) |
| B5 | `{}` ⇒ 400 `du_lieu_khong_hop_le`; `occurred_at` = ngày mai giờ VN ⇒ 400 (đọc trường `code`); 7 figures ⇒ 400; body `"<script>x</script>"` ⇒ 400; body `"<p>a</p><script>x</script>"` ⇒ 200 và DB không còn `<script>` |
| B6 | Sau B1, cửa công khai `GET /api/v1/machs/{id}` thấy body mới + `edit_count=1`; `GET /api/v1/mocs/{id}/revisions` có đúng body cũ |
| B7 | PATCH tiêu đề: `title` và `slug == slug_tu_title(moi)` đổi; `AuditLog` `sua_tieu_de_mach` meta đủ `tieu_de_cu/tieu_de_moi/slug_cu/slug_moi`; y nguyên (kể cả chỉ thêm khoảng trắng hai đầu) ⇒ `da_doi=false`, 0 log; `"   "` ⇒ 400; `GET /api/v1/machs/{id}` trả slug mới |
| B8 | Làm mới ISR khi đổi tiêu đề: monkeypatch điểm xếp hàng của `core/revalidate.py` ⇒ nhận **đúng hai** đường dẫn (`/m/<slug-cũ>-<id>` và `/m/<slug-mới>-<id>`); không đổi ⇒ **0** |
| B9 | Reindex: monkeypatch `dong_bo_mach` ⇒ được gọi khi đổi tiêu đề và khi sửa mốc; không đổi ⇒ không gọi |
| B10 | `GET /admin/mocs/{id}`: đủ trường; `sua_duoc` đúng bốn ca (thường=true · bị ẩn=false · bia mộ=false · mạch khoá=false); mốc bị ẩn vẫn trả `body`; 404 id lạ |
| B11 | `PATCH /api/v1/mocs/{id}` bởi superuser **không phải chủ** vẫn 403 `khong_phai_chu` — ghim rằng lượt này không nới v1 |
| B12 | Toàn bộ `tests/test_api_mod.py`, `test_api_ghi_moc.py`, `test_api_anh.py`, `test_api_anh_noi_dung.py`, `test_api_quan_tri_hop_dong.py`, `test_api_registry.py` xanh **không sửa** |
| B13 | `POST /admin/anh` (dùng `tests/_anh.py` + fixture `kho_anh`): superuser ⇒ 201, `url` bắt đầu `/media/`, file chính + thumb có trên đĩa, `AnhNoiDung.nguoi_tai` = superuser, `url` sống sót qua `lam_sach`; mod thường ⇒ 403 và **0 byte** mới trên đĩa; `PHP_GIA_JPG` ⇒ 400 (đi qua đúng 7 phép kiểm); `SVG_GIA_JPG` ⇒ 400; vượt trần ngày (override `HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY=1`, tải 2 tấm) ⇒ **cả hai 201**; `Cache-Control: no-store` |
| B14 | Đính kèm qua admin: `POST /admin/mocs/{id}/anh` ⇒ 201 `AnhOut`, `GET /api/v1/machs/{id}` thấy trong `anhs`; **đúng 1** `AuditLog` `them_anh_moc` (actor, `target_type="moc"`, meta `anh_id`); tấm thứ 11 ⇒ 409 `qua_nhieu_anh`; mạch khoá ⇒ 403; bia mộ ⇒ 409; mạch bị ẩn ⇒ 201; mod thường ⇒ 403 + 0 file. `DELETE /admin/anh/{id}` ⇒ 200 `AnhOut`, file rời đĩa (A8), **đúng 1** log `xoa_anh_moc`; 404 id lạ; ảnh của mốc trong mạch ĐANG ẨN vẫn xoá được. **v1 `POST /mocs/{id}/anh` của tác giả ⇒ 0 `AuditLog`** (hành vi cũ giữ nguyên) |
| B15 | `GET /admin/mocs/{id}`: `anhs` đúng `url`/`url_thumb`/`w`/`h`; `tran_anh_moi_moc == SO_ANH_TOI_DA_MOI_MOC`; mốc bị ẩn (ảnh đang cách ly) vẫn liệt kê đủ ảnh |

**Thử phá (luật 4, bắt buộc, ghi vào §7):** (a) bỏ `ghi_audit` trong `sua_moc_boi_mod` ⇒
B1 đỏ; (b) đổi `de_dau=True` thành luật 15 phút ⇒ B1 đỏ; (c) bỏ bước lọc trường không đổi
⇒ B3 đỏ; (d) bỏ lời gọi làm mới đường cũ ⇒ B8 đỏ; (e) bỏ phép chặn superuser ⇒ B2 đỏ;
(f) bỏ `ghi_audit` trong `them_anh_moc` khi có `boi` ⇒ B14 đỏ; (g) bỏ phép chặn superuser
ở `POST /admin/anh` ⇒ B13 đỏ. Mỗi ca: sửa hỏng → chạy đúng bài → thấy ĐỎ → khôi phục →
xanh. Ghi output rút gọn.

## 5 · Tiêu chí nghiệm thu (ĐO ĐƯỢC)

1. `pnpm test` (cây làm việc chính, `912a0b9` + bản vá): **1886 + số bài mới**, `0 failed`,
   0 warning (`filterwarnings = error`). Ghi rõ con số.
2. `pnpm codegen:check` exit 0; `packages/api-client/src-admin/sdk.gen.ts` có ba hàm mới.
3. `pnpm lint` 0 warning (cả hai app). `pnpm build` exit 0, **0 warning** — kiểm cổng
   3000/3001/8000 TRỐNG trước khi build (build phá `next dev` đang chạy).
4. `pnpm e2e:don-vi` xanh toàn bộ (không dùng `--`).
5. Bài đo B1–B15 có mặt, xanh; 7 lượt thử phá đỏ đúng bài rồi xanh lại.
6. Trình duyệt thật, đo bằng script Playwright dùng-một-lần (§6.3): đăng nhập superuser
   → `/m/<id>` → Sửa mốc 1 → đổi chữ **và chèn một ảnh qua nút toolbar** (`setInputFiles`
   vào input ẩn; ảnh mẫu sinh bằng Pillow hoặc lấy từ `tests/_anh.py::anh_byte`) → Lưu →
   trang chi tiết hiện nhãn `đã sửa 1 lần`; `GET /api/v1/machs/<id>` (cửa công khai) trả
   body mới có `<img src="/media/` + `edit_count=1`, và **fetch chính `src` đó qua cổng
   3001 trả 200 ảnh** (rewrite `/media` ở dev); thêm một ảnh đính kèm → `anhs` có 1 phần
   tử; gỡ nó → `anhs` rỗng; đổi tiêu đề → link "Mở trang công khai" mang slug mới;
   `/nhat-ky?action=sua_moc` và `?action=them_anh_moc` mỗi cái có dòng vừa ghi.
7. Không đụng 7 file đang `M` của phiên khác (§6.1). Không commit.
8. `PLAN.md` mục 7 + `LOI-VA-NO.md`: **phiên chính** cập nhật ở chặng 5, không phải
   `opus-dev`.

## 6 · Ràng buộc tài nguyên & cây làm việc

### 6.1 · Cây đang có phiên khác

HEAD `912a0b9`. `git diff HEAD --stat` (worktree ↔ HEAD, **bỏ qua index** — index chung
đang stale, hiện `MM`/`AD` giả ở ~85 file) chỉ ra **7 file** của phiên khác:
`apps/web/components/the-mach.module.css`, `apps/web/components/trang-mach.module.css`,
`scripts/bai-viet/chu-de.md`, `scripts/bai-viet/lich/tan-man.md` (+3 file cùng cụm).
**Không đụng.** Không `git checkout --` / `git restore` / `git stash` (index stale sẽ đè
mất bản vá — tai nạn 2026-08-31, xem sổ). Kiểm "mình có làm hỏng gì không" bằng
`git diff HEAD -- <file mình sửa>`, không bằng `git status`.

### 6.2 · Chia độc quyền chặng 3/4

| Agent | Được chạy | Cấm |
|---|---|---|
| `nghiem-thu` | `pnpm test` · `pnpm build` · `pnpm codegen:check` · `pnpm lint` · `pnpm e2e:don-vi` · script trình duyệt §6.3 (chiếm 8000 + 3001) | — |
| `phan-bien` | đọc code · `pnpm lint` · `pnpm e2e:don-vi` (không DB, không cổng) · SQL chỉ đọc | `pnpm test` (hai pytest cùng lúc giành `test_gikky_dev`) · build · script §6.3 |

### 6.3 · Script trình duyệt dùng-một-lần (không commit)

Khu quản trị **chưa có e2e trình duyệt nào trong repo** (Playwright chỉ dựng 3000 + 8000).
Dựng hạ tầng đó là việc khác — ghi sổ. Lượt này đo bằng script ở
`<scratchpad>/kiem-quan-tri/` (Playwright, `chromium` đã cài trong `apps/web`):

1. `DATABASE_URL` trỏ **`gikky_e2e`** (đặt + kiểm + chạy trong CÙNG một lệnh — `gikky_dev`
   có bài THẬT của user, tuyệt đối không ghi vào). In `DB=gikky_e2e` rồi mới đi tiếp.
2. Trong `gikky_e2e`: tạo superuser dùng-một-lần (`shell -c`, mật khẩu ngẫu nhiên đưa qua
   env cho script, không in ra), tạo một mạch 2 mốc bằng `tao_mach` + `them_moc`.
3. Dựng Django `runserver 8000 --noreload` (cùng env) và `next start --port 3001` của bản
   admin vừa build; script bấm đúng luồng ở tiêu chí 5.6; xong thì tắt cả hai.
4. Dọn: ẩn/xoá mạch và tài khoản tạm trong `gikky_e2e`.

## 7 · Nhật ký thực hiện (`opus-dev` điền, mỗi mục ngắn)

### Quyết định nhỏ đã tự chốt + lý do

1. **`PATCH /admin/machs/{id}/tieu-de`, KHÔNG phải `PATCH /admin/machs/{id}`** (lệch §2.4).
   `GET /admin/machs/{id}` nằm ở router KHÁC (`quan_tri_kiem_duyet.py`); django-ninja sinh
   urlpattern theo TỪNG router và Django resolver lấy pattern khớp đầu tiên ⇒ `PATCH` rơi
   vào router kia (chỉ có GET) và trả **405**. Đúng cái bẫy `quan_tri_nguoi_dung.py` đã ghi
   cho `POST /nguoi-dung`. Đổi thứ tự `add_router` chỉ đảo chiều lỗi sang `GET`.
2. **`api_admin` được thêm exception handler cho `LoiGhi`** (`quan_tri.py`). §2.4 cho hai
   lối; chọn lối handler vì `_xu_ly_http_error` đoán `code` theo status ⇒ `LoiGhi(413,
   "anh_qua_nang")` của `anh_chung.py` ra ngoài đội mã `tham_so_khong_hop_le`. Thuần bổ
   sung: hôm nay không handler quản trị nào khác ném `LoiGhi`.
3. **Làm mới ISR gọi HAI lần SAU khi ghi** (§1.4 tả "trước + sau"). `sua_tieu_de_mach` đã
   trả `slug_cu` nên không cần lời gọi trước — và gọi trước là xếp hàng 1 đường ngay cả khi
   `da_doi=false`, tức B8 vế "không đổi ⇒ 0" không thể xanh. Thêm
   `revalidate.lam_moi_mach_slug(mach_id, slug)` như §2.2 cho phép.
4. **`ly_do` cho hai cửa ảnh: BỎ** (§2.6 cho phép chọn). Multipart không có thân JSON; nhét
   `ly_do` vào query là một hình dạng request thứ hai cho cùng một khái niệm. `AuditLog.meta`
   vẫn có khoá `ly_do` (chuỗi rỗng), nên thêm sau không phải đổi hợp đồng.
5. **Phép chặn superuser giữ nguyên kiểu "trong handler"** (đúng §2.4) ⇒ hai cửa POST
   multipart phải nhận **file THẬT** trong `tests/_quan_tri.py::bang_endpoint`: ninja
   validate thân request TRƯỚC handler, nên body rỗng ăn 400 và
   `test_CHI_SUPERUSER_that_su_chan_mod` đọc 400 đó thành "đã qua hàng rào". `goi()` nhận
   thêm nhánh multipart; `test_superuser_QUA_duoc_…` mang thêm fixture `kho_anh`.
6. **`test_tim_kiem_cau_truc.py::_co_goi` nay đi XUYÊN helper riêng tư.** Tách `_ap_sua_moc`
   làm `sua_moc` mất lời gọi `dong_bo_mach` trực tiếp ⇒ hàng rào đỏ đúng. Cách chữa rẻ là hạ
   nhãn `sua_moc` xuống `KHONG` — tức tự tắt chuông; thay vào đó cho `_co_goi` theo lời gọi
   tới hàm `_riêng_tư` cùng file. Chiều ngược (KHONG không được gọi) vì thế **chặt hơn** bản cũ.
7. **`_moc_ra` của `quan_tri_kiem_duyet.py` nhận thêm tham số `mach`** — `sua_duoc` cần
   `locked_at`, mà `moc.mach` trong vòng lặp prefetch là một truy vấn cho MỖI mốc (docstring
   `xem_mach` hứa số truy vấn là hằng số).
8. **Script §6.3 chạy Django ở cổng 8010, không phải 8000**, và admin build lại với
   `API_ORIGIN=http://localhost:8010`. Cổng 8000 + 3000 đang bị PHIÊN KHÁC chiếm (Django của
   họ nối `gikky_dev` — bài THẬT). Đi qua cổng 8000 là ghi vào DB thật; chiếm lại là giết
   server của họ. Sau khi đo, admin đã build lại với `API_ORIGIN` mặc định.
9. **Tài khoản tạm của script phải có `EmailAddress` đã xác minh** —
   `ACCOUNT_EMAIL_VERIFICATION = "mandatory"`, thiếu nó thì allauth trả 401 trông y hệt "sai
   mật khẩu".
10. **Không chạy `don_anh_mo_coi` để dọn ảnh của lượt đo**: `api/media/` là kho CHUNG cho cả
    `gikky_dev` lẫn `gikky_e2e` ở máy này ⇒ lệnh ấy sẽ coi mọi ảnh của `gikky_dev` là mồ côi.
    Script dọn xoá đúng khoá do nó sinh ra.

### Lượt sửa sau phản biện (2026-09-03, 9 điểm)

| # | Hạng | Sửa thế nào | Vì sao |
|---|---|---|---|
| 1 | NẶNG | `sua_moc`: `con_im_lang = moc.edited_at is None and (khi - created_at) <= 15'` | Trước đó, tác giả sửa trong 15 phút SAU khi mod đã sửa ⇒ không revision ⇒ **bản của mod biến mất hoàn toàn**, nhật ký trỏ vào một revision không chứa nó, nhãn "đã sửa 1 lần" cho 2 lần sửa. Lỗi do chính lượt này tạo ra (trước đây không ai ngoài tác giả sửa được mốc). Bài đo B16 |
| 2 | VỪA | `them_anh_moc` gọi `dong_bo_kho_anh(moc_khoa)` trong cùng `atomic()`, sau `create` | `ghi_anh` luôn ghi `kho_hien()`, mà cửa admin cố ý cho gắn ảnh vào mạch ĐANG ẨN ⇒ `/media/anh/<uuid>` trả **200** cho mạch đã gỡ (Caddy đọc thẳng đĩa, A9), ngay cạnh ảnh cũ trả 404. Tự chữa ở lượt ẩn/gỡ-ẩn kế tiếp nên không bao giờ nổi lên. Không sinh cạnh khoá mới (`Moc → MocAnh` đã có ở chính hàm này) |
| 3 | VỪA | Tách `napVao(giu_form)` → `nap` / `napGiuForm`; nút Gỡ ảnh dùng hook `chayAnh` (làm tươi bằng `napGiuForm`) | `useHanhDong` gọi `lamTuoi()` sau mọi hành động; bản đầu ghi đè cả `body` state. Editor **không** bị ghi đè theo (`useEditor` deps rỗng chỉ `setOptions`, không áp lại `content`) ⇒ màn hình hiện chữ mới, state giữ chữ cũ, bấm Lưu ra "Không có gì đổi", rời trang là mất hẳn |
| 4 | VỪA | `luu()`: cắt từng file khỏi `anh_moi` **ngay khi tấm đó 201** (`con_lai.shift()`), rồi mới `return {error}` | Bản đầu chỉ `datAnhMoi([])` sau cả vòng lặp ⇒ 3 ảnh mà tấm thứ ba hỏng thì hai tấm đã lên vẫn nằm trong hàng đợi; Lưu lại là gửi chúng lần hai ⇒ ảnh trùng + `AuditLog` thừa + file thừa, vài lượt là chạm trần 10 |
| 5 | VỪA | `_kiem_thay_doi_moc`: `if thay_doi.get("body", "") is None: raise ValidationError` | `Field(min_length=1)` trên `str \| None` chỉ áp cho nhánh `str`; `{"body": null}` xuống tới `lam_sach(None)` ⇒ `TypeError` ⇒ **500 trần**, vỡ hợp đồng `{detail, code}`. Chặn ở LÕI nên vá cả cửa v1 lẫn cửa admin. Sửa luôn ba docstring đang nói dối ("schema chặn trước"): `MocSuaIn`, `mocs.py::sua_moc_api`, `quan_tri_sua_moc`. Bài đo B17 |
| 6 | NHẸ | `luu()` chặn `body.trim() === ""` bằng câu tiếng Việt | Editor trả chuỗi rỗng khi trống; không chặn thì mod nhận nguyên câu pydantic *"String should have at least 1 character"* |
| 7 | NHẸ | Docstring `SuaTieuDeMachIn` ghi đúng `PATCH /admin/machs/{id}/tieu-de` | Docstring class đi thẳng vào `openapi.admin.json`; đường sai ở đó dẫn người đọc vào đúng cái bẫy 405 mà file handler vừa dựng cả khối chữ để cảnh báo |
| 8 | NHẸ | `chiPhanDoi` lọc cặp `figures` trống một trong hai vế (trim + filter), cùng luật `truong-moc.tsx::thanMoc` | Bấm "Thêm cặp" rồi Lưu ⇒ 400 kèm câu lỗi thô `figures[2].value phải là chuỗi không rỗng` |
| 9 | — | Không sửa code; §2.3 của plan đã sửa cho khớp sự thật về `anhs` của mốc bị ẩn | Bốn mục còn lại (`xoa_anh_moc` bỏ log khi `moc_khoa is None` — **nghi ngờ**, gần như bất khả vì FK; `AnhNoiDung` không bao giờ vào kho cách ly; bản chép thứ ba của phép chặn superuser ở `quan_tri_cai_dat.py`) ⇒ để phiên chính ghi sổ |

### Thử phá (7 ca — dòng làm hỏng → bài đỏ)

| # | Sửa hỏng | Kết quả |
|---|---|---|
| a | `ghi_audit(` → `if False: ghi_audit(` trong `sua_moc_boi_mod` | `test_B1_…` ĐỎ (`AuditLog.DoesNotExist`) |
| b | `de_dau=True` → `de_dau=(khi - moc.created_at) > timedelta(PHUT_SUA_IM_LANG)` | `test_B1_…` + `test_mod_sua_moc_2_phut_tuoi_VAN_de_lai_vet` ĐỎ |
| c | bỏ dòng lọc trường không đổi (`thay_doi = dict(thay_doi)`) | `test_B3_…` + `test_B8_khong_doi_…` ĐỎ |
| d | xoá `lam_moi_mach_slug(mach.pk, slug_cu)` ở handler | `test_B8_doi_tieu_de_lam_moi_CA_duong_cu_lan_duong_moi` ĐỎ |
| e | bỏ `chan_neu_khong_phai_superuser` ở `quan_tri_sua_moc` | `test_B2_…` ĐỎ |
| f | `if boi is not None:` → `if False:` trong `them_anh_moc` | `test_B14_dinh_kem_…_dung_MOT_dong_log` ĐỎ |
| g | bỏ `chan_neu_khong_phai_superuser` ở `POST /admin/anh` | `test_B13_mod_thuong_403_…` + `test_B2_…` ĐỎ |
| h | bỏ vế `moc.edited_at is None` khỏi `con_im_lang` | `test_B16_…` ĐỎ (`edit_count` 1 ≠ 2) |
| i | xoá `dong_bo_kho_anh(moc_khoa)` khỏi `them_anh_moc` | `test_them_anh_vao_moc_cua_mach_DANG_AN_thi_file_vao_kho_CACH_LY` + `test_B14_trang_thai_khoa_bia_mo_an` ĐỎ |
| j | trả hook ảnh về `useHanhDong(nap)` rồi **build lại + chạy script trình duyệt** | bước "gõ thêm chữ → gỡ ảnh → Lưu ⇒ chữ KHÔNG mất" ĐỎ (`waitForURL` timeout — trang đứng yên ở "Không có gì đổi"), 9/10 thay vì 15/15 |

Mỗi ca: khôi phục xong chạy lại → xanh. Cây cuối cùng đã kiểm bằng `grep`: không còn
`if False`, `de_dau=True` và dòng lọc còn nguyên, 5 lời gọi chặn superuser còn đủ.

### Số đo cuối (sau lượt sửa 9 điểm)

- `pnpm test` (cây làm việc chính): **1946 passed · 0 failed · 26 skipped · 0 warning**
  (`filterwarnings = error`), 5 phút 44. Hai file của lượt này: **48 bài** (35 + 13).
  ⚠ Lượt chạy TRƯỚC đó ra `1945 passed, 1 failed` rồi **không tái hiện**, và tổng số bài
  đổi giữa hai lượt (1945 → 1946) vì **phiên khác đang sửa file trong cùng cây** — không
  quy được lỗi ấy cho bản vá này, cũng không chứng minh được nó vô can. Chặng 3 nên chạy
  `pnpm test` một mình.
- Chạy riêng 11 file bị lượt này chạm (kể cả `test_api_ghi_moc.py`, `test_api_anh*.py`,
  `test_quyen_ghi.py`, `test_tim_kiem_cau_truc.py`): **277 passed**.
- `pnpm codegen` + `pnpm codegen:check`: exit 0, "khớp — 34 file không đổi".
  `src-admin/sdk.gen.ts` có đủ 6 hàm mới.
- `pnpm lint`: 0 warning, cả hai app.
- `pnpm --filter @gikky/admin build`: 0 warning, 17 route (thêm `/m/[machId]/moc/[mocId]`).
  **`pnpm build` TOÀN BỘ chưa chạy** — cổng 3000/8000 đang bị phiên khác chiếm, và build
  `apps/web` sẽ phá `next dev` của họ.
- `pnpm e2e:don-vi`: **434 passed** (5,1s).
- Script trình duyệt §6.3: **15/15 bước PASS** — 14 bước cũ, cộng bước mới *"gõ thêm chữ →
  gỡ ảnh đính kèm → Lưu ⇒ chữ KHÔNG mất"* (bắt lỗi #3). Chạy trên `gikky_e2e` với Django
  8010 + admin 3001; đã dọn sạch (`da_xoa_mach=1 da_xoa_user=2`, file ảnh đã gỡ khỏi
  `api/media/`) và admin đã build lại với `API_ORIGIN` mặc định.

### Còn treo

- **`pnpm build` toàn bộ** và bài đo cây sạch: phải chạy khi cổng 3000/8000 rảnh.
- **Cây làm việc đã lẫn việc của phiên khác.** Lúc bắt đầu `git diff HEAD --stat` ra đúng 7
  file như §6.1; hiện là **51 file + 14 file untracked** vì một phiên khác đang làm "nhắn tin
  riêng" (`plans/2026-09-03-nhan-tin-rieng.md`) và "cuộn vô hạn feed". Hệ quả cụ thể:
  `pnpm codegen` (lệnh của plan này) sinh lại **cả client v1**, nên
  `packages/api-client/openapi.json` + `src/*` nay mang thêm `lietKeHoiThoai`, `guiTinNhan`,
  `docHoiThoai`, `demTinNhanChuaDoc`, `xemHoiThoai` — **không phải việc của lượt này**. Phiên
  chính phải tách khi stage.
- `api/api/quan_tri_cai_dat.py` còn một bản chép thứ ba của phép chặn superuser (§2.4 chỉ
  yêu cầu gộp với `quan_tri_nguoi_dung.py`) — ghi sổ, không sửa.
