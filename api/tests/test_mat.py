"""`core/mat.py` — luật BÃO/CẶN ở mức hàm thuần. PLAN 5.5.

Vì sao có file này bên cạnh bài đo qua HTTP ở `test_api_mach.py`: biên của PLAN là
`now − last_activity_at ≤ 72h`, tức một phép so **bằng**. Qua đường HTTP thì `now` của
handler luôn muộn hơn `now` của bài đo vài mili-giây, nên "đúng bằng 72h" không dựng lại
được — bài đo nào cố dựng sẽ đỏ ngẫu nhiên, và bài đo đỏ ngẫu nhiên rồi sẽ bị ai đó nới
ra cho hết đỏ. Ở đây `now` là tham số, nên biên đo được chính xác.
"""

from datetime import datetime, timedelta, timezone as dt_tz

import pytest

from core.mat import (
    MAT_BAO,
    MAT_CAN,
    NGUONG_BAO,
    tinh_mat_cho_viewer,
    tinh_mat_theo_thoi_gian,
)
from core.models.dien_dan import TrangThaiMach

NOW = datetime(2026, 8, 21, 12, 0, 0, tzinfo=dt_tz.utc)


def mat(*, status=TrangThaiMach.MO, locked_at=None, tuoi=timedelta(hours=1)):
    return tinh_mat_theo_thoi_gian(
        status=status,
        locked_at=locked_at,
        last_activity_at=NOW - tuoi,
        now=NOW,
    )


def test_mo_va_con_song_thi_bao():
    assert mat() == MAT_BAO


@pytest.mark.parametrize(
    "tuoi,mong_doi",
    [
        (timedelta(0), MAT_BAO),
        (NGUONG_BAO - timedelta(microseconds=1), MAT_BAO),
        (NGUONG_BAO, MAT_BAO),
        (NGUONG_BAO + timedelta(microseconds=1), MAT_CAN),
        (NGUONG_BAO + timedelta(days=30), MAT_CAN),
    ],
)
def test_bien_72h_la_BE_HON_HOAC_BANG(tuoi, mong_doi):
    """Nguyên văn PLAN 5.5: `≤ 72h`. Đúng 72h vẫn BÃO, hơn một micro-giây là CẶN."""
    assert mat(tuoi=tuoi) == mong_doi


def test_mach_dong_so_khong_bao_gio_bao():
    assert mat(status=TrangThaiMach.DONG, tuoi=timedelta(0)) == MAT_CAN


def test_mach_bi_khoa_khong_bao_gio_bao():
    """`locked_at` là trục RIÊNG với `status` (PLAN 5.10): mạch mở vẫn khoá được."""
    assert mat(locked_at=NOW, tuoi=timedelta(0)) == MAT_CAN


def test_ba_dieu_kien_deu_can_thiet():
    """Bảng chân trị đầy đủ: chỉ đúng MỘT tổ hợp trong tám cho ra BÃO.

    Bài đo này giết mọi mutant kiểu "bỏ một điều kiện" cùng lúc — bỏ vế nào thì cũng có
    thêm ít nhất một hàng nhảy sang BÃO.
    """
    ket_qua = {
        (st, khoa, qua_han): mat(
            status=st,
            locked_at=NOW if khoa else None,
            tuoi=NGUONG_BAO * 2 if qua_han else timedelta(hours=1),
        )
        for st in (TrangThaiMach.MO, TrangThaiMach.DONG)
        for khoa in (False, True)
        for qua_han in (False, True)
    }
    bao = [k for k, v in ket_qua.items() if v == MAT_BAO]
    assert bao == [(TrangThaiMach.MO, False, False)]


def test_khong_nhan_tham_so_user():
    """Vế "user đã follow / từng bình luận" của PLAN 5.5 KHÔNG được cài ở đây (PLAN 8.4).

    `GET /machs/{id}` cache được là nhờ đúng chuyện này. Ngày nào có người thêm `user=`
    vào chữ ký hàm, bài đo này đỏ trước khi cache kịp phục vụ mặt của người khác.
    """
    import inspect

    tham_so = set(inspect.signature(tinh_mat_theo_thoi_gian).parameters)
    assert tham_so == {"status", "locked_at", "last_activity_at", "now"}


