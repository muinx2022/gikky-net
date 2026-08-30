"""Index `binh_luan` — **lớp MỘT** của luật che (S2 của plan 2026-08-30).

Bộ này hỏi đúng một câu: *sau thao tác X, tài liệu nào còn nằm trong index?* Nó chạy trên
`tests/_meili_gia.py` — một Meilisearch giả **có trạng thái** — chứ không trên mock lời
gọi, vì lý do ghi ở docstring file ấy.

## Vì sao lớp một phải có bài đo riêng, dù lớp hai đã che

`api/tim_kiem.py` lọc lại mọi id qua Postgres, nên **kết quả endpoint vẫn sạch kể cả khi
đường gỡ index hỏng hoàn toàn**. Một bài đo chỉ nhìn endpoint sẽ XANH VĨNH VIỄN — đúng
loài "proof đo RỖNG" mà repo đã dính một lần (`D:/Projects/CLAUDE.md`, đợt 2026-08-13), và
`test_tim_kiem_that.py::test_mod_an_mach_thi_bien_khoi_ket_qua…` đã phải học lại bài đó
một lần rồi. Đây là con mắt nhìn được lớp một, và nó chạy trên **mọi** máy (không cần
Meilisearch thật).

## `transaction=True` là bắt buộc

Mọi thứ ở đây đi qua `transaction.on_commit`. Trong `django_db` thường, transaction không
bao giờ commit nên `on_commit` **không chạy** và cả file xanh mà không đo gì.
"""

import pytest

from core.ghi import (
    dat_an_binh_luan,
    dat_an_mach,
    sua_binh_luan,
    tao_binh_luan,
    them_moc,
    xoa_binh_luan,
)
from core.models.binh_luan import Comment
from core.tim_kiem import (
    TEN_INDEX,
    TEN_INDEX_BINH_LUAN,
    hien_cong_khai_binh_luan,
)

from ._meili_gia import gan
from .conftest import viet

pytestmark = pytest.mark.django_db(transaction=True)


@pytest.fixture
def meili(monkeypatch, settings):
    return gan(monkeypatch, settings)


@pytest.fixture
def mach_a(sub, nguoi_a):
    from core.ghi import tao_mach

    m, _ = tao_mach(
        sub=sub,
        author=nguoi_a,
        title="Nhật ký lệnh HPG",
        body="<p>Mua HPG vùng giá 26.</p>",
    )
    return m


# --- ĐẨY: bình luận mới vào index -------------------------------------------


def test_binh_luan_moi_vao_index(meili, mach_a, nguoi_b):
    c = viet(mach_a, nguoi_b, "Chốt lời ở 28 là hợp lý.")
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {c.pk}


def test_tai_lieu_mang_du_truong_va_KHONG_mang_the_html(meili, mach_a, nguoi_b):
    """`body_thuan`, không phải `body` thô — cùng ba lý lẽ với `_than_theo_moc`.

    Bình luận có HAI định dạng (`body_dinh_dang`), nên đây là chỗ dễ đẩy nhầm HTML nhất
    của cả hệ: đường ghi `html` đã sanitize, tức chuỗi trong DB là HTML **hợp lệ** và
    trông vô hại.
    """
    c = tao_binh_luan(
        mach=mach_a,
        author=nguoi_b,
        body="<p>Chốt lời <strong>HPG</strong> ở 28.</p>",
        dinh_dang="html",
    )
    d = meili.tai_lieu(TEN_INDEX_BINH_LUAN, c.pk)
    assert d is not None
    assert "<" not in d["body_thuan"], d["body_thuan"]
    assert d["body_thuan"] == "Chốt lời HPG ở 28."
    assert d["mach_id"] == mach_a.pk
    assert d["author"] == nguoi_b.username
    assert d["hien"] is True


