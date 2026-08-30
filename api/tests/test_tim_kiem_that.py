"""Tìm kiếm chạy trên **Meilisearch THẬT** — S1, S2, S3, S4, S8.

**Skip khi chưa cấu hình.** Đo hành vi của một service ngoài bằng mock là đo lại giả định
của chính mình: chuyện "gõ không dấu ra kết quả có dấu" đúng hay sai là do Meilisearch
quyết, không do code ở repo này quyết. Plan con §4 nói thẳng — *"phải có bài đo, không
phải 'chắc nó chạy'"*.

Chạy được bằng cách đặt hai biến trong `api/.env`:

    MEILI_URL=http://127.0.0.1:7700
    MEILI_KEY=<khoá phạm vi hẹp, chỉ index `mach`>

rồi bật một tiến trình Meilisearch ở đúng địa chỉ ấy. Không có ⇒ cả file skip, và
`test_tim_kiem.py` (lớp lọc thứ hai, xuống thang) vẫn chạy đầy đủ trên mọi máy.

⚠ **File này XOÁ SẠCH cả hai index** (`mach` và `binh_luan`) ở mỗi bài đo. Nó dùng chung
index với máy dev chứ không dựng index riêng, vì `TEN_INDEX` là hằng của module và một
tham số "tên index cho test" là một nhánh cấu hình chỉ test đi qua — tức một nhánh không
ai kiểm. Dựng lại bằng `node scripts/py.mjs reindex_tim_kiem --sach` sau khi chạy.

⚠ **`MEILI_KEY` phải có quyền với CẢ HAI index** (2026-08-30). Khoá sinh trước ngày ấy chỉ
khai `indexes: ["mach"]`; với nó, nhóm bài bình luận dưới đây đỏ ở lời gọi đầu tiên với
`HTTP 403`. Sinh khoá mới bằng `deploy/prod/tao-khoa-meili.sh` (bản đã sửa).
"""

import time

import pytest
from django.conf import settings

from core.ghi import (
    dat_an_binh_luan,
    dat_an_mach,
    dat_an_moc,
    tao_mach,
    them_moc,
    xoa_moc,
)
from core.models.moc import Moc
from core.tim_kiem import (
    TEN_INDEX,
    TEN_INDEX_BINH_LUAN,
    cau_hinh_index,
    dem_tai_lieu,
    _goi,
    suc_khoe,
    xoa_index,
)

from .conftest import lay, viet

pytestmark = pytest.mark.django_db(transaction=True)


def _bo_qua_neu_khong_co_meili():
    if not (settings.MEILI_URL and settings.MEILI_KEY):
        pytest.skip("MEILI_URL/MEILI_KEY chưa đặt — xem docstring file này")
    if not suc_khoe():
        pytest.skip(f"Meilisearch ở {settings.MEILI_URL} không trả lời")


def _cho_xong(giay: float = 10.0) -> None:
    """Đợi Meilisearch tiêu hoá hết hàng đợi task.

    Meilisearch nhận document **bất đồng bộ**: `PUT /documents` trả `enqueued` rồi mới
    index sau. Không đợi thì mọi bài đo dưới đây thành cuộc đua, và nó sẽ đỏ ngẫu nhiên
    trên máy chậm — đúng loại test làm người ta mất niềm tin vào cả bộ.
    """
    het = time.monotonic() + giay
    while time.monotonic() < het:
        ket = _goi("GET", "/tasks?statuses=enqueued,processing&limit=1")
        if not ket.get("results"):
            return
        time.sleep(0.15)
    raise AssertionError(f"Meilisearch chưa xử xong hàng đợi sau {giay}s")


def _dem_tai_lieu(index: str = TEN_INDEX) -> int:
    """Số tài liệu đang nằm trong một index.

    Đếm bằng `GET /documents?limit=0` chứ không bằng `/stats`: `/stats` đòi action
    `stats.get`, mà khoá của Django cố ý **không** có nó (khoá phạm vi hẹp — plan con §3).
    Nới quyền của khoá sản phẩm để một bài đo đếm cho tiện là đúng thứ "phạm vi hẹp" tồn
    tại để chặn.
    """
    return dem_tai_lieu(index)


