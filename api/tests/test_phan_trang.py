"""Cursor keyset ở mức đơn vị — `api/phan_trang.py`. PLAN 5.9, 5.3.

Bài đo end-to-end của feed và khán đài đã chứng minh "không trùng, không sót". File này
đo hai thứ mà bài end-to-end **không** chỉ ra được khi đỏ: hình dạng cursor, và cái gì
xảy ra với chuỗi rác.
"""

import base64
from datetime import datetime, timedelta, timezone as dt_tz

import pytest

from api.phan_trang import (
    GIOI_HAN_TOI_DA,
    CursorHong,
    cat_trang,
    giai_ma_cursor,
    kiem_gioi_han,
    ma_hoa_cursor,
)

KHI = datetime(2026, 8, 21, 15, 4, 5, 123456, tzinfo=dt_tz.utc)


def test_ma_hoa_roi_giai_ma_ra_dung_cap_ban_dau():
    assert giai_ma_cursor(ma_hoa_cursor(KHI, 1234)) == (KHI, 1234)


def test_giu_nguyen_micro_giay():
    """Mất micro-giây là hai hàng cùng giây trở thành "bằng nhau" ⇒ trùng hoặc sót."""
    gan = KHI + timedelta(microseconds=1)
    assert giai_ma_cursor(ma_hoa_cursor(gan, 1))[0] == gan
    assert ma_hoa_cursor(KHI, 1) != ma_hoa_cursor(gan, 1)


def test_cursor_di_qua_query_string_khong_can_url_encode():
    """Bỏ dấu `=` đệm: base64url còn lại chỉ có `A-Za-z0-9-_`, đi thẳng vào URL được."""
    for id in (1, 12, 123, 1234, 12345):
        c = ma_hoa_cursor(KHI, id)
        assert "=" not in c and "+" not in c and "/" not in c
        assert giai_ma_cursor(c) == (KHI, id)


@pytest.mark.parametrize(
    "rac",
    [
        "",
        "@@@",
        "khong-phai-base64!!",
        "YWJj",  # base64 hợp lệ nhưng nội dung là "abc" — thiếu phần id
        "MjAyNi0wOC0yMXxhYmM",  # id không phải số
        "a|1",  # chưa qua base64
    ],
)
def test_cursor_rac_nem_CursorHong_chu_khong_am_tham_ve_trang_dau(rac):
    """Không có nhánh "đoán bừa": cursor rác bị hiểu thành trang 1 là người dùng đọc lại
    từ đầu trong khi tưởng mình đang ở trang 5 — im lặng, và không lặp lại được."""
    with pytest.raises(CursorHong):
        giai_ma_cursor(rac)


def test_cursor_khong_co_mui_gio_bi_tu_choi():
    """`datetime` naive đem so với `timestamptz` làm Django cảnh báo, mà
    `filterwarnings = ["error"]` biến cảnh báo đó thành 500. Chặn ở đây thành 400."""
    naive = base64.urlsafe_b64encode(b"2026-08-21T15:04:05.123456|7").decode().rstrip("=")
    with pytest.raises(CursorHong, match="múi giờ"):
        giai_ma_cursor(naive)


def test_cat_trang_nhan_biet_con_trang_sau_bang_hang_lay_du():
    assert cat_trang([1, 2, 3], 3) == ([1, 2, 3], False)
    assert cat_trang([1, 2, 3, 4], 3) == ([1, 2, 3], True)
    assert cat_trang([], 3) == ([], False)


def test_kiem_gioi_han():
    assert kiem_gioi_han(1) is None
    assert kiem_gioi_han(GIOI_HAN_TOI_DA) is None
    assert kiem_gioi_han(0) is not None
    assert kiem_gioi_han(-1) is not None
    assert kiem_gioi_han(GIOI_HAN_TOI_DA + 1) is not None
