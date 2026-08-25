"""CRUD tài khoản trong khu quản trị — `plans/2026-08-25-crud-nguoi-dung.md`.

## Bài đo QUAN TRỌNG NHẤT: `test_KHONG_cua_nao_doi_duoc_is_staff_hay_is_superuser`

User chốt *"không cần group nữa… chỉ cần show label ra thuộc nhóm nào"*, nên lượt này
**không** cấp quyền qua màn hình nào. PLAN mục 7 giữ nguyên: cấp/thu `is_staff` vẫn nằm
ngoài khu quản trị.

Đó là ranh giới dễ bị "hoàn thiện nốt" nhất — thêm một toggle `is_staff` vào form sửa
trông như làm cho đủ. Bài đo gửi thẳng hai cờ ấy trong body và đòi chúng KHÔNG đổi.

## Hai phép từ chối chống tự khoá ra ngoài

Chúng là hai đường KHÁC NHAU tới cùng một hậu quả, nên cần hai bài đo:

- tự vô hiệu hoá chính mình;
- vô hiệu hoá superuser **cuối cùng** (hai superuser tắt lẫn nhau).
"""

import pytest

from core.ghi import (
    AUDIT_DAT_MAT_KHAU_USER,
    AUDIT_SUA_USER,
    AUDIT_TAO_USER,
)
from core.models import AuditLog, ModSub, Sub, User

from tests._quan_tri import dang_nhap, dung_mod, dung_thuong, goi

pytestmark = pytest.mark.django_db

MK_TOT = "mat-khau-du-manh-2026"


@pytest.fixture
def sieu(db):
    u = dung_mod("sieu_quan_tri")
    u.is_superuser = True
    u.save(update_fields=["is_superuser"])
    return u, dang_nhap(u)


@pytest.fixture
def mod_thuong(db):
    u = dung_mod("mod_thuong")
    return u, dang_nhap(u)


@pytest.fixture
def nan_nhan(db):
    u = dung_thuong("nguoi_bi_sua")
    u.email = "cu@vi-du.gikky.net"
    u.set_password("mat-khau-cu-2026")
    u.save()
    return u


# --- Nhãn "thuộc nhóm nào" (§1) -------------------------------------------------------


def test_vai_tro_dung_ba_nhan(sieu, mod_thuong, nan_nhan):
    _, c = sieu
    lay = lambda un: c.get(f"/api/admin/users/{un}").json()

    assert lay("sieu_quan_tri")["vai_tro"] == "Superuser"
    assert lay("mod_thuong")["vai_tro"] == "Mod"
    assert lay("nguoi_bi_sua")["vai_tro"] == "Thành viên"


def test_superuser_KHONG_bi_hien_thanh_Mod(sieu):
    """Superuser **cũng** `is_staff`, nên thứ tự xét quan trọng.

    Hỏi `is_staff` trước là mọi superuser hiện ra thành "Mod" — sai ở đúng tài khoản quan
    trọng nhất, và không có gì nổ.
    """
    u, c = sieu
    assert u.is_staff and u.is_superuser
    assert c.get("/api/admin/users/sieu_quan_tri").json()["vai_tro"] == "Superuser"


def test_subs_mod_khop_ModSub(sieu, nan_nhan):
    _, c = sieu
    for slug in ["zulu", "alpha"]:
        ModSub.objects.create(
            sub=Sub.objects.create(slug=slug, ten=slug), user=nan_nhan
        )

    b = c.get("/api/admin/users/nguoi_bi_sua").json()
    assert b["subs_mod"] == ["alpha", "zulu"], "phải sắp ổn định"


def test_co_mat_khau_phan_anh_dung_trang_thai(sieu, nan_nhan):
    _, c = sieu
    assert c.get("/api/admin/users/nguoi_bi_sua").json()["co_mat_khau"] is True

    nan_nhan.set_unusable_password()
    nan_nhan.save(update_fields=["password"])
    assert c.get("/api/admin/users/nguoi_bi_sua").json()["co_mat_khau"] is False


# --- §0: KHÔNG cửa nào cấp quyền ------------------------------------------------------


def test_KHONG_cua_nao_doi_duoc_is_staff_hay_is_superuser(sieu, nan_nhan):
    """Ranh giới của lượt này. Gửi thẳng hai cờ lên và đòi chúng KHÔNG đổi.

    Ninja loại trường lạ khỏi body vì schema không khai chúng — nhưng bài đo không tin
    vào cơ chế, nó đo kết quả.
    """
    _, c = sieu

    r = goi(
        c,
        "patch",
        "/api/admin/users/nguoi_bi_sua",
        {"display_name": "Tên mới", "is_staff": True, "is_superuser": True},
    )
    assert r.status_code == 200, r.content

    nan_nhan.refresh_from_db()
    assert nan_nhan.display_name == "Tên mới", "phần hợp lệ vẫn phải được sửa"
    assert nan_nhan.is_staff is False, "cửa sửa cấp được quyền mod"
    assert nan_nhan.is_superuser is False

    # Cả cửa TẠO cũng vậy.
    r = goi(
        c,
        "post",
        "/api/admin/nguoi-dung",
        {
            "username": "nguoi_moi",
            "email": "moi@vi-du.gikky.net",
            "mat_khau": MK_TOT,
            "is_staff": True,
            "is_superuser": True,
        },
    )
    assert r.status_code == 201, r.content
    moi = User.objects.get(username="nguoi_moi")
    assert moi.is_staff is False and moi.is_superuser is False


