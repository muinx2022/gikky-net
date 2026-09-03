"""Thống kê lượt xem trang — bốn bảng LÁ, cố ý không tham chiếu gì cả.

Chốt 2026-08-27 (`plans/2026-08-27-thong-ke-luot-xem.md`). User hỏi bốn câu: site được
xem bao nhiêu lần · link nào được xem nhiều · bao nhiêu bot vào · những bot nào.

Mở rộng 2026-08-30 (`plans/2026-08-30-viet-lai-luot-xem.md`): thêm **khách duy nhất theo
ngày** kiểu GoatCounter, **nguồn truy cập** (chỉ tên miền), **trình duyệt/thiết bị**. Hai
bảng mới đi kèm — `MuoiNgay` (sống đúng một ngày) và `KhachNgay` (giữ mãi).

## Ba quyết định của user, và cả ba đều nhìn thấy được ngay ở đây

1. **Chỉ đếm lượt xem.** Không cột IP, không cột User-Agent thô, **không cookie theo
   dõi**. Không có gì trong bốn bảng này gắn được với một con người, và đó là lý do trang
   thống kê không cần banner cookie. ⚠ User-Agent **vẫn được gửi** sang Django để phân
   loại bot (`core/bot.py`) và suy trình duyệt/thiết bị (`core/nhan_dien_ua.py`), nó chỉ
   không được **lưu**.

   ⚠ **Từ 2026-09-03 câu trên đọc là "không cookie THEO DÕI", không còn là "không
   cookie".** Cột `da_dang_nhap` ghi thêm **một bit**: request có mang cookie phiên hay
   không. Bit ấy không kiểm còn hạn, không gắn với tài khoản nào, và không nối được hai
   hàng với nhau — nhưng "không cookie" trần thì nay là một câu **sai**, và một cam kết
   riêng tư viết sai còn tệ hơn một cam kết hẹp hơn viết đúng. Cùng câu ấy đã được sửa
   trên màn hình `/luot-xem`.

   ⚠ **"Khách duy nhất" là NỚI của quyết định cũ, user gật tường minh 2026-08-30.** Ba
   chốt còn lại giữ nguyên: không cookie · không lưu IP thô · **không theo dõi được qua
   ngày** — muối đổi mỗi ngày và bị `gom_luot_xem` **huỷ** khi ngày đóng, nên `khach` của
   ngày đã đóng là một token mờ vĩnh viễn, không ai dựng lại được từ IP+UA.
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

Bốn bảng này là **lá**: chúng không khoá gì ngoài chính chúng.
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

    #: Token khách của NGÀY — `sha256(f"{muối ngày}|{ip}|{ua}")[:32]`, xem
    #: `api/dem_luot_xem.py::hash_khach`. Không có cột nào chứa IP hay UA để đối chiếu, và
    #: **muối bị huỷ khi ngày đóng** (`gom_luot_xem`), nên sau nửa đêm giá trị này không
    #: còn dựng lại được từ bất kỳ đầu vào nào — kể cả bởi người cầm cả DB.
    #:
    #: `""` nghĩa là **không đo được** (cả IP lẫn UA đều rỗng), KHÔNG phải "một khách
    #: chung": gộp mọi hàng không đo được vào một token là bịa ra đúng một khách ma. Hàng
    #: ghi trước 2026-08-30 cũng mang `""` — chúng bị loại khỏi mọi phép đếm khách, và
    #: ngày nào toàn hàng như thế thì trả `None` chứ không trả 0 (xem `KhachNgay`).
    khach = models.CharField(max_length=32, blank=True, default="")

    #: **Tên miền** của Referer, lowercase, đã bỏ `www.` đầu. KHÔNG bao giờ là URL đầy đủ:
    #: một referer nội bộ có thể mang khoá bí mật ngay trên path
    #: (`/dat-lai-mat-khau/{key}`), và lưu path là ghi credential vào bảng thống kê.
    #:
    #: `""` gộp ba ca: truy cập trực tiếp · referer từ chính site · referer rác không parse
    #: được. Trang gọi cả ba là "(trực tiếp / nội bộ)" — phân biệt chúng đòi thêm một cột
    #: mà không trả lời thêm câu hỏi nào.
    nguon = models.CharField(max_length=100, blank=True, default="")

    #: Khoá ascii của `core/nhan_dien_ua.py::trinh_duyet` — `chrome`, `safari`, … , `khac`.
    #: **Rỗng khi là bot** (và với mọi hàng cũ): suy trình duyệt của một con bot là bịa.
    trinh_duyet = models.CharField(max_length=20, blank=True, default="")

    #: `di_dong` · `may_tinh`; **rỗng khi là bot**. Suy đoán thô từ UA — trang nói ra.
    thiet_bi = models.CharField(max_length=10, blank=True, default="")

    #: Request có mang **cookie tên `sessionid`** hay không (2026-08-31). Đọc đúng chữ:
    #: KHÔNG phải "phiên còn hiệu lực", và KHÔNG phải "người này là ai".
    #:
    #: ⚠ Middleware của Next chạy trên **edge runtime, không có DB** nên nó không validate
    #: được phiên — đúng đánh đổi mà nhánh rewrite `/m/` → `/m-phien/` đã chấp nhận từ
    #: trước và đã ghi ở docstring `apps/web/middleware.ts`. Hệ quả có thật: cookie hết
    #: hạn vẫn đếm là "đã đăng nhập". Modal `/luot-xem` **phải nói ra** điều đó, không giấu.
    #:
    #: ⚠ **Một boolean KHÔNG gắn hàng này với một con người**, và đó là toàn bộ lý do nó
    #: được phép tồn tại ở đây: cam kết "bốn bảng này không có cột nào gắn được với một
    #: con người" (docstring module) **giữ nguyên**. Thêm `user_id` vào bảng này là một
    #: quyết định KHÁC — phải hỏi lại user và phải sửa `PLAN.md`, đừng làm như một bước
    #: mở rộng tự nhiên của cột này.
    #:
    #: ⚠ **Cột này KHÔNG bị ép về `False` cho bot**, và đó là chủ đích: một crawler mang
    #: cookie `sessionid` nghĩa là hoặc ai đó đang chạy script bằng phiên của chính mình,
    #: hoặc một phiên đã rò ra ngoài — đúng thứ đáng thấy. Bot **không** mang cookie thì
    #: phía đọc hiện `—` chứ không hiện "Khách" (đó là một hằng số, không phải một phép
    #: đo); bot **có** mang cookie thì phía đọc phải nói ra. Bản đầu của modal in `—` cho
    #: mọi dòng bot kèm một chú thích khẳng định "bot không mang cookie bao giờ" — câu ấy
    #: sai, và nó làm đúng ca đáng thấy thành vô hình (lượt phản biện 2026-09-03).
    #:
    #: Hàng ghi TRƯỚC lượt này cũng `False`, và không cần backfill: cửa sổ "online" chỉ
    #: 5 phút nên chúng rơi khỏi câu hỏi duy nhất đọc cột này gần như ngay.
    da_dang_nhap = models.BooleanField(default=False)

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


class MuoiNgay(models.Model):
    """Muối băm của MỘT ngày. Sinh lúc ghi lượt đầu tiên, **bị huỷ khi ngày đóng**.

    Đây là thứ biến "khách duy nhất" thành một phép đếm **không theo dõi được ai**:

    - trong ngày, cùng (IP, UA) ra cùng `LuotXem.khach` ⇒ đếm được khách;
    - sang ngày mới, muối khác ⇒ cùng người ra một token khác ⇒ **không nối được hai
      ngày với nhau**. Một người ghé hai ngày là hai khách, và đó là cái giá đã chọn;
    - `gom_luot_xem` xoá mọi hàng `ngay < hôm nay` **vô điều kiện** ⇒ token của ngày đã
      đóng không còn dựng lại được kể cả khi ai đó biết chính xác IP và UA cần thử.

    Muối chỉ phục vụ **đường ghi**, mà đường ghi luôn rơi vào hôm nay — nên xoá vô điều
    kiện không mất gì. Giữ lại "cho chắc" mới là mất: một bảng muối còn sống biến mọi
    `khach` cũ thành thứ dò ngược được bằng cách thử danh sách IP.

    ⚠ Đường ghi đọc bảng này qua **cache tiến trình** (`api/dem_luot_xem.py`), không phải
    một query mỗi lượt xem: đây là đường ghi nóng nhất của cả site.
    """

    ngay = models.DateField(unique=True)
    #: `secrets.token_hex(32)` — 64 ký tự hex. Không bao giờ rời khỏi server.
    muoi = models.CharField(max_length=64)

    def __str__(self) -> str:  # pragma: no cover - chỉ để đọc trong shell/admin
        return f"muối {self.ngay}"


class KhachNgay(models.Model):
    """Số khách duy nhất của **một ngày lịch VN đã xong**. Giữ mãi.

    ## Vì sao KHÔNG nhét vào `TongNgay`

    Khoá của bảng ấy là `(ngay, duong_dan)`, mà khách **không phân rã được theo đường
    dẫn**: một người xem 5 trang vẫn là 1 khách, nên cộng theo hàng là đếm trùng có hệ
    thống — và trùng theo một hệ số không ai đoán được. Một bảng riêng, một hàng một ngày.

    ## Ngày VẮNG MẶT ≠ ngày bằng 0

    `gom_luot_xem` **không ghi hàng** cho ngày có hàng người mà mọi `khach` đều rỗng (hàng
    ghi trước 2026-08-30, hoặc client không gửi cả IP lẫn UA). Vắng mặt đọc là *"không đo
    được"* và endpoint trả `None` cho ô đó; ghi 0 sẽ vẽ ra một ngày **không có ai ghé**,
    tức một lời nói dối trông y hệt một phép đo.

    Ngày chỉ có bot thì ngược lại: 0 khách là sự thật, và nó được ghi.
    """

    ngay = models.DateField(unique=True)
    so_khach = models.PositiveIntegerField()

    def __str__(self) -> str:  # pragma: no cover - chỉ để đọc trong shell/admin
        return f"{self.ngay}: {self.so_khach} khách"
