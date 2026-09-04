# Đăng bài từ admin + hẹn giờ phát hành

Chốt 2026-09-04. User: *"thêm tính năng, cho phép post bài từ admin và hẹn giờ publish"*.

Plan `2026-09-04-hen-gio-admin-va-front.md` cố ý **không** dựng form soạn trong admin
(100–200 bài đi qua `dang-bai.py --hen`). Lượt này **lật đúng một câu ấy**: thêm form
soạn một bài trong khu quản trị. Đường ghi, editor, hẹn giờ **đã có** — không viết lại.

## 0. Đã có, không làm lại

| Cái | Ở đâu |
|---|---|
| `POST /admin/machs/hen-gio` — tạo mạch thay mặt tài khoản đội, `published_at` tương lai = hẹn | `quan_tri_hen_gio.py::tao_mach_hen_gio` · `quanTriTaoMachHenGio` |
| Allowlist tác giả: `gikky-team-news`, `gikky-team-member` (không `admin`) | `TAI_KHOAN_DANG_BAI` |
| TipTap admin (allowlist thẻ + ảnh nội dung `POST /admin/anh`) | `soan-thao-quan-tri.tsx` |
| Ô giờ VN → ISO `+07:00` | `lib/thoi-gian.ts` (`datetimeLocalSangIsoVN`) |
| Khối dời/huỷ hẹn trên bài đã có | `khoi-hen-gio.tsx` trên `/m/[id]` |
| Ảnh đính kèm sau khi có `moc_id` | `quanTriTaiAnhMoc` (trang sửa mốc) |
| Danh sách sub (không phân trang) | `quanTriLietKeSub` |
| Bot `--hen` cho đợt 100–200 bài | `scripts/bai-viet/dang-bai.py` — **giữ**, form không thay |

`POST /api/v1/machs` **vẫn không nhận** `published_at`. Form công khai không đổi.

## 1. Quyết định (kèm lý do)

1. **Không endpoint mới.** Form gọi thẳng `quanTriTaoMachHenGio`. Mọi luật (allowlist
   author, offset múi giờ, tu_upvote, bài hẹn = đang ẩn) đã nằm ở handler.
2. **Mọi staff**, không siết superuser. Cửa API đã `ChiMod`; đăng thay mặt tài khoản đội
   là việc biên tập thường ngày, khác sửa lời người khác (superuser-only).
3. **Không mục sidebar mới.** Nút *Đăng bài* trên `/machs` (`TieuDeTrang.hanh_dong`) dẫn
   `/machs/moi`. `/machs` đã `khop_tien_to` nên breadcrumb vẫn "Bài viết"; thêm mục
   `/machs/moi` vào `NHOM_MENU` sẽ **hai mục sáng cùng lúc**. Muốn mục riêng sau này thì
   đặt `/dang-bai` (không nằm dưới `/machs/`).
4. **Tác giả = dropdown hai tài khoản đội**, mặc định `gikky-team-member` (cùng bot
   `--hen`). Không ô gõ tự do — API 400 với username ngoài allowlist, UI không mời gõ
   rồi ăn lỗi. Hằng TS là **bản sao có chuông** (đọc `TAI_KHOAN_DANG_BAI` từ Python,
   cùng loài `ban-sao-python.spec.ts`).
5. **Hẹn giờ là tuỳ chọn trên cùng form**, không hai trang. Công tắc *Hẹn giờ phát hành*
   mở `<input type="datetime-local">`. Tắt ⇒ `published_at: null` (đăng ngay). Bật mà ô
   trống ⇒ không gửi, nói tại chỗ. Chuỗi gửi đi **bắt buộc** qua `datetimeLocalSangIsoVN`
   — cấm `toISOString()`.
6. **Đủ trường như form công khai + author + giờ hẹn.** Sub, tiêu đề, thân TipTap,
   `occurred_at` / loại / câu mời / figures (cùng khuôn trang sửa mốc), ảnh đính kèm gửi
   **sau** 201. Ảnh trong thân TipTap tải *trước* (đã có trong `SoanThaoQuanTri`).
7. **Xong → `/m/{id}` khu quản trị**, không nhảy sang host công khai. Bài hẹn URL công
   khai còn 404; trang chi tiết đã có `KhoiHenGio` để dời/phát hành ngay.
8. **`--hen` giữ nguyên.** Form = soạn từng bài. Bot = đợt JSON.

## 2. Việc làm

### 2.1 Trang `/machs/moi`

File mới: `apps/admin/app/machs/moi/page.tsx` (`"use client"`).

Nạp `quanTriLietKeSub({ baseUrl: GOC_API, cache: "no-store" })` lúc mount. Không sub ⇒
câu "Chưa có chuyên mục" + link `/subs`, không form rỗng.

Form (có thể tách `apps/admin/components/form-dang-bai.tsx` nếu trang > ~250 dòng):

- select sub (slug + tên)
- input tiêu đề (`maxLength` 160 — cùng `DAI_TITLE`)
- select author: đúng hai username allowlist
- `SoanThaoQuanTri` cho body
- ngày sự việc (`type="date"`, `max={homNayVN()}`), loại, câu mời, figures — **chép khuôn
  từ** `app/m/[machId]/moc/[mocId]/page.tsx`, không import `TruongMoc` của `apps/web`
  (CSS Modules ≠ Tailwind)
- input file ảnh đính kèm (trần lấy từ `tran_anh_moi_moc` trên payload sửa mốc sau khi
  tạo; lúc chọn file thì chỉ chặn số tấm phía client bằng cùng con số trang sửa đang
  dùng — nếu chưa có trên session mod thì để server 400, đừng bịa trần)
