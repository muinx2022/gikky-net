"""`POST /me/anh` — ảnh nhúng thẳng vào thân bài (2026-08-24).

Cửa thứ ba nhận file từ internet, và là cửa đầu tiên **không gắn với hàng nào có sẵn**:
không `moc_id` như `POST /mocs/{id}/anh`, không "một cái cho mỗi người" như
`POST /me/avatar`. Ai đăng nhập cũng gọi được, bao nhiêu lần cũng được — nên hạn mức ở
đây không phải một lớp bảo vệ thêm, nó là thứ ngăn cửa này thành dịch vụ lưu trữ file
miễn phí. Bộ đo vì thế nặng về ba phía:

1. **Bảy phép kiểm còn nguyên** — file rác / định dạng lạ / quá nặng phải chết ở đây y
   như ở hai cửa kia. Một cửa thứ ba bỏ qua kiểm là cửa mà kẻ tấn công sẽ dùng.
2. **Hạn mức có thật** — vượt trần là 429 kèm `thu_lai_tu`, và tấm bị từ chối **không**
   để lại byte nào trên đĩa.
3. **Đường ghi thật vẫn lọc `src`** — `test_anh_trong_body.py` lo vế đó; ở đây chỉ ghim
   rằng `url` trả về là đúng chuỗi mà `lam_sach` chấp nhận, tức hai cửa khớp nhau.
"""

import json

import pytest

from core.anh import ANH_HONG, ANH_QUA_NANG, BYTE_TOI_DA, DINH_DANG_KHONG_NHAN
from core.anh_luu import duong_dan_chinh, duong_dan_thumb
from core.lam_sach_html import lam_sach
from core.models.moc import AnhNoiDung

from ._anh import PHP_GIA_JPG, SVG_GIA_JPG, anh_byte, duoi_va_byte
from .conftest import file_trong, so_file

pytestmark = pytest.mark.usefixtures("kho_anh")

ANH_ND = "/api/v1/me/anh"


def tai_anh(client, du_lieu: bytes = None, *, ten="a.jpg", status=201):
    """POST multipart một ảnh nội dung. Trả thân đã parse."""
    if du_lieu is None:
        du_lieu = anh_byte()
    _, f, _ = duoi_va_byte(du_lieu, ten)
    r = client.post(ANH_ND, {"file": f})
    assert r.status_code == status, (
        f"POST {ANH_ND} trả {r.status_code}, mong {status}: {r.content[:400]!r}"
    )
    return json.loads(r.content) if r.content else None


def ma_loi_anh(client, du_lieu: bytes, *, status: int) -> str:
    than = tai_anh(client, du_lieu, status=status)
    assert "code" in than, f"thân lỗi thiếu `code`: {than!r}"
    return than["code"]


# --- đường ghi hạnh phúc -----------------------------------------------------


@pytest.mark.django_db
def test_tai_anh_len_thi_co_url_media_va_file_tren_dia(client, nguoi_a, kho_anh):
    client.force_login(nguoi_a)
    d = tai_anh(client)

    assert d["url"].startswith("/media/anh/"), d["url"]
    assert "anh-thumb" not in d["url"], "ảnh giữa bài phục vụ bằng bản CHÍNH, không thumb"
    assert d["width"] and d["height"], "editor cần kích thước để đặt khung"

    hang = AnhNoiDung.objects.get(nguoi_tai=nguoi_a)
    phuc_vu, _ = kho_anh
    assert (phuc_vu / duong_dan_chinh(hang.khoa_luu_tru)).exists()
    # Thumbnail vẫn được sinh dù cửa này không trả URL của nó: `xu_ly_anh_tai_len` làm
    # cả hai trong một lượt, và `don_anh_mo_coi` whitelist theo KHOÁ nên hai file đi cùng.
    assert (phuc_vu / duong_dan_thumb(hang.khoa_luu_tru)).exists()
    assert so_file(phuc_vu) == 2


@pytest.mark.django_db
def test_url_tra_ve_song_sot_qua_lam_sach(client, nguoi_a):
    """Hai cửa phải KHỚP nhau: `url` của cửa upload là `src` mà cửa ghi chấp nhận.

    Đây là chỗ nứt tự nhiên nhất của cả bản vá — đổi `MEDIA_URL`, đổi thư mục lưu, hay
    một ngày trả URL tuyệt đối cho CDN, là ảnh vừa tải lên bị chính lượt sanitize gỡ mất
    lúc đăng bài. Người dùng thấy ảnh trong editor rồi đăng lên thì mất, không lỗi nào.
    """
    client.force_login(nguoi_a)
    url = tai_anh(client)["url"]
    the = f'<p>xem đây</p><img src="{url}" alt="biểu đồ">'
    assert lam_sach(the) == the


