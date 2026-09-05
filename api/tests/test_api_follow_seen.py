"""`GET /machs/{id}/me` · `POST /seen` · `POST`/`DELETE /follow` — PLAN 5.5, 5.7, 8.4.

Bốn nhóm câu hỏi, và nhóm đầu là nhóm quan trọng nhất của cả phase:

1. **Dữ liệu per-user có rò không** — B không đọc được trạng thái của A, và
   `GET /machs/{id}` vẫn không mọc thêm trường nào.
2. **Vạch mới có đúng không** — `last_seen_entry_seq` chỉ tiến, kẹp trần, và người chưa
   follow thì không có chỗ ghi.
3. **`face` hai vế của PLAN 5.5** — vế viewer chỉ kéo được CẶN → BÃO.
4. **Idempotency** — bấm hai lần không đổi gì, và không xoá mất vị trí đọc.
"""

import pytest
from django.utils import timezone

from core.ghi import tao_binh_luan, them_moc
from core.models.moc import Moc
from core.models.tuong_tac import Follow, Reaction, Vote

from .conftest import dat, khoa_json, lay


def _me(client, mach_id: int):
    return lay(client, f"/api/v1/machs/{mach_id}/me")


# --- (1) rò dữ liệu per-user -------------------------------------------------


@pytest.mark.django_db
def test_khach_nhan_200_rong_khong_phai_401(client, mach_cua_a):
    """Khách chưa đăng nhập nhận **200** kèm trạng thái rỗng — cùng lý lẽ `GET /me`.

    401 ở đây là trả lỗi cho trạng thái bình thường nhất của hệ thống: endpoint này chạy
    trên MỌI lượt tải trang mạch, kể cả của bot.
    """
    d = _me(client, mach_cua_a.pk)
    assert d["dang_nhap"] is False
    assert d["my_votes"] == []
    assert d["my_reactions"] == []
    assert d["following"] is False
    assert d["last_seen_entry_seq"] == 0
    assert d["tung_binh_luan"] is False


@pytest.mark.django_db
def test_B_khong_doc_va_khong_dat_duoc_vi_tri_doc_cua_A(client, mach_cua_a, nguoi_a, nguoi_b):
    """**Bài đo lõi phân quyền của nhóm follow/seen.**

    Ba cửa `seen`/`follow`/`me` không có tham số nào chỉ tới người khác — chủ được suy ra
    từ phiên. Nên vế "B không đụng được của A" không đo được bằng một mã 403; nó đo bằng
    chuyện **B gọi hết cả ba cửa mà hàng của A không nhúc nhích**, và ngược lại B không
    nhìn thấy gì của A.
    """
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {"entry_seq": 2})
    cua_a = Follow.objects.get(user=nguoi_a, mach=mach_cua_a)
    assert cua_a.last_seen_entry_seq == 2

    client.force_login(nguoi_b)
    # B đọc: thấy trạng thái của CHÍNH B (rỗng), không thấy gì của A.
    d = _me(client, mach_cua_a.pk)
    assert d["dang_nhap"] is True
    assert d["following"] is False
    assert d["last_seen_entry_seq"] == 0

    # B ghi: hàng của A không đổi, và B chỉ dựng được hàng của chính B.
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {"entry_seq": 1})
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {"entry_seq": 1})
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow", method="delete")

    cua_a.refresh_from_db()
    assert cua_a.last_seen_entry_seq == 2, "B vừa đặt lại vị trí đọc của A"
    assert Follow.objects.filter(user=nguoi_a, mach=mach_cua_a).exists(), (
        "B vừa bỏ theo hộ A"
    )


