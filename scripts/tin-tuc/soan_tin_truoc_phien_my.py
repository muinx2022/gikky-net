# -*- coding: utf-8 -*-
"""Soạn và ghi file JSON cho bản tin slot truoc-phien-my ngày 09/10/2026."""

import json
import os
import sys
from pathlib import Path

if sys.stdout and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

title = "Bản tin 09/10 — Nikkei chốt 69.030,92 điểm, dầu Brent 102,76 USD"
sub = "tin-tuc"
loai = "Trước phiên Mỹ"

figures = [
    {"label": "Nikkei 225", "value": "69.030,92 (-0,02%)"},
    {"label": "Hang Seng", "value": "24.211,35 (+0,34%)"},
    {"label": "FTSE 100", "value": "10.566,82 (+1,04%)"},
    {"label": "S&P 500 futures", "value": "7.847,00 (+0,39%)"},
    {"label": "Dầu Brent", "value": "102,76 USD/thùng"},
    {"label": "Vàng giao ngay", "value": "4.209,00 USD/oz"}
]

question_for_crowd = "Trong báo cáo tâm lý người tiêu dùng và kỳ vọng lạm phát của Đại học Michigan công bố tối nay, bạn quan tâm chỉ số nào nhất?"

body = """<h3>Châu Á đóng cửa phiên chiều</h3>
<p>Thị trường chứng khoán khu vực châu Á - Thái Bình Dương khép lại phiên giao dịch ngày 09/10 với diễn biến phân hóa giữa các chỉ số chính:</p>
<ul>
<li>Chỉ số Nikkei 225 của Nhật Bản đóng cửa tại <strong>69.030,92 điểm</strong>, giảm nhẹ 11,19 điểm (-0,02%) so với phiên trước, theo số liệu từ <a href="https://finance.yahoo.com/quote/%5EN225">Yahoo Finance</a>.</li>
<li>Chỉ số Hang Seng của Hồng Kông chốt phiên tăng 80,85 điểm (+0,34%) lên mức <strong>24.211,35 điểm</strong>, theo dữ liệu từ <a href="https://finance.yahoo.com/quote/%5EHSI">Yahoo Finance</a>.</li>
<li>Chỉ số Shanghai Composite của Thượng Hải nhích nhẹ 1,89 điểm (+0,05%) lên mức <strong>3.813,79 điểm</strong>, theo thống kê của <a href="https://finance.yahoo.com/quote/000001.SS">Yahoo Finance</a>.</li>
<li>Chỉ số KOSPI của Hàn Quốc đóng cửa tại <strong>6.625,93 điểm</strong>, giảm 315,46 điểm (-4,54%), theo báo cáo từ <a href="https://finance.yahoo.com/quote/%5EKS11">Yahoo Finance</a>.</li>
</ul>

<hr>

<h3>Thị trường châu Âu đang giao dịch</h3>
<p>Ghi nhận lúc 19:30 giờ Việt Nam, các thị trường chứng khoán lớn tại châu Âu đang duy trì sắc xanh trong phiên chiều:</p>
<ul>
<li>Chỉ số FTSE 100 của Anh tăng 108,32 điểm (+1,04%) lên <strong>10.566,82 điểm</strong>, theo dữ liệu từ <a href="https://finance.yahoo.com/quote/%5EFTSE">Yahoo Finance</a>.</li>
<li>Chỉ số DAX của Đức tăng 20,03 điểm (+0,08%) lên <strong>25.124,39 điểm</strong>, theo <a href="https://finance.yahoo.com/quote/%5EGDAXI">Yahoo Finance</a>.</li>
<li>Chỉ số CAC 40 của Pháp tăng 75,21 điểm (+0,97%) lên <strong>7.804,90 điểm</strong>, theo dữ liệu từ <a href="https://finance.yahoo.com/quote/%5EFCHI">Yahoo Finance</a>.</li>
</ul>

<hr>

<h3>Hợp đồng tương lai chứng khoán Mỹ</h3>
<p>Tính đến 19:30 giờ Việt Nam, các hợp đồng tương lai chỉ số chính của Phố Wall giao dịch tăng điểm trước giờ mở cửa chính thức:</p>
<ul>
<li>Hợp đồng tương lai S&amp;P 500 tăng 30,75 điểm (+0,39%) lên mức <strong>7.847,00 điểm</strong>, theo số liệu từ <a href="https://finance.yahoo.com/quote/ES=F">Yahoo Finance</a>.</li>
<li>Hợp đồng tương lai Nasdaq 100 tăng 242,50 điểm (+0,78%) lên mức <strong>31.212,00 điểm</strong>, theo <a href="https://finance.yahoo.com/quote/NQ=F">Yahoo Finance</a>.</li>
<li>Hợp đồng tương lai Dow Jones tăng 81,00 điểm (+0,16%) lên mức <strong>51.574,00 điểm</strong>, theo dữ liệu từ <a href="https://finance.yahoo.com/quote/YM=F">Yahoo Finance</a>.</li>
</ul>

<hr>

<h3>Hàng hóa và tiền tệ quốc tế</h3>
<p>Diễn biến các kênh tài sản và tiền tệ ghi nhận lúc 19:30 giờ Việt Nam:</p>
<ul>
<li>Giá dầu thô Brent giao sau giảm 1,52 USD (-1,46%) xuống mức <strong>102,76 USD/thùng</strong>, theo <a href="https://finance.yahoo.com/quote/BZ=F">Yahoo Finance</a>.</li>
<li>Giá dầu thô WTI giao sau giảm 0,84 USD (-0,92%) xuống mức <strong>90,65 USD/thùng</strong>, theo <a href="https://finance.yahoo.com/quote/CL=F">Yahoo Finance</a>.</li>
<li>Giá vàng giao ngay tăng 52,00 USD (+1,25%) lên mức <strong>4.209,00 USD/ounce</strong>, theo <a href="https://finance.yahoo.com/quote/GC=F">Yahoo Finance</a>.</li>
<li>Chỉ số đồng USD (DXY) ở mức <strong>102,21 điểm</strong>, tăng 0,07 điểm (+0,07%), theo <a href="https://finance.yahoo.com/quote/DX-Y.NYB">Yahoo Finance</a>.</li>
<li>Tỷ giá USD/JPY giao dịch tại <strong>158,25 yen</strong>, trong khi tỷ giá EUR/USD ở mức <strong>1,1200 USD</strong>.</li>
</ul>

<hr>

<h3>Lịch công bố số liệu kinh tế tối nay</h3>
<p>Các dữ liệu kinh tế quan trọng của Mỹ dự kiến công bố trong tối ngày 09/10 (giờ Việt Nam):</p>
<ul>
<li><strong>21:00 (10:00 AM ET):</strong> Đại học Michigan công bố báo cáo sơ bộ <em>Chỉ số Tâm lý Người tiêu dùng tháng 10</em> cùng số liệu <em>Kỳ vọng lạm phát 1 năm và 5 năm</em>, theo lịch kinh tế từ <a href="https://www.investing.com/economic-calendar/">Investing.com</a>.</li>
<li>Các quan chức Cục Dự trữ Liên bang Mỹ (Fed) bước vào giai đoạn hạn chế phát biểu trước thềm cuộc họp chính sách tiền tệ FOMC diễn ra vào ngày 27–28/10/2026.</li>
</ul>

<p><em>Bản tin tổng hợp tự động lúc 19:33 giờ Việt Nam.</em></p>"""

bai_data = {
    "sub": sub,
    "title": title,
    "body": body,
    "loai": loai,
    "figures": figures,
    "question_for_crowd": question_for_crowd
}

tam_dir = Path("scripts/tin-tuc/.tam")
tam_dir.mkdir(parents=True, exist_ok=True)
json_file = tam_dir / "truoc-phien-my.json"

with open(json_file, "w", encoding="utf-8") as f:
    json.dump(bai_data, f, ensure_ascii=False, indent=2)

print(f"✅ Đã ghi file JSON tại: {json_file}")
print(f"   Độ dài title: {len(title)} ký tự (chuẩn <= 160)")
print(f"   Độ dài body: {len(body)} ký tự (chuẩn <= 10000)")
print(f"   Số figures: {len(figures)} cặp (chuẩn <= 6)")
for fig in figures:
    print(f"     {fig['label']} ({len(fig['label'])}) : {fig['value']} ({len(fig['value'])})")
print(f"   Độ dài question: {len(question_for_crowd)} ký tự (chuẩn <= 200, kết thúc bằng ?)")
