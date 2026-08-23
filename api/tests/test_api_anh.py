"""`POST /mocs/{id}/anh` · `DELETE /anh/{id}` — Phase 5, tiêu chí A3/A5/A7/A8/A9.

Bảy phép kiểm về **nội dung byte** nằm ở `test_anh_bay_phep_kiem.py` (hàm thuần, không
DB). File này đo ba câu hỏi mà chỉ tầng API trả lời được: **ai** được ghi (A7), **trần
10 ảnh có giữ dưới đua không** (A3, phép kiểm 7), và **file có thật sự rời đĩa không**
(A8, A9).

Cuộc đua của A3 nằm ở `test_anh_dua_khoa.py` — nó cần `transaction=True`, thứ làm mọi
bài đo trong cùng file chậm đi và mất tính cô lập.
"""

import pytest

from core.anh import ANH_HONG, ANH_QUA_NANG, BYTE_TOI_DA, DINH_DANG_KHONG_NHAN
from core.anh_luu import duong_dan_chinh, duong_dan_thumb
from core.ghi import SO_ANH_TOI_DA_MOI_MOC, dat_an_mach, dat_an_moc, them_moc, xoa_moc
from core.models.moc import MocAnh

from api.anh import QUA_NHIEU_ANH
from api.loi import KHONG_TIM_THAY
from api.quyen import KHONG_PHAI_CHU, MACH_BI_KHOA, NOI_DUNG_DA_GO

from ._anh import (
    PHP_GIA_JPG,
    SVG_GIA_JPG,
    anh_byte,
    duoi_va_byte,
    polyglot_jpeg_html,
)
from .conftest import file_trong, lay, so_file

pytestmark = pytest.mark.usefixtures("kho_anh")


def tai_len(client, moc_id: int, du_lieu: bytes = None, *, ten="anh.jpg", status=201):
    """POST multipart một ảnh. Trả thân đã parse.

    Mặc định gửi tên `.jpg` + `Content-Type: image/jpeg` cho MỌI loại nội dung — đó là
    hình dạng thật của một request tấn công, và nó ghim rằng server không tin hai giá
    trị ấy.
    """
    import json

    if du_lieu is None:
        du_lieu = anh_byte()
    ten_f, f, kieu = duoi_va_byte(du_lieu, ten)
    r = client.post(f"/api/v1/mocs/{moc_id}/anh", {"file": f})
    assert r.status_code == status, (
        f"POST ảnh trả {r.status_code}, mong {status}: {r.content[:400]!r}"
    )
    return json.loads(r.content) if r.content else None


def ma_loi_tai_len(client, moc_id: int, du_lieu: bytes, *, status: int) -> str:
    than = tai_len(client, moc_id, du_lieu, status=status)
    assert "code" in than, f"thân lỗi thiếu `code`: {than!r}"
    return than["code"]


@pytest.fixture
def moc_a(mach_cua_a):
    """Mốc 2 của mạch A — mốc thường, không phải bài gốc."""
    from core.models.moc import Moc

    return Moc.objects.get(mach=mach_cua_a, seq=2)


# --- Đường ghi hạnh phúc ------------------------------------------------------


@pytest.mark.django_db
def test_tai_anh_len_roi_GET_mach_thay_no_trong_gallery(client, nguoi_a, moc_a, kho_anh):
    """A1 ở tầng API: ảnh lên → nằm trong `MocOut.anhs` → file có mặt trên đĩa.

    (Vế "trình duyệt thật + tải lại trang" của A1 là bài e2e, chưa chạy được ở worktree này.)
    """
    client.force_login(nguoi_a)
    d = tai_len(client, moc_a.pk)
    assert d["url"].startswith("/media/") and d["url_thumb"].startswith("/media/")
    assert d["position"] == 1 and d["w"] and d["h"]

    phuc_vu, _ = kho_anh
    khoa = MocAnh.objects.get(pk=d["id"]).khoa_luu_tru
    assert (phuc_vu / duong_dan_chinh(khoa)).exists()
    assert (phuc_vu / duong_dan_thumb(khoa)).exists()
    assert so_file(phuc_vu) == 2, "đúng hai file: ảnh chính + thumbnail"

    mach = lay(client, f"/api/v1/machs/{moc_a.mach_id}")
    moc = next(m for m in mach["mocs"] if m["id"] == moc_a.pk)
    assert [a["id"] for a in moc["anhs"]] == [d["id"]]


