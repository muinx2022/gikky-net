"""`?sort=nhieu_diem` + `?khoang=` trên hai feed — plan con 1d §2.1, tiêu chí A2–A4.

Ba thứ ở đây phải đo được **độc lập với nhau**, vì mỗi cái hỏng một kiểu riêng:

- **A2 thứ tự.** Bài đo phải đỏ với mutant "sắp theo `created_at`". Điều kiện để nó đỏ
  là dữ liệu có thứ tự điểm **khác** thứ tự thời gian — trùng nhau thì bài đo xanh với cả
  hai cài đặt và nó chỉ chứng minh rằng feed trả về đủ hàng.
- **A3 khoảng.** Ranh giới là nửa đêm giờ VN (PLAN mục 1), nên dữ liệu phải có hàng nằm
  đúng hai bên mốc — kể cả ca "hôm qua 23:59 giờ VN", ca mà một cửa sổ trượt 24 giờ sẽ
  cho kết quả khác.
- **A4 cursor.** Keyset trên `(diem, id)`; điểm TRÙNG NHAU là ca duy nhất phân biệt được
  cặp khoá với khoá đơn.
"""

from datetime import datetime, time, timedelta

import pytest

from core.ghi import cap_nhat_dem_mach, tao_mach
from core.models import Mach, Moc
from core.thoi_gian import TZ_VN, ngay_vn
from tests.conftest import lay

pytestmark = pytest.mark.django_db

TOP = "/api/v1/feeds/moi?sort=nhieu_diem"


def ids(d) -> list[int]:
    return [m["id"] for m in d["items"]]


def dat_diem(mach: Mach, diem: int) -> Mach:
    """Đặt điểm cho mốc 1 rồi chạy đúng đường ghi denormalize.

    Ghi thẳng `Moc.score` (không dựng hàng `Vote`) là cùng lựa chọn với `dat_phieu` của
    `conftest`: bài đo này đo *feed sắp theo cái gì*, không đo *phiếu được đếm thế nào* —
    phần đó đã có `test_diem_bai_goc.py`.
    """
    Moc.objects.filter(mach=mach, seq=1).update(score=diem)
    return cap_nhat_dem_mach(mach)


def khi_vn(ngay_lech: int, gio: time = time(12, 0)) -> datetime:
    """Thời điểm tuyệt đối của `hôm nay + ngay_lech` lúc `gio`, **giờ VN**."""
    return datetime.combine(ngay_vn() + timedelta(days=ngay_lech), gio, tzinfo=TZ_VN)


@pytest.fixture
def ba_mach(sub, tac_gia):
    """Ba mạch có thứ tự điểm **ngược hẳn** thứ tự thời gian.

    Ngược hẳn chứ không chỉ khác: với ba phần tử, một hoán vị "khác một chỗ" vẫn có thể
    trùng với thứ tự thời gian ở hai vị trí đầu, và một bài đo chỉ nhìn phần tử đầu sẽ
    không phân biệt được. Ngược hẳn thì mọi vị trí đều phân biệt.
    """
    ra = {}
    for i, (ten, diem) in enumerate([("cu", 30), ("giua", 12), ("moi", -2)]):
        m, _ = tao_mach(
            sub=sub,
            author=tac_gia,
            title=f"Mạch {ten}",
            body="Mốc 1.",
            _created_at_seed=khi_vn(-40 + i * 15),
        )
        ra[ten] = dat_diem(m, diem)
    return ra


# --- A2: thứ tự -------------------------------------------------------------


def test_top_sap_theo_diem_giam_dan(client, ba_mach):
    assert ids(lay(client, TOP)) == [
        ba_mach["cu"].pk,
        ba_mach["giua"].pk,
        ba_mach["moi"].pk,
    ]


def test_top_KHAC_thu_tu_cua_feed_moi(client, ba_mach):
    """A2 — bài đo giết mutant "sort=nhieu_diem vẫn sắp theo created_at".

    Hai danh sách phải khác nhau; nếu ai đó cài Top bằng khoá thời gian thì chúng bằng
    nhau và dòng dưới đỏ.
    """
    top = ids(lay(client, TOP))
    moi = ids(lay(client, "/api/v1/feeds/moi"))
    assert moi == [ba_mach["moi"].pk, ba_mach["giua"].pk, ba_mach["cu"].pk]
    assert top != moi
    assert top == list(reversed(moi))


def test_top_chay_duoc_tren_ca_feed_dang_dien_ra(client, ba_mach):
    """PLAN cho sort này trên CẢ hai feed; feed thứ hai chỉ đổi tập mạch, không đổi khoá."""
    ba_mach["giua"].status = Mach.TrangThai.DONG
    ba_mach["giua"].save(update_fields=["status"])
    d = lay(client, "/api/v1/feeds/dang-dien-ra?sort=nhieu_diem")
    assert ids(d) == [ba_mach["cu"].pk, ba_mach["moi"].pk]


