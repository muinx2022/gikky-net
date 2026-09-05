"""Email digest tuần — PLAN 5.8, Phase 6.

Ba nhóm, ba câu hỏi khác nhau:

1. **luật thời gian** — "8:00 sáng thứ Bảy **giờ VN**" phải đúng trên một máy chủ chạy
   UTC. Đây là nhóm quan trọng nhất và cũng là nhóm rẻ nhất để làm sai: một
   `khi.hour == 8` trên `datetime` UTC gửi vào 15:00 chiều và im lặng bỏ 8:00 sáng;
2. **nội dung** — mạch nào vào thư, mốc nào không tính, thư rỗng thì không gửi;
3. **lệnh** — thư có thật sự tới `django.core.mail` không, và lệnh có nói ra rằng
   `nguoi_nhan_digest()` đang rỗng (chỗ cắm của Phase 3) thay vì báo "xong" không.

**Không có bài đo nào chạm SMTP.** Máy này không có; `pytest` chạy dưới backend `locmem`
mà `setup_test_environment()` của Django cắm vào, nên `mail.outbox` là chỗ đo. Ranh giới
đo được dừng ở "đã giao cho backend".
"""

from datetime import datetime, timedelta
from io import StringIO

import pytest
from django.core import mail
from django.core.management import CommandError, call_command

from core import digest as md
from core.digest import (
    NguoiNhan,
    cua_so,
    dung_digest,
    duong_dan_mach,
    gom_dien_bien,
    la_gio_gui,
)
from core.ghi import them_moc
from core.models import Moc
from core.thoi_gian import TZ_VN
from tests._an_mach import an_mach_tho

GOC = "https://gikky.net"


def vn(nam, thang, ngay, gio=0, phut=0) -> datetime:
    return datetime(nam, thang, ngay, gio, phut, tzinfo=TZ_VN)


# --- 1. Luật thời gian -------------------------------------------------------


def test_gui_dung_8h_sang_thu_bay_gio_vn():
    # 2026-08-22 là thứ Bảy.
    assert vn(2026, 8, 22).weekday() == md.THU_GUI
    assert la_gio_gui(vn(2026, 8, 22, 8, 0))
    assert la_gio_gui(vn(2026, 8, 22, 8, 59))


@pytest.mark.parametrize(
    "khi, vi_sao",
    [
        (vn(2026, 8, 22, 7, 59), "trước 8h"),
        (vn(2026, 8, 22, 9, 0), "sau 8h"),
        (vn(2026, 8, 21, 8, 0), "thứ Sáu"),
        (vn(2026, 8, 23, 8, 0), "Chủ nhật"),
    ],
)
def test_khong_gui_ngoai_khung(khi, vi_sao):
    assert not la_gio_gui(khi), vi_sao


def test_lech_7_tieng_khong_lot():
    """Cái bẫy thật: một `datetime` **UTC** mà đọc thẳng `.hour`.

    `2026-08-22T08:00Z` là **15:00 chiều** giờ VN — cách cài sai sẽ gửi vào đúng lúc đó
    và **không** gửi lúc 8:00 sáng. Cùng loài lệch 7 tiếng mà `core/thoi_gian.py` được
    viết ra để dồn về một chỗ; nó chỉ lộ ra ngoài khung 17:00–24:00, tức khung giờ ít
    người chạy test nhất.
    """
    tam_gio_utc = datetime.fromisoformat("2026-08-22T08:00:00+00:00")
    assert tam_gio_utc.hour == 8, "tiền đề: đọc thẳng .hour ra 8"
    assert not la_gio_gui(tam_gio_utc), "8:00 UTC là 15:00 giờ VN — KHÔNG được gửi"

    # …và chiều ngược lại: 01:00 UTC LÀ 8:00 sáng giờ VN, phải gửi.
    tam_gio_vn = datetime.fromisoformat("2026-08-22T01:00:00+00:00")
    assert tam_gio_vn.hour == 1
    assert la_gio_gui(tam_gio_vn)


def test_cua_so_truot_theo_thoi_diem_gui():
    den = vn(2026, 8, 22, 8, 0)
    tu, den_lai = cua_so(den)
    assert den_lai == den
    assert tu == vn(2026, 8, 15, 8, 0)
    # Hai lần gửi liên tiếp phủ kín nhau, không chồng lấn: cuối cửa sổ này = đầu cửa sổ sau.
    assert cua_so(den + timedelta(days=7))[0] == den


# --- 2. Nội dung -------------------------------------------------------------


