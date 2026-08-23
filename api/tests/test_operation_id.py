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

from pathlib import Path

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


def test_du_endpoint_cua_plan_muc_7():
    """Bề mặt API: đúng những path của PLAN mục 7 (+ health của Phase 0).

    Viết cứng danh sách là cố ý: nó vừa là bài đo R1, vừa là chỗ ĐỎ đầu tiên nếu ai đó
    đổi một đường dẫn đã hứa với frontend, hoặc mở thêm một cửa ghi mà quên ghi vào bảng
    hợp đồng.

    `GET /subs/{slug}` thêm ở Phase 1d (plan con §2.3) và `GET /subs` thêm ở lượt vá
    (§V8). **Phase 2 thêm 11 cửa ghi + `GET /me`** — PLAN mục 7 **bắt** ghi lại vào bảng
    khi thêm endpoint, nên mọi dòng ở đây phải có mặt trong bảng ấy. Sửa danh sách này mà
    không sửa bảng là để hợp đồng công khai nói thiếu một endpoint đang chạy;
    `test_bang_API_cua_PLAN_co_du_dong_sub` giữ chiều đó.

    **Phase 3 thêm 8 cửa** (plan con `plans/2026-08-23-mang-b1-backend-phase-3.md` §3):
    hai cửa per-user của trang mạch (`/me`, `/seen`), hai cửa follow, hai cửa chuông và
    hai cửa trích. Bảng PLAN mục 7 đã có sẵn dòng cho cả tám — Phase 3 không mở endpoint
    nào ngoài hợp đồng, nó chỉ cài những dòng đã hứa từ đầu.

    **Phase 5 thay THẾ hai dòng đã hứa bằng hai dòng khác**, và đó là ca đầu tiên bảng
    PLAN bị sửa chứ không chỉ được cài: mục 7 hứa `POST /media/presign` +
    `POST /media/confirm` (flow R2 hai nhịp của PLAN 8.5), nhưng user chốt 2026-08-23
    lưu ảnh xuống đĩa ⇒ upload một nhịp ⇒ hai cửa ấy không còn lý do tồn tại. Bảng mục 7
    và mục 8.5 đã sửa cùng lượt; `test_bang_API_cua_PLAN_co_du_dong_sub` ngay dưới là
    thứ giữ cho hai bên không lệch.
    """
    thuc_te = {
        (tuple(sorted(op.methods)), duong_dan)
        for duong_dan, op in moi_operation(api_v1)
    }
    assert thuc_te == {
        # --- đọc (Phase 0/1) ---
        (("GET",), "/health"),
        (("GET",), "/feeds/moi"),
        (("GET",), "/feeds/dang-dien-ra"),
        (("GET",), "/subs"),
        (("GET",), "/subs/{slug}"),
        (("GET",), "/machs/{int:mach_id}"),
        (("GET",), "/machs/{int:mach_id}/comments"),
        (("GET",), "/mocs/{int:moc_id}/comments"),
        (("GET",), "/mocs/{int:moc_id}/revisions"),
        (("GET",), "/users/{username}"),
        # --- tài khoản + ghi (Phase 2) ---
        (("GET",), "/me"),
        (("POST",), "/machs"),
        (("POST",), "/machs/{int:mach_id}/mocs"),
        (("POST",), "/machs/{int:mach_id}/comments"),
        (("POST",), "/machs/{int:mach_id}/close"),
        (("POST",), "/machs/{int:mach_id}/reopen"),
        (("PATCH",), "/mocs/{int:moc_id}"),
        (("DELETE",), "/mocs/{int:moc_id}"),
        (("PATCH",), "/comments/{int:comment_id}"),
        (("DELETE",), "/comments/{int:comment_id}"),
        (("POST",), "/votes"),
        (("POST",), "/mocs/{int:moc_id}/reactions"),
        # --- mặt BÃO + vòng lặp quay lại (Phase 3) ---
        # `GET /machs/{id}/me` là cửa DUY NHẤT ở đây trả dữ liệu per-user của trang mạch;
        # `GET /machs/{id}` ngay trên vẫn phải sạch để còn cache được (PLAN 8.4).
        (("GET",), "/machs/{int:mach_id}/me"),
        (("POST",), "/machs/{int:mach_id}/seen"),
        (("POST",), "/machs/{int:mach_id}/follow"),
        (("DELETE",), "/machs/{int:mach_id}/follow"),
        (("POST",), "/mocs/{int:moc_id}/trich"),
        (("DELETE",), "/mocs/{int:moc_id}/trich"),
        (("GET",), "/notifications"),
        (("POST",), "/notifications/read"),
        # --- lượt vá V1 (2026-08-23) ---
        # `POST /reports` là dòng PLAN mục 7 **đã hứa từ đầu** và Phase 4 quên cài (L03):
        # nó dựng trọn phía tiêu thụ mà không dựng cửa nhận, nên hàng đợi kiểm duyệt rỗng
        # về cấu trúc. `PATCH /me` (L14) là dòng MỚI của bảng — cờ `nhan_digest` có từ
        # Phase 3 mà không endpoint nào đặt được, tức digest không ai bật được.
        (("POST",), "/reports"),
        (("PATCH",), "/me"),
        # --- ảnh (Phase 5) ---
        # MỘT nhịp, multipart. PLAN mục 7 hứa `POST /media/presign` + `POST /media/confirm`
        # cho flow R2 hai nhịp của PLAN 8.5; user chốt 2026-08-23 lưu xuống đĩa nên hai
        # cửa ấy **không tồn tại** và bảng PLAN đã được sửa theo. Xem
        # `plans/2026-08-23-phase-5-anh-local.md` §0.
        (("POST",), "/mocs/{int:moc_id}/anh"),
        (("DELETE",), "/anh/{int:anh_id}"),
        # --- tìm kiếm (Phase 7) ---
        # Dòng MỚI của bảng PLAN mục 7, và nó là một lần **lật quyết định**: mục 4 xếp
        # search full-text vào danh sách đã bác ("Cắt hẳn khỏi v1… V2"), user lật
        # 2026-08-23. Dòng bác cũ vẫn nằm nguyên ở mục 4 kèm ngày lật — lịch sử quyết
        # định là thứ mục 4 tồn tại để giữ.
        (("GET",), "/tim-kiem"),
    }


