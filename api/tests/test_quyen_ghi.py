"""**Phân quyền của MỌI đường ghi** — PLAN mục 7, 8.2, 5.10. Hạng mục số một của Phase 2.

Ba câu hỏi khác nhau, ba nhóm bài đo, và không câu nào trả lời hộ câu nào:

1. **Có khai auth không** (`test_moi_operation_ghi_deu_co_auth`) — hàng rào cấu trúc chạy
   trên chính `api_v1`. Nó bắt được cái mà bài đo theo-từng-endpoint không bắt được: một
   endpoint MỚI thêm ở phase sau mà quên `auth=`. Và với django-ninja 1.6, quên `auth=`
   không chỉ là mất xác thực — nó là mất **CSRF** luôn, vì phép kiểm CSRF nằm trong lớp
   auth (`ninja.security.APIKeyCookie`), không ở `NinjaAPI(csrf=…)`.
2. **Khách có bị chặn không** — 401 `chua_dang_nhap`, cho từng endpoint.
3. **B có làm được việc của A không** — 403 `khong_phai_chu`, cho từng endpoint có "chủ".

Nhóm 3 là nhóm không được thiếu dòng nào: một endpoint ghi không có bài đo "user B không
làm được việc của user A" thì coi như chưa xong (yêu cầu của plan mảng A).
"""

import json
from datetime import timedelta

import pytest
from django.test import Client
from django.utils import timezone

from core.ghi import tao_binh_luan
from core.models.moc import Moc

from api.quyen import (
    BI_KHOA,
    CHUA_DANG_NHAP,
    CSRF_KHONG_HOP_LE,
    KHONG_PHAI_CHU,
    MACH_BI_KHOA,
)
from api.quan_tri import api_admin
from api.v1 import api_v1

from .conftest import dat, ma_loi

# --- (1) hàng rào cấu trúc ---------------------------------------------------


#: Cả HAI `NinjaAPI` của repo phải chịu cùng hàng rào (L24, vá V1). Bản trước chỉ quét
#: `api_v1`; khu quản trị được che bằng một bảng hành vi rất chắc
#: (`test_api_quan_tri_phan_quyen.py`) nhưng **không có hàng rào cấu trúc tương đương** —
#: tức một endpoint quản trị MỚI quên `auth=` thì bảng kia không biết nó tồn tại để mà đỏ.
#:
#: `api_admin` khai `auth=ChiMod()` ở tầng `NinjaAPI`, nên hôm nay mọi operation của nó
#: thừa hưởng sẵn. Chính vì thế hàng rào ở đây rẻ và đáng có: nó ghim rằng ai gỡ mặc định
#: ấy ra (hoặc khai `auth=None` cho một endpoint "chỉ đọc thôi mà") phải thấy màu đỏ.
API_CO_DUONG_GHI = {"v1": api_v1, "admin": api_admin}


def _operation_ghi_cua(api):
    """`(methods, đường dẫn, Operation)` của mọi operation KHÔNG-GET trong một `NinjaAPI`.

    Đi qua `_get_bound_routers()` chứ **không** qua `api._routers` (L24, vá V1).
    `api._routers` trả các router **khuôn** — operation ở đó chưa được gắn với `NinjaAPI`,
    nên `auth_callbacks` của chúng chỉ chứa `auth=` khai trên **từng endpoint**. Khu quản
    trị khai `auth=ChiMod()` một lần ở tầng `NinjaAPI(auth=…)`, và django-ninja rót nó vào
    bản operation **đã bind**; đọc bản khuôn thì mọi endpoint quản trị trông như không có
    auth — một hàng rào báo động giả 100%, tức một hàng rào sẽ bị gỡ.

    Đây cũng là chỗ hàng rào này mong manh: hai tên nội bộ của django-ninja
    (`_get_bound_routers`, `path_operations`). Cái chuông cho chuyện đó là
    `test_hang_rao_auth_quet_ca_KHU_QUAN_TRI_va_khong_rong` — nó đỏ nếu phép quét trả rỗng.
    """
    for br in api._get_bound_routers():
        for path, path_view in br.path_operations.items():
            for op in path_view.operations:
                if set(op.methods) - {"GET", "HEAD", "OPTIONS"}:
                    yield tuple(sorted(op.methods)), f"{br.prefix}{path}", op


