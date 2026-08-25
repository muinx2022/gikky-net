# Mặt BÃO: mốc 1 LUÔN hiện (bỏ ca "gập giấu đúng 1 mốc")

Chốt 2026-08-24 — user duyệt trực tiếp trong phiên.

## Vấn đề

Mạch **2 mốc** ở mặt BÃO chỉ hiện mốc 2; mốc 1 nằm sau nút `mở cả mạch ▾`.
`components/mat-bao.tsx` không hề đếm mốc để quyết định gập — nó **luôn** chỉ render
`mocMoiNhat` khi `mo === false`, và chỉ dùng `so_moc > 1` để quyết có hiện nút hay không.

Hai hệ quả:

1. **Người đọc không biết mạch nói về cái gì.** Mốc 1 là bài gốc — chính `body` của nó
   được `trang-mach.tsx::tomTat` dùng làm `meta description` của trang. Ở mặt BÃO, thứ
   duy nhất hiện lại là mốc mới nhất, thường là một câu nối tiếp không tự đứng được
   ("Ngày hnay mới vào lệnh xong, lại bị atc dụ dỗ…").
2. **Ca `n = 2` là lỗ thuần.** Giấu đúng 1 mốc sau một cái nút cao gần bằng chính nó,
   cộng một hàng khung. Đây đúng lập luận user đã duyệt cho mặt CẶN ngày 2026-08-22
   (`NGUONG_KHONG_GAP = 5`: chỉ gập khi giấu được ≥ 2 mốc) — chưa ai áp sang mặt BÃO.

## Quyết định

Mặt BÃO khi còn gập hiện **mốc 1 + mốc mới nhất**, dải gập nằm GIỮA hai cái đó.

```
①──②──③──④──⑤──⑥                     ← spine, không đổi
┌────────────────────────────┐
│ ① bài gốc                  │       ← MỚI: luôn hiện
└────────────────────────────┘
  ▤ Mốc 2–5 · 4 mốc · mở cả mạch ▾   ← MỚI: dải gập nằm ĐÚNG chỗ nó giấu
┌────────────────────────────┐
│ ⑥ mốc mới nhất             │
└────────────────────────────┘
```

Công thức: `gập seq 2 … n−1, hiện [1, n]`; **`n ≤ 2` ⇒ KHÔNG gập** (không giấu được gì).

**Vì sao ngưỡng là 2 chứ không phải 3 như lập luận "giấu ≥ 2 mốc" của mặt CẶN:** hai mặt
có hình dạng khác nhau. CẶN hiện 4 mốc (1, n−2, n−1, n) nên ở `n = 5` cái nút chen vào
giữa một danh sách gần như đầy đủ. BÃO hiện đúng 2 mốc ở mọi `n`, nên luật "luôn đúng hai
thẻ, phần giữa nằm sau một dòng" là thứ đọc ra được và đoán trước được; hạ xuống còn 1 thẻ
hay nhảy lên 3 thẻ tuỳ `n` mới là cái khó đọc. Ca `n = 3` giấu 1 mốc và **vẫn gập** vì
thế.

**Vạch mới không đổi:** vẫn chỉ vẽ trong timeline đã bung (PLAN 5.5 nói đúng vậy), không
chen vào giữa hai thẻ ở trạng thái gập.

## Việc phải làm

### 1. `apps/web/lib/dai-gap.ts` — thêm công thức BÃO
- `tinhDaiGapBao(entryCount): DaiGap` — `n ≤ 2` ⇒ `{gap:false, seqHien:[1..n]}`;
  ngược lại `{gap:true, seqDau:2, seqCuoi:n−1, soMoc:n−2, seqHien:[1, n]}`.
- Tái dùng type `DaiGap`, `trongDaiGap`, `nhanKhoangMoc` đang có.
- Docstring nêu rõ nó **KHÔNG** phải `tinhDaiGap` và vì sao hai công thức khác nhau
  (BÃO: nhật ký là ngữ cảnh · CẶN: nhật ký là thân bài).
