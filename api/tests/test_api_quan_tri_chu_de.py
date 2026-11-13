"""Trang "Chủ đề tuần" của khu quản trị — `api/api/quan_tri_chu_de.py` (việc 21, đợt C).

Ba bài đo của plan `plans/2026-11-13-quan-tri-ban-tin-chu-de.md` §5:

- **C1** ô "Đang trên trang chủ" = đúng chủ đề mà feed chủ đề CÔNG KHAI trả (gọi chính endpoint
  feed, chọn như `apps/web/lib/chu-de.ts::chonChuDeNoi`), kể cả khi chủ đề mới nhất đã đóng và
  khi chủ đề mới xuất bản nhất bị đẩy khỏi năm ứng viên đầu feed;
- **C2** tuần ISO theo giờ VN: Chủ nhật 23:30 và thứ Hai 00:10 rơi đúng tuần; chủ đề hẹn giờ
  tuần sau ⇒ ô "tuần sau" có;
- **C3** đóng / mở lại đi qua hàm lõi, có AuditLog, có làm mới cache; mạch `nhat_ky` ⇒ 400;
  user thường ⇒ 403.

Giờ đóng băng nằm ở năm 2099: chủ đề hẹn giờ phải có `published_at > created_at` (ràng buộc
`mach_an_phai_co_nguoi_an_hoac_hen_gio`), mà `created_at` là giờ THẬT của lượt chạy.
"""

import threading
from datetime import datetime, timedelta

import pytest
from django.db import connection
from django.utils import timezone

from api import machs as cua_cong_khai

from api import quan_tri_chu_de
from api.quan_tri_chu_de import (
    SO_CHU_DE_TAI_TRANG_CHU,
    chu_de_tren_trang_chu,
    khoang_tuan_vn,
)
from core import ghi
from core.ghi import (
    AUDIT_DONG_SO_CHU_DE,
    AUDIT_MO_LAI_CHU_DE,
    dat_an_mach,
    dat_khoa_mach,
    dong_so,
    hen_gio_mach,
    tao_mach,
)
from core.models import Mach, Sub, User
from core.models.he_thong import AuditLog
from core.thoi_gian import TZ_VN

from tests._quan_tri import dang_nhap, dung_mod, dung_thuong

pytestmark = pytest.mark.django_db

#: Chủ nhật 01/03/2099 (giờ VN). `CN_2330` là 16:30 UTC cùng ngày; `T2_0010` là 17:10 UTC
#: **vẫn Chủ nhật theo UTC** — đúng cái bẫy của phép tính tuần bằng giờ máy.
CN_2330 = datetime(2099, 3, 1, 23, 30, tzinfo=TZ_VN)
T2_0010 = datetime(2099, 3, 2, 0, 10, tzinfo=TZ_VN)


@pytest.fixture
def canh(db):
    sub = Sub.objects.create(slug="thao-luan", ten="Thảo luận")
    tac_gia = User.objects.create(username="gikky_doi", display_name="gikky")
    mod = dung_mod()
    return {"sub": sub, "tac_gia": tac_gia, "mod_user": mod, "mod": dang_nhap(mod)}


def _chu_de(canh, title, loai_mach="thao_luan"):
    m, _ = tao_mach(
        sub=canh["sub"],
        author=canh["tac_gia"],
        title=title,
        body="Câu hỏi của tuần",
        loai_mach=loai_mach,
    )
    return m


def _dat_gio(m, *, published_at, last_content_at=None):
    Mach.objects.filter(pk=m.pk).update(
        published_at=published_at,
        last_content_at=last_content_at or published_at,
    )


def _trang(canh):
    r = canh["mod"].get("/api/admin/chu-de")
    assert r.status_code == 200, r.content[:400]
    return r.json()


def _chon_nhu_trang_chu(client) -> int | None:
    """Đúng hai bước của trang chủ: feed `moi` công khai + `chonChuDeNoi` (max `published_at`,
    hoà ⇒ id lớn hơn)."""
    r = client.get(
        "/api/v1/feeds/moi",
        {"loai_mach": "thao_luan", "limit": SO_CHU_DE_TAI_TRANG_CHU},
    )
    assert r.status_code == 200, r.content[:400]
    items = r.json()["items"]
    if not items:
        return None
    return max(items, key=lambda it: (datetime.fromisoformat(it["published_at"]), it["id"]))[
        "id"
    ]


