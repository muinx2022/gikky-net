# Roadmap — vỏ Reddit + Phase 2→6

> Chốt 2026-08-22 sau khi user xem bản chạy thật của Phase 1. Đây là **bản đồ**, không phải plan
> con: mỗi phase khi bắt tay vẫn tách plan con riêng với tiêu chí ĐO ĐƯỢC rồi chạy đủ 5 chặng.
> Nguồn: `PLAN.md` (hợp đồng sản phẩm) + 14 khoản nợ có tên của Phase 1.

## 0. Ba quyết định user vừa chốt

| Câu hỏi | Chốt | Hệ quả |
|---|---|---|
| Cột vote trên thẻ feed hiện số nào? | **Điểm của mốc 1 (bài gốc)** | Khớp `PLAN.md` mục 2 *"bài gốc chính là mốc seq=1"*. **Không đổi `PLAN.md` mục 6, không đổi `Vote.target_type`.** Vote trên feed = vote bài gốc, đúng như Reddit với post thường |
| Mức độ giống Reddit về thẩm mỹ | **Giữ `PLAN.md` 9.1, mượn BỐ CỤC** | Bảng màu/font/chất liệu "mực và dấu" giữ nguyên. Lấy của Reddit: cột vote trái, dòng dày đặc, sidebar phải, sub header |
| Sort feed | **Thêm "Nhiều điểm nhất" + khoảng thời gian** | Ngày / tuần / tháng / mọi thời gian. `PLAN.md` mục 4 chỉ cấm *"mốc mới bump feed Hot"* — Top theo điểm là cơ chế khác, không bị cấm |

### Hệ quả kỹ thuật phải chốt kèm
Sort theo "điểm mốc 1" mà `JOIN` sang `Moc` rồi `ORDER BY` là **không index được** trên feed.
⇒ **Denormalize `Mach.diem_bai_goc`**, cập nhật trong cùng transaction như 4 cột đếm hiện có
(`PLAN.md` mục 6 đã chốt kỷ luật đó). Index `(diem_bai_goc DESC, created_at DESC)` và
`(created_at DESC, diem_bai_goc DESC)` cho Top-theo-khoảng.

**Ca biên phải chốt trong plan con 1d:** mốc 1 bị mod ẩn hoặc thành bia mộ thì `diem_bai_goc`
bằng bao nhiêu? Theo luật đếm đã chốt (`PLAN.md` mục 6): điểm là **nội dung**, không phải cấu
trúc ⇒ nội dung bị che thì điểm **về 0** (khớp đúng cách `nut_ra`/`moc_ra` đã zero hoá số phiếu
của bia mộ ở 1b/1c). Mạch không tụt hạng vì bị ẩn — nó **rơi khỏi feed** hẳn, vì feed đã lọc
`hidden_at`.

---

## Phase 1d — vỏ Reddit (CHỈ ĐỌC, làm ngay được)

Không cần auth ⇒ ship được trước Phase 2. Đây là phần "trông và dùng như Reddit" mà hiện đang
thiếu hẳn.

**Backend**
1. `Mach.diem_bai_goc` + migration + 2 index; cập nhật trong `cap_nhat_dem_mach` (đường ghi duy
   nhất). Ca biên bia mộ/ẩn như trên.
2. `MachTomTatOut.diem` — thẻ feed cần con số.
3. `GET /feeds/nhieu-diem?khoang=ngay|tuan|thang|tat_ca` (hoặc `?sort=` trên feed sẵn có — plan
   con chốt). **`operation_id` tường minh**, `{detail, code}` cho `khoang` sai.
4. Seed: điểm mốc 1 của 3 mạch phải **khác nhau rõ** để Top có nghĩa, và **ít nhất một mạch có
   mốc 1 điểm thấp mà mốc sau điểm cao** — nếu không thì Top và Mới ra cùng thứ tự, và bài đo
   không phân biệt được cài đúng với cài sai (đúng bài học seed của 1a).

