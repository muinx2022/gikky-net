"""Kiểm tra nhận diện công cụ tìm kiếm và bóc tách từ khóa (core/trang_search.py)."""

import pytest

from core.trang_search import (
    chuan_hoa_tu_khoa,
    la_trang_search,
    trich_xuat_tu_khoa,
)


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("", ""),
        ("   ", ""),
        ("chung+khoan", "chung khoan"),
        ("ch%E1%BB%A9ng+kho%C3%A1n", "chứng khoán"),
        ("  VI  INDEX  2026  ", "vi index 2026"),
        ("từ\nkhóa\trác", "từ khóa rác"),
        ("a" * 300, "a" * 200),
    ],
)
def test_chuan_hoa_tu_khoa(raw, expected):
    assert chuan_hoa_tu_khoa(raw) == expected


@pytest.mark.parametrize(
    "host,expected",
    [
        ("google.com", True),
        ("www.google.com.vn", True),
        ("coccoc.com", True),
        ("coccoc.vn", True),
        ("bing.com", True),
        ("search.yahoo.com", True),
        ("duckduckgo.com", True),
        ("baidu.com", True),
        ("yandex.ru", True),
        ("facebook.com", False),
        ("gikky.net", False),
        ("", False),
    ],
)
def test_la_trang_search(host, expected):
    assert la_trang_search(host) is expected


@pytest.mark.parametrize(
    "referer,truy_van,duong_dan,expected",
    [
        # Google
        ("https://www.google.com/search?q=giao+dich+chung+khoan", "", "/", "giao dich chung khoan"),
        ("https://google.com.vn/url?sa=t&q=phan+tich+vi+mo", "", "/m/test-1", "phan tich vi mo"),
        ("https://www.google.com.vn/search?as_q=tam+ly+trading", "", "/", "tam ly trading"),
        # Cốc Cốc
        ("https://coccoc.com/search?query=tai+chinh+ca+nhan", "", "/", "tai chinh ca nhan"),
        ("https://coccoc.vn/search?q=chung+khoan", "", "/", "chung khoan"),
        # Bing
        ("https://www.bing.com/search?q=wyckoff+method", "", "/", "wyckoff method"),
        # Yahoo
        ("https://search.yahoo.com/search?p=crypto+bitcoin", "", "/", "crypto bitcoin"),
        # DuckDuckGo
        ("https://duckduckgo.com/?q=he+thong+giao+dich", "", "/", "he thong giao dich"),
        # Ecosia, Baidu, Yandex
        ("https://www.ecosia.org/search?q=lai+suat+fed", "", "/", "lai suat fed"),
        ("https://www.baidu.com/s?wd=stock+market", "", "/", "stock market"),
        ("https://yandex.ru/search/?text=forex", "", "/", "forex"),
        # Nội bộ: referer từ /tim-kiem?q=...
        ("https://gikky.net/tim-kiem?q=co+phieu+vcb", "", "/m/a-1", "co phieu vcb"),
        # Landing query trên /tim-kiem?q=...
        ("", "?q=dau+tu+gia+tri", "/tim-kiem", "dau tu gia tri"),
        # Landing query với utm_term
        ("", "?utm_source=google&utm_term=chien+luoc+dau+tu", "/m/a-1", "chien luoc dau tu"),
        # Không có từ khóa: Google không kèm query
        ("https://www.google.com/", "", "/", ""),
        # Không phải trang search
        ("https://facebook.com/groups/123", "", "/", ""),
    ],
)
def test_trich_xuat_tu_khoa(referer, truy_van, duong_dan, expected):
    assert trich_xuat_tu_khoa(referer, truy_van, duong_dan) == expected
