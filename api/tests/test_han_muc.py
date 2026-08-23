"""Ba hạn mức chống lạm dụng PLAN đòi mà repo **chưa có** cho tới lượt vá V1 — L12.

- PLAN mục 10 Phase 6: **đăng ký ≤5/IP/ngày**, **đăng bài ≤10/user/ngày**
  *(đổi số được trong settings)*;
- PLAN 5.10: **shadow-limit tài khoản < 3 ngày tuổi: tối đa 5 bình luận/giờ**.

Trước lượt vá, `grep` toàn repo cho ra đúng **một** hằng hạn mức (`SO_MOC_TOI_DA_MOI_NGAY`),
trong khi `deploy/Caddyfile` khẳng định *"hạn mức theo người dùng và theo ngày lịch VN là
việc của Django"*. Nghĩa là: một tài khoản đăng bao nhiêu mạch tuỳ thích, một IP mở 20 tài
khoản mỗi phút (mặc định allauth), và tầng nào cũng tin tầng kia làm.

## Bài đo hạ trần xuống 2, không dựng đủ 10 hàng

Con số thật đọc từ `settings` **tại thời điểm gọi** (`core/han_muc.py`), nên
`override_settings` là đủ. Dựng 10 mạch thật chỉ để chạm trần làm bài đo chậm gấp năm mà
không kiểm thêm được gì — và nó khoá cứng bài đo vào con số 10, tức đổi con số trong
settings (thứ PLAN cho phép) sẽ làm bộ test đỏ.

**Chiều ngược luôn có mặt**: mỗi hạn mức có một bài "dưới trần thì KHÔNG chặn oan" — đúng
câu nghiệm thu của PLAN mục 10 Phase 6.
"""

import json
from datetime import timedelta

import pytest
from django.utils import timezone

from core.han_muc import dia_chi_ip
from core.models import Comment, Mach, User

from .conftest import dat

BROWSER = "/api/_allauth/browser/v1"
MAT_KHAU = "mot-mat-khau-du-dai-2026"


#: Đăng ký THÀNH CÔNG trả **401**, không phải 200 — `ACCOUNT_EMAIL_VERIFICATION =
#: "mandatory"` nên allauth headless trả "chưa xác thực, còn flow `verify_email` đang chờ".
#: Ghi thành hằng có tên để không ai đọc con số ấy thành "bị từ chối".
DANG_KY_XONG = 401


def _dang_ky(client, ten: str, *, status: int = DANG_KY_XONG, **thua):
    """Một lượt đăng ký qua đúng cửa allauth headless mà frontend gọi."""
    r = client.post(
        f"{BROWSER}/auth/signup",
        data=json.dumps(
            {"email": f"{ten}@gikky.test", "username": ten, "password": MAT_KHAU}
        ),
        content_type="application/json",
        **thua,
    )
    if status is not None:
        assert r.status_code == status, f"{ten} → {r.status_code}: {r.content[:400]!r}"
    return r


# =============================================================================
# Đăng bài ≤ N / user / ngày lịch VN
# =============================================================================


@pytest.mark.django_db
def test_dang_bai_vuot_tran_tra_429_kem_thu_lai_tu(client, settings, sub, nguoi_a):
    settings.HAN_MUC_MACH_MOI_USER_NGAY = 2
    client.force_login(nguoi_a)
    than = {"sub": sub.slug, "title": "Bài", "body": "Mốc 1."}

    dat(client, "/api/v1/machs", than, status=201)
    dat(client, "/api/v1/machs", than, status=201)
    ra = dat(client, "/api/v1/machs", than, status=429)

    assert ra["code"] == "qua_han_muc_mach"
    # 429 là mã DUY NHẤT của API mang thêm `thu_lai_tu` (PLAN mục 7) — thiếu nó thì
    # frontend phải dựng lại luật "nửa đêm giờ VN" ở phía client.
    assert "thu_lai_tu" in ra, ra
    assert Mach.objects.filter(author=nguoi_a).count() == 2


