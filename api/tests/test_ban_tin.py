"""Bản tin bảng riêng — `plans/2026-11-13-ban-tin-bang-rieng.md` §5, A1–A4, A6, A8 (phần
`Literal` khung) và lượt xem qua `/dem-luot-xem`.

A5 (lệnh chuyển dữ liệu) ở `test_chuyen_ban_tin.py`; A7 (bot) ở `test_bot_dang_tin.py`.
"""

import json
import types
from datetime import UTC, date, datetime, timedelta
from typing import get_args

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.test import Client, override_settings
from django.utils import timezone

from api.ban_tin import KhungOut
from api.dem_luot_xem import HEADER_SECRET
from core.ghi_ban_tin import dang_khung_ban_tin
from core.models import BanTin, BanTinKhung, Mach, Sub, User
from core.models.ban_tin import SUB_BAN_TIN, KhungBanTin
from tests.conftest import dat, lay, ma_loi

URL = "/api/v1/ban-tin"
BODY = "<h3>Phiên Mỹ</h3><p>S&amp;P 500 đóng cửa 5.432,10 điểm.</p>"
FIGURES = [
    {"label": "S&P 500", "value": "5.432,10 (-0,35%)"},
    {"label": "Nasdaq", "value": "17.100"},
    {"label": "Dow", "value": "39.000"},
    {"label": "Vàng", "value": "2.400"},
    {"label": "Dầu", "value": "80"},
]


def tai_khoan_doi(username: str = "gikky-team-news") -> User:
    return User.objects.create(username=username, la_tai_khoan_doi=True)


def than(khung: str = "dem_qua", **ghi_de) -> dict:
    return {"khung": khung, "title": "Bản tin 13/11", "body": BODY, "figures": FIGURES, **ghi_de}


def dung_ban_tin(ngay: date, khung: list[str], *, tac_gia: User, an: bool = False) -> BanTin:
    """Dựng thẳng bằng ORM — cho bài đo đường ĐỌC, không đi qua đường ghi."""
    bt = BanTin.objects.create(
        ngay=ngay,
        title=f"Bản tin {ngay:%d/%m}",
        tac_gia=tac_gia,
        hidden_at=timezone.now() if an else None,
    )
    for i, k in enumerate(khung):
        BanTinKhung.objects.create(
            ban_tin=bt,
            khung=k,
            body=f"<p>{k}</p>",
            figures=FIGURES if i == len(khung) - 1 else None,
            created_at=timezone.now() + timedelta(minutes=i),
        )
    return bt


@pytest.fixture
def dong_ho(monkeypatch):
    """Ghim "bây giờ" của đường ghi bản tin, chỉ trong `core/ghi_ban_tin.py`."""

    def dat_gio(khi: datetime) -> None:
        monkeypatch.setattr(
            "core.ghi_ban_tin.timezone", types.SimpleNamespace(now=lambda: khi)
        )

    return dat_gio


# --- A1: model + ràng buộc ---------------------------------------------------


@pytest.mark.django_db
def test_A1_hai_ban_tin_cung_ngay_thi_IntegrityError():
    u = tai_khoan_doi()
    BanTin.objects.create(ngay=date(2026, 11, 13), title="a", tac_gia=u)
    with pytest.raises(IntegrityError), transaction.atomic():
        BanTin.objects.create(ngay=date(2026, 11, 13), title="b", tac_gia=u)


@pytest.mark.django_db
def test_A1_hai_khung_trung_trong_mot_ngay_thi_IntegrityError():
    bt = BanTin.objects.create(ngay=date(2026, 11, 13), title="a", tac_gia=tai_khoan_doi())
    BanTinKhung.objects.create(ban_tin=bt, khung="dem_qua", body="<p>1</p>")
    with pytest.raises(IntegrityError), transaction.atomic():
        BanTinKhung.objects.create(ban_tin=bt, khung="dem_qua", body="<p>2</p>")


