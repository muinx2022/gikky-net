"""`manage.py chuyen_ban_tin` — chuyển bản tin cũ (mạch sub `tin-tuc`) sang bảng `BanTin`.

    python manage.py chuyen_ban_tin          # CHẠY THỬ (mặc định): in bảng, không ghi gì
    python manage.py chuyen_ban_tin --that   # ghi thật

`plans/2026-11-13-ban-tin-bang-rieng.md` §3.3.

## Vì sao lệnh chứ không phải data migration

Chạy trên prod phải có bước **xem trước** (bảng mạch → ngày → khung → ca lỗi) để người
deploy đọc trước khi ghi, và giữa lúc `migrate` với lúc chuyển thì bot đã có thể đăng
khung mới qua `POST /ban-tin`. Migration không có bước xem trước và không gộp được dữ
liệu sinh ra sau nó.

## Luật

- Nguồn: mạch trong sub `tin-tuc`, chưa lưu trữ, chưa bị ẩn, **KHÔNG riêng tư và tác giả có
  `la_tai_khoan_doi`** (vòng sửa 1 — xem `la_ban_tin_cua_doi`). Mạch khác trong sub bị in
  dòng "BỎ QUA", không ghi, không lưu trữ. Mỗi mạch nguồn → một `BanTin`:
  `ngay` = ngày VN của `created_at` mốc 1; `title`, `tac_gia`, `created_at`, `view_count`
  lấy từ mạch; `mach_cu` = mạch.
- Mỗi mốc còn sống (không `deleted_at`, không `hidden_at`) → một `BanTinKhung`, khoá suy
  từ `Moc.loai` theo nhãn của `KhungBanTin` (bỏ mọi khoảng trắng, không phân biệt hoa
  thường). `created_at` giữ của mốc. Thân markdown đi qua `core/markdown_sang_html.py` —
  bản dịch sang Python của đúng bộ dựng web từng dùng để vẽ thân markdown.
  `question_for_crowd` KHÔNG chép (nó vẫn còn trong hàng `Moc` cũ).
- **Ca lỗi — không ghi gì cho mạch đó**, liệt kê ra: `loai` không khớp ba nhãn; hai mốc
  cùng khung; hai mạch nguồn cùng ngày; mốc có ảnh; không còn mốc sống; `figures` sai dạng;
  ngày đã có bản tin chuyển từ MẠCH KHÁC.
- Ngày đã có `BanTin` (bot đăng qua đường mới): thêm khung còn thiếu, khung trùng giữ bản
  MỚI (bản đang có), cộng `view_count`, đặt `mach_cu`. Liệt kê.
  Bản đã có `mach_cu` là CHÍNH mạch này (mạch bị bỏ lưu trữ bằng tay) ⇒ chỉ lưu trữ lại,
  không cộng gì.
- Một mạch ghi hỏng (vd đua với bot tạo bản tin hôm nay) ⇒ "LỖI mạch …", mạch đó
  rollback, lệnh chạy tiếp mạch sau.
- Mạch có bình luận vẫn chuyển; số bình luận được in ra (chúng chỉ còn trong hàng cũ).
- Ghi xong mỗi mạch (một `atomic()` mỗi mạch): mạch cũ được lưu trữ qua
  `core/ghi.py::dat_luu_tru_mach` (đặt `archived_at`, gỡ khỏi chỉ mục tìm kiếm, làm mới
  cache). Chạy lại = 0 thay đổi, vì nguồn bỏ mạch đã lưu trữ.

## Thứ tự khoá

Trong transaction của một mạch: `BanTin` (FOR UPDATE, hoặc INSERT) → INSERT `BanTinKhung`
(FOR KEY SHARE ngầm trên `BanTin`) → `Mach` (INSERT/UPDATE `BanTin.mach_cu` lấy FOR KEY
SHARE ngầm trên `Mach`, rồi `dat_luu_tru_mach` lấy FOR UPDATE trên chính hàng đó). Không
khoá `Moc`/`Comment`/`MocAnh` nào (chỉ ĐỌC chúng, ngoài transaction ghi), nên không thêm
cạnh nào vào chuỗi `Comment/Moc → Mach → MocAnh`: `Mach` vẫn là hàng khoá cuối cùng của
lệnh này. Cạnh `BanTin → Mach` không có chiều ngược: không đường ghi nào khoá `Mach` rồi
mới đụng `BanTin`.
"""

