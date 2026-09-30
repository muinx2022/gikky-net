# -*- coding: utf-8 -*-
"""Soạn và xuất bản bài phân tích chuyên sâu Vietcombank (VCB) lúc 10:15 ngày 30/09/2026."""
import os
import sys
import json
import base64
from pathlib import Path
from PIL import Image

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(REPO_ROOT / "scripts" / "bai-viet"))
from watermark import gan_watermark

# Đường dẫn ảnh gốc
anh_goc = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\vietcombank_capital_headquarters_1790738273771.jpg"
anh_wm_path = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "vcb_headquarters_wm.jpg"

print("Đang gắn watermark gikky.net vào ảnh...")
gan_watermark(anh_goc, str(anh_wm_path))

# Chuyển ảnh sang base64
with open(anh_wm_path, "rb") as f:
    anh_b64 = base64.b64encode(f.read()).decode("utf-8")

title = "Vietcombank và con hào chi phí vốn 0%: Bí mật dòng tiền FDI, bộ đệm dự phòng 200% và giới hạn của quy mô 2 triệu tỷ"
sub = "chung-khoan"
loai = "Phân tích"

body = """<p>Khi mặt bằng lãi suất cho vay toàn nền kinh tế chịu áp lực giảm để hỗ trợ sản xuất kinh doanh, biên lãi thuần (NIM) của phần lớn hệ thống ngân hàng bị bào mòn đáng kể. Trong bối cảnh đó, Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank - VCB) vẫn duy trì vị thế đầu tàu lợi nhuận với quy mô trước thuế trên 40.000 tỷ đồng mỗi năm. Sức mạnh này không đến từ việc chạy đua mở rộng tín dụng rủi ro, mà bắt nguồn từ một con hào kinh tế độc tôn được xây dựng qua nhiều thập kỷ: lợi thế chi phí vốn rẻ và kỷ luật trích lập dự phòng hiếm có.</p>

{{ANH_1}}

<h3>Con hào chi phí vốn 0%: Dòng tiền FDI và vị thế thanh toán quốc tế</h3>
<p>Trong ngành ngân hàng, nguyên liệu đầu vào chính là tiền gửi. Ngân hàng nào có chi phí huy động vốn thấp nhất sẽ nắm giữ quyền tự quyết về giá bán đầu ra và kiểm soát biên lợi nhuận. Tỷ lệ tiền gửi không kỳ hạn (CASA) của Vietcombank luôn duy trì ổn định quanh mức <strong>34% – 36%</strong>, nằm trong nhóm dẫn đầu toàn ngành.</p>

<p>Tuy nhiên, chất lượng dòng tiền CASA của Vietcombank có sự khác biệt căn bản so với các ngân hàng thương mại cổ phần tư nhân. Trong khi khối ngân hàng tư nhân phải chi tiêu ngân sách lớn cho các chiến dịch "zero-fee", tiếp thị bán lẻ để thu hút tiền gửi cá nhân — vốn là dòng tiền biến động nhanh và dễ dịch chuyển sang nơi có lãi suất cao hơn — thì tiền gửi không kỳ hạn tại Vietcombank lại neo chặt vào dòng tiền hoạt động của hàng chục nghìn doanh nghiệp FDI, các tập đoàn đa quốc gia và tập đoàn kinh tế nhà nước.</p>

<p>Kể từ ngày thành lập, Vietcombank giữ vai trò là ngân hàng chủ lực trong thanh toán ngoại thương và tài trợ xuất nhập khẩu. Toàn bộ dòng tiền thanh toán thương mại, dòng vốn giải ngân dự án FDI và tài khoản thanh toán vãng lai quốc tế đều luân chuyển qua hệ thống của nhà băng này. Đây là nguồn vốn có chi phí gần như bằng 0 (chỉ từ 0% đến 0,5%/năm), giúp chi phí vốn bình quân (Cost of Funds - CoF) của Vietcombank chỉ dao động quanh ngưỡng <strong>3,0% – 3,2%</strong>. Đây là con hào chi phí thấp mà không một đối thủ nào trong nước có thể sao chép trong ngắn hạn.</p>

<h3>Bộ đệm bao phủ nợ xấu trên 200%: "Kho của để dành" chiến lược</h3>
<p>Soi vào bảng cân đối kế toán, điểm khác biệt lớn nhất giữa Vietcombank và phần còn lại của hệ thống ngân hàng nằm ở chính sách trích lập dự phòng rủi ro tín dụng. Trong khi tỷ lệ bao phủ nợ xấu (Loan Loss Reserve - LLR) của toàn hệ thống có xu hướng suy giảm khi nợ xấu gia tăng, Vietcombank kiên định duy trì tỷ lệ này ở mức trên <strong>200% – 230%</strong>. Điều này có nghĩa là với mỗi 1 đồng nợ xấu ghi nhận trên sổ sách, ngân hàng đã chủ động trích lập hơn 2 đồng dự phòng để sẵn sàng bù đắp tổn thất.</p>

<p>Chính sách trích lập thận trọng quá mức (Over-provisioning) này mang lại hai lợi thế mang tính chiến lược:</p>

<ul>
  <li><strong>Chiếc phanh giảm xóc trước biến động vĩ mô:</strong> Khi nền kinh tế gặp cú sốc hoặc thị trường bất động sản đóng băng, Vietcombank hoàn toàn không chịu áp lực phải tăng vọt chi phí trích lập dự phòng làm sụt giảm lợi nhuận ròng đột ngột.</li>
  <li><strong>Kho dự trữ lợi nhuận tiềm năng:</strong> Tỷ lệ nợ xấu (NPL) của Vietcombank luôn được giữ dưới <strong>1,0%</strong>, thuộc hàng thấp nhất ngành nhờ danh mục khách hàng phần lớn là các doanh nghiệp đầu ngành và tập đoàn có dòng tiền lành mạnh. Khi các khoản nợ được khách hàng tất toán hoặc tài sản bảo đảm được xử lý, phần dự phòng đã trích lập sẽ được hoàn nhập trực tiếp vào lợi nhuận ròng, tạo thành dòng tiền hoàn nhập đều đặn qua các năm.</li>
</ul>

<h3>Thách thức quy mô 2 triệu tỷ và áp lực tăng vốn tự có</h3>
<p>Mặc dù sở hữu những con hào cạnh tranh kiên cố, Vietcombank đang đối mặt với những giới hạn tăng trưởng tự nhiên bắt nguồn từ chính quy mô khổng lồ của mình:</p>

<ul>
  <li><strong>Quy luật số lớn (Law of Large Numbers):</strong> Với quy mô tổng tài sản tiệm cận <strong>2 triệu tỷ đồng</strong> và dư nợ cho vay vượt 1,4 triệu tỷ đồng, mỗi 1% tăng trưởng tín dụng đòi hỏi ngân hàng phải giải ngân thêm hàng chục nghìn tỷ đồng vốn mới ra thị trường. Do đó, kỳ vọng Vietcombank duy trì tốc độ tăng trưởng lợi nhuận 25% – 30%/năm như giai đoạn trước là không thực tế; con số tăng trưởng sẽ dần ổn định quanh mức 10% – 12%/năm, bám sát nhịp độ mở rộng GDP danh nghĩa.</li>
  <li><strong>Nút thắt hệ số an toàn vốn (CAR) và tăng vốn điều lệ:</strong> Hệ số an toàn vốn theo Basel II của Vietcombank hiện ở mức khoảng <strong>11,5%</strong>. Để đáp ứng các tiêu chuẩn khắt khe hơn của Basel III và duy trì hạn mức tăng trưởng tín dụng cao từ Ngân hàng Nhà nước, Vietcombank bắt buộc phải tăng vốn tự có cấp 1. Tuy nhiên, kế hoạch phát hành riêng lẻ 6,5% cổ phần cho nhà đầu tư ngoại đã kéo dài nhiều năm qua do các quy trình định giá tài sản Nhà nước và thủ tục phê duyệt hành chính phức tạp.</li>
</ul>

<h3>Định giá lịch sử: Khoản "phí bảo hiểm" cho sự an toàn tuyệt đối</h3>
<p>Trên thị trường chứng khoán, cổ phiếu VCB luôn giao dịch ở mức định giá P/B cao nhất ngành, thường dao động trong vùng <strong>2,2x – 3,0x</strong>, cao hơn đáng kể so với mức định giá trung bình 1,2x – 1,5x của toàn ngành ngân hàng. Mức chênh lệch định giá (Valuation Premium) này phản ánh khoản "phí bảo hiểm" mà dòng tiền tổ chức và các quỹ ngoại sẵn sàng chi trả cho một định chế sở hữu xếp hạng tín nhiệm ở mức trần quốc gia, cơ cấu tài sản sạch và khả năng tạo tiền mặt bền vững qua mọi chu kỳ kinh tế.</p>

<p>Vietcombank không phải là một cổ phiếu dành cho chiến lược đầu cơ lướt sóng theo tin đồn, mà đại diện cho bài toán đầu tư vào một định chế tài chính xương sống — nơi tăng trưởng lợi nhuận gắn liền với dòng chảy của nền kinh tế thực và sức mạnh thương mại quốc gia.</p>"""

figures = [
    {"label": "Vốn hóa thị trường", "value": "~480.000 tỷ VNĐ"},
    {"label": "Tỷ lệ CASA", "value": "34,5%"},
    {"label": "Chi phí vốn (CoF)", "value": "3,1%"},
    {"label": "Bao phủ nợ xấu", "value": "215%"},
    {"label": "Tỷ lệ nợ xấu (NPL)", "value": "0,98%"},
    {"label": "Hệ số CAR", "value": "11,5%"}
]

question_for_crowd = "Trong chu kỳ tín dụng nhiều biến động, bạn định giá cổ phiếu ngân hàng dựa trên tốc độ tăng trưởng tín dụng hay chất lượng bộ đệm dự phòng nợ xấu?"

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
            "ten_tep": "vietcombank_headquarters.jpg",
            "alt": "Trụ sở Vietcombank và phân tích cấu trúc tài chính ngân hàng VCB"
        }
    ]
}

target_json = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "bai.json"
with open(target_json, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Đã lưu file thành công tại {target_json}")
