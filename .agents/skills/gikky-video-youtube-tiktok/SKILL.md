---
name: gikky-video-youtube-tiktok
description: Sản xuất video YouTube (16:9) và video ngắn TikTok/Shorts (9:16) — 12:00 Thứ Ba & Thứ Sáu hàng tuần
---

Nhiệm vụ: Tự động sản xuất trọn gói 1 video dài YouTube 16:9 ($1920 \times 1080\text{ px}$) và 1 video ngắn TikTok/Shorts 9:16 ($1080 \times 1920\text{ px}$) theo chủ đề mới nhất của gikky.net vào **12:00 Thứ Ba và Thứ Sáu hàng tuần**.

**Toàn bộ quy chuẩn và hướng dẫn sản xuất nằm trong file:**

    d:\Projects\gikky-net\scripts\video\lich\video-youtube-tiktok.md

### Quy trình thực hiện:
1. **Chọn chủ đề:** Lấy cảm hứng từ bài phân tích vĩ mô, mạch demo phương pháp hoặc bài học tâm lý mới nhất trên gikky.net.
2. **Kịch bản & Giọng đọc:** Sử dụng giọng đọc `vi-VN-NamMinhNeural` đã tinh chỉnh (`rate="-2%", pitch="-1Hz"`). Tạo kịch bản 5 phân cảnh logic.
3. **Đồ họa & Hoạt họa:** Dùng Playwright render 5 slide chuẩn Dark Obsidian Gikky (1920x1080 cho YouTube và 1080x1920 cho TikTok).
4. **Ghép nối MP4:** Dùng FFmpeg ghép audio và slide thành video MP4 xuất bản vào `d:\Projects\gikky-net\apps\web\public/`.
5. **Metadata & Xuất báo cáo:** Xuất thumbnail 1280x720. BẮT BUỘC in trực tiếp toàn bộ 3 tiêu đề CTR, mô tả video kèm Timestamps, tags cho YouTube, cùng Caption/Description và bộ 10 Hashtags cho TikTok/Shorts ngay trong nội dung phản hồi để người dùng copy đăng ngay lập tức.