def test_bang_API_cua_PLAN_co_du_dong_sub():
    """PLAN mục 7: "plan con từng phase **được thêm** endpoint nhỏ … nhưng phải … cập nhật
    lại bảng này". Câu đó không có hàng rào nào cho tới đây.

    Bài đo đọc thẳng `PLAN.md` chứ không tin trí nhớ: endpoint sống mà bảng hợp đồng câm
    thì người viết frontend không có cách nào biết nó tồn tại.

    `GET /subs` (vá V8) mang thêm một chốt mà chỉ bảng ấy nói ra: **cấm ghi cứng danh
    sách slug ở frontend**. Dòng biến mất khỏi bảng là chốt đó biến mất cùng.

    Lượt vá V1 thêm hai dòng, mỗi dòng mang một chốt không suy ra được từ code:
    `POST /reports` — **không áp `mach_bi_khoa`** (ngoại lệ thứ hai của luật ấy, sau
    `follow`/`seen`) — và `PATCH /me`, cửa duy nhất bật được digest.
    """
    plan = (Path(__file__).resolve().parents[2] / "PLAN.md").read_text(encoding="utf-8")
    bang = plan.split("## 7. API v1")[1].split("## 8.")[0]
    assert "`GET /subs/{slug}`" in bang
    assert "`GET /subs`" in bang
    assert "`POST /reports`" in bang
    assert "`PATCH /me`" in bang
    assert "da_bao_cao" in bang, "bảng phải nói ra mã 409 của lượt tố trùng"
    assert "nhan_digest" in bang, "bảng phải nói ra trường DUY NHẤT `PATCH /me` nhận"


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
