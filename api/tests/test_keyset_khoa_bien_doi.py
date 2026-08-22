"""Ghim hành vi của keyset khi khoá sort BIẾN ĐỔI giữa hai trang — W1, lượt vá 2.

**Đây là test TÀI LIỆU HOÁ một đánh đổi ĐÃ CHỐT, không phải test bảo vệ một tính chất
mong muốn.** Nó khẳng định rằng `?sort=nhieu_diem` *có* bỏ sót và *có* trả trùng khi
điểm đổi giữa hai lần xin trang. Phiên chính chốt GIỮ keyset (plan con 1d lượt vá 2 §0):
`OFFSET` không chữa được và còn thêm bệnh riêng, snapshot là một hệ thống khác, còn hậu
quả ở đây là một mạch lệch chỗ trong một lần cuộn — không mất dữ liệu, không sai vĩnh
viễn.

Vì sao vẫn phải có test: `api/api/phan_trang.py` trước 2026-08-22 khẳng định tuyệt đối
*"hai ca đó không xảy ra"*, và plan con 1d làm câu ấy sai mà không có gì đỏ. Một lời
khẳng định trong docstring không tự kiểm được; hai bài dưới đây thì có.

**Ngày ai đó đổi cơ chế phân trang cho sort này** (snapshot, `OFFSET`, rank đóng băng
theo phút, …) thì hai bài này ĐỎ. Đó là hành vi đúng của chúng: đọc docstring, xác nhận
đánh đổi đã được thay bằng một quyết định mới, rồi XOÁ chúng — đừng sửa số cho khớp.
"""

import pytest

from core.ghi import tao_mach
from tests.conftest import lay

# Mượn helper của `test_api_feed_top.py` thay vì chép lại: `dat_diem` đi qua ĐÚNG đường
# ghi denormalize (`cap_nhat_dem_mach`), và một bản chép ở đây sẽ là bản quên gọi nó vào
# ngày `_diem_bai_goc` đổi luật — lúc đó hai file ghim hai hành vi khác nhau.
from tests.test_api_feed_top import TOP, dat_diem, ids, khi_vn

pytestmark = pytest.mark.django_db


@pytest.fixture
def bon_mach(sub, tac_gia):
    """4 mạch, điểm 40/30/20/10 — thứ tự điểm phân biệt hẳn, không có hoà.

    Không hoà là điều kiện để hai bài dưới đây chỉ đo đúng một chuyện (khoá đổi giá trị),
    chứ không lẫn với ca "cặp `(diem, id)` phá hoà" mà `test_api_feed_top.py` đã đo.
    """
    ra = {}
    for i, diem in enumerate((40, 30, 20, 10)):
        m, _ = tao_mach(
            sub=sub,
            author=tac_gia,
            title=f"Mạch {diem}",
            body="Mốc 1.",
            _created_at_seed=khi_vn(-30 + i),
        )
        ra[diem] = dat_diem(m, diem)
    return ra


def _trang_dau(client, bon_mach):
    """Trang 1 (limit=2) = hai mạch điểm cao nhất, kèm cursor neo vào mạch 30 điểm."""
    d = lay(client, f"{TOP}&limit=2")
    assert ids(d) == [bon_mach[40].pk, bon_mach[30].pk]
    assert d["cursor_ke_tiep"] is not None
    return d["cursor_ke_tiep"]


def test_ca_SOT_diem_tang_vuot_moc_cursor_thi_mach_bien_mat_han(client, bon_mach):
    """Vote LÊN giữa hai trang ⇒ mạch không xuất hiện ở trang nào cả.

    Mạch 20 điểm lẽ ra ở trang 2. Nó được vote lên 35 — tức vượt mốc cursor (30) — nên
    keyset xếp nó vào phần "đã trả rồi" và cắt bỏ. Nó không có ở trang 1 (lúc ấy còn 20
    điểm) và cũng không có ở trang 2.
    """
    cursor = _trang_dau(client, bon_mach)
    dat_diem(bon_mach[20], 35)

    trang_2 = ids(lay(client, f"{TOP}&limit=2&cursor={cursor}"))

    assert bon_mach[20].pk not in trang_2, (
        "nếu bài này đỏ thì cơ chế phân trang đã đổi — đọc docstring đầu file"
    )
    assert trang_2 == [bon_mach[10].pk]
    da_thay = [bon_mach[40].pk, bon_mach[30].pk] + trang_2
    assert bon_mach[20].pk not in da_thay
    assert len(da_thay) == 3, "một mạch bị sót hẳn khỏi lượt cuộn"


def test_ca_TRUNG_diem_tut_duoi_moc_cursor_thi_mach_hien_lan_thu_hai(client, bon_mach):
    """Vote XUỐNG giữa hai trang ⇒ mạch đã trả ở trang 1 hiện lại ở trang 2.

    Mạch 40 điểm đã nằm ở trang 1. Nó tụt xuống 5 điểm — dưới mốc cursor (30) — nên nó
    rơi vào phần còn lại và được trả thêm một lần nữa.
    """
    cursor = _trang_dau(client, bon_mach)
    dat_diem(bon_mach[40], 5)

    trang_2 = ids(lay(client, f"{TOP}&limit=50&cursor={cursor}"))

    assert bon_mach[40].pk in trang_2, (
        "nếu bài này đỏ thì cơ chế phân trang đã đổi — đọc docstring đầu file"
    )
    da_thay = [bon_mach[40].pk, bon_mach[30].pk] + trang_2
    assert len(da_thay) != len(set(da_thay)), "mạch 40 phải xuất hiện hai lần"
    assert da_thay.count(bon_mach[40].pk) == 2


def test_khoa_BAT_BIEN_thi_khong_dinh_hai_ca_tren(client, bon_mach):
    """Vế đối chứng: cùng dữ liệu, sort theo `created_at` thì điểm đổi không ảnh hưởng gì.

    Không có vế này thì hai bài trên cũng "xanh" với một cài đặt phân trang hỏng toàn
    tập — chúng chỉ khẳng định *có lỗi*, nên phải có một chỗ khẳng định lỗi ấy đến từ
    tính BIẾN ĐỔI của khoá chứ không từ keyset nói chung.
    """
    d = lay(client, "/api/v1/feeds/moi?limit=2")
    trang_1 = ids(d)
    cursor = d["cursor_ke_tiep"]
    assert cursor is not None

    dat_diem(bon_mach[20], 35)
    dat_diem(bon_mach[40], 5)

    het = trang_1 + ids(lay(client, f"/api/v1/feeds/moi?limit=50&cursor={cursor}"))
    assert len(het) == len(set(het)) == 4
    assert set(het) == {m.pk for m in bon_mach.values()}
