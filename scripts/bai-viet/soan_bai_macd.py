import json
import base64
import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

IMAGE_PATH = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\macd_momentum_workspace_1790664510949.jpg"
OUTPUT_PATH = r"d:\Projects\gikky-net\scripts\bai-viet\.tam\bai.json"

with open(IMAGE_PATH, "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode("utf-8")

body_html = """<p>{{ANH_1}}</p>
<p>Trong kho tàng công cụ phân tích kỹ thuật, hiếm có chỉ báo nào quen thuộc và bị lạm dụng nhiều như <strong>MACD (Moving Average Convergence Divergence)</strong>. Hầu như bất kỳ ai khi chập chững bước chân vào thị trường tài chính cũng từng được truyền tai một công thức đơn giản đến mức ngây thơ: <em>"Hễ thấy đường MACD cắt lên đường Tín hiệu (Signal) thì vội vã MUA, hễ cắt xuống thì lập tức BÁN."</em></p>

<p>Nhưng nếu giao dịch thành công chỉ đơn giản là việc bấm nút theo hai đường cong giao cắt nhau trên màn hình, thì có lẽ toàn bộ các quỹ đầu tư định lượng trên phố Wall đã bị thay thế bởi vài dòng code tự động từ thập niên 1980. Thực tế cay đắng là phần lớn các nhà giao dịch mới áp dụng máy móc quy tắc này đều nhanh chóng nếm trải chuỗi thua lỗ triền miên. Họ đổ lỗi cho chỉ báo "chậm chạp", "lỗi thời", mà không hiểu rằng bản thân đang sử dụng một thước đo gia tốc như một chiếc la bàn định hướng.</p>

<p>Được phát triển bởi nhà quản lý quỹ <strong>Gerald Appel</strong> vào năm 1979 và sau đó được hoàn thiện với phát minh <strong>Histogram</strong> của Thomas Aspray vào năm 1986, MACD thực chất là một tuyệt tác toán học về động lượng và quán tính giá. Để biến nó thành một lợi thế xác suất thay vì một chiếc bẫy bào mòn tài khoản, nhà đầu tư buộc phải soi chiếu tường tận cấu trúc vận hành bên dưới những đường nét biểu đồ.</p>

<h3>Cấu trúc ba tầng: Không gian hình học của động lượng</h3>
<p>Sức mạnh của MACD bắt nguồn từ việc nó kết hợp đồng thời hai yếu tố cốt lõi của thị trường: <strong>Xu hướng (Trend)</strong> và <strong>Động lượng (Momentum)</strong> thông qua ba thành phần chặt chẽ:</p>

<ul>
  <li><strong>Đường MACD (MACD Line):</strong> Được tính bằng hiệu số giữa hai đường trung bình động hàm mũ: <code>EMA(12) - EMA(26)</code>. Bản chất của đường MACD là đo lường độ giãn nở khoảng cách giữa dòng tiền ngắn hạn (12 phiên) và dòng tiền trung hạn (26 phiên). Khi giá bứt phá mạnh mẽ, EMA 12 sẽ phản ứng nhanh hơn và tách xa khỏi EMA 26, đẩy đường MACD dốc đứng lên trên.</li>
  <li><strong>Đường Tín hiệu (Signal Line):</strong> Chính là đường <code>EMA(9)</code> của chính đường MACD. Đóng vai trò như một bộ giảm xóc, đường Signal lọc bớt các dao động giật cục ngẫu nhiên của thị trường, tạo ra một mức chuẩn trung bình để so sánh tốc độ biến thiên.</li>
  <li><strong>Đồ thị tần số (MACD Histogram):</strong> Sáng kiến của Thomas Aspray năm 1986 đã thay đổi hoàn toàn cách nhìn nhận chỉ báo. Histogram không phải là một thành phần thứ ba độc lập, mà là hiệu số: <code>MACD Line - Signal Line</code>. Nếu đường MACD đo vận tốc, thì Histogram chính là <strong>Gia tốc (Acceleration)</strong> — nó cho biết khoảng cách giữa hai đường đang nới rộng ra hay co hẹp lại với tốc độ nhanh đến mức nào.</li>
</ul>

<h3>Đường số 0 (Zero Line): Lãnh thổ sống còn giữa Phe Bò và Phe Gấu</h3>
<p>Một trong những sai lầm phổ biến nhất của nhà đầu tư là xem mọi điểm giao cắt giữa MACD và Signal đều có giá trị tương đương nhau. Trên thực tế, <strong>Đường số 0 (Zero Line)</strong> chính là đường biên giới sinh tử phân định quyền kiểm soát thị trường:</p>

<p>Khi đường MACD nằm phía trên đường số 0, điều đó đồng nghĩa với việc <code>EMA(12) > EMA(26)</code>. Phe mua đang nắm giữ vị thế áp đảo trên khung thời gian trung hạn. Trong vùng lãnh thổ này, các điểm giao cắt vàng (Golden Cross) là tín hiệu thuận xu hướng cực kỳ mạnh mẽ, bởi vì động lượng ngắn hạn đang đồng pha với xu hướng chủ đạo.</p>

<p>Ngược lại, khi đường MACD chìm sâu dưới đường số 0, thị trường đang thuộc quyền kiểm soát hoàn toàn của phe bán (<code>EMA(12) < EMA(26)</code>). Một cú giao cắt hướng lên tại đây thực chất chỉ phản ánh một nhịp hồi kỹ thuật yếu ớt trong một xu hướng giảm lớn. Mua vào ở vùng này chẳng khác nào hành động đứng đón đầu một đoàn tàu hỏa đang lao dốc chỉ vì thấy tiếng còi tàu có vẻ nhỏ đi đôi chút.</p>

<h3>Chiếc bẫy Whipsaw trong thị trường đi ngang (Sideway)</h3>
<p>Bất kỳ một hệ thống nào xây dựng trên nền tảng trung bình động (Moving Average) đều mang trong mình một điểm yếu chí tử: <strong>Độ trễ thời gian</strong> và <strong>Sự bất lực trong vùng giá tích lũy đi ngang</strong>.</p>

<p>Khi thị trường rơi vào trạng thái không xu hướng (Range-bound market), giá liên tục dao động qua lại trong một biên độ hẹp. Lúc này, EMA 12 và EMA 26 xoắn chặt lấy nhau quanh đường số 0. Hậu quả là đường MACD và Signal sẽ liên tục cắt qua cắt lại tạo ra hàng loạt tín hiệu mua bán giả mạo (Whipsaw). Nếu máy móc thực thi lệnh theo từng điểm giao cắt, tài khoản của bạn sẽ bị "rỉ máu" bởi hàng chục khoản lỗ nhỏ liên tiếp cùng chi phí giao dịch dày đặc.</p>

<p>Một nhà giao dịch chuyên nghiệp không bao giờ nhìn vào điểm giao cắt trong vùng đi ngang để vào lệnh. Thay vào đó, họ kiên nhẫn chờ đợi thị trường bứt phá (Breakout) khỏi vùng tích lũy, xác lập một xu hướng rõ ràng trước khi tìm kiếm sự xác nhận của động lượng.</p>

<h3>Nghệ thuật đọc sớm sự suy kiệt qua Histogram Divergence</h3>
<p>Phần thưởng giá trị nhất mà Gerald Appel và Thomas Aspray để lại cho giới giao dịch không nằm ở các điểm giao cắt muộn màng, mà nằm ở <strong>Hiện tượng phân kỳ của Histogram</strong>.</p>

<p>Hãy hình dung một chiếc xe đang leo dốc với tốc độ 80 km/h. Trước khi chiếc xe dừng lại và tụt dốc, tài xế bắt buộc phải nhả chân ga và đạp phanh. Chiếc xe có thể vẫn tiếp tục trôi lên phía trước thêm một đoạn quán tính, nhưng gia tốc của nó đã chuyển sang âm từ trước đó. Histogram chính là thiết bị đo chân ga của thị trường.</p>

<p>Khi giá cổ phiếu tiếp tục rướn lên tạo đỉnh cao mới (Higher High), nhưng các cột nến trên đồ thị Histogram lại tạo các đỉnh thấp dần (Lower High), thị trường đang gửi đi một tín hiệu cảnh báo đanh thép: <strong>Lực đẩy của dòng tiền đang suy kiệt nghiêm trọng</strong>. Khoảng cách giữa EMA 12 và EMA 26 không còn nới rộng được nữa dù giá vẫn cố tăng. Hiện tượng này thường xuất hiện trước cú giao cắt của hai đường từ 3 đến 5 nến, mang lại cho trader sự chuẩn bị chủ động để chốt lời từng phần hoặc thắt chặt lệnh dừng lỗ bảo vệ thành quả.</p>

<h3>Tích hợp vào hệ thống Quản trị rủi ro thực chiến</h3>
<p>Để chỉ báo MACD thực sự phục vụ cho sự sống còn của tài khoản, hãy tuân thủ nguyên tắc tam giác phối hợp sau:</p>

<ol>
  <li><strong>Không bao giờ dùng MACD làm lý do duy nhất để vào lệnh:</strong> MACD là một bộ lọc bối cảnh (Context Filter), không phải là công tắc kích hoạt (Trigger). Điểm vào lệnh chuẩn xác phải xuất phát từ cấu trúc giá (Price Action), vùng thanh khoản hoặc ngưỡng hỗ trợ/kháng cự quan trọng.</li>
  <li><strong>Nguyên tắc thuận xu hướng đường 0:</strong> Chỉ ưu tiên tìm kiếm lệnh MUA khi MACD nằm trên đường 0 (hoặc tối thiểu Histogram đã đổi màu xanh dương hướng lên từ đáy sâu). Tuyệt đối không bắt đáy mù quáng khi hai đường chỉ báo đang cắm đầu rơi tự do ở vùng âm.</li>
  <li><strong>Bảo vệ rủi ro bất đối xứng (Asymmetric R:R):</strong> Đặt Stop Loss cố định dựa trên biến động thực tế của nến tín hiệu (tối đa 1R tài khoản). Tín hiệu phân kỳ MACD chỉ có giá trị khi nó cung cấp cho bạn một tỷ lệ lợi nhuận trên rủi ro tối thiểu từ 1:2.5 trở lên. Khi sai, dứt khoát cắt lỗ, coi đó là chi phí kinh doanh bắt buộc để chờ đợi những chu kỳ động lượng bùng nổ tiếp theo.</li>
</ol>"""

data = {
    "sub": "quan-tri-von",
    "title": "Chỉ báo MACD: Giải mã cấu trúc động lượng, ảo tưởng giao cắt và nghệ thuật đọc sớm sự suy kiệt qua Histogram",
    "body": body_html,
    "loai": "Phương pháp",
    "figures": [
        {"label": "Phát minh gốc", "value": "Gerald Appel (1979)"},
        {"label": "Công thức MACD", "value": "EMA(12) - EMA(26)"},
        {"label": "Đường Tín hiệu", "value": "EMA(9) của MACD"},
        {"label": "MACD Histogram", "value": "Thomas Aspray (1986)"},
        {"label": "Vùng ranh giới", "value": "Đường số 0 (Zero Line)"}
    ],
    "question_for_crowd": "Khi giao dịch với MACD, bạn thường ưu tiên tín hiệu giao cắt Signal thuận xu hướng, sự vượt ngưỡng đường số 0 hay sự phân kỳ động lượng của Histogram?",
    "anhs": [
        {
            "data": img_b64
        }
    ]
}

os.makedirs(os.path.dirname(OUTPUT_PATH), exist_ok=True)
with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ Đã soạn bài và xuất file thành công vào {OUTPUT_PATH}")
print(f"   Dung lượng file: {os.path.getsize(OUTPUT_PATH):,} bytes")
