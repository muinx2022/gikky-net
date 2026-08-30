"""`GET /api/v1/tim-kiem` — phần đo được **không cần** Meilisearch chạy.

Chia đôi có chủ đích với `test_tim_kiem_that.py`: bài ở đây thay `core.tim_kiem.tim_tron`
(và `tim`, cho gợi ý) bằng bản giả trả thẳng danh sách ID, nên chúng đo đúng **lớp lọc
thứ hai** và các nhánh xuống thang — những thứ không phụ thuộc hành vi của Meilisearch. Bài cần Meilisearch thật
(tiếng Việt, khoan dung lỗi gõ, `reindex`) nằm ở file kia và **skip** khi chưa cấu hình.

Vì sao tách: nếu gộp, cả nhóm sẽ skip khi máy không có Meilisearch — và **lớp lọc thứ hai
là thứ tuyệt đối không được phép không-đo** trên bất kỳ máy nào. Nó là cái chặn rò nội
dung đã ẩn.
"""

import pytest

from core.ghi import (
    dat_an_binh_luan,
    dat_an_mach,
    dat_an_moc,
    tao_binh_luan,
    xoa_binh_luan,
    xoa_moc,
)
from core.models.moc import Moc
from core.tim_kiem import TEN_INDEX, TEN_INDEX_BINH_LUAN

from api import tim_kiem as api_tim_kiem
from api.tim_kiem import _bo_dau, _boc, _to_dam

from .conftest import lay, viet


@pytest.fixture
def gia_meili(monkeypatch):
    """Thay `core.tim_kiem.tim_tron` bằng bản giả. Trả về hàm đặt "index đang chứa gì".

    Bản giả trả **đúng** danh sách được nạp, không lọc gì — đó chính là điều kiện của bài
    đo S6: giả định lớp một đã hỏng, và hỏi lớp hai có giữ được không.

    Nhận **hai dạng** cho tiện đọc: một `int` trần nghĩa là hit MẠCH (dạng của mọi bài
    Phase 7, giữ nguyên để chúng không phải viết lại), còn `("binh_luan", id)` nói rõ
    loại. Trả về đúng hình dạng `tim_tron` thật: `[(indexUid, id)]`.
    """
    trang_thai: dict = {"cap": [], "no": None}

    def _tim_tron(*, q, sub, sap_theo_moi, offset, limit):
        if trang_thai["no"] is not None:
            raise trang_thai["no"]
        cap = trang_thai["cap"]
        return cap[offset : offset + limit], len(cap)

    monkeypatch.setattr(api_tim_kiem, "tim_tron", _tim_tron)

    def dat(hits=None, *, no=None):
        trang_thai["cap"] = [
            h if isinstance(h, tuple) else (TEN_INDEX, h) for h in (hits or [])
        ]
        trang_thai["no"] = no

    return dat


#: Một hit BÌNH LUẬN cho `gia_meili` — đọc rõ hơn `("binh_luan", n)` rải khắp file.
def bl(comment_id: int) -> tuple[str, int]:
    return (TEN_INDEX_BINH_LUAN, comment_id)


@pytest.fixture
def gia_meili_goi_y(monkeypatch):
    """Bản giả cho `/tim-kiem/goi-y` — nó đi qua `tim` (một index), không qua `tim_tron`.

    Hai fixture riêng chứ không một cái gánh cả hai: gộp lại thì một bài đo gợi ý sẽ xanh
    nhờ bản giả của đường trộn, và ngày nào endpoint gợi ý đổi sang `tim_tron` (tức bắt
    đầu trả cả bình luận, trái quyết định của user) sẽ **không có gì đỏ**.
    """
    trang_thai: dict = {"ids": [], "no": None, "limit": None}

    def _tim(*, q, sub, sap_theo_moi, offset, limit):
        if trang_thai["no"] is not None:
            raise trang_thai["no"]
        trang_thai["limit"] = limit
        ids = trang_thai["ids"]
        return ids[offset : offset + limit], len(ids)

    monkeypatch.setattr(api_tim_kiem, "tim", _tim)

    def dat(ids=None, *, no=None):
        trang_thai["ids"] = list(ids or [])
        trang_thai["no"] = no
        return trang_thai

    return dat