@pytest.mark.django_db
def test_phieu_cua_toi_chi_la_phieu_CUA_TOI(client, mach_cua_a, nguoi_a, nguoi_b):
    """`my_votes` không được lẫn phiếu của người khác — đây là ca rò dễ xảy ra nhất.

    Một `Vote.objects.filter(target_id__in=…)` quên vế `user=` vẫn trả về dữ liệu trông
    hợp lệ (đúng mốc, đúng giá trị) và không có gì đỏ; nó chỉ hiển thị phiếu của người lạ
    như phiếu của mình.
    """
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    client.force_login(nguoi_a)
    dat(client, "/api/v1/votes", {"target_type": "moc", "target_id": moc.pk, "value": 1})
    client.force_login(nguoi_b)
    dat(client, "/api/v1/votes", {"target_type": "moc", "target_id": moc.pk, "value": -1})

    d = _me(client, mach_cua_a.pk)
    assert d["my_votes"] == [
        {"target_type": "moc", "target_id": moc.pk, "value": -1}
    ], "phiếu của A lọt vào /me của B"


@pytest.mark.django_db
def test_phieu_da_rut_KHONG_xuat_hien_voi_value_0(client, mach_cua_a, nguoi_b):
    """Rút phiếu là **xoá hàng**, nên phiếu đã rút vắng mặt chứ không mang `value: 0`.

    Trả `0` sẽ làm UI vẽ một mũi tên "đã bấm" ở trạng thái trung tính — một trạng thái
    không tồn tại trong `core.models.Vote` (`CheckConstraint` chặn `0` xuống DB).
    """
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    client.force_login(nguoi_b)
    dat(client, "/api/v1/votes", {"target_type": "moc", "target_id": moc.pk, "value": 1})
    assert len(_me(client, mach_cua_a.pk)["my_votes"]) == 1
    dat(client, "/api/v1/votes", {"target_type": "moc", "target_id": moc.pk, "value": 0})
    assert _me(client, mach_cua_a.pk)["my_votes"] == []
    assert not Vote.objects.filter(user=nguoi_b, target_id=moc.pk).exists()


@pytest.mark.django_db
def test_my_votes_phu_ca_moc_lan_binh_luan_va_khong_lay_cua_mach_khac(
    client, sub, nguoi_a, nguoi_b, mach_cua_a
):
    """Hai trục vote riêng rẽ (PLAN 5.7) — và không trục nào kéo dữ liệu của mạch khác về.

    `Vote` cố ý không có FK tới đích, nên không có `ON DELETE` và cũng không có join nào
    ép đúng phạm vi. Lọc bằng `target_id__in` của **chính mạch này** là hàng rào duy nhất;
    quên nó thì `/me` của mạch X trả phiếu người ta bỏ ở mạch Y.
    """
    from core.ghi import tao_mach

    mach_khac, _ = tao_mach(sub=sub, author=nguoi_a, title="Mạch khác", body="x")
    moc_khac = Moc.objects.get(mach=mach_khac, seq=1)
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    c = tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="câu của A")

    client.force_login(nguoi_b)
    for loai, tid in (("moc", moc.pk), ("comment", c.pk), ("moc", moc_khac.pk)):
        dat(client, "/api/v1/votes", {"target_type": loai, "target_id": tid, "value": 1})

    d = _me(client, mach_cua_a.pk)
    assert {(v["target_type"], v["target_id"]) for v in d["my_votes"]} == {
        ("moc", moc.pk),
        ("comment", c.pk),
    }


