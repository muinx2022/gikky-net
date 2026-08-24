"""Đường GHI của "trích vào sổ" — `POST`/`DELETE /mocs/{id}/trich`. PLAN 5.6.

Bốn rào của PLAN 5.6 nằm ở **bốn tầng khác nhau**, và file này đo chúng từ phía đường ghi
— tức hỏi *"cửa mới có phá rào nào không"*, chứ không hỏi lại *"rào có tồn tại không"*
(rào 2/3/4 đã có bài đo riêng từ 1b: `test_api_mach.py`, `test_api_ho_so.py`,
`test_trich_con_hien.py`).

| rào | ở đâu | đo ở đây bằng |
|---|---|---|
| 1 · tối đa 1 trích hiệu lực / mốc | partial unique ở DB | 409 `da_co_trich` + cuộc đua |
| 2 · blockquote kèm HAI dấu thời gian | `TrichOut` | response của chính đường ghi |
| 3 · đếm tác giả KHÁC NHAU, không tính tự trích | `api/users.py` | chỉ số hồ sơ sau khi ghi |
| 4 · render tách bạch khỏi thân mốc | `MocOut.trich` | `body` của mốc không đổi |

Cộng một nhóm thứ năm không phải rào mà là **thứ tự khoá** — ca `CLAUDE.md` cảnh báo đích
danh, xem nhóm cuối file.
"""

from datetime import timedelta

import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext
from django.utils import timezone

from core.ghi import tao_binh_luan, them_moc, trich_vao_so
from core.models.binh_luan import Comment
from core.models.moc import Moc
from core.models.tuong_tac import Trich

from .conftest import dat, dung_user, lay, ma_loi


@pytest.fixture
def bo_ba(mach_cua_a, nguoi_a, nguoi_b):
    """`(mốc 2 của A, bình luận của B trong mạch đó, chủ mạch A)`.

    Bình luận của **B** chứ không của A: mặc định của mọi bài đo ở đây là ca THẬT của PLAN
    5.6 — chủ mạch ghi tên **người khác** vào sổ. Ca tự trích có bài đo riêng, và nó là ca
    ngoại lệ chứ không phải ca nền.
    """
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    c = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="Câu của B đáng ghi vào sổ.")
    # **Lùi `created_at` một giây** — sửa một bài đo FLAKY, không nới nó.
    #
    # `test_response_mang_du_HAI_dau_thoi_gian` khẳng định `comment_created_at <
    # trich_created_at` (rào 2 của PLAN 5.6: câu phải được VIẾT trước lúc vào sổ). Trong
    # bài đo, cả hai xảy ra trong cùng một lời gọi hàm, nên trên máy nhanh chúng rơi vào
    # **cùng một mili-giây** và phép `<` đỏ — đỏ vì đồng hồ, không vì luật bị vi phạm.
    # Bắt được ở lượt 2026-08-23 (đỏ trong bộ đầy đủ, xanh khi chạy riêng hai lần).
    #
    # Lùi ở đây chứ không đổi `<` thành `<=`: `<=` sẽ nuốt luôn ca THẬT mà rào 2 tồn tại
    # để bắt — một lượt trích ghi đè `comment_created_at` bằng "bây giờ" vẫn qua được.
    Comment.objects.filter(pk=c.pk).update(created_at=c.created_at - timedelta(seconds=1))
    c.refresh_from_db()
    return moc, c, nguoi_a


def _trich(client, moc, comment, **kw):
    return dat(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": comment.pk}, **kw)


# --- rào 1: tối đa 1 trích đang hiệu lực mỗi mốc -----------------------------


@pytest.mark.django_db
def test_moc_da_co_trich_thi_409(client, bo_ba, mach_cua_a, nguoi_b):
    moc, c, chu = bo_ba
    c2 = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="Câu thứ hai của B.")
    client.force_login(chu)
    _trich(client, moc, c, status=201)
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c2.pk}, status=409)
        == "da_co_trich"
    )
    assert Trich.objects.filter(moc=moc).count() == 1


