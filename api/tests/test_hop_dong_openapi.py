"""Những cảnh báo K2/K3 phải nằm trong HỢP ĐỒNG công khai, không chỉ trong code.

K2 và K3 là hai món nợ 1a bàn giao, và cả hai đều là **cảnh báo cho người ĐỌC API** chứ
không phải ghi chú triển khai:

- **K2** — `last_activity_at` có thể nhỏ hơn `last_entry_at`, nên một mạch đứng đầu feed
  "Đang diễn ra" mà mở ra là mặt CẶN là hành vi ĐÚNG. Không nói ra thì 1c hoặc Phase 4 sẽ
  coi đó là bug và "chữa" bằng cách đổi khoá sort;
- **K3** — "💬 N" là N bình luận ĐỌC ĐƯỢC, không phải N dòng. Không nói ra thì 1c sẽ đếm
  số nút trả về rồi thấy nó lệch `comment_count`, và "chữa" bằng cách đếm cả bia mộ.

Chỗ duy nhất tới được người đọc API là `openapi.json` — mà **không phải mọi chữ trong
`api/schemas.py` đều tới đó**: pydantic 2 lấy docstring của CLASS, và bỏ qua comment `#:`
trên từng trường. Bài đo này ghim đúng ranh giới ấy: viết cảnh báo vào chỗ không ai đọc
được thì cũng bằng không viết.
"""

from copy import deepcopy

import pytest

from api.loi import MA_LOI_THEO_THAM_SO
from api.v1 import api_v1
from config.api_registry import NINJA_APIS


@pytest.fixture(scope="module")
def schema():
    return api_v1.get_openapi_schema()


def test_comment_cua_TUNG_TRUONG_khong_ra_toi_openapi(schema):
    """Ghim tiền đề của cả file — và nó là điều bất ngờ, nên phải đo chứ không phải tin.

    `MachTomTatOut.comment_count` có một comment `#:` dài trong `api/schemas.py`; ở
    `openapi.json` nó chỉ còn `{"title": ..., "type": "integer"}`. Ngày nào ai đó bật
    `use_attribute_docstrings` thì bài này đỏ, và đó là lúc nên xem lại chỗ đặt cảnh báo.
    """
    truong = schema["components"]["schemas"]["MachTomTatOut"]["properties"]["comment_count"]
    assert "description" not in truong


def test_K3_nam_trong_description_cua_schema_mach(schema):
    for ten in ("MachTomTatOut", "MachChiTietOut"):
        mo_ta = schema["components"]["schemas"][ten].get("description", "")
        assert "ĐỌC ĐƯỢC" in mo_ta, f"{ten} thiếu cảnh báo K3"


def test_K2_nam_trong_description_cua_schema_mach_va_cua_feed_dang_dien_ra(schema):
    mo_ta = schema["components"]["schemas"]["MachTomTatOut"].get("description", "")
    assert "last_activity_at" in mo_ta and "last_entry_at" in mo_ta

    feed = schema["paths"]["/api/v1/feeds/dang-dien-ra"]["get"].get("description", "")
    assert "CẶN" in feed and "last_activity_at" in feed, "feed thiếu cảnh báo K2"


def test_face_noi_ro_ve_viewer_CHUA_duoc_ap(schema):
    """Người đọc API phải biết `face` ở bản này còn thiếu một vế của PLAN 5.5.

    Không nói ra thì 1c/Phase 3 tưởng `face` đã đủ và không gọi `GET /machs/{id}/me`.
    """
    mo_ta = schema["components"]["schemas"]["MachChiTietOut"].get("description", "")
    assert "chưa được áp" in mo_ta
    assert "/machs/{id}/me" in mo_ta


def test_moi_endpoint_deu_co_description(schema):
    """Docstring endpoint LÀ tài liệu API. Endpoint không có mô tả là một hợp đồng câm."""
    thieu = [
        f"{m.upper()} {duong}"
        for duong, ops in schema["paths"].items()
        for m, op in ops.items()
        if not (op.get("description") or "").strip()
    ]
    assert thieu == []


