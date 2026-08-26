# Bản tin `truoc-phien-vn` — tin trong nước trước giờ mở cửa

> Đây là **toàn bộ** nội dung nhiệm vụ. Nó không tham chiếu hội thoại nào, không giả định
> bạn đã đọc file nào khác. Làm đúng từ trên xuống dưới.

## Khung giờ

| Mục | Giá trị |
|---|---|
| Chạy | **08:07 giờ Việt Nam**, thứ Hai → thứ Sáu |
| Sớm nhất | **06:30 giờ Việt Nam** (sớm hơn 06:30 thì báo trong nước chưa ra tin buổi sáng) |
| Hạn chót | **09:00 giờ Việt Nam** |
| Slot | `truoc-phien-vn` |

**Hạn chót nghĩa là gì:** thị trường chứng khoán Việt Nam mở phiên khớp lệnh định kỳ từ
09:00. Một bản tin "trước giờ mở cửa" đăng lúc 10:30 không còn là bản tin trước giờ mở
cửa. Nhiệm vụ này chỉ chạy khi ứng dụng đang mở; nếu nó chạy trễ, script tự bỏ qua và
thoát mã `4`. **Đó là kết quả đúng**, không phải sự cố.

**Chiều ngược lại cũng bị chặn:** nếu ứng dụng mở lại lúc nửa đêm và nhiệm vụ fire bù, script cũng từ chối vì **chưa tới 06:30 giờ VN** — cùng mã `4`. Lúc đó dữ liệu của khung này chưa tồn tại đầy đủ, và một bài đăng sớm còn chiếm mất chỗ của bản tin thật lát nữa (mỗi slot chỉ đăng một lần mỗi ngày). Đừng lách bằng `--ep`, `--som-nhat` hay `--han-chot`.

## Một mạch mỗi ngày, ba mốc — không phải ba bài rời

Ba khung giờ trong ngày ghi vào **cùng một mạch**:

| Giờ VN | Việc | Nhãn mốc (`loai`) |
|---|---|---|
| 06:12 | **tạo** mạch + mốc 1 | `Đêm qua` |
| 08:07 | **nối** mốc 2 | `Trước phiên VN` |
| 19:33 | **nối** mốc 3 | `Trước phiên Mỹ` |

Bạn **không phải chọn** tạo hay nối — script tự quyết bằng sổ cái của ngày. Việc của bạn
là viết nội dung và **luôn ghi đủ `sub` + `title`**.

Vì sao ba khung chung một mạch: ba bài rời phá mất thông tin *"tin ra lúc 06:15, thị
trường phản ứng thế nào lúc 08:11"* — thông tin ấy chỉ tồn tại khi chúng nằm chung một
dòng thời gian.

### ⚠ Vì sao khung này vẫn phải viết tiêu đề dù nó thường chỉ nối mốc

Nếu ứng dụng đóng lúc 06:12 thì khung `dem-qua` **không chạy**, và khung của bạn trở
thành khung **tạo** mạch của ngày. Lúc đó không có tiêu đề nào tồn tại ngoài tiêu đề bạn
viết — thiếu nó là ngày hôm đó không có bản tin nào.

Tiêu đề phải viết bằng **chất liệu của chính khung này** (tỷ giá, khối ngoại phiên trước,
VN-Index phiên trước), không neo vào số phiên đêm mà bạn có thể không có.

**Tiêu đề bị chốt vĩnh viễn lúc mạch được tạo.** API không có đường nào sửa. Nếu khung
`dem-qua` đã chạy bình thường thì tiêu đề bạn viết sẽ bị bỏ qua — đó là bình thường,
không phải lỗi.

## Luật tiêu đề

**Dạng:** `Bản tin <dd/mm> — <mệnh đề sự việc + số>`

**Ví dụ đúng:** `Bản tin 26/08 — tỷ giá trung tâm 24.250 đồng, khối ngoại bán ròng 312 tỷ`