def moi_operation_ghi():
    """Đường ghi của **`api_v1`** — nguồn cho bảng phủ ở nhóm (2)/(3) dưới đây."""
    yield from _operation_ghi_cua(api_v1)


def test_moi_operation_ghi_deu_co_auth():
    """**Mọi** operation không-GET của `api_v1` VÀ `api_admin` phải khai `auth=`.

    Vì sao đây là một dòng bảo mật chứ không phải một quy ước: django-ninja 1.6 bỏ tham số
    `NinjaAPI(csrf=…)` và bọc `csrf_exempt` quanh mọi view của nó ở tầng middleware
    Django. Phép kiểm CSRF chuyển vào `APIKeyCookie._get_key`, tức **vào lớp auth**. Nên
    một endpoint ghi khai `auth=None` mất CẢ HAI lớp cùng lúc, và triệu chứng là: không
    có triệu chứng — trang lạ POST sang được bằng cookie phiên của người đang đăng nhập,
    HTTP 200, phiếu/bình luận vẫn vào DB.
    """
    thieu = [
        f"[{khoa}] {'/'.join(m)} {duong}"
        for khoa, api in API_CO_DUONG_GHI.items()
        for m, duong, op in _operation_ghi_cua(api)
        if not op.auth_callbacks
    ]
    assert thieu == [], f"endpoint ghi không khai auth (mất cả CSRF): {thieu}"


def test_hang_rao_auth_quet_ca_KHU_QUAN_TRI_va_khong_rong(  # noqa: D103
):
    """Chống bài trên xanh rỗng ở nửa `admin`: `api_admin` phải thật sự có đường ghi.

    Không có bài này thì một lần đổi tên thuộc tính nội bộ của django-ninja làm
    `_operation_ghi_cua(api_admin)` trả rỗng, và hàng rào vừa mở rộng lại co về đúng chỗ
    cũ — im lặng.
    """
    assert len(list(_operation_ghi_cua(api_admin))) >= 8


def test_co_du_endpoint_ghi_de_hang_rao_tren_khong_rong():
    """Chống bài đo trên xanh vô điều kiện vì `moi_operation_ghi()` trả rỗng."""
    assert len(list(moi_operation_ghi())) >= 11


def test_lop_auth_chay_kiem_CSRF():
    """Ghim rằng lớp auth của ta **thừa hưởng** phép kiểm CSRF, không tự viết lại.

    `DangNhap` kế thừa `SessionAuth` → `APIKeyCookie(csrf=True)`. Ai đó đổi nó sang
    `APIKeyHeader`, hay khởi tạo theo đường bỏ qua `__init__` của `APIKeyCookie`, là CSRF
    tắt lặng cho toàn bộ đường ghi. Bài đo dưới (request thật với
    `enforce_csrf_checks=True`) đo hành vi; bài này đo cái dây nối.
    """
    from api.quyen import dang_nhap

    assert dang_nhap.csrf is True


# --- (2) khách bị chặn -------------------------------------------------------

