"""Dựng lại + **ĐỐI SOÁT** chỉ mục tìm kiếm từ Postgres — Phase 7, mở rộng 2026-08-30.

Đây là thứ làm cho câu "Meilisearch không phải nguồn sự thật" thành một sự thật kiểm được
chứ không phải một lời hứa: **xoá sạch index rồi chạy lệnh này phải dựng lại đủ**, và vì
thế Meilisearch **không cần sao lưu riêng** (`docs/sao-luu-phuc-hoi.md`).

Chạy được bất cứ lúc nào, bao nhiêu lần cũng được. Ba tình huống nó tồn tại để chữa:

- `on_commit` chết giữa chừng (tiến trình bị giết, Meili đang restart) ⇒ index thiếu vài
  tài liệu, không có gì báo;
- đổi cấu hình index (thêm trường tìm được) ⇒ tài liệu cũ thiếu trường mới;
- dựng máy mới / khôi phục từ bản sao lưu Postgres ⇒ index rỗng.

    node scripts/py.mjs reindex_tim_kiem            # đối soát cả hai index
    node scripts/py.mjs reindex_tim_kiem --sach     # xoá cả hai index trước rồi dựng lại

## Hai chiều, và chiều THỨ HAI là chiều `P-20260827-2` (2026-08-30)

Bản Phase 7 chỉ biết **ĐẨY**. Nó phủ được vế "index thiếu", nhưng mù hoàn toàn với vế
"index THỪA" — mà thừa ở đây nghĩa là một tài liệu của mạch đã bị mod ẩn (hoặc xoá cứng)
còn nằm trong chỉ mục **vô thời hạn**: chỉ mục không hết hạn như cache. Hôm nay lớp lọc
Postgres ở `api/tim_kiem.py` vẫn che được nó ở đường đọc, nhưng "có hai lớp mà một lớp
hỏng vĩnh viễn" thì thực tế chỉ còn một lớp, và không ai biết.

`--sach` chữa được, nhưng nó là một lệnh **có rủi ro** (index rỗng trong vài giây, giữa
lúc site đang chạy) nên không ai đặt nó vào cron. Vì thế bước gỡ-ma nay là **mặc định**:
liệt kê id trong từng index, so với tập id công khai của Postgres, `DELETE` phần thừa.
Rẻ (một vòng phân trang `fields=id`), an toàn (chỉ xoá thứ Postgres nói là không được
hiện), và chạy được hằng đêm.

## Lệnh này NÉM, không nuốt

Ngược hẳn với đường ghi ở `core/tim_kiem.py`. Một lệnh đối soát báo thành công khi nó
không làm gì là thứ nguy hiểm hơn cả việc không có lệnh nào — cron sẽ xanh mãi mãi trên
một index rỗng, hoặc trên một `MEILI_KEY` không có quyền với index `binh_luan` (đúng
kịch bản `P-20260827-2`: khoá cũ chỉ khai `indexes: ["mach"]`).
"""

from django.core.management.base import BaseCommand, CommandError

from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.tim_kiem import (
    CAC_INDEX,
    TEN_INDEX,
    TEN_INDEX_BINH_LUAN,
    MeiliHong,
    cau_hinh_index,
    day_lo,
    hien_cong_khai,
    liet_ke_id,
    suc_khoe,
    tai_lieu,
    tai_lieu_binh_luan,
    xoa_index,
    xoa_theo_id,
)

#: Số tài liệu mỗi lần đẩy. Meilisearch nhận lô lớn tốt hơn nhiều lời gọi lẻ, nhưng một
#: lô quá to là một body JSON vài chục MB nằm trong RAM của cả hai tiến trình.
CO_LO = 500


