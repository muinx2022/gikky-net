"""`manage.py seed_e2e` — vá A3 (2026-08-22).

**Vì sao file này tồn tại.** Phase 1c thêm 119 dòng Python (`seed_e2e.py`) và **0 test
Python**, nên một hồi quy thật đi lọt tới tận vòng nghiệm thu: `seed_e2e` gắn 21 mạch của
`e2e_nhieu_mach` vào sub `chung-khoan` của `seed_dev`, trong khi `seed_dev._xoa_seed` chỉ
xoá mạch của user seed_dev rồi mới xoá `Sub` ⇒

    ProtectedError: Cannot delete some instances of model 'Sub' …

`seed_dev --reset` **không chạy được nữa**, và `seed_e2e --reset` không cứu được vì nó xoá
xong dựng lại ngay (không có cờ "chỉ xoá") — vòng lặp chỉ thoát bằng SQL tay. Không bài đo
nào đỏ, vì `tests/test_seed_dev.py` chạy trên DB test sạch nơi `seed_e2e` chưa bao giờ được
gọi.

Bài đo dưới đây gọi **cả hai** command trong cùng một DB, đúng thứ tự mà máy dev gặp.
"""

import re

import pytest
from django.utils import timezone
from django.core.management.base import CommandError
from django.db.models import ProtectedError

from api.schemas import SO_ANH_XEM_TRUOC
from core.anh_luu import THU_MUC_ANH, THU_MUC_THUMB, khoa_tu_src_anh, xoa_anh_that
from core.ghi import SO_ANH_TOI_DA_MOI_MOC, xoa_anh_moc
from core.management.commands import seed_dev, seed_e2e
from core.models import AnhNoiDung, BanTin, Mach, Moc, MocAnh, Sub, User

from .conftest import chay_seed, lay

# `kho_anh` cho CẢ file: `seed_e2e` nay gắn ảnh THẬT (ghi file) vào bài viết mới nhất, nên mọi
# bài đo ở đây chạy seed đều phải ghi vào `tmp_path`, không phải `api/media/` của máy dev.
pytestmark = [pytest.mark.django_db, pytest.mark.usefixtures("kho_anh")]


def test_sub_cua_seed_e2e_khong_trung_sub_nao_cua_seed_dev():
    """Đối chứng TĨNH, không cần chạy seed — đỏ ngay lúc ai đó gõ lại slug cũ.

    Bài dưới chứng minh hậu quả; bài này chỉ vào nguyên nhân, và nó chạy trong mili giây
    nên không ai có cớ bỏ qua.
    """
    cua_seed_dev = {s["slug"] for s in seed_dev.SUBS}
    for slug in (seed_e2e.SUB_SLUG, seed_e2e.SUB_RONG_SLUG):
        assert slug not in cua_seed_dev, (
            f"`seed_e2e` đang dùng ké sub {slug!r} của `seed_dev`. Mạch của "
            "`e2e_nhieu_mach` sẽ treo lại trong sub đó sau khi `seed_dev --reset` xoá "
            "xong phần của mình ⇒ ProtectedError, và `--reset` chết vĩnh viễn."
        )
    assert seed_e2e.SUB_RONG_SLUG != seed_e2e.SUB_SLUG


def test_seed_dev_reset_van_chay_duoc_sau_khi_seed_e2e_da_chay():
    """W3 — chuỗi `seed_dev` → `seed_e2e` → `seed_dev --reset` phải chạy SẠCH.

    Đây là chuỗi mà máy dev gặp thật: `pnpm e2e` gọi cả hai (globalSetup), rồi lần sau
    người ta muốn dựng lại dữ liệu nghiệm thu từ đầu.
    """
    chay_seed("seed_dev")
    chay_seed("seed_e2e")
    assert Mach.objects.filter(author__username=seed_e2e.USERNAME).count() == (
        seed_e2e.SO_MACH
    )

    # Chỗ nổ của hồi quy. Không `pytest.raises` nào ở đây: lệnh phải chạy trót lọt.
    chay_seed("seed_dev", "--reset")

    # `--reset` dựng lại đủ dữ liệu nghiệm thu…
    assert Mach.objects.filter(title=seed_dev.TITLE_HPG).count() == 1
    assert Sub.objects.filter(slug__in=[s["slug"] for s in seed_dev.SUBS]).count() == len(
        seed_dev.SUBS
    )
    # …và **không đụng** vào dữ liệu phụ của bộ e2e. Hai bộ, hai cổng vào.
    assert User.objects.filter(username=seed_e2e.USERNAME).exists()
    assert Mach.objects.filter(author__username=seed_e2e.USERNAME).count() == (
        seed_e2e.SO_MACH
    )
    assert Sub.objects.filter(slug=seed_e2e.SUB_SLUG).exists()


