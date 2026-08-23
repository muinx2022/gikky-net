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

from core.ghi import tao_mach
from core.models import Comment, Mach, Moc, Trich
from tests.conftest import lay, phang, viet

pytestmark = pytest.mark.django_db

#: Số truy vấn kỳ vọng, viết cứng. Con số tăng lên là một quyết định phải nhìn thấy.
#:
#: `GET /machs/{id}` = 5: mạch (kèm sub + author) · mốc · đếm bình luận theo mốc · trích ·
#: **ảnh của mọi mốc** (Phase 5, 2026-08-23). Truy vấn ảnh là MỘT cho cả mạch rồi phát
#: theo `moc_id`, cùng lối `trich_theo_moc` — `m.anhs.all()` trong vòng lặp là N+1 trên
#: đúng endpoint nặng nhất (9 mốc = 9 truy vấn thừa mỗi lượt tải trang).
#: Hai endpoint bình luận = 3: đối tượng gốc · toàn bộ bình luận của mạch · **tập id
#: bình luận đã TỪNG được trích**. Truy vấn thứ ba vào ở đợt vá Z1 (2026-08-22): PLAN 5.3
#: dòng 175 có HAI điều kiện giữ bia mộ, và vế "đã từng được trích" không suy ra được từ
#: các hàng `Comment` đang có trong tay — xem `core.doc_noi_dung.tap_tung_duoc_trich`.
#: Nó là MỘT truy vấn cho cả mạch, không phải một truy vấn cho mỗi bình luận; hai bài
#: chống-rỗng ở cuối file là thứ chứng minh chỗ đó.
#: `/revisions` = 2: mốc · bản cũ.
#: Hồ sơ = 7: user · danh sách mạch · `moc_1_id` theo lô · 4 phép đếm trên 4 bảng.
#: Feed = 2: trang mạch · **`moc_1_id` theo lô**.
#:
#: Truy vấn `moc_1_id` vào ở **Phase 2**: thẻ feed cần `id` của mốc 1 làm đích cho mũi tên
#: vote (`POST /votes`). Nó là MỘT truy vấn cho cả trang, không phải một truy vấn mỗi thẻ
#: — và đó chính là thứ `test_them_mach_KHONG_lam_tang_so_query_cua_feed` ở cuối file
#: chứng minh: 22 thẻ vẫn đúng con số này.
SO_QUERY = {
    "xem_mach": 5,
    "khan_dai": 3,
    "ngan_keo": 3,
    "revisions": 2,
    "feed": 2,
    "feed_co_sub": 3,
    "ho_so": 7,
}


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
