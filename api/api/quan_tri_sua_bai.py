"""Sửa NỘI DUNG từ khu quản trị: tiêu đề mạch, 5 trường của mốc, ảnh của mốc.

Chốt 2026-09-03 (`plans/2026-09-03-sua-bai-khu-quan-tri.md`). User: *"làm thêm phần sửa
cho post, sửa tất cả các mốc của bài viết … lưu audit phần sửa"*, và sau đó *"vì front sử
dụng tiptap để post bài, nên admin cũng cần tiptap để sửa, cho phép upload media như
front"*.

## Vì sao ở ĐÂY chứ không ở `/api/v1/mod/*`

`api/mod.py` mở đúng BỐN cửa và docstring của nó ghi *"mở thêm bất kỳ cái nào là phải hỏi
lại user"*. Đã hỏi; user chốt khu quản trị. `PATCH /api/v1/mocs/{id}` vì thế **vẫn chỉ
tác giả** (`api/quyen.py::doi_chu_so_huu` cố ý không có nhánh staff), và
`tests/test_api_quan_tri_sua_bai.py::test_B11_…` ghim lại rằng lượt này không nới v1.

## Ba luật của file, đọc trước khi thêm endpoint thứ bảy

1. **Ghi thì chỉ superuser** (`chan_neu_khong_phai_superuser`). Ẩn là *gỡ* — đảo ngược
   được, chữ của người viết còn nguyên; sửa là *viết lại*. Hai việc không cùng một nấc
   quyền. Cửa ĐỌC (`GET /mocs/{id}`) thì mọi mod, như trang chi tiết mạch.
2. **Handler làm đúng ba việc**: tra hàng, gọi xuống đường ghi, dựng response — cùng luật
   với `quan_tri_kiem_duyet.py`. Không luật domain nào sống ở đây, kể cả phép "có đổi gì
   không" (nó ở `core/ghi.py::sua_moc_boi_mod`, vì nó phải so SAU `lam_sach`).
3. **404 cho id lạ, KHÔNG 404 cho thứ đã bị ẩn.** Ngược lý lẽ của API công khai, và đó là
   lý lẽ của cả khu này: mod phải với được nội dung vừa bị ẩn. Mạch bị ẩn ⇒ vẫn sửa được;
   mốc bia mộ / bị ẩn ⇒ 409 `noi_dung_da_go` (gỡ ẩn trước); mạch bị **khoá** ⇒ 403
   `mach_bi_khoa` (khoá là đóng băng — mở khoá ở ngay trang chi tiết).

## Ảnh: cùng đường ghi với v1, khác đúng hai chỗ

Ba cửa ảnh dưới đây đi qua **đúng** bảy phép kiểm (`core/anh.py` + `core/ghi.py`), đúng
kho (`core/anh_luu.py`), đúng hai bảng whitelist mà `don_anh_mo_coi` đọc. Khác v1:

- **không hạn mức 30 ảnh/ngày** cho ảnh nội dung. Hạn mức ấy tồn tại vì `POST /me/anh` là
  cửa duy nhất của API nhận file mà không gắn với hàng nào để đếm, và nó mở cho *mọi* tài
  khoản đăng nhập. Cửa này superuser-only, nên lý do đó không còn;
- **thêm/gỡ ảnh đính kèm ghi `AuditLog`** (`them_anh_moc`/`xoa_anh_moc` nhận `boi`). Tải
  ảnh *nội dung* thì không: tấm ảnh chưa đổi bài nào — lượt `PATCH` nhúng nó vào `body`
  mới là thay đổi, và lượt ấy đã có `MocRevision` + log.
"""

from django.core.exceptions import ValidationError as LoiModel
from django.db import transaction
from django.http import HttpResponse
from ninja import File, Router, Status
from ninja.files import UploadedFile

from core.anh_luu import url_anh
from core.anh_noi_dung import luu_anh_noi_dung
from core.doc_noi_dung import doc_duoc
from core.ghi import (
    SO_ANH_TOI_DA_MOI_MOC,
    QuaNhieuAnh,
    sua_moc_boi_mod,
    sua_tieu_de_mach,
    them_anh_moc,
    xoa_anh_moc,
)
from core.models.dien_dan import Mach
from core.models.moc import Moc, MocAnh
from core.revalidate import lam_moi_mach, lam_moi_mach_slug

