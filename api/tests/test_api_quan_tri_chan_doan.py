"""`GET /api/admin/chan-doan/tim-kiem` — S7 của plan 2026-08-30.

Màn hình này là câu trả lời cho vế *"lệch IM LẶNG"* của `P-20260827-2`. Bộ đo vì thế
không hỏi "endpoint có trả 200 không" mà hỏi **ba** câu:

1. hai con số có đúng của hai bên không (Meilisearch vs Postgres);
2. **lệch có được nói to không** — một màn hình đếm đúng mà không kết luận gì là một màn
   hình không ai đọc;
3. "không đọc được" có phân biệt được với "rỗng" không — gộp hai trạng thái ấy là để một
   khoá thiếu quyền trông y hệt một index chưa dựng, tức đúng cái hỏng cần thấy nhất bị
   hiển thị như trạng thái bình thường nhất.
"""

import pytest

from core.ghi import dat_an_mach, tao_mach
from core.tim_kiem import TEN_INDEX, TEN_INDEX_BINH_LUAN

from ._meili_gia import gan
from ._quan_tri import dang_nhap, dung_mod
from .conftest import viet

pytestmark = pytest.mark.django_db(transaction=True)

URL = "/api/admin/chan-doan/tim-kiem"


@pytest.fixture
def meili(monkeypatch, settings):
    return gan(monkeypatch, settings)


@pytest.fixture
def mod_client():
    return dang_nhap(dung_mod())


@pytest.fixture
def du_lieu(sub, nguoi_a, nguoi_b):
    m, _ = tao_mach(sub=sub, author=nguoi_a, title="Nhật ký HPG", body="<p>Thân.</p>")
    cs = [viet(m, nguoi_b, f"Câu {i}.") for i in range(2)]
    return m, cs


def _doc(client) -> dict:
    r = client.get(URL)
    assert r.status_code == 200, r.content
    return r.json()


def _theo_ten(du: dict) -> dict:
    return {h["ten"]: h for h in du["cac_index"]}


def test_khop_thi_khong_bao_lech(meili, mod_client, du_lieu):
    du = _doc(mod_client)
    assert du["meili_song"] is True
    assert du["co_lech"] is False
    theo = _theo_ten(du)
    assert theo[TEN_INDEX]["so_tai_lieu"] == 1
    assert theo[TEN_INDEX]["so_hang_postgres"] == 1
    assert theo[TEN_INDEX_BINH_LUAN]["so_tai_lieu"] == 2
    assert theo[TEN_INDEX_BINH_LUAN]["so_hang_postgres"] == 2
    assert all(h["ghi_chu"] == "" for h in du["cac_index"])


def test_index_thua_tai_lieu_thi_NOI_TO(meili, mod_client, du_lieu):
    """Chiều "thừa" — đúng chiều mà `P-20260827-2` mô tả."""
    meili.dat(TEN_INDEX, [{"id": 999_001, "hien": True}])
    du = _doc(mod_client)
    theo = _theo_ten(du)
    assert du["co_lech"] is True
    assert theo[TEN_INDEX]["lech"] is True
    assert theo[TEN_INDEX]["so_tai_lieu"] == 2
    assert theo[TEN_INDEX]["so_hang_postgres"] == 1
    assert "reindex_tim_kiem" in theo[TEN_INDEX]["ghi_chu"]


def test_index_thieu_tai_lieu_thi_cung_NOI_TO(meili, mod_client, du_lieu, nguoi_a):
    """Chiều "thiếu": đường ghi hỏng lúc mod gỡ ẩn ⇒ index nghèo hơn Postgres.

    Đo cả hai chiều vì một màn hình chỉ biết `so_tai_lieu > so_hang` sẽ im lặng đúng ở ca
    tệ hơn: nội dung hợp lệ **không tìm được**, và không ai kêu vì không ai biết nó có.
    """
    m, _ = du_lieu
    dat_an_mach(mach=m, boi=nguoi_a, an=True, ly_do="thử")
    meili.chan.add(TEN_INDEX)
    dat_an_mach(mach=m, boi=nguoi_a, an=False)
    meili.chan.clear()

    theo = _theo_ten(_doc(mod_client))
    assert theo[TEN_INDEX]["so_tai_lieu"] == 0
    assert theo[TEN_INDEX]["so_hang_postgres"] == 1
    assert theo[TEN_INDEX]["lech"] is True