@pytest.mark.django_db
def test_go_xong_thi_trich_cau_khac_vao_dung_moc_do_duoc(client, bo_ba, mach_cua_a, nguoi_b):
    """Unique là **partial** (`WHERE removed_at IS NULL`) — đó là cả điểm của rào 1.

    Unique thường sẽ chặn vĩnh viễn: gỡ một lần là cái mốc ấy không bao giờ nhận trích
    được nữa, và không có gì báo vì sao.
    """
    moc, c, chu = bo_ba
    c2 = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="Câu thứ hai của B.")
    client.force_login(chu)
    _trich(client, moc, c, status=201)
    dat(client, f"/api/v1/mocs/{moc.pk}/trich", method="delete")
    d = _trich(client, moc, c2, status=201)

    assert d["moc"]["trich"]["comment_id"] == c2.pk
    # Hàng cũ Ở LẠI với `removed_at` — nó tự nó là log, và nó giữ cho chữ "đã TỪNG được
    # trích" của PLAN 5.3 còn đúng (`Trich.comment = PROTECT`).
    assert Trich.objects.filter(moc=moc).count() == 2
    assert Trich.objects.filter(moc=moc, removed_at__isnull=False).count() == 1


@pytest.mark.django_db
def test_rao_1_duoc_giu_boi_DB_khong_phai_boi_cau_exists(client, bo_ba, mach_cua_a, nguoi_b):
    """**Thử phá rào 1 ở đúng chỗ nó thật sự đứng.**

    Câu `exists()` ở tầng API là để trả 409 cho tử tế; nó là kiểm-rồi-ghi và nó **thua**
    một cú double-click. Hàng rào thật là partial unique. Bài đo đi vòng qua tầng API
    (gọi thẳng `trich_vao_so`, đúng như hai request đồng thời cùng lọt qua `exists()`) và
    đòi DB phải nổ.

    Ai đổi constraint thành unique thường thì `test_go_xong_thi_...` ở trên đỏ; ai gỡ hẳn
    constraint và chỉ để lại `exists()` thì bài này đỏ. Cần cả hai.
    """
    from django.db import IntegrityError, transaction

    moc, c, chu = bo_ba
    c2 = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="Câu thứ hai của B.")
    trich_vao_so(moc=moc, comment=c)

    with pytest.raises(IntegrityError):
        with transaction.atomic():
            trich_vao_so(moc=moc, comment=c2)


@pytest.mark.django_db
def test_cuoc_dua_lot_qua_exists_van_ra_409_khong_phai_500(client, bo_ba, mach_cua_a, nguoi_b):
    """`IntegrityError` của rào 1 phải thành **409**, không phải 500.

    Hai tab của cùng một chủ mạch cùng thấy "chưa có trích" rồi cùng ghi là một hành động
    hợp lệ đến muộn, không phải một lỗi máy chủ. Bài đo mô phỏng cuộc đua bằng cách dựng
    sẵn hàng `Trich` **sau** khi handler đã qua câu `exists()` — cách gần nhất tới cuộc đua
    thật mà không cần hai luồng.
    """
    moc, c, chu = bo_ba
    c2 = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="Câu thứ hai của B.")
    client.force_login(chu)

    goc = Trich.objects.create

    def chen_ngang(*a, **kw):
        Trich.objects.create = goc  # chỉ chen một lần
        goc(moc=moc, comment=c2)  # "tab kia" ghi trước
        return goc(*a, **kw)

    Trich.objects.create = chen_ngang
    try:
        assert (
            ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c.pk}, status=409)
            == "da_co_trich"
        )
    finally:
        Trich.objects.create = goc


# --- rào 2: blockquote kèm HAI dấu thời gian ---------------------------------


