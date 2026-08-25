"""Adapter allauth của gikky — chỗ DUY NHẤT can thiệp vào luồng tài khoản.

Hôm nay nó làm đúng hai việc, và cả hai thuộc về hạn mức đăng ký của PLAN mục 10
(Phase 6): **từ chối lượt đăng ký thứ 6 từ cùng một IP trong một ngày lịch VN**, và **ghi
lại IP của lượt đăng ký** để phép đếm ấy có nguồn.

## Vì sao ở adapter chứ không ở `ACCOUNT_RATE_LIMITS`

allauth có sẵn `ACCOUNT_RATE_LIMITS = {"signup": "5/d/ip"}`, ngắn hơn hẳn file này. Hai lý
do không dùng:

1. **Cửa sổ của nó là 24 giờ TRƯỢT, không phải ngày lịch VN.** PLAN mục 1 chốt mọi chữ
   "ngày" của sản phẩm theo `Asia/Ho_Chi_Minh`, và `deploy/Caddyfile` nói thẳng rằng
   "hạn mức theo ngày lịch VN là việc của Django" — chính vì tầng Caddy **không** làm
   được chuyện đó. Nếu Django cũng dùng cửa sổ trượt thì không tầng nào cài luật đã chốt.
2. **Nó đếm trong `django.core.cache`**, mà mặc định là `LocMemCache`: mất khi tiến trình
   khởi động lại và riêng cho từng worker. Trên prod 4 worker, "5/ngày" là 20/ngày và
   không có gì nói ra.

## Cái adapter này CỐ Ý không làm

**Không chặn đăng nhập của tài khoản bị ban.** PLAN 5.10 đòi ("hiện lý do khi bị chặn
đăng nhập") và hôm nay gikky **chưa** làm — `dang_bi_ban()` chỉ được hỏi ở cửa GHI
(`api/quyen.py`) và cửa quản trị (`api/quan_tri.py`). Nợ có tên
`BAN-CHUA-CHAN-DANG-NHAP` trong `LOI-VA-NO.md`. Ghi ở đây vì đây là chỗ người đi trả nợ
ấy sẽ mở ra đầu tiên: hook đúng là `pre_login`, và cái khó không phải là chặn mà là trả
được **lý do** qua bề mặt headless (allauth chỉ có sẵn một response "tài khoản không hoạt
động", không mang chữ nào của mình).
"""

from allauth.account.adapter import DefaultAccountAdapter
from allauth.socialaccount.adapter import DefaultSocialAccountAdapter

from core.han_muc import dem_dang_ky_trong_ngay_vn, dia_chi_ip, tran_dang_ky_moi_ngay


class AdapterTaiKhoan(DefaultAccountAdapter):
    """Khai ở `settings.ACCOUNT_ADAPTER`."""

    def is_open_for_signup(self, request) -> bool:
        """Từ chối khi IP này đã đăng ký đủ hạn mức trong ngày lịch VN.

        allauth gọi hook này **trước khi** dựng hàng `User`, ở cả luồng headless lẫn luồng
        HTML, nên không có đường vòng nào tạo được tài khoản mà không đi qua đây.

        Trả `False` chứ không ném: đó là hợp đồng của hook, và allauth tự dựng lời từ chối
        đúng hình dạng của luồng đang chạy (headless ⇒ JSON 403). Câu từ chối vì thế
        **không** nói ra "bạn đã đăng ký N lần hôm nay" — cố ý: đó là thông tin về IP,
        không phải về người đang đứng trước màn hình, và một IP dùng chung (NAT của một
        công ty) thì câu ấy vừa vô nghĩa vừa tiết lộ.
        """
        if not super().is_open_for_signup(request):
            return False
        ip = dia_chi_ip(request)
        return dem_dang_ky_trong_ngay_vn(ip) < tran_dang_ky_moi_ngay()

    def save_user(self, request, user, form, commit=True):
        """Đóng dấu `dang_ky_ip` lên hàng vừa dựng — nguồn của phép đếm ở trên.

        Gán **trước** khi `super()` lưu, không phải bằng một `UPDATE` sau đó: allauth lưu
        user rồi phát signal và gửi mail xác thực ngay trong cùng lời gọi, nên một lượt ghi
        bù ở phía sau là một cửa sổ (dù hẹp) mà hàng đã tồn tại nhưng chưa có khoá đếm.
        """
        user.dang_ky_ip = dia_chi_ip(request) or None
        return super().save_user(request, user, form, commit=commit)


