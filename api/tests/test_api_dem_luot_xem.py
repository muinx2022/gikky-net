"""Đường ghi lượt xem — nhóm G của `plans/2026-08-27-thong-ke-luot-xem.md` §8.

Ba nhánh từ chối và một nhánh ghi, và **cả ba nhánh từ chối phải ghi 0 hàng**. Đó là
điểm của nhóm này: một cửa ghi không có phiên đăng nhập mà từ chối bằng status code
nhưng vẫn kịp `INSERT` là một cửa vẫn bơm được số liệu rác — chỉ khó thấy hơn.

Mọi bài ở đây đếm `LuotXem.objects.count()` **sau** mỗi lượt gọi, kể cả những lượt đã
khẳng định status. Đó không phải thừa: hai khẳng định đo hai chuyện khác nhau, và cái
thứ hai là cái quan trọng hơn.
"""

import json
from datetime import timedelta

import pytest
from django.test import Client, override_settings

from api.dem_luot_xem import (
    DAI_TOI_DA_DUONG_DAN,
    DAI_TOI_DA_NGUON,
    HEADER_SECRET,
    _CACHE_MUOI,
    chuan_hoa_nguon,
    hash_khach,
    muoi_cua_ngay,
)
from core.models.luot_xem import LuotXem, MuoiNgay
from core.thoi_gian import ngay_vn

URL = "/api/v1/dem-luot-xem"
SECRET = "secret-cua-bai-do-khong-dung-o-dau-khac"

#: Django đọc header tự đặt từ `META` theo tên viết hoa có tiền tố `HTTP_`. `Client` nhận
#: chúng dưới dạng keyword; dựng khoá từ chính hằng của module sản phẩm để hai bên không
#: lệch nhau khi ai đó đổi tên header.
KHOA_HEADER = "HTTP_" + HEADER_SECRET.upper().replace("-", "_")


def goi(than: dict, *, secret: str | None = SECRET):
    """POST một lượt xem. `secret=None` ⇒ **không gửi header nào** (khách trần)."""
    them = {} if secret is None else {KHOA_HEADER: secret}
    return Client().post(
        URL, data=json.dumps(than), content_type="application/json", **them
    )


# --- G1: đường thành công ----------------------------------------------------


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G1_secret_dung_ghi_dung_MOT_hang():
    r = goi({"duong_dan": "/m/abc-1", "user_agent": "Mozilla/5.0 Chrome/131"})
    assert r.status_code == 200, r.content
    assert r.json() == {"da_dem": True}

    assert LuotXem.objects.count() == 1
    hang = LuotXem.objects.get()
    assert hang.duong_dan == "/m/abc-1"
    assert hang.la_bot is False
    assert hang.ten_bot == ""


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G1b_bot_duoc_danh_dau_va_dat_ten():
    goi(
        {
            "duong_dan": "/",
            "user_agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        }
    )
    hang = LuotXem.objects.get()
    assert hang.la_bot is True
    assert hang.ten_bot == "googlebot"


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G1c_khong_luu_user_agent_tho_o_bat_ky_cot_nao():
    """Quyết định của user: UA được **gửi** để phân loại, và **không được lưu**.

    Đo bằng cách quét MỌI cột chuỗi của hàng vừa ghi, không bằng cách liệt kê tên cột:
    thêm một cột `user_agent` ở lượt sau thì bài đo phải đỏ, mà một danh sách tên cột
    viết tay sẽ không biết cột mới tồn tại.
    """
    ua = "Mozilla/5.0 (Windows NT 10.0) DUOI-NHAN-DANG-KHONG-DUOC-LUU/1.0"
    goi({"duong_dan": "/", "user_agent": ua})
    hang = LuotXem.objects.get()
    gia_tri = [
        str(getattr(hang, f.attname)) for f in LuotXem._meta.get_fields() if f.concrete
    ]
    assert not any("DUOI-NHAN-DANG-KHONG-DUOC-LUU" in v for v in gia_tri), gia_tri


# --- G2 / G3: hai nhánh từ chối, và cả hai ghi 0 hàng ------------------------


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G2_secret_sai_thi_401_va_KHONG_ghi_gi():
    r = goi({"duong_dan": "/", "user_agent": "x"}, secret="sai-be-bét")
    assert r.status_code == 401
    assert r.json()["code"] == "sai_secret"
    assert LuotXem.objects.count() == 0


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET="")
def test_G3_secret_rong_o_server_thi_503_va_KHONG_ghi_gi():
    """Fail-closed. Đây là trạng thái MẶC ĐỊNH của máy dev và của `pytest`.

    503 chứ không phải 200-im-lặng: người vừa bật cơ chế phải biết là nó chưa bật. Và
    503 chứ không phải 401: hai câu trả lời khác nhau cho hai việc phải làm khác nhau
    (đặt biến ở server / sửa secret ở phía gọi).
    """
    r = goi({"duong_dan": "/", "user_agent": "x"}, secret="bat-ky-chuoi-nao")
    assert r.status_code == 503
    assert r.json()["code"] == "dem_luot_xem_tat"
    assert LuotXem.objects.count() == 0


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_khach_khong_kem_header_nao_thi_401_chua_dang_nhap():
    """Khách bằng trình duyệt nhận đúng câu trả lời của mọi cửa ghi khác.

    Nhánh này cũng được `tests/test_quyen_ghi.py::test_khach_khong_ghi_duoc_gi` chấm
    (cửa này có mặt trong bảng `CUA_GHI`); ở đây đo thêm vế **0 hàng**.
    """
    r = goi({"duong_dan": "/", "user_agent": "x"}, secret=None)
    assert r.status_code == 401
    assert r.json()["code"] == "chua_dang_nhap"
    assert LuotXem.objects.count() == 0


