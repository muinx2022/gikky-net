"""Ảnh nằm ở đâu trên đĩa, và làm sao gỡ nó đi thật — Phase 5.

Module này là **lớp duy nhất** biết ảnh là file. Mọi chỗ khác nói chuyện qua nó, và nó
nói chuyện với đĩa qua API storage của Django (`save`/`open`/`delete`/`exists`) — không
một lời gọi `open()` hay `os.path` nào. Đó là điều kiện để "đổi sang R2 = đổi một khối
`STORAGES`" (`config/settings.py`) còn đúng.

=============================================================================
A9 — "ảnh của mốc bia mộ / bị mod ẩn không được phục vụ nữa"
=============================================================================

Đây là chỗ dễ tưởng-đã-xong nhất của cả phase, nên nói thẳng cơ chế trước:

**Ẩn ở tầng API là KHÔNG ĐỦ.** Prod cho Caddy `root` vào `MEDIA_ROOT` rồi `file_server`
— file đi thẳng từ đĩa ra internet, **không qua Django một dòng code nào**. Bỏ ảnh khỏi
`MocOut` chỉ làm nó biến khỏi *trang*; ai đã có URL (đã mở tab, đã share link, đã lưu
lịch sử duyệt, hoặc là chính người bị nói xấu trong tấm ảnh) vẫn tải được như cũ, mãi mãi.

**Nên: ảnh bị CHUYỂN THẬT sang một kho khác** (`STORAGES["an"]` → `MEDIA_AN_ROOT`), nằm
**ngoài** `MEDIA_ROOT`. Caddy không có `root` nào trỏ tới đó, nên URL cũ trả **404 ngay
lập tức**, kể cả với người đang cầm sẵn link.

**Nó bảo vệ tới đâu — nói cho đủ:**

- ✅ URL cũ chết ngay, cả với người đã có link. Đây là vế mà "uuid khó đoán" KHÔNG làm được.
- ✅ Đảo ngược được: mod bỏ ẩn ⇒ file chuyển ngược, URL cũ sống lại nguyên vẹn
  (`khoa_luu_tru` không đổi trong suốt quá trình — chỉ có kho chứa nó đổi).
- ⚠ **File vẫn còn trên đĩa máy chủ**, chỉ là không phục vụ nữa. Đây KHÔNG phải xoá dữ
  liệu, và đừng nói với ai là đã xoá. Ai có quyền vào máy chủ vẫn đọc được. Đó là lựa
  chọn có chủ đích: ẩn của mod đảo ngược được (PLAN 5.10), mà xoá thật thì không.
- ⚠ **Bản sao lưu, cache CDN và cache trình duyệt nằm ngoài tầm với.** Không có CDN nào
  hôm nay, nhưng ngày có thì đây là việc phải làm thêm — không phải việc đã xong.
- ⚠ Chỉ `DELETE /api/v1/anh/{id}` mới **xoá file thật** khỏi đĩa (A8).

Ba cửa gọi tới đây, và cả ba đều đảo ngược được trừ cửa thứ nhất:
`core/ghi.py::xoa_moc` (bia mộ) · `::dat_an_moc` (mod ẩn/bỏ ẩn mốc) ·
`::dat_an_mach` (mod ẩn/bỏ ẩn cả mạch ⇒ mọi ảnh của mọi mốc trong đó).
"""

from __future__ import annotations

import logging
import uuid

from django.core.files.base import ContentFile
from django.core.files.storage import storages

logger = logging.getLogger(__name__)

#: Thư mục con trong `MEDIA_ROOT`. Ảnh chính và thumbnail tách hai nhánh để một lệnh
#: `du -sh` trả lời được "thumbnail đang ăn bao nhiêu đĩa" mà không phải quét từng tên.
THU_MUC_ANH = "anh"
THU_MUC_THUMB = "anh-thumb"


def kho_hien():
    """Kho ĐANG PHỤC VỤ — Caddy `root` vào đây (prod), Django `static()` (dev)."""
    return storages["default"]


def kho_an():
    """Kho CÁCH LY — không `base_url`, không server nào trỏ tới. Xem docstring module."""
    return storages["an"]


def khoa_moi(duoi: str) -> str:
    """Phép kiểm 6: tên file **ngẫu nhiên**, đuôi suy từ định dạng ĐÃ NHẬN DẠNG.

    `uuid4` chứ không tên client gửi, và lý do không chỉ là traversal (`../../`):

    - tên client gửi làm lộ thông tin (`ket-qua-sinh-thiet-nguyen-van-a.jpg` nằm nguyên
      trong URL công khai);
    - hai người tải lên cùng `IMG_0001.jpg` thì một trong hai bị đổi tên âm thầm;
    - và đuôi file quyết định `Content-Type` mà Caddy `file_server` trả về — để client
      chọn đuôi là để client chọn cách trình duyệt diễn giải file. `.html` đi kèm
      `nosniff` thì trình duyệt **vẫn render nó như HTML**, vì `nosniff` chỉ cấm ĐOÁN
      khác đi, nó không cấm cái `Content-Type` mà server đã tuyên bố.

    `duoi` luôn đến từ `core/anh.py::DINH_DANG_CHO_PHEP`, không bao giờ từ request.
    """
    return f"{uuid.uuid4().hex}{duoi}"


