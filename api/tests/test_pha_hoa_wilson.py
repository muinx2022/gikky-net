"""Khoá phá hoà của xếp hạng wilson — vá V9 (B11) + **W6/W8 của lượt vá 2** (C7, C8, C10).

V9 vá **một nửa**: nó siết `sap_wilson_thuan` (sibling trong thread + khối "Câu đáng
đọc") mà để nguyên `_rank_goc`, tức cấp GỐC của sort `hay_nhat` — **sort MẶC ĐỊNH của
khán đài**, chỗ nhiều người nhìn nhất. Bốn bài `test_W6_*` ở cuối file là nửa còn lại.

`wilson_lower_bound` **suy biến ở `up = 0`**: về toán, cận dưới của khoảng tin cậy khi
chưa có phiếu thuận nào thì bằng 0 với mọi số phiếu chống — docstring của chính hàm ấy
nói vậy.

**Nhưng cài đặt không ra đúng 0.** `tâm` và `biên` bằng nhau về toán lại được tính bằng
hai đường số học khác nhau, nên phép trừ để lại dư số: `wilson(0, 5) = 2.09e-17`,
`wilson(0, 20) = 6.41e-18`, trong khi `wilson(0, 0) = 0.0` **tuyệt đối**. Tức đây không
phải một cú hoà mà `_khoa_thoi_gian` phá; đây là một thứ tự **ngược và ổn định**: câu bị
dìm luôn xếp trên câu chưa ai vote, do dư số dấu phẩy động quyết định mặt tiền của khối
"Câu đáng đọc" (PLAN 5.5) và thứ tự sibling của sort `hay_nhat` (PLAN 5.3).

Vì thế bản vá gồm HAI phần, thiếu phần nào cũng vô hiệu: cắt dư số khi so
(`khoa_sap_wilson`) rồi mới chèn `score` làm khoá phá hoà. Chèn `score` một mình không chữa
được gì — hai giá trị không hoà thì khoá thứ hai không bao giờ được hỏi tới.

Không đụng `wilson_lower_bound`: nó là công thức của PLAN 5.3, còn "cách nhau `1e-17`
thì coi là bằng nhau" là luật của tầng sắp xếp.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from core.doc_noi_dung import (
    BINH_THUONG,
    CHU_SO_SO_WILSON,
    DA_AN,
    Nut,
    khoa_sap_wilson,
    sap_wilson_thuan,
)
from core.models import Comment
from core.xep_hang import wilson_lower_bound
from tests.conftest import lay, viet

pytestmark = pytest.mark.django_db


@pytest.fixture
def ba_cau(mach, nguoi_khac):
    """Ba thread gốc, tất cả đều `up = 0` trừ một cái để có đỉnh.

    Trả `(mach, bi_dim, chua_ai_vote)`. `bi_dim` **cũ hơn** `chua_ai_vote` — đó là điều
    kiện làm bài đo phân biệt được: không có khoá `score`, cái cũ hơn thắng.
    """
    goc = timezone.now() - timedelta(days=3)
    co_diem = viet(mach, nguoi_khac, "Câu được ủng hộ.", up=9, down=1, khi=goc)
    bi_dim = viet(mach, nguoi_khac, "Câu bị dìm 20 phiếu.", down=20, khi=goc)
    chua_ai_vote = viet(
        mach, nguoi_khac, "Câu chưa ai vote.", khi=goc + timedelta(hours=1)
    )
    assert co_diem.created_at <= bi_dim.created_at < chua_ai_vote.created_at
    return mach, bi_dim, chua_ai_vote


def test_tien_de_wilson_tho_XEP_NGUOC_hai_cau_nay():
    """Tiền đề, và là chỗ ghi lại con số thật.

    Nếu một ngày `wilson_lower_bound` ra đúng `0.0` cho cả vùng `up = 0` (đổi thư viện
    toán, đổi thứ tự phép tính, hay ai đó kẹp `max(0.0, …)`) thì bài này đỏ — và lúc đó
    `khoa_sap_wilson` không còn phải cắt gì nữa, tức phần thứ nhất của bản vá thành thừa.
    Đỏ ở đây là một tin, không phải một phiền toái.
    """
    assert wilson_lower_bound(0, 0) == 0.0
    assert wilson_lower_bound(0, 20) > wilson_lower_bound(0, 0)
    assert wilson_lower_bound(0, 20) < 1e-12


# --- X2: phép quét mà docstring `CHU_SO_SO_WILSON` viện dẫn -------------------
#
# Lượt vá 2 (W7) sửa các con số biện minh của hằng ấy cho đúng, rồi ghi rằng *"phép đo nằm
# ở `api/tests/test_pha_hoa_wilson.py`"* — **mà không đưa phép đo nào vào đây**. Hậu quả
# đo được: đổi `CHU_SO_SO_WILSON` 12 → 8 làm `(134, 15)` và `(178, 21)` gộp làm một, và
# **không có gì đỏ**. Từ X2 (lượt vá 3) phép quét là code chạy được, không phải một câu.

#: Biên của phép quét — `up, down ∈ [0, BIEN_QUET]`, tức `(BIEN_QUET + 1)²` cặp.
BIEN_QUET = 200


def _quet_wilson() -> dict[tuple[int, int], float]:
    """Toàn bộ `wilson_lower_bound(up, down)` trên lưới `[0, 200]²`. ~16 ms, hàm thuần."""
    return {
        (up, down): wilson_lower_bound(up, down)
        for up in range(BIEN_QUET + 1)
        for down in range(BIEN_QUET + 1)
    }


def test_quet_40401_cap_ra_dung_co_lon_docstring_da_ghi():
    """Tiền đề của hai bài dưới: lưới có đúng cỡ mà docstring `CHU_SO_SO_WILSON` nói.

    Con số 40 401 nằm trong văn bản biện minh của hằng ấy. Nếu lưới co lại (ai đó hạ
    `BIEN_QUET` cho test nhanh hơn) thì hai bài dưới vẫn xanh trong khi phạm vi chúng
    chứng minh đã hẹp đi — và docstring thành sai lần thứ ba.
    """
    gt = _quet_wilson()
    assert len(gt) == 40401 == (BIEN_QUET + 1) ** 2
    # Ba con số cụ thể mà docstring trích dẫn, ghim lại từng chữ số.
    assert gt[(0, 0)] == 0.0
    assert gt[(0, 5)] == pytest.approx(2.09e-17, rel=1e-2)
    assert gt[(0, 20)] == pytest.approx(6.41e-18, rel=1e-2)
    assert wilson_lower_bound(0, 1000) == pytest.approx(-1.08e-19, rel=1e-2)


def test_BO_DUOI_ca_vung_up_0_nam_duoi_nguong_cat():
    """Bờ dưới: mọi dư số của vùng `up = 0` phải bị `round(…, CHU_SO_SO_WILSON)` nuốt.

    Đây là nửa thứ nhất của bản vá V9/W6 — nếu bờ này vượt ngưỡng cắt thì `_cat_du_so`
    không còn gộp được cả vùng `up = 0` về một hạng, và khoá phá hoà `score` trở lại
    thành dòng chết.

    ⚠ **Bài này ghim `CHU_SO_SO_WILSON` theo ĐÚNG MỘT chiều: chiều NÂNG** *(nói ra ở Y2,
    lượt vá 4)*. Khẳng định của nó là `round(v, d) == 0.0`, mà hạ `d` chỉ nuốt thêm dư
    số — nên `12 → 8`, thậm chí `12 → 1`, vẫn **xanh**. Nó đỏ từ `d = 17` trở lên (dư số
    lớn nhất là `2.09e-17`, ngưỡng làm tròn là `0.5 × 10⁻ᵈ`).
    Chiều HẠ là việc của `test_BO_TREN_hai_bo_phieu_KHAC_nhau_khong_bao_gio_bi_gop`. Đừng
    đọc hai bài này là hai lớp của cùng một hàng rào: chúng kẹp hằng số từ hai phía, và
    gỡ bài nào cũng mở đúng một chiều.
    """
    gt = _quet_wilson()
    du_so = [v for (up, _d), v in gt.items() if up == 0]
    assert max(abs(v) for v in du_so) == pytest.approx(2.09e-17, rel=1e-2)
    assert {round(v, CHU_SO_SO_WILSON) for v in du_so} == {0.0}


def test_BO_TREN_hai_bo_phieu_KHAC_nhau_khong_bao_gio_bi_gop():
    """Bờ trên, và là chỗ **ghim `CHU_SO_SO_WILSON`** — X2.

    Hai khẳng định, cả hai đều đỏ khi ai đó hạ 12 xuống 8:

    1. khoảng cách nhỏ nhất giữa hai giá trị wilson KHÁC nhau (chỉ xét `up > 0`) là
       `3.94e-10`, đạt ở `(134, 15)` so với `(178, 21)` — nó phải nằm **trên** ngưỡng cắt
       `10^-CHU_SO_SO_WILSON`; ở 8 thì ngưỡng là `1e-8` và bờ này chui xuống dưới;
    2. sau khi cắt, số giá trị phân biệt **không giảm** — ở 8 thì 40 200 giá trị còn
       40 194, tức sáu cặp phiếu khác nhau bị gộp thành cùng một hạng.

    Khẳng định 2 là cái đo hậu quả THẬT; khẳng định 1 là cái nói ra *vì sao* và cho biết
    còn bao nhiêu biên an toàn (~2,9 bậc mười) cho người muốn đổi hằng ấy.
    """
    gt = _quet_wilson()
    duong = sorted({v for (up, _d), v in gt.items() if up > 0})
    assert len(duong) == BIEN_QUET * (BIEN_QUET + 1) == 40200, (
        "hai bộ phiếu khác nhau đang cho cùng một giá trị wilson CHÍNH XÁC — "
        "phép cắt không phải thứ gộp chúng, đọc lại công thức trước khi đổi hằng"
    )

    khoang_cach = min(sau - truoc for truoc, sau in zip(duong, duong[1:]))
    assert khoang_cach == pytest.approx(3.94e-10, rel=1e-2)
    nguong = 10.0**-CHU_SO_SO_WILSON
    assert khoang_cach > nguong, (
        f"CHU_SO_SO_WILSON = {CHU_SO_SO_WILSON} cắt ở {nguong:g}, lớn hơn khoảng cách "
        f"nhỏ nhất {khoang_cach:g} giữa hai bộ phiếu khác nhau — phép cắt nay GỘP những "
        "lá phiếu mà người đọc thấy khác nhau trên cột vote"
    )

    assert len({round(v, CHU_SO_SO_WILSON) for v in duong}) == len(duong), (
        f"cắt ở {CHU_SO_SO_WILSON} chữ số làm hai bộ phiếu `up > 0` khác nhau hoà nhau"
    )


def test_cap_sat_nhau_nhat_van_PHAN_BIET_duoc_sau_khi_cat():
    """Cùng một luật, viết ở mức đọc được: đúng hai bộ phiếu sát nhau nhất.

    Bài trên quét cả lưới nên thông điệp đỏ của nó là một con số; bài này gọi tên đúng
    cặp mà docstring trích dẫn, để khi đỏ thì người đọc thấy ngay ca cụ thể.
    """
    a = wilson_lower_bound(134, 15)
    b = wilson_lower_bound(178, 21)
    assert a != b
    assert round(a, CHU_SO_SO_WILSON) != round(b, CHU_SO_SO_WILSON), (
        "(134, 15) và (178, 21) nay xếp cùng hạng — CHU_SO_SO_WILSON đã bị hạ quá tay"
    )


def test_cat_du_so_bien_ca_vung_up_0_thanh_MOT_hang(mach, nguoi_khac):
    """Phần thứ nhất của bản vá, đo thẳng: sau khi cắt, cả vùng `up = 0` hoà nhau.

    Không có bước này thì khoá `score` là một dòng chết — `sorted` không bao giờ hỏi tới
    khoá thứ hai khi khoá thứ nhất đã khác nhau.
    """
    a = viet(mach, nguoi_khac, "Không ai vote.")
    b = viet(mach, nguoi_khac, "Bị dìm 5.", down=5)
    c = viet(mach, nguoi_khac, "Bị dìm 20.", down=20)
    nut = [Nut(binh_luan=x, do_sau=1, trang_thai=BINH_THUONG, con=[]) for x in (a, b, c)]
    # Vế đầu của khoá đã ĐẢO DẤU (nó là khoá `sorted` tăng dần), nên "hoà" nghĩa là cả ba
    # ra cùng một số; `-0.0 == 0.0` trong Python nên viết `0.0` cho dễ đọc.
    assert {khoa_sap_wilson(n.up, n.down, n.diem)[0] for n in nut} == {0.0}


def test_cau_bi_dim_KHONG_chen_tren_cau_chua_ai_vote_o_cau_dang_doc(client, ba_cau):
    """B11 — khối "Câu đáng đọc" sắp bằng `sap_wilson_thuan`."""
    mach, bi_dim, chua_ai_vote = ba_cau
    ids = [
        t["id"]
        for t in lay(client, f"/api/v1/machs/{mach.pk}/comments?dang_doc=1")["threads"]
    ]
    assert ids.index(chua_ai_vote.pk) < ids.index(bi_dim.pk)
    assert ids[-1] == bi_dim.pk, "câu bị dìm nặng nhất phải nằm đáy"


def test_sibling_trong_thread_cung_theo_khoa_do(client, mach, nguoi_khac):
    """Cùng một hàm nuôi thứ tự sibling của sort `hay_nhat` (PLAN 5.3)."""
    goc = timezone.now() - timedelta(days=3)
    cha = viet(mach, nguoi_khac, "Câu hỏi gốc.", up=5, khi=goc)
    bi_dim = viet(mach, nguoi_khac, "Trả lời bị dìm.", down=20, parent=cha, khi=goc)
    moi = viet(
        mach,
        nguoi_khac,
        "Trả lời chưa ai vote.",
        parent=cha,
        khi=goc + timedelta(hours=1),
    )

    d = lay(client, f"/api/v1/machs/{mach.pk}/comments?sort=hay_nhat")
    thread = next(t for t in d["threads"] if t["id"] == cha.pk)
    assert [r["id"] for r in thread["replies"]] == [moi.pk, bi_dim.pk]


def test_bia_mo_khong_bi_cau_bi_dim_chen_len_truoc(mach, nguoi_khac):
    """Bia mộ (`up = down = 0` sau khi zero hoá) cũng nằm trong nhóm hoà wilson.

    Nó phải xếp TRÊN một câu bị dìm thật: `score` của bia mộ là 0, của câu kia là −20.
    Trước bản vá thì tuổi quyết định, nên trật tự giữa hai thứ này là ngẫu nhiên theo dữ
    liệu chứ không theo bất cứ luật nào đọc được.

    ⚠ **Bài này đo THẲNG `sap_wilson_thuan`, không còn đi qua `?dang_doc=1`** *(đổi ở X4,
    lượt vá 3)*. Bản trước lấy `?dang_doc=1` làm cửa sổ nhìn vào thứ tự này, và X4 đóng
    đúng cửa ấy: bia mộ **không** còn được vế top-10 của "Câu đáng đọc" nhận nữa (nó chen
    được vào đó chính vì cái luật hoà mà bài này đo — xem
    `test_api_cau_dang_doc.py::test_bia_mo_KHONG_lot_ve_top_10_cua_cau_dang_doc`).

    Cái X4 đổi là **tư cách vào tập**, không phải **thứ tự trong tập**, nên bất biến ở đây
    còn nguyên và vẫn phải được đo — chỉ là phải đo ở tầng hàm, chỗ nó thật sự sống.

    Ở tầng HTTP, `test_W6_bia_mo_xep_theo_SCORE_chu_khong_theo_du_so` đo **cùng câu chuyện
    nhưng KHÔNG dự phòng cho bài này** *(sửa ở Y6, lượt vá 4 — câu cũ viết "cùng bất biến
    ấy còn được … ghim", và nghiệm thu đo được là sai)*: khán đài đầy đủ sắp gốc bằng
    `sap_goc_hay_nhat`/`_rank_goc`, không đi qua `khoa_sap_wilson`. Dưới mutant "bỏ khoá
    `score` khỏi `khoa_sap_wilson`" thì bài W6 ấy **xanh** còn bài này đỏ. Hai bài **bổ
    sung** nhau — mỗi bài canh một trong hai khoá — nên gỡ bài nào cũng để hở một nửa.
    """
    goc = timezone.now() - timedelta(days=3)
    duoc_ung_ho = viet(mach, nguoi_khac, "Câu được ủng hộ.", up=9, khi=goc)
    an = viet(mach, nguoi_khac, "Câu sắp bị ẩn.", up=30, khi=goc)
    bi_dim = viet(
        mach, nguoi_khac, "Câu bị dìm.", down=20, khi=goc - timedelta(hours=1)
    )
    type(an).objects.filter(pk=an.pk).update(hidden_at=timezone.now())
    an.refresh_from_db()

    def nut(c, trang_thai=BINH_THUONG):
        return Nut(binh_luan=c, do_sau=1, trang_thai=trang_thai, con=[])

    xep = sap_wilson_thuan([nut(bi_dim), nut(an, DA_AN), nut(duoc_ung_ho)])
    assert [n.binh_luan.pk for n in xep] == [duoc_ung_ho.pk, an.pk, bi_dim.pk]
    # Và thứ tự ấy đọc thẳng ra từ `score` — `bi_dim` CŨ HƠN, nên không có khoá `score`
    # thì tuổi kéo nó lên trước bia mộ.
    assert [n.diem for n in xep] == [9, 0, -20]
    assert bi_dim.created_at < an.created_at


def test_ham_van_la_thu_tu_TOAN_PHAN_khi_moi_khoa_deu_hoa():
    """Danh sách rỗng / một phần tử không nổ, và hàm vẫn ổn định — chống hồi quy hình
    dạng khi thêm một phần tử vào tuple khoá."""
    assert sap_wilson_thuan([]) == []


# --- W6: cùng bản vá, áp cho sort MẶC ĐỊNH của khán đài ----------------------
#
# `khoa_sap_wilson` chỉ nuôi sibling và khối "Câu đáng đọc". Cấp GỐC của sort
# `hay_nhat` đi qua `_rank_goc`, và V9 để nguyên nó — nên đúng sự đảo ấy còn sống ở MẶT TIỀN khán đài,
# chỗ nhiều người nhìn nhất. Lượt vá 2 áp cùng `_cat_du_so` + cùng khoá phá hoà `score`.


def test_W6_cau_bi_dim_KHONG_chen_tren_cau_chua_ai_vote_o_SORT_MAC_DINH(client, ba_cau):
    """C7 — `/machs/{id}/comments` **không kèm `?sort=`**, tức `hay_nhat`, cấp GỐC.

    Bài này đỏ với CẢ HAI mutant của W6, và đó là chủ đích:

    - bỏ `_cat_du_so` khỏi `_rank_goc` ⇒ `wilson(0, 20) = 6.41e-18 > 0.0` ⇒ câu bị dìm
      lại chen lên trên, ổn định, do dư số dấu phẩy động quyết định;
    - bỏ khoá `-n.diem` khỏi `sap_goc_hay_nhat` ⇒ hai giá trị hoà ở `0.0`, `_khoa_thoi
      _gian` quyết một mình, và `bi_dim` **cũ hơn** nên nó vẫn thắng.

    Ba bình luận của `ba_cau` đều ra đời 3 ngày trước, tức ngoài cửa sổ 48h, nên KHÔNG
    cái nào ăn hệ số tươi — nếu không thì bài đo chỉ chứng minh `HE_SO_TUOI` còn chạy.
    """
    mach, bi_dim, chua_ai_vote = ba_cau
    ids = [t["id"] for t in lay(client, f"/api/v1/machs/{mach.pk}/comments")["threads"]]
    assert ids.index(chua_ai_vote.pk) < ids.index(bi_dim.pk)
    assert ids[-1] == bi_dim.pk, "câu bị dìm nặng nhất phải nằm đáy khán đài"


def test_W6_bia_mo_xep_theo_SCORE_chu_khong_theo_du_so(client, mach, nguoi_khac):
    """C8 — "đọc được xếp trên bia mộ" **không còn là một luật**, và không được là.

    Docstring cũ của `_rank_goc` mô tả hành vi ấy như một lựa chọn. Nó không phải: nó là
    dấu của một dư số `~1e-17`, và với `down ≳ 1000` thì dấu ấy **lật** (`wilson(0, 1000)
    = −1.08e-19 < 0`) — tức "luật" tự đảo chiều theo số phiếu chống, không ai đọc ra được
    từ màn hình.

    Sau W6 thứ tự trong vùng hoà do MỘT khoá tường minh quyết: `score`, đúng con số trên
    cột vote. Bia mộ mang `0` (số phiếu bị zero hoá) nên nó đứng **trên** câu `−20` và
    **dưới** câu `+9` — người đọc thấy `+9`, `0`, `−20` và giải thích được thứ tự.
    """
    goc = timezone.now() - timedelta(days=3)
    duoc_ung_ho = viet(mach, nguoi_khac, "Câu được ủng hộ.", up=9, khi=goc)
    an = viet(mach, nguoi_khac, "Câu sắp bị ẩn.", up=30, khi=goc)
    viet(mach, nguoi_khac, "Con của câu bị ẩn.", parent=an, khi=goc)
    bi_dim = viet(mach, nguoi_khac, "Câu bị dìm.", down=20, khi=goc - timedelta(hours=1))
    type(an).objects.filter(pk=an.pk).update(hidden_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{mach.pk}/comments")
    ids = [t["id"] for t in d["threads"]]
    assert ids == [duoc_ung_ho.pk, an.pk, bi_dim.pk]

    # …và thứ tự ấy đọc thẳng ra từ con số API trả về, không cần biết wilson là gì.
    assert [t["score"] for t in d["threads"]] == [9, 0, -20]


def test_W6_phep_cat_KHONG_nuot_he_so_tuoi(client, mach, nguoi_khac):
    """Chiều ngược của W6: cắt ở 12 chữ số **không được** nuốt mất `HE_SO_TUOI = 0.15`.

    Vá quá tay (cắt ở 1 chữ số, hay `round(x)` trần) làm mọi rank dưới `0.5` về `0.0`,
    cả cấp gốc của `hay_nhat` sụp về "score rồi tới cũ trước", và ba bài W6 phía trên
    **vẫn xanh** — chúng chỉ nhìn vùng `rank = 0`. Đây là chốt chặn cho chính chúng.

    Số cụ thể: `wilson(1, 3) = 0.0781` (cũ, ngoài cửa sổ tươi) so với
    `wilson(0, 0) + 0.15 = 0.15` (vừa viết, chưa ai vote). Câu mới phải thắng — đúng lý
    do `HE_SO_TUOI` tồn tại (PLAN 5.3: "người đến sau phải có cửa").
    """
    cu = viet(
        mach, nguoi_khac, "Cũ, ít phiếu.", up=1, down=3,
        khi=timezone.now() - timedelta(days=3),
    )
    moi_tinh = viet(mach, nguoi_khac, "Vừa viết, chưa ai vote.", khi=timezone.now())

    ids = [t["id"] for t in lay(client, f"/api/v1/machs/{mach.pk}/comments")["threads"]]
    assert ids == [moi_tinh.pk, cu.pk], (
        "hệ số tươi (+0.15) phải thắng wilson(1,3) ≈ 0.078 — nếu đỏ, phép cắt đã quá tay"
    )


def test_W8_seed_KHONG_co_cu_hoa_nao_nen_khoa_score_phai_do_o_DAY(seed):
    """C10 — vì sao bài đo "hoà thật" bắt buộc phải nằm ngoài seed.

    B11 bản đầu đo trên **dữ liệu seed** và chấm ĐẠT, nhưng nó ĐẠT rỗng: cả 14 bình luận
    gốc của `seed_dev` đều `up > 0` và cho 14 giá trị wilson **phân biệt**, nên khoá phá
    hoà `score` không bao giờ được `sorted` hỏi tới ở đó — mutant xoá nó vẫn xanh.

    Bài này ghim đúng tiền đề ấy. Nếu một ngày seed có hoà thật thì nó ĐỎ, và đó là tin
    tốt: lúc đó bài đo trên seed mới thật sự đo được khoá `score`, và dòng này nên xoá.
    Chừng nào nó còn xanh thì `-n.diem` chỉ được chứng minh bởi bốn bài `up = 0` trong
    file này (`?dang_doc=1`, sibling, bia mộ, và sort mặc định).
    """
    goc = list(Comment.objects.filter(mach=seed, parent__isnull=True))
    khoa_wilson = [khoa_sap_wilson(c.up_count, c.down_count, c.score)[0] for c in goc]

    assert len(goc) == 14
    assert all(c.up_count > 0 for c in goc), "seed đã có bình luận gốc up=0"
    assert len(set(khoa_wilson)) == len(goc), (
        "seed đã có cú hoà wilson — bài đo B11 trên seed nay ĐO được khoá `score`"
    )