- Phần sau gạch **chỉ được là sự việc và con số**.
- **CẤM** mọi tính từ đánh giá: *lao dốc, bùng nổ, ảm đạm, tích cực, tiêu cực, đáng lo,
  khởi sắc, bứt phá, thăng hoa, thảm hại, rực rỡ, u ám, hoảng loạn, đáng ngại, đáng mừng*.
  Script chặn tại chỗ và thoát mã `2`.
- **CẤM** dạng `Tổng hợp tin tức ngày …`. Script chặn, thoát mã `2`. Lý do: năm tiêu đề
  gần trùng nhau mỗi tuần thì mắt trượt qua cả năm, và thẻ tiêu đề trùng với hàng triệu
  trang khác nên vô giá trị với tìm kiếm.

## Ba trường đi kèm mốc

### `loai` — nhãn mốc (≤20 ký tự)

Khung này **luôn** ghi: `Trước phiên VN`

Đây là thứ duy nhất phân biệt ba mốc trên trang bài. Thiếu nó thì mạch là ba khối chữ
liền nhau.

### `figures` — dải số, 4–6 cặp

Cặp `{label, value}`, **tối đa 6 cặp**, **mỗi ô tối đa 24 ký tự**. Tách số ra khỏi thân bài để đọc lướt
được — đúng thứ một bản tin mang.

```json
"figures": [
  {"label": "VN-Index", "value": "1.284,3 (-0,6%)"},
  {"label": "Khối ngoại", "value": "-312 tỷ"},
  {"label": "Tỷ giá TT", "value": "24.250 đồng"},
  {"label": "Thanh khoản HOSE", "value": "18.400 tỷ"}
]
```

Chỉ đưa số **đã có trong thân bài và đã có link nguồn**. `figures` không phải chỗ thêm
số mới, vì nó không có chỗ để đặt link.

### `question_for_crowd` — câu mời (≤200 ký tự)

**Bắt buộc là câu HỎI, kết thúc bằng `?`.** Không có dấu hỏi thì script chặn, thoát mã `2`.

Hỏi thì không phải nhận định, nên trường này không phá luật "chỉ tổng hợp". Một câu mời
kết thúc bằng dấu chấm gần như luôn là một câu khẳng định trá hình — và nó nằm ngay dưới
bản tin, chỗ dễ đọc nhất.

Ví dụ đúng: `Trong bảng trên, con số nào đổi cách bạn đặt lệnh sáng nay?`

**CẤM** câu hỏi mời phán đoán — *"Bạn nghĩ VN-Index hôm nay về đâu?"* — đó là mời dự báo,
tức lách đúng cái luật vừa nêu bằng một dấu chấm hỏi.

## Việc phải làm

Tổng hợp tin **trong nước** người giao dịch cần biết trước 09:00, gồm:

- Chính sách và quy định: văn bản mới của Ngân hàng Nhà nước, Bộ Tài chính, Uỷ ban Chứng
  khoán Nhà nước, HOSE/HNX; nghị định, thông tư vừa ban hành hoặc có hiệu lực hôm nay.
- Doanh nghiệp niêm yết: công bố thông tin bất thường, kết quả kinh doanh, phát hành
  thêm, chia cổ tức, đăng ký giao dịch của cổ đông nội bộ, thay đổi lãnh đạo.
- Tỷ giá và lãi suất: tỷ giá trung tâm hôm nay, tỷ giá niêm yết ngân hàng, lãi suất liên
  ngân hàng, kết quả đấu thầu tín phiếu / thị trường mở.
- Khối ngoại **phiên trước**: mua ròng hay bán ròng bao nhiêu, trên sàn nào, top mã.
- Kết thúc phiên trước: VN-Index, VN30, HNX-Index, UPCoM — điểm số, thay đổi, thanh
  khoản.
- Lịch sự kiện **trong ngày hôm nay**: ngày giao dịch không hưởng quyền, đại hội cổ
  đông, hạn công bố báo cáo, số liệu vĩ mô sắp công bố.

