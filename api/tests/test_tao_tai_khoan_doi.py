"""`manage.py tao_tai_khoan_doi` — ba tài khoản đội ngũ dựng từ mật khẩu trong `.env`.

User chốt 2026-08-24. Bốn câu hỏi, và câu (2) là câu quan trọng nhất: **tài khoản tạo ra
có ĐĂNG BÀI được không**. Một hàng `User` đúng nhưng thiếu `EmailAddress(verified=True)`
thì đăng nhập được mà mọi cửa ghi trả lỗi, và lỗi ấy không nói gì về email —
`ACCOUNT_EMAIL_VERIFICATION = "mandatory"` tra bảng của allauth, không tra cột nào trên
`User`.
"""

import pytest
from allauth.account.models import EmailAddress
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError

from core.management.commands.tao_tai_khoan_doi import (
    BIEN_TEN_MIEN_EMAIL,
    TAI_KHOAN,
    TEN_MIEN_EMAIL_MAC_DINH,
)

User = get_user_model()

pytestmark = pytest.mark.django_db

#: Mật khẩu chỉ sống trong bài đo này. Không dùng lại chuỗi của `seed_dev`: hai bộ dữ liệu
#: dựng sẵn dùng chung một mật khẩu là thứ sẽ được chép sang môi trường thật.
MAT_KHAU = {ten: f"mat-khau-do-{i}-KHONG-that" for i, (ten, *_) in enumerate(TAI_KHOAN)}


@pytest.fixture
def env_du(monkeypatch):
    for ten, gia_tri in MAT_KHAU.items():
        monkeypatch.setenv(ten, gia_tri)


def test_dung_du_ba_tai_khoan_va_dang_nhap_duoc(env_du):
    call_command("tao_tai_khoan_doi")
    for bien, username, ten_hien_thi, la_super in TAI_KHOAN:
        u = User.objects.get(username=username)
        assert u.display_name == ten_hien_thi
        assert u.is_active is True
        assert u.is_superuser is la_super
        # `is_staff` đi CÙNG `is_superuser`: hai tài khoản đăng bài không được lảng vảng
        # vào khu quản trị.
        assert u.is_staff is la_super
        assert u.check_password(MAT_KHAU[bien]) is True


def test_tai_khoan_GHI_duoc_ngay_khong_can_buoc_xac_thuc_email(env_du):
    """Vế dễ quên nhất — xem docstring module."""
    call_command("tao_tai_khoan_doi")
    for _, username, *_ in TAI_KHOAN:
        u = User.objects.get(username=username)
        hang = EmailAddress.objects.get(user=u, email=u.email)
        assert hang.verified is True
        assert hang.primary is True


def test_chay_lai_khong_dung_them_hang_nao(env_du):
    call_command("tao_tai_khoan_doi")
    so_user = User.objects.count()
    so_email = EmailAddress.objects.count()
    call_command("tao_tai_khoan_doi")
    assert User.objects.count() == so_user
    assert EmailAddress.objects.count() == so_email


def test_tai_khoan_CO_SAN_chua_xac_thuc_thi_duoc_va_lai(env_du):
    """`update_or_create`, không phải `get_or_create`.

    `admin` thường đã tồn tại từ `createsuperuser` và mang một hàng `EmailAddress` chưa
    xác thực. Với `get_or_create` thì lệnh chạy xong, báo thành công, mà tài khoản **vẫn
    không đăng bài được** — hỏng im lặng đúng loài khó truy nhất.
    """
    bien, username, *_ = TAI_KHOAN[-1]
    cu = User.objects.create_user(username=username, email="cu@vi-du.gikky.net")
    EmailAddress.objects.create(user=cu, email=cu.email, verified=False, primary=True)

    call_command("tao_tai_khoan_doi")

    cu.refresh_from_db()
    assert cu.check_password(MAT_KHAU[bien]) is True
    assert EmailAddress.objects.filter(user=cu, verified=True).count() == 1


@pytest.mark.parametrize("thieu", [t[0] for t in TAI_KHOAN])
def test_thieu_mat_khau_thi_NEM_chu_khong_dat_mat_khau_doan_duoc(env_du, monkeypatch, thieu):
    """Không có mặc định, và đó là cả điểm.

    Một lệnh dựng superuser mà lặng lẽ rơi về `"admin"`/`"changeme"` khi thiếu cấu hình là
    một cửa hậu có tài liệu. Thiếu thì dừng.
    """
    monkeypatch.delenv(thieu, raising=False)
    with pytest.raises(CommandError) as loi:
        call_command("tao_tai_khoan_doi")
    assert thieu in str(loi.value)
    assert User.objects.count() == 0


