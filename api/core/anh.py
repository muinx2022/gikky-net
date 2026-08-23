"""Nhận, kiểm và TÁI MÃ HOÁ ảnh người dùng tải lên — PLAN 8.5, Phase 5.

Đây là **bề mặt nhận file từ internet**, chỗ dễ sai nhất và đắt nhất của cả phase. Mọi
byte đi qua đây đều do người lạ soạn ra, và ba thứ mà người lạ điều khiển được — **tên
file**, **`Content-Type`**, **phần mở rộng** — đều KHÔNG được dùng để quyết định gì.

Bảy phép kiểm, đúng thứ tự này, và thứ tự là một phần của phép kiểm:

1. **Kích thước byte** — chặn TRƯỚC khi đọc gì. Một phép kiểm đứng sau `Image.open`
   không bảo vệ được cái nó định bảo vệ.
2. **Nhận dạng bằng NỘI DUNG** — `Image.open` + `verify()` đọc magic bytes/header. File
   `.php` đổi tên thành `.jpg` chết ở đây, không phải ở một phép kiểm đuôi file nào.
3. **Allowlist định dạng** — JPEG · PNG · WebP. Allowlist chứ không blocklist. Không GIF
   (ảnh động), không SVG (SVG là **XML**, nó chạy `<script>` khi trình duyệt mở trực
   tiếp — mà Caddy phục vụ file này thẳng từ đĩa, cùng origin với phiên đăng nhập).
4. **Chống bom giải nén** — kiểm `w × h` từ HEADER, trước khi decode. Một PNG 4KB khai
   64000×64000 giải ra hơn 15 tỉ pixel; không có phép kiểm này thì một request làm hết
   RAM của cả tiến trình.
5. **TÁI MÃ HOÁ mọi ảnh** — không bao giờ ghi lại byte của client. Đây là phép kiểm làm
   được HAI việc cùng lúc mà không phép kiểm nào khác làm được: nó vô hiệu hoá file đa
   định dạng (polyglot JPEG+HTML — phần đuôi HTML đơn giản không có mặt trong ảnh mới),
   và nó xoá sạch EXIF/ICC/GPS. Đọc `DateTimeOriginal` **trước** bước này, vì sau thì
   không còn gì để đọc.
6. **Tên file ngẫu nhiên** — `uuid4`, đuôi suy từ định dạng ĐÃ NHẬN DẠNG ở bước 3. Tên
   client gửi không bao giờ chạm tới đường dẫn (đó là `core/anh_luu.py::khoa_moi`).
7. **Trần 10 ảnh/mốc** — không ở đây: nó phải enforce **trong khoá hàng `Moc`**, xem
   `core/ghi.py::them_anh_moc`. Đếm ngoài khoá là lỗi `L11` vừa tìm ra ở hạn mức mốc.

Vì sao EXIF đọc ở SERVER chứ không ở client (lệch PLAN 8.5, chốt 2026-08-23): PLAN cho
client đọc `DateTimeOriginal` bằng exifr trước khi resize, rồi gửi kèm lúc `confirm`.
Server cầm file gốc rồi thì đọc thẳng đáng tin hơn hẳn — không phụ thuộc client trung
thực, và không có chuyện client với server bất đồng về cùng một tấm ảnh.
"""

from __future__ import annotations

import io
import warnings
from dataclasses import dataclass
from datetime import datetime

from PIL import Image, ImageOps, UnidentifiedImageError
from PIL.ExifTags import IFD, Base as TheEXIF

from core.thoi_gian import TZ_VN

#: Trần byte của một ảnh. PLAN mục 10 lấy "ảnh 8MB xử lý ≤5s" làm tiêu chí nghiệm thu,
#: nên 8MB là con số sản phẩm đã hứa xử lý được — trần đặt đúng ở đó.
BYTE_TOI_DA = 8 * 1024 * 1024

#: Trần pixel (`w × h`) đọc từ HEADER. 50 triệu pixel là ~8000×6000, rộng hơn mọi máy
#: ảnh dân dụng; ảnh thật không chạm tới, còn bom giải nén thì vượt nó vài trăm lần.
PIXEL_TOI_DA = 50_000_000