def test_khong_cau_hinh_meili_thi_khong_goi_gi(monkeypatch, settings, sub, nguoi_a):
    """Clone sạch: `MEILI_URL` rỗng ⇒ đường ghi im lặng, không ném, không gọi.

    Đây là trạng thái mặc định của `.env.example`, nên nó phải là trạng thái **an toàn**:
    viết một bình luận trên máy vừa dựng xong không được chết vì chưa ai cài Meilisearch.
    """
    from core.ghi import tao_mach

    gia = gan(monkeypatch, settings)
    settings.MEILI_URL = ""
    m, _ = tao_mach(sub=sub, author=nguoi_a, title="T", body="Thân.")
    viet(m, nguoi_a, "Một câu.")
    assert gia.nhat_ky == []


# --- SỬA: index phải mang bản MỚI -------------------------------------------


def test_sua_binh_luan_cap_nhat_index(meili, mach_a, nguoi_b):
    """Không đẩy lại là index giữ nguyên văn bản CŨ — tìm ra một câu đã bị sửa đi."""
    c = viet(mach_a, nguoi_b, "Mua ở 26.")
    sua_binh_luan(comment=c, body="Thật ra tôi mua ở 27.")
    d = meili.tai_lieu(TEN_INDEX_BINH_LUAN, c.pk)
    assert d["body_thuan"] == "Thật ra tôi mua ở 27."


# --- MA TRẬN CHE: bốn trục, mỗi trục một bài --------------------------------


def test_bia_mo_roi_khoi_index(meili, mach_a, nguoi_a, nguoi_b):
    """Tác giả xoá bình luận CÒN REPLY ⇒ hàng ở lại Postgres, tài liệu phải rời index.

    Đây là ca mà "còn hàng trong DB" và "được hiện" tách nhau ra. Một đường gỡ index viết
    theo kiểu "hàng còn thì upsert" sẽ giữ nguyên văn câu vừa xoá, vĩnh viễn.
    """
    goc = viet(mach_a, nguoi_b, "Câu gốc sẽ bị xoá.")
    viet(mach_a, nguoi_a, "Trả lời.", parent=goc)
    assert goc.pk in meili.ids(TEN_INDEX_BINH_LUAN)

    xoa_binh_luan(comment=goc)
    goc.refresh_from_db()
    assert goc.deleted_at is not None, "ca này phải là BIA MỘ, không phải xoá thật"
    assert goc.pk not in meili.ids(TEN_INDEX_BINH_LUAN)


def test_xoa_that_cung_roi_khoi_index(meili, mach_a, nguoi_b):
    """Xoá THẬT (không reply, chưa từng trích) — nhánh mà `c.delete()` đặt `pk = None`.

    Bẫy có thật: gọi `dong_bo_binh_luan(c)` **sau** `c.delete()` là xếp hàng xoá tài liệu
    id `None`, tức tài liệu thật ở lại index và không có gì đỏ ở đường ghi.
    """
    c = viet(mach_a, nguoi_b, "Câu sẽ bị xoá hẳn.")
    ma = c.pk
    assert xoa_binh_luan(comment=c) is True, "ca này phải là xoá THẬT"
    assert not Comment.objects.filter(pk=ma).exists()
    assert ma not in meili.ids(TEN_INDEX_BINH_LUAN)


def test_mod_an_binh_luan_roi_khoi_index_va_go_an_thi_quay_lai(
    meili, mach_a, nguoi_a, nguoi_b
):
    """Vòng đủ HAI chiều. Chiều "quay lại" quan trọng ngang chiều "biến mất": gỡ ẩn mà
    không dựng lại là mod đã xoá vĩnh viễn một câu khỏi tìm kiếm bằng một thao tác họ tin
    là đảo ngược được."""
    c = viet(mach_a, nguoi_b, "Câu bị mod ẩn.")
    dat_an_binh_luan(comment=c, boi=nguoi_a, an=True, ly_do="thử")
    assert c.pk not in meili.ids(TEN_INDEX_BINH_LUAN)

    dat_an_binh_luan(comment=c, boi=nguoi_a, an=False)
    assert c.pk in meili.ids(TEN_INDEX_BINH_LUAN)


