"""Wilson + hệ số tươi — PLAN 5.3, plan con Phase 1a mục 2.5 (1) và tiêu chí P9.

Hàm thuần, không đụng DB: mọi khẳng định ở đây đo đúng công thức, không đo ORM.
"""

from datetime import datetime, timedelta, timezone as tz

import pytest

from core.xep_hang import (
    CUA_SO_TUOI,
    HE_SO_TUOI,
    duoc_he_so_tuoi,
    wilson_lower_bound,
    xep_hang_binh_luan_goc,
)

BAY_GIO = datetime(2026, 8, 21, 12, 0, tzinfo=tz.utc)
MOC_MOI_NHAT = datetime(2026, 8, 20, 9, 0, tzinfo=tz.utc)


# --- wilson: ca biên -------------------------------------------------------


def test_chua_ai_vote_thi_bang_khong():
    assert wilson_lower_bound(0, 0) == 0.0


@pytest.mark.parametrize("down", [1, 5, 20, 500])
def test_toan_down_thi_bang_khong_voi_moi_co_mau(down):
    """0 up thì cận dưới bằng 0 — với MỌI cỡ mẫu, không "gần 0 dần".

    Đại số cho đúng 0 (`p = 0` làm tâm và biên triệt tiêu nhau); số thực dấu phẩy động
    để lại rác cỡ 1e-17, nên ngưỡng là `abs=1e-9` chứ không phải `== 0.0`. Ngưỡng đó
    vẫn chặt hơn khoảng cách giữa hai hạng bất kỳ nhiều bậc, nên nó không nới lỏng gì.

    Ca này dễ viết thành `assert < 0.1` cho xong; như thế thì một cài đặt trả cận TRÊN
    (0.29 với 5 phiếu down) cũng lọt. Ngưỡng phải sát 0.
    """
    assert wilson_lower_bound(0, down) == pytest.approx(0.0, abs=1e-9)


def test_toan_up_van_duoi_1_va_tang_theo_co_mau():
    """100% up không bao giờ ra 1.0, và 50/0 phải chắc hơn 3/0.

    Đây là lý do tồn tại của wilson: `up − down` cho 3-0 và 50-0 cùng "tỷ lệ hoàn hảo",
    còn hạng thì phải khác nhau.
    """
    it = wilson_lower_bound(3, 0)
    nhieu = wilson_lower_bound(50, 0)
    assert 0 < it < nhieu < 1.0


def test_up_bang_down_thi_duoi_mot_nua():
    """Cận DƯỚI của tỷ lệ 50% phải nhỏ hơn 50% — nếu không thì nó không phải cận dưới."""
    assert 0 < wilson_lower_bound(10, 10) < 0.5


def test_phat_mau_nho_5_0_dung_duoi_50_2():
    """Ca đắt nhất trong thực tế: 100% của mẫu 5 phải xếp dưới 96% của mẫu 52."""
    assert wilson_lower_bound(5, 0) < wilson_lower_bound(50, 2)


def test_tang_don_dieu_theo_so_up():
    diem = [wilson_lower_bound(up, 5) for up in range(0, 30, 3)]
    assert diem == sorted(diem)
    assert len(set(diem)) == len(diem)


# --- hệ số tươi: hai điều kiện, phải ĐỒNG THỜI đúng ------------------------


def test_ra_doi_sau_moc_moi_nhat_va_con_moi_thi_duoc():
    assert duoc_he_so_tuoi(
        created_at=BAY_GIO - timedelta(hours=3),
        last_entry_at=MOC_MOI_NHAT,
        now=BAY_GIO,
    )


def test_ra_doi_TRUOC_moc_moi_nhat_thi_khong_duoc_du_vua_viet():
    """Viết 1 phút trước khi mốc mới ra đời: vẫn "mới", nhưng KHÔNG được bonus.

    Điều kiện 1 của PLAN 5.3 so với `last_entry_at`, không so với "gần đây". Bỏ vế đó
    đi thì bonus biến thành "thưởng cho bình luận mới" chung chung, và mọi bình luận
    của 48h đầu mạch sẽ cùng được cộng — tức là không đổi thứ hạng gì cả.
    """
    assert not duoc_he_so_tuoi(
        created_at=MOC_MOI_NHAT - timedelta(minutes=1),
        last_entry_at=MOC_MOI_NHAT,
        now=MOC_MOI_NHAT + timedelta(minutes=2),
    )


