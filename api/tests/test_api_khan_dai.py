"""`GET /machs/{id}/comments` — khán đài. PLAN 5.3, nguyên tắc 7. Tiêu chí R5, R8, K3.

Chỗ khó nhất của phase này nằm ở đây, và nó là chỗ dễ viết ra một bài đo RỖNG nhất:
sort `hay_nhat` gọi `core/xep_hang.py`, nên một bài đo cũng gọi `core/xep_hang.py` để
tính kỳ vọng thì nó chỉ chứng minh "hàm bằng chính nó" — đổi công thức ở `xep_hang.py`
là kỳ vọng đổi theo, và bài đo vẫn xanh.

Vì thế file này **tự cài lại wilson** (`wilson_doc_lap` dưới đây) từ công thức viết trong
PLAN 5.3, không import `core.xep_hang`. Đổi `z`, đổi `HE_SO_TUOI`, hay bỏ hẳn hệ số ở
phía sản phẩm đều làm bài đo đỏ.
"""

import math
from datetime import timedelta

import pytest
from django.db import transaction
from django.utils import timezone

from core.ghi import cap_nhat_dem_mach, tao_mach, them_moc
from core.models import Comment, Mach, Moc, Trich
from tests.conftest import lay, phang, viet

pytestmark = pytest.mark.django_db

#: Nguyên văn PLAN 5.3. KHÔNG import từ `core.xep_hang` — xem docstring module.
Z = 1.281
HE_SO_TUOI = 0.15
CUA_SO_TUOI = timedelta(hours=48)


def wilson_doc_lap(up: int, down: int) -> float:
    n = up + down
    if n == 0:
        return 0.0
    p = up / n
    return (p + Z * Z / (2 * n) - Z * math.sqrt((p * (1 - p) + Z * Z / (4 * n)) / n)) / (
        1 + Z * Z / n
    )


def rank_doc_lap(c: Comment, *, last_entry_at, now) -> float:
    diem = wilson_doc_lap(c.up_count, c.down_count)
    if c.created_at > last_entry_at and now - c.created_at <= CUA_SO_TUOI:
        diem += HE_SO_TUOI
    return diem


def ids(threads) -> list[int]:
    return [t["id"] for t in threads]


# --- R5: ba sort -------------------------------------------------------------
#
# Từ 2026-08-26 các bài đo dưới đây chạy trên `seed_chung` chứ không `seed`: khán đài nay
# chỉ trả thread gốc **không neo**, và trên seed thô chỉ 1 trong 14 thread như thế — mọi
# bài đo sắp xếp / phân trang sẽ đo một danh sách một phần tử, tức xanh với bất cứ cài đặt
# nào. `seed_chung` gỡ neo ở gốc, giữ nguyên bộ điểm rải sẵn của seed. Phép LỌC được đo
# riêng ở khối "Chỉ thread KHÔNG neo" cuối file, và nó phải dùng `seed` thô.


def test_hay_nhat_xep_dung_wilson_tren_seed(client, seed_chung):
    """Thứ tự API trả về phải khớp bảng xếp hạng tính LẠI từ công thức của PLAN.

    Seed cố ý rải điểm để 14 thread gốc không đồng hạng
    (`test_seed_dev.py::test_diem_vote_rai_du_de_top_10_wilson_co_nghia`), nên thứ tự
    này phân biệt được mọi hoán vị — không phải kiểu "gần đúng cũng xanh".
    """
    d = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments")
    now = timezone.now()

    goc = list(Comment.objects.filter(mach=seed_chung, parent__isnull=True))
    mong_doi = sorted(
        goc,
        key=lambda c: (
            -rank_doc_lap(c, last_entry_at=seed_chung.last_entry_at, now=now),
            c.created_at,
            c.pk,
        ),
    )

    assert d["sort"] == "hay_nhat"
    assert d["tong_thread"] == len(goc) == 14
    assert ids(d["threads"]) == [c.pk for c in mong_doi]


def test_hay_nhat_dat_binh_luan_diem_cao_nhat_len_dau(client, seed_chung):
    """Ràng buộc thô nhưng độc lập với mọi công thức: 31↑/0↓ phải đứng đầu."""
    d = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments")
    dau = d["threads"][0]
    assert (dau["up_count"], dau["down_count"]) == (31, 0)


