"""`GET /machs/{id}` — PLAN mục 7, 5.2, 5.5, 8.4, 9.2. Tiêu chí R1, R3, R4.

Ba thứ được ghim ở đây, theo thứ tự quan trọng:

1. **Không một trường nào phụ thuộc người xem** (R3) — response này cache được, nên một
   trường per-user lọt vào là dữ liệu của người này được phục vụ cho người kia;
2. `face` đúng **vế thời gian** của PLAN 5.5, không hơn không kém (R4);
3. bia mộ giữ chỗ trên spine mà không mang theo nội dung (PLAN 5.2).
"""

import logging
from datetime import timedelta

import pytest
from django.utils import timezone

from api.v1 import api_v1
from core.mat import MAT_BAO, MAT_CAN, NGUONG_BAO
from core.models import Mach, Moc, Trich
from tests.conftest import khoa_json, lay
from tests.test_operation_id import moi_operation

pytestmark = pytest.mark.django_db


def test_tra_du_moc_va_thong_tin_mach(client, seed):
    d = lay(client, f"/api/v1/machs/{seed.pk}")

    assert d["id"] == seed.pk
    assert d["title"] == seed.title
    assert d["sub"]["slug"] == "chung-khoan"
    assert d["author"]["username"] == "ba_muoi_phien"
    assert d["status"] == "closed"
    assert d["ket_qua"] == "+18.2% · 163 ngày"
    assert d["locked"] is False
    assert d["entry_count"] == 9
    assert d["comment_count"] == 24
    assert [m["seq"] for m in d["mocs"]] == list(range(1, 10))
    assert [s["seq"] for s in d["spine"]] == list(range(1, 10))
    assert d["mocs"][0]["figures"] == [
        {"label": "GIÁ VÀO", "value": "27.80"},
        {"label": "DỪNG LỖ", "value": "26.40"},
        {"label": "TỶ TRỌNG", "value": "12% NAV"},
    ]


def test_post_thuong_la_nhanh_doi_chung(client, seed_post_thuong):
    """`entry_count == 1` + `ket_qua` NULL — 1c phải render như post thường (PLAN 5.1)."""
    d = lay(client, f"/api/v1/machs/{seed_post_thuong.pk}")

    assert d["entry_count"] == 1
    assert d["ket_qua"] is None
    assert len(d["spine"]) == 1


# --- R3: bề mặt response, không có gì per-user -------------------------------

#: Mọi tên khoá được phép xuất hiện ở BẤT KỲ tầng nào của `GET /machs/{id}`.
#: Viết cứng là cố ý: thêm một trường mới vào response phải là hành động có ý thức, và
#: dòng thêm vào đây là chỗ người review nhìn thấy nó.
KHOA_CHO_PHEP = {
    # mạch
    "id", "slug", "title", "sub", "author", "status", "closed_at", "ket_qua",
    "locked", "created_at", "last_entry_at", "last_activity_at", "entry_count",
    "comment_count", "face", "mocs", "spine",
    # sub + tác giả
    "ten", "username", "display_name",
    # mốc
    "seq", "occurred_at", "loai", "body", "question_for_crowd", "figures",
    "edited_at", "edit_count", "score", "trang_thai", "so_binh_luan", "trich",
    # figures
    "label", "value",
    # trích
    "comment_id", "comment_created_at", "trich_created_at", "anchor_moc_seq",
    # spine
    "da_xoa", "da_an",
}

#: Những mảnh chữ chỉ có nghĩa khi biết NGƯỜI XEM là ai. Danh sách này không phải hàng
#: rào chính (hàng rào chính là phép so tập khoá ở trên) — nó là lưới thứ hai, bắt cả
#: trường hợp ai đó vừa thêm trường per-user vừa nhớ thêm nó vào `KHOA_CHO_PHEP`.
MANH_PER_USER = ("my_", "_cua_toi", "toi_", "following", "da_follow", "last_seen", "viewer")