# --- LỚP LỌC THỨ HAI (S6) ----------------------------------------------------


@pytest.mark.django_db
def test_index_lech_giu_mach_da_bi_mod_an_thi_ket_qua_VAN_khong_ro(
    client, gia_meili, mach_cua_a, nguoi_a
):
    """S6 — **cố tình** để index lệch, rồi đòi kết quả vẫn sạch.

    Đây là bài đo quan trọng nhất của cả phase. Kịch bản: mod ẩn một mạch, nhưng đường gỡ
    index hỏng (Meilisearch đang chết lúc `on_commit` chạy, hoặc một lượt sau thêm cửa ghi
    mà quên) ⇒ tài liệu **vẫn nằm trong index**. Bản giả ở đây mô phỏng đúng trạng thái đó
    bằng cách trả về ID của mạch đã bị ẩn.

    Nếu endpoint tin vào index, tiêu đề nguyên văn của mạch mod vừa ẩn sẽ hiện ra cho cả
    internet — và **không có gì hết hạn** để tự chữa.
    """
    dat_an_mach(mach=mach_cua_a, boi=nguoi_a, an=True, ly_do="thử")
    gia_meili([mach_cua_a.pk])

    du = lay(client, "/api/v1/tim-kiem?q=Nhật")

    assert du["items"] == [], (
        "Index còn giữ mạch đã bị mod ẩn và lớp lọc Postgres KHÔNG chặn — "
        "nội dung bị ẩn rò ra qua đường đọc thứ hai."
    )
    assert du["co_the_tim"] is True, "đây không phải ca xuống thang, chỉ là kết quả rỗng"


@pytest.mark.django_db
def test_index_lech_giu_mach_da_bi_xoa_cung_thi_khong_no_500(
    client, gia_meili, mach_cua_a
):
    """Tài liệu ma: index trỏ tới một mạch không còn hàng nào trong Postgres.

    Xảy ra thật khi ai đó xoá hàng bằng tay / bằng migration. Lớp hai phải **bỏ qua** id
    ấy, không được `Mach.objects.get()` rồi ném `DoesNotExist` thành 500 — một trang tìm
    kiếm chết vì một tài liệu ma là đổi một lỗi nhỏ lấy một lỗi to.
    """
    ma = mach_cua_a.pk
    Moc.objects.filter(mach=mach_cua_a).delete()
    mach_cua_a.delete()
    gia_meili([ma])

    du = lay(client, "/api/v1/tim-kiem?q=Nhật")
    assert du["items"] == []


@pytest.mark.django_db
def test_lop_hai_giu_dung_thu_tu_cua_meilisearch(client, gia_meili, sub, nguoi_a):
    """Thứ hạng liên quan là thứ Meilisearch tính; lớp hai **lọc**, không được sắp lại.

    Không có bài này thì `filter(pk__in=…)` trả về theo thứ tự của Postgres (thường là
    `pk`) và kết quả "liên quan nhất trước" lặng lẽ thành "cũ nhất trước" — sai một cách
    không ai nhìn ra, vì trang vẫn đầy kết quả đúng.
    """
    from core.ghi import tao_mach

    machs = [
        tao_mach(sub=sub, author=nguoi_a, title=f"Mạch {i}", body=f"Thân {i}.")[0]
        for i in range(4)
    ]
    mong_muon = [machs[2].pk, machs[0].pk, machs[3].pk, machs[1].pk]
    gia_meili(mong_muon)

    du = lay(client, "/api/v1/tim-kiem?q=Mạch")
    assert [i["mach"]["id"] for i in du["items"]] == mong_muon


@pytest.mark.django_db
def test_doan_trich_khong_lay_tu_moc_da_thanh_bia_mo(
    client, gia_meili, mach_cua_a, nguoi_a
):
    """Mốc 1 thành bia mộ ⇒ đoạn trích phải RỖNG, dù mạch vẫn hiện.

    Mạch chưa bị ẩn nên nó còn trên feed và còn trong kết quả — nhưng nguyên văn mốc đã
    xoá thì không được đi kèm. Đây là vế "cập nhật" của luật gỡ index, vế dễ quên hơn vế
    "xoá cả tài liệu".
    """
    moc1 = Moc.objects.get(mach=mach_cua_a, seq=1)
    xoa_moc(moc=moc1)
    gia_meili([mach_cua_a.pk])

    du = lay(client, "/api/v1/tim-kiem?q=Mốc")
    assert len(du["items"]) == 1
    assert du["items"][0]["doan_trich"] == "", (
        "đoạn trích còn nguyên văn mốc đã xoá — bia mộ rò ra qua trang tìm kiếm"
    )


