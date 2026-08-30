# Lối vào tìm kiếm trên mobile — icon kính lúp trong header

Chốt 2026-08-30. User báo: *"khi xem trên mobile, không thấy search"*.

## 0 · Bệnh — đo được, không phải cảm nhận

1. `apps/web/components/o-tim-kiem.module.css:46-52` ẩn hẳn ô tìm dưới **860px**, kèm
   ghi chú *"Ẩn ô, KHÔNG bỏ hẳn tính năng: trang `/tim-kiem` vẫn vào được"*.
2. Nhưng `grep -rn 'href="/tim-kiem' apps/web --include="*.tsx"` = **0 kết quả** — cả
   app không có một link nào tới `/tim-kiem`. Lối vào duy nhất là chính ô tìm trong
   header ⇒ dưới 860px, tính năng tìm kiếm **không có lối vào nào** ngoài gõ tay URL.
   Câu ghi chú ở (1) đúng về mặt chữ và sai về mặt sản phẩm.

## 1 · Sửa gì

**`apps/web/components/chrome.tsx`** — thêm một `<Link href="/tim-kiem"
aria-label="Tìm mạch">` mang icon `Search` của `lucide-react` (đúng icon ô tìm đang
dùng, xem `o-tim-kiem.tsx:50`) vào **đầu cụm `.phai`** (trước `NutDangMach`).

- `Chrome` là server component — `Link` + icon lucide đều render được ở RSC, **không**
  thêm `"use client"`, không thêm hook: giữ nguyên ràng buộc "/luat phải là route tĩnh"
  ghi ở docstring đầu file.
- `/tim-kiem` có ô nhập riêng (`data-testid="o-tim-kiem-trang"`), nên icon chỉ cần dẫn
  tới đó — không dựng ô nhập xổ ra trong header (to hơn hẳn, không ai yêu cầu).

**`apps/web/components/chrome.module.css`** — class mới `.nut_tim` cho link ấy:

- Mặc định `display: none`; trong `@media (max-width: 860px)` hiện lên — **đúng cùng
  mốc** với chỗ ẩn ô tìm, để không bao giờ có màn hình vừa có ô vừa có icon, hay vừa
  không có cả hai. Ghi chú ở hai file phải trỏ nhau (cùng khuôn `.cho_o_tim` đang làm).
- Hình dạng theo icon lân cận trong cụm phải (`Chuong`, `CongTacTheme`): màu
  `var(--ink-2)`-họ token có sẵn, không màu ứng biến, KHÔNG đụng `--stamp`
  (`mau-token.spec` chỉ soi `--stamp` theo selector — không phải sửa allowlist).
- Vùng bấm không nhỏ hơn các nút icon lân cận (chú thích T7/trợ năng ở `.trong` đã cấm
  vùng bấm co dưới 44px khi nén).
- Cập nhật ghi chú tại `o-tim-kiem.module.css:47` — câu "vẫn vào được" nay có chỗ dựa
  thật (icon), đừng để nó tiếp tục nói về một lối vào không tồn tại.

**Bài đo mới** — `apps/web/e2e/don-vi/` (nhóm đọc-nguồn, cùng khuôn các spec hiện có):
ghim (a) `chrome.tsx` có link `href="/tim-kiem"`; (b) CSS của nó ẩn mặc định và hiện ở
đúng mốc `max-width: 860px` — cùng con số với chỗ ẩn ô tìm (đọc cả hai file, so MỘT
hằng số, để ai đổi 860 một phía là đỏ). Đặt vào file spec sẵn có nếu có chỗ hợp
(`dem-luot-xem.spec.ts` KHÔNG hợp — nó về đường đếm), không thì file mới
`loi-vao-tim-kiem.spec.ts`.

## 2 · KHÔNG làm

- Không dựng thanh tìm xổ xuống / modal tìm trên mobile — to gấp mười, chưa ai hỏi.
- Không thêm link `/tim-kiem` vào sidebar/chân trang (mở rộng phạm vi; ghi nhận là ý
  tưởng, không làm).
- Không đổi ba mốc responsive hiện có (860/640/420) — chỉ cắm thêm vào mốc 860.

## 3 · Tiêu chí nghiệm thu — ĐO ĐƯỢC

Nền: e2e don-vi **381 bài, 380 xanh** — 1 bài đỏ CÓ SẴN ở HEAD (`trang-loi.spec.ts` #14,
sổ `P-20260830-1`), KHÔNG tính vào lượt này. pytest không liên quan (không sửa Python).

