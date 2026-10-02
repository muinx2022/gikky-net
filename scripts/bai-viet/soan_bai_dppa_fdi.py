# -*- coding: utf-8 -*-
"""Soạn và xuất bản bài phân tích Thời sự kinh tế & chính sách: Cơ chế DPPA và cơn khát điện sạch RE100 của dòng vốn FDI lúc 16:45 ngày 02/10/2026."""
import os
import sys
import json
import base64
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(REPO_ROOT / "scripts" / "bai-viet"))
from watermark import gan_watermark

anh_goc = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\dppa_green_energy_fdi_1790934374350.jpg"
anh_wm_path = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "dppa_green_energy_fdi_wm.jpg"

print("Đang gắn watermark gikky.net vào ảnh...")
gan_watermark(anh_goc, str(anh_wm_path))

with open(anh_wm_path, "rb") as f:
    anh_b64 = base64.b64encode(f.read()).decode("utf-8")

title = "Cơn khát điện sạch RE100 của dòng vốn FDI và cơ chế DPPA: Lối thoát cho năng lượng tái tạo hay nút thắt mới trên lưới điện?"
sub = "vi-mo"
loai = "Thời sự"

body = """<p>Trong cuộc đua thu hút dòng vốn đầu tư trực tiếp nước ngoài (FDI) thế hệ mới, lợi thế cạnh tranh truyền thống của Việt Nam về giá nhân công rẻ hay các gói ưu đãi miễn giảm thuế thu nhập doanh nghiệp đang dần mất đi sức nặng quyết định. Thay vào đó, một biến số hạ tầng mới đang trở thành điều kiện tiên quyết trên bàn đàm phán của các tập đoàn công nghệ toàn cầu: <strong>Khả năng cung ứng nguồn điện sạch đạt chuẩn RE100</strong>.</p>

<p>Từ Apple, Samsung, Foxconn cho đến những đại bàng bán dẫn như Intel, Amkor hay Hana Micron, tất cả đều nằm trong liên minh toàn cầu cam kết sử dụng 100% năng lượng tái tạo cho toàn bộ chuỗi cung ứng vào năm 2030. Nếu không thể tiếp cận nguồn điện xanh để nhận các chứng chỉ năng lượng tái tạo (I-REC), những sản phẩm công nghệ cao sản xuất tại Việt Nam sẽ đối mặt với rủi ro bị loại khỏi chuỗi cung ứng quốc tế hoặc chịu mức thuế phát thải carbon trừng phạt (CBAM) khi xuất khẩu sang châu Âu và Mỹ.</p>

{{ANH_1}}

<h3>Nghị định 80/2024/NĐ-CP và bước ngoặt phá vỡ thế độc quyền người mua</h3>
<p>Suốt nhiều năm qua, nghịch lý lớn nhất của ngành năng lượng Việt Nam là sự lệch pha nghiêm trọng: Hàng chục nghìn megawatt điện gió và điện mặt trời tại miền Trung và miền Nam bị cắt giảm công suất hoặc "nằm đắp chiếu" vì quá tải lưới điện truyền tải và bế tắc đàm phán giá bán điện chuyển tiếp với Tập đoàn Điện lực Việt Nam (EVN). Trong khi đó, các nhà máy FDI công nghệ cao ở miền Bắc lại luôn đối mặt với nỗi lo thiếu điện cục bộ trong mùa cao điểm.</p>

<p>Sự ra đời của <strong>Nghị định số 80/2024/NĐ-CP</strong> quy định về cơ chế mua bán điện trực tiếp (DPPA - Direct Power Purchase Agreement) được đánh giá là một bước đột phá thể chế mang tính lịch sử. Lần đầu tiên, thị trường năng lượng Việt Nam chính thức cho phép các đơn vị phát điện tái tạo bán điện thẳng cho các khách hàng tiêu thụ lớn mà không bắt buộc phải đi qua một người mua duy nhất là EVN.</p>

<p>Cơ chế DPPA thiết lập hai hành lang giao dịch với cấu trúc vận hành hoàn toàn khác biệt:</p>

<ul>
  <li><strong>Mô hình 1 — Mua bán qua đường dây kết nối riêng (Physical DPPA):</strong> Đơn vị phát điện tái tạo và khách hàng công nghiệp tự thỏa thuận đầu tư đường dây riêng nối trực tiếp từ nhà máy điện tới cơ sở sản xuất. Hai bên toàn quyền đàm phán về giá điện, sản lượng hợp đồng và các điều khoản giao nhận mà không chịu sự can thiệp của EVN. Tuy nhiên, mô hình này chỉ khả thi trên thực địa khi nguồn phát nằm liền kề với khu công nghiệp do rào cản giải phóng mặt bằng và chi phí kéo đường dây cao thế độc lập là cực kỳ tốn kém.</li>
  <li><strong>Mô hình 2 — Mua bán qua lưới điện quốc gia (Synthetic / Virtual DPPA):</strong> Đây là xương sống của cơ chế DPPA, áp dụng cho phần lớn các dự án cách xa hàng trăm kilomet. Nhà máy năng lượng tái tạo sẽ bán toàn bộ sản lượng phát lên Thị trường điện bán buôn cạnh tranh (VWEM) theo giá thị trường giao ngay (Spot Price). Khách hàng FDI vẫn mua điện vật lý từ Tổng công ty Điện lực địa phương theo biểu giá bán lẻ. Điểm mấu chốt nằm ở chỗ: Hai bên sẽ ký thêm một <strong>Hợp đồng kỳ hạn dạng chênh lệch (Contract for Difference - CfD)</strong> độc lập.</li>
</ul>

<h3>Cơ chế Hợp đồng chênh lệch (CfD): Công cụ tài chính hóa thị trường điện</h3>
<p>Về bản chất tài chính, hợp đồng CfD trong cơ chế DPPA hoạt động như một công cụ phái sinh phòng ngừa rủi ro biến động giá điện (Hedging):</p>

<p>Hai bên sẽ chốt một mức giá thỏa thuận cam kết (Strike Price, ví dụ 1.800 đ/kWh) cho một chu kỳ 10 – 15 năm. Trong từng chu kỳ thanh toán, nếu giá thị trường điện giao ngay (VWEM) cao hơn mức Strike Price, đơn vị phát điện sẽ hoàn trả phần chênh lệch thặng dư đó cho khách hàng FDI. Ngược lại, nếu giá thị trường giao ngay giảm xuống dưới mức Strike Price, khách hàng FDI sẽ bù đắp phần thiếu hụt cho nhà máy điện.</p>

<p>Cơ chế thanh toán bù trừ tài chính này mang lại hai lợi ích sống còn: Thứ nhất, nó bảo đảm dòng tiền ổn định dài hạn giúp chủ đầu tư dự án năng lượng tái tạo dễ dàng tiếp cận nguồn vốn vay ngân hàng (Bankability). Thứ hai, khách hàng FDI được bàn giao toàn bộ <strong>Chứng chỉ thuộc tính môi trường (EAC/I-REC)</strong> tương ứng với sản lượng điện giao dịch, hợp thức hóa 100% hồ sơ kiểm toán xanh cho các tập đoàn mẹ tại Mỹ hay Hàn Quốc.</p>

<h3>Nút thắt kỹ thuật: Bài toán điện nền và chi phí phụ trợ hệ thống</h3>
<p>Mặc dù cánh cửa cơ chế đã mở, việc hiện thực hóa các hợp đồng DPPA quy mô lớn vẫn đang đối mặt với những nút thắt hạ tầng vô cùng phức tạp:</p>

<p><strong>1. Tính bất định của năng lượng tái tạo và rủi ro sụt áp:</strong> Các nhà máy sản xuất bán dẫn đòi hỏi nguồn điện có độ ổn định tuyệt đối — tần số lưới điện bắt buộc phải dao động trong biên độ cực hẹp 50Hz ± 0,2Hz. Một nhịp sụt áp (Voltage Sag) chỉ kéo dài vài mili-giây cũng có thể phá hỏng toàn bộ mẻ đúc chip trị giá hàng chục triệu USD. Năng lượng mặt trời tắt nắng sau 17h, điện gió phụ thuộc mùa gió. Do đó, hệ thống bắt buộc phải có các nguồn điện nền linh hoạt (thủy điện tích năng, pin lưu trữ năng lượng BESS, hoặc điện khí LNG) chạy phụ tải để giữ nhịp tần số.</p>

<p><strong>2. Phí dịch vụ truyền tải và phân phối:</strong> Khi dòng điện xanh truyền tải qua hàng nghìn kilomet đường dây 500kV Bắc - Nam, ai sẽ là bên chi trả các khoản chi phí truyền tải, phí tổn thất điện năng và đặc biệt là chi phí dịch vụ phụ trợ hệ thống để cân bằng công suất phản kháng? Nghị định 80 đã mở đường, nhưng các Thông tư hướng dẫn chi tiết về phương pháp tính toán biểu phí dịch vụ hệ thống của Bộ Công Thương sẽ là biến số quyết định tính hấp dẫn kinh tế thực tế của các hợp đồng CfD.</p>

<h3>Cú hích tái định hình chu kỳ năng lượng và dòng vốn</h3>
<p>Sự vận hành của cơ chế DPPA không chỉ là câu chuyện giải cứu hàng ngàn megawatt điện tái tạo đang mắc kẹt, mà là mắt xích trung tâm định hình lại sức hấp dẫn vĩ mô của Việt Nam trong chu kỳ 2026 – 2030. Năng lượng không còn là một ngành hạ tầng độc lập, mà đã trở thành hàng rào kỹ thuật quyết định quốc gia nào sẽ đón nhận làn sóng công nghệ bán dẫn và trí tuệ nhân tạo tiếp theo.</p>

<p>Giải quyết hài hòa bài toán chia sẻ chi phí hạ tầng lưới điện giữa EVN, doanh nghiệp năng lượng tư nhân và khối FDI tiêu thụ lớn sẽ là phép thử lớn nhất cho năng lực điều hành kinh tế thị trường định hướng phát triển bền vững của Việt Nam trong giai đoạn then chốt này.</p>"""

