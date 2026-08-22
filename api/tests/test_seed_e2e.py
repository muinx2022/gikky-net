"""`manage.py seed_e2e` — vá A3 (2026-08-22).

**Vì sao file này tồn tại.** Phase 1c thêm 119 dòng Python (`seed_e2e.py`) và **0 test
Python**, nên một hồi quy thật đi lọt tới tận vòng nghiệm thu: `seed_e2e` gắn 21 mạch của
`e2e_nhieu_mach` vào sub `chung-khoan` của `seed_dev`, trong khi `seed_dev._xoa_seed` chỉ
xoá mạch của user seed_dev rồi mới xoá `Sub` ⇒

    ProtectedError: Cannot delete some instances of model 'Sub' …

`seed_dev --reset` **không chạy được nữa**, và `seed_e2e --reset` không cứu được vì nó xoá
xong dựng lại ngay (không có cờ "chỉ xoá") — vòng lặp chỉ thoát bằng SQL tay. Không bài đo
nào đỏ, vì `tests/test_seed_dev.py` chạy trên DB test sạch nơi `seed_e2e` chưa bao giờ được
gọi.

Bài đo dưới đây gọi **cả hai** command trong cùng một DB, đúng thứ tự mà máy dev gặp.
"""

import pytest
from django.core.management import call_command

from core.management.commands import seed_dev, seed_e2e
from core.models import Mach, Sub, User

pytestmark = pytest.mark.django_db


def test_sub_cua_seed_e2e_khong_trung_sub_nao_cua_seed_dev():
    """Đối chứng TĨNH, không cần chạy seed — đỏ ngay lúc ai đó gõ lại slug cũ.

    Bài dưới chứng minh hậu quả; bài này chỉ vào nguyên nhân, và nó chạy trong mili giây
    nên không ai có cớ bỏ qua.
    """
    cua_seed_dev = {s["slug"] for s in seed_dev.SUBS}
    for slug in (seed_e2e.SUB_SLUG, seed_e2e.SUB_RONG_SLUG):
        assert slug not in cua_seed_dev, (
            f"`seed_e2e` đang dùng ké sub {slug!r} của `seed_dev`. Mạch của "
            "`e2e_nhieu_mach` sẽ treo lại trong sub đó sau khi `seed_dev --reset` xoá "
            "xong phần của mình ⇒ ProtectedError, và `--reset` chết vĩnh viễn."
        )
    assert seed_e2e.SUB_RONG_SLUG != seed_e2e.SUB_SLUG


def test_seed_dev_reset_van_chay_duoc_sau_khi_seed_e2e_da_chay():
    """W3 — chuỗi `seed_dev` → `seed_e2e` → `seed_dev --reset` phải chạy SẠCH.

    Đây là chuỗi mà máy dev gặp thật: `pnpm e2e` gọi cả hai (globalSetup), rồi lần sau
    người ta muốn dựng lại dữ liệu nghiệm thu từ đầu.
    """
    call_command("seed_dev", verbosity=0)
    call_command("seed_e2e", verbosity=0)
    assert Mach.objects.filter(author__username=seed_e2e.USERNAME).count() == (
        seed_e2e.SO_MACH
    )

    # Chỗ nổ của hồi quy. Không `pytest.raises` nào ở đây: lệnh phải chạy trót lọt.
    call_command("seed_dev", "--reset", verbosity=0)

    # `--reset` dựng lại đủ dữ liệu nghiệm thu…
    assert Mach.objects.filter(title=seed_dev.TITLE_HPG).count() == 1
    assert Sub.objects.filter(slug__in=[s["slug"] for s in seed_dev.SUBS]).count() == 2
    # …và **không đụng** vào dữ liệu phụ của bộ e2e. Hai bộ, hai cổng vào.
    assert User.objects.filter(username=seed_e2e.USERNAME).exists()
    assert Mach.objects.filter(author__username=seed_e2e.USERNAME).count() == (
        seed_e2e.SO_MACH
    )
    assert Sub.objects.filter(slug=seed_e2e.SUB_SLUG).exists()


def test_seed_e2e_khong_can_seed_dev_chay_truoc():
    """Sub riêng ⇒ `seed_e2e` tự đứng được. Trước vá A3 nó `CommandError` ở đây."""
    call_command("seed_e2e", verbosity=0)
    assert Mach.objects.filter(author__username=seed_e2e.USERNAME).count() == (
        seed_e2e.SO_MACH
    )
    assert Sub.objects.get(slug=seed_e2e.SUB_SLUG).ten == seed_e2e.SUB_TEN


def test_seed_e2e_chay_lan_hai_khong_nhan_doi_va_reset_don_sach():
    call_command("seed_e2e", verbosity=0)
    truoc = Mach.objects.count()
    call_command("seed_e2e", verbosity=0)
    assert Mach.objects.count() == truoc

    call_command("seed_e2e", "--reset", verbosity=0)
    assert Mach.objects.filter(author__username=seed_e2e.USERNAME).count() == (
        seed_e2e.SO_MACH
    )
    assert User.objects.filter(username=seed_e2e.USERNAME).count() == 1
    assert Sub.objects.filter(slug=seed_e2e.SUB_SLUG).count() == 1
    assert Sub.objects.filter(slug=seed_e2e.SUB_RONG_SLUG).count() == 1


def test_sub_rong_that_su_RONG(db):
    """Vá V6 (B8): nhánh "sub 0 mạch" của UI chỉ có đất chạy nếu hàng này thật sự rỗng.

    Một mạch lỡ tay gắn vào đây là bài đo Playwright đo vào chỗ trống mà vẫn xanh — nó
    chỉ khẳng định "không thấy chữ `0 mạch`", và một sub có bài thì đúng là không có
    chữ đó.
    """
    call_command("seed_e2e", verbosity=0)
    assert Mach.objects.filter(sub__slug=seed_e2e.SUB_RONG_SLUG).count() == 0
