# -*- coding: utf-8 -*-
"""Soạn và xuất bản bài viết Tâm lý giao dịch: Thiên lệch hành động (Action Bias) và cơn ngứa tay của trader lúc 13:45 ngày 02/10/2026."""
import os
import sys
import json
import base64
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

REPO_ROOT = Path(__file__).resolve().parent.parent.parent
sys.path.append(str(REPO_ROOT / "scripts" / "bai-viet"))
from watermark import gan_watermark

# Đường dẫn ảnh gốc sinh từ generate_image
anh_goc = r"C:\Users\Ng Xuan Mui\.gemini\antigravity\brain\d35dd1b4-ddf2-4707-b498-6a0df332e9fa\action_bias_trader_calm_1790923604939.jpg"
anh_wm_path = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "action_bias_trader_calm_wm.jpg"

print("Đang gắn watermark gikky.net vào ảnh...")
gan_watermark(anh_goc, str(anh_wm_path))

with open(anh_wm_path, "rb") as f:
    anh_b64 = base64.b64encode(f.read()).decode("utf-8")

title = "Thiên lệch hành động (Action Bias) và cơn ngứa tay của trader: Khi ngồi yên trên đống tiền mặt là quyết định sinh lời lớn nhất"
sub = "tam-ly-giao-dich"
loai = "Tâm lý"

