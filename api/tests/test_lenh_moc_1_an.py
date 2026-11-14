"""Mốc 1 bị MOD ẩn ⇒ `lenh = null` ở mọi cửa trả thẻ mạch / trang mạch (việc 25, user chốt
2026-11-14: "mod ẩn mốc 1 thì ẩn dải lệnh theo"). Bia mộ do tác giả TỰ xoá thì **GIỮ** lệnh
(user: "Giữ lệnh").

Luật nằm ở `api/trinh_bay.py::mach_tom_tat_ra` (tham số `moc_1_bi_mod_an`) và CHỈ đọc
`Moc.hidden_at` — cố ý HẸP hơn `doc_duoc` (thứ quyết `xem_truoc`, gồm cả bia mộ):

- mod ẩn mốc 1 ⇒ nội dung bài đầu đã bị gỡ khỏi cửa công khai, JSON vẫn trả lệnh là một cửa thứ
  hai đọc được thứ vừa bị gỡ;
- tác giả tự xoá mốc 1 ⇒ lệnh VẪN trả: lệnh là biên lai, và `DELETE /mocs/{id}` không audit,
  không cửa sổ — coi bia mộ như ẩn là cho tác giả một nút giấu lệnh thua không để dấu vết.

Năm chỗ dựng thẻ đều được canh: `GET /machs/{id}` (`machs.py`), `GET /feeds/moi` (`feeds.py`),
`GET /users/{username}` (`users.py`), `GET /users/{username}/machs` (`ho_so.py`), `GET /tim-kiem`
(`tim_kiem.py`, Meilisearch thay bằng bản giả — cùng lối `tests/test_tim_kiem.py`).

Response của `GET /machs/{id}` KHÔNG phụ thuộc người xem (cache được, PLAN 8.4) — chủ mạch cũng
nhận `lenh = null` khi mốc 1 bị mod ẩn.
"""

from decimal import Decimal

import pytest

from core.ghi import dat_an_moc, tao_mach, xoa_moc
from core.lenh import Lenh
from core.models.dien_dan import Mach
from core.tim_kiem import TEN_INDEX

from api import tim_kiem as api_tim_kiem
from tests.conftest import dung_user, lay

pytestmark = pytest.mark.django_db

TIEU_DE = "Mua HPG tại 27.5"


@pytest.fixture
def mach_co_lenh(sub):
    tac_gia = dung_user("chu_lenh", "Chủ Lệnh")
    m, m1 = tao_mach(
        sub=sub,
        author=tac_gia,
        title=TIEU_DE,
        body="Vào lệnh.",
        loai_mach=Mach.LoaiMach.NHAT_KY,
        lenh=Lenh("mua", "hpg", Decimal("27.5"), sl=Decimal("26"), tp=Decimal("30")),
    )
    return m, m1, tac_gia


@pytest.fixture
def gia_meili(monkeypatch):
    """`tim_tron` giả: trả đúng danh sách mạch được nạp (cùng lối `test_tim_kiem.py`)."""
    cap: list = []

    def _tim_tron(*, q, sub, sap_theo_moi, offset, limit):
        return cap[offset : offset + limit], len(cap)

    monkeypatch.setattr(api_tim_kiem, "tim_tron", _tim_tron)

    def dat(*ids):
        cap[:] = [(TEN_INDEX, i) for i in ids]

    return dat


def _mot(items: list[dict], mach_id: int, cua: str) -> dict:
    the = [x for x in items if x["id"] == mach_id]
    assert len(the) == 1, f"{cua}: mạch phải có mặt (đo rỗng)"
    return the[0]


def _lenh_moi_cua(client, m, tac_gia, gia_meili) -> dict[str, dict | None]:
    """`lenh` của cùng một mạch ở cả năm cửa."""
    gia_meili(m.pk)
    tim = lay(client, "/api/v1/tim-kiem?q=HPG")["items"]
    the_tim = [x for x in tim if x.get("mach") and x["mach"]["id"] == m.pk]
    assert len(the_tim) == 1, f"tìm kiếm: mạch phải có mặt (đo rỗng) — {tim}"
    return {
        "chi_tiet": lay(client, f"/api/v1/machs/{m.pk}")["lenh"],
        "feed": _mot(lay(client, "/api/v1/feeds/moi?limit=50")["items"], m.pk, "feed")["lenh"],
        "ho_so": _mot(
            lay(client, f"/api/v1/users/{tac_gia.username}")["machs"], m.pk, "hồ sơ"
        )["lenh"],
        "mach_cua_user": _mot(
            lay(client, f"/api/v1/users/{tac_gia.username}/machs")["items"], m.pk, "mạch của user"
        )["lenh"],
        "tim_kiem": the_tim[0]["mach"]["lenh"],
    }


def test_moc_1_binh_thuong_thi_lenh_co_o_ca_nam_cua(client, mach_co_lenh, gia_meili):
    m, _m1, tac_gia = mach_co_lenh
    ra = _lenh_moi_cua(client, m, tac_gia, gia_meili)
    assert {cua: (l or {}).get("ma") for cua, l in ra.items()} == dict.fromkeys(ra, "HPG")


def test_mod_an_moc_1_thi_lenh_null_o_ca_nam_cua(client, mach_co_lenh, gia_meili):
    m, m1, tac_gia = mach_co_lenh
    mod = dung_user("mod_an", "Mod")
    assert dat_an_moc(moc=m1, boi=mod, an=True, ly_do="test")
    ra = _lenh_moi_cua(client, m, tac_gia, gia_meili)
    assert ra == dict.fromkeys(ra), ra
    assert lay(client, f"/api/v1/machs/{m.pk}")["mocs"][0]["trang_thai"] == "da_an"
    # Chủ mạch xem cũng không thấy: response không phụ thuộc người xem.
    client.force_login(tac_gia)
    assert lay(client, f"/api/v1/machs/{m.pk}")["lenh"] is None
    # Gỡ ẩn ⇒ lệnh trở lại (luật là của TRẠNG THÁI mốc 1, không xoá dữ liệu lệnh).
    assert dat_an_moc(moc=m1, boi=mod, an=False)
    assert lay(client, f"/api/v1/machs/{m.pk}")["lenh"]["ma"] == "HPG"


def test_bia_mo_moc_1_GIU_lenh_o_ca_nam_cua(client, mach_co_lenh, gia_meili):
    """User: "Giữ lệnh". Xoá mốc 1 không được thành nút giấu lệnh thua."""
    m, m1, tac_gia = mach_co_lenh
    xoa_moc(moc=m1)
    assert lay(client, f"/api/v1/machs/{m.pk}")["mocs"][0]["trang_thai"] == "da_xoa"
    ra = _lenh_moi_cua(client, m, tac_gia, gia_meili)
    assert {cua: (l or {}).get("ma") for cua, l in ra.items()} == dict.fromkeys(ra, "HPG")


def test_moc_1_vua_bi_an_vua_bi_xoa_thi_theo_hidden_at_null(client, mach_co_lenh, gia_meili):
    m, m1, tac_gia = mach_co_lenh
    xoa_moc(moc=m1)
    m1.refresh_from_db()
    assert dat_an_moc(moc=m1, boi=dung_user("mod_an2", "Mod"), an=True, ly_do="test")
    ra = _lenh_moi_cua(client, m, tac_gia, gia_meili)
    assert ra == dict.fromkeys(ra), ra
