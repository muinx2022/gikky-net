# `/luot-xem` — phần chi tiết chuyển thành TAB, dọn phần dưới trang

Chốt 2026-09-04. User: *"phần lượt xem tạm đủ thông tin, nhưng cách trình bày vẫn có gì đó lộn
xộn"* → hỏi lại: *"các phần ở dưới như xem nhiều, nguồn truy cập… bố cục cứ lộn xộn"*, và chọn
**"Chuyển thành tab"** cho sáu bảng chi tiết. User KHÔNG chọn đổi hàng KPI/Online ở trên ⇒
giữ nguyên hàng ấy, lượt này chỉ đụng **phần dưới biểu đồ**.

Chẩn đoán theo `dataviz` skill (đã nạp): sáu thẻ trong lưới 2 cột cao thấp so le (răng cưa);
bốn đoạn văn "giới hạn" đọc như tài liệu; hai cặp bảng cùng chủ đề (Bot theo nhóm/Top bot,
Trình duyệt/Thiết bị) bị tách rời. Tab giải quyết cả ba mà không bỏ thông tin nào.

## 1 · Component `Tabs` mới — `apps/admin/components/tab.tsx`

Admin chưa có tab nào (`grep role="tablist"` = 0). Dựng một component nhỏ, **a11y đúng khuôn
WAI-ARIA Tabs**, không lib mới:
- `<div role="tablist" aria-label=…>` chứa `<button role="tab" id=… aria-selected aria-controls
  tabIndex={chọn ? 0 : -1}>`; panel `<div role="tabpanel" id=… aria-labelledby=… tabIndex={0}>`.
- Phím: `ArrowLeft/ArrowRight` (vòng), `Home/End`; đổi tab là đổi focus + chọn luôn
  (automatic activation).
- Style theo đúng khuôn bộ chọn khoảng ngay phía trên (`nut nut-nho`, chọn = `nut-chinh`) —
  hai hàng nút trên một trang phải cùng một ngôn ngữ. Không màu ứng biến, không `--stamp`.
- Chỉ render **panel đang chọn** (không mount cả bốn rồi `hidden`).
- API: `<Tabs khoa_mac_dinh="noi_dung" muc={[{khoa, nhan, noi_dung: ReactNode}]} />`,
  state `useState` nội bộ. KHÔNG URL, KHÔNG localStorage (chưa ai xin).

## 2 · Áp vào `/luot-xem` — 4 tab thay lưới 6 thẻ (dòng ~313–438 hiện tại)

| Tab (`khoa`) | Nhãn | Nội dung panel |
|---|---|---|
| `noi_dung` | Nội dung | bảng "Xem nhiều nhất" (top 20 đường dẫn) — **full width** |
| `nguon` | Nguồn truy cập | bảng nguồn + dòng "(trực tiếp / nội bộ)" + empty-state như cũ |
| `bot` | Bot | HAI khối xếp dọc trong một panel: "Theo nhóm" (bảng nhỏ) rồi "Vào nhiều nhất" (top 20) |
| `nguoi_doc` | Người đọc | "Trình duyệt" + "Thiết bị" cạnh nhau (2 cột từ `sm`, dọc dưới đó) |

- Mặc định tab `noi_dung`.
- Cờ `chi_tiet_chi_90_ngay` (áp cho CẢ 4 tab) ⇒ **một dòng chú ngay dưới tablist**, không
  chôn ở cuối trang nữa; giữ `data-testid="chu-chi-tiet-90-ngay"`.
- **GIỮ MỌI `data-testid` bảng** (`bang-duong-dan`, `bang-nguon`, `bang-nhom-bot`, `bang-bot`,
  `bang-trinh-duyet`, `bang-thiet-bi` — tên đúng như đang có trong file) và mọi `KhoiRong`.
  Thêm `data-testid="tab-<khoa>"` cho nút, `tabpanel-<khoa>` cho panel.
- Mỗi bảng vẫn dùng `KhungBang`/`HangTieuDe` như cũ — full width nên `min-w-[52rem]` không
  còn gây cuộn ở ≥xl; ở màn hẹp `KhungBang` tự cuộn như mọi trang admin.

## 3 · Khối "giới hạn" (4 đoạn, `chu-gioi-han`) → `<details>` "Cách đọc số liệu"

