"""Tài khoản: allauth headless + `GET /me` — PLAN mục 7, 8.2, và chốt của plan mảng A.

Luồng thật, không rút gọn: **đăng ký → nhận mail → xác thực → đăng nhập → đăng xuất**.
Xác thực email là **bắt buộc** (chốt của plan mảng A), nên bài đo phải đi qua nó chứ không
được `EmailAddress.objects.update(verified=True)` cho nhanh — làm thế là đo một luồng
không ai chạy.

Dev không có SMTP: `EMAIL_BACKEND` là `filebased`, và e2e đọc file mail lấy link. Ở tầng
pytest thì Django tự thay bằng `locmem` (`django.test` làm việc đó), nên bài đo đọc
`django.core.mail.outbox` — cùng một nội dung mail, khác chỗ chứa.
"""

import json
from urllib.parse import unquote

import pytest
from allauth.account.models import EmailAddress
from django.conf import settings
from django.core import mail

from core.ghi import SO_ANH_TOI_DA_MOI_MOC
from core.models.nguoi_dung import User

BROWSER = "/api/_allauth/browser/v1"

MAT_KHAU = "mot-mat-khau-du-dai-2026"


def post(client, url, du_lieu, *, status=None):
    r = client.post(url, data=json.dumps(du_lieu), content_type="application/json")
    if status is not None:
        assert r.status_code == status, f"{url} → {r.status_code}: {r.content[:400]!r}"
    return r


def toi(client) -> dict:
    """`GET /api/v1/me` — đường mà header của cả hai app Next hỏi trên mọi trang."""
    r = client.get("/api/v1/me")
    assert r.status_code == 200, r.content[:300]
    return json.loads(r.content)


# --- luồng đầy đủ ------------------------------------------------------------


@pytest.mark.django_db
def test_dang_ky_xac_thuc_email_dang_nhap_dang_xuat(client):
    """Luồng M1 nguyên vẹn, đi qua đúng cửa allauth headless mà frontend sẽ gọi.

    Ba điều được ghim cùng lúc, và mỗi cái là một chỗ đã từng làm sai ở dự án khác:

    1. **`GET /me` trả 200 cho khách**, không 401 — header render trên mọi trang, và một
       endpoint trả lỗi cho trạng thái bình thường nhất của hệ thống sẽ dạy frontend coi
       lỗi là chuyện thường;
    2. **chưa xác thực email thì chưa vào được**: `POST /auth/login` trả 401 kèm `flows`
       của allauth chứ không phải 200. Xác thực bắt buộc mà đăng nhập vẫn lọt thì cái
       "bắt buộc" chỉ là một dòng cấu hình;
    3. **username là chữ người dùng chọn lúc đăng ký** (PLAN 5.9 — `/u/<username>` là danh
       tính công khai), không phải một chuỗi allauth tự sinh từ email.
    """
    assert toi(client)["dang_nhap"] is False

    post(
        client,
        f"{BROWSER}/auth/signup",
        {"email": "a@gikky.test", "username": "ba_muoi_phien", "password": MAT_KHAU},
    )
    u = User.objects.get(username="ba_muoi_phien")
    assert u.email == "a@gikky.test"
    assert not EmailAddress.objects.filter(user=u, verified=True).exists()

    # (2) chưa xác thực ⇒ chưa đăng nhập được.
    client.logout()
    r = post(
        client,
        f"{BROWSER}/auth/login",
        {"email": "a@gikky.test", "password": MAT_KHAU},
    )
    assert r.status_code == 401, r.content[:400]
    assert toi(client)["dang_nhap"] is False

    # Mail xác thực đã gửi; lấy khoá từ chính nội dung mail, đúng như e2e sẽ làm.
    assert len(mail.outbox) >= 1
    khoa = _khoa_xac_thuc(mail.outbox[-1].body)
    # 200 hay 401 đều là "khoá hợp lệ": nhóm `/auth/*` của allauth headless trả
    # `AuthenticationResponse`, và 401 chỉ nghĩa là phiên hiện tại **chưa** đăng nhập —
    # đúng như ở đây, vì ta vừa `logout()` để thử đăng nhập sớm. Bằng chứng thật là hàng
    # `EmailAddress` ở dòng dưới, không phải con số status.
    r = post(client, f"{BROWSER}/auth/email/verify", {"key": khoa})
    assert r.status_code in (200, 401), r.content[:400]
    assert EmailAddress.objects.filter(user=u, verified=True).exists()

    client.logout()
    post(
        client,
        f"{BROWSER}/auth/login",
        {"email": "a@gikky.test", "password": MAT_KHAU},
        status=200,
    )
    d = toi(client)
    assert d["dang_nhap"] is True
    assert d["username"] == "ba_muoi_phien"
    assert d["email"] == "a@gikky.test"
    assert d["email_da_xac_thuc"] is True
    assert d["la_staff"] is False

    r = client.delete(f"{BROWSER}/auth/session")
    assert r.status_code in (200, 401), r.content[:300]
    assert toi(client)["dang_nhap"] is False


