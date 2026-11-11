"""Đổi `username` của MỘT tài khoản và dọn mọi chỗ đã chép tên cũ — `P-20261109-2`.

Sinh ra vì `populate_username` (`core/allauth_adapter.py`, bước 2) có thể cho ra username
CHÍNH LÀ địa chỉ email, và username thì in ra khắp nơi công khai: URL hồ sơ
`/u/<username>`, `author.username` trong API, chỉ mục tìm kiếm, payload thông báo gửi cho
NGƯỜI KHÁC. Plan: `plans/2026-11-09-doi-username-email.md`.

    node scripts/py.mjs doi_username --tim-email
    node scripts/py.mjs doi_username --tu "a@b.com" --thanh "a"                # dry-run
    node scripts/py.mjs doi_username --tu "a@b.com" --thanh "a" --ap-dung
    node scripts/py.mjs doi_username ... --ap-dung --dong-bo-tim-kiem

## Ba chế độ, và chỉ MỘT trong số đó ghi

- `--tim-email`: chỉ đọc. Liệt kê tài khoản có `@` trong username.
- mặc định (không `--ap-dung`): **dry-run**, in việc sẽ làm rồi thoát.
- `--ap-dung`: ghi thật.

## Ghi những gì, trong MỘT `atomic()`

1. khoá hàng `User` (`select_for_update`) rồi đổi `username`;
2. sửa `Notification.payload["boi"]` từ tên cũ sang tên mới. `"boi"` là khoá DUY NHẤT trong
   payload mang username (`core/thong_bao.py`: `bao_trich`, `bao_reply`, `bao_theo_mach`,
   `bao_theo_user`, `bao_binh_luan`, `bao_mach_moi`; `boi_hien_thi` là `display_name`, không phải
   username). `tests/test_doi_username.py` ghim điều này bằng một bài đo đọc mã nguồn.
   Sửa theo LÔ để mỗi câu `UPDATE` ngắn và RAM không giữ cả bảng; mỗi lô được đọc bằng
   `SELECT ... FOR UPDATE`, vì `bulk_update` ghi đè CẢ `payload` từ bản đã đọc: một upsert
   đồng thời (`dedupe_key`) chen vào giữa lúc đọc và lúc ghi sẽ bị lệnh này ghi đè mất.
   Khoá hàng giữ tới hết transaction — đó là cái giá của "một transaction" mà plan đòi, và
   lô lớn nhất cũng chỉ vài trăm hàng/tài khoản;
3. (chỉ khi `--dong-bo-tim-kiem`) xếp `dong_bo_mach` / `dong_bo_binh_luan_theo_mach`. Gọi
   BÊN TRONG `atomic()` cũng là chủ đích: hai hàm này tự xếp vào `on_commit` nên chúng vẫn
   chạy SAU commit, nhưng một lỗi giữa chừng thì không để lại index đã đổi mà Postgres chưa.

## Sau commit: nói điều ĐO ĐƯỢC, không nói điều đã "xếp"

Lệnh này chạy rồi thoát, nên mọi việc "xếp để làm nền" đều có thể chết cùng tiến trình.

- **Revalidate** gọi ĐỒNG BỘ `core.revalidate._gui` cho từng đường `/m/<slug>-<id>`, KHÔNG
  qua `lam_moi_mach` → `on_commit` → `_gui_nen`. Đường ấy bắn một luồng daemon rồi trả về:
  `handle()` kết thúc, tiến trình chết, và (đã đo) chỉ 3–7 trên 9 lời gọi tới nơi, trong
  khi dòng "đã xếp" vẫn in. Cách đồng bộ có thêm hai lợi: biết CHẮC lúc nào xong, và đếm được
  lỗi — `_gui` nuốt lỗi và chỉ log, nên lệnh gắn tạm một `logging.Handler` vào logger của
  `core.revalidate` và đếm WARNING/ERROR. Đường dẫn vẫn do `core.digest.duong_dan_mach` dựng
  (cùng luật mà `lam_moi_mach` dùng). Cái giá: tuần tự, tối đa `TIMEOUT_GIAY` mỗi lời gọi
  khi Next treo.
- **Tìm kiếm** (có `--dong-bo-tim-kiem`): `_dong_bo_ngay` nuốt `MeiliHong`, và `suc_khoe()` chỉ
  gọi `/health` — khoá phạm vi hẹp thiếu quyền một index vẫn qua. Nên lệnh chỉ viết "ĐÃ XÁC
  NHẬN" khi ĐỌC NGƯỢC chỉ mục (`GET /indexes/<uid>/documents`, cùng đường mà
  `tim_kiem.liet_ke_id` dùng) và thấy `author` là tên mới ở mọi tài liệu của tài khoản, và không
  còn tài liệu nào mang tên cũ. Meilisearch ghi BẤT ĐỒNG BỘ (PUT trả `taskUid` rồi mới áp),
  nên đọc ngược được thử lại `SO_LAN_DOC_LAI` lần trước khi kết luận là lệch. Không đọc được
  ⇒ viết "CHƯA xác nhận được", không viết "đã đồng bộ".
- **Mọi việc sau commit không xong** (revalidate có lỗi, đồng bộ tìm kiếm ném, đọc ngược lệch)
  ⇒ DB KHÔNG hoàn tác (đã commit) và lệnh thoát khác 0 bằng `CommandError` nói rõ "ĐÃ COMMIT".
  Thoát khác 0 vì mục đích của lệnh là "email không còn công khai"; cache/chỉ mục chưa
  làm mới tức là mục đích CHƯA đạt, và người chạy phải biết để chạy lại (lệnh idempotent,
  xem dưới). Riêng `REVALIDATE_SECRET` chưa đặt thì chỉ cảnh báo, thoát 0: đó là trạng thái
  cấu hình người vận hành chủ động chọn (máy dev), không phải lỗi giữa chừng.

**Tập mạch bị ảnh hưởng** = mạch của tài khoản + mạch của NGƯỜI KHÁC mà tài khoản có mốc
hoặc bình luận. Vế sau là chỗ dễ quên: trang `/m/<slug>-<id>` của người khác nhúng
`author.username` của các bình luận ấy trong bản ISR.

## Cố ý KHÔNG làm

- **`AuditLog`**: `AuditLog.actor` là FK `PROTECT` KHÔNG null mà lệnh quản trị không có
  người thao tác. Gán chính tài khoản bị đổi làm `actor` là ghi sai "ai làm"; thêm một user hệ
  thống thì cần dữ liệu/migration. `ghi_audit` không cần hằng mới (cột `action` là
  `CharField` tự do) nhưng thiếu `actor` thì không ghi sạch được ⇒ bỏ qua, in một dòng.
  Ghi tên cũ vào `meta` cũng sẽ chép email vào một chỗ nữa, ngược mục đích.
- Không chạm `reindex_tim_kiem` (đang được sửa ở nơi khác) và không đồng bộ tìm kiếm khi
  không có cờ: `hien_cong_khai` có thể chưa đủ chặt với mạch riêng tư ở bản đang chạy.
- Không viết lại `AuditLog.meta["tac_gia"]` cũ: nhật ký là append-only.
- Không tự chọn tên khác khi trùng, không tạo bí danh cho URL cũ.
- Không chạy `normalize_username` (NFKC) và không có danh sách tên dành riêng: tên đích đi
  qua đúng `clean_username(shallow=True)` của adapter và không hơn. Không ảnh hưởng tên
  ASCII thường như `muinx2022`.

## Idempotent, tự chữa khi chạy lại, và NÉM lỗi chứ không nuốt

Tên cũ không còn mà tên đích đang có chủ ⇒ "đã là tên mới", không đổi username. Nếu `--tu` là
EMAIL của chính chủ tên đích (chứng minh được đó là tài khoản cũ) thì chạy `--ap-dung` ở
nhánh này **chữa nốt phần còn dở của lần trước**: (i) sửa `payload["boi"]` còn bằng `--tu` (một
thông báo sinh bởi request của chính tài khoản đang bay lúc đổi tên), (ii) gửi lại revalidate,
(iii) đồng bộ tìm kiếm nếu có cờ. Không chứng minh được (`--tu` không phải email của chủ) ⇒
KHÔNG sửa thông báo và KHÔNG revalidate, chỉ cảnh báo: không đụng dữ liệu người khác; riêng
`--dong-bo-tim-kiem` vẫn đồng bộ lại (upsert trạng thái đúng của chính tài khoản đó, vô hại).
Mọi trường hợp còn lại không làm được ⇒ `CommandError` (thoát khác 0), cùng tinh thần
`reindex_tim_kiem.py`.
"""

