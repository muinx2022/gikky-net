"""Ràng buộc phải tồn tại **ở tầng DB**, không chỉ trong code Python.

Plan con Phase 1a 2.1 và tiêu chí P2/P6. Hai kiểu đo, cố ý dùng cả hai:

- **đọc `pg_indexes` / `pg_constraint`** — chứng minh cái `WHERE` của index partial thật
  sự có trong DB. Một `UniqueConstraint(condition=...)` viết thiếu `condition` vẫn chặn
  được lần trích thứ hai (vì lần đầu chưa gỡ), nên bài đo hành vi một mình không phân
  biệt được partial với unique thường;
- **vi phạm thật** — chứng minh ràng buộc đang *bật*. Một index có thể tồn tại mà
  `NOT VALID` hoặc bị drop bởi migration sau; đọc catalog một mình không thấy.
"""

import pytest
from django.db import IntegrityError, connection, transaction
from django.utils import timezone

from core.ghi import tao_binh_luan, them_moc
from core.models import Comment, Moc, Trich, User, Vote

pytestmark = pytest.mark.django_db


def dinh_nghia_index(ten: str) -> str:
    with connection.cursor() as cur:
        cur.execute("SELECT indexdef FROM pg_indexes WHERE indexname = %s", [ten])
        hang = cur.fetchone()
    assert hang is not None, f"không có index tên {ten!r} trong DB"
    return hang[0]


def dinh_nghia_check(ten: str) -> str:
    with connection.cursor() as cur:
        cur.execute(
            "SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname = %s",
            [ten],
        )
        hang = cur.fetchone()
    assert hang is not None, f"không có constraint tên {ten!r} trong DB"
    return hang[0]


# --- Trich: partial unique (PLAN 5.6 rào 1, tiêu chí P6) -------------------


def test_trich_unique_la_PARTIAL_co_menh_de_where():
    dn = dinh_nghia_index("trich_mot_hieu_luc_moi_moc")
    assert "UNIQUE" in dn
    assert "(moc_id)" in dn
    assert "WHERE (removed_at IS NULL)" in dn, dn


def test_trich_thu_hai_cung_moc_bi_chan_va_go_roi_trich_lai_duoc(
    mach, tac_gia, nguoi_khac
):
    moc = Moc.objects.get(mach=mach, seq=1)
    c1 = tao_binh_luan(mach=mach, author=nguoi_khac, body="câu 1", anchor_moc_seq=1)
    c2 = tao_binh_luan(mach=mach, author=nguoi_khac, body="câu 2", anchor_moc_seq=1)

    t1 = Trich.objects.create(moc=moc, comment=c1)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Trich.objects.create(moc=moc, comment=c2)

    t1.removed_at = timezone.now()
    t1.save(update_fields=["removed_at"])
    t2 = Trich.objects.create(moc=moc, comment=c2)

    assert Trich.objects.filter(moc=moc).count() == 2, "hàng đã gỡ phải ở lại làm log"
    assert Trich.objects.filter(moc=moc, removed_at__isnull=True).get() == t2


def test_xoa_binh_luan_DA_TRICH_bi_chan_va_hang_trich_o_lai(mach, nguoi_khac):
    """PLAN 5.6 gọi sổ trích là "cuốn sổ không-xoá-được" — đây là chỗ chữ đó thành thật.

    PLAN 5.3 cho **xoá thật** bình luận không dính reply lẫn trích, nên Phase 2 sẽ có
    `DELETE` thật. Dưới `on_delete=CASCADE` (bản trước đợt vá), một lời gọi
    `DELETE /comments/{id}` xoá luôn hàng `Trich`: blockquote biến khỏi mốc của một mạch
    đã đóng sổ, chỉ số "Được trích ×N" tụt, hàng log biến mất — **không exception, không
    audit, HTTP vẫn 200**.

    `PROTECT` biến chuyện đó thành `ProtectedError` ngay tại đường ghi, ép Phase 2 viết
    ra luật đúng: bình luận đã trích thì chỉ xoá MỀM, blockquote ở lại.
    """
    from django.db.models import ProtectedError

    moc = Moc.objects.get(mach=mach, seq=1)
    c = tao_binh_luan(mach=mach, author=nguoi_khac, body="câu được trích", anchor_moc_seq=1)
    t = Trich.objects.create(moc=moc, comment=c)

    with pytest.raises(ProtectedError):
        with transaction.atomic():
            c.delete()

    assert Trich.objects.filter(pk=t.pk).exists(), "hàng Trich phải còn — nó là log"
    assert Comment.objects.filter(pk=c.pk).exists(), "bình luận cũng phải còn nguyên"


