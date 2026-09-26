---
name: gikky-video-youtube-tiktok
description: Sản xuất video YouTube (16:9) và video ngắn TikTok/Shorts (9:16) — 12:00 Thứ Ba & Thứ Sáu hàng tuần
---

Nhiệm vụ: Tự động sản xuất trọn gói 1 video dài YouTube 16:9 ($1920 \times 1080\text{ px}$) và 1 video ngắn TikTok/Shorts 9:16 ($1080 \times 1920\text{ px}$) theo chủ đề mới nhất của gikky.net vào **12:00 Thứ Ba và Thứ Sáu hàng tuần**.

**Toàn bộ quy chuẩn và hướng dẫn sản xuất nằm trong file:**

    d:\Projects\gikky-net\scripts\video\lich\video-youtube-tiktok.md

### Quy trình thực hiện:
1. **Chọn chủ đề:** Lấy cảm hứng từ bài phân tích vĩ mô, mạch demo phương pháp hoặc bài học tâm lý mới nhất trên gikky.net.
2. **Kịch bản & Giọng đọc:** Sử dụng giọng đọc `vi-VN-NamMinhNeural`. Tạo kịch bản phân cảnh logic đồng bộ theo từng giây.
3. **Đồ họa & 2D Motion Graphics (Bắt buộc chuyển động, không dùng ảnh tĩnh):**
   * Sử dụng Playwright `recordVideo` kết hợp CSS/SVG Keyframe Animations thay vì chụp ảnh tĩnh still image.
   * **Chuẩn đồ họa:** Financial Motion Graphics thuần túy (biểu đồ nến Nhật động, thanh chỉ số đếm nhảy, cán cân tỷ trọng, bảng lệnh Realtime Dark Obsidian). Không chèn các nhân vật cartoon/mascot lệch phong cách.
   * **Cơ chế Mạch Bar-by-Bar Replay (Khi làm video phương pháp/kỹ thuật):**
     - *Mốc 1 (Vào lệnh):* Nến chạy đến nến tín hiệu $\rightarrow$ DỪNG LẠI $\rightarrow$ Radar quét nến, bắn vạch Entry/SL/TP và bảng thông số R:R.
     - *Mốc 2 (Quản trị):* Nến VẼ TIẾP 3-5 cây diễn biến $\rightarrow$ DỪNG LẠI $\rightarrow$ Vạch Stop Loss trượt lên mốc Hòa Vốn (BE), bảng rủi ro 0% an toàn.
     - *Mốc 3 (Đóng lệnh):* Nến VẼ TIẾP đợt cuối chạm Target +3R $\rightarrow$ Target bừng sáng, chốt sổ P&L và đúc kết bài học thực chiến.
   * *Script mẫu tham khảo:* `scripts/video/render_mach_replay.cjs` và `scripts/video/render_motion_pro.cjs`.
4. **Ghép nối MP4:** Dùng FFmpeg mã hóa H.264/AAC ghép nối video chuyển động và audio giọng đọc xuất bản vào `d:\Projects\gikky-net\apps\web\public/`.
5. **Metadata:** Xuất thumbnail 1280x720. Cung cấp đầy đủ 3 tiêu đề CTR, mô tả video kèm Timestamps, tags cho YouTube, cùng Caption/Description và bộ 10 Hashtags cho TikTok/Shorts/Reels.
6. **Tự động xuất bản Facebook Reel:** Chạy lệnh `python scripts/facebook/reels_publisher.py --video "apps/web/public/<short_video>.mp4" --caption "<caption_kem_hashtags>"` để xuất bản ngay lập tức video ngắn 9:16 lên Facebook Reels của Fanpage Gikky.net và in đường dẫn Reel trong báo cáo.
