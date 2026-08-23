"""Dựng lại chỉ mục tìm kiếm từ Postgres — lệnh đối soát của Phase 7.

Đây là thứ làm cho câu "Meilisearch không phải nguồn sự thật" thành một sự thật kiểm được
chứ không phải một lời hứa: **xoá sạch index rồi chạy lệnh này phải dựng lại đủ**, và vì
thế Meilisearch **không cần sao lưu riêng** (`docs/sao-luu-phuc-hoi.md`).

Chạy được bất cứ lúc nào, bao nhiêu lần cũng được. Ba tình huống nó tồn tại để chữa:

- `on_commit` chết giữa chừng (tiến trình bị giết, Meili đang restart) ⇒ index thiếu vài
  tài liệu, không có gì báo;
- đổi cấu hình index (thêm trường tìm được) ⇒ tài liệu cũ thiếu trường mới;
- dựng máy mới / khôi phục từ bản sao lưu Postgres ⇒ index rỗng.

    node scripts/py.mjs reindex_tim_kiem            # đẩy lại mọi mạch đang hiện
    node scripts/py.mjs reindex_tim_kiem --sach     # xoá index trước rồi dựng lại
"""

from django.core.management.base import BaseCommand, CommandError

from core.models.dien_dan import Mach
from core.tim_kiem import (
    TEN_INDEX,
    MeiliHong,
    cau_hinh_index,
    day_lo,
    hien_cong_khai,
    suc_khoe,
    tai_lieu,
    xoa_index,
)

#: Số tài liệu mỗi lần đẩy. Meilisearch nhận lô lớn tốt hơn nhiều lời gọi lẻ, nhưng một
#: lô quá to là một body JSON vài chục MB nằm trong RAM của cả hai tiến trình.
CO_LO = 500


class Command(BaseCommand):
    help = "Dựng lại chỉ mục tìm kiếm Meilisearch từ Postgres."

    def add_arguments(self, parser):
        parser.add_argument(
            "--sach",
            action="store_true",
            help=(
                "Xoá hẳn index trước khi dựng lại. Dùng khi cấu hình index đổi, hoặc "
                "khi nghi index còn tài liệu ma của mạch đã bị xoá cứng."
            ),
        )

    def handle(self, *args, **tuy_chon):
        if not suc_khoe():
            # `CommandError` chứ không log rồi thoát 0: đây là lệnh **đối soát**, và một
            # lệnh đối soát báo thành công khi nó không làm gì là thứ nguy hiểm hơn cả
            # việc không có lệnh nào — cron sẽ xanh mãi mãi trên một index rỗng.
            raise CommandError(
                "Meilisearch không trả lời (hoặc MEILI_URL/MEILI_KEY chưa đặt). "
                "Không có gì được dựng lại."
            )

        if tuy_chon["sach"]:
            try:
                xoa_index()
            except MeiliHong as loi:
                # Index chưa tồn tại thì xoá là 404 — đó là trạng thái mong muốn, không
                # phải lỗi. Mọi lỗi khác thì dừng: dựng tiếp lên một index hỏng là dựng
                # ra một kết quả không ai đọc được.
                if "404" not in str(loi):
                    raise CommandError(f"Xoá index hỏng: {loi}") from loi
            self.stdout.write("Đã xoá index cũ.")

        try:
            cau_hinh_index()
        except MeiliHong as loi:
            raise CommandError(f"Cấu hình index hỏng: {loi}") from loi

        dem = self._day_het()
        self.stdout.write(
            self.style.SUCCESS(f"Đã đẩy {dem} mạch vào index {TEN_INDEX!r}.")
        )

    def _day_het(self) -> int:
        """Đẩy mọi mạch ĐANG HIỆN, theo lô. Trả số tài liệu đã đẩy.

        Lọc bằng `hien_cong_khai` chứ không tự viết `hidden_at__isnull=True`: đó là cùng
        một hàm mà đường ghi dùng để quyết upsert-hay-xoá, nên lệnh đối soát và đường ghi
        không thể lệch nhau về định nghĩa "hiện".
        """
        lo: list[dict] = []
        dem = 0
        for mach in (
            Mach.objects.select_related("sub", "author").order_by("pk").iterator()
        ):
            if not hien_cong_khai(mach):
                continue
            lo.append(tai_lieu(mach))
            if len(lo) >= CO_LO:
                dem += self._day_lo(lo)
                lo = []
        if lo:
            dem += self._day_lo(lo)
        return dem

    def _day_lo(self, lo: list[dict]) -> int:
        try:
            day_lo(lo)
        except MeiliHong as loi:
            raise CommandError(f"Đẩy lô hỏng: {loi}") from loi
        self.stdout.write(f"  … {len(lo)} tài liệu")
        return len(lo)
