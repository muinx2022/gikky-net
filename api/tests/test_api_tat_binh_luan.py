"""Test tính năng tắt / mở bình luận của tác giả (plans/2026-09-07-tat-mo-binh-luan.md).

Quy tắc:
1. Tác giả được phép tắt hoặc mở lại bình luận của mạch.
2. Người khác không phải tác giả ⇒ 403 `khong_phai_chu`.
3. Chưa đăng nhập ⇒ 401.
4. Mạch bị mod khoá ⇒ 403 `mach_bi_khoa` (tác giả KHÔNG được đổi khi mod đã khoá).
5. Khi bình luận bị tắt ⇒ viết bình luận mới nhận 403 `binh_luan_da_tat`.
6. Khi mở lại bình luận ⇒ viết bình luận bình thường (201).
7. Đăng bài mới kèm `tat_binh_luan=True` ⇒ mạch sinh ra đã tắt bình luận.
"""

import pytest
from django.utils import timezone

from api.quyen import BINH_LUAN_DA_TAT, KHONG_PHAI_CHU, MACH_BI_KHOA
from tests.conftest import dat, ma_loi

pytestmark = pytest.mark.django_db


def test_tac_gia_tat_va_mo_lai_binh_luan(client, mach_cua_a, nguoi_a):
    client.force_login(nguoi_a)
    url = f"/api/v1/machs/{mach_cua_a.pk}/tat-binh-luan"

    # Tắt bình luận
    d = dat(client, url, {"tat": True}, status=200)
    assert d["tat_binh_luan"] is True
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.tat_binh_luan is True

    # Mở lại bình luận
    d = dat(client, url, {"tat": False}, status=200)
    assert d["tat_binh_luan"] is False
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.tat_binh_luan is False


def test_nguoi_khac_khong_tat_binh_luan_duoc(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    url = f"/api/v1/machs/{mach_cua_a.pk}/tat-binh-luan"
    assert ma_loi(client, url, {"tat": True}, status=403) == KHONG_PHAI_CHU


def test_khach_chua_dang_nhap_bi_401(client, mach_cua_a):
    url = f"/api/v1/machs/{mach_cua_a.pk}/tat-binh-luan"
    r = client.post(url, data='{"tat": true}', content_type="application/json")
    assert r.status_code == 401


def test_mach_bi_mod_khoa_thi_tac_gia_khong_doi_duoc(client, mach_cua_a, nguoi_a):
    client.force_login(nguoi_a)
    mach_cua_a.locked_at = timezone.now()
    mach_cua_a.save(update_fields=["locked_at"])

    url = f"/api/v1/machs/{mach_cua_a.pk}/tat-binh-luan"
    assert ma_loi(client, url, {"tat": True}, status=403) == MACH_BI_KHOA
    assert ma_loi(client, url, {"tat": False}, status=403) == MACH_BI_KHOA


def test_tat_binh_luan_chan_viet_binh_luan(client, mach_cua_a, nguoi_a, nguoi_b):
    url_tat = f"/api/v1/machs/{mach_cua_a.pk}/tat-binh-luan"
    url_bl = f"/api/v1/machs/{mach_cua_a.pk}/comments"

    # Tác giả tắt bình luận
    client.force_login(nguoi_a)
    dat(client, url_tat, {"tat": True}, status=200)

    # Người khác cố viết bình luận ⇒ 403 binh_luan_da_tat
    client.force_login(nguoi_b)
    assert ma_loi(client, url_bl, {"body": "Bình luận thử"}, status=403) == BINH_LUAN_DA_TAT

    # Chính tác giả cũng bị chặn khi đang tắt bình luận
    client.force_login(nguoi_a)
    assert ma_loi(client, url_bl, {"body": "Tác giả tự cmt"}, status=403) == BINH_LUAN_DA_TAT

    # Mở lại bình luận
    dat(client, url_tat, {"tat": False}, status=200)

    # Người khác viết lại được bình thường
    client.force_login(nguoi_b)
    kq = dat(client, url_bl, {"body": "Bình luận sau khi mở lại"}, status=201)
    assert kq["body"] == "Bình luận sau khi mở lại"


def test_dang_bai_kem_tat_binh_luan(client, sub, nguoi_a):
    client.force_login(nguoi_a)
    d = dat(
        client,
        "/api/v1/machs",
        {
            "sub": sub.slug,
            "title": "Mạch tắt bình luận từ đầu",
            "body": "Nội dung mốc 1.",
            "tat_binh_luan": True,
        },
        status=201,
    )
    assert d["tat_binh_luan"] is True
