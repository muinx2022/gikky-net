"""Trình duyệt + thiết bị từ User-Agent — nhóm U của
`plans/2026-08-30-viet-lai-luot-xem.md` §7 (N6).

Hàm thuần, không chạm DB.

## Cái đáng đo không phải "Chrome ra chrome"

UA của trình duyệt lồng nhau như búp bê Nga: Edge chứa `Chrome` **và** `Safari`, Chrome
chứa `Safari`, Cốc Cốc / Samsung / Opera đều chứa `Chrome`. Nên cái đáng đo là **thứ tự
khớp**, và cách nó hỏng là im lặng: khớp `chrome` trước `edg` thì mọi Edge trên đời thành
Chrome — 200, bảng vẫn đủ dòng, cột Edge chỉ vĩnh viễn bằng 0.

Mọi UA dưới đây là UA **thật** (rút gọn phiên bản). Một ma trận dựng bằng chuỗi tự chế
(`"edge"`, `"chrome"`) chỉ chứng minh `"x" in "x"` và bỏ lọt đúng thứ nó sinh ra để bắt.
"""

import pytest

from core.nhan_dien_ua import DI_DONG, KHAC, MAY_TINH, thiet_bi, trinh_duyet

#: `(User-Agent thật, khoá mong đợi)`. Mỗi dòng là một bẫy lồng nhau, trừ hai dòng cuối.
MA_TRAN_TRINH_DUYET = [
    # Chrome trên Windows — chứa `Safari`.
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36",
        "chrome",
    ),
    # ⚠ Edge trên macOS — chứa `Chrome` LẪN `Safari`. Đây là ca thử phá §8.1.
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like "
        "Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0",
        "edge",
    ),
    # Edge trên Android (`EdgA/`) và trên iOS (`EdgiOS/`) — cùng một khoá, ba biến thể.
    (
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Mobile Safari/537.36 EdgA/131.0.0.0",
        "edge",
    ),
    (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/18.0 EdgiOS/131.0.0.0 Mobile/15E148 Safari/605.1.15",
        "edge",
    ),
    # Opera — `OPR/`, cũng chứa `Chrome` và `Safari`.
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36 OPR/117.0.0.0",
        "opera",
    ),
    # Samsung Internet — chứa `Chrome` và `Safari`.
    (
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) "
        "SamsungBrowser/26.0 Chrome/122.0.0.0 Mobile Safari/537.36",
        "samsung",
    ),
    # ⚠ Cốc Cốc — token thật là `coc_coc_browser`, và UA cũng chứa `Chrome` + `Safari`.
    # Trình duyệt phổ biến ở VN: xếp sau `chrome` là mất trọn một cột.
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "coc_coc_browser/106.0.152 Chrome/100.0.4896.152 Safari/537.36",
        "coccoc",
    ),
    # Firefox trên Linux.
    ("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0", "firefox"),
    # ⚠ Firefox trên iOS — `FxiOS`, KHÔNG chứa chuỗi `firefox`. Thiếu dòng ấy là mọi
    # Firefox trên iPhone bị đếm thành Safari.
    (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) FxiOS/133.0 Mobile/15E148 Safari/605.1.15",
        "firefox",
    ),
    # ⚠ Chrome trên iOS — `CriOS`, cũng KHÔNG chứa chuỗi `chrome`.
    (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) CriOS/131.0.0.0 Mobile/15E148 Safari/604.1",
        "chrome",
    ),
    # Safari thật — trên iPhone và trên macOS.
    (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
        "safari",
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, "
        "like Gecko) Version/18.1 Safari/605.1.15",
        "safari",
    ),
    # Không nhận ra ⇒ `khac`, không đoán bừa.
    ("Mozilla/5.0 (compatible; Konqueror/4.5; Linux) KHTML/4.5.5 (like Gecko)", KHAC),
    ("Lynx/2.9.0dev.12 libwww-FM/2.14", KHAC),
]


@pytest.mark.parametrize("ua,mong_doi", MA_TRAN_TRINH_DUYET)
def test_U1_ma_tran_trinh_duyet(ua, mong_doi):
    assert trinh_duyet(ua) == mong_doi