from api.anh import QUA_NHIEU_ANH
from api.anh_chung import doi_khong_qua_nang, xu_ly_hoac_loi_http
from api.ghi_chung import kiem_occurred_at
from api.loi import LoiOut, khong_tim_thay, loi
from api.quan_tri_kiem_duyet import duong_dan_mach
from api.quan_tri_quyen import chan_neu_khong_phai_superuser
from api.quan_tri_schemas import (
    KetQuaSuaMocOut,
    KetQuaSuaTieuDeOut,
    MocSuaQuanTriOut,
    SuaMocQuanTriIn,
    SuaTieuDeMachIn,
)
from api.quyen import DU_LIEU_KHONG_HOP_LE, MACH_BI_KHOA, NOI_DUNG_DA_GO, LoiGhi
from api.schemas import AnhNoiDungOut, AnhOut
from api.trinh_bay import anh_ra, nguoi_dung_ra

router = Router()

#: Câu `viec` cho `chan_neu_khong_phai_superuser` — một chuỗi cho cả file: mọi cửa GHI ở
#: đây từ chối vì CÙNG một lý do, và ba câu khác nhau chỉ làm mod tưởng là ba luật.
VIEC_SUA_NOI_DUNG = "sửa nội dung bài"

TRA_LOI_SUA = {
    200: KetQuaSuaMocOut,
    400: LoiOut,
    401: LoiOut,
    403: LoiOut,
    404: LoiOut,
    409: LoiOut,
}


def _nap_moc_quan_tri(moc_id: int) -> Moc | None:
    """Mốc theo `id`, **không lọc gì cả** — kể cả mạch đang bị ẩn (luật 3 của file).

    Không dùng `api/ghi_chung.py::nap_moc`: bản ấy lọc `mach__hidden_at__isnull=True`
    đúng như cửa công khai phải làm, và mượn nó về đây là biến "mod ẩn cả mạch" thành
    "không ai sửa được mạch đó nữa", kể cả để dọn dẹp rồi gỡ ẩn.
    """
    return (
        Moc.objects.filter(pk=moc_id)
        .select_related("mach", "author")
        .first()
    )


def _sua_duoc(moc: Moc) -> bool:
    """Nội dung này còn sửa được không — **một chỗ, dùng cho cả hai cửa**.

    `doc_duoc` chứ không `deleted_at is None and hidden_at is None`: luật che sống ở
    `core/doc_noi_dung.py` và bản chép thứ hai sẽ quên trạng thái mà Phase sau thêm vào.
    Cộng `locked_at` của mạch, vì khoá là đóng băng cả mạch chứ không riêng một mốc.
    """
    return doc_duoc(moc) and moc.mach.locked_at is None


def _tu_choi_theo_trang_thai(moc: Moc):
    """Response 403/409 nếu mốc này không sửa được; `None` nếu sửa được.

    Hai mã, hai việc phải làm khác nhau — nên chúng **không** được gộp: 403
    `mach_bi_khoa` ⇒ mở khoá ở trang chi tiết; 409 `noi_dung_da_go` ⇒ gỡ ẩn (hoặc chịu,
    nếu là bia mộ của tác giả). Một mã chung là một câu "không được" không nói được bấm gì.
    """
    if moc.mach.locked_at is not None:
        return loi(403, MACH_BI_KHOA, "Mạch này đang bị khoá — mở khoá rồi sửa.")
    if not doc_duoc(moc):
        return loi(
            409,
            NOI_DUNG_DA_GO,
            "Mốc này đang bị ẩn hoặc đã bị tác giả xoá — gỡ ẩn trước khi sửa.",
        )
    return None