def test_seed_e2e_khong_can_seed_dev_chay_truoc():
    """Sub riêng ⇒ `seed_e2e` tự đứng được. Trước vá A3 nó `CommandError` ở đây."""
    chay_seed("seed_e2e")
    assert Mach.objects.filter(author__username=seed_e2e.USERNAME).count() == (
        seed_e2e.SO_MACH
    )
    assert Sub.objects.get(slug=seed_e2e.SUB_SLUG).ten == seed_e2e.SUB_TEN


def test_seed_e2e_chay_lan_hai_khong_nhan_doi_va_reset_don_sach():
    chay_seed("seed_e2e")
    truoc = Mach.objects.count()
    chay_seed("seed_e2e")
    assert Mach.objects.count() == truoc

    chay_seed("seed_e2e", "--reset")
    assert Mach.objects.filter(author__username=seed_e2e.USERNAME).count() == (
        seed_e2e.SO_MACH
    )
    assert User.objects.filter(username=seed_e2e.USERNAME).count() == 1
    assert Sub.objects.filter(slug=seed_e2e.SUB_SLUG).count() == 1
    assert Sub.objects.filter(slug=seed_e2e.SUB_RONG_SLUG).count() == 1


def test_sub_rong_that_su_RONG(db):
    """Vá V6 (B8): nhánh "sub 0 mạch" của UI chỉ có đất chạy nếu hàng này thật sự rỗng.

    Một mạch lỡ tay gắn vào đây là bài đo Playwright đo vào chỗ trống mà vẫn xanh — nó
    chỉ khẳng định "không thấy chữ `0 mạch`", và một sub có bài thì đúng là không có
    chữ đó.
    """
    chay_seed("seed_e2e")
    assert Mach.objects.filter(sub__slug=seed_e2e.SUB_RONG_SLUG).count() == 0


# --- Homepage v2: dữ liệu ba loại mạch (plans/2026-11-10-homepage-v2.md, bước 0) ------------


def test_seed_e2e_dung_du_ba_loai_mach_cho_homepage_v2():
    """Không có hàng dữ liệu này thì các khối "Chủ đề" / "Bài viết" của trang chủ rỗng và các
    bài đo B1–B3, S4 xanh giả (plan mục 6, "bài đo rỗng")."""
    chay_seed("seed_e2e")

    bai_viet = Mach.objects.filter(loai_mach=Mach.LoaiMach.BAI_VIET)
    assert bai_viet.count() == seed_e2e.SO_BAI_VIET >= 40
    # `loai_mach` KHÔNG được truyền khi seed ⇒ chính luật "tác giả có cờ → bai_viet" của
    # `tao_mach` phân giải ra loại này; seed bị hỏng cờ thì cả 43 bài thành `nhat_ky`.
    assert set(bai_viet.values_list("author__username", flat=True)) == {seed_e2e.USERNAME_DOI}
    assert User.objects.get(username=seed_e2e.USERNAME_DOI).la_tai_khoan_doi is True

    chu_de = list(Mach.objects.filter(loai_mach=Mach.LoaiMach.THAO_LUAN).order_by("published_at"))
    assert len(chu_de) == 3
    # Một đang mở, hai đã đóng; đúng một chủ đề đóng có `bai_hoc`.
    assert sorted(m.status for m in chu_de) == ["closed", "closed", "open"]
    assert sum(1 for m in chu_de if m.status == "closed" and m.bai_hoc) == 1
    # Ba chủ đề nằm ở BA tuần khác nhau (thứ Hai–Chủ nhật): lùi cách nhau 7 ngày. Đó là điều kiện
    # để nhóm theo tuần ở `/chu-de` (Đợt B) có nhiều hơn một nhóm.
    tuan = {m.published_at.astimezone(seed_e2e.TZ_VN).isocalendar()[:2] for m in chu_de}
    assert len(tuan) == 3
    # Hai ca của luật "dưới 4 bình luận thì ẩn con số": 2 và 5 (cộng một chủ đề 0).
    assert sorted(m.comment_count for m in chu_de) == [0, 2, 5]
    # Mạch cũ vẫn là nhật ký: seed mới không đổi loại của ai.
    assert Mach.objects.filter(author__username=seed_e2e.USERNAME).exclude(
        loai_mach=Mach.LoaiMach.NHAT_KY
    ).count() == 0


