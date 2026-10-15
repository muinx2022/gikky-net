"""Test tính năng Lưu trữ (soft delete) mạch và quản lý trạng thái lưu trữ.

Quy tắc:
1. Tác giả được phép lưu trữ hoặc bỏ lưu trữ mạch của mình qua `POST /api/v1/machs/{id}/luu-tru`.
2. Người khác không phải tác giả và không phải staff ⇒ 403 `khong_phai_chu`.
3. Chưa đăng nhập ⇒ 401.
4. Khi mạch đã lưu trữ (`archived_at IS NOT NULL`):
   - Mạch biến mất khỏi feed công khai (`/api/v1/feeds/moi`, `/api/v1/feeds/dang-dien-ra`).
   - Mạch biến mất khỏi tab Bài viết công khai của hồ sơ (`/api/v1/users/{username}/machs`).
   - Khách hoặc người ngoài vào xem trực tiếp `/api/v1/machs/{id}` ⇒ 404 `khong_tim_thay`.
   - Tác giả hoặc staff vào xem trực tiếp `/api/v1/machs/{id}` ⇒ 200 kèm `da_luu_tru=True`.
5. Tab Lưu trữ:
   - Tác giả lấy danh sách bài lưu trữ qua `GET /api/v1/me/luu-tru` ⇒ 200 với danh sách bài đã lưu trữ.
   - Hoặc `GET /api/v1/users/{username}/machs?da_luu_tru=true`: chỉ tác giả và staff xem được.
6. Admin quản lý:
   - Mod/Admin có thể lưu trữ hoặc bỏ lưu trữ mạch qua `POST /api/admin/machs/{id}/luu-tru`.
   - Bảng mạch admin hỗ trợ lọc `?trang_thai=luu_tru`.
   - `MachDongOut` và `MachQuanTriOut` trả `da_luu_tru=True`.
"""

import pytest
from django.utils import timezone

from api.quyen import KHONG_PHAI_CHU
from tests.conftest import dat, ma_loi
from tests._quan_tri import dang_nhap, dung_mod

pytestmark = pytest.mark.django_db


def test_tac_gia_luu_tru_va_bo_luu_tru_mach(client, mach_cua_a, nguoi_a):
    client.force_login(nguoi_a)
    url = f"/api/v1/machs/{mach_cua_a.pk}/luu-tru"

    # Lưu trữ mạch
    d = dat(client, url, {"luu_tru": True}, status=200)
    assert d["da_luu_tru"] is True
    assert d["da_doi"] is True
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.archived_at is not None
    assert mach_cua_a.archived_by_id == nguoi_a.pk

    # Gọi lại idempotent
    d2 = dat(client, url, {"luu_tru": True}, status=200)
    assert d2["da_luu_tru"] is True
    assert d2["da_doi"] is False

    # Bỏ lưu trữ mạch
    d3 = dat(client, url, {"luu_tru": False}, status=200)
    assert d3["da_luu_tru"] is False
    assert d3["da_doi"] is True
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.archived_at is None
    assert mach_cua_a.archived_by_id is None


