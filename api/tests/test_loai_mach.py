"""`Mach.loai_mach` (nhật ký / bài viết) — `plans/2026-11-10-truong-loai-mach.md` §5.

Đo năm thứ: phân giải mặc định theo tác giả (#2, #5, #6, #7), cổng 403 (#3, #4), lọc feed
(#8, #9), bề mặt response (#10), và các hàng rào cấu trúc (CHECK ở DB, cờ không lọt ra
API, `Literal` khớp `TextChoices`).

Backfill của migration ở `test_loai_mach_backfill.py` (#11).
"""

from datetime import timedelta
from typing import get_args

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from core.ghi import tao_mach
from core.models.dien_dan import LoaiMach, Mach, Sub
from core.models.he_thong import AuditLog
from core.models.nguoi_dung import User

from api.schemas_ghi import LoaiMachIn
from api.quan_tri import api_admin
from api.v1 import api_v1
from tests._quan_tri import dang_nhap, dung_mod
from tests.conftest import dung_user, lay

pytestmark = pytest.mark.django_db


@pytest.fixture
def sub(db) -> Sub:
    return Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")


@pytest.fixture
def thuong(db) -> User:
    return dung_user("nguoi_thuong", "Người Thường")


@pytest.fixture
def doi(db) -> User:
    """Tài khoản đội: `is_staff=False` như hai tài khoản đăng bài thật, chỉ có cờ."""
    u = dung_user("gikky-team-news", "gikky · Tin tức")
    u.la_tai_khoan_doi = True
    u.save(update_fields=["la_tai_khoan_doi"])
    return u


def _dang(client, user, sub, **them):
    client.force_login(user)
    return client.post(
        "/api/v1/machs",
        {"sub": sub.slug, "title": "Một bài", "body": "<p>Thân.</p>", **them},
        content_type="application/json",
    )


# --- #2 .. #6 · POST /machs ---------------------------------------------------


def test_2_nguoi_thuong_khong_gui_thi_la_nhat_ky(client, sub, thuong):
    r = _dang(client, thuong, sub)
    assert r.status_code == 201
    assert r.json()["loai_mach"] == "nhat_ky"
    assert Mach.objects.get(pk=r.json()["id"]).loai_mach == "nhat_ky"


@pytest.mark.parametrize("loai", ["bai_viet", "thao_luan"])
def test_3_18_nguoi_thuong_gui_bai_viet_hoac_thao_luan_bi_403_va_khong_co_mach_nao(
    client, sub, thuong, loai
):
    r = _dang(client, thuong, sub, loai_mach=loai)
    assert r.status_code == 403
    assert r.json()["code"] == "loai_mach_khong_duoc_phep"
    assert Mach.objects.count() == 0


def test_3b_cong_403_dung_truoc_ca_sub_khong_ton_tai(client, thuong):
    """Cổng quyền đi trước tra `Sub`: người thường không dò được chuyên mục qua mã lỗi."""
    client.force_login(thuong)
    r = client.post(
        "/api/v1/machs",
        {"sub": "khong-co", "title": "x", "body": "x", "loai_mach": "bai_viet"},
        content_type="application/json",
    )
    assert r.status_code == 403


def test_3c_nguoi_thuong_gui_nhat_ky_tuong_minh_thi_duoc(client, sub, thuong):
    r = _dang(client, thuong, sub, loai_mach="nhat_ky")
    assert r.status_code == 201
    assert r.json()["loai_mach"] == "nhat_ky"


def test_4_gia_tri_la_bi_chan_o_schema_va_khong_co_mach_nao(client, sub, thuong, doi):
    """Plan viết 422, nhưng repo đổi MỌI lỗi validate của Ninja 422 → 400
    `tham_so_khong_hop_le` (`api/loi.py::dang_ky_xu_ly_loi`) — đo theo hợp đồng thật."""
    for user in (thuong, doi):
        r = _dang(client, user, sub, loai_mach="linh_tinh")
        assert r.status_code == 400
        assert r.json()["code"] == "tham_so_khong_hop_le"
    assert Mach.objects.count() == 0