@pytest.fixture
def meili():
    """**Cả hai** index sạch trước mỗi bài. Trả hàm `cho_xong` để bài đo gọi sau khi ghi.

    `xoa_index()` nay tự nuốt 404 (index chưa tồn tại là đúng trạng thái mong muốn của
    một hàm tên như thế) — xem docstring của nó.
    """
    _bo_qua_neu_khong_co_meili()
    xoa_index()
    cau_hinh_index()
    _cho_xong()
    return _cho_xong


@pytest.fixture
def ba_mach(db, sub, nguoi_a):
    """Ba mạch có nội dung tiếng Việt thật, đủ để phân biệt khớp đúng với khớp nhiễu."""
    a, _ = tao_mach(
        sub=sub,
        author=nguoi_a,
        title="Nhật ký lệnh HPG",
        body="Mua HPG vùng giá 26, chốt một phần ở 28.",
    )
    b, _ = tao_mach(
        sub=sub,
        author=nguoi_a,
        title="Sổ tay đầu tư VNM",
        body="Theo dõi sữa Vinamilk quý bốn.",
    )
    c, _ = tao_mach(
        sub=sub,
        author=nguoi_a,
        title="Sóng HAG quý ba",
        body="Nông nghiệp, không liên quan thép.",
    )
    return a, b, c


def _id_trong_index(q: str) -> list[int]:
    """Hỏi **thẳng Meilisearch**, không đi qua lớp lọc Postgres.

    Cần thiết vì lớp lọc thứ hai làm mọi bài đo qua endpoint trở nên **mù với index**:
    một mạch bị ẩn sẽ biến khỏi kết quả endpoint kể cả khi đường gỡ index hỏng hoàn toàn.
    Bài đo S4 ở mức mạch nếu chỉ nhìn endpoint thì XANH VĨNH VIỄN — đúng loại "proof đo
    rỗng" mà repo đã dính một lần. Đây là con mắt nhìn được lớp một.
    """
    from core.tim_kiem import tim

    ids, _ = tim(q=q, sub=None, sap_theo_moi=False, offset=0, limit=50)
    return ids


def _tim(client, q: str, **them) -> list[str]:
    """Gọi endpoint thật, trả danh sách tiêu đề."""
    truy_van = "&".join(f"{k}={v}" for k, v in them.items())
    url = f"/api/v1/tim-kiem?q={q}" + (f"&{truy_van}" if truy_van else "")
    du = lay(client, url)
    assert du["co_the_tim"] is True, "Meilisearch phải sống ở nhóm bài đo này"
    return [i["mach"]["title"] for i in du["items"]]


# --- S1: tìm được theo tiêu đề và theo thân mốc 1 ---------------------------


def test_tim_duoc_theo_tieu_de(client, meili, ba_mach):
    meili()
    assert _tim(client, "Nhật ký") == ["Nhật ký lệnh HPG"]


def test_tim_duoc_theo_than_moc_1(client, meili, ba_mach):
    """`vùng giá` chỉ có trong THÂN mốc 1, không có trong tiêu đề nào."""
    meili()
    assert _tim(client, "vùng giá") == ["Nhật ký lệnh HPG"]


def test_tim_duoc_theo_than_moc_noi_sau(client, meili, sub, nguoi_a):
    """Mốc 2 trở đi nằm ở `than_them` — nối mốc phải đẩy lại index."""
    m, _ = tao_mach(sub=sub, author=nguoi_a, title="Mạch dài", body="Mốc một.")
    them_moc(mach=m, author=nguoi_a, body="Nhắc tới cổ phiếu DGC ở đây.")
    meili()
    assert _tim(client, "DGC") == ["Mạch dài"]


# --- S2: gõ KHÔNG DẤU ra kết quả CÓ DẤU -------------------------------------


@pytest.mark.parametrize(
    "cau,mong",
    [
        ("nhat ky lenh hpg", "Nhật ký lệnh HPG"),
        ("nhat ky", "Nhật ký lệnh HPG"),
        ("so tay dau tu", "Sổ tay đầu tư VNM"),
        ("sua vinamilk", "Sổ tay đầu tư VNM"),
    ],
)
def test_go_khong_dau_ra_ket_qua_co_dau(client, meili, ba_mach, cau, mong):
    """S2 — hành vi người Việt hay dùng nhất.

    Bài đo này cũng là chỗ ghim rằng **không cần trường `*_khong_dau` chép tay**:
    Meilisearch chuẩn hoá bỏ dấu ở tầng tokenize. Ngày nào điều đó thôi đúng, bài này đỏ
    và người sửa biết ngay phải thêm gì.
    """
    meili()
    assert mong in _tim(client, cau.replace(" ", "%20"))


