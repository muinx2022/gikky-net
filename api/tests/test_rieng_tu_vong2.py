"""Vòng sửa 2 của bản vá mạch riêng tư (sau nghiệm thu + phản biện, 2026-11-09).

V1 header `Vary` dò id · V2 `published_at` khi công khai · V3 công khai atomic · V4 staff nhận chuông
· V5 digest · V6 `so_mach_moi` + `duoc_trich`. V7 (bài đo cấu trúc) nằm ở `test_rieng_tu_cau_truc.py`.
"""

import json
from datetime import timedelta
from types import SimpleNamespace

import pytest
from django.test import Client
from django.utils import timezone

from core import revalidate
from core.digest import NguoiNhan, dung_digest, nguoi_nhan_digest
from core.ghi import dat_an_mach, tao_binh_luan, tao_mach, them_moc, trich_vao_so
from core.models import Follow, Mach, Moc, Notification, TheoUser
from core.models.tuong_tac import Trich
from core.thoi_gian import khoa_ngay_vn
from core.thong_bao import (
    BINH_LUAN,
    MACH_MOI,
    MOC_MOI,
    REPLY,
    TRICH,
    bao_binh_luan,
    bao_duoc_trich,
    bao_moc_moi,
    bao_reply,
)

from ._quan_tri import dang_nhap, dung_mod
from ._rieng_tu_cua import _ids, ids_khong_ton_tai, patch, post
from .conftest import dung_user, lay, viet
from .test_rieng_tu_ro import tg  # noqa: F401  (fixture dùng chung)

# --- V1: header phản hồi không dò được id ---------------------------------------------

CUA_DOC_5 = {
    "machs": lambda i: f"/api/v1/machs/{i.mach}",
    "machs-comments": lambda i: f"/api/v1/machs/{i.mach}/comments",
    "mocs-comments": lambda i: f"/api/v1/mocs/{i.moc}/comments",
    "mocs-revisions": lambda i: f"/api/v1/mocs/{i.moc}/revisions",
    "machs-me": lambda i: f"/api/v1/machs/{i.mach}/me",
}


def _header(r) -> dict:
    """Mọi header trừ `Date` và `Content-Length` (độ dài thân phụ thuộc chữ chứa id)."""
    return {
        k.lower(): v for k, v in r.headers.items() if k.lower() not in ("date", "content-length")
    }


@pytest.fixture
def mach_bi_an(tg):  # noqa: F811
    """Mạch CÔNG KHAI bị mod ẩn, cùng tác giả."""
    m, _ = tao_mach(sub=tg.sub, author=tg.tac_gia, title="Bị mod ẩn", body="<p>x</p>")
    moc2 = them_moc(mach=m, author=tg.tac_gia, body="<p>y</p>")
    dat_an_mach(mach=m, boi=tg.staff, an=True, ly_do="thử")
    return SimpleNamespace(mach=m.pk, moc=moc2.pk, binh_luan=0, anh=0)


@pytest.mark.django_db
@pytest.mark.parametrize("cua", sorted(CUA_DOC_5))
@pytest.mark.parametrize("ai", ["khach", "nguoi_la"])
def test_v1_header_giong_het_giua_rieng_tu_khong_ton_tai_va_bi_an(tg, mach_bi_an, cua, ai):  # noqa: F811
    nguoi = Client() if ai == "khach" else dang_nhap(tg.nguoi_la)
    url = CUA_DOC_5[cua]
    r_rieng = nguoi.get(url(_ids(tg)))
    r_khong = nguoi.get(url(ids_khong_ton_tai()))
    r_an = nguoi.get(url(mach_bi_an))
    assert r_rieng.status_code == r_khong.status_code == r_an.status_code == 404
    assert _header(r_rieng) == _header(r_khong), (
        f"{cua}/{ai}: header của id riêng tư khác id không tồn tại ⇒ dò được id "
        f"({_header(r_rieng)} vs {_header(r_khong)})"
    )
    assert _header(r_an) == _header(r_khong), f"{cua}/{ai}: header của mạch bị ẩn lệch"


# --- V2: công khai dời `published_at`, KHÔNG đụng cửa sổ sửa -----------------------------


