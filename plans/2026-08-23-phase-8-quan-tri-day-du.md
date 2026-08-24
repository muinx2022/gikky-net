# Phase 8 — Khu quản trị đầy đủ, giao diện theo template dashboard, dựng bằng Tailwind

> User chốt 2026-08-23:
> 1. *"phần quản trị sơ sài quá, bạn tạo plan làm 1 admin đầy đủ tính năng đi."*
> 2. *"giao diện phần quản trị, bạn làm theo temp trong ảnh"* — template dashboard kiểu "D-BOARD":
>    sidebar trái có nhóm mục, thanh trên, thẻ KPI, biểu đồ, bảng dữ liệu.
> 3. *"dùng tailwind css"*.
>
> **Lượt này LẬT hai dòng đã chốt của dự án.** Ghi ra vì repo này có luật: hàng rào và bài đo suy
> từ PLAN, nên lật mà không sửa PLAN là để lại một câu nói ngược với code.
> - `PLAN.md` 9.3 ghi *"Admin (tự build, **tối giản**)"* + đúng 4 màn hình v1 ⇒ **thay**.
> - `PLAN.md` 8.1 chốt **không Tailwind** (CSS Modules + token) ⇒ **thu hẹp**: Tailwind vào
>   **`apps/admin` và chỉ ở đó**. Xem §2.

## Hiện trạng đo được (nền để phát hiện worktree đứng sai cây)

| Cái gì | Số |
|---|---|
| `main` lúc viết plan | `ef38a60` |
| `pnpm test` | **986 pass + 16 skipped** (16 bài search skip khi Meilisearch chưa chạy — nợ L44) |
| `pnpm e2e` | **448** |
| Trang trong `apps/admin` | **7** (`/`, `/subs`, `/nhat-ky`, `/m/[machId]`, `/u/[username]`, `/dang-nhap`, `/chan-doan`) |
| Endpoint `/api/admin` | **13** |
| **Bài đo TRÌNH DUYỆT cho khu quản trị** | **0** — xem §6, đây là lỗ hổng lớn nhất của lượt này |
| CSS khu quản trị | 219 dòng, một `globals.css`, không CSS Module nào, không Tailwind |

Bước đầu tiên của **mọi** subagent chạy trong worktree: `git log --oneline -1`, so với `main`, đi
sau thì `git merge --ff-only main`. Rồi **kiểm bằng NỘI DUNG, không chỉ bằng hash**:
`api/api/quan_tri_sub.py` phải có `quan_tri_xoa_sub` · `apps/admin/components/o-tra-cuu.tsx` phải
tồn tại · `pytest --collect-only -q | tail -1` ra **1002** (986+16). Lệch ⇒ **DỪNG và báo**, đừng
"làm tới đâu hay tới đó".

---

## 0. "Theo template trong ảnh" nghĩa là gì — và KHÔNG nghĩa là gì

Cùng loại ranh giới đã dựng cho lượt giao diện Reddit (`plans/2026-08-23-giao-dien-reddit-va-theme.md`
§0), vì cùng một loài hỏng: người thực thi nhìn ảnh rồi chép cả những thứ trong ảnh **không tồn tại
ở đây**.

**MƯỢN — đây là cái user muốn:**
- Bộ khung: **sidebar trái cố định có nhóm mục** + **thanh trên dính** + vùng nội dung có breadcrumb.
- **Mật độ và nhịp**: thẻ trắng bo góc nhẹ, đổ bóng rất mỏng, khoảng cách đều, nhãn nhóm chữ nhỏ in hoa.
- **Hàng thẻ KPI** 4 ô: nhãn nhỏ in hoa · con số lớn · icon mờ bên phải.
- **Biểu đồ**: một cột nhóm (nhiều chuỗi theo thời gian) + một vành khuyên (tỉ trọng), mỗi cái trong
  một thẻ có tiêu đề hai dòng (*tên* / *phạm vi*) và nút `⋮`.
- **Bảng dữ liệu** trong thẻ: header chữ nhỏ in hoa, hàng thưa, cột cuối là thanh tiến độ + %.
- Mục menu có **mũi tên gập** cho nhóm con; mục đang mở tô màu nhấn.
- Thanh trên: nút gập sidebar · ô tìm kiếm · **badge số trên icon** · avatar · nút cài đặt.

**KHÔNG MƯỢN — ranh giới cứng:**

1. **Nội dung menu trong ảnh.** Ảnh có `E-commerce`, `Charts`, `Icons`, `Widget`, `Documentation`,
   `Menu levels`, `Demos`… — **không cái nào tồn tại ở gikky**. Mượn *hình dạng* menu, viết *nội
   dung* menu từ §4. Một mục menu không dẫn tới trang có thật là **nút chết**, loài lỗi repo này đã
   đếm nhiều lần; §6.3 có hàng rào chạy được cho nó.
2. **Nút không có endpoint.** Ảnh có `ADD WIDGET`, `EXPLORE ▾`, cờ đổi ngôn ngữ, icon hộp, icon chat
   badge `5`. Khu quản trị gikky **không có** widget tuỳ biến, không đa ngôn ngữ, không chat. Badge
   chuông thì có thật — nó là **số báo cáo đang chờ**.
3. **Dữ liệu bịa.** Bảng trong ảnh có cờ quốc gia và avatar chồng nhau. Mọi con số trên màn hình
   phải tới từ một endpoint có thật. **Cấm dữ liệu mẫu ghi cứng**, kể cả "tạm để nhìn cho đẹp" — một
   biểu đồ đẹp vẽ bằng số bịa tệ hơn không có biểu đồ.
