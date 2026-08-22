"""Hợp đồng của `api_admin` — bản song song của `tests/test_hop_dong_openapi.py`.

**Vì sao là file MỚI chứ không phải thêm mấy dòng vào file cũ:** `test_hop_dong_openapi.py`
lấy schema qua fixture `api_v1`, và mọi bài đo trong đó đọc đúng schema ấy. Nới chúng
thành "lặp cả registry" là sửa mười chỗ trong một file mà ba mảng khác cũng đang sửa. Ở
đây là cùng ba mệnh đề, áp cho `api_admin`, trong một file không ai khác đụng tới.

Ba mệnh đề (giống hệt bản v1, và đó là chủ đích — hợp đồng không có hai chuẩn):

1. mọi endpoint có `description` (docstring endpoint LÀ tài liệu API);
2. mọi endpoint khai hình dạng lỗi `{detail, code}` cho mọi mã 4xx/5xx;
3. mọi endpoint khai `operation_id` tường minh, không trùng nhau.

Cộng một mệnh đề **của riêng khu quản trị**: `Literal` trong `api/quan_tri_schemas.py`
phải trùng ĐÚNG `TextChoices` của model. Hai bản sao của cùng một tập giá trị là bản thứ
hai sẽ trôi — và cái trôi ở đây là `ly_do` của một báo cáo hiện ra rỗng trên bảng của mod.
"""

from pathlib import Path
from typing import get_args

import pytest

from core.models import Report

from api.quan_tri import api_admin
from api.quan_tri_schemas import (
    DAI_TRICH_YEU,
    DichBaoCao,
    LyDoBaoCao,
    trich_yeu,
)


@pytest.fixture(scope="module")
def schema():
    return api_admin.get_openapi_schema()


def _moi_operation():
    for prefix, router in api_admin._routers:
        for path, path_view in router.path_operations.items():
            for op in path_view.operations:
                yield f"{prefix}{path}", op


def test_moi_endpoint_deu_khai_operation_id_tuong_minh():
    """Không khai ⇒ tên hàm TS trôi theo tên hàm Python (PLAN mục 7).

    Đọc object `Operation` chứ không đọc schema: trong schema, `operationId` tự sinh và
    khai tay trông y hệt nhau.
    """
    thieu = [f"{op.methods} {duong}" for duong, op in _moi_operation() if not op.operation_id]
    assert thieu == []


def test_operation_id_khong_trung_nhau_va_deu_mang_tien_to_quan_tri():
    """Tiền tố `quan_tri_` không phải thẩm mỹ.

    Client TS của hai khoá registry được import vào **cùng một** app admin (`@gikky/api-client`
    và `@gikky/api-client/admin`). Trùng tên là hai hàm cùng tên trong một file — người viết
    frontend đổi import rồi tưởng mình vẫn gọi cùng một thứ.
    """
    ids = [op.operation_id for _, op in _moi_operation()]
    trung = sorted({i for i in ids if ids.count(i) > 1})
    assert trung == []
    assert [i for i in ids if not i.startswith("quan_tri_")] == []


def test_moi_endpoint_deu_co_description(schema):
    thieu = [
        f"{m.upper()} {duong}"
        for duong, ops in schema["paths"].items()
        for m, op in ops.items()
        if not (op.get("description") or "").strip()
    ]
    assert thieu == []


def test_moi_endpoint_deu_khai_hinh_dang_loi_chuan(schema):
    """Mọi mã 4xx/5xx phải trỏ `LoiOut`. Không có giấy miễn trừ nào ở khu này.

    Khác `api_v1` — nơi `/health` và `GET /subs` được miễn — vì mọi endpoint quản trị đều
    có ít nhất hai đường lỗi (401, 403) do chính hàng rào sinh ra.
    """
    hong = []
    for duong, ops in schema["paths"].items():
        for m, op in ops.items():
            ma_loi = {ma for ma in op["responses"] if str(ma).startswith(("4", "5"))}
            if not ma_loi:
                hong.append(f"{m.upper()} {duong}: không khai mã lỗi nào")
                continue
            for ma in ma_loi:
                than = op["responses"][ma]["content"]["application/json"]["schema"]
                if than.get("$ref", "").rsplit("/", 1)[-1] != "LoiOut":
                    hong.append(f"{m.upper()} {duong} [{ma}]: {than}")
    assert hong == []


def test_moi_endpoint_deu_khai_401_va_403(schema):
    """Hàng rào là một phần của HỢP ĐỒNG, không phải một chi tiết triển khai.

    App admin phải phân biệt "hiện form đăng nhập" với "tài khoản này không phải mod";
    endpoint không khai hai mã ấy thì TS client cho kiểu lỗi thiếu và frontend quay lại
    đoán theo `status`.
    """
    thieu = [
        f"{m.upper()} {duong}"
        for duong, ops in schema["paths"].items()
        for m, op in ops.items()
        if not {"401", "403"} <= {str(ma) for ma in op["responses"]}
    ]
    assert thieu == []


def test_Literal_cua_schema_trung_dung_TextChoices_cua_model():
    """Bản sao thứ hai của một tập giá trị luôn là bản sẽ trôi — đây là chỗ nó đỏ.

    Đi CẢ HAI chiều: model thêm một lý do mà schema không biết ⇒ TS client thiếu nhánh;
    schema có một giá trị model không nhận ⇒ 500 lúc ghi.
    """
    assert set(get_args(LyDoBaoCao)) == set(Report.LyDo.values)
    assert set(get_args(DichBaoCao)) == set(Report.Dich.values)


def test_bang_API_cua_PLAN_co_dong_cho_khu_quan_tri():
    """PLAN mục 7: "plan con từng phase được thêm endpoint … nhưng phải cập nhật lại bảng".

    Đọc thẳng `PLAN.md` chứ không tin trí nhớ: endpoint sống mà bảng hợp đồng câm thì
    người viết frontend không có cách nào biết nó tồn tại.
    """
    plan = (Path(__file__).resolve().parents[2] / "PLAN.md").read_text(encoding="utf-8")
    bang = plan.split("## 7. API v1")[1].split("## 8.")[0]
    for duong in (
        "`GET /admin/reports`",
        "`POST /admin/mocs/{id}/an`",
        "`POST /admin/users/{username}/ban`",
        "`GET /admin/nhat-ky`",
    ):
        assert duong in bang, f"PLAN mục 7 thiếu dòng {duong}"


@pytest.mark.parametrize(
    "vao,ra",
    [
        ("một dòng", "một dòng"),
        ("nhiều\ndòng\tvà   khoảng trắng", "nhiều dòng và khoảng trắng"),
        ("x" * DAI_TRICH_YEU, "x" * DAI_TRICH_YEU),
        ("x" * (DAI_TRICH_YEU + 1), "x" * DAI_TRICH_YEU + "…"),
    ],
)
def test_trich_yeu_cat_dung_bien(vao, ra):
    """Biên `≤` chứ không `<`: chuỗi dài đúng bằng trần KHÔNG được gắn `…`.

    Một dấu `…` thừa trên một chuỗi chưa bị cắt là nói dối về việc nội dung còn nữa — và
    mod đọc hàng đợi tin vào đúng dấu ấy để quyết có mở ra xem không.
    """
    assert trich_yeu(vao) == ra
