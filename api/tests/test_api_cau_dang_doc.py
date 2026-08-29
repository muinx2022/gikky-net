"""`?dang_doc=1` — "câu đáng đọc" của mặt CẶN (PLAN 5.5, tiêu chí A5).

Luật là **phép hợp `đã trích ∪ top-10 wilson`**, và cả giá trị của bài đo nằm ở chữ
*hợp*: cài thành "chỉ top-10" là cách hỏng gần như chắc chắn (nó đơn giản hơn, và trên
mọi mạch nhỏ nó cho ra cùng kết quả). Seed được dựng từ 1a để ca đó phân biệt được — `r7`
là bình luận ĐƯỢC TRÍCH và xếp hạng **12/14** theo wilson, tức nằm ngoài top-10.

Bài đo dưới đây ghim cả hai đầu: `r7` phải CÓ trong tập, và nó phải KHÔNG có trong
top-10. Thiếu vế thứ hai thì "chỉ top-10" vẫn xanh ngày nào seed đổi số.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from core.doc_noi_dung import TOP_CAU_DANG_DOC, khoa_sap_wilson
from core.ghi import them_moc
from core.management.commands.seed_dev import TRICH_COMMENT_KEY
from core.models import Comment, Trich
from tests.conftest import lay, viet

pytestmark = pytest.mark.django_db

#: Nguyên văn `r7` trong `seed_dev.COMMENTS_HPG`, đủ để nhận ra hàng đó.
BODY_R7 = "Bán đi bác, đi ngang 5 tuần là hết hơi rồi."


def dang_doc(client, mach_id: int, them: str = ""):
    return lay(client, f"/api/v1/machs/{mach_id}/comments?dang_doc=1{them}")


def ids(d) -> list[int]:
    return [t["id"] for t in d["threads"]]


def _khoa(c: Comment) -> tuple[float, int]:
    """Oracle xếp hạng — **đúng bộ so sánh của code**, không phải wilson thô (W8).

    `khoa_sap_wilson` cắt dư số dấu phẩy động rồi mới lấy `score` làm khoá phá hoà; tự
    sắp bằng `wilson_lower_bound(up, down)` là dựng một bộ so sánh THỨ HAI, hôm nay trùng
    kết quả chỉ vì cả 14 bình luận gốc của seed đều `up > 0` và không có cú hoà nào.
    """
    return khoa_sap_wilson(c.up_count, c.down_count, c.score)


@pytest.fixture
def r7(seed) -> Comment:
    assert TRICH_COMMENT_KEY == "r7", "seed đổi bình luận được trích — đọc lại bài đo này"
    return Comment.objects.get(mach=seed, body=BODY_R7)


def test_r7_dung_la_binh_luan_dang_duoc_trich(seed, r7):
    """Tiền đề của cả file. Không có nó thì mọi bài dưới đo trên một giả định."""
    assert Trich.objects.filter(comment=r7, removed_at__isnull=True).exists()


def test_r7_nam_NGOAI_top_10_wilson(seed, r7):
    """Vế thứ hai của A5: nếu `r7` lọt top-10 thì "hợp thật" và "chỉ top-10" cho cùng kết
    quả, và bài đo chính bên dưới trở thành bài đo rỗng."""
    goc = Comment.objects.filter(mach=seed, parent__isnull=True)
    hang = sorted(goc, key=_khoa)
    thu_hang = [c.pk for c in hang].index(r7.pk) + 1
    assert thu_hang > TOP_CAU_DANG_DOC, f"r7 đang ở hạng {thu_hang}/{len(hang)}"
    assert (thu_hang, len(hang)) == (12, 14), "seed đổi số phiếu — xem khối BA VAI"


def test_cau_dang_doc_la_hop_that_top_10_cong_r7(client, seed, r7):
    """A5 — bài đo giết mutant "chỉ top-10"."""
    d = dang_doc(client, seed.pk)
    assert r7.pk in ids(d), "mất `r7` ⇒ phép hợp đã suy biến thành chỉ top-10"
    assert d["tong_thread"] == TOP_CAU_DANG_DOC + 1 == len(d["threads"])


def test_cau_dang_doc_sap_theo_wilson_thuan(client, seed):
    """Wilson THUẦN: không hệ số tươi (thứ phụ thuộc `now`) — nếu không, danh sách "đáng
    đọc" đổi theo giờ chạy test."""
    d = dang_doc(client, seed.pk)
    khoa = [
        khoa_sap_wilson(t["up_count"], t["down_count"], t["score"])
        for t in d["threads"]
    ]
    assert khoa == sorted(khoa)