def test_cu_nhat_theo_ngay_MO_thread_va_KHONG_bump(client, seed_chung):
    """`cu_nhat` giữ nguyên luật cũ — *"cũ nhất" là đọc từ đầu*, không phải "im lâu nhất".

    ⚠ **Vế "hai chiều của cùng một trục" CHẾT ngày 2026-08-26.** Bài này trước đó khẳng
    định `ids(moi_nhat) == reversed(ids(cu_nhat))`, và câu ấy chỉ đúng khi hai sort dùng
    CÙNG một khoá. Từ lượt bump, `moi_nhat` sắp theo *hoạt động* còn `cu_nhat` theo *ngày
    mở thread*: hai đại lượng khác nhau, nên đảo cái này không ra cái kia — xem
    `test_moi_nhat_BUMP_theo_reply_moi` cho vế đối chứng.
    """
    cu = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=cu_nhat")
    assert cu["sort"] == "cu_nhat"

    khi = {
        c.pk: c.created_at
        for c in Comment.objects.filter(mach=seed_chung, parent__isnull=True)
    }
    assert ids(cu["threads"]) == sorted(khi, key=lambda pk: (khi[pk], pk))


def test_sort_la_hai_gia_tri_khac_nhau_chu_khong_phai_mot(client, seed_chung):
    """Đối chứng cho bài trên: `moi_nhat` và `hay_nhat` KHÔNG được ra cùng thứ tự.

    Nếu chúng trùng nhau thì mọi bài đo sort đều đo trên một cài đặt duy nhất, và mutant
    "bỏ qua tham số `sort`" sẽ sống sót qua tất cả.
    """
    hay = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=hay_nhat")
    moi = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=moi_nhat")
    assert ids(hay["threads"]) != ids(moi["threads"])


def test_sort_khong_hop_le_tra_400_chu_khong_lang_le_doi_sang_mac_dinh(client, seed):
    """PLAN nguyên tắc 7: "không bao giờ tự đổi sort ngầm dưới tay người dùng"."""
    d = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=best", status=400)
    assert d["code"] == "sort_khong_hop_le"


# --- Hệ số tươi (PLAN 5.3) ---------------------------------------------------


@pytest.fixture
def mach_cu(sub, tac_gia):
    """Mạch có mốc mới nhất cách đây 10 ngày.

    Nhờ vậy mọi bình luận viết "bây giờ" đều thoả điều kiện 1 của hệ số tươi
    (`created_at > last_entry_at`), và điều kiện 2 (48h) tách ra kiểm được riêng.
    """
    m, _ = tao_mach(
        sub=sub,
        author=tac_gia,
        title="Mạch nguội để đo hệ số tươi",
        body="Mốc 1.",
        _created_at_seed=timezone.now() - timedelta(days=10),
    )
    return m


def test_he_so_tuoi_lat_nguoc_thu_hang_cua_hai_binh_luan_sat_diem(
    client, mach_cu, nguoi_khac
):
    """PLAN mục 10 đòi đích danh: "test chứng minh hệ số tươi ĐỔI thứ hạng".

    Cặp số chọn có tính toán: wilson(10↑/0↓) ≈ 0.8590 và wilson(9↑/0↓) ≈ 0.8458 —
    cách nhau 0.013, tức nhỏ hơn 0.15 nên hệ số lật được; nhưng vẫn là hai giá trị phân
    biệt nên khi KHÔNG có hệ số thì thứ tự phải ngược lại. Bỏ hệ số tươi hoặc đặt nó về
    0 làm vế đầu đỏ; giữ hệ số mà bỏ điều kiện nào cũng làm vế sau đỏ.
    """
    cao = viet(
        mach_cu, nguoi_khac, "Điểm cao hơn nhưng viết lâu rồi", up=10,
        khi=timezone.now() - timedelta(days=5),
    )
    tuoi = viet(mach_cu, nguoi_khac, "Điểm thấp hơn nhưng vừa viết", up=9)

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert ids(d["threads"]) == [tuoi.pk, cao.pk]

    # Đẩy bình luận "tươi" ra ngoài cửa sổ 48h ⇒ mất hệ số ⇒ thứ tự trở về wilson thuần.
    Comment.objects.filter(pk=tuoi.pk).update(
        created_at=timezone.now() - timedelta(days=4)
    )
    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert ids(d["threads"]) == [cao.pk, tuoi.pk]


def test_he_so_tuoi_khong_lat_duoc_cap_cach_xa_nhau(client, mach_cu, nguoi_khac):
    """Chặn trên cho độ lớn hệ số: 0.15 không được biến bình luận bị dìm thành số 1.

    wilson(3↑/4↓) ≈ 0.226; cộng 0.15 vẫn còn cách wilson(10↑/0↓) ≈ 0.859 rất xa. Nâng
    `HE_SO_TUOI` lên quá ~0.63 là bài đo này đỏ — nếu không có nó thì mọi bài đo hệ số
    tươi khác vẫn xanh với một hệ số to tuỳ ý, tức "có cộng gì đó" chứ không phải "cộng
    đúng 0.15".
    """
    cao = viet(
        mach_cu, nguoi_khac, "Đồng thuận cao, viết lâu rồi", up=10,
        khi=timezone.now() - timedelta(days=5),
    )
    tuoi_bi_dim = viet(mach_cu, nguoi_khac, "Vừa viết nhưng bị dìm", up=3, down=4)

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert ids(d["threads"]) == [cao.pk, tuoi_bi_dim.pk]


