"""Bảy phép kiểm của bề mặt nhận ảnh — `core/anh.py`. Phase 5, tiêu chí A2/A4/A5/A6.

Đo thẳng hàm thuần, **không qua HTTP và không chạm DB**: mọi thứ ở đây là câu hỏi về
byte, và một bài đo đi qua Django test client chỉ thêm ba lớp có thể hỏng vì lý do khác.
Phép kiểm 7 (trần 10 ảnh) là câu hỏi về khoá hàng, nên nó nằm ở `test_api_anh.py`.

Bốn ca tấn công ở đây đều là ca THẬT, không phải ca tưởng tượng:
`.php`/`.html`/`.svg` đổi đuôi · polyglot JPEG+HTML · bom giải nén · EXIF rò rỉ vị trí.
"""

import time

import pytest
from PIL import Image
from PIL.ExifTags import IFD, Base as TheEXIF

from core.anh import (
    ANH_HONG,
    ANH_QUA_LON,
    ANH_QUA_NANG,
    BYTE_TOI_DA,
    CANH_THUMB,
    CANH_TOI_DA,
    DINH_DANG_KHONG_NHAN,
    PIXEL_TOI_DA,
    LoiAnh,
    xu_ly_anh_tai_len,
)

from ._anh import (
    HTML_GIA_JPG,
    PHP_GIA_JPG,
    SVG_GIA_JPG,
    anh_byte,
    anh_nhieu,
    bom_png_khai_khong,
    bom_png_that,
    polyglot_jpeg_html,
)


def _mo(du_lieu: bytes) -> Image.Image:
    import io

    return Image.open(io.BytesIO(du_lieu))


# --- Phép kiểm 1: kích thước byte --------------------------------------------


def test_1_anh_vuot_tran_byte_bi_tu_choi():
    with pytest.raises(LoiAnh) as e:
        xu_ly_anh_tai_len(b"\xff\xd8\xff" + b"x" * BYTE_TOI_DA)
    assert e.value.ma == ANH_QUA_NANG


def test_1_chan_TRUOC_khi_doc_noi_dung():
    """Trần byte phải chặn cả **rác thuần** — tức nó chạy trước mọi phép nhận dạng.

    Nếu phép kiểm 1 nằm sau `Image.open`, ca này ra `anh_hong`: đúng là từ chối, nhưng
    từ chối SAU khi đã đưa 9MB rác qua bộ giải mã ảnh. Mã lỗi là thứ duy nhất phân biệt
    được hai thứ tự ấy từ bên ngoài.
    """
    with pytest.raises(LoiAnh) as e:
        xu_ly_anh_tai_len(b"\x00" * (BYTE_TOI_DA + 1))
    assert e.value.ma == ANH_QUA_NANG


def test_1_file_rong():
    with pytest.raises(LoiAnh) as e:
        xu_ly_anh_tai_len(b"")
    assert e.value.ma == ANH_HONG


# --- Phép kiểm 2 + 3: nhận dạng bằng NỘI DUNG, allowlist ---------------------


@pytest.mark.parametrize(
    "ten,du_lieu",
    [("php", PHP_GIA_JPG), ("html", HTML_GIA_JPG), ("svg", SVG_GIA_JPG)],
)
def test_2_file_khong_phai_anh_doi_duoi_jpg_bi_tu_choi(ten, du_lieu):
    """A5. Ba file này đều **tên là `.jpg`** và đều được gửi kèm `Content-Type: image/jpeg`.

    Không phép kiểm nào ở đây nhìn tên hay `Content-Type` — cả hai do client soạn. Thứ
    từ chối chúng là `Image.open` không nhận ra định dạng nào trong nội dung.
    """
    with pytest.raises(LoiAnh) as e:
        xu_ly_anh_tai_len(du_lieu)
    assert e.value.ma == ANH_HONG


def test_3_gif_bi_tu_choi_du_la_anh_that():
    """GIF là ảnh THẬT và mở được — nó bị chặn bởi **allowlist**, không bởi phép nhận dạng.

    Bài đo này là thứ phân biệt allowlist với blocklist: một blocklist ("cấm svg, cấm
    php") cho GIF đi qua, rồi cho cả `.ico`, `.tiff`, `.pdf` mà Pillow cũng mở được.
    """
    with pytest.raises(LoiAnh) as e:
        xu_ly_anh_tai_len(anh_byte(dinh_dang="GIF"))
    assert e.value.ma == DINH_DANG_KHONG_NHAN


@pytest.mark.parametrize("dinh_dang,duoi", [("JPEG", ".jpg"), ("PNG", ".png"), ("WEBP", ".webp")])
def test_3_ba_dinh_dang_trong_allowlist_deu_qua(dinh_dang, duoi):
    ra = xu_ly_anh_tai_len(anh_byte(dinh_dang=dinh_dang))
    assert ra.dinh_dang == dinh_dang and ra.duoi == duoi


