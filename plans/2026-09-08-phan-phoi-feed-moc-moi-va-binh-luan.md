# Kế hoạch con: Phân phối Feed cho Mốc Mới & Thảo luận chất lượng

> Ngày chốt: 2026-09-08.
> Theo quy định tại `PLAN.md` và `CLAUDE.md`, ghi lại quyết định thiết kế và phạm vi thực hiện.

## 0 · Bối cảnh & Yêu cầu từ User

1. **Vấn đề**:
   - Khi tác giả nối mốc mới (ví dụ mốc 2 "Chờ đợi" sau 10-15 ngày), bài vẫn nằm dưới đáy feed trang chủ "Mới nhất" do sắp theo `published_at`.
   - Thẻ feed chỉ hiện preview mốc 1 cũ, bỏ trống khu vực chân thẻ bên cạnh nhãn `N mốc`.
   - Bình luận không nên đẩy vào feed "Mới nhất" (tránh spam up/chấm), nhưng những bài có thảo luận sâu sắc cũng cần có chỗ ngoi lên để tiếp cận người mới.

2. **Quy tắc phân phối chốt lại**:
   - **Tab `Mới nhất`**: Đẩy bài lên đỉnh khi: **Bài mới đăng** HOẶC **Tác giả nối mốc mới** (sắp theo `last_content_at = max(published_at, last_entry_at)`).
   - **Tab `Đang diễn ra`**: Đẩy bài lên đỉnh khi có **Bình luận chất lượng** (sắp theo `last_discussion_at`). Tiêu chuẩn:
     - Tác giả tham gia trao đổi (reply/comment).
     - Hoặc bình luận có độ dài $\ge 80$ ký tự sau khi lọc sạch.
     - Hoặc cuộc hội thoại trong thread có $\ge 2$ người tham gia.
     - Chặn: comment ngắn < 80 ký tự, up dạo, vote/reaction.
   - **Tab `Nổi bật`**: Giữ nguyên (sắp theo `diem_bai_goc` / upvote).
   - **Thẻ bài Feed (`TheMach`)**:
     - Hiển thị ngày đăng bài + nhãn cập nhật mốc mới nhất.
     - Chân thẻ hiển thị chip thông tin mốc mới nhất (ví dụ: `[ ⚡ Mốc 2: Chờ đợi ]`) cuộn thẳng tới mốc đó.

## 1 · Thiết kế dữ liệu (`api/core`)

### 1.1 Model `Mach` (`core/models/dien_dan.py`)
- Thêm `last_content_at`: DateTimeField(default=timezone.now, db_index=True)
- Thêm `last_discussion_at`: DateTimeField(default=timezone.now, db_index=True)
- Migration: `0032_mach_last_content_and_discussion.py`

### 1.2 Hàm domain (`core/ghi.py`)
- `cap_nhat_dem_mach`: tính `last_content_at = max(mach.published_at, max(moc_doc_duoc.created_at))`
- `tao_binh_luan`: kiểm tra bình luận đạt chuẩn chất lượng $\rightarrow$ cập nhật `last_discussion_at = khi`.

## 2 · Thiết kế API (`api/api`)

- `api/api/feeds.py`:
  - `feed_moi`: sort theo `last_content_at` DESC.
  - `feed_dang_dien_ra`: sort theo `last_discussion_at` DESC.
- `api/api/schemas.py` & `api/api/trinh_bay.py`:
  - Schema `MachTomTatOut`: thêm thông tin mốc mới nhất `moc_moi_nhat`.

## 3 · Giao diện (`apps/web`)

- Chạy `pnpm codegen`.
- `apps/web/components/the-mach.tsx`:
  - Hiển thị badge mốc mới ở header và chip mốc mới ở chân thẻ.
