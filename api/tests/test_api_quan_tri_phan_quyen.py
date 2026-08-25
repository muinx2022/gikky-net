"""Phân quyền khu quản trị — **hạng mục số một của Phase 4** (PLAN mục 10, tiêu chí M10).

Mệnh đề phải giữ, và nó không có ngoại lệ nào:

> Mọi endpoint dưới `/api/admin/` đều đòi một tài khoản `is_staff` còn hiệu lực. Người
> lạ nhận 401, người đã đăng nhập mà không phải mod nhận 403, và **không byte nội dung
> nào** của thứ họ không được xem lọt vào thân hai response đó.

Chữ "mọi" ở trên chỉ đúng nếu có gì đó đếm hộ. Đó là
`test_bang_nay_phu_het_moi_endpoint_cua_api_admin`: nó đọc danh sách operation THẬT của
`api_admin` và đòi bảng trong `tests/_quan_tri.py` phủ hết. Thêm một endpoint mà quên bài
đo phân quyền ⇒ ĐỎ ngay, không phải ba tháng sau.

**Vì sao bảng thay vì mười sáu hàm `test_...`:** mười sáu hàm viết tay là mười sáu chỗ có
thể quên, và cái quên đó không đỏ ở đâu cả. Bảng + phép đối chiếu biến "quên" thành lỗi.
"""

import pytest

from api.loi import CHUA_DANG_NHAP, CSRF_THAT_BAI, KHONG_DU_QUYEN
from api.quan_tri import ChiMod, api_admin

from tests._quan_tri import (
    NOI_DUNG_BINH_LUAN,
    NOI_DUNG_MOC,
    bang_endpoint,
    dang_nhap,
    dat_gio_ban,
    dung_du_lieu,
    dung_mod,
    dung_thuong,
    goi,
    ma_loi,
)


def _moi_operation_id() -> set[str]:
    """`operation_id` của mọi endpoint đã đăng ký vào `api_admin` — đọc object, không đọc
    schema. Cùng lý lẽ với `tests/test_operation_id.py`: schema không phân biệt được khai
    tay với tự sinh, còn `Operation` thì có."""
    return {
        op.operation_id
        for _, router in api_admin._routers
        for path_view in router.path_operations.values()
        for op in path_view.operations
    }


@pytest.fixture
def du_lieu(db):
    return dung_du_lieu()


def test_bang_nay_phu_het_moi_endpoint_cua_api_admin(du_lieu):
    """Cái chuông của cả file: bảng thiếu một endpoint ⇒ đỏ ở đây, không im lặng.

    Đi CẢ HAI chiều. Thiếu ⇒ có endpoint không ai chấm phân quyền. Thừa ⇒ bảng trỏ vào
    một endpoint đã gỡ, và dòng đó sẽ lặng lẽ chấm một đường 404 thay vì một hàng rào.
    """
    trong_bang = {ten for ten, _, _, _ in bang_endpoint(du_lieu)}
    that = _moi_operation_id()

    assert that - trong_bang == set(), (
        f"endpoint quản trị CHƯA có bài đo phân quyền: {sorted(that - trong_bang)}. "
        "Thêm một dòng vào `tests/_quan_tri.py::bang_endpoint`."
    )
    assert trong_bang - that == set(), (
        f"bảng trỏ vào endpoint không còn tồn tại: {sorted(trong_bang - that)}."
    )
    assert len(that) >= 16, f"chỉ thấy {len(that)} operation — walker hỏng?"


def test_nguoi_la_KHONG_vao_duoc_endpoint_nao(client, du_lieu):
    """Chưa đăng nhập ⇒ 401 `chua_dang_nhap` ở **mọi** endpoint, không sót cái nào."""
    hong = []
    for ten, method, url, body in bang_endpoint(du_lieu):
        r = goi(client, method, url, body)
        if r.status_code != 401 or ma_loi(r) != CHUA_DANG_NHAP:
            hong.append(f"{ten}: {method.upper()} {url} → {r.status_code} {ma_loi(r)}")
    assert hong == [], hong


def test_user_thuong_KHONG_vao_duoc_endpoint_nao(du_lieu):
    """Đã đăng nhập nhưng `is_staff=False` ⇒ 403 `khong_du_quyen` ở **mọi** endpoint.

    401 hay 403 là khác nhau có ý nghĩa, không phải khẩu vị: app admin hiện form đăng
    nhập cho 401 và nói "tài khoản này không phải mod" cho 403. Gộp hai mã là màn hình
    đăng nhập vô hạn cho một người đã đăng nhập.
    """
    client = dang_nhap(dung_thuong())
    hong = []
    for ten, method, url, body in bang_endpoint(du_lieu):
        r = goi(client, method, url, body)
        if r.status_code != 403 or ma_loi(r) != KHONG_DU_QUYEN:
            hong.append(f"{ten}: {method.upper()} {url} → {r.status_code} {ma_loi(r)}")
    assert hong == [], hong


