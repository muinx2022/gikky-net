"""`MocOut.reactions` — con số để wireframe 9.2 vẽ được hàng `📈 12 · 🔥 9`.

Nợ `REACTION-CHUA-CO-UI`: API đặt/rút reaction và `my_reactions` đã sống từ Phase 2, nhưng
`GET /machs/{id}` **không trả con số đếm nào**, nên giao diện không có gì để vẽ. Trường
này lấp đúng chỗ đó.

**Nó KHÔNG per-user** — ai xem cũng thấy cùng con số — nên nó nằm được trên cửa ISR (điều
kiện của PLAN 8.4). Phiếu của chính người xem vẫn đi đường riêng
(`GET /machs/{id}/me::my_reactions`, `no-store`, ở trình duyệt).
"""

import pytest

from core.ghi import dat_an_moc, dat_reaction
from core.models import Reaction

from tests._quan_tri import dang_nhap, dung_du_lieu, dung_mod, dung_thuong

pytestmark = pytest.mark.django_db


BO_KHOA = set(Reaction.Emoji.values)


def _mocs(client, mach_id):
    r = client.get(f"/api/v1/machs/{mach_id}")
    assert r.status_code == 200, r.content
    return {m["seq"]: m for m in r.json()["mocs"]}


def test_du_5_khoa_ke_ca_khoa_bang_0(client, mach):
    """UI vẽ nguyên bộ 5 nút; một khoá VẮNG MẶT là một icon nhấp nháy theo lượt bấm.

    Cùng hợp đồng với `ReactionOut.dem` của đường ghi — hai cửa nói về cùng một thứ thì
    phải nói cùng một hình dạng, nếu không client cần hai nhánh render.
    """
    dem = _mocs(client, mach.pk)[1]["reactions"]
    assert set(dem) == BO_KHOA
    assert set(dem.values()) == {0}


def test_dem_dung_sau_khi_co_nguoi_react(client, mach, tac_gia, nguoi_khac):
    moc1 = mach.mocs.get(seq=1)
    dat_reaction(user=tac_gia, moc=moc1, emoji="lua")
    dat_reaction(user=nguoi_khac, moc=moc1, emoji="lua")

    dem = _mocs(client, mach.pk)[1]["reactions"]
    assert dem["lua"] == 2
    assert dem["len"] == 0
    # Đổi reaction là UPDATE, không phải thêm hàng (`UNIQUE (user, moc)`).
    dat_reaction(user=nguoi_khac, moc=moc1, emoji="bang")
    dem = _mocs(client, mach.pk)[1]["reactions"]
    assert dem["lua"] == 1 and dem["bang"] == 1


def test_dem_KHONG_lan_giua_hai_moc(client, mach, tac_gia, nguoi_khac):
    """Phép gom theo lô dễ sai đúng ở chỗ này: một `dict` khoá nhầm là mốc 2 mượn số của
    mốc 1, và nó trông như dữ liệu bẩn chứ không như lỗi code."""
    from core.ghi import them_moc

    moc2 = them_moc(mach=mach, author=tac_gia, body="mốc hai", occurred_at=None)
    dat_reaction(user=tac_gia, moc=mach.mocs.get(seq=1), emoji="len")
    dat_reaction(user=nguoi_khac, moc=moc2, emoji="trung")

    m = _mocs(client, mach.pk)
    assert m[1]["reactions"]["len"] == 1 and m[1]["reactions"]["trung"] == 0
    assert m[2]["reactions"]["trung"] == 1 and m[2]["reactions"]["len"] == 0


def test_bia_mo_KHONG_pho_so_reaction(client, mach, tac_gia, nguoi_khac):
    """Hàng `Reaction` không bị xoá cùng nội dung, nhưng phô "🔥 9" trên một thẻ không còn
    chữ nào là đúng ca mà `score` đã bị zero hoá để tránh (`trinh_bay.py::moc_ra`)."""
    from core.ghi import them_moc

    moc2 = them_moc(mach=mach, author=tac_gia, body="mốc hai", occurred_at=None)
    dat_reaction(user=nguoi_khac, moc=moc2, emoji="lua")
    assert _mocs(client, mach.pk)[2]["reactions"]["lua"] == 1

    dat_an_moc(moc=moc2, boi=dung_mod("mod_reaction"), an=True, ly_do="thử")
    dem = _mocs(client, mach.pk)[2]["reactions"]
    assert set(dem) == BO_KHOA, "bia mộ vẫn phải có ĐỦ 5 khoá — UI vẽ nguyên bộ"
    assert set(dem.values()) == {0}
    # Hàng trong DB thì KHÔNG bị xoá — phép che nằm ở tầng trình bày, không ở đường ghi.
    assert Reaction.objects.filter(moc=moc2).count() == 1


def test_moc_vua_tao_tra_ve_du_5_khoa_bang_0():
    """Đường GHI trả cùng hình dạng với đường ĐỌC — nếu không, UI cần hai nhánh render cho
    cùng một thẻ mốc, và nhánh ít chạy hơn sẽ là nhánh sai."""
    dl = dung_du_lieu("_rc")
    chu = dang_nhap(dl["tac_gia"])
    r = chu.post(
        f"/api/v1/machs/{dl['mach'].pk}/mocs",
        {"body": "mốc mới toanh"},
        content_type="application/json",
    )
    assert r.status_code == 201, r.content
    assert set(r.json()["reactions"]) == BO_KHOA
    assert set(r.json()["reactions"].values()) == {0}


def test_nguoi_la_KHONG_thay_reaction_cua_rieng_ai(client, mach, tac_gia):
    """`reactions` là con số CHUNG. Nó không được mang dấu vết của một người cụ thể —
    trường đó nằm trên cửa `no-store` (`/machs/{id}/me::my_reactions`), không ở đây.

    Quét **mọi chuỗi** trong response chứ không chỉ một trường: một `username` lọt vào bất
    kỳ đâu của cửa ISR là dữ liệu người này được cache rồi phục vụ người kia.
    """
    dung_thuong("nguoi_react_bi_mat")
    from core.models import User

    u = User.objects.get(username="nguoi_react_bi_mat")
    dat_reaction(user=u, moc=mach.mocs.get(seq=1), emoji="lua")

    r = client.get(f"/api/v1/machs/{mach.pk}")
    assert r.status_code == 200
    assert "nguoi_react_bi_mat" not in r.content.decode("utf8")
    assert _mocs(client, mach.pk)[1]["reactions"]["lua"] == 1