#: Mọi cửa ghi, kèm thân request tối thiểu. `{mach}`/`{moc}`/`{comment}` được thay bằng id
#: thật. Danh sách TƯỜNG MINH — thêm endpoint ghi mà quên thêm dòng ở đây thì
#: `test_bang_cua_ghi_phu_du_api_v1` đỏ.
CUA_GHI = [
    ("post", "/api/v1/machs", {"sub": "chung-khoan", "title": "T", "body": "B"}),
    ("post", "/api/v1/machs/{mach}/mocs", {"body": "B"}),
    ("post", "/api/v1/machs/{mach}/comments", {"body": "B"}),
    ("post", "/api/v1/machs/{mach}/close", {}),
    ("post", "/api/v1/machs/{mach}/reopen", {}),
    ("patch", "/api/v1/mocs/{moc}", {"body": "B"}),
    ("delete", "/api/v1/mocs/{moc}", {}),
    ("patch", "/api/v1/comments/{comment}", {"body": "B"}),
    ("delete", "/api/v1/comments/{comment}", {}),
    ("post", "/api/v1/votes", {"target_type": "moc", "target_id": 0, "value": 1}),
    ("post", "/api/v1/mocs/{moc}/reactions", {"emoji": "lieu"}),
    # --- Phase 3 ---
    ("post", "/api/v1/machs/{mach}/seen", {}),
    ("post", "/api/v1/machs/{mach}/follow", {}),
    ("delete", "/api/v1/machs/{mach}/follow", {}),
    ("post", "/api/v1/mocs/{moc}/trich", {"comment_id": 0}),
    ("delete", "/api/v1/mocs/{moc}/trich", {}),
    ("post", "/api/v1/notifications/read", {}),
    # --- Lượt vá V1 (2026-08-23) ---
    # `POST /reports` (L03) — cửa nhận báo cáo, **không có chủ**: ai đăng nhập cũng tố
    # được, nên nó vắng mặt ở `CUA_CO_CHU` bên dưới. `target_id: 0` được thay bằng id thật
    # ở thân bài đo, cùng lối với `/votes`.
    ("post", "/api/v1/reports", {"target_type": "moc", "target_id": 0, "ly_do": "spam"}),
    # `PATCH /me` (L14) — chủ suy ra từ PHIÊN, không từ tham số; cùng nhóm với `seen`/
    # `follow`, xem ghi chú của `CUA_CO_CHU`.
    ("patch", "/api/v1/me", {"nhan_digest": True}),
    # --- Phase 5 ---
    # Hai cửa này nhận **multipart** / không nhận thân nào, nhưng vẫn thuộc bảng này:
    # bài đo 401 ngay dưới chạy được vì django-ninja chạy lớp auth **trước** khi parse
    # tham số (`Operation.run` gọi `_run_authentication()` đầu tiên) — khách bị chặn
    # trước khi ai hỏi tới cái file. Vế 403 của chúng KHÔNG đo ở `CUA_CO_CHU` được, vì
    # lúc đó auth đã qua và Ninja sẽ trả **422** (thiếu phần `file`) chứ không 403; nó
    # có bài đo riêng gửi multipart thật — `test_api_anh.py::test_A7_*`.
    ("post", "/api/v1/mocs/{moc}/anh", {}),
    ("delete", "/api/v1/anh/{anh}", {}),
    # --- Avatar (2026-08-24) ---
    # Cùng loài `/anh`: `POST /me/avatar` là multipart, cả hai không nhận thân JSON. Bài
    # đo 401 chạy được vì auth chạy TRƯỚC khi parse tham số. Chúng vắng mặt ở `CUA_CO_CHU`
    # vì chủ suy ra từ PHIÊN, không từ tham số — cùng nhóm `PATCH /me` (đích luôn là chính
    # người gọi); vế "B không đụng được của A" là vô nghĩa ở đây.
    ("post", "/api/v1/me/avatar", {}),
    ("delete", "/api/v1/me/avatar", {}),
    # --- Ảnh nội dung (2026-08-24) ---
    # `POST /me/anh` — multipart, cùng loài với hai dòng trên: đích là chính người gọi
    # nên nó vắng mặt ở `CUA_CO_CHU`, và bài đo 401 chạy được vì auth chạy TRƯỚC khi
    # Ninja parse phần `file`.
    ("post", "/api/v1/me/anh", {}),
    # --- bề mặt mod trên v1 (2026-08-24, PLAN phần D) ---
    # Bốn cửa ẩn/khoá mở ra front vì Caddy chặn `gikky.net/api/admin/*` (PLAN 8.2). Chúng
    # thuộc bảng này như mọi cửa ghi khác — **khách vẫn phải nhận 401 `chua_dang_nhap`**,
    # không phải 403: lớp `ChiModTrenV1` cố ý trả `None` cho khách (→ handler
    # `AuthenticationError` chung của `api_v1`) và chỉ ném 403 cho người ĐÃ đăng nhập mà
    # không phải staff. Vế 403 ấy được đo riêng ở `test_api_mod.py`, cùng vế "mod đang bị
    # ban cũng 403".
    #
    # Chúng vắng mặt ở `CUA_CO_CHU` vì đích của chúng **không có chủ theo nghĩa của
    # `doi_chu_so_huu`**: quyền ở đây là quyền MOD, suy từ phiên, và mod ẩn nội dung của
    # người khác là đúng việc của mod. Vế "người không có quyền không đụng được" của
    # chúng được đo bằng đúng thứ đo được — `test_api_mod.py::test_user_thuong_bi_tu_choi`.
    ("post", "/api/v1/mod/machs/{mach}/an", {"an": True}),
    ("post", "/api/v1/mod/mocs/{moc}/an", {"an": True}),
    ("post", "/api/v1/mod/comments/{comment}/an", {"an": True}),
    ("post", "/api/v1/mod/machs/{mach}/khoa", {"khoa": True}),
    # --- theo dõi chuyên mục (2026-08-24) ---
    # Thân RỖNG: đích là chuyên mục trên đường dẫn, chủ suy ra từ phiên. Không có tham số
    # nào trỏ tới người khác, nên hai cửa này không cần `doi_chu_so_huu` — chúng chỉ ghi
    # được vào hàng của chính người gọi. Cái chúng vẫn cần là 401 + CSRF, và ở django-ninja
    # 1.6 hai thứ đó là **cùng một** thứ (`auth=dang_nhap`); đó chính là điều bảng này đo.
    ("post", "/api/v1/subs/{sub}/theo", {}),
    ("delete", "/api/v1/subs/{sub}/theo", {}),
    # --- theo dõi người (2026-08-25) ---
    # Thân RỖNG, đích trên đường dẫn, chủ suy từ phiên. Không tham số nào trỏ tới người
    # khác nên không cần `doi_chu_so_huu`; cái chúng cần là 401 + CSRF, mà ở django-ninja
    # 1.6 hai thứ đó là CÙNG một thứ (`auth=dang_nhap`).
    ("post", "/api/v1/users/{username}/theo", {}),
    ("delete", "/api/v1/users/{username}/theo", {}),
    # --- đếm lượt xem (2026-08-27) ---
    # Cửa ghi DUY NHẤT của `api_v1` **không có người dùng đứng sau**: nó nhận lượt xem
    # trang từ `apps/web/middleware.ts`, và auth của nó là một **secret dùng chung**
    # (`api/dem_luot_xem.py::SecretDemLuotXem`), không phải phiên đăng nhập.
    #
    # Nó vẫn thuộc bảng này, và vẫn phải trả **401 `chua_dang_nhap`** cho khách: lớp auth
    # trả `None` khi request không kèm header nào, tức khách bằng trình duyệt nhận đúng
    # câu trả lời như ở mọi cửa khác. Hai nhánh còn lại (503 khi server chưa đặt secret,
    # 401 `sai_secret` khi header sai) được đo riêng ở `test_api_dem_luot_xem.py` — chúng
    # không đo được ở đây vì bài đo dưới cố ý gửi request TRẦN.
    #
    # Nó vắng mặt ở `CUA_CO_CHU` vì đích của nó không có chủ: một lượt xem trang không
    # thuộc về ai, và bảng `LuotXem` cố ý không có cột nào gắn được với một con người.
    ("post", "/api/v1/dem-luot-xem", {"duong_dan": "/", "user_agent": "curl/8"}),
    # --- nhắn tin riêng (2026-09-03) ---
    # Người NHẬN nằm trên đường dẫn, người GỬI suy từ phiên — cùng nhóm "theo dõi người"
    # ngay trên. Không tham số nào trỏ tới hàng của người khác (hội thoại luôn được tra
    # bằng CẶP người gọi + người kia), nên không cần `doi_chu_so_huu` và chúng vắng mặt ở
    # `CUA_CO_CHU`. Cái chúng cần là 401 + CSRF, mà ở django-ninja 1.6 hai thứ đó là CÙNG
    # một thứ (`auth=dang_nhap`) — đó chính là điều bảng này đo.
    ("post", "/api/v1/me/tin-nhan/{username}", {"body": "B"}),
    ("post", "/api/v1/me/tin-nhan/{username}/doc", {}),
]