4. **Bảng màu của `apps/web`.** Xanh/đỏ lãi-lỗ và hoàng thổ có luật riêng ở PLAN 9.1, và hàng rào
   `mau-token.spec.ts` **chỉ quét `apps/web`**. Chép bảng ấy sang đây là dựng một bản sao không ai
   canh — đúng lý lẽ đã viết sẵn trong docstring đầu `apps/admin/app/globals.css`. Khu quản trị giữ
   **hệ token riêng, tên riêng**; §2.4 thêm hàng rào cho chiều ngược lại.
5. **Không đụng `apps/web`.** Lượt này chạm `api/` và `apps/admin/` (cộng bài đo + tài liệu). Sửa
   một dòng nào của `apps/web` không phải bài đo thì phải nêu trong báo cáo kèm lý do.

---

## 1. Chuẩn giao diện, tả bằng CHỮ

Người thực thi **không nhìn thấy ảnh**. Mục này là bản đặc tả thay cho ảnh — làm theo mục này.

### 1.1 Bố cục tổng

```
┌────────────┬──────────────────────────────────────────────────────────┐
│            │ ☰   [ 🔍 Tìm mạch / người dùng… ]        🔔²  👤  ⚙      │ ← thanh trên, dính
│  gikky     ├──────────────────────────────────────────────────────────┤
│  QUẢN TRỊ  │  KIỂM DUYỆT                                              │ ← breadcrumb (nhỏ, mờ)
│            │  Hàng đợi báo cáo                    [ hành động chính ] │ ← H1 + nút
│ TỔNG QUAN  │                                                          │
│ ▸ Bảng đk  │  ┌─────────┐┌─────────┐┌─────────┐┌─────────┐            │ ← hàng thẻ KPI
│            │  │CHỜ XỬ LÝ││ HÔM NAY ││  MẠCH   ││ NGƯỜI…  │            │
│ KIỂM DUYỆT │  │   7   ⚑ ││  12   ⏱ ││ 1.204   ││  588    │            │
│ ▸ Hàng đợi²│  └─────────┘└─────────┘└─────────┘└─────────┘            │
│ ▸ Mạch     │  ┌────────────────────────────┐┌────────────────────┐    │
│ ▸ Bình luận│  │ Hoạt động                  ││ Mạch               │    │
│ ▸ Nhật ký  │  │ 30 ngày qua            ⋮  ││ Theo trạng thái ⋮ │    │
│            │  │  ▮▮▮ cột nhóm 3 chuỗi      ││   ◍ vành khuyên    │    │
│ CỘNG ĐỒNG  │  └────────────────────────────┘└────────────────────┘    │
│ ▸ Người dùng│ ┌──────────────────────────────────────────────────┐    │
│ ▸ Chuyên mục│ │ Chuyên mục · nhiều mạch nhất                     │    │
│            │  │ SLUG   TÊN        SỐ MẠCH   30 NGÀY   ▬▬▬  63%   │    │
│ HỆ THỐNG   │  └──────────────────────────────────────────────────┘    │
│ ▸ Tình trạng│                                                         │
└────────────┴──────────────────────────────────────────────────────────┘
```

- Sidebar rộng **260px**, nền khác nền trang, viền phải 1px, **cuộn riêng**, logo ghim trên cùng.
- Gập lại còn **rail 72px** (chỉ icon + tooltip). Trạng thái gập **nhớ** qua `localStorage`.
- Dưới **1024px**: sidebar thành **ngăn kéo** trượt từ trái có lớp phủ; đóng bằng lớp phủ, `Esc`,
  hoặc chọn một mục. Focus **bẫy trong ngăn kéo** khi mở.
- Thanh trên cao **64px**, dính, nền hơi mờ.
- Vùng nội dung `max-width` **1440px**, padding 24px (16px ở mobile).

### 1.2 Nhóm mục trong sidebar

Nhãn nhóm: 11px, in hoa, giãn chữ, mực mờ, **không bấm được**. Mục con: icon 20px + nhãn, cao 40px,
bo 8px; mục **đang mở** nền nhấn mờ + chữ nhấn + vạch trái 3px. Nhóm có mục con thì gập được, trạng
thái gập nhớ theo nhóm.

Icon: **SVG viết tay trong repo** (`components/icon.tsx`), stroke 1.5px, 20×20, `currentColor`.
**Không thêm package icon** — 12 icon không đáng một dependency, và một bộ icon 300KB tải vào khu
quản trị là thứ không ai gỡ ra nữa.

### 1.3 Thẻ

Nền `--nen`, viền 1px `--vien`, bo 10px, bóng rất mỏng. Header thẻ hai dòng: dòng 1 nhỏ + mờ (loại),
dòng 2 đậm hơn (phạm vi) — đúng cặp *"Conversions / This year"* trong ảnh. Nút `⋮` **chỉ vẽ khi có
menu thật** (vd "Đổi phạm vi"); không có thì không vẽ.

### 1.4 Biểu đồ — quyết định: **SVG viết tay, không thêm thư viện vẽ**

Ba dạng cần: **cột nhóm**, **vành khuyên**, **thanh tiến độ**. Lý do không dùng chart lib:

1. **Bộ đo.** Chart.js vẽ lên `<canvas>` — Playwright **không đọc được** con số trong đó, nên bài đo
   duy nhất còn lại là so ảnh, thứ repo này không có và không nên có. SVG thì `<rect height="…">`
   đọc được, tức biểu đồ **kiểm chứng được bằng DOM**.
2. **Khối lượng.** Ba dạng biểu đồ tĩnh ≈ 200 dòng SVG; recharts kéo theo cả cụm `d3-*`.
3. Tailwind lo *layout và màu*, không lo *vẽ*. Thêm thư viện vẽ là thêm một hệ thứ ba.

