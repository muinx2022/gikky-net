# Khối chủ đề xếp chồng + nút chính màu brand (việc 18)

> **Trạng thái:** ĐÃ LÀM 2026-11-12; **vòng 2 (vá hàng rào P-20261112-8, §10) ĐÃ LÀM 2026-11-13, nghiệm thu ĐẠT**. Nghiệm thu ĐẠT 6/6. Phản biện không có lỗi NẶNG hay VỪA; ba điểm NHỎ của hàng rào
> ghi ở sổ P-20261112-8. **Commit `4ed45b5` (2026-11-13), chưa deploy.** Nhánh `v2`, nền `34600c5`. Sổ việc: `GHI-CHU.md` việc 18.
> Gộp mục sổ **P-20261110-6** (nút "Đăng ký" ở theme tối mất chữ). User đồng ý sau khi được báo lỗi này và chọn
> "Xanh brand".
>
> **Nền khi giao thợ:** HEAD `34600c5`. `pnpm e2e:don-vi --list` cho **761 bài trong 72 file**. Đỏ nền e2e đầy đủ lấy
> theo danh sách đợt E ở `plans/2026-11-12-sua-hydrate-418.md` dòng 6–8 (20 bài; việc 17 có thể đã đổi danh sách
> này). Thợ thấy số bài khác thì DỪNG và báo.

## 1. Yêu cầu

User gửi ảnh chụp dev.gikky.net ngày 2026-11-12 và hỏi:

1. "phần list user cmt như thế này có ổn không? và nhìn nó ngang hàng với chủ đề thảo luận"
2. "có mấy nút đen, logo màu xanh, có j không ổn?"

User đã chốt hai điểm:

- **Nút chính dùng màu xanh brand** (`--brand`).
- **Khối chủ đề xếp chồng.** User chọn phương án này sau khi xem bản mô phỏng ngay trên dev.gikky.net, thay cho
  phương án giữ 2 cột và chỉ hạ cấp cột phải.

## 2. Hiện trạng đã đo (dev.gikky.net, `34600c5`, 2026-11-12)

| Đo | Kết quả |
|---|---|
| Bề rộng khối chủ đề | **760px** ở viewport 1280, 1440 và 1920; 625px ở 1024. Ảnh của user chụp ở tỷ lệ 1.5x nên trông rộng hơn. |
| Lưới hiện tại `1.25fr / 1fr` | Cột trái 379px, cột phải 303px. Tiêu đề 100 ký tự **gãy 5 dòng** ở cả bốn cỡ viewport. Khối cao 429px ở 1280. |
| Mô phỏng xếp chồng (chèn CSS tạm) | Tiêu đề còn **3 dòng**, khối cao 550px (+121px). |
| Nút "Đăng ký" ở theme tối | Chữ `rgb(255,255,255)` trên nền `rgb(232,236,244)`, tương phản khoảng 1.2:1 (P-20261110-6). |

Hiện trạng code:

- **Nút đặc nền `--ink`, 3 chỗ** (grep mọi `*.module.css` của `apps/web`):
  - `components/thanh-tai-khoan.module.css` `.nut_chinh`: chữ gõ cứng `#ffffff`, ở dòng 66 và dòng 77 (hover). Đây là
    gốc của P-20261110-6.
  - `components/khoi-thao-luan.module.css` `.nut_chinh`: chữ `var(--bg)`, đúng ở cả hai theme.
  - `components/o-soan-nhat-ky.module.css` `.nut_mo`: chữ `var(--bg)`.
- **Nút đặc nền `--brand` đã có:** `form-dang-mach.module.css` `.gui`, `drawer-dang-nhanh.module.css` `.nut_gui`,
  `o-soan-nhat-ky.module.css` `.nut_ghi` (nút mobile dính đáy). `app/globals.css:20-24` khai `--brand` là "nền đặc
  của nút/badge", chữ đặt lên là `--on-brand`. Cặp `--on-brand`/`--brand` đã có trong `tuong-phan.spec.ts`.
- **Bo góc:** nút header, `.nut_mo`, `.gui`, `.nut_gui` bo tròn hẳn (999px). Nút trong khối chủ đề
  (`.nut_chinh`, `.nut_phu`) bo 8px, `.nut_ghi` cũng bo 8px.
- **Avatar mặc định** là icon `UserRound` xám, đổi từ chữ cái sang icon ở commit `2d5ac08` (2026-10-22, áp cho toàn site).

## 3. Thiết kế

