"""`GET /feeds/nhat-ky-moi-tac-gia` — khối "Nhật ký mới" của trang chủ: MỖI tác giả một bài.

Plan `2026-11-11-nhat-ky-moi-moi-tac-gia-mot-bai.md`. Bản đầu lọc ở WEB (kéo 50 bài của
`/feeds/moi` rồi giữ bài đầu của mỗi tác giả) và phản biện tái hiện được hai lỗi mà chỉ
chuyển phép lọc xuống API mới chữa được:

- **V1** — `/feeds/moi` sắp theo `last_content_at`, nối mốc vào bài cũ thì nó nhảy lên. Bài
  "đầu tiên của tác giả" khi đó là bài đăng từ ba tháng trước, còn bài mới đăng hôm qua
  mất chỗ. Endpoint này chọn theo `published_at`.
- **V2** — cửa sổ 50 bài: một bot đăng dồn hơn 50 bài thì người thật biến khỏi khối. Ở đây
  phép chọn là `DISTINCT ON (author_id)` trên TOÀN BỘ mạch hiện được, không có cửa sổ.

Mỗi bài đo "ca lỗi" đều có một dòng `assert` chứng minh nó không rỗng: tiền điều kiện (feed
cũ THẬT SỰ sai ở đúng ca đó) nằm cạnh khẳng định (endpoint mới đúng).
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from core.ghi import tao_mach, them_moc
from core.models import Mach, User
from tests._an_mach import an_mach_tho
from tests.conftest import dung_user, lay

pytestmark = pytest.mark.django_db

URL = "/api/v1/feeds/nhat-ky-moi-tac-gia"


def dang(sub, tac_gia, tieu_de: str, khi, **kw):
    """Một nhật ký đăng lúc `khi` (đóng dấu `created_at = published_at = khi`)."""
    kw.setdefault("loai_mach", Mach.LoaiMach.NHAT_KY)
    m, _ = tao_mach(
        sub=sub, author=tac_gia, title=tieu_de, body="Mốc 1.", _created_at_seed=khi, **kw
    )
    return m


def tg(ten: str) -> User:
    return dung_user(ten, ten)


def ids(d) -> list[int]:
    return [m["id"] for m in d["items"]]


def test_moi_tac_gia_dung_mot_bai_la_bai_published_at_lon_nhat(client, sub):
    bay_gio = timezone.now()
    a, b, c = tg("tac_gia_a"), tg("tac_gia_b"), tg("tac_gia_c")
    # Đăng đan xen để thứ tự tạo không trùng thứ tự `published_at`.
    a1 = dang(sub, a, "A1 cũ nhất", bay_gio - timedelta(days=9))
    b1 = dang(sub, b, "B1", bay_gio - timedelta(days=8))
    a2 = dang(sub, a, "A2 giữa", bay_gio - timedelta(days=7))
    c1 = dang(sub, c, "C1", bay_gio - timedelta(days=6))
    a3 = dang(sub, a, "A3 mới nhất của A", bay_gio - timedelta(days=5))
    b2 = dang(sub, b, "B2 mới nhất của B", bay_gio - timedelta(days=4))
    assert Mach.objects.count() == 6

    d = lay(client, URL)
    assert ids(d) == [b2.pk, a3.pk, c1.pk]
    assert {m["author"]["username"] for m in d["items"]} == {"tac_gia_a", "tac_gia_b", "tac_gia_c"}
    assert d["cursor_ke_tiep"] is None
    # Không bài nào của A/B cũ hơn lọt vào.
    assert not {a1.pk, a2.pk, b1.pk} & set(ids(d))


def test_V1_bai_cu_vua_duoc_noi_moc_KHONG_gianh_cho_cua_bai_moi_dang(client, sub):
    """X đăng 90 ngày trước rồi được nối mốc; Y đăng hôm qua. Cùng một tác giả."""
    bay_gio = timezone.now()
    u = tg("nguoi_that")
    x = dang(sub, u, "X cũ 90 ngày", bay_gio - timedelta(days=90))
    y = dang(sub, u, "Y mới hôm qua", bay_gio - timedelta(days=1))
    them_moc(mach=x, author=u, body="Cập nhật X " + "đủ dài để qua cổng chất lượng. " * 3)

    # TIỀN ĐIỀU KIỆN (chống rỗng): feed cũ THẬT SỰ xếp X trước Y, tức bản lọc-ở-web sẽ chọn X.
    cu = lay(client, "/api/v1/feeds/moi?loai_mach=nhat_ky&limit=50")
    assert ids(cu).index(x.pk) < ids(cu).index(y.pk), "ca V1 không dựng được: X chưa bị bump"

    d = lay(client, URL)
    assert ids(d) == [y.pk], "phải là bài đăng MỚI nhất, không phải bài vừa được bump"
    assert d["items"][0]["published_at"][:10] == (bay_gio - timedelta(days=1)).date().isoformat()


def test_V2_bot_dang_don_60_bai_van_con_cho_cho_nguoi_that(client, sub):
    """60 bài của bot đều mới hơn bài duy nhất của người thật."""
    bay_gio = timezone.now()
    bot, nguoi = tg("bot_trader"), tg("nguoi_that")
    that = dang(sub, nguoi, "Bài của người thật, cũ hơn", bay_gio - timedelta(hours=6))
    for i in range(60):
        dang(sub, bot, f"Bot {i}", bay_gio - timedelta(minutes=120 - i))
    assert Mach.objects.filter(author=bot).count() == 60

    # TIỀN ĐIỀU KIỆN: cửa sổ 50 của feed cũ KHÔNG chứa người thật (bản lọc-ở-web mù ở đây).
    cu = lay(client, "/api/v1/feeds/moi?loai_mach=nhat_ky&limit=50")
    assert len(cu["items"]) == 50 and that.pk not in ids(cu)

    d = lay(client, URL)
    assert len(d["items"]) == 2
    assert that.pk in ids(d)
    assert {m["author"]["username"] for m in d["items"]} == {"bot_trader", "nguoi_that"}


# --- bộ lọc "feed công khai được phép hiện" ------------------------------------


def _an(m: Mach, **_):
    an_mach_tho(Mach.objects.filter(pk=m.pk))


def _luu_tru(m: Mach, **_):
    Mach.objects.filter(pk=m.pk).update(archived_at=timezone.now(), archived_by_id=m.author_id)


def _hen_gio(sub, tac_gia, tieu_de, khi):
    # Hẹn giờ = `published_at` ở TƯƠNG LAI so với dấu giờ server (`khi`): mạch bị ẩn đến lúc phát hành.
    m = dang(sub, tac_gia, tieu_de, khi, published_at=timezone.now() + timedelta(days=1))
    assert m.hidden_at is not None and m.published_at > timezone.now()
    return m


LOAI_BI_LOAI = {
    "bi_mod_an": lambda sub, u, t, khi: (lambda m: (_an(m), m)[1])(dang(sub, u, t, khi)),
    "rieng_tu": lambda sub, u, t, khi: dang(sub, u, t, khi, rieng_tu=True),
    "da_luu_tru": lambda sub, u, t, khi: (lambda m: (_luu_tru(m), m)[1])(dang(sub, u, t, khi)),
    "hen_gio_chua_toi": _hen_gio,
    "bai_viet": lambda sub, u, t, khi: dang(sub, u, t, khi, loai_mach=Mach.LoaiMach.BAI_VIET),
    "thao_luan": lambda sub, u, t, khi: dang(sub, u, t, khi, loai_mach=Mach.LoaiMach.THAO_LUAN),
}


@pytest.mark.parametrize("loai", sorted(LOAI_BI_LOAI))
def test_bai_bi_loai_khong_bao_gio_xuat_hien(client, sub, loai):
    """Với MỖI loại bài bị loại:

    - tác giả P có bài hiện được (cũ) + một bài bị loại MỚI hơn ⇒ khối hiện bài hiện được;
    - tác giả Q chỉ có bài bị loại ⇒ Q không có mặt.
    Bài bị loại luôn mới hơn nên nếu bộ lọc thủng thì nó chiếm chỗ ngay (không xanh nhờ trùng hợp).
    """
    bay_gio = timezone.now()
    p, q = tg("tac_gia_p"), tg("tac_gia_q")
    cu = dang(sub, p, "P hiện được", bay_gio - timedelta(days=3))
    loai_p = LOAI_BI_LOAI[loai](sub, p, "P bị loại", bay_gio - timedelta(days=1))
    loai_q = LOAI_BI_LOAI[loai](sub, q, "Q bị loại", bay_gio - timedelta(days=2))
    assert loai_p.pk != cu.pk and loai_q.pk != loai_p.pk

    d = lay(client, URL)
    assert ids(d) == [cu.pk]
    assert not {loai_p.pk, loai_q.pk} & set(ids(d))


# --- thứ tự và limit -----------------------------------------------------------


def test_thu_tu_published_at_giam_dan_va_cat_o_limit(client, sub):
    bay_gio = timezone.now()
    # Tuổi (ngày) xáo trộn: thứ tự `id` KHÔNG trùng thứ tự `published_at` theo chiều nào, nên
    # một cài đặt sắp theo `id` (tăng hay giảm) hoặc không sắp gì đều đỏ.
    tuoi = [3, 7, 1, 9, 5, 0, 8, 2, 6, 4]
    machs = [
        dang(sub, tg(f"nguoi_{i}"), f"Bài {i}", bay_gio - timedelta(days=i)) for i in tuoi
    ]
    moi_den_cu = sorted(machs, key=lambda m: m.published_at, reverse=True)
    pk_tang = sorted(m.pk for m in machs)
    assert [m.pk for m in moi_den_cu] not in (pk_tang, pk_tang[::-1])

    macdinh = lay(client, URL)
    assert ids(macdinh) == [m.pk for m in moi_den_cu][:8], "mặc định 8"
    khi = [m["published_at"] for m in macdinh["items"]]
    assert khi == sorted(khi, reverse=True)

    assert ids(lay(client, f"{URL}?limit=3")) == [m.pk for m in moi_den_cu][:3]
    assert ids(lay(client, f"{URL}?limit=1")) == [moi_den_cu[0].pk]
    assert ids(lay(client, f"{URL}?limit=20")) == [m.pk for m in moi_den_cu]


@pytest.mark.parametrize("limit", ["0", "-1", "21", "50", "100000"])
def test_limit_ngoai_1_20_la_400(client, sub, limit):
    dang(sub, tg("mot_nguoi"), "B", timezone.now())
    d = lay(client, f"{URL}?limit={limit}", status=400)
    assert d["code"] == "tham_so_khong_hop_le"


def test_khong_co_nhat_ky_nao_thi_rong_chu_khong_loi(client, sub):
    d = lay(client, URL)
    assert d == {"items": [], "cursor_ke_tiep": None}


def test_cung_published_at_thi_id_lon_hon_dung_truoc(client, sub):
    """Hai tác giả đăng cùng một dấu giờ ⇒ thứ tự ổn định (id giảm dần)."""
    khi = timezone.now() - timedelta(days=2)
    m1 = dang(sub, tg("trung_1"), "T1", khi)
    m2 = dang(sub, tg("trung_2"), "T2", khi)
    assert ids(lay(client, URL)) == [m2.pk, m1.pk]
    # Cùng tác giả, cùng dấu giờ: giữ bài có id lớn hơn.
    u = tg("trung_3")
    m3a = dang(sub, u, "T3 a", khi - timedelta(days=1))
    m3b = dang(sub, u, "T3 b", khi - timedelta(days=1))
    d = lay(client, URL)
    assert m3b.pk in ids(d) and m3a.pk not in ids(d)
