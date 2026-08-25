"""Bề mặt mod HẸP trên `/api/v1/mod/*` — PLAN phần D (user chốt 2026-08-24).

Bốn cửa ẩn/khoá mở ra front vì Caddy chặn `gikky.net/api/admin/*` (PLAN 8.2): app công
khai **không gọi được** một endpoint `/api/admin/*` nào ở prod, dù ở dev nó có vẻ chạy.

Bốn nhóm câu hỏi, và không nhóm nào trả lời hộ nhóm nào:

1. **Ranh giới** — đúng BỐN cửa, không phải năm. Ban user / quản lý sub / nhật ký / bảng
   danh sách ở lại phía admin. Đây là *cả nội dung* của quyết định user duyệt.
2. **Quyền** — ba vế của `ChiMod`, chỉ bỏ vế Host. Vế dễ rơi nhất là "chưa bị ban": thiếu
   nó thì hành động "ban một mod đang lạm quyền" không chặn được gì trên site công khai.
3. **Vết** — mọi hành động ghi `AuditLog` (PLAN 5.10), đúng MỘT dòng, đúng actor.
4. **Cửa này KHÁC `/api/admin/*` ở đúng một chỗ**: hàng rào Host không với tới. Đó là lý
   do duy nhất nó tồn tại, nên nó phải được đo, không phải được tin.

Đường ghi thật (`hidden_at` kéo theo `comment_count`, thứ tự khoá hàng, ảnh, index tìm
kiếm) đã có bài đo riêng ở `test_ghi_kiem_duyet.py` và `test_api_quan_tri_kiem_duyet.py`;
file này **không** đo lại chúng — nó đo rằng cửa mới đi đúng vào đường ghi ấy.
"""

import json
from types import SimpleNamespace

import pytest
from django.test import Client, override_settings

from config.host_admin import MA_SAI_HOST
from core.ghi import (
    AUDIT_AN_BINH_LUAN,
    AUDIT_AN_MACH,
    AUDIT_AN_MOC,
    AUDIT_GO_AN_MACH,
    AUDIT_KHOA_MACH,
    DICH_COMMENT,
    DICH_MACH,
    DICH_MOC,
)
from core.models.he_thong import AuditLog

from api.loi import CHUA_DANG_NHAP, KHONG_DU_QUYEN, KHONG_TIM_THAY
from api.mod import ChiModTrenV1
from api.quan_tri import ChiMod
from api.quyen import BI_KHOA, LoiGhi
from api.v1 import api_v1

from tests._quan_tri import (
    dang_nhap,
    dat_gio_ban,
    dung_du_lieu,
    dung_mod,
    dung_thuong,
    goi,
    ma_loi,
)

TIEN_TO = "/api/v1/mod/"


def _bon_cua(dl: dict) -> list[tuple[str, str, dict]]:
    """`(operation_id, url, body)` của cả bốn cửa, trên dữ liệu thật của `dung_du_lieu`."""
    return [
        ("mod_dat_an_mach", f"/api/v1/mod/machs/{dl['mach'].pk}/an", {"an": True}),
        ("mod_dat_an_moc", f"/api/v1/mod/mocs/{dl['moc'].pk}/an", {"an": True}),
        (
            "mod_dat_an_binh_luan",
            f"/api/v1/mod/comments/{dl['binh_luan'].pk}/an",
            {"an": True},
        ),
        ("mod_dat_khoa_mach", f"/api/v1/mod/machs/{dl['mach'].pk}/khoa", {"khoa": True}),
    ]


@pytest.fixture
def dl(db):
    return dung_du_lieu()


@pytest.fixture
def mod(db):
    return dung_mod()


# --- (1) ranh giới -----------------------------------------------------------


def _cua_mod_cua_v1() -> set[tuple[tuple[str, ...], str]]:
    """`(methods, đường dẫn)` của mọi operation `api_v1` nằm dưới tiền tố `/mod/`."""
    ra = set()
    for prefix, router in api_v1._routers:
        for path, path_view in router.path_operations.items():
            for op in path_view.operations:
                duong = f"{prefix}{path}"
                if duong.startswith("/mod/"):
                    ra.add((tuple(sorted(op.methods)), duong))
    return ra