- `nhanKhoangMoc` có nhánh `seqDau === seqCuoi` → `"Mốc 2"`; docstring của nó đang ghi
  "**dù `tinhDaiGap` không còn sinh ra nó**". Với `tinhDaiGapBao(3)` nhánh ấy **nay
  sống thật** — sửa lại docstring cho đúng, đừng để một chú thích sai nằm lại.

### 2. `apps/web/components/mat-bao.tsx`
- Bỏ prop `mocMoiNhat`; suy ra từ `tatCaMoc` (`[0]` và phần tử cuối). Lý do: nay cần cả
  hai đầu, giữ hai nguồn cho cùng một danh sách là chỗ để trôi.
- Trạng thái **gập** (`mo === false`) render đúng thứ tự: thẻ mốc đầu → hàng dải gập →
  thẻ mốc cuối. Không gập được (`tinhDaiGapBao(so_moc).gap === false`) ⇒ render mọi thẻ
  trong `tatCaMoc`, **không** hàng dải gập, **không** nút.
- Trạng thái **bung** giữ nguyên hoàn toàn: timeline đầy đủ + vạch mới + nút ở cuối.
- **Đúng MỘT** phần tử mang `data-testid="nut-mo-ca-mach"` ở mọi trạng thái: lúc gập nó
  là nút trong hàng dải gập (nhãn `▤ {nhanKhoangMoc} · {soMoc} mốc · mở cả mạch ▾`), lúc
  bung nó là nút `thu lại ▴` ở cuối như cũ. `aria-expanded` bám theo `mo`.

> ### ⚠ LỆCH CÓ CHỦ ĐÍCH so với hai gạch đầu dòng ngay trên — chốt sau lượt phản biện
>
> Hai câu "nút `thu lại ▴` **ở cuối** như cũ" là **SAI** và code cố ý không làm theo. Bản
> đầu cài đúng chữ ấy: nút trong dải gập lúc gập, nút khác ở cuối khung lúc bung. Hai node
> khác nhau dùng chung `data-testid` ⇒ bài đo `.click()` vẫn xanh, còn người dùng bàn phím
> bấm Enter thì **nút đang giữ focus bị unmount**: `activeElement` rơi về `<body>`, lần Tab
> kế đi lại từ đầu tài liệu, `aria-expanded="true"` nằm trên một node chưa bao giờ nhận
> focus. Đó **đúng** lỗi vá C3 đã sửa cho mặt CẶN ngày 2026-08-22 và ghi thành chữ ở
> `components/dai-gap.tsx`. Đường gập lại cũng bị đẩy xuống đáy một mạch 20 mốc.
>
> **Cái được cài thay vào:** MỘT `<button>` duy nhất, **luôn** nằm trong hàng dải gập khi
> `dai.gap`, đổi nhãn `▤ … mở cả mạch ▾` ↔ `▴ gập lại`, có `aria-controls`; mốc giữa nằm
> sẵn trong HTML, chỉ ẩn bằng `hidden` (cùng lối `DaiGapBung`). `.hang_nut` trong CSS bị
> xoá theo. Bài đo mới ghim đúng chuyện này: `toHaveCount(1)` + `toBeFocused()` +
> `aria-expanded` trên **cùng một locator** sau cú bấm (xem N9).
- Nhãn dải gập tính từ `spine.length` (= `entry_count`, đúng bằng số ô spine) — cùng
  nguồn mà mặt CẶN dùng, không phải `tatCaMoc.length`.
- Thêm `data-testid="dai-gap-bao"` cho hàng dải gập để bài đo ghim được.

### 3. `apps/web/components/trang-mach.tsx`
- Bỏ đối số `mocMoiNhat` ở lời gọi `<MatBao>`. Không đụng nhánh mặt CẶN.

### 4. `apps/web/components/mat-bao.module.css`
- Style hàng dải gập bằng token TRUNG TÍNH đã có (`--f-mono`, `--line`, `--inset`,
  `--ink-2`, `--ink-3`). **Cấm** màu ứng biến và **cấm** `--stamp/--gain/--loss`
  (PLAN 9.1 + allowlist `e2e/don-vi/mau-token.spec.ts` ghim tới từng selector).

