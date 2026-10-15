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

⚠ **QUY TẮC BẮT BUỘC VỀ VĂN PHONG & TRÁNH SÁO NGỮ RẬP KHUÔN:**
Khi đặt tiêu đề và triển khai nội dung, **tuyệt đối hạn chế lạm dụng các từ ngữ rập khuôn**:
- **Hạn chế chữ "Giải mã":** Tránh đặt tiêu đề "Giải mã...". Đặt tiêu đề tự nhiên, trực diện (thay bằng: *Làm rõ, Cắt nghĩa, Đi vào bản chất, Tìm hiểu ngọn ngành, Đằng sau, Vì sao, Nhìn vào...* hoặc nêu thẳng tên chủ đề).
- **Hạn chế chữ "Con hào" / "Con hào kinh tế":** Tránh lặp lại thô cứng chữ "con hào" (thay bằng: *Lợi thế quy mô, Lợi thế chi phí thấp, Rào cản gia nhập ngành, Sức mạnh định giá, Vị thế thị trường, Điểm tựa chiến lược...*).
- **Hạn chế các sáo ngữ khác:** *"Cỗ máy"*, *"Bóc tách"*, *"Giải phẫu"*, *"Chiếc bẫy"*.
- **Internal Links:** Luôn dùng đường dẫn tương đối `/m/<slug>-<id>` và **tuyệt đối không dùng `target="_blank"`** để mở bài viết cùng tab.

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
- **[ĐÃ VIẾT - Mạch 1151]** Đồng tiền yếu giúp xuất khẩu tới đâu, và **nó lấy lại của ai**.
- **[ĐÃ VIẾT - Mạch 1257]** **Thuế tối thiểu toàn cầu 15% (Pillar 2 - OECD)** và bài toán giữ chân đại bàng FDI: Khi ưu đãi thuế không còn là lợi thế cạnh tranh của Việt Nam (Nghị quyết 107/2023/QH15, cơ chế QDMTT và IIR, 122 tập đoàn đa quốc gia, 14.600 tỷ đồng thuế bổ sung, chuyển dịch từ ưu đãi thuế sang Quỹ hỗ trợ đầu tư dựa trên chi phí R&D, điện sạch RE100 và chuỗi cung ứng). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1265]** **Cơ chế điều chỉnh biên giới carbon (CBAM) của EU**: Khi phát thải trở thành thuế quan mới và cuộc sát hạch sinh tử của ngành thép, nhôm Việt Nam (Hết giai đoạn chuyển tiếp 2023-2025, áp thuế chính thức từ 01/01/2026 cho 6 ngành, giá hạn ngạch EU ETS 65-85 EUR/tấn CO2, so sánh phát thải lò cao BOF 1.8-2.2 tấn CO2 vs lò điện EAF 0.4-0.6 tấn CO2, áp lực thuế phát thải 70-110 USD/tấn thép xuất khẩu sang EU kim ngạch >2,5 tỷ USD, cơ chế DPPA điện sạch và lộ trình thị trường tín chỉ carbon nội địa NĐ 06/2022). `vi-mo`
- **Hiệp định EVFTA sau 5 năm thực thi và lộ trình xóa bỏ 99% dòng thuế**: Quy tắc xuất xứ "từ vải trở đi" (Fabric-forward) của ngành dệt may, chứng nhận EUR.1, hạn ngạch thuế quan gạo thơm 80.000 tấn/năm và áp lực tiêu chuẩn bền vững ESG từ thị trường châu Âu. `vi-mo`
- **Điều tra chống lẩn tránh thuế thương mại (Anti-circumvention) của Bộ Thương mại Mỹ (DOC)**: Ranh giới giữa "chuyển đổi cơ bản" (Substantial Transformation) và lắp ráp đơn giản, bài học từ tấm pin năng lượng mặt trời, tủ gỗ, thép cán nguội và yêu cầu truy xuất nguồn gốc nguyên liệu đầu vào. `vi-mo`
- **Khu thương mại tự do (Free Trade Zone - FTZ) tại Đà Nẵng và Bà Rịa - Vũng Tàu**: Cơ chế hải quan biệt lập, miễn thuế nhập khẩu nguyên liệu tái xuất, dịch vụ tài chính hậu cần tại chỗ và bài học thu hút dòng vốn FDI công nghệ cao từ mô hình Thượng Hải, Jebel Ali và Singapore. `vi-mo`
- **Chi phí Logistics chiếm 16–17% GDP Việt Nam và bài toán vận tải đa phương thức**: Sự lệch pha khi 75% hàng hóa phụ thuộc vào đường bộ chi phí cao, điểm nghẽn kết nối đường sắt vào cảng biển và tiềm năng vận tải thủy nội địa vùng Đồng bằng sông Cửu Long. `vi-mo`
- **Thương mại điện tử xuyên biên giới và sự trỗi dậy của các tổng kho ngoại quan tại biên giới**: Áp lực cạnh tranh trực diện từ hàng giá rẻ vận chuyển thẳng tới tay người tiêu dùng trong 3–5 ngày, chính sách bỏ miễn thuế VAT hàng giá trị nhỏ dưới 1 triệu đồng và bài toán bảo vệ sản xuất nội địa. `vi-mo`

## B. Năng lượng & Hạ tầng

- **[ĐÃ VIẾT - Mạch 1019]** **Điện gió, điện mặt trời** sau các cơ chế giá: dự án dở dang, và ai đang cầm nợ.
- **[ĐÃ VIẾT - Mạch 1052]** **Điện khí LNG**: chi phí đầu vào nhập khẩu, và giá bán bị neo.
- **[ĐÃ VIẾT - Mạch 1046, 1011]** **Thuỷ điện** và chu kỳ El Niño / La Niña — mảng hiếm hoi mà thời tiết đọc thẳng vào lợi nhuận.
- **[ĐÃ VIẾT - Mạch 1068]** **PVN và họ dầu khí**: doanh thu bám giá Brent tới mức nào, và độ trễ bao lâu.
- **[ĐÃ VIẾT - Mạch 1094]** Giá điện bán lẻ: một biến số mà **mọi ngành sản xuất** đều chịu, ít ai mô hình hoá.
- **[ĐÃ VIẾT - Mạch 1124]** **Đầu tư công chạy nước rút cuối năm**: Áp lực giải ngân 700.000 tỷ, nút thắt vật liệu đắp nền và biên lãi mỏng của nhà thầu.
- **[ĐÃ VIẾT - Mạch 1138]** **Thủy điện tích năng** (Pumped Storage) và hệ thống lưu trữ pin BESS: giải pháp giải cứu điểm nghẽn năng lượng tái tạo.
- **[ĐÃ VIẾT - Mạch 1146]** **Quy hoạch Điện VIII** và nút thắt đường dây truyền tải 500kV mạch 3: bài toán giải tỏa công suất vùng duyên hải miền Trung. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1171]** **Đường sắt tốc độ cao Bắc - Nam 350 km/h**: Bóc tách bài toán vốn 67 tỷ USD, cơ chế hoàn vốn quỹ đất TOD quanh 23 ga và bước nhảy vọt nội địa hóa vật liệu chế tạo. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1182]** **Đại dự án Khí — Điện Lô B — Ô Môn**: Giải phẫu chuỗi giá trị 12 tỷ USD, điểm nghẽn cơ chế PPA và bài toán an ninh năng lượng phía Nam (Thượng nguồn 107 tỷ m3 khí, trung nguồn đường ống 431 km, hạ nguồn cụm 4 nhà máy 3.810 MW, cơ chế chuyển ngang giá khí Pass-through và bao tiêu Qc). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1197]** **Ngành Xi măng Việt Nam**: Bài toán dư cung 120 triệu tấn, công suất gấp đôi sức mua nội địa, cơ cấu chi phí than/điện 55-60%, chiếc bẫy xuất khẩu clinker thuế 10% và rào cản phát thải xanh CBAM. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1206]** **Cơ chế DPPA và cơn khát điện sạch RE100 của dòng vốn FDI**: Lối thoát cho năng lượng tái tạo hay nút thắt mới trên lưới điện? (Nghị định 80/2024/NĐ-CP, 2 mô hình đường dây riêng vs lưới quốc gia, hợp đồng chênh lệch CfD phái sinh, bài toán điện nền 50Hz và chi phí phụ trợ hệ thống). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1238]** **Cụm cảng Cái Mép — Thị Vải và siêu cảng Cần Giờ**: Cuộc đua trung chuyển với Singapore, rào cản luồng -15.5m và mắt xích Đông Nam Bộ (Gateway port vs Transshipment hub, tỷ lệ trung chuyển <5% vs Singapore >85%, quyền lực liên minh hãng tàu MSC/Maersk, luồng tĩnh -15.5m cho tàu 24k TEU, 80% hàng đi bằng sà lan nội địa và chìa khóa Khu thương mại tự do FTZ). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1260]** **Siêu dự án Cảng hàng không quốc tế Long Thành**: Bài toán hạ tầng 16 tỷ USD, mắt xích logistics hàng không và cuộc đua dịch vụ phi hàng không (Cấp 4F, công suất 100M khách và 5M tấn hàng hóa, logistics hàng công nghệ cao Air Cargo, kết nối hạ tầng Đông Nam Bộ, quyền lực biên lợi nhuận phi hàng không Duty-free 70-80% và 3 điểm nghẽn phân luồng / hoàn vốn). `vi-mo`
- **Thị trường phát điện cạnh tranh (VCGM) và thị trường bán buôn điện cạnh tranh (VWEM)**: Cơ chế chào giá trên thị trường giao ngay (Spot market), giá trần thị trường (SMP), tỷ lệ thanh toán theo hợp đồng cố định Qc (80–95%) và phần sản lượng hưởng giá thị trường tự do của các nhà máy điện. `vi-mo`
- **Ngành Cấp nước sạch và Hạ tầng thoát nước đô thị**: Đặc thù độc quyền tự nhiên theo địa giới hành chính, lộ trình tăng giá nước sinh hoạt định kỳ 5–10%/năm, tỷ lệ thất thoát nước không doanh thu (NRW) giảm về dưới 15% và dòng tiền phòng thủ ổn định bất chấp chu kỳ kinh tế. `vi-mo`
- **Năng lượng sinh khối (Biomass) và cơn sốt viên nén gỗ (Wood Pellets) xuất khẩu**: Việt Nam vươn lên Top 2 thế giới xuất khẩu viên nén gỗ sang Nhật Bản (hợp đồng FIT dài hạn) và Hàn Quốc (chính sách REC), quy mô hơn 4,5 triệu tấn/năm và yêu cầu chứng chỉ rừng bền vững FSC. `vi-mo`
- **Hệ thống thu phí tự động không dừng (ETC) và kinh tế học các dự án đường cao tốc BOT**: Cấu trúc doanh thu hoàn vốn 15–25 năm, rủi ro lưu lượng xe thực tế thấp hơn dự báo ban đầu, áp lực lãi vay ngân hàng thả nổi và cơ chế chia sẻ phần hụt doanh thu theo Luật PPP. `vi-mo`
- **Hạ tầng trung tâm dữ liệu (Data Center Tier III/IV) tại Việt Nam**: Tiêu chuẩn PUE (Power Usage Effectiveness), yêu cầu nguồn điện kép dự phòng N+1, quy định lưu trữ dữ liệu trong nước theo Nghị định 53 và cuộc đua đầu tư của Viettel, VNPT, FPT và CMC. `vi-mo`
- **Quy hoạch cảng hàng không và kinh tế học mảng bảo dưỡng, sửa chữa tàu bay (MRO)**: Chi phí bảo dưỡng chiếm 12–15% chi phí vận hành hãng bay, sự thiếu hụt hangar tiêu chuẩn EASA/FAA tại Đông Nam Á và cơ hội đón đội tàu bay thân hẹp A320/B737 trong khu vực. `vi-mo`

## C. Ngân hàng & Tài chính hệ thống

