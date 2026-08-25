"""Ba cửa danh sách của trang hồ sơ — `api/ho_so.py`, plan `2026-08-24` phần A.

Tên file có hậu tố `_danh_sach` vì `test_api_ho_so.py` **đã có chủ**: đó là bộ đo của
`GET /users/{username}` (`api/users.py`) — bốn con số đếm và rào 3 của PLAN 5.6. Hai bộ
đo hai endpoint khác nhau; gộp vào một file là để lần sau ai đó sửa luật đếm `duoc_trich`
phải cuộn qua chuyện phân trang.

## Nhóm bài đo quan trọng nhất nằm ở giữa file: LỖ RÒ NỘI DUNG

Ba cửa này không bắt đầu từ `Mach`; chúng bắt đầu từ `Vote`, từ `Follow`, từ `author` rồi
đi ngược về mạch. Mỗi đường vòng là một chỗ luật che của PLAN 5.10 có thể bị bỏ quên, và
lỗ rò kiểu đó trả **HTTP 200** — không status lạ, không log, không gì đỏ. Vì thế mỗi cửa
có một bài đo hai vế: mod ẩn mạch → mạch **rời khỏi danh sách**, và **không một chuỗi nào**
của nó còn sót trong response (`moi_chuoi`, không chỉ soi trường `id`).

## Vì sao ba bài đo thứ tự lại đáng có riêng

Khoá keyset của hai cửa `/me/*` là `Vote.created_at` / `Follow.created_at` — thời điểm
TÔI vote/theo — chứ không phải `Mach.created_at`. Hai khoá ấy cho **cùng một kết quả** khi
người ta vote đúng theo thứ tự mạch ra đời, tức là ở gần hết mọi dữ liệu dựng ẩu. Ba bài
đo dưới đây cố tình dựng mạch theo một thứ tự rồi vote theo thứ tự **ngược lại**, nên đổi
khoá sang `Mach.created_at` là đỏ ngay.

## Ca "mạch đã xoá" khác nhau ở hai cửa, và đó không phải chuyện thừa

`Mach` **không có `deleted_at`** — xoá là `DELETE` thật. `Follow.mach` là FK `CASCADE` nên
hàng theo dõi đi theo mạch; `Vote` thì **không có FK** (`target_type` + `target_id`), nên
phiếu nằm lại vĩnh viễn. Bài `test_mach_bi_xoa_that...` là bài đo cho hàng mồ côi ấy: nó
hỏi cả "còn hiện không" lẫn "có 500 không", vì một `KeyError` ở đường ghép phiếu → mạch là
500 trên trang hồ sơ của chính người đã vote.
"""

import pytest

from core.ghi import dat_an_mach, dat_vote, tao_binh_luan, tao_mach, them_moc
from core.models.dien_dan import Mach
from core.models.moc import Moc
from core.models.tuong_tac import Follow

from .conftest import dung_user, lay, moi_chuoi

pytestmark = pytest.mark.django_db

DA_VOTE = "/api/v1/me/da-vote"
DANG_THEO = "/api/v1/me/dang-theo"

#: Tiêu đề của mạch bị ẩn — chuỗi đủ lạ để `moi_chuoi` tìm ra nếu nó lọt vào bất kỳ tầng
#: nào của response, kể cả trong `xem_truoc` chứ không riêng trường `title`.
TIEU_DE_BI_AN = "Mạch này mod vừa gỡ, không cửa nào được trả nó ra"
THAN_BI_AN = "Thân mốc 1 của mạch mod vừa gỡ — chuỗi mồi cho phép quét"


def _mach_cua(sub, author, title: str, body: str = "Mốc 1.") -> Mach:
    m, _ = tao_mach(sub=sub, author=author, title=title, body=body)
    return m


def _moc_1(mach) -> Moc:
    return Moc.objects.get(mach=mach, seq=1)


def _ids(d) -> list[int]:
    return [t["id"] for t in d["items"]]


def _an(mach, boi) -> None:
    dat_an_mach(mach=mach, boi=boi, an=True, ly_do="test lỗ rò")


@pytest.fixture
def mod(db):
    return dung_user("mod_test", "Mod")


@pytest.fixture
def ba_mach(sub, tac_gia) -> list[Mach]:
    """Ba mạch của cùng một người, dựng theo thứ tự A → B → C (A cũ nhất).

    Ba chứ không một: `assertNumQueries` trên một mạch là ghim một hằng số vô nghĩa
    (N+1 với N = 1 trông y hệt không N+1), và mọi bài đo thứ tự đều cần ≥ 3 phần tử để
    phân biệt "đảo ngược" với "sắp đúng".
    """
    return [_mach_cua(sub, tac_gia, f"Mạch {t}") for t in ("A", "B", "C")]


# --- /users/{username}/machs -------------------------------------------------