def test_go_co_dau_van_ra(client, meili, ba_mach):
    """Chiều ngược của S2 — bỏ dấu không được làm hỏng truy vấn có dấu."""
    meili()
    assert _tim(client, "Nhật%20ký") == ["Nhật ký lệnh HPG"]


# --- S3: khoan dung lỗi gõ, nhưng mã chứng khoán khớp CHÍNH XÁC -------------


def test_go_sai_mot_ky_tu_o_tu_dai_van_ra(client, meili, ba_mach):
    """`Vinamik` thiếu chữ `l` — từ ≥5 ký tự được khoan dung một lỗi."""
    meili()
    assert "Sổ tay đầu tư VNM" in _tim(client, "Vinamik")


def test_ma_chung_khoan_khop_CHINH_XAC_khong_keo_nhieu(client, meili, ba_mach):
    """S3 — `HPG` **không** được kéo `HAG` vào cùng kết quả.

    Cái giữ tính chất này là `typoTolerance.minWordSizeForTypos.oneTypo = 5`: từ ngắn hơn
    5 ký tự không được sai ký tự nào. `core/tim_kiem.py` ghim con số ấy **tường minh dù
    nó trùng mặc định của Meilisearch 1.53**, và bài đo này là lý do — một bản sau đổi
    mặc định thì mã chứng khoán bắt đầu nhiễu, im lặng.
    """
    meili()
    assert _tim(client, "HPG") == ["Nhật ký lệnh HPG"]
    assert _tim(client, "HAG") == ["Sóng HAG quý ba"]


# --- S4: mod ẩn ⇒ biến khỏi kết quả; gỡ ẩn ⇒ quay lại -----------------------


def test_mod_an_mach_thi_bien_khoi_ket_qua_va_go_an_thi_quay_lai(
    client, meili, ba_mach, nguoi_a
):
    """S4 cho **MẠCH** — vòng đủ hai chiều, đo trên Meilisearch thật.

    Chiều "quay lại" quan trọng ngang chiều "biến mất": gỡ ẩn mà tài liệu không dựng lại
    thì mod đã xoá vĩnh viễn một bài khỏi tìm kiếm bằng một thao tác họ tin là đảo ngược
    được.

    ⚠ **Bài này phải soi CẢ HAI lớp, và vế `_id_trong_index` mới là vế thật.** Bản đầu chỉ
    nhìn kết quả endpoint, và nó XANH kể cả khi `dong_bo_mach` bị gỡ hẳn khỏi
    `dat_an_mach` — vì lớp lọc Postgres một mình đã đủ làm mạch bị ẩn biến khỏi kết quả.
    Một bài đo như thế khẳng định đúng bất kể đường ghi làm gì, tức nó không đo gì cả.
    """
    a, _, _ = ba_mach
    meili()
    assert _tim(client, "HPG") == ["Nhật ký lệnh HPG"]
    assert _id_trong_index("HPG") == [a.pk]

    dat_an_mach(mach=a, boi=nguoi_a, an=True, ly_do="thử")
    meili()
    assert _id_trong_index("HPG") == [], (
        "tài liệu vẫn nằm trong index sau khi mod ẩn mạch — lớp một hỏng. Hôm nay lớp "
        "lọc Postgres còn che được, nhưng index không tự hết hạn nên nó sai vĩnh viễn."
    )
    assert _tim(client, "HPG") == [], "mạch bị mod ẩn vẫn tìm thấy được"

    dat_an_mach(mach=a, boi=nguoi_a, an=False)
    meili()
    assert _id_trong_index("HPG") == [a.pk], "gỡ ẩn mà không dựng lại tài liệu"
    assert _tim(client, "HPG") == ["Nhật ký lệnh HPG"], "gỡ ẩn mà không quay lại index"