# --------------------------------------------------------------------------------- C1 ---


def test_c1_dang_tren_trang_chu_la_chu_de_feed_cong_khai_tra_ke_ca_khi_da_dong(
    canh, client
):
    """Chủ đề ĐÃ ĐÓNG mới hơn chủ đề đang mở ⇒ trang chủ hiện cái đã đóng (luật "mới nhất",
    không xét trạng thái). Mạch nhật ký, chủ đề bị ẩn, chủ đề hẹn giờ không được chen vào."""
    bay_gio = timezone.now()
    mo = _chu_de(canh, "Chủ đề cũ đang mở")
    _dat_gio(mo, published_at=bay_gio - timedelta(days=8))
    dong = _chu_de(canh, "Chủ đề mới đã đóng")
    _dat_gio(dong, published_at=bay_gio - timedelta(days=1))
    dong_so(mach=dong, ket_qua="132 bình luận")

    nhat_ky = _chu_de(canh, "Nhật ký mới hơn", loai_mach="nhat_ky")
    _dat_gio(nhat_ky, published_at=bay_gio)
    an = _chu_de(canh, "Chủ đề bị mod ẩn")
    dat_an_mach(mach=an, an=True, boi=canh["mod_user"], ly_do="")
    hen = _chu_de(canh, "Chủ đề hẹn tuần sau")
    hen_gio_mach(
        mach_id=hen.pk, published_at=bay_gio + timedelta(days=3), boi=canh["mod_user"]
    )

    trang = _trang(canh)
    assert _chon_nhu_trang_chu(client) == dong.pk
    assert trang["dang_tren_trang_chu"]["id"] == dong.pk
    assert trang["dang_tren_trang_chu"]["trang_thai"] == "dong"
    assert trang["dang_tren_trang_chu"]["ket_qua"] == "132 bình luận"


def test_c1_chu_de_moi_xuat_ban_nhat_bi_day_khoi_nam_ung_vien_thi_trang_chu_khong_hien_no(
    canh, client
):
    """Ca phân biệt "cùng truy vấn" với "tự đoán = max published_at": chủ đề xuất bản muộn
    nhất nhưng `last_content_at` cũ nhất rơi khỏi `SO_CHU_DE_TAI_TRANG_CHU` ứng viên đầu
    feed, nên trang chủ KHÔNG hiện nó — và ô admin cũng không được hiện nó."""
    goc = timezone.now() - timedelta(days=30)
    cac = []
    for i in range(SO_CHU_DE_TAI_TRANG_CHU):
        m = _chu_de(canh, f"Chủ đề cũ {i}")
        # Xuất bản sớm, nhưng vừa được nối mốc ⇒ `last_content_at` rất mới.
        _dat_gio(
            m,
            published_at=goc + timedelta(days=i),
            last_content_at=timezone.now() - timedelta(minutes=i),
        )
        cac.append(m)
    moi_nhat = _chu_de(canh, "Chủ đề xuất bản muộn nhất")
    _dat_gio(
        moi_nhat,
        published_at=goc + timedelta(days=20),
        last_content_at=goc + timedelta(days=20),
    )

    mong_doi = _chon_nhu_trang_chu(client)
    assert mong_doi == cac[-1].pk  # trang chủ chọn trong năm ứng viên, không phải `moi_nhat`
    assert _trang(canh)["dang_tren_trang_chu"]["id"] == mong_doi
    assert chu_de_tren_trang_chu().pk == mong_doi


def test_c1_khong_co_chu_de_nao_thi_o_trang_chu_rong(canh):
    _chu_de(canh, "Chỉ có nhật ký", loai_mach="nhat_ky")
    trang = _trang(canh)
    assert trang["dang_tren_trang_chu"] is None
    assert trang["items"] == []
    assert trang["tong"] == 0


# --------------------------------------------------------------------------------- C2 ---