### 5. Bài đo
- `e2e/don-vi/dai-gap.spec.ts`: nhóm mới cho `tinhDaiGapBao`. Số **gõ tay từ plan này**,
  cấm dựng kỳ vọng từ chính hàm đang đo (đúng luật đã ghi ở đầu file đó):
  `n=1,2` không gập · `n=3` gập `2…2`, `soMoc=1`, nhãn `"Mốc 2"`, hiện `[1,3]` ·
  `n=6` gập `2…5`, `soMoc=4`, nhãn `"Mốc 2–5"`, hiện `[1,6]` ·
  một bài ghim `tinhDaiGapBao(9) ≠ tinhDaiGap(9)` để hai công thức không bị ai gộp lại.
- `e2e/phase-3.spec.ts` **P0** (mạch 2 mốc): mốc 1 **và** mốc 2 cùng hiện ngay, không
  cú click; `nut-mo-ca-mach` và `dai-gap-bao` phải có **count 0**.
- `e2e/phase-3.spec.ts` **P5** (mạch 3 mốc): trước khi bấm — mốc 1 hiện, mốc 3 hiện,
  **mốc 2 ẩn**; nút còn đó; phần vạch mới + `/seen` giữ nguyên từng chữ.
- `e2e/form-ghi.spec.ts` B2 và `e2e/tai-khoan-va-ghi.spec.ts` (cả hai là mạch 2 mốc):
  bỏ cú `nut-mo-ca-mach.click()`, khẳng định `moc-1` có `data-kieu="mach"` ngay.

### 6. `PLAN.md`
- 5.5 gạch đầu dòng "Mặt BÃO": đổi "thẻ mốc mới nhất mở sẵn" → "thẻ **mốc 1** + thẻ mốc
  mới nhất mở sẵn, dải gập nằm giữa", ghi công thức `2…n−1` và ngưỡng `n ≤ 2`.
- Wireframe 9.2 (quanh dòng 850): vẽ lại khối cho khớp.
- Ghi ngày chốt + lý do (mốc 1 = bài gốc = `meta description`).

## Tiêu chí nghiệm thu (ĐO ĐƯỢC)

| # | Tiêu chí | Cách đo |
|---|---|---|
| N1 | Lint sạch | `pnpm --filter @gikky/web lint` → 0 error, 0 warning |
| N2 | Build sạch | `pnpm --filter @gikky/web build` → xanh, 0 warning |
| N3 | Đơn vị xanh, **không hụt bài** | `pnpm e2e:don-vi` → **≥ 296 + số bài mới** passed, 0 failed. Nền TRƯỚC khi sửa đo lúc 2026-08-24 là **296 passed** |
| N4 | e2e đầy đủ xanh | `pnpm e2e` → 0 failed |
| N5 | Thử phá 1 | Sửa `tinhDaiGapBao` trả `gap:false` với mọi `n` ⇒ bài `n=6` trong `dai-gap.spec.ts` phải ĐỎ. Khôi phục |
| N6 | Thử phá 2 | Trong `mat-bao.tsx` trạng thái gập, bỏ thẻ mốc đầu ⇒ **P5** của `phase-3.spec.ts` phải ĐỎ. Khôi phục |
| N7 | Thử phá 3 | Đổi ngưỡng `n ≤ 2` thành `n ≤ 1` ⇒ **P0** phải ĐỎ (mạch 2 mốc lại mọc ra nút). Khôi phục |
| N8 | Không đụng việc của phiên khác | `git status --porcelain` — ngoài các file của việc này (`lib/dai-gap.ts`, `lib/vach-moi.ts`, `components/mat-bao.tsx`, `components/mat-bao.module.css`, `components/trang-mach.tsx`, 4 file spec, `PLAN.md`, plan này) không có file nào đổi trạng thái so với ảnh chụp đầu phiên |
| N9 | Thử phá 4 | Ép nút dải gập remount (`key={mo ? "a" : "b"}`) ⇒ **P5** phải ĐỎ. Đây là lượt chứng minh `toBeFocused()` không phải bài đo trang trí — nút remount vẫn `count 1`, vẫn `aria-expanded="true"`, `moc-2` vẫn hiện, nên **chỉ** vế focus phân biệt được. Khôi phục |

