# -*- coding: utf-8 -*-
"""Soạn và xuất bản bài phân tích Thời sự kinh tế & thị trường ngày 30/09/2026."""
import os
import sys
import json
import base64
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(REPO_ROOT / "scripts" / "bai-viet"))
from watermark import gan_watermark

anh_goc = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\vnindex_q3_close_foreign_sell_1790761611032.jpg"
anh_wm_path = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "thoi_su_3009_wm.jpg"

print("Đang gắn watermark gikky.net vào ảnh...")
gan_watermark(anh_goc, str(anh_wm_path))

with open(anh_wm_path, "rb") as f:
    anh_b64 = base64.b64encode(f.read()).decode("utf-8")

title = "VN-Index lùi về 1.768 điểm và áp lực bán ròng gần 900 tỷ: Nghịch lý dòng tiền quỹ ngoại khi vĩ mô tăng trưởng 9%"
sub = "chung-khoan"
loai = "Thời sự"

body = """<p>Phiên giao dịch ngày 30/09/2026 khép lại quý 3 với diễn biến đầy bất ngờ đối với số đông nhà đầu tư cá nhân. Trái ngược với tâm lý kỳ vọng về một nhịp kéo giá làm đẹp danh mục tài sản (Window Dressing) thường thấy ở các quỹ đầu tư, thị trường chứng kiến áp lực bán gia tăng mạnh trên diện rộng. Chỉ số VN-Index giảm 9,11 điểm (-0,51%), đóng cửa tại <strong>1.768,62 điểm</strong> và ghi nhận chuỗi điều chỉnh ba phiên liên tiếp.</p>

{{ANH_1}}

<h3>Cú xả ròng đột biến gần 900 tỷ: Đằng sau động thái của khối ngoại</h3>
<p>Điểm nhấn đáng chú ý nhất trong phiên giao dịch hôm nay đến từ hành vi của các nhà đầu tư nước ngoài. Sau nhiều phiên bán ròng thăm dò ở mức 300 – 400 tỷ đồng, khối ngoại bất ngờ đẩy mạnh quy mô thoái vốn với tổng giá trị bán ròng lên tới <strong>889,5 tỷ đồng</strong> trên toàn sàn HOSE — mức rút ròng trong một phiên cao nhất trong suốt hai tuần trở lại đây.</p>

<p>Áp lực bán tháo tập trung dồn dập vào nhóm cổ phiếu vốn hóa lớn, dẫn đầu là Vinhomes (VHM), Techcombank (TCB), Vingroup (VIC), cùng nhóm năng lượng tiện ích như GAS và BSR. Động thái này ngay lập tức dập tắt hy vọng của những nhà đầu tư mua đuổi với kỳ vọng "ăn theo" nhịp đẩy giá chốt sổ sách cuối quý.</p>

<p>Trong thực tế vận hành của các quỹ định chế quốc tế, việc bỏ tiền ra "đẩy giá" cổ phiếu trong ngày cuối quý tiềm ẩn rủi ro rất lớn: nó tiêu tốn một lượng tiền mặt quý giá và rất dễ bị các dòng tiền khác xả hàng ngược lại. Trong bối cảnh lợi suất trái phiếu Chính phủ Mỹ kỳ hạn 10 năm vừa leo lên đỉnh <strong>5,25%</strong> và chỉ số DXY tăng lên <strong>101,45 điểm</strong>, các nhà quản lý quỹ toàn cầu có xu hướng hành động theo mô hình định lượng lạnh lùng: chủ động hạ tỷ trọng tài sản rủi ro và tăng dự trữ tiền mặt USD hơn là làm đẹp báo cáo bằng các con số ảo.</p>

<h3>Nghịch lý giữa số liệu tăng trưởng 9% và hành vi thị trường</h3>
<p>Điều trớ trêu là áp lực bán tháo của dòng vốn ngoại lại diễn ra ngay trong ngày mà bức tranh kinh tế vĩ mô của Việt Nam đón nhận những thông tin dự báo rất khả quan. Báo cáo cập nhật kinh tế vừa được các định chế tài chính lớn như Standard Chartered và SSI Research công bố dự báo tăng trưởng GDP quý 3/2026 của Việt Nam đạt mức ấn tượng từ <strong>8,7% đến 9,3%</strong>, đưa mức tăng trưởng cả năm tiến sát mục tiêu <strong>9,5%</strong>.</p>

<p>Tại sao vĩ mô tăng trưởng cao kỷ lục nhưng thị trường chứng khoán lại chùng xuống? Bản chất của thị trường tài chính là một cỗ máy chiết khấu kỳ vọng tương lai chứ không phải tấm gương phản chiếu số liệu quá khứ:</p>

<ul>
  <li><strong>Áp lực chênh lệch lãi suất và tỷ giá:</strong> Khi lãi suất phi rủi ro USD neo cao, chi phí cơ hội của việc nắm giữ tài sản ở các thị trường mới nổi bị đẩy lên mức cực hạn. Dòng tiền ngoại rút lui không phải vì kinh tế Việt Nam yếu đi, mà vì bài toán phân bổ tài sản toàn cầu của họ đòi hỏi mức phần bù rủi ro cao hơn để bù đắp rủi ro tỷ giá.</li>
  <li><strong>Độ trễ phản ánh vào lợi nhuận doanh nghiệp:</strong> Tăng trưởng GDP 9% là con số của toàn nền kinh tế, nhưng dòng tiền trên sàn chứng khoán đang chờ đợi bằng chứng thực tế từ Báo cáo tài chính quý 3 sẽ được công bố trong tháng 10 tới để kiểm chứng xem tăng trưởng vĩ mô có thực sự chuyển hóa thành biên lợi nhuận ròng của các doanh nghiệp niêm yết hay không.</li>
</ul>

<h3>Dòng tiền nội nâng đỡ và điểm tựa thanh khoản 15.000 tỷ</h3>
<p>Dù chỉ số giảm điểm, bức tranh phiên giao dịch ngày 30/09 không hoàn toàn ảm đạm. Thanh khoản toàn sàn HOSE đã có sự cải thiện rõ nét, đạt hơn <strong>15.230 tỷ đồng</strong> với hơn 504 triệu cổ phiếu được sang tay (trong đó giá trị khớp lệnh đạt 11.300 tỷ đồng, tăng hơn 20% so với phiên trước).</p>

<p>Dữ liệu giao dịch cho thấy khi VN-Index bị ép lùi về sát mốc hỗ trợ <strong>1.760 điểm</strong> trong phiên chiều, lực cầu hấp thụ từ các nhà đầu tư trong nước đã lập tức xuất hiện, giúp chỉ số rút chân thu hẹp đáng kể đà giảm trước giờ đóng cửa. Thị trường ghi nhận sự phân hóa lành mạnh khi một số ngân hàng thương mại bán lẻ như VPB, CTG, LPB và GEE vẫn giữ được sắc xanh, đóng vai trò chiếc phanh giảm xóc cho toàn thị trường.</p>

<p>Khép lại quý 3, bài học lớn nhất dành cho nhà đầu tư cá nhân là không bao giờ giao dịch dựa trên những kỳ vọng mang tính hình thức như "chốt NAV". Bước sang quý 4 — giai đoạn cao điểm của mùa công bố kết quả kinh doanh và giải ngân vốn đầu tư công — sự sống còn của danh mục sẽ nằm ở chất lượng tăng trưởng thực chất của từng doanh nghiệp và kỷ luật quản trị đòn bẩy tiền mặt.</p>"""

figures = [
    {"label": "VN-Index chốt phiên", "value": "1.768,62 (-0,51%)"},
    {"label": "Khối ngoại HOSE", "value": "-889,5 tỷ VNĐ"},
    {"label": "Thanh khoản HOSE", "value": "15.230 tỷ VNĐ"},
    {"label": "Top xả ròng", "value": "VHM, TCB, VIC"},
    {"label": "Dự báo GDP Q3", "value": "8,7% – 9,3%"},
    {"label": "Lợi suất 10Y Mỹ", "value": "5,25% (Đỉnh cao)"}
]

question_for_crowd = "Trước diễn biến khối ngoại bán ròng đột biến trong phiên cuối tháng 9, bạn chọn hạ bớt tỷ trọng danh mục hay tận dụng nhịp chiết khấu để tích lũy cổ phiếu?"

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
            "ten_tep": "vnindex_q3_closing.jpg",
            "alt": "Bàn giao dịch chứng khoán tại TP.HCM trong phiên khớp lệnh cuối quý 3"
        }
    ]
}

target_json = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "bai.json"
with open(target_json, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Đã lưu file thành công tại {target_json}")