- **[ĐÃ VIẾT - Mạch 1087]** **NIM** co lại: vì sao lãi suất huy động giảm mà biên vẫn mỏng.
- **[ĐÃ VIẾT - Mạch 1141]** **Nợ xấu và trích lập**: đọc thuyết minh thay vì đọc con số tiêu đề.
- **[ĐÃ VIẾT - Mạch 1150]** **Tín dụng bất động sản**: tỷ trọng thật trong danh mục các ngân hàng và bài toán rủi ro tài sản thế chấp.
- **[ĐÃ VIẾT - Mạch 1106]** **Trái phiếu doanh nghiệp**: ai đang cầm, và đáo hạn dồn vào lúc nào.
- **[ĐÃ VIẾT - Mạch 1047]** **CASA** — vì sao chỉ số này quyết định ngân hàng nào sống khoẻ khi lãi suất đổi chiều.
- **[ĐÃ VIẾT - Mạch 1158]** **Basel III và bộ đệm vốn**: điều kiện ngầm cho tăng trưởng tín dụng.
- **[ĐÃ VIẾT - Mạch 1218]** **Kinh tế Việt Nam 9 tháng đầu năm 2026**: Động lực tăng trưởng GDP (6,8-7,0%) từ cỗ xe tam mã xuất khẩu - FDI - công nghiệp và nghịch lý dòng vốn tín dụng chậm hấp thụ (mới đạt 8,5%), áp lực lạm phát CPI 3,9% và trọng trách giải ngân 350.000 tỷ đầu tư công quý 4. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1241]** **Ngân hàng Nhà nước hút ròng qua kênh tín phiếu**: Giải mã công cụ ghìm cương tỷ giá và vì sao thị trường chứng khoán không nên hoảng loạn? (Thị trường 1 dân cư vs Thị trường 2 liên ngân hàng, chênh lệch lãi suất VND-USD, triệt tiêu động cơ carry trade, phân biệt hút tín phiếu ngắn hạn vs bán USD dự trữ vĩnh viễn). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1246]** **Luật Các tổ chức tín dụng và bài toán sở hữu chéo**: Khi giới hạn tín dụng buộc tái cấu trúc dòng vốn hệ sinh thái (Giảm trần sở hữu tổ chức 10%, nhóm liên quan 15%, minh bạch hóa cổ đông từ 1%, lộ trình 5 năm hạ trần cấp tín dụng một khách hàng về 10% và nhóm về 15%, cơ chế can thiệp sớm và áp lực tái cấp vốn của các tập đoàn bất động sản thân hữu). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1275]** **Giao dịch thỏa thuận (Put-through)**: Nghịch lý khối ngoại bán ròng kỷ lục, cơ chế vận hành tách biệt chỉ số và cạm bẫy thống kê dòng tiền.
- **Tỷ lệ vốn ngắn hạn cho vay trung và dài hạn (trần 30% của NHNN)**: Cơ chế ngăn chặn rủi ro lệch pha kỳ hạn (Maturity Mismatch) khi ngân hàng huy động tiết kiệm 6 tháng nhưng cho vay dự án bất động sản 15–20 năm, và áp lực phát hành trái phiếu ngân hàng kỳ hạn dài để bổ sung nguồn vốn. `vi-mo`
- **Hệ số an toàn vốn CAR và sự khác biệt giữa Vốn cấp 1 (Tier 1) và Vốn cấp 2 (Tier 2)**: Vì sao chia cổ tức bằng cổ phiếu hoặc giữ lại lợi nhuận giúp tăng vốn tự có bền vững, trong khi phát hành trái phiếu thứ cấp kỳ hạn trên 5 năm bị khấu hao 20% mỗi năm trong 5 năm cuối. `vi-mo`
- **Ngành Bảo hiểm phi nhân thọ và nguồn vốn nhàn rỗi (Insurance Float)**: Hai trụ cột lợi nhuận gồm Lãi nghiệp vụ bảo hiểm gốc (Combined Ratio < 100%) và Lãi đầu tư tài chính; vì sao chu kỳ tăng lãi suất tiền gửi ngân hàng lại là động lực thúc đẩy lợi nhuận ròng của các doanh nghiệp bảo hiểm. `vi-mo`
- **Thị trường liên ngân hàng (Thị trường 2) và đường cong lãi suất qua đêm (ON, 1W, 1M)**: Cách đọc trạng thái thanh khoản hệ thống qua chênh lệch lãi suất liên ngân hàng với lãi suất OMO (cầm cố giấy tờ có giá), và phản ứng điều tiết bơm/hút ròng hàng ngày của Ngân hàng Nhà nước. `vi-mo`
- **Bán chéo bảo hiểm qua ngân hàng (Bancassurance) sau giai đoạn thanh tra toàn diện**: Sự sụt giảm mạnh của doanh thu phí năm đầu (FYP), quy định cấm gắn kèm bảo hiểm nhân thọ với khoản vay tín dụng theo Luật Các tổ chức tín dụng mới và quá trình tái định hình thu nhập ngoài lãi (Non-NII). `vi-mo`
- **Xếp hạng tín nhiệm quốc gia (Sovereign Credit Rating) và ngưỡng Đầu tư (Investment Grade)**: Ý nghĩa của mức trần Baa3 (Moody's) / BBB- (S&P, Fitch), tác động làm giảm 100–150 điểm cơ bản chi phí vay vốn quốc tế của Chính phủ và doanh nghiệp Việt Nam, cùng điều kiện nâng hạng từ các quỹ hưu trí toàn cầu. `vi-mo`

## D. Vàng, dầu, hàng hoá

- **[ĐÃ VIẾT - Mạch 1128]** Chênh lệch **giá vàng trong nước và thế giới** — cơ chế nào tạo ra nó, và nó nói gì.
- **[ĐÃ VIẾT - Mạch 1084]** Vàng và **lãi suất thực**: mối quan hệ thường được nhắc, hiếm khi được đo.
- **[ĐÃ VIẾT - Mạch 1079]** **Dầu**: OPEC+, tồn kho Mỹ, và vì sao giá xăng trong nước lệch pha với Brent.
- **[ĐÃ VIẾT - Mạch 1064]** Ngân hàng trung ương mua vàng — xu hướng nhiều năm, không phải tin một ngày.
- **[ĐÃ VIẾT - Mạch 1051]** **Đồng** như một chỉ báo công nghiệp: nó thật sự dẫn trước cái gì?
- **[ĐÃ VIẾT - Mạch 1166]** **Cà phê Robusta**: Cơn sốt giá kỷ lục, biến đổi khí hậu El Niño và nghịch lý chuỗi giá trị xuất khẩu hạt thô (vỡ hợp đồng kỳ hạn, 3% giá trị trong tách cà phê). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1200]** **Đất hiếm và nghịch lý năng lượng xanh**: Khi 17 nguyên tố vô danh định hình cán cân quyền lực công nghệ toàn cầu (Nam châm vĩnh cửu NdFeB cho xe điện & tuabin gió, nghịch lý hóa chất môi trường, độc quyền tinh chế 90% của Trung Quốc, 22 triệu tấn trữ lượng Việt Nam và bài toán phân tách sâu). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1203]** **Ngành Phân bón Việt Nam và bài toán chuỗi giá trị**: Biến số giá khí đầu vào, rào cản hạn ngạch Trung Quốc và nút thắt 10 năm của Luật Thuế GTGT (Tỷ trọng khí 60-70% giá thành đạm urê, năng lực tự chủ 3 triệu tấn, 1.000-1.500 tỷ thuế GTGT đầu vào không được khấu trừ của Luật 71 và điểm uốn áp thuế 5%). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1209]** **Ngành Cao su Việt Nam và bài toán chuỗi giá trị**: Cơn sốt giá chu kỳ, rào cản chống phá rừng EUDR và làn sóng chuyển đổi đất khu công nghiệp (Sản lượng 1,3 triệu tấn Top 3 thế giới, 70% tiêu thụ cho săm lốp ô tô, nút thắt chu kỳ sinh học 7 năm, phân hóa đại điền PEFC vs 56% tiểu điền, và mỏ neo bồi thường chuyển đổi đất KCN 1-1,5 tỷ/ha). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1215]** **Ngành Hóa chất cơ bản và chuỗi giá trị Xút - Clo (Chlor-Alkali)**: Khi "dòng máu" công nghiệp phụ thuộc 50% nhập khẩu và bài toán cân bằng sinh tử (Nhu cầu 400.000 tấn, tự chủ 50%, tỷ lệ sinh 0,886 tấn Clo/tấn xút, con hào rào cản vận tải xút lỏng của CSV, HVT và chìa khóa hạ nguồn dự án 12.000 tỷ Nghi Sơn DGC). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1229]** **Ngành Dược phẩm Việt Nam và bài toán chuỗi giá trị**: Cuộc đua nâng chuẩn EU-GMP, điểm nghẽn 80% nguyên liệu API nhập khẩu và cánh cửa đấu thầu kênh ETC (Quy mô 7,5-8 tỷ USD, phân tầng OTC 30% vs ETC 70%, Thông tư 07/2024/TT-BYT Nhóm 1-2 vs cuộc đua xuống đáy WHO-GMP Nhóm 3-5, rào cản phụ thuộc 80-90% API Trung Quốc/Ấn Độ, làn sóng M&A Taisho/Stada/Abbott/SK và áp lực khấu hao). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1279]** **Ngành Nhựa & Hóa dầu Việt Nam và bài toán chuỗi giá trị**: Điểm nghẽn 80% hạt nhựa nguyên sinh nhập khẩu, biến số giá dầu Naphtha và cuộc đua tự chủ từ các tổ hợp tỷ đô. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1286]** **Ngành Thức ăn chăn nuôi Việt Nam và bài toán chuỗi giá trị 3F**: Điểm nghẽn 80% nguyên liệu nhập khẩu, biến số giá ngô đậu CBOT và cuộc đua khép kín Feed - Farm - Food. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1293]** **Ngành Giấy và Bao bì Việt Nam và bài toán chuỗi giá trị**: Điểm nghẽn 70% giấy phế liệu OCC nhập khẩu, bùng nổ thương mại điện tử và làn sóng FDI dịch chuyển công nghệ. `vi-mo`
- **Ngành Mía đường Việt Nam và chuỗi giá trị**: Tác động kép từ chu kỳ thời tiết El Niño làm giảm chữ đường (CCS), hàng rào thuế chống bán phá giá và chống lẩn tránh thuế 47,64% với đường mía nhập khẩu từ Thái Lan/ASEAN, và bài toán cạnh tranh với đường lỏng HFCS. `vi-mo`
- **Ngành Sữa Việt Nam và biến số giá sữa bột nguyên kem (WMP), sữa bột tách béo (SMP) trên sàn GDT New Zealand**: Cơ cấu tự chủ vùng nguyên liệu đàn bò sữa nội địa mới đáp ứng ~40% nhu cầu, độ trễ 3–6 tháng từ các hợp đồng chốt giá kỳ hạn nguyên liệu đến biên lợi nhuận gộp. `vi-mo`
- **Ngành Khí công nghiệp và Hóa chất tinh khiết**: Sản xuất Oxy, Nitơ, Argon và Hydro phục vụ luyện kim, y tế và điện tử bán dẫn; đặc thù chi phí đầu vào gần như bằng 0 (tách từ không khí), chi phí điện năng chiếm 65–70% giá thành và rào cản hợp đồng cung cấp qua đường ống dài hạn 10–15 năm. `vi-mo`
- **Chuỗi giá trị Ngành Tôn mạ (Tôn lạnh, Tôn kẽm, Tôn màu)**: Vị thế trung nguồn mua thép cuộn cán nóng (HRC) để cán nguội và mạ hợp kim; rủi ro hàng tồn kho HRC biến động mạnh theo chu kỳ giá thép thế giới và sự phụ thuộc vào 50–60% sản lượng xuất khẩu chịu rào cản phòng vệ thương mại. `vi-mo`
- **Ngành Săm lốp ô tô Việt Nam và sự dịch chuyển từ lốp Bias sang lốp Radial toàn thép (TBR)**: Cơ cấu nguyên liệu đầu vào gồm cao su tự nhiên (35%), cao su tổng hợp (15%), than đen và sợi thép tanh lốp; lợi thế nguồn cao su nội địa dồi dào và thị trường xuất khẩu sang Mỹ, Brazil. `vi-mo`
- **Chuỗi giá trị Ngành Gạo xuất khẩu Việt Nam**: Bước chuyển dịch lịch sử từ gạo trắng phẩm cấp thấp sang gạo thơm chất lượng cao (ST24, ST25, Đài Thơm 8 chiếm >75% kim ngạch), nhưng biên lợi nhuận ròng của doanh nghiệp xay xát chỉ mỏng 1–3% do thiếu thương hiệu bán lẻ đầu cuối và áp lực chi phí thu mua lúa tươi. `vi-mo`
- **Thị trường Tín chỉ Carbon rừng và công nghiệp (Carbon Credits)**: Phân biệt thị trường bắt buộc (Compliance Market - ETS) và thị trường tự nguyện (Voluntary Market - VCM), thương vụ chuyển nhượng 10,3 triệu tấn CO2 rừng Bắc Trung Bộ thu về 51,5 triệu USD và cơ hội thương mại hóa của các doanh nghiệp lâm nghiệp, năng lượng sạch. `vi-mo`

## E. Tiền số & Tài sản số

