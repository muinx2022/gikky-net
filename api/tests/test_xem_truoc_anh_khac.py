"""`XemTruocOut.anh_khac` — ảnh thứ 2 đến thứ `SO_ANH_XEM_TRUOC` (10) của mốc 1, cho gallery lật
từng ảnh ở hàng bài viết trang chủ (`plans/2026-11-10-bai-viet-xem-truoc-anh.md` tiêu chí A1 / A2 /
A3, nới trần ở `plans/2026-11-10-gallery-kieu-reddit.md`).

Hợp đồng, chốt trước khi viết bài đo:

- `anh` và `so_anh` GIỮ NGUYÊN nghĩa (ảnh đầu / tổng số ảnh phục vụ được — `so_anh` KHÔNG bị
  cắt ở trần, để UI vẽ "n/N" và "Xem tất cả N ảnh");
- `anh_khac` là ảnh thứ 2.. — `[]` khi ≤ 1 ảnh, `min(n, SO_ANH_XEM_TRUOC) - 1` phần tử khi n ảnh
  (tối đa 9);
- cùng bộ lọc với `anh`: chỉ ảnh `confirmed` và chưa cách ly; cùng thứ tự (`position, id`
  với gallery, thứ tự trong `body` với ảnh nhúng);
- KHÔNG thêm truy vấn: ảnh gallery đã nằm trong bộ nhớ, ảnh nhúng dùng lại MỘT truy vấn
  `AnhNoiDung`;
- mốc 1 không đọc được (bia mộ / bị ẩn) ⇒ `xem_truoc = null` như cũ.
"""

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from api.schemas import SO_ANH_XEM_TRUOC
from api.trinh_bay import du_lieu_the
from core.models import AnhNoiDung, Mach, Moc, MocAnh
from tests.conftest import lay

pytestmark = pytest.mark.django_db


def _gallery(moc, n, *, bat_dau=0, tien_to="g"):
    """n ảnh `confirmed`, `position` = bat_dau.. bat_dau+n-1, tạo THEO THỨ TỰ NGƯỢC để
    thứ tự `id` ngược với thứ tự `position` — bài đo thứ tự không được xanh nhờ trùng id."""
    ra = []
    for i in reversed(range(n)):
        ra.append(
            MocAnh.objects.create(
                moc=moc,
                khoa_luu_tru=f"{tien_to}-{moc.pk}-{i}.jpg",
                status=MocAnh.TrangThai.XAC_NHAN,
                position=bat_dau + i,
                w=800,
                h=600,
            )
        )
    return ra


def _xem_truoc(mach):
    return du_lieu_the([mach])[mach.pk].xem_truoc


@pytest.mark.parametrize(
    ("n", "so_khac"),
    [(0, 0), (1, 0), (2, 1), (3, 2), (5, 4), (10, 9), (11, 9), (12, 9)],
)
def test_gallery_anh_khac_dung_so_luong_va_thu_tu(seed_post_thuong, n, so_khac):
    """Trần là `SO_ANH_XEM_TRUOC`: n ≥ 10 ảnh ⇒ `anh_khac` đúng 9, nhưng `so_anh` vẫn là n THẬT."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _gallery(moc_1, n)

    xt = _xem_truoc(seed_post_thuong)

    assert xt.so_anh == n
    assert len(xt.anh_khac) == so_khac
    if n == 0:
        assert xt.anh is None
        return
    thu_tu = [xt.anh, *xt.anh_khac]
    # Đúng thứ tự `position`, dù `id` được tạo ngược; `anh` vẫn là tấm ĐẦU.
    assert [a.position for a in thu_tu] == list(range(min(n, SO_ANH_XEM_TRUOC)))
    assert [a.url_thumb.rsplit("/", 1)[-1] for a in thu_tu] == [
        f"g-{moc_1.pk}-{i}.jpg" for i in range(min(n, SO_ANH_XEM_TRUOC))
    ]


def test_gallery_cung_position_thi_theo_id(seed_post_thuong):
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    ids = [
        MocAnh.objects.create(
            moc=moc_1,
            khoa_luu_tru=f"cung-{i}.jpg",
            status=MocAnh.TrangThai.XAC_NHAN,
            position=0,
            w=400,
            h=400,
        ).pk
        for i in range(3)
    ]
    xt = _xem_truoc(seed_post_thuong)
    assert [xt.anh.id, *(a.id for a in xt.anh_khac)] == ids


def test_anh_cho_va_anh_cach_ly_khong_lot_vao_anh_khac(seed_post_thuong):
    """Ảnh CHỜ (upload dở) và ảnh CÁCH LY (URL trả 404) không được chọn, dù nằm giữa."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    xn = MocAnh.TrangThai.XAC_NHAN
    MocAnh.objects.create(moc=moc_1, khoa_luu_tru="a.jpg", status=xn, position=0, w=8, h=6)
    MocAnh.objects.create(
        moc=moc_1, khoa_luu_tru="cho.jpg", status=MocAnh.TrangThai.CHO, position=1
    )
    MocAnh.objects.create(
        moc=moc_1, khoa_luu_tru="cach-ly.jpg", status=xn, position=2, da_cach_ly=True
    )
    MocAnh.objects.create(moc=moc_1, khoa_luu_tru="b.jpg", status=xn, position=3, w=8, h=6)
    MocAnh.objects.create(moc=moc_1, khoa_luu_tru="c.jpg", status=xn, position=4, w=8, h=6)
    MocAnh.objects.create(moc=moc_1, khoa_luu_tru="d.jpg", status=xn, position=5, w=8, h=6)

    xt = _xem_truoc(seed_post_thuong)

    assert xt.so_anh == 4
    assert xt.anh.url_thumb.endswith("a.jpg")
    assert [a.url_thumb.rsplit("/", 1)[-1] for a in xt.anh_khac] == ["b.jpg", "c.jpg", "d.jpg"]
    moi_url = " ".join([xt.anh.url_thumb, *(a.url_thumb for a in xt.anh_khac)])
    assert "cho.jpg" not in moi_url and "cach-ly.jpg" not in moi_url


