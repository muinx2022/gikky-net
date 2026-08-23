"""Cổng `DEBUG` của `seed_dev` / `seed_e2e` — L02 (lượt vá V1, 2026-08-23).

Vì sao có file này. `seed_dev` dựng 44 tài khoản dùng chung một mật khẩu **ghi thẳng
trong repo công khai**, trong đó một tài khoản `is_staff` (`mod_gikky`). Cộng với L01
(allowlist IP của host admin là no-op trên prod), một lượt `manage.py seed_dev` gõ nhầm
trên máy thật là quyền quản trị cho bất kỳ ai đọc được repo — không cần khai thác gì.

Cổng nằm ở `core/moi_truong.py::doi_dev`, gọi ở **dòng đầu** `handle()`.

⚠ Bài đo ở đây gọi `call_command` **trần**, không qua `tests/conftest.py::chay_seed`. Đó
là cả nội dung của nó: `django.test` ép `DEBUG = False`, nên "chạy trần trong pytest"
chính là mô phỏng đúng "chạy trên một môi trường không phải dev".
"""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from core.models import Mach, Sub, User

from .conftest import chay_seed


@pytest.mark.django_db
@pytest.mark.parametrize("lenh", ["seed_dev", "seed_e2e"])
def test_DEBUG_False_thi_TU_CHOI(lenh):
    """Cả hai lệnh, không lệnh nào là ngoại lệ."""
    with pytest.raises(CommandError) as loi:
        call_command(lenh, verbosity=0)
    assert "DEBUG" in str(loi.value)
    assert lenh in str(loi.value)


@pytest.mark.django_db
@pytest.mark.parametrize("lenh", ["seed_dev", "seed_e2e"])
def test_bi_tu_choi_thi_KHONG_GHI_gi_va_KHONG_XOA_gi(lenh):
    """Cổng phải đứng TRƯỚC `--reset`.

    Một lệnh bị từ chối **sau khi** đã xoá dữ liệu thì tệ hơn hẳn một lệnh chạy trọn: nó
    phá xong rồi mới báo là không được phép. Bài đo dựng sẵn một hàng của "người dùng
    thật" và đòi nó còn nguyên sau lượt bị từ chối.
    """
    sub = Sub.objects.create(slug="nguoi-that", ten="Người thật")
    nguoi = User.objects.create(username="nguoi_that")
    from core.ghi import tao_mach

    mach, _ = tao_mach(sub=sub, author=nguoi, title="Bài của người thật", body="Mốc 1.")

    with pytest.raises(CommandError):
        call_command(lenh, "--reset", verbosity=0)

    assert Mach.objects.filter(pk=mach.pk).exists()
    assert User.objects.filter(pk=nguoi.pk).exists()
    # Và không có hàng seed nào được dựng.
    assert not User.objects.filter(username="mod_gikky").exists()


@pytest.mark.django_db
def test_DEBUG_True_thi_chay_binh_thuong():
    """Chiều ngược: cổng chặn đúng chỗ, không chặn cả máy dev.

    Không có bài này thì `doi_dev` sửa thành "luôn ném" vẫn xanh hết — đúng loài phép đo
    rỗng mà repo này đã diệt nhiều lần.
    """
    chay_seed("seed_dev")
    assert User.objects.filter(username="mod_gikky", is_staff=True).exists()


@pytest.mark.django_db
def test_cong_hoi_DEBUG_tai_thoi_diem_CHAY_khong_phai_luc_import():
    """`doi_dev` đọc `settings.DEBUG` mỗi lượt gọi, không chụp một lần lúc import.

    Chụp lúc import là cổng đóng/mở theo trạng thái của tiến trình lúc khởi động — trên
    một tiến trình dài (runserver) đó là một cổng không ai đổi được, và trong bộ test thì
    nó biến kết quả thành phụ thuộc thứ tự chạy file.
    """
    from core.moi_truong import doi_dev

    with pytest.raises(CommandError):
        doi_dev("seed_dev")
    with override_settings(DEBUG=True):
        doi_dev("seed_dev")  # không được ném
    with pytest.raises(CommandError):
        doi_dev("seed_dev")
