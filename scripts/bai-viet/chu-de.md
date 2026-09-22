# Kho chủ đề cho bài phân tích / tản mạn

Danh sách gợi ý, **không phải hàng đợi cứng**. Mỗi lượt chạy chọn một chủ đề **chưa có bài
trên gikky**.

⚠ **QUY TẮC BẮT BUỘC VỀ KIỂM TRÙNG:**
Trước khi chọn chủ đề và viết bài, **bắt buộc phải chạy script kiểm trùng toàn bộ database**:
```bash
python scripts/bai-viet/kiem-trung.py "<từ khóa chính>"
```
Nếu script báo phát hiện bài trùng (exit code 1), lập tức dừng lại và đổi chủ đề khác!

Chủ đề đã viết thì **không xoá** — đánh dấu `[ĐÃ VIẾT - Mạch <id>]` để lượt sau biết mà tránh.

## Cột `sub` — bài đi vào chuyên mục nào

| Chủ đề nói về | `sub` |
|---|---|
| Một mã / một ngành cụ thể trên sàn Việt Nam | `chung-khoan` |
| Chính sách, lãi suất, tỷ giá, thuế quan, dòng vốn, hàng hoá toàn cầu | `vi-mo` |
| Bitcoin, altcoin, sàn, on-chain, stablecoin | `crypto` |
| Ngoại hối, FX, Forex, các cặp tiền tệ, DXY | `ngoai-hoi` |
| Tâm lý, kỷ luật, cỡ lệnh, sách | `quan-tri-von` |

Phân vân giữa `chung-khoan` và `vi-mo`: hỏi *bài này nói về **doanh nghiệp** hay về **môi
trường** doanh nghiệp sống trong đó?* Doanh nghiệp ⇒ `chung-khoan`.

---

## A. Thuế quan và thương mại

- **[ĐÃ VIẾT - Mạch 1004]** Thuế chống bán phá giá của Mỹ với **cá tra** Việt Nam — lịch sử các kỳ POR, doanh nghiệp nào chịu thuế suất nào, và phần doanh thu Mỹ trong cơ cấu của họ. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1055]** **Tôm** và cấu trúc thị trường xuất khẩu: Mỹ, Nhật, EU — ai mua gì, biên nào.
- **[ĐÃ VIẾT - Mạch 1110, 1036]** **Dệt may và da giày**: đơn hàng theo mùa, và vì sao biên lợi nhuận mỏng đến vậy.
- **[ĐÃ VIẾT - Mạch 1073]** **Gỗ và nội thất**: điều tra lẩn tránh thuế, quy tắc xuất xứ.
- **[ĐÃ VIẾT - Mạch 1014]** **Thép**: thuế quan hai chiều — Mỹ, EU đánh vào, và thép giá rẻ nhập vào Việt Nam.
- Đồng tiền yếu giúp xuất khẩu tới đâu, và **nó lấy lại của ai**.

## B. Năng lượng & Hạ tầng

- **[ĐÃ VIẾT - Mạch 1019]** **Điện gió, điện mặt trời** sau các cơ chế giá: dự án dở dang, và ai đang cầm nợ.
- **[ĐÃ VIẾT - Mạch 1052]** **Điện khí LNG**: chi phí đầu vào nhập khẩu, và giá bán bị neo.
- **[ĐÃ VIẾT - Mạch 1046, 1011]** **Thuỷ điện** và chu kỳ El Niño / La Niña — mảng hiếm hoi mà thời tiết đọc thẳng vào lợi nhuận.
- **[ĐÃ VIẾT - Mạch 1068]** **PVN và họ dầu khí**: doanh thu bám giá Brent tới mức nào, và độ trễ bao lâu.
- **[ĐÃ VIẾT - Mạch 1094]** Giá điện bán lẻ: một biến số mà **mọi ngành sản xuất** đều chịu, ít ai mô hình hoá.
- **[ĐÃ VIẾT - Mạch 1124]** **Đầu tư công chạy nước rút cuối năm**: Áp lực giải ngân 700.000 tỷ, nút thắt vật liệu đắp nền và biên lãi mỏng của nhà thầu.
- **Thủy điện tích năng** (Pumped Storage) và hệ thống lưu trữ pin BESS: giải pháp giải cứu điểm nghẽn năng lượng tái tạo.
- **Quy hoạch Điện VIII** và nút thắt đường dây truyền tải 500kV mạch 3: bài toán giải tỏa công suất vùng duyên hải miền Trung.

