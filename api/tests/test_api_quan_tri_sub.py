"""CRUD chuyên mục + ban/gỡ ban tài khoản — PLAN 9.3 mục 3, PLAN 5.10.

Hai nhóm nằm chung một file vì chúng có chung hình dạng bài đo: một đường thuận, rồi ba
đường **từ chối** mà mỗi cái đóng một cửa hỏng cụ thể. Chính những đường từ chối mới là
nội dung của file này — đường thuận thì `test_api_quan_tri_phan_quyen.py` đã chạm qua.
"""

import pytest

from core.models import AuditLog, Sub, User

from tests._quan_tri import dang_nhap, dung_du_lieu, dung_mod, dung_thuong, goi


@pytest.fixture
def canh(db):
    dl = dung_du_lieu()
    return dl, dang_nhap(dung_mod())


# --- Sub CRUD ---------------------------------------------------------------


def test_tao_sua_liet_ke_sub_di_tron_mot_vong(canh):
    dl, mod = canh
    r = goi(mod, "post", "/api/admin/subs", {"slug": "crypto", "ten": "Crypto"})
    assert r.status_code == 201, r.content
    assert r.json() == {
        "slug": "crypto",
        "ten": "Crypto",
        "mo_ta": "",
        "created_at": r.json()["created_at"],
        "so_mach": 0,
        # Sub mới không có mod nào. Phép so là dict ĐẦY ĐỦ chứ không phải vài khoá —
        # thêm trường vào SubQuanTriOut mà quên chỗ này thì bài đo ĐỎ, đúng ý định.
        "mods": [],
        # `chung-khoan` của `dung_du_lieu` tạo bằng `Sub.objects.create` nên giữ mặc định
        # `0`; sub tạo qua API nhận `max+1` để đứng CUỐI bảng.
        "thu_tu": 1,
        "vi_tri_trang_chu": None,
    }

    r = goi(mod, "patch", "/api/admin/subs/crypto", {"mo_ta": "Tiền mã hoá"})
    assert r.status_code == 200 and r.json()["mo_ta"] == "Tiền mã hoá"
    assert r.json()["ten"] == "Crypto", "PATCH thiếu trường đã xoá mất trường khác"

    danh_sach = mod.get("/api/admin/subs").json()
    assert [s["slug"] for s in danh_sach] == ["chung-khoan", "crypto"]
    assert next(s for s in danh_sach if s["slug"] == "chung-khoan")["so_mach"] == 1


def test_slug_trung_tra_409_chu_khong_500(canh):
    """`UNIQUE (slug)` ở tầng DB là chỗ chặn thật; handler phải dịch nó, không để nó nổ."""
    _, mod = canh
    r = goi(mod, "post", "/api/admin/subs", {"slug": "chung-khoan", "ten": "Trùng"})
    assert r.status_code == 409
    assert r.json()["code"] == "xung_dot"
    assert Sub.objects.filter(slug="chung-khoan").count() == 1


@pytest.mark.parametrize(
    "slug",
    ["Chứng Khoán", "co dau cach", "CHU-HOA", "", "x" * 41, "  ", "co/gach-cheo"],
)
def test_slug_khong_chuan_bi_tu_choi_chu_KHONG_duoc_sua_ho(canh, slug):
    """Server không slugify hộ.

    Sửa hộ nghĩa là người gõ `Chứng Khoán` nhận về `/s/chung-khoan` mà không biết, rồi lần
    sau gõ lại đúng chuỗi ấy và ăn 409 cho một sub họ tưởng chưa tạo.

    Phép kiểm là `slugify(s) == s`, tức **đúng tập ký tự `SlugField` chấp nhận** — gạch
    dưới nằm trong tập đó và cố ý KHÔNG bị từ chối (`/s/co_gach_duoi` là URL hợp lệ). Đây
    là chỗ dễ siết quá tay thành một regex hẹp hơn cột trong DB.
    """
    _, mod = canh
    r = goi(mod, "post", "/api/admin/subs", {"slug": slug, "ten": "X"})
    assert r.status_code == 400, f"{slug!r} → {r.status_code}"
    assert r.json()["code"] == "tham_so_khong_hop_le"
    assert Sub.objects.count() == 1


