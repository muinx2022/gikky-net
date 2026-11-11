"""`GET /feeds/moi?trang_thai=open|closed` — `plans/2026-11-11-homepage-v2-giao-dien-moi.md` §6.3.

Tab "Đang mở" / "Đã đóng sổ" của khối nhật ký trang chủ đi qua tham số này. Đo: lọc đúng,
vắng tham số = không lọc (hành vi cũ nguyên vẹn), kết hợp được với `loai_mach`, cursor không
làm rơi bộ lọc, giá trị lạ bị chặn 400 `tham_so_khong_hop_le`.
"""

from typing import get_args

import pytest

from core.ghi import dong_so, tao_mach
from core.models.dien_dan import Sub, TrangThaiMach

from api.feeds import TrangThaiFeed
from tests.conftest import dung_user, lay

pytestmark = pytest.mark.django_db


@pytest.fixture
def ba_mach(db):
    """Hai nhật ký (một mở, một đóng sổ) + một bài viết đã đóng sổ."""
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    nguoi = dung_user("nguoi_thuong", "Người Thường")
    doi = dung_user("gikky-team-news", "gikky")
    doi.la_tai_khoan_doi = True
    doi.save(update_fields=["la_tai_khoan_doi"])
    mo, _ = tao_mach(sub=sub, author=nguoi, title="Nhật ký mở", body="x")
    dong, _ = tao_mach(sub=sub, author=nguoi, title="Nhật ký đóng", body="x")
    dong_so(mach=dong, ket_qua="+1%")
    bai, _ = tao_mach(sub=sub, author=doi, title="Bài viết đóng", body="x")
    dong_so(mach=bai)
    return mo, dong, bai


def _ids(client, truy_van: str) -> set[int]:
    return {m["id"] for m in lay(client, f"/api/v1/feeds/moi?{truy_van}&limit=50")["items"]}


def test_literal_cua_api_khop_TrangThaiMach_cua_model():
    assert set(get_args(TrangThaiFeed)) == set(TrangThaiMach.values)


def test_vang_tham_so_la_khong_loc(client, ba_mach):
    mo, dong, bai = ba_mach
    assert _ids(client, "") == {mo.pk, dong.pk, bai.pk}


def test_open_chi_tra_mach_dang_mo(client, ba_mach):
    mo, dong, bai = ba_mach
    assert _ids(client, "trang_thai=open") == {mo.pk}


def test_closed_chi_tra_mach_da_dong_so(client, ba_mach):
    mo, dong, bai = ba_mach
    assert _ids(client, "trang_thai=closed") == {dong.pk, bai.pk}


def test_ket_hop_voi_loai_mach(client, ba_mach):
    mo, dong, bai = ba_mach
    assert _ids(client, "trang_thai=closed&loai_mach=nhat_ky") == {dong.pk}
    assert _ids(client, "trang_thai=closed&loai_mach=bai_viet") == {bai.pk}
    assert _ids(client, "trang_thai=open&loai_mach=bai_viet") == set()


def test_cursor_giu_nguyen_bo_loc(client, ba_mach):
    mo, dong, bai = ba_mach
    trang1 = lay(client, "/api/v1/feeds/moi?trang_thai=closed&limit=1")
    assert len(trang1["items"]) == 1 and trang1["cursor_ke_tiep"] is not None
    trang2 = lay(
        client,
        f"/api/v1/feeds/moi?trang_thai=closed&limit=1&cursor={trang1['cursor_ke_tiep']}",
    )
    ids = {trang1["items"][0]["id"], trang2["items"][0]["id"]}
    assert ids == {dong.pk, bai.pk}
    assert trang2["cursor_ke_tiep"] is None


@pytest.mark.parametrize("gia_tri", ["OPEN", "dong", "all", "1", ""])
def test_gia_tri_la_bi_chan_400_tham_so_khong_hop_le(client, ba_mach, gia_tri):
    d = lay(client, f"/api/v1/feeds/moi?trang_thai={gia_tri}", status=400)
    assert d["code"] == "tham_so_khong_hop_le"


def test_feed_dang_dien_ra_khong_nhan_tham_so_nay(client, ba_mach):
    """Chỉ `/feeds/moi` có `trang_thai` (plan §6.3): feed kia vốn đã chỉ gồm mạch đang mở,
    nên tham số lạ ở đó bị Ninja bỏ qua — không đổi tập kết quả."""
    mo, dong, bai = ba_mach
    ids = {
        m["id"]
        for m in lay(client, "/api/v1/feeds/dang-dien-ra?trang_thai=closed&limit=50")["items"]
    }
    assert ids == {mo.pk}