def test_5_tai_khoan_doi_khong_gui_thi_la_bai_viet(client, sub, doi):
    r = _dang(client, doi, sub)
    assert r.status_code == 201
    assert r.json()["loai_mach"] == "bai_viet"
    assert Mach.objects.get(pk=r.json()["id"]).loai_mach == "bai_viet"


def test_6_tai_khoan_doi_gui_nhat_ky_tuong_minh_thi_la_nhat_ky(client, sub, doi):
    r = _dang(client, doi, sub, loai_mach="nhat_ky")
    assert r.status_code == 201
    assert r.json()["loai_mach"] == "nhat_ky"


def test_6b_tai_khoan_doi_gui_bai_viet_tuong_minh_duoc(client, sub, doi):
    r = _dang(client, doi, sub, loai_mach="bai_viet")
    assert r.status_code == 201
    assert r.json()["loai_mach"] == "bai_viet"


def test_19_tai_khoan_doi_gui_thao_luan_duoc(client, sub, doi):
    r = _dang(client, doi, sub, loai_mach="thao_luan")
    assert r.status_code == 201
    assert r.json()["loai_mach"] == "thao_luan"
    assert Mach.objects.get(pk=r.json()["id"]).loai_mach == "thao_luan"


def test_20_tai_khoan_doi_khong_gui_thi_KHONG_BAO_GIO_tu_thanh_thao_luan(
    client, sub, doi
):
    """`thao_luan` không phải mặc định của ai (mục 7.1) — kể cả sau nhiều lần đăng."""
    for _ in range(3):
        assert _dang(client, doi, sub).json()["loai_mach"] == "bai_viet"


def test_26_mod_khong_co_co_gui_bai_viet_van_bi_403_va_khong_tao_mach(client, sub):
    """Cổng của `bai_viet` là `la_tai_khoan_doi`, KHÔNG phải `is_staff` (mục 2.3 / 8.1)."""
    mod = dung_mod("mod_khong_co_co")
    assert mod.is_staff and not mod.la_tai_khoan_doi
    r = _dang(client, mod, sub, loai_mach="bai_viet")
    assert r.status_code == 403
    assert r.json()["code"] == "loai_mach_khong_duoc_phep"
    assert Mach.objects.count() == 0
    assert _dang(client, mod, sub).json()["loai_mach"] == "nhat_ky"


def test_25_mod_khong_co_co_gui_thao_luan_duoc(client, sub):
    mod = dung_mod("mod_khong_co_co")
    r = _dang(client, mod, sub, loai_mach="thao_luan")
    assert r.status_code == 201
    assert r.json()["loai_mach"] == "thao_luan"


def test_duoc_chon_loai_mach_bang_chan_tri():
    """Bảng chân trị đầy đủ của cổng — 4 loại người x 4 giá trị."""
    from api.quyen import duoc_chon_loai_mach

    thuong = User(username="a")
    mod = User(username="b", is_staff=True)
    doi = User(username="c", la_tai_khoan_doi=True)
    ca_hai = User(username="d", is_staff=True, la_tai_khoan_doi=True)
    mong = {
        # (người): (None, nhat_ky, bai_viet, thao_luan)
        "thuong": (thuong, (True, True, False, False)),
        "mod": (mod, (True, True, False, True)),
        "doi": (doi, (True, True, True, True)),
        "ca_hai": (ca_hai, (True, True, True, True)),
    }
    for ten, (u, kq) in mong.items():
        got = tuple(
            duoc_chon_loai_mach(u, loai)
            for loai in (None, "nhat_ky", "bai_viet", "thao_luan")
        )
        assert got == kq, ten


def test_co_doi_khong_dat_duoc_qua_api(client, sub, thuong):
    """Không có cửa API nào đặt `la_tai_khoan_doi`: gửi lậu trường đó không đổi gì."""
    r = _dang(client, thuong, sub, la_tai_khoan_doi=True)
    assert r.status_code == 201
    thuong.refresh_from_db()
    assert thuong.la_tai_khoan_doi is False
    assert r.json()["loai_mach"] == "nhat_ky"


# --- #7, #22 · cửa admin hẹn giờ ----------------------------------------------


