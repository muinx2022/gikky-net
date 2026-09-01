"""`manage.py don_rac_e2e` — lệnh dọn rác mà `globalSetup` của bộ e2e gọi mỗi lượt chạy.

Lệnh này **ẩn nội dung**, tức nó là một lệnh phá theo đúng nghĩa hẹp. Vì thế bộ đo ở đây
dày về phía *không được đụng nhầm*, và nó đo cả hai lớp an toàn: miền email `@gikky.test`
(lớp 1) và cổng `DEBUG` (lớp 2). Lớp 2 có mặt vì lớp 1 chỉ là một giả định về dữ liệu —
cửa đăng ký của sản phẩm nhận miền `@gikky.test` như mọi miền khác (`test_tai_khoan.py`).
Nếu cả hai lớp cùng hỏng thì hậu quả không đỏ ở đâu cả: nội dung chỉ lặng lẽ biến khỏi mọi
cửa đọc, để lại một dòng `AuditLog` nói "dọn rác e2e".

Ba vế còn lại, mỗi vế một loài hỏng im lặng:

- **`comment_count`** — phải đi qua `core/ghi.py::dat_an_binh_luan`, không phải `UPDATE`
  thẳng; bài `..._comment_count_giam` là cái chuông cho đúng chỗ đó, và bài `..._mach_...`
  đòi dòng `AuditLog` để chuông ấy phủ cả nửa MẠCH.
- **bia mộ** — bật `hidden_at` lên một bình luận đã tự xoá đổi nhãn `DA_XOA` → `DA_AN` và
  gỡ luật giữ chỗ `giu_vi_da_trich`, tức lấy câu đã trích ra khỏi cuốn sổ của PLAN 5.6.
- **cache ISR** — ẩn trong DB mà không gọi ngược Next thì trang public giữ HTML có rác
  tới một giờ.
"""

from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.test import override_settings

from core.ghi import tao_mach, trich_vao_so, xoa_binh_luan
from core.models import Comment, Mach, User
from core.models.he_thong import AuditLog
from core.models.moc import Moc

from .conftest import viet


def don() -> str:
    """Chạy lệnh dưới `DEBUG=True` — **cách duy nhất** gọi nó từ pytest.

    Cùng lý lẽ và cùng khuôn với `conftest.chay_seed`: `django.test` ép `DEBUG = False`
    bất kể `settings.py` nói gì, nên một `call_command("don_rac_e2e")` trần **phải** ăn
    `CommandError` — và đó là hành vi đúng, xem `test_DEBUG_False_thi_CommandError`.
    """
    ra = StringIO()
    with override_settings(DEBUG=True):
        call_command("don_rac_e2e", stdout=ra)
    return ra.getvalue()


def _nguoi(username: str, mien: str) -> User:
    """Một tài khoản với email thuộc `mien` — miền email là lớp an toàn thứ nhất."""
    return User.objects.create(username=username, email=f"{username}@{mien}")


#: Miền của tài khoản dùng-một-lần trong bộ e2e (`apps/web/e2e/danh-tinh.ts`).
E2E = "gikky.test"
#: Miền của MỌI tài khoản seed (`seed_dev.py`, `seed_e2e.py`).
SEED = "vi-du.gikky.net"


@pytest.fixture
def mod(db) -> User:
    """Tài khoản staff đứng tên dòng `AuditLog` — lệnh lấy staff `pk` nhỏ nhất."""
    return User.objects.create(
        username="mod_don_rac", email=f"mod_don_rac@{SEED}", is_staff=True
    )


@pytest.fixture
def bat_lam_moi(monkeypatch) -> list[int]:
    """Chặn `lam_moi_mach` **trong module lệnh** và ghi lại `pk` của từng lời gọi.

    Vá đúng cái tên mà `handle()` gọi (`don_rac_e2e.lam_moi_mach`), không vá
    `core.revalidate.lam_moi_mach`: lệnh import hàm vào namespace của nó lúc nạp module,
    nên vá ở nguồn là vá một tên không ai gọi tới — bài đo sẽ xanh kể cả khi lệnh không
    gọi gì.
    """
    from core.management.commands import don_rac_e2e as lenh

    goi: list[int] = []
    monkeypatch.setattr(lenh, "lam_moi_mach", lambda m: goi.append(m.pk))
    return goi


