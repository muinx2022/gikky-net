"""`GET /feeds/nhat-ky-dang-ban` — dải "Đang được bàn" của trang chủ.

Plan `2026-11-13-nhat-ky-dang-ban.md`. Ca gốc của user: một tác giả có nhật ký HPG đang được bàn
rất nhiều, rồi đăng nhật ký mới ⇒ khối "Nhật ký mới" (mỗi tác giả một bài) đẩy HPG khỏi trang chủ.
Endpoint này đếm bình luận **tính** trong `CUA_SO_DANG_BAN_GIO` giờ và KHÔNG lọc theo tác giả.

Mỗi bài "loại trừ" dựng đúng một bình luận bị loại CỘNG đúng một bình luận tính, để nếu luật loại
thủng thì mạch vượt ngưỡng 2 và lên dải — bài đo không xanh nhờ mạch vốn đã dưới ngưỡng.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from api.feeds import CUA_SO_DANG_BAN_GIO, NGUONG_DANG_BAN
from core.ghi import tao_mach
from core.models import Comment, Mach, User
from tests._an_mach import an_mach_tho
from tests.conftest import dung_user, lay, viet

pytestmark = pytest.mark.django_db

URL = "/api/v1/feeds/nhat-ky-dang-ban"


def dang(sub, tac_gia, tieu_de: str, khi=None, **kw):
    kw.setdefault("loai_mach", Mach.LoaiMach.NHAT_KY)
    m, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title=tieu_de,
        body="Mốc 1.",
        _created_at_seed=khi or timezone.now() - timedelta(days=5),
        **kw,
    )
    return m


def ids(d) -> list[int]:
    return [x["mach"]["id"] for x in d["items"]]


def binh_luan(mach, nguoi, so: int = 1, *, truoc=timedelta(hours=1)):
    """`so` bình luận của `nguoi`, cùng viết lúc `now - truoc`."""
    khi = timezone.now() - truoc
    return [viet(mach, nguoi, f"Bình luận {i}", khi=khi) for i in range(so)]


@pytest.fixture
def ban(db) -> list[User]:
    """Ba người đọc, không ai là tác giả mạch, không ai là bot."""
    return [dung_user(f"ban_{i}", f"Bạn {i}") for i in range(3)]


def test_hang_so_dung_plan():
    assert (CUA_SO_DANG_BAN_GIO, NGUONG_DANG_BAN) == (48, 2)


def test_nguong_1_binh_luan_khong_len_2_binh_luan_len(client, sub, tac_gia, ban):
    mot = dang(sub, tac_gia, "Một bình luận")
    hai = dang(sub, tac_gia, "Hai bình luận")
    binh_luan(mot, ban[0])
    binh_luan(hai, ban[0])
    binh_luan(hai, ban[1])

    d = lay(client, URL)
    assert ids(d) == [hai.pk]
    assert d["items"][0]["so_binh_luan_gan_day"] == 2
    assert d["cua_so_gio"] == 48


def test_bien_cua_so_47h59_tinh_48h01_khong(client, sub, tac_gia, ban):
    trong = dang(sub, tac_gia, "Trong cửa sổ")
    ngoai = dang(sub, tac_gia, "Ngoài cửa sổ")
    binh_luan(trong, ban[0], 2, truoc=timedelta(hours=47, minutes=59))
    binh_luan(ngoai, ban[0], 1, truoc=timedelta(hours=1))
    binh_luan(ngoai, ban[1], 5, truoc=timedelta(hours=48, minutes=1))
    assert Comment.objects.filter(mach=ngoai).count() == 6

    d = lay(client, URL)
    assert ids(d) == [trong.pk]


def _cap(sub, tac_gia, ban, ten):
    """Mạch có đúng MỘT bình luận tính (của `ban[0]`) — luật loại thủng là vượt ngưỡng."""
    m = dang(sub, tac_gia, ten)
    binh_luan(m, ban[0])
    return m


def test_binh_luan_cua_chinh_tac_gia_mach_khong_tinh(client, sub, tac_gia, ban):
    m = _cap(sub, tac_gia, ban, "Tác giả tự bàn")
    binh_luan(m, tac_gia, 3)
    assert lay(client, URL)["items"] == []
    # Chống rỗng: thêm MỘT bình luận của người khác thì lên ngay.
    binh_luan(m, ban[1])
    assert ids(lay(client, URL)) == [m.pk]


def test_binh_luan_cua_bot_khong_tinh(client, sub, tac_gia, ban):
    m = _cap(sub, tac_gia, ban, "Bot bàn")
    bot = User.objects.create(username="mot_con_bot", display_name="Bot", la_bot=True)
    binh_luan(m, bot, 3)
    assert lay(client, URL)["items"] == []
    binh_luan(m, ban[1])
    assert ids(lay(client, URL)) == [m.pk]


@pytest.mark.parametrize("cot", ["deleted_at", "hidden_at"])
def test_binh_luan_da_xoa_hoac_an_khong_tinh(client, sub, tac_gia, ban, cot):
    m = _cap(sub, tac_gia, ban, f"Có bình luận {cot}")
    (c,) = binh_luan(m, ban[1])
    Comment.objects.filter(pk=c.pk).update(**{cot: timezone.now()})
    assert lay(client, URL)["items"] == []
    Comment.objects.filter(pk=c.pk).update(**{cot: None})
    assert ids(lay(client, URL)) == [m.pk], "chống rỗng: gỡ cờ thì phải lên"


def _an(m):
    an_mach_tho(Mach.objects.filter(pk=m.pk))


def _luu_tru(m):
    Mach.objects.filter(pk=m.pk).update(archived_at=timezone.now(), archived_by_id=m.author_id)


MACH_BI_LOAI = {
    "bi_mod_an": lambda sub, u: (lambda m: (_an(m), m)[1])(dang(sub, u, "Ẩn")),
    "rieng_tu": lambda sub, u: dang(sub, u, "Riêng tư", rieng_tu=True),
    "da_luu_tru": lambda sub, u: (lambda m: (_luu_tru(m), m)[1])(dang(sub, u, "Lưu trữ")),
    "bai_viet": lambda sub, u: dang(sub, u, "Bài viết", loai_mach=Mach.LoaiMach.BAI_VIET),
    "thao_luan": lambda sub, u: dang(sub, u, "Chủ đề", loai_mach=Mach.LoaiMach.THAO_LUAN),
}


@pytest.mark.parametrize("loai", sorted(MACH_BI_LOAI))
def test_mach_bi_loai_khong_len(client, sub, tac_gia, ban, loai):
    hien = dang(sub, tac_gia, "Hiện được")
    binh_luan(hien, ban[0], 2)
    bi_loai = MACH_BI_LOAI[loai](sub, tac_gia)
    binh_luan(bi_loai, ban[1], 5)  # nhiều hơn ⇒ thủng là đứng ĐẦU

    assert ids(lay(client, URL)) == [hien.pk]


def test_ca_cua_user_nhat_ky_cu_dang_ban_van_len_du_tac_gia_co_bai_moi(
    client, sub, tac_gia, ban
):
    """Nhật ký HPG cũ nhiều bình luận + nhật ký mới hơn của CÙNG tác giả."""
    hpg = dang(sub, tac_gia, "HPG", timezone.now() - timedelta(days=4))
    moi = dang(sub, tac_gia, "Nhật ký mới hơn", timezone.now() - timedelta(hours=2))
    for u in ban:
        binh_luan(hpg, u, 2)

    # Tiền điều kiện: khối "Nhật ký mới" THẬT SỰ chỉ có bài mới của tác giả này.
    moi_tac_gia = lay(client, "/api/v1/feeds/nhat-ky-moi-tac-gia")
    assert [m["id"] for m in moi_tac_gia["items"]] == [moi.pk]

    d = lay(client, URL)
    assert ids(d) == [hpg.pk]
    assert d["items"][0]["so_binh_luan_gan_day"] == 6


def test_hai_nhat_ky_cung_tac_gia_cung_len(client, sub, tac_gia, ban):
    hpg = dang(sub, tac_gia, "HPG")
    dri = dang(sub, tac_gia, "DRI")
    binh_luan(hpg, ban[0], 2)
    binh_luan(dri, ban[1], 2)
    assert set(ids(lay(client, URL))) == {hpg.pk, dri.pk}


def test_thu_tu_nguoi_roi_dem_roi_gio_cuoi_roi_pk(client, sub, tac_gia, ban):
    """Bốn khoá, mỗi cặp mạch liền nhau chỉ phân định được bằng ĐÚNG một khoá."""
    # p: 2 NGƯỜI × 1 bình luận ⇒ đứng đầu dù ít bình luận hơn a, bình luận cũ nhất, id nhỏ nhất.
    p = dang(sub, tac_gia, "P hai người")
    viet(p, ban[1], "x", khi=timezone.now() - timedelta(hours=40))
    viet(p, ban[2], "y", khi=timezone.now() - timedelta(hours=40))
    # a: 1 người, 4 bình luận ⇒ trước c/b (1 người, 2 bình luận).
    a = dang(sub, tac_gia, "A nhiều nhất")
    binh_luan(a, ban[0], 4, truoc=timedelta(hours=30))
    # b, c: cùng 1 người × 2 bình luận; c có bình luận TÍNH cuối mới hơn ⇒ c trước b dù id nhỏ
    # hơn. b còn có bình luận của bot và của chính tác giả MỚI NHẤT cả bảng: `Max` mà quên
    # `filter=` thì b nhảy lên trước c.
    c = dang(sub, tac_gia, "C giờ cuối mới hơn")
    b = dang(sub, tac_gia, "B giờ cuối cũ hơn")
    binh_luan(b, ban[0], 2, truoc=timedelta(hours=10))
    binh_luan(c, ban[0], 2, truoc=timedelta(hours=5))
    bot = User.objects.create(username="bot_thu_tu", display_name="Bot", la_bot=True)
    binh_luan(b, bot, 1, truoc=timedelta(minutes=1))
    binh_luan(b, tac_gia, 1, truoc=timedelta(minutes=1))
    # d, e: cùng 1 người × 2 bình luận, cùng giờ cuối ⇒ id lớn hơn trước.
    khi = timezone.now() - timedelta(hours=20)
    d_ = dang(sub, tac_gia, "D")
    e = dang(sub, tac_gia, "E")
    for m in (d_, e):
        viet(m, ban[0], "x", khi=khi)
        viet(m, ban[0], "y", khi=khi)
    assert c.pk < b.pk and d_.pk < e.pk

    d = lay(client, URL)
    assert ids(d) == [p.pk, a.pk, c.pk, b.pk, e.pk, d_.pk]
    assert [x["so_nguoi_ban"] for x in d["items"]] == [2, 1, 1, 1, 1, 1]
    assert [x["so_binh_luan_gan_day"] for x in d["items"]] == [2, 4, 2, 2, 2, 2]
    assert d["items"][2]["binh_luan_cuoi_at"] > d["items"][3]["binh_luan_cuoi_at"]


def test_mot_nguoi_20_binh_luan_dung_sau_hai_nguoi_moi_nguoi_mot(client, sub, tac_gia, ban):
    """Chống spam: một người viết liên tục không đẩy được mạch lên trên mạch có 2 người bàn."""
    hai_nguoi = dang(sub, tac_gia, "Hai người bàn")
    spam = dang(sub, tac_gia, "Một người viết 20 lần")
    binh_luan(hai_nguoi, ban[0], 1, truoc=timedelta(hours=30))
    binh_luan(hai_nguoi, ban[1], 1, truoc=timedelta(hours=30))
    binh_luan(spam, ban[2], 20, truoc=timedelta(minutes=5))
    assert hai_nguoi.pk < spam.pk  # spam thắng ở MỌI khoá khác: đếm, giờ cuối, id

    d = lay(client, URL)
    assert ids(d) == [hai_nguoi.pk, spam.pk], "ngưỡng vẫn đếm bình luận: spam vẫn lên, chỉ đứng sau"
    assert [(x["so_nguoi_ban"], x["so_binh_luan_gan_day"]) for x in d["items"]] == [
        (2, 2),
        (1, 20),
    ]


def test_limit_cat_va_mac_dinh_10(client, sub, tac_gia, ban):
    machs = [dang(sub, tac_gia, f"M{i}") for i in range(12)]
    for m in machs:
        binh_luan(m, ban[0], 2)
    assert len(lay(client, URL)["items"]) == 10
    assert len(lay(client, f"{URL}?limit=3")["items"]) == 3
    assert len(lay(client, f"{URL}?limit=1")["items"]) == 1


@pytest.mark.parametrize("limit", ["0", "-1", "11", "50"])
def test_limit_ngoai_1_10_la_400(client, sub, limit):
    d = lay(client, f"{URL}?limit={limit}", status=400)
    assert d["code"] == "tham_so_khong_hop_le"


def test_khong_co_gi_thi_rong_chu_khong_loi(client, sub):
    assert lay(client, URL) == {"items": [], "cua_so_gio": 48}