- **[ĐÃ VIẾT - Mạch 1038]** **Bitcoin sau các kỳ halving**: dữ liệu nói gì, và mẫu quá nhỏ tới đâu.
- **[ĐÃ VIẾT - Mạch 1053, 1016]** **Stablecoin**: dự trữ đứng sau, và rủi ro mà người dùng Việt Nam ít nhìn.
- **[ĐÃ VIẾT - Mạch 1100]** **ETF giao ngay** đổi cấu trúc người mua như thế nào.
- **[ĐÃ VIẾT - Mạch 1126]** **Cơ chế thanh lý nợ xấu trong DeFi**: Khi các đợt Margin Call tự động kích hoạt phản ứng dây chuyền trên chuỗi.
- **[ĐÃ VIẾT - Mạch 1139]** **Ví ngủ đông thời Satoshi**: Khi những đồng Bitcoin cổ đại thức giấc — giải mã chỉ số Coin Days Destroyed (CDD), 3 kịch bản di chuyển ví và chu kỳ HODL Waves.
- **[ĐÃ VIẾT - Mạch 1162]** **MVRV Z-Score và Realized Price**: Khi sổ cái on-chain vạch trần tâm lý và giá vốn thực của thị trường Bitcoin (bóc tách UTXO, phân vị Z-score, STH vs LTH Realized Price). `crypto`
- **[ĐÃ VIẾT - Mạch 1175]** **Khung pháp lý tài sản số tại Việt Nam**: Áp lực từ Danh sách Xám FATF, nghịch lý dòng tiền 100 tỷ USD và bài toán quản trị dòng vốn (Khuyến nghị 15, Quyết định 194/QĐ-TTg, NĐ 52/2024, cơ chế Sandbox và Luật CN Công nghệ số). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1180]** **Chỉ số Puell Multiple và chi phí cận biên thợ đào**: Khi những đại công trường Bitcoin chuyển mình sang hạ tầng AI (Hashprice chạm đáy, vùng đầu hàng thợ đào Puell < 0.5, thương vụ Core Scientific $3.5B với CoreWeave). `crypto`
- **[ĐÃ VIẾT - Mạch 1201]** **Hồ sơ thảm họa Terra Luna và cú sập 40 tỷ USD**: Giải mã cái bẫy toán học của đồng tiền ổn định thuật toán UST và phản ứng dây chuyền tử thần (Lãi suất Anchor 20%, Curve 3pool cạn thanh khoản, Arbitrage Mint-and-Burn và siêu lạm phát 6.500 tỷ LUNA). `crypto`
- **[ĐÃ VIẾT - Mạch 1220]** **Bên trong chiếc két 120 tỷ USD của Tether**: Giải mã dòng tiền On-chain của 'Đô la bóng tối' và nghịch lý chủ nợ nợ công Mỹ (Dữ liệu ERC-20 vs TRC-20, cỗ máy in tiền 6,2 tỷ USD lợi nhuận với 100 nhân sự, danh mục 102 tỷ USD T-Bills qua Cantor Fitzgerald, vai trò hấp thụ nợ công Mỹ và rủi ro thanh khoản/nút đóng băng freeze). `crypto`
- **[ĐÃ VIẾT - Mạch 1233]** **Cơn sốt Restaking và chiếc bẫy đòn bẩy LRT**: Khi 15 tỷ USD Ethereum bị đem đi cầm cố chéo và rủi ro Slashing dây chuyền (EigenLayer, Liquid Restaking Tokens, cơ chế Slashing liên đới AVS, Looping Leverage 3-5 vòng trên Lending và bóng ma Depeg thanh lý dây chuyền). `crypto`
- **[ĐÃ VIẾT - Mạch 1251]** **Vụ tấn công The DAO 2016 và ngã rẽ sinh tử của Ethereum**: Lỗ hổng Reentrancy Bug trong hàm splitDAO, 3,6 triệu ETH bị bòn rút vào Dark DAO (15% tổng cung mạng), 28 ngày đếm ngược sinh tử, cuộc chiến triết học 'Code is Law' vs tính thực dụng, và Hard Fork tại khối 1.920.000 khai sinh Ethereum Classic (ETC). `crypto`
- **[ĐÃ VIẾT - Mạch 1270]** **Hồ sơ sụp đổ của đế chế FTX: Lỗ hổng backdoor 8 tỷ USD của Alameda và 72 giờ tháo chạy trên chuỗi blockchain**: Sàn FTX & Alameda, âm 8 tỷ USD tiền gửi, cờ bí mật allow_negative, token tự in FTT thế chấp tài sản ảo, bảng cân đối rò rỉ, 72 giờ tháo chạy on-chain rút ròng hơn 6 tỷ USD và bản án 25 năm tù cho SBF. `crypto`
- Phí giao dịch và trượt giá: phần chi phí thật mà bảng giá không hiện.
- **[ĐÃ VIẾT - Mạch 1291]** **Mempool và thế giới 'Khu rừng Đen tối' trên Ethereum**: Những con bot săn mồi ẩn mình, kỹ thuật Front-running và các phi vụ Sandwich Attack hàng triệu đô la. `crypto`
- **Cạm bẫy Tokenomics "Định giá pha loãng hoàn toàn khổng lồ, lượng lưu hành siêu nhỏ" (Low Float, High FDV)**: Vì sao hàng loạt dự án mới niêm yết với FDV hàng tỷ USD chỉ có 5–10% token lưu hành, tạo áp lực xả hàng âm ỉ suốt 3–4 năm theo lịch mở khóa (Cliff & Linear Vesting) của các quỹ đầu tư mạo hiểm (VC). `crypto`
- **Cầu nối xuyên chuỗi (Cross-chain Bridges) và tử huyệt bảo mật lớn nhất thế giới Web3**: Nguyên lý khóa và đúc (Lock-and-Mint), vì sao hơn 2,5 tỷ USD bị đánh cắp trong các vụ tấn công cầu nối (Ronin Network 624 triệu USD, Wormhole 320 triệu USD, Nomad 190 triệu USD) do sự tập trung hóa của cụm chữ ký đa bên (Multi-sig). `crypto`
- **Mã hóa tài sản thực trên chuỗi (Real-World Assets - RWA)**: Khi các định chế Phố Wall (BlackRock BUIDL, Franklin Templeton) đưa trái phiếu kho bạc Mỹ, tín dụng tư nhân và vàng vật chất lên blockchain để thanh toán tức thì 24/7 và chia nhỏ quyền sở hữu. `crypto`
- **Cơ chế Tạo lập thị trường tự động (AMM) và rủi ro Tổn thất tạm thời (Impermanent Loss)**: Công thức tích số không đổi $x \cdot y = k$ của Uniswap, mô hình thanh khoản tập trung (Concentrated Liquidity V3) và lý do hơn 50% nhà cung cấp thanh khoản (LP) thua lỗ so với việc chỉ nắm giữ tài sản gốc (HODL) khi giá biến động mạnh. `crypto`
- **Chỉ số Hash Ribbons và chu kỳ đầu hàng của thợ đào Bitcoin (Miner Capitulation)**: Sự giao cắt giữa đường trung bình động Hashrate 30 ngày và 60 ngày sau mỗi kỳ giảm một nửa phần thưởng khối (Halving), khi các dàn máy đào cũ buộc phải tắt nguồn và bán tháo lượng Bitcoin dự trữ trước khi thị trường tạo đáy dài hạn. `crypto`
- **Lịch sử sụp đổ của sàn giao dịch Mt. Gox (2014) và bóng ma 850.000 Bitcoin kéo dài một thập kỷ**: Từ một trang web trao đổi thẻ bài trò chơi phép thuật trở thành sàn nắm giữ 70% giao dịch Bitcoin toàn cầu, lỗ hổng malleability giao dịch rút cạn kho lạnh suốt nhiều năm và tiến trình hoàn trả tài sản bằng Bitcoin sau 10 năm phá sản. `crypto`
- **Thị trường Phái sinh Crypto: Funding Rate và Tổng khối lượng hợp đồng mở (Open Interest - OI)**: Cơ chế phí cấp vốn định kỳ mỗi 8 giờ để neo giá hợp đồng tương lai vĩnh cửu (Perpetual Futures) vào giá giao ngay, và hiện tượng Long/Short Squeeze dây chuyền khi Open Interest phình to cùng mức Funding Rate cực đoan. `crypto`

## F. Chip, AI, RAM — và đường nó chạm vào các ngành

Nhóm này là **tản mạn**: dài hơi, liên ngành, không bám một mã.

