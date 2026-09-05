"""Hẹn giờ phát hành — hai cửa GHI của khu quản trị (`plans/2026-09-03-hen-gio-phat-hanh.md`).

User: *"thêm published_at để có thể viết bài trước, sau đó publish vào một thời điểm khác
trong tương lai… Tính năng **chỉ dùng trong admin**."*

## Vì sao ở đây chứ không ở `POST /api/v1/machs`

Câu "chỉ dùng trong admin" là một ràng buộc, không phải một sở thích: `POST /machs` công
khai **không nhận** `published_at`, và nó không nhận vì mọi trường một endpoint công khai
nhận là một trường mọi người dùng đăng nhập gửi được. Một người thường hẹn giờ được là
một bài nằm ẩn trong DB rồi tự lên feed — không mod nào thấy nó trước lúc nó lên.

## Ba luật của file

1. **Handler làm đúng ba việc**: tra hàng, gọi xuống `core/ghi.py`, dựng response. Luật
   domain (khoá hàng, thứ tự tác dụng phụ, "có đổi gì không") sống ở đường ghi — cùng
   quy ước với `quan_tri_kiem_duyet.py` và `quan_tri_sua_bai.py`.
2. **`auth` = staff**, không đòi superuser. Đây là thao tác *lập lịch*, đảo ngược được
   bằng đúng cái nút bên cạnh — khác hẳn nhóm superuser-only (đổi OAuth, đặt mật khẩu hộ,
   viết lại chữ của người khác). Phân quyền của cả hai cửa được chấm tự động ở
   `tests/test_api_quan_tri_phan_quyen.py`.
3. **Bài mod đã ẩn ⇒ 409, không phải 403.** Hai mã, hai việc phải làm: 403 là "bạn không
   được phép", 409 là "gỡ ẩn trước rồi quay lại". Không cho lách quyết định kiểm duyệt
   bằng một cái hẹn giờ — xem `core/ghi.py::hen_gio_mach`.

## Múi giờ — chỗ sai đắt nhất của tính năng này

`published_at` phải đến kèm **offset tường minh** (`2026-09-10T08:00:00+07:00`). Một chuỗi
không offset là một cái hẹn lệch 7 tiếng, và nó lệch **im lặng**: bài vẫn lên, chỉ là lên
lúc 15:00 thay vì 08:00. Django `USE_TZ=True` nên một `datetime` naive cũng làm mọi phép
so sánh trong truy vấn ném `RuntimeWarning`; ở đây nó bị chặn thành 400 ngay cửa vào chứ
không để trôi xuống đường ghi.
"""

from datetime import datetime

from django.db import transaction
from django.utils import timezone
from ninja import Router, Status

from core.ghi import hen_gio_mach, phat_hanh_mach, tao_mach, tu_upvote
from core.management.commands.tao_tai_khoan_doi import TAI_KHOAN
from core.models.dien_dan import Mach, Sub
from core.models.nguoi_dung import User
from core.thong_bao import bao_mach_moi

from api.ghi_chung import kiem_occurred_at
from api.loi import LoiOut, khong_tim_thay, loi
from api.machs import figures_ra_dict
from api.quan_tri_kiem_duyet import duong_dan_mach
from api.quan_tri_loc import dang_hen_gio
from api.quan_tri_schemas import HenGioMachIn, KetQuaHenGioOut, MachHenGioMoiIn
from api.quyen import DU_LIEU_KHONG_HOP_LE, LoiGhi, NOI_DUNG_DA_GO

router = Router()

#: Tài khoản mà khu quản trị được **đăng bài thay mặt**. Suy thẳng từ bảng nguồn của
#: `manage.py tao_tai_khoan_doi` thay vì chép hai chuỗi vào đây: hai bản sẽ lệch đúng vào
#: ngày ai đó đổi username của một tài khoản đội, và triệu chứng là 400 "không nằm trong
#: danh sách" cho một tài khoản đang tồn tại.
#:
#: Lọc bỏ `is_superuser` — `admin` cũng nằm trong bảng ấy, nhưng nó là tài khoản QUẢN TRỊ,
#: không phải một cây bút. Bài ký tên `admin` trên feed công khai là một danh tính rò ra
#: chỗ không cần nó.
TAI_KHOAN_DANG_BAI: tuple[str, ...] = tuple(
    username for _, username, _, la_super in TAI_KHOAN if not la_super
)

TRA_LOI_HEN_GIO = {
    200: KetQuaHenGioOut,
    400: LoiOut,
    401: LoiOut,
    403: LoiOut,
    404: LoiOut,
    409: LoiOut,
}