#: Endpoint **không có đường lỗi client nào** — miễn khai `LoiOut`, kèm lý do.
#:
#: Danh sách TƯỜNG MINH chứ không phải một điều kiện suy ra ("không có tham số thì bỏ
#: qua"): điều kiện suy ra sẽ tự động miễn trừ cho endpoint tiếp theo mà không ai nhìn
#: lại, còn một dòng thêm vào đây thì nằm trong diff và phải viết ra lý do.
KHONG_CO_LOI_CLIENT = {
    # `GET /subs` không nhận tham số nào: không path param, không query, không phân trang
    # (v1 tạo sub bằng tay — xem docstring endpoint). Không có đầu vào thì không có 4xx
    # nào để khai, và khai một `404: LoiOut` không bao giờ xảy ra là bắt frontend viết
    # một nhánh xử lý cho một ca không tồn tại.
    "/api/v1/subs",
}


def test_moi_endpoint_deu_khai_hinh_dang_loi_chuan(schema):
    """PLAN mục 7: lỗi là `{detail, code}`. Endpoint nào cũng phải KHAI ra hình dạng đó.

    Không khai thì TS client sinh ra có kiểu lỗi `unknown` và frontend quay lại đoán —
    đúng thứ luật "type một chiều" (PLAN 8.3) dựng lên để chặn.

    Miễn trừ: `/health` (trả `HealthOut` ở cả 200 lẫn 503) và `KHONG_CO_LOI_CLIENT`.
    """
    thieu = []
    for duong, ops in schema["paths"].items():
        for m, op in ops.items():
            if duong.endswith("/health"):
                continue  # healthcheck trả HealthOut ở cả 200 lẫn 503, cố ý
            if duong in KHONG_CO_LOI_CLIENT:
                continue
            # Khoá `responses` là int khi đọc từ `get_openapi_schema()` và là chuỗi sau
            # khi qua JSON — file này đọc bản Python nên phải ép về chuỗi.
            ma_loi = {ma for ma in op["responses"] if str(ma).startswith(("4", "5"))}
            if not ma_loi:
                thieu.append(f"{m.upper()} {duong}: không khai mã lỗi nào")
                continue
            for ma in ma_loi:
                than = op["responses"][ma]["content"]["application/json"]["schema"]
                if than.get("$ref", "").rsplit("/", 1)[-1] != "LoiOut":
                    thieu.append(f"{m.upper()} {duong} [{ma}]: {than}")
    assert thieu == []


def test_giay_mien_tru_loi_khong_chet_va_khong_noi_dieu(schema):
    """Chiều ngược của bài trên: giấy miễn trừ phải còn đúng, không phải còn đó.

    Hai cửa. Path biến mất khỏi API mà giấy vẫn nằm lại thì lần sau nó cấp cho một
    endpoint khác trùng đường dẫn — im lặng. Và endpoint được miễn mà **mọc ra tham số**
    thì lý do miễn (không có đầu vào ⇒ không có 4xx) hết đúng ngay lúc đó: một `?limit=`
    thêm vào là có ngay đường 400 mà không ai phải khai hình dạng lỗi.
    """
    chet = [d for d in KHONG_CO_LOI_CLIENT if d not in schema["paths"]]
    assert chet == [], f"giấy miễn trừ trỏ vào path không tồn tại: {chet}"

    co_tham_so = [
        f"{m.upper()} {d}"
        for d in KHONG_CO_LOI_CLIENT
        for m, op in schema["paths"][d].items()
        if op.get("parameters")
    ]
    assert co_tham_so == [], (
        f"{co_tham_so} đã có tham số ⇒ có đường 4xx ⇒ phải khai LoiOut, "
        "không được nằm trong KHONG_CO_LOI_CLIENT nữa"
    )


