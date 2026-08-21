"""`GET /users/{username}` — hồ sơ công khai. PLAN 5.9, 5.6 rào 3."""

from datetime import timedelta

import pytest
from django.utils import timezone

from api.users import SO_MACH_TREN_HO_SO
from core.ghi import tao_mach
from core.models import Comment, Mach, Moc, Trich
from tests.conftest import lay

pytestmark = pytest.mark.django_db


def test_ho_so_chu_mach_hpg(client, seed):
    d = lay(client, "/api/v1/users/ba_muoi_phien")

    assert d["username"] == "ba_muoi_phien"
    assert d["display_name"] == "Ba Mươi Phiên"
    assert d["so_mach"] == 1
    assert d["so_moc"] == 9
    assert d["so_binh_luan"] == Comment.objects.filter(mach=seed, author=seed.author).count()
    assert [m["id"] for m in d["machs"]] == [seed.pk]


def test_duoc_trich_dem_theo_so_CHU_MACH_khac_nhau(client, seed):
    """PLAN 5.6 rào 3 — đếm theo người trích, không theo số lần trích.

    Không có rào này thì hai nick trích qua lại vài chục lần là chỉ số "Được trích ×N"
    thành máy in địa vị. Bài đo dựng đúng ca đó: cùng một chủ mạch trích **hai lần** cho
    cùng một người ⇒ chỉ số vẫn phải là 1.
    """
    trich = Trich.objects.get(moc__mach=seed, removed_at__isnull=True)
    nguoi_duoc_trich = trich.comment.author
    assert lay(client, f"/api/v1/users/{nguoi_duoc_trich.username}")["duoc_trich"] == 1

    # Cùng chủ mạch (`seed.author`) trích thêm một bình luận nữa của cùng người đó.
    them = Comment.objects.filter(
        mach=seed, author=nguoi_duoc_trich, parent__isnull=True
    ).exclude(pk=trich.comment_id).first() or trich.comment
    Trich.objects.create(moc=Moc.objects.get(mach=seed, seq=8), comment=them)

    assert lay(client, f"/api/v1/users/{nguoi_duoc_trich.username}")["duoc_trich"] == 1


def test_trich_da_go_khong_tinh_vao_chi_so(client, seed):
    trich = Trich.objects.get(moc__mach=seed, removed_at__isnull=True)
    ten = trich.comment.author.username
    assert lay(client, f"/api/v1/users/{ten}")["duoc_trich"] == 1

    Trich.objects.filter(pk=trich.pk).update(removed_at=timezone.now())
    assert lay(client, f"/api/v1/users/{ten}")["duoc_trich"] == 0


@pytest.mark.parametrize(
    "che",
    [
        "mach_an",
        "moc_an",
        "moc_xoa",
        "comment_an",
    ],
)
def test_duoc_trich_TUT_khi_khoi_trich_bien_mat(client, seed, che):
    """Rào 3 của PLAN 5.6 thủng nếu `duoc_trich` không lọc moderation.

    Ba con số bên cạnh (`so_mach`, `so_moc`, `so_binh_luan`) lọc đủ ba tầng, còn
    `duoc_trich` bản đầu chỉ lọc `removed_at`. Hệ quả nhìn thấy được: mod ẩn **cả mạch**
    ⇒ ba con số về 0 mà "Được trích ×1" vẫn sáng — đúng cái "máy in địa vị" mà rào 3 dựng
    lên để chặn, và nó im lặng.

    Bốn ca là **đúng bốn cửa** làm khối trích biến mất khỏi thẻ mốc, mỗi ca một cột khác
    nhau, để một bộ lọc bị bỏ quên không núp được sau ba bộ lọc kia. Cửa thứ năm — tác giả
    tự xoá bình luận — KHÔNG có ở đây và không được thêm vào: xem bài ngay dưới.
    """
    trich = Trich.objects.get(moc__mach=seed, removed_at__isnull=True)
    ten = trich.comment.author.username
    assert lay(client, f"/api/v1/users/{ten}")["duoc_trich"] == 1

    khi = timezone.now()
    if che == "mach_an":
        Mach.objects.filter(pk=seed.pk).update(hidden_at=khi)
    elif che == "moc_an":
        Moc.objects.filter(pk=trich.moc_id).update(hidden_at=khi)
    elif che == "moc_xoa":
        Moc.objects.filter(pk=trich.moc_id).update(deleted_at=khi)
    else:
        Comment.objects.filter(pk=trich.comment_id).update(hidden_at=khi)

    assert lay(client, f"/api/v1/users/{ten}")["duoc_trich"] == 0, che