def _admin_tao(sub, *, co_doi, **them):
    tac_gia = dung_user("gikky-team-news", "gikky · Tin tức")
    tac_gia.la_tai_khoan_doi = co_doi
    tac_gia.save(update_fields=["la_tai_khoan_doi"])
    mod = dang_nhap(dung_mod())
    return mod.post(
        "/api/admin/machs/hen-gio",
        data={
            "sub": sub.slug,
            "title": "Bài soạn sẵn",
            "body": "<p>Thân bài.</p>",
            "author": "gikky-team-news",
            "published_at": (timezone.now() + timedelta(days=2)).isoformat(),
            **them,
        },
        content_type="application/json",
    )


@pytest.mark.parametrize(
    ("co_doi", "mong"), [(True, "bai_viet"), (False, "nhat_ky")]
)
def test_7_cua_admin_hen_gio_mac_dinh_theo_tac_gia(sub, co_doi, mong):
    r = _admin_tao(sub, co_doi=co_doi)
    assert r.status_code == 201, r.content[:300]
    assert Mach.objects.get(pk=r.json()["id"]).loai_mach == mong


@pytest.mark.parametrize("co_doi", [True, False])
@pytest.mark.parametrize("loai", ["nhat_ky", "bai_viet", "thao_luan"])
def test_22_cua_admin_luu_dung_gia_tri_gui_ke_ca_khi_tac_gia_khong_co_co(
    sub, co_doi, loai
):
    """Staff đã qua cổng quản trị; cổng "người thường" của `POST /machs` KHÔNG áp ở đây."""
    r = _admin_tao(sub, co_doi=co_doi, loai_mach=loai)
    assert r.status_code == 201, r.content[:300]
    assert Mach.objects.get(pk=r.json()["id"]).loai_mach == loai


def test_22_cua_admin_gia_tri_la_bi_chan_va_khong_co_mach_nao(sub):
    r = _admin_tao(sub, co_doi=True, loai_mach="linh_tinh")
    assert r.status_code == 400
    assert r.json()["code"] == "tham_so_khong_hop_le"
    assert Mach.objects.count() == 0


# --- #8, #9 · lọc feed --------------------------------------------------------


@pytest.fixture
def ba_mach(sub, thuong, doi):
    """Hai nhật ký + hai bài viết + hai chủ đề thảo luận, cả sáu công khai và đang mở."""
    ra = {}
    for ten, tg, loai in [
        ("nk1", thuong, None),
        ("nk2", thuong, None),
        ("bv1", doi, None),
        ("bv2", doi, None),
        ("tl1", doi, "thao_luan"),
        ("tl2", doi, "thao_luan"),
    ]:
        ra[ten], _ = tao_mach(sub=sub, author=tg, title=ten, body="x", loai_mach=loai)
    return ra


@pytest.mark.parametrize("feed", ["moi", "dang-dien-ra"])
def test_8_9_loc_feed_cho_hai_tap_roi_nhau_va_hop_la_tap_khong_loc(
    client, ba_mach, feed
):
    def ids(q):
        d = lay(client, f"/api/v1/feeds/{feed}?limit=50{q}")
        return [m["id"] for m in d["items"]]

    tat_ca = ids("")
    nhat_ky = ids("&loai_mach=nhat_ky")
    bai_viet = ids("&loai_mach=bai_viet")
    thao_luan = ids("&loai_mach=thao_luan")

    # Dòng 8 (chấm riêng): KHÔNG tham số ⇒ đúng tập cũ, MỌI mạch công khai — `app/sitemap.ts`
    # liệt kê mạch từ feed này.
    assert set(tat_ca) == {m.pk for m in ba_mach.values()}
    assert len(tat_ca) == 6
    assert set(nhat_ky) == {ba_mach["nk1"].pk, ba_mach["nk2"].pk}
    assert set(bai_viet) == {ba_mach["bv1"].pk, ba_mach["bv2"].pk}
    assert set(thao_luan) == {ba_mach["tl1"].pk, ba_mach["tl2"].pk}
    assert not (set(nhat_ky) & set(bai_viet))
    assert not (set(nhat_ky) & set(thao_luan))
    assert not (set(bai_viet) & set(thao_luan))
    assert set(nhat_ky) | set(bai_viet) | set(thao_luan) == set(tat_ca)


