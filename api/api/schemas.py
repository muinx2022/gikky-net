"""Schema response của API v1 đọc — PLAN mục 7, 5.2–5.5, 9.2.

Đây là **hợp đồng công khai** — nhưng chỉ một phần của file này là hợp đồng, và biết
phần nào thì quan trọng:

- **docstring của CLASS** đi thẳng ra `description` của schema trong
  `packages/api-client/openapi.json`, ra JSDoc của `sdk.gen.ts`, ra `/api/v1/openapi.json`
  khi `DEBUG=True`. Viết cho người dùng API đọc;
- **comment `#:` trên từng trường thì KHÔNG ra tới đó.** pydantic 2 không đọc chúng (cần
  `use_attribute_docstrings` mới lấy được docstring của thuộc tính, và bản này không bật).
  Chúng là ghi chú cho người đọc code — hữu ích, nhưng đừng tưởng frontend nhìn thấy.

Vì vậy những điều một người dùng API **bắt buộc** phải biết để khỏi hiểu sai con số —
"💬 N là N bình luận đọc được" và "`last_activity_at` có thể nhỏ hơn `last_entry_at`" —
nằm trong docstring của class, không nằm trong comment trường. `tests/test_hop_dong_openapi.py`
ghim lại chuyện đó.

**Frontend CẤM khai lại các kiểu này bằng tay** (PLAN 8.3) — `pnpm codegen` sinh chúng
sang TS, một chiều.

Một luật xuyên suốt: **không schema nào ở đây có trường phụ thuộc người xem.** Trạng thái
của viewer (vote của tôi, đã theo chưa, đọc tới đâu) đi qua `GET /machs/{id}/me` của
Phase 3 — PLAN 8.4 điểm 4. Trường per-user lọt vào `MachChiTietOut` là dữ liệu của người
này được cache rồi phục vụ cho người kia.
"""

from datetime import date, datetime

from ninja import Schema

from core.doc_noi_dung import SortKhanDai, TrangThaiNoiDung
from core.mat import Mat


class NguoiDungTomTatOut(Schema):
    """Tác giả, ở mức đủ để render một dòng chữ ký."""

    username: str
    display_name: str


class SubTomTatOut(Schema):
    slug: str
    ten: str


class FigureOut(Schema):
    """Một cặp trong dải số của mốc, vd `{label: "GIÁ VÀO", value: "27.80"}`.

    Thuần hiển thị — server không validate ngữ nghĩa (PLAN 5.2).
    """

    label: str
    value: str


class MachTomTatOut(Schema):
    """Một mạch ở mức thẻ feed / danh sách hồ sơ.

    **`comment_count` là số bình luận ĐỌC ĐƯỢC, không phải số dòng khán đài sẽ render.**
    Bình luận đã xoá hoặc bị ẩn không được đếm, nhưng vẫn để lại bia mộ giữ chỗ khi chúng
    còn reply — nên khán đài có thể hiện 24 dòng trong khi con số này nói 22. Đó là chủ
    đích, đừng "sửa" cho khớp.

    **`last_activity_at` có thể NHỎ HƠN `last_entry_at`.** Hai cột đo hai thứ khác nhau:
    `last_entry_at` đo cấu trúc (mọi mốc, kể cả mốc bị ẩn), `last_activity_at` đo nội
    dung đọc được. Hệ quả nhìn thấy được: một mạch đứng đầu feed "Đang diễn ra" mà mở ra
    là mặt CẶN.

    **`diem` là điểm của MỐC 1, không phải tổng điểm của mạch.** PLAN 5.7 chốt vote nằm
    trên từng mốc riêng rẽ ("mốc 9 được 412 dù bài gốc 89"), nên không tồn tại con số
    "điểm của mạch"; cột vote trên thẻ feed chiếu đúng điểm bài gốc. Mốc 1 đã xoá hoặc bị
    mod ẩn ⇒ `0`, cùng chuẩn với `MocOut.score` của bia mộ.
    """

    id: int
    slug: str
    title: str
    sub: SubTomTatOut
    author: NguoiDungTomTatOut
    status: str
    ket_qua: str | None
    entry_count: int
    #: Số bình luận **ĐỌC ĐƯỢC** — bình luận đã xoá hoặc bị ẩn không được đếm, dù khán
    #: đài vẫn render bia mộ giữ chỗ cho nhánh con. "💬 N" nghĩa là N bình luận đọc được,
    #: không phải N dòng trên màn hình (PLAN mục 6, luật đếm 4 cột).
    comment_count: int
    created_at: datetime
    #: Khoá sắp xếp của feed "Đang diễn ra". Đo **cấu trúc**: mọi mốc đều tính, kể cả bia
    #: mộ và mốc bị ẩn.
    last_entry_at: datetime
    #: Đo **nội dung đọc được**, nên **có thể nhỏ hơn `last_entry_at`**. Xem
    #: `MachChiTietOut.face`.
    last_activity_at: datetime
    #: Điểm của **mốc 1** (`Mach.diem_bai_goc`) — khoá sort của `?sort=nhieu_diem`, và là
    #: con số trên cột vote của thẻ feed. Âm được. Bia mộ ⇒ `0`.
    diem: int