def test_anh_khac_chi_gom_anh_dang_phuc_vu_khi_chi_con_mot_anh(seed_post_thuong):
    """2 ảnh trong DB nhưng 1 cách ly ⇒ `so_anh` 1 và `anh_khac` rỗng (không nhả ảnh 404)."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    xn = MocAnh.TrangThai.XAC_NHAN
    MocAnh.objects.create(moc=moc_1, khoa_luu_tru="a.jpg", status=xn, position=0, w=8, h=6)
    MocAnh.objects.create(
        moc=moc_1, khoa_luu_tru="b.jpg", status=xn, position=1, da_cach_ly=True
    )
    xt = _xem_truoc(seed_post_thuong)
    assert xt.so_anh == 1 and xt.anh_khac == []


def _thay_body_anh_nhung(moc, n, *, co_ban_ghi=True):
    """Body có `n` thẻ `<img>` nhúng; trả danh sách khoá, đúng thứ tự trong body."""
    khoas = [f"nhung-{moc.pk}-{i}.png" for i in range(n)]
    if co_ban_ghi:
        for i, k in enumerate(khoas):
            AnhNoiDung.objects.update_or_create(
                khoa_luu_tru=k,
                defaults={"nguoi_tai": moc.mach.author, "w": 1200 - i * 100, "h": 800},
            )
    moc.body = "<p>Có chữ.</p>" + "".join(f'<img src="/media/anh/{k}">' for k in khoas)
    moc.save(update_fields=["body"])
    return khoas


@pytest.mark.parametrize(
    ("n", "so_khac"), [(1, 0), (3, 2), (5, 4), (10, 9), (12, 9)]
)
def test_anh_nhung_anh_khac_dung_so_luong_va_thu_tu(seed_post_thuong, n, so_khac):
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    khoas = _thay_body_anh_nhung(moc_1, n)

    xt = _xem_truoc(seed_post_thuong)

    assert xt.so_anh == n
    assert len(xt.anh_khac) == so_khac
    thu_tu = [xt.anh, *xt.anh_khac]
    assert [a.url_thumb.rsplit("/", 1)[-1] for a in thu_tu] == khoas[:SO_ANH_XEM_TRUOC]
    # Kích thước đọc từ `AnhNoiDung` của TỪNG ảnh (không dùng chung của ảnh đầu).
    assert [a.w for a in thu_tu] == [1200 - i * 100 for i in range(min(n, SO_ANH_XEM_TRUOC))]
    assert all(a.w_thumb and a.h_thumb for a in thu_tu)


def test_anh_nhung_thieu_ban_ghi_thi_kich_thuoc_null_khong_loi(seed_post_thuong):
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    khoas = _thay_body_anh_nhung(moc_1, 3, co_ban_ghi=False)
    xt = _xem_truoc(seed_post_thuong)
    assert xt.so_anh == 3 and len(xt.anh_khac) == 2
    assert [a.w_thumb for a in (xt.anh, *xt.anh_khac)] == [None, None, None]
    assert xt.anh_khac[1].url_thumb.endswith(khoas[2])


def _dat_body(moc, *thanh_phan):
    moc.body = "<p>Có chữ.</p>" + "".join(thanh_phan)
    moc.save(update_fields=["body"])


def _img(khoa):
    return f'<img src="/media/anh/{khoa}">'


def test_anh_nhung_lap_mot_anh_nhieu_lan_thi_chi_dem_mot(seed_post_thuong):
    """Cùng một ảnh dán 5 lần ⇒ `so_anh` 1, `anh_khac` rỗng (không nhiều slide cùng URL)."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _dat_body(moc_1, *[_img("a.png")] * 5)

    xt = _xem_truoc(seed_post_thuong)

    assert xt.so_anh == 1
    assert xt.anh_khac == []
    assert xt.anh.url_thumb.endswith("a.png")


