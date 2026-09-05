"""Ba bảng danh sách của khu quản trị — mạch · bình luận · người dùng (Phase 8).

Hai tính chất được đo kỹ nhất, vì cả hai hỏng im lặng:

1. **Bảng phải thấy nội dung đã bị gỡ.** Một bảng quản trị lọc mất mạch ẩn / bia mộ vẫn
   trả 200 và vẫn trông đầy đủ — nó chỉ mù đúng với thứ cần quản trị nhất.
2. **Keyset không trùng, không sót.** Bài đo phân trang chạy trên tập dữ liệu **có hàng
   trùng dấu thời gian**; không có ca đó thì vế thứ hai của điều kiện keyset
   (`truong = khi AND pk < id`) không bao giờ được chạm tới.
"""

from datetime import timedelta

import pytest
from django.utils import timezone

from core.ghi import (
    ban_user,
    dat_an_binh_luan,
    dat_an_mach,
    dat_khoa_mach,
    dong_so,
    tao_binh_luan,
    tao_mach,
    xoa_binh_luan,
)
from core.models import Comment, Mach, Sub, User

from tests._quan_tri import dang_nhap, dung_mod, dung_thuong

pytestmark = pytest.mark.django_db


@pytest.fixture
def canh(db):
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    tac_gia = User.objects.create(username="chu_mach", display_name="Chủ Mạch")
    mod_user = dung_mod()
    return {
        "sub": sub,
        "tac_gia": tac_gia,
        "mod_user": mod_user,
        "mod": dang_nhap(mod_user),
    }


def _mach(canh, title, **kw):
    mach, _ = tao_mach(
        sub=kw.pop("sub", canh["sub"]),
        author=kw.pop("author", canh["tac_gia"]),
        title=title,
        body=kw.pop("body", "thân bài gốc"),
    )
    return mach


# --- Bảng mạch --------------------------------------------------------------


def test_bang_mach_VAN_THAY_mach_da_bi_an(canh):
    """Chính là lý do bảng này tồn tại: mod gỡ ẩn được thứ mình vừa ẩn.

    Lọc `hidden_at__isnull=True` cho "sạch" ⇒ mạch bị ẩn biến khỏi mọi cửa, kể cả cửa
    duy nhất gỡ được nó. Bài này ĐỎ nếu ai đó thêm bộ lọc ấy.
    """
    bi_an = _mach(canh, "Mạch bị ẩn")
    dat_an_mach(mach=bi_an, boi=canh["mod_user"], an=True)
    _mach(canh, "Mạch thường")

    items = canh["mod"].get("/api/admin/machs").json()["items"]
    theo_title = {m["title"]: m for m in items}
    assert set(theo_title) == {"Mạch bị ẩn", "Mạch thường"}
    assert theo_title["Mạch bị ẩn"]["da_bi_an"] is True
    assert theo_title["Mạch thường"]["da_bi_an"] is False


def test_bo_loc_mach_thu_hep_dung_tap(canh):
    bi_an = _mach(canh, "Ẩn")
    dat_an_mach(mach=bi_an, boi=canh["mod_user"], an=True)
    bi_khoa = _mach(canh, "Khoá")
    dat_khoa_mach(mach=bi_khoa, boi=canh["mod_user"], khoa=True)
    da_dong = _mach(canh, "Đóng")
    dong_so(mach=da_dong)
    _mach(canh, "Mở")

    def title(qs):
        return {m["title"] for m in canh["mod"].get(qs).json()["items"]}

    # Bốn nhóm LOẠI TRỪ NHAU. **Bản đầu của bài đo này khẳng định `mo` trả về
    # `{"Ẩn", "Khoá", "Mở"}`** — tức nó ghim đúng cái lỗi mà người dùng bắt được ngày
    # 2026-08-23 ("lọc Đang mở vẫn hiện bài đã ẩn") và biến lỗi ấy thành hợp đồng. Test
    # xanh, tính năng sai, không có gì để ai nghi ngờ. Ghi lại vì đó mới là bài học, chứ
    # không phải dòng `status=MO` viết nhầm.
    assert title("/api/admin/machs?trang_thai=bi_an") == {"Ẩn"}
    assert title("/api/admin/machs?trang_thai=bi_khoa") == {"Khoá"}
    assert title("/api/admin/machs?trang_thai=dong") == {"Đóng"}
    assert title("/api/admin/machs?trang_thai=mo") == {"Mở"}
    assert len(title("/api/admin/machs")) == 4, "mặc định vẫn thấy TẤT CẢ, kể cả bài ẩn"

    # Bốn nhóm cộng lại đúng bằng tổng: không mạch nào rơi vào hai nhóm, không mạch nào
    # rơi ra ngoài. Đây là vế mà phép so từng nhóm ở trên không nói được.
    tong = sum(
        len(title(f"/api/admin/machs?trang_thai={t}"))
        for t in ("bi_an", "bi_khoa", "dong", "mo")
    )
    assert tong == 4


