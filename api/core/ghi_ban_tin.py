"""Đường ghi của bản tin — `plans/2026-11-13-ban-tin-bang-rieng.md` §3.1–3.2.

Tách khỏi `core/ghi.py` vì bản tin không có cột denormalize nào của `Mach` để giữ —
docstring đầu `core/ghi.py` nói về đúng những cột đó. Cái DÙNG LẠI là hai hàng rào nội
dung: `kiem_figures` (hình dạng `figures`) và `_body_sach_khong_rong` (`lam_sach` rồi đòi
còn nội dung). Một bộ lọc HTML thứ hai cho bản tin là bộ lọc sẽ quên một thẻ.

## Thứ tự khoá

Chỉ hai bảng: `BanTin` (FOR UPDATE) → `INSERT BanTinKhung` (FOR KEY SHARE ngầm trên chính
hàng `BanTin` vừa khoá). Không chạm `Mach`/`Moc`/`Comment`/`MocAnh`, nên không thêm cạnh
nào vào chuỗi `Comment/Moc → Mach → MocAnh` của repo. `INSERT BanTin` lấy FOR KEY SHARE
trên `core_user` (FK `tac_gia`) — cùng chiều với mọi đường khác ghi FK sang `User`, và
không đường nào khoá `User` rồi mới đụng `BanTin`.
"""

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from core.ghi import _body_sach_khong_rong, _la_va_cham
from core.models.ban_tin import BanTin, BanTinKhung, KhungBanTin
from core.models.moc import kiem_figures
from core.thoi_gian import ngay_vn

#: Tên `UniqueConstraint (ban_tin, khung)` — xem `core/models/ban_tin.py`.
RB_KHUNG_DUY_NHAT = "ban_tin_khung_duy_nhat"


class KhungDaDang(Exception):
    """Khung này của ngày đó đã có. Tầng API đổi thành 409 `khung_da_dang`."""


def dang_khung_ban_tin(
    *, tac_gia, khung: str, title: str, body: str, figures=None, khi=None
) -> tuple[BanTin, BanTinKhung, bool]:
    """Đăng một khung vào bản tin của ngày VN hiện tại. Trả `(bản tin, khung, có tạo ngày mới)`.

    - chưa có bản tin ngày đó ⇒ tạo, dùng `title`;
    - có rồi ⇒ thêm khung, **bỏ qua `title`** (tiêu đề đặt một lần, như tiêu đề mạch cũ);
    - khung đã có ⇒ `KhungDaDang`, không ghi gì.

    Ngày đã bị mod ẩn vẫn nhận khung (nó vẫn là bản tin của ngày đó, chỉ là đang ẩn) — mở
    ẩn qua Django admin thì đủ khung như thường.

    **Hàm này KHÔNG kiểm quyền** — cổng `la_tai_khoan_doi` ở `api/ban_tin.py`. `khi` chỉ để
    bài đo ghim giờ; đường API không truyền.
    """
    if khung not in KhungBanTin.values:
        raise ValidationError(
            f"khung phải thuộc {list(KhungBanTin.values)}, nhận {khung!r}."
        )
    kiem_figures(figures)
    body = _body_sach_khong_rong(body)
    khi = khi or timezone.now()
    ngay = ngay_vn(khi)
    title = title.strip()

    with transaction.atomic():
        # `get_or_create` tự bọc `create` trong savepoint và `get` lại khi va `UNIQUE
        # (ngay)` — đúng ca hai lượt bot chạy chồng nhau tạo cùng một ngày.
        ban_tin, tao_moi = BanTin.objects.get_or_create(
            ngay=ngay,
            defaults={
                "title": title,
                "tac_gia": tac_gia,
                "created_at": khi,
                "cap_nhat_luc": khi,
            },
        )
        if tao_moi and title == "":
            raise ValidationError("Bản tin mới của ngày cần tiêu đề.")
        # Khoá hàng ngày TRƯỚC khi hỏi "khung đã có chưa": hai lượt cùng khung xếp hàng ở
        # đây, lượt sau thấy khung của lượt trước và nhận 409 thay vì `IntegrityError`.
        ban_tin = BanTin.objects.select_for_update().get(pk=ban_tin.pk)
        if BanTinKhung.objects.filter(ban_tin=ban_tin, khung=khung).exists():
            raise KhungDaDang(f"Khung {khung} của ngày {ngay} đã đăng.")
        try:
            with transaction.atomic():
                hang = BanTinKhung.objects.create(
                    ban_tin=ban_tin,
                    khung=khung,
                    body=body,
                    figures=figures,
                    created_at=khi,
                )
        except IntegrityError as loi:  # pragma: no cover - khoá phía trên đã chặn
            if _la_va_cham(loi, RB_KHUNG_DUY_NHAT):
                raise KhungDaDang(f"Khung {khung} của ngày {ngay} đã đăng.") from loi
            raise
        # Ngày mới tạo đã mang `cap_nhat_luc = khi` từ `defaults`.
        if khi > ban_tin.cap_nhat_luc:
            ban_tin.cap_nhat_luc = khi
            ban_tin.save(update_fields=["cap_nhat_luc"])
    return ban_tin, hang, tao_moi