- **[ĐÃ VIẾT - Mạch 1048, 1012]** **RAM và chu kỳ bộ nhớ**: vì sao đây là ngành có chu kỳ tàn bạo nhất trong bán dẫn, và nó báo trước điều gì cho điện tử tiêu dùng.
- **[ĐÃ VIẾT - Mạch 1063]** **Trung tâm dữ liệu ăn điện**: một cơn sốt phần mềm biến thành bài toán **hạ tầng điện** ra sao.
- **[ĐÃ VIẾT - Mạch 1071, 1222]** **Ngành Đóng gói và Thử nghiệm Bán dẫn (OSAT)**: Mắt xích thực tế của Việt Nam trong chuỗi vi mạch toàn cầu và bài toán giá trị gia tăng (Quy trình Wafer Dicing, Die Attach, Wire Bonding, Testing; hệ sinh thái Intel IPV 1,5 tỷ USD chiếm >50% chip toàn cầu, Amkor Bắc Ninh 1,6 tỷ USD, Hana Micron Bắc Giang; thách thức tỷ lệ nội địa hóa vật tư phụ trợ <15% và chất lượng điện áp phòng sạch). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1076]** **HBM**: vì sao một loại bộ nhớ hẹp lại thành nút thắt của cả một làn sóng.
- **[ĐÃ VIẾT - Mạch 1147]** **Nhân lực kỹ thuật bán dẫn**: khoảng cách giữa **tuyên bố** và **năng lực đào tạo** thực tế của kỹ sư vi mạch Việt Nam.
- **[ĐÃ VIẾT - Mạch 1155]** **Điện toán biên và Edge AI**: Khi trí tuệ nhân tạo rời đám mây, mắt xích nào của Việt Nam hưởng lợi thật. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1131]** **AI làm giảm chi phí gì trong doanh nghiệp Việt** — và những rào cản vô hình nó không thể chạm tới.
- **[ĐÃ VIẾT - Mạch 1092]** Chu kỳ vốn đầu tư của các hãng lớn: khi họ chi mạnh, tiền chảy qua những khâu nào.
- **[ĐÃ VIẾT - Mạch 1125]** **Nước siêu tinh khiết (UPW)**: Cơn khát của ngành bán dẫn và điểm nghẽn tài nguyên tự nhiên đằng sau những con chip AI.
- **[ĐÃ VIẾT - Mạch 1172]** **Cỗ máy quang khắc EUV của ASML**: Yết hầu của ngành bán dẫn thế giới tại thị trấn Veldhoven, con hào công nghệ độc quyền và chiêm nghiệm về toàn cầu hóa. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1179]** **Cơn khát điện nền cho AI và sự phục hưng của năng lượng hạt nhân**: Khi Big Tech tìm về những lò phản ứng cũ (Microsoft Three Mile Island, Amazon Talen Susquehanna, bài toán điện nền baseload 24/7 và công nghệ SMR). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1187]** **Nghịch lý hai cỗ máy Transformer**: Khi con chip AI tối tân phải chờ khối thép biến áp 3 năm để cắm điện (Kiến trúc Transformer của Deep Learning vs Máy biến áp điện lực thế kỷ 19, nút thắt lead time 3-4 năm, thép kỹ thuật điện GOES và lời tiên tri của Elon Musk). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1194]** **Từ hạt cát thạch anh đến tấm Wafer**: Hành trình thanh lọc vật chất thành linh hồn của kỷ nguyên số (Độ tinh khiết 11 số 9 Eleven Nines, mỏ thạch anh độc quyền Spruce Pine, lò luyện hồ quang 1.900°C, phương pháp kéo đơn tinh thể Czochralski 1.425°C và chiêm nghiệm về sự thanh lọc). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1207]** **Cuộc săn lùng 3 mili-giây và giới hạn tốc độ ánh sáng**: Khi các thuật toán cao tần (HFT) biến thị trường tài chính thành chiến trường vật lý (Dự án 300 triệu USD Spread Networks xẻ núi Appalachian, tháp sóng vi ba Microwave, hiện tượng Colocation cuộn dây cáp mạng bằng nhau, ảo ảnh thanh khoản Flash Crash và chiêm nghiệm về lợi thế kiên nhẫn của con người trước máy móc). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1213]** **Định lý mạng nhện (Cobweb Theorem) và nỗi ám ảnh chu kỳ**: Từ đàn heo, vườn tiêu đến ảo ảnh dòng tiền trên sàn chứng khoán (Mordecai Ezekiel 1938, độ trễ sinh học 6-8 tháng của heo, 3-4 năm của hồ tiêu, độ trễ 2-3 năm đóng tàu Capesize, 3-4 năm nhà máy Fab bán dẫn, và ảo ảnh định giá P/E rẻ khi mua đúng đỉnh chu kỳ). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1219]** **Chỉ số Baltic Dry Index và độ trễ đóng tàu 3 năm**: Khi những con tàu chở hàng rời vạch trần nhịp thở kinh tế toàn cầu (Cấu trúc BDI: Capesize, Panamax, Supramax; độ trễ nguồn cung 3 năm từ xưởng đóng tàu Trung Quốc/Hàn Quốc; vòng xoáy giá cước biến động 1.000%–2.000% và chiêm nghiệm về ảo ảnh P/E tạo đỉnh chu kỳ hàng hải). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1226]** **Chiếc hộp sắt 40 feet và quy luật mất cân đối của toàn cầu hóa**: Khi những chiếc container rỗng vạch trần dòng chảy thương mại một chiều (Malcolm McLean 1956 giảm 90% chi phí bốc dỡ, dòng chảy vật chất Đông Á sang phương Tây vs xuất khẩu dịch vụ vô hình, 20-25% container trên biển chở không khí, chi phí 20 tỷ USD rỗng hồi hương, và chiêm nghiệm về những chiếc vỏ rỗng đầu cơ trên thị trường tài chính). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1232]** **Nghịch lý Jevons (Jevons Paradox) và bài toán hiệu suất**: Vì sao công nghệ càng tối ưu thì thế giới lại tiêu thụ tài nguyên nhiều hơn? (William Stanley Jevons 1865 The Coal Question, máy hơi nước James Watt vs nhu cầu than bùng nổ, thuật toán nén MP3 vs streaming 4K, chip AI 3nm vs cụm Data Center nuốt trọn điện lưới, cạm bẫy 'phí giao dịch 0 đồng' kích hoạt lướt sóng và triết lý kiềm chế bản năng). `vi-mo`
- **[ĐÃ VIẾT - Mạch 1243]** **Định luật Moore và giới hạn 1 nanometer: Khi vi mạch chạm trần lượng tử và kỷ nguyên đóng gói tiên tiến Chiplet**: Khi trần vật lý của bóng bán dẫn gặp hiệu ứng đường hầm lượng tử, chi phí máy High-NA EUV 380 triệu USD và sự dịch chuyển từ monolithic die sang kiến trúc mô-đun chiplet 3D, cùng chiêm nghiệm về giới hạn tăng trưởng hữu hạn trong đầu tư. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1250]** **Phòng sạch bán dẫn (Cleanroom Class 1) và nghệ thuật tĩnh lặng**: Khi một hạt bụi 0.1 micron làm gãy vỡ phiến wafer và chiêm nghiệm về "bộ lọc áp suất dương" bảo vệ tâm trí trước tiếng ồn thị trường tài chính. `vi-mo`
- **[ĐÃ VIẾT - Mạch 1258]** **Quán cà phê Edward Lloyd 1686 và tiếng chuông Lutine**: Hơn 300 năm con người học cách định giá sự bất định và sống sót sau bão giông (Khởi nguồn thị trường bảo hiểm hàng hải London 1688, nguồn gốc chữ Underwriter ký tên dưới văn bản, tiếng chuông đơn/chuông đôi Lutine Bell, bản chất chuyển hóa thảm họa phá sản thành chi phí định kỳ và liên hệ với cơ chế dừng lỗ 1R bảo vệ tài khoản). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1263]** **Đồng hồ nguyên tử và cuộc chạy đua chuẩn xác nano-giây**: Khi một tích tắc vô hình định đoạt hàng nghìn tỷ đô la và chiêm nghiệm về thời gian trong đầu tư (Essen & Parry 1955 NPL, 9.192.631.770 chu kỳ dao động Caesium-133, quy định MiFID II đồng bộ PTP IEEE 1588, cuộc chiến nano-giây của HFT vs thời gian sinh học của doanh nghiệp và lợi thế kiên nhẫn năm tháng của con người). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1269]** **Kính thiên văn James Webb và điểm cân bằng Lagrange L2**: Khi bóng tối 1,5 triệu km mở ra ánh sáng khai sinh vũ trụ và chiêm nghiệm về tọa độ tĩnh lặng trong đầu tư (Năm 2021 JWST 10 tỷ USD, điểm Lagrange L2 cách TĐ 1,5 triệu km, tấm chắn nhiệt Kapton 5 lớp chênh lệch +85°C vs -233°C, hồng ngoại 13,5 tỷ năm, tránh nhiễu loạn nhiệt bảng điện và tọa độ tĩnh lặng tâm trí). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1276]** **Hầm hạt giống toàn cầu Svalbard ở vĩ độ 78 Bắc**: Nơi sự sống được cất giữ ở âm 18°C và chiêm nghiệm về biên an toàn tối thượng trong đầu tư.
- **[ĐÃ VIẾT - Mạch 1283]** **Cáp quang ngầm xuyên đại dương dưới đáy vực 8.000 mét**: Những sợi thủy tinh bọc thép gánh 99% dữ liệu toàn cầu và chiêm nghiệm về nền móng thầm lặng trong đầu tư.
- **[ĐÃ VIẾT - Mạch 1290]** **Tàu thăm dò Voyager 1 ở khoảng cách 24 tỷ km ngoài không gian liên sao**: Chiếc máy tính 68 kilobyte phát tín hiệu 20 watt vượt qua 22 giờ ánh sáng và chiêm nghiệm về năng lực giữ vững phương hướng giữa biển nhiễu loạn thị trường. `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1298]** **Hiệu ứng Lindy và bài toán trường tồn**: Vì sao những điều cũ kỹ lại sống lâu hơn những trào lưu thời thượng? `vi-mo`
- **Hệ thống đê biển Delta Works của Hà Lan và tiêu chuẩn phòng vệ thảm họa 10.000 năm một lần**: Cơn lũ lịch sử vùng Biển Bắc năm 1953 cướp đi 1.836 sinh mạng, bài toán kinh tế học của nhà toán học David van Dantzig tính toán chiều cao con đê tối ưu và chiêm nghiệm về quản trị rủi ro đuôi (Tail Risk) trước những biến cố tưởng chừng không bao giờ xảy ra. `quan-tri-von`
- **Vệ tinh định vị GPS và sai số 38 micro-giây mỗi ngày từ Thuyết tương đối của Einstein**: Ở độ cao 20.200 km, đồng hồ nguyên tử trên vệ tinh chạy chậm đi 7 micro-giây do vận tốc (Thuyết tương đối hẹp) nhưng lại chạy nhanh hơn 45 micro-giây do trọng trường yếu (Thuyết tương đối rộng); nếu không hiệu chỉnh lệch pha 38 micro-giây đó, vị trí định vị trên mặt đất sẽ trôi lệch 10 km mỗi ngày — chiêm nghiệm về những độ lệch nhỏ tích tụ thành sai số khổng lồ trong đầu tư. `quan-tri-von`
- **Thấu kính Fresnel trên những ngọn hải đăng thế kỷ 19 và cuộc cách mạng cứu hàng triệu con tàu**: Trước năm 1822, các ngọn hải đăng dùng gương phản xạ kim loại làm thất thoát tới 83% ánh sáng; kỹ sư Augustin-Jean Fresnel đã cắt gọt thấu kính thành những vòng lăng kính đồng tâm bậc thang, gom toàn bộ những tia sáng phân tán thành một luồng sáng song song chiếu xa hơn 35 km — chiêm nghiệm về sức mạnh của sự hội tụ nguồn lực thay vì dàn trải danh mục. `quan-tri-von`
- **Rừng mưa Amazon và những "dòng sông bay" vô hình trên tầng khí quyển**: Hơn 390 tỷ cây xanh tại lưu vực Amazon mỗi ngày bơm lên bầu trời 20 tỷ tấn hơi nước (nhiều hơn cả lưu lượng nước sông Amazon đổ ra Đại Tây Dương là 17 tỷ tấn), tạo thành dòng chảy khí quyển nuôi sống toàn bộ nông nghiệp Nam Mỹ — chiêm nghiệm về dòng thanh khoản vô hình nuôi dưỡng sinh khí của thị trường tài chính. `vi-mo`
- **Hiệu ứng Cánh bướm và con số làm tròn 0,506 của nhà khí tượng học Edward Lorenz (1961)**: Khi nhập lại dữ liệu mô phỏng thời tiết trên chiếc máy tính Royal McBee LGP-30, Lorenz đã gõ tắt con số `0,506127` thành `0,506` (chênh lệch chưa tới 1 phần nghìn), nhưng sau hai tháng mô phỏng, hai đồ thị thời tiết rẽ sang hai kịch bản trái ngược hoàn toàn — chiêm nghiệm về giới hạn bất khả thi của việc dự báo dài hạn các hệ thống hỗn loạn. `quan-tri-von`
- **Quả cầu giảm chấn 660 tấn (Tuned Mass Damper) treo bên trong tòa tháp Taipei 101**: Giữa vành đai động đất và siêu bão Đài Loan, tòa nhà chọc trời cao 508 mét đứng vững nhờ một quả cầu thép khổng lồ nặng 660 tấn treo lơ lửng từ tầng 87 đến tầng 92; khi bão quật tòa tháp nghiêng về bên trái, quả cầu sẽ lắc ngược về bên phải để triệt tiêu tới 40% dao động — chiêm nghiệm về vai trò của tài sản phòng vệ và tiền mặt giúp cân bằng tâm lý khi thị trường rung lắc dữ dội. `quan-tri-von`
- **Chiếc đồng hồ hàng hải H4 của người thợ mộc John Harrison và bài toán Kinh độ thế kỷ 18**: Hàng thế kỷ các hạm đội hải quân Anh đắm tàu vì không thể xác định kinh độ trên biển do đồng hồ quả lắc bị sóng biển làm sai lệch; trong khi giới thiên văn học hàn lâm tìm lời giải trên các vì sao, người thợ mộc tự học John Harrison đã dành 31 năm chế tạo chiếc đồng hồ lò xo lưỡng kim chống nhiệt độ và ma sát — chiêm nghiệm về sự thực dụng và tính bền bỉ vượt qua định kiến học thuật. `quan-tri-von`
- **Căn phòng không tiếng vang (Anechoic Chamber) tại Orfield Laboratories với độ ồn âm 24,9 decibel**: Nơi hấp thụ 99,99% âm thanh đến mức con người nghe rõ tiếng máu chảy trong tĩnh mạch, tiếng phổi co giãn và không ai chịu đựng được quá 45 phút vì mất hoàn toàn điểm tựa thính giác — chiêm nghiệm về nỗi sợ sự tĩnh lặng của các nhà giao dịch khi thị trường đi ngang thanh khoản thấp. `quan-tri-von`

## G. Thị trường Việt Nam, chuyện dài

- **[ĐÃ VIẾT - Mạch 1081, 1033]** **Nâng hạng thị trường**: điều kiện kỹ thuật, và dòng vốn thụ động thực tế bao nhiêu.
- **[ĐÃ VIẾT - Mạch 1160]** **Non-prefunding (Thông tư 68/2024/TT-BTC)**: Bỏ ký quỹ 100% trước giao dịch cho khối ngoại, cơ chế bù trừ DVP và sự dịch chuyển rủi ro thanh toán sang các CTCK. `chung-khoan`
- **[ĐÃ VIẾT - Mạch 1130]** **Phiên hiệu lực FTSE**: Khi VN-Index lùi về dưới 1.800 điểm và bài học "bán sự thật" của dòng tiền tổ chức.
- **[ĐÃ VIẾT - Mạch 1145]** **Thanh khoản teo tóp quanh mốc 1.800 điểm**: Sự thận trọng của dòng tiền và bài học "vùng trũng thông tin" cuối quý 3. `chung-khoan`
- **[ĐÃ VIẾT - Mạch 1161]** **Hệ thống giao dịch mới**: Nó đổi được gì (năng lực chịu tải, độ trễ mili-giây) và không đổi được gì (định giá doanh nghiệp, tâm lý F0, bất đối xứng công nghệ HFT). `chung-khoan`
- **[ĐÃ VIẾT - Mạch 1108, 1021]** **Cổ tức tiền mặt** — nhóm doanh nghiệp trả đều, và vì sao ít người quan tâm.
- **[ĐÃ VIẾT - Mạch 1067]** Vòng đời một **doanh nghiệp niêm yết Việt Nam**: IPO, pha loãng, rồi im lặng.
- **[ĐÃ VIẾT - Mạch 1122]** **Cuộc chiến bán lẻ dược phẩm**: Long Châu vs An Khang vs Pharmacity và bài toán kinh tế học đơn vị.
- **[ĐÃ VIẾT - Mạch 1168]** **Bất động sản khu công nghiệp và FDI "China+1"**: Nghịch lý tỷ lệ lấp đầy kỷ lục, nút thắt quỹ đất sạch GPMB, hai mô hình hạch toán doanh thu và yêu cầu chuyển đổi KCN sinh thái RE100. `chung-khoan`
- **[ĐÃ VIẾT - Mạch 1169]** **Cơ chế Call Margin và Force Sell**: Công thức tính tỷ lệ ký quỹ thực tế Rtt, quy trình bán giải chấp của CTCK và hiệu ứng tuyết lở chéo (Cross Force Sell). `hoi-dap`
- **[ĐÃ VIẾT - Mạch 1225]** **VN-Index hồi phục hơn 15 điểm ngày đầu tuần**: Nghịch lý 'xanh vỏ đỏ lòng' khi VIC gánh 13 điểm và thanh khoản khớp lệnh tụt về 10.000 tỷ (Độ rộng 348 mã giảm vs 334 mã tăng, VIC gánh 85% đà tăng, hiện tượng tiết cung giá thấp vs smart money đứng ngoài quan sát, vùng trũng thông tin trước mùa BCTC Quý 3). `chung-khoan`
- **[ĐÃ VIẾT - Mạch 1268]** **Cuộc đua tăng vốn nghìn tỷ của các công ty chứng khoán: Khi mảng môi giới về 0 đồng và canh bạc mở rộng room Margin**: Vốn điều lệ Top đầu vượt 15.000 - 20.000 tỷ đồng vượt mặt NHTM tầm trung, cuộc chiến Zero Fee bào mòn biên lãi môi giới chuyển thành chi phí CAC, động lực mở rộng trần margin 200% vốn chủ sở hữu khi dư nợ toàn thị trường chạm đỉnh 220.000 - 240.000 tỷ đồng, cơ chế Non-prefunding (Thông tư 68/2024/TT-BTC) đòi hỏi bộ đệm vốn bảo lãnh quỹ ngoại, và áp lực pha loãng EPS cùng suy giảm hiệu suất ROE. `chung-khoan`
- **[ĐÃ VIẾT - Mạch 1287]** **Cổ phiếu vào diện cảnh báo, kiểm soát, hạn chế và đình chỉ giao dịch**: Các bậc thang kỷ luật của Sở Giao dịch và cạm bẫy 'bắt đáy' cổ phiếu rác. `hoi-dap`
- **[ĐÃ VIẾT - Mạch 1289]** **VN-Index giảm hơn 14 điểm kiểm định mốc 1.700 điểm**: VHM giảm hơn 5% tạo áp lực ghì chỉ số, dòng tiền phân hóa và bài toán quản trị vị thế trước mùa BCTC Quý 3. `chung-khoan`
- **Hiện tượng "Nghẽn mạch định giá" mùa công bố Báo cáo tài chính Quý**: Vì sao nhiều cổ phiếu báo lãi kỷ lục tăng 200–300% nhưng giá lại bị bán tháo sàn ngay ngày ra tin (Sell the News), trong khi doanh nghiệp báo lỗ giảm sâu lại bật tăng trần nhờ kỳ vọng điểm uốn lợi nhuận đã tạo đáy. `chung-khoan`
- **Cổ phiếu thưởng cho người lao động (ESOP) tại các doanh nghiệp niêm yết Việt Nam**: Ranh giới mong manh giữa công cụ giữ chân nhân tài gắn kết lợi ích dài hạn với sự lạm dụng phát hành giá 10.000 đồng tỷ lệ 3–5% mỗi năm làm pha loãng thu nhập trên mỗi cổ phiếu (EPS) của cổ đông nhỏ lẻ. `chung-khoan`
- **Dòng vốn Quỹ hoán đổi danh mục (ETF) nội và ngoại trên sàn HOSE**: Cơ chế mô phỏng chỉ số tham chiếu (VN30, VNFinLead, VNDiamond, FTSE Vietnam, MarketVector), quy tắc giới hạn tỷ trọng tối đa một cổ phiếu (10–15%) và vì sao các phiên cơ cấu danh mục định kỳ thứ Sáu tuần thứ 3 cuối quý luôn tạo ra khối lượng đột biến ở phiên ATC. `chung-khoan`
- **Chu kỳ đáo hạn và phát hành mới Trái phiếu doanh nghiệp riêng lẻ sau Nghị định 65**: Sự phân hóa rõ rệt khi nhóm ngân hàng chiếm hơn 65–70% lượng phát hành mới để tăng vốn cấp 2, trong khi nhóm bất động sản phải chịu lãi suất huy động 11–14%/năm kèm tài sản đảm bảo chặt chẽ. `vi-mo`
- **Cơ chế Trung tâm Đối tác Bù trừ Trung tâm (CCP) trong lộ trình nâng hạng thị trường mới nổi**: Bước chuyển từ kiểm tra đủ tiền trước khi đặt lệnh (Pre-trade check) sang mô hình thanh toán bù trừ đa phương có quỹ dự phòng rủi ro, và bài toán quản trị hạn mức tín dụng giữa công ty chứng khoán với nhà đầu tư tổ chức. `chung-khoan`

## H. Tâm lý và kỷ luật — nhịp 3–5 ngày một bài

`sub` = `quan-tri-von` · `loai` = **`Tâm lý`** (hoặc **`Đọc sách`** nếu bài đi từ một cuốn sách).

- **[ĐÃ VIẾT - Mạch 1088, 1030]** **Thiên lệch xác nhận** khi đã cầm hàng: cơ chế, và vì sao đọc thêm tin lại làm nó nặng hơn.
- **[ĐÃ VIẾT - Mạch 1105, 1029]** **Ác cảm thua lỗ**: vì sao cắt lỗ khó hơn chốt lời, dù cùng một số tiền.
- **[ĐÃ VIẾT - Mạch 1080, 1028]** **Hiệu ứng mỏ neo** vào giá mua: con số đó không có ý nghĩa gì với thị trường, nhưng có với người cầm.
- **[ĐÃ VIẾT - Mạch 1024]** **Ảo tưởng kiểm soát**: giao dịch nhiều hơn không làm kết quả tốt hơn — bằng chứng từ dữ liệu tài khoản.
- **[ĐÃ VIẾT - Mạch 1069]** **Ngụy biện chi phí chìm** trong một vị thế đang lỗ.
- **[ĐÃ VIẾT - Mạch 1135]** **Kể chuyện sau sự việc**: não dựng nhân quả cho một chuỗi ngẫu nhiên, và vì sao điều đó nguy hiểm.
- **[ĐÃ VIẾT - Mạch 1123]** **Quá tự tin sau một chuỗi thắng** — chuỗi thắng dài bao nhiêu thì vẫn có thể là may.
- **[ĐÃ VIẾT - Mạch 1230]** **Đám đông và điểm đảo chiều**: Thí nghiệm cân bò Galton 1906, 3 điều kiện của Trí tuệ đám đông (Wisdom of Crowds) sụp đổ thành Cơn điên bầy đàn (Madness of Crowds) trong room phím lệnh, cạm bẫy cung cấp thanh khoản vùng đỉnh và triết lý bán sớm của Bernard Baruch. `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1192]** **Cỡ lệnh như một quyết định tâm lý**: Bài kiểm tra giấc ngủ của Jesse Livermore (The Sleep Test), hạch hạnh nhân (Amygdala) và giới hạn chịu đựng của hệ thần kinh. `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1104]** **Nghỉ giao dịch**: chi phí của việc không làm gì, và vì sao nó khó chịu đựng.
- **[ĐÃ VIẾT - Mạch 1148]** **Đọc sách**: *The Most Important Thing* (Howard Marks) — Bản chất của Tư duy cấp độ hai (Second-Level Thinking), nghịch lý để vượt trội và con lắc tâm lý thị trường.
- **[ĐÃ VIẾT - Mạch 1164]** **Kế toán tâm lý (Mental Accounting) & Hiệu ứng House Money**: Vì sao nhà đầu tư dễ dãi đánh bạc với tiền lãi và khắt khe với tiền gốc (Richard Thaler, tính khả hoán của tiền tệ). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1167]** **Đọc sách Morgan Housel**: *The Psychology of Money* — Nghịch lý giữa làm giàu và giữ tiền, cạm bẫy biết thế nào là đủ (Enough) và quyền kiểm soát thời gian. `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1186]** **Nhật ký sau bàn phím: Cạm bẫy bình quân giá HPG**: Từ cú lướt sóng T+ đến chiếc bẫy Call Margin lúc 14:15 và bài học xương máu về kỷ luật cắt lỗ (Chu kỳ sập 2022 từ 46.5k về đáy 12.1k, bẫy chi phí chìm Sunk Cost Fallacy, hiệu ứng Đà điểu Ostrich Effect). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1205]** **Thiên lệch hành động (Action Bias) và cơn ngứa tay của trader**: Khi ngồi yên trên đống tiền mặt là quyết định sinh lời lớn nhất (Nghiên cứu phạt đền của Michael Bar-Eli, 93.7% thủ môn bay người vô nghĩa, triết lý Sitting Tight của Jesse Livermore, Tiền mặt như một quyền chọn tối thượng). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1208]** **Đọc sách Annie Duke**: *Thinking in Bets* — Cạm bẫy quy chụp kết quả (Resulting) và nghệ thuật tách rời chất lượng quyết định khỏi vận may rủi (Trận Super Bowl XLIX Pete Carroll ném bóng 1 yard, Cờ vua thông tin hoàn hảo vs Poker thông tin không hoàn hảo, Pocket Aces xác suất 82% vs 18% River, hai chiếc bẫy Lucky Fools vs tự trừng phạt bản thân). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1217]** **Đọc sách Daniel Kahneman**: *Thinking, Fast and Slow* — Hệ thống 1 (Fast Thinking) và Hệ thống 2 (Slow Thinking): Khi bộ não sinh học trở thành kẻ thù lớn nhất trước bảng điện tử, bẫy ác cảm thua lỗ (Loss Aversion), hiện tượng cạn kiệt bản ngã (Ego Depletion) khung 14h-14h30 và cơ chế tự động hóa Stop Loss để phòng vệ. `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1240]** **Đọc sách Richard Thaler**: *Misbehaving* — Hiệu ứng sở hữu (Endowment Effect) và vì sao trader luôn yêu mù quáng cổ phiếu mình đang cầm? (Econ vs Human, thí nghiệm chiếc cốc Đại học Cornell giá bán gấp 2.5 lần giá mua, thiên lệch nguyên trạng Status Quo Bias, cạm bẫy gồng lỗ và liều thuốc giải độc Bài kiểm tra qua đêm Overnight Test). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1256]** **Thiên lệch kẻ sống sót (Survivorship Bias)**: Vết đạn của Abraham Wald và cạm bẫy học cách làm giàu từ người chiến thắng (Nghiên cứu máy bay ném bom B-17 năm 1943, ảo ảnh chỉ số VN30/S&P 500 liên tục đào thải kẻ chết, thí nghiệm tung đồng xu 10.000 người, cạm bẫy backtest xóa mã hủy niêm yết, và triết lý bọc giáp bảo vệ động cơ buồng lái 1R). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1259]** **Đọc sách Charlie Munger: Poor Charlie's Almanack**: Hiệu ứng Lollapalooza, bẫy người cầm búa và nghệ thuật đảo ngược bài toán (Bài diễn thuyết Harvard 1995, hội chứng Man with a Hammer, mạng lưới mô hình tư duy đa ngành Latticework of Mental Models, phản ứng cộng hưởng thiên lệch tâm lý và triết lý đảo ngược Jacobi: Biết nơi mình sẽ chết để đừng bao giờ đến). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1267]** **Thiên lệch nhận thức muộn (Hindsight Bias)**: Ảo tưởng "biết ngay mà" sau phiên giao dịch và cái bẫy tự tin thái quá (Thí nghiệm Baruch Fischhoff 1975, hiệu ứng "I knew it all along", cơ chế tái cấu trúc ký ức của não bộ, ảo tưởng về tính dự báo, hai chiếc bẫy tự tin thái quá vs dằn vặt độc hại, tư duy Thinking in Bets và liều thuốc nhật ký quyết định trước khi bấm nút). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1277]** **Đọc sách Seth Klarman: Margin of Safety**: Cuốn sách 3.000 USD bị lãng quên của Phố Wall, bản chất của vùng đệm chống sai số và quyền năng của việc nắm giữ tiền mặt. `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1281]** **Hiệu ứng Dunning-Kruger trong đầu tư**: Từ "đỉnh cao ảo tưởng" của kẻ mới thắng đến "thung lũng tuyệt vọng" và hành trình giác ngộ kỷ luật. `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1296]** **Đọc sách Mark Douglas: Trading in the Zone**: 5 sự thật nền tảng về xác suất và nghệ thuật chấp nhận rủi ro hoàn toàn. `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1299]** **Đọc sách Edwin Lefèvre: Hồi ức của một nhà đầu cơ chứng khoán (Reminiscences of a Stock Operator)**: Nghệ thuật kiên nhẫn ngồi yên (Sitting Tight) và bài học xương máu sau một thế kỷ. `tam-ly-giao-dich`
- **Đọc sách George Soros — *The Alchemy of Finance* (Giả kim thuật tài chính)**: Lý thuyết Phản xạ (Theory of Reflexivity) — vì sao giá thị trường không chỉ phản ánh thụ động giá trị cơ bản, mà chính biến động giá lại quay ngược tác động làm thay đổi nền tảng cơ bản của doanh nghiệp và chu kỳ tín dụng. `tam-ly-giao-dich`
- **Đọc sách Nassim Nicholas Taleb — *Fooled by Randomness* (Trò đùa của sự ngẫu nhiên)**: Hình tượng những con khỉ gõ máy chữ, sự nhầm lẫn tai hại giữa vận may ngắn hạn và năng lực thực sự trong thị trường giá lên, cùng bài học về xác suất có điều kiện (Alternative Histories) mà người chiến thắng thường bỏ quên. `tam-ly-giao-dich`
- **Đọc sách Roger Lowenstein — *When Genius Failed* (Khi thiên tài thất bại)**: Câu chuyện hậu trường bên trong quỹ Long-Term Capital Management (LTCM) năm 1998 — khi hai chủ nhân giải Nobel Kinh tế (Myron Scholes và Robert Merton) dùng đòn bẩy 25:1 đến 100:1 trên mô hình phân phối chuẩn Gauss và sụp đổ trước sự kiện vỡ nợ trái phiếu Nga. `quan-tri-von`
- **Đọc sách Peter Lynch — *One Up On Wall Street* (Trên đỉnh Phố Wall)**: Phân loại 6 nhóm cổ phiếu kinh điển (Tăng trưởng chậm, Vững mạnh, Tăng trưởng nhanh, Chu kỳ, Tài sản ngầm, Xác chết hồi sinh) và sai lầm phổ biến nhất của nhà đầu tư khi áp dụng tiêu chí P/E của cổ phiếu tăng trưởng vào cổ phiếu chu kỳ. `quan-tri-von`
- **Đọc sách Jack D. Schwager — *Market Wizards* (Phù thủy thị trường tài chính)**: Điểm chung kỳ lạ của những nhà giao dịch vĩ đại nhất thế giới dù phương pháp hoàn toàn đối lập nhau — từ quản trị rủi ro nghiêm ngặt, cắt lỗ không do dự đến sự kiên nhẫn chờ đợi cơ hội có xác suất nghiêng hẳn về một phía. `tam-ly-giao-dich`
- **Ngụy biện con bạc (Gambler's Fallacy) và sự kiện 26 lần liên tiếp ra màu Đen tại sòng bạc Monte Carlo (1913)**: Vào ngày 18/08/1913, bàn quay Roulette tại Monte Carlo rơi vào ô Đen suốt 26 ván liên tiếp; đám đông con bạc đã mất hàng triệu franc vì liên tục gấp thếp đặt cửa Đỏ với niềm tin "đã Đen quá nhiều thì ván sau bắt buộc phải Đỏ" — liên hệ trực tiếp với thói quen bắt đáy cổ phiếu đang rơi tự do vì nghĩ "giảm 5 phiên sàn rồi thì phải hồi". `tam-ly-giao-dich`
- **Hiệu ứng Zeigarnik (Zeigarnik Effect) và nỗi ám ảnh từ những vị thế đóng dở dang**: Phát hiện năm 1927 của nhà tâm lý học Bluma Zeigarnik về việc người bồi bàn nhớ như in những bàn chưa thanh toán nhưng quên sạch ngay khi khách trả tiền xong — giải thích vì sao nhà giao dịch luôn bị dằn vặt suốt nhiều tuần bởi một lệnh cắt lỗ hoặc chốt non, dẫn đến hành vi giao dịch trả thù (Revenge Trading). `tam-ly-giao-dich`
- **Thiên lệch gần đây (Recency Bias) và sự mù quáng ở hai đầu chu kỳ thị trường**: Khuynh hướng não bộ ngoại suy dữ liệu của 3–6 tháng gần nhất thành xu hướng vĩnh viễn trong tương lai — khiến nhà đầu tư tin rằng thị trường sẽ tăng mãi ở vùng đỉnh hưng phấn, và tuyệt vọng rời bỏ thị trường đúng vùng đáy hoảng loạn. `tam-ly-giao-dich`
- **Hiệu ứng Peltzman (Peltzman Effect) và nghịch lý của các công cụ an toàn**: Nghiên cứu năm 1975 của nhà kinh tế học Sam Peltzman tại Đại học Chicago chỉ ra rằng khi ô tô được trang bị dây an toàn và phanh ABS, tài xế lại có xu hướng phóng nhanh và vượt ẩu hơn vì cảm giác được bảo vệ — tương tự như cách nhà đầu tư lạm dụng đòn bẩy Margin kịch trần khi nghĩ rằng mình đã cầm cổ phiếu cơ bản tốt trong rổ VN30. `tam-ly-giao-dich`

## I. Phương pháp giao dịch — nhịp 5–7 ngày một bài

`sub` = `quan-tri-von` · `loai` = **`Phương pháp`**.

- **[ĐÃ VIẾT - Mạch 1026]** **Trend following kiểu Donchian**: luật gốc, và các giai đoạn nó thua kéo dài nhiều năm.
- **[ĐÃ VIẾT - Mạch 1031]** **Turtle Traders**: thí nghiệm của Richard Dennis — cái được kiểm chứng và cái chỉ là giai thoại.
- **[ĐÃ VIẾT - Mạch 1032]** **Trung bình động cắt nhau**: vì sao nó phổ biến, và nó giả định gì về thị trường.
- **[ĐÃ VIẾT - Mạch 1113]** **Mean reversion** so với **momentum**: hai họ phương pháp đối nghịch, cùng tồn tại được vì sao.
- **[ĐÃ VIẾT - Mạch 1143]** **Breakout** và vấn đề tín hiệu giả: chi phí của việc sai nhiều lần liên tiếp và nghệ thuật kiên nhẫn chờ retest.
- **[ĐÃ VIẾT - Mạch 1129]** **Phân bổ theo biến động** (volatility targeting): ý tưởng gốc từ đâu.
- **[ĐÃ VIẾT - Mạch 1112, 1074]** **Kelly criterion** và vì sao gần như không ai dùng nguyên bản.
- **[ĐÃ VIẾT - Mạch 1095]** **Backtest**: overfitting, look-ahead bias, survivorship bias — ba cách một đường cong đẹp ra đời.
- **Chi phí giao dịch** ăn vào phương pháp tần suất cao như thế nào.
- **[ĐÃ VIẾT - Mạch 1153]** **Walk-forward analysis**: kiểm một phương pháp mà không tự lừa mình bằng dữ liệu quá khứ.
- **[ĐÃ VIẾT - Mạch 1170]** **Volume Profile**: Giải mã cấu trúc thanh khoản qua POC, Vùng giá trị (Value Area High/Low), HVN/LVN và cái bẫy mua Breakout. `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1183]** **Chỉ báo MACD (Moving Average Convergence Divergence)**: Giải mã cấu trúc động lượng, ảo tưởng giao cắt và nghệ thuật đọc sớm sự suy kiệt qua Histogram (Gerald Appel 1979, Thomas Aspray 1986, Zero Line, Whipsaw sideway, Histogram Divergence). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1210]** **Chỉ báo RSI (Relative Strength Index)**: Cạm bẫy quá mua quá bán, quy tắc dải biên động lượng và nghệ thuật đọc sớm sự suy kiệt qua phân kỳ ẩn (J. Welles Wilder 1978, Smoothing 14 phiên, bẫy bán non siêu sóng >70, bẫy bắt dao rơi <30, Range Rules Andrew Cardwell 40-80 Bull vs 20-60 Bear, và Bullish Hidden Divergence tiếp diễn). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1224]** **Kỳ vọng toán học (Expectancy) và Tỷ lệ Risk/Reward**: Vì sao Win Rate 40% vẫn sinh lời lớn trong khi 80% vẫn cháy tài khoản? (Công thức E = (W x R) - (L x 1), mổ xẻ 100 lệnh: Win 40% R:R 1:2.5 sinh lãi +40R vs Win 80% gồng lỗ Martingale -6R âm vốn -5R, ác cảm chuỗi thua ngẫu nhiên 6-8 lệnh, và 3 nguyên tắc thép đóng khung 1R). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1136]** **Mô hình Nêm giảm (Falling Wedge)**: Bứt phá nêm hội tụ, nhịp retest Pin Bar kiểm định cạnh trên, dời SL bảo toàn và chạm đích +2.8R.
- **[ĐÃ VIẾT - Mạch 1165]** **Mô hình Cờ tăng giá (Bull Flag)**: Bứt phá kênh tích lũy hẹp, nhịp kiểm định dời SL và chạm đích +2.8R.
- **[ĐÃ VIẾT - Mạch 1185]** **Mô hình Hai đáy (Double Bottom) thất bại**: Bẫy phân kỳ ngược xu hướng, nến đỏ đảo chiều nhấn chìm và bài học kỷ luật cắt lỗ -1R. `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1198]** **Mô hình Cốc tay cầm (Cup and Handle)**: Giải mã cấu trúc gom hàng kinh điển của William O'Neil, bài toán rũ bỏ thanh khoản và chiếc bẫy cốc chữ V (Đáy U cạn kiệt Volume, tay cầm dốc xuống 8-12%, điểm mua Pivot Point bùng nổ khối lượng và kỷ luật cắt lỗ 7-8%). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1199]** **Mô hình Tam giác đối xứng (Symmetrical Triangle)**: Bắt nhịp bứt phá thuận xu hướng, kỹ thuật kiểm định cạnh nén và tối ưu tỷ lệ R:R 1:2.8 (Trạng thái nén Volatility Squeeze, co hẹp thanh khoản, Entry 42.50, SL 40.80, TP 47.30 và quy tắc dời Breakeven +1.5R). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1211]** **Mô hình Vai Đầu Vai Ngược (Inverse Head and Shoulders) thất bại**: Chiếc bẫy bứt phá đường viền cổ và bài học kỷ luật cắt lỗ -1R (Cú bứt phá Neckline 42.00 thiếu Volume tổ chức, nến đỏ Bearish Engulfing nuốt chửng, kích hoạt SL dứt khoát 39.50 -1R, thoát đợt bán tháo tuyết lở -20% về đáy 33.00). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1231]** **Mô hình Kênh giá dốc xuống (Falling Channel)**: Bắt nhịp bứt phá kênh tích lũy trung hạn, nến Pin Bar kiểm định cạnh trên (Throwback), kỹ thuật dời Stop Loss về hòa vốn tại +1.5R và tối ưu tỷ lệ Risk/Reward đạt 1:3.2 (+3.2R). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1248]** **Phương pháp Volume Spread Analysis (VSA)**: Đọc mối tương quan giữa biên độ nến và khối lượng giao dịch (Tom Williams, nguyên lý Nỗ lực vs Kết quả, 4 thanh nến kinh điển: No Supply, No Demand, Stopping Volume, Upthrust, quy tắc thanh nến xác nhận Confirmation Bar và kỷ luật đóng khung rủi ro Stop Loss). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1249]** **Mô hình Hai đỉnh (Double Top) thất bại**: Bẫy ép bán tại đường viền cổ và bài học kỷ luật cắt lỗ -1R (Entry Bán 41.8 sau khi đâm thủng Neckline 43.0, nến xanh nuốt chửng đảo chiều phá vỡ cấu trúc giảm, kích hoạt Stop Loss dứt khoát 44.5 -1R, thoát đợt Short Squeeze tăng thốc lên 52.5 cứu tài khoản khỏi khoản lỗ -4.0R). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1261]** **Chỉ báo On-Balance Volume (OBV)**: Dòng tiền dẫn dắt đường giá, nghệ thuật đọc sớm phân kỳ tích lũy và cạm bẫy méo mó khối lượng (Joseph Granville 1963, Volume precedes price, tính toán tích lũy theo Close, phân kỳ dương tích lũy vs phân kỳ âm phân phối, bứt phá đường xu hướng OBV trước giá và 2 cạm bẫy phiên đột biến / tắt thanh khoản). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1262]** **Mô hình Cờ đuôi nheo tăng giá (Bullish Pennant)**: Bắt nhịp bùng nổ tiếp diễn xu hướng và tối ưu tỷ lệ Risk/Reward đạt 1:3.0 (+3.0R) (Cán cờ tăng tốc dốc đứng, thân cờ tam giác co thắt thanh khoản cạn kiệt, bứt phá cạnh trên, kiên nhẫn đợi Pin Bar Retest Entry 46.80, SL 45.00 -1R, dời hòa vốn tại +1.5R và chốt lời mục tiêu 52.20 +3.0R). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1282]** **Mô hình Tam giác tăng giá (Ascending Triangle) thất bại**: Bẫy bứt phá kháng cự ngang (Bull Trap), nến đảo chiều nuốt chửng và bài học kỷ luật cắt lỗ -1R. `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1274]** **Phương pháp 4 giai đoạn của Stan Weinstein**: Nhận diện cổ phiếu dẫn dắt qua đường MA 30 tuần và sức mạnh tương đối RS.
- **[ĐÃ VIẾT - Mạch 1288]** **Chỉ báo Bollinger Bands**: Co thắt nút cổ chai (The Squeeze), bùng nổ biến động và cạm bẫy 'đi bộ trên dải băng' (Walking the Bands). `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1297]** **Mô hình VCP (Volatility Contraction Pattern)**: Bắt nhịp bứt phá sau chuỗi nén biên độ và tối ưu tỷ lệ Risk/Reward 1:3.0. `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1085]** **Phương pháp thất bại**: LTCM, và các hệ thống từng được ca ngợi rồi biến mất.
- **[ĐÃ VIẾT - Mạch 1109]** **Barings Bank**: Nick Leeson và tài khoản giấu lỗ 88888.
- **Cấu trúc Tích lũy Wyckoff và cú rũ bỏ cuối cùng (Spring & Test)**: Nhận diện 5 pha từ Pha A (Chặn đà giảm SC, AR) đến Pha C (Cú nhúng thủng đáy hỗ trợ Spring để quét sạch lệnh Stop Loss của đám đông nhỏ lẻ), cách chờ nến rút chân khối lượng thấp xác nhận và mở vị thế với tỷ lệ Risk/Reward đạt 1:3.5. `quan-tri-von`
- **Cấu trúc Phân phối Wyckoff và tín hiệu bứt phá giả vùng đỉnh (UTAD - Upthrust After Distribution)**: Cách dòng tiền lớn tạo lập phiên vượt đỉnh lịch sử đầy hưng phấn để thu hút lực mua FOMO cuối cùng trước khi đóng cửa bằng thanh nến giảm biên độ rộng đánh thủng vùng kháng cự vừa vượt, kích hoạt kỷ luật cắt lỗ -1R bảo vệ vốn. `quan-tri-von`
- **Chiến lược giao dịch Pullback về đường EMA 21 trong xu hướng tăng mạnh**: Thay vì mua đuổi ở những phiên tăng nóng vượt xa đường trung bình, kiên nhẫn chờ nhịp điều chỉnh tự nhiên 3–5 phiên với thanh khoản thu hẹp về chạm dải EMA 21 ngày, xuất hiện nến Pin Bar rút chân hoặc Bullish Engulfing để vào lệnh tối ưu R:R 1:3.0. `quan-tri-von`
- **Mô hình Ba nền giá phẳng chồng lên nhau (Three Tight Closes / Flat Base)**: Hiện tượng giá đóng cửa của 3 tuần liên tiếp chênh lệch nhau chưa tới 1–1,5% kèm khối lượng cạn kiệt dưới đường trung bình 50 phiên — dấu hiệu các tổ chức đang thu gom kiểm soát hoàn toàn nguồn cung trước nhịp bứt phá mở rộng xu hướng. `quan-tri-von`
- **Mô hình Phá vỡ đáy giả và cú đảo chiều rút chân (Bear Trap / Wyckoff Spring thực chiến)**: Kịch bản cổ phiếu đâm thủng ngưỡng hỗ trợ ngang quan trọng khiến đám đông bán tháo cắt lỗ, nhưng ngay phiên hôm sau xuất hiện thanh nến xanh biên độ lớn kèm khối lượng gấp 2 lần trung bình lấy lại toàn bộ vùng nền, mở ra điểm mua đảo chiều với mức dừng lỗ rất ngắn ngay dưới râu nến thấp nhất. `quan-tri-von`
- **Hệ thống Ichimoku Kinko Hyo: Sự đồng thuận của Mây Kumo, đường Tenkan-sen và Kijun-sen**: Nguyên lý "Cái nhìn cân bằng trong nháy mắt" của nhà báo Goichi Hosoda (1969), cách phân biệt cú vượt mây Kumo mỏng so với vùng mây phẳng hút giá (Kijun-sen / Senkou Span B phẳng) và quy tắc quản trị lệnh theo đường Kijun-sen. `quan-tri-von`
- **Chỉ báo Average True Range (ATR) và kỹ thuật đặt điểm dừng lỗ theo độ biến động (Volatility Stop / Chandelier Exit)**: Công thức đo lường biên độ dao động thực tế của J. Welles Wilder, vì sao đặt Stop Loss cố định theo phần trăm (ví dụ 5%) dễ bị quét oan ở cổ phiếu beta cao, và cách dùng khoảng cách $2 \times \text{ATR}$ để cho vị thế không gian thở hợp lý. `quan-tri-von`

