"""URLconf CHỈ cho bài đo: dựng lại "server cũ" (prod đang chạy `main`, chưa có việc 20).

`tests/test_bot_dang_tin.py` cần chứng minh bot đi ĐÚNG đường cũ khi server chưa có
`/api/v1/ban-tin` — ca thật của sáng hôm sau lúc prod chưa deploy. Chen một view 404 vào
TRƯỚC toàn bộ URL thật là cách hẹp nhất: mọi đường khác (allauth, `/machs`) đi y nguyên.
"""

from django.http import HttpResponseNotFound
from django.urls import path

from config.urls import urlpatterns as urlpatterns_that


def _chua_co(request):
    return HttpResponseNotFound(b'{"detail": "Not Found"}', content_type="application/json")


urlpatterns = [path("api/v1/ban-tin", _chua_co), *urlpatterns_that]