def test_khong_co_dien_bien_thi_KHONG_dung_thu(mach, tac_gia):
    """Digest rỗng phải là `None`, không phải một email "tuần này không có gì".

    Một email hằng tuần nói "không có gì" là cách nhanh nhất để người ta huỷ đăng ký.
    """
    den = mach.created_at + timedelta(days=30)
    tu, _ = cua_so(den)
    nn = NguoiNhan(user=tac_gia, mach_ids=(mach.pk,))
    assert dung_digest(nn, tu, den, GOC) is None


def test_thu_noi_ra_ten_mach_so_moc_moi_va_link(mach, tac_gia, nguoi_khac):
    them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    them_moc(mach=mach, author=tac_gia, body="Mốc 3.")
    mach.refresh_from_db()

    den = mach.last_entry_at + timedelta(minutes=1)
    tu, _ = cua_so(den)
    thu = dung_digest(NguoiNhan(nguoi_khac, (mach.pk,)), tu, den, GOC)

    assert thu is not None
    assert thu.so_mach == 1
    # Mốc 1 nằm NGOÀI cửa sổ? Không — nó vừa được tạo cùng lúc, nên cả 3 mốc đều mới.
    assert "3 mốc mới" in thu.tieu_de
    assert mach.title in thu.than
    assert f"{GOC}/m/{mach.slug}-{mach.pk}" in thu.than
    assert f"s/{mach.sub.slug}" in thu.than
    assert "mốc 3/3" in thu.than
    # Xưng hô theo `display_name` nếu có.
    assert nguoi_khac.display_name in thu.than
    # PLAN 5.10: mọi nơi phát ra nội dung người dùng phải kèm disclaimer.
    assert "không phải khuyến nghị đầu tư" in thu.than
    assert "Bỏ nhận thư" in thu.than
    # L14 (vá V1): câu ấy **không được** in một URL chưa có trang. Bản trước trỏ
    # `{goc_site}/cai-dat` trong khi `apps/web/app/cai-dat` không tồn tại — lối thoát duy
    # nhất của một lá thư định kỳ là một link 404. Ghim theo chuỗi để nó không quay lại
    # trước khi trang ấy có thật.
    assert "/cai-dat" not in thu.than



@pytest.mark.django_db
def test_than_thu_KHONG_chua_the_html(mach, tac_gia, nguoi_khac):
    """Thân thư là **văn bản thuần** (docstring `dung_digest`) — và nay `Moc.body` là HTML.

    Hôm nay mẫu thư chỉ nhúng `title`/`slug`/số đếm, không nhúng trích đoạn `body` nào, nên
    bài đo này là một **cái chuông** chứ không phải một phép sửa: ngày ai đó thêm "hai dòng
    đầu của mốc mới nhất" cho thư đỡ khô, nó đỏ ngay và người ấy biết phải gọi
    `core/lam_sach_html.py::van_ban_thuan`. Thiếu chuông thì lá thư đi ra với `<p>` giữa
    dòng, ở một kênh không ai xem lại trước khi gửi.
    """
    them_moc(
        mach=mach,
        author=tac_gia,
        body='<p>Mốc 2 <strong>quan trọng</strong>.</p><script>alert(1)</script>',
    )
    mach.refresh_from_db()

    den = mach.last_entry_at + timedelta(minutes=1)
    thu = dung_digest(NguoiNhan(nguoi_khac, (mach.pk,)), *cua_so(den), GOC)

    assert thu is not None
    assert "<" not in thu.than, thu.than
    assert "<" not in thu.tieu_de, thu.tieu_de


def test_khong_co_display_name_thi_xung_ho_bang_username(mach, tac_gia):
    from tests.conftest import dung_user

    tran = dung_user("khong_ten")
    them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    mach.refresh_from_db()
    den = mach.last_entry_at + timedelta(minutes=1)
    thu = dung_digest(NguoiNhan(tran, (mach.pk,)), *cua_so(den), GOC)
    assert thu is not None and "Chào khong_ten," in thu.than


def test_duong_dan_mach_dung_luat_plan_5_9(mach):
    assert duong_dan_mach(mach) == f"/m/{mach.slug}-{mach.pk}"


def test_moc_bia_mo_va_moc_bi_an_KHONG_tinh_la_dien_bien(mach, tac_gia, nguoi_khac):
    """Báo "có mốc mới" rồi bấm vào thấy `[đã xoá]` tệ hơn im lặng."""
    moc2 = them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    moc3 = them_moc(mach=mach, author=tac_gia, body="Mốc 3.")
    mach.refresh_from_db()
    den = mach.last_entry_at + timedelta(minutes=1)
    tu, _ = cua_so(den)

    truoc = dung_digest(NguoiNhan(nguoi_khac, (mach.pk,)), tu, den, GOC)
    assert truoc is not None and "3 mốc mới" in truoc.tieu_de

    Moc.objects.filter(pk=moc2.pk).update(deleted_at=den)
    Moc.objects.filter(pk=moc3.pk).update(hidden_at=den)
    sau = dung_digest(NguoiNhan(nguoi_khac, (mach.pk,)), tu, den, GOC)
    assert sau is not None and "1 mốc mới" in sau.tieu_de