@pytest.mark.parametrize("slug", ["thu-tu", "trang-chu"])
def test_slug_trung_path_tinh_bi_cam(canh, slug):
    """`PUT /subs/thu-tu`, `PUT /subs/trang-chu` là path tĩnh — tạo `s/<slug>` thì
    PATCH/DELETE bị 405 text thô.

    Không có danh sách slug cấm thì `slugify("thu-tu") == "thu-tu"` cho qua, chuyên mục
    lên sidebar, rồi không sửa/xoá được qua khu quản trị (path tĩnh nuốt mọi method).
    """
    _, mod = canh
    r = goi(mod, "post", "/api/admin/subs", {"slug": slug, "ten": "Path tĩnh"})
    assert r.status_code == 400, r.content
    assert r.json()["code"] == "tham_so_khong_hop_le"
    assert not Sub.objects.filter(slug=slug).exists()


def test_slug_hop_le_van_qua_duoc_khong_bi_siet_qua_tay(canh):
    """Chiều ngược của bài trên: từ chối sạch mọi slug thì nó vẫn xanh."""
    _, mod = canh
    for slug in ("crypto", "chung-khoan-2", "co_gach_duoi"):
        r = goi(mod, "post", "/api/admin/subs", {"slug": slug, "ten": "X"})
        assert r.status_code == 201, f"{slug!r} → {r.status_code} {r.content}"


def test_khong_xoa_duoc_sub_con_mach(canh):
    """`Mach.sub` là `PROTECT` — không tiền-kiểm thì đây là 500 trên một thao tác hợp lệ."""
    _, mod = canh
    r = goi(mod, "delete", "/api/admin/subs/chung-khoan", None)
    assert r.status_code == 409
    assert "1 mạch" in r.json()["detail"]
    assert Sub.objects.filter(slug="chung-khoan").exists()


def test_xoa_duoc_sub_rong(canh):
    _, mod = canh
    goi(mod, "post", "/api/admin/subs", {"slug": "sub-rong", "ten": "Rỗng"})
    r = goi(mod, "delete", "/api/admin/subs/sub-rong", None)
    assert r.status_code == 200 and r.json() == {"slug": "sub-rong", "da_xoa": True}
    assert not Sub.objects.filter(slug="sub-rong").exists()


def test_slug_KHONG_sua_duoc_qua_PATCH(canh):
    """Slug nằm trong URL công khai và trong `sitemap` — đổi nó phải kèm redirect 301.

    Bài đo ghim rằng nó không phải một ô trong form: gửi `slug` lên thì nó bị BỎ QUA, chứ
    không âm thầm đổi.
    """
    _, mod = canh
    r = goi(mod, "patch", "/api/admin/subs/chung-khoan", {"slug": "slug-moi"})
    assert r.status_code == 200
    assert r.json()["slug"] == "chung-khoan"
    assert not Sub.objects.filter(slug="slug-moi").exists()


# --- Thứ tự chuyên mục (kéo thả) --------------------------------------------
#
# `plans/2026-09-07-sap-xep-chuyen-muc-drag-drop.md`. Cửa này ghi lại **cả cột** `thu_tu`,
# nên thứ đáng đo không phải "có ghi không" mà là "có từ chối đúng chỗ không": một danh
# sách thiếu slug mà được nhận nghĩa là sub vắng mặt giữ số cũ rồi trộn vào dãy `0..n-1`
# vừa gán — bảng sắp sai trong khi lời gọi trả 200.