import logging
import time
from dataclasses import dataclass, field

from allauth.account.adapter import get_adapter
from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.db.models import Count

from core import revalidate, tim_kiem
from core.models import Comment, Mach, Moc, Notification, User

#: Số hàng thông báo mỗi lần sửa. Cùng cỡ `reindex_tim_kiem.CO_LO`.
CO_LO_THONG_BAO = 500

#: Khoá trong `Notification.payload` đang chứa username. Xem docstring module.
KHOA_PAYLOAD_USERNAME = "boi"

#: Số tài liệu mỗi trang khi đọc ngược chỉ mục. Cùng cỡ `tim_kiem.liet_ke_id`.
CO_LO_DOC_CHI_MUC = 1000

#: Meilisearch ghi bất đồng bộ ⇒ đọc ngược ngay sau khi PUT có thể còn thấy bản cũ. Thử lại
#: tối đa chừng này lần, cách nhau `BUOC_DOC_LAI_GIAY`, rồi mới kết luận là lệch.
SO_LAN_DOC_LAI = 10
BUOC_DOC_LAI_GIAY = 1.0

#: Tối đa bao nhiêu mục lệch in ra mỗi chỉ mục (phần còn lại chỉ đếm).
SO_MAU_LECH = 5


@dataclass
class KeHoach:
    """Việc cần làm cho một tài khoản — dựng một lần, dùng cho cả dry-run lẫn ghi thật."""

    so_thong_bao: int
    #: Mạch do tài khoản làm chủ.
    mach_cua: list[int] = field(default_factory=list)
    #: Mạch của NGƯỜI KHÁC mà tài khoản có mốc hoặc bình luận.
    mach_nguoi_khac: list[int] = field(default_factory=list)

    @property
    def can_lam_moi(self) -> list[int]:
        return sorted({*self.mach_cua, *self.mach_nguoi_khac})


