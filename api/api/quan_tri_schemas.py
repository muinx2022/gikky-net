"""Schema của khu quản trị — PLAN 5.10, 9.3, mục 7 dòng cuối.

Tách khỏi `api/schemas.py` vì hai bộ có **hai luật ngược nhau**, và trộn chúng là cách
luật của bộ này bị đọc thành luật của bộ kia:

- `api/schemas.py` là hợp đồng CÔNG KHAI, và ở đó "bia mộ không có nội dung" là bất biến
  (`core/doc_noi_dung.py`);
- ở đây, mod **phải thấy** nội dung đã bị ẩn — PLAN 5.10 gọi nó là *soft-hide*, tức nội
  dung còn nguyên và chỉ bị che ở cửa công khai. Một hàng đợi báo cáo không hiện được nội
  dung bị tố là một hàng đợi không phán xử được gì.

Vì thế **mọi schema trong file này chỉ được trả sau `ChiMod`** (xem `api/quan_tri.py`).
Đừng import chúng vào một endpoint của `api_v1`: lúc đó chúng thành một cửa thứ hai đọc
được nội dung bị ẩn, không có hàng rào nào, và `tests/test_api_an_hien.py` không soi tới.

Cùng luật với `api/schemas.py` ở một điểm: docstring của **class** đi ra `description`
trong `openapi.admin.json`; comment `#:` trên từng trường thì **không** (pydantic 2 bỏ
qua chúng khi chưa bật `use_attribute_docstrings`).
"""

from datetime import date, datetime
from typing import Literal

from ninja import Schema

from api.schemas import NguoiDungTomTatOut

#: Trích yếu nội dung trong hàng đợi/nhật ký — đủ để mod nhận ra, không phải cả bài.
#: Không phải chuyện thẩm mỹ: `body` của một mốc lên tới 10.000 ký tự (PLAN 5.2), và một
#: hàng đợi 20 báo cáo sẽ đẩy 200 KB qua đường truyền cho mỗi lần bấm F5.
DAI_TRICH_YEU = 200

#: `Report.LyDo` / `Report.Dich` / `Report.action` khai bằng `Literal` để `openapi` ra
#: `enum` ⇒ TS client cho union thay vì `string` (PLAN 8.3). Giá trị phải trùng ĐÚNG
#: `TextChoices` của model — `tests/test_api_quan_tri_hop_dong.py` ghim cả hai chiều.
LyDoBaoCao = Literal["phim_hang", "lua_dao", "spam", "khac"]
DichBaoCao = Literal["mach", "moc", "comment"]
#: Hành động mod GHI LẠI khi đóng báo cáo. Nó **không tự thi hành** gì — xem
#: `core/ghi.py::dong_bao_cao`.
HanhDongDongBaoCao = Literal["an", "khoa", "ban", "bo_qua"]

#: Bộ lọc của hàng đợi. Mặc định `cho_xu_ly` vì đó là việc của mod; `tat_ca` có mặt để
#: tra lại một quyết định cũ.
LocBaoCao = Literal["cho_xu_ly", "da_xu_ly", "tat_ca"]


class NoiDungBiBaoCaoOut(Schema):
    """Ngữ cảnh của thứ bị báo cáo — PLAN 9.3: "bảng, **xem ngữ cảnh**, nút ẩn/khoá/ban".

    **Trường `trich_yeu` mang nội dung KỂ CẢ khi nó đã bị ẩn**, và đó là chủ đích của cả
    file này (xem docstring module). Nó chỉ ra được sau `ChiMod`.

    `None` cho cả object khi đích không còn tồn tại: `Report.target_id` là
    `BigIntegerField`, không phải FK — cố ý, vì một báo cáo phải sống sót được sau khi
    thứ bị tố bị xoá cứng. Frontend phải xử được ca đó chứ không giả định luôn có ngữ cảnh.
    """

    loai: DichBaoCao
    id: int
    #: `None` khi `loai == "mach"` — chính nó là mạch.
    mach_id: int | None
    mach_title: str
    tac_gia: NguoiDungTomTatOut | None
    trich_yeu: str
    #: `seq` của mốc, hoặc của mốc mà thread neo vào; `None` nếu không thuộc mốc nào.
    seq: int | None
    da_bi_an: bool
    #: Đường dẫn CÔNG KHAI để mod mở ra xem tận nơi, vd `/m/nhat-ky-lenh-hpg-12`.
    duong_dan_cong_khai: str