@pytest.mark.django_db
def test_binh_luan_rac_bi_an_va_comment_count_giam(mach, mod):
    """Vế MỚI của lệnh: bình luận `@gikky.test` nằm trong mạch KHÔNG rác.

    Hai khẳng định, và cái thứ hai mới là lý do lệnh phải đi qua đường ghi: `hidden_at`
    được đặt, **và** `comment_count` của mạch giảm theo. Một `UPDATE hidden_at` thẳng
    làm được vế đầu và bỏ vế sau — banner "💬 n" của mạch seed sai vĩnh viễn, không log,
    không job đối soát.
    """
    khach = _nguoi("e2e_khach", E2E)
    that = _nguoi("nguoi_seed", SEED)
    rac = viet(mach, khach, "Bình luận rác của một lượt e2e trước.")
    giu = viet(mach, that, "Bình luận của dữ liệu seed.")
    mach.refresh_from_db()
    assert mach.comment_count == 2

    ra = don()

    rac.refresh_from_db()
    giu.refresh_from_db()
    assert rac.hidden_at is not None, "bình luận rác vẫn sống"
    assert rac.hidden_by == mod, "dòng AuditLog phải có actor staff"
    assert giu.hidden_at is None
    mach.refresh_from_db()
    assert mach.comment_count == 1, (
        "ẩn bình luận mà `comment_count` không giảm ⇒ lệnh đã ghi thẳng `hidden_at`"
    )
    assert "1 bình luận rác" in ra


@pytest.mark.django_db
def test_KHONG_dung_toi_binh_luan_ngoai_mien_e2e(mach, mod):
    """Đối chứng cho bài trên: bỏ vế lọc email là lệnh ẩn sạch bình luận của mọi người.

    Ba tác giả, hai loài phải sống: miền seed `@vi-du.gikky.net`, và tài khoản email
    RỖNG (`dung_user` của conftest, cũng như mọi user tạo qua Django admin). Vế rỗng đáng
    một dòng riêng vì `endswith` trên chuỗi rỗng là ca người ta hay đoán nhầm.
    """
    khach = _nguoi("e2e_khach2", E2E)
    seed = _nguoi("nguoi_seed2", SEED)
    khong_email = User.objects.create(username="nguoi_khong_email")
    rac = viet(mach, khach, "Rác.")
    a = viet(mach, seed, "Bình luận seed.")
    b = viet(mach, khong_email, "Bình luận của tài khoản không email.")

    don()

    for c in (a, b):
        c.refresh_from_db()
        assert c.hidden_at is None, f"bình luận của {c.author.username} bị ẩn NHẦM"
    rac.refresh_from_db()
    assert rac.hidden_at is not None


@pytest.mark.django_db
def test_BIA_MO_tung_duoc_trich_KHONG_bi_dung_toi(mach, mod):
    """Bình luận `@gikky.test` mà tác giả đã tự xoá — lệnh phải để nguyên `hidden_at`.

    Vì sao đây không phải chuyện thẩm mỹ: `trang_thai_noi_dung` cho **ẩn thắng xoá**, nên
    bật `hidden_at` lên một bia mộ đổi nhãn `DA_XOA` → `DA_AN`; mà luật giữ chỗ
    `giu_vi_da_trich` (`core/doc_noi_dung.py`) chỉ nhận `DA_XOA`. Bia mộ **đã từng được
    trích vào sổ** vì thế rơi khỏi cây bình luận, và câu trích ở mặt tiền mất chỗ trỏ về —
    tức một lệnh dọn rác vừa gỡ được một trang của cuốn sổ không-xoá-được (PLAN 5.6).

    Trạng thái phải giữ NGUYÊN: `hidden_at` NULL **và** `deleted_at` không bị dời.
    """
    khach = _nguoi("e2e_khach_bia_mo", E2E)
    c = viet(mach, khach, "Câu đáng trích của một lượt e2e trước.")
    trich_vao_so(moc=Moc.objects.get(mach=mach, seq=1), comment=c)
    assert xoa_binh_luan(comment=c) is False, "phải là BIA MỘ, không phải xoá thật"
    c.refresh_from_db()
    khi_xoa = c.deleted_at
    assert khi_xoa is not None

    don()

    c.refresh_from_db()
    assert c.hidden_at is None, (
        "bia mộ bị ẩn ⇒ nhãn đổi DA_XOA→DA_AN ⇒ `giu_vi_da_trich` tắt ⇒ câu đã trích "
        "rơi khỏi cây bình luận"
    )
    assert c.deleted_at == khi_xoa