def test_an_mach_go_CA_LO_binh_luan_va_go_an_thi_day_lai(
    meili, mach_a, nguoi_a, nguoi_b
):
    """**Vế thứ ba** — vế không nằm trên hàng `Comment` nào, và là cả lý do của cascade.

    Ba bình luận, một thao tác: mod ẩn mạch. Không có cascade thì cả ba nằm lại trong
    index nguyên văn, và `dat_an_binh_luan` không bao giờ được gọi cho chúng.
    """
    cs = [viet(mach_a, nguoi_b, f"Câu số {i}.") for i in range(3)]
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {c.pk for c in cs}

    dat_an_mach(mach=mach_a, boi=nguoi_a, an=True, ly_do="thử")
    assert meili.ids(TEN_INDEX_BINH_LUAN) == set(), (
        "mạch bị ẩn mà bình luận của nó vẫn nằm trong index — vế thứ ba của luật che thủng"
    )
    assert meili.ids(TEN_INDEX) == set(), "tài liệu mạch cũng phải biến mất"

    dat_an_mach(mach=mach_a, boi=nguoi_a, an=False)
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {c.pk for c in cs}
    assert meili.ids(TEN_INDEX) == {mach_a.pk}


def test_go_an_mach_KHONG_hoi_sinh_binh_luan_van_dang_bi_an(
    meili, mach_a, nguoi_a, nguoi_b
):
    """Hai trục ẩn độc lập nhau, và cascade không được xoá nhoà điều đó.

    Mod ẩn một bình luận, rồi ẩn cả mạch, rồi gỡ ẩn mạch. Lượt đẩy lại theo lô **không**
    được mang câu vẫn đang bị ẩn riêng quay về — nếu có, gỡ ẩn một mạch trở thành cách gỡ
    ẩn mọi bình luận trong đó, im lặng.
    """
    thuong = viet(mach_a, nguoi_b, "Câu bình thường.")
    bi_an = viet(mach_a, nguoi_b, "Câu bị ẩn riêng.")
    dat_an_binh_luan(comment=bi_an, boi=nguoi_a, an=True, ly_do="thử")

    dat_an_mach(mach=mach_a, boi=nguoi_a, an=True, ly_do="thử")
    dat_an_mach(mach=mach_a, boi=nguoi_a, an=False)

    assert meili.ids(TEN_INDEX_BINH_LUAN) == {thuong.pk}


def test_cascade_xoa_theo_LO_chu_khong_phai_tung_cai(meili, mach_a, nguoi_a, nguoi_b):
    """Ẩn mạch có 5 bình luận ⇒ **một** lời gọi xoá-theo-filter, không phải năm.

    Không có bài này thì một bản cài "vòng lặp gọi `dong_bo_binh_luan` từng cái" cũng
    xanh ở mọi bài trên — và nó là N lời gọi HTTP đồng bộ trong `on_commit` của một
    request thật, trên một mạch có thể có hàng nghìn bình luận.
    """
    for i in range(5):
        viet(mach_a, nguoi_b, f"Câu {i}.")
    truoc = len(meili.nhat_ky)

    dat_an_mach(mach=mach_a, boi=nguoi_a, an=True, ly_do="thử")

    sau = meili.nhat_ky[truoc:]
    xoa_lo = [d for m, d in sau if m == "POST" and d.endswith("/documents/delete")]
    assert len(xoa_lo) == 1, sau
    assert not [d for m, d in sau if m == "DELETE" and "/documents/" in d and "binh_luan" in d]


# --- ba vế của `hien_cong_khai_binh_luan`, đo trực tiếp ----------------------