def _moc_sua_ra(moc: Moc) -> MocSuaQuanTriOut:
    """`Moc` → schema của form sửa. **`body` không che** — xem docstring `MocSuaQuanTriOut`.

    Cố ý không gọi `api/trinh_bay.py::moc_ra` (luật che của cửa công khai) và cũng không
    gọi `quan_tri_kiem_duyet.py::_moc_ra` (chỉ có `trich_yeu`, cắt 200 ký tự — prefill một
    form sửa bằng bản cắt là mất phần đuôi ngay lượt Lưu đầu tiên).
    """
    return MocSuaQuanTriOut(
        id=moc.pk,
        seq=moc.seq,
        mach_id=moc.mach_id,
        mach_title=moc.mach.title,
        mach_da_khoa=moc.mach.locked_at is not None,
        tac_gia=nguoi_dung_ra(moc.author),
        occurred_at=moc.occurred_at,
        created_at=moc.created_at,
        loai=moc.loai,
        body=moc.body,
        body_dinh_dang=moc.body_dinh_dang,
        question_for_crowd=moc.question_for_crowd,
        figures=moc.figures,
        edit_count=moc.edit_count,
        edited_at=moc.edited_at,
        da_bi_an=moc.hidden_at is not None,
        da_xoa=moc.deleted_at is not None,
        sua_duoc=_sua_duoc(moc),
        duong_dan_cong_khai=duong_dan_mach(moc.mach),
        anhs=[anh_ra(a) for a in moc.anhs.order_by("position", "id")],
        tran_anh_moi_moc=SO_ANH_TOI_DA_MOI_MOC,
    )


@router.get(
    "/mocs/{int:moc_id}",
    response={200: MocSuaQuanTriOut, 401: LoiOut, 403: LoiOut, 404: LoiOut},
    operation_id="quan_tri_xem_moc",
    tags=["quan-tri-sua-bai"],
)
def xem_moc(request, moc_id: int):
    """Một mốc mở ra để đọc/sửa — **mọi mod**, kể cả mốc đã bị ẩn hoặc là bia mộ.

    Cửa ĐỌC nên nó không đòi superuser: mod thường vẫn phải đọc được nguyên văn thứ họ
    sắp quyết định ẩn hay gỡ ẩn, đúng như trang chi tiết mạch đã cho họ đọc `trich_yeu`.
    Quyền GHI là chuyện của hai endpoint dưới, và frontend giấu nút Lưu theo
    `ModOut.is_superuser`.

    `sua_duoc` trả về **trạng thái nội dung**, không phải quyền của người xem — hai câu
    "mốc này đã bị gỡ" và "bạn không đủ quyền" dẫn tới hai hành động khác nhau.
    """
    moc = _nap_moc_quan_tri(moc_id)
    if moc is None:
        return khong_tim_thay("mốc")
    return _moc_sua_ra(moc)