def _lui_ngay(mach: Mach, ngay: int) -> None:
    """Dựng mạch riêng tư viết cách đây `ngay` ngày: lùi cả mạch lẫn mọi mốc."""
    khi = timezone.now() - timedelta(days=ngay)
    Mach.objects.filter(pk=mach.pk).update(
        created_at=khi, published_at=khi, lan_dau_len_song=khi, last_entry_at=khi
    )
    Moc.objects.filter(mach=mach).update(created_at=khi)


@pytest.mark.django_db
def test_v2_cong_khai_dua_mach_len_dau_feed_moi_va_dung_ngay_chuong(tg):  # noqa: F811
    _lui_ngay(tg.mach, 3)
    khac, _ = tao_mach(sub=tg.sub, author=tg.nguoi_la, title="Mạch mới hơn", body="<p>m</p>")
    nguoi_theo = dung_user("theo_v2")
    TheoUser.objects.create(nguoi_theo=nguoi_theo, nguoi_duoc_theo=tg.tac_gia)

    # Trước khi công khai: mạch riêng tư không có trong feed; `khac` đứng đầu.
    truoc = [i["id"] for i in lay(Client(), "/api/v1/feeds/moi")["items"]]
    assert truoc == [khac.pk]

    r = post(dang_nhap(tg.tac_gia), f"/api/v1/machs/{tg.mach.pk}/cong-khai")
    assert r.status_code == 200

    sau = [i["id"] for i in lay(Client(), "/api/v1/feeds/moi")["items"]]
    assert sau[0] == tg.mach.pk, f"mạch vừa công khai phải đứng đầu feed Mới, nhận {sau}"

    # Chuông dùng NGÀY CÔNG KHAI làm khoá gộp, không phải ngày viết cũ.
    chuong = Notification.objects.get(user=nguoi_theo, type=MACH_MOI)
    assert chuong.dedupe_key == f"{MACH_MOI}:{tg.tac_gia.pk}:{khoa_ngay_vn()}"


@pytest.mark.django_db
def test_v2_cong_khai_khong_dong_toi_created_at_hay_lan_dau_len_song(tg):  # noqa: F811
    _lui_ngay(tg.mach, 3)
    truoc_mach = Mach.objects.get(pk=tg.mach.pk)
    truoc_moc = dict(Moc.objects.filter(mach=tg.mach).values_list("pk", "created_at"))
    assert post(dang_nhap(tg.tac_gia), f"/api/v1/machs/{tg.mach.pk}/cong-khai").status_code == 200
    sau_mach = Mach.objects.get(pk=tg.mach.pk)
    assert sau_mach.created_at == truoc_mach.created_at
    assert sau_mach.lan_dau_len_song == truoc_mach.lan_dau_len_song
    assert sau_mach.last_entry_at == truoc_mach.last_entry_at
    assert sau_mach.published_at > truoc_mach.published_at  # chỉ cột này dời
    assert dict(Moc.objects.filter(mach=tg.mach).values_list("pk", "created_at")) == truoc_moc


@pytest.mark.django_db
def test_v2_moc_da_qua_cua_so_sua_van_bi_chan_sau_khi_cong_khai(tg):  # noqa: F811
    """⛔ Công khai KHÔNG được mở lại cửa sổ sửa im lặng của mốc đã viết lúc riêng tư."""
    _lui_ngay(tg.mach, 3)
    ban = dang_nhap(tg.tac_gia)
    url = f"/api/v1/mocs/{tg.moc2.pk}"
    r0 = patch(ban, url, {"body": "<p>Sửa lén</p>"})
    assert (r0.status_code, json.loads(r0.content)["code"]) == (403, "het_cua_so_sua")

    assert post(ban, f"/api/v1/machs/{tg.mach.pk}/cong-khai").status_code == 200

    r1 = patch(ban, url, {"body": "<p>Sửa lén</p>"})
    assert (r1.status_code, json.loads(r1.content)["code"]) == (403, "het_cua_so_sua")


@pytest.mark.django_db
def test_v2_feed_dang_dien_ra_khong_doi_hanh_vi(tg):  # noqa: F811
    """`last_entry_at` (khoá của feed "Đang diễn ra") không bị công khai đụng tới."""
    _lui_ngay(tg.mach, 3)
    khac, _ = tao_mach(sub=tg.sub, author=tg.nguoi_la, title="Mạch mới hơn", body="<p>m</p>")
    assert post(dang_nhap(tg.tac_gia), f"/api/v1/machs/{tg.mach.pk}/cong-khai").status_code == 200
    ids = [i["id"] for i in lay(Client(), "/api/v1/feeds/dang-dien-ra")["items"]]
    assert ids == [khac.pk, tg.mach.pk]