@pytest.mark.django_db
def test_A1_figures_sai_dang_thi_ValidationError():
    bt = BanTin.objects.create(ngay=date(2026, 11, 13), title="a", tac_gia=tai_khoan_doi())
    k = BanTinKhung(ban_tin=bt, khung="dem_qua", body="<p>1</p>", figures={"label": "x"})
    with pytest.raises(ValidationError):
        k.full_clean()
    # Đường ghi cũng chặn (không trông vào `full_clean`).
    with pytest.raises(ValidationError):
        dang_khung_ban_tin(
            tac_gia=bt.tac_gia, khung="truoc_phien_vn", title="x", body=BODY,
            figures=[{"label": "x"}],
        )


def test_A8_literal_khung_cua_API_bang_dung_choices():
    assert list(get_args(KhungOut)) == list(KhungBanTin.values)


# --- A2: đăng ----------------------------------------------------------------


@pytest.mark.django_db
def test_A2_tai_khoan_doi_dang_duoc_va_ngay_la_ngay_VN_luc_23_30_UTC(client, dong_ho):
    # 23:30 UTC 12/11 = 06:30 VN 13/11 — đã sang ngày VN hôm sau.
    dong_ho(datetime(2026, 11, 12, 23, 30, tzinfo=UTC))
    client.force_login(tai_khoan_doi())
    ra = dat(client, URL, than(), status=201)
    assert ra == {
        "ngay": "2026-11-13",
        "khung": "dem_qua",
        "url": "/s/tin-tuc/2026-11-13",
        "body": BanTinKhung.objects.get().body,
    }
    bt = BanTin.objects.get()
    assert bt.ngay == date(2026, 11, 13)
    assert bt.title == "Bản tin 13/11"
    assert bt.khung.get().figures == FIGURES


@pytest.mark.django_db
def test_A2_khung_thu_hai_vao_cung_ngay_va_title_sau_bi_bo_qua(client, dong_ho):
    client.force_login(tai_khoan_doi())
    dong_ho(datetime(2026, 11, 12, 23, 30, tzinfo=UTC))
    dat(client, URL, than("dem_qua", title="Tiêu đề sáng"), status=201)
    dong_ho(datetime(2026, 11, 13, 1, 7, tzinfo=UTC))
    dat(client, URL, than("truoc_phien_vn", title="Tiêu đề khác"), status=201)
    bt = BanTin.objects.get()
    assert bt.title == "Tiêu đề sáng"
    assert sorted(bt.khung.values_list("khung", flat=True)) == ["dem_qua", "truoc_phien_vn"]
    assert bt.cap_nhat_luc == datetime(2026, 11, 13, 1, 7, tzinfo=UTC)


@pytest.mark.django_db
def test_A2_khung_trung_thi_409_khung_da_dang_va_khong_ghi_gi(client):
    client.force_login(tai_khoan_doi())
    dat(client, URL, than(), status=201)
    assert ma_loi(client, URL, than(body="<p>lần hai</p>"), status=409) == "khung_da_dang"
    assert BanTinKhung.objects.count() == 1
    assert "lần hai" not in BanTinKhung.objects.get().body


@pytest.mark.django_db
@pytest.mark.parametrize("is_staff", [False, True], ids=["thuong", "is_staff_khong_co"])
def test_A2_khong_co_co_tai_khoan_doi_thi_403(client, is_staff):
    client.force_login(User.objects.create(username="ai_do", is_staff=is_staff))
    assert ma_loi(client, URL, than(), status=403) == "khong_phai_tai_khoan_doi"
    assert BanTin.objects.count() == 0


@pytest.mark.django_db
def test_A2_khach_thi_401(client):
    assert ma_loi(client, URL, than(), status=401) == "chua_dang_nhap"
    assert BanTin.objects.count() == 0


@pytest.mark.django_db
def test_A2_html_bi_loc_nhu_moc(client):
    client.force_login(tai_khoan_doi())
    dat(
        client,
        URL,
        than(body='<p onclick="x()">Chữ<script>alert(1)</script></p>'),
        status=201,
    )
    body = BanTinKhung.objects.get().body
    assert "<script" not in body and "onclick" not in body and "alert" not in body
    assert "Chữ" in body


