"""`<img>` trong thân bài: allowlist mở ra vừa đủ, và không rộng hơn một ly.

Mở `img` là mở đúng cái thẻ mà mọi bộ lọc HTML đều bị thủng ở đó, nên bộ đo này hỏi cả
hai chiều:

- **giữ đúng thứ phải giữ**: ảnh của chính site đi qua nguyên vẹn, kể cả khi người ta
  đính kèm `onerror=` bên cạnh nó;
- **gỡ CẢ THẺ, không chỉ gỡ thuộc tính**, với mọi `src` không trỏ vào kho của site — ảnh
  ngoài site là pixel theo dõi (mỗi người đọc bài lộ IP + user-agent cho bên thứ ba) và
  là mixed content; một `<img>` cụt `src` để lại là một ô vỡ giữa bài.

**Đo qua HTTP thật, hỏi DB.** `test_lam_sach_html.py` chứng minh cái hàm đúng; nó không
chứng minh cái hàm được GỌI trên đường ghi — mà đó mới là câu hỏi một lệnh `curl` trả
lời được. Cùng lý lẽ với `test_ghi_html_qua_endpoint.py`, và cùng cách: đọc `Moc.body`
từ DB chứ không đọc response, vì một handler dọn chuỗi trước khi trả về mà vẫn ghi bẩn
xuống DB là ca hỏng tệ nhất — nó xanh ở mọi bài đo đọc response.
"""

import pytest

from core.lam_sach_html import lam_sach
from core.models.moc import Moc

from .conftest import dat

#: Ảnh HỢP LỆ: đúng tiền tố `MEDIA_URL`. Không cần file thật trên đĩa — `lam_sach` xét
#: chuỗi `src`, không xét đĩa (nó chạy trong đường ghi, không được đi hỏi storage).
HOP_LE = "/media/anh/aaaabbbbccccdddd.png"

#: Mỗi dòng: (tên ca, đoạn HTML người dùng gửi, còn `<img` trong DB không).
CA_IMG = [
    (
        "ngoai-site-https",
        '<img src="https://ke-tan-cong.example/pixel.gif">',
        False,
    ),
    (
        "protocol-relative",
        '<img src="//evil.example/x.png">',
        False,
    ),
    (
        "javascript-scheme",
        '<img src="javascript:alert(1)">',
        False,
    ),
    (
        "duong-dan-tuong-doi",
        '<img src="x.png">',
        False,
    ),
    (
        "data-uri",
        '<img src="data:image/svg+xml;base64,PHN2Zz48c2NyaXB0Lz48L3N2Zz4=">',
        False,
    ),
    (
        "media-nhung-di-nguoc",
        '<img src="/media/../../etc/passwd">',
        False,
    ),
    (
        "gan-giong-media",
        '<img src="/mediaevil.example/x.png">',
        False,
    ),
    (
        "hop-le-kem-onerror",
        f'<img src="{HOP_LE}" onerror="alert(1)">',
        True,
    ),
    (
        "hop-le-co-alt",
        f'<img src="{HOP_LE}" alt="Biểu đồ HPG">',
        True,
    ),
]


def _dang(client, than: str, sub) -> Moc:
    """Đăng bài qua `POST /api/v1/machs` rồi đọc mốc 1 **từ DB**."""
    d = dat(
        client,
        "/api/v1/machs",
        {"sub": sub.slug, "title": "Nhật ký lệnh HPG", "body": than},
        status=201,
    )
    return Moc.objects.get(pk=d["mocs"][0]["id"])


@pytest.mark.django_db
@pytest.mark.parametrize(
    "than,con_anh", [(t, c) for _, t, c in CA_IMG], ids=[n for n, _, _ in CA_IMG]
)
def test_img_qua_duong_ghi_that(client, sub, nguoi_a, than, con_anh):
    """Thử phá: bỏ lọc tiền tố `MEDIA_URL` là 7 ca `False` ở đây ĐỎ cùng lúc."""
    client.force_login(nguoi_a)
    moc = _dang(client, f"<p>Vào lệnh 27.80.</p>{than}", sub)

    assert ("<img" in moc.body) is con_anh, moc.body
    assert "Vào lệnh 27.80." in moc.body, "chữ của người viết không được mất theo"
    # Dù giữ hay gỡ, không ca nào được để lại một mảnh thi hành được.
    thap = moc.body.lower()
    for xau in ("onerror", "javascript:", "data:", "srcset", "style="):
        assert xau not in thap, f"{xau!r} còn sống trong DB: {moc.body!r}"
    assert lam_sach(moc.body) == moc.body, "body trong DB phải bằng chính nó sau sanitize"


