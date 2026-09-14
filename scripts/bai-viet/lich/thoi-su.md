# Bài viết Thời sự Kinh tế & Thị trường — 16:45 cách ngày (Thứ Hai, Thứ Tư, Thứ Sáu, Chủ Nhật)

Nhiệm vụ: Viết một bài phân tích/bình luận chuyên sâu về vấn đề thời sự kinh tế, tài chính, thị trường hoặc chính sách mới đang diễn ra lên gikky.net bằng tài khoản `u/gikky-team-member`.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 16:45 Thứ Hai, Thứ Tư, Thứ Sáu, Chủ Nhật (xen kẽ cách ngày với mạch Nhật ký demo).
* **Tần suất:** Cách ngày 1 bài (4 bài/tuần).

## Hướng dẫn nội dung
* **Chủ đề:** Bám sát các sự kiện thời sự nóng đang diễn ra trong ngày hoặc trong tuần:
  - **Chính sách & Vĩ mô:** Các quyết định điều hành lãi suất/tỷ giá của NHNN, chính sách thuế, gói kích cầu, giải ngân đầu tư công, số liệu lạm phát CPI / tăng trưởng GDP vừa công bố.
  - **Thị trường chứng khoán:** Các diễn biến bất thường sau phiên giao dịch, cơ cấu dòng tiền (khối ngoại, tự doanh, cá nhân), tiến độ nâng hạng thị trường, tái cấu trúc các tập đoàn lớn, sự kiện thanh tra/xử lý sai phạm.
  - **Chuỗi cung ứng & Ngành:** Căng thẳng thương mại, biến động giá nguyên vật liệu đột biến, chu kỳ xuất nhập khẩu.
  - **Tài sản số:** Khung pháp lý mới ban hành, biến động dòng vốn ETF toàn cầu, sự cố an ninh mạng hoặc chính sách quản lý tài sản mã hóa.
* **Kiểm trùng:** Kiểm tra các chủ đề vừa viết gần đây trên database qua SSH trước khi chọn góc nhìn thời sự.
* **Chuyên mục (`sub`):** Chọn phù hợp theo bối cảnh bài viết:
  - `vi-mo`: Chính sách, vĩ mô, lãi suất, tỷ giá, thương mại toàn cầu.
  - `chung-khoan`: Thị trường chứng khoán Việt Nam, nhóm ngành, doanh nghiệp niêm yết.
  - `crypto`: Thị trường tiền số, pháp lý tài sản số.
* **Loại (`loai`):** `Thời sự` hoặc `Phân tích`.
* **Giọng văn:** Khách quan, trung lập, ngôi thứ ba, đi sâu mổ xẻ nguyên nhân và cơ chế tác động đằng sau các dòng tít thời sự. Tuyệt đối không suy đoán vô căn cứ, không giật gân, không khuyến nghị mua bán cổ phiếu.
* **Ảnh minh hoạ:** 1–2 ảnh tỷ lệ 16:9 chụp không gian tài chính, nhà máy, bến cảng, phòng họp chính sách hoặc đồ họa trực quan sinh động (dùng `generate_image`, tránh vẽ box chữ sơ đồ thô cứng). Khi chèn vào HTML, ảnh bắt buộc phải có thuộc tính `alt` mô tả trực quan và chứa từ khóa sự kiện chính (VD: `<img src="..." alt="Diễn biến giao dịch thị trường chứng khoán và áp lực thanh khoản">`).
* **Dải số (`figures`):** 4–6 cặp `{label, value}`, mỗi ô ≤24 ký tự tóm lược những số liệu mấu chốt của sự kiện thời sự.
* **Câu hỏi tương tác (`question_for_crowd`):** ≤200 ký tự, kết thúc bằng dấu `?`.
* **Định dạng HTML bắt buộc (`body`):** Bắt buộc viết bằng các thẻ HTML chuẩn (`<p>`, `<h3>`, `<h4>`, `<strong>`, `<em>`, `<ul><li>`, `<ol><li>`, `<hr>`). Tuyệt đối không dùng raw markdown trần để tránh dính liền text. Chia nhỏ bài viết thành các đoạn văn ngắn 2–3 câu (`<p>...</p>`) và in đậm (`<strong>`) có chọn lọc các số liệu và nhận định then chốt.

## Cách đăng bài
1. Tìm kiếm và tổng hợp các nguồn tin xác thực về sự kiện thời sự đang diễn ra.
2. Tạo ảnh minh họa 16:9 bằng `generate_image`, chuyển thành base64.
3. Soạn dữ liệu bài viết chuẩn HTML, xuất file `D:\Projects\gikky-net\scripts\bai-viet\.tam\bai.json`.
4. Đẩy payload lên container `api` trên VPS và kích hoạt tạo bài viết kèm gọi hàm `lam_moi_mach` để revalidate ISR tức thì.