@pytest.mark.django_db
def test_A2_than_chi_co_the_bi_chan_thi_400_va_khong_tao_ngay(client):
    client.force_login(tai_khoan_doi())
    code = ma_loi(client, URL, than(body="<script>alert(1)</script>"), status=400)
    assert code == "du_lieu_khong_hop_le"
    assert BanTin.objects.count() == 0


@pytest.mark.django_db
def test_A2_truong_thua_cua_bot_cu_bi_bo_qua(client):
    client.force_login(tai_khoan_doi())
    dat(client, URL, than(question_for_crowd="Bạn nghĩ sao?", loai="Đêm qua"), status=201)


# --- A3: đọc -----------------------------------------------------------------


@pytest.mark.django_db
def test_A3_liet_ke_moi_den_cu_cursor_di_het_khong_trung_khong_sot_bo_ban_an(client):
    u = tai_khoan_doi()
    goc = date(2026, 10, 1)
    for i in range(7):
        dung_ban_tin(goc + timedelta(days=i), ["dem_qua"], tac_gia=u, an=(i == 3))
    thay: list[str] = []
    cursor = None
    while True:
        url = f"{URL}?limit=2" + (f"&cursor={cursor}" if cursor else "")
        trang = lay(client, url)
        thay += [m["ngay"] for m in trang["items"]]
        cursor = trang["cursor_ke_tiep"]
        if cursor is None:
            break
    mong = [
        (goc + timedelta(days=i)).isoformat() for i in reversed(range(7)) if i != 3
    ]
    assert thay == mong


@pytest.mark.django_db
def test_A3_liet_ke_mang_khung_da_co_va_toi_da_4_so_lieu(client):
    dung_ban_tin(date(2026, 11, 13), ["truoc_phien_my", "dem_qua"], tac_gia=tai_khoan_doi())
    (muc,) = lay(client, URL)["items"]
    assert muc["khung_da_co"] == ["dem_qua", "truoc_phien_my"]
    assert muc["so_lieu"] == FIGURES[:4]


@pytest.mark.django_db
def test_A3_cursor_rac_thi_400(client):
    assert lay(client, f"{URL}?cursor=rac!!", status=400)["code"] == "cursor_khong_hop_le"


@pytest.mark.django_db
def test_A3_xem_khung_dung_thu_tu_choices_du_dang_lech(client):
    # Đăng lệch: trước phiên Mỹ trước, rồi đêm qua, rồi trước phiên VN.
    dung_ban_tin(
        date(2026, 11, 13),
        ["truoc_phien_my", "dem_qua", "truoc_phien_vn"],
        tac_gia=tai_khoan_doi(),
    )
    ra = lay(client, f"{URL}/2026-11-13")
    assert [k["khung"] for k in ra["khung"]] == ["dem_qua", "truoc_phien_vn", "truoc_phien_my"]
    assert [k["ten"] for k in ra["khung"]] == ["Đêm qua", "Trước phiên VN", "Trước phiên Mỹ"]
    assert ra["title"] == "Bản tin 13/11"


@pytest.mark.django_db
def test_A3_ngay_truoc_ngay_sau_bo_qua_ban_an(client):
    u = tai_khoan_doi()
    dung_ban_tin(date(2026, 11, 10), ["dem_qua"], tac_gia=u)
    dung_ban_tin(date(2026, 11, 11), ["dem_qua"], tac_gia=u, an=True)
    dung_ban_tin(date(2026, 11, 12), ["dem_qua"], tac_gia=u)
    dung_ban_tin(date(2026, 11, 13), ["dem_qua"], tac_gia=u, an=True)
    ra = lay(client, f"{URL}/2026-11-12")
    assert ra["ngay_truoc"] == "2026-11-10"
    assert ra["ngay_sau"] is None
    dau = lay(client, f"{URL}/2026-11-10")
    assert dau["ngay_truoc"] is None and dau["ngay_sau"] == "2026-11-12"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "ngay", ["2026-13-45", "20261112", "2026-11-1", "khong-phai-ngay", "2026-11-11", "2026-11-14"]
)
def test_A3_ngay_sai_dang_khong_co_hoac_da_an_thi_404(client, ngay):
    u = tai_khoan_doi()
    dung_ban_tin(date(2026, 11, 12), ["dem_qua"], tac_gia=u)
    dung_ban_tin(date(2026, 11, 11), ["dem_qua"], tac_gia=u, an=True)
    assert lay(client, f"{URL}/{ngay}", status=404)["code"] == "khong_tim_thay"