def test_chua_go_la_moi_bai_KHONG_bi_an(canh):
    """`chua_go` = `bi_khoa + dong + mo`, và nó **cố ý chồng lấn** ba nhóm ấy.

    Đây là bộ lọc MẶC ĐỊNH của `/machs` trên giao diện. Bản trước lấy `mo` làm mặc định,
    và đó là lỗi trục: `mo` nói *"tác giả chưa đóng sổ"*, không nói *"bài chưa bị gỡ"*.
    Hệ quả là mọi mạch **đã đóng sổ** và **bị khoá** biến khỏi màn hình đầu tiên của mod
    dù chúng đang hiển thị bình thường trên site — người dùng bắt được 2026-08-24 (một
    bài `status=closed`, không ẩn không khoá, vắng mặt ở trang 1 mà tìm thì lại ra).

    Đóng sổ là kết thúc bình thường do chính tác giả bấm, không phải phán quyết của mod.
    """
    bi_an = _mach(canh, "Ẩn")
    dat_an_mach(mach=bi_an, boi=canh["mod_user"], an=True)
    bi_khoa = _mach(canh, "Khoá")
    dat_khoa_mach(mach=bi_khoa, boi=canh["mod_user"], khoa=True)
    da_dong = _mach(canh, "Đóng")
    dong_so(mach=da_dong)
    _mach(canh, "Mở")

    def title(qs):
        return {m["title"] for m in canh["mod"].get(qs).json()["items"]}

    assert title("/api/admin/machs?trang_thai=chua_go") == {"Khoá", "Đóng", "Mở"}

    # Ca ĐẶC TRƯNG của lỗi đã sửa: mạch chỉ khác `mo` ở trục sổ. Không có dòng này thì
    # một bản cài `chua_go = Q(status=MO, hidden_at__isnull=True)` vẫn xanh — nó chỉ
    # thiếu đúng "Đóng" và "Khoá", mà phép so tập ở trên lại đang đo cả hai... nên dòng
    # này là để nói THẲNG ra ca ấy, cho người đọc sau thấy nó chứ không phải suy ra.
    assert "Đóng" in title("/api/admin/machs?trang_thai=chua_go")
    assert "Đóng" not in title("/api/admin/machs?trang_thai=mo")

    # Và nó KHÔNG được là "tất cả": bài ẩn phải ở ngoài, nếu không mặc định vô nghĩa.
    assert "Ẩn" not in title("/api/admin/machs?trang_thai=chua_go")


def test_chua_go_KHONG_lot_vao_vanh_khuyen(canh):
    """Vành khuyên đọc `LOC_MACH` (bốn nhóm RỜI NHAU); bảng đọc `LOC_MACH_DANH_SACH`.

    Trộn hai cái làm một là vành khuyên có một lát chồng lấn ⇒ **cộng lại quá 100%**, và
    một biểu đồ tỉ trọng sai kiểu đó trông vẫn hoàn toàn bình thường.
    """
    from api.quan_tri_loc import LOC_MACH, LOC_MACH_DANH_SACH

    assert "chua_go" not in LOC_MACH
    assert "chua_go" in LOC_MACH_DANH_SACH
    # `hen_gio` (2026-09-03) là lát chồng lấn THỨ HAI — nó nằm lọt trong `bi_an` (bài hẹn
    # giờ được lưu như bài đang ẩn). Cùng lý do với `chua_go`, nó phải ở ngoài vành khuyên.
    assert set(LOC_MACH_DANH_SACH) - set(LOC_MACH) == {"chua_go", "hen_gio"}

    # Và chuông thật: vành khuyên trên bảng điều khiển vẫn đúng BỐN lát, không có
    # `chua_go`, và bốn lát ấy vẫn cộng đúng bằng tổng số mạch.
    tk = canh["mod"].get("/api/admin/thong-ke").json()
    lat = tk["theo_trang_thai"]
    assert set(lat) == {"bi_an", "bi_khoa", "dong", "mo"}
    assert sum(lat.values()) == tk["tong"]["mach"]


