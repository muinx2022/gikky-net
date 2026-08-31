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
#: Sáu lý do — **phủ đủ bốn điều cấm của `/luat`** (mở rộng 2026-08-25). Thứ tự khớp
#: `Report.LyDo`; `test_api_quan_tri_hop_dong.py` đối chiếu hai chiều nên lệch là ĐỎ.
LyDoBaoCao = Literal[
    "phim_hang",
    "cam_ket_loi_nhuan",
    "lua_dao",
    "link_nhom_kin",
    "spam",
    "khac",
]
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
    #: Mạch chứa nó (hoặc chính nó) đang bị mod KHOÁ chưa — PLAN 5.10.
    #:
    #: Có mặt vì hàng đợi có nút "Khoá mạch" ngay trên hàng (L04), và một nút bật/tắt
    #: không biết trạng thái hiện tại thì mod phải đoán. `dat_khoa_mach` idempotent nên
    #: bấm nhầm chiều không hỏng gì — nhưng nó trả `da_doi=false` và màn hình không đổi,
    #: tức mod nhận đúng phản hồi của một nút chết.
    mach_da_khoa: bool
    #: Tác giả của nội dung này đang bị ban chưa (`User.dang_bi_ban()` — ba cột, một phép
    #: đọc, không truy vấn thêm). `None` khi không còn tác giả (bia mộ).
    tac_gia_bi_ban: bool | None
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
    tong: int


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
    #: Thêm 2026-08-25 (`plans/2026-08-25-crud-nguoi-dung.md`).
    is_superuser: bool
    email: str
    #: `has_usable_password()`. Tài khoản `False` chỉ vào được bằng Google hoặc
    #: `/quen-mat-khau` — **không phải khoá ngoài**, nhưng giao diện phải nói ra chứ đừng
    #: bày ra ô "đổi mật khẩu hiện tại" cho họ.
    co_mat_khau: bool
    #: Nhãn "thuộc nhóm nào" — tính ở SERVER. gikky **không dùng `auth.Group`**; nhóm ở
    #: đây là vai trò thật: Superuser · Mod · Thành viên. Để frontend tự suy từ hai cờ là
    #: dựng bản thứ hai của cùng một luật (PLAN nguyên tắc 10), và bản thứ hai sẽ lệch.
    vai_tro: str
    #: Chuyên mục được phân công (`ModSub`) — "nhóm" theo nghĩa gikky có thật.
    #: ⚠ Danh sách PHÂN CÔNG, không phải danh sách QUYỀN.
    subs_mod: list[str]


class BanIn(Schema):
    """Body của `POST /users/{username}/ban`.

    `vinh_vien`, `den_khi` và `so_ngay` **loại trừ nhau**: đúng một trong ba.
    `core/ghi.py::ban_user` là chỗ ném lỗi cho cặp `vinh_vien`/`den_khi`, không phải
    pydantic — luật ấy thuộc đường ghi, và nó phải đúng cả khi ai đó gọi hàm từ
    `manage.py shell`. `so_ngay` thì **không** xuống tới đường ghi: nó được quy đổi thành
    `den_khi` ở tầng API (`api/quan_tri_nguoi_dung.py`), nên `ban_user` vẫn chỉ biết đúng
    hai kiểu ban và bất biến của nó không rộng ra.
    """

    ly_do: str
    vinh_vien: bool = False
    den_khi: datetime | None = None
    #: Ban tạm **N ngày kể từ BÂY GIỜ**, đồng hồ của máy chủ — L33.
    #:
    #: Có mặt vì khu quản trị đang tự tính `now + N ngày` bằng đồng hồ trình duyệt rồi gửi
    #: `den_khi` lên (`apps/admin/app/u/[username]/page.tsx`). Máy mod lệch giờ, hoặc để
    #: sai múi, là hạn ban lệch theo — và không có gì kêu, vì server nhận một mốc thời
    #: gian hợp lệ. Nguyên tắc 10: luật domain thuộc về Django.
    so_ngay: int | None = None


