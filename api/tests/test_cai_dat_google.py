"""Nguồn credential Google: hàng `SocialApp` (DB) ưu tiên, env dự phòng.

`plans/2026-08-24-cai-dat-google-oauth.md` §1. User chốt "DB ưu tiên, env dự phòng", và
nó được cài bằng **cơ chế `hidden` có sẵn của allauth** chứ không bằng một nhánh `if` tự
viết: `list_apps` hoà trộn app-từ-DB với app-từ-settings, `get_app` lọc `hidden` khi thấy
nhiều hơn một.

Bảng bốn dòng dưới đây LÀ hợp đồng, mỗi dòng một bài đo:

    DB | env | kết quả
    ---|-----|---------------------------------
     – | có  | env dùng được          (dự phòng)
    có | có  | DB thắng               (ưu tiên)
    có |  –  | DB dùng được
     – |  –  | tắt ⇒ nút vắng mặt

## Đo bằng `get_app` THẬT, không bằng phép đếm tự viết

Mọi bài dưới đây hỏi `google_dang_bat()`, mà hàm ấy gọi thẳng
`get_adapter().get_app()` — đúng cái allauth chạy khi người ta bấm nút. Một bài đo tự đếm
hàng `SocialApp` sẽ xanh với cả bản cài bỏ quên `hidden`, `on_site`, hay app-từ-settings.
"""

import pytest
from allauth.socialaccount.models import SocialApp
from django.conf import settings
from django.contrib.sites.models import Site
from django.http import HttpRequest
from django.test import override_settings

from core.cau_hinh_oauth import (
    doc_trang_thai,
    google_dang_bat,
    luu_google,
    xoa_google,
)

pytestmark = pytest.mark.django_db

#: Giống hình dạng thật (Google client id kết thúc bằng `.apps.googleusercontent.com`)
#: để bài đo không vô tình nghiệm đúng nhờ một chuỗi quá đơn giản.
ID_DB = "db-1234567890.apps.googleusercontent.com"
BM_DB = "secret-cua-db-XYZW"
ID_ENV = "env-0987654321.apps.googleusercontent.com"
BM_ENV = "secret-cua-env-ABCD"


def env_co():
    """`override_settings` mô phỏng env CÓ credential — kèm `hidden`, y như settings thật.

    Phải dựng lại nguyên hình dạng ở `config/settings.py`: thiếu `settings.hidden` thì bài
    đo "DB thắng" sẽ đo một cấu hình khác với cấu hình đang chạy, và nó là loại sai tệ
    nhất — xanh ở đây, 500 ở prod.
    """
    return override_settings(
        GOOGLE_ENV_CO=True,
        GOOGLE_CLIENT_ID=ID_ENV,
        GOOGLE_CLIENT_SECRET=BM_ENV,
        SOCIALACCOUNT_PROVIDERS={
            "google": {
                "APPS": [
                    {
                        "client_id": ID_ENV,
                        "secret": BM_ENV,
                        "key": "",
                        "settings": {"hidden": True},
                    }
                ],
                "SCOPE": ["profile", "email"],
                "EMAIL_AUTHENTICATION": True,
            }
        },
    )


def env_trong():
    return override_settings(
        GOOGLE_ENV_CO=False,
        GOOGLE_CLIENT_ID="",
        GOOGLE_CLIENT_SECRET="",
        SOCIALACCOUNT_PROVIDERS={
            "google": {"SCOPE": ["profile", "email"], "EMAIL_AUTHENTICATION": True}
        },
    )


def app_dang_dung():
    """Credential mà allauth THỰC SỰ sẽ dùng — đọc qua đúng đường của nó.

    ⚠ Phải truyền một **request**, y như `google_dang_bat` làm. `list_apps` bỏ qua phép
    lọc `on_site` khi `request` là `None`, nên một helper gọi `get_app(None, …)` sẽ thấy
    cả những hàng mà luồng đăng nhập thật không thấy — và bài đo khi đó đo một thế giới
    khác với thế giới đang chạy. Chính chỗ này đã đỏ một lượt vì lý do đó.
    """
    from allauth.socialaccount.adapter import get_adapter

    return get_adapter().get_app(HttpRequest(), "google")


# --- Bảng bốn dòng của §1 -------------------------------------------------------------


def test_chi_env_thi_env_dung_duoc(db):
    """Dòng 1: DB trống, env có ⇒ env là nguồn (dự phòng)."""
    with env_co():
        assert google_dang_bat() is True
        assert app_dang_dung().client_id == ID_ENV
        assert doc_trang_thai().nguon == "env"


def test_ca_hai_thi_DB_THANG(db):
    """Dòng 2 — bài đo quan trọng nhất file.

    Đây là dòng duy nhất phân biệt được bản cài đúng với bản cài quên cờ `hidden`. Quên
    `hidden` thì `get_app` thấy hai app "visible" và ném `MultipleObjectsReturned`, tức
    **500 ngay giữa luồng đăng nhập** — không phải một lỗi cấu hình im lặng.
    """
    with env_co():
        luu_google(client_id=ID_DB, secret=BM_DB)

        assert google_dang_bat() is True
        dung = app_dang_dung()
        assert dung.client_id == ID_DB, "hàng DB phải thắng app từ env"
        assert dung.secret == BM_DB
        assert doc_trang_thai().nguon == "db"


def test_chi_DB_thi_DB_dung_duoc(db):
    """Dòng 3: env trống, DB có."""
    with env_trong():
        luu_google(client_id=ID_DB, secret=BM_DB)

        assert google_dang_bat() is True
        assert app_dang_dung().client_id == ID_DB
        assert doc_trang_thai().nguon == "db"