@pytest.mark.django_db
def test_moc_khong_anh_tra_ve_danh_sach_RONG_chu_khong_null(client, mach_cua_a):
    """Nguyên tắc 9: mốc không ảnh thì UI **không render gì cả**. `[]` chứ không `null`."""
    mach = lay(client, f"/api/v1/machs/{mach_cua_a.pk}")
    assert all(m["anhs"] == [] for m in mach["mocs"])


@pytest.mark.django_db
def test_nhieu_anh_giu_dung_thu_tu_position(client, nguoi_a, moc_a):
    client.force_login(nguoi_a)
    ids = [tai_len(client, moc_a.pk)["id"] for _ in range(3)]
    mach = lay(client, f"/api/v1/machs/{moc_a.mach_id}")
    moc = next(m for m in mach["mocs"] if m["id"] == moc_a.pk)
    assert [a["id"] for a in moc["anhs"]] == ids
    assert [a["position"] for a in moc["anhs"]] == [1, 2, 3]


# --- A7: phân quyền ------------------------------------------------------------


@pytest.mark.django_db
def test_A7_user_B_khong_tai_anh_len_moc_cua_A(client, nguoi_b, moc_a):
    client.force_login(nguoi_b)
    assert ma_loi_tai_len(client, moc_a.pk, anh_byte(), status=403) == KHONG_PHAI_CHU


@pytest.mark.django_db
def test_A7_user_B_khong_xoa_duoc_anh_cua_A(client, nguoi_a, nguoi_b, moc_a, kho_anh):
    client.force_login(nguoi_a)
    anh_id = tai_len(client, moc_a.pk)["id"]

    client.force_login(nguoi_b)
    r = client.delete(f"/api/v1/anh/{anh_id}")
    assert r.status_code == 403
    assert r.json()["code"] == KHONG_PHAI_CHU

    phuc_vu, _ = kho_anh
    assert so_file(phuc_vu) == 2, "B bị từ chối thì file phải còn nguyên"
    assert MocAnh.objects.filter(pk=anh_id).exists()


@pytest.mark.django_db
def test_khach_chua_dang_nhap_nhan_401(client, moc_a):
    r = client.post(f"/api/v1/mocs/{moc_a.pk}/anh", {"file": duoi_va_byte(anh_byte())[1]})
    assert r.status_code == 401


@pytest.mark.django_db
def test_mach_bi_khoa_thi_403(client, nguoi_a, moc_a, django_user_model):
    from django.utils import timezone

    mach = moc_a.mach
    mach.locked_at = timezone.now()
    mach.save(update_fields=["locked_at"])
    client.force_login(nguoi_a)
    assert ma_loi_tai_len(client, moc_a.pk, anh_byte(), status=403) == MACH_BI_KHOA


@pytest.mark.django_db
def test_moc_bia_mo_thi_409(client, nguoi_a, moc_a):
    xoa_moc(moc=moc_a)
    client.force_login(nguoi_a)
    assert ma_loi_tai_len(client, moc_a.pk, anh_byte(), status=409) == NOI_DUNG_DA_GO


@pytest.mark.django_db
def test_mach_da_dong_so_VAN_tai_anh_len_duoc(client, nguoi_a, moc_a):
    """PLAN 5.1: đóng sổ chặn *nối mốc mới*, không chặn sửa mốc cũ — và thêm ảnh vào một
    mốc đã viết là sửa mốc cũ. `PATCH /mocs/{id}` cũng không kiểm `status`."""
    from core.ghi import dong_so

    dong_so(mach=moc_a.mach, ket_qua="lãi 8%")
    client.force_login(nguoi_a)
    tai_len(client, moc_a.pk)


