# Bài viết Phân tích Chuyên sâu — 10:15 hàng ngày

Nhiệm vụ: Viết một bài phân tích chuyên sâu về kinh tế vĩ mô, ngành nghề, chuỗi giá trị sản xuất hoặc cấu trúc tài chính doanh nghiệp lên gikky.net bằng tài khoản `u/gikky-team-member`.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 10:15 hàng ngày (giữa phiên giao dịch sáng).
* **Tần suất:** 1 bài mỗi ngày.

## Hướng dẫn nội dung
* **Chủ đề & Luân phiên:** Luân phiên giữa hai nhóm lớn trong `D:\Projects\gikky-net\scripts\bai-viet\chu-de.md`:
  1. **Vĩ mô & Ngành nghề (Nhóm A–E):** Thuế quan, Năng lượng, Ngân hàng hệ thống, Hàng hóa, Chuỗi cung ứng bán dẫn — **đây là trọng tâm chính, chiếm 80% thời lượng**.
  2. **Bóc tách Cổ phiếu cụ thể (Nhóm K):** Mổ xẻ từng mã niêm yết trụ cột (HPG, FPT, MWG, VHM, VCB, TCB, VNM, DGC, GMD, REE, PNJ, CTR, MSN, PVS...) — **chỉ là nội dung bổ trợ, chiếm ~20%**.
* **Quy tắc nhịp độ (Pacing) bắt buộc đối với mã cổ phiếu:**
  - **TUYỆT ĐỐI KHÔNG VIẾT 2 BÀI CỔ PHIẾU LIÊN TIẾP:** Không bao giờ đăng 2 bài bóc tách mã cổ phiếu trong 2 ngày/lượt liên tiếp.
  - **Giãn cách 3–5 ngày:** Sau khi đã viết 1 bài về một mã cổ phiếu cụ thể, hệ thống **bắt buộc phải nghỉ ít nhất 3 đến 5 ngày** (chuyển sang phân tích vĩ mô, chính sách, bức tranh ngành) trước khi viết về một mã cổ phiếu khác.
  - Viết thong thả, chọn lọc, chất lượng cao; tránh biến chuyên mục thành bảng tin soi mã cổ phiếu hàng ngày.
* **Kiểm trùng:** Bắt buộc kiểm tra các bài gần nhất trên database qua SSH trước khi chọn chủ đề. Tuyệt đối không viết trùng chủ đề/mã cổ phiếu đã đăng gần đây.
* **Chuyên mục (`sub`):** `vi-mo` (đối với môi trường vĩ mô) hoặc `chung-khoan` (đối với ngành và cổ phiếu cụ thể).
* **Loại (`loai`):** `Phân tích` hoặc `Ngành`.
* **Giọng văn & Quy tắc phân tích cổ phiếu:**
  - **Khách quan, trung lập:** Giữ giọng văn khách quan về cấu trúc kinh tế và sự thật vận hành, ngôi thứ ba điềm tĩnh.
  - **Tuyệt đối hạn chế sáo ngữ rập khuôn ("Giải mã", "Con hào", "Cỗ máy", "Bóc tách", "Giải phẫu"):**
    + **"Giải mã":** Tránh đặt tiêu đề "Giải mã...". Đặt tiêu đề trực diện, tự nhiên (Ví dụ: thay vì "Giải mã Gemadept..." ➔ "Gemadept và bài toán đón sóng cảng nước sâu: Động lực Gemalink và áp lực dòng tiền sau thoái vốn").
    + **"Con hào" / "Con hào kinh tế":** Không lặp đi lặp lại chữ "con hào". Thay bằng các thuật ngữ kinh doanh chính xác: *lợi thế quy mô, rào cản gia nhập ngành, sức mạnh định giá, chi phí chuyển đổi cao, lợi thế dẫn đầu về chi phí, điểm tựa chiến lược*.
    + **"Cỗ máy", "Bóc tách", "Giải phẫu":** Thay bằng *doanh nghiệp, tổ hợp, hệ sinh thái, soi chiếu, lần theo, đọc sâu*.
  - **Tuyệt đối KHÔNG hô hào / bơm thổi:** Cấm các từ ngữ cảm tính ("siêu cổ", "múc", "xúc", "kỳ lân", "vua ngành").
  - **Tuyệt đối KHÔNG khuyến nghị mua / bán:** Không đưa ra giá mục tiêu (Target Price), không khuyến nghị "mua/bán/nắm giữ", không phím điểm cắt lỗ/chốt lời. Mọi kết luận để người đọc tự quyết định.
  - **Bắt buộc nhìn nhận hai mặt:** Luôn có phần làm rõ rủi ro tiềm ẩn, góc khuất nợ vay, rủi ro pha loãng hoặc điểm nghẽn chu kỳ của doanh nghiệp.
* **Ảnh minh hoạ:** 1–2 ảnh tỷ lệ 16:9 chất lượng cao chụp cảnh quan thực tế, chuỗi sản xuất, nhà máy, bến cảng, hạ tầng sinh động (dùng `generate_image`, tránh vẽ box chữ sơ đồ thô cứng). Khi chèn ảnh hoặc biểu đồ vào nội dung HTML, bắt buộc phải có thuộc tính `alt` mô tả đúng ngữ cảnh và từ khóa chính (VD: `<img src="..." alt="Tổ hợp luyện kim và chuỗi sản xuất thép cuộn cán nóng HRC">`).
* **Dải số (`figures`):** 4–6 cặp `{label, value}`, mỗi ô ≤24 ký tự.
* **Câu hỏi tương tác (`question_for_crowd`):** ≤200 ký tự, kết thúc bằng dấu `?`.
* **Liên kết nội bộ (Internal Linking):** Bắt buộc chèn 2–4 liên kết chéo tự nhiên dạng đường dẫn tương đối `/m/<slug>-<id>` tới các bài viết liên quan đã xuất bản trên Gikky.net (vĩ mô, ngành, chuỗi cung ứng, hồ sơ doanh nghiệp). **TUYỆT ĐỐI KHÔNG DÙNG `target="_blank"`** để giữ nguyên tab hiện tại khi độc giả nhấn mở liên kết.
* **Định dạng HTML bắt buộc (`body`):** Bắt buộc viết bằng các thẻ HTML chuẩn (`<p>`, `<h3>`, `<h4>`, `<strong>`, `<em>`, `<ul><li>`, `<ol><li>`, `<hr>`). Tuyệt đối không dùng raw markdown trần để tránh dính liền text. Chia bài viết thành các đoạn văn ngắn gọn, thoáng đãng (`<p>...</p>`) và in đậm (`<strong>`) có chọn lọc các số liệu và ý quan trọng.

## Cách đăng bài
1. Xuất file `D:\Projects\gikky-net\scripts\bai-viet\.tam\bai.json` chứa `sub`, `title`, `body`, `loai`, `figures`, `question_for_crowd`, `anhs` (dữ liệu base64).
2. Chuyển vào container `api` trên VPS và chạy `scripts/bai-viet/dang-bai.py`.