# TUYỆT ĐỐI KHÔNG DÙNG THẺ <h2> HOẶC <h3> ĐỂ TRÁNH SINH KHỐI MỤC LỤC TRÊN FRONTEND
body = """<p>13 giờ 45 phút chiều. Bảng điện tử giằng co trong một biên độ hẹp đến nghẹt thở. Thị trường bước vào phiên thứ ba liên tiếp sideway với thanh khoản mất hút, những con số màu vàng nhạt nhẽo trôi qua màn hình như một đoạn phim quay chậm. Tài khoản của bạn lúc này đang ở trạng thái 100% tiền mặt sau một vòng chốt lời trọn vẹn tuần trước. Về lý thuyết, bạn đang ở vị thế an toàn tuyệt đối. Nhưng trên thực tế, một sự bứt rứt khó tả bắt đầu nhen nhóm trong lồng ngực.</p>

<p>Bàn tay bạn vô thức click chuột liên tục giữa các tab biểu đồ. Bạn bắt đầu phóng to từ khung nến ngày sang khung 15 phút, rồi 5 phút, cố gắng vẽ thêm vài đường chỉ báo kỹ thuật để tìm kiếm một tín hiệu bất kỳ. Trong đầu bạn vang lên những câu hỏi dồn dập: <em>"Tại sao tiền lại nằm im lãng phí thế này?", "Nhỡ thị trường bất ngờ bùng nổ mà mình không có hàng thì sao?", "Ngồi nhìn suốt cả buổi chiều mà không bấm nổi một lệnh thì có khác gì kẻ bất tài?".</em></p>

{{ANH_1}}

<p>Cơn ngứa tay ấy không phải là sự nhạy bén của một trực giác giao dịch. Nó là biểu hiện trần trụi nhất của một cạm bẫy tâm lý học hành vi đã chôn vùi vô số tài khoản tài chính: <strong>Thiên lệch hành động (Action Bias)</strong>.</p>

<hr>

<p><strong>Nghịch lý từ chấm 11 mét: Vì sao các thủ môn luôn chọn bay người?</strong></p>
<p>Năm 2007, giáo sư tâm lý học hành vi Michael Bar-Eli cùng các cộng sự tại Đại học Ben-Gurion đã công bố một công trình nghiên cứu nổi tiếng khi phân tích chi tiết 286 quả đá phạt đền (penalty) ở các giải bóng đá chuyên nghiệp hàng đầu thế giới. Kết quả thống kê đưa ra một sự thật kinh ngạc:</p>

<p>Về phía cầu thủ sút phạt, có tới <strong>28,7%</strong> số cú sút được đá thẳng vào chính diện giữa khung thành. Tuy nhiên, về phía thủ môn, có tới <strong>93,7%</strong> trường hợp họ chọn bay người hết cỡ sang bên trái hoặc bên phải. Chỉ vỏn vẹn <strong>6,3%</strong> số lần các thủ môn quyết định đứng chôn chân ở chính giữa.</p>

<p>Nghiên cứu chỉ ra rằng: Nếu thủ môn chấp nhận đứng yên ở trung tâm, xác suất cản phá thành công của họ lên tới <strong>33,3%</strong> — cao hơn rất nhiều so với việc bay người sang hai bên. Thế nhưng, tại sao gần như toàn bộ các thủ môn đẳng cấp thế giới lại từ chối đứng yên?</p>

<p>Câu trả lời nằm ở nỗi sợ hãi tâm lý về mặt hành vi. Nếu bay người sang một góc mà bóng bay vào lưới, cả sân vận động sẽ vỗ tay an ủi vì thủ môn đã <em>"nỗ lực hết sức mình"</em>. Nhưng nếu đứng yên như trời trồng mà nhìn quả bóng bay qua, thủ môn sẽ bị hàng triệu khán giả chỉ trích là lười biếng, vô cảm và bất lực. Con người thà hành động để nhận lấy thất bại còn hơn là đứng yên để đạt được xác suất thành công cao nhất.</p>

<hr>

<p><strong>Cơn nghiện bấm lệnh: Khi hành động trở thành chiếc bẫy tự sát</strong></p>
<p>Trên thị trường tài chính, căn bệnh này còn tàn khốc hơn gấp bội. Từ thuở sơ khai, tiến hóa đã cài đặt vào bộ não loài người một niềm tin sắt đá rằng: Muốn có thức ăn thì phải đi săn, muốn có thành quả thì phải lao động cật lực. Khi bước vào trading, tiềm thức của chúng ta tiếp tục đồng nhất <em>"sự nỗ lực"</em> với <em>"tần suất vào lệnh"</em>.</p>

<p>Bạn ngồi trước bàn làm việc 8 tiếng mỗi ngày, cà phê rót đầy ly, mắt dán chặt vào từng bước nhảy thanh khoản. Nếu cả ngày không mở một vị thế nào, bản ngã của bạn cảm thấy tội lỗi. Bạn cảm thấy mình đang lãng phí thời gian và phung phí cơ hội kiếm tiền. Để giải tỏa cảm giác bức bối đó, bạn bắt đầu hạ thấp tiêu chuẩn chọn lọc: một cây nến xanh le lói cũng được coi là breakout, một nhịp rút chân mong manh cũng được huyễn hoặc thành hỗ trợ cứng. Bạn bấm lệnh Mua — không phải vì hệ thống mách bảo, mà đơn giản chỉ để thỏa mãn cơn nghiện được nhìn thấy trạng thái khớp lệnh trên màn hình.</p>

<p>Và bi kịch lập tức ập đến. Trong một thị trường không có xu hướng rõ ràng, những chiếc lệnh ngẫu hứng đó sẽ bị các đợt rung lắc ngẫu nhiên nghiền nát. Bạn bị dính bẫy giá giả (whipsaw), hoảng loạn cắt lỗ -2%, rồi lại ngứa tay mua đuổi mã khác để gỡ gạc, rồi lại cắt lỗ. Thuế, phí giao dịch và những khoản lỗ li ti đó cộng dồn lại theo cấp số nhân, âm thầm bào mòn 15% – 20% NAV danh mục mà bạn thậm chí không nhận ra nguyên nhân.</p>

<p>Đến khi thị trường thực sự xuất hiện một con sóng lớn với những setup hoàn hảo nhất, tài khoản của bạn đã sứt mẻ nghiêm trọng, còn tâm lý và năng lượng thì đã hoàn toàn kiệt quệ sau những trận chiến vô nghĩa.</p>

<hr>

<p><strong>"Sitting Tight": Di sản vĩ đại nhất của Jesse Livermore</strong></p>
<p>Trong cuốn hồi ký kinh điển <em>Reminiscences of a Stock Operator</em>, huyền thoại đầu cơ Jesse Livermore đã để lại một trong những đúc kết đắt giá nhất mọi thời đại:</p>

<p><em>"It was never my thinking that made the big money for me. It was always my sitting. Got that? My sitting tight! It is no trick at all to be right on the market. You always find lots of early bulls in bull markets and early bears in bear markets... Men who can both be right and sit tight are uncommon."</em></p>

<p>Tạm dịch: <em>"Không bao giờ là những suy nghĩ tính toán giúp tôi kiếm được những khoản tiền khổng lồ. Luôn luôn là nhờ việc ngồi yên của tôi. Bạn hiểu không? Ngồi thật yên! Đúng về thị trường chẳng có gì là ghê gớm. Bạn sẽ luôn thấy đầy rẫy những người nhận định đúng chiều tăng trong thị trường bò tót và đúng chiều giảm trong thị trường gấu... Nhưng những người vừa nhận định đúng, vừa có khả năng ngồi yên chờ đợi, mới là những người vô cùng hiếm hoi."</em></p>

<p>Những bậc thầy giao dịch vĩ đại nhất không phải là những cỗ máy bắn lệnh liên thanh. Họ là những tay súng bắn tỉa kiên nhẫn bậc nhất thế giới. Họ có thể nằm im trong bụi rậm nhiều ngày, thậm chí nhiều tuần lễ, quan sát con mồi đi qua mà không hề cử động ngón tay. Họ chỉ bóp cò khi và chỉ khi mục tiêu bước vào đúng hồng tâm với xác suất chiến thắng nghiêng hẳn về phía mình.</p>

<hr>

<p><strong>Tiền mặt là một vị thế chủ động, không phải là sự bất lực</strong></p>
<p>Một trong những bước trưởng thành quan trọng nhất của một nhà đầu tư là nhận ra rằng: <strong>Tiền mặt (Cash) là một vị thế danh mục hoàn chỉnh</strong>, thậm chí là vị thế sinh lời cao nhất trong những giai đoạn thị trường nhiễu loạn.</p>

<p>Khi bạn cầm tiền mặt và ngồi yên:</p>
<ul>
  <li>Bạn có tỷ suất lợi nhuận 0%, nhưng bạn đã vượt trội hơn 80% thị trường đang gồng lỗ và bị cắt xén tài sản mỗi ngày.</li>
  <li>Bạn bảo toàn 100% năng lượng tinh thần, không bị tra tấn bởi những cú nhảy giá thất thường lúc 14 giờ 15 phút.</li>
  <li>Và quan trọng nhất, tiền mặt mang lại cho bạn một <strong>quyền chọn tối thượng (Option Value)</strong>: Quyền được mua những tài sản tuyệt vời nhất với mức giá chiết khấu rẻ mạt khi thị trường rơi vào hoảng loạn tột cùng.</li>
</ul>

<hr>

<p><strong>Luyện tập cơ bắp "ngồi trên tay" (Sitting on hands)</strong></p>
<p>Làm thế nào để thuần hóa thiên lệch hành động và cơn ngứa tay của chính mình? Hãy thử áp dụng 3 quy tắc kỷ luật sau:</p>

<p><strong>1. Đặt ra danh sách kiểm tra (Checklist) khắt khe:</strong> Chỉ mở vị thế khi thỏa mãn tối thiểu 5/5 điều kiện kỹ thuật đã định trước. Nếu thiếu dù chỉ 1 điều kiện, tuyệt đối không động đậy ngón tay.</p>

<p><strong>2. Rời xa bảng điện tử:</strong> Thị trường sideway không cần bạn giám sát từng phút. Hãy đặt cảnh báo giá (Price Alerts) tự động trên phần mềm. Sau đó tắt màn hình, gập máy tính lại, đi tập thể dục, đọc một cuốn sách hoặc dành thời gian cho gia đình. Nếu có biến động lớn, chuông cảnh báo sẽ tự reo.</p>

<p><strong>3. Chấp nhận sự buồn tẻ:</strong> Giao dịch thành công vốn dĩ là một công việc cực kỳ nhàm chán và lặp đi lặp lại. Nếu bạn tìm kiếm cảm giác hưng phấn, kịch tính và adrenaline dâng trào, sòng bạc là nơi phù hợp hơn sàn chứng khoán. Thị trường tài chính chỉ trả tiền hậu hĩnh cho sự kiên định, kỷ luật và khả năng chịu đựng được sự tĩnh lặng mà thôi.</p>"""

