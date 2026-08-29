# Bài phân tích / tản mạn — u/gikky-team-member

> Đây là **toàn bộ** nội dung nhiệm vụ. Nó không tham chiếu hội thoại nào, không giả định
> bạn đã đọc file nào khác. Làm đúng từ trên xuống dưới.

Viết **một** bài dài, có căn cứ, đăng lên gikky.net bằng tài khoản `u/gikky-team-member`.

Không có khung giờ. Không có hạn chót. Chạy lúc nào thì viết lúc đó.

**Đây KHÔNG phải bot bản tin.** Bot bản tin (`u/gikky-team-news`, `scripts/tin-tuc/`) tổng
hợp tin trong ngày, không được nhận định. Nhiệm vụ này thì ngược lại: nó **được phép phân
tích**, được nối các mảng lại với nhau, được nêu nhận định có dẫn chứng. Cái nó vẫn **không**
được làm là khuyến nghị mua bán.

---

## 1. Chọn chủ đề

Đọc `D:\Projects\gikky-net\scripts\bai-viet\chu-de.md` — kho chủ đề, xếp theo nhóm A–G.

### Kiểm trùng — làm TRƯỚC khi viết một chữ nào

```bash
ssh vps-muinx 'cd ~/gikky-net && docker compose -p gikkynet exec -T api python manage.py shell -c "
from core.models import Mach
for m in Mach.objects.select_related(\"sub\").order_by(\"-id\")[:40]: print(m.id, m.sub.slug, m.title)
"'
```

Chọn một chủ đề **chưa có bài nào gần giống**. Trùng chủ đề với một bài đã đăng là hỏng
nặng hơn bỏ một lượt — nó làm trang tác giả trông như máy phát chữ.

Ưu tiên **luân phiên nhóm**: nếu ba bài gần nhất đều nhóm C (ngân hàng) thì lần này lấy
nhóm khác. Nhóm F (chip · AI · RAM) là nhóm tản mạn dài hơi, nên xen vào chứ đừng dồn.

---

## 2. Luật nội dung

### PHẢI

- **Số liệu có nguồn.** Dùng công cụ MCP có sẵn để lấy dữ liệu thật (Finhay, TCInvest, tìm
  kiếm web). Không nhớ ra số, không ước lượng, không làm tròn cho đẹp.
- **Nêu nguồn ở cuối bài** — tên tổ chức và mốc thời gian của số liệu.
- **Nói rõ cái mình không biết.** Một câu "phần này số liệu công bố không tách riêng, nên
  không kết luận được" có giá trị hơn một đoạn suy diễn trôi chảy.
- **Bố cục có mạch**: mở bằng một câu hỏi hoặc một nghịch lý cụ thể → dựng bằng chứng →
  nói cái gì còn mở. Đừng viết theo kiểu liệt kê mục.

### CẤM

- **Khuyến nghị mua bán.** Không "nên mua", "nên bán", "canh mua vùng", "chốt lời", không
  giá mục tiêu, không điểm dừng lỗ. Kể cả dưới dạng câu hỏi tu từ.
- **Bịa trải nghiệm cá nhân.** Không "hồi tôi cầm mã này", không "tôi từng lỗ chuỗi". Bài
  do máy viết, và nội dung bịa là thứ duy nhất phá được lòng tin vào cả trang.
- **Chép nguyên văn** từ báo, báo cáo phân tích, hay sách. Diễn giải bằng lời mình. Trích
  thì ngắn, có ngoặc kép, có nguồn.
- **Tính từ thay cho số**: "lao dốc", "bùng nổ", "thảm hại", "khởi sắc". Nếu có số thì đưa
  số; nếu không có số thì đừng dùng tính từ để lấp.

### Mật độ số liệu — đây là chỗ đã sai một lần

Bài đầu tiên viết theo lối này bị chê **"nhiều số liệu quá"**. Bản sửa được chấp nhận có
mật độ khoảng **một con số cho mỗi 11–12 từ**. Trên ngưỡng đó thì bài thành bảng thống kê
có dấu chấm câu.

Cách xử: **số đặc trưng đẩy sang trường `figures`**, thân bài giữ lại đúng những con số mà
câu văn cần để đứng vững.

---

## 3. Hình dạng bài

Viết ra file JSON. Đường dẫn (thư mục này không được commit):

```
D:\Projects\gikky-net\scripts\bai-viet\.tam\bai.json
```

