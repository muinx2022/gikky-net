# -*- coding: utf-8 -*-
import sys
import re
from pathlib import Path

# Thêm đường dẫn scripts vào sys.path
sys.path.insert(0, r"d:\Projects\gikky-net\scripts")
from gikky_api_client import GikkyClient

BANNED_WORDS = [
    "giải mã",
    "con hào",
    "cỗ máy",
    "bóc tách",
    "giải phẫu",
    "chiếc bẫy",
    "cái bẫy",
]

IMG_URL = "/media/anh/2026/11/09/2427f40404e040ce837840e1ea1ea698.jpg"

BODY_HTML = f"""<p><img src="{IMG_URL}" alt="Nghệ thuật ủ rượu vang đất nung Qvevri của Gruzia suốt 8.000 năm" /></p>

<p>Nếu có dịp ghé thăm thung lũng Alazani vùng Kakheti miền đông Gruzia vào một chiều chớm đông, điều khiến lữ khách phương xa ngỡ ngàng không phải là rặng núi Kavkaz phủ tuyết trắng xóa ở chân trời, mà là sự tĩnh lặng thuần khiết bao trùm lên các làng quê cổ kính. Nơi đây được coi là cái nôi đầu tiên của văn minh rượu vang nhân loại. Bước chân vào một Marani – hầm rượu gia đình truyền thống của người Gruzia, bạn sẽ không nhìn thấy những hàng thùng gỗ sồi bóng loáng từ phương Tây, cũng chẳng có những bồn thép không gỉ sáng choang trang bị cảm biến tự động. Thứ duy nhất chào đón bạn là nền đất nện mộc mạc và những miệng vò tròn bằng đất nung ngang bằng mặt sàn, đậy kín bằng phiến đá phẳng và phủ lên một lớp cát ẩm giữ nhiệt.</p>

<p>Đó chính là Qvevri (hay Kvevri) – chiếc vò đất nung khổng lồ hình búp măng đã đồng hành cùng văn hóa và sinh kế người Gruzia suốt hơn tám thiên niên kỷ. Khảo cổ học tại di chỉ Shulaveri-Shomu từng phát hiện những mảnh gốm Qvevri có niên đại từ 6.000 năm trước Công nguyên, lưu giữ dấu vết hóa thạch của hạt nho thuần hóa và hợp chất acid tartaric cổ xưa. Suốt tám nghìn năm qua bao thăng trầm của các đế chế Ba Tư, La Mã, Mông Cổ rồi Ottoman tràn qua mảnh đất này, phương thức làm vang Qvevri vẫn vẹn nguyên như thuở ban sơ: nho sau khi ép được trút trọn vẹn cả nước, vỏ, hạt và cuống vào lòng chum đất, đậy nắp lại, chôn sâu hoàn toàn dưới lòng đất và để mặc cho thời gian cùng tự nhiên làm trọn phần việc kỳ diệu của mình.</p>

<hr>

<p><strong>Tử cung bằng đất sét của Đất Mẹ: Sự kỳ diệu của vi khí hậu lòng đất</strong></p>

<p>Chiếc chum Qvevri trong văn hóa Gruzia không đơn thuần là vật chứa đựng, mà được xem như tử cung bằng đất sét của Đất Mẹ, nơi ấp ủ sự sống mới. Người Gruzia từ xa xưa đã thấu hiểu quy luật tự nhiên mang tính quyết định: trên mặt đất, thời tiết luôn biến động khốc liệt giữa cái nắng 40°C của mùa hè và băng tuyết âm độ của mùa đông Kavkaz. Thế nhưng, khi đi sâu xuống lòng đất từ hai đến ba mét, nhiệt độ lại duy trì sự ổn định diệu kỳ quanh mốc 12°C đến 14°C quanh năm.</p>

<p>Lớp đất dày bao bọc quanh thân vò đóng vai trò như một tấm đệm nhiệt tự nhiên hoàn hảo, giúp quá trình lên men diễn ra từ tốn, khoan thai nhất. Người làm vang tuyệt đối không bổ sung men công nghiệp hay phụ gia hóa học. Quá trình biến đổi đường thành cồn được dẫn dắt hoàn toàn bởi các chủng men hoang dại (wild yeasts) cư ngụ tự nhiên trên lớp phấn trắng bọc quanh vỏ quả nho. Nếu nhiệt độ môi trường biến động đột ngột, các chủng men này sẽ bị sốc nhiệt, sinh ra phản ứng phụ làm rượu bị chua gắt hoặc nồng mùi lưu huỳnh. Sự tĩnh tại của lòng đất sâu giúp các tế bào men làm việc an hòa, tuần tự chuyển hóa từng phân tử đường và giải phóng những tầng hương thơm tinh tế nhất.</p>

<p>Bản thân chất liệu đất sét nung của Qvevri cũng là một kỳ quan vật liệu. Đất nung có cấu trúc xốp với hàng triệu vi lỗ li ti. Trước khi ủ, người thợ quét một lớp sáp ong rừng mỏng vào lòng vò. Lớp sáp ong đóng vai trò màng bán thấm tinh xảo: ngăn chất lỏng thấm thất thoát ra ngoài đất, nhưng vẫn cho phép một lượng oxy siêu vi lượng (micro-oxygenation) thẩm thấu vào trong. Lượng oxy vi mô này tiếp xúc chậm rãi với dịch nho, làm mềm vị chát thô ráp của tannin, kích hoạt các phản ứng chuyển hóa sâu lắng để tạo nên thứ rượu vang màu vàng hổ phách (Amber Wine) sóng sánh, thoảng hương mơ sấy, mật ong rừng và thảo mộc khô.</p>

<hr>

<p><strong>Hình học của sự buông bỏ: Khi trọng lực tự tay gạn đục khơi trong</strong></p>

<p>Nét tinh hoa độc đáo của Qvevri nằm ở hình dáng bên ngoài: một khối hình trứng thuôn dài với phần đáy vuốt nhọn tựa chóp nón lộn ngược. Đây là sự thấu thị sâu sắc về động học chất lỏng và trọng lực Trái Đất. Trong vài tuần đầu lên men, khí carbon dioxide đẩy khối bã nho – gồm vỏ, hạt và cuống, gọi là <em>chacha</em> – nổi lên mặt nước, tạo thành lớp màng che chở tự nhiên ngăn vi khuẩn có hại xâm nhập.</p>

<p>Khi quá trình lên men chính khép lại và bọt khí ngừng sủi, chiếc nắp đá được niêm phong kín lại bằng đất sét ẩm. Dưới lực hút của Trái Đất, khối bã nho và xác men bắt đầu lắng dần xuống đáy. Nhờ phần đáy được vuốt nhọn thành hình nón hẹp, toàn bộ lượng cặn bã dày đặc, hạt nho và xác men phân rã bị nén chặt vào một không gian có diện tích tiếp xúc vô cùng nhỏ ở phần chóp nhọn sâu nhất.</p>

<p>Sự thu hẹp diện tích tiếp xúc này mang ý nghĩa sống còn. Hạt nho chứa nhiều hợp chất đắng và tannin dầu thô; nếu diện tích tiếp xúc quá rộng, rượu sẽ bị nhiễm vị đắng chát khó chịu. Đáy nhọn của Qvevri đã giam giữ phần cặn bã này ở vùng đáy hẹp, cách ly chúng khỏi phần dịch rượu trong trẻo bên trên. Trong khi đó, phần vỏ nho vẫn nhẹ nhàng giải phóng dưỡng chất và sắc tố cuối cùng vào dịch rượu. Rượu tự lọc trong suốt qua từng tháng ngày mà không cần bất kỳ màng lọc cơ học hay hóa chất làm trong nào can thiệp. Đó là sự thuần khiết tuyệt đối mà con người chỉ có thể đón nhận khi biết buông tay và để cho các quy luật tự nhiên tự vận hành.</p>

<hr>

<p><strong>Cơn sốt can thiệp của thời đại và ảo tưởng về quyền lực kiểm soát</strong></p>

<p>Rời khỏi không gian tĩnh lặng của hầm rượu Marani để nhìn vào đời sống tài chính hiện đại, ta thấy một trạng thái đối lập hoàn toàn: nỗi ám ảnh triền miên về sự can thiệp tức thì. Trên các sàn giao dịch, dường như mọi cơ chế đều được thiết kế để kích động sự nôn nóng của con người. Những bảng điện tử chớp nháy từng giây với sắc xanh đỏ nhảy múa, dòng tin tức dồn dập xuất hiện trên màn hình điện thoại suốt ngày đêm, và những trào lưu đầu cơ liên tục cổ súy cho việc bắt nhịp từng con sóng ngắn ngủi trong phiên.</p>

<p>Nhiều nhà đầu tư bước vào thị trường với tâm lý của người làm rượu vội vã. Họ muốn thu hoạch quả ngọt ngay sau vài ngày giải ngân. Mua cổ phiếu vào sáng thứ Hai, đến chiều thứ Năm họ đã bồn chồn mở ứng dụng ra theo dõi biến động từng bước giá, tự hỏi liệu mình có nên bán tháo để nhảy sang một mã khác đang tăng nóng. Họ giống như người làm vang thiếu kiên nhẫn cứ vài ngày lại mở nắp chum Qvevri ngó nghiêng, khuấy đảo mẻ rượu, nếm thử một ngụm rồi lo âu đổ thêm hóa chất tạo màu hoặc chất ổn định nhân tạo. Mỗi lần chiếc nắp đá bị hé mở ấy, không khí tràn vào sẽ làm xáo trộn toàn bộ hệ vi sinh mỏng manh đang tự cân bằng, biến những mầm hương thơm quý giá thành giấm chua hỏng hóc.</p>

<p>Trong quản trị danh mục, sự can thiệp thái quá này chính là nguyên nhân hàng đầu bào mòn nguồn lực của nhà đầu tư. Đó không chỉ là chi phí từ thuế, phí giao dịch hay hiện tượng trượt giá, mà nguy hại hơn là sự bào mòn tâm lý và việc tự tay tước đi cơ hội sinh sôi của những khoản đầu tư tốt đẹp nhất. Những biến động giá ngắn hạn trên bảng điện tử chỉ là lớp bọt sóng lăn tăn trên bề mặt đại dương; chúng hiếm khi phản ánh đúng sức khỏe thực sự của một doanh nghiệp trong một vài tuần hay một vài tháng.</p>

<p>Thực tế cho thấy, những điều sâu sắc và bền vững nhất luôn vận hành theo một nhịp điệu tĩnh lặng vượt xa tầm mắt của sự nôn nóng thường nhật. Hãy nhớ về bài học vô giá từ <a href="/m/thi-nghiem-giot-hac-in-pitch-drop-va-bai-hoc-ve-su-kien-nhan-xuyen-the-ky-1453">thí nghiệm giọt hắc ín Pitch Drop và bài học về sự kiên nhễn xuyên thế kỷ</a> tại Đại học Queensland. Một khối hắc ín nhìn bề ngoài tưởng như tảng đá hoa cương rắn rỏi bất động, nhưng thực chất vẫn đang kiên trì chảy từng phân tử với độ nhớt gấp hàng trăm tỷ lần nước, và phải mất gần một thế kỷ người ta mới chứng kiến từng giọt nhỏ buông rơi. Dòng chảy của giá trị kinh tế và các chu kỳ tăng trưởng của doanh nghiệp cũng vậy: chúng không đo đếm bằng tiếng ồn của từng phiên khớp lệnh, mà chuyển dịch âm thầm theo sự bồi đắp không ngừng nghỉ của năng lực cốt lõi.</p>

<p>Sự vững chãi để đi qua những cơn giông bão của thị trường cũng từng được tiền nhân đúc kết một cách phi thường trong <a href="/m/kien-truc-chua-nam-tang-horyu-ji-va-bai-hoc-ve-cau-truc-chong-soc-dia-chan-1465">kiến trúc chùa năm tầng Horyu-ji và bài học về cấu trúc chống sốc địa chấn</a> tại Nhật Bản. Ngôi chùa gỗ đứng vững suốt hơn mười bốn thế kỷ giữa vành đai động đất khắc nghiệt nhờ vào sự tách rời linh hoạt: cột trụ tâm Shinbashira bằng gỗ bách khổng lồ được treo lơ lửng độc lập ở trung tâm, đóng vai trò như một con lắc đối trọng tự nhiên hấp thụ toàn bộ xung lực rung lắc từ lòng đất mà không truyền ứng suất phá hủy lên các tầng mái xung quanh. Trong cấu trúc quản trị vốn, những tài sản nền tảng được định hình vững chắc và gìn giữ cẩn trọng chính là cột trụ tâm ấy, giúp tâm thế nhà đầu tư giữ được sự bình thản trước những cơn cuồng phong của tâm lý đám đông.</p>

<p>Và sức mạnh che chở của lòng đất sâu đối với chiếc chum Qvevri cũng tương đồng với sức sống bền bỉ của <a href="/m/rung-cay-pando-va-bo-re-ngam-10000-nam-1342">rừng cây Pando và bộ rễ ngầm 10.000 năm</a> tại vùng cao nguyên Utah. Hàng vạn thân cây dương trên mặt đất có thể già cỗi, úa tàn hay thậm chí bị thiêu rụi hoàn toàn sau một cơn cháy rừng dữ dội, nhưng sinh mệnh của thực thể sống khổng lồ ấy chưa từng bị dập tắt. Bởi vì bên dưới lớp tro tàn, hệ thống rễ ngầm duy nhất vẫn đan cài bền chặt trong lòng đất sâu, âm thầm tích lũy dưỡng chất qua hàng thiên niên kỷ để sẵn sàng phóng lên những chồi non kiêu hãnh khi mùa xuân mới thức giấc.</p>

<hr>

<p><strong>Nghệ thuật ủ vốn: Sự khắt khe ở điểm khởi đầu và lòng kiên định khi buông tay</strong></p>

<p>Triết lý "chôn sâu dưới lòng đất" của người làm vang Gruzia hoàn toàn không đồng nghĩa với thái độ thờ ơ hay sự phó mặc số phận cho may rủi. Việc mua bừa một tài sản kém chất lượng rồi tự huyễn hoặc bản thân bằng khẩu hiệu "nắm giữ dài hạn" chỉ là một hành vi trốn tránh trách nhiệm. Trước khi một chiếc vò Qvevri được chôn xuống đất và đậy nắp đá, người thợ Gruzia đã phải trải qua một hành trình chuẩn bị vô cùng gian nan và cẩn trọng.</p>

<p>Họ phải tìm kiếm những mỏ đất sét tinh sạch nhất dọc các triền sông, tự tay nhào nặn từng thớ đất thành từng vòng tròn đồng tâm xếp chồng lên nhau suốt nhiều tháng ròng. Chiếc vò được nung bằng lửa củi rừng cháy đỏ liên tục suốt nhiều ngày đêm, được gõ thử từng góc cạnh để lắng nghe âm vang trong trẻo nhằm đảm bảo không có vết nứt ngầm nào. Những quả nho được hái về phải trải qua quá trình tuyển lựa nghiêm ngặt bằng tay, loại bỏ từng quả dập thối để giữ lại những chùm nho chín mọng hoàn hảo nhất, giữ vẹn nguyên lớp phấn men tự nhiên của đất trời. Mọi sự chuẩn bị đều hướng tới mục tiêu tối thượng: đảm bảo nội lực bên trong chiếc vò đạt đến độ hoàn mỹ và thuần khiết nhất có thể.</p>

<p>Đó chính là hình ảnh ẩn dụ tuyệt đẹp cho giai đoạn nghiên cứu, thẩm định và lựa chọn doanh nghiệp trong quản trị vốn. Một nhà đầu tư khôn ngoan luôn dành phần lớn thời gian và tâm sức của mình trước khi ra quyết định giải ngân: tìm hiểu cặn kẽ mô hình kinh doanh, đánh giá năng lực cạnh tranh bền vững, kiểm tra độ lành mạnh của bảng cân đối kế toán và quan trọng hơn cả là đánh giá sự liêm chính của ban lãnh đạo. Khi dòng vốn được trao gửi vào một doanh nghiệp sở hữu nội lực tự thân mạnh mẽ, có khả năng tự tạo ra dòng tiền dương đều đặn và không bị đe dọa bởi đòn bẩy nợ nần, đó chính là lúc bạn đã đặt mẻ nho tinh tuyển nhất vào chiếc vò đất nung hoàn hảo.</p>

<p>Nhưng khi mẻ rượu đã được đổ đầy và chiếc nắp đá được trát kín bằng đất sét, phẩm chất tối thượng quyết định sự thành bại của người làm vang không còn là kỹ thuật can thiệp nữa, mà là năng lực kiềm chế sự nôn nóng của chính mình. Họ biết rằng việc khuấy đảo mẻ rượu lúc này chỉ đem lại sự hỗn loạn. Nhiệm vụ duy nhất của họ lúc này là lùi lại một bước, trao sự ủy thác trọn vẹn cho nhiệt độ ổn định của lòng đất và để thời gian phát huy sức mạnh chuyển hóa kỳ diệu của nó.</p>

<p>Trong quản trị vốn cũng vậy, sau khi đã lựa chọn được những doanh nghiệp kiệt xuất, điều khó khăn nhất đối với một nhà đầu tư không phải là tìm kiếm thêm thông tin mỗi ngày, mà là học cách ngồi yên. Hãy trao cho doanh nghiệp một khoảng không gian đủ rộng và một chu kỳ thời gian đủ dài – ba năm, năm năm hoặc mười năm – để họ xây dựng nhà máy mới, mở rộng thị phần, vượt qua các giai đoạn khó khăn của nền kinh tế và để sức mạnh của lãi kép tự bồi đắp giá trị. Rượu ủ trong vò Qvevri sau sáu tháng có thể còn đục ngầu và nồng gắt, nhưng sau vài năm lắng mình dưới lòng đất sâu, mọi tạp chất đều tự động chìm lắng, chỉ còn lại thứ rượu vàng hổ phách trong veo, thơm ngát và nồng nàn vị ngọt hậu của sự trưởng thành.</p>

<hr>

<p><strong>Lời kết: Khoảng lặng dưới đáy sâu và phần thưởng của thời gian</strong></p>

<p>Khi màn đêm buông xuống thung lũng Kakheti, ngọn lửa ấm áp bập bùng trong gian bếp của căn nhà cổ. Người làm vang Gruzia mở chiếc nắp đá của một vò Qvevri đã được ủ ròng rã suốt bốn mùa đông dưới lòng đất, cẩn thận dùng chiếc gáo gỗ dài múc lên một vại rượu vàng óng ánh. Rót vào ly thủy tinh mộc mạc, thứ chất lỏng màu hổ phách ấy tỏa ra hương thơm nồng nàn của mật ong rừng, quả mơ khô, hạt dẻ nướng và thoảng chút hơi thở của đất ẩm sau cơn mưa đầu mùa. Nhấp một ngụm nhỏ, vị chát mượt mà lan tỏa nơi đầu lưỡi rồi đọng lại một hậu vị ngọt ngào, sâu lắng và thanh khiết vô ngần. Đó là món quà tuyệt mỹ mà đất mẹ, tổ tiên và dòng chảy thời gian ban tặng cho những tâm hồn biết kiên nhẫn đợi chờ.</p>

<p>Cuộc đời của một con người hay hành trình quản trị một danh mục đầu tư suy cho cùng cũng giống như một mẻ rượu ủ trong vò đất nung. Những thứ ồn ào, phô trương và mau chóng đạt đỉnh trên bề mặt thường là những thứ dễ dàng tan biến nhất khi mùa đông giá rét tràn về. Ngược lại, những giá trị đích thực luôn đòi hỏi một khoảng lặng sâu thẳm dưới lòng đất, nơi chúng được che chở khỏi những xáo động phù phiếm của ngoại cảnh và được tôi luyện bởi sự âm thầm của thời gian.</p>

<p>Học cách lắng mình dưới lòng đất sâu như chiếc chum Qvevri cổ xưa của người Gruzia chính là đỉnh cao của sự thấu hiểu quy luật tự nhiên. Bạn không cần phải mở nắp ra nhìn ngắm hay khoe khoang với thế giới mỗi ngày. Chỉ cần bên trong bạn đã chọn đúng những hạt giống giá trị tinh túy nhất, thì sâu trong lòng đất tĩnh lặng, thời gian sẽ âm thầm làm phần việc vĩ đại của nó: biến những giọt chát thô ráp ban đầu thành dòng chảy thịnh vượng bền vững cho mai sau.</p>
"""