def _khoa_trong_mail(than: str, doan: str) -> str:
    """Khoá nằm sau `<doan>/` trong link của mail — link trỏ về **frontend Next**.

    ⚠ **Phải `unquote`**: allauth ghép khoá vào URL nên nó đã được percent-encode
    (`MQ:1wxo…` → `MQ%3A1wxo…`). Gửi thẳng chuỗi đã mã hoá vào thân JSON là allauth không
    tra ra khoá nào và trả **400** — một mã trông y như "khoá sai/hết hạn", nên lỗi này
    rất dễ bị chẩn đoán nhầm thành "luồng xác thực hỏng". Frontend đọc khoá từ **path
    param** của Next nên nó được giải mã sẵn; bài đo phải tự làm bước đó.
    """
    for tu in than.split():
        if f"/{doan}/" in tu:
            return unquote(tu.rstrip(".,)").rsplit("/", 1)[-1])
    raise AssertionError(f"không thấy link /{doan}/ trong mail:\n{than}")


def _khoa_xac_thuc(than: str) -> str:
    return _khoa_trong_mail(than, "xac-thuc-email")


@pytest.mark.django_db
def test_link_trong_mail_tro_ve_FRONTEND_khong_ve_django(client):
    """Link xác thực phải trỏ về Next, vì `HEADLESS_ONLY = True` — Django **không có** view
    HTML nào cho nó.

    Trỏ nhầm về Django thì người dùng bấm link trong hộp thư và nhận 404 — hỏng ở đúng
    bước mà không ai test tay vì nó cần một hộp thư thật.
    """
    post(
        client,
        f"{BROWSER}/auth/signup",
        {"email": "b@gikky.test", "username": "nguoi_moi", "password": MAT_KHAU},
    )
    than = mail.outbox[-1].body
    assert f"{settings.FRONTEND_ORIGIN}/xac-thuc-email/" in than, than
    assert "/api/_allauth/" not in than
    # Và nó phải là URL TUYỆT ĐỐI theo `FRONTEND_ORIGIN`, không phải theo Host của request:
    # request tới Django ở dev đi qua `rewrites` của Next nên Host của nó là
    # `localhost:8000`. Một link tương đối vì thế ra đúng cổng của Django — 404 trong hộp
    # thư, ở đúng bước mà không ai test tay vì nó cần một hộp thư thật.
    assert "localhost:8000" not in than and "testserver" not in than


