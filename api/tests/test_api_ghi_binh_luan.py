"""Viết · sửa · xoá bình luận — PLAN 5.3, 5.4, nguyên tắc 4 và 6.

Trọng tâm là **luật xoá hai vế** của PLAN 5.3 và món nợ 1a đi kèm nó (`Vote` mồ côi).
Phân quyền của cùng những endpoint này nằm ở `test_quyen_ghi.py`.
"""

import pytest
from django.utils import timezone

from core.ghi import tao_binh_luan
from core.models.binh_luan import Comment
from core.models.moc import Moc
from core.models.tuong_tac import Trich, Vote

from api.quyen import DU_LIEU_KHONG_HOP_LE, NOI_DUNG_DA_GO

from .conftest import dat, lay, ma_loi

# --- viết --------------------------------------------------------------------


@pytest.mark.django_db
def test_viet_binh_luan_goc_co_neo_thi_vao_dung_NGAN_KEO(client, mach_cua_a, nguoi_b):
    """PLAN nguyên tắc 4 + 5.4: neo là để bình luận có một CHỖ Ở.

    Bài đo vẫn soi **cả hai** cửa trong một lượt, vì đó vẫn là cách duy nhất bắt được ca
    "ghi vào một chỗ, đọc ở chỗ kia không thấy". Cái đổi là kỳ vọng ở cửa thứ hai.

    ⚠ **Kỳ vọng lật ngày 2026-08-26** *(user chốt)*. Câu cũ của docstring này — *"một kho,
    hai ống kính"*, bình luận neo phải hiện ở **cả** khán đài lẫn ngăn kéo — chính là mô
    hình vừa bị thay: khu bình luận cuối bài nay chỉ chứa thread nói về CẢ BÀI, thread neo
    mốc N sống duy nhất trong ngăn kéo mốc N. Nên vế thứ hai đảo dấu: `not in`.

    `mach_cua_a` có `entry_count == 2` nên nó là MẠCH, tức phép lọc áp. Bài đo cho post
    thường (`entry_count == 1`, KHÔNG lọc) nằm ở
    `test_api_khan_dai.py::test_POST_THUONG_KHONG_loc_thread_neo`.
    """
    client.force_login(nguoi_b)
    moc1 = Moc.objects.get(mach=mach_cua_a, seq=1)
    d = dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "Neo vào mốc 1.", "anchor_moc_seq": 1},
        status=201,
    )
    assert d["anchor_moc_seq"] == 1 and d["depth"] == 1

    ngan_keo = lay(client, f"/api/v1/mocs/{moc1.pk}/comments")
    assert [t["id"] for t in ngan_keo["threads"]] == [d["id"]]

    khan_dai = lay(client, f"/api/v1/machs/{mach_cua_a.pk}/comments")
    assert d["id"] not in [t["id"] for t in khan_dai["threads"]], (
        "thread neo mốc chỉ được có MỘT nhà, và nhà đó là ngăn kéo"
    )


@pytest.mark.django_db
def test_go_chip_neo_thi_khong_thuoc_ngan_keo_nao(client, mach_cua_a, nguoi_b):
    """`anchor_moc_seq = null` **không phải dữ liệu thiếu** — là người viết đã gỡ chip.

    PLAN nguyên tắc 4: đó là đường chính thức để "bình luận về cả mạch". Bài đo soi cả hai
    ngăn kéo của mạch để chắc nó không rơi vào cái nào.
    """
    client.force_login(nguoi_b)
    d = dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "Nói về cả mạch."},
        status=201,
    )
    assert d["anchor_moc_seq"] is None
    for moc in Moc.objects.filter(mach=mach_cua_a):
        ngan_keo = lay(client, f"/api/v1/mocs/{moc.pk}/comments")
        assert d["id"] not in [t["id"] for t in ngan_keo["threads"]]


@pytest.mark.django_db
def test_reply_khong_duoc_mang_neo_rieng(client, mach_cua_a, nguoi_a, nguoi_b):
    """PLAN nguyên tắc 6: "neo sống ở bình luận GỐC; reply đi theo gốc".

    400 chứ **không** phải bỏ qua im lặng: bỏ qua im lặng là cách một bình luận biến mất
    khỏi ngăn kéo mà không ai hiểu tại sao.
    """
    goc = tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="gốc", anchor_moc_seq=1)
    client.force_login(nguoi_b)
    assert (
        ma_loi(
            client,
            f"/api/v1/machs/{mach_cua_a.pk}/comments",
            {"body": "reply", "parent_id": goc.pk, "anchor_moc_seq": 2},
            status=400,
        )
        == DU_LIEU_KHONG_HOP_LE
    )


