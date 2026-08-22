# Mảng B1 — Phase 3, phần BACKEND

> Nhánh: worktree riêng `agent-a056230144a0b95a0`, DB riêng `gikky_wt_b1`.
> Nền khi bắt đầu: `f0a72d9` (đã gộp Mảng A + C + D) · **653 test Python xanh, 0 warning**.
> Mảng B2 (frontend mặt BÃO, UI notification, UI trích) là lượt SAU — không làm ở đây.

## 0. Một chuyện phải nói trước: worktree đi SAU main 5 commit

Worktree này được tạo từ `1f7ac03` (Phase 1d), trong khi `main` đã ở `f0a72d9` với cả ba
mảng A/C/D gộp vào. Mọi giả định của đề bài (`core/digest.py`, rào 3 ở `api/users.py`,
`.env.example` có `EMAIL_*`/`FRONTEND_ORIGIN`/`ADMIN_HOSTS`/`GOOGLE_*`) chỉ đúng ở `main`.
Đã `git merge --ff-only main` trước khi sửa dòng nào — cây sạch, không có commit riêng nào
bị mất. Ghi ra đây vì con số "653" ở trên là của **nền đã gộp**, không phải của Phase 1d.

## 1. Phạm vi

| # | Hạng mục | Trạng thái trước |
|---|---|---|
| 1 | `GET /machs/{id}/me` — trạng thái viewer | chưa có |
| 2 | `POST /machs/{id}/seen` + `last_seen_entry_seq` | cột đã có ở `Follow`, chưa có cửa |
| 3 | Follow mạch `POST`/`DELETE` | model đã có, chưa có cửa |
| 4 | Notification: sinh + `GET /notifications` + đánh dấu đã đọc | model đã có, chưa có gì gọi |
| 5 | Trích vào sổ `POST`/`DELETE` + bốn rào 5.6 | rào 1/2/4 đã có ở tầng dữ liệu + đọc; **đường GHI chưa có** |
| 6 | ISR/cache PLAN 8.4 | chưa có gì |
| 7 | `face` per-viewer (vế 2 của 5.5) | chỉ có vế thời gian (`core/mat.py`) |
| 8 | `seed_dev` chưa tạo user `is_staff` nào | đúng — từ clone sạch không vào được khu quản trị |
| 9 | `digest.nguoi_nhan_digest()` trả rỗng | chờ model `Follow` của phase này |

## 2. Quyết định đã chốt (kèm lý do — chỗ nghiệm thu soi)

### 2.1 Tên trường của `/machs/{id}/me` là **tiếng Anh**, ngược quy ước tiếng Việt của repo

`my_votes`, `my_reactions`, `following`, `last_seen_entry_seq` — nguyên văn PLAN mục 7.
Không Việt hoá, vì `api/tests/test_api_mach.py::MANH_PER_USER` đã ghim đúng bốn mảnh chữ
ấy (`"my_"`, `"following"`, `"last_seen"`) làm danh sách CẤM của `GET /machs/{id}`. Hai
cửa phải gọi cùng một thứ bằng cùng một tên, nếu không hàng rào per-user kia canh một
tập tên mà không cửa nào còn dùng.

### 2.2 Khách nhận **200** ở `/machs/{id}/me`, không phải 401

Cùng lý lẽ `GET /me` (PLAN mục 7, chốt Phase 2): đây là lời gọi client component chạy
trên **mọi** lượt tải trang mạch, kể cả của bot. 401 ở trạng thái bình thường nhất của
hệ thống dạy người viết frontend coi lỗi là chuyện thường.

### 2.3 `face` per-viewer sống ở `/me`, và là **hàm MỚI** trong `core/mat.py`

`core/mat.py` viết thẳng *"Đừng 'hoàn thiện' hàm bằng cách thêm tham số `user`: nó sẽ được
gọi từ đúng chỗ không được phép biết `user`"*. Nên vế 2 của PLAN 5.5 đi vào
`tinh_mat_cho_viewer()` — hàm riêng, nhận sẵn kết quả của vế thời gian. `GET /machs/{id}`
không đổi một dòng nào.

### 2.4 `POST /seen` của người **chưa follow** là no-op CÓ BÁO, không phải 404/400

