"""`tong` — tổng số hàng của tập đã lọc, cho thanh phân trang khu quản trị.

Thêm 2026-08-24 theo báo lỗi *"admin, phần bài viết (có thể các list khác) chưa có phân
trang"*. Trước đó frontend chỉ có nút "Tải thêm", và với bộ lọc mặc định của `/machs`
(24 dòng, `limit: 25`) thì `cursor_ke_tiep` là `null` nên **không hiện gì cả** — bảng cụt
ngang, không có gì nói cho biết đó là hết hay là còn.

## Bài đo nào là bài đo THẬT ở đây

`test_tong_khop_so_hang_that` một mình gần như vô dụng: nó xanh với cả bản cài sai, miễn
tập dữ liệu nhỏ hơn một trang. Hai bài dưới đây mới chạm được cái bẫy:

- **`test_tong_khong_doi_qua_cac_trang`** — gọi `dem_tong` SAU `loc_keyset` là lỗi tự
  nhiên nhất khi thêm tính năng này (cứ đặt dòng đếm cạnh dòng `hang = list(...)` cho
  gọn). Lúc đó `tong` đếm *phần còn lại từ cursor trở đi*: 60 → 40 → 20. Không có gì nổ,
  không có log — chỉ là một con số tụt dần mà người đọc sẽ tin, vì nó trông y hệt số thật.
- **`test_tong_theo_bo_loc`** — đếm trên queryset gốc thay vì queryset đã lọc cũng là một
  dòng code trông hợp lý, và nó làm mọi bộ lọc báo cùng một tổng.
"""

import pytest

from core.ghi import dat_an_mach, tao_binh_luan, tao_mach
from core.models import Sub, User

from tests._quan_tri import dang_nhap, dung_mod

pytestmark = pytest.mark.django_db

#: Nhiều hơn `limit` dùng bên dưới vài lần, để có ÍT NHẤT ba trang. Hai trang là không
#: đủ: với hai trang, "đếm sau keyset" và "đếm đúng" chỉ khác nhau ở trang cuối, và một
#: bài đo chỉ nhìn trang đầu sẽ xanh.
SO_MACH = 25
LIMIT = 10


@pytest.fixture
def canh(db):
    sub = Sub.objects.create(slug="chung-khoan", ten="Chứng khoán")
    tac_gia = User.objects.create(username="chu_mach", display_name="Chủ Mạch")
    machs = [
        tao_mach(sub=sub, author=tac_gia, title=f"Mạch {i:02d}", body="x")[0]
        for i in range(SO_MACH)
    ]
    mod_user = dung_mod()
    return {
        "sub": sub,
        "tac_gia": tac_gia,
        "machs": machs,
        "mod_user": mod_user,
        "mod": dang_nhap(mod_user),
    }


def lat_het(client, duong_dan: str) -> list[dict]:
    """Lật hết mọi trang, trả về danh sách body JSON của từng trang.

    Có trần vòng lặp: một cursor đứng yên (bản cài sai làm `cursor_ke_tiep` không tiến)
    biến bài đo thành vòng lặp vô tận, mà một bài đo treo trông giống hệt CI chậm.
    """
    trang, cursor = [], None
    for _ in range(50):
        noi = f"{duong_dan}&cursor={cursor}" if cursor else duong_dan
        r = client.get(noi)
        assert r.status_code == 200, r.content
        body = r.json()
        trang.append(body)
        cursor = body["cursor_ke_tiep"]
        if cursor is None:
            return trang
    raise AssertionError("Lật quá 50 trang — cursor không tiến?")


def test_tong_khop_so_hang_that(canh):
    r = canh["mod"].get(f"/api/admin/machs?trang_thai=tat_ca&limit={LIMIT}")
    assert r.status_code == 200
    assert r.json()["tong"] == SO_MACH


