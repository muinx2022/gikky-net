"""Đăng nhập bằng **email HOẶC username** — user chốt 2026-08-25.

`ACCOUNT_LOGIN_METHODS = {"email", "username"}`.

## Bài đo QUAN TRỌNG NHẤT: `test_gui_CA_HAI_khoa_bi_tu_choi`

allauth dựng `LoginInput` với một field cho mỗi phương thức, rồi `clean()` đếm credential
theo **khoá CÓ MẶT trong body** và đòi đúng một:

    if len(credentials) != 1: raise validation_error("invalid_login")

Nên gửi cả `email` lẫn `username` là **400 kể cả khi cả hai đều đúng**. Đó là cái bẫy mà
hai form frontend phải né, và `apps/*/lib/dang-nhap.ts::taoThongTinDangNhap` là chỗ né nó.

Một bản cài "cho chắc thì gửi cả hai" sẽ hỏng **100%** lượt đăng nhập — không phải một ca
biên — nên bài đo này đáng đứng đầu file.
"""

import json

import pytest
from allauth.account.models import EmailAddress

from core.models import User

pytestmark = pytest.mark.django_db

DUONG = "/api/_allauth/browser/v1/auth/login"
EMAIL = "nguoi@vi-du.gikky.net"
TEN = "nguoi_dung_thu"
MK = "mat-khau-du-manh-2026"


@pytest.fixture
def nguoi(db):
    u = User.objects.create(username=TEN, display_name="Người Thử", email=EMAIL)
    u.set_password(MK)
    u.save()
    EmailAddress.objects.create(user=u, email=EMAIL, verified=True, primary=True)
    return u


def dang_nhap(client, than: dict):
    return client.post(DUONG, data=json.dumps(than), content_type="application/json")


def test_dang_nhap_bang_EMAIL(client, nguoi):
    r = dang_nhap(client, {"email": EMAIL, "password": MK})
    assert r.status_code == 200, r.content


def test_dang_nhap_bang_USERNAME(client, nguoi):
    """Vế mới của lượt này — trước 2026-08-25 nó trả 400."""
    r = dang_nhap(client, {"username": TEN, "password": MK})
    assert r.status_code == 200, r.content


def test_gui_CA_HAI_khoa_bi_tu_choi(client, nguoi):
    """Cả hai đều ĐÚNG mà vẫn 400 — xem docstring đầu file.

    Bài đo này là lý do `taoThongTinDangNhap` tồn tại thay vì "gửi cả hai cho chắc".
    """
    r = dang_nhap(client, {"email": EMAIL, "username": TEN, "password": MK})
    assert r.status_code == 400, r.content


def test_sai_mat_khau_van_bi_tu_choi_o_ca_hai_duong(client, nguoi):
    """Chống hàng rào rỗng: mở thêm username không được nới lỏng phép kiểm mật khẩu."""
    assert dang_nhap(client, {"email": EMAIL, "password": "sai"}).status_code == 400
    assert dang_nhap(client, {"username": TEN, "password": "sai"}).status_code == 400


def test_username_khong_ton_tai_bi_tu_choi(client, nguoi):
    assert dang_nhap(client, {"username": "khong-co-ai", "password": MK}).status_code == 400


def test_hai_khoa_cua_LoginInput_deu_duoc_dang_ky(settings):
    """Tiền đề của cả file, đo ở tầng cấu hình.

    Nếu ai đó thu `ACCOUNT_LOGIN_METHODS` về một phương thức thì allauth **xoá hẳn** field
    kia khỏi `LoginInput` — và bài `test_dang_nhap_bang_USERNAME` sẽ đỏ với thông điệp
    "400" chứ không nói ra nguyên nhân là cấu hình. Dòng này nói hộ.
    """
    assert settings.ACCOUNT_LOGIN_METHODS == {"email", "username"}