def test_U1b_ma_tran_du_rong_va_KHONG_gop_lam_mot():
    """Chống ma trận teo: ≥ 10 UA, và bảy khoá trình duyệt đều phải xuất hiện.

    Vế thứ hai mới là vế bắt lỗi. Một bản cài trả `"chrome"` cho **mọi** UA nhân Chromium
    vẫn qua được một ma trận chỉ toàn Chrome; nó chỉ đỏ khi ma trận đòi đủ bảy khoá khác
    nhau có mặt.
    """
    assert len(MA_TRAN_TRINH_DUYET) >= 10
    ra = {trinh_duyet(ua) for ua, _ in MA_TRAN_TRINH_DUYET}
    assert ra == {"chrome", "edge", "opera", "samsung", "coccoc", "firefox", "safari", KHAC}


def test_U1c_edge_va_coccoc_KHONG_ra_cung_ket_qua_voi_chrome():
    """Ba UA cùng chứa `Chrome/…` mà phải ra ba khoá khác nhau — ca thử phá §8.1.

    Đảo `edge` xuống sau `chrome` trong `BANG_TRINH_DUYET` là bài này đỏ ngay, và nó đỏ
    kể cả khi ai đó sửa ma trận trên cho "khớp thực tế mới".
    """
    chrome, edge, coccoc = (
        MA_TRAN_TRINH_DUYET[0][0],
        MA_TRAN_TRINH_DUYET[1][0],
        MA_TRAN_TRINH_DUYET[6][0],
    )
    for ua in (edge, coccoc):
        assert "chrome/" in ua.lower(), "UA mẫu không còn dựng lại được bẫy lồng nhau"
    assert len({trinh_duyet(chrome), trinh_duyet(edge), trinh_duyet(coccoc)}) == 3
    assert trinh_duyet(edge) == "edge"
    assert trinh_duyet(coccoc) == "coccoc"


#: `(User-Agent thật, khoá thiết bị)`. Đủ cả hai vế, không chỉ vế di động.
MA_TRAN_THIET_BI = [
    (
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
        "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
        DI_DONG,
    ),
    (
        "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/122.0.0.0 Mobile Safari/537.36",
        DI_DONG,
    ),
    (
        "Mozilla/5.0 (iPad; CPU OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like "
        "Gecko) Version/17.5 Mobile/15E148 Safari/604.1",
        DI_DONG,
    ),
    (
        "Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0",
        DI_DONG,
    ),
    (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/131.0.0.0 Safari/537.36",
        MAY_TINH,
    ),
    (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, "
        "like Gecko) Version/18.1 Safari/605.1.15",
        MAY_TINH,
    ),
    ("Mozilla/5.0 (X11; Linux x86_64; rv:133.0) Gecko/20100101 Firefox/133.0", MAY_TINH),
]


@pytest.mark.parametrize("ua,mong_doi", MA_TRAN_THIET_BI)
def test_U2_ma_tran_thiet_bi(ua, mong_doi):
    assert thiet_bi(ua) == mong_doi


def test_U2b_ma_tran_thiet_bi_du_rong_va_co_CA_HAI_ve():
    """≥ 6 UA, và cả `di_dong` lẫn `may_tinh` đều phải xuất hiện.

    Một bản cài `return "may_tinh"` trần qua được mọi ma trận chỉ toàn máy tính — và bảng
    "Thiết bị" khi ấy hiện một dòng 100%, trông y hệt một sự thật về một site ít người
    dùng điện thoại.
    """
    assert len(MA_TRAN_THIET_BI) >= 6
    ra = {thiet_bi(ua) for ua, _ in MA_TRAN_THIET_BI}
    assert ra == {DI_DONG, MAY_TINH}


def test_U3_khong_phan_biet_hoa_thuong():
    ua = "MOZILLA/5.0 (LINUX; ANDROID 14) CHROME/131.0.0.0 MOBILE SAFARI/537.36"
    assert trinh_duyet(ua) == "chrome"
    assert thiet_bi(ua) == DI_DONG


def test_U4_khoa_tra_ve_deu_la_ASCII_khong_dau():
    """Chúng là khoá DỮ LIỆU nằm trong cột DB, không phải nhãn hiển thị.

    Một khoá có dấu (`"khác"`) đi vào `LuotXem.trinh_duyet` là một giá trị mà mọi câu
    `GROUP BY`, mọi URL lọc và mọi bài đo sau này phải mang theo bộ gõ tiếng Việt. Nhãn
    tiếng Việt do frontend map — xem `apps/admin/app/luot-xem/page.tsx`.
    """
    khoa = {trinh_duyet(ua) for ua, _ in MA_TRAN_TRINH_DUYET} | {DI_DONG, MAY_TINH}
    for k in khoa:
        assert k.isascii() and k == k.lower(), k
