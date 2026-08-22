"""`manage.py seed_dev` — plan con Phase 1a 2.4 / 2.5 (6), tiêu chí P10.

Đếm bằng truy vấn, không đọc log của command: "chạy 2 lần không nhân đôi" mà kiểm bằng
dòng chữ command tự in ra thì đang tin lời khai của bị cáo (plan con mục 4.3).
"""

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from core.management.commands.seed_dev import (
    BINH_LUAN_MOD_AN,
    BINH_LUAN_TU_XOA,
    COMMENTS_BIA_MO,
    COMMENTS_HPG,
    MOC_BIA_MO_SEQ,
    MOCS_BIA_MO,
    SO_NGUOI_XEM,
    TITLE_BIA_MO,
    TITLE_HPG,
    TITLE_POST_THUONG,
    TRICH_BIA_MO_MOC_SEQ,
    TRICH_MOC_SEQ,
    Command,
)
from core.models import Comment, Mach, Moc, Sub, Trich, User, Vote
from core.xep_hang import wilson_lower_bound

pytestmark = pytest.mark.django_db


@pytest.fixture
def da_seed():
    call_command("seed_dev", verbosity=0)
    return Mach.objects.get(title=TITLE_HPG)


@pytest.fixture
def mach_bia_mo(da_seed) -> Mach:
    """Mạch VNM — nơi ba kiểu bia mộ sống (vá B2). Xem `seed_dev.py`, khối "Mạch bia mộ"."""
    return Mach.objects.get(title=TITLE_BIA_MO)


def seq_dai_gap(mach: Mach) -> set[int]:
    """`seq` của những mốc nằm trong **dải gập** ở mặt CẶN.

    PLAN 5.5, khối "Công thức dải gập, chốt 2026-08-22": với `entry_count = n`, gập `seq`
    từ **2 tới n−3**; hiện `1`, `n−2`, `n−1`, `n`. Với mạch 9 mốc: mở {1, 7, 8, 9}, gập
    {2..6} — đúng "5 mốc" của văn xuôi PLAN 5.5, của wireframe 9.2 và của bảng nghiệm thu
    mục 10.

    ⚠ Bản trước của hàm này ghi `range(2, n - 1)` (= 2..7) theo cách đọc "2 mốc cuối", và
    1c cài `2…n−2` theo đúng nó. Đợt vá 2026-08-22 lùi cả hai về `2…n−3`; hiện thực sản
    phẩm nằm ở `apps/web/lib/dai-gap.ts`, hàm này là bản độc lập cho phía Python.

    Điều đó KHÔNG làm bài đo rỗng: thứ đang đo là **dữ liệu seed**, và câu hỏi là "hai vai
    khác nhau có rơi vào cùng một hàng không". Trả lời câu đó cần một định nghĩa dải gập,
    và đây là định nghĩa nguyên văn theo PLAN.
    """
    n = mach.entry_count
    assert n >= 5, "mạch quá ngắn thì không có dải gập để nói"
    return set(range(2, n - 2))


def test_dung_don_hang_PLAN_muc_10(da_seed):
    hpg = da_seed
    assert Sub.objects.count() == 2
    assert set(Sub.objects.values_list("slug", flat=True)) == {"chung-khoan", "crypto"}

    assert hpg.status == Mach.TrangThai.DONG
    assert hpg.ket_qua == "+18.2% · 163 ngày"
    assert hpg.closed_at is not None
    assert hpg.entry_count == 9
    assert Moc.objects.filter(mach=hpg).count() == 9
    assert hpg.comment_count == 24
    assert Comment.objects.filter(mach=hpg).count() == 24


