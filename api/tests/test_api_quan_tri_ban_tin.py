"""Trang "Bản tin" của khu quản trị — `api/api/quan_tri_ban_tin.py` (việc 21, đợt D).

Bài đo của plan `plans/2026-11-13-quan-tri-ban-tin-chu-de.md` §5:

- **D1** ô "Hôm nay": thứ Sáu 08:30 VN có khung đêm qua ⇒ đêm qua đã đăng, trước phiên VN /
  trước phiên Mỹ "chưa"; 09:30 ⇒ trước phiên VN quá hạn; thứ Bảy ⇒ không có lịch. Cộng hai
  bài ép hạn chót Python khớp với bot (`scripts/tin-tuc/lib.mjs`) và README.
- **D2** sửa khung: `<script>` bị lọc, `figures` sai dạng ⇒ 400, AuditLog có bản trước / sau.
- **D3** ẩn ⇒ cửa công khai 404 + rơi khỏi danh sách; hiện lại ⇒ quay về.
- **D4** xoá khung ⇒ khung biến khỏi cửa công khai, khung khác nguyên vẹn.

Phân quyền (user thường 403, khách 401, mod qua) nằm ở bảng chung
`tests/_quan_tri.py::bang_endpoint` + `test_api_quan_tri_phan_quyen.py`.
"""

import re
from datetime import UTC, date, datetime, timedelta
from pathlib import Path

import pytest
from django.utils import timezone

from api import quan_tri_ban_tin
from core.ghi import (
    AUDIT_AN_BAN_TIN,
    AUDIT_HIEN_BAN_TIN,
    AUDIT_SUA_BAN_TIN,
    AUDIT_SUA_KHUNG_BAN_TIN,
    AUDIT_XOA_KHUNG_BAN_TIN,
    DICH_BAN_TIN,
)
from core.models import BanTin, BanTinKhung, User
from core.models.ban_tin import HAN_CHOT_KHUNG, KhungBanTin
from core.models.he_thong import AuditLog
from core.thoi_gian import TZ_VN

from tests._quan_tri import dang_nhap, dung_mod

pytestmark = pytest.mark.django_db

GOC_REPO = Path(__file__).resolve().parents[2]

#: Thứ Sáu 13/11/2026 — một ngày có lịch.
THU_SAU = date(2026, 11, 13)
NGAY = THU_SAU.isoformat()
URL = f"/api/admin/ban-tin/{NGAY}"
FIGURES = [{"label": "S&P 500", "value": "5.432"}, {"label": "Vàng", "value": "2.400"}]


@pytest.fixture
def mod():
    return dang_nhap(dung_mod())


@pytest.fixture
def dong_ho(monkeypatch):
    """Ghim "bây giờ" của `api/quan_tri_ban_tin.py` — chỉ file đó (nếp `quan_tri_chu_de`)."""

    def dat(khi: datetime) -> None:
        monkeypatch.setattr(quan_tri_ban_tin, "bay_gio", lambda: khi)

    return dat


def gio_vn(ngay: date, h: int, m: int = 0, s: int = 0) -> datetime:
    return datetime(ngay.year, ngay.month, ngay.day, h, m, s, tzinfo=TZ_VN)


def dung(ngay: date = THU_SAU, khung=("dem_qua",), *, an: bool = False) -> BanTin:
    """Bản tin bằng ORM; khung thứ i đăng lúc 06:10 + i giờ VN của ngày đó."""
    doi = User.objects.get_or_create(
        username="gikky-team-news", defaults={"la_tai_khoan_doi": True}
    )[0]
    bt = BanTin.objects.create(
        ngay=ngay,
        title=f"Bản tin {ngay:%d/%m}",
        tac_gia=doi,
        created_at=gio_vn(ngay, 6, 10),
        cap_nhat_luc=gio_vn(ngay, 6 + len(khung) - 1, 10),
        hidden_at=timezone.now() if an else None,
    )
    for i, k in enumerate(khung):
        BanTinKhung.objects.create(
            ban_tin=bt,
            khung=k,
            body=f"<p>Thân {k}</p>",
            figures=FIGURES if k == "dem_qua" else None,
            created_at=gio_vn(ngay, 6 + i, 10),
        )
    return bt