## J. Hồ sơ nhân vật & Huyền thoại đầu cơ lịch sử

`sub` = `quan-tri-von` hoặc `tam-ly-giao-dich` · `loai` = **`Hồ sơ`** hoặc **`Nhân vật`**.

- **[ĐÃ VIẾT - Mạch 1173]** **Volkswagen Short Squeeze 2008**: Cú kẹp lịch sử biến Porsche thành thế lực thâu tóm, bẫy toán học 94.3% cổ phần khóa và bài học lỗ vô hạn khi bán khống. `quan-tri-von`
- **[ĐÃ VIẾT - Mạch 1244]** **George Soros và Thứ Tư Đen Tối 1992**: Canh bạc 10 tỷ USD đánh sập Ngân hàng Trung ương Anh — cơ chế tỷ giá ERM, chênh lệch lãi suất Bundesbank, nguyên lý bất đối xứng và bản án đối với sự kiêu ngạo của ý chí chính trị trước quy luật thị trường. `quan-tri-von`

- **[ĐÃ VIẾT - Mạch 1132]** **Archegos Capital & Bill Hwang**: Vụ sụp đổ 2021 làm bốc hơi 30 tỷ USD trong 48 giờ — đòn bẩy ngầm Total Return Swap (TRS), bẫy đa ngân hàng và thế tiến thoái lưỡng nan của tù nhân (Prisoner's Dilemma) trên phố Wall.
- **[ĐÃ VIẾT - Mạch 1089]** **Jesse Livermore**: "Con gấu vĩ đại phố Wall" — từ cậu bé ghi bảng bucket shop đến tài sản 100 triệu USD năm 1929, hệ thống điểm xoay (Pivotal Points), 4 lần phá sản làm lại từ đầu và hồi kết bi kịch khi phá vỡ kỷ luật.
- **[ĐÃ VIẾT - Mạch 1121]** **Nicolas Darvas**: Vũ công kiếm 2.000.000 USD từ chứng khoán — phát minh lý thuyết Hộp (Darvas Box), cách quản trị lệnh dời stop-loss tự động và nghệ thuật cách ly hoàn toàn với tiếng ồn phố Wall.
- **[ĐÃ VIẾT - Mạch 1195]** **Ed Seykota**: Người tiên phong mang máy tính vào phân tích kỹ thuật — hệ thống theo xu hướng thuần túy và triết lý tâm lý học sâu sắc: "Dù thắng hay thua, ai cũng nhận được từ thị trường chính xác thứ họ muốn" (IBM 360 thẻ đục lỗ, tài khoản 5.000$ lên 15M$, 3 quy tắc cắt lỗ sống còn, mỏ neo rủi ro 1% và cạm bẫy tiềm thức). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1227]** **Paul Tudor Jones**: Huyền thoại bán khống Black Monday 1987 nhân ba tài khoản — nguyên tắc phòng thủ rủi ro bất đối xứng 5:1 và đường MA 200 ngày bảo vệ vốn (Đọc sách *Market Wizards* của Jack Schwager). `tam-ly-giao-dich`
- **[ĐÃ VIẾT - Mạch 1264]** **Bernard Baruch**: Nhà đầu cơ vượt qua Đại suy thoái 1929 — nghệ thuật biết điểm dừng, tín hiệu cậu bé đánh giày và nguyên tắc "không bao giờ cố mua ở đáy và bán ở đỉnh".
- **[ĐÃ VIẾT - Mạch 1284]** **Hetty Green**: "Phù thủy phố Wall" — người phụ nữ giàu nhất thời kỳ Gilded Age với triết lý đầu tư giá trị cực đoan, kỷ luật tiền mặt tàn nhẫn và khả năng giải cứu thị trường trong khủng hoảng.
- **Jim Simons & Quỹ Medallion**: Bậc thầy toán học mở ra kỷ nguyên định lượng (Quant trading) — nhận diện các bất thường vi mô thống kê và cuộc cách mạng loại bỏ cảm xúc con người khỏi giao dịch.
- **Quỹ Amaranth Advisors và cú đặt cược khí đốt làm bốc hơi 6,6 tỷ USD trong 1 tuần (2006)**: Ngôi sao giao dịch 32 tuổi Brian Hunter tại Calgary đã ôm trọn hơn 50% hợp đồng tương lai khí đốt tự nhiên của sàn NYMEX để đánh cược chênh lệch giá mùa đông - mùa xuân (Widowmaker spread); khi thời tiết ấm áp bất thường và thanh khoản đóng băng, quỹ phòng hộ 9 tỷ USD sụp đổ nhanh nhất lịch sử thời bấy giờ. `quan-tri-von`
- **Yasuo Hamanaka ("Ông Năm phần trăm") và vụ thao túng thị trường Đồng toàn cầu trị giá 2,6 tỷ USD tại Sumitomo (1996)**: Suốt 10 năm liền, trưởng bộ phận giao dịch kim loại của tập đoàn Sumitomo đã âm thầm kiểm soát 5% nguồn cung đồng vật chất thế giới trên sàn LME London, dùng các giao dịch khống để bóp nghẹt người bán khống trước khi gục ngã trước làn sóng cung đồng mới từ các mỏ khai khoáng. `quan-tri-von`
- **Stanley Druckenmiller: Nghệ thuật dồn tỷ trọng lớn khi xác suất nghiêng hẳn về một phía và kỷ lục 30 năm không một năm thua lỗ**: Cánh tay phải của George Soros trong thương vụ bán khống bảng Anh 1992, đạt tỷ suất sinh lời trung bình 30%/năm tại quỹ Duquesne Capital suốt ba thập kỷ và bài học xương máu khi ông tự thú nhận mình đã đu đỉnh bong bóng Dot-com tháng 3/2000 chỉ vì không kìm nén được cảm xúc FOMO. `tam-ly-giao-dich`
- **Edward O. Thorp: Từ nhà toán học đánh bại sòng bài Las Vegas đến cha đẻ của quỹ đầu tư định lượng đầu tiên trên thế giới**: Tác giả cuốn sách *Beat the Dealer* (1962) phát minh hệ thống đếm bài Blackjack và máy tính đeo người đầu tiên cùng Claude Shannon, trước khi mang công thức Kelly và định giá quyền chọn lên Phố Wall với quỹ Princeton Newport Partners đạt lợi nhuận 19,1%/năm suốt 19 năm. `quan-tri-von`
- **Anh em tỷ phú nhà Hunt và Thứ Năm Bạc (Silver Thursday 1980)**: Nỗ lực gom vét hơn 200 triệu ounce bạc vật chất và hợp đồng tương lai (chiếm 1/3 nguồn cung thế giới ngoài chính phủ) đẩy giá bạc từ 6 USD lên 50 USD/ounce, cho đến khi sàn COMEX ban hành quy định "Liquidation Only" cấm mở lệnh mua mới và nâng ký quỹ khiến đế chế dầu mỏ Texas phá sản. `quan-tri-von`