# --- A4: chặn đường cũ -------------------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("la_doi", [False, True], ids=["nguoi_thuong", "tai_khoan_doi"])
def test_A4_tao_mach_vao_sub_ban_tin_thi_400(client, la_doi):
    Sub.objects.create(slug=SUB_BAN_TIN, ten="Tin tức")
    u = User.objects.create(username="nguoi_dang", la_tai_khoan_doi=la_doi)
    client.force_login(u)
    code = ma_loi(
        client,
        "/api/v1/machs",
        {"sub": SUB_BAN_TIN, "title": "Bản tin", "body": "<p>x</p>"},
        status=400,
    )
    assert code == "sub_danh_rieng_ban_tin"
    assert Mach.objects.count() == 0


# --- A6: dữ liệu cho 301 -----------------------------------------------------


@pytest.mark.django_db
def test_A6_tim_ban_tin_tu_mach_cu(client, mach):
    bt = dung_ban_tin(date(2026, 9, 6), ["dem_qua"], tac_gia=tai_khoan_doi())
    bt.mach_cu = mach
    bt.save()
    assert lay(client, f"{URL}/tu-mach/{mach.pk}") == {"ngay": "2026-09-06"}


@pytest.mark.django_db
def test_A6_mach_thuong_hoac_ban_da_an_thi_404(client, mach, nguoi_khac):
    assert lay(client, f"{URL}/tu-mach/{mach.pk}", status=404)["code"] == "khong_tim_thay"
    bt = dung_ban_tin(date(2026, 9, 6), ["dem_qua"], tac_gia=tai_khoan_doi(), an=True)
    bt.mach_cu = mach
    bt.save()
    assert lay(client, f"{URL}/tu-mach/{mach.pk}", status=404)["code"] == "khong_tim_thay"


# --- Lượt xem: đi qua `/dem-luot-xem`, cùng luật với trang mạch --------------

SECRET = "secret-luot-xem-ban-tin"
KHOA_HEADER = "HTTP_" + HEADER_SECRET.upper().replace("-", "_")


def xem(duong_dan: str, *, ua: str = "Mozilla/5.0 Chrome/131", ip: str = "10.0.0.1"):
    r = Client().post(
        "/api/v1/dem-luot-xem",
        data=json.dumps({"duong_dan": duong_dan, "user_agent": ua, "ip": ip}),
        content_type="application/json",
        **{KHOA_HEADER: SECRET},
    )
    assert r.status_code == 200, r.content


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_luot_xem_ban_tin_dem_mot_lan_bo_bot_va_bo_trung():
    bt = dung_ban_tin(date(2026, 11, 13), ["dem_qua"], tac_gia=tai_khoan_doi())
    xem("/s/tin-tuc/2026-11-13")
    xem("/s/tin-tuc/2026-11-13")  # F5 trong cửa sổ — không cộng
    xem("/s/tin-tuc/2026-11-13", ua="Googlebot/2.1")  # bot — không cộng
    xem("/s/tin-tuc/2026-11-13", ip="10.0.0.2")  # khách khác — cộng
    bt.refresh_from_db()
    assert bt.view_count == 2


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_luot_xem_ngay_khong_co_that_khong_500():
    xem("/s/tin-tuc/2026-13-45")
    xem("/s/tin-tuc/2026-11-13")  # chưa có bản tin ngày đó — không nổ
