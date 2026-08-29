"""Ghi nhớ đăng nhập — header `X-Ghi-Nho` điều khiển hạn phiên.

Đo `api/core/phien.py::dat_han_phien`. Xem docstring file ấy để biết vì sao
`ACCOUNT_SESSION_REMEMBER` **không** dùng được và vì sao đường truyền là header chứ không
phải một khoá trong body.

## ⚠ Đọc trước khi thêm/sửa bài ở đây: G1 và G3 KHÔNG phân biệt được receiver có chạy không

Cả hai cùng kỳ vọng `get_expire_at_browser_close() is False` — mà **đó cũng là mặc định
của Django khi không ai gọi `set_expiry`**. Nên gỡ hẳn receiver đi thì G1 và G3 vẫn xanh
cả hai. Chúng có giá trị của chúng (G3 canh cho site công khai không bị đổi hành vi), chỉ
là chúng không chứng minh được là code đang chạy.

**G2 là bài duy nhất phân biệt được**, nên nó đứng đầu file và mọi lượt thử phá phải bắt
đầu từ nó. Một bản vá làm G2 đỏ mà G1/G3 vẫn xanh là bản vá đã hỏng thật; ngược lại, một
lượt sửa mà chỉ G1/G3 được chạy thì chưa đo gì cả.

## Hai bài thêm ở lượt phản biện 2026-08-26 — cả hai bịt đúng vùng mù trên

Vùng mù ấy **đang che một lỗi thật**, và lượt phản biện tìm ra hai:

- `test_ghi_nho_KHONG_dong_bang_han_vao_du_lieu_phien` — nhánh "bật" trước đây gọi
  `set_expiry(SESSION_COOKIE_AGE)`, đóng băng con số vào từng phiên. G1/G3 không phân biệt
  được nó với `set_expiry(None)`.
- `test_ghi_nho_song_qua_login_stage` — lượt đăng nhập phải qua một login stage hoàn tất ở
  **request khác**, không mang header. Không bài nào cũ đi qua đường đó.
"""

import json

import pytest
from allauth.account.models import EmailAddress
from django.conf import settings

from core.models import User
from core.phien import HEADER_GHI_NHO, KHOA_PHIEN

pytestmark = pytest.mark.django_db

DUONG = "/api/_allauth/browser/v1/auth/login"
EMAIL = "ghi-nho@vi-du.gikky.net"
MK = "mat-khau-du-manh-2026"


@pytest.fixture
def nguoi(db):
    u = User.objects.create(username="nguoi_ghi_nho", display_name="Người Ghi Nhớ", email=EMAIL)
    u.set_password(MK)
    u.save()
    EmailAddress.objects.create(user=u, email=EMAIL, verified=True, primary=True)
    return u


def dang_nhap(client, mat_khau=MK, ghi_nho=None):
    """`ghi_nho=None` = KHÔNG gửi header (đúng cái site công khai làm)."""
    headers = {} if ghi_nho is None else {"x-ghi-nho": ghi_nho}
    return client.post(
        DUONG,
        data=json.dumps({"email": EMAIL, "password": mat_khau}),
        content_type="application/json",
        headers=headers,
    )


def test_G2_bo_tich_thi_phien_het_khi_dong_trinh_duyet(client, nguoi):
    """**Bài quan trọng nhất của file** — xem docstring đầu file.

    Đây là bài duy nhất đỏ khi receiver không chạy, nên nó là bài canh cho cả bốn bài kia.
    """
    r = dang_nhap(client, ghi_nho="0")
    assert r.status_code == 200, r.content
    assert client.session.get_expire_at_browser_close() is True


def test_G1_co_tich_thi_phien_ben(client, nguoi):
    r = dang_nhap(client, ghi_nho="1")
    assert r.status_code == 200, r.content
    assert client.session.get_expire_at_browser_close() is False
    # Khoảng, không phải điểm — cố ý, để bài này không phụ thuộc việc hạn được đặt bằng
    # `set_expiry(None)` (rơi về chính sách toàn cục) hay bằng một mốc tuyệt đối. Cả hai
    # đều là "phiên bền", và đó là điều duy nhất G1 khẳng định.
    #
    # ⚠ Chú thích cũ ở đây nói "giữa lúc `set_expiry` chạy và lúc đọc lại có vài mili giây
    # thật" — **SAI**, và cái sai ấy dạy đúng hiểu nhầm dẫn tới lỗi đóng băng: nó ngụ ý
    # phiên lưu một mốc thời gian tuyệt đối. Với `set_expiry(<số nguyên>)` thì
    # `get_expiry_age()` trả **thẳng số nguyên đã lưu**, không mili giây nào trôi. Lượt
    # phản biện 2026-08-26 bắt được.
    tuoi = client.session.get_expiry_age()
    assert settings.SESSION_COOKIE_AGE - 60 <= tuoi <= settings.SESSION_COOKIE_AGE