**N6 viết SAI ở bản đầu** ("P0 **và** P5 phải đỏ") và đã sửa lại thành cặp `N6 → P5` ·
`N7 → P0`. Lý do: mạch của P0 có **2 mốc**, `tinhDaiGapBao(2).gap === false` nên nó rẽ
sang nhánh `else` và **không bao giờ** đi vào nhánh gập — phá nhánh gập không thể làm P0
đỏ. Ai chạy lại đúng chữ bản đầu sẽ kết luận sai về chính bài đo của mình.

### Hai việc DÔI ra so với §1–§6, đều bắt buộc

- **`apps/web/lib/vach-moi.ts`** (chỉ docstring): đầu file chép nguyên văn câu PLAN 5.5
  *"thẻ mốc mới nhất mở sẵn"* — câu mà việc này vừa viết lại. Trích dẫn lệch với nguồn thì
  người sau tin bản chép chứ không đi mở nguồn.
- **`e2e/phase-3.spec.ts` P8**: `getByTestId("menu-moc").first()` → khoanh vùng theo
  `moc-3`. Trước lượt này mặt BÃO gập chỉ để MỘT thẻ trong DOM nên `.first()` là mốc mới
  nhất; mốc 1 render trước làm nó lặng lẽ đổi sang đo menu của mốc 1. Bài vẫn xanh (chủ
  mạch là tác giả cả hai mốc) nhưng thành bài đo rỗng đúng vào ngày `MOC-THIEU-AUTHOR`
  được trả.

## Ràng buộc tài nguyên (chặng 3 & 4 chạy song song)

- `nghiem-thu`: được chạy `pnpm --filter @gikky/web build`, `lint`, `pnpm e2e:don-vi`,
  `pnpm e2e` — **một bộ tại một thời điểm**.
- `phan-bien`: **CẤM** `pnpm e2e` và `pnpm build` (chiếm cổng 3000/8000 và GHI vào
  `gikky_dev`). Được đọc code và chạy `pnpm e2e:don-vi`.

## Việc DÔI thứ ba: `<li>` lồng `<li>` — hydration error thật, tìm ra bằng trình duyệt

`TheMoc` **tự render `<li>`** (`components/the-moc.tsx:62`). Mặt CẶN biết điều đó và đặt
`the_moc(...)` **thẳng** vào `<ol>` (`trang-mach.tsx:358`). Mặt BÃO thì bọc thêm một
`<li className={css.hang_bung}>` — có từ bản gốc của khung này, không phải lượt sửa hôm
nay đẻ ra, nhưng lượt hôm nay nhân nó lên. React báo thẳng:

```
In HTML, <li> cannot be a descendant of <li>. This will cause a hydration error.
Uncaught Error: Hydration failed because the server rendered HTML didn't match the client.
```

Sửa: bỏ hẳn `.hang_bung`, thẻ mốc là con trực tiếp của `<ol>`; mốc giữa gói bằng
`<Fragment key>` chứ không bằng `<li>`; và **`VachMoi` đổi từ `<p>` sang `<li>`** vì nó
cũng là con trực tiếp của `<ol>`, mà `<ol>` chỉ được chứa `<li>`. Kiểm bằng DOM thật:
`document.querySelectorAll('li > li')` → rỗng; `<ol>` không còn con nào không phải `<li>`.

Còn lại đúng MỘT lỗi console, **không thuộc việc này**: `<html>` bị lệch `data-theme` +
`style="color-scheme"` do script theme inline (`lib/theme.ts`) chạy trước hydrate. Có từ
`b05d04d`, nổ trên mọi trang với mọi người dùng. Cách chữa là `suppressHydrationWarning`
trên `<html>` ở `app/layout.tsx` — **user chốt để đó, không đụng** (2026-08-24).