@pytest.mark.django_db
def test_response_mang_du_HAI_dau_thoi_gian(client, bo_ba):
    """Rào 2 chống "trích hậu nghiệm để sổ đọc như tiên tri" — PLAN 5.6.

    Nó chỉ hoạt động nếu **cả hai** mốc thời gian đi ra tới client: `comment_created_at`
    (lúc câu đó được VIẾT) và `trich_created_at` (lúc chủ mạch ghi nó vào sổ). Thiếu cái
    thứ nhất thì blockquote trông như vừa được nói ra.
    """
    moc, c, chu = bo_ba
    client.force_login(chu)
    t = _trich(client, moc, c, status=201)["moc"]["trich"]

    assert t["comment_created_at"] and t["trich_created_at"]
    assert t["comment_created_at"] < t["trich_created_at"], (
        "câu phải được viết TRƯỚC lúc nó vào sổ — nếu không rào 2 không có gì để hiện"
    )
    assert t["author"]["username"] == c.author.username
    assert t["body"] == c.body


# --- rào 3: đếm tác giả KHÁC NHAU, KHÔNG tính tự trích -----------------------


@pytest.mark.django_db
def test_duoc_trich_cong_cho_nguoi_khac(client, bo_ba):
    """Đối chứng dương của rào 3: trích câu của người khác thì chỉ số của họ +1."""
    moc, c, chu = bo_ba
    assert lay(client, f"/api/v1/users/{c.author.username}")["duoc_trich"] == 0
    client.force_login(chu)
    _trich(client, moc, c, status=201)
    assert lay(client, f"/api/v1/users/{c.author.username}")["duoc_trich"] == 1


@pytest.mark.django_db
def test_TU_TRICH_khong_cong_chi_so_nhung_van_hien_blockquote(client, mach_cua_a, nguoi_a):
    """Rào 3, vế "KHÔNG tính tự trích" (chốt 2026-08-22) — **đường ghi mới không phá nó**.

    Ba cửa, một luật, và cả ba phải nói cùng một chuyện:
    - blockquote **vẫn hiện đầy đủ** (nó là nội dung của sổ);
    - chỉ số hồ sơ **không nhúc nhích** (`api/users.py`, rào 3);
    - **không có thông báo nào** (`core/thong_bao.py::bao_duoc_trich`).

    Rào 3 dựng lên để chặn "máy in địa vị", mà tự trích là cái máy in ngắn nhất — không
    cần nick thứ hai, không cần ai đồng ý.
    """
    from core.models.he_thong import Notification

    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    cua_minh = tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="Chủ mạch tự nói.")
    client.force_login(nguoi_a)
    d = _trich(client, moc, cua_minh, status=201)

    assert d["moc"]["trich"]["body"] == cua_minh.body, "blockquote phải hiện đầy đủ"
    assert lay(client, f"/api/v1/users/{nguoi_a.username}")["duoc_trich"] == 0
    assert Notification.objects.count() == 0


@pytest.mark.django_db
def test_hai_nick_trich_qua_lai_van_chi_dem_MOT(client, sub, nguoi_a, nguoi_b):
    """Rào 3, vế "số tác giả KHÁC NHAU": cùng một người trích 2 lần vẫn là ×1.

    Đếm số HÀNG `Trich` thay vì số tác giả là cách hai nick bơm chỉ số cho nhau — và
    đường ghi mới làm cho chuyện đó rẻ hơn hẳn so với lúc chỉ có seed.
    """
    from core.ghi import tao_mach

    mach, _ = tao_mach(sub=sub, author=nguoi_a, title="Sổ của A", body="Mốc 1.")
    them_moc(mach=mach, author=nguoi_a, body="Mốc 2.")
    c1 = tao_binh_luan(mach=mach, author=nguoi_b, body="B nói lần một.")
    c2 = tao_binh_luan(mach=mach, author=nguoi_b, body="B nói lần hai.")

    client.force_login(nguoi_a)
    for seq, c in ((1, c1), (2, c2)):
        moc = Moc.objects.get(mach=mach, seq=seq)
        _trich(client, moc, c, status=201)

    assert Trich.objects.filter(comment__author=nguoi_b).count() == 2
    assert lay(client, f"/api/v1/users/{nguoi_b.username}")["duoc_trich"] == 1, (
        "chỉ số đang đếm số HÀNG trích, không đếm số tác giả khác nhau"
    )