def test_c2_khoang_tuan_vn_hai_dau_ranh_gioi():
    bat_dau, ket_thuc = khoang_tuan_vn(CN_2330)
    assert bat_dau == datetime(2099, 2, 23, tzinfo=TZ_VN)
    assert ket_thuc == datetime(2099, 3, 2, tzinfo=TZ_VN)

    bat_dau, ket_thuc = khoang_tuan_vn(T2_0010)
    assert bat_dau == datetime(2099, 3, 2, tzinfo=TZ_VN)
    assert ket_thuc == datetime(2099, 3, 9, tzinfo=TZ_VN)


def _hen(canh, title, khi):
    m = _chu_de(canh, title)
    hen_gio_mach(mach_id=m.pk, published_at=khi, boi=canh["mod_user"])
    return m


def test_c2_chu_nhat_2330_tuan_nay_va_tuan_sau(canh, monkeypatch):
    """CN 23:30: chủ đề CN 23:59:59 thuộc tuần NÀY; chủ đề T2 00:00 đúng thuộc tuần SAU."""
    cuoi_tuan = _hen(canh, "Chủ đề cuối tuần", datetime(2099, 3, 1, 23, 59, 59, tzinfo=TZ_VN))
    dau_tuan_sau = _hen(canh, "Chủ đề tuần sau", datetime(2099, 3, 2, 0, 0, tzinfo=TZ_VN))
    monkeypatch.setattr(quan_tri_chu_de, "bay_gio", lambda: CN_2330)

    trang = _trang(canh)
    assert trang["tuan_nay"]["bat_dau"] == "2099-02-23"
    assert trang["tuan_nay"]["ket_thuc"] == "2099-03-01"
    assert trang["tuan_nay"]["chu_de"]["id"] == cuoi_tuan.pk
    assert trang["tuan_sau"]["bat_dau"] == "2099-03-02"
    assert trang["tuan_sau"]["ket_thuc"] == "2099-03-08"
    assert trang["tuan_sau"]["chu_de"]["id"] == dau_tuan_sau.pk
    assert trang["tuan_sau"]["chu_de"]["trang_thai"] == "hen_gio"

    theo_id = {it["id"]: it for it in trang["items"]}
    assert theo_id[cuoi_tuan.pk]["tuan_bat_dau"] == "2099-02-23"
    assert theo_id[dau_tuan_sau.pk]["tuan_bat_dau"] == "2099-03-02"


def test_c2_thu_hai_0010_tuan_sau_chua_co(canh, monkeypatch):
    """T2 00:10 VN (vẫn Chủ nhật theo UTC): chủ đề T2 thành "tuần này", tuần sau trống."""
    _hen(canh, "Chủ đề cuối tuần", datetime(2099, 3, 1, 23, 59, 59, tzinfo=TZ_VN))
    dau_tuan = _hen(canh, "Chủ đề thứ Hai", datetime(2099, 3, 2, 0, 0, tzinfo=TZ_VN))
    monkeypatch.setattr(quan_tri_chu_de, "bay_gio", lambda: T2_0010)

    trang = _trang(canh)
    assert trang["tuan_nay"]["bat_dau"] == "2099-03-02"
    assert trang["tuan_nay"]["chu_de"]["id"] == dau_tuan.pk
    assert trang["tuan_sau"]["chu_de"] is None


def test_c2_chu_de_bi_mod_an_hay_luu_tru_khong_tinh_la_da_co(canh, monkeypatch):
    """Ô "tuần sau" trả lời "trang chủ tuần sau có gì": bài mod đã gỡ, hay đã lưu trữ, thì
    không có. Bài lưu trữ hẹn MUỘN hơn bài bị ẩn để nó là ứng viên đầu nếu bộ lọc
    `archived_at` rơi mất."""
    m = _hen(canh, "Chủ đề tuần sau", datetime(2099, 3, 3, 8, 0, tzinfo=TZ_VN))
    Mach.objects.filter(pk=m.pk).update(hidden_by=canh["mod_user"])
    luu = _hen(canh, "Chủ đề tuần sau đã lưu trữ", datetime(2099, 3, 4, 8, 0, tzinfo=TZ_VN))
    Mach.objects.filter(pk=luu.pk).update(archived_at=timezone.now())
    monkeypatch.setattr(quan_tri_chu_de, "bay_gio", lambda: CN_2330)

    trang = _trang(canh)
    assert trang["tuan_sau"]["chu_de"] is None
    # …nhưng bảng vẫn thấy cả hai.
    hang = {it["id"]: it for it in trang["items"]}
    assert {k: v["trang_thai"] for k, v in hang.items()} == {m.pk: "bi_an", luu.pk: "hen_gio"}
    assert hang[luu.pk]["da_luu_tru"] is True


