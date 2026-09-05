# Thu gọn / mở rộng thân chữ của từng mốc trên trang mạch

Chốt 2026-09-05. User (kèm ảnh chụp màn hình trang mạch mặt CẶN): mọi mốc vẫn hiện đủ như
hiện tại, nhưng **thân chữ** (`ThanHtml`) của mỗi mốc — **trừ mốc 1** — mặc định chỉ hiện
một phần, phần còn lại thu nhỏ; bấm vào thì mốc đó mới mở rộng đủ nội dung; mở một mốc khác
thì mốc đang mở tự thu lại (tại một thời điểm chỉ tối đa MỘT mốc, ngoài mốc 1, được mở
rộng). **Mốc 1 luôn hiện đủ, không có nút, không bao giờ thu gọn.**

Ba câu hỏi đã chốt với user:
1. Cơ chế gộp/gập mốc **đang có** (dải gập `DaiGapBung`/`MatBao`, PLAN mục "BA thứ gập
   được" ở `ngan-keo.tsx`) — **giữ nguyên, không đụng**. Việc mới là một khái niệm **khác
   hẳn**: thu gọn *nội dung riêng bên trong* một mốc, không phải gộp/ẩn cả mốc.
2. Phần bị ẩn khi thu gọn: **chỉ thân chữ** (`ThanHtml`) — figures, ảnh minh hoạ, vote,
   reaction, số bình luận vẫn hiện đủ như hiện tại.
3. Mặc định khi tải trang: **không mốc nào (ngoài mốc 1) mở rộng sẵn**.

⚠ **Giả định cần user xác nhận lại khi đọc plan này** (không hỏi thêm lần nữa để khỏi kéo
dài, nhưng đây là quyết định kiến trúc có thể sai): vì `TheMoc` là component DÙNG CHUNG cho
cả mặt CẶN (`<ol>` ở `trang-mach.tsx:405-428`) và mặt BÃO (`MatBao`), và user chỉ nói "phần
cần sửa là nội dung riêng của từng mốc" — cơ chế mới cài Ở CẤP `TheMoc`, nên **tự động áp
dụng cho cả hai mặt hiển thị**, không tách riêng. Nếu ý user là chỉ mặt CẶN, cần nói lại
TRƯỚC khi `opus-dev` bắt đầu — sửa lại dễ (thêm một prop tắt/mở), nhưng tốn một vòng.

## 0 · Cái KHÔNG làm

- Không đụng `NganKeoProvider`, `DaiGapBung`, `MatBao` — ba cơ chế gập đang có giữ nguyên
  100% hành vi, kể cả cơ chế deep-link `moToTienDangGap` (`ngan-keo.tsx:82-94`, dựa trên
  `hidden` + `aria-controls`).
- **Không dùng `hidden` attribute cho khối thu gọn mới.** Ba khoang gập hiện có ẩn/hiện
  TOÀN BỘ nội dung (nhị phân), còn yêu cầu ở đây là **thu gọn PARTIAL** — vẫn thấy vài dòng
  đầu. Đây là lý do kỹ thuật bắt buộc phải là một cơ chế MỚI (CSS `max-height` +
  `overflow: hidden`), không tái dùng nguyên xi khuôn `hidden`/`aria-controls` của ba
  khoang kia — dù state quản lý (một mốc mở tại một thời điểm) thì bắt chước đúng
  `NganKeoProvider.dangMo`.
- **Hệ quả của quyết định trên: KHÔNG nối vào `moToTienDangGap`.** Nếu sau này phát hiện có
  đường deep-link trỏ vào một vị trí NẰM TRONG thân chữ của mốc (không phải vào bình luận
  hay khối trích — hai thứ đó độc lập với `ThanHtml`), cần xử lý riêng. `opus-dev` phải
  `grep` các nơi gọi `scrollIntoView`/set `location.hash` để xác nhận không có ca nào trỏ
  vào bên trong `ThanHtml` (nghi ngờ: không có, vì `KhoiTrich` hiển thị đoạn trích như một
  khối RIÊNG, không cuộn vào toạ độ bên trong thân mốc gốc) — ghi kết quả kiểm vào báo cáo,
  không giả định.
- Không thêm animation phức tạp (không cần khớp một thư viện transition nào) — CSS
  `transition` đơn giản trên `max-height` là đủ, không bắt buộc phải mượt tuyệt đối.
- Không đổi cấu trúc dữ liệu backend — đây là tính năng THUẦN FRONTEND, không API mới,
  không schema mới.

## 1 · Thiết kế

### 1.1 · State dùng chung: mốc nào đang mở rộng

Thêm context mới, **tách biệt** `NganKeoCtx` (khác khái niệm — mở ngăn kéo bình luận của
mốc 5 không được đóng nội dung đang mở rộng của mốc 3, và ngược lại):

```tsx
// apps/web/components/mo-rong-moc.tsx (file MỚI)
const MoRongMocCtx = createContext<{
  dangMoSeq: number | null;
  doiMoRong: (seq: number) => void;
} | null>(null);

export function MoRongMocProvider({ children }: { children: ReactNode }) {
  const [dangMoSeq, datDangMoSeq] = useState<number | null>(null);
  return (
    <MoRongMocCtx.Provider
      value={{ dangMoSeq, doiMoRong: (seq) => datDangMoSeq((cu) => (cu === seq ? null : seq)) }}
    >
      {children}
    </MoRongMocCtx.Provider>
  );
}
export function useMoRongMoc() { /* throw nếu dùng ngoài Provider, đúng khuôn useNganKeo */ }
```

Bọc `<MoRongMocProvider>` ở tổ tiên chung của cả hai nhánh render (mặt CẶN + mặt BÃO) trong
`trang-mach.tsx::TrangMach` — đọc kỹ hàm này trước khi chèn để chọn đúng vị trí bọc (không
bọc bên trong từng nhánh riêng, kẻo mặt CẶN và mặt BÃO có hai state độc lập, phá tính
"chỉ một mốc mở tại một thời điểm" xuyên suốt trang).

### 1.2 · Khối thu gọn trong `TheMoc`

Trong `apps/web/components/the-moc.tsx`, quanh chỗ render `<ThanHtml .../>` (dòng ~118-122
theo khảo sát):

```tsx
if (moc.seq === 1) {
  return <ThanHtml ... />;             // luôn đủ, không bọc, không nút
}
const { dangMoSeq, doiMoRong } = useMoRongMoc();
const moRong = dangMoSeq === moc.seq;
// wrapper đo tràn + áp class thu gọn khi !moRong — chi tiết ở 1.3
```

- **Chỉ hiện nút "Xem thêm" nếu nội dung THẬT SỰ tràn khỏi khung thu gọn** — đo bằng
  `scrollHeight > clientHeight` sau mount (`useLayoutEffect` + `ResizeObserver` cho ca ảnh
  tải xong đổi chiều cao). Mốc ngắn (vừa trong khung) thì không có nút, hiện đủ luôn — coi
  như "mở rộng" mặc định vì có gì đâu mà gọn.
- Component con `data-testid`: `than-moc-{seq}` (khối bọc), `nut-mo-rong-moc-{seq}` (nút),
  `aria-expanded={moRong}`, `aria-controls="than-moc-{seq}"` — giữ đúng thói quen
  accessibility của `NutNganKeo`, dù không dùng `hidden` (không phá gì, chỉ là thói quen
  tốt cho tương lai nếu sau này cần nối deep-link).
- Nhãn nút: `moRong ? "Thu gọn ▲" : "Xem thêm ▼"`.

### 1.3 · CSS (`the-moc.module.css`)

**Dùng `max-height` + `overflow: hidden`, KHÔNG dùng `-webkit-line-clamp`.** Lý do: thân
mốc là HTML có cấu trúc khối (heading, danh sách, ảnh chèn — không chỉ văn bản thuần), và
`line-clamp` chỉ hoạt động tốt/nhất quán trên luồng văn bản một cấp; với heading/list/ảnh
lồng bên trong nó cắt không đoán trước được. `max-height` cắt bằng pixel, hoạt động đúng
với mọi loại nội dung khối.

```css
.thanThuGon {
  max-height: 220px;
  overflow: hidden;
  position: relative;
  transition: max-height 0.2s ease;
}
.thanThuGon::after {
  content: "";
  position: absolute;
  inset: auto 0 0 0;
  height: 56px;
  background: linear-gradient(to bottom, transparent, var(--mau-nen-the));
  /* dùng ĐÚNG biến token nền thẻ hiện có trong hệ theme của apps/web — tra tên biến thật
     trong globals.css / token file trước khi viết, đừng bịa tên, và đừng hardcode hex (vỡ
     dark mode). */
}
```

`220px` là số khởi điểm hợp lý (~5-6 dòng chữ cỡ thường) — không phải hằng số thiêng, có
thể chỉnh khi xem bằng mắt lúc kiểm trình duyệt thật (§4.6).

### 1.4 · Rà soát mọi nơi `<TheMoc` được dùng ngoài luồng chính

`opus-dev` phải `grep "TheMoc" apps/web` và liệt kê ĐẦY ĐỦ trong báo cáo mọi nơi gọi —
không chỉ hai nhánh trong `trang-mach.tsx`. Nếu có nơi render MỘT mốc đơn lẻ tách khỏi ngữ
cảnh danh sách (preview thông báo, khối trích, trang xem một mốc riêng…), nơi đó phải
**tắt** thu gọn (mốc đơn lẻ không có lý do gì để giấu bớt chính nó) — thêm prop
`choPhepThuGon?: boolean` (mặc định `true`), đặt `false` ở các nơi đó. Nếu không có nơi nào
khác dùng `TheMoc` ngoài hai nhánh của `trang-mach.tsx`, ghi rõ "không có, đã kiểm bằng
grep" trong báo cáo — đừng im lặng bỏ qua bước này.

## 2 · Bài đo bắt buộc

Đây là tính năng UI thuần tương tác trình duyệt — `pnpm e2e:don-vi` (không DOM thật) không
đủ. Cần Playwright thật (`pnpm e2e`, seed DB tự động — xem cảnh báo "chiếm cổng 3000+8000,
ghi vào `gikky_dev`" ở `D:\Projects\gikky-net\CLAUDE.md`, nên đây PHẢI chạy trong worktree
tách hoặc lúc chắc chắn không ai đang chạy `next dev`/`pnpm api:dev` — kiểm `git status` +
hỏi trước theo đúng luật cây làm việc).

| # | Đo gì |
|---|---|
| D1 | Mạch có ≥3 mốc, mốc 2 và 3 có thân dài (>500 ký tự HTML): tải trang mặt CẶN ⇒ `than-moc-1` KHÔNG có `nut-mo-rong-moc-1` (luôn đủ); `than-moc-2`/`than-moc-3` có nút, ở trạng thái thu gọn (`aria-expanded=false`), `scrollHeight` bị khung `max-height` giới hạn |
| D2 | Bấm `nut-mo-rong-moc-2` ⇒ `aria-expanded=true`, nội dung mốc 2 hiện đủ (chiều cao khối tăng, không còn bị cắt); mốc 3 vẫn thu gọn |
| D3 | Sau D2, bấm `nut-mo-rong-moc-3` ⇒ mốc 3 mở, **mốc 2 tự thu gọn lại** (`aria-expanded=false` ở nút 2) — đúng luật "chỉ một mốc mở tại một thời điểm" |
| D4 | Mốc có thân NGẮN (< khung thu gọn, ví dụ 50 ký tự) ⇒ KHÔNG có nút `nut-mo-rong-moc-{seq}`, nội dung hiện đủ ngay từ đầu |
| D5 | Mốc 1 luôn đủ nội dung dù thân dài cỡ nào, không có nút, mọi lúc |
| D6 | Mở ngăn kéo bình luận (`nut-ngan-keo-N`) của một mốc KHÁC mốc đang mở rộng nội dung ⇒ không ảnh hưởng lẫn nhau (hai state độc lập) — bấm nút ngăn kéo không làm nội dung đang mở rộng bị thu gọn, và ngược lại |
| D7 | Toàn bộ bài đo cũ trong `mach-can.spec.ts`, `vo-reddit.spec.ts`, `va-v2.spec.ts` vẫn xanh KHÔNG SỬA — đặc biệt các assert `moc-{seq}` visible, `nut-ngan-keo-{seq}`/`ngan-keo-{seq}` không đổi hành vi, `trich-moc-{seq}` vẫn visible bất kể trạng thái mở rộng |
| D8 | Nếu mặt BÃO cũng nhận cơ chế này (§ giả định đầu file) — lặp lại D1-D3 trên mặt BÃO trong dải mốc ĐÃ mở của `MatBao` (mốc nằm trong dải gập vẫn `hidden` thì chưa cần đo — chỉ đo mốc đã hiện) |

**Thử phá (luật 4, bắt buộc):** (a) xoá điều kiện đo tràn, luôn hiện nút ngay cả khi nội
dung ngắn ⇒ D4 phải đỏ; (b) đổi context để mỗi mốc có `useState` RIÊNG thay vì context dùng
chung ⇒ D3 phải đỏ (hai mốc cùng mở được, sai luật loại trừ); (c) bỏ điều kiện
`seq === 1` ⇒ D5 đỏ. Mỗi ca: sửa hỏng → chạy đúng bài → ĐỎ → khôi phục → xanh.

## 3 · Tiêu chí nghiệm thu (ĐO ĐƯỢC)

1. `pnpm lint` 0 warning. `pnpm build` (app `web`) 0 warning — kiểm cổng 3000 trống trước
   khi build.
2. `pnpm e2e` (bộ đầy đủ) xanh, bao gồm D1-D7 mới + toàn bộ bộ cũ không đỏ thêm bài nào so
   với nền đầu phiên (ghi rõ số bài trước/sau).
3. Thử phá (a)(b)(c) đỏ đúng bài rồi khôi phục xanh — ghi output rút gọn.
4. Kiểm bằng mắt trên trình duyệt (script Playwright dùng-một-lần hoặc chạy `pnpm web:dev`
   thủ công nếu cổng 3000 đang rảnh): chụp ảnh trạng thái thu gọn và mở rộng của ít nhất
   một mốc, xác nhận khung `max-height=220px` không cắt cụt chữ giữa dòng theo cách xấu
   (không cắt vỡ chữ, gradient che hợp lý), và xác nhận **dark mode** vẫn đúng màu gradient
   (không lộ viền cứng do dùng sai biến token).
5. Báo cáo liệt kê đầy đủ kết quả grep `TheMoc` (§1.4) — không được để trống mục này.
6. Không đụng `ngan-keo.tsx`, `dai-gap.tsx`, `mat-bao.tsx` — `git diff --stat` xác nhận ba
   file này không đổi.

## 4 · Ràng buộc tài nguyên & cây làm việc

- Kiểm `git status` trước khi bắt đầu — nhắc lại việc `api/core/models/moc.py` +
  migration 0028 (nới độ dài thân mốc, việc của Antigravity) **không liên quan gì tới việc
  này** (đây thuần frontend), không đụng.
- `pnpm e2e` chiếm cổng 3000 + 8000 và ghi vào `gikky_dev` — chạy khi chắc chắn không phiên
  nào khác đang dùng hai cổng đó, hoặc dựng worktree riêng.

## 5 · Chia độc quyền chặng 3/4

| Agent | Được chạy | Cấm |
|---|---|---|
| `nghiem-thu` | `pnpm test`(nếu chạm gì backend — không có ở việc này) · `pnpm build` · `pnpm lint` · `pnpm e2e` (bộ đầy đủ, chiếm cổng) | — |
| `phan-bien` | đọc code · `pnpm lint` · đọc kết quả `pnpm e2e` do nghiệm thu chạy | `pnpm e2e` / build trùng lúc với `nghiem-thu` (tranh cổng 3000/8000) |

## 6 · Nhật ký thực hiện (`opus-dev` điền)

(để trống — điền quyết định nhỏ, kết quả grep `TheMoc` (§1.4), tên biến token màu nền thật
đã dùng cho gradient, số đo cuối, và mọi phát hiện ngoài phạm vi vào mục riêng cuối báo cáo
theo luật "một việc một lúc" ở `D:\Projects\CLAUDE.md`)
