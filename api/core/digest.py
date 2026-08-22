"""Email digest tuần — PLAN 5.8, Phase 6.

> *"Email digest: tuỳ chọn opt-in, gửi tuần — **8:00 sáng thứ Bảy giờ VN**, gộp mạch
> đang theo có diễn biến trong tuần."*

Module này lo **nội dung** và **luật thời gian**. Việc gửi nằm ở
`core/management/commands/gui_digest.py`; nó chỉ gọi `django.core.mail`, nên backend nào
đang cấu hình thì đi đường đó (xem `EMAIL_BACKEND` trong `config/settings.py`).

## Chỗ cắm của Phase 3 — ĐÃ CẮM (2026-08-23)

Danh sách người nhận cần trả lời câu *"ai đang theo mạch nào"*. Bảng `Follow` thuộc Phase
3 (PLAN 5.7), nên Mảng D đã để `nguoi_nhan_digest()` làm **một cửa duy nhất trả rỗng**
thay vì bịa sẵn một model — toàn bộ đường đi phía sau nó (gom diễn biến, dựng nội dung,
gửi) là code THẬT, chạy thật, có bài đo thật với danh sách người nhận tự dựng.

Phase 3 vì thế chỉ phải sửa **đúng một hàm**, và không dòng nào khác của module này đổi.
Ba luật mà Mảng D ghi sẵn ở docstring hàm đó (opt-in · còn hoạt động · không gửi cho chính
tác giả) đều được giữ nguyên chữ; luật thứ ba rút gọn được thành một điều kiện chính xác
chứ không phải xấp xỉ — lý do ở ngay tại chỗ.

Cái **chưa** đo được, đừng đọc mạnh hơn: máy dev không có SMTP nên `EMAIL_BACKEND` là
`filebased` (thư ra `api/.mail/`). "Dựng nội dung + giao cho backend" là đo được; "SMTP
nhận và chuyển thư" thì không.
"""

from dataclasses import dataclass
from datetime import datetime, timedelta

from django.db import models
from django.db.models import QuerySet

from core.models import Mach, Moc, User
from core.thoi_gian import TZ_VN

#: Thứ Bảy — `datetime.weekday()` đếm từ 0 = thứ Hai.
THU_GUI = 5
#: 8 giờ sáng **giờ VN**.
GIO_GUI_VN = 8
#: Cửa sổ gộp diễn biến: 7 ngày trước thời điểm gửi.
SO_NGAY_DIGEST = 7

#: Số mạch tối đa liệt kê trong một email. Người theo 80 mạch mà nhận một email 80 mục
#: thì không đọc mục nào; phần dôi ra được nói bằng một dòng "và N mạch nữa".
SO_MACH_TOI_DA = 15


def la_gio_gui(khi: datetime) -> bool:
    """Thời điểm này có phải khung gửi digest (8:00–8:59 **thứ Bảy giờ VN**) không?

    **Quy về giờ VN trước khi hỏi**, và đó là toàn bộ nội dung của hàm này. Hỏi thẳng
    `khi.weekday()`/`khi.hour` trên một `datetime` UTC — thứ Django trả về ở mọi nơi vì
    `USE_TZ = True` — lệch đúng 7 tiếng: nó sẽ gửi lúc **15:00 chiều thứ Bảy** giờ VN, và
    sẽ **không** gửi vào 8:00 sáng. Cùng loài lỗi mà `core/thoi_gian.py` được viết ra để
    dồn về một chỗ.

    Cả GIỜ chứ không phải một điểm: cron chạy theo giờ có thể trễ vài phút, và một điều
    kiện `== 8:00:00` là điều kiện gần như không bao giờ đúng.
    """
    vn = khi.astimezone(TZ_VN)
    return vn.weekday() == THU_GUI and vn.hour == GIO_GUI_VN


@dataclass(frozen=True)
class NguoiNhan:
    """Một người và những mạch họ đang theo."""

    user: User
    mach_ids: tuple[int, ...]