class SubQuanTriOut(Schema):
    """Một sub trong khu quản trị — kèm `so_mach`, con số quyết định có xoá được hay không.

    `mods` — người được phân công phụ trách chuyên mục (2026-08-24).

    ⚠ **Danh sách này CHƯA cấp quyền gì cho ai.** Không endpoint kiểm duyệt nào hỏi tới
    nó; `ChiMod` vẫn chỉ nhìn `is_staff`. Xem `core/models/dien_dan.py::ModSub` và
    `plans/2026-08-24-mod-chuyen-muc.md` §0. Đọc nó thành "những người này đang moderate
    được" là hiểu sai theo hướng nguy hiểm.
    """

    slug: str
    ten: str
    mo_ta: str
    created_at: datetime
    so_mach: int
    mods: list[NguoiDungTomTatOut]


class TaoSubIn(Schema):
    slug: str
    ten: str
    mo_ta: str = ""


class TaoNguoiDungIn(Schema):
    """Body của `POST /admin/users` — superuser tạo tài khoản hộ.

    **Không có `is_staff`/`is_superuser`**, và đó là hợp đồng: cấp quyền mod vẫn nằm
    ngoài khu quản trị (PLAN mục 7). Xem `plans/2026-08-25-crud-nguoi-dung.md` §0.
    """

    username: str
    email: str
    display_name: str = ""
    #: `None` ⇒ tài khoản không có mật khẩu, vào bằng Google hoặc `/quen-mat-khau`.
    mat_khau: str | None = None


class SuaNguoiDungIn(Schema):
    """Body của `PATCH /admin/users/{username}`. Trường `None` = **không đổi**.

    `username` **không có mặt** — nó nằm trong URL công khai `/u/<username>` và trong mọi
    trích dẫn `u/…`; đổi nó là làm chết liên kết đã phát ra ngoài, cùng lý lẽ `Sub.slug`.

    `is_staff`/`is_superuser` cũng **không có mặt** — xem `TaoNguoiDungIn`.
    """

    display_name: str | None = None
    email: str | None = None
    is_active: bool | None = None


class DatMatKhauIn(Schema):
    """Body của `POST /admin/users/{username}/mat-khau`.

    `mat_khau: null` ⇒ **xoá mật khẩu** (`set_unusable_password`) — vế "set pass rỗng"
    của đơn hàng. Khác hẳn `SuaNguoiDungIn`, nơi `None` nghĩa là "không đổi": ở đây body
    chỉ có một trường và mục đích của lời gọi luôn là *đổi mật khẩu*, nên `null` không thể
    mang nghĩa "không làm gì".
    """

    mat_khau: str | None = None


class DoiQuyenModIn(Schema):
    """Body của `POST /admin/users/{username}/quyen-mod` — công tắc `is_staff`.

    ⚠ **Chỉ có `bat`.** Không khai `is_staff` cũng không khai `is_superuser`.
    `is_superuser` **không** cấp được từ khu quản trị ở bất kỳ cửa nào — Django admin vẫn
    là nơi duy nhất phong superuser.

    Hàng rào cho luật ấy là một dòng chấm **thẳng lên hình dạng schema**:
    `test_api_quyen_mod.py::test_B9_…` khẳng định `set(model_fields) == {"bat"}`.
    Đừng thay nó bằng bài "gửi kèm khoá lạ rồi đòi cờ không đổi" — bài ấy XANH kể cả khi
    schema mọc thêm trường, vì handler chỉ đọc `du_lieu.bat`. Bản đầu của lượt này mắc
    đúng lỗi đó và lượt phản biện bắt được.
    """

    #: `True` = cấp quyền mod · `False` = thu. **Idempotent**: đặt trùng giá trị đang có
    #: trả 200, không 409 — một công tắc báo lỗi khi bị gạt về đúng vị trí nó đang đứng
    #: là một công tắc hỏng. (Khác `gan_mod_sub`, nơi "đã là mod ⇒ 409" đúng vì đó là
    #: *thêm vào một danh sách*, không phải gạt một công tắc hai trạng thái.)
    bat: bool