def test_khong_co_truong_nao_phu_thuoc_nguoi_xem(client, seed):
    """R3 — `GET /machs/{id}` phải cache được (PLAN 8.4 điểm 4).

    PLAN gọi đây là "điểm dễ làm sai nhất". Cách làm sai: nhét `my_vote`/`following` vào
    response cho tiện 1c. Trang được ISR cache theo URL, nên người thứ hai mở cùng URL
    sẽ nhận trạng thái của người thứ nhất — HTTP 200, không có gì đỏ.
    """
    khoa = khoa_json(lay(client, f"/api/v1/machs/{seed.pk}"))

    assert khoa == KHOA_CHO_PHEP, (
        f"thừa: {sorted(khoa - KHOA_CHO_PHEP)} · thiếu: {sorted(KHOA_CHO_PHEP - khoa)}"
    )
    dang_ngo = [k for k in khoa if any(m in k for m in MANH_PER_USER)]
    assert dang_ngo == [], f"trường nghi phụ thuộc người xem: {dang_ngo}"


def test_bai_do_khoa_json_that_su_di_xuong_tang_sau(client, seed):
    """Đối chứng: `khoa_json` phải thấy được khoá nằm sâu, không chỉ khoá tầng một.

    Nếu nó chỉ đọc tầng một thì bài đo R3 ở trên xanh kể cả khi `my_vote` được nhét vào
    từng nút mốc — đúng chỗ người ta sẽ nhét.
    """
    assert "label" in khoa_json(lay(client, f"/api/v1/machs/{seed.pk}"))
    assert khoa_json({"a": [{"b": {"c": 1}}]}) == {"a", "b", "c"}


# --- R4: face ----------------------------------------------------------------


def dat(mach: Mach, **truong) -> Mach:
    Mach.objects.filter(pk=mach.pk).update(**truong)
    mach.refresh_from_db()
    return mach


def face(client, mach: Mach) -> str:
    return lay(client, f"/api/v1/machs/{mach.pk}")["face"]


def test_mach_dong_va_nguoi_thi_can(client, seed):
    """Mạch HPG của seed: đóng sổ, hoạt động cuối cách đây 45 ngày ⇒ CẶN."""
    assert seed.status == Mach.TrangThai.DONG
    assert timezone.now() - seed.last_activity_at > NGUONG_BAO
    assert face(client, seed) == MAT_CAN


def test_mach_mo_nhung_nguoi_thi_van_can(client, seed_post_thuong):
    """Giết mutant "bỏ điều kiện 72h": post thường đang MỞ nhưng nguội 5 ngày."""
    assert seed_post_thuong.status == Mach.TrangThai.MO
    assert timezone.now() - seed_post_thuong.last_activity_at > NGUONG_BAO
    assert face(client, seed_post_thuong) == MAT_CAN


def test_mach_mo_va_vua_hoat_dong_thi_bao(client, seed_post_thuong):
    """Giết mutant "luôn trả CẶN"."""
    dat(seed_post_thuong, last_activity_at=timezone.now())
    assert face(client, seed_post_thuong) == MAT_BAO


def test_mach_dong_du_vua_hoat_dong_van_can(client, seed):
    """Giết mutant "bỏ điều kiện status": mạch đã đóng sổ không bao giờ là BÃO."""
    dat(seed, last_activity_at=timezone.now())
    assert face(client, seed) == MAT_CAN


def test_mach_bi_mod_khoa_thi_can(client, seed_post_thuong):
    """Giết mutant "bỏ điều kiện locked_at". `locked_at` là trục RIÊNG với `status`."""
    dat(seed_post_thuong, last_activity_at=timezone.now(), locked_at=timezone.now())
    d = lay(client, f"/api/v1/machs/{seed_post_thuong.pk}")
    assert d["locked"] is True
    assert d["face"] == MAT_CAN


