"""R9 — GHIM SỐ TRUY VẤN của cả 6 endpoint đọc. Plan con 1b mục 2.2.

Vì sao đây là tiêu chí nghiệm thu chứ không phải "lưu ý tối ưu": N+1 **không làm gì đỏ**.
`GET /machs/{id}/comments` bắn 25 truy vấn trên seed 24 bình luận vẫn trả đúng JSON, vẫn
200, và ở máy dev vẫn nhanh. Nó chỉ lộ ra khi một mạch có 500 bình luận trên prod — tức
là lộ ra ở đúng chỗ không sửa được nữa.

**Điều kiện để bài đo này KHÔNG rỗng: dữ liệu phải có nhiều hàng.** Ghim số truy vấn trên
một mạch 1 bình luận là ghim một hằng số vô nghĩa — N+1 với N = 1 trông y hệt không N+1.
Vì thế mọi bài dưới đây chạy trên seed (9 mốc · 24 bình luận · cây 3 tầng), và mỗi bài
`assert` kèm một câu về số hàng nó vừa đi qua.
"""

import pytest

from core.ghi import dat_vote, tao_mach
from core.models import Comment, Follow, Mach, Moc, Trich
from tests.conftest import lay, phang, viet

pytestmark = pytest.mark.django_db

#: Số truy vấn kỳ vọng, viết cứng. Con số tăng lên là một quyết định phải nhìn thấy.
#:
#: `GET /machs/{id}` = 6: mạch (kèm sub + author) · mốc · đếm bình luận theo mốc · trích ·
#: **ảnh của mọi mốc** (Phase 5, 2026-08-23) · **đếm reaction của mọi mốc** (lượt giao
#: diện, 2026-08-23 — nợ `REACTION-CHUA-CO-UI`: wireframe 9.2 có hàng `📈 12 · 🔥 9`, mà
#: `MocOut` chưa mang con số nào để vẽ nó).
#: Hai truy vấn cuối đều là MỘT cho cả mạch rồi phát theo `moc_id`, cùng lối
#: `trich_theo_moc` — `m.anhs.all()` / `dem_reaction(m)` trong vòng lặp là N+1 trên đúng
#: endpoint nặng nhất (9 mốc = 9 truy vấn thừa mỗi lượt tải trang).
#: Hai endpoint bình luận = 3: đối tượng gốc · toàn bộ bình luận của mạch · **tập id
#: bình luận đã TỪNG được trích**. Truy vấn thứ ba vào ở đợt vá Z1 (2026-08-22): PLAN 5.3
#: dòng 175 có HAI điều kiện giữ bia mộ, và vế "đã từng được trích" không suy ra được từ
#: các hàng `Comment` đang có trong tay — xem `core.doc_noi_dung.tap_tung_duoc_trich`.
#: Nó là MỘT truy vấn cho cả mạch, không phải một truy vấn cho mỗi bình luận; hai bài
#: chống-rỗng ở cuối file là thứ chứng minh chỗ đó.
#: `/revisions` = 2: mốc · bản cũ.
#: Hồ sơ = 8: user · danh sách mạch · **2 cho thẻ** · 4 phép đếm trên 4 bảng.
#: Feed = 3: trang mạch · **2 cho thẻ**.
#:
#: "2 cho thẻ" = `trinh_bay.du_lieu_the`: một truy vấn nạp **mốc 1** của cả trang (id cho
#: mũi tên vote — Phase 2; body + hai cột trạng thái cho nội dung xem trước — 2026-08-23),
#: một truy vấn nạp **ảnh gallery** của những mốc ấy.
#:
#: **Feed đi từ 2 lên 3 ở lượt thêm nội dung cho thẻ (2026-08-23)**, và con số này tăng có
#: chủ đích chứ không trôi: thẻ feed nay hiện ảnh hoặc trích đoạn của mốc 1, mà hai thứ
#: đó không có cách nào lấy được từ hàng `Mach`. Bản đầu của lượt ấy tách thành **hai**
#: hàm nạp (`moc_1_theo_mach` + `xem_truoc_theo_mach`) và chính bài đo này bắt được: cùng
#: một tập hàng bị hỏi hai lần, feed 2 → 4. Gộp lại còn 3.
#:
#: Cả hai đều là MỘT truy vấn cho cả trang, không phải một truy vấn mỗi thẻ — và đó chính
#: là thứ `test_them_mach_KHONG_lam_tang_so_query_cua_feed` ở cuối file chứng minh: 22 thẻ
#: vẫn đúng con số này.
SO_QUERY = {
    "xem_mach": 6,
    "khan_dai": 3,
    "ngan_keo": 3,
    "revisions": 2,
    "feed": 3,
    "feed_co_sub": 4,
    "ho_so": 8,
    "mach_cua_user": 4,
    "da_vote": 6,
    "dang_theo": 5,
}

