"""Schema **THÂN REQUEST** của đường ghi — PLAN mục 7, 5.1–5.3, 5.7.

Tách khỏi `api/schemas.py` (schema ĐỌC) vì hai họ có hai luật ngược nhau, và trộn chúng
là cách luật thứ hai bị quên:

- schema đọc **phải** có `created_at` — nó là "biên lai" của PLAN nguyên tắc 3;
- schema ghi **cấm** có `created_at`. Nhận nó từ client là để người viết tự đóng dấu giờ
  server của chính mình, và nhật ký "ghi-trước-khi-biết-kết-quả" thành nhật ký viết sau
  khi biết kết quả — HTTP 201, không có gì đỏ, bằng chứng sai nằm lại vĩnh viễn.
  Nợ 1a bàn giao, có chuông từ 1b: `tests/test_schema_ghi_khong_co_created_at.py` đọc
  **thân request của mọi operation** trong `openapi.json` và đỏ nếu thấy trường đó ở bất
  kỳ tầng lồng nhau nào.

Cùng lý lẽ, không schema nào ở đây có `score`, `up_count`, `edit_count`, `edited_at`,
`deleted_at`, `hidden_at`, `author`: chúng là kết quả server tính, không phải thứ người
gọi đặt được.
"""

from datetime import date
from typing import Literal

from ninja import Schema
from pydantic import Field

from core.models.binh_luan import DAI_BODY_COMMENT
from core.models.moc import DAI_BODY_MOC

#: `ket_qua` ≤40 ký tự (PLAN 5.1) · `loai` ≤20 · `question_for_crowd` ≤200 (PLAN 5.2).
#: Khai lại ở đây thay vì import từ model là **cố ý ở đúng ba con số này**: chúng đi vào
#: `openapi.json` thành `maxLength`, tức chúng là một phần hợp đồng công khai — nhưng
#: `Mach.ket_qua`/`Moc.loai` khai `max_length` ở tầng cột chứ không có hằng nào để import.
#: Hai `DAI_BODY_*` thì có hằng, nên chúng được import.
DAI_KET_QUA = 40
DAI_LOAI = 20
DAI_CAU_MOI = 200

#: Hồ sơ sửa được qua `PATCH /me` (2026-08-24). Khai lại con số ở đây thay vì import từ
#: model cùng lý do `DAI_KET_QUA`: chúng đi vào `openapi.json` thành `maxLength` — một
#: phần hợp đồng công khai — mà `User.display_name` (`max_length=60` ở tầng cột) và
#: `User.bio` (`MaxLengthValidator(500)`) không có hằng nào để import. Phải KHỚP model,
#: nếu không API nhận chuỗi mà `update()` ghi cụt hoặc DB từ chối.
DAI_DISPLAY_NAME = 60
DAI_BIO = 500

#: `Report.ghi_chu` là `TextField` (không giới hạn ở tầng cột) — trần chỉ tồn tại ở hợp
#: đồng API, và nó phải tồn tại: thiếu nó thì một request đơn lẻ nhét được vài megabyte
#: chữ vào hàng đợi kiểm duyệt, trên một endpoint chỉ cần đăng nhập. 1000 ký tự đủ cho một
#: lời tố có ngữ cảnh; dài hơn thì mod không đọc nữa.
DAI_GHI_CHU_BAO_CAO = 1000

#: Trần số id một lượt `POST /notifications/read` nhận — xem `DanhDauDaDocIn`.
DAI_DANH_SACH_DA_DOC = 500
DAI_TITLE = 160


class FigureIn(Schema):
    """Một cặp trong dải số của mốc. Thuần hiển thị — server không validate ngữ nghĩa."""

    label: str = Field(min_length=1, max_length=24)
    value: str = Field(min_length=1, max_length=24)


class MocMoiIn(Schema):
    """Nối một mốc vào mạch — `POST /machs/{id}/mocs` (PLAN 5.1, 5.2).

    `occurred_at` là ngày **sự việc xảy ra**: nhập lùi thoải mái, **cấm tương lai**, và
    "tương lai" tính theo **ngày lịch VN** (PLAN mục 1). Không gửi ⇒ server lấy hôm nay
    giờ VN.
    """

    body: str = Field(min_length=1, max_length=DAI_BODY_MOC)
    occurred_at: date | None = None
    loai: str | None = Field(default=None, max_length=DAI_LOAI)
    question_for_crowd: str | None = Field(default=None, max_length=DAI_CAU_MOI)
    figures: list[FigureIn] | None = None


class MachMoiIn(MocMoiIn):
    """Đăng bài — `POST /machs`. Bài gốc **chính là mốc 1**, nên nó kế thừa `MocMoiIn`.

    Không có trường `body` trên `Mach` (PLAN 5.1): `body` ở đây là thân của mốc 1.
    """

    sub: str = Field(min_length=1, max_length=40, description="slug của chuyên mục")
    title: str = Field(min_length=1, max_length=DAI_TITLE)


