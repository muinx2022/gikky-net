"""Nhãn «do Gikky tạo» — `plans/2026-11-15-nhan-user-gikky.md`.

Cờ `do_gikky_tao` suy từ domain email ở `la_email_do_gikky`. Mọi cửa trả
`NguoiDungQuanTriOut` đi qua `nguoi_dung_quan_tri_ra`, nên hai GET ở đây đo
đúng chỗ frontend đọc — không chép điều kiện ở từng endpoint.
"""

import pytest

from api.quan_tri_nguoi_dung import la_email_do_gikky

from tests._quan_tri import dang_nhap, dung_mod, dung_thuong

pytestmark = pytest.mark.django_db


@pytest.mark.parametrize(
    "email",
    [
        "a@gikky.net",
        "a+tag@gikky.net",
        "  A@Gikky.NET  ",
        "A+Tag@GIKKY.NET",
    ],
)
def test_la_email_do_gikky_dung(email):
    assert la_email_do_gikky(email) is True


@pytest.mark.parametrize(
    "email",
    [
        None,
        "",
        "   ",
        "a@vi-du.gikky.net",
        "a@gikky.net.evil",
        "a@notgikky.net",
        "@gikky.net",
        "a@b@gikky.net",
        "a@gikky.net.",
        "a b@gikky.net",
        "a\tb@gikky.net",
        "gikky.net",
        "a@",
    ],
)
def test_la_email_do_gikky_sai(email):
    assert la_email_do_gikky(email) is False


def test_hai_cua_get_tra_co_va_khong_loc_mat_subdomain():
    """`a@gikky.net` là true, subdomain là false, và subdomain vẫn còn trong bảng.

    `/users` loại `is_staff`, không loại theo domain. Nhãn không phải bộ lọc.
    """
    c = dang_nhap(dung_mod("mod_nhan_gikky"))

    trong = dung_thuong("nguoi_gikky")
    trong.email = "a@gikky.net"
    trong.save(update_fields=["email"])

    ngoai = dung_thuong("nguoi_subdomain")
    ngoai.email = "cu@vi-du.gikky.net"
    ngoai.save(update_fields=["email"])

    xem_trong = c.get("/api/admin/users/nguoi_gikky")
    assert xem_trong.status_code == 200, xem_trong.content
    assert xem_trong.json()["do_gikky_tao"] is True

    xem_ngoai = c.get("/api/admin/users/nguoi_subdomain")
    assert xem_ngoai.status_code == 200, xem_ngoai.content
    assert xem_ngoai.json()["do_gikky_tao"] is False

    bang = c.get("/api/admin/users")
    assert bang.status_code == 200, bang.content
    theo_ten = {u["username"]: u["do_gikky_tao"] for u in bang.json()["items"]}
    assert "nguoi_subdomain" in theo_ten, "subdomain bị lọc khỏi danh sách"
    assert "nguoi_gikky" in theo_ten
    assert theo_ten["nguoi_gikky"] is True
    assert theo_ten["nguoi_subdomain"] is False
