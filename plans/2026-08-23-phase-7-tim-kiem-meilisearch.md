# Phase 7 — Tìm kiếm bằng Meilisearch

> User chốt 2026-08-23. **Đây là một lần LẬT quyết định cũ**: `PLAN.md` mục 4 đang xếp search
> full-text vào danh sách *đã bác* (*"Cắt hẳn khỏi v1, kể cả tsquery mức tối thiểu. V2."*), kèm luật
> "không đề xuất lại trừ khi user nói". User đã nói ⇒ hợp lệ. **Phải chuyển mục đó ra khỏi danh
> sách bác, ghi ngày + lý do** — để PLAN không tự mâu thuẫn.

## 0. Hai điều nói trước

**Nó khả thi trên máy này** vì Meilisearch là **một file nhị phân đơn**, không cần Docker (ràng
buộc "không cài Docker" của 2026-08-21 không chạm tới nó).

**Nhưng trên VPS nó LÀ một service chạy nền** — khác hẳn ảnh lưu local mà user vừa chốt "chưa cần
service". Nghĩa là thêm một tiến trình phải giám sát, phải khởi động lại khi reboot, phải sao lưu
riêng. Nói ra để không ai bất ngờ.

**Đánh đổi so với Postgres FTS** (một dòng, không tái tranh luận): Postgres không phải cài gì thêm,
nhưng tiếng Việt thì nó yếu ở đúng hai chỗ người Việt cần nhất — **gõ không dấu** và **gõ sai
chính tả**. Meilisearch mạnh sẵn cả hai. Đó là cái đổi lấy một service.

---

## 1. Nguyên tắc nền — Meilisearch KHÔNG phải nguồn sự thật

Postgres là nguồn sự thật, Meilisearch là **chỉ mục phụ**. Ba hệ quả bắt buộc:

1. **Xoá sạch index rồi dựng lại từ Postgres phải luôn làm được**, bằng một lệnh, không mất gì.
2. **Meilisearch chết thì trang vẫn sống.** Mọi đường ghi phải thành công kể cả khi không đẩy được
   index. Trễ index là chấp nhận được; **mất bài viết thì không**.
3. Vì (2), đẩy index phải nằm **sau khi commit** (`transaction.on_commit`) — đúng bài học của
   notification. Và vì `on_commit` có thể chết giữa chừng, phải có **lệnh đối soát** chạy lại được.

---

## 2. Chỗ nguy hiểm nhất: **search là ĐƯỜNG ĐỌC THỨ HAI**

Đây là phần quan trọng nhất của cả phase, đọc kỹ.

Toàn bộ luật che nội dung của sản phẩm — `doc_duoc()`, `TRICH_CON_HIEN`, `hidden_at`, `deleted_at`,
bia mộ, mạch bị mod ẩn, user bị ban — sống ở **đường đọc qua Postgres**. Search đi vòng qua tất cả.
Một tài liệu đã đẩy vào index thì **nằm đó mãi** cho tới khi có ai chủ động gỡ.

⇒ Nghĩa là: mod ẩn một bài lúc 9:00, nếu đường gỡ index sót, thì tới 2:00 sáng bài đó vẫn tìm thấy
được — kèm nguyên văn tiêu đề và đoạn trích. Đây đúng loài lỗi `L06` (xoá bình luận mà cache còn
phục vụ) nhưng **nặng hơn**, vì index không tự hết hạn sau một giờ.

**Bắt buộc:**
- **Mọi** sự kiện làm nội dung biến khỏi trang công khai phải gỡ/cập nhật index: xoá mốc · xoá bình
  luận · mod ẩn mốc/bình luận/mạch · **mod gỡ ẩn** (phải quay lại) · ban user · đóng/mở sổ (đổi
  trạng thái hiển thị) · đổi sub.
- Bảng đối chiếu này phải là **một bài đo cấu trúc**, cùng khuôn với
  `test_moi_su_kien_CO_SIGNAL_deu_goi_lam_moi` đang có cho cache — thêm một đường ghi mà quên gỡ
  index ⇒ **ĐỎ**.
- **Và một lớp thứ hai, ở tầng đọc**: kết quả search phải được **lọc lại qua Postgres** trước khi
  trả về, hoặc ít nhất kiểm sự tồn tại + quyền xem. Index lệch là chuyện khi nào cũng xảy ra; lớp
  thứ hai biến "rò nội dung đã ẩn" thành "kết quả thiếu một dòng".

---

## 3. Kiến trúc

**Đi qua Django, KHÔNG cho trình duyệt gọi thẳng Meilisearch.** Lý do: luật che nội dung ở §2 phải
được **server** áp. Một khoá search nằm trong trình duyệt là một khoá bị phát lại được với bộ lọc
tuỳ ý. *(Meilisearch có "tenant token" nhúng sẵn bộ lọc; đó là đường đúng cho sau này khi cần tốc
độ, nhưng v1 giữ một đường đọc duy nhất cho luật hiển thị.)*

- `GET /api/v1/tim-kiem?q=&sub=&sort=&cursor=` — `operation_id` tường minh, không per-user, **không
  cache** (kết quả phụ thuộc thời điểm và trạng thái ẩn).
