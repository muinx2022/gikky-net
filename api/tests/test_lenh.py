"""Lệnh có cấu trúc trên `Mach` — `plans/2026-11-11-homepage-v2-giao-dien-moi.md` §6.1, §6.5.

Bốn tầng, mỗi tầng một nhóm bài đo:

1. **hàm thuần** `core/lenh.py` — chuẩn hoá chuỗi (không bao giờ ra dạng mũ), R:R, luật thứ tự;
2. **cửa API** `POST /machs` — đúng thứ tự thì 201 kèm `lenh`, sai thì 400 `du_lieu_khong_hop_le`
   và KHÔNG có `Mach` nào, `lenh` trên bài viết / chủ đề bị chặn;
3. **bề mặt đọc** — thẻ feed và chi tiết mạch cùng trả `lenh`; không endpoint nào khác nhận `lenh`
   (bất biến sau khi tạo);
4. **DB** — bốn CHECK của migration `0046` chặn dữ liệu nạp tay, bỏ qua mọi tầng trên.
"""

from decimal import Decimal
from typing import get_args

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from core.ghi import tao_mach
from core.lenh import Lenh, chuoi_so, kiem_lenh, ty_le_rr
from core.models.dien_dan import LenhChieu, Mach, Sub
from core.models.moc import Moc
from core.models.nguoi_dung import User

from api.schemas_ghi import LenhChieuIn
from api.v1 import api_v1
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
    u = dung_user("gikky-team-news", "gikky · Tin tức")
    u.la_tai_khoan_doi = True
    u.save(update_fields=["la_tai_khoan_doi"])
    return u


def _dang(client, user, sub, **them):
    client.force_login(user)
    return client.post(
        "/api/v1/machs",
        {"sub": sub.slug, "title": "Mua HPG", "body": "<p>Thân.</p>", **them},
        content_type="application/json",
    )


def _lenh(**ghi_de):
    return {
        "chieu": "mua",
        "ma": "hpg",
        "gia_vao": "27.5",
        "sl": "26.0",
        "tp": "31.0",
        **ghi_de,
    }


# --- 1 · hàm thuần ---------------------------------------------------------------


@pytest.mark.parametrize(
    ("vao", "mong"),
    [
        ("10", "10"),  # `normalize()` ra `1E+1` — chuỗi phải là "10", không phải "1E+1"
        ("10.00000000", "10"),
        ("100", "100"),
        ("0.00012", "0.00012"),
        ("0.00012000", "0.00012"),
        ("33.20", "33.2"),
        ("33.20000000", "33.2"),
        ("0.8187", "0.8187"),
        ("12.2", "12.2"),
        ("123456789012", "123456789012"),
        ("0.00000001", "0.00000001"),
    ],
)
def test_chuoi_so_bo_so_0_thua_va_khong_bao_gio_ra_dang_mu(vao, mong):
    ra = chuoi_so(Decimal(vao))
    assert ra == mong
    assert "E" not in ra.upper()


def test_chuoi_so_none_la_none():
    assert chuoi_so(None) is None


@pytest.mark.parametrize(
    ("vao", "sl", "tp", "mong"),
    [
        ("12.20", "11.71", "13.37", "2.4"),  # ví dụ trong mockup
        ("100", "90", "130", "3.0"),
        ("0.8187", "0.8223", "0.8100", "2.4"),  # BÁN: |tp−vào| / |vào−sl|
        ("10", "9", "10.25", "0.25"),  # R:R < 1 ⇒ 2 chữ số, không ép về "0.3"
        ("10", "9", "10.35", "0.35"),
        ("10", "9", "10.01", "0.01"),  # ca gây "0.0" khi làm tròn 1 chữ số
        ("10", "9", "10.005", "0.01"),  # 0.005 → HALF_UP lên 0.01
        ("10", "9", "11", "1.0"),  # đúng 1 ⇒ vẫn 1 chữ số
        ("10", "9", "10.999", "1.00"),  # 0.999 < 1 ⇒ 2 chữ số, ra "1.00" (không giả vờ "1.0")
    ],
)
def test_ty_le_rr(vao, sl, tp, mong):
    assert ty_le_rr(Decimal(vao), Decimal(sl), Decimal(tp)) == mong


@pytest.mark.parametrize(
    "ba_so",
    [
        (Decimal("10"), None, Decimal("12")),
        (Decimal("10"), Decimal("9"), None),
        (Decimal("10"), None, None),
        (None, None, None),
        (Decimal("10"), Decimal("10"), Decimal("12")),  # vào = SL ⇒ chia 0 ⇒ None, không ném
        (Decimal("10"), Decimal("9"), Decimal("10.001")),  # R:R 0.001 → 0.00 vô nghĩa ⇒ None
    ],
)
def test_ty_le_rr_thieu_so_hoac_chia_0_thi_none(ba_so):
    assert ty_le_rr(*ba_so) is None


