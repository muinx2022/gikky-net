# `P-20260828-1` — Django đọc 0 byte khi thân request là chunked · 2026-08-28

## Nguyên nhân, đo được từng bước

Đếm lượt xem không ghi được hàng nào trên prod. Truy theo thứ tự, mỗi bước loại một giả thuyết:

| Bước | Đo | Loại được gì |
|---|---|---|
| 1 | gunicorn log: `POST /api/v1/dem-luot-xem → 400` | middleware CÓ gọi — không phải "matcher không khớp" |
| 2 | secret sai ra **401**, đây ra **400** | header secret ĐÃ qua lớp auth — không phải lỗi secret |
| 3 | `curl` với secret đúng ⇒ **200** | endpoint đúng — không phải lỗi Django view |
| 4 | dò 118 byte khớp ca nào | **thân RỖNG** (`body.du_lieu: Field required`) |
| 5 | bài đo Node gọi `demLuotXem` y hệt ⇒ body đi đủ 48 byte | hình dạng lời gọi đúng — không phải lỗi client |
| 6 | build `apps/web` thật, trỏ vào server bắt request ⇒ body **CÓ** đi, nhưng `content-length: (không có)` | ⇒ **gửi kiểu chunked** |
| 7 | `curl` chunked tới chính prod ⇒ **400, 118 byte** — khớp từng byte | **XÁC NHẬN** |

```
có Content-Length  -> 200  {"da_dem": true}
chunked (không CL) -> 400  {"detail": "Tham số không hợp lệ (body.du_lieu: Field required)."}
```

**Cơ chế:** `django.core.handlers.wsgi.WSGIRequest.__init__` dựng
`LimitedStream(environ["wsgi.input"], content_length)` với

```python
try:    content_length = int(environ.get("CONTENT_LENGTH"))
except (ValueError, TypeError):  content_length = 0
```

Thiếu `CONTENT_LENGTH` ⇒ `content_length = 0` ⇒ Django đọc **0 byte**, dù gunicorn đã giải mã
chunked xong và thân vẫn nằm nguyên trong `wsgi.input`. Không log, không warning — chỉ một
`400` trông y như "client gửi thiếu trường".

## Vì sao sửa ở phía Django, không phía Next

- **Không sửa được ở Next**: `Content-Length` là *forbidden header name* của Fetch — đặt tay
  bị bỏ qua. Và edge runtime quyết định cách gửi thân, không phải mã của ta.
- **Không hand-roll `fetch`**: `e2e/don-vi/type-frontend.spec.ts` ép mọi lời gọi API đi qua
  hàm sinh ra kèm `baseUrl` (PLAN 8.3). Viết `fetch` tay là phá đúng hàng rào đó.
- **Không đẩy qua Caddy**: middleware gọi thẳng `http://api:8000`; bắt nó vòng qua Caddy là
  đổi `API_ORIGIN` cho MỌI lời gọi server-side, kéo theo Host/`ALLOWED_HOSTS`/`ADMIN_HOSTS`.
  Đổi một hằng số toàn cục để chữa một endpoint là đổi sai chỗ.
- **Sửa ở tầng WSGI là đúng vai**: `config/wsgi.py` chính là chỗ khớp giữa server HTTP và
  Django. Và nó chữa **mọi** lời gọi chunked về sau, không riêng cửa đếm — lớp lỗi này sẽ
  lặp lại với bất kỳ endpoint nào mà edge runtime gọi tới.

## Việc

`api/config/wsgi.py`: bọc `application` bằng một WSGI middleware — thiếu `CONTENT_LENGTH`
mà có `Transfer-Encoding: chunked` thì đọc hết `wsgi.input`, thay bằng `BytesIO`, và đặt
`CONTENT_LENGTH`.

**Có TRẦN.** Đọc cả thân vào bộ nhớ mà không giới hạn là mở một đường làm cạn RAM. Vượt trần
⇒ **413**, không phải đọc tiếp rồi hy vọng.

## Tiêu chí nghiệm thu (ĐO ĐƯỢC)

| # | Tiêu chí |
|---|---|
| N1 | Request chunked (không `CONTENT_LENGTH`) ⇒ view nhận **đủ** thân, `CONTENT_LENGTH` được đặt đúng |
| N2 | Request thường (CÓ `CONTENT_LENGTH`) ⇒ **không bị đụng vào** — `wsgi.input` giữ nguyên object |
| N3 | Không thân, không chunked (GET) ⇒ không đụng |
| N4 | Thân chunked vượt trần ⇒ **413**, và **không** đọc quá trần vào bộ nhớ |
| N5 | THỬ PHÁ: gỡ lớp bọc ⇒ N1 và N4 ĐỎ |
| N6 | Trên prod: vào trang mạch thật ⇒ bảng `LuotXem` **tăng** |
| N7 | `pnpm test` không hồi quy (nền: 1600 passed) |

