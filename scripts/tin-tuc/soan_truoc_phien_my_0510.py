import json
import os

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/truoc-phien-my.json"

title = "Bản tin 05/10 — Nikkei tăng 2,4%, STOXX 600 nhích 0,3%"

body = """<h3>Châu Á đóng cửa phiên đầu tuần</h3>
<p>Thị trường chứng khoán khu vực châu Á khép lại phiên giao dịch ngày 05/10 với sắc xanh áp đảo theo dữ liệu từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance World Indices</a>:</p>
<ul>
  <li>Chỉ số <strong>Nikkei 225</strong> (Nhật Bản) tăng mạnh 2,40% (tăng 1.637,40 điểm), đóng cửa tại 69.946,86 điểm sau khi có thời điểm vượt ngưỡng 70.000 điểm.</li>
  <li>Chỉ số <strong>Hang Seng</strong> (Hồng Kông) tăng 0,28% lên mức 24.040,34 điểm sau các nhịp rung lắc giằng co trong phiên.</li>
</ul>

<h3>Châu Âu đang giao dịch (cập nhật lúc 19:20 giờ VN)</h3>
<p>Thị trường chứng khoán châu Âu diễn biến phân hóa trong phiên chiều tối 05/10 theo ghi nhận từ <a href="https://finance.yahoo.com/quote/%5ESTOXX/">STOXX 600 Index</a>:</p>
<ul>
  <li>Chỉ số <strong>STOXX 600</strong> nhích tăng 0,3% lên 633,09 điểm.</li>
  <li>Chỉ số <strong>FTSE 100</strong> (Anh) tăng 0,4%.</li>
  <li>Chỉ số <strong>DAX</strong> (Đức) giảm nhẹ 0,1% do áp lực từ lợi suất trái phiếu chính phủ khu vực đồng Euro.</li>
</ul>

<h3>Hợp đồng tương lai Mỹ &amp; Hàng hóa</h3>
<p>Diễn biến thị trường phái sinh Phố Wall và năng lượng trước giờ mở cửa chính thức:</p>
<ul>
  <li><strong>Hợp đồng tương lai S&amp;P 500</strong> và <strong>Nasdaq 100</strong> giao dịch thận trọng trong biên độ hẹp theo <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance Futures</a>.</li>
  <li><strong>Giá dầu Brent</strong> duy trì ở mức cao quanh 102,50 USD/thùng theo <a href="https://finance.yahoo.com/markets/commodities/">Yahoo Finance Commodities</a> trong bối cảnh OPEC+ giữ nguyên mục tiêu sản lượng tháng 11.</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 19:33 tối 05/10/2026 trước giờ mở cửa phiên Mỹ.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Trước phiên Mỹ",
    "figures": [
        {"label": "Nikkei 225", "value": "69.946,86 (+2,40%)"},
        {"label": "Hang Seng", "value": "24.040,34 (+0,28%)"},
        {"label": "STOXX 600", "value": "633,09 (+0,3%)"},
        {"label": "FTSE 100", "value": "+0,4%"},
        {"label": "Brent", "value": "102,50 USD"}
    ],
    "question_for_crowd": "Trong lịch công bố tối nay, số liệu nào bạn chờ đọc trước khi phiên Mỹ mở cửa?"
}

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Title length:", len(data["title"]), "chars")
print("Body length:", len(data["body"]), "chars")
print("Figures count:", len(data["figures"]))
print("JSON saved successfully to", json_path)