## C. Ngân hàng & Tài chính hệ thống

- **[ĐÃ VIẾT - Mạch 1087]** **NIM** co lại: vì sao lãi suất huy động giảm mà biên vẫn mỏng.
- **Nợ xấu và trích lập**: đọc thuyết minh thay vì đọc con số tiêu đề.
- **Tín dụng bất động sản** — tỷ trọng thật trong danh mục các ngân hàng.
- **[ĐÃ VIẾT - Mạch 1106]** **Trái phiếu doanh nghiệp**: ai đang cầm, và đáo hạn dồn vào lúc nào.
- **[ĐÃ VIẾT - Mạch 1047]** **CASA** — vì sao chỉ số này quyết định ngân hàng nào sống khoẻ khi lãi suất đổi chiều.
- **Basel III và bộ đệm vốn**: điều kiện ngầm cho tăng trưởng tín dụng.

## D. Vàng, dầu, hàng hoá

- **[ĐÃ VIẾT - Mạch 1128]** Chênh lệch **giá vàng trong nước và thế giới** — cơ chế nào tạo ra nó, và nó nói gì.
- **[ĐÃ VIẾT - Mạch 1084]** Vàng và **lãi suất thực**: mối quan hệ thường được nhắc, hiếm khi được đo.
- **[ĐÃ VIẾT - Mạch 1079]** **Dầu**: OPEC+, tồn kho Mỹ, và vì sao giá xăng trong nước lệch pha với Brent.
- **[ĐÃ VIẾT - Mạch 1064]** Ngân hàng trung ương mua vàng — xu hướng nhiều năm, không phải tin một ngày.
- **[ĐÃ VIẾT - Mạch 1051]** **Đồng** như một chỉ báo công nghiệp: nó thật sự dẫn trước cái gì?

## E. Tiền số & Tài sản số

- **[ĐÃ VIẾT - Mạch 1038]** **Bitcoin sau các kỳ halving**: dữ liệu nói gì, và mẫu quá nhỏ tới đâu.
- **[ĐÃ VIẾT - Mạch 1053, 1016]** **Stablecoin**: dự trữ đứng sau, và rủi ro mà người dùng Việt Nam ít nhìn.
- **[ĐÃ VIẾT - Mạch 1100]** **ETF giao ngay** đổi cấu trúc người mua như thế nào.
- **[ĐÃ VIẾT - Mạch 1126]** **Cơ chế thanh lý nợ xấu trong DeFi**: Khi các đợt Margin Call tự động kích hoạt phản ứng dây chuyền trên chuỗi.
- Khung pháp lý tài sản số ở Việt Nam — trạng thái hiện tại, không suy đoán.
- Phí giao dịch và trượt giá: phần chi phí thật mà bảng giá không hiện.

## F. Chip, AI, RAM — và đường nó chạm vào các ngành

Nhóm này là **tản mạn**: dài hơi, liên ngành, không bám một mã.