def hom_nay(mod) -> dict:
    r = mod.get("/api/admin/ban-tin")
    assert r.status_code == 200, r.content[:400]
    return r.json()["hom_nay"]


def trang_thai(o: dict) -> dict[str, str]:
    return {k["khung"]: k["trang_thai"] for k in o["khung"]}


# --- D1: ô "Hôm nay" -----------------------------------------------------------


def test_d1_thu_sau_0830_dem_qua_da_dang_hai_khung_con_lai_chua(mod, dong_ho):
    dung(khung=("dem_qua",))
    dong_ho(gio_vn(THU_SAU, 8, 30))
    o = hom_nay(mod)
    assert o["ngay"] == NGAY
    assert o["co_lich"] is True
    assert o["so_da_dang"] == 1
    assert trang_thai(o) == {
        "dem_qua": "da_dang",
        "truoc_phien_vn": "chua",
        "truoc_phien_my": "chua",
    }
    dem_qua = o["khung"][0]
    assert dem_qua["ten"] == "Đêm qua"
    assert datetime.fromisoformat(dem_qua["da_dang_luc"]) == gio_vn(THU_SAU, 6, 10)
    assert [k["han_chot"] for k in o["khung"]] == ["07:00", "09:00", "21:00"]


def test_d1_0930_truoc_phien_vn_qua_han_truoc_phien_my_van_chua(mod, dong_ho):
    dung(khung=("dem_qua",))
    dong_ho(gio_vn(THU_SAU, 9, 30))
    assert trang_thai(hom_nay(mod)) == {
        "dem_qua": "da_dang",
        "truoc_phien_vn": "qua_han",
        "truoc_phien_my": "chua",
    }


def test_d1_bien_han_chot_09_00_59_van_kip_09_01_thi_qua_han(mod, dong_ho):
    """So như bot (`quaHanChot`): phút `>` phút hạn chót — 09:00 vẫn còn kịp."""
    dong_ho(gio_vn(THU_SAU, 9, 0, 59))
    assert trang_thai(hom_nay(mod))["truoc_phien_vn"] == "chua"
    dong_ho(gio_vn(THU_SAU, 9, 1))
    assert trang_thai(hom_nay(mod))["truoc_phien_vn"] == "qua_han"


def test_d1_thu_bay_khong_co_lich(mod, dong_ho):
    dung(khung=("dem_qua",))  # bản tin của thứ Sáu — không được lọt sang thứ Bảy
    dong_ho(gio_vn(THU_SAU + timedelta(days=1), 22, 0))
    o = hom_nay(mod)
    assert o["ngay"] == "2026-11-14"
    assert o["co_lich"] is False
    assert o["so_da_dang"] == 0
    assert set(trang_thai(o).values()) == {"khong_lich"}


def test_d1_ngay_la_ngay_VN_khong_phai_UTC(mod, dong_ho):
    """23:30 UTC thứ Năm = 06:30 VN thứ Sáu: "hôm nay" phải là thứ Sáu, khung đêm qua chưa quá hạn."""
    dong_ho(datetime(2026, 11, 12, 23, 30, tzinfo=UTC))
    o = hom_nay(mod)
    assert o["ngay"] == NGAY
    assert trang_thai(o)["dem_qua"] == "chua"


def test_d1_ban_tin_hom_nay_dang_an_van_dem_khung_va_bao_da_an(mod, dong_ho):
    dung(khung=("dem_qua", "truoc_phien_vn"), an=True)
    dong_ho(gio_vn(THU_SAU, 10, 0))
    o = hom_nay(mod)
    assert o["so_da_dang"] == 2
    assert o["da_an"] is True


