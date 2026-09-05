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

### Hai nhóm có NHỊP RIÊNG — kiểm trước khi chọn theo luân phiên

Chốt 03/09/2026. Hai nhóm dưới đây **không chờ tới lượt** trong vòng luân phiên; chúng có
hạn riêng, và hạn đó **thắng** mọi ưu tiên khác.

| Nhóm | `loai` | Đủ điều kiện | BẮT BUỘC |
|---|---|---|---|
| **H · Tâm lý và kỷ luật** | `Tâm lý` hoặc `Đọc sách` | ≥ **3** ngày kể từ bài gần nhất | ≥ **5** ngày |
| **I · Phương pháp giao dịch** | `Phương pháp` | ≥ **5** ngày | ≥ **7** ngày |

**Đọc bảng này thế nào.** Chưa tới mốc "đủ điều kiện" ⇒ chọn bình thường theo luân phiên.
Qua mốc "đủ điều kiện" ⇒ được phép chọn nhóm đó nếu có chủ đề hay. Qua mốc **BẮT BUỘC** ⇒
**phải** viết nhóm đó lượt này, kể cả khi đang có chủ đề khác hấp dẫn hơn. Hai mốc tạo ra
một dải chứ không phải một con số cố định — đó chính là nhịp *"tầm 3–5 ngày"* và
*"tầm 5–7 ngày"*, và nó tự giãn ra khi có bài quan trọng chen vào.

Cả hai nhóm quá hạn cùng lúc ⇒ **Tâm lý trước** (nhịp ngắn hơn nên nợ dồn nhanh hơn).

**Lệnh đếm ngày** — chạy cùng lúc với kiểm trùng ở trên. Ghi script ra file rồi truyền vào,
đừng nhét Python nhiều tầng nháy vào một dòng `shell -c`:

```bash
cat > /tmp/dem-nhip.py <<'PY'
from core.models import Mach, Moc
from django.utils import timezone
now = timezone.now()
for ten, nhan in [("Tâm lý", ["Tâm lý", "Đọc sách"]), ("Phương pháp", ["Phương pháp"])]:
    ids = Moc.objects.filter(seq=1, loai__in=nhan, mach__hidden_at__isnull=True).values_list("mach_id", flat=True)
    m = Mach.objects.filter(id__in=list(ids)).order_by("-created_at").first()
    print(f"{ten}: {(now - m.created_at).days} ngày trước — {m.title[:50]}" if m else f"{ten}: CHƯA CÓ BÀI NÀO")
PY
ssh vps-muinx 'cd ~/gikky-net && docker compose -p gikkynet exec -T api python manage.py shell -i python' < /tmp/dem-nhip.py
```

`CHƯA CÓ BÀI NÀO` tính là **quá hạn**.

⚠ **Ghi đúng `loai`, nếu không nhịp tự hỏng.** Lệnh trên đếm bằng `loai`, nên một bài tâm
lý ghi nhầm `loai` là `Phân tích` sẽ vô hình với phép đếm — bot tưởng còn nợ và viết bài
tâm lý thứ hai ngay hôm sau. Đây là chỗ duy nhất nhịp có thể trôi.

## Bài phương pháp giao dịch — luật RIÊNG, chặt hơn mọi nhóm khác

Chỉ áp cho nhóm I. Đọc hết mục này trước khi viết một chữ.

**Vì sao phải có luật riêng.** Mọi phương pháp giao dịch đều gồm luật vào lệnh và ra lệnh.
Viết ra những luật đó rất dễ trượt thành khuyến nghị — thứ mà §2 của file này **CẤM tuyệt
đối**. Ranh giới nằm ở chỗ này:

- ✅ **Mô tả** phương pháp như một đối tượng có tác giả, có năm ra đời, có lịch sử:
  *"Donchian mua khi giá vượt đỉnh 20 phiên gần nhất"* — đang thuật lại luật của một hệ thống.
- ❌ **Kê đơn**: *"hãy mua khi giá vượt đỉnh 20 phiên"* — cùng một nội dung, khác ngôi, và
  vế sau là khuyến nghị.

Luật thực hành rút ra: **viết ở ngôi thứ ba, thì quá khứ hoặc hiện tại mô tả. Không bao giờ
dùng câu mệnh lệnh.** Không "hãy", không "nên", không "cần".

### PHẢI có trong mọi bài nhóm I

1. **Tác giả và năm.** Phương pháp không rõ ai nghĩ ra, năm nào ⇒ **không viết**. Đó gần
   như luôn là dấu hiệu của nội dung tiếp thị.
2. **Giả định về thị trường.** Mỗi phương pháp đều đặt cược vào một tính chất nào đó (xu
   hướng kéo dài, giá hồi về trung bình, biến động gom cụm). Nêu rõ nó.
3. **Giai đoạn phương pháp THUA.** Bắt buộc, không phải tuỳ chọn. Một bài chỉ kể lúc thắng
   là quảng cáo, dù không có câu nào mời mua.
4. **Chi phí vận hành**: phí, trượt giá, số lệnh mỗi năm, thời gian phải ngồi theo dõi.
5. **Câu kết đóng khung**: nói rõ đây là mô tả một phương pháp đã được công bố, không phải
   thứ để áp dụng, và kết quả quá khứ không nói gì về tương lai.

### CẤM — vi phạm thì BỎ bài, không đăng

- **Áp phương pháp vào thị trường hiện tại, hay nêu đích danh mã đang niêm yết.** Ví dụ
  minh hoạ phải là mẫu chung chung trong quá khứ — xem mục riêng ngay dưới.
