"""Nhắn tin riêng 1-1 — `HoiThoai` + `TinNhan` (`plans/2026-09-03-nhan-tin-rieng.md`).

User chốt 2026-09-03: *"thêm phần user nhắn tin cho nhau, có báo notify nếu có msg mới"*.
Vế "notify" đi qua đúng `Notification` đã có (`core/thong_bao.py`, loại thứ tám
`tin_nhan`) — **không dựng kênh thứ hai**, vì chuông đã poll 60 giây sẵn (PLAN 5.8).

## Cặp có THỨ TỰ: `nguoi_a_id < nguoi_b_id` là bất biến, không phải quy ước

Một hội thoại giữa hai người phải là **một hàng** bất kể ai mở trước. Không có bất biến
đó thì A→B và B→A dựng hai hàng, và mọi thứ treo lên nó đều nhân đôi: hộp thư hiện hai
dòng cho cùng một người, vạch đọc tách làm hai, chuông gộp theo hội thoại gộp nhầm nửa.
`UNIQUE (nguoi_a, nguoi_b)` một mình **không** chặn được ca đó — `(A, B)` và `(B, A)` là
hai bộ khác nhau với Postgres.

Nên bất biến được cài ở DB bằng `CheckConstraint (nguoi_a_id < nguoi_b_id)`, viết theo
khuôn `TheoUser.theo_user_khong_tu_theo`. Nó chặn **hai** thứ cùng lúc bằng một điều
kiện: cặp đảo (`a > b`) và **tự nhắn mình** (`a = b`). Đường ghi
(`core/tin_nhan.py::cap_thu_tu`) sắp cặp trước khi ghi; `CHECK` là lưới cho mọi đường
khác — `bulk_create`, shell, lệnh quản trị sau này.

## Vạch đọc theo `id`, KHÔNG theo thời gian

`da_doc_den_a`/`da_doc_den_b` giữ **id tin nhắn cuối cùng phía ấy đã đọc**. Dùng dấu
thời gian ở chỗ này là lỗi đã có tên trong sổ repo (P-20260827-1): đồng hồ máy không
phân giải nổi hai lời gọi liên tiếp, nên hai tin gửi trong cùng một mili-giây có
`created_at` bằng nhau và một phép so `>` sẽ hoặc nuốt một tin hoặc đếm lại nó. `id` là
identity của Postgres — đơn điệu, không tái sử dụng, và so sánh được bằng một phép `>`
duy nhất chạy thẳng trên index.

`0` = chưa đọc gì (mọi tin đều mới), đúng khuôn `Follow.last_seen_entry_seq`.

## `cap_nhat_luc` là cột denormalize DUY NHẤT của cụm này

Nó bằng `created_at` của tin cuối, và nó tồn tại để hộp thư sắp được **mà không join**
sang `TinNhan` — cùng lý lẽ `Mach.last_activity_at`. Vì là denormalize nên nó chịu đúng
luật của `cap_nhat_dem_mach`: ghi TRONG cùng transaction với tin, dưới
`select_for_update` hàng `HoiThoai`. Ghi ở transaction thứ hai là hộp thư sắp sai vĩnh
viễn, không log, không job đối soát.

## Thứ tự khoá hàng — cạnh MỚI `HoiThoai → User`

Đường gửi (`core/tin_nhan.py::gui_tin` + `core/thong_bao.py::bao_tin_nhan`) khoá theo
đúng thứ tự này:

1. `SELECT … FOR UPDATE` hàng `HoiThoai`;
2. `INSERT INTO core_tinnhan` — lấy `FOR KEY SHARE` trên hàng `HoiThoai` được tham chiếu
   **và** trên hàng `core_user` của người gửi;
3. `INSERT INTO core_notification` — `FOR KEY SHARE` trên hàng `core_user` người nhận.

Cạnh mới trong đồ thị khoá của repo là `HoiThoai → User`. Nó **không** đụng chuỗi
`Comment/Moc → Mach → MocAnh` (xem `CLAUDE.md`): không đường nào ở đây chạm `Mach`,
`Moc`, `Comment` hay `MocAnh`, và không đường nào ở kia chạm `HoiThoai`. Hai đường duy
nhất khoá `User` **độc quyền** (`core.ghi.ban_user`/`go_ban_user`) chỉ ghi `AuditLog`
sau đó — chúng không xin `HoiThoai`, nên không có cạnh ngược `User → HoiThoai` để khép
thành chu trình.

## `PROTECT` cho FK người, `CASCADE` cho FK hội thoại

`User` không bao giờ bị `DELETE` (PLAN mục 6 chốt ẩn danh hoá thay vì xoá), nên `PROTECT`
ở đây là một lời khẳng định chứ không phải một hàng rào sẽ vướng chân ai. `TinNhan.hoi_thoai`
thì `CASCADE`: một hội thoại không còn thì mọi tin trong nó cũng không còn nghĩa, và
không có đường sản phẩm nào xoá `HoiThoai` cả.
"""