def test_xoa_binh_luan_co_trich_DA_GO_van_bi_chan(mach, nguoi_khac):
    """X2 — ca "đã TỪNG được trích", vế mà bài trên KHÔNG chạm tới.

    Bài trên chỉ dựng trích **đang hiệu lực**, nên nó xanh y hệt dưới một `PROTECT` chỉ
    áp cho `removed_at IS NULL` — thứ không tồn tại trong Django, nhưng cũng xanh y hệt
    nếu ai đó đổi sang `SET_NULL` + tiền-kiểm ở tầng API. Vế còn thiếu là hàng `Trich`
    đã gỡ: PLAN 5.6 giữ nó lại vì **"tự nó là log"**, và PLAN 5.3 (bản 2026-08-21) vì thế
    viết "đã **TỪNG** được trích (kể cả trích đã gỡ)".

    Đo cả hai vế là cách duy nhất chốt được code đứng ở phía nào của câu chữ đó. Đứng
    nhầm phía thì Phase 2 tiền-kiểm `removed_at IS NULL`, thấy "chưa trích", quyết xoá
    thật, rồi ăn `ProtectedError` từ DB → **500 trên một thao tác hợp lệ của chính chủ**.
    """
    from django.db.models import ProtectedError

    moc = Moc.objects.get(mach=mach, seq=1)
    c = tao_binh_luan(mach=mach, author=nguoi_khac, body="câu từng được trích", anchor_moc_seq=1)
    t = Trich.objects.create(moc=moc, comment=c)
    t.removed_at = timezone.now()
    t.save(update_fields=["removed_at"])

    with pytest.raises(ProtectedError):
        with transaction.atomic():
            c.delete()

    t.refresh_from_db()
    assert t.removed_at is not None, "hàng đã gỡ phải ở lại NGUYÊN trạng thái đã gỡ"
    assert Comment.objects.filter(pk=c.pk).exists(), "bình luận phải còn — chỉ xoá mềm được"


def test_xoa_binh_luan_CHUA_trich_van_duoc(mach, nguoi_khac):
    """Đối chứng của bài trên: `PROTECT` không được biến thành "cấm xoá mọi bình luận".

    Không có bài này thì một cài đặt chặn xoá TẤT CẢ (vd `PROTECT` nhầm chỗ, hoặc một
    signal `pre_delete` chặn tuốt) vẫn làm bài trên xanh, trong khi nó phá thẳng PLAN 5.3.
    """
    c = tao_binh_luan(mach=mach, author=nguoi_khac, body="câu thường", anchor_moc_seq=1)
    c.delete()
    assert not Comment.objects.filter(pk=c.pk).exists()


# --- Moc: UNIQUE (mach, seq) ----------------------------------------------


def test_moc_unique_ghim_dung_HAI_cot_mach_va_seq():
    """Ghim **cột**, không ghim tên.

    Bản trước của bài đo này viết `assert "moc_duy_nhat_seq" in dinh_nghia_index(
    "moc_duy_nhat_seq")` — tautology: `dinh_nghia_index` đã tự đỏ khi không có index tên
    đó, và `CREATE ... INDEX moc_duy_nhat_seq ...` thì đương nhiên chứa chính tên mình.
    Nó xanh với MỌI định nghĩa index, kể cả `UniqueConstraint(fields=["seq"])` — tức
    "mỗi số seq chỉ tồn tại một lần trên TOÀN BỘ site", một ràng buộc sai đến mức mạch
    thứ hai không tạo nổi mốc 1.
    """
    dn = dinh_nghia_index("moc_duy_nhat_seq")
    assert "UNIQUE" in dn, dn
    assert "(mach_id, seq)" in dn, dn


def test_moc_trung_seq_bi_chan(mach, tac_gia):
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Moc.objects.create(
                mach=mach, seq=1, author=tac_gia, occurred_at="2026-08-21", body="trùng"
            )


# --- Comment: UNIQUE (mach, path) + index partial cho ngăn kéo -------------


def test_comment_trung_path_bi_chan(mach, tac_gia):
    c = tao_binh_luan(mach=mach, author=tac_gia, body="gốc", anchor_moc_seq=1)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Comment.objects.create(
                mach=mach, author=tac_gia, body="trùng path", path=c.path
            )