def _sao(duong: str) -> str:
    for x in (
        "{mach}", "{moc}", "{comment}", "{anh}",
        "{int:mach_id}", "{int:moc_id}", "{int:comment_id}", "{int:anh_id}",
        # Chuyên mục đi bằng **slug**, người dùng đi bằng **username** — không phải id.
        "{sub}", "{slug}", "{username}",
    ):
        duong = duong.replace(x, "*")
    return duong


def test_bang_cua_ghi_phu_du_api_v1():
    """`CUA_GHI` phải phủ ĐÚNG tập operation ghi của `api_v1` — không thiếu, không thừa.

    Không có bài này thì thêm một endpoint ghi mà quên thêm dòng vào `CUA_GHI` sẽ làm cả
    hai bài đo bên dưới **bỏ qua** nó trong im lặng: 401 và 403 vẫn "xanh cho mọi cửa đã
    liệt kê", mà cửa mới thì không ai liệt kê.
    """
    trong_bang = {(m, _sao(duong)) for m, duong, _ in CUA_GHI}
    thuc_te = {
        (m[0].lower(), _sao("/api/v1" + duong)) for m, duong, _ in moi_operation_ghi()
    }
    assert trong_bang == thuc_te


def _dien(duong: str, *, mach, moc, comment, anh=0) -> str:
    return (
        duong.replace("{mach}", str(mach))
        .replace("{moc}", str(moc))
        .replace("{comment}", str(comment))
        .replace("{anh}", str(anh))
    )