def test_G3_khong_gui_header_thi_giu_nguyen_hanh_vi_cu(client, nguoi):
    """Bài canh cho **site công khai**, thứ duy nhất canh nó.

    `apps/web` đăng nhập qua đúng endpoint này và KHÔNG gửi `X-Ghi-Nho`. Nếu ai đó đổi mặc
    định thành "hết khi đóng trình duyệt", mọi người dùng site công khai bị đăng xuất mỗi
    lần đóng trình duyệt — một thay đổi diện rộng không ai yêu cầu, và không có bài đo nào
    khác nhìn thấy nó.
    """
    r = dang_nhap(client)
    assert r.status_code == 200, r.content
    assert client.session.get_expire_at_browser_close() is False


def test_G4_dang_nhap_that_bai_thi_khong_dung_toi_phien_nao(client, nguoi):
    """Chống một bản cài đặt hạn phiên TRƯỚC khi biết đăng nhập có thành công không.

    Đọc header trong middleware, hoặc ngay đầu view, thì lượt gõ sai mật khẩu này cũng bị
    `set_expiry(0)` — và bài đo nào chỉ nhìn lượt đăng nhập thành công đều không thấy.
    """
    r = dang_nhap(client, mat_khau="sai-be-bet", ghi_nho="0")
    assert r.status_code == 400, r.content
    assert "_auth_user_id" not in client.session
    assert client.session.get_expire_at_browser_close() is False


def test_G5_gia_tri_rac_roi_ve_mac_dinh_khong_nem(client, nguoi):
    """`X-Ghi-Nho` là công tắc **opt-out**: chỉ đúng chuỗi `"0"` mới tắt.

    Header đi qua proxy, qua Caddy, qua đủ thứ có thể viết hoa/viết thường/cắt xén. Một
    bản cài `bool(gia_tri)` hay `int(gia_tri)` sẽ ném hoặc đảo nghĩa ở đây; ném ở receiver
    của `user_logged_in` là **500 sau khi đã đăng nhập xong** — người dùng thấy trang lỗi
    trong khi phiên đã được tạo.
    """
    r = dang_nhap(client, ghi_nho="abc")
    assert r.status_code == 200, r.content
    assert client.session.get_expire_at_browser_close() is False


def test_receiver_da_duoc_dang_ky(client):
    """Tiền đề của cả file, đo ở tầng đăng ký.

    Không có dòng này thì gỡ `from core import phien` khỏi `AppConfig.ready()` chỉ làm G2
    đỏ với thông điệp "False != True" — đúng nhưng không nói ra nguyên nhân. Dòng này nói
    hộ, và nó cũng là thứ bắt được ca `ready()` bị dọn đi trong một lượt refactor.
    """
    import sys

    # ⚠ Dòng này phải đứng TRƯỚC mọi `import core.phien`, và đó là cả giá trị của bài đo.
    # `import core.phien` tự chạy `@receiver(...)` ở cấp module, tức chính hành động đo
    # sẽ đăng ký receiver và bài đo xanh bất kể `ready()` có nạp hay không. Bản đầu của
    # bài này mắc đúng lỗi đó: gỡ `from core import phien` khỏi `ready()` mà nó vẫn xanh.
    assert "core.phien" in sys.modules, "`CoreConfig.ready()` không nạp `core.phien`"

    from django.contrib.auth.signals import user_logged_in

    from core.phien import dat_han_phien

    # Đọc `lookup_key` (phần tử ĐẦU của mỗi mục) chứ không đọc chính receiver: Django lưu
    # receiver dưới dạng weakref, và số phần tử của mỗi mục đã đổi giữa các bản Django.
    # `lookup_key` thì luôn là `(id(receiver), id(sender))` và luôn đứng đầu.
    khoa = [muc[0] for muc in user_logged_in.receivers]
    assert any(k[0] == id(dat_han_phien) for k in khoa), khoa


# --- Hai bài của lượt phản biện 2026-08-26 ------------------------------------------
#
# Cả hai bịt vùng mù mà docstring đầu file mô tả — và vùng mù ấy đang che lỗi thật.


def test_ghi_nho_KHONG_dong_bang_han_vao_du_lieu_phien(client, nguoi):
    """Nhánh "bật" phải **xoá** `_session_expiry`, không phải ghi số vào đó.

    `SessionBase.set_expiry` ghi thẳng giá trị vào dữ liệu phiên, và `get_expiry_age` trả
    lại đúng số nguyên ấy. Nên `set_expiry(SESSION_COOKIE_AGE)` **đóng băng** hạn hiện
    hành vào từng phiên: ops rút `SESSION_COOKIE_AGE` từ 14 ngày xuống 1 ngày sau một sự
    cố bảo mật, restart — và mọi phiên tạo trước lúc rút **vẫn sống 14 ngày**. Việc rút
    hạn không có tác dụng, không log, không cảnh báo.

    `set_expiry(None)` xoá khoá ⇒ phiên theo chính sách toàn cục, đọc **lúc chạy**.

    ⚠ G1 và G3 **không** phân biệt được hai cách ấy (cả hai vẫn xanh với bản đóng băng).
    Bài này là bài duy nhất, nên đừng gộp nó vào G1.
    """
    r = dang_nhap(client, ghi_nho="1")
    assert r.status_code == 200, r.content
    assert "_session_expiry" not in client.session, (
        "hạn phiên bị ĐÓNG BĂNG vào dữ liệu phiên — đổi `SESSION_COOKIE_AGE` sau này sẽ "
        "không có tác dụng lên phiên này. Dùng `set_expiry(None)`."
    )