- **[ĐÃ VIẾT - Mạch 1048, 1012]** **RAM và chu kỳ bộ nhớ**: vì sao đây là ngành có chu kỳ tàn bạo nhất trong bán dẫn, và nó báo trước điều gì cho điện tử tiêu dùng.
- **[ĐÃ VIẾT - Mạch 1063]** **Trung tâm dữ liệu ăn điện**: một cơn sốt phần mềm biến thành bài toán **hạ tầng điện** ra sao.
- **[ĐÃ VIẾT - Mạch 1071]** **Đóng gói và kiểm định** — mắt xích Việt Nam thật sự đứng, thay vì mắt xích ai cũng nói.
- **[ĐÃ VIẾT - Mạch 1076]** **HBM**: vì sao một loại bộ nhớ hẹp lại thành nút thắt của cả một làn sóng.
- Nhân lực kỹ thuật: khoảng cách giữa **tuyên bố** và **năng lực đào tạo**.
- **Điện toán biên** và thiết bị: mảng nào của chuỗi cung ứng Việt Nam hưởng lợi thật.
- **[ĐÃ VIẾT - Mạch 1131]** **AI làm giảm chi phí gì trong doanh nghiệp Việt** — và những rào cản vô hình nó không thể chạm tới.
- **[ĐÃ VIẾT - Mạch 1092]** Chu kỳ vốn đầu tư của các hãng lớn: khi họ chi mạnh, tiền chảy qua những khâu nào.
- **[ĐÃ VIẾT - Mạch 1125]** **Nước siêu tinh khiết (UPW)**: Cơn khát của ngành bán dẫn và điểm nghẽn tài nguyên tự nhiên đằng sau những con chip AI.

## G. Thị trường Việt Nam, chuyện dài

- **[ĐÃ VIẾT - Mạch 1081, 1033]** **Nâng hạng thị trường**: điều kiện kỹ thuật, và dòng vốn thụ động thực tế bao nhiêu.
- **[ĐÃ VIẾT - Mạch 1130]** **Phiên hiệu lực FTSE**: Khi VN-Index lùi về dưới 1.800 điểm và bài học "bán sự thật" của dòng tiền tổ chức.
- **Thanh khoản theo nhóm nhà đầu tư**: cá nhân, tổ chức, khối ngoại — ai thật sự đỡ giá.
- **Hệ thống giao dịch mới**: nó đổi được gì và không đổi được gì.
- **[ĐÃ VIẾT - Mạch 1108, 1021]** **Cổ tức tiền mặt** — nhóm doanh nghiệp trả đều, và vì sao ít người quan tâm.
- **[ĐÃ VIẾT - Mạch 1067]** Vòng đời một **doanh nghiệp niêm yết Việt Nam**: IPO, pha loãng, rồi im lặng.
- **[ĐÃ VIẾT - Mạch 1122]** **Cuộc chiến bán lẻ dược phẩm**: Long Châu vs An Khang vs Pharmacity và bài toán kinh tế học đơn vị.

## H. Tâm lý và kỷ luật — nhịp 3–5 ngày một bài

`sub` = `quan-tri-von` · `loai` = **`Tâm lý`** (hoặc **`Đọc sách`** nếu bài đi từ một cuốn sách).

- **[ĐÃ VIẾT - Mạch 1088, 1030]** **Thiên lệch xác nhận** khi đã cầm hàng: cơ chế, và vì sao đọc thêm tin lại làm nó nặng hơn.
- **[ĐÃ VIẾT - Mạch 1105, 1029]** **Ác cảm thua lỗ**: vì sao cắt lỗ khó hơn chốt lời, dù cùng một số tiền.
- **[ĐÃ VIẾT - Mạch 1080, 1028]** **Hiệu ứng mỏ neo** vào giá mua: con số đó không có ý nghĩa gì với thị trường, nhưng có với người cầm.
- **[ĐÃ VIẾT - Mạch 1024]** **Ảo tưởng kiểm soát**: giao dịch nhiều hơn không làm kết quả tốt hơn — bằng chứng từ dữ liệu tài khoản.
- **[ĐÃ VIẾT - Mạch 1069]** **Ngụy biện chi phí chìm** trong một vị thế đang lỗ.
- **Kể chuyện sau sự việc**: não dựng nhân quả cho một chuỗi ngẫu nhiên, và vì sao điều đó nguy hiểm.
- **[ĐÃ VIẾT - Mạch 1123]** **Quá tự tin sau một chuỗi thắng** — chuỗi thắng dài bao nhiêu thì vẫn có thể là may.
- **Đám đông và điểm đảo chiều**: khi nào thông tin từ số đông có giá trị, khi nào không.
- **Nhật ký giao dịch**: thứ gì đáng ghi, thứ gì ghi vào chỉ để tự an ủi.
- **Cỡ lệnh** như một quyết định tâm lý chứ không phải quyết định toán học.
- **[ĐÃ VIẾT - Mạch 1104]** **Nghỉ giao dịch**: chi phí của việc không làm gì, và vì sao nó khó chịu đựng.
- **Đọc sách**: *Thinking, Fast and Slow* · *Fooled by Randomness* · *The Psychology of Money* · *Misbehaving*.