**Quyết định này lật được**, nhưng lật thì ghi vào plan con và phải trả lời được câu hỏi bài đo ở
trên. Bắt buộc kèm: mỗi biểu đồ có **bảng số tương đương** cho screen reader (`sr-only` của Tailwind)
— một biểu đồ không đọc được bằng bàn phím là biểu đồ mà nửa số người dùng không có.

### 1.5 Theme sáng / tối / theo hệ thống

Ba trạng thái, nhớ lựa chọn. **Dễ hơn `apps/web` nhiều**: khu quản trị không ISR, không cache, nên
không có bẫy "nướng lựa chọn của một người vào HTML dùng chung". Vẫn giữ đúng kỹ thuật: **script
inline chạy trước lần vẽ đầu tiên** đặt `data-theme` lên `<html>` + `color-scheme` theo cùng.

⚠ Script inline **giải** "theo hệ thống" thành một giá trị cụ thể (`sang`/`toi`) rồi mới ghi
`data-theme`. CSS vì thế **chỉ phải biết hai trạng thái** — không có nhánh `prefers-color-scheme`
trong CSS, tức không có cơ hội để hai nhánh trôi khỏi nhau (đúng lỗi mà `apps/web` phải cẩn thận).
Đổi lại: khi đang ở chế độ "theo hệ thống" thì phải **nghe `matchMedia`** để đổi theo lúc chạy.

---

## 2. Tailwind — phạm vi, cách gắn, và cái phải canh

### 2.1 Phạm vi: **`apps/admin` và chỉ ở đó**

`apps/web` giữ nguyên CSS Modules + token. Lý do không lan sang:
- `apps/web` có **hàng rào màu suy từ PLAN 9.1** ghim tới từng *selector CSS*
  (`mau-token.spec.ts` luật 3). Tailwind xoá selector, thay bằng chuỗi class trong TSX ⇒ hàng rào ấy
  mất chỗ bám và phải viết lại từ đầu. Đó là một lượt riêng, không phải phần thưởng kèm theo.
- Phạm vi user giao là **phần quản trị**. Kéo `apps/web` vào là tự mở rộng việc.

⇒ `PLAN.md` 8.1 sửa từ "không Tailwind" thành "`apps/web`: CSS Modules + token · `apps/admin`:
Tailwind" — **thu hẹp có ghi chép**, không phải im lặng làm ngược.

### 2.2 Cài gì, ở đâu

**Tailwind v4** (`tailwindcss` + `@tailwindcss/postcss`), khai trong `apps/admin/package.json`,
`postcss.config.mjs` đặt **trong `apps/admin/`**.

⚠ **Cấm đặt PostCSS config ở gốc repo.** Next đi ngược cây thư mục tìm config; một
`postcss.config.mjs` ở gốc sẽ chui vào **cả `apps/web`** và đổi pipeline CSS của app mà lượt này
không được chạm. Hỏng kiểu này không đỏ ngay — nó ra một `next build` vẫn xanh với CSS khác đi.

⚠ **`.npmrc` có `public-hoist-pattern[]=*eslint*`** vì node_modules cô lập của pnpm. Tailwind v4
không cần hoist, nhưng nếu `next build` báo không tìm thấy `@tailwindcss/postcss` thì **đừng thêm
wildcard hoist** — kiểm lại chỗ khai dependency trước.

### 2.3 Token: khai **một lần** trong `@theme`, dùng bằng tên tiếng Việt

```css
@import "tailwindcss";

@theme {
  --color-nen: …;        --color-nen-mo: …;     --color-nen-sidebar: …;
  --color-muc: …;        --color-muc-mo: …;     --color-vien: …;
  --color-nhan: …;       --color-nhan-mo: …;
  --color-tot: …;        --color-xau: …;        --color-chu-y: …;
  --color-chuoi-1: …;    /* 4 màu chuỗi biểu đồ */
}

@custom-variant toi (&:where([data-theme="toi"], [data-theme="toi"] *));
```

Dùng: `bg-nen`, `text-muc-mo`, `border-vien`, `toi:bg-nen-sidebar`. Giữ **tên tiếng Việt đang có**
trong `globals.css` — đổi tên token cùng lúc với đổi hệ CSS là hai thay đổi chồng nhau trong một
lượt, và khi có gì hỏng thì không biết tại cái nào.

**Màu "tốt/xấu" của khu quản trị phải là mã KHÁC** với xanh/đỏ lãi-lỗ của PLAN 9.1, và tài liệu ghi
rõ nó không phải màu lãi/lỗ.

### 2.4 Hàng rào bắt buộc: **cấm màu ứng biến**

Tailwind mở đúng một cửa mà hệ token đóng: `bg-[#B33A2B]`, `text-[rgb(…)]`, `style={{color:"#..."}}`.
Đó là cách nhanh nhất để một mã màu lọt vào lúc nửa đêm, và nó **không** rơi vào bất kỳ hàng rào nào
đang có.

⇒ `e2e/don-vi/mau-quan-tri.spec.ts` (mới), quét **mọi file** trong `apps/admin/`:
1. **Cấm tuyệt đối 8 mã hex có luật riêng ở PLAN 9.1** — `#1C7A4F` `#B33A2B` `#43BE83` `#E4776A`
   `#B07A2B` `#F5EBDA` `#D8A455` `#2A2318` (§0 điểm 4).
2. **Cấm mọi giá trị màu ứng biến**: `-[#…]`, `-[rgb(`, `-[hsl(`, `-[oklch(` trong class, và literal
   màu trong `style={{…}}`. Nơi duy nhất được viết mã hex là **khối `@theme`** của `globals.css`.