# --- Mật khẩu (§2) --------------------------------------------------------------------


def test_dat_mat_khau_moi(sieu, nan_nhan):
    _, c = sieu
    r = goi(c, "post", "/api/admin/users/nguoi_bi_sua/mat-khau", {"mat_khau": MK_TOT})
    assert r.status_code == 200, r.content

    nan_nhan.refresh_from_db()
    assert nan_nhan.check_password(MK_TOT)
    assert r.json()["co_mat_khau"] is True


def test_set_pass_RONG_xoa_mat_khau(sieu, nan_nhan):
    """Vế "set pass rỗng" của đơn hàng. Không phải khoá ngoài — vào bằng Google/đặt lại."""
    _, c = sieu
    r = goi(c, "post", "/api/admin/users/nguoi_bi_sua/mat-khau", {"mat_khau": None})
    assert r.status_code == 200, r.content

    nan_nhan.refresh_from_db()
    assert nan_nhan.has_usable_password() is False
    assert r.json()["co_mat_khau"] is False

    # Và đặt lại được — chứng minh "không khoá ngoài" chứ không chỉ nói.
    goi(c, "post", "/api/admin/users/nguoi_bi_sua/mat-khau", {"mat_khau": MK_TOT})
    nan_nhan.refresh_from_db()
    assert nan_nhan.check_password(MK_TOT)


@pytest.mark.parametrize("yeu", ["123", "abc", "password", "nguoi_bi_sua"])
def test_mat_khau_YEU_bi_tu_choi_va_giu_nguyen_cai_cu(sieu, nan_nhan, yeu):
    """Cửa này đặt mật khẩu cho **người khác** — bỏ validator là mở cửa yếu hơn cả đăng ký."""
    _, c = sieu
    r = goi(c, "post", "/api/admin/users/nguoi_bi_sua/mat-khau", {"mat_khau": yeu})
    assert r.status_code == 400, r.content

    nan_nhan.refresh_from_db()
    assert nan_nhan.check_password("mat-khau-cu-2026"), "mật khẩu cũ bị đụng dù đã từ chối"


# --- Vô hiệu hoá (§3) -----------------------------------------------------------------


def test_vo_hieu_hoa_va_kich_hoat_lai(sieu, nan_nhan):
    _, c = sieu
    assert goi(c, "patch", "/api/admin/users/nguoi_bi_sua", {"is_active": False}).status_code == 200
    nan_nhan.refresh_from_db()
    assert nan_nhan.is_active is False

    assert goi(c, "patch", "/api/admin/users/nguoi_bi_sua", {"is_active": True}).status_code == 200
    nan_nhan.refresh_from_db()
    assert nan_nhan.is_active is True


def test_KHONG_tu_vo_hieu_hoa_chinh_minh(sieu):
    u, c = sieu
    r = goi(c, "patch", "/api/admin/users/sieu_quan_tri", {"is_active": False})
    assert r.status_code == 409, r.content

    u.refresh_from_db()
    assert u.is_active is True


def test_luon_con_it_nhat_mot_superuser_hoat_dong(sieu):
    """Bất biến thật: không chuỗi thao tác hợp lệ nào làm cạn sạch superuser.

    ⚠ **Bài đo này CỐ Ý không nói mình đo nhánh "superuser cuối cùng".** Bản đầu có hai
    bài mang tên ấy, và lượt thử phá cho thấy **gỡ hẳn nhánh đó đi thì chúng vẫn XANH** —
    cả hai thực ra bị phép kiểm "không tự vô hiệu hoá mình" chặn trước. Đúng loài *proof
    đo RỖNG*: tên bài hứa một đằng, thứ nó chạm là một nẻo.

    Nhánh ấy hôm nay không với tới được (lý do ở `sua_nguoi_dung`). Nên thứ đo được, và
    đáng đo, là **bất biến** — chứ không phải một dòng `if`.
    """
    u2 = dung_mod("sieu_hai")
    u2.is_superuser = True
    u2.save(update_fields=["is_superuser"])
    _, c = sieu

    # Tắt được superuser KHÁC khi còn người thay.
    assert goi(c, "patch", "/api/admin/users/sieu_hai", {"is_active": False}).status_code == 200

    # Nhưng người cuối cùng thì không tự tắt mình được.
    assert goi(c, "patch", "/api/admin/users/sieu_quan_tri", {"is_active": False}).status_code == 409

    assert User.objects.filter(is_superuser=True, is_active=True).count() >= 1