def test_seed_e2e_homepage_v2_chay_lai_khong_nhan_doi_va_reset_don_sach():
    chay_seed("seed_e2e")
    truoc = Mach.objects.count()
    chay_seed("seed_e2e")
    assert Mach.objects.count() == truoc

    chay_seed("seed_e2e", "--reset")
    assert Mach.objects.count() == truoc
    assert Mach.objects.filter(loai_mach=Mach.LoaiMach.THAO_LUAN).count() == 3
    assert User.objects.filter(username=seed_e2e.USERNAME_DOI).count() == 1
    assert User.objects.filter(username=seed_e2e.USERNAME_BINH_LUAN).count() == 1


# --- Ảnh gallery cho bài viết mới nhất (plans/2026-11-10-bai-viet-xem-truoc-anh.md) ---------


def _moc_1_bai_viet_moi(vi_tri: int) -> Moc:
    tieu_de = seed_e2e.TIEU_DE_BAI_VIET.format(so=seed_e2e.SO_BAI_VIET - vi_tri)
    return Moc.objects.get(mach__title=tieu_de, seq=1)


#: Gallery (`MocAnh`) có trần mỗi mốc; hàng seed vượt trần đó là ảnh NHÚNG trong `body`.
TRAN_GALLERY = SO_ANH_TOI_DA_MOI_MOC


def _tong_gallery() -> int:
    return sum(n for n in seed_e2e.SO_ANH_BAI_VIET_MOI if n <= TRAN_GALLERY)


def _tong_nhung() -> int:
    return sum(n for n in seed_e2e.SO_ANH_BAI_VIET_MOI if n > TRAN_GALLERY)


def _khoas_nhung(moc: Moc) -> list[str]:
    return [khoa_tu_src_anh(s) for s in re.findall(r'<img\b[^>]*\bsrc="([^"]+)"', moc.body)]