@pytest.mark.django_db
def test_mach_cua_e2e_bi_an_con_mach_seed_thi_khong(sub, mach, mod):
    """Vế cũ (chuyển từ inline TS sang): mạch của tài khoản e2e biến khỏi mọi cửa đọc.

    Hai đối chứng phải SỐNG, mỗi cái một loài chủ: mạch của tài khoản miền **seed**
    (`@vi-du.gikky.net` — đúng loài mà `seed_dev`/`seed_e2e` dựng) và mạch của fixture
    `mach`, chủ có email RỖNG.

    Và một khẳng định về ĐƯỜNG ĐI, không chỉ về kết quả: phải có dòng `AuditLog` action
    `an_mach` cho đúng mạch ấy. Không có nó thì thay `dat_an_mach` bằng
    `Mach.objects.filter(...).update(hidden_at=…)` vẫn xanh — mà bản `update()` bỏ qua
    `dong_bo_kho_anh`, tức ảnh của mạch rác vẫn phục vụ được qua `/media/` dù mạch đã
    khuất mọi cửa đọc (A9).
    """
    khach = _nguoi("e2e_chu_mach", E2E)
    chu_seed = _nguoi("chu_mach_seed", SEED)
    rac, _ = tao_mach(sub=sub, author=khach, title="Mạch rác e2e", body="Mốc 1.")
    cua_seed, _ = tao_mach(
        sub=sub, author=chu_seed, title="Mạch của tài khoản seed", body="Mốc 1."
    )

    ra = don()

    rac.refresh_from_db()
    cua_seed.refresh_from_db()
    mach.refresh_from_db()
    assert rac.hidden_at is not None and rac.hidden_by == mod
    assert cua_seed.hidden_at is None, "mạch của miền seed bị ẩn nhầm"
    assert mach.hidden_at is None, "mạch của tài khoản không email bị ẩn nhầm"
    assert AuditLog.objects.filter(
        action="an_mach", target_id=rac.pk, actor=mod
    ).exists(), "không có dòng audit ⇒ lệnh đã ghi thẳng `hidden_at`, bỏ qua dong_bo_kho_anh"
    assert "1 mạch rác" in ra


@pytest.mark.django_db
def test_lam_moi_cache_MOT_lan_moi_mach_bi_dung(sub, mach, mod, bat_lam_moi):
    """Mọi mạch bị đụng phải được gọi ngược Next, và mỗi mạch **đúng một lần**.

    Trang mạch là ISR `revalidate = 3600` (PLAN 8.4). Không gọi thì `globalSetup` dọn DB
    xong mà trang public vẫn trả HTML có rác tới một giờ — và một `next start` cũ còn sống
    (`reuseExistingServer`) là đúng ca đó ở máy dev.

    Vế "một lần" không phải tối ưu vặt: 20 bình luận rác trong cùng một mạch là **một**
    trang cần làm mới. Gọi theo hàng thì mỗi lượt `globalSetup` bắn hàng chục request
    ngược vào Next trước khi bài đo đầu tiên chạy.
    """
    khach = _nguoi("e2e_khach_isr", E2E)
    rac_mach, _ = tao_mach(sub=sub, author=khach, title="Mạch rác ISR", body="Mốc 1.")
    viet(mach, khach, "Rác một.")
    viet(mach, khach, "Rác hai.")

    don()

    assert sorted(bat_lam_moi) == sorted([rac_mach.pk, mach.pk]), (
        "phải làm mới CẢ mạch vừa ẩn lẫn mạch chứa bình luận vừa ẩn, mỗi mạch một lần"
    )


@pytest.mark.django_db
def test_khong_co_gi_de_don_thi_KHONG_goi_lam_moi(mach, mod, bat_lam_moi):
    """Đối chứng cho bài trên — nếu không có nó thì "gọi đúng tập" có thể là "gọi tất".

    Đây cũng là vế ISR của tính idempotent: lượt chạy thứ hai của `globalSetup` không được
    bắn request ngược nào.
    """
    viet(mach, _nguoi("nguoi_seed_isr", SEED), "Bình luận thật.")

    ra = don()

    assert bat_lam_moi == [], "không đổi gì mà vẫn gọi ngược Next"
    assert "0 mạch rác" in ra and "0 bình luận rác" in ra


