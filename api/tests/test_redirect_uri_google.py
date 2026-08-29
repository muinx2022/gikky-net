"""`redirect_uri` gửi cho Google phải là **https** và đúng đường dẫn.

## Ca thật mở ra bài đo này — 2026-08-27

Bấm "Đăng nhập bằng Google" trên `https://gikky.net` trả `Error 400:
redirect_uri_mismatch`. Giải mã payload lỗi của Google ra đúng chuỗi app đã gửi::

    http://gikky.net/api/_allauth/google/login/callback/

Hai thứ sai cùng lúc, và **cả hai đều im lặng**:

1. **Scheme `http`.** Caddy nhận TLS rồi `reverse_proxy api:8000` bằng HTTP thuần, có gửi
   `X-Forwarded-Proto: https`. Nhưng Django mặc định không tin header ấy ⇒
   `build_absolute_uri()` sinh `http://`. Google **không cho đăng ký** URI `http://` cho
   tên miền thật, nên chuỗi ấy không thể khớp bất cứ thứ gì — sai vĩnh viễn, và không
   sửa được ở phía Google Console. Vá: `SECURE_PROXY_SSL_HEADER` trong `settings.py`.
2. **Tài liệu chỉ sai đường.** `api/.env.example` từng bảo đăng ký
   `/_allauth/browser/v1/auth/provider/callback` — đó là nơi FRONTEND POST vào để bắt
   đầu, không phải nơi Google gọi ngược lại. Ai làm đúng theo tài liệu của repo thì
   *chắc chắn* mismatch.

## Vì sao bài đo này tồn tại thay vì "đã sửa rồi thôi"

Không có nó, cả hai lỗi trên **đều không làm gì đỏ**. Bộ test chạy với `RequestFactory`
mặc định (không proxy, không header), nên `http` là kết quả ĐÚNG ở đó — lỗi chỉ hiện ra
trên prod, sau khi deploy, dưới dạng một trang lỗi của Google không nhắc gì tới Django.
Đó là loài hỏng tốn nửa buổi để truy, và nó truy được đúng một lần rồi lại quên.

Bài đo vì thế **giả lập đúng hình dạng request của prod** (có `X-Forwarded-Proto`) chứ
không đo cấu hình suông: `assert settings.SECURE_PROXY_SSL_HEADER == (...)` sẽ xanh kể cả
khi allauth đổi cách dựng URL, tức đo một hằng số thay vì đo hành vi.
"""

import pytest
from allauth.socialaccount.providers.google.views import GoogleOAuth2Adapter
from django.test import RequestFactory

#: Đường dẫn callback THẬT — do `GoogleOAuth2Adapter` sinh, không phải do người gõ.
#: Dấu `/` cuối là một phần của chuỗi: Google so khớp tuyệt đối.
DUONG_CALLBACK = "/api/_allauth/google/login/callback/"

#: Đường mà `.env.example` từng chỉ sai. Ghim ở đây để nếu ai chép nhầm lần nữa thì có
#: một chỗ nói ra rằng nó KHÔNG phải `redirect_uri`.
DUONG_SAI = "/api/_allauth/browser/v1/auth/provider/callback"


def _redirect_uri(host: str, *, sau_proxy_https: bool) -> str:
    """Chuỗi `redirect_uri` allauth dựng cho một request có hình dạng cho trước.

    `sau_proxy_https=True` mô phỏng đúng prod: Caddy nói chuyện HTTP thuần với Django
    (`wsgi.url_scheme` vẫn là `http`) nhưng gửi kèm `X-Forwarded-Proto: https`.
    """
    thua = {"HTTP_X_FORWARDED_PROTO": "https"} if sau_proxy_https else {}
    r = RequestFactory().get("/", HTTP_HOST=host, **thua)
    return GoogleOAuth2Adapter(r).get_callback_url(r, None)


@pytest.mark.parametrize("host", ["gikky.net", "admin.gikky.net"])
def test_sau_proxy_thi_redirect_uri_la_https(settings, host):
    """Vế CHÍNH: sau proxy có `X-Forwarded-Proto: https` ⇒ chuỗi phải bắt đầu bằng https."""
    settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, host]
    uri = _redirect_uri(host, sau_proxy_https=True)
    assert uri == f"https://{host}{DUONG_CALLBACK}", (
        "Google từ chối mọi redirect_uri http:// cho tên miền thật. Chuỗi dựng ra: " + uri
    )


def test_khong_co_header_thi_van_la_http(settings):
    """Vế đối chứng — **đây là chỗ chống bài đo RỖNG**.

    Nếu bỏ đi, một `get_callback_url` luôn trả `https://…` (vì bất kỳ lý do gì) cũng làm
    bài trên xanh, và bài trên sẽ thôi chứng minh rằng `SECURE_PROXY_SSL_HEADER` là thứ
    tạo ra khác biệt. Không có proxy ⇒ phải là `http`.
    """
    settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, "gikky.net"]
    assert _redirect_uri("gikky.net", sau_proxy_https=False).startswith("http://")


def test_duong_dan_callback_dung_va_khong_phai_duong_frontend(settings):
    """Đường dẫn là `/google/login/callback/`, KHÔNG phải đường frontend POST vào."""
    settings.ALLOWED_HOSTS = [*settings.ALLOWED_HOSTS, "gikky.net"]
    uri = _redirect_uri("gikky.net", sau_proxy_https=True)
    assert uri.endswith(DUONG_CALLBACK)
    assert DUONG_SAI not in uri


def test_env_example_chi_dung_duong_callback():
    """Tài liệu phải chỉ đúng chuỗi — vì người ta đăng ký với Google theo nó.

    Đây là lỗi gốc của ca 2026-08-27: code đúng nhưng tài liệu sai, và người làm theo tài
    liệu thì hỏng. Một hằng số đúng trong `settings.py` không cứu được điều đó.
    """
    from pathlib import Path

    mau = (Path(__file__).resolve().parent.parent / ".env.example").read_text("utf-8")
    moc = mau[mau.index("Google OAuth") : mau.index("GOOGLE_CLIENT_SECRET=")]
    assert DUONG_CALLBACK in moc, "`.env.example` không nêu đường callback đúng"
    # Chuỗi sai VẪN được phép xuất hiện — nhưng chỉ trong câu giải thích nó sai. Kiểm
    # rằng nó không đứng một mình như một chỉ dẫn.
    if DUONG_SAI in moc:
        assert "SAI" in moc, "`.env.example` nêu đường frontend mà không nói rõ nó sai"