def test_3_duoi_suy_tu_NOI_DUNG_chu_khong_tu_ten_client_gui():
    """Phép kiểm 6, vế "đuôi": một PNG gửi kèm tên `.jpg` phải ra `.png`.

    Đuôi quyết định `Content-Type` mà Caddy `file_server` trả về. Để client chọn đuôi là
    để client chọn cách trình duyệt diễn giải file — `nosniff` không cứu được, vì nó chỉ
    cấm ĐOÁN khác đi chứ không cấm cái `Content-Type` server đã tuyên bố.
    """
    ra = xu_ly_anh_tai_len(anh_byte(dinh_dang="PNG"))
    assert ra.duoi == ".png" and ra.content_type == "image/png"


# --- Phép kiểm 4: bom giải nén ------------------------------------------------


def test_4_bom_khai_kich_thuoc_khong_lo_bi_chan_o_HEADER():
    """A6. 60000×60000 = 3,6 **tỉ** pixel, trong một file vài chục byte.

    Nếu phép kiểm này không có: Pillow cấp phát ~10GB lúc decode và tiến trình chết. Bài
    đo chạy nhanh chính là bằng chứng — không có lần decode nào xảy ra.
    """
    truoc = time.monotonic()
    with pytest.raises(LoiAnh) as e:
        xu_ly_anh_tai_len(bom_png_khai_khong(60_000, 60_000))
    assert e.value.ma == ANH_QUA_LON
    assert time.monotonic() - truoc < 2, "chậm thế này là đã decode thật rồi"


def test_4_anh_that_vuot_tran_pixel_bi_chan_boi_TRAN_CUA_TA():
    """Ca giữa: Pillow cho qua (dưới `MAX_IMAGE_PIXELS` mặc định ~89 triệu), ta chặn.

    Đây là bài đo cho `PIXEL_TOI_DA`, không phải cho hàng rào sẵn có của Pillow — file
    hoàn toàn hợp lệ, `verify()` sạch, chỉ là to hơn mọi ảnh máy ảnh dân dụng chụp được.
    Nó cũng đúng nghĩa bom giải nén: vài KB trên đĩa, 64 triệu pixel khi giải.
    """
    canh = 8_000
    du_lieu = bom_png_that(canh)
    assert canh * canh > PIXEL_TOI_DA
    assert len(du_lieu) < 200_000, "phải là file NHỎ mới gọi là bom giải nén"
    with pytest.raises(LoiAnh) as e:
        xu_ly_anh_tai_len(du_lieu)
    assert e.value.ma == ANH_QUA_LON


# --- Phép kiểm 5: TÁI MÃ HOÁ ---------------------------------------------------


def test_5_polyglot_jpeg_cong_html_bi_tai_ma_hoa_thanh_vo_hai():
    """A5, vế polyglot. Ảnh vào là JPEG **hợp lệ** — nó không bị từ chối, nó bị VÔ HIỆU HOÁ.

    Đây là phép kiểm duy nhất trong bảy phép làm được việc này: không phép nhận dạng nào
    từ chối được file này (phần đầu đúng là JPEG thật), và không phép kiểm nào tìm được
    "đuôi lạ" mà không biến thành một bản chống virus viết tay.
    """
    vao = polyglot_jpeg_html()
    assert b"<script>" in vao, "mồi phải thật thì bài đo mới có nghĩa"
    ra = xu_ly_anh_tai_len(vao)
    assert b"<script>" not in ra.byte_chinh
    assert b"<script>" not in ra.byte_thumb
    assert b"alert" not in ra.byte_chinh


def test_5_byte_ra_KHAC_byte_vao_ke_ca_khi_anh_da_nho_va_sach():
    """Ảnh nhỏ, sạch, đúng định dạng — **vẫn phải** được mã hoá lại.

    Bài đo này tồn tại để chặn đúng một "tối ưu hoá" mà người sau sẽ thấy hợp lý: *"ảnh
    đã dưới `CANH_TOI_DA` rồi thì ghi thẳng byte gốc cho nhanh"*. Làm thế là polyglot và
    EXIF quay lại cùng một lúc, và không bài đo nào khác đỏ.
    """
    vao = anh_byte(dinh_dang="JPEG", kich_thuoc=(50, 40))
    ra = xu_ly_anh_tai_len(vao)
    assert ra.byte_chinh != vao


def test_5_exif_bi_xoa_sach_khoi_anh_da_luu():
    """A4, vế hai: ảnh đã lưu **không còn EXIF**.

    EXIF mang GPS, số máy, phần mềm chỉnh sửa. Một tấm ảnh chụp ở nhà đăng lên diễn đàn
    tài chính không được kèm toạ độ nhà.
    """
    vao = anh_byte(dinh_dang="JPEG", ngay_chup="2024:03:15 14:30:00")
    assert _mo(vao).getexif().get_ifd(IFD.Exif).get(TheEXIF.DateTimeOriginal)

    ra = xu_ly_anh_tai_len(vao)
    exif_sau = _mo(ra.byte_chinh).getexif()
    assert not exif_sau.get_ifd(IFD.Exif).get(TheEXIF.DateTimeOriginal)
    assert not exif_sau, f"EXIF phải rỗng hoàn toàn, còn: {dict(exif_sau)}"