def test_anh_nhung_khu_trung_giu_thu_tu_lan_dau_xuat_hien(seed_post_thuong):
    """a b a c b a d ⇒ a b c d (4 ảnh khác nhau): `so_anh` 4, cả bốn ra, đúng thứ tự lần đầu."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _dat_body(moc_1, *(_img(k) for k in ["a.png", "b.png", "a.png", "c.png", "b.png", "a.png", "d.png"]))

    xt = _xem_truoc(seed_post_thuong)

    assert xt.so_anh == 4
    assert [a.url_thumb.rsplit("/", 1)[-1] for a in (xt.anh, *xt.anh_khac)] == [
        "a.png",
        "b.png",
        "c.png",
        "d.png",
    ]


def test_anh_nhung_khu_trung_truoc_khi_cat_o_tran(seed_post_thuong):
    """Mỗi ảnh dán HAI lần, 12 ảnh khác nhau (24 thẻ `<img>`) ⇒ `so_anh` 12 và 10 ảnh mang theo là
    k0..k9. Cắt trước khi khử trùng sẽ ra 5 ảnh khác nhau (k0..k4) và `so_anh` sai."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    khoas = [f"lap-{i}.png" for i in range(12)]
    _dat_body(moc_1, *(_img(k) for k in khoas for _ in range(2)))

    xt = _xem_truoc(seed_post_thuong)

    assert xt.so_anh == 12
    assert len(xt.anh_khac) == SO_ANH_XEM_TRUOC - 1
    assert [a.url_thumb.rsplit("/", 1)[-1] for a in (xt.anh, *xt.anh_khac)] == khoas[
        :SO_ANH_XEM_TRUOC
    ]


def test_anh_nhung_khu_trung_theo_khoa_ke_ca_khi_src_co_query(seed_post_thuong):
    """`/media/anh/a.png` và `/media/anh/a.png?v=2` là MỘT ảnh (cùng khoá lưu trữ)."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _dat_body(moc_1, _img("a.png"), '<img src="/media/anh/a.png?v=2">', _img("b.png"))

    xt = _xem_truoc(seed_post_thuong)

    assert xt.so_anh == 2
    assert len(xt.anh_khac) == 1


def test_anh_ngoai_site_giua_cac_anh_cua_site_van_bi_bo(seed_post_thuong):
    """Ảnh ngoài site nằm GIỮA ảnh của site không được đếm và không chiếm chỗ thumb."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _dat_body(
        moc_1,
        _img("a.png"),
        '<img src="https://ben-ngoai.example/x.png">',
        '<img src="//ben-ngoai.example/y.png">',
        _img("b.png"),
        _img("a.png"),
    )

    xt = _xem_truoc(seed_post_thuong)

    assert xt.so_anh == 2
    assert [a.url_thumb.rsplit("/", 1)[-1] for a in (xt.anh, *xt.anh_khac)] == ["a.png", "b.png"]
    assert "ben-ngoai" not in " ".join(a.url_thumb for a in (xt.anh, *xt.anh_khac))


def test_gallery_thang_anh_nhung_va_anh_khac_chi_tu_gallery(seed_post_thuong):
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _thay_body_anh_nhung(moc_1, 4)
    _gallery(moc_1, 2)

    xt = _xem_truoc(seed_post_thuong)

    assert xt.so_anh == 2
    assert len(xt.anh_khac) == 1
    assert "nhung-" not in xt.anh.url_thumb + xt.anh_khac[0].url_thumb


def test_moc_bia_mo_hoac_bi_an_khong_co_xem_truoc_nen_khong_ro_anh_khac(
    seed_post_thuong,
):
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _gallery(moc_1, 4)
    assert len(_xem_truoc(seed_post_thuong).anh_khac) == 3, "tiền đề"

    Moc.objects.filter(pk=moc_1.pk).update(hidden_at=timezone.now())
    assert _xem_truoc(seed_post_thuong) is None

    Moc.objects.filter(pk=moc_1.pk).update(hidden_at=None, deleted_at=timezone.now())
    assert _xem_truoc(seed_post_thuong) is None


