import json
import base64
import os
import sys

if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

IMAGE_PATH = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\margin_call_force_sell_desk_1790484391591.jpg"
OUTPUT_PATH = r"d:\Projects\gikky-net\scripts\bai-viet\.tam\bai.json"

with open(IMAGE_PATH, "rb") as f:
    img_b64 = base64.b64encode(f.read()).decode("utf-8")

body_html = """<p>{{ANH_1}}</p>
<p>Chẳng có ai bước chân vào thị trường chứng khoán với kế hoạch trở thành <em>"cổ đông dài hạn bất đắc dĩ"</em> trong 3 đến 5 năm cả. Hầu hết mọi thảm kịch cháy tài khoản hay mất trắng thành quả tích lũy nhiều năm đều bắt đầu từ một ý nghĩ tưởng chừng vô hại: <strong>"Chỉ vào lướt sóng kiếm 5–7% tiền cà phê ăn sáng rồi rút."</strong></p>

<p>Nhưng thị trường tài chính luôn có một cách vận hành vô cùng tàn nhẫn để thử thách cái tôi và lòng tham của con người. Câu chuyện có thật về cú trượt dài cùng cổ phiếu quốc dân HPG trong năm 2022 là một tấm gương phản chiếu trần trụi nhất cho chiếc bẫy tâm lý mang tên: <strong>Bình quân giá xuống</strong> — thứ độc dược ngọt ngào đã chôn vùi không biết bao nhiêu gia tài của nhà đầu tư cá nhân.</p>

<h3>1. Khởi đầu tự tin: Cú lướt sóng ngây thơ tại vùng giá 46.500 đ</h3>
<p>Tháng 3 năm 2022, không khí trên khắp các diễn đàn tài chính ngập tràn sự hưng phấn. Chiến sự nổ ra, giá thép cuộn cán nóng (HRC) thế giới thiết lập đỉnh cao mọi thời đại. Tập đoàn Hòa Phát vừa công bố kết quả kinh doanh năm 2021 với mức lợi nhuận sau thuế kỷ lục vô tiền khoáng hậu: <strong>hơn 34.500 tỷ đồng</strong>.</p>

<p>Mở bất kỳ báo cáo phân tích nào của các công ty chứng khoán, người ta cũng thấy ngập tràn những mỹ từ: <em>"Cổ phiếu quốc dân"</em>, <em>"Định giá rẻ không tưởng với P/E chỉ 6 lần, P/B 1.8"</em>, <em>"Cú hích vĩ mô từ đại dự án Dung Quất 2"</em>. Với vị thế doanh nghiệp đầu ngành sở hữu con hào kinh tế vững chắc, ai cũng tin rằng mua HPG thì làm sao mà thua được.</p>

<p>Lệnh Mua đầu tiên được bấm tại vùng giá <strong>46.500 đ</strong> với số vốn 200 triệu đồng. Kế hoạch ban đầu được vạch ra rất rõ ràng trên sổ tay: <em>"Mục tiêu chốt lời 52.000 đ (+12%), nếu thủng ngưỡng hỗ trợ 44.000 đ thì dứt khoát cắt lỗ (-5.3%)."</em> Một kế hoạch chuẩn chỉ, đúng sách giáo khoa.</p>

<h3>2. Vết trượt tâm lý đầu tiên: Khi cái tôi từ chối thừa nhận sai lầm</h3>
<p>Tháng 4 năm 2022, những biến cố pháp lý bất ngờ liên quan đến nhóm FLC và Tân Hoàng Minh giáng một đòn chí mạng vào tâm lý toàn thị trường. Chỉ số VN-Index lao dốc, kéo theo hàng loạt cổ phiếu trụ cột gãy gập. Cổ phiếu HPG xuyên thủng mốc cắt lỗ 44.000 đ trong chớp mắt, rồi trôi thẳng về vùng <strong>39.500 đ</strong>. Khoản lỗ trên tài khoản chạm mốc <strong>-15%</strong> (tương đương âm hơn 30 triệu đồng).</p>

<p>Lúc này, cơ chế phòng vệ sinh học của não bộ — <strong>Ác cảm thua lỗ (Loss Aversion)</strong> — bắt đầu chiếm trọn quyền kiểm soát. Cảm giác bấm nút "Bán" để thừa nhận mình đã sai và chấp nhận mất đi 30 triệu đồng tiền mồ hôi nước mắt mang lại một nỗi đau đớn tâm lý gấp đôi so với niềm vui khi kiếm được số tiền tương tự. Não bộ bắt đầu tìm mọi cách để trốn tránh nỗi đau đó.</p>

<p>Thay vì tuân thủ kỷ luật cắt lỗ, trader bắt đầu rơi vào cái bẫy <strong>Thiên lệch xác nhận (Confirmation Bias)</strong>. Cả ngày lùng sục khắp các hội nhóm mạng xã hội, xem hàng chục video YouTube, chỉ để tìm kiếm những chuyên gia nói rằng: <em>"Hòa Phát là doanh nghiệp sản xuất thật, lò cao Dung Quất chạy rực lửa ngày đêm, tài sản bằng thép bằng bê tông thì sợ gì chỉnh, giảm là cơ hội tích sản ngàn năm có một!"</em></p>

<p>Và rồi, quyết định sai lầm mang tính bước ngoặt xuất hiện: <strong>Cào thêm 200 triệu đồng nạp vào tài khoản để mua bình quân giá tại 39.500 đ</strong>. Giá vốn trung bình được kéo lùi từ 46.500 đ xuống còn khoảng 43.000 đ. Một tiếng thở phào nhẹ nhõm giả tạo vang lên trong tâm trí: <em>"Đấy, chỉ cần giá hồi phục nhẹ về 43.000 đ là mình hòa vốn rút lui an toàn rồi!"</em></p>

<h3>3. Cú sốc ĐHCĐ tháng 5/2022 và cái bẫy Chi phí chìm (Sunk Cost Fallacy)</h3>
<p>Nhưng thị trường tài chính không bao giờ vận hành theo sự thỏa hiệp của ước muốn cá nhân.</p>

<p>Sáng ngày 24/05/2022, tại phiên họp Đại hội đồng cổ đông thường niên, Chủ tịch Trần Đình Long đã thẳng thắn đưa ra lời cảnh báo đi vào lịch sử: <em>"Mọi người hãy đợi kết quả kinh doanh quý 2, quý 3, quý 4 rồi sẽ thấy nó thê thảm thế nào, ngành thép đang ở giai đoạn rất khó khăn..."</em></p>

<p>Lời cảnh báo như một gáo nước lạnh tạt thẳng vào sự kỳ vọng của hàng trăm nghìn cổ đông. Lực bán tháo kích hoạt ồ ạt. Giá HPG rơi tự do thủng mốc 35.000 đ rồi lao về 30.000 đ (sau khi chốt quyền chia cổ tức 30% bằng cổ phiếu vào ngày 20/06, giá điều chỉnh kỹ thuật trôi dạt về vùng 23.000 đ). Khoản lỗ lúc này đã vượt quá <strong>-35%</strong>.</p>

<p>Tâm lý lúc này đã chuyển hóa hoàn toàn từ hy vọng sang <strong>Hiệu ứng Đà điểu (Ostrich Effect)</strong>: Tắt ứng dụng bảng điện tử, không dám nhìn vào tài khoản, giấu nhẹm chuyện thua lỗ với gia đình, tim đập thình thịch mỗi khi thấy thông báo từ công ty chứng khoán. Nhưng nghiêm trọng hơn, <strong>Cái bẫy chi phí chìm (Sunk Cost Fallacy)</strong> khiến trader bị trói chặt: Vì đã lỡ bỏ vào đây 400 triệu đồng và bao nhiêu đêm mất ngủ, ý nghĩ cắt lỗ lúc này chẳng khác nào tự sát cảm xúc. Càng lỗ nặng, người ta lại càng có xu hướng liều lĩnh vay mượn thêm để nhồi lệnh, đánh cược toàn bộ vận mệnh vào một cú hồi phục thần kỳ.</p>

<h3>4. Tin nhắn Call Margin lúc 14:15 và đáy bùn 12.100 đ</h3>
<p>Tháng 10 và tháng 11 năm 2022 trở thành cơn ác mộng đen tối nhất của thị trường chứng khoán Việt Nam trong cả thập kỷ. Biến cố SCB và Vạn Thịnh Phát bùng nổ kéo theo cuộc khủng hoảng niềm tin và thanh khoản trái phiếu. Cùng thời điểm, Hòa Phát công bố báo cáo tài chính quý 3/2022 với mức <strong>lỗ ròng lịch sử kỷ lục 1.785 tỷ đồng</strong>.</p>

<p>Hiệu ứng tuyết lở giải chấp chéo (Cross Force Sell) quét sạch mọi phòng tuyến hỗ trợ kỹ thuật. Cổ phiếu HPG rơi không phanh từ 20.000 đ, xuyên thủng 15.000 đ, nhiều phiên dư bán sàn hàng chục triệu đơn vị mà không hề có lực cầu đỡ giá.</p>

<p>Đúng 14:15 ngày 15/11/2022, chiếc điện thoại trên bàn làm việc rung lên liên hồi. Tin nhắn SMS từ công ty chứng khoán lạnh lùng thông báo: <strong>Tỷ lệ an toàn tài khoản (Rtt) đã rơi xuống dưới ngưỡng giải chấp 0.80, hệ thống tự động kích hoạt lệnh MP bán cưỡng bức (Force Sell) toàn bộ danh mục</strong> tại mức giá sàn: <strong>12.100 đ</strong>.</p>

<p>Toàn bộ tài sản bị quét sạch. Từ số vốn 400 triệu đồng tích lũy sau nhiều năm đi làm, sau cú ép bán giải chấp, số dư tài khoản chỉ còn lại vỏn vẹn vài chục triệu đồng tiền lẻ. Nỗi đau thể xác và tinh thần tê dại hoàn toàn.</p>

<p>Thế nhưng, sự trớ trêu cay đắng nhất của cuộc chơi xác suất nằm ở chỗ: <strong>Đúng ngày 15/11/2022, khi những nhà đầu tư cá nhân kiệt quệ bị bán giải chấp sạch sẽ ở mức giá 12.100 đ, thị trường tạo đáy lịch sử</strong>. Dòng tiền ngoại ồ ạt nhập cuộc mua ròng hàng nghìn tỷ đồng, kéo HPG tăng trần liên tiếp và bật tăng một mạch hơn 80% lên vùng 21.000 – 22.000 đ chỉ sau vài tháng. Bạn bị hất cẳng khỏi cuộc chơi trong đau đớn cùng cực ngay trước ngưỡng cửa bình minh.</p>

<hr>

<h3>Chiêm nghiệm: 3 bài học xương máu đổi bằng cả gia tài</h3>

<p>Khi bình tâm ngồi lại nhìn vào đống tro tàn của tài khoản, những bài học quản trị rủi ro không còn là những dòng lý thuyết sáo rỗng trong sách vở, mà là những vết thương khắc sâu vào tư duy giao dịch:</p>

<ul>
  <li><strong>1. Đừng bao giờ biến một vị thế lướt sóng ngắn hạn thành một khoản đầu tư dài hạn bất đắc dĩ:</strong> Nếu bạn mua vì tín hiệu kỹ thuật dòng tiền T+, hãy dứt khoát bước ra vì tín hiệu kỹ thuật gãy cản. Việc mang những luận điểm cơ bản (doanh nghiệp tốt, định giá rẻ, lò cao hiện đại) ra để ngụy biện cho một vị thế đang thua lỗ thực chất chỉ là hành vi trốn tránh sự thật rằng kế hoạch ban đầu của bạn đã hoàn toàn phá sản.</li>
  <li><strong>2. Bình quân giá xuống là hành động tiếp tay cho thần chết:</strong> Trong một xu hướng giảm (Downtrend), mọi mức giá mà bạn cho là "rẻ" đều có thể trở thành mức giá "đắt" chỉ sau một vài tuần. Khi bạn nhồi thêm tiền vào một vị thế đang lỗ, bạn đang làm một việc phi logic nhất trần đời: <em>Thưởng thêm vốn cho một quyết định sai lầm</em>. Quy tắc sống còn của các bậc thầy đầu cơ luôn là: <strong>Chỉ bình quân giá lên khi vị thế đang có lãi, tuyệt đối không bao giờ bình quân giá xuống khi vị thế đang thua lỗ!</strong></li>
  <li><strong>3. Cắt lỗ không phải là thất bại, mà là chi phí bảo hiểm để mua sự sống còn:</strong> Mất 1R (5% hay 7% tài khoản) giống như việc bạn phải nộp một khoản phí bảo hiểm kinh doanh nhỏ để đổi lấy sự tồn tại của 93% nguồn vốn còn lại. Chừng nào bạn còn tiền và giữ được cái đầu tỉnh táo, thị trường sẽ luôn hào phóng trao cho bạn những cơ hội mới. Nhưng một khi bạn để tài khoản bốc hơi 50% đến 70%, bạn sẽ cần một mức lợi nhuận từ 100% đến 200% vốn chỉ để trở về điểm xuất phát — một kỳ tích toán học mà hầu hết người chơi đều gục ngã trước khi chạm tới.</li>
</ul>"""

data = {
    "sub": "tam-ly-giao-dich",
    "title": "[Nhật ký sau bàn phím] Chiếc bẫy bình quân giá HPG: Từ cú lướt sóng T+ đến tin nhắn Call Margin lúc 14:15",
    "body": body_html,
    "loai": "Tâm lý",
    "figures": [
        {"label": "Điểm mua ban đầu", "value": "46.500 đ (Lướt T+)"},
        {"label": "Bình quân lần 1", "value": "39.500 đ (Kéo giá)"},
        {"label": "ĐHCĐ Hòa Phát", "value": "24/05/2022 (Bác Long)"},
        {"label": "Đáy lịch sử", "value": "12.100 đ (15/11/2022)"},
        {"label": "Bẫy tâm lý", "value": "Chi phí chìm & Neo giá"},
        {"label": "Bài học sống còn", "value": "Cắt lỗ trước khi mua"}
    ],
    "question_for_crowd": "Bạn đã bao giờ rơi vào cái bẫy biến một khoản lướt sóng ngắn hạn thành \"khoản đầu tư dài hạn bất đắc dĩ\" và nạp thêm tiền gồng lỗ cho đến khi bị Call Margin chưa?",
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
