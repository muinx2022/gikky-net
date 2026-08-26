"""Theo dõi **NGƯỜI** + bốn loại thông báo mới — user chốt 2026-08-25.

Plan: `plans/2026-08-25-theo-doi-va-chuong.md`.

Năm nhóm câu hỏi, xếp theo "hỏng thì đau tới đâu":

1. **Rò dữ liệu per-user** — B không thấy và không đụng được danh sách của A.
2. **Tự theo mình** — chặn ở CẢ hai tầng (endpoint 400, DB `CheckConstraint`).
3. **Idempotency** — bấm hai lần không dựng hàng thứ hai.
4. **Thông báo tới đúng người** — và **không tới hai lần** cho cùng một sự kiện.
5. **Gộp** — dedupe đúng khoá, đúng nhịp.
"""

import pytest

from core.models.he_thong import Notification
from core.models.tuong_tac import TheoUser

from .conftest import dat, lay


def _theo(client, username: str, *, status: int = 200):
    return dat(client, f"/api/v1/users/{username}/theo", status=status)


def _bo(client, username: str, *, status: int = 200):
    return dat(client, f"/api/v1/users/{username}/theo", status=status, method="delete")


# --- (1) rò dữ liệu per-user -------------------------------------------------


@pytest.mark.django_db
def test_khach_nhan_200_rong_khong_phai_401(client, nguoi_a):
    """`GET /users/{u}/me` chạy ở MỌI lượt tải trang hồ sơ, kể cả của bot."""
    d = lay(client, f"/api/v1/users/{nguoi_a.username}/me")
    assert d == {"dang_nhap": False, "following": False, "la_toi": False}


@pytest.mark.django_db
def test_B_khong_thay_va_khong_doi_duoc_danh_sach_cua_A(client, nguoi_a, nguoi_b, tac_gia):
    """Không cửa nào nhận tham số trỏ tới người khác — chủ suy ra từ phiên. Nên vế "B
    không đụng được của A" đo bằng chuyện B gọi hết cả ba cửa mà hàng của A không nhúc
    nhích."""
    client.force_login(nguoi_a)
    _theo(client, tac_gia.username)
    assert TheoUser.objects.filter(nguoi_theo=nguoi_a).count() == 1

    client.force_login(nguoi_b)
    assert lay(client, "/api/v1/me/dang-theo-user") == []
    _bo(client, tac_gia.username)  # B bỏ theo người A đang theo

    assert TheoUser.objects.filter(nguoi_theo=nguoi_a, nguoi_duoc_theo=tac_gia).exists()


@pytest.mark.django_db
def test_khong_cache_duoc(client, nguoi_a):
    """Response per-user đi qua một URL công khai — thiếu `no-store` thì proxy nào ở giữa
    cũng có quyền phát lại câu trả lời của người này cho người kế tiếp."""
    client.force_login(nguoi_a)
    assert client.get("/api/v1/me/dang-theo-user")["Cache-Control"] == "no-store"
    assert client.get(f"/api/v1/users/{nguoi_a.username}/me")["Cache-Control"] == "no-store"


@pytest.mark.django_db
def test_ho_so_cong_khai_khong_moc_them_truong_theo_nguoi_xem(client, nguoi_a, tac_gia):
    """Đường **cache được** phải giữ nguyên hình dạng — PLAN 8.4."""
    khach = lay(client, f"/api/v1/users/{tac_gia.username}")
    client.force_login(nguoi_a)
    _theo(client, tac_gia.username)
    da_theo = lay(client, f"/api/v1/users/{tac_gia.username}")
    assert set(khach) == set(da_theo)
    assert "following" not in da_theo


# --- (2) tự theo mình --------------------------------------------------------


@pytest.mark.django_db
def test_tu_theo_minh_bi_TU_CHOI(client, nguoi_a):
    """400, không phải 200 im lặng.

    Im lặng thì UI vẽ nút thành "Đang theo" rồi lượt tải sau nó lật về — một trạng thái
    nói dối. Và nó chảy tiếp vào `bao_mach_moi`: người viết tự nhận chuông về bài mình.
    """
    client.force_login(nguoi_a)
    _theo(client, nguoi_a.username, status=400)
    assert TheoUser.objects.count() == 0