def test_be_mat_mod_tren_v1_dung_BON_cua():
    """Đúng bốn cửa. Cửa thứ năm xuất hiện ở đây là ranh giới đã bị mở mà không ai hỏi.

    Bài đo này ghim **con số và tên**, không ghim "có ít thôi": user duyệt phương án hẹp
    sau khi được nêu rõ đánh đổi (phiên mod bị chiếm thì kẻ tấn công ẩn được nội dung —
    khôi phục được, có `AuditLog` — nhưng **không ban được ai**). Nới thêm một cửa là đổi
    đúng cái đánh đổi ấy.
    """
    assert _cua_mod_cua_v1() == {
        (("POST",), "/mod/machs/{int:mach_id}/an"),
        (("POST",), "/mod/mocs/{int:moc_id}/an"),
        (("POST",), "/mod/comments/{int:comment_id}/an"),
        (("POST",), "/mod/machs/{int:mach_id}/khoa"),
    }


@pytest.mark.parametrize(
    "cam",
    ["ban", "go-ban", "subs", "nhat-ky", "thong-ke", "users", "reports", "comments?"],
)
def test_viec_o_LAI_phia_admin_khong_co_duong_nao_tren_v1_mod(cam):
    """Ban user · quản lý sub · đọc `AuditLog` · bảng danh sách · thống kê: **không** ở đây.

    Bài trên đã ghim tập bốn cửa, nhưng nó ghim bằng chuỗi đường dẫn — ai thêm
    `/mod/users/{username}/ban` sẽ sửa nó cho khớp gần như theo phản xạ. Bài này hỏi câu
    khác: *cái việc bị cấm mang tên gì*, và nó đỏ kể cả khi bảng trên đã được cập nhật.

    `comments?` (có dấu hỏi) khớp `/mod/comments` trần — bảng danh sách bình luận — chứ
    không khớp `/mod/comments/{id}/an` đang có.
    """
    duong = {d for _, d in _cua_mod_cua_v1()}
    if cam == "comments?":
        assert "/mod/comments" not in duong
        return
    pham = [d for d in duong if f"/{cam}" in d or d.endswith(f"/{cam}")]
    assert pham == [], f"việc {cam!r} phải ở lại /api/admin/*, không mở ra v1: {pham}"


# --- (2) quyền ---------------------------------------------------------------


def test_khach_nhan_401_o_ca_bon_cua(client, dl):
    """Khách chưa đăng nhập ⇒ **401 `chua_dang_nhap`**, không phải 403.

    401 là tín hiệu "hiện form đăng nhập"; 403 là "đừng thử nữa". Một mod vừa hết hạn
    cookie mà nhận 403 sẽ tưởng mình bị tước quyền.
    """
    for op, url, than in _bon_cua(dl):
        r = goi(client, "post", url, than)
        assert (r.status_code, ma_loi(r)) == (401, CHUA_DANG_NHAP), op


def test_user_thuong_bi_tu_choi(dl):
    """Người đã đăng nhập mà không phải staff ⇒ **403 `khong_du_quyen`**.

    Đây là vế `is_staff`, và nó là vế duy nhất `ChiModTrenV1` tự thêm vào (hai vế còn lại
    thừa hưởng từ `DangNhap`). Đòi đúng mã chứ không chỉ đúng status: 403 `csrf_khong_hop_le`
    cũng là 403, và nó sẽ nói dối rằng hàng rào quyền đang chạy.
    """
    client = dang_nhap(dung_thuong())
    for op, url, than in _bon_cua(dl):
        r = goi(client, "post", url, than)
        assert (r.status_code, ma_loi(r)) == (403, KHONG_DU_QUYEN), op


@pytest.mark.parametrize(
    "dat_ban",
    [
        pytest.param(lambda u: dat_gio_ban(u, 24), id="tam-thoi"),
        pytest.param(
            lambda u: type(u).objects.filter(pk=u.pk).update(
                ban_permanent=True, ban_reason="thử"
            ),
            id="vinh-vien",
        ),
    ],
)
def test_mod_DANG_BI_BAN_bi_tu_choi(dl, mod, dat_ban):
    """Mod bị ban **không** moderate được — vế thứ ba của `ChiMod`, vế dễ rơi nhất.

    Không có phép kiểm này thì hành động "ban một mod đang lạm quyền" **không chặn được
    gì trên site công khai**: phiên đang mở của họ vẫn ẩn được nội dung cho tới lúc cookie
    hết hạn. Và nó rơi im lặng — `is_staff` vẫn `True`, mọi bài đo quyền khác vẫn xanh.
    """
    dat_ban(mod)
    client = dang_nhap(mod)
    for op, url, than in _bon_cua(dl):
        r = goi(client, "post", url, than)
        assert (r.status_code, ma_loi(r)) == (403, BI_KHOA), op