@router.patch(
    "/mocs/{int:moc_id}",
    response=TRA_LOI_SUA,
    operation_id="quan_tri_sua_moc",
    tags=["quan-tri-sua-bai"],
)
def sua_moc_quan_tri(request, moc_id: int, du_lieu: SuaMocQuanTriIn):
    """Superuser sửa **đúng 5 trường** của một mốc (PLAN 5.2). Luôn để vết khi có đổi.

    PATCH thật: trường không gửi thì không đổi, trường gửi `null` thì xoá (`body` không
    nhận `null` — `core/ghi.py::_kiem_thay_doi_moc` chặn và trả 400, **không** phải schema;
    xem docstring `MocSuaIn`). `ly_do` không phải trường của mốc; nó đi vào
    `AuditLog.meta`.

    **Mỗi lượt có đổi để lại BA thứ trong một transaction**: một `MocRevision` mang đủ 5
    trường bản trước (xem được công khai ở `GET /mocs/{id}/revisions`), nhãn "đã sửa N
    lần" trên trang mạch, và một dòng nhật ký `sua_moc`. Không có cửa sổ im lặng 15 phút
    ở đây — cửa sổ ấy dành cho tác giả sửa chính tả bài mình, không cho người thứ ba viết
    lại lời người khác.

    Gửi lên đúng thứ đang có ⇒ 200 `da_doi=false`, và **không** revision, **không** log:
    một cú bấm Lưu chẳng đổi gì không được đóng dấu "đã sửa" lên bài của người ta.
    """
    if (chan := chan_neu_khong_phai_superuser(request, VIEC_SUA_NOI_DUNG)) is not None:
        return chan
    moc = _nap_moc_quan_tri(moc_id)
    if moc is None:
        return khong_tim_thay("mốc")
    if (tu_choi := _tu_choi_theo_trang_thai(moc)) is not None:
        return tu_choi

    thay_doi = du_lieu.model_dump(exclude_unset=True)
    ly_do = thay_doi.pop("ly_do", "")
    if not thay_doi:
        return loi(400, DU_LIEU_KHONG_HOP_LE, "Không có trường nào để sửa.")
    if "occurred_at" in thay_doi:
        if thay_doi["occurred_at"] is None:
            return loi(400, DU_LIEU_KHONG_HOP_LE, "occurred_at không được để trống.")
        try:
            kiem_occurred_at(thay_doi["occurred_at"])
        except LoiGhi as e:
            # `api_admin` có exception handler cho `LoiGhi` (xem `api/quan_tri.py`), nên
            # bắt ở đây là thừa về mặt hình dạng response — nhưng nó giữ endpoint này
            # đọc được như mọi handler quản trị khác: mọi đường lỗi đều là một `return`.
            return loi(e.status_code, e.code, str(e))
    if "figures" in thay_doi and thay_doi["figures"] is not None:
        # `model_dump` đã biến `FigureIn` thành dict — đúng hình dạng `kiem_figures` đòi.
        thay_doi["figures"] = [
            {"label": f["label"], "value": f["value"]} for f in thay_doi["figures"]
        ]

    try:
        moc, da_doi = sua_moc_boi_mod(
            moc=moc, thay_doi=thay_doi, boi=request.user, ly_do=ly_do
        )
    except LoiModel as e:
        return loi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages))

    if da_doi:
        # Không đổi ⇒ không gọi: một request làm mới cache cho một trang không đổi gì là
        # một request thừa, và nó làm bài đo "không đổi ⇒ 0 lượt xếp hàng" nói dối.
        lam_moi_mach(moc.mach)
    return KetQuaSuaMocOut(da_doi=da_doi, moc=_moc_sua_ra(moc))


# ⚠ **Đường là `/machs/{id}/tieu-de`, KHÔNG phải `PATCH /machs/{id}`** — và đừng "sửa lại
# cho RESTful". `GET /machs/{id}` (trang chi tiết) nằm ở router KHÁC
# (`quan_tri_kiem_duyet.py`); django-ninja sinh urlpattern theo TỪNG router và Django
# resolver lấy pattern khớp ĐẦU TIÊN, nên `PATCH /machs/{id}` rơi vào router kia — nơi chỉ
# có GET — và trả **405**. Cùng cái bẫy đã ghi ở `quan_tri_nguoi_dung.py` cho
# `POST /nguoi-dung`. Đổi thứ tự `add_router` không cứu được: nó chỉ đảo chiều lỗi sang
# `GET /machs/{id}`.
@router.patch(
    "/machs/{int:mach_id}/tieu-de",
    response={
        200: KetQuaSuaTieuDeOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
    },
    operation_id="quan_tri_sua_tieu_de_mach",
    tags=["quan-tri-sua-bai"],
)
def sua_tieu_de_mach_quan_tri(request, mach_id: int, du_lieu: SuaTieuDeMachIn):
    """Superuser đổi **tiêu đề** một mạch. Đổi tiêu đề ⇒ đổi slug ⇒ hai đường cache.

    Không có cửa nào khác đổi được `Mach.title`, kể cả cho tác giả — chưa có
    `MachRevision` nên tác giả sửa tiêu đề sẽ là sửa một lời gọi đã đăng mà không để vết.
    Ở đây vết nằm ở `AuditLog` (`tieu_de_cu`/`tieu_de_moi`/`slug_cu`/`slug_moi`).

    ⚠ **Làm mới ISR CẢ đường cũ lẫn đường mới.** Trang đọc theo `id` nên `/m/<slug-cũ>-<id>`
    vẫn phục vụ 200 (PLAN 5.9 cho nó 308 về dạng chuẩn, nhưng bản đã cache thì không chạy
    lại luật ấy). Bỏ vế cũ là tiêu đề cũ sống thêm tới một giờ ở một URL người ta đã chia
    sẻ đi khắp nơi — HTTP 200, không log, không ai thấy.

    Mạch bị khoá ⇒ 403 (đóng băng). Mạch bị **ẩn** thì vẫn đổi được — khu này với được
    nội dung đã ẩn, đó là cả lý do nó tồn tại.
    """
    if (chan := chan_neu_khong_phai_superuser(request, VIEC_SUA_NOI_DUNG)) is not None:
        return chan
    mach = Mach.objects.filter(pk=mach_id).first()
    if mach is None:
        return khong_tim_thay("mạch")
    if mach.locked_at is not None:
        return loi(403, MACH_BI_KHOA, "Mạch này đang bị khoá — mở khoá rồi sửa.")
    if not du_lieu.title.strip():
        # `min_length=1` của pydantic đo chuỗi THÔ, còn đường ghi `strip()` trước khi so.
        # Thiếu dòng này thì `"   "` lưu được và trang mạch mang một tiêu đề rỗng.
        return loi(400, DU_LIEU_KHONG_HOP_LE, "Tiêu đề không được để trống.")

    mach, da_doi, slug_cu = sua_tieu_de_mach(
        mach=mach, title=du_lieu.title, boi=request.user, ly_do=du_lieu.ly_do
    )
    if da_doi:
        lam_moi_mach_slug(mach.pk, slug_cu)
        lam_moi_mach(mach)
    return KetQuaSuaTieuDeOut(
        da_doi=da_doi,
        title=mach.title,
        slug=mach.slug,
        duong_dan_cong_khai=duong_dan_mach(mach),
    )