@pytest.mark.django_db
def test_DB_chan_tu_theo_du_endpoint_co_bi_go(nguoi_a):
    """Lớp trong: `CheckConstraint theo_user_khong_tu_theo`.

    Hai lớp cho một luật vì `core/` có người gọi khác endpoint — seed, migration dữ liệu,
    `manage.py shell`. Bài này ghim lớp DB, độc lập với lớp HTTP ở trên.
    """
    from django.db import IntegrityError, transaction

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            TheoUser.objects.create(nguoi_theo=nguoi_a, nguoi_duoc_theo=nguoi_a)


@pytest.mark.django_db
def test_username_la_tra_404(client, nguoi_a):
    client.force_login(nguoi_a)
    _theo(client, "khong-co-that", status=404)
    _bo(client, "khong-co-that", status=404)
    lay(client, "/api/v1/users/khong-co-that/me", status=404)


@pytest.mark.django_db
@pytest.mark.parametrize("method", ["post", "delete"])
def test_khach_khong_ghi_duoc(client, nguoi_a, method):
    """`auth=dang_nhap` cũng là lớp kiểm CSRF — mất 401 là mất cả hai cùng lúc."""
    dat(client, f"/api/v1/users/{nguoi_a.username}/theo", status=401, method=method)
    assert TheoUser.objects.count() == 0


# --- (3) idempotency ---------------------------------------------------------


@pytest.mark.django_db
def test_theo_hai_lan_khong_dung_hang_thu_hai(client, nguoi_a, tac_gia):
    client.force_login(nguoi_a)
    assert _theo(client, tac_gia.username) == {"username": tac_gia.username, "following": True}
    assert _theo(client, tac_gia.username) == {"username": tac_gia.username, "following": True}
    assert TheoUser.objects.count() == 1


@pytest.mark.django_db
def test_bo_theo_thu_von_khong_theo_van_200(client, nguoi_a, tac_gia):
    client.force_login(nguoi_a)
    assert _bo(client, tac_gia.username) == {"username": tac_gia.username, "following": False}


@pytest.mark.django_db
def test_la_toi_dung_tren_ho_so_cua_chinh_minh(client, nguoi_a, tac_gia):
    client.force_login(nguoi_a)
    assert lay(client, f"/api/v1/users/{nguoi_a.username}/me")["la_toi"] is True
    assert lay(client, f"/api/v1/users/{tac_gia.username}/me")["la_toi"] is False


# --- (4)+(5) thông báo -------------------------------------------------------


@pytest.mark.django_db
def test_theo_user_bao_cho_nguoi_DUOC_theo(client, nguoi_a, tac_gia):
    client.force_login(nguoi_a)
    _theo(client, tac_gia.username)

    hang = Notification.objects.get()
    assert hang.user_id == tac_gia.pk
    assert hang.type == "theo_user"
    assert hang.payload["boi"] == nguoi_a.username
    assert "mach_id" not in hang.payload, "loại này KHÔNG gắn với mạch nào"


@pytest.mark.django_db
def test_theo_bo_theo_lai_van_chi_MOT_hang(client, nguoi_a, tac_gia):
    """Gộp theo NGƯỜI THEO, không theo ngày.

    Theo → bỏ theo → theo lại là trò quấy rối rẻ nhất trên đời. Gộp theo ngày vẫn cho nó
    một chuông mỗi ngày, mãi mãi; gộp theo người thì N lần chỉ còn một hàng.
    """
    client.force_login(nguoi_a)
    for _ in range(3):
        _theo(client, tac_gia.username)
        _bo(client, tac_gia.username)

    assert Notification.objects.filter(type="theo_user").count() == 1