class SubChiTietOut(Schema):
    """Header của trang `/s/<slug>` — plan con 1d §2.3.

    `so_mach` đếm mạch **hiện được**: chỉ loại mạch bị mod ẩn (`hidden_at`), đúng bộ lọc
    của `api/feeds.py::_mach_hien`.

    ⚠ **Không phải "đúng bộ lọc mà hai feed dùng"** *(sửa ở W12, lượt vá 2 — câu cũ nói
    quá)*: `/feeds/dang-dien-ra` lọc THÊM `status=MO`, nên với một chuyên mục có mạch đã
    đóng sổ thì `so_mach` lớn hơn tổng số thẻ của feed đó kể cả khi không cắt trang. Con
    số này khớp tập của `/feeds/moi`, không khớp tập của `/feeds/dang-dien-ra`.

    Và ngay cả với `/feeds/moi` thì đừng suy con số này ra số thẻ trên màn hình: feed cắt
    trang, còn `?khoang=` cắt thêm theo `created_at`.
    """

    slug: str
    ten: str
    mo_ta: str
    so_mach: int
    created_at: datetime


class FeedOut(Schema):
    """Một trang feed. `cursor_ke_tiep = null` nghĩa là hết.

    **Cursor mang khoá của ĐÚNG sort đã sinh ra nó** (plan con 1d §2.1): `sort=nhieu_diem`
    trả cursor `(diem, id)`, hai sort thời gian trả cursor `(thời điểm, id)`. Đem cursor
    của sort này sang sort kia là 400 `cursor_khong_hop_le`, không phải trang 1 im lặng.
    """

    items: list[MachTomTatOut]
    cursor_ke_tiep: str | None


class TrichOut(Schema):
    """Bình luận được chủ mạch trích vào mốc — "trích vào sổ" (PLAN 5.6).

    Hai dấu thời gian đều có mặt vì rào 2 của PLAN 5.6 bắt blockquote hiện đủ cả hai
    ("viết 10/06, trích 21/08") — chống trích hậu nghiệm để sổ đọc như tiên tri.

    `trang_thai = "da_xoa"` nghĩa là người viết đã xoá bình luận gốc **sau khi** nó vào
    sổ; blockquote vẫn còn nguyên nội dung, vì sổ là "không-xoá-được" (PLAN 5.6). Bình
    luận bị **mod ẩn** thì cả khối trích biến mất khỏi response, không có trạng thái nào
    biểu diễn nó.
    """

    comment_id: int
    author: NguoiDungTomTatOut
    body: str
    trang_thai: TrangThaiNoiDung
    #: Lúc bình luận được VIẾT.
    comment_created_at: datetime
    #: Lúc chủ mạch TRÍCH nó vào sổ.
    trich_created_at: datetime
    anchor_moc_seq: int | None


class MocOut(Schema):
    """Một mốc trong mạch. Bài gốc là `seq = 1`, không có ngoại lệ (PLAN mục 2).

    Khi `trang_thai != "binh_thuong"` thì đây là **bia mộ**: `body`, `loai`, `figures`,
    `question_for_crowd`, `edited_at` đều `null`, còn `edit_count` và `score` về `0` —
    số phiếu của nội dung đã gỡ không được trả ra, cùng chuẩn với `BinhLuanOut`. `seq`,
    `occurred_at`, `so_binh_luan` và chỗ đứng trên spine vẫn còn: `seq` bất biến, giấu
    hẳn một ô là thủng dãy số, và ngăn kéo của bia mộ vẫn mở được (PLAN 5.2).
    """

    id: int
    seq: int
    #: Ngày **sự việc xảy ra**, người dùng đặt, nhập lùi được (PLAN nguyên tắc 3).
    occurred_at: date
    #: Dấu thời gian **server**, bất biến — bằng chứng "ghi lúc nào".
    created_at: datetime
    loai: str | None
    body: str | None
    #: Câu mồi hiện trong ngăn kéo khi mốc chưa có bình luận (PLAN 5.4 luật 4).
    question_for_crowd: str | None
    figures: list[FigureOut] | None
    edited_at: datetime | None
    edit_count: int
    score: int
    trang_thai: TrangThaiNoiDung
    #: Số bình luận đọc được trong ngăn kéo của mốc này — tính **cả thread**, gồm reply
    #: viết ở thời điểm mốc khác (PLAN nguyên tắc 6).
    so_binh_luan: int
    trich: TrichOut | None


