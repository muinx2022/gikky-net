"""Bình luận soạn bằng Tiptap — cột `body_dinh_dang` + `lam_sach` trên hai đường ghi.

User chốt 2026-08-26: ô soạn bình luận có **công tắc** bật Tiptap; tắt thì vẫn là textarea
như cũ. Nghĩa là bảng `Comment` từ nay chứa **hai loại thân**, và loại thứ hai là HTML in
thẳng ra DOM ở frontend.

Bốn nhóm câu hỏi, nhóm (1) là nhóm duy nhất mà hỏng thì mất trắng:

1. **HTML vào DB đã SẠCH chưa** — trên cả `POST` lẫn `PATCH`, và cả khi client nói dối.
2. **Nhãn có đi đúng với thân không** — nhãn sai lệch nguy hiểm hơn thân bẩn.
3. **Mặc định có an toàn không** — client không gửi nhãn thì phải ra `markdown`.
4. **Bất biến** — mọi hàng `html` trong DB bằng chính nó sau khi `lam_sach` lần nữa.
"""

import pytest

from core.ghi import sua_binh_luan, tao_binh_luan
from core.lam_sach_html import lam_sach
from core.models.binh_luan import Comment

from .conftest import dat, lay

#: Một thân mang cả phần hợp lệ lẫn ba mũi tấn công kinh điển.
BAN = (
    "<p>Ý kiến <strong>của tôi</strong>.</p>"
    '<script>alert(1)</script>'
    '<img src=x onerror="alert(2)">'
    '<a href="javascript:alert(3)">bấm đi</a>'
)


# --- (1) HTML vào DB đã sạch -------------------------------------------------


@pytest.mark.django_db
def test_POST_html_thi_body_trong_DB_da_SACH(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    d = dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": BAN, "body_dinh_dang": "html"},
        status=201,
    )
    c = Comment.objects.get(pk=d["id"])
    assert c.body_dinh_dang == "html"
    assert "<script" not in c.body
    assert "onerror" not in c.body
    assert "javascript:" not in c.body
    assert "<strong>của tôi</strong>" in c.body, "phần hợp lệ phải còn nguyên"


@pytest.mark.django_db
def test_PATCH_html_cung_di_qua_lam_sach(client, mach_cua_a, nguoi_b):
    """Đường sửa là đường **hay bị quên nhất**: bản đầu của lượt Tiptap cho mốc từng
    sanitize ở `them_moc` mà không ở `sua_moc`, tức ai cũng viết sạch rồi sửa thành bẩn."""
    client.force_login(nguoi_b)
    d = dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "lành"},
        status=201,
    )
    dat(
        client,
        f"/api/v1/comments/{d['id']}",
        {"body": BAN, "body_dinh_dang": "html"},
        status=200,
        method="patch",
    )
    c = Comment.objects.get(pk=d["id"])
    assert c.body_dinh_dang == "html"
    assert "<script" not in c.body and "onerror" not in c.body


@pytest.mark.django_db
def test_nhan_html_KHONG_phai_giay_phep(mach_cua_a, nguoi_b):
    """Nhãn chọn ĐƯỜNG XỬ LÝ, không cấp phép. Gọi thẳng `core/ghi.py` — cửa mà seed,
    migration dữ liệu và `manage.py shell` đi qua, tức cửa không có pydantic đứng trước."""
    c = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body=BAN, dinh_dang="html")
    assert "<script" not in c.body


@pytest.mark.django_db
def test_body_chi_gom_the_bi_chan_thi_TU_CHOI(client, mach_cua_a, nguoi_b):
    """`min_length=1` chạy trên chuỗi NGƯỜI DÙNG GỬI, `lam_sach` chạy sau đó.

    Một thân chỉ gồm `<script>` qua được validator rồi bị lọc thành chuỗi rỗng ⇒ nếu
    không chặn, DB có một bình luận trống mà không đường sửa nào gỡ được (sửa cũng đòi
    body). Đây đúng lỗ đã vá cho `POST /machs`, và nó lặp lại nguyên xi ở đây.
    """
    client.force_login(nguoi_b)
    dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "<script>alert(1)</script>", "body_dinh_dang": "html"},
        status=400,
    )
    assert Comment.objects.filter(mach=mach_cua_a).count() == 0


