"""Router API v1 (PLAN mục 7 — prefix `/api/v1`).

Phase 1b thêm 6 endpoint ĐỌC; mọi endpoint GHI vẫn thuộc Phase 2, và
`GET /machs/{id}/me` (dữ liệu của viewer) thuộc Phase 3.

Endpoint chia theo module vì cùng lý do `core/models/` là package: gom một file thì mỗi
lần sửa khán đài đều phải cuộn qua hồ sơ người dùng. **Vẫn CHỈ MỘT `NinjaAPI` khoá `v1`**
— thêm `NinjaAPI` mới là ba việc kèm ba cái chuông, xem `config/api_registry.py`.

Luật khi thêm endpoint: **phải khai `operation_id` tường minh**, nếu không tên hàm
trong TS client sinh ra sẽ đổi theo tên hàm Python / theo route (PLAN 8.3).
`tests/test_operation_id.py` là cái chuông cho luật đó.
"""

import logging

from django.conf import settings
from django.db import connection
from ninja import NinjaAPI, Schema, Status

logger = logging.getLogger(__name__)


def duong_dan_docs(debug: bool) -> dict[str, str | None]:
    """Chỗ mount `/docs` + `/openapi.json`, hoặc `None` để TẮT hẳn.

    Ngoài DEBUG thì tắt: hai đường này phơi toàn bộ bề mặt API ra internet, mà PLAN 8.2
    chỉ chặn `/api/admin/*` ở Caddy chứ không chặn `/api/v1/*`.

    Codegen KHÔNG phụ thuộc vào chúng: `export_openapi` gọi thẳng
    `NinjaAPI.get_openapi_schema()`, không đi qua HTTP.
    """
    if debug:
        return {"docs_url": "/docs", "openapi_url": "/openapi.json"}
    return {"docs_url": None, "openapi_url": None}


api_v1 = NinjaAPI(
    title="gikky.net API",
    version="1.0.0",
    # **CSRF không khai ở đây, và đó không phải là quên** — django-ninja 1.6 bỏ tham số
    # `csrf` của `NinjaAPI` (truyền vào là `TypeError`). Mọi view của Ninja nay
    # `csrf_exempt` ở tầng middleware Django, và phép kiểm CSRF **chuyển vào lớp auth**:
    # `ninja.security.APIKeyCookie.__init__(csrf=True)` chạy `CsrfViewMiddleware` trước
    # khi đọc cookie phiên. Hệ quả phải nhớ: **một endpoint GHI mà khai `auth=None` là
    # một endpoint KHÔNG có CSRF** — bất kỳ trang web nào cũng POST sang nó được bằng
    # cookie phiên của người đang đăng nhập, HTTP 200, không gì đỏ.
    # Hàng rào cho đúng chuyện đó: `tests/test_quyen_ghi.py`.
    **duong_dan_docs(settings.DEBUG),
)


class HealthOut(Schema):
    """Kết quả healthcheck. `db` = "ok" chỉ khi truy vấn thật xuống Postgres thành công."""

    status: str
    db: str


@api_v1.get(
    "/health",
    response={200: HealthOut, 503: HealthOut},
    operation_id="get_health",
    tags=["health"],
)
def health(request):
    """`SELECT 1` thật xuống DB.

    DB sống → 200 `{"status":"ok","db":"ok"}`; DB hỏng hoặc trả kết quả sai → 503
    `{"status":"fail","db":"fail"}`.
    """
    # GHI CHÚ NỘI BỘ — cố ý nằm ngoài docstring: django-ninja đổ docstring của view vào
    # `description` của OpenAPI, nên mọi chữ trong đó chảy thẳng ra
    # `packages/api-client/openapi.json`, ra JSDoc của `sdk.gen.ts`, và ra
    # `/api/v1/openapi.json` khi DEBUG=True. Docstring là HỢP ĐỒNG API công khai, không
    # phải chỗ ghi lý do triển khai.
    #
    # - Trả 503 chứ không phải 200 kèm `db="fail"`: monitoring bắt bằng status code, còn
    #   nhánh "fail" mà trả 200 thì trên thực tế không ai nhìn thấy.
    # - Bắt `Exception` rộng là cố ý: healthcheck có nhiệm vụ BÁO hỏng, không có nhiệm vụ
    #   ném 500.
    # - Dùng `Status(...)` chứ không `return 503, ...`: django-ninja 1.6 đã deprecate kiểu
    #   tuple, mà `filterwarnings = ["error"]` biến mọi DeprecationWarning thành lỗi test.
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT 1")
            row = cursor.fetchone()
    except Exception:
        logger.exception("healthcheck: truy vấn DB ném lỗi")
        return Status(503, HealthOut(status="fail", db="fail"))

    if row != (1,):
        logger.error("healthcheck: `SELECT 1` trả về %r, không phải (1,)", row)
        return Status(503, HealthOut(status="fail", db="fail"))

    return Status(200, HealthOut(status="ok", db="ok"))