# --- G4 / G5: chuẩn hoá đường dẫn -------------------------------------------


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
@pytest.mark.parametrize(
    "gui,luu",
    [
        ("/m/abc-1?utm_source=facebook&utm_campaign=x", "/m/abc-1"),
        ("/?fbclid=abcdef", "/"),
        ("/s/chung-khoan#top", "/s/chung-khoan"),
        ("/tim-kiem?q=hpg#kq", "/tim-kiem"),
        ("/khong-co-gi", "/khong-co-gi"),
    ],
)
def test_G4_query_string_va_fragment_bi_cat_khoi_duong_dan(gui, luu):
    """`?utm_source=…` đẻ vô hạn biến thể của cùng một trang.

    Không cắt thì bảng "xem nhiều nhất" vỡ thành hàng nghìn dòng mỗi dòng một lượt — tức
    đúng câu hỏi của user không trả lời được nữa, mà bảng vẫn đầy và vẫn trông như thật.
    """
    goi({"duong_dan": gui, "user_agent": "x"})
    assert LuotXem.objects.get().duong_dan == luu


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_G5_duong_dan_dai_hon_200_bi_CAT_chu_khong_nem():
    """Cắt, không từ chối: một URL 300 ký tự là một trang có thật ai đó đã xem.

    ⚠ Bài này **không** ghim thứ tự "cắt sau khi bỏ query". Bản đầu có khẳng định ấy và
    lượt thử phá cho thấy nó sai: đảo hai phép vẫn ra cùng kết quả với mọi đầu vào
    (`duong_dan[:min(200, vị_trí_dấu_hỏi)]` ở cả hai lối), nên một bài đo canh thứ tự sẽ
    xanh với mọi cách cài — đúng định nghĩa bài đo rỗng. Xem `chuan_hoa_duong_dan`.

    Cái bài này ghim là hai chuyện đo được: **cắt đúng trần**, và **không còn query**.
    """
    than = "/m/" + "x" * 400
    r = goi({"duong_dan": f"{than}?utm_source=y", "user_agent": "x"})
    assert r.status_code == 200

    hang = LuotXem.objects.get()
    assert len(hang.duong_dan) == DAI_TOI_DA_DUONG_DAN
    assert hang.duong_dan == than[:DAI_TOI_DA_DUONG_DAN]
    assert "utm_source" not in hang.duong_dan


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_ua_thieu_han_van_ghi_duoc_va_tinh_la_bot():
    """Thân không có `user_agent` ⇒ mặc định `""` ⇒ `"khác"`, không nổ."""
    r = goi({"duong_dan": "/"})
    assert r.status_code == 200
    hang = LuotXem.objects.get()
    assert hang.la_bot is True
    assert hang.ten_bot == "khác"


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_dau_gach_cuoi_KHONG_de_ra_dong_thu_hai():
    """`/m/abc-1/` và `/m/abc-1` là CÙNG một trang — phải ra cùng một `duong_dan`.

    Next trả 308 từ dạng có dấu `/` sang dạng không, và middleware chạy cho **cả hai**
    request ⇒ hai hàng, hai dòng riêng trong bảng "xem nhiều nhất", một lượt xem đếm
    thành hai. Không sai chức năng, chỉ sai số — và sai theo kiểu không ai nhìn ra, vì
    hai dòng trông như hai trang khác nhau. Lượt phản biện 2026-08-27 tìm ra.
    """
    for d in ("/m/abc-1", "/m/abc-1/", "/m/abc-1//"):
        assert goi({"duong_dan": d, "user_agent": "Chrome/131"}).status_code == 200
    assert LuotXem.objects.filter(duong_dan="/m/abc-1").count() == 3
    assert LuotXem.objects.exclude(duong_dan="/m/abc-1").count() == 0

    # Trang chủ là ngoại lệ: bỏ dấu `/` của nó thì còn chuỗi rỗng.
    assert goi({"duong_dan": "/", "user_agent": "Chrome/131"}).status_code == 200
    assert LuotXem.objects.filter(duong_dan="/").count() == 1