# Lưu ý: kiểm tra lỗi gõ phím 'kiên nhễn' -> 'kiên nhẫn'
BODY_HTML = BODY_HTML.replace("kiên nhễn", "kiên nhẫn")

def dem_tu(text):
    clean_text = re.sub(r"<[^>]+>", " ", text)
    words = clean_text.split()
    return len(words), words

def kiem_tra_tu_cam(text):
    clean_text = re.sub(r"<[^>]+>", " ", text).lower()
    found = []
    for bw in BANNED_WORDS:
        if bw in clean_text:
            found.append(bw)
    return found

def kiem_tra_the_h2_h3(text):
    h2_found = re.findall(r"<h[23][^>]*>", text, re.IGNORECASE)
    return h2_found

def main():
    word_count, words = dem_tu(BODY_HTML)
    sys.stdout.reconfigure(encoding='utf-8')
    print(f"Tổng số từ: {word_count} từ")
    
    banned = kiem_tra_tu_cam(BODY_HTML)
    print(f"Từ cấm phát hiện: {banned}")
    
    h2_h3 = kiem_tra_the_h2_h3(BODY_HTML)
    print(f"Thẻ h2/h3 phát hiện: {h2_h3}")

    target_blank = re.findall(r'target=["\']_blank["\']', BODY_HTML, re.IGNORECASE)
    print(f"Thẻ target=_blank phát hiện: {target_blank}")

    print(f"Kiểm tra dải từ [1700, 2300]: {1700 <= word_count <= 2300}")

if __name__ == "__main__":
    main()