class CaiDatGoogleOut(Schema):
    """Trạng thái Google OAuth cho trang Cài đặt.

    ⚠ **KHÔNG có trường secret, và đó là hợp đồng chứ không phải sơ suất.** Chỉ
    `secret_duoi` — 4 ký tự cuối, đủ để người ta nhận ra mình đã dán đúng chuỗi nào,
    không đủ để dùng lại. `tests/test_api_quan_tri_cai_dat.py` quét toàn bộ body tìm
    chuỗi secret và ĐỎ nếu thấy.
    """

    #: Google có dùng được **ngay lúc này** không (hỏi đúng đường allauth đi).
    bat: bool
    #: `"db"` · `"env"` · `null`. Trang cài đặt hai nguồn bắt buộc phải nói ra cái nào
    #: đang chạy — thiếu nó, người sửa DB mà thấy không đổi gì sẽ đi tìm lỗi ở chỗ không
    #: có lỗi.
    nguon: str | None
    client_id: str
    secret_da_dat: bool
    secret_duoi: str
    #: URL dán vào "Authorized redirect URIs" của Google Cloud Console. Dựng từ
    #: `FRONTEND_ORIGIN` + `reverse("google_callback")` — xem
    #: `core/cau_hinh_oauth.py::redirect_uri`.
    redirect_uri: str
    #: Người đang xem có được GHI không. Giao diện dùng nó để khoá form thay vì bày ra một
    #: nút bấm vào thì 403 (PLAN mục 4).
    sua_duoc: bool


class CaiDatGoogleIn(Schema):
    """Body của `PUT /admin/cai-dat/google`.

    `secret` **vắng hoặc rỗng ⇒ GIỮ NGUYÊN secret cũ**, không phải xoá. Người ta sửa
    `client_id` mà không dán lại secret là chuyện thường; coi "trống" là "xoá" thì mỗi
    lần sửa `client_id` là một lần vô tình gỡ Google khỏi site. Muốn gỡ hẳn thì dùng
    `DELETE` — một hành động có tên.
    """

    client_id: str
    secret: str | None = None


class GanModSubIn(Schema):
    """Body của `POST /admin/subs/{slug}/mods`.

    Nhận `username` chứ không `id`: id của `User` không hiện ở đâu trên giao diện quản
    trị, nên một body mang id là một body không ai dựng lại được bằng tay để thử.
    """

    username: str


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
    tong: int


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


# ===========================================================================
# Bảng điều khiển + ba bảng danh sách (Phase 8, 2026-08-23)
# ===========================================================================


class DemTheoNgayOut(Schema):
    """Một ô của biểu đồ 30 ngày. `ngay` là **ngày lịch Việt Nam**, không phải UTC."""

    ngay: date
    mach_moi: int
    moc_moi: int
    binh_luan_moi: int
    nguoi_dung_moi: int


class TongOut(Schema):
    """Bốn con số lớn của hàng thẻ KPI."""

    nguoi_dung: int
    mach: int
    moc: int
    binh_luan: int
    sub: int


class TrangThaiMachOut(Schema):
    """Bốn nhóm **LOẠI TRỪ NHAU**, cộng lại đúng bằng tổng số mạch.

    Chồng lấn là chuyện có thật trong dữ liệu — một mạch bị ẩn cũng có `status`, một mạch
    bị khoá cũng đang mở hoặc đã đóng. Một biểu đồ vành khuyên vẽ bằng bốn con số chồng
    nhau thì tổng các lát lớn hơn 100%, và không ai nhìn ra điều đó; nó chỉ trông hơi lệch.

    Thứ tự phân loại, xét từ trên xuống, dừng ở nhánh đầu tiên khớp:
    ẩn → khoá → đã đóng sổ → đang mở.
    """

    bi_an: int
    bi_khoa: int
    dong: int
    mo: int


class SubTomTatOut(Schema):
    slug: str
    ten: str
    so_mach: int
    so_mach_30_ngay: int


class ThongKeOut(Schema):
    """Số liệu cho bảng điều khiển. Không cache — xem `Cache-Control` ở endpoint."""

    tong: TongOut
    #: Số báo cáo đang mở. Cũng là con số trên badge chuông của thanh trên.
    cho_xu_ly: int
    hom_nay: DemTheoNgayOut
    bay_ngay: DemTheoNgayOut
    #: **Đúng 30 phần tử**, cũ → mới, kể cả ngày không có gì xảy ra.
    chuoi_ngay: list[DemTheoNgayOut]
    theo_trang_thai: TrangThaiMachOut
    top_sub: list[SubTomTatOut]


