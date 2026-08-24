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
from typing import Literal

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


class AnhOut(Schema):
    """Một ảnh trong gallery của mốc — Phase 5.

    **Không trả `khoa_luu_tru` ra ngoài.** Client cần URL, và URL là thứ `STORAGES` sinh
    ra; trả thêm khoá thô là mời frontend tự ghép đường dẫn, rồi ngày đổi sang R2 (nơi
    URL có chữ ký và hạn dùng) thì bản ghép tay ấy vẫn "chạy" ở dev và chết trên prod.

    `w`/`h` là kích thước ảnh **đã lưu**, không phải file gốc — chúng dùng để đặt
    `width`/`height` trên thẻ `<img>` chống layout shift, nên phải khớp đúng file đang
    được phục vụ. `null` chỉ xảy ra với hàng cũ ghi trước Phase 5 (không có hàng nào).

    `exif_taken_at` là ngày chụp **server** đọc từ file gốc trước khi tái mã hoá xoá sạch
    EXIF. Nó là *gợi ý* cho `occurred_at`, không phải nguồn của nó: PLAN nguyên tắc 3 nói
    `occurred_at` do người dùng đặt, và một tấm ảnh chụp lại màn hình cũ có ngày chụp
    chẳng liên quan gì tới ngày sự việc.
    """

    id: int
    url: str
    url_thumb: str
    w: int | None
    h: int | None
    position: int
    exif_taken_at: datetime | None


#: Độ dài trích đoạn trên thẻ feed. Đủ ba dòng ở bề rộng cột chính, không hơn: thẻ feed
#: là chỗ QUYẾT ĐỊNH CÓ MỞ HAY KHÔNG, không phải chỗ đọc bài.
DAI_TRICH_FEED = 240


class XemTruocOut(Schema):
    """Nội dung xem trước của một thẻ feed, lấy từ **mốc 1**.

    ## Thứ tự ưu tiên, và vì sao chỉ có HAI tầng chứ không ba

    Yêu cầu ban đầu là ba tầng: **gallery → ảnh trong nội dung → chữ**. Tầng giữa hôm nay
    **không có nguồn nào**: `body` của mốc đi qua bộ markdown tập-con ở
    `apps/web/lib/markdown.ts`, và bộ ấy **cố ý không có cú pháp ảnh** (`![]()` in ra
    thành văn bản thường). Nên không tồn tại đường nào để một tấm ảnh nằm *trong* nội
    dung — ảnh chỉ sống ở gallery (`MocAnh`).

    Trường `anh` vì thế mang đúng một nghĩa hôm nay: **ảnh đầu của gallery**. Ngày nào
    markdown mở cú pháp ảnh thì tầng giữa cắm vào đây mà không đổi hình dạng schema —
    người gọi vẫn chỉ hỏi "có ảnh không", không hỏi "ảnh từ đâu ra".

    ## `trich` LUÔN có mặt, kể cả khi đã có ảnh

    Không phải để vẽ cả hai: nó là `alt` của tấm ảnh, và là thứ hiện ra khi ảnh chưa tải
    xong hoặc tải hỏng. Một thẻ feed rỗng vì một tấm ảnh 404 là một thẻ không ai bấm.
    """

    #: Trích đoạn **văn bản thuần** của `body` mốc 1 — đã gỡ dấu markdown, gộp khoảng
    #: trắng, cắt ở `DAI_TRICH_FEED`. Rỗng khi mốc 1 không có chữ nào.
    trich: str
    #: Ảnh ĐẦU TIÊN của gallery mốc 1, hoặc `null`. Chỉ ảnh đang thật sự phục vụ được —
    #: ảnh đã vào kho cách ly (mốc bia mộ / bị ẩn) không ra tới đây.
    anh: AnhOut | None
    #: Tổng số ảnh phục vụ được của mốc 1 — UI vẽ "+N" trên tấm đầu. `0` khi không có.
    so_anh: int


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
    #: `id` của **mốc 1** — đích mà mũi tên vote trên thẻ feed bắn vào (`POST /votes` nhận
    #: `target_type="moc"` + `target_id`). Thêm ở Phase 2 và **chỉ** ở schema thẻ:
    #: `MachChiTietOut` đã trả nguyên mốc 1 trong `mocs`, nên chép thêm một `id` ở tầng
    #: mạch là dựng hai chỗ nói cùng một con số — cùng lý lẽ với `diem`.
    #:
    #: `null` chỉ xảy ra với dữ liệu nạp tay thiếu mốc 1 (đường sản phẩm không tạo được
    #: `Mach` không mốc — PLAN 5.1). UI phải coi `null` là "không vote được ở đây" chứ
    #: không đoán một id.
    moc_1_id: int | None
    #: Nội dung xem trước trên thẻ feed, lấy từ **MỐC 1** — thêm 2026-08-23.
    #:
    #: `null` khi mốc 1 không đọc được (bia mộ hoặc bị mod ẩn) hoặc không có mốc 1. UI
    #: khi đó vẽ thẻ chỉ-tiêu-đề như trước, **không** bịa một dòng "nội dung đã bị gỡ" —
    #: thẻ feed không phải chỗ thông báo chuyện kiểm duyệt.
    xem_truoc: XemTruocOut | None


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


