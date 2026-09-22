# Bài viết Hỏi đáp & Cơ chế thị trường — 11:45 (T2, T4, T6 & Chủ Nhật)

Nhiệm vụ: Viết một bài giải phẫu cơ chế vận hành thị trường, thuật ngữ tài chính, quy chế giao dịch hoặc cẩm nang thực chiến cho người mới lên gikky.net bằng tài khoản `u/gikky-team-member`.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 11:45 (ngay sau khi phiên sáng HOSE kết thúc lúc 11:30).
* **Tần suất:** 4 buổi/tuần (Thứ Hai, Thứ Tư, Thứ Sáu và Chủ Nhật).
* **Chuyên mục (`sub`):** `hoi-dap` (Hỏi đáp & Cơ chế).
* **Nhãn mốc (`loai`):** `Hỏi đáp` hoặc `Cơ chế`.

## Định vị nội dung: Chuẩn mực — Sâu sắc — Dễ hiểu
Tuyệt đối không biến thành hỏi đáp vụn vặt kiểu diễn đàn (như "hỏi mã nào mua được", "chọn sàn nào hoa hồng cao").
Trọng tâm là **Giải phẫu cơ chế đằng sau bảng điện và các quy tắc giao dịch**:

1. **Cơ chế sổ lệnh & Khớp lệnh:**
   - Bid - Ask Spread, trượt giá (Slippage), độ sâu thị trường (Market Depth).
   - Cơ chế khớp lệnh định kỳ ATO và ATC: Nguyên tắc xác định giá đóng cửa/mở cửa và vì sao khối lượng hủy bị chặn trong 15 phút này.
   - Các loại lệnh thực chiến: Lệnh giới hạn (LO), Lệnh thị trường (MP, MTL, MOK, MAK), Lệnh điều kiện (Stop, Trailing Stop).

2. **Cơ chế thanh toán, chu kỳ và thuế phí:**
   - Chu kỳ thanh toán T+2.5 tại Việt Nam: Dòng tiền thực tế chuyển giao khi nào và chi phí cơ hội.
   - Bóc tách mọi chi phí thực tế khi giao dịch: Phí môi giới, thuế TNCN 0,1% khi bán, phí lưu ký chứng khoán VSDC, lãi vay Margin (TWR).
   - Cơ chế Call Margin và Force Sell: Tỷ lệ ký quỹ ban đầu, tỷ lệ duy trì (Rtt) và cách công ty chứng khoán xử lý tài khoản chạm ngưỡng.

3. **Cơ chế quyền và sự kiện doanh nghiệp:**
   - Ngày giao dịch không hưởng quyền (GDKHQ): Vì sao giá cổ phiếu bị điều chỉnh kỹ thuật giảm xuống tương ứng khi chia cổ tức tiền mặt hay cổ phiếu thưởng?
   - Quyền mua cổ phiếu phát hành thêm: Giá phát hành ưu đãi, quyền mua có chuyển nhượng được không và rủi ro bị chôn vốn.
   - Bán khống (Short Selling) và Giao dịch phái sinh VN30: Cơ chế ký quỹ, đòn bẩy và độ lệch Basis.

## Hướng dẫn kỹ thuật
* **Kiểm trùng:** Luôn kiểm tra các bài đã viết trong database bằng `python scripts/bai-viet/kiem-trung.py` trước khi chọn chủ đề.
* **Tiêu đề:** Đặt dạng câu hỏi thực tế hoặc làm rõ cơ chế, ví dụ: `Cơ chế điều chỉnh giá ngày GDKHQ: Vì sao cổ phiếu bị trừ tiền tương ứng trên bảng điện?` (≤160 ký tự).
* **Ảnh minh hoạ:** 1 ảnh tỷ lệ 16:9 chất lượng cao, đồ họa sắc nét, bảng biểu hoặc bối cảnh giao dịch tinh tế (dùng `generate_image`) và watermarked `gikky.net`.
* **Dải số (`figures`):** 4–6 cặp `{label, value}`, mỗi ô ≤24 ký tự.
* **Câu hỏi tương tác (`question_for_crowd`):** ≤200 ký tự, kết thúc bằng dấu `?`.
* **Định dạng HTML bắt buộc (`body`):** Viết bằng thẻ HTML chuẩn (`<p>`, `<h3>`, `<strong>`, `<em>`, `<ul><li>`), chứa `{{ANH_1}}`.
* **Xuất file:** `scripts/bai-viet/.tam/bai.json` và triển khai đăng bài qua VPS.