def test_liet_ke_mach_cua_user_moi_dang_truoc(client, ba_mach, tac_gia):
    d = lay(client, f"/api/v1/users/{tac_gia.username}/machs")
    assert _ids(d) == [ba_mach[2].pk, ba_mach[1].pk, ba_mach[0].pk]
    assert d["cursor_ke_tiep"] is None


def test_chi_tra_mach_cua_dung_nguoi_do(client, ba_mach, sub, nguoi_khac, tac_gia):
    cua_nguoi_khac = _mach_cua(sub, nguoi_khac, "Mạch của người khác")

    d = lay(client, f"/api/v1/users/{tac_gia.username}/machs")

    assert cua_nguoi_khac.pk not in _ids(d)
    assert _ids(lay(client, f"/api/v1/users/{nguoi_khac.username}/machs")) == [
        cua_nguoi_khac.pk
    ]


def test_username_khong_ton_tai_la_404_chu_khong_phai_danh_sach_rong(client, db):
    """Rỗng và 404 trông giống nhau trên màn hình — một chữ gõ nhầm trong URL không được
    thành "người này chưa viết gì"."""
    r = client.get("/api/v1/users/khong-he-ton-tai/machs")
    assert r.status_code == 404 and r.json()["code"] == "khong_tim_thay"


def test_nguoi_chua_viet_gi_tra_danh_sach_rong(client, nguoi_khac):
    d = lay(client, f"/api/v1/users/{nguoi_khac.username}/machs")
    assert d["items"] == [] and d["cursor_ke_tiep"] is None


def test_cursor_lat_het_ba_trang_khong_trung_khong_sot(client, ba_mach, tac_gia):
    duong = f"/api/v1/users/{tac_gia.username}/machs?limit=2"
    trang_1 = lay(client, duong)
    assert len(trang_1["items"]) == 2 and trang_1["cursor_ke_tiep"]

    trang_2 = lay(client, f"{duong}&cursor={trang_1['cursor_ke_tiep']}")

    assert _ids(trang_1) + _ids(trang_2) == [m.pk for m in reversed(ba_mach)]
    assert trang_2["cursor_ke_tiep"] is None


def test_limit_ngoai_khoang_la_400(client, tac_gia):
    r = client.get(f"/api/v1/users/{tac_gia.username}/machs?limit=51")
    assert r.status_code == 400 and r.json()["code"] == "tham_so_khong_hop_le"


def test_cursor_rac_la_400_chu_khong_phai_trang_1(client, tac_gia):
    r = client.get(f"/api/v1/users/{tac_gia.username}/machs?cursor=rac~~")
    assert r.status_code == 400 and r.json()["code"] == "cursor_khong_hop_le"


# --- LỖ RÒ NỘI DUNG: cả ba cửa ----------------------------------------------


def test_mach_bi_mod_an_khong_lot_ra_cua_bai_viet(client, sub, tac_gia, mod):
    mach = _mach_cua(sub, tac_gia, TIEU_DE_BI_AN, THAN_BI_AN)
    _an(mach, mod)

    d = lay(client, f"/api/v1/users/{tac_gia.username}/machs")

    assert _ids(d) == []
    assert TIEU_DE_BI_AN not in moi_chuoi(d) and THAN_BI_AN not in moi_chuoi(d)


def test_mach_bi_mod_an_khong_lot_ra_cua_da_vote(client, sub, tac_gia, nguoi_khac, mod):
    """Bài đo quan trọng nhất của phần A, vế `Vote`.

    Vote là một đường vòng: người vote đọc mạch qua hàng `Vote` của chính họ, nên nếu cửa
    này quên lọc thì mod ẩn một mạch mà người đã vote vẫn đọc được nguyên tiêu đề và
    nguyên trích đoạn mốc 1 — vô thời hạn, và HTTP 200.
    """
    mach = _mach_cua(sub, tac_gia, TIEU_DE_BI_AN, THAN_BI_AN)
    dat_vote(user=nguoi_khac, target=_moc_1(mach), value=1)
    client.force_login(nguoi_khac)
    assert _ids(lay(client, DA_VOTE)) == [mach.pk], "chưa ẩn thì phải thấy"

    _an(mach, mod)

    d = lay(client, DA_VOTE)
    assert _ids(d) == []
    assert TIEU_DE_BI_AN not in moi_chuoi(d) and THAN_BI_AN not in moi_chuoi(d)