@pytest.mark.django_db
@pytest.mark.parametrize(
    "method,duong,than", CUA_GHI, ids=[f"{m}:{d}" for m, d, _ in CUA_GHI]
)
def test_khach_khong_ghi_duoc_gi(client, mach_cua_a, nguoi_a, method, duong, than):
    """Khách chưa đăng nhập nhận **401 `chua_dang_nhap`** ở MỌI cửa ghi.

    Đòi đúng `code` chứ không chỉ đúng status: django-ninja mặc định trả
    `{"detail": "Unauthorized"}` **không có `code`**, và frontend không phân biệt được
    "chưa đăng nhập" (đi đăng nhập) với "không phải chủ" (đừng thử nữa) nếu chỉ có 401.
    """
    c = tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="x")
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    url = _dien(duong, mach=mach_cua_a.pk, moc=moc.pk, comment=c.pk)
    if than.get("target_id") == 0:
        than = {**than, "target_id": moc.pk}
    assert ma_loi(client, url, than, status=401, method=method) == CHUA_DANG_NHAP


# --- (3) B không làm được việc của A -----------------------------------------

#: Cửa ghi **có chủ** — B phải nhận 403 `khong_phai_chu`. Những cửa vắng mặt ở đây là cửa
#: cố ý KHÔNG có chủ, và chúng có bài đo riêng chứng minh B **làm được**:
#: `POST /machs` (ai cũng đăng bài được), `POST /machs/{id}/comments` (khán đài là chỗ của
#: đám đông), `POST /votes` và `/reactions` (vote nội dung người khác là chuyện chính),
#: và `POST /reports` — **cả điểm** của một nút báo cáo là không cần quyền gì trên đích
#: (L03; `test_api_bao_cao.py` đo cả ca "B tố nội dung của A" thành công).
#:
#: **Ba cửa Phase 3 cũng vắng mặt, và vì một lý do KHÁC HẲN** — `seen`, `follow` và
#: `notifications/read` không phải "không có chủ", chúng là những cửa mà **chủ được suy ra
#: từ phiên, không từ tham số**. Không có đường nào để B chỉ tới hàng của A: mọi truy vấn
#: mở đầu bằng `user = request.user`. Vì thế 403 không phải câu trả lời đúng cho chúng —
#: B gọi `POST /machs/{của A}/follow` là B theo mạch đó, một hành động hoàn toàn hợp lệ.
#: Vế "B không đụng được của A" của chúng được đo bằng bài đo RIÊNG, đo đúng thứ đo được:
#: `test_api_follow_seen.py::test_B_khong_doc_va_khong_dat_duoc_vi_tri_doc_cua_A` và
#: `test_thong_bao.py::test_B_khong_thay_va_khong_danh_dau_duoc_thong_bao_cua_A`.
#: `PATCH /me` (L14) thuộc đúng nhóm ấy — xem
#: `test_api_toi_sua.py::test_chi_ghi_vao_hang_cua_CHINH_MINH`.
CUA_CO_CHU = [
    ("post", "/api/v1/machs/{mach}/mocs", {"body": "B chen vào sổ của A"}),
    ("post", "/api/v1/machs/{mach}/close", {"ket_qua": "B đóng sổ hộ"}),
    ("post", "/api/v1/machs/{mach}/reopen", {}),
    ("patch", "/api/v1/mocs/{moc}", {"body": "B sửa mốc của A"}),
    ("delete", "/api/v1/mocs/{moc}", {}),
    ("patch", "/api/v1/comments/{comment}", {"body": "B sửa bình luận của A"}),
    ("delete", "/api/v1/comments/{comment}", {}),
    # Trích vào sổ: chủ là **`Mach.author`**, không phải `Moc.author` — rào 4 của PLAN 5.6
    # ghi rõ blockquote là "trích từ khán đài, bởi chủ mạch".
    ("post", "/api/v1/mocs/{moc}/trich", {"comment_id": 0}),
    ("delete", "/api/v1/mocs/{moc}/trich", {}),
]