# --- A5 qua HTTP: tên file và Content-Type nói dối -----------------------------


@pytest.mark.django_db
@pytest.mark.parametrize("ten", ["x.php", "x.jpg", "x.JPG", "x.png"])
def test_A5_file_php_du_doi_ten_kieu_gi_cung_bi_tu_choi(client, nguoi_a, moc_a, ten):
    client.force_login(nguoi_a)
    assert (
        ma_loi_tai_len(client, moc_a.pk, PHP_GIA_JPG, status=400) == ANH_HONG
    ), f"đuôi {ten}"


@pytest.mark.django_db
def test_A5_svg_bi_tu_choi(client, nguoi_a, moc_a):
    client.force_login(nguoi_a)
    assert ma_loi_tai_len(client, moc_a.pk, SVG_GIA_JPG, status=400) == ANH_HONG


@pytest.mark.django_db
def test_A5_polyglot_len_duoc_nhung_file_tren_dia_da_vo_hai(
    client, nguoi_a, moc_a, kho_anh
):
    """Polyglot **không bị từ chối** — nó là JPEG hợp lệ. Nó bị tái mã hoá thành vô hại.

    Bài đo đọc byte THẬT trên đĩa chứ không đọc response: thứ nguy hiểm là cái Caddy sẽ
    phục vụ, không phải cái API vừa trả về.
    """
    client.force_login(nguoi_a)
    tai_len(client, moc_a.pk, polyglot_jpeg_html())

    phuc_vu, _ = kho_anh
    for p in phuc_vu.rglob("*"):
        if p.is_file():
            assert b"<script>" not in p.read_bytes(), f"{p.name} còn nguyên đuôi HTML"


@pytest.mark.django_db
def test_gif_bi_tu_choi_qua_HTTP(client, nguoi_a, moc_a):
    client.force_login(nguoi_a)
    ma = ma_loi_tai_len(client, moc_a.pk, anh_byte(dinh_dang="GIF"), status=400)
    assert ma == DINH_DANG_KHONG_NHAN


@pytest.mark.django_db
def test_anh_qua_nang_tra_413(client, nguoi_a, moc_a):
    """413 chứ không 400: "quá nặng" là câu trả lời khác hẳn "sai định dạng", và UI nói
    hai câu khác nhau cho hai ca đó (plan §3 — lỗi nói bằng tiếng người)."""
    client.force_login(nguoi_a)
    ma = ma_loi_tai_len(client, moc_a.pk, b"\x00" * (BYTE_TOI_DA + 10), status=413)
    assert ma == ANH_QUA_NANG


@pytest.mark.django_db
@pytest.mark.parametrize(
    "dinh_dang,duoi", [("JPEG", ".jpg"), ("PNG", ".png"), ("WEBP", ".webp")]
)
def test_duoi_cua_KHOA_DA_LUU_theo_dinh_dang_nhan_dang_chu_khong_theo_ten_client(
    client, nguoi_a, moc_a, kho_anh, dinh_dang, duoi
):
    """Phép kiểm 6 đo tới **tên file trên đĩa**, không dừng ở giá trị hàm thuần trả về.

    ⚠ Bài đo này được thêm sau lượt **thử phá**: sửa `khoa_moi` cho nó gán cứng `.jpg`
    bất kể định dạng thì cả 51 bài đo còn lại **vẫn xanh** — `test_3_duoi_suy_tu_NOI_DUNG…`
    chỉ đọc `AnhDaXuLy.duoi`, tức nó dừng lại đúng một bước trước chỗ giá trị ấy được
    dùng. Khoảng trống đó nguy hiểm thật: đuôi file là thứ Caddy `file_server` đọc để
    đặt `Content-Type`, nên một đuôi sai là một `Content-Type` sai trên mọi ảnh, và
    `nosniff` **không cứu** — nó chỉ cấm trình duyệt đoán khác đi, không cấm cái server
    đã tuyên bố.

    Client gửi tên `.jpg` + `Content-Type: image/jpeg` cho cả ba, và bị bỏ qua cả ba lần.
    """
    client.force_login(nguoi_a)
    d = tai_len(client, moc_a.pk, anh_byte(dinh_dang=dinh_dang), ten="noi-doi.jpg")

    khoa = MocAnh.objects.get(pk=d["id"]).khoa_luu_tru
    assert khoa.endswith(duoi), f"{dinh_dang} lưu thành {khoa}"
    assert d["url"].endswith(duoi) and d["url_thumb"].endswith(duoi)

    phuc_vu, _ = kho_anh
    assert (phuc_vu / duong_dan_chinh(khoa)).exists()
    assert all(p.suffix == duoi for p in phuc_vu.rglob("*") if p.is_file())


