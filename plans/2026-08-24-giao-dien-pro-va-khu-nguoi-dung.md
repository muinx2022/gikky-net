# Giao diện front: header pro, bỏ khung thẻ, icon, khu người dùng

Chốt 2026-08-24 — user duyệt trực tiếp trong phiên (3 câu hỏi, xem §0).

## 0. Ba quyết định user đã chốt

| Câu hỏi | Chốt |
|---|---|
| Khu người dùng cần backend mới | **Tôi làm cả backend.** Avatar = **chữ cái sinh tự động**, KHÔNG upload |
| Icon lấy từ đâu | **`lucide-react`**, thêm vào `apps/web` |
| 16 file đợt mặt BÃO chưa commit | **Cứ làm tiếp, commit một thể** |

Hệ quả của chốt thứ nhất: **không có việc avatar nào ở backend cả** — không cột, không
kho ảnh, không kiểm duyệt ảnh, không hạn mức. Avatar là hàm thuần của `username`, vẽ ở
frontend. Backend chỉ còn 3 cửa đọc danh sách.

Hệ quả của chốt thứ ba: cây làm việc sẽ mang **cả hai** đợt. Báo cáo cuối phải tách rõ
con số nào thuộc đợt nào, vì gộp commit không có nghĩa là gộp bằng chứng.

## 1. Vấn đề, bằng lời của user

> "nhìn thiếu chuyên nghiệp quá, các card nhìn rõ ràng quá, thành ra lại chia khung trên
> web" · "Thiết kế lại phần header cho pro" · "Làm phần user (profile - avatar, quản lý
> các bài viết, đã like, vote, follow ...)" · "Thêm các icon vào các mục cho sinh động hơn"

Bốn việc, hai loại: ba việc thuần frontend, một việc cần cửa API mới.

---

# PHẦN A — Backend: 3 cửa đọc danh sách

## A1. Ba endpoint

Tất cả **đi vào `api_v1` đang có** (`api/api/v1.py`), file mới `api/api/ho_so.py`,
`add_router("", router_ho_so)`. **KHÔNG dựng `NinjaAPI` mới** ⇒ không chạm luật "thêm
NinjaAPI = đủ 3 việc" của `CLAUDE.md`, không sửa `api_registry.py`, không thêm subpath.

| Cửa | `operation_id` | auth | cache |
|---|---|---|---|
| `GET /users/{username}/machs` | `liet_ke_mach_cua_user` | không (công khai) | mặc định |
| `GET /me/da-vote` | `liet_ke_da_vote` | `dang_nhap` | **`no-store`** |
| `GET /me/dang-theo` | `liet_ke_dang_theo` | `dang_nhap` | **`no-store`** |

- **Phân trang keyset**, dùng lại `api/api/phan_trang.py`. Khoá `(created_at, id)` giảm
  dần — **khoá BẤT BIẾN**, đúng điều kiện mà docstring của file đó đòi. **Cấm** sort theo
  `diem_bai_goc` ở đây: file ấy đã ghi rõ khoá biến đổi làm keyset trùng/sót.
  - `/users/{username}/machs`: khoá là `Mach.created_at`;
  - hai cửa `/me/*`: khoá là `Vote.created_at` / `Follow.created_at` (thời điểm **tôi**
    vote/theo), không phải `Mach.created_at` — thứ tự người dùng mong đợi ở "đã vote" là
    thứ tự họ vote.
- Item trả về **dùng lại schema thẻ feed đang có** (`api/api/schemas.py`, cùng thứ
  `liet_ke_feed_moi` trả). Khai schema thứ hai cho cùng một cái thẻ là hai sự thật sẽ trôi.
- `/me/*` trả **`Cache-Control: no-store`** — per-user tuyệt đối, cùng luật `GET /me`
  (PLAN 8.4 điểm 4). Thiếu header này là bản cache của người này phục vụ người kia.

## A2. Luật ẩn — chỗ NGUY HIỂM nhất của phần A

Ba cửa này đọc **mạch qua một đường vòng** (qua `Vote`, qua `Follow`, qua `author`), nên
chúng rất dễ thành **cửa hậu đọc nội dung vừa bị mod gỡ**:

- lọc `Mach.hidden_at IS NULL` **và** `deleted_at IS NULL` ở cả ba cửa;
- `/users/{username}/machs` còn phải lọc theo trạng thái tài khoản y hệt `xem_ho_so` đang
  làm — đọc code đó trước, đừng chế luật thứ hai.