def test_kiem_lenh_in_hoa_ma_va_giu_nguyen_so():
    ra = kiem_lenh(Lenh("mua", " usd/jpy ", Decimal("150.5"), Decimal("149"), Decimal("153")))
    assert ra.ma == "USD/JPY"
    assert (ra.gia_vao, ra.sl, ra.tp, ra.nhoi) == (
        Decimal("150.5"),
        Decimal("149"),
        Decimal("153"),
        None,
    )


@pytest.mark.parametrize(
    "lenh",
    [
        Lenh("mua", "HPG", Decimal("10"), sl=Decimal("10")),  # MUA: SL = vào
        Lenh("mua", "HPG", Decimal("10"), sl=Decimal("11")),  # MUA: SL > vào
        Lenh("mua", "HPG", Decimal("10"), tp=Decimal("10")),
        Lenh("mua", "HPG", Decimal("10"), tp=Decimal("9")),  # MUA: TP < vào
        Lenh("ban", "HPG", Decimal("10"), tp=Decimal("11")),  # BÁN: TP > vào
        Lenh("ban", "HPG", Decimal("10"), sl=Decimal("9")),  # BÁN: SL < vào
        Lenh("ban", "HPG", Decimal("10"), sl=Decimal("10")),
        Lenh("mua", "HPG", Decimal("0")),
        Lenh("mua", "HPG", Decimal("-1")),
        Lenh("mua", "HPG", Decimal("10"), nhoi=Decimal("0")),
        Lenh("mua", "HPG", Decimal("1.123456789")),  # 9 chữ số lẻ > 8
        Lenh("mua", "HPG", Decimal("1234567890123")),  # 13 chữ số nguyên > 12
        Lenh("mua", "HPG", Decimal("NaN")),
        Lenh("mua", "HPG", Decimal("Infinity")),
        Lenh("khac", "HPG", Decimal("10")),
        Lenh("mua", "", Decimal("10")),
        Lenh("mua", "H P G", Decimal("10")),
        Lenh("mua", "HPG;DROP", Decimal("10")),
        Lenh("mua", "A" * 21, Decimal("10")),
    ],
)
def test_kiem_lenh_chan_du_lieu_sai(lenh):
    with pytest.raises(ValidationError):
        kiem_lenh(lenh)


def test_kiem_lenh_chap_nhan_bien_hop_le():
    # Số lớn nhất / nhỏ nhất vừa cột Decimal(20, 8); nhồi không bị ràng buộc thứ tự.
    kiem_lenh(Lenh("mua", "A", Decimal("123456789012.12345678")))
    kiem_lenh(Lenh("mua", "A", Decimal("0.00000001")))
    kiem_lenh(Lenh("mua", "A" * 20, Decimal("10"), nhoi=Decimal("5")))
    kiem_lenh(Lenh("ban", "BTC-USDT", Decimal("10"), sl=Decimal("11"), tp=Decimal("9")))
    kiem_lenh(Lenh("mua", "BRK.B_x/y", Decimal("10")))


def test_literal_cua_api_khop_TextChoices_cua_model():
    assert set(get_args(LenhChieuIn)) == set(LenhChieu.values)


# --- 2 · POST /machs --------------------------------------------------------------


def test_dang_nhat_ky_co_lenh_mua_tra_201_kem_lenh_da_chuan_hoa(client, sub, thuong):
    r = _dang(client, thuong, sub, lenh=_lenh(nhoi="28.50"))
    assert r.status_code == 201, r.content
    d = r.json()
    assert d["lenh"] == {
        "chieu": "mua",
        "ma": "HPG",  # server IN HOA
        "gia_vao": "27.5",
        "sl": "26",
        "tp": "31",
        "nhoi": "28.5",
        "rr": "2.3",  # (31 − 27.5) / (27.5 − 26) = 2.333…
    }
    m = Mach.objects.get(pk=d["id"])
    assert (m.lenh_chieu, m.lenh_ma, m.lenh_gia_vao) == ("mua", "HPG", Decimal("27.5"))


def test_dang_nhat_ky_co_lenh_ban_va_chi_co_ba_cot_loi(client, sub, thuong):
    r = _dang(client, thuong, sub, lenh={"chieu": "ban", "ma": "USD/CHF", "gia_vao": 0.8187})
    assert r.status_code == 201, r.content
    assert r.json()["lenh"] == {
        "chieu": "ban",
        "ma": "USD/CHF",
        "gia_vao": "0.8187",
        "sl": None,
        "tp": None,
        "nhoi": None,
        "rr": None,
    }


