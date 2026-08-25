"""`manage.py don_anh_mo_coi` — A8, vế "command dọn mồ côi chạy được, có `--dry-run`".

Lệnh này là lưới hứng cho những ca đường ghi không tự dọn được (tiến trình chết giữa
`ghi_anh` và `COMMIT`, đĩa lỗi lúc xoá). Nó xoá file thật, nên bộ đo ở đây dày về phía
**không được xoá nhầm**: `--dry-run` không đụng gì, file còn mới không đụng, và hàng DB
thì không bao giờ bị xoá.
"""

from io import StringIO

import pytest
from django.core.files.base import ContentFile
from django.core.management import call_command

from core.anh import xu_ly_anh_tai_len
from core.anh_luu import (
    THU_MUC_ANH,
    THU_MUC_THUMB,
    an_anh,
    duong_dan_chinh,
    kho_an,
    kho_hien,
)
from core.ghi import tao_mach, them_anh_moc, them_moc
from core.models.moc import MocAnh

from ._anh import anh_byte
from .conftest import dung_user, file_trong, so_file

pytestmark = pytest.mark.usefixtures("kho_anh")


def don(**cờ) -> str:
    ra = StringIO()
    call_command("don_anh_mo_coi", stdout=ra, **cờ)
    return ra.getvalue()


@pytest.fixture
def moc(db):
    from core.models.dien_dan import Sub

    sub = Sub.objects.create(slug="ck-don", ten="Chứng khoán")
    tac_gia = dung_user("chu_don")
    mach, _ = tao_mach(sub=sub, author=tac_gia, title="Nhật ký", body="Mốc 1.")
    return them_moc(mach=mach, author=tac_gia, body="Mốc 2.")


def _rac(ten: str = "rac-mo-coi.jpg", *, kho=None) -> str:
    """Dựng một file KHÔNG hàng `MocAnh` nào trỏ tới — đúng định nghĩa mồ côi."""
    kho = kho or kho_hien()
    kho.save(f"{THU_MUC_ANH}/{ten}", ContentFile(b"rac"))
    kho.save(f"{THU_MUC_THUMB}/{ten}", ContentFile(b"rac"))
    return ten


@pytest.mark.django_db
def test_dry_run_KHONG_xoa_gi(kho_anh, moc):
    phuc_vu, _ = kho_anh
    them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(anh_byte()))
    _rac()
    truoc = so_file(phuc_vu)

    ra = don(dry_run=True, tuoi_toi_thieu=0)

    assert so_file(phuc_vu) == truoc, "--dry-run mà vẫn xoá thì cờ này vô nghĩa"
    assert "sẽ xoá" in ra and "ĐÃ XOÁ" not in ra
    assert "2 file sẽ bị xoá" in ra


@pytest.mark.django_db
def test_xoa_that_file_mo_coi_va_GIU_NGUYEN_anh_that(kho_anh, moc):
    phuc_vu, _ = kho_anh
    hang = them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(anh_byte()))
    _rac()
    assert file_trong(phuc_vu) == {hang.khoa_luu_tru, "rac-mo-coi.jpg"}

    don(tuoi_toi_thieu=0)

    assert file_trong(phuc_vu) == {hang.khoa_luu_tru}, "ảnh THẬT bị xoá nhầm"
    assert MocAnh.objects.filter(pk=hang.pk).exists()


@pytest.mark.django_db
def test_file_con_moi_KHONG_bi_dung_toi(kho_anh, moc):
    """Hàng rào chính: một ảnh vừa `ghi_anh` mà transaction chưa commit trông y hệt mồ côi.

    Không có hàng rào tuổi thì chạy lệnh này trên máy đang phục vụ là xoá ảnh của người
    đang upload — và họ nhận 201, rồi thấy thẻ `<img>` gãy.
    """
    phuc_vu, _ = kho_anh
    _rac()
    truoc = so_file(phuc_vu)

    ra = don(tuoi_toi_thieu=24)

    assert so_file(phuc_vu) == truoc
    assert "bỏ qua (còn mới)" in ra


