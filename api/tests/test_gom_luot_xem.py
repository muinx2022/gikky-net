"""`gom_luot_xem` — nhóm T của `plans/2026-08-27-thong-ke-luot-xem.md` §8.

⚠ **Seed của file này cố ý trải trên NHIỀU ngày, và ít nhất một ngày > 90 ngày trước.**
Plan nói thẳng vì sao: T1 và T4 là hai bài dễ ra "đúng bất kể code làm gì" nhất nếu dữ
liệu chỉ có một ngày — với một ngày duy nhất thì "gộp đúng", "không gộp hôm nay" và
"xoá đúng phần đã gộp" trùng nhau thành một mệnh đề tầm thường.

Bốn ngày trong `dung_du_lieu()`:

| Ngày | Vì sao có mặt |
|---|---|
| hôm nay | phải KHÔNG được gộp (T2) và phải được cộng riêng ở "toàn thời gian" (T4) |
| hôm qua | ngày đã xong, trong 90 ngày ⇒ gộp nhưng **không** bị dọn |
| 95 ngày trước | quá 90 ngày ⇒ gộp rồi **bị dọn** (T3) |
| 120 ngày trước | quá 90 ngày, và **cố ý KHÔNG gộp** ở một bài ⇒ phải ở lại (T3) |
"""

from datetime import datetime, time, timedelta

import pytest
from django.core.management import call_command

from core.management.commands.gom_luot_xem import (
    DUONG_DAN_KHAC,
    SO_NGAY_GIU_THO,
    don,
    gom,
)
from core.models.luot_xem import LuotXem, TongNgay
from core.thoi_gian import TZ_VN, ngay_vn


def luc(ngay, gio=12):
    """Một thời điểm **giờ VN** trong `ngay` — không phải giờ UTC.

    Đặt 12h trưa để phép đổi múi giờ không kéo hàng sang ngày bên cạnh: 00:30 giờ VN là
    17:30 UTC hôm trước, và một bài đo dựng dữ liệu ở đó sẽ đo cả bug lẫn múi giờ cùng lúc.
    """
    return datetime.combine(ngay, time(gio, 0), tzinfo=TZ_VN)


def them(ngay, duong_dan, *, bot=False, gio=12):
    return LuotXem.objects.create(
        duong_dan=duong_dan,
        luc=luc(ngay, gio),
        la_bot=bot,
        ten_bot="googlebot" if bot else "",
    )


@pytest.fixture
def hom_nay():
    return ngay_vn()


@pytest.fixture
def ngay(hom_nay):
    """Bốn mốc ngày dùng chung — xem bảng ở docstring module."""
    return {
        "hom_nay": hom_nay,
        "hom_qua": hom_nay - timedelta(days=1),
        "qua_han": hom_nay - timedelta(days=95),
        "rat_cu": hom_nay - timedelta(days=120),
    }


@pytest.fixture
def du_lieu(db, ngay):
    """Bốn ngày, ba đường dẫn, người lẫn bot. Trả về chính `ngay` cho tiện đọc."""
    # hôm nay — 3 người + 1 bot trên `/`
    for _ in range(3):
        them(ngay["hom_nay"], "/")
    them(ngay["hom_nay"], "/", bot=True)
    # hôm qua — 2 người trên `/`, 1 người + 2 bot trên `/m/abc-1`
    them(ngay["hom_qua"], "/")
    them(ngay["hom_qua"], "/")
    them(ngay["hom_qua"], "/m/abc-1")
    them(ngay["hom_qua"], "/m/abc-1", bot=True)
    them(ngay["hom_qua"], "/m/abc-1", bot=True)
    # 95 ngày trước — 5 người trên `/s/chung-khoan`
    for _ in range(5):
        them(ngay["qua_han"], "/s/chung-khoan")
    # 120 ngày trước — 4 bot trên `/`
    for _ in range(4):
        them(ngay["rat_cu"], "/", bot=True)
    return ngay


def tong_cua(ngay_, duong_dan):
    return TongNgay.objects.get(ngay=ngay_, duong_dan=duong_dan)


# --- T1: gộp đúng, và chạy hai lần ra cùng kết quả ---------------------------


def test_T1_gop_dung_tach_nguoi_va_bot(du_lieu):
    gom()
    assert tong_cua(du_lieu["hom_qua"], "/").so_luot_nguoi == 2
    assert tong_cua(du_lieu["hom_qua"], "/").so_luot_bot == 0
    assert tong_cua(du_lieu["hom_qua"], "/m/abc-1").so_luot_nguoi == 1
    assert tong_cua(du_lieu["hom_qua"], "/m/abc-1").so_luot_bot == 2
    assert tong_cua(du_lieu["qua_han"], "/s/chung-khoan").so_luot_nguoi == 5
    assert tong_cua(du_lieu["rat_cu"], "/").so_luot_bot == 4
    # …và ba ngày ĐÃ XONG cho ra đúng 4 hàng (2 đường ở hôm qua + 1 + 1).
    assert TongNgay.objects.count() == 4