- `<details data-testid="chu-gioi-han"><summary>Cách đọc số liệu (bốn giới hạn)</summary>…`
  — **đóng mặc định**, chữ bên trong GIỮ NGUYÊN (kể cả `chu-online`); riêng đoạn "chi tiết 90
  ngày" đã dời lên dưới tablist (§2) nên trong details chỉ còn một câu trỏ lên.
- Bộ đếm "Ba/Bốn" của khối này: sửa cho khớp số đoạn còn lại trong details.
- ⚠ `ban-sao-python.spec.ts` ghim mọi chuỗi `<n> phút` trên trang phải = hằng Python — chữ
  chỉ dời chỗ, không đổi, nên vẫn xanh; **phải chạy lại để chắc**.

## 4 · Modal online — một dòng: dòng bot KHÔNG in hàng "— · —"

`la_bot` ⇒ ẩn hẳn hàng trình duyệt·thiết bị (đang in hai gạch ngang). Người ⇒ như cũ.

## 5 · KHÔNG làm

- Không đổi hàng KPI/ô Online/biểu đồ/bộ chọn khoảng (user không chọn) · không đổi API/Python
  · không URL/localStorage cho tab · không lib · không tab cho modal.

## 6 · Tiêu chí nghiệm thu — ĐO ĐƯỢC

Nền: e2e don-vi **437/437** (0 đỏ) · lint 0 · build xanh · codegen khớp. **pytest KHÔNG chạy**
(không đụng Python) — nhưng `pnpm codegen:check` vẫn phải khớp để chứng minh điều đó.

| # | Tiêu chí | Đo bằng |
|---|---|---|
| T1 | `pnpm lint` 0 warning · `pnpm build` xanh (`/luot-xem` build được) · `pnpm codegen:check` khớp · `pnpm e2e:don-vi` ≥ 437 + bài mới, **0 đỏ** | chạy lại |
| T2 | Bài đo don-vi đọc-nguồn MỚI (fail-closed, quét bản `boChuThich`): (a) `page.tsx` dùng `<Tabs` với ĐÚNG 4 khoá `noi_dung·nguon·bot·nguoi_doc`; (b) 6 `data-testid` bảng cũ vẫn có mặt; (c) `chu-gioi-han` nằm trên `<details>` có `<summary>`; (d) `tab.tsx` có `role="tablist"`, `role="tab"`, `aria-selected`, `aria-controls`, xử `ArrowRight`+`ArrowLeft`+`Home`+`End`; (e) không màu ứng biến/`--stamp` (đã có rào chung) | bài đo |
| T3 | Thử phá ≥ 3: bỏ `aria-selected` ⇒ (d) đỏ · xoá một `data-testid` bảng ⇒ (b) đỏ · đổi `<details>` về `<div>` ⇒ (c) đỏ | báo cáo |
| T4 | Kiểm mắt (chặng 5, trình duyệt thật + session mod): 4 tab bấm được, panel đổi đúng bảng, ←/→ chuyển tab và focus đi theo, bảng full width KHÔNG cuộn ngang ở 1280px, `details` đóng mặc định và mở được, modal dòng bot không còn "— · —" | phiên chính |

## 7 · Ràng buộc

KHÔNG commit · KHÔNG dev server (chặng 5) · KHÔNG `pnpm e2e` trần · KHÔNG đụng file phiên khác
(`form-tai-khoan.*`, `ket-qua-tim-kiem.module.css`, `the-mach.module.css`, `trang-mach.module.css`,
mọi thứ sửa-bài/cuộn-vô-hạn/anh_chung) · `quan-tri-giao-dien.spec` (menu, màu) phải xanh.

## 8 · Nhật ký

### 2026-09-04 · opus-dev (chặng 2)

**Đã làm** — 3 file:

- **`apps/admin/components/tab.tsx`** (MỚI): `Tabs` + type `MucTab`. `role=tablist/tab/tabpanel`,
  `aria-selected` · `aria-controls` · `aria-labelledby` · `aria-label`, roving tabindex
  (`tabIndex={dang ? 0 : -1}`), `←/→` vòng + `Home/End` kèm `preventDefault`, automatic
  activation (đổi state **và** `.focus()` nút mới). Id sinh bằng `useId()`. Chỉ mount panel đang
  chọn. Style `nut nut-nho` / `nut-chinh`. Prop `chu` cho dòng chú **giữa** tablist và panel.
  Rơi về mục đầu nếu `khoa_mac_dinh` không có trong `muc` (chống panel trắng).