@pytest.fixture
def ba_sub(canh):
    """`chung-khoan` (từ `dung_du_lieu`) + `bitcoin` + `vang`, mỗi cái một `thu_tu` riêng.

    Tạo qua API để `thu_tu` đi đúng đường "sub mới đứng cuối" — thứ tự ban đầu vì thế là
    `chung-khoan(0), bitcoin(1), vang(2)`, tức **ngược alphabet ở hai hàng cuối**. Đó là
    chủ đích: một bộ dữ liệu alphabet sẵn không phân biệt được `order_by("thu_tu", "slug")`
    với `order_by("slug")` cũ.
    """
    _, mod = canh
    for slug, ten in (("vang", "Vàng"), ("bitcoin", "Bitcoin")):
        r = goi(mod, "post", "/api/admin/subs", {"slug": slug, "ten": ten})
        assert r.status_code == 201, r.content
    return mod


#: Một hoán vị hợp lệ của `ba_sub`, khác thứ tự ban đầu ở cả ba vị trí.
XAO = ["vang", "bitcoin", "chung-khoan"]


def test_dat_thu_tu_ghi_ca_cot_va_doi_ca_hai_cua_liet_ke(ba_sub, client):
    mod = ba_sub
    moi = ["vang", "chung-khoan", "bitcoin"]
    r = goi(mod, "put", "/api/admin/subs/thu-tu", {"slugs": moi})

    assert r.status_code == 200, r.content
    assert [s["slug"] for s in r.json()] == moi
    assert [s["thu_tu"] for s in r.json()] == [0, 1, 2]
    assert dict(Sub.objects.values_list("slug", "thu_tu")) == {
        "vang": 0,
        "chung-khoan": 1,
        "bitcoin": 2,
    }

    # Bảng quản trị và sidebar công khai phải nói CÙNG một thứ tự — hai khoá sắp khác nhau
    # nghĩa là mod kéo xong nhìn một đằng, khách nhìn một nẻo.
    assert [s["slug"] for s in mod.get("/api/admin/subs").json()] == moi
    assert [s["slug"] for s in client.get("/api/v1/subs").json()] == moi


def test_dat_thu_tu_ghi_dung_MOT_dong_nhat_ky(ba_sub):
    truoc = AuditLog.objects.count()
    goi(ba_sub, "put", "/api/admin/subs/thu-tu", {"slugs": XAO})

    assert AuditLog.objects.count() == truoc + 1, "một lượt kéo là MỘT hành động"
    dong = AuditLog.objects.latest("id")
    assert dong.action == "dat_thu_tu_sub"
    assert dong.target_id is None, "đích là cả bảng, không một hàng nào"
    assert dong.meta["slugs"] == XAO


@pytest.mark.parametrize(
    "slugs",
    [
        ["vang", "bitcoin"],
        ["vang", "bitcoin", "chung-khoan", "khong-co-that"],
        ["vang", "vang", "bitcoin", "chung-khoan"],
    ],
    ids=["thieu", "thua", "trung"],
)
def test_slugs_khong_phai_hoan_vi_day_du_tra_400_va_KHONG_ghi_gi(ba_sub, slugs):
    """Ba cách làm hỏng một hoán vị, và cả ba phải chết trước khi chạm DB.

    Đo cả `thu_tu` sau lời gọi chứ không chỉ status: bỏ phép kiểm tập hợp đi thì ca "thiếu"
    vẫn trả 200 và ghi `vang=0, bitcoin=1` trong khi `chung-khoan` giữ `0` — hai hàng cùng
    số, thứ tự do `slug` phá hoà, tức bảng sắp sai mà không cửa nào kêu.
    """
    truoc = dict(Sub.objects.values_list("slug", "thu_tu"))
    r = goi(ba_sub, "put", "/api/admin/subs/thu-tu", {"slugs": slugs})

    assert r.status_code == 400, r.content
    assert r.json()["code"] == "tham_so_khong_hop_le"
    assert dict(Sub.objects.values_list("slug", "thu_tu")) == truoc