@pytest.mark.django_db
def test_neo_vao_moc_khong_ton_tai_bi_tu_choi(client, mach_cua_a, nguoi_b):
    """Chip `‹mốc 12›` trên một mạch 2 mốc mở ra một ngăn kéo không có thật."""
    client.force_login(nguoi_b)
    assert (
        ma_loi(
            client,
            f"/api/v1/machs/{mach_cua_a.pk}/comments",
            {"body": "x", "anchor_moc_seq": 12},
            status=400,
        )
        == DU_LIEU_KHONG_HOP_LE
    )


@pytest.mark.django_db
def test_reply_XUYEN_MACH_bi_tu_choi(client, mach_cua_a, nguoi_a, sub, nguoi_b):
    """`parent_id` phải thuộc **cùng mạch** — 404, không phải một nhánh mồ côi.

    `cap_phat_path` cũng chặn (nó ném `ValidationError`), nhưng chặn ở đó là 500; tầng API
    phải trả một mã đọc được.
    """
    from core.ghi import tao_mach

    khac, _ = tao_mach(sub=sub, author=nguoi_a, title="Mạch khác", body="Mốc 1.")
    goc_o_mach_khac = tao_binh_luan(mach=khac, author=nguoi_a, body="gốc")
    client.force_login(nguoi_b)
    assert (
        ma_loi(
            client,
            f"/api/v1/machs/{mach_cua_a.pk}/comments",
            {"body": "reply lạc", "parent_id": goc_o_mach_khac.pk},
            status=404,
        )
        == "khong_tim_thay"
    )


# --- sửa ---------------------------------------------------------------------


@pytest.mark.django_db
def test_sua_binh_luan_hien_dau_da_sua(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    d = dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "bản đầu"},
        status=201,
    )
    assert d["edited_at"] is None
    d2 = dat(
        client, f"/api/v1/comments/{d['id']}", {"body": "bản sau"}, status=200, method="patch"
    )
    assert d2["body"] == "bản sau" and d2["edited_at"] is not None


@pytest.fixture
def admin_user(db):
    from django.contrib.auth import get_user_model
    return get_user_model().objects.create_user(
        username="admin_user", is_staff=True
    )


@pytest.mark.django_db
def test_sua_binh_luan_qua_han_thi_403_het_cua_so_sua(client, mach_cua_a, nguoi_b):
    from datetime import timedelta
    client.force_login(nguoi_b)
    d = dat(
        client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "bản đầu"}, status=201
    )
    Comment.objects.filter(pk=d["id"]).update(created_at=timezone.now() - timedelta(minutes=60))
    assert (
        ma_loi(client, f"/api/v1/comments/{d['id']}", {"body": "sửa muộn"}, status=403, method="patch")
        == "het_cua_so_sua"
    )


# --- ẩn: Hướng 2 (chỉ ẩn khi chưa có reply) ----------------------------------


@pytest.mark.django_db
def test_an_binh_luan_chua_co_reply_thi_thanh_cong_va_bo_an_duoc(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    d = dat(
        client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "sắp ẩn"}, status=201
    )
    # Ẩn
    kq = dat(client, f"/api/v1/comments/{d['id']}/an", {"an": True}, status=200)
    assert kq["da_an"] is True
    c = Comment.objects.get(pk=d["id"])
    assert c.hidden_at is not None

    # Bỏ ẩn
    kq2 = dat(client, f"/api/v1/comments/{d['id']}/an", {"an": False}, status=200)
    assert kq2["da_an"] is False
    c.refresh_from_db()
    assert c.hidden_at is None


@pytest.mark.django_db
def test_an_binh_luan_da_co_reply_thi_400_da_co_tra_loi(client, mach_cua_a, nguoi_a, nguoi_b):
    goc = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="gốc")
    tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="reply con", parent=goc)

    client.force_login(nguoi_b)
    assert (
        ma_loi(client, f"/api/v1/comments/{goc.pk}/an", {"an": True}, status=400, method="post")
        == "da_co_tra_loi"
    )


# --- xoá: CHỈ admin/staff mới được xoá (PLAN mới) ----------------------------


@pytest.mark.django_db
def test_user_thuong_xoa_binh_luan_thi_403_khong_phai_admin(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    d = dat(
        client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "sẽ xoá"}, status=201
    )
    assert (
        ma_loi(client, f"/api/v1/comments/{d['id']}", status=403, method="delete")
        == "khong_phai_admin"
    )


