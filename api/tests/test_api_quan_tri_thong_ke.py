"""Bảng điều khiển khu quản trị — `GET /api/admin/thong-ke` (Phase 8).

Ba bài đầu là ba cái bẫy mà một endpoint thống kê rất dễ rơi vào **mà vẫn trả 200 và vẫn
trông đúng trên biểu đồ**: gom nhóm theo UTC, bỏ mất ngày rỗng, và số truy vấn trôi.
"""

from datetime import datetime, time, timedelta

import pytest
from django.test import override_settings

from core.ghi import dat_an_mach, dat_khoa_mach, dong_so, tao_mach
from core.models import Mach, Sub, User
from core.thoi_gian import TZ_VN, ngay_vn

from api.quan_tri_thong_ke import SO_NGAY_BIEU_DO
from tests._quan_tri import dang_nhap, dung_mod

pytestmark = pytest.mark.django_db

#: Trần số truy vấn của `GET /thong-ke`. Con số CỤ THỂ không quan trọng bằng việc có một
#: con số: nó chạy mỗi lần mod mở khu quản trị, và không có trần thì nó trôi từ 13 lên 40
#: sau ba lượt sửa mà không gì đỏ. Tăng nó là một quyết định phải nhìn thấy trong diff.
#:
#: 13 = 5 count tổng · 1 báo cáo chờ · 4 chuỗi ngày · 1 aggregate trạng thái · 1 top sub ·
#: 1 SAVEPOINT của pytest-django.
SO_TRUY_VAN_TOI_DA = 14


def _mach(sub, tac_gia, title, khi=None):
    mach, _ = tao_mach(sub=sub, author=tac_gia, title=title, body="thân bài")
    if khi is not None:
        Mach.objects.filter(pk=mach.pk).update(created_at=khi)
        mach.refresh_from_db()
    return mach


@pytest.fixture
def canh(db):
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    tac_gia = User.objects.create(username="chu_mach", display_name="Chủ Mạch")
    return sub, tac_gia, dang_nhap(dung_mod())


def test_chuoi_ngay_du_30_o_ke_ca_ngay_khong_co_gi(canh):
    """Ngày rỗng phải có ô — `GROUP BY` không tự sinh ra chúng.

    Bài đo này chống đúng cái hỏng im lặng: một chuỗi 3 phần tử vẫn vẽ ra một biểu đồ, và
    biểu đồ đó nói rằng site hoạt động đều mỗi ngày.
    """
    sub, tac_gia, mod = canh
    _mach(sub, tac_gia, "Hôm nay")

    du_lieu = mod.get("/api/admin/thong-ke").json()
    chuoi = du_lieu["chuoi_ngay"]

    assert len(chuoi) == SO_NGAY_BIEU_DO
    assert sum(o["mach_moi"] for o in chuoi) == 1, "chỉ có đúng 1 mạch được tạo"
    assert [o for o in chuoi if o["mach_moi"] == 0], "phải có ngày rỗng trong chuỗi"
    ngay = [o["ngay"] for o in chuoi]
    assert ngay == sorted(ngay), "chuỗi phải đi cũ → mới"
    assert ngay[-1] == ngay_vn().isoformat(), "ô cuối là hôm nay giờ VN"


