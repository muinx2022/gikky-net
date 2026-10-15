import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/truoc-phien-my.json"

title = "Bản tin 06/10 — Nikkei chốt 70.753 điểm, dầu thô lùi về 87,51 USD"

body = """<h3>Thị trường châu Á đóng cửa</h3>
<p>Thị trường chứng khoán châu Á đồng loạt tăng điểm trong phiên giao dịch ngày 06/10 theo ghi nhận từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance World Indices</a>:</p>
<ul>
  <li>Chỉ số <strong>Nikkei 225</strong> (Nhật Bản) đóng cửa tại <strong>70.753,75 điểm</strong>, tăng +1,15% (+806,89 điểm).</li>
  <li>Chỉ số <strong>Hang Seng</strong> (Hồng Kông) tăng +1,00% (+240,22 điểm), chốt phiên tại <strong>24.280,56 điểm</strong>.</li>
  <li>Chỉ số <strong>Shanghai Composite</strong> (Trung Quốc) tăng nhẹ +0,35% lên 3.324,15 điểm.</li>
</ul>

<h3>Chứng khoán châu Âu (cập nhật lúc 19:25 giờ VN)</h3>
<p>Các chỉ số chính tại châu Âu duy trì sắc xanh trong phiên giao dịch chiều tối theo dữ liệu từ <a href="https://tradingeconomics.com/stocks">Trading Economics Markets</a>:</p>
<ul>
  <li>Chỉ số <strong>FTSE 100</strong> (Anh) giao dịch tại <strong>10.595,15 điểm</strong> (+0,93%).</li>
  <li>Chỉ số <strong>DAX</strong> (Đức) đạt <strong>25.474,18 điểm</strong> (+0,87%).</li>
  <li>Chỉ số <strong>CAC 40</strong> (Pháp) giao dịch ở mức <strong>7.890,86 điểm</strong> (+0,72%).</li>
  <li>Chỉ số <strong>STOXX 600</strong> toàn châu Âu tăng +0,75% lên 637,85 điểm nhờ nhóm cổ phiếu công nghệ và bán dẫn.</li>
</ul>

<h3>Hợp đồng tương lai Mỹ &amp; Hàng hóa</h3>
<p>Thị trường tương lai Phố Wall và hàng hóa năng lượng trước giờ mở cửa chính thức:</p>
<ul>
  <li><strong>Hợp đồng tương lai S&amp;P 500</strong> tăng +0,40% và <strong>Nasdaq 100 futures</strong> tăng +0,60% theo <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance Futures</a>.</li>
  <li><strong>Lợi suất trái phiếu kho bạc Mỹ 10 năm</strong> neo ở mức cao <strong>5,28%</strong>.</li>
  <li><strong>Giá dầu thô</strong> giảm -2,15% về mức <strong>87,51 USD/thùng</strong> theo <a href="https://tradingeconomics.com/commodity/crude-oil">Trading Economics Commodities</a>.</li>
  <li><strong>Giá vàng giao ngay</strong> tăng +0,34% lên <strong>4.151,40 USD/ounce</strong> theo <a href="https://www.kitco.com">Kitco Metals</a>.</li>
</ul>

<h3>Lịch công bố kinh tế tối nay</h3>
<p>Lịch công bố số liệu vĩ mô của Mỹ trong tối 06/10 (giờ Việt Nam):</p>
<ul>
  <li><strong>19:15 giờ VN (08:15 EDT)</strong>: Báo cáo việc làm tuần của ADP (ADP Weekly Employment Change).</li>
  <li><strong>19:30 giờ VN (08:30 EDT)</strong>: Cán cân thương mại quốc tế về hàng hóa và dịch vụ tháng 8 (International Trade in Goods and Services).</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 19:33 tối 06/10/2026 trước giờ mở cửa phiên Mỹ.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Trước phiên Mỹ",
    "figures": [
        {"label": "Nikkei 225", "value": "70.753,75 (+1,15%)"},
        {"label": "Hang Seng", "value": "24.280,56 (+1,00%)"},
        {"label": "DAX 40", "value": "25.474,18 (+0,87%)"},
        {"label": "FTSE 100", "value": "10.595,15 (+0,93%)"},
        {"label": "Dầu thô", "value": "87,51 USD (-2,15%)"},
        {"label": "Vàng thế giới", "value": "4.151,40 USD/oz"}
    ],
    "question_for_crowd": "Trong lịch công bố kinh tế tối nay của Mỹ, số liệu nào bạn theo dõi trước giờ mở cửa?"
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
