# Ảnh minh hoạ cho bài phân tích / tản mạn

Chốt hướng 2026-08-28. Người yêu cầu: *"tuỳ theo bài viết mà thêm minh hoạ, nếu bài nào
cũng chỉ là biểu đồ thì hơi chán, mà hình minh hoạ không phù hợp thì cũng không có ý nghĩa gì"*.

Hai vế đó là hai hàng rào ngược chiều nhau, và plan này phải giữ được cả hai:
**đa dạng** (không phải bài nào cũng biểu đồ cột) và **đúng chỗ** (không có ảnh nào cho có).

## 0. Sự thật đã đo — nền của mọi quyết định dưới đây

| Điều | Trạng thái | Đo ở đâu |
|---|---|---|
| Cửa upload ảnh nội dung | `POST /api/v1/me/anh`, trả `{url, width, height}` | `api/api/anh.py:197` |
| Hạn mức | 30 ảnh / người / ngày lịch VN | `tai_anh_noi_dung` docstring |
| Định dạng nhận | JPEG · PNG · WebP — **KHÔNG nhận SVG** | `api/core/anh.py:66` |
| Cạnh dài tối đa | 2048 (tự thu nhỏ) | `api/core/anh.py:57` |
| Ảnh ngoài site | `<img>` bị **gỡ cả thẻ** nếu `src` không trỏ kho của site | `core/lam_sach_html.py` |
| Thẻ `table` | **KHÔNG có trong allowlist** | `lam_sach_html.py:47-63` |
| Thư viện vẽ trong container | chỉ Pillow 12.3 — không matplotlib/numpy/cairosvg | đo trực tiếp 28/08 |
| Rasterizer ở máy dev | **Playwright 1.62.1 + Chromium, ĐÃ CÀI** cho e2e | `apps/web/package.json:27` |

Hai dòng cuối quyết định kiến trúc: **vẽ ở máy dev bằng Playwright**, không đụng ảnh Docker prod.

Dòng `table` cũng quan trọng: trong thân bài **không có cách nào dựng bảng**. Nên nhu cầu
"so sánh nhiều đối tượng" hôm nay không có lối ra nào ngoài `figures` (tối đa 6 cặp, mỗi ô
24 ký tự) — và ảnh là đường duy nhất còn lại.

## 1. Bộ minh hoạ — 4 loại + mặc định KHÔNG ẢNH

Đây là phần hồn của plan. Chọn loại theo **hình dạng của luận điểm**, không theo chủ đề.

| Loại | Dùng khi luận điểm là… | Bài đã đăng sẽ hợp |
|---|---|---|
| **A · Đường thời gian** | một đại lượng biến thiên, và *hình dạng đường* chính là điều muốn nói | Bitcoin 10 tuần (ba hồi); chênh lệch giá vàng |
| **B · Cột so sánh** | nhiều đối tượng cùng một thước đo, và *khoảng cách giữa chúng* là điều muốn nói | Thuỷ điện 4 mã (+43,6% → −73,4%); lãi ngân hàng quý II |
| **C · Sơ đồ cơ chế** | một *chuỗi nhân quả*, không phải một con số | Thuỷ điện: nước → sản lượng → giá thị trường → doanh thu (hai tay lái); POR21: cách Mỹ phân loại doanh nghiệp |
| **D · Trục sự kiện** | *mốc thời gian* quan trọng hơn giá trị | Bitcoin: 19/08 Bessent → squeeze → đỉnh 25/08 |
| **— · Không ảnh** | bài về khái niệm, tâm lý, sách — không có đại lượng nào để vẽ | Trading in the Zone |

**Mặc định là KHÔNG ẢNH.** Loại C và D tồn tại chính là để tránh cái bẫy "bài nào cũng cột".

### Cổng kiểm — ảnh phải qua mới được thêm

Ba câu, sai một câu thì **bỏ ảnh**:

1. **Ảnh có nói được điều mà một câu văn không nói gọn được không?** Xoá ảnh đi mà bài không
   mất gì ⇒ đừng thêm. Đây là câu chặn "ảnh cho sinh động".
2. **Mọi số/sự kiện trong ảnh đã có trong thân bài và đã có nguồn chưa?** Ảnh **không phải
   chỗ đưa dữ liệu mới** — nó không có chỗ đặt link, y hệt lý do `figures` bị cấm thêm số mới.
3. **Ảnh có tự đứng được không?** Người đọc lướt qua chỉ nhìn ảnh vẫn hiểu nó nói gì — tức
   phải có tiêu đề trong ảnh và nhãn trục/nút đầy đủ.

### Trần

**Tối đa 2 ảnh/bài.** Bài 900–1.400 chữ mà 4 ảnh thì ảnh thành nhiễu. Phần lớn bài **1 ảnh
hoặc 0**.

## 2. Kiến trúc

```
scripts/bai-viet/ve-anh.mjs      ← MỚI: JSON mô tả → SVG → PNG (Playwright)
scripts/bai-viet/dang-bai.py     ← SỬA: upload ảnh trước, thay placeholder, rồi đăng
scripts/bai-viet/lich/tan-man.md ← SỬA: bộ 4 loại + cổng kiểm + luật alt
```

### Vì sao vẽ ở máy dev chứ không trong container