def test_khong_co_he_so_tuoi_khi_binh_luan_ra_doi_TRUOC_moc_moi_nhat(
    client, mach_cu, nguoi_khac
):
    """Điều kiện 1 của PLAN 5.3 — bỏ nó đi thì mọi bình luận mới đều được cộng."""
    cao = viet(
        mach_cu, nguoi_khac, "Điểm cao hơn", up=10,
        khi=timezone.now() - timedelta(days=5),
    )
    moi = viet(mach_cu, nguoi_khac, "Vừa viết", up=9)

    # Tác giả vừa nối mốc ⇒ `last_entry_at` nhảy lên sau cả hai bình luận.
    Mach.objects.filter(pk=mach_cu.pk).update(last_entry_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert ids(d["threads"]) == [cao.pk, moi.pk]


def test_khong_co_he_so_tuoi_khi_qua_48h(client, mach_cu, nguoi_khac):
    """Điều kiện 2 của PLAN 5.3 — cửa sổ tính từ lúc BÌNH LUẬN ra đời, không phải từ mốc."""
    cao = viet(
        mach_cu, nguoi_khac, "Điểm cao hơn", up=10,
        khi=timezone.now() - timedelta(days=5),
    )
    hon_48h = viet(
        mach_cu, nguoi_khac, "Viết sau mốc nhưng đã 49 giờ", up=9,
        khi=timezone.now() - timedelta(hours=49),
    )

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert ids(d["threads"]) == [cao.pk, hon_48h.pk]

    # Cùng dữ liệu, chỉ kéo về trong cửa sổ ⇒ lật. Chứng minh vế trên đỏ vì đúng lý do.
    Comment.objects.filter(pk=hon_48h.pk).update(
        created_at=timezone.now() - timedelta(hours=47)
    )
    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert ids(d["threads"]) == [hon_48h.pk, cao.pk]


def test_he_so_tuoi_KHONG_ap_cho_reply(client, mach_cu, tac_gia, nguoi_khac):
    """PLAN 5.3: "Chỉ áp cho bình luận gốc; sibling trong thread sort theo wilson thuần".

    Đây là rủi ro số 2 của plan con 1b. Cùng cặp số đã lật được thứ hạng ở tầng gốc, đặt
    xuống tầng reply thì **không được lật**.
    """
    goc = viet(mach_cu, tac_gia, "Thread gốc", up=5)
    cao = viet(
        mach_cu, nguoi_khac, "Reply điểm cao, viết lâu rồi", up=10, parent=goc,
        khi=timezone.now() - timedelta(days=5),
    )
    tuoi = viet(mach_cu, nguoi_khac, "Reply vừa viết", up=9, parent=goc)

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert ids(d["threads"][0]["replies"]) == [cao.pk, tuoi.pk]


# --- Hình cây ----------------------------------------------------------------


def test_tra_cay_long_nhau_moi_nut_co_depth(client, seed_chung):
    """PLAN mục 7 — "server sort, trả cây đã dựng"; PLAN 5.3 — mỗi nút có `depth`."""
    d = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments")
    tat_ca = phang(d["threads"])

    assert len(tat_ca) == 24
    assert all(t["depth"] == 1 for t in d["threads"])
    assert max(t["depth"] for t in tat_ca) >= 3, "seed phải có nhánh 3 tầng"
    for t in d["threads"]:
        for r in t["replies"]:
            assert r["depth"] == 2 and r["parent_id"] == t["id"]


def test_reply_khong_mang_anchor_rieng(client, seed_chung):
    """PLAN nguyên tắc 6 — reply kế thừa neo của gốc, không tự neo mốc nào."""
    d = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments")
    for t in d["threads"]:
        for r in phang(t["replies"]):
            assert r["anchor_moc_seq"] is None


def test_badge_chu_mach_va_tu_gap(client, seed_chung):
    """Badge `[CHỦ MẠCH]` (PLAN mục 2) và "điểm ≤ −5 tự gập" (PLAN 5.3), server quyết."""
    d = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments")
    tat_ca = phang(d["threads"])

    chu = {t["id"] for t in tat_ca if t["la_chu_mach"]}
    that = set(
        Comment.objects.filter(mach=seed_chung, author=seed_chung.author).values_list(
            "pk", flat=True
        )
    )
    assert chu == that and chu

    gap = {t["id"] for t in tat_ca if t["tu_gap"]}
    assert gap == {
        c.pk for c in Comment.objects.filter(mach=seed_chung) if c.score <= -5
    }
    assert gap, "seed phải có ít nhất một bình luận bị dìm dưới −5"


# --- Bia mộ (PLAN 5.3) + K3 --------------------------------------------------


def test_binh_luan_xoa_ma_KHONG_co_reply_thi_bien_mat(client, mach_cu, nguoi_khac):
    a = viet(mach_cu, nguoi_khac, "Sẽ bị xoá", up=3)
    b = viet(mach_cu, nguoi_khac, "Ở lại", up=2)
    Comment.objects.filter(pk=a.pk).update(deleted_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert ids(d["threads"]) == [b.pk]
    assert d["tong_thread"] == 1


def test_binh_luan_xoa_ma_CO_reply_thi_thanh_bia_mo_mat_sach_noi_dung(
    client, mach_cu, nguoi_khac, tac_gia
):
    """PLAN 5.3 — giữ chỗ "[đã xoá]" khi còn reply, nhưng không giữ lại nội dung gì."""
    cha = viet(mach_cu, nguoi_khac, "NỘI DUNG BÍ MẬT CỦA CHA", up=9, down=1)
    con = viet(mach_cu, tac_gia, "Reply còn sống", parent=cha)
    Comment.objects.filter(pk=cha.pk).update(deleted_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    (nut,) = d["threads"]

    assert nut["id"] == cha.pk and nut["trang_thai"] == "da_xoa"
    assert nut["body"] is None and nut["author"] is None
    assert (nut["up_count"], nut["down_count"], nut["score"]) == (0, 0, 0)
    assert ids(nut["replies"]) == [con.pk]
    assert "NỘI DUNG BÍ MẬT CỦA CHA" not in client.get(
        f"/api/v1/machs/{mach_cu.pk}/comments"
    ).content.decode()


def test_K3_bia_mo_van_render_nhung_KHONG_duoc_dem(client, mach_cu, nguoi_khac, tac_gia):
    """K3 (nợ 1a) — "💬 N" là N bình luận ĐỌC ĐƯỢC, không phải N dòng.

    Khán đài trả 2 nút trong khi `comment_count` nói 1. Hai con số lệch nhau là **đúng**
    (PLAN mục 6, luật đếm 4 cột); 1c phải hiểu đúng chữ đó chứ không "sửa" cho khớp.
    """
    cha = viet(mach_cu, nguoi_khac, "Cha sẽ bị xoá")
    viet(mach_cu, tac_gia, "Con còn sống", parent=cha)
    Comment.objects.filter(pk=cha.pk).update(deleted_at=timezone.now())
    with transaction.atomic():
        cap_nhat_dem_mach(mach_cu)
    mach_cu.refresh_from_db()

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert len(phang(d["threads"])) == 2
    assert mach_cu.comment_count == 1
    assert lay(client, f"/api/v1/machs/{mach_cu.pk}")["comment_count"] == 1


def test_bia_mo_chim_xuong_duoi_o_hay_nhat(client, mach_cu, nguoi_khac, tac_gia):
    """Bia mộ xếp theo con số API TRẢ RA (0/0), không theo số phiếu đã bị che.

    Nếu nó giữ hạng cũ thì thread đứng số 1 của khán đài là một dòng "[đã xoá]" trống —
    xếp hạng không giải thích được bằng thứ người đọc nhìn thấy.
    """
    cha = viet(mach_cu, nguoi_khac, "Điểm rất cao rồi bị xoá", up=30)
    viet(mach_cu, tac_gia, "Reply giữ cha lại làm bia mộ", parent=cha)
    thuong = viet(mach_cu, nguoi_khac, "Bình luận thường", up=2)
    Comment.objects.filter(pk=cha.pk).update(deleted_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments")
    assert ids(d["threads"]) == [thuong.pk, cha.pk]


# --- Phân trang (R8) ---------------------------------------------------------


def test_hay_nhat_phan_trang_bang_offset_khong_bang_cursor(client, seed_chung):
    """PLAN 5.3 — `hay_nhat` trả một trang rồi "xem thêm" bằng `?offset=`."""
    t1 = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=hay_nhat&limit=5")
    assert len(t1["threads"]) == 5
    assert t1["tong_thread"] == 14
    assert t1["offset_ke_tiep"] == 5
    assert t1["cursor_ke_tiep"] is None

    t2 = lay(
        client,
        f"/api/v1/machs/{seed_chung.pk}/comments?sort=hay_nhat&limit=5&offset={t1['offset_ke_tiep']}",
    )
    day_du = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=hay_nhat&limit=50")
    assert ids(t1["threads"]) + ids(t2["threads"]) == ids(day_du["threads"])[:10]

    cuoi = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=hay_nhat&limit=5&offset=10")
    assert cuoi["offset_ke_tiep"] is None


def duyet_bang_cursor(client, url: str, limit: int) -> list[int]:
    """Đi hết một endpoint bằng cursor, trả danh sách id theo thứ tự nhận được."""
    ra, cursor, vong = [], None, 0
    while True:
        vong += 1
        assert vong < 50, "vòng lặp cursor không kết thúc"
        d = lay(client, f"{url}&limit={limit}" + (f"&cursor={cursor}" if cursor else ""))
        ra += ids(d["threads"])
        cursor = d["cursor_ke_tiep"]
        if cursor is None:
            return ra


def test_cursor_moi_nhat_khong_trung_khong_sot(client, seed_chung):
    """R8 — đi hết bằng cursor phải ra đúng tập, đúng thứ tự, không lặp một hàng nào."""
    day_du = ids(
        lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=moi_nhat&limit=50")["threads"]
    )
    tung_trang = duyet_bang_cursor(
        client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=moi_nhat", limit=3
    )

    assert tung_trang == day_du
    assert len(set(tung_trang)) == len(tung_trang)


def test_cursor_khong_trung_khong_sot_khi_co_binh_luan_moi_chen_vao(
    client, seed_chung, nguoi_khac
):
    """Ca thật của keyset: có người viết bình luận mới GIỮA hai lần lật trang.

    Với `sort=moi_nhat`, bài mới ra đời sau nên nó nằm ở phía TRƯỚC cursor ⇒ trang sau
    không được thấy nó, và cũng không được vì thế mà lệch một nấc. Đây đúng là chỗ
    `OFFSET` hỏng: mọi hàng tụt xuống một bậc, hàng cuối trang 1 hiện lại ở đầu trang 2.
    """
    t1 = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=moi_nhat&limit=4")
    moi = viet(seed_chung, nguoi_khac, "Bình luận chen ngang", up=1)

    t2 = lay(
        client,
        f"/api/v1/machs/{seed_chung.pk}/comments?sort=moi_nhat&limit=4&cursor={t1['cursor_ke_tiep']}",
    )

    assert moi.pk not in ids(t1["threads"]) + ids(t2["threads"])
    assert set(ids(t1["threads"])) & set(ids(t2["threads"])) == set()

    day_du = ids(
        lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=moi_nhat&limit=50")["threads"]
    )
    assert ids(t1["threads"]) + ids(t2["threads"]) == [
        pk for pk in day_du if pk != moi.pk
    ][:8]


def test_cursor_rac_tra_400(client, seed):
    d = lay(
        client,
        f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat&cursor=khong-phai-base64!!",
        status=400,
    )
    assert d["code"] == "cursor_khong_hop_le"


def test_tham_so_phan_trang_SAI_SORT_tra_400_chu_khong_bi_nuot_im_lang(
    client, seed_chung
):
    """Z5 — hai kiểu phân trang không dùng lẫn nhau, và dùng nhầm phải NỔ.

    Ca thật của 1c: người dùng đang ở trang 3 của `moi_nhat` bấm đổi sang `hay_nhat`,
    router Next giữ nguyên query string ⇒ `?sort=hay_nhat&cursor=...`. Nhánh `hay_nhat`
    của `_cat_goc` **không bao giờ đọc `cursor`**, nên API trả trang 1 kèm HTTP 200 trong
    khi UI tưởng mình vẫn ở trang 3 và append tiếp — lặp dòng hoặc mất dòng, im lặng.

    Đây đúng là kịch bản mà `api/phan_trang.py` tự cấm cho cursor rác ("cursor rác mà bị
    hiểu thành trang đầu là người dùng nhận lại trang 1 trong khi tưởng mình đang đọc
    trang 5"); cursor **hợp lệ nhưng sai sort** không được hưởng luật lỏng hơn.
    """
    hop_le = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=moi_nhat&limit=5")[
        "cursor_ke_tiep"
    ]
    assert hop_le, "cần một cursor THẬT thì mới đo được 'hợp lệ nhưng sai sort'"

    d = lay(
        client,
        f"/api/v1/machs/{seed_chung.pk}/comments?sort=hay_nhat&cursor={hop_le}",
        status=400,
    )
    assert d["code"] == "tham_so_khong_hop_le"

    for sort in ("moi_nhat", "cu_nhat"):
        d = lay(
            client,
            f"/api/v1/machs/{seed_chung.pk}/comments?sort={sort}&offset=5",
            status=400,
        )
        assert d["code"] == "tham_so_khong_hop_le", sort

    # Đối chứng: đúng cặp thì vẫn 200, và `offset=0` không phải là "có truyền offset".
    lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=hay_nhat&offset=5")
    lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=moi_nhat&cursor={hop_le}")
    lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=cu_nhat&offset=0")


def test_limit_qua_tran_tra_400(client, seed):
    d = lay(client, f"/api/v1/machs/{seed.pk}/comments?limit=500", status=400)
    assert d["code"] == "tham_so_khong_hop_le"


def test_mach_khong_ton_tai_thi_404(client, db):
    assert lay(client, "/api/v1/machs/424242/comments", status=404)["code"] == (
        "khong_tim_thay"
    )


# --- Chỉ thread KHÔNG neo (user chốt 2026-08-26) -----------------------------
#
# Khối này là chỗ DUY NHẤT trong file được phép dùng `seed` thô: `seed_chung` gỡ đúng cái
# điều kiện phép lọc đọc, nên mọi khẳng định ở đây chạy trên nó sẽ xanh kể cả khi dòng
# `goc_khong_neo` bị xoá khỏi `api/machs.py`.


def goc_theo_neo(mach: Mach) -> dict[int | None, set[int]]:
    """`{anchor_moc_seq: id các thread GỐC}` đọc thẳng từ DB — oracle độc lập với API.

    Không gọi `core.doc_noi_dung`: bài đo phải tự biết câu trả lời đúng, nếu không nó chỉ
    chứng minh hàm bằng chính nó (xem docstring module).
    """
    ra: dict[int | None, set[int]] = {}
    for c in Comment.objects.filter(mach=mach, parent__isnull=True):
        ra.setdefault(c.anchor_moc_seq, set()).add(c.pk)
    return ra


@pytest.mark.parametrize("sort", ["hay_nhat", "moi_nhat", "cu_nhat"])
def test_khan_dai_CHI_tra_thread_goc_khong_neo(client, seed, sort):
    """Tiêu chí 1: mọi thread ở khu bình luận chung phải `anchor_moc_seq === null`.

    Đo trên `seed` thô, nơi 13/14 thread gốc CÓ neo — tức nếu phép lọc biến mất thì 13
    thread ấy tràn vào và bài đo đỏ ngay ở vế đầu.
    """
    d = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort={sort}&limit=50")

    assert d["threads"], "seed phải còn ít nhất một thread chung, nếu không bài đo rỗng"
    assert all(t["anchor_moc_seq"] is None for t in d["threads"])

    khong_neo = goc_theo_neo(seed)[None]
    assert set(ids(d["threads"])) == khong_neo
    assert d["tong_thread"] == len(khong_neo)
    assert len(khong_neo) < 14, (
        "seed phải còn thread CÓ neo, nếu không phép lọc không có gì để lọc"
    )


def test_khan_dai_va_cac_ngan_keo_PHU_DUNG_MOT_LAN_moi_thread_goc(client, seed):
    """Bất biến của cả lượt vá: mỗi thread gốc có đúng **một** nhà trên trang.

    Hợp của khán đài và mọi ngăn kéo phải bằng đúng tập thread gốc, và các tập phải rời
    nhau đôi một. Đây là điều kiện để `id="bl-N"` không trùng trong DOM (§C2) — một bài đo
    chỉ khẳng định "khán đài không còn thread neo" vẫn xanh khi ngăn kéo cũng đánh mất
    chúng, và lúc đó nội dung biến mất khỏi cả trang mà không có gì đỏ.
    """
    that = goc_theo_neo(seed)

    kd = lay(client, f"/api/v1/machs/{seed.pk}/comments?limit=50")
    hop: set[int] = set(ids(kd["threads"]))
    assert hop == that.get(None, set())

    for moc in Moc.objects.filter(mach=seed):
        nk = lay(client, f"/api/v1/mocs/{moc.pk}/comments")
        cua_moc = set(ids(nk["threads"]))
        assert cua_moc == that.get(moc.seq, set()), f"ngăn kéo mốc {moc.seq}"
        assert hop & cua_moc == set(), f"thread hiện hai lần: mốc {moc.seq}"
        hop |= cua_moc

    assert hop == {pk for tap in that.values() for pk in tap}


def test_POST_THUONG_KHONG_loc_thread_neo(client, sub, tac_gia, nguoi_khac):
    """Tiêu chí 3 — nửa còn lại của luật, và là nửa dễ bị bỏ quên nhất.

    Post thường (`entry_count == 1`) không có ngăn kéo (PLAN 5.1), nên lọc ở đó là làm
    bình luận neo mốc 1 — di sản thời composer neo tự động — biến mất khỏi MỌI cửa hiển
    thị. Bỏ điều kiện `entry_count >= 2` ở `api/machs.py` là bài đo này đỏ.

    Vế hai: nối mốc 2 vào thì chính bài đó thành mạch, và câu neo dọn sang ngăn kéo mốc 1
    — cùng một dữ liệu, hai hành vi, và cả hai đều đúng luật.
    """
    m, _ = tao_mach(sub=sub, author=tac_gia, title="Post thường", body="Thân bài.")
    neo = viet(m, nguoi_khac, "Câu neo mốc 1", anchor=1, up=2)
    chung = viet(m, nguoi_khac, "Câu không neo", up=1)

    d = lay(client, f"/api/v1/machs/{m.pk}/comments")
    assert set(ids(d["threads"])) == {neo.pk, chung.pk}
    assert d["tong_thread"] == 2

    them_moc(mach=m, author=tac_gia, body="Mốc 2.")
    m.refresh_from_db()
    assert m.entry_count == 2

    d = lay(client, f"/api/v1/machs/{m.pk}/comments")
    assert ids(d["threads"]) == [chung.pk]

    moc1 = Moc.objects.get(mach=m, seq=1)
    nk = lay(client, f"/api/v1/mocs/{moc1.pk}/comments")
    assert ids(nk["threads"]) == [neo.pk]


# --- §F: `moi_nhat` bump theo hoạt động, reply đọc xuôi (user chốt 2026-08-26) ---


def hoat_dong_that(mach: Mach, goc: Comment):
    """Oracle ĐỘC LẬP của `Nut.hoat_dong` — max `created_at` trên nút ĐỌC ĐƯỢC của thread.

    Cố ý **không** import `core.doc_noi_dung`: đo bằng chính hàm bị đo thì đổi luật là kỳ
    vọng đổi theo và bài đo vẫn xanh (xem docstring module). Cây con nhận diện bằng tiền
    tố `path` — segment cố định 6 chữ số nên `"<path>."` là tiền tố an toàn.
    """
    ca = [goc, *Comment.objects.filter(mach=mach, path__startswith=f"{goc.path}.")]
    doc_duoc = [
        c.created_at for c in ca if c.deleted_at is None and c.hidden_at is None
    ]
    return max(doc_duoc) if doc_duoc else goc.created_at


def test_moi_nhat_BUMP_theo_reply_moi_va_BIA_MO_khong_bump(
    client, mach_cu, nguoi_khac, tac_gia
):
    """Tiêu chí 11 — *"nếu có reply mới thì nổi lên"*, và bia mộ thì KHÔNG.

    Hai vế phải đứng cùng nhau. Vế đầu một mình xanh với cài đặt "lấy max `created_at`
    trên CẢ cây con, không hỏi trạng thái" — bản dễ viết nhất và bản sai: nó để một dòng
    `[bình luận đã xoá]` đẩy thread lên đầu danh sách, tức một thứ tự không giải thích
    được bằng thứ gì trên màn hình.

    Reply bị xoá ở đây **vẫn còn trên trang dưới dạng bia mộ** (nó đã từng được trích, PLAN
    5.3 dòng 175), nên bài đo phân biệt được "không bump" với "biến mất". Nếu nó biến mất
    hẳn thì vế thứ hai xanh vì một lý do khác hẳn lý do nó được viết ra.
    """
    a = viet(
        mach_cu, nguoi_khac, "Thread A — mở trước",
        khi=timezone.now() - timedelta(days=5),
    )
    b = viet(
        mach_cu, nguoi_khac, "Thread B — mở sau A",
        khi=timezone.now() - timedelta(days=3),
    )
    reply = viet(
        mach_cu, tac_gia, "Reply mới nhất, nằm trong A", parent=a,
        khi=timezone.now() - timedelta(days=1),
    )

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments?sort=moi_nhat")
    assert ids(d["threads"]) == [a.pk, b.pk], "A phải nổi lên nhờ reply mới hơn B"

    # Vế đối chứng cùng dữ liệu: `cu_nhat` KHÔNG bump, nó vẫn theo ngày mở thread.
    cu = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments?sort=cu_nhat")
    assert ids(cu["threads"]) == [a.pk, b.pk]

    # Trích rồi xoá ⇒ reply ở lại làm bia mộ, mất nội dung, và mất luôn quyền bump.
    Trich.objects.create(moc=Moc.objects.get(mach=mach_cu, seq=1), comment=reply)
    Comment.objects.filter(pk=reply.pk).update(deleted_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{mach_cu.pk}/comments?sort=moi_nhat")
    assert ids(d["threads"]) == [b.pk, a.pk], "bia mộ không được bump thread"

    thread_a = next(t for t in d["threads"] if t["id"] == a.pk)
    con = [r for r in thread_a["replies"] if r["id"] == reply.pk]
    assert con and con[0]["trang_thai"] == "da_xoa" and con[0]["body"] is None, (
        "bia mộ phải CÒN trên trang — nếu không, vế 'không bump' xanh vì nó biến mất"
    )


def test_moi_nhat_reply_doc_XUOI_cu_truoc_moi(client, seed_chung):
    """Tiêu chí 12, nửa khán đài — hội thoại đọc từ trên xuống theo thời gian.

    Trước 2026-08-26 con của `moi_nhat` sắp mới → cũ, tức câu trả lời in TRÊN câu nó trả
    lời. Nửa ngăn kéo của cùng tiêu chí ở
    `test_api_ngan_keo.py::test_ngan_keo_goc_BUMP_theo_hoat_dong_con_doc_XUOI`.
    """
    d = lay(client, f"/api/v1/machs/{seed_chung.pk}/comments?sort=moi_nhat&limit=50")

    def kiem(nuts, o_dau):
        khi = [t["created_at"] for t in nuts]
        assert khi == sorted(khi), f"tầng {o_dau} chưa cũ→mới: {khi}"
        for t in nuts:
            kiem(t["replies"], f"reply của #{t['id']}")

    for t in d["threads"]:
        kiem(t["replies"], f"reply của #{t['id']}")

    def sau_nhat(n):
        return max([len(n["replies"])] + [sau_nhat(r) for r in n["replies"]])

    assert max(sau_nhat(t) for t in d["threads"]) >= 2, (
        "cần ít nhất một nút mang ≥2 reply: danh sách 0–1 phần tử 'đã sắp' theo mọi chiều"
    )


def test_cursor_moi_nhat_chay_tren_khoa_HOAT_DONG_chu_khong_phai_created_at(
    client, mach_cu, nguoi_khac, tac_gia
):
    """Tiêu chí 13 — cursor phải neo vào ĐÚNG khoá đang sắp, nếu không trang 2 lấy bừa.

    55 thread chung để đi qua cả trần mặc định 50, và cứ 3 thread thì 1 thread nhận reply
    muộn — nhờ vậy khoá hoạt động **khác hẳn** khoá `created_at` của gốc trên 1/3 số hàng,
    tức một cài đặt "sinh cursor bằng `created_at`" sẽ cắt danh sách ở một mốc không liên
    quan gì tới thứ tự đang hiện.

    Dữ liệu **đứng yên** trong lúc đi: đó là điều kiện của lời hứa "không lặp không sót" ở
    khoá biến đổi. Ca dữ liệu ĐỔI giữa hai trang là đánh đổi đã chốt, ghi ở `_cat_goc`.
    """
    nen = timezone.now() - timedelta(days=9)
    goc = [
        viet(mach_cu, nguoi_khac, f"Thread {i}", khi=nen + timedelta(minutes=i))
        for i in range(55)
    ]
    for i in range(0, 55, 3):
        viet(
            mach_cu, tac_gia, f"Reply muộn vào {i}", parent=goc[i],
            khi=nen + timedelta(days=1, minutes=i),
        )

    di_het = duyet_bang_cursor(
        client, f"/api/v1/machs/{mach_cu.pk}/comments?sort=moi_nhat", limit=10
    )
    assert len(di_het) == len(set(di_het)) == 55, "không lặp, không sót"
    assert set(di_het) == {c.pk for c in goc}

    khoa = {c.pk: (hoat_dong_that(mach_cu, c), c.pk) for c in goc}
    thu_tu = [khoa[pk] for pk in di_het]
    assert thu_tu == sorted(thu_tu, reverse=True), (
        "thứ tự NỐI các trang phải đơn điệu giảm theo (hoạt động, id)"
    )

    theo_created_at = [
        c.pk for c in sorted(goc, key=lambda c: (c.created_at, c.pk), reverse=True)
    ]
    assert di_het != theo_created_at, (
        "dữ liệu phải làm hai khoá cho hai thứ tự KHÁC nhau, nếu không bài đo này xanh "
        "cả với cursor sinh bằng created_at"
    )
