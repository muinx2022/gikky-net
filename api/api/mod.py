"""Bề mặt mod **HẸP** trên `/api/v1/mod/*` — đúng 4 việc mod làm khi đang đọc trang.

## Vì sao file này tồn tại (user chốt 2026-08-24, PLAN phần D)

PLAN 8.2 chốt luật hạ tầng: `gikky.net/api/admin/*` → **403 chặn tại Caddy**, chỉ
`admin.gikky.net` + allowlist IP mới vào. Nghĩa là front công khai (`apps/web` chạy trên
`gikky.net`) **không gọi được** một endpoint `/api/admin/*` nào ở prod.

Ở **dev** thì nó gọi được — cả hai app Next rewrite `/api/*` sang cùng một origin nên
Django thấy cùng một `Host` cho cổng 3000 lẫn 3001 (xem `config/host_admin.py`). Vì thế
lối "front gọi thẳng `/api/admin/*`" **chạy ngon ở dev và chết ở prod**, im lặng, sau khi
deploy. Đây là lý do cửa riêng tồn tại — không phải sở thích kiến trúc.

## Ranh giới là CẢ NỘI DUNG của quyết định

Mở ra front: **ẩn/gỡ ẩn mạch · mốc · bình luận, và khoá/mở mạch**. Hết.

Ở LẠI phía `/api/admin/*` sau allowlist IP: **ban user, quản lý sub, đọc `AuditLog`, mọi
bảng danh sách, thống kê**. Mở thêm bất kỳ cái nào là phải hỏi lại user, không phải một
lượt "tiện tay". Đánh đổi đã nói rõ và user chấp nhận: phiên mod bị chiếm trên site công
khai thì kẻ tấn công **ẩn được nội dung** (khôi phục được, có `AuditLog` ghi lại tên), còn
**ban thì không**, và dữ liệu tài khoản không chạm tới được.

`tests/test_api_mod.py::test_be_mat_mod_tren_v1_dung_BON_cua` ghim ranh giới ấy bằng một
bài đo, chứ không bằng câu văn này.

## Không một dòng luật nào sống ở đây

Bốn handler dưới đây **gọi lại đúng handler của `api/quan_tri_kiem_duyet.py`** — cùng
đường ghi (`core/ghi.py::dat_an_*` / `dat_khoa_mach`, tức cùng `AuditLog`, cùng thứ tự
khoá hàng `Comment/Moc → Mach → MocAnh`, cùng `cap_nhat_dem_mach` trong `atomic()`), cùng
schema vào/ra, cùng luật 404. Chép lại luật ấy ra bản thứ hai là dựng hai bản sẽ trôi ra
khỏi nhau — và bản trôi là bản không ai đo, vì mọi bài đo kiểm duyệt hôm nay bấm ở
`/api/admin/*`.

Cái file này thật sự thêm vào chỉ có **hai** thứ: lớp quyền (dưới đây) và
`Cache-Control: no-store`.
"""

from django.http import HttpResponse
from ninja import Router

from api.loi import KHONG_DU_QUYEN
from api.quan_tri_kiem_duyet import (
    TRA_LOI_DOI,
    dat_an_binh_luan_endpoint,
    dat_an_mach_endpoint,
    dat_an_moc_endpoint,
    dat_khoa_mach_endpoint,
)
from api.quan_tri_schemas import DatAnIn, DatKhoaMachIn
from api.quyen import DangNhap, LoiGhi

router = Router()