## Ba việc user chốt thêm cuối ngày 2026-08-24

Không nằm trong plan gốc; ghi ra đây vì chúng đi cùng một lượt commit.

### 1. Lỗi hydration của `<html>` — `suppressHydrationWarning`

`app/layout.tsx`. Script theme inline (`lib/theme.ts`) đặt `data-theme` +
`style="color-scheme"` lên `<html>` **trước** hydrate; server cố ý không render hai thứ
đó (trang mạch ISR — một bản HTML dùng chung). Lệch ấy là **đúng thiết kế**, nhưng nó nổ
đỏ trên mọi trang với mọi người dùng (nhánh mặc định `color-scheme: light dark` ai cũng đi
qua), và một cảnh báo luôn-đỏ là cảnh báo không ai còn đọc. Cờ này chỉ tắt cho **thuộc
tính của đúng thẻ `<html>`**, không lan xuống con.

### 2. Đổi chữ: "Khán đài · N thread" → **"Bình luận · N cuộc trao đổi"**

`components/khan-dai.tsx`. **Không** dùng "N bình luận": `tong_thread` đếm thread gốc,
không đếm reply lồng, nên nó sẽ cãi nhau với `💬 N bình luận` ở chữ ký mạch. Tên trong
code (`khan-dai`, `data-testid`, `?khan_dai=`, PLAN) **giữ nguyên** — đây là đổi chữ cho
người đọc, không phải đổi API.

### 3. Khán đài MỞ SẴN ở mặt CẶN

`components/trang-mach.tsx`: `bung_khan_dai` biến mất, khán đài luôn nạp và luôn render.
`LoiMoiBungKhanDai` + CSS `.moi_bung_khan_dai` **gỡ hẳn**; 4 testid của nó
(`chan-trang-khan-dai`, `nut-bung-khan-dai`, `chan-so-binh-luan`, `chan-mot-dong-moi`)
không còn. `?khan_dai=1` vẫn nhận và nay là no-op — 34 chỗ trong bài đo lẫn `hrefSort` đều
mang nó, bỏ hẳn thì chúng thành "cùng trang nhưng thiếu đúng thứ URL ấy hứa".

**Đi ngược PLAN 5.5 bản cũ** ("khán đài nằm sau một cú bấm") — PLAN 5.5 đã viết lại kèm
lý do và ngày chốt, không để code với nền cãi nhau. 8 khẳng định e2e phụ thuộc trạng thái
gập đã sửa; một trong số đó (`V8`) được **siết chặt hơn** chứ không nới: nó nay còn đòi
`khan-dai-tong-thread` phải `toHaveCount(0)`, tức con số cũ ở chân trang không được lặng
lẽ chuyển hộ sang header.

### Sự cố trong lúc làm, ghi để không lặp lại

Tôi bật `next dev` cho user xem rồi chạy `rm -rf .next && build` **trên cùng thư mục đó** →
`Cannot find module './999.js'`, đúng cái bẫy đã ghi ở `CLAUDE.md`. Tệ hơn: lượt `pnpm e2e`
chạy ngay sau đó sẽ **tái dùng** dev server hỏng ấy (`reuseExistingServer`) và cho ra số
vô giá trị — phải huỷ lượt đo, tắt dev server, xoá `.next`, chạy lại từ trắng.
⇒ **Không build / không e2e khi dev server đang bật.** Tắt trước, chạy, rồi bật lại.

## Kết quả ĐO THẬT — LƯỢT CUỐI, cây SẠCH (2026-08-24)

Sau khi agent kia commit xong (`ccec23b`), cây làm việc chỉ còn 11 mục của việc này. Số
dưới đây là số của riêng bản vá, không lẫn gì:

