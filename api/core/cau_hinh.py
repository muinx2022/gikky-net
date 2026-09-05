"""Cấu hình "cửa sổ tự sửa bài" — MỘT hàng duy nhất, `plans/2026-09-05-cua-so-tu-sua-bai.md`.

Module MỚI, tách khỏi `core/ghi.py` để không trộn hai khái niệm cùng đo bằng phút kể từ
`Moc.created_at` nhưng khác hẳn nhau:

- `core/ghi.py::PHUT_SUA_IM_LANG` — cửa sổ ĐỂ VẾT audit hay không (sửa trong 15 phút đầu
  thì im lặng, không `MocRevision`);
- `PHUT_TU_SUA_MAC_DINH` ở đây — cửa sổ có QUYỀN TỰ SỬA hay không. Hết cửa sổ này, tác giả
  nhận 403 `het_cua_so_sua` ở `PATCH /api/v1/mocs/{id}`; chỉ superuser sửa tiếp được, qua
  khu quản trị (không giới hạn thời gian).

Hai bảng cấu hình, hai hằng số, không gộp — xem `core/models/he_thong.py::CauHinhBienTap`
để biết vì sao `PHUT_TU_SUA_MAC_DINH` được khai ở ĐÓ (cạnh model dùng nó làm `default`)
rồi import lại vào đây, chứ không khai thẳng ở module này như PLAN mô tả ban đầu: khai
ở đây rồi cho model import ngược lại dựng một vòng import (`core/cau_hinh.py` cũng cần
`CauHinhBienTap` để `get_or_create`).
"""

from datetime import datetime

from django.core.exceptions import ValidationError

from core.ghi import AUDIT_SUA_CAU_HINH_BIEN_TAP, DICH_CAI_DAT, ghi_audit
from core.models.dien_dan import Mach
from core.models.he_thong import CauHinhBienTap, PHUT_TU_SUA_MAC_DINH
from core.models.moc import Moc

__all__ = [
    "PHUT_TU_SUA_MAC_DINH",
    "PHUT_TU_SUA_TOI_DA",
    "doc_phut_tu_sua_moc",
    "luu_phut_tu_sua_moc",
    "moc_bat_dau_tu_sua",
]

#: Trần trên — 7 ngày (`7 * 24 * 60`). Chặn nhập nhầm số âm/khổng lồ mà không bịa một trần
#: tuỳ hứng: 7 ngày là đúng cửa sổ "mở lại mạch đã đóng sổ" (`core/ghi.py::NGAY_MO_LAI`),
#: tức khoảng thời gian dài nhất sản phẩm đã từng chốt cho một hành động của tác giả.
PHUT_TU_SUA_TOI_DA = 10_080


def doc_phut_tu_sua_moc() -> int:
    """Số phút tự sửa HIỆN HÀNH — đọc **MỘT** `SELECT`, không bao giờ ghi gì.

    Gọi MỘT LẦN ở nơi cần (một trang feed dùng chung một giá trị cấu hình cho mọi mốc) —
    đừng gọi trong vòng lặp per-mốc, đó là N+1 thật; `tests/test_api_so_query.py` ghim
    con số truy vấn của `GET /machs/{id}` và mọi cửa gọi hàm này.

    ⚠ **Cố ý KHÔNG `get_or_create`**, khác `luu_phut_tu_sua_moc` bên dưới. Hàm này chạy
    trên đường ĐỌC nóng nhất của site (mọi lượt tải trang mạch); `get_or_create` khi hàng
    `pk=1` chưa tồn tại còn mở một `SAVEPOINT` + `INSERT` — chi phí ba, bốn truy vấn thay
    vì một, và chỉ xảy ra ở lượt đầu tiên sau khi cấu hình được thêm vào hệ thống (tức
    đúng lúc `test_api_so_query.py` chạy trên DB rỗng). Trả về mặc định trong Python khi
    chưa có hàng nào — hàng chỉ thật sự được TẠO khi ai đó ghi qua `luu_phut_tu_sua_moc`.
    """
    cau_hinh = CauHinhBienTap.objects.filter(pk=1).first()
    return cau_hinh.phut_tu_sua_moc if cau_hinh is not None else PHUT_TU_SUA_MAC_DINH


