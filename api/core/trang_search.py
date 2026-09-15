"""Nhận diện công cụ tìm kiếm và bóc tách từ khóa tìm kiếm (search keyword).

Hỗ trợ các công cụ tìm kiếm phổ biến (Google, Cốc Cốc, Bing, Yahoo, DuckDuckGo,
Baidu, Yandex, Ecosia, Ask, Brave, Qwant, Naver, Startpage...) cùng tìm kiếm nội bộ
`/tim-kiem` và tham số chiến dịch `utm_term`.
"""

import re
from urllib.parse import parse_qs, unquote_plus, urlsplit

DAI_TOI_DA_TU_KHOA = 200

#: Bảng các công cụ tìm kiếm: (regex pattern của hostname, tuple các param từ khóa)
BANG_CONG_CU_TIM_KIEM: list[tuple[re.Pattern[str], tuple[str, ...]]] = [
    (re.compile(r"^(?:[a-z0-9-]+\.)?google\.[a-z.]{2,}$", re.I), ("q", "query", "as_q")),
    (re.compile(r"^(?:[a-z0-9-]+\.)?coccoc\.(?:com|vn)$", re.I), ("query", "q")),
    (re.compile(r"^(?:[a-z0-9-]+\.)?bing\.com$", re.I), ("q",)),
    (re.compile(r"^(?:[a-z0-9-]+\.)?yahoo\.[a-z.]+$", re.I), ("p", "q")),
    (re.compile(r"^(?:[a-z0-9-]+\.)?duckduckgo\.com$", re.I), ("q",)),
    (re.compile(r"^(?:[a-z0-9-]+\.)?baidu\.com$", re.I), ("wd", "word")),
    (re.compile(r"^(?:[a-z0-9-]+\.)?(?:yandex\.[a-z.]+|ya\.ru)$", re.I), ("text",)),
    (re.compile(r"^(?:[a-z0-9-]+\.)?ecosia\.org$", re.I), ("q",)),
    (re.compile(r"^(?:[a-z0-9-]+\.)?ask\.com$", re.I), ("q",)),
    (re.compile(r"^(?:[a-z0-9-]+\.)?brave\.com$", re.I), ("q",)),
    (re.compile(r"^(?:[a-z0-9-]+\.)?qwant\.com$", re.I), ("q",)),
    (re.compile(r"^(?:[a-z0-9-]+\.)?naver\.com$", re.I), ("query",)),
    (re.compile(r"^(?:[a-z0-9-]+\.)?startpage\.com$", re.I), ("query", "q")),
    (re.compile(r"^(?:[a-z0-9-]+\.)?sogou\.com$", re.I), ("query",)),
    (re.compile(r"^(?:[a-z0-9-]+\.)?petalsearch\.com$", re.I), ("query",)),
]

#: Các tham số tìm kiếm từ chiến dịch quảng cáo hoặc tham số URL đích
THAM_SO_CHIEN_DICH = ("utm_term", "keyword", "tu_khoa")


def chuan_hoa_tu_khoa(tu_khoa: str) -> str:
    """Chuẩn hóa chuỗi từ khóa: unquote URL, bỏ khoảng trắng thừa, lowercase, cắt 200 ký tự."""
    if not tu_khoa:
        return ""
    giai_ma = unquote_plus(tu_khoa)
    # Bỏ các ký tự điều khiển (ASCII < 32)
    sach = "".join(c if ord(c) >= 32 else " " for c in giai_ma)
    # Gộp khoảng trắng liên tiếp
    gon = re.sub(r"\s+", " ", sach).strip().lower()
    return gon[:DAI_TOI_DA_TU_KHOA]


def la_trang_search(host: str) -> bool:
    """True nếu host là một công cụ tìm kiếm đã biết (đã bỏ www)."""
    if not host:
        return False
    h = host.lower()
    if h.startswith("www."):
        h = h[4:]
    return any(p.search(h) for p, _ in BANG_CONG_CU_TIM_KIEM)


def _tim_tu_khoa_trong_query(qs_str: str, cac_tham_so: tuple[str, ...]) -> str:
    """Tìm giá trị hợp lệ đầu tiên trong chuỗi query string."""
    if not qs_str:
        return ""
    if qs_str.startswith("?"):
        qs_str = qs_str[1:]
    params = parse_qs(qs_str, keep_blank_values=False)
    for ten in cac_tham_so:
        cac_gia_tri = params.get(ten)
        if cac_gia_tri:
            for g in cac_gia_tri:
                chuan = chuan_hoa_tu_khoa(g)
                if chuan:
                    return chuan
    return ""


def trich_xuat_tu_khoa(referer: str, truy_van: str = "", duong_dan: str = "") -> str:
    """Trích xuất từ khóa tìm kiếm khi người dùng vào từ các trang search.

    Ưu tiên:
    1. Query param từ công cụ tìm kiếm trong `referer` (Google, Bing, Cốc Cốc...)
    2. Query param từ trang tìm kiếm nội bộ `/tim-kiem` trong `referer`
    3. Query param trực tiếp trên URL đích (`/tim-kiem?q=...` hoặc `?utm_term=...`)
    """
    # 1. Bóc tách từ Referer
    if referer:
        try:
            parsed = urlsplit(referer)
            host = (parsed.hostname or "").lower()
            if host.startswith("www."):
                host = host[4:]

            # A. Referer từ công cụ tìm kiếm
            for regex, tham_so in BANG_CONG_CU_TIM_KIEM:
                if regex.search(host):
                    tk = _tim_tu_khoa_trong_query(parsed.query, tham_so)
                    if tk:
                        return tk

            # B. Referer từ trang tìm kiếm nội bộ (/tim-kiem?q=...)
            if parsed.path.rstrip("/") == "/tim-kiem":
                tk = _tim_tu_khoa_trong_query(parsed.query, ("q", "query"))
                if tk:
                    return tk
        except ValueError:
            pass

    # 2. Bóc tách từ query URL đích (`truy_van`)
    if truy_van:
        # Nếu đang truy cập trang /tim-kiem?q=...
        if duong_dan.rstrip("/") == "/tim-kiem":
            tk = _tim_tu_khoa_trong_query(truy_van, ("q", "query"))
            if tk:
                return tk

        # Hoặc có tham số chiến dịch utm_term / keyword
        tk = _tim_tu_khoa_trong_query(truy_van, THAM_SO_CHIEN_DICH)
        if tk:
            return tk

    return ""