#: Endpoint đòi **superuser**, không chỉ `is_staff`. Danh sách này là một **ngoại lệ có
#: tên**, và nó được ép ở CẢ HAI CHIỀU bên dưới: mod phải bị chặn ở đúng những cái này, và
#: phải qua được mọi cái còn lại. Nới điều kiện "mod qua được mọi endpoint" thành "trừ vài
#: cái" mà không ghim lại chiều ngược là mở một cửa cho mọi endpoint tương lai lặng lẽ
#: thành superuser-only.
#:
#: Lý do của mục hiện có: ai đổi được OAuth client là đổi được cửa đăng nhập của cả site —
#: trỏ `client_id` sang một project Google mình kiểm soát là một đường nhận phiên của
#: người khác. Cùng lý lẽ PLAN mục 7 dùng để giữ cấp/thu `is_staff` ngoài khu quản trị.
CHI_SUPERUSER = {
    "quan_tri_luu_cai_dat_google",
    "quan_tri_xoa_cai_dat_google",
    # CRUD tài khoản (2026-08-25). User chốt "chỉ superadmin mới có quyền thay đổi các
    # thông tin của user". Đặt mật khẩu cho người khác = đăng nhập được bằng tài khoản
    # đó, tức chiếm tài khoản kể cả khi có thiện ý.
    "quan_tri_tao_nguoi_dung",
    "quan_tri_sua_nguoi_dung",
    "quan_tri_dat_mat_khau",
}


def test_mod_QUA_duoc_moi_endpoint(du_lieu):
    """Chiều ngược: hàng rào từ chối tất cả thì hai bài trên vẫn xanh — và khu này chết.

    Không đòi 2xx: vài endpoint trả 409 hợp lệ trên bộ dữ liệu này (xoá sub còn mạch).
    Thứ phải giữ là **không endpoint nào trả 401/403 cho mod** — trừ `CHI_SUPERUSER`.
    """
    client = dang_nhap(dung_mod())
    hong = []
    for ten, method, url, body in bang_endpoint(du_lieu):
        if ten in CHI_SUPERUSER:
            continue
        r = goi(client, method, url, body)
        if r.status_code in (401, 403):
            hong.append(f"{ten}: {method.upper()} {url} → {r.status_code} {ma_loi(r)}")
    assert hong == [], hong


def test_CHI_SUPERUSER_that_su_chan_mod(du_lieu):
    """Chiều còn lại của ngoại lệ: mod **phải** ăn 403 ở đúng những endpoint ấy.

    Thiếu bài này thì `CHI_SUPERUSER` chỉ là một danh sách miễn trừ — thêm tên vào đó là
    cách rẻ nhất để làm xanh một endpoint đang hỏng phân quyền, và không có gì cãi lại.
    """
    client = dang_nhap(dung_mod())
    theo_ten = {ten: (m, u, b) for ten, m, u, b in bang_endpoint(du_lieu)}

    assert CHI_SUPERUSER <= set(theo_ten), (
        f"CHI_SUPERUSER trỏ vào endpoint không có trong bảng: "
        f"{sorted(CHI_SUPERUSER - set(theo_ten))}"
    )

    hong = []
    for ten in sorted(CHI_SUPERUSER):
        method, url, body = theo_ten[ten]
        r = goi(client, method, url, body)
        if r.status_code != 403 or ma_loi(r) != KHONG_DU_QUYEN:
            hong.append(f"{ten}: {method.upper()} {url} → {r.status_code} {ma_loi(r)}")
    assert hong == [], hong


def test_superuser_QUA_duoc_nhung_endpoint_CHI_SUPERUSER(du_lieu):
    """Và superuser thì qua được — nếu không, "chỉ superuser" là "không ai"."""
    sieu = dung_mod("sieu_quan_tri")
    sieu.is_superuser = True
    sieu.save(update_fields=["is_superuser"])
    client = dang_nhap(sieu)
    theo_ten = {ten: (m, u, b) for ten, m, u, b in bang_endpoint(du_lieu)}

    hong = []
    for ten in sorted(CHI_SUPERUSER):
        method, url, body = theo_ten[ten]
        r = goi(client, method, url, body)
        if r.status_code in (401, 403):
            hong.append(f"{ten}: {method.upper()} {url} → {r.status_code} {ma_loi(r)}")
    assert hong == [], hong


def test_mod_dang_bi_ban_khong_moderate_duoc(du_lieu):
    """Mod bị ban mất quyền NGAY, không phải chờ cookie hết hạn.

    Không kiểm `dang_bi_ban()` ở `ChiMod` thì hành động "ban một mod đang lạm quyền" chỉ
    chặn được đường ĐĂNG NHẬP (Phase 2), trong khi phiên đang mở của họ vẫn ẩn/khoá được
    tiếp — tức lệnh ban không có hiệu lực cho tới lần đăng nhập sau.
    """
    mod = dung_mod()
    client = dang_nhap(mod)
    assert client.get("/api/admin/me").status_code == 200

    dat_gio_ban(mod, gio=24)
    r = client.get("/api/admin/me")
    assert (r.status_code, ma_loi(r)) == (403, KHONG_DU_QUYEN)

    # …và ban TẠM đã hết hạn thì quyền trở lại — nếu không, "ban 24 giờ" là ban vĩnh viễn.
    dat_gio_ban(mod, gio=-1)
    assert client.get("/api/admin/me").status_code == 200