### 3.1 Khối chủ đề xếp chồng: `components/khoi-thao-luan.tsx` + `.module.css`

- **Bỏ lưới hai cột.** Phần tử mang `data-testid="chu-de-the"` (giữ nguyên testid và `data-mach-id`) thành một khối
  dọc: phần chủ đề ở trên, ô quan điểm ở dưới, cách nhau 20px. Có bình luận hay không thì phần chủ đề vẫn rộng hết
  khối. Hai lớp `.hai_nua`/`.mot_nua` gộp làm một, hoặc đổi tên cho đúng nghĩa.
- **`.boi_canh` cắt còn 2 dòng** (đang là 3), vì giờ dòng rộng gần gấp đôi.
- **Ô quan điểm** (`.phai`, testid `quan-diem-noi-bat`): bỏ `border-left`/`padding-left`. Nền `var(--inset)`, bo 10px,
  padding `14px 16px`. Giữ tiêu đề h3 "Quan điểm mới"/"Quan điểm nổi bật", khoảng dưới tiêu đề còn 8px.
- **Mỗi quan điểm** (`li`, testid `quan-diem`):
  - Desktop (> 640px), **một hàng**: avatar 24px · tên (đậm) · ngày · `▲ N` (chỉ khi N ≠ 0, luật cũ) · trích một dòng
    cắt bằng dấu "…", chiếm hết phần còn lại. Padding dọc 8px, giữ vạch ngăn `--line` giữa các mục.
  - Mobile (≤ 640px): tên · ngày · điểm trên một hàng, trích xuống hàng dưới và cắt ở 2 dòng. **Vẫn chỉ hiện 1 quan
    điểm**, cả ba vẫn nằm trong HTML (luật cũ, bài đo `trang-chu-giao-dien-moi.spec.ts:225-250` giữ nguyên).
  - **Ngày:** `<time dateTime={b.created_at}>` in `ngayNganCuaThoiDiem(b.created_at)` (`lib/dinh-dang.ts`, dạng
    `12/11`). Màu `--ink-3`, font UI 12px. Không dùng giờ tương đối: site đang in ngày tuyệt đối ở mọi nơi.
  - Avatar `co={34}` đổi thành `co={24}`. **Không sửa component `Avatar`.**
- **`.xem_tat_ca`:** bỏ `margin-top: auto` và `border-top` (không còn cột cao để đẩy link xuống đáy), `padding-top: 6px`.
  Ở mobile giữ vùng bấm ≥ 44px như cũ.
- **Media query:** khối `@media (max-width: 960px)` hiện chỉ dùng để chuyển 2 cột thành 1 cột, nên gỡ phần đó. Các
  luật của khối `@media (max-width: 640px)` (cỡ chữ tiêu đề, nút xếp chồng 46px, vùng bấm tên, ẩn quan điểm thứ 2–3)
  giữ nguyên.
- Cập nhật docstring đầu `khoi-thao-luan.tsx` (mục "Hai nửa") cho đúng bố cục mới.

### 3.2 Nút chính dùng `--brand`

Ba selector đổi như nhau:

| File | Selector |
|---|---|
| `components/thanh-tai-khoan.module.css` | `.nut_chinh`, `.nut_chinh:hover` |
| `components/khoi-thao-luan.module.css` | `.nut_chinh`, `.nut_chinh:hover` |
| `components/o-soan-nhat-ky.module.css` | `.nut_mo`, `.nut_mo:hover` |

- Nền `var(--brand)`, chữ `var(--on-brand)`.
- Hover: `filter: brightness(1.08)`, chữ vẫn `var(--on-brand)`, nền giữ nguyên. Đây là cách hover của
  `form-dang-mach.module.css .gui`. Sửa luôn `transition` cho khớp (`filter` thay cho `background`).
- **Bỏ hẳn `#ffffff` gõ cứng** ở `thanh-tai-khoan.module.css`. Việc này sửa P-20261110-6.
- Không thêm `box-shadow`: bóng đổ chỉ dành cho nút gửi form.
- Sửa các chú thích còn nói "nền `--ink`", ví dụ chú thích trên `.nut_mo` ở `o-soan-nhat-ky.module.css:49-50`.

### 3.3 Nút bo tròn hẳn (999px)

- `khoi-thao-luan.module.css` `.nut_chinh`, `.nut_phu`: 8px đổi thành 999px, cả ở mobile (cao 46px).
- `o-soan-nhat-ky.module.css` `.nut_ghi` (mobile dính đáy): 8px đổi thành 999px.