def test_seed_e2e_gan_anh_gallery_that_cho_bai_viet_moi_nhat(kho_anh, client):
    """Hàng bài viết có ba nhánh theo số ảnh (0 · 1 · ≥ 2); thiếu dữ liệu ảnh thì mọi bài đo
    Playwright của nó xanh giả. Ảnh phải là FILE THẬT (ảnh + thumbnail), không phải hàng DB
    trỏ vào hư không — bài đo CLS cần ảnh nạp xong thật."""
    chay_seed("seed_e2e")
    phuc_vu, _ = kho_anh

    assert len(seed_e2e.SO_ANH_BAI_VIET_MOI) == 10, "trang chủ vẽ đúng 10 bài viết"
    for vi_tri, so_anh in enumerate(seed_e2e.SO_ANH_BAI_VIET_MOI):
        moc = _moc_1_bai_viet_moi(vi_tri)
        if so_anh > TRAN_GALLERY:
            # Vượt trần gallery ⇒ không có `MocAnh`, ảnh nằm trong body + `AnhNoiDung`.
            assert not MocAnh.objects.filter(moc=moc).exists(), f"bài mới thứ {vi_tri}"
            khoas = _khoas_nhung(moc)
            assert len(khoas) == so_anh == len(set(khoas)), f"bài mới thứ {vi_tri}"
            assert AnhNoiDung.objects.filter(khoa_luu_tru__in=khoas).count() == so_anh
            for khoa in khoas:
                assert (phuc_vu / THU_MUC_ANH / khoa).is_file()
                assert (phuc_vu / THU_MUC_THUMB / khoa).is_file()
            continue
        anhs = list(MocAnh.objects.filter(moc=moc).order_by("position"))
        assert len(anhs) == so_anh, f"bài mới thứ {vi_tri}"
        for a in anhs:
            assert a.status == MocAnh.TrangThai.XAC_NHAN and not a.da_cach_ly
            assert a.w and a.h
            assert (phuc_vu / THU_MUC_ANH / a.khoa_luu_tru).is_file()
            assert (phuc_vu / THU_MUC_THUMB / a.khoa_luu_tru).is_file()

    # Đủ cả ba nhánh + ca lật nhiều ảnh + ca VƯỢT TRẦN gallery (slide "Xem tất cả") + ≥ 6 hàng
    # có ảnh (điều kiện của bài đo CLS).
    cac_so = set(seed_e2e.SO_ANH_BAI_VIET_MOI)
    assert {0, 1, 2, 3} <= cac_so and any(n >= 5 for n in cac_so)
    assert any(n > SO_ANH_XEM_TRUOC for n in cac_so), "thiếu ca vượt trần gallery"
    assert sum(1 for n in seed_e2e.SO_ANH_BAI_VIET_MOI if n >= 1) >= 6

    # Và nó ra tới API đúng như trang chủ sẽ gọi (mới nhất trước). `anh_khac` tính theo HẰNG của
    # API chứ không chép số: đổi trần gallery thì bài đo này đi theo.
    feed = lay(client, "/api/v1/feeds/moi?loai_mach=bai_viet&limit=10")["items"]
    assert [m["xem_truoc"]["so_anh"] for m in feed] == list(seed_e2e.SO_ANH_BAI_VIET_MOI)
    assert [len(m["xem_truoc"]["anh_khac"]) for m in feed] == [
        max(0, min(n, SO_ANH_XEM_TRUOC) - 1) for n in seed_e2e.SO_ANH_BAI_VIET_MOI
    ]


def test_seed_e2e_anh_chay_lai_khong_nhan_doi_va_bu_duoc_cho_db_dung_truoc(kho_anh):
    """Cổng idempotency của ảnh là THEO TỪNG MỐC: DB e2e dựng trước lượt này (đã có bài viết,
    chưa có ảnh) vẫn nhận ảnh khi chạy lại, mà chạy thêm lần nữa không nhân đôi."""
    chay_seed("seed_e2e")
    assert MocAnh.objects.count() == _tong_gallery()
    assert AnhNoiDung.objects.count() == _tong_nhung() > 0

    chay_seed("seed_e2e")
    assert MocAnh.objects.count() == _tong_gallery()
    assert AnhNoiDung.objects.count() == _tong_nhung()

    # Giả lập DB cũ (gallery): gỡ ảnh của một bài (xoá cả file), chạy lại ⇒ bài đó có ảnh trở lại.
    nhieu_nhat = max(n for n in seed_e2e.SO_ANH_BAI_VIET_MOI if n <= TRAN_GALLERY)
    moc = _moc_1_bai_viet_moi(seed_e2e.SO_ANH_BAI_VIET_MOI.index(nhieu_nhat))
    for a in list(MocAnh.objects.filter(moc=moc)):
        xoa_anh_moc(anh=a)
    assert MocAnh.objects.count() == _tong_gallery() - nhieu_nhat
    chay_seed("seed_e2e")
    assert MocAnh.objects.filter(moc=moc).count() == nhieu_nhat
    assert MocAnh.objects.count() == _tong_gallery()

    # Giả lập DB cũ (ảnh nhúng): bài vượt trần mất `<img>` và hàng `AnhNoiDung` ⇒ chạy lại dựng đủ.
    vuot = max(seed_e2e.SO_ANH_BAI_VIET_MOI)
    moc = _moc_1_bai_viet_moi(seed_e2e.SO_ANH_BAI_VIET_MOI.index(vuot))
    for khoa in _khoas_nhung(moc):
        AnhNoiDung.objects.filter(khoa_luu_tru=khoa).delete()
        xoa_anh_that(khoa)
    moc.body = re.sub(r"<img\b[^>]*>", "", moc.body)
    moc.save(update_fields=["body"])
    assert AnhNoiDung.objects.count() == _tong_nhung() - vuot
    chay_seed("seed_e2e")
    moc.refresh_from_db()
    assert len(_khoas_nhung(moc)) == vuot
    assert AnhNoiDung.objects.count() == _tong_nhung()


