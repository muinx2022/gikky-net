"""`POST /me/avatar` · `DELETE /me/avatar` — ảnh đại diện (2026-08-24).

Tái dùng bộ dựng ảnh của Phase 5 (`_anh.py`) và fixture `kho_anh` (dời hai kho ảnh sang
`tmp_path`). Ba nhóm câu hỏi:

1. **Đường ghi hạnh phúc**: ảnh lên → `avatar_url` trong `GET /me` + file trên đĩa; đổi
   avatar thì file CŨ biến mất; gỡ thì cả cột lẫn file biến mất.
2. **Bảy phép kiểm còn nguyên**: file rác / định dạng lạ / quá nặng bị từ chối đúng mã —
   avatar KHÔNG được là cửa thứ hai nhận file mà bỏ qua kiểm (thử phá A).
3. **Per-user**: 401 cho khách, `no-store` trên cả hai cửa (thử phá B), và `avatar_url`
   lan đúng sang `NguoiDungTomTatOut` (feed/mạch) lẫn `HoSoOut`.
"""

import json

import pytest

from core.anh import ANH_HONG, ANH_QUA_NANG, BYTE_TOI_DA, DINH_DANG_KHONG_NHAN
from core.anh_luu import duong_dan_chinh, duong_dan_thumb
from core.models.nguoi_dung import User

from ._anh import PHP_GIA_JPG, SVG_GIA_JPG, anh_byte, duoi_va_byte
from .conftest import file_trong, lay, so_file

pytestmark = pytest.mark.usefixtures("kho_anh")

AVATAR = "/api/v1/me/avatar"


def dat_avatar(client, du_lieu: bytes = None, *, ten="a.jpg", status=200):
    """POST multipart một ảnh avatar. Trả thân đã parse (một `ToiOut`)."""
    if du_lieu is None:
        du_lieu = anh_byte()
    _, f, _ = duoi_va_byte(du_lieu, ten)
    r = client.post(AVATAR, {"file": f})
    assert r.status_code == status, (
        f"POST avatar trả {r.status_code}, mong {status}: {r.content[:400]!r}"
    )
    return json.loads(r.content) if r.content else None


def ma_loi_avatar(client, du_lieu: bytes, *, status: int) -> str:
    than = dat_avatar(client, du_lieu, status=status)
    assert "code" in than, f"thân lỗi thiếu `code`: {than!r}"
    return than["code"]


def khoa_cua(user) -> str:
    return User.objects.get(pk=user.pk).avatar_khoa


# --- đường ghi hạnh phúc -----------------------------------------------------


@pytest.mark.django_db
def test_tai_avatar_len_thi_GET_me_thay_url_va_file_tren_dia(client, nguoi_a, kho_anh):
    client.force_login(nguoi_a)
    d = dat_avatar(client)
    assert d["avatar_url"] and d["avatar_url"].startswith("/media/")
    assert "anh-thumb" in d["avatar_url"], "avatar phục vụ bằng THUMBNAIL"

    # Đọc lại qua GET, không chỉ tin response của POST.
    assert lay(client, "/api/v1/me")["avatar_url"] == d["avatar_url"]

    phuc_vu, _ = kho_anh
    khoa = khoa_cua(nguoi_a)
    assert khoa and (phuc_vu / duong_dan_chinh(khoa)).exists()
    assert (phuc_vu / duong_dan_thumb(khoa)).exists()
    assert so_file(phuc_vu) == 2, "đúng hai file: ảnh chính + thumbnail"


@pytest.mark.django_db
def test_doi_avatar_thi_file_CU_bien_mat(client, nguoi_a, kho_anh):
    client.force_login(nguoi_a)
    dat_avatar(client)
    khoa_cu = khoa_cua(nguoi_a)
    phuc_vu, _ = kho_anh
    assert file_trong(phuc_vu) == {khoa_cu}

    dat_avatar(client, anh_byte(dinh_dang="PNG"))
    khoa_moi = khoa_cua(nguoi_a)

    assert khoa_moi != khoa_cu
    assert file_trong(phuc_vu) == {khoa_moi}, "avatar cũ phải bị dọn, không tích rác"
    assert so_file(phuc_vu) == 2


@pytest.mark.django_db
def test_xoa_avatar_thi_cot_rong_va_file_bien_mat(client, nguoi_a, kho_anh):
    client.force_login(nguoi_a)
    dat_avatar(client)
    phuc_vu, _ = kho_anh
    assert so_file(phuc_vu) == 2

    r = client.delete(AVATAR)
    assert r.status_code == 200 and r.json()["avatar_url"] is None
    assert khoa_cua(nguoi_a) == ""
    assert file_trong(phuc_vu) == set(), "gỡ avatar phải xoá THẬT file (không có kho cách ly)"