def duong_dan_chinh(khoa: str) -> str:
    return f"{THU_MUC_ANH}/{khoa}"


def duong_dan_thumb(khoa: str) -> str:
    return f"{THU_MUC_THUMB}/{khoa}"


def ghi_anh(khoa: str, *, byte_chinh: bytes, byte_thumb: bytes) -> None:
    """Ghi cả ảnh chính lẫn thumbnail vào kho đang phục vụ, dưới cùng một `khoa`.

    Một khoá cho hai file (khác thư mục) chứ không hai cột khoá độc lập: chúng sinh ra
    cùng lúc, chết cùng lúc, và một cột thứ hai chỉ tạo cơ hội cho chúng lệch nhau.
    """
    kho = kho_hien()
    kho.save(duong_dan_chinh(khoa), ContentFile(byte_chinh))
    kho.save(duong_dan_thumb(khoa), ContentFile(byte_thumb))


def url_anh(khoa: str) -> str:
    return kho_hien().url(duong_dan_chinh(khoa))


def url_thumb(khoa: str) -> str:
    return kho_hien().url(duong_dan_thumb(khoa))


def _chuyen(duong_dan: str, *, tu, den) -> bool:
    """Chuyển MỘT file giữa hai kho, giữ nguyên đường dẫn. `True` nếu có chuyển.

    Đọc → ghi → xoá, chứ không `os.rename`: `os.rename` chỉ chạy khi hai kho cùng là
    `FileSystemStorage` **và cùng một volume**. Ngày đổi sang R2, `rename` là thứ vỡ im
    lặng, còn ba bước này vẫn đúng.

    Không có file nguồn ⇒ `False`, không ném. Ca đó xảy ra thật: ẩn một mốc đã ẩn sẵn,
    hoặc một hàng DB còn mà file đã bị dọn tay. Ném ở đây nghĩa là mod không ẩn được một
    mốc chỉ vì một file đã mất từ trước.
    """
    if not tu.exists(duong_dan):
        return False
    if den.exists(duong_dan):
        # Đích đã có file cùng tên: `save()` sẽ tự đổi tên thành `<tên>_AbC123.jpg` và
        # cái tên mới đó không ai lưu lại ⇒ file mồ côi vĩnh viễn. Xoá đích trước.
        den.delete(duong_dan)
    with tu.open(duong_dan, "rb") as f:
        den.save(duong_dan, ContentFile(f.read()))
    tu.delete(duong_dan)
    return True


def an_anh(khoa: str) -> bool:
    """Chuyển ảnh sang kho cách ly ⇒ URL công khai trả 404. Đảo ngược bằng `hien_anh`."""
    kho, an = kho_hien(), kho_an()
    a = _chuyen(duong_dan_chinh(khoa), tu=kho, den=an)
    b = _chuyen(duong_dan_thumb(khoa), tu=kho, den=an)
    return a or b


def hien_anh(khoa: str) -> bool:
    """Chuyển ảnh ngược ra kho đang phục vụ. URL cũ sống lại y nguyên."""
    kho, an = kho_hien(), kho_an()
    a = _chuyen(duong_dan_chinh(khoa), tu=an, den=kho)
    b = _chuyen(duong_dan_thumb(khoa), tu=an, den=kho)
    return a or b


def xoa_anh_that(khoa: str) -> None:
    """Xoá file khỏi **cả hai** kho — A8: xoá hàng thì file phải biến khỏi đĩa.

    Phải quét cả kho cách ly: một ảnh của mốc đang bị mod ẩn nằm ở đó, và xoá mỗi kho
    đang phục vụ sẽ để lại file vĩnh viễn ở kho kia — không cửa nào hiện, không ai đếm,
    đĩa đầy dần. Đây đúng là loài rác mà `don_anh_mo_coi` sinh ra để tìm.

    `delete()` của Django không ném khi file không tồn tại, nên hàm này idempotent.
    """
    for kho in (kho_hien(), kho_an()):
        for duong_dan in (duong_dan_chinh(khoa), duong_dan_thumb(khoa)):
            try:
                kho.delete(duong_dan)
            except OSError:
                # Đĩa lỗi / quyền sai. Không để nó nuốt cả lời xoá hàng DB: hàng đi rồi
                # thì file thành mồ côi, và `don_anh_mo_coi` là cái lưới hứng đúng ca này.
                logger.exception("xoa_anh_that: không xoá được %s", duong_dan)
