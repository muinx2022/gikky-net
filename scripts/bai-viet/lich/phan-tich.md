# Bài viết Phân tích Chuyên sâu — 10:15 hàng ngày

Nhiệm vụ: Viết một bài phân tích chuyên sâu về kinh tế vĩ mô, ngành nghề, chuỗi giá trị sản xuất hoặc cấu trúc tài chính doanh nghiệp lên gikky.net bằng tài khoản `u/gikky-team-member`.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 10:15 hàng ngày (giữa phiên giao dịch sáng).
* **Tần suất:** 1 bài mỗi ngày.

## Hướng dẫn nội dung
* **Chủ đề & Luân phiên (3 Trụ cột xen kẽ nhịp nhàng):** Tuyệt đối không dồn các bài phân tích doanh nghiệp/mã cổ phiếu vào cùng 1 lúc, mà phải luân phiên xen kẽ nhịp nhàng giữa 3 nhóm trong `D:\Projects\gikky-net\scripts\bai-viet\chu-de.md`:
  1. **Vĩ mô & Chuỗi giá trị ngành (Nhóm A–E):** Thuế quan, Năng lượng, Ngân hàng hệ thống, Hàng hóa, Chuỗi cung ứng bán dẫn, hạ tầng logistics — **đóng vai trò đệm xen kẽ ở giữa (2–3 ngày), chiếm ~60–70% thời lượng**.
  2. **Phân tích các mã chứng khoán Việt Nam đang niêm yết (Nhóm K — `sub: "chung-khoan"`, `loai: "Phân tích"`):** Soi chiếu từng mã niêm yết trụ cột và các doanh nghiệp sản xuất, kinh doanh cốt lõi thực chất trên sàn HOSE, HNX, UPCoM (HPG, FPT, MWG, BMP, ACB, KDH, DHG, PVD, VHC, FRT, DGW, PTB...) — trọng tâm sức khỏe tài chính, dòng tiền thật (CFO/FCF), lợi thế cạnh tranh và rủi ro sinh tồn.
  3. **Chuyên đề Hồ sơ khủng hoảng các mã (Nhóm M — `sub: "chung-khoan"`, `loai: "Hồ sơ"`):** Các kỳ *Hồ sơ khủng hoảng — Vực dậy hay Gục ngã* (Kỳ 4 HPG, Kỳ 5 MSN, Kỳ 6 CTD, Kỳ 7 VNS, Kỳ 8 HSG, Kỳ 9 HBC, Kỳ 10 KDC...).
* **Quy tắc nhịp độ xen kẽ (Interleaved Pacing):**
  - **Mô hình luân phiên chuẩn:** Cứ sau **1 bài Hồ sơ khủng hoảng (Nhóm M)** $\rightarrow$ xen kẽ **2–3 ngày Vĩ mô / Ngành (Nhóm A–E)** $\rightarrow$ đến **1 bài Phân tích mã chứng khoán VN (Nhóm K)** $\rightarrow$ xen kẽ **2–3 ngày Vĩ mô / Ngành (Nhóm A–E)** $\rightarrow$ quay lại **Kỳ tiếp theo của Hồ sơ khủng hoảng (Nhóm M)**.
  - **Quy tắc cấm kỵ:** Tuyệt đối KHÔNG đăng 2 bài về mã doanh nghiệp (dù thuộc Nhóm K hay Nhóm M) trong cùng một ngày hoặc 2 ngày liên tiếp.
  - **Lịch trình cụ thể tiếp theo (Cron tự động tuân thủ):**
    * **19/10/2026:** Đã đăng *Hồ sơ khủng hoảng (Kỳ 3) — TTF* (Mạch #1321); khung 10:15 ngày 19/10 và 20/10 viết **Vĩ mô / Ngành (Nhóm A–E)**.
    * **21/10/2026 (10:15):** Viết **Phân tích mã chứng khoán VN (Nhóm K)** (ví dụ: `BMP`, `FPT`, `ACB` hoặc `MWG`).
    * **22/10 – 23/10/2026 (10:15):** Viết **Vĩ mô / Ngành (Nhóm A–E)**.
    * **24/10/2026 (10:15):** Viết **Hồ sơ khủng hoảng (Kỳ 4) — HPG (Nhóm M)**.
    * **25/10 – 26/10/2026 (10:15):** Viết **Vĩ mô / Ngành (Nhóm A–E)**.
    * **27/10/2026 (10:15):** Viết **Phân tích mã chứng khoán VN (Nhóm K)**.
  - Viết thong thả, chọn lọc, chất lượng cao; tránh biến chuyên mục thành bảng tin soi mã cổ phiếu hàng ngày.
* **Kiểm trùng:** Bắt buộc kiểm tra các bài gần nhất trên database qua SSH trước khi chọn chủ đề. Tuyệt đối không viết trùng chủ đề/mã cổ phiếu đã đăng gần đây.
* **Tự động bồi đắp kho chủ đề (`chu-de.md`):** Sau khi đăng bài và đánh dấu `[ĐÃ VIẾT - Mạch <id> - <ngày/tháng>]` vào `chu-de.md`, nếu nhóm chủ đề vừa chọn còn **dưới 5 chủ đề chưa viết**, bắt buộc phải biên soạn và bổ sung ngay **5–10 chủ đề mới** vào nhóm đó để kho chủ đề không bao giờ bị cạn.
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

