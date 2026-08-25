"""API Cài đặt → Google OAuth. `plans/2026-08-24-cai-dat-google-oauth.md` §3–§5.

Ba tính chất được đo kỹ nhất, vì cả ba hỏng im lặng:

1. **Secret không đi ra.** Bài đo quét **toàn bộ body** tìm chuỗi secret, không chỉ hỏi
   vài khoá — thêm một trường mới mang secret thì nó vẫn ĐỎ.
2. **Secret rỗng = giữ nguyên.** Ghi đè thành rỗng làm Google tắt lặng lẽ, và triệu chứng
   (nút biến mất) không trỏ về nguyên nhân (vừa sửa `client_id`).
3. **Chỉ superuser được ghi.** Ai đổi được OAuth client là đổi được cửa đăng nhập của cả
   site.
"""

import pytest
from django.test import override_settings

from core.cau_hinh_oauth import luu_google
from core.ghi import AUDIT_SUA_CAI_DAT_GOOGLE, AUDIT_XOA_CAI_DAT_GOOGLE
from core.models import AuditLog

from tests._quan_tri import dang_nhap, dung_mod, goi

pytestmark = pytest.mark.django_db

DUONG = "/api/admin/cai-dat/google"
ID = "moi-1234567890.apps.googleusercontent.com"
BM = "secret-rat-bi-mat-WXYZ"


def env_trong():
    return override_settings(
        GOOGLE_ENV_CO=False,
        GOOGLE_CLIENT_ID="",
        GOOGLE_CLIENT_SECRET="",
        SOCIALACCOUNT_PROVIDERS={
            "google": {"SCOPE": ["profile", "email"], "EMAIL_AUTHENTICATION": True}
        },
    )


@pytest.fixture
def sieu(db):
    u = dung_mod("sieu_quan_tri")
    u.is_superuser = True
    u.save(update_fields=["is_superuser"])
    return u, dang_nhap(u)


@pytest.fixture
def mod_thuong(db):
    u = dung_mod("mod_thuong")
    return u, dang_nhap(u)


# --- Đường thuận -----------------------------------------------------------------------


def test_luu_roi_doc_lai_di_tron_mot_vong(sieu):
    _, c = sieu
    with env_trong():
        r = goi(c, "put", DUONG, {"client_id": ID, "secret": BM})
        assert r.status_code == 200, r.content
        b = r.json()
        assert b["bat"] is True
        assert b["nguon"] == "db"
        assert b["client_id"] == ID
        assert b["secret_da_dat"] is True
        assert b["secret_duoi"] == BM[-4:]

        # Đọc lại bằng GET: hai đường dựng response riêng, và cái sai sẽ là cái ít người đọc.
        assert c.get(DUONG).json() == b


def test_xoa_tra_ve_trang_thai_sau_khi_xoa(sieu):
    _, c = sieu
    with env_trong():
        goi(c, "put", DUONG, {"client_id": ID, "secret": BM})

        r = c.delete(DUONG)
        assert r.status_code == 200, r.content
        b = r.json()
        assert b["bat"] is False
        assert b["nguon"] is None
        assert b["client_id"] == ""


# --- §3: secret không đi ra ------------------------------------------------------------


def test_secret_KHONG_LOT_ra_o_bat_ky_dau(sieu):
    """Quét toàn bộ body, không chỉ vài khoá — thêm trường mới mang secret vẫn ĐỎ."""
    _, c = sieu
    with env_trong():
        goi(c, "put", DUONG, {"client_id": ID, "secret": BM})

        for than in (c.get(DUONG).content.decode(), str(c.get(DUONG).json())):
            assert BM not in than, "secret lọt ra ngoài"
            # Cả phần thân của secret, phòng ca cắt chuỗi vụng.
            assert BM[:-4] not in than
        assert c.get(DUONG).json()["secret_duoi"] == BM[-4:]


def test_secret_RONG_thi_GIU_NGUYEN(sieu):
    """Sửa `client_id` mà để trống ô secret ⇒ secret cũ còn nguyên, Google vẫn bật."""
    _, c = sieu
    with env_trong():
        goi(c, "put", DUONG, {"client_id": ID, "secret": BM})

        r = goi(c, "put", DUONG, {"client_id": "doi-roi.apps.googleusercontent.com"})
        assert r.status_code == 200, r.content
        b = r.json()
        assert b["client_id"] == "doi-roi.apps.googleusercontent.com"
        assert b["secret_da_dat"] is True
        assert b["secret_duoi"] == BM[-4:], "secret cũ bị xoá khi ô nhập để trống"
        assert b["bat"] is True


def test_lan_dau_ma_thieu_secret_thi_400(sieu):
    """Lưu `client_id` không kèm secret là dựng một cấu hình chắc chắn hỏng lúc bấm nút."""
    _, c = sieu
    with env_trong():
        r = goi(c, "put", DUONG, {"client_id": ID})
        assert r.status_code == 400, r.content
        assert c.get(DUONG).json()["bat"] is False