def test_mod_an_moc_thi_than_bien_khoi_ket_qua_va_go_an_thi_quay_lai(
    client, meili, ba_mach, nguoi_a
):
    """S4 cho **MỐC** — mạch ở lại, chỉ nội dung mốc rời index.

    Khác ca trên ở chỗ dễ sai nhất: mạch vẫn hiện trên feed nên tài liệu **không** bị xoá,
    nó phải được **cập nhật**. Tìm theo tiêu đề vẫn ra; tìm theo chữ chỉ có trong thân mốc
    thì không.
    """
    a, _, _ = ba_mach
    moc1 = Moc.objects.get(mach=a, seq=1)
    meili()
    assert _tim(client, "vùng%20giá") == ["Nhật ký lệnh HPG"]

    dat_an_moc(moc=moc1, boi=nguoi_a, an=True, ly_do="thử")
    meili()
    assert _tim(client, "vùng%20giá") == [], "thân mốc bị mod ẩn vẫn tìm thấy được"
    assert _tim(client, "Nhật%20ký") == ["Nhật ký lệnh HPG"], "mạch không được biến mất"

    dat_an_moc(moc=moc1, boi=nguoi_a, an=False)
    meili()
    assert _tim(client, "vùng%20giá") == ["Nhật ký lệnh HPG"]


def test_moc_bia_mo_khong_con_trong_index(client, meili, ba_mach):
    """Tác giả tự xoá mốc 1 ⇒ thân rời index, cùng luật với mod ẩn."""
    a, _, _ = ba_mach
    meili()
    assert _tim(client, "vùng%20giá") == ["Nhật ký lệnh HPG"]

    xoa_moc(moc=Moc.objects.get(mach=a, seq=1))
    meili()
    assert _tim(client, "vùng%20giá") == []


# --- lọc theo sub ------------------------------------------------------------


def test_loc_theo_sub(client, meili, ba_mach, db, nguoi_a):
    from core.models.dien_dan import Sub

    khac = Sub.objects.create(slug="crypto", ten="Crypto")
    tao_mach(sub=khac, author=nguoi_a, title="Nhật ký lệnh BTC", body="Vào lệnh BTC.")
    meili()

    assert _tim(client, "Nhật%20ký", sub="crypto") == ["Nhật ký lệnh BTC"]
    assert _tim(client, "Nhật%20ký", sub="chung-khoan") == ["Nhật ký lệnh HPG"]


# --- S8: xoá sạch index rồi reindex dựng lại đủ ------------------------------


def test_xoa_sach_index_roi_reindex_dung_lai_du(client, meili, ba_mach):
    """S8 — đo bằng **số lượng** và bằng **một truy vấn mẫu**.

    Đây là bài chứng minh câu "Meilisearch không cần sao lưu riêng" (PLAN 8.7) là sự thật
    chứ không phải một lời hứa: nếu `reindex` không dựng lại đủ thì câu ấy sai và bản sao
    lưu Postgres không đủ để khôi phục hệ thống.
    """
    from django.core.management import call_command

    meili()
    assert _tim(client, "HPG") == ["Nhật ký lệnh HPG"]

    xoa_index()
    _cho_xong()
    # Index không còn ⇒ **xuống thang**, không phải "không tìm thấy gì". Phân biệt được
    # hai trạng thái ấy là điều kiện để bước dựng lại bên dưới có nghĩa: nếu ở đây trả
    # rỗng-nhưng-`co_the_tim=true` thì bài đo không chứng minh được index đã thật sự mất.
    du = lay(client, "/api/v1/tim-kiem?q=HPG")
    assert du["co_the_tim"] is False and du["items"] == []

    call_command("reindex_tim_kiem", sach=True)
    _cho_xong()

    assert _dem_tai_lieu() == 3
    assert _tim(client, "HPG") == ["Nhật ký lệnh HPG"]


def test_reindex_khong_dua_mach_bi_an_vao_lai(client, meili, ba_mach, nguoi_a):
    """Lệnh đối soát phải dùng **cùng luật hiện/ẩn** với đường ghi.

    Ngược lại thì mỗi lần chạy `reindex` là một lần hồi sinh mọi mạch mod đã ẩn — một cron
    hằng đêm sẽ lặng lẽ hoàn tác toàn bộ công việc kiểm duyệt.
    """
    from django.core.management import call_command

    a, _, _ = ba_mach
    dat_an_mach(mach=a, boi=nguoi_a, an=True, ly_do="thử")

    call_command("reindex_tim_kiem", sach=True)
    _cho_xong()

    assert _dem_tai_lieu() == 2
    assert _tim(client, "HPG") == []