@pytest.mark.django_db
def test_theo_user_gop_QUA_NGAY_chu_khong_chi_trong_ngay(nguoi_a, tac_gia):
    """Khoá gộp là **`theo_user:{người theo}`**, KHÔNG có phần ngày.

    ## Vì sao phải có bài đo riêng cho vế này

    Bài trên (`test_theo_bo_theo_lai_van_chi_MOT_hang`) theo–bỏ–theo ba lần **trong cùng
    một ngày**, nên một khoá `theo_user:{người}:{ngày}` cũng cho ra đúng một hàng: nó
    xanh với cả hai cách làm. Lượt thử phá bắt được đúng chỗ đó — đổi khoá sang gộp theo
    ngày mà bộ đo vẫn xanh, tức bài kia **không** đo thứ nó nói.

    Khác biệt chỉ lộ ra **qua ngày**: gộp theo ngày cho kẻ quấy rối một chuông mới mỗi 24
    giờ, mãi mãi. Nên bài này gọi thẳng `bao_theo_user` với hai hàng cách nhau hai ngày —
    đường HTTP không dựng được cảnh ấy mà không có máy thời gian.
    """
    from datetime import timedelta

    from django.utils import timezone

    from core.models.tuong_tac import TheoUser as TU
    from core.thong_bao import bao_theo_user

    theo = TU.objects.create(nguoi_theo=nguoi_a, nguoi_duoc_theo=tac_gia)
    bao_theo_user(theo)

    # Cùng người theo, hai ngày sau.
    theo.created_at = timezone.now() + timedelta(days=2)
    bao_theo_user(theo)

    assert Notification.objects.filter(type="theo_user").count() == 1, (
        "gộp theo NGƯỜI THEO: qua ngày vẫn phải là một hàng"
    )


@pytest.mark.django_db
def test_theo_mach_bao_cho_CHU_MACH(client, mach_cua_a, nguoi_a, nguoi_b):
    client.force_login(nguoi_b)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")

    hang = Notification.objects.get(type="theo_mach")
    assert hang.user_id == nguoi_a.pk
    assert hang.payload["boi"] == nguoi_b.username
    assert hang.payload["so_nguoi_theo_moi"] == 1


@pytest.mark.django_db
def test_tu_theo_mach_MINH_khong_bao(client, mach_cua_a, nguoi_a):
    """Chuông kể lại việc mình vừa làm là tiếng ồn thuần tuý."""
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    assert Notification.objects.filter(type="theo_mach").count() == 0


@pytest.mark.django_db
def test_mach_moi_bao_cho_nguoi_theo_TAC_GIA(client, sub, nguoi_a, nguoi_b):
    """Đây là thứ khiến nút "Theo dõi" trên hồ sơ có nghĩa.

    Không có nó thì theo một người là bấm một cái nút rồi không bao giờ nhận được gì —
    PLAN mục 4 cấm nút không làm gì, và một nút *hứa* rồi im lặng còn tệ hơn.
    """
    client.force_login(nguoi_b)
    _theo(client, nguoi_a.username)
    Notification.objects.all().delete()

    client.force_login(nguoi_a)
    dat(
        client,
        "/api/v1/machs",
        {"sub": sub.slug, "title": "Bài mới của A", "body": "Nội dung."},
        status=201,
    )

    hang = Notification.objects.get(type="mach_moi")
    assert hang.user_id == nguoi_b.pk
    assert hang.payload["boi"] == nguoi_a.username
    assert hang.payload["mach_title"] == "Bài mới của A"


@pytest.mark.django_db
def test_khong_theo_tac_gia_thi_KHONG_nhan_mach_moi(client, sub, nguoi_a, nguoi_b):
    """Vế chống rỗng của bài trên: bỏ hẳn bộ lọc người nhận thì bài kia vẫn xanh."""
    client.force_login(nguoi_a)
    dat(
        client,
        "/api/v1/machs",
        {"sub": sub.slug, "title": "Bài không ai theo", "body": "Nội dung."},
        status=201,
    )
    assert Notification.objects.filter(type="mach_moi").count() == 0