def test_seq_bang_0_bi_db_tu_choi(mach, tac_gia):
    """PLAN mục 2 đánh số mốc 1..n. `PositiveIntegerField` một mình chỉ chặn tới `>= 0`.

    `seq = 0` không phải giá trị vô hại: `Follow.last_seen_entry_seq = 0` nghĩa là "chưa
    xem mốc nào", nên tồn tại mốc số 0 làm "chưa xem gì" và "đã xem mốc 0" thành một.
    """
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Moc.objects.create(
                mach=mach, seq=0, author=tac_gia, occurred_at="2026-08-21", body="mốc 0"
            )


def test_anchor_bang_0_bi_tu_choi_nhung_NULL_thi_khong(mach, tac_gia):
    """`anchor_moc_seq = 0` là neo trỏ vào mốc không tồn tại — chip `‹mốc 0›` vô nghĩa.

    `NULL` thì ngược lại: đó là "đã gỡ chip" (PLAN nguyên tắc 4), một trạng thái hợp lệ
    và có ý nghĩa. Hai vế đo trong cùng một bài để không ai "sửa" ràng buộc thành
    `NOT NULL` rồi tưởng đã xong.
    """
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Comment.objects.create(
                mach=mach, author=tac_gia, body="neo 0", path="900000", anchor_moc_seq=0
            )
    c = Comment.objects.create(
        mach=mach, author=tac_gia, body="gỡ chip", path="900001", anchor_moc_seq=None
    )
    assert c.anchor_moc_seq is None


def test_mach_slug_khong_con_index_nao(mach):
    """W10 — `SlugField` mặc định dựng 2 cây trên Postgres (b-tree + varchar_pattern_ops).

    Không truy vấn nào tra mạch theo slug: URL là `/m/<slug>-<id>`, 1c đọc theo `id` rồi
    so slug trong bộ nhớ để quyết định 301 (PLAN 5.9). Bài đo này đọc catalog chứ không
    đọc `db_index=` trong model — cái sau chỉ nói ý định, cái này nói DB thật có gì.
    """
    with connection.cursor() as cur:
        cur.execute(
            "SELECT indexname, indexdef FROM pg_indexes "
            "WHERE tablename = 'core_mach' AND indexdef LIKE %s",
            ["%(slug%"],
        )
        thua = cur.fetchall()
    assert thua == [], f"còn index trên slug, không ai dùng: {thua}"


def test_index_ngan_keo_la_partial_theo_parent_null():
    dn = dinh_nghia_index("comment_anchor_goc")
    assert "(mach_id, anchor_moc_seq)" in dn, dn
    assert "WHERE (parent_id IS NULL)" in dn, dn


def test_index_mach_author_ton_tai_cho_luat_bao():
    """PLAN 5.5: "user từng bình luận mạch này" là một trong hai vế của mặt BÃO."""
    assert "(mach_id, author_id)" in dinh_nghia_index("comment_mach_author")


def test_co_index_phuc_vu_tra_cuu_mach_path():
    """Chỉ MỘT cây trên `(mach_id, path)`, và đó là cây của ràng buộc unique.

    PLAN mục 6 bản đầu liệt kê cả `UNIQUE (mach, path)` lẫn `INDEX (mach, path)`; đợt vá
    2026-08-21 sửa ngược PLAN để bỏ cái thứ hai, vì cây unique đã phủ hết (chứng minh
    bằng `EXPLAIN` ở `tests/test_gom_subtree.py`) còn cây thứ hai thì phải ghi thêm mỗi
    lần `INSERT`.

    Bài đo này CHỈ khẳng định cây đó tồn tại — nó cố tình **không** nói gì về việc
    planner dùng được nó hay không. Bản Phase 1a trước dừng ở đây và tưởng thế là đủ;
    phản biện chứng minh không: index có thật, truy vấn vẫn quét. `test_gom_subtree.py`
    mới là chỗ trả lời câu hỏi đó.
    """
    with connection.cursor() as cur:
        cur.execute(
            "SELECT indexname FROM pg_indexes "
            "WHERE tablename = 'core_comment' AND indexdef LIKE %s",
            ["%(mach_id, path%"],
        )
        cay = [hang[0] for hang in cur.fetchall()]
    assert cay == ["comment_duy_nhat_path"], cay


# --- Mach: index feed, có cái partial theo status --------------------------


@pytest.mark.parametrize(
    "ten,manh",
    [
        ("mach_sub_last_entry", "(sub_id, last_entry_at DESC)"),
        ("mach_author_created", "(author_id, created_at DESC)"),
        ("mach_created_desc", "(created_at DESC)"),
    ],
)
def test_index_feed_cua_mach(ten, manh):
    assert manh in dinh_nghia_index(ten)