# --- BÌNH LUẬN trên Meilisearch THẬT (2026-08-30) ---------------------------


def _id_binh_luan_trong_index(q: str) -> list[int]:
    """Hỏi thẳng Meilisearch, chỉ nhánh bình luận của kết quả trộn."""
    from core.tim_kiem import tim_tron

    cap, _ = tim_tron(q=q, sub=None, sap_theo_moi=False, offset=0, limit=50)
    return [ma for loai, ma in cap if loai == TEN_INDEX_BINH_LUAN]


def _tron(client, q: str, **them) -> list[tuple[str, int]]:
    """Gọi endpoint thật, trả `[(loai, id)]` theo đúng thứ tự hiện ra."""
    truy_van = "&".join(f"{k}={v}" for k, v in them.items())
    du = lay(client, f"/api/v1/tim-kiem?q={q}" + (f"&{truy_van}" if truy_van else ""))
    assert du["co_the_tim"] is True, "Meilisearch phải sống ở nhóm bài đo này"
    return [
        (i["loai"], i["binh_luan_id"] if i["loai"] == "binh_luan" else i["mach"]["id"])
        for i in du["items"]
    ]


def test_tim_duoc_theo_noi_dung_binh_luan(client, meili, ba_mach, nguoi_b):
    """Chữ chỉ có trong một BÌNH LUẬN, không có trong tiêu đề hay thân mốc nào."""
    a, _, _ = ba_mach
    c = viet(a, nguoi_b, "Tôi nghĩ vùng kháng cự là 31 nghìn.")
    meili()
    assert _tron(client, "kháng%20cự") == [("binh_luan", c.pk)]


def test_go_khong_dau_ra_binh_luan_co_dau(client, meili, ba_mach, nguoi_b):
    """Cùng tính chất tiếng Việt với index `mach` — nó do Meilisearch quyết, nên phải đo
    lại trên index thứ hai chứ không suy ra."""
    a, _, _ = ba_mach
    c = viet(a, nguoi_b, "Vùng kháng cự quanh 31.")
    meili()
    assert _tron(client, "khang%20cu") == [("binh_luan", c.pk)]


def test_ket_qua_TRON_ca_hai_loai_trong_mot_danh_sach(client, meili, ba_mach, nguoi_b):
    """Câu khớp cả tiêu đề mạch lẫn nội dung một bình luận ⇒ danh sách có CẢ HAI loại."""
    a, _, _ = ba_mach
    c = viet(a, nguoi_b, "HPG hôm nay xanh.")
    meili()
    ra = _tron(client, "HPG")
    assert ("mach", a.pk) in ra
    assert ("binh_luan", c.pk) in ra


def test_mod_an_binh_luan_thi_bien_khoi_ket_qua_va_go_an_thi_quay_lai(
    client, meili, ba_mach, nguoi_a, nguoi_b
):
    """Soi CẢ HAI lớp — vế `_id_binh_luan_trong_index` mới là vế thật.

    Chỉ nhìn kết quả endpoint thì bài này XANH kể cả khi `dong_bo_binh_luan` bị gỡ hẳn
    khỏi `dat_an_binh_luan`: lớp lọc Postgres một mình đã đủ làm câu bị ẩn biến khỏi kết
    quả. Một bài đo như thế khẳng định đúng bất kể đường ghi làm gì.
    """
    a, _, _ = ba_mach
    c = viet(a, nguoi_b, "Câu có chữ độc nhất: mangan.")
    meili()
    assert _id_binh_luan_trong_index("mangan") == [c.pk]

    dat_an_binh_luan(comment=c, boi=nguoi_a, an=True, ly_do="thử")
    meili()
    assert _id_binh_luan_trong_index("mangan") == [], (
        "tài liệu bình luận vẫn nằm trong index sau khi mod ẩn — lớp một hỏng"
    )
    assert _tron(client, "mangan") == []

    dat_an_binh_luan(comment=c, boi=nguoi_a, an=False)
    meili()
    assert _id_binh_luan_trong_index("mangan") == [c.pk]