# --- (2)+(3) nhãn đi đúng với thân, và mặc định an toàn ----------------------


@pytest.mark.django_db
def test_khong_gui_nhan_thi_MAC_DINH_markdown(client, mach_cua_a, nguoi_b):
    """Client cũ / lời gọi tay không biết trường này ⇒ chuỗi đi đường `ThanVan` (React
    escape). Không có ca nào "quên gửi nhãn ⇒ HTML thô chạy"."""
    client.force_login(nguoi_b)
    d = dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "<b>đậm</b>"},
        status=201,
    )
    c = Comment.objects.get(pk=d["id"])
    assert c.body_dinh_dang == "markdown"
    assert c.body == "<b>đậm</b>", "nhánh markdown KHÔNG được đụng vào thân"


@pytest.mark.django_db
def test_nhan_la_bi_pydantic_chan_truoc_khi_vao_than_ham(client, mach_cua_a, nguoi_b):
    client.force_login(nguoi_b)
    dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "x", "body_dinh_dang": "tiptap"},
        # 400 chứ không 422: repo ánh xạ lỗi pydantic sang `tham_so_khong_hop_le`
        # (`api/loi.py`), và mã ấy là hợp đồng frontend đang bắt.
        status=400,
    )


@pytest.mark.django_db
def test_doi_duoc_CA_HAI_chieu(mach_cua_a, nguoi_b):
    """markdown → html → markdown. Nhãn và thân luôn khớp nhau sau mỗi lượt."""
    c = tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="thường")
    assert c.body_dinh_dang == "markdown"

    c = sua_binh_luan(comment=c, body="<p>giàu</p>", dinh_dang="html")
    assert c.body_dinh_dang == "html" and c.body == "<p>giàu</p>"

    c = sua_binh_luan(comment=c, body="về thường", dinh_dang="markdown")
    assert c.body_dinh_dang == "markdown" and c.body == "về thường"


@pytest.mark.django_db
def test_API_tra_nhan_ra_ngoai(client, mach_cua_a, nguoi_b):
    """Frontend chọn đường render bằng trường này — thiếu nó thì mọi bình luận HTML hiện
    nguyên văn `<p>`, hoặc tệ hơn: ai đó đoán bằng regex."""
    client.force_login(nguoi_b)
    dat(
        client,
        f"/api/v1/machs/{mach_cua_a.pk}/comments",
        {"body": "<p>giàu</p>", "body_dinh_dang": "html"},
        status=201,
    )
    cay = lay(client, f"/api/v1/machs/{mach_cua_a.pk}/comments")
    assert cay["threads"][0]["body_dinh_dang"] == "html"


# --- (4) bất biến ------------------------------------------------------------


@pytest.mark.django_db
def test_BAT_BIEN_moi_hang_html_bang_chinh_no_sau_khi_lam_sach_lan_nua(
    mach_cua_a, nguoi_b
):
    """Chuông báo nếu có dữ liệu lọt vào bằng một đường ghi thứ ba.

    Cùng bất biến mà `Moc` đang có. Nó không đo một hàm cụ thể nào — nó đo **trạng thái
    của cả bảng**, nên một `Comment.objects.create()` viết tay ở đâu đó trong repo sẽ làm
    nó đỏ, kể cả khi lời gọi ấy trông vô hại.
    """
    tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body=BAN, dinh_dang="html")
    tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="<p>lành</p>", dinh_dang="html")
    tao_binh_luan(mach=mach_cua_a, author=nguoi_b, body="<b>markdown thô</b>")

    ban = [
        c.pk
        for c in Comment.objects.filter(body_dinh_dang="html")
        if lam_sach(c.body) != c.body
    ]
    assert ban == [], f"hàng `html` chưa sạch: {ban}"