# --- V3: công khai + báo + làm mới cache trong MỘT atomic ---------------------------------


@pytest.mark.django_db
def test_v3_bao_loi_thi_cong_khai_roll_back_va_bam_lai_thi_xong_viec(tg, monkeypatch):  # noqa: F811
    import api.machs as api_machs

    nguoi_theo = dung_user("theo_v3")
    TheoUser.objects.create(nguoi_theo=nguoi_theo, nguoi_duoc_theo=tg.tac_gia)
    ban = Client(raise_request_exception=False)
    ban.force_login(tg.tac_gia, backend="django.contrib.auth.backends.ModelBackend")

    that = api_machs.bao_mach_moi

    def no(_mach):
        raise RuntimeError("chuông hỏng")

    monkeypatch.setattr(api_machs, "bao_mach_moi", no)
    r = post(ban, f"/api/v1/machs/{tg.mach.pk}/cong-khai")
    assert r.status_code == 500
    assert Mach.objects.get(pk=tg.mach.pk).rieng_tu is True, (
        "báo hỏng mà mạch vẫn đã công khai ⇒ lần bấm lại sẽ không báo, không làm mới cache"
    )
    assert Notification.objects.filter(user=nguoi_theo).count() == 0

    monkeypatch.setattr(api_machs, "bao_mach_moi", that)
    da_lam_moi = []
    monkeypatch.setattr(api_machs, "lam_moi_mach", lambda m: da_lam_moi.append(m.pk))
    r = post(ban, f"/api/v1/machs/{tg.mach.pk}/cong-khai")
    assert r.status_code == 200
    assert Mach.objects.get(pk=tg.mach.pk).rieng_tu is False
    assert Notification.objects.filter(user=nguoi_theo, type=MACH_MOI).count() == 1
    assert da_lam_moi == [tg.mach.pk]


# --- V4: người nhận là người XEM ĐƯỢC mạch (tác giả hoặc staff) ----------------------------


@pytest.mark.django_db
def test_v4_staff_duoc_tru_chuong_binh_luan_reply_trich_moc_moi(tg):  # noqa: F811
    staff = tg.staff
    # staff bình luận ⇒ tác giả nhận `binh_luan`
    c_staff = tao_binh_luan(mach=tg.mach, author=staff, body="Staff nói")
    bao_binh_luan(c_staff)
    assert Notification.objects.filter(user=tg.tac_gia, type=BINH_LUAN).count() == 1

    # staff theo dõi + người lạ có Follow cũ; tác giả bình luận ⇒ staff nhận, người lạ không
    Follow.objects.create(user=staff, mach=tg.mach, last_seen_entry_seq=0)
    Follow.objects.create(user=tg.nguoi_la, mach=tg.mach, last_seen_entry_seq=0)
    c_tg = tao_binh_luan(mach=tg.mach, author=tg.tac_gia, body="Tác giả nói")
    bao_binh_luan(c_tg)
    assert Notification.objects.filter(user=staff, type=BINH_LUAN).count() == 1
    assert Notification.objects.filter(user=tg.nguoi_la).count() == 0

    # nối mốc ⇒ `moc_moi` tới staff, không tới người lạ
    assert bao_moc_moi(tg.moc2) == 1
    assert Notification.objects.filter(user=staff, type=MOC_MOI).count() == 1
    assert Notification.objects.filter(user=tg.nguoi_la).count() == 0

    # tác giả trả lời bình luận của staff ⇒ staff nhận `reply`
    tra_loi = tao_binh_luan(mach=tg.mach, author=tg.tac_gia, body="Trả lời staff", parent=c_staff)
    assert bao_reply(tra_loi) == 1
    assert Notification.objects.filter(user=staff, type=REPLY).count() == 1

    # tác giả trích bình luận của staff ⇒ staff nhận `trich`
    trich = trich_vao_so(moc=tg.moc2, comment=c_staff)
    assert bao_duoc_trich(trich) == 1
    assert Notification.objects.filter(user=staff, type=TRICH).count() == 1

    # người lạ: mọi thứ vẫn 0
    assert Notification.objects.filter(user=tg.nguoi_la).count() == 0