## I. Phương pháp giao dịch — nhịp 5–7 ngày một bài

`sub` = `quan-tri-von` · `loai` = **`Phương pháp`**.

- **[ĐÃ VIẾT - Mạch 1026]** **Trend following kiểu Donchian**: luật gốc, và các giai đoạn nó thua kéo dài nhiều năm.
- **[ĐÃ VIẾT - Mạch 1031]** **Turtle Traders**: thí nghiệm của Richard Dennis — cái được kiểm chứng và cái chỉ là giai thoại.
- **[ĐÃ VIẾT - Mạch 1032]** **Trung bình động cắt nhau**: vì sao nó phổ biến, và nó giả định gì về thị trường.
- **[ĐÃ VIẾT - Mạch 1113]** **Mean reversion** so với **momentum**: hai họ phương pháp đối nghịch, cùng tồn tại được vì sao.
- **Breakout** và vấn đề tín hiệu giả: chi phí của việc sai nhiều lần liên tiếp.
- **[ĐÃ VIẾT - Mạch 1129]** **Phân bổ theo biến động** (volatility targeting): ý tưởng gốc từ đâu.
- **[ĐÃ VIẾT - Mạch 1112, 1074]** **Kelly criterion** và vì sao gần như không ai dùng nguyên bản.
- **[ĐÃ VIẾT - Mạch 1095]** **Backtest**: overfitting, look-ahead bias, survivorship bias — ba cách một đường cong đẹp ra đời.
- **Chi phí giao dịch** ăn vào phương pháp tần suất cao như thế nào.
- **Walk-forward analysis**: kiểm một phương pháp mà không tự lừa mình.
- **[ĐÃ VIẾT - Mạch 1085]** **Phương pháp thất bại**: LTCM, và các hệ thống từng được ca ngợi rồi biến mất.
- **[ĐÃ VIẾT - Mạch 1109]** **Barings Bank**: Nick Leeson và tài khoản giấu lỗ 88888.

## J. Hồ sơ nhân vật & Huyền thoại đầu cơ lịch sử

`sub` = `quan-tri-von` hoặc `tam-ly-giao-dich` · `loai` = **`Hồ sơ`** hoặc **`Nhân vật`**.