def test_cau_dang_doc_chi_tra_thread_GOC(client, seed):
    d = dang_doc(client, seed.pk)
    assert {t["depth"] for t in d["threads"]} == {1}


def test_cau_dang_doc_van_giu_ca_nhanh_con(client, seed):
    """Đơn vị là thread, không phải câu lẻ — cắt `replies` đi thì khối "Câu đáng đọc"
    hiện một câu trả lời mồ côi không có câu hỏi."""
    d = dang_doc(client, seed.pk)
    assert any(len(t["replies"]) > 0 for t in d["threads"])


def test_trich_da_GO_thi_khong_con_duoc_keo_len(client, seed, r7):
    """`tap_dang_duoc_trich` lọc `removed_at`, khác hẳn `tap_tung_duoc_trich`. Gọi nhầm
    hàm kia là đưa lên mặt tiền đúng câu chủ mạch vừa rút khỏi sổ."""
    from django.utils import timezone

    Trich.objects.filter(comment=r7).update(removed_at=timezone.now())
    d = dang_doc(client, seed.pk)
    assert r7.pk not in ids(d)
    assert d["tong_thread"] == TOP_CAU_DANG_DOC


def test_mach_it_thread_thi_tra_het(client, seed_post_thuong):
    """Mạch dưới 10 thread: "câu đáng đọc" trùng cả khán đài — không giấu gì của ai."""
    d = dang_doc(client, seed_post_thuong.pk)
    day_du = lay(client, f"/api/v1/machs/{seed_post_thuong.pk}/comments")
    assert d["tong_thread"] == day_du["tong_thread"]
    # …và vì trùng, phép lọc không bỏ lại ứng viên nào ⇒ UI không render khối (Y1).
    assert d["so_ung_vien_bo_lai"] == 0


def test_khong_phan_trang(client, seed):
    d = dang_doc(client, seed.pk)
    assert d["offset_ke_tiep"] is None and d["cursor_ke_tiep"] is None


@pytest.mark.parametrize(
    "them",
    [
        "&sort=moi_nhat",
        "&sort=cu_nhat",
        "&offset=10",
        "&cursor=abc",
        "&limit=5",
        # `limit` đúng bằng mặc định cũng 400 (vá V7): phân biệt "không truyền" với
        # "truyền đúng con số mặc định" là cả lý do tham số này mang sentinel `None`. Nếu
        # mặc định vẫn là 50 thì hai ca ấy không phân biệt được từ trong hàm, và cửa này
        # buộc phải im lặng cho qua một lời gọi mà người viết tưởng là có tác dụng.
        "&limit=50",
    ],
)
def test_dang_doc_khong_di_kem_phan_trang_hay_sort_khac(client, seed, them):
    """Nuốt im lặng tham số sai chỗ là loài lỗi endpoint này đã trả 400 để diệt ở hai
    kiểu phân trang; `dang_doc` không được mở lại cửa đó.

    `limit` là **cửa thứ tư** của chính cái luật ấy, vá 2026-08-22 (V7 / B9): nhánh
    `dang_doc` không đọc `limit` ở đâu cả, nên `?dang_doc=1&limit=5` trước đó trả 200 kèm
    11 thread và người gọi tưởng mình đã cắt còn 5.
    """
    d = lay(
        client,
        f"/api/v1/machs/{seed.pk}/comments?dang_doc=1{them}",
        status=400,
    )
    assert d["code"] == "tham_so_khong_hop_le"