---

# KẾT QUẢ

## Nghiệm thu

| # | Tiêu chí | Kết quả |
|---|---|---|
| N1 | Chunked ⇒ view nhận đủ thân, `CONTENT_LENGTH` đúng | **ĐẠT** |
| N2 | Request có `Content-Length` KHÔNG bị đụng | **ĐẠT** — đo bằng **định danh object** (`is luong_goc`), không bằng nội dung: đo nội dung thì một upload bị nuốt trọn vào RAM vẫn xanh |
| N3 | GET không thân ⇒ không đụng | **ĐẠT** |
| N4 | Vượt trần ⇒ **413**, và chỉ đọc `tran + 1` byte | **ĐẠT** |
| N5 | THỬ PHÁ | **ĐẠT** — xem bảng dưới |
| N6 | Prod: vào trang mạch ⇒ `LuotXem` tăng | **ĐẠT** — 3 lượt ⇒ 3 hàng; log đổi `400` → **`200`** |
| N7 | Không hồi quy | **1607 passed** (nền 1600 + 8 mới), 1 đỏ là flaky `P-20260827-1` đã ghi sổ. `don-vi`: **375 passed** (nền 373), 1 đỏ là nợ `/luat` tĩnh có sẵn |

## THỬ PHÁ (Luật 4)

| Phá gì | Bài phải ĐỎ | Kết quả |
|---|---|---|
| Gỡ hẳn lớp bọc khỏi `application` | bài TÍCH HỢP | 1 failed, 7 passed ✅ |
| `read(tran)` thay vì `read(tran + 1)` | `N4` | 1 failed, 7 passed ✅ |
| Bỏ điều kiện `CONTENT_LENGTH` ⇒ đụng mọi request | `N2b` | 1 failed, 7 passed ✅ |
| — khôi phục — | — | **8 passed** ✅ |

⚠ Đáng ghi: **gỡ lớp bọc chỉ làm bài TÍCH HỢP đỏ**, không làm bài đơn vị đỏ — vì bài đơn vị
đo `DocThanChunked` trực tiếp. Đó chính là lý do bài tích hợp phải tồn tại: nó là bài duy
nhất canh chuyện lớp bọc **có được cắm vào `application`** hay không.

## Hàng rào kiến trúc đã chặn đúng, và tôi đã khai báo thay vì lách

Bài đo mới gọi hàm client THẬT ⇒ `type-frontend.spec.ts` đỏ hai chỗ:

1. **danh sách file gọi API viết cứng** — thiết kế là vậy: *"mỗi file mới gọi API là một chỗ
   mới có thể rò session, nên nó phải nằm trong diff và phải được nhìn"*. ⇒ khai thêm một
   dòng kèm lý do, **không** thêm miễn trừ.
2. **luật `GOI_QUA_BIEN`** — tên hàm client xuất hiện trong **tiêu đề bài đo** (một chuỗi),
   mà luật không phân biệt được "alias qua biến" với "nhắc trong chuỗi". ⇒ đổi tiêu đề, cùng
   lối repo đã dùng (`const XEM_MACH = "xem" + "Mach"`).

Cả hai đều là hàng rào làm đúng việc. Lách bằng miễn trừ thì rẻ hơn, và đó chính là cái làm
hàng rào mục dần.

## Dọn

- Xoá 1 hàng `LuotXem` đường dẫn GIẢ `/m/kiem-chunked` (do bài kiểm chunked của tôi tạo).
- **Giữ** 3 hàng `la_bot=True` của curl — chúng đã được phân loại đúng là bot, xoá đi là
  sửa số liệu thật.
- Backup trước deploy: `truoc-deploy-20260829-004042.sql.gz`.

## Còn lại

`P-20260828-1` đóng, nhưng nó để lộ một lớp lỗi rộng hơn đáng ghi nhớ: **mọi lời gọi từ edge
runtime của Next tới Django đều gửi chunked**. Trước lượt này, cửa `/lam-moi-cache` là chiều
ngược lại (Django → Next) nên không dính; nhưng bất kỳ cửa mới nào gọi từ `middleware.ts` đều
sẽ đi qua đúng đường này. Nay `DocThanChunked` phủ sẵn cho cả tương lai, và
`tests/test_than_chunked.py` ghim nó.