def test_mach_HPG_khong_dinh_bia_mo_nao(da_seed):
    """Vá B2 đặt bia mộ ở MẠCH RIÊNG, và bài đo này giữ nguyên quyết định đó.

    Mạch HPG là dữ liệu nghiệm thu của 1a/1b: `comment_count == 24`, thứ hạng `hay_nhat`,
    `so_moc` trên hồ sơ chủ mạch đều bị ghim ở 8 file test khác. Một `deleted_at` lọt vào
    đây làm 26 bài đo của 1b đỏ cùng lúc, và cách chữa duy nhất còn lại là sửa con số của
    chúng cho khớp — tức mài cùn đúng những bài đo vừa bắt được lỗi.
    """
    assert not Moc.objects.filter(mach=da_seed).exclude(
        deleted_at__isnull=True, hidden_at__isnull=True
    ).exists()
    assert not Comment.objects.filter(mach=da_seed).exclude(
        deleted_at__isnull=True, hidden_at__isnull=True
    ).exists()
    # Và số hàng phải BẰNG số đếm — hệ quả trực tiếp của dòng trên.
    assert da_seed.comment_count == Comment.objects.filter(mach=da_seed).count()


def test_post_thuong_la_nhanh_doi_chung(da_seed):
    """`entry_count == 1` + `ket_qua` NULL — hai nhánh 1c phải render khác đi."""
    post = Mach.objects.get(title=TITLE_POST_THUONG)
    assert post.entry_count == 1
    assert post.ket_qua is None
    assert post.status == Mach.TrangThai.MO
    assert post.sub.slug == "crypto"


def test_figures_o_moc_1_va_9_va_khong_o_dau_khac(da_seed):
    co_figures = sorted(
        Moc.objects.filter(mach=da_seed, figures__isnull=False).values_list(
            "seq", flat=True
        )
    )
    assert co_figures == [1, 9]
    for moc in Moc.objects.filter(mach=da_seed, seq__in=[1, 9]):
        assert 1 <= len(moc.figures) <= 6


def test_dung_MOT_moc_co_cau_moi(da_seed):
    co_cau_moi = Moc.objects.filter(
        mach=da_seed, question_for_crowd__isnull=False
    ).values_list("seq", flat=True)
    assert len(co_cau_moi) == 1


def test_cay_binh_luan_co_chieu_sau_va_neo_du_kieu(da_seed):
    binh_luan = list(Comment.objects.filter(mach=da_seed))
    goc = [c for c in binh_luan if c.parent_id is None]
    reply = [c for c in binh_luan if c.parent_id is not None]
    assert goc and reply, "phải có CÂY, không phải danh sách phẳng"
    assert max(c.do_sau for c in binh_luan) >= 3, "phải có ít nhất một nhánh 3 tầng"

    neo = {c.anchor_moc_seq for c in goc}
    assert None in neo, "phải có bình luận gỡ chip (PLAN nguyên tắc 4)"
    assert len(neo - {None}) >= 5, "neo phải rải ra nhiều mốc, không dồn một chỗ"

    assert all(c.anchor_moc_seq is None for c in reply), (
        "reply kế thừa neo của gốc — không được tự mang neo (PLAN nguyên tắc 6)"
    )


def test_co_thread_neo_moc_2_ma_reply_viet_o_thoi_diem_moc_9(da_seed):
    """PLAN nguyên tắc 6 — ngăn kéo mốc 2 phải kể được cả cái kết.

    Đây là mẩu dữ liệu 1c cần để chứng minh ngăn kéo lấy CẢ THREAD chứ không lọc theo
    thời gian. Không có nó thì mọi ngăn kéo trong seed đều "gọn gàng" và bài đo của 1c
    pass rỗng.
    """
    moc9 = Moc.objects.get(mach=da_seed, seq=9)
    goc_moc2 = Comment.objects.filter(
        mach=da_seed, parent__isnull=True, anchor_moc_seq=2
    )
    assert goc_moc2.exists()
    reply_muon = Comment.objects.filter(
        mach=da_seed, parent__in=goc_moc2, created_at__gte=moc9.created_at
    )
    assert reply_muon.exists()


def test_mot_trich_o_moc_7_va_binh_luan_duoc_trich_viet_tu_truoc(da_seed):
    trich = Trich.objects.get(moc__mach=da_seed, moc__seq=TRICH_MOC_SEQ)
    assert trich.removed_at is None
    # PLAN 5.6 rào 2: blockquote hiện "viết ..., trích ..." — muốn hiện được thì hai mốc
    # thời gian phải KHÁC nhau trong dữ liệu seed.
    assert trich.comment.created_at < trich.created_at