def test_dang_doc_TRAN_van_200(client, seed):
    """Chiều ngược của bài trên: `limit` mang sentinel không được làm hỏng lời gọi đúng."""
    assert dang_doc(client, seed.pk)["tong_thread"] == TOP_CAU_DANG_DOC + 1


def test_khan_dai_THUONG_van_nhan_limit_va_van_co_mac_dinh_50(client, seed_chung):
    """Sentinel `None` chỉ đổi cách `dang_doc` đọc tham số, không đổi hợp đồng của khán
    đài: `?limit=` vẫn cắt, thiếu nó vẫn là 50, và quá 50 vẫn 400.

    `seed_chung` từ 2026-08-26: nhánh khán đài THƯỜNG nay lọc bỏ thread neo, và trên seed
    thô còn đúng 1 thread — `?limit=3` không cắt được gì thì bài đo không còn đo `limit`.
    Nhánh `?dang_doc=1` ở các bài trên **giữ nguyên `seed`**, vì nó cố ý không đi qua phép
    lọc ấy (xem docstring endpoint).
    """
    d = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?limit=3")
    assert len(d["threads"]) == 3 and d["offset_ke_tiep"] == 3

    khong_limit = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments")
    assert len(khong_limit["threads"]) == 14 and khong_limit["offset_ke_tiep"] is None

    assert lay(
        client, f"/api/v1/machs/{seed_chung.pk}/comments?limit=51", status=400
    )["code"] == "tham_so_khong_hop_le"


def test_khong_co_dang_doc_thi_van_la_khan_dai_day_du(client, seed_chung):
    d = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments")
    assert d["tong_thread"] == 14


# --- X4: bia mộ KHÔNG được lọt vế top-10 -------------------------------------
#
# Bản trước tin rằng bia mộ *"chỉ lọt vào tập khi mạch có dưới 10 thread"*. Sai: wilson
# của nó là `0.0` và `sap_wilson_thuan` phá hoà nhóm đáy bằng `score`, mà bia mộ mang
# `score = 0` ⇒ nó THẮNG mọi câu bị dìm và HOÀ mọi câu chưa ai vote (rồi tuổi quyết).
# Điều kiện thật chỉ là "≥ 11 thread gốc mà dưới 10 thread có phiếu" — hình dạng bình
# thường của mạch đông bình luận, ít vote. Hai chiều đều phải đo: loại khỏi top-10, mà
# GIỮ khi đã được trích (luật `giu_vi_da_trich`, PLAN 5.6).

#: Số thread gốc chưa ai vote trong cảnh dưới — đủ để lấp kín phần còn lại của top-10.
SO_GOC_CHUA_VOTE = 14
SO_GOC_CO_PHIEU = 5


@pytest.fixture
def mach_dong_it_vote(mach, nguoi_khac):
    """20 thread gốc: 5 có phiếu · **1 bia mộ, cũ nhất** · 14 chưa ai vote.

    Trả `(mach, bia_mo)`. Ba chi tiết đều bắt buộc, không cái nào là trang trí:

    - bia mộ **cũ nhất** — nó hoà `score = 0` với 14 câu chưa ai vote, và khoá cuối cùng
      là tuổi, nên "cũ nhất" là điều kiện làm nó thắng cả 14 câu kia;
    - bia mộ **có reply đọc được** — không thì luật bia mộ tự cắt nó khỏi cây và bài đo
      xanh vì một lý do chẳng liên quan gì tới X4;
    - **5** thread có phiếu, tức dưới 10 — đúng cái điều kiện thật, và nó bỏ trống 5 chỗ
      trong top-10 cho nhóm hoà tràn vào.
    """
    goc = timezone.now() - timedelta(days=10)
    bia_mo = viet(mach, nguoi_khac, "Câu +29 rồi sẽ bị xoá.", up=29, khi=goc)
    viet(mach, nguoi_khac, "Trả lời câu trên.", parent=bia_mo, khi=goc)
    for i in range(SO_GOC_CO_PHIEU):
        viet(mach, nguoi_khac, f"Câu có phiếu {i}.", up=20 - i, khi=goc + timedelta(hours=1))
    for i in range(SO_GOC_CHUA_VOTE):
        viet(mach, nguoi_khac, f"Câu chưa ai vote {i}.", khi=goc + timedelta(hours=2 + i))
    Comment.objects.filter(pk=bia_mo.pk).update(deleted_at=timezone.now())
    return mach, bia_mo