**Bài đo bắt buộc, và nó là bài đo QUAN TRỌNG NHẤT của phần A:** vote một mạch → mod ẩn
mạch → `GET /me/da-vote` **không** còn nó. Làm y vậy cho `dang-theo` và cho mạch bị xoá.
Không có bài này thì phần A là một lỗ rò nội dung, và nó trả HTTP 200 nên không ai thấy.

## A3. Số truy vấn

Thêm ca vào `api/tests/test_api_so_query.py` theo đúng khuôn đang có: mỗi cửa một
`assertNumQueries` với **trần ghim bằng số**, dựng dữ liệu ≥ 3 mạch để một lời gọi N+1
làm con số vọt lên. `select_related`/`prefetch_related` cho `author` + `sub`.

## A4. Sinh lại client

`pnpm codegen` rồi `pnpm codegen:check`. **Không sửa tay** `packages/api-client/src`.

---

# PHẦN B — Frontend

## B1. `lucide-react`

- `pnpm --filter @gikky/web add lucide-react`.
- **Import từng icon một** (`import { Bell } from "lucide-react"`), tuyệt đối không
  `import * as Icons`. App này bị đo Lighthouse và có ngưỡng ghim
  (`e2e/don-vi/lighthouse-nguong.spec.ts`) — import cả bộ là kéo vài trăm KB vào bundle
  client của trang công khai.
- Icon nhận màu từ `currentColor` ⇒ tự đi theo token và theme tối. **Cấm** đặt màu thẳng
  lên icon.

## B2. Header

Dựng lại `components/chrome.tsx` + `chrome.module.css`. Ba ràng buộc **không được đụng**,
mỗi cái đã có nợ trả bằng máu ghi trong docstring hiện tại:

1. Mọi thứ động vẫn là **client component** hỏi API trong `useEffect`. Một lời gọi phía
   server ở đây làm `/luat` hết `○` (tĩnh) — mà `/luat` là đường thoát của `error.tsx`.
   `pnpm build` phải vẫn in `○ /luat`.
2. `OTimKiem` vẫn nằm trong `<Suspense>` với `fallback` **cùng kích thước**, không `null`.
3. Danh sách sub vẫn hỏi `GET /subs`, **cấm** gõ cứng slug (nợ `NAV-GHI-CUNG`, hàng rào
   `e2e/don-vi/khong-ghi-cung-sub.spec.ts`).

## B3. Bớt khung — "card nhìn rõ ràng quá, thành ra chia khung"

Sửa `the-mach.module.css`, `feed.module.css`, `trang-mach.module.css` theo hướng: bỏ
viền hộp, dùng **đường kẻ phân cách + khoảng trắng** thay cho khung. Giữ nguyên `--surface`
làm nền trang.

⚠ **Đây là chỗ dễ vỡ hàng rào nhất.** `e2e/don-vi/mau-token.spec.ts` là allowlist ghim
tới **từng selector CSS** và còn ghim **băm SHA của PLAN mục 9.1**. Vì thế:

- **Ở trong 8 mã màu đang có.** Cần màu mới ⇒ **DỪNG và hỏi user**, vì nó kéo theo sửa
  PLAN 9.1 và cập nhật băm.
- Xoá/đổi tên selector nào đang nằm trong allowlist thì **sửa allowlist cùng lượt**, và
  nói ra trong báo cáo là đã sửa cái gì. Sửa hàng rào cho khớp code mà không nói là cách
  hàng rào chết êm.
- `e2e/don-vi/tuong-phan.spec.ts` vẫn phải xanh — bỏ viền không được kéo theo hạ tương phản.

## B4. Khu người dùng — `/u/[username]`

- **Avatar**: hàm thuần, `username → chữ cái đầu`. **Đơn sắc**, nền `--inset`, chữ
  `--ink-2`. **Cấm** màu sinh từ hash — đó là màu ứng biến, PLAN 9.1 chặn. Đặt ở
  `lib/avatar.ts` + bài đo đơn vị (chữ cái của username 1 ký tự, username có dấu, rỗng).
- **Ba tab**: `Bài viết` · `Đã vote` · `Đang theo`. Tab sống trên **URL** (`?tab=`), không
  phải state client — cùng lý do `?view=`/`?sort=` đang dùng: bấm Back phải đoán được.
