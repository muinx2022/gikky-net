"""Hạn phiên đăng nhập — cài TAY, vì allauth headless không cài hộ.

## ⚠ `ACCOUNT_SESSION_REMEMBER` là cấu hình CHẾT trong gikky — đừng thay bản này bằng nó

Đó là setting đầu tiên ai cũng với tay lấy: tên nó đúng y nhu cầu, tài liệu allauth nói
đúng cái mình muốn, và nó **không làm gì cả** ở đây. Đã kiểm:

    grep -rn "set_expiry|SESSION_REMEMBER|session_remember" allauth/headless/   ⇒ RỖNG

`ACCOUNT_SESSION_REMEMBER` chỉ được đọc ở `allauth/account/forms.py` — luồng **có giao diện
HTML**, thứ gikky cố ý không mount (`HEADLESS_ONLY = True`). Nên đặt nó vào `settings.py`
là thêm một dòng trông như đang điều khiển hạn phiên, trong khi hạn phiên do file này
quyết. Và **không có gì báo**: không lỗi, không warning, không test đỏ — chỉ có ô tích trên
giao diện bấm được mà không bao giờ đổi được gì.

Nếu người sau muốn dọn file này đi cho "gọn", đây là lý do đừng dọn.

## Vì sao SIGNAL chứ không middleware

`django.contrib.auth.login` gọi `cycle_key()` **rồi mới** bắn `user_logged_in`. Tới lúc
receiver chạy thì khoá phiên đã xoay xong, nên `set_expiry` bám đúng phiên mới — phiên thật
sự sẽ được gửi về trình duyệt. Middleware chạy trước hoặc sau cả request, không có chỗ nào
đứng đúng khe giữa hai việc đó.

Hệ quả thứ hai, và nó là thứ bài đo **G4** canh: signal chỉ bắn khi đăng nhập **thành
công**. Một bản cài đặt hạn phiên sớm hơn (middleware, hoặc đọc header ngay đầu view) sẽ
động vào phiên của cả những lượt gõ sai mật khẩu.

## Vì sao gọi `set_expiry` cho CẢ hai nhánh, không chỉ nhánh tắt

Nhánh "ghi nhớ" trông như không cần làm gì — mặc định Django đã là phiên bền. Nhưng
`cycle_key()` **giữ nguyên dữ liệu phiên**, mà `_session_expiry` nằm trong dữ liệu ấy. Nên
kịch bản này có thật: người dùng bỏ tích rồi đăng nhập (phiên hết khi đóng trình duyệt),
sau đó trong cùng trình duyệt đăng nhập lại bằng **chính tài khoản đó** và có tích. Không
ghi đè thì hạn cũ sống tiếp, ô tích lại thành thứ bấm được mà không đổi được gì — đúng
kiểu hỏng mà cả file này sinh ra để tránh.

## Mặc định khi KHÔNG có header: phiên BỀN — giữ nguyên hành vi cũ

Có chủ đích, không phải lười. **Site công khai cũng đăng nhập qua đúng endpoint allauth
ấy**, và nó không gửi header này. Nếu mặc định là "hết khi đóng trình duyệt" thì toàn bộ
người dùng site công khai bị đăng xuất mỗi lần đóng trình duyệt — một thay đổi hành vi
diện rộng mà **không ai yêu cầu**, nằm ngoài phạm vi user chốt ("làm cho phần admin").

Cùng lý do đó, giá trị rác (`X-Ghi-Nho: abc`) rơi về phiên bền chứ không ném: chỉ đúng
chuỗi `"0"` mới tắt. Header này là một **công tắc opt-out**, nên mọi thứ không phải lời
từ chối rành mạch đều được hiểu là đồng ý — an toàn theo hướng "không đăng xuất người ta
ngoài ý muốn".
"""

from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver

#: `X-Ghi-Nho` sau khi Django chuẩn hoá tên header vào `request.META`.
#: Bản đối xứng ở frontend: `apps/admin/app/dang-nhap/page.tsx::HEADER_GHI_NHO`.
#: Hai hằng này có chuông: `apps/web/e2e/don-vi/ban-sao-python.spec.ts`.
HEADER_GHI_NHO = "HTTP_X_GHI_NHO"

#: Giá trị DUY NHẤT tắt "ghi nhớ". Xem docstring: đây là công tắc opt-out.
TAT = "0"

#: Nơi cất tín hiệu để nó sống qua các **login stage** — xem `stash_ghi_nho`.
KHOA_PHIEN = "_gikky_ghi_nho"


