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
from api.avatar import router as router_avatar  # noqa: E402
from api.binh_luan import router as router_binh_luan  # noqa: E402
from api.dem_luot_xem import router as router_dem_luot_xem  # noqa: E402
from api.feeds import router as router_feeds  # noqa: E402
from api.ho_so import router as router_ho_so  # noqa: E402
from api.loi import dang_ky_xu_ly_loi  # noqa: E402
from api.machs import router as router_machs  # noqa: E402
from api.mod import router as router_mod  # noqa: E402
from api.mocs import router as router_mocs  # noqa: E402
from api.quyen import dang_ky_xu_ly_loi_ghi  # noqa: E402
from api.theo_doi import router as router_theo_doi  # noqa: E402
from api.theo_sub import router as router_theo_sub  # noqa: E402
from api.theo_user import router as router_theo_user  # noqa: E402
from api.tim_kiem import router as router_tim_kiem  # noqa: E402
from api.thong_bao import router as router_thong_bao  # noqa: E402
from api.tin_nhan import router as router_tin_nhan  # noqa: E402
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
# Ba cửa danh sách của trang hồ sơ (2026-08-24). Router riêng vì hai trong ba là per-user
# tuyệt đối (`/me/da-vote`, `/me/dang-theo` — `no-store`), còn `users.py` là cửa công
# khai cache được; trộn hai loại vào một module là mời lượt sau nhét một trường per-user
# vào đúng response đang được cache theo URL. Xem docstring `api/ho_so.py`.
api_v1.add_router("", router_ho_so)
# Phase 3 — hai router per-user. `theo_doi` mang `/machs/{id}/me`, `/seen`, `/follow`;
# `thong_bao` mang chuông. Cả hai tách khỏi `machs.py` vì một ranh giới có thật, không vì
# độ dài file: chúng là chỗ **được phép** đọc `request.user`, còn `machs.py` thì không —
# response của nó phải cache được (PLAN 8.4). Xem docstring `api/theo_doi.py`.
api_v1.add_router("", router_theo_doi)
# Theo dõi CHUYÊN MỤC (2026-08-24) — `/subs/{slug}/theo`, `/subs/{slug}/me`, `/me/subs`.
# Router riêng vì cùng ranh giới với `theo_doi`: `api/feeds.py` giữ hai endpoint chuyên mục
# KHÔNG per-user (cache được), file kia đọc `request.user`. Xem docstring `api/theo_sub.py`.
api_v1.add_router("", router_theo_sub)
# Theo dõi NGƯỜI (2026-08-25) — `/users/{username}/theo`, `/users/{username}/me`,
# `/me/dang-theo-user`. Router riêng vì cùng ranh giới: `api/users.py` giữ hồ sơ công khai
# KHÔNG per-user (cache được), file kia đọc `request.user`.
api_v1.add_router("", router_theo_user)
api_v1.add_router("", router_thong_bao)
# Phase 5 — `POST /mocs/{id}/anh` (multipart) + `DELETE /anh/{id}`. Tách khỏi `mocs.py`
# vì nó là cửa duy nhất nhận **file** từ internet, và bảy phép kiểm của nó đáng được đọc
# mà không phải cuộn qua ngăn kéo bình luận. Xem `api/anh.py`.
api_v1.add_router("", router_anh)
# Avatar (2026-08-24) — `POST`/`DELETE /me/avatar`. Cùng hạ tầng ảnh của `router_anh`
# nhưng là cửa per-user tuyệt đối (`no-store`), đích luôn là chính người gọi; tách riêng
# vì nó không thuộc `Moc` nào và không có gallery. Xem `api/avatar.py`.
api_v1.add_router("", router_avatar)
# Phase 7 — `GET /tim-kiem`. Router riêng vì nó là **đường đọc thứ hai** của toàn bộ nội
# dung: luật che của sản phẩm phải được áp lại ở đó bằng một lớp lọc Postgres, và lý lẽ
# ấy đáng đọc một mình. Xem `api/tim_kiem.py`.
api_v1.add_router("", router_tim_kiem)
# Bề mặt mod HẸP trên `/mod/*` (2026-08-24, PLAN phần D) — đúng 4 cửa ẩn/khoá. Nó nằm ở
# `api_v1` chứ không ở `api_admin` vì Caddy chặn `gikky.net/api/admin/*` (PLAN 8.2): front
# công khai không gọi được cửa admin nào ở prod, dù ở dev nó có vẻ chạy. Bốn handler chỉ
# gọi lại handler của `api/quan_tri_kiem_duyet.py` — ban user, quản lý sub, nhật ký và mọi
# bảng danh sách **ở lại** phía admin. Xem docstring `api/mod.py`.
api_v1.add_router("", router_mod)
# Đếm lượt xem (2026-08-27) — `POST /dem-luot-xem`, gọi từ `apps/web/middleware.ts`.
# Router riêng vì nó là endpoint ghi DUY NHẤT của `api_v1` **không có người dùng đứng
# sau**: auth của nó là một secret dùng chung, không phải phiên đăng nhập. Trộn nó vào
# một router có sẵn là mời lượt sau chép nhầm `auth=secret_dem_luot_xem` sang một cửa
# thật sự cần `dang_nhap`. Xem docstring `api/dem_luot_xem.py`.
api_v1.add_router("", router_dem_luot_xem)
# Nhắn tin riêng 1-1 (2026-09-03) — năm cửa dưới `/me/tin-nhan…`. Router riêng vì nó là
# cụm per-user **tuyệt đối** duy nhất chứa nội dung của HAI người: mọi truy vấn của nó tra
# hội thoại bằng cặp (người gọi, người kia), không bao giờ bằng một id client gửi lên.
# Trộn nó vào một router có sẵn là mời lượt sau thêm một cửa nhận `hoi_thoai_id` — và một
# cửa như thế là cửa rò nội dung riêng tư. Xem docstring `api/tin_nhan.py`.
api_v1.add_router("", router_tin_nhan)
