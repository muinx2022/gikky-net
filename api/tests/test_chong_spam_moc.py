"""Kiểm thử cơ chế chống spam bump bài khi nối mốc — Hướng 1 (2026-09-17).

Đảm bảo tác giả nối mốc cụt lủn ("UP", "hóng", ".") không làm cập nhật `last_content_at`
và không đẩy bài lên đỉnh feed "Mới nhất".
"""

from datetime import timedelta
import json
import pytest
from django.utils import timezone

from core.ghi import dat_an_moc, tao_mach, them_moc
from core.models.moc import Moc


def lay(client, url: str) -> dict:
    r = client.get(url)
    assert r.status_code == 200, f"GET {url} thất bại: {r.content!r}"
    return json.loads(r.content)


def ids(payload: dict) -> list[int]:
    return [m["id"] for m in payload["items"]]


@pytest.mark.django_db
def test_moc_up_khong_bump_feed_moi(client, sub, tac_gia, nguoi_khac):
    """Mốc 'UP' không cập nhật last_content_at và không đẩy bài cũ lên đỉnh feed Mới."""
    khi_cu = timezone.now() - timedelta(days=10)
    khi_moi = timezone.now() - timedelta(days=1)

    cu, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch cũ cần giữ chỗ",
        body="Nội dung bài gốc của mạch cũ.",
        _created_at_seed=khi_cu,
    )
    moi, _ = tao_mach(
        sub=sub,
        author=nguoi_khac,
        title="Mạch mới xuất bản hôm qua",
        body="Nội dung bài gốc của mạch mới.",
        _created_at_seed=khi_moi,
    )

    # Ban đầu: mạch mới đứng trước mạch cũ
    d = lay(client, "/api/v1/feeds/moi?limit=50")
    assert ids(d) == [moi.pk, cu.pk]

    # Tác giả mạch cũ nối mốc 2 chỉ vỏn vẹn "UP"
    them_moc(
        mach=cu,
        author=tac_gia,
        body="UP",
    )

    cu.refresh_from_db()
    # last_content_at của mạch cũ KHÔNG được cập nhật theo mốc UP, vẫn giữ published_at cũ
    assert cu.last_content_at == cu.published_at
    assert cu.last_content_at < moi.last_content_at

    # Feed Mới: mạch mới vẫn đứng trên mạch cũ
    d = lay(client, "/api/v1/feeds/moi?limit=50")
    assert ids(d) == [moi.pk, cu.pk]

    # Thẻ feed của mạch cũ: không hiện badge moc_moi_nhat cho mốc UP
    the_cu = next(m for m in d["items"] if m["id"] == cu.pk)
    assert the_cu["moc_moi_nhat"] is None


@pytest.mark.django_db
def test_moc_chat_luong_duoc_bump_feed_moi(client, sub, tac_gia, nguoi_khac):
    """Mốc phân tích đầy đủ (>= 80 ký tự) cập nhật last_content_at và đưa bài lên đầu feed Mới."""
    khi_cu = timezone.now() - timedelta(days=10)
    khi_moi = timezone.now() - timedelta(days=1)

    cu, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch cũ có cập nhật lệnh thật",
        body="Nội dung bài gốc mốc 1.",
        _created_at_seed=khi_cu,
    )
    moi, _ = tao_mach(
        sub=sub,
        author=nguoi_khac,
        title="Mạch mới đứng im",
        body="Nội dung bài mới.",
        _created_at_seed=khi_moi,
    )

    # Nối mốc chất lượng dài >= 80 ký tự
    noi_dung_chat_luong = (
        "Hôm nay VN-Index rung lắc mạnh quanh vùng 1280 điểm. Lệnh mua thăm dò SSI phiên trước "
        "đã đạt mục tiêu chốt lời vòng một (+7.5%). Tỷ trọng hiện tại hạ về 50% tiền mặt."
    )
    assert len(noi_dung_chat_luong) >= 80

    khi_moc = timezone.now()
    moc_2 = them_moc(
        mach=cu,
        author=tac_gia,
        body=noi_dung_chat_luong,
        _created_at_seed=khi_moc,
    )

    cu.refresh_from_db()
    assert cu.last_content_at == moc_2.created_at
    assert cu.last_content_at > moi.last_content_at

    # Feed Mới: mạch cũ nhảy lên TOP 1
    d = lay(client, "/api/v1/feeds/moi?limit=50")
    assert ids(d) == [cu.pk, moi.pk]

    # Thẻ feed của mạch cũ hiển thị thông tin mốc 2
    the_cu = next(m for m in d["items"] if m["id"] == cu.pk)
    assert the_cu["moc_moi_nhat"] is not None
    assert the_cu["moc_moi_nhat"]["seq"] == 2


