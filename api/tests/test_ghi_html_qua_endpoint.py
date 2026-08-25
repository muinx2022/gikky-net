"""Sanitize phải xảy ra ở **ĐƯỜNG GHI THẬT**, không chỉ trong hàm `lam_sach`.

`tests/test_lam_sach_html.py` chứng minh cái hàm đúng. Nó **không** chứng minh cái hàm
được gọi — và đó mới là câu hỏi mà một lệnh `curl` trả lời được. Sanitize ở client bỏ qua
được bằng một dòng lệnh; nếu `core/ghi.py` không gọi `lam_sach` thì mọi bài đo đơn vị ở
file kia vẫn xanh trong khi DB đầy `<script>`.

Ba đường ghi `body` của mốc, cả ba đo ở đây bằng HTTP thật:

| Đường | Endpoint |
|---|---|
| đăng bài (= tạo mốc 1) | `POST /api/v1/machs` |
| nối mốc | `POST /api/v1/machs/{id}/mocs` |
| sửa mốc | `PATCH /api/v1/mocs/{id}` |

Bài đo hỏi **DB**, không hỏi response: một handler dọn chuỗi trước khi trả về mà vẫn ghi
bẩn xuống DB là ca hỏng tệ nhất — nó xanh ở mọi bài đo đọc response, và nội dung độc nằm
sẵn chờ lần render sau.
"""

import pytest

from core.lam_sach_html import DINH_DANG_HTML, lam_sach
from core.models.moc import Moc

from .conftest import dat, lay

#: Một bài viết mang đủ sáu vector, gõ liền như người ta dán vào ô soạn thảo.
DOC = (
    "<p>Vào lệnh 27.80.</p>"
    "<script>alert(1)</script>"
    "<img src=x onerror=alert(1)>"
    '<a href="javascript:alert(1)">bấm đi</a>'
    '<iframe src="https://evil.example/x"></iframe>'
    "<style>body{display:none}</style>"
    '<p onclick="alert(1)" style="color:red">chữ thường</p>'
)


def _kiem_sach(body: str) -> None:
    """Chuỗi này đã qua `lam_sach` chưa — hỏi bằng bằng chứng, không bằng lời."""
    thap = body.lower()
    for xau in ("<script", "<img", "<iframe", "<style", "onerror", "onclick", "javascript:"):
        assert xau not in thap, f"{xau!r} còn sống trong DB: {body!r}"
    assert "style=" not in thap
    assert lam_sach(body) == body, "body trong DB phải bằng chính nó sau khi sanitize"
    assert "Vào lệnh 27.80." in body, "chữ tử tế của người viết không được mất theo"


@pytest.mark.django_db
def test_dang_bai_sanitize_va_dat_nhan_html(client, sub, nguoi_a):
    client.force_login(nguoi_a)
    d = dat(
        client,
        "/api/v1/machs",
        {"sub": sub.slug, "title": "Nhật ký lệnh HPG", "body": DOC},
        status=201,
    )
    moc = Moc.objects.get(pk=d["mocs"][0]["id"])
    _kiem_sach(moc.body)
    assert moc.body_dinh_dang == DINH_DANG_HTML
    assert d["mocs"][0]["body_dinh_dang"] == DINH_DANG_HTML
    assert d["mocs"][0]["body"] == moc.body, "response và DB phải là CÙNG một chuỗi"


@pytest.mark.django_db
def test_noi_moc_sanitize_va_dat_nhan_html(client, mach_cua_a, nguoi_a):
    client.force_login(nguoi_a)
    d = dat(client, f"/api/v1/machs/{mach_cua_a.pk}/mocs", {"body": DOC}, status=201)
    moc = Moc.objects.get(pk=d["id"])
    _kiem_sach(moc.body)
    assert moc.body_dinh_dang == DINH_DANG_HTML
    assert d["body_dinh_dang"] == DINH_DANG_HTML


@pytest.mark.django_db
def test_sua_moc_sanitize_va_dat_nhan_html(client, mach_cua_a, nguoi_a):
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    d = dat(
        client, f"/api/v1/mocs/{moc.pk}", {"body": DOC}, status=200, method="patch"
    )
    moc.refresh_from_db()
    _kiem_sach(moc.body)
    assert moc.body_dinh_dang == DINH_DANG_HTML
    assert d["body_dinh_dang"] == DINH_DANG_HTML


@pytest.mark.django_db
def test_link_hop_le_song_sot_qua_duong_ghi(client, sub, nguoi_a):
    """Vế "không chặn nhầm": link tử tế phải qua được, kèm `rel`/`target` do server ép."""
    client.force_login(nguoi_a)
    d = dat(
        client,
        "/api/v1/machs",
        {
            "sub": sub.slug,
            "title": "T",
            "body": '<p>Xem <a href="https://gikky.net/luat">luật</a>.</p>',
        },
        status=201,
    )
    body = Moc.objects.get(pk=d["mocs"][0]["id"]).body
    assert 'href="https://gikky.net/luat"' in body
    assert 'rel="nofollow ugc noopener"' in body and 'target="_blank"' in body


@pytest.mark.django_db
def test_the_feed_KHONG_ro_the_html_ra_xem_truoc(client, sub, nguoi_a):
    """`xem_truoc.trich` đi tiếp vào `meta description` — chỗ React không escape hộ."""
    client.force_login(nguoi_a)
    dat(
        client,
        "/api/v1/machs",
        {"sub": sub.slug, "title": "T", "body": DOC},
        status=201,
    )
    d = lay(client, "/api/v1/feeds/moi?limit=50")
    trich = d["items"][0]["xem_truoc"]["trich"]
    assert "<" not in trich, f"thẻ rò ra trích đoạn: {trich!r}"
    assert "Vào lệnh 27.80." in trich
    assert "chữ thường" in trich, "hai khối phải cách nhau chứ không dính vào nhau"


@pytest.mark.django_db
def test_moi_body_trong_DB_deu_bang_chinh_no_sau_sanitize(client, seed, nguoi_a):
    """Bất biến của plan (luật 4): thay cho việc sanitize lần hai lúc ĐỌC.

    Rẻ hơn một lượt sanitize trên mỗi request, và bắt được cả hàng lọt vào bằng đường
    khác — `manage.py shell`, migration tay, script cũ.

    ⚠ **Phải GHI một bài bẩn trước khi đo, không chỉ dựa vào seed.** Seed viết bằng văn
    xuôi thuần: nó thoả bất biến kể cả khi `lam_sach` bị gỡ khỏi đường ghi, nên một bài đo
    chỉ đọc seed là bài đo RỖNG — nó khẳng định đúng bất kể code làm gì. Bài này vì thế
    đẩy `DOC` qua đúng ba đường ghi rồi mới quét cả bảng.
    """
    client.force_login(nguoi_a)
    d = dat(
        client,
        "/api/v1/machs",
        {"sub": seed.sub.slug, "title": "Bài bẩn", "body": DOC},
        status=201,
    )
    dat(client, f"/api/v1/machs/{d['id']}/mocs", {"body": DOC}, status=201)
    dat(
        client,
        f"/api/v1/mocs/{d['mocs'][0]['id']}",
        {"body": DOC},
        status=200,
        method="patch",
    )

    hong = [
        m.pk
        for m in Moc.objects.all()
        if m.body_dinh_dang == DINH_DANG_HTML and lam_sach(m.body) != m.body
    ]
    assert hong == [], f"các mốc phá bất biến sanitize: {hong}"