def test_khong_nguon_nao_thi_TAT(db):
    """Dòng 4: không nguồn nào ⇒ tắt ⇒ frontend không render nút (PLAN mục 4)."""
    with env_trong():
        assert google_dang_bat() is False
        tt = doc_trang_thai()
        assert tt.bat is False
        assert tt.nguon is None


def test_xoa_hang_DB_thi_ROI_VE_env(db):
    """"Dự phòng" phải đúng cả chiều đi xuống, không chỉ chiều đi lên.

    Xoá hàng DB khi env vẫn có credential thì Google **vẫn bật** — trang cài đặt phải nói
    "đang chạy bằng env", không được báo "đã tắt". Báo sai ở đây làm người ta đi bật lại
    một thứ đang chạy.
    """
    with env_co():
        luu_google(client_id=ID_DB, secret=BM_DB)
        assert doc_trang_thai().nguon == "db"

        assert xoa_google() is True
        assert google_dang_bat() is True, "env phải đỡ lại"
        assert doc_trang_thai().nguon == "env"
        assert app_dang_dung().client_id == ID_ENV


# --- Bẫy `on_site` (§2) ---------------------------------------------------------------


def test_hang_tao_qua_luu_google_CO_noi_vao_site(db):
    """Quên `sites.add` thì allauth không thấy hàng: nút tắt, không lỗi, không log.

    Người đi sửa sẽ soi credential chứ không soi bảng nối — đó là lý do cái bẫy này đáng
    một bài đo riêng thay vì tin vào đoạn code ba dòng.
    """
    with env_trong():
        hang = luu_google(client_id=ID_DB, secret=BM_DB)

        assert hang.sites.filter(pk=settings.SITE_ID).exists()
        assert SocialApp.objects.on_site(None).filter(pk=hang.pk).exists()
        assert google_dang_bat() is True


def test_hang_KHONG_noi_site_thi_coi_nhu_khong_co(db):
    """Chiều ngược: chứng minh bài trên không nghiệm đúng với mọi thứ.

    Dựng tay một hàng thiếu `sites` (đúng thứ Django admin tạo ra nếu ai đó quên chọn
    site) và đòi hệ thống coi nó như không tồn tại — chứ không phải nửa tồn tại.
    """
    with env_trong():
        SocialApp.objects.create(
            provider="google", name="Google", client_id=ID_DB, secret=BM_DB
        )
        assert google_dang_bat() is False
        assert doc_trang_thai().nguon is None


def test_luu_lai_va_hang_cu_thieu_site_thi_duoc_va(db):
    """Hàng cũ do Django admin tạo mà quên site ⇒ lưu qua khu quản trị phải vá nó."""
    with env_trong():
        SocialApp.objects.create(
            provider="google", name="Google", client_id="cu", secret="cu"
        )
        assert google_dang_bat() is False

        luu_google(client_id=ID_DB, secret=BM_DB)
        assert google_dang_bat() is True
        assert app_dang_dung().client_id == ID_DB


# --- Secret (§3) ----------------------------------------------------------------------


def test_doc_trang_thai_KHONG_mang_secret_ra_ngoai(db):
    """Chỉ 4 ký tự cuối. Đủ để nhận ra đã dán đúng chuỗi nào, không đủ để dùng lại."""
    with env_trong():
        luu_google(client_id=ID_DB, secret=BM_DB)
        tt = doc_trang_thai()

        assert tt.secret_da_dat is True
        assert tt.secret_duoi == BM_DB[-4:]
        assert BM_DB not in str(tt), "secret lọt ra ngoài qua repr của dataclass"
        assert not hasattr(tt, "secret")


def test_luu_secret_RONG_thi_giu_nguyen_secret_cu(db):
    """`secret=None` = "không đổi", không phải "xoá".

    Người ta sửa `client_id` mà không dán lại secret là chuyện bình thường. Nếu trống mà
    xoá thì mỗi lần sửa `client_id` là một lần vô tình gỡ Google khỏi site, và triệu chứng
    (nút biến mất) không trỏ về nguyên nhân.
    """
    with env_trong():
        luu_google(client_id=ID_DB, secret=BM_DB)
        luu_google(client_id="doi-roi.apps.googleusercontent.com", secret=None)

        dung = app_dang_dung()
        assert dung.client_id == "doi-roi.apps.googleusercontent.com"
        assert dung.secret == BM_DB, "secret cũ bị xoá khi ô nhập để trống"
        assert google_dang_bat() is True


def test_google_bat_doi_NGAY_trong_cung_mot_tien_trinh(db, client):
    """Tiêu chí §7: bật/tắt có hiệu lực ngay, không cần khởi động lại Django.

    Đây là toàn bộ lý do lượt này tồn tại — env cũ đọc một lần lúc boot nên nhập xong phải
    restart mới thấy gì.
    """
    with env_trong():
        assert client.get("/api/v1/me").json()["google_bat"] is False

        luu_google(client_id=ID_DB, secret=BM_DB)
        assert client.get("/api/v1/me").json()["google_bat"] is True

        xoa_google()
        assert client.get("/api/v1/me").json()["google_bat"] is False


def test_site_fixture_ton_tai(db):
    """Tiền đề của cả file: `SITE_ID` trỏ vào một hàng có thật."""
    assert Site.objects.filter(pk=settings.SITE_ID).exists()
