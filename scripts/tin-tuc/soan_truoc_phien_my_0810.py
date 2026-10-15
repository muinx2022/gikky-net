import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/truoc-phien-my.json"

title = "Bản tin 08/10 — Nikkei chốt 69.042 điểm, dầu Brent lên 105,26 USD"

body = """<h3>Thị trường châu Á đóng cửa</h3>
<p>Thị trường chứng khoán khu vực châu Á khép lại phiên 08/10 trong sắc đỏ đồng loạt theo dữ liệu từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance World Indices</a>:</p>
<ul>
  <li>Chỉ số <strong>Nikkei 225</strong> (Nhật Bản) chốt phiên tại <strong>69.042,11 điểm</strong>, giảm -1,42% (-993,60 điểm) theo <a href="https://finance.yahoo.com/quote/%5EN225/">Yahoo Finance Nikkei 225</a>.</li>
  <li>Chỉ số <strong>Hang Seng</strong> (Hồng Kông) giảm -2,04% (-494,77 điểm), dừng ở mức <strong>23.785,79 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EHSI/">Yahoo Finance Hang Seng</a>.</li>
  <li>Chỉ số <strong>Shanghai Composite</strong> (Trung Quốc) giảm -0,79% (-30,29 điểm), đóng cửa tại <strong>3.811,90 điểm</strong> theo <a href="https://finance.yahoo.com/quote/000001.SS/">Yahoo Finance Shanghai Composite</a>.</li>
  <li>Chỉ số <strong>KOSPI</strong> (Hàn Quốc) đóng cửa tại <strong>6.625,93 điểm</strong>, giảm -4,54% (-315,46 điểm) theo <a href="https://finance.yahoo.com/quote/%5EKS11/">Yahoo Finance KOSPI</a>.</li>
</ul>

<h3>Chứng khoán châu Âu (cập nhật lúc 19:30 giờ VN)</h3>
<p>Thị trường chứng khoán châu Âu giao dịch trong sắc đỏ ở hầu hết các sàn chính theo dữ liệu từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance</a>:</p>
<ul>
  <li>Chỉ số <strong>DAX 40</strong> (Đức) lùi -2,23% về mức <strong>24.882,78 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EGDAXI/">Yahoo Finance DAX</a>.</li>
  <li>Chỉ số <strong>FTSE 100</strong> (Anh) giao dịch ở mức <strong>10.441,63 điểm</strong> (-0,95%) theo <a href="https://finance.yahoo.com/quote/%5EFTSE/">Yahoo Finance FTSE 100</a>.</li>
  <li>Chỉ số <strong>CAC 40</strong> (Pháp) giảm -0,51% xuống <strong>7.729,22 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EFCHI/">Yahoo Finance CAC 40</a>.</li>
  <li>Chỉ số <strong>STOXX 600</strong> toàn châu Âu giảm -0,65% về <strong>626,18 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5ESTOXX/">Yahoo Finance STOXX 600</a>.</li>
</ul>

<h3>Hợp đồng tương lai Mỹ &amp; Hàng hóa</h3>
<p>Diễn biến hợp đồng tương lai Phố Wall và thị trường năng lượng trước giờ mở cửa chính thức:</p>
<ul>
  <li><strong>Hợp đồng tương lai S&amp;P 500</strong> giảm -0,40% về <strong>7.821,00 điểm</strong> và <strong>Nasdaq 100 futures</strong> lùi -0,65% về <strong>31.196,75 điểm</strong> theo <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance Futures</a>.</li>
  <li><strong>Hợp đồng tương lai Dow Jones</strong> giao dịch ở mức <strong>51.079,00 điểm</strong> (-0,72%) theo <a href="https://finance.yahoo.com/quote/YM%3DF/">Yahoo Finance Dow Futures</a>.</li>
  <li><strong>Giá dầu Brent</strong> tăng +5,05% lên mức <strong>105,26 USD/thùng</strong> và <strong>dầu WTI</strong> lên <strong>92,66 USD/thùng</strong> (+4,96%) theo <a href="https://finance.yahoo.com/quote/BZ%3DF/">Yahoo Finance Brent</a>.</li>
  <li><strong>Giá vàng giao ngay</strong> tăng nhẹ +0,20% lên mức <strong>4.149,00 USD/ounce</strong> theo <a href="https://finance.yahoo.com/quote/GC%3DF/">Yahoo Finance Gold</a>.</li>
  <li><strong>Chỉ số đồng USD (DXY)</strong> biến động nhẹ quanh <strong>102,32 điểm</strong> (+0,08%) theo <a href="https://finance.yahoo.com/quote/DX-Y.NYB/">Yahoo Finance DXY Index</a>.</li>
</ul>

<h3>Lịch công bố kinh tế tối nay</h3>
<p>Lịch công bố số liệu vĩ mô của Mỹ trong tối 08/10 (giờ Việt Nam):</p>
<ul>
  <li><strong>19:30 giờ VN (08:30 EDT)</strong>: Báo cáo số đơn xin trợ cấp thất nghiệp lần đầu hàng tuần (Initial Jobless Claims) theo <a href="https://www.dol.gov/ui/data.pdf">Bộ Lao động Mỹ (U.S. Department of Labor)</a>.</li>
  <li><strong>21:00 giờ VN (10:00 EDT)</strong>: Báo cáo tồn kho bán buôn tháng 8 theo <a href="https://www.census.gov/wholesale/">Cục Điều tra Dân số Mỹ (U.S. Census Bureau)</a>.</li>
  <li><strong>21:30 giờ VN (10:30 EDT)</strong>: Báo cáo tồn kho khí tự nhiên hàng tuần theo <a href="https://www.eia.gov/naturalgas/">Cơ quan Thông tin Năng lượng Mỹ (EIA)</a>.</li>
  <li><strong>00:00 rạng sáng mai (13:00 EDT)</strong>: Kết quả đấu thầu trái phiếu chính phủ Mỹ kỳ hạn 30 năm theo <a href="https://www.treasurydirect.gov">Bộ Tài chính Mỹ (Treasury Direct)</a>.</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 19:33 tối 08/10/2026 trước giờ mở cửa phiên Mỹ.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Trước phiên Mỹ",
    "figures": [
        {"label": "Nikkei 225", "value": "69.042,11 (-1,42%)"},
        {"label": "Hang Seng", "value": "23.785,79 (-2,04%)"},
        {"label": "DAX 40", "value": "24.882,78 (-2,23%)"},
        {"label": "S&P 500 futures", "value": "7.821,00 (-0,40%)"},
        {"label": "Dầu Brent", "value": "105,26 USD (+5,05%)"},
        {"label": "Vàng thế giới", "value": "4.149,00 USD/oz"}
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
