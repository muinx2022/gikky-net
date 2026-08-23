"""Phép kiểm cấu hình chạy được — biến vài dòng chú thích trong `.env.example` thành hàng rào.

`django.core.checks` chạy tự động trước **mọi** management command (`migrate`,
`runserver`, `collectstatic`, `check`), nên một `Error` ở đây làm lượt deploy **dừng lại
và nói ra**, thay vì để hệ thống chạy tiếp với một cấu hình sai theo kiểu im lặng.

Chỉ đặt ở đây những thứ **không suy ra được từ code** và **hỏng im lặng trên prod**. Phép
kiểm cấu hình cho vui là thứ người ta tắt bằng `SILENCED_SYSTEM_CHECKS` ở lần vướng thứ
hai, và tắt một lần là tắt cả những cái đáng giữ.
"""

from django.conf import settings
from django.core.checks import Error, register

#: Mã của phép kiểm. Đi vào `SILENCED_SYSTEM_CHECKS` nếu ai đó thật sự cần tắt —
#: cố ý mang tiền tố `gikky.` để không đụng mã của Django.
MA_HAN_MUC_IP = "gikky.E001"


@register()
def kiem_han_muc_ip(app_configs, **kwargs):
    """L39 — hạn mức theo IP là NO-OP hoặc chặn cả thế giới nếu prod quên một biến.

    `HAN_MUC_DANG_KY_MOI_IP_NGAY` chỉ có nghĩa khi `TIN_X_FORWARDED_FOR=True`: sau Caddy,
    `REMOTE_ADDR` của **mọi** request là `127.0.0.1`, nên để `False` thì cả thế giới dùng
    chung một khoá đếm và người thứ sáu trong ngày bị chặn oan. Mặc định `False` là đúng
    cho dev và **sai cho prod**.

    `api/.env.example` đã nói ra điều này bằng chữ, và chữ đọc một lần rồi quên. Đây là
    cùng một câu, nhưng ở dạng làm `manage.py migrate` **thất bại** trên một prod cấu hình
    sai — tức nó được đọc đúng lúc nó có ích.

    **Chỉ áp khi `DEBUG=False`**, và đó không phải sự nhân nhượng: máy dev không có proxy
    phía trước, nên ở đó `REMOTE_ADDR` là địa chỉ thật và bật `TIN_X_FORWARDED_FOR` lại là
    cái sai ngược lại — bất kỳ ai cũng tự khai IP của mình bằng một dòng header.

    Tắt hạn mức hẳn (`HAN_MUC_DANG_KY_MOI_IP_NGAY = 0`) là một lựa chọn hợp lệ và không bị
    kêu: khi ấy không có hạn mức nào để mà sai.
    """
    if settings.DEBUG:
        return []
    if settings.HAN_MUC_DANG_KY_MOI_IP_NGAY <= 0:
        return []
    if settings.TIN_X_FORWARDED_FOR:
        return []
    return [
        Error(
            "HAN_MUC_DANG_KY_MOI_IP_NGAY đang bật nhưng TIN_X_FORWARDED_FOR=False, "
            "trong khi DEBUG=False (tức đang chạy sau proxy).",
            hint=(
                "Sau Caddy, REMOTE_ADDR của MỌI request là 127.0.0.1, nên hạn mức theo IP "
                "sẽ gộp cả thế giới vào một khoá đếm: người thứ "
                f"{settings.HAN_MUC_DANG_KY_MOI_IP_NGAY + 1} đăng ký trong ngày bị chặn "
                "oan, và không có gì kêu.\n"
                "Chọn MỘT trong hai:\n"
                "  · đặt TIN_X_FORWARDED_FOR=True trong api/.env — đúng khi và CHỈ KHI có "
                "proxy tin cậy phía trước (Caddy) tự nối peer vào X-Forwarded-For;\n"
                "  · đặt HAN_MUC_DANG_KY_MOI_IP_NGAY=0 để tắt hẳn hạn mức theo IP."
            ),
            id=MA_HAN_MUC_IP,
        )
    ]