def test_client_id_rong_thi_400(sieu):
    _, c = sieu
    with env_trong():
        assert goi(c, "put", DUONG, {"client_id": "   ", "secret": BM}).status_code == 400


# --- §4: chỉ superuser -----------------------------------------------------------------


def test_mod_thuong_DOC_duoc_nhung_KHONG_ghi_duoc(mod_thuong, sieu):
    """"Google có đang bật không" là câu mod cần trả lời khi có người báo lỗi đăng nhập."""
    _, c_sieu = sieu
    _, c_mod = mod_thuong
    with env_trong():
        goi(c_sieu, "put", DUONG, {"client_id": ID, "secret": BM})

        r = c_mod.get(DUONG)
        assert r.status_code == 200, r.content
        assert r.json()["bat"] is True
        assert r.json()["sua_duoc"] is False, "giao diện dùng cờ này để khoá form"

        assert goi(c_mod, "put", DUONG, {"client_id": "x", "secret": "y"}).status_code == 403
        assert c_mod.delete(DUONG).status_code == 403

        # Và không có gì đổi thật.
        assert c_sieu.get(DUONG).json()["client_id"] == ID


def test_superuser_thi_sua_duoc_bang_true(sieu):
    _, c = sieu
    with env_trong():
        assert c.get(DUONG).json()["sua_duoc"] is True


# --- Nhật ký ---------------------------------------------------------------------------


def test_ghi_nhat_ky_nhung_KHONG_ghi_secret(sieu):
    """Nhật ký chứa secret là bản sao thứ hai phải đi bảo vệ, ở chỗ không ai nghĩ tới."""
    u, c = sieu
    with env_trong():
        goi(c, "put", DUONG, {"client_id": ID, "secret": BM})
        c.delete(DUONG)

    dong = list(AuditLog.objects.order_by("pk"))
    assert [d.action for d in dong] == [
        AUDIT_SUA_CAI_DAT_GOOGLE,
        AUDIT_XOA_CAI_DAT_GOOGLE,
    ]
    assert dong[0].actor == u
    assert dong[0].meta["client_id"] == ID
    assert dong[0].meta["da_doi_secret"] is True
    for d in dong:
        assert BM not in str(d.meta), "secret lọt vào nhật ký"


def test_mod_thuong_bi_tu_choi_thi_KHONG_de_lai_nhat_ky(mod_thuong):
    _, c = mod_thuong
    with env_trong():
        assert goi(c, "put", DUONG, {"client_id": ID, "secret": BM}).status_code == 403
    assert AuditLog.objects.count() == 0


# --- Nguồn env -------------------------------------------------------------------------


def test_nguon_env_hien_ra_dung_va_KHONG_lo_secret(sieu):
    """Đang chạy bằng env thì trang phải nói "env", không nói "chưa cấu hình"."""
    _, c = sieu
    with override_settings(
        GOOGLE_ENV_CO=True,
        GOOGLE_CLIENT_ID="env-1.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET="secret-env-QRST",
        SOCIALACCOUNT_PROVIDERS={
            "google": {
                "APPS": [
                    {
                        "client_id": "env-1.apps.googleusercontent.com",
                        "secret": "secret-env-QRST",
                        "key": "",
                        "settings": {"hidden": True},
                    }
                ],
                "SCOPE": ["profile", "email"],
                "EMAIL_AUTHENTICATION": True,
            }
        },
    ):
        b = c.get(DUONG).json()
        assert b["nguon"] == "env"
        assert b["bat"] is True
        assert "secret-env-QRST" not in str(b)
        assert b["secret_duoi"] == "QRST"


def test_xoa_khi_env_van_co_thi_van_BAT(sieu):
    """`DELETE` không đồng nghĩa "tắt Google" — env đỡ lại. Response phải nói ra."""
    _, c = sieu
    with override_settings(
        GOOGLE_ENV_CO=True,
        GOOGLE_CLIENT_ID="env-1.apps.googleusercontent.com",
        GOOGLE_CLIENT_SECRET="secret-env-QRST",
        SOCIALACCOUNT_PROVIDERS={
            "google": {
                "APPS": [
                    {
                        "client_id": "env-1.apps.googleusercontent.com",
                        "secret": "secret-env-QRST",
                        "key": "",
                        "settings": {"hidden": True},
                    }
                ],
                "SCOPE": ["profile", "email"],
                "EMAIL_AUTHENTICATION": True,
            }
        },
    ):
        luu_google(client_id=ID, secret=BM)
        assert c.get(DUONG).json()["nguon"] == "db"

        b = c.delete(DUONG).json()
        assert b["bat"] is True, "env vẫn đang bật — không được báo đã tắt"
        assert b["nguon"] == "env"
