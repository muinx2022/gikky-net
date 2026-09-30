# -*- coding: utf-8 -*-
"""Soạn và xuất bản bài viết Tâm lý giao dịch về Cỡ lệnh & Bài kiểm tra giấc ngủ lúc 13:45 ngày 30/09/2026."""
import os
import sys
import json
import base64
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(REPO_ROOT / "scripts" / "bai-viet"))
from watermark import gan_watermark

# Đường dẫn ảnh gốc
anh_goc = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\trader_sleep_test_desk_1790750763473.jpg"
anh_wm_path = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "sleep_test_wm.jpg"

print("Đang gắn watermark gikky.net vào ảnh...")
gan_watermark(anh_goc, str(anh_wm_path))

with open(anh_wm_path, "rb") as f:
    anh_b64 = base64.b64encode(f.read()).decode("utf-8")

title = "Cỡ lệnh là một quyết định tâm lý: Bài kiểm tra giấc ngủ và giới hạn chịu đựng của hệ thần kinh"
sub = "tam-ly-giao-dich"
loai = "Tâm lý"

# TUYỆT ĐỐI KHÔNG DÙNG THẺ <h2> HOẶC <h3> ĐỂ TRÁNH SINH MỤC LỤC TRÊN FRONTEND
body = """<p>Trong mọi cuốn giáo trình quản trị tài chính, kích thước vị thế (Position Sizing) luôn được trình bày như một bài toán thuần túy: công thức Kelly, mô hình phương sai tối ưu Markowitz, hay quy tắc trích 1% – 2% rủi ro trên tổng tài sản. Trên bảng tính Excel, những con số trông luôn ngay ngắn, lý tính và hoàn hảo. Nhưng khi bước chân vào thực tế nghiệt ngã của thị trường, cỡ lệnh chưa bao giờ là một quyết định toán học. Nó là một phép đo sinh học đối với sức chịu đựng của hệ thần kinh con người.</p>

{{ANH_1}}

<p><strong>Cơn bão thể xác: Khi nhịp tim tỷ lệ thuận với khối lượng lệnh</strong></p>
<p>Hãy nhớ lại cảm giác của bạn khi mở một vị thế nhỏ, chiếm vỏn vẹn 5% hay 10% danh mục. Cổ phiếu giảm 3%, bạn nhún vai, tắt màn hình máy tính và thong thả đi uống cà phê với đồng nghiệp. Bạn phân tích biểu đồ một cách khách quan, kiên nhẫn đợi giá kiểm định lại vùng hỗ trợ và tuân thủ kế hoạch giao dịch một cách nhẹ nhàng như hơi thở.</p>

<p>Thế nhưng, điều gì xảy ra khi bạn "tất tay" 100% tài sản, thậm chí nạp thêm đòn bẩy Margin kịch khung 3:7 vào đúng một mã duy nhất? Lúc đó, mỗi bước giá nhảy 100 đồng trên bảng điện không còn là một biến số tài chính trừu tượng. Nó biến thành một nhát búa nện thẳng vào lồng ngực. Hạch hạnh nhân (Amygdala) trong não bộ bị kích hoạt ngay lập tức, chuyển toàn bộ cơ thể bạn sang trạng thái sinh tồn khẩn cấp: tim đập thình thịch, cổ họng nghẹn đắng, bàn tay run rẩy trước chuột máy tính và hơi thở trở nên nông, gấp gáp.</p>

<p>Khi cơ thể đã rơi vào trạng thái báo động sinh học, vỏ não trước trán — trung tâm của tư duy logic và lý trí — hoàn toàn bị vô hiệu hóa. Bạn không còn giao dịch theo phương pháp nữa; bạn đang giao dịch bằng bản năng sợ hãi của một sinh vật bị dồn vào chân tường.</p>

<hr>

<p><strong>Hai bi kịch hành vi sinh ra từ một chiếc lệnh quá khổ</strong></p>
<p>Một vị thế vượt quá sức chịu đựng của hệ thần kinh sẽ luôn dẫn đến một trong hai bi kịch kinh điển sau:</p>

<p><strong>1. Chốt non trong hoảng loạn (Panic Selling at the bottom):</strong> Vì khối lượng quá lớn, một nhịp rung lắc kỹ thuật hoàn toàn bình thường 2% cũng làm tài khoản bốc hơi số tiền bằng vài tháng thu nhập thực tế. Nỗi sợ hãi mất tiền thiêu đốt tâm can, khiến bạn không thể chịu đựng nổi áp lực và bấm nút Bán tháo ngay đáy của một nhịp điều chỉnh lành mạnh. Ngay sau khi bạn vừa cắt lỗ xong, thị trường quay đầu bứt phá tăng 30% – 50% trong sự cay đắng tột cùng.</p>

<p><strong>2. Tê liệt lý trí và biến thành "nhà đầu tư dài hạn" bất đắc dĩ:</strong> Khi khoản lỗ tạm tính vượt qua giới hạn có thể chấp nhận mất ngoài đời thực (tương đương tiền mua chiếc xe máy hay khoản tiết kiệm cả năm), não bộ sẽ tự động bật cơ chế chối bỏ thực tế (Ostrich Effect). Bạn không dám nhìn vào bảng điện, giấu nhẹm thua lỗ với gia đình, xóa ứng dụng chứng khoán trên điện thoại và bắt đầu đi lùng sục khắp các hội nhóm những bài viết khen ngợi cổ phiếu để tự ru ngủ bản thân. Một cú lướt sóng T+ ban đầu đã bị biến tướng thành một bản án kẹp vốn kéo dài nhiều năm trời.</p>

<hr>

<p><strong>Bài kiểm tra giấc ngủ của Jesse Livermore (The Sleep Test)</strong></p>
<p>Trong cuốn hồi ký bất hủ về cuộc đời giao dịch của mình, huyền thoại đầu cơ Jesse Livermore từng kể lại câu chuyện về một người bạn tìm đến ông trong tình trạng kiệt quệ: đôi mắt thâm quầng, tóc tai rối bời và thần kinh suy sụp vì mất ngủ triền miên. Người bạn này đang nắm giữ một khối lượng hợp đồng tương lai lúa mì quá lớn trên sàn giao dịch Chicago và không tài nào chợp mắt nổi vì sợ thị trường mở cửa đảo chiều.</p>

<p>Người bạn tuyệt vọng hỏi: <em>"Jesse, tôi phải làm gì để thoát khỏi cơn ác mộng này?".</em></p>

<p>Livermore chỉ nhìn bạn và đáp lại bằng một câu nói đã trở thành chân lý sống còn của phố Wall suốt một thế kỷ qua: <strong>"Hãy bán bớt cho đến khi nào anh ngủ ngon được trở lại" (Sell down to the sleeping point).</strong></p>

<p>Quy tắc ấy đơn giản đến mức trần trụi. Kích thước vị thế tối ưu của một giao dịch không phải là con số giúp bạn làm giàu nhanh nhất nếu dự đoán đúng, mà là con số cho phép bạn đặt lưng xuống giường lúc 11 giờ đêm và ngủ một giấc trọn vẹn tới sáng mà không cần phải bật dậy lúc 2 giờ để kiểm tra bảng điện tử hay thị trường phái sinh thế giới.</p>

<hr>

<p><strong>Lắng đọng sau bàn phím: Giữ quyền được ngồi tiếp ở bàn chơi</strong></p>
<p>Nếu bạn thấy mình liên tục kiểm tra tài khoản mỗi 3 phút một lần; nếu bạn cáu gắt vô cớ với người thân chỉ vì một nhịp giảm nhẹ của thị trường; nếu bạn cảm thấy nghẹt thở mỗi khi mở bảng điện — đó không phải là lỗi của thị trường. Đó là lời cảnh báo đanh thép từ cơ thể rằng cỡ lệnh của bạn đã vượt quá giới hạn chịu tải của tâm lý.</p>

<p>Toán học quản trị vốn chỉ cung cấp cho bạn khung lý thuyết. Nhưng chính khả năng giữ được sự bình thản mới là thứ giữ bạn ở lại với cuộc chơi này đủ lâu. Thu nhỏ cỡ lệnh lại một nửa, hạ bớt đòn bẩy về mức an toàn — bạn sẽ ngạc nhiên khi nhận ra rằng: khi cái đầu của bạn hoàn toàn thanh thản, phương pháp giao dịch của bạn đột nhiên trở nên chuẩn xác hơn bao giờ hết.</p>"""

