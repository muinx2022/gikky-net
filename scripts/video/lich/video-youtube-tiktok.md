# Lịch Sản Xuất Video YouTube & TikTok/Shorts — Thứ Hai & Thứ Năm Hàng Tuần

Nhiệm vụ: Sản xuất định kỳ 2 video YouTube dài (16:9) và 2 video ngắn (TikTok/Reels/Shorts 9:16) mỗi tuần cho thương hiệu **gikky.net**.

---

## ⏰ Khung Giờ & Tần Suất
* **Tần suất:** 2 lần / tuần (Tổng cộng: 2 Video dài + 2 Shorts / tuần).
* **Lịch cố định:**
  - **Thứ Hai (09:00):** Video định hướng tuần mới / Phân tích vĩ mô / Tâm lý giao dịch đầu tuần.
  - **Thứ Năm (09:00):** Video phương pháp thực chiến / Mạch demo lệnh / Quản trị vốn R:R trước thềm phiên Mỹ & cuối tuần.

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

---

## 🛠️ Pipeline Tự Động Hóa (Automation Stack)
* **TTS Engine:** `edge_tts` với giọng `vi-VN-NamMinhNeural` (Pitch `-1Hz`, Rate `-2%`).
* **Visual Frame Engine:** Playwright Chromium headless render template HTML/CSS dark obsidian.
* **Video Muxing:** `imageio_ffmpeg` render frame $\rightarrow$ video clips $\rightarrow$ concat MP4 (H.264/AAC).
* **Thư mục xuất xưởng:** `d:\Projects\gikky-net\apps\web\public/`.
