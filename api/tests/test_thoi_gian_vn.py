"""Múi giờ sản phẩm — PLAN mục 1, plan con Phase 1a 2.5 (7).

Ba luật của sản phẩm treo vào định nghĩa "ngày": rate limit 3 mốc/ngày (5.1),
`occurred_at` mặc định + cấm tương lai (5.2), `dedupe_key` thông báo (5.8). Tính theo
UTC thì cả ba lệch 7 tiếng, và chỉ lệch trong khung 17:00–24:00 giờ VN.
"""

from datetime import datetime, timedelta, timezone as tz

import pytest
from django.conf import settings
from django.utils import timezone

from core.thoi_gian import MUI_GIO_VN, TZ_VN, khoa_ngay_vn, ngay_vn

#: 23:50 ngày 21/08 giờ VN và 00:10 ngày 22/08 giờ VN — cách nhau 20 phút.
#: Theo UTC cả hai đều rơi vào **ngày 21/08** (16:50 và 17:10).
TRUOC_NUA_DEM = datetime(2026, 8, 21, 23, 50, tzinfo=TZ_VN)
SAU_NUA_DEM = datetime(2026, 8, 22, 0, 10, tzinfo=TZ_VN)


def test_hai_thoi_diem_cach_nhau_20_phut():
    """Tiền đề của cả file: đây đúng là hai thời điểm sát nhau, không phải hai ngày rời."""
    assert SAU_NUA_DEM - TRUOC_NUA_DEM == timedelta(minutes=20)


def test_23h50_va_00h10_gio_VN_la_HAI_ngay_khac_nhau():
    assert ngay_vn(TRUOC_NUA_DEM) != ngay_vn(SAU_NUA_DEM)
    assert ngay_vn(TRUOC_NUA_DEM).isoformat() == "2026-08-21"
    assert ngay_vn(SAU_NUA_DEM).isoformat() == "2026-08-22"


def test_theo_UTC_thi_chung_CUNG_mot_ngay():
    """Bài đo đối chứng: nếu không có bước quy đổi thì kết quả đúng là "cùng ngày".

    Thiếu dòng này, `test` ở trên vẫn xanh trên một cài đặt tính theo UTC nếu ai đó vô
    tình chọn hai thời điểm nằm hai bên nửa đêm UTC — tức là không đo gì.
    """
    assert (
        TRUOC_NUA_DEM.astimezone(tz.utc).date()
        == SAU_NUA_DEM.astimezone(tz.utc).date()
        == datetime(2026, 8, 21).date()
    )


def test_khoa_ngay_vn_dung_dinh_dang_dedupe_key():
    """PLAN 5.8: `"moc_moi:{mach_id}:{yyyymmdd theo giờ VN}"`."""
    assert khoa_ngay_vn(TRUOC_NUA_DEM) == "20260821"
    assert khoa_ngay_vn(SAU_NUA_DEM) == "20260822"


def test_ngay_vn_khong_phu_thuoc_settings_TIME_ZONE(settings):
    """Múi giờ sản phẩm là hằng số, không phải cấu hình hiển thị.

    Đổi `TIME_ZONE` sang UTC (chuyện người ta hay làm cho hợp log prod) **không được**
    làm dời ranh giới ngày của ba luật sản phẩm.
    """
    settings.TIME_ZONE = "UTC"
    timezone.deactivate()
    assert ngay_vn(TRUOC_NUA_DEM).isoformat() == "2026-08-21"
    assert ngay_vn(SAU_NUA_DEM).isoformat() == "2026-08-22"


def test_settings_van_dang_dat_mui_gio_VN():
    """Không thay thế bài trên — ghim cấu hình hiển thị cũng đúng, để log/admin khớp."""
    assert settings.TIME_ZONE == MUI_GIO_VN


@pytest.mark.django_db
def test_occurred_at_mac_dinh_la_hom_nay_gio_VN(mach, tac_gia):
    from core.ghi import them_moc

    khi = datetime(2026, 8, 21, 17, 30, tzinfo=tz.utc)  # = 00:30 ngày 22/08 giờ VN
    moc = them_moc(mach=mach, author=tac_gia, body="mốc lúc nửa đêm", _created_at_seed=khi)
    assert moc.occurred_at.isoformat() == "2026-08-22"
    assert moc.created_at == khi