def test_ba_vai_cua_PLAN_muc_5_5_la_ba_hang_khac_nhau(da_seed):
    """W6(a) — ba vai của mặt CẶN phải là BA bình luận khác nhau.

    Mặt CẶN dùng ba thứ, và trước đợt vá 2026-08-21 cả ba đều là `r6`:

    - **điểm cao nhất TOÀN MẠCH** — thứ dễ bị lấy nhầm khi cài "mồi bung của dải gập";
    - **điểm cao nhất trong DẢI GẬP** — mồi bung thật (PLAN 5.5: dải gập hiện "5 mốc ·
      43 bình luận" + MỘT trích dẫn nóng nhất);
    - **bình luận ĐƯỢC TRÍCH** — vế trái của phép hợp "đã trích ∪ top-10 wilson" ở chân
      trang.

    Trùng nhau nghĩa là ba tiêu chí nghiệm thu của 1c cùng đo trên một hàng: quên lọc
    dải gập, hoặc lấy nhầm comment đã trích, **vẫn ra đúng kết quả mong đợi**. Bài đo
    này là thứ giữ cho ba tiêu chí đó còn phân biệt được nhau.
    """
    goc = list(Comment.objects.filter(mach=da_seed, parent__isnull=True))
    diem = {c.pk: wilson_lower_bound(c.up_count, c.down_count) for c in goc}

    trong_dai_gap = [c for c in goc if c.anchor_moc_seq in seq_dai_gap(da_seed)]
    assert trong_dai_gap, "dải gập không có bình luận nào — không có mồi bung để đo"

    cao_nhat_toan_mach = max(goc, key=lambda c: diem[c.pk])
    cao_nhat_dai_gap = max(trong_dai_gap, key=lambda c: diem[c.pk])
    duoc_trich = Trich.objects.get(
        moc__mach=da_seed, moc__seq=TRICH_MOC_SEQ, removed_at__isnull=True
    ).comment

    ba_vai = {cao_nhat_toan_mach.pk, cao_nhat_dai_gap.pk, duoc_trich.pk}
    assert len(ba_vai) == 3, (
        "hai trong ba vai đang là cùng một bình luận ⇒ tiêu chí nghiệm thu của 1c không "
        f"đo gì. toàn mạch={cao_nhat_toan_mach.pk} dải gập={cao_nhat_dai_gap.pk} "
        f"trích={duoc_trich.pk}"
    )
    # Vai "cao nhất toàn mạch" phải nằm NGOÀI dải gập — nếu nó nằm trong thì nó cũng là
    # cao nhất dải gập, và hai vai lại chập làm một.
    assert cao_nhat_toan_mach.anchor_moc_seq not in seq_dai_gap(da_seed)


def test_binh_luan_duoc_trich_KHONG_thuoc_top_10_wilson(da_seed):
    """W6(a) — phép hợp "đã trích ∪ top-10 wilson" (PLAN 5.5) không được suy biến.

    Trước đợt vá, comment được trích là `r6` — top-1 wilson. Tập "đã trích" vì thế là
    **con** của top-10, nên một cài đặt 1c quên hẳn vế "∪ đã trích" vẫn cho output giống
    hệt. Nay comment được trích nằm gần bét bảng: quên vế đó là thiếu hàng ngay.
    """
    goc = list(Comment.objects.filter(mach=da_seed, parent__isnull=True))
    xep = sorted(goc, key=lambda c: wilson_lower_bound(c.up_count, c.down_count), reverse=True)
    top_10 = {c.pk for c in xep[:10]}
    duoc_trich = Trich.objects.get(
        moc__mach=da_seed, moc__seq=TRICH_MOC_SEQ, removed_at__isnull=True
    ).comment

    assert len(goc) > 10, "ít hơn 11 bình luận gốc thì top-10 chứa tất, không đo được gì"
    assert duoc_trich.pk not in top_10, (
        "comment được trích lại nằm trong top-10 wilson ⇒ vế '∪ đã trích' của PLAN 5.5 "
        "thừa, và 1c bỏ quên nó vẫn xanh"
    )