@pytest.mark.django_db
def test_doan_trich_khong_lay_tu_moc_bi_mod_an(
    client, gia_meili, mach_cua_a, nguoi_a
):
    """Cùng luật với bia mộ, trục khác: mốc 1 bị **mod ẩn**."""
    moc1 = Moc.objects.get(mach=mach_cua_a, seq=1)
    dat_an_moc(moc=moc1, boi=nguoi_a, an=True, ly_do="thử")
    gia_meili([mach_cua_a.pk])

    du = lay(client, "/api/v1/tim-kiem?q=Mốc")
    assert du["items"][0]["doan_trich"] == ""


# --- LỚP HAI cho BÌNH LUẬN (2026-08-30) --------------------------------------


@pytest.mark.django_db
def test_cmt_binh_thuong_ra_dung_hinh_dang_dong_binh_luan(
    client, gia_meili, mach_cua_a, nguoi_b
):
    """Hợp đồng của một dòng `loai = "binh_luan"`, ghim từng trường.

    `mach` phải có mặt ở dòng bình luận (nó là ngữ cảnh **và** là nguồn của đường nhảy),
    `binh_luan_id` là đích neo `#bl-<id>`, `luc` là lúc bình luận được viết chứ không
    phải lúc mạch mở — hai con số khác nhau, và lấy nhầm thì mọi dòng bình luận của một
    mạch cũ đều đề ngày mở mạch.
    """
    c = viet(mach_cua_a, nguoi_b, "Chốt lời HPG ở vùng 28.")
    gia_meili([bl(c.pk)])

    du = lay(client, "/api/v1/tim-kiem?q=HPG")
    assert len(du["items"]) == 1
    dong = du["items"][0]
    assert dong["loai"] == "binh_luan"
    assert dong["binh_luan_id"] == c.pk
    assert dong["mach"]["id"] == mach_cua_a.pk
    assert dong["tac_gia"]["username"] == nguoi_b.username
    assert dong["title_to_dam"] == ""
    assert "[[HPG]]" in dong["doan_trich"]
    assert dong["luc"].startswith(c.created_at.strftime("%Y-%m-%d"))


@pytest.mark.django_db
def test_cmt_cua_mach_bi_an_khong_lot_qua_lop_hai(
    client, gia_meili, mach_cua_a, nguoi_a, nguoi_b
):
    """**Vế thứ ba** — bài đo quan trọng nhất của lượt trộn bình luận.

    Kịch bản: mod ẩn cả mạch, nhưng cascade gỡ index hỏng (Meilisearch chết đúng lúc
    `on_commit` chạy, hoặc `MEILI_KEY` chưa có quyền với index `binh_luan` — đúng
    `P-20260827-2`). Bản giả mô phỏng trạng thái ấy bằng cách vẫn trả id của bình luận.

    Nếu lớp hai thiếu `mach__hidden_at__isnull=True` thì nguyên văn mọi câu trong một mạch
    mod vừa ẩn hiện ra cho cả internet — kèm tiêu đề mạch ấy ở dòng ngữ cảnh, vì dòng
    bình luận cố ý mang theo `MachTomTatOut`.
    """
    c = viet(mach_cua_a, nguoi_b, "Câu trong mạch sắp bị ẩn.")
    dat_an_mach(mach=mach_cua_a, boi=nguoi_a, an=True, ly_do="thử")
    gia_meili([bl(c.pk)])

    du = lay(client, "/api/v1/tim-kiem?q=câu")
    assert du["items"] == [], (
        "Index còn giữ bình luận của một mạch đã bị mod ẩn và lớp lọc Postgres KHÔNG "
        "chặn — nội dung bị ẩn rò ra qua đường đọc thứ hai."
    )
    assert du["co_the_tim"] is True