# --- Tạo (§4) -------------------------------------------------------------------------


def test_tao_tai_khoan_email_da_xac_thuc(sieu):
    from allauth.account.models import EmailAddress

    _, c = sieu
    r = goi(
        c,
        "post",
        "/api/admin/nguoi-dung",
        {"username": "nguoi_moi", "email": "Moi@Vi-Du.Gikky.NET", "mat_khau": MK_TOT},
    )
    assert r.status_code == 201, r.content

    u = User.objects.get(username="nguoi_moi")
    assert u.email == "moi@vi-du.gikky.net", "email phải được chuẩn hoá về chữ thường"
    assert u.check_password(MK_TOT)
    assert EmailAddress.objects.filter(user=u, verified=True, primary=True).exists()


def test_tao_khong_mat_khau_thi_vao_bang_google(sieu):
    _, c = sieu
    r = goi(
        c,
        "post",
        "/api/admin/nguoi-dung",
        {"username": "chi_google", "email": "g@vi-du.gikky.net"},
    )
    assert r.status_code == 201, r.content
    assert r.json()["co_mat_khau"] is False
    assert User.objects.get(username="chi_google").has_usable_password() is False


@pytest.mark.parametrize(
    "body,ma",
    [
        ({"username": "", "email": "a@b.c"}, 400),
        ({"username": "x", "email": "  "}, 400),
        ({"username": "x", "email": "a@b.c", "mat_khau": "123"}, 400),
    ],
)
def test_tao_sai_hinh_dang_bi_tu_choi_va_KHONG_de_lai_hang(sieu, body, ma):
    _, c = sieu
    truoc = User.objects.count()
    assert goi(c, "post", "/api/admin/nguoi-dung", body).status_code == ma
    assert User.objects.count() == truoc


def test_username_va_email_TRUNG_tra_409(sieu, nan_nhan):
    _, c = sieu
    r = goi(
        c,
        "post",
        "/api/admin/nguoi-dung",
        {"username": "NGUOI_BI_SUA", "email": "khac@vi-du.gikky.net"},
    )
    assert r.status_code == 409, "username trùng phải bắt được kể cả khác hoa/thường"

    r = goi(
        c,
        "post",
        "/api/admin/nguoi-dung",
        {"username": "khac_hoan_toan", "email": "CU@vi-du.gikky.net"},
    )
    assert r.status_code == 409, "email trùng phải bắt được kể cả khác hoa/thường"


# --- Phân quyền (§2) ------------------------------------------------------------------


def test_mod_thuong_DOC_duoc_nhung_KHONG_ghi_duoc(mod_thuong, nan_nhan):
    _, c = mod_thuong

    assert c.get("/api/admin/users/nguoi_bi_sua").status_code == 200

    assert goi(c, "patch", "/api/admin/users/nguoi_bi_sua", {"display_name": "X"}).status_code == 403
    assert goi(c, "post", "/api/admin/users/nguoi_bi_sua/mat-khau", {"mat_khau": MK_TOT}).status_code == 403
    assert goi(
        c, "post", "/api/admin/nguoi-dung", {"username": "z", "email": "z@vi-du.gikky.net"}
    ).status_code == 403

    nan_nhan.refresh_from_db()
    assert nan_nhan.display_name != "X"
    assert nan_nhan.check_password("mat-khau-cu-2026")


# --- Nhật ký (§5) ---------------------------------------------------------------------


def test_ghi_nhat_ky_nhung_KHONG_ghi_mat_khau(sieu, nan_nhan):
    _, c = sieu
    goi(c, "post", "/api/admin/users/nguoi_bi_sua/mat-khau", {"mat_khau": MK_TOT})
    goi(c, "patch", "/api/admin/users/nguoi_bi_sua", {"display_name": "Tên mới"})
    goi(
        c,
        "post",
        "/api/admin/nguoi-dung",
        {"username": "nguoi_moi", "email": "moi@vi-du.gikky.net", "mat_khau": MK_TOT},
    )

    dong = list(AuditLog.objects.order_by("pk"))
    assert [d.action for d in dong] == [
        AUDIT_DAT_MAT_KHAU_USER,
        AUDIT_SUA_USER,
        AUDIT_TAO_USER,
    ]
    for d in dong:
        assert MK_TOT not in str(d.meta), "mật khẩu lọt vào nhật ký"
    assert dong[0].meta["xoa"] is False


def test_mod_thuong_bi_tu_choi_thi_KHONG_de_lai_nhat_ky(mod_thuong, nan_nhan):
    _, c = mod_thuong
    goi(c, "post", "/api/admin/users/nguoi_bi_sua/mat-khau", {"mat_khau": MK_TOT})
    assert AuditLog.objects.count() == 0