def test_loc_mach_theo_q_sub_tac_gia(canh):
    khac = Sub.objects.create(slug="crypto", ten="Crypto")
    nguoi_khac = User.objects.create(username="nguoi_khac", display_name="Khác")
    _mach(canh, "Nhật ký lệnh HPG")
    _mach(canh, "Nhật ký lệnh VNM", sub=khac)
    _mach(canh, "Bài của người khác", author=nguoi_khac)

    def title(qs):
        return {m["title"] for m in canh["mod"].get(qs).json()["items"]}

    assert title("/api/admin/machs?q=hpg") == {"Nhật ký lệnh HPG"}, "phải không phân biệt hoa thường"
    assert title("/api/admin/machs?sub=crypto") == {"Nhật ký lệnh VNM"}
    assert title("/api/admin/machs?tac_gia=nguoi_khac") == {"Bài của người khác"}


def test_keyset_khong_trung_khong_sot_ke_ca_khi_trung_dau_thoi_gian(canh):
    """Phân trang trên 7 mạch **cùng `created_at`** — ca duy nhất chạm vế thứ hai của keyset.

    Không có ca trùng dấu thời gian thì `truong = khi AND pk < id` không bao giờ chạy, và
    một bản cài chỉ dùng `created_at < khi` sẽ xanh ở đây trong khi ngoài đời nó **mất
    trắng** mọi hàng cùng giây với hàng cuối trang.
    """
    khi = timezone.now() - timedelta(days=1)
    for i in range(7):
        m = _mach(canh, f"Mạch {i}")
        Mach.objects.filter(pk=m.pk).update(created_at=khi)

    thay = []
    cursor = None
    for _ in range(5):
        url = "/api/admin/machs?limit=3" + (f"&cursor={cursor}" if cursor else "")
        trang = canh["mod"].get(url).json()
        thay += [m["id"] for m in trang["items"]]
        cursor = trang["cursor_ke_tiep"]
        if cursor is None:
            break

    assert cursor is None, "phải đi hết trong 5 vòng"
    assert len(thay) == 7 and len(set(thay)) == 7, f"trùng hoặc sót: {thay}"
    assert set(thay) == set(Mach.objects.values_list("pk", flat=True))


def test_cursor_hong_tra_400_khong_phai_500(canh):
    r = canh["mod"].get("/api/admin/machs?cursor=khong-phai-base64")
    assert r.status_code == 400
    assert r.json()["code"] == "cursor_khong_hop_le"


def test_limit_qua_lon_bi_chan(canh):
    r = canh["mod"].get("/api/admin/machs?limit=100000")
    assert r.status_code == 400
    assert r.json()["code"] == "tham_so_khong_hop_le"


# --- Bảng bình luận ---------------------------------------------------------


def test_bang_binh_luan_thay_ca_bia_mo_va_binh_luan_bi_an(canh):
    """Bia mộ giữ `body` trong DB (PLAN 5.3) — mod đọc được đúng thứ vừa bị rút lại."""
    mach = _mach(canh, "Mạch")
    thuong = tao_binh_luan(mach=mach, author=canh["tac_gia"], body="Bình luận thường")
    bi_an = tao_binh_luan(mach=mach, author=canh["tac_gia"], body="Bình luận bị ẩn")
    dat_an_binh_luan(comment=bi_an, boi=canh["mod_user"], an=True)
    cha = tao_binh_luan(mach=mach, author=canh["tac_gia"], body="Sắp thành bia mộ")
    tao_binh_luan(mach=mach, author=canh["tac_gia"], body="reply giữ chỗ", parent=cha)
    xoa_binh_luan(comment=cha)
    cha.refresh_from_db()
    assert cha.deleted_at is not None, "tiền đề: phải là bia mộ, không phải xoá thật"

    items = canh["mod"].get("/api/admin/comments").json()["items"]
    theo_id = {c["id"]: c for c in items}

    assert theo_id[bi_an.pk]["da_bi_an"] is True
    assert theo_id[bi_an.pk]["trich_yeu"] == "Bình luận bị ẩn", "mod phải ĐỌC được nội dung đã ẩn"
    assert theo_id[cha.pk]["da_xoa"] is True
    assert theo_id[cha.pk]["trich_yeu"] == "Sắp thành bia mộ"
    assert theo_id[thuong.pk]["da_bi_an"] is False