# ===========================================================================
# Nhóm K — khách/ngày · nguồn · trình duyệt/thiết bị (2026-08-30)
# ===========================================================================
#
# Bốn cột mới đều là DẪN XUẤT: chúng đi vào DB, còn IP và UA thì không. Mọi bài dưới đây
# đo đúng hai chuyện — cột mới mang đúng giá trị, và cột thô vẫn không tồn tại.

UA_CHROME_WIN = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/131.0.0.0 Safari/537.36"
)
UA_SAFARI_IPHONE = (
    "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 "
    "(KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1"
)


# --- Bất biến riêng tư (plan §0) ---------------------------------------------


def test_R0_1_TAP_COT_cua_LuotXem_bi_GHIM(db):
    """§0.1 — ghim ĐÚNG TẬP tên cột. Thêm một cột lạ là bài này đỏ.

    So `set` chứ không so `>=`: một cột `ip` hay `user_agent` thêm vào ở lượt sau sẽ không
    làm hỏng bài đo nào khác (mọi thứ vẫn 200), và nó chính là thứ toàn bộ cơ chế này
    được thiết kế để không có. Danh sách dưới đây là **cam kết**, không phải ảnh chụp.
    """
    cot = {f.attname for f in LuotXem._meta.get_fields() if f.concrete}
    assert cot == {
        "id",
        "duong_dan",
        "luc",
        "la_bot",
        "ten_bot",
        "khach",
        "nguon",
        "trinh_duyet",
        "thiet_bi",
        # 2026-08-31. ⚠ Cột này ĐI QUA hàng rào trên có chủ đích, và đó là chỗ phải đọc
        # kỹ: nó là MỘT BIT ("request có mang cookie tên `sessionid`"), không phải một
        # danh tính. Cam kết của §0 giữ nguyên — thêm `user_id` hay `username` vào đây
        # là một quyết định KHÁC, phải hỏi lại user và sửa `PLAN.md`, chứ không phải
        # bước tiếp theo tự nhiên của dòng này.
        "da_dang_nhap",
    }


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_R0_3_referer_MANG_KHOA_BI_MAT_chi_con_ten_mien_va_thanh_rong():
    """§0.3 — referer từ trang đặt lại mật khẩu KHÔNG được để lại dấu vết nào.

    `/dat-lai-mat-khau/{key}` mang một khoá còn sống ngay trên đường dẫn, và mọi link bấm
    từ trang ấy gửi kèm `Referer:` đầy đủ. Hai lớp cùng chặn: chỉ hostname được giữ, **và**
    hostname của chính site quy về `""`.

    Đo bằng cách quét MỌI cột chuỗi của hàng vừa ghi — không bằng cách kiểm `nguon == ""`:
    vế thứ hai xanh cả khi khoá rơi vào một cột khác.
    """
    khoa = "Nw-1wxoxp-pfQvE2hRkhoabimatKHONGDUOCLUU"
    goi(
        {
            "duong_dan": "/",
            "user_agent": UA_CHROME_WIN,
            "referer": f"http://localhost:3000/dat-lai-mat-khau/{khoa}",
        }
    )
    hang = LuotXem.objects.get()
    gia_tri = [str(getattr(hang, f.attname)) for f in LuotXem._meta.get_fields() if f.concrete]
    assert not any(khoa in v for v in gia_tri), gia_tri
    assert not any("dat-lai-mat-khau" in v for v in gia_tri), gia_tri
    # …và referer nội bộ ⇒ "trực tiếp / nội bộ", không phải một nguồn tên là chính mình.
    assert hang.nguon == ""


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_R0_4_bon_cot_moi_KHONG_tai_tao_duoc_UA_hay_IP():
    """§0.4 — UA vẫn dùng-rồi-vứt, và IP cũng vậy: không cột nào chứa mảnh nào của chúng.

    Dùng UA và IP mang chuỗi đánh dấu rồi quét mọi cột. `khach` là hash nên nó không thể
    chứa chuỗi ấy — bài này chứng minh **không có đường vòng nào khác**.
    """
    ua = "Mozilla/5.0 (Windows NT 10.0) DUOI-UA-KHONG-DUOC-LUU/1.0"
    ip = "203.0.113.77"
    goi({"duong_dan": "/", "user_agent": ua, "ip": ip, "referer": "https://x.example/a"})
    hang = LuotXem.objects.get()
    gia_tri = [str(getattr(hang, f.attname)) for f in LuotXem._meta.get_fields() if f.concrete]
    assert not any("DUOI-UA-KHONG-DUOC-LUU" in v for v in gia_tri), gia_tri
    assert not any(ip in v for v in gia_tri), gia_tri
    # Nhưng hàng VẪN đo được khách — không lưu ≠ không đếm.
    assert hang.khach != ""