def test_co_moc_KHONG_binh_luan_nao_va_moc_do_mang_cau_moi(da_seed):
    """W6(b) — dữ liệu để 1c chứng minh được PLAN 5.4 luật 4.

    Luật 4: *"Mốc 0 bình luận: không hiện `💬 0` — hiện `＋ nói gì đó về mốc này` +
    `question_for_crowd` nếu có"*. Trước đợt vá, **không mốc nào** có 0 bình luận và
    `question_for_crowd` duy nhất lại nằm ở mốc có 2 thread ⇒ cả hai vế của luật 4 không
    có dữ liệu để chạy qua, 1c cài sai cũng không ai biết.

    Mốc rỗng đó còn phải nằm TRONG dải gập: mốc rỗng ở mốc 1 hay mốc cuối thì mặt CẶN mở
    sẵn, không đo được nhánh "bung dải gập rồi mới thấy ngăn kéo rỗng".
    """
    neo = set(
        Comment.objects.filter(mach=da_seed, parent__isnull=True)
        .exclude(anchor_moc_seq=None)
        .values_list("anchor_moc_seq", flat=True)
    )
    moc_rong = [m for m in Moc.objects.filter(mach=da_seed) if m.seq not in neo]
    assert moc_rong, "không mốc nào có 0 bình luận ⇒ PLAN 5.4 luật 4 không có dữ liệu"

    co_cau_moi = [m for m in moc_rong if m.question_for_crowd]
    assert co_cau_moi, (
        f"có mốc rỗng ({[m.seq for m in moc_rong]}) nhưng không mốc nào mang "
        "question_for_crowd ⇒ vế '+ question_for_crowd nếu có' vẫn không đo được"
    )
    assert any(m.seq in seq_dai_gap(da_seed) for m in co_cau_moi), (
        "mốc rỗng mang câu mồi phải nằm trong dải gập của mặt CẶN"
    )


def test_diem_vote_rai_du_de_top_10_wilson_co_nghia(da_seed):
    """PLAN mục 10 đòi đích danh. "Rải" = xếp hạng phân biệt được, không phải cùng điểm."""
    goc = Comment.objects.filter(mach=da_seed, parent__isnull=True)
    diem = [wilson_lower_bound(c.up_count, c.down_count) for c in goc]
    assert len(goc) >= 10
    assert len(set(diem)) >= 10, "quá nhiều bình luận gốc đồng điểm, top-10 vô nghĩa"
    assert any(c.down_count > c.up_count for c in goc), "phải có cả bình luận bị dìm"


def test_dem_vote_khop_so_hang_vote_that(da_seed):
    """Cột denormalize của seed phải bằng số hàng `Vote` thật, không phải số gán tay."""
    lech = []
    for c in Comment.objects.filter(mach=da_seed):
        phieu = Vote.objects.filter(target_type="comment", target_id=c.pk)
        if (c.up_count, c.down_count) != (
            phieu.filter(value=1).count(),
            phieu.filter(value=-1).count(),
        ):
            lech.append(c.pk)
    assert lech == []

    for m in Moc.objects.filter(mach=da_seed):
        phieu = Vote.objects.filter(target_type="moc", target_id=m.pk)
        assert m.score == phieu.filter(value=1).count() - phieu.filter(value=-1).count()


