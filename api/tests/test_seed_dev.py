"""`manage.py seed_dev` — plan con Phase 1a 2.4 / 2.5 (6), tiêu chí P10.

Đếm bằng truy vấn, không đọc log của command: "chạy 2 lần không nhân đôi" mà kiểm bằng
dòng chữ command tự in ra thì đang tin lời khai của bị cáo (plan con mục 4.3).
"""

import pytest
from django.core.management import call_command

from core.management.commands.seed_dev import (
    COMMENTS_HPG,
    SO_NGUOI_XEM,
    TITLE_HPG,
    TITLE_POST_THUONG,
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


def seq_dai_gap(mach: Mach) -> set[int]:
    """`seq` của những mốc nằm trong **dải gập** ở mặt CẶN.

    PLAN 5.5 tả mặt CẶN là "toàn bộ mốc (mốc 1 + gập giữa + 2 mốc cuối)". Nghĩa là mốc 1
    và hai mốc cuối luôn mở, phần giữa gập lại. Với mạch 9 mốc: mở {1, 8, 9}, gập
    {2..7}.

    Định nghĩa nằm ở test chứ chưa nằm ở code sản phẩm vì 1a không render gì; 1c sẽ cài
    lại nó. Điều đó KHÔNG làm bài đo rỗng: thứ đang đo là **dữ liệu seed**, và câu hỏi
    là "hai vai khác nhau có rơi vào cùng một hàng không". Trả lời câu đó cần một định
    nghĩa dải gập, và đây là định nghĩa nguyên văn theo PLAN.
    """
    n = mach.entry_count
    assert n >= 4, "mạch quá ngắn thì không có dải gập để nói"
    return set(range(2, n - 1))


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
    trich = Trich.objects.get(moc__mach=da_seed)
    assert trich.moc.seq == TRICH_MOC_SEQ
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
    duoc_trich = Trich.objects.get(moc__mach=da_seed, removed_at__isnull=True).comment

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
    duoc_trich = Trich.objects.get(moc__mach=da_seed, removed_at__isnull=True).comment

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
    assert Trich.objects.count() == 1
