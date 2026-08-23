"""`PATCH /api/v1/me` — cửa duy nhất bật/tắt digest tuần (L14, lượt vá V1).

Trước lượt vá, `grep "nhan_digest"` trong `api/` và `apps/` ra **0 kết quả**: cột có, mặc
định `False` đúng PLAN 5.8 ("opt-in"), và **không ai bật được**. Toàn bộ `core/digest.py`,
lệnh `gui_digest` và lịch 8:00 thứ Bảy chạy trên một tập người nhận luôn rỗng về cấu trúc.
"""

import pytest

from core.models import User

from .conftest import dat, lay, ma_loi


@pytest.mark.django_db
def test_bat_roi_tat_lai_duoc(client, nguoi_a):
    client.force_login(nguoi_a)
    assert lay(client, "/api/v1/me")["nhan_digest"] is False

    ra = dat(client, "/api/v1/me", {"nhan_digest": True}, status=200, method="patch")
    assert ra["nhan_digest"] is True
    assert User.objects.get(pk=nguoi_a.pk).nhan_digest is True
    # Đọc lại qua GET, không chỉ tin response của PATCH.
    assert lay(client, "/api/v1/me")["nhan_digest"] is True

    ra = dat(client, "/api/v1/me", {"nhan_digest": False}, status=200, method="patch")
    assert ra["nhan_digest"] is False
    assert User.objects.get(pk=nguoi_a.pk).nhan_digest is False


@pytest.mark.django_db
def test_than_rong_khong_doi_gi(client, nguoi_a):
    """PATCH thật: trường vắng mặt là không đổi, không phải "đặt về mặc định"."""
    User.objects.filter(pk=nguoi_a.pk).update(nhan_digest=True)
    client.force_login(nguoi_a)
    assert dat(client, "/api/v1/me", {}, status=200, method="patch")["nhan_digest"] is True
    assert User.objects.get(pk=nguoi_a.pk).nhan_digest is True


@pytest.mark.django_db
def test_null_tuong_minh_khong_ghi_NULL_vao_cot_NOT_NULL(client, nguoi_a):
    """`{"nhan_digest": null}` là thân hợp lệ về schema — nó không được thành HTTP 500."""
    User.objects.filter(pk=nguoi_a.pk).update(nhan_digest=True)
    client.force_login(nguoi_a)
    ra = dat(client, "/api/v1/me", {"nhan_digest": None}, status=200, method="patch")
    assert ra["nhan_digest"] is True


@pytest.mark.django_db
def test_khach_chua_dang_nhap_nhan_401(client):
    """Khác `GET /me` (200 cho khách): đây là đường GHI, và nó cũng là chỗ CSRF sống."""
    assert (
        ma_loi(client, "/api/v1/me", {"nhan_digest": True}, status=401, method="patch")
        == "chua_dang_nhap"
    )


@pytest.mark.django_db
def test_chi_ghi_vao_hang_cua_CHINH_MINH(client, nguoi_a, nguoi_b):
    """Không có tham số nào chỉ ra người khác — bài đo ghim rằng B không đổi theo A."""
    client.force_login(nguoi_a)
    dat(client, "/api/v1/me", {"nhan_digest": True}, status=200, method="patch")
    assert User.objects.get(pk=nguoi_b.pk).nhan_digest is False


@pytest.mark.django_db
def test_bat_xong_thi_digest_THAT_SU_co_nguoi_nhan(client, nguoi_b, mach_cua_a):
    """Nối cửa này với đầu kia: `nguoi_nhan_digest()` phải nhìn thấy người vừa bật.

    Không có bài này thì `PATCH /me` chỉ là một cột boolean đổi được — đúng thứ L14 nói là
    chưa đủ. Điều kiện còn lại (`is_active`, đang follow ít nhất một mạch) do `core/digest`
    lo; ở đây dựng đủ chúng rồi hỏi đúng hàm mà `gui_digest` gọi.
    """
    from core.digest import nguoi_nhan_digest
    from core.ghi import dat_follow

    User.objects.filter(pk=nguoi_b.pk).update(email="b@gikky.test")
    nguoi_b.refresh_from_db()
    dat_follow(user=nguoi_b, mach=mach_cua_a)
    assert [n.user.pk for n in nguoi_nhan_digest()] == []

    client.force_login(nguoi_b)
    dat(client, "/api/v1/me", {"nhan_digest": True}, status=200, method="patch")
    assert [n.user.pk for n in nguoi_nhan_digest()] == [nguoi_b.pk]