# =============================================================================
# ẢNH — ba cửa, superuser-only (user lật mục "không sửa ảnh" 2026-09-03)
# =============================================================================


@router.post(
    "/anh",
    response={201: AnhNoiDungOut, 400: LoiOut, 401: LoiOut, 403: LoiOut, 413: LoiOut},
    operation_id="quan_tri_tai_anh_noi_dung",
    tags=["quan-tri-sua-bai"],
)
def tai_anh_noi_dung_quan_tri(
    request, response: HttpResponse, file: UploadedFile = File(...)
):
    """Tải MỘT ảnh để nhúng vào thân mốc (multipart). Trả `{url, width, height}`.

    Song sinh của `POST /api/v1/me/anh`, khác đúng hai chỗ và cả hai có lý do:

    - **superuser-only** thay vì mọi tài khoản đăng nhập;
    - **không hạn mức 30 ảnh/ngày**. Hạn mức ấy tồn tại vì cửa v1 mở cho mọi người và
      không gắn với hàng nào để đếm, tức nó là một kho file miễn phí nếu bỏ trần. Cửa này
      chỉ superuser vào được, nên trần ngày chỉ còn là một cái bẫy cho chính người đang
      sửa 20 bài trong một buổi tối.

    Hàng vẫn là `AnhNoiDung` với `nguoi_tai` = superuser, tức nó vẫn nằm trong whitelist
    mà `don_anh_mo_coi` đọc — không có loài ảnh thứ ba nào sinh ra ở đây.

    `url` phải giữ nguyên tiền tố `/media/` tới lúc lưu `body`: `core/lam_sach_html.py`
    **gỡ cả thẻ** `img` nào có `src` trỏ ra ngoài kho của site.

    `Cache-Control: no-store` — cùng lý do cửa v1: response nói về tài sản của một phiên.
    """
    response["Cache-Control"] = "no-store"
    if (chan := chan_neu_khong_phai_superuser(request, VIEC_SUA_NOI_DUNG)) is not None:
        return chan

    doi_khong_qua_nang(file)
    anh = xu_ly_hoac_loi_http(file.read())
    hang = luu_anh_noi_dung(user=request.user, anh=anh)
    return Status(
        201,
        AnhNoiDungOut(url=url_anh(hang.khoa_luu_tru), width=hang.w, height=hang.h),
    )