@pytest.mark.django_db
def test_cmt_bia_mo_va_cmt_bi_mod_an_khong_lot_qua_lop_hai(
    client, gia_meili, mach_cua_a, nguoi_a, nguoi_b
):
    """Hai vế còn lại, cùng một bài vì chúng chia nhau một câu khẳng định.

    Bia mộ là ca nguy hiểm hơn: hàng **vẫn nằm trong Postgres** (PLAN 5.3 giữ nó để cây
    khán đài không gãy), nên một `filter(pk__in=ids)` trần vẫn tìm thấy nó và vẫn in ra
    nguyên văn `body` của câu người ta đã xoá.
    """
    goc = viet(mach_cua_a, nguoi_b, "Câu sẽ thành bia mộ.")
    viet(mach_cua_a, nguoi_a, "reply giữ chỗ", parent=goc)
    xoa_binh_luan(comment=goc)
    goc.refresh_from_db()
    assert goc.deleted_at is not None

    bi_an = viet(mach_cua_a, nguoi_b, "Câu sẽ bị mod ẩn.")
    dat_an_binh_luan(comment=bi_an, boi=nguoi_a, an=True, ly_do="thử")

    gia_meili([bl(goc.pk), bl(bi_an.pk)])
    du = lay(client, "/api/v1/tim-kiem?q=câu")
    assert du["items"] == []


@pytest.mark.django_db
def test_doan_trich_binh_luan_HTML_khong_lot_the(client, gia_meili, mach_cua_a, nguoi_b):
    """Bình luận `body_dinh_dang = "html"` ⇒ đoạn trích phải là văn bản thuần.

    Không escape thì React in nguyên `<p>` ra màn hình (nó escape đúng luật, nên không có
    lỗ XSS — chỉ có rác). Và quan trọng hơn: chuỗi tô đậm phải là **cùng chuỗi**
    Meilisearch đã khớp, tức chuỗi `van_ban_thuan` đẩy vào index.
    """
    c = tao_binh_luan(
        mach=mach_cua_a,
        author=nguoi_b,
        body="<p>Chốt lời <strong>HPG</strong> ở 28.</p>",
        dinh_dang="html",
    )
    gia_meili([bl(c.pk)])

    trich = lay(client, "/api/v1/tim-kiem?q=HPG")["items"][0]["doan_trich"]
    assert "<" not in trich, trich
    assert "[[HPG]]" in trich


@pytest.mark.django_db
def test_doan_trich_MACH_HTML_khong_lot_the(client, gia_meili, mach_cua_a):
    """Đoạn trích của dòng MẠCH cũng phải là văn bản thuần — `Moc.body` là HTML từ 2026-08-24.

    Nhánh bình luận đã sạch từ đầu; nhánh mạch trước lượt vá đẩy `Moc.body` thô qua
    `_than_hien_theo_mach` nên đoạn trích còn nguyên `<p>`/`<strong>` (React escape đúng
    luật ⇒ không XSS, chỉ rác), và chỗ tô đậm so khớp lệch với văn bản Meilisearch đã
    khớp (index chứa văn bản thuần).
    """
    Moc.objects.filter(mach=mach_cua_a, seq=1).update(
        body="<p>Chốt lời <strong>HPG</strong> ở vùng 28.</p>"
    )
    gia_meili([mach_cua_a.pk])

    trich = lay(client, "/api/v1/tim-kiem?q=HPG")["items"][0]["doan_trich"]
    assert "<" not in trich, trich
    assert "[[HPG]]" in trich, trich


@pytest.mark.django_db
def test_tron_giu_dung_thu_tu_meilisearch_qua_CA_HAI_loai(
    client, gia_meili, mach_cua_a, nguoi_b
):
    """Thứ hạng trộn là thứ Meilisearch tính; lớp hai **lọc**, không được sắp lại.

    Đây là bản hai-loại của `test_lop_hai_giu_dung_thu_tu_cua_meilisearch`, và nó bắt một
    lỗi mà bản một-loại không thấy: cách cài dễ nhất (lọc mạch xong rồi nối bình luận vào
    cuối) cho ra một trang **nhóm theo loại**, tức thứ hạng liên quan bị vứt đi hoàn toàn
    trong khi trang vẫn đầy kết quả đúng.
    """
    c1 = viet(mach_cua_a, nguoi_b, "Câu một.")
    c2 = viet(mach_cua_a, nguoi_b, "Câu hai.")
    mong = [bl(c2.pk), mach_cua_a.pk, bl(c1.pk)]
    gia_meili(mong)

    du = lay(client, "/api/v1/tim-kiem?q=câu")
    assert [
        (i["loai"], i["binh_luan_id"] if i["loai"] == "binh_luan" else i["mach"]["id"])
        for i in du["items"]
    ] == [("binh_luan", c2.pk), ("mach", mach_cua_a.pk), ("binh_luan", c1.pk)]