# --- X5: mọi query param `enum` phải có chủ trong bảng mã lỗi -----------------
#
# `MA_LOI_THEO_THAM_SO` (api/loi.py) sinh ra ở W9 để giữ đúng một mã: `sort`. Nhưng
# **không gì buộc tham số thứ hai phải đi qua đó**. Khai thêm một `Literal` là pydantic
# từ chối giá trị lạ TRƯỚC khi thân hàm chạy, nhánh trả mã riêng viết tay không còn được
# gọi, và mã rơi về `tham_so_khong_hop_le` **im lặng** — đúng loài lỗi W9 dựng bảng ấy để
# chặn, chỉ khác chỗ xảy ra. Hàng rào dưới đây bắt người thêm param phải CHỌN, tường minh.


#: Query param có `enum` mà **cố ý** dùng mã mặc định `tham_so_khong_hop_le`, kèm lý do.
#:
#: Danh sách tường minh, không phải một điều kiện suy ra — cùng lý lẽ với
#: `KHONG_CO_LOI_CLIENT` ở trên: một dòng thêm vào đây nằm trong diff và phải viết ra lý do.
CO_Y_DUNG_MA_MAC_DINH: dict[str, str] = {
    "khoang": (
        "Không có mã riêng nào trong hợp đồng cho `khoang`, và docstring của cả hai feed "
        "đã nói đúng thế: 'Giá trị lạ trả 400 tham_so_khong_hop_le'. Khác `sort` ở chỗ "
        "`sort` TỪNG có nhánh kiểm tay trả `sort_khong_hop_le` (và `api/machs.py` vẫn "
        "còn), nên đổi mã của nó là breaking change; `khoang` sinh ra sau `Literal` nên "
        "chưa bao giờ hứa mã nào khác. Xem `test_api_feed_top.py::test_khoang_la_tra_400`."
    ),
}


def _co_enum(nut) -> bool:
    """Có `enum` ở BẤT KỲ tầng nào của một mảnh JSON Schema.

    Không đọc thẳng `schema["enum"]`: `Optional[Literal[...]]` ra `anyOf`, và một `Literal`
    có `default` có thể ra `allOf`. Đọc một tầng là hàng rào mù với đúng ca người ta sẽ
    viết khi tham số mới là tuỳ chọn.
    """
    if isinstance(nut, dict):
        return "enum" in nut or any(_co_enum(v) for v in nut.values())
    if isinstance(nut, list):
        return any(_co_enum(v) for v in nut)
    return False


def query_param_co_enum(schema: dict) -> set[str]:
    """Tên mọi query param có `enum` trong MỘT schema OpenAPI.

    Hàm THUẦN, nhận dict chứ không nhận `NinjaAPI`: đối chứng dương bên dưới cần bơm vào
    một tham số giả, mà `NinjaAPI.get_openapi_schema()` của một API dựng trong test thì
    `NoReverseMatch` (nó phải `reverse()` được namespace, tức phải mount thật vào
    `config/urls.py`). Nhận dict là đo được cả hai đầu bằng cùng một hàm.
    """
    return {
        prm["name"]
        for ops in schema["paths"].values()
        for op in ops.values()
        for prm in op.get("parameters", ())
        if prm.get("in") == "query" and _co_enum(prm.get("schema", {}))
    }


def moi_query_param_co_enum() -> set[str]:
    """…trên TOÀN BỘ registry, không riêng `v1`.

    Phase 4 thêm `NinjaAPI` cho `/api/admin` (PLAN mục 7): hàng rào chỉ soi `v1` sẽ im
    lặng cho qua đúng nhóm endpoint mới, và đó là cùng cái bẫy `api_registry.py` đã dựng
    ba cái chuông để chặn.
    """
    return set().union(
        *(query_param_co_enum(a.get_openapi_schema()) for a in NINJA_APIS.values())
    )