- **Nhắc lại số liệu hiệu suất như thể là sự thật.** Mọi con số lợi nhuận/tỷ lệ thắng phải
  ghi rõ **ai công bố** và **chưa kiểm chứng độc lập**.
- **Tham số cụ thể trình bày như thứ tối ưu.** Nói "Donchian bản gốc dùng 20 phiên" thì được;
  nói "20 phiên là con số tốt nhất" thì không — đó là kết luận của việc dò tham số.
- Mọi thứ §2 đã cấm vẫn cấm nguyên: giá mục tiêu, điểm dừng lỗ cho hiện tại, kèo, "sóng".

### Ví dụ minh hoạ — MẪU CHUNG CHUNG TRONG QUÁ KHỨ, không phải một thứ cụ thể

Chốt 03/09/2026. Bài nhóm I gần như luôn cần một ví dụ để người đọc thấy phương pháp
**vận hành ra sao**. Ví dụ đó phải là **một mẫu chung chung lấy từ quá khứ**, và chỉ vậy.

**Mẫu chung chung nghĩa là:**

- Một **giai đoạn đã đóng**, nêu rõ khoảng thời gian: *"giai đoạn 2000–2010"*, *"đợt sụt
  giảm 1987"*.
- Đối tượng ở mức **khái quát**: một chỉ số rộng, một loại hàng hoá, "một cổ phiếu vốn hoá
  lớn" — chứ không phải một mã đích danh.
- Mục đích duy nhất: cho thấy **cơ chế** — tín hiệu xuất hiện lúc nào, lệnh đóng lúc nào,
  chuỗi thua kéo dài bao lâu.

**CẤM, không có ngoại lệ:**

- **Nêu đích danh mã đang niêm yết.** Không *"áp Donchian vào HPG"*, kể cả với dữ liệu
  quá khứ — người đọc sẽ mở bảng điện xem mã đó ngay, và bài thành gợi ý mua bán dù không
  có câu nào mời mua.
- **Áp vào thị trường hiện tại.** Không *"theo hệ thống này thì VN-Index hiện đang…"*.
- **Suy ra hiệu quả từ mẫu.** Một mẫu cho thấy cơ chế; nó **không chứng minh gì** về việc
  phương pháp có ăn hay không. Bài phải nói thẳng câu đó, không để người đọc tự suy.
- **Chọn mẫu vì nó đẹp.** Lấy đúng đoạn phương pháp thắng rồi đem khoe là cách nói dối
  bằng sự thật. Mẫu nào cũng phải kèm giai đoạn phương pháp thua — xem mục *PHẢI* ở trên.

**Cách viết đúng, một câu mẫu:**

> Trên chỉ số S&P 500 giai đoạn 1995–2005, luật vượt đỉnh 20 phiên cho khoảng 12 tín hiệu
> mỗi năm, trong đó chuỗi thua dài nhất kéo 14 lệnh liên tiếp. Đây là một mẫu đơn lẻ được
> chọn để minh hoạ cơ chế; nó không nói gì về hiệu quả của phương pháp ở giai đoạn khác
> hay trên thị trường khác.

### Nguồn cho nhóm I — đây là chỗ dễ hỏng nhất

Được phép dùng các trang chuyên đăng hệ thống giao dịch để **biết phương pháp nào tồn tại**.
Nhưng:

⚠ **Phần lớn các trang đó có động cơ thương mại** — bán khoá học, bán tín hiệu, bán phần
mềm. Số liệu backtest trên đó **không kiểm chứng được**, và thường là kết quả của việc dò
tham số trên chính đoạn dữ liệu đem ra khoe.

Quy trình bắt buộc: dùng trang đó để **tìm ra tên phương pháp**, rồi **mô tả lại từ nguồn
gốc** — sách hoặc bài báo của chính tác giả, hoặc nghiên cứu học thuật kiểm định nó. Nguồn
gốc không tìm được ⇒ **đổi chủ đề khác**, đừng viết dựa trên mô tả thứ cấp.

Con số hiệu suất chỉ có một cách viết đúng: *"<tổ chức X> công bố tỷ lệ thắng 62% trong giai
đoạn 1990–2005; con số này chưa được kiểm chứng độc lập và không tái hiện được bằng dữ liệu
công khai."* Chép trần con số mà bỏ nửa sau là hỏng nặng nhất trong cả nhóm này.

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

`sub` phải là một trong: `chung-khoan` · `vi-mo` · `crypto` · `ngoai-hoi` · `quan-tri-von`.
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

### Viết trước, đăng sau

Cùng file JSON, cùng mọi phép soát ở §3 — bài hẹn **không** được lỏng hơn bài thường.
Thêm `--hen` với ISO **có offset** (giờ VN là `+07:00`):

```bash
cd "D:/Projects/gikky-net" && ssh vps-muinx 'cd ~/gikky-net && docker compose -p gikkynet exec -T api python - --hen '"'"'2026-09-10T08:00:00+07:00'"'"'' < scripts/bai-viet/dang-bai.py
```

Thiếu offset ⇒ exit 2 **trước** khi gọi mạng. Có `--hen` thì đăng nhập bằng
`GIKKY_ADMIN_PASSWORD` (không phải mật khẩu đội) và bài nằm ẩn tới giờ hẹn. Cron
`phat_hanh_da_hen` chạy mỗi 5 phút — độ trễ chấp nhận ≤ 5 phút sau giờ đã chọn.

Stdout là URL trang quản trị (`https://admin.gikky.net/m/<id>`), không phải URL công
khai: bài chưa lên sóng thì `/m/…` công khai trả 404.

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