#: Ba cửa danh sách của trang hồ sơ — `api/ho_so.py` (2026-08-24). Ba con số khác nhau,
#: và chỗ chúng khác nhau chính là chỗ đáng ghim:
#:
#: `mach_cua_user` = 4: tra user (để 404 thay vì danh sách rỗng) · trang mạch · **2 cho thẻ**.
#: `dang_theo` = 5: **2 cho phiên** · trang follow kèm mạch+sub+author trong MỘT truy vấn
#: (`select_related("mach__sub", "mach__author")`) · **2 cho thẻ**.
#: `da_vote` = 6: **2 cho phiên** · trang phiếu · **mốc 1 kèm mạch** · **2 cho thẻ**.
#:
#: "2 cho phiên" là `dang_nhap` (`SessionAuth`): đọc bảng session rồi đọc hàng user. Hai
#: cửa `/me/*` phải trả tiền cho nó, cửa công khai thì không — đó là lý do ba con số này
#: không bằng nhau chứ không phải một cửa nào đang N+1.
#:
#: `da_vote` tốn hơn `dang_theo` đúng MỘT truy vấn, và truy vấn ấy không bỏ được: `Vote`
#: **không có FK** (`target_type` + `target_id` — xem docstring `Vote`), nên không
#: `select_related` nào bắc được từ hàng phiếu sang hàng mạch. Nó là MỘT truy vấn cho cả
#: trang, không phải một truy vấn mỗi phiếu — `test_them_mach_KHONG_lam_tang_so_query_cua_ba_cua`
#: ở cuối file là thứ chứng minh chỗ đó.


def test_xem_mach(client, seed, django_assert_num_queries):
    with django_assert_num_queries(SO_QUERY["xem_mach"]):
        d = lay(client, f"/api/v1/machs/{seed.pk}")
    assert len(d["mocs"]) == 9 and sum(s["so_binh_luan"] for s in d["spine"]) == 23


@pytest.mark.parametrize("sort", ["hay_nhat", "moi_nhat", "cu_nhat"])
def test_khan_dai_ba_sort_deu_cung_so_query(client, seed, django_assert_num_queries, sort):
    """Ba sort phải cùng một chi phí: sort là việc của Python, không phải của SQL."""
    with django_assert_num_queries(SO_QUERY["khan_dai"]):
        d = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort={sort}&limit=50")
    assert len(phang(d["threads"])) == 24


def test_ngan_keo(client, seed, django_assert_num_queries):
    moc = Moc.objects.get(mach=seed, seq=2)
    with django_assert_num_queries(SO_QUERY["ngan_keo"]):
        d = lay(client, f"/api/v1/mocs/{moc.pk}/comments")
    assert len(phang(d["threads"])) == 5


def test_revisions(client, seed, django_assert_num_queries):
    moc = Moc.objects.get(mach=seed, seq=2)
    with django_assert_num_queries(SO_QUERY["revisions"]):
        lay(client, f"/api/v1/mocs/{moc.pk}/revisions")


@pytest.mark.parametrize("duong", ["moi", "dang-dien-ra"])
def test_feed(client, seed, seed_post_thuong, django_assert_num_queries, duong):
    with django_assert_num_queries(SO_QUERY["feed"]):
        d = lay(client, f"/api/v1/feeds/{duong}?limit=50")
    assert d["items"], "feed rỗng thì không đo được N+1 của sub/author"
    # `sub` và `author` của MỖI thẻ đều được đọc ra: thiếu `select_related` là 2 truy vấn
    # cho mỗi hàng, và con số ghim ở trên sẽ đỏ.
    assert all(m["sub"]["ten"] and m["author"]["username"] for m in d["items"])


def test_feed_co_loc_sub_ton_dung_them_MOT_query(client, seed, django_assert_num_queries):
    """Truy vấn thứ hai là phép kiểm "sub có tồn tại không" — trả 404 thay vì feed rỗng."""
    with django_assert_num_queries(SO_QUERY["feed_co_sub"]):
        lay(client, "/api/v1/feeds/moi?sub=chung-khoan&limit=50")


def test_ho_so(client, seed, django_assert_num_queries):
    with django_assert_num_queries(SO_QUERY["ho_so"]):
        d = lay(client, "/api/v1/users/ba_muoi_phien")
    assert d["so_moc"] == 9 and d["machs"]