# --- K1: hash khách -----------------------------------------------------------


def test_K1_cung_ngay_cung_ip_ua_ra_CUNG_hash():
    m = "muoi-cua-mot-ngay"
    assert hash_khach(m, "1.2.3.4", UA_CHROME_WIN) == hash_khach(m, "1.2.3.4", UA_CHROME_WIN)


def test_K1b_KHAC_NGAY_thi_khac_hash_du_ip_va_ua_y_het():
    """Ca thử phá §8.3: bỏ muối khỏi hàm băm là bài này đỏ.

    Đây là bất biến làm cả cơ chế "không theo dõi qua ngày" đúng theo nghĩa đen. Không có
    nó thì `khach` là một ID ổn định vĩnh viễn của một cặp (IP, UA) — tức đúng thứ cookie
    theo dõi làm, chỉ khác là không xin phép.
    """
    a = hash_khach("muoi-ngay-1", "1.2.3.4", UA_CHROME_WIN)
    b = hash_khach("muoi-ngay-2", "1.2.3.4", UA_CHROME_WIN)
    assert a != b


def test_K1c_ip_khac_hoac_ua_khac_thi_hash_khac():
    m = "muoi"
    goc = hash_khach(m, "1.2.3.4", UA_CHROME_WIN)
    assert hash_khach(m, "1.2.3.5", UA_CHROME_WIN) != goc
    assert hash_khach(m, "1.2.3.4", UA_SAFARI_IPHONE) != goc


