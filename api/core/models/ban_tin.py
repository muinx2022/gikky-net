"""`BanTin`, `BanTinKhung` — bản tin thị trường hằng ngày (`plans/2026-11-13-ban-tin-bang-rieng.md` §3.1).

Trước việc 20, bản tin là một `Mach` trong sub `tin-tuc` và mỗi khung giờ là một `Moc`.
User chốt 2026-11-13: tách hẳn ra bảng riêng, **chỉ đọc** — không bình luận, không vote,
không câu hỏi cho đám đông, không trường phái, không riêng tư, không sub. Vì thế hai
bảng này cố ý KHÔNG có FK nào sang `Comment`/`Vote`/`Sub`, và không đi qua
`core/ghi.py::cap_nhat_dem_mach`: không có cột denormalize nào của `Mach` để giữ.

**Một ngày VN = một hàng `BanTin`, tối đa ba hàng `BanTinKhung`** (một mỗi khung giờ).
Cả hai ràng buộc nằm ở DB (`UNIQUE`), không ở tầng API: bot đăng ba lần mỗi ngày từ một
nhiệm vụ đặt lịch, và hai lượt chạy chồng nhau là ca thật (task fire trễ rồi fire đúng
giờ) — một phép kiểm "đọc rồi ghi" ở tầng trên không chặn được ca đó.

`mach_cu` chỉ để URL `/m/…` cũ trả 301 sang URL mới (`GET /ban-tin/tu-mach/{id}`). Bản
tin đăng qua đường mới để nó `NULL`.
"""

from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models
from django.utils import timezone

from core.models.moc import DAI_BODY_MOC, kiem_figures

#: Sub của bản tin cũ (thời bản tin còn là `Mach`). **Khai MỘT chỗ** — plan §3.2.
#:
#: Sub vẫn còn trong DB: mạch cũ đã lưu trữ `PROTECT` nó, và URL `/s/tin-tuc` sống trên
#: nó. Nhưng từ việc 20 không ai tạo được mạch mới trong đó (`api/machs.py::tao_mach_api`,
#: `api/quan_tri_hen_gio.py::tao_mach_hen_gio` trả 400 `sub_danh_rieng_ban_tin`).
SUB_BAN_TIN = "tin-tuc"


def la_sub_ban_tin(sub) -> bool:
    """Sub này có phải sub dành riêng cho bản tin không — cổng chặn tạo mạch vào đó.

    Hàm chứ không so chuỗi tại chỗ: hai cửa tạo mạch (`api/machs.py`, `api/quan_tri_hen_gio.py`)
    gọi cùng một luật, và bài đo bot ở `tests/test_bot_dang_tin.py` thay được đúng một chỗ
    để dựng lại "server cũ" (prod đang chạy `main`, chưa có cổng này).
    """
    return sub.slug == SUB_BAN_TIN


#: Bằng `Mach.title.max_length` — tiêu đề cũ chép thẳng sang khi chuyển dữ liệu.
DAI_TITLE_BAN_TIN = 160


class KhungBanTin(models.TextChoices):
    """Ba khung giờ của bản tin. **Thứ tự khai ở đây LÀ thứ tự hiển thị** (plan §3.1).

    Không sắp theo `created_at`: khung "Đêm qua" lỡ giờ rồi đăng bù sau "Trước phiên VN"
    vẫn phải đứng đầu tờ bản tin. Nhãn bằng đúng chữ `Moc.loai` của bản tin cũ — lệnh
    `chuyen_ban_tin` suy khoá từ nhãn này.
    """

    DEM_QUA = "dem_qua", "Đêm qua"
    TRUOC_PHIEN_VN = "truoc_phien_vn", "Trước phiên VN"
    TRUOC_PHIEN_MY = "truoc_phien_my", "Trước phiên Mỹ"


#: Thứ tự hiển thị — suy từ `KhungBanTin`, không gõ lại.
THU_TU_KHUNG: dict[str, int] = {khoa: i for i, khoa in enumerate(KhungBanTin.values)}


class BanTin(models.Model):
    """Bản tin của MỘT ngày lịch VN.

    `ngay` là ngày VN lúc đăng khung ĐẦU TIÊN (server tính), không suy từ tiêu đề.
    `cap_nhat_luc` = `created_at` của khung mới nhất, ghi trong cùng transaction với khung
    (`core/ghi_ban_tin.py::dang_khung_ban_tin`).
    """

    ngay = models.DateField(unique=True)
    title = models.CharField(max_length=DAI_TITLE_BAN_TIN)
    tac_gia = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="ban_tins"
    )
    #: `default` chứ không `auto_now_add`: lệnh chuyển dữ liệu phải giữ được `created_at`
    #: của mạch cũ — cùng lý lẽ với `Moc.created_at`.
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    cap_nhat_luc = models.DateTimeField(default=timezone.now)
    view_count = models.PositiveIntegerField(default=0)
    #: Mod ẩn một bản tin sai qua Django admin. Ẩn ⇒ mọi cửa đọc coi như không tồn tại.
    hidden_at = models.DateTimeField(null=True, blank=True)
    #: Mạch cũ đã chuyển sang hàng này — chỉ để 301. `OneToOne` = FK + `UNIQUE`: hai bản
    #: tin cùng trỏ một mạch là 301 mơ hồ, và chạy lại lệnh chuyển phải không tạo gì thêm.
    mach_cu = models.OneToOneField(
        "core.Mach",
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="ban_tin_moi",
    )

    class Meta:
        verbose_name = "bản tin"
        verbose_name_plural = "bản tin"
        ordering = ["-ngay"]

    def __str__(self) -> str:
        return f"bản tin {self.ngay:%Y-%m-%d}"


class BanTinKhung(models.Model):
    """Một khung giờ của bản tin. `body` là HTML **đã lọc** bằng đúng `lam_sach` của mốc."""

    ban_tin = models.ForeignKey(BanTin, on_delete=models.CASCADE, related_name="khung")
    khung = models.CharField(max_length=20, choices=KhungBanTin)
    body = models.TextField(validators=[MaxLengthValidator(DAI_BODY_MOC)])
    figures = models.JSONField(null=True, blank=True, validators=[kiem_figures])
    #: Server đóng dấu, bất biến.
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        verbose_name = "khung bản tin"
        verbose_name_plural = "khung bản tin"
        constraints = [
            models.UniqueConstraint(
                fields=["ban_tin", "khung"], name="ban_tin_khung_duy_nhat"
            ),
        ]

    def __str__(self) -> str:
        return f"{self.ban_tin} · {self.khung}"