@pytest.mark.django_db
@pytest.mark.parametrize(
    "method,duong,than", CUA_CO_CHU, ids=[f"{m}:{d}" for m, d, _ in CUA_CO_CHU]
)
def test_B_khong_lam_duoc_viec_cua_A(
    client, mach_cua_a, nguoi_a, nguoi_b, method, duong, than
):
    """**403 `khong_phai_chu`** ở mọi cửa ghi có chủ. Đây là bài đo lõi của Phase 2.

    Một chi tiết cố ý: bài đo chạy trên mạch **đang mở** và nội dung **còn sống**, nên
    403 ở đây không thể đến từ một phép kiểm khác (khoá / đóng sổ / đã gỡ) rồi trông như
    đúng. Và nó đòi đúng mã `khong_phai_chu`, không phải "một mã 403 nào đó".
    """
    c = tao_binh_luan(mach=mach_cua_a, author=nguoi_a, body="chữ của A")
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    url = _dien(duong, mach=mach_cua_a.pk, moc=moc.pk, comment=c.pk)
    client.force_login(nguoi_b)
    assert ma_loi(client, url, than, status=403, method=method) == KHONG_PHAI_CHU


@pytest.mark.django_db
def test_B_van_lam_duoc_bon_viec_KHONG_co_chu(client, mach_cua_a, nguoi_b, sub):
    """Chiều ngược: `doi_chu_so_huu` không được cắt quá tay.

    Không có bài này thì "403 với mọi thứ" cũng xanh ở bài trên, và sản phẩm biến thành
    một cái blog một người: không ai bình luận được, không ai vote được.
    """
    client.force_login(nguoi_b)
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)

    dat(
        client,
        "/api/v1/machs",
        {"sub": sub.slug, "title": "Bài của B", "body": "x"},
        status=201,
    )
    dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "B nói xen vào"},
        status=201,
    )
    dat(
        client,
        "/api/v1/votes",
        {"target_type": "moc", "target_id": moc.pk, "value": 1},
        status=200,
    )
    dat(client, f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": "lieu"}, status=200)


@pytest.mark.django_db
def test_chu_mach_KHONG_sua_duoc_binh_luan_cua_nguoi_khac(client, mach_cua_a, nguoi_b):
    """Chủ mạch có quyền trên **cuốn sổ**, không có quyền trên **lời của người khác**.

    Đây là ca mà một phép kiểm "hoặc là chủ mạch" viết cho tiện sẽ nuốt mất, và nó nuốt
    theo hướng khó thấy nhất: mọi bài đo "B không sửa được của A" vẫn xanh, chỉ có chiều
    "A sửa được của B" là hỏng — mà không bài đo nào nhìn vào chiều đó.
    """
    cua_b = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="chữ của B")
    client.force_login(mach_cua_a.author)
    assert (
        ma_loi(
            client,
            f"/api/v1/comments/{cua_b.pk}",
            {"body": "chủ mạch sửa hộ"},
            status=403,
            method="patch",
        )
        == KHONG_PHAI_CHU
    )
    assert (
        ma_loi(client, f"/api/v1/comments/{cua_b.pk}", status=403, method="delete")
        == KHONG_PHAI_CHU
    )