@pytest.mark.django_db
def test_ten_file_client_gui_KHONG_bao_gio_cham_duong_dan(client, nguoi_a, moc_a, kho_anh):
    """Phép kiểm 6 qua HTTP: tên hiểm độc không để lại dấu vết nào trên đĩa."""
    client.force_login(nguoi_a)
    d = tai_len(client, moc_a.pk, anh_byte(), ten="../../../../etc/passwd.jpg")

    phuc_vu, _ = kho_anh
    ten_file = file_trong(phuc_vu)
    assert not any("passwd" in t for t in ten_file), ten_file
    assert "passwd" not in d["url"]
    # uuid4 hex + đuôi.
    khoa = MocAnh.objects.get(pk=d["id"]).khoa_luu_tru
    assert len(khoa) == 32 + len(".jpg") and khoa.endswith(".jpg")


# --- A3 (vế tuần tự): trần 10 ảnh ---------------------------------------------


@pytest.mark.django_db
def test_A3_anh_thu_11_bi_tu_choi(client, nguoi_a, moc_a, kho_anh):
    client.force_login(nguoi_a)
    for _ in range(SO_ANH_TOI_DA_MOI_MOC):
        tai_len(client, moc_a.pk)
    assert ma_loi_tai_len(client, moc_a.pk, anh_byte(), status=409) == QUA_NHIEU_ANH

    assert MocAnh.objects.filter(moc=moc_a).count() == SO_ANH_TOI_DA_MOI_MOC
    phuc_vu, _ = kho_anh
    assert so_file(phuc_vu) == 2 * SO_ANH_TOI_DA_MOI_MOC, (
        "lượt bị từ chối không được để lại file mồ côi trên đĩa"
    )


@pytest.mark.django_db
def test_tran_10_tinh_THEO_MOC_chu_khong_theo_mach(client, nguoi_a, mach_cua_a, moc_a):
    """Mốc khác trong cùng mạch vẫn còn đủ suất — trần là trần của MỐC."""
    client.force_login(nguoi_a)
    for _ in range(SO_ANH_TOI_DA_MOI_MOC):
        tai_len(client, moc_a.pk)

    moc_khac = them_moc(mach=mach_cua_a, author=nguoi_a, body="Mốc 3 của A.")
    tai_len(client, moc_khac.pk)


@pytest.mark.django_db
def test_xoa_bot_thi_tai_len_duoc_tiep(client, nguoi_a, moc_a):
    client.force_login(nguoi_a)
    ids = [tai_len(client, moc_a.pk)["id"] for _ in range(SO_ANH_TOI_DA_MOI_MOC)]
    ma_loi_tai_len(client, moc_a.pk, anh_byte(), status=409)

    assert client.delete(f"/api/v1/anh/{ids[0]}").status_code == 200
    tai_len(client, moc_a.pk)


# --- A8: xoá hàng ⇒ file biến khỏi đĩa ----------------------------------------