@pytest.mark.parametrize("feed", ["moi", "dang-dien-ra"])
def test_8_9_loai_mach_la_bi_chan_400_tham_so_khong_hop_le(client, ba_mach, feed):
    r = client.get(f"/api/v1/feeds/{feed}?loai_mach=linh_tinh")
    assert r.status_code == 400
    assert r.json()["code"] == "tham_so_khong_hop_le"


def test_loc_loai_mach_ket_hop_duoc_voi_truong_phai(client, sub, thuong, doi):
    a, _ = tao_mach(sub=sub, author=thuong, title="a", body="x", truong_phai="smc")
    tao_mach(sub=sub, author=doi, title="b", body="x", truong_phai="smc")
    d = lay(client, "/api/v1/feeds/moi?truong_phai=smc&loai_mach=nhat_ky")
    assert [m["id"] for m in d["items"]] == [a.pk]


# --- #10 · bề mặt response ----------------------------------------------------


def test_10_the_feed_va_chi_tiet_deu_tra_loai_mach(client, ba_mach):
    chi_tiet = lay(client, f"/api/v1/machs/{ba_mach['bv1'].pk}")
    assert chi_tiet["loai_mach"] == "bai_viet"
    chi_tiet_nk = lay(client, f"/api/v1/machs/{ba_mach['nk1'].pk}")
    assert chi_tiet_nk["loai_mach"] == "nhat_ky"

    feed = {m["id"]: m for m in lay(client, "/api/v1/feeds/moi?limit=50")["items"]}
    assert feed[ba_mach["bv1"].pk]["loai_mach"] == "bai_viet"
    assert feed[ba_mach["nk1"].pk]["loai_mach"] == "nhat_ky"


def test_10b_openapi_khai_enum_cho_ca_hai_schema_output_va_input():
    spec = api_v1.get_openapi_schema()
    schemas = spec["components"]["schemas"]
    for ten in ("MachTomTatOut", "MachChiTietOut"):
        p = schemas[ten]["properties"]["loai_mach"]
        assert p["enum"] == ["nhat_ky", "bai_viet", "thao_luan"]
        assert "loai_mach" in schemas[ten]["required"]
    assert "loai_mach" in schemas["MachMoiIn"]["properties"]
    admin = api_admin.get_openapi_schema()["components"]["schemas"]
    assert admin["MachHenGioMoiIn"]["properties"]["loai_mach"]["anyOf"][0]["enum"] == [
        "nhat_ky",
        "bai_viet",
        "thao_luan",
    ]


# --- hàng rào cấu trúc --------------------------------------------------------


def test_literal_cua_api_khop_TextChoices_cua_model():
    assert set(get_args(LoaiMachIn)) == set(LoaiMach.values)
    assert Mach.LoaiMach is LoaiMach


def test_tao_mach_gia_tri_la_nem_ValidationError_va_khong_ghi_gi(sub, thuong):
    with pytest.raises(ValidationError):
        tao_mach(sub=sub, author=thuong, title="x", body="x", loai_mach="linh_tinh")
    assert Mach.objects.count() == 0


def test_24_DB_tu_choi_loai_mach_la_du_di_thang_qua_ORM(sub, thuong):
    m, _ = tao_mach(sub=sub, author=thuong, title="x", body="x")
    with pytest.raises(IntegrityError), transaction.atomic():
        Mach.objects.filter(pk=m.pk).update(loai_mach="khac")
    # Giá trị thứ ba hợp lệ thì DB nhận.
    Mach.objects.filter(pk=m.pk).update(loai_mach="thao_luan")


def test_LoaiMach_co_dung_ba_gia_tri_va_vua_khit_max_length():
    assert LoaiMach.values == ["nhat_ky", "bai_viet", "thao_luan"]
    gioi_han = Mach._meta.get_field("loai_mach").max_length
    assert max(len(v) for v in LoaiMach.values) <= gioi_han


def test_migration_0045_chep_dung_hai_tai_khoan_dang_bai_cua_lenh_dung_tai_khoan():
    """Migration 0045 chép tay tên hai tài khoản; ghim chúng bằng đúng bảng của lệnh dựng."""
    import importlib

    from core.management.commands.tao_tai_khoan_doi import TAI_KHOAN

    mig = importlib.import_module("core.migrations.0045_loai_mach")
    dang_bai = {u for _, u, _, la_super in TAI_KHOAN if not la_super}
    assert set(mig.TAI_KHOAN_DOI_DANG_BAI) == dang_bai


