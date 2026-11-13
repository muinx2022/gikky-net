"""`manage.py chuyen_ban_tin` — `plans/2026-11-13-ban-tin-bang-rieng.md` §3.3, tiêu chí A5."""

from datetime import date, datetime, timedelta
from io import StringIO

import pytest
from django.core.management import call_command

from core.ghi import tao_binh_luan, tao_mach, them_moc
from core.lam_sach_html import DINH_DANG_MARKDOWN
from core.models import BanTin, BanTinKhung, Mach, Moc, MocAnh, Sub, User
from core.models.ban_tin import SUB_BAN_TIN
from core.thoi_gian import TZ_VN

D1, D2, D3 = date(2026, 9, 6), date(2026, 9, 7), date(2026, 9, 8)


def luc(ngay: date, gio: int, phut: int = 0) -> datetime:
    return datetime(ngay.year, ngay.month, ngay.day, gio, phut, tzinfo=TZ_VN)


def mach_ban_tin(sub, bot, ngay: date, loai: list[str], *, view_count: int = 0) -> Mach:
    """Một mạch bản tin cũ: mốc thứ i mang `loai[i]`, đăng lúc 06:12 + i giờ, giờ VN."""
    khi = luc(ngay, 6, 12)
    mach, _ = tao_mach(
        sub=sub,
        author=bot,
        title=f"Bản tin {ngay:%d/%m}",
        body=f"<p>{loai[0]} {ngay}</p>",
        loai=loai[0],
        figures=[{"label": "VNI", "value": "1.280"}],
        question_for_crowd="Bạn nghĩ sao?",
        _created_at_seed=khi,
    )
    for i, ten in enumerate(loai[1:], start=1):
        them_moc(
            mach=mach,
            author=bot,
            body=f"<p>{ten} {ngay}</p>",
            loai=ten,
            _created_at_seed=khi + timedelta(hours=i),
        )
    Mach.objects.filter(pk=mach.pk).update(view_count=view_count)
    mach.refresh_from_db()
    return mach


def chay(*args) -> str:
    out = StringIO()
    call_command("chuyen_ban_tin", *args, stdout=out)
    return out.getvalue()


@pytest.fixture
def nen(db):
    sub = Sub.objects.create(slug=SUB_BAN_TIN, ten="Tin tức")
    bot = User.objects.create(username="gikky-team-news", la_tai_khoan_doi=True)
    return sub, bot


@pytest.fixture
def bo_ba(nen):
    """Đúng ca của A5: đủ 3 khung / 2 khung + ngày đã có BanTin / `loai` lạ."""
    sub, bot = nen
    du = mach_ban_tin(sub, bot, D1, ["Đêm qua", "Trước phiên VN", "Trước phiên Mỹ"], view_count=7)
    tao_binh_luan(mach=du, author=bot, body="một bình luận")
    hai = mach_ban_tin(sub, bot, D2, ["Đêm qua", " trước  phiên mỹ "], view_count=3)
    la = mach_ban_tin(sub, bot, D3, ["Đêm qua", "Tin nóng"])
    # Bot đã đăng khung "trước phiên Mỹ" của D2 qua đường MỚI trước lúc chuyển.
    da_co = BanTin.objects.create(
        ngay=D2, title="Bản tin mới", tac_gia=bot, view_count=5, cap_nhat_luc=luc(D2, 19, 33)
    )
    BanTinKhung.objects.create(
        ban_tin=da_co, khung="truoc_phien_my", body="<p>bản MỚI</p>", created_at=luc(D2, 19, 33)
    )
    return du, hai, la


def test_A5_chay_thu_khong_ghi_gi(bo_ba):
    ra = chay()
    assert "CHẠY THỬ" in ra
    assert BanTin.objects.count() == 1
    assert BanTinKhung.objects.count() == 1
    assert Mach.objects.filter(archived_at__isnull=False).count() == 0
    assert "Tin nóng" in ra
    assert "2 mạch sẽ chuyển, 1 mạch lỗi" in ra