def nguoi_nhan_digest() -> list[NguoiNhan]:
    """Ai nhận digest, và họ theo mạch nào. **Đã cắm ở Phase 3** (trước đó trả rỗng).

    Bảng `Follow` (PLAN 5.7) và cờ `User.nhan_digest` nay đã có, nên hàm là một truy vấn.
    Mọi thứ phía sau — `gom_dien_bien`, `dung_digest`, lệnh `gui_digest` — không phải sửa
    một dòng nào: đó là cả điểm của cách để một cửa duy nhất.

    **Ba luật, và không luật nào suy ra được từ chữ ký hàm** — đó là lý do chúng được ghi
    ra ở đây từ lúc hàm còn trả rỗng:

    1. **chỉ user đã opt-in.** PLAN 5.8 nói rõ *"tuỳ chọn opt-in"*, và `User.nhan_digest`
       mặc định `False`. Đảo mặc định là biến mọi tài khoản đã có thành người đăng ký mà
       không ai bấm gì;
    2. **chỉ user còn hoạt động.** `is_active=False` là cách gikky cài "xoá tài khoản
       GDPR-lite" (`core/models/nguoi_dung.py`) — gửi thư tuần cho một tài khoản người ta
       đã rời đi là chuyện tệ hơn hẳn một dòng dữ liệu thừa. Kèm `email` không rỗng: không
       có địa chỉ thì không có gì để gửi, và một `NguoiNhan` như thế chỉ làm lệnh
       `gui_digest` đếm nhầm số thư nó tưởng đã gửi;
    3. **không gửi cho chính tác giả mạch.** Câu gốc của luật này là *"không gửi những mạch
       mà diễn biến duy nhất là mốc do chính họ vừa viết"* — và trên gikky nó rút gọn được
       thành một điều kiện CHÍNH XÁC, không phải xấp xỉ: chỉ tác giả mới nối được mốc
       (`api/machs.py::noi_moc`, 403 `khong_phai_chu` cho người khác), nên **mọi** diễn
       biến của một mạch đều do tác giả nó viết. Vì thế `exclude(mach__author=...)` phủ
       đúng luật, không hơn không kém. Nếu đồng tác giả mở ra ở phase sau thì câu rút gọn
       này hết đúng và phải quay lại lọc ở tầng `gom_dien_bien`.

    Sắp theo `user_id` rồi `mach_id` để lệnh gọi có thứ tự ổn định giữa hai lần chạy —
    bài đo đọc `mach_ids` theo vị trí, và một `set` không thứ tự ở đây làm chúng chớp nhoáng.
    """
    from core.models import Follow

    theo_user: dict[int, list[int]] = {}
    nguoi: dict[int, User] = {}
    hang = (
        Follow.objects.filter(
            user__nhan_digest=True,
            user__is_active=True,
        )
        .exclude(user__email="")
        .exclude(mach__author_id=models.F("user_id"))
        .exclude(mach__hidden_at__isnull=False)
        .select_related("user")
        .order_by("user_id", "mach_id")
    )
    for f in hang:
        theo_user.setdefault(f.user_id, []).append(f.mach_id)
        nguoi[f.user_id] = f.user
    return [
        NguoiNhan(user=nguoi[uid], mach_ids=tuple(ids))
        for uid, ids in theo_user.items()
    ]


@dataclass(frozen=True)
class MucDigest:
    """Một dòng trong email: mạch nào, có bao nhiêu mốc mới, mốc mới nhất là mốc nào."""

    mach: Mach
    so_moc_moi: int
    seq_moi_nhat: int


def _mocs_moi(mach_ids, tu_luc: datetime, den_luc: datetime) -> QuerySet[Moc]:
    """Mốc **đọc được** được viết trong cửa sổ `[tu_luc, den_luc)`.

    Ba bộ lọc, mỗi cái đóng một cửa khác nhau:

    - `deleted_at`/`hidden_at` trên `Moc`: bia mộ và mốc bị mod ẩn không phải "diễn biến"
      — gửi email báo có mốc mới rồi người ta bấm vào thấy `[đã xoá]` là tệ hơn im lặng;
    - `mach__hidden_at`: mạch bị mod ẩn thì không có gì để báo;
    - `created_at` (dấu thời gian **server**, bất biến) chứ không `occurred_at`: mốc nhập
      lùi ngày là chuyện bình thường (PLAN nguyên tắc 3), và lọc theo ngày người dùng đặt
      sẽ vừa bỏ sót mốc mới vừa lôi lại mốc cũ.
    """
    return (
        Moc.objects.filter(
            mach_id__in=list(mach_ids),
            created_at__gte=tu_luc,
            created_at__lt=den_luc,
            deleted_at__isnull=True,
            hidden_at__isnull=True,
            mach__hidden_at__isnull=True,
        )
        .select_related("mach", "mach__sub")
        .order_by("mach_id", "seq")
    )