def test_lenh_tao_tai_khoan_doi_bat_co_cho_hai_tai_khoan_dang_bai_khong_bat_cho_admin(
    monkeypatch,
):
    from django.core.management import call_command

    from core.management.commands.tao_tai_khoan_doi import TAI_KHOAN

    for bien, *_ in TAI_KHOAN:
        monkeypatch.setenv(bien, "mat-khau-do-KHONG-that")
    call_command("tao_tai_khoan_doi", verbosity=0)
    for _, username, _, la_super in TAI_KHOAN:
        assert User.objects.get(username=username).la_tai_khoan_doi is (not la_super)
    # Chạy lần hai: vẫn vậy.
    call_command("tao_tai_khoan_doi", verbosity=0)
    for _, username, _, la_super in TAI_KHOAN:
        assert User.objects.get(username=username).la_tai_khoan_doi is (not la_super)


# --- #23 · GET /me ------------------------------------------------------------


def test_23_me_tra_la_tai_khoan_doi(client, thuong, doi):
    client.force_login(doi)
    assert lay(client, "/api/v1/me")["la_tai_khoan_doi"] is True
    client.force_login(thuong)
    assert lay(client, "/api/v1/me")["la_tai_khoan_doi"] is False
    client.logout()
    assert lay(client, "/api/v1/me")["la_tai_khoan_doi"] is False


def test_23_me_cua_hai_tai_khoan_dang_bai_that_la_true_con_admin_la_false(
    client, monkeypatch
):
    from django.core.management import call_command

    from core.management.commands.tao_tai_khoan_doi import TAI_KHOAN

    for bien, *_ in TAI_KHOAN:
        monkeypatch.setenv(bien, "mat-khau-do-KHONG-that")
    call_command("tao_tai_khoan_doi", verbosity=0)
    for _, username, _, la_super in TAI_KHOAN:
        client.force_login(User.objects.get(username=username))
        assert lay(client, "/api/v1/me")["la_tai_khoan_doi"] is (not la_super)


# --- #28 .. #30 · đóng / mở lại sổ --------------------------------------------


@pytest.fixture
def chu_de(sub, doi):
    m, _ = tao_mach(sub=sub, author=doi, title="Chủ đề tuần", body="x", loai_mach="thao_luan")
    return m


def _dong(client, user, mach, **body):
    client.force_login(user)
    return client.post(
        f"/api/v1/machs/{mach.pk}/close", body, content_type="application/json"
    )


def _mo_lai(client, user, mach):
    client.force_login(user)
    return client.post(f"/api/v1/machs/{mach.pk}/reopen")


def _doi_khac():
    """Tài khoản có cờ `la_tai_khoan_doi`, không `is_staff`, KHÔNG phải tác giả chủ đề."""
    u = dung_user("gikky-team-member")
    u.la_tai_khoan_doi = True
    u.save(update_fields=["la_tai_khoan_doi"])
    assert not u.is_staff
    return u


def test_28_dong_so_chu_de_staff_duoc_nguoi_thuong_va_tai_khoan_co_co_403(
    client, sub, chu_de, thuong
):
    mod = dung_mod("mod_dong")

    r = _dong(client, thuong, chu_de, ket_qua="1 bình luận")
    assert r.status_code == 403
    assert r.json()["code"] == "khong_phai_chu"
    chu_de.refresh_from_db()
    assert chu_de.status == "open"

    r = _dong(client, mod, chu_de, ket_qua="132 bình luận", bai_hoc="Tổng kết tuần")
    assert r.status_code == 200, r.content[:300]
    assert r.json()["status"] == "closed"
    assert r.json()["ket_qua"] == "132 bình luận"


