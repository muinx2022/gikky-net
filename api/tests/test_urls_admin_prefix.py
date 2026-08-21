"""Prefix `/api/admin/` phải còn TRỐNG cho router Ninja admin của Phase 4.

`admin.site.urls` kết thúc bằng catch-all `re_path(r"(?P<url>.*)$")`. Mount nó thẳng ở
`/api/admin/` là nuốt sạch mọi đường con — và nuốt IM LẶNG: request tới endpoint admin
Ninja chỉ trả 404, không có lỗi cấu hình nào nổi lên. Vì thế test không đo status code
(404 ở cả hai trường hợp) mà đo **cái resolver nào nhận đường đó**.
"""

import pytest
from django.contrib import admin
from django.urls import Resolver404, resolve, reverse


def test_django_admin_nam_o_nhanh_con_django():
    assert reverse("admin:index") == "/api/admin/django/"


def test_django_admin_van_hoat_dong_trong_nhanh_cua_no():
    """Catch-all của admin vẫn còn — chỉ bị giới hạn trong `/api/admin/django/`."""
    match = resolve("/api/admin/django/duong-khong-ton-tai")

    # `admin.site.urls` bọc view qua `AdminSite.admin_view`, nên object không còn `is`
    # với method gốc — so bằng qualname + namespace là thứ ổn định.
    assert match.namespaces == ["admin"]
    assert match.func.__qualname__ == admin.site.catch_all_view.__qualname__


@pytest.mark.parametrize(
    "duong",
    [
        "/api/admin/reports",
        "/api/admin/subs/",
        "/api/admin/audit-log",
    ],
)
def test_api_admin_khong_bi_django_admin_nuot(duong):
    """Phase 4 mount `api_admin.urls` ở đây; hôm nay chưa có gì => phải Resolver404.

    Nếu Django admin lại chiếm `/api/admin/` thì `resolve` KHÔNG ném — nó trả về
    `catch_all_view`, và đó chính là lỗi cần bắt.
    """
    with pytest.raises(Resolver404):
        resolve(duong)