# --- rào 4: render tách bạch khỏi thân mốc -----------------------------------


@pytest.mark.django_db
def test_trich_la_truong_RIENG_khong_noi_vao_body_cua_moc(client, bo_ba):
    """Rào 4: *"nó là chú thích, không phải nội dung sổ"* — PLAN 5.6.

    Cách cài sai là nối chữ vào `body` của mốc cho tiện render. Nó đi qua mọi bài đo về
    "trích có hiện không", và nó phá đúng thứ rào 4 dựng lên: người đọc không còn phân biệt
    được câu nào chủ mạch viết với câu nào chủ mạch dẫn lại.
    """
    moc, c, chu = bo_ba
    body_truoc = moc.body
    client.force_login(chu)
    d = _trich(client, moc, c, status=201)["moc"]

    assert d["body"] == body_truoc, "nội dung trích bị nối vào thân mốc"
    assert c.body not in (d["body"] or ""), "chữ của bình luận lọt vào body của mốc"
    assert d["trich"]["comment_id"] == c.pk


@pytest.mark.django_db
def test_go_trich_thi_moc_tro_ve_trich_null(client, bo_ba):
    moc, c, chu = bo_ba
    client.force_login(chu)
    _trich(client, moc, c, status=201)
    d = dat(client, f"/api/v1/mocs/{moc.pk}/trich", method="delete")
    assert d["moc"]["trich"] is None
    assert lay(client, f"/api/v1/machs/{moc.mach_id}")["mocs"][1]["trich"] is None


# --- quyền + ca từ chối ------------------------------------------------------


@pytest.mark.django_db
def test_chi_CHU_MACH_trich_duoc_khong_phai_tac_gia_moc(client, bo_ba, nguoi_b):
    """Chủ ở đây là `Mach.author`. Rào 4 ghi rõ "trích từ khán đài, **bởi chủ mạch**".

    Hôm nay `Moc.author == Mach.author` ở mọi hàng (chỉ tác giả nối được mốc), nên hỏi
    nhầm cột vẫn xanh — cho tới lúc đồng tác giả mở ra. Bài đo dưới hỏi từ phía người
    KHÔNG phải chủ, tức nó đúng ở cả hai thế giới.
    """
    moc, c, _chu = bo_ba
    client.force_login(nguoi_b)
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c.pk}, status=403)
        == "khong_phai_chu"
    )
    assert not Trich.objects.exists()


@pytest.mark.django_db
def test_khong_trich_duoc_binh_luan_cua_MACH_KHAC(client, bo_ba, sub, nguoi_a, nguoi_b):
    """Trích chéo mạch ⇒ **400**, không phải 500 từ `ValidationError` của model.

    Nợ 1a bàn giao (`core/models/tuong_tac.Trich.clean`): hai FK độc lập nên
    `Trich(moc=<mạch A>, comment=<mạch B>)` là một hàng hợp lệ với DB, và hậu quả không
    phải lý thuyết — `api/machs.py` render nguyên văn `trich.comment.body`, tức **nội dung
    của một mạch khác** hiện lên thẻ mốc kèm tên tác giả và hai dấu thời gian, trông y như
    thật. `clean()` là hàng rào cuối; đường ghi phải chặn TRƯỚC nó để người dùng nhận 400.
    """
    from core.ghi import tao_mach

    moc, _c, chu = bo_ba
    mach_khac, _ = tao_mach(sub=sub, author=nguoi_a, title="Mạch khác", body="x")
    la = tao_binh_luan(mach=mach_khac, author=nguoi_b, body="Câu ở mạch khác.")

    client.force_login(chu)
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": la.pk}, status=400)
        == "du_lieu_khong_hop_le"
    )
    assert not Trich.objects.exists()