class MocSuaIn(Schema):
    """Sửa mốc — `PATCH /mocs/{id}`. **Đúng 5 trường của PLAN 5.2, không gì khác.**

    Đây là PATCH thật: trường **không gửi** thì không đổi, trường gửi `null` thì xoá.
    Phân biệt hai ca đó bằng `model_fields_set` của pydantic, nên đừng đổi `None` mặc
    định thành một sentinel khác — `api/mocs.py` đọc đúng cơ chế ấy.
    """

    body: str | None = Field(default=None, min_length=1, max_length=DAI_BODY_MOC)
    occurred_at: date | None = None
    loai: str | None = Field(default=None, max_length=DAI_LOAI)
    question_for_crowd: str | None = Field(default=None, max_length=DAI_CAU_MOI)
    figures: list[FigureIn] | None = None


class DongSoIn(Schema):
    """Đóng sổ — `POST /machs/{id}/close`. `ket_qua` tuỳ chọn, ≤40 ký tự (PLAN 5.1).

    Thuần hiển thị, không validate ngữ nghĩa — cùng triết lý với `figures`.
    """

    ket_qua: str | None = Field(default=None, max_length=DAI_KET_QUA)


class BinhLuanMoiIn(Schema):
    """Viết bình luận — `POST /machs/{id}/comments` (PLAN 5.4, nguyên tắc 4 và 6).

    `anchor_moc_seq` **chỉ đặt được trên bình luận gốc**: reply kế thừa neo của gốc, nên
    gửi kèm `parent_id` là 400 chứ không phải bỏ qua im lặng — bỏ qua im lặng là cách một
    bình luận biến mất khỏi ngăn kéo mà không ai hiểu tại sao.

    Gốc mang `anchor_moc_seq = null` nghĩa là người viết **đã gỡ chip** — không thuộc ngăn
    kéo nào. Đó là một lựa chọn, không phải dữ liệu thiếu.
    """

    body: str = Field(min_length=1, max_length=DAI_BODY_COMMENT)
    parent_id: int | None = None
    anchor_moc_seq: int | None = Field(default=None, ge=1)


class BinhLuanSuaIn(Schema):
    """Sửa bình luận — `PATCH /comments/{id}`. Chỉ `body` (PLAN 5.3)."""

    body: str = Field(min_length=1, max_length=DAI_BODY_COMMENT)


class VoteIn(Schema):
    """Vote / đổi / rút — `POST /votes` (PLAN 5.7, mục 7).

    `value = 0` nghĩa là **rút**: hàng `Vote` bị xoá, không lưu `0`.
    """

    target_type: str = Field(description='"moc" hoặc "comment"')
    target_id: int
    value: int = Field(ge=-1, le=1)


class ReactionIn(Schema):
    """React / đổi / rút — `POST /mocs/{id}/reactions` (PLAN 5.7).

    Bộ CỐ ĐỊNH `ro_rang · co_nguon · can_them · lieu` (🧠📎❓🔥) — **phản hồi về BÀI
    VIẾT**, không về giá; xem `core/models/tuong_tac.py::Reaction`. `emoji = null` là **rút**.
    """

    emoji: str | None = None


# --- Phase 3 -----------------------------------------------------------------


class DaXemIn(Schema):
    """`POST /machs/{id}/seen` — client báo đã đọc tới đâu (PLAN 5.5).

    `entry_seq = null` (mặc định) nghĩa là **"đã xem tới mốc mới nhất"**, đúng ca PLAN 5.5
    mô tả: thẻ mốc mới nhất mở sẵn khi trang mở, nên client gọi endpoint này không kèm gì.
    Truyền một `seq` cụ thể là ca người ta bung timeline đầy đủ rồi đọc tới một chỗ nào đó.

    Con số **chỉ tiến, không lùi** ở phía server (`core.ghi.dat_da_xem`), nên gửi một
    `entry_seq` nhỏ hơn vị trí đã ghi là no-op chứ không phải một cách reset vạch mới —
    peek một mốc cũ trên spine không được đánh dấu 6 mốc cuối thành chưa đọc.

    `ge=0` chứ không `ge=1`: `0` là "chưa xem mốc nào", giá trị khởi điểm hợp lệ của cột.
    """

    entry_seq: int | None = Field(default=None, ge=0)


class TrichIn(Schema):
    """`POST /mocs/{id}/trich` — chủ mạch ghi một câu khán đài vào sổ (PLAN 5.6).

    Chỉ có `comment_id`: **mốc nhận trích nằm ở URL**, không nằm trong thân. Hai thứ đó
    không được cùng ở một chỗ vì rào 1 ("tối đa 1 trích đang hiệu lực mỗi mốc") là một
    ràng buộc trên `moc`, và người gọi phải nói rõ mốc nào trước khi server đi kiểm.

    Không có trường `body`: sổ trích **dẫn lại** một bình luận đã tồn tại, không phải chỗ
    chủ mạch tự viết một câu rồi gán tên người khác vào.
    """

    comment_id: int