# --- V5: digest ----------------------------------------------------------------------------


def _bat_digest(user):
    user.nhan_digest = True
    user.email = f"{user.username}@example.test"
    user.save(update_fields=["nhan_digest", "email"])


@pytest.mark.django_db
def test_v5_digest_khong_gui_tieu_de_mach_rieng_tu_cho_nguoi_la(tg):  # noqa: F811
    _bat_digest(tg.nguoi_la)
    Follow.objects.create(user=tg.nguoi_la, mach=tg.mach, last_seen_entry_seq=0)
    bay_gio = timezone.now()
    tu, den = bay_gio - timedelta(days=7), bay_gio + timedelta(minutes=1)

    assert tg.nguoi_la.pk not in [n.user.pk for n in nguoi_nhan_digest()]
    # Dựng thẳng NguoiNhan (bỏ qua bước lọc người nhận) để thân thư tự đứng được một mình.
    d = dung_digest(NguoiNhan(user=tg.nguoi_la, mach_ids=(tg.mach.pk,)), tu, den, "https://x.test")
    assert d is None or tg.mach.title not in d.than

    # Sau công khai: có người nhận, thân thư có tiêu đề.
    assert post(dang_nhap(tg.tac_gia), f"/api/v1/machs/{tg.mach.pk}/cong-khai").status_code == 200
    assert tg.nguoi_la.pk in [n.user.pk for n in nguoi_nhan_digest()]
    d = dung_digest(NguoiNhan(user=tg.nguoi_la, mach_ids=(tg.mach.pk,)), tu, den, "https://x.test")
    assert d is not None and tg.mach.title in d.than


@pytest.mark.django_db
def test_v5_digest_loai_ca_staff_khoi_mach_rieng_tu(tg):  # noqa: F811
    """Digest là email, không có "người xem": loại hẳn mạch riêng tư kể cả với staff."""
    _bat_digest(tg.staff)
    Follow.objects.create(user=tg.staff, mach=tg.mach, last_seen_entry_seq=0)
    assert tg.staff.pk not in [n.user.pk for n in nguoi_nhan_digest()]


# --- V6 -------------------------------------------------------------------------------------


@pytest.mark.django_db
def test_v6a_so_mach_moi_khong_dem_mach_rieng_tu_khac_cua_tac_gia(tg):  # noqa: F811
    """Tác giả có sẵn một mạch riêng tư khác cùng ngày; công khai MỘT mạch ⇒ "đăng 1 bài"."""
    nguoi_theo = dung_user("theo_v6a")
    TheoUser.objects.create(nguoi_theo=nguoi_theo, nguoi_duoc_theo=tg.tac_gia)
    tao_mach(
        sub=tg.sub, author=tg.tac_gia, title="Riêng tư thứ hai", body="<p>z</p>", rieng_tu=True
    )
    assert post(dang_nhap(tg.tac_gia), f"/api/v1/machs/{tg.mach.pk}/cong-khai").status_code == 200
    chuong = Notification.objects.get(user=nguoi_theo, type=MACH_MOI)
    assert chuong.payload["so_mach_moi"] == 1


@pytest.mark.django_db
def test_v6b_duoc_trich_khong_dem_trich_tu_mach_rieng_tu(tg):  # noqa: F811
    """Bình luận CŨ của người lạ trong mạch riêng tư được tác giả trích: khách không thấy con
    số đó trên hồ sơ người lạ; tác giả mạch và staff thấy."""
    cu = tao_binh_luan(mach=tg.mach, author=tg.nguoi_la, body="Câu cũ của người lạ")
    trich_vao_so(moc=tg.moc2, comment=cu)
    assert Trich.objects.filter(comment=cu).count() == 1
    url = f"/api/v1/users/{tg.nguoi_la.username}"
    assert lay(Client(), url)["duoc_trich"] == 0
    assert lay(dang_nhap(dung_user("khac_v6b")), url)["duoc_trich"] == 0
    assert lay(dang_nhap(tg.tac_gia), url)["duoc_trich"] == 1
    assert lay(dang_nhap(tg.staff), url)["duoc_trich"] == 1
