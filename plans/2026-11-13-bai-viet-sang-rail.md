# Việc 24 — Khối "Bài viết" trang chủ dời sang rail phải; `/luat` cũng có

**Trạng thái:** ĐÃ LÀM trên `v2` (`bee47df` + `ea1596b`), đã lên dev.gikky.net (`ea1596b`, 2026-11-13 23:22, chỉ `web`; cây cũ `~/gikky-dev/src.cu-20261113-232202`), đã lên prod gikky.net (`c9cfbf5`, 2026-11-14 11:50). Nghiệm thu ĐẠT 13/13 + vòng sửa
R1–R6 ĐẠT; phản biện 3 VỪA + 1 NHỎ đã sửa ở vòng sửa 1. Sổ: `GHI-CHU.md` việc 24.

## Bối cảnh

Trang chủ v2 (`apps/web/app/page.tsx::TrangChuMoi`) nay có khối Nhật ký mới + dải "Đang được bàn" (việc 22). Khối
"Bài viết" to (`components/khoi-bai-viet.tsx`: dải Mới đăng 3 bài có thumbnail + giá sách ≤ 4 chuyên mục × 3 bài) đứng
NGOÀI khung hai cột, dưới cả rail, và tranh chỗ với Nhật ký. Hướng sản phẩm từ 2026-11-09: bài viết là phụ trợ.

User chốt 2026-11-13:
1. Bỏ khối "Bài viết" khỏi trang chủ; bài viết mới chuyển thành một khối ở **rail phải**.
2. Trang chuyên mục `/s/<sub>`: **chỉ bỏ khối bài** — giữ rail. Hiện rail `/s/*` vốn KHÔNG có khối bài
   (`app/s/[sub]/page.tsx:139,178` không truyền `baiMoi`) ⇒ không đổi hành vi, chỉ thêm bài đo ghim sự vắng mặt.
3. Trang tĩnh `/luat`: rail hiện bài viết mới **như trang chủ**.
4. Hiển thị trong rail: **chữ nhỏ hơn, chữ thường (không đậm), cắt bớt** — tiêu đề hiện quá dài.

## Phạm vi — LÀM

### A. Khối bài mới của `Sidebar` (`apps/web/components/sidebar.tsx` + `sidebar.module.css`)

- **Vị trí:** dời khối `sidebar-bai-moi` lên ngay SAU khối giới thiệu / "Về s/…" / "Chủ đề tuần này", TRƯỚC khối
  "Chuyên mục" — áp cho MỌI trang có khối này (trên điện thoại rail xuống dưới nội dung, để cuối thì không ai cuộn tới).
  Thứ tự mới: khách → giới thiệu|về sub → chủ đề tuần → **bài mới** → chuyên mục → luật → chân trang.
- **Kiểu chữ (một kiểu cho mọi trang):** tiêu đề 12.5px, `font-weight: 400`, **một dòng** —
  `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` (bỏ `-webkit-line-clamp: 2`). Tiêu đề ĐẦY ĐỦ vẫn
  là text của thẻ `<a>` trong HTML (cấm cắt chuỗi ở JS — anchor text cho bot) và có thuộc tính `title` = tiêu đề đầy đủ.
