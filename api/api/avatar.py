"""`POST /me/avatar` · `DELETE /me/avatar` — ảnh đại diện của CHÍNH người đang đăng nhập.

Cùng bảy phép kiểm của Phase 5 (`core/anh.py`) và cùng lối dịch `LoiAnh` → mã HTTP như
`api/anh.py::tai_anh_moc`. Khác hai chỗ, và cả hai là bản chất của avatar:

1. **Đích là chính người gọi**, không có path param — nên không có ca "sửa avatar hộ ai".
   `auth=dang_nhap` là toàn bộ phân quyền, và `request.user` là hàng DUY NHẤT được ghi.
2. **`Cache-Control: no-store`** trên response THÀNH CÔNG (200): nó đổi một mảnh của
   `GET /me` (per-user, cấm cache — PLAN 8.4 điểm 4), nên một proxy giữ lại là phục vụ
   avatar người này cho phiên người kia. Các nhánh 4xx đến từ `raise LoiGhi` (ảnh hỏng /
   quá nặng) đi qua bộ xử lý lỗi chung `dang_ky_xu_ly_loi_ghi` — nó dựng một response MỚI
   nên không mang header này; ca đó chấp nhận được vì response lỗi ảnh không chứa dữ liệu
   per-user nào (khác `api/ho_so.py`, nơi 400 là `return` nên giữ được header).

Trả về `ToiOut` (đúng hình dạng `GET /me`) chứ không chỉ một `{avatar_url}`: form sửa hồ
sơ đã cầm cả object phiên, nên trả nguyên nó để UI cập nhật một lần, không phải ghép tay.
"""

from django.http import HttpResponse
from ninja import File, Router
from ninja.files import UploadedFile

from core.anh import ANH_QUA_NANG, BYTE_TOI_DA, LoiAnh, xu_ly_anh_tai_len
from core.avatar import dat_avatar, xoa_avatar

from api.loi import LoiOut
from api.quyen import LoiGhi, dang_nhap
from api.schemas import ToiOut
from api.toi import xem_toi

router = Router()


@router.post(
    "/me/avatar",
    response={200: ToiOut, 400: LoiOut, 401: LoiOut, 413: LoiOut},
    operation_id="dat_avatar",
    tags=["tai-khoan"],
    auth=dang_nhap,
)
def dat_avatar_api(request, response: HttpResponse, file: UploadedFile = File(...)):
    """Đặt/đổi ảnh đại diện (multipart). Trả `GET /me` mới, `Cache-Control: no-store`.

    Ảnh đi qua đúng bảy phép kiểm của `POST /mocs/{id}/anh`: nhận dạng bằng NỘI DUNG (tên
    file + `Content-Type` bị bỏ qua), tái mã hoá xoá polyglot + EXIF, allowlist JPEG/PNG/
    WebP. Ảnh hỏng / định dạng lạ → 400, quá nặng → 413 — cùng bộ mã với `tai_anh_moc`,
    nên UI dùng lại đúng một bộ câu lỗi.
    """
    response["Cache-Control"] = "no-store"

    # Chặn theo `file.size` (từ `Content-Length` của phần multipart) TRƯỚC khi `read()`:
    # đọc rồi mới kiểm thì Django đã nuốt cả thân vào RAM/đĩa tạm — đúng thứ tự phép kiểm
    # 1 đòi. Xem `api/anh.py::tai_anh_moc`.
    if file.size is not None and file.size > BYTE_TOI_DA:
        raise LoiGhi(
            413,
            ANH_QUA_NANG,
            f"Ảnh nặng {file.size / 1024 / 1024:.1f}MB, "
            f"tối đa {BYTE_TOI_DA // 1024 // 1024}MB.",
        )

    try:
        anh = xu_ly_anh_tai_len(file.read())
    except LoiAnh as e:
        raise LoiGhi(413 if e.ma == ANH_QUA_NANG else 400, e.ma, e.detail) from e

    dat_avatar(user=request.user, anh=anh)
    return xem_toi(request)


@router.delete(
    "/me/avatar",
    response={200: ToiOut, 401: LoiOut},
    operation_id="xoa_avatar",
    tags=["tai-khoan"],
    auth=dang_nhap,
)
def xoa_avatar_api(request, response: HttpResponse):
    """Gỡ ảnh đại diện — rỗng cột + xoá file thật. Trả `GET /me` mới, `no-store`.

    **Idempotent**: gỡ khi vốn không có avatar vẫn trả 200 với `avatar_url = null` — client
    không phải biết trước mình có avatar hay không mới dám bấm gỡ. `no-store` vì cùng lý do
    `POST`: nó đổi `GET /me`.
    """
    response["Cache-Control"] = "no-store"
    xoa_avatar(user=request.user)
    return xem_toi(request)
