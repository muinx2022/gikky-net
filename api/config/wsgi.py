"""Điểm vào WSGI.

Ngoài `get_wsgi_application()` mặc định, file này còn bọc thêm **một** lớp: đọc thân
request gửi kiểu `Transfer-Encoding: chunked`. Lý lẽ đầy đủ ở `DocThanChunked`.
"""

import io
import os

from django.core.wsgi import get_wsgi_application

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

#: Trần cho thân chunked, tính bằng byte. Vượt là **413**.
#:
#: 1 MiB là rộng gấp hàng nghìn lần thân thật đi qua đường này (`{"duong_dan": …,
#: "user_agent": …}` cỡ 100 byte). Nó không phải con số điều chỉnh hiệu năng — nó là chốt
#: chặn: lớp bọc dưới đây đọc **cả thân vào bộ nhớ**, nên không có trần thì một request
#: chunked dài vô hạn là một đường làm cạn RAM của cả container.
#:
#: Ảnh người dùng tải lên **KHÔNG** đi qua đây: chúng đến từ trình duyệt qua Caddy và luôn
#: có `Content-Length`, nên nhánh này không chạm tới.
TRAN_THAN_CHUNKED = 1 * 1024 * 1024


class DocThanChunked:
    """Đọc thân `Transfer-Encoding: chunked` và đặt `CONTENT_LENGTH` cho Django.

    ## Vì sao cần, và vì sao nó im lặng đến thế nếu thiếu

    `WSGIRequest.__init__` của Django dựng luồng đọc theo `CONTENT_LENGTH`:

    ```python
    try:    content_length = int(environ.get("CONTENT_LENGTH"))
    except (ValueError, TypeError):  content_length = 0
    self._stream = LimitedStream(self.environ["wsgi.input"], content_length)
    ```

    Thân gửi kiểu chunked **không có** `Content-Length` — đó là cả điểm của chunked. Nên
    `content_length` rơi về `0` và Django đọc **0 byte**, dù gunicorn đã giải mã chunked
    xong và thân vẫn nằm nguyên trong `wsgi.input`.

    Hậu quả: endpoint trả **400 "Field required"** — trông y hệt "client gửi thiếu trường".
    Không log, không warning, không có gì chỉ về phía `Content-Length`.

    ## Ca thật đã xảy ra (2026-08-28, `P-20260828-1`)

    `middleware.ts` của Next chạy **edge runtime**; `fetch` ở đó gửi thân **chunked**. Cửa
    đếm lượt xem vì thế trả 400 ở **mọi** lượt, bảng `LuotXem` đứng ở 0 hàng suốt một bản
    deploy. Đo được, cùng thân + cùng secret + cùng endpoint:

    ```
    có Content-Length  -> 200  {"da_dem": true}
    chunked (không CL) -> 400  {"detail": "… (body.du_lieu: Field required)."}
    ```

    ## Vì sao chữa ở ĐÂY chứ không ở phía Next

    `Content-Length` là *forbidden header name* của chuẩn Fetch — đặt tay thì bị bỏ qua, và
    cách gửi thân do runtime quyết, không do mã của ta. Chữa ở tầng WSGI cũng phủ **mọi**
    endpoint, thay vì vá riêng một cửa rồi gặp lại đúng lớp lỗi này ở cửa tiếp theo.

    ## Ba chốt trong bản triển khai dưới đây

    1. **Chỉ chạm khi THIẾU `CONTENT_LENGTH` và CÓ `Transfer-Encoding: chunked`.** Request
       bình thường không bị đọc trước, không bị thay `wsgi.input` — đường ghi ảnh (multipart,
       có `Content-Length`) phải đi nguyên vẹn qua đây.
    2. **Đọc tối đa `TRAN_THAN_CHUNKED + 1` byte**, không đọc hết rồi mới đo. Đọc hết rồi
       mới từ chối là đã nuốt xong thứ mình định từ chối.
    3. **Vượt trần ⇒ 413 ngay tại đây**, không đẩy xuống Django.
    """

    def __init__(self, app, tran: int = TRAN_THAN_CHUNKED):
        self.app = app
        self.tran = tran

    def __call__(self, environ, start_response):
        if self._can_doc(environ):
            # `+ 1` để PHÂN BIỆT "vừa đúng trần" với "vượt trần" — đọc đúng `tran` byte thì
            # một thân dài hơn trông y hệt một thân vừa khít.
            du_lieu = environ["wsgi.input"].read(self.tran + 1)
            if len(du_lieu) > self.tran:
                start_response(
                    "413 Payload Too Large",
                    [("Content-Type", "application/json; charset=utf-8")],
                )
                return [b'{"detail": "Than request qua lon", "code": "than_qua_lon"}']
            environ["wsgi.input"] = io.BytesIO(du_lieu)
            environ["CONTENT_LENGTH"] = str(len(du_lieu))
        return self.app(environ, start_response)

    def _can_doc(self, environ) -> bool:
        """Chỉ đúng khi request THẬT SỰ là chunked và Django sẽ đọc nhầm thành rỗng."""
        if environ.get("CONTENT_LENGTH"):
            return False
        ma_hoa = environ.get("HTTP_TRANSFER_ENCODING", "")
        return "chunked" in ma_hoa.lower()


application = DocThanChunked(get_wsgi_application())