def _file_tren_dia(phuc_vu) -> set[str]:
    return {p.relative_to(phuc_vu).as_posix() for p in phuc_vu.rglob("*") if p.is_file()}


def test_seed_e2e_reset_don_ca_file_anh(kho_anh, django_capture_on_commit_callbacks):
    """`--reset` xoá hàng DB thì file ảnh KHÔNG được ở lại mồ côi trên đĩa — kể cả file ảnh NHÚNG
    của hàng vượt trần gallery. File chỉ đi khi transaction COMMIT (`on_commit`), nên bài đo
    phải cho các móc ấy chạy."""
    phuc_vu, _ = kho_anh
    chay_seed("seed_e2e")
    with django_capture_on_commit_callbacks(execute=True):
        chay_seed("seed_e2e", "--reset")

    assert MocAnh.objects.count() == _tong_gallery()
    assert AnhNoiDung.objects.count() == _tong_nhung()
    for thu_muc in (THU_MUC_ANH, THU_MUC_THUMB):
        goc = phuc_vu / thu_muc
        tren_dia = {p.relative_to(goc).as_posix() for p in goc.rglob("*") if p.is_file()}
        trong_db = set(MocAnh.objects.values_list("khoa_luu_tru", flat=True)) | set(
            AnhNoiDung.objects.values_list("khoa_luu_tru", flat=True)
        )
        assert tren_dia == trong_db, f"{thu_muc}: file mồ côi hoặc thiếu file"


def test_seed_e2e_db_dung_bang_ban_cu_hang_vuot_tran_bi_go_gallery_cu(kho_anh):
    """DB e2e dựng trước lượt gallery kiểu Reddit có gallery 5 ảnh ở đúng hàng nay vượt trần.
    `du_lieu_the` cho gallery thắng ảnh nhúng, nên nếu seed chỉ THÊM ảnh nhúng thì hàng ấy vẫn
    báo `so_anh` 5 và ca "Xem tất cả" không bao giờ hiện trên máy dev đã có dữ liệu."""
    from core.anh import xu_ly_anh_tai_len
    from core.ghi import them_anh_moc

    chay_seed("seed_e2e")
    vuot = max(seed_e2e.SO_ANH_BAI_VIET_MOI)
    moc = _moc_1_bai_viet_moi(seed_e2e.SO_ANH_BAI_VIET_MOI.index(vuot))
    # Dựng lại trạng thái cũ: bỏ ảnh nhúng, gắn gallery 5 ảnh.
    for khoa in _khoas_nhung(moc):
        AnhNoiDung.objects.filter(khoa_luu_tru=khoa).delete()
        xoa_anh_that(khoa)
    moc.body = re.sub(r"<img\b[^>]*>", "", moc.body)
    moc.save(update_fields=["body"])
    for k in range(5):
        them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(seed_e2e._png_seed(800, 600, k)))
    assert MocAnh.objects.filter(moc=moc).count() == 5, "tiền đề: gallery cũ"

    chay_seed("seed_e2e")

    moc.refresh_from_db()
    assert MocAnh.objects.filter(moc=moc).count() == 0
    assert len(_khoas_nhung(moc)) == vuot