# --- CSRF --------------------------------------------------------------------


@pytest.mark.django_db
def test_thieu_CSRF_token_thi_403_du_da_dang_nhap(mach_cua_a, nguoi_a):
    """CSRF: cookie phiên hợp lệ **không đủ** — thiếu `X-CSRFToken` là 403.

    Chạy trên `Client(enforce_csrf_checks=True)` vì test client mặc định đặt
    `_dont_enforce_csrf_checks` và `CsrfViewMiddleware` bỏ qua — nghĩa là **mọi bài đo
    khác trong repo này không chạm tới CSRF**, dù chúng POST thật. Bỏ bài này là để cả
    tầng ghi không có một phép đo CSRF nào.

    Đây đúng là đường tấn công mà PLAN 8.2 chốt "không JWT" phải trả giá bằng CSRF: bất kỳ
    trang web nào cũng POST sang `gikky.net/api/v1/...` được bằng cookie phiên của người
    đang đăng nhập trên tab khác.
    """
    c = Client(enforce_csrf_checks=True)
    c.force_login(nguoi_a)
    r = c.post(
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        data=json.dumps({"body": "không kèm token"}),
        content_type="application/json",
    )
    assert r.status_code == 403, r.content[:300]
    assert json.loads(r.content)["code"] == CSRF_KHONG_HOP_LE


@pytest.mark.django_db
def test_co_CSRF_token_thi_qua(mach_cua_a, nguoi_a):
    """Chiều ngược: đúng token thì đi qua — nếu không, bài trên xanh cả khi CSRF chặn oan.

    Token lấy đúng đường frontend lấy: `GET` một endpoint headless của allauth để nhận
    cookie `csrftoken` (allauth gọi `get_token(request)` cho client `browser`), rồi gắn
    vào header `X-CSRFToken`.
    """
    c = Client(enforce_csrf_checks=True)
    c.force_login(nguoi_a)
    r = c.get("/api/_allauth/browser/v1/auth/session")
    token = r.cookies["csrftoken"].value
    assert token

    r = c.post(
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        data=json.dumps({"body": "kèm token đúng"}),
        content_type="application/json",
        headers={"x-csrftoken": token},
    )
    assert r.status_code == 201, r.content[:300]


# --- tài khoản bị khoá (PLAN 5.10) -------------------------------------------