# --- Vế 2 của PLAN 5.5: mặt theo VIEWER (Phase 3) ----------------------------


def test_ve_viewer_chi_keo_CAN_len_BAO_khong_bao_gio_nguoc_lai():
    """PLAN 5.5 nối hai vế bằng **HOẶC**, nên vế 2 chỉ cộng thêm.

    Cách cài sai tự nhiên nhất là `return BAO if (follow or tung_binh_luan) else CAN` —
    nó xanh với mọi mạch nguội, và nó làm **mọi mạch đang sôi hiện mặt CẶN cho người chưa
    follow**, tức mặt BÃO gần như không bao giờ xuất hiện với người mới. Bảng dưới quét cả
    8 tổ hợp nên nhánh đó không lọt.
    """
    tat_ca = {
        (nen, dang_nhap, follow, binh_luan): tinh_mat_cho_viewer(
            mat_theo_thoi_gian=nen,
            dang_nhap=dang_nhap,
            dang_follow=follow,
            tung_binh_luan=binh_luan,
        )
        for nen in (MAT_BAO, MAT_CAN)
        for dang_nhap in (False, True)
        for follow in (False, True)
        for binh_luan in (False, True)
    }
    # Nền BÃO ⇒ luôn BÃO, không tổ hợp viewer nào kéo xuống được.
    assert all(v == MAT_BAO for k, v in tat_ca.items() if k[0] == MAT_BAO)
    # Nền CẶN ⇒ chỉ lên BÃO khi ĐĂNG NHẬP và (follow HOẶC từng bình luận).
    can = {k: v for k, v in tat_ca.items() if k[0] == MAT_CAN}
    assert {k for k, v in can.items() if v == MAT_BAO} == {
        (MAT_CAN, True, True, False),
        (MAT_CAN, True, False, True),
        (MAT_CAN, True, True, True),
    }


def test_chua_dang_nhap_thi_hai_co_kia_khong_co_tac_dung():
    """PLAN viết `user đăng nhập **VÀ** (…)`. `dang_nhap` là tham số RIÊNG, giữ đúng chữ VÀ.

    Nghe thừa vì hai cờ kia chỉ đúng với người đã đăng nhập — nhưng chúng được TRUYỀN VÀO
    chứ không được hàm tự tra, nên "thừa" ở đây là chỗ duy nhất chặn được một lời gọi dựng
    cờ từ một `user` đã đăng xuất.
    """
    assert (
        tinh_mat_cho_viewer(
            mat_theo_thoi_gian=MAT_CAN,
            dang_nhap=False,
            dang_follow=True,
            tung_binh_luan=True,
        )
        == MAT_CAN
    )


def test_ve_viewer_chi_nhan_CO_khong_nhan_user_hay_mach():
    """Chiều còn lại của `test_khong_nhan_tham_so_user` — xem docstring `core/mat.py`.

    Vế thời gian phải gọi được từ `GET /machs/{id}` (cache được); vế viewer chỉ được gọi
    từ `/machs/{id}/me`. Gộp chúng bằng một `user=None` mặc định là lời mời cho lời gọi
    thứ hai truyền `user` vào — lúc ấy `face` thành trường per-user nằm trong một response
    được ISR cache. Hàm này vì thế **chỉ nhận CỜ**: nó không tra được gì, nên nó không
    dùng nhầm chỗ được.
    """
    import inspect

    tham_so = set(inspect.signature(tinh_mat_cho_viewer).parameters)
    assert tham_so == {
        "mat_theo_thoi_gian",
        "dang_nhap",
        "dang_follow",
        "tung_binh_luan",
    }, "vế viewer đang nhận thêm thứ gì đó — nó chỉ được nhận CỜ, không nhận `user`/`mach`"