@pytest.mark.django_db
def test_dang_bai_DUOI_tran_khong_bi_chan_oan(client, settings, sub, nguoi_a):
    """Nghiệm thu PLAN mục 10 Phase 6 nói cả hai vế: *"vượt rate → lỗi đúng, dưới rate →
    không chặn oan"*. Không có bài này thì "luôn 429" cũng xanh."""
    settings.HAN_MUC_MACH_MOI_USER_NGAY = 2
    client.force_login(nguoi_a)
    dat(client, "/api/v1/machs", {"sub": sub.slug, "title": "B", "body": "M."}, status=201)
    assert Mach.objects.filter(author=nguoi_a).count() == 1


@pytest.mark.django_db
def test_han_muc_bai_dem_theo_NGAY_LICH_VN_khong_phai_24_gio_truot(
    client, settings, sub, nguoi_a
):
    """Ranh giới là nửa đêm giờ VN (PLAN mục 1), không phải "24 giờ tính từ bài đầu".

    Bài hôm qua **không** tính vào hạn mức hôm nay, kể cả khi nó mới cách đây 3 tiếng theo
    đồng hồ UTC. Đẩy `created_at` lùi 25 giờ là đủ để rơi sang ngày lịch trước ở mọi giờ
    trong ngày.
    """
    settings.HAN_MUC_MACH_MOI_USER_NGAY = 1
    client.force_login(nguoi_a)
    dat(client, "/api/v1/machs", {"sub": sub.slug, "title": "Hôm qua", "body": "M."}, status=201)
    Mach.objects.filter(author=nguoi_a).update(
        created_at=timezone.now() - timedelta(hours=25)
    )
    dat(client, "/api/v1/machs", {"sub": sub.slug, "title": "Hôm nay", "body": "M."}, status=201)
    assert Mach.objects.filter(author=nguoi_a).count() == 2


@pytest.mark.django_db
def test_han_muc_bai_la_cua_TUNG_NGUOI(client, settings, sub, nguoi_a, nguoi_b):
    """Người B không bị chặn vì A đã viết đủ — hạn mức theo user, không theo site."""
    settings.HAN_MUC_MACH_MOI_USER_NGAY = 1
    than = {"sub": sub.slug, "title": "Bài", "body": "Mốc 1."}
    client.force_login(nguoi_a)
    dat(client, "/api/v1/machs", than, status=201)
    dat(client, "/api/v1/machs", than, status=429)
    client.force_login(nguoi_b)
    dat(client, "/api/v1/machs", than, status=201)


# =============================================================================
# Shadow-limit: tài khoản < 3 ngày tuổi, N bình luận / giờ
# =============================================================================


@pytest.mark.django_db
def test_tai_khoan_moi_vuot_tran_binh_luan_gio_tra_429(
    client, settings, mach_cua_a, nguoi_b
):
    settings.HAN_MUC_BINH_LUAN_MOI_GIO_TAI_KHOAN_MOI = 2
    client.force_login(nguoi_b)
    url = f"/api/v1/machs/{mach_cua_a.pk}/comments"

    dat(client, url, {"body": "câu 1"}, status=201)
    dat(client, url, {"body": "câu 2"}, status=201)
    ra = dat(client, url, {"body": "câu 3"}, status=429)

    assert ra["code"] == "qua_han_muc_binh_luan"
    assert "thu_lai_tu" in ra, ra
    assert Comment.objects.filter(author=nguoi_b).count() == 2