@pytest.mark.django_db
def test_no_store_tren_ca_thanh_cong_lan_qua_han(client, nguoi_a, settings):
    """`no-store` — response nói về tài sản + hạn mức của MỘT phiên."""
    client.force_login(nguoi_a)
    _, f, _ = duoi_va_byte(anh_byte())
    r = client.post(ANH_ND, {"file": f})
    assert r.status_code == 201 and r["Cache-Control"] == "no-store"

    settings.HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY = 1
    _, f2, _ = duoi_va_byte(anh_byte())
    r2 = client.post(ANH_ND, {"file": f2})
    assert r2.status_code == 429 and r2["Cache-Control"] == "no-store"


@pytest.mark.django_db
def test_hai_nguoi_khac_nhau_thi_hai_khoa_khac_nhau(client, nguoi_a, nguoi_b):
    client.force_login(nguoi_a)
    a = tai_anh(client)["url"]
    client.force_login(nguoi_b)
    b = tai_anh(client)["url"]
    assert a != b
    assert AnhNoiDung.objects.count() == 2


# --- bảy phép kiểm còn nguyên ------------------------------------------------


@pytest.mark.django_db
def test_file_php_doi_duoi_jpg_bi_tu_choi(client, nguoi_a, kho_anh):
    """Thử phá: bỏ `xu_ly_anh_tai_len` (ghi thẳng bytes) là bài này ĐỎ."""
    client.force_login(nguoi_a)
    assert ma_loi_anh(client, PHP_GIA_JPG, status=400) == ANH_HONG
    phuc_vu, _ = kho_anh
    assert file_trong(phuc_vu) == set(), "file bị từ chối không được để lại byte nào"
    assert AnhNoiDung.objects.count() == 0


@pytest.mark.django_db
def test_svg_bi_tu_choi(client, nguoi_a):
    """SVG là XML và nó CHẠY `<script>` khi trình duyệt mở thẳng — cùng origin với phiên."""
    client.force_login(nguoi_a)
    assert ma_loi_anh(client, SVG_GIA_JPG, status=400) == ANH_HONG


@pytest.mark.django_db
def test_gif_khong_nam_trong_allowlist(client, nguoi_a):
    client.force_login(nguoi_a)
    assert (
        ma_loi_anh(client, anh_byte(dinh_dang="GIF"), status=400)
        == DINH_DANG_KHONG_NHAN
    )


@pytest.mark.django_db
def test_anh_qua_nang_tra_413(client, nguoi_a):
    client.force_login(nguoi_a)
    nang = b"\xff\xd8\xff" + b"\x00" * (BYTE_TOI_DA + 1)
    assert ma_loi_anh(client, nang, status=413) == ANH_QUA_NANG


# --- hạn mức -----------------------------------------------------------------


@pytest.mark.django_db
def test_vuot_tran_thi_429_kem_thu_lai_tu(client, nguoi_a, settings, kho_anh):
    """Thử phá: bỏ khối hạn mức trong `tai_anh_noi_dung` là bài này ĐỎ.

    Trần hạ xuống 2 bằng `settings` chứ không tải đủ 30 tấm — cùng lối mà
    `core/han_muc.py` chọn khi nó đọc `settings` tại thời điểm gọi, và nó là lý do bộ đo
    hạn mức ở repo này chạy trong vài giây chứ không vài phút.
    """
    settings.HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY = 2
    client.force_login(nguoi_a)
    tai_anh(client)
    tai_anh(client)

    than = tai_anh(client, status=429)

    assert than["code"] == "qua_han_muc_anh_noi_dung"
    assert than["thu_lai_tu"], "429 của repo này luôn nói lúc nào thử lại được"
    assert AnhNoiDung.objects.filter(nguoi_tai=nguoi_a).count() == 2
    phuc_vu, _ = kho_anh
    assert so_file(phuc_vu) == 4, "tấm thứ ba không được để lại file nào"


@pytest.mark.django_db
def test_han_muc_tinh_RIENG_tung_nguoi(client, nguoi_a, nguoi_b, settings):
    """Đối chứng — nếu hạn mức đếm chung thì nó chặn nhầm cả cộng đồng sau một người."""
    settings.HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY = 1
    client.force_login(nguoi_a)
    tai_anh(client)
    tai_anh(client, status=429)

    client.force_login(nguoi_b)
    tai_anh(client)


@pytest.mark.django_db
def test_anh_cua_hom_qua_khong_tinh_vao_hom_nay(client, nguoi_a, settings):
    """Ranh giới là **nửa đêm giờ VN**, không phải cửa sổ trượt 24 giờ (PLAN mục 1)."""
    from datetime import timedelta

    from django.utils import timezone

    settings.HAN_MUC_ANH_NOI_DUNG_MOI_USER_NGAY = 1
    client.force_login(nguoi_a)
    tai_anh(client)
    AnhNoiDung.objects.filter(nguoi_tai=nguoi_a).update(
        created_at=timezone.now() - timedelta(days=2)
    )

    tai_anh(client)