def gom_dien_bien(
    mach_ids, tu_luc: datetime, den_luc: datetime
) -> list[MucDigest]:
    """Mạch nào có mốc mới trong cửa sổ, mỗi mạch một mục.

    Sắp theo **số mốc mới giảm dần** rồi `-last_entry_at`: mạch chạy nhiều nhất nằm trên,
    và đó là thứ tự người đọc muốn khi họ chỉ đọc ba dòng đầu.
    """
    theo_mach: dict[int, list[Moc]] = {}
    for moc in _mocs_moi(mach_ids, tu_luc, den_luc):
        theo_mach.setdefault(moc.mach_id, []).append(moc)

    muc = [
        MucDigest(mach=mocs[0].mach, so_moc_moi=len(mocs), seq_moi_nhat=mocs[-1].seq)
        for mocs in theo_mach.values()
    ]
    muc.sort(key=lambda m: (-m.so_moc_moi, -m.mach.last_entry_at.timestamp()))
    return muc


@dataclass(frozen=True)
class Digest:
    tieu_de: str
    than: str
    so_mach: int


def duong_dan_mach(mach: Mach) -> str:
    """`/m/<slug>-<id>` — PLAN 5.9. Cùng luật với `apps/web/lib/url.ts::duongDanMach`.

    Hai bản của cùng một luật, ở hai ngôn ngữ. Không có cách nào tránh mà không dựng một
    endpoint chỉ để hỏi URL của chính mình; đổi lại, luật này là một dòng và nó được ghim
    ở `tests/test_digest.py`.
    """
    return f"/m/{mach.slug}-{mach.pk}"


def dung_digest(
    nguoi_nhan: NguoiNhan,
    tu_luc: datetime,
    den_luc: datetime,
    goc_site: str,
) -> Digest | None:
    """Nội dung email cho một người. `None` khi **không có diễn biến nào**.

    `None` chứ không phải một email rỗng: PLAN 5.8 gọi đây là digest "gộp mạch đang theo
    **có diễn biến** trong tuần". Một email hằng tuần nói "tuần này không có gì" là cách
    nhanh nhất để người ta bấm huỷ đăng ký — và lệnh gọi hàm này đếm số `None` để báo ra,
    nên nó không biến mất im lặng.

    Thân thư là **văn bản thuần**. HTML sẽ tới cùng lúc với template email của Phase 2
    (xác thực email cũng cần); ở đây một bản text đọc được ở mọi client còn hơn một bản
    HTML nửa vời không ai xem trên máy này (không có SMTP để nhìn thử).
    """
    muc = gom_dien_bien(nguoi_nhan.mach_ids, tu_luc, den_luc)
    if not muc:
        return None

    ten = nguoi_nhan.user.display_name or nguoi_nhan.user.username
    tong_moc = sum(m.so_moc_moi for m in muc)
    tieu_de = (
        f"gikky.net · {len(muc)} mạch bạn theo có diễn biến "
        f"({tong_moc} mốc mới tuần này)"
    )

    dong = [
        f"Chào {ten},",
        "",
        f"Tuần vừa rồi có {tong_moc} mốc mới trên {len(muc)} mạch bạn đang theo:",
        "",
    ]
    for m in muc[:SO_MACH_TOI_DA]:
        dong.append(f"• {m.mach.title}")
        dong.append(
            f"  s/{m.mach.sub.slug} · {m.so_moc_moi} mốc mới · mới nhất là mốc "
            f"{m.seq_moi_nhat}/{m.mach.entry_count}"
        )
        dong.append(f"  {goc_site}{duong_dan_mach(m.mach)}")
        dong.append("")
    if len(muc) > SO_MACH_TOI_DA:
        dong.append(f"…và {len(muc) - SO_MACH_TOI_DA} mạch nữa có diễn biến.")
        dong.append("")

    dong += [
        "— gikky.net",
        "Nội dung trên gikky do người dùng đăng, không phải khuyến nghị đầu tư.",
        f"Bỏ nhận thư này: {goc_site}/cai-dat",
    ]
    return Digest(tieu_de=tieu_de, than="\n".join(dong), so_mach=len(muc))


def cua_so(den_luc: datetime, so_ngay: int = SO_NGAY_DIGEST) -> tuple[datetime, datetime]:
    """Cửa sổ `[den_luc - so_ngay, den_luc)`.

    Cửa sổ **trượt theo thời điểm gửi**, không phải "từ nửa đêm thứ Bảy trước": digest
    chạy đúng một lần mỗi tuần ở cùng một giờ, nên hai lần chạy liên tiếp phủ kín nhau
    không chồng lấn. Neo vào nửa đêm sẽ bỏ sót mọi thứ xảy ra giữa nửa đêm và 8:00 của
    lần gửi trước.
    """
    return den_luc - timedelta(days=so_ngay), den_luc