from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime

from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand
from django.db import DatabaseError, IntegrityError, transaction
from django.db.models import Max

from core.ghi import dat_luu_tru_mach
from core.lam_sach_html import DINH_DANG_HTML
from core.markdown_sang_html import markdown_sang_html
from core.models import BanTin, BanTinKhung, Comment, Mach, Moc, MocAnh
from core.models.ban_tin import SUB_BAN_TIN, KhungBanTin
from core.models.moc import kiem_figures
from core.thoi_gian import ngay_vn


def _chuan_hoa(chu: str) -> str:
    return "".join(chu.split()).lower()


#: Nhãn `Moc.loai` đã chuẩn hoá → khoá khung. Suy từ `KhungBanTin`, không gõ lại.
KHUNG_THEO_NHAN = {_chuan_hoa(k.label): k.value for k in KhungBanTin}


def khung_tu_loai(loai: str | None) -> str | None:
    """`"Trước phiên VN"` → `"truoc_phien_vn"`. Không khớp ⇒ `None`."""
    if loai is None:
        return None
    return KHUNG_THEO_NHAN.get(_chuan_hoa(loai))


@dataclass
class KhungDuKien:
    khung: str
    seq: int
    body: str
    figures: list | None
    created_at: datetime


@dataclass
class KeHoachMach:
    """Kế hoạch cho MỘT mạch nguồn. `loi` khác rỗng ⇒ không ghi gì cho mạch này."""

    mach: Mach
    ngay: date | None
    khung: list[KhungDuKien] = field(default_factory=list)
    loi: list[str] = field(default_factory=list)
    so_binh_luan: int = 0
    #: Ngày đó đã có `BanTin` (lúc lập kế hoạch).
    gop_vao: BanTin | None = None
    #: Khung trùng với bản đang có — giữ bản đang có.
    khung_trung: list[str] = field(default_factory=list)
    #: Bản tin của ngày đó đã mang `mach_cu` = CHÍNH mạch này (mạch bị bỏ lưu trữ bằng tay
    #: rồi chạy lại lệnh) ⇒ không ghi gì nữa, chỉ lưu trữ lại mạch. Cộng `view_count` lần
    #: hai ở đây là đếm đôi.
    chi_luu_tru: bool = False


@dataclass
class BoQua:
    """Mạch trong sub bản tin nhưng KHÔNG phải bản tin của đội — không ghi, không lưu trữ."""

    mach: Mach
    ly_do: str


def _lap_cho_mach(mach: Mach) -> KeHoachMach:
    moc_1 = Moc.objects.filter(mach=mach, seq=1).first()
    if moc_1 is None:
        return KeHoachMach(mach=mach, ngay=None, loi=["không có mốc 1"])
    ke = KeHoachMach(mach=mach, ngay=ngay_vn(moc_1.created_at))
    ke.so_binh_luan = Comment.objects.filter(mach=mach).count()

    song = Moc.objects.filter(
        mach=mach, deleted_at__isnull=True, hidden_at__isnull=True
    ).order_by("seq")
    da_gap: dict[str, int] = {}
    for moc in song:
        khoa = khung_tu_loai(moc.loai)
        if khoa is None:
            ke.loi.append(f"mốc {moc.seq}: loai {moc.loai!r} không khớp khung nào")
            continue
        if khoa in da_gap:
            ke.loi.append(f"mốc {da_gap[khoa]} và mốc {moc.seq} cùng khung {khoa}")
            continue
        da_gap[khoa] = moc.seq
        if MocAnh.objects.filter(moc=moc).exists() or "<img" in moc.body:
            ke.loi.append(f"mốc {moc.seq}: có ảnh")
            continue
        try:
            kiem_figures(moc.figures)
        except ValidationError as e:
            ke.loi.append(f"mốc {moc.seq}: figures sai dạng ({'; '.join(e.messages)})")
            continue
        body = (
            moc.body
            if moc.body_dinh_dang == DINH_DANG_HTML
            else markdown_sang_html(moc.body)
        )
        ke.khung.append(
            KhungDuKien(
                khung=khoa,
                seq=moc.seq,
                body=body,
                figures=moc.figures,
                created_at=moc.created_at,
            )
        )
    if not da_gap and not ke.loi:
        ke.loi.append("không còn mốc sống nào")
    return ke


