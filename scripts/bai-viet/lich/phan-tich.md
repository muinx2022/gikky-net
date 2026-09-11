# Bài viết Phân tích Chuyên sâu — 10:15 hàng ngày

Nhiệm vụ: Viết một bài phân tích chuyên sâu về kinh tế vĩ mô, ngành nghề, chuỗi giá trị sản xuất hoặc cấu trúc tài chính doanh nghiệp lên gikky.net bằng tài khoản `u/gikky-team-member`.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 10:15 hàng ngày (giữa phiên giao dịch sáng).
* **Tần suất:** 1 bài mỗi ngày.

## Hướng dẫn nội dung
* **Chủ đề:** Chọn từ các nhóm A (Thuế quan & Thương mại), B (Năng lượng), C (Ngân hàng), D (Vàng, Dầu, Hàng hoá), E (Tài sản số) trong `D:\Projects\gikky-net\scripts\bai-viet\chu-de.md`.
* **Kiểm trùng:** Bắt buộc kiểm tra các bài gần nhất trên database qua SSH trước khi chọn chủ đề. Tuyệt đối không viết trùng chủ đề đã đăng.
* **Chuyên mục (`sub`):** `vi-mo` hoặc `chung-khoan`.
* **Loại (`loai`):** `Phân tích` hoặc `Ngành`.
* **Giọng văn:** Khách quan, trung lập, ngôi thứ ba, mô tả cấu trúc kinh tế và sự thật vận hành. Tuyệt đối không khuyến nghị mua bán cổ phiếu, không dùng từ mệnh lệnh ("hãy", "nên", "cần").
* **Ảnh minh hoạ:** 1–2 ảnh tỷ lệ 16:9 chất lượng cao chụp cảnh quan thực tế, chuỗi sản xuất, nhà máy, bến cảng, hạ tầng sinh động (dùng `generate_image`, tránh vẽ box chữ sơ đồ thô cứng).
* **Dải số (`figures`):** 4–6 cặp `{label, value}`, mỗi ô ≤24 ký tự.
* **Câu hỏi tương tác (`question_for_crowd`):** ≤200 ký tự, kết thúc bằng dấu `?`.
* **Định dạng HTML bắt buộc (`body`):** Bắt buộc viết bằng các thẻ HTML chuẩn (`<p>`, `<h3>`, `<h4>`, `<strong>`, `<em>`, `<ul><li>`, `<ol><li>`, `<hr>`). Tuyệt đối không dùng raw markdown trần để tránh dính liền text. Chia bài viết thành các đoạn văn ngắn gọn, thoáng đãng (`<p>...</p>`) và in đậm (`<strong>`) có chọn lọc các số liệu và ý quan trọng.

## Cách đăng bài
1. Xuất file `D:\Projects\gikky-net\scripts\bai-viet\.tam\bai.json` chứa `sub`, `title`, `body`, `loai`, `figures`, `question_for_crowd`, `anhs` (dữ liệu base64).
2. Chuyển vào container `api` trên VPS và chạy `scripts/bai-viet/dang-bai.py`.