def test_xin_qua_so_nguoi_xem_thi_NO_chu_khong_cat_bot(mach, tac_gia):
    """W5 — cắt lát Python vượt biên KHÔNG báo lỗi, chỉ trả ít hơn.

    Đây là lỗi *đang ngủ* trong seed: hôm nay số phiếu lớn nhất là 31 trên 32 người xem
    nên chưa ai thấy gì. Nhưng nếu nó thức, **không test nào bắt được** — cột
    denormalize được tính lại từ chính số hàng `Vote` đã ghi, nên nó khớp hoàn hảo với
    dữ liệu đã bị cắt, còn bảng số ở đầu `seed_dev.py` thì vẫn ghi con số cũ. File nói
    một đằng, DB một nẻo, và mọi bài đo đối soát đều xanh.

    Gọi thẳng `Command._bo_phieu` thay vì chạy cả seed: bài đo phải chỉ vào đúng cái
    hàng rào, không đi vòng qua 40 giây dựng dữ liệu.
    """
    from tests.conftest import dung_user

    c = Comment.objects.create(mach=mach, author=tac_gia, body="x", path="500000")
    nguoi_xem = [dung_user(f"xem_{i}") for i in range(5)]

    with pytest.raises(ValueError, match="người xem"):
        Command._bo_phieu(c, nguoi_xem, up=4, down=2, nhan="bình luận 'thử'")
    assert not Vote.objects.filter(target_type="comment", target_id=c.pk).exists(), (
        "nổ rồi thì không được ghi phiếu nào — nửa vời còn tệ hơn"
    )

    # Đúng bằng trần thì vẫn phải chạy: hàng rào là `>`, không phải `>=`.
    Command._bo_phieu(c, nguoi_xem, up=3, down=2, nhan="bình luận 'thử'")
    c.refresh_from_db()
    assert (c.up_count, c.down_count) == (3, 2)


def test_moi_hang_trong_bang_seed_deu_nam_trong_tran_phieu():
    """Đối chứng tĩnh: đọc thẳng bảng số, không cần chạy seed.

    Bài trên chứng minh hàng rào hoạt động; bài này chứng minh dữ liệu hiện tại KHÔNG
    chạm hàng rào — tức seed chạy được không phải nhờ may. Nó cũng là chỗ đỏ đầu tiên
    khi ai đó nâng một con số vote lên quá `SO_NGUOI_XEM`.
    """
    from core.management.commands.seed_dev import (
        COMMENTS_POST_THUONG,
        VOTE_MOC_DOWN,
        VOTE_MOC_UP,
    )

    qua_tran = []
    for i, (up, down) in enumerate(zip(VOTE_MOC_UP, VOTE_MOC_DOWN, strict=True)):
        if up + down > SO_NGUOI_XEM:
            qua_tran.append((f"mốc {i + 1}", up, down))
    for hang in COMMENTS_HPG:
        khoa, up, down = hang[0], hang[-2], hang[-1]
        if up + down > SO_NGUOI_XEM:
            qua_tran.append((khoa, up, down))
    for username, _, up, down in COMMENTS_POST_THUONG:
        if up + down > SO_NGUOI_XEM:
            qua_tran.append((username, up, down))
    assert qua_tran == [], f"vượt trần {SO_NGUOI_XEM} người xem: {qua_tran}"


def test_co_user_co_display_name(da_seed):
    assert User.objects.exclude(display_name="").count() >= 5


def test_chay_lan_hai_khong_nhan_doi(da_seed):
    """P10 — đếm bằng SQL sau lượt 2, không đọc log."""
    truoc = {
        "sub": Sub.objects.count(),
        "mach": Mach.objects.count(),
        "moc": Moc.objects.count(),
        "comment": Comment.objects.count(),
        "user": User.objects.count(),
        "vote": Vote.objects.count(),
        "trich": Trich.objects.count(),
    }
    call_command("seed_dev", verbosity=0)
    sau = {
        "sub": Sub.objects.count(),
        "mach": Mach.objects.count(),
        "moc": Moc.objects.count(),
        "comment": Comment.objects.count(),
        "user": User.objects.count(),
        "vote": Vote.objects.count(),
        "trich": Trich.objects.count(),
    }
    assert sau == truoc


def test_reset_dung_lai_tu_dau_khong_de_lai_rac(da_seed):
    call_command("seed_dev", "--reset", verbosity=0)
    assert Mach.objects.filter(title=TITLE_HPG).count() == 1
    assert Sub.objects.count() == 2
    assert User.objects.count() == 11 + SO_NGUOI_XEM
    assert Comment.objects.filter(mach__title=TITLE_HPG).count() == len(COMMENTS_HPG)
    assert Trich.objects.count() == 2


