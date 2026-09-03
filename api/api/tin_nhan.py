"""Nhắn tin riêng 1-1 — năm cửa dưới `/me/tin-nhan…` (`plans/2026-09-03-nhan-tin-rieng.md`).

## Luật xuyên suốt cả file: `request.user` nằm trong MỌI truy vấn

Không cửa nào ở đây nhận một `hoi_thoai_id` từ client. Người kia được chỉ bằng
**username**, và hội thoại luôn được tra bằng *cặp (tôi, người ấy)* — nên một id của
người khác đơn giản không nằm trong queryset nào, và không có phép kiểm chủ sở hữu nào
để quên. Cùng lối `api/thong_bao.py`, và ở đây nó nặng hơn hẳn: rò một hội thoại là rò
nội dung riêng tư giữa hai người.

Tiền tố `/me/` nói đúng chuyện đó ra ở tầng URL: mọi thứ dưới nó là dữ liệu của chính
người đang gọi.

## Vì sao khách nhận 401 ở cả năm cửa, kể cả cửa đọc

Cùng lý lẽ chuông (`api/thong_bao.py`): chúng chỉ được gọi khi client đã biết có người
đăng nhập. Khác `GET /me` và `GET /machs/{id}/me` — hai cửa chạy trên mọi lượt tải trang
kể cả của bot, nên với chúng "chưa đăng nhập" là trạng thái bình thường nhất.

## Không có cửa nào cho mod / quản trị

Tin nhắn là riêng tư. Mở một cửa đọc cho mod là một quyết định sản phẩm phải hỏi user,
không phải hệ quả tình cờ của việc viết thêm một endpoint — plan §1 xếp nó vào "KHÔNG
LÀM" và ghi sổ.

## `Cache-Control: no-store` — phạm vi THẬT, đừng đọc mạnh hơn

Cả năm handler đặt header ấy trên **response THÀNH CÔNG** (200/201). Response LỖI thì
không có: 404/400/429 đi ra qua `raise LoiGhi` → exception handler chung của `api_v1`
(`api/quyen.py::dang_ky_xu_ly_loi_ghi`), và handler ấy dựng một `HttpResponse` mới, không
thấy object mà endpoint vừa gán header lên.

Chấp nhận được, và đây là lý do chứ không phải lời bào chữa: thân một lời từ chối chỉ có
`{detail, code}` — không mang tên ai, không mang một chữ nào của tin nhắn. Cái phải giữ
khỏi cache là **nội dung**, và nội dung chỉ đi ra ở nhánh thành công. Sửa cho triệt để
phải đụng exception handler dùng chung của cả `api_v1`, tức đổi hành vi của mọi cửa khác
— việc riêng, không gộp vào lượt này.
"""

from django.core.exceptions import ValidationError as LoiModel
from django.db import transaction
from django.db.models import Q
from django.http import HttpResponse
from ninja import Router, Status

from core.han_muc import (
    dem_tin_nhan_trong_gio,
    luc_tin_nhan_duoc_lai,
    tran_tin_nhan_moi_gio,
)
from core.models.nguoi_dung import User
from core.models.tin_nhan import HoiThoai, TinNhan
from core.thong_bao import bao_tin_nhan, doc_thong_bao_tin_nhan
from core.tin_nhan import (
    danh_dau_da_doc,
    dem_chua_doc,
    dem_chua_doc_theo_hoi_thoai,
    gui_tin,
    lay_hoi_thoai,
)

from api.loi import KHONG_TIM_THAY, LoiOut, LoiThoiGianOut, loi_thoi_gian
from api.phan_trang import cat_trang, kiem_gioi_han
from api.quyen import DU_LIEU_KHONG_HOP_LE, QUA_HAN_MUC_TIN_NHAN, LoiGhi, dang_nhap
from api.schemas import (
    HoiThoaiChiTietOut,
    HoiThoaiOut,
    HopThuOut,
    SoChuaDocOut,
    TinNhanOut,
)
from api.schemas_ghi import TinNhanIn
from api.trinh_bay import nguoi_dung_ra