figures = [
    {"label": "Quy tắc kinh điển", "value": "The Sleep Test"},
    {"label": "Phản xạ sinh học", "value": "Hạch hạnh nhân"},
    {"label": "Bi kịch cỡ lệnh", "value": "Chốt non & Tê liệt"},
    {"label": "Hệ quả đòn bẩy", "value": "Mất kiểm soát lý trí"},
    {"label": "Mục tiêu quản trị", "value": "Giữ tâm thanh thản"},
    {"label": "Tác giả cảm hứng", "value": "Jesse Livermore"}
]

question_for_crowd = "Có bao giờ bạn rơi vào tình trạng mất ngủ vì ôm một vị thế quá lớn? Bài học sau cú giao dịch đó là gì?"

data = {
    "sub": sub,
    "title": title,
    "body": body,
    "loai": loai,
    "figures": figures,
    "question_for_crowd": question_for_crowd,
    "anhs": [
        {
            "data": anh_b64,
            "dinh_dang": "jpeg",
            "ten_tep": "sleep_test_trader.jpg",
            "alt": "Góc bàn làm việc trader đêm muộn và bài kiểm tra giấc ngủ về kích thước vị thế"
        }
    ]
}

target_json = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "bai.json"
with open(target_json, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Đã lưu file thành công tại {target_json}")