def test_sub_moi_tao_dung_CUOI_chu_khong_chen_vao_giua(ba_sub):
    """Sau một lượt kéo, chuyên mục tạo tiếp phải nằm cuối — không nhảy lên đầu.

    Đây là chỗ `default=0` cắn: `Sub.objects.create` trần cho sub mới `thu_tu=0`, tức nó
    chen lên trước mọi thứ admin vừa sắp.
    """
    goi(ba_sub, "put", "/api/admin/subs/thu-tu", {"slugs": XAO})
    r = goi(
        ba_sub, "post", "/api/admin/subs", {"slug": "bat-dong-san", "ten": "Bất động sản"}
    )

    assert r.status_code == 201, r.content
    danh_sach = [s["slug"] for s in ba_sub.get("/api/admin/subs").json()]
    assert danh_sach == [*XAO, "bat-dong-san"]


# --- Chuyên mục lên trang chủ (giá sách) --------------------------------------
#
# `plans/2026-11-11-bai-viet-trang-chu-gia-sach.md` §1.1–1.3. "Tối đa 4" phải do DB ép chứ
# không chỉ endpoint, nên có hai tầng bài đo: ràng buộc trực tiếp trên model (bỏ qua API),
# rồi endpoint.


def _vi_tri() -> dict:
    return dict(Sub.objects.values_list("slug", "vi_tri_trang_chu"))


@pytest.fixture
def nam_sub(ba_sub):
    """`chung-khoan`, `vang`, `bitcoin` + hai sub nữa = năm sub, chưa sub nào lên trang chủ."""
    for slug in ("crypto", "ngoai-hoi"):
        r = goi(ba_sub, "post", "/api/admin/subs", {"slug": slug, "ten": slug})
        assert r.status_code == 201, r.content
    return ba_sub


@pytest.mark.parametrize("gia_tri", [0, 5])
def test_db_chan_vi_tri_ngoai_dai_1_den_4(canh, gia_tri):
    """CHECK ở tầng DB: `objects.update` đi vòng qua form/endpoint vẫn bị chặn."""
    from django.db import IntegrityError, transaction

    with pytest.raises(IntegrityError), transaction.atomic():
        Sub.objects.filter(slug="chung-khoan").update(vi_tri_trang_chu=gia_tri)
    assert _vi_tri() == {"chung-khoan": None}


def test_db_chan_hai_sub_cung_vi_tri_nhung_cho_nhieu_NULL(nam_sub):
    from django.db import IntegrityError, transaction

    # Năm sub cùng NULL đã hợp lệ (fixture đã tạo) — UNIQUE không coi NULL là trùng.
    assert set(_vi_tri().values()) == {None}
    Sub.objects.filter(slug="vang").update(vi_tri_trang_chu=2)
    with pytest.raises(IntegrityError), transaction.atomic():
        Sub.objects.filter(slug="bitcoin").update(vi_tri_trang_chu=2)


def test_dat_trang_chu_bon_sub_theo_thu_tu_va_ca_hai_cua_liet_ke_thay(nam_sub, client):
    moi = ["vang", "crypto", "chung-khoan", "bitcoin"]
    r = goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": moi})

    assert r.status_code == 200, r.content
    assert _vi_tri() == {
        "vang": 1,
        "crypto": 2,
        "chung-khoan": 3,
        "bitcoin": 4,
        "ngoai-hoi": None,
    }
    # Cả bảng được trả (theo `thu_tu`, không theo vị trí trang chủ), mỗi hàng mang vị trí.
    assert {s["slug"]: s["vi_tri_trang_chu"] for s in r.json()} == _vi_tri()
    # Hai cửa đọc khác cũng phải trả cùng con số.
    assert {
        s["slug"]: s["vi_tri_trang_chu"] for s in nam_sub.get("/api/admin/subs").json()
    } == _vi_tri()
    assert {
        s["slug"]: s["vi_tri_trang_chu"] for s in client.get("/api/v1/subs").json()
    } == _vi_tri()
    assert client.get("/api/v1/subs/vang").json()["vi_tri_trang_chu"] == 1
    assert client.get("/api/v1/subs/ngoai-hoi").json()["vi_tri_trang_chu"] is None