def test_them_binh_luan_KHONG_lam_tang_so_query(
    client, seed, nguoi_khac, django_assert_num_queries
):
    """Bài đo chống-rỗng cho cả file: số truy vấn phải ĐỘC LẬP với số hàng.

    Ghim một con số trên một tập dữ liệu cố định vẫn xanh nếu cài đặt là N+1 và N tình cờ
    khớp. Ở đây số bình luận tăng gần gấp đôi (24 → 44) mà con số ghim không được nhúc
    nhích — đó mới là định nghĩa của "không N+1".

    Số hàng `Trich` cũng tăng 1 → 9 vì truy vấn thứ ba của hai endpoint bình luận
    (`tap_tung_duoc_trich`, Z1) đọc bảng đó: một cài đặt "tra `Trich` cho từng bình luận"
    trông y hệt cài đặt đúng khi cả mạch chỉ có một hàng trích.
    """
    goc = list(Comment.objects.filter(mach=seed, parent__isnull=True))[:10]
    them = []
    for i, cha in enumerate(goc):
        viet(seed, nguoi_khac, f"Reply thêm {i}", parent=cha)
        them.append(viet(seed, nguoi_khac, f"Thread thêm {i}", anchor=1))
    seed.refresh_from_db()
    assert Comment.objects.filter(mach=seed).count() == 44

    # Mỗi mốc tối đa 1 trích đang hiệu lực (PLAN 5.6 rào 1), nên trải ra 8 mốc còn trống.
    da_trich = set(
        Trich.objects.filter(moc__mach=seed).values_list("moc_id", flat=True)
    )
    for moc, c in zip(
        [m for m in Moc.objects.filter(mach=seed) if m.pk not in da_trich], them
    ):
        Trich.objects.create(moc=moc, comment=c)
    assert Trich.objects.filter(comment__mach=seed).count() == 9

    with django_assert_num_queries(SO_QUERY["xem_mach"]):
        lay(client, f"/api/v1/machs/{seed.pk}")
    with django_assert_num_queries(SO_QUERY["khan_dai"]):
        d = lay(client, f"/api/v1/machs/{seed.pk}/comments?limit=50")
    assert len(phang(d["threads"])) == 44

    moc1 = Moc.objects.get(mach=seed, seq=1)
    with django_assert_num_queries(SO_QUERY["ngan_keo"]):
        lay(client, f"/api/v1/mocs/{moc1.pk}/comments")


def test_them_mach_KHONG_lam_tang_so_query_cua_feed(
    client, seed, tac_gia, django_assert_num_queries
):
    for i in range(20):
        tao_mach(sub=seed.sub, author=tac_gia, title=f"Mạch phụ {i}", body="Mốc 1.")
    assert Mach.objects.count() >= 22

    with django_assert_num_queries(SO_QUERY["feed"]):
        d = lay(client, "/api/v1/feeds/moi?limit=50")
    assert len(d["items"]) >= 22


# --- ba cửa danh sách của trang hồ sơ (2026-08-24) ---------------------------


def _machs_cua(sub, author, so_luong: int, *, tu: int = 0) -> list[Mach]:
    return [
        tao_mach(sub=sub, author=author, title=f"Mạch {i}", body="Mốc 1.")[0]
        for i in range(tu, tu + so_luong)
    ]


def _vote_moc_1(machs, nguoi) -> None:
    for m in machs:
        dat_vote(user=nguoi, target=Moc.objects.get(mach=m, seq=1), value=1)


def _the_du_sub_va_author(d) -> bool:
    """`sub` và `author` của MỖI thẻ đều được đọc ra — thiếu `select_related` là 2 truy
    vấn cho mỗi hàng, và con số ghim ở đầu file đỏ ngay."""
    return bool(d["items"]) and all(
        m["sub"]["ten"] and m["author"]["username"] for m in d["items"]
    )


def test_mach_cua_user(client, sub, tac_gia, django_assert_num_queries):
    _machs_cua(sub, tac_gia, 3)

    with django_assert_num_queries(SO_QUERY["mach_cua_user"]):
        d = lay(client, f"/api/v1/users/{tac_gia.username}/machs?limit=50")

    assert len(d["items"]) == 3 and _the_du_sub_va_author(d)


def test_da_vote(client, sub, tac_gia, nguoi_khac, django_assert_num_queries):
    _vote_moc_1(_machs_cua(sub, tac_gia, 3), nguoi_khac)
    client.force_login(nguoi_khac)

    with django_assert_num_queries(SO_QUERY["da_vote"]):
        d = lay(client, "/api/v1/me/da-vote?limit=50")

    assert len(d["items"]) == 3 and _the_du_sub_va_author(d)


