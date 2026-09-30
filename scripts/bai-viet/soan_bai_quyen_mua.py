# -*- coding: utf-8 -*-
"""Soạn và xuất bản bài Hỏi đáp & Cơ chế thị trường về Quyền mua phát hành thêm lúc 11:45 ngày 30/09/2026."""
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
anh_goc = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\rights_issue_capital_lock_1790743559681.jpg"
anh_wm_path = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "rights_issue_wm.jpg"

print("Đang gắn watermark gikky.net vào ảnh...")
gan_watermark(anh_goc, str(anh_wm_path))

with open(anh_wm_path, "rb") as f:
    anh_b64 = base64.b64encode(f.read()).decode("utf-8")

title = "Quyền mua cổ phiếu phát hành thêm: Cơ chế nộp tiền ưu đãi, rủi ro chôn vốn và cái bẫy điều chỉnh giá pha loãng"
sub = "hoi-dap"
loai = "Cơ chế"

body = """<p>Rất nhiều nhà đầu tư mới khi nhận được thông báo từ công ty chứng khoán về việc được quyền mua cổ phiếu với mức giá ưu đãi 10.000 đồng/cổ phiếu — trong khi thị giá trên bảng điện đang dao động quanh 25.000 hay 30.000 đồng — thường lầm tưởng rằng mình vừa nhận được một món quà hời từ doanh nghiệp. Sự thật là thị trường chứng khoán không bao giờ phân phát tiền miễn phí. Đằng sau mức giá 10.000 đồng là cả một cơ chế điều chỉnh giá kỹ thuật và chiếc bẫy giam vốn kéo dài nhiều tháng.</p>

{{ANH_1}}

<h3>Cơ chế điều chỉnh giá ngày GDKHQ: Không có bữa trưa miễn phí</h3>
<p>Nhiều người nghĩ rằng nếu đang sở hữu 1.000 cổ phiếu giá 30.000 đồng, khi được mua thêm 1.000 cổ phiếu với giá 10.000 đồng thì tài sản sẽ tự động tăng vọt từ 30 triệu lên 60 triệu đồng. Đây là ảo tưởng phổ biến nhất.</p>

<p>Vào <strong>Ngày giao dịch không hưởng quyền (GDKHQ)</strong>, Sở giao dịch chứng khoán sẽ tự động điều chỉnh giá tham chiếu của cổ phiếu giảm xuống theo công thức bình quân gia quyền:</p>

<p style="text-align: center;"><strong>P_ex = (P0 + r × P_issue) / (1 + r)</strong></p>

<p>Trong đó, <em>P0</em> là giá đóng cửa phiên liền trước, <em>r</em> là tỷ lệ phát hành thêm và <em>P_issue</em> là giá bán ưu đãi. Trong ví dụ trên với tỷ lệ 1:1:</p>

<p style="text-align: center;"><strong>P_ex = (30.000 + 1 × 10.000) / (1 + 1) = 20.000 đồng/cổ phiếu</strong></p>

<p>Ngay tại sáng ngày GDKHQ, tài khoản của bạn bị trừ giảm thị giá cổ phiếu cũ từ 30.000 đồng xuống 20.000 đồng (khoản lỗ kỹ thuật 10.000 đồng/cổ phiếu). Để nhận lại 10.000 đồng giá trị đó, bạn bắt buộc phải bỏ thêm tiền túi 10.000 đồng để nộp mua cổ phiếu mới. Tổng tài sản trước và sau ngày GDKHQ hoàn toàn không thay đổi: bạn không hề được tặng thêm một đồng nào, mà thực chất chỉ đang nộp thêm tiền mặt để duy trì tỷ lệ sở hữu của mình tại doanh nghiệp.</p>

<h3>Rủi ro chôn vốn 2–3 tháng: Bất lực trước biến động thị trường</h3>
<p>Cạm bẫy lớn nhất của quyền mua phát hành thêm không nằm ở công thức tính giá, mà nằm ở <strong>thời gian giam giữ vốn (Lock-up period)</strong>. Khi bạn nộp tiền thực hiện quyền mua, số cổ phiếu mới này sẽ không có sẵn trên tài khoản để giao dịch ngay. Quy trình hoàn tất thủ tục — từ chốt danh sách, thu tiền, báo cáo kết quả phát hành lên UBCKNN, đăng ký bổ sung tại VSDC đến ngày niêm yết chính thức trên sàn — thường kéo dài từ <strong>60 đến 90 ngày</strong>.</p>

<p>Trong suốt 2 đến 3 tháng đó, số tiền nộp thêm bị đóng băng hoàn toàn. Nếu thị trường chung bước vào một nhịp giảm sâu hoặc doanh nghiệp gặp sự cố kinh doanh khiến thị giá rơi từ 20.000 đồng xuống dưới 10.000 đồng, bạn hoàn toàn không thể đặt lệnh bán cắt lỗ số cổ phiếu phát hành thêm đó. Bạn buộc phải đứng nhìn tài khoản của mình chịu thua lỗ mà không có bất kỳ quyền tự vệ nào.</p>

<h3>Hai ngã rẽ xử lý quyền mua: Nộp tiền hay Chuyển nhượng?</h3>
<p>Khi sở hữu quyền mua, nhà đầu tư thực tế có 3 kịch bản ứng xử:</p>

<ul>
  <li><strong>1. Nộp tiền thực hiện quyền:</strong> Phù hợp khi bạn có sẵn nguồn tiền mặt nhàn rỗi, xác định đồng hành dài hạn 1–3 năm và tin tưởng tuyệt đối vào năng lực mở rộng sản xuất của doanh nghiệp.</li>
  <li><strong>2. Chuyển nhượng quyền mua:</strong> Nếu không muốn nộp thêm tiền hoặc không muốn bị kẹp vốn, bạn có thể bán mã quyền mua (thường có mã riêng giao dịch trong khoảng 1–2 tuần) cho nhà đầu tư khác trên sàn để thu hồi giá trị thặng dư bù đắp cho phần thị giá cổ phiếu cũ bị giảm.</li>
  <li><strong>3. Bỏ quên không thực hiện quyền (Thảm họa):</strong> Đây là sai lầm nặng nề nhất. Nếu để quá hạn nộp tiền mà không chuyển nhượng, quyền mua sẽ tự động bị hủy bỏ và bốc hơi hoàn toàn. Bạn phải chịu khoản lỗ do thị giá cổ phiếu cũ đã bị trừ tiền trong ngày GDKHQ nhưng lại không nhận được bất kỳ cổ phiếu mới nào bù đắp.</li>
</ul>

<h3>Kinh nghiệm thực chiến: Khi nào nên bán trước ngày GDKHQ?</h3>
<p>Một nguyên tắc sống còn của các nhà giao dịch thực chiến là luôn soi chiếu <strong>Mục đích tăng vốn</strong> của doanh nghiệp:</p>

<ul>
  <li>Nếu doanh nghiệp phát hành thêm để tài trợ cho một dự án cụ thể, có luận chứng kinh tế rõ ràng, nhà xưởng thực tế đang xây dựng và thị trường đầu ra khả quan thì việc nộp tiền có thể xem xét.</li>
  <li>Nếu doanh nghiệp liên tục phát hành tăng vốn "in giấy lấy tiền", mục đích chung chung như "bổ sung vốn lưu động", trả nợ vay ngân hàng hoặc đầu tư vào các công ty con mờ ám, đây là tín hiệu cảnh báo pha loãng nghiêm trọng.</li>
</ul>

<p>Nếu bạn đang sử dụng đòn bẩy Margin, hoặc tài khoản không có sẵn tiền mặt nhàn rỗi, chiến lược an toàn và thanh thản nhất là <strong>chủ động bán toàn bộ hoặc một phần cổ phiếu trước ngày GDKHQ</strong>. Động thái này giúp bạn bảo toàn lợi nhuận bằng tiền tươi thóc thật, né tránh hoàn toàn rủi ro bị chôn vốn 3 tháng và giữ toàn quyền chủ động đón nhận các cơ hội mới của thị trường.</p>"""

figures = [
    {"label": "Giá phát hành phổ biến", "value": "10.000 đ/cp"},
    {"label": "Thời gian kẹp vốn", "value": "60 – 90 ngày"},
    {"label": "Điều chỉnh ngày GDKHQ", "value": "Giảm kỹ thuật"},
    {"label": "Giá trị tài sản ròng", "value": "Không đổi (0%)"},
    {"label": "Lựa chọn xử lý", "value": "Nộp tiền / Bán quyền"},
    {"label": "Quên nộp tiền", "value": "Mất trắng giá trị"}
]

question_for_crowd = "Khi doanh nghiệp bạn đang nắm giữ thông báo quyền mua phát hành thêm tỷ lệ lớn, bạn thường chọn nộp tiền đồng hành hay bán cổ phiếu trước ngày GDKHQ?"

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
            "ten_tep": "rights_issue_capital_lock.jpg",
            "alt": "Chứng chỉ quyền mua cổ phiếu phát hành thêm và rủi ro giam vốn đầu tư"
        }
    ]
}

target_json = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "bai.json"
with open(target_json, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"Đã lưu file thành công tại {target_json}")