def stash_ghi_nho(request) -> None:
    """Cất tín hiệu vào phiên. Gọi từ `AdapterTaiKhoan.pre_login`.

    ## ⚠ Vì sao không đọc thẳng header trong receiver là ĐỦ — bẫy "login stage"

    `allauth/account/internal/flows/login.py::resume_login`:

        ctrl = LoginStageController(request, login)
        response = ctrl.handle()
        if response:
            return response          # ← THOÁT khi còn stage chưa xong
        adapter.login(request, user)  # ← `django_login` + `user_logged_in` chỉ nằm SAU

    Nghĩa là khi lượt đăng nhập phải đi qua một stage, **request mang header không phải
    request bắn signal**. `EmailVerificationStage` nằm sẵn trong
    `DefaultAccountAdapter.get_login_stages()`, và gikky đặt
    `ACCOUNT_EMAIL_VERIFICATION = "mandatory"` ⇒ stage ấy đang bật thật.

    Ca hỏng: người có email chưa xác thực **bỏ tích** "ghi nhớ" ⇒ `POST /auth/login` mang
    `X-Ghi-Nho: 0` nhưng thoát sớm ở stage ⇒ receiver không chạy. Họ bấm link trong mail
    ⇒ `resume_login` chạy lại ở **request khác**, không có header ⇒ rơi về mặc định
    "phiên bền". Người dùng đã chọn "đóng trình duyệt là hết phiên" mà nhận về 2 tuần.
    Không log, không lỗi, không test đỏ.

    Và nó sẽ tệ hơn: cơ chế stage áp cho **mọi** stage. Ngày nào bật `allauth.mfa` cho mod
    thì **mọi** lượt đăng nhập hoàn tất ở request `/auth/2fa/authenticate` ⇒ ô tích không
    bao giờ còn tác dụng, cho 100% mod, vẫn không có gì báo.

    ⇒ Cất vào `request.session` ở `pre_login` — hàm chạy trên **request mang header**, và
    chạy TRƯỚC `resume_login` (xem `perform_login` cùng file allauth). Phiên sống xuyên
    suốt các stage (allauth không `flush()` giữa chừng) và `cycle_key()` giữ nguyên dữ
    liệu, nên tín hiệu tới được đúng lúc `set_expiry` cần nó.

    Lượt phản biện 2026-08-26 tìm ra. Bản đầu chỉ đọc `request.META` trong receiver.
    """
    if request is None:
        return
    gia_tri = request.META.get(HEADER_GHI_NHO)
    if gia_tri is not None:
        request.session[KHOA_PHIEN] = gia_tri


@receiver(user_logged_in)
def dat_han_phien(sender, request, user, **kwargs):
    """Đặt hạn phiên theo header `X-Ghi-Nho` do client gửi kèm lượt đăng nhập."""
    # `request` có thể là `None`: `user_logged_in` cũng bắn từ những đường không có
    # request (management command, test gọi thẳng `login()`). Không có request thì không
    # có header lẫn phiên để đặt — và cũng không có gì cần đổi.
    if request is None:
        return

    # Header của CHÍNH request này thắng; không có thì lấy bản đã cất (đường đi qua login
    # stage). `pop` để tín hiệu không sống sót sang một lượt đăng nhập sau — lượt sau có
    # thể là Google, không gửi header, và phải rơi về mặc định chứ không thừa hưởng lựa
    # chọn của lượt trước.
    tin_hieu = request.META.get(HEADER_GHI_NHO)
    da_cat = request.session.pop(KHOA_PHIEN, None)
    if tin_hieu is None:
        tin_hieu = da_cat

    ghi_nho = tin_hieu != TAT
    # ⚠ **`None`, KHÔNG phải `settings.SESSION_COOKIE_AGE`.**
    #
    # `SessionBase.set_expiry` ghi giá trị vào **dữ liệu phiên** (`_session_expiry`), và
    # `get_expiry_age` trả thẳng số nguyên đã ghi. Đóng băng `SESSION_COOKIE_AGE` vào từng
    # phiên nghĩa là: ops rút hạn từ 14 ngày xuống 1 ngày sau một sự cố bảo mật, restart —
    # và **mọi phiên tạo trước lúc rút vẫn sống 14 ngày**, vì con số cũ nằm trong dữ liệu
    # của chúng. Việc rút hạn không có tác dụng, và không có gì báo.
    #
    # `None` thì `set_expiry` **xoá** khoá ấy ("the session uses the global session expiry
    # policy" — docstring Django), nên nó vẫn ghi đè được `_session_expiry = 0` còn sót từ
    # lượt bỏ tích trước đó (lý do ở docstring module) mà không đóng băng gì.
    #
    # Lượt phản biện 2026-08-26 tìm ra. Bộ đo cũ không phân biệt được hai cách — đó là
    # điểm mù mà `test_ghi_nho_KHONG_dong_bang_han_vao_du_lieu_phien` sinh ra để bịt.
    request.session.set_expiry(None if ghi_nho else 0)