class _DemLoi(logging.Handler):
    """Gom WARNING/ERROR của một logger. `core.revalidate._gui` nuốt lỗi và chỉ log."""

    def __init__(self) -> None:
        super().__init__(level=logging.WARNING)
        self.ban_ghi: list[str] = []

    def emit(self, record: logging.LogRecord) -> None:
        self.ban_ghi.append(record.getMessage())


class Command(BaseCommand):
    help = "Đổi username của một tài khoản (mặc định dry-run) và dọn các chỗ đã chép tên cũ."

    def add_arguments(self, parser):
        parser.add_argument(
            "--tim-email",
            action="store_true",
            help="Chỉ đọc: liệt kê tài khoản có '@' trong username.",
        )
        parser.add_argument("--tu", help="Username hiện tại (khớp CHÍNH XÁC).")
        parser.add_argument("--thanh", help="Username mới.")
        parser.add_argument(
            "--ap-dung",
            action="store_true",
            help="Ghi thật. Không có cờ này lệnh chỉ in việc sẽ làm.",
        )
        parser.add_argument(
            "--dong-bo-tim-kiem",
            action="store_true",
            help=(
                "Đồng bộ lại Meilisearch cho mạch/bình luận của tài khoản. TẮT mặc định; "
                "chỉ bật khi bản vá không-đưa-mạch-riêng-tư-vào-chỉ-mục đã chạy trên môi trường đó."
            ),
        )

    # --- điều phối ----------------------------------------------------------

    def handle(self, *args, **tuy_chon):
        if tuy_chon["tim_email"]:
            if any(tuy_chon[k] for k in ("tu", "thanh", "ap_dung", "dong_bo_tim_kiem")):
                raise CommandError("--tim-email chạy một mình, không đi kèm cờ nào khác.")
            return self._tim_email()

        tu, thanh = tuy_chon["tu"], tuy_chon["thanh"]
        if not tu or not thanh:
            raise CommandError("Cần cả --tu và --thanh (hoặc dùng --tim-email).")
        ap_dung, dong_bo = tuy_chon["ap_dung"], tuy_chon["dong_bo_tim_kiem"]

        self._kiem_ten_dich(thanh)

        nguon = User.objects.filter(username=tu).first()
        if nguon is None:
            return self._khong_con_ten_cu(tu, thanh, ap_dung=ap_dung, dong_bo=dong_bo)
        if nguon.username == thanh:
            # `--tu` và `--thanh` giống hệt nhau: không có tên cũ nào để chữa.
            return self._da_la_ten_moi(
                nguon, ap_dung=ap_dung, dong_bo=dong_bo, chung_minh=True, ten_cu=None
            )

        self._kiem_trung(thanh, nguon.pk)

        if not ap_dung:
            return self._dry_run(nguon, thanh, dong_bo=dong_bo)
        return self._ap_dung(nguon, tu, thanh, dong_bo=dong_bo)

    # --- --tim-email --------------------------------------------------------

    def _tim_email(self) -> None:
        """Chỉ đọc. Trả lời quyết định (d) của plan: còn tài khoản nào bị cùng lỗi."""
        hang = list(
            User.objects.filter(username__contains="@")
            .annotate(
                so_mach=Count("machs", distinct=True),
                so_moc=Count("mocs", distinct=True),
                so_binh_luan=Count("comments", distinct=True),
            )
            .order_by("pk")
        )
        if not hang:
            self.stdout.write("Không có tài khoản nào có '@' trong username.")
            return
        self.stdout.write(f"{len(hang)} tài khoản có '@' trong username:")
        for u in hang:
            self.stdout.write(
                f"  id={u.pk}  username={u.username}  tạo={u.date_joined:%Y-%m-%d}  "
                f"mạch={u.so_mach}  mốc={u.so_moc}  bình luận={u.so_binh_luan}"
            )

    # --- kiểm đầu vào -------------------------------------------------------

    def _kiem_ten_dich(self, thanh: str) -> None:
        """Cùng bộ kiểm với form đăng ký (`clean_username` của adapter, `shallow` bỏ phép
        tra trùng vì ta tự tra bên dưới theo `iexact`) **và** cấm `@`.

        Cấm `@` dù `UnicodeUsernameValidator` cho phép: lệnh này sinh ra để gỡ email khỏi
        username, nên nó không được tạo ra một tên trông như email.
        """
        if "@" in thanh:
            raise CommandError(
                "Tên đích chứa '@': lệnh này tồn tại để gỡ email khỏi username, "
                "không được tạo ra một tên trông như email."
            )
        try:
            get_adapter().clean_username(thanh, shallow=True)
        except ValidationError as loi:
            raise CommandError(f"Tên đích không hợp lệ: {'; '.join(loi.messages)}") from loi

    def _kiem_trung(self, thanh: str, pk_nguon: int) -> None:
        """Từ chối khi tên đích đã thuộc tài khoản KHÁC — không phân biệt hoa thường.

        `User.username` chỉ unique PHÂN BIỆT hoa thường ở DB, nhưng form đăng ký và allauth
        tra trùng bằng `iexact`; để `Muinx2022` và `muinx2022` cùng tồn tại là dựng hai
        người trông như một.
        """
        trung = User.objects.filter(username__iexact=thanh).exclude(pk=pk_nguon).first()
        if trung is not None:
            raise CommandError(
                f"Tên đích đã thuộc tài khoản khác (id={trung.pk}, username={trung.username!r}). "
                "Không tự chọn tên khác thay bạn — hỏi lại chủ tài khoản."
            )

    # --- nhánh "đã là tên mới" ----------------------------------------------

    def _khong_con_ten_cu(self, tu: str, thanh: str, *, ap_dung: bool, dong_bo: bool) -> None:
        """Tên cũ không còn. Hoặc đã đổi rồi (idempotent), hoặc gõ sai — phân biệt bằng tên đích."""
        chu = User.objects.filter(username=thanh).first()
        if chu is None:
            raise CommandError(
                f"Không có tài khoản nào mang username {tu!r}, và tên đích {thanh!r} cũng "
                "chưa thuộc ai. Kiểm lại --tu (khớp chính xác, phân biệt hoa thường)."
            )
        # Chứng minh được chủ tên đích chính là tài khoản cũ chỉ khi `--tu` là email của họ.
        chung_minh = "@" in tu and (chu.email or "").lower() == tu.lower()
        return self._da_la_ten_moi(
            chu,
            ap_dung=ap_dung,
            dong_bo=dong_bo,
            chung_minh=chung_minh,
            ten_cu=tu if chung_minh else None,
        )

    def _da_la_ten_moi(
        self,
        user: User,
        *,
        ap_dung: bool,
        dong_bo: bool,
        chung_minh: bool,
        ten_cu: str | None,
    ) -> None:
        """`ten_cu`: tên cũ ĐÃ CHỨNG MINH là của tài khoản này, hoặc `None`. Chỉ khi có nó
        lệnh mới được sửa thông báo và gửi lại revalidate — xem docstring module."""
        self.stdout.write(
            f"Đã là tên mới: tài khoản id={user.pk} đã mang username {user.username!r}. "
            "Username không đổi."
        )
        if not chung_minh:
            self.stdout.write(
                self.style.WARNING(
                    "  Lưu ý: không chứng minh được tài khoản này chính là tài khoản có "
                    "username cũ (--tu không phải email của nó). Kiểm tay trước khi tin; "
                    "lệnh KHÔNG sửa thông báo hay làm mới cache cho tài khoản này."
                )
            )
        if ten_cu is None and not dong_bo:
            self._dong_chua_dong_bo()
            return

        ke_hoach = self._lap_ke_hoach(user)
        if not ap_dung:
            self._ke_hoach_chay_bu(user, ke_hoach, ten_cu=ten_cu, dong_bo=dong_bo)
            return

        if dong_bo:
            self._kiem_meili_song()

        def viec() -> KeHoach:
            if ten_cu is not None:
                # Khoá hàng chủ tên đích: chạy bù không được chen vào một lần đổi tên khác.
                khoa = User.objects.select_for_update().get(pk=user.pk)
                if khoa.username != user.username:
                    raise CommandError(
                        f"Tài khoản id={khoa.pk} vừa bị tiến trình khác đổi username. Chạy lại để kiểm."
                    )
            so_thong_bao = self._sua_thong_bao(ten_cu, user.username) if ten_cu is not None else 0
            kh = self._lap_ke_hoach(user, ten_dem=None)
            kh.so_thong_bao = so_thong_bao
            if dong_bo:
                self._xep_dong_bo(user, kh)
            return kh

        ke_hoach, loi_hook = self._ghi_roi_commit(viec)
        if ten_cu is not None:
            self.stdout.write(f"  hàng thông báo còn mang tên cũ đã sửa: {ke_hoach.so_thong_bao}")
        van_de = self._sau_commit(
            user,
            ke_hoach,
            ten_cu=ten_cu,
            dong_bo=dong_bo,
            lam_moi_cache=ten_cu is not None,
            loi_hook=loi_hook,
        )
        self._ket_thuc(van_de)

    def _ke_hoach_chay_bu(
        self, user: User, ke_hoach: KeHoach, *, ten_cu: str | None, dong_bo: bool
    ) -> None:
        """Dry-run của nhánh "đã là tên mới"."""
        self.stdout.write(self.style.WARNING("DRY-RUN — không ghi gì. Thêm --ap-dung để chạy bù."))
        if ten_cu is not None:
            con_lai = Notification.objects.filter(
                **{f"payload__{KHOA_PAYLOAD_USERNAME}": ten_cu}
            ).count()
            self.stdout.write(
                f"  hàng thông báo còn mang tên cũ sẽ sửa payload[{KHOA_PAYLOAD_USERNAME!r}]: {con_lai}"
            )
            self.stdout.write(
                f"  mạch sẽ làm mới cache lại: {len(ke_hoach.can_lam_moi)}"
                + ("" if self._revalidate_bat() else " — NHƯNG REVALIDATE_SECRET chưa đặt nên lệnh sẽ không gọi được Next")
            )
        if dong_bo:
            self.stdout.write(
                f"  [dry-run] --ap-dung --dong-bo-tim-kiem sẽ đồng bộ lại "
                f"{len(ke_hoach.mach_cua)} mạch của tài khoản và bình luận của "
                f"{len(self._mach_dong_bo_binh_luan(user, ke_hoach))} mạch khác, rồi đọc ngược chỉ mục để xác nhận."
            )
        else:
            self._dong_chua_dong_bo()

    # --- dry-run ------------------------------------------------------------

    def _dry_run(self, nguon: User, thanh: str, *, dong_bo: bool) -> None:
        ke_hoach = self._lap_ke_hoach(nguon, ten_dem=nguon.username)
        self.stdout.write(
            self.style.WARNING("DRY-RUN — không ghi gì. Thêm --ap-dung để ghi thật.")
        )
        self.stdout.write(f"  tài khoản id={nguon.pk}: username → {thanh!r}")
        self.stdout.write(f"  hàng thông báo sẽ sửa payload[{KHOA_PAYLOAD_USERNAME!r}]: {ke_hoach.so_thong_bao}")
        self.stdout.write(
            f"  mạch sẽ làm mới cache: {len(ke_hoach.can_lam_moi)} "
            f"({len(ke_hoach.mach_cua)} của tài khoản + {len(ke_hoach.mach_nguoi_khac)} của người khác)"
            + ("" if self._revalidate_bat() else " — NHƯNG REVALIDATE_SECRET chưa đặt nên lệnh sẽ không gọi được Next")
        )
        if dong_bo:
            n_binh_luan = len(self._mach_dong_bo_binh_luan(nguon, ke_hoach))
            self.stdout.write(
                f"  tìm kiếm sẽ đồng bộ: {len(ke_hoach.mach_cua)} tài liệu mạch "
                f"+ bình luận của {n_binh_luan} mạch khác"
            )
        else:
            self._dong_chua_dong_bo()
        self._dong_audit()

    # --- ghi thật -----------------------------------------------------------

    def _ap_dung(self, nguon: User, tu: str, thanh: str, *, dong_bo: bool) -> None:
        if dong_bo:
            # Kiểm TRƯỚC khi ghi: Meili chết thì dừng ở đây, chưa đổi gì. Không có dòng này,
            # `dong_bo_mach` (bị `_bat()` gác hoặc nuốt lỗi lúc `on_commit`) sẽ im lặng.
            self._kiem_meili_song()

        def viec() -> tuple[User, KeHoach]:
            user = User.objects.select_for_update().get(pk=nguon.pk)
            if user.username != tu:
                raise CommandError(
                    f"Tài khoản id={user.pk} vừa bị tiến trình khác đổi username. Chạy lại để kiểm."
                )
            # Tra lại trong khoá: giữa dry-run và đây có thể đã có người chiếm tên.
            self._kiem_trung(thanh, user.pk)

            user.username = thanh
            user.save(update_fields=["username"])
            so_thong_bao = self._sua_thong_bao(tu, thanh)

            ke_hoach = self._lap_ke_hoach(user, ten_dem=None)
            ke_hoach.so_thong_bao = so_thong_bao
            if dong_bo:
                self._xep_dong_bo(user, ke_hoach)
            return user, ke_hoach

        (user, ke_hoach), loi_hook = self._ghi_roi_commit(viec)

        self.stdout.write(self.style.SUCCESS(f"Đã đổi username của tài khoản id={user.pk} → {thanh!r}."))
        self.stdout.write(f"  hàng thông báo đã sửa: {ke_hoach.so_thong_bao}")
        van_de = self._sau_commit(
            user, ke_hoach, ten_cu=tu, dong_bo=dong_bo, lam_moi_cache=True, loi_hook=loi_hook
        )
        self._ket_thuc(van_de)

    def _ghi_roi_commit(self, viec):
        """Chạy `viec()` trong MỘT `atomic()`. Trả `(kết quả của viec, lỗi on_commit | None)`.

        Lỗi TRƯỚC commit (kể cả `CommandError` của chính lệnh) ⇒ ném tiếp, transaction đã
        hoàn tác. Lỗi do một hàm `on_commit` ném RA SAU khi Postgres đã commit — thực tế là
        `dong_bo_binh_luan_theo_mach` (`core/tim_kiem.py`) đăng ký `_..._ngay` trần, không
        bọc `try`, nên `MeiliHong` bay ra khỏi `atomic().__exit__` khi username đã đổi. Ném
        tiếp lúc đó là cho người vận hành một traceback trông như "chưa đổi gì". Phân biệt
        hai ca bằng một móc `on_commit` đăng ký ĐẦU TIÊN: nó chỉ chạy khi đã commit.
        (Django chạy các móc theo thứ tự đăng ký và dừng ở móc đầu tiên ném lỗi.)
        """
        da_commit: list[bool] = []
        ket: list = []
        try:
            with transaction.atomic():
                transaction.on_commit(lambda: da_commit.append(True))
                ket.append(viec())
        except CommandError:
            raise
        except Exception as loi:
            if not da_commit:
                raise
            return ket[0], loi
        return ket[0], None

    def _ket_thuc(self, van_de: list[str]) -> None:
        if van_de:
            raise CommandError(
                "Username ĐÃ đổi trong DB (không hoàn tác), nhưng việc sau commit chưa xong:\n  - "
                + "\n  - ".join(van_de)
            )

    def _sua_thong_bao(self, tu: str, thanh: str) -> int:
        """Đổi `payload["boi"]` từ `tu` sang `thanh`, theo lô. Phải gọi TRONG `atomic()`.

        Lọc bằng `payload__boi=tu` (so khớp CHÍNH XÁC chuỗi JSON): hàng nào `boi` là tên
        khác — kể cả tên chỉ khác hoa thường — không bị đụng. Con trỏ `pk__gt` thay vì
        "lấy lô đầu tới khi hết": đúng cả khi một hàng nào đó vì lý do gì vẫn khớp sau khi sửa.

        `select_for_update()`: `bulk_update` ghi đè cả `payload` từ bản đã đọc, nên không khoá
        thì một upsert đồng thời của chính hàng ấy (`dedupe_key`) chen vào giữa là mất cập
        nhật và gán nhầm người. `order_by("pk")` giữ thứ tự khoá nhất quán giữa các lô.
        """
        da_sua = 0
        pk_cuoi = 0
        while True:
            lo = list(
                Notification.objects.select_for_update()
                .filter(**{f"payload__{KHOA_PAYLOAD_USERNAME}": tu}, pk__gt=pk_cuoi)
                .order_by("pk")[:CO_LO_THONG_BAO]
            )
            if not lo:
                return da_sua
            for h in lo:
                h.payload[KHOA_PAYLOAD_USERNAME] = thanh
            Notification.objects.bulk_update(lo, ["payload"])
            da_sua += len(lo)
            pk_cuoi = lo[-1].pk

    # --- gom tập bị ảnh hưởng -----------------------------------------------

    def _lap_ke_hoach(self, user: User, *, ten_dem: str | None = None) -> KeHoach:
        """`ten_dem`: đếm hàng thông báo có `payload["boi"]` bằng tên này (cho dry-run)."""
        mach_cua = sorted(Mach.objects.filter(author=user).values_list("pk", flat=True))
        co_dau = {
            *Moc.objects.filter(author=user).values_list("mach_id", flat=True),
            *Comment.objects.filter(author=user).values_list("mach_id", flat=True),
        }
        so_thong_bao = (
            Notification.objects.filter(**{f"payload__{KHOA_PAYLOAD_USERNAME}": ten_dem}).count()
            if ten_dem is not None
            else 0
        )
        return KeHoach(
            so_thong_bao=so_thong_bao,
            mach_cua=mach_cua,
            mach_nguoi_khac=sorted(co_dau - set(mach_cua)),
        )

    def _mach_dong_bo_binh_luan(self, user: User, ke_hoach: KeHoach) -> list[int]:
        """Mạch cần `dong_bo_binh_luan_theo_mach`: có bình luận của tài khoản, TRỪ mạch của
        chính tài khoản — `dong_bo_mach` đã kéo theo (cascade) bình luận của mạch nó đồng bộ."""
        co_binh_luan = set(Comment.objects.filter(author=user).values_list("mach_id", flat=True))
        return sorted(co_binh_luan - set(ke_hoach.mach_cua))

    # --- sau commit ---------------------------------------------------------

    def _sau_commit(
        self,
        user: User,
        ke_hoach: KeHoach,
        *,
        ten_cu: str | None,
        dong_bo: bool,
        lam_moi_cache: bool,
        loi_hook: Exception | None,
    ) -> list[str]:
        """Mọi việc SAU commit, theo thứ tự: báo lỗi hook → revalidate → tìm kiếm.

        Trả danh sách vấn đề (rỗng = ổn). Revalidate luôn được thử, kể cả khi hook tìm kiếm
        đã ném: hai việc độc lập, và cache cũ còn công khai email cũ.
        """
        van_de: list[str] = []
        if loi_hook is not None:
            van_de.append(
                f"ĐÃ COMMIT: username đã đổi; đồng bộ tìm kiếm lỗi: {loi_hook}; "
                "chạy lại với --ap-dung --dong-bo-tim-kiem"
            )
        if lam_moi_cache:
            van_de += self._lam_moi_cache(ke_hoach)
        if not dong_bo:
            self._dong_chua_dong_bo()
        elif loi_hook is None:
            van_de += self._xac_nhan_tim_kiem(user, ke_hoach, ten_cu=ten_cu)
        self._dong_audit()
        return van_de

    def _lam_moi_cache(self, ke_hoach: KeHoach) -> list[str]:
        """Gọi Next ĐỒNG BỘ cho từng mạch, báo số lời gọi và số lỗi ĐO ĐƯỢC. Xem docstring module."""
        from core.digest import duong_dan_mach

        if not self._revalidate_bat():
            self.stdout.write(
                self.style.WARNING(
                    "  revalidate: đã gửi 0 lời gọi — REVALIDATE_SECRET chưa đặt ⇒ KHÔNG gọi được "
                    "Next; trang ISR giữ tên cũ tới lượt revalidate nền (tối đa 1 giờ)."
                )
            )
            return []

        duong = [
            duong_dan_mach(m)
            for m in Mach.objects.filter(pk__in=ke_hoach.can_lam_moi).only("pk", "slug").order_by("pk")
        ]
        dem = _DemLoi()
        log = revalidate.logger
        muc_cu = log.level
        log.addHandler(dem)
        if log.getEffectiveLevel() > logging.WARNING:
            log.setLevel(logging.WARNING)
        try:
            for d in duong:
                revalidate._gui(d)
        finally:
            log.removeHandler(dem)
            log.setLevel(muc_cu)

        so_loi = len(dem.ban_ghi)
        dong = f"  revalidate: đã gửi {len(duong)} lời gọi tới Next, {so_loi} lỗi."
        if not so_loi:
            self.stdout.write(dong)
            return []
        self.stdout.write(self.style.WARNING(dong))
        mau = "; ".join(dem.ban_ghi[:SO_MAU_LECH])
        return [
            f"revalidate: {so_loi}/{len(duong)} lời gọi lỗi ⇒ trang ISR có thể còn tên cũ tới "
            f"lượt revalidate nền (tối đa 1 giờ). Chạy lại cùng lệnh để gửi lại. Lỗi: {mau}"
        ]

    # --- tìm kiếm -----------------------------------------------------------

    def _kiem_meili_song(self) -> None:
        if not tim_kiem.suc_khoe():
            raise CommandError(
                "--dong-bo-tim-kiem: Meilisearch không trả lời (hoặc MEILI_URL/MEILI_KEY chưa đặt). "
                "Chưa đổi gì."
            )

    def _xep_dong_bo(self, user: User, ke_hoach: KeHoach) -> None:
        """Phải gọi TRONG `atomic()` — xem docstring module, mục 3."""
        for mach in Mach.objects.filter(pk__in=ke_hoach.mach_cua).order_by("pk"):
            tim_kiem.dong_bo_mach(mach)
        for mach_id in self._mach_dong_bo_binh_luan(user, ke_hoach):
            tim_kiem.dong_bo_binh_luan_theo_mach(mach_id)

    def _xac_nhan_tim_kiem(self, user: User, ke_hoach: KeHoach, *, ten_cu: str | None) -> list[str]:
        """Đọc ngược chỉ mục; chỉ khi khớp mới viết "ĐÃ XÁC NHẬN". Trả danh sách vấn đề."""
        thanh = user.username
        lech: list[str] = []
        so = (0, 0)
        for lan in range(max(1, SO_LAN_DOC_LAI)):
            if lan:
                time.sleep(BUOC_DOC_LAI_GIAY)
            try:
                lech, so = self._lech_chi_muc(user, ten_cu=ten_cu)
            except tim_kiem.MeiliHong as loi:
                self.stdout.write(
                    self.style.WARNING(
                        "  tìm kiếm: đã gửi lệnh đồng bộ, CHƯA xác nhận được kết quả "
                        f"(không đọc ngược được chỉ mục: {loi}). Kiểm bằng cách tìm theo tên mới."
                    )
                )
                return [
                    "tìm kiếm: CHƯA xác nhận được chỉ mục đã mang tên mới (không đọc ngược được: "
                    f"{loi}). Kiểm bằng cách tìm theo tên mới, hoặc chạy lại với --ap-dung --dong-bo-tim-kiem"
                ]
            if not lech:
                break
        if lech:
            self.stdout.write(
                self.style.WARNING("  tìm kiếm: đã gửi lệnh đồng bộ nhưng chỉ mục KHÔNG khớp sau khi đọc ngược.")
            )
            return [
                "tìm kiếm: chỉ mục KHÔNG khớp sau khi đọc ngược (Meilisearch có thể còn xếp hàng, hoặc "
                "khoá thiếu quyền ghi một index): " + "; ".join(lech)
                + ". Chạy lại với --ap-dung --dong-bo-tim-kiem sau khi kiểm Meilisearch"
            ]
        so_mach, so_bl = so
        self.stdout.write(
            f"  tìm kiếm: ĐÃ XÁC NHẬN bằng đọc ngược chỉ mục — {so_mach} tài liệu mạch + {so_bl} tài liệu "
            f"bình luận của tài khoản mang tác giả {thanh!r}"
            + (f"; không còn tài liệu nào mang tên cũ." if ten_cu is not None else ".")
        )
        return []

    def _lech_chi_muc(self, user: User, *, ten_cu: str | None) -> tuple[list[str], tuple[int, int]]:
        """So chỉ mục với Postgres. Trả `(các mục lệch, (số mạch khớp, số bình luận khớp))`.

        Mong đợi dùng chính `hien_cong_khai*` mà đường đồng bộ dùng: tài liệu của mạch/bình
        luận hiện công khai phải CÓ và mang `author` = tên mới; cái không hiện thì phải KHÔNG
        có. Thêm một lượt quét toàn chỉ mục tìm tài liệu còn mang tên cũ (nếu biết tên cũ) —
        đó mới là mục đích thật của lệnh. Ném `MeiliHong` khi không đọc được.
        """
        thanh = user.username
        tg_mach = self._tac_gia_trong_index(tim_kiem.TEN_INDEX)
        tg_bl = self._tac_gia_trong_index(tim_kiem.TEN_INDEX_BINH_LUAN)

        mach_mong = {
            m.pk: tim_kiem.hien_cong_khai(m)
            for m in Mach.objects.filter(author=user).select_related("sub", "author").order_by("pk")
        }
        bl_mong = {
            c.pk: tim_kiem.hien_cong_khai_binh_luan(c)
            for c in Comment.objects.filter(author=user).select_related("mach", "author").order_by("pk")
        }

        lech: list[str] = []
        khop = []
        for nhan, tg, mong in (("mạch", tg_mach, mach_mong), ("bình luận", tg_bl, bl_mong)):
            xau: list[str] = []
            n_khop = 0
            for ma, hien in mong.items():
                co = tg.get(ma, _VANG)
                if hien and co is _VANG:
                    xau.append(f"{nhan} {ma}: thiếu trong chỉ mục")
                elif hien and co != thanh:
                    xau.append(f"{nhan} {ma}: tác giả không phải tên mới")
                elif not hien and co is not _VANG:
                    xau.append(f"{nhan} {ma}: lẽ ra không được có trong chỉ mục")
                else:
                    n_khop += hien
            if ten_cu is not None:
                da_neu = {x.split(":")[0] for x in xau}
                xau += [
                    f"{nhan} {ma}: còn mang tên cũ"
                    for ma, a in sorted(tg.items())
                    if a == ten_cu and f"{nhan} {ma}" not in da_neu
                ]
            khop.append(n_khop)
            lech += xau[:SO_MAU_LECH]
            if len(xau) > SO_MAU_LECH:
                lech.append(f"…và {len(xau) - SO_MAU_LECH} {nhan} nữa")
        return lech, (khop[0], khop[1])

    @staticmethod
    def _tac_gia_trong_index(index: str) -> dict[int, str | None]:
        """`{id: author}` của MỌI tài liệu trong một index, phân trang. Ném `MeiliHong`."""
        ra: dict[int, str | None] = {}
        offset = 0
        while True:
            ket = tim_kiem._goi(
                "GET",
                f"/indexes/{index}/documents?fields={tim_kiem.KHOA_CHINH},author"
                f"&limit={CO_LO_DOC_CHI_MUC}&offset={offset}",
                timeout=tim_kiem.TIMEOUT_DOC_GIAY,
            )
            hang = ket.get("results", []) if isinstance(ket, dict) else []
            ra.update({h[tim_kiem.KHOA_CHINH]: h.get("author") for h in hang if tim_kiem.KHOA_CHINH in h})
            if len(hang) < CO_LO_DOC_CHI_MUC:
                return ra
            offset += CO_LO_DOC_CHI_MUC

    # --- dòng thông báo cố định ---------------------------------------------

    def _dong_chua_dong_bo(self) -> None:
        self.stdout.write(
            self.style.WARNING(
                "  Chỉ mục tìm kiếm CHƯA đồng bộ: tên cũ còn trong Meilisearch tới khi chạy lại "
                "với --ap-dung --dong-bo-tim-kiem (chỉ sau khi bản vá mạch riêng tư đã lên môi trường này)."
            )
        )

    def _dong_audit(self) -> None:
        self.stdout.write(
            "  AuditLog: bỏ qua (AuditLog.actor bắt buộc là một User, lệnh quản trị không có người thao tác)."
        )

    @staticmethod
    def _revalidate_bat() -> bool:
        return bool(getattr(settings, "REVALIDATE_SECRET", "")) and bool(
            getattr(settings, "REVALIDATE_URL", "")
        )


#: Dấu "không có trong chỉ mục", để phân biệt với tài liệu có `author` là `None`.
_VANG = object()