@pytest.mark.django_db
@pytest.mark.parametrize("cot", ["deleted_at", "hidden_at"])
def test_khong_trich_duoc_binh_luan_da_bi_go(client, bo_ba, cot):
    """Bia mộ và bình luận bị mod ẩn đều không vào sổ được.

    Với **mod ẩn** thì đây là một cửa moderation: `trinh_bay.trich_ra` trả `None` cho bình
    luận bị ẩn, nên hàng ghi được mà khối trích không bao giờ hiện — một hàng ma. Với
    **bia mộ** thì blockquote sẽ hiện nguyên chữ (PLAN 5.6 giữ nội dung của câu tác giả tự
    xoá), tức trích sau khi xoá là đường vòng để kéo lại một câu đã rút.
    """
    moc, c, chu = bo_ba
    setattr(c, cot, timezone.now())
    c.save(update_fields=[cot])
    client.force_login(chu)
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c.pk}, status=400)
        == "du_lieu_khong_hop_le"
    )


@pytest.mark.django_db
def test_khong_trich_duoc_vao_moc_da_thanh_bia_mo(client, bo_ba):
    """Trích là chú thích gắn vào **thân** mốc (rào 4), mà bia mộ không còn thân nào.

    `trinh_bay.moc_ra` cũng đã bỏ khối trích của mốc bị gỡ, nên ghi vào đó là ghi một hàng
    không cửa nào hiện.
    """
    moc, c, chu = bo_ba
    moc.deleted_at = timezone.now()
    moc.save(update_fields=["deleted_at"])
    client.force_login(chu)
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c.pk}, status=409)
        == "noi_dung_da_go"
    )


@pytest.mark.django_db
def test_mach_bi_khoa_thi_KHONG_trich_duoc(client, bo_ba, mach_cua_a):
    """Khác hẳn follow/seen — trích **ghi vào nội dung công khai**, nên nó là "tương tác"
    mà PLAN 5.10 cấm trên mạch bị mod khoá. Xem `api/theo_doi.py` cho vế bên kia."""
    moc, c, chu = bo_ba
    mach_cua_a.locked_at = timezone.now()
    mach_cua_a.save(update_fields=["locked_at"])
    client.force_login(chu)
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", {"comment_id": c.pk}, status=403)
        == "mach_bi_khoa"
    )


@pytest.mark.django_db
def test_go_trich_qua_24h_thi_409(client, bo_ba):
    """Hạn 24 giờ là hạn THẬT (PLAN 5.6 rào 1), không phải gợi ý UI.

    Không có nó thì sổ thành một cái bảng chủ mạch xoay hằng ngày theo việc câu nào "hoá
    ra đúng" — đúng thứ rào 2 (hai dấu thời gian) cũng đang chống.
    """
    moc, c, chu = bo_ba
    client.force_login(chu)
    _trich(client, moc, c, status=201)
    Trich.objects.filter(moc=moc).update(
        created_at=timezone.now() - timedelta(hours=25)
    )
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", status=409, method="delete")
        == "het_han_go_trich"
    )
    assert Trich.objects.get(moc=moc).removed_at is None


@pytest.mark.django_db
def test_go_khi_chua_co_trich_thi_404_ma_RIENG(client, bo_ba):
    """404 `chua_co_trich`, không phải `khong_tim_thay`: mốc có thật và người gọi có quyền.

    Gộp vào `khong_tim_thay` là bắt UI đoán xem 404 vừa rồi nói "mốc này không tồn tại"
    hay "mốc này không có gì để gỡ".
    """
    moc, _c, chu = bo_ba
    client.force_login(chu)
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", status=404, method="delete")
        == "chua_co_trich"
    )


@pytest.mark.django_db
def test_nguoi_duoc_trich_nhan_thong_bao(client, bo_ba):
    """PLAN 5.6 dòng cuối. Sinh **trong cùng transaction** với lời ghi — xem `test_thong_bao.py`."""
    from core.models.he_thong import Notification

    moc, c, chu = bo_ba
    client.force_login(chu)
    _trich(client, moc, c, status=201)

    n = Notification.objects.get(user=c.author)
    assert n.type == "trich"
    assert n.payload["comment_id"] == c.pk
    assert n.payload["moc_seq"] == moc.seq
    assert n.payload["boi"] == chu.username