def test_mach_bi_mod_an_bien_khoi_digest(mach, tac_gia, nguoi_khac):
    them_moc(mach=mach, author=tac_gia, body="Mốc 2.")
    mach.refresh_from_db()
    den = mach.last_entry_at + timedelta(minutes=1)
    tu, _ = cua_so(den)

    assert dung_digest(NguoiNhan(nguoi_khac, (mach.pk,)), tu, den, GOC) is not None
    an_mach_tho(type(mach).objects.filter(pk=mach.pk), den)
    assert dung_digest(NguoiNhan(nguoi_khac, (mach.pk,)), tu, den, GOC) is None


def test_moc_ngoai_cua_so_khong_tinh(mach, tac_gia, nguoi_khac):
    """Vế chống rỗng của cả nhóm: cửa sổ phải thật sự CẮT thứ gì đó."""
    mach.refresh_from_db()
    den = mach.last_entry_at + timedelta(days=30)
    tu, _ = cua_so(den)
    assert tu > mach.last_entry_at
    assert gom_dien_bien((mach.pk,), tu, den) == []


def test_mach_nhieu_moc_moi_xep_TREN(sub, tac_gia, nguoi_khac):
    from core.ghi import tao_mach

    it_moc, _ = tao_mach(sub=sub, author=tac_gia, title="Mạch ít mốc", body="1")
    nhieu_moc, _ = tao_mach(sub=sub, author=tac_gia, title="Mạch nhiều mốc", body="1")
    for _ in range(3):
        them_moc(mach=nhieu_moc, author=tac_gia, body="thêm")
    nhieu_moc.refresh_from_db()

    den = nhieu_moc.last_entry_at + timedelta(minutes=1)
    tu, _ = cua_so(den)
    muc = gom_dien_bien((it_moc.pk, nhieu_moc.pk), tu, den)
    assert [m.mach.title for m in muc] == ["Mạch nhiều mốc", "Mạch ít mốc"]
    assert [m.so_moc_moi for m in muc] == [4, 1]


def test_cat_bot_khi_qua_nhieu_mach(sub, tac_gia, nguoi_khac, monkeypatch):
    """Người theo 80 mạch mà nhận email 80 mục thì không đọc mục nào."""
    from core.ghi import tao_mach

    monkeypatch.setattr(md, "SO_MACH_TOI_DA", 2)
    ids = [
        tao_mach(sub=sub, author=tac_gia, title=f"Mạch {i}", body="1")[0].pk
        for i in range(4)
    ]
    den = vn(2100, 1, 1)
    tu, _ = cua_so(den, so_ngay=40_000)
    thu = dung_digest(NguoiNhan(nguoi_khac, tuple(ids)), tu, den, GOC)
    assert thu is not None and thu.so_mach == 4
    assert "và 2 mạch nữa" in thu.than


# --- 3. Lệnh -----------------------------------------------------------------


#: Đồng hồ giả cho cả nhóm: **8:30 sáng thứ Bảy 22/08/2026 giờ VN**, đúng khung PLAN.
#:
#: Cố định chứ không "hôm nay": lệnh gộp diễn biến trong cửa sổ `[gửi − 7 ngày, gửi)`, mà
#: mốc do fixture dựng mang dấu thời gian THẬT của lúc chạy test. Neo cả hai đầu vào một
#: mốc cố định (`KHI_MOC` dưới đây) là bộ test cho cùng kết quả hôm nay, tháng sau, và
#: trên máy CI đặt giờ UTC.
BAY_GIO_GUI = "2026-08-22T08:30+07:00"
#: Nằm GỌN trong cửa sổ 7 ngày của `BAY_GIO_GUI`.
KHI_MOC = vn(2026, 8, 20, 10, 0)


def goi(**co) -> str:
    ra = StringIO()
    call_command("gui_digest", stdout=ra, **co)
    return ra.getvalue()


def moc_trong_cua_so(mach, tac_gia) -> None:
    """Một mốc mang dấu thời gian nằm trong cửa sổ của `BAY_GIO_GUI`.

    `_created_at_seed` là cửa duy nhất đặt được `created_at` (nó `editable=False`) —
    cùng cửa mà `seed_dev` dùng để dựng một mạch trải 163 ngày.
    """
    them_moc(mach=mach, author=tac_gia, body="Mốc 2.", _created_at_seed=KHI_MOC)