def test_seed_e2e_reset_chay_duoc_khi_con_mach_la_trong_sub_e2e():
    """Rác kiểu "bài đo bị ngắt giữa chừng": mạch của một tài khoản dùng-một-lần (`@gikky.test`)
    nằm trong sub của bộ e2e.

    `Mach.sub` là PROTECT và `--reset` chỉ xoá mạch của ba user seed ⇒ trước lượt này nó chết
    ở `Sub.delete()` với `ProtectedError`. `don_rac_e2e` không cứu được vì chỉ ẩn mạch, không
    xoá hàng nào — bài này dựng đúng chuỗi: rác → `don_rac_e2e` → `--reset`.
    """
    from core.ghi import tao_mach
    from core.management.commands import don_rac_e2e

    chay_seed("seed_e2e")
    sub = Sub.objects.get(slug=seed_e2e.SUB_SLUG)
    la = User.objects.create(
        username="e2e_nk_lap_rac", email="e2e_nk_lap_rac" + don_rac_e2e.MIEN_E2E
    )
    rac, _ = tao_mach(
        sub=sub, author=la, title="Rác bài đo bị ngắt", body="Mốc 1.",
        loai_mach=Mach.LoaiMach.NHAT_KY,
    )
    # Có staff để `don_rac_e2e` đứng tên AuditLog (DB test không có seed_dev).
    User.objects.create(username="mod_rac", email="mod_rac@vi-du.gikky.net", is_staff=True)
    chay_seed("don_rac_e2e")
    rac.refresh_from_db()
    assert rac.hidden_at is not None, "tiền điều kiện: don_rac_e2e đã ẨN rác (nhưng không xoá)"
    assert Mach.objects.filter(pk=rac.pk).exists()

    chay_seed("seed_e2e", "--reset")  # trước đây: ProtectedError trên Sub

    assert not Mach.objects.filter(pk=rac.pk).exists()
    assert Sub.objects.filter(slug=seed_e2e.SUB_SLUG).exists(), "dựng lại sau reset"
    assert User.objects.filter(username=seed_e2e.USERNAME).exists()


def test_seed_e2e_dung_nhat_ky_co_lenh_bot_va_da_dong_cho_trang_chu_v2():
    """Plan giao diện mới §6.5: bài đo trang chủ cần dữ liệu THẬT cho dải lệnh, nhãn BOT và
    chip "Đã đóng sổ" — thiếu một thứ là bài đo xanh rỗng. Chạy lại không nhân đôi, `--reset`
    dọn sạch cả hai tài khoản."""
    chay_seed("seed_e2e")

    bot = User.objects.get(username=seed_e2e.USERNAME_BOT)
    assert bot.la_bot is True
    assert not User.objects.get(username=seed_e2e.USERNAME_DONG_SO).la_bot

    mo = Mach.objects.get(title=seed_e2e.TIEU_DE_NHAT_KY_BOT)
    assert mo.loai_mach == Mach.LoaiMach.NHAT_KY and mo.status == Mach.TrangThai.MO
    assert (mo.lenh_chieu, mo.lenh_ma) == ("mua", "E2EBOT")  # server IN HOA
    assert mo.lenh_nhoi is not None and mo.lenh_sl is not None and mo.lenh_tp is not None

    dong = Mach.objects.get(title=seed_e2e.TIEU_DE_NHAT_KY_DONG)
    assert dong.status == Mach.TrangThai.DONG

    # Dữ liệu PHỤ phải LÙI SÂU hơn mạch HPG của seed_dev (208 ngày): giờ thật thì hai bài đứng đầu
    # feed "Mới" và đẩy HPG khỏi trang 1 — đã làm 5 bài đo của `vo-reddit.spec.ts` đỏ.
    for m in (mo, dong):
        assert (timezone.now() - m.published_at).days >= 250, m.title
    assert (dong.lenh_chieu, dong.lenh_tp, dong.lenh_nhoi) == ("ban", None, None)

    chay_seed("seed_e2e")
    assert Mach.objects.filter(lenh_chieu__isnull=False).count() == 2

    chay_seed("seed_e2e", "--reset")
    assert Mach.objects.filter(lenh_chieu__isnull=False).count() == 2
    chay_seed("seed_e2e", "--reset")
    assert User.objects.filter(username=seed_e2e.USERNAME_BOT).count() == 1