def test_K1d_ca_IP_lan_UA_rong_thi_KHONG_do_duoc_va_ra_chuoi_rong():
    """`""` = "không đo được", KHÔNG phải "một khách chung".

    Gộp mọi hàng không đo được vào một token là bịa ra đúng một khách ma, ngày nào cũng
    có, và không ai nhìn ra vì con số chỉ hơn thật đúng 1.
    """
    assert hash_khach("muoi", "", "") == ""
    # Có MỘT trong hai là đã đo được.
    assert hash_khach("muoi", "1.2.3.4", "") != ""
    assert hash_khach("muoi", "", UA_CHROME_WIN) != ""


def test_K1e_dau_ngan_cach_KHONG_phai_hang_rao_chong_va_cham():
    """Ghim đúng cái hàm băm **không** hứa, để không ai viết một bài đo hứa hộ nó.

    Bản đầu của lượt 2026-08-30 viết bài đo ngược lại (`("1.2","3|4")` ≠ `("1.2|3","4")`)
    và nó đỏ ngay: cả hai nối ra cùng một chuỗi. Ca ấy vô hại — IP không chứa `|`, nên chỉ
    một client tự đặt UA có `|` mới trộn được token của **chính nó**, tức nhiều nhất là tự
    bớt một khách của mình. Chống nó tử tế cần khai độ dài từng phần; không mua được gì.

    Bài này ở lại để nhắc rằng đó là một **đánh đổi đã biết**, không phải một chỗ sót.
    """
    m = "muoi"
    assert hash_khach(m, "1.2", "3|4") == hash_khach(m, "1.2|3", "4")
    # …nhưng hai đầu vào KHÔNG chứa `|` thì vẫn phải tách nhau, và đó là mọi ca thật.
    assert hash_khach(m, "1.2", "34") != hash_khach(m, "1.23", "4")


def test_K1f_hash_dai_dung_32_va_toan_hex():
    h = hash_khach("muoi", "1.2.3.4", UA_CHROME_WIN)
    assert len(h) == 32 and all(c in "0123456789abcdef" for c in h)


# --- K2: muối theo ngày -------------------------------------------------------


@pytest.mark.django_db
def test_K2_muoi_sinh_MOT_lan_moi_ngay_va_on_dinh_trong_ngay():
    hom_nay = ngay_vn()
    m1 = muoi_cua_ngay(hom_nay)
    m2 = muoi_cua_ngay(hom_nay)
    assert m1 == m2 != ""
    assert MuoiNgay.objects.filter(ngay=hom_nay).count() == 1
    assert len(m1) == 64


@pytest.mark.django_db
def test_K2b_cache_chi_giu_DUNG_MOT_ngay():
    """Đổi ngày là thay cả dict — bảng cache không phình, muối cũ không nằm lại RAM."""
    hom_nay = ngay_vn()
    muoi_cua_ngay(hom_nay)
    muoi_cua_ngay(hom_nay - timedelta(days=1))
    assert list(_CACHE_MUOI) == [hom_nay - timedelta(days=1)]


@pytest.mark.django_db
def test_K2d_luot_dau_cua_ngay_HUY_muoi_ngay_cu_ngay_o_duong_ghi():
    """Cam kết "muối bị huỷ khi ngày đóng" không được treo trên MỖI mình cron.

    `gom_luot_xem` cũng xoá muối, nhưng runbook mô tả cron chết là *"bạn sẽ không thấy
    con số sai"* — và cron chết 30 ngày là 30 hàng muối còn sống trong DB, đủ để ai cầm
    được DB dựng lại `sha256(muối|ip|ua)` và nối một người qua từng ngày, tức đúng thứ
    ba dòng cam kết trên màn hình mod nói là không thể. Đường ghi tự huỷ muối cũ ở lượt
    cache-miss đầu tiên của ngày mới; cron còn lại vai trò lưới thứ hai cho ngày không
    có lượt xem nào. Lượt phản biện 2026-08-30 tìm ra.

    Ca thử phá: bỏ dòng `MuoiNgay.objects.filter(ngay__lt=ngay).delete()` trong
    `muoi_cua_ngay` là bài này đỏ.
    """
    hom_nay = ngay_vn()
    MuoiNgay.objects.create(ngay=hom_nay - timedelta(days=1), muoi="m" * 64)
    MuoiNgay.objects.create(ngay=hom_nay - timedelta(days=9), muoi="n" * 64)

    muoi_cua_ngay(hom_nay)

    assert set(MuoiNgay.objects.values_list("ngay", flat=True)) == {hom_nay}


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_K2c_hai_luot_xem_cua_CUNG_mot_khach_trong_ngay_ra_cung_khach():
    """Bất biến ở mức endpoint, không chỉ ở mức hàm băm.

    Hai lượt cùng IP + UA ⇒ một khách; đổi IP ⇒ hai. Không có bài này thì một bản cài
    quên truyền muối (hoặc sinh muối MỚI mỗi lượt) vẫn xanh ở nhóm hàm thuần.
    """
    for d in ("/", "/m/abc-1"):
        goi({"duong_dan": d, "user_agent": UA_CHROME_WIN, "ip": "1.2.3.4"})
    goi({"duong_dan": "/", "user_agent": UA_CHROME_WIN, "ip": "9.9.9.9"})

    khach = set(LuotXem.objects.values_list("khach", flat=True))
    assert LuotXem.objects.count() == 3
    assert len(khach) == 2