router = Router()

#: Trần số hội thoại `GET /me/tin-nhan` trả về. **Chưa phân trang** — hộp thư là danh sách
#: để quản lý, và 100 cuộc trò chuyện là đã rất nhiều. Trần phải tồn tại dù vậy: thiếu nó
#: thì một tài khoản bị spam mở 50.000 hội thoại biến mỗi lượt mở hộp thư thành một câu
#: SQL không có `LIMIT`. Ngày tập này dài ra thật thì nó phải đổi cùng `GET /me/subs` và
#: `GET /me/dang-theo-user` — cùng một lý do, cùng một lúc.
TOI_DA_HOI_THOAI = 100

#: Số tin mỗi trang của một cuộc trò chuyện khi client không nói gì.
SO_TIN_MAC_DINH = 30


def _nap_nguoi_kia(request, username: str, *, de_ghi: bool) -> User:
    """Người ở đầu kia, hoặc **ném** 404 / 400. Ba nhánh, và chúng cố ý KHÁC nhau.

    ⚠ `raise LoiGhi`, không `return khong_tim_thay(...)` — cùng cái bẫy đã cắn ở
    `api/theo_sub.py`: hàm kia chỉ *trả về* một tuple mà chỗ gọi phải `return`, nên gọi nó
    trong một hàm phụ là vứt giá trị đi rồi chạy tiếp như không có gì.

    ## Ranh giới là VIỆC (`de_ghi`), không phải cửa

    1. **`de_ghi=True` — `POST /me/tin-nhan/{username}`**: đòi `is_active=True`, người vô
       hiệu ⇒ 404. Không ai gửi được vào hộp thư của một tài khoản đã bị vô hiệu hoá.
    2. **`de_ghi=False` + ĐÃ có hội thoại** — `GET` và `POST …/doc`: nạp được cả người đã
       vô hiệu. Đây là bản vá một chỗ **kẹt vĩnh viễn**: cấm cả hai cửa đọc thì một người
       nhận 3 tin rồi người gửi bị vô hiệu sẽ thấy `so_chua_doc = 3` mãi mãi — hộp thư vẫn
       liệt kê dòng ấy, mà `GET` lẫn `POST …/doc` đều 404 nên `da_doc_den_*` không bao giờ
       tiến được. Đúng loài "banner kẹt vĩnh viễn" của đợt 2026-08-04.
    3. **`de_ghi=False` + CHƯA có hội thoại**: vẫn 404. Nếu không, cửa này thành cửa dò —
       hỏi một username bất kỳ là biết được tài khoản ấy có thật và vừa bị vô hiệu hoá.

    Nhánh 1 và 3 dùng **cùng mã** `khong_tim_thay` với username không tồn tại, cùng lý lẽ
    `api/loi.py::KHONG_TIM_THAY`: tách mã ra là kể cho người lạ nghe thứ họ không được biết.

    **Tự nhắn mình là 400, không phải 404** ở CẢ HAI nhánh: người ấy có thật, việc kia mới
    là việc không làm được. Trả 404 ở đây là nói dối về sự tồn tại của chính người đang gọi.
    """
    u = User.objects.filter(username=username).first()
    if u is None or (de_ghi and not u.is_active):
        raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy người dùng {username!r}.")
    if u.pk == request.user.pk:
        raise LoiGhi(
            400, DU_LIEU_KHONG_HOP_LE, "Bạn không thể nhắn tin cho chính mình."
        )
    # Chỉ hỏi DB thêm một câu ở đúng nhánh hiếm (người đã vô hiệu) — đường thường không
    # trả giá gì cho phép kiểm này.
    if not u.is_active and lay_hoi_thoai(request.user, u) is None:
        raise LoiGhi(404, KHONG_TIM_THAY, f"Không tìm thấy người dùng {username!r}.")
    return u


def _tin_ra(tin: TinNhan, *, nguoi_goi_id: int) -> TinNhanOut:
    return TinNhanOut(
        id=tin.pk,
        body=tin.body,
        created_at=tin.created_at,
        cua_toi=tin.nguoi_gui_id == nguoi_goi_id,
    )


