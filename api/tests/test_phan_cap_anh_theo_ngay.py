"""Kiểm chứng lệnh `manage.py phan_cap_anh_theo_ngay` — Track 5.

Di chuyển toàn bộ ảnh phẳng cũ sang cấu trúc thư mục yyyy/mm/dd:
- Cập nhật khoá MocAnh, AnhNoiDung, User.avatar_khoa
- Cập nhật <img src="..."> trong Moc.body
- Di chuyển file thật trên storage
- Idempotent: chạy lại lần 2 không gây lỗi và không đổi gì thêm.
"""

from io import StringIO
import re
import pytest
from django.core.files.base import ContentFile
from django.core.management import call_command
from django.utils import timezone

from core.anh_luu import (
    THU_MUC_ANH,
    THU_MUC_THUMB,
    kho_hien,
)
from core.models.dien_dan import Sub
from core.models.moc import AnhNoiDung, Moc, MocAnh
from core.models.nguoi_dung import User
from core.thoi_gian import TZ_VN

from .conftest import dung_user, file_trong

pytestmark = pytest.mark.usefixtures("kho_anh")


def phan_cap(**cờ) -> str:
    ra = StringIO()
    call_command("phan_cap_anh_theo_ngay", stdout=ra, **cờ)
    return ra.getvalue()


@pytest.mark.django_db
def test_phan_cap_anh_toan_dien(kho_anh):
    phuc_vu, _ = kho_anh
    kho = kho_hien()
    user = dung_user("user_phan_cap")
    sub = Sub.objects.create(slug="sub-pc", ten="Sub PC")
    from core.ghi import tao_mach

    mach, moc = tao_mach(
        sub=sub,
        author=user,
        title="Mạch test phân cấp",
        body='<p>Mở đầu bài viết</p><img src="/media/anh/anh_nd_cu.webp"><p>Kết thúc</p>',
    )

    # 1. Dựng dữ liệu phẳng cũ
    khoa_moc_cu = "anh_moc_cu.jpg"
    khoa_nd_cu = "anh_nd_cu.webp"
    khoa_avatar_cu = "avatar_cu.jpg"

    for thu_muc in (THU_MUC_ANH, THU_MUC_THUMB):
        kho.save(f"{thu_muc}/{khoa_moc_cu}", ContentFile(b"moc_content"))
        kho.save(f"{thu_muc}/{khoa_nd_cu}", ContentFile(b"nd_content"))
        kho.save(f"{thu_muc}/{khoa_avatar_cu}", ContentFile(b"avatar_content"))

    hang_moc = MocAnh.objects.create(moc=moc, khoa_luu_tru=khoa_moc_cu, status=MocAnh.TrangThai.XAC_NHAN)
    hang_nd = AnhNoiDung.objects.create(nguoi_tai=user, khoa_luu_tru=khoa_nd_cu)
    user.avatar_khoa = khoa_avatar_cu
    user.save(update_fields=["avatar_khoa"])

    # 2. Chạy thử với --dry-run
    ra_dry = phan_cap(dry_run=True)
    assert "[--dry-run]" in ra_dry
    assert "1 MocAnh · 1 AnhNoiDung · 1 Avatar · 1 Moc.body" in ra_dry

    # Khẳng định DB và file chưa đổi sau dry-run
    hang_moc.refresh_from_db()
    assert hang_moc.khoa_luu_tru == khoa_moc_cu
    assert file_trong(phuc_vu) == {khoa_moc_cu, khoa_nd_cu, khoa_avatar_cu}

    # 3. Chạy thật
    ra_that = phan_cap()
    assert "[--dry-run]" not in ra_that
    assert "Hoàn tất phân cấp: 1 MocAnh · 1 AnhNoiDung · 1 Avatar · 1 Moc.body" in ra_that

    # Kiểm tra DB đã cập nhật khoá mới có dạng yyyy/mm/dd/...
    hang_moc.refresh_from_db()
    hang_nd.refresh_from_db()
    user.refresh_from_db()
    moc.refresh_from_db()

    regex_pc = r"^\d{4}/\d{2}/\d{2}/"
    assert re.match(regex_pc, hang_moc.khoa_luu_tru)
    assert hang_moc.khoa_luu_tru.endswith(khoa_moc_cu)

    assert re.match(regex_pc, hang_nd.khoa_luu_tru)
    assert hang_nd.khoa_luu_tru.endswith(khoa_nd_cu)

    assert re.match(regex_pc, user.avatar_khoa)
    assert user.avatar_khoa.endswith(khoa_avatar_cu)

    # Kiểm tra Moc.body đã được thay thế URL mới
    assert f"/media/anh/{hang_nd.khoa_luu_tru}" in moc.body
    assert f"/media/anh/{khoa_nd_cu}" not in moc.body

    # Kiểm tra file trên đĩa đã ở đường dẫn mới và file cũ đã xoá
    tap_file = file_trong(phuc_vu)
    assert tap_file == {hang_moc.khoa_luu_tru, hang_nd.khoa_luu_tru, user.avatar_khoa}
    assert khoa_moc_cu not in tap_file
    assert khoa_nd_cu not in tap_file
    assert khoa_avatar_cu not in tap_file

    # 4. Idempotent: Chạy lại lần 2 không làm gì thêm
    ra_lan2 = phan_cap()
    assert "0 MocAnh · 0 AnhNoiDung · 0 Avatar · 0 Moc.body" in ra_lan2


@pytest.mark.django_db
def test_phan_cap_giu_ban_cu(kho_anh):
    """Cờ --giu-ban-cu giữ lại bản sao ở vị trí phẳng cũ."""
    phuc_vu, _ = kho_anh
    kho = kho_hien()
    user = dung_user("user_giu_ban_cu")

    khoa_cu = "test_giu.jpg"
    for thu_muc in (THU_MUC_ANH, THU_MUC_THUMB):
        kho.save(f"{thu_muc}/{khoa_cu}", ContentFile(b"data"))

    hang_nd = AnhNoiDung.objects.create(nguoi_tai=user, khoa_luu_tru=khoa_cu)

    phan_cap(giu_ban_cu=True)

    hang_nd.refresh_from_db()
    assert hang_nd.khoa_luu_tru.endswith(khoa_cu)

    # Cả khoá mới lẫn khoá cũ đều có mặt trên đĩa
    tap_file = file_trong(phuc_vu)
    assert khoa_cu in tap_file
    assert hang_nd.khoa_luu_tru in tap_file