def test_nguong_72h_lat_mat_qua_duong_HTTP(client, seed_post_thuong):
    """Ngưỡng 72h của PLAN 5.5 có hiệu lực thật khi đi qua endpoint.

    Hai mốc cách ngưỡng **một phút** về hai phía, không phải đúng bằng ngưỡng: `now` của
    handler luôn muộn hơn `now` của bài đo vài mili-giây, nên một bài đo đặt
    `last_activity_at = now − 72h` rồi đòi BÃO sẽ **thắng thua theo may rủi**. Biên `≤`
    chính xác được đo ở `test_mat.py`, nơi `now` là tham số truyền vào chứ không phải
    đồng hồ đang chạy.
    """
    dat(seed_post_thuong, last_activity_at=timezone.now() - NGUONG_BAO + timedelta(minutes=1))
    assert face(client, seed_post_thuong) == MAT_BAO

    dat(seed_post_thuong, last_activity_at=timezone.now() - NGUONG_BAO - timedelta(minutes=1))
    assert face(client, seed_post_thuong) == MAT_CAN


def test_face_khong_doi_theo_nguoi_dang_nhap(client, django_user_model, seed_post_thuong):
    """Vế "user đã follow / từng bình luận" của PLAN 5.5 **chưa được áp** ở 1b.

    Bài đo này ghim đúng cái CHƯA làm, và nó không phải thủ tục: nếu Phase 3 cài vế
    viewer vào chính endpoint này thay vì vào `GET /machs/{id}/me`, đây là chỗ đỏ đầu
    tiên — trước khi ai đó phát hiện cache đang phục vụ mặt của người khác.
    """
    dat(seed_post_thuong, last_activity_at=timezone.now() - NGUONG_BAO * 2)
    khach = face(client, seed_post_thuong)

    nguoi = django_user_model.objects.get(username="anh_tu_dat")
    client.force_login(nguoi)
    assert face(client, seed_post_thuong) == khach == MAT_CAN


# --- Spine + bia mộ ----------------------------------------------------------


def test_spine_dem_ca_thread_chu_khong_dem_binh_luan_goc(client, seed):
    """`💬 N` của mốc tính CẢ THREAD, gồm reply viết ở thời điểm mốc khác.

    Mốc 5 của seed có 2 thread gốc (`r6`, `r7`) nhưng 4 bình luận: `r6a` viết ngay sau
    đó và `r9` viết đúng lúc mốc 6 ra đời (PLAN nguyên tắc 6). Đếm theo gốc sẽ ra 2 và
    ngăn kéo hiện 4 — con số nói một đằng, cửa sổ mở ra một nẻo.
    """
    d = lay(client, f"/api/v1/machs/{seed.pk}")
    dem = {s["seq"]: s["so_binh_luan"] for s in d["spine"]}

    assert dem[5] == 4
    assert dem[6] == 0, "mốc 6 của seed cố ý không có bình luận nào (PLAN 5.4 luật 4)"
    # `r8` gỡ chip (`anchor = NULL`) nên không thuộc mốc nào ⇒ tổng theo mốc = 24 − 1.
    assert sum(dem.values()) == seed.comment_count - 1