def test_duoc_trich_KHONG_TUT_khi_tac_gia_tu_xoa_binh_luan(client, seed):
    """Chiều ngược của bài trên — §5b: `duoc_trich` soi gương đúng cái blockquote.

    `trinh_bay.trich_ra` giữ NGUYÊN body của khối trích khi tác giả tự xoá bình luận
    (PLAN 5.6, "cuốn sổ không-xoá-được" chống *tác giả* rút chữ). Nếu `duoc_trich` lọc
    thêm `comment__deleted_at` thì hai cửa nói hai chuyện về cùng một sự kiện: blockquote
    còn nguyên chữ trên trang mạch, chỉ số trên hồ sơ đã tụt, và không con số nào giải
    thích được nữa.

    Bài này ghim luôn cả hai đầu — chỉ số KHÔNG đổi **và** blockquote vẫn còn body — để
    lần sau ai đó "thống nhất" `duoc_trich` với ba con số kia thì đỏ ngay tại đây.
    """
    trich = Trich.objects.get(moc__mach=seed, removed_at__isnull=True)
    ten = trich.comment.author.username
    assert lay(client, f"/api/v1/users/{ten}")["duoc_trich"] == 1

    Comment.objects.filter(pk=trich.comment_id).update(deleted_at=timezone.now())

    assert lay(client, f"/api/v1/users/{ten}")["duoc_trich"] == 1

    khoi = next(
        m["trich"]
        for m in lay(client, f"/api/v1/machs/{seed.pk}")["mocs"]
        if m["trich"] is not None
    )
    assert khoi["comment_id"] == trich.comment_id
    assert khoi["trang_thai"] == "da_xoa"
    assert khoi["body"], "blockquote phải còn body — nếu không, vế đối chiếu ở trên rỗng"


def test_noi_dung_bi_an_hoac_xoa_khong_duoc_dem(client, seed):
    truoc = lay(client, "/api/v1/users/ba_muoi_phien")

    Moc.objects.filter(mach=seed, seq=2).update(hidden_at=timezone.now())
    Moc.objects.filter(mach=seed, seq=3).update(deleted_at=timezone.now())
    cua_chu = Comment.objects.filter(mach=seed, author=seed.author).first()
    Comment.objects.filter(pk=cua_chu.pk).update(deleted_at=timezone.now())

    sau = lay(client, "/api/v1/users/ba_muoi_phien")
    assert sau["so_moc"] == truoc["so_moc"] - 2
    assert sau["so_binh_luan"] == truoc["so_binh_luan"] - 1


def test_noi_dung_trong_mach_bi_an_cung_khong_duoc_dem(client, seed):
    Mach.objects.filter(pk=seed.pk).update(hidden_at=timezone.now())
    d = lay(client, "/api/v1/users/ba_muoi_phien")

    assert d["so_mach"] == 0
    assert d["so_moc"] == 0
    assert d["so_binh_luan"] == 0
    assert d["machs"] == []


def test_ho_so_khong_lo_email_hay_trang_thai_ban(client, seed):
    """Endpoint công khai: chỉ những trường PLAN 5.9 liệt kê, không hơn."""
    d = lay(client, "/api/v1/users/ba_muoi_phien")
    assert set(d) == {
        "username",
        "display_name",
        "bio",
        "date_joined",
        "so_mach",
        "so_moc",
        "so_binh_luan",
        "duoc_trich",
        "machs",
    }


def test_user_khong_ton_tai_tra_404(client, db):
    d = lay(client, "/api/v1/users/khong-co-ai", status=404)
    assert d["code"] == "khong_tim_thay"


def test_ho_so_cat_o_limit_va_so_mach_van_dem_ca_phan_bi_cat(client, sub, tac_gia):
    """Hồ sơ cắt cứng ở `?limit=` (mặc định 20) và **không có cursor** — Z14.

    Trước lượt vá, cảnh báo này chỉ sống trong một comment `#:`, mà chính 1b đã chứng
    minh bằng test rằng comment `#:` không ra tới `openapi.json`; và **không bài đo nào
    dựng quá 20 mạch** nên hành vi cắt chưa từng chạy qua. Người dùng API đọc `machs` như
    "toàn bộ mạch của người này" sẽ mất im lặng phần dôi ra.
    """
    for i in range(25):
        tao_mach(sub=sub, author=tac_gia, title=f"Mạch {i:02d}", body="Mốc 1.")

    d = lay(client, f"/api/v1/users/{tac_gia.username}")
    assert len(d["machs"]) == SO_MACH_TREN_HO_SO == 20
    assert d["so_mach"] == 25, "`so_mach` đếm cả phần bị cắt, không phải len(machs)"

    # Không có cursor nào trong response — phần dôi ra chỉ lấy được bằng `?limit=`.
    assert "cursor_ke_tiep" not in d
    assert len(lay(client, f"/api/v1/users/{tac_gia.username}?limit=25")["machs"]) == 25
    assert lay(client, f"/api/v1/users/{tac_gia.username}?limit=51", status=400)[
        "code"
    ] == "tham_so_khong_hop_le"


def test_mach_tren_ho_so_moi_nhat_truoc(client, sub, tac_gia):
    cu, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch cũ",
        body="Mốc 1.",
        _created_at_seed=timezone.now() - timedelta(days=9),
    )
    moi, _ = tao_mach(sub=sub, author=tac_gia, title="Mạch mới", body="Mốc 1.")

    d = lay(client, f"/api/v1/users/{tac_gia.username}")
    assert [m["id"] for m in d["machs"]] == [moi.pk, cu.pk]
    assert d["so_mach"] == 2