@pytest.mark.django_db
def test_cmt_ma_tro_toi_hang_khong_con_thi_khong_no_500(
    client, gia_meili, mach_cua_a, nguoi_b
):
    """Tài liệu ma của bình luận — index trỏ tới một hàng đã bị xoá cứng."""
    c = viet(mach_cua_a, nguoi_b, "Câu sẽ bị xoá hẳn.")
    ma = c.pk
    xoa_binh_luan(comment=c)
    gia_meili([bl(ma)])

    assert lay(client, "/api/v1/tim-kiem?q=câu")["items"] == []


@pytest.mark.django_db
def test_mot_truy_van_cho_moi_loai_khong_phai_mot_cho_moi_dong(
    client, gia_meili, mach_cua_a, nguoi_b
):
    """Trần số truy vấn — chống N+1 ở vòng lặp dựng dòng.

    Con số cụ thể không quan trọng bằng việc **có** một con số: không có nó thì một
    `Comment.objects.get()` chui vào vòng lặp và trang kết quả chậm dần theo số dòng mà
    không gì đỏ. Ghim bằng "số truy vấn của 6 bình luận **bằng** số truy vấn của 2".
    """

    def dem(so_cmt: int) -> int:
        from django.db import connection, reset_queries
        from django.test.utils import CaptureQueriesContext

        cs = [viet(mach_cua_a, nguoi_b, f"Câu {i}.") for i in range(so_cmt)]
        gia_meili([bl(c.pk) for c in cs])
        reset_queries()
        with CaptureQueriesContext(connection) as bat:
            lay(client, "/api/v1/tim-kiem?q=câu")
        return len(bat)

    assert dem(2) == dem(6)


# --- XUỐNG THANG (S7) --------------------------------------------------------


@pytest.mark.django_db
def test_meilisearch_chet_thi_tra_200_kem_co_the_tim_false(client, gia_meili):
    """S7 — service phụ hỏng là **xuống thang**, không phải sự cố của request.

    503 sẽ buộc frontend xử nó như lỗi hệ thống; 200 kèm cờ cho phép trang nói ra bằng
    tiếng người mà phần còn lại của site không biết gì đã xảy ra.
    """
    from core.tim_kiem import MeiliHong

    gia_meili(no=MeiliHong("giả vờ Meilisearch chết"))

    du = lay(client, "/api/v1/tim-kiem?q=bất kỳ")
    assert du["co_the_tim"] is False
    assert du["items"] == [] and du["tong"] == 0


@pytest.mark.django_db
def test_chua_cau_hinh_meili_thi_cung_xuong_thang(client, settings):
    """Không monkeypatch gì: `MEILI_URL` rỗng ⇒ `tim` ném `MeiliHong` ⇒ vẫn 200.

    Đây là trạng thái của một clone sạch, và nó phải là trạng thái **an toàn**: một máy
    vừa dựng xong không được 500 ở `/tim-kiem` chỉ vì chưa ai cài Meilisearch.
    """
    settings.MEILI_URL = ""
    settings.MEILI_KEY = ""
    du = lay(client, "/api/v1/tim-kiem?q=gì đó")
    assert du["co_the_tim"] is False


@pytest.mark.django_db
def test_khong_cache_ket_qua_tim_kiem(client, gia_meili):
    """`Cache-Control: no-store` — kết quả phụ thuộc trạng thái ẩn.

    Cache một trang tìm kiếm là hồi sinh nội dung vừa bị gỡ, tức đúng `L06` một lần nữa
    nhưng trên một đường không ai nghĩ tới.
    """
    gia_meili([])
    r = client.get("/api/v1/tim-kiem?q=x")
    assert r["Cache-Control"] == "no-store"


