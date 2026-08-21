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

from core.ghi import cap_nhat_dem_mach, tao_mach
from core.models import Comment, Mach
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


def test_hay_nhat_xep_dung_wilson_tren_seed(client, seed):
    """Thứ tự API trả về phải khớp bảng xếp hạng tính LẠI từ công thức của PLAN.

    Seed cố ý rải điểm để 14 thread gốc không đồng hạng
    (`test_seed_dev.py::test_diem_vote_rai_du_de_top_10_wilson_co_nghia`), nên thứ tự
    này phân biệt được mọi hoán vị — không phải kiểu "gần đúng cũng xanh".
    """
    d = lay(client, f"/api/v1/machs/{seed.pk}/comments")
    now = timezone.now()

    goc = list(Comment.objects.filter(mach=seed, parent__isnull=True))
    mong_doi = sorted(
        goc,
        key=lambda c: (
            -rank_doc_lap(c, last_entry_at=seed.last_entry_at, now=now),
            c.created_at,
            c.pk,
        ),
    )

    assert d["sort"] == "hay_nhat"
    assert d["tong_thread"] == len(goc) == 14
    assert ids(d["threads"]) == [c.pk for c in mong_doi]


def test_hay_nhat_dat_binh_luan_diem_cao_nhat_len_dau(client, seed):
    """Ràng buộc thô nhưng độc lập với mọi công thức: 31↑/0↓ phải đứng đầu."""
    d = lay(client, f"/api/v1/machs/{seed.pk}/comments")
    dau = d["threads"][0]
    assert (dau["up_count"], dau["down_count"]) == (31, 0)


def test_moi_nhat_va_cu_nhat_la_hai_chieu_cua_cung_mot_truc(client, seed):
    moi = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat")
    cu = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=cu_nhat")

    assert ids(moi["threads"]) == list(reversed(ids(cu["threads"])))
    assert moi["sort"] == "moi_nhat" and cu["sort"] == "cu_nhat"

    khi = {
        c.pk: c.created_at
        for c in Comment.objects.filter(mach=seed, parent__isnull=True)
    }
    assert ids(cu["threads"]) == sorted(khi, key=lambda pk: (khi[pk], pk))


def test_sort_la_hai_gia_tri_khac_nhau_chu_khong_phai_mot(client, seed):
    """Đối chứng cho bài trên: `moi_nhat` và `hay_nhat` KHÔNG được ra cùng thứ tự.

    Nếu chúng trùng nhau thì mọi bài đo sort đều đo trên một cài đặt duy nhất, và mutant
    "bỏ qua tham số `sort`" sẽ sống sót qua tất cả.
    """
    hay = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=hay_nhat")
    moi = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat")
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


def test_tra_cay_long_nhau_moi_nut_co_depth(client, seed):
    """PLAN mục 7 — "server sort, trả cây đã dựng"; PLAN 5.3 — mỗi nút có `depth`."""
    d = lay(client, f"/api/v1/machs/{seed.pk}/comments")
    tat_ca = phang(d["threads"])

    assert len(tat_ca) == 24
    assert all(t["depth"] == 1 for t in d["threads"])
    assert max(t["depth"] for t in tat_ca) >= 3, "seed phải có nhánh 3 tầng"
    for t in d["threads"]:
        for r in t["replies"]:
            assert r["depth"] == 2 and r["parent_id"] == t["id"]


def test_reply_khong_mang_anchor_rieng(client, seed):
    """PLAN nguyên tắc 6 — reply kế thừa neo của gốc, không tự neo mốc nào."""
    d = lay(client, f"/api/v1/machs/{seed.pk}/comments")
    for t in d["threads"]:
        for r in phang(t["replies"]):
            assert r["anchor_moc_seq"] is None