# --- THỨ TỰ KHOÁ — ca `CLAUDE.md` cảnh báo đích danh -------------------------


@pytest.mark.django_db
def test_duong_trich_khong_khoa_hang_Mach(bo_ba):
    """**`INSERT core_trich` lấy khoá NGẦM trên `Moc` và `Comment`; `Mach` phải đứng ngoài.**

    Luật của `core/ghi.py` là **`Mach` khoá SAU CÙNG**. `INSERT INTO core_trich(moc_id, …)`
    lấy `FOR KEY SHARE` trên hàng `Moc` được tham chiếu — một khoá **không có dòng
    `select_for_update` nào nói ra**. Nên bất cứ thứ gì khoá hàng `Mach` **trước** câu
    INSERT ấy là dựng đúng cạnh ngược `Mach → Moc`, và người viết dòng đó sẽ không thấy
    khoá nào cả. Hậu quả: deadlock dưới tải ⇒ Postgres huỷ một bên ⇒ 500 ngẫu nhiên, gần
    như không tái hiện được ở dev.

    Cách giữ đúng ở đây là **đường trích không chạm hàng `Mach` một lần nào** — cụ thể là
    nó **không gọi `cap_nhat_dem_mach`**. Không cột denormalize nào của `Mach` phụ thuộc
    `Trich`, nên lời gọi ấy không sửa được con số nào; nó chỉ mở ra cạnh khoá ngược.

    **Vì sao đo cấu trúc chứ không đo deadlock:** một bài đo deadlock thật cần hai luồng
    đua nhau đúng thứ tự, và nó sẽ chớp nhoáng — xanh hầu hết các lần chạy, kể cả khi luật
    đã bị phá. Bài này bắt **mọi câu SQL** của một lượt trích và đòi không câu nào khoá hay
    ghi `core_mach`. Thêm `cap_nhat_dem_mach(moc.mach)` "cho chắc" là nó đỏ ngay.
    """
    moc, c, _chu = bo_ba

    with CaptureQueriesContext(connection) as bat:
        trich_vao_so(moc=moc, comment=c)

    cham_mach = [
        q["sql"]
        for q in bat.captured_queries
        if "core_mach" in q["sql"].lower()
        and ("for update" in q["sql"].lower() or q["sql"].lstrip().upper().startswith("UPDATE"))
    ]
    assert cham_mach == [], (
        "đường trích đang khoá/ghi hàng `Mach` TRƯỚC khi INSERT core_trich lấy khoá ngầm "
        f"trên `Moc` — đó là cạnh ngược `Mach → Moc` mà CLAUDE.md cấm:\n{cham_mach}"
    )


@pytest.mark.django_db
def test_bai_do_thu_tu_khoa_o_tren_bat_duoc_mot_lan_goi_khoa_Mach(bo_ba):
    """Đối chứng dương: phép bắt SQL ở bài trên phải thật sự thấy được một khoá `Mach`.

    Không có bài này thì `test_duong_trich_khong_khoa_hang_Mach` có thể xanh vì
    `CaptureQueriesContext` không bắt được gì (sai tên bảng, sai chuỗi tìm, `DEBUG=False`
    nuốt mất `captured_queries`) — đúng loài "proof đo RỖNG" mà repo đã dính một lần.
    """
    from django.db import transaction

    from core.ghi import cap_nhat_dem_mach

    moc, _c, _chu = bo_ba
    with CaptureQueriesContext(connection) as bat:
        with transaction.atomic():
            cap_nhat_dem_mach(moc.mach)

    cham_mach = [
        q["sql"]
        for q in bat.captured_queries
        if "core_mach" in q["sql"].lower()
        and ("for update" in q["sql"].lower() or q["sql"].lstrip().upper().startswith("UPDATE"))
    ]
    assert cham_mach, "phép bắt SQL không thấy khoá `Mach` — bài đo kia đang đo RỖNG"