@pytest.mark.django_db
def test_GET_machs_id_van_KHONG_co_gi_per_user_sau_khi_da_follow(
    client, mach_cua_a, nguoi_a
):
    """PLAN 8.4 điểm 4, đo lại **sau khi** Phase 3 đã có dữ liệu per-user thật.

    `tests/test_api_mach.py` ghim bề mặt `GET /machs/{id}` trên seed, ở trạng thái không
    ai follow và không ai vote. Bài đo này hỏi câu còn lại: khi đã có hàng `Follow`, hàng
    `Vote`, hàng `Reaction` của **chính người đang gọi**, response đó có mọc thêm gì không.
    Đó mới là lúc một `my_vote` "cho tiện" được thêm vào.
    """
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    client.force_login(nguoi_a)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    dat(client, "/api/v1/votes", {"target_type": "moc", "target_id": moc.pk, "value": 1})
    dat(client, f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": "lieu"})

    khoa = khoa_json(lay(client, f"/api/v1/machs/{mach_cua_a.pk}"))
    ro_ri = [k for k in khoa if any(m in k for m in ("my_", "following", "last_seen"))]
    assert ro_ri == [], f"trường per-user lọt vào response cache được: {ro_ri}"


# --- (2) vạch mới ------------------------------------------------------------


@pytest.mark.django_db
def test_chua_follow_thi_seen_khong_ghi_gi_va_NOI_RA(client, mach_cua_a, nguoi_b):
    """`following: false` là câu trả lời trung thực, không phải một no-op im lặng.

    `last_seen_entry_seq` sống trên hàng `Follow` (PLAN mục 6). Hai lối bị loại: tạo hàng
    hộ (âm thầm bắt người ta theo mạch vì họ mở một trang) và 404 (client phải hỏi trước
    mới dám đặt bookmark).
    """
    client.force_login(nguoi_b)
    d = dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {"entry_seq": 2})
    assert d == {"following": False, "last_seen_entry_seq": 0}
    assert not Follow.objects.filter(user=nguoi_b, mach=mach_cua_a).exists()


@pytest.mark.django_db
def test_seen_khong_kem_entry_seq_nghia_la_da_xem_het(client, mach_cua_a, nguoi_b):
    """PLAN 5.5: thẻ mốc mới nhất mở sẵn ⇒ client gọi `/seen` không kèm gì."""
    client.force_login(nguoi_b)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    d = dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {})
    assert d["last_seen_entry_seq"] == mach_cua_a.entry_count == 2


@pytest.mark.django_db
def test_seen_CHI_TIEN_khong_bao_gio_lui(client, mach_cua_a, nguoi_b):
    """Peek một mốc cũ trên spine **không được** kéo vạch mới về sau.

    Client gọi `/seen` ở mỗi lượt mở trang, kể cả khi người ta bấm vào mốc 1 của một mạch
    9 mốc. Gán thẳng thì cú bấm đó tự tay đánh dấu 8 mốc cuối thành chưa đọc, và người
    dùng không có cách nào hiểu vì sao. Đây cũng là thứ giữ cho hai tab không giẫm nhau.
    """
    client.force_login(nguoi_b)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {"entry_seq": 2})
    d = dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {"entry_seq": 1})
    assert d["last_seen_entry_seq"] == 2


@pytest.mark.django_db
def test_seen_bi_kep_tran_o_entry_count(client, mach_cua_a, nguoi_b):
    """`seq` không bao giờ vượt số mốc, nên `entry_seq` lớn hơn bị kẹp — im lặng, không 400.

    Con số này là một cái bookmark, không phải một khẳng định về dữ liệu; 400 ở đây bắt
    client phải biết `entry_count` trước khi đặt bookmark.
    """
    client.force_login(nguoi_b)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    d = dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {"entry_seq": 999})
    assert d["last_seen_entry_seq"] == 2


@pytest.mark.django_db
def test_moc_moi_lam_vach_moi_xuat_hien(client, mach_cua_a, nguoi_a, nguoi_b):
    """Đối chứng dương cho cả nhóm: có mốc mới thì `last_seen` tụt lại sau `entry_count`.

    Không có bài này thì "luôn trả `entry_count`" cũng xanh ở mọi bài trên, và vạch mới
    sẽ không bao giờ hiện.
    """
    client.force_login(nguoi_b)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    assert _me(client, mach_cua_a.pk)["last_seen_entry_seq"] == 2

    them_moc(mach=mach_cua_a, author=nguoi_a, body="Mốc 3.")
    mach_cua_a.refresh_from_db()
    assert mach_cua_a.entry_count == 3
    # Vạch mới kẻ TRƯỚC mốc `last_seen + 1` = mốc 3.
    assert _me(client, mach_cua_a.pk)["last_seen_entry_seq"] == 2


