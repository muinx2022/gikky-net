"""`core/lam_sach_html.py` — allowlist thẻ/thuộc tính/giao thức, và hai tính chất sống còn.

Đợt Tiptap (2026-08-24) đổi `body` của mốc từ markdown sang HTML, tức bỏ mô hình "cây node
có kiểu" của `apps/web/lib/markdown.ts` để quay lại **sanitize-rồi-nhúng**. File này là
hàng rào đo được của bước lùi ấy.

Bốn nhóm câu hỏi, và không nhóm nào suy ra được từ nhóm khác:

1. **allowlist** — thẻ ngoài danh sách, thuộc tính ngoài danh sách, giao thức ngoài danh
   sách đều phải rơi;
2. **XSS thật** — sáu vector cụ thể, viết ra nguyên văn để lượt sau còn đọc được là đã đo
   những gì;
3. **idempotent** — `lam_sach(lam_sach(x)) == lam_sach(x)`. Không có nó thì bất biến "mọi
   `body` trong DB bằng chính nó sau sanitize" là một bài đo luôn đỏ, và người ta sẽ gỡ
   bài đo chứ không sửa hàm;
4. **`van_ban_thuan`** — đường sinh văn bản thuần cho `xem_truoc`, Meilisearch và
   `meta description`. Ở ba chỗ đó một thẻ rò ra là hỏng thấy được ngay.
"""

import pytest

from core.lam_sach_html import (
    GIAO_THUC_CHO_PHEP,
    THE_CHO_PHEP,
    THUOC_TINH_CHO_PHEP,
    lam_sach,
    van_ban_thuan,
)

#: Sáu vector XSS kinh điển. Viết nguyên văn (không sinh bằng vòng lặp) để lượt đọc sau
#: thấy được ĐÚNG chuỗi nào đã đi qua hàm — một danh sách sinh động là một danh sách
#: không ai đối chiếu được với báo cáo.
XSS = [
    "<script>alert(1)</script>",
    '<img src=x onerror=alert(1)>',
    '<a href="javascript:alert(1)">bấm đi</a>',
    '<iframe src="https://evil.example/x"></iframe>',
    "<style>body{display:none}</style>",
    '<p onclick="alert(1)">chữ thường</p>',
]


# --- allowlist ---------------------------------------------------------------


@pytest.mark.parametrize("the", sorted(THE_CHO_PHEP - {"br", "hr", "img"}))
def test_the_trong_allowlist_thi_SONG(the):
    """Mọi thẻ trong allowlist phải còn lại — vế "không chặn nhầm" của một allowlist.

    `br`/`hr`/`img` tách ra vì chúng tự đóng: `<br>x</br>` không phải HTML hợp lệ nên bài
    đo dạng cặp thẻ không nói được gì về chúng (có bài riêng ở dưới). `img` còn một lý do
    thứ hai — nó chỉ sống khi `src` trỏ vào kho của site, nên `<img>` trần **phải** rụng.

    So thẻ MỞ không kèm `>`: `<a>` ra khỏi hàm với `target`/`rel` gắn thêm, nên `"<a>"`
    là một phép so sai — và nó sai theo chiều làm bài đo đỏ oan.
    """
    ra = lam_sach(f"<{the}>x</{the}>")
    assert f"<{the}" in ra and f"</{the}>" in ra


def test_the_tu_dong_van_song():
    assert lam_sach("a<br>b") == "a<br>b"
    assert lam_sach("<hr>") == "<hr>"


@pytest.mark.parametrize(
    "the", ["script", "iframe", "object", "embed", "form", "svg", "table", "div"]
)
def test_the_ngoai_allowlist_thi_RUNG(the):
    assert f"<{the}" not in lam_sach(f'<{the} src="x">nội dung</{the}>')


# --- `img`: trong allowlist, nhưng `src` phải trỏ vào kho của CHÍNH site ------
#
# Mở `img` (2026-08-24) là mở đúng cái thẻ mà mọi bộ lọc HTML bị thủng ở đó, nên nó có
# hẳn một khối riêng. Vế "đường ghi THẬT cũng lọc" nằm ở `tests/test_anh_trong_body.py` —
# ở đây chỉ đo cái hàm.

#: Đúng tiền tố `MEDIA_URL`. `lam_sach` xét CHUỖI, không đi hỏi đĩa (nó chạy trong đường
#: ghi, một lời gọi storage ở đó là một round-trip trên mỗi lượt lưu bài).
SRC_HOP_LE = "/media/anh/aaaabbbbccccdddd.png"


def test_img_cua_site_thi_song_ca_src_lan_alt():
    the = f'<img src="{SRC_HOP_LE}" alt="Biểu đồ">'
    assert lam_sach(the) == the


