"""Hàng rào Host cho `/api/admin/*` — PLAN 8.2, mô phỏng ở dev (PLAN mục 10, Phase 4).

PLAN 8.2 chốt luật hạ tầng:

```
gikky.net/api/admin/*        → 403 CHẶN TẠI CADDY (trước rule proxy)
admin.gikky.net/api/*        → allowlist IP → Django (kể cả /api/admin)
```

Ở prod thì Caddy làm việc đó và Django không bao giờ thấy request. Middleware này là bản
mô phỏng để **luật ấy có một chỗ chạy được và đo được** trước khi có Caddy — PLAN mục 10
gọi đích danh: "chặn `/api/admin` ngoài host admin (8.2 — dev mô phỏng bằng middleware
kiểm Host)".

⚠ **Nói cho ĐÚNG MỨC nó bảo vệ được gì ở dev — đừng đọc mạnh hơn.**

Ở dev, `apps/web` (cổng 3000) và `apps/admin` (cổng 3001) đều rewrite `/api/*` sang cùng
một `API_ORIGIN` (`next.config.ts` của cả hai). Next proxy đặt lại `Host` thành host
đích, nên Django nhìn thấy `localhost:8000` cho **cả hai** app. Middleware này vì thế
**KHÔNG tách được** trình duyệt-đang-ở-3000 khỏi trình duyệt-đang-ở-3001; ở dev nó chỉ
chặn được ca "gõ thẳng một host lạ". Lớp thật sự che `/api/admin/*` khỏi người dùng
thường ở dev là **tầng permission** (`api/quan_tri.py::ChiMod`), và đó là lớp phải đúng.

Cái middleware này thật sự làm được:
- ở **prod**, nơi Caddy giữ nguyên `Host`, nó là lớp thứ hai sau luật Caddy — hai lớp
  cho cùng một luật, nên quên cấu hình một bên không mở toang cửa;
- ở **mọi môi trường**, nó là chỗ luật ấy tồn tại dưới dạng CODE chạy được thay vì một
  dòng trong PLAN, và `tests/test_api_quan_tri_host.py` đo nó bằng `Host` tường minh.

Phủ luôn `/api/admin/django/` (Django admin) vì nó nằm trong cùng prefix — đúng như PLAN
8.2 đã tính khi chọn chỗ mount ấy, và cũng là lý do prefix ở đây là `/api/admin/` chứ
không phải hai prefix riêng.
"""

import json

from django.conf import settings
from django.http import HttpResponse

#: Mọi đường dưới prefix này đi qua hàng rào. Có dấu `/` cuối để `/api/administrator`
#: (một đường tưởng tượng nào đó sau này) không bị chặn nhầm vì trùng tiền tố chuỗi.
PREFIX_API_ADMIN = "/api/admin/"

#: Cùng hình dạng lỗi `{detail, code}` của PLAN mục 7 — người viết frontend admin bắt
#: theo `code`, và họ không được nhận một hình dạng thứ hai chỉ vì lỗi này đến từ
#: middleware chứ không từ Ninja.
MA_SAI_HOST = "sai_host_quan_tri"


class ChanApiAdminNgoaiHostAdmin:
    """403 cho mọi request `/api/admin/*` tới từ host không nằm trong `ADMIN_HOSTS`.

    Trả JSON chứ không phải trang HTML 403 của Django: đường này chỉ có client API đi
    vào, và một khối HTML rơi vào `response.json()` là một lỗi parse che mất lỗi thật.

    Không bắt `DisallowedHost` của `get_host()`: host không nằm trong `ALLOWED_HOSTS` thì
    Django trả 400 và đó đã là câu trả lời đúng — bắt ở đây để đổi nó thành 403 chỉ làm
    hai lỗi khác nhau trông giống nhau.
    """

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        if request.path.startswith(PREFIX_API_ADMIN) and not self._duoc_phep(request):
            return HttpResponse(
                json.dumps(
                    {
                        "detail": "Khu quản trị chỉ truy cập được qua host quản trị.",
                        "code": MA_SAI_HOST,
                    },
                    ensure_ascii=False,
                ),
                content_type="application/json",
                status=403,
            )
        return self.get_response(request)

    @staticmethod
    def _duoc_phep(request) -> bool:
        """So `Host` với `ADMIN_HOSTS`, không phân biệt hoa thường.

        So CHÍNH XÁC cả cổng, không có wildcard: một mẫu kiểu `*.gikky.net` ở đây là cách
        `evil.gikky.net` (subdomain người khác chiếm được) mở được khu quản trị. Danh
        sách ngắn và viết tay là ma sát cố ý.
        """
        host = request.get_host().lower()
        return any(host == h.strip().lower() for h in settings.ADMIN_HOSTS)