- Hai tab `Đã vote` / `Đang theo` **chỉ hiện khi đang xem hồ sơ CỦA CHÍNH MÌNH**. Chúng đọc
  `/me/*`, tức dữ liệu riêng — hiện tab ấy trên hồ sơ người khác là hứa một thứ API sẽ từ
  chối, và PLAN mục 4 chốt "nút vĩnh viễn không bấm được còn tệ hơn không có nút".
- Trang hồ sơ đang là route công khai. Phần per-user (hai tab kia) phải đến **sau, ở
  client**, đúng lối `components/trang-thai-toi.tsx` — không được kéo dữ liệu riêng vào
  HTML có cache.
- Giữ nguyên luật nguyên tắc 9 đang có ở trang này (`A12`: user chưa hoạt động thì **không
  in `×0` nào**). Bài đo ấy phải còn xanh.

## B5. Icon vào các mục

Nav, nút, thanh tài khoản, chuông, sort, tab hồ sơ. Mỗi icon **phải đi kèm chữ hoặc
`aria-label`** — icon một mình là câu đố.

---

---

# PHẦN C — Câu chữ: từ bản chạy thử sang bản phát hành

User bổ sung giữa phiên 2026-08-24:

> "sửa lại những câu chữ trên site cho ra 1 sản phẩm prod, không còn là test nữa"

## C1. Rà toàn bộ chữ ỨNG DỤNG nói

Hero trang chủ, câu mồi composer, mọi trạng thái rỗng, nhãn nút, chữ trên form, thông báo
lỗi, chân trang. Hướng: **ngắn hơn, nói thẳng việc, bỏ giọng tuyên ngôn**. Hero hiện tại
là ba câu tuyên ngôn nối nhau — nó đọc như trang giới thiệu dự án, không như trang chủ
một sản phẩm đang chạy.

**Cấm đổi từ vựng domain** mà PLAN định nghĩa: *mạch · mốc · sub · trích vào sổ*. Đó là
tên của khái niệm, không phải câu chữ trang trí. (Ngoại lệ đã chốt hôm nay: nhãn hiện ra
của khu bình luận, xem plan `mat-bao-moc-1-luon-hien`.)

## C2. ⚠ Chữ nào đang bị BÀI ĐO GHIM — đổi là đỏ

Đổi copy ở repo này không phải việc sửa một chuỗi. Ít nhất bốn nhóm hàng rào đọc **đúng
từng chữ**:

- `e2e/vo-reddit.spec.ts` Y3 — soi **chữ ứng dụng nói** (phân biệt với chữ người dùng gõ);
- nguyên tắc 9 (`mach-can.spec.ts` V8, `vo-reddit.spec.ts` A12) — ghim các câu "không in
  số 0" như *"Chưa có mấy ai nói gì — mở lời trước đi."*;
- `phase-3.spec.ts`, `va-v2.spec.ts` — câu mồi composer theo trạng thái sổ;
- `mau-token.spec.ts` — ghim **băm SHA của PLAN mục 9.1**, mà 9.1/9.2 chứa wireframe có
  copy trong đó.

⇒ Mỗi chuỗi đổi phải **truy ngược xem có bài đo nào ghim nó không**, sửa cùng lượt, và
**liệt kê trong báo cáo**. Đây là loại việc rất dễ "sửa test cho khớp code" một cách vô
thức — mà ở đây sửa test LÀ đúng, miễn nói ra.

## C3. Nhãn DRAFT trên `/luat` — KHÔNG tự quyết

`app/luat/page.tsx` đang render `NHAN_DRAFT` (`lib/phap-ly.ts`) và câu *"Bản draft này …
chưa phải văn bản …"*. Đây là dấu vết "chưa phát hành" rõ nhất trên site, đúng thứ user
vừa nói tới.

**Nhưng gỡ nó là một tuyên bố pháp lý**, không phải một cú sửa copy: nó khẳng định luật
cộng đồng đã là bản chính thức. PLAN mục 11 xếp việc duyệt bản cuối vào phần **"ngoài
phạm vi agent thực thi"**, và docstring của chính trang đó ghi lý do nhãn phải hiện.

⇒ **Chờ user chốt riêng.** Không gỡ, không sửa câu disclaimer, cho tới khi có câu trả lời.
Phần còn lại của C1 làm bình thường.

## Tiêu chí nghiệm thu (ĐO ĐƯỢC)