from django.conf import settings
from django.core.validators import MaxLengthValidator
from django.db import models
from django.utils import timezone

#: Trần độ dài thân một tin nhắn. Tin nhắn là **tán gẫu**, không phải bài viết: trần rộng
#: hơn hẳn một đoạn chat thật mà vẫn chặn ai đó dán cả một mốc vào ô chat. Cũng là con số
#: `api/schemas_ghi.py::TinNhanIn` khai lại thành `maxLength` của hợp đồng công khai —
#: hai chỗ phải KHỚP, nên chỗ kia import thẳng hằng này.
DO_DAI_TIN_TOI_DA = 2000


class HoiThoai(models.Model):
    """Một cuộc trò chuyện 1-1. Xem docstring module cho bất biến `nguoi_a_id < nguoi_b_id`."""

    nguoi_a = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="hoi_thoai_a"
    )
    nguoi_b = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="hoi_thoai_b"
    )
    created_at = models.DateTimeField(default=timezone.now, editable=False)
    #: `created_at` của tin cuối — khoá sắp của hộp thư. Denormalize, xem docstring module.
    cap_nhat_luc = models.DateTimeField(default=timezone.now)
    #: Id tin cuối cùng mỗi phía đã đọc; `0` = chưa đọc gì. Xem docstring module.
    da_doc_den_a = models.BigIntegerField(default=0)
    da_doc_den_b = models.BigIntegerField(default=0)

    class Meta:
        verbose_name = "hội thoại"
        verbose_name_plural = "hội thoại"
        constraints = [
            models.UniqueConstraint(
                fields=["nguoi_a", "nguoi_b"], name="hoi_thoai_duy_nhat_cap"
            ),
            models.CheckConstraint(
                condition=models.Q(nguoi_a__lt=models.F("nguoi_b")),
                name="hoi_thoai_a_truoc_b",
            ),
        ]
        #: Hộp thư của MỘT người: "hội thoại của tôi, mới nhất trước". Người ta đứng ở
        #: cột `nguoi_a` hay `nguoi_b` là tuỳ pk của họ so với người kia, nên phải có
        #: **hai** index — một cái thôi thì nửa số hội thoại quét bảng.
        indexes = [
            models.Index(fields=["nguoi_a", "-cap_nhat_luc"], name="hoi_thoai_cua_a"),
            models.Index(fields=["nguoi_b", "-cap_nhat_luc"], name="hoi_thoai_cua_b"),
        ]

    def __str__(self) -> str:
        return f"hội thoại {self.nguoi_a_id} ↔ {self.nguoi_b_id}"


class TinNhan(models.Model):
    """Một tin trong hội thoại. **Plain text** — không HTML, không markdown, không ảnh.

    Cố ý hẹp hơn `Comment` (`body_dinh_dang`, `lam_sach`, Tiptap): tin nhắn riêng không đi
    qua kiểm duyệt nào, nên mở cửa HTML ở đây là mở một đường XSS mà không mod nào nhìn
    thấy. Frontend in nó bằng React escape thuần.

    **Không sửa, không xoá, không thu hồi** ở lượt này (plan §1 "KHÔNG LÀM") — nên model
    cố ý không có `edited_at`/`deleted_at`. Thêm chúng sau là một quyết định sản phẩm, và
    nó phải kéo theo câu hỏi "phía kia đã đọc rồi thì thu hồi nghĩa là gì".
    """

    hoi_thoai = models.ForeignKey(
        HoiThoai, on_delete=models.CASCADE, related_name="tin_nhan"
    )
    nguoi_gui = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.PROTECT, related_name="tin_da_gui"
    )
    body = models.TextField(validators=[MaxLengthValidator(DO_DAI_TIN_TOI_DA)])
    created_at = models.DateTimeField(default=timezone.now, editable=False)

    class Meta:
        verbose_name = "tin nhắn"
        verbose_name_plural = "tin nhắn"
        #: Truy vấn duy nhất chạm bảng này theo nhiều hàng: "tin của hội thoại X, mới
        #: nhất trước" (trang hội thoại phân trang lùi theo `id`, và `DISTINCT ON` của
        #: hộp thư lấy tin cuối mỗi hội thoại). Sắp theo `id` chứ không `created_at` —
        #: xem "Vạch đọc theo `id`" ở docstring module.
        indexes = [
            models.Index(fields=["hoi_thoai", "-id"], name="tin_nhan_hoi_thoai_id"),
        ]

    def __str__(self) -> str:
        return f"tin {self.pk} của {self.nguoi_gui_id} trong hội thoại {self.hoi_thoai_id}"
