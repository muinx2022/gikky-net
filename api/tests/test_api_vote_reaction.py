"""Vote · reaction · tự-upvote của tác giả — PLAN 5.7, mục 6 (luật đếm), mục 7.

Ba nhóm:

1. **Vote** — một user một phiếu mỗi đích, đổi/rút được, count của đích cập nhật trong
   cùng transaction, và `Mach.diem_bai_goc` đi theo phiếu vào mốc 1 (nợ `DONG-BO-DIEM`).
2. **Tự upvote** (PLAN 5.7, chốt 2026-08-22, cài ở Phase 2) — mốc và bình luận khởi điểm
   với +1 của chính người viết, để `0` trên cột vote **có nghĩa**.
3. **Reaction** — bộ cố định, một reaction mỗi mốc mỗi người.
"""

import pytest

from core.ghi import tao_binh_luan
from core.models.dien_dan import Mach
from core.models.moc import Moc
from core.models.tuong_tac import Reaction, Vote

from api.quyen import DU_LIEU_KHONG_HOP_LE, NOI_DUNG_DA_GO

from .conftest import dat, lay, ma_loi

# --- tự upvote ---------------------------------------------------------------


@pytest.mark.django_db
def test_moc_moi_khoi_diem_voi_1_phieu_cua_chinh_tac_gia(client, sub, nguoi_a):
    """PLAN 5.7: "mốc và bình luận khởi điểm với **+1 của chính người viết**".

    Không phải để thổi điểm — ai cũng đúng một phiếu nên thứ hạng tương đối không đổi —
    mà để `0` **có nghĩa**: không có nó thì `0` vừa là "chưa ai đụng tới" vừa là "đã bị
    dìm về không", và ngày ra mắt cả feed là một cột số 0 (đâm PLAN nguyên tắc 9).

    Phiếu ấy phải là **hàng `Vote` thật**, không phải một số cộng thêm — nếu không thì
    "rút được như mọi vote khác" không thực hiện được. Bài đo kiểm cả hai mặt.
    """
    client.force_login(nguoi_a)
    d = dat(
        client, "/api/v1/machs", {"sub": sub.slug, "title": "T", "body": "B"}, status=201
    )
    moc = d["mocs"][0]
    assert moc["score"] == 1
    assert Vote.objects.filter(
        user=nguoi_a, target_type=Vote.Loai.MOC, target_id=moc["id"], value=1
    ).exists()

    # …và rút được như mọi phiếu khác.
    kq = dat(
        client,
        "/api/v1/votes",
        {"target_type": "moc", "target_id": moc["id"], "value": 0},
        status=200,
    )
    assert kq["score"] == 0


@pytest.mark.django_db
def test_binh_luan_moi_cung_khoi_diem_voi_1_phieu(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    d = dat(
        client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "x"}, status=201
    )
    assert d["score"] == 1 and d["up_count"] == 1 and d["down_count"] == 0


@pytest.mark.django_db
def test_tu_upvote_KHONG_lan_vao_seed(seed):
    """`seed_dev` dựng dữ liệu LỊCH SỬ với số phiếu cho trước — tự upvote không được chạm.

    Đây là lý do `tu_upvote` nằm ở tầng API chứ không trong `them_moc`/`tao_binh_luan`
    (cùng lý do rate limit không nằm ở đó). Bỏ nó vào đường ghi lõi là lệch đúng bộ số mà
    cả Phase 1 nghiệm thu trên đó — mốc 9 được 412, mốc 1 được 89 (PLAN 9.2).

    Bài đo ghim bằng một bất biến kiểm được: **mọi hàng `Vote` của seed đều do một user
    KHÁC tác giả bỏ ra**. Một dòng `tu_upvote` lọt vào `them_moc` là bài này đỏ ngay.
    """
    tu_bo = [
        v
        for v in Vote.objects.filter(target_type=Vote.Loai.MOC)
        for m in [Moc.objects.filter(pk=v.target_id).first()]
        if m is not None and m.author_id == v.user_id
    ]
    assert tu_bo == []


