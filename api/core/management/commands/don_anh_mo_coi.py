"""Dọn file ảnh mồ côi — Phase 5, tiêu chí A8.

**Mồ côi** = file nằm trên đĩa mà không hàng `MocAnh` nào trỏ tới. Nó sinh ra từ những
ca mà đường ghi không tự dọn được:

- tiến trình chết giữa `ghi_anh` và `COMMIT` (lưới `try/except` của `them_anh_moc` không
  chạy khi tiến trình bị `kill -9` hay mất điện);
- `xoa_anh_that` gặp đĩa lỗi và chỉ ghi log (nó cố ý **không** để lỗi xoá file nuốt mất
  lời xoá hàng DB — xem docstring của nó);
- ai đó dọn tay hoặc phục hồi một bản sao lưu cũ hơn cây file.

Chiều **ngược lại** cũng được báo: hàng `MocAnh` còn mà file mất. Lệnh **không bao giờ
xoá hàng DB** — chỉ nêu ra. Một cột `khoa_luu_tru` trỏ vào hư không là thẻ `<img>` gãy,
tệ; nhưng tự xoá hàng theo phán đoán của một lệnh dọn thì mất dữ liệu, tệ hơn hẳn.

⚠ **`--dry-run` là mặc định của lối nghĩ, không phải của cờ**: lệnh này xoá thật khi
không có cờ. Nhưng nó chỉ đụng tới file **cũ hơn `--tuoi-toi-thieu` giờ** (mặc định 24),
và ràng buộc đó là thứ giữ nó an toàn khi chạy trên máy đang phục vụ: một ảnh vừa được
`ghi_anh` ghi ra mà transaction chưa commit trông y hệt một file mồ côi.
"""

from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core.anh_luu import THU_MUC_ANH, THU_MUC_THUMB, kho_an, kho_hien
from core.models.moc import MocAnh

#: Số giờ tối thiểu một file phải "già" trước khi được coi là mồ côi. Xem docstring module.
TUOI_TOI_THIEU_GIO = 24


class Command(BaseCommand):
    help = "Dọn file ảnh không còn hàng MocAnh nào trỏ tới (mặc định XOÁ THẬT)."

    def add_arguments(self, parser):
        parser.add_argument(
            "--dry-run",
            action="store_true",
            help="Chỉ liệt kê, không xoá gì.",
        )
        parser.add_argument(
            "--tuoi-toi-thieu",
            type=int,
            default=TUOI_TOI_THIEU_GIO,
            metavar="GIỜ",
            help=(
                f"Chỉ đụng file cũ hơn ngần này giờ (mặc định {TUOI_TOI_THIEU_GIO}). "
                "`0` là bỏ hàng rào — chỉ dùng khi chắc chắn không có upload nào đang chạy."
            ),
        )

    def handle(self, *args, **tuy_chon):
        thu = tuy_chon["dry_run"]
        nguong = timezone.now() - timedelta(hours=tuy_chon["tuoi_toi_thieu"])

        # Khoá của MỌI hàng, kèm nơi hàng đó NÓI file đang nằm. Một khoá ở đúng kho của
        # nó là hợp lệ; cùng khoá ấy ở kho KIA là bản sao mồ côi (một lượt chuyển kho
        # chết giữa chừng để lại đúng thứ này).
        hop_le_hien: set[str] = set()
        hop_le_an: set[str] = set()
        for khoa, cach_ly in MocAnh.objects.values_list("khoa_luu_tru", "da_cach_ly"):
            (hop_le_an if cach_ly else hop_le_hien).add(khoa)

        tong_xoa = tong_giu = 0
        for ten_kho, kho, hop_le in (
            ("phục vụ", kho_hien(), hop_le_hien),
            ("cách ly", kho_an(), hop_le_an),
        ):
            for thu_muc in (THU_MUC_ANH, THU_MUC_THUMB):
                try:
                    _, files = kho.listdir(thu_muc)
                except (FileNotFoundError, OSError):
                    continue
                for ten in files:
                    if ten in hop_le:
                        continue
                    duong_dan = f"{thu_muc}/{ten}"
                    if tuy_chon["tuoi_toi_thieu"] and _con_moi(kho, duong_dan, nguong):
                        tong_giu += 1
                        self.stdout.write(
                            f"  bỏ qua (còn mới) [{ten_kho}] {duong_dan}"
                        )
                        continue
                    tong_xoa += 1
                    self.stdout.write(
                        f"  {'sẽ xoá' if thu else 'ĐÃ XOÁ'} [{ten_kho}] {duong_dan}"
                    )
                    if not thu:
                        kho.delete(duong_dan)

        # Chiều ngược: hàng còn, file mất. Chỉ NÊU, không bao giờ xoá hàng.
        thieu = []
        for hang in MocAnh.objects.all().only("id", "khoa_luu_tru", "da_cach_ly"):
            kho = kho_an() if hang.da_cach_ly else kho_hien()
            for thu_muc in (THU_MUC_ANH, THU_MUC_THUMB):
                if not kho.exists(f"{thu_muc}/{hang.khoa_luu_tru}"):
                    thieu.append(f"MocAnh#{hang.pk} thiếu {thu_muc}/{hang.khoa_luu_tru}")

        for d in thieu:
            self.stdout.write(self.style.WARNING(f"  hàng còn / file MẤT: {d}"))

        dau = "[--dry-run] " if thu else ""
        self.stdout.write(
            self.style.SUCCESS(
                f"{dau}mồ côi: {tong_xoa} file{' sẽ bị xoá' if thu else ' đã xoá'} · "
                f"giữ vì còn mới: {tong_giu} · hàng thiếu file: {len(thieu)}"
            )
        )


def _con_moi(kho, duong_dan: str, nguong) -> bool:
    """File này mới hơn ngưỡng ⇒ có thể là một upload đang dở, đừng đụng.

    Backend không hỗ trợ `get_modified_time` (một số storage đám mây) ⇒ coi là **còn
    mới**, tức là không xoá. Mặc định an toàn: bỏ sót một file rác chỉ tốn đĩa, xoá nhầm
    một ảnh đang được ghi thì mất dữ liệu của người dùng.
    """
    try:
        return kho.get_modified_time(duong_dan) > nguong
    except (NotImplementedError, OSError, AttributeError):
        return True