@pytest.mark.django_db
def test_tai_khoan_DU_TUOI_khong_dinh_shadow_limit(
    client, settings, mach_cua_a, nguoi_b
):
    """Điều kiện "< 3 ngày tuổi" phải THẬT SỰ được hỏi.

    Bỏ điều kiện ấy đi thì hạn mức thành 5 bình luận/giờ cho **mọi người**, tức một luật
    sản phẩm hoàn toàn khác — và không bài đo nào khác bắt được vì mọi fixture đều dựng
    tài khoản mới tinh.
    """
    settings.HAN_MUC_BINH_LUAN_MOI_GIO_TAI_KHOAN_MOI = 1
    User.objects.filter(pk=nguoi_b.pk).update(
        date_joined=timezone.now() - timedelta(days=30)
    )
    nguoi_b.refresh_from_db()
    client.force_login(nguoi_b)
    url = f"/api/v1/machs/{mach_cua_a.pk}/comments"
    dat(client, url, {"body": "câu 1"}, status=201)
    dat(client, url, {"body": "câu 2"}, status=201)
    dat(client, url, {"body": "câu 3"}, status=201)


@pytest.mark.django_db
def test_shadow_limit_dung_cua_so_TRUOT_theo_gio(client, settings, mach_cua_a, nguoi_b):
    """PLAN 5.10 viết "5 bình luận/giờ" — câu bị đẩy lùi hơn 1 giờ rơi khỏi cửa sổ."""
    settings.HAN_MUC_BINH_LUAN_MOI_GIO_TAI_KHOAN_MOI = 1
    client.force_login(nguoi_b)
    url = f"/api/v1/machs/{mach_cua_a.pk}/comments"
    dat(client, url, {"body": "câu cũ"}, status=201)
    dat(client, url, {"body": "câu mới"}, status=429)

    Comment.objects.filter(author=nguoi_b).update(
        created_at=timezone.now() - timedelta(hours=1, minutes=1)
    )
    dat(client, url, {"body": "câu mới"}, status=201)


@pytest.mark.django_db
def test_shadow_limit_dem_ca_BIA_MO(client, settings, mach_cua_a, nguoi_a, nguoi_b):
    """Xoá rồi viết lại là cách lách ngắn nhất — phép đếm không được trừ bia mộ đi.

    ⚠ **Bài đo này chỉ phủ nhánh BIA MỘ, và đó là toàn bộ thứ cài được hôm nay.** Nhánh
    xoá THẬT (bình luận không có reply và chưa từng được trích — PLAN 5.3) xoá hẳn hàng
    khỏi Postgres, nên không phép đếm nào chạy trên bảng `core_comment` nhìn thấy nó nữa.
    Nợ có tên `SHADOW-LIMIT-XOA-THAT` trong `LOI-VA-NO.md`; trả nó cần một bộ đếm sống
    độc lập với hàng bị xoá, tức một bảng mới — ngoài phạm vi lượt vá này.
    """
    settings.HAN_MUC_BINH_LUAN_MOI_GIO_TAI_KHOAN_MOI = 1
    url = f"/api/v1/machs/{mach_cua_a.pk}/comments"

    client.force_login(nguoi_b)
    ra = dat(client, url, {"body": "câu sẽ xoá"}, status=201)
    # Một reply của người khác ⇒ lượt xoá dưới đây rơi vào nhánh BIA MỘ (PLAN 5.3).
    client.force_login(nguoi_a)
    dat(client, url, {"body": "giữ chỗ", "parent_id": ra["id"]}, status=201)

    client.force_login(nguoi_b)
    dat(client, f"/api/v1/comments/{ra['id']}", status=200, method="delete")
    dat(client, url, {"body": "câu thay thế"}, status=429)


# =============================================================================
# Đăng ký ≤ N / IP / ngày lịch VN
# =============================================================================


@pytest.mark.django_db
def test_dang_ky_vuot_tran_theo_IP_bi_tu_choi(client, settings):
    """Cửa allauth headless — đúng đường frontend gọi, không phải một lối tắt.

    allauth gọi `is_open_for_signup` **trước khi** dựng hàng `User`, nên lượt bị từ chối
    không để lại tài khoản nửa vời nào.
    """
    settings.HAN_MUC_DANG_KY_MOI_IP_NGAY = 2
    for i in range(2):
        _dang_ky(client, f"nguoi_{i}")
    assert User.objects.count() == 2

    _dang_ky(client, "nguoi_9", status=403)
    assert User.objects.count() == 2, "lượt thứ 3 vẫn dựng được tài khoản"
    assert not User.objects.filter(username="nguoi_9").exists()


