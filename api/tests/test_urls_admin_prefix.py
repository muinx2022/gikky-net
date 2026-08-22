"""Prefix `/api/admin/` thuộc về router Ninja quản trị, KHÔNG bị Django admin nuốt.

`admin.site.urls` kết thúc bằng catch-all `re_path(r"(?P<url>.*)$")`. Mount nó thẳng ở
`/api/admin/` là nuốt sạch mọi đường con — và nuốt IM LẶNG: request tới endpoint admin
Ninja chỉ trả 404, không có lỗi cấu hình nào nổi lên. Vì thế test không đo status code
(404 ở cả hai trường hợp) mà đo **cái resolver nào nhận đường đó**.

**Đổi ở Phase 4 (2026-08-22):** trước đó `api_admin` chưa tồn tại nên bài đo chỉ đòi được
`Resolver404` — "chưa ai chiếm chỗ". Nay chỗ ấy đã có chủ, nên bài đo mạnh hơn: đường
quản trị phải rơi vào **đúng `api_admin`**, và một đường quản trị KHÔNG tồn tại vẫn phải
`Resolver404` (đó mới là vế chứng minh catch-all của Django admin không với ra ngoài
nhánh `django/` của nó).
"""

import pytest
from django.contrib import admin
from django.urls import Resolver404, resolve, reverse

from api.quan_tri import api_admin


def test_django_admin_nam_o_nhanh_con_django():
    assert reverse("admin:index") == "/api/admin/django/"


def test_django_admin_van_hoat_dong_trong_nhanh_cua_no():
    """Catch-all của admin vẫn còn — chỉ bị giới hạn trong `/api/admin/django/`."""
    match = resolve("/api/admin/django/duong-khong-ton-tai")

    # `admin.site.urls` bọc view qua `AdminSite.admin_view`, nên object không còn `is`
    # với method gốc — so bằng qualname + namespace là thứ ổn định.
    assert match.namespaces == ["admin"]
    assert match.func.__qualname__ == admin.site.catch_all_view.__qualname__


def _api_cua(callback):
    """`NinjaAPI` mà một view của URLconf phục vụ, hoặc `None`.

    django-ninja gói endpoint trong một closure quanh `PathView`; mỗi `Operation` trong đó
    giữ `.api`. Đọc theo đường ấy chứ không so tên hàm — tên hàm là thứ refactor đổi được,
    còn object API thì không.
    """
    for cell in getattr(callback, "__closure__", None) or ():
        try:
            noi_dung = cell.cell_contents
        except ValueError:  # pragma: no cover - cell chưa gán
            continue
        for operation in getattr(noi_dung, "operations", ()):
            if (api := getattr(operation, "api", None)) is not None:
                return api
    return None


@pytest.mark.parametrize(
    "duong",
    [
        "/api/admin/me",
        "/api/admin/reports",
        "/api/admin/subs",
        "/api/admin/nhat-ky",
        "/api/admin/machs/1/an",
        "/api/admin/users/ai-do/ban",
    ],
)
def test_duong_quan_tri_roi_vao_api_admin_chu_khong_vao_django_admin(duong):
    """Nếu Django admin lại chiếm `/api/admin/` thì `resolve` trả `catch_all_view`."""
    match = resolve(duong)
    assert match.namespaces != ["admin"], (
        f"{duong} rơi vào Django admin — catch-all lại nuốt prefix quản trị."
    )
    assert _api_cua(match.func) is api_admin, (
        f"{duong} không do `api_admin` phục vụ mà do {match.func!r}."
    )


def test_duong_quan_tri_khong_ton_tai_van_Resolver404():
    """Vế chống hàng rào rỗng: bài trên vẫn xanh nếu một catch-all NÀO ĐÓ bắt mọi đường.

    `Resolver404` ở đây chứng minh không ai nuốt cả prefix — Ninja khớp từng route một.
    """
    with pytest.raises(Resolver404):
        resolve("/api/admin/duong-khong-bao-gio-ton-tai")
