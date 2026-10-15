import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/truoc-phien-vn.json"

title = "Bản tin 09/10 — tỷ giá trung tâm 25.634 đồng, khối ngoại bán ròng 446 tỷ"

body = """<h3>Kết quả phiên giao dịch trước (08/10)</h3>
<p>Thị trường chứng khoán Việt Nam khép lại phiên 08/10 với sắc đỏ chiếm ưu thế trên các sàn niêm yết theo dữ liệu từ <a href="https://vietstock.vn">Vietstock</a>:</p>
<ul>
  <li>Chỉ số <strong>VN-Index</strong> giảm -14,42 điểm (-0,82%), đóng cửa tại <strong>1.738,97 điểm</strong> theo <a href="https://thoibaotaichinhvietnam.vn">Thời báo Tài chính Việt Nam</a>.</li>
  <li>Chỉ số <strong>HNX-Index</strong> giảm -3,60 điểm (-1,39%) xuống mức <strong>256,22 điểm</strong>.</li>
  <li>Chỉ số <strong>UPCoM-Index</strong> ghi nhận mức tăng nhẹ +0,02 điểm (+0,02%), chốt phiên tại <strong>125,21 điểm</strong>.</li>
  <li>Tổng giá trị khớp lệnh trên sàn HOSE đạt gần <strong>15.900 tỷ đồng</strong>.</li>
</ul>

<h3>Giao dịch của dòng vốn khối ngoại</h3>
<p>Khối nhà đầu tư nước ngoài duy trì xu hướng rút ròng phiên thứ 12 liên tiếp trên sàn HOSE theo ghi nhận từ <a href="https://nhandan.vn">Báo Nhân Dân</a>:</p>
<ul>
  <li>Khối ngoại <strong>bán ròng 446 tỷ đồng</strong> trên toàn sàn HOSE.</li>
  <li>Top các mã chịu áp lực bán ròng lớn nhất: <strong>TCB</strong> (-153 tỷ đồng), <strong>HDB</strong> (-118 tỷ đồng) và <strong>PNJ</strong> (-116 tỷ đồng).</li>
  <li>Top các mã được khối ngoại mua ròng nhiều nhất: <strong>PLX</strong> (+91 tỷ đồng), <strong>VIC</strong> (+66 tỷ đồng) và <strong>PVT</strong> (+62 tỷ đồng).</li>
</ul>

<h3>Tỷ giá &amp; Thị trường tiền tệ</h3>
<p>Diễn biến tỷ giá và điều tiết thanh khoản hệ thống đầu ngày 09/10:</p>
<ul>
  <li><strong>Tỷ giá trung tâm</strong> do Ngân hàng Nhà nước công bố ở mức <strong>25.634 VND/USD</strong> (giảm 4 đồng so với phiên trước) theo <a href="https://sbv.gov.vn">Ngân hàng Nhà nước Việt Nam</a>.</li>
  <li>Tỷ giá USD niêm yết tại Vietcombank giao dịch quanh vùng <strong>25.750 – 26.120 VND/USD</strong> (mua vào – bán ra).</li>
</ul>

<h3>Lịch sự kiện doanh nghiệp ngày 09/10</h3>
<p>Lịch giao dịch không hưởng quyền (GDKHQ) và sự kiện đáng chú ý trong ngày hôm nay theo <a href="https://cafef.vn">CafeF</a>:</p>
<ul>
  <li><strong>HDB</strong> (Ngân hàng TMCP Phát triển TP.HCM): Ngày GDKHQ nhận cổ tức năm 2025 bằng cổ phiếu (tỷ lệ 100:25) và cổ phiếu thưởng (tỷ lệ 100:5).</li>
  <li><strong>BTP</strong> (CTCP Nhiệt điện Bà Rịa): Ngày GDKHQ chi trả cổ tức năm 2025 bằng tiền mặt với tỷ lệ 500 đồng/cổ phiếu.</li>
  <li><strong>AST</strong> (CTCP Dịch vụ Hàng không Taseco): Ngày GDKHQ lập danh sách cổ đông tổ chức ĐHĐCĐ bất thường năm 2026.</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 08:07 sáng 09/10/2026 trước giờ mở cửa sàn HOSE.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Trước phiên VN",
    "figures": [
        {"label": "VN-Index", "value": "1.738,97 (-0,82%)"},
        {"label": "Khối ngoại", "value": "Bán ròng -446 tỷ"},
        {"label": "Tỷ giá trung tâm", "value": "25.634 VND/USD"},
        {"label": "Thanh khoản HOSE", "value": "15.900 tỷ đồng"},
        {"label": "HNX-Index", "value": "256,22 (-1,39%)"},
        {"label": "Top bán ròng", "value": "TCB, HDB, PNJ"}
    ],
    "question_for_crowd": "Trong các nhóm cổ phiếu khối ngoại bán ròng mạnh phiên trước, bạn quan sát mã nào trong phiên sáng nay?"
}

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Title length:", len(data["title"]), "chars")
print("Body length:", len(data["body"]), "chars")
print("Figures count:", len(data["figures"]))
for fig in data["figures"]:
    print(f"  {fig['label']} ({len(fig['label'])}) : {fig['value']} ({len(fig['value'])})")
print("Question length:", len(data["question_for_crowd"]), "chars")
print("JSON saved successfully to", json_path)