@pytest.mark.django_db
def test_moc_co_figures_duoc_bump_du_van_ban_ngan(client, sub, tac_gia, nguoi_khac):
    """Mốc có dải số figures giao dịch được coi là có giá trị định lượng và được bump."""
    cu, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch cũ",
        body="Bài gốc.",
        _created_at_seed=timezone.now() - timedelta(days=5),
    )
    moi, _ = tao_mach(
        sub=sub,
        author=nguoi_khac,
        title="Mạch mới",
        body="Bài gốc.",
        _created_at_seed=timezone.now() - timedelta(days=1),
    )

    them_moc(
        mach=cu,
        author=tac_gia,
        body="Chốt lời 1/2.",
        figures=[{"label": "Giá chốt", "value": "28.5"}],
    )

    cu.refresh_from_db()
    assert cu.last_content_at > moi.last_content_at
    d = lay(client, "/api/v1/feeds/moi?limit=50")
    assert ids(d) == [cu.pk, moi.pk]


@pytest.mark.django_db
def test_moc_co_loai_kem_van_ban_tren_30_ky_tu(client, sub, tac_gia, nguoi_khac):
    """Mốc có chip 'loai' phải kèm nội dung >= 30 ký tự mới được tính; 'loai' kèm 'UP' vẫn bị chặn."""
    cu, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch cũ",
        body="Bài gốc.",
        _created_at_seed=timezone.now() - timedelta(days=5),
    )
    moi, _ = tao_mach(
        sub=sub,
        author=nguoi_khac,
        title="Mạch mới",
        body="Bài gốc.",
        _created_at_seed=timezone.now() - timedelta(days=1),
    )

    # 1. Có loai nhưng body chỉ có "UP" -> không bump
    them_moc(mach=cu, author=tac_gia, loai="vào lệnh", body="UP")
    cu.refresh_from_db()
    assert cu.last_content_at == cu.published_at

    # 2. Có loai và body >= 30 ký tự -> được bump
    body_hop_le = "Đã khớp lệnh mua 50% vị thế tại vùng hỗ trợ 24.2."
    assert len(body_hop_le) >= 30
    moc_3 = them_moc(mach=cu, author=tac_gia, loai="vào lệnh", body=body_hop_le)
    cu.refresh_from_db()
    assert cu.last_content_at == moc_3.created_at
    d = lay(client, "/api/v1/feeds/moi?limit=50")
    assert ids(d) == [cu.pk, moi.pk]


@pytest.mark.django_db
def test_an_moc_chat_luong_keo_last_content_at_lui_lai(sub, tac_gia):
    """Khi mod ẩn mốc chất lượng, last_content_at tự động lùi về nội dung hợp lệ trước đó."""
    khi_goc = timezone.now() - timedelta(days=5)
    mach, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch kiểm tra ẩn",
        body="Mốc 1.",
        _created_at_seed=khi_goc,
    )

    moc_2 = them_moc(
        mach=mach,
        author=tac_gia,
        body="Nội dung mốc 2 rất chi tiết và chất lượng để đạt điều kiện bump feed trang chủ gikky.",
    )
    mach.refresh_from_db()
    assert mach.last_content_at == moc_2.created_at

    # Mod ẩn mốc 2
    dat_an_moc(moc=moc_2, boi=tac_gia, an=True, ly_do="Spam")
    mach.refresh_from_db()
    # last_content_at phải lùi về published_at ban đầu
    assert mach.last_content_at == mach.published_at
