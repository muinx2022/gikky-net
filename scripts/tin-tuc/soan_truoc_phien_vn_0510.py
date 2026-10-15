import json
import os

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/truoc-phien-vn.json"

title = "Bản tin 05/10 — tỷ giá trung tâm 25.636 đồng, khối ngoại bán ròng 3.298 tỷ"

body = """<h3>Diễn biến thị trường phiên trước</h3>
<p>Thị trường chứng khoán Việt Nam khép lại tuần giao dịch đầu tháng 10 với diễn biến điều chỉnh theo số liệu từ <a href="https://cafef.vn">CafeF</a> và <a href="https://thoibaotaichinhvietnam.vn">Thời báo Tài chính Việt Nam</a>:</p>
<ul>
  <li>Chỉ số <strong>VN-Index</strong> giảm 11,59 điểm (-0,66%), đóng cửa phiên 02/10 ở mức 1.737,71 điểm.</li>
  <li>Chỉ số <strong>HNX-Index</strong> giảm 1,91 điểm (-0,71%) xuống 266,75 điểm.</li>
  <li><strong>Thanh khoản sàn HOSE</strong> đạt 19.268 tỷ đồng tổng giá trị giao dịch, trong đó giá trị khớp lệnh đạt 14.517 tỷ đồng.</li>
</ul>

<h3>Dòng vốn ngoại &amp; Giao dịch khối ngoại</h3>
<p>Áp lực bán ròng từ các nhà đầu tư nước ngoài tiếp tục duy trì ở mức cao theo dữ liệu từ <a href="https://vietstock.vn">Vietstock</a>:</p>
<ul>
  <li>Khối ngoại ghi nhận <strong>bán ròng 3.298 tỷ đồng</strong> trên toàn thị trường trong phiên cuối tuần.</li>
  <li>Lực bán tập trung mạnh nhất tại các mã cổ phiếu vốn hóa lớn như PNJ (hơn 1.264 tỷ đồng) và HDB (khoảng 961 tỷ đồng).</li>
</ul>

<h3>Tỷ giá &amp; Thanh khoản hệ thống</h3>
<p>Thông tin điều hành tiền tệ và tỷ giá ghi nhận từ <a href="https://sbv.gov.vn">Ngân hàng Nhà nước</a>:</p>
<ul>
  <li><strong>Tỷ giá trung tâm</strong> giữa VND và USD được Ngân hàng Nhà nước công bố ở mức 25.636 đồng/USD.</li>
  <li>Với biên độ +/-5%, tỷ giá trần áp dụng tại các ngân hàng thương mại là 26.918 VND/USD và tỷ giá sàn là 24.354 VND/USD.</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 08:08 sáng 05/10/2026 trước giờ mở cửa HOSE.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Trước phiên VN",
    "figures": [
        {"label": "VN-Index", "value": "1.737,71 (-0,66%)"},
        {"label": "HNX-Index", "value": "266,75 (-0,71%)"},
        {"label": "Thanh khoản HOSE", "value": "19.268 tỷ"},
        {"label": "Khối ngoại", "value": "-3.298 tỷ"},
        {"label": "Tỷ giá TT", "value": "25.636 VND"}
    ],
    "question_for_crowd": "Trong bảng trên, con số nào đổi cách bạn đặt lệnh sáng nay?"
}

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Title length:", len(data["title"]), "chars")
print("Body length:", len(data["body"]), "chars")
print("Figures count:", len(data["figures"]))
print("JSON saved successfully to", json_path)