| # | Tiêu chí | Cách đo |
|---|---|---|
| N1 | Python xanh | `pnpm test` → 0 failed, **≥ 1025 + số bài mới** (nền 1025, user đo 2026-08-24) |
| N2 | Codegen không trôi | `pnpm codegen:check` → exit 0 |
| N3 | Lint sạch | `pnpm --filter @gikky/web lint` → 0 error, 0 warning |
| N4 | Build sạch, `/luat` còn tĩnh | `pnpm --filter @gikky/web build` → 0 warning **và** bảng route in `○ /luat` |
| N5 | Đơn vị xanh | `pnpm e2e:don-vi` → 0 failed, **≥ 301 + số bài mới** |
| N6 | e2e đầy đủ xanh | `pnpm e2e` → 0 failed (nền 460) |
| N7 | **Lỗ rò nội dung** | vote + theo một mạch → mod ẩn → cả hai cửa `/me/*` KHÔNG còn nó; lặp lại với mạch đã xoá |
| N8 | Số truy vấn có trần | `assertNumQueries` cho cả 3 cửa, dựng ≥ 3 mạch |
| N9 | Bundle không phình | Lighthouse ngưỡng còn xanh; `grep` chắc chắn không có `import * as` từ `lucide-react` |
| N10 | Hàng rào màu | `mau-token.spec.ts` xanh. Nếu có sửa allowlist ⇒ **liệt kê từng dòng đã sửa** trong báo cáo |
| N11 | Thử phá | Mỗi nhóm bài đo mới: sửa ngược code cho hỏng → phải ĐỎ → khôi phục. Nêu đích danh bài nào đỏ vì khẳng định nào |
| N12 | Copy đổi có truy vết | Mọi chuỗi đã đổi ở phần C: liệt kê chuỗi cũ → mới, và bài đo nào ghim nó đã sửa theo. `/luat` giữ nguyên nhãn DRAFT cho tới khi user chốt |

## Ràng buộc tài nguyên

- **Dev server phải TẮT khi build hoặc chạy e2e.** Bật `next dev` rồi `build`/`pnpm e2e`
  trên cùng `apps/web` là `Cannot find module './999.js'`, và tệ hơn là `pnpm e2e` **tái
  dùng** dev server hỏng ấy rồi cho ra số vô giá trị. Đã xảy ra thật 2026-08-24.
- `pnpm e2e` chiếm cổng 3000 + 8000 và GHI vào `gikky_dev` — chạy một mình.
- `nghiem-thu` được chạy bộ nặng, **một bộ tại một thời điểm**; `phan-bien` cấm
  `pnpm e2e` và `build`, được `pnpm e2e:don-vi` và `pnpm test`.

## Cây làm việc

16 mục của đợt "mặt BÃO + bình luận mở sẵn" đang chưa commit và **sẽ đi chung một
commit** với đợt này (user chốt). Không đụng `apps/admin/` — vùng của phiên khác.

---

# BỔ SUNG 2026-08-24 (chiều) — user đảo một quyết định + thêm 4 việc

> "các nút mới / đang diễn ra / nhiều điểm → đổi text và thêm icon"
> "các card đang dính sát nhau quá, cho cách ra 1 chút, bg không dùng màu trắng, dùng màu
> đậm hơn bg chung 1 chút, bên trái cũng vậy" · "các card bỏ border"
> "phần user / hồ sơ, cho up avatar và bio" · "thêm avatar của user vào phần bình luận,
> bài post, nội dung"

## Đảo quyết định: avatar giờ là UPLOAD, không phải chữ cái

Sáng nay user chốt "avatar = chữ cái, KHÔNG upload". Chiều đảo lại: **cho up avatar**.
⇒ phần backend to hơn hẳn — thêm cột, endpoint upload, và một đường rò dữ liệu mới.

**Cách làm, chia hai nhịp để có kết quả nhìn thấy ngay:**

1. **Avatar CHỮ CÁI trước (thuần frontend, 0 backend).** Là hàm thuần của `username`, hiện
   được NGAY ở bình luận / thẻ post / hồ sơ / thanh tài khoản. `NguoiDungTomTatOut` (schema
   tác giả DÙNG CHUNG mọi nơi) đã có `username`/`display_name` — đủ để vẽ chữ cái.
2. **Avatar ẢNH sau (backend feature).** Thêm cột `User.avatar`, endpoint upload (dùng lại
   đường ảnh mốc `core/anh.py`), thêm `avatar_url` vào `NguoiDungTomTatOut` + `HoSoOut` +
   `ToiOut`, codegen. Component Avatar nhận `url?` — có ảnh thì hiện ảnh, không thì chữ cái.
   Khi backend xong, ảnh tự sáng lên ở mọi chỗ đã cắm component.