#: Cạnh dài nhất của ảnh đã lưu. Ảnh to hơn bị thu nhỏ — trang mạch là nơi để đọc, không
#: phải kho ảnh gốc, và một tấm 6000px làm hỏng đúng cái Lighthouse của PLAN mục 10.
CANH_TOI_DA = 2048
#: Cạnh dài nhất của thumbnail trong gallery.
CANH_THUMB = 480

#: Allowlist định dạng (phép kiểm 3): tên Pillow → đuôi file → `Content-Type`.
#:
#: `Content-Type` ghi ở đây vì prod phục vụ file bằng Caddy `file_server`, vốn đoán kiểu
#: theo **đuôi file**. Đuôi ở đây là đuôi ta tự đặt từ định dạng đã nhận dạng, nên hai
#: cột này không bao giờ lệch nhau được.
DINH_DANG_CHO_PHEP: dict[str, tuple[str, str]] = {
    "JPEG": (".jpg", "image/jpeg"),
    "PNG": (".png", "image/png"),
    "WEBP": (".webp", "image/webp"),
}

#: Ảnh nặng quá trần byte. 413.
ANH_QUA_NANG = "anh_qua_nang"
#: Không mở được như ảnh, hoặc header hỏng. 400.
ANH_HONG = "anh_hong"
#: Mở được nhưng định dạng không nằm trong allowlist. 400.
DINH_DANG_KHONG_NHAN = "dinh_dang_khong_nhan"
#: `w × h` vượt trần — bom giải nén, hoặc ảnh thật to bất thường. 400.
ANH_QUA_LON = "anh_qua_lon"


class LoiAnh(Exception):
    """Ảnh không qua được một phép kiểm. `ma` là mã lỗi API, `detail` là câu tiếng Việt.

    Ném `Exception` thuần chứ không `LoiGhi` của tầng API: module này là **core**, nó
    không được biết gì về HTTP. Tầng `api/anh.py` dịch sang status code — cùng lối mà
    `core/ghi.py` để tầng API dịch `ValidationError`.
    """

    def __init__(self, ma: str, detail: str) -> None:
        self.ma = ma
        self.detail = detail
        super().__init__(detail)


@dataclass(frozen=True)
class AnhDaXuLy:
    """Kết quả của bảy phép kiểm: byte SẠCH, đã tái mã hoá, sẵn sàng ghi xuống đĩa.

    `byte_chinh`/`byte_thumb` là byte do **Pillow sinh ra**, không phải byte client gửi.
    Đó là điểm mấu chốt của phép kiểm 5 — nếu một ngày ai đó "tối ưu" bằng cách ghi
    thẳng `du_lieu` gốc khi ảnh đã đủ nhỏ, polyglot và EXIF quay lại cùng lúc.
    """

    dinh_dang: str
    duoi: str
    content_type: str
    byte_chinh: bytes
    byte_thumb: bytes
    w: int
    h: int
    exif_taken_at: datetime | None


def _doc_ngay_chup(anh: Image.Image) -> datetime | None:
    """EXIF `DateTimeOriginal` của ảnh GỐC, dời sang giờ VN. `None` nếu không có/hỏng.

    Phải gọi **trước** khi tái mã hoá (phép kiểm 5 xoá sạch EXIF). Không bao giờ ném:
    EXIF là dữ liệu người lạ soạn, một trường ngày hỏng không được làm hỏng cả lượt
    upload — ảnh vẫn lên, chỉ là không có ngày chụp gợi ý.

    EXIF không mang múi giờ (chuẩn EXIF 2.3 mới có `OffsetTimeOriginal`, máy ảnh thường
    bỏ trống). Giả định giờ VN là giả định đúng cho người dùng của sản phẩm này, và nó
    được nói ra ở đây thay vì để `USE_TZ` âm thầm gắn UTC — lệch 7 tiếng thì một tấm ảnh
    chụp 3 giờ chiều hoá ra chụp 8 giờ tối.
    """
    try:
        exif = anh.getexif()
        if not exif:
            return None
        tho = exif.get_ifd(IFD.Exif).get(TheEXIF.DateTimeOriginal)
        if not tho:
            return None
        # Chuẩn EXIF: "YYYY:MM:DD HH:MM:SS".
        ngay = datetime.strptime(str(tho).strip(), "%Y:%m:%d %H:%M:%S")
        return ngay.replace(tzinfo=TZ_VN)
    except (ValueError, TypeError, KeyError, OSError, AttributeError):
        return None