Đây là hàng rào **rẻ nhất** của cả lượt và nó là cái giữ cho quyết định "dùng Tailwind" không biến
thành "mỗi component một bảng màu". Làm ở M2, **đừng để cuối**.

### 2.5 Di trú phải TRỌN, không nửa vời

`globals.css` hiện có 11 class dùng khắp 7 trang: `.vo` `.dieu-huong` `.the` `.loi` `.mono`
`.hang-nut` `.cuon-ngang` `.nhan-an` `.nhan-khoi` `.tra-cuu*`. Sau lượt này **không được còn hai hệ
song song** — hai hệ nghĩa là hệ cũ mục ruỗng dần và không ai biết chỗ nào đang theo hệ nào.

Chọn **một** và ghi vào báo cáo:
- **(a)** xoá hết class cũ, mọi chỗ dùng utility; hoặc
- **(b)** giữ lại một nhóm nhỏ **có chủ đích** trong `@layer components` (ứng viên hợp lý: `.mono`
  — nó là quy ước "timestamp và con số dùng font mono, `tabular-nums`", một *ý nghĩa*, không phải
  một chùm utility).

Không chọn = tự động thành (c) "còn sót", tức lựa chọn tệ nhất.

⚠ **`.dieu-huong strong { margin-right: auto }` sắp biến mất cùng thanh điều hướng cũ** — nhưng cái
bẫy nó ghi lại thì không: **hai `margin: auto` trên cùng một hàng flex thì flexbox chia đôi khoảng
trống và cả hai cụm trôi ra giữa**. Đã dính thật một lần ở `apps/web/components/chrome.tsx`. Thanh
trên mới có 3 cụm (trái/giữa/phải) ⇒ đúng chỗ để dính lần nữa. Dùng `justify-between` + `flex-1`,
đừng rải `ml-auto`.

### 2.6 Còn lại

- `pnpm lint` chạy `--max-warnings=0` — giữ nguyên mốc.
- **Không thêm plugin eslint cho Tailwind** ở lượt này (hỗ trợ v4 còn chắp vá; một plugin cảnh báo
  sai là một mốc 0-warning bị nới ra để đi tiếp).
- `next build` của **cả hai** app phải sạch — chứng minh `apps/web` không bị ảnh hưởng.

---

## 3. Backend — endpoint mới

Khoá `admin` đã đăng ký trong `api_registry.py` và subpath `@gikky/api-client/admin` đã có, nên
**không phải làm lại 3 việc** của một `NinjaAPI` mới. Nhưng vẫn: **mọi endpoint khai `operation_id`
tường minh**, rồi `pnpm codegen`.

| Method & path | Việc | Ràng buộc |
|---|---|---|
| `GET /admin/thong-ke` | số liệu cho bảng điều khiển | §3.1 |
| `GET /admin/machs` | liệt kê mạch cho mod | `?q= &sub= &trang_thai=tat_ca\|mo\|dong\|bi_khoa\|bi_an &tac_gia= &limit &cursor`; **có cả mạch bị ẩn** — mod phải thấy để phán xử |
| `GET /admin/comments` | liệt kê bình luận | `?q= &tac_gia= &trang_thai=tat_ca\|bi_an\|bia_mo &mach_id= &limit &cursor`; **có cả bia mộ và bị ẩn** |
| `GET /admin/users` | liệt kê người dùng | `?q= &trang_thai=tat_ca\|bi_ban\|staff\|moi &limit &cursor`; mỗi dòng kèm `so_mach`, `so_binh_luan`, trạng thái ban |
| `POST /admin/hang-loat/an` | ẩn / gỡ ẩn nhiều đích | §3.2 |
| `POST /admin/hang-loat/dong-bao-cao` | đóng nhiều báo cáo | cùng luật §3.2; vẫn **chỉ ghi lại, không thi hành** |
| `GET /admin/tinh-trang` | sức khoẻ hệ thống | §3.3 |
| `GET /admin/staff` | danh sách tài khoản `is_staff` | **CHỈ ĐỌC** — §3.4 |
| `GET /admin/nhat-ky` *(mở rộng)* | thêm `?actor= &tu= &den= &target_type=` | giữ `?action=` **so bằng đúng** như cũ — docstring hiện tại giải thích vì sao không `icontains` (`an_moc` vs `go_an_moc`), **đừng nới** |
| `GET /admin/reports` *(mở rộng)* | thêm `?ly_do= &target_type=` | giữ nguyên hợp đồng cũ |

### 3.1 `GET /admin/thong-ke` — chỗ dễ đẻ truy vấn chậm nhất

Trả về: `tong {nguoi_dung, mach, moc, binh_luan, sub}` · `cho_xu_ly` *(cũng là số badge chuông)* ·
`hom_nay` / `bay_ngay` `{mach_moi, moc_moi, binh_luan_moi, nguoi_dung_moi}` · `chuoi_ngay` **đúng 30
phần tử** `{ngay, mach_moi, moc_moi, binh_luan_moi}` · `theo_trang_thai {mo, dong, bi_khoa, bi_an}` ·
`top_sub` ≤8 dòng `{slug, ten, so_mach, so_mach_30_ngay}`.

⚠ **Ba cái bẫy, cả ba im lặng:**

1. **Ngày phải là ngày VIỆT NAM.** `TruncDate` chạy theo `TIME_ZONE`; gom nhóm theo UTC thì mọi thứ
   xảy ra sau 07:00 giờ VN rơi sang ô hôm trước — và biểu đồ vẫn trông hoàn toàn bình thường. Dùng
   đúng lối `core/thoi_gian.py` mà `dem_moc_trong_ngay_vn` đang dùng. **Bài đo phải có ca biên
   23:50 / 00:10 giờ VN** (repo đã có tiền lệ ở Phase 3).