`bio` **đã có sẵn** (`User.bio`, `HoSoOut.bio`, trang hồ sơ đã render). Thiếu **cửa SỬA**:
`sua_toi` hôm nay chỉ nhận `nhan_digest`. Backend nhịp 2 mở thêm `display_name` + `bio`.

## Thẻ — ĐẢO lại lối "một khung" ban sáng

Sáng gộp mọi thẻ vào MỘT khung + kẻ tóc. User thấy "dính sát nhau quá". ⇒ quay lại **thẻ
rời, có GAP**, nhưng: **nền `--surface-2`** (đậm hơn `--bg` một chút, KHÔNG trắng
`--surface`), **bỏ border**, bo góc. Áp cho cả sidebar ("bên trái cũng vậy"). Không thêm
mã màu — `--surface-2`/`--bg` đều đã trong 8 token của PLAN 9.1.

## Tab feed: đổi chữ + icon

`Mới / Đang diễn ra / Nhiều điểm nhất` → `Mới nhất / Đang diễn ra / Nổi bật`, mỗi tab một
icon lucide. Nhãn hiện ra đổi được (bài đo lái bằng `data-testid`, không bằng chữ) — vẫn
truy ngược từng chuỗi.

---

# PHẦN D — Mod trên FRONT (user chốt 2026-08-24)

> "phần mod admin đã có, làm phần mod cho front"

## D0. Vì sao KHÔNG gọi thẳng `/api/admin/*`

PLAN 8.2: `gikky.net/api/admin/*` → **403 chặn tại Caddy**; chỉ `admin.gikky.net` + allowlist
IP mới vào. Ở **dev** thì gọi được (Next proxy đặt lại `Host`, Django thấy cùng một host cho
cả 3000 lẫn 3001) ⇒ làm theo lối đó sẽ **chạy ngon ở dev và chết ở prod**. Đây là lý do phải
có endpoint riêng, không phải sở thích.

## D1. Quyết định: mở bề mặt mod **HẸP** trên `/api/v1/mod/*`

User chọn phương án hẹp sau khi được nêu rõ đánh đổi. **Đúng 4 việc** — những việc mod làm
*trong lúc đang đọc trang*:

| Cửa | `operation_id` |
|---|---|
| `POST /mod/machs/{id}/an` (ẩn / bỏ ẩn) | `mod_dat_an_mach` |
| `POST /mod/mocs/{id}/an` | `mod_dat_an_moc` |
| `POST /mod/comments/{id}/an` | `mod_dat_an_binh_luan` |
| `POST /mod/machs/{id}/khoa` (khoá / mở) | `mod_dat_khoa_mach` |

**Ở LẠI phía admin sau allowlist IP, KHÔNG mở ra front:** ban user, quản lý sub, nhật ký
`AuditLog`, bảng danh sách, thống kê. Ranh giới này là *cả nội dung* của quyết định — mở
thêm là phải hỏi lại user.

**Đánh đổi đã nói rõ và user chấp nhận:** phiên mod bị chiếm trên site công khai thì kẻ tấn
công **ẩn được nội dung** (khôi phục được, có `AuditLog`), nhưng **không ban được ai** và
không chạm được dữ liệu tài khoản.

## D2. Ràng buộc thực thi

- **Dùng lại logic core** của `api/api/quan_tri_kiem_duyet.py` — không chép luật ẩn/khoá ra
  bản thứ hai. Hai bản sẽ trôi, và bản trôi là bản không ai đo.
- **Mọi hành động ghi `AuditLog`** (PLAN 5.10 chốt: "Mọi hành động mod ghi AuditLog").
- Quyền: `is_staff` **và** `is_active` **và** chưa bị ban — đúng ba vế của `ChiMod`, chỉ bỏ
  vế Host. Bỏ nhầm vế "chưa bị ban" là mod bị ban vẫn mod được.
- `Cache-Control: no-store`.
- Thứ tự khoá hàng của `CLAUDE.md` vẫn áp: `Comment/Moc → Mach → MocAnh`; `cap_nhat_dem_mach`
  phải nằm TRONG `atomic()`.
- `la_staff` đã có sẵn trong `ToiOut` ⇒ front không cần cửa mới để biết ai là mod.