class DanhDauDaDocIn(Schema):
    """`POST /notifications/read` — đánh dấu đã đọc (PLAN 5.8).

    `ids = null` (mặc định) nghĩa là **đánh dấu HẾT** — nút "đọc hết" của chuông. Truyền
    một danh sách là đánh dấu đúng từng dòng, cho lượt bấm vào một thông báo lẻ.

    Id của **người khác** trong danh sách bị bỏ qua chứ không làm cả request hỏng: truy vấn
    luôn kèm `user = người đang gọi` (xem endpoint), nên chuyện tệ nhất một id lạ gây ra là
    `so_da_danh_dau` nhỏ hơn số id đã gửi. Trả 403 ở đây thì ngược lại: nó **xác nhận** id
    đó có thật và thuộc về ai đó — một cửa dò id qua mã lỗi.

    Danh sách rỗng `[]` khác `null`: nó đánh dấu **không dòng nào**. Cố ý giữ khác nhau —
    một mảng rỗng do client dựng hụt không được biến thành "đọc hết".

    `ids` có **trần độ dài** (L27, vá V1): thiếu nó thì một request đơn lẻ đẩy được một
    triệu phần tử vào `pk__in`, tức một câu SQL vài megabyte trên một endpoint chỉ cần
    đăng nhập. Trần rộng hơn hẳn mọi lượt bấm thật — chuông trả tối đa một trang — nên nó
    không chặn ai, nó chỉ chặn cái không phải lượt bấm.
    """

    ids: list[int] | None = Field(default=None, max_length=DAI_DANH_SACH_DA_DOC)


class ToiSuaIn(Schema):
    """`PATCH /me` — tuỳ chọn + hồ sơ của chính người đang đăng nhập (PLAN 5.8, 5.9).

    **PATCH thật**: trường vắng mặt nghĩa là không đổi, nên `{}` là một request hợp lệ
    không ghi gì. Tách khỏi `ToiOut` chứ không dùng chung một schema hai chiều: `ToiOut`
    mang `username`, `email`, `la_staff`, `google_bat`, `avatar_url` — không cái nào người
    dùng đặt được ở cửa NÀY (avatar đi qua `POST /me/avatar`), và một schema hai chiều là
    lời mời nhận đại cả bốn.

    ⚠ **`display_name`/`bio`: chuỗi RỖNG `""` là giá trị hợp lệ — nó XOÁ trường**, và nó
    KHÁC `null`. Handler lọc `v is not None` (xem `api/toi.py::sua_toi`), nên `{"bio": ""}`
    vẫn ghi (xoá bio), trường VẮNG MẶT thì không đụng, còn `null` gửi tường minh bị bỏ qua.
    Cửa này KHÔNG là chỗ đặt avatar — avatar là file, đi qua `POST`/`DELETE /me/avatar`.
    """

    #: `true` ⇒ nhận email digest tuần 8:00 thứ Bảy VN. PLAN 5.8 chốt **opt-in**, nên mặc
    #: định của cột là `False` và cửa này là chỗ duy nhất bật được nó. Kiểu `bool | None`
    #: với mặc định `None` là cách PATCH thật của repo phân biệt "không gửi" với "gửi
    #: `false`" — cùng cơ chế `model_fields_set` mà `MocSuaIn` dùng; handler đọc bằng
    #: `model_dump(exclude_unset=True)` nên một `null` gửi tường minh **không** ghi gì.
    nhan_digest: bool | None = None
    #: Tên hiển thị (PLAN 5.9). `max_length` KHỚP `User.display_name` (60) và đi vào
    #: `openapi.json`. Gửi `""` là quay về dùng `username` để hiển thị; không gửi là giữ
    #: nguyên.
    display_name: str | None = Field(default=None, max_length=DAI_DISPLAY_NAME)
    #: Giới thiệu bản thân trên hồ sơ (PLAN 5.9). `max_length` KHỚP validator
    #: `User.bio` (500). Gửi `""` là xoá bio; không gửi là giữ nguyên.
    bio: str | None = Field(default=None, max_length=DAI_BIO)


class BaoCaoMoiIn(Schema):
    """Gửi báo cáo — `POST /reports` (PLAN 5.10).

    `ly_do` là **enum**, đúng bốn giá trị PLAN liệt kê: *phím hàng · lừa đảo, mời uỷ thác,
    room VIP · spam · khác*. Khai bằng `Literal` chứ không `str` để `openapi.json` ra
    `enum` và TS client nhận một union — một chuỗi tự do ở đây là hàng đợi kiểm duyệt đầy
    những lý do không nhóm lại được, và mod thì phải đọc từng dòng.

    `ghi_chu` tuỳ chọn: chỗ người tố nói thêm. Server **không** validate ngữ nghĩa (cùng
    triết lý với `ket_qua`/`figures`), chỉ chặn độ dài.
    """

    target_type: Literal["mach", "moc", "comment"]
    target_id: int = Field(ge=1)
    ly_do: Literal["phim_hang", "lua_dao", "spam", "khac"]
    ghi_chu: str = Field(default="", max_length=DAI_GHI_CHU_BAO_CAO)
