"""Di trú khoá ảnh phẳng cũ sang phân cấp thư mục yyyy/mm/dd — Track 5.

Di chuyển cả ảnh chính và thumbnail từ:
  anh/<khoa> -> anh/<yyyy>/<mm>/<dd>/<khoa>
  anh-thumb/<khoa> -> anh-thumb/<yyyy>/<mm>/<dd>/<khoa>

Cập nhật tương ứng vào:
  - `MocAnh.khoa_luu_tru`
  - `AnhNoiDung.khoa_luu_tru`
  - `User.avatar_khoa`
  - `<img src="...">` trong `Moc.body` và `MocRevision.body`
"""

import re
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.management.base import BaseCommand
from django.utils import timezone

from core.anh_luu import THU_MUC_ANH, THU_MUC_THUMB, kho_an, kho_hien
from core.models.moc import AnhNoiDung, Moc, MocAnh, MocRevision
from core.models.nguoi_dung import User
from core.thoi_gian import TZ_VN

PATTERN_PHAN_CAP = re.compile(r"^\d{4}/\d{2}/\d{2}/")


class Command(BaseCommand):
    help = "Di chuyển ảnh phẳng cũ vào cấu trúc thư mục phân cấp yyyy/mm/dd."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Chỉ liệt kê thao tác sẽ thực hiện, không ghi đè DB hay di chuyển file.",
        )
        parser.add_argument(
            "--giu-ban-cu",
            action="store_true",
            help="Giữ lại bản sao ở đường dẫn phẳng cũ (cho cache trình duyệt / CDN).",
        )

    def handle(self, *args, **tuy_chon):
        dry_run = tuy_chon["dry_run"]
        giu_ban_cu = tuy_chon["giu_ban_cu"]

        dau = "[--dry-run] " if dry_run else ""
        self.stdout.write(f"{dau}Bắt đầu rà soát và phân cấp ảnh theo ngày...")

        dem_moc_anh = 0
        dem_anh_nd = 0
        dem_avatar = 0
        dem_moc_body = 0
        anh_xa_url: dict[str, str] = {}

        # 1. MocAnh
        for hang in MocAnh.objects.all().order_by("id"):
            khoa_cu = hang.khoa_luu_tru
            if not khoa_cu or PATTERN_PHAN_CAP.match(khoa_cu):
                continue
            khi = hang.created_at or timezone.now()
            ngay_vn_str = timezone.localtime(khi, TZ_VN).strftime("%Y/%m/%d")
            khoa_moi_val = f"{ngay_vn_str}/{khoa_cu.lstrip('/')}"

            dem_moc_anh += 1
            kho = kho_an() if hang.da_cach_ly else kho_hien()
            self.stdout.write(f"  MocAnh#{hang.pk}: {khoa_cu} -> {khoa_moi_val}")

            if not dry_run:
                _di_chuyen_file_khoa(kho, khoa_cu, khoa_moi_val, giu_ban_cu=giu_ban_cu)
                hang.khoa_luu_tru = khoa_moi_val
                hang.save(update_fields=["khoa_luu_tru"])

        # 2. AnhNoiDung
        kho_phuc_vu = kho_hien()
        for hang in AnhNoiDung.objects.all().order_by("id"):
            khoa_cu = hang.khoa_luu_tru
            if not khoa_cu or PATTERN_PHAN_CAP.match(khoa_cu):
                continue
            khi = hang.created_at or timezone.now()
            ngay_vn_str = timezone.localtime(khi, TZ_VN).strftime("%Y/%m/%d")
            khoa_moi_val = f"{ngay_vn_str}/{khoa_cu.lstrip('/')}"

            dem_anh_nd += 1
            anh_xa_url[khoa_cu] = khoa_moi_val
            self.stdout.write(f"  AnhNoiDung#{hang.pk}: {khoa_cu} -> {khoa_moi_val}")

            if not dry_run:
                _di_chuyen_file_khoa(kho_phuc_vu, khoa_cu, khoa_moi_val, giu_ban_cu=giu_ban_cu)
                hang.khoa_luu_tru = khoa_moi_val
                hang.save(update_fields=["khoa_luu_tru"])

        # 3. User.avatar_khoa
        for user in User.objects.exclude(avatar_khoa="").order_by("id"):
            khoa_cu = user.avatar_khoa
            if not khoa_cu or PATTERN_PHAN_CAP.match(khoa_cu):
                continue
            khi = user.date_joined or timezone.now()
            ngay_vn_str = timezone.localtime(khi, TZ_VN).strftime("%Y/%m/%d")
            khoa_moi_val = f"{ngay_vn_str}/{khoa_cu.lstrip('/')}"

            dem_avatar += 1
            self.stdout.write(f"  User@{user.username} avatar: {khoa_cu} -> {khoa_moi_val}")

            if not dry_run:
                _di_chuyen_file_khoa(kho_phuc_vu, khoa_cu, khoa_moi_val, giu_ban_cu=giu_ban_cu)
                user.avatar_khoa = khoa_moi_val
                user.save(update_fields=["avatar_khoa"])

        # 4. Cập nhật URL trong Moc.body và MocRevision.body
        media_url = settings.MEDIA_URL.rstrip("/")
        prefix_cu = f"{media_url}/{THU_MUC_ANH}/"
        for khoa_cu, khoa_moi_val in anh_xa_url.items():
            url_cu = f"{prefix_cu}{khoa_cu}"
            url_moi = f"{prefix_cu}{khoa_moi_val}"

            for moc in Moc.objects.filter(body__contains=url_cu):
                dem_moc_body += 1
                self.stdout.write(f"  Cập nhật Moc#{moc.pk}: {url_cu} -> {url_moi}")
                if not dry_run:
                    moc.body = moc.body.replace(url_cu, url_moi)
                    moc.save(update_fields=["body"])

            for rev in MocRevision.objects.filter(body__contains=url_cu):
                if not dry_run:
                    rev.body = rev.body.replace(url_cu, url_moi)
                    rev.save(update_fields=["body"])

        self.stdout.write(
            self.style.SUCCESS(
                f"{dau}Hoàn tất phân cấp: {dem_moc_anh} MocAnh · {dem_anh_nd} AnhNoiDung · "
                f"{dem_avatar} Avatar · {dem_moc_body} Moc.body"
            )
        )


def _di_chuyen_file_khoa(kho, khoa_cu: str, khoa_moi: str, *, giu_ban_cu: bool = False) -> None:
    """Di chuyển cả file chính và thumbnail của một khoá sang đường dẫn mới."""
    for thu_muc in (THU_MUC_ANH, THU_MUC_THUMB):
        duong_dan_cu = f"{thu_muc}/{khoa_cu}"
        duong_dan_moi = f"{thu_muc}/{khoa_moi}"

        if not kho.exists(duong_dan_cu):
            continue

        if kho.exists(duong_dan_moi):
            kho.delete(duong_dan_moi)

        with kho.open(duong_dan_cu, "rb") as f:
            kho.save(duong_dan_moi, ContentFile(f.read()))

        if not giu_ban_cu:
            kho.delete(duong_dan_cu)