def test_mach_bi_mod_an_khong_lot_ra_cua_dang_theo(client, sub, tac_gia, nguoi_khac, mod):
    """Cùng bài trên, vế `Follow` — đường vòng thứ hai, luật che phải áp lại lần nữa."""
    mach = _mach_cua(sub, tac_gia, TIEU_DE_BI_AN, THAN_BI_AN)
    Follow.objects.create(user=nguoi_khac, mach=mach)
    client.force_login(nguoi_khac)
    assert _ids(lay(client, DANG_THEO)) == [mach.pk], "chưa ẩn thì phải thấy"

    _an(mach, mod)

    d = lay(client, DANG_THEO)
    assert _ids(d) == []
    assert TIEU_DE_BI_AN not in moi_chuoi(d) and THAN_BI_AN not in moi_chuoi(d)


def test_mach_bi_xoa_that_thi_da_vote_khong_con_va_khong_500(
    client, sub, tac_gia, nguoi_khac
):
    """Hàng `Vote` mồ côi: `Vote` không có FK nên phiếu sống sót sau `Mach.delete()`.

    Hai khẳng định, và vế thứ hai mới là vế dễ hỏng: ghép phiếu → mạch bằng một `dict`
    tra thẳng sẽ ném `KeyError` cho mỗi hàng mồ côi, tức 500 trên trang hồ sơ của chính
    người đã vote — một trang họ không có cách nào tự chữa.
    """
    mach = _mach_cua(sub, tac_gia, TIEU_DE_BI_AN, THAN_BI_AN)
    con_lai = _mach_cua(sub, tac_gia, "Mạch còn lại")
    dat_vote(user=nguoi_khac, target=_moc_1(mach), value=1)
    dat_vote(user=nguoi_khac, target=_moc_1(con_lai), value=1)

    Mach.objects.filter(pk=mach.pk).delete()

    client.force_login(nguoi_khac)
    d = lay(client, DA_VOTE)  # `lay` đòi đúng 200 — 500 làm bài này đỏ ngay tại đây
    assert _ids(d) == [con_lai.pk]
    assert TIEU_DE_BI_AN not in moi_chuoi(d)


def test_mach_bi_xoa_that_thi_dang_theo_khong_con(client, sub, tac_gia, nguoi_khac):
    """Vế `Follow` của ca trên. `Follow.mach` là `CASCADE`, nên hàng đi theo mạch — bài
    đo này ghim chính tính chất đó, để đổi `on_delete` là có màu đỏ."""
    mach = _mach_cua(sub, tac_gia, TIEU_DE_BI_AN)
    con_lai = _mach_cua(sub, tac_gia, "Mạch còn lại")
    Follow.objects.create(user=nguoi_khac, mach=mach)
    Follow.objects.create(user=nguoi_khac, mach=con_lai)

    Mach.objects.filter(pk=mach.pk).delete()

    client.force_login(nguoi_khac)
    d = lay(client, DANG_THEO)
    assert _ids(d) == [con_lai.pk]
    assert TIEU_DE_BI_AN not in moi_chuoi(d)


# --- thứ tự: khoá là "lúc TÔI vote/theo", không phải "lúc mạch ra đời" -------


def test_da_vote_sap_theo_luc_TOI_VOTE_khong_theo_luc_mach_ra_doi(
    client, ba_mach, nguoi_khac
):
    """Mạch dựng A → B → C, vote theo thứ tự C → A → B ⇒ phải ra **B, A, C**.

    Đổi khoá keyset sang `Mach.created_at` cho ra `C, B, A` — khác hẳn, nên bài đo này là
    cái chuông cho đúng chỗ dễ sai nhất của cả module.
    """
    a, b, c = ba_mach
    for m in (c, a, b):
        dat_vote(user=nguoi_khac, target=_moc_1(m), value=1)

    client.force_login(nguoi_khac)

    assert _ids(lay(client, DA_VOTE)) == [b.pk, a.pk, c.pk]


def test_da_vote_lat_trang_giu_dung_thu_tu_vote(client, ba_mach, nguoi_khac):
    """Cùng dữ liệu trên, lật bằng cursor: hai trang nối lại phải bằng đúng một trang.

    Cursor mã hoá `Vote.created_at`; mã hoá nhầm `Mach.created_at` thì trang 2 được cắt
    theo một khoá không liên quan tới thứ tự đang sắp — trùng dòng hoặc sót dòng, và vẫn
    HTTP 200.
    """
    a, b, c = ba_mach
    for m in (c, a, b):
        dat_vote(user=nguoi_khac, target=_moc_1(m), value=1)
    client.force_login(nguoi_khac)

    trang_1 = lay(client, f"{DA_VOTE}?limit=2")
    trang_2 = lay(client, f"{DA_VOTE}?limit=2&cursor={trang_1['cursor_ke_tiep']}")

    assert _ids(trang_1) + _ids(trang_2) == [b.pk, a.pk, c.pk]
    assert trang_2["cursor_ke_tiep"] is None