figures = [
    {"label": "Nghiên cứu thủ môn", "value": "93.7% chọn bay người"},
    {"label": "Tỷ lệ sút vào giữa", "value": "28.7% quả phạt đền"},
    {"label": "Cản phá nếu đứng yên", "value": "33.3% thành công"},
    {"label": "Tài khoản tiền mặt", "value": "Vị thế phòng thủ"},
    {"label": "Triết lý Livermore", "value": "My sitting tight"},
    {"label": "Bẫy tâm lý hành vi", "value": "Overtrading bào vốn"}
]

question_for_crowd = "Khoảnh khắc nào trong sự nghiệp khiến bạn thấm thía nhất rằng: Quyết định ngồi yên không bấm lệnh chính là quyết định cứu sống cả tài khoản của bạn?"

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
            "ten_tep": "action_bias_trader_calm.jpg",
            "alt": "Không gian làm việc trader điềm tĩnh và bài học về thiên lệch hành động action bias"
        }
    ]
}

target_json = REPO_ROOT / "scripts" / "bai-viet" / ".tam" / "bai.json"
os.makedirs(target_json.parent, exist_ok=True)
with open(target_json, "w", encoding="utf-8") as f:
    json.dump(data, f, ensure_ascii=False, indent=2)

print(f"✅ Đã soạn thảo và xuất file thành công vào {target_json}")
print(f"   Độ dài title: {len(title)} ký tự (chuẩn <= 160)")
print(f"   Số figures: {len(figures)} cặp (chuẩn <= 6)")
print(f"   Độ dài question: {len(question_for_crowd)} ký tự (chuẩn <= 200, kết thúc bằng ?)")
