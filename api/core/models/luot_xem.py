"""Thống kê lượt xem trang — hai bảng LÁ, cố ý không tham chiếu gì cả.

Chốt 2026-08-27 (`plans/2026-08-27-thong-ke-luot-xem.md`). User hỏi bốn câu: site được
xem bao nhiêu lần · link nào được xem nhiều · bao nhiêu bot vào · những bot nào.

## Ba quyết định của user, và cả ba đều nhìn thấy được ngay ở đây

1. **Chỉ đếm lượt xem.** Không cột IP, không cột User-Agent thô, không cookie, không
   "khách duy nhất". Không có gì trong hai bảng này gắn được với một con người, và đó
   là lý do trang thống kê không cần banner cookie. ⚠ User-Agent **vẫn được gửi** sang
   Django để phân loại bot (`core/bot.py`), nó chỉ không được **lưu**.
2. **Thô 90 ngày, tổng theo ngày giữ mãi.** `LuotXem` là hàng thô và bị dọn;
   `TongNgay` là bản gộp và ở lại vĩnh viễn. Lệnh `gom_luot_xem` làm cả hai việc, theo
   đúng thứ tự đó.
3. **Đếm mọi trang của site công khai.** Danh sách loại trừ nằm ở `matcher` của
   `apps/web/middleware.ts`, không ở đây — lọc ở Next rẻ hơn lọc sau khi đã ghi.

## Vì sao KHÔNG có khoá ngoại nào tới `Mach`/`Moc`

Hai lý do, cái thứ hai mới là lý do bắt buộc:

1. `duong_dan` là một đường dẫn của **site**, không phải một mạch. `/`, `/s/chung-khoan`,
   `/u/ai-do` không có hàng nào để trỏ tới, và một cột FK nullable dùng được cho 1/4 số
   hàng là một cột dạy sai người đọc.
2. **Thứ tự khoá hàng của repo** (`gikky-net/CLAUDE.md`): chuỗi hiện tại là
   `Comment/Moc → Mach → MocAnh`. Một FK tới `Mach` ở đây kéo theo `FOR KEY SHARE` NGẦM
   trên hàng `Mach` mỗi lần ghi một lượt xem — tức một cạnh khoá mới, dựng bởi đường ghi
   nóng nhất của cả site, mà không có dòng `select_for_update` nào để ai đó nhìn thấy.

Hai bảng này là **lá**: chúng không khoá gì ngoài chính chúng.
"""

from django.db import models
from django.utils import timezone


class LuotXem(models.Model):
    """Một lượt xem thô. Sống tối đa 90 ngày rồi bị `gom_luot_xem` dọn.

    Hàng ở đây được ghi bởi `POST /api/v1/dem-luot-xem`, gọi từ middleware của
    `apps/web` — chỗ DUY NHẤT thấy được lượt xem trang, vì trang là của Next chứ không
    của Django. Một middleware Django sẽ đếm **API call**, một con số trông như thật mà
    sai hoàn toàn.
    """

    #: **Không mang query string.** `?utm_source=…` đẻ vô hạn biến thể của cùng một
    #: trang, và bảng "xem nhiều nhất" sẽ vỡ vụn thành hàng nghìn dòng mỗi dòng 1 lượt.
    #: Cắt query ở đường ghi (`api/dem_luot_xem.py`), không ở đây.
    duong_dan = models.CharField(max_length=200)

    #: ⚠ **Cố ý KHÔNG `db_index=True`** — index nằm ở `Meta.indexes` dưới, dạng
    #: `(luc, duong_dan)`. Postgres dùng được index tổ hợp cho câu chỉ lọc `luc` (nó là
    #: cột dẫn đầu), nên một index đơn nữa **không nhanh thêm gì** mà bắt mỗi lượt
    #: `INSERT` cập nhật hai cây B-tree thay vì một — trên đúng đường ghi nóng nhất của
    #: cả site (một hàng cho MỖI lần ai đó mở MỘT trang).
    #: Bản đầu khai cả hai và `\d core_luotxem` cho thấy hai index chồng nhau.
    luc = models.DateTimeField(default=timezone.now)

    #: Suy từ `ten_bot` ở đường ghi (`ten_bot(ua) != ""`), lưu sẵn để không phải so chuỗi
    #: trong mỗi câu aggregate. Hai cột không có cách nào nói ngược nhau vì chỉ có một
    #: chỗ ghi chúng.
    la_bot = models.BooleanField(default=False)

    #: Tên chuẩn hoá (`core/bot.py::BANG_BOT`) hoặc `"khác"`; **rỗng khi là người**.
    ten_bot = models.CharField(max_length=40, blank=True, default="")

    class Meta:
        indexes = [
            # MỘT index, phục vụ cả hai câu đọc: lọc `luc >= mốc` (7/30/90 ngày, và cả
            # `gom_luot_xem`), rồi `GROUP BY duong_dan`. `luc` đứng đầu vì mọi câu đều
            # bắt đầu bằng nó — đảo thứ tự hai cột là index thành vô dụng cho phép lọc.
            models.Index(fields=["luc", "duong_dan"], name="luotxem_luc_duongdan"),
        ]

    def __str__(self) -> str:  # pragma: no cover - chỉ để đọc trong shell/admin
        return f"{self.duong_dan} @ {self.luc:%Y-%m-%d %H:%M}"


class TongNgay(models.Model):
    """Tổng lượt xem của **một ngày lịch VN đã xong**, theo từng đường dẫn. Giữ mãi.

    ⚠ **Chỉ chứa ngày ĐÃ XONG** (`< hôm nay` theo giờ VN). Hôm nay không bao giờ có mặt
    ở đây, và đó là thứ làm `gom_luot_xem` tất định: gộp cả ngày đang chạy thì mỗi lần
    chạy lại ra một con số khác cho cùng một ngày, và không ai kiểm được cái nào đúng.
    Người đọc "toàn thời gian" phải cộng bảng này với `LuotXem` **của riêng hôm nay** —
    xem `api/quan_tri_luot_xem.py`; cộng cả hai không điều kiện là đếm hai lần.

    Bảng này **không có cột `ten_bot`**: nó giữ mãi, mà một dòng cho mỗi
    (ngày × đường dẫn × tên bot) thì to gấp bội mà chỉ để trả lời một câu hỏi vốn chỉ có
    nghĩa trong ngắn hạn ("dạo này bot nào vào nhiều"). Hệ quả có thật và phải nói ra
    trên màn hình: bảng "bot nào vào nhiều nhất" **luôn chỉ phủ 90 ngày**, kể cả khi
    người xem chọn "toàn thời gian".
    """

    ngay = models.DateField(db_index=True)
    duong_dan = models.CharField(max_length=200)
    so_luot_nguoi = models.PositiveIntegerField(default=0)
    so_luot_bot = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [
            # Khoá của phép upsert trong `gom_luot_xem`. Đây là thứ làm lệnh ấy chạy lại
            # bao nhiêu lần cũng ra cùng kết quả — không có nó thì mỗi lượt chạy là một
            # bộ hàng mới và tổng nhân đôi, im lặng.
            models.UniqueConstraint(
                fields=["ngay", "duong_dan"], name="tongngay_ngay_duongdan"
            ),
        ]

    def __str__(self) -> str:  # pragma: no cover - chỉ để đọc trong shell/admin
        return f"{self.ngay} {self.duong_dan}: {self.so_luot_nguoi}+{self.so_luot_bot}"