- Meilisearch **bind `127.0.0.1:7700`**, không mở ra ngoài. Caddy **không** proxy tới nó.
- `MEILI_URL` + `MEILI_MASTER_KEY` từ env. `.env.example` để **trống** — không bao giờ có giá trị
  thật trong repo (bài học mật khẩu vừa phải viết lại lịch sử git).
- Django dùng khoá riêng phạm vi hẹp, **không** dùng master key cho việc thường ngày.

## 4. Index cái gì — v1 chỉ MẠCH

**Một index: `mach`.** Tài liệu gồm `id · slug · title · sub · author · ket_qua · thân mốc 1 · (tuỳ
chọn) thân các mốc gộp lại · `created_at`/`last_entry_at` · `diem_bai_goc` · cờ trạng thái để lọc`.

**Không index bình luận ở v1.** Ba lý do: khối lượng lớn gấp nhiều lần · giá trị tìm kiếm thấp hơn
hẳn · và **luật hiển thị của bình luận là phần rối nhất** (bia mộ, ẩn, `con_song`, trích) — tức
đúng chỗ §2 dễ thủng nhất. Ghi thành nợ có tên, mở sau nếu người dùng thật sự cần.

**Tiếng Việt:** bật khoan dung lỗi gõ; **tìm không dấu phải ra kết quả có dấu** (đây là hành vi
người Việt hay dùng nhất — phải có bài đo, không phải "chắc nó chạy"); mã chứng khoán (`HPG`,
`VNM`) phải khớp chính xác, không bị khoan dung lỗi gõ làm nhiễu.

## 5. Vận hành

- Nhị phân + thư mục dữ liệu; **bind localhost**; systemd unit trên VPS; script khởi động ở dev.
- **Sao lưu:** đây là thứ trạng thái thứ ba nằm ngoài Postgres (sau ảnh của Phase 5). Hoặc sao lưu
  dump của Meilisearch, **hoặc nói thẳng trong tài liệu là không sao lưu vì dựng lại được từ
  Postgres** — cách sau hợp lý hơn, nhưng phải **nói ra** và phải chứng minh lệnh dựng lại chạy được.
- Trang search phải **xuống thang duyên dáng** khi Meilisearch chết: nói ra bằng tiếng người, phần
  còn lại của site không được ảnh hưởng. *(Đây là hỏng tạm thời của một service, khác với nút chết —
  ô search vẫn hợp lệ.)*

## 6. Giao diện

Ô tìm kiếm ở header — **và điều này gỡ bỏ một ràng buộc tôi vừa viết**: kế hoạch
`plans/2026-08-23-giao-dien-reddit-va-theme.md` §0 đang cấm ô search vì mục 4. Ràng buộc đó **hết
hiệu lực** kể từ 2026-08-23; lượt giao diện phải chừa chỗ cho nó. Hai kế hoạch phải khớp nhau —
đừng để lượt sau đọc trúng câu cấm cũ.

Trang kết quả: lọc theo sub, sắp theo liên quan / mới, tô đậm đoạn khớp, trạng thái rỗng duyên
dáng (nguyên tắc 9).

## 7. Cập nhật `PLAN.md` — bắt buộc, và đây là phần dễ quên nhất

1. **Mục 4**: chuyển dòng "Search full-text" ra khỏi danh sách đã bác, ghi *"user lật quyết định
   2026-08-23, làm ở Phase 7 bằng Meilisearch"*. **Không xoá dòng cũ** — lịch sử quyết định là thứ
   mục 4 tồn tại để giữ.
2. **Mục 7**: thêm `GET /tim-kiem`.
3. **Mục 8**: thêm Meilisearch vào kiến trúc + bảng port (7700).
4. **Mục 10**: thêm Phase 7 + tiêu chí nghiệm thu.

## 8. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| S1 | Tìm được mạch theo tiêu đề và theo thân mốc 1, từ trình duyệt thật |
| S2 | **Gõ KHÔNG DẤU ra kết quả CÓ DẤU** (`mach hpg` → "Nhật ký lệnh HPG") |
| S3 | Gõ sai một ký tự vẫn ra; mã `HPG` khớp chính xác, không nhiễu |
| S4 | **Mod ẩn một mạch ⇒ nó biến khỏi kết quả search**; gỡ ẩn ⇒ quay lại. Cho **cả** mốc và mạch |
| S5 | Bài đo **cấu trúc**: thêm một đường ghi mà quên gỡ index ⇒ ĐỎ |
| S6 | Lớp lọc thứ hai ở tầng đọc: **cố tình** để index lệch (đẩy tay một tài liệu đã ẩn) ⇒ kết quả vẫn không rò |
| S7 | **Meilisearch tắt ⇒ trang search nói ra bằng tiếng người, phần còn lại của site không sao** |
| S8 | Xoá sạch index rồi `reindex` dựng lại đủ, đo bằng số lượng và bằng một truy vấn mẫu |
| S9 | Master key **không** ra tới trình duyệt; Meilisearch **không** nghe ngoài localhost |
| S10 | `.env.example` để trống hai biến Meili |
| S11 | `PLAN.md` cập nhật đủ 4 chỗ ở §7, **kể cả dòng lật quyết định ở mục 4** |
| S12 | Không hồi quy; lint/build/tsc/codegen sạch; 0 warning |
