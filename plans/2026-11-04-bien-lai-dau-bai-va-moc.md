# Biên lai đầu bài + mốc thu gọn đọc được

Trạng thái: **ĐẠT** · review phiên chính 2026-11-04

Kết quả (phiên chính tự chạy): `pnpm e2e:don-vi -g "biên lai đầu bài"` 7/7 ·
`pnpm --filter @gikky/web lint` sạch. Trình duyệt mạch VNM 6 mốc: biên lai GIÁ VÀO /
DỪNG LỖ ngay dưới `h1`, mốc 1 không lặp `figures`, ô spine đọc được loại mốc, mốc ngắn
không nút, mốc 3 có trích thì trích `display:none` cho tới khi bấm Xem thêm, bấm chữ
không bung, bấm ô spine 6 thì mốc 3 thu lại. 375px `scrollWidth` = 375. Lệch đã chấp
nhận: dải số đứng trước thân chữ cả khi mốc đang mở, để số không nhảy chỗ.
Sổ: P-20261104-1.

## Bối cảnh

User (2026-11-04): nhìn mỗi bài viết nhàm; các mốc nhìn khó dùng.

Hai việc, một plan. Không API mới, không schema, không đụng feed.

**Vì sao mốc khó dùng (đối chiếu code, không phải cảm giác):** plan
`plans/2026-09-05-thu-gon-noi-dung-moc.md` chốt thu gọn **chỉ thân chữ**, figures /
ảnh / vote vẫn hiện. Bản đang chạy (`moc-accordion.tsx` bọc cả thẻ, CSS
`.than_thu_gon` `display: none` figures, reaction, gallery, trích, chân thẻ) làm
ngược: mốc 2 trở đi là một đoạn chữ mờ 145px, dải số bị giấu, bấm cả mặt thẻ mới
mở, và chỉ một mốc mở tại một thời điểm. Mốc mới nhất — thứ người đọc quay lại để
xem — lại là mốc bị cắt.

**Vì sao không kéo `ket_qua` lên đầu:** user chốt 2026-08-27 (`chan-dong-so.tsx`)
câu chốt sổ nằm **cuối** nhật ký, để khỏi báo kết cục trước khi đọc. Biên lai đầu
bài chỉ là số của **mốc 1** (giá vào, dừng lỗ…), không phải kết quả đóng sổ.

## LÀM

### 1. Biên lai ngay dưới tiêu đề

Hàm thuần `figuresMocDau` trong `apps/web/lib/bien-lai-dau.ts`:

```ts
export function figuresMocDau(
  mocs: readonly {
    seq: number;
    trang_thai: string;
    figures: readonly { label: string; value: string }[] | null;
  }[],
): { label: string; value: string }[]
```

- Lấy mốc `seq === 1` và `trang_thai === "binh_thuong"`. Không có, hoặc
  `figures` null/rỗng → `[]`.
- Bia mộ (`da_xoa` / `da_an`) → `[]`, dù API còn gửi figures.
- Cắt tối đa 6 cặp, giữ thứ tự gốc.
- Không đọc mốc seq khác. Không đọc `ket_qua`.

Component `apps/web/components/bien-lai-dau.tsx` + `bien-lai-dau.module.css`:

- `figures.length === 0` → `return null`. Không khung rỗng.
- Ngược lại: `<div data-testid="bien-lai-dau-bai">` chứa `<dl>` từng cặp
  (`<dt>` nhãn, `<dd>` bọc `SoLaiLo`) rồi `<TiLeRR figures={figures} />`.
- Kiểu dải số giống `.figures` của `the-moc.module.css` (viền `--line`, nền
  `--inset`, nhãn uppercase nhỏ). Giá trị: `font-size: 18px`,
  `font-family: var(--f-mono)`, `font-variant-numeric: tabular-nums`,
  `font-weight: 500`. Không màu mới. Xanh/đỏ chỉ đi qua `SoLaiLo`. Không dùng
  `--stamp` (ô này không phải con dấu).

Chỗ gắn, `apps/web/components/trang-mach.tsx`, **trong** `<header className={css.dau}>`,
ngay sau `<h1>`:

```tsx
<BienLaiDauBai figures={figuresMocDau(mach.mocs)} />
```

`TheMoc` thêm prop `anFigures: boolean`. `true` khi `seq === 1` và
`figuresMocDau` không rỗng — khi đó **không** render `<dl data-testid="figures">`
và không render `TiLeRR` trong thẻ mốc 1 (số đã lên đầu, không lặp dưới bài).
Mốc seq ≥ 2 giữ nguyên dải số của chính nó.

