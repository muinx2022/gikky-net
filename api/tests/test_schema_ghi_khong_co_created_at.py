"""K1 (nợ 1a bàn giao) — **không schema GHI nào được có `created_at`**.

Vì sao chuyện này thành việc của tầng API: 1a bỏ `auto_now_add` trên `Moc.created_at` để
`seed_dev` dựng lại được một mạch trải 163 ngày. Tính bất biến của PLAN nguyên tắc 3
("`created_at` là dấu thời gian cho niềm tin — server, bất biến") vì thế **không còn được
ORM giữ hộ**; nó được giữ bằng `editable=False` cộng với việc tầng API không nhận trường
đó. 1b là tầng API đầu tiên, nên hàng rào phải dựng ở đây.

Hỏng thì trông thế nào: `POST /machs` của Phase 2 nhận `created_at` từ client, người viết
tự đóng dấu giờ server của chính mình, và nhật ký "ghi-trước-khi-biết-kết-quả" thành nhật
ký viết sau khi biết kết quả. HTTP 201, không có gì đỏ, và bằng chứng sai nằm lại vĩnh
viễn trong cuốn sổ mà cả sản phẩm dựa vào.

**Phase 2 đã tới, và con mồi đã có mặt**: 11 endpoint ghi, 8 schema `*In`. Bài đo thật ở
cuối file vì thế **không còn rỗng** — `test_bay_da_co_moi` ghim đúng chuyện đó, thay cho
`test_ghi_ro_1b_chua_co_endpoint_ghi_nao` (bài đo cũ ĐỎ khi endpoint ghi đầu tiên xuất
hiện; nó đã làm xong việc của nó và được gỡ ở Phase 2, đúng như docstring của nó dặn).

Hai đối chứng dương ở giữa file thì **ở lại**: chúng chứng minh `truong_cam_trong_request_body`
thật sự bắt được trường cấm, kể cả khi nó nằm ở tầng schema lồng nhau. Không có chúng thì
hàm kiểm được phép `return []` vô điều kiện và cả file vẫn xanh.
"""

import pytest
from ninja import NinjaAPI, Router, Schema

from api.v1 import api_v1

TRUONG_CAM = "created_at"


def _mo_ref(schema: dict, nut):
    """Đi theo `$ref` về `components.schemas`. Trả `None` nếu không phải ref."""
    ref = nut.get("$ref") if isinstance(nut, dict) else None
    if not ref or not ref.startswith("#/components/schemas/"):
        return None
    return schema["components"]["schemas"].get(ref.rsplit("/", 1)[1])


def truong_cam_trong_request_body(schema: dict) -> list[str]:
    """Mọi chỗ `created_at` xuất hiện trong THÂN REQUEST của một OpenAPI doc.

    Đi qua `$ref` và đệ quy xuống mọi tầng (`properties`, `items`, `allOf`/`anyOf`/
    `oneOf`), vì một schema ghi lồng nhau — vd `MocIn` chứa `figures: list[FigureIn]` —
    vẫn có thể giấu trường cấm ở tầng dưới. Trả danh sách `operationId.đường.dẫn`; rỗng
    là đạt.
    """
    ra: list[str] = []

    def di(nut, duong: str, da_qua: set[int]):
        if id(nut) in da_qua:
            return
        da_qua = da_qua | {id(nut)}
        if isinstance(nut, list):
            for x in nut:
                di(x, duong, da_qua)
            return
        if not isinstance(nut, dict):
            return
        if (dich := _mo_ref(schema, nut)) is not None:
            di(dich, duong, da_qua)
            return
        for ten, con in (nut.get("properties") or {}).items():
            if ten == TRUONG_CAM:
                ra.append(f"{duong}.{ten}")
            di(con, f"{duong}.{ten}", da_qua)
        for khoa in ("items", "additionalProperties"):
            if isinstance(nut.get(khoa), dict):
                di(nut[khoa], f"{duong}[]", da_qua)
        for khoa in ("allOf", "anyOf", "oneOf"):
            di(nut.get(khoa) or [], duong, da_qua)

    for duong_dan, cac_method in schema["paths"].items():
        for method, op in cac_method.items():
            than = (op.get("requestBody") or {}).get("content") or {}
            for kieu, mo_ta in than.items():
                if "schema" in mo_ta:
                    di(
                        mo_ta["schema"],
                        f"{op.get('operationId', f'{method} {duong_dan}')}({kieu})",
                        set(),
                    )
    return ra