class SpineOut(Schema):
    """Một ô trên dải xương sống `①──②──…──◉⑨` (PLAN 9.2).

    `da_xoa` và `da_an` đều giữ chỗ: bất biến `entry_count == số ô trên spine` là thứ dải
    gập của mặt CẶN suy ra (PLAN 5.2, 5.5).
    """

    seq: int
    occurred_at: date
    so_binh_luan: int
    da_xoa: bool
    da_an: bool


class MachChiTietOut(Schema):
    """Trang mạch: mạch + toàn bộ mốc + `face` server đã tính + spine (PLAN mục 7).

    **Response này KHÔNG chứa trường nào phụ thuộc người xem** và vì thế cache được
    (PLAN 8.4). Vote của tôi, đã theo chưa, đọc tới đâu — tất cả nằm ở
    `GET /machs/{id}/me`.

    `face` ở bản này tính THUẦN theo luật thời gian: mạch đang mở · chưa bị mod khoá ·
    `now − last_activity_at ≤ 72h`. Vế "user đã follow hoặc từng bình luận" của PLAN 5.5
    **chưa được áp** vì nó phụ thuộc người xem.

    `comment_count` là số bình luận ĐỌC ĐƯỢC, và `last_activity_at` có thể nhỏ hơn
    `last_entry_at` — xem `MachTomTatOut`.
    """

    id: int
    #: Slug hiện hành. `id` mới là khoá; URL `/m/<slug>-<id>` lệch slug vẫn trả đúng mạch
    #: này, việc redirect 301 là của tầng web (PLAN 5.9).
    slug: str
    title: str
    sub: SubTomTatOut
    author: NguoiDungTomTatOut
    status: str
    closed_at: datetime | None
    ket_qua: str | None
    #: Mod đã khoá mạch chưa (đọc được, cấm tương tác). Trục RIÊNG với `status`.
    locked: bool
    created_at: datetime
    last_entry_at: datetime
    last_activity_at: datetime
    entry_count: int
    comment_count: int
    #: Mặt BÃO hay CẶN, **server quyết** (PLAN nguyên tắc 10, 5.5).
    #:
    #: Ở bản này `face` tính THUẦN theo luật thời gian: mạch đang mở · chưa bị khoá ·
    #: `now − last_activity_at ≤ 72h`. Vế "user đã follow hoặc từng bình luận" của
    #: PLAN 5.5 **chưa được áp** — nó phụ thuộc người xem, mà response này phải cache
    #: được. Khách ẩn danh và bot vì thế luôn nhận đúng giá trị ở đây.
    #:
    #: Vì `last_activity_at` đo nội dung đọc được còn feed "Đang diễn ra" sắp theo
    #: `last_entry_at`, một mạch **đứng đầu feed mà mở ra là mặt CẶN** là hành vi đúng,
    #: không phải lỗi (PLAN mục 6, "hệ quả cố ý 2").
    face: Mat
    mocs: list[MocOut]
    spine: list[SpineOut]