def test_ban_TAM_da_het_han_thi_mod_lai_duoc(dl, mod):
    """Chiều ngược: ban tạm hết hạn thì hết ban.

    Không có bài này thì "403 với mọi mod" cũng xanh ở bài trên, và một lượt ban tạm biến
    thành ban vĩnh viễn khỏi quyền mod mà không ai gỡ được.
    """
    dat_gio_ban(mod, -1)
    client = dang_nhap(mod)
    r = goi(client, "post", f"/api/v1/mod/machs/{dl['mach'].pk}/an", {"an": True})
    assert r.status_code == 200, r.content


def _tu_choi(lop, user) -> bool:
    """`lop` có từ chối `user` không — gộp cả hai kiểu từ chối (`None` và `LoiGhi`)."""
    request = SimpleNamespace(user=user)
    try:
        return lop.authenticate(request, None) is None
    except LoiGhi:
        return True


@pytest.mark.django_db
def test_quyen_khop_TUNG_VE_voi_ChiMod_cua_khu_quan_tri():
    """`ChiModTrenV1` phải nhận/từ chối **y hệt** `ChiMod`, trên mọi tổ hợp trạng thái.

    `ChiModTrenV1` kế thừa `DangNhap`, không kế thừa `ChiMod` — có lý do (vòng import +
    mỗi vế đã có nguồn sự thật riêng, xem docstring lớp ấy). Cái giá của lối đó là **trôi**:
    ai thêm vế thứ tư vào `ChiMod` sẽ không thấy gì đỏ ở `api/mod.py`.

    Bài đo này là cái chuông cho đúng chuyện đó, và nó ĐO ĐƯỢC vì cả hai lớp chỉ đọc
    `request.user`. Nó cố ý so **kết quả nhận/từ chối**, không so mã lỗi: hai lớp trả lời
    cho hai giao diện khác nhau nên câu chữ được phép khác, còn ai vào được thì không.
    """
    from django.contrib.auth.models import AnonymousUser

    from core.models import User

    ca = {
        "khach": AnonymousUser(),
        "thuong": User.objects.create(username="u_thuong"),
        "staff": User.objects.create(username="u_staff", is_staff=True),
        "staff_da_vo_hieu": User.objects.create(
            username="u_tat", is_staff=True, is_active=False
        ),
        "staff_bi_ban_vinh_vien": User.objects.create(
            username="u_ban", is_staff=True, ban_permanent=True, ban_reason="thử"
        ),
    }
    ca["staff_bi_ban_tam"] = User.objects.create(username="u_ban_tam", is_staff=True)
    dat_gio_ban(ca["staff_bi_ban_tam"], 24)

    cu = ChiMod()
    moi = ChiModTrenV1()
    lech = {ten: (_tu_choi(cu, u), _tu_choi(moi, u)) for ten, u in ca.items()}
    lech = {ten: v for ten, v in lech.items() if v[0] != v[1]}
    assert lech == {}, f"(ChiMod, ChiModTrenV1) lệch nhau: {lech}"

    # Đối chứng: ma trận phải có CẢ hai màu, nếu không phép so trên là so hai hằng số.
    assert _tu_choi(cu, ca["staff"]) is False
    assert _tu_choi(cu, ca["thuong"]) is True


# --- (3) hành động đi đúng đường ghi, và có vết ------------------------------


def test_mod_hop_le_an_duoc_va_cua_cong_khai_doi_theo(dl, client):
    """Đối chứng dương của cả file: mod thật bấm được, và **cửa công khai đổi theo**.

    Vế thứ hai là vế đáng giá. Một handler trả `{"da_doi": true}` mà không gọi xuống
    `core/ghi.py` vẫn làm mọi bài đo phân quyền ở trên xanh — chỉ trang công khai là không
    đổi gì, và không ai nhìn vào nó trong một bài đo về quyền.
    """
    mod_client = dang_nhap(dung_mod())
    mach_id = dl["mach"].pk
    assert client.get(f"/api/v1/machs/{mach_id}").status_code == 200

    r = goi(mod_client, "post", f"/api/v1/mod/machs/{mach_id}/an", {"an": True})
    assert (r.status_code, r.json()) == (200, {"da_doi": True, "dang_bat": True})
    assert client.get(f"/api/v1/machs/{mach_id}").status_code == 404

    # Đảo được — một hành động moderation không gỡ được là một hành động không ai dám bấm.
    # Và nó chứng minh cửa này **không** copy bộ lọc `hidden_at__isnull=True` của API công
    # khai: mạch vừa bị ẩn vẫn phải với tới được.
    r = goi(mod_client, "post", f"/api/v1/mod/machs/{mach_id}/an", {"an": False})
    assert (r.status_code, r.json()) == (200, {"da_doi": True, "dang_bat": False})
    assert client.get(f"/api/v1/machs/{mach_id}").status_code == 200