def test_5_ngay_chup_doc_duoc_TRUOC_khi_exif_bi_xoa():
    """A4, vế một: server đọc đúng `DateTimeOriginal` **từ file gốc**.

    Lệch PLAN 8.5 có chủ đích (client đọc bằng exifr rồi gửi kèm). Vế "server đọc" đáng
    tin hơn hẳn: không phụ thuộc client trung thực, và không có chuyện hai bên bất đồng
    về cùng một tấm ảnh. Hai vế của A4 phải đúng CÙNG LÚC — đọc được, rồi xoá sạch.
    """
    ra = xu_ly_anh_tai_len(anh_byte(dinh_dang="JPEG", ngay_chup="2024:03:15 14:30:00"))
    assert ra.exif_taken_at is not None
    assert (ra.exif_taken_at.year, ra.exif_taken_at.month, ra.exif_taken_at.day) == (
        2024,
        3,
        15,
    )
    assert (ra.exif_taken_at.hour, ra.exif_taken_at.minute) == (14, 30)
    # Giờ VN, không phải UTC — lệch 7 tiếng là ảnh chụp 3 giờ chiều hoá ra 8 giờ tối.
    assert ra.exif_taken_at.utcoffset().total_seconds() == 7 * 3600


def test_5_anh_khong_co_exif_thi_ngay_chup_la_None_chu_khong_no():
    assert xu_ly_anh_tai_len(anh_byte(dinh_dang="PNG")).exif_taken_at is None


def test_5_exif_ngay_rac_khong_lam_hong_ca_luot_tai_len():
    """EXIF là dữ liệu người lạ soạn — một trường ngày hỏng không được chặn cả tấm ảnh."""
    ra = xu_ly_anh_tai_len(anh_byte(dinh_dang="JPEG", ngay_chup="khong-phai-ngay"))
    assert ra.exif_taken_at is None
    assert ra.byte_chinh


def test_5_anh_lon_bi_thu_ve_CANH_TOI_DA_va_thumbnail_nho_hon():
    ra = xu_ly_anh_tai_len(anh_byte(dinh_dang="JPEG", kich_thuoc=(4000, 3000)))
    assert max(ra.w, ra.h) == CANH_TOI_DA
    assert ra.w == CANH_TOI_DA and ra.h == CANH_TOI_DA * 3 // 4
    thumb = _mo(ra.byte_thumb)
    assert max(thumb.size) == CANH_THUMB


def test_5_png_trong_suot_qua_duoc_va_giu_dinh_dang():
    """PNG có alpha không bị ép sang JPEG — `_phang` chỉ chạy cho JPEG."""
    ra = xu_ly_anh_tai_len(anh_byte(dinh_dang="PNG", mau=(255, 0, 0, 0)))
    assert ra.dinh_dang == "PNG"
    assert _mo(ra.byte_chinh).mode in ("RGBA", "LA", "P")


def test_5_anh_cut_duoi_bi_tu_choi_chu_khong_no_500():
    """Header đúng, thân cụt — `verify()` hoặc lúc decode mới lộ. Phải là lỗi 400, không 500."""
    vao = anh_byte(dinh_dang="PNG")
    with pytest.raises(LoiAnh) as e:
        xu_ly_anh_tai_len(vao[: len(vao) // 2])
    assert e.value.ma == ANH_HONG


# --- A2: ảnh 8MB xử lý ≤ 5 giây ----------------------------------------------


def test_A2_anh_8MB_xu_ly_duoi_5_giay():
    """Tiêu chí PLAN mục 10, đo THẬT trên ảnh nhiễu ~8MB (không nén được).

    Con số in ra là con số của máy dev; ngưỡng 5s là ngưỡng PLAN hứa.
    """
    # ~4,1 byte/pixel với ảnh nhiễu ở quality=100 + subsampling=0, nên 1,87 triệu pixel
    # ra ~7,7MB: sát trần 8MB mà không vượt (vượt thì phép kiểm 1 từ chối, và bài đo đo
    # nhầm chuyện khác).
    du_lieu = anh_nhieu((1560, 1200))
    assert 6_500_000 < len(du_lieu) <= BYTE_TOI_DA, f"mồi {len(du_lieu)} byte"

    truoc = time.monotonic()
    ra = xu_ly_anh_tai_len(du_lieu)
    mat = time.monotonic() - truoc
    # ASCII thuần: console Windows mặc định cp1252, và `pytest -s` in thẳng ra đó —
    # một chữ có dấu ở đây làm bài đo ĐỎ vì `UnicodeEncodeError`, không vì ảnh.
    print(f"\nA2: {len(du_lieu) / 1024 / 1024:.1f}MB xu ly trong {mat:.2f}s")
    assert mat < 5, f"xử lý mất {mat:.2f}s, PLAN hứa ≤5s"
    assert ra.byte_chinh and ra.byte_thumb