@pytest.mark.django_db
def test_quen_mat_khau_gui_mail_va_dat_lai_duoc(client):
    """Quên mật khẩu → mail → đặt lại → đăng nhập bằng mật khẩu MỚI.

    Vế cuối là vế hay thiếu: một bài đo dừng ở "API trả 200" không phân biệt được "đã đổi
    mật khẩu" với "đã nhận yêu cầu rồi bỏ đó".
    """
    u = User.objects.create_user(
        username="quen", email="c@gikky.test", password=MAT_KHAU
    )
    EmailAddress.objects.create(
        user=u, email=u.email, verified=True, primary=True
    )

    mail.outbox.clear()
    post(client, f"{BROWSER}/auth/password/request", {"email": "c@gikky.test"}, status=200)
    assert len(mail.outbox) == 1

    khoa = _khoa_dat_lai(mail.outbox[-1].body)
    moi = "mat-khau-hoan-toan-khac-2026"
    # ⚠ **401 ở đây là THÀNH CÔNG.** allauth headless trả `AuthenticationResponse` cho
    # nhóm `/auth/*`: 200 khi phiên đã đăng nhập, 401 kèm `flows` khi chưa. Đặt lại mật
    # khẩu xong mà chưa tự đăng nhập ⇒ 401. Đó là lý do bài đo không dừng ở status mà đi
    # tiếp tới phép thử THẬT ở dưới: đăng nhập bằng mật khẩu cũ phải trượt, bằng mật khẩu
    # mới phải lọt.
    r = post(client, f"{BROWSER}/auth/password/reset", {"key": khoa, "password": moi})
    assert r.status_code in (200, 401), r.content[:400]

    client.logout()
    post(client, f"{BROWSER}/auth/login", {"email": "c@gikky.test", "password": MAT_KHAU})
    assert toi(client)["dang_nhap"] is False
    post(
        client,
        f"{BROWSER}/auth/login",
        {"email": "c@gikky.test", "password": moi},
        status=200,
    )
    assert toi(client)["dang_nhap"] is True


def _khoa_dat_lai(than: str) -> str:
    return _khoa_trong_mail(than, "dat-lai-mat-khau")


@pytest.mark.django_db
def test_doi_mat_khau_khi_da_dang_nhap(client):
    """`POST /account/password/change` — đổi mật khẩu của chính mình."""
    u = User.objects.create_user(
        username="doi_mk", email="d@gikky.test", password=MAT_KHAU
    )
    EmailAddress.objects.create(user=u, email=u.email, verified=True, primary=True)
    client.force_login(u)

    moi = "mat-khau-moi-cua-toi-2026"
    post(
        client,
        f"{BROWSER}/account/password/change",
        {"current_password": MAT_KHAU, "new_password": moi},
        status=200,
    )
    u.refresh_from_db()
    assert u.check_password(moi)


# --- Google: nguồn là DB, env chỉ dự phòng ------------------------------------
#
# ⚠ **Ba khẳng định cũ ở đây đã SAI từ 2026-08-24** và được thay bằng ba cái dưới:
#
#   settings.GOOGLE_BAT is False          -> hằng ấy không còn tồn tại
#   provider not in INSTALLED_APPS        -> nay nạp LUÔN LUÔN
#   SOCIALACCOUNT_PROVIDERS == {}         -> nay luôn có khoá "google"
#
# Provider được nạp không có nghĩa Google bật: không nguồn credential nào thì `get_app`
# ném `DoesNotExist`. Chi tiết: `plans/2026-08-24-cai-dat-google-oauth.md` §0.
# Bảng "DB ưu tiên / env dự phòng" đo ở `test_cai_dat_google.py`.


@pytest.mark.django_db
def test_google_TAT_khi_khong_co_credential(db):
    """PLAN mục 4: **không nút vĩnh viễn không bấm được**.

    Máy dev không có credential ở env lẫn DB ⇒ `google_dang_bat()` `False` ⇒ `GET /me`
    bảo frontend **đừng render** nút, chứ không render một nút `disabled`.
    """
    from core.cau_hinh_oauth import google_dang_bat

    assert settings.GOOGLE_ENV_CO is False
    assert google_dang_bat() is False
    # Nạp provider mà vẫn tắt — đúng cái tách "có provider" khỏi "có credential".
    assert "allauth.socialaccount.providers.google" in settings.INSTALLED_APPS