@router.get(
    "/me/tin-nhan",
    response={200: HopThuOut, 401: LoiOut},
    operation_id="liet_ke_hoi_thoai",
    tags=["tin-nhan"],
    auth=dang_nhap,
)
def liet_ke_hoi_thoai(request, response: HttpResponse):
    """Hộp thư: mọi cuộc trò chuyện của tôi, **mới nhất trước**. Per-user, cấm cache.

    Trả tối đa 100 hội thoại và **chưa có phân trang** — hộp thư là danh sách để quản lý,
    không phải một feed. Mỗi dòng kèm tin cuối và số tin chưa đọc của riêng tôi.
    """
    response["Cache-Control"] = "no-store"
    toi = request.user

    hoi_thoais = list(
        HoiThoai.objects.filter(Q(nguoi_a=toi) | Q(nguoi_b=toi))
        .select_related("nguoi_a", "nguoi_b")
        .order_by("-cap_nhat_luc", "-pk")[:TOI_DA_HOI_THOAI]
    )
    ids = [h.pk for h in hoi_thoais]

    # `DISTINCT ON (hoi_thoai_id) … ORDER BY hoi_thoai_id, -id` — tin cuối của CẢ LÔ trong
    # MỘT truy vấn. Vòng `for` gọi `.first()` cho từng hội thoại cũng ra đúng kết quả và
    # là đúng thứ `django_assert_num_queries` của bài đo A8 sinh ra để chặn: số truy vấn
    # phải HẰNG theo số hội thoại. `DISTINCT ON` là Postgres-only — repo đã chốt Postgres
    # 17 (PLAN mục 6) và đã dùng `GeneratedField` + partial unique, nên không phải một
    # cam kết mới.
    tin_cuoi = {
        t.hoi_thoai_id: t
        for t in TinNhan.objects.filter(hoi_thoai_id__in=ids)
        .order_by("hoi_thoai_id", "-id")
        .distinct("hoi_thoai_id")
    }
    chua_doc = dem_chua_doc_theo_hoi_thoai(toi, ids)

    items = []
    for h in hoi_thoais:
        kia = h.nguoi_b if h.nguoi_a_id == toi.pk else h.nguoi_a
        t = tin_cuoi.get(h.pk)
        items.append(
            HoiThoaiOut(
                id=h.pk,
                nguoi_kia=nguoi_dung_ra(kia),
                tin_cuoi=_tin_ra(t, nguoi_goi_id=toi.pk) if t is not None else None,
                so_chua_doc=chua_doc.get(h.pk, 0),
                cap_nhat_luc=h.cap_nhat_luc,
            )
        )
    return HopThuOut(items=items, so_chua_doc=dem_chua_doc(toi))


@router.get(
    # ⚠ **`/me/tin-nhan-chua-doc`, KHÔNG phải `/me/tin-nhan/chua-doc`** — gạch nối, không
    # gạch chéo. `chua-doc` là một username HỢP LỆ với `UnicodeUsernameValidator`, nên
    # dạng có gạch chéo nằm ngay trong không gian `{username}` ở dưới và **nuốt** người
    # dùng tên ấy: `GET` của họ trả `{"so_chua_doc": 0}` (sai hình dạng ⇒ client ném
    # `TypeError`), còn `POST` ăn **405 text/plain** — phá luôn hợp đồng `{detail, code}`
    # của PLAN mục 7. Ra hẳn khỏi không gian username rẻ hơn nhiều so với nuôi một danh
    # sách tên cấm, thứ sẽ thiếu một dòng ở cửa thứ hai. Ghim ở `test_A20_*`.
    "/me/tin-nhan-chua-doc",
    response={200: SoChuaDocOut, 401: LoiOut},
    operation_id="dem_tin_nhan_chua_doc",
    tags=["tin-nhan"],
    auth=dang_nhap,
)
def dem_tin_nhan_chua_doc(request, response: HttpResponse):
    """Số tin chưa đọc trên **toàn hộp thư** — con số trên biểu tượng phong bì ở header.

    Cửa riêng thay vì dùng lại `GET /me/tin-nhan`: header poll con số này 60 giây một lần
    trên mọi trang, và trả kèm cả hộp thư ở đó là kéo tối đa 100 hội thoại về cho một số.
    """
    response["Cache-Control"] = "no-store"
    return SoChuaDocOut(so_chua_doc=dem_chua_doc(request.user))


