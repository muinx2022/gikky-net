"""URLconf CHỈ cho bài đo: `/api/v1/ban-tin` chập chờn (vòng sửa 1, mục 4).

`DEM["so_503"]` lượt hỏi đầu trả 503, sau đó trả 404 (server CŨ) — để đo đường hỏi lại
của `scripts/dang-tin.mjs::serverCoBanTin`. `DEM["da_hoi"]` đếm số lượt bot đã hỏi. Bài đo
đặt lại `DEM` trước mỗi lượt (fixture `chap_chon` ở `test_bot_dang_tin.py`).
"""

from django.http import HttpResponse, HttpResponseNotFound
from django.urls import path

from config.urls import urlpatterns as urlpatterns_that

DEM = {"so_503": 0, "da_hoi": 0}


def _chap_chon(request):
    DEM["da_hoi"] += 1
    if DEM["da_hoi"] <= DEM["so_503"]:
        return HttpResponse(b"upstream down", status=503, content_type="text/plain")
    return HttpResponseNotFound(b'{"detail": "Not Found"}', content_type="application/json")


urlpatterns = [path("api/v1/ban-tin", _chap_chon), *urlpatterns_that]
