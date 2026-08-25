"""`User` — PLAN mục 6.

`AUTH_USER_MODEL = "core.User"` chốt từ Phase 0 (đổi sau lần `migrate` đầu là ngõ cụt).
Phase 1a thêm các trường domain: hồ sơ (`display_name`, `bio`) và trạng thái ban
(`banned_until`, `ban_permanent`, `ban_reason` — PLAN 5.10, tính năng dùng ở Phase 4,
cột dựng sẵn từ giờ).
"""

from django.contrib.auth.models import AbstractUser
from django.core.validators import MaxLengthValidator
from django.db import models
from django.utils import timezone


class User(AbstractUser):
    """User của gikky.net.

    **Xoá user (GDPR-lite, PLAN mục 6):** nội dung được GIỮ, tác giả hiển thị
    "[tài khoản đã xoá]". Cách hiện thực đã chọn là **ẩn danh hoá hàng `User`**
    (đổi `username`/`display_name`, `is_active=False`), KHÔNG phải `DELETE`. Vì vậy
    mọi FK trỏ tới tác giả nội dung dùng `on_delete=PROTECT`: một lệnh xoá lỡ tay ở
    Django admin sẽ báo lỗi thay vì nuốt mất mạch/mốc/bình luận. Xem thêm docstring
    `dien_dan.Mach`.
    """

    #: Tên hiển thị; rỗng thì UI rơi về `username`. Không unique — chỉ `username` là định danh.
    display_name = models.CharField(max_length=60, blank=True)
    bio = models.TextField(blank=True, validators=[MaxLengthValidator(500)])

    #: KHOÁ kho ảnh của avatar — **không** phải URL (giống `MocAnh.khoa_luu_tru`). Rỗng =
    #: chưa có avatar, UI rơi về ảnh mặc định. URL phục vụ suy ra bằng
    #: `core.anh_luu.url_thumb(avatar_khoa)`; ảnh chính lẫn thumbnail dùng CHUNG một khoá
    #: (xem `core/anh_luu.py`), avatar phục vụ bằng thumbnail (480px, CSS bo vuông).
    #:
    #: Avatar đi qua đúng bảy phép kiểm ảnh của Phase 5 (`core/anh.py`) và ghi vào CÙNG
    #: thư mục đĩa với ảnh mốc (`ghi_anh`), nên `don_anh_mo_coi` coi cột này là khoá hợp
    #: lệ — nếu không nó xoá mọi avatar sau 24 giờ vì không hàng `MocAnh` nào trỏ tới.
    #:
    #: **Là dữ liệu cá nhân nhẹ**, cùng loài `dang_ky_ip`: ẩn danh hoá tài khoản
    #: (`is_active=False`, PLAN mục 6) phải xoá cột này VÀ file kèm theo. Hôm nay CHƯA có
    #: đường code nào thực thi ẩn danh hoá (chỉ là quyết định thiết kế ở docstring trên),
    #: nên chưa có chỗ nào gọi việc dọn ấy — khi dựng đường xoá tài khoản, gọi
    #: `core.avatar.xoa_avatar(user=...)` là đủ cả hai vế.
    avatar_khoa = models.CharField(max_length=64, blank=True, default="")

    # --- Thông báo (PLAN 5.8 · Phase 3) --------------------------------------
    #: Nhận email digest tuần hay không. **`default=False` là bắt buộc, không phải một
    #: lựa chọn thẩm mỹ:** PLAN 5.8 chốt digest là *"tuỳ chọn **opt-in**"*, và `True` mặc
    #: định biến mọi tài khoản đã có thành người đăng ký mà không ai bấm gì — đúng nghĩa
    #: opt-out, tức ngược hẳn câu trong PLAN.
    #:
    #: Cờ này là một trong **ba** điều kiện của `core.digest.nguoi_nhan_digest()`; hai cái
    #: kia (`is_active`, và không gửi cho chính tác giả mạch) không suy ra được từ một
    #: cột nào nên chúng nằm ở truy vấn, xem docstring hàm đó.
    nhan_digest = models.BooleanField(default=False)

    # --- Chống lạm dụng (PLAN mục 10 Phase 6) -------------------------------
    #: IP của lượt ĐĂNG KÝ, và **chỉ** của lượt đăng ký — không cập nhật theo mỗi lần
    #: đăng nhập. Đây là khoá đếm duy nhất của hạn mức "≤5 đăng ký/IP/ngày"
    #: (`core/han_muc.py::dem_dang_ky_trong_ngay_vn`).
    #:
    #: **Vì sao một cột chứ không phải một bộ đếm trong cache:** cache mặc định của Django
    #: là `LocMemCache` — mất sạch khi tiến trình khởi động lại, và riêng cho từng worker.
    #: Trên một prod 4 worker thì "5/ngày" âm thầm thành 20/ngày.
    #:
    #: Cột này là **dữ liệu cá nhân** (IP nhận dạng được người dùng). Nó tồn tại vì một
    #: lý do hẹp và nêu được thành lời — chống đăng ký hàng loạt — nên đừng mở rộng nó
    #: thành nhật ký truy cập: không có cửa API nào trả nó ra, và ẩn danh hoá tài khoản
    #: (`is_active=False`, PLAN mục 6) nên xoá nó theo.
    dang_ky_ip = models.GenericIPAddressField(null=True, blank=True, editable=False)

    # --- Ban (PLAN 5.10 · Phase 4 dùng) -------------------------------------
    #: Ban tạm: hết hạn thì tự hết. Ban vĩnh viễn dùng cờ riêng để không phải
    #: nhét một mốc thời gian giả kiểu năm 9999 vào DB.
    banned_until = models.DateTimeField(null=True, blank=True)
    ban_permanent = models.BooleanField(default=False)
    ban_reason = models.CharField(max_length=200, null=True, blank=True)

    class Meta(AbstractUser.Meta):
        """**Kế thừa `AbstractUser.Meta`, không thay nó.** Bỏ đối số ấy là mất
        `verbose_name`, `swappable` và `abstract=False` mà Django dựng sẵn — hỏng theo kiểu
        chỉ lộ ra ở một chỗ xa (Django admin, hoặc `AUTH_USER_MODEL` swappable).

        Index cho L40: `dem_dang_ky_trong_ngay_vn` chạy
        `filter(dang_ky_ip=…, date_joined__gte=…, date_joined__lt=…)` ở **mỗi lượt đăng
        ký**, và trước index này không có gì phủ nó — Postgres quét cả `core_user`.

        Thứ tự cột **có nghĩa và không đảo được**: `dang_ky_ip` là phép so BẰNG nên nó
        phải đứng trước; `date_joined` là phép so KHOẢNG nên nó đứng sau. Đảo lại thì
        Postgres chỉ dùng được cột đầu và index thành nửa vô dụng — đây là luật chung của
        B-tree tổ hợp, không phải một chi tiết của truy vấn này.

        Vô hại ở quy mô v1 (vài nghìn hàng) — sổ lỗi xếp L40 là NHỎ, và index này là để
        lần sau không phải đi tìm chứ không phải để chữa một sự cố đang cháy.
        """

        indexes = [
            models.Index(
                fields=["dang_ky_ip", "date_joined"], name="user_dangky_ip_ngay_idx"
            ),
        ]

    def __str__(self) -> str:
        return self.username

    def dang_bi_ban(self, now=None) -> bool:
        """Tài khoản này có đang bị chặn không — ba cột trên, MỘT phép đọc.

        Đặt ở model chứ không ở tầng API vì có ít nhất hai nơi phải hỏi cùng câu hỏi này
        và chúng thuộc hai mảng khác nhau: cửa đăng nhập (Phase 2) và cửa quản trị
        (`api/quan_tri.py` — mod bị ban thì không được moderate nữa). Hai bản chép tay
        của cùng một điều kiện ba cột là bản thứ hai sẽ quên `banned_until` đã hết hạn,
        và không có gì đỏ: chỉ có một người bị khoá vĩnh viễn khỏi tài khoản của họ.

        Ban tạm **tự hết hạn** — so với `now` chứ không cần job dọn. Cột không bị xoá khi
        hết hạn là chủ đích: nó là vết cho lần ban sau.
        """
        if self.ban_permanent:
            return True
        if self.banned_until is None:
            return False
        return self.banned_until > (now or timezone.now())
