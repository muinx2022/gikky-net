# Bài viết Đêm muộn — 23:45 hàng ngày

Nhiệm vụ: Viết một bài viết đêm muộn mang tính cốt truyện ly kỳ, chuyên sâu hoặc chiêm nghiệm triết lý lên gikky.net bằng tài khoản u/gikky-team-member.

## Khung giờ & Tần suất
* **Khung giờ chạy:** 23:45 hàng ngày (khoảng giữa từ bài tản mạn 21:15 đến bản tin sáng 06:12).
* **Tần suất:** 1 bài mỗi ngày.

## Cơ chế luân phiên 3 thể loại
Mỗi ngày luân phiên một thể loại để giữ nhịp đọc phong phú cho độc giả thức khuya:

1. **Ngày 1 — Hồ sơ thương vụ, Vụ sụp đổ kinh điển & Chân dung huyền thoại đầu cơ:**
   * **Chuyên mục (sub):** `quan-tri-von`, `tam-ly-giao-dich` hoặc `vi-mo`.
   * **Nhãn mốc (loai):** `Hồ sơ` hoặc `Nhân vật`.
   * **Chủ đề gợi ý:**
     - *Thương vụ & Sụp đổ:* LTCM 1998, Nick Leeson và Ngân hàng Barings, Volkswagen short squeeze 2008, Cú ngã Bill Hwang / Archegos 2021, George Soros và Thứ Tư đen tối 1992, Enron và Jim Chanos, Vụ đầu cơ Bạc của anh em nhà Hunt 1980, Sự sụp đổ của Lehman Brothers...
     - *Chân dung huyền thoại lịch sử:* Jesse Livermore (4 lần phá sản làm lại từ đầu và bi kịch kỷ luật), Nicolas Darvas (Lý thuyết Hộp Darvas và 2 triệu USD), Richard Dennis và thí nghiệm Turtle Traders, Ed Seykota (Tiên phong thuật toán xu hướng), Paul Tudor Jones (Cú short Black Monday 1987), Bernard Baruch (Nghệ thuật biết điểm dừng trước Đại suy thoái 1929)...

2. **Ngày 2 — Giải mã Crypto & Dòng tiền On-Chain chuyên sâu:**
   * **Chuyên mục (sub):** crypto.
   * **Nhãn mốc (loai):** On-chain (hoặc Tài sản số).
   * **Chủ đề gợi ý:** Dòng tiền Bitcoin / ETH Spot ETF của các định chế phố Wall (BlackRock, Fidelity), Hoạt động di chuyển ví cá voi cổ xưa và áp lực thợ đào, Cơ chế thanh lý nợ xấu (Liquidation cascades) trong giao thức DeFi, Cấu trúc dự trữ Stablecoin và chiếc két T-Bills, Kinh tế học Token (Tokenomics) và bài toán lạm phát token...

3. **Ngày 3 — Đọc sách kinh điển & Bản ghi chép (Memo) của các bậc thầy:**
   * **Chuyên mục (sub):** 	am-ly-giao-dich hoặc quan-tri-von.
   * **Nhãn mốc (loai):** Đọc sách.
   * **Chủ đề gợi ý:** *Reminiscences of a Stock Operator* (Jesse Livermore), *Fooled by Randomness* và *Antifragile* (Nassim Taleb), *The Psychology of Money* (Morgan Housel), Các bản Memo bất hủ của Howard Marks (Tư duy cấp độ hai, Chu kỳ con lắc tâm lý), Những bức thư gửi cổ đông của Warren Buffett & Charlie Munger...

## Hướng dẫn kỹ thuật
* **Kiểm trùng:** Luôn kiểm tra các bài gần nhất trên database qua SSH trước khi chọn chủ đề.
* **Ảnh minh hoạ:** 1–2 ảnh tỷ lệ 16:9 giàu tính nghệ thuật/điện ảnh (dùng generate_image) đưa vào mảng nhs (base64) và đặt {{ANH_1}} trong ody.
* **Dải số (igures):** 4–6 cặp {label, value}, mỗi ô ≤24 ký tự.
* **Câu hỏi tương tác (question_for_crowd):** ≤200 ký tự, kết thúc bằng dấu ?.
* **Định dạng HTML bắt buộc (ody):** Dùng các thẻ HTML chuẩn (<p>, <h3>, <strong>, <em>, <ul><li>, <hr>). Tuyệt đối không dùng raw markdown trần.
* **Xuất file:** scripts/bai-viet/.tam/bai_dem_muon.json và kích hoạt tạo bài.
