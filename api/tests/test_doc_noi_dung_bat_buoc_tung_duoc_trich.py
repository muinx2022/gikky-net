"""`tung_duoc_trich` phải là keyword BẮT BUỘC ở cả ba hàm dựng cây — T2 của vá lượt 2.

Vì sao cần một bài đo riêng cho một chi tiết chữ ký hàm: giá trị mặc định `frozenset()`
**chính là hành vi bug Z1**. Quên truyền kwarg thì vế "đã TỪNG được trích" tắt lặng, bia
mộ của bình luận đã trích biến mất khỏi khán đài, `comment_id` trên blockquote trỏ vào một
bình luận không tồn tại ở bất kỳ response nào — HTTP 200, không exception, không log,
không test nào đỏ.

Hôm nay chỉ có 2 call site và cả hai đều đúng, nên bài đo hành vi không bắt được gì. Đường
gọi thứ ba mới là chỗ nguy: `DELETE /comments/{id}` của Phase 2, `/machs/{id}/me` của
Phase 3, hay endpoint tìm kiếm. Bỏ mặc định biến "quên" thành `TypeError` **ngay tại lời
gọi**, và bài dưới đây là thứ giữ cho ai đó không lặng lẽ trả mặc định về để "cho tiện".

Không cần DB: `TypeError` do Python ném lúc bind tham số, trước khi thân hàm chạy.
"""

import inspect

import pytest

from core.doc_noi_dung import dung_cay, dung_cay_theo_sort, lat_cat_ngan_keo

BA_HAM = [dung_cay, dung_cay_theo_sort, lat_cat_ngan_keo]


@pytest.mark.parametrize("ham", BA_HAM, ids=lambda f: f.__name__)
def test_tung_duoc_trich_khong_co_gia_tri_mac_dinh(ham):
    """Mặc định `frozenset()` là hành vi bug cũ được đóng gói thành "mặc định hợp lý"."""
    tham_so = inspect.signature(ham).parameters["tung_duoc_trich"]

    assert tham_so.kind is inspect.Parameter.KEYWORD_ONLY
    assert tham_so.default is inspect.Parameter.empty, (
        f"{ham.__name__} lại có mặc định cho `tung_duoc_trich` — đó đúng là hành vi Z1"
    )


def test_goi_dung_cay_thieu_kwarg_la_TypeError():
    with pytest.raises(TypeError, match="tung_duoc_trich"):
        dung_cay([], sap_goc=list, sap_con=list)


def test_goi_dung_cay_theo_sort_thieu_kwarg_la_TypeError():
    with pytest.raises(TypeError, match="tung_duoc_trich"):
        dung_cay_theo_sort([], sort="moi_nhat", mach=None, now=None)


def test_goi_lat_cat_ngan_keo_thieu_kwarg_la_TypeError():
    with pytest.raises(TypeError, match="tung_duoc_trich"):
        lat_cat_ngan_keo([], seq=1)