# --- vote --------------------------------------------------------------------


@pytest.mark.django_db
def test_vote_doi_va_rut(client, mach_cua_a, nguoi_b):
    """+1 → −1 → rút. Đổi phiếu là `UPDATE`, không phải cộng dồn hai hàng."""
    client.force_login(nguoi_b)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)

    assert dat(
        client,
        "/api/v1/votes",
        {"target_type": "moc", "target_id": moc.pk, "value": 1},
        status=200,
    )["score"] == 1
    assert dat(
        client,
        "/api/v1/votes",
        {"target_type": "moc", "target_id": moc.pk, "value": -1},
        status=200,
    )["score"] == -1
    assert (
        Vote.objects.filter(target_type=Vote.Loai.MOC, target_id=moc.pk).count() == 1
    )
    assert dat(
        client,
        "/api/v1/votes",
        {"target_type": "moc", "target_id": moc.pk, "value": 0},
        status=200,
    )["score"] == 0
    assert not Vote.objects.filter(
        target_type=Vote.Loai.MOC, target_id=moc.pk
    ).exists()


@pytest.mark.django_db
def test_vote_lai_cung_gia_tri_khong_cong_don(client, mach_cua_a, nguoi_b):
    """Bấm hai lần cùng một mũi tên không được thành +2 — `UNIQUE (user, đích)` là luật."""
    client.force_login(nguoi_b)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    for _ in range(3):
        d = dat(
            client,
            "/api/v1/votes",
            {"target_type": "moc", "target_id": moc.pk, "value": 1},
            status=200,
        )
    assert d["score"] == 1


@pytest.mark.django_db
def test_vote_binh_luan_tra_ve_ca_up_va_down(client, mach_cua_a, nguoi_a, nguoi_b):
    """Bình luận cần CẢ up lẫn down (wilson dùng hai vế); mốc chỉ có `score`.

    `up_count`/`down_count` của mốc là **`null`, không phải `0`** — `0` đọc ra là "không
    ai vote lên", một câu trả lời sai cho một câu hỏi không đặt được với mốc.
    """
    c = tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="x")
    client.force_login(nguoi_b)
    d = dat(
        client,
        "/api/v1/votes",
        {"target_type": "comment", "target_id": c.pk, "value": -1},
        status=200,
    )
    assert d["up_count"] == 0 and d["down_count"] == 1 and d["score"] == -1

    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    d = dat(
        client,
        "/api/v1/votes",
        {"target_type": "moc", "target_id": moc.pk, "value": 1},
        status=200,
    )
    assert d["up_count"] is None and d["down_count"] is None


@pytest.mark.django_db
def test_vote_vao_moc_1_dong_bo_diem_bai_goc(client, mach_cua_a, nguoi_b):
    """Nợ `DONG-BO-DIEM` (1d hoãn, Phase 2 trả): phiếu vào mốc 1 phải kéo theo
    `Mach.diem_bai_goc` **ngay trong transaction**.

    Không có nó thì feed "Nhiều điểm nhất" sắp theo một con số đóng băng, HTTP 200, không
    log, không job đối soát. Bài đo đi qua HTTP để nó phủ cả đường ghi thật lẫn phương án
    `UPDATE` một cột mà Phase 2 vừa đổi sang.
    """
    client.force_login(nguoi_b)
    moc1 = Moc.objects.get(mach=mach_cua_a, seq=1)
    dat(
        client,
        "/api/v1/votes",
        {"target_type": "moc", "target_id": moc1.pk, "value": 1},
        status=200,
    )
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.diem_bai_goc == Moc.objects.get(pk=moc1.pk).score

    d = lay(client, "/api/v1/feeds/moi")
    the = next(x for x in d["items"] if x["id"] == mach_cua_a.pk)
    assert the["diem"] == mach_cua_a.diem_bai_goc