@pytest.mark.parametrize(
    "dung_ca,mong",
    [
        ("khong_gi", True),
        ("xoa", False),
        ("an_cmt", False),
        ("an_mach", False),
    ],
)
def test_hien_cong_khai_binh_luan_du_ba_ve(
    meili, mach_a, nguoi_a, nguoi_b, dung_ca, mong
):
    """Bảng chân trị của chính hàm quyết định, tách khỏi mọi đường ghi.

    Có nó thì một lượt "dọn dẹp" bỏ vế thứ ba khỏi hàm sẽ đỏ **ở đây** với thông điệp nói
    thẳng ra vế nào mất, thay vì đỏ ở một bài cascade mà người sửa phải lần ngược.
    """
    c = viet(mach_a, nguoi_b, "Một câu.")
    if dung_ca == "xoa":
        viet(mach_a, nguoi_a, "reply giữ chỗ", parent=c)
        xoa_binh_luan(comment=c)
    elif dung_ca == "an_cmt":
        dat_an_binh_luan(comment=c, boi=nguoi_a, an=True, ly_do="thử")
    elif dung_ca == "an_mach":
        dat_an_mach(mach=mach_a, boi=nguoi_a, an=True, ly_do="thử")

    c = Comment.objects.select_related("mach").get(pk=c.pk)
    assert hien_cong_khai_binh_luan(c) is mong


# --- đường ghi MẠCH không được đụng index bình luận sai cách -----------------


def test_them_moc_khong_lam_mat_binh_luan_khoi_index(meili, mach_a, nguoi_a, nguoi_b):
    """Cascade chạy ở MỌI lượt `dong_bo_mach`, kể cả lượt không đổi trạng thái ẩn.

    Nhánh "mạch đang hiện" phải là **đẩy lại**, không phải "xoá rồi đẩy lại" — một bản
    cài xoá trước cho gọn sẽ để index rỗng trong khoảng giữa hai lời gọi, và với
    Meilisearch (xử lý bất đồng bộ) thứ tự ấy không đảm bảo.
    """
    c = viet(mach_a, nguoi_b, "Câu phải sống sót.")
    them_moc(mach=mach_a, author=nguoi_a, body="<p>Mốc hai.</p>")
    assert meili.ids(TEN_INDEX_BINH_LUAN) == {c.pk}


def test_doi_ten_sub_KHONG_dung_index_binh_luan(meili, mach_a, nguoi_b):
    """Đổi `ten`/`slug` sub đẩy lại tài liệu MẠCH (`sub_ten` là trường tìm được), nhưng
    **KHÔNG được chạm index bình luận** — tài liệu bình luận không mang sub.

    Trước lượt vá, `dong_bo_theo_sub` → `_xep_hang_id` → `_dong_bo_ngay` chạy cascade như
    mọi đường ghi mạch, nên mỗi lần đổi tên một sub đẩy lại TOÀN BỘ bình luận của mọi mạch
    trong sub — có thể hàng nghìn tài liệu, cho một thay đổi không chạm bình luận nào.
    """
    from django.db import transaction

    from core.tim_kiem import dong_bo_theo_sub

    viet(mach_a, nguoi_b, "Câu nào đó.")
    truoc = len(meili.nhat_ky)
    with transaction.atomic():
        dong_bo_theo_sub(mach_a.sub)
    sau = meili.nhat_ky[truoc:]

    cham_binh_luan = [(m, d) for m, d in sau if "/indexes/binh_luan" in d]
    assert cham_binh_luan == [], (
        f"đổi tên sub đụng index bình luận (cascade thừa): {cham_binh_luan}"
    )
    # Sanity: tài liệu MẠCH có được đẩy lại — nếu không, bài xanh một cách rỗng tuếch.
    cham_mach = [(m, d) for m, d in sau if "/indexes/mach/documents" in d]
    assert cham_mach, "đổi tên sub phải đẩy lại tài liệu mạch (sub_ten đổi)"


def test_meili_chet_o_duong_ghi_binh_luan_KHONG_lam_hong_thao_tac(
    meili, mach_a, nguoi_b
):
    """Nuốt lỗi + log, y hệt `dong_bo_mach`. Trễ index là phiền; mất bình luận thì không.

    Ca mô phỏng đúng `P-20260827-2`: khoá phạm vi hẹp chưa được cấp quyền với index
    `binh_luan` ⇒ 403 cho mọi lời gọi.
    """
    meili.chan.add(TEN_INDEX_BINH_LUAN)
    c = viet(mach_a, nguoi_b, "Vẫn phải ghi được.")
    assert Comment.objects.filter(pk=c.pk).exists()
    assert meili.ids(TEN_INDEX_BINH_LUAN) == set()