def test_khoa_mach_chan_tuong_tac_cua_ca_tac_gia(dl):
    """Khoá qua cửa v1 ⇒ PLAN 5.10 "đọc được, không tương tác" có hiệu lực thật."""
    mod_client = dang_nhap(dung_mod())
    mach_id = dl["mach"].pk
    r = goi(mod_client, "post", f"/api/v1/mod/machs/{mach_id}/khoa", {"khoa": True})
    assert (r.status_code, r.json()) == (200, {"da_doi": True, "dang_bat": True})

    tac_gia = dang_nhap(dl["tac_gia"])
    r = goi(tac_gia, "post", f"/api/v1/machs/{mach_id}/comments", {"body": "vẫn nói"})
    assert (r.status_code, ma_loi(r)) == (403, "mach_bi_khoa"), r.content


@pytest.mark.parametrize(
    "khoa_url,than,action,target_type,khoa_dich",
    [
        ("machs/{mach}/an", {"an": True}, AUDIT_AN_MACH, DICH_MACH, "mach"),
        ("mocs/{moc}/an", {"an": True}, AUDIT_AN_MOC, DICH_MOC, "moc"),
        (
            "comments/{binh_luan}/an",
            {"an": True},
            AUDIT_AN_BINH_LUAN,
            DICH_COMMENT,
            "binh_luan",
        ),
        ("machs/{mach}/khoa", {"khoa": True}, AUDIT_KHOA_MACH, DICH_MACH, "mach"),
    ],
    ids=["an-mach", "an-moc", "an-binh-luan", "khoa-mach"],
)
def test_moi_hanh_dong_ghi_dung_MOT_dong_AuditLog(
    dl, mod, khoa_url, than, action, target_type, khoa_dich
):
    """PLAN 5.10: "mọi hành động mod ghi `AuditLog`" — actor + đối tượng + hành động.

    **Đúng MỘT dòng**, không phải "ít nhất một": hai dòng cho một lần bấm là con số trên
    trang nhật ký nói dối, và nó chỉ lộ ra khi ai đó đi đếm.

    Đây cũng là phép đo gián tiếp rằng cửa v1 đi qua `core/ghi.py` chứ không tự
    `update(hidden_at=…)` cho gọn: dòng log chỉ ra đời trong đúng transaction ấy.
    """
    dich = dl[khoa_dich]
    url = "/api/v1/mod/" + khoa_url.format(
        mach=dl["mach"].pk, moc=dl["moc"].pk, binh_luan=dl["binh_luan"].pk
    )
    assert AuditLog.objects.count() == 0

    r = goi(dang_nhap(mod), "post", url, than)
    assert r.status_code == 200, r.content

    dong = list(AuditLog.objects.all())
    assert len(dong) == 1, dong
    assert (dong[0].actor_id, dong[0].action, dong[0].target_type, dong[0].target_id) == (
        mod.pk,
        action,
        target_type,
        dich.pk,
    )


def test_bam_lai_cung_chieu_KHONG_de_dong_log_thu_hai(dl, mod):
    """Idempotent: bấm "ẩn" lần hai trả `da_doi=false` và **không** ghi log thêm."""
    client = dang_nhap(mod)
    url = f"/api/v1/mod/machs/{dl['mach'].pk}/an"
    assert goi(client, "post", url, {"an": True}).json()["da_doi"] is True
    assert goi(client, "post", url, {"an": True}).json() == {
        "da_doi": False,
        "dang_bat": True,
    }
    assert AuditLog.objects.count() == 1

    # Gỡ ẩn thì có đổi ⇒ dòng thứ hai, mang action ngược lại.
    assert goi(client, "post", url, {"an": False}).json()["da_doi"] is True
    assert [a.action for a in AuditLog.objects.order_by("id")] == [
        AUDIT_AN_MACH,
        AUDIT_GO_AN_MACH,
    ]