def la_ban_tin_cua_doi(mach: Mach) -> str | None:
    """`None` nếu mạch đủ điều kiện làm nguồn; ngược lại là lý do bỏ qua.

    ⚠ Hàng rào RIÊNG TƯ, không phải phép lọc cho gọn: `BanTin` là bảng công khai không có
    cột riêng tư nào, nên chép một mạch `rieng_tu` vào đây là đem thân bài riêng tư ra
    `GET /ban-tin/{ngày}` cho cả internet. Mạch của người thường (đăng vào `tin-tuc`
    trước khi cổng `sub_danh_rieng_ban_tin` có) cũng không phải bản tin: nó là bài của
    một người, không được đổi thành "bản tin của gikky".
    """
    if mach.rieng_tu:
        return "mạch riêng tư"
    if not mach.author.la_tai_khoan_doi:
        return "tác giả không phải tài khoản đội"
    return None


def lap_ke_hoach() -> tuple[list[KeHoachMach], list[BoQua]]:
    """Đọc thuần, không ghi. Trả `(kế hoạch cho mạch đủ điều kiện, mạch bị bỏ qua)`, theo `id`."""
    nguon = (
        Mach.objects.filter(
            sub__slug=SUB_BAN_TIN, archived_at__isnull=True, hidden_at__isnull=True
        )
        .select_related("author")
        .order_by("pk")
    )
    ke_hoach: list[KeHoachMach] = []
    bo_qua: list[BoQua] = []
    for m in nguon:
        ly_do = la_ban_tin_cua_doi(m)
        if ly_do is None:
            ke_hoach.append(_lap_cho_mach(m))
        else:
            bo_qua.append(BoQua(mach=m, ly_do=ly_do))

    # Đếm "hai mạch cùng ngày" CHỈ trên mạch đủ điều kiện: một bài người thường đăng vào
    # sub này cùng ngày không được phép chặn bản tin của đội.
    dem_ngay = Counter(k.ngay for k in ke_hoach if k.ngay is not None)
    for ke in ke_hoach:
        if ke.ngay is None:
            continue
        if dem_ngay[ke.ngay] > 1:
            khac = [k.mach.pk for k in ke_hoach if k.ngay == ke.ngay and k is not ke]
            ke.loi.append(f"hai mạch cùng ngày {ke.ngay} (cùng ngày với mạch {khac})")
        da_co = BanTin.objects.filter(ngay=ke.ngay).first()
        if da_co is None:
            continue
        if da_co.mach_cu_id == ke.mach.pk:
            ke.chi_luu_tru = True
            continue
        if da_co.mach_cu_id is not None:
            ke.loi.append(
                f"ngày {ke.ngay} đã có bản tin chuyển từ mạch {da_co.mach_cu_id}"
            )
            continue
        ke.gop_vao = da_co
        co_san = set(da_co.khung.values_list("khung", flat=True))
        ke.khung_trung = [k.khung for k in ke.khung if k.khung in co_san]
    return ke_hoach, bo_qua


def ghi_mot_mach(ke: KeHoachMach) -> list[str]:
    """Ghi một kế hoạch KHÔNG lỗi. Trả các khung bị bỏ vì trùng (đọc lại DƯỚI KHOÁ)."""
    mach = ke.mach
    with transaction.atomic():
        if ke.chi_luu_tru:
            dat_luu_tru_mach(mach=mach, boi=None, luu_tru=True)
            return []
        ban_tin = BanTin.objects.select_for_update().filter(ngay=ke.ngay).first()
        if ban_tin is None:
            # ⚠ Cửa sổ đua: bot có thể tạo `BanTin` của ngày này ngay sau dòng trên (chỉ
            # ngày HÔM NAY mới có ca này). `create` khi đó ném `IntegrityError` — mạch này
            # rollback, `Command.handle` bắt theo TỪNG mạch rồi chạy tiếp; chạy lại lệnh
            # thì mạch đó rơi vào nhánh gộp.
            ban_tin = BanTin.objects.create(
                ngay=ke.ngay,
                title=mach.title,
                tac_gia=mach.author,
                created_at=mach.created_at,
                cap_nhat_luc=max(k.created_at for k in ke.khung),
                view_count=mach.view_count,
                mach_cu=mach,
            )
            co_san: set[str] = set()
        else:
            if ban_tin.mach_cu_id is not None:
                # Lúc lập kế hoạch ngày này chưa có `mach_cu`; giờ có (lượt chạy song song).
                raise IntegrityError(
                    f"ngày {ke.ngay} vừa có bản tin chuyển từ mạch {ban_tin.mach_cu_id}"
                )
            # Bot đã đăng qua đường mới — có thể ngay giữa lúc lập kế hoạch và lúc ghi,
            # nên tập khung đang có được đọc lại ở đây, dưới khoá, không tin bản lúc lập.
            ban_tin.mach_cu = mach
            ban_tin.view_count += mach.view_count
            ban_tin.save(update_fields=["mach_cu", "view_count"])
            co_san = set(ban_tin.khung.values_list("khung", flat=True))
        moi = [k for k in ke.khung if k.khung not in co_san]
        BanTinKhung.objects.bulk_create(
            [
                BanTinKhung(
                    ban_tin=ban_tin,
                    khung=k.khung,
                    body=k.body,
                    figures=k.figures,
                    created_at=k.created_at,
                )
                for k in moi
            ]
        )
        moi_nhat = ban_tin.khung.aggregate(m=Max("created_at"))["m"]
        if moi_nhat is not None and moi_nhat != ban_tin.cap_nhat_luc:
            ban_tin.cap_nhat_luc = moi_nhat
            ban_tin.save(update_fields=["cap_nhat_luc"])
        dat_luu_tru_mach(mach=mach, boi=None, luu_tru=True)
    return sorted(co_san & {k.khung for k in ke.khung})