def test_nguoi_khac_khong_luu_tru_duoc(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    url = f"/api/v1/machs/{mach_cua_a.pk}/luu-tru"
    assert ma_loi(client, url, {"luu_tru": True}, status=403) == KHONG_PHAI_CHU


def test_khach_chua_dang_nhap_bi_401(client, mach_cua_a):
    url = f"/api/v1/machs/{mach_cua_a.pk}/luu-tru"
    r = client.post(url, data='{"luu_tru": true}', content_type="application/json")
    assert r.status_code == 401


def test_mach_da_luu_tru_khong_xuat_hien_tren_feed_va_ho_so(client, mach_cua_a, nguoi_a, nguoi_b):
    client.force_login(nguoi_a)
    url_luu = f"/api/v1/machs/{mach_cua_a.pk}/luu-tru"
    dat(client, url_luu, {"luu_tru": True}, status=200)

    # 1. Feed "Mới"
    res_feed = client.get("/api/v1/feeds/moi")
    items_feed = res_feed.json()["items"]
    ids_feed = [m["id"] for m in items_feed]
    assert mach_cua_a.pk not in ids_feed

    # 2. Tab "Bài viết" của profile
    res_user = client.get(f"/api/v1/users/{nguoi_a.username}/machs")
    items_user = res_user.json()["items"]
    ids_user = [m["id"] for m in items_user]
    assert mach_cua_a.pk not in ids_user

    # 3. Người ngoài vào URL chi tiết /machs/{id} => 404
    client.force_login(nguoi_b)
    res_detail_b = client.get(f"/api/v1/machs/{mach_cua_a.pk}")
    assert res_detail_b.status_code == 404

    # 4. Chính tác giả vào URL chi tiết /machs/{id} => 200 kèm da_luu_tru=True
    client.force_login(nguoi_a)
    res_detail_a = client.get(f"/api/v1/machs/{mach_cua_a.pk}")
    assert res_detail_a.status_code == 200
    assert res_detail_a.json()["da_luu_tru"] is True


def test_tab_luu_tru_cua_user(client, mach_cua_a, nguoi_a, nguoi_b):
    client.force_login(nguoi_a)
    url_luu = f"/api/v1/machs/{mach_cua_a.pk}/luu-tru"
    dat(client, url_luu, {"luu_tru": True}, status=200)

    # 1. Endpoint /me/luu-tru
    res_me = client.get("/api/v1/me/luu-tru")
    assert res_me.status_code == 200
    items_me = res_me.json()["items"]
    ids_me = [m["id"] for m in items_me]
    assert mach_cua_a.pk in ids_me
    assert items_me[0]["da_luu_tru"] is True

    # 2. Người khác xem /me/luu-tru => không có bài của A
    client.force_login(nguoi_b)
    res_me_b = client.get("/api/v1/me/luu-tru")
    assert res_me_b.status_code == 200
    ids_me_b = [m["id"] for m in res_me_b.json()["items"]]
    assert mach_cua_a.pk not in ids_me_b

    # 3. /users/{username}/machs?da_luu_tru=true
    # Người khác xem của A => rỗng
    res_other = client.get(f"/api/v1/users/{nguoi_a.username}/machs?da_luu_tru=true")
    assert res_other.status_code == 200
    assert len(res_other.json()["items"]) == 0

    # Chính A xem => thấy bài
    client.force_login(nguoi_a)
    res_self = client.get(f"/api/v1/users/{nguoi_a.username}/machs?da_luu_tru=true")
    assert res_self.status_code == 200
    ids_self = [m["id"] for m in res_self.json()["items"]]
    assert mach_cua_a.pk in ids_self


def test_admin_quan_ly_luu_tru(client, mach_cua_a, nguoi_a):
    mod = dung_mod()
    client_mod = dang_nhap(mod)

    # Admin lưu trữ bài
    url_admin_luu = f"/api/admin/machs/{mach_cua_a.pk}/luu-tru"
    res_luu = client_mod.post(
        url_admin_luu,
        data='{"luu_tru": true, "ly_do": "Admin lưu trữ"}',
        content_type="application/json",
    )
    assert res_luu.status_code == 200
    assert res_luu.json()["dang_bat"] is True
    assert res_luu.json()["da_doi"] is True

    # Chi tiết bài trên admin thấy da_luu_tru = True
    res_detail = client_mod.get(f"/api/admin/machs/{mach_cua_a.pk}")
    assert res_detail.status_code == 200
    assert res_detail.json()["da_luu_tru"] is True

    # Danh sách bài viết admin lọc trang_thai=luu_tru
    res_list = client_mod.get("/api/admin/machs?trang_thai=luu_tru")
    assert res_list.status_code == 200
    ids_luu_tru = [m["id"] for m in res_list.json()["items"]]
    assert mach_cua_a.pk in ids_luu_tru
    assert res_list.json()["items"][0]["da_luu_tru"] is True

    # Admin bỏ lưu trữ bài
    res_bo = client_mod.post(
        url_admin_luu,
        data='{"luu_tru": false, "ly_do": "Admin khôi phục"}',
        content_type="application/json",
    )
    assert res_bo.status_code == 200
    assert res_bo.json()["dang_bat"] is False
    assert res_bo.json()["da_doi"] is True

    mach_cua_a.refresh_from_db()
    assert mach_cua_a.archived_at is None