def test_index_feed_dang_dien_ra_la_partial_theo_status_open():
    dn = dinh_nghia_index("mach_open_last_entry")
    assert "(last_entry_at DESC)" in dn, dn
    assert "WHERE ((status)::text = 'open'::text)" in dn, dn


# --- Vote ------------------------------------------------------------------


def test_vote_check_ghim_dung_TAP_gia_tri_chi_gom_am_1_va_1():
    """Ghim nguyên văn tập giá trị, không chỉ ghim "có một cái CHECK ở đây".

    Bản trước viết `assert "value = ANY" in ...`, xanh với mọi tập — kể cả
    `Q(value__in=[-1, 1, 5])`. Tập đó vẫn chặn `0` nên bài đo hành vi
    (`test_vote_gia_tri_0_bi_db_tu_choi`) cũng xanh, và một hàng `value = 5` sẽ lặng lẽ
    cộng 1 vào `up_count` mà không ai thấy: `_ap_delta_vote` chỉ hỏi "có bằng 1 không",
    còn `dat_vote_hang_loat` đếm `filter(value=1)`. Nghĩa là phiếu +5 vừa chiếm suất
    unique vừa không được đếm.

    Nguyên văn Postgres in ra cho `Q(value__in=[-1, 1])` trên `SmallIntegerField`:
    `CHECK ((value = ANY (ARRAY['-1'::integer, 1])))`.
    """
    dn = dinh_nghia_check("vote_gia_tri_hop_le")
    assert "ARRAY['-1'::integer, 1]" in dn, dn


def test_vote_gia_tri_0_bi_db_tu_choi(mach, nguoi_khac):
    """Rút vote = XOÁ hàng. Hàng `value = 0` phải không tồn tại được ở tầng DB."""
    moc = Moc.objects.get(mach=mach, seq=1)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Vote.objects.create(
                user=nguoi_khac, target_type="moc", target_id=moc.pk, value=0
            )


def test_vote_trung_dich_bi_chan(mach, nguoi_khac):
    moc = Moc.objects.get(mach=mach, seq=1)
    Vote.objects.create(user=nguoi_khac, target_type="moc", target_id=moc.pk, value=1)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Vote.objects.create(
                user=nguoi_khac, target_type="moc", target_id=moc.pk, value=-1
            )


# --- Reaction · Follow · Notification --------------------------------------


def test_reaction_mot_nguoi_mot_moc(mach, nguoi_khac):
    from core.models import Reaction

    moc = Moc.objects.get(mach=mach, seq=1)
    Reaction.objects.create(user=nguoi_khac, moc=moc, emoji=Reaction.Emoji.LUA)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Reaction.objects.create(user=nguoi_khac, moc=moc, emoji=Reaction.Emoji.BANG)


def test_follow_mot_nguoi_mot_mach(mach, nguoi_khac):
    from core.models import Follow

    Follow.objects.create(user=nguoi_khac, mach=mach)
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Follow.objects.create(user=nguoi_khac, mach=mach)


def test_notification_dedupe_chan_trung_nhung_NULL_thi_khong(nguoi_khac):
    """PLAN 5.8: gộp theo `dedupe_key`; `NULL` là "không gộp", phải cho phép nhiều hàng.

    Postgres coi mọi `NULL` là khác nhau trong unique index — hành vi này là thứ cả cơ
    chế dựa vào, nên nó phải được ghim lại chứ không để mặc định.
    """
    from core.models import Notification

    Notification.objects.create(
        user=nguoi_khac, type="moc_moi", dedupe_key="moc_moi:1000:20260821"
    )
    with pytest.raises(IntegrityError):
        with transaction.atomic():
            Notification.objects.create(
                user=nguoi_khac, type="moc_moi", dedupe_key="moc_moi:1000:20260821"
            )

    Notification.objects.create(user=nguoi_khac, type="reply")
    Notification.objects.create(user=nguoi_khac, type="reply")
    assert Notification.objects.filter(user=nguoi_khac, dedupe_key=None).count() == 2


# --- User: xoá tác giả bị chặn (GDPR-lite = ẩn danh hoá, không DELETE) -----


def test_xoa_user_con_noi_dung_bi_chan(mach, tac_gia):
    from django.db.models import ProtectedError

    them_moc(mach=mach, author=tac_gia, body="mốc 2")
    with pytest.raises(ProtectedError):
        User.objects.filter(pk=tac_gia.pk).delete()