# --- THAM SỐ -----------------------------------------------------------------


@pytest.mark.django_db
def test_q_rong_khong_liet_ke_moi_mach(client, gia_meili, mach_cua_a):
    """`?q=` rỗng phải trả rỗng, **không** thành một feed thứ ba.

    Feed đã có endpoint riêng với phân trang keyset đúng nghĩa; biến ô tìm kiếm rỗng
    thành "liệt kê tất cả" là dựng một đường đọc thứ hai cho cùng dữ liệu, với phân trang
    offset kém hơn.
    """
    gia_meili([mach_cua_a.pk])
    du = lay(client, "/api/v1/tim-kiem?q=")
    assert du["items"] == [] and du["tong"] == 0


@pytest.mark.django_db
def test_sub_go_nham_tra_404_chu_khong_phai_rong(client, gia_meili):
    """Cùng lý lẽ `api/feeds.py::_kiem_sub` — rỗng trông y hệt "chuyên mục chưa có gì"."""
    gia_meili([])
    r = client.get("/api/v1/tim-kiem?q=x&sub=khong-co-that")
    assert r.status_code == 404
    assert r.json()["code"] == "sub_khong_ton_tai"


@pytest.mark.django_db
@pytest.mark.parametrize(
    "truy_van",
    ["?q=x&limit=51", "?q=x&offset=-1", "?q=x&offset=100000", "?q=x&sort=lung_tung"],
)
def test_tham_so_sai_tra_400(client, gia_meili, truy_van):
    gia_meili([])
    assert client.get(f"/api/v1/tim-kiem{truy_van}").status_code == 400


# --- TÔ ĐẬM: chữ đến từ Postgres, so khớp KHÔNG DẤU --------------------------


@pytest.mark.parametrize(
    "vao,ra",
    [
        ("Nhật ký lệnh HPG", "Nhat ky lenh HPG"),
        ("đầu tư", "dau tu"),
        ("Đóng sổ", "Dong so"),
        ("HPG", "HPG"),
    ],
)
def test_bo_dau(vao, ra):
    """`đ`/`Đ` không phân rã được bằng NFD — thiếu hai dòng riêng cho chúng thì
    `dau tu` không tô được `đầu tư`."""
    assert _bo_dau(vao) == ra


def test_to_dam_khop_khong_dau():
    """Người gõ không dấu, chữ thật có dấu: Meilisearch đã khớp, chỗ tô đậm cũng phải khớp.

    Không có vế này thì kết quả trả về đúng mà **không chữ nào được tô** — trông như máy
    tìm sai.
    """
    assert _boc("Nhật ký lệnh HPG", ["nhat", "hpg"]) == "[[Nhật]] ký lệnh [[HPG]]"


def test_to_dam_khong_boc_long_nhau():
    """Hai từ khoá lồng nhau (`hp` trong `hpg`) không được bọc chồng lên dấu vừa chèn."""
    ra = _boc("HPG", ["hp", "hpg"])
    assert ra == "[[HPG]]", ra


def test_boc_token_toan_dau_to_hop_khong_treo():
    """Token chỉ gồm ký tự tổ hợp (dấu sắc U+0301 lẻ) — `_bo_dau` bào thành `""`.

    Người dùng gõ `q=hpg ́` được, và trước lượt vá `_boc` lọc rỗng TRƯỚC `_bo_dau`: cái
    dấu lẻ lọt qua `if t`, thành `""` sau khi bỏ dấu, rồi `startswith("", i)` đúng với mọi
    `i` và `len("") == 0` khiến `i` đứng yên — vòng `while` chèn `[[]]` vô tận (treo/OOM).

    Bài này KHÔNG dựng lại được ca treo (đó là mục đích của bản vá), nó chốt hai bất biến
    hậu-vá: hàm **trả về** (hữu hạn) và **không** đẻ ra cặp dấu rỗng `[[]]`.
    """
    ra = _boc("Nhat ky HPG", ["HPG", "́"])
    assert "[[]]" not in ra, ra
    assert ra == "Nhat ky [[HPG]]", ra


