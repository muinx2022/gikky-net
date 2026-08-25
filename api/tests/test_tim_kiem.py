"""`GET /api/v1/tim-kiem` — phần đo được **không cần** Meilisearch chạy.

Chia đôi có chủ đích với `test_tim_kiem_that.py`: bài ở đây thay `core.tim_kiem.tim` bằng
một bản giả trả thẳng danh sách ID, nên chúng đo đúng **lớp lọc thứ hai** và các nhánh
xuống thang — những thứ không phụ thuộc hành vi của Meilisearch. Bài cần Meilisearch thật
(tiếng Việt, khoan dung lỗi gõ, `reindex`) nằm ở file kia và **skip** khi chưa cấu hình.

Vì sao tách: nếu gộp, cả nhóm sẽ skip khi máy không có Meilisearch — và **lớp lọc thứ hai
là thứ tuyệt đối không được phép không-đo** trên bất kỳ máy nào. Nó là cái chặn rò nội
dung đã ẩn.
"""

import pytest

from core.ghi import dat_an_mach, dat_an_moc, xoa_moc
from core.models.moc import Moc

from api import tim_kiem as api_tim_kiem
from api.tim_kiem import _bo_dau, _boc, _to_dam

from .conftest import lay


@pytest.fixture
def gia_meili(monkeypatch):
    """Thay `core.tim_kiem.tim` bằng bản giả. Trả về hàm đặt "index đang chứa gì".

    Bản giả trả **đúng** danh sách ID được nạp, không lọc gì — đó chính là điều kiện của
    bài đo S6: giả định lớp một đã hỏng, và hỏi lớp hai có giữ được không.
    """
    trang_thai: dict = {"ids": [], "no": None}

    def _tim(*, q, sub, sap_theo_moi, offset, limit):
        if trang_thai["no"] is not None:
            raise trang_thai["no"]
        ids = trang_thai["ids"]
        return ids[offset : offset + limit], len(ids)

    monkeypatch.setattr(api_tim_kiem, "tim", _tim)

    def dat(ids=None, *, no=None):
        trang_thai["ids"] = list(ids or [])
        trang_thai["no"] = no

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