def test_khong_them_truy_van_khi_nhieu_anh_hon(seed_post_thuong):
    """A2 ở tầng hàm: 1 ảnh hay 12 ảnh (vượt trần), gallery hay nhúng — cùng số truy vấn."""

    def dem():
        mach = Mach.objects.select_related("sub", "author").get(pk=seed_post_thuong.pk)
        with CaptureQueriesContext(connection) as ctx:
            du_lieu_the([mach])
        return len(ctx)

    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _thay_body_anh_nhung(moc_1, 1)
    nhung_1 = dem()
    _thay_body_anh_nhung(moc_1, 12)
    nhung_12 = dem()
    assert nhung_12 == nhung_1, "ảnh nhúng: 12 ảnh phải tốn bằng 1 ảnh"

    moc_1.body = "<p>Chữ thôi.</p>"
    moc_1.save(update_fields=["body"])
    _gallery(moc_1, 1)
    gallery_1 = dem()
    _gallery(moc_1, 11, bat_dau=1, tien_to="h")
    gallery_12 = dem()
    assert gallery_12 == gallery_1, "gallery: 12 ảnh phải tốn bằng 1 ảnh"


def test_feed_moi_khong_tham_so_tra_du_ba_loai_va_moi_the_co_anh_khac(
    client, seed_post_thuong
):
    """A3: `GET /feeds/moi` không tham số (sitemap dựa vào nó) vẫn trả cả ba loại mạch,
    và mọi thẻ đều mang `xem_truoc.anh_khac` (danh sách, `[]` khi không ảnh)."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _gallery(moc_1, 3)
    # Thêm hai mạch khác loại để đo "đủ ba loại".
    from core.ghi import tao_mach

    cac_loai = {}
    for loai in ("bai_viet", "thao_luan"):
        m, _ = tao_mach(
            sub=seed_post_thuong.sub,
            author=seed_post_thuong.author,
            title=f"Mạch {loai}",
            body="Chữ.",
        )
        Mach.objects.filter(pk=m.pk).update(loai_mach=loai)
        cac_loai[loai] = m.pk
    Mach.objects.filter(pk=seed_post_thuong.pk).update(loai_mach="nhat_ky")

    d = lay(client, "/api/v1/feeds/moi?limit=50")
    theo_id = {m["id"]: m for m in d["items"]}

    assert {m["loai_mach"] for m in d["items"]} >= {"nhat_ky", "bai_viet", "thao_luan"}
    for m in d["items"]:
        if m["xem_truoc"] is not None:
            assert isinstance(m["xem_truoc"]["anh_khac"], list)
    xt = theo_id[seed_post_thuong.pk]["xem_truoc"]
    assert xt["so_anh"] == 3 and len(xt["anh_khac"]) == 2
    assert xt["anh_khac"][0]["position"] == 1 and xt["anh_khac"][1]["position"] == 2
    assert set(xt["anh_khac"][0]) == set(xt["anh"]), "anh_khac mang đủ khoá của AnhOut"
    assert theo_id[cac_loai["bai_viet"]]["xem_truoc"]["anh_khac"] == []


def test_feed_api_gallery_12_anh_cat_o_tran_nhung_so_anh_la_that(client, seed_post_thuong):
    """Qua HTTP đúng như trang chủ gọi: 12 ảnh phục vụ được (+ 2 ảnh cách ly không tính) ⇒
    `so_anh` 12, `anh_khac` 9 phần tử vị trí 1..9 liền nhau, không ảnh nào trùng `anh`."""
    moc_1 = Moc.objects.get(mach=seed_post_thuong, seq=1)
    _gallery(moc_1, 12)
    for i in range(2):
        MocAnh.objects.create(
            moc=moc_1,
            khoa_luu_tru=f"cl-{i}.jpg",
            status=MocAnh.TrangThai.XAC_NHAN,
            position=100 + i,
            da_cach_ly=True,
        )

    d = lay(client, "/api/v1/feeds/moi?limit=50")
    xt = next(m for m in d["items"] if m["id"] == seed_post_thuong.pk)["xem_truoc"]

    assert xt["so_anh"] == 12
    assert len(xt["anh_khac"]) == SO_ANH_XEM_TRUOC - 1 == 9
    assert [a["position"] for a in xt["anh_khac"]] == list(range(1, 10))
    assert xt["anh"]["position"] == 0
    assert "cl-" not in " ".join(a["url_thumb"] for a in xt["anh_khac"])