### Nguồn gợi ý cho slot này

CafeF, VietstockFinance, Báo Đầu tư Chứng khoán (tinnhanhchungkhoan.vn), VnEconomy,
VnExpress mục Kinh doanh, Tuổi Trẻ mục Kinh doanh, cổng công bố thông tin của HOSE
(hsx.vn) và HNX (hnx.vn), Uỷ ban Chứng khoán Nhà nước (ssc.gov.vn), Ngân hàng Nhà nước
(sbv.gov.vn), Tổng cục Thống kê (gso.gov.vn).

Đây là **gợi ý**, không phải danh sách đóng. Nguồn nào cũng được miễn là dẫn được link
cụ thể tới bài/trang có con số đó. Với công bố thông tin doanh nghiệp, ưu tiên link
thẳng tới cổng HOSE/HNX thay vì bài báo viết lại.

## Luật nội dung — đọc kỹ, đây là phần hồn của việc

Giọng bài: **chỉ tổng hợp, không đánh giá.**

### PHẢI

- Mỗi mục = **chuyện gì · ai công bố · số liệu · lúc nào** + **link nguồn**.
- Viết bằng **tiếng Việt**. Tên riêng và thuật ngữ quốc tế giữ nguyên trong ngoặc khi
  cần.
- Số liệu chép **đúng nguồn**, kèm đơn vị và mốc so sánh mà **chính nguồn** đưa ra.
- **6–12 mục**, gom theo nhóm bằng thẻ `<h3>`.
- Cuối bài: một dòng ghi rõ đây là bản tin tổng hợp tự động + giờ chốt tin.

### CẤM — bản tin vi phạm thì BỎ, không đăng

- Nhận định, dự báo, khuyến nghị mua/bán, giá mục tiêu.
- Tính từ đánh giá: "tích cực", "đáng lo", "bùng nổ", "lao dốc" → thay bằng **số**.
- Suy diễn nhân quả **không có trong nguồn** (ví dụ "VN-Index giảm **do** Fed…").
- Số liệu **không có link nguồn**. Không tìm được nguồn thì **bỏ mục đó**, không ước
  lượng, không nhớ theo trí nhớ.
- Kèo, dự đoán, "sóng", "target", "canh mua vùng…" dưới mọi hình thức.

## Định dạng thân bài

`body` là **HTML đã lọc theo allowlist** của server. Thẻ dùng được:
`p br strong em u s code pre blockquote ul ol li a h2 h3 hr`.

- `<a href="...">` được phép với `http`, `https`, `mailto`. Server tự thêm
  `rel="nofollow ugc noopener"` và `target="_blank"` — bạn không cần và không nên tự đặt.
- **Không nhúng ảnh ngoài.** Thẻ `<img>` chỉ nhận ảnh đã upload lên chính site; mọi
  `<img>` trỏ ra ngoài bị gỡ sạch. Bản tin này là **chữ + link**.
- Mọi thuộc tính khác (`class`, `id`, `style`, `target`) bị gỡ. Đừng viết CSS.
- Ký tự `&`, `<`, `>` trong văn bản phải escape: `&amp;`, `&lt;`, `&gt;`.

Giới hạn cứng của server:

| Trường | Trần |
|---|---|
| `title` | **160** ký tự |
| `body` | **10.000** ký tự |
| `loai` | **20** ký tự |
| `question_for_crowd` | **200** ký tự |
| `figures` | **6** cặp — vượt là server trả **500**, không phải lỗi đọc được |
| `figures[].label` và `.value` | **24** ký tự mỗi ô |

## Cách đăng

### Bước 1 — ghi file JSON

Ghi ra một file JSON (UTF-8) với đúng sáu trường dưới đây:

```json
{
  "sub": "tin-tuc",
  "title": "Bản tin 26/08 — tỷ giá trung tâm 24.250 đồng, khối ngoại bán ròng 312 tỷ",
  "body": "<h3>Chính sách</h3><p>…</p>",
  "loai": "Trước phiên VN",
  "figures": [
    {"label": "VN-Index", "value": "1.284,3 (-0,6%)"},
    {"label": "Khối ngoại", "value": "-312 tỷ"},
    {"label": "Tỷ giá TT", "value": "24.250 đồng"},
    {"label": "Thanh khoản HOSE", "value": "18.400 tỷ"}
  ],
  "question_for_crowd": "Trong bảng trên, con số nào đổi cách bạn đặt lệnh sáng nay?"
}
```

- `sub` **luôn** là `tin-tuc`. Không đổi.
- `title` theo đúng luật tiêu đề ở trên. **Luôn ghi**, kể cả khi lượt này chỉ nối mốc —
  xem khối cảnh báo ở mục "Một mạch mỗi ngày".
- `loai` của khung này **luôn** là `Trước phiên VN`.
- Không thêm trường nào khác — script từ chối trường lạ (thoát mã `2`).

Đường dẫn gợi ý cho file tạm:

```
D:\Projects\gikky-net\scripts\tin-tuc\.tam\truoc-phien-vn.json
```

### Bước 2 — chạy lệnh

Chạy **đúng** dòng này, thay `<ĐƯỜNG-DẪN-JSON>` bằng đường dẫn file vừa ghi:

```
node D:\Projects\gikky-net\scripts\dang-tin.mjs --file "<ĐƯỜNG-DẪN-JSON>" --slot truoc-phien-vn
```

Muốn soát trước mà **không** đăng thì thêm `--thu`:

```
node D:\Projects\gikky-net\scripts\dang-tin.mjs --file "<ĐƯỜNG-DẪN-JSON>" --slot truoc-phien-vn --thu
```

### Bước 3 — đọc mã thoát

| Mã | Nghĩa | Phải làm gì |
|---|---|---|
| `0` | Xong. stdout in URL mạch; nếu là lượt **nối** thì có thêm dòng `mốc N · …`. | Báo lại URL đó. |
| `2` | Thân bài không hợp lệ (quá dài, thiếu trường, trường lạ, tiêu đề phạm luật, câu mời không có `?`). Chưa gọi mạng. | Sửa JSON theo câu lỗi rồi chạy lại. |
| `3` | Slot `truoc-phien-vn` đã ghi trong ngày hôm nay rồi. | **Dừng.** Không chạy nữa. Đây là hành vi đúng. |
| `4` | Ngoài khung 06:30–09:00 giờ VN — quá muộn **hoặc** quá sớm. | **Dừng.** Bỏ bản tin hôm nay. Đây là hành vi đúng, không phải sự cố. |
| `5` | Mạch của hôm nay **có** nhưng không nối vào được: mod đã khoá, mạch **bị ẩn hoặc bị xoá**, mạch đã đóng sổ, hoặc đã đủ 3 mốc. | **Dừng.** Báo lại nguyên văn stderr — nó in sẵn cách xử lý. ⚠ `--ep` **KHÔNG** cứu được ca này. Đây **không** phải lỗi code. |
| `1` | Lỗi khác: sai cấu hình, mạng chết, server trả `400`/`422` vì thân bài sai. | Đọc stderr, báo lại nguyên văn. **Không** thử lại vòng lặp. |

## Ba điều tuyệt đối không làm

1. **Không** dùng `--ep`. Cờ đó bỏ qua hàng rào chống trùng, chỉ dành cho người chạy
   tay khi cố ý muốn ghi thêm một mốc nữa cho khung này. Nó **không** tạo mạch thứ hai:
   mạch của ngày đã có thì mốc mới nối vào chính nó.
2. **Không** đăng khi có mục nào thiếu link nguồn. Thà bản tin 6 mục còn hơn 10 mục có
   2 mục bịa.
3. **Không** viết bất kỳ câu nào mang tính khuyến nghị đầu tư, kể cả câu "chỉ là quan
   sát cá nhân".