def _mo_an_toan(du_lieu: bytes) -> Image.Image:
    """`Image.open` với bom giải nén được biến thành `LoiAnh`, không thành cảnh báo.

    Pillow có sẵn hai mức: `> MAX_IMAGE_PIXELS` chỉ **cảnh báo**
    (`DecompressionBombWarning`), `> 2 × MAX_IMAGE_PIXELS` mới **ném**
    (`DecompressionBombError`). Mức cảnh báo là mức nguy hiểm: ở prod nó chỉ ghi một
    dòng log rồi decode tiếp, còn dưới `pytest` (`filterwarnings = ["error"]`) nó lại
    ném — tức hành vi ở hai môi trường KHÁC NHAU, và bài đo xanh không nói được gì về
    prod.

    Nên: ép cảnh báo thành lỗi **trong đúng khối này**, cho cả hai môi trường. Đây là lý
    do `api/pyproject.toml` không cần thêm dòng `ignore` nào (luật 2).
    """
    with warnings.catch_warnings():
        warnings.simplefilter("error", Image.DecompressionBombWarning)
        try:
            return Image.open(io.BytesIO(du_lieu))
        except Image.DecompressionBombWarning as e:
            raise LoiAnh(
                ANH_QUA_LON, "Ảnh khai kích thước quá lớn, không xử lý được."
            ) from e
        except Image.DecompressionBombError as e:
            raise LoiAnh(
                ANH_QUA_LON, "Ảnh khai kích thước quá lớn, không xử lý được."
            ) from e
        except UnidentifiedImageError as e:
            raise LoiAnh(
                ANH_HONG,
                "File này không phải ảnh. Chỉ nhận JPEG, PNG hoặc WebP.",
            ) from e
        except OSError as e:
            raise LoiAnh(ANH_HONG, "File ảnh hỏng, không đọc được.") from e


def _phang(anh: Image.Image, dinh_dang: str) -> Image.Image:
    """Đưa ảnh về một mode mà định dạng đích ghi được.

    JPEG **không có kênh alpha**: ghi thẳng một ảnh RGBA ra JPEG thì Pillow ném
    `OSError: cannot write mode RGBA as JPEG`. Dán lên nền trắng chứ không `convert("RGB")`
    trần — `convert` bỏ alpha đi và để lại màu của pixel *dưới* lớp trong suốt, thường
    là đen, nên một logo nền trong suốt thành một khối đen.
    """
    if dinh_dang != "JPEG":
        return anh
    if anh.mode in ("RGBA", "LA", "P"):
        anh = anh.convert("RGBA")
        nen = Image.new("RGB", anh.size, (255, 255, 255))
        nen.paste(anh, mask=anh.split()[-1])
        return nen
    return anh.convert("RGB") if anh.mode != "RGB" else anh


def _ghi(anh: Image.Image, dinh_dang: str) -> bytes:
    """Mã hoá ra byte. **Không truyền `exif=`** — đó là cách EXIF chết (phép kiểm 5)."""
    ra = io.BytesIO()
    tuy_chon: dict = {}
    if dinh_dang == "JPEG":
        tuy_chon = {"quality": 85, "optimize": True, "progressive": True}
    elif dinh_dang == "WEBP":
        tuy_chon = {"quality": 85, "method": 4}
    elif dinh_dang == "PNG":
        tuy_chon = {"optimize": True}
    anh.save(ra, format=dinh_dang, **tuy_chon)
    return ra.getvalue()