# --- Tên miền email đổi được qua env (2026-08-25) -----------------------------
# User chốt: trên prod ba tài khoản này mang email `@gikky.net` thật, còn dev/pytest/e2e
# giữ `@vi-du.gikky.net` (bộ e2e nhận diện tài khoản dựng sẵn theo đúng hậu tố `vi-du.`).


def test_mac_dinh_van_la_ten_mien_dung_san(env_du):
    """Không khai biến ⇒ KHÔNG được đổi hành vi cũ."""
    call_command("tao_tai_khoan_doi")
    for _, username, *_ in TAI_KHOAN:
        assert (
            User.objects.get(username=username).email
            == f"{username}@{TEN_MIEN_EMAIL_MAC_DINH}"
        )


def test_bien_moi_truong_de_duoc_ten_mien(env_du, monkeypatch):
    monkeypatch.setenv(BIEN_TEN_MIEN_EMAIL, "gikky.net")
    call_command("tao_tai_khoan_doi")
    for _, username, *_ in TAI_KHOAN:
        u = User.objects.get(username=username)
        assert u.email == f"{username}@gikky.net"
        # Vế dễ quên: hàng allauth phải đi theo, nếu không tài khoản đăng nhập được mà
        # mọi cửa GHI trả lỗi (xem docstring module).
        hang = EmailAddress.objects.get(user=u, email=u.email)
        assert (hang.verified, hang.primary) == (True, True)


def test_doi_ten_mien_giua_hai_lan_chay_khong_de_lai_primary_thu_hai(env_du, monkeypatch):
    """Ca THẬT của lượt deploy 2026-08-25, không phải phòng xa.

    Prod chạy lệnh này một lần với `vi-du.gikky.net` rồi chạy lại với `gikky.net`. Nếu
    bước hạ cờ `primary` không phủ được ca "đổi tên miền" thì lần thứ hai nổ
    `IntegrityError` trên `unique_primary_email` — hoặc tệ hơn, để lại HAI hàng
    `primary=True` và allauth chọn nhầm địa chỉ khi gửi thư đặt lại mật khẩu.
    """
    call_command("tao_tai_khoan_doi")
    monkeypatch.setenv(BIEN_TEN_MIEN_EMAIL, "gikky.net")
    call_command("tao_tai_khoan_doi")

    for _, username, *_ in TAI_KHOAN:
        u = User.objects.get(username=username)
        assert u.email == f"{username}@gikky.net"
        primary = EmailAddress.objects.filter(user=u, primary=True)
        assert primary.count() == 1, "phải còn ĐÚNG MỘT địa chỉ primary"
        assert primary.get().email == f"{username}@gikky.net"
        # Địa chỉ cũ được HẠ CỜ chứ không bị xoá — một lệnh dựng dữ liệu không có quyền
        # vứt đi một địa chỉ có thể là email thật của người đang dùng tài khoản.
        assert EmailAddress.objects.filter(
            user=u, email=f"{username}@{TEN_MIEN_EMAIL_MAC_DINH}", primary=False
        ).exists()


def test_bien_RONG_roi_ve_mac_dinh_chu_khong_ra_email_cut_duoi(env_du, monkeypatch):
    """`deploy/prod/compose.yml` khai `${GIKKY_TEAM_EMAIL_DOMAIN:-}` ⇒ trong container biến
    LUÔN tồn tại, chỉ rỗng khi không ai đặt.

    `default=` của django-environ chỉ dùng khi biến KHÔNG TỒN TẠI, nên nếu lệnh chỉ dựa
    vào `default=` thì `ten_mien` ra `""` và ba tài khoản mang email `admin@`,
    `gikky-team-news@`. Django lưu bình thường, allauth lưu bình thường, không có gì đỏ —
    chỉ có ba tài khoản không đăng nhập nổi.
    """
    monkeypatch.setenv(BIEN_TEN_MIEN_EMAIL, "")
    call_command("tao_tai_khoan_doi")
    for _, username, *_ in TAI_KHOAN:
        assert (
            User.objects.get(username=username).email
            == f"{username}@{TEN_MIEN_EMAIL_MAC_DINH}"
        )