def test_dang_theo_sap_theo_luc_TOI_THEO_khong_theo_luc_mach_ra_doi(
    client, ba_mach, nguoi_khac
):
    a, b, c = ba_mach
    for m in (c, a, b):
        Follow.objects.create(user=nguoi_khac, mach=m)

    client.force_login(nguoi_khac)

    assert _ids(lay(client, DANG_THEO)) == [b.pk, a.pk, c.pk]


# --- "đã vote" nghĩa là gì --------------------------------------------------


def test_chi_phieu_cho_MOC_1_dua_mach_vao_danh_sach(client, sub, tac_gia, nguoi_khac):
    """Vote mốc 2 hay vote một bình luận là vote cho **một câu nói bên trong** mạch, không
    phải vote cho bài — chúng không đưa mạch vào tab "Đã vote"."""
    mach = _mach_cua(sub, tac_gia, "Mạch có mốc 2 và bình luận")
    moc_2 = them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    binh_luan = tao_binh_luan(mach=mach, author=tac_gia, body="Một câu.")
    dat_vote(user=nguoi_khac, target=moc_2, value=1)
    dat_vote(user=nguoi_khac, target=binh_luan, value=1)

    client.force_login(nguoi_khac)

    assert _ids(lay(client, DA_VOTE)) == []


def test_phieu_XUONG_van_tinh_la_da_vote(client, ba_mach, nguoi_khac):
    """Tab tên là "Đã vote", không phải "Đã thích"."""
    dat_vote(user=nguoi_khac, target=_moc_1(ba_mach[0]), value=-1)

    client.force_login(nguoi_khac)

    assert _ids(lay(client, DA_VOTE)) == [ba_mach[0].pk]


def test_rut_vote_thi_mach_roi_khoi_danh_sach(client, ba_mach, nguoi_khac):
    """`value = 0` xoá hàng `Vote` (PLAN mục 7), nên danh sách phải phản ánh ngay."""
    dat_vote(user=nguoi_khac, target=_moc_1(ba_mach[0]), value=1)
    client.force_login(nguoi_khac)
    assert _ids(lay(client, DA_VOTE)) == [ba_mach[0].pk]

    dat_vote(user=nguoi_khac, target=_moc_1(ba_mach[0]), value=0)

    assert _ids(lay(client, DA_VOTE)) == []


def test_khong_thay_phieu_cua_nguoi_khac(client, ba_mach, nguoi_khac, tac_gia):
    dat_vote(user=tac_gia, target=_moc_1(ba_mach[0]), value=1)
    dat_vote(user=nguoi_khac, target=_moc_1(ba_mach[1]), value=1)

    client.force_login(nguoi_khac)

    assert _ids(lay(client, DA_VOTE)) == [ba_mach[1].pk]


def test_khong_thay_mach_nguoi_khac_dang_theo(client, ba_mach, nguoi_khac, tac_gia):
    Follow.objects.create(user=tac_gia, mach=ba_mach[0])
    Follow.objects.create(user=nguoi_khac, mach=ba_mach[1])

    client.force_login(nguoi_khac)

    assert _ids(lay(client, DANG_THEO)) == [ba_mach[1].pk]


# --- per-user: 401 cho khách, `no-store` cho cả hai cửa ----------------------


@pytest.mark.parametrize("duong", [DA_VOTE, DANG_THEO])
def test_khach_bi_401(client, db, duong):
    r = client.get(duong)
    assert r.status_code == 401 and r.json()["code"] == "chua_dang_nhap"


@pytest.mark.parametrize("duong", [DA_VOTE, DANG_THEO])
def test_hai_cua_me_deu_no_store(client, nguoi_khac, duong):
    """PLAN 8.4 điểm 4 — per-user tuyệt đối. Thiếu header này là bản cache của người này
    phục vụ người kia, và không có gì đỏ cho tới khi có người đọc được danh sách vote của
    người khác."""
    client.force_login(nguoi_khac)

    assert client.get(duong)["Cache-Control"] == "no-store"


@pytest.mark.parametrize("duong", [DA_VOTE, DANG_THEO])
def test_no_store_co_ca_tren_nhanh_LOI(client, nguoi_khac, duong):
    """Header phải được gán TRƯỚC mọi nhánh return. Gán ở cuối hàm thì đúng nhánh 400 đi
    ra trần — và nhánh lỗi cũng mang dấu vết per-user (nó xác nhận phiên còn sống)."""
    client.force_login(nguoi_khac)

    r = client.get(f"{duong}?limit=51")

    assert r.status_code == 400 and r["Cache-Control"] == "no-store"


@pytest.mark.parametrize("duong", [DA_VOTE, DANG_THEO])
def test_cursor_rac_la_400_o_ca_hai_cua_me(client, nguoi_khac, duong):
    client.force_login(nguoi_khac)

    r = client.get(f"{duong}?cursor=rac~~")

    assert r.status_code == 400 and r.json()["code"] == "cursor_khong_hop_le"