# --------------------------------------------------------------------------------- C3 ---


@pytest.fixture
def lam_moi(monkeypatch):
    goi: list[int] = []
    monkeypatch.setattr(quan_tri_chu_de, "lam_moi_mach", lambda m: goi.append(m.pk))
    return goi


def _dong(canh, m, **body):
    return canh["mod"].post(
        f"/api/admin/chu-de/{m.pk}/dong", body, content_type="application/json"
    )


def _mo_lai(canh, m):
    return canh["mod"].post(f"/api/admin/chu-de/{m.pk}/mo-lai")


def test_c3_staff_dong_chu_de_luu_ket_qua_tong_ket_audit_va_lam_moi(canh, lam_moi):
    m = _chu_de(canh, "Chủ đề tuần")
    r = _dong(canh, m, ket_qua="132 bình luận", bai_hoc="Tổng kết: đa số chờ Fed.")
    assert r.status_code == 200, r.content[:400]
    assert r.json()["trang_thai"] == "dong"
    assert r.json()["co_the_mo_lai"] is True

    m.refresh_from_db()
    assert m.status == "closed"
    assert m.closed_at is not None
    assert (m.ket_qua, m.bai_hoc) == ("132 bình luận", "Tổng kết: đa số chờ Fed.")
    log = AuditLog.objects.get(action=AUDIT_DONG_SO_CHU_DE)
    assert (log.actor_id, log.target_id) == (canh["mod_user"].pk, m.pk)
    assert lam_moi == [m.pk]


def test_c3_mo_lai_ve_open_va_tong_ket_cu_nam_trong_audit(canh, lam_moi):
    """Mở lại đi qua `core/ghi.py::mo_lai`, hàm lõi XOÁ `ket_qua`/`bai_hoc` (chủ đích của nó);
    bản cũ còn trong `meta` của dòng AuditLog. Đã chốt theo plan §3.1 và sổ P-20261110-2: chủ
    đề đang mở không mang tổng kết."""
    m = _chu_de(canh, "Chủ đề tuần")
    assert _dong(canh, m, ket_qua="kq", bai_hoc="Tổng kết cũ").status_code == 200

    r = _mo_lai(canh, m)
    assert r.status_code == 200, r.content[:400]
    assert r.json()["trang_thai"] == "mo"
    m.refresh_from_db()
    assert (m.status, m.closed_at) == ("open", None)
    assert m.ket_qua is None
    assert m.bai_hoc is None
    log = AuditLog.objects.get(action=AUDIT_MO_LAI_CHU_DE)
    assert log.meta["bai_hoc_cu"] == "Tổng kết cũ"
    assert log.meta["ket_qua_cu"] == "kq"
    assert lam_moi == [m.pk, m.pk]


def test_c3_mach_khong_phai_chu_de_thi_400_va_khong_doi_gi(canh, lam_moi):
    for loai in ("nhat_ky", "bai_viet"):
        m = _chu_de(canh, f"Không phải chủ đề {loai}", loai_mach=loai)
        r = _dong(canh, m)
        assert r.status_code == 400
        assert r.json()["code"] == "khong_phai_chu_de"
        dong_so(mach=m)
        r = _mo_lai(canh, m)
        assert r.status_code == 400
        assert r.json()["code"] == "khong_phai_chu_de"
        m.refresh_from_db()
        assert m.status == "closed"
    assert AuditLog.objects.count() == 0
    assert lam_moi == []