def test_d1_khung_hom_nay_bi_mod_xoa_la_da_xoa_khong_phai_qua_han(mod, dong_ho):
    """Vòng sửa 1: xoá một khung hôm nay qua khu quản trị ⇒ ô ghi "đã xoá", không đỏ "quá hạn".
    Khung chưa từng đăng thì vẫn quá hạn như thường; bot đăng lại ⇒ "đã đăng" thắng."""
    dung(khung=("dem_qua", "truoc_phien_vn"))
    # Bản tin NGÀY KHÁC có xoá cùng khung — không được lọt sang hôm nay.
    dung(THU_SAU - timedelta(days=1), khung=("dem_qua", "truoc_phien_my"))
    assert mod.delete("/api/admin/ban-tin/2026-11-12/khung/truoc_phien_my").status_code == 200
    assert mod.delete(f"{URL}/khung/dem_qua").status_code == 200
    dong_ho(gio_vn(THU_SAU, 21, 30))
    o = hom_nay(mod)
    assert trang_thai(o) == {
        "dem_qua": "da_xoa",
        "truoc_phien_vn": "da_dang",
        "truoc_phien_my": "qua_han",
    }
    assert o["so_da_dang"] == 1
    BanTinKhung.objects.create(
        ban_tin=BanTin.objects.get(ngay=THU_SAU),
        khung="dem_qua",
        body="<p>đăng lại</p>",
        created_at=gio_vn(THU_SAU, 21, 0),
    )
    assert trang_thai(hom_nay(mod))["dem_qua"] == "da_dang"


def _han_chot_python() -> dict[str, str]:
    return {k: HAN_CHOT_KHUNG[k].strftime("%H:%M") for k in KhungBanTin.values}


def test_han_chot_KHOP_voi_bot_trong_lib_mjs():
    """Bot khai hạn chót ở `SLOT` (theo tên slot) và ánh xạ slot → khung ở `KHUNG_THEO_SLOT`.
    Đọc cả hai DẠNG CHỮ (không chạy node): đủ để chuông reo khi ai sửa một bên."""
    js = (GOC_REPO / "scripts" / "tin-tuc" / "lib.mjs").read_text(encoding="utf-8")
    han_theo_slot = dict(
        re.findall(r'"([a-z-]+)":\s*Object\.freeze\(\{[^}]*han_chot:\s*"(\d\d:\d\d)"', js)
    )
    khoi = re.search(r"KHUNG_THEO_SLOT = Object\.freeze\(\{(.*?)\}\)", js, re.S)
    assert khoi is not None, "không tìm thấy KHUNG_THEO_SLOT trong lib.mjs"
    khung_theo_slot = dict(re.findall(r'"([a-z-]+)":\s*"([a-z_]+)"', khoi.group(1)))
    # Chống đo rỗng: đủ ba slot ở cả hai bảng.
    assert len(han_theo_slot) == 3, han_theo_slot
    assert set(khung_theo_slot) == set(han_theo_slot)
    bot = {khung_theo_slot[s]: han for s, han in han_theo_slot.items()}
    assert bot == _han_chot_python()


def test_han_chot_KHOP_voi_bang_ba_khung_gio_cua_README():
    """README in hạn chót ở hai bảng; mỗi dòng slot phải mang đúng giờ của khung đó."""
    readme = (GOC_REPO / "scripts" / "tin-tuc" / "README.md").read_text(encoding="utf-8")
    js = (GOC_REPO / "scripts" / "tin-tuc" / "lib.mjs").read_text(encoding="utf-8")
    khoi = re.search(r"KHUNG_THEO_SLOT = Object\.freeze\(\{(.*?)\}\)", js, re.S)
    khung_theo_slot = dict(re.findall(r'"([a-z-]+)":\s*"([a-z_]+)"', khoi.group(1)))
    han = _han_chot_python()
    so_dong = 0
    for dong in readme.splitlines():
        m = re.match(r"\|\s*`([a-z-]+)`\s*\|(.*)", dong)
        if m is None or m.group(1) not in khung_theo_slot:
            continue
        so_dong += 1
        gio = re.findall(r"\b\d\d:\d\d\b", m.group(2))
        assert han[khung_theo_slot[m.group(1)]] in gio, dong
    assert so_dong >= 6, "README phải có hai bảng × ba slot"


# --- danh sách -------------------------------------------------------------------


