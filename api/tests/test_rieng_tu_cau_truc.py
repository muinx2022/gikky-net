"""Bài đo CẤU TRÚC của luật mạch riêng tư — thêm một cửa mà chưa phân loại ⇒ ĐỎ.

Plan `plans/2026-11-09-va-ro-mach-rieng-tu.md`, B7 / A6.

## Vì sao không chỉ là một bảng `parametrize`

`test_rieng_tu_ro.py` bấm từng cửa trong `_rieng_tu_cua.BANG_CUA` và đòi 404 cho người lạ. Bảng
ấy trả lời *"hai mươi bảy cửa này có rào không"* — nhưng **không** trả lời *"cửa thứ hai mươi
tám có rào không"*: thêm một route có `{mach_id}` thì bảng vẫn xanh, vì route mới không có dòng
nào trong bảng. Cùng loài "proof đo RỖNG" mà `test_tim_kiem_cau_truc.py` đã chặn cho chỉ mục.

Nên bài đo này **dò router thật** (`api_v1._get_bound_routers()`, không chép tay) và đòi:

1. tập cửa của router BẰNG ĐÚNG tập khoá của `BANG_CUA` — thiếu một cửa (chưa phân loại, nên
   chưa được đo) hoặc thừa một dòng (cửa đã bị xoá khỏi router) đều đỏ;
2. con số cửa đếm được không rỗng (`>= 27`), để một lần django-ninja đổi tên thuộc tính nội bộ
   không làm phép dò trả `[]` rồi xanh vô điều kiện.

"Cửa" = operation có BẤT KỲ tham số nào — đường dẫn (có hoặc không có converter `int:`),
query (kể cả `Query[Schema]`) hay thân request (kể cả schema lồng) — tên khớp
`(mach|moc|comment|anh)_id` hoặc `target_id`. Dò trên **OpenAPI thật của `api_v1`**
(`get_openapi_schema`), tức đúng thứ django-ninja coi là tham số, chứ không dò chuỗi đường
dẫn bằng regex: bản trước chỉ bắt path khai kiểu `{int:xxx}` nên một route `/x/{anh_id}`
(không converter) hay `?mach_id=` lọt qua xanh. `/votes`, `/reports` mang id trong thân dưới
tên `target_id`.
Khu `/mod/…` bị loại (staff xem được mạch riêng tư — ngoài phạm vi), và `api_admin` không
được dò.
"""

import inspect
import re

from ninja import NinjaAPI, Query, Router, Schema

from api.ghi_chung import nap_binh_luan, nap_mach, nap_moc
from api.v1 import api_v1

from ._rieng_tu_cua import (
    BANG_CUA,
    NHOM_CHU,
    NHOM_DOC,
    NHOM_GHI_MO,
    NHOM_STAFF,
    tong_so_bien_the,
)

#: Tên tham số (bất kể đặt ở đâu) nghĩa là "trỏ vào một mạch / mốc / bình luận / ảnh".
TEN_ID_CUA = re.compile(r"(?:mach|moc|comment|anh)_id|target_id")
#: Khu staff: xem được mạch riêng tư, ngoài phạm vi plan.
TIEN_TO_BO_QUA = ("/mod/",)
SO_CUA_TOI_THIEU = 27  # 25 route có id trên đường dẫn + `/votes` + `/reports` (plan A6)


def _ten_trong_schema(node, thanh_phan: dict, da_xet: frozenset = frozenset()) -> set[str]:
    """Mọi tên thuộc tính của một schema OpenAPI, đi theo `$ref` / allOf / anyOf / items."""
    if not isinstance(node, dict):
        return set()
    ra: set[str] = set()
    ref = node.get("$ref")
    if ref:
        if ref in da_xet:
            return ra
        ten = ref.rsplit("/", 1)[-1]
        return _ten_trong_schema(
            thanh_phan.get(ten, {}), thanh_phan, da_xet | {ref}
        )
    for ten, con in node.get("properties", {}).items():
        ra.add(ten)
        ra |= _ten_trong_schema(con, thanh_phan, da_xet)
    for khoa in ("allOf", "anyOf", "oneOf"):
        for con in node.get(khoa, []):
            ra |= _ten_trong_schema(con, thanh_phan, da_xet)
    if "items" in node:
        ra |= _ten_trong_schema(node["items"], thanh_phan, da_xet)
    return ra


def chuan_khoa(khoa: str) -> str:
    """Bỏ converter: `"GET /a/{int:mach_id}"` → `"GET /a/{mach_id}"` (OpenAPI không giữ nó)."""
    return re.sub(r"\{\w+:(\w+)\}", r"{\1}", khoa)


def cua_cua_router(api: NinjaAPI) -> set[str]:
    """Tập khoá `"METHOD đường-dẫn"` (đã `chuan_khoa`) của mọi operation mang id mạch / mốc /
    bình luận / ảnh ở BẤT KỲ đâu trong tham số của nó."""
    bo_cuc = api.get_openapi_schema(path_prefix="")
    thanh_phan = bo_cuc.get("components", {}).get("schemas", {})
    ra: set[str] = set()
    for duong, cac_phuong_thuc in bo_cuc["paths"].items():
        if duong.startswith(TIEN_TO_BO_QUA):
            continue
        for phuong_thuc, op in cac_phuong_thuc.items():
            ten = {tham_so["name"] for tham_so in op.get("parameters", [])}
            for noi_dung in (op.get("requestBody") or {}).get("content", {}).values():
                ten |= _ten_trong_schema(noi_dung.get("schema"), thanh_phan)
            if any(TEN_ID_CUA.fullmatch(t) for t in ten):
                ra.add(f"{phuong_thuc.upper()} {duong}")
    return ra


