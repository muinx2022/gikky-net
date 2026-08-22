"""`GET /feeds/moi` và `/feeds/dang-dien-ra` — PLAN 5.9. Tiêu chí R1, R8.

Bài đo nặng nhất ở đây là **cursor keyset không trùng, không sót**, và nó phải chạy trên
dữ liệu có **dấu thời gian TRÙNG NHAU**: đó chính là ca mà một cursor chỉ mang mốc thời
gian (không mang `id`) hoặc dùng `<=` thay vì `<` sẽ trùng hoặc sót — và ở dữ liệu bình
thường, nơi mọi `created_at` khác nhau, ca đó không bao giờ xuất hiện.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from core.ghi import tao_mach, them_moc
from core.models import Mach, Sub
from tests.conftest import lay

pytestmark = pytest.mark.django_db


def ids(d) -> list[int]:
    return [m["id"] for m in d["items"]]


def duyet_het(client, url: str, limit: int) -> list[int]:
    """Lật hết feed bằng cursor, trả danh sách id theo thứ tự nhận được."""
    ra, cursor, vong = [], None, 0
    while True:
        vong += 1
        assert vong < 100, "vòng lặp cursor không kết thúc"
        noi = "&" if "?" in url else "?"
        d = lay(
            client, f"{url}{noi}limit={limit}" + (f"&cursor={cursor}" if cursor else "")
        )
        ra += ids(d)
        cursor = d["cursor_ke_tiep"]
        if cursor is None:
            return ra


@pytest.fixture
def nhieu_mach(sub, tac_gia):
    """12 mạch, trong đó 4 mạch dùng **CÙNG một `created_at`**.

    Bốn hàng trùng dấu thời gian là phần đắt nhất của fixture này: chúng ép khoá keyset
    phải là cặp `(created_at, id)`. Bỏ vế `id` đi thì bốn hàng đó hoặc lặp lại ở trang
    sau, hoặc rơi mất — tuỳ hướng so sánh.
    """
    goc = timezone.now() - timedelta(days=30)
    trung = goc + timedelta(days=5)
    machs = []
    for i in range(12):
        khi = trung if 4 <= i < 8 else goc + timedelta(days=i)
        m, _ = tao_mach(
            sub=sub,
            author=tac_gia,
            title=f"Mạch số {i}",
            body="Mốc 1.",
            _created_at_seed=khi,
        )
        machs.append(m)
    return machs


def test_feed_moi_sap_theo_created_at_giam_dan(client, nhieu_mach):
    d = lay(client, "/api/v1/feeds/moi?limit=50")
    khi = [m["created_at"] for m in d["items"]]

    assert len(d["items"]) == 12
    assert khi == sorted(khi, reverse=True)
    assert d["cursor_ke_tiep"] is None


def test_cursor_di_het_khong_trung_khong_sot_ke_ca_khi_trung_dau_thoi_gian(
    client, nhieu_mach
):
    """R8 — điều kiện then chốt: bốn mạch có `created_at` y hệt nhau."""
    day_du = ids(lay(client, "/api/v1/feeds/moi?limit=50"))
    tung_trang = duyet_het(client, "/api/v1/feeds/moi", limit=3)

    assert tung_trang == day_du
    assert len(set(tung_trang)) == 12

    trung = [m.pk for m in nhieu_mach[4:8]]
    assert sum(1 for pk in tung_trang if pk in trung) == 4


def test_cursor_van_dung_khi_co_mach_moi_chen_vao_giua_hai_trang(
    client, nhieu_mach, sub, tac_gia
):
    """Chèn một mạch MỚI sau khi đã lấy trang 1.

    Với `OFFSET` thì mọi hàng tụt một bậc và hàng cuối trang 1 hiện lại ở đầu trang 2.
    Keyset neo vào `(created_at, id)` của hàng cuối trang 1, nên mạch mới — vốn đứng
    trước cursor — không chen được vào, và cũng không đẩy ai đi.
    """
    t1 = lay(client, "/api/v1/feeds/moi?limit=4")
    tao_mach(sub=sub, author=tac_gia, title="Mạch chen ngang", body="Mốc 1.")

    t2 = lay(client, f"/api/v1/feeds/moi?limit=4&cursor={t1['cursor_ke_tiep']}")
    t3 = lay(client, f"/api/v1/feeds/moi?limit=4&cursor={t2['cursor_ke_tiep']}")

    lay_duoc = ids(t1) + ids(t2) + ids(t3)
    assert len(set(lay_duoc)) == 12
    assert lay_duoc == [m.pk for m in sorted(nhieu_mach, key=lambda m: (m.created_at, m.pk), reverse=True)]


def test_cursor_xoa_mach_giua_chung_khong_lam_sot_hang_con_lai(client, nhieu_mach):
    """Ca ngược: một mạch biến mất giữa hai trang. Keyset không vì thế mà bỏ sót hàng."""
    t1 = lay(client, "/api/v1/feeds/moi?limit=4")
    Mach.objects.filter(pk=nhieu_mach[0].pk).update(hidden_at=timezone.now())

    con_lai = duyet_het_tu(client, "/api/v1/feeds/moi", 4, t1["cursor_ke_tiep"])
    assert nhieu_mach[0].pk not in ids(t1) + con_lai
    assert len(set(ids(t1) + con_lai)) == 11


def duyet_het_tu(client, url: str, limit: int, cursor: str | None) -> list[int]:
    ra, vong = [], 0
    while cursor is not None:
        vong += 1
        assert vong < 100
        d = lay(client, f"{url}?limit={limit}&cursor={cursor}")
        ra += ids(d)
        cursor = d["cursor_ke_tiep"]
    return ra


def test_feed_dang_dien_ra_chi_lay_mach_MO_va_sap_theo_last_entry_at(
    client, seed, seed_post_thuong, tac_gia
):
    """Mạch HPG của seed đã đóng sổ ⇒ phải vắng mặt, dù nó là mạch giàu nội dung nhất."""
    for i in range(3):
        tao_mach(
            sub=seed.sub,
            author=tac_gia,
            title=f"Mạch mở thêm {i}",
            body="Mốc 1.",
            _created_at_seed=timezone.now() - timedelta(days=i),
        )

    d = lay(client, "/api/v1/feeds/dang-dien-ra?limit=50")

    assert seed.pk not in ids(d), "mạch đã đóng sổ không thuộc feed Đang diễn ra"
    assert seed_post_thuong.pk in ids(d)
    assert len(d["items"]) == 4
    assert all(m["status"] == "open" for m in d["items"])
    khi = [m["last_entry_at"] for m in d["items"]]
    assert khi == sorted(khi, reverse=True)


def test_hai_feed_dung_hai_khoa_sort_khac_nhau(client, sub, tac_gia, nguoi_khac):
    """Đối chứng cho bài trên: nếu hai feed cùng khoá sort thì mọi bài đo đều rỗng một nửa.

    Dựng hai mạch có thứ tự `created_at` NGƯỢC với thứ tự `last_entry_at`: mạch cũ vừa
    được nối mốc, mạch mới thì chưa. Feed "Mới" phải cho mạch mới lên đầu, feed "Đang
    diễn ra" phải cho mạch cũ lên đầu.
    """
    cu, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch cũ nhưng vừa nối mốc",
        body="Mốc 1.",
        _created_at_seed=timezone.now() - timedelta(days=20),
    )
    moi, _ = tao_mach(
        sub=sub,
        author=nguoi_khac,
        title="Mạch mới nhưng đứng im",
        body="Mốc 1.",
        _created_at_seed=timezone.now() - timedelta(days=1),
    )
    them_moc(mach=cu, author=tac_gia, body="Mốc 2 vừa nối.")

    assert ids(lay(client, "/api/v1/feeds/moi?limit=50")) == [moi.pk, cu.pk]
    assert ids(lay(client, "/api/v1/feeds/dang-dien-ra?limit=50")) == [cu.pk, moi.pk]


def test_loc_theo_sub(client, seed, seed_post_thuong):
    trong_sub = lay(client, "/api/v1/feeds/moi?sub=crypto&limit=50")
    assert ids(trong_sub) == [seed_post_thuong.pk]
    assert all(m["sub"]["slug"] == "crypto" for m in trong_sub["items"])


def test_sub_go_sai_tra_404_chu_khong_phai_feed_rong(client, seed):
    """Feed rỗng trông y hệt "sub này chưa có bài" — một chữ gõ nhầm thành diễn đàn chết."""
    d = lay(client, "/api/v1/feeds/moi?sub=chung-khoann", status=404)
    assert d["code"] == "sub_khong_ton_tai"


def test_mach_bi_mod_an_khong_xuat_hien_o_ca_hai_feed(client, sub, tac_gia):
    """R10 — mạch bị ẩn biến khỏi mọi danh sách công khai."""
    hien, _ = tao_mach(sub=sub, author=tac_gia, title="Mạch hiện", body="Mốc 1.")
    an, _ = tao_mach(sub=sub, author=tac_gia, title="MẠCH BỊ ẨN", body="Mốc 1.")
    Mach.objects.filter(pk=an.pk).update(hidden_at=timezone.now())

    for url in ("/api/v1/feeds/moi?limit=50", "/api/v1/feeds/dang-dien-ra?limit=50"):
        d = lay(client, url)
        assert ids(d) == [hien.pk], url
        assert "MẠCH BỊ ẨN" not in str(d)


def test_limit_ngoai_khoang_tra_400(client, db):
    for url in ("/api/v1/feeds/moi?limit=0", "/api/v1/feeds/moi?limit=51"):
        assert lay(client, url, status=400)["code"] == "tham_so_khong_hop_le"


def test_limit_khong_phai_so_tra_400_dung_hinh_dang_loi(client, db):
    """Lỗi validate của Ninja phải được kéo về `{detail: str, code}` (PLAN mục 7).

    Mặc định Ninja trả 422 với `detail` là **mảng** — một hình dạng lỗi thứ hai mà
    frontend không lường, chỉ cần gõ `?limit=abc` là gặp.
    """
    d = lay(client, "/api/v1/feeds/moi?limit=abc", status=400)
    assert d["code"] == "tham_so_khong_hop_le"
    assert isinstance(d["detail"], str)


def test_cursor_rac_tra_400(client, db):
    assert lay(client, "/api/v1/feeds/moi?cursor=@@@", status=400)["code"] == (
        "cursor_khong_hop_le"
    )


def test_feed_rong_tra_mang_rong_chu_khong_loi(client, db):
    Sub.objects.create(slug="trong-tron", ten="Trống trơn")
    d = lay(client, "/api/v1/feeds/moi?sub=trong-tron")
    assert d == {"items": [], "cursor_ke_tiep": None}


def test_the_feed_du_truong_cho_1c(client, seed):
    d = lay(client, "/api/v1/feeds/moi?limit=50")
    the = next(m for m in d["items"] if m["id"] == seed.pk)
    assert set(the) == {
        "id",
        "slug",
        "title",
        "sub",
        "author",
        "status",
        "ket_qua",
        "entry_count",
        "comment_count",
        "created_at",
        "last_entry_at",
        "last_activity_at",
        # Phase 1d: cột vote của thẻ feed đọc điểm MỐC 1, không phải tổng điểm mạch
        # (PLAN 5.7 — vote nằm trên từng mốc riêng rẽ).
        "diem",
    }
    assert the["ket_qua"] == "+18.2% · 163 ngày"
    assert the["author"]["display_name"] == "Ba Mươi Phiên"