@pytest.mark.django_db
def test_binh_luan_trong_mach_RAC_khong_bi_an_rieng(sub, mod):
    """Mạch rác đã ẩn cả mạch ⇒ bình luận bên trong KHÔNG tốn thêm một lượt ghi.

    Đây là bài đo cho vế `mach__hidden_at__isnull=True` và cho THỨ TỰ hai bước trong
    `handle()`. Bỏ vế ấy thì mọi lượt chạy sinh thêm một dòng `AuditLog` cho từng bình
    luận trong mạch đã biến mất — và con số lệnh in ra không còn nói được "còn bao nhiêu
    rác nằm trong mạch seed", tức mất đúng tín hiệu mà lệnh này sinh ra để cho.
    """
    khach = _nguoi("e2e_chu_mach2", E2E)
    rac, _ = tao_mach(sub=sub, author=khach, title="Mạch rác e2e 2", body="Mốc 1.")
    trong_rac = viet(rac, khach, "Bình luận nằm trong chính mạch rác.")

    ra = don()

    rac.refresh_from_db()
    trong_rac.refresh_from_db()
    assert rac.hidden_at is not None
    assert trong_rac.hidden_at is None, "bình luận trong mạch đã ẩn không cần ẩn lại"
    assert "0 bình luận rác" in ra


@pytest.mark.django_db
def test_idempotent_chay_lan_hai_an_0(mach, sub, mod):
    """`globalSetup` gọi lệnh này MỖI lượt chạy — lần thứ hai phải là no-op.

    Không chỉ "không nổ": `_dat_co_an` trả `False` khi trạng thái không đổi, nên lần hai
    cũng không được reset `hidden_at` (mất mốc thời gian thật) và không đẻ dòng log thứ hai.
    """
    khach = _nguoi("e2e_khach3", E2E)
    tao_mach(sub=sub, author=khach, title="Mạch rác e2e 3", body="Mốc 1.")
    rac = viet(mach, khach, "Rác.")

    dau = don()
    rac.refresh_from_db()
    khi_an = rac.hidden_at

    lai = don()

    assert "1 mạch rác" in dau and "1 bình luận rác" in dau
    assert "0 mạch rác" in lai and "0 bình luận rác" in lai
    rac.refresh_from_db()
    assert rac.hidden_at == khi_an, "lần chạy thứ hai đã reset mốc thời gian ẩn"
    assert AuditLog.objects.filter(action="an_binh_luan", target_id=rac.pk).count() == 1


@pytest.mark.django_db
def test_khong_co_staff_thi_CommandError(mach):
    """`AuditLog` đòi một actor. Không có staff ⇒ dừng bằng câu nói tiếng người.

    Cố ý KHÔNG có fixture `mod` ở bài này. Lỗi phải nêu đúng lệnh cần chạy trước, vì
    người đọc nó là người vừa dựng DB từ clone sạch.
    """
    assert not User.objects.filter(is_staff=True).exists()
    rac = viet(mach, _nguoi("e2e_khach4", E2E), "Rác.")

    with pytest.raises(CommandError, match="staff"):
        don()

    rac.refresh_from_db()
    assert rac.hidden_at is None, "lệnh phải dừng TRƯỚC khi ẩn bất cứ thứ gì"
    assert Comment.objects.filter(hidden_at__isnull=False).count() == 0
    assert Mach.objects.filter(hidden_at__isnull=False).count() == 0


@pytest.mark.django_db
def test_DEBUG_False_thi_CommandError(sub, mach, mod):
    """Lớp an toàn thứ HAI. Gọi `call_command` TRẦN — `django.test` ép `DEBUG = False`.

    Vì sao lớp này cần thiết dù đã có lọc miền email: cửa đăng ký của sản phẩm nhận
    `@gikky.test` như mọi miền khác (`test_tai_khoan.py` đăng ký thật bằng
    `a@gikky.test`), nên "prod không có hàng nào khớp" là một giả định về dữ liệu, không
    phải một bất biến. Một lần gõ nhầm trên prod là ẩn nội dung người thật.

    Cổng phải chặn cả chỗ này — chặn được mỗi chỗ không ai gõ nhầm thì nó không phải cổng.
    """
    khach = _nguoi("e2e_khach5", E2E)
    rac_mach, _ = tao_mach(sub=sub, author=khach, title="Mạch rác e2e 5", body="Mốc 1.")
    rac = viet(mach, khach, "Rác.")

    with pytest.raises(CommandError, match="DEBUG"):
        call_command("don_rac_e2e")

    rac.refresh_from_db()
    rac_mach.refresh_from_db()
    assert rac.hidden_at is None and rac_mach.hidden_at is None
    assert not AuditLog.objects.exists(), "lệnh bị từ chối mà vẫn ghi sổ"