class KetQuaTimKiemOut(Schema):
    """Một dòng kết quả tìm kiếm — Phase 7.

    `mach` là **đúng thẻ mà feed dùng** (`MachTomTatOut`), không phải một hình dạng thứ
    hai: trang kết quả vẽ lại cùng loại thẻ với trang chủ, nên hai schema khác nhau chỉ
    tạo hai đường trôi.

    Hai trường tô đậm dùng dấu **`[[` `]]`**, không phải HTML. Trả `<mark>` về đây là mời
    `dangerouslySetInnerHTML` vào một đường dữ liệu do người dùng viết; frontend tự dựng
    thẻ từ cặp dấu (`apps/web/lib/tim-kiem.ts`). Chữ trong hai trường này đến từ
    **Postgres**, không phải từ chỉ mục — xem docstring `api/tim_kiem.py`.
    """

    mach: MachTomTatOut
    title_to_dam: str
    doan_trich: str


class TimKiemOut(Schema):
    """Một trang kết quả tìm kiếm.

    `co_the_tim = false` là **xuống thang**, không phải lỗi: Meilisearch chưa cấu hình
    hoặc đang hỏng. Endpoint vẫn trả 200 để trang gọi vẽ được một câu nói bằng tiếng
    người thay vì xử một mã lỗi như xử sự cố (plan con Phase 7 §5).

    `tong` là **ước lượng** của Meilisearch (`estimatedTotalHits`), đếm trước khi lớp lọc
    Postgres chạy — nên `len(items)` có thể nhỏ hơn `tong` chia trang. Nói ra ở đây để
    frontend không dựng bộ đếm trang chính xác trên một con số không chính xác.
    """

    items: list[KetQuaTimKiemOut]
    tong: int
    co_the_tim: bool
    q: str


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
    `question_for_crowd`, `edited_at`, **`author`** đều `null`, còn `edit_count` và
    `score` về `0` — số phiếu của nội dung đã gỡ không được trả ra, cùng chuẩn với
    `BinhLuanOut`. `seq`, `occurred_at`, `so_binh_luan` và chỗ đứng trên spine vẫn còn:
    `seq` bất biến, giấu hẳn một ô là thủng dãy số, và ngăn kéo của bia mộ vẫn mở được
    (PLAN 5.2).
    """

    id: int
    seq: int
    #: **Tác giả của MỐC NÀY** — không suy được từ `MachChiTietOut.author` (nợ
    #: `MOC-THIEU-AUTHOR`, trả 2026-08-23).
    #:
    #: Hai cột hôm nay luôn trùng nhau (chỉ chủ mạch nối được mốc), nhưng `PATCH`/`DELETE
    #: /mocs/{id}` cố ý hỏi `Moc.author` chứ không `Mach.author` — để còn đúng khi đồng
    #: tác giả mở ra. Không có trường này thì frontend buộc phải suy quyền sửa/xoá từ chủ
    #: MẠCH, tức một bản sao thứ hai của luật quyền, và bản sao ấy sai đúng vào ngày cột
    #: kia tách ra. `null` ở bia mộ, cùng chuẩn với `BinhLuanOut.author`.
    author: NguoiDungTomTatOut | None
    #: Ngày **sự việc xảy ra**, người dùng đặt, nhập lùi được (PLAN nguyên tắc 3).
    occurred_at: date
    #: Dấu thời gian **server**, bất biến — bằng chứng "ghi lúc nào".
    created_at: datetime
    #: Sửa mốc TRƯỚC mốc này thì không để lại dấu; sau nó, mỗi lần sửa hiện "đã sửa" và
    #: lưu một `MocRevision` (PLAN nguyên tắc 2, 5.2). `created_at + 15 phút`.
    #:
    #: Server trả sẵn thay vì để UI cộng lấy: câu cảnh báo "còn N phút sửa im lặng" phải
    #: nói ra TRƯỚC khi người ta bấm Lưu, và một bản sao của con số 15 ở frontend là bản
    #: sẽ trôi (nợ `API-THIEU-MOC-THOI-GIAN`). Có giá trị cả ở **bia mộ** — nó suy từ
    #: `created_at`, không phải nội dung, nên không có gì để che.
    sua_im_lang_den: datetime
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
    #: Đếm reaction theo khoá, **đủ 5 khoá kể cả khoá bằng 0** — cùng hình dạng với
    #: `ReactionOut.dem`, và cùng lý do: UI vẽ nguyên bộ 📈📉🔥🧊🎯, một khoá vắng mặt
    #: là một icon nhấp nháy xuất hiện/biến mất theo lượt bấm.
    #:
    #: **Không phải dữ liệu per-user** ⇒ nằm được trên cửa ISR (PLAN 8.4). Phiếu của
    #: chính người xem đến từ `GET /machs/{id}/me::my_reactions`, ở trình duyệt, sau.
    #:
    #: Bia mộ trả **rỗng hết 5 khoá**: hàng `Reaction` vẫn còn trong DB (nó không bị xoá
    #: cùng nội dung), nhưng phô "🔥 9" trên một thẻ không còn chữ nào là đúng ca mà
    #: `score` đã bị zero hoá để tránh — xem docstring `trinh_bay.py::moc_ra`.
    reactions: dict[str, int]
    trich: TrichOut | None
    #: Gallery của mốc, sắp theo `position` (PLAN 5.2 — ≤10 ảnh/mốc).
    #:
    #: **`[]` ở bia mộ và ở mốc bị mod ẩn** — cùng chuẩn với `body`/`figures`/`trich`, và
    #: đó là vế A9 mà tầng API làm được. Vế còn lại (file trên đĩa, do Caddy phục vụ
    #: KHÔNG qua Django) không nằm trong schema nào: xem `core/anh_luu.py`.
    #:
    #: Danh sách rỗng chứ không `null`: nguyên tắc 9 nói mốc không ảnh thì **không render
    #: gì cả**, và `[]` với `null` cho cùng một câu trả lời cho câu hỏi đó trong khi `[]`
    #: bớt cho UI một nhánh.
    anhs: list[AnhOut]


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
    #: Hạn chót **mở lại sổ** — `closed_at + 7 ngày` (PLAN 5.1). `null` khi mạch đang mở.
    #:
    #: PLAN 5.1 chốt "sau đó **nút biến mất**", nên UI cần một câu trả lời cho *"nút Mở
    #: lại có được vẽ ra không"*. Trước lượt 2026-08-23 nó phải tự cộng 7 ngày vào
    #: `closed_at` — bản sao thứ hai của một hằng domain, đúng thứ PLAN nguyên tắc 10 cấm
    #: (nợ `API-THIEU-MOC-THOI-GIAN`). Server vẫn là bên từ chối (409 `het_han_mo_lai`);
    #: trường này chỉ để UI **không vẽ** một cái nút chắc chắn ăn lỗi.
    mo_lai_den: datetime | None
    #: Trần "N mốc mỗi ngày lịch VN" của PLAN 5.1 — **hằng cấu hình server**, không phải
    #: trạng thái của mạch này.
    #:
    #: Nằm ở đây vì đúng một lý do, cùng lý lẽ với `ToiOut.google_bat`: form nối mốc phải
    #: **nói ra con số trước khi người ta gõ**, và cách duy nhất còn lại là gõ cứng nó vào
    #: JSX. Bản sao ấy đã tồn tại ở `apps/web/lib/vong-doi.ts` cho tới 2026-08-23 (nợ
    #: `API-THIEU-MOC-THOI-GIAN`); nó phải có một cái chuông đọc thẳng file Python để khỏi
    #: trôi, và một trường ở đây rẻ hơn hẳn cái chuông đó.
    tran_moc_moi_ngay: int
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


# --- Kết quả của ĐƯỜNG GHI (Phase 2) -----------------------------------------
# Thân REQUEST của đường ghi nằm ở `api/schemas_ghi.py` — hai họ tách nhau vì schema đọc
# PHẢI có `created_at` còn schema ghi thì CẤM. Ba schema dưới đây là *response*, nên chúng
# ở lại đây cùng họ đọc.


class VoteOut(Schema):
    """Kết quả một lượt vote — `POST /votes` (PLAN 5.7).

    Trả về **con số mới của đích** chứ không chỉ "ok": UI vote lạc quan (optimistic) cần
    một nguồn sự thật để đối chiếu sau khi mạng trả lời, nếu không hai lượt bấm nhanh sẽ
    để lại một con số client tự cộng mà server không đồng ý. `value = 0` nghĩa là vừa rút.

    `up_count`/`down_count` chỉ có nghĩa với đích là **bình luận** — mốc chỉ lưu `score`
    (PLAN mục 6), nên với mốc hai trường này là `null`, không phải `0`.
    """

    target_type: str
    target_id: int
    #: Phiếu của TÔI sau lượt này: `1`, `-1`, hoặc `0` (đã rút).
    value: int
    score: int
    up_count: int | None
    down_count: int | None


class ReactionOut(Schema):
    """Kết quả một lượt reaction — `POST /mocs/{id}/reactions`. `emoji = null` là đã rút."""

    moc_id: int
    emoji: str | None
    #: Số reaction theo từng khoá, kể cả khoá đang bằng 0 — UI vẽ đủ bộ 📈📉🔥🧊🎯.
    dem: dict[str, int]


class ToiOut(Schema):
    """`GET /me` — người đang đăng nhập là ai (thêm ở Phase 2, PLAN mục 7).

    **Không cache được, và không được nướng vào page cache** (PLAN 8.4 điểm 4): đây là
    response per-user thuần tuý. Khác `GET /machs/{id}/me` ở chỗ nó không phụ thuộc mạch
    nào — header cần biết "ai đang đăng nhập" trên MỌI trang.

    Khách chưa đăng nhập nhận **200** kèm `dang_nhap = false`, không phải 401: header là
    thứ render trên mọi trang, và một endpoint trả lỗi cho trạng thái bình thường nhất của
    hệ thống sẽ đẩy frontend vào chỗ phải coi lỗi là chuyện thường.

    `google_bat` là **cấu hình server**, không phải trạng thái người dùng, và nó nằm ở đây
    vì đúng một lý do: PLAN mục 4 cấm nút vĩnh viễn không bấm được, nên trang đăng nhập
    phải biết có nên **render** nút Google hay không — `false` ⇒ nút **vắng mặt**, không
    phải `disabled`.
    """

    dang_nhap: bool
    username: str | None
    display_name: str | None
    #: Chỉ chủ tài khoản thấy — endpoint này không bao giờ trả email của người khác.
    email: str | None
    email_da_xac_thuc: bool
    la_staff: bool
    google_bat: bool
    #: Có nhận email digest tuần không (PLAN 5.8 — **opt-in**, mặc định `false`). Đặt bằng
    #: `PATCH /me`. Có mặt ở đây vì một công tắc không đọc lại được trạng thái là một công
    #: tắc UI phải đoán; khách chưa đăng nhập nhận `false`.
    nhan_digest: bool

    #: Trần "N ảnh mỗi mốc" của PLAN 5.2 — **hằng cấu hình server** (Phase 5), cùng loài
    #: `google_bat` ngay trên: không phải trạng thái người dùng, mà là thứ UI cần biết
    #: trước khi vẽ.
    #:
    #: Nằm ở `GET /me` chứ không ở `MachChiTietOut` (nơi `tran_moc_moi_ngay` ở) vì **ba**
    #: form cần nó, và một trong ba là form **đăng mạch** — ở đó chưa có mạch nào để hỏi.
    #: Đặt ở cả hai chỗ là hai nguồn cho một con số; đặt ở đây là một nguồn cho cả ba, và
    #: cả ba form đã gọi `usePhien()` sẵn nên không tốn thêm lượt fetch nào.
    #:
    #: Không gõ cứng `10` vào `apps/web/lib/anh.ts`: repo này đã trả đúng món nợ ấy hai
    #: lần (`API-THIEU-MOC-THOI-GIAN`), và một hằng chép tay ở frontend là hằng sẽ trôi
    #: khi server đổi số — im lặng, và về phía cho phép nhiều hơn thực tế.
    tran_anh_moi_moc: int


class BaoCaoDaGuiOut(Schema):
    """Biên nhận của `POST /reports` — PLAN 5.10 (L03, lượt vá V1).

    **Cố ý không trả trạng thái xử lý.** Người tố không được biết mod đã làm gì với báo
    cáo của mình, và endpoint này không được biến thành một cửa dò xem hàng đợi có gì:
    `resolved_at`/`resolved_by`/`action` chỉ sống ở `/api/admin`.

    Trả `id` vì UI cần một khoá để không hiện hai lần biên nhận cho cùng một lượt bấm;
    trả `created_at` vì đó là dấu thời gian **của server**, thứ duy nhất trả lời được
    "mình đã tố lúc nào".
    """

    id: int
    target_type: Literal["mach", "moc", "comment"]
    target_id: int
    ly_do: Literal["phim_hang", "lua_dao", "spam", "khac"]
    created_at: datetime


class KetQuaXoaOut(Schema):
    """Kết quả `DELETE /comments/{id}` — PLAN 5.3.

    `xoa_that = false` nghĩa là bình luận **ở lại làm bia mộ** "[đã xoá]" vì nó còn reply
    con **hoặc đã TỪNG được trích vào sổ** (kể cả trích đã gỡ). UI phải render lại nút đó
    thành bia mộ chứ không gỡ nó khỏi cây — gỡ đi là làm mồ côi cả nhánh con.
    """

    id: int
    xoa_that: bool


# --- Trạng thái của VIEWER (Phase 3) -----------------------------------------
# Mọi schema dưới đây là mặt đối lập của luật ở đầu file: chúng **chỉ có nghĩa khi biết
# người xem là ai**, nên chúng chỉ được xuất hiện ở `GET /machs/{id}/me` và
# `GET /notifications` — hai endpoint per-user tuyệt đối, KHÔNG BAO GIỜ được cache
# (PLAN 8.4 điểm 4).
#
# **Tên trường ở đây là tiếng Anh, ngược quy ước tiếng Việt của cả file.** Cố ý:
# `my_votes`/`my_reactions`/`following`/`last_seen_entry_seq` là nguyên văn PLAN mục 7, và
# `tests/test_api_mach.py::MANH_PER_USER` đã ghim đúng những mảnh chữ ấy (`"my_"`,
# `"following"`, `"last_seen"`) làm danh sách CẤM của `GET /machs/{id}`. Việt hoá ở đây là
# để hàng rào bên kia canh một tập tên mà không cửa nào còn dùng tới.


class VoteCuaToiOut(Schema):
    """Một lá phiếu của **người đang xem** trên một mốc hoặc một bình luận của mạch này."""

    #: `"moc"` | `"comment"` — cùng bộ giá trị với `Vote.Loai` và với `POST /votes`.
    target_type: str
    target_id: int
    #: `1` hoặc `-1`. **Không bao giờ `0`**: rút phiếu là xoá hàng, nên phiếu đã rút vắng
    #: mặt khỏi danh sách chứ không xuất hiện với giá trị `0` (xem `core.models.Vote`).
    value: int


class ReactionCuaToiOut(Schema):
    """Reaction của **người đang xem** trên một mốc. Một user tối đa một reaction mỗi mốc."""

    moc_id: int
    emoji: str


class NoiDungCuaToiOut(Schema):
    """Một mảnh nội dung **của chính người gọi** đang bị che ở cửa công khai — PLAN 5.2 + 5.10.

    PLAN 5.10 chốt moderation là *"ẩn (soft-hide — **tác giả vẫn thấy kèm nhãn**)"*, và
    PLAN 5.2 nhắc lại: *"tác giả thấy **nội dung**, người khác thấy nhãn"*. Vế ấy không cài
    được ở `GET /machs/{id}` — cửa đó bị ép **không chứa gì per-user** vì cả trang cache
    theo URL (PLAN 8.4), nên nhét nội dung của tác giả vào là phục vụ nó cho mọi người mở
    cùng URL. Vì thế nó sống ở đây: `GET /machs/{id}/me` vốn đã per-user, đã `no-store`,
    và đã chạy trên mọi lượt tải trang mạch.

    Client vá `body` này vào đúng ô trống mà `GET /machs/{id}` để lại, kèm nhãn của
    `trang_thai` — **không** xoá nhãn đi. Tác giả phải biết là người khác KHÔNG đọc được.

    ⚠ **Chỉ có mặt khi người gọi là `author` của chính mảnh đó.** Đây là chỗ nguy hiểm
    nhất của cả cửa này: trả nhầm của người khác biến một bản vá minh bạch thành một lỗ
    rò nội dung đã bị mod gỡ, trên một endpoint không ai soi vì nó "chỉ trả trạng thái".
    `tests/test_api_noi_dung_cua_toi.py` đo **cả hai chiều**.
    """

    #: `"moc"` hoặc `"comment"` — client cần biết vá vào thẻ mốc hay nút bình luận.
    loai: Literal["moc", "comment"]
    #: `id` của `Moc`/`Comment`. `Moc` cũng trả `seq` để client khỏi phải tra ngược.
    id: int
    seq: int | None
    body: str
    #: `da_xoa` (tự xoá) hay `da_an` (mod ẩn) — quyết định câu nhãn hiện cạnh nội dung.
    trang_thai: TrangThaiNoiDung


class MachCuaToiOut(Schema):
    """`GET /machs/{id}/me` — trạng thái của NGƯỜI XEM trên một mạch (PLAN mục 7, 8.4).

    **Response này KHÔNG BAO GIỜ được cache.** Nó là nửa còn lại của cặp mà PLAN 8.4 dựng
    lên: `GET /machs/{id}` không chứa gì per-user nên trang cache được, còn mọi thứ phụ
    thuộc người xem đi qua đây, sau khi trang đã render. Một `Cache-Control` lỏng hay một
    lượt nướng nội dung này vào HTML tĩnh là phục vụ phiếu bầu của người này cho người kia.

    Khách chưa đăng nhập nhận **200** với `dang_nhap = false`, hai danh sách rỗng và
    `following = false` — cùng lý lẽ `ToiOut`: đây là lời gọi chạy trên mọi lượt tải trang
    mạch, kể cả của bot, nên 401 ở trạng thái bình thường nhất của hệ thống là dạy frontend
    coi lỗi là chuyện thường.

    `face` ở đây **có thể khác** `face` của `GET /machs/{id}`, và đó là toàn bộ lý do
    trường này tồn tại ở cả hai chỗ. Bên kia tính vế thời gian của PLAN 5.5 (cache được);
    bên này áp thêm vế thứ hai — *"user đăng nhập VÀ đã follow hoặc từng bình luận mạch
    này"*. Vì vế 2 là một phép HOẶC, `face` ở đây chỉ có thể **CẶN → BÃO**, không bao giờ
    ngược lại. Frontend lấy `face` của endpoint này khi có, và rơi về bên kia khi khách.
    """

    #: `false` ⇒ mọi trường còn lại ở trạng thái rỗng. Không phải lỗi — xem docstring.
    dang_nhap: bool
    #: Mặt của mạch **với người xem này** — PLAN 5.5 đủ hai vế. Server quyết (nguyên tắc 10).
    face: Mat
    #: Phiếu của tôi trên MỌI mốc và MỌI bình luận của mạch này, một lần gọi. Phiếu không
    #: có nghĩa là chưa vote — không có mục nào mang `value = 0`.
    my_votes: list[VoteCuaToiOut]
    my_reactions: list[ReactionCuaToiOut]
    following: bool
    #: Vạch mới kẻ TRƯỚC mốc `last_seen_entry_seq + 1` (PLAN 5.5). `0` = chưa xem mốc nào.
    #: Người **chưa follow** luôn nhận `0`: cột này sống trên hàng `Follow` (PLAN mục 6),
    #: nên không theo mạch thì không có chỗ nào ghi vị trí đọc.
    last_seen_entry_seq: int
    #: Người xem đã từng viết bình luận trong mạch này chưa — vế 2 của luật BÃO ở PLAN 5.5.
    #: Trả ra chứ không chỉ dùng nội bộ để UI giải thích được vì sao mạch nguội vẫn mở ra
    #: mặt BÃO, thay vì để người dùng thấy một trạng thái không lý do.
    tung_binh_luan: bool
    #: Mốc và bình luận **của chính người gọi** đang bị che ở cửa công khai — vế
    #: "tác giả vẫn thấy kèm nhãn" của PLAN 5.2 + 5.10. Rỗng với khách và với người không
    #: có nội dung nào bị che. Xem `NoiDungCuaToiOut`.
    noi_dung_cua_toi: list[NoiDungCuaToiOut]


class DaXemOut(Schema):
    """Kết quả `POST /machs/{id}/seen` — PLAN 5.5.

    **`following = false` nghĩa là KHÔNG GHI GÌ**, và đó là câu trả lời trung thực chứ
    không phải một lỗi: `last_seen_entry_seq` sống trên hàng `Follow` (PLAN mục 6), nên
    người chưa theo mạch không có chỗ nào để lưu vị trí đọc. Endpoint nhận request (200)
    thay vì 404 — client không phải biết trước mình có theo hay không mới dám đặt một cái
    bookmark — nhưng nó **nói ra** rằng không có gì được lưu, thay vì trả một `{ok: true}`
    rỗng nghĩa.

    Con số trả về là giá trị **sau** lượt ghi, và nó chỉ tiến không lùi: mở lại một mốc cũ
    trên spine không được kéo vạch mới về sau (xem `core.ghi.dat_da_xem`).
    """

    following: bool
    last_seen_entry_seq: int


class TheoMachOut(Schema):
    """Kết quả `POST`/`DELETE /machs/{id}/follow` — PLAN 5.7. Cả hai đều idempotent.

    `last_seen_entry_seq` có mặt vì lượt theo ĐẦU TIÊN đặt nó bằng `entry_count` hiện tại,
    không phải `0`: người ta theo để biết chuyện **sắp** xảy ra, không phải để bị giao lại
    toàn bộ quá khứ (xem `core.ghi.dat_follow`). Bỏ theo ⇒ `false` và `0`.
    """

    mach_id: int
    following: bool
    last_seen_entry_seq: int


class ThongBaoOut(Schema):
    """Một dòng chuông — PLAN 5.8.

    `payload` là **JSON tự do có chủ đích**: ba loại thông báo mang ba bộ trường khác nhau,
    và ép chúng vào một schema chung sẽ ra một object mà 2/3 số trường luôn `null`. Các
    khoá chung cho cả ba loại: `mach_id`, `mach_title`, `mach_slug` — đủ để render một
    dòng có link mà **không phải join** sang bảng nào, điều kiện để chuông poll 60 giây
    một lần không thành một câu truy vấn nặng.

    Cái giá của việc chép sẵn tiêu đề vào payload: đổi tiêu đề mạch thì dòng chuông cũ giữ
    tiêu đề tại thời điểm báo. Đó là hành vi ĐÚNG cho một thông báo — nó kể lại một sự
    kiện đã xảy ra — không phải một chỗ dữ liệu trôi.

    `type`: `"moc_moi"` | `"trich"` | `"reply"`.
    """

    id: int
    type: str
    payload: dict
    created_at: datetime
    #: `null` = chưa đọc. Đây là cột chấm đỏ trên chuông đọc tới.
    read_at: datetime | None


class ChuongOut(Schema):
    """`GET /notifications` — chuông poll 60 giây (PLAN 5.8). **Per-user, cấm cache.**

    Trả kèm `so_chua_doc` của **toàn bộ** hộp thư chứ không phải của trang đang xem: con
    số trên chấm đỏ nói "bạn có 23 thứ chưa đọc", và tính nó trên một trang 20 dòng sẽ cho
    ra `20` mãi mãi — một con số trông hợp lý và luôn sai.
    """

    items: list[ThongBaoOut]
    so_chua_doc: int
    #: Cursor keyset của trang sau, `null` khi hết. Khoá là `(created_at, id)` giảm dần —
    #: khoá BẤT BIẾN, nên nó hưởng đủ bảo đảm "không trùng, không sót" của `api/phan_trang.py`.
    cursor_ke_tiep: str | None


class DaDocOut(Schema):
    """Kết quả `POST /notifications/read`. `so_da_danh_dau` là số dòng **vừa đổi trạng thái**.

    Đánh dấu lại một thông báo đã đọc **không** được tính vào con số đó, và không được dời
    `read_at` cũ: hai lần bấm "đọc hết" phải ra `so_da_danh_dau = 0` ở lần thứ hai, nếu
    không thì con số này không nói được gì.
    """

    so_da_danh_dau: int
    so_chua_doc: int


class TrichKetQuaOut(Schema):
    """Kết quả `POST`/`DELETE /mocs/{id}/trich` — PLAN 5.6.

    Trả về **cả thẻ mốc** (`moc`) chứ không chỉ mỗi khối trích: rào 4 của PLAN 5.6 bắt
    khối trích render **tách bạch khỏi thân mốc** như một chú thích, nên UI phải vẽ lại cả
    cái thẻ. Trả mỗi `TrichOut` thì client phải tự ghép vào state của thẻ — tức có một bản
    thứ hai của luật "trích gắn vào đâu", và bản đó sẽ trôi.

    `moc.trich` là `null` sau khi gỡ. Hình dạng `moc` giống hệt `GET /machs/{id}`.
    """

    moc: MocOut