def _hang_wilson(mach) -> list[int]:
    """Thứ hạng thread gốc theo ĐÚNG bộ so sánh của code, phiếu đã che như API che.

    Oracle độc lập với `cau_dang_doc`: nó nói bia mộ **đứng ở đâu** trong thứ tự wilson,
    tức trả lời được câu "nó có nằm trong 10 chỗ đầu không" mà không hỏi chính cái hàm
    đang bị đo.
    """
    def khoa(c: Comment):
        up, down = (0, 0) if (c.deleted_at or c.hidden_at) else (c.up_count, c.down_count)
        # `_khoa_thoi_gian` của code: cũ hơn đứng trước, rồi tới `id`. Thiếu nó thì thứ
        # tự trong nhóm hoà do thứ tự nạp quyết — tức oracle này tự do lệch khỏi code.
        return (*khoa_sap_wilson(up, down, up - down), c.created_at, c.pk)

    goc = Comment.objects.filter(mach=mach, parent__isnull=True)
    return [c.pk for c in sorted(goc, key=khoa)]


def test_tien_de_bia_mo_dung_ra_LOT_top_10_wilson(client, mach_dong_it_vote):
    """Tiền đề: không có nó thì bài dưới xanh một cách rỗng tuếch.

    Cảnh này phải là cảnh mà bia mộ **thật sự** chen được vào 10 chỗ đầu theo wilson —
    nếu không, "bia mộ không có trong tập" đúng vì nó xếp hạng 15, chứ không vì X4 làm gì.
    """
    mach, bia_mo = mach_dong_it_vote
    hang = _hang_wilson(mach)
    assert len(hang) == SO_GOC_CO_PHIEU + SO_GOC_CHUA_VOTE + 1 == 20
    thu = hang.index(bia_mo.pk) + 1
    assert thu <= TOP_CAU_DANG_DOC, f"bia mộ đang ở hạng {thu}/20 — cảnh không đo được X4"
    assert thu == SO_GOC_CO_PHIEU + 1, (
        "bia mộ phải đứng ngay sau nhóm có phiếu: nó hoà score với 14 câu chưa ai vote "
        "và cũ hơn tất cả"
    )


def test_bia_mo_KHONG_lot_ve_top_10_cua_cau_dang_doc(client, mach_dong_it_vote):
    """X4 — chiều thứ nhất. Mutant bỏ điều kiện loại bia mộ ⇒ bài này đỏ.

    Không có X4 thì `[bình luận đã xoá]` in ngay dưới nhãn "Câu đáng đọc" và dòng "…những
    câu được đánh giá cao nhất" — một dòng trống được giới thiệu là câu đáng đọc nhất.
    """
    mach, bia_mo = mach_dong_it_vote
    d = dang_doc(client, mach.pk)

    assert bia_mo.pk not in ids(d)
    assert d["tong_thread"] == TOP_CAU_DANG_DOC == len(d["threads"])
    assert all(t["trang_thai"] == "binh_thuong" for t in d["threads"]), (
        "vế top-10 chỉ được nhận thread đọc được"
    )
    # …và chỗ bia mộ bỏ lại được một câu THẬT lấp vào, không phải để trống: tập trả về
    # đúng bằng 10 thread đọc được đầu bảng, kể cả cái thứ 10 vừa được đôn lên.
    doc_duoc = [pk for pk in _hang_wilson(mach) if pk != bia_mo.pk]
    assert ids(d) == doc_duoc[:TOP_CAU_DANG_DOC]