`last_seen_entry_seq` nằm trên `Follow` (PLAN mục 6). Người chưa follow không có hàng nào
để ghi. Ba lối xử và lý do loại hai:
- tạo `Follow` hộ ⇒ **âm thầm bắt người ta theo mạch** vì họ mở một trang. Loại.
- 400/404 ⇒ client phải biết trước mình có follow hay không mới dám gọi, tức thêm một
  round-trip cho một cái bookmark. Loại.
- **200 kèm `following: false`** ⇒ response nói thẳng là không ghi gì. Chọn cái này.

### 2.5 Follow mới đặt `last_seen_entry_seq = entry_count`, không phải `0`

Mặc định `0` của model đúng cho một hàng dựng bằng tay; đường sản phẩm thì biết rõ hơn.
Bấm "Theo mạch" trên một mạch 9 mốc rồi thấy **cả 9 mốc** đánh dấu chưa xem là vạch mới
nói dối ngay ở lượt đầu tiên.

### 2.6 Mạch bị mod **khoá** vẫn `follow`/`unfollow`/`seen` được — CỐ Ý

PLAN 5.10: khoá = *"đọc được, không tương tác"*. Follow/seen là **sổ tay riêng của người
đọc**, không phải tương tác với nội dung mạch: không sinh chữ, không đổi con số nào của
mạch, không ai khác nhìn thấy. Chặn `DELETE /follow` trên mạch bị khoá còn có hại thật —
người ta không tắt được thông báo của đúng cái mạch mod vừa phải khoá lại.
`POST /trich` thì **có** áp `doi_mach_tuong_tac_duoc`: nó ghi vào sổ, tức nội dung.
Ghim ở `tests/test_api_follow_seen.py::test_mach_bi_khoa_van_follow_va_seen_duoc`.

### 2.7 Thứ tự khoá của đường ghi `Trich`: **không chạm hàng `Mach` một lần nào**

Đây là ca `CLAUDE.md` cảnh báo đích danh. `INSERT INTO core_trich(moc_id, comment_id)` lấy
`FOR KEY SHARE` trên hàng `Moc` **và** hàng `Comment` — hai khoá ngầm, không có dòng
`select_for_update` nào nói ra. Luật là `Mach` khoá SAU CÙNG, nên khoá `Mach` trước rồi
insert `Trich` là dựng đúng cạnh ngược `Mach → Moc`.

Cách giữ đúng, và nó đơn giản hơn mọi cách khác: **trích không gọi `cap_nhat_dem_mach`**.
Bốn cột denormalize + `diem_bai_goc` không cột nào phụ thuộc `Trich` (trích không đổi số
mốc, số bình luận, mốc thời gian hoạt động hay điểm bài gốc), nên không có gì để cập nhật.
Transaction trích vì thế giữ đúng: `Moc` (key share) · `Comment` (key share) · `User` (key
share, do `INSERT core_notification`) — **không hàng `Mach` nào**, không cạnh mới.

Ghim bằng một bài đo cấu trúc chứ không bằng một bài đo deadlock (deadlock test là test
chớp nhoáng): `tests/test_trich_ghi.py::test_duong_trich_khong_khoa_hang_Mach` bắt mọi câu
SQL của lượt trích và đòi không câu nào là `SELECT … FROM core_mach … FOR UPDATE` hay
`UPDATE core_mach`. Ai thêm `cap_nhat_dem_mach` vào đường trích thì nó đỏ.

### 2.8 Notification sinh ở tầng **API handler**, không ở `core/ghi.py`