# --- Cổng idempotency lệch một nửa (vá D3, 2026-08-22) ------------------------


def test_DB_co_HPG_ma_chua_co_VNM_thi_seed_dev_DOI_reset(da_seed):
    """Ca của mọi máy đã chạy `seed_dev` TRƯỚC vá B2 — mạch VNM là hàng mới.

    Cổng cũ chỉ nhìn `TITLE_HPG` nên nó in "đã có dữ liệu seed" rồi thoát, và VNM **không
    bao giờ** được dựng. Cái đỏ lên sau đó lại là `apps/web/e2e/mach-can.spec.ts` chết ở
    `beforeAll` với thông báo "seed chưa chạy?" — chỉ sai hướng cho người đi sửa.

    Dựng lại đúng trạng thái đó bằng cách xoá riêng mạch VNM khỏi DB đã seed. `Trich` của
    nó phải đi trước: `Trich.comment` là `PROTECT`, đúng cái bẫy mà `_xoa_seed` gỡ.
    """
    Trich.objects.filter(moc__mach__title=TITLE_BIA_MO).delete()
    Mach.objects.filter(title=TITLE_BIA_MO).delete()
    assert Mach.objects.filter(title=TITLE_HPG).exists()
    assert not Mach.objects.filter(title=TITLE_BIA_MO).exists()

    with pytest.raises(CommandError) as loi:
        call_command("seed_dev", verbosity=0)

    # Không im lặng bỏ qua, và thông báo phải nói ra ĐƯỜNG THOÁT — báo "sai" mà không nói
    # gõ gì tiếp thì người đọc vẫn kẹt ở đúng chỗ cũ.
    assert "--reset" in str(loi.value)
    assert TITLE_BIA_MO in str(loi.value)
    assert "seed_e2e --reset" in str(loi.value), (
        "thiếu thứ tự phục hồi: --reset một mình vẫn nổ ProtectedError trên DB còn dữ "
        "liệu seed_e2e dựng trước vá A3"
    )
    # …và nó KHÔNG dựng bù nửa vời trước khi nổ.
    assert not Mach.objects.filter(title=TITLE_BIA_MO).exists()


def test_DB_co_VNM_ma_mat_HPG_cung_DOI_reset(da_seed):
    """Chiều ngược lại. Cổng phải hỏi cả hai, không phải đổi mốc chặn từ HPG sang VNM."""
    Trich.objects.filter(moc__mach__title=TITLE_HPG).delete()
    Mach.objects.filter(title=TITLE_HPG).delete()

    with pytest.raises(CommandError) as loi:
        call_command("seed_dev", verbosity=0)
    assert TITLE_HPG in str(loi.value)


def test_reset_go_duoc_the_lech_mot_nua(da_seed):
    """Đường thoát mà thông báo lỗi chỉ ra phải thật sự đi được."""
    Trich.objects.filter(moc__mach__title=TITLE_BIA_MO).delete()
    Mach.objects.filter(title=TITLE_BIA_MO).delete()

    call_command("seed_dev", "--reset", verbosity=0)
    assert Mach.objects.filter(title=TITLE_HPG).count() == 1
    assert Mach.objects.filter(title=TITLE_BIA_MO).count() == 1


def test_DB_du_ca_hai_van_la_bo_qua_im_lang(da_seed):
    """Không vá quá tay: trạng thái ĐỦ vẫn phải là "chạy lần hai không làm gì"."""
    truoc = Mach.objects.count()
    call_command("seed_dev", verbosity=0)
    assert Mach.objects.count() == truoc




# --- Mạch bia mộ (vá B2, 2026-08-22) -----------------------------------------
# Trước đợt vá, `grep deleted_at|hidden_at` trên cả hai file seed trả về RỖNG. Nghĩa là
# mọi nhánh render bia mộ của 1c — `the-moc.tsx`, `binh-luan.tsx`, `khoi-trich.tsx` —
# chưa từng được chạy qua một hàng dữ liệu nào, trong khi plan con 1c §2.2 liệt kê chúng
# là hạng mục việc. Các bài dưới đây ghim ba hàng vừa thêm, và ghim luôn **hệ quả** của
# chúng ở tầng đọc, vì chính hệ quả mới là thứ UI nhìn thấy.