class ChiModTrenV1(DangNhap):
    """Ba vế của `ChiMod` (`api/quan_tri.py`), **bỏ đúng vế Host** — cộng CSRF của v1.

    Kế thừa `DangNhap` chứ không kế thừa `ChiMod`, và đó là một quyết định có hai lý do:

    1. **Vòng import.** `api/quan_tri.py` mở đầu bằng `from api.v1 import duong_dan_docs`,
       còn `api/v1.py` mount router này ở cuối file. `config/urls.py` và
       `config/api_registry.py` đều import `api.quan_tri` TRƯỚC, nên chuỗi
       `quan_tri → v1 → mod → quan_tri` chạm lại `api.quan_tri` đúng lúc nó mới thực thi
       tới dòng 53 — `ChiMod` chưa tồn tại, `ImportError` ngay lúc khởi động.
    2. **Vế nào cũng đã có một nguồn sự thật, và không nguồn nào là `ChiMod`.**
       `DangNhap` cho `is_active` + CSRF + "chưa bị ban" (đi qua `User.dang_bi_ban()` —
       cùng phép đọc ba cột mà `ChiMod` gọi, xem `api/quyen.py::_bi_khoa`). Thứ duy nhất
       phải thêm là `is_staff`.

    Rủi ro còn lại của lối này là **trôi**: ai thêm vế thứ tư vào `ChiMod` sẽ không thấy
    gì đỏ ở đây. Cái chuông cho đúng chuyện đó là
    `tests/test_api_mod.py::test_quyen_khop_TUNG_VE_voi_ChiMod_cua_khu_quan_tri` — nó đối
    chiếu lớp này với `ChiMod` thật trên một ma trận trạng thái tài khoản.

    **401 với khách, 403 với người đã đăng nhập** — cùng lối tách của
    `api/quan_tri.py::_xu_ly_thieu_quyen`, và cần thiết vì cùng lý do: 401 bảo UI hiện
    form đăng nhập. Trả 401 cho một người đang đăng nhập tử tế là đẩy họ đi đăng nhập lại
    vòng vòng. Ở `api_v1` không tách được bằng exception handler (handler
    `AuthenticationError` là handler CHUNG của mọi cửa ghi, luôn trả 401), nên chỗ duy
    nhất tách được là đây — `LoiGhi` mang sẵn `code` và đi ra đúng `{detail, code}`.
    """

    def authenticate(self, request, key):
        user = super().authenticate(request, key)
        # `None` = chưa đăng nhập / tài khoản đã vô hiệu hoá ⇒ để Ninja ném
        # `AuthenticationError` → 401 `chua_dang_nhap`. Tài khoản bị ban không rơi vào
        # nhánh này: `DangNhap` đã ném `LoiGhi(403, bi_khoa)` kèm lý do trước đó.
        if user is None:
            return None
        if not user.is_staff:
            raise LoiGhi(
                403,
                KHONG_DU_QUYEN,
                "Tài khoản này không có quyền kiểm duyệt.",
            )
        return user


#: Thể hiện dùng chung — không giữ trạng thái nào theo request, cùng lối `quyen.dang_nhap`.
chi_mod = ChiModTrenV1()


@router.post(
    "/mod/machs/{int:mach_id}/an",
    response=TRA_LOI_DOI,
    operation_id="mod_dat_an_mach",
    tags=["mod"],
    auth=chi_mod,
)
def mod_dat_an_mach(
    request, response: HttpResponse, mach_id: int, du_lieu: DatAnIn
):
    """Mod ẩn / gỡ ẩn cả mạch, ngay trên trang công khai. Idempotent.

    Cùng hành động và cùng kết quả với `POST /api/admin/machs/{id}/an`; cửa này tồn tại vì
    host công khai không với tới được `/api/admin/*` (PLAN 8.2). `Cache-Control: no-store`.
    """
    response["Cache-Control"] = "no-store"
    return dat_an_mach_endpoint(request, mach_id, du_lieu)


@router.post(
    "/mod/mocs/{int:moc_id}/an",
    response=TRA_LOI_DOI,
    operation_id="mod_dat_an_moc",
    tags=["mod"],
    auth=chi_mod,
)
def mod_dat_an_moc(request, response: HttpResponse, moc_id: int, du_lieu: DatAnIn):
    """Mod ẩn / gỡ ẩn một mốc. Idempotent.

    Mốc bị ẩn **vẫn giữ ô trên spine** kèm nhãn "mốc đã bị ẩn" (PLAN 5.2): `seq` bất biến
    nên `entry_count` không lùi. `Cache-Control: no-store`.
    """
    response["Cache-Control"] = "no-store"
    return dat_an_moc_endpoint(request, moc_id, du_lieu)


@router.post(
    "/mod/comments/{int:comment_id}/an",
    response=TRA_LOI_DOI,
    operation_id="mod_dat_an_binh_luan",
    tags=["mod"],
    auth=chi_mod,
)
def mod_dat_an_binh_luan(
    request, response: HttpResponse, comment_id: int, du_lieu: DatAnIn
):
    """Mod ẩn / gỡ ẩn một bình luận. Idempotent.

    Gỡ ẩn **không** hồi sinh bình luận mà tác giả đã tự xoá — `deleted_at` là trục khác.
    `Cache-Control: no-store`.
    """
    response["Cache-Control"] = "no-store"
    return dat_an_binh_luan_endpoint(request, comment_id, du_lieu)


@router.post(
    "/mod/machs/{int:mach_id}/khoa",
    response=TRA_LOI_DOI,
    operation_id="mod_dat_khoa_mach",
    tags=["mod"],
    auth=chi_mod,
)
def mod_dat_khoa_mach(
    request, response: HttpResponse, mach_id: int, du_lieu: DatKhoaMachIn
):
    """Mod khoá / mở khoá một mạch: đọc được, cấm mọi tương tác (PLAN 5.10). Idempotent.

    **Trục riêng, khác "đóng sổ" của tác giả** — endpoint này không đụng `status`.
    `Cache-Control: no-store`.
    """
    response["Cache-Control"] = "no-store"
    return dat_khoa_mach_endpoint(request, mach_id, du_lieu)
