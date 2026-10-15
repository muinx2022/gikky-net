import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/dem-qua.json"

title = "Bản tin 16/10 — Dow Jones tăng 556 điểm lên 52.177, vàng đạt 4.185 USD/ounce"

body = """<h3>Chứng khoán Mỹ</h3>
<p>Thị trường chứng khoán Mỹ ghi nhận phiên tăng điểm trên cả bốn chỉ số chính theo dữ liệu từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance World Indices</a>:</p>
<ul>
  <li>Chỉ số <strong>Dow Jones Industrial Average</strong> tăng +1,08% (+556,21 điểm), đóng cửa tại <strong>52.177,69 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EDJI/">Yahoo Finance Dow Jones</a>.</li>
  <li>Chỉ số <strong>S&amp;P 500</strong> tăng +0,33% (+25,12 điểm), đạt <strong>7.744,06 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EGSPC/">Yahoo Finance S&amp;P 500</a>.</li>
  <li>Chỉ số <strong>Nasdaq Composite</strong> tăng +0,08% (+20,16 điểm), chốt tại <strong>26.713,03 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EIXIC/">Yahoo Finance Nasdaq</a>.</li>
  <li>Chỉ số vốn hóa nhỏ <strong>Russell 2000</strong> tăng +1,38% (+37,74 điểm), lên mức <strong>2.767,27 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5ERUT/">Yahoo Finance Russell 2000</a>.</li>
</ul>

<h3>Chứng khoán châu Âu</h3>
<p>Các chỉ số thị trường chứng khoán châu Âu đồng loạt tăng điểm theo ghi nhận từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance World Indices</a>:</p>
<ul>
  <li>Chỉ số <strong>FTSE 100</strong> (Anh) tăng +1,08% (+115,49 điểm), chốt phiên tại <strong>10.840,35 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EFTSE/">Yahoo Finance FTSE 100</a>.</li>
  <li>Chỉ số <strong>CAC 40</strong> (Pháp) tăng +0,78% (+61,59 điểm), lên mức <strong>7.934,70 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EFCHI/">Yahoo Finance CAC 40</a>.</li>
  <li>Chỉ số <strong>STOXX 600</strong> toàn châu Âu tăng +0,38% (+2,41 điểm), dừng ở mức <strong>640,16 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5ESTOXX/">Yahoo Finance STOXX 600</a>.</li>
  <li>Chỉ số <strong>DAX 40</strong> (Đức) tăng +0,33% (+84,01 điểm), chốt tại <strong>25.382,62 điểm</strong> theo <a href="https://finance.yahoo.com/quote/%5EGDAXI/">Yahoo Finance DAX</a>.</li>
</ul>

<h3>Hàng hóa</h3>
<p>Diễn biến trên thị trường kim loại quý và năng lượng theo cập nhật từ <a href="https://finance.yahoo.com/markets/commodities/">Yahoo Finance Commodities</a>:</p>
<ul>
  <li><strong>Giá vàng hợp đồng tương lai</strong> tăng +0,37% (+15,30 USD), đạt mức <strong>4.185,40 USD/ounce</strong> theo <a href="https://finance.yahoo.com/quote/GC%3DF/">Yahoo Finance Gold</a>.</li>
  <li><strong>Giá dầu Brent</strong> giảm -0,21% (-0,22 USD), giao dịch ở mức <strong>105,70 USD/thùng</strong> theo <a href="https://finance.yahoo.com/quote/BZ%3DF/">Yahoo Finance Brent</a>.</li>
  <li><strong>Giá dầu WTI</strong> giảm -0,37% (-0,36 USD), dừng tại <strong>96,14 USD/thùng</strong> theo <a href="https://finance.yahoo.com/quote/CL%3DF/">Yahoo Finance WTI</a>.</li>
</ul>

<h3>Tiền tệ và lợi suất trái phiếu</h3>
<p>Chỉ số đồng USD và lợi suất trái phiếu chính phủ Mỹ theo số liệu từ <a href="https://finance.yahoo.com/markets/bonds/">Yahoo Finance Bonds</a>:</p>
<ul>
  <li><strong>Chỉ số đồng USD (DXY)</strong> giảm -0,54% (-0,55 điểm), về mức <strong>102,00 điểm</strong> theo <a href="https://finance.yahoo.com/quote/DX-Y.NYB/">Yahoo Finance DXY Index</a>.</li>
  <li><strong>Lợi suất trái phiếu chính phủ Mỹ kỳ hạn 10 năm</strong> giảm -0,10 điểm (-1,95%), về mức <strong>5,09%</strong> theo <a href="https://finance.yahoo.com/quote/%5ETNX/">Yahoo Finance 10-Year Bond</a>.</li>
  <li><strong>Lợi suất trái phiếu chính phủ Mỹ kỳ hạn 5 năm</strong> đạt <strong>4,899%</strong> (-0,093 điểm, tương đương -1,86%) theo <a href="https://finance.yahoo.com/quote/%5EFVX/">Yahoo Finance 5-Year Bond</a>.</li>
</ul>

<h3>Tiền mã hóa</h3>
<p>Dữ liệu giao dịch tài sản số rạng sáng ngày 16/10 theo ghi nhận từ <a href="https://finance.yahoo.com/markets/crypto/all/">Yahoo Finance Crypto</a>:</p>
<ul>
  <li><strong>Bitcoin (BTC)</strong> giao dịch ở mức <strong>82.126,32 USD</strong> (+560,04 USD, tương đương +0,69% trong 24 giờ qua) theo <a href="https://finance.yahoo.com/quote/BTC-USD/">Yahoo Finance BTC</a>.</li>
  <li><strong>Ethereum (ETH)</strong> giao dịch ở mức <strong>2.449,00 USD</strong> (+30,35 USD, tương đương +1,25%) theo <a href="https://finance.yahoo.com/quote/ETH-USD/">Yahoo Finance ETH</a>.</li>
  <li><strong>Solana (SOL)</strong> giao dịch ở mức <strong>105,46 USD</strong> (+1,28 USD, tương đương +1,23%) theo <a href="https://finance.yahoo.com/quote/SOL-USD/">Yahoo Finance SOL</a>.</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 06:15 giờ Việt Nam ngày 16/10/2026 từ dữ liệu giao dịch quốc tế.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Đêm qua",
    "figures": [
        {"label": "Dow Jones", "value": "52.177,69 (+1,08%)"},
        {"label": "S&P 500", "value": "7.744,06 (+0,33%)"},
        {"label": "Nasdaq", "value": "26.713,03 (+0,08%)"},
        {"label": "FTSE 100", "value": "10.840,35 (+1,08%)"},
        {"label": "Vàng (GC=F)", "value": "4.185,40 USD/oz"},
        {"label": "Dầu Brent", "value": "105,70 USD/thùng"}
    ],
    "question_for_crowd": "Khi Dow Jones tăng hơn 556 điểm và lợi suất trái phiếu Mỹ kỳ hạn 10 năm lùi về 5,09%, chỉ số nào trong bản tin sáng nay bạn quan tâm nhất trước giờ mở cửa?"
}

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Title length:", len(data["title"]), "chars")
print("Body length:", len(data["body"]), "chars")
print("Loai:", data["loai"])
print("Figures count:", len(data["figures"]))
for fig in data["figures"]:
    print(f"  {fig['label']} ({len(fig['label'])}) : {fig['value']} ({len(fig['value'])})")
print("Question length:", len(data["question_for_crowd"]), "chars")
print("Question ends with '?':", data["question_for_crowd"].endswith("?"))
print("JSON saved successfully to", json_path)