# --- K3: nguồn ----------------------------------------------------------------


@pytest.mark.parametrize(
    "referer,mong_doi",
    [
        ("https://www.google.com/search?q=gikky", "google.com"),
        ("https://google.com/", "google.com"),
        ("https://T.CO/abc", "t.co"),
        ("http://m.facebook.com/story?id=1", "m.facebook.com"),
        ("https://vn.tradingview.com/chart/", "vn.tradingview.com"),
        # Rác / không parse ra hostname ⇒ rỗng, không nổ.
        ("", ""),
        ("khong-phai-url", ""),
        ("about:blank", ""),
        ("http://", ""),
        # IPv6 cụt — `urlsplit().hostname` NÉM `ValueError`, không được làm đổ lượt đếm.
        ("http://[::1", ""),
    ],
)
def test_K3_chuan_hoa_nguon_chi_giu_TEN_MIEN(referer, mong_doi):
    assert chuan_hoa_nguon(referer) == mong_doi


def test_K3b_nguon_KHONG_BAO_GIO_mang_path_hay_query():
    """Bất biến mạnh hơn một phép so cứng: không đầu vào nào để lọt `/` hay `?`."""
    for r in (
        "https://vi.wikipedia.org/wiki/Chung-khoan?x=1#y",
        "https://news.example.com/a/b/c",
        "https://a.example.com:8443/duong/dan?q=bi-mat",
    ):
        ra = chuan_hoa_nguon(r)
        assert "/" not in ra and "?" not in ra and "#" not in ra, (r, ra)
        assert ra != ""


def test_K3c_host_cua_CHINH_SITE_ra_rong():
    """Điều hướng nội bộ không phải một "nguồn truy cập" — và referer nội bộ mang bí mật.

    Tập host lấy từ `settings.HEADLESS_FRONTEND_URLS` (đúng nguồn mà chuông đường-bí-mật
    bên Next đang đọc) hợp với `ADMIN_HOSTS`. Hai luật cùng nhìn một chỗ thì không lệch
    được. Vế cuối override CẢ HAI: `ADMIN_HOSTS` mặc định của dev chứa `localhost`, nên
    muốn thấy `localhost` như một nguồn "ngoài" thì phải rút nó khỏi cả hai danh sách.
    """
    assert chuan_hoa_nguon("http://localhost:3000/m/abc-1") == ""
    assert chuan_hoa_nguon("http://localhost:3000/") == ""
    # …và đổi cấu hình là tập host đổi theo, ngay trong cùng tiến trình.
    with override_settings(
        HEADLESS_FRONTEND_URLS={"x": "https://gikky.net/xac-thuc-email/{key}"},
        ADMIN_HOSTS=["admin.gikky.net"],
    ):
        assert chuan_hoa_nguon("https://gikky.net/m/abc-1") == ""
        assert chuan_hoa_nguon("https://www.gikky.net/m/abc-1") == ""
        assert chuan_hoa_nguon("http://localhost:3000/") == "localhost"