@router.post(
    "/mocs/{int:moc_id}/anh",
    response={
        201: AnhOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
        409: LoiOut,
        413: LoiOut,
    },
    operation_id="quan_tri_tai_anh_moc",
    tags=["quan-tri-sua-bai"],
)
def tai_anh_moc_quan_tri(request, moc_id: int, file: UploadedFile = File(...)):
    """Superuser gắn MỘT ảnh vào gallery của một mốc. Ghi `AuditLog` `them_anh_moc`.

    Cùng bảy phép kiểm và cùng trần `SO_ANH_TOI_DA_MOI_MOC` với cửa v1 — trần đếm TRONG
    khoá hàng `Moc` ở `core/ghi.py`, không ở đây (L11).

    Ba ca từ chối giống hệt hai cửa sửa chữ ở trên: mạch khoá ⇒ 403, mốc bia mộ / bị ẩn ⇒
    409, mạch bị ẩn ⇒ **vẫn được**. Đủ ảnh ⇒ 409 `qua_nhieu_anh`.

    Khác v1: truyền `boi=request.user` xuống `them_anh_moc` ⇒ một dòng nhật ký trong cùng
    transaction. Gắn ảnh vào bài NGƯỜI KHÁC là đổi nội dung của họ, và ảnh không có
    `MocRevision` nào để kể lại chuyện đó.
    """
    if (chan := chan_neu_khong_phai_superuser(request, VIEC_SUA_NOI_DUNG)) is not None:
        return chan
    moc = _nap_moc_quan_tri(moc_id)
    if moc is None:
        return khong_tim_thay("mốc")
    if (tu_choi := _tu_choi_theo_trang_thai(moc)) is not None:
        return tu_choi

    doi_khong_qua_nang(file)
    # Tái mã hoá NGOÀI khoá — xem `core/ghi.py::them_anh_moc`.
    anh = xu_ly_hoac_loi_http(file.read())
    try:
        hang = them_anh_moc(moc=moc, anh=anh, boi=request.user)
    except QuaNhieuAnh:
        return loi(
            409,
            QUA_NHIEU_ANH,
            f"Mốc {moc.seq} đã đủ {SO_ANH_TOI_DA_MOI_MOC} ảnh — gỡ bớt rồi thêm.",
        )
    lam_moi_mach(moc.mach)
    return Status(201, anh_ra(hang))


@router.delete(
    "/anh/{int:anh_id}",
    response={200: AnhOut, 401: LoiOut, 403: LoiOut, 404: LoiOut},
    operation_id="quan_tri_xoa_anh_moc",
    tags=["quan-tri-sua-bai"],
)
def xoa_anh_moc_quan_tri(request, anh_id: int):
    """Superuser gỡ một ảnh khỏi mốc — **hàng đi, file đi** (A8). Ghi `AuditLog`.

    Khác cửa v1 ở hai chỗ, cả hai theo luật 3 của file:

    - **không lọc `moc__mach__hidden_at`** — ảnh của một mạch đang bị ẩn vẫn phải gỡ được
      (đó thường là chính lúc cần gỡ nhất);
    - không hỏi `doi_con_song` — gỡ ảnh khỏi một bia mộ là giải phóng đĩa, và ảnh ấy đã
      không hiện ở đâu nữa nên không có gì để bảo vệ.

    Mạch bị **khoá** thì vẫn 403: khoá là đóng băng, không phải "chỉ chặn người ngoài".

    Trả chính thẻ ảnh vừa xoá chứ không 204 — UI cần `id` để gỡ đúng ô khỏi lưới.
    """
    if (chan := chan_neu_khong_phai_superuser(request, VIEC_SUA_NOI_DUNG)) is not None:
        return chan
    anh = (
        MocAnh.objects.filter(pk=anh_id).select_related("moc", "moc__mach").first()
    )
    if anh is None:
        return khong_tim_thay("ảnh")
    if anh.moc.mach.locked_at is not None:
        return loi(403, MACH_BI_KHOA, "Mạch này đang bị khoá — mở khoá rồi sửa.")

    ra = anh_ra(anh)
    with transaction.atomic():
        xoa_anh_moc(anh=anh, boi=request.user)
        lam_moi_mach(anh.moc.mach)
    return ra