class BinhLuanOut(Schema):
    """Một nút trong cây bình luận. Server dựng cây và sắp sibling (PLAN mục 7).

    Khi `trang_thai != "binh_thuong"` thì đây là **bia mộ giữ chỗ**: `author`, `body`,
    `edited_at` là `null`; `up_count`, `down_count`, `score` về `0`; còn `la_chu_mach` và
    `tu_gap` về `false`. **`id`, `parent_id`, `depth`, `anchor_moc_seq`, `created_at` vẫn
    là giá trị THẬT** — đó là cách 1c dựng được nút "nhảy tới khán đài" từ
    `TrichOut.comment_id`. Nút như vậy xuất hiện khi nó còn **con sống
    sót** trong `replies`, **hoặc** khi `trang_thai = "da_xoa"` và bình luận đã TỪNG được
    chủ mạch trích vào sổ — kể cả trích đã gỡ (PLAN 5.3). Không dính vế nào thì nó biến
    mất hẳn.

    "Con sống sót" **không** đồng nghĩa "con đọc được": con ấy có thể tự nó là bia mộ,
    được giữ nhờ vế thứ hai. Hệ quả, và đây là hành vi đúng chứ không phải lỗi: một thread
    có thể trả về **toàn bia mộ, không một chữ nội dung nào**, và nó vẫn chiếm một chỗ
    trong `tong_thread` lẫn một slot trong trang của khán đài. Đừng đọc "thread" thành
    "thread có nội dung".

    Vế thứ hai chỉ áp cho `"da_xoa"`. Bình luận bị **mod ẩn** mà không còn con sống sót
    thì biến mất kể cả khi từng được trích: `MocOut.trich` cũng biến mất trong ca đó, nên
    giữ lại bia mộ là giữ chỗ cho một liên kết không còn đầu kia.

    `depth` 1-based: bình luận gốc là 1. UI render tối đa 6 tầng rồi "tiếp tục thread →",
    nhưng API trả đủ cây (PLAN 5.3).
    """

    id: int
    parent_id: int | None
    depth: int
    #: Chỉ có nghĩa ở bình luận GỐC; reply luôn `null` vì nó kế thừa neo của gốc (PLAN
    #: nguyên tắc 6). Gốc mang `null` là người viết đã **gỡ chip** — không thuộc ngăn kéo
    #: nào, và đó không phải dữ liệu thiếu (PLAN nguyên tắc 4).
    anchor_moc_seq: int | None
    author: NguoiDungTomTatOut | None
    body: str | None
    created_at: datetime
    edited_at: datetime | None
    up_count: int
    down_count: int
    score: int
    trang_thai: TrangThaiNoiDung
    #: Tác giả của bình luận này cũng là chủ mạch — badge `[CHỦ MẠCH]` (PLAN mục 2).
    la_chu_mach: bool
    #: Điểm ≤ −5 ⇒ UI gập sẵn, bấm mới mở (PLAN 5.3).
    tu_gap: bool
    replies: list["BinhLuanOut"]


BinhLuanOut.model_rebuild()


class KhanDaiOut(Schema):
    """Khán đài: MỘT phòng chứa toàn bộ cây bình luận của mạch (PLAN mục 2, 5.3).

    Phân trang khác nhau theo `sort`, đúng PLAN 5.3:

    - `hay_nhat` — MỘT trang 50 thread gốc, "xem thêm" gọi lại bằng `?offset=`. Rank động
      theo `now` nên trang sau có thể trôi nhẹ; đó là đánh đổi đã chốt. `cursor_ke_tiep`
      luôn `null` ở sort này.
    - `moi_nhat` / `cu_nhat` — cursor keyset thật trên `(created_at, id)`.
      `offset_ke_tiep` luôn `null` ở hai sort này.

    **Chế độ `?dang_doc=1`** (PLAN 5.5 — "câu đáng đọc") dùng lại đúng schema này nhưng
    đổi nghĩa hai trường: `threads` là phép hợp `đã trích ∪ top-10 wilson` sắp theo wilson
    **thuần**, và `tong_thread` là kích thước của tập ấy chứ không phải tổng thread của
    mạch. Cả hai con trỏ trang luôn `null` — chế độ đó không phân trang. Chỉ chế độ này
    mang `so_ung_vien_bo_lai`.
    """

    sort: SortKhanDai
    #: Tổng số thread GỐC hiện ra (kể cả bia mộ giữ chỗ), trước khi cắt trang.
    #:
    #: ⚠ Ở `?dang_doc=1` đây là kích thước của TẬP, và nó **không so được** với
    #: `tong_thread` của khán đài đầy đủ: tập không nhận bia mộ qua vế top-10 (X4) nhưng
    #: vẫn ôm bia mộ **đã được trích** (PLAN 5.6), còn cây thì đếm mọi bia mộ giữ chỗ.
    #: Câu hỏi "khối này có lọc được gì không" trả lời bằng `so_ung_vien_bo_lai`.
    tong_thread: int
    threads: list[BinhLuanOut]
    #: Chỉ ở `?dang_doc=1` (ngoài đó là `null`): số thread gốc **đọc được** bị phép lọc bỏ
    #: lại ngoài `threads`.
    #:
    #: `0` nghĩa là tập chứa trọn phần **thread GỐC** đọc được của cây ⇒ UI **không
    #: render** khối "Câu
    #: đáng đọc": nó sẽ là bản sao của cây ngay dưới nó (PLAN 5.5, ngoại lệ chốt
    #: 2026-08-22). `null` ở khán đài thường là cố ý — `0` đọc ra là "không lọc được gì",
    #: một câu trả lời SAI cho một câu hỏi không được đặt.
    so_ung_vien_bo_lai: int | None
    offset_ke_tiep: int | None
    cursor_ke_tiep: str | None