def test_35_tai_khoan_co_co_khong_staff_khong_phai_tac_gia_bi_403_ca_dong_lan_mo_lai(
    client, chu_de
):
    """Mục 9.3: cờ `la_tai_khoan_doi` KHÔNG còn cho đóng / mở lại chủ đề của người khác."""
    khac = _doi_khac()
    r = _dong(client, khac, chu_de)
    assert r.status_code == 403
    assert r.json()["code"] == "khong_phai_chu"
    chu_de.refresh_from_db()
    assert chu_de.status == "open"

    # Mở lại: mạch đang đóng (do tác giả), tài khoản có cờ thử mở.
    Mach.objects.filter(pk=chu_de.pk).update(status="closed", closed_at=timezone.now())
    r = _mo_lai(client, khac, chu_de)
    assert r.status_code == 403
    assert r.json()["code"] == "khong_phai_chu"
    chu_de.refresh_from_db()
    assert chu_de.status == "closed"
    assert AuditLog.objects.count() == 0


def test_28_tac_gia_chu_de_van_dong_duoc_nhu_cu(client, chu_de, doi):
    assert _dong(client, doi, chu_de).status_code == 200


def test_29_mo_lai_chu_de_boi_staff_trong_7_ngay_va_qua_han_thi_409(
    client, chu_de, thuong
):
    mod = dung_mod("mod_mo")
    assert _dong(client, mod, chu_de).status_code == 200

    assert _mo_lai(client, thuong, chu_de).status_code == 403
    r = _mo_lai(client, mod, chu_de)
    assert r.status_code == 200, r.content[:300]
    assert r.json()["status"] == "open"

    # Đóng lại rồi lùi `closed_at` quá 7 ngày ⇒ đúng mã lỗi hiện có.
    assert _dong(client, mod, chu_de).status_code == 200
    Mach.objects.filter(pk=chu_de.pk).update(closed_at=timezone.now() - timedelta(days=8))
    r = _mo_lai(client, mod, chu_de)
    assert r.status_code == 409
    assert r.json()["code"] == "het_han_mo_lai"


def test_31_mod_dong_roi_mo_lai_chu_de_cua_nguoi_khac_de_lai_audit_log_moi_lan(
    client, sub, doi
):
    from core.ghi import AUDIT_DONG_SO_CHU_DE, AUDIT_MO_LAI_CHU_DE

    m, _ = tao_mach(sub=sub, author=doi, title="Chủ đề", body="x", loai_mach="thao_luan")
    mod = dung_mod("mod_audit")

    # Tác giả đóng với tổng kết (0 dòng audit), mod mở lại: meta phải giữ bản CŨ.
    assert _dong(client, doi, m, ket_qua="132 bl", bai_hoc="Tong ket").status_code == 200
    assert AuditLog.objects.count() == 0
    assert _mo_lai(client, mod, m).status_code == 200
    mo = AuditLog.objects.get(action=AUDIT_MO_LAI_CHU_DE)
    assert (mo.actor_id, mo.target_type, mo.target_id) == (mod.pk, "mach", m.pk)
    assert mo.meta["nguoi_bam"] == "mod_audit"
    assert mo.meta["ket_qua_cu"] == "132 bl"
    assert mo.meta["bai_hoc_cu"] == "Tong ket"

    assert _dong(client, mod, m, ket_qua="140 bl", bai_hoc="Moi").status_code == 200
    dong = AuditLog.objects.get(action=AUDIT_DONG_SO_CHU_DE)
    assert (dong.actor_id, dong.target_id) == (mod.pk, m.pk)
    assert dong.meta["nguoi_bam"] == "mod_audit"
    assert {"ket_qua_cu", "bai_hoc_cu"} <= set(dong.meta)
    assert AuditLog.objects.count() == 2


def test_32_tac_gia_tu_dong_va_mo_lai_chu_de_cua_minh_khong_ghi_audit(
    client, chu_de, doi
):
    assert _dong(client, doi, chu_de, ket_qua="x").status_code == 200
    assert _mo_lai(client, doi, chu_de).status_code == 200
    assert AuditLog.objects.count() == 0


def test_audit_chu_de_cung_transaction_voi_dong_so(chu_de, monkeypatch):
    """Dòng audit nằm TRONG transaction của `dong_so`: audit nổ ⇒ mạch không đóng."""
    from core import ghi

    mod = dung_mod("mod_atomic")

    def hong(**_):
        raise RuntimeError("audit nổ")

    monkeypatch.setattr(ghi, "ghi_audit", hong)
    with pytest.raises(RuntimeError):
        ghi.dong_so(mach=chu_de, ket_qua="x", boi=mod)
    chu_de.refresh_from_db()
    assert chu_de.status == "open"
    assert chu_de.ket_qua is None


