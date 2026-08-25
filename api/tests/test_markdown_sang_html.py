"""`core/markdown_sang_html.py` + bước dữ liệu của migration `0014`.

Hai câu hỏi tách bạch:

1. **Dịch có đúng 7 cấu trúc cũ không** — nguồn sự thật của cú pháp cũ là
   `apps/web/lib/markdown.ts`; ở đây đo bản dịch sang Python của nó. Dịch sai là mọi bài
   viết trước 2026-08-24 hiện ra khác đi, vĩnh viễn, và không có đường về.
2. **Bước dữ liệu có chạy lại được không** — `chuyen_moc_sang_html` phải idempotent, vì
   một migration nửa chừng (tiến trình bị giết) sẽ được chạy lại, và lượt hai mà dịch
   tiếp bản HTML thì `<p>` thành `&lt;p&gt;` trên toàn bảng.

Bài đo cuối chạy trên **mẫu thật của seed** (mạch HPG 9 mốc + VNM 6 mốc): dữ liệu tự bịa
hay có hình dạng vừa khít cái hàm vừa viết.
"""

import pytest

from core.lam_sach_html import DINH_DANG_HTML, DINH_DANG_MARKDOWN, lam_sach
from core.markdown_sang_html import (
    chuyen_moc_sang_html,
    markdown_sang_html,
    url_an_toan,
)
from core.models.moc import Moc

# --- 7 cấu trúc --------------------------------------------------------------


def test_dam():
    assert markdown_sang_html("**đậm**") == "<p><strong>đậm</strong></p>"


def test_nghieng():
    assert markdown_sang_html("*nghiêng*") == "<p><em>nghiêng</em></p>"


def test_ma():
    assert markdown_sang_html("`27.80`") == "<p><code>27.80</code></p>"


def test_ma_dung_TRUOC_moi_cu_phap_khac():
    """Nội dung trong dấu huyền là mã: `**` trong đó phải giữ nguyên chữ (luật của bản gốc)."""
    assert markdown_sang_html("`**x**`") == "<p><code>**x**</code></p>"


def test_link():
    ra = markdown_sang_html("[tài liệu](https://gikky.net/luat)")
    assert 'href="https://gikky.net/luat"' in ra
    assert ">tài liệu</a>" in ra


def test_link_giao_thuc_xau_ROI_VE_VAN_BAN_giu_nguyen_van():
    """Bản gốc không im lặng bỏ chữ đi: người viết phải thấy link của mình không thành link."""
    ra = markdown_sang_html("[bấm](javascript:alert(1))")
    assert ra == "<p>[bấm](javascript:alert(1))</p>"
    assert "<a" not in ra


def test_trich():
    ra = markdown_sang_html("> dòng một\n> dòng hai")
    assert ra == "<blockquote>dòng một dòng hai</blockquote>"


def test_danh_sach():
    ra = markdown_sang_html("- một\n- hai\n* ba\n+ bốn")
    assert ra == "<ul><li>một</li><li>hai</li><li>ba</li><li>bốn</li></ul>"


def test_doan_va_xuong_dong_don_thanh_br():
    """Xuống dòng ĐƠN là `<br>`, dòng trống mới tách đoạn — đúng như `ThanVan` từng render."""
    assert markdown_sang_html("a\nb\n\nc") == "<p>a<br>b</p><p>c</p>"


def test_ba_dong_trong_van_la_MOT_ranh_gioi_doan():
    assert markdown_sang_html("a\n\n\n\nb") == "<p>a</p><p>b</p>"


def test_khong_co_cu_phap_thu_tam():
    """Tập con cũ **không có** tiêu đề, ảnh, bảng — chúng phải ở lại đúng như bản gốc render.

    ⚠ `![alt](url)` **không** ra `<img>`, và cũng không ra nguyên văn: bản gốc không biết
    cú pháp ảnh nên nó thấy dấu `!` là chữ thường rồi thấy `[alt](url)` là một LINK. Bản
    dịch phải sai giống hệt bản gốc — sửa "cho đẹp" ở đây là làm bài cũ hiện khác đi.
    """
    assert markdown_sang_html("# tiêu đề") == "<p># tiêu đề</p>"
    ra = markdown_sang_html("![alt](https://a.b/c.png)")
    assert ra.startswith("<p>!<a ") and "<img" not in ra


def test_body_rong_ra_chuoi_rong():
    assert markdown_sang_html("") == ""
    assert markdown_sang_html("\n\n   \n") == ""


# --- an toàn ở đầu ra --------------------------------------------------------


def test_HTML_trong_markdown_cu_bi_ESCAPE_chu_khong_duoc_nhung():
    """Dữ liệu cũ **chưa từng đi qua `lam_sach`** — markdown cũ escape mọi thứ ở frontend.

    Đây là ca nguy hiểm nhất của cả đợt: một người đã gõ `<script>` vào bài viết năm
    ngoái và nó nằm nguyên văn trong DB, vô hại **chỉ vì** renderer cũ không nhúng HTML.
    Migration nào bê chuỗi đó sang cột "html" mà không escape là tự bật XSS trên dữ liệu
    của chính mình.
    """
    ra = markdown_sang_html("<script>alert(1)</script> và <b>đậm</b>")
    assert "<script" not in ra and "<b>" not in ra
    assert "&lt;script&gt;" in ra