class BaoCaoOut(Schema):
    """Một dòng trong hàng đợi báo cáo (PLAN 5.10)."""

    id: int
    ly_do: LyDoBaoCao
    ghi_chu: str
    created_at: datetime
    reporter: NguoiDungTomTatOut
    dich: NoiDungBiBaoCaoOut | None
    resolved_at: datetime | None
    resolved_by: NguoiDungTomTatOut | None
    action: str | None


class TrangBaoCaoOut(Schema):
    """Một trang hàng đợi, cursor keyset theo `(created_at, id)` giảm dần."""

    items: list[BaoCaoOut]
    cursor_ke_tiep: str | None


class DongBaoCaoIn(Schema):
    """Body của `POST /reports/{id}/dong`."""

    hanh_dong: HanhDongDongBaoCao


class KetQuaDoiTrangThaiOut(Schema):
    """Kết quả CHUNG của mọi hành động moderation bật/tắt một trạng thái.

    Hai trường, và cả hai đều cần:

    - `da_doi` — hành động này có đổi gì không. Bấm "ẩn" lần thứ hai trả `false`, và đó
      **không** phải lỗi: `core/ghi.py` cố ý không reset `hidden_at` (mất mốc thời gian
      moderation thật) và không đẻ dòng `AuditLog` thứ hai. UI đọc trường này để không
      báo "đã ẩn xong" cho một cú bấm chẳng làm gì;
    - `dang_bat` — trạng thái SAU khi gọi. Đây là thứ UI vẽ, và nó đúng ở cả hai nhánh
      của `da_doi` — nên hai mod bấm cùng lúc vẫn thấy cùng một màn hình.
    """

    da_doi: bool
    dang_bat: bool


class DatAnIn(Schema):
    """Body của mọi endpoint ẩn/gỡ ẩn.

    **Một endpoint đặt-trạng-thái thay vì hai endpoint `hide`/`unhide`** — hai chiều nhận
    cùng bộ đầu vào, nên tách ra chỉ nhân đôi số chỗ phải kiểm quyền. Và nó **idempotent**:
    gửi `an=true` hai lần cho ra cùng một trạng thái.
    """

    an: bool
    #: Ghi vào `AuditLog.meta`, không hiện ra cửa công khai. Rỗng được — nó là ghi chú
    #: nội bộ giữa các mod, không phải lời giải thích cho tác giả (khác `ly_do` của ban).
    ly_do: str = ""


class DatKhoaMachIn(Schema):
    """Body của `POST /machs/{id}/khoa`.

    `khoa` là **trục riêng, không phải `status`** (PLAN 5.10, docstring `Mach`): mạch bị
    khoá vẫn đọc được nhưng cấm mọi tương tác, còn `closed` là tác giả tự đóng sổ.
    """

    khoa: bool
    ly_do: str = ""


class MocQuanTriOut(Schema):
    """Một mốc trong trang chi tiết của khu quản trị.

    Khác `MocOut` công khai ở đúng chỗ file này tồn tại: `trich_yeu` **không bị che** khi
    mốc đã bị ẩn hoặc là bia mộ — mod cần đọc để phán xử.
    """

    id: int
    seq: int
    #: DATE — ngày sự việc do người dùng đặt (PLAN 5.2), khác `created_at` của server.
    occurred_at: date
    created_at: datetime
    tac_gia: NguoiDungTomTatOut
    trich_yeu: str
    #: Hai trục ĐỘC LẬP, không gộp thành một `trang_thai`: mod cần phân biệt "tác giả tự
    #: xoá" (không gỡ được) với "tôi vừa ẩn" (gỡ được) để biết nút nào bấm được.
    da_bi_an: bool
    da_xoa: bool