class AdapterMangXaHoi(DefaultSocialAccountAdapter):
    """Khai ở `settings.SOCIALACCOUNT_ADAPTER`. Một việc: **Google thắng mật khẩu**.

    User chốt 2026-08-24: *"khi login gg và login qua email, nếu trùng email, cần phải ưu
    tiên gg, xoá pass luôn, cần thì update lại"*.

    ## allauth đã làm MỘT NỬA việc này, và nửa còn lại mới là nửa hay gặp

    `socialaccount/internal/flows/email_authentication.py::wipe_password` xoá mật khẩu khi
    một lượt đăng nhập Google khớp email với tài khoản có sẵn — **nhưng chỉ khi email của
    tài khoản ấy CHƯA xác thực**:

        if address and address.verified:
            return   # "Verified email address, no reason to worry."

    Nó đóng đúng ca tấn công: kẻ lạ đăng ký bằng email của người khác, biết mật khẩu, rồi
    chờ chủ thật đăng nhập bằng Google — lúc đó cả hai cùng vào được.

    Nhưng gikky đặt `ACCOUNT_EMAIL_VERIFICATION = "mandatory"`, nên **gần như mọi** tài
    khoản nội bộ đều đã xác thực ⇒ nhánh trên `return` ⇒ mật khẩu **được giữ lại**. Tức
    hành vi mặc định của allauth, ở đúng cấu hình của gikky, gần như không bao giờ chạy.

    Lớp này bỏ điều kiện ấy: **khớp email là xoá**, xác thực hay chưa. Lý lẽ khác với lý lẽ
    của allauth — không phải chống kẻ đăng ký trước, mà là **không để một tài khoản có hai
    cửa vào**. Còn mật khẩu nghĩa là còn một cửa mà Google không canh, và một mật khẩu bị
    lộ ở nơi khác vẫn mở được cửa ấy.

    ## Không phải khoá ngoài

    Xoá mật khẩu **không** làm ai mất tài khoản: vào bằng Google, hoặc đặt lại mật khẩu qua
    `/quen-mat-khau` (đường ấy chỉ cần hòm thư, đúng thứ vừa được Google chứng minh là của
    họ). Đó là vế *"cần thì update lại"* của đơn hàng.

    ⚠ **Hệ quả cho giao diện, chưa xử ở lượt này:** tài khoản sau khi bị xoá mật khẩu có
    `has_usable_password() == False`, nên trang `/doi-mat-khau` (đòi mật khẩu **hiện tại**)
    không dùng được cho họ — đường đúng là `/quen-mat-khau`. Muốn UI nói ra điều đó thì
    `GET /api/v1/me` phải trả thêm một cờ `co_mat_khau`. Ghi ở đây để người mở file này
    thấy, thay vì để nó thành một bug báo về sau.
    """

    def pre_social_login(self, request, sociallogin):
        """Xoá mật khẩu khi lượt đăng nhập Google rơi vào một tài khoản ĐÃ CÓ.

        Gọi ở `socialaccount/internal/flows/login.py`, **sau** `sociallogin.lookup()` nên
        `sociallogin.user` đã được giải xong — có `pk` nghĩa là khớp vào hàng có sẵn; đăng
        ký mới thì `user` chưa lưu và `pk` là `None` (và cũng chưa có mật khẩu nào để xoá,
        nên nhánh dưới là no-op).
        """
        super().pre_social_login(request, sociallogin)

        user = getattr(sociallogin, "user", None)
        if user is None or user.pk is None:
            return
        if not user.has_usable_password():
            return
        user.set_unusable_password()
        user.save(update_fields=["password"])
