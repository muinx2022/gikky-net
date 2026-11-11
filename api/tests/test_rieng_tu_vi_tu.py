"""`core/rieng_tu.py` — ba vị từ, mỗi cái đo trên đủ ma trận người xem × loại mạch."""

import pytest
from django.contrib.auth.models import AnonymousUser

from core.ghi import tao_mach
from core.models import Comment, Moc
from core.rieng_tu import loc_cong_khai, loc_xem_duoc, mach_xem_duoc

from ._quan_tri import dung_mod
from .conftest import dung_user, viet


@pytest.fixture
def mo(db, sub):
    """Mạch riêng tư + mạch công khai cùng một tác giả; mỗi mạch một bình luận."""
    tac_gia = dung_user("vt_tac_gia")
    rieng, _ = tao_mach(sub=sub, author=tac_gia, title="Riêng", body="<p>a</p>", rieng_tu=True)
    cong, _ = tao_mach(sub=sub, author=tac_gia, title="Công", body="<p>b</p>")
    return {
        "tac_gia": tac_gia,
        "la": dung_user("vt_la"),
        "staff": dung_mod("vt_staff"),
        "rieng": rieng,
        "cong": cong,
        "c_rieng": viet(rieng, tac_gia, "x"),
        "c_cong": viet(cong, tac_gia, "y"),
    }


def _nguoi(mo, ten):
    return {
        "tac_gia": mo["tac_gia"],
        "staff": mo["staff"],
        "la": mo["la"],
        "an_danh": AnonymousUser(),
        "none": None,
    }[ten]


#: (người xem, xem được mạch riêng tư không). Mạch công khai thì AI CŨNG xem được.
MA_TRAN = [
    ("tac_gia", True),
    ("staff", True),
    ("la", False),
    ("an_danh", False),
    ("none", False),
]


@pytest.mark.parametrize("ten,thay_rieng", MA_TRAN)
def test_mach_xem_duoc(mo, ten, thay_rieng):
    nguoi = _nguoi(mo, ten)
    assert mach_xem_duoc(mo["rieng"], nguoi) is thay_rieng
    assert mach_xem_duoc(mo["cong"], nguoi) is True


@pytest.mark.parametrize("ten,thay_rieng", MA_TRAN)
def test_loc_xem_duoc_tren_mach(mo, ten, thay_rieng):
    from core.models import Mach

    ids = set(loc_xem_duoc(Mach.objects.all(), _nguoi(mo, ten)).values_list("pk", flat=True))
    assert (mo["rieng"].pk in ids) is thay_rieng
    assert mo["cong"].pk in ids


@pytest.mark.parametrize("ten,thay_rieng", MA_TRAN)
def test_loc_xem_duoc_voi_tien_to_mach(mo, ten, thay_rieng):
    """`tien_to="mach__"` cho `Moc` và `Comment`: cùng ma trận qua quan hệ."""
    nguoi = _nguoi(mo, ten)
    moc_ids = set(
        loc_xem_duoc(Moc.objects.all(), nguoi, tien_to="mach__").values_list("mach_id", flat=True)
    )
    cmt_ids = set(
        loc_xem_duoc(Comment.objects.all(), nguoi, tien_to="mach__").values_list("pk", flat=True)
    )
    assert (mo["rieng"].pk in moc_ids) is thay_rieng
    assert (mo["c_rieng"].pk in cmt_ids) is thay_rieng
    assert mo["cong"].pk in moc_ids and mo["c_cong"].pk in cmt_ids


def test_loc_xem_duoc_khong_nhan_nham_tac_gia_cua_mach_khac(mo, sub):
    """Tác giả của mạch A không thấy mạch riêng tư của tác giả B."""
    khac, _ = tao_mach(
        sub=sub, author=mo["la"], title="Riêng của người lạ", body="<p>c</p>", rieng_tu=True
    )
    from core.models import Mach

    ids = set(loc_xem_duoc(Mach.objects.all(), mo["tac_gia"]).values_list("pk", flat=True))
    assert khac.pk not in ids and mo["rieng"].pk in ids


def test_loc_cong_khai_khong_co_nguoi_xem_nen_tac_gia_cung_khong_thay(mo):
    """`loc_cong_khai` không nhận người xem: kể cả tác giả và staff đều không thấy mạch
    riêng tư trong tập này (tìm kiếm / chỉ mục là danh sách công khai)."""
    from core.models import Mach

    ids = set(loc_cong_khai(Mach.objects.all()).values_list("pk", flat=True))
    assert mo["rieng"].pk not in ids and mo["cong"].pk in ids
    cmt = set(loc_cong_khai(Comment.objects.all(), tien_to="mach__").values_list("pk", flat=True))
    assert mo["c_rieng"].pk not in cmt and mo["c_cong"].pk in cmt
