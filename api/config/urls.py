"""URL gốc.

Django admin nằm ở `/api/admin/django/` — **LỒNG BÊN TRONG** `/api/admin/`, không phải
chiếm nguyên prefix đó. Lý do: `admin.site.urls` kết thúc bằng một catch-all
(`re_path(r"(?P<url>.*)$", catch_all_view)`), nên mount nó ở `/api/admin/` là nuốt sạch
mọi đường `/api/admin/*` — router Ninja admin của Phase 4 (PLAN mục 7) sẽ không bao giờ
được gọi tới, mà lỗi lại im lặng: mọi request chỉ ra 404.

Đặt ở nhánh con `django/` giữ được cả hai:
- `/api/admin/django/...` → Django admin (catch-all chỉ nuốt trong nhánh của nó);
- `/api/admin/...` còn lại → để dành cho `api_admin.urls` của Phase 4.

Thứ tự hai dòng KHÔNG quan trọng — lý do thật nằm ở comment nội tuyến trong `urlpatterns`.

Về bảo mật hạ tầng: luật Caddy `gikky.net/api/admin/*` → 403 ở PLAN 8.2 phủ luôn cả
`/api/admin/django/` vì nó nằm trong cùng prefix ⇒ **không phải thêm luật Caddy nào**.
"""

from django.contrib import admin
from django.urls import path

from api.v1 import api_v1

urlpatterns = [
    # THỨ TỰ hai dòng `/api/admin/...` KHÔNG phải là thứ giữ cho cơ chế này đúng:
    # `URLResolver.resolve` bắt `Resolver404` của resolver con rồi ĐI TIẾP pattern kế,
    # nên đảo thứ tự vẫn ra cùng kết quả. Thứ thật sự giữ đúng là **Ninja không có
    # catch-all, còn `admin.site.urls` thì có** — vậy nên chỉ cần Django admin nằm ở
    # nhánh con `django/`, catch-all của nó không với ra ngoài được.
    path("api/admin/django/", admin.site.urls),
    path("api/v1/", api_v1.urls),
    # Phase 4: path("api/admin/", api_admin.urls)  ← đặt đâu cũng chạy, nhưng nhớ đăng ký
    # NinjaAPI mới vào `config/api_registry.py`.
]