# --- Đường đi qua LOGIN STAGE -------------------------------------------------------
#
# ## Ca cụ thể mà lượt phản biện mô tả KHÔNG xảy ra hôm nay — nhưng cơ chế thì có thật
#
# Phản biện chỉ ra: `resume_login` thoát TRƯỚC `adapter.login()` khi còn stage chưa xong,
# nên request mang header không phải request bắn `user_logged_in`. Đúng. Ca họ dựng là
# "email chưa xác thực ⇒ bấm link trong mail ⇒ đăng nhập hoàn tất ở request khác".
#
# **Đo thật thì ca ấy không hoàn tất được lượt đăng nhập** (`allauth/account/stages.py`):
#
#     class EmailVerificationStage(LoginStage):
#         def is_resumable(self, request):
#             return app_settings.EMAIL_VERIFICATION_BY_CODE_ENABLED
#
# gikky dùng xác thực bằng **link**, không bằng mã ⇒ `EMAIL_VERIFICATION_BY_CODE_ENABLED`
# tắt ⇒ stage **không resume được**. Đã chạy thử: bấm link làm `verified=True` nhưng
# response là `401 {flows: [login, signup]}` — người dùng phải đăng nhập lại từ form, và
# lượt ấy MANG header. Không có lỗi nào lộ ra ở đường này hôm nay.
#
# ## Vì sao vẫn cất tín hiệu vào phiên
#
# Vì `is_resumable` là chuyện của TỪNG stage, không phải của cơ chế. `LoginByCodeStage`,
# `PhoneVerificationStage` và `allauth.mfa.stages.AuthenticateStage` đều resume được —
# ngày nào bật 2FA cho mod thì **mọi** lượt đăng nhập hoàn tất ở request
# `/auth/2fa/authenticate`, và ô tích im lặng ngừng tác dụng cho 100% mod.
#
# Hai bài dưới đo **cơ chế**, không giả vờ đo một ca chưa tồn tại: bài đầu chứng minh tín
# hiệu được CẤT trên đúng request mang header (đi qua HTTP thật, có stage chặn thật); bài
# sau chứng minh receiver ĐỌC bản đã cất khi request không có header.


def test_tin_hieu_ghi_nho_duoc_CAT_khi_luot_dang_nhap_vuong_stage(client, db):
    """Nửa thứ nhất: `pre_login` chạy và cất, kể cả khi lượt đăng nhập bị stage chặn."""
    email = "chua-xac-thuc@vi-du.gikky.net"
    u = User.objects.create(username="chua_xac_thuc", display_name="Chưa", email=email)
    u.set_password(MK)
    u.save()
    EmailAddress.objects.create(user=u, email=email, verified=False, primary=True)

    r = client.post(
        DUONG,
        data=json.dumps({"email": email, "password": MK}),
        content_type="application/json",
        headers={"x-ghi-nho": "0"},
    )

    # Tiền đề: stage THẬT SỰ chặn. Không có phép chấm này thì ngày nào ai đó đổi
    # `ACCOUNT_EMAIL_VERIFICATION`, bài đo lặng lẽ thành một bản sao của G2.
    assert r.status_code == 401, r.content
    assert "_auth_user_id" not in client.session
    assert "account_login" in client.session, "allauth không giữ lượt đăng nhập đang dở"

    assert client.session.get(KHOA_PHIEN) == "0", (
        "tín hiệu KHÔNG được cất — mọi stage resume được (2FA, login-by-code) sẽ vứt "
        "lựa chọn của người dùng, im lặng"
    )


def test_receiver_doc_ban_da_cat_khi_request_khong_co_header(rf, nguoi):
    """Nửa thứ hai: request hoàn tất lượt đăng nhập không có header ⇒ đọc bản đã cất.

    Dựng thẳng một request "trần" (không header) rồi gọi `django.contrib.auth.login` —
    đúng cái `adapter.login()` làm ở request thứ hai của một stage resume được.
    """
    from django.contrib.auth import login as django_login
    from django.contrib.sessions.middleware import SessionMiddleware

    req = rf.post("/khong-quan-trong")
    SessionMiddleware(lambda r: None).process_request(req)
    req.session[KHOA_PHIEN] = "0"

    assert HEADER_GHI_NHO not in req.META, "request này phải KHÔNG có header"
    django_login(req, nguoi, backend="django.contrib.auth.backends.ModelBackend")

    assert req.session.get_expire_at_browser_close() is True
    # Và tín hiệu bị tiêu thụ: lượt đăng nhập SAU (ví dụ Google, không gửi header) phải
    # rơi về mặc định chứ không thừa hưởng lựa chọn của lượt này.
    assert KHOA_PHIEN not in req.session, "tín hiệu còn sót — sẽ rò sang lượt sau"
