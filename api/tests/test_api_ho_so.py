"""`GET /users/{username}` — hồ sơ công khai. PLAN 5.9, 5.6 rào 3."""

from datetime import timedelta

import pytest
from django.utils import timezone

from api.users import SO_MACH_TREN_HO_SO
from core.ghi import tao_mach
from core.models import Comment, Mach, Moc, Trich
from tests.conftest import lay, viet

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


def test_TU_TRICH_khong_cong_vao_duoc_trich(client, seed):
    """PLAN 5.6 rào 3, vế "KHÔNG tính tự trích" *(chốt 2026-08-22, vá V3)*.

    Chủ mạch trích bình luận của **chính mình** thì chỉ số của họ không nhúc nhích. Rào 3
    dựng lên để chặn "máy in địa vị"; tự trích là cái máy in ngắn nhất — không cần nick
    thứ hai, không cần ai đồng ý, và ở một sản phẩm mà chủ mạch là người bấm nút trích
    thì nó là đường đi rẻ nhất tới một con số đẹp.

    Ghim cả hai đầu trong một bài: cùng một bình luận, người khác trích ⇒ `+1`; chính chủ
    mạch trích ⇒ không. Bỏ `.exclude(moc__mach__author=user)` là vế thứ hai đỏ ngay.
    """
    chu_mach = seed.author
    # Chủ mạch tự viết một bình luận trong mạch của mình rồi tự trích nó vào mốc 8.
    cua_minh = viet(seed, chu_mach, "Tự ghi chữ của mình vào sổ của mình.")
    truoc = lay(client, f"/api/v1/users/{chu_mach.username}")["duoc_trich"]
    assert truoc == 0, "tiền đề: chủ mạch HPG chưa được ai trích"

    Trich.objects.create(moc=Moc.objects.get(mach=seed, seq=8), comment=cua_minh)
    assert lay(client, f"/api/v1/users/{chu_mach.username}")["duoc_trich"] == truoc

    # …trong khi khối trích VẪN hiện đầy đủ trên thẻ mốc: luật này là luật ĐẾM, không
    # phải luật che. Chủ mạch vẫn ghi được chữ của mình vào sổ, chỉ là không tự thưởng.
    d = lay(client, f"/api/v1/machs/{seed.pk}")
    assert any(
        m["trich"] is not None and m["trich"]["comment_id"] == cua_minh.pk
        for m in d["mocs"]
    )


def test_nguoi_KHAC_trich_thi_van_cong_du(client, seed, nguoi_khac):
    """Chiều ngược của bài trên: `exclude` không được cắt quá tay.

    Cùng một người viết, cùng một cái mốc-1 — chỉ khác chủ mạch là ai. Không có bài này
    thì `duoc_trich = 0` cứng cũng xanh ở bài trên.

    ⚠ **Bản trước dựng dữ liệu KHÔNG HỢP LỆ và Phase 2 mới chặn được**: nó lấy bình luận
    `chu_mach` viết trong mạch HPG rồi trích vào mốc của một mạch khác. `Trich.clean()`
    (nợ "Trich chéo mạch", trả ở Phase 2) nay từ chối đúng hàng đó — khối trích chéo mạch
    sẽ render nội dung của một mạch khác lên thẻ mốc, kèm tên tác giả, trông y như thật.
    Bài đo được dựng lại cho HỢP LỆ mà **giữ nguyên ý**: `chu_mach` bình luận **trong
    mạch của người khác**, và người khác trích nó.
    """
    chu_mach = seed.author

    # Một mạch KHÁC, chủ mạch KHÁC. Bình luận nằm TRONG mạch đó — cùng mạch với cái mốc
    # nhận trích, đúng ràng buộc của `Trich`.
    mach_khac, _ = tao_mach(
        sub=seed.sub, author=nguoi_khac, title="Mạch của người khác", body="Mốc 1."
    )
    cua_minh = viet(mach_khac, chu_mach, "Chữ của tôi, trong sổ của người khác.")
    Trich.objects.create(moc=Moc.objects.get(mach=mach_khac, seq=1), comment=cua_minh)

    assert lay(client, f"/api/v1/users/{chu_mach.username}")["duoc_trich"] == 1


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
        "avatar_url",
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


def test_bon_chi_so_ve_0_khi_noi_dung_bi_an_SACH(client, seed):
    """Tiền đề của W4: hồ sơ "không có chỉ số nào" **không** đồng nghĩa "chưa từng đăng".

    Frontend ẩn cả khối chỉ số khi cả bốn con số bằng 0 (PLAN nguyên tắc 9), và bản A12
    thay chỗ đó bằng câu *"Tài khoản này chưa đăng mạch hay bình luận nào."* — một khẳng
    định về QUÁ KHỨ mà API không hề nói. Bài đo này dựng đúng ca phản chứng: một tác giả
    có mạch, mốc, bình luận và trích, bị mod ẩn sạch, vẫn ra `0/0/0/0`.
    """
    truoc = lay(client, "/api/v1/users/ba_muoi_phien")
    assert [truoc["so_mach"], truoc["so_moc"], truoc["so_binh_luan"]] != [0, 0, 0]

    khi = timezone.now()
    Mach.objects.filter(author__username="ba_muoi_phien").update(hidden_at=khi)
    Comment.objects.filter(author__username="ba_muoi_phien").update(hidden_at=khi)

    d = lay(client, "/api/v1/users/ba_muoi_phien")
    assert [d["so_mach"], d["so_moc"], d["so_binh_luan"], d["duoc_trich"]] == [0, 0, 0, 0]