def _doi_co_mui_gio(khi: datetime | None) -> None:
    """`datetime` naive ⇒ 400. Xem khối *Múi giờ* ở đầu file."""
    if khi is not None and khi.utcoffset() is None:
        raise LoiGhi(
            400,
            DU_LIEU_KHONG_HOP_LE,
            "published_at phải kèm múi giờ tường minh, ví dụ "
            "'2026-09-10T08:00:00+07:00'. Thiếu offset là hẹn lệch 7 tiếng.",
        )


def _ket_qua(mach: Mach, *, da_doi: bool) -> KetQuaHenGioOut:
    """Trạng thái hẹn giờ hiện thời của một mạch — hình dạng chung của cả hai cửa."""
    return KetQuaHenGioOut(
        da_doi=da_doi,
        id=mach.pk,
        title=mach.title,
        published_at=mach.published_at,
        da_hen_gio=dang_hen_gio(mach),
        duong_dan_cong_khai=duong_dan_mach(mach),
    )


@router.patch(
    "/machs/{int:mach_id}/hen-gio",
    response=TRA_LOI_HEN_GIO,
    operation_id="quan_tri_hen_gio_mach",
    tags=["quan-tri-hen-gio"],
)
def hen_gio_mach_quan_tri(request, mach_id: int, du_lieu: HenGioMachIn):
    """Đặt / dời / huỷ lịch phát hành của một mạch.

    Ba đường vào, một endpoint, vì cả ba là **cùng một câu hỏi** ("bài này lên sóng lúc
    nào") và tách chúng ra là ba nút cùng sửa một cột:

    - `published_at` ở **tương lai** ⇒ bài rời khỏi mọi cửa công khai, chờ tới giờ đó;
    - `published_at` = `null` ⇒ **phát hành ngay**, `published_at` ghi lại thành *bây
      giờ*. Đây là nút *Bỏ hẹn* của admin;
    - `published_at` ở **quá khứ** ⇒ cũng là phát hành ngay, cùng đường trên. Plan §2 gộp
      hai ca này làm một câu ("null hoặc quá khứ ⇒ phát hành ngay"), nên chúng đi chung
      một nhánh và cùng ghi giờ phát hành = bây giờ. Giữ lại con số quá khứ người ta gửi
      lên sẽ chôn bài xuống giữa feed — im lặng, và không phải thứ ai bấm nút muốn.

    **Bài mod đã ẩn ⇒ 409** (`noi_dung_da_go`), kể cả để phát hành ngay: gỡ ẩn là quyết
    định kiểm duyệt, nó có nút riêng ở ngay trang này.

    Phát hành ngay chạy **đúng chuỗi tác dụng phụ** của một bài mới lên sóng — thông báo
    cho người theo tác giả, đẩy vào index tìm kiếm, làm mới cache Next. Chuỗi ấy nằm ở
    `core/ghi.py::phat_hanh_mach`, dùng chung với `manage.py phat_hanh_da_hen`.

    Idempotent: gọi *phát hành ngay* trên bài đang hiện trả 200 `da_doi=false`, không
    thông báo lại, không dòng nhật ký nào — cùng luật "không đổi thì không ghi log" của
    khối moderation.
    """
    _doi_co_mui_gio(du_lieu.published_at)
    mach = Mach.objects.filter(pk=mach_id).first()
    if mach is None:
        return khong_tim_thay("mạch")
    if mach.hidden_by_id is not None:
        return loi(
            409,
            NOI_DUNG_DA_GO,
            "Bài này đang bị mod gỡ — gỡ ẩn trước rồi mới hẹn giờ hay phát hành được.",
        )

    # Ranh giới giữa "hẹn" và "phát hành ngay". `<=` chứ không `<`: một mốc bằng đúng
    # `now()` đã tới hạn — cùng quy ước với `phat_hanh_da_hen` (`published_at__lte`), và
    # hai vế lệch nhau ở đây là một bài rơi vào khe không cửa nào nhặt.
    if du_lieu.published_at is None or du_lieu.published_at <= timezone.now():
        hang = phat_hanh_mach(
            mach_id=mach.pk,
            boi=request.user,
            ly_do=du_lieu.ly_do,
            dat_gio_phat_hanh=True,
        )
        if hang is None:
            # Bài vốn đã hiện (hoặc vừa bị mod ẩn giữa hai lượt đọc) — không có gì để
            # phát hành. Đọc lại từ DB thay vì trả `mach` trong tay: object ấy có thể đã
            # ôi đúng vì cái đua vừa nói.
            mach.refresh_from_db()
            return _ket_qua(mach, da_doi=False)
        return _ket_qua(hang, da_doi=True)

    hang = hen_gio_mach(
        mach_id=mach.pk,
        published_at=du_lieu.published_at,
        boi=request.user,
        ly_do=du_lieu.ly_do,
    )
    if hang is None:
        # Mod vừa ẩn bài giữa lượt kiểm ở trên và lượt khoá ở dưới. Cùng câu trả lời với
        # nhánh 409 phía trên — kiểm hai lần vì lượt đầu chạy NGOÀI khoá.
        return loi(
            409,
            NOI_DUNG_DA_GO,
            "Bài này vừa bị mod gỡ — gỡ ẩn trước rồi mới hẹn giờ được.",
        )
    return _ket_qua(hang, da_doi=True)