@pytest.mark.django_db
def test_xoa_avatar_khi_chua_co_van_200_idempotent(client, nguoi_a):
    client.force_login(nguoi_a)
    r = client.delete(AVATAR)
    assert r.status_code == 200 and r.json()["avatar_url"] is None


# --- bảy phép kiểm còn nguyên (thử phá A) ------------------------------------


@pytest.mark.django_db
def test_file_rac_doi_duoi_jpg_bi_tu_choi(client, nguoi_a, kho_anh):
    """Thử phá A: bỏ `xu_ly_anh_tai_len` (nhận thẳng bytes) là bài này ĐỎ.

    File PHP đổi đuôi `.jpg` + `Content-Type: image/jpeg` — server không tin hai giá trị
    ấy, nó nhận dạng bằng NỘI DUNG và từ chối.
    """
    client.force_login(nguoi_a)
    assert ma_loi_avatar(client, PHP_GIA_JPG, status=400) == ANH_HONG

    phuc_vu, _ = kho_anh
    assert so_file(phuc_vu) == 0, "ảnh rác không được để lại byte nào trên đĩa"
    assert khoa_cua(nguoi_a) == ""


@pytest.mark.django_db
def test_svg_bi_tu_choi(client, nguoi_a):
    """SVG là XML chạy script khi trình duyệt mở — allowlist không có nó."""
    client.force_login(nguoi_a)
    assert ma_loi_avatar(client, SVG_GIA_JPG, status=400) == ANH_HONG


@pytest.mark.django_db
def test_gif_bi_tu_choi(client, nguoi_a):
    client.force_login(nguoi_a)
    assert ma_loi_avatar(client, anh_byte(dinh_dang="GIF"), status=400) == DINH_DANG_KHONG_NHAN


@pytest.mark.django_db
def test_anh_qua_nang_tra_413(client, nguoi_a):
    client.force_login(nguoi_a)
    assert ma_loi_avatar(client, b"\x00" * (BYTE_TOI_DA + 10), status=413) == ANH_QUA_NANG


# --- per-user: 401, no-store (thử phá B) -------------------------------------


@pytest.mark.django_db
def test_khach_chua_dang_nhap_nhan_401(client, db):
    _, f, _ = duoi_va_byte(anh_byte())
    assert client.post(AVATAR, {"file": f}).status_code == 401
    assert client.delete(AVATAR).status_code == 401


@pytest.mark.django_db
def test_POST_avatar_no_store(client, nguoi_a):
    """Thử phá B: bỏ `no-store` trên POST là bài này ĐỎ. `GET /me` per-user, cấm cache
    (PLAN 8.4) — avatar là một mảnh của nó."""
    client.force_login(nguoi_a)
    _, f, _ = duoi_va_byte(anh_byte())
    r = client.post(AVATAR, {"file": f})
    assert r.status_code == 200 and r["Cache-Control"] == "no-store"


@pytest.mark.django_db
def test_DELETE_avatar_no_store(client, nguoi_a):
    """Thử phá B, vế DELETE."""
    client.force_login(nguoi_a)
    r = client.delete(AVATAR)
    assert r.status_code == 200 and r["Cache-Control"] == "no-store"


# --- avatar_url lan đúng sang schema tác giả dùng chung ----------------------


@pytest.mark.django_db
def test_avatar_url_hien_o_author_cua_feed_va_mach(client, nguoi_a, mach_cua_a):
    """`NguoiDungTomTatOut.avatar_url` — public, ai xem cũng thấy avatar tác giả."""
    client.force_login(nguoi_a)
    url = dat_avatar(client)["avatar_url"]

    feed = lay(client, "/api/v1/feeds/moi?limit=50")
    the = next(m for m in feed["items"] if m["id"] == mach_cua_a.pk)
    assert the["author"]["avatar_url"] == url

    mach = lay(client, f"/api/v1/machs/{mach_cua_a.pk}")
    assert mach["author"]["avatar_url"] == url
    assert mach["mocs"][0]["author"]["avatar_url"] == url


@pytest.mark.django_db
def test_avatar_url_hien_o_ho_so(client, nguoi_a, mach_cua_a):
    client.force_login(nguoi_a)
    url = dat_avatar(client)["avatar_url"]

    ho_so = lay(client, f"/api/v1/users/{nguoi_a.username}")
    assert ho_so["avatar_url"] == url


@pytest.mark.django_db
def test_chua_co_avatar_thi_null_khap_noi(client, nguoi_a, mach_cua_a):
    assert lay(client, "/api/v1/me")["avatar_url"] is None
    assert lay(client, f"/api/v1/users/{nguoi_a.username}")["avatar_url"] is None
    mach = lay(client, f"/api/v1/machs/{mach_cua_a.pk}")
    assert mach["author"]["avatar_url"] is None