def test_mach_bia_mo_dung_hinh_dang(mach_bia_mo):
    assert mach_bia_mo.entry_count == len(MOCS_BIA_MO)
    assert Comment.objects.filter(mach=mach_bia_mo).count() == len(COMMENTS_BIA_MO)
    # Đóng sổ: `test_api_feeds.py` ghim số mạch của feed "Đang diễn ra", và một mạch mở
    # thêm ở đây làm nó đỏ vì lý do không liên quan gì tới bia mộ.
    assert mach_bia_mo.status == Mach.TrangThai.DONG
    assert mach_bia_mo.sub.slug == "chung-khoan"
    # Đủ 4 bình luận đọc được ⇒ nguyên tắc 9 BẬT số đếm. Dưới ngưỡng thì bài đo "nút ngăn
    # kéo của mốc chỉ còn bia mộ không hiện số" đúng vì lý do khác, tức pass rỗng.
    assert mach_bia_mo.comment_count >= 4
    # …và số đếm phải LỆCH số hàng, đó là toàn bộ lý do mạch này tồn tại.
    assert mach_bia_mo.comment_count < len(COMMENTS_BIA_MO)


def test_co_moc_bia_mo_va_no_KHONG_lam_tut_entry_count(mach_bia_mo):
    moc = Moc.objects.get(mach=mach_bia_mo, seq=MOC_BIA_MO_SEQ)
    assert moc.deleted_at is not None
    assert moc.hidden_at is None, "chọn ca TỰ XOÁ — ca mod ẩn mốc còn chờ user duyệt"
    # PLAN mục 6: `entry_count` đo CẤU TRÚC. Bia mộ giữ chỗ, `seq` bất biến, và dải gập
    # của mặt CẶN suy thẳng từ con số này — tụt một là gập nhầm ô.
    assert mach_bia_mo.entry_count == Moc.objects.filter(mach=mach_bia_mo).count()
    assert mach_bia_mo.entry_count == max(
        Moc.objects.filter(mach=mach_bia_mo).values_list("seq", flat=True)
    )
    # Bia mộ mốc nằm NGOÀI dải gập ⇒ thấy được ngay trên mặt tiền, không phải bấm bung.
    assert MOC_BIA_MO_SEQ not in seq_dai_gap(mach_bia_mo)


def test_moc_chi_con_bia_mo_co_so_binh_luan_0_MA_ngan_keo_khong_rong(mach_bia_mo):
    """Ca của vá B1 — `so_binh_luan` và lát cắt trả lời hai câu hỏi khác nhau.

    `so_binh_luan` đếm bình luận ĐỌC ĐƯỢC; `GET /mocs/{id}/comments` vẫn trả bia mộ. Mốc
    3 của mạch này có đúng một thread, thread đó đã được trích vào sổ rồi tác giả tự xoá
    ⇒ số là 0 mà lát cắt có hàng. Trang mạch hỏi con số thay vì hỏi lát cắt thì cái nút
    mời "＋ nói gì đó về mốc này" mở ra "Chưa ai neo bình luận vào mốc này" — ngay bên
    dưới blockquote trích từ chính bình luận đó.
    """
    from core.doc_noi_dung import (
        dem_binh_luan_theo_moc,
        lat_cat_ngan_keo,
        nap_binh_luan,
        tap_tung_duoc_trich,
    )

    seq = TRICH_BIA_MO_MOC_SEQ
    assert seq in seq_dai_gap(mach_bia_mo), (
        "ca B1 phải nằm TRONG dải gập — cùng với bia mộ mốc ở ngoài, hai bài đo phủ được "
        "cả hai phía của cái nút bung"
    )
    dem = dem_binh_luan_theo_moc(mach_bia_mo)
    assert dem.get(seq, 0) == 0, "mốc này phải có 0 bình luận ĐỌC ĐƯỢC"

    lat = lat_cat_ngan_keo(
        nap_binh_luan(mach_bia_mo),
        seq=seq,
        tung_duoc_trich=tap_tung_duoc_trich(mach_bia_mo),
    )
    assert len(lat) == 1, f"lát cắt mốc {seq} phải còn đúng một bia mộ, đang có {len(lat)}"
    assert not lat[0].hien_noi_dung