def test_c3_user_thuong_403_va_khong_doi_gi(canh):
    m = _chu_de(canh, "Chủ đề tuần")
    thuong = dang_nhap(dung_thuong())
    r = thuong.post(
        f"/api/admin/chu-de/{m.pk}/dong", {}, content_type="application/json"
    )
    assert r.status_code == 403
    assert r.json()["code"] == "khong_du_quyen"
    assert thuong.get("/api/admin/chu-de").status_code == 403
    m.refresh_from_db()
    assert m.status == "open"


def test_c3_trang_thai_sai_tra_409_dung_ma(canh, lam_moi):
    m = _chu_de(canh, "Chủ đề tuần")
    r = _mo_lai(canh, m)
    assert (r.status_code, r.json()["code"]) == (409, "mach_dang_mo")

    assert _dong(canh, m).status_code == 200
    r = _dong(canh, m)
    assert (r.status_code, r.json()["code"]) == (409, "mach_da_dong")

    Mach.objects.filter(pk=m.pk).update(closed_at=timezone.now() - timedelta(days=8))
    assert _trang(canh)["items"][0]["co_the_mo_lai"] is False
    r = _mo_lai(canh, m)
    assert (r.status_code, r.json()["code"]) == (409, "het_han_mo_lai")

    khoa = _chu_de(canh, "Chủ đề bị khoá")
    dat_khoa_mach(mach=khoa, khoa=True, boi=canh["mod_user"], ly_do="")
    r = _dong(canh, khoa)
    assert (r.status_code, r.json()["code"]) == (409, "mach_bi_khoa")
    assert lam_moi == [m.pk]


def test_c3_ket_qua_qua_40_ky_tu_thi_400(canh):
    m = _chu_de(canh, "Chủ đề tuần")
    r = _dong(canh, m, ket_qua="x" * 41)
    assert r.status_code == 400
    m.refresh_from_db()
    assert m.status == "open"


def test_c3_mach_khong_ton_tai_404(canh):
    r = canh["mod"].post("/api/admin/chu-de/999999/dong", {}, content_type="application/json")
    assert r.status_code == 404


def test_c3_chu_de_hen_gio_hay_bi_an_thi_409_khong_doi_gi(canh, lam_moi):
    """Cửa công khai trả 404 cho hai loài bài này; cửa quản trị trả 409 `chu_de_dang_an`."""
    hen = _hen(canh, "Chủ đề hẹn giờ", datetime(2099, 3, 3, 8, 0, tzinfo=TZ_VN))
    r = _dong(canh, hen, ket_qua="kq")
    assert (r.status_code, r.json()["code"]) == (409, "chu_de_dang_an")

    an = _chu_de(canh, "Chủ đề đã đóng rồi bị ẩn")
    dong_so(mach=an, ket_qua="kq", bai_hoc="Tổng kết")
    dat_an_mach(mach=an, an=True, boi=canh["mod_user"], ly_do="")
    r = _mo_lai(canh, an)
    assert (r.status_code, r.json()["code"]) == (409, "chu_de_dang_an")
    assert {it["id"]: it["co_the_mo_lai"] for it in _trang(canh)["items"]}[an.pk] is False

    hen.refresh_from_db()
    an.refresh_from_db()
    assert hen.status == "open"
    assert (an.status, an.bai_hoc) == ("closed", "Tổng kết")
    assert lam_moi == []


# ------------------------------------------------------------------------ đua (vòng 1) ---


def _dua(goi_mot, n=2):
    """Chạy `goi_mot(i)` trên `n` luồng; trả kết quả theo `i`. Mỗi luồng tự đóng kết nối DB
    của nó (Django mở một kết nối riêng cho từng luồng)."""
    ket: list = [None] * n

    def chay(i):
        try:
            ket[i] = goi_mot(i)
        finally:
            connection.close()

    luong = [threading.Thread(target=chay, args=(i,)) for i in range(n)]
    for t in luong:
        t.start()
    for t in luong:
        t.join()
    return ket