### 2. Mốc thu gọn: thấy số, thấy một đoạn, nút rõ

Giữ nguyên hợp đồng accordion (`moc-accordion.tsx`):

- Mốc 1 và bài thường (`laMach === false`) luôn đủ, không nút.
- `seq > 1`: mặc định thu; mở một mốc thì mốc khác (trừ mốc 1) tự thu.
- `#moc-N`, `#bl-…` nằm trong mốc, sự kiện `gikky:toi-binh-luan`, và bấm ô spine
  vẫn gọi `moMoc(seq)`.

Đổi **cái được giấu** và **cách bấm**:

Khi thu (`seq > 1`, chưa mở, `trang_thai === "binh_thuong"`), người đọc thấy, theo
thứ tự, và các khối này **vẫn nằm trong HTML** (ẩn bằng CSS, không gỡ khỏi DOM —
cùng lý do Google index của dải gập):

1. Hàng đầu hiện có: ngày, chip `loai`, biên lai "ghi …".
2. Dải `figures` + `TiLeRR` của mốc đó, đủ, không nằm trong vùng cắt.
3. Thân chữ trong `<div data-testid={"than-moc-" + seq}>`, `max-height: 72px`,
   `overflow: hidden`, fade dưới. Fade chỉ bọc thân chữ.
4. Câu mồi `question_for_crowd` nếu đang hiện (ngăn kéo trống).
5. Hàng reaction, cột vote, nút ngăn kéo, menu tác giả, nút mod.

Khi thu, **ẩn bằng CSS** (không unmount):

- `gallery-moc-{seq}`
- `tradingview-snapshots`
- `trich-moc-{seq}`

Nút:

- Hàm thuần `hienNutXemThem(thanTran: boolean, coPhanAn: boolean): boolean` trong
  cùng `bien-lai-dau.ts` (tên file giữ một chỗ cho hai luật hiển thị của lượt này).
  `true` khi thân chữ cao hơn 72px **hoặc** mốc có ảnh / snapshot TradingView /
  khối trích. Mốc ngắn, không ảnh, không trích → không nút, không fade, hiện đủ.
- Nút là `<button type="button">`, nhãn `Xem thêm` / `Thu gọn`,
  `aria-expanded`, `data-testid={"nut-mo-moc-" + seq}` khi thu và
  `data-testid={"nut-thu-gon-moc-" + seq}` khi mở.
- **Bỏ** `onClick` trên cả mặt thẻ. Bấm link, vote, ngăn kéo không được mở mốc.
- Bia mộ không accordion: giữ dòng `[mốc đã xoá]` / `[mốc đã bị ẩn]`.

Đo tràn ở client (`useLayoutEffect` + `ResizeObserver` trên
`[data-testid="than-moc-{seq}"]`). Trước khi đo xong: chưa hiện nút, chưa kẹp
(tránh nút nháy trên mốc ngắn). `coPhanAn` truyền từ `TheMoc` (biết ảnh / snapshot
/ trích mà không cần đoán testid).

Gỡ các luật CSS `.than_thu_gon … display: none` đang giấu figures, câu mồi,
reaction, chân thẻ, gallery (selector `gallery-moc` còn không khớp
`gallery-moc-{seq}`).

### 3. Ô spine và chấm ray nói mốc đó là gì

Hàm thuần `nhanOSpine(seq: number, loai: string | null, chuaXem: boolean): string`
trong `bien-lai-dau.ts`:

- Không loại, chưa xem: `Mốc 3, chưa xem`
- Có loại, đã xem: `Mốc 3, nâng dừng lỗ`
- Có loại, chưa xem: `Mốc 3, nâng dừng lỗ, chưa xem`
- `loai` rỗng sau `trim` coi như không có.

`MatBao`: `aria-label` của `spine-o-{seq}` đi qua hàm này. `title` của nút = `loai`
đã trim, bỏ `title` khi không có loại. Chữ nhìn thấy trên ô vẫn là số.

`TheMoc`, chấm ray (chỉ khi `laMach`): `title` = loại đã trim, hoặc `Mốc {seq}`
khi không có loại.

`trang-mach.tsx` truyền loại vào `MatBao` bằng prop mới, lấy từ `mach.mocs`
(`{ seq, loai }[]`). Không thêm trường API. `SpineOut` không có `loai` — đừng
sửa schema.

## KHÔNG LÀM

