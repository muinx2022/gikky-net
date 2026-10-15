import json
import os
import sys

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")
if sys.stderr and hasattr(sys.stderr, "reconfigure"):
    sys.stderr.reconfigure(encoding="utf-8")

os.makedirs("scripts/tin-tuc/.tam", exist_ok=True)
json_path = "scripts/tin-tuc/.tam/truoc-phien-my.json"

title = "Bản tin 15/10 — KOSPI lùi 7,6% vì áp lực bán dẫn, vàng tăng lên 4.156 USD/ounce"

body = """<h3>Thị trường châu Á đóng cửa phiên chiều</h3>
<p>Thị trường chứng khoán khu vực châu Á - Thái Bình Dương khép lại phiên giao dịch ngày 15/10 với sắc đỏ chiếm ưu thế rõ rệt, đặc biệt tại các nhóm cổ phiếu công nghệ và bán dẫn theo ghi nhận từ <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance World Indices</a>:</p>
<ul>
  <li>Chỉ số <strong>KOSPI</strong> của Hàn Quốc giảm sâu <strong>-7,6%</strong>, kích hoạt cơ chế ngắt mạch giao dịch tạm thời (Circuit Breaker) trong bối cảnh các cổ phiếu trụ cột ngành bộ nhớ như SK Hynix lùi hơn -11% và Samsung Electronics giảm gần -9% theo <a href="https://finance.yahoo.com/quote/%5EKS11/">Yahoo Finance KOSPI</a>.</li>
  <li>Chỉ số <strong>Nikkei 225</strong> của Nhật Bản đóng cửa lùi <strong>-4,9%</strong> khi làn sóng bán tháo lan rộng ở các mã công nghệ lớn và tập đoàn đầu tư SoftBank theo <a href="https://finance.yahoo.com/quote/%5EN225/">Yahoo Finance Nikkei 225</a>.</li>
  <li>Chỉ số <strong>Taiex</strong> của Đài Loan giảm <strong>-3,0%</strong> do áp lực chốt lời và điều chỉnh mạnh tại nhóm sản xuất gia công vi mạch bán dẫn.</li>
</ul>

<hr>

<h3>Chứng khoán châu Âu (cập nhật lúc 19:30 giờ VN)</h3>
<p>Tính đến 19:30 giờ Việt Nam, các sàn giao dịch chứng khoán lớn tại châu Âu ghi nhận diễn biến phân hóa giữa các nhóm ngành:</p>
<ul>
  <li>Chỉ số <strong>FTSE 100</strong> của Anh tăng <strong>+0,5%</strong>, được nâng đỡ nhờ số liệu tăng trưởng GDP tháng 8 vượt kỳ vọng theo ghi nhận từ <a href="https://www.theguardian.com/business">The Guardian Business</a> và <a href="https://tradingeconomics.com/united-kingdom/gdp-growth-annual">Trading Economics</a>.</li>
  <li>Chỉ số <strong>DAX 40</strong> của Đức giảm nhẹ <strong>-0,3%</strong> trước áp lực bán ở cổ phiếu thiết bị bán dẫn ASML (giảm xấp xỉ 4%) theo <a href="https://finance.yahoo.com/quote/%5EGDAXI/">Yahoo Finance DAX</a>.</li>
  <li>Chỉ số <strong>CAC 40</strong> của Pháp duy trì mức tăng <strong>+0,3%</strong> theo <a href="https://finance.yahoo.com/quote/%5EFCHI/">Yahoo Finance CAC 40</a>.</li>
</ul>

<hr>

<h3>Hợp đồng tương lai Mỹ &amp; Thị trường hàng hóa</h3>
<p>Trước giờ mở cửa phiên giao dịch chính thức tại Phố Wall, các chỉ số tương lai và thị trường nguyên liệu ghi nhận trạng thái tái cân bằng:</p>
<ul>
  <li>Hợp đồng tương lai <strong>S&amp;P 500</strong> và <strong>Nasdaq 100</strong> giằng co quanh mốc tham chiếu nhằm tìm điểm cân bằng sau phiên điều chỉnh sâu liền trước theo <a href="https://finance.yahoo.com/markets/world-indices/">Yahoo Finance Futures</a>.</li>
  <li><strong>Giá vàng thế giới</strong> bật tăng mạnh lên mốc <strong>4.156 USD/ounce</strong> (+1,2%) do dòng tiền toàn cầu gia tăng nhu cầu phân bổ vào tài sản trú ẩn an toàn theo <a href="https://finance.yahoo.com/quote/GC=F/">Yahoo Finance Gold</a>.</li>
  <li><strong>Giá dầu Brent</strong> hạ nhiệt nhẹ về mức <strong>104,17 USD/thùng</strong> và dầu WTI giao dịch quanh <strong>94,07 USD/thùng</strong> theo <a href="https://finance.yahoo.com/quote/BZ=F/">Yahoo Finance Brent</a>.</li>
  <li><strong>Lợi suất trái phiếu Chính phủ Mỹ kỳ hạn 10 năm</strong> lùi 10 điểm cơ bản (bps) xuống mức <strong>5,08%</strong> theo <a href="https://finance.yahoo.com/quote/%5ETNX/">Yahoo Finance 10-Year Bond Yield</a>.</li>
</ul>

<hr>

<h3>Lịch công bố kinh tế Mỹ tối nay</h3>
<p>Các chỉ báo vĩ mô quan trọng của Mỹ được công bố trong tối 15/10 (giờ Việt Nam):</p>
<ul>
  <li><strong>19:30 giờ VN (08:30 EDT)</strong>: Báo cáo số đơn xin trợ cấp thất nghiệp lần đầu hàng tuần (Initial Jobless Claims) từ <a href="https://www.dol.gov/ui/data.pdf">Bộ Lao động Mỹ (U.S. Department of Labor)</a>.</li>
  <li><strong>21:00 giờ VN (10:00 EDT)</strong>: Báo cáo tồn kho bán buôn tháng 8 do <a href="https://www.census.gov/wholesale/">Cục Điều tra Dân số Mỹ (U.S. Census Bureau)</a> công bố.</li>
  <li><strong>21:30 giờ VN (10:30 EDT)</strong>: Báo cáo biến động tồn kho khí tự nhiên hàng tuần từ <a href="https://www.eia.gov/naturalgas/">Cơ quan Thông tin Năng lượng Mỹ (EIA)</a>.</li>
</ul>

<hr>
<p><em>Bản tin tổng hợp tự động lúc 19:33 tối 15/10/2026 trước giờ mở cửa phiên Mỹ.</em></p>"""