def _cho_nhau_truoc(monkeypatch, module, ten, n=2):
    """Thay `module.ten` (bản `dong_so` / `mo_lai` mà cửa API gọi) bằng một bản đợi ĐỦ `n`
    luồng rồi mới gọi hàm lõi thật. Mọi luồng đã qua phép kiểm trạng thái ở tầng API trước khi
    bất kỳ luồng nào khoá hàng — cuộc đua xảy ra CHẮC CHẮN, không nhờ may."""
    rao = threading.Barrier(n, timeout=10)
    that = getattr(ghi, ten)

    def doi_roi_goi(**kw):
        rao.wait()
        return that(**kw)

    monkeypatch.setattr(module, ten, doi_roi_goi)


def _chu_de_dua():
    sub = Sub.objects.create(slug="thao-luan", ten="Thảo luận")
    tac_gia = User.objects.create(username="gikky_doi", display_name="gikky")
    m, _ = tao_mach(sub=sub, author=tac_gia, title="Đua", body="x", loai_mach="thao_luan")
    return m, [dung_mod("mod_a"), dung_mod("mod_b")]


def _dua_dong(url, mods):
    def mot(i):
        r = dang_nhap(mods[i]).post(
            url,
            {"ket_qua": f"kq {i}", "bai_hoc": f"Tổng kết {i}"},
            content_type="application/json",
        )
        return r.status_code, r.json().get("code")

    ket = _dua(mot)
    assert sorted(s for s, _ in ket) == [200, 409], ket
    assert next(c for s, c in ket if s == 409) == "mach_da_dong"
    return next(i for i, (s, _) in enumerate(ket) if s == 200)


@pytest.mark.django_db(transaction=True)
def test_dua_hai_mod_cung_dong_chu_de_qua_cua_quan_tri(monkeypatch):
    """Đúng một 200, một 409 `mach_da_dong`; tổng kết là của lượt thắng; một dòng audit."""
    monkeypatch.setattr(quan_tri_chu_de, "lam_moi_mach", lambda m: None)
    _cho_nhau_truoc(monkeypatch, quan_tri_chu_de, "dong_so")
    m, mods = _chu_de_dua()

    thang = _dua_dong(f"/api/admin/chu-de/{m.pk}/dong", mods)
    m.refresh_from_db()
    assert (m.ket_qua, m.bai_hoc) == (f"kq {thang}", f"Tổng kết {thang}")
    assert AuditLog.objects.filter(action=AUDIT_DONG_SO_CHU_DE).count() == 1


@pytest.mark.django_db(transaction=True)
def test_dua_hai_mod_cung_dong_chu_de_qua_cua_cong_khai(monkeypatch):
    """Cùng cuộc đua trên `POST /api/v1/machs/{id}/close` — cùng hàm lõi, cùng 409."""
    monkeypatch.setattr(cua_cong_khai, "lam_moi_mach", lambda m: None)
    _cho_nhau_truoc(monkeypatch, cua_cong_khai, "dong_so")
    m, mods = _chu_de_dua()

    thang = _dua_dong(f"/api/v1/machs/{m.pk}/close", mods)
    m.refresh_from_db()
    assert (m.ket_qua, m.bai_hoc) == (f"kq {thang}", f"Tổng kết {thang}")
    assert AuditLog.objects.filter(action=AUDIT_DONG_SO_CHU_DE).count() == 1


@pytest.mark.django_db(transaction=True)
def test_dua_hai_mod_cung_mo_lai_chu_de(monkeypatch):
    """`mo_lai` cùng mẫu kiểm-rồi-mới-khoá: một 200, một 409 `mach_dang_mo`, một dòng audit."""
    monkeypatch.setattr(quan_tri_chu_de, "lam_moi_mach", lambda m: None)
    _cho_nhau_truoc(monkeypatch, quan_tri_chu_de, "mo_lai")
    m, mods = _chu_de_dua()
    dong_so(mach=m, ket_qua="kq", bai_hoc="Tổng kết")

    def mot(i):
        r = dang_nhap(mods[i]).post(f"/api/admin/chu-de/{m.pk}/mo-lai")
        return r.status_code, r.json().get("code")

    ket = _dua(mot)
    assert sorted(s for s, _ in ket) == [200, 409], ket
    assert next(c for s, c in ket if s == 409) == "mach_dang_mo"
    assert AuditLog.objects.filter(action=AUDIT_MO_LAI_CHU_DE).count() == 1