def test_bang_moi_den_cu_ke_ca_ban_an_cursor_di_het_khong_trung(mod):
    for i in range(5):
        dung(THU_SAU - timedelta(days=i), an=(i == 2))
    thay: list[str] = []
    cursor = None
    while True:
        q = {"limit": 2} | ({"cursor": cursor} if cursor else {})
        r = mod.get("/api/admin/ban-tin", q)
        assert r.status_code == 200, r.content
        d = r.json()
        assert d["tong"] == 5
        thay += [b["ngay"] for b in d["items"]]
        cursor = d["cursor_ke_tiep"]
        if cursor is None:
            break
    assert thay == [(THU_SAU - timedelta(days=i)).isoformat() for i in range(5)]
    d = mod.get("/api/admin/ban-tin").json()
    an = {b["ngay"]: b["da_an"] for b in d["items"]}
    assert an[(THU_SAU - timedelta(days=2)).isoformat()] is True
    hang = d["items"][0]
    assert hang["duong_dan_cong_khai"] == f"/s/tin-tuc/{NGAY}"
    assert hang["khung_da_co"] == ["dem_qua"]


def test_cursor_rac_thi_400(mod):
    r = mod.get("/api/admin/ban-tin", {"cursor": "rac"})
    assert r.status_code == 400
    assert r.json()["code"] == "cursor_khong_hop_le"


def test_xem_ban_tin_da_an_van_doc_duoc_ngay_sai_dang_thi_404(mod):
    dung(khung=("truoc_phien_my", "dem_qua"), an=True)
    r = mod.get(URL)
    assert r.status_code == 200
    d = r.json()
    assert d["da_an"] is True
    # Thứ tự theo `KhungBanTin`, không theo thứ tự tạo.
    assert [k["khung"] for k in d["khung"]] == ["dem_qua", "truoc_phien_my"]
    assert mod.get("/api/admin/ban-tin/20261113").status_code == 404
    assert mod.get("/api/admin/ban-tin/2026-11-14").status_code == 404


# --- sửa tiêu đề ------------------------------------------------------------------


def test_sua_tieu_de_ghi_audit_truoc_sau_va_khong_doi_thi_khong_ghi(mod):
    bt = dung()
    r = mod.patch(URL, {"title": "  Bản tin mới  "}, content_type="application/json")
    assert r.status_code == 200, r.content
    assert r.json()["title"] == "Bản tin mới"
    nk = AuditLog.objects.get(action=AUDIT_SUA_BAN_TIN)
    assert (nk.target_type, nk.target_id) == (DICH_BAN_TIN, bt.pk)
    assert nk.meta["truoc"] == {"title": "Bản tin 13/11"}
    assert nk.meta["sau"] == {"title": "Bản tin mới"}
    assert nk.meta["ngay"] == NGAY
    mod.patch(URL, {"title": "Bản tin mới"}, content_type="application/json")
    assert AuditLog.objects.filter(action=AUDIT_SUA_BAN_TIN).count() == 1


def test_sua_tieu_de_chi_khoang_trang_thi_400(mod):
    dung()
    r = mod.patch(URL, {"title": "   "}, content_type="application/json")
    assert r.status_code == 400
    assert BanTin.objects.get(ngay=THU_SAU).title == "Bản tin 13/11"


# --- D2: sửa khung -----------------------------------------------------------------


def _sua_khung(mod, khung="dem_qua", **than):
    return mod.patch(f"{URL}/khung/{khung}", than, content_type="application/json")


def test_d2_script_bi_loc_va_audit_co_ban_truoc_sau(mod):
    bt = dung(khung=("dem_qua", "truoc_phien_vn"))
    moi = [{"label": "Dầu", "value": "80"}]
    r = _sua_khung(
        mod, body="<p>Mới <script>alert(1)</script><strong>đậm</strong></p>", figures=moi
    )
    assert r.status_code == 200, r.content
    k = BanTinKhung.objects.get(ban_tin=bt, khung="dem_qua")
    assert "<script" not in k.body and "alert" not in k.body
    assert "<strong>đậm</strong>" in k.body
    assert k.figures == moi
    nk = AuditLog.objects.get(action=AUDIT_SUA_KHUNG_BAN_TIN)
    assert nk.target_id == bt.pk
    assert nk.meta["khung"] == "dem_qua"
    assert nk.meta["truoc"] == {"body": "<p>Thân dem_qua</p>", "figures": FIGURES}
    assert nk.meta["sau"] == {"body": k.body, "figures": moi}
    # Khung kia nguyên vẹn; `cap_nhat_luc` không đổi khi sửa.
    kia = BanTinKhung.objects.get(ban_tin=bt, khung="truoc_phien_vn")
    assert kia.body == "<p>Thân truoc_phien_vn</p>"
    assert BanTin.objects.get(pk=bt.pk).cap_nhat_luc == bt.cap_nhat_luc
    # Thân trên cửa công khai là bản đã lọc.
    cong_khai = mod.get(f"/api/v1/ban-tin/{NGAY}").json()
    assert cong_khai["khung"][0]["body"] == k.body