def test_bia_mo_DA_DUOC_TRICH_thi_VAN_o_lai(client, mach_dong_it_vote, tac_gia):
    """X4 — chiều thứ hai, và là chiều 1b đã từng làm hỏng.

    `giu_vi_da_trich` (PLAN 5.6) dựng cuốn sổ không-xoá-được để chống **tác giả** rút
    chữ. Loại bia mộ khỏi vế top-10 mà loại nhầm cả vế "đã trích" là gỡ câu đã vào sổ của
    người ta khỏi mặt tiền ngay lúc họ tự xoá bình luận gốc — đúng chuyện cuốn sổ ấy sinh
    ra để không xảy ra.

    Mutant: đổi vòng lặp "đã trích" trong `cau_dang_doc` từ `theo_wilson` sang `ung_vien`
    ⇒ bài này đỏ.
    """
    mach, bia_mo = mach_dong_it_vote
    moc2 = them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    Trich.objects.create(moc=moc2, comment=bia_mo)

    d = dang_doc(client, mach.pk)
    assert bia_mo.pk in ids(d), "bia mộ ĐÃ ĐƯỢC TRÍCH phải ở lại qua vế `đã trích`"
    assert d["tong_thread"] == TOP_CAU_DANG_DOC + 1
    # Nó vào bằng cửa "đã trích", KHÔNG bằng cửa top-10: bỏ khối trích đi là nó biến mất.
    assert next(t for t in d["threads"] if t["id"] == bia_mo.pk)["trang_thai"] == "da_xoa"


# --- Y1: `so_ung_vien_bo_lai` — con số UI cần để biết khối có LỌC được gì không ----
#
# X4 thu nhỏ tập ứng viên (bia mộ rời khỏi vế top-10) mà không ai xem lại người tiêu thụ
# kích thước ấy: `apps/web/components/khan-dai.tsx` so `tong_thread` của TẬP với
# `tong_thread` của CẢ CÂY. Hai con số ấy đếm hai thứ khác nhau kể từ X4 — cây đếm cả bia
# mộ, tập thì không nhận bia mộ qua vế top-10 nữa. Hệ quả trên seed dev: mọi mạch ≤ 10
# thread mà có **một** gốc là bia mộ đều cho `tập < cây` ⇒ khối render ⇒ nó chép lại y
# nguyên cây ngay dưới nó, và thread cuối của khối là `[bình luận đã xoá]` nằm dưới nhãn
# "Câu đáng đọc".
#
# Con số API trả kèm là **số ứng viên (thread gốc ĐỌC ĐƯỢC) bị bỏ lại ngoài tập**. Nó là
# thứ duy nhất trả lời được câu "khối này có lọc được gì không" mà không bắt frontend suy
# lại luật domain (PLAN nguyên tắc 10).


@pytest.fixture
def mach_it_thread_co_bia_mo(mach, nguoi_khac, tac_gia):
    """Đúng hình dạng mạch VNM của `seed_dev`: 4 gốc đọc được · 1 gốc mod ẩn (còn con) ·
    1 gốc tác giả xoá **và đã được trích**. Tổng 6 thread, tập "câu đáng đọc" = 5.

    Ba chi tiết bắt buộc, không cái nào là trang trí:

    - **dưới 10 gốc đọc được** — cả 4 lọt top-10, nên tập chứa TRỌN vẹn phần đọc được của
      cây; đó là điều kiện của cái hại (khối = bản sao);
    - **một bia mộ đã trích** — nó kéo tập lên 5 trong khi cây có 6, tức `tập < cây`: đúng
      cái làm luật cũ quyết định render;
    - **một bia mộ KHÔNG được trích** (gốc mod ẩn) — để cây có 6 chứ không 5, nếu không
      hai con số bằng nhau và luật cũ cũng đã ẩn khối, bài đo thành rỗng.

    Trả `(mach, xoa_da_trich)`.
    """
    khi = timezone.now() - timedelta(days=5)
    for i in range(4):
        viet(mach, nguoi_khac, f"Câu đọc được {i}.", up=9 - i, khi=khi)
    an = viet(mach, nguoi_khac, "Câu sắp bị mod ẩn.", up=3, khi=khi)
    viet(mach, nguoi_khac, "Con của câu bị ẩn.", parent=an, khi=khi)
    xoa = viet(mach, nguoi_khac, "Câu đã vào sổ rồi bị tác giả xoá.", up=2, khi=khi)
    moc2 = them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    Trich.objects.create(moc=moc2, comment=xoa)
    Comment.objects.filter(pk=an.pk).update(hidden_at=timezone.now())
    Comment.objects.filter(pk=xoa.pk).update(deleted_at=timezone.now())
    return mach, xoa