def test_khong_ai_opt_in_thi_rong_va_lenh_NOI_RA_VI_SAO(db):
    """DB không có ai bật `nhan_digest` ⇒ rỗng, và lệnh không được báo "xong" rỗng tuếch.

    *(Đổi ở Phase 3, 2026-08-23.)* Bản trước khẳng định `nguoi_nhan_digest()` **luôn** trả
    `[]` và đòi chữ "Phase 3" trong thông báo — đúng khi hàm còn là một chỗ cắm, nhưng nó
    là bài đo sẽ **vẫn xanh** sau khi hàm được cắm mà cắm sai (trả rỗng vô điều kiện). Nay
    nó đo đúng thứ đo được: DB rỗng ⇒ danh sách rỗng, và lời cảnh báo chỉ ra điều kiện
    thiếu. Vế "cắm đúng thì trả người thật" nằm ở
    `test_nguoi_nhan_digest_doc_bang_Follow_va_giu_du_ba_luat`.
    """
    assert md.nguoi_nhan_digest() == []
    ra = goi()
    assert "nhan_digest" in ra and "opt-in" in ra
    assert mail.outbox == []


# --- Cắm vào bảng `Follow` (Phase 3, 2026-08-23) -----------------------------


def test_nguoi_nhan_digest_doc_bang_Follow_va_giu_du_ba_luat(
    mach, tac_gia, nguoi_khac, sub
):
    """Ba luật mà Mảng D ghi sẵn ở docstring, đo từng cái một.

    Chúng không suy ra được từ chữ ký hàm, nên chúng là ba chỗ một bản cắm "đúng về mặt
    hình dạng" vẫn sai — và sai im lặng: hàm vẫn trả một danh sách, thư vẫn đi.
    """
    from core.models import Follow, User

    def dung(ten: str, **cot) -> User:
        return User.objects.create(
            username=ten, email=f"{ten}@vi-du.gikky.net", **cot
        )

    opt_in = dung("opt_in", nhan_digest=True)
    khong_opt_in = dung("khong_opt_in", nhan_digest=False)
    da_nghi = dung("da_nghi", nhan_digest=True, is_active=False)
    khong_email = User.objects.create(username="khong_email", email="", nhan_digest=True)

    for u in (opt_in, khong_opt_in, da_nghi, khong_email):
        Follow.objects.create(user=u, mach=mach)
    # Luật 3: tác giả theo mạch của CHÍNH MÌNH — mọi diễn biến của mạch đều do họ viết
    # (chỉ tác giả nối được mốc), nên không có gì để báo lại cho họ.
    tac_gia.nhan_digest = True
    tac_gia.save(update_fields=["nhan_digest"])
    Follow.objects.create(user=tac_gia, mach=mach)

    ra = md.nguoi_nhan_digest()
    assert [n.user.username for n in ra] == ["opt_in"], (
        "đúng một người đủ ba điều kiện; ai lọt thêm là một luật vừa bị bỏ"
    )
    assert ra[0].mach_ids == (mach.pk,)


def test_mach_cua_chinh_minh_bi_loai_nhung_mach_nguoi_khac_thi_khong(
    mach, tac_gia, nguoi_khac, sub
):
    """Luật 3 loại đúng **mạch của chính họ**, không loại cả người.

    Một `exclude(user=...)` viết hụt sẽ làm người vừa mở mạch đầu tiên của mình mất luôn
    digest cho mọi mạch khác họ theo — im lặng, và chỉ lộ ra sau vài tuần không nhận thư.
    """
    from core.ghi import tao_mach
    from core.models import Follow

    cua_toi, _ = tao_mach(sub=sub, author=nguoi_khac, title="Mạch của tôi", body="x")
    nguoi_khac.nhan_digest = True
    nguoi_khac.email = "ai_do@vi-du.gikky.net"
    nguoi_khac.save(update_fields=["nhan_digest", "email"])
    Follow.objects.create(user=nguoi_khac, mach=cua_toi)
    Follow.objects.create(user=nguoi_khac, mach=mach)

    ra = md.nguoi_nhan_digest()
    assert len(ra) == 1
    assert ra[0].mach_ids == (mach.pk,), "mạch của chính họ phải bị loại, người thì không"