def test_hang_rao_nay_bat_duoc_mot_param_enum_MOI(schema):
    """Đối chứng dương — bắt buộc, vì cả hàng rào là một phép so hai tập.

    `query_param_co_enum` trả `set()` vô điều kiện thì bài chính dưới đây XANH mãi mãi:
    tập rỗng thì không có tên nào "chưa có chủ". Đúng loại proof đo RỖNG mà repo đã dính.

    Tham số giả được **nhân bản từ hình dạng THẬT** mà Ninja sinh cho `sort`, không phải
    một dict tự nghĩ ra: nếu django-ninja đổi cách xuất `Literal` thì bài này đỏ cùng lúc
    với bài chính, chứ không xanh một mình rồi trấn an.
    """
    that = deepcopy(schema)
    op = that["paths"]["/api/v1/feeds/moi"]["get"]
    goc = next(p for p in op["parameters"] if p["name"] == "sort")

    # 1. hình dạng thật, đổi tên ⇒ phải bị nhìn thấy;
    moi = deepcopy(goc) | {"name": "che_do_moi"}
    # 2. cùng thế nhưng bọc trong `anyOf` — hình dạng của `Optional[Literal[...]]`;
    tuy_chon = {
        "name": "che_do_tuy_chon",
        "in": "query",
        "schema": {"anyOf": [deepcopy(goc["schema"]), {"type": "null"}]},
    }
    op["parameters"] = [*op["parameters"], moi, tuy_chon]

    thay = query_param_co_enum(that)
    assert {"che_do_moi", "che_do_tuy_chon"} <= thay, (
        "hàng rào không nhìn thấy param `enum` mới — nó đang đo rỗng"
    )
    assert "limit" not in thay, "param không `enum` không được lọt vào"
    assert "sort" in query_param_co_enum(schema), (
        "hàng rào không nhận ra `sort` trên schema THẬT — hàm thuần đang đo một hình "
        "dạng mà django-ninja không còn sinh ra"
    )


def test_moi_query_param_enum_deu_co_CHU_trong_bang_ma_loi():
    """X5 — thêm một `Literal` mà không quyết định gì về mã lỗi ⇒ ĐỎ.

    Hai lối ra hợp lệ, và người thêm param phải chọn một cách tường minh: cấp mã riêng
    trong `MA_LOI_THEO_THAM_SO`, hoặc khai vào `CO_Y_DUNG_MA_MAC_DINH` kèm lý do. Lối thứ
    ba — không làm gì cả — là lối duy nhất hôm qua không có gì chặn.
    """
    mo_coi = sorted(
        moi_query_param_co_enum() - set(MA_LOI_THEO_THAM_SO) - set(CO_Y_DUNG_MA_MAC_DINH)
    )
    assert mo_coi == [], (
        f"query param {mo_coi} khai `enum` nhưng không ai nói nó trả mã lỗi nào. "
        "Cấp mã riêng ở `api/loi.py::MA_LOI_THEO_THAM_SO`, hoặc khai vào "
        "`CO_Y_DUNG_MA_MAC_DINH` kèm lý do — im lặng thì nó rơi về `tham_so_khong_hop_le`."
    )


def test_hai_danh_sach_khong_co_dong_CHET_va_khong_giam_chan_nhau():
    """Chiều ngược: giấy tờ phải còn đúng, không phải còn đó.

    - Tên biến mất khỏi API mà dòng vẫn nằm lại ⇒ lần sau nó cấp cho một param khác trùng
      tên, im lặng. (`MA_LOI_THEO_THAM_SO` cố ý **không** bị soi vế này: `sort` còn được
      `api/machs.py` kiểm bằng tay, tức nó sống cả ở chỗ không có `enum` nào.)
    - Một tên nằm ở CẢ HAI danh sách là hai câu trả lời ngược nhau cho cùng một câu hỏi.
    """
    chet = sorted(set(CO_Y_DUNG_MA_MAC_DINH) - moi_query_param_co_enum())
    assert chet == [], f"giấy 'cố ý dùng mã mặc định' trỏ vào param không còn `enum`: {chet}"

    ca_hai = sorted(set(CO_Y_DUNG_MA_MAC_DINH) & set(MA_LOI_THEO_THAM_SO))
    assert ca_hai == [], f"{ca_hai} vừa được cấp mã riêng vừa khai dùng mã mặc định"

    thieu_ly_do = [k for k, v in CO_Y_DUNG_MA_MAC_DINH.items() if len(v.strip()) < 40]
    assert thieu_ly_do == [], f"{thieu_ly_do} khai miễn trừ mà không viết lý do"