def test_qua_48h_doi_no_thi_het_bonus():
    assert not duoc_he_so_tuoi(
        created_at=BAY_GIO - CUA_SO_TUOI - timedelta(seconds=1),
        last_entry_at=MOC_MOI_NHAT - timedelta(days=30),
        now=BAY_GIO,
    )


def test_dung_48h_van_con_bonus():
    """PLAN 5.3 viết `≤ 48 giờ` — biên là ĐƯỢC, không phải hụt."""
    assert duoc_he_so_tuoi(
        created_at=BAY_GIO - CUA_SO_TUOI,
        last_entry_at=MOC_MOI_NHAT - timedelta(days=30),
        now=BAY_GIO,
    )


def test_mach_nguoi_3_thang_binh_luan_hom_nay_van_duoc_bonus():
    """Hành vi biên CHỦ ĐÍCH của PLAN 5.3, không phải lỗi: người đến muộn có cửa lên đỉnh."""
    assert duoc_he_so_tuoi(
        created_at=BAY_GIO - timedelta(hours=1),
        last_entry_at=BAY_GIO - timedelta(days=90),
        now=BAY_GIO,
    )


# --- P9: hệ số tươi ĐỔI THỨ HẠNG thật --------------------------------------


def test_he_so_tuoi_dao_nguoc_thu_hang_cua_hai_binh_luan_that():
    """Hai bình luận có thật, wilson xếp A trên B, bonus lật ngược lại.

    Con số chọn sao cho khoảng cách wilson (~0.059) NHỎ HƠN `HE_SO_TUOI` (0.15) nhưng
    không nhỏ tới mức sai số float quyết định kết quả:

    - A: 10 up / 0 down, viết TRƯỚC mốc mới nhất  → wilson ≈ 0.859, không bonus
    - B: 20 up / 2 down, viết SAU mốc mới nhất 1h → wilson ≈ 0.800, +0.15 = 0.950

    Bỏ hệ số tươi ra khỏi `xep_hang_binh_luan_goc` thì `assert` cuối ĐỎ. Đó là bài
    thử phá bắt buộc của plan con (mục 4.2 / tiêu chí P11).
    """
    chung = dict(now=BAY_GIO, last_entry_at=MOC_MOI_NHAT)
    a = dict(up_count=10, down_count=0, created_at=MOC_MOI_NHAT - timedelta(days=2))
    b = dict(up_count=20, down_count=2, created_at=MOC_MOI_NHAT + timedelta(hours=1))

    wilson_a = wilson_lower_bound(a["up_count"], a["down_count"])
    wilson_b = wilson_lower_bound(b["up_count"], b["down_count"])
    # Tiền đề: KHÔNG có bonus thì A đứng trên B. Không có dòng này thì `assert` cuối
    # có thể xanh chỉ vì B vốn đã hơn A — tức là không đo bonus gì cả.
    assert wilson_a > wilson_b
    assert 0 < wilson_a - wilson_b < HE_SO_TUOI

    rank_a = xep_hang_binh_luan_goc(**a, **chung)
    rank_b = xep_hang_binh_luan_goc(**b, **chung)

    assert rank_a == pytest.approx(wilson_a)
    assert rank_b == pytest.approx(wilson_b + HE_SO_TUOI)
    assert rank_b > rank_a, "hệ số tươi phải đưa B vượt lên trên A"


def test_binh_luan_khong_du_dieu_kien_khong_bi_cong_gi():
    """Rank của bình luận cũ phải BẰNG ĐÚNG wilson — cộng nhầm 0.15 cho tất cả thì
    thứ hạng không đổi và test trên vẫn xanh; dòng này bịt lối đó."""
    rank = xep_hang_binh_luan_goc(
        up_count=7,
        down_count=1,
        created_at=MOC_MOI_NHAT - timedelta(days=5),
        last_entry_at=MOC_MOI_NHAT,
        now=BAY_GIO,
    )
    assert rank == pytest.approx(wilson_lower_bound(7, 1))