- công tắc hẹn giờ + `datetime-local` (`data-testid="o-hen-gio-dang-bai"`)

Nút gửi: nhãn *Đăng ngay* / *Hẹn giờ đăng* theo công tắc. `disabled` khi thiếu sub / tiêu
đề / thân. Gọi **thẳng**:

```
quanTriTaoMachHenGio({
  baseUrl: GOC_API,
  headers: headerGhi(),
  body: { sub, title, author, body, occurred_at, loai, question_for_crowd, figures,
          published_at: hen ? datetimeLocalSangIsoVN(o_gio) : null },
})
```

Cấm `const ham = …; ham(…)`. Hàng rào `type-admin.spec.ts`.

201 rồi nếu có file ảnh: `quanTriXemMach` lấy mốc `seq === 1`, lần lượt
`quanTriTaiAnhMoc`. Một tấm hỏng **không** cuốn bài theo — câu lỗi hai vế như trang sửa
mốc (*"Đã tạo bài, nhưng …"*), vẫn `router.push(/m/{id})` sau khi nói ra (hoặc ở lại nếu
muốn đọc lỗi — chọn **ở lại kèm link tới bài vừa tạo**, cùng lý lẽ form công khai không
điều hướng khi ảnh hỏng).

`data-testid`: `form-dang-bai-admin`, `nut-dang-bai-admin`.

### 2.2 Nút trên `/machs`

`apps/admin/app/machs/page.tsx`: `TieuDeTrang` thêm `hanh_dong` = `<Link href="/machs/moi"
className="nut nut-chinh" data-testid="nut-toi-dang-bai">Đăng bài</Link>`.

Không đổi `NHOM_MENU`.

### 2.3 Bản sao allowlist + don-vi

Hằng `TAC_GIA_DOI` trong form (hoặc `apps/admin/lib/tac-gia-doi.ts`). Bài đo trong
`apps/web/e2e/don-vi/hen-gio-phat-hanh.spec.ts` (thêm, không file spec mới trừ khi bài
đo vượt ~40 dòng):

- (a) trang `/machs/moi` tồn tại (`page.tsx`)
- (b) nguồn gọi `quanTriTaoMachHenGio(` kèm `baseUrl`
- (c) có `datetime-local` và `datetimeLocalSangIsoVN`
- (d) `TAC_GIA_DOI` khớp đúng tập (và thứ tự) username `TAI_KHOAN_DANG_BAI` cắt từ
  `api/api/quan_tri_hen_gio.py` — fail-closed nếu regex không cắt được
- (e) `/machs` có link `/machs/moi`
- (f) **không** thêm `duong_dan: "/machs/moi"` vào `menu.ts` (tránh hai mục sáng)

Thử phá ≥ 3: xoá lời gọi `quanTriTaoMachHenGio` ⇒ (b) đỏ; helper trả `Z` ⇒ (c) đỏ nếu
bài đo đọc cả `thoi-gian.ts` (T5e đã có — không lặp; bài mới chỉ ghim form **gọi**
helper); đổi một username ⇒ (d) đỏ. Khôi phục.

### 2.4 Backend

Không đổi schema, không migration, không `pnpm codegen` trừ khi vô tình đụng Ninja.

Pytest cửa `POST hen-gio` đã có (`test_C14_*`, T2). Không bắt buộc bài đo mới trừ khi
form phát hiện lỗ handler — lúc đó ghi vào `test_hen_gio_phat_hanh.py`.

## 3. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Đo bằng |
|---|---|---|
| T1 | `pnpm lint` 0 warning · `pnpm build` xanh · `pnpm codegen:check` khớp · `pnpm test` 0 fail · `pnpm e2e:don-vi` 0 đỏ | chạy lại |
| T2 | Don-vi (a)–(f) ở §2.3 xanh | spec mới/thêm |
| T3 | Thử phá ≥ 3 mục §2.3 rồi khôi phục | báo cáo |
| T4 | `type-admin.spec.ts` + `quan-tri-giao-dien.spec.ts` (MENU, màu) xanh — form không khai schema, không alias hàm, không mục menu chết | nằm trong T1 |
| T5 | Trình duyệt + session mod: Đăng ngay → bài hiện `/machs` lọc đang hiển thị; Hẹn giờ tương lai → hàng `hen_gio`, URL công khai 404, `/m/{id}` có `KhoiHenGio` | chặng kiểm mắt |

Không `pnpm e2e` trần.

## 4. Không làm

- Không form soạn trên host công khai với `published_at`.
- Không đăng dưới tên user thường / `admin`.
- Không TipTap thứ ba; không chép `soan-thao.tsx` của web.
- Không endpoint mới, không sửa `KetQuaHenGioOut` chỉ để mang `moc_id` (lấy bằng
  `quanTriXemMach`).
- Không thay `dang-bai.py --hen`.
- Không sửa `published_at` bài đã lên sóng (nút ấy đã bị `KhoiHenGio` từ chối).
- Không đụng `form-tai-khoan.module.css`, `plans/2026-08-31-modal-online.md`,
  `scripts/bai-viet/chu-de.md`.

## 5. Cây làm việc

Chạy trên cây hiện tại (backend hẹn giờ + form admin hẹn giờ đang dở/chưa commit là nền).
Không worktree từ `main`.

Sau Ninja (nếu có): `pnpm codegen`. Không commit trừ khi user bảo.

## 6. Nhật ký

_(điền khi thực thi)_
