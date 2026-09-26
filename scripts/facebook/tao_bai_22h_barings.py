# -*- coding: utf-8 -*-
import sys
import shutil

content = """HỒ SƠ BARINGS BANK 1995: KHI MỘT TRADER 28 TUỔI NHẤN CHÌM ĐẾ CHẾ 233 NĂM TUỔI

Vào ngày 26/02/1995, một trong những định chế tài chính danh giá nhất hành tinh — Ngân hàng Barings của Hoàng gia Anh, nơi từng tài trợ cuộc chiến chống Napoleon và quản lý tài sản Nữ hoàng Elizabeth II — chính thức sụp đổ với khoản lỗ 1,4 tỷ USD.

Kẻ nhấn chìm đế chế 233 năm tuổi ấy không phải cuộc khủng hoảng toàn cầu, mà là một trader mới 28 tuổi tại chi nhánh Singapore: Nick Leeson.

Vụ sụp đổ để lại ba bài học quản trị rủi ro đắt giá:

▪ Tài khoản giấu lỗ bí mật 88888: Khi sai lầm đầu tiên xuất hiện, thay vì cắt lỗ nhỏ và báo cáo trung thực, Leeson chuyển các khoản lỗ vào tài khoản phụ mang mã 88888. Lòng tự tôn của một \"ngôi sao giao dịch\" đã biến khoản lỗ vài chục nghìn USD ban đầu thành quả bom nợ phình to từng ngày.

▪ Canh bạc đòn bẩy và chiến lược Straddle chết chóc: Để gỡ gạc, Leeson đặt cược rằng chỉ số Nikkei 225 sẽ không biến động mạnh quanh mốc 19.000 điểm. Nhưng trận động đất kinh hoàng tại Kobe rạng sáng 17/01/1995 đã làm đảo lộn tất cả. Nikkei lao dốc không phanh, biến vị thế phái sinh của Leeson thành cỗ máy nghiền nát vốn với tốc độ hàng chục triệu USD mỗi ngày.

▪ Cạm bẫy bình quân giá xuống (Martingale): Càng lỗ, Leeson càng mua thêm hợp đồng tương lai để hạ giá vốn, với niềm tin mù quáng rằng thị trường sẽ hồi phục. Khi tiền ký quỹ vượt quá toàn bộ vốn chủ sở hữu của ngân hàng mẹ tại London, mọi chuyện đã quá muộn. Barings bị bán lại cho tập đoàn ING với giá đúng 1 Bảng Anh.

Sự sụp đổ của Barings vạch trần hai lỗ hổng chết người:

Thứ nhất, thiếu sự giám sát độc lập. Leeson vừa là người khớp lệnh giao dịch, vừa kiêm luôn việc thanh toán và kế toán sổ sách. Khi hệ thống kiểm soát nội bộ bị tê liệt trước ảo tưởng về lợi nhuận, thảm họa chỉ là vấn đề thời gian.

Thứ hai, bi kịch của việc không chịu thừa nhận sai lầm. Trong trading, sai lầm không giết chết một trader; chính hành vi che giấu sai lầm và cố thủ gồng lỗ mới là thứ thiêu rụi mọi gia tài.

Sau một chuỗi lệnh thua, bạn thường dừng lại để rà soát hệ thống, hay bị thôi thúc gỡ gạc bằng những vị thế đòn bẩy lớn hơn?"""

post_file = r"scripts/facebook/posts/bai_22h_barings_bank.txt"
with open(post_file, "w", encoding="utf-8") as f:
    f.write(content)

words = content.split()
print(f"WORD_COUNT: {len(words)}")

# Copy ảnh vào thư mục images của facebook
src_img = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\barings_bank_collapse_1995_1790434855688.jpg"
dst_img = r"scripts/facebook/images/barings_bank_collapse_1995.jpg"
shutil.copy2(src_img, dst_img)
print(f"COPIED_IMAGE: {dst_img}")