def test_T1b_chay_hai_lan_ra_CUNG_ket_qua(du_lieu):
    """Idempotent — upsert theo khoá `(ngay, duong_dan)`, không `create`.

    Không có ràng buộc UNIQUE ấy thì lượt chạy thứ hai đẻ một bộ hàng thứ hai và mọi
    tổng nhân đôi, im lặng. Cron chạy hằng ngày mà lỡ chạy hai lần là hỏng vĩnh viễn.
    """
    gom()
    lan_1 = sorted(
        TongNgay.objects.values_list("ngay", "duong_dan", "so_luot_nguoi", "so_luot_bot")
    )
    gom()
    gom()
    lan_3 = sorted(
        TongNgay.objects.values_list("ngay", "duong_dan", "so_luot_nguoi", "so_luot_bot")
    )
    assert lan_1 == lan_3
    assert TongNgay.objects.count() == 4


def test_T1c_gop_lai_sau_khi_co_them_hang_tho_thi_CAP_NHAT_chu_khong_cong_don(du_lieu):
    """Ngày đã gộp mà có thêm hàng thô ⇒ giá trị mới GHI ĐÈ giá trị cũ.

    Đây là vế phân biệt `update_or_create` với "cộng thêm": cộng thêm cũng cho ra con số
    đúng ở lượt này, rồi sai gấp đôi ở lượt sau. Hàng thô là NGUỒN, `TongNgay` là bản sao.
    """
    gom()
    assert tong_cua(du_lieu["hom_qua"], "/").so_luot_nguoi == 2
    them(du_lieu["hom_qua"], "/")
    gom()
    assert tong_cua(du_lieu["hom_qua"], "/").so_luot_nguoi == 3


# --- T2: KHÔNG gộp ngày hôm nay ---------------------------------------------


def test_T2_khong_gop_ngay_hom_nay(du_lieu):
    """Gộp cả hôm nay là mỗi lượt chạy ra một con số khác cho cùng một ngày.

    Đo bằng "không có hàng nào mang ngày hôm nay", không bằng "số hàng bằng 4": vế thứ
    hai xanh cả khi hôm nay bị gộp mà một ngày khác bị bỏ sót.
    """
    gom()
    assert not TongNgay.objects.filter(ngay=du_lieu["hom_nay"]).exists()
    # …và hàng thô của hôm nay vẫn còn nguyên (4 hàng).
    assert LuotXem.objects.filter(luc__gte=luc(du_lieu["hom_nay"], 0)).count() == 4


def test_T2b_ngay_hom_nay_duoc_gop_SAU_KHI_no_da_qua(du_lieu):
    """Ranh giới "đã xong" trôi theo ngày, không phải một danh sách cứng.

    Chạy lại lệnh với `hom_nay` của **ngày mai** ⇒ hôm nay thành ngày đã xong và được
    gộp. Không có bài này thì một cách cài "bỏ qua ngày hôm nay" bằng cách bỏ qua ngày
    LỚN NHẤT sẽ xanh, và ngày cuối cùng của dữ liệu sẽ không bao giờ được gộp.
    """
    gom(du_lieu["hom_nay"] + timedelta(days=1))
    assert tong_cua(du_lieu["hom_nay"], "/").so_luot_nguoi == 3
    assert tong_cua(du_lieu["hom_nay"], "/").so_luot_bot == 1


# --- T3: dọn hàng thô quá 90 ngày, và CHỈ phần đã gộp -----------------------


def test_T3_don_dung_phan_qua_han_va_giu_phan_con_lai(du_lieu):
    gom()
    da_xoa = don()

    assert da_xoa == 5 + 4, "phải xoá đúng hai ngày quá hạn (95 và 120 ngày trước)"
    ngay_con = {
        h.date()
        for h in LuotXem.objects.values_list("luc", flat=True)
    }
    # Không còn hàng thô nào của hai ngày quá hạn…
    assert not LuotXem.objects.filter(luc__lt=luc(du_lieu["qua_han"], 23)).exists()
    # …và hôm nay + hôm qua còn NGUYÊN (4 + 5 hàng).
    assert LuotXem.objects.count() == 9
    assert ngay_con  # chống bài xanh vì bảng rỗng

    # Bản gộp thì ở lại VĨNH VIỄN — đó là toàn bộ điểm của `TongNgay`.
    assert tong_cua(du_lieu["qua_han"], "/s/chung-khoan").so_luot_nguoi == 5
    assert tong_cua(du_lieu["rat_cu"], "/").so_luot_bot == 4