def test_K3c2_host_khu_quan_tri_cung_la_NOI_BO_khong_phai_nguon():
    """Mod bấm link từ admin sang site công khai là điều hướng nội bộ.

    Thiếu vế này thì `admin.gikky.net` leo vào bảng "Nguồn truy cập" như một site bên
    ngoài dẫn người tới — số liệu bẩn tự mình sinh ra. `ADMIN_HOSTS` mang dạng
    `host[:port]` chứ không phải URL (xem `config/settings.py`), nên dạng có port cũng
    phải quy về `""` — `urlsplit().hostname` của referer không bao giờ mang port.
    Lượt phản biện 2026-08-30 tìm ra.
    """
    with override_settings(
        ADMIN_HOSTS=["admin.gikky.net", "quan-tri.gikky.net:8443"]
    ):
        assert chuan_hoa_nguon("https://admin.gikky.net/luot-xem") == ""
        assert chuan_hoa_nguon("https://www.admin.gikky.net/x") == ""
        assert chuan_hoa_nguon("https://quan-tri.gikky.net/x") == ""
    # Rút khỏi danh sách thì nó lại là một nguồn thật — tập host đọc TẠI THỜI ĐIỂM GỌI.
    with override_settings(ADMIN_HOSTS=[]):
        assert chuan_hoa_nguon("https://admin.gikky.net/luot-xem") == "admin.gikky.net"


def test_K3d_ten_mien_dai_bi_CAT_chu_khong_lam_do_luot_dem():
    dai = "a" * 300 + ".example.com"
    ra = chuan_hoa_nguon(f"https://{dai}/x")
    assert len(ra) == DAI_TOI_DA_NGUON


# --- K4: đường ghi ghi đủ bốn cột --------------------------------------------


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_K4_luot_NGUOI_ghi_du_trinh_duyet_va_thiet_bi():
    goi(
        {
            "duong_dan": "/m/abc-1",
            "user_agent": UA_SAFARI_IPHONE,
            "ip": "1.2.3.4",
            "referer": "https://www.google.com/search?q=gikky",
        }
    )
    hang = LuotXem.objects.get()
    assert hang.la_bot is False
    assert hang.trinh_duyet == "safari"
    assert hang.thiet_bi == "di_dong"
    assert hang.nguon == "google.com"
    assert hang.khach != ""


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_K4b_luot_BOT_de_trinh_duyet_va_thiet_bi_RONG():
    """Một con bot khai UA của Chrome không được leo vào bảng "người đọc bằng gì".

    Đây là ca thật, không phải giả thuyết: `HeadlessChrome` mang nguyên UA của Chrome trên
    Linux. Ghi `trinh_duyet="chrome"` cho nó là trộn lưu lượng máy vào đúng bảng sinh ra
    để đo người.
    """
    goi(
        {
            "duong_dan": "/",
            "user_agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "HeadlessChrome/131.0.0.0 Safari/537.36",
            "ip": "1.2.3.4",
        }
    )
    hang = LuotXem.objects.get()
    assert hang.la_bot is True
    assert hang.trinh_duyet == ""
    assert hang.thiet_bi == ""
    # …nhưng `khach` VẪN được tính: phía đọc lọc bot bằng `la_bot`, không bằng cột rỗng.
    assert hang.khach != ""


