"""L38 — khu quản trị cũng phải trả **409**, không phải 500, khi bình luận biến mất giữa chừng.

Cùng cuộc đua với `L08` (`test_dua_ghi_500.py`), cùng một hàng `Comment`, khác đúng một
thứ: `NinjaAPI`. `dat_an_binh_luan` gọi `Comment.objects.select_for_update().get(pk=…)`,
nên tác giả bấm **Xoá** (xoá THẬT — PLAN 5.3: bình luận không reply con và chưa từng được
trích thì `DELETE` thật) đúng lúc mod bấm **Ẩn** làm hàng biến mất giữa transaction.

Trước lượt vá, lưới `Comment.DoesNotExist` bị chôn bên trong `dang_ky_xu_ly_loi_ghi`, mà
`api/quan_tri.py` **không** gọi hàm ấy (nó có bản auth/CSRF riêng). Kết quả: `api_v1` trả
409 còn `api_admin` trả 500 cho cùng một cuộc đua — một mod bấm nút và nhận về một trang
lỗi không nói được gì.
"""

import pytest

from core.models.binh_luan import Comment

from tests._quan_tri import dang_nhap, dung_du_lieu, dung_mod, ma_loi


@pytest.mark.django_db
def test_mod_bam_AN_dung_luc_tac_gia_xoa_that_tra_409_khong_phai_500(
    monkeypatch,
):
    """Chèn cú xoá thật vào **giữa** handler, sau khi nó đã nạp được hàng.

    Chèn ở `api.quan_tri_kiem_duyet.dat_an_binh_luan` chứ không ở `core.ghi`: đó là tên mà
    handler thật sự gọi, nên bản vá ở tầng khác không làm bài đo xanh nhầm.
    """
    dl = dung_du_lieu()
    mod = dang_nhap(dung_mod())
    c = dl["binh_luan"]

    from api import quan_tri_kiem_duyet
    from core import ghi

    that = ghi.dat_an_binh_luan

    def chen_xoa(*, comment, **kw):
        Comment.objects.filter(pk=comment.pk).delete()
        return that(comment=comment, **kw)

    monkeypatch.setattr(quan_tri_kiem_duyet, "dat_an_binh_luan", chen_xoa)

    r = mod.post(
        f"/api/admin/comments/{c.pk}/an",
        data={"an": True, "ly_do": "spam"},
        content_type="application/json",
    )
    assert r.status_code == 409, (
        f"khu quản trị trả {r.status_code} cho cuộc đua mà `api_v1` trả 409 — "
        "lưới `Comment.DoesNotExist` chưa được gắn cho `api_admin` (L38)"
    )
    assert ma_loi(r) == "noi_dung_da_go"


@pytest.mark.django_db
def test_hai_NinjaAPI_deu_co_luoi_Comment_DoesNotExist():
    """Bài đo **cấu trúc**: API thứ ba mở ra mà quên gắn lưới ⇒ ĐỎ.

    Bài trên đo một đường đi cụ thể; bài này đo cái bất biến. Không có nó thì lượt sau
    thêm một `NinjaAPI` có đường ghi đụng `Comment` sẽ lặp lại đúng L38, và bài trên vẫn
    xanh vì nó chỉ biết về `api_admin`.
    """
    from api.quan_tri import api_admin
    from api.v1 import api_v1

    for api in (api_v1, api_admin):
        assert Comment.DoesNotExist in api._exception_handlers, (
            f"{api.title!r} chưa gắn lưới `Comment.DoesNotExist` — mọi đường ghi đụng "
            "`Comment` đều có ca hàng-biến-mất-giữa-chừng, và không có lưới thì nó là 500"
        )