def test_loc_binh_luan_hien_la_HAI_cot_khong_phai_mot(canh):
    """`hien` = chưa xoá **và** chưa bị ẩn. Quên một vế là lọt đúng thứ đang bị che."""
    mach = _mach(canh, "Mạch")
    song = tao_binh_luan(mach=mach, author=canh["tac_gia"], body="Còn sống")
    bi_an = tao_binh_luan(mach=mach, author=canh["tac_gia"], body="Bị ẩn")
    dat_an_binh_luan(comment=bi_an, boi=canh["mod_user"], an=True)

    items = canh["mod"].get("/api/admin/comments?trang_thai=hien").json()["items"]
    assert [c["id"] for c in items] == [song.pk]


def test_loc_binh_luan_theo_mach_va_tac_gia(canh):
    nguoi_khac = User.objects.create(username="nguoi_khac", display_name="Khác")
    m1 = _mach(canh, "Mạch 1")
    m2 = _mach(canh, "Mạch 2")
    a = tao_binh_luan(mach=m1, author=canh["tac_gia"], body="ở mạch 1")
    b = tao_binh_luan(mach=m2, author=nguoi_khac, body="ở mạch 2")

    mod = canh["mod"]
    assert [c["id"] for c in mod.get(f"/api/admin/comments?mach_id={m1.pk}").json()["items"]] == [a.pk]
    assert [
        c["id"] for c in mod.get("/api/admin/comments?tac_gia=nguoi_khac").json()["items"]
    ] == [b.pk]
    assert [c["id"] for c in mod.get("/api/admin/comments?q=mạch 2").json()["items"]] == [b.pk]


def test_binh_luan_cua_mach_bi_an_van_liet_ke_duoc(canh):
    """Mạch bị ẩn kéo theo cả khán đài biến khỏi cửa công khai — nhưng không khỏi cửa mod."""
    mach = _mach(canh, "Mạch sắp ẩn")
    c = tao_binh_luan(mach=mach, author=canh["tac_gia"], body="nằm trong mạch bị ẩn")
    dat_an_mach(mach=mach, boi=canh["mod_user"], an=True)

    items = canh["mod"].get("/api/admin/comments").json()["items"]
    assert [x["id"] for x in items] == [c.pk]


# --- Bảng người dùng --------------------------------------------------------


def test_loc_bi_ban_trung_voi_dang_bi_ban(canh):
    """Điều kiện lọc SQL là bản sao thứ hai của `User.dang_bi_ban()` — ghim hai bên khớp.

    Ba ca, và ca thứ ba là ca dễ mất nhất: **ban tạm đã hết hạn** thì `banned_until` vẫn
    khác `NULL`, nên một bộ lọc `banned_until__isnull=False` sẽ trả về người đã hết hạn
    ban. Người đó không bị ban nữa, và mod nhìn bảng sẽ tưởng ngược lại.
    """
    vinh_vien = dung_thuong("bi_ban_vinh_vien")
    ban_user(user=vinh_vien, boi=canh["mod_user"], vinh_vien=True, ly_do="phím hàng")
    tam = dung_thuong("bi_ban_tam")
    ban_user(
        user=tam,
        boi=canh["mod_user"],
        vinh_vien=False,
        den_khi=timezone.now() + timedelta(days=3),
        ly_do="spam",
    )
    het_han = dung_thuong("ban_da_het_han")
    User.objects.filter(pk=het_han.pk).update(
        banned_until=timezone.now() - timedelta(days=1), ban_reason="cũ"
    )
    dung_thuong("sach_se")

    items = canh["mod"].get("/api/admin/users?trang_thai=bi_ban").json()["items"]
    theo_bo_loc = {u["username"] for u in items}

    tu_model = {
        u.username for u in User.objects.all() if u.dang_bi_ban()
    }
    assert theo_bo_loc == tu_model
    assert theo_bo_loc == {"bi_ban_vinh_vien", "bi_ban_tam"}
    assert "ban_da_het_han" not in theo_bo_loc