Không đụng nút nào ngoài ba file trên.

### 3.4 Hàng rào

**(a) Bài đo hàm thuần mới: `e2e/don-vi/nut-chinh-brand.spec.ts`** (chạy trong `pnpm e2e:don-vi`). Đọc nguồn và bỏ
chú thích trước khi so.

1. Quét **mọi** `*.module.css` dưới `apps/web/components` và `apps/web/app`: không còn dòng khai nền là đúng
   `var(--ink)`. Mẫu khớp: `/background(-color)?\s*:\s*var\(--ink\)\s*[;}]/`. `color-mix(... var(--ink) ...)` ở
   `the-mach.module.css` không khớp mẫu này, và phải không khớp.
2. Mọi khối luật có `background: var(--brand)` **và** có khai `color:` thì `color` phải là `var(--on-brand)`. Áp cả
   cho `:hover`.
3. `border-radius: 999px` ở năm selector: `.nut_chinh` (thanh-tai-khoan), `.nut_chinh` + `.nut_phu`
   (khoi-thao-luan), `.nut_mo` + `.nut_ghi` (o-soan-nhat-ky).
4. `khoi-thao-luan.tsx` render `<time` có `dateTime={b.created_at}` bên trong mục quan điểm.

**(b) Bài đo trình duyệt** (thêm vào `e2e/trang-chu-giao-dien-moi.spec.ts` hoặc file mới, thợ chọn). Chạy trên
`gikky_e2e`, khách chưa đăng nhập, **cả theme sáng và tối**:

- `/` ở viewport 1280: "Đăng ký" (header), "Vào thảo luận" (`chu-de-vao`), nút mở nhật ký (`nut-mo-nhat-ky`). Với mỗi
  nút: `backgroundColor` bằng giá trị tính của `--brand`, `color` bằng giá trị tính của `--on-brand`, tương phản WCAG
  ≥ 4.5. Giá trị token đọc bằng `getComputedStyle(document.documentElement).getPropertyValue`, rồi đổi ra `rgb()` qua
  một phần tử thử.
- `/` ở 390: nút `nut-ghi-nhat-ky-di-dong` cũng như trên.
- `/luat` ở 1280: nút "Đăng ký" như trên, vì header có mặt ở mọi trang.
- Công thức tương phản: viết lại trong file đo, hoặc chuyển `doSang`/`tiSo` từ `e2e/don-vi/tuong-phan.spec.ts` ra
  `e2e/thu-vien.ts` rồi cho `tuong-phan.spec.ts` import lại. **Đừng import thẳng từ file spec khác**: Playwright sẽ
  đăng ký các bài của file đó hai lần.

**(c) Bài đo bố cục** (trình duyệt, 1280, sáng và tối, chủ đề seed có ≥ 2 bình luận gốc):

- Tiêu đề h2 rộng ≥ 90% bề rộng trong của `chu-de-the`.
- `quan-diem-noi-bat` nằm **dưới** nút `chu-de-vao`: mép trên của ô ≥ mép dưới của nút.
- Nền của `quan-diem-noi-bat` bằng giá trị tính của `--inset`.
- Mỗi `quan-diem` đang hiện cao ≤ 44px (một hàng) và có `<time datetime>` khớp `/^\d{4}-\d{2}-\d{2}T/`.
- `chu-de-vao`: `borderRadius` tính ra ≥ nửa chiều cao nút.
- **Bài cũ thành đo rỗng:** `trang-chu-giao-dien-moi.spec.ts:206-210` đếm cột của `chu-de-the` và chờ đúng 1 khi
  chưa có bình luận. Nay khối luôn là 1 cột, nên bài này xanh bất kể đúng sai. Gỡ phần đếm cột, giữ dòng
  `quan-diem-noi-bat` toHaveCount(0), và ghi lý do vào chú thích.

**(d) `e2e/don-vi/tuong-phan.spec.ts`:** thêm hai cặp, đo cả hai theme, ngưỡng AA 4.5:

- `--ink-3` trên `--inset`: ngày và nhãn h3 trong ô quan điểm.
- `--accent` trên `--inset`: link "Xem tất cả quan điểm".

Nếu cặp nào đỏ thì DỪNG và báo, không đổi mã màu.

**Thử phá bắt buộc**, mỗi phép phá xong phải khôi phục đúng file. Kê lại từng phép và kết quả:

| # | Phá | Bài phải đỏ |
|---|---|---|
| P1 | Trả `.nut_chinh` của `thanh-tai-khoan` về `background: var(--ink); color: #ffffff` | (a)1, (b) ở theme tối |
| P2 | Đặt `color: #ffffff` trong `.nut_mo` (giữ nền `--brand`) | (a)2 |
| P3 | Trả `.nut_chinh` của khối thảo luận về `border-radius: 8px` | (a)3, (c) bo góc |
| P4 | Trả lưới `1.25fr 1fr` cho `chu-de-the` | (c) bề rộng h2 và vị trí ô quan điểm |
| P5 | Bỏ `<time>` khỏi mục quan điểm | (a)4, (c) |

## 4. Ràng buộc

- **Chỉ dùng token có sẵn.** Không thêm mã hex: hai bài đo "không mã hex" đang khoá `khoi-thao-luan.module.css` và
  `o-soan-nhat-ky.module.css`. Không dùng `--gain`, `--loss`, `--stamp`.
- **Không đổi giá trị token trong `globals.css`. Không sửa component `Avatar`.**
- **HTML:** chỉ thêm `<time>` trong mục quan điểm. Mọi link và testid trong khối giữ nguyên. HTML giống nhau cho mọi
  UA. `seo-trang-chu.spec.ts` phải xanh mà không sửa bài.