def so_sanh(cua: set[str], bang: dict) -> tuple[set[str], set[str]]:
    """`(cửa chưa phân loại, dòng bảng không còn cửa nào)`."""
    bang_chuan = {chuan_khoa(k) for k in bang}
    return cua - bang_chuan, bang_chuan - cua


def test_moi_cua_cua_router_deu_co_trong_bang():
    cua = cua_cua_router(api_v1)
    chua_phan_loai, mo_coi = so_sanh(cua, BANG_CUA)
    assert not chua_phan_loai, (
        "Cửa mang id mạch / mốc / bình luận / ảnh mà CHƯA có trong `_rieng_tu_cua.BANG_CUA` "
        "(nghĩa là chưa ai đo nó với mạch riêng tư — thêm dòng, nó sẽ tự phải trả 404 cho "
        f"người lạ): {sorted(chua_phan_loai)}"
    )
    assert not mo_coi, f"Dòng trong BANG_CUA không còn cửa nào ở router: {sorted(mo_coi)}"


def test_phep_do_khong_rong_va_dung_so_cua():
    """Chống xanh rỗng: nếu `_get_bound_routers`/`path_operations` đổi tên thì phép dò trả
    `[]` và bài trên khớp với… một bảng cũng rỗng. 27 là con số plan chốt (A6)."""
    cua = cua_cua_router(api_v1)
    assert len(cua) >= SO_CUA_TOI_THIEU, (
        f"chỉ dò được {len(cua)} cửa — phép dò router hỏng, không phải repo hết cửa"
    )
    assert tong_so_bien_the() >= SO_CUA_TOI_THIEU


def test_moi_dong_bang_co_nhom_hop_le():
    nhom_hop_le = {NHOM_DOC, NHOM_GHI_MO, NHOM_CHU, NHOM_STAFF}
    for khoa, bien_the in BANG_CUA.items():
        assert bien_the, f"{khoa}: không có biến thể nào để gọi"
        for ten, cua in bien_the.items():
            assert cua.nhom in nhom_hop_le, f"{khoa} [{ten}]: nhóm {cua.nhom!r} lạ"


# --- A6: chứng minh bài đo ĐỎ khi thêm cửa chưa phân loại ---------------------------------


class _ThanAnh(Schema):
    anh_id: int


class _TruyVanMoc(Schema):
    moc_id: int


def _api_gia() -> NinjaAPI:
    """Một `NinjaAPI` riêng (không mount, KHÔNG đụng router thật) có sáu route giả, mỗi cái
    giấu id mạch / mốc / bình luận / ảnh theo một kiểu mà regex `{int:xxx}` bỏ sót."""
    api = NinjaAPI(urls_namespace="gia-rieng-tu")
    router = Router()

    @router.get("/g1/{int:comment_id}")  # (1) path có converter
    def gia_1(request, comment_id: int):
        return {}

    @router.get("/g2/{anh_id}")  # (2) path KHÔNG converter
    def gia_2(request, anh_id: str):
        return {}

    @router.get("/g3")  # (3) query ?mach_id=
    def gia_3(request, mach_id: int):
        return {}

    @router.post("/g4")  # (4) body Schema có anh_id
    def gia_4(request, du_lieu: _ThanAnh):
        return {}

    @router.get("/g5")  # (5) Query[Schema] có moc_id
    def gia_5(request, loc: Query[_TruyVanMoc]):
        return {}

    @router.delete("/g6/{int:mach_id}/chi-tiet")  # (6) DELETE, id ở giữa đường dẫn
    def gia_6(request, mach_id: int):
        return {}

    api.add_router("", router)
    return api


CAC_CUA_GIA = {
    "GET /g1/{comment_id}",
    "GET /g2/{anh_id}",
    "GET /g3",
    "POST /g4",
    "GET /g5",
    "DELETE /g6/{mach_id}/chi-tiet",
}


def test_sau_route_gia_deu_bi_bat_la_chua_phan_loai():
    """A6, bản mở rộng: MỖI kiểu giấu id (không converter, query, body, `Query[Schema]`, DELETE
    giữa đường dẫn…) đều phải làm bài đo đỏ — kiểm từng cái, không chỉ kiểm tập."""
    cua = cua_cua_router(_api_gia())
    assert cua == CAC_CUA_GIA, f"phép dò sót / thừa: {sorted(cua ^ CAC_CUA_GIA)}"
    chua_phan_loai, _ = so_sanh(cua, BANG_CUA)
    for khoa in sorted(CAC_CUA_GIA):
        assert khoa in chua_phan_loai, f"{khoa} lọt qua bài đo cấu trúc"


# --- D3: `user` bắt buộc ở ba hàm nạp ------------------------------------------------


def test_ba_ham_nap_doi_user_bat_buoc_keyword_khong_mac_dinh():
    """Quên truyền `user` phải là `TypeError` lúc chạy, không phải một cửa im lặng mở cho
    người lạ (D3). Đo chữ ký, vì đo hành vi chỉ bắt được cửa đã có test."""
    for ham in (nap_mach, nap_moc, nap_binh_luan):
        tham_so = inspect.signature(ham).parameters["user"]
        assert tham_so.kind is inspect.Parameter.KEYWORD_ONLY, ham.__name__
        assert tham_so.default is inspect.Parameter.empty, ham.__name__