@pytest.mark.parametrize(
    "gio_vn,phut",
    [(23, 50), (0, 10)],
    ids=["23h50-hom-nay", "00h10-hom-sau"],
)
def test_gom_nhom_theo_ngay_VIET_NAM_khong_phai_UTC(canh, gio_vn, phut):
    """Ca biên hai đầu nửa đêm giờ VN.

    23:50 giờ VN = 16:50 UTC **cùng ngày**; 00:10 giờ VN = 17:10 UTC **ngày hôm trước**.
    Gom nhóm theo UTC thì ca thứ hai rơi sang ô hôm trước — sai đúng một ô, mỗi ngày, và
    không có gì đỏ. Khung 17:00–24:00 giờ VN cũng là khung ít người chạy test nhất.
    """
    sub, tac_gia, mod = canh
    hom_nay = ngay_vn()
    khi = datetime.combine(hom_nay, time(gio_vn, phut), tzinfo=TZ_VN)
    _mach(sub, tac_gia, "Mạch sát nửa đêm", khi=khi)

    chuoi = mod.get("/api/admin/thong-ke").json()["chuoi_ngay"]
    o = {x["ngay"]: x["mach_moi"] for x in chuoi}
    assert o[hom_nay.isoformat()] == 1, (
        f"{gio_vn:02d}:{phut:02d} giờ VN phải thuộc ngày {hom_nay}, "
        "không phải ngày của mốc UTC tương ứng"
    )


@override_settings(TIME_ZONE="UTC")
def test_van_dung_ngay_VN_ke_ca_khi_TIME_ZONE_doi_sang_UTC(canh):
    """Múi giờ sản phẩm không phải cấu hình hiển thị (`core/thoi_gian.py`).

    Ai đó đổi `TIME_ZONE` sang UTC cho hợp log prod **không được** dời ranh giới "ngày"
    của bảng điều khiển. Bỏ `tzinfo=TZ_VN` trong `_dem_theo_ngay` ⇒ bài này ĐỎ, còn hai
    bài trên vẫn xanh (chúng chạy với `TIME_ZONE` mặc định vốn đã là giờ VN).
    """
    sub, tac_gia, mod = canh
    hom_nay = ngay_vn()
    _mach(
        sub,
        tac_gia,
        "Mạch 00:10 giờ VN",
        khi=datetime.combine(hom_nay, time(0, 10), tzinfo=TZ_VN),
    )

    chuoi = mod.get("/api/admin/thong-ke").json()["chuoi_ngay"]
    assert {x["ngay"]: x["mach_moi"] for x in chuoi}[hom_nay.isoformat()] == 1


def test_bon_nhom_trang_thai_loai_tru_nhau_va_cong_du_tong(canh):
    """Bốn lát của vành khuyên phải cộng đúng bằng tổng — không chồng lấn.

    Ca chứng minh: một mạch **vừa đã đóng sổ vừa bị khoá vừa bị ẩn**. Nếu bốn con số đếm
    độc lập thì nó được tính ba lần, tổng các lát vượt tổng số mạch, và biểu đồ chỉ trông
    hơi lệch chứ không sai rõ ra.
    """
    sub, tac_gia, mod = canh
    boi = User.objects.get(username="mod_chinh")

    _mach(sub, tac_gia, "Đang mở")
    da_dong = _mach(sub, tac_gia, "Đã đóng")
    dong_so(mach=da_dong)
    bi_khoa = _mach(sub, tac_gia, "Bị khoá")
    dat_khoa_mach(mach=bi_khoa, boi=boi, khoa=True)
    ba_thu = _mach(sub, tac_gia, "Đóng + khoá + ẩn")
    dong_so(mach=ba_thu)
    dat_khoa_mach(mach=ba_thu, boi=boi, khoa=True)
    dat_an_mach(mach=ba_thu, boi=boi, an=True)

    du_lieu = mod.get("/api/admin/thong-ke").json()
    tt = du_lieu["theo_trang_thai"]

    assert sum(tt.values()) == du_lieu["tong"]["mach"] == 4
    assert tt == {"bi_an": 1, "bi_khoa": 1, "dong": 1, "mo": 1}