def test_A5_that_chuyen_2_bao_1_loi_gop_ngay_trung(bo_ba):
    du, hai, la = bo_ba
    ra = chay("--that")
    assert "2 mạch đã chuyển, 1 mạch lỗi" in ra

    # Mạch đủ 3 khung.
    bt1 = BanTin.objects.get(ngay=D1)
    assert bt1.mach_cu == du
    assert bt1.title == du.title and bt1.tac_gia_id == du.author_id
    assert bt1.created_at == du.created_at
    assert bt1.view_count == 7
    khung1 = {k.khung: k for k in bt1.khung.all()}
    assert set(khung1) == {"dem_qua", "truoc_phien_vn", "truoc_phien_my"}
    for k in khung1.values():
        moc = Moc.objects.get(mach=du, body=k.body)
        assert k.created_at == moc.created_at, "created_at từng khung phải giữ của mốc"
    assert bt1.cap_nhat_luc == max(k.created_at for k in khung1.values())
    assert khung1["dem_qua"].figures == [{"label": "VNI", "value": "1.280"}]
    assert "1 bình luận" in ra

    # Ngày đã có: gộp, khung trùng giữ bản MỚI, view_count cộng dồn.
    bt2 = BanTin.objects.get(ngay=D2)
    assert bt2.mach_cu == hai
    assert bt2.title == "Bản tin mới"
    assert bt2.view_count == 5 + 3
    assert sorted(bt2.khung.values_list("khung", flat=True)) == ["dem_qua", "truoc_phien_my"]
    assert bt2.khung.get(khung="truoc_phien_my").body == "<p>bản MỚI</p>"
    assert "bỏ khung trùng" in ra

    # Mạch lỗi: không ghi gì, không lưu trữ.
    assert not BanTin.objects.filter(ngay=D3).exists()
    la.refresh_from_db()
    assert la.archived_at is None

    du.refresh_from_db()
    hai.refresh_from_db()
    assert du.archived_at is not None and hai.archived_at is not None

    # Chạy lần hai: 0 thay đổi.
    truoc = (BanTin.objects.count(), BanTinKhung.objects.count())
    ra2 = chay("--that")
    assert "0 mạch đã chuyển, 1 mạch lỗi" in ra2
    assert (BanTin.objects.count(), BanTinKhung.objects.count()) == truoc


def test_A5_than_markdown_chuyen_qua_bo_dung_html(nen):
    sub, bot = nen
    m = mach_ban_tin(sub, bot, D1, ["Đêm qua"])
    Moc.objects.filter(mach=m).update(body="**đậm** và *nghiêng*", body_dinh_dang=DINH_DANG_MARKDOWN)
    chay("--that")
    assert BanTinKhung.objects.get().body == "<p><strong>đậm</strong> và <em>nghiêng</em></p>"


def test_A5_moc_da_xoa_hoac_an_khong_chuyen(nen):
    sub, bot = nen
    m = mach_ban_tin(sub, bot, D1, ["Đêm qua", "Trước phiên VN", "Trước phiên Mỹ"])
    Moc.objects.filter(mach=m, seq=2).update(deleted_at=luc(D1, 9))
    Moc.objects.filter(mach=m, seq=3).update(hidden_at=luc(D1, 20))
    chay("--that")
    assert list(BanTinKhung.objects.values_list("khung", flat=True)) == ["dem_qua"]


@pytest.mark.parametrize("ca", ["hai_moc_cung_khung", "moc_co_anh", "hai_mach_cung_ngay"])
def test_A5_ca_loi_khong_ghi_gi(nen, ca):
    sub, bot = nen
    if ca == "hai_moc_cung_khung":
        mach_ban_tin(sub, bot, D1, ["Đêm qua", "Đêm qua"])
    elif ca == "moc_co_anh":
        m = mach_ban_tin(sub, bot, D1, ["Đêm qua"])
        MocAnh.objects.create(moc=Moc.objects.get(mach=m), khoa_luu_tru="x.webp", status="confirmed")
    else:
        mach_ban_tin(sub, bot, D1, ["Đêm qua"])
        m2 = mach_ban_tin(sub, bot, D2, ["Trước phiên VN"])
        Moc.objects.filter(mach=m2).update(created_at=luc(D1, 8))
    ra = chay("--that")
    assert "LỖI" in ra
    assert BanTin.objects.count() == 0
    assert Mach.objects.filter(archived_at__isnull=False).count() == 0


# --- Vòng sửa 1 ---------------------------------------------------------------


@pytest.mark.parametrize("rieng_tu", [True, False], ids=["rieng_tu", "cong_khai"])
def test_v1_mach_cua_nguoi_thuong_bi_BO_QUA_khong_ghi_khong_luu_tru(nen, client, rieng_tu):
    """Mục 1: mạch người thường trong `tin-tuc` (riêng tư hay không) KHÔNG thành bản tin công khai."""
    sub, _bot = nen
    nguoi = User.objects.create(username="nguoi_thuong")
    m = mach_ban_tin(sub, nguoi, D1, ["Đêm qua"])
    if rieng_tu:
        Mach.objects.filter(pk=m.pk).update(rieng_tu=True)
    ra_thu = chay()
    ra = chay("--that")
    for r in (ra_thu, ra):
        assert f"BỎ QUA mạch {m.pk} · tác giả nguoi_thuong · rieng_tu={rieng_tu}" in r
    assert BanTin.objects.count() == 0
    m.refresh_from_db()
    assert m.archived_at is None
    assert client.get(f"/api/v1/ban-tin/{D1.isoformat()}").status_code == 404