- **`apps/admin/app/luot-xem/page.tsx`**: lưới 6 thẻ → 4 tab `noi_dung · nguon · bot · nguoi_doc`
  (bot = 2 khối dọc; nguoi_doc = `grid sm:grid-cols-2`). Sáu `tbody` + sáu `KhoiRong` giữ nguyên
  testid. Chú 90 ngày (`chu-chi-tiet-90-ngay`) dời lên dưới tablist. `chu-gioi-han` → `<details>`
  đóng mặc định, `<summary>` "Cách đọc số liệu (ba/bốn giới hạn)"; đoạn thứ tư trong details rút
  còn một câu trỏ lên, bộ đếm Ba/Bốn giữ đúng số đoạn. Modal: `!k.la_bot &&` bọc hàng
  trình duyệt·thiết bị ⇒ dòng bot hết "— · —". Docstring đầu file cập nhật theo.
- **`apps/web/e2e/don-vi/quan-tri-giao-dien.spec.ts`**: +4 bài (fail-closed, quét bản `boChuThich`).

**Số đo (cây chính, cây đang bẩn vì nhiều phiên song song — 3 file trên là của lượt này):**

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | xanh, 0 warning (`--max-warnings=0`) |
| `pnpm build` | xanh 2/2 app, `/luot-xem` 6.96 kB / 123 kB First Load |
| `pnpm codegen:check` | **khớp** — 34 file không đổi ⇒ không đụng Python |
| `pnpm e2e:don-vi` | **441 passed, 0 failed** (nền 437 + 4 bài mới) |

`ban-sao-python.spec` (ghim `<n> phút`) vẫn xanh — chữ chỉ dời chỗ, không đổi số.

**Thử phá (5 ca, mỗi ca bẻ → đo → khôi phục):**

| Bẻ gì | Bài ĐỎ |
|---|---|
| Xoá `aria-selected` khỏi `tab.tsx` | `TAB — components/tab.tsx đủ khuôn WAI-ARIA và xử đủ bốn phím` |
| Đổi `data-testid="bang-thiet-bi"` → `…-XX` | `TAB /luot-xem — cả sáu bảng chi tiết còn mặt trong panel` |
| `<details data-testid="chu-gioi-han">` → `<div>` | `TAB /luot-xem — khối giới hạn là <details> có <summary>, đóng mặc định` |
| Đổi khoá `nguoi_doc` → `nguoi` | `TAB /luot-xem — đúng bốn khoá tab, không thừa không thiếu` |
| Thêm `open` vào `<details>` | `TAB /luot-xem — khối giới hạn là <details> có <summary>, đóng mặc định` |

**Lệch plan — hai chỗ, đều cố ý, cần chặng 5 soi:**

1. **§2 nói cờ `chi_tiet_chi_90_ngay` "áp cho CẢ 4 tab" — SAI.** `api/api/quan_tri_luot_xem.py`
   nhánh `KHOANG_TAT_CA` dựng `top_duong_dan` từ `TongNgay` + hàng thô ⇒ tab **Nội dung KHÔNG**
   bị cắt 90 ngày; chỉ 4 bảng Nguồn · Bot · Trình duyệt · Thiết bị bị. Nên câu chú giữ nguyên
   cách gọi **đích danh bốn bảng** như bản cũ, không rút thành "các bảng dưới đây".
2. **§3 "bộ đếm sửa cho khớp"**: chọn cách giữ đếm **động** Ba/Bốn và để lại trong details một
   đoạn thứ tư **một câu trỏ lên** (không mang `data-testid` — testid đi theo bản đầy đủ ở trên).
   Bỏ hẳn đoạn ấy thì hoặc đếm nói "Bốn" mà chỉ có ba đoạn, hoặc mục "Bốn," biến mất khỏi dãy
   Một–Hai–Ba — cả hai đều là cái bẫy mà chú thích của chính bộ đếm dựng ra để tránh.

**Chưa chắc, chặng 5 (T4) phải nhìn:** tab `nguoi_doc` xếp 2 cột từ `sm` đúng như §2, nhưng
`KhungBang` ép `min-w-[52rem]` (832px) nên **hai bảng cạnh nhau vẫn cuộn ngang** ở 1280px
(mỗi cột ~485px). Đây **không phải hồi quy** — lưới cũ `xl:grid-cols-2` có đúng bệnh ấy — nhưng
T4 đòi "bảng full width KHÔNG cuộn ngang ở 1280px", và vế "full width" chỉ đúng với ba tab kia.