def test_tong_khong_doi_qua_cac_trang(canh):
    """Cái bẫy chính: `tong` phải là tổng của CẢ tập, không phải phần còn lại."""
    trang = lat_het(canh["mod"], f"/api/admin/machs?trang_thai=tat_ca&limit={LIMIT}")

    assert len(trang) >= 3, "Cần ít nhất 3 trang thì bài đo này mới có nghĩa"
    assert [t["tong"] for t in trang] == [SO_MACH] * len(trang)
    # Và tổng ấy phải đúng bằng số hàng thật lật ra được — nếu không thì `tong` chỉ là
    # một hằng số cố định trùng hợp.
    assert sum(len(t["items"]) for t in trang) == SO_MACH


def test_tong_theo_bo_loc(canh):
    """Ẩn 4 mạch ⇒ `mo` giảm đúng 4, `bi_an` bằng đúng 4, và bốn nhóm cộng lại vẫn đủ."""
    for m in canh["machs"][:4]:
        dat_an_mach(mach=m, an=True, boi=canh["mod_user"])

    def tong(trang_thai: str) -> int:
        r = canh["mod"].get(f"/api/admin/machs?trang_thai={trang_thai}&limit={LIMIT}")
        assert r.status_code == 200
        return r.json()["tong"]

    assert tong("bi_an") == 4
    assert tong("mo") == SO_MACH - 4
    assert tong("tat_ca") == SO_MACH
    assert tong("mo") + tong("dong") + tong("bi_khoa") + tong("bi_an") == SO_MACH


def test_tong_cua_bang_binh_luan_va_nguoi_dung(canh):
    """Hai bảng còn lại của Phase 8 — cùng luật, nên cùng bị đo."""
    for i in range(12):
        tao_binh_luan(mach=canh["machs"][0], author=canh["tac_gia"], body=f"b{i}")

    trang = lat_het(canh["mod"], f"/api/admin/comments?limit={LIMIT}")
    assert [t["tong"] for t in trang] == [12] * len(trang)
    assert sum(len(t["items"]) for t in trang) == 12

    # 2 tài khoản tồn tại (`chu_mach` + `mod_chinh`), nhưng bảng chỉ đếm **1**: từ
    # 2026-08-26 bộ lọc `tat_ca` loại hẳn `is_staff=True`, và `mod_chinh` là staff. Con
    # số đổi vì HÀNH VI đổi, không phải vì assert được nới — nên `so_staff_an` bị ghim
    # ngay bên cạnh, và nó là thứ giữ cho phép loại phải xảy ra TRƯỚC `dem_tong`: đếm
    # trước rồi mới loại thì `tong` ra lại 2 và dòng này đỏ.
    r = canh["mod"].get(f"/api/admin/users?limit={LIMIT}")
    assert r.json()["tong"] == 1
    assert r.json()["so_staff_an"] == 1
    assert len(r.json()["items"]) == 1
    assert User.objects.count() == 2


def test_tong_cua_hang_doi_va_nhat_ky(canh):
    """`/reports` và `/nhat-ky` dùng chung `dem_tong` — đo để không ai quên chúng."""
    dat_an_mach(mach=canh["machs"][0], an=True, boi=canh["mod_user"])

    r = canh["mod"].get(f"/api/admin/nhat-ky?limit={LIMIT}")
    assert r.status_code == 200
    assert r.json()["tong"] == len(r.json()["items"]) >= 1

    r = canh["mod"].get(f"/api/admin/reports?limit={LIMIT}")
    assert r.status_code == 200
    assert r.json()["tong"] == 0


def test_tong_bang_khong_khi_khong_co_gi(canh):
    """`tong = 0` là tín hiệu frontend dùng để GIẤU hẳn thanh phân trang."""
    r = canh["mod"].get(f"/api/admin/machs?q=khong-ton-tai-dau-ca&limit={LIMIT}")
    assert r.status_code == 200
    assert r.json() == {"items": [], "cursor_ke_tiep": None, "tong": 0}