class Command(BaseCommand):
    help = "Dựng lại + đối soát chỉ mục tìm kiếm Meilisearch (cả hai index) từ Postgres."

    def add_arguments(self, parser):
        parser.add_argument(
            "--sach",
            action="store_true",
            help=(
                "Xoá hẳn CẢ HAI index trước khi dựng lại. Dùng khi cấu hình index đổi. "
                "Không cần nó chỉ để dọn tài liệu ma — bước gỡ-ma nay chạy mặc định."
            ),
        )

    def handle(self, *args, **tuy_chon):
        if not suc_khoe():
            # `CommandError` chứ không log rồi thoát 0: xem docstring module.
            raise CommandError(
                "Meilisearch không trả lời (hoặc MEILI_URL/MEILI_KEY chưa đặt). "
                "Không có gì được dựng lại."
            )

        if tuy_chon["sach"]:
            try:
                xoa_index()
            except MeiliHong as loi:
                # `xoa_index` đã tự nuốt 404 (index chưa tồn tại là trạng thái mong
                # muốn). Mọi lỗi khác thì dừng: dựng tiếp lên một index hỏng là dựng ra
                # một kết quả không ai đọc được.
                raise CommandError(f"Xoá index hỏng: {loi}") from loi
            self.stdout.write("Đã xoá index cũ.")

        try:
            cau_hinh_index()
        except MeiliHong as loi:
            raise CommandError(f"Cấu hình index hỏng: {loi}") from loi

        so_mach = self._day_mach()
        so_binh_luan = self._day_binh_luan()
        so_ma = self._go_ma()

        self.stdout.write(
            self.style.SUCCESS(
                f"Đã đẩy {so_mach} mạch + {so_binh_luan} bình luận; gỡ {so_ma} ma."
            )
        )

    # --- ĐẨY -----------------------------------------------------------------

    def _day_mach(self) -> int:
        """Đẩy mọi mạch ĐANG HIỆN, theo lô. Trả số tài liệu đã đẩy.

        Lọc bằng `hien_cong_khai` chứ không tự viết `hidden_at__isnull=True`: đó là cùng
        một hàm mà đường ghi dùng để quyết upsert-hay-xoá, nên lệnh đối soát và đường ghi
        không thể lệch nhau về định nghĩa "hiện".
        """
        return self._day_theo_lo(
            TEN_INDEX,
            (
                tai_lieu(m)
                for m in Mach.objects.select_related("sub", "author")
                .order_by("pk")
                .iterator()
                if hien_cong_khai(m)
            ),
        )

    def _day_binh_luan(self) -> int:
        """Đẩy mọi bình luận ĐỌC ĐƯỢC, theo lô. Ba vế của luật che, cùng một chỗ.

        Lọc ở tầng SQL chứ không gọi `hien_cong_khai_binh_luan` cho từng hàng: vế thứ ba
        là một `JOIN` (`mach__hidden_at`), và hỏi nó bằng Python là một truy vấn cho mỗi
        bình luận của cả site. Ba vế ở đây phải khớp từng chữ với hàm ấy — chúng có bài
        đo đối chiếu ở `tests/test_tim_kiem_reindex.py`.
        """
        return self._day_theo_lo(
            TEN_INDEX_BINH_LUAN,
            (
                tai_lieu_binh_luan(c)
                for c in _binh_luan_cong_khai().order_by("pk").iterator()
            ),
        )

    def _day_theo_lo(self, index: str, tai_lieu_s) -> int:
        lo: list[dict] = []
        dem = 0
        for d in tai_lieu_s:
            lo.append(d)
            if len(lo) >= CO_LO:
                dem += self._day_mot_lo(index, lo)
                lo = []
        if lo:
            dem += self._day_mot_lo(index, lo)
        return dem

    def _day_mot_lo(self, index: str, lo: list[dict]) -> int:
        try:
            day_lo(lo, index=index)
        except MeiliHong as loi:
            raise CommandError(f"Đẩy lô vào {index!r} hỏng: {loi}") from loi
        self.stdout.write(f"  … {len(lo)} tài liệu → {index}")
        return len(lo)

    # --- GỠ MA ---------------------------------------------------------------

    def _go_ma(self) -> int:
        """Xoá mọi tài liệu mà Postgres nói là KHÔNG được hiện. Trả số đã gỡ.

        Chiều thứ hai của đối soát — xem docstring module. Chạy **sau** bước đẩy: đẩy
        trước rồi gỡ sau thì tập id công khai đã được phản ánh đủ, và một tài liệu vừa
        đẩy lên không bao giờ nằm trong danh sách "thừa" (nó có mặt trong tập Postgres
        theo đúng định nghĩa).

        Meilisearch nhận tài liệu **bất đồng bộ**, nên danh sách đọc về có thể chưa gồm
        lô vừa đẩy. Điều đó **không** làm sai chiều này: thiếu ở danh sách chỉ có nghĩa
        là ít ứng viên "thừa" hơn, và cái thiếu ấy đã được đẩy đúng ở bước trên.

        ⚠ **Tập `cong_khai` chụp TRƯỚC, `liet_ke_id` đọc SAU** — một tài liệu đăng GIỮA
        hai mốc chụp (đường ghi live `on_commit` đẩy nó vào index trong khi lệnh này
        đang chạy) là hàng công khai THẬT nhưng không có trong `cong_khai` cũ, tức lọt
        vào danh sách "thừa" và bị gỡ nhầm — reindex hằng đêm hoá ra tay xoá bài mới đăng
        (đúng loài `P-20260827-2` nhưng ngược chiều). Nên trước khi xoá, **xác nhận lại
        bằng một truy vấn Postgres NGAY LÚC NÀY** (`_xac_nhan_thua`): chỉ gỡ những id mà
        Postgres vẫn khẳng định là không được hiện. Cái giá là một `SELECT` cho mỗi index
        có ứng viên thừa; cái được là cửa sổ đua trên biến mất.
        """
        cong_khai = self._cong_khai_pg()
        dem = 0
        for index in CAC_INDEX:
            try:
                trong_index = liet_ke_id(index)
            except MeiliHong as loi:
                raise CommandError(f"Đọc id của {index!r} hỏng: {loi}") from loi
            ung_vien = sorted(trong_index - cong_khai[index])
            if not ung_vien:
                continue
            thua = self._xac_nhan_thua(index, ung_vien)
            if not thua:
                continue
            for i in range(0, len(thua), CO_LO):
                try:
                    xoa_theo_id(index, thua[i : i + CO_LO])
                except MeiliHong as loi:
                    raise CommandError(f"Gỡ ma khỏi {index!r} hỏng: {loi}") from loi
            self.stdout.write(f"  … gỡ {len(thua)} tài liệu ma khỏi {index}")
            dem += len(thua)
        return dem

    def _cong_khai_pg(self) -> dict[str, set[int]]:
        """Tập id CÔNG KHAI của mỗi index, chụp một lần ở đầu `_go_ma`."""
        return {
            TEN_INDEX: set(
                Mach.objects.filter(hidden_at__isnull=True).values_list(
                    "pk", flat=True
                )
            ),
            TEN_INDEX_BINH_LUAN: set(
                _binh_luan_cong_khai().values_list("pk", flat=True)
            ),
        }

    def _xac_nhan_thua(self, index: str, ung_vien: list[int]) -> list[int]:
        """Lọc `ung_vien` xuống những id Postgres XÁC NHẬN LẠI là không được hiện.

        Truy vấn NGAY LÚC NÀY, sau khi `liet_ke_id` đã đọc Meili: một id đăng giữa hai
        mốc chụp nay đã hiện trong Postgres và bị loại khỏi danh sách xoá. Chỉ những id
        thật sự vắng-hoặc-đã-ẩn ở lần hỏi thứ hai này mới bị gỡ.
        """
        if index == TEN_INDEX:
            van_hien = set(
                Mach.objects.filter(
                    pk__in=ung_vien, hidden_at__isnull=True
                ).values_list("pk", flat=True)
            )
        else:
            van_hien = set(
                _binh_luan_cong_khai()
                .filter(pk__in=ung_vien)
                .values_list("pk", flat=True)
            )
        return [i for i in ung_vien if i not in van_hien]


def _binh_luan_cong_khai():
    """Bình luận được phép nằm trong index — **ba vế**, cùng bộ với
    `core/tim_kiem.py::hien_cong_khai_binh_luan` và với `api/tim_kiem.py::
    _binh_luan_hien_theo_id`.

    Ba chỗ, một định nghĩa. Lệch một vế ở đây thì cron đêm sẽ hoặc gỡ mất thứ đang hiện
    (trang mất kết quả, không ai biết vì sao) hoặc đẩy lại thứ vừa bị ẩn (hoàn tác công
    việc kiểm duyệt, hằng đêm, im lặng).
    """
    return Comment.objects.filter(
        deleted_at__isnull=True,
        hidden_at__isnull=True,
        mach__hidden_at__isnull=True,
    ).select_related("author")