| Đo | Kết quả |
|---|---|
| Nền ở HEAD `ccec23b` (`git stash` phần của việc này rồi chạy) | **296 passed** |
| `pnpm e2e:don-vi` có bản vá | **301 passed**, 0 failed = 296 + 5 bài mới |
| `pnpm --filter @gikky/web lint` | exit 0, **0 warning** |
| `pnpm --filter @gikky/web build` (xoá sạch `.next/` trước) | exit 0, **0 dòng warn/error** |
| `pnpm e2e` (cổng 3000 + 8000 đều trống, không tái dùng server nào) | **460 passed, 0 failed** |

Hai bài `va-v2.spec.ts` từng đỏ ở lượt đo trên cây hỗn hợp **đã xanh** ở lượt này. Chúng
chập chờn trong `e2e/danh-tinh.ts` (đăng ký → xác thực email → đăng nhập); nợ ấy đã tách
thành việc riêng, không phải nợ của mặt BÃO.

## Kết quả đo LƯỢT ĐẦU (cây làm việc hỗn hợp — giữ lại để đối chiếu)

| # | Kết | Số đo |
|---|---|---|
| N1 | ĐẠT | `pnpm --filter @gikky/web lint` → 0 error, 0 warning (nghiệm thu tự chạy lại) |
| N2 | ĐẠT MỘT PHẦN | `pnpm --filter @gikky/web build` → 0 warning, đo lúc cổng 3000 còn trống. Sau ba lượt thử phá (đều đã khôi phục) **không build lại được** vì phiên kia bật lại `next dev`; thay bằng `npx tsc --noEmit` → exit 0 |
| N3 | ĐẠT | `pnpm e2e:don-vi` → **301 passed**, 0 failed = nền 296 + 5 bài mới |
| N4 | ĐẠT MỘT PHẦN | `pnpm e2e` → **458 passed, 2 failed**. Hai bài đỏ nằm ở `va-v2.spec.ts`, chết trong `e2e/danh-tinh.ts` (đăng ký → xác thực email → đăng nhập). Chạy lại riêng: hai bài ấy XANH, một bài **khác** đỏ, vẫn cùng chỗ ⇒ **chập chờn có sẵn**, không phải hồi quy. `grep` `va-v2.spec.ts` không có `nut-mo-ca-mach`/`dai-gap-bao`/`mocMoiNhat` |
| N5 | ĐẠT | `tinhDaiGapBao` trả `gap:false` mọi `n` ⇒ **3 bài đỏ** (`dai-gap.spec.ts:151,163,175`), dòng đỏ `expect(bao.gap).toBe(true)` |
| N6 | ĐẠT | Bỏ thẻ mốc đầu ⇒ `1 failed … P5`, `5 passed` (P0 chạy trước và XANH — đúng như cặp đã sửa) |
| N7 | ĐẠT | `NGUONG_KHONG_GAP_BAO = 1` ⇒ `1 failed … P0` |
| N8 | ĐẠT | Ngoài 10 file của việc này, không file nào khác đổi trạng thái vì lượt này |
| N9 | ĐẠT | Ép nút remount ⇒ `1 failed … P5` |

Kiểm tận mắt trên trang thật (mạch VNM 6 mốc, ép `?view=bao`): gập → hiện `moc-1` +
`▤ Mốc 2–5 · 4 mốc · mở cả mạch ▾` + `moc-6`; bấm → hiện `moc-1…moc-6`, nhãn `▴ gập lại`,
`aria-expanded` `false→true`, **cùng một node DOM**, nút **còn giữ focus**, tổng số nút = 1.

**Chưa được kiểm độc lập:** `pnpm build` và `pnpm e2e` (nghiệm thu bị cấm chạy vì tranh
tài nguyên với phiên kia), và nền 296 bài trước khi sửa.

## Cây làm việc — CẢNH BÁO

Repo đang bẩn sẵn: một đợt **Phase 8 khu quản trị** đang dở (43 file `M` + 20 mục `??`,
gần hết nằm ở `api/`, `apps/admin/`, `packages/api-client/`). **Không đụng file nào của
họ**, kể cả để chữa lỗi build. Vì thế mọi lệnh build/lint ở việc này đi qua
`--filter @gikky/web`, không dùng `pnpm build` / `pnpm lint` ở gốc.