## K. Đánh giá Cổ phiếu & Cấu trúc Doanh nghiệp cụ thể

`sub` = `chung-khoan` · `loai` = **`Phân tích`** (hoặc **`Ngành`** nếu lồng ghép chuỗi giá trị).

### ⚠ Quy tắc nhịp độ (Pacing) bất di bất dịch:
- **KHÔNG VIẾT 2 MÃ CỔ PHIẾU LIÊN TIẾP:** Tuyệt đối không đăng 2 bài phân tích mã cổ phiếu trong 2 ngày/lượt liên tiếp.
- **Giãn cách 3–5 ngày:** Phân tích cổ phiếu chỉ là gia vị bổ trợ (chiếm ~20% số lượng bài phân tích 10:15). Sau khi đã viết 1 bài về một mã, bắt buộc phải nghỉ ít nhất 3 đến 5 ngày (chuyển sang phân tích vĩ mô, chuỗi giá trị, cơ cấu ngành) rồi mới đến mã tiếp theo.
- **Không vội vàng:** Giữ nhịp độ điềm tĩnh, thong thả, tập trung vào chiều sâu học thuật thay vì chạy theo sự kiện giá cổ phiếu hàng ngày.

### Nguyên tắc nội dung:
1. **KHÔNG HÔ HÀO / BƠM THỔI:** Tuyệt đối không dùng từ ngữ cảm tính, giật gân ("siêu cổ phiếu", "múc", "xúc", "sóng thần", "kỳ lân"). Giữ giọng văn phân tích tài chính khách quan, trung lập, thuần túy mổ xẻ dữ liệu và sự thật vận hành.
2. **KHÔNG KHUYẾN NGHỊ MUA / BÁN:** Không đưa ra giá mục tiêu (Target Price), không khuyến nghị hành động mua/bán/nắm giữ, không phím điểm cắt lỗ/chốt lời. Mọi nhận định kết luận phải để người đọc tự quyết định.
3. **MỔ XẺ HAI MẶT (Luận điểm & Thách thức):** Bắt buộc phải có phần làm rõ rủi ro tiềm ẩn, góc khuất bảng cân đối, điểm nghẽn chu kỳ hoặc rủi ro quản trị.
4. **TRỤ CỘT NỘI DUNG:**
   - **Mô hình kinh doanh & Lợi thế cạnh tranh cốt lõi (Moat):** Doanh nghiệp kiếm tiền từ đâu, lợi thế quy mô chi phí thấp / độc quyền tự nhiên / hiệu ứng mạng lưới / tài sản vô hình.
   - **Cơ cấu doanh thu & biên lợi nhuận:** Phân tích cơ cấu từng mảng kinh doanh, xu hướng biên lãi gộp và biên lãi ròng.
   - **Chất lượng tài sản & dòng tiền:** Dòng tiền hoạt động kinh doanh (CFO) so với lợi nhuận ròng, dòng tiền tự do (FCF), áp lực nợ vay, chi phí lãi vay và vòng quay vốn lưu động.
   - **Định giá trong bối cảnh lịch sử:** P/E, P/B, EV/EBITDA hiện tại đặt cạnh chu kỳ trung bình 5–10 năm của chính doanh nghiệp và các giai đoạn biến động tương đương trong quá khứ.