- Không chạm Django, không chạy codegen.
- **e2e chỉ chạy trên `gikky_e2e`**: đặt `DATABASE_URL` và `CI=1` trong **cùng một lệnh** (memory "gikky_dev chứa dữ
  liệu thật"). Kiểm cổng 3000/8000 còn trống trước khi chạy. **Có 5 phiên khác dùng chung checkout này.**
- `pnpm lint` phải 0 warning. Không commit.

## 5. KHÔNG LÀM

- **Avatar chữ cái thay icon xám.** Icon là quyết định áp cho toàn site (`2d5ac08`, 2026-10-22). Đổi lại là việc
  riêng, cần user quyết.
- **Hai nút chọn phe** (P-20261111-9).
- **Nút đặc ở chỗ khác** (trang đăng nhập, khu admin…). Lúc lập plan, grep chỉ thấy 3 chỗ nền `--ink`. Nếu hàng rào
  (a)1 bắt thêm chỗ nào thì DỪNG và báo, không tự sửa.
- **Lớp chết trong `logo.module.css`** (P-20261021-2).

## 6. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| T1 | **Bố cục.** Ở 1280, cả sáng và tối, bài đo §3.4(c) xanh. Ở 390 chỉ hiện 1 quan điểm, trích ≤ 2 dòng. Bài cũ `trang-chu-giao-dien-moi.spec.ts:225-250` xanh. |
| T2 | **Màu nút.** Bài đo §3.4(b) xanh cả hai theme, trên `/` và `/luat`. Ở theme tối, "Đăng ký" có chữ `--on-brand` trên nền `--brand`, tương phản ≥ 4.5, tức P-20261110-6 đã hết. |
| T3 | **Hàng rào.** §3.4(a) và (d) xanh. P1–P5 mỗi phép đỏ đúng bài ghi trong bảng, và đã khôi phục (`git diff` sau khi khôi phục giống trước khi phá). |
| T4 | **Build sạch.** `pnpm lint` 0 warning; `npx tsc --noEmit -p apps/web` sạch; `pnpm build` sạch. Build xong thì khởi động lại `next dev` nếu có (CLAUDE.md). |
| T5 | **Số bài.** `pnpm e2e:don-vi`: tổng số bài = 761 + số bài mới, 0 bài đỏ. e2e đầy đủ trên `gikky_e2e`: không có bài đỏ mới ngoài danh sách nền. Bài đỏ ngoài danh sách thì chạy riêng bài đó với các file của đợt này tạm gỡ (`git stash push -- <đúng các file của đợt>`) để phân định. Bớt đỏ thì kê ra. |
| T6 | **Ảnh chụp.** Chạy W-ANH với `E2E_ANH_CHUP=<thư mục scratchpad>` (`trang-chu-giao-dien-moi.spec.ts:917`), ra 4 ảnh: desktop/mobile × sáng/tối. Báo đường dẫn để phiên chính xem. |

## 7. Rủi ro

- **Khối cao thêm khoảng 120px** nên "Nhật ký mới" bị đẩy xuống. Bài đo màn hình đầu ở mobile
  (`trang-chu-giao-dien-moi.spec.ts:694-699`) chỉ đòi h2 và nút chính nằm trong màn hình đầu. Ở mobile, ô quan điểm
  vốn đã nằm dưới nút, nên không đổi.
- **`filter: brightness` trên `<a>`** tạo một stacking context mới. Nút không có con định vị tuyệt đối nên không ảnh
  hưởng. Nếu thợ thấy khác thì báo.
- **Bài đo đếm trên dữ liệu seed:** chủ đề trên `gikky_e2e` có thể có ít hơn 2 bình luận gốc. Bài cũ đang
  `test.skip` trong ca này. Bài mới §3.4(c) phải tự dựng dữ liệu cần thiết, hoặc skip có lý do; **không được xanh vì
  rỗng**.

## 8. Chia việc

Một thợ (`opus-dev`) làm hết §3: các phần đụng chung `khoi-thao-luan.module.css` và `o-soan-nhat-ky.module.css`, nên
không chia song song được. Sau đó lần lượt nghiệm thu (`nghiem-thu`) rồi phản biện (`phan-bien`), chạy tuần tự, không
cho hai bên cùng thử phá trên một checkout.

## 9. Báo cáo thực thi

**2026-11-12.** Một vòng thợ, sau đó nghiệm thu rồi phản biện, chạy tuần tự. Không có vòng sửa lại.

### Đã làm

- Khối chủ đề chuyển sang xếp chồng. Lớp bọc đổi tên thành `.the`; giữ tên `.trai`/`.phai`, có chú thích lý do.
- Ba nút đặc dùng `--brand`/`--on-brand`, hover bằng `filter: brightness(1.08)`. `.nut_chinh`, `.nut_phu`, `.nut_ghi`
  bo 999px.
- Thêm `<time>` cho mỗi quan điểm. Avatar 24px.
- Bài đo mới:
  - `e2e/don-vi/nut-chinh-brand.spec.ts`: 5 bài, gồm (a)1–4 và một bài chặn liệt kê rỗng.
  - `e2e/khoi-chu-de-nut-brand.spec.ts`: (b) và (c), tự dựng chủ đề tạm rồi dọn đi.
  - Hai cặp tương phản mới ở `tuong-phan.spec.ts`.
  - Gỡ phần đếm cột thành đo rỗng ở `trang-chu-giao-dien-moi.spec.ts`.

### Thợ tự quyết, khác plan

Nghiệm thu chấm cả 7 chỗ là hợp lý:

1. (b) và (c) để ở file mới, không gộp vào `trang-chu-giao-dien-moi.spec.ts`.
2. Phép đo (c) dùng `expect.soft`.
3. Giữ tên lớp `.trai`/`.phai`.
4. Thêm `align-self: stretch` cho h2 và bối cảnh. Thiếu dòng này thì h2 co theo chữ, vì `.trai` đang căn trái.
5. Thêm `max-width: 45%` cho cụm tên/ngày/điểm.
6. Thêm `transition: filter`.
7. Bài (a)2 xét cả `:hover`.

### Kiểm chứng (nghiệm thu tự chạy lại, cây chính)

| Lệnh | Kết quả |
|---|---|
| `pnpm lint` | 0 warning |
| `tsc --noEmit -p apps/web` | exit 0 |
| `pnpm build` | exit 0 |
| `pnpm e2e:don-vi` | **766 passed** (761 nền + 5 bài mới) |
| e2e đầy đủ trên `gikky_e2e` (`DB=gikky_e2e`, `CI=1`) | **1138 passed / 21 failed / 7 skipped / 8 did not run** |

21 bài đỏ trùng khít danh sách nền, không có bài đỏ mới. `seo-trang-chu.spec.ts` xanh mà không phải sửa bài.

### Thử phá

- Thợ chạy P1–P5, mỗi phép đều đỏ đúng bài ghi trong bảng, và `git diff` sau khi khôi phục giống hệt trước khi phá.
- Nghiệm thu tự chạy lại hai phép, cả hai đỏ đúng:
  - P2, biến thể đặt `color` trong khối `:hover`;
  - P4, trả lại lưới hai cột.

### Phản biện

Không có lỗi NẶNG hay VỪA. Các hướng đã soi và thấy sạch:

- Chủ đề tạm không đụng bài khác, vì `workers: 1` và `fullyParallel: false`. Chạy chung 8 file liên quan: 127 passed,
  sau đó DB còn 0 chủ đề tạm.
- Giả định "chỉ có 3 nút nền `--ink`" là đúng.
- Header nền `--bg`, không phải `--topbar`.
- `<time>` render ở server theo giờ VN, không có nguy cơ hydrate lệch.
- Tên, điểm, trích dài và bình luận chỉ có ảnh: không tràn ở 6 cỡ viewport.

Ba điểm NHỎ (hover tối 4.54:1, hàng rào tĩnh hở, `max-width: 45%` chưa có bài giữ) ghi ở sổ P-20261112-8.

### Ảnh

4 ảnh desktop/mobile × sáng/tối nằm trong thư mục scratchpad `anh-viec-18` của phiên. Ảnh không được commit.

### Sổ

- P-20261110-6 chuyển sang ĐÃ VÁ.
- Mở mới: P-20261112-8 (hàng rào), P-20261112-9 (e2e không có chốt tên DB), P-20261112-10 (lặt vặt).

### Còn lại

- Chưa commit, chưa deploy.
- Avatar chữ cái và hai nút chọn phe nằm ngoài việc này.

## 10. Vòng 2: vá ba chỗ hở hàng rào (sổ P-20261112-8), 2026-11-13

User chọn "Vá luôn". **Chỉ sửa bài đo, không đổi CSS hay TSX sản phẩm.** Mọi bài mới phải XANH trên code hiện tại; bài
nào đỏ trên code hiện tại là phát hiện, không phải chỗ để nới.

### 10.1 Hover ở cả hai theme (hở a)

Đo lại 2026-11-13 bằng công thức WCAG, nhân từng kênh sRGB với 1.08 rồi chặn ở 255 (khớp pixel phản biện đọc được:
`[37,99,235]` → `[40,107,254]`):

| Cặp | Thường | Hover `brightness(1.08)` |
|---|---|---|
| `--brand`/`--on-brand` sáng | 5.81 | 5.12 |
| `--brand`/`--on-brand` tối | 5.17 | **4.54** |
| `--accent`/`--on-accent` sáng | 5.81 | 5.12 |
| `--accent`/`--on-accent` tối | 7.84 | 8.78 |

- **(H1) tĩnh**, trong `e2e/don-vi/nut-chinh-brand.spec.ts`: với mọi khối nền đặc `var(--T)` mà bảng token có
  `--on-T` (hiện là `brand` và `accent`), tìm các khối trạng thái của cùng selector (`:hover`, kể cả
  `:hover:not(:disabled)`, ở mọi `@media`) có khai `filter`. Giá trị phải là `brightness(<số>)` hoặc `none`; giá trị
  khác thì đỏ với thông báo "không tính được". Tính tương phản của `brightness(k)·nền` với `brightness(k)·chữ` ở CẢ
  HAI theme, token đọc từ `app/globals.css` (khối `:root` và `:root[data-theme="dark"]`), ngưỡng 4.5. Có chốt đếm số
  khối hover-filter tìm được, để bài không xanh vì rỗng; thợ đo số thật rồi đặt mốc. Có một bài mốc: hàm nhân sáng
  cho `#2563eb`×1.08 phải ra `rgb(40,107,254)`.
- **(H2) trình duyệt**, trong `e2e/khoi-chu-de-nut-brand.spec.ts`: rê chuột lên "Đăng ký", "Vào thảo luận", "Mở nhật
  ký" ở 1280, cả hai theme. Chờ `filter` tính ra hết chuyển tiếp (`expect.poll`), đọc `filter`, `backgroundColor` và
  `color`, nhân kênh theo `k`, rồi ép tương phản ≥ 4.5. Ép luôn `filter` khác `none`, để biết đang đo đúng trạng thái
  hover.

### 10.2 Bài tĩnh hết lọt (hở b)

Tách phần kiểm thành hàm thuần nhận chuỗi CSS, rồi cài từng ca phản biện đã dựng thành ca mẫu ngay trong file. Ca
phải đỏ thì hàm phải báo vi phạm; ca hợp lệ thì hàm phải im.

- Nền họ `--ink` (`--ink`, `--ink-2`, `--ink-3`) ở đầu giá trị `background`/`background-color`, có hoặc không có
  `!important`, đọc theo từng khối (`khoiLuat`). `color-mix(… var(--ink) …)` vẫn KHÔNG khớp. Allowlist đúng một chỗ
  ghim theo file + selector: `components/thanh-dieu-huong-duoi.module.css` `.vung_keo:active .thanh_keo` (thanh kéo
  5px, không có chữ, cần đổi màu theo theme). Có thêm bài ép mục allowlist còn tồn tại, để allowlist không mục.
- Nền `--brand` nhận cả `!important` và `background-color`.
- Lấy MỌI khai báo `color` trong khối (`matchAll`), bỏ `!important` trước khi so; khai nào khác `var(--on-brand)`
  là vi phạm.
- Khối khác cùng selector, ở mọi `@media` và mọi trạng thái, cũng phải theo luật trên. Khớp bằng compound cuối của
  selector sau khi bỏ pseudo-class, nên `.nut_chinh:hover`, `[data-theme] .nut_chinh` và cả cụm `.lien_ket, .nut_chinh`
  đều được tính. Khối nào tự đặt nền KHÁC brand (ví dụ `:disabled` nền xám) thì miễn luật này.
- Biết trước còn một chỗ hở, ghi trong chú thích đầu file: selector con (`.nut_chinh span { color: … }`) không được bắt.

### 10.3 `max-width: 45%` có bài giữ (hở c)

Trong `(c)` của `e2e/khoi-chu-de-nut-brand.spec.ts`: tạo một user TẠM có `display_name` 60 ký tự (đúng mức
`max_length`), là tác giả của một trong hai bình luận tạm. Dọn ở đầu `beforeAll` và trong `afterAll`, giống chủ đề
tạm.

- Ở 1280 và 700, với từng hàng quan điểm đang hiện: `.quan_diem_trich` rộng ≥ 40% `.quan_diem_than`, và
  `.quan_diem_dong` ≤ 45% + 1px. Chống đo rỗng: tên của user tạm phải đang bị cắt (`scrollWidth > clientWidth`).
- Ở 390, nếu hàng của user tạm đang hiện: ngày không bị đẩy ra ngoài hàng, và hàng không tràn ngang.

### 10.4 Phạm vi file

Được sửa:
- `apps/web/e2e/don-vi/nut-chinh-brand.spec.ts`
- `apps/web/e2e/khoi-chu-de-nut-brand.spec.ts`

Được thêm một helper đọc token, ví dụ `apps/web/e2e/don-vi/token.ts`. Lý do: Playwright cấm file spec import file spec
khác, nên `docToken` phải chuyển từ `tuong-phan.spec.ts` sang helper, và `tuong-phan.spec.ts` import lại từ đó. Chỉ
được chuyển, không đổi logic.

Không file nào khác.

### 10.5 Tiêu chí nghiệm thu vòng 2

| # | Lệnh | Mong đợi |
|---|---|---|
| V1 | `pnpm lint` · `cd apps/web && npx tsc --noEmit` | 0 warning, 0 lỗi |
| V2 | `pnpm e2e:don-vi` | Xanh hết, số bài = 766 + số bài mới. `tuong-phan.spec.ts` giữ đúng số bài cũ |
| V3 | e2e trình duyệt hai file `khoi-chu-de-nut-brand` + `trang-chu-giao-dien-moi` trên `gikky_e2e` | Xanh. DB còn 0 chủ đề tạm và 0 user tạm |
| V4 | Thử phá, mỗi phép đỏ đúng bài, khôi phục xong `git diff` giống trước | Bảng dưới |

| Phép | Sửa tạm | Phải đỏ |
|---|---|---|
| Q1 | Một `.nut_chinh:hover` đổi `brightness(1.08)` → `brightness(1.2)` | H1 và H2 |
| Q2 | `thanh-tai-khoan.module.css`: thêm `color: #fff` vào khối `(pointer: coarse)` | 10.2 |
| Q3 | Một nút đổi nền thành `var(--ink-2) !important` | 10.2 |
| Q4 | Thêm `color: #fff` thứ hai sau `color: var(--on-brand)` trong cùng khối | 10.2 |
| Q5 | Xoá `max-width: 45%` của `.quan_diem_dong` | 10.3 |

Lưu ý thử phá Q1/Q5 cần build lại, nên chạy tuần tự, không chạy song song với agent khác trên cùng checkout.

### 10.6 Báo cáo thực thi vòng 2

**Đã làm.** Chỉ sửa bài đo. `git diff --stat` của 4 file sản phẩm giữ nguyên như sau vòng 1.
- `e2e/don-vi/nut-chinh-brand.spec.ts`:
  - tách thành hàm thuần `kiemNenInk`, `kiemChuTrenBrand`, `kiemHoverFilter`;
  - thêm các hàm phụ `tachCum`, `khaiDu`, `tokenDau`, `gocChon`, `capNenChu`;
  - có ca mẫu, allowlist một mục `.thanh_keo`, và hai chốt đếm (13 khối nền brand, 11 khối hover-filter).
- `e2e/khoi-chu-de-nut-brand.spec.ts`:
  - H2 rê chuột lên 3 nút ở cả hai theme;
  - `kenh()` ném lỗi khi alpha < 1;
  - user tạm có tên 60 ký tự, đo ở 1280/700/390.
- `e2e/don-vi/token.ts` mới: chứa `docToken`, chuyển nguyên văn từ `tuong-phan.spec.ts`.

**Đổi hướng so với §10.** Có hai lượt sửa sau khi phản biện tìm thêm hở.
- Lượt 1 vá 5 điểm:
  - (VỪA) khối trạng thái tự đổi nền thì được miễn trắng, nên hover sang `--accent` với `#fff` lọt (2.41:1);
  - `gocChon` không bỏ `[…]`;
  - khối brand không khai `color` thì lọt;
  - nền viết kiểu `var(--brand) url()` / fallback / `! important` không được nhận;
  - H2 bỏ qua alpha.
- Lượt 2 vá:
  - (VỪA) khối đổi nền mà không khai `color` thì lọt;
  - nhánh nền ngoài cặp nhận cả `--on-*`;
  - thiếu ca giữ `tachCum`;
  - một dòng đo rỗng trên `mat-bao`;
  - chốt khối brand nâng từ ≥ 8 lên 13.
- Dừng ở lượt 2, đúng mức tối đa của quy trình. Hở còn lại ghi ở sổ P-20261113-5.

**Thợ tự quyết, nghiệm thu chấp nhận:**
- `gocChon` giữ pseudo-element, vì `::after` là hộp riêng;
- ở 390, ép hàng của user tạm phải ĐANG hiện;
- H1 xét mọi khối có `filter` cùng gốc;
- hai chốt đếm so `≥`.

**Kiểm chứng.** Nghiệm thu tự chạy lại sau từng lượt, trên cây chính.

| Lệnh | Kết quả lượt cuối |
|---|---|
| `pnpm lint` | 0 warning |
| `npx tsc --noEmit` | exit 0 |
| `pnpm e2e:don-vi` | **772 passed** (nền 766: +5 ở bản đầu, +1 ở lượt 1). `tuong-phan` vẫn 4 bài |
| e2e trình duyệt `khoi-chu-de-nut-brand` + `trang-chu-giao-dien-moi` trên `gikky_e2e`, `CI=1` | **77 passed, 1 skipped** (W-ANH), chạy ở lượt 1. DB còn 0 chủ đề tạm, 0 user tạm. Lượt 2 không đụng file này (hash giữ nguyên) |

**Thử phá.**
- Thợ chạy đủ Q1–Q5 trên file sản phẩm thật, mỗi phép đỏ đúng bài. Thợ chạy thêm các ca phản biện, cũng trên file thật.
- Nghiệm thu tự chạy lại Q1, Q2, Q4, Q5 và phá H2 trên trình duyệt (nền hover `rgb(0,128,0)`, `transparent`).
- Lượt cuối có 11 đột biến bài đo (m1…m7, chạy trên bản sao ngoài repo), tất cả đỏ.
- Sau mỗi phép, `git diff` của file sản phẩm giống hệt bản trước.

**Phản biện.** Ba lượt, không có lỗi NẶNG. Lượt 1 và lượt 2 mỗi lượt tìm ra một hở VỪA, đều đã vá.
- Mô hình độ sáng nhân trong sRGB là phía bi quan: nếu trình duyệt tính trong linearRGB thì tương phản ra cao hơn (tối 4.86). Phản biện không có trình duyệt nào ngoài Chromium để kiểm.
- Ý kiến về giả định của plan: giữ hover 4.54 là hợp phạm vi vòng 2. Đổi hướng hover là quyết định của user, ghi ở sổ P-20261113-6.

**Sổ.**
- P-20261112-8 chuyển sang ĐÃ VÁ.
- Mở mới: P-20261113-5 (hở còn lại), P-20261113-6 (hướng hover), P-20261113-7 (lặt vặt).
- Ý "pnpm nhân đôi `\`" trùng với P-20261112-10(b), không ghi lại.

**Còn lại.** Code commit ở `4ed45b5`, chưa deploy. Thử phá cần build đã để `apps/web/.next` được build lại nhiều lần; lần cuối do nghiệm thu build sạch.