@pytest.mark.django_db
def test_anh_ngoai_site_bi_go_CA_THE_khong_de_lai_o_vo(client, sub, nguoi_a):
    """Gỡ mỗi thuộc tính `src` là để lại `<img>` cụt — một ô vỡ giữa bài, không phải một
    kết quả an toàn. Bài đo tách riêng vì `"<img" not in body` ở trên đọc như một phép
    kiểm bảo mật, còn đây là phép kiểm **hiển thị**, và hai thứ hỏng độc lập với nhau.
    """
    client.force_login(nguoi_a)
    moc = _dang(client, '<p>a</p><img src="https://evil.example/p.gif" alt="x">', sub)
    assert moc.body == "<p>a</p>", moc.body


@pytest.mark.django_db
def test_bai_chi_co_ANH_van_dang_duoc(client, sub, nguoi_a):
    """`_body_sach_khong_rong` từ chối body rỗng-sau-sanitize. Một bài chỉ gồm ảnh hợp lệ
    KHÔNG rỗng, và nếu nó bị từ chối thì cả tính năng "upload ảnh vào nội dung" vô dụng
    với đúng ca dùng nhiều nhất: dán một tấm biểu đồ, không viết gì.
    """
    client.force_login(nguoi_a)
    moc = _dang(client, f'<img src="{HOP_LE}" alt="Biểu đồ">', sub)
    assert moc.body == f'<img src="{HOP_LE}" alt="Biểu đồ">'


@pytest.mark.django_db
def test_sua_moc_cung_loc_img(client, mach_cua_a, nguoi_a):
    """Đường ghi thứ ba. Chỉ đo `POST /machs` thì một `PATCH` quên sanitize vẫn xanh —
    và `PATCH` là đường mà kẻ tấn công dùng, vì nó không phải đi qua khâu tạo mạch.
    """
    client.force_login(nguoi_a)
    moc = Moc.objects.get(mach=mach_cua_a, seq=2)
    d = dat(
        client,
        f"/api/v1/mocs/{moc.pk}",
        {"body": '<p>b</p><img src="https://evil.example/p.gif">'},
        status=200,
        method="patch",
    )
    assert "<img" not in Moc.objects.get(pk=moc.pk).body
    assert "<img" not in d["body"]


@pytest.mark.django_db
def test_noi_moc_cung_loc_img(client, mach_cua_a, nguoi_a):
    """Đường ghi thứ hai — `POST /machs/{id}/mocs`."""
    client.force_login(nguoi_a)
    d = dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/mocs",
        {"body": '<p>c</p><img src="//evil.example/p.gif">'},
        status=201,
    )
    assert "<img" not in Moc.objects.get(pk=d["id"]).body


@pytest.mark.django_db
def test_xem_truoc_khong_ro_the_img(client, sub, nguoi_a):
    """`van_ban_thuan` (thẻ feed, Meilisearch, `meta description`) không được rò `<img`.

    Ảnh hợp lệ vẫn là một thẻ trong `body`; nếu nó chảy nguyên văn ra `xem_truoc` thì
    `meta description` của trang mang một đoạn HTML — đúng thứ mà bán kính ảnh hưởng của
    plan gọi là "tuyệt đối không được rò".
    """
    from core.lam_sach_html import van_ban_thuan

    client.force_login(nguoi_a)
    moc = _dang(client, f'<p>Vào lệnh 27.80.</p><img src="{HOP_LE}" alt="Biểu đồ">', sub)
    tho = van_ban_thuan(moc.body)
    assert "<" not in tho and "img" not in tho
    assert tho == "Vào lệnh 27.80."