def test_doan_trich_cat_quanh_cho_khop_chu_khong_phai_tu_dau_bai():
    """Từ khoá nằm cuối một bài dài vẫn phải hiện trong đoạn trích.

    Luôn cắt từ đầu là hành vi "trông có vẻ đúng" và sai đúng ở ca hay gặp nhất: bài dài,
    từ khoá ở giữa. Người đọc thấy một đoạn mở bài không liên quan và kết luận máy tìm bậy.
    """
    than = "mở bài. " * 40 + "chốt lời HPG ở vùng 28."
    ra = _to_dam(than, ["hpg"], dai=60)
    assert "[[HPG]]" in ra
    assert ra.startswith("…"), "phải có dấu … báo là đã cắt bớt phần đầu"


def test_doan_trich_khong_khop_thi_van_tra_doan_dau():
    """Không tìm thấy từ khoá (Meilisearch khớp bằng một biến thể ta không dò được) —
    vẫn phải có chữ để đọc, không được trả rỗng."""
    ra = _to_dam("Một bài viết bình thường.", ["zzz"], dai=200)
    assert ra == "Một bài viết bình thường."


# --- nội dung đẩy vào index là VĂN BẢN THUẦN (2026-08-24) ---------------------


@pytest.mark.django_db
def test_tai_lieu_day_van_ban_thuan_khong_day_the_html(mach_cua_a, nguoi_a):
    """`body` nay là HTML — đẩy nguyên xi vào Meilisearch là hỏng KẾT QUẢ TÌM, không phải
    hỏng an toàn.

    Ba hệ quả nếu đẩy thô: `strong` thành một *từ* khớp mọi bài có chữ đậm;
    `xu<strong>ất</strong>` tan mất một từ tiếng Việt khỏi index; và lệnh đối soát in ra
    nguyên thẻ. `tim()` chỉ lấy id nên không có đường rò nội dung (S6) — đây thuần tuý là
    chuyện tìm đúng hay sai.
    """
    from core.ghi import them_moc
    from core.tim_kiem import tai_lieu

    Moc.objects.filter(mach=mach_cua_a, seq=1).update(
        body="<p>Chốt lời <strong>HPG</strong></p><p>ở vùng 28.</p>"
    )
    them_moc(
        mach=mach_cua_a,
        author=nguoi_a,
        body="<script>alert(1)</script><p>Mốc <em>nối thêm</em>.</p>",
    )
    mach_cua_a.refresh_from_db()

    d = tai_lieu(mach_cua_a)
    assert "<" not in d["than"], d["than"]
    assert "<" not in d["than_them"], d["than_them"]
    assert d["than"] == "Chốt lời HPG ở vùng 28."
    assert "alert(1)" not in d["than_them"]
    assert "Mốc nối thêm." in d["than_them"]


# --- GỢI Ý khi đang gõ (S4, 2026-08-30) --------------------------------------


@pytest.mark.django_db
def test_goi_y_tra_dung_hinh_dang_va_duong_dan_tro_dung_mach(
    client, gia_meili_goi_y, mach_cua_a
):
    """Hợp đồng của một dòng gợi ý, kèm bất biến của `duong_dan`.

    `duong_dan` do server dựng, nên nó phải trỏ **đúng** mạch mà `mach_id` nói. Ghim cả
    hai cùng lúc: một hàm dựng URL lấy nhầm biến trong vòng lặp sẽ cho ra một dropdown mà
    mọi dòng dẫn về cùng một bài.
    """
    gia_meili_goi_y([mach_cua_a.pk])

    du = lay(client, "/api/v1/tim-kiem/goi-y?q=Nhật")
    assert du["co_the_tim"] is True
    assert du["items"] == [
        {
            "mach_id": mach_cua_a.pk,
            "title": mach_cua_a.title,
            "sub_ten": mach_cua_a.sub.ten,
            "duong_dan": f"/m/{mach_cua_a.slug}-{mach_cua_a.pk}",
        }
    ]