@pytest.mark.django_db
def test_xoa_binh_luan_khong_dinh_gi_thi_xoa_THAT(client, mach_cua_a, nguoi_b, admin_user):
    """Admin xoá: không reply con, chưa từng được trích ⇒ **biến mất hẳn**, không để bia mộ."""
    client.force_login(nguoi_b)
    d = dat(
        client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "sẽ xoá"}, status=201
    )
    client.force_login(admin_user)
    kq = dat(client, f"/api/v1/comments/{d['id']}", status=200, method="delete")
    assert kq["xoa_that"] is True
    assert not Comment.objects.filter(pk=d["id"]).exists()

    khan_dai = lay(client, f"/api/v1/machs/{mach_cua_a.pk}/comments")
    assert d["id"] not in [t["id"] for t in khan_dai["threads"]]


@pytest.mark.django_db
def test_xoa_that_DON_luon_Vote_mo_coi(client, mach_cua_a, nguoi_a, nguoi_b, admin_user):
    """**Nợ 1a bàn giao**: `Vote` cố ý không có FK ⇒ không có `ON DELETE` nào.

    Bình luận biến mất mà phiếu ở lại vĩnh viễn, và không ai dọn.
    """
    client.force_login(nguoi_b)
    d = dat(
        client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "sẽ xoá"}, status=201
    )
    client.force_login(nguoi_a)
    dat(
        client,
        "/api/v1/votes",
        {"target_type": "comment", "target_id": d["id"], "value": -1},
        status=200,
    )
    assert (
        Vote.objects.filter(target_type=Vote.Loai.COMMENT, target_id=d["id"]).count() == 2
    )

    client.force_login(admin_user)
    dat(client, f"/api/v1/comments/{d['id']}", status=200, method="delete")
    assert not Vote.objects.filter(
        target_type=Vote.Loai.COMMENT, target_id=d["id"]
    ).exists()


@pytest.mark.django_db
def test_co_reply_con_thi_giu_BIA_MO(client, mach_cua_a, nguoi_a, nguoi_b, admin_user):
    """Vế 1 của PLAN 5.3 — bia mộ giữ chỗ để nhánh con không mồ côi."""
    goc = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="gốc")
    tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="reply", parent=goc)

    client.force_login(admin_user)
    kq = dat(client, f"/api/v1/comments/{goc.pk}", status=200, method="delete")
    assert kq["xoa_that"] is False
    goc.refresh_from_db()
    assert goc.deleted_at is not None

    khan_dai = lay(client, f"/api/v1/machs/{mach_cua_a.pk}/comments")
    nut = next(t for t in khan_dai["threads"] if t["id"] == goc.pk)
    assert nut["trang_thai"] == "da_xoa" and nut["body"] is None
    assert len(nut["replies"]) == 1


@pytest.mark.django_db
def test_da_TUNG_duoc_trich_thi_giu_bia_mo_KE_CA_trich_da_go(
    client, mach_cua_a, nguoi_a, nguoi_b, admin_user
):
    """Vế 2 của PLAN 5.3, và là chỗ dễ đọc hụt nhất — chữ **"đã TỪNG"**."""
    c = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="câu được vào sổ")
    moc2 = Moc.objects.get(mach=mach_cua_a, seq=2)
    t = Trich.objects.create(moc=moc2, comment=c)
    Trich.objects.filter(pk=t.pk).update(removed_at=timezone.now())

    client.force_login(admin_user)
    kq = dat(client, f"/api/v1/comments/{c.pk}", status=200, method="delete")
    assert kq["xoa_that"] is False, "trích ĐÃ GỠ vẫn phải chặn xoá thật (PLAN 5.3)"
    c.refresh_from_db()
    assert c.deleted_at is not None
    assert Trich.objects.filter(pk=t.pk).exists(), "hàng Trich tự nó là log, không được mất"


@pytest.mark.django_db
def test_xoa_hai_lan_thi_409(client, mach_cua_a, nguoi_a, nguoi_b, admin_user):
    goc = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="gốc")
    tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="reply", parent=goc)
    client.force_login(admin_user)
    dat(client, f"/api/v1/comments/{goc.pk}", status=200, method="delete")
    assert (
        ma_loi(client, f"/api/v1/comments/{goc.pk}", status=409, method="delete")
        == NOI_DUNG_DA_GO
    )


@pytest.mark.django_db
def test_xoa_binh_luan_lam_comment_count_tut(client, mach_cua_a, nguoi_b, admin_user):
    """`comment_count` đo **nội dung đọc được** — bia mộ không được đếm (PLAN mục 6)."""
    client.force_login(nguoi_b)
    d = dat(
        client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "một câu"}, status=201
    )
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.comment_count == 1

    client.force_login(admin_user)
    dat(client, f"/api/v1/comments/{d['id']}", status=200, method="delete")
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.comment_count == 0