@pytest.mark.parametrize("loai", ["nhat_ky", "bai_viet"])
def test_30_staff_khong_dong_hay_mo_lai_duoc_so_nhat_ky_hay_bai_viet_cua_nguoi_khac(
    client, sub, thuong, doi, loai
):
    tac_gia = thuong if loai == "nhat_ky" else doi
    m, _ = tao_mach(sub=sub, author=tac_gia, title="x", body="x", loai_mach=loai)
    mod = dung_mod("mod_ngoai")
    assert _dong(client, mod, m).status_code == 403
    # Cờ đội cũng không cho đóng nhật ký của người khác (chỉ `thao_luan` mới nới).
    if tac_gia != doi:
        assert _dong(client, doi, m).status_code == 403
    # Mở lại: đóng bằng chính tác giả rồi để staff thử mở.
    Mach.objects.filter(pk=m.pk).update(status="closed", closed_at=timezone.now())
    assert _mo_lai(client, mod, m).status_code == 403
    m.refresh_from_db()
    assert m.status == "closed"


def test_dong_chu_de_khong_tu_khoa_binh_luan(client, chu_de):
    """Mục 8.3: đóng chủ đề KHÔNG tự tắt bình luận."""
    mod = dung_mod("mod_bl")
    _dong(client, mod, chu_de)
    chu_de.refresh_from_db()
    assert chu_de.tat_binh_luan is False


# --- #34 · loại khác giữ nguyên hành vi mở lại ----------------------------------


@pytest.mark.parametrize("loai", ["nhat_ky", "bai_viet"])
def test_34_nhat_ky_va_bai_viet_mo_lai_van_xoa_ket_qua_va_bai_hoc(
    client, sub, thuong, doi, loai
):
    tac_gia = thuong if loai == "nhat_ky" else doi
    m, _ = tao_mach(sub=sub, author=tac_gia, title="x", body="x", loai_mach=loai)
    assert _dong(client, tac_gia, m, ket_qua="+5%", bai_hoc="Bài học").status_code == 200
    assert _mo_lai(client, tac_gia, m).status_code == 200
    m.refresh_from_db()
    assert (m.status, m.ket_qua, m.bai_hoc) == ("open", None, None)
    assert AuditLog.objects.count() == 0


# --- #36 · chủ đề không riêng tư -----------------------------------------------


def test_36_thao_luan_kem_rieng_tu_bi_400_o_cua_cong_khai_va_khong_tao_mach(client, sub):
    mod = dung_mod("mod_rieng")
    r = _dang(client, mod, sub, loai_mach="thao_luan", rieng_tu=True)
    assert r.status_code == 400
    assert r.json()["code"] == "du_lieu_khong_hop_le"
    assert Mach.objects.count() == 0
    # Đối chứng: cùng người, cùng loại, công khai ⇒ 201.
    assert _dang(client, mod, sub, loai_mach="thao_luan").status_code == 201


def test_36_luat_nam_o_tao_mach_nen_cua_admin_cung_bi_chan(sub, doi):
    """Cửa admin gọi cùng `tao_mach`; luật ở một chỗ. Nó không có trường `rieng_tu` để gửi."""
    with pytest.raises(ValidationError):
        tao_mach(
            sub=sub, author=doi, title="x", body="x", loai_mach="thao_luan", rieng_tu=True
        )
    assert Mach.objects.count() == 0
    # Loại khác + riêng tư vẫn bình thường.
    m, _ = tao_mach(sub=sub, author=doi, title="y", body="x", loai_mach="bai_viet", rieng_tu=True)
    assert m.rieng_tu is True


def test_36_cua_admin_khong_nhan_rieng_tu_gui_kem_thi_chu_de_van_cong_khai(sub):
    r = _admin_tao(sub, co_doi=True, loai_mach="thao_luan", rieng_tu=True)
    assert r.status_code == 201, r.content[:300]
    assert Mach.objects.get(pk=r.json()["id"]).rieng_tu is False
