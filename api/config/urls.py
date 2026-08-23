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

from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

from api.quan_tri import api_admin
from api.v1 import api_v1

urlpatterns = [
    # allauth headless — PLAN mục 7 chốt "mount toàn bộ urls allauth dưới prefix `/api/`"
    # để Caddy (prod) và `rewrites` của Next (dev) route được bằng đúng một luật.
    # Bề mặt thật: `/api/_allauth/browser/v1/auth/{login,signup,session,…}`.
    #
    # **Không mount `allauth.urls`** (các view HTML): `HEADLESS_ONLY = True` nên chúng
    # không tồn tại, và mount thêm là phơi ra một cửa đăng nhập thứ hai — bằng form, không
    # đi qua CSRF/kiểm quyền của API — mà không ai kiểm.
    # Hệ quả cần biết trước khi bật Google: redirect URI OAuth của bản headless là
    # `/api/_allauth/browser/v1/auth/provider/callback`, **không** phải
    # `/api/accounts/google/login/callback/` như PLAN mục 7 ghi cho bản có view HTML.
    path("api/_allauth/", include("allauth.headless.urls")),
    # THỨ TỰ hai dòng `/api/admin/...` KHÔNG phải là thứ giữ cho cơ chế này đúng:
    # `URLResolver.resolve` bắt `Resolver404` của resolver con rồi ĐI TIẾP pattern kế,
    # nên đảo thứ tự vẫn ra cùng kết quả. Thứ thật sự giữ đúng là **Ninja không có
    # catch-all, còn `admin.site.urls` thì có** — vậy nên chỉ cần Django admin nằm ở
    # nhánh con `django/`, catch-all của nó không với ra ngoài được.
    path("api/admin/django/", admin.site.urls),
    path("api/v1/", api_v1.urls),
    # Phase 4 (2026-08-22). Mount MỚI là việc 1/3 — hai việc còn lại (đăng ký vào
    # `config/api_registry.py`, thêm subpath vào `packages/api-client/package.json`) có
    # chuông riêng, xem docstring `api/quan_tri.py`.
    #
    # Cả prefix này — kể cả nhánh `django/` ở trên — đi qua hàng rào Host
    # `config/host_admin.py` (PLAN 8.2), rồi mới tới `ChiMod` của Ninja.
    path("api/admin/", api_admin.urls),
]

# --- Ảnh ở DEV (Phase 5) -----------------------------------------------------
#
# `static()` trả về danh sách RỖNG khi `DEBUG = False`, nên dòng này tự tắt trên prod —
# ở đó **Caddy phục vụ `/media/*` thẳng từ đĩa**, không qua Django (`deploy/Caddyfile`).
# Đó không phải tối ưu hoá: `django.views.static.serve` đọc file bằng chính tiến trình
# WSGI, nên mỗi tấm ảnh chiếm một worker suốt thời gian truyền.
#
# Đường đi ở dev: trình duyệt → Next 3000 (`rewrites` trong `next.config.ts`) → Django
# 8000 → đây. Same-origin cả chặng, đúng lối `/api/*` đã đi.
#
# ⚠ **Chỉ `MEDIA_ROOT` được mount, KHÔNG BAO GIỜ `MEDIA_AN_ROOT`.** Kho cách ly chứa ảnh
# của mốc đã bị gỡ/ẩn; mount nó ra là bỏ đi đúng cái cơ chế A9 dựng lên (`core/anh_luu.py`).
urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