# --- (3) `face` hai vế của PLAN 5.5 ------------------------------------------


@pytest.mark.django_db
def test_mach_nguoi_ra_BAO_cho_nguoi_da_follow_va_van_CAN_o_cua_cong_khai(
    client, mach_cua_a, nguoi_b
):
    """Vế 2 của PLAN 5.5 — và **hai cửa phải nói hai chuyện khác nhau**, đó là cả điểm.

    `GET /machs/{id}` cache được nên nó chỉ biết vế thời gian ⇒ CẶN. `/me` biết người xem
    ⇒ BÃO. Nếu bài này xanh mà cả hai cùng ra BÃO thì vế viewer đã rò sang response cache
    được — đúng thứ PLAN 8.4 gọi là "điểm dễ làm sai nhất".
    """
    mach_cua_a.last_activity_at = timezone.now() - timezone.timedelta(days=30)
    mach_cua_a.save(update_fields=["last_activity_at"])

    assert lay(client, f"/api/v1/machs/{mach_cua_a.pk}")["face"] == "can"
    client.force_login(nguoi_b)
    assert _me(client, mach_cua_a.pk)["face"] == "can"

    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    assert _me(client, mach_cua_a.pk)["face"] == "bao"
    assert lay(client, f"/api/v1/machs/{mach_cua_a.pk}")["face"] == "can", (
        "vế viewer rò sang response cache được"
    )


@pytest.mark.django_db
def test_tung_binh_luan_cung_keo_ra_BAO(client, mach_cua_a, nguoi_b):
    """Vế 2 là "đã follow **HOẶC** từng bình luận" — hai nhánh, không phải một."""
    mach_cua_a.last_activity_at = timezone.now() - timezone.timedelta(days=30)
    mach_cua_a.save(update_fields=["last_activity_at"])
    client.force_login(nguoi_b)
    assert _me(client, mach_cua_a.pk)["face"] == "can"

    tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="B nói một câu")
    d = _me(client, mach_cua_a.pk)
    assert d["tung_binh_luan"] is True
    assert d["face"] == "bao"
    assert d["following"] is False, "bình luận không được ngầm bật follow"


@pytest.mark.django_db
def test_ve_viewer_khong_bao_gio_keo_BAO_xuong_CAN(client, mach_cua_a, nguoi_b):
    """Vế 2 là phép **HOẶC**, nên nó chỉ cộng thêm. Mạch còn nóng thì ai xem cũng BÃO.

    Chiều ngược lại là cách cài sai tự nhiên nhất (`return bao if follow else can`), và nó
    làm mọi mạch đang sôi hiện mặt CẶN cho người chưa follow — tức mặt BÃO gần như không
    bao giờ xuất hiện với người mới.
    """
    assert lay(client, f"/api/v1/machs/{mach_cua_a.pk}")["face"] == "bao"
    client.force_login(nguoi_b)
    d = _me(client, mach_cua_a.pk)
    assert d["following"] is False and d["tung_binh_luan"] is False
    assert d["face"] == "bao"


# --- (4) idempotency + ca biên -----------------------------------------------


@pytest.mark.django_db
def test_follow_lan_hai_khong_xoa_vi_tri_doc(client, mach_cua_a, nguoi_b):
    """`get_or_create` chứ không `update_or_create` — ghi đè là xoá dấu đọc dở của chính họ."""
    client.force_login(nguoi_b)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {"entry_seq": 1})
    Follow.objects.filter(user=nguoi_b, mach=mach_cua_a).update(last_seen_entry_seq=1)

    d = dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    assert d["following"] is True
    assert d["last_seen_entry_seq"] == 1
    assert Follow.objects.filter(user=nguoi_b, mach=mach_cua_a).count() == 1


