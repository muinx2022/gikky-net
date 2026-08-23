# Giao diện: dựng cho ra hình Reddit + công tắc sáng/tối/hệ thống

> User chốt 2026-08-23: *"phần front vẫn còn sơ sài quá, làm cho nó thành hình như reddit, có cả
> theme dark/light/system"*. Chạy **sau** khi lượt vá V1 và Phase 5 đã gộp — lượt này chạm gần như
> mọi component và mọi file CSS, gộp sau hai cái kia là xung đột ba chiều trên CSS.

## 0. "Như Reddit" nghĩa là gì ở đây — và KHÔNG nghĩa là gì

**Mượn:** bộ khung bố cục · **mật độ** · các gợi ý thao tác (hover, focus, chỗ bấm được) · rail
dính · thẻ dạng card vs dạng gọn · cây bình luận có đường dẫn thụt.

**KHÔNG mượn — và đây là ranh giới cứng:**
- **Màu.** `PLAN.md` 9.1 khoá bảng màu ("mực và dấu"), và `e2e/don-vi/mau-token.spec.ts` **đọc
  thẳng PLAN 9.1 rồi ghim băm SHA-256 của mục đó**. Cam Reddit không có cửa. Hoàng thổ `--stamp`
  **chỉ** cho thứ mang tính "đóng dấu" theo đúng danh sách trong PLAN; dùng nó trang trí ⇒ hàng rào
  ĐỎ, và **cấm sửa PLAN để nới**.
- ~~**Ô tìm kiếm.**~~ **HẾT HIỆU LỰC 2026-08-23** — user lật quyết định, search sẽ làm bằng
  Meilisearch ở Phase 7 (`plans/2026-08-23-phase-7-tim-kiem-meilisearch.md`). ⇒ header **phải chừa
  chỗ** cho ô tìm kiếm. Nếu Phase 7 chưa xong lúc bạn làm lượt này thì **để trống chỗ đó, đừng render
  ô search chết** — chỗ đứng có thật, khác hẳn nút "Tham gia sub" vốn không bao giờ sống.
- **Nút "Tham gia sub"** — cùng lý do.
- Bất cứ nút nào **chưa có endpoint**: không "Lưu bài", không "Award", không "Chat". Nút chết là
  loài lỗi repo này đã đếm nhiều lần.

## 1. Công tắc theme — phần khó nằm ở ISR, không nằm ở CSS

Ba trạng thái: **Sáng · Tối · Theo hệ thống**. Lựa chọn được nhớ.

⚠ **Không được server-render theme từ cookie.** Trang mạch chạy ISR `revalidate=3600` — HTML đó
**dùng chung cho mọi người**. Nướng lựa chọn của một người vào đó là đúng cái bẫy "dữ liệu người
này phục vụ người kia" mà cả một lượt phản biện vừa bỏ công chứng minh là **không** có.

⇒ Cách duy nhất đúng: **một script inline chạy TRƯỚC lần vẽ đầu tiên**, đọc `localStorage`, đặt
`data-theme` lên `<html>`. Script nằm trong HTML đã cache — nhưng nó đọc trạng thái *của trình
duyệt*, nên mỗi người ra một kết quả. `color-scheme` phải theo cùng, để thanh cuộn và control gốc
của trình duyệt không lệch tông.

**Đo được:** không có nháy sai theme (FOUC) khi tải trang ở chế độ Tối — đo bằng Playwright, không
đọc bằng mắt.

## 2. Việc cụ thể

1. **Header**: logo · **chỗ cho ô tìm kiếm** (Phase 7 — Meilisearch; chưa xong thì để trống chỗ,
   **đừng render ô chết**) · nút Đăng bài · chuông · menu người dùng · **công tắc theme**. Dính khi cuộn.
2. **Bố cục feed**: cột chính + **rail phải dính**. Hai kiểu xem — **card** và **gọn** — đổi được,
   nhớ lựa chọn (cùng cơ chế localStorage như theme).
3. **Thẻ feed**: cột vote trái · thân dày đặc · dòng meta (`s/sub · u/tác giả · thời gian`) ·
   thanh thao tác (`💬 N bình luận` · **Chép link** — client-only, không cần endpoint).
4. **Trang mạch**: header sub dính · cây bình luận có **đường dẫn thụt** và vùng bấm để gập cả
   nhánh · thẻ mốc và khán đài giữ đúng tương phản "sổ nghiêm vs khán đài xuề xoà" của PLAN 9.1 —
   **đó là chủ đích thiết kế, đừng san phẳng nó cho đồng đều**.
5. **Trạng thái tải**: skeleton thay cho khoảng trắng. Nhớ nguyên tắc 9 — trạng thái **vắng** thì
   duyên dáng, khác với trạng thái **đang tải**.
6. **Bàn phím và focus**: vòng focus thấy được ở **cả hai** theme · tab đi đúng thứ tự đọc ·
   `prefers-reduced-motion` được tôn trọng.
7. **Mobile**: không cuộn ngang ở bất kỳ đâu; vùng bấm ≥ 44px.
8. **Tương phản**: mọi cặp chữ/nền đạt **WCAG AA** ở cả hai theme — **đo bằng số**, đừng nhìn.

## 3. Ràng buộc với bộ đo — chỗ dễ gian nhất

Lượt làm lại bố cục là cơ hội hoàn hảo để **âm thầm làm yếu bài đo**, nên:

- Bài đo nào phải sửa vì bố cục đổi thì **chỉ được đổi locator, không được nới khẳng định**.
- **Liệt kê ĐẦY ĐỦ mọi bài đo đã chạm** trong báo cáo, kèm một câu vì sao.
- Không `test.skip`, không xoá bài đo. Bài nào thật sự hết nghĩa thì **báo**, đừng tự xoá.
- `data-testid` đang có là hợp đồng của bộ đo — đổi tên thì đổi cả hai đầu, và nói ra.

## 4. Tiêu chí nghiệm thu

| # | Tiêu chí |
|---|---|
| T1 | Ba trạng thái theme chạy; lựa chọn sống qua tải lại; "Theo hệ thống" đổi theo `prefers-color-scheme` thật |
| T2 | **Không FOUC**: tải trang ở chế độ Tối không nháy sáng — đo bằng Playwright |
| T3 | Theme **không** đi qua HTML đã cache: mutant server-render theme ⇒ bài đo ĐỎ |
| T4 | Hai kiểu xem card/gọn, nhớ lựa chọn |
| T5 | Tương phản **AA** mọi cặp chữ/nền ở **cả hai** theme, đo bằng số |
| T6 | Focus thấy được ở cả hai theme; đi hết trang bằng bàn phím được |
| T7 | Không cuộn ngang ở 360px; vùng bấm ≥ 44px |
| T8 | **Không có nút chết nào mới**; không nút "Tham gia sub"; ô search chỉ render khi Phase 7 đã có endpoint |
| T9 | Hàng rào màu vẫn xanh **mà không sửa `PLAN.md` 9.1** (băm không đổi) |
| T10 | Lighthouse SEO ≥ 90; **và** Accessibility ≥ 90 (mốc mới của lượt này) |
| T11 | Không hồi quy: số test Python giữ nguyên, e2e ≥ nền, lint/build/tsc sạch |
| T12 | Danh sách đầy đủ bài đo đã chạm, mỗi cái một câu lý do |