def test_v1_mach_rieng_tu_cua_TAI_KHOAN_DOI_cung_bi_bo_qua(nen):
    sub, bot = nen
    m = mach_ban_tin(sub, bot, D1, ["Đêm qua"])
    Mach.objects.filter(pk=m.pk).update(rieng_tu=True)
    assert "mạch riêng tư" in chay("--that")
    assert BanTin.objects.count() == 0


def test_v1_bang_chay_thu_in_tac_gia_va_rieng_tu_cho_moi_dong(nen):
    sub, bot = nen
    m = mach_ban_tin(sub, bot, D1, ["Đêm qua"])
    assert f"mạch {m.pk} · tác giả gikky-team-news · rieng_tu=False" in chay()


def test_v1_mach_nguoi_thuong_CUNG_NGAY_khong_chan_ban_tin_cua_doi(nen):
    """Mục 2: phép đếm "hai mạch cùng ngày" chỉ tính mạch đủ điều kiện."""
    sub, bot = nen
    doi = mach_ban_tin(sub, bot, D1, ["Đêm qua"])
    nguoi = User.objects.create(username="nguoi_thuong")
    mach_ban_tin(sub, nguoi, D1, ["Trước phiên VN"])
    ra = chay("--that")
    assert "1 mạch đã chuyển, 0 mạch lỗi" in ra
    assert BanTin.objects.get(ngay=D1).mach_cu == doi


def test_v1_mot_mach_ghi_hong_thi_LOI_rieng_mach_do_va_chay_tiep(nen, monkeypatch):
    """Mục 5: lỗi DB ở một mạch (vd đua với bot) không giết cả lượt."""
    from django.db import IntegrityError

    from core.management.commands import chuyen_ban_tin as lenh

    sub, bot = nen
    hong = mach_ban_tin(sub, bot, D1, ["Đêm qua"])
    tot = mach_ban_tin(sub, bot, D2, ["Đêm qua"])
    that = lenh.ghi_mot_mach

    def gia(ke):
        if ke.mach.pk == hong.pk:
            raise IntegrityError("duplicate key value violates unique constraint")
        return that(ke)

    monkeypatch.setattr(lenh, "ghi_mot_mach", gia)
    ra = chay("--that")
    assert f"LỖI mạch {hong.pk}" in ra
    assert "1 mạch đã chuyển, 1 mạch lỗi" in ra
    assert BanTin.objects.filter(ngay=D2, mach_cu=tot).exists()
    hong.refresh_from_db()
    assert hong.archived_at is None


def test_v1_dua_that_ban_tin_vua_co_mach_cu_khac_thi_LOI_khong_ghi_de(nen, monkeypatch):
    """Mục 5, ca dưới khoá: lúc ghi, ngày đó vừa có bản tin trỏ mạch KHÁC ⇒ LỖI, không đè."""
    from core.management.commands import chuyen_ban_tin as lenh

    sub, bot = nen
    m = mach_ban_tin(sub, bot, D1, ["Đêm qua"])
    khac, _ = tao_mach(sub=Sub.objects.create(slug="khac", ten="Khác"), author=bot, title="x", body="<p>x</p>")
    that = lenh.lap_ke_hoach

    def lap_roi_dua():
        ra = that()
        # Sau khi lập kế hoạch: một lượt khác vừa chuyển ngày D1 từ mạch `khac`.
        BanTin.objects.create(ngay=D1, title="đua", tac_gia=bot, mach_cu=khac)
        return ra

    monkeypatch.setattr(lenh, "lap_ke_hoach", lap_roi_dua)
    ra = chay("--that")
    assert f"LỖI mạch {m.pk}" in ra
    assert BanTin.objects.get(ngay=D1).mach_cu == khac
    m.refresh_from_db()
    assert m.archived_at is None


def test_v1_mach_bo_luu_tru_bang_tay_roi_chay_lai_thi_KHONG_cong_doi(nen):
    """Mục 6: bản tin đã có `mach_cu` = chính mạch này ⇒ chỉ lưu trữ lại, view_count giữ nguyên."""
    sub, bot = nen
    m = mach_ban_tin(sub, bot, D1, ["Đêm qua", "Trước phiên VN"], view_count=9)
    chay("--that")
    bt = BanTin.objects.get()
    assert bt.view_count == 9
    so_khung = bt.khung.count()
    Mach.objects.filter(pk=m.pk).update(archived_at=None)  # mod bỏ lưu trữ bằng tay

    ra = chay("--that")
    assert "chỉ lưu trữ lại" in ra and "0 mạch lỗi" in ra
    bt.refresh_from_db()
    assert bt.view_count == 9
    assert bt.khung.count() == so_khung
    m.refresh_from_db()
    assert m.archived_at is not None
