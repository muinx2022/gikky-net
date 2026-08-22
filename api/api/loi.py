"""Hình dạng lỗi của API v1 — PLAN mục 7: `{detail, code}`.

`code` là **hằng chuỗi ổn định**, `detail` là câu tiếng Việt cho người đọc. Frontend bắt
theo `code` và không bao giờ parse `detail` (PLAN 8.3 tinh thần "type một chiều": đổi
chữ trong `detail` không được là breaking change).

Django Ninja có sẵn một hình dạng lỗi RIÊNG cho lỗi validate tham số
(`{"detail": [{...}, ...]}`, HTTP 422) — `detail` ở đó là **mảng**, không phải chuỗi, và
không có `code`. Nghĩa là hợp đồng trên chỉ đúng với những lỗi ta tự trả, còn `?limit=abc`
thì rơi ra một hình dạng thứ hai mà frontend không lường. `dang_ky_xu_ly_loi` dưới đây
kéo ca đó về cùng một hình dạng.
"""

from ninja import NinjaAPI, Schema, Status
from ninja.errors import ValidationError

#: Không tìm thấy, hoặc có nhưng đã bị ẩn khỏi API công khai. **Một mã cho cả hai** là
#: cố ý: tách ra thành `da_bi_an` là kể cho người lạ biết chính xác thứ vừa bị gỡ có tồn
#: tại, trên một endpoint không cần đăng nhập.
KHONG_TIM_THAY = "khong_tim_thay"
CURSOR_KHONG_HOP_LE = "cursor_khong_hop_le"
SORT_KHONG_HOP_LE = "sort_khong_hop_le"
THAM_SO_KHONG_HOP_LE = "tham_so_khong_hop_le"
SUB_KHONG_TON_TAI = "sub_khong_ton_tai"


class LoiOut(Schema):
    """`{detail, code}` — PLAN mục 7."""

    detail: str
    code: str


def loi(status_code: int, code: str, detail: str) -> Status[LoiOut]:
    """Trả lỗi đúng hình dạng hợp đồng. Dùng `Status` chứ không phải tuple.

    django-ninja 1.6 deprecate kiểu `return 404, ...`, mà `filterwarnings = ["error"]`
    biến mọi `DeprecationWarning` thành lỗi test — xem cùng ghi chú ở `health`.
    """
    return Status(status_code, LoiOut(detail=detail, code=code))


def khong_tim_thay(cai_gi: str) -> Status[LoiOut]:
    return loi(404, KHONG_TIM_THAY, f"Không tìm thấy {cai_gi}.")


#: Tham số có **mã lỗi riêng** trong hợp đồng, kể cả khi phép kiểm do pydantic làm.
#:
#: Chỉ một dòng, và nó có lý do: từ W9 (2026-08-22) hai feed khai `sort` bằng `Literal`
#: để `openapi.json` ra `enum` — nghĩa là pydantic từ chối giá trị lạ **trước khi** thân
#: hàm chạy, nên nhánh trả `sort_khong_hop_le` viết tay ở `api/feeds.py` không còn được
#: gọi tới. Không có bảng này thì `?sort=top` lặng lẽ đổi mã từ `sort_khong_hop_le` sang
#: `tham_so_khong_hop_le`, tức một breaking change của frontend đi kèm một thay đổi
#: thuần tài liệu. `api/machs.py` vẫn kiểm `sort` bằng tay (khán đài) và vẫn trả đúng mã
#: ấy — hai cửa cùng một mã là chủ đích.
#:
#: **Có chuông từ X5** (lượt vá 3): `tests/test_hop_dong_openapi.py::
#: test_moi_query_param_enum_deu_co_CHU_trong_bang_ma_loi` đọc schema của cả registry và
#: đòi mọi query param `enum` hoặc có mặt ở đây, hoặc khai vào `CO_Y_DUNG_MA_MAC_DINH`
#: kèm lý do. Trước đó, thêm một `Literal` thứ hai là mã riêng của nó rơi về
#: `tham_so_khong_hop_le` mà không gì kêu — đúng loài lỗi bảng này sinh ra để chặn.
MA_LOI_THEO_THAM_SO: dict[str, str] = {"sort": SORT_KHONG_HOP_LE}


def _ma_loi(exc: ValidationError) -> str:
    """Mã hợp đồng cho một lỗi validate. Tham số đầu tiên có mã riêng thì thắng.

    ⚠ **"Đầu tiên" là theo THỨ TỰ THAM SỐ TRONG CHỮ KÝ HÀM, không theo thứ tự trên URL**
    *(đo lại ở X5, lượt vá 3)*. `exc.errors` do pydantic dựng theo thứ tự trường của
    model, mà Ninja sinh model ấy từ chữ ký endpoint — nên `?sort=top&limit=abc` và
    `?limit=abc&sort=top` trả **cùng** một mã (`sort_khong_hop_le`), và người gọi không
    đổi được kết quả bằng cách xếp lại query string.
    Hệ quả cần biết trước khi bảng này có dòng thứ hai: lúc ấy mã trả về khi HAI tham số
    cùng sai sẽ do **thứ tự khai trong `def`** quyết — tức đảo hai tham số trong chữ ký,
    một thao tác ai cũng coi là refactor nội bộ, là đổi mã lỗi của API. Ghim ở
    `tests/test_api_feed_top.py::test_ma_loi_khi_hai_tham_so_cung_sai_khong_theo_URL`.
    """
    for e in exc.errors:
        for phan in e.get("loc", ()):
            if (ma := MA_LOI_THEO_THAM_SO.get(str(phan))) is not None:
                return ma
    return THAM_SO_KHONG_HOP_LE


def dang_ky_xu_ly_loi(api: NinjaAPI) -> None:
    """Đưa lỗi validate tham số của Ninja về `{detail, code}` + HTTP 400.

    Đổi **cả status code** 422 → 400 là có chủ đích: 422 của Ninja đi kèm `detail` dạng
    mảng, nên để nguyên 422 mà đổi thân là có hai thứ khác nhau cùng mang một mã. 400 +
    `code="tham_so_khong_hop_le"` nói đúng chuyện đang xảy ra (query param sai) và không
    đụng vào mã nào đang được dùng.

    `detail` gộp các lỗi thành một chuỗi vì trường này là `str` trong hợp đồng. Thông tin
    chi tiết theo từng trường **mất đi** ở đây — chấp nhận được: người dùng cuối không
    đọc nó, còn lập trình viên frontend đã có `code`.

    `code` không phải lúc nào cũng là `tham_so_khong_hop_le`: xem `MA_LOI_THEO_THAM_SO`.
    """

    @api.exception_handler(ValidationError)
    def _validate(request, exc: ValidationError):
        cho = "; ".join(
            f"{'.'.join(str(x) for x in e.get('loc', ()))}: {e.get('msg', '')}".strip(
                ": "
            )
            for e in exc.errors
        )
        return api.create_response(
            request,
            LoiOut(
                detail=f"Tham số không hợp lệ ({cho})." if cho else "Tham số không hợp lệ.",
                code=_ma_loi(exc),
            ),
            status=400,
        )