def test_rr_chi_co_khi_du_sl_lan_tp(client, sub, thuong):
    r = _dang(client, thuong, sub, lenh=_lenh(tp=None))
    assert r.status_code == 201, r.content
    assert r.json()["lenh"]["sl"] == "26"
    assert r.json()["lenh"]["tp"] is None
    assert r.json()["lenh"]["rr"] is None


def test_khong_gui_lenh_thi_lenh_la_null(client, sub, thuong):
    r = _dang(client, thuong, sub)
    assert r.status_code == 201
    assert r.json()["lenh"] is None
    m = Mach.objects.get(pk=r.json()["id"])
    assert m.lenh_chieu is None and m.lenh_ma is None and m.lenh_gia_vao is None


@pytest.mark.parametrize(
    "lenh",
    [
        _lenh(sl="27.5"),  # MUA: SL = vào
        _lenh(sl="30"),  # MUA: SL > vào
        _lenh(tp="27"),  # MUA: TP < vào
        _lenh(chieu="ban"),  # BÁN: sl 26 < vào, tp 31 > vào — đảo ngược cả hai
        _lenh(chieu="ban", sl="30", tp="31"),  # BÁN: TP > vào
    ],
)
def test_sai_thu_tu_sl_vao_tp_tra_400_du_lieu_khong_hop_le_va_khong_co_mach(
    client, sub, thuong, lenh
):
    r = _dang(client, thuong, sub, lenh=lenh)
    assert r.status_code == 400, r.content
    assert r.json()["code"] == "du_lieu_khong_hop_le"
    assert not Mach.objects.exists()


@pytest.mark.parametrize(
    "lenh",
    [
        {"chieu": "mua", "ma": "HPG"},  # thiếu gia_vao
        {"chieu": "mua", "gia_vao": "10"},  # thiếu ma
        {"ma": "HPG", "gia_vao": "10"},  # thiếu chieu
        {"chieu": "mua", "ma": "HPG", "gia_vao": "0"},
        {"chieu": "mua", "ma": "HPG", "gia_vao": "-5"},
        {"chieu": "mua", "ma": "HPG", "gia_vao": "abc"},
        {"chieu": "mua", "ma": "HPG", "gia_vao": "10", "sl": "0"},
        {"chieu": "mua", "ma": "HPG", "gia_vao": "10", "nhoi": "-1"},
        {"chieu": "long", "ma": "HPG", "gia_vao": "10"},
        {"chieu": "mua", "ma": "", "gia_vao": "10"},
        {"chieu": "mua", "ma": "A" * 21, "gia_vao": "10"},
        {"chieu": "mua", "ma": "H P G", "gia_vao": "10"},
        {"chieu": "mua", "ma": "HPG", "gia_vao": "1.123456789"},
        {"chieu": "mua", "ma": "HPG", "gia_vao": "1234567890123"},
    ],
)
def test_lenh_sai_hinh_dang_tra_400_va_khong_co_mach(client, sub, thuong, lenh):
    r = _dang(client, thuong, sub, lenh=lenh)
    assert r.status_code == 400, r.content
    assert not Mach.objects.exists()


@pytest.mark.parametrize("loai", ["bai_viet", "thao_luan"])
def test_lenh_tren_bai_viet_hoac_chu_de_tra_400_va_khong_co_mach(client, sub, doi, loai):
    r = _dang(client, doi, sub, loai_mach=loai, lenh=_lenh())
    assert r.status_code == 400, r.content
    assert r.json()["code"] == "du_lieu_khong_hop_le"
    assert not Mach.objects.exists()


def test_tai_khoan_doi_khong_gui_loai_thi_la_bai_viet_nen_lenh_bi_chan(client, sub, doi):
    """`loai_mach` phân giải ra `bai_viet` theo tác giả ⇒ cũng không nhận `lenh`."""
    r = _dang(client, doi, sub, lenh=_lenh())
    assert r.status_code == 400, r.content
    assert not Mach.objects.exists()


def test_tai_khoan_doi_gui_nhat_ky_tuong_minh_thi_nhan_lenh(client, sub, doi):
    r = _dang(client, doi, sub, loai_mach="nhat_ky", lenh=_lenh())
    assert r.status_code == 201, r.content
    assert r.json()["lenh"]["ma"] == "HPG"


def test_tao_mach_nem_ValidationError_cho_lenh_tren_bai_viet_va_khong_ghi_gi(sub, doi):
    with pytest.raises(ValidationError):
        tao_mach(
            sub=sub,
            author=doi,
            title="x",
            body="y",
            loai_mach="bai_viet",
            lenh=Lenh("mua", "HPG", Decimal("10")),
        )
    assert not Mach.objects.exists()


# --- 3 · bề mặt đọc ----------------------------------------------------------------