@pytest.mark.django_db
def test_ChiMod_tu_choi_tai_khoan_da_vo_hieu_hoa():
    """`is_active=False` (xoá tài khoản GDPR-lite) ⇒ không moderate được.

    Đo ở tầng HÀM chứ không qua HTTP, và lý do đáng ghi ra: `ModelBackend.get_user` của
    Django không khôi phục phiên cho tài khoản `is_active=False`, nên đường HTTP trả 401
    (`AnonymousUser`) chứ không tới được `ChiMod`. Đo qua HTTP sẽ xanh **bất kể** dòng
    `is_active` trong `ChiMod` còn hay mất — tức một bài đo rỗng cho đúng thứ nó định đo.
    """

    class YeuCauGia:
        pass

    mod = dung_mod()
    yeu_cau = YeuCauGia()
    yeu_cau.user = mod
    assert ChiMod().authenticate(yeu_cau, key=None) is mod

    mod.is_active = False
    assert ChiMod().authenticate(yeu_cau, key=None) is None


def test_user_thuong_khong_doc_duoc_noi_dung_qua_hang_doi_bao_cao(du_lieu):
    """Đường ĐỌC cũng phải kín: 403 không được mang theo nội dung bị tố.

    Hàng đợi báo cáo cố ý trả `trich_yeu` **không che** (mod phải đọc được thứ vừa bị ẩn —
    xem `api/quan_tri_schemas.py`). Điều kiện để việc đó an toàn là hàng rào chặn TRƯỚC
    khi handler chạy. Bài đo này soi đúng chỗ nối ấy: thân 403 không được chứa một byte
    nội dung nào.
    """
    client = dang_nhap(dung_thuong())
    for url in (
        "/api/admin/reports",
        "/api/admin/reports?trang_thai=tat_ca",
        f"/api/admin/machs/{du_lieu['mach'].pk}",
    ):
        r = client.get(url)
        assert r.status_code == 403, url
        than = r.content.decode()
        assert NOI_DUNG_MOC not in than, url
        assert NOI_DUNG_BINH_LUAN not in than, url


def test_bai_do_ro_ri_khong_do_rong(du_lieu):
    """Đối chứng dương cho bài trên: hai chuỗi mồi PHẢI ra được ở cửa của mod.

    Không có bài này thì `test_..._khong_doc_duoc_noi_dung...` vẫn xanh nguyên nếu ai đó
    đổi `NOI_DUNG_MOC` thành một chuỗi không bao giờ xuất hiện ở đâu — đúng loại proof đo
    RỖNG mà repo đã dính một lần.
    """
    client = dang_nhap(dung_mod())
    than = client.get("/api/admin/reports?trang_thai=tat_ca").content.decode()
    assert NOI_DUNG_BINH_LUAN in than

    than_mach = client.get(f"/api/admin/machs/{du_lieu['mach'].pk}").content.decode()
    assert NOI_DUNG_MOC in than_mach


def test_csrf_that_su_duoc_ap_cho_moi_request_ghi(du_lieu):
    """Session cookie mà không CSRF là một form trên trang bất kỳ ẩn được mạch người khác.

    `Client()` mặc định tắt CSRF (`enforce_csrf_checks=False`), nên **mọi bài đo khác
    trong file này không nói gì về CSRF** — chỗ duy nhất nói là đây.

    Cả hai chiều: thiếu token ⇒ 403 `csrf_that_bai`; có token ⇒ đi qua. Chỉ đo chiều đầu
    thì một cấu hình chặn sạch mọi POST cũng xanh.
    """
    from django.test import Client

    mod = dung_mod()
    client = Client(enforce_csrf_checks=True)
    client.force_login(mod, backend="django.contrib.auth.backends.ModelBackend")

    url = f"/api/admin/mocs/{du_lieu['moc'].pk}/an"
    r = client.post(url, data={"an": True}, content_type="application/json")
    assert (r.status_code, ma_loi(r)) == (403, CSRF_THAT_BAI)
    du_lieu["moc"].refresh_from_db()
    assert du_lieu["moc"].hidden_at is None, "ghi được dù CSRF hỏng"

    # `GET /me` là chỗ gieo cookie `csrftoken` cho app admin — đo luôn rằng nó gieo thật.
    assert client.get("/api/admin/me").status_code == 200
    token = client.cookies["csrftoken"].value
    assert token, "GET /api/admin/me không gieo cookie csrftoken"

    r = client.post(
        url,
        data={"an": True},
        content_type="application/json",
        headers={"x-csrftoken": token},
    )
    assert r.status_code == 200, r.content
    du_lieu["moc"].refresh_from_db()
    assert du_lieu["moc"].hidden_at is not None