def test_bay_ngay_va_hom_nay_khop_voi_chuoi(canh):
    """Ba con số trên màn hình suy từ cùng một chuỗi ⇒ không bao giờ nói lệch nhau."""
    sub, tac_gia, mod = canh
    hom_nay = ngay_vn()
    _mach(sub, tac_gia, "Hôm nay")
    _mach(
        sub,
        tac_gia,
        "Ba ngày trước",
        khi=datetime.combine(hom_nay - timedelta(days=3), time(9), tzinfo=TZ_VN),
    )
    _mach(
        sub,
        tac_gia,
        "Hai mươi ngày trước",
        khi=datetime.combine(hom_nay - timedelta(days=20), time(9), tzinfo=TZ_VN),
    )

    du_lieu = mod.get("/api/admin/thong-ke").json()
    assert du_lieu["hom_nay"]["mach_moi"] == 1
    assert du_lieu["bay_ngay"]["mach_moi"] == 2, "hôm nay + 3 ngày trước, KHÔNG có cái 20"
    assert sum(o["mach_moi"] for o in du_lieu["chuoi_ngay"]) == 3


def test_so_truy_van_co_tran(canh, django_assert_num_queries):
    """Ghim số truy vấn. Dữ liệu phải NHIỀU HÀNG, nếu không bài đo này rỗng.

    N+1 với N = 1 trông y hệt không N+1 — nên ở đây có 3 sub và 12 mạch rải ra, và con số
    phải giữ nguyên bất kể chúng nhiều lên.
    """
    sub, tac_gia, mod = canh
    Sub.objects.create(slug="crypto", ten="Crypto")
    Sub.objects.create(slug="vang", ten="Vàng")
    hom_nay = ngay_vn()
    for i in range(12):
        _mach(
            sub,
            tac_gia,
            f"Mạch {i}",
            khi=datetime.combine(hom_nay - timedelta(days=i), time(9), tzinfo=TZ_VN),
        )

    with django_assert_num_queries(SO_TRUY_VAN_TOI_DA):
        r = mod.get("/api/admin/thong-ke")
    assert r.status_code == 200
    assert r.json()["tong"]["mach"] == 12, "bài đo phải chạy trên nhiều hàng, không phải 1"


def test_khong_cache(canh):
    """Số liệu quản trị đổi theo từng hành động của mod — cache lại là nói dối."""
    _, _, mod = canh
    assert mod.get("/api/admin/thong-ke")["Cache-Control"] == "no-store"


def test_top_sub_dem_dung_va_khong_nhan_cheo(canh):
    """`so_mach` và `so_mach_30_ngay` là hai `Count` trong cùng một câu ⇒ phải `distinct`."""
    sub, tac_gia, mod = canh
    hom_nay = ngay_vn()
    _mach(sub, tac_gia, "Mới 1")
    _mach(sub, tac_gia, "Mới 2")
    _mach(
        sub,
        tac_gia,
        "Cũ",
        khi=datetime.combine(hom_nay - timedelta(days=90), time(9), tzinfo=TZ_VN),
    )

    top = mod.get("/api/admin/thong-ke").json()["top_sub"]
    dong = next(s for s in top if s["slug"] == "chung-khoan")
    assert dong["so_mach"] == 3
    assert dong["so_mach_30_ngay"] == 2, "mạch 90 ngày trước không thuộc cửa sổ 30 ngày"


def test_thoi_gian_khong_lam_vo_cua_so_khi_chua_co_gi(canh):
    """Site rỗng vẫn phải trả đủ hình dạng — bảng điều khiển là màn hình ĐẦU TIÊN mod thấy."""
    _, _, mod = canh
    du_lieu = mod.get("/api/admin/thong-ke").json()
    assert du_lieu["tong"]["mach"] == 0
    assert len(du_lieu["chuoi_ngay"]) == SO_NGAY_BIEU_DO
    assert du_lieu["theo_trang_thai"] == {"bi_an": 0, "bi_khoa": 0, "dong": 0, "mo": 0}
    # Sub rỗng VẪN có mặt trong top: mod cần thấy chuyên mục vừa mở mà chưa ai đăng —
    # đó là thông tin, không phải nhiễu. Lọc `so_mach > 0` là giấu đúng thứ cần nhìn.
    assert du_lieu["top_sub"] == [
        {"slug": "chung-khoan", "ten": "Chứng khoán", "so_mach": 0, "so_mach_30_ngay": 0}
    ]
