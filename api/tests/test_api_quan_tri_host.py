"""Hàng rào Host của PLAN 8.2 — lớp thứ hai, dưới Caddy và trên `ChiMod`.

PLAN mục 10 (Phase 4) đòi đo **cả hai tầng**: "user thường gọi `/api/admin/*` từ origin
public nhận 403 (test cả tầng permission lẫn tầng host)". Tầng permission ở
`test_api_quan_tri_phan_quyen.py`; tầng host là file này.

⚠ Đọc `config/host_admin.py` trước khi đọc con số ở đây: ở **dev**, hai app Next đều
rewrite `/api/*` sang cùng một origin, nên Django thấy cùng một `Host` cho cả hai và
middleware này **không** tách được chúng. Bài đo dưới đây đặt `Host` TƯỜNG MINH — nó
chứng minh cơ chế đúng, không chứng minh rằng dev đã được che.
"""

import pytest
from django.test import override_settings

from config.host_admin import MA_SAI_HOST

from tests._quan_tri import dang_nhap, dung_du_lieu, dung_mod, ma_loi

HOST_QUAN_TRI = "admin.gikky.net"
HOST_CONG_KHAI = "gikky.net"

#: Cả hai host phải nằm trong `ALLOWED_HOSTS`, nếu không Django trả 400 (`DisallowedHost`)
#: TRƯỚC khi middleware chạy — và bài đo sẽ xanh vì một lý do hoàn toàn khác.
cau_hinh = override_settings(
    ALLOWED_HOSTS=[HOST_QUAN_TRI, HOST_CONG_KHAI, "testserver"],
    ADMIN_HOSTS=[HOST_QUAN_TRI],
)


@pytest.fixture
def mod(db):
    dung_du_lieu()
    return dung_mod()


@cau_hinh
def test_host_cong_khai_bi_chan_du_da_dang_nhap_bang_mod(mod):
    """Lớp Host chặn **trước** lớp permission: mod thật, host sai, vẫn 403.

    Đây là điều làm nó thành một lớp riêng chứ không phải bản sao của `ChiMod`: nó không
    quan tâm bạn là ai.
    """
    client = dang_nhap(mod)
    r = client.get("/api/admin/me", headers={"host": HOST_CONG_KHAI})
    assert (r.status_code, ma_loi(r)) == (403, MA_SAI_HOST)


@cau_hinh
def test_host_quan_tri_di_qua_duoc(mod):
    """Chiều ngược: chặn sạch mọi host thì bài trên vẫn xanh và khu quản trị chết."""
    client = dang_nhap(mod)
    r = client.get("/api/admin/me", headers={"host": HOST_QUAN_TRI})
    assert r.status_code == 200, r.content


@cau_hinh
def test_django_admin_cung_nam_trong_pham_vi_hang_rao(client):
    """PLAN 8.2: `/api/admin/django/` nằm TRONG prefix nên "không phải thêm luật nào".

    Câu đó là một lời hứa về phạm vi; đây là chỗ nó được đo. Thiếu vế này thì form đăng
    nhập Django admin vẫn mở ra ở host public trong khi API Ninja đã bị chặn.
    """
    r = client.get("/api/admin/django/", headers={"host": HOST_CONG_KHAI})
    assert (r.status_code, ma_loi(r)) == (403, MA_SAI_HOST)


@cau_hinh
def test_hang_rao_KHONG_cham_toi_api_cong_khai(client, db):
    """Phạm vi phải hẹp đúng bằng prefix: chặn nhầm `/api/v1/*` là site chết ở host chính.

    Đây là vế dễ hỏng nhất khi ai đó "siết cho chắc" bằng `request.path.startswith("/api")`.
    """
    r = client.get("/api/v1/health", headers={"host": HOST_CONG_KHAI})
    assert r.status_code == 200, r.content


@cau_hinh
def test_hang_rao_so_ca_cong_va_khong_phan_biet_hoa_thuong(mod):
    """`Host` mang cổng khi có cổng, và trình duyệt gửi host thường nhưng không đảm bảo.

    So chính xác cả cổng là chủ đích (xem `_duoc_phep`): `admin.gikky.net:8443` KHÁC
    `admin.gikky.net` nếu danh sách chỉ có cái sau — thà chặn nhầm còn hơn mở nhầm.
    """
    client = dang_nhap(mod)
    assert client.get("/api/admin/me", headers={"host": "ADMIN.GIKKY.NET"}).status_code == 200
    r = client.get("/api/admin/me", headers={"host": f"{HOST_QUAN_TRI}:8443"})
    assert (r.status_code, ma_loi(r)) == (403, MA_SAI_HOST)


def test_mac_dinh_cua_dev_cho_testserver_di_qua(client):
    """Không có `override_settings`: cấu hình THẬT của repo phải cho test client đi qua.

    Nếu `ADMIN_HOSTS` mặc định quên `testserver` thì mọi bài đo quản trị khác sẽ đỏ hàng
    loạt với thông điệp về Host — bài này làm nguyên nhân ấy hiện ra ở đúng một chỗ.
    """
    r = client.get("/api/admin/me")
    assert r.status_code == 401, r.content
    assert ma_loi(r) != MA_SAI_HOST