def _dung_mach_la_trong_sub_e2e(*, email: str, username: str, co_anh: bool = False):
    """Một mạch (tuỳ chọn có 1 ảnh gallery thật) của tác giả `email` trong sub của bộ e2e."""
    from core.anh import xu_ly_anh_tai_len
    from core.ghi import tao_mach, them_anh_moc

    sub = Sub.objects.get(slug=seed_e2e.SUB_SLUG)
    tac_gia = User.objects.create(username=username, email=email)
    mach, moc = tao_mach(
        sub=sub, author=tac_gia, title=f"Mạch lạ của {username}", body="Mốc 1.",
        loai_mach=Mach.LoaiMach.NHAT_KY,
    )
    anh = None
    if co_anh:
        anh = them_anh_moc(moc=moc, anh=xu_ly_anh_tai_len(seed_e2e._png_seed(600, 400, 3)))
    return mach, anh


def test_seed_e2e_reset_tu_choi_khi_con_mach_cua_nguoi_that_trong_sub_e2e(
    kho_anh, django_capture_on_commit_callbacks
):
    """Dọn HỤT chứ không dọn NHẦM: mạch trong sub e2e mà tác giả KHÔNG thuộc miền
    `MIEN_E2E` (người thật đăng vào) ⇒ `--reset` dừng bằng `CommandError`, không xoá gì."""
    phuc_vu, _ = kho_anh
    chay_seed("seed_e2e")
    that, anh = _dung_mach_la_trong_sub_e2e(
        email="nguoi.that@example.com", username="nguoi_that", co_anh=True
    )
    # Một mạch rác hợp lệ cạnh đó: cũng KHÔNG được bị xoá khi lệnh dừng.
    rac, _ = _dung_mach_la_trong_sub_e2e(
        email="rac_dung_dem" + seed_e2e.MIEN_E2E, username="rac_dung_dem"
    )
    truoc = (
        Mach.objects.count(), User.objects.count(), Sub.objects.count(),
        MocAnh.objects.count(), AnhNoiDung.objects.count(), _file_tren_dia(phuc_vu),
    )

    with django_capture_on_commit_callbacks(execute=True):
        with pytest.raises(CommandError) as loi:
            chay_seed("seed_e2e", "--reset")

    assert str(that.pk) in str(loi.value), "thông báo phải nêu id mạch lạ"
    assert Mach.objects.filter(pk__in=[that.pk, rac.pk]).count() == 2
    assert (
        Mach.objects.count(), User.objects.count(), Sub.objects.count(),
        MocAnh.objects.count(), AnhNoiDung.objects.count(), _file_tren_dia(phuc_vu),
    ) == truoc, "DB và đĩa không được đổi"
    assert (phuc_vu / THU_MUC_ANH / anh.khoa_luu_tru).is_file()