2. **Ngày rỗng phải có mặt.** `GROUP BY` chỉ trả ngày có dữ liệu; frontend nhận 11 điểm cho 30 ngày
   rồi vẽ một biểu đồ dày đặc giả. **Server** trám đủ 30 ô, không phải frontend.
3. **Số truy vấn phải có trần.** Endpoint này chạy mỗi lần mở bảng điều khiển. Bài đo dùng
   `assertNumQueries` ghim **≤ 12** — con số cụ thể chốt lúc làm, nhưng phải **có** một con số, nếu
   không nó trôi lên 40 sau ba lượt sửa mà không ai thấy.

`Cache-Control: no-store` như mọi thứ trong khu quản trị.

### 3.2 Hành động hàng loạt — chỗ dễ hỏng nhất của cả lượt

Thân `{loai: "mach"|"moc"|"comment", ids: [int], an: bool, ly_do?: str}`, trần **50 id**/lần. Trả về
**kết quả từng id** (`{id, da_doi, loi?}`), không phải `ok: true` — một lượt hàng loạt báo thành công
trong khi 3/50 đích đã bị xoá là một báo cáo sai.

**Luật, không thương lượng:**

- **Đi qua `core/ghi.py::dat_an_mach` / `dat_an_moc` / `dat_an_binh_luan`.** Cấm `.update(hidden_at=…)`.
  Đó chính xác là **lỗi L32** trong sổ: bỏ qua `dong_bo_kho_anh` ⇒ ảnh của mốc bị ẩn **vẫn phục vụ
  được** qua `/media/`; bỏ qua `dong_bo_mach` ⇒ mạch vừa ẩn **vẫn nằm trong kết quả tìm kiếm**. Cả
  hai hỏng im lặng, cả hai trả 200.
- **Mỗi id một `atomic()` riêng**, không gói cả 50 vào một transaction. Lý do là thứ tự khoá: chuỗi
  bắt buộc là `Comment/Moc → Mach → MocAnh`. Gói 50 đích vào một transaction là giữ khoá trên nhiều
  hàng `Mach` cùng lúc theo thứ tự người gọi đưa vào — hai lượt hàng loạt chạy đồng thời sẽ
  **deadlock thật**, và nó chỉ lộ dưới tải.
- **Sắp `ids` tăng dần và loại trùng** trước khi chạy. Rẻ, đóng nốt cửa còn lại.
- **Mỗi id một dòng `AuditLog`**, không phải một dòng cho cả lượt — nhật ký là bằng chứng cho từng
  đối tượng.

### 3.3 `GET /admin/tinh-trang`

`{db: {ok, ms}, tim_kiem: {bat, so_tai_lieu}, anh: {so_anh, so_anh_cach_ly}, phien_ban: {django, python}}`.

⚠ **Cấm duyệt cây thư mục `MEDIA_ROOT`** để tính dung lượng: nó chạy mỗi lần mở trang và chậm tuyến
tính theo số ảnh — đúng loại "trang admin tự làm mình sập" khi dữ liệu lớn lên. Đếm bằng cột trong DB.

### 3.4 Tài khoản mod: **liệt kê được, cấp quyền thì không**

`GET /admin/staff` chỉ đọc. **Không** làm endpoint bật/tắt `is_staff` từ khu quản trị, dù "admin đầy
đủ tính năng" nghe như phải có. Ba lý do, cái thứ ba mới quyết định:

1. Đó là leo thang đặc quyền: một mod cấp quyền mod cho tài khoản khác là bỏ qua mọi phép duyệt.
2. `ban_user` **từ chối ban một mod khác** (409) ⇒ ai tự cấp `is_staff` thì tự miễn nhiễm ban.
3. Django admin ở `/api/admin/django/` đã làm việc này, chỉ superuser vào được, và nó có log riêng.
   Dựng cửa thứ hai là dựng thêm một cửa phải canh.

Trang "Tài khoản mod" có **link ra Django admin** cho việc cấp quyền, và nói thẳng vì sao.

---

## 4. Màn hình — mỗi dòng phải có endpoint thật

| Nhóm | Trang | Đường dẫn | Đọc từ | Hành động trên trang |
|---|---|---|---|---|
| TỔNG QUAN | Bảng điều khiển | `/` | `thong-ke` | — (chỉ xem) |
| KIỂM DUYỆT | Hàng đợi báo cáo | `/bao-cao` | `reports` | ẩn/gỡ · khoá/mở · ban/gỡ ban · ghi&đóng · **chọn nhiều → đóng hàng loạt** |
| KIỂM DUYỆT | Mạch | `/machs` | `machs` | ẩn/gỡ · khoá/mở · **chọn nhiều** · mở chi tiết |
| KIỂM DUYỆT | Bình luận | `/binh-luan` | `comments` | ẩn/gỡ · **chọn nhiều** · nhảy tới mạch |
| KIỂM DUYỆT | Nhật ký | `/nhat-ky` | `nhat-ky` | lọc (hành động · mod · khoảng ngày) — **chỉ đọc** |
| CỘNG ĐỒNG | Người dùng | `/users` | `users` | ban/gỡ ban ngay trên hàng · mở hồ sơ |
| CỘNG ĐỒNG | Chuyên mục | `/subs` | `subs` | CRUD (đã có, **thay áo**) |
| HỆ THỐNG | Tình trạng | `/tinh-trang` | `tinh-trang` | — |
| HỆ THỐNG | Tài khoản mod | `/staff` | `staff` | — + link Django admin |
| *(chi tiết)* | Mạch | `/m/[machId]` | `machs/{id}` | giữ, thay áo |
| *(chi tiết)* | Người dùng | `/u/[username]` | `users/{username}` | giữ, thay áo |

