"""R10 — nội dung mang `hidden_at` **không được lọt ra API công khai**. PLAN 5.10, mục 6.

Đây là loại lỗi mà repo đã gặp hai lần ở 1a: hỏng thì **không có gì đỏ**. Mod bấm ẩn, DB
ghi `hidden_at`, trang vẫn trả 200 — chỉ khác ở chỗ nội dung vẫn nằm nguyên trong JSON.
Không exception, không log.

Vì thế các bài đo dưới đây **không kiểm cờ, chúng kiểm CHUỖI**: lấy mọi giá trị chuỗi
trong response rồi đòi rằng nguyên văn nội dung bị ẩn không nằm trong đó. Một cài đặt
đặt đúng cờ `trang_thai = "da_an"` mà quên xoá `body` sẽ đỏ ở đây, trong khi bài đo kiểu
"assert trang_thai == 'da_an'" thì xanh.
"""

import pytest
from django.utils import timezone

from core.models import Comment, Mach, Moc, Trich
from tests.conftest import lay, moi_chuoi, phang, viet

pytestmark = pytest.mark.django_db

BI_AN = "NOI DUNG BI MOD AN KHONG DUOC LO"


def khong_lo(du_lieu, chuoi: str = BI_AN) -> bool:
    return all(chuoi not in s for s in moi_chuoi(du_lieu))


def test_moc_bi_an_khong_lo_body_qua_trang_mach(client, seed):
    Moc.objects.filter(mach=seed, seq=4).update(
        hidden_at=timezone.now(), body=BI_AN, question_for_crowd=BI_AN, loai="ẩn"
    )
    d = lay(client, f"/api/v1/machs/{seed.pk}")

    assert khong_lo(d)
    assert d["mocs"][3]["trang_thai"] == "da_an"
    assert len(d["spine"]) == 9, "vẫn giữ chỗ trên spine (PLAN 5.2)"


def test_moc_bi_an_khong_lo_cau_moi_qua_ngan_keo(client, seed):
    moc = Moc.objects.get(mach=seed, seq=6)
    Moc.objects.filter(pk=moc.pk).update(hidden_at=timezone.now(), question_for_crowd=BI_AN)

    d = lay(client, f"/api/v1/mocs/{moc.pk}/comments")
    assert khong_lo(d)
    assert d["question_for_crowd"] is None


def test_binh_luan_bi_an_bien_mat_khoi_khan_dai(client, seed):
    """Bình luận bị ẩn KHÔNG có hậu duệ ⇒ biến mất hẳn, không để lại bia mộ."""
    c = Comment.objects.filter(mach=seed, parent__isnull=True, replies__isnull=True).first()
    Comment.objects.filter(pk=c.pk).update(hidden_at=timezone.now(), body=BI_AN)

    d = lay(client, f"/api/v1/machs/{seed.pk}/comments?limit=50")
    assert khong_lo(d)
    assert c.pk not in [t["id"] for t in phang(d["threads"])]