- Không kéo `ket_qua` / `bai_hoc` / `ChanDongSo` lên đầu. Không đổi chữ cuối sổ.
- Không gộp figures của mốc 2+ vào biên lai đầu. Số của mốc sau nằm trên thẻ mốc đó.
- Không đổi công thức dải gập (`lib/dai-gap.ts`, `DaiGapBung`, ngưỡng mặt BÃO/CẶN).
  Không đổi "chỉ một mốc mở ngoài mốc 1".
- Không ảnh hero full ngang. Không đụng thẻ feed (`the-mach.tsx`).
- Không nút "mở cả mạch" mới, không sắp xếp lại spine thành danh sách loại.
- Không API, không migration, không `pnpm codegen`, không sửa `PLAN.md`.
- Không sửa file đang `M` / untracked của phiên khác: `AGENTS.md`,
  `scripts/bai-viet/**`, `scripts/bot-trader/**`, ảnh thumbnail trong
  `apps/web/public/`. Không `git add`, không commit.
- Không `pnpm build` (phá `next dev`). Không `pnpm e2e` (chiếm 3000/8000 và ghi DB).

## File được sửa

| File | Việc |
|---|---|
| `apps/web/lib/bien-lai-dau.ts` | MỚI: `figuresMocDau`, `hienNutXemThem`, `nhanOSpine` |
| `apps/web/components/bien-lai-dau.tsx` + `.module.css` | MỚI |
| `apps/web/components/trang-mach.tsx` | Gắn biên lai sau `h1`; `anFigures`; truyền loại cho `MatBao` |
| `apps/web/components/the-moc.tsx` | `anFigures`; bọc thân bằng `than-moc-{seq}`; `coPhanAn`; `title` trên chấm ray |
| `apps/web/components/the-moc.module.css` | Kẹp chỉ thân chữ; bỏ luật giấu figures/reaction/chân |
| `apps/web/components/moc-accordion.tsx` | Bỏ click cả thẻ; nút theo `hienNutXemThem`; đo tràn |
| `apps/web/components/mat-bao.tsx` | `aria-label` / `title` spine qua `nhanOSpine` |
| `apps/web/e2e/don-vi/bien-lai-dau.spec.ts` | MỚI, bài đo hàm thuần |

## Tiêu chí

Chạy từ gốc repo. **Không** thêm `--` trước `-g` (cờ đó làm Playwright bỏ lọc).

1. `pnpm e2e:don-vi -g "biên lai đầu bài"` — toàn bộ bài trong file mới xanh, gồm:
   - mốc 1 bình thường, 2 cặp → đúng 2 cặp, đúng thứ tự;
   - 7 cặp → còn 6, bỏ cặp cuối;
   - `figures: null` hoặc `[]` → `[]`;
   - mốc 1 `da_xoa` hoặc `da_an` có figures → `[]`;
   - mốc 1 không figures, mốc 2 có figures → `[]` (không lấy mốc sau);
   - `hienNutXemThem(false, false) === false`, `(true, false) === true`,
     `(false, true) === true`;
   - `nhanOSpine(3, null, true) === "Mốc 3, chưa xem"`;
   - `nhanOSpine(3, "  nâng dừng lỗ ", false) === "Mốc 3, nâng dừng lỗ"`;
   - `nhanOSpine(3, "vào lệnh", true) === "Mốc 3, vào lệnh, chưa xem"`;
   - `nhanOSpine(1, "  ", false) === "Mốc 1"`.
2. `pnpm --filter @gikky/web lint` sạch (`--max-warnings=0` đã nằm trong script).
3. Trình duyệt, một mạch **≥ 3 mốc** có figures ở mốc 1 và ở một mốc sau, và một
   bài **1 mốc** có figures:
   - Dải số mốc 1 nằm dưới `h1`, `data-testid="bien-lai-dau-bai"` có mặt, trong
     thẻ mốc 1 không còn `data-testid="figures"`.
   - Bài không figures: không có `bien-lai-dau-bai`.
   - Mốc 2 thu: thấy chip loại + dải số của mốc 2; không thấy gallery nếu có ảnh;
     bấm vote không bung thân; bấm `Xem thêm` mới bung; bung mốc 3 thì mốc 2 thu.
   - Mốc chữ ngắn, không ảnh, không trích: không nút `Xem thêm`.
   - Ô spine đọc được loại trong `aria-label` (DevTools hoặc snapshot accessibility).
   - 375px: dải số xuống dòng, không tràn ngang trang.