def test_mach_bi_mod_an_khong_vao_danh_sach_theo_doi(mach, tac_gia, nguoi_khac):
    """Mạch bị mod ẩn thì không có gì để báo — `gom_dien_bien` cũng lọc, nhưng lọc sớm
    ở đây giữ cho `NguoiNhan.mach_ids` không mang id của thứ không ai đọc được."""
    from django.utils import timezone

    from core.models import Follow

    nguoi_khac.nhan_digest = True
    nguoi_khac.email = "ai_do@vi-du.gikky.net"
    nguoi_khac.save(update_fields=["nhan_digest", "email"])
    Follow.objects.create(user=nguoi_khac, mach=mach)
    mach.hidden_at = timezone.now()
    mach.hidden_by = mach.author
    mach.save(update_fields=["hidden_at", "hidden_by"])

    assert md.nguoi_nhan_digest() == []


def test_lenh_gui_that_khi_co_nguoi_nhan(mach, tac_gia, nguoi_khac, monkeypatch):
    moc_trong_cua_so(mach, tac_gia)
    nguoi_khac.email = "ai_do@vi-du.gikky.net"
    nguoi_khac.save(update_fields=["email"])
    monkeypatch.setattr(
        md, "nguoi_nhan_digest", lambda: [NguoiNhan(nguoi_khac, (mach.pk,))]
    )

    ra = goi(bay_gio=BAY_GIO_GUI)
    assert "đã giao 1 thư" in ra
    assert len(mail.outbox) == 1
    thu = mail.outbox[0]
    assert thu.to == ["ai_do@vi-du.gikky.net"]
    assert mach.title in thu.body
    # Mốc 1 nằm ngoài cửa sổ (nó mang dấu thời gian thật của lúc chạy test), chỉ mốc 2
    # được `_created_at_seed` đặt vào trong — nên đúng MỘT mốc mới.
    assert "1 mốc mới" in thu.subject


def test_lenh_nhap_KHONG_gui(mach, tac_gia, nguoi_khac, monkeypatch):
    moc_trong_cua_so(mach, tac_gia)
    monkeypatch.setattr(
        md, "nguoi_nhan_digest", lambda: [NguoiNhan(nguoi_khac, (mach.pk,))]
    )
    ra = goi(nhap=True, bay_gio=BAY_GIO_GUI)
    assert "KHÔNG gửi gì" in ra
    assert mach.title in ra
    assert mail.outbox == []


def test_theo_lich_bo_qua_ngoai_khung_va_chay_trong_khung(
    mach, tac_gia, nguoi_khac, monkeypatch
):
    """Nghiệm thu PLAN mục 10: *"digest gửi đúng 8:00 thứ Bảy VN … (giả lập đồng hồ)"*."""
    moc_trong_cua_so(mach, tac_gia)
    monkeypatch.setattr(
        md, "nguoi_nhan_digest", lambda: [NguoiNhan(nguoi_khac, (mach.pk,))]
    )

    ra = goi(theo_lich=True, bay_gio="2026-08-21T08:30+07:00")  # thứ Sáu
    assert "không phải 8:00" in ra
    assert mail.outbox == []

    # Cùng cấu hình, chỉ đổi đồng hồ sang đúng khung: phải gửi.
    goi(theo_lich=True, bay_gio=BAY_GIO_GUI)
    assert len(mail.outbox) == 1


def test_theo_lich_doc_gio_VN_chu_khong_phai_gio_may_chu(
    mach, tac_gia, nguoi_khac, monkeypatch
):
    """Hai ca cùng bắt một lỗi: đọc đồng hồ ở múi giờ sai.

    - `2026-08-22T08:30+00:00` là **15:30 chiều** giờ VN ⇒ KHÔNG gửi (cách cài sai sẽ gửi);
    - `2026-08-22T08:00` **không kèm offset** phải hiểu là 8 giờ sáng của PLAN, không phải
      giờ máy chủ (UTC trên prod) ⇒ PHẢI gửi.
    """
    moc_trong_cua_so(mach, tac_gia)
    monkeypatch.setattr(
        md, "nguoi_nhan_digest", lambda: [NguoiNhan(nguoi_khac, (mach.pk,))]
    )

    ra = goi(theo_lich=True, bay_gio="2026-08-22T08:30+00:00")
    assert "không phải 8:00" in ra
    assert mail.outbox == []

    goi(theo_lich=True, bay_gio="2026-08-22T08:00")
    assert len(mail.outbox) == 1


def test_bay_gio_rac_va_so_ngay_sai_thi_LOI_RO_RANG(db):
    with pytest.raises(CommandError, match="ISO 8601"):
        goi(bay_gio="hôm qua")
    with pytest.raises(CommandError, match="so-ngay"):
        goi(so_ngay=0)
