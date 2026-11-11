"""Backfill của migration `0045_loai_mach` — tiêu chí #11 của `plans/2026-11-10-truong-loai-mach.md`.

`pytest` dựng DB bằng cách chạy mọi migration xuôi trên DB RỖNG, nên hàm `RunPython` không
có hàng nào để đổi lúc đó. Bài đo gọi thẳng `backfill_loai_mach` với `django.apps.apps`
trên dữ liệu dựng tay ở trạng thái "trước migration" (cờ đội = False, mọi mạch `nhat_ky`).
"""

import importlib
from datetime import timedelta

import pytest
from django.apps import apps
from django.utils import timezone

from core.ghi import tao_mach
from core.models.dien_dan import Mach, Sub
from core.models.nguoi_dung import User

from tests._quan_tri import dung_mod
from tests.conftest import dung_user

pytestmark = pytest.mark.django_db

mig = importlib.import_module("core.migrations.0045_loai_mach")


@pytest.fixture
def kich_ban(db):
    """4 tác giả + với mỗi tác giả một mạch thường; riêng 2 tài khoản đội còn có mạch ẩn
    (mod ẩn), hẹn giờ và lưu trữ — ba trạng thái mà backfill không được bỏ sót."""
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    mod = dung_mod()
    tac_gia = {
        ten: dung_user(ten)
        for ten in ("gikky-team-news", "gikky-team-member", "bot-trader", "nguoi_thuong")
    }
    machs: dict[str, Mach] = {}
    for ten, u in tac_gia.items():
        machs[f"{ten}:thuong"], _ = tao_mach(sub=sub, author=u, title=ten, body="x")
    for ten in ("gikky-team-news", "gikky-team-member"):
        u = tac_gia[ten]
        an, _ = tao_mach(sub=sub, author=u, title="ẩn", body="x")
        Mach.objects.filter(pk=an.pk).update(hidden_at=timezone.now(), hidden_by=mod)
        machs[f"{ten}:an"] = an
        hen, _ = tao_mach(
            sub=sub,
            author=u,
            title="hẹn",
            body="x",
            published_at=timezone.now() + timedelta(days=3),
        )
        assert hen.hidden_at is not None and hen.hidden_by_id is None
        machs[f"{ten}:hen"] = hen
        luu, _ = tao_mach(sub=sub, author=u, title="lưu trữ", body="x")
        Mach.objects.filter(pk=luu.pk).update(archived_at=timezone.now(), archived_by=u)
        machs[f"{ten}:luu"] = luu
    # Trạng thái TRƯỚC migration: không ai có cờ, mọi mạch là `nhat_ky` (mặc định cột).
    assert not User.objects.filter(la_tai_khoan_doi=True).exists()
    assert not Mach.objects.exclude(loai_mach="nhat_ky").exists()
    return machs


def _loai(machs):
    return {k: Mach.objects.get(pk=m.pk).loai_mach for k, m in machs.items()}


def test_11_mach_cua_hai_tai_khoan_doi_thanh_bai_viet_ke_ca_an_hen_luu_tru(kich_ban):
    ket_qua = mig.backfill_loai_mach(apps, None)

    loai = _loai(kich_ban)
    for ten in ("gikky-team-news", "gikky-team-member"):
        for tt in ("thuong", "an", "hen", "luu"):
            assert loai[f"{ten}:{tt}"] == "bai_viet", f"{ten}:{tt}"
    assert loai["bot-trader:thuong"] == "nhat_ky"
    assert loai["nguoi_thuong:thuong"] == "nhat_ky"
    # Cờ: đúng hai tài khoản đội, không ai khác.
    assert set(
        User.objects.filter(la_tai_khoan_doi=True).values_list("username", flat=True)
    ) == {"gikky-team-news", "gikky-team-member"}
    # Số hàng báo ra khớp thực tế: 2 tài khoản, 8 mạch (4 mỗi tài khoản).
    assert ket_qua == (2, 8)


def test_11_chay_lan_hai_khong_doi_gi(kich_ban):
    mig.backfill_loai_mach(apps, None)
    truoc = _loai(kich_ban)
    co_truoc = set(User.objects.filter(la_tai_khoan_doi=True).values_list("pk", flat=True))

    assert mig.backfill_loai_mach(apps, None) == (0, 0)

    assert _loai(kich_ban) == truoc
    assert set(User.objects.filter(la_tai_khoan_doi=True).values_list("pk", flat=True)) == co_truoc


def test_11_khong_keo_mach_cua_nguoi_ngoai_doi_sang_bai_viet():
    """Mạch của người ngoài đội không bao giờ bị kéo sang `bai_viet`, kể cả khi trùng tiền tố."""
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    ngoai = dung_user("gikky-team-news-gia")
    m, _ = tao_mach(sub=sub, author=ngoai, title="x", body="x")
    mig.backfill_loai_mach(apps, None)
    assert Mach.objects.get(pk=m.pk).loai_mach == "nhat_ky"
    assert User.objects.get(pk=ngoai.pk).la_tai_khoan_doi is False


def test_11_thieu_mot_tai_khoan_thi_canh_bao_khong_im_lang(capsys):
    """Prod đổi username một trong hai ⇒ backfill trượt một nửa: phải thấy trên màn hình."""
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    tg = dung_user("gikky-team-news")
    tao_mach(sub=sub, author=tg, title="x", body="x")
    ket_qua = mig.backfill_loai_mach(apps, None)
    ra = capsys.readouterr().out
    assert ket_qua == (1, 1)
    assert "CẢNH BÁO" in ra and "1/2" in ra
    assert "1 mạch" in ra


def test_37_khong_tim_thay_tai_khoan_nao_nhung_bang_Mach_co_hang_thi_canh_bao(capsys):
    """Ca 0/2 từng im lặng: prod đổi CẢ HAI username trước khi migrate."""
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    tao_mach(sub=sub, author=dung_user("nguoi_thuong"), title="x", body="x")
    assert mig.backfill_loai_mach(apps, None) == (0, 0)
    ra = capsys.readouterr().out
    assert "CẢNH BÁO" in ra and "0/2" in ra


def test_37_db_trong_thi_im_lang(capsys):
    """DB trống / DB test: thiếu tài khoản là bình thường, không in gì."""
    assert not Mach.objects.exists()
    assert mig.backfill_loai_mach(apps, None) == (0, 0)
    assert capsys.readouterr().out == ""


def test_37_du_hai_tai_khoan_thi_khong_canh_bao(kich_ban, capsys):
    mig.backfill_loai_mach(apps, None)
    ra = capsys.readouterr().out
    assert "CẢNH BÁO" not in ra
    assert "8 mạch" in ra