class NganKeoOut(Schema):
    """Lát cắt bình luận neo vào một mốc — PLAN 5.4.

    Chứa các thread có bình luận **gốc** neo mốc này, **cả thread**, gồm reply viết ở bất
    kỳ thời điểm nào. Sắp cũ → mới và **không cho chỉnh** — ngăn kéo là cửa sổ, không
    phải phòng (luật 2).

    Mốc chưa có bình luận nào trả `threads: []` và `so_binh_luan: 0`; UI **không** hiện
    "💬 0" mà hiện lời mời cùng `question_for_crowd` nếu có (luật 4).
    """

    moc_id: int
    moc_seq: int
    #: `null` khi mốc không có câu mồi, **và cũng `null` khi mốc là bia mộ** — nội dung
    #: của mốc đã bị che thì không trả ra qua đường này.
    question_for_crowd: str | None
    so_binh_luan: int
    threads: list[BinhLuanOut]


class MocRevisionOut(Schema):
    """Một bản TRƯỚC của mốc — đủ cả 5 trường sửa được, cho UI diff (PLAN 5.2).

    Có `occurred_at` là bắt buộc: sửa lùi ngày sự việc mà không để vết là phá đúng giá
    trị lõi của sản phẩm, nên diff phải hiện được cả thay đổi ngày.
    """

    id: int
    body: str
    figures: list[FigureOut] | None
    occurred_at: date
    loai: str | None
    question_for_crowd: str | None
    #: Thời điểm bản này bị THAY THẾ, không phải lúc nó được viết.
    revised_at: datetime


class MocRevisionsOut(Schema):
    moc_id: int
    moc_seq: int
    #: Mới thay thế gần đây nhất đứng trước.
    items: list[MocRevisionOut]


class HoSoOut(Schema):
    """Hồ sơ công khai `/u/<username>` — PLAN 5.9.

    **`machs` bị CẮT ở `?limit=` (mặc định 20, tối đa 50) và hồ sơ KHÔNG có cursor.**
    Người có nhiều mạch hơn thế thì phần dôi ra không lấy tiếp được bằng đường nào — đừng
    đọc `machs` như "toàn bộ mạch của người này", và đừng suy `so_mach` từ `len(machs)`:
    `so_mach` đếm cả phần bị cắt.

    Cảnh báo đó nằm ở docstring CLASS chứ không ở comment `#:` của trường là có lý do:
    `tests/test_hop_dong_openapi.py` chứng minh comment `#:` **không ra tới**
    `openapi.json`, nên chỉ docstring class mới tới được tay người dùng API.

    `so_mach`, `so_moc`, `so_binh_luan` đếm **nội dung đọc được**: nội dung đã xoá, bị mod
    ẩn, hoặc nằm trong một mạch đã bị mod ẩn đều không tính.

    **`duoc_trich` KHÔNG cùng luật đó**, và khác biệt là chủ đích: nó soi gương đúng khối
    trích trên thẻ mốc. Mạch bị mod ẩn, mốc nhận trích bị ẩn hoặc xoá, hay bình luận bị
    **mod ẩn** đều làm khối trích biến mất ⇒ không đếm. Nhưng tác giả **tự xoá** bình luận
    thì blockquote giữ nguyên body (PLAN 5.6, "sổ không-xoá-được" chống tác giả rút chữ)
    ⇒ `duoc_trich` **không đổi**.
    """

    username: str
    display_name: str
    bio: str
    date_joined: datetime
    so_mach: int
    #: Tổng mốc **đọc được** của người này.
    so_moc: int
    #: Tổng bình luận **đọc được** của người này.
    so_binh_luan: int
    #: "Được trích vào sổ ×N" — đếm theo **số chủ mạch KHÁC NHAU** đã trích bình luận của
    #: người này, và chỉ tính trích còn hiệu lực. Đếm theo người trích chứ không theo số
    #: lần là rào 3 của PLAN 5.6: hai nick trích qua lại không tự nâng nhau lên được.
    duoc_trich: int
    #: Mạch của họ, mới nhất trước. Cắt ở một trang; hồ sơ không có cursor ở bản này.
    machs: list[MachTomTatOut]