def test_dang_theo(client, sub, tac_gia, nguoi_khac, django_assert_num_queries):
    for m in _machs_cua(sub, tac_gia, 3):
        Follow.objects.create(user=nguoi_khac, mach=m)
    client.force_login(nguoi_khac)

    with django_assert_num_queries(SO_QUERY["dang_theo"]):
        d = lay(client, "/api/v1/me/dang-theo?limit=50")

    assert len(d["items"]) == 3 and _the_du_sub_va_author(d)


def test_them_mach_KHONG_lam_tang_so_query_cua_ba_cua(
    client, sub, tac_gia, nguoi_khac, django_assert_num_queries
):
    """Bài đo chống-rỗng của ba cửa hồ sơ: số truy vấn phải ĐỘC LẬP với số hàng.

    Ba con số ở đầu file được ghim trên 3 mạch. Ghim một hằng số trên 3 hàng vẫn xanh nếu
    cài đặt là N+1 và N tình cờ khớp — nhất là ở `da_vote`, nơi đường ghép phiếu → mạch
    **không** `select_related` được và vì thế là chỗ tự nhiên nhất để một vòng lặp truy
    vấn chui vào. Ở đây số hàng tăng 3 → 23 mà cả ba con số không được nhúc nhích.
    """
    machs = _machs_cua(sub, tac_gia, 23)
    _vote_moc_1(machs, nguoi_khac)
    for m in machs:
        Follow.objects.create(user=nguoi_khac, mach=m)
    assert Mach.objects.filter(author=tac_gia).count() == 23

    with django_assert_num_queries(SO_QUERY["mach_cua_user"]):
        d = lay(client, f"/api/v1/users/{tac_gia.username}/machs?limit=50")
    assert len(d["items"]) == 23

    client.force_login(nguoi_khac)
    with django_assert_num_queries(SO_QUERY["da_vote"]):
        d = lay(client, "/api/v1/me/da-vote?limit=50")
    assert len(d["items"]) == 23
    with django_assert_num_queries(SO_QUERY["dang_theo"]):
        d = lay(client, "/api/v1/me/dang-theo?limit=50")
    assert len(d["items"]) == 23


# --- avatar_url của author KHÔNG được thêm truy vấn (2026-08-24) --------------


def test_avatar_cua_author_KHONG_lam_tang_so_query(
    client, seed, seed_post_thuong, django_assert_num_queries
):
    """`avatar_url` là `url_thumb(user.avatar_khoa)` THUẦN — không truy vấn.

    Bài đo này **chỉ đo được khi author CÓ avatar**: cột rỗng thì resolver trả `None` mà
    không chạm `url_thumb`, nên một cài đặt "hỏi DB cho mỗi avatar" vẫn ẩn. Vì thế phải
    đặt `avatar_khoa` cho MỌI user TRƯỚC khi đo. `avatar_khoa` là cột đã
    `select_related("author")`/`select_related("sub", "author")` nạp sẵn, nên số truy vấn
    của feed / trang mạch / hồ sơ phải Y NGUYÊN con số ghim ở đầu file.

    Đổi resolver `nguoi_dung_ra` cho nó đi hỏi DB mỗi author là ĐỎ ngay ở đây — thử phá đã
    xác nhận (feed 3 → 25, xem_mach 6 → 15).
    """
    from core.models import User

    User.objects.update(avatar_khoa="a" * 32 + ".webp")

    with django_assert_num_queries(SO_QUERY["xem_mach"]):
        d = lay(client, f"/api/v1/machs/{seed.pk}")
    tac_gia_hien = [m["author"] for m in d["mocs"] if m["author"]]
    assert tac_gia_hien and all(a["avatar_url"] for a in tac_gia_hien)

    with django_assert_num_queries(SO_QUERY["feed"]):
        d = lay(client, "/api/v1/feeds/moi?limit=50")
    assert d["items"] and all(m["author"]["avatar_url"] for m in d["items"])

    with django_assert_num_queries(SO_QUERY["ho_so"]):
        d = lay(client, "/api/v1/users/ba_muoi_phien")
    # `HoSoOut.avatar_url` là avatar của chính chủ hồ sơ (không lồng trong `author`), và
    # mỗi thẻ mạch kèm theo cũng mang `author.avatar_url`.
    assert d["avatar_url"] and all(m["author"]["avatar_url"] for m in d["machs"])