#: Bộ lọc của bảng mạch. `tat_ca` gồm **cả mạch đã bị ẩn** — mod phải thấy để phán xử.
#: `chua_go` = mọi bài chưa bị ẩn (khoá + đóng sổ + đang mở); nó CHỒNG LẤN ba nhóm ấy và
#: cố ý không có mặt trên vành khuyên — xem `api/quan_tri_loc.py`.
LocMach = Literal["tat_ca", "chua_go", "mo", "dong", "bi_khoa", "bi_an"]
#: Bộ lọc của bảng bình luận. `hien` = còn sống và chưa bị ẩn.
LocBinhLuan = Literal["tat_ca", "hien", "bi_an", "bia_mo"]
#: Bộ lọc của bảng người dùng. `moi` = 7 ngày gần nhất.
#:
#: ⚠ **`tat_ca` KHÔNG còn nghĩa "tất cả"** kể từ 2026-08-26: nó — cùng `bi_ban` và `moi` —
#: **loại `is_staff`**, vì quản trị viên có màn hình riêng (`/quan-tri-vien`). Cái tên giữ
#: nguyên để không phải sửa mọi chỗ gọi, nên nó là một cái tên nói dối một nửa; dòng này
#: là chỗ duy nhất nói ra sự thật, đừng xoá.
#:
#: `moi_nguoi` = **thật sự mọi tài khoản**, không lọc gì. Nó tồn tại vì ô gợi ý user
#: (`apps/admin/components/o-goi-y-user.tsx`) phải tìm được **cả staff**: đường "gán mod
#: chuyên mục" ở `/subs` cần chọn đúng những người moderate được, mà `ChiMod` đòi
#: `is_staff` ⇒ tập cần nhất chính là tập `tat_ca` vừa lấy đi. Thiếu giá trị này thì ô gợi
#: ý trả rỗng và màn hình nói "Không có tài khoản nào khớp." cho một tài khoản có thật.
LocNguoiDung = Literal["tat_ca", "moi_nguoi", "bi_ban", "staff", "moi"]


class MachDongOut(Schema):
    """Một hàng của bảng mạch trong khu quản trị."""

    id: int
    title: str
    sub_slug: str
    tac_gia: NguoiDungTomTatOut
    status: str
    created_at: datetime
    last_activity_at: datetime
    entry_count: int
    comment_count: int
    diem: int
    da_bi_an: bool
    da_khoa: bool
    duong_dan_cong_khai: str


class TrangMachOut(Schema):
    items: list[MachDongOut]
    cursor_ke_tiep: str | None
    tong: int


class BinhLuanDongOut(Schema):
    """Một hàng của bảng bình luận.

    `trich_yeu` **không bị che** kể cả khi bình luận đã bị ẩn hoặc đã thành bia mộ — cùng
    lý lẽ với `NoiDungBiBaoCaoOut`, và cùng điều kiện an toàn: chỉ ra sau `ChiMod`.
    """

    id: int
    mach_id: int
    mach_title: str
    tac_gia: NguoiDungTomTatOut
    trich_yeu: str
    created_at: datetime
    score: int
    da_bi_an: bool
    da_xoa: bool
    duong_dan_cong_khai: str


class TrangBinhLuanOut(Schema):
    items: list[BinhLuanDongOut]
    cursor_ke_tiep: str | None
    tong: int


class TrangNguoiDungOut(Schema):
    items: list[NguoiDungQuanTriOut]
    cursor_ke_tiep: str | None
    tong: int
    #: Số tài khoản quản trị BỊ LOẠI bởi chính bộ lọc đang áp (kể cả `q`) — 2026-08-26.
    #:
    #: Từ lượt tách khu "Quản trị viên", ba bộ lọc `tat_ca`/`bi_ban`/`moi` loại hẳn
    #: `is_staff=True`. Hệ quả: gõ `mod_gikky` vào ô lọc ra **bảng rỗng**, và một bảng
    #: rỗng không nói được là "không có ai tên vậy" hay "có, nhưng ở trang khác" — người
    #: đọc sẽ kết luận cái thứ nhất. Trường này cho frontend nói ra sự thật.
    #:
    #: Đếm **cùng `q`, cùng `trang_thai`**, chỉ khác điều kiện staff. Luôn `0` khi
    #: `trang_thai == "staff"` (bộ lọc ấy không loại gì cả).
    so_staff_an: int