def test_d2_than_chi_co_the_bi_chan_thi_400_khong_doi_khong_audit(mod):
    dung()
    r = _sua_khung(mod, body="<script>alert(1)</script>", figures=None)
    assert r.status_code == 400
    assert r.json()["code"] == "du_lieu_khong_hop_le"
    assert BanTinKhung.objects.get(khung="dem_qua").body == "<p>Thân dem_qua</p>"
    assert not AuditLog.objects.filter(action=AUDIT_SUA_KHUNG_BAN_TIN).exists()


@pytest.mark.parametrize(
    "figures",
    [
        [{"label": "x" * 25, "value": "1"}],  # quá trần ô — schema
        [{"label": "", "value": "1"}],  # ô rỗng — schema
        [{"label": f"o{i}", "value": "1"} for i in range(7)],  # quá 6 cặp — `kiem_figures`
        [{"label": "thiếu value"}],
    ],
    ids=["o_qua_dai", "o_rong", "qua_6_cap", "thieu_truong"],
)
def test_d2_figures_sai_dang_thi_400_va_khong_ghi(mod, figures):
    dung()
    r = _sua_khung(mod, body="<p>Thân mới</p>", figures=figures)
    assert r.status_code == 400, r.content
    k = BanTinKhung.objects.get(khung="dem_qua")
    assert (k.body, k.figures) == ("<p>Thân dem_qua</p>", FIGURES)
    assert not AuditLog.objects.filter(action=AUDIT_SUA_KHUNG_BAN_TIN).exists()


def test_d2_than_qua_tran_do_dai_cua_moc_thi_400(mod):
    from core.models.moc import DAI_BODY_MOC

    dung()
    r = _sua_khung(mod, body="a" * (DAI_BODY_MOC + 1))
    assert r.status_code == 400


def test_d2_khong_doi_gi_sau_loc_thi_khong_audit_va_figures_rong_la_bo_bang(mod):
    dung()
    r = _sua_khung(mod, body="<p>Thân dem_qua</p>", figures=FIGURES)
    assert r.status_code == 200
    assert not AuditLog.objects.filter(action=AUDIT_SUA_KHUNG_BAN_TIN).exists()
    r = _sua_khung(mod, body="<p>Thân dem_qua</p>", figures=[])
    assert r.status_code == 200
    assert BanTinKhung.objects.get(khung="dem_qua").figures is None
    assert AuditLog.objects.filter(action=AUDIT_SUA_KHUNG_BAN_TIN).count() == 1


def test_d2_khung_chua_dang_hay_ten_la_thi_404(mod):
    dung()
    assert _sua_khung(mod, "truoc_phien_my", body="<p>x</p>").status_code == 404
    assert _sua_khung(mod, "khung_la", body="<p>x</p>").status_code == 404


# --- D3: ẩn / hiện -----------------------------------------------------------------


