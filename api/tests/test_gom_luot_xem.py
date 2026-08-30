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
from core.models.luot_xem import KhachNgay, LuotXem, MuoiNgay, TongNgay
from core.thoi_gian import TZ_VN, ngay_vn


def luc(ngay, gio=12):
    """Một thời điểm **giờ VN** trong `ngay` — không phải giờ UTC.

    Đặt 12h trưa để phép đổi múi giờ không kéo hàng sang ngày bên cạnh: 00:30 giờ VN là
    17:30 UTC hôm trước, và một bài đo dựng dữ liệu ở đó sẽ đo cả bug lẫn múi giờ cùng lúc.
    """
    return datetime.combine(ngay, time(gio, 0), tzinfo=TZ_VN)


def them(ngay, duong_dan, *, bot=False, gio=12, khach=""):
    """Một hàng thô. `khach=""` là mặc định **có chủ đích**: đó là hình dạng của hàng ghi
    TRƯỚC 2026-08-30, và mọi bài đo cũ của file này chạy trên đúng hàng ấy."""
    return LuotXem.objects.create(
        duong_dan=duong_dan,
        luc=luc(ngay, gio),
        la_bot=bot,
        ten_bot="googlebot" if bot else "",
        khach=khach,
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


# ===========================================================================
# Nhóm G — `KhachNgay` + huỷ muối (2026-08-30)
# ===========================================================================
#
# Hai việc mới của lệnh này, và cả hai hỏng im lặng theo hai kiểu khác nhau:
#
# 1. `KhachNgay` ghi 0 cho một ngày KHÔNG đo được ⇒ biểu đồ vẽ ra một ngày vắng tanh nằm
#    cạnh cột "lượt người" cao ngất, và con số ấy nằm lại VĨNH VIỄN (bảng giữ mãi);
# 2. quên xoá `MuoiNgay` ⇒ `LuotXem.khach` của ngày cũ dò ngược được bằng cách thử một
#    danh sách IP, tức cột "khách" lặng lẽ thành một cột nhận diện người.


def test_G_khach_ngay_dem_DISTINCT_dung(db, hom_nay):
    """Ba lượt của hai khách trong cùng ngày ⇒ 2, không phải 3.

    Một người xem nhiều trang vẫn là một khách — đó là toàn bộ lý do `KhachNgay` không
    nằm trong `TongNgay` (khoá của bảng ấy có `duong_dan`, nên cộng theo hàng là đếm
    trùng có hệ thống).
    """
    hom_qua = hom_nay - timedelta(days=1)
    them(hom_qua, "/", khach="a" * 32)
    them(hom_qua, "/m/abc-1", khach="a" * 32)
    them(hom_qua, "/", khach="b" * 32)

    gom(hom_nay)

    assert KhachNgay.objects.get(ngay=hom_qua).so_khach == 2


def test_G_khach_ngay_KHONG_dem_hang_bot(db, hom_nay):
    """Bot có `khach` (đường ghi tính cho mọi hàng), nhưng nó không phải một khách.

    Phía đọc lọc bằng `la_bot`, không bằng "cột nào rỗng" — nên bài này ghim rằng một con
    bot đông đúc không thổi được số khách lên.
    """
    hom_qua = hom_nay - timedelta(days=1)
    them(hom_qua, "/", khach="a" * 32)
    for i in range(9):
        them(hom_qua, "/", bot=True, khach=f"bot{i:029d}")

    gom(hom_nay)

    assert KhachNgay.objects.get(ngay=hom_qua).so_khach == 1


def test_G_ngay_chi_co_BOT_ghi_0_chu_khong_vang_mat(db, hom_nay):
    """0 khách ở một ngày chỉ có bot là một phép ĐO THẬT, nên nó được ghi.

    Vắng mặt dành riêng cho "không đo được". Nhập hai thứ ấy làm một là mất khả năng phân
    biệt *"hôm ấy không ai ghé"* với *"hôm ấy ta chưa biết đo"*.
    """
    hom_qua = hom_nay - timedelta(days=1)
    for _ in range(3):
        them(hom_qua, "/", bot=True, khach="x" * 32)

    gom(hom_nay)

    assert KhachNgay.objects.get(ngay=hom_qua).so_khach == 0


def test_G_ngay_MOI_khach_RONG_thi_KHONG_ghi_hang(db, hom_nay):
    """⚠ Ca thử phá §8.5 — ghi 0 cho ngày này là bịa ra một ngày vắng tanh.

    Đây là hình dạng của **mọi hàng ghi trước 2026-08-30**: có người, có lượt xem, mà cột
    `khach` rỗng vì cơ chế chưa tồn tại. Ghi `so_khach=0` cho chúng là đặt vĩnh viễn vào
    một bảng-giữ-mãi một con số nói *"ngày ấy không ai ghé"* ngay cạnh một cột "lượt
    người" bằng 7 — hai con số mâu thuẫn, và người đọc sẽ tin cái bé hơn.

    Vắng mặt ⇒ endpoint trả `None` ⇒ trang nói "chưa đo".
    """
    hom_qua = hom_nay - timedelta(days=1)
    for _ in range(7):
        them(hom_qua, "/")  # khach="" — hàng cũ

    gom(hom_nay)

    # `TongNgay` VẪN có hàng (lượt xem đo được bình thường) …
    assert TongNgay.objects.filter(ngay=hom_qua).exists()
    # … còn `KhachNgay` thì KHÔNG.
    assert not KhachNgay.objects.filter(ngay=hom_qua).exists()


def test_G_ngay_CHUYEN_TIEP_lan_hang_cu_va_moi_thi_KHONG_ghi(db, hom_nay):
    """Ngày lẫn hàng cũ (`khach=""`) và hàng mới ⇒ VẮNG MẶT — "một phần" không phải phép đo.

    Bản đầu ghi phần đo được (ở đây là 2) với lý lẽ "đừng mất trọn ngày bật tính năng".
    Lượt phản biện 2026-08-30 chỉ ra cái giá thật: deploy giữa ngày với 900 lượt cũ không
    token + 300 lượt mới của 40 khách ⇒ bảng GIỮ MÃI mang con số 40 cho một ngày 1200
    lượt người, không có gì trên màn hình phân biệt nó với một ngày đo đủ, và mod sẽ đọc
    "1200 lượt / 40 khách" như một phép đo. Một ô `None` trung thực hơn một con số thấp
    hơn thật nằm lại vĩnh viễn — mất một ngày ước lượng là cái giá rẻ hơn.

    Ca thử phá: đổi điều kiện của `_khach_moi_ngay` về "chỉ bỏ khi MỌI hàng đều rỗng"
    là bài này đỏ.
    """
    hom_qua = hom_nay - timedelta(days=1)
    them(hom_qua, "/")  # hàng cũ — khach=""
    them(hom_qua, "/", khach="a" * 32)
    them(hom_qua, "/", khach="b" * 32)

    gom(hom_nay)

    # `TongNgay` vẫn có hàng — LƯỢT XEM của ngày ấy đo được bình thường …
    assert TongNgay.objects.filter(ngay=hom_qua).exists()
    # … còn `KhachNgay` thì không.
    assert not KhachNgay.objects.filter(ngay=hom_qua).exists()


def test_G_khach_ngay_IDEMPOTENT(db, hom_nay):
    """Chạy ba lần ra cùng một hàng, cùng một con số — `update_or_create` theo `ngay`."""
    hom_qua = hom_nay - timedelta(days=1)
    them(hom_qua, "/", khach="a" * 32)
    them(hom_qua, "/", khach="b" * 32)

    for _ in range(3):
        gom(hom_nay)

    assert KhachNgay.objects.filter(ngay=hom_qua).count() == 1
    assert KhachNgay.objects.get(ngay=hom_qua).so_khach == 2


def test_G_chay_lai_SAU_KHI_don_hang_tho_KHONG_ghi_de_ve_0(db, hom_nay):
    """Bất biến quan trọng nhất của nhóm: bản gộp không được **tự xoá mình**.

    `KhachNgay` giữ mãi, hàng thô thì bị dọn sau 90 ngày. Nếu `gom()` duyệt theo "mọi
    ngày đã từng có" thay vì "mọi ngày CÒN hàng thô", thì lượt chạy đầu tiên sau khi dọn
    sẽ thấy 0 khách và ghi đè — mất vĩnh viễn, im lặng, và đúng vào những ngày cũ nhất
    (thứ không ai mở ra kiểm).

    Dựng đúng ca đó: gộp → xoá sạch hàng thô của ngày ấy → gộp lại.
    """
    hom_qua = hom_nay - timedelta(days=1)
    them(hom_qua, "/", khach="a" * 32)
    them(hom_qua, "/", khach="b" * 32)
    gom(hom_nay)
    assert KhachNgay.objects.get(ngay=hom_qua).so_khach == 2

    LuotXem.objects.filter(
        luc__gte=luc(hom_qua, 0), luc__lt=luc(hom_qua + timedelta(days=1), 0)
    ).delete()
    gom(hom_nay)

    assert KhachNgay.objects.get(ngay=hom_qua).so_khach == 2


def test_G_khong_ghi_KhachNgay_cho_ngay_HOM_NAY(db, hom_nay):
    """Cùng luật với `TongNgay`: gộp ngày đang chạy là mỗi lượt chạy một con số khác."""
    them(hom_nay, "/", khach="a" * 32)
    gom(hom_nay)
    assert not KhachNgay.objects.filter(ngay=hom_nay).exists()


# --- Huỷ muối --------------------------------------------------------------


def test_G_MUOI_cua_ngay_da_dong_bi_HUY(db, hom_nay):
    """⚠ Ca thử phá §8.2 — bỏ bước xoá `MuoiNgay` là bài này đỏ.

    Chừng nào muối còn sống thì `LuotXem.khach` của ngày ấy **dò ngược được**: cầm DB, thử
    một danh sách IP và vài UA phổ biến là ra ai đã đọc trang nào. Huỷ muối là thứ duy
    nhất biến nó thành token mờ vĩnh viễn — và là điều kiện để câu "không theo dõi được
    qua ngày" ở `core/models/luot_xem.py` đúng theo nghĩa đen.

    Muối của **hôm nay** phải ở lại: đường ghi đang dùng nó, và xoá là mọi lượt xem còn
    lại trong ngày rơi sang một token mới ⇒ một người thành hai khách.
    """
    MuoiNgay.objects.create(ngay=hom_nay, muoi="m-hom-nay")
    MuoiNgay.objects.create(ngay=hom_nay - timedelta(days=1), muoi="m-hom-qua")
    MuoiNgay.objects.create(ngay=hom_nay - timedelta(days=40), muoi="m-cu")

    gom(hom_nay)

    con_lai = set(MuoiNgay.objects.values_list("ngay", flat=True))
    assert con_lai == {hom_nay}


def test_G_muoi_bi_HUY_ke_ca_khi_khong_co_hang_tho_nao(db, hom_nay):
    """Xoá muối là **vô điều kiện**, khác hẳn bước dọn hàng thô.

    Hai bước hai lý lẽ: dọn hàng thô sớm là MẤT DỮ LIỆU (nên nó kiểm "đã gộp chưa"), giữ
    muối lâu là GIỮ MỘT RỦI RO. Một bản cài gắn việc xoá muối vào vòng lặp gộp sẽ bỏ sót
    đúng ca này — site im ắng một hôm, và muối hôm ấy sống mãi.
    """
    assert not LuotXem.objects.exists()
    MuoiNgay.objects.create(ngay=hom_nay - timedelta(days=1), muoi="m-hom-qua")

    gom(hom_nay)

    assert not MuoiNgay.objects.exists()


def test_G_lenh_day_du_lam_ca_BA_viec(du_lieu):
    """Đường mà cron thật sự gõ: gộp · huỷ muối · dọn hàng thô.

    Hàng có khách nằm ở `hom_nay - 2` — một ngày `du_lieu` không seed gì — chứ không
    phải hôm qua: hôm qua của `du_lieu` toàn hàng cũ (`khach=""`), thêm một hàng có
    token vào đó là dựng đúng ngày CHUYỂN TIẾP mà `_khach_moi_ngay` cố ý bỏ qua.
    """
    hom_nay = du_lieu["hom_nay"]
    ngay_co_khach = hom_nay - timedelta(days=2)
    MuoiNgay.objects.create(ngay=hom_nay - timedelta(days=1), muoi="m-hom-qua")
    them(ngay_co_khach, "/co-khach", khach="a" * 32)

    call_command("gom_luot_xem", verbosity=0)

    assert TongNgay.objects.exists()
    assert not MuoiNgay.objects.exists()
    assert KhachNgay.objects.get(ngay=ngay_co_khach).so_khach == 1
    # Hai ngày quá hạn đã bị dọn (9 hàng còn lại của `du_lieu` + 1 hàng vừa thêm).
    assert LuotXem.objects.count() == 10