@pytest.mark.django_db
def test_anh_dang_CACH_LY_khong_bi_coi_la_mo_coi(kho_anh, moc):
    """Ảnh của mốc bị ẩn nằm ở kho cách ly — nó có hàng DB, nó KHÔNG mồ côi.

    Lệnh phải đọc `da_cach_ly` để biết hàng nói file nằm ở kho nào. Chỉ quét kho đang
    phục vụ rồi coi mọi thứ ở kho cách ly là rác là xoá sạch ảnh của mọi mốc bị mod ẩn —
    và ẩn của mod thì **đảo ngược được**, nên đó là mất dữ liệu thật.
    """
    _, cach_ly = kho_anh
    hang = them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(anh_byte()))
    an_anh(hang.khoa_luu_tru)
    MocAnh.objects.filter(pk=hang.pk).update(da_cach_ly=True)
    assert file_trong(cach_ly) == {hang.khoa_luu_tru}

    ra = don(tuoi_toi_thieu=0)

    assert file_trong(cach_ly) == {hang.khoa_luu_tru}, ra
    assert "0 file đã xoá" in ra


@pytest.mark.django_db
def test_ban_sao_o_SAI_kho_bi_coi_la_mo_coi(kho_anh, moc):
    """Cùng một khoá tồn tại ở CẢ HAI kho — dấu vết của một lượt chuyển kho chết giữa chừng.

    Bản ở kho mà hàng DB không nói tới là rác, và nó là loại rác nguy hiểm nhất: nếu bản
    thừa nằm ở kho **đang phục vụ** trong khi hàng nói "đã cách ly", thì ảnh của một mốc
    bị mod ẩn vẫn đang được Caddy phục vụ.
    """
    phuc_vu, cach_ly = kho_anh
    hang = them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(anh_byte()))
    khoa = hang.khoa_luu_tru
    # Chép sang kho cách ly mà KHÔNG xoá bản gốc, rồi đánh dấu hàng là đã cách ly.
    for thu_muc in (THU_MUC_ANH, THU_MUC_THUMB):
        with kho_hien().open(f"{thu_muc}/{khoa}", "rb") as f:
            kho_an().save(f"{thu_muc}/{khoa}", ContentFile(f.read()))
    MocAnh.objects.filter(pk=hang.pk).update(da_cach_ly=True)
    assert file_trong(phuc_vu) == {khoa} and file_trong(cach_ly) == {khoa}

    don(tuoi_toi_thieu=0)

    assert file_trong(phuc_vu) == set(), "bản thừa ở kho phục vụ vẫn đang lộ ra internet"
    assert file_trong(cach_ly) == {khoa}, "bản THẬT ở kho cách ly bị xoá nhầm"


@pytest.mark.django_db
def test_hang_con_ma_file_MAT_thi_bao_chu_khong_xoa_hang(kho_anh, moc):
    """Chiều ngược lại. Tự xoá hàng theo phán đoán của một lệnh dọn là mất dữ liệu."""
    hang = them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(anh_byte()))
    kho_hien().delete(duong_dan_chinh(hang.khoa_luu_tru))

    ra = don(tuoi_toi_thieu=0)

    assert f"MocAnh#{hang.pk} thiếu" in ra
    assert "hàng thiếu file: 1" in ra
    assert MocAnh.objects.filter(pk=hang.pk).exists(), "lệnh dọn KHÔNG được xoá hàng DB"


@pytest.mark.django_db
def test_chay_tren_kho_rong_khong_no(kho_anh):
    """Thư mục chưa tồn tại (chưa ai upload lần nào) — `listdir` ném, lệnh phải nuốt."""
    ra = don(tuoi_toi_thieu=0)
    assert "0 file đã xoá" in ra


