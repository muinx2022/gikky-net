"""`GET /mocs/{id}/comments` và `/revisions` — PLAN 5.4, 5.2. Tiêu chí R6, R7.

Ngăn kéo là chỗ hai nguyên tắc của PLAN gặp nhau, và cả hai đều dễ cài sai theo cùng một
kiểu "gọn gàng hơn":

- **nguyên tắc 6** — reply đi theo GỐC. Lọc `anchor_moc_seq = seq` thẳng trong SQL trông
  đúng và chạy nhanh, nhưng nó cắt sạch reply (reply luôn có `anchor_moc_seq IS NULL`);
- **nguyên tắc 4** — anchor để CHIẾU, không để LỌC. Ngăn kéo là *lát cắt*, không phải
  phòng thứ N của khán đài.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from core.models import Comment, Mach, Moc, MocRevision
from tests.conftest import lay, phang

pytestmark = pytest.mark.django_db


def moc_seq(mach, seq: int) -> Moc:
    return Moc.objects.get(mach=mach, seq=seq)


def ngan_keo(client, mach, seq: int):
    return lay(client, f"/api/v1/mocs/{moc_seq(mach, seq).pk}/comments")


# --- R6 ----------------------------------------------------------------------


def test_lat_cat_dung_thread_neo_vao_moc(client, seed):
    """Chỉ các thread có bình luận GỐC neo mốc này, không hơn không kém."""
    d = ngan_keo(client, seed, 5)

    goc_that = set(
        Comment.objects.filter(
            mach=seed, parent__isnull=True, anchor_moc_seq=5
        ).values_list("pk", flat=True)
    )
    assert {t["id"] for t in d["threads"]} == goc_that
    assert d["moc_seq"] == 5


def test_ngan_keo_lay_ca_reply_viet_o_thoi_diem_MOC_KHAC(client, seed):
    """PLAN nguyên tắc 6 — "ngăn kéo mốc 2 tự kể được cả lời tiên tri lẫn cái kết".

    Seed dựng sẵn `r2b`: reply viết đúng ngày mốc 9 nằm trong thread neo mốc 2. Một cài
    đặt lọc theo thời gian, hoặc lọc `anchor_moc_seq` ở tầng SQL, sẽ thiếu đúng nó — và
    thiếu im lặng, vì ngăn kéo vẫn có nội dung để hiện.
    """
    moc9 = moc_seq(seed, 9)
    d = ngan_keo(client, seed, 2)
    tat_ca = phang(d["threads"])

    muon = [t for t in tat_ca if t["created_at"] >= moc9.created_at.isoformat()]
    assert muon, "không reply nào viết ở thời điểm mốc 9 — bài đo này đang rỗng"
    assert all(t["depth"] > 1 for t in muon)


def hoat_dong_that(mach, goc: Comment):
    """Oracle ĐỘC LẬP của `Nut.hoat_dong`: max `created_at` trên nút ĐỌC ĐƯỢC của thread.

    Không import `core.doc_noi_dung` — bài đo phải tự biết câu trả lời đúng, nếu không nó
    chỉ chứng minh hàm bằng chính nó. Cây con nhận diện bằng tiền tố `path` (segment cố
    định 6 chữ số nên `"<path>."` là tiền tố an toàn), không cần đệ quy.

    Thread toàn bia mộ rơi về `created_at` của gốc — cùng luật với `Nut.hoat_dong`.
    """
    ca = [goc, *Comment.objects.filter(mach=mach, path__startswith=f"{goc.path}.")]
    doc_duoc = [
        c.created_at for c in ca if c.deleted_at is None and c.hidden_at is None
    ]
    return max(doc_duoc) if doc_duoc else goc.created_at


def test_ngan_keo_goc_BUMP_theo_hoat_dong_con_doc_XUOI(client, seed):
    """PLAN 5.4 luật 2, bản 2026-08-26: gốc **bump theo hoạt động**, con **cũ → mới**.

    Ngăn kéo dùng đúng cặp khoá của `sort=moi_nhat` (`lat_cat_ngan_keo`), nên bài này đo
    luôn nửa ngăn kéo của tiêu chí 12. Hai tầng phải đo riêng: `lat_cat_ngan_keo` truyền
    HAI hàm sắp khác nhau cho `sap_goc` và `sap_con`, và một bản vá chỉ sửa một vế thì sai
    lệch chỉ lộ ở thread có ≥2 reply.

    ⚠ Vế chống rỗng quan trọng nhất nằm ở cuối: nếu thứ tự bump TRÙNG thứ tự theo
    `created_at` của gốc trên dữ liệu này thì cả bài đo xanh với cả cài đặt cũ. Trên seed,
    mốc 2 cố ý không như vậy — thread #3 mở trước #7 nhưng có reply mới hơn.
    """
    d = ngan_keo(client, seed, 2)

    goc = list(
        Comment.objects.filter(mach=seed, parent__isnull=True, anchor_moc_seq=2)
    )
    mong_doi = sorted(
        goc, key=lambda c: (hoat_dong_that(seed, c), c.pk), reverse=True
    )
    assert [t["id"] for t in d["threads"]] == [c.pk for c in mong_doi]
    assert len(d["threads"]) >= 2, "mốc 2 phải có ≥2 thread mới đo được thứ tự gốc"

    def kiem_con(nuts, o_dau):
        khi = [t["created_at"] for t in nuts]
        assert khi == sorted(khi), f"tầng {o_dau} chưa cũ→mới: {khi}"
        for t in nuts:
            kiem_con(t["replies"], f"reply của #{t['id']}")

    for t in d["threads"]:
        kiem_con(t["replies"], f"reply của #{t['id']}")

    # Không có thread nào ≥2 reply thì `kiem_con` chỉ đệ quy vào danh sách 0–1 phần tử,
    # và "danh sách 1 phần tử đã sắp" đúng với mọi cách sắp — nửa sau bài đo biến mất.
    def sau_nhat(n):
        return max([len(n["replies"])] + [sau_nhat(r) for r in n["replies"]])

    assert max(sau_nhat(t) for t in d["threads"]) >= 2, (
        "mốc 2 phải có ít nhất một nút mang ≥2 reply, nếu không tầng CON không được đo"
    )

    theo_goc = [c.pk for c in sorted(goc, key=lambda c: (c.created_at, c.pk), reverse=True)]
    assert [t["id"] for t in d["threads"]] != theo_goc, (
        "trên mốc 2, bump phải cho thứ tự KHÁC sắp theo created_at của gốc — nếu không "
        "bài đo này xanh cả với cài đặt trước 2026-08-26"
    )


def test_binh_luan_go_chip_khong_thuoc_ngan_keo_nao(client, seed):
    """PLAN nguyên tắc 4 — `anchor_moc_seq = NULL` là "cố ý không neo", không phải thiếu."""
    go_chip = Comment.objects.get(
        mach=seed, parent__isnull=True, anchor_moc_seq__isnull=True
    )
    xuat_hien = [
        seq
        for seq in range(1, 10)
        if go_chip.pk in {t["id"] for t in ngan_keo(client, seed, seq)["threads"]}
    ]
    assert xuat_hien == []


def test_so_binh_luan_cua_ngan_keo_khop_voi_spine(client, seed):
    """Con số "💬 N" trên spine và số dòng **ĐỌC ĐƯỢC** trong ngăn kéo phải là một.

    Chữ "đọc được" là K3, không phải chi tiết vụn: bia mộ giữ chỗ vẫn render nhưng **không
    được đếm**. Bản đầu so thẳng với `len(phang(threads))` — đúng hôm nay chỉ vì seed chưa
    có bia mộ nào, và nó sẽ đỏ **vì lý do sai** ngay khi có một cái. Bài dưới dựng hẳn một
    bia mộ để cả hai vế cùng chạy qua.
    """
    # Gốc CÓ reply: xoá nó để lại bia mộ giữ chỗ, thay vì làm nó biến mất hẳn.
    goc = (
        Comment.objects.filter(
            mach=seed, parent__isnull=True, anchor_moc_seq=2, replies__isnull=False
        )
        .distinct()
        .first()
    )
    assert goc is not None
    Comment.objects.filter(pk=goc.pk).update(deleted_at=timezone.now())

    spine = {s["seq"]: s["so_binh_luan"] for s in lay(client, f"/api/v1/machs/{seed.pk}")["spine"]}

    co_bia_mo = 0
    for seq in range(1, 10):
        d = ngan_keo(client, seed, seq)
        dong = phang(d["threads"])
        doc_duoc = [t for t in dong if t["trang_thai"] == "binh_thuong"]
        co_bia_mo += len(dong) - len(doc_duoc)
        assert d["so_binh_luan"] == spine[seq] == len(doc_duoc), f"mốc {seq}"

    assert co_bia_mo == 1, "không có bia mộ nào thì vế K3 của bài đo này đang rỗng"


# --- R7 ----------------------------------------------------------------------


def test_moc_khong_binh_luan_tra_rong_va_giu_cau_moi(client, seed):
    """R7 / PLAN 5.4 luật 4 — mốc 6 của seed cố ý có 0 bình luận và mang câu mồi.

    Cả hai vế đều cần dữ liệu để chạy qua: mốc rỗng để chứng minh "không hiện 💬 0", và
    câu mồi trên chính mốc rỗng đó để chứng minh vế "+ `question_for_crowd` nếu có".
    Seed được vá ở 1a đúng vì trước đó không mốc nào thoả cả hai.
    """
    d = ngan_keo(client, seed, 6)

    assert d["threads"] == []
    assert d["so_binh_luan"] == 0
    assert d["question_for_crowd"] == moc_seq(seed, 6).question_for_crowd
    assert d["question_for_crowd"]


def test_moc_co_binh_luan_nhung_khong_co_cau_moi_tra_null(client, seed):
    """Đối chứng: `question_for_crowd` không phải hằng số, mốc khác trả `null`."""
    assert ngan_keo(client, seed, 5)["question_for_crowd"] is None


# --- Bia mộ ------------------------------------------------------------------


def test_ngan_keo_cua_bia_mo_van_mo_duoc_nhung_mat_cau_moi(client, seed):
    """Mốc thành bia mộ không kéo bình luận biến mất theo, nhưng nội dung mốc thì mất."""
    Moc.objects.filter(mach=seed, seq=6).update(hidden_at=timezone.now())
    rong = ngan_keo(client, seed, 6)
    assert rong["question_for_crowd"] is None

    Moc.objects.filter(mach=seed, seq=5).update(deleted_at=timezone.now())
    d = ngan_keo(client, seed, 5)
    assert d["so_binh_luan"] == 4, "bình luận của mốc bia mộ vẫn đọc được"


def test_moc_thuoc_mach_bi_an_thi_404(client, seed):
    moc = moc_seq(seed, 2)
    Mach.objects.filter(pk=seed.pk).update(hidden_at=timezone.now())
    assert lay(client, f"/api/v1/mocs/{moc.pk}/comments", status=404)["code"] == (
        "khong_tim_thay"
    )


def test_moc_khong_ton_tai_thi_404(client, db):
    assert lay(client, "/api/v1/mocs/424242/comments", status=404)["code"] == (
        "khong_tim_thay"
    )


# --- `/revisions` (PLAN 5.2) -------------------------------------------------


def test_moc_chua_sua_lan_nao_tra_mang_rong_chu_khong_404(client, seed):
    d = lay(client, f"/api/v1/mocs/{moc_seq(seed, 1).pk}/revisions")
    assert d["items"] == []
    assert d["moc_seq"] == 1


def test_revisions_tra_du_5_truong_sua_duoc_moi_thay_the_truoc(client, seed):
    """PLAN 5.2 — bản cũ phải đủ 5 trường thì diff mới hiện được thay đổi ngày."""
    moc = moc_seq(seed, 2)
    cu = MocRevision.objects.create(
        moc=moc,
        body="Bản cũ hơn",
        figures=[{"label": "A", "value": "1"}],
        occurred_at=moc.occurred_at,
        loai="cũ",
        question_for_crowd="Câu mồi cũ",
        revised_at=timezone.now() - timedelta(days=2),
    )
    moi = MocRevision.objects.create(
        moc=moc,
        body="Bản mới hơn",
        figures=None,
        occurred_at=moc.occurred_at,
        loai=None,
        question_for_crowd=None,
    )

    d = lay(client, f"/api/v1/mocs/{moc.pk}/revisions")
    assert [b["id"] for b in d["items"]] == [moi.pk, cu.pk]
    assert d["items"][1]["figures"] == [{"label": "A", "value": "1"}]
    assert set(d["items"][0]) == {
        "id",
        "body",
        "figures",
        "occurred_at",
        "loai",
        "question_for_crowd",
        "revised_at",
    }


def test_revisions_cua_moc_bia_mo_tra_404(client, seed):
    """Bản cũ chứa nguyên văn nội dung — mốc bị gỡ ở cửa trước không được đọc ở cửa sau."""
    moc = moc_seq(seed, 3)
    MocRevision.objects.create(
        moc=moc,
        body="NỘI DUNG CŨ KHÔNG ĐƯỢC LỘ",
        figures=None,
        occurred_at=moc.occurred_at,
        loai=None,
        question_for_crowd=None,
    )
    assert lay(client, f"/api/v1/mocs/{moc.pk}/revisions")["items"]

    Moc.objects.filter(pk=moc.pk).update(hidden_at=timezone.now())
    assert lay(client, f"/api/v1/mocs/{moc.pk}/revisions", status=404)["code"] == (
        "khong_tim_thay"
    )

    Moc.objects.filter(pk=moc.pk).update(hidden_at=None, deleted_at=timezone.now())
    assert lay(client, f"/api/v1/mocs/{moc.pk}/revisions", status=404)["code"] == (
        "khong_tim_thay"
    )