def test_the_feed_va_chi_tiet_deu_tra_lenh(client, sub, thuong):
    r = _dang(client, thuong, sub, lenh=_lenh())
    assert r.status_code == 201
    mach_id = r.json()["id"]
    _dang(client, thuong, sub, title="Không lệnh")

    feed = lay(client, "/api/v1/feeds/moi?limit=50")
    the = {m["id"]: m for m in feed["items"]}
    assert the[mach_id]["lenh"]["ma"] == "HPG"
    assert the[mach_id]["lenh"]["rr"] == "2.3"
    khac = next(m for m in feed["items"] if m["id"] != mach_id)
    assert khac["lenh"] is None

    ct = lay(client, f"/api/v1/machs/{mach_id}")
    assert ct["lenh"] == the[mach_id]["lenh"]


def test_lenh_song_sot_khi_moc_1_la_bia_mo(client, sub, thuong):
    """`lenh` là thuộc tính của MẠCH như `title`, không phải của mốc 1 — xoá mốc 1 không
    được làm dải lệnh biến mất khỏi thẻ."""
    r = _dang(client, thuong, sub, lenh=_lenh())
    mach_id = r.json()["id"]
    Moc.objects.filter(mach_id=mach_id, seq=1).update(deleted_at=timezone.now())
    ct = lay(client, f"/api/v1/machs/{mach_id}")
    assert ct["lenh"]["ma"] == "HPG"
    the = next(m for m in lay(client, "/api/v1/feeds/moi")["items"] if m["id"] == mach_id)
    assert the["lenh"]["ma"] == "HPG"


def test_chi_post_machs_nhan_lenh_trong_than_request():
    """Bất biến sau khi tạo: không operation nào khác có `lenh` trong thân request. Duyệt
    `openapi.json` của `v1` — thêm `lenh` vào một PATCH sẽ làm bài này đỏ."""
    schema = api_v1.get_openapi_schema()
    thanh_phan = schema["components"]["schemas"]

    def chua_lenh(nut, da_xet=frozenset()) -> bool:
        if isinstance(nut, dict):
            ref = nut.get("$ref")
            if ref is not None:
                ten = ref.rsplit("/", 1)[-1]
                if ten in da_xet:
                    return False
                return ten == "LenhIn" or chua_lenh(thanh_phan[ten], da_xet | {ten})
            if "lenh" in nut.get("properties", {}):
                return True
            return any(chua_lenh(v, da_xet) for v in nut.values())
        if isinstance(nut, list):
            return any(chua_lenh(v, da_xet) for v in nut)
        return False

    nhan = sorted(
        f"{method.upper()} {path}"
        for path, ops in schema["paths"].items()
        for method, op in ops.items()
        if chua_lenh(op.get("requestBody", {}))
    )
    assert nhan == ["POST /api/v1/machs"]


# --- 4 · CHECK ở DB (dữ liệu nạp tay, bỏ qua mọi tầng trên) -------------------------


def _tao_tay(sub, user, **cot):
    """`Mach.objects.create` trực tiếp — không qua `kiem_lenh`."""
    with transaction.atomic():
        return Mach.objects.create(sub=sub, author=user, title="Nạp tay", **cot)


def test_check_ba_cot_loi_cung_null_hoac_cung_co(sub, thuong):
    for cot in (
        {"lenh_chieu": "mua"},
        {"lenh_ma": "HPG"},
        {"lenh_gia_vao": Decimal("10")},
        {"lenh_chieu": "mua", "lenh_ma": "HPG"},
        {"lenh_ma": "HPG", "lenh_gia_vao": Decimal("10")},
    ):
        with pytest.raises(IntegrityError):
            _tao_tay(sub, thuong, **cot)
    ok = _tao_tay(sub, thuong, lenh_chieu="mua", lenh_ma="HPG", lenh_gia_vao=Decimal("10"))
    assert ok.pk is not None


def test_check_sl_tp_nhoi_chi_co_khi_co_lenh(sub, thuong):
    for cot in ({"lenh_sl": Decimal("9")}, {"lenh_tp": Decimal("11")}, {"lenh_nhoi": Decimal("9")}):
        with pytest.raises(IntegrityError):
            _tao_tay(sub, thuong, **cot)


def test_check_chieu_chi_nhan_mua_hoac_ban(sub, thuong):
    with pytest.raises(IntegrityError):
        _tao_tay(
            sub, thuong, lenh_chieu="xyz", lenh_ma="HPG", lenh_gia_vao=Decimal("10")
        )


@pytest.mark.parametrize("loai", ["bai_viet", "thao_luan"])
def test_check_lenh_chi_cho_nhat_ky(sub, thuong, loai):
    with pytest.raises(IntegrityError):
        _tao_tay(
            sub,
            thuong,
            loai_mach=loai,
            lenh_chieu="mua",
            lenh_ma="HPG",
            lenh_gia_vao=Decimal("10"),
        )