@pytest.mark.django_db
def test_avatar_KHONG_bi_coi_la_mo_coi(kho_anh):
    """Avatar (2026-08-24) dùng CHUNG `anh/` + `anh-thumb/` với ảnh mốc nhưng khoá của nó
    nằm ở `User.avatar_khoa`, KHÔNG có hàng `MocAnh`.

    Thiếu whitelist thì lệnh coi mọi avatar cũ hơn 24 giờ là mồ côi và XOÁ THẬT — mất
    ảnh đại diện của cả cộng đồng trong một lượt cron. Bài đo này là cái chuông cho đúng
    dòng `hop_le_hien.update(User…avatar_khoa)` trong lệnh.
    """
    from core.avatar import dat_avatar

    phuc_vu, _ = kho_anh
    u = dung_user("co_avatar")
    dat_avatar(user=u, anh=xu_ly_anh_tai_len(anh_byte()))
    khoa = u.avatar_khoa
    assert file_trong(phuc_vu) == {khoa}

    ra = don(tuoi_toi_thieu=0)

    assert file_trong(phuc_vu) == {khoa}, "avatar bị xoá nhầm như mồ côi"
    assert "0 file đã xoá" in ra
    # Avatar không có `MocAnh` nên chiều "hàng còn/file mất" (chỉ lặp `MocAnh`) không đụng
    # tới nó — không báo động giả.
    assert "hàng thiếu file: 0" in ra


@pytest.mark.django_db
def test_anh_NOI_DUNG_KHONG_bi_coi_la_mo_coi(kho_anh):
    """Ảnh nhúng trong `Moc.body` (2026-08-24) — loài thứ BA dùng chung `anh/`.

    Nó không có hàng `MocAnh` (không thuộc mốc nào lúc tải lên) và không nằm ở
    `User.avatar_khoa`; khoá của nó ở bảng `AnhNoiDung`. Thiếu whitelist thì mọi ảnh giữa
    bài cũ hơn 24 giờ bị XOÁ THẬT và bài viết thủng lỗ — người đọc thấy `<img>` gãy, còn
    lệnh dọn thì báo "đã xoá n file mồ côi", nghe như đúng việc của nó.

    Bài đo này là cái chuông cho đúng dòng `hop_le_hien.update(AnhNoiDung…)`.
    """
    from core.anh_noi_dung import luu_anh_noi_dung

    phuc_vu, _ = kho_anh
    u = dung_user("nguoi_nhung_anh")
    hang = luu_anh_noi_dung(user=u, anh=xu_ly_anh_tai_len(anh_byte()))
    assert file_trong(phuc_vu) == {hang.khoa_luu_tru}

    ra = don(tuoi_toi_thieu=0)

    assert file_trong(phuc_vu) == {hang.khoa_luu_tru}, "ảnh nội dung bị xoá nhầm như mồ côi"
    assert "0 file đã xoá" in ra
    assert "hàng thiếu file: 0" in ra


@pytest.mark.django_db
def test_anh_noi_dung_mat_hang_thi_LAI_la_mo_coi(kho_anh):
    """Đối chứng — nếu không có bài này thì whitelist trên có thể là "giữ hết".

    Xoá hàng `AnhNoiDung` mà để file lại (ca thật: ai đó dọn hàng bằng `shell`) ⇒ file
    quay về đúng định nghĩa mồ côi và phải bị xoá.
    """
    from core.anh_noi_dung import luu_anh_noi_dung
    from core.models.moc import AnhNoiDung

    phuc_vu, _ = kho_anh
    u = dung_user("nguoi_nhung_anh_2")
    hang = luu_anh_noi_dung(user=u, anh=xu_ly_anh_tai_len(anh_byte()))
    AnhNoiDung.objects.filter(pk=hang.pk).delete()

    don(tuoi_toi_thieu=0)

    assert file_trong(phuc_vu) == set()