`/chan-doan` giữ nguyên chức năng. `/dang-nhap` **nằm ngoài khung** (chưa đăng nhập thì không sidebar).

**Trang `/` đổi vai**: hôm nay `/` là hàng đợi báo cáo; sau lượt này `/` là bảng điều khiển, hàng đợi
dời sang `/bao-cao`. ⚠ Mọi link nội bộ, `data-testid`, và bài đo đang trỏ `/` phải đổi **cùng lượt** —
và hàng đợi vẫn là **mục đầu tiên** của nhóm KIỂM DUYỆT, vì nó vẫn là màn hình ưu tiên số một của
PLAN 9.3.

**Ba thứ bắt buộc trên mọi bảng danh sách** (thiếu là bảng dùng được ở dev và vô dụng ở prod):
1. **Trạng thái rỗng có chữ**, phân biệt "không có gì" với "bộ lọc này không ra gì".
2. **Skeleton khi tải**, không phải khoảng trắng.
3. **Lỗi hiện ra** (dùng `moTaLoi` sẵn có), không nuốt vào console.

**Phân trang: cursor keyset, không offset.** `api/api/phan_trang.py` đã có hàm. Lý do riêng của ứng
dụng này chứ không phải sở thích: mod **đang ẩn nội dung trong lúc đọc bảng**, tức tập kết quả co
lại dưới chân họ; offset khi đó **nhảy cóc qua hàng chưa xem**, và cái bị bỏ sót là một báo cáo chưa
ai xử. Nút "Tải thêm", không phải số trang.

---

## 5. Luật cũ phải giữ (đọc trước khi gõ dòng đầu tiên)

1. **Thứ tự khoá `Comment/Moc → Mach → MocAnh`.** Khoá NGẦM cũng tính (`INSERT` lấy `FOR KEY SHARE`
   trên hàng được tham chiếu).
2. **`cap_nhat_dem_mach` gọi TRONG một `atomic()`.**
3. **Mọi hành động mod ⇒ một dòng `AuditLog`, cùng transaction** (`core/ghi.py::ghi_audit`).
4. **`AuditLog` không mang STATE.** Cấm dựng bảng điều khiển bằng cách replay log — trạng thái nằm ở
   `hidden_at`/`locked_at`/`ban*`.
5. **Type một chiều.** `packages/api-client/src-admin` là file **sinh ra**; sửa Django rồi `pnpm codegen`.
   Frontend **cấm tự khai interface** trùng API.
6. **Cấm `client` singleton**, mọi lời gọi kèm `baseUrl` — `type-admin.spec.ts` đang canh.
7. **Cấm gọi hàm API qua biến trung gian** (hàng rào tìm theo tên hàm).
8. **`pytest` chạy `filterwarnings = ["error"]`.**
9. **0 warning là MỐC**, không phải mong muốn.
10. **Không commit / push / deploy.** Phiên chính commit khi user bảo; stage chọn lọc, không `git add -A`.

---

## 6. Bộ đo — chỗ yếu nhất hiện nay

### 6.1 Khu quản trị hiện có **0 bài đo trình duyệt**

`hang-doi-quan-tri.spec.ts` và `type-admin.spec.ts` là bài đo **tĩnh** (đọc mã nguồn). Không dòng nào
mở trình duyệt vào cổng 3001. Viết lại toàn bộ giao diện khu quản trị **và** đổi hệ CSS mà không có
lưới an toàn nào là đúng cách sinh ra một sổ lỗi 15 mục lần nữa.

⇒ **Thêm project `quan-tri`** vào `apps/web/playwright.config.ts`: `webServer` thứ ba (build + start
`apps/admin` ở **3001**), `baseURL` 3001, `testMatch` `quan-tri[\\/]`, spec ở `apps/web/e2e/quan-tri/`.

**Vì sao nhét vào config của `apps/web` chứ không dựng config riêng cho `apps/admin`** — biết là
trông ngược: hai config nghĩa là **hai bộ cùng seed `gikky_dev` và cùng giành cổng**, đúng cái nguy
hiểm mà `D:\Projects\CLAUDE.md` chia độc quyền tài nguyên để tránh, và số rác trông y hệt số thật.
Một `globalSetup`, một DB, một lệnh.

⚠ Hệ quả ghi vào `CLAUDE.md`: **`pnpm e2e` từ nay chiếm 3000 + 3001 + 8000.**
⚠ `e2e/don-vi/cau-hinh.spec.ts` đang ghim ràng buộc của hai object config ⇒ phải sửa. **Chỉ được mở
rộng, không được nới**: `playwright.don-vi.config.ts` vẫn **cấm** mọc lại `webServer`/`globalSetup`.

Đăng nhập trong e2e: seed đã có tài khoản `is_staff` (`mod_gikky`) — dùng nó, **đừng tạo superuser
trong bộ đo**. Nhớ allauth đăng nhập **bằng email**, không phải username.

### 6.2 Bài đo trình duyệt tối thiểu (project `quan-tri`)