# Mount ở CUỐI file: các module router import `api.loi`/`api.schemas`, còn `api_v1` phải
# tồn tại trước khi `config/api_registry.py` đọc tới. Đặt import ở đây tránh vòng lặp
# import mà không cần một module "app" thứ ba chỉ để nối dây.
from api.bao_cao import router as router_bao_cao  # noqa: E402
from api.anh import router as router_anh  # noqa: E402
from api.binh_luan import router as router_binh_luan  # noqa: E402
from api.feeds import router as router_feeds  # noqa: E402
from api.loi import dang_ky_xu_ly_loi  # noqa: E402
from api.machs import router as router_machs  # noqa: E402
from api.mocs import router as router_mocs  # noqa: E402
from api.quyen import dang_ky_xu_ly_loi_ghi  # noqa: E402
from api.theo_doi import router as router_theo_doi  # noqa: E402
from api.tim_kiem import router as router_tim_kiem  # noqa: E402
from api.thong_bao import router as router_thong_bao  # noqa: E402
from api.toi import router as router_toi  # noqa: E402
from api.tuong_tac import router as router_tuong_tac  # noqa: E402
from api.users import router as router_users  # noqa: E402

dang_ky_xu_ly_loi(api_v1)
dang_ky_xu_ly_loi_ghi(api_v1)
api_v1.add_router("", router_feeds)
api_v1.add_router("", router_machs)
api_v1.add_router("", router_mocs)
api_v1.add_router("", router_binh_luan)
# Cửa nhận báo cáo (PLAN 5.10) — L03, lượt vá V1. Router riêng vì nó đi qua BA loại đích
# nên không thuộc tiền tố URL nào; xem docstring `api/bao_cao.py`.
api_v1.add_router("", router_bao_cao)
api_v1.add_router("", router_tuong_tac)
api_v1.add_router("", router_toi)
api_v1.add_router("", router_users)
# Phase 3 — hai router per-user. `theo_doi` mang `/machs/{id}/me`, `/seen`, `/follow`;
# `thong_bao` mang chuông. Cả hai tách khỏi `machs.py` vì một ranh giới có thật, không vì
# độ dài file: chúng là chỗ **được phép** đọc `request.user`, còn `machs.py` thì không —
# response của nó phải cache được (PLAN 8.4). Xem docstring `api/theo_doi.py`.
api_v1.add_router("", router_theo_doi)
api_v1.add_router("", router_thong_bao)
# Phase 5 — `POST /mocs/{id}/anh` (multipart) + `DELETE /anh/{id}`. Tách khỏi `mocs.py`
# vì nó là cửa duy nhất nhận **file** từ internet, và bảy phép kiểm của nó đáng được đọc
# mà không phải cuộn qua ngăn kéo bình luận. Xem `api/anh.py`.
api_v1.add_router("", router_anh)
# Phase 7 — `GET /tim-kiem`. Router riêng vì nó là **đường đọc thứ hai** của toàn bộ nội
# dung: luật che của sản phẩm phải được áp lại ở đó bằng một lớp lọc Postgres, và lý lẽ
# ấy đáng đọc một mình. Xem `api/tim_kiem.py`.
api_v1.add_router("", router_tim_kiem)