data = {
    "sub": "tin-tuc",
    "title": title,
    "body": body,
    "loai": "Trước phiên Mỹ",
    "figures": [
        {"label": "KOSPI", "value": "Giảm -7,6% (Circuit)"},
        {"label": "Nikkei 225", "value": "Lùi -4,9% (Bán dẫn)"},
        {"label": "FTSE 100", "value": "Tăng +0,5% (GDP tốt)"},
        {"label": "Vàng thế giới", "value": "4.156 USD/oz (+1,2%)"},
        {"label": "Dầu Brent", "value": "104,17 USD/thùng"},
        {"label": "Lợi suất 10Y Mỹ", "value": "5,08% (-10 bps)"}
    ],
    "question_for_crowd": "Sau cú sụt giảm hơn 7% của nhóm bán dẫn châu Á, bạn đánh giá dòng tiền Phố Wall tối nay sẽ bắt đáy công nghệ hay tiếp tục dịch chuyển sang vàng và năng lượng?"
}

with open(json_path, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print("Title length:", len(data["title"]), "chars")
print("Body length:", len(data["body"]), "chars")
print("Figures count:", len(data["figures"]))
for fig in data["figures"]:
    print(f"  {fig['label']} ({len(fig['label'])}) : {fig['value']} ({len(fig['value'])})")
print("Question length:", len(data["question_for_crowd"]), "chars")
print("Ends with '?':", data["question_for_crowd"].endswith("?"))
print("File written successfully:", json_path)