Container chỉ có Pillow; vẽ biểu đồ bằng `ImageDraw` thì được nhưng thô, và thêm matplotlib
là +60 MB vào ảnh prod cho một việc **không phải của prod**. Playwright đã có sẵn ở máy dev.

### Vì sao upload vẫn từ container

Y nguyên lý do của `dang-bai.py` hôm nay: mật khẩu `gikky-team-member` nằm trong biến môi
trường container. Ảnh PNG được chép vào container cùng `bai.json`, rồi **cùng một script**
upload rồi đăng — mật khẩu không rời server.

### Hợp đồng JSON mở rộng

```json
{
  "sub": "chung-khoan",
  "title": "…",
  "body": "<p>…</p>{{ANH:1}}<p>…</p>",
  "anh": [
    { "id": 1, "file": ".tam/anh-1.png", "alt": "Biểu đồ cột: thay đổi lợi nhuận sau thuế quý II/2026 của bốn doanh nghiệp thuỷ điện, từ +43,6% (VSH) tới −73,4% (CHP)" }
  ]
}
```

- `{{ANH:n}}` trong `body` được thay bằng `<img src="/media/…" alt="…" width= height=>`.
- Placeholder **chưa thay hết** ⇒ thoát mã `2`. Chống ca ảnh upload rồi mà bài không hiện.
- `anh` rỗng hoặc không có ⇒ đường cũ chạy y nguyên, không đổi hành vi.
- `alt` **bắt buộc**, ≥40 ký tự — trang có đo Lighthouse SEO, và `alt` rỗng là lỗi a11y thật.

### Hai chế độ sáng/tối — ràng buộc thật, không né được

Trang có công tắc theme; **ảnh PNG không đổi màu theo theme**. Nên:

- Nền **trong suốt** (PNG có alpha).
- Chữ và nét dùng tông trung tính đọc được trên **cả** nền sáng lẫn nền tối. Không dùng đen
  thuần (chìm trên nền tối) hay trắng thuần (chìm trên nền sáng).
- **Tiêu chí nghiệm thu phải đo cả hai theme**, không chỉ chụp một tấm rồi bảo đẹp.

## 3. Tiêu chí nghiệm thu — ĐO ĐƯỢC

| # | Tiêu chí | Cách đo |
|---|---|---|
| 1 | `ve-anh.mjs` dựng được cả 4 loại A/B/C/D | 4 file PNG sinh ra, mở được bằng Pillow, đúng kích thước khai báo |
| 2 | PNG có kênh alpha, nền trong suốt | `PIL.Image.open(f).mode` chứa `A`; góc trên trái alpha=0 |
| 3 | Đọc được trên **cả hai** theme | chụp bài thật ở `data-theme` sáng và tối, so tương phản chữ/nền ≥ 4.5:1 |
| 4 | Cạnh dài ≤ 2048 | đọc từ Pillow |
| 5 | Upload + thay placeholder chạy đúng | đăng bài thử có 2 ảnh ⇒ HTTP 200, HTML trả về chứa đúng 2 `<img src="/media/` |
| 6 | Placeholder sót ⇒ thoát mã `2` | cố ý để `{{ANH:2}}` mà `anh` chỉ có id 1 ⇒ mã 2, **chưa gọi mạng** |
| 7 | `alt` thiếu hoặc <40 ký tự ⇒ mã `2` | ca thử riêng |
| 8 | Bài **không** có `anh` chạy y như cũ | đăng một bài không ảnh ⇒ mã 0, không có `<img>` |
| 9 | Ảnh ngoài site vẫn bị gỡ | nhét `<img src="https://…">` vào body ⇒ HTML trả về không còn thẻ đó |
| 10 | `pnpm lint` + `pnpm test` giữ nguyên số | 0 warning; số test không giảm |

**Thử phá bắt buộc** (luật 4 của `D:\Projects\CLAUDE.md`): tiêu chí 6, 7, 9 phải ĐỎ khi
sửa ngược code, rồi khôi phục.

## 4. Việc KHÔNG làm trong lượt này

- **Không** ảnh trang trí, ảnh kho, ảnh AI. Lý do đã bàn: bản quyền không kiểm được ở một
  bot chạy 6h sáng, và ảnh máy vẽ phá đúng thứ trang này bán — độ tin.
- **Không** đụng bot bản tin (`scripts/tin-tuc/`). Bản tin là chữ + link, khác việc.
- **Không** thêm phụ thuộc mới vào ảnh Docker prod.
- **Không** sửa `lam_sach_html.py` — allowlist `img` đã đủ.

## 5. Rủi ro đã thấy trước

1. **Ảnh sai số liệu tệ hơn không có ảnh.** Chống bằng cổng kiểm câu 2: mọi số trong ảnh
   phải lấy từ `figures`/`body` của chính bài đó, không truy vấn nguồn riêng.
2. **Bot lạm dụng loại B.** Cột là loại dễ dựng nhất nên bot sẽ trôi về đó. Chống bằng bảng
   chọn theo *hình dạng luận điểm* ở §1, và ghi thẳng vào spec rằng bài nào cũng cột là hỏng.
3. **Ảnh mồ côi.** API không có cửa gỡ ảnh nội dung (ghi rõ trong docstring). Upload rồi bỏ
   bài ⇒ file ở lại vĩnh viễn. Chống bằng: upload **sau** khi bài đã qua hết phép soát.