def test_sort_la_tra_400(client, db):
    d = lay(client, "/api/v1/feeds/moi?sort=top", status=400)
    assert d["code"] == "sort_khong_hop_le"


def test_khong_khai_sort_thi_giu_nguyen_hanh_vi_cu(client, ba_mach):
    assert ids(lay(client, "/api/v1/feeds/moi")) == ids(
        lay(client, "/api/v1/feeds/moi?sort=tu_nhien")
    )


# --- A3: khoảng thời gian ---------------------------------------------------


@pytest.fixture
def theo_khoang(sub, tac_gia):
    """Bốn mạch neo vào **ranh giới ngày giờ VN**, không phải vào "N giờ trước".

    `hom_qua_muon` (hôm qua 23:59 giờ VN) là hàng đắt nhất: nó nằm NGOÀI `khoang=ngay`
    theo lịch VN, nhưng một cửa sổ trượt 24 giờ chạy lúc sáng sẽ kéo nó vào. Hai cách
    tính chỉ tách nhau ở đúng hàng này.
    """
    moc = {
        "hom_nay": khi_vn(0, time(0, 5)),
        "hom_qua_muon": khi_vn(-1, time(23, 59)),
        "tuan_nay": khi_vn(-6, time(12, 0)),
        "thang_nay": khi_vn(-29, time(12, 0)),
        "cu_lam": khi_vn(-200, time(12, 0)),
    }
    ra = {}
    for ten, khi in moc.items():
        m, _ = tao_mach(
            sub=sub, author=tac_gia, title=f"Mạch {ten}", body="Mốc 1.",
            _created_at_seed=khi,
        )
        ra[ten] = m
    return ra


@pytest.mark.parametrize(
    "khoang,mong_doi",
    [
        ("ngay", {"hom_nay"}),
        ("tuan", {"hom_nay", "hom_qua_muon", "tuan_nay"}),
        ("thang", {"hom_nay", "hom_qua_muon", "tuan_nay", "thang_nay"}),
        ("tat_ca", {"hom_nay", "hom_qua_muon", "tuan_nay", "thang_nay", "cu_lam"}),
    ],
)
def test_khoang_cat_dung_theo_lich_VN(client, theo_khoang, khoang, mong_doi):
    d = lay(client, f"{TOP}&khoang={khoang}")
    assert set(ids(d)) == {theo_khoang[t].pk for t in mong_doi}


def test_khoang_ngay_KHONG_phai_cua_so_truot_24_gio(client, theo_khoang):
    """Ghim riêng cái phân biệt được hai cách tính — bài parametrize ở trên vẫn xanh nếu
    ai đó đổi sang cửa sổ trượt và chạy test vào buổi tối."""
    d = lay(client, f"{TOP}&khoang=ngay")
    assert theo_khoang["hom_qua_muon"].pk not in ids(d)


def test_khoang_la_tra_400(client, db):
    for xau in ("nam", "", "NGAY"):
        d = lay(client, f"{TOP}&khoang={xau}", status=400)
        assert d["code"] == "tham_so_khong_hop_le"


def test_ma_loi_khi_hai_tham_so_cung_sai_khong_theo_URL(client, db):
    """X5 — người gọi KHÔNG đổi được mã lỗi bằng cách xếp lại query string.

    Plan lượt vá 3 ghi rằng mã trả về "phụ thuộc thứ tự"; đo lại thì câu ấy đúng nửa và
    nửa sai quan trọng hơn. `exc.errors` xếp theo **thứ tự trường của model** mà Ninja
    sinh từ chữ ký endpoint, nên thứ tự trên URL không đụng tới kết quả — hai lời gọi
    dưới đây trả cùng một mã.

    Thứ tự thật sự quyết định là thứ tự khai trong `def`, và hôm nay nó chưa quan sát
    được vì `MA_LOI_THEO_THAM_SO` mới có một dòng. Bài này ghim cái đo được (URL không
    ảnh hưởng); cái chưa đo được thì `api/loi.py::_ma_loi` nói ra bằng chữ.
    """
    xuoi = lay(client, "/api/v1/feeds/moi?sort=top&limit=abc", status=400)
    nguoc = lay(client, "/api/v1/feeds/moi?limit=abc&sort=top", status=400)
    assert xuoi["code"] == nguoc["code"] == "sort_khong_hop_le"

    # …và cả hai lỗi vẫn được kể ra trong `detail`: mã chỉ chọn MỘT, thông tin thì đủ.
    for d in (xuoi, nguoc):
        assert "query.sort" in d["detail"] and "query.limit" in d["detail"]