@router.get(
    "/me/tin-nhan/{username}",
    response={200: HoiThoaiChiTietOut, 400: LoiOut, 401: LoiOut, 404: LoiOut},
    operation_id="xem_hoi_thoai",
    tags=["tin-nhan"],
    auth=dang_nhap,
)
def xem_hoi_thoai(
    request,
    response: HttpResponse,
    username: str,
    truoc: int | None = None,
    limit: int = SO_TIN_MAC_DINH,
):
    """Một cuộc trò chuyện với `username`. Tin sắp **TĂNG DẦN theo `id`** (cũ ở trên).

    Chưa từng nhắn nhau ⇒ 200 với `hoi_thoai_id: null` và `items: []` — đó là trạng thái
    bình thường của lần mở đầu tiên, không phải 404. Username không tồn tại ⇒ 404; tự xem
    hội thoại với chính mình ⇒ 400.

    **Người đã bị vô hiệu hoá vẫn ĐỌC được cuộc trò chuyện đã có** — nếu không thì những
    tin họ đã gửi kẹt ở trạng thái chưa đọc vĩnh viễn. Chưa từng nhắn nhau thì họ vẫn là
    404, để cửa này không thành cửa dò tài khoản; xem `_nap_nguoi_kia`.

    Phân trang đi **lùi**: `?truoc=<id>` trả các tin có `id` nhỏ hơn, tức trang cũ hơn.
    `con_cu_hon` cho biết còn nữa không. `limit` trong 1..50, mặc định 30.

    **Không tự đánh dấu đã đọc** — dùng `POST /me/tin-nhan/{username}/doc`. Một `GET` đổi
    trạng thái là một `GET` mà prefetch của trình duyệt và bot đều gọi được.
    """
    response["Cache-Control"] = "no-store"
    if (hong := kiem_gioi_han(limit)) is not None:
        return hong
    toi = request.user
    kia = _nap_nguoi_kia(request, username, de_ghi=False)

    ht = lay_hoi_thoai(toi, kia)
    if ht is None:
        return HoiThoaiChiTietOut(
            hoi_thoai_id=None, nguoi_kia=nguoi_dung_ra(kia), items=[], con_cu_hon=False
        )

    qs = TinNhan.objects.filter(hoi_thoai=ht)
    if truoc is not None:
        qs = qs.filter(pk__lt=truoc)
    # Lấy dư MỘT hàng để biết "còn trang cũ hơn" mà không cần một câu `COUNT(*)` thứ hai
    # — cùng cơ chế `api/phan_trang.py::cat_trang`. Lấy giảm dần theo `id` (trang MỚI nhất
    # của tập đang xét) rồi đảo lại trong Python: khung chat đọc từ cũ xuống mới.
    lo = list(qs.order_by("-id")[: limit + 1])
    lo, con_cu_hon = cat_trang(lo, limit)
    return HoiThoaiChiTietOut(
        hoi_thoai_id=ht.pk,
        nguoi_kia=nguoi_dung_ra(kia),
        items=[_tin_ra(t, nguoi_goi_id=toi.pk) for t in reversed(lo)],
        con_cu_hon=con_cu_hon,
    )