@pytest.mark.django_db
def test_dang_ky_DUOI_tran_khong_bi_chan_oan(client, settings):
    settings.HAN_MUC_DANG_KY_MOI_IP_NGAY = 2
    _dang_ky(client, "nguoi_a1")
    assert User.objects.filter(username="nguoi_a1").exists()


@pytest.mark.django_db
def test_dang_ky_ghi_lai_IP_va_IP_KHAC_khong_bi_tinh_chung(client, settings):
    """Khoá đếm là `User.dang_ky_ip`. Không ghi cột ấy thì hạn mức đếm được **0** mãi mãi.

    Vế thứ hai quan trọng không kém: một IP khác **không** bị tính vào hạn mức của IP này.
    Thiếu vế đó thì "5/IP/ngày" trên thực tế là "5/ngày cho cả thế giới", và nó chỉ lộ ra
    khi site có người thật.
    """
    settings.HAN_MUC_DANG_KY_MOI_IP_NGAY = 1
    _dang_ky(client, "nguoi_x")
    u = User.objects.get(username="nguoi_x")
    assert u.dang_ky_ip == "127.0.0.1", f"không ghi IP: {u.dang_ky_ip!r}"

    _dang_ky(client, "nguoi_y", status=403)  # cùng IP ⇒ chặn
    _dang_ky(client, "nguoi_z", REMOTE_ADDR="203.0.113.7")  # IP khác ⇒ qua
    assert User.objects.get(username="nguoi_z").dang_ky_ip == "203.0.113.7"


@pytest.mark.django_db
def test_dang_ky_hom_qua_khong_tinh_vao_hom_nay(client, settings):
    settings.HAN_MUC_DANG_KY_MOI_IP_NGAY = 1
    _dang_ky(client, "nguoi_q")
    User.objects.filter(username="nguoi_q").update(
        date_joined=timezone.now() - timedelta(hours=25)
    )
    _dang_ky(client, "nguoi_w")


# =============================================================================
# `dia_chi_ip` — hạn mức theo IP đứng hay sụp ở đúng hàm này
# =============================================================================


class _Req:
    def __init__(self, **meta):
        self.META = meta


def test_ip_mac_dinh_KHONG_tin_x_forwarded_for(settings):
    """Mặc định phải là **không tin**: không có proxy phía trước thì header ấy là chữ do
    client tự gõ, và tin nó nghĩa là ai cũng tự đổi khoá đếm của mình bằng một dòng."""
    settings.TIN_X_FORWARDED_FOR = False
    req = _Req(REMOTE_ADDR="127.0.0.1", HTTP_X_FORWARDED_FOR="1.2.3.4")
    assert dia_chi_ip(req) == "127.0.0.1"


def test_ip_lay_phan_tu_CUOI_cua_x_forwarded_for(settings):
    """Với đúng MỘT proxy tin cậy, phần tử cuối là địa chỉ Caddy thật sự nhìn thấy.

    Phần tử **đầu** là thứ client tự khai: đọc nó thì kẻ muốn lách chỉ cần gửi
    `X-Forwarded-For: <ip ngẫu nhiên>` mỗi lượt đăng ký.
    """
    settings.TIN_X_FORWARDED_FOR = True
    req = _Req(REMOTE_ADDR="127.0.0.1", HTTP_X_FORWARDED_FOR="9.9.9.9, 203.0.113.7")
    assert dia_chi_ip(req) == "203.0.113.7"


def test_ip_bat_tin_ma_khong_co_header_thi_ve_REMOTE_ADDR(settings):
    settings.TIN_X_FORWARDED_FOR = True
    assert dia_chi_ip(_Req(REMOTE_ADDR="10.0.0.5")) == "10.0.0.5"
