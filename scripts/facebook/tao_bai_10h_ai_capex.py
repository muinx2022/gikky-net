# -*- coding: utf-8 -*-
import sys
import shutil

content = """CƠN SỐT CAPEX AI: KHI PHỐ WALL ĐÒI LỜI GIẢI CHO BÀI TOÁN HOÀN VỐN (ROI)

Suốt gần hai năm qua, thị trường chứng khoán toàn cầu được dẫn dắt bởi một câu chuyện duy nhất: Trí tuệ nhân tạo (AI). Cổ phiếu nhóm Big Tech liên tục lập đỉnh mới, được nâng đỡ bởi niềm tin vào một kỷ nguyên năng suất vượt bậc.

Thế nhưng, Phố Wall đang dần chuyển sang trạng thái hoài nghi lạnh lùng về hiệu quả phân bổ vốn.

Những con số chi tiêu cho hạ tầng AI đang chạm ngưỡng kỷ lục:

▪ Hơn 200 tỷ USD vốn đầu tư (CapEx): Đó là số tiền mà Microsoft, Alphabet, Amazon và Meta dự kiến đổ vào trung tâm dữ liệu và chip GPU trong một năm — vượt ngân sách hạ tầng của nhiều quốc gia phát triển.

▪ Cỗ máy in tiền Nvidia: Phần lớn dòng vốn khổng lồ này chảy thẳng vào Nvidia qua các cụm máy chủ H100, B200 đắt đỏ, biến hãng chip thành công ty giá trị nhất thế giới với biên lãi ròng trên 50%.

▪ Nghịch lý hoàn vốn (ROI): Báo cáo từ quỹ Sequoia chỉ ra rằng, để bù đắp 300 tỷ USD chi tiêu hạ tầng AI tích lũy, ngành công nghệ cần tạo ra 600 tỷ USD doanh thu hàng năm. Hiện tại, doanh thu thực tế từ người dùng trả phí cho mô hình ngôn ngữ lớn (LLM) vẫn chỉ là giọt nước giữa đại dương chi phí.

Điều này tạo ra hai rủi ro cấu trúc:

Thứ nhất, áp lực khấu hao tài sản. Cụm máy chủ GPU có vòng đời rất ngắn, chỉ 3 đến 5 năm trước khi lỗi thời. Chi phí khấu hao hàng chục tỷ USD mỗi năm sẽ đè nặng lên biên lợi nhuận của Big Tech nếu doanh thu AI không tăng trưởng tương ứng.

Thứ hai, nguy cơ cắt giảm chi tiêu (CapEx Cut). Khi tỷ suất sinh lời trên vốn (ROIC) của các dự án AI không đạt kỳ vọng của cổ đông, doanh nghiệp sẽ buộc phải siết van tiền mặt. Sự chững lại của dòng vốn CapEx sẽ kích hoạt phản ứng dây chuyền tiêu cực lên toàn chuỗi bán dẫn và máy chủ.

Lịch sử cho thấy: Mọi cuộc cách mạng công nghệ đều tạo giá trị lớn trong dài hạn. Nhưng ở giai đoạn đầu cơn sốt hạ tầng, những kẻ chi tiêu vượt trước nhu cầu thực tế luôn phải trả giá đắt trước khi thị trường tìm thấy điểm cân bằng.

Theo bạn, làn sóng đầu tư hạ tầng AI hiện tại đang ở bình minh của sự bùng nổ thực tế, hay đang tiến gần tới điểm uốn điều chỉnh của một chu kỳ đầu tư quá mức?"""

# Lưu bài viết UTF-8
post_file = r"scripts/facebook/posts/bai_10h_ai_capex_roi.txt"
with open(post_file, "w", encoding="utf-8") as f:
    f.write(content)

words = content.split()
print(f"WORD_COUNT: {len(words)}")

# Copy ảnh vào thư mục images của facebook
src_img = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\ai_capex_roi_dilemma_1790394121541.jpg"
dst_img = r"scripts/facebook/images/ai_capex_roi_dilemma.jpg"
shutil.copy2(src_img, dst_img)
print(f"COPIED_IMAGE: {dst_img}")
