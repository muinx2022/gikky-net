"""Nhãn «do Gikky tạo» — `plans/2026-11-15-nhan-user-gikky.md`.

Cờ `do_gikky_tao` suy từ domain email ở `la_email_do_gikky`. Mọi cửa trả
`NguoiDungQuanTriOut` đi qua `nguoi_dung_quan_tri_ra`, nên hai GET ở đây đo
đúng chỗ frontend đọc — không chép điều kiện ở từng endpoint.

`?an_gikky=` trên `GET /api/admin/users` (`plans/2026-11-15-loc-user-gikky.md`,
mục «Đổi chiều») loại đúng tập hàm ấy trả true, bằng SQL, trước khi loại staff.
"""

import pytest

from core.models import User

from api.quan_tri_nguoi_dung import la_email_do_gikky

from tests._quan_tri import dang_nhap, dung_mod, dung_thuong

pytestmark = pytest.mark.django_db

EMAIL_DUNG = (
    "a@gikky.net",
    "a+tag@gikky.net",
    "  A@Gikky.NET  ",
    "A+Tag@GIKKY.NET",
)

EMAIL_SAI = (
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
)

#: Cột `email` không nhận `None`. Ca rỗng trong `EMAIL_SAI` lưu `""`.
EMAIL_SUBDOMAIN = "a@vi-du.gikky.net"


@pytest.mark.parametrize("email", EMAIL_DUNG)
def test_la_email_do_gikky_dung(email):
    assert la_email_do_gikky(email) is True


@pytest.mark.parametrize("email", EMAIL_SAI)
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


def _gan_email(username: str, email: str, *, staff: bool = False) -> User:
    u = dung_mod(username) if staff else dung_thuong(username)
    u.email = email
    u.save(update_fields=["email"])
    return u


def _ten(response) -> set[str]:
    assert response.status_code == 200, response.content
    return {u["username"] for u in response.json()["items"]}


def test_an_gikky_true_tra_dung_tap_ham_va_false_giu_ca_hai_phia():
    """`?an_gikky=true` là `{user không staff | not la_email_do_gikky}`. False và thiếu cờ thì có cả hai phía.

    `None` không lưu được. `""` là ca rỗng. Subdomain, `""` và mọi email sai phải
    CÒN khi cờ bật — loại lố là ẩn mất người thật. Khi cờ tắt thì email đúng vẫn còn,
    nếu không thì mặc định đã thành bộ lọc.
    """
    c = dang_nhap(dung_mod("mod_loc_email"))
    tao: list[User] = []
    for i, email in enumerate(EMAIL_DUNG):
        tao.append(_gan_email(f"dung_{i}", email))
    for i, email in enumerate(EMAIL_SAI):
        if email is None:
            continue
        tao.append(_gan_email(f"sai_{i}", email))

    ky_vong = {
        u.username
        for u in User.objects.all()
        if not u.is_staff and not la_email_do_gikky(u.email)
    }
    dung = {f"dung_{i}" for i in range(len(EMAIL_DUNG))}
    sai = {f"sai_{i}" for i, e in enumerate(EMAIL_SAI) if e is not None}
    assert sai <= ky_vong
    assert not (dung & ky_vong)
    assert any(u.email == EMAIL_SUBDOMAIN for u in tao)
    assert any(u.email == "" for u in tao)

    r = c.get("/api/admin/users?an_gikky=true&limit=50")
    assert r.status_code == 200, r.content
    than = r.json()
    ten = {u["username"] for u in than["items"]}
    assert ten == ky_vong
    assert than["tong"] == len(ky_vong)
    sub = next(u.username for u in tao if u.email == EMAIL_SUBDOMAIN)
    rong = next(u.username for u in tao if u.email == "")
    assert sub in ten
    assert rong in ten
    assert not (dung & ten)

    for url in (
        "/api/admin/users?an_gikky=false&limit=50",
        "/api/admin/users?limit=50",
    ):
        mo = _ten(c.get(url))
        assert dung <= mo, url
        assert ky_vong <= mo, url


def test_an_gikky_staff_email_gikky_khong_duoc_dem():
    """Bật `an_gikky`: staff `@gikky.net` không vào `so_staff_an`, staff domain khác vẫn vào.

    `so_staff_an` đếm trên cùng `qs` đã loại domain, nên nó phải đúng bằng số staff
    ngoài domain — và nhỏ hơn số khi tắt cờ đúng một (`staff_trong`).
    """
    c = dang_nhap(dung_mod("mod_dem_gikky"))
    _gan_email("staff_trong", "sep@gikky.net", staff=True)
    _gan_email("staff_ngoai", "sep@example.com", staff=True)
    _gan_email("nguoi_trong", "a@gikky.net")
    _gan_email("nguoi_ngoai", "a@example.com")

    staff_ngoai_domain = sum(
        1
        for u in User.objects.filter(is_staff=True)
        if not la_email_do_gikky(u.email)
    )
    assert staff_ngoai_domain >= 1

    tat = c.get("/api/admin/users?limit=50")
    assert tat.status_code == 200, tat.content

    r = c.get("/api/admin/users?an_gikky=true&limit=50")
    assert r.status_code == 200, r.content
    than = r.json()
    ten = {u["username"] for u in than["items"]}
    assert "staff_trong" not in ten
    assert "staff_ngoai" not in ten
    assert "nguoi_trong" not in ten
    assert "nguoi_ngoai" in ten
    assert than["so_staff_an"] == staff_ngoai_domain
    assert tat.json()["so_staff_an"] - than["so_staff_an"] == 1


def test_an_gikky_and_q_chi_con_nguoi_ngoai_domain():
    """AND: `q=chung` cộng `an_gikky` chỉ còn `chung_b` — người `chung` ngoài domain.

    `chung_a` khớp `q` nhưng ở `@gikky.net` nên bị loại. `nguoi_d` ngoài domain
    nhưng không chứa `chung` — bỏ `q` khi `an_gikky=true` thì người ấy lọt và bài đỏ.
    """
    c = dang_nhap(dung_mod("mod_loc_q"))
    _gan_email("chung_a", "a@gikky.net")
    _gan_email("nguoi_c", "c@gikky.net")
    _gan_email("chung_b", "b@example.com")
    _gan_email("nguoi_d", "d@example.com")

    rong = c.get("/api/admin/users?q=chung&limit=50")
    assert _ten(rong) == {"chung_a", "chung_b"}

    r = c.get("/api/admin/users?an_gikky=true&q=chung&limit=50")
    assert r.status_code == 200, r.content
    than = r.json()
    assert {u["username"] for u in than["items"]} == {"chung_b"}
    assert than["tong"] == 1