- **[ĐÃ VIẾT - Mạch 1132]** **Archegos Capital & Bill Hwang**: Vụ sụp đổ 2021 làm bốc hơi 30 tỷ USD trong 48 giờ — đòn bẩy ngầm Total Return Swap (TRS), bẫy đa ngân hàng và thế tiến thoái lưỡng nan của tù nhân (Prisoner's Dilemma) trên phố Wall.
- **[ĐÃ VIẾT - Mạch 1089]** **Jesse Livermore**: "Con gấu vĩ đại phố Wall" — từ cậu bé ghi bảng bucket shop đến tài sản 100 triệu USD năm 1929, hệ thống điểm xoay (Pivotal Points), 4 lần phá sản làm lại từ đầu và hồi kết bi kịch khi phá vỡ kỷ luật.
- **[ĐÃ VIẾT - Mạch 1121]** **Nicolas Darvas**: Vũ công kiếm 2.000.000 USD từ chứng khoán — phát minh lý thuyết Hộp (Darvas Box), cách quản trị lệnh dời stop-loss tự động và nghệ thuật cách ly hoàn toàn với tiếng ồn phố Wall.
- **Ed Seykota**: Người tiên phong mang máy tính vào phân tích kỹ thuật — hệ thống theo xu hướng thuần túy và triết lý tâm lý học sâu sắc: "Dù thắng hay thua, ai cũng nhận được từ thị trường chính xác thứ họ muốn".
- **Paul Tudor Jones**: Huyền thoại bán khống Black Monday 1987 nhân ba tài khoản — nguyên tắc phòng thủ rủi ro bất đối xứng 5:1 và đường MA 200 ngày bảo vệ vốn.
- **Bernard Baruch**: Nhà đầu cơ vượt qua Đại suy thoái 1929 — nghệ thuật biết điểm dừng, tín hiệu cậu bé đánh giày và nguyên tắc "không bao giờ cố mua ở đáy và bán ở đỉnh".
- **Hetty Green**: "Phù thủy phố Wall" — người phụ nữ giàu nhất thời kỳ Gilded Age với triết lý đầu tư giá trị cực đoan, kỷ luật tiền mặt tàn nhẫn và khả năng giải cứu thị trường trong khủng hoảng.
- **Jim Simons & Quỹ Medallion**: Bậc thầy toán học mở ra kỷ nguyên định lượng (Quant trading) — bóc tách các bất thường vi mô thống kê và cuộc cách mạng loại bỏ cảm xúc con người khỏi giao dịch.

## K. Bóc tách Cổ phiếu & Cấu trúc Doanh nghiệp cụ thể

`sub` = `chung-khoan` · `loai` = **`Phân tích`** (hoặc **`Ngành`** nếu lồng ghép chuỗi giá trị).

### ⚠ Quy tắc nhịp độ (Pacing) bất di bất dịch:
- **KHÔNG VIẾT 2 MÃ CỔ PHIẾU LIÊN TIẾP:** Tuyệt đối không đăng 2 bài bóc tách mã cổ phiếu trong 2 ngày/lượt liên tiếp.
- **Giãn cách 3–5 ngày:** Phân tích cổ phiếu chỉ là gia vị bổ trợ (chiếm ~20% số lượng bài phân tích 10:15). Sau khi đã viết 1 bài về một mã, bắt buộc phải nghỉ ít nhất 3 đến 5 ngày (chuyển sang phân tích vĩ mô, chuỗi giá trị, cơ cấu ngành) rồi mới đến mã tiếp theo.
- **Không vội vàng:** Giữ nhịp độ điềm tĩnh, thong thả, tập trung vào chiều sâu học thuật thay vì chạy theo sự kiện giá cổ phiếu hàng ngày.

### Nguyên tắc nội dung:
1. **KHÔNG HÔ HÀO / BƠM THỔI:** Tuyệt đối không dùng từ ngữ cảm tính, giật gân ("siêu cổ phiếu", "múc", "xúc", "sóng thần", "kỳ lân"). Giữ giọng văn giải phẫu tài chính lạnh lùng, trung lập, thuần túy mổ xẻ dữ liệu và sự thật vận hành.
2. **KHÔNG KHUYẾN NGHỊ MUA / BÁN:** Không đưa ra giá mục tiêu (Target Price), không khuyến nghị hành động mua/bán/nắm giữ, không phím điểm cắt lỗ/chốt lời. Mọi nhận định kết luận phải để người đọc tự quyết định.
3. **MỔ XẺ HAI MẶT (Luận điểm & Thách thức):** Bắt buộc phải có phần bóc tách rủi ro tiềm ẩn, góc khuất bảng cân đối, điểm nghẽn chu kỳ hoặc rủi ro quản trị.
4. **TRỤ CỘT NỘI DUNG:**
   - **Mô hình kinh doanh & Con hào kinh tế (Moat):** Doanh nghiệp kiếm tiền từ đâu, lợi thế chi phí thấp / độc quyền tự nhiên / hiệu ứng mạng lưới / tài sản vô hình.
   - **Cơ cấu doanh thu & biên lợi nhuận:** Bóc tách từng mảng kinh doanh, xu hướng biên lãi gộp và biên lãi ròng.
   - **Chất lượng tài sản & dòng tiền:** Dòng tiền hoạt động kinh doanh (CFO) so với lợi nhuận ròng, dòng tiền tự do (FCF), áp lực nợ vay, chi phí lãi vay và vòng quay vốn lưu động.
   - **Định giá trong bối cảnh lịch sử:** P/E, P/B, EV/EBITDA hiện tại đặt cạnh chu kỳ trung bình 5–10 năm của chính doanh nghiệp và các giai đoạn biến động tương đương trong quá khứ.

### Kho doanh nghiệp / cổ phiếu phân tích điển hình:
- **HPG (Hòa Phát):** Con hào chi phí thấp từ quy mô lò cao BOF khép kín, bài toán đại dự án Dung Quất 2 thâm nhập mảng thép HRC chất lượng cao và chu kỳ giá than/quặng toàn cầu.
- **FPT:** Cơ cấu doanh thu chuyển đổi số thị trường Nhật/Mỹ, biên lợi nhuận gia công phần mềm so với mảng viễn thông & giáo dục, rủi ro tự động hóa/AI.
- **MWG (Thế Giới Di Động):** Điểm hòa vốn và cơ cấu chi phí chuỗi Bách Hóa Xanh, rủi ro bão hòa thị trường ICT (Điện Máy Xanh/TGDD) và bài toán quản trị tồn kho.
- **VHM (Vinhomes):** Cỗ máy bán buôn dự án đại đô thị, cơ cấu tiền mặt, rủi ro bảo lãnh nợ trong hệ sinh thái Vingroup và bài toán hấp thụ của thị trường BĐS.
- **VCB (Vietcombank):** Bộ đệm vốn, tỷ lệ bao phủ nợ xấu (LLR) vượt trội, nguồn vốn CASA chi phí 0% từ khối doanh nghiệp FDI và giới hạn của tăng trưởng tín dụng.
- **TCB (Techcombank):** Mô hình hệ sinh thái bất động sản - ngân hàng - chứng khoán, sự phụ thuộc vào dòng vốn trái phiếu/tín dụng doanh nghiệp và bài toán đa dạng hóa danh mục.
- **VNM (Vinamilk):** Cỗ máy in tiền mặt với tỷ lệ cổ tức cao, nhưng đối mặt với bài toán bão hòa ngành sữa Việt Nam và nỗ lực tìm kiếm động lực tăng trưởng mới.
- **[ĐÃ VIẾT - Mạch 1134]** **DGC (Hóa chất Đức Giang):** Lợi thế nguồn quặng Apatit giá rẻ, vị thế độc quyền photpho vàng (P4) trong chuỗi bán dẫn thế giới và rủi ro từ quy định bảo vệ môi trường / tiến độ dự án Nghi Sơn.
- **GMD (Gemadept):** Cảng nước sâu Gemalink, vị thế đón đầu tàu mẹ siêu trọng tải và cơ cấu chi phí tài chính sau khi thoái vốn cảng Nam Hải Đình Vũ.
- **REE (Cơ điện Lạnh):** Danh mục tài sản điện - nước - văn phòng cho thuê (dòng tiền phòng thủ), năng lực M&A hạ tầng và bài toán kế thừa quản trị.
- **PNJ (Vàng bạc Đá quý Phú Nhuận):** Sự dịch chuyển từ vàng miếng sang trang sức bán lẻ, năng lực quản trị chuỗi cung ứng và công nghệ chế tác trước sức mua suy yếu.
- **CTR (Viettel Construction):** Hệ sinh thái hạ tầng viễn thông TowerCo, cơ hội từ làn sóng 5G và bài toán mở rộng sang mảng xây dựng dân dụng.
- **MSN (Masan Group):** Chiến lược "Point of Life", gánh nặng chi phí lãi vay từ các thương vụ M&A đòn bẩy cao và bài toán tối ưu hóa chuỗi WinCommerce.
- **PVS (Dịch vụ Kỹ thuật Dầu khí):** Sự chuyển dịch từ nhà thầu dầu khí truyền thống sang xây lắp điện gió ngoài khơi quốc tế, khối lượng backlog hợp đồng và biên lợi nhuận các dự án EPCI.