def xu_ly_anh_tai_len(du_lieu: bytes) -> AnhDaXuLy:
    """Bảy phép kiểm (1–6 ở đây, 7 ở `core/ghi.py`). Ném `LoiAnh` ở phát hiện đầu tiên.

    Trả về byte đã tái mã hoá cho cả ảnh chính lẫn thumbnail. **Thumbnail sinh ĐỒNG BỘ**,
    ngay tại đây — lệch PLAN 8.5 ("queue job… cron") có chủ đích: cái job queue ấy được
    thiết kế cho R2, nơi server không cầm file nên phải tải về mới resize được. Server
    cầm sẵn ảnh trong RAM thì một lần `resize` rẻ hơn nhiều so với dựng và trông một
    hàng đợi — và nó xoá luôn cả một trạng thái trung gian ("ảnh đã lên nhưng chưa có
    thumb") mà UI sẽ phải biết cách vẽ.
    """
    # --- 1. Kích thước byte, TRƯỚC khi đọc gì --------------------------------
    if len(du_lieu) > BYTE_TOI_DA:
        raise LoiAnh(
            ANH_QUA_NANG,
            f"Ảnh nặng {len(du_lieu) / 1024 / 1024:.1f}MB, "
            f"tối đa {BYTE_TOI_DA // 1024 // 1024}MB.",
        )
    if not du_lieu:
        raise LoiAnh(ANH_HONG, "File rỗng.")

    # --- 2. Nhận dạng bằng NỘI DUNG ------------------------------------------
    anh = _mo_an_toan(du_lieu)
    dinh_dang = anh.format or ""
    try:
        # `verify()` kiểm tính toàn vẹn (CRC, cấu trúc chunk) mà KHÔNG decode pixel —
        # rẻ, và nó bắt được file bị cắt cụt trước khi ta cấp phát bộ nhớ cho nó.
        anh.verify()
    except Exception as e:
        raise LoiAnh(ANH_HONG, "File ảnh hỏng, không đọc được.") from e

    # --- 3. Allowlist định dạng ----------------------------------------------
    if dinh_dang not in DINH_DANG_CHO_PHEP:
        raise LoiAnh(
            DINH_DANG_KHONG_NHAN,
            f"Định dạng {dinh_dang or 'lạ'} không được nhận. Chỉ JPEG, PNG hoặc WebP.",
        )
    duoi, content_type = DINH_DANG_CHO_PHEP[dinh_dang]

    # `verify()` đóng file lại — Pillow ghi rõ là sau nó phải `open()` lần nữa mới dùng
    # được ảnh. Bỏ dòng này thì mọi thao tác tiếp theo ném `OSError`.
    anh = _mo_an_toan(du_lieu)

    # --- 4. Chống bom giải nén, đọc từ HEADER trước khi decode ---------------
    w_goc, h_goc = anh.size
    if w_goc * h_goc > PIXEL_TOI_DA:
        raise LoiAnh(
            ANH_QUA_LON,
            f"Ảnh {w_goc}×{h_goc} vượt trần {PIXEL_TOI_DA // 1_000_000} triệu pixel.",
        )
    if w_goc < 1 or h_goc < 1:
        raise LoiAnh(ANH_HONG, "Ảnh không có kích thước hợp lệ.")

    # --- EXIF: đọc TRƯỚC bước 5, sau đó không còn gì để đọc ------------------
    exif_taken_at = _doc_ngay_chup(anh)

    # --- 5. TÁI MÃ HOÁ -------------------------------------------------------
    try:
        # `exif_transpose` áp cờ Orientation của EXIF thành pixel THẬT. Phải làm trước
        # khi xoá EXIF, nếu không ảnh chụp dọc bằng điện thoại nằm ngang vĩnh viễn —
        # cờ xoay biến mất cùng phần EXIF còn lại.
        anh = ImageOps.exif_transpose(anh) or anh
        anh = _phang(anh, dinh_dang)

        chinh = anh.copy()
        chinh.thumbnail((CANH_TOI_DA, CANH_TOI_DA), Image.Resampling.LANCZOS)
        byte_chinh = _ghi(chinh, dinh_dang)

        thumb = anh.copy()
        thumb.thumbnail((CANH_THUMB, CANH_THUMB), Image.Resampling.LANCZOS)
        byte_thumb = _ghi(thumb, dinh_dang)
    except LoiAnh:
        raise
    except (OSError, ValueError, MemoryError) as e:
        # Decode thật mới lộ ra hỏng (header đúng, thân cụt) — `verify()` không bắt được
        # mọi ca. Đây là 400 chứ không 500: file của người dùng sai, không phải ta sai.
        raise LoiAnh(ANH_HONG, "Không xử lý được ảnh này.") from e

    return AnhDaXuLy(
        dinh_dang=dinh_dang,
        duoi=duoi,
        content_type=content_type,
        byte_chinh=byte_chinh,
        byte_thumb=byte_thumb,
        w=chinh.width,
        h=chinh.height,
        exif_taken_at=exif_taken_at,
    )