def moc_bat_dau_tu_sua(moc: Moc, mach: Mach) -> datetime:
    """Mốc THỜI ĐIỂM bắt đầu đếm cửa sổ tự sửa — không phải luôn luôn `moc.created_at`.

    Hẹn giờ phát hành (`plans/2026-09-03-hen-gio-phat-hanh.md`, đã merge) cho phép mạch
    lên sóng ở TƯƠNG LAI so với lúc soạn, trong khi `Moc.created_at` luôn là lúc SOẠN.
    Đếm cửa sổ tự sửa từ `created_at` cho một bài hẹn giờ nghĩa là đồng hồ chạy trong lúc
    bài còn nằm im chưa ai thấy — cửa sổ có thể hết TRƯỚC KHI bài lên sóng.

    ## Vì sao `Mach.lan_dau_len_song`, không phải `Mach.published_at`

    Bản đầu của lượt này dùng thẳng `max(moc.created_at, mach.published_at)` — và đó là
    lỗi mà lượt phản biện thứ hai bắt được (`plans/2026-09-05-cua-so-tu-sua-bai.md`,
    mục 2): `published_at` không chỉ đại diện cho lần lên sóng ĐẦU TIÊN, nó bị GHI ĐÈ mỗi
    lần "rút bài xuống, phát hành lại" (`core/ghi.py::hen_gio_mach`, cơ chế đã có sẵn từ
    trước lượt này). Dùng nó làm mốc bắt đầu nghĩa là mỗi lần admin bấm phát hành lại,
    MỌI mốc cũ của mạch — kể cả mốc viết từ hàng tháng trước, đã hết hạn sửa từ lâu —
    đột nhiên "còn trong cửa sổ tự sửa" trở lại. `Mach.lan_dau_len_song` chỉ được ghi
    đúng MỘT LẦN (`core/ghi.py::tao_mach`, `phat_hanh_mach`), nên nó không có bệnh này.

    `max(...)` chứ không phải "nếu hẹn giờ thì dùng lan_dau_len_song": mốc 1 luôn trùng
    lúc mạch được tạo (`lan_dau_len_song == created_at` khi không hẹn giờ), nhưng mốc
    2, 3, ... nối thêm SAU đó vẫn phải đếm từ chính `created_at` của TỪNG mốc — bài không
    hẹn giờ thì `lan_dau_len_song <= created_at` của mọi mốc sau mốc 1, và `max` trả đúng
    `created_at`.

    `lan_dau_len_song is None` (bài hẹn giờ chưa từng lên sóng, hoặc dữ liệu cũ mà
    backfill của migration 0030 không suy ngược ra được) ⇒ ngã về `mach.created_at`,
    không đẩy cửa sổ đi đâu cả — đúng hành vi từ trước khi cột này tồn tại.

    Dùng CHUNG ở cả `api/mocs.py` (kiểm quyền PATCH) và `api/trinh_bay.py` (tính
    `sua_duoc_den` trả cho frontend) — hai nơi tính khác công thức là hai lớp phòng thủ
    lệch nhau, và lớp lệch sẽ là lớp không ai để ý sửa cùng lúc lớp kia đổi.
    """
    lan_dau = mach.lan_dau_len_song if mach.lan_dau_len_song is not None else mach.created_at
    return max(moc.created_at, lan_dau)


def luu_phut_tu_sua_moc(*, phut: int, boi, ly_do: str = "") -> tuple[CauHinhBienTap, bool]:
    """Đổi số phút tự sửa. Trả `(cấu hình, có đổi không)`.

    Y nguyên giá trị đang có ⇒ `(cau_hinh, False)`, KHÔNG ghi audit — cùng luật "không đổi
    thì không vết" của `core/ghi.py::sua_moc_boi_mod`. `1 <= phut <= PHUT_TU_SUA_TOI_DA`,
    ném `ValidationError` (dịch thành 400 ở tầng API) nếu ngoài khoảng.
    """
    if not (1 <= phut <= PHUT_TU_SUA_TOI_DA):
        raise ValidationError(
            f"Số phút tự sửa phải trong khoảng 1–{PHUT_TU_SUA_TOI_DA} (7 ngày), nhận {phut}."
        )
    cau_hinh, _ = CauHinhBienTap.objects.get_or_create(pk=1)
    if cau_hinh.phut_tu_sua_moc == phut:
        return cau_hinh, False

    phut_cu = cau_hinh.phut_tu_sua_moc
    cau_hinh.phut_tu_sua_moc = phut
    cau_hinh.save(update_fields=["phut_tu_sua_moc"])
    ghi_audit(
        actor=boi,
        action=AUDIT_SUA_CAU_HINH_BIEN_TAP,
        target_type=DICH_CAI_DAT,
        target_id=cau_hinh.pk,
        phut_cu=phut_cu,
        phut_moi=phut,
        ly_do=ly_do,
    )
    return cau_hinh, True