@pytest.mark.django_db
def test_go_trich_cung_khong_khoa_hang_Mach(bo_ba):
    """Chiều gỡ cũng phải sạch: `UPDATE core_trich SET removed_at` không cần biết `Mach`."""
    from core.ghi import go_trich

    moc, c, _chu = bo_ba
    t = trich_vao_so(moc=moc, comment=c)

    with CaptureQueriesContext(connection) as bat:
        go_trich(trich=t)

    assert [q["sql"] for q in bat.captured_queries if "core_mach" in q["sql"].lower()] == []


@pytest.mark.django_db
def test_binh_luan_da_trich_thi_xoa_MEM_chu_khong_500(client, bo_ba, nguoi_b):
    """`Trich.comment` là `PROTECT` — đường xoá phải khớp, không được ném `ProtectedError`.

    Đề bài của phase này nêu đích danh ca đó. Luật (PLAN 5.3): xoá THẬT chỉ khi không có
    reply con **và chưa TỪNG được trích** — chữ "đã từng" bao gồm cả trích đã gỡ, vì
    `PROTECT` chặn theo HÀNG chứ không biết `removed_at` là gì.

    `xoa_binh_luan` đã cài đúng từ Phase 2; cái mới ở đây là **nay có đường ghi `Trich`
    thật**, nên ca này lần đầu tiên tới được bằng thao tác của người dùng chứ không chỉ
    bằng seed.
    """
    moc, c, chu = bo_ba
    client.force_login(chu)
    _trich(client, moc, c, status=201)
    dat(client, f"/api/v1/mocs/{moc.pk}/trich", method="delete")  # gỡ rồi vẫn "đã TỪNG"

    client.force_login(nguoi_b)  # tác giả bình luận
    d = dat(client, f"/api/v1/comments/{c.pk}", method="delete")
    assert d == {"id": c.pk, "xoa_that": False}, "xoá THẬT sẽ ăn ProtectedError ⇒ 500"
    c.refresh_from_db()
    assert c.deleted_at is not None


@pytest.mark.django_db
def test_trich_khong_lam_lech_bon_cot_denormalize(client, bo_ba, mach_cua_a):
    """Hệ quả kiểm chứng được của quyết định "không gọi `cap_nhat_dem_mach`".

    Nếu bốn cột lệch đi sau một lượt trích thì lý lẽ "không cột nào phụ thuộc `Trich`" sai,
    và quyết định bỏ lời gọi ấy phải xem lại — chứ không phải thêm lại lời gọi rồi im lặng
    dựng cạnh khoá ngược.
    """
    moc, c, chu = bo_ba
    truoc = {
        k: getattr(mach_cua_a, k)
        for k in ("entry_count", "comment_count", "last_entry_at", "last_activity_at",
                  "diem_bai_goc")
    }
    client.force_login(chu)
    _trich(client, moc, c, status=201)
    dat(client, f"/api/v1/mocs/{moc.pk}/trich", method="delete")

    mach_cua_a.refresh_from_db()
    assert {k: getattr(mach_cua_a, k) for k in truoc} == truoc


@pytest.mark.django_db
def test_B_thay_duoc_trich_cua_A_nhung_khong_go_duoc(client, bo_ba, mach_cua_a):
    """Trích là nội dung CÔNG KHAI (ai cũng đọc), nhưng chỉ chủ mạch sửa được sổ.

    Khác với `/me` và chuông — hai cửa per-user mà người lạ không thấy gì. Ở đây thấy là
    đúng; sửa mới là sai.
    """
    moc, c, chu = bo_ba
    client.force_login(chu)
    _trich(client, moc, c, status=201)

    nguoi_la = dung_user("nguoi_la", "Người Lạ")
    client.force_login(nguoi_la)
    assert lay(client, f"/api/v1/machs/{mach_cua_a.pk}")["mocs"][1]["trich"]["comment_id"] == c.pk
    assert (
        ma_loi(client, f"/api/v1/mocs/{moc.pk}/trich", status=403, method="delete")
        == "khong_phai_chu"
    )
    assert Trich.objects.get(moc=moc).removed_at is None