def test_moc_bia_mo_giu_cho_tren_spine_nhung_mat_noi_dung(client, seed):
    """PLAN 5.2 — xoá mềm và mod ẩn đều giữ ô trên spine, `seq` không đánh số lại."""
    Moc.objects.filter(mach=seed, seq=3).update(deleted_at=timezone.now())
    Moc.objects.filter(mach=seed, seq=4).update(hidden_at=timezone.now())

    d = lay(client, f"/api/v1/machs/{seed.pk}")

    assert [s["seq"] for s in d["spine"]] == list(range(1, 10)), "thủng dãy số"
    assert (d["spine"][2]["da_xoa"], d["spine"][2]["da_an"]) == (True, False)
    assert (d["spine"][3]["da_xoa"], d["spine"][3]["da_an"]) == (False, True)

    for i, trang_thai in ((2, "da_xoa"), (3, "da_an")):
        m = d["mocs"][i]
        assert m["trang_thai"] == trang_thai
        assert m["body"] is None and m["loai"] is None and m["figures"] is None
        assert m["question_for_crowd"] is None
        assert m["edit_count"] == 0
        # Z7 — MỘT chuẩn cho cùng một lý lẽ: `BinhLuanOut` zero hoá số phiếu của nội
        # dung đã bị che, `MocOut` phải làm y hệt. Trước lượt vá, thẻ bia mộ vẫn hiện
        # "+21" bên cạnh một thân bài trống, và không ai giải thích được con số đó.
        assert m["score"] == 0
        # Nhưng `so_binh_luan` KHÔNG về 0: ngăn kéo của bia mộ vẫn mở được (PLAN 5.2).
        assert m["so_binh_luan"] == d["spine"][i]["so_binh_luan"]

    assert any(m["score"] for m in d["mocs"]), (
        "mọi mốc đều score 0 thì phép đo trên rỗng — nó đúng bất kể code làm gì"
    )
    assert d["mocs"][2]["so_binh_luan"] > 0, (
        "mốc 3 phải có bình luận, nếu không vế 'so_binh_luan không về 0' cũng rỗng"
    )


#: Logger của `api/trinh_bay.py` — `figures_ra` là chỗ duy nhất trong tầng đọc **cố ý bỏ
#: dữ liệu**, nên dòng WARNING của nó là thứ duy nhất làm việc bỏ đó chấp nhận được.
LOGGER_TRINH_BAY = "api.trinh_bay"


@pytest.mark.parametrize(
    "hong, con_lai, log_chua",
    [
        (["chuỗi trần", "không phải dict"], [], ("chuỗi trần", "không phải dict")),
        (
            [{"label": "GIÁ", "value": "27.8"}, "lạc loài"],
            [{"label": "GIÁ", "value": "27.8"}],
            ("lạc loài",),
        ),
        ({"label": "GIÁ"}, None, ("không phải list", "dict")),
        ([{"value": "27.8"}], [{"label": "", "value": "27.8"}], ()),
    ],
)
def test_figures_hinh_dang_la_KHONG_lam_500_ca_trang_mach(
    client, seed, caplog, hong, con_lai, log_chua
):
    """Z9 — `figures_ra` hứa chống hàng cũ hình dạng lạ, nhưng chỉ chống được `KeyError`.

    `figures` là list CHUỖI thì `str.get` ném `AttributeError` ⇒ vẫn 500, mà 500 ở đây là
    mất cả chín mốc vì một ô số hỏng. Hàng như vậy vào được DB bằng migration dữ liệu hay
    `manage.py shell` — hai đường không đi qua `kiem_figures`.

    `update()` chứ không phải `save()`: `save()` chạy validator và sẽ chặn đúng thứ bài
    này cần dựng.

    **Vế `caplog` thêm 2026-08-22 (T3).** Bản đầu chỉ đo "không 500" và "phần tử hỏng bị bỏ
    đi", tức nó nghiệm thu **mất dữ liệu có chủ đích** mà không hỏi gì thêm. Thứ duy nhất
    làm việc bỏ đó chấp nhận được là lời hứa trong docstring `figures_ra`: *"mỗi ca ghi một
    dòng WARNING kèm nguyên văn phần bị bỏ, đủ để `grep` ra hàng hỏng trong DB"* — và xoá
    cả hai `logger.warning` đi thì 4/4 ca vẫn xanh. Một lời hứa không có phép đo là một
    lời hứa sẽ bị người sau xoá mà không ai biết.

    `log_chua` rỗng ở ca cuối là **đối chứng âm**: `[{"value": ...}]` toàn dict, không mất
    gì, nên nó **không được** ghi WARNING. Thiếu ca đó thì một cài đặt "log mọi lúc" cũng
    xanh, và log mất luôn khả năng `grep`.
    """
    Moc.objects.filter(mach=seed, seq=2).update(figures=hong)

    with caplog.at_level(logging.WARNING, logger=LOGGER_TRINH_BAY):
        d = lay(client, f"/api/v1/machs/{seed.pk}")

    assert d["mocs"][1]["figures"] == con_lai
    assert len(d["mocs"]) == 9, "một ô số hỏng không được kéo cả trang mạch xuống"

    ban_ghi = [r for r in caplog.records if r.name == LOGGER_TRINH_BAY]
    assert len(ban_ghi) == (1 if log_chua else 0), (
        f"chờ {1 if log_chua else 0} dòng WARNING, nhận {len(ban_ghi)}: "
        f"{[r.getMessage() for r in ban_ghi]}"
    )
    for manh in log_chua:
        assert manh in ban_ghi[0].getMessage(), (
            f"dòng log phải mang nguyên văn phần bị bỏ để `grep` ra được hàng hỏng; "
            f"thiếu {manh!r} trong {ban_ghi[0].getMessage()!r}"
        )


