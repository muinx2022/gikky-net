"""`TRICH_CON_HIEN` — bộ lọc "khối trích còn HIỆN", vá V1 (tiêu chí B1, B2).

Trước lượt vá, cùng một luật có **hai bản chép tay**: `api/users.py` lọc đủ năm cột, còn
`core.doc_noi_dung.tap_dang_duoc_trich` (nuôi khối "Câu đáng đọc" của PLAN 5.5) chỉ lọc
`removed_at`. Hệ quả nhìn thấy được: mod ẩn mốc 5 thì khối trích biến mất khỏi trang mạch
— **nhưng câu đó vẫn được kéo lên TRÊN CÙNG** khối "Câu đáng đọc". Nội dung mod vừa gỡ
leo lên đúng chỗ dễ thấy nhất, HTTP 200, không log, không bài đo nào đỏ.

File này ghim **cả bốn cửa** ở đường "câu đáng đọc" (cửa thứ năm — mạch bị mod ẩn — không
có đường API nào để đo vì trang mạch đã 404, nên nó được đo thẳng ở tầng hàm), và ghim
luôn sự khác biệt CỐ Ý còn lại: `comment__deleted_at` **không** nằm trong bộ lọc.

Dữ liệu dựng riêng chứ không dùng `seed`: ca cần một bình luận vừa **được trích**, vừa
**xếp ngoài top-10**, vừa **sống sót được khi bị mod ẩn** (tức có reply). `r7` của seed
thoả hai điều đầu nhưng không có reply — ẩn nó là nó biến mất khỏi cây vì luật bia mộ,
nên mọi mutant đều "đỏ" vì một lý do không liên quan gì tới bộ lọc đang đo.
"""

import pytest
from django.utils import timezone

from core.doc_noi_dung import TOP_CAU_DANG_DOC, TRICH_CON_HIEN, tap_dang_duoc_trich
from core.ghi import them_moc
from core.models import Comment, Mach, Moc, Trich
from tests.conftest import dung_user, lay, viet
from tests._an_mach import an_mach_tho

pytestmark = pytest.mark.django_db

#: Số thread gốc có phiếu, đủ để lấp kín top-10 và đẩy `bi_trich` ra ngoài.
SO_GOC_CO_PHIEU = 12


@pytest.fixture
def canh(mach, tac_gia):
    """Mạch 2 mốc · 12 thread có phiếu · 1 thread "bị_trích" 0 phiếu **có reply**.

    Trả `(mach, moc2, bi_trich)`. `bi_trich` xếp cuối theo wilson (0 phiếu ⇒ `0.0`) nên
    lý do DUY NHẤT nó có mặt trong "câu đáng đọc" là vế "đã trích" — đúng cái mà bộ lọc
    quyết định. Reply của nó là thứ giữ nó ở lại cây dưới dạng bia mộ khi mod ẩn nó, nếu
    không thì cây tự cắt và bài đo không còn phân biệt được nguyên nhân.
    """
    nguoi = dung_user("nguoi_binh_luan", "Người Bình Luận")
    for i in range(SO_GOC_CO_PHIEU):
        viet(mach, nguoi, f"Thread có phiếu số {i}", up=20 - i, down=0)
    bi_trich = viet(mach, nguoi, "Câu được chủ mạch ghi vào sổ.")
    viet(mach, nguoi, "Trả lời câu trên.", parent=bi_trich)

    moc2 = them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    Trich.objects.create(moc=moc2, comment=bi_trich)
    return mach, moc2, bi_trich


def ids_dang_doc(client, mach: Mach) -> list[int]:
    d = lay(client, f"/api/v1/machs/{mach.pk}/comments?dang_doc=1")
    return [t["id"] for t in d["threads"]]


def test_tien_de_bi_trich_nam_NGOAI_top_10_va_van_duoc_keo_len(client, canh):
    """Tiền đề của cả file: bỏ vế "đã trích" đi là `bi_trich` biến mất.

    Không có bài này thì bốn bài dưới xanh cả khi `cau_dang_doc` suy biến thành "chỉ
    top-10" — lúc đó `bi_trich` vắng mặt vì một lý do khác hẳn, và mọi mutant vẫn đỏ.
    """
    mach, _moc2, bi_trich = canh
    ids = ids_dang_doc(client, mach)
    assert bi_trich.pk in ids
    assert len(ids) == TOP_CAU_DANG_DOC + 1


@pytest.mark.parametrize(
    "cua",
    ["removed_at", "comment__hidden_at", "moc__deleted_at", "moc__hidden_at"],
)
def test_khoi_trich_bien_mat_thi_cau_do_KHONG_vao_cau_dang_doc(client, canh, cua):
    """B1 — bốn cửa làm khối trích biến mất khỏi thẻ mốc, bốn lần cùng một kết quả.

    Bỏ **bất kỳ** điều kiện nào khỏi `TRICH_CON_HIEN` là một trong bốn ca này đỏ. Đó là
    cả lý do bài đo chạy tham số hoá thay vì gộp thành một ca "đại diện": bản trước lượt
    vá chỉ có điều kiện `removed_at`, và ca `removed_at` một mình vẫn xanh.
    """
    mach, moc2, bi_trich = canh
    khi = timezone.now()
    if cua == "removed_at":
        Trich.objects.filter(comment=bi_trich).update(removed_at=khi)
    elif cua == "comment__hidden_at":
        Comment.objects.filter(pk=bi_trich.pk).update(hidden_at=khi)
    elif cua == "moc__deleted_at":
        Moc.objects.filter(pk=moc2.pk).update(deleted_at=khi)
    else:
        Moc.objects.filter(pk=moc2.pk).update(hidden_at=khi)

    assert bi_trich.pk not in ids_dang_doc(client, mach), cua