### Kho doanh nghiệp / cổ phiếu phân tích điển hình:
- **HPG (Hòa Phát):** Lợi thế chi phí thấp vượt trội từ quy mô lò cao BOF khép kín, bài toán đại dự án Dung Quất 2 thâm nhập mảng thép HRC chất lượng cao và chu kỳ giá than/quặng toàn cầu.
- **FPT:** Cơ cấu doanh thu chuyển đổi số thị trường Nhật/Mỹ, biên lợi nhuận gia công phần mềm so với mảng viễn thông & giáo dục, rủi ro tự động hóa/AI.
- **MWG (Thế Giới Di Động):** Điểm hòa vốn và cơ cấu chi phí chuỗi Bách Hóa Xanh, rủi ro bão hòa thị trường ICT (Điện Máy Xanh/TGDD) và bài toán quản trị tồn kho.
- **VHM (Vinhomes):** Năng lực bán buôn dự án đại đô thị, cơ cấu tiền mặt, rủi ro bảo lãnh nợ trong hệ sinh thái Vingroup và bài toán hấp thụ của thị trường BĐS.
- **[ĐÃ VIẾT - Mạch 1190]** **VCB (Vietcombank):** Bộ đệm vốn, tỷ lệ bao phủ nợ xấu (LLR) vượt trội, nguồn vốn CASA chi phí 0% từ khối doanh nghiệp FDI và giới hạn của tăng trưởng tín dụng.
- **[ĐÃ VIẾT - Mạch 1253]** **TCB (Techcombank):** Mô hình hệ sinh thái bất động sản - ngân hàng - chứng khoán, sự phụ thuộc vào dòng vốn trái phiếu/tín dụng doanh nghiệp và bài toán đa dạng hóa danh mục.
- **[ĐÃ VIẾT - Mạch 1272]** **VNM (Vinamilk):** Dòng tiền dồi dào với tỷ lệ cổ tức cao, nhưng đối mặt với bài toán bão hòa ngành sữa Việt Nam và nỗ lực tìm kiếm động lực tăng trưởng mới.
- **[ĐÃ VIẾT - Mạch 1134]** **DGC (Hóa chất Đức Giang):** Lợi thế nguồn quặng Apatit giá rẻ, vị thế độc quyền photpho vàng (P4) trong chuỗi bán dẫn thế giới và rủi ro từ quy định bảo vệ môi trường / tiến độ dự án Nghi Sơn.
- **[ĐÃ VIẾT - Mạch 1242]** **GMD (Gemadept):** Cảng nước sâu Gemalink, vị thế đón đầu tàu mẹ siêu trọng tải và cơ cấu chi phí tài chính sau khi thoái vốn cảng Nam Hải Đình Vũ (liên doanh CMA CGM 35%, biên lãi gộp 40-45% mảng cảng, dòng tiền CFO 1.200-1.500 tỷ/năm, nợ ròng/CSH về 0, áp lực CAPEX Gemalink 2 & NĐV 3). `chung-khoan`
- **[ĐÃ VIẾT - Mạch 1163]** **REE (Cơ điện Lạnh):** Cổ tức phòng thủ vững chắc từ mảng hạ tầng tiện ích (Điện - Nước - Văn phòng eTown) và bài toán chuyển giao thế hệ.
- **[ĐÃ VIẾT - Mạch 1212]** **PNJ (Vàng bạc Đá quý Phú Nhuận):** Sự dịch chuyển từ vàng miếng sang trang sức bán lẻ, năng lực quản trị chuỗi cung ứng, cú sốc trích lập 7.000 tỷ kim cương và bài toán tái sinh sau thanh tra. `chung-khoan`
- **CTR (Viettel Construction):** Hệ sinh thái hạ tầng viễn thông TowerCo, cơ hội từ làn sóng 5G và bài toán mở rộng sang mảng xây dựng dân dụng.
- **MSN (Masan Group):** Chiến lược "Point of Life", gánh nặng chi phí lãi vay từ các thương vụ M&A đòn bẩy cao và bài toán tối ưu hóa chuỗi WinCommerce.
- **PVS (Dịch vụ Kỹ thuật Dầu khí):** Sự chuyển dịch từ nhà thầu dầu khí truyền thống sang xây lắp điện gió ngoài khơi quốc tế, khối lượng backlog hợp đồng và biên lợi nhuận các dự án EPCI.