@pytest.mark.django_db
def test_vote_vao_moc_2_KHONG_dong_bo_diem_bai_goc(client, mach_cua_a, nguoi_b):
    """Chiều ngược — `diem_bai_goc` là điểm của **mốc 1**, không phải tổng điểm mạch.

    PLAN 5.7 chốt vote nằm trên từng mốc riêng rẽ ("mốc 9 được 412 dù bài gốc 89"), nên
    không tồn tại con số "điểm của mạch". Mutant nào cộng mọi phiếu vào `diem_bai_goc` thì
    bài này đỏ.
    """
    truoc = Mach.objects.get(pk=mach_cua_a.pk).diem_bai_goc
    client.force_login(nguoi_b)
    moc2 = Moc.objects.get(mach=mach_cua_a, seq=2)
    dat(
        client,
        "/api/v1/votes",
        {"target_type": "moc", "target_id": moc2.pk, "value": 1},
        status=200,
    )
    assert Mach.objects.get(pk=mach_cua_a.pk).diem_bai_goc == truoc


@pytest.mark.django_db
def test_vote_vao_BIA_MO_bi_chan(client, mach_cua_a, nguoi_a, nguoi_b):
    """Số phiếu của bia mộ đã bị API zero hoá ⇒ nhận thêm phiếu là ghi vào chỗ không ai đọc."""
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    dat(client, f"/api/v1/mocs/{moc.pk}", status=200, method="delete")

    client.force_login(nguoi_b)
    assert (
        ma_loi(
            client,
            "/api/v1/votes",
            {"target_type": "moc", "target_id": moc.pk, "value": 1},
            status=409,
        )
        == NOI_DUNG_DA_GO
    )


@pytest.mark.django_db
def test_target_type_la_bi_tu_choi(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    assert (
        ma_loi(
            client,
            "/api/v1/votes",
            {"target_type": "mach", "target_id": mach_cua_a.pk, "value": 1},
            status=400,
        )
        == DU_LIEU_KHONG_HOP_LE
    )


@pytest.mark.django_db
def test_value_ngoai_khoang_bi_tu_choi_o_tang_schema(client, mach_cua_a, nguoi_b):
    """`value = 5` là 400 `tham_so_khong_hop_le` (pydantic chặn trước thân hàm)."""
    client.force_login(nguoi_b)
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    assert (
        ma_loi(
            client,
            "/api/v1/votes",
            {"target_type": "moc", "target_id": moc.pk, "value": 5},
            status=400,
        )
        == "tham_so_khong_hop_le"
    )


# --- reaction ----------------------------------------------------------------


@pytest.mark.django_db
def test_reaction_doi_va_rut_va_luon_tra_du_4_khoa(client, mach_cua_a, nguoi_b):
    """PLAN 5.7 — bộ CỐ ĐỊNH 🧠📎❓🔥, một reaction mỗi mốc mỗi người.

    `dem` trả **đủ 5 khoá kể cả khoá 0**: UI vẽ nguyên bộ, và một khoá vắng mặt trong
    response sẽ thành một icon nhấp nháy xuất hiện/biến mất theo lượt bấm.
    """
    client.force_login(nguoi_b)
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)

    d = dat(client, f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": "lieu"}, status=200)
    assert set(d["dem"]) == set(Reaction.Emoji.values)
    assert d["dem"]["lieu"] == 1 and d["dem"]["can_them"] == 0

    d = dat(client, f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": "can_them"}, status=200)
    assert d["dem"]["lieu"] == 0 and d["dem"]["can_them"] == 1
    assert Reaction.objects.filter(moc=moc).count() == 1

    d = dat(client, f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": None}, status=200)
    assert sum(d["dem"].values()) == 0
    assert not Reaction.objects.filter(moc=moc).exists()


@pytest.mark.django_db
def test_reaction_ngoai_bo_bi_tu_choi(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    assert (
        ma_loi(
            client, f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": "cuoi"}, status=400
        )
        == DU_LIEU_KHONG_HOP_LE
    )