def test_tien_de_mach_bia_mo_van_cho_tap_NHO_HON_ca_cay(client, mach_it_thread_co_bia_mo):
    """Tiền đề của bài dưới: cảnh này phải là cảnh mà **luật cũ** sẽ render khối.

    Không có nó thì "khối không lọc được gì" đúng vì một lý do chẳng liên quan (ví dụ tập
    tình cờ bằng cây), và bài dưới xanh rỗng.
    """
    mach, _ = mach_it_thread_co_bia_mo
    d = dang_doc(client, mach.pk)
    day_du = lay(client, f"/api/v1/machs/{mach.pk}/comments")
    assert (d["tong_thread"], day_du["tong_thread"]) == (5, 6), (
        "cảnh không còn đúng hình dạng mạch VNM — đọc lại fixture"
    )


def test_bia_mo_khong_lam_khoi_thanh_BAN_SAO_cua_ca_cay(client, mach_it_thread_co_bia_mo):
    """Y1 — mạch ≤ 10 thread có bia mộ: tập chứa TRỌN phần đọc được ⇒ bỏ lại 0 ứng viên.

    Đây là con số UI dùng để không render khối. So `tong_thread` của tập với `tong_thread`
    của cây (luật cũ) cho `5 < 6` ⇒ render ⇒ 5 bình luận in hai lần trên một trang.
    """
    mach, xoa = mach_it_thread_co_bia_mo
    d = dang_doc(client, mach.pk)
    assert xoa.pk in ids(d), "bia mộ đã trích vẫn phải ở lại (PLAN 5.6)"
    assert d["so_ung_vien_bo_lai"] == 0


def test_so_ung_vien_bo_lai_dem_dung_thread_DOC_DUOC_bi_cat(client, mach_dong_it_vote):
    """Chiều ngược: mạch đông thì khối LỌC thật, và con số nói đúng nó cắt bao nhiêu.

    19 gốc đọc được, top-10 lấy 10 ⇒ 9 bị bỏ lại. Bia mộ **không** nằm trong phép trừ này:
    nó không phải ứng viên (X4), nên đếm nó vào là đếm một thứ khối chưa bao giờ nhận.
    """
    mach, _ = mach_dong_it_vote
    d = dang_doc(client, mach.pk)
    assert d["so_ung_vien_bo_lai"] == (
        SO_GOC_CO_PHIEU + SO_GOC_CHUA_VOTE - TOP_CAU_DANG_DOC
    ) == 9


def test_so_ung_vien_bo_lai_tren_seed_HPG(client, seed):
    """Seed HPG: 14 gốc, không bia mộ nào, tập = top-10 ∪ {r7} = 11 ⇒ bỏ lại 3.

    Mạch này là ca mà khối **phải** render, và nó là chiều chống-vá-quá-tay của Y1.
    """
    d = dang_doc(client, seed.pk)
    assert d["so_ung_vien_bo_lai"] == 14 - (TOP_CAU_DANG_DOC + 1) == 3


def test_khan_dai_DAY_DU_khong_mang_con_so_cua_che_do_dang_doc(client, seed):
    """`so_ung_vien_bo_lai` chỉ có nghĩa ở `?dang_doc=1`; khán đài thường trả `null`.

    Trả `0` ở đây thì tệ hơn hẳn `null`: `0` đọc ra là "không lọc được gì", và một người
    gọi truyền nhầm response khán đài vào chỗ quyết định render sẽ nhận đúng câu trả lời
    ấy — sai vì lý do đúng.
    """
    assert lay(client, f"/api/v1/machs/{seed.pk}/comments")["so_ung_vien_bo_lai"] is None