@pytest.mark.django_db
def test_me_noi_ra_google_bat_hay_tat(client):
    from core.cau_hinh_oauth import google_dang_bat

    assert toi(client)["google_bat"] is google_dang_bat()


@pytest.mark.django_db
def test_me_noi_ra_tran_anh_moi_moc_cho_ca_KHACH(client, nguoi_a):
    """`tran_anh_moi_moc` — hằng cấu hình server cho ô chọn ảnh (Phase 5).

    Cùng vai `google_bat`: không phải trạng thái người dùng, mà là thứ UI cần biết trước
    khi vẽ. Ô chọn ảnh phải chặn tại chỗ khi đã đủ, chứ không để người ta chọn tấm thứ
    11 rồi chờ một request chỉ để ăn 409.

    **Khách cũng nhận đúng con số**, không phải `null`: `GET /me` là một hình dạng duy
    nhất cho cả hai trạng thái (xem `_khach()`), và một trường cấu hình biến mất với
    khách là một nhánh `undefined` mà mọi form phải nhớ xử.
    """
    assert toi(client)["tran_anh_moi_moc"] == SO_ANH_TOI_DA_MOI_MOC
    client.force_login(nguoi_a)
    assert toi(client)["tran_anh_moi_moc"] == SO_ANH_TOI_DA_MOI_MOC


# --- cấu hình CSRF / cookie (PLAN 8.2) ---------------------------------------


def test_csrf_trusted_origins_co_du_hai_cong_dev():
    """PLAN 8.2: "thiếu các dòng này thì POST từ admin (và từ dev) ăn 403 CSRF — đây là lỗi
    sẽ gặp NGAY Phase 2 nếu bỏ qua"."""
    assert "http://localhost:3000" in settings.CSRF_TRUSTED_ORIGINS
    assert "http://localhost:3001" in settings.CSRF_TRUSTED_ORIGINS


def test_cookie_csrf_doc_duoc_bang_JS_con_cookie_phien_thi_khong():
    """Hai cookie, hai luật ngược nhau — và đảo chúng là hai lỗi khác nhau.

    `csrftoken` **phải** đọc được bằng JS (frontend gắn vào header `X-CSRFToken`); bật
    `HttpOnly` cho nó là mọi POST của frontend ăn 403 và không ai hiểu vì sao.
    `sessionid` thì ngược lại: `HttpOnly` mặc định của Django là thứ giữ cho một lỗ XSS
    không thành một phiên bị đánh cắp — đừng đụng vào.
    """
    assert settings.CSRF_COOKIE_HTTPONLY is False
    assert settings.SESSION_COOKIE_HTTPONLY is True


def test_chi_co_client_browser():
    """`HEADLESS_CLIENTS` chỉ có `browser`: session cookie, **không token store**.

    Bật thêm `app` là mở một đường đăng nhập thứ hai bằng token mà không ai dùng và không
    ai kiểm — và nó nằm dưới cùng prefix `/api/`, tức đi qua đúng những lớp proxy mà
    PLAN 8.2 dựng riêng cho cookie.
    """
    assert tuple(settings.HEADLESS_CLIENTS) == ("browser",)


@pytest.mark.django_db
def test_khong_mount_view_HTML_cua_allauth(client):
    """`HEADLESS_ONLY = True` và `config/urls.py` **không** include `allauth.urls`.

    Mount thêm là phơi ra một cửa đăng nhập thứ hai — bằng form HTML, ngoài mọi phép kiểm
    của tầng API — mà không ai kiểm.
    """
    assert settings.HEADLESS_ONLY is True
    assert client.get("/api/accounts/login/").status_code == 404
    assert client.get("/accounts/login/").status_code == 404