def test_badge_chu_mach_va_tu_gap(client, seed):
    """Badge `[CHỦ MẠCH]` (PLAN mục 2) và "điểm ≤ −5 tự gập" (PLAN 5.3), server quyết."""
    d = lay(client, f"/api/v1/machs/{seed.pk}/comments")
    tat_ca = phang(d["threads"])

    chu = {t["id"] for t in tat_ca if t["la_chu_mach"]}
    that = set(
        Comment.objects.filter(mach=seed, author=seed.author).values_list(
            "pk", flat=True
        )
    )
    assert chu == that and chu

    gap = {t["id"] for t in tat_ca if t["tu_gap"]}
    assert gap == {
        c.pk for c in Comment.objects.filter(mach=seed) if c.score <= -5
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


def test_hay_nhat_phan_trang_bang_offset_khong_bang_cursor(client, seed):
    """PLAN 5.3 — `hay_nhat` trả một trang rồi "xem thêm" bằng `?offset=`."""
    t1 = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=hay_nhat&limit=5")
    assert len(t1["threads"]) == 5
    assert t1["tong_thread"] == 14
    assert t1["offset_ke_tiep"] == 5
    assert t1["cursor_ke_tiep"] is None

    t2 = lay(
        client,
        f"/api/v1/machs/{seed.pk}/comments?sort=hay_nhat&limit=5&offset={t1['offset_ke_tiep']}",
    )
    day_du = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=hay_nhat&limit=50")
    assert ids(t1["threads"]) + ids(t2["threads"]) == ids(day_du["threads"])[:10]

    cuoi = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=hay_nhat&limit=5&offset=10")
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


def test_cursor_moi_nhat_khong_trung_khong_sot(client, seed):
    """R8 — đi hết bằng cursor phải ra đúng tập, đúng thứ tự, không lặp một hàng nào."""
    day_du = ids(
        lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat&limit=50")["threads"]
    )
    tung_trang = duyet_bang_cursor(
        client, f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat", limit=3
    )

    assert tung_trang == day_du
    assert len(set(tung_trang)) == len(tung_trang)


def test_cursor_khong_trung_khong_sot_khi_co_binh_luan_moi_chen_vao(
    client, seed, nguoi_khac
):
    """Ca thật của keyset: có người viết bình luận mới GIỮA hai lần lật trang.

    Với `sort=moi_nhat`, bài mới ra đời sau nên nó nằm ở phía TRƯỚC cursor ⇒ trang sau
    không được thấy nó, và cũng không được vì thế mà lệch một nấc. Đây đúng là chỗ
    `OFFSET` hỏng: mọi hàng tụt xuống một bậc, hàng cuối trang 1 hiện lại ở đầu trang 2.
    """
    t1 = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat&limit=4")
    moi = viet(seed, nguoi_khac, "Bình luận chen ngang", up=1)

    t2 = lay(
        client,
        f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat&limit=4&cursor={t1['cursor_ke_tiep']}",
    )

    assert moi.pk not in ids(t1["threads"]) + ids(t2["threads"])
    assert set(ids(t1["threads"])) & set(ids(t2["threads"])) == set()

    day_du = ids(
        lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat&limit=50")["threads"]
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


def test_tham_so_phan_trang_SAI_SORT_tra_400_chu_khong_bi_nuot_im_lang(client, seed):
    """Z5 — hai kiểu phân trang không dùng lẫn nhau, và dùng nhầm phải NỔ.

    Ca thật của 1c: người dùng đang ở trang 3 của `moi_nhat` bấm đổi sang `hay_nhat`,
    router Next giữ nguyên query string ⇒ `?sort=hay_nhat&cursor=...`. Nhánh `hay_nhat`
    của `_cat_goc` **không bao giờ đọc `cursor`**, nên API trả trang 1 kèm HTTP 200 trong
    khi UI tưởng mình vẫn ở trang 3 và append tiếp — lặp dòng hoặc mất dòng, im lặng.

    Đây đúng là kịch bản mà `api/phan_trang.py` tự cấm cho cursor rác ("cursor rác mà bị
    hiểu thành trang đầu là người dùng nhận lại trang 1 trong khi tưởng mình đang đọc
    trang 5"); cursor **hợp lệ nhưng sai sort** không được hưởng luật lỏng hơn.
    """
    hop_le = lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat&limit=5")[
        "cursor_ke_tiep"
    ]
    assert hop_le, "cần một cursor THẬT thì mới đo được 'hợp lệ nhưng sai sort'"

    d = lay(
        client,
        f"/api/v1/machs/{seed.pk}/comments?sort=hay_nhat&cursor={hop_le}",
        status=400,
    )
    assert d["code"] == "tham_so_khong_hop_le"

    for sort in ("moi_nhat", "cu_nhat"):
        d = lay(
            client,
            f"/api/v1/machs/{seed.pk}/comments?sort={sort}&offset=5",
            status=400,
        )
        assert d["code"] == "tham_so_khong_hop_le", sort

    # Đối chứng: đúng cặp thì vẫn 200, và `offset=0` không phải là "có truyền offset".
    lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=hay_nhat&offset=5")
    lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=moi_nhat&cursor={hop_le}")
    lay(client, f"/api/v1/machs/{seed.pk}/comments?sort=cu_nhat&offset=0")


def test_limit_qua_tran_tra_400(client, seed):
    d = lay(client, f"/api/v1/machs/{seed.pk}/comments?limit=500", status=400)
    assert d["code"] == "tham_so_khong_hop_le"


def test_mach_khong_ton_tai_thi_404(client, db):
    assert lay(client, "/api/v1/machs/424242/comments", status=404)["code"] == (
        "khong_tim_thay"
    )
