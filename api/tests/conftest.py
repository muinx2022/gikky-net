"""Fixture + helper dùng chung cho test Phase 1a.

Helper viết dạng HÀM THƯỜNG chứ không chỉ fixture: test đua luồng
(`test_cay_binh_luan.py`) chạy dưới `django_db(transaction=True)` — nó không dùng chung
được fixture nào bám vào fixture `db` (transaction bọc ngoài của `db` sẽ giấu dữ liệu
khỏi các luồng khác). Cùng một hàm, hai kiểu gọi.
"""

import pytest

from core.ghi import tao_mach
from core.models import Sub, User


def dung_user(username: str, display_name: str = "") -> User:
    return User.objects.create(username=username, display_name=display_name)


def dung_mach(*, title: str = "Nhật ký lệnh thử nghiệm", hau_to: str = ""):
    """Tạo `Sub` + `User` + `Mach` + mốc 1. Trả về `(mach, tac_gia)`."""
    sub = Sub.objects.create(slug=f"chung-khoan{hau_to}", ten="Chứng khoán")
    tac_gia = dung_user(f"chu_mach{hau_to}", "Chủ Mạch")
    mach, _ = tao_mach(sub=sub, author=tac_gia, title=title, body="Mốc 1.")
    return mach, tac_gia


@pytest.fixture
def sub(db) -> Sub:
    return Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")


@pytest.fixture
def tac_gia(db) -> User:
    return dung_user("chu_mach", "Chủ Mạch")


@pytest.fixture
def nguoi_khac(db) -> User:
    return dung_user("nguoi_khac", "Người Khác")


@pytest.fixture
def mach(sub, tac_gia):
    """Một mạch tối thiểu: `Mach` + mốc 1, đúng như PLAN 5.1."""
    m, _ = tao_mach(
        sub=sub, author=tac_gia, title="Nhật ký lệnh thử nghiệm", body="Mốc 1."
    )
    return m
