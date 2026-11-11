"""ĐUA hai lượt `PUT /admin/subs/trang-chu` — plan `2026-11-11-bai-viet-trang-chu-gia-sach.md`.

Lỗi nó canh: khoá `select_for_update` chỉ trên "hàng đang có vị trí + hàng trong payload" là khoá
HỞ. Lượt A đặt [x, y] chưa commit thì x, y chưa có vị trí trong ảnh chụp của lượt B ⇒ B không
khoá chúng, không thấy chúng; B lưu [z] gán z = vị trí 1 trùng x ⇒ IntegrityError ⇒ 500, còn B
lưu [] thì trả 200 mà DB vẫn {x:1, y:2}, không audit. Cách đóng: khoá CẢ bảng rồi mới đọc.

`transaction=True` bắt buộc (cùng lý do `test_anh_dua_khoa.py`): luồng con có kết nối riêng và
chỉ thấy nhau nếu dữ liệu đã COMMIT. Lượt A bị giữ ở `ghi_audit` (SAU khi đã ghi vị trí, TRƯỚC
commit) bằng một `Event` để B chắc chắn chạy trong cửa sổ đó.
"""

import threading
import time

import pytest
from django.contrib.auth import get_user_model
from django.db import connection

import api.quan_tri_sub as qts
from api.quan_tri_schemas import DatTrangChuSubIn
from core.models import AuditLog, Sub

#: B phải bị chặn ít nhất chừng này giây trước khi A được thả — đủ để thấy "B chờ".
THOI_GIAN_B_CHO = 1.0
CHO_TOI_DA = 30.0


class _Req:
    def __init__(self, user):
        self.user = user


def _chay(monkeypatch, slugs_b: list[str]):
    """A đặt [x, y] và bị giữ trước commit; B đặt `slugs_b`. Trả (kq_a, kq_b, b_xong_som)."""
    user = get_user_model().objects.create_user(
        username="adm", password="x", is_staff=True, is_superuser=True
    )
    for slug in ("w", "x", "y", "z"):
        Sub.objects.create(slug=slug, ten=slug)
    Sub.objects.filter(slug="w").update(vi_tri_trang_chu=1)

    ghi_goc = qts.ghi_audit
    a_da_ghi = threading.Event()  # A đã ghi vị trí, đang giữ trước commit
    tha_a = threading.Event()

    def ghi_cham(**kw):
        if threading.current_thread().name == "A":
            a_da_ghi.set()
            assert tha_a.wait(CHO_TOI_DA), "A không được thả"
        return ghi_goc(**kw)

    monkeypatch.setattr(qts, "ghi_audit", ghi_cham)

    kq: dict[str, object] = {}

    def chay(ten, slugs):
        try:
            kq[ten] = qts.dat_trang_chu_sub(_Req(user), DatTrangChuSubIn(slugs=slugs))
        except BaseException as e:  # noqa: BLE001 - thu hết để báo lại ở luồng chính
            kq[ten] = e
        finally:
            connection.close()

    ta = threading.Thread(target=chay, args=("A", ["x", "y"]), name="A")
    tb = threading.Thread(target=chay, args=("B", slugs_b), name="B")
    ta.start()
    assert a_da_ghi.wait(CHO_TOI_DA), "A không tới được điểm giữ"
    tb.start()
    time.sleep(THOI_GIAN_B_CHO)
    b_xong_som = "B" in kq  # khoá đúng ⇒ B còn đang chờ A, chưa có kết quả
    tha_a.set()
    ta.join(CHO_TOI_DA)
    tb.join(CHO_TOI_DA)
    assert not ta.is_alive() and not tb.is_alive(), "treo (deadlock?)"
    return kq, b_xong_som


def _vi_tri() -> dict:
    return dict(Sub.objects.values_list("slug", "vi_tri_trang_chu"))


@pytest.mark.django_db(transaction=True)
def test_B_luu_z_khi_A_dang_giu_thi_CHO_roi_thanh_cong(monkeypatch):
    kq, b_xong_som = _chay(monkeypatch, ["z"])

    assert b_xong_som is False, "B không bị chặn bởi A ⇒ khoá hở"
    assert isinstance(kq["A"], list), kq["A"]
    assert isinstance(kq["B"], list), f"B nổ thay vì thành công: {kq['B']!r}"
    # B chạy SAU A: giá sách cuối cùng là đúng yêu cầu của B, A bị ghi đè sạch.
    assert _vi_tri() == {"w": None, "x": None, "y": None, "z": 1}
    # Hai lượt, hai dòng nhật ký; dòng của B nhìn thấy kết quả của A là "trước".
    dong = list(AuditLog.objects.filter(action="dat_trang_chu_sub").order_by("id"))
    assert [d.meta["sau"] for d in dong] == [["x", "y"], ["z"]]
    assert dong[1].meta["truoc"] == ["x", "y"]


@pytest.mark.django_db(transaction=True)
def test_B_go_het_khi_A_dang_giu_thi_DB_cuoi_toan_NULL(monkeypatch):
    kq, b_xong_som = _chay(monkeypatch, [])

    assert b_xong_som is False, "B không bị chặn bởi A ⇒ khoá hở"
    assert isinstance(kq["B"], list), f"B nổ: {kq['B']!r}"
    assert set(_vi_tri().values()) == {None}, "B báo 200 mà DB vẫn giữ vị trí của A"
    dong = list(AuditLog.objects.filter(action="dat_trang_chu_sub").order_by("id"))
    assert dong[-1].meta == {"truoc": ["x", "y"], "sau": []}