def test_khoi_trich_that_su_bien_mat_khoi_the_moc_trong_ca_bon_ca(client, canh):
    """Vế "soi gương": bốn cửa trên đúng là bốn cửa làm blockquote biến mất.

    Nếu một trong bốn cột hoá ra KHÔNG làm khối trích biến mất khỏi trang mạch thì bài
    trên đang giấu đi một câu vẫn đang hiện — tức bộ lọc thừa, không phải thiếu.
    """
    mach, moc2, bi_trich = canh

    def con_trich() -> bool:
        d = lay(client, f"/api/v1/machs/{mach.pk}")
        return any(m["trich"] is not None for m in d["mocs"])

    assert con_trich(), "tiền đề: khối trích đang hiện trên thẻ mốc"
    khi = timezone.now()
    for dat in (
        lambda: Trich.objects.filter(comment=bi_trich).update(removed_at=khi),
        lambda: Comment.objects.filter(pk=bi_trich.pk).update(hidden_at=khi),
        lambda: Moc.objects.filter(pk=moc2.pk).update(deleted_at=khi),
        lambda: Moc.objects.filter(pk=moc2.pk).update(hidden_at=khi),
    ):
        Trich.objects.filter(comment=bi_trich).update(removed_at=None)
        Comment.objects.filter(pk=bi_trich.pk).update(hidden_at=None)
        Moc.objects.filter(pk=moc2.pk).update(deleted_at=None, hidden_at=None)
        assert con_trich()
        dat()
        assert not con_trich()


def test_cua_thu_nam_mach_bi_mod_an(canh):
    """`moc__mach__hidden_at` — cửa duy nhất không có đường API để đo.

    Trang mạch đã 404 khi mạch bị ẩn (`api/machs.py::_mach_hien`), nên điều kiện này là
    lớp phòng thủ thứ hai chứ không phải đường đi hằng ngày. Nó vẫn phải có mặt: hàm này
    là hàm dùng chung, và `api/users.py` gọi cùng bộ lọc trên một tập KHÔNG bị chặn bởi
    `_mach_hien` — ở đó thiếu nó là "Được trích ×1" sáng trên hồ sơ trong khi mạch đã bị
    gỡ khỏi mọi trang công khai.
    """
    mach, _moc2, bi_trich = canh
    assert tap_dang_duoc_trich(mach) == frozenset({bi_trich.pk})
    an_mach_tho(Mach.objects.filter(pk=mach.pk))
    mach.refresh_from_db()
    assert tap_dang_duoc_trich(mach) == frozenset()


def test_MOT_dinh_nghia_duy_nhat_va_ca_hai_duong_deu_goi_no():
    """B2 — hai đường đọc cùng hỏi một bộ lọc, không phải hai bản chép tay.

    Đối chứng TĨNH: đọc mã nguồn hai file. Bài hành vi ở dưới chứng minh hậu quả, bài này
    chỉ vào nguyên nhân — và nó đỏ ngay lúc ai đó gõ lại năm dòng `__isnull=True` thay vì
    import hằng.
    """
    from pathlib import Path

    goc = Path(__file__).resolve().parents[1]
    for ten in ("api/users.py", "core/doc_noi_dung.py"):
        assert "TRICH_CON_HIEN" in (goc / ten).read_text(encoding="utf-8"), ten

    users = (goc / "api/users.py").read_text(encoding="utf-8")
    assert "comment__hidden_at__isnull" not in users, (
        "`api/users.py` đang chép lại điều kiện của TRICH_CON_HIEN — hai bản chép tay là "
        "hai bản sẽ lệch nhau, đúng thứ vá V1 vừa gỡ"
    )


def test_bo_loc_CO_Y_thieu_comment_deleted_at():
    """Sự khác biệt cố ý phải sống sót qua lần hợp nhất — rủi ro số 4 của plan vá.

    `trich_ra` giữ nguyên body của blockquote khi **tác giả tự xoá** bình luận (PLAN 5.6:
    cuốn sổ chống *tác giả* rút chữ, không chống *mod* gỡ nội dung). Thêm
    `comment__deleted_at` vào bộ lọc là chỉ số hồ sơ tụt và câu đó rơi khỏi "câu đáng
    đọc" trong khi blockquote vẫn còn nguyên chữ trên trang mạch.
    """
    assert set(TRICH_CON_HIEN) == {
        "removed_at__isnull",
        "comment__hidden_at__isnull",
        "moc__deleted_at__isnull",
        "moc__hidden_at__isnull",
        "moc__mach__hidden_at__isnull",
    }
    assert all(TRICH_CON_HIEN.values())


def test_tac_gia_tu_xoa_thi_cau_do_VAN_o_lai_cau_dang_doc(client, canh):
    """Chiều ngược của bài trên, đo bằng hành vi.

    Khối trích trên thẻ mốc vẫn còn nguyên chữ (`trang_thai = "da_xoa"`), nên câu đó vẫn
    thuộc "câu đáng đọc". Hai cửa nói cùng một chuyện về cùng một sự kiện.
    """
    mach, _moc2, bi_trich = canh
    Comment.objects.filter(pk=bi_trich.pk).update(deleted_at=timezone.now())

    assert bi_trich.pk in ids_dang_doc(client, mach)
    d = lay(client, f"/api/v1/machs/{mach.pk}")
    trich = next(m["trich"] for m in d["mocs"] if m["trich"] is not None)
    assert trich["trang_thai"] == "da_xoa"
    assert trich["body"] == "Câu được chủ mạch ghi vào sổ."