| # | Đo gì |
|---|---|
| B1 | Khách chưa đăng nhập vào `/` ⇒ màn "chưa đăng nhập", **không** thấy sidebar |
| B2 | User thường (không staff) ⇒ màn `khong_du_quyen`, khác hẳn B1 |
| B3 | Mod đăng nhập ⇒ bảng điều khiển hiện **số thật**, khớp `GET /admin/thong-ke` gọi thẳng |
| B4 | Điều hướng **mọi** mục sidebar ⇒ mỗi trang render, **0 lỗi console**, không 404 |
| B5 | Ẩn một mạch từ `/machs` ⇒ trang công khai `:3000` trả 404 |
| B6 | Ẩn hàng loạt 3 bình luận ⇒ cả 3 biến khỏi trang công khai **và** `comment_count` đúng |
| B7 | Theme: 3 trạng thái, sống qua tải lại, **không FOUC** ở chế độ Tối |
| B8 | Sidebar gập/mở nhớ trạng thái; ở 375px thành ngăn kéo, `Esc` đóng, focus bị bẫy |
| B9 | Đi hết bảng điều khiển bằng **bàn phím**; vòng focus thấy được ở **cả hai** theme |
| B10 | Badge chuông = số báo cáo đang chờ; xử một cái ⇒ badge giảm |

### 6.3 Hàng rào cấu trúc (nhóm `don-vi` — rẻ, và bắt đúng loài lỗi của lượt này)

| # | Hàng rào | Bắt cái gì |
|---|---|---|
| C1 | `mau-quan-tri.spec.ts` — cấm 8 hex của PLAN 9.1 **và** mọi màu ứng biến trong `apps/admin/` | §2.4: Tailwind mở cửa `bg-[#…]` |
| C2 | **Mọi `href` trong `menu.ts` phải có `app/**/page.tsx` tương ứng** | **nút chết** — chép menu từ template |
| C3 | **Liệt kê mọi endpoint GHI của `api/api/quan_tri_*.py`, mỗi cái phải có test chứng minh nó ghi `AuditLog`** | endpoint mới quên nhật ký |
| C4 | Mở rộng `type-admin.spec.ts` sang trang mới: mọi lời gọi API kèm `baseUrl` | `client` singleton lẻn vào |
| C5 | Tương phản **AA** mọi cặp chữ/nền khu quản trị, **cả hai theme**, đo bằng số | copy lối `tuong-phan.spec.ts` |

⚠ C3 là bài đo kiểu **"liệt kê MỌI đường rồi ép mỗi đường phải làm X"** — chính loài mà CLAUDE.md
cảnh báo là **xanh giả trên cây cũ**. Nó chỉ có nghĩa nếu chạy trên cây đã `merge --ff-only main`.

### 6.4 Luật cấm nới bài đo

- Bài đo phải sửa vì bố cục đổi ⇒ **chỉ đổi locator, không nới khẳng định**.
- **Không `test.skip`, không xoá bài đo.** Bài nào thật sự hết nghĩa thì **báo**, đừng tự xoá.
- **Liệt kê ĐẦY ĐỦ mọi bài đo đã chạm**, mỗi cái một câu lý do.
- `data-testid` là hợp đồng: đổi thì đổi cả hai đầu và nói ra.
- **Thêm test mới thì THỬ PHÁ**: sửa ngược code cho hỏng → test phải ĐỎ → khôi phục.

---

## 7. Chia mảng lớn

User đã chốt cách làm: **làm từng mảng lớn, review và nghiệm thu ở cuối**, không chấm giữa chừng.

| Mảng | Nội dung | Phụ thuộc |
|---|---|---|
| **M1 — Backend** | 8 endpoint mới + 2 mở rộng · schema · pytest · hàng rào C3 · `pnpm codegen` | — |
| **M2 — Nền Tailwind + khung** | cài Tailwind v4 trong `apps/admin` · `@theme` token · di trú §2.5 · layout shell (sidebar/topbar/breadcrumb/ngăn kéo) · theme 3 trạng thái · icon SVG · hàng rào C1, C2 | — |
| **M3 — Bảng điều khiển** | thẻ KPI · cột nhóm · vành khuyên · bảng top sub · bảng số cho screen reader | M1, M2 |
| **M4 — Kiểm duyệt** | `/bao-cao` (nâng cấp + chọn nhiều) · `/machs` · `/binh-luan` · component chọn-nhiều dùng chung · `/` đổi vai | M1, M2 |
| **M5 — Cộng đồng + hệ thống** | `/users` · `/subs` thay áo · `/nhat-ky` + bộ lọc · `/tinh-trang` · `/staff` · hai trang chi tiết thay áo | M1, M2 |
| **M6 — Bộ đo trình duyệt** | project `quan-tri` + B1–B10 + C4, C5 + a11y/mobile | M3, M4, M5 |
| **M7 — Tài liệu** | PLAN 7 · **8.1** · **9.3** · 10 · `CLAUDE.md` (cổng 3001 + Tailwind) · `README` · `LOI-VA-NO.md` | tất cả |

**Chạy song song:** M1 và M2 độc lập ⇒ hai agent cùng lúc, **hai worktree, hai DB riêng** (M1 cần
DB, M2 gần như không). M3/M4/M5 chạm chung `menu.ts` và token ⇒ **nối tiếp, hoặc cùng một agent** —
đừng ba agent cùng sửa một hệ CSS vừa dựng. M6 sau cùng, **một mình, độc quyền 3000+3001+8000**.

**Nghiệm thu + phản biện chỉ chạy MỘT LẦN, ở cuối** (theo ý user), trên cây đã gộp đủ M1–M7. Khi đó
áp luật chia độc quyền: `nghiem-thu` chạy build + e2e; `phan-bien` chỉ đọc code + `pnpm e2e:don-vi`
+ SQL chỉ đọc.

---