**Frontend**
5. **Thẻ feed kiểu Reddit**: cột vote trái (số + hai mũi tên **disabled** kèm tooltip "Đăng nhập
   để vote" — Phase 2 mới sống), thân dày đặc một dòng meta, `💬 N` thành nút thật.
6. **Trang sub `/s/<sub>`**: header (tên, `mo_ta`, số mạch, ngày lập) + **sidebar phải** (mô tả,
   luật rút gọn dẫn `/luat`, 2 sub khác). Hiện `/s/<sub>` **chỉ là feed lọc, không có gì khác**.
7. **Sidebar trang chủ**: giới thiệu gikky 2 dòng + link `/luat` + danh sách sub.
8. **Tab sort thứ ba** "Nhiều điểm nhất" + chọn khoảng thời gian.
9. **Gập/mở nhánh bình luận `[−]`** — Reddit affordance quan trọng nhất trong khán đài, hiện
   không có.
10. **Cột vote cho từng thẻ mốc** trên trang mạch (disabled) — để bố cục Phase 2 không phải vẽ lại.
11. Nén mật độ dòng theo 9.1 (vẫn Newsreader/Be Vietnam Pro/IBM Plex Mono).

**Trả nợ Phase 1 tiện thể** (đang sờ đúng file): nợ **#11** sitemap chạm trần im lặng · **#12**
`lighthouse nguong` rỗng · **#13** hàng rào trang lỗi mù với render có điều kiện · **#14** đường
thoát trang lỗi trỏ vào chính route đang treo (đổi sang route TĨNH).

---

## Phase 2 — Tài khoản + viết (L) · `PLAN.md` mục 10

allauth headless (email + Google, mount dưới `/api/`), CSRF cross-domain 8.2 · đăng bài · nối mốc
(rate 3/ngày VN) · sửa mốc (revision đủ 5 trường) · xoá (bia mộ) · đóng sổ + `ket_qua` + mở lại ·
comment (khán đài + ngăn kéo, anchor nullable) · sửa/xoá comment · **vote** · reaction.

**Vỏ Reddit thêm vào phase này:** mũi tên vote **sống** (optimistic update) · composer thật · nút
"Trả lời" inline trong cây · menu `⋯` (sửa/xoá/báo cáo).

**Nợ Phase 1 BẮT BUỘC xử ở đây** (đã hẹn từ 1a/1b):
- Schema ghi **không được có `created_at`** — 1a bỏ `auto_now_add` nên tính bất biến của
  `PLAN.md` nguyên tắc 3 nay do tầng API giữ. Có tripwire sẵn ở `test_schema_ghi_khong_co_created_at.py`.
- `DELETE /comments/{id}` phải dọn **`Vote` mồ côi**, và phải theo `PLAN.md` 5.3 bản mới
  (xoá thật **chỉ khi** không có reply con **và** chưa TỪNG được trích).
- **`Trich` chéo mạch**: ràng buộc `comment.mach == moc.mach` hoặc validate ở đường ghi trích.
- **Markdown cho `body`** + sanitize allowlist (hoãn từ 1c, phase này mới có composer).
- Bất biến "soi gương" `duoc_trich` ↔ blockquote — thêm bài đo ma trận trạng thái.

---

## Phase 3 — Mặt BÃO + vòng lặp quay lại (M) · `PLAN.md` mục 10

Cơ chế render 8.4 đủ 4 điểm (middleware tách anon/logged-in, ISR 1h + on-demand qua `on_commit`,
`GET /machs/{id}/me`) · face 5.5 + toggle `?view=` · spine + peek + đánh dấu chưa xem · composer
mồi theo trạng thái · follow + vạch mới + seen · notification (dedupe ngày VN) + chuông poll ·
trích vào sổ đủ 4 rào · email mốc mới.

**Nợ Phase 1 BẮT BUỘC xử ở đây:**
- **Gỡ `force-dynamic` khỏi 5 route sản phẩm** — hiện là chữ cảnh báo, **không phải hàng rào**.
  Phase 3 quên gỡ thì không có gì đỏ. Kèm nghi vấn chưa đo: `cache:"no-store"` có đủ chưa,
  hay 5 dòng đó thừa.
- **N+1 ngăn kéo**: `docNganKeo` gọi cho **mọi** mốc, mỗi lời gọi ở Django là `nap_binh_luan(toàn
  mạch)` + `dung_cay(toàn bộ)`. Xử cùng lúc bật ISR.
- **`limit` không bảo vệ bộ nhớ khán đài** (`nap_binh_luan` nạp toàn mạch rồi mới cắt;
  `GET /mocs/{id}/comments` không có `limit` nào).
- **Vế viewer của `PLAN.md` 5.5 không tính được** từ payload `/machs/{id}/me` mà mục 7 khai —
  phải thêm `da_binh_luan: bool` (hoặc `face_viewer`), nếu không vế đó **không bao giờ chạy**.
- Deep-link khối trích chỉ tới được **trang 1** của `hay_nhat` — cân nhắc `?focus=<comment_id>`.
- Link "tiếp tục thread →" mang đúng lớp lỗi đã diệt ở khối trích.
- **"Câu đáng đọc" = đã trích ∪ top-10 wilson** (`PLAN.md` 5.5) — 1c dùng đúng chữ đó cho nút bung
  nhưng bung **toàn bộ** khán đài; phép hợp chưa cài ở đâu. Bỏ hẳn hay làm — **chờ user**.

---

## Phase 4 — Admin + moderation (M) · `PLAN.md` mục 10

App admin tự build (9.3): staff login, report queue + ẩn/khoá/ban, tra cứu, **Sub CRUD**, audit
log · shadow-limit 5 bình luận/giờ cho tài khoản <3 ngày · chặn `/api/admin` ngoài host admin.

**Vỏ Reddit thêm vào phase này:** sửa mô tả + luật riêng của từng sub (sidebar 1d đang hiển thị
chúng — Phase 4 mới cho sửa).

**Nợ Phase 1 BẮT BUỘC xử ở đây:**
- **`mach.locked` chưa có dữ liệu nào chạy qua** — nhánh render chưa từng chạy.
- **Mốc bị mod ẩn giữ chỗ trên spine kèm nhãn** (`PLAN.md` 5.2) — **chờ user duyệt**, và Phase 4
  là nơi nó thành thật.
- `entry_count == max(seq)` gãy im lặng nếu admin xoá cứng `Moc` lẻ.
- GDPR-lite: `PROTECT` làm xoá user bất khả thi; đường ẩn danh hoá chưa tồn tại dưới dạng code.

---

## Phase 5 — Ảnh (M) · `PLAN.md` mục 10
exifr client trước resize → presign → PUT → confirm · ≤10 ảnh/mốc · thumbnail job · gallery ·
CORS bucket. **Cần Docker** (minio) hoặc R2 thật ⇒ đây là phase đầu tiên chạm cái đang HOÃN từ
Phase 0. Lần đầu có Docker phải `docker pull` xác minh tag minio/mc (đang ghim theo phỏng đoán).

## Phase 6 — Polish ra mắt (M) · `PLAN.md` mục 10
OG card mỗi mạch · email digest 8:00 thứ Bảy VN · RSS · rate-limit chống spam · backup Postgres ·
404/500. **Nợ:** `scripts/*.mjs` vẫn ngoài mọi cấu hình lint · CI kiểm drift codegen chưa có
(chưa có remote) · `docker compose up` chưa ai chạy.

---

## Việc của user, không phải của agent (`PLAN.md` mục 11)
Mua/trỏ tên miền · chọn hosting prod + deploy lần đầu · **duyệt bản cuối `/luat`** · viết 30–50
bài/mạch mồi · mời thành viên sáng lập · mọi việc pháp lý.

## Còn chờ user quyết
1. **Công thức dải gập `2…n−3`** (`PLAN.md` 5.5 đã ghi ⚠). Kèm: `n=5` gập đúng 1 mốc; wireframe
   9.2 vẽ `① ▤2–6 ⑦ ⑨` — thiếu ⑧.
2. **Mốc bị mod ẩn giữ chỗ trên spine kèm nhãn** — moderation công khai.
3. `duoc_trich` có loại **tự trích** không.
4. Hai dòng allowlist hoàng thổ (`.dong_so`, `.draft`) do agent tự xếp là "con dấu".
5. Hồ sơ user chưa hoạt động in `Được trích vào sổ ×0`.
6. **"Câu đáng đọc"** bỏ hẳn hay làm ở Phase 3.
7. **MỚI — "Tham gia sub" (subscribe) có làm không?** Vòng lặp lõi của Reddit là subscribe → feed
   cá nhân hoá. `PLAN.md` **không có** model nào cho việc này. Với v1 chỉ 2 sub thì nút Tham gia
   gần như vô nghĩa, nên 1d sẽ render nó **disabled** làm chỗ đứng. Muốn có thật thì phải thêm
   model + feed cá nhân hoá — **đổi `PLAN.md`**, và nên đợi tới khi có >5 sub.