@pytest.mark.django_db
def test_goi_y_limit_GHIM_7_khong_nhan_tu_query(client, gia_meili_goi_y, sub, nguoi_a):
    """`?limit=` không tồn tại, và con số gửi xuống Meilisearch luôn là 7.

    Hai vế, và vế thứ hai mới là vế thật: một endpoint *bỏ qua* `?limit=` nhưng lại gửi
    xuống một con số đọc từ đâu đó khác vẫn là một endpoint có `limit` trôi được. Bài đo
    đọc thẳng con số bản giả nhận được.
    """
    from core.ghi import tao_mach

    machs = [
        tao_mach(sub=sub, author=nguoi_a, title=f"Mạch {i}", body="Thân.")[0]
        for i in range(9)
    ]
    trang_thai = gia_meili_goi_y([m.pk for m in machs])

    du = lay(client, "/api/v1/tim-kiem/goi-y?q=Mạch&limit=50")
    assert trang_thai["limit"] == 7, "limit gửi xuống Meilisearch phải GHIM ở 7"
    assert len(du["items"]) == 7


@pytest.mark.django_db
def test_goi_y_q_rong_tra_rong_va_khong_hoi_meilisearch(client, gia_meili_goi_y):
    """Câu rỗng ⇒ rỗng, và **không** đi hỏi gì cả.

    Ô tìm kiếm gọi endpoint này theo từng phím gõ; một lượt xoá hết chữ mà vẫn bắn một
    truy vấn là bắn một truy vấn cho mỗi lần người ta nhấn Backspace tới ký tự cuối.
    """
    trang_thai = gia_meili_goi_y([1, 2, 3])
    du = lay(client, "/api/v1/tim-kiem/goi-y?q=")
    assert du == {"items": [], "co_the_tim": True}
    assert trang_thai["limit"] is None, "q rỗng mà vẫn gọi Meilisearch"


@pytest.mark.django_db
def test_goi_y_mach_bi_mod_an_KHONG_lot(
    client, gia_meili_goi_y, mach_cua_a, nguoi_a
):
    """Cùng lớp lọc thứ hai với `/tim-kiem` — không có ngoại lệ "vì nó chỉ là gợi ý".

    Một cái tên bài rò ra ở dropdown rò y hệt một cái tên bài rò ở trang kết quả, và
    dropdown còn hiện **sớm hơn**: nó bật lên từ ký tự thứ hai.
    """
    dat_an_mach(mach=mach_cua_a, boi=nguoi_a, an=True, ly_do="thử")
    gia_meili_goi_y([mach_cua_a.pk])

    assert lay(client, "/api/v1/tim-kiem/goi-y?q=Nhật")["items"] == []


@pytest.mark.django_db
def test_goi_y_meili_chet_tra_200_kem_co_the_tim_false(client, gia_meili_goi_y):
    """Xuống thang, không phải 503: client giấu dropdown và **không** báo lỗi gì.

    Một ô tìm kiếm nhấp nháy chữ "lỗi" theo từng ký tự gõ vào còn tệ hơn một ô không gợi
    ý gì — nên hợp đồng là 200 + cờ, hệt `/tim-kiem`.
    """
    from core.tim_kiem import MeiliHong

    gia_meili_goi_y(no=MeiliHong("giả vờ Meilisearch chết"))
    du = lay(client, "/api/v1/tim-kiem/goi-y?q=bất kỳ")
    assert du == {"items": [], "co_the_tim": False}


@pytest.mark.django_db
def test_goi_y_khong_cache(client, gia_meili_goi_y):
    """`no-store` — kết quả phụ thuộc trạng thái ẩn, y hệt trang kết quả."""
    gia_meili_goi_y([])
    r = client.get("/api/v1/tim-kiem/goi-y?q=x")
    assert r["Cache-Control"] == "no-store"


@pytest.mark.django_db
def test_goi_y_giu_dung_thu_tu_meilisearch(client, gia_meili_goi_y, sub, nguoi_a):
    """Lớp hai lọc, không sắp lại — cùng bất biến với trang kết quả."""
    from core.ghi import tao_mach

    machs = [
        tao_mach(sub=sub, author=nguoi_a, title=f"Mạch {i}", body="Thân.")[0]
        for i in range(4)
    ]
    mong = [machs[2].pk, machs[0].pk, machs[3].pk, machs[1].pk]
    gia_meili_goi_y(mong)

    du = lay(client, "/api/v1/tim-kiem/goi-y?q=Mạch")
    assert [i["mach_id"] for i in du["items"]] == mong