- **Dòng phụ:** bỏ "N mốc · N bình luận". Thay bằng: tên chuyên mục (lấy `ten` từ `cacSub` theo slug nếu có, không có
  thì `s/<slug>`) · ngày đăng trong `<time dateTime={published_at}>` (định dạng ngày như các chỗ khác của web đang
  dùng — dùng helper sẵn có ở `lib/dinh-dang.ts`, không viết helper mới nếu đã có). Chú ý hydrate: hiển thị ngày phải
  ra cùng chuỗi ở server và client (việc 17 từng dính React #418) — dùng helper đã an toàn với múi giờ.
- **Link "Tất cả bài viết →"** (`/?tab=moi&loai_mach=bai_viet`, testid `sidebar-bai-moi-tat-ca`) cuối khối — bật bằng
  prop, chỉ trang chủ và `/luat` bật.
- Prop mới cho nhánh tĩnh: `baiMoiTuTrinhDuyet?: boolean` (đối xứng với `chuyenMucTuTrinhDuyet`).

### B. Trang chủ `/` (`apps/web/app/page.tsx`, `trang-chu.module.css`)

- Bỏ `<KhoiBaiViet …/>` khỏi `TrangChuMoi`; bỏ các lời gọi giá sách (`docFeedSub` theo từng sub trong
  `Promise.all`). Vẫn cần `docCacSub()` cho rail.
- Thay `docFeed("moi", { limit: SO_BAI_VIET_TAI, loai_mach: "bai_viet" })` bằng limit **10** (hằng mới, đặt tên rõ,
  ví dụ `SO_BAI_VIET_RAIL = 10` ở `lib/nhom-bai-viet.ts` hoặc chỗ hợp lý); truyền vào `Sidebar` qua `baiMoi`,
  `tieuDeBaiMoi="Bài viết mới"`, bật link "Tất cả bài viết →".
- **Không đổi** `<title>`, meta, JSON-LD, `<h1>`, lede, dải bản tin, khối chủ đề, nhật ký, dải đang bàn.
- `trang-chu.module.css`: gỡ phần `order` dành cho section "Bài viết" trên điện thoại (main → Bài viết → rail). Dải bản
  tin vẫn đứng đầu. Cập nhật comment JSX trong `page.tsx` cho khớp (comment hiện mô tả "Bài viết đứng NGOÀI khung").
- Nhánh `/?tab=…` (`FeedDaNap`) **không đổi**.

### C. Dọn code chết

- `components/khoi-bai-viet.tsx` + `khoi-bai-viet.module.css` và các hàm trong `lib/nhom-bai-viet.ts` chỉ nó dùng
  (`chonMoiDang`, `dungGiaSach`, `idDaHien`, `subLenTrangChu`, `SO_BAI_TAI_MOI_GIA`, `SO_MOI_DANG`, `SO_BAI_MOI_GIA`,
  `SO_BAI_VIET_TAI` …): **grep trước**, chỉ xoá thứ không còn ai dùng; xoá kèm bài đo đơn vị chỉ đo các hàm đã xoá.
  `gallery-bai-viet.tsx` nếu đã không ai dùng thì cũng xoá. Không đụng API/admin: trường `Sub.vi_tri_trang_chu` để
  nguyên (ghi ở NGOÀI PHẠM VI).

### D. `/luat` — nạp ở trình duyệt

- Component client mới `components/bai-moi-tu-trinh-duyet.tsx`, theo đúng khuôn `chuyen-muc-tu-trinh-duyet.tsx`:
  `useEffect` gọi hàm mới `docBaiVietMoiOTrinhDuyet(limit)` ở `lib/api.ts`; chưa xong / lỗi / rỗng ⇒ **không vẽ gì**.
  Nó vẽ CÙNG markup với khối server (tách phần danh sách thành component dùng chung, đừng chép hai bản).
- `docBaiVietMoiOTrinhDuyet` gọi **thẳng theo tên** hàm sinh ra (`lietKeFeedMoi` hoặc tên đúng trong
  `@gikky/api-client`) với `baseUrl: GOC_TRINH_DUYET`, `query: { limit, loai_mach: "bai_viet" }` — cấm alias qua biến
  (hàng rào `e2e/don-vi/type-frontend.spec.ts`), cấm `client` singleton.
- `components/khung-hai-cot-tinh.tsx`: truyền `baiMoiTuTrinhDuyet` (+ link "Tất cả bài viết →"). **Cấm** thêm
  `@/lib/api` / `@gikky/api-client` / `fetch(` vào chính file này (luật ghi trong docstring, `e2e/don-vi/trang-loi.spec.ts`
  canh). `/luat` phải còn **tĩnh** trong output `next build` (ký hiệu `○`).

### E. Các trang dùng `KhungHaiCot` (`/m/…`, `/u/…`, `/tim-kiem`…)

- Giữ số bài (5), tiêu đề ("Bài mới nhất" / "Cùng chuyên mục") và nguồn dữ liệu như cũ; chỉ nhận vị trí + kiểu chữ mới.

## Phạm vi — KHÔNG LÀM

- Không đụng `api/`, `apps/admin/`, `packages/api-client/` (không đổi API ⇒ không codegen).
- Không thêm khối bài vào rail `/s/*`, không đổi rail của nhánh `/?tab=…`.
- Không làm khối "Được bàn nhiều trong chuyên mục" (GHI-CHU việc 23, chờ dữ liệu).
- Không sửa `LOI-VA-NO.md` / `GHI-CHU.md`. Không commit.

## Tiêu chí nghiệm thu (đo được)

| # | Lệnh / cách đo | Mong đợi |
|---|---|---|
| T1 | `pnpm lint` | exit 0, 0 warning |
| T2 | `pnpm --filter @gikky/web build` (KHÔNG `pnpm build` — xem Rủi ro) | exit 0; `/luat` ký hiệu `○` (static) |
| T3 | `pnpm e2e:don-vi` | toàn bộ xanh; ghi số bài trước/sau |
| T4 | HTML thô của `/` (UA trình duyệt) | không có `data-testid="khoi-bai-viet"`; có `sidebar-bai-moi` với **10** link `/m/…`, mỗi `<a>` có `title` = text đầy đủ = `title` của mạch từ API `GET /api/v1/feeds/moi?loai_mach=bai_viet&limit=10`, cùng thứ tự; có `<time datetime=…>` mỗi mục; có link `/?tab=moi&loai_mach=bai_viet` |
| T5 | Bài W6/G5 (`e2e/trang-chu-giao-dien-moi.spec.ts`) | ≥ **17** link `/m/` duy nhất — **không hạ ngưỡng**; UA trình duyệt và Googlebot cùng tập link. Các ngưỡng `<article>`/`<time>` gắn với khối bài cũ: sửa theo bố cục mới, ghi lý do trong comment, KHÔNG xoá cả bài |
| T6 | Playwright, desktop 1280px, trang `/` | phần tử tiêu đề trong `sidebar-bai-moi`: `font-size` 12.5px, `font-weight` 400, `white-space` nowrap, `text-overflow` ellipsis; với tiêu đề dài nhất trong 10 bài: `scrollWidth > clientWidth` (đang bị cắt) và chiều cao = một dòng |
| T7 | Playwright, `/` | trong `sidebar`, `sidebar-bai-moi` đứng TRƯỚC khối chuyên mục (thứ tự DOM) |
| T8 | Playwright, `/luat` | HTML thô KHÔNG chứa `sidebar-bai-moi`; sau hydrate thì có, ≤ 10 link `/m/`; chặn `**/api/v1/feeds/moi*` bằng `page.route(...abort)` ⇒ khối vắng, trang vẫn đủ nội dung luật, không lỗi console |
| T9 | Playwright, một `/s/<sub>` có bài | không có `sidebar-bai-moi` |
| T10 | Playwright, một `/m/<slug>-<id>` | vẫn có `sidebar-bai-moi` ("Cùng chuyên mục"/"Bài mới nhất"), đứng trước khối chuyên mục, kiểu chữ như T6 |
| T11 | `e2e/mobile-390.spec.ts` + đo tay 390px trên `/` | không cuộn ngang; khối bài mới nằm trong rail (dưới nội dung chính) |
| T12 | Các spec đang ghim khối cũ (`trang-chu-giao-dien-moi`, `trang-chu-v2`, `mobile-390`, `dai-ban-tin`, `don-vi/trang-chu-giao-dien-moi`, `don-vi/xem-truoc-anh`, `seo-trang-chu`, `vo-reddit`, `trang-loi`) | chạy trên `gikky_e2e` với `CI=1`: xanh. Bài nào chỉ đo khối đã xoá thì xoá/viết lại có lý do |
| T13 | Thử phá | mỗi bài đo mới phải đỏ khi phá đúng thứ nó canh (vd đặt lại `line-clamp: 2` ⇒ T6 đỏ; dời khối xuống cuối ⇒ T7 đỏ; thêm lại `KhoiBaiViet` ⇒ T4 đỏ; cho `/luat` render server ⇒ T8 đỏ). Ghi lại từng lần phá → đỏ → khôi phục → xanh |

## Rủi ro

- **SEO "chỉ cộng"** (GHI-CHU việc 11): việc này BỚT link khỏi `/` (≈ 15 link bài + thumbnail) theo quyết định của user;
  bù bằng 10 link rail. Ngưỡng ≥ 17 `/m/` là chốt chặn — nếu không đạt thì DỪNG và báo, không hạ ngưỡng.
- **Chung checkout:** phiên khác đang sửa `apps/admin`, `api`, `packages/api-client/src-admin` (việc 21 đợt D) và có
  thể có phiên sửa CSS light mode của `apps/web`. `pnpm build` (cả hai app) phá `next dev` của admin đang chạy ⇒ chỉ
  build web. Trước khi sửa: `git status --short apps/web` — nếu file định sửa (`sidebar.*`, `page.tsx`,
  `trang-chu.module.css`, `khung-hai-cot*.tsx`) ĐÃ có thay đổi chưa commit không phải của mình thì DỪNG và báo.
- **DB:** `gikky_dev` có dữ liệu thật — e2e chỉ chạy trên `gikky_e2e`, với `CI=1`, cổng 3000/8000 phải trống; bận thì
  KHÔNG giết tiến trình của người khác, báo lại.
- `P-20261113-19` (mobile e2e để lại nhật ký tạm trên `gikky_e2e`) có thể làm bài đo trang chủ chập chờn — không sửa ở
  việc này.

## Báo cáo thực thi

### Đổi hướng so với chữ của plan (phiên chính chốt, có lý do)

1. **Trang chủ vẫn tải 50 bài rồi `chonMoiDang` lấy 10**, không gọi `limit=10`: `chonMoiDang` bỏ các mạch bản tin cũ
   `chuyen_ban_tin` cố ý để lại trong sub `tin-tuc` (vẫn là `bai_viet` công khai). `/luat` dùng cùng phép.
2. **Tên chuyên mục lấy từ `m.sub.ten`** của mạch (API đã có), không tra `cacSub` — chạy cả ở `/luat` nơi `cacSub` rỗng.
3. **Ngưỡng rail dính (không có trong plan gốc):** rail `/` cao lên 1831px (khối 10 bài 575px), vượt ngưỡng 1500px
   ⇒ ở khung nhìn 1500–1891px rail dính mà che đuôi (bài L1 đỏ). Vòng đầu nâng chung lên 1900; phản biện chỉ ra chỉ dư
   8px và làm `/m/…` mất dính ở 1540–1899px ⇒ **tách hai ngưỡng**: chung 1550px (61 + rail 1478 của `/m/`, `/u/`,
   `/tim-kiem`…), riêng `railCao` 2000px cho `/` và `/luat` (61 + 1831, chừa ~100px ≈ 3 chuyên mục). Prop
   `railCao` ở `VoKhungHaiCot`.
4. **Anchor text (phản biện):** bản đầu để dòng phụ trong `<a>` ⇒ anchor "…kết quảChứng khoán Việt Nam·13/11/2026".
   Nay `<a>` chỉ bọc tiêu đề; cả dòng vẫn bấm được nhờ stretched link (`.tieu_de_bai_moi::after`, `li` relative); focus
   ring bàn phím vẫn hiện (chỉ bao dòng tiêu đề).
5. **Bài đo rỗng (phản biện):** regex `FeedDaNap` trong V24-T4 dừng ở `}: {` của phần khai tham số ⇒ nhánh `/?tab=…`
   không được canh. Thay bằng helper `hamTrongFile` + vế chống rỗng.

### File

Mới: `components/khoi-bai-moi.tsx`, `components/bai-moi-tu-trinh-duyet.tsx`, `e2e/rail-bai-viet.spec.ts`.
Sửa: `components/sidebar.tsx`, `sidebar.module.css`, `app/page.tsx`, `app/trang-chu.module.css`,
`components/khung-hai-cot-tinh.tsx`, `khung-hai-cot-vo.tsx`, `khung-hai-cot.module.css`, `lib/api.ts`,
`lib/nhom-bai-viet.ts`; comment ở `trang-chu-v2.tsx`, `kho-chu-de.module.css`, và comment đầu `trang-chu-v2.module.css`.
Xoá: `components/khoi-bai-viet.*`, `components/gallery-bai-viet.*`.
Spec: `e2e/don-vi/{bai-viet-trang-chu,xem-truoc-anh,sidebar-bai-moi,trang-chu-giao-dien-moi}.spec.ts`,
`e2e/{trang-chu-giao-dien-moi,trang-chu-v2,mobile-390,dai-ban-tin}.spec.ts`.

⚠ **Commit phải tách hunk** — cây chung với phiên "khoảng cách khối / light mode": trong
`e2e/trang-chu-v2.spec.ts` (L4 nền `rgb(241, 242, 245)`, đi cùng `globals.css`), `e2e/trang-chu-giao-dien-moi.spec.ts:142`
(ngưỡng 28→21, đi cùng `khoi-thao-luan.module.css`) và `components/trang-chu-v2.module.css` (margin lede 14→24px) có
hunk KHÔNG thuộc việc này. Commit theo pathspec cả file sẽ kéo chúng theo và làm bài đo trên HEAD đỏ.

### Kiểm chứng (nghiệm thu tự chạy lại)

- `pnpm lint`: exit 0, 0 warning. `pnpm e2e:don-vi`: 819 passed (nền HEAD 827; chênh = bài đo của code đã gỡ bị xoá,
  bài mới thêm).
- Build `@gikky/web` trên bản sao cô lập: exit 0, `○ /luat` (static).
- e2e trên cụm cô lập (`next start` :3040 + Django :8040, `gikky_e2e`, `CI=1` — cổng 3000/8000 đang có dev server của
  phiên khác, không đụng): `rail-bai-viet` 8, `trang-chu-v2` 41, `trang-chu-giao-dien-moi` 29, `mobile-390` 14,
  `hai-cot` 14, `dai-ban-tin` 21, `seo-trang-chu` 5 ⇒ 131 passed, 1 skipped (W-ANH), 0 failed. `vo-reddit` (lượt 1):
  A10 đỏ sẵn trên HEAD (sổ `P-20261113-31`).
- Link `/m/` duy nhất trên `/`: 25 (HEAD) → 32; ngưỡng ≥ 17 không hạ; UA trình duyệt = Googlebot.
- Thử phá: thợ, nghiệm thu đều tự phá — line-clamp ⇒ T6 đỏ; dời khối ⇒ T7/T10 đỏ; thêm lại `khoi-bai-viet` ⇒ T4 đỏ;
  render server ở `/luat` ⇒ T8 đỏ; dòng phụ vào lại `<a>` ⇒ anchor đỏ; xoá `::after` ⇒ bấm dòng phụ đỏ; `baiMoi` vào
  `FeedDaNap` ⇒ V24-T4 đỏ; đảo hai ngưỡng ⇒ hai bài L1 đỏ.

### Ghi sổ

`LOI-VA-NO.md`: `P-20261113-31` … `-37`. `GHI-CHU.md` việc 24: trường `Sub.vi_tri_trang_chu` hết người đọc trên web.

### Bổ sung sau commit `bee47df` (user, 2026-11-13)

"di chuyển bài viết mới xuống dưới chuyên mục bên phải, sau đó deploy luôn" ⇒ khối bài mới đứng SAU Chuyên mục, TRƯỚC
Luật (đảo lại vị trí "trước Chuyên mục" của mục A; trên điện thoại khối xuống thấp hơn — user chấp nhận). Chiều cao rail
không đổi ⇒ ngưỡng dính giữ. Sửa `sidebar.tsx` + đảo các bài đo thứ tự (V24-T7, T7, T8 `/luat`, T10, mobile T5); T4
"bấm dòng phụ" thêm `scrollIntoViewIfNeeded()` vì khối nay nằm dưới mép màn 1280×900. Kiểm chứng (thợ): lint 0 warning,
`e2e:don-vi` 819 passed, e2e `rail-bai-viet` + `trang-chu-v2` + `mobile-390` + `trang-chu-giao-dien-moi` 91 passed /
1 skipped trên cụm cô lập `gikky_e2e`; phá V24-T7 (thứ tự cũ) ⇒ đỏ. Bỏ chặng nghiệm thu/phản biện (đổi chỗ một khối,
ngoại lệ "sửa một chỗ đã biết chắc"); phiên chính đọc diff.