Cùng lý lẽ `tu_upvote` đã chốt ở Phase 2 (`core/ghi.py` dòng "không nằm trong
`them_moc`/`tao_binh_luan`, và đó là chủ đích"): `seed_dev` gọi thẳng `tao_binh_luan`/
`them_moc` để dựng dữ liệu **lịch sử**, và một thông báo tự động cho mỗi hàng seed vừa làm
seed chậm vừa đổ vài trăm hàng rác vào một bảng mà bài đo của phase này đang đếm.
Handler gọi hàm sinh **trong chính `transaction.atomic()`** đang bọc lời ghi — đó là điều
kiện "cùng transaction với hành động sinh ra nó", và nó được ghim bằng bài đo
`test_thong_bao.py::test_ghi_hong_thi_KHONG_con_thong_bao_nao`.

### 2.9 Dedupe `moc_moi` cập nhật `payload` **và** `created_at` **và** xoá `read_at`

PLAN 5.8 viết "mốc thứ 2 trong ngày update payload thông báo cũ thay vì tạo mới". Chỉ đổi
`payload` thì: người đã đọc chuông lúc 9:00 sẽ **không bao giờ** được báo về mốc viết lúc
15:00 — dedupe sinh ra để chặn *ba tiếng chuông cho một mạch*, không phải để nuốt hẳn mốc
thứ hai và thứ ba. Nên hàng cũ được dựng lại thành chưa đọc và nhảy lên đầu chuông.
`payload.so_moc_moi` đếm số mốc của mạch trong ngày lịch VN, nên nó nói đúng "3 mốc mới".

### 2.10 Trích **cùng một bình luận vào nhiều mốc** vẫn cho phép — làm đúng chữ PLAN

Rào 1 của PLAN 5.6 là *"tối đa 1 trích đang hiệu lực mỗi **mốc**"*, không phải mỗi bình
luận. Cài đúng thế. Hệ quả: chủ mạch trích một câu vào 5 mốc thì sổ có 5 bản sao. Không
bơm được chỉ số (rào 3 đếm theo **số tác giả khác nhau**, đã cài ở `api/users.py`), nên
hại chỉ là thẩm mỹ. Không tự thêm rào thứ năm — xem mục 6 "phát hiện ngoài phạm vi".

### 2.11 ISR 8.4 — làm **nửa Django + cửa nhận**, KHÔNG restructure `apps/web/app/m/`

Cơ chế đủ của 8.4 cần tách `app/m/[slugId]/page.tsx` thành hai biến thể route
(`(anon)` ISR / dynamic no-store) — tức **sửa đúng file mà agent song song đang giữ**.
Lượt này làm phần không đụng ai: `core/revalidate.py` (Django gọi ra, bọc
`transaction.on_commit`, secret qua header, fire-and-forget) + cửa nhận
`apps/web/app/api/revalidate/route.ts` + `apps/web/middleware.ts` (đều là **file mới**).
Phần tách biến thể route ghi thành nợ bàn giao cho lượt frontend — xem mục 5.

## 3. Endpoint mới (cập nhật vào PLAN mục 7)

| Method & path | Quyền | Per-user? |
|---|---|---|
| `GET /machs/{id}/me` | ai cũng gọi được; khách nhận 200 rỗng | **PER-USER — cấm cache** |
| `POST /machs/{id}/seen` | đăng nhập | per-user (ghi) |
| `POST /machs/{id}/follow` · `DELETE` | đăng nhập | per-user (ghi) |
| `GET /notifications` | đăng nhập (401 cho khách) | **PER-USER — cấm cache** |
| `POST /notifications/read` | đăng nhập | per-user (ghi) |
| `POST /mocs/{id}/trich` · `DELETE` | **chỉ chủ mạch** | không (đổi dữ liệu công khai) |

## 4. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| B1 | `GET /machs/{id}` **không đổi một khoá nào** — `test_api_mach.py::KHOA_CHO_PHEP` còn nguyên |
| B2 | Mọi endpoint ghi mới có mặt trong `test_quyen_ghi.py::CUA_GHI`, và bảng đó vẫn phủ ĐÚNG tập operation |
| B3 | Mỗi endpoint mới có bài đo "B không làm/không thấy được của A" |
| B4 | Bốn rào PLAN 5.6 có bài đo trên **đường ghi** (rào 1 partial unique · rào 2 hai dấu thời gian · rào 3 không tính tự trích · rào 4 render tách bạch) |
| B5 | Đường trích không khoá hàng `Mach` (bài đo cấu trúc, giết được mutant) |
| B6 | Ghi hỏng ⇒ không còn thông báo nào (cùng transaction) |
| B7 | `seed_dev` tạo được ít nhất một user `is_staff`; `--reset` vẫn dọn sạch |
| B8 | `nguoi_nhan_digest()` trả người thật, đủ ba luật (opt-in · còn hoạt động · không gửi cho chính tác giả) |
| B9 | Không hồi quy: ≥ 653 test Python, 0 warning, `codegen:check` khớp, lint/build/tsc sạch |

## 5. Nợ bàn giao cho lượt sau (ghi ra, không tự làm)

### `ISR-BIEN-THE-ROUTE` — nợ MỚI, thay chỗ cho mục 6 của phạm vi

**Đã làm** (chạy được, có bài đo, không đụng file của ai):
- `api/core/revalidate.py` — chiều Django → Next, đủ bốn chốt của 8.4 điểm 3
  (`transaction.on_commit` · timeout 2s · fire-and-forget trên luồng nền + log · secret qua
  **header**). Tắt theo mặc định (`REVALIDATE_SECRET` rỗng);
- hook ở **6 cửa CÓ signal** đúng danh sách 8.4 điểm 2: nối/sửa/xoá mốc · trích/gỡ trích ·
  đóng/mở sổ · ẩn mốc/bình luận/mạch · khoá mạch. Bình luận **cố ý không** hook (PLAN xếp
  nó vào nhóm KHÔNG signal, sống bằng revalidate nền);
- `apps/web/app/lam-moi-cache/route.ts` — cửa nhận. File MỚI, không đè lên ai. Cố ý **không**
  nằm dưới `/api/` (cả `next.config.ts` lẫn Caddy route `/api/*` sang Django, nên
  `/api/revalidate` chạy ở dev rồi chết trên prod). Fail-closed + allowlist đường dẫn;
- `tests/test_revalidate.py` — 12 bài, giết được mutant "gọi thẳng không qua `on_commit`".

**CHƯA làm, và nó là điều kiện để ba nợ kia trả được:**
`apps/web/app/m/[slugId]/page.tsx` vẫn khai `export const dynamic = "force-dynamic"`, nên
trang mạch **không có bản cache nào** và `revalidatePath` ở cửa nhận là một no-op. Cơ chế
đủ của 8.4 điểm 1 cần: bỏ `force-dynamic` · `export const revalidate = 3600` · tách hai
biến thể route (khách không cookie ăn ISR / có cookie thì dynamic no-store) · thêm
`middleware.ts` chọn nhánh theo *sự tồn tại* của cookie phiên.

**Vì sao không làm ở lượt này:** cả bốn việc đó sửa `page.tsx` và `lib/api.ts` — đúng hai
file agent frontend đang giữ trong lượt chạy song song. Và `middleware.ts` một mình thì
**tệ hơn không có**: nó rewrite sang một biến thể route chưa tồn tại ⇒ trang mạch 404.

⚠ **Một cái bẫy đã đo trước cho lượt sau**, để nó không mất một vòng: `lib/api.ts` gom
`cache: "no-store"` vào hằng `CHUNG = { baseUrl, cache }`. Đổi nó thành
`{ baseUrl, next: { revalidate: 3600 } }` sẽ **làm đỏ toàn bộ** `THIEU_BASE_URL` của
`e2e/don-vi/type-frontend.spec.ts` — hàng rào đó dò `baseUrl` bằng regex
`\{([^{}]*)\}`, chỉ đi qua MỘT tầng ngoặc, nên một object lồng làm nó mù. Và hai luật
chống rò session ở đó **không có giấy miễn trừ nào** (`CLIENT_SINGLETON: {}`,
`THIEU_BASE_URL: {}`, có bài đo giữ chúng rỗng). Lối đi: giữ `next:` ra ngoài hằng, hoặc
sửa hàng rào một cách có chủ đích.

### Ba nợ cũ: **CHƯA TRẢ**

`N+1-NGAN-KEO`, `NAV-GHI-CUNG`, `DANG-DOC-ROUND-TRIP` — cả ba trả bằng việc trang mạch
không còn gọi Django mỗi lượt tải, tức chúng treo vào `ISR-BIEN-THE-ROUTE` ở trên. Nửa
Django đã sẵn sàng; không nợ nào trong ba cái được đánh dấu đã trả ở lượt này.
