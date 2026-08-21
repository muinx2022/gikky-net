"""Mọi `NinjaAPI` đang mount phải có mặt trong `config.api_registry.NINJA_APIS`.

Đây là **cái chuông cho Phase 4**. Kịch bản hỏng im lặng cần chặn: ai đó mount thêm
`NinjaAPI` cho `/api/admin` nhưng quên đăng ký ⇒ `export_openapi` chỉ biết `v1` ⇒
`pnpm codegen` vẫn exit 0 và sinh TS client THIẾU sạch endpoint admin ⇒ người viết
admin tự khai interface tay, vi phạm luật "type một chiều" của PLAN 8.3. Không có gì
đỏ ở bất cứ đâu.

Test đi tìm NinjaAPI bằng cách duyệt URLconf thật, không dựa vào một danh sách viết
tay thứ hai (danh sách viết tay thứ hai thì cũng quên y như cái thứ nhất).
"""

from functools import partial

from django.urls import URLPattern, URLResolver, get_resolver
from ninja import NinjaAPI

from config.api_registry import NINJA_APIS


def _api_trong_callback(callback):
    """Moi ra mọi `NinjaAPI` mà một view của URLconf tham chiếu tới.

    django-ninja gắn API vào view theo hai kiểu, gom cả hai cho chắc:
    - `functools.partial(view, api=...)` — dùng cho `/docs`, `/openapi.json`, api-root;
    - closure quanh một `PathView`, mỗi `Operation` trong đó giữ `.api` — dùng cho
      endpoint thường.
    """
    ung_vien = [callback, getattr(callback, "api", None)]

    if isinstance(callback, partial):
        ung_vien.extend(callback.args)
        ung_vien.extend(callback.keywords.values())

    for cell in getattr(callback, "__closure__", None) or ():
        try:
            noi_dung = cell.cell_contents
        except ValueError:  # cell chưa gán — bỏ qua
            continue
        ung_vien.append(noi_dung)
        ung_vien.append(getattr(noi_dung, "api", None))
        for operation in getattr(noi_dung, "operations", ()):
            ung_vien.append(getattr(operation, "api", None))

    return [x for x in ung_vien if isinstance(x, NinjaAPI)]


def _duyet(patterns, tim_thay):
    """Gom `NinjaAPI` trong URLconf vào `tim_thay`, khoá theo `id(api)`.

    Khoá là `id(api)` chứ không phải khoá registry: cùng MỘT object xuất hiện ở nhiều
    URLPattern (mỗi endpoint một cái), và ở tầng URLconf thì cái tên `"v1"` chưa tồn tại —
    nó chỉ có trong `NINJA_APIS`.
    """
    for entry in patterns:
        if isinstance(entry, URLResolver):
            _duyet(entry.url_patterns, tim_thay)
        elif isinstance(entry, URLPattern):
            for api in _api_trong_callback(entry.callback):
                tim_thay[id(api)] = api
    return tim_thay


def _ninja_api_dang_mount():
    return _duyet(get_resolver().url_patterns, {})


def test_walker_that_su_tim_duoc_api():
    """Chốt chính cái thước đo: walker mà mù thì mọi assert dưới đây đều vô nghĩa."""
    assert _ninja_api_dang_mount(), (
        "Không tìm thấy NinjaAPI nào trong URLconf — walker hỏng (django-ninja đổi cách "
        "gắn api vào view?), chứ không phải dự án hết API."
    )


def test_moi_ninja_api_dang_mount_deu_da_dang_ky():
    dang_mount = _ninja_api_dang_mount()
    da_dang_ky = {id(api) for api in NINJA_APIS.values()}

    thieu = [
        f"{api.title!r} v{api.version}"
        for id_api, api in dang_mount.items()
        if id_api not in da_dang_ky
    ]

    assert not thieu, (
        f"NinjaAPI đang mount nhưng CHƯA đăng ký: {thieu}. "
        "Thêm NinjaAPI mới = ĐỦ 3 VIỆC (xem CLAUDE.md): (1) mount vào config/urls.py — đã xong "
        "nếu bạn thấy lỗi này; (2) đăng ký vào config/api_registry.py::NINJA_APIS; "
        "(3) thêm subpath \"./<khoá>\": \"./src-<khoá>/index.ts\" vào "
        "packages/api-client/package.json, nếu không thì client sinh ra mà KHÔNG import được. "
        "KHÔNG phải sửa scripts/codegen.mjs — nó đọc registry rồi lặp."
    )


def test_khong_dang_ky_thua_api_khong_mount():
    """Chiều ngược lại: registry trỏ tới API không ai mount = schema chết, gây hiểu nhầm."""
    dang_mount = set(_ninja_api_dang_mount())

    thua = [khoa for khoa, api in NINJA_APIS.items() if id(api) not in dang_mount]

    assert not thua, f"Đăng ký trong NINJA_APIS nhưng không mount ở urls.py: {thua}"