# --- K5: THÂN CŨ vẫn chạy (cửa sổ deploy lệch) --------------------------------


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_K5_than_CU_hai_truong_van_200_va_VAN_GHI():
    """Deploy không nguyên tử: Django mới + middleware CŨ, trong vài phút.

    Bắt buộc `ip`/`referer` là mọi lượt xem trong cửa sổ ấy trả 422 và **biến mất im
    lặng** — middleware `.catch(() => {})` nuốt hết lỗi, nên không có gì báo ngoài một
    khoảng trống trong biểu đồ mà không ai giải thích được ba tháng sau.
    """
    r = goi({"duong_dan": "/m/abc-1", "user_agent": UA_CHROME_WIN})
    assert r.status_code == 200, r.content
    assert r.json() == {"da_dem": True}

    hang = LuotXem.objects.get()
    assert hang.duong_dan == "/m/abc-1"
    # Khách vẫn đo được — từ UA thôi, vì IP rỗng. Thô hơn, nhưng không phải không có.
    assert hang.khach != ""
    assert hang.khach == hash_khach(muoi_cua_ngay(ngay_vn()), "", UA_CHROME_WIN)
    assert hang.nguon == ""
    assert hang.trinh_duyet == "chrome"


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_K5b_than_TRAN_chi_co_duong_dan_van_200():
    """Ba trường sau đều có mặc định. Không đo được khách ⇒ `""`, không phải một khách ma."""
    r = goi({"duong_dan": "/"})
    assert r.status_code == 200
    hang = LuotXem.objects.get()
    assert hang.khach == ""
    assert hang.nguon == ""


# ===========================================================================
# Nhóm N — cờ `da_dang_nhap` (2026-08-31, `plans/2026-08-31-modal-online.md` §1)
# ===========================================================================
#
# Tiêu chí N2 của plan: **body CÓ cờ ⇒ ghi True; body CŨ KHÔNG có cờ ⇒ 200 + False**.
# Vế thứ hai là vế đắt: nó là cùng đúng cửa sổ deploy mà `test_K5` đã đóng cho `ip`/
# `referer`, và hỏng theo cùng một kiểu — 422, middleware `.catch(() => {})`, lượt xem
# biến mất không một dòng log.


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_N2_co_co_trong_than_thi_ghi_True():
    r = goi({"duong_dan": "/", "user_agent": UA_CHROME_WIN, "da_dang_nhap": True})
    assert r.status_code == 200, r.content
    assert LuotXem.objects.get().da_dang_nhap is True


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_N2b_co_False_tuong_minh_van_ghi_False():
    goi({"duong_dan": "/", "user_agent": UA_CHROME_WIN, "da_dang_nhap": False})
    assert LuotXem.objects.get().da_dang_nhap is False


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_N2c_than_CU_khong_co_co_van_200_va_ghi_False():
    """⚠ Bài đo của cửa sổ deploy. `apps/web` cũ gửi bốn trường, không có cờ này.

    Mặc định `False` là câu trả lời đúng cho "không biết": nó nói *"không thấy cookie
    phiên"*, và với một middleware chưa gửi cờ thì đúng là chưa thấy gì cả. Ca này tự
    lành sau 5 phút — cửa sổ online ngắn hơn mọi lượt deploy.
    """
    r = goi({"duong_dan": "/", "user_agent": UA_CHROME_WIN, "ip": "203.0.113.9"})
    assert r.status_code == 200, r.content
    assert r.json() == {"da_dem": True}
    assert LuotXem.objects.get().da_dang_nhap is False


@pytest.mark.django_db
@override_settings(DEM_LUOT_XEM_SECRET=SECRET)
def test_N2d_co_KHONG_lam_ro_ri_danh_tinh_nao():
    """Một bit, và đúng một bit: bật cờ không được kéo theo gì gắn với một con người.

    Quét mọi cột như `test_R0_4`. Bài này là hàng rào của câu *"cột mới không lật cam kết
    riêng tư"* — nếu ai đó thêm `username`/`user_id` vào thân request rồi lưu, bài này
    không đỏ (nó chỉ quét chuỗi đã gửi), nhưng `test_R0_1` sẽ đỏ vì tập cột đổi. Hai bài
    bù nhau; đừng bỏ bài nào.
    """
    goi(
        {
            "duong_dan": "/",
            "user_agent": UA_CHROME_WIN,
            "ip": "203.0.113.9",
            "da_dang_nhap": True,
        }
    )
    hang = LuotXem.objects.get()
    gia_tri = [str(getattr(hang, f.attname)) for f in LuotXem._meta.get_fields() if f.concrete]
    assert not any("203.0.113.9" in v for v in gia_tri), gia_tri
    assert not any("Chrome/131" in v for v in gia_tri), gia_tri