def test_ket_qua_luon_bang_chinh_no_sau_lam_sach():
    """Đầu ra của bộ dịch phải thoả bất biến của DB ngay từ lúc ghi."""
    for goc in [
        "**đậm** *nghiêng* `mã`",
        "[x](https://gikky.net)",
        "> trích",
        "- một\n- hai",
        "giá < 27.80 & lãi > 5%",
        "a\nb\n\nc",
    ]:
        ra = markdown_sang_html(goc)
        assert lam_sach(ra) == ra, goc


@pytest.mark.parametrize(
    "url,mong",
    [
        ("https://a.b", True),
        ("http://a.b", True),
        ("mailto:x@a.b", True),
        ("/m/abc-1", True),
        ("//evil.example", False),
        ("javascript:alert(1)", False),
        ("data:text/html,x", False),
        ("", False),
        ("a.b/c", False),
    ],
)
def test_url_an_toan(url, mong):
    assert url_an_toan(url) is mong


# --- bước dữ liệu của migration 0014 -----------------------------------------


@pytest.mark.django_db
def test_chuyen_doi_va_dat_nhan(mach_cua_a):
    """Chuyển xong: `body` là HTML, nhãn là `html`, và cả hai đổi trong CÙNG một câu UPDATE."""
    Moc.objects.filter(mach=mach_cua_a).update(
        body="**đậm** và [x](https://gikky.net)", body_dinh_dang=DINH_DANG_MARKDOWN
    )

    assert chuyen_moc_sang_html(Moc) == Moc.objects.filter(mach=mach_cua_a).count()

    for moc in Moc.objects.filter(mach=mach_cua_a):
        assert moc.body_dinh_dang == DINH_DANG_HTML
        assert "<strong>đậm</strong>" in moc.body
        assert 'href="https://gikky.net"' in moc.body


@pytest.mark.django_db
def test_chuyen_doi_IDEMPOTENT(mach_cua_a):
    """Lượt hai không đụng hàng nào — nếu đụng, `<p>` sẽ thành `&lt;p&gt;` trên toàn bảng."""
    Moc.objects.filter(mach=mach_cua_a).update(
        body="**đậm**", body_dinh_dang=DINH_DANG_MARKDOWN
    )
    chuyen_moc_sang_html(Moc)
    sau_lan_1 = {m.pk: m.body for m in Moc.objects.filter(mach=mach_cua_a)}

    assert chuyen_moc_sang_html(Moc) == 0
    assert {m.pk: m.body for m in Moc.objects.filter(mach=mach_cua_a)} == sau_lan_1


@pytest.mark.django_db
def test_hang_da_la_html_khong_bi_dich_lai(mach_cua_a):
    """Bộ lọc là NHÃN, không phải nội dung — hàng `html` đứng yên kể cả khi trông như markdown."""
    moc = Moc.objects.filter(mach=mach_cua_a).first()
    Moc.objects.filter(pk=moc.pk).update(
        body="<p>**không phải markdown**</p>", body_dinh_dang=DINH_DANG_HTML
    )
    chuyen_moc_sang_html(Moc)
    assert Moc.objects.get(pk=moc.pk).body == "<p>**không phải markdown**</p>"


@pytest.mark.django_db
def test_tren_MAU_THAT_cua_seed(seed, seed_post_thuong):
    """Mẫu thật: HPG 9 mốc + VNM 6 mốc + post thường, cộng một mốc bị nhét đủ 7 cấu trúc.

    Seed hôm nay viết bằng văn xuôi thuần (không dấu markdown nào), nên chạy migration
    trên nguyên seed là một bài đo gần như rỗng: nó xanh kể cả khi bộ dịch chỉ biết bọc
    `<p>`. Vì thế một mốc THẬT của seed bị ghi đè bằng bài viết mang đủ 7 cấu trúc trước
    khi chạy — vẫn là hàng thật, cấu trúc mạch thật, chỉ nội dung là mẫu khó.
    """
    mau = (
        "**Vào lệnh** HPG ở `27.80`, xem [luận điểm](https://gikky.net/luat).\n"
        "Dừng lỗ 26.40.\n\n"
        "> Thủng thì luận điểm sai chứ không phải thị trường sai.\n\n"
        "- tồn kho quặng giá thấp\n"
        "- biên gộp khó xấu hơn\n"
    )
    moc_1 = Moc.objects.get(mach=seed, seq=1)
    Moc.objects.all().update(body_dinh_dang=DINH_DANG_MARKDOWN)
    Moc.objects.filter(pk=moc_1.pk).update(body=mau)

    dem = chuyen_moc_sang_html(Moc)
    assert dem == Moc.objects.count() >= 9 + 6 + 1

    for moc in Moc.objects.all():
        assert moc.body_dinh_dang == DINH_DANG_HTML
        assert "**" not in moc.body, f"còn dấu đậm sót lại ở mốc {moc.pk}"
        assert "](" not in moc.body, f"còn link markdown sót lại ở mốc {moc.pk}"
        assert lam_sach(moc.body) == moc.body, f"mốc {moc.pk} phá bất biến sanitize"

    ra = Moc.objects.get(pk=moc_1.pk).body
    assert "<strong>Vào lệnh</strong>" in ra
    assert "<code>27.80</code>" in ra
    assert 'href="https://gikky.net/luat"' in ra
    assert "<br>Dừng lỗ 26.40" in ra
    assert "<blockquote>" in ra
    assert ra.count("<li>") == 2