def test_seed_e2e_reset_loi_giua_chung_khong_lam_mat_file_anh(
    kho_anh, django_capture_on_commit_callbacks
):
    """`handle` là `atomic`: `--reset` chết ở `users.delete()` thì DB hoàn tác. File ảnh mà đã
    xoá trước đó thì `MocAnh` còn đó trỏ vào hư không (và seed lần sau thấy `MocAnh` còn nên
    không dựng lại). Ca thật: `e2e_nguoi_binh_luan` có bình luận trong mạch NGƯỜI KHÁC ngoài
    sub e2e ⇒ `Comment.author` là PROTECT ⇒ `ProtectedError`."""
    from core.ghi import tao_binh_luan, tao_mach

    phuc_vu, _ = kho_anh
    chay_seed("seed_e2e")
    khac = Sub.objects.create(slug="chuyen-muc-khac", ten="Chuyên mục khác")
    chu = User.objects.create(username="chu_mach_ngoai", email="chu@vi-du.gikky.net")
    mach_ngoai, _ = tao_mach(
        sub=khac, author=chu, title="Mạch ngoài sub e2e", body="Mốc 1.",
        loai_mach=Mach.LoaiMach.NHAT_KY,
    )
    tao_binh_luan(
        mach=mach_ngoai,
        author=User.objects.get(username=seed_e2e.USERNAME_BINH_LUAN),
        body="Bình luận của user seed vào mạch người khác.",
    )
    truoc_dia = _file_tren_dia(phuc_vu)
    truoc_anh = MocAnh.objects.count()
    assert truoc_anh > 0 and truoc_dia, "tiền đề: seed có ảnh thật"

    with django_capture_on_commit_callbacks(execute=True):
        with pytest.raises(ProtectedError):
            chay_seed("seed_e2e", "--reset")

    assert MocAnh.objects.count() == truoc_anh, "DB hoàn tác"
    assert _file_tren_dia(phuc_vu) == truoc_dia, "file ảnh không được mất khi DB hoàn tác"
    for khoa in MocAnh.objects.values_list("khoa_luu_tru", flat=True):
        assert (phuc_vu / THU_MUC_ANH / khoa).is_file()


def test_seed_e2e_reset_xoa_ca_hang_lan_file_anh_cua_mach_rac(
    kho_anh, django_capture_on_commit_callbacks
):
    """Mạch rác `@gikky.test` có ảnh trong sub e2e: `--reset` xoá mạch, hàng `MocAnh` (cascade)
    VÀ file — nếu không, file mồ côi nằm lại vì khoá ảnh chỉ gom của 5 user seed."""
    phuc_vu, _ = kho_anh
    chay_seed("seed_e2e")
    rac, anh = _dung_mach_la_trong_sub_e2e(
        email="rac_co_anh" + seed_e2e.MIEN_E2E, username="rac_co_anh", co_anh=True
    )
    khoa = anh.khoa_luu_tru
    assert (phuc_vu / THU_MUC_ANH / khoa).is_file()
    assert (phuc_vu / THU_MUC_THUMB / khoa).is_file()

    with django_capture_on_commit_callbacks(execute=True):
        chay_seed("seed_e2e", "--reset")

    assert not Mach.objects.filter(pk=rac.pk).exists()
    assert not MocAnh.objects.filter(khoa_luu_tru=khoa).exists()
    assert not (phuc_vu / THU_MUC_ANH / khoa).exists(), "file ảnh của mạch rác mồ côi"
    assert not (phuc_vu / THU_MUC_THUMB / khoa).exists()
    # Tài khoản rác không bị xoá (chỉ mạch của nó trong sub e2e).
    assert User.objects.filter(username="rac_co_anh").exists()


def test_seed_e2e_dung_ban_tin_du_ca_cho_dot_B(client):
    """Việc 20 — bốn ngày bản tin: đủ khung / đã ẩn / thiếu khung / chuyển từ mạch cũ."""
    chay_seed("seed_e2e")
    hom_nay = seed_e2e.ngay_vn()
    bt = {b.ngay: b for b in BanTin.objects.all()}
    assert len(bt) == len(seed_e2e.BAN_TIN) == 4
    for ca in seed_e2e.BAN_TIN:
        b = bt[hom_nay - seed_e2e.timedelta(days=ca["lui"])]
        assert (b.hidden_at is not None) == ca["an"]
        assert sorted(b.khung.values_list("khung", flat=True)) == sorted(ca["khung"])
        assert (b.mach_cu is not None) == bool(ca.get("mach_cu"))
    cu = BanTin.objects.get(mach_cu__isnull=False).mach_cu
    assert cu.archived_at is not None, "mạch của ca 301 phải đã lưu trữ"
    assert lay(client, f"/api/v1/ban-tin/tu-mach/{cu.pk}")["ngay"]

    # Chạy lại không nhân đôi; --reset dọn rồi dựng lại đúng bốn.
    chay_seed("seed_e2e")
    assert BanTin.objects.count() == 4
    chay_seed("seed_e2e", "--reset")
    assert BanTin.objects.count() == 4