| # | Tiêu chí | Đo bằng |
|---|---|---|
| M1 | `chrome.tsx` có `Link` tới `/tim-kiem`, KHÔNG có `"use client"` mới, không hook mới | đọc diff |
| M2 | CSS: icon ẩn mặc định, hiện ≤860px — cùng MỘT mốc với chỗ ẩn ô tìm | đọc diff + bài đo (b) |
| M3 | Bài đo mới xanh, và ĐÃ THỬ PHÁ: gỡ link khỏi `chrome.tsx` ⇒ đỏ; đổi 860 một phía ⇒ đỏ | báo cáo kèm tên bài |
| M4 | `pnpm lint` 0 warning · `pnpm build` xanh cả 2 app · `/luat` vẫn đúng trạng thái build hiện tại | chạy lại |
| M5 | `pnpm e2e:don-vi`: số bài ≥ 382, đỏ ĐÚNG 1 bài (#14 có sẵn) | chạy lại |
| M6 | Kiểm mắt thật ở khung nhìn mobile (375px): icon hiện, bấm ra `/tim-kiem`, ô nhập của trang dùng được; 360px không cuộn ngang; >860px icon biến mất, ô tìm như cũ | phiên chính làm ở chặng 5 bằng browser preview |

## 4 · Ràng buộc tài nguyên

- opus-dev: sửa + lint + build + e2e:don-vi; **KHÔNG chạy dev server** (kiểm mắt là việc
  chặng 5 — tránh bẫy "`pnpm build` PHÁ `next dev` đang chạy" trong CLAUDE.md).
- nghiem-thu: được chạy lint/build/e2e:don-vi, một bộ một lúc. phan-bien: chỉ đọc.
- CẤM đụng: `apps/web/components/form-tai-khoan.*`, `ket-qua-tim-kiem.module.css`,
  `the-mach.module.css`, `trang-mach.module.css` (phiên khác đang dở) · `pnpm e2e` trần.

## 5 · Nhật ký

### opus-dev — 2026-08-30, cây CHÍNH (không worktree)

**File sửa/tạo (3 sửa + 1 tạo):**

- `apps/web/components/chrome.tsx` — thêm `import { Search } from "lucide-react"`; một
  `<Link href="/tim-kiem" className={css.nut_tim} title/aria-label="Tìm mạch"
  data-testid="nut-tim-kiem">` mang `<Search size={16} strokeWidth={1.9} aria-hidden />`
  vào ĐẦU cụm `.phai`; một khối docstring giải thích lối vào. Không `"use client"`, không
  hook, không lib mới.
- `apps/web/components/chrome.module.css` — `.nut_tim` (+ `:hover`, `:focus-visible`):
  `display: none` mặc định, hộp 32×32 `border-radius: 8px` `color: var(--ink-3)` chép theo
  `.khung` của `cong-tac-theme.module.css`; `@media (pointer: coarse)` nới 44×44; hiện
  `inline-flex` trong **khối `@media (max-width: 860px)` sẵn có** (cùng khối đang rút lưới
  `.trong`). Không màu ứng biến, không đụng `--stamp`.
- `apps/web/components/o-tim-kiem.module.css` — ghi chú ở mốc 860 nay trỏ sang `.nut_tim`
  và nói rõ hai con số phải bằng nhau.
- `apps/web/e2e/don-vi/loi-vao-tim-kiem.spec.ts` **(mới)** — 6 bài đọc-nguồn.

**Icon size 16/strokeWidth 1.9** (không phải 15/2 của ô tìm): nó đứng cạnh `CongTacTheme`
trong cùng cụm `.phai`, và hai icon cạnh nhau lệch kích thước thì mắt thấy ngay.

**M1 ĐẠT** — diff trên: `Link` + `Search`, `chrome.tsx` không có `"use client"`, không hook.
Bài `A — link ấy KHÔNG kéo chrome.tsx sang client` ghim chuyện đó.

**M2 ĐẠT** — `.nut_tim` ẩn mặc định; ba con số (ẩn `.o`, ẩn `.cho_o_tim`, hiện `.nut_tim`)
đều 860, bài `B — MỘT mốc duy nhất` so cả ba.

**M3 ĐẠT** — 6 bài mới xanh. Thử phá 3 ca, mỗi ca khôi phục ngay sau khi đo:

| Ca | Phá gì | Kết quả |
|---|---|---|
| 1 | Gỡ hẳn khối `<Link href="/tim-kiem">` khỏi `chrome.tsx` | ĐỎ đúng 1 bài: `A — chrome.tsx có link tới /tim-kiem` (`loi-vao-tim-kiem.spec.ts:85`); 17 bài còn lại xanh |
| 2 | `o-tim-kiem.module.css` 860 → 900 (một phía) | ĐỎ `B — MỘT mốc duy nhất` (`:109`), thông điệp *"ô tìm ẩn ở 900px, chỗ giữ ẩn ở 860px, icon hiện ở 860px"* |
| 3 | `chrome.module.css` khối `.nut_tim` 860 → 900 (phía kia) | ĐỎ cùng bài `:109`, *"icon hiện ở 900px"* — hàng rào đối xứng, không chỉ bắt một chiều |

**M4 ĐẠT** — `pnpm lint`: cả `@gikky/web` lẫn `@gikky/admin` sạch, `--max-warnings=0`, 0
dòng output. `pnpm build`: xanh cả 2 app.

⚠ **`/luat` là `ƒ` (Dynamic), KHÔNG phải `○`** — và **không phải do lượt này**. Đã đo A/B
trong cùng cây: lui 3 file về HEAD, `pnpm --filter @gikky/web build` ⇒ `/luat  ƒ  566 B
106 kB`; với bản vá ⇒ **y hệt** `ƒ  566 B  106 kB`. Nguyên nhân là nợ đang mở
`P-20260830-1`: `app/luat/page.tsx` có `force-dynamic`, đúng thứ `trang-loi.spec.ts` #14
đang đỏ vì nó. Docstring `chrome.tsx` ("`pnpm build` xác nhận `/luat` đang là `○`") vì thế
đang nói về một trạng thái không còn đúng — để nguyên, ngoài phạm vi.

**M5 ĐẠT** — `pnpm e2e:don-vi` nguyên văn: **387 bài, 386 xanh, 1 đỏ**. Bài đỏ đúng là
`trang-loi.spec.ts:261 #14` có sẵn ở HEAD (`P-20260830-1`). Nền 381 + 6 bài mới = 387,
khớp.

**M6** — chưa làm, đúng phân công: kiểm mắt là việc chặng 5 (không chạy dev server).

### Chặng 5 — phiên chính chốt việc (2026-08-30)

**Nghiệm thu: 5/5 M1–M5 ĐẠT** (số tự đo trùng số opus-dev khai). **M6 — kiểm mắt của
phiên chính, qua cây trợ năng** (screenshot/JS của browser pane bị chặn quyền): 375px —
link "Tìm mạch" trong cây interactive, ô tìm header VẮNG; 1280px — ngược lại đúng đối
xứng; `/tim-kiem` đủ ô nhập + lọc chuyên mục + nút Tìm; console sạch. Chưa đo được bằng
số: cuộn ngang 360px (chuyển cho T7 bên dưới) và thao tác bấm thật (xác nhận trên máy
user sau deploy).

**Phản biện ra 6 phát hiện — chặng 5 xử 5, ghi sổ phần còn lại:**

| Phát hiện | Xử lý |
|---|---|
| VỪA — icon sống nhờ THỨ TỰ nguồn giữa 2 khối `@media 860`; "dọn dẹp" gộp khối về đầu file là icon chết mà 6/6 bài vẫn xanh (phản biện dựng được ca thật) | **SỬA**: gộp về MỘT khối 860 duy nhất đặt SAU luật gốc, comment nói rõ ràng buộc; bài đo mới `B — ĐÚNG MỘT khối 860, đứng SAU luật gốc` (đếm + so vị trí trên nguồn đã bỏ comment). Thử phá: chèn khối 860 thứ hai ⇒ ĐỎ. |
| VỪA (nghi ngờ) — nhánh `pointer: coarse` 44px làm `.phai` nở 12px trên đúng dải 421–520px không có `flex-wrap` (iPhone Plus/Max 428/430) và áp lực co dồn vào chính hai vùng bấm | **SỬA**: 44×44 + `margin: -6px` — vùng bấm giữ 44px, phần chiếm chỗ về đúng 32px như nhánh chuột ⇒ hai nhánh cùng một phép tính bề ngang, dải 421–520 hết khác biệt. |
| VỪA — T7 (hàng rào 360px duy nhất) không chạy lượt này, và danh sách trang của nó thiếu `/tim-kiem` — nay là ĐÍCH của lối vào mobile | **SỬA + CHẠY**: thêm `/tim-kiem` vào `giao-dien.spec.ts::T7`; chạy full `pnpm e2e` trỏ `gikky_e2e` qua `DATABASE_URL` (đúng luật memory — không bao giờ e2e trần vào `gikky_dev`). Kết quả ghi ở báo cáo. |
| NHỎ — bài A vá lần một vẫn hở: `className={css.nut_tim}` "có mặt đâu đó" là đủ xanh | **SỬA**: phép so gói trong MỘT thẻ mở `<Link …href="/tim-kiem"…>` (regex `[^>]*` không vượt được `>`), bất kể thứ tự thuộc tính. Thử phá: dời class sang `<Search>` ⇒ ĐỎ (chuỗi vẫn còn trong file). |
| NHỎ — comment "cụm phải ≈254px" là căn cứ chọn mốc 420 nay hụt 40px | **SỬA**: cập nhật thành ~294px kèm chú vì sao con số 254 của phép tính lưới >860 vẫn đúng (icon `display:none` ở đó). |
| NHỎ — lệch tâm ô tìm ở 861–950px (không do bản vá) · docstring `/luat ○` sai (mảnh của P-20260830-1) · `data-testid="nut-tim-kiem"` chưa ai dùng | **GHI SỔ** `P-20260830-6`, `P-20260830-7`; data-testid giữ làm bề mặt cho bài đo trình duyệt sau. |

Chốt của nghiệm thu (bài A thiếu ghim `className`) cũng đã SỬA + thử phá (gỡ class ⇒ ĐỎ)
— chính là nửa đầu của mục bài-A ở bảng trên.

**Thử phá chặng 5: 3/3 ĐỎ đúng bài** (gỡ/chuyển class ×2, chèn khối 860 thứ hai ×1), đều
khôi phục. **Số đo sau chặng 5**: don-vi **388 bài / 387 xanh / 1 đỏ có sẵn** (#14,
`P-20260830-1`) · lint 0 warning · full e2e trên `gikky_e2e` — số ở báo cáo cuối.