@pytest.mark.django_db
@pytest.mark.parametrize(
    "dat_ban",
    [
        pytest.param(lambda u: setattr(u, "ban_permanent", True), id="vinh-vien"),
        pytest.param(
            lambda u: setattr(u, "banned_until", timezone.now() + timedelta(days=1)),
            id="tam-thoi",
        ),
    ],
)
def test_tai_khoan_bi_khoa_khong_ghi_duoc(client, mach_cua_a, nguoi_b, dat_ban):
    """Ban là **403 kèm lý do**, không phải 401 — PLAN 5.10.

    Cột `banned_until`/`ban_permanent` dựng từ Phase 1 và khu quản trị đặt chúng là việc
    của Phase 4; nhưng phép kiểm phải sống từ Phase 2, cùng lúc với đường ghi đầu tiên.
    Dựng cột trước rồi hẹn kiểm sau nghĩa là suốt một phase, ban là một trường DB không có
    tác dụng nào.

    401 sẽ đẩy người bị ban đi đăng nhập lại vòng vòng mà không bao giờ biết vì sao.
    """
    dat_ban(nguoi_b)
    nguoi_b.ban_reason = "spam phím hàng"
    nguoi_b.save()
    client.force_login(nguoi_b)
    than = dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "vẫn muốn nói"},
        status=403,
    )
    assert than["code"] == BI_KHOA
    assert "spam phím hàng" in than["detail"]


@pytest.mark.django_db
def test_ban_TAM_da_het_han_thi_ghi_lai_duoc(client, mach_cua_a, nguoi_b):
    """Ban tạm hết hạn thì tự hết — nếu không, `banned_until` chỉ là ban vĩnh viễn."""
    nguoi_b.banned_until = timezone.now() - timedelta(seconds=1)
    nguoi_b.save()
    client.force_login(nguoi_b)
    dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "hết hạn rồi"},
        status=201,
    )


# --- mạch bị mod khoá / ẩn (PLAN 5.10) ---------------------------------------


@pytest.mark.django_db
def test_mach_bi_khoa_chan_MOI_tuong_tac_ke_ca_cua_tac_gia(client, mach_cua_a, nguoi_a):
    """PLAN 5.10: mạch bị mod khoá thì "đọc được, **không tương tác**" — cả tác giả.

    Năm cửa trong một bài vì luật là MỘT: `doi_mach_tuong_tac_duoc`. Nếu nó chỉ được gọi
    ở bốn trong năm chỗ thì cửa thứ năm là một lỗ mà không có gì đỏ — và vote là cửa dễ
    quên nhất, vì nó không có "chủ" nên nó không có phép kiểm nào khác đứng cạnh.
    """
    mach_cua_a.locked_at = timezone.now()
    mach_cua_a.save(update_fields=["locked_at"])
    moc = Moc.objects.get(mach=mach_cua_a, seq=1)
    client.force_login(nguoi_a)

    for method, url, than in [
        ("post", f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "x"}),
        ("post", f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "x"}),
        ("patch", f"/api/v1/mocs/{moc.pk}", {"body": "x"}),
        (
            "post",
            "/api/v1/votes",
            {"target_type": "moc", "target_id": moc.pk, "value": 1},
        ),
        ("post", f"/api/v1/mocs/{moc.pk}/reactions", {"emoji": "lieu"}),
    ]:
        assert ma_loi(client, url, than, status=403, method=method) == MACH_BI_KHOA, url


@pytest.mark.django_db
def test_mach_bi_mod_AN_thi_404_khong_phai_403(client, mach_cua_a, nguoi_a):
    """Mạch bị mod **ẩn** ⇒ coi như không tồn tại (404), không phải 403.

    Khác `locked_at` một chữ nhưng khác nhau về thông tin rò ra: 403 nói cho người lạ biết
    mạch đó tồn tại. `api/loi.py` đã chốt một mã cho cả "không có" lẫn "đã bị ẩn".
    """
    mach_cua_a.hidden_at = timezone.now()
    mach_cua_a.save(update_fields=["hidden_at"])
    client.force_login(nguoi_a)
    assert (
        ma_loi(
            client, f"/api/v1/machs/{mach_cua_a.pk}/comments", {"body": "x"}, status=404
        )
        == "khong_tim_thay"
    )


@pytest.mark.django_db
def test_A_van_lam_duoc_viec_cua_A(client, mach_cua_a, nguoi_a):
    """Đối chứng dương cho cả file: A **làm được** việc của A.

    Không có nó thì mọi bài đo trên xanh với một tầng auth từ chối tất cả.
    """
    client.force_login(nguoi_a)
    them = dat(
        client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": "Mốc 3."}, status=201
    )
    assert them["seq"] == 3