def test_d3_an_thi_cong_khai_404_va_roi_khoi_danh_sach_hien_lai_thi_quay_ve(mod):
    bt = dung()
    cong_khai = f"/api/v1/ban-tin/{NGAY}"

    def ngay_trong_danh_sach():
        return [b["ngay"] for b in mod.get("/api/v1/ban-tin").json()["items"]]

    assert mod.get(cong_khai).status_code == 200
    assert NGAY in ngay_trong_danh_sach()

    r = mod.post(f"{URL}/an")
    assert r.status_code == 200
    assert r.json()["da_an"] is True
    assert mod.get(cong_khai).status_code == 404
    assert NGAY not in ngay_trong_danh_sach()
    nk = AuditLog.objects.get(action=AUDIT_AN_BAN_TIN)
    assert nk.target_id == bt.pk
    assert nk.meta["truoc"] == {"hidden_at": None}
    assert nk.meta["sau"]["hidden_at"] is not None
    # Ẩn lần hai: không đổi, không thêm dòng nhật ký.
    mod.post(f"{URL}/an")
    assert AuditLog.objects.filter(action=AUDIT_AN_BAN_TIN).count() == 1
    # Khu quản trị vẫn thấy nó.
    assert mod.get(URL).status_code == 200

    r = mod.post(f"{URL}/hien")
    assert r.status_code == 200
    assert r.json()["da_an"] is False
    assert mod.get(cong_khai).status_code == 200
    assert NGAY in ngay_trong_danh_sach()
    nk = AuditLog.objects.get(action=AUDIT_HIEN_BAN_TIN)
    assert nk.meta["sau"] == {"hidden_at": None}


def test_d3_an_ban_tin_khong_co_thi_404(mod):
    assert mod.post("/api/admin/ban-tin/2026-11-14/an").status_code == 404
    assert mod.post("/api/admin/ban-tin/rac/hien").status_code == 404


# --- D4: xoá khung -----------------------------------------------------------------


def test_d4_xoa_khung_bien_khoi_cong_khai_khung_khac_con_nguyen(mod):
    bt = dung(khung=("dem_qua", "truoc_phien_vn", "truoc_phien_my"))
    truoc = {
        k["khung"]: k for k in mod.get(f"/api/v1/ban-tin/{NGAY}").json()["khung"]
    }
    r = mod.delete(f"{URL}/khung/truoc_phien_vn")
    assert r.status_code == 200, r.content
    sau = {k["khung"]: k for k in mod.get(f"/api/v1/ban-tin/{NGAY}").json()["khung"]}
    assert set(sau) == {"dem_qua", "truoc_phien_my"}
    assert sau["dem_qua"] == truoc["dem_qua"]
    assert sau["truoc_phien_my"] == truoc["truoc_phien_my"]
    nk = AuditLog.objects.get(action=AUDIT_XOA_KHUNG_BAN_TIN)
    assert nk.target_id == bt.pk
    assert nk.meta["khung"] == "truoc_phien_vn"
    assert nk.meta["truoc"]["body"] == "<p>Thân truoc_phien_vn</p>"
    assert nk.meta["sau"] is None
    # Không phải khung mới nhất ⇒ `cap_nhat_luc` giữ nguyên.
    assert BanTin.objects.get(pk=bt.pk).cap_nhat_luc == gio_vn(THU_SAU, 8, 10)


def test_d4_xoa_khung_moi_nhat_thi_cap_nhat_luc_lui_ve_khung_moi_nhat_con_lai(mod):
    bt = dung(khung=("dem_qua", "truoc_phien_vn"))
    assert bt.cap_nhat_luc == gio_vn(THU_SAU, 7, 10)
    assert mod.delete(f"{URL}/khung/truoc_phien_vn").status_code == 200
    assert BanTin.objects.get(pk=bt.pk).cap_nhat_luc == gio_vn(THU_SAU, 6, 10)


def test_d4_xoa_khung_cuoi_cung_thi_409_va_khong_xoa(mod):
    dung(khung=("dem_qua",))
    r = mod.delete(f"{URL}/khung/dem_qua")
    assert r.status_code == 409
    assert r.json()["code"] == "khung_cuoi_cung"
    assert BanTinKhung.objects.filter(khung="dem_qua").exists()
    assert not AuditLog.objects.filter(action=AUDIT_XOA_KHUNG_BAN_TIN).exists()


def test_d4_xoa_khung_khong_co_thi_404(mod):
    dung(khung=("dem_qua", "truoc_phien_vn"))
    assert mod.delete(f"{URL}/khung/truoc_phien_my").status_code == 404
    assert BanTinKhung.objects.count() == 2
