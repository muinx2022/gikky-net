"""L39 — hàng rào chạy được cho "prod quên `TIN_X_FORWARDED_FOR`".

Sổ lỗi xếp L39 là *rủi ro triển khai, không phải lỗi code*, và ghi thẳng lý do nó nguy
hiểm: `api/.env.example` **nói ra bằng chữ, nhưng chữ không phải hàng rào**. Bài đo này
đo cái hàng rào đó — một `django.core.checks` chạy trước mọi management command, nên một
prod cấu hình sai không `migrate` được.

Bốn ca dưới đây là **toàn bộ** bảng chân trị của phép kiểm. Chỉ đo ca đỏ thì một bản cài
`return [Error(...)]` vô điều kiện cũng xanh, và nó sẽ chặn cả máy dev.
"""

import pytest
from django.test import override_settings

from core.kiem_trien_khai import MA_HAN_MUC_IP, kiem_han_muc_ip


def _ma(**cau_hinh) -> list[str]:
    with override_settings(**cau_hinh):
        return [l.id for l in kiem_han_muc_ip(None)]


def test_prod_bat_han_muc_ma_khong_tin_proxy_thi_KEU():
    """Ca duy nhất phải đỏ — và nó là ca mặc định của một prod vừa dựng."""
    assert _ma(
        DEBUG=False, HAN_MUC_DANG_KY_MOI_IP_NGAY=5, TIN_X_FORWARDED_FOR=False
    ) == [MA_HAN_MUC_IP]


def test_prod_tin_proxy_thi_im():
    assert (
        _ma(DEBUG=False, HAN_MUC_DANG_KY_MOI_IP_NGAY=5, TIN_X_FORWARDED_FOR=True) == []
    )


def test_tat_han_muc_han_thi_im():
    """`0` là "không có hạn mức theo IP" — không có hạn mức thì không có gì để mà sai."""
    assert (
        _ma(DEBUG=False, HAN_MUC_DANG_KY_MOI_IP_NGAY=0, TIN_X_FORWARDED_FOR=False) == []
    )


def test_may_dev_thi_im():
    """`DEBUG=True` ⇒ không có proxy phía trước ⇒ `REMOTE_ADDR` là địa chỉ thật.

    Ở dev, bật `TIN_X_FORWARDED_FOR` mới là cái sai — bất kỳ ai cũng tự khai IP bằng một
    dòng header. Nên phép kiểm phải **im** ở đây, nếu không nó là thứ người ta tắt bằng
    `SILENCED_SYSTEM_CHECKS` ngay hôm đầu, và tắt một lần là tắt cả những cái đáng giữ.
    """
    assert (
        _ma(DEBUG=True, HAN_MUC_DANG_KY_MOI_IP_NGAY=5, TIN_X_FORWARDED_FOR=False) == []
    )


def test_phep_kiem_da_duoc_DANG_KY_that_su():
    """Một `@register()` trong module không ai import là hàng rào không tồn tại.

    Bốn bài trên gọi thẳng hàm nên chúng xanh kể cả khi `CoreConfig.ready()` quên import
    module — tức chúng đo logic mà không đo việc nó có chạy hay không. Bài này đóng chỗ đó.
    """
    from django.core.checks import registry

    assert kiem_han_muc_ip in registry.registry.get_checks(), (
        "`kiem_han_muc_ip` chưa nằm trong registry — `core/apps.py::ready()` chưa import "
        "`core.kiem_trien_khai`, nên phép kiểm không bao giờ chạy trên prod"
    )