def test_hoan_doi_vi_tri_khong_vo_unique(nam_sub):
    """Đặt lại thứ tự khác, kể cả hoán đổi hai sub — gán thẳng sẽ giẫm UNIQUE giữa chừng."""
    goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": ["vang", "bitcoin"]})
    r = goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": ["bitcoin", "vang"]})
    assert r.status_code == 200, r.content
    assert _vi_tri()["bitcoin"] == 1 and _vi_tri()["vang"] == 2


def test_doi_tap_sub_thi_sub_bi_loai_ve_NULL(nam_sub):
    goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": ["vang", "bitcoin", "crypto"]})
    goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": ["crypto", "ngoai-hoi"]})
    assert _vi_tri() == {
        "crypto": 1,
        "ngoai-hoi": 2,
        "vang": None,
        "bitcoin": None,
        "chung-khoan": None,
    }


def test_danh_sach_rong_go_het(nam_sub):
    goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": ["vang", "bitcoin"]})
    r = goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": []})
    assert r.status_code == 200, r.content
    assert set(_vi_tri().values()) == {None}


@pytest.mark.parametrize(
    "slugs",
    [
        ["vang", "bitcoin", "crypto", "ngoai-hoi", "chung-khoan"],
        ["vang", "bitcoin", "vang"],
        ["vang", "khong-co-that"],
    ],
    ids=["nam_phan_tu", "trung", "slug_la"],
)
def test_trang_chu_tu_choi_dung_cho_va_KHONG_ghi_gi(nam_sub, slugs):
    goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": ["crypto", "ngoai-hoi"]})
    truoc = _vi_tri()
    so_log = AuditLog.objects.count()

    r = goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": slugs})

    assert r.status_code == 400, r.content
    assert r.json()["code"] == "tham_so_khong_hop_le"
    assert _vi_tri() == truoc, "400 mà vẫn ghi dở là mất giá sách đang chạy"
    assert AuditLog.objects.count() == so_log


def test_trang_chu_khong_phai_staff_bi_403(nam_sub):
    thuong = dang_nhap(dung_thuong())
    r = goi(thuong, "put", "/api/admin/subs/trang-chu", {"slugs": ["vang"]})
    assert r.status_code == 403
    assert set(_vi_tri().values()) == {None}


def test_trang_chu_chi_ghi_nhat_ky_khi_that_su_doi(nam_sub):
    so_log = AuditLog.objects.count()
    goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": ["vang", "crypto"]})
    assert AuditLog.objects.count() == so_log + 1
    dong = AuditLog.objects.latest("id")
    assert dong.action == "dat_trang_chu_sub"
    assert dong.target_id is None
    assert dong.meta == {"truoc": [], "sau": ["vang", "crypto"]}

    # Gửi lại đúng thế: 200, không dòng log mới.
    r = goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": ["vang", "crypto"]})
    assert r.status_code == 200
    assert AuditLog.objects.count() == so_log + 1

    goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": ["crypto", "vang"]})
    assert AuditLog.objects.count() == so_log + 2
    assert AuditLog.objects.latest("id").meta == {
        "truoc": ["vang", "crypto"],
        "sau": ["crypto", "vang"],
    }


def test_route_tinh_trang_chu_khong_bi_slug_nuot(nam_sub):
    """`PUT /subs/trang-chu` phải tới đúng handler — không phải 404/405 của `/{slug}`."""
    r = goi(nam_sub, "put", "/api/admin/subs/trang-chu", {"slugs": []})
    assert r.status_code == 200
    assert isinstance(r.json(), list)
    # Chiều ngược: path động vẫn sống sau khi route tĩnh chen vào.
    assert goi(nam_sub, "patch", "/api/admin/subs/vang", {"ten": "Vàng nhé"}).status_code == 200


