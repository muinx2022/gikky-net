"""CRUD chuyên mục + ban/gỡ ban tài khoản — PLAN 9.3 mục 3, PLAN 5.10.

Hai nhóm nằm chung một file vì chúng có chung hình dạng bài đo: một đường thuận, rồi ba
đường **từ chối** mà mỗi cái đóng một cửa hỏng cụ thể. Chính những đường từ chối mới là
nội dung của file này — đường thuận thì `test_api_quan_tri_phan_quyen.py` đã chạm qua.
"""

import pytest

from core.models import Sub, User

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