@pytest.mark.django_db
def test_A8_xoa_anh_thi_file_bien_khoi_dia(client, nguoi_a, moc_a, kho_anh):
    client.force_login(nguoi_a)
    d = tai_len(client, moc_a.pk)
    khoa = MocAnh.objects.get(pk=d["id"]).khoa_luu_tru

    phuc_vu, _ = kho_anh
    assert file_trong(phuc_vu) == {khoa}, "một khoá, hai file (chính + thumb) cùng tên"
    assert (phuc_vu / duong_dan_chinh(khoa)).exists()
    assert (phuc_vu / duong_dan_thumb(khoa)).exists()

    r = client.delete(f"/api/v1/anh/{d['id']}")
    assert r.status_code == 200 and r.json()["id"] == d["id"]

    assert not MocAnh.objects.filter(pk=d["id"]).exists()
    assert file_trong(phuc_vu) == set(), "hàng đi rồi mà file còn = đĩa đầy dần, không ai biết"


@pytest.mark.django_db
def test_xoa_anh_khong_ton_tai_thi_404(client, nguoi_a):
    client.force_login(nguoi_a)
    r = client.delete("/api/v1/anh/999999")
    assert r.status_code == 404 and r.json()["code"] == KHONG_TIM_THAY


# --- A9: bia mộ / bị ẩn ⇒ ảnh rời cả API lẫn kho đang phục vụ ------------------


@pytest.mark.django_db
def test_A9_xoa_moc_thi_anh_bien_khoi_API_va_roi_kho_phuc_vu(
    client, nguoi_a, moc_a, kho_anh
):
    """Hai vế, và vế thứ hai là vế người ta quên.

    Vế API (`anhs == []`) một mình là **không đủ**: prod cho Caddy phục vụ file thẳng từ
    đĩa, không qua Django, nên ai đã có URL vẫn tải được. Vế đĩa là thứ làm URL cũ chết.
    """
    client.force_login(nguoi_a)
    d = tai_len(client, moc_a.pk)
    khoa = MocAnh.objects.get(pk=d["id"]).khoa_luu_tru
    phuc_vu, cach_ly = kho_anh

    xoa_moc(moc=moc_a)

    mach = lay(client, f"/api/v1/machs/{moc_a.mach_id}")
    moc = next(m for m in mach["mocs"] if m["id"] == moc_a.pk)
    assert moc["trang_thai"] == "da_xoa" and moc["anhs"] == []

    assert file_trong(phuc_vu) == set(), "URL cũ vẫn phục vụ được = ảnh chưa bị gỡ thật"
    assert file_trong(cach_ly) == {khoa}
    assert MocAnh.objects.get(pk=d["id"]).da_cach_ly is True


@pytest.mark.django_db
def test_A9_mod_an_moc_roi_go_an_thi_anh_quay_lai_nguyen_ven(
    client, nguoi_a, moc_a, kho_anh
):
    """Ẩn của mod **đảo ngược được** (PLAN 5.10) ⇒ lượt chuyển file cũng phải đảo ngược.

    `khoa_luu_tru` không đổi trong suốt quá trình — chỉ kho chứa nó đổi — nên URL cũ
    sống lại y nguyên, không phải một URL mới.
    """
    client.force_login(nguoi_a)
    d = tai_len(client, moc_a.pk)
    khoa = MocAnh.objects.get(pk=d["id"]).khoa_luu_tru
    url_truoc = d["url"]
    phuc_vu, cach_ly = kho_anh

    dat_an_moc(moc=moc_a, boi=nguoi_a, an=True)
    assert file_trong(phuc_vu) == set() and file_trong(cach_ly) == {khoa}
    mach = lay(client, f"/api/v1/machs/{moc_a.mach_id}")
    assert next(m for m in mach["mocs"] if m["id"] == moc_a.pk)["anhs"] == []

    moc_a.refresh_from_db()
    dat_an_moc(moc=moc_a, boi=nguoi_a, an=False)
    assert file_trong(phuc_vu) == {khoa} and file_trong(cach_ly) == set()
    mach = lay(client, f"/api/v1/machs/{moc_a.mach_id}")
    anhs = next(m for m in mach["mocs"] if m["id"] == moc_a.pk)["anhs"]
    assert [a["url"] for a in anhs] == [url_truoc]
    assert MocAnh.objects.get(pk=d["id"]).da_cach_ly is False