def test_binh_luan_tu_xoa_o_lai_CHI_VI_da_tung_duoc_trich(mach_bia_mo):
    """PLAN 5.3 dòng 175 — hai điều kiện giữ chỗ, và chúng không thay nhau được."""
    c = Comment.objects.get(mach=mach_bia_mo, deleted_at__isnull=False)
    assert c.hidden_at is None, "chọn ca TỰ XOÁ thuần, để hai nhãn không lẫn nhau"
    assert not Comment.objects.filter(parent=c).exists(), (
        "còn con thì nó ở lại vì điều kiện 1, và điều kiện 2 (đã từng được trích) không "
        "được chứng minh gì cả"
    )
    trich = Trich.objects.get(moc__mach=mach_bia_mo, moc__seq=TRICH_BIA_MO_MOC_SEQ)
    assert trich.comment_id == c.pk
    assert trich.created_at < c.deleted_at, (
        "chủ mạch phải trích TRƯỚC, tác giả xoá SAU — đó là ca mà PLAN 5.6 dựng 'cuốn sổ "
        "không-xoá-được' để chống"
    )


def test_binh_luan_mod_an_o_lai_CHI_VI_con_con_song_sot(mach_bia_mo):
    an = Comment.objects.get(mach=mach_bia_mo, hidden_at__isnull=False)
    assert an.deleted_at is None, "chọn ca MOD ẨN thuần"
    assert not Trich.objects.filter(comment=an).exists(), (
        "nếu nó cũng từng được trích thì hai điều kiện chồng lên nhau, và bài đo không "
        "còn phân biệt được cái nào giữ nó ở lại"
    )
    con = Comment.objects.filter(
        parent=an, deleted_at__isnull=True, hidden_at__isnull=True
    )
    assert con.exists(), (
        f"{BINH_LUAN_MOD_AN!r} bị mod ẩn mà không còn con đọc được ⇒ `dung_cay` bỏ hẳn "
        "nó, và nhánh 'bia mộ vì còn con' lại không có dữ liệu"
    )


def test_hai_kieu_bia_mo_binh_luan_la_HAI_hang_khac_nhau(mach_bia_mo):
    """Chập làm một thì một trong hai nhánh render không có dữ liệu chạy qua."""
    tu_xoa = Comment.objects.get(mach=mach_bia_mo, deleted_at__isnull=False)
    mod_an = Comment.objects.get(mach=mach_bia_mo, hidden_at__isnull=False)
    assert tu_xoa.pk != mod_an.pk

    # Và ĐÚNG hai hàng mà bảng hằng số chỉ định — nối hằng số với DB qua `body`, thứ duy
    # nhất đi được cả hai chiều.
    #
    # Vá E3 (2026-08-22): dòng cũ ở đây là `assert BINH_LUAN_TU_XOA in khoa and
    # BINH_LUAN_MOD_AN in khoa` — hai hằng số đối chiếu bảng hằng số **cùng file**, đúng
    # bất kể DB chứa gì. Đổi `BINH_LUAN_TU_XOA = "b2"` cho trùng `BINH_LUAN_MOD_AN` thì
    # nó vẫn xanh, trong khi ý cả bài đo là hai vai không được rơi vào một hàng.
    than = {c[0]: c[5] for c in COMMENTS_BIA_MO}
    assert tu_xoa.body == than[BINH_LUAN_TU_XOA], (
        f"hàng TỰ XOÁ trong DB không phải bình luận {BINH_LUAN_TU_XOA!r} mà bảng hằng "
        "số chỉ định"
    )
    assert mod_an.body == than[BINH_LUAN_MOD_AN], (
        f"hàng MOD ẨN trong DB không phải bình luận {BINH_LUAN_MOD_AN!r}"
    )