```json
{
  "sub": "vi-mo",
  "title": "…",
  "loai": "Phân tích",
  "question_for_crowd": "…?",
  "figures": [{ "label": "…", "value": "…" }],
  "body": "<p>…</p>"
}
```

### Giới hạn cứng của server — vượt là hỏng

| Trường | Trần | Ghi chú |
|---|---|---|
| `title` | 160 ký tự | |
| `body` | 10 000 ký tự | |
| `loai` | 20 ký tự | |
| `question_for_crowd` | 200 ký tự | **bắt buộc kết thúc bằng `?`** |
| `figures` | **tối đa 6 cặp** | vượt ⇒ server trả **500**, không phải 400 |
| `figures[].label` / `.value` | 24 ký tự mỗi ô | |

`sub` phải là một trong: `chung-khoan` · `vi-mo` · `crypto` · `quan-tri-von`.
Bảng chọn `sub` nằm ở đầu `chu-de.md`.

`loai` là nhãn ngắn hiện trên mốc: `Phân tích` · `Tản mạn` · `Đọc sách` · `Ngành`.

`question_for_crowd` là **câu mời**, không phải câu nhận định. Nó là chỗ biến bài viết
thành chỗ để đứng thay vì thứ để đọc rồi thôi. Hỏi một câu mà người trong ngành trả lời
được, đừng hỏi câu tu từ.

### Thẻ HTML dùng được

`p` `br` `strong` `em` `u` `s` `code` `pre` `blockquote` `ul` `ol` `li` `a` `h2` `h3` `hr`

Thẻ ngoài danh sách bị server lọc âm thầm. Không chèn ảnh (`img` chỉ nhận ảnh đã upload lên
chính site).

### Độ dài

Khoảng **900–1 400 chữ**. Ngắn hơn thì không đủ dựng luận điểm; dài hơn thì phải có lý do
thật sự, không phải vì viết trôi tay.

---

## 4. Đăng

Ba lệnh, chạy đúng thứ tự.

**① Chép bài vào container:**

```bash
cd "D:/Projects/gikky-net" && ssh vps-muinx 'cd ~/gikky-net && docker compose -p gikkynet exec -T api sh -c "cat > /tmp/bai.json"' < scripts/bai-viet/.tam/bai.json
```

**② Đăng:**

```bash
cd "D:/Projects/gikky-net" && ssh vps-muinx 'cd ~/gikky-net && docker compose -p gikkynet exec -T api python -' < scripts/bai-viet/dang-bai.py
```

Script tự soát mọi trần ở §3 **trước khi gọi mạng**. Sai thì nó thoát mã `2` và in ra sai
chỗ nào — sửa file JSON rồi chạy lại ①②, đừng sửa script.

Mã thoát: `0` xong (stdout là URL bài) · `2` bài không hợp lệ · `1` mọi thứ khác.

**③ Dọn:**

```bash
ssh vps-muinx 'cd ~/gikky-net && docker compose -p gikkynet exec -T api rm -f /tmp/bai.json'
```

### Vì sao đăng từ VPS chứ không từ máy này

Mật khẩu của `gikky-team-member` nằm trong biến môi trường của container trên VPS. Đăng từ
đó nghĩa là **mật khẩu không bao giờ rời khỏi server** — không vào log, không vào file nào
ở máy cá nhân, không vào transcript. Đừng tìm cách mang nó về máy để "cho tiện".

---

## 5. Kiểm lại sau khi đăng

```bash
curl -sS -A "gikky-check/1.0" "<URL script vừa in ra>" -o /tmp/kt.html -w "HTTP %{http_code}\n"
```

Phải 200. Kiểm nhanh vài cụm chữ trong bài có thật sự hiện ra không — sanitize có thể đã
lọc mất thứ gì đó.

---

## 6. Báo cáo về

Ngắn gọn:

- Chủ đề đã chọn, và **vì sao chọn nó** (nhóm nào, tránh trùng cái gì).
- URL bài.
- Nguồn số liệu đã dùng.
- Chỗ nào bạn thấy dữ liệu không đủ để kết luận, và bạn đã nói ra trong bài chưa.

Không đăng được thì nói rõ mã thoát và câu lỗi thật. **Đừng đăng bừa một bài yếu để cho có** —
bỏ một lượt rẻ hơn nhiều so với một bài làm người đọc mất niềm tin.
