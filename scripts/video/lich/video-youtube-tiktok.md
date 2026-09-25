# Lịch Sản Xuất Video YouTube & TikTok/Shorts — Thứ Ba & Thứ Sáu Hàng Tuần

Nhiệm vụ: Sản xuất định kỳ 2 video YouTube dài (16:9) và 2 video ngắn (TikTok/Reels/Shorts 9:16) mỗi tuần cho thương hiệu **gikky.net**.

---

## ⏰ Khung Giờ & Tần Suất
* **Tần suất:** 2 lần / tuần (Tổng cộng: 2 Video dài + 2 Shorts / tuần).
* **Lịch cố định:**
  - **Thứ Ba (12:00):** Video định hướng phân tích vĩ mô / Bóc tách chuỗi giá trị / Ngành nghề.
  - **Thứ Sáu (12:00):** Video phương pháp thực chiến / Mạch demo lệnh / Quản trị vốn R:R và tâm lý giao dịch trước cuối tuần.

---

## 🎬 Quy Chuẩn Sản Xuất Thành Phẩm (Tech Specs)

### 1. Video Dài YouTube (16:9 Landscape)
* **Độ phân giải:** Full HD $1920 \times 1080\text{ px}$.
* **Thời lượng tối ưu:** $2\text{ phút}$ – $3\text{ phút}$ (dạng Explainer súc tích, dữ liệu dày đặc, giữ chân người xem).
* **Cấu trúc 5 phân cảnh:**
  1. Hook trực diện (Đặt câu hỏi / Nghịch lý thị trường / Đồ thị P&L).
  2. Mổ xẻ bẫy tâm lý hoặc bản chất kỹ thuật (Loss Aversion, Liquidity Hunt, FOMO).
  3. Minh chứng toán học & Dữ liệu thực tế (Expected Value, bảng tính 10 lệnh R:R).
  4. Giải pháp thực chiến (Hướng dẫn ghi nhật ký trước khi nến chạy trên gikky.net).
  5. Outro & Call to Action (Gikky Monogram G + Kêu gọi Đăng ký kênh `@gikky-net`).
* **Kèm theo:**
  - Thumbnail 16:9 ($1280 \times 720\text{ px}$) tương phản cao (Dark Obsidian + Neon Green/Red/Cyan).
  - 3 tùy chọn tiêu đề tối ưu CTR.
  - Mô tả video có Timestamps (lưu ý không chèn `https://` thô cho kênh mới).
  - Bộ thẻ Tags 500 ký tự.

### 2. Video Ngắn TikTok / Reels / Shorts (9:16 Vertical)
* **Độ phân giải:** $1080 \times 1920\text{ px}$ (9:16 dọc).
* **Thời lượng tối ưu:** $40\text{s}$ – $55\text{s}$.
* **Giọng đọc Voiceover:** Microsoft NamMinh Neural Tuned (`rate="-2%", pitch="-1Hz"`) — trầm ấm, đĩnh đạc.
* **Kèm theo:** Caption ngắn gọn, bộ 10 Hashtags và bình luận ghim kêu gọi truy cập `gikky.net`.

### 3. Quy Chuẩn Đồ Họa Mobile-First (Bắt Buộc Khi Xem Trên Điện Thoại)
* **Kích thước chữ cực đại (Super Large Typography):**
  - Tiêu đề chính: $\ge 68\text{px}$ – $86\text{px}$ (16:9) và $\ge 82\text{px}$ – $100\text{px}$ (9:16).
  - Nội dung / Thẻ thẻ chỉ số: $\ge 30\text{px}$ – $38\text{px}$ (16:9) và $\ge 32\text{px}$ – $54\text{px}$ (9:16).
  - **Tuyệt đối CẤM font chữ nhỏ dưới $26\text{px}$:** Tránh tình trạng người xem trên màn hình điện thoại 6 inch không đọc được.
* **Tối giản mật độ chữ (Minimal Text, Maximum Punch):** Không nhét các đoạn văn thuyết minh dài dòng lên slide (người xem đã nghe voiceover). Màn hình chỉ hiển thị các từ khóa đanh thép, con số nổi bật và nhãn so sánh trực diện.
* **Đồ họa SVG nét đậm (Bold Graphic):** Đường nét biểu đồ có độ dày `stroke-width` từ $6\text{px}$ – $10\text{px}$, nhãn số trên biểu đồ $\ge 24\text{px}$ – $28\text{px}$.
* **Màu sắc tương phản cực đại:** Nền tối Dark Obsidian (`#030712`), chữ trắng `#ffffff` kết hợp các điểm nhấn neon nổi bật (Cyan `#38bdf8`, Vàng Gold `#fbbf24`, Đỏ Rose `#ef4444`, Xanh Emerald `#10b981`).

---

## 🛠️ Pipeline Tự Động Hóa (Automation Stack)
* **TTS Engine:** `edge_tts` với giọng `vi-VN-NamMinhNeural` (Pitch `-1Hz`, Rate `-2%`).
* **Visual Frame Engine:** Playwright Chromium headless render template HTML/CSS dark obsidian.
* **Video Muxing:** `imageio_ffmpeg` render frame $\rightarrow$ video clips $\rightarrow$ concat MP4 (H.264/AAC).
* **Thư mục xuất xưởng:** `d:\Projects\gikky-net\apps\web\public/`.

---

## 📋 Quy Định Bắt Buộc Về Báo Cáo Thành Phẩm (Title & Description)

Sau khi video được tạo và xuất xưởng xong, Agent **BẮT BUỘC** phải in ra đầy đủ ngay trong nội dung báo cáo cho người dùng (để người dùng chỉ cần copy-paste đăng ngay mà không cần mở file):

1. **Phần YouTube (16:9):**
   * **Tiêu đề (Title):** Cung cấp 3 phương án giật hook CTR cao (A/B testing).
   * **Mô tả (Description):** Soạn thảo hoàn chỉnh toàn bộ nội dung mô tả video chuẩn SEO, bao gồm đoạn tóm tắt nội dung, đầy đủ **Timestamps** từng phân cảnh (00:00 - ...), Tuyên bố miễn trừ trách nhiệm và bộ Hashtags YouTube.
   * **Bộ Tags:** Danh sách từ khóa tags phân cách bằng dấu phẩy (tối đa 500 ký tự).

2. **Phần TikTok & Shorts (9:16):**
   * **Caption / Description:** Đoạn mô tả ngắn gọn (1–2 câu) giật hook tò mò.
   * **Bộ Hashtags:** 10 thẻ hashtags bắt xu hướng tài chính/chứng khoán.
   * **Bình luận ghim (Pinned Comment):** Câu kêu gọi hành động (CTA) kích thích độc giả thảo luận và truy cập `gikky.net`.