def test_khoang_ap_ca_cho_sort_tu_nhien_chu_khong_bi_bo_qua_im_lang(
    client, theo_khoang
):
    """Nuốt im lặng một tham số có trên URL là loài lỗi `api/machs.py` đã phải trả 400 để
    diệt. Ở đây câu trả lời là: khoảng có hiệu lực với mọi sort."""
    d = lay(client, "/api/v1/feeds/moi?khoang=ngay")
    assert ids(d) == [theo_khoang["hom_nay"].pk]


# --- A4: cursor keyset ------------------------------------------------------


@pytest.fixture
def dong_diem(sub, tac_gia):
    """9 mạch, trong đó **4 mạch cùng `diem_bai_goc`**.

    Bốn hàng đồng điểm là phần đắt nhất: chúng ép khoá keyset phải là cặp `(diem, id)`.
    Bỏ vế `id` thì bốn hàng đó hoặc lặp ở trang sau, hoặc rơi mất.
    """
    ra = []
    for i in range(9):
        m, _ = tao_mach(
            sub=sub, author=tac_gia, title=f"Đồng điểm {i}", body="Mốc 1.",
            _created_at_seed=khi_vn(-50 + i),
        )
        ra.append(dat_diem(m, 7 if 3 <= i < 7 else 20 - i))
    return ra


def duyet_het(client, url: str, limit: int) -> list[int]:
    ra, cursor, vong = [], None, 0
    while True:
        vong += 1
        assert vong < 50, "vòng lặp cursor không kết thúc"
        d = lay(client, f"{url}&limit={limit}" + (f"&cursor={cursor}" if cursor else ""))
        ra += ids(d)
        cursor = d["cursor_ke_tiep"]
        if cursor is None:
            return ra


@pytest.mark.parametrize("limit", [1, 2, 3, 4])
def test_cursor_top_khong_trung_khong_sot_khi_diem_trung_nhau(client, dong_diem, limit):
    het = duyet_het(client, TOP, limit)
    assert len(het) == len(set(het)) == len(dong_diem)
    assert set(het) == {m.pk for m in dong_diem}
    assert het == ids(lay(client, f"{TOP}&limit=50"))


def test_cursor_cua_sort_thoi_gian_KHONG_dung_duoc_cho_top(client, dong_diem):
    """Hai họ cursor mang hai khoá khác nhau. Nhận nhầm là trang sau bị cắt theo một khoá
    không liên quan — trùng dòng, sót dòng, HTTP 200."""
    cursor = lay(client, "/api/v1/feeds/moi?limit=2")["cursor_ke_tiep"]
    assert cursor is not None
    d = lay(client, f"{TOP}&limit=2&cursor={cursor}", status=400)
    assert d["code"] == "cursor_khong_hop_le"


def test_cursor_cua_top_KHONG_dung_duoc_cho_sort_thoi_gian(client, dong_diem):
    cursor = lay(client, f"{TOP}&limit=2")["cursor_ke_tiep"]
    assert cursor is not None
    d = lay(client, f"/api/v1/feeds/moi?limit=2&cursor={cursor}", status=400)
    assert d["code"] == "cursor_khong_hop_le"


def test_cursor_top_rac_tra_400(client, db):
    assert lay(client, f"{TOP}&cursor=@@@", status=400)["code"] == "cursor_khong_hop_le"


def test_cursor_top_giu_nguyen_bo_loc_khoang(client, theo_khoang):
    """Tổ hợp `sort × khoang × cursor` — một ca đại diện thay cho 24 bài na ná (plan con
    1d §4 rủi ro 3). Trang sau mà quên bộ lọc là hàng cũ chui vào giữa "top tuần"."""
    het = duyet_het(client, f"{TOP}&khoang=thang", 1)
    assert set(het) == {
        theo_khoang[t].pk
        for t in ("hom_nay", "hom_qua_muon", "tuan_nay", "thang_nay")
    }


def test_seed_co_thu_tu_top_khac_thu_tu_moi(client, seed):
    """A2 trên **dữ liệu seed thật**, không phải trên fixture riêng.

    Plan con 1d §2.4 đòi seed phải làm cho Top có nghĩa. Bài đo này là chỗ nói ra rằng nó
    có nghĩa thật — nếu ba mạch seed đồng điểm thì hai danh sách trùng nhau và nó đỏ.
    """
    top = ids(lay(client, f"{TOP}&limit=50"))
    moi = ids(lay(client, "/api/v1/feeds/moi?limit=50"))
    assert top != moi
    assert top[0] == seed.pk, "mạch HPG phải đứng đầu Top (mốc 1 của nó điểm cao nhất)"