def test_khoa_thieu_quyen_ra_null_chu_khong_ra_0(meili, mod_client, du_lieu):
    """`null` ≠ `0`. Đây là ca `MEILI_KEY` cũ chỉ khai `indexes: ["mach"]`.

    Nếu nó hiện `0` thì màn hình nói "index bình luận rỗng" — một câu **sai** dẫn thẳng
    tới hành động sai (chạy `reindex`, thấy nó cũng lỗi, không hiểu vì sao). `null` cộng
    một câu chỉ đúng chỗ cần sửa mới là thứ dùng được lúc 2 giờ sáng.
    """
    meili.chan.add(TEN_INDEX_BINH_LUAN)
    theo = _theo_ten(_doc(mod_client))
    assert theo[TEN_INDEX_BINH_LUAN]["so_tai_lieu"] is None
    assert theo[TEN_INDEX_BINH_LUAN]["lech"] is True
    assert "MEILI_KEY" in theo[TEN_INDEX_BINH_LUAN]["ghi_chu"]
    # Index kia vẫn đọc được — một khoá thiếu quyền một phần không được làm mù cả trang.
    assert theo[TEN_INDEX]["so_tai_lieu"] == 1


def test_index_CHUA_DUNG_ra_null_va_ghi_chu_reindex_chu_khong_ghi_chu_khoa(
    meili, mod_client, du_lieu
):
    """404 (index chưa dựng) ≠ 403 (khoá thiếu quyền) — hai lời khuyên khác nhau.

    Gộp hai ca là dẫn người trực đi sinh lại khoá cho một index thật ra chỉ chưa được
    dựng. `_meili_gia` trả 404 khi index không có trong kho; ca 403 (`chan`) đã có bài
    riêng (`test_khoa_thieu_quyen_ra_null...`) và phải giữ nguyên lời khuyên khoá.
    """
    meili.kho.pop(TEN_INDEX_BINH_LUAN, None)
    theo = _theo_ten(_doc(mod_client))
    assert theo[TEN_INDEX_BINH_LUAN]["so_tai_lieu"] is None
    assert theo[TEN_INDEX_BINH_LUAN]["lech"] is True
    ghi_chu = theo[TEN_INDEX_BINH_LUAN]["ghi_chu"]
    assert "reindex_tim_kiem" in ghi_chu, ghi_chu
    assert "MEILI_KEY" not in ghi_chu, ghi_chu
    # Index kia vẫn dựng, vẫn đọc được.
    assert theo[TEN_INDEX]["so_tai_lieu"] == 1


def test_meili_chua_cau_hinh_thi_bao_khong_song_chu_khong_500(settings, mod_client):
    """Clone sạch: `MEILI_URL` rỗng. Trang chẩn đoán phải **chẩn đoán được** trạng thái đó."""
    settings.MEILI_URL = ""
    settings.MEILI_KEY = ""
    du = _doc(mod_client)
    assert du["meili_song"] is False
    assert du["co_lech"] is True
    assert all(h["so_tai_lieu"] is None for h in du["cac_index"])


def test_dem_dung_luat_che_cua_tung_index(meili, mod_client, sub, nguoi_a, nguoi_b):
    """Con số Postgres phải là số **CÔNG KHAI**, không phải `COUNT(*)`.

    Đếm cả hàng đã ẩn là màn hình báo lệch vĩnh viễn trên một cụm đang khớp — và một cảnh
    báo sai là cách nhanh nhất để mọi cảnh báo sau bị bỏ qua.
    """
    hien, _ = tao_mach(sub=sub, author=nguoi_a, title="Hiện", body="<p>x</p>")
    an, _ = tao_mach(sub=sub, author=nguoi_a, title="Ẩn", body="<p>x</p>")
    viet(hien, nguoi_b, "Câu của mạch hiện.")
    viet(an, nguoi_b, "Câu của mạch sắp bị ẩn.")
    dat_an_mach(mach=an, boi=nguoi_a, an=True, ly_do="thử")

    theo = _theo_ten(_doc(mod_client))
    assert theo[TEN_INDEX]["so_hang_postgres"] == 1
    assert theo[TEN_INDEX_BINH_LUAN]["so_hang_postgres"] == 1
    assert theo[TEN_INDEX]["lech"] is False
    assert theo[TEN_INDEX_BINH_LUAN]["lech"] is False


def test_khong_cache(meili, mod_client, du_lieu):
    assert mod_client.get(URL)["Cache-Control"] == "no-store"