def test_hang_rao_bat_duoc_mot_schema_ghi_CO_created_at():
    """Đối chứng dương — bắt buộc, vì bài đo thật hôm nay chạy trên tập rỗng.

    Dựng một API giả có đúng cái lỗi Phase 2 sẽ mắc: schema `*In` nhận `created_at` từ
    client. Hàm kiểm phải nêu tên nó. Không có bài này thì
    `truong_cam_trong_request_body` được phép `return []` và mọi thứ vẫn xanh — kể cả khi
    Phase 2 thật sự mở cửa cho client tự đóng dấu giờ server.
    """
    api_gia = NinjaAPI(urls_namespace="test-schema-ghi")
    r = Router()

    class FigureIn(Schema):
        label: str
        value: str

    class MocIn(Schema):
        body: str
        created_at: str
        figures: list[FigureIn] | None = None

    @r.post("/mocs", operation_id="them_moc_gia")
    def them(request, du_lieu: MocIn):  # pragma: no cover - không bao giờ được gọi
        return {}

    api_gia.add_router("", r)

    # `path_prefix=""` vì API giả không được mount vào URLconf: mặc định ninja đi
    # `reverse()` để tìm chỗ mình đang treo, và nó nổ `NoReverseMatch`.
    vi_pham = truong_cam_trong_request_body(api_gia.get_openapi_schema(path_prefix=""))
    assert len(vi_pham) == 1 and vi_pham[0].endswith(".created_at"), vi_pham


def test_hang_rao_di_duoc_xuong_tang_LONG_NHAU():
    """Trường cấm nằm ở schema con cũng phải bị nêu — đó là chỗ nó dễ lọt nhất."""
    api_gia = NinjaAPI(urls_namespace="test-schema-ghi-long-nhau")
    r = Router()

    class AnhIn(Schema):
        r2_key: str
        created_at: str

    class MocIn(Schema):
        body: str
        anhs: list[AnhIn]

    @r.post("/mocs", operation_id="them_moc_long_nhau")
    def them(request, du_lieu: MocIn):  # pragma: no cover - không bao giờ được gọi
        return {}

    api_gia.add_router("", r)

    vi_pham = truong_cam_trong_request_body(api_gia.get_openapi_schema(path_prefix=""))
    assert vi_pham and all(v.endswith(".created_at") for v in vi_pham), vi_pham


def test_hang_rao_KHONG_bat_nham_created_at_o_RESPONSE():
    """`created_at` trong response là bắt buộc (biên lai của PLAN nguyên tắc 3).

    Một hàng rào quét cả `components.schemas` không phân biệt đọc/ghi sẽ đỏ ngay hôm nay,
    và cách người ta chữa là **tắt nó đi** — mất luôn cái bẫy.
    """
    assert truong_cam_trong_request_body(api_v1.get_openapi_schema()) == []
    assert "created_at" in str(api_v1.get_openapi_schema()["components"]["schemas"])


@pytest.mark.django_db
def test_api_v1_khong_co_schema_ghi_nao_nhan_created_at():
    """Bài đo THẬT — nay chạy trên tập KHÔNG rỗng (xem `test_bay_da_co_moi`)."""
    assert truong_cam_trong_request_body(api_v1.get_openapi_schema()) == []


def test_bay_da_co_moi():
    """Chống bài đo trên rỗng: phải có endpoint ghi THẬT để nó soi.

    Thay chân cho `test_ghi_ro_1b_chua_co_endpoint_ghi_nao` (đã gỡ ở Phase 2). Bài cũ hỏi
    *"đã có con mồi chưa"* để người ta biết bẫy còn rỗng; bài này hỏi ngược lại —
    **bẫy còn con mồi để canh không** — vì đó mới là câu hỏi đúng từ Phase 2 trở đi.
    Ai gỡ hết endpoint ghi (hoặc đổi chúng sang nhận `Form`/`File` không sinh
    `requestBody` JSON) thì bài trên xanh vô điều kiện, và bài này đỏ để nói ra.
    """
    schema = api_v1.get_openapi_schema()
    co_than_json = [
        f"{m.upper()} {duong}"
        for duong, ops in schema["paths"].items()
        for m, op in ops.items()
        if m.lower() in {"post", "put", "patch"}
        and "application/json" in ((op.get("requestBody") or {}).get("content") or {})
    ]
    assert len(co_than_json) >= 8, co_than_json