def test_T3b_ngay_qua_han_CHUA_gop_thi_KHONG_bi_xoa(du_lieu):
    """Mất một ngày thô chưa gộp là mất vĩnh viễn — không có nguồn nào dựng lại.

    Dựng đúng ca đó: gộp **rồi xoá bản gộp của một ngày** (mô phỏng một lượt `gom` chết
    giữa chừng, hoặc một `TongNgay` bị dọn tay), rồi chạy `don()`. Ngày ấy phải ở lại.
    Một bảng hơi phình còn hơn một khoảng trống vĩnh viễn trong biểu đồ.
    """
    gom()
    TongNgay.objects.filter(ngay=du_lieu["rat_cu"]).delete()

    don()

    # Ngày 95 (đã gộp) bị xoá; ngày 120 (bản gộp không còn) ở lại đủ 4 hàng.
    assert not LuotXem.objects.filter(
        luc__gte=luc(du_lieu["qua_han"], 0), luc__lt=luc(du_lieu["qua_han"], 23)
    ).exists()
    assert (
        LuotXem.objects.filter(
            luc__gte=luc(du_lieu["rat_cu"], 0),
            luc__lt=luc(du_lieu["rat_cu"] + timedelta(days=1), 0),
        ).count()
        == 4
    )


def test_T3c_khong_don_gi_khi_chua_gop_lan_nao(du_lieu):
    """`don()` chạy MỘT MÌNH không được xoá gì — nó không giả định `gom()` vừa chạy."""
    assert don() == 0
    # 4 (hôm nay) + 5 (hôm qua) + 5 (95 ngày) + 4 (120 ngày)
    assert LuotXem.objects.count() == 18


def test_T3d_tran_giu_tho_dung_bang_90_ngay():
    """Con số của user ("thô 90 ngày"). Đổi nó là đổi ý nghĩa của bộ chọn khoảng `90`."""
    assert SO_NGAY_GIU_THO == 90


# --- lệnh chạy được qua `call_command` --------------------------------------


def test_lenh_chay_duoc_va_lam_ca_hai_viec(du_lieu):
    """Đường mà cron thật sự gõ. `gom` rồi `don`, theo đúng thứ tự đó."""
    call_command("gom_luot_xem", verbosity=0)
    assert TongNgay.objects.count() == 4
    assert LuotXem.objects.count() == 9


# --- Lượt phản biện 2026-08-27 ------------------------------------------------------


def test_duong_dan_le_te_gom_vao_MOT_hang_va_TONG_khong_doi(db):
    """`TongNgay` giữ MÃI, mà số dòng của nó do NGƯỜI NGOÀI quyết định.

    `duong_dan` là chuỗi tự do; middleware chuyển tiếp mọi pathname kể cả 404. Một script
    gõ `GET /<ngẫu nhiên>` một triệu lần — **không cần secret, chính site tự chuyển tiếp**
    — đẻ một triệu hàng giữ vĩnh viễn. Bot quét `/wp-admin`, `/.env` làm đúng việc ấy mỗi
    ngày ở quy mô nhỏ hơn. Hàng thô có trần 90 ngày nên tự lành; `TongNgay` thì không.

    Ngưỡng phải giữ được **TỔNG**, nếu không bốn con số lớn của trang sai theo — nên phần
    dưới ngưỡng đi vào một hàng `DUONG_DAN_KHAC` chứ không bị vứt.
    """
    hom_qua = ngay_vn() - timedelta(days=1)
    # 3 đường "thật" (đủ ngưỡng) + 50 đường rác 1 lượt.
    for d in ("/", "/m/that-1", "/s/chung-khoan"):
        for _ in range(5):
            them(hom_qua, d)
    for i in range(50):
        them(hom_qua, f"/rac-{i}")

    gom(hom_nay=ngay_vn())

    hang = TongNgay.objects.filter(ngay=hom_qua)
    # 3 đường thật + đúng MỘT hàng gộp — không phải 53.
    assert hang.count() == 4, list(hang.values_list("duong_dan", flat=True))
    assert set(hang.values_list("duong_dan", flat=True)) == {
        "/",
        "/m/that-1",
        "/s/chung-khoan",
        DUONG_DAN_KHAC,
    }
    le_te = hang.get(duong_dan=DUONG_DAN_KHAC)
    assert le_te.so_luot_nguoi + le_te.so_luot_bot == 50

    # ⚠ Phép chấm quan trọng nhất: TỔNG không đổi so với hàng thô.
    tong_gop = sum(h.so_luot_nguoi + h.so_luot_bot for h in hang)
    tong_tho = LuotXem.objects.filter(
        luc__gte=luc(hom_qua, 0), luc__lt=luc(hom_qua + timedelta(days=1), 0)
    ).count()
    assert tong_gop == tong_tho == 65
