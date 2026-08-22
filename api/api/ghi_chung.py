"""Nạp hàng + phép kiểm dùng chung cho MỌI endpoint ghi — PLAN 5.1, 5.2, 5.10.

Vì sao gom lại một chỗ: bốn luật dưới đây phải đúng ở **tám** đường ghi (tạo mạch, nối
mốc, sửa mốc, xoá mốc, đóng/mở sổ, bình luận, sửa/xoá bình luận, vote, reaction), và bản
sao thứ tám của một luật là bản quên. Cụ thể là quên `Mach.hidden_at`: mạch bị mod ẩn mà
vẫn ghi được thì nội dung mới chảy vào một mạch không ai đọc được, không lỗi, không log.

Cả bốn hàm **ném** `LoiGhi` chứ không trả về `None`: chúng được gọi từ giữa thân handler,
và một `return` ở đó thì người viết endpoint phải nhớ kiểm — nhớ được bảy lần, quên lần
thứ tám.
"""

from datetime import date

from core.doc_noi_dung import doc_duoc
from core.models.binh_luan import Comment
from core.models.dien_dan import Mach
from core.models.moc import Moc
from core.thoi_gian import ngay_vn

from api.loi import KHONG_TIM_THAY
from api.quyen import DU_LIEU_KHONG_HOP_LE, NOI_DUNG_DA_GO, LoiGhi


def nap_mach(mach_id: int) -> Mach:
    """Mạch công khai theo `id`, hoặc 404. Ẩn bởi mod ⇒ **coi như không tồn tại**.

    Một mã cho cả "không có" lẫn "đã bị ẩn" (`khong_tim_thay`) là cố ý và nó khớp đúng
    `api/loi.py`: tách ra là kể cho người lạ biết chính xác thứ vừa bị gỡ có tồn tại.
    """
    mach = (
        Mach.objects.filter(pk=mach_id, hidden_at__isnull=True)
        .select_related("sub", "author")
        .first()
    )
    if mach is None:
        raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy mạch {mach_id}.")
    return mach


def nap_moc(moc_id: int) -> Moc:
    """Mốc thuộc một mạch chưa bị ẩn, hoặc 404. **Bia mộ vẫn trả về** — xem `doi_con_song`.

    Trả cả bia mộ vì hai chuyện khác nhau: "mốc này không tồn tại" (404) và "mốc này đã
    bị gỡ nên không sửa được nữa" (409). Gộp chúng thành 404 là nói với chính tác giả
    rằng mốc họ vừa xoá chưa từng có.
    """
    moc = (
        Moc.objects.filter(pk=moc_id, mach__hidden_at__isnull=True)
        # `author` cho `MocOut.author` — mọi cửa ghi của mốc đều trả về chính thẻ mốc.
        .select_related("mach", "mach__sub", "mach__author", "author")
        .first()
    )
    if moc is None:
        raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy mốc {moc_id}.")
    return moc


def nap_binh_luan(comment_id: int) -> Comment:
    """Bình luận thuộc một mạch chưa bị ẩn, hoặc 404. Bia mộ vẫn trả về (xem `nap_moc`)."""
    c = (
        Comment.objects.filter(pk=comment_id, mach__hidden_at__isnull=True)
        .select_related("mach", "author")
        .first()
    )
    if c is None:
        raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy bình luận {comment_id}.")
    return c


def doi_con_song(obj, cai_gi: str) -> None:
    """409 nếu `Moc`/`Comment` đã thành bia mộ hoặc bị mod ẩn.

    Hỏi `doc_duoc` chứ không tự viết `deleted_at is None and hidden_at is None`: luật che
    có đúng một chỗ (`core/doc_noi_dung.py`), và bản sao thứ hai là bản sẽ quên
    `hidden_at` khi Phase 4 thêm một trạng thái nữa.
    """
    if not doc_duoc(obj):
        raise LoiGhi(409, NOI_DUNG_DA_GO, f"{cai_gi} này đã bị gỡ.")


def kiem_occurred_at(ngay: date | None) -> None:
    """`occurred_at` **cấm ngày tương lai** — PLAN 5.2, và "tương lai" theo **giờ VN**.

    Nhập lùi thì thoải mái: nhật ký giao dịch thường được ghi lại sau. Nhập tới thì không,
    vì `occurred_at` là ngày *sự việc xảy ra* và một sự việc chưa xảy ra thì không có gì
    để ghi — cho phép nó là mở cửa cho "mốc tiên tri" đứng sẵn trên timeline.

    Ranh giới tính bằng `ngay_vn`, không bằng `date.today()` của server: hai thứ đó lệch
    nhau đúng 7 tiếng trong khung 17:00–24:00 giờ VN, tức khung giờ ít người chạy test
    nhất — người dùng ở VN lúc 22:00 sẽ bị từ chối chính ngày hôm nay của họ.
    """
    if ngay is not None and ngay > ngay_vn():
        raise LoiGhi(
            400,
            DU_LIEU_KHONG_HOP_LE,
            f"occurred_at không được là ngày tương lai (hôm nay giờ VN: {ngay_vn()}).",
        )