class Command(BaseCommand):
    help = (
        "Chuyển bản tin cũ (mạch sub tin-tuc) sang bảng BanTin. Mặc định CHẠY THỬ; "
        "--that để ghi."
    )

    def add_arguments(self, parser):
        parser.add_argument(
            "--that", action="store_true", help="Ghi thật. Không có cờ này = chạy thử."
        )

    def handle(self, *args, **options):
        that = options["that"]
        ke_hoach, bo_qua = lap_ke_hoach()
        self.stdout.write(
            f"{'GHI THẬT' if that else 'CHẠY THỬ'} — {len(ke_hoach) + len(bo_qua)} mạch "
            f"trong s/{SUB_BAN_TIN} ({len(bo_qua)} bỏ qua)"
        )
        for b in bo_qua:
            self.stdout.write(
                self.style.WARNING(
                    f"BỎ QUA mạch {b.mach.pk} · tác giả {b.mach.author.username} · "
                    f"rieng_tu={b.mach.rieng_tu} · {b.ly_do}"
                )
            )
        so_chuyen = so_loi = 0
        for ke in ke_hoach:
            khung = ", ".join(f"{k.khung}←mốc {k.seq}" for k in ke.khung) or "-"
            dong = (
                f"mạch {ke.mach.pk} · tác giả {ke.mach.author.username} · "
                f"rieng_tu={ke.mach.rieng_tu} → {ke.ngay or '?'} · {khung}"
            )
            if ke.so_binh_luan:
                dong += f" · {ke.so_binh_luan} bình luận (ở lại hàng cũ)"
            if ke.gop_vao is not None:
                dong += f" · GỘP vào bản tin đã có (id {ke.gop_vao.pk})"
            if ke.chi_luu_tru:
                dong += " · bản tin của ngày đã chuyển từ CHÍNH mạch này — chỉ lưu trữ lại"
            if ke.loi:
                so_loi += 1
                self.stdout.write(self.style.ERROR(f"LỖI {dong}"))
                for cau in ke.loi:
                    self.stdout.write(f"    - {cau}")
                continue
            if that:
                try:
                    trung = ghi_mot_mach(ke)
                except DatabaseError as e:
                    # Một mạch hỏng (đua với bot, ràng buộc) không được giết cả lượt: mỗi
                    # mạch một `atomic()`, nên mạch này đã rollback sạch.
                    so_loi += 1
                    self.stdout.write(self.style.ERROR(f"LỖI mạch {ke.mach.pk}: {e}"))
                    continue
            else:
                trung = ke.khung_trung
            if trung:
                dong += f" · bỏ khung trùng (giữ bản mới): {', '.join(trung)}"
            so_chuyen += 1
            self.stdout.write(f"{'ĐÃ GHI' if that else 'SẼ GHI'} {dong}")
        self.stdout.write(
            f"Tổng: {so_chuyen} mạch {'đã chuyển' if that else 'sẽ chuyển'}, "
            f"{so_loi} mạch lỗi (không ghi), {len(bo_qua)} mạch bỏ qua."
        )