def test_loc_staff_va_moi(canh):
    cu = dung_thuong("tai_khoan_cu")
    User.objects.filter(pk=cu.pk).update(date_joined=timezone.now() - timedelta(days=30))
    dung_thuong("tai_khoan_moi")

    mod = canh["mod"]
    staff = {u["username"] for u in mod.get("/api/admin/users?trang_thai=staff").json()["items"]}
    assert staff == {"mod_chinh"}

    moi = {u["username"] for u in mod.get("/api/admin/users?trang_thai=moi").json()["items"]}
    assert "tai_khoan_moi" in moi and "tai_khoan_cu" not in moi


def test_dem_so_mach_va_binh_luan_khong_nhan_cheo(canh):
    """Hai `Count` + hai LEFT JOIN trong một câu ⇒ thiếu `distinct` là nhân chéo.

    3 mạch × 4 bình luận sẽ ra `so_mach = 12`. Con số đó không nổ ở đâu cả — nó chỉ làm
    mod tin rằng mình đang nhìn một tài khoản spam.
    """
    mach = _mach(canh, "Mạch A")
    _mach(canh, "Mạch B")
    _mach(canh, "Mạch C")
    for i in range(4):
        tao_binh_luan(mach=mach, author=canh["tac_gia"], body=f"bl {i}")

    items = canh["mod"].get("/api/admin/users").json()["items"]
    chu = next(u for u in items if u["username"] == "chu_mach")
    assert chu["so_mach"] == 3
    # 3 mốc-1 + 4 bình luận: `tao_mach` không tạo bình luận nào, nên đúng 4.
    assert chu["so_binh_luan"] == 4
    assert Comment.objects.filter(author=canh["tac_gia"]).count() == 4


def test_tim_theo_username_hoac_display_name(canh):
    User.objects.create(username="ba_muoi_phien", display_name="Bác Gấu Hà Nội")
    mod = canh["mod"]

    theo_username = {u["username"] for u in mod.get("/api/admin/users?q=muoi").json()["items"]}
    assert theo_username == {"ba_muoi_phien"}

    theo_ten = {u["username"] for u in mod.get("/api/admin/users?q=gấu").json()["items"]}
    assert theo_ten == {"ba_muoi_phien"}


def test_ba_bang_deu_khong_cache(canh):
    for url in ("/api/admin/machs", "/api/admin/comments", "/api/admin/users"):
        assert canh["mod"].get(url)["Cache-Control"] == "no-store", url


def test_so_lieu_bang_dieu_khien_khop_bang_danh_sach(canh):
    """Vành khuyên trên bảng điều khiển và bộ lọc của bảng bài viết **không được lệch**.

    Hai màn hình, một chữ: mod nhìn thấy "Đang mở: 1" rồi bấm sang danh sách lọc "Đang
    mở" — ra hai con số khác nhau là một trong hai đang nói dối, và không có cách nào
    biết cái nào. Cả hai nay đọc chung `api/quan_tri_loc.py::LOC_MACH`; bài đo này là thứ
    giữ cho ngày mai không ai chép một bản thứ hai.
    """
    boi = canh["mod_user"]
    bi_an = _mach(canh, "Ẩn")
    dat_an_mach(mach=bi_an, boi=boi, an=True)
    bi_khoa = _mach(canh, "Khoá")
    dat_khoa_mach(mach=bi_khoa, boi=boi, khoa=True)
    da_dong = _mach(canh, "Đóng")
    dong_so(mach=da_dong)
    _mach(canh, "Mở")
    # Ca chồng lấn — mạch dính CẢ BA trục. Không có nó thì bốn nhóm rời nhau sẵn và phép
    # so dưới đây đúng kể cả với một bản cài sai.
    ba_thu = _mach(canh, "Đóng + khoá + ẩn")
    dong_so(mach=ba_thu)
    dat_khoa_mach(mach=ba_thu, boi=boi, khoa=True)
    dat_an_mach(mach=ba_thu, boi=boi, an=True)

    tt = canh["mod"].get("/api/admin/thong-ke").json()["theo_trang_thai"]
    for nhom, so in tt.items():
        items = canh["mod"].get(f"/api/admin/machs?trang_thai={nhom}").json()["items"]
        assert len(items) == so, f"nhóm {nhom}: bảng điều khiển nói {so}, danh sách ra {len(items)}"

    assert tt == {"bi_an": 2, "bi_khoa": 1, "dong": 1, "mo": 1}
    assert sum(tt.values()) == Mach.objects.count() == 5
