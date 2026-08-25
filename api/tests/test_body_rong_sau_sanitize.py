"""Thân bài chỉ gồm thẻ bị chặn ⇒ **từ chối**, không lưu bài rỗng.

Lỗ này có thật trước lượt vá 2026-08-24: `min_length=1` của schema chạy trên chuỗi NGƯỜI
DÙNG GỬI, `lam_sach` chạy sau — nên `<script>alert(1)</script>` qua được cửa đầu rồi bị
sanitize thành chuỗi rỗng, và `POST /machs` trả **201 với `body=""`**. Kết quả là một bài
viết trống nằm trong feed mà đường sửa cũng không gỡ được (sửa cũng đòi body).
"""

import pytest
from django.core.exceptions import ValidationError

from core.ghi import them_moc, tao_mach


@pytest.mark.django_db
@pytest.mark.parametrize(
    "than",
    [
        "<script>alert(1)</script>",
        "<style>a{color:red}</style>",
        "   ",
        "<script>x</script>   <style>y</style>",
    ],
    ids=["script", "style", "chi-khoang-trang", "hai-the-bi-chan"],
)
def test_body_rong_sau_sanitize_bi_TU_CHOI(than, tac_gia, sub):
    with pytest.raises(ValidationError):
        tao_mach(author=tac_gia, sub=sub, title="Tiêu đề hợp lệ", body=than)


@pytest.mark.django_db
def test_body_CO_noi_dung_that_van_qua_duoc(tac_gia, sub):
    """Đối chứng — nếu không có bài này, luật trên có thể là 'chặn hết'."""
    _mach, moc = tao_mach(
        author=tac_gia,
        sub=sub,
        title="Tiêu đề hợp lệ",
        body="<p>Vào HPG 27.80<script>alert(1)</script></p>",
    )
    assert "27.80" in moc.body
    assert "<script" not in moc.body


@pytest.mark.django_db
def test_noi_moc_cung_bi_chan(tac_gia, sub):
    """Đường ghi thứ hai — `them_moc` phải chặn y hệt, không chỉ `tao_mach`."""
    mach, _moc = tao_mach(
        author=tac_gia, sub=sub, title="Tiêu đề hợp lệ", body="<p>Mốc 1</p>"
    )
    with pytest.raises(ValidationError):
        them_moc(mach=mach, author=tac_gia, body="<script>alert(1)</script>")