@pytest.mark.parametrize(
    "url",
    [
        "/api/v1/mod/machs/98765/an",
        "/api/v1/mod/mocs/98765/an",
        "/api/v1/mod/comments/98765/an",
        "/api/v1/mod/machs/98765/khoa",
    ],
)
def test_id_la_thi_404(mod, url, db):
    """Id không tồn tại ⇒ 404 `khong_tim_thay`, không phải 500."""
    than = {"khoa": True} if url.endswith("/khoa") else {"an": True}
    r = goi(dang_nhap(mod), "post", url, than)
    assert (r.status_code, ma_loi(r)) == (404, KHONG_TIM_THAY), r.content


# --- (4) header + hàng rào Host ---------------------------------------------


def test_ca_bon_cua_tra_no_store(dl, mod):
    """`Cache-Control: no-store` — hành động mod không được nằm lại trong bất kỳ cache nào.

    Đo trên response **thành công**: đó là response duy nhất mang nội dung đáng cache
    nhầm (`{da_doi, dang_bat}` là trạng thái tức thời của một hàng dữ liệu).
    """
    client = dang_nhap(mod)
    for op, url, than in _bon_cua(dl):
        r = goi(client, "post", url, than)
        assert r.status_code == 200, (op, r.content)
        assert r.headers.get("Cache-Control") == "no-store", op


HOST_QUAN_TRI = "admin.gikky.net"
HOST_CONG_KHAI = "gikky.net"

#: Cả hai host phải nằm trong `ALLOWED_HOSTS`, nếu không Django trả 400 (`DisallowedHost`)
#: TRƯỚC khi middleware chạy — và bài đo sẽ xanh vì một lý do hoàn toàn khác.
cau_hinh = override_settings(
    ALLOWED_HOSTS=[HOST_QUAN_TRI, HOST_CONG_KHAI, "testserver"],
    ADMIN_HOSTS=[HOST_QUAN_TRI],
)


@cau_hinh
def test_cua_v1_KHONG_bi_hang_rao_Host_chan_trong_khi_cua_admin_BI_chan(dl, mod):
    """Đây là **toàn bộ lý do file `api/mod.py` tồn tại**, nên nó phải được đo.

    Cùng một mod, cùng một hành động, cùng một mạch, gọi từ host CÔNG KHAI:

    - `/api/admin/machs/{id}/an` → 403 `sai_host_quan_tri` (PLAN 8.2, lớp Caddy mô phỏng);
    - `/api/v1/mod/machs/{id}/an` → 200.

    Vế thứ nhất là đối chứng: thiếu nó thì bài đo chỉ chứng minh "một endpoint trả 200",
    không chứng minh rằng nó vượt qua đúng cái hàng rào mà cửa admin không vượt được.
    """
    client = Client()
    client.force_login(mod, backend="django.contrib.auth.backends.ModelBackend")
    mach_id = dl["mach"].pk
    than = json.dumps({"an": True})

    r = client.post(
        f"/api/admin/machs/{mach_id}/an",
        data=than,
        content_type="application/json",
        headers={"host": HOST_CONG_KHAI},
    )
    assert (r.status_code, ma_loi(r)) == (403, MA_SAI_HOST), r.content

    r = client.post(
        f"/api/v1/mod/machs/{mach_id}/an",
        data=than,
        content_type="application/json",
        headers={"host": HOST_CONG_KHAI},
    )
    assert r.status_code == 200, r.content
    assert r.json() == {"da_doi": True, "dang_bat": True}


def test_cua_mod_v1_doi_CSRF(dl, mod):
    """Session cookie **không đủ** — thiếu `X-CSRFToken` là 403.

    Cửa này sống trên host công khai, tức trên đúng bề mặt mà PLAN 8.2 chấp nhận rủi ro
    "phiên mod bị chiếm". Bỏ CSRF ở đây là bất kỳ trang web nào cũng ẩn được nội dung của
    gikky bằng cookie phiên của một mod đang mở tab khác — HTTP 200, không gì đỏ.

    Chạy trên `Client(enforce_csrf_checks=True)` vì test client mặc định tắt phép kiểm ấy,
    nghĩa là **mọi bài đo khác trong file này không chạm tới CSRF** dù chúng POST thật.
    """
    c = Client(enforce_csrf_checks=True)
    c.force_login(mod, backend="django.contrib.auth.backends.ModelBackend")
    r = c.post(
        f"/api/v1/mod/machs/{dl['mach'].pk}/an",
        data=json.dumps({"an": True}),
        content_type="application/json",
    )
    assert r.status_code == 403, r.content[:300]
    assert ma_loi(r) == "csrf_khong_hop_le"
