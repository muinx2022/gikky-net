import json
import os

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/dem-qua.json"

title = "Bản tin 05/10 — S&P 500 tăng 0,7%, Brent ở mốc 102,25 USD"

body = """<h3>Chứng khoán Mỹ</h3>
<p>Phiên giao dịch cuối tuần ghi nhận sự đi lên đồng loạt của các chỉ số chính tại Phố Wall theo dữ liệu từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance World Indices</a>:</p>
<ul>
  <li>Chỉ số <strong>S&amp;P 500</strong> tăng 0,7% lên mức 7.722,72 điểm.</li>
  <li>Chỉ số <strong>Nasdaq Composite</strong> tăng 1,2% lên mức 27.190,86 điểm.</li>
  <li>Chỉ số <strong>Dow Jones Industrial Average</strong> tăng 0,5% (khoảng 250 điểm) lên 51.176,96 điểm.</li>
</ul>

<h3>Chứng khoán Châu Âu</h3>
<p>Thị trường chứng khoán châu Âu ghi nhận nhịp hồi phục sau các phiên chịu áp lực đầu tháng 10 theo báo cáo từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance</a>:</p>
<ul>
  <li>Chỉ số <strong>STOXX 600</strong> tăng 0,75% đóng cửa ở 631,35 điểm.</li>
  <li>Chỉ số <strong>FTSE 100</strong> (Anh) tăng 0,23% lên 10.452 điểm.</li>
  <li>Chỉ số <strong>DAX</strong> (Đức) cũng phục hồi cùng xu hướng chung của khu vực đồng Euro.</li>
</ul>

<h3>Hàng hóa &amp; Lợi suất trái phiếu</h3>
<p>Diễn biến thị trường hàng hóa và nợ chính phủ theo cập nhật từ <a href="https://finance.yahoo.com/markets/commodities/">Yahoo Finance Commodities</a> và <a href="https://finance.yahoo.com/markets/bonds/">Yahoo Finance Bonds</a>:</p>
<ul>
  <li><strong>Dầu Brent</strong> chốt phiên ở mức 102,25 USD/thùng.</li>
  <li><strong>Vàng tương lai</strong> đóng cửa ở mức 4.162,30 USD/ounce.</li>
  <li><strong>Lợi suất trái phiếu chính phủ Mỹ kỳ hạn 10 năm</strong> dừng ở mức 5,28%.</li>
  <li><strong>Chỉ số đồng USD (DXY)</strong> ghi nhận ở mức 101,93 điểm theo <a href="https://finance.yahoo.com/quote/DX-Y.NYB/">DXY Index</a>.</li>
</ul>

<h3>Thị trường Tiền mã hóa</h3>
<p>Theo dữ liệu tổng hợp tại <a href="https://finance.yahoo.com/markets/crypto/all/">Yahoo Finance Crypto</a>:</p>
<ul>
  <li><strong>Bitcoin (BTC)</strong> giao dịch quanh vùng 84.700 – 85.000 USD trong ngày 04/10/2026.</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 06:15 sáng 05/10/2026 từ dữ liệu giao dịch quốc tế.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Đêm qua",
    "figures": [
        {"label": "S&P 500", "value": "7.722,72 (+0,7%)"},
        {"label": "Nasdaq", "value": "27.190,86 (+1,2%)"},
        {"label": "Dow Jones", "value": "51.176,96 (+0,5%)"},
        {"label": "Brent", "value": "102,25 USD"},
        {"label": "Vàng giao ngay", "value": "4.162,30 USD"},
        {"label": "DXY", "value": "101,93"}
    ],
    "question_for_crowd": "Số nào trong bảng trên bạn nhìn trước khi mở bảng điện đầu tuần?"
}

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Title length:", len(data["title"]), "chars")
print("Body length:", len(data["body"]), "chars")
print("Figures count:", len(data["figures"]))
print("Question:", data["question_for_crowd"])
print("JSON saved successfully to", json_path)