# --- Lượt xem (`/luot-xem`, 2026-08-27 · mở rộng 2026-08-30) -----------------
#
# Nhóm schema dưới đây là bộ DUY NHẤT trong file này **không** mang nội dung của ai:
# bốn bảng nguồn cố ý không có cột nào gắn được với một con người (xem
# `core/models/luot_xem.py`). Ghi ra vì luật "chỉ trả sau `ChiMod`" ở đầu file được đặt
# ra vì lý do rò rỉ nội dung, và lý do ấy không áp cho nhóm này — nhưng chúng **vẫn** ở
# sau `ChiMod`, đơn giản vì cả `api_admin` ở sau nó.


class LuotXemTongOut(Schema):
    """Sáu con số lớn. `so_luot` = `so_luot_nguoi + so_luot_bot`, không hơn.

    Server trả cả tổng lẫn hai vế thay vì để frontend cộng: ba chỗ trên màn hình (các ô
    KPI, biểu đồ, dòng "% bot") phải nói cùng một chuyện, và cách chắc chắn nhất là
    chúng cùng đọc một phép cộng.

    ⚠ Năm con số đầu đọc theo `?khoang=`; `so_online` thì **không** — nó luôn là 5 phút
    gần nhất. Chúng ở chung một khối vì chúng là chung một hàng ô KPI trên màn hình, chứ
    không phải vì chúng cùng một khoảng.
    """

    so_luot: int
    so_luot_nguoi: int
    so_luot_bot: int
    #: Σ số khách của những ngày **đo được** trong khoảng. Đây là một phép CỘNG THEO NGÀY,
    #: không phải số người: muối băm đổi mỗi ngày, nên một người ghé ba ngày đếm là ba
    #: khách. Trang phải ghi "≈" cạnh con số này — xem `/luot-xem`.
    #:
    #: Ngày không đo được đóng góp **0** vào tổng (chúng vắng mặt), nên con số này là một
    #: cận DƯỚI, không bao giờ là một con số thổi phồng.
    so_khach: int
    #: Khách phân biệt (người, không bot) có lượt xem trong **5 phút gần nhất** — hằng
    #: `quan_tri_luot_xem.py::CUA_SO_ONLINE_PHUT`. KHÔNG đổi theo `?khoang=`.
    #:
    #: Ước lượng, và giới hạn của nó là hệ quả trực tiếp của việc không có session: cùng
    #: một người mở hai trình duyệt đếm là hai, còn người ngồi đọc yên quá 5 phút thì rơi
    #: khỏi con số. Nhãn trên màn hình phải nói ra khoảng 5 phút ấy — nó là ô DUY NHẤT
    #: trong hàng KPI không đọc theo bộ chọn khoảng.
    so_online: int


class LuotXemNgayOut(Schema):
    """Một ô của biểu đồ cột. Ngày KHÔNG có lượt xem nào vẫn có mặt, với hai số 0."""

    ngay: date
    so_luot_nguoi: int
    so_luot_bot: int
    #: `None` = **không đo được**, khác hẳn `0` = "đo được, không có ai".
    #:
    #: `None` xảy ra ở hai ca: ngày trước khi cơ chế khách bật (mọi `LuotXem.khach` rỗng),
    #: và ngày mà hàng thô đã bị dọn trong khi `KhachNgay` không có hàng. Trả 0 cho hai ca
    #: ấy là vẽ ra một ngày vắng tanh cạnh một cột "lượt người" cao ngất — hai con số mâu
    #: thuẫn trên cùng một biểu đồ, và người đọc sẽ tin cái nào bé hơn.
    so_khach: int | None


class TopDuongDanOut(Schema):
    """Một dòng bảng "Xem nhiều nhất". `duong_dan` **không mang query string**."""

    duong_dan: str
    so_luot_nguoi: int
    so_luot_bot: int