class MachQuanTriOut(Schema):
    """Trang chi tiết một mạch cho mod (PLAN 9.3 mục 2) — kèm mọi mốc để bấm ẩn từng ô."""

    id: int
    title: str
    slug: str
    sub_slug: str
    tac_gia: NguoiDungTomTatOut
    status: str
    created_at: datetime
    last_entry_at: datetime
    last_activity_at: datetime
    entry_count: int
    comment_count: int
    da_bi_an: bool
    da_khoa: bool
    duong_dan_cong_khai: str
    mocs: list[MocQuanTriOut]


class NguoiDungQuanTriOut(Schema):
    """Hồ sơ một tài khoản dưới góc nhìn mod — trạng thái ban + vài con số để phán xử."""

    username: str
    display_name: str
    date_joined: datetime
    is_active: bool
    is_staff: bool
    #: Suy từ ba cột ban qua `User.dang_bi_ban()` — **không** phải cột thứ tư trong DB.
    #: Trả ra vì frontend không được tự dựng lại điều kiện ba cột (PLAN nguyên tắc 10).
    dang_bi_ban: bool
    ban_permanent: bool
    banned_until: datetime | None
    ban_reason: str | None
    so_mach: int
    so_binh_luan: int


class BanIn(Schema):
    """Body của `POST /users/{username}/ban`.

    `vinh_vien` và `den_khi` **loại trừ nhau**: đúng một trong hai. `core/ghi.py::ban_user`
    là chỗ ném lỗi nếu vi phạm, không phải pydantic — luật ấy thuộc đường ghi, và nó phải
    đúng cả khi ai đó gọi hàm từ `manage.py shell`.
    """

    ly_do: str
    vinh_vien: bool = False
    den_khi: datetime | None = None


class SubQuanTriOut(Schema):
    """Một sub trong khu quản trị — kèm `so_mach`, con số quyết định có xoá được hay không."""

    slug: str
    ten: str
    mo_ta: str
    created_at: datetime
    so_mach: int


class TaoSubIn(Schema):
    slug: str
    ten: str
    mo_ta: str = ""


class SuaSubIn(Schema):
    """PATCH: trường nào `None` là **không đổi**, không phải "đặt về rỗng".

    `slug` cố ý KHÔNG sửa được: nó nằm trong URL công khai `/s/<slug>` và trong
    `sitemap.ts`. Đổi nó là làm chết mọi liên kết đã phát ra ngoài, và đó phải là một việc
    có kế hoạch (kèm redirect 301) chứ không phải một trường trong form.
    """

    ten: str | None = None
    mo_ta: str | None = None


class KetQuaXoaSubOut(Schema):
    """Kết quả `DELETE /subs/{slug}`.

    Trả một thân JSON thay vì 204 rỗng vì client TS sinh từ OpenAPI: một `204` không thân
    cho ra kiểu `void`, và lúc đó `slug` vừa xoá — thứ UI cần để gỡ đúng hàng khỏi bảng —
    phải lấy từ biến cục bộ của lời gọi. Đúng thì đúng, nhưng nó là một lần suy lại.
    """

    slug: str
    da_xoa: bool


class NhatKyOut(Schema):
    """Một dòng `AuditLog` (PLAN 5.10: "mọi hành động mod ghi AuditLog")."""

    id: int
    actor: NguoiDungTomTatOut
    action: str
    target_type: str
    target_id: int | None
    meta: dict
    created_at: datetime


class TrangNhatKyOut(Schema):
    items: list[NhatKyOut]
    cursor_ke_tiep: str | None


def trich_yeu(body: str) -> str:
    """Cắt `body` xuống `DAI_TRICH_YEU`, gộp khoảng trắng, thêm `…` khi đã cắt.

    Gộp khoảng trắng vì `body` là markdown nhiều dòng: một dòng bảng trong hàng đợi mà
    mang cả `\\n` là bảng vỡ. Đây là phép cắt để HIỂN THỊ, không phải sanitize — nội dung
    này đi vào JSON và frontend render nó như văn bản thuần.
    """
    gon = " ".join(body.split())
    if len(gon) <= DAI_TRICH_YEU:
        return gon
    return gon[:DAI_TRICH_YEU] + "…"
