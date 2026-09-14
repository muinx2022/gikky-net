"""Kiểm tra sinh username khi đăng nhập/đăng ký bằng Google.

Yêu cầu (2026-09-13):
1. Hệ thống lấy username đầy đủ từ prefix của email (vd: 'muinx2022', 'thuydtb86'),
   thay vì lấy first_name chỉ có 3-4 ký tự (vd: 'mui', 'thuy').
2. Nếu bị trùng tên đăng nhập thì giữ nguyên cả email (vd: 'muinx2022@gmail.com').
3. Nếu cả email cũng trùng thì sinh số hậu tố duy nhất để không bị lỗi.
"""

import pytest
from django.http import HttpRequest
from allauth.socialaccount.models import SocialAccount, SocialLogin

from core.allauth_adapter import AdapterTaiKhoan, AdapterMangXaHoi
from core.models import User

pytestmark = pytest.mark.django_db


def test_populate_user_goi_y_username_tu_prefix_email():
    """`AdapterMangXaHoi.populate_user` gợi ý username từ prefix email thay vì để rỗng."""
    adapter = AdapterMangXaHoi()
    req = HttpRequest()
    user = User()
    sl = SocialLogin(
        user=user,
        account=SocialAccount(
            provider="google",
            uid="uid_test_1",
            extra_data={"email": "thuydtb86@gmail.com", "name": "Thuy Dang", "given_name": "Thuy", "family_name": "Dang"},
        ),
    )
    adapter.populate_user(
        req,
        sl,
        {"email": "thuydtb86@gmail.com", "first_name": "Thuy", "last_name": "Dang", "name": "Thuy Dang"},
    )
    assert sl.user.username == "thuydtb86"
    assert sl.user.first_name == "Thuy"


def test_populate_username_lay_prefix_email_khong_lay_first_name():
    """`AdapterTaiKhoan.populate_username` ưu tiên prefix email hơn first_name."""
    adapter = AdapterTaiKhoan()
    req = HttpRequest()

    user = User(email="thuydtb86@gmail.com", first_name="Thuy", last_name="Dang")
    adapter.populate_username(req, user)
    assert user.username == "thuydtb86"

    user_mui = User(email="muinx2022_fresh@test.net", first_name="Mui", last_name="Nguyen")
    adapter.populate_username(req, user_mui)
    assert user_mui.username == "muinx2022_fresh"


def test_populate_username_trung_ten_thi_giu_nguyen_ca_email():
    """Nếu prefix email bị trùng tên đăng nhập trong DB -> giữ nguyên cả email."""
    adapter = AdapterTaiKhoan()
    req = HttpRequest()

    # Tạo trước user có username là 'thuydtb86'
    User.objects.create(username="thuydtb86", email="nguoi_khac@example.com")

    # User mới đăng ký Google bằng thuydtb86@gmail.com
    user = User(email="thuydtb86@gmail.com", first_name="Thuy", last_name="Dang")
    adapter.populate_username(req, user)
    assert user.username == "thuydtb86@gmail.com"


def test_populate_username_trung_ca_email_thi_sinh_so_hau_to():
    """Nếu cả prefix lẫn full email đều đã tồn tại trong DB -> sinh hậu tố số duy nhất."""
    adapter = AdapterTaiKhoan()
    req = HttpRequest()

    User.objects.create(username="thuydtb86", email="acc1@example.com")
    User.objects.create(username="thuydtb86@gmail.com", email="acc2@example.com")

    user = User(email="thuydtb86@gmail.com", first_name="Thuy", last_name="Dang")
    adapter.populate_username(req, user)
    assert user.username == "thuydtb861"


def test_luong_save_user_mang_xa_hoi():
    """Chạy qua luồng save_user của AdapterMangXaHoi đảm bảo user được lưu đúng vào DB."""
    soc_adapter = AdapterMangXaHoi()
    req = HttpRequest()
    req.session = {}

    sl = SocialLogin(
        user=User(email="test_social_new@gmail.com", first_name="Social", last_name="User"),
        account=SocialAccount(
            provider="google",
            uid="uid_social_new_99",
            extra_data={"email": "test_social_new@gmail.com"},
        ),
    )
    saved_user = soc_adapter.save_user(req, sl, form=None)
    assert saved_user.pk is not None
    assert saved_user.username == "test_social_new"
    assert saved_user.email == "test_social_new@gmail.com"