# --- Trích vào sổ ------------------------------------------------------------


def test_trich_hien_du_hai_dau_thoi_gian(client, seed):
    """PLAN 5.6 rào 2 — blockquote phải hiện "viết ..., trích ..." nên API trả cả hai."""
    trich = Trich.objects.get(moc__mach=seed, removed_at__isnull=True)
    d = lay(client, f"/api/v1/machs/{seed.pk}")

    o_moc = {m["seq"]: m["trich"] for m in d["mocs"]}
    assert [seq for seq, t in o_moc.items() if t] == [trich.moc.seq]

    t = o_moc[trich.moc.seq]
    assert t["comment_id"] == trich.comment_id
    assert t["author"]["username"] == trich.comment.author.username
    assert t["body"] == trich.comment.body
    assert t["comment_created_at"] < t["trich_created_at"]
    assert t["anchor_moc_seq"] == trich.comment.anchor_moc_seq


def test_trich_da_go_khong_hien(client, seed):
    """Rào 1 của PLAN 5.6: hàng `Trich` đã gỡ ở lại làm log, nhưng không hiện ra nữa."""
    Trich.objects.filter(moc__mach=seed).update(removed_at=timezone.now())
    d = lay(client, f"/api/v1/machs/{seed.pk}")
    assert [m["trich"] for m in d["mocs"]] == [None] * 9


# --- Slug + không tìm thấy ---------------------------------------------------


def test_id_la_khoa_slug_khong_phai_tham_so(client, seed):
    """PLAN 5.9 — `/m/<slug>-<id>`: `id` bền, slug đổi được, 301 là việc của tầng web.

    Hai vế: endpoint **không có tham số slug nào** (nên slug lệch không thể ảnh hưởng),
    và response trả về slug chuẩn để tầng web so rồi quyết định redirect.
    """
    duong_dan = [d for d, _ in moi_operation(api_v1) if d.startswith("/machs/")]
    assert all("slug" not in d for d in duong_dan), duong_dan

    Mach.objects.filter(pk=seed.pk).update(slug="slug-moi-hoan-toan")
    d = lay(client, f"/api/v1/machs/{seed.pk}")
    assert d["id"] == seed.pk
    assert d["slug"] == "slug-moi-hoan-toan"


def test_mach_khong_ton_tai_tra_404_dung_hinh_dang_loi(client, db):
    d = lay(client, "/api/v1/machs/999999", status=404)
    assert d["code"] == "khong_tim_thay"
    assert isinstance(d["detail"], str)


def test_mach_bi_mod_an_thi_404(client, seed):
    """R10 — mạch bị ẩn biến mất khỏi API công khai, kể cả khi biết `id`."""
    Mach.objects.filter(pk=seed.pk).update(hidden_at=timezone.now())
    d = lay(client, f"/api/v1/machs/{seed.pk}", status=404)
    assert d["code"] == "khong_tim_thay"
