import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/dem-qua.json"

title = "Bản tin 09/10 — S&P 500 chốt 7.765,36 điểm, dầu Brent lên 103,76 USD"

body = """<h3>Chứng khoán Mỹ</h3>
<p>Phiên giao dịch ngày 08/10 khép lại với sự điều chỉnh của cả ba chỉ số chính tại Phố Wall theo dữ liệu từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance World Indices</a>:</p>
<ul>
  <li>Chỉ số <strong>S&amp;P 500</strong> giảm -0,69% (-53,57 điểm), đóng cửa tại <strong>7.765,36 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EGSPC/">Yahoo Finance S&amp;P 500</a>.</li>
  <li>Chỉ số <strong>Nasdaq Composite</strong> lùi -1,47% (-406,45 điểm) xuống mức <strong>27.193,34 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EIXIC/">Yahoo Finance Nasdaq</a>.</li>
  <li>Chỉ số <strong>Dow Jones Industrial Average</strong> giảm -0,56% (-289,64 điểm), chốt phiên tại <strong>51.231,64 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EDJI/">Yahoo Finance Dow Jones</a>.</li>
</ul>

<h3>Chứng khoán Châu Âu</h3>
<p>Thị trường chứng khoán châu Âu đồng loạt giảm điểm trong phiên 08/10 theo ghi nhận từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance</a>:</p>
<ul>
  <li>Chỉ số <strong>DAX 40</strong> (Đức) giảm -2,52% (-642,22 điểm) về mức <strong>24.806,97 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EGDAXI/">Yahoo Finance DAX</a>.</li>
  <li>Chỉ số <strong>FTSE 100</strong> (Anh) chốt phiên tại <strong>10.441,60 điểm</strong> (-0,95%) theo <a href="https://finance.yahoo.com/quote/%5EFTSE/">Yahoo Finance FTSE 100</a>.</li>
  <li>Chỉ số <strong>STOXX 600</strong> toàn châu Âu lùi -0,75% xuống mức <strong>625,51 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5ESTOXX/">Yahoo Finance STOXX 600</a>.</li>
</ul>

<h3>Hàng hóa &amp; Lợi suất trái phiếu</h3>
<p>Diễn biến thị trường năng lượng, kim loại quý và nợ chính phủ theo cập nhật từ <a href="https://finance.yahoo.com/markets/commodities/">Yahoo Finance Commodities</a> và <a href="https://finance.yahoo.com/markets/bonds/">Yahoo Finance Bonds</a>:</p>
<ul>
  <li><strong>Giá dầu Brent</strong> tăng +3,55% (+3,56 USD) lên mức <strong>103,76 USD/thùng</strong> theo <a href="https://finance.yahoo.com/quote/BZ%3DF/">Yahoo Finance Brent</a>.</li>
  <li><strong>Giá dầu WTI</strong> tăng +3,18% (+2,81 USD) lên mức <strong>91,09 USD/thùng</strong> theo <a href="https://finance.yahoo.com/quote/CL%3DF/">Yahoo Finance WTI</a>.</li>
  <li><strong>Giá vàng tương lai</strong> tăng +0,50% (+20,90 USD) lên mức <strong>4.161,60 USD/ounce</strong> theo <a href="https://finance.yahoo.com/quote/GC%3DF/">Yahoo Finance Gold</a>.</li>
  <li><strong>Lợi suất trái phiếu chính phủ Mỹ kỳ hạn 10 năm</strong> dừng ở mức <strong>5,231%</strong> (-0,05%) theo <a href="https://finance.yahoo.com/quote/%5ETNX/">Yahoo Finance 10-Year Bond</a>.</li>
  <li><strong>Lợi suất trái phiếu chính phủ Mỹ kỳ hạn 5 năm</strong> đạt mức <strong>4,991%</strong> (-0,03%) theo <a href="https://finance.yahoo.com/quote/%5EFVX/">Yahoo Finance 5-Year Bond</a>.</li>
  <li><strong>Chỉ số đồng USD (DXY)</strong> đóng cửa ở mức <strong>102,12 điểm</strong> (-0,12%) theo <a href="https://finance.yahoo.com/quote/DX-Y.NYB/">Yahoo Finance DXY Index</a>.</li>
</ul>

<h3>Thị trường Tiền mã hóa qua đêm</h3>
<p>Dữ liệu giao dịch tài sản số rạng sáng 09/10 theo <a href="https://finance.yahoo.com/markets/crypto/all/">Yahoo Finance Crypto</a>:</p>
<ul>
  <li><strong>Bitcoin (BTC)</strong> giao dịch quanh mức <strong>81.807,52 USD</strong>, giảm -1,76% trong 24 giờ qua theo <a href="https://finance.yahoo.com/quote/BTC-USD/">Yahoo Finance BTC</a>.</li>
  <li><strong>Ethereum (ETH)</strong> giao dịch ở mức <strong>2.473,40 USD</strong>, giảm -3,89% theo <a href="https://finance.yahoo.com/quote/ETH-USD/">Yahoo Finance ETH</a>.</li>
</ul>

<h3>Số liệu kinh tế Mỹ công bố trong đêm</h3>
<p>Báo cáo thị trường lao động tuần qua theo công bố chính thức từ cơ quan quản lý:</p>
<ul>
  <li><strong>Bộ Lao động Mỹ (U.S. Department of Labor)</strong> công bố số đơn xin trợ cấp thất nghiệp lần đầu trong tuần kết thúc ngày 03/10 đạt <strong>197.000 đơn</strong>, giảm 2.000 đơn so với mức 199.000 đơn của tuần trước đó theo <a href="https://www.dol.gov/ui/data.pdf">U.S. Department of Labor</a>.</li>
  <li>Số đơn tiếp tục nhận trợ cấp thất nghiệp (Continuing Jobless Claims) trong tuần kết thúc ngày 26/09 tăng 17.000 đơn lên mức <strong>1.716.000 đơn</strong>.</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 06:12 sáng 09/10/2026 từ dữ liệu giao dịch quốc tế.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Đêm qua",
    "figures": [
        {"label": "S&P 500", "value": "7.765,36 (-0,69%)"},
        {"label": "Nasdaq", "value": "27.193,34 (-1,47%)"},
        {"label": "Dow Jones", "value": "51.231,64 (-0,56%)"},
        {"label": "DAX 40", "value": "24.806,97 (-2,52%)"},
        {"label": "Dầu Brent", "value": "103,76 USD (+3,55%)"},
        {"label": "Vàng thế giới", "value": "4.161,60 USD/oz"}
    ],
    "question_for_crowd": "Số nào trong bảng trên bạn nhìn trước khi mở bảng điện phiên cuối tuần?"
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
