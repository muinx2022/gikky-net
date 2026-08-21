"""Router API v1 (PLAN mục 7 — prefix `/api/v1`).

Phase 0 mới có mỗi healthcheck. Các endpoint hợp đồng v1 còn lại thuộc Phase 1+.

Luật khi thêm endpoint: **phải khai `operation_id` tường minh**, nếu không tên hàm
trong TS client sinh ra sẽ đổi theo tên hàm Python / theo route (PLAN 8.3).
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
