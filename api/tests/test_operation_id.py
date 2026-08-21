"""Mọi endpoint phải khai `operation_id` TƯỜNG MINH — luật `CLAUDE.md` / PLAN mục 7.

Kịch bản hỏng im lặng cần chặn: quên khai thì django-ninja tự sinh `operationId` từ tên
hàm Python + route. Đổi tên một hàm Python — việc mà ai cũng coi là refactor nội bộ —
lập tức đổi tên hàm trong `packages/api-client/sdk.gen.ts`, tức là **breaking change của
frontend**, mà không có gì đỏ ở phía Python.

**Không đọc `openapi.json` để kiểm chuyện này**, và đó là điểm mấu chốt: trong schema,
`operationId` tự sinh và `operationId` khai tay trông y hệt nhau (cùng là một chuỗi), nên
một bài đo dựa vào schema sẽ XANH cho cả hai. Thứ phân biệt được chúng chỉ có ở object
`Operation`: `op.operation_id is None` nghĩa là không ai khai.
"""

import pytest
from ninja import NinjaAPI, Router

from api.v1 import api_v1


def moi_operation(api: NinjaAPI):
    """`(đường dẫn, Operation)` của mọi endpoint đã đăng ký vào một `NinjaAPI`."""
    for prefix, router in api._routers:
        for path, path_view in router.path_operations.items():
            for op in path_view.operations:
                yield f"{prefix}{path}", op


def thieu_operation_id(api: NinjaAPI) -> list[str]:
    """Danh sách endpoint không khai `operation_id`. Rỗng = đạt."""
    return [
        f"{op.methods} {duong_dan}"
        for duong_dan, op in moi_operation(api)
        if not op.operation_id
    ]


def test_hang_rao_nay_bat_duoc_endpoint_quen_khai():
    """Đối chứng dương: một API cố tình quên khai phải bị `thieu_operation_id` nêu tên.

    Không có bài đo này thì `thieu_operation_id` có thể `return []` vô điều kiện và bài
    đo dưới vẫn xanh — đúng loại "proof đo RỖNG" mà repo đã dính một lần.
    """
    api_gia = NinjaAPI(urls_namespace="test-quen-operation-id")
    r = Router()

    @r.get("/quen")
    def quen(request):  # pragma: no cover - không bao giờ được gọi
        return {}

    @r.get("/nho", operation_id="nho_khai")
    def nho(request):  # pragma: no cover - không bao giờ được gọi
        return {}

    api_gia.add_router("", r)

    thieu = thieu_operation_id(api_gia)
    assert len(thieu) == 1 and "/quen" in thieu[0], thieu


def test_moi_endpoint_v1_deu_khai_operation_id():
    assert thieu_operation_id(api_v1) == []


def test_operation_id_khong_trung_nhau():
    """Trùng `operationId` là hai hàm TS cùng tên — openapi-ts sẽ ghi đè, im lặng."""
    ids = [op.operation_id for _, op in moi_operation(api_v1)]
    trung = sorted({i for i in ids if ids.count(i) > 1})
    assert trung == [], f"operation_id trùng: {trung}"


def test_du_6_endpoint_doc_cua_plan_muc_7():
    """Hợp đồng 1b: đúng 6 endpoint đọc, đúng path của PLAN mục 7 (+ health của Phase 0).

    Viết cứng danh sách là cố ý: nó vừa là bài đo R1, vừa là chỗ ĐỎ đầu tiên nếu ai đó
    lỡ tay thêm một endpoint ghi vào phase này (Phase 2) hoặc đổi đường dẫn đã hứa với
    frontend.
    """
    thuc_te = {
        (tuple(sorted(op.methods)), duong_dan)
        for duong_dan, op in moi_operation(api_v1)
    }
    assert thuc_te == {
        (("GET",), "/health"),
        (("GET",), "/feeds/moi"),
        (("GET",), "/feeds/dang-dien-ra"),
        (("GET",), "/machs/{int:mach_id}"),
        (("GET",), "/machs/{int:mach_id}/comments"),
        (("GET",), "/mocs/{int:moc_id}/comments"),
        (("GET",), "/mocs/{int:moc_id}/revisions"),
        (("GET",), "/users/{username}"),
    }


@pytest.mark.django_db
def test_openapi_json_mang_dung_nhung_operation_id_da_khai():
    """Cầu nối sang phía TS: tên trong schema phải đúng bằng tên đã khai trong Python."""
    schema = api_v1.get_openapi_schema()
    trong_schema = {
        op["operationId"]
        for duong in schema["paths"].values()
        for op in duong.values()
    }
    assert trong_schema == {op.operation_id for _, op in moi_operation(api_v1)}