@pytest.mark.django_db
def test_A9_an_ca_mach_keo_theo_anh_cua_moi_moc(client, nguoi_a, mach_cua_a, moc_a, kho_anh):
    from core.models.moc import Moc

    moc_1 = Moc.objects.get(mach=mach_cua_a, seq=1)
    client.force_login(nguoi_a)
    khoas = set()
    for m in (moc_1, moc_a):
        d = tai_len(client, m.pk)
        khoas.add(MocAnh.objects.get(pk=d["id"]).khoa_luu_tru)

    phuc_vu, cach_ly = kho_anh
    assert file_trong(phuc_vu) == khoas

    dat_an_mach(mach=mach_cua_a, boi=nguoi_a, an=True)
    assert file_trong(phuc_vu) == set() and file_trong(cach_ly) == khoas

    mach_cua_a.refresh_from_db()
    dat_an_mach(mach=mach_cua_a, boi=nguoi_a, an=False)
    assert file_trong(phuc_vu) == khoas and file_trong(cach_ly) == set()


@pytest.mark.django_db
def test_A9_go_an_MACH_khong_phuc_vu_lai_anh_cua_moc_van_dang_bi_an(
    client, nguoi_a, mach_cua_a, moc_a, kho_anh
):
    """Ca chồng trạng thái — chỗ một cách làm ngây thơ sẽ rò rỉ.

    Mốc bị ẩn RIÊNG, rồi cả mạch bị ẩn, rồi mạch được gỡ ẩn. Nếu lượt gỡ ẩn mạch chỉ
    "đưa mọi ảnh về kho phục vụ" thì ảnh của mốc vẫn-đang-bị-ẩn được phục vụ trở lại,
    trong khi API vẫn nói nó không tồn tại. `dong_bo_kho_anh` hỏi trạng thái THẬT của
    từng mốc nên nó không dính.
    """
    client.force_login(nguoi_a)
    khoa = MocAnh.objects.get(pk=tai_len(client, moc_a.pk)["id"]).khoa_luu_tru
    phuc_vu, cach_ly = kho_anh

    dat_an_moc(moc=moc_a, boi=nguoi_a, an=True)
    dat_an_mach(mach=mach_cua_a, boi=nguoi_a, an=True)
    mach_cua_a.refresh_from_db()
    dat_an_mach(mach=mach_cua_a, boi=nguoi_a, an=False)

    assert file_trong(phuc_vu) == set(), "ảnh của mốc còn đang bị ẩn đã được phục vụ lại"
    assert file_trong(cach_ly) == {khoa}


@pytest.mark.django_db
def test_A9_xoa_anh_dang_bi_cach_ly_van_xoa_duoc_file(client, nguoi_a, moc_a, kho_anh):
    """`xoa_anh_that` phải quét CẢ HAI kho — ảnh của mốc bị ẩn nằm ở kho cách ly.

    Xoá mỗi kho đang phục vụ thì file ở kho kia nằm lại vĩnh viễn: không cửa nào hiện,
    không ai đếm. Đúng loài rác `don_anh_mo_coi` sinh ra để tìm.
    """
    client.force_login(nguoi_a)
    anh_id = tai_len(client, moc_a.pk)["id"]
    dat_an_moc(moc=moc_a, boi=nguoi_a, an=True)
    phuc_vu, cach_ly = kho_anh
    assert file_trong(cach_ly)

    from core.ghi import xoa_anh_moc

    xoa_anh_moc(anh=MocAnh.objects.get(pk=anh_id))
    assert file_trong(phuc_vu) == set() and file_trong(cach_ly) == set()