@pytest.mark.django_db
def test_follow_moi_bat_dau_tu_entry_count_khong_phai_0(client, mach_cua_a, nguoi_b):
    """Theo một mạch 2 mốc rồi thấy **cả 2 mốc** chưa xem là vạch mới nói dối ngay lượt đầu.

    Mặc định `0` của model đúng cho một hàng dựng tay; đường sản phẩm biết rõ hơn.
    """
    client.force_login(nguoi_b)
    d = dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")
    assert d["last_seen_entry_seq"] == mach_cua_a.entry_count == 2


@pytest.mark.django_db
def test_bo_follow_khi_von_khong_follow_van_la_200(client, mach_cua_a, nguoi_b):
    """Idempotent. 404 ở đây bắt UI phải biết trạng thái hiện tại mới dám bấm nút tắt."""
    client.force_login(nguoi_b)
    d = dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow", method="delete")
    assert d == {"mach_id": mach_cua_a.pk, "following": False, "last_seen_entry_seq": 0}


@pytest.mark.django_db
def test_mach_bi_khoa_van_follow_va_seen_duoc(client, mach_cua_a, nguoi_b):
    """**Quyết định của plan con B1 mục 2.6, ghim lại ở đây.**

    PLAN 5.10 nói mạch bị mod khoá thì "đọc được, không tương tác", và mọi cửa ghi khác
    gọi `doi_mach_tuong_tac_duoc`. Ba cửa này cố ý KHÔNG gọi: follow và vị trí đọc là sổ
    tay riêng của người đọc — không sinh chữ, không đổi con số nào của mạch, không ai khác
    nhìn thấy. Và chặn `DELETE /follow` có hại thật: người ta không tắt được thông báo của
    chính cái mạch mod vừa phải khoá lại.

    Ai "dọn dẹp" cho nhất quán với các cửa kia thì bài này đỏ, và đọc được vì sao.
    """
    mach_cua_a.locked_at = timezone.now()
    mach_cua_a.save(update_fields=["locked_at"])
    client.force_login(nguoi_b)

    assert dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow")["following"] is True
    assert dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {})["following"] is True
    assert (
        dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow", method="delete")["following"]
        is False
    )


@pytest.mark.django_db
def test_mach_bi_mod_AN_thi_404_o_ca_ba_cua(client, mach_cua_a, nguoi_b):
    """Mạch bị ẩn ⇒ coi như không tồn tại, kể cả ở cửa per-user (PLAN 5.10).

    Trả trạng thái viewer cho một mạch đã bị gỡ là xác nhận nó tồn tại — cùng lý lẽ
    `api/loi.py` chốt một mã cho cả "không có" lẫn "đã bị ẩn".
    """
    mach_cua_a.hidden_at = timezone.now()
    mach_cua_a.hidden_by = mach_cua_a.author
    mach_cua_a.save(update_fields=["hidden_at", "hidden_by"])
    client.force_login(nguoi_b)

    lay(client, f"/api/v1/machs/{mach_cua_a.pk}/me", status=404)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/follow", status=404)
    dat(client, f"/api/v1/machs/{mach_cua_a.pk}/seen", {}, status=404)


@pytest.mark.django_db
def test_reaction_cua_toi_hien_trong_me(client, mach_cua_a, nguoi_b):
    """Đối chứng dương cho `my_reactions` — nếu không, `[]` cứng cũng xanh ở mọi bài trên."""
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    client.force_login(nguoi_b)
    dat(client, f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": "co_nguon"})
    assert _me(client, mach_cua_a.pk)["my_reactions"] == [
        {"moc_id": moc.pk, "emoji": "co_nguon"}
    ]
    dat(client, f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": None})
    assert _me(client, mach_cua_a.pk)["my_reactions"] == []
    assert not Reaction.objects.filter(user=nguoi_b).exists()