## L. Hỏi đáp & Cắt nghĩa Cơ chế thị trường (Nhập môn thực chiến)

`sub` = `hoi-dap` · `loai` = **`Hỏi đáp`** hoặc **`Cơ chế`**.

- **[ĐÃ VIẾT - Mạch 1137]** **Spread là gì?**: Chi phí vô hình, cạm bẫy trượt giá (Slippage) và cơ chế Bid - Ask cho người mới.
- **[ĐÃ VIẾT - Mạch 1142]** **Ngày giao dịch không hưởng quyền (GDKHQ)**: Vì sao giá cổ phiếu bị điều chỉnh kỹ thuật giảm xuống tương ứng khi chia cổ tức tiền mặt hoặc cổ phiếu thưởng?
- **[ĐÃ VIẾT - Mạch 1191]** **Quyền mua cổ phiếu phát hành thêm**: Giá phát hành ưu đãi 10.000 đ, công thức điều chỉnh giá ngày GDKHQ, rủi ro chôn vốn 2-3 tháng và kỹ thuật chuyển nhượng quyền mua tránh mất trắng. `hoi-dap`
- **[ĐÃ VIẾT - Mạch 1176]** **Chu kỳ thanh toán T+2.5**: Cơ chế vận hành dòng tiền tại VSDC, vì sao bán thứ Sáu thì thứ Ba tiền mới về và cái bẫy phí ứng trước UTTB. `hoi-dap`
- **[ĐÃ VIẾT - Mạch 1159]** **Khớp lệnh định kỳ ATO và ATC**: Thuật toán xác định mức giá có khối lượng khớp lớn nhất và cách dòng tiền lớn tận dụng 15 phút quyết định.
- **[ĐÃ VIẾT - Mạch 1216]** **Tính đúng mọi chi phí thực tế khi giao dịch**: Phí môi giới 2 chiều, thuế TNCN 0,1% giá trị bán, phí lưu ký VSDC, cạm bẫy lãi vay Margin và chiếc máy bào 15-25% NAV khi lướt sóng liên tục. `hoi-dap`

- **[ĐÃ VIẾT - Mạch 1169]** **Cơ chế Call Margin và Force Sell**: Tỷ lệ an toàn (Rtt), cảnh báo ký quỹ và quy trình bán giải chấp của các công ty chứng khoán.
- **[ĐÃ VIẾT - Mạch 1204]** **Các loại lệnh thực chiến**: Khi nào nên dùng lệnh LO, MP, MTL, MOK, MAK và cạm bẫy trượt giá ở các cổ phiếu thanh khoản thấp (Cơ chế quét nhiều tầng giá của MP, 3 biến thể trên HNX, rủi ro Unfilled vs rủi ro Slippage). `hoi-dap`
- **[ĐÃ VIẾT - Mạch 1223]** **Phái sinh VN30 và độ lệch Basis**: Bản chất hợp đồng tương lai, cơ chế ký quỹ và vì sao Basis luôn co về 0 ngày đáo hạn? (Hệ số nhân 100k, tỷ lệ ký quỹ IM 17-18% đòn bẩy 5-6 lần, ý nghĩa Basis Contango vs Backwardation, cơ chế thanh toán tiền mặt Settlement Price bình quân 30 phút cuối ngày đáo hạn, chiến lược Basis Arbitrage và bẫy co giật ATC). `hoi-dap`
- **[ĐÃ VIẾT - Mạch 1239]** **Lệnh điều kiện trong thực chiến**: Cơ chế Stop Order, bẫy trượt giá và vì sao lệnh cắt lỗ tự động vẫn có thể không khớp? (Trigger Price vs Limit Price trên server CTCK, phân biệt Stop-Market quét thanh khoản vs Stop-Limit rủi ro trôi lệnh, Trailing Stop khóa lãi, bẫy Gap ATO/ATC, trắng bên mua múa bên trăng và bẫy Stop Hunt quét râu nến). `hoi-dap`
- **[ĐÃ VIẾT - Mạch 1255]** **Độ sâu thị trường và sổ lệnh 3 bước giá**: Cơ chế hiển thị Top 3 bước giá mua/bán (Best Bids/Asks), quy định bước giá (Tick Size) HOSE/HNX, nhận diện chiêu trò kê lệnh - rút lệnh (Spoofing & Layering) và tầm quan trọng của nhật ký Time & Sales đối với người mới. `hoi-dap`
- **[ĐÃ VIẾT - Mạch 1266]** **Chứng quyền có bảo đảm (CW)**: Thị giá vài trăm đồng, đòn bẩy hấp dẫn và cạm bẫy mất trắng 100% vốn khi đáo hạn (Bản chất pháp lý CTCK phát hành, đòn bẩy hiệu dụng Effective Gearing 5-10x, toán học giá hòa vốn Break-even cao hơn 7-15% thị giá, hao mòn thời gian Theta phi tuyến 30-45 ngày cuối, cạm bẫy mất trắng OTM và cơ chế Delta Hedging của CTCK). `hoi-dap`
- **[ĐÃ VIẾT - Mạch 1273]** **Cổ phiếu bị cắt Margin**: Tiêu chí xét duyệt của Sở giao dịch, hiệu ứng hạ định giá về 0% và nguy cơ bán giải chấp chéo danh mục.
- **Cách đọc Bảng cân đối kế toán: Dấu hiệu nhận diện "Lợi nhuận thật, Tiền mặt giả" qua Khoản phải thu khách hàng**: Vì sao một doanh nghiệp báo lãi ròng tăng vọt hàng trăm tỷ đồng nhưng dòng tiền từ hoạt động kinh doanh (CFO) lại âm nặng kéo dài nhiều năm, và rủi ro hạch toán doanh thu ảo qua các công ty sân sau. `hoi-dap`
- **Cạm bẫy "Vốn hóa chi phí lãi vay" vào Chi phí xây dựng cơ bản dở dang trên Báo cáo tài chính**: Khi dự án bất động sản hoặc nhà máy mới đã ngừng thi công hoặc chậm tiến độ nhưng doanh nghiệp vẫn đưa hàng trăm tỷ tiền lãi vay ngân hàng vào giá trị tài sản thay vì ghi nhận vào chi phí tài chính trong kỳ để làm đẹp lợi nhuận. `hoi-dap`
- **Chia cổ tức bằng cổ phiếu, phát hành cổ phiếu thưởng và bản chất "xẻ chiếc bánh pizza thành nhiều lát nhỏ"**: Vì sao sau ngày giao dịch không hưởng quyền, tổng giá trị tài sản của nhà đầu tư không hề tăng thêm một đồng nào, nhưng nhà đầu tư lại phải chịu thêm thuế 5% khi bán phần cổ phiếu cổ tức được nhận. `hoi-dap`
- **Trái phiếu chuyển đổi (Convertible Bonds) là gì?**: Cơ chế lai ghép giữa trái phiếu hưởng lãi suất cố định thấp và quyền chọn chuyển đổi thành cổ phiếu phổ thông theo mức giá xác định trước; khi nào trái chủ chọn nhận tiền mặt khi đáo hạn và khi nào họ chọn chuyển đổi gây pha loãng cổ phiếu. `hoi-dap`
- **Cơ chế giao dịch Lô lẻ (Odd-lot từ 1 đến 99 cổ phiếu) trên sàn chứng khoán**: Vì sao bảng giá lô lẻ luôn khớp ở mức giá thấp hơn thị giá lô chẵn (100 cổ phiếu), nguyên nhân phát sinh cổ phiếu lẻ sau các đợt trả cổ tức bằng cổ phiếu và cách xử lý dứt điểm các khoản lẻ trong danh mục. `hoi-dap`
- **Chỉ số P/B (Price-to-Book) và vì sao định giá Ngân hàng, Chứng khoán luôn ưu tiên P/B hơn là P/E?**: Bản chất tài sản của các định chế tài chính là tiền tệ và giấy tờ có giá được đánh giá lại theo thị trường, mối quan hệ chặt chẽ giữa bộ đôi ROE - P/B và rủi ro khi mua cổ phiếu ngân hàng có P/B dưới 1.0 nhưng chất lượng tài sản ẩn chứa nợ xấu. `hoi-dap`

## M. Chuyên đề: Hồ sơ khủng hoảng — Vực dậy hay Gục ngã (Crisis & Turnaround)

`sub` = `chung-khoan` hoặc `vi-mo` · `loai` = **`Hồ sơ`**.

### ⚠ Quy tắc nhịp độ (Pacing) bất di bất dịch:
- **TUYỆT ĐỐI KHÔNG ĐĂNG LIÊN TỤC:** Không đăng các kỳ hồ sơ khủng hoảng dồn dập trong cùng một ngày hoặc hai ngày liên tiếp để tránh gây ngột ngạt và nhàm chán cho độc giả.
- **Giãn cách ít nhất 3 – 5 ngày:** Mỗi kỳ khủng hoảng phải cách nhau ít nhất 3 đến 5 ngày (tần suất khoảng 1–2 bài/tuần). Xen kẽ vào giữa phải là các chủ đề đa dạng khác: vĩ mô ngành, chuỗi giá trị, phân tích kỹ thuật, tâm lý giao dịch, crypto on-chain và đọc sách kinh điển.
- **Kỳ tiếp theo (Kỳ 3: TTF - Gỗ Trường Thành):** Sẽ xuất bản sau ít nhất 3–5 ngày nữa (dự kiến giữa/cuối tuần tới, sau ngày 07/10/2026).

### Danh mục các kỳ:
- **[ĐÃ VIẾT - Mạch 1212 - 03/10]** **Kỳ 1: PNJ (Vàng bạc Đá quý Phú Nhuận):** Cú sốc trích lập 7.000 tỷ rủi ro thu đổi kim cương, thanh tra liên ngành ngành vàng và bài toán tái sinh lần thứ hai sau biến cố DongABank 2015.
- **[ĐÃ VIẾT - Mạch 1214 - 03/10]** **Kỳ 2: HAGL (Hoàng Anh Gia Lai - Đoàn Nguyên Đức):** Khủng hoảng nợ 40.000 tỷ đồng, bài học cắt bỏ bất động sản, cao su, mía đường sang nuôi heo ăn chuối và sầu riêng: Nghệ thuật buông bỏ để tồn tại.
- **Kỳ 3: TTF (Gỗ Trường Thành):** Thảm họa hàng tồn kho bốc hơi 1.000 tỷ đồng của ông Võ Trường Thành, cuộc giải cứu bất thành của Tân Liên Phát và hành trình tái cấu trúc nhọc nhằn của Mai Hữu Tín.
- **Kỳ 4: HPG (Hòa Phát - Trần Đình Long):** Cơn khủng hoảng ngành thép lỗ kỷ lục quý 3/2022, đóng cửa 4 lò cao và sự trỗi dậy của đại dự án Dung Quất 2.
- **Kỳ 5: MSN (Masan Group - Nguyễn Đăng Quang):** Canh bạc thâu tóm VinCommerce (WinMart) gánh lỗ nghìn tỷ, áp lực nợ trái phiếu và chiến lược The CrownX tái định vị dòng tiền tiêu dùng.
- **Kỳ 6: CTD (Coteccons):** Cuộc chiến vương quyền đẫm máu giữa nhà sáng lập Nguyễn Bá Dương và nhóm cổ đông Kusto, sự ra đi của bộ sậu chủ chốt và hành trình tìm lại vị thế của Bolat Duisenov.
- **Kỳ 7: VNS (Ánh Dương Việt Nam - Vinasun):** Cuộc chiến sinh tử trước làn sóng công nghệ gọi xe Grab/Uber: Từ vị thế độc tôn đến thua lỗ liên tiếp và nỗ lực tái cơ cấu đội xe Hybrid.
