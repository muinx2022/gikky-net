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

Các đường ghi của khu quản trị (việc 21, đợt D — dưới cùng file, cộng
`core/ghi.py::dat_an_ban_tin`) đi cùng chiều: `BanTin` (FOR UPDATE) rồi mới tới hàng
`BanTinKhung` (FOR UPDATE / DELETE), rồi `INSERT AuditLog` (FOR KEY SHARE ngầm trên
`core_user` của người bấm). Không đường nào khoá khung trước rồi mới xin hàng ngày.
"""

from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from core.ghi import (
    AUDIT_SUA_BAN_TIN,
    AUDIT_SUA_KHUNG_BAN_TIN,
    AUDIT_XOA_KHUNG_BAN_TIN,
    DICH_BAN_TIN,
    _body_sach_khong_rong,
    _la_va_cham,
    ghi_audit,
)
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

    Ngày đã bị mod ẩn vẫn nhận khung (nó vẫn là bản tin của ngày đó, chỉ là đang ẩn) — hiện
    lại ở khu quản trị (`/ban-tin/<ngày>`, `core/ghi.py::dat_an_ban_tin`) thì đủ khung như thường.

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


# =============================================================================
# KHU QUẢN TRỊ — việc 21, đợt D (`plans/2026-11-13-quan-tri-ban-tin-chu-de.md` §3.2)
# =============================================================================
#
# Ba đường ghi cho mod (`is_staff`): sửa tiêu đề, sửa một khung, xoá một khung. Đường thứ tư
# — ẩn / hiện cả bản tin — là `core/ghi.py::dat_an_ban_tin`, vì nó ghi `hidden_at` (luật
# "mọi đường che sống ở `core/ghi.py`" của `tests/test_tim_kiem_cau_truc.py`). **Không có
# đường tạo**: bản tin chỉ đến từ bot (`dang_khung_ban_tin`).
#
# Mỗi lượt CÓ ĐỔI ghi đúng một dòng `AuditLog` trong cùng transaction, `meta.truoc` /
# `meta.sau` mang bản trước và sau của đúng những trường bị đụng — bản tin không có bảng
# revision nào, nên nhật ký là chỗ duy nhất còn giữ chữ cũ. Lượt không đổi gì ⇒ không ghi
# (cùng luật `sua_moc_boi_mod`: một cú bấm Lưu không đổi gì không được để vết "đã sửa").
# Hằng `AUDIT_*` / `DICH_BAN_TIN` khai ở `core/ghi.py` cùng mọi hằng nhật ký khác.


class KhongCoKhung(Exception):
    """Bản tin này không có khung đó. Tầng API đổi thành 404."""


class KhungCuoiCung(Exception):
    """Xoá khung CUỐI CÙNG của một bản tin. Tầng API đổi thành 409.

    Bản tin không khung nào là một trang công khai chỉ có tiêu đề — muốn gỡ cả ngày thì
    "Ẩn" (đảo ngược được), không phải xoá lần lượt từng khung tới rỗng.
    """


def _khoa(ban_tin: BanTin) -> BanTin:
    return BanTin.objects.select_for_update().get(pk=ban_tin.pk)


def _khoa_khung(hang: BanTin, khung: str) -> BanTinKhung:
    k = (
        BanTinKhung.objects.select_for_update()
        .filter(ban_tin=hang, khung=khung)
        .first()
    )
    if k is None:
        raise KhongCoKhung(f"Bản tin {hang.ngay} không có khung {khung}.")
    return k


def _audit(boi, action: str, hang: BanTin, **meta) -> None:
    ghi_audit(
        actor=boi,
        action=action,
        target_type=DICH_BAN_TIN,
        target_id=hang.pk,
        ngay=hang.ngay.isoformat(),
        **meta,
    )


def sua_tieu_de_ban_tin(*, ban_tin: BanTin, title: str, boi) -> tuple[BanTin, bool]:
    """Mod đổi tiêu đề. Trả `(bản tin, có đổi không)`. Rỗng sau `strip()` ⇒ `ValidationError`."""
    title = title.strip()
    if title == "":
        raise ValidationError("Tiêu đề không được để trống.")
    with transaction.atomic():
        hang = _khoa(ban_tin)
        if hang.title == title:
            return hang, False
        cu = hang.title
        hang.title = title
        hang.save(update_fields=["title"])
        _audit(boi, AUDIT_SUA_BAN_TIN, hang, truoc={"title": cu}, sau={"title": title})
    return hang, True


def sua_khung_ban_tin(
    *, ban_tin: BanTin, khung: str, body: str, figures, boi
) -> tuple[BanTinKhung, bool]:
    """Mod sửa thân + bảng số liệu của MỘT khung. Trả `(khung, có đổi không)`.

    Cùng hai hàng rào nội dung với đường đăng của bot (`dang_khung_ban_tin`): `kiem_figures`
    và `_body_sach_khong_rong` (`lam_sach` rồi đòi còn nội dung). So "có đổi không" SAU
    `lam_sach` — thân gửi lên khác chữ nhưng lọc xong y hệt thì không có gì để ghi.

    `created_at` của khung bất biến, nên `BanTin.cap_nhat_luc` (= `created_at` của khung
    mới nhất, plan việc 20 §3.1) **không đổi** khi sửa.
    """
    kiem_figures(figures)
    body = _body_sach_khong_rong(body)
    with transaction.atomic():
        hang = _khoa(ban_tin)
        k = _khoa_khung(hang, khung)
        if k.body == body and k.figures == figures:
            return k, False
        truoc = {"body": k.body, "figures": k.figures}
        k.body = body
        k.figures = figures
        k.save(update_fields=["body", "figures"])
        _audit(
            boi,
            AUDIT_SUA_KHUNG_BAN_TIN,
            hang,
            khung=khung,
            truoc=truoc,
            sau={"body": body, "figures": figures},
        )
    return k, True


def xoa_khung_ban_tin(*, ban_tin: BanTin, khung: str, boi) -> BanTin:
    """Xoá hẳn một khung — **không hoàn tác** (bản cũ chỉ còn trong `AuditLog.meta.truoc`).

    - không có khung đó ⇒ `KhongCoKhung`;
    - khung cuối cùng ⇒ `KhungCuoiCung` (xem docstring lớp);
    - xoá khung MỚI NHẤT ⇒ `cap_nhat_luc` lùi về `created_at` của khung mới nhất còn lại,
      giữ đúng định nghĩa của cột (plan việc 20 §3.1). Sitemap / RSS đọc cột này: để nguyên
      là báo "vừa cập nhật" cho một nội dung đã bị gỡ.
    """
    with transaction.atomic():
        hang = _khoa(ban_tin)
        k = _khoa_khung(hang, khung)
        con_lai = list(
            hang.khung.exclude(pk=k.pk).values_list("created_at", flat=True)
        )
        if not con_lai:
            raise KhungCuoiCung(
                f"Khung {khung} là khung cuối cùng của bản tin {hang.ngay} — ẩn cả bản tin "
                "thay vì xoá."
            )
        _audit(
            boi,
            AUDIT_XOA_KHUNG_BAN_TIN,
            hang,
            khung=khung,
            truoc={
                "body": k.body,
                "figures": k.figures,
                "created_at": k.created_at.isoformat(),
            },
            sau=None,
        )
        k.delete()
        moi_nhat = max(con_lai)
        if k.created_at > moi_nhat and hang.cap_nhat_luc != moi_nhat:
            hang.cap_nhat_luc = moi_nhat
            hang.save(update_fields=["cap_nhat_luc"])
    return hang