figures = [
    {"label": "Khung pháp lý mới", "value": "Nghị định 80/2024/NĐ-CP"},
    {"label": "Mô hình giao dịch", "value": "Đường riêng & Lưới QG"},
    {"label": "Tiêu chuẩn FDI", "value": "Cam kết RE100 Net Zero"},
    {"label": "Công cụ tài chính", "value": "Hợp đồng phái sinh CfD"},
    {"label": "Hệ thống vận hành", "value": "Thị trường buôn VWEM"},
    {"label": "Thách thức cốt lõi", "value": "Ổn định điện nền 50Hz"}
]

question_for_crowd = "Theo bạn, cơ chế hợp đồng chênh lệch (CfD) qua lưới điện quốc gia hay đường dây riêng sẽ là lựa chọn khả thi hơn cho các đại bàng công nghệ FDI tại Việt Nam?"

data = {
    "sub": sub,
    "title": title,
    "body": body,
    "loai": loai,
    "figures": figures,
    "question_for_crowd": question_for_crowd,
    "anhs": [
        {
            "data": anh_b64,
            "dinh_dang": "jpeg",
            "ten_tep": "dppa_green_energy_fdi.jpg",
            "alt": "Hạ tầng khu công nghiệp công nghệ cao và nguồn năng lượng tái tạo mua bán trực tiếp dppa"
        }
    ]
}

target_json = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "bai.json"
os.makedirs(target_json.parent, exist_ok=True)
with open(target_json, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ Đã soạn thảo bài thời sự và xuất file thành công vào {target_json}")
print(f"   Độ dài title: {len(title)} ký tự (chuẩn <= 160)")
print(f"   Số figures: {len(figures)} cặp (chuẩn <= 6)")
print(f"   Độ dài question: {len(question_for_crowd)} ký tự (chuẩn <= 200, kết thúc bằng ?)")