@pytest.mark.parametrize(
    "src",
    [
        "https://ke-tan-cong.example/pixel.gif",
        "http://ke-tan-cong.example/pixel.gif",
        # Protocol-relative: KHÔNG có giao thức nên `url_schemes` của ammonia không hề
        # đụng tới nó — đây đúng là ca chứng minh `_src_cua_site` không thừa.
        "//evil.example/x.png",
        "javascript:alert(1)",
        "data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4=",
        "x.png",
        "/anh/x.png",
        "/mediaevil.example/x.png",
        "/media/../../etc/passwd",
        "",
    ],
)
def test_img_ngoai_kho_cua_site_bi_go_CA_THE(src):
    """Gỡ **cả thẻ**, không phải chỉ gỡ `src`: một `<img>` cụt là một ô vỡ giữa bài."""
    ra = lam_sach(f'<p>a</p><img src="{src}">')
    assert ra == "<p>a</p>", ra


def test_img_khong_co_src_cung_bi_go():
    assert lam_sach('<p>a</p><img alt="chỉ có alt">') == "<p>a</p>"


@pytest.mark.parametrize("thuoc_tinh", ["onerror", "onload", "style", "srcset", "width"])
def test_img_giu_lai_van_mat_moi_thuoc_tinh_ngoai_src_alt(thuoc_tinh):
    ra = lam_sach(f'<img src="{SRC_HOP_LE}" {thuoc_tinh}="x">')
    assert ra == f'<img src="{SRC_HOP_LE}">', ra


def test_img_idempotent_ca_hai_nhanh():
    for tho in (
        f'<img src="{SRC_HOP_LE}" alt="a" onerror="alert(1)">',
        '<img src="https://evil.example/x.png">',
        f'<p>x</p><img src="{SRC_HOP_LE}"><img src="//evil.example/y.png">',
    ):
        mot = lam_sach(tho)
        assert lam_sach(mot) == mot, tho


@pytest.mark.parametrize("thuoc_tinh", ["style", "class", "id", "onclick", "onerror"])
def test_thuoc_tinh_ngoai_allowlist_bi_go_khoi_MOI_the(thuoc_tinh):
    """Chỉ `a[href]` sống. `style`/`class`/`id` **không** nằm trong allowlist là chủ đích."""
    for the in ("p", "strong", "blockquote", "a"):
        ra = lam_sach(f'<{the} {thuoc_tinh}="x">chữ</{the}>')
        assert thuoc_tinh not in ra, f"{thuoc_tinh} sống sót trên <{the}>: {ra!r}"


def test_allowlist_thuoc_tinh_dung_la_a_href_va_img_src_alt():
    """Ghim nguyên văn cấu hình — đổi nó phải là một quyết định, không phải một dòng lọt.

    `img` vào allowlist 2026-08-24 và mang theo đúng hai thuộc tính. Dòng `assert` này là
    chỗ ĐỎ nếu ai đó thêm `srcset`/`width`/`style` cho tiện.
    """
    assert THUOC_TINH_CHO_PHEP == {"a": {"href"}, "img": {"src", "alt"}}
    assert set(GIAO_THUC_CHO_PHEP) == {"http", "https", "mailto"}


@pytest.mark.parametrize(
    "url", ["https://gikky.net/a", "http://gikky.net/a", "mailto:ai@gikky.net"]
)
def test_giao_thuc_trong_allowlist_thi_giu_href(url):
    assert f'href="{url}"' in lam_sach(f'<a href="{url}">x</a>')


@pytest.mark.parametrize(
    "url",
    [
        "javascript:alert(1)",
        "JaVaScRiPt:alert(1)",
        "data:text/html;base64,PHNjcmlwdD4=",
        "vbscript:msgbox(1)",
        # ⚠ Bốn chuỗi trên KHÔNG chứng minh được `GIAO_THUC_CHO_PHEP` có tác dụng:
        # ammonia chặn sẵn chúng bằng danh sách mặc định của nó, nên gỡ hẳn `url_schemes`
        # khỏi `lam_sach` mà bài đo vẫn xanh (đã thử phá và thấy tận mắt, 2026-08-24).
        # Hai chuỗi dưới đây thì có: `ftp`/`tel` NẰM TRONG mặc định của ammonia và nằm
        # NGOÀI allowlist ba giao thức của chúng ta — chúng là thứ duy nhất phân biệt được
        # "ta có allowlist riêng" với "ta đang xài mặc định của thư viện".
        "ftp://gikky.net/tep",
        "tel:+84901234567",
    ],
)
def test_giao_thuc_ngoai_allowlist_thi_MAT_href(url):
    """Thẻ `a` ở lại nhưng **không còn `href`** — một thẻ chết, không phải link trỏ đâu đó."""
    ra = lam_sach(f'<a href="{url}">bấm đi</a>')
    assert "href" not in ra
    assert "javascript" not in ra.lower() and "data:" not in ra
    assert "bấm đi" in ra, "chữ của người viết không được biến mất theo cái link hỏng"


