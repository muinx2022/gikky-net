import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/truoc-phien-my.json"

title = "Bản tin 07/10 — Nikkei chốt 70.035 điểm, dầu Brent lên 101,50 USD"

body = """<h3>Thị trường châu Á đóng cửa</h3>
<p>Thị trường chứng khoán châu Á phân hóa trong phiên giao dịch ngày 07/10 theo ghi nhận từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance World Indices</a>:</p>
<ul>
  <li>Chỉ số <strong>Nikkei 225</strong> (Nhật Bản) đóng cửa tại <strong>70.035,71 điểm</strong>, giảm -0,92% (-648,27 điểm).</li>
  <li>Chỉ số <strong>Hang Seng</strong> (Hồng Kông) tăng +0,38% (+90,16 điểm), chốt phiên tại <strong>24.130,50 điểm</strong>.</li>
  <li>Chỉ số <strong>Shanghai Composite</strong> (Trung Quốc) tăng nhẹ +0,31% lên <strong>3.842,20 điểm</strong>.</li>
</ul>

<h3>Chứng khoán châu Âu (cập nhật lúc 19:30 giờ VN)</h3>
<p>Các chỉ số chính tại châu Âu giao dịch trong sắc đỏ nhẹ theo dữ liệu từ <a href="https://tradingeconomics.com/stocks">Trading Economics Markets</a>:</p>
<ul>
  <li>Chỉ số <strong>FTSE 100</strong> (Anh) giao dịch tại <strong>10.476,67 điểm</strong> (-0,20%).</li>
  <li>Chỉ số <strong>DAX 40</strong> (Đức) đạt <strong>25.116,20 điểm</strong> (-0,55%).</li>
  <li>Chỉ số <strong>CAC 40</strong> (Pháp) giao dịch ở mức <strong>7.770,48 điểm</strong> (-1,20%).</li>
  <li>Chỉ số <strong>STOXX 600</strong> toàn châu Âu giảm -0,45% xuống 634,95 điểm.</li>
</ul>

<h3>Hợp đồng tương lai Mỹ &amp; Hàng hóa</h3>
<p>Thị trường tương lai Phố Wall và hàng hóa năng lượng trước giờ mở cửa chính thức:</p>
<ul>
  <li><strong>Hợp đồng tương lai S&amp;P 500</strong> lùi -0,42% về mức <strong>7.840,75 điểm</strong> và <strong>Nasdaq 100 futures</strong> lùi -0,74% về <strong>31.249,00 điểm</strong> theo <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance Futures</a>.</li>
  <li><strong>Hợp đồng tương lai Dow Jones</strong> giao dịch ở mức <strong>51.425,00 điểm</strong> (-0,75%).</li>
  <li><strong>Chỉ số đồng USD (DXY)</strong> tăng +0,64% lên mức <strong>102,48 điểm</strong> theo <a href="https://www.marketwatch.com/investing/index/dxy">MarketWatch DXY Index</a>.</li>
  <li><strong>Giá dầu Brent</strong> tăng +0,91% lên mức <strong>101,50 USD/thùng</strong> và <strong>dầu WTI</strong> ở mức <strong>89,80 USD/thùng</strong> (+0,40%) theo <a href="https://tradingeconomics.com/commodity/crude-oil">Trading Economics Commodities</a>.</li>
  <li><strong>Giá vàng giao ngay</strong> điều chỉnh -1,18% về mức <strong>4.137,70 USD/ounce</strong> theo <a href="https://www.kitco.com">Kitco Metals</a>.</li>
</ul>

<h3>Lịch công bố kinh tế tối nay</h3>
<p>Lịch công bố số liệu vĩ mô của Mỹ trong tối 07/10 (giờ Việt Nam):</p>
<ul>
  <li><strong>19:30 giờ VN (08:30 EDT)</strong>: Báo cáo chỉ số đơn xin thế chấp nhà tuần của MBA (MBA Mortgage Applications).</li>
  <li><strong>21:30 giờ VN (10:30 EDT)</strong>: Báo cáo tồn kho dầu thô thương mại hàng tuần của Cơ quan Thông tin Năng lượng Mỹ (EIA Weekly Petroleum Status Report).</li>
  <li><strong>01:00 rạng sáng mai (14:00 EDT)</strong>: Biên bản cuộc họp chính sách tiền tệ gần nhất của Cục Dự trữ Liên bang Mỹ (FOMC Meeting Minutes).</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 19:33 tối 07/10/2026 trước giờ mở cửa phiên Mỹ.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Trước phiên Mỹ",
    "figures": [
        {"label": "Nikkei 225", "value": "70.035,71 (-0,92%)"},
        {"label": "Hang Seng", "value": "24.130,50 (+0,38%)"},
        {"label": "DAX 40", "value": "25.116,20 (-0,55%)"},
        {"label": "S&P 500 futures", "value": "7.840,75 (-0,42%)"},
        {"label": "Dầu Brent", "value": "101,50 USD (+0,91%)"},
        {"label": "Vàng thế giới", "value": "4.137,70 USD/oz"}
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