## 8. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| Q1 | 8 endpoint mới + 2 mở rộng chạy; **mỗi cái `operation_id` tường minh**; `pnpm codegen:check` sạch |
| Q2 | `thong-ke`: gom nhóm theo **ngày VN** (có ca biên 23:50/00:10) · **đủ 30 ô kể cả ngày rỗng** · `assertNumQueries` có trần |
| Q3 | Hàng loạt đi qua `core/ghi.py`: **mutant đổi sang `.update(hidden_at=…)` ⇒ bài đo ĐỎ** (ảnh còn phục vụ / còn trong index) |
| Q4 | Hàng loạt: mỗi id **một** dòng `AuditLog` · kết quả trả **theo từng id** · trần 50 · ids sắp tăng dần |
| Q5 | Hàng rào C3 chạy: **thêm một endpoint ghi mà quên `AuditLog` ⇒ ĐỎ** (chứng minh bằng mutant) |
| Q6 | Không endpoint nào bật/tắt `is_staff`; `/staff` chỉ đọc, có link Django admin |
| Q7 | Mọi mục sidebar dẫn tới trang có thật (**C2**, chứng minh bằng mutant thêm mục giả) |
| Q8 | **Không nút chết nào**: mọi nút gọi một endpoint có thật hoặc làm một việc client thật |
| Q9 | **C1 xanh**: không hex nào của PLAN 9.1 và **không màu ứng biến nào** trong `apps/admin/` |
| Q10 | Tailwind **chỉ ở `apps/admin`**: không PostCSS config ở gốc; `apps/web` build ra CSS không đổi |
| Q11 | Di trú CSS **trọn** theo §2.5 (a) hoặc (b) — báo cáo nói rõ chọn cái nào và còn lại class nào |
| Q12 | Theme 3 trạng thái, nhớ lựa chọn, **không FOUC** ở chế độ Tối; đổi `prefers-color-scheme` lúc đang ở "theo hệ thống" ⇒ đổi theo |
| Q13 | Sidebar: gập nhớ trạng thái · ngăn kéo ở 375px · `Esc` đóng · focus bẫy trong ngăn kéo |
| Q14 | Tương phản **AA** cả hai theme, **đo bằng số** (C5) |
| Q15 | Không cuộn ngang ở 360px; vùng bấm ≥ 44px; mọi bảng cuộn trong khung riêng |
| Q16 | Biểu đồ **đọc được bằng DOM** (không canvas) và có bảng số tương đương cho screen reader |
| Q17 | Phân trang **cursor keyset** ở cả 4 danh sách; không endpoint nào dùng offset |
| Q18 | Project e2e `quan-tri` chạy, **B1–B10 xanh**; `playwright.don-vi.config.ts` **vẫn không** có `webServer`/`globalSetup` |
| Q19 | Ẩn từ khu quản trị ⇒ biến khỏi trang công khai **và** khỏi kết quả tìm kiếm (B5, B6) |
| Q20 | Không hồi quy: Python **≥ 986 pass**, e2e **≥ 448** cộng bài mới, `pnpm lint`/`build`/`tsc` **0 warning** |
| Q21 | `PLAN.md` mục 7 · **8.1 (Tailwind)** · **9.3 viết lại** · mục 10 thêm Phase 8; `CLAUDE.md` ghi cổng 3001 + Tailwind; `README` đúng |
| Q22 | Báo cáo liệt kê **đầy đủ** bài đo đã chạm, mỗi cái một câu lý do; nói rõ số nào đo ở cây nào |

---

## 9. Không làm ở lượt này (đừng lấn)

- **Tailwind cho `apps/web`** — §2.1. Muốn thì là một lượt riêng, và nó phải viết lại hàng rào màu
  của PLAN 9.1 trước.
- Cấp/thu quyền `is_staff` từ UI (§3.4) — Django admin lo.
- Sửa nội dung mạch/mốc/bình luận **thay mặt** tác giả. Mod ẩn được, không viết hộ được; một cửa sửa
  nội dung của người khác đổi bản chất sản phẩm, phải là quyết định riêng của user.
- Xoá cứng bất cứ thứ gì. Toàn bộ moderation của gikky là **ẩn**, có bia mộ, đảo ngược được.
- Xuất CSV / báo cáo định kỳ / email cho mod.
- Đa ngôn ngữ, widget tuỳ biến, layout kéo thả — có trong ảnh, **không có** trong sản phẩm.
- Sửa `PLAN.md` 9.1 (bảng màu) — băm SHA-256 của mục đó bị ghim, và lượt này không có lý do chạm.
- Hai nợ đang mở **L43** (hoàng thổ chưa đạt AA ở `apps/web`) và **L44** (16 bài search skip) — khác
  vùng, khác việc. Đừng gộp vào đây.

---

## 10. Giá phải trả, nói trước

Đây là lượt **lớn nhất kể từ Phase 4**: 10 endpoint, 9 trang (5 mới + 4 thay áo), **một hệ CSS mới
thay cho hệ đang dùng**, và một project e2e trình duyệt chưa từng tồn tại. Ước lượng thô: **ngang
Phase 4 cộng lượt giao diện Reddit gộp lại.**

Chỗ rẻ nhất để cắt nếu hết quota, theo thứ tự — cắt thì **nói ra**, đừng cắt im lặng:
1. `/tinh-trang` và `/staff` (M5) — tiện, không chặn ai.
2. Vành khuyên + bảng top sub ở bảng điều khiển; giữ thẻ KPI + biểu đồ cột.
3. Hành động hàng loạt (M4) — nhưng **đừng cắt nửa vời**: làm hàng loạt mà đi tắt qua `.update()`
   còn tệ hơn không làm.

**Không được cắt trong mọi trường hợp:** M6 (bộ đo trình duyệt) và ba hàng rào C1–C3. Đó là toàn bộ
phần khác nhau giữa lượt này và một lượt để lại sổ lỗi 15 mục.