def test_link_hop_le_mang_du_rel_va_target():
    ra = lam_sach('<a href="https://gikky.net">x</a>')
    assert 'rel="nofollow ugc noopener"' in ra
    assert 'target="_blank"' in ra


def test_rel_va_target_do_NGUOI_DUNG_gui_bi_ghi_de():
    """Người gửi lên `rel="dofollow"` / `target="_self"` không được thắng cấu hình server."""
    ra = lam_sach('<a href="https://gikky.net" rel="dofollow" target="_self">x</a>')
    assert 'rel="nofollow ugc noopener"' in ra and "dofollow" not in ra
    assert 'target="_blank"' in ra and "_self" not in ra


# --- XSS ---------------------------------------------------------------------


@pytest.mark.parametrize("doc", XSS)
def test_sau_vector_xss_deu_thanh_vo_hai(doc):
    """Không còn thẻ nguy hiểm, không còn thuộc tính `on*`, không còn `javascript:`."""
    ra = lam_sach(doc)
    thap = ra.lower()
    assert "<script" not in thap and "<iframe" not in thap
    assert "<style" not in thap and "<img" not in thap
    assert "onerror" not in thap and "onclick" not in thap
    assert "javascript:" not in thap


def test_ruot_script_va_style_bi_xoa_ca_noi_dung():
    """Xoá thẻ mà giữ ruột thì `alert(1)` hiện ra thành chữ giữa bài, và CSS đổ ra màn hình."""
    assert lam_sach("<script>alert(1)</script>") == ""
    assert lam_sach("<style>body{display:none}</style>") == ""


def test_the_thuong_ngoai_allowlist_thi_GIU_chu_ben_trong():
    """Khác `script`/`style`: `<b>` không nguy hiểm, xoá chữ của người ta mới là mất dữ liệu."""
    assert lam_sach("<b>đậm</b>") == "đậm"


def test_chu_nguoi_dung_go_KHONG_bien_thanh_the():
    """Site tài chính viết "giá < 27.80" mỗi ngày — nó phải sống sót, dạng đã escape."""
    ra = lam_sach("giá < 27.80 và lãi > 5% & phí")
    assert "&lt;" in ra and "&gt;" in ra and "&amp;" in ra
    assert van_ban_thuan(ra) == "giá < 27.80 và lãi > 5% & phí"


# --- idempotent --------------------------------------------------------------


@pytest.mark.parametrize(
    "doc",
    [
        *XSS,
        '<a href="https://gikky.net">x</a>',
        '<a href="javascript:alert(1)">x</a>',
        "<p>đoạn</p><ul><li>một</li></ul><blockquote>trích</blockquote>",
        "<pre><code>giá &lt; 27.80</code></pre>",
        "giá < 27.80 & lãi",
        "<h2>tiêu đề</h2><h3>phụ</h3><hr><p>a<br>b</p>",
        "",
    ],
)
def test_lam_sach_IDEMPOTENT(doc):
    """`lam_sach(lam_sach(x)) == lam_sach(x)` — điều kiện của bất biến "body == lam_sach(body)"."""
    mot = lam_sach(doc)
    assert lam_sach(mot) == mot


# --- van_ban_thuan -----------------------------------------------------------


@pytest.mark.parametrize("doc", [*XSS, "<b>đậm</b><p>đoạn</p>"])
def test_van_ban_thuan_khong_con_dau_nhon(doc):
    """Đầu vào có thẻ ⇒ đầu ra **không còn dấu `<`**. Đây là điều kiện của `meta description`."""
    assert "<" not in van_ban_thuan(doc)


def test_van_ban_thuan_khong_dinh_chu_giua_hai_khoi():
    """`<p>a</p><p>b</p>` dính thành `ab` là lỗi hay gặp nhất của mọi bộ gỡ thẻ viết vội."""
    assert van_ban_thuan("<p>một</p><p>hai</p>") == "một hai"
    assert van_ban_thuan("<ul><li>một</li><li>hai</li></ul>") == "một hai"
    assert van_ban_thuan("một<br>hai") == "một hai"


def test_van_ban_thuan_go_thuc_the():
    """`&amp;` để nguyên là người đọc thấy đúng năm ký tự đó trên thẻ feed."""
    assert van_ban_thuan("<p>Tôi &amp; bạn</p>") == "Tôi & bạn"


def test_van_ban_thuan_gop_khoang_trang():
    assert van_ban_thuan("<p>một\n\n   hai</p>") == "một hai"


def test_van_ban_thuan_de_yen_van_ban_thuong():
    """Chuỗi markdown cũ đi qua đây không được biến dạng — hai định dạng còn cùng tồn tại."""
    assert van_ban_thuan("**đậm** và `mã`") == "**đậm** và `mã`"