class TenBotOut(Schema):
    """Một dòng bảng "Bot nào vào nhiều nhất".

    `ten` là tên CHUẨN HOÁ của `core/bot.py`, hoặc `"khác"` — không phải User-Agent thô.
    UA thô không được lưu ở bất kỳ đâu.
    """

    ten: str
    so_luot: int
    #: Khoá nhóm (`core/bot.py::nhom_bot`) — suy **lúc đọc**, không lưu thành cột. Nên
    #: hàng ghi từ 2026-08-27 cũng có nhóm, và sửa bảng nhóm là số liệu cũ tự phân loại
    #: lại. Một cột `nhom_bot` trong DB sẽ là bản sao đông cứng, lệch ngay lần sửa đầu.
    nhom: str


class NhomBotOut(Schema):
    """Một dòng bảng "Bot theo nhóm". Sáu khoá của `core/bot.py::NHOM_HOP_LE`."""

    nhom: str
    so_luot: int


class NguonOut(Schema):
    """Một dòng bảng "Nguồn truy cập". `nguon` là **tên miền**, không bao giờ là URL.

    Chỉ hàng NGƯỜI, và chỉ `nguon != ""`. Phần rỗng (trực tiếp / nội bộ / rác) đi vào
    `LuotXemOut.so_truc_tiep` — gộp chung vào bảng thì nó chiếm dòng đầu ở mọi site và
    đẩy hết nguồn thật xuống dưới.
    """

    nguon: str
    so_luot: int


class MucSoLuotOut(Schema):
    """Một dòng của hai bảng nhỏ "Trình duyệt" và "Thiết bị".

    `ten` là **khoá ascii** (`chrome`, `di_dong`, …), không phải nhãn hiển thị: nhãn tiếng
    Việt do frontend map. Trả nhãn từ server là khoá dữ liệu và chữ trên màn hình dính vào
    nhau — đổi một chữ hoa thành một breaking change của API.
    """

    ten: str
    so_luot: int


class LuotXemOut(Schema):
    """Toàn bộ số liệu của trang `/luot-xem` cho MỘT khoảng."""

    #: Chính giá trị `?khoang=` đã dùng — để màn hình không vẽ số của khoảng này dưới
    #: nhãn của khoảng kia khi hai request về không đúng thứ tự người bấm.
    khoang: str
    tong: LuotXemTongOut
    chuoi_ngay: list[LuotXemNgayOut]
    top_duong_dan: list[TopDuongDanOut]
    top_bot: list[TenBotOut]
    #: Gộp `top_bot` theo nhóm — nhưng từ **toàn bộ** hàng bot, không phải từ 20 dòng của
    #: `top_bot`. Cộng từ bảng top là thiếu hụt im lặng đúng bằng phần đuôi bị cắt.
    theo_nhom_bot: list[NhomBotOut]
    #: Top 20 tên miền dẫn người tới site. Chỉ hàng NGƯỜI: nguồn của một con bot là thứ
    #: chính nó khai, và trộn nó vào đây là để một con crawler khai referer giả leo lên
    #: đầu bảng "ai đang dẫn người tới".
    top_nguon: list[NguonOut]
    #: Lượt NGƯỜI không có nguồn ngoài — trực tiếp / nội bộ / referer rác, gộp làm một.
    so_truc_tiep: int
    trinh_duyet: list[MucSoLuotOut]
    thiet_bi: list[MucSoLuotOut]
    #: `True` khi **các bảng chi tiết** hẹp hơn khoảng đang xem — luôn đúng với
    #: `khoang=tat_ca`, luôn sai với `7/30/90`.
    #:
    #: Năm khối chịu giới hạn này: `top_bot`, `theo_nhom_bot`, `top_nguon` + `so_truc_tiep`,
    #: `trinh_duyet`, `thiet_bi` — tất cả chỉ dựng được từ hàng thô (90 ngày), vì `TongNgay`
    #: cố ý không mang các chiều ấy. Màn hình **phải nói ra**; giấu đi là để mod đọc chúng
    #: như thể chúng phủ toàn thời gian.
    #:
    #: ⚠ Tên cũ là `bot_chi_90_ngay` (2026-08-27), đổi 2026-08-30 khi giới hạn phủ thêm
    #: bốn khối nữa — một cái tên nói "bot" cho một cờ điều khiển năm dòng chú là cái tên
    #: sẽ bị hiểu sai đúng bốn lần.
    chi_tiet_chi_90_ngay: bool