def test_binh_luan_bi_an_CO_reply_thi_thanh_bia_mo_khong_noi_dung(
    client, mach, tac_gia, nguoi_khac
):
    """Giữ chỗ để nhánh con không rơi mất cha, nhưng không giữ lại chữ nào."""
    cha = viet(mach, nguoi_khac, BI_AN, up=9)
    con = viet(mach, tac_gia, "Reply còn đọc được", parent=cha)
    Comment.objects.filter(pk=cha.pk).update(hidden_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{mach.pk}/comments")
    (nut,) = d["threads"]

    assert khong_lo(d)
    assert nut["trang_thai"] == "da_an"
    assert nut["author"] is None and nut["body"] is None
    assert (nut["up_count"], nut["down_count"]) == (0, 0)
    assert [r["id"] for r in nut["replies"]] == [con.pk]


def test_binh_luan_bi_an_khong_lo_qua_ngan_keo(client, seed):
    c = Comment.objects.filter(
        mach=seed, parent__isnull=True, anchor_moc_seq=5, replies__isnull=True
    ).first()
    Comment.objects.filter(pk=c.pk).update(hidden_at=timezone.now(), body=BI_AN)

    moc = Moc.objects.get(mach=seed, seq=5)
    assert khong_lo(lay(client, f"/api/v1/mocs/{moc.pk}/comments"))


def test_binh_luan_bi_an_khong_lo_qua_khoi_TRICH(client, seed):
    """Cửa hậu dễ quên nhất: blockquote trích in nguyên văn bình luận vào thẻ mốc.

    PLAN 5.6 gọi sổ là "không-xoá-được", nên rất tự nhiên để nghĩ khối trích miễn nhiễm
    với mọi thứ. Nhưng "không xoá được bởi TÁC GIẢ" khác "không gỡ được bởi MOD" —
    moderation phải thắng, nếu không thì ẩn một bình luận ở khán đài mà nó vẫn nằm chình
    ình trên thân mốc.
    """
    trich = Trich.objects.get(moc__mach=seed, removed_at__isnull=True)
    Comment.objects.filter(pk=trich.comment_id).update(
        hidden_at=timezone.now(), body=BI_AN
    )

    d = lay(client, f"/api/v1/machs/{seed.pk}")
    assert khong_lo(d)
    assert [m["trich"] for m in d["mocs"]] == [None] * 9


def goc_khong_reply(c: Comment) -> bool:
    """Bình luận này là GỐC và chưa ai reply — tức chỉ vế "đã từng được trích" giữ nổi nó."""
    return c.parent_id is None and not Comment.objects.filter(parent=c).exists()


def nha_cua(client, mach: Mach, c: Comment) -> list[dict]:
    """Mọi nút của khu **DUY NHẤT** mà thread của `c` được render — *2026-08-26*.

    Từ lượt tách bình luận chung khỏi bình luận mốc, một thread có đúng MỘT nhà: khán đài
    nếu gốc không neo, ngăn kéo mốc `anchor_moc_seq` nếu có neo
    (`api/machs.py::liet_ke_binh_luan_mach`). Trước đó bình luận neo hiện ở CẢ HAI, nên
    những bài đo dưới đây hỏi thẳng khán đài và không cần biết neo là gì.

    Hàm này hỏi đúng câu *"bình luận còn chỗ đứng nào trên trang không"* — câu mà mọi bài
    đo bia mộ ở dưới thật sự muốn hỏi. Ghim cứng vào khán đài thì từ nay chúng đo mỗi
    phép lọc mới, không còn đo luật giữ bia mộ.
    """
    if c.anchor_moc_seq is None:
        d = lay(client, f"/api/v1/machs/{mach.pk}/comments?limit=50")
    else:
        moc = Moc.objects.get(mach=mach, seq=c.anchor_moc_seq)
        d = lay(client, f"/api/v1/mocs/{moc.pk}/comments")
    return phang(d["threads"])


def test_binh_luan_TAC_GIA_TU_XOA_van_giu_blockquote_trong_so(client, seed):
    """Đối chứng cho bài trên, và là một quyết định có chủ đích của 1b.

    Tác giả tự xoá bình luận **không** rút được chữ ra khỏi sổ: PLAN 5.6 chốt người bình
    luận "được ghi tên vào cuốn sổ không-xoá-được", và `Trich.comment = PROTECT` ở tầng
    DB nói đúng điều đó. Khối trích ở lại kèm `trang_thai = "da_xoa"` để 1c render được
    sự thật "câu này đã bị tác giả xoá ở khán đài".

    **Mở rộng 2026-08-22 (Z1).** Bản đầu chỉ ngó khối trích ở `GET /machs/{id}` nên nó
    **đi ngang qua** một bug thật: `r7` của seed là bình luận GỐC không reply nào, mà tầng
    đọc lúc đó chỉ có MỘT điều kiện giữ bia mộ ("còn hậu duệ"). Tác giả bấm xoá ⇒ khối
    trích vẫn hiện đẹp trên thẻ mốc, nhưng `comment_id` của nó trỏ vào một bình luận
    **không tồn tại ở bất kỳ response nào** — nút "nhảy tới khán đài" của 1c thành link
    chết, HTTP 200, không log. Vì thế bài này nay kiểm CẢ HAI đầu của liên kết.
    """
    trich = Trich.objects.get(moc__mach=seed, removed_at__isnull=True)
    c = trich.comment
    assert goc_khong_reply(c), (
        "seed phải giữ bình luận được trích là GỐC KHÔNG REPLY; nếu không, bài đo này "
        "chỉ đo lại vế 'có reply con' và vế 'đã TỪNG được trích' không chạy qua"
    )
    Comment.objects.filter(pk=c.pk).update(deleted_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{seed.pk}")
    khoi = next(m["trich"] for m in d["mocs"] if m["trich"])
    assert khoi["trang_thai"] == "da_xoa"
    assert khoi["body"] == c.body

    # Đầu kia của liên kết: bia mộ phải có mặt ở **nhà của nó**. `r7` neo mốc, nên từ
    # 2026-08-26 nhà ấy là ngăn kéo chứ không còn là khán đài — xem `nha_cua`.
    assert c.anchor_moc_seq is not None, (
        "seed phải giữ bình luận được trích ở trạng thái CÓ NEO; hết neo thì bài đo này "
        "không còn đi qua đường ngăn kéo, tức đo lại đúng đường cũ"
    )
    bia = [t for t in nha_cua(client, seed, c) if t["id"] == khoi["comment_id"]]
    assert bia, "khối trích trỏ vào một bình luận không có mặt ở chỗ nào trên trang"
    assert bia[0]["trang_thai"] == "da_xoa"
    assert bia[0]["body"] is None and bia[0]["author"] is None

    # Và nó KHÔNG được hiện thêm một lần nữa ở khán đài: thread neo có đúng một nhà.
    kd = lay(client, f"/api/v1/machs/{seed.pk}/comments?limit=50")
    assert khoi["comment_id"] not in [t["id"] for t in phang(kd["threads"])]


def test_TRICH_DA_GO_van_giu_bia_mo_khi_tac_gia_tu_xoa(client, seed):
    """PLAN 5.3 dòng 175 viết "kể cả trích **đã gỡ**" — chữ "đã TỪNG" là cố ý.

    Lọc `removed_at IS NULL` khi dựng tập "đã từng được trích" là đọc thành "đang được
    trích", và nó đá thẳng vào `Trich.comment = PROTECT`: `PROTECT` không biết `removed_at`
    là gì, nó chặn mọi hàng `Trich` còn tồn tại. Hai bên đọc lệch nhau thì
    `DELETE /comments/{id}` của Phase 2 kết luận "xoá thật được" rồi ăn `ProtectedError`
    → 500 trên thao tác hợp lệ của chính chủ.
    """
    trich = Trich.objects.get(moc__mach=seed, removed_at__isnull=True)
    c = trich.comment
    assert goc_khong_reply(c)
    Trich.objects.filter(pk=trich.pk).update(removed_at=timezone.now())
    Comment.objects.filter(pk=c.pk).update(deleted_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{seed.pk}")
    assert [m["trich"] for m in d["mocs"]] == [None] * 9, "trích đã gỡ thì không hiện"

    bia = [t for t in nha_cua(client, seed, c) if t["id"] == c.pk]
    assert bia and bia[0]["trang_thai"] == "da_xoa"
    assert bia[0]["body"] is None


def test_binh_luan_DA_TUNG_TRICH_ma_bi_MOD_AN_thi_VAN_bien_mat(client, seed):
    """Ranh giới của Z1: vế "đã từng được trích" **không** áp cho `hidden_at`.

    Nó là luật chống *tác giả* rút chữ ra khỏi sổ (PLAN 5.6), không phải giấy phép cho
    nội dung mod vừa gỡ ở lại khán đài. `trich_ra` đã gỡ hẳn khối trích khỏi thẻ mốc
    trong ca này, nên giữ bia mộ ở khán đài là giữ chỗ cho một liên kết không còn đầu
    kia — và tệ hơn: nó nói cho cả internet biết chính xác thứ vừa bị ẩn nằm ở đâu.
    """
    trich = Trich.objects.get(moc__mach=seed, removed_at__isnull=True)
    c = trich.comment
    assert goc_khong_reply(c)
    moc = Moc.objects.get(mach=seed, seq=c.anchor_moc_seq)
    # Đo TRƯỚC để con số "mất hẳn một thread" là một hiệu số thật, không phải hằng gõ tay.
    truoc = lay(client, f"/api/v1/mocs/{moc.pk}/comments")["threads"]

    Comment.objects.filter(pk=c.pk).update(hidden_at=timezone.now(), body=BI_AN)

    d = lay(client, f"/api/v1/machs/{seed.pk}")
    assert khong_lo(d)
    assert [m["trich"] for m in d["mocs"]] == [None] * 9

    kd = lay(client, f"/api/v1/machs/{seed.pk}/comments?limit=50")
    assert khong_lo(kd)
    assert c.pk not in [t["id"] for t in phang(kd["threads"])]

    nk = lay(client, f"/api/v1/mocs/{moc.pk}/comments")
    assert khong_lo(nk)
    assert c.pk not in [t["id"] for t in phang(nk["threads"])]
    assert len(nk["threads"]) == len(truoc) - 1, (
        "mất hẳn một thread gốc khỏi ngăn kéo, không để lại bia mộ"
    )


def test_mach_bi_an_bien_mat_khoi_moi_cua(client, seed):
    """SÁU cửa cùng lúc: feed, trang mạch, khán đài, ngăn kéo, revisions, hồ sơ.

    Cửa feed từng được canh bằng `!= [seed.pk]`, và phép so đó **rỗng**: seed có 2 mạch,
    nên bỏ hẳn bộ lọc `hidden_at` cũng cho `[post_thuong.pk, seed.pk] != [seed.pk]` ⇒
    đúng ở cả hai thế giới. `not in` mới là câu hỏi đang cần hỏi.
    """
    moc = Moc.objects.get(mach=seed, seq=2)
    Mach.objects.filter(pk=seed.pk).update(hidden_at=timezone.now())

    lay(client, f"/api/v1/machs/{seed.pk}", status=404)
    lay(client, f"/api/v1/machs/{seed.pk}/comments", status=404)
    lay(client, f"/api/v1/mocs/{moc.pk}/comments", status=404)
    lay(client, f"/api/v1/mocs/{moc.pk}/revisions", status=404)
    assert seed.pk not in [
        m["id"] for m in lay(client, "/api/v1/feeds/moi?limit=50")["items"]
    ]
    assert lay(client, "/api/v1/users/ba_muoi_phien")["machs"] == []


def test_bai_do_khong_lo_that_su_bat_duoc_chuoi(client, seed):
    """Đối chứng dương cho `khong_lo`: nó phải ĐỎ khi chuỗi thật sự nằm trong response.

    Không có bài này thì `moi_chuoi` có thể trả `[]` và toàn bộ file trên xanh vĩnh viễn.
    """
    Moc.objects.filter(mach=seed, seq=4).update(body=BI_AN)
    assert not khong_lo(lay(client, f"/api/v1/machs/{seed.pk}"))