# --- Ban / gỡ ban -----------------------------------------------------------


def test_ban_va_go_ban_di_tron_mot_vong(canh):
    dl, mod = canh
    ten = dl["tac_gia"].username

    r = goi(
        mod,
        "post",
        f"/api/admin/users/{ten}/ban",
        {"ly_do": "Phím hàng liên tục", "vinh_vien": True},
    )
    assert r.json() == {"da_doi": True, "dang_bat": True}

    ho_so = mod.get(f"/api/admin/users/{ten}").json()
    assert ho_so["dang_bi_ban"] is True
    assert ho_so["ban_reason"] == "Phím hàng liên tục"
    assert ho_so["so_mach"] == 1 and ho_so["so_binh_luan"] == 1

    r = goi(mod, "post", f"/api/admin/users/{ten}/go-ban", {})
    assert r.json() == {"da_doi": True, "dang_bat": False}
    assert goi(mod, "post", f"/api/admin/users/{ten}/go-ban", {}).json()["da_doi"] is False


def test_mod_khong_tu_ban_minh(canh):
    """Tự ban mình là tự khoá khỏi khu quản trị, và người duy nhất gỡ được là chính mình.

    **Chấm cả CÂU CHỮ, không chỉ status code** — và đó không phải chuyện thẩm mỹ. Người
    gọi luôn là staff (`ChiMod` đòi thế), nên nhánh "không tự ban mình" bị nhánh "không
    ban mod khác" bao trọn: gỡ nó đi thì vẫn 409 `xung_dot`, và một bài đo chỉ nhìn status
    sẽ **xanh nguyên** trong khi mod đọc được câu "không ban được một tài khoản quản trị
    khác" trên chính hàng của mình rồi đi tìm xem "khác" là ai. Đo bằng chuỗi là cách duy
    nhất phân biệt hai nhánh — đã kiểm bằng lượt thử phá (ca 14).
    """
    _, mod = canh
    r = goi(
        mod,
        "post",
        "/api/admin/users/mod_chinh/ban",
        {"ly_do": "nhầm", "vinh_vien": True},
    )
    assert r.status_code == 409 and r.json()["code"] == "xung_dot"
    assert "tự ban chính mình" in r.json()["detail"], r.json()
    assert User.objects.get(username="mod_chinh").dang_bi_ban() is False


def test_mod_khong_ban_duoc_mod_khac(canh):
    """Mọi mod ngang quyền nhau ở v1 ⇒ "mod A ban mod B" là cuộc chiến hai bên đều thắng."""
    _, mod = canh
    dung_mod("mod_phu")
    r = goi(
        mod,
        "post",
        "/api/admin/users/mod_phu/ban",
        {"ly_do": "lạm quyền", "vinh_vien": True},
    )
    assert r.status_code == 409 and r.json()["code"] == "xung_dot"
    assert User.objects.get(username="mod_phu").dang_bi_ban() is False


@pytest.mark.parametrize(
    "than",
    [
        {"ly_do": "x", "vinh_vien": True, "den_khi": "2099-01-01T00:00:00+07:00"},
        {"ly_do": "x", "vinh_vien": False},
        {"ly_do": "   ", "vinh_vien": True},
    ],
    ids=["ca-hai", "khong-cai-nao", "ly-do-rong"],
)
def test_ban_sai_hinh_dang_tra_400_va_khong_ghi_gi(canh, than):
    """`ValidationError` của đường ghi phải ra 400 `{detail, code}`, không phải 500."""
    _, mod = canh
    dung_thuong("nan_nhan")
    r = goi(mod, "post", "/api/admin/users/nan_nhan/ban", than)
    assert r.status_code == 400, r.content
    assert r.json()["code"] == "tham_so_khong_hop_le"
    assert User.objects.get(username="nan_nhan").dang_bi_ban() is False