@router.post(
    "/me/tin-nhan/{username}",
    response={
        201: TinNhanOut,
        400: LoiOut,
        401: LoiOut,
        403: LoiOut,
        404: LoiOut,
        429: LoiThoiGianOut,
    },
    operation_id="gui_tin_nhan",
    tags=["tin-nhan"],
    auth=dang_nhap,
)
def gui_tin_nhan(
    request, response: HttpResponse, username: str, du_lieu: TinNhanIn
):
    """Gửi một tin nhắn riêng. Tạo cuộc trò chuyện nếu chưa có. Trả **201**.

    Thân là plain text, tối đa 2000 ký tự, không được rỗng sau khi bỏ khoảng trắng.
    Người nhận không tồn tại hoặc đã bị vô hiệu hoá ⇒ 404; tự nhắn mình ⇒ 400; tài khoản
    bị khoá ⇒ 403.

    **Hạn mức 60 tin/giờ trượt cho mỗi người gửi** (đổi được ở
    `settings.HAN_MUC_TIN_NHAN_MOI_GIO`) ⇒ 429 `qua_han_muc_tin_nhan` kèm `thu_lai_tu`.

    Người nhận nhận một dòng chuông loại `tin_nhan`, **gộp theo cuộc trò chuyện**: 20 tin
    liên tiếp là một dòng được cập nhật, không phải 20 dòng.
    """
    response["Cache-Control"] = "no-store"
    kia = _nap_nguoi_kia(request, username, de_ghi=True)

    tran = tran_tin_nhan_moi_gio()
    if dem_tin_nhan_trong_gio(request.user) >= tran:
        # Kiểm TRƯỚC `atomic()`: `LoiGhi` không mang được `thu_lai_tu` (exception handler
        # chỉ dựng `LoiOut`), nên cửa này phải `return` thẳng — xem `api/loi.py`. Đếm
        # ngoài khoá, cùng lý do với các hạn mức khác — `core/han_muc.py`.
        return loi_thoi_gian(
            429,
            QUA_HAN_MUC_TIN_NHAN,
            f"Bạn gửi tối đa {tran} tin nhắn mỗi giờ. Thử lại sau ít phút nhé.",
            thu_lai_tu=luc_tin_nhan_duoc_lai(request.user),
        )

    try:
        with transaction.atomic():
            tin = gui_tin(nguoi_gui=request.user, nguoi_nhan=kia, body=du_lieu.body)
            # Trong CÙNG transaction — ràng buộc (1) của `core/thong_bao.py`. Ngoài nó
            # thì hoặc tin vào DB mà không ai được báo, hoặc chuông báo một tin đã bị
            # rollback; cả hai đều im lặng.
            bao_tin_nhan(tin)
    except LoiModel as e:
        # Cùng khuôn `api/theo_user.py`: `ValidationError` của tầng domain là **dữ liệu
        # người dùng sai**, phải ra 400 có mã — không phải 500.
        raise LoiGhi(400, DU_LIEU_KHONG_HOP_LE, "; ".join(e.messages)) from e

    return Status(201, _tin_ra(tin, nguoi_goi_id=request.user.pk))


@router.post(
    "/me/tin-nhan/{username}/doc",
    response={200: SoChuaDocOut, 400: LoiOut, 401: LoiOut, 404: LoiOut},
    operation_id="doc_hoi_thoai",
    tags=["tin-nhan"],
    auth=dang_nhap,
)
def doc_hoi_thoai(request, response: HttpResponse, username: str):
    """Đánh dấu đã đọc hết cuộc trò chuyện với `username`. **Idempotent.**

    Tắt luôn dòng chuông `tin_nhan` của đúng cuộc trò chuyện ấy — đọc hội thoại với A
    không đụng gì tới chuông của hội thoại với B.

    Trả **tổng** số tin còn chưa đọc trên toàn hộp thư, để header cập nhật con số ngay mà
    không phải poll thêm một vòng. Chưa từng nhắn nhau ⇒ 200, không làm gì.
    """
    response["Cache-Control"] = "no-store"
    toi = request.user
    kia = _nap_nguoi_kia(request, username, de_ghi=False)

    ht = lay_hoi_thoai(toi, kia)
    if ht is not None:
        with transaction.atomic():
            danh_dau_da_doc(user=toi, hoi_thoai=ht)
            doc_thong_bao_tin_nhan(toi, ht.pk)
    return SoChuaDocOut(so_chua_doc=dem_chua_doc(toi))