def test_an_mach_go_ca_lo_binh_luan_khoi_index_that(
    client, meili, ba_mach, nguoi_a, nguoi_b
):
    """Cascade `mach_id = X` chạy thật trên Meilisearch — `documents/delete` theo filter.

    Bản giả ở `tests/_meili_gia.py` chỉ chứng minh *ta gửi đúng filter*; bài này chứng
    minh **Meilisearch hiểu nó**. `mach_id` phải nằm trong `filterableAttributes`, và một
    lượt cấu hình sót trường ấy trả HTTP 400 — mà đường ghi thì nuốt.
    """
    a, _, _ = ba_mach
    for i in range(3):
        viet(a, nguoi_b, f"Câu số {i} nhắc tới mangan.")
    meili()
    assert len(_id_binh_luan_trong_index("mangan")) == 3

    dat_an_mach(mach=a, boi=nguoi_a, an=True, ly_do="thử")
    meili()
    assert _dem_tai_lieu(TEN_INDEX_BINH_LUAN) == 0
    assert _tron(client, "mangan") == []

    dat_an_mach(mach=a, boi=nguoi_a, an=False)
    meili()
    assert len(_id_binh_luan_trong_index("mangan")) == 3


def test_loc_sub_lam_ket_qua_binh_luan_vang(client, meili, ba_mach, nguoi_b):
    """Hành vi ĐÃ BIẾT, ghim để nó không đổi âm thầm: `?sub=` ⇒ chỉ còn mạch."""
    a, _, _ = ba_mach
    viet(a, nguoi_b, "HPG hôm nay xanh.")
    meili()
    assert all(loai == "mach" for loai, _ in _tron(client, "HPG", sub="chung-khoan"))


def test_sort_moi_tron_hai_loai_theo_thoi_gian(client, meili, ba_mach, nguoi_b):
    """Nhánh không-federation chạy thật: hai `sort` per-query, trộn ở Python.

    Bình luận được viết SAU mọi mạch, nên nó phải đứng đầu — nếu Meilisearch bỏ qua
    `sort` (hoặc nhánh này lỡ đi đường federation, vốn không nhận `sort`) thì thứ tự rơi
    về độ liên quan và bài đỏ.
    """
    a, _, _ = ba_mach
    c = viet(a, nguoi_b, "Nhật ký mới nhất về HPG.")
    meili()
    ra = _tron(client, "Nhật%20ký", sort="moi")
    assert ra[0] == ("binh_luan", c.pk), ra


def test_goi_y_tra_mach_va_KHONG_tra_binh_luan(client, meili, ba_mach, nguoi_b):
    """Quyết định của user, đo trên đường thật: dropdown chỉ có mạch."""
    a, _, _ = ba_mach
    viet(a, nguoi_b, "Nhật ký của tôi về HPG.")
    meili()
    du = lay(client, "/api/v1/tim-kiem/goi-y?q=Nhật%20ký")
    assert du["co_the_tim"] is True
    assert [i["mach_id"] for i in du["items"]] == [a.pk]
    assert du["items"][0]["duong_dan"] == f"/m/{a.slug}-{a.pk}"


def test_reindex_dung_lai_CA_HAI_index(client, meili, ba_mach, nguoi_b):
    """S8 mở rộng: xoá sạch rồi dựng lại phải phủ cả bình luận."""
    from django.core.management import call_command

    a, _, _ = ba_mach
    viet(a, nguoi_b, "Câu một.")
    viet(a, nguoi_b, "Câu hai.")

    xoa_index()
    _cho_xong()
    call_command("reindex_tim_kiem", sach=True)
    _cho_xong()

    assert _dem_tai_lieu(TEN_INDEX) == 3
    assert _dem_tai_lieu(TEN_INDEX_BINH_LUAN) == 2


def test_reindex_GO_MA_that_khong_can_sach(client, meili, ba_mach):
    """Gỡ ma chạy thật: nhồi một tài liệu Postgres không có, rồi đối soát mặc định."""
    from django.core.management import call_command

    _goi(
        "PUT",
        f"/indexes/{TEN_INDEX}/documents?primaryKey=id",
        [{"id": 999_001, "title": "Ma", "hien": True}],
    )
    _cho_xong()
    assert _dem_tai_lieu(TEN_INDEX) == 4

    call_command("reindex_tim_kiem")
    _cho_xong()
    assert _dem_tai_lieu(TEN_INDEX) == 3