@router.post(
    "/machs/hen-gio",
    response={201: KetQuaHenGioOut, 400: LoiOut, 401: LoiOut, 403: LoiOut, 404: LoiOut},
    operation_id="quan_tri_tao_mach_hen_gio",
    tags=["quan-tri-hen-gio"],
)
def tao_mach_hen_gio(request, du_lieu: MachHenGioMoiIn):
    """Đăng bài **thay mặt một tài khoản đội**, có thể hẹn giờ. Cửa cho 100–200 bài viết trước.

    Cùng bộ trường nội dung với `POST /api/v1/machs` (bài gốc *chính là* mốc 1), cộng hai
    trường khu quản trị: `author` và `published_at`.

    **`author` bị chặn bằng allowlist**, không phải "user nào cũng được": đăng bài dưới
    tên người khác là mạo danh, và một cửa quản trị làm được điều đó cho *mọi* tài khoản
    là một cửa viết bài ký tên người dùng thật. Danh sách là hai tài khoản đội ở
    `TAI_KHOAN_DANG_BAI`.

    `published_at` tương lai ⇒ bài ra đời **đang ẩn**, không thông báo, không vào index —
    ba tác dụng phụ ấy tự tắt vì bài đang ẩn, không phải vì một nhánh `if` ở đây (xem
    `core/ghi.py::tao_mach`).

    Không gửi, hoặc gửi mốc **quá khứ** ⇒ bài lên ngay như một bài thường, kèm chuông cho
    người theo tác giả — và `published_at` ghi xuống là *bây giờ*, **không phải** con số
    quá khứ đã gửi. Nói ra vì nó im lặng: đây không phải cửa nhập bài cũ với ngày cũ. Lùi
    ngày đăng là một tính năng khác (nó đẩy bài xuống giữa feed) và plan §6 chưa mở nó.

    **Không có hạn mức 10 bài/ngày** như cửa v1. Trần ấy tồn tại để chặn spam từ tài khoản
    người dùng; ở đây người gọi là mod và cả điểm của endpoint là đăng 200 bài một đợt.
    """
    _doi_co_mui_gio(du_lieu.published_at)
    kiem_occurred_at(du_lieu.occurred_at)
    if du_lieu.author not in TAI_KHOAN_DANG_BAI:
        return loi(
            400,
            DU_LIEU_KHONG_HOP_LE,
            f"author phải là một trong {', '.join(TAI_KHOAN_DANG_BAI)} — "
            "không đăng bài dưới tên tài khoản khác được.",
        )
    tac_gia = User.objects.filter(username=du_lieu.author).first()
    if tac_gia is None:
        return khong_tim_thay(f"tài khoản {du_lieu.author!r}")
    sub = Sub.objects.filter(slug=du_lieu.sub).first()
    if sub is None:
        return khong_tim_thay(f"chuyên mục {du_lieu.sub!r}")

    with transaction.atomic():
        mach, _moc = tao_mach(
            sub=sub,
            author=tac_gia,
            title=du_lieu.title.strip(),
            body=du_lieu.body,
            occurred_at=du_lieu.occurred_at,
            loai=du_lieu.loai,
            question_for_crowd=du_lieu.question_for_crowd,
            figures=figures_ra_dict(du_lieu.figures),
            published_at=du_lieu.published_at,
        )
        # Cùng chỗ, cùng lý do với `api/machs.py::tao_mach_api` (PLAN 5.7): `0` trên cột
        # vote phải nghĩa là "đã có người dìm", không phải "chưa ai đụng". Bài hẹn đang
        # ẩn nên điểm ấy không lộ ra feed cho tới lúc phát hành.
        tu_upvote(target=_moc)
        # TRONG transaction, SAU `tao_mach` (cạnh `Mach → User` của `core/ghi.py`). Bài
        # hẹn giờ đang ẩn nên hàm trả 0 ngay dòng đầu — chuông nổ lúc phát hành.
        bao_mach_moi(mach)
    mach.refresh_from_db()
    return Status(201, _ket_qua(mach, da_doi=True))
