"""`seed_dev --reset` phải chạy được **trên DB đã có nội dung của người dùng thật**.

Tiêu chí M12 của bảng nghiệm thu là một dòng ngắn ("`seed_dev --reset` chạy được"), và
trước Phase 2 nó đúng một cách rỗng: **không tồn tại đường nào tạo `Mach` ngoài seed**,
nên "sub của seed" và "sub trống sau khi xoá nội dung seed" luôn là một.

Phase 2 mở `POST /machs`. Từ đó, một lượt dùng thử — hoặc chính bộ e2e — để lại mạch thật
trong `chung-khoan`; `Mach.sub` là `PROTECT`, và `--reset` nổ `ProtectedError`. Lỗi ấy
**chỉ lộ ra sau khi ai đó đã dùng sản phẩm một lần**, tức đúng lúc người ta cần `--reset`
nhất. Nó đã xảy ra thật trong lúc làm Phase 2.

Hai bài dưới ghim cả hai chiều: `--reset` **không nổ**, và nó **không xoá bài của người
khác**. Vế thứ hai quan trọng ngang vế thứ nhất — cách sửa nhanh nhất cho `ProtectedError`
là xoá luôn nội dung đang chặn, và đó là một lệnh mang tên "reset seed" âm thầm xoá dữ
liệu không thuộc về nó.
"""

import pytest
from django.core.management import call_command

from core.ghi import tao_mach
from core.management.commands.seed_dev import TITLE_HPG
from core.models import Mach, Sub, User

pytestmark = pytest.mark.django_db


def _mach_nguoi_la() -> Mach:
    """Một mạch KHÔNG thuộc seed, nằm trong đúng cái sub mà seed quản lý."""
    nguoi = User.objects.create(username="nguoi_dung_that", display_name="Người thật")
    mach, _ = tao_mach(
        sub=Sub.objects.get(slug="chung-khoan"),
        author=nguoi,
        title="Bài của một người dùng thật",
        body="Mốc 1.",
    )
    return mach


def test_reset_chay_duoc_khi_sub_con_mach_cua_nguoi_khac(seed):
    """M12 — `--reset` không được nổ `ProtectedError`.

    Bài đo giết mutant "xoá thẳng `Sub.objects.filter(...).delete()`" ở `_xoa_seed`: với
    mutant đó, dòng dưới ném `ProtectedError` và cả lệnh chết.
    """
    la = _mach_nguoi_la()
    call_command("seed_dev", "--reset", verbosity=0)
    assert Mach.objects.filter(pk=la.pk).exists()
    assert Mach.objects.filter(title=TITLE_HPG).exists(), "seed phải được dựng lại"


def test_reset_KHONG_xoa_noi_dung_cua_nguoi_khac(seed):
    """Chiều ngược: `--reset` làm mới **dữ liệu seed**, không dọn DB.

    Không có bài này thì cách chữa nhanh nhất cho bài trên — "xoá luôn mọi mạch trong hai
    sub ấy" — cũng xanh, và một lệnh tên là "reset seed" sẽ xoá bài của người khác.
    """
    la = _mach_nguoi_la()
    call_command("seed_dev", "--reset", verbosity=0)
    la.refresh_from_db()
    assert la.author.username == "nguoi_dung_that"
    assert la.mocs.count() == 1


def test_user_seed_DANG_NHAP_DUOC(client, seed):
    """User của `seed_dev` phải đăng nhập được — thêm ở Phase 2.

    Trước khi có `_xac_thuc_email`, `seed_dev` dựng 43 tài khoản có mật khẩu dùng được
    (`MAT_KHAU_SEED`) mà **không cái nào vào được**: gikky đăng nhập bằng email và bắt
    buộc xác thực, còn allauth tra bảng `EmailAddress` chứ không tra cột `User.email`.
    Dữ liệu dev nói dối đúng chỗ người ta tin nó nhất, và nó chỉ lộ ra khi ai đó thử đăng
    nhập bằng tay — tức là không bao giờ lộ trong CI.

    Bài đo đi qua **cửa allauth thật**, không qua `client.force_login`: `force_login` bỏ
    qua toàn bộ luật đăng nhập, nên nó xanh kể cả với mutant.
    """
    import json

    from core.management.commands.seed_dev import CHU_MACH, MAT_KHAU_SEED
    from core.models import User

    chu = User.objects.get(username=CHU_MACH)
    r = client.post(
        "/api/_allauth/browser/v1/auth/login",
        data=json.dumps({"email": chu.email, "password": MAT_KHAU_SEED}),
        content_type="application/json",
    )
    assert r.status_code == 200, r.content[:400]
    assert json.loads(client.get("/api/v1/me").content)["username"] == CHU_MACH


def test_reset_van_xoa_sub_khi_khong_con_ai_dung(seed):
    """Và khi sub đã rảnh thì nó vẫn bị xoá — nếu không, `_xoa_sub_neu_ranh` chỉ là một
    hàm không bao giờ xoá gì, và bài đo trên nghiệm đúng một cách rỗng.

    Đo bằng `pk`: `--reset` xoá hàng cũ rồi `_tao_sub` dựng hàng mới cùng `slug`, nên
    "còn tồn tại theo slug" không phân biệt được hai ca.
    """
    pk_cu = {s.slug: s.pk for s in Sub.objects.all()}
    assert pk_cu, "seed phải có sub"
    call_command("seed_dev", "--reset", verbosity=0)
    pk_moi = {s.slug: s.pk for s in Sub.objects.all()}
    assert set(pk_moi) == set(pk_cu)
    assert all(pk_moi[s] != pk_cu[s] for s in pk_cu), (
        "không sub nào bị xoá ⇒ `_xoa_sub_neu_ranh` không làm gì cả"
    )