### Chặng 5 — phiên chính chốt (2026-09-04, 19:40)

**Nghiệm thu:** ĐẠT 4/4 tiêu chí (T1–T4). **Phản biện:** 3 VỪA + 5 NHỎ, đã vá hết trong lượt:

| Mã | Phát hiện | Vá |
|---|---|---|
| V1 | `sm:grid-cols-2` + `min-w-[52rem]` của `KhungBang` ⇒ tab "Người đọc" cuộn ngang vô cớ 640–1279px (hồi quy so với trước) | `KhungBang` thêm prop `rong` (mặc định `true`, 14 chỗ cũ không đổi); ba bảng ≤3 cột dùng `rong={false}` |
| V2 | Panel thiếu `key` ⇒ React tái dùng DOM, cuộn bảng/ô nhập chảy sang tab khác (dựng được ở 640px) | `key={dang_mo.khoa}` trên panel + docstring hợp đồng "rời tab là huỷ" |
| V3 | `aria-controls` trỏ id không tồn tại ở 3 tab không mở (panel lazily mounted) | `aria-controls` chỉ đặt trên tab đang chọn (APG cho phép) |
| N1 | Bài đo `toContain("aria-label")` khớp cả `aria-labelledby` ⇒ bỏ `aria-label` không đỏ | đổi thành `"aria-label="` |
| N2 | Click không focus nút ⇒ Safari: `→` nhảy từ nút cũ | `onClick` gọi `focus()` |
| N3/N4 | Docstring/comment sai (hứa "state mất khi rời tab" trong khi thiếu `key`; "tabIndex làm bảng cuộn được bằng phím") | viết lại đúng |
| N5 | Rơi về mục đầu khi khoá sai là IM LẶNG | `console.warn` hai ca (khoá lạ, `muc` rỗng) |
| N7 | Tên `Tabs` lạc lối đặt tên tiếng Việt của khu admin | đổi thành `KhungTab` |

**Thử phá hàng rào mới (3/3 đỏ đúng, đã khôi phục, sau đó 15/15 xanh):**
bỏ `aria-label={nhan_nhom}` → 1 failed · bỏ `key={dang_mo.khoa}` → 1 failed · bỏ một
`rong={false}` (bảng trình duyệt) → 1 failed (`Expected 3, Received 2`). Lần thử đầu của ca
thứ ba KHÔNG đỏ vì `sed` nhắm số dòng cũ sau khi docstring đẩy dòng — bẻ theo mẫu nội dung
mới đúng; ghi lại để lần sau đừng thử phá bằng số dòng.

**Số đo cuối (cây làm việc chung, phiên chính tự chạy):** `pnpm e2e:don-vi` **442 passed** ·
`pnpm lint` 0 warning · `pnpm build` xanh (`/luot-xem` 7.11 kB) · `pnpm codegen:check` khớp.

**T4 kiểm mắt (Chromium thật, admin dev 3001 → api 8000, cookie mod gieo tạm):** 4 tab đúng
nhãn, mặc định `noi_dung`; mỗi tab đúng bảng (`bang-duong-dan` / `bang-nguon` /
`bang-nhom-bot`+`bang-bot` / `bang-trinh-duyet`+`bang-thiet-bi`), panel 972px **không cuộn
ngang** ở 1280; `→` từ tab cuối vòng về đầu, `←` ngược lại, `Home`/`End` đúng, focus đi theo;
`<details>` giới hạn đóng mặc định, bấm mở được; chú 90 ngày chỉ hiện ở `tat_ca`; modal online
3 khối, dòng bot **không** còn "— · —"; 0 lỗi JS. Lần chạy đầu modal ra 0 khối vì hàng gieo đã
quá cửa sổ 5 phút lúc bấm — không phải lỗi; gieo lại sát giờ thì đủ 3. Dữ liệu gieo + session
đã xoá sạch khỏi `gikky_dev` (0 hàng còn lại).

**Sổ:** thêm `P-20260904-3` (VỪA — vùng cuộn `KhungBang` không cuộn được bằng phím, WCAG 2.1.1,
nợ chung mọi bảng admin) và `P-20260904-4` (NHỎ — `min-w-[52rem]` là sàn cứng; 12 chỗ dùng
khác chưa rà). Không tự sửa — ngoài phạm vi.
